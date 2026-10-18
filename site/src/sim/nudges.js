// Client side of the shared life's visit log (functions/api/nudge.js). Keeps the full log in memory, polls for new entries and hands the
// list to the life (life.setEvents). It also holds this visitor's own play: `play(act)` counts what they used, `end()` posts one summary
// when the visit is over. If the API is missing or offline it does nothing: the life then runs on its own, the same him with no visitors.
const URL_ = '/api/nudge';
const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function makeNudges({ onChange }) {
  let vid = get('n1m21n.vid'); if (!vid) { vid = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^a-z0-9-]/gi, '').slice(0, 36); put('n1m21n.vid', vid); }
  let events = [], counts = {}, visitors = 0, ok = false, mine = {}; try { mine = JSON.parse(get('n1m21n.mine') || '{}'); } catch {}
  let visit = null;                                                // { t0, acts } while this visitor is playing on their own
  async function poll() {
    for (let i = 0; i < 20; i++) { const n = events.length; if (!(await pollOnce()) || events.length - n < 1000) break; }       // the server pages 1000 at a time
  }
  async function pollOnce() {
    try {
      const r = await fetch(`${URL_}?after=${events.length ? events[events.length - 1].seq : 0}`, { cache: 'no-store' });
      if (!r.ok) return false; const d = await r.json(); ok = true;
      counts = d.counts || counts; visitors = d.visitors || 0;
      if (d.events?.length) { events = events.concat(d.events.filter(e => !events.some(x => x.seq === e.seq))); onChange(events); }
      return true;
    } catch { return false; }
  }
  const start = () => { if (!visit) visit = { t0: Date.now(), acts: {} }; };
  const play = act => { start(); visit.acts[act] = (visit.acts[act] || 0) + 1; };
  // post the summary (keepalive so it survives the tab closing); true when it was long enough to count
  function end() {
    const v = visit; visit = null; if (!v || !ok) return false;
    const secs = Math.round((Date.now() - v.t0) / 1000); if (secs < 20 || !Object.keys(v.acts).length) return false;
    try { fetch(URL_, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vid, secs, acts: v.acts }) }).then(r => r.json()).then(d => { if (d.ok) { for (const [a, n] of Object.entries(v.acts)) { mine[a] = (mine[a] || 0) + n; counts[a] = (counts[a] || 0) + n; } put('n1m21n.mine', JSON.stringify(mine)); poll(); } }).catch(() => {}); } catch {}
    return true;
  }
  poll(); setInterval(poll, 8000);
  return { play, end, start, get playing() { return !!visit; }, get events() { return events; }, get counts() { return counts; }, get visitors() { return visitors; }, get mine() { return mine; }, get online() { return ok; } };
}
