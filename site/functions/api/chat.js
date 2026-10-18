// YouTube Live chat for the stream page (src/stream/bridge.js). The browser never sees the API key.
//   GET /api/chat?v=<videoId>[&p=<pageToken>] -> { messages: [{user, name, text, t}], next, wait }
// Needs a secret YT_API_KEY (Google Cloud: YouTube Data API v3 enabled). Quota: each chat read costs ~5 of the 10,000 daily units (about 2,000
// reads a day), so `wait` is 6 s while people are typing and 20 s when chat is quiet; if the quota runs out it backs off for 5 minutes.
// The answer is cached 4 s per video per instance. Errors carry YouTube's own reason so the stream overlay can show it.
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
// YouTube's own reason for a refusal, short (quotaExceeded, keyInvalid, accessNotConfigured, ...)
const yterr = async r => { try { const e = (await r.json()).error; return `youtube ${r.status}: ${(e?.errors?.[0]?.reason || e?.status || e?.message || '').toString().slice(0, 80)}`; } catch { return 'youtube ' + r.status; } };
const chatIds = new Map(), cache = new Map(), lastActive = new Map();

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url), v = u.searchParams.get('v') || '', p = u.searchParams.get('p') || '';
  if (!env.YT_API_KEY) return json({ ok: false, why: 'no key' }, 503);
  if (!/^[\w-]{11}$/.test(v) || p.length > 400) return json({ ok: false, why: 'bad request' }, 400);
  const ck = v + '|' + p, hit = cache.get(ck); if (hit && Date.now() - hit.t < 4000) return json(hit.body);
  const key = encodeURIComponent(env.YT_API_KEY);
  let id = chatIds.get(v);
  if (!id) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${v}&key=${key}`);
    if (!r.ok) return json({ ok: false, why: await yterr(r), wait: 60000 }, 502);
    id = (await r.json()).items?.[0]?.liveStreamingDetails?.activeLiveChatId;
    if (!id) return json({ ok: false, why: 'no live chat on that video id (is chat on, is the stream live?)', wait: 30000 }, 404);
    chatIds.set(v, id);
  }
  let r = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${encodeURIComponent(id)}&part=snippet,authorDetails&maxResults=200${p ? '&pageToken=' + encodeURIComponent(p) : ''}&key=${key}`);
  if (!r.ok && p) {
    r = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${encodeURIComponent(id)}&part=snippet,authorDetails&maxResults=200&key=${key}`);
  }
  if (!r.ok) { if (r.status === 403 || r.status === 404) chatIds.delete(v); return json({ ok: false, why: await yterr(r), wait: r.status === 403 ? 300000 : 30000 }, 502); }
  const d = await r.json();
  const messages = (d.items || []).filter(m => m.snippet?.type === 'textMessageEvent').map(m => ({ user: m.authorDetails?.channelId || '', name: m.authorDetails?.displayName || '', text: String(m.snippet?.textMessageDetails?.messageText || '').slice(0, 200), t: Date.parse(m.snippet?.publishedAt) || Date.now() }));
  if (messages.length) lastActive.set(v, Date.now());
  const busy = Date.now() - (lastActive.get(v) || 0) < 120000;
  const body = { ok: true, messages, next: d.nextPageToken || p, wait: Math.max(d.pollingIntervalMillis || 0, busy ? 6000 : 20000) };
  cache.set(ck, { t: Date.now(), body }); if (cache.size > 50) cache.delete(cache.keys().next().value);
  return json(body);
}
