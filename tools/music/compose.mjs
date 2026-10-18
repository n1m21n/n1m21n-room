// Original piano + guitar pieces whose emotion is *designed*, not guessed: each piece is built from a (valence, arousal) target through
// the usual levers of music psychology (mode/scale, harmony, tempo, velocity, register, rhythmic density, rests).
//   node tools/music/compose.mjs [pianoCount=96] [guitarCount=48]   -> site/public/media/midi/gen-*.mid + guitar-gen-*.mid
//   and tools/music/generated_targets.json (read by midi_profile.mjs so the designed target is the truth for the sim)
// Own work, so nothing to credit or clear. Seeded: same command, same files.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), DIR = join(ROOT, 'site/public/media/midi');
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
let s = 20261017; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296), pick = a => a[Math.floor(rnd() * a.length)], chance = p => rnd() < p;

// scales as semitone steps; ordered dark -> bright
const MODES = { locrian: [0, 1, 3, 5, 6, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11] };
const modeFor = v => v < 0.12 ? 'locrian' : v < 0.28 ? 'phrygian' : v < 0.42 ? 'aeolian' : v < 0.55 ? 'dorian' : v < 0.68 ? 'mixolydian' : v < 0.85 ? 'ionian' : 'lydian';
// chord-degree loops (0-based scale degrees): sad = falling/minor-centred, bright = I-V-vi-IV style, tense = pedal/chromatic-feeling, awe = open IV-I
const LOOPS = { low: [[0, 5, 3, 4], [0, 3, 0, 4], [0, 6, 5, 4], [0, 0, 5, 5]], mid: [[0, 3, 4, 3], [0, 5, 3, 4], [0, 2, 3, 4], [0, 4, 5, 3]], high: [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [3, 0, 4, 5]] };

function vlq(n) { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; }
function writeMidi(path, notes, bpm, program) {
  const PPQ = 480, ev = [];
  for (const n of notes) { ev.push([Math.round(n.t * PPQ), 1, n.n, n.v]); ev.push([Math.round((n.t + n.d) * PPQ), 0, n.n, 0]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const tr = [0, 0xff, 0x51, 3, ...[(60e6 / bpm >> 16) & 255, (60e6 / bpm >> 8) & 255, (60e6 / bpm) & 255], 0, 0xc0, program];
  let last = 0; for (const [t, on, n, v] of ev) { tr.push(...vlq(t - last), on ? 0x90 : 0x80, n, on ? v : 0); last = t; }
  tr.push(0, 0xff, 0x2f, 0);
  const h = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, PPQ >> 8, PPQ & 255]), len = tr.length;
  writeFileSync(path, Buffer.concat([h, Buffer.from([0x4d, 0x54, 0x72, 0x6b, len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255]), Buffer.from(tr)]));
}

