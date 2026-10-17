// Canvas-drawn flat art (paintings, sky, tee, face) in the r11 palette. Cheap: no image downloads.
import * as THREE from 'three';

export const PAL = {
  ink: '#0B0B0B', deep: '#140B52', indigo: '#2A1A9E', blue: '#2E3BDB', violet: '#5A22B8', plum: '#3A1580',
  lav: '#B8B5F0', mag: '#E0368F', red: '#FF2E4A', cream: '#F4EFA1', white: '#FBF8E8', paper: '#F1E9D2',
  skin: '#F7A39F', skinSh: '#5C4FD2', spiral: '#F6E27A', green: '#2E9E5B', greenD: '#1B6B45', wood: '#C8553D',
  orange: '#F2643A', teal: '#3FC1B0', hair: '#1A1438', hairHi: '#7FA6FF', pants: '#3A49C9', boot: '#141026',
};

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function inkStroke(g, w) { g.strokeStyle = PAL.ink; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; }

function spiralPath(g, cx, cy, r, turns, n = 300) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2, rr = t * r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
}

// the window: the same swirl in four moods, picked by India time (main.js skyPhase). Night keeps the crescent + stars,
// day a big sun and puffy ink-edged clouds, dawn / dusk a low half sun in warm rings
const SKY = {
  night: [PAL.deep, PAL.violet, PAL.indigo, '#6A4BE0', PAL.plum, PAL.blue, PAL.deep],
  dawn: ['#F6B38A', '#F2643A', '#F7A39F', '#B8B5F0', '#E0368F', '#F6E27A', '#F7A39F'],
  day: ['#7FC8F8', '#5FB2F0', '#9AD6FA', '#4FA0E8', '#B6E3FB', '#6BBDF4', '#7FC8F8'],
  dusk: [PAL.plum, PAL.mag, '#F2643A', PAL.violet, '#E0368F', '#F6B38A', PAL.plum],
};
export function skyTex(phase = 'night') {
  return canvas(512, 512, (g, w, h) => {
    const rings = SKY[phase] || SKY.night;
    for (let i = 14; i > 0; i--) {
      g.fillStyle = rings[i % rings.length];
      g.beginPath(); g.ellipse(w * .55, h * .58, i * 40, i * 30, -0.3, 0, Math.PI * 2); g.fill();
    }
    if (phase === 'night') {
      g.fillStyle = PAL.spiral;                               // crescent
      g.beginPath(); g.arc(150, 130, 52, 0, Math.PI * 2); g.fill();
      g.fillStyle = rings[2]; g.beginPath(); g.arc(178, 112, 48, 0, Math.PI * 2); g.fill();
      g.fillStyle = PAL.white;
      for (let i = 0; i < 26; i++) {                          // 4-point stars
        const x = (i * 197) % w, y = (i * 131 + 40) % h, s = 4 + (i % 3) * 3;
        g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s * .5, y); g.lineTo(x, y + s * 2); g.lineTo(x - s * .5, y); g.fill();
        g.beginPath(); g.moveTo(x - s * 2, y); g.lineTo(x, y + s * .5); g.lineTo(x + s * 2, y); g.lineTo(x, y - s * .5); g.fill();
      }
      return;
    }
    const low = phase !== 'day', sx = phase === 'dusk' ? 360 : 150, sy = low ? 400 : 140, sr = low ? 90 : 62;
    inkStroke(g, 6);
    g.fillStyle = PAL.spiral; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill(); g.stroke();   // sun
    for (let i = 0; i < 12; i++) {                            // chunky rays
      const a = i / 12 * Math.PI * 2; g.beginPath();
      g.moveTo(sx + Math.cos(a) * (sr + 14), sy + Math.sin(a) * (sr + 14)); g.lineTo(sx + Math.cos(a) * (sr + 40), sy + Math.sin(a) * (sr + 40)); g.stroke();
    }
    if (low) { g.fillStyle = rings[1]; g.fillRect(0, 430, w, h - 430); g.beginPath(); g.moveTo(0, 430); g.lineTo(w, 430); g.stroke(); }   // horizon
    g.fillStyle = phase === 'day' ? PAL.white : '#F7D3C8';    // clouds: three bumps on a flat base
    for (const [cx, cy, k] of [[340, 120, 1], [120, 300, .8], [380, 300, .7]]) {
      g.beginPath(); g.moveTo(cx - 80 * k, cy + 22 * k);
      g.arc(cx - 45 * k, cy + 2 * k, 30 * k, Math.PI, 0); g.arc(cx + 5 * k, cy - 14 * k, 40 * k, Math.PI, 0); g.arc(cx + 52 * k, cy + 4 * k, 28 * k, Math.PI, 0);
      g.lineTo(cx + 80 * k, cy + 22 * k); g.closePath(); g.fill(); g.stroke();
    }
  });
}

