// A tiny Standard MIDI File reader: every note across all tracks as { t, d, n, v } in seconds (tempo map applied),
// sorted by start. Enough for the keys station to play real pieces (public/media/midi/*.mid). Pedal (CC64) holds notes.
export function parseMidi(buf) {
  const b = new DataView(buf); let p = 0;
  const u32 = () => { const v = b.getUint32(p); p += 4; return v; }, u16 = () => { const v = b.getUint16(p); p += 2; return v; };
  const vlq = () => { let v = 0, c; do { c = b.getUint8(p++); v = (v << 7) | (c & 127); } while (c & 128); return v; };
  if (u32() !== 0x4d546864) throw new Error('not a midi file');
  const hl = u32(), fmt = u16(), ntr = u16(), div = u16(); p = 8 + hl;
  if (div & 0x8000) throw new Error('smpte timing not supported');
  const ev = [];                                                   // [tick, kind, a, b, track]
  for (let k = 0; k < ntr && p < b.byteLength; k++) {
    const id = u32(), len = u32(), end = p + len;
    if (id !== 0x4d54726b) { p = end; continue; }
    let tick = 0, run = 0;
    while (p < end) {
      tick += vlq();
      let st = b.getUint8(p);
      if (st & 128) p++; else st = run;                            // running status
      if (st === 0xff) { const ty = b.getUint8(p++), l = vlq(); if (ty === 0x51) ev.push([tick, 'tempo', (b.getUint8(p) << 16) | (b.getUint8(p + 1) << 8) | b.getUint8(p + 2)]); p += l; continue; }
      if (st === 0xf0 || st === 0xf7) { p += vlq(); continue; }
      run = st; const hi = st & 0xf0, ch = st & 15;
      const a = b.getUint8(p++), c = hi === 0xc0 || hi === 0xd0 ? 0 : b.getUint8(p++);
      if (hi === 0x90 && c) ev.push([tick, 'on', a, c, ch]);
      else if (hi === 0x80 || hi === 0x90) ev.push([tick, 'off', a, 0, ch]);
      else if (hi === 0xb0 && a === 64) ev.push([tick, 'pedal', c >= 64, 0, ch]);
    }
    p = end;
  }
  ev.sort((x, y) => x[0] - y[0] || (x[1] === 'tempo' ? -1 : 0));
  let us = 500000, lt = 0, sec = 0, pedal = false;
  const open = new Map(), held = [], notes = [];
  const close = (o, t) => { o.d = Math.max(0.05, t - o.t); };
  for (const [tick, kind, a, c] of ev) {
    sec += (tick - lt) * us / div / 1e6; lt = tick;
    if (kind === 'tempo') us = a;
    else if (kind === 'on') {
      const was = open.get(a);
      if (was && sec - was.t < 0.01) { was.v = Math.max(was.v, c / 127); was.k = (was.k || 1) + 1; continue; }   // doubled on two tracks: one note, closed by the last off
      const o = { t: sec, d: 0, n: a, v: c / 127 }; notes.push(o); if (was) close(was, sec); open.set(a, o);
    }
    else if (kind === 'off') { const o = open.get(a); if (o && o.k > 1) o.k--; else if (o) { open.delete(a); delete o.k; if (pedal) held.push(o); else close(o, sec); } }
    else if (kind === 'pedal') { pedal = a; if (!pedal) { for (const o of held) close(o, sec); held.length = 0; } }
  }
  for (const o of [...open.values(), ...held]) close(o, sec);
  notes.sort((x, y) => x.t - y.t);
  return { notes, length: notes.length ? Math.max(...notes.map(o => o.t + o.d)) : 0, format: fmt };
}
