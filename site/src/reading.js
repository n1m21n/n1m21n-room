// Bookshelf: pick a book from its cover -> he pulls it off the shelf, turns round and reads it (acts.js `read`).
// The book is a small prop on his root: hidden on the shelf, closed in the right hand, then open between both hands.
import * as THREE from 'three';
import { mesh } from './look.js';
import { PAL } from './textures.js';
import { palmFrame, BOOK } from './acts.js';

const HW = 0.15, HH = 0.22;                                       // one half of the open book

function untitled(w = 320, h = 480) {                              // the one he hasn't written yet
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#F1E9D2'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#140B52'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = '#140B52'; g.textAlign = 'center';
  g.font = "800 46px 'Bricolage Grotesque', sans-serif"; g.fillText('untitled', w / 2, h * 0.45);
  g.font = "400 22px 'DM Mono', monospace"; g.fillText('naman · soon', w / 2, h * 0.45 + 44);
  return c;
}

export async function makeReading({ man, player, card, closeCard, toast }) {
  const books = (await (await fetch('/data/books.json')).json()).books;

  // prop: two hinged halves; covers face out (+z), pages face him
  const book = new THREE.Group(); book.visible = false;
  const halves = [1, -1].map(s => {
    const h = new THREE.Group();
    const board = mesh(new THREE.BoxGeometry(HW, HH, 0.012), '#2B1B5C', { ink: 0.004 }); board.position.x = s * HW / 2; h.add(board);
    const page = mesh(new THREE.PlaneGeometry(HW - 0.012, HH - 0.012), PAL.cream, { ink: false });
    page.position.set(s * HW / 2, 0, -0.0065); page.rotation.y = Math.PI; h.add(page);
    book.add(h); return h;
  });
  const coverMat = mesh(new THREE.PlaneGeometry(HW - 0.004, HH - 0.004), '#ffffff', { ink: false, unlit: true, map: new THREE.Texture() });
  coverMat.position.set(HW / 2, 0, 0.0065); halves[0].add(coverMat);               // front cover: his left hand, facing out
  man.root.add(book);

  const tl = new THREE.TextureLoader();
  function setCover(b) {
    const u = coverMat.material.uniforms;
    const done = tx => { tx.colorSpace = THREE.SRGBColorSpace; u.uMap.value?.dispose(); u.uMap.value = tx; u.uHasMap.value = 1; };
    if (b.cover) tl.load('/' + b.cover, done); else done(new THREE.CanvasTexture(untitled()));
  }

  const READ = { x: -3.2, z: 1.25, heading: -Math.PI / 2, act: 'read', out: [-2.85, 1.25], book: null,
    leave: () => { book.visible = false; } };

  const hw = new THREE.Vector3(), m4 = new THREE.Matrix4();
  function update() {                                                // after player.update: place the prop from the act's phase
    const sp = player.st.seated === READ ? player.st.spec : null;
    if (!sp || sp.book === 'shelf') { book.visible = false; return; }
    book.visible = true;
    if (sp.book === 'hand') {                                        // closed, in the right hand, spine down
      const { pos, F, N, PALM_T } = palmFrame(man, 'handR');        // closed, its back cover flat against the palm
      book.position.copy(pos).addScaledVector(N, PALM_T + 0.013);
      book.quaternion.setFromRotationMatrix(m4.makeBasis(hw.crossVectors(F, N), F, N));
      book.position.addScaledVector(hw.normalize(), -HW / 2);          // the spine is the group origin
      halves[0].rotation.y = 0; halves[1].rotation.y = Math.PI;
    } else {                                                         // open between both hands, tilted toward his face
      book.position.set(...BOOK.pos); book.rotation.set(BOOK.tilt, 0, 0);
      halves[0].rotation.y = BOOK.open; halves[1].rotation.y = -BOOK.open;
    }
  }

  function read(i = Math.floor(Math.random() * books.length)) { const b = books[i]; READ.book = b; setCover(b); player.sit(READ); return b; }
  function pick(i) {
    closeCard(); const b = read(i);
    toast(`reading · ${b.title} — ${b.author}`, 5000);
  }
  function open() {
    if (player.st.seated === READ) return player.stand();
    card(`<div class="crate shelfui"><div class="chead"><p class="cap">the shelf</p><p class="meta">${books.length} books · pick one to read</p></div>
      <div class="grid">${books.map((b, i) => `<button class="bk" data-i="${i}" title="${b.title} — ${b.author}">
        ${b.cover ? `<img src="/${b.cover}" alt="" loading="lazy">` : `<span class="un">untitled<br><small>soon</small></span>`}
        <b>${b.title}</b><i>${b.author}</i></button>`).join('')}</div></div>`);
    document.querySelectorAll('#card .bk').forEach(el => { el.onclick = () => pick(+el.dataset.i); });
  }
  return { READ, open, read, update };
}