export function eyePaintingTex() {
  return canvas(512, 400, (g, w, h) => {
    g.fillStyle = PAL.orange; g.fillRect(0, 0, w, h);
    g.fillStyle = PAL.mag; g.fillRect(28, 28, w - 56, h - 56);
    g.fillStyle = PAL.spiral;
    g.beginPath(); g.moveTo(60, h / 2); g.quadraticCurveTo(w / 2, 40, w - 60, h / 2); g.quadraticCurveTo(w / 2, h - 40, 60, h / 2); g.fill();
    inkStroke(g, 8); g.stroke();
    g.fillStyle = PAL.white; g.beginPath(); g.ellipse(w / 2, h / 2, 120, 80, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = PAL.lav; g.beginPath(); g.arc(w / 2, h / 2, 62, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = PAL.indigo; g.beginPath(); g.arc(w / 2, h / 2, 30, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 9; i++) {                                // lashes
      const a = Math.PI + (i + 1) / 10 * Math.PI;
      g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 150, h / 2 + Math.sin(a) * 105); g.lineTo(w / 2 + Math.cos(a) * 185, h / 2 + Math.sin(a) * 135); g.stroke();
    }
  });
}

export function spiralPaintingTex() {
  return canvas(400, 400, (g, w, h) => {
    g.fillStyle = PAL.teal; g.fillRect(0, 0, w, h);
    inkStroke(g, 22); g.strokeStyle = PAL.deep; spiralPath(g, w / 2, h / 2, 165, 4.2); g.stroke();
  });
}

export function snakePaintingTex() {
  return canvas(300, 420, (g, w, h) => {
    g.fillStyle = PAL.orange; g.fillRect(0, 0, w, h);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(90, 360); g.bezierCurveTo(260, 300, 30, 220, 200, 170); g.bezierCurveTo(260, 140, 150, 80, 190, 60);
    g.strokeStyle = PAL.ink; g.lineWidth = 34; g.stroke();
    g.strokeStyle = PAL.white; g.lineWidth = 22; g.stroke();
    g.fillStyle = PAL.red; g.beginPath(); g.moveTo(190, 40); g.lineTo(212, 76); g.lineTo(170, 72); g.fill();
  });
}

export function checkerTex() {
  const t = canvas(256, 256, (g, w) => {
    const s = w / 2;
    g.fillStyle = PAL.blue; g.fillRect(0, 0, w, w);
    g.fillStyle = PAL.violet; g.fillRect(s, 0, s, s); g.fillRect(0, s, s, s);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function spinesTex() {
  return canvas(512, 128, (g, w, h) => {
    const cols = [PAL.red, PAL.teal, PAL.lav, PAL.cream, PAL.mag, PAL.green, PAL.lav, PAL.red, PAL.white, PAL.teal, PAL.violet, PAL.spiral];
    let x = 6;
    for (let i = 0; x < w - 10; i++) {
      const sw = 22 + (i * 7) % 12;
      g.fillStyle = cols[i % cols.length]; g.fillRect(x, 8, sw, h - 16);
      inkStroke(g, 3); g.strokeRect(x, 8, sw, h - 16);
      x += sw + 4;
    }
  });
}

export function keysTex() {
  return canvas(512, 96, (g, w, h) => {
    g.fillStyle = PAL.white; g.fillRect(0, 0, w, h);
    inkStroke(g, 3);
    const n = 24;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, h); g.stroke(); }
    g.fillStyle = PAL.ink;
    for (let i = 0; i < n; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) g.fillRect((i + .68) * w / n, 0, w / n * .6, h * .6);
  });
}

export function teeTex() {
  const liquid = ['#1E1A6E', '#3B2BB0', '#B8B5F0', '#3B2BB0', '#E0368F', '#1E1A6E', '#6A4BE0', '#2E3BDB'];
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = liquid[0]; g.fillRect(0, 0, w, h);
    for (let b = 0; b < 9; b++) {
      g.fillStyle = liquid[b % liquid.length];
      g.beginPath();
      const y0 = b * 62 - 30;
      g.moveTo(0, y0);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x / 70 + b * 1.7) * 26 + Math.sin(x / 31 + b) * 8);
      g.lineTo(w, y0 + 70); g.lineTo(0, y0 + 70); g.fill();
    }
  });
}

// face on a sphere: SphereGeometry front (+z) sits at u = 0.25
export function faceTex() {
  return canvas(1024, 512, (g, w, h) => {
    const cx = w * 0.25, cy = h * 0.54;
    g.fillStyle = PAL.skin; g.fillRect(0, 0, w, h);
    g.fillStyle = PAL.skinSh; g.fillRect(cx + 4, 0, w * 0.5, h);       // r11: blue half of the face
    g.fillStyle = '#FF6F8E'; g.globalAlpha = .55;
    g.beginPath(); g.ellipse(cx - 62, cy + 40, 26, 14, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    for (const s of [-1, 1]) {                                          // eyes: lidded almonds, yellow irises
      const ex = cx + s * 52, ey = cy - 18;
      g.fillStyle = PAL.white;
      g.beginPath(); g.moveTo(ex - 30, ey); g.quadraticCurveTo(ex, ey - 22, ex + 30, ey); g.quadraticCurveTo(ex, ey + 16, ex - 30, ey); g.fill();
      inkStroke(g, 4); g.stroke();
      g.fillStyle = PAL.ink; g.beginPath(); g.arc(ex - 4, ey - 1, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#E9B23C'; g.beginPath(); g.arc(ex - 4, ey - 1, 3.5, 0, Math.PI * 2); g.fill();
      inkStroke(g, 7); g.beginPath(); g.moveTo(ex - 32, ey - 4); g.quadraticCurveTo(ex, ey - 26, ex + 32, ey - 6); g.stroke();   // heavy lid
      inkStroke(g, 5); g.beginPath(); g.moveTo(ex - 26, ey - 38); g.lineTo(ex + 24, ey - 42 + s * 4); g.stroke();             // brow
    }
    g.fillStyle = '#E9A43C'; g.beginPath(); g.arc(cx, cy + 58, 25, 0, Math.PI * 2); g.fill(); // spiral mouth
    inkStroke(g, 4); g.stroke();
    inkStroke(g, 4); g.strokeStyle = '#8A3B10'; spiralPath(g, cx, cy + 58, 21, 3); g.stroke();
  });
}

export function pawsTex() { return null; }
