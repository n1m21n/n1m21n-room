// Outfits: what the man wears, four slots (hat, upper, lower, shoes) picked at the wardrobe (main.js #fit panel).
// Upper swaps the tee's print / colour (+ collar), lower the jeans, shoes the boots + soles, hats are small toon meshes
// on the head bone sized to his hair. Each weekday has its own look (IST); a look picked by hand holds for the rest of
// that day (localStorage), then the next day's weekday look takes over.
import * as THREE from 'three';
import { mesh } from './look.js';
import * as T from './textures.js';

const PAL = T.PAL;
const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
const PRINTS = {
  liquid: () => T.teeTex(),
  breton: () => tex(256, 256, (g, w, h) => { g.fillStyle = PAL.white; g.fillRect(0, 0, w, h); g.fillStyle = '#1E1A6E'; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 13); }),
  flannel: () => tex(256, 256, (g, w, h) => {
    g.fillStyle = '#C8303F'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.55; g.fillStyle = '#1A1020'; for (let i = 0; i < w; i += 64) { g.fillRect(i, 0, 26, h); g.fillRect(0, i, w, 26); }
    g.globalAlpha = 0.5; g.fillStyle = PAL.spiral; for (let i = 40; i < w; i += 64) { g.fillRect(i, 0, 3, h); g.fillRect(0, i, w, 3); }
  }),
  spiral: () => tex(512, 512, (g, w, h) => {                         // cream tee, a riso spiral on the chest
    g.fillStyle = PAL.cream; g.fillRect(0, 0, w, h);
    g.strokeStyle = PAL.mag; g.lineWidth = 14; g.beginPath();
    for (let a = 0; a < Math.PI * 9; a += 0.08) { const r = 6 + a * 7.5, x = w * 0.5 + Math.cos(a) * r, y = h * 0.42 + Math.sin(a) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }),
};
const SOLID = c => ({ color: c });
const printCache = {};
export const printTex = id => (printCache[id] ||= PRINTS[id]());          // shared with the wardrobe's hanging tees

