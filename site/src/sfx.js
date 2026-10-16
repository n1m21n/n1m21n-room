// Sound: everything is synthesised with Web Audio (no files to fetch). A vinyl crackle runs under the room whenever no
// record is playing; footsteps, bumps, chairs, typing, keys, guitar, pages, doors, the portal, the remote, the snake and
// the HUD each get a small effect. main.js calls tick() every frame with what is going on and fx(name) for one-offs.
const KEY = 'n1m21n-sound';

export function makeSfx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, out = null, amb = null, white = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* private mode */ }

  // ---------- setup (browsers only allow audio after a gesture: the first tap / key / the enter button)
  function init() {
    if (ctx || !AC) return;
    ctx = new AC();
    out = ctx.createGain(); out.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    out.connect(comp); comp.connect(ctx.destination);
    white = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const w = white.getChannelData(0); for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    amb = crackle();
  }
  const wake = () => { init(); if (ctx?.state === 'suspended' && !document.hidden) ctx.resume(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) addEventListener(ev, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });

  // ---------- building blocks
  const now = () => ctx.currentTime;
  function env(g, t, peak, a, d) {                                   // attack to peak, exponential fall
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // filtered noise burst: f / f2 = filter sweep, type = biquad type
  function hiss({ t = now(), f = 1000, f2 = f, q = 0.8, type = 'bandpass', gain = 0.1, a = 0.004, d = 0.1, to = out } = {}) {
    const s = ctx.createBufferSource(); s.buffer = white;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t); if (f2 !== f) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const g = ctx.createGain(); env(g, t, gain, a, d);
    s.connect(fl).connect(g).connect(to);
    s.start(t, Math.random() * 1.5, a + d + 0.05);
  }
  function tone({ t = now(), f = 440, f2 = f, type = 'sine', gain = 0.1, a = 0.003, d = 0.2, to = out, lp = 0 } = {}) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t); if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const g = ctx.createGain(); env(g, t, gain, a, d);
    let n = o.connect(g);
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; n = n.connect(fl); }
    n.connect(to);
    o.start(t); o.stop(t + a + d + 0.05);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  // plucked string (Karplus-Strong), cached per pitch
  const plucks = new Map();
  function pluckBuf(f) {
    const k = Math.round(f * 10); if (plucks.has(k)) return plucks.get(k);
    const sr = ctx.sampleRate, n = Math.round(sr / f), len = Math.round(sr * 1.6);
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(n);
    for (let i = 0; i < n; i++) ring[i] = Math.random() * 2 - 1;
    for (let i = 0, j = 0; i < len; i++, j = (j + 1) % n) { const nx = (j + 1) % n; d[i] = ring[j]; ring[j] = 0.996 * 0.5 * (ring[j] + ring[nx]); }
    plucks.set(k, b); return b;
  }
  function pluck(f, t, gain) {
    const s = ctx.createBufferSource(); s.buffer = pluckBuf(f);
    const g = ctx.createGain(); g.gain.value = gain;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 3200;
    s.connect(fl).connect(g).connect(out); s.start(t);
  }
  // soft electric piano: sine + a quieter octave that dies first
  function epiano(f, t, gain) {
    tone({ t, f, gain, a: 0.005, d: 1.4 });
    tone({ t, f: f * 2, gain: gain * 0.35, a: 0.003, d: 0.35 });
    tone({ t, f: f * 3, type: 'triangle', gain: gain * 0.08, a: 0.002, d: 0.12 });
  }
  const hz = m => 440 * 2 ** ((m - 69) / 12);

  // ---------- the vinyl bed: hiss, dust pops and the once-per-turn tick of a worn groove (33⅓ rpm = 1.8 s)
  function crackle() {
    const sr = ctx.sampleRate, L = Math.round(sr * 1.8 * 4), b = ctx.createBuffer(2, L, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < L; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.08; d[i] = lp * 0.05; }
      const pop = (at, amp, len) => { for (let i = 0; i < len && at + i < L; i++) d[at + i] += amp * Math.exp(-i / (len / 5)) * (i % 2 ? -1 : 1) * (0.6 + Math.random() * 0.4); };
      for (let i = 0, n = 1.8 * 4 * 9; i < n; i++) pop(Math.floor(Math.random() * L), (Math.random() ** 3) * 0.55 * (Math.random() < 0.5 ? -1 : 1), Math.floor(rnd(8, 60)));
      for (let r = 0; r < 4; r++) pop(Math.floor((r * 1.8 + 0.6) * sr), 0.32, 120);
    }
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(hp).connect(lp).connect(g).connect(out); s.start();
    return g;
  }

  // ---------- one-shot effects
  const FX = {
    step({ run, hard }) {
      const t = now();
      hiss({ t, type: 'lowpass', f: (hard ? 1500 : 700) * rnd(0.85, 1.15) * (run ? 1.25 : 1), q: 0.6, gain: (run ? 0.3 : 0.18) * rnd(0.8, 1), a: 0.003, d: run ? 0.09 : 0.07 });
      tone({ t, f: rnd(85, 105), f2: 55, gain: run ? 0.16 : 0.09, d: 0.07 });
      if (hard) hiss({ t: t + 0.012, f: 4200, q: 3, gain: 0.03, d: 0.02 });
    },
    bump() {
      const t = now();
      tone({ t, f: 95, f2: 42, gain: 0.5, d: 0.22 });
      hiss({ t, type: 'lowpass', f: 420, gain: 0.35, d: 0.14 });
      tone({ t: t + 0.02, f: 330, f2: 170, type: 'triangle', gain: 0.07, d: 0.16 });     // the little toon "bonk"
    },
    rustle(gain = 0.08) { hiss({ f: 2600, f2: 1800, q: 0.9, gain, a: 0.04, d: 0.25 }); },
    creak(base = 150, gain = 0.05) {
      const t = now(), o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 0.82, t + 0.18); o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.4);
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = base * 6; fl.Q.value = 6;
      const g = ctx.createGain(); env(g, t, gain, 0.05, 0.38);
      o.connect(fl).connect(g).connect(out); o.start(t); o.stop(t + 0.5);
    },
    sit() { FX.rustle(); FX.creak(rnd(130, 170)); },
    stand() { FX.rustle(0.06); },
    bed() { const t = now(); hiss({ t, type: 'lowpass', f: 260, gain: 0.3, a: 0.01, d: 0.3 }); tone({ t: t + 0.05, f: 210, f2: 190, gain: 0.03, d: 0.4 }); FX.rustle(0.07); },
    key(space) { hiss({ f: space ? 1500 : rnd(3000, 4200), q: 2.5, gain: space ? 0.11 : rnd(0.05, 0.09), d: space ? 0.04 : 0.022 }); tone({ f: rnd(1600, 2100), type: 'square', gain: 0.008, d: 0.012 }); },
    page() { const t = now(); hiss({ t, f: 2600, f2: 6200, q: 1.2, gain: 0.09, a: 0.02, d: 0.16 }); hiss({ t: t + 0.12, f: 5000, f2: 2500, q: 1, gain: 0.05, d: 0.08 }); },
    book() { hiss({ type: 'lowpass', f: 600, gain: 0.18, d: 0.08 }); FX.page(); },
    click() { tone({ f: 2200, type: 'square', gain: 0.025, d: 0.012 }); hiss({ f: 5000, q: 4, gain: 0.04, d: 0.015 }); },
    static() { hiss({ f: 3800, q: 0.5, gain: 0.08, a: 0.005, d: 0.18 }); },
    lamp() { const t = now(); hiss({ t, f: 3000, q: 5, gain: 0.12, d: 0.015 }); hiss({ t: t + 0.05, f: 2200, q: 5, gain: 0.08, d: 0.015 }); },
    breath() { hiss({ type: 'lowpass', f: 380, f2: 600, q: 0.5, gain: 0.05, a: 1.3, d: 1.6 }); },
    needle() { const t = now(); hiss({ t, type: 'lowpass', f: 900, gain: 0.2, d: 0.05 }); for (let i = 1; i < 4; i++) hiss({ t: t + i * 0.09 + rnd(0, 0.03), f: 2500, q: 2, gain: 0.05, d: 0.01 }); },
    tick() { tone({ f: 1250, gain: 0.04, d: 0.03 }); },
    card() { hiss({ f: 2200, f2: 3600, q: 1, gain: 0.06, a: 0.01, d: 0.09 }); },
    crate() { const t = now(); hiss({ t, f: 900, f2: 1600, q: 1.2, gain: 0.12, a: 0.06, d: 0.25 }); tone({ t: t + 0.25, f: 120, f2: 70, gain: 0.08, d: 0.1 }); },
    hiss() {                                                                               // the snake, pleased
      const t = now(); hiss({ t, type: 'highpass', f: 4500, gain: 0.12, a: 0.05, d: 0.55 }); hiss({ t: t + 0.7, type: 'highpass', f: 5200, gain: 0.06, a: 0.04, d: 0.3 });
      tone({ t: t + 0.15, f: 520, f2: 880, type: 'triangle', gain: 0.03, d: 0.18 });
    },
    doorOpen() { FX.creak(rnd(95, 115), 0.07); hiss({ type: 'lowpass', f: 500, f2: 900, gain: 0.06, a: 0.15, d: 0.5 }); },
    doorShut() { tone({ f: 80, f2: 50, gain: 0.25, d: 0.18 }); hiss({ type: 'lowpass', f: 350, gain: 0.15, d: 0.1 }); },
    portal() {
      const t = now();
      hiss({ t, f: 250, f2: 3500, q: 2, gain: 0.16, a: 0.4, d: 0.5 });
      tone({ t, f: 180, f2: 900, type: 'triangle', gain: 0.06, a: 0.3, d: 0.6 });
      [0, 4, 7, 12].forEach((s, i) => tone({ t: t + 0.35 + i * 0.07, f: hz(76 + s), gain: 0.03, d: 0.5 }));
    },
    chirp() { const t = now(), f = rnd(3000, 4300); for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) tone({ t: t + i * 0.09, f, f2: f * rnd(1.15, 1.4), gain: 0.025, d: 0.06 }); },
    cricket() { const t = now(); for (let i = 0; i < 3; i++) tone({ t: t + i * 0.05, f: 4600, gain: 0.015, d: 0.03 }); },
  };

  const heard = [];                                                  // dev: the last effects played, by name
  for (const [k, f] of Object.entries(FX)) FX[k] = (...a) => { heard.push(k); if (heard.length > 60) heard.shift(); return f(...a); };

  // ---------- music made at the stations (keys and guitar follow the act's clock so hands and sound agree)
  const CHORDS = [[57, 60, 64], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62]];          // Am  Fmaj7  C  G
  const GUITAR = [[40, 47, 52, 55, 59, 64], [48, 52, 55, 60, 64], [43, 47, 50, 55, 59, 67], [50, 57, 62, 66]];   // Em C G D
  function strum(i, down) {
    heard.push('strum');
    const t = now(), notes = GUITAR[i % 4], ord = down ? notes : [...notes].reverse().slice(0, 4);
    ord.forEach((m, k) => pluck(hz(m), t + k * 0.014, down ? 0.16 : 0.09));
  }

  // ---------- per frame
  const seen = { seat: null, stepN: 0, bumps: 0, pressed: 0, portal: false, doors: new Map(), next: 0, chord: -1, strum: -1, flip: 0, opened: false, ambT: -1 };
  function tick(dt, s) {
    if (!ctx || ctx.state !== 'running') return;
    const t = now(), p = s.player, st = p.st, sp = st.seated;
    // vinyl bed under silence
    const want = muted || s.musicPlaying ? 0 : 0.22;
    if (s.musicPlaying && !seen.music && !muted) FX.needle();               // needle drops into the lead-in groove
    seen.music = s.musicPlaying;
    if (want !== seen.ambT) { seen.ambT = want; amb.gain.setTargetAtTime(want, t, want ? 0.8 : 0.25); }
    if (muted) return;

    // feet: one step per half walk cycle
    const n = Math.floor(st.phase / Math.PI);
    if (n !== seen.stepN) { if (!sp && st.speed > 0.3) FX.step({ run: st.speed > 2.6, hard: s.hard }); seen.stepN = n; }
    if (st.bumps !== seen.bumps) { seen.bumps = st.bumps; FX.bump(); }

    // sitting down / getting up, and what each station sounds like while he's at it
    if (sp !== seen.seat) {
      const was = seen.seat; seen.seat = sp; seen.next = t + 0.4; seen.chord = seen.strum = -1; seen.flip = 0; seen.opened = false;
      if (sp) {
        const a = sp.act;
        if (a === 'bed') FX.bed(); else if (['desk', 'stool', 'bench'].includes(a)) FX.sit();
        else if (a === 'guitar') { FX.rustle(); pluck(hz(40), t + 0.1, 0.05); }
        else if (a === 'tv') FX.click(); else if (a === 'pin') FX.rustle(0.05);
      } else if (was && was.act !== 'door') FX.stand();
    }
    if (sp) {
      const u = sp.t || 0;
      switch (sp.act) {
        case 'desk':                                               // typing in bursts, now and then a space
          if (t > seen.next && u > 0.5) { const sp_ = Math.random() < 0.12; FX.key(sp_); seen.next = t + (Math.random() < 0.08 ? rnd(0.5, 1.2) : rnd(0.07, 0.17)); }
          break;
        case 'keys': {                                             // acts.js changes chord 1.6 times a second
          const c = Math.floor(u * 1.6);
          if (c !== seen.chord && u > 0.3) { seen.chord = c; heard.push('piano'); const ch = CHORDS[Math.floor(c / 2) % 4]; ch.forEach((m, k) => epiano(hz(m), t + k * 0.01, 0.04)); if (c % 2) epiano(hz(ch[ch.length - 1] + 12 + [0, 2, -3][c % 3]), t + 0.2, 0.05); }
          break;
        }
        case 'guitar': {                                           // down-up strums, a chord every two beats
          const k = Math.floor(u * 2.6);
          if (k !== seen.strum && u > 0.5) { seen.strum = k; strum(Math.floor(k / 4), k % 2 === 0); }
          break;
        }
        case 'read': {                                             // acts.js: book in hand at u 0.9 (x0.6), a page every ~5 s
          const v = u * 0.6;
          if (!seen.opened && v > 0.95) { seen.opened = true; FX.book(); }
          const page = Math.max(0, Math.sin((v - 2) * 1.2)) ** 6, up = page > 0.5;
          if (up && !seen.flip) FX.page(); seen.flip = up;
          break;
        }
        case 'think':                                              // window: birds by day, crickets by night
          if (t > seen.next) { s.night ? FX.cricket() : FX.chirp(); seen.next = t + rnd(1.2, 3.5); }
          break;
        case 'bed':                                                // asleep: slow breaths in step with the chest (acts.js, 1.1 rad/s)
          if (t > seen.next && u > 1) { FX.breath(); seen.next = t + 2 * Math.PI / 1.1; }
          break;
        case 'pin':
          if (t > seen.next) { FX.rustle(0.025); seen.next = t + rnd(1.5, 3); }
          break;
      }
    }
    if (s.pressed && s.pressed !== seen.pressed) { seen.pressed = s.pressed; FX.click(); if (s.tvOn) setTimeout(() => FX.static(), 60); }
    if (s.portal && !seen.portal) FX.portal(); seen.portal = s.portal;
    for (const d of s.doors || []) {                               // creak as a door starts to swing, thud as it shuts
      const a = Math.abs(d.angle), prev = seen.doors.get(d) ?? a;
      if (prev < 0.02 && a >= 0.02) FX.doorOpen();
      if (prev >= 0.02 && a < 0.02) FX.doorShut();
      seen.doors.set(d, a);
    }
  }

  function fx(name, arg) { if (ctx && !muted && ctx.state === 'running') FX[name]?.(arg); }
  function setMuted(m) {
    muted = m; try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch { /* private mode */ }
    if (ctx) out.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.05);
  }
  return { tick, fx, setMuted, heard, get muted() { return muted; }, get state() { return ctx?.state; } };
}
