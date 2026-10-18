// Her own prop: a closed book in her right hand, open between both hands while she reads. reading.js's prop, with a plain cover.
import * as THREE from 'three';
import { mesh } from '../../look.js';
import { PAL } from '../../textures.js';
import { palmFrame, BOOK } from '../../acts.js';

// a closed book in her right hand, open between both hands: reading.js's prop, with a plain cover
export function herBook(man, player, READ) {
  const HW = 0.15, HH = 0.22, book = new THREE.Group(); book.visible = false;
  const halves = [1, -1].map(s => {
    const h = new THREE.Group();
    const board = mesh(new THREE.BoxGeometry(HW, HH, 0.012), '#7A1F3D', { ink: 0.004 }); board.position.x = s * HW / 2; h.add(board);
    const page = mesh(new THREE.PlaneGeometry(HW - 0.012, HH - 0.012), PAL.cream, { ink: false }); page.position.set(s * HW / 2, 0, -0.0065); page.rotation.y = Math.PI; h.add(page);
    book.add(h); return h;
  });
  man.root.add(book);
  const hw = new THREE.Vector3(), m4 = new THREE.Matrix4();
  READ.leave = () => { book.visible = false; };
  return () => {
    const sp = player.st.seated === READ ? player.st.spec : null;
    if (!sp || sp.book === 'shelf') { book.visible = false; return; }
    book.visible = true;
    if (sp.book === 'hand') {
      const { pos, F, N, PALM_T } = palmFrame(man, 'handR');
      book.position.copy(pos).addScaledVector(N, PALM_T + 0.013);
      book.quaternion.setFromRotationMatrix(m4.makeBasis(hw.crossVectors(F, N), F, N));
      book.position.addScaledVector(hw.normalize(), -HW / 2);
      halves[0].rotation.y = 0; halves[1].rotation.y = Math.PI;
    } else { book.position.set(...BOOK.pos); book.rotation.set(BOOK.tilt, 0, 0); halves[0].rotation.y = BOOK.open; halves[1].rotation.y = -BOOK.open; }
  };
}

