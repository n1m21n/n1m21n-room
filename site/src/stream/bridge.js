// Where chat messages come from (stream only). `youtube` polls /api/chat (functions/api/chat.js, which holds the API key); `test` is a
// local feed of made-up viewers, so the whole system runs with no credentials: ?feed=test, or type chat('!tea', 'sam') in the console.
// Both call onMessage({ user, name, text }).
const NAMES = ['sam', 'priya', 'ravi', 'mika', 'noor', 'jules', 'arjun', 'lena', 'oz', 'tara'];
const SAYS = ['!tea', '!synth', '!guitar', '!art', '!read', '!tv', '!records', '!snake', '!window', '!work', '!cook', '!water', '!plant', '!call', '!stretch', '!roam', '!dress', 'what synth is that?', 'hello from chat', '!outfit', '!snack', '!tea', '!synth', '!art', '!loo'];

export function testFeed(onMessage, { every = 7000 } = {}) {
  const say = (text, name) => onMessage({ user: 'test:' + name, name, text });
  const k = setInterval(() => { const n = NAMES[Math.floor(Math.random() * NAMES.length)]; say(SAYS[Math.floor(Math.random() * SAYS.length)], n + Math.floor(Math.random() * 90)); }, every);
  return { stop: () => clearInterval(k), say };
}

export function youtubeFeed(videoId, onMessage, onStatus = () => {}) {
  let token = '', stopped = false, first = true, timer = 0;
  async function poll() {
    let wait = 15000;
    try {
      const r = await fetch(`/api/chat?v=${encodeURIComponent(videoId)}${token ? '&p=' + encodeURIComponent(token) : ''}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok !== false) {
        onStatus(true, 'chat connected'); token = d.next || token; wait = d.wait || wait;
        const cutoff = first ? Date.now() - 60000 : 0; first = false;       // the chat that was already there when the stream page opened is history
        for (const m of d.messages || []) if (!cutoff || m.t >= cutoff) onMessage({ user: 'yt:' + m.user, name: m.name, text: m.text });
      } else { wait = d.wait || 30000; onStatus(false, 'chat: ' + (d.why || 'error ' + r.status)); }
    } catch { wait = 30000; onStatus(false, 'chat: cannot reach the server'); }
    if (!stopped) timer = setTimeout(poll, wait);
  }
  poll();
  return { stop: () => { stopped = true; clearTimeout(timer); } };
}