function compose(kind, v, a, name) {
  const mode = MODES[modeFor(v)], root = pick([0, 2, 3, 5, 7, 9, 10]) + (kind === 'guitar' ? 40 : 36), bpm = Math.round(54 + a * 96 + (rnd() - 0.5) * 8);
  const vel = Math.round(38 + a * 62), loop = pick(v < 0.35 ? LOOPS.low : v < 0.65 ? LOOPS.mid : LOOPS.high);
  const reg = kind === 'guitar' ? 12 : 12 + Math.round(v * 8);           // melody sits higher when happier
  const deg = (d, oct = 0) => root + Math.floor(d / 7) * 12 + mode[((d % 7) + 7) % 7] + oct * 12;
  const bars = 16, notes = [], beatsPerBar = 4;
  const density = 0.25 + a * 0.75, ext = chance(0.25 + (1 - a) * 0.3) ? 1 : 0;                    // calm, wistful pieces colour chords with 7ths/9ths
  let mel = 7 + Math.round(v * 3), t = 0;
  for (let bar = 0; bar < bars; bar++) {
    const d = loop[bar % 4], chord = [d, d + 2, d + 4, ...(ext ? [d + 6] : [])], bt = bar * beatsPerBar, sus = chance(0.15 * (1 - a));
    if (kind === 'piano') {
      notes.push({ n: deg(d, 0), t: bt, d: beatsPerBar - 0.1, v: clamp(vel - 8, 20, 120) });                                                         // bass
      if (a > 0.55) notes.push({ n: deg(d, 0) + 12, t: bt + 2, d: 1.9, v: vel - 14 });
      const step = a < 0.3 ? 2 : a < 0.65 ? 1 : 0.5;
      for (let b = 0; b < beatsPerBar; b += step) if (b === 0 || chance(0.35 + a * 0.6)) chord.forEach((c, i) => { if (a < 0.45 ? b === 0 : i === (b / step) % chord.length) notes.push({ n: deg(c, 1), t: bt + b, d: a < 0.45 ? beatsPerBar - 0.2 : step * 1.6, v: clamp(vel - 16 + i * 3, 20, 110) }); });
      let b = 0;                                                                                                                                  // melody: contour wanders, pulled toward chord tones, leaps rarer when calm
      while (b < beatsPerBar) {
        const dur = pick(a < 0.3 ? [2, 2, 1] : a < 0.65 ? [1, 1, 0.5, 2] : [0.5, 0.5, 1, 0.25]);
        if (chance(0.82 - a * 0.1) || b === 0) { const tgt = chord[Math.floor(rnd() * chord.length)] + 7; mel = clamp(mel + (rnd() < 0.5 ? -1 : 1) * (chance(0.15 + a * 0.2) ? 2 : 1) + Math.sign(tgt - mel) * (chance(0.4) ? 1 : 0), 4, reg > 16 ? 15 : 13); notes.push({ n: deg(mel, 1) + (reg > 16 ? 12 : 0), t: bt + b, d: dur * 0.95, v: clamp(vel + Math.round((rnd() - 0.5) * 14) + (b === 0 ? 6 : 0), 25, 120) }); }
        b += dur;
      }
      if (sus && v > 0.4) notes.push({ n: deg(d + 4, 2), t: bt, d: beatsPerBar, v: vel - 20 });                                                  // awe-ish held top note
    } else {
      const patt = a < 0.35 ? [0, 2, 1, 2, 0.5, 2, 1, 2] : [0, 2, 1, 3, 2, 3, 1, 2];                                                                // p-i-m-a fingerstyle over the chord
      const sub = a < 0.35 ? 0.5 : a < 0.7 ? 0.5 : 0.25, per = Math.round(beatsPerBar / sub);
      const gch = [deg(d, 0), deg(d + 4, 0), deg(d + 7, 0), deg(d + 9, 0) + 0, deg(d + 11, 0), deg(d + 14, 0)].map(n => clamp(n, 40, 76));
      for (let i = 0; i < per; i++) { if (i > 0 && !chance(0.5 + density * 0.5)) continue; const k = [0, 1, 2, 3, 2, 4, 3, 5][i % 8] % gch.length; notes.push({ n: gch[k], t: bt + i * sub, d: sub * (i % 4 === 0 ? 3 : 1.6), v: clamp(vel + (i % 4 === 0 ? 8 : -4) + Math.round((rnd() - 0.5) * 8), 25, 118) }); }
      if (chance(0.4 + a * 0.3)) { mel = clamp(mel + (rnd() < 0.5 ? -1 : 1), 5, 12); notes.push({ n: clamp(deg(mel, 1), 55, 84), t: bt + pick([1, 2, 3]), d: 1.5, v: clamp(vel + 10, 30, 120) }); }
    }
  }
  // close on the tonic
  notes.push({ n: deg(0, 0), t: bars * beatsPerBar, d: 6, v: vel - 6 }, { n: deg(4, 1), t: bars * beatsPerBar, d: 6, v: vel - 14 });
  const beatSec = 60 / bpm; for (const n of notes) { /* durations are in beats; the file's tempo does the rest */ }
  writeMidi(join(DIR, name + '.mid'), notes, bpm, kind === 'guitar' ? 24 : 0);
  return { valence: +v.toFixed(2), arousal: +a.toFixed(2), energy: +clamp(0.15 + a * 0.55 + vel / 400).toFixed(2), mode: modeFor(v), bpm, seconds: Math.round((bars * beatsPerBar + 6) * beatSec) };
}

const NP = +process.argv[2] || 96, NG = +process.argv[3] || 48, out = {};
const grid = (n, i) => { const g = Math.ceil(Math.sqrt(n)), r = Math.floor(i / g), c = i % g; return [clamp((c + 0.5 + (rnd() - 0.5) * 0.8) / g, 0.04, 0.96), clamp((r + 0.5 + (rnd() - 0.5) * 0.8) / g, 0.04, 0.96)]; };
for (let i = 0; i < NP; i++) { const [v, a] = grid(NP, i), id = `gen-${String(i + 1).padStart(3, '0')}`; out[id] = compose('piano', v, a, id); }
for (let i = 0; i < NG; i++) { const [v, a] = grid(NG, i), id = `guitar-gen-${String(i + 1).padStart(3, '0')}`; out[id] = compose('guitar', v, a, id); }
writeFileSync(join(ROOT, 'tools/music/generated_targets.json'), JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'pieces');
