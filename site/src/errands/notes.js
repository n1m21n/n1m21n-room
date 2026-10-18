// The paper notes on his desk (core: both sites show them). Each is a small paper plane with the viewer's name and command written on it. A note
// drops onto the desk pile when it arrives, and when he reads it it lifts to his hand, then is tucked away.
import * as THREE from 'three';

const W = 0.17, H = 0.115;
const SLOTS = [[-0.7, 0.1], [-0.62, 0.17], [-0.74, 0.19], [-0.6, 0.06], [-0.68, 0.24], [-0.56, 0.2]];     // desk-local x, z on its left end (clear of the keyboard and mouse)

function face(note) {
  const c = document.createElement('canvas'); c.width = 340; c.height = 230;
  const g = c.getContext('2d');
  g.fillStyle = note.self ? '#FFF3B8' : '#FFFDF2'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#E8263F'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 46); g.lineTo(c.width, 46); g.stroke();
  g.fillStyle = '#140B52'; g.textBaseline = 'middle';
  g.font = '700 34px "DM Mono", monospace'; g.fillText(note.name.slice(0, 11), 18, 24);
  g.font = '700 64px "DM Mono", monospace';
  const label = note.cmd === 'ask' || !note.cmd ? '?' : '!' + note.cmd;
  g.fillText(label.slice(0, 8), 18, 126, c.width - 36);
  g.font = '500 24px "DM Mono", monospace'; g.fillStyle = '#6B6290';
  g.fillText(note.self ? 'note to self' : note.cmd === 'ask' ? 'a question' : note.cmd === 'play' && note.arg ? note.arg.slice(0, 18) : 'from chat', 18, 196);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function makeNotes({ scene, desk, man }) {
  const live = [];                                                 // { note, mesh, slot, t, state: drop | rest | lift | held | tuck }
  const deskTop = new THREE.Vector3(), tmp = new THREE.Vector3();
  const slotPos = (s, out) => desk.localToWorld(out.set(SLOTS[s % SLOTS.length][0], 0.724, SLOTS[s % SLOTS.length][1]));
  const free = () => { const used = new Set(live.map(l => l.slot)); let s = 0; while (used.has(s)) s++; return s; };

  function add(note) {
    const tex = face(note), mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    const slot = free(), l = { note, mesh, slot, t: 0, state: 'drop', spin: (Math.random() - 0.5) * 0.9 };
    slotPos(slot, tmp); mesh.position.copy(tmp).setY(tmp.y + 0.5); mesh.rotation.set(-Math.PI / 2, 0, l.spin);
    mesh.frustumCulled = false; scene.add(mesh); live.push(l); return l;
  }
  const has = note => live.some(l => l.note === note);
  const find = note => live.find(l => l.note === note);

  // lift the note to his hand; `hand()` gives the world point to hold it at
  function pickUp(note) { const l = find(note); if (l) { l.state = 'lift'; l.t = 0; l.from = l.mesh.position.clone(); } return !!l; }
  function tuck(note) { const l = find(note); if (l) { l.state = 'tuck'; l.t = 0; } }
  function bump(note) { const l = find(note); if (!l) return; l.pop = 1; }          // a vote added: the note jumps
  const hand = () => { const b = man.bones.handR || man.bones.forearmR; b.getWorldPosition(tmp); return tmp; };

  const ease = x => 1 - Math.pow(1 - x, 3);
  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const l = live[i], m = l.mesh; l.t += dt;
      if (l.state === 'drop') {                                    // flutters down onto the pile
        const k = Math.min(1, l.t / 0.7); slotPos(l.slot, tmp);
        m.position.set(tmp.x + Math.sin(l.t * 9) * 0.03 * (1 - k), tmp.y + 0.5 * (1 - ease(k)), tmp.z);
        m.rotation.set(-Math.PI / 2 + Math.sin(l.t * 7) * 0.5 * (1 - k), 0, l.spin);
        if (k >= 1) l.state = 'rest';
      } else if (l.state === 'rest') {
        slotPos(l.slot, tmp); m.position.lerp(tmp, 1 - Math.exp(-10 * dt));
        if (l.pop) { l.pop = Math.max(0, l.pop - dt * 3); m.position.y += Math.sin(l.pop * Math.PI) * 0.06; }
      } else if (l.state === 'lift') {
        const k = Math.min(1, l.t / 0.55); hand(); tmp.y += 0.12;
        m.position.lerpVectors(l.from, tmp, ease(k)); m.rotation.set(-Math.PI / 2 * (1 - ease(k)) - 0.3 * ease(k), man.root.rotation.y + Math.PI, l.spin * (1 - k));
        if (k >= 1) l.state = 'held';
      } else if (l.state === 'held') {
        hand(); m.position.copy(tmp).setY(tmp.y + 0.12); m.rotation.set(-0.3, man.root.rotation.y + Math.PI, Math.sin(l.t * 2) * 0.04);
      } else if (l.state === 'tuck') {
        const k = Math.min(1, l.t / 0.35); m.scale.setScalar(1 - ease(k)); m.rotation.z += dt * 8;
        if (k >= 1) { scene.remove(m); m.geometry.dispose(); m.material.map.dispose(); m.material.dispose(); live.splice(i, 1); }
      }
    }
  }
  return { add, has, pickUp, tuck, bump, update, get count() { return live.filter(l => l.state === 'drop' || l.state === 'rest').length; } };
}
