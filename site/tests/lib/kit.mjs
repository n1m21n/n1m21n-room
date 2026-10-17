// In-page helper kit (serialised into the page with `(${installKit})()`): reset / stand / act / deck / hall / frames on window.__t
export function installKit() {
  const $ = id => document.getElementById(id);
  const d = window.dev;
  const frames = n => new Promise(res => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const T = {
    frames,
    reset() {
      if (!$('card').hidden) $('cardx')?.click();
      if (d.player.st.seated) d.player.stand();
      $('deck').classList.add('mini'); $('toast').hidden = true;
      d.player.st.yaw = 0.25; d.player.st.pitch = 0.38; d.player.st.dist = 3.8;
      while (d.player.st.view !== 'third') $('view').click();
    },
    view(v) { let n = 0; while (d.player.st.view !== v && n++ < 4) $('view').click(); if (v === 'first') d.player.st.pitch = 0; else d.player.st.pitch = 0.38; },
    stand(x, z, h) { d.player.pos.set(x, 0, z); d.player.st.heading = h; d.man.root.position.set(x, 0, z); },
    act(label) { const s = d.stations.find(s => s.label === label && !s.frame); if (!s) throw new Error('no station ' + label); s.act(); },
    nearSnake() { const q = d.stations.find(s => s.live).live(); d.player.pos.set(q.x + 0.5, 0, q.z + 0.5); d.man.root.position.set(q.x + 0.5, 0, q.z + 0.5); },
    deck(open) { $('deck').classList.toggle('mini', !open); },
    hall(i) { const z = d.gallery.zones.filter(z => z.entry)[i]; d.player.pos.set(z.entry.x, 0, z.entry.z); d.player.st.heading = z.entry.heading; d.man.root.position.set(z.entry.x, 0, z.entry.z); },
  };
  window.__t = T;
}