// the catalogue: [id, name, swatch (css), look]
export const SLOTS = {
  hat: [
    { id: 'none', name: 'no hat', sw: 'transparent' },
    { id: 'beanie-red', name: 'red beanie', sw: '#E8263F', hat: 'beanie', color: '#E8263F' },
    { id: 'beanie-mustard', name: 'mustard beanie', sw: '#E8B53A', hat: 'beanie', color: '#E8B53A' },
    { id: 'cap-teal', name: 'teal cap', sw: PAL.teal, hat: 'cap', color: PAL.teal },
    { id: 'cap-ink', name: 'black cap', sw: '#1A1438', hat: 'cap', color: '#1A1438' },
    { id: 'bucket-cream', name: 'cream bucket hat', sw: PAL.cream, hat: 'bucket', color: '#EFE6B8' },
  ],
  upper: [
    { id: 'liquid', name: 'liquid tee', sw: 'linear-gradient(160deg,#1E1A6E,#3B2BB0 35%,#E0368F 55%,#6A4BE0 80%)', print: 'liquid', collar: '#B8B5F0' },
    { id: 'breton', name: 'breton stripe', sw: 'repeating-linear-gradient(180deg,#FBF8E8 0 4px,#1E1A6E 4px 7px)', print: 'breton', collar: '#1E1A6E' },
    { id: 'flannel', name: 'red flannel', sw: 'repeating-linear-gradient(90deg,#C8303F 0 6px,#5A1020 6px 9px)', print: 'flannel', collar: '#5A1020' },
    { id: 'spiral', name: 'spiral tee', sw: 'radial-gradient(circle,#E0368F 0 3px,#F4EFA1 3px 6px,#E0368F 6px 8px,#F4EFA1 8px)', print: 'spiral', collar: '#E0368F' },
    { id: 'mustard', name: 'mustard tee', sw: '#E8B53A', ...SOLID('#E8B53A'), shadeCol: '#8A5A12', collar: '#B8862A' },
    { id: 'ink', name: 'black tee', sw: '#1A1438', ...SOLID('#221A44'), shadeCol: '#0B0820', collar: '#3B2BB0' },
    { id: 'teal', name: 'teal tee', sw: PAL.teal, ...SOLID(PAL.teal), shadeCol: '#1E5E66', collar: '#F4EFA1' },
  ],
  lower: [
    { id: 'indigo', name: 'indigo jeans', sw: '#3A49C9', color: '#3A49C9', shadeCol: '#232A8F' },
    { id: 'black', name: 'black jeans', sw: '#1E1A2E', color: '#25203A', shadeCol: '#0B0B14' },
    { id: 'olive', name: 'olive cargos', sw: '#5B6B2E', color: '#5B6B2E', shadeCol: '#2E3A14' },
    { id: 'cream', name: 'cream chinos', sw: '#E8DFC0', color: '#E8DFC0', shadeCol: '#9C8C66' },
    { id: 'red', name: 'red trousers', sw: '#C8303F', color: '#C8303F', shadeCol: '#6E1424' },
    { id: 'lav', name: 'lavender pants', sw: PAL.lav, color: PAL.lav, shadeCol: '#5A50B8' },
  ],
  shoes: [
    { id: 'boots', name: 'black boots', sw: 'linear-gradient(180deg,#141026 70%,#E8263F 70%)', boot: '#141026', bootSh: '#0B0B0B', sole: '#E8263F', soleSh: '#A3122E' },
    { id: 'white', name: 'white sneakers', sw: 'linear-gradient(180deg,#F4F1E6 70%,#C98B4E 70%)', boot: '#F4F1E6', bootSh: '#9C98B8', sole: '#C98B4E', soleSh: '#7A4E24' },
    { id: 'brown', name: 'brown boots', sw: 'linear-gradient(180deg,#6B3A22 70%,#2A1A12 70%)', boot: '#6B3A22', bootSh: '#3A1C10', sole: '#2A1A12', soleSh: '#120A06' },
    { id: 'lav', name: 'lavender sneakers', sw: 'linear-gradient(180deg,#B8B5F0 70%,#FBF8E8 70%)', boot: '#B8B5F0', bootSh: '#5A50B8', sole: '#FBF8E8', soleSh: '#A9A4C8' },
    { id: 'red', name: 'red high-tops', sw: 'linear-gradient(180deg,#E8263F 70%,#FBF8E8 70%)', boot: '#E8263F', bootSh: '#7E1426', sole: '#FBF8E8', soleSh: '#A9A4C8' },
  ],
};
export const SLOT_NAMES = { hat: 'hat', upper: 'upper', lower: 'lower', shoes: 'shoes' };

// a look for each day of the week (0 = Sunday): Sunday is the signature look from the film. No hats: he only wears
// one when a visitor puts it on him at the wardrobe
export const WEEK = [
  { hat: 'none', upper: 'liquid', lower: 'indigo', shoes: 'boots' },
  { hat: 'none', upper: 'ink', lower: 'black', shoes: 'boots' },
  { hat: 'none', upper: 'breton', lower: 'cream', shoes: 'white' },
  { hat: 'none', upper: 'spiral', lower: 'indigo', shoes: 'red' },
  { hat: 'none', upper: 'flannel', lower: 'black', shoes: 'brown' },
  { hat: 'none', upper: 'mustard', lower: 'olive', shoes: 'white' },
  { hat: 'none', upper: 'teal', lower: 'lav', shoes: 'lav' },
];
export const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const KEY = 'n1m21n-fit';
const item = (slot, id) => SLOTS[slot].find(o => o.id === id) || SLOTS[slot][0];

