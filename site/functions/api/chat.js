// YouTube Live chat for the stream page (src/stream/bridge.js). The browser never sees the API key.
//   GET /api/chat?v=<videoId>[&p=<pageToken>] -> { messages: [{user, name, text, t}], next, wait }
// Needs a secret YT_API_KEY (Google Cloud: YouTube Data API v3 enabled). Quota: each chat read costs ~5 of the 10,000 daily units, so
// `wait` stretches to 45 s when chat is quiet and drops to 8 s while people are typing; the answer is cached 6 s per video per instance.
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const chatIds = new Map(), cache = new Map(), lastActive = new Map();

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url), v = u.searchParams.get('v') || '', p = u.searchParams.get('p') || '';
  if (!env.YT_API_KEY) return json({ ok: false, why: 'no key' }, 503);
  if (!/^[\w-]{11}$/.test(v) || p.length > 400) return json({ ok: false, why: 'bad request' }, 400);
  const ck = v + '|' + p, hit = cache.get(ck); if (hit && Date.now() - hit.t < 6000) return json(hit.body);
  const key = encodeURIComponent(env.YT_API_KEY);
  let id = chatIds.get(v);
  if (!id) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${v}&key=${key}`);
    if (!r.ok) return json({ ok: false, why: 'youtube ' + r.status }, 502);
    id = (await r.json()).items?.[0]?.liveStreamingDetails?.activeLiveChatId;
    if (!id) return json({ ok: false, why: 'no live chat on that video' }, 404);
    chatIds.set(v, id);
  }
  const r = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${encodeURIComponent(id)}&part=snippet,authorDetails&maxResults=200${p ? '&pageToken=' + encodeURIComponent(p) : ''}&key=${key}`);
  if (!r.ok) { if (r.status === 403 || r.status === 404) chatIds.delete(v); return json({ ok: false, why: 'youtube ' + r.status }, 502); }
  const d = await r.json();
  const messages = (d.items || []).filter(m => m.snippet?.type === 'textMessageEvent').map(m => ({ user: m.authorDetails?.channelId || '', name: m.authorDetails?.displayName || '', text: String(m.snippet?.textMessageDetails?.messageText || '').slice(0, 200), t: Date.parse(m.snippet?.publishedAt) || Date.now() }));
  if (messages.length) lastActive.set(v, Date.now());
  const busy = Date.now() - (lastActive.get(v) || 0) < 120000;
  const body = { ok: true, messages, next: d.nextPageToken || p, wait: Math.max(d.pollingIntervalMillis || 0, busy ? 8000 : 45000) };
  cache.set(ck, { t: Date.now(), body }); if (cache.size > 50) cache.delete(cache.keys().next().value);
  return json(body);
}
