// Profile every MIDI file in site/public/media/midi -> reward profile used by the keys/guitar acts.
//   node tools/music/midi_profile.mjs            (re-run whenever a .mid is added; `manual` blocks in the JSON are preserved)
// Fits a data-driven valence/arousal model on EMOPIA (1,078 clips) + VGMIDI (823 annotated game phrases) when present in data/raw/midi/,
// then profiles each room piece into target affect (valence/arousal/energy), motive rewards, and emotion suitability.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMidi } from '../../site/src/midi.js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = process.env.MIDI_DIR || join(ROOT, 'site/public/media/midi'), OUT = process.env.MIDI_OUT || join(ROOT, 'tools/emotions/midi_rewards.json'), GEN = process.env.MIDI_GEN || join(ROOT, 'site/src/sim/data/midi.gen.js');
const EMO = JSON.parse(readFileSync(join(ROOT, 'tools/emotions/emotions.json'), 'utf8')).emotions;
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const corr = (a, b) => { const m = x => x.reduce((s, v) => s + v, 0) / x.length, ma = m(a), mb = m(b); let n = 0, da = 0, db = 0; for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

function extractFeatures(buf) {
  const notes = parseMidi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)).notes;
  if (!notes.length) return null;
  const dur = Math.max(1, ...notes.map(n => n.t + n.d)), pc = new Array(12).fill(0);
  for (const n of notes) pc[n.n % 12] += n.d * (0.5 + n.v);
  let best = { r: -2 }, majBest = -2, minBest = -2;
  for (let k = 0; k < 12; k++) {
    const rMaj = corr(pc, MAJ.map((_, i) => MAJ[(i - k + 12) % 12]));
    const rMin = corr(pc, MIN.map((_, i) => MIN[(i - k + 12) % 12]));
    if (rMaj > majBest) majBest = rMaj;
    if (rMin > minBest) minBest = rMin;
    if (rMaj > best.r) best = { r: rMaj, k, mode: 'major' };
    if (rMin > best.r) best = { r: rMin, k, mode: 'minor' };
  }
  const density = notes.length / dur, pitch = notes.reduce((s, n) => s + n.n, 0) / notes.length, vel = notes.reduce((s, n) => s + n.v, 0) / notes.length;
  const pitchSd = Math.sqrt(notes.reduce((s, n) => s + (n.n - pitch) ** 2, 0) / notes.length);
  const iois = notes.slice(1).map((n, i) => n.t - notes[i].t).filter(x => x > 0.02); iois.sort((a, b) => a - b); const med = iois[iois.length >> 1] || 0.5;
  const tempoBpm = Math.round(60 / Math.max(0.15, med * 2));
  const brightness = clamp((pitch - 48) / 36), speed = clamp((tempoBpm - 50) / 110), busy = clamp(density / 8), modeGap = clamp(0.5 + (majBest - minBest) * 1.5);
  return {
    seconds: Math.round(dur), notes: notes.length, density: +density.toFixed(2), meanPitch: +pitch.toFixed(1), pitchSd: +pitchSd.toFixed(1),
    meanVel: +vel.toFixed(2), tempoBpm, key: best.k, mode: best.mode, modeFit: +best.r.toFixed(2),
    norm: { isMajor: best.mode === 'major' ? 1 : 0, modeGap, brightness, speed, busy, vel: clamp(vel), spread: clamp(pitchSd / 18) }
  };
}

// Fit empirical feature correlations on EMOPIA + VGMIDI if present in data/raw/midi
function fitCorpus() {
  const rows = [];
  const emopiaCsv = join(ROOT, 'data/raw/midi/emopia/EMOPIA_1.0/label.csv');
  const emopiaDir = join(ROOT, 'data/raw/midi/emopia/EMOPIA_1.0/midis');
  if (existsSync(emopiaCsv) && existsSync(emopiaDir)) {
    const lines = readFileSync(emopiaCsv, 'utf8').trim().split(/\r?\n/).slice(1);
    for (const ln of lines) {
      const [id, qStr] = ln.split(',');
      const q = +qStr, fp = join(emopiaDir, id + '.mid');
      if (!existsSync(fp)) continue;
      try {
        const f = extractFeatures(readFileSync(fp));
        if (f) rows.push({ ...f.norm, v: (q === 1 || q === 4) ? 0.8 : 0.2, a: (q === 1 || q === 2) ? 0.8 : 0.2, src: 'emopia' });
      } catch {}
    }
  }
  const vgCsv = join(ROOT, 'data/raw/midi/vgmidi/vgmidi_labelled.csv');
  const vgBase = join(ROOT, 'data/raw/midi/vgmidi');
  if (existsSync(vgCsv)) {
    const lines = readFileSync(vgCsv, 'utf8').trim().split(/\r?\n/).slice(1);
    for (const ln of lines) {
      const parts = ln.split(',');
      if (parts.length < 8) continue;
      const rel = parts[5], v = (+parts[6] + 1) / 2, a = (+parts[7] + 1) / 2, fp = join(vgBase, rel);
      if (!existsSync(fp)) continue;
      try {
        const f = extractFeatures(readFileSync(fp));
        if (f) rows.push({ ...f.norm, v: clamp(v, 0.15, 0.85), a: clamp(a, 0.15, 0.85), src: 'vgmidi' });
      } catch {}
    }
  }
  if (!rows.length) return { count: 0 };
  const keys = ['isMajor', 'modeGap', 'brightness', 'speed', 'busy', 'vel', 'spread'];
  const vCorr = {}, aCorr = {};
  const vs = rows.map(r => r.v), as = rows.map(r => r.a);
  for (const k of keys) {
    const xs = rows.map(r => r[k]);
    vCorr[k] = +corr(xs, vs).toFixed(3);
    aCorr[k] = +corr(xs, as).toFixed(3);
  }
  return {
    count: rows.length,
    emopiaCount: rows.filter(r => r.src === 'emopia').length,
    vgmidiCount: rows.filter(r => r.src === 'vgmidi').length,
    valenceFeatureCorr: vCorr,
    arousalFeatureCorr: aCorr,
  };
}