// hats, in head-bone space (bone at the chin line, +y up, +z his front); sized to his hair: crown centre / radii
function makeHat(kind, color, fit) {
  const g = new THREE.Group(); g.name = 'hat';
  const { c, r } = fit, o = { ink: 0.01, mat: 'fabric' };
  if (kind === 'beanie') {
    const crown = mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), color, o);
    crown.scale.copy(r); crown.position.copy(c); g.add(crown);
    const cuff = mesh(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true), color, { ...o, mat: 'fabric', matScale: 3 });
    cuff.material.side = THREE.DoubleSide;
    cuff.scale.set(r.x * 1.04, 0.06, r.z * 1.04); cuff.position.set(c.x, c.y + 0.03, c.z); g.add(cuff);
    const pom = mesh(new THREE.SphereGeometry(0.045, 12, 8), color, o); pom.position.set(c.x, c.y + r.y + 0.03, c.z); g.add(pom);
  } else if (kind === 'cap') {
    const crown = mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), color, o);
    crown.scale.copy(r); crown.position.copy(c); g.add(crown);
    const brim = mesh(new THREE.CylinderGeometry(1, 1, 0.012, 24, 1, false, -Math.PI / 2, Math.PI), color, o);
    brim.scale.set(r.x * 0.92, 1, r.z * 1.0); brim.position.set(c.x, c.y + 0.006, c.z + r.z * 0.55); brim.rotation.x = 0.12; g.add(brim);
    const btn = mesh(new THREE.SphereGeometry(0.014, 8, 6), color, { ink: 0.004 }); btn.position.set(c.x, c.y + r.y, c.z); g.add(btn);
  } else if (kind === 'bucket') {
    const crown = mesh(new THREE.CylinderGeometry(0.8, 1, 1, 24), color, o);
    crown.scale.set(r.x * 1.02, r.y * 0.86, r.z * 1.02); crown.position.set(c.x, c.y + r.y * 0.43, c.z); g.add(crown);
    const brim = mesh(new THREE.CylinderGeometry(1, 1.25, 1, 28, 1, true), color, o); brim.material.side = THREE.DoubleSide;
    brim.scale.set(r.x * 1.02, 0.08, r.z * 1.02); brim.position.set(c.x, c.y + 0.02, c.z); g.add(brim);
  }
  return g;
}

