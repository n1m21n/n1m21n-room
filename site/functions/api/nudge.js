// Shared life, visitor side. While someone plays in the room, their browser records what they did; when they leave (or hand him back
// to the live feed) it posts ONE short summary here: which things they used, how many times, how long they stayed. Every visitor's
// browser reads this log and replays it into the same canonical life (src/sim/life.js), where a visit leaves him leaning toward
// what the visitor did, with a little company and fun. Nothing is acted out live; the visit just shapes his days.
//   GET  /api/nudge?after=<seq>        -> { now, events: [{seq,t,act,n,secs}], counts: {act:n}, visitors: n }
//   POST /api/nudge {vid, secs, acts}  -> { ok, rows } | { ok:false, why, retry }
// Storage: Cloudflare D1 (binding DB), one row per act in a summary. Only whitelisted acts; counts and seconds are clamped; one summary
// per visitor (and per hashed address) per MIN_GAP; a summary needs at least MIN_SECS of play.
const MIN_GAP = 60000, MIN_SECS = 20, MAX_SECS = 1800, MAX_N = 20, MAX_ACTS = 32;
const ACTS = new Set(['sleep', 'bench', 'eat', 'cook', 'fridge', 'tea', 'guitar', 'keys', 'tv', 'records', 'snake', 'window', 'read', 'work', 'shower', 'brush', 'wash', 'loo', 'dress', 'gallery_view', 'lamp', 'sit', 'timeline', 'phone_call', 'water_plant', 'art_refine']);   // everything a visitor can use in the room
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const sha = async x => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)))].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');   // a short salted hash, never the address itself

export async function onRequestGet({ env, request }) {
  const after = Math.max(0, +new URL(request.url).searchParams.get('after') || 0);
  const [ev, cn, vs] = await env.DB.batch([
    env.DB.prepare('SELECT seq, t, act, n, secs FROM nudges WHERE seq > ? ORDER BY seq LIMIT 1000').bind(after),
    env.DB.prepare('SELECT act, SUM(n) n FROM nudges GROUP BY act'),
    env.DB.prepare('SELECT COUNT(DISTINCT vid) n FROM nudges'),
  ]);
  return json({ now: Date.now(), events: ev.results, counts: Object.fromEntries(cn.results.map(r => [r.act, r.n])), visitors: vs.results[0]?.n || 0 });
}

export async function onRequestPost({ env, request }) {
  let b; try { b = await request.json(); } catch { return json({ ok: false, why: 'bad json' }, 400); }
  const vid = String(b?.vid || '').slice(0, 40);
  if (!/^[a-z0-9-]{8,40}$/i.test(vid)) return json({ ok: false, why: 'not allowed' }, 400);
  const secs = Math.min(MAX_SECS, Math.max(0, Math.round(+b?.secs || 0)));
  const acts = Object.entries(b?.acts && typeof b.acts === 'object' ? b.acts : {}).filter(([k, v]) => ACTS.has(k) && +v > 0).slice(0, MAX_ACTS).map(([k, v]) => [k, Math.min(MAX_N, Math.round(+v))]);
  if (secs < MIN_SECS || !acts.length) return json({ ok: false, why: 'too short' }, 400);
  const now = Date.now(), ip = await sha(String(request.headers.get('cf-connecting-ip') || '') + ':n1m21n');
  const last = await env.DB.prepare('SELECT MAX(t) v FROM nudges WHERE vid = ? OR (ip = ? AND ip != \'\')').bind(vid, ip).first();
  if (last?.v && now - last.v < MIN_GAP) return json({ ok: false, why: 'slow down', retry: Math.ceil((MIN_GAP - (now - last.v)) / 1000) }, 429);
  const total = acts.reduce((s, [, n]) => s + n, 0);
  await env.DB.batch(acts.map(([act, n]) => env.DB.prepare('INSERT INTO nudges (t, act, vid, ip, n, secs) VALUES (?, ?, ?, ?, ?, ?)').bind(now, act, vid, ip, n, Math.round(secs * n / total))));
  return json({ ok: true, rows: acts.length, t: now });
}