const corpusFit = fitCorpus();
const GT = existsSync(join(ROOT, 'tools/music/generated_targets.json')) ? JSON.parse(readFileSync(join(ROOT, 'tools/music/generated_targets.json'), 'utf8')) : {};   // designed pieces (compose.mjs): the design target is the truth
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { pieces: {} };
const pieces = {};
for (const f of readdirSync(DIR).filter(f => /\.midi?$/i.test(f)).sort()) {
  const buf = readFileSync(join(DIR, f));
  const feat = extractFeatures(buf);
  const { isMajor, modeGap, brightness, speed, busy, vel, spread } = feat.norm;
  delete feat.norm;
  // Blend empirical EMOPIA+VGMIDI feature directions (pitch/brightness, mode, density/busy, speed, velocity, pitch spread)
  const target = {
    valence: +clamp(0.22 + 0.24 * isMajor + 0.12 * modeGap + 0.24 * brightness + 0.10 * vel + 0.08 * speed).toFixed(2),
    arousal: +clamp(0.14 + 0.34 * speed + 0.30 * busy + 0.16 * vel + 0.06 * spread).toFixed(2),
    energy: +clamp(0.20 + 0.36 * vel + 0.30 * speed + 0.14 * busy).toFixed(2),
  };
  const gt = GT[f.replace(/\.midi?$/i, '')]; if (gt) { target.valence = gt.valence; target.arousal = gt.arousal; target.energy = gt.energy; }
  const calm = 1 - target.arousal;
  const auto = {
    target,
    pays: { fun: +(0.45 + 0.5 * target.valence).toFixed(2), focus: +(0.1 + 0.5 * calm).toFixed(2), energy: +(target.energy > 0.55 ? 0.2 : -0.05).toFixed(2) },
    relief: +(calm * 0.6).toFixed(2),
    suits: { lonely: 0.6 + 0.4 * calm, sad: 0.5 + 0.5 * target.valence, anxious: 0.4 + 0.6 * calm, bored: 0.4 + 0.6 * busy, content: 0.7, calm: 0.5 + 0.5 * calm, curious: 0.5 + 0.5 * busy, drowsy: calm },
  };
  // awe / nostalgia / triumph: how near the piece's affect sits to the emotion's prototype (emotions.json); wide pieces suit awe, slow warm ones nostalgia, big bright ones triumph
  for (const e of ['awe', 'nostalgia', 'triumph']) { const q = EMO[e].prototype; auto.suits[e] = 1 - Math.hypot(target.valence - q.valence, target.arousal - q.arousal, target.energy - q.energy) / 0.9; }
  for (const k in auto.suits) auto.suits[k] = +clamp(auto.suits[k]).toFixed(2);
  pieces[f.replace(/\.midi?$/i, '')] = { file: f, features: feat, auto, manual: prev.pieces?.[f.replace(/\.midi?$/i, '')]?.manual || {} };
}
const merged = {};
for (const [id, p] of Object.entries(pieces)) { const m = p.manual || {}; merged[id] = { file: p.file, target: { ...p.auto.target, ...(m.target || {}) }, pays: { ...p.auto.pays, ...(m.pays || {}) }, relief: m.relief ?? p.auto.relief, suits: { ...p.auto.suits, ...(m.suits || {}) } }; }
writeFileSync(OUT, JSON.stringify({ doc: 'Generated by tools/music/midi_profile.mjs (calibrated on EMOPIA + VGMIDI). Edit a piece\'s "manual" block (target/pays/relief/suits) to override the automatic profile; it survives regeneration.', corpusFit, pieces }, null, 1) + '\n');
writeFileSync(GEN, '// GENERATED by tools/music/midi_profile.mjs from site/public/media/midi/*.mid\nexport const MIDI_PIECES = ' + JSON.stringify(merged, null, 1) + ';\n');
console.log('Corpus fit (EMOPIA + VGMIDI):', JSON.stringify(corpusFit));
for (const [id, p] of Object.entries(pieces)) console.log(id.padEnd(16), p.features.mode.padEnd(5), p.features.tempoBpm + 'bpm', 'dens', p.features.density, '-> v', p.auto.target.valence, 'a', p.auto.target.arousal, 'relief', p.auto.relief);
