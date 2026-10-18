// Client of the chat-errand log (functions/api/chatq.js): polls for new events and hands each to the playback with its start time on
// this computer's clock (the server's `now` is used to cancel clock differences). `announce(ev)` is for the stream page, the only one
// that holds the key. Offline or no API: poll does nothing, and announce plays the event locally so a test feed still works.
const URL_ = '/api/chatq';
export function makeFeed({ onEvent, key = '' }) {
  let after = 0, ok = false, off = 0, first = true;
  const local = performance.now.bind(performance);
  const at = ev => local() + (ev.t0 - (Date.now() + off));
  async function poll() {
    try {
      const r = await fetch(`${URL_}?after=${after}`, { cache: 'no-store' }); if (!r.ok) return;
      const d = await r.json(); ok = true; off = d.now - Date.now();
      for (const ev of d.events || []) { after = Math.max(after, ev.seq); if (!first || ev.t0 > d.now - 4000) onEvent(ev, at(ev)); }     // what finished before this page opened is history
      first = false;
    } catch {}
  }
  poll(); setInterval(poll, 3000);
  let seqLocal = -1, lastEnd = 0;
  return {
    get online() { return ok; },
    async announce(ev) {                                           // -> the event as scheduled (t0 set)
      if (key && ok) {
        try {
          const r = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json', 'x-stream-key': key }, body: JSON.stringify(ev) });
          if (r.ok) { const d = await r.json(); if (d.ok) { after = Math.max(after, d.event.seq); onEvent(d.event, at(d.event)); return d.event; } }
        } catch {}
      }
      const t0 = Math.max(Date.now() + 5000, lastEnd + 4000); lastEnd = t0 + (ev.secs || 30) * 1000;      // no server: schedule it here
      const e = { ...ev, seq: seqLocal--, t0 }; onEvent(e, at({ t0 })); return e;
    },
  };
}
