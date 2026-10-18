// Chat errands, shared by every site. The stream page (the only one that reads YouTube chat) announces what chat asked for; this
// schedules it (one at a time, never overlapping) and every page replays it at the same moment (src/errands/).
//   GET  /api/chatq?after=<seq>  -> { now, events: [{seq,t,t0,secs,cmd,name,arg,votes,self}] }   (only recent ones)
//   POST /api/chatq {cmd,name,arg,votes,self}  header x-stream-key = secret STREAM_KEY  -> { ok, event }
// Storage: Cloudflare D1 (binding DB, table chatq, migrations/0004_chatq.sql). cmd must be a real command with an act; names are cleaned.
import { COMMANDS, cleanName } from '../../src/errands/commands.js';
const GAP = 4000, LEAD = 6000, KEEP = 90000;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestGet({ env, request }) {
  const after = Math.max(0, +new URL(request.url).searchParams.get('after') || 0), now = Date.now();
  const r = await env.DB.prepare('SELECT seq, t, t0, secs, cmd, name, arg, votes, self FROM chatq WHERE seq > ? AND t0 > ? ORDER BY seq LIMIT 20').bind(after, now - KEEP).all();
  return json({ now, events: r.results.map(e => ({ ...e, self: !!e.self })) });
}

export async function onRequestPost({ env, request }) {
  if (!env.STREAM_KEY) return json({ ok: false, why: 'no key set' }, 503);
  if (request.headers.get('x-stream-key') !== env.STREAM_KEY) return json({ ok: false, why: 'not allowed' }, 403);
  let b; try { b = await request.json(); } catch { return json({ ok: false, why: 'bad json' }, 400); }
  const c = COMMANDS[b?.cmd]; if (!c?.spot) return json({ ok: false, why: 'unknown command' }, 400);
  const now = Date.now(), name = b.self ? 'me' : cleanName(b.name), arg = String(b.arg || '').replace(/[^\p{L}\p{N} '&?!.,-]/gu, '').slice(0, 40), votes = Math.min(99, Math.max(1, Math.round(+b.votes || 1)));
  const last = await env.DB.prepare('SELECT MAX(t0 + secs * 1000) v FROM chatq WHERE t0 > ?').bind(now - 120000).first();
  const t0 = Math.max(now + LEAD, (last?.v || 0) + GAP);
  const row = await env.DB.prepare('INSERT INTO chatq (t, t0, secs, cmd, name, arg, votes, self) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING seq').bind(now, t0, c.secs, b.cmd, name, arg, votes, b.self ? 1 : 0).first();
  return json({ ok: true, event: { seq: row.seq, t: now, t0, secs: c.secs, cmd: b.cmd, name, arg, votes, self: !!b.self } });
}