export function makeOutfits(man) {
  const mats = {};
  const byName = n => { const out = []; man.root.traverse(o => { if (o.isSkinnedMesh && o.userData.look === n) out.push(o.material); }); return out; };
  for (const k of ['tee', 'collar', 'pants', 'boot', 'sole', 'hair']) mats[k] = byName(k);

  // hat fit, measured once in the rest pose in head-bone space. The hair is a big poof, so a hat that swallowed it
  // would look like a helmet: instead the hat squashes the hair (as real ones do). Every hair vertex above the brow is
  // pulled inside a smaller crown (never into the skull) and the hat is sized to that crown.
  const hb = man.bones.head, inv = new THREE.Matrix4(), v = new THREE.Vector3();
  man.root.updateMatrixWorld(true); inv.copy(hb.matrixWorld).invert();
  const hairs = [], skull = new THREE.Box3(), box = new THREE.Box3();
  man.root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const look = o.userData.look ?? o.parent?.userData.look;                // ink hulls carry no look of their own
    if (look === 'face' || look === 'ear') { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) skull.expandByPoint(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).applyMatrix4(inv)); }
    if (look === 'hair' || look === 'hair_hi') {
      const toHead = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), pos = o.geometry.attributes.position;
      if (!hairs.some(h => h.pos === pos)) hairs.push({ pos, rest: pos.array.slice(), toHead, fromHead: toHead.clone().invert() });
      if (look === 'hair') for (let i = 0; i < pos.count; i++) box.expandByPoint(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).applyMatrix4(inv));
    }
  });
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const eq = Math.max(box.max.y - size.y * 0.5, 0.245);                      // hat band sits above the brow (eyes top out at ~0.225)
  const fit = { c: new THREE.Vector3(mid.x, eq, mid.z), r: new THREE.Vector3(
    Math.max(size.x / 2 * 0.9, (skull.max.x - skull.min.x) / 2 + 0.03),
    Math.max((box.max.y - eq) * 0.66, skull.max.y - eq + 0.035),
    Math.max(size.z / 2 * 0.92, (skull.max.z - skull.min.z) / 2 + 0.03)) };
  function squash(on) {                                                       // pull hair into the crown (or restore it)
    const c = fit.c, r = fit.r, q = new THREE.Vector3();
    for (const h of hairs) {
      const a = h.pos.array; a.set(h.rest);
      if (on) for (let i = 0; i < h.pos.count; i++) {
        q.fromArray(a, i * 3).applyMatrix4(h.toHead);
        const w = THREE.MathUtils.smoothstep(q.y, eq - 0.05, eq + 0.02); if (!w) continue;
        const dx = (q.x - c.x) / r.x, dy = Math.max(0, q.y - c.y) / r.y, dz = (q.z - c.z) / r.z, rho = Math.hypot(dx, dy, dz);
        if (rho <= 0.97) continue;
        const k = 1 + (0.97 / rho - 1) * w;
        q.set(c.x + (q.x - c.x) * k, q.y > c.y ? c.y + (q.y - c.y) * k : q.y, c.z + (q.z - c.z) * k).applyMatrix4(h.fromHead);
        q.toArray(a, i * 3);
      }
      h.pos.needsUpdate = true;
    }
  }
  const shine = []; man.root.traverse(o => { if (o.isSkinnedMesh && o.userData.look === 'hair_hi') shine.push(o); });   // drawn on top: hide under hats
  const prints = {};
  let hat = null;
  const set = (list, color, shadeCol) => { for (const m of list) { m.uniforms.uColor.value.set(color); if (shadeCol && m.uniforms.uShadeCol) m.uniforms.uShadeCol.value.set(shadeCol); } };
  const now = {};
  function apply(fit_) {
    const f = { ...now, ...fit_ };
    const up = item('upper', f.upper), lo = item('lower', f.lower), sh = item('shoes', f.shoes), ht = item('hat', f.hat);
    for (const m of mats.tee) {
      const u = m.uniforms;
      if (up.print) { u.uMap.value = printTex(up.print); u.uHasMap.value = 1; u.uColor.value.set('#ffffff'); if (u.uShadeCol) u.uShadeCol.value.set('#140B52'); }
      else { u.uHasMap.value = 0; u.uColor.value.set(up.color); if (u.uShadeCol) u.uShadeCol.value.set(up.shadeCol || '#140B52'); }
    }
    set(mats.collar, up.collar);
    set(mats.pants, lo.color, lo.shadeCol);
    set(mats.boot, sh.boot, sh.bootSh); set(mats.sole, sh.sole, sh.soleSh);
    if (hat) { hb.remove(hat); hat.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); hat = null; }
    if (ht.hat) { hat = makeHat(ht.hat, ht.color, fit); hb.add(hat); }
    for (const o of shine) o.userData.underHat = !!hat;
    squash(!!hat);
    Object.assign(now, { hat: ht.id, upper: up.id, lower: lo.id, shoes: sh.id });
    return now;
  }
  const today = () => { const d = istDate(); return { key: d.toISOString().slice(0, 10), day: d.getUTCDay() }; };
  const weekday = (day = today().day) => ({ ...WEEK[day] });
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ day: today().key, fit: now })); } catch { /* private mode */ } }
  function saved() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.day === today().key ? s.fit : null; } catch { return null; } }
  function random() { const pick = a => a[Math.floor(Math.random() * a.length)].id; return { hat: 'none', upper: pick(SLOTS.upper), lower: pick(SLOTS.lower), shoes: pick(SLOTS.shoes) }; }
  apply(saved() || weekday());
  return { apply, save, weekday, random, today, get now() { return { ...now }; }, get hat() { return hat; }, fit };
}

// IST (UTC+5:30) wall date, as a Date whose UTC fields read as IST
function istDate() { return new Date(Date.now() + 5.5 * 3600e3); }
