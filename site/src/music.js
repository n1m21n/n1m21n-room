// The record player (brief §2 "play a record"): a crate of sleeves at the shelf, a docked now-playing deck — the vinyl
// spins with the cover as its label, prev / play / next, waveform scrubber, tracklist, streaming links — and the
// global music switch. Data: data/music.json (tools/export_music.py). OS media keys via the Media Session API.
const LINKS = [['spotify', 'spotify'], ['apple_music', 'apple music'], ['youtube_music', 'yt music'], ['bandcamp', 'bandcamp']];
const KIND = { album: 'album', bandcamp: 'bandcamp single', single: 'single', ep: 'ep' };
const fmt = s => (s = Math.max(0, s | 0), `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const year = a => a.released.slice(0, 4);
const ICON = {
  prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2.5v14H6zM19 5v14L9 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M15.5 5H18v14h-2.5zM5 5l10 7-10 7z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5l13 7.5-13 7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6h12v2H4zM4 11h12v2H4zM4 16h8v2H4zM18 13v-7h3v2h-1.5v7.5a2.5 2.5 0 1 1-1.5-2.3z"/></svg>',
};
const linkRow = (links, cls = 'links') => `<div class="${cls}">${LINKS.filter(([k]) => links?.[k]).map(([k, n]) => `<a href="${esc(links[k])}" target="_blank" rel="noopener">${n} ↗</a>`).join('')}</div>`;
const disc = (cover, cls = 'vinyl') => `<span class="${cls}"><img src="/${esc(cover)}" alt=""></span>`;

export function makeMusic({ data, cardEl, card, closeCard, onTrack = () => {} }) {
  const albums = data.albums;
  window.__n1audio?.pause();                                    // hot reload: never leave an orphan playing
  const audio = window.__n1audio = new Audio(); audio.preload = 'metadata';
  // one player across every open tab / window: whoever starts playing silences the rest
  const me = Math.random().toString(36).slice(2);
  const bus = 'BroadcastChannel' in window ? new BroadcastChannel('n1m21n-music') : null;
  if (bus) bus.onmessage = e => { if (e.data?.playing && e.data.playing !== me && (on || !audio.paused)) { on = false; audio.pause(); paint(); } };
  let A = 0, T = 0, on = false, listOpen = false;
  const album = () => albums[A], track = () => albums[A].tracks[T];

  // ---------- deck
  const deck = document.createElement('div');
  deck.id = 'deck';
  deck.innerHTML = `
    <button class="vbtn" id="dv" aria-label="show player">${disc(album().cover['400'])}</button>
    <div class="dbody">
      <div class="dhead"><div class="dtitles"><div class="dt" id="dt"></div><div class="da" id="da"></div></div>
        <button class="dmin" id="dmin" aria-label="minimise">–</button></div>
      <div id="dw" class="dseek" role="slider" aria-label="seek"><i></i></div>
      <div class="dtime"><span id="dc">0:00</span><span id="dd">0:00</span></div>
      <div class="dctl">
        <button id="dlist" class="dsm" aria-label="tracklist">${ICON.list}</button>
        <button id="dprev" aria-label="previous">${ICON.prev}</button>
        <button id="dplay" class="dbig" aria-label="play">${ICON.play}</button>
        <button id="dnext" aria-label="next">${ICON.next}</button>
        <button id="dcrate" class="dsm dtxt" aria-label="all records">crate</button>
      </div>
      <div id="dl"></div>
      <ol class="dtracks" id="dtracks" hidden></ol>
    </div>`;
  document.body.appendChild(deck);
  const q = id => deck.querySelector('#' + id);
  if (matchMedia('(max-width: 640px), (pointer: coarse)').matches) deck.classList.add('mini');
  q('dv').onclick = () => deck.classList.toggle('mini');
  q('dmin').onclick = () => deck.classList.add('mini');
  q('dplay').onclick = () => toggle();
  q('dprev').onclick = () => prev();
  q('dnext').onclick = () => next();
  q('dcrate').onclick = () => openCrate();
  q('dlist').onclick = () => { listOpen = !listOpen; q('dtracks').hidden = !listOpen; q('dlist').classList.toggle('on', listOpen); };

  // global switch (chrome, top right)
  const sw = document.createElement('button');
  sw.id = 'musicsw';
  document.querySelector('.chrome .right').prepend(sw);
  sw.onclick = () => toggle();

  // ---------- seek bar: filled to the playhead, drag or tap anywhere on it to scrub
  const wave = q('dw');
  function drawWave() {
    const p = audio.duration ? audio.currentTime / audio.duration : 0;
    wave.style.setProperty('--p', (p * 100).toFixed(2) + '%'); wave.setAttribute('aria-valuenow', Math.round(p * 100));
  }
  let scrub = false;
  const seek = e => { const r = wave.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); if (audio.duration) audio.currentTime = f * audio.duration; drawWave(); };
  wave.addEventListener('pointerdown', e => { scrub = true; try { wave.setPointerCapture(e.pointerId); } catch {} seek(e); e.stopPropagation(); });
  wave.addEventListener('pointermove', e => { if (scrub) seek(e); });
  wave.addEventListener('pointerup', () => { scrub = false; }); wave.addEventListener('pointercancel', () => { scrub = false; });
  for (const el of [deck, sw]) for (const ev of ['pointerdown', 'pointerup', 'wheel']) el.addEventListener(ev, e => e.stopPropagation());

  // ---------- state -> UI
  function paint() {
    const a = album(), t = track(), playing = !audio.paused;
    q('dt').textContent = t.title;
    q('da').textContent = `${a.title} · ${year(a)}`;
    q('dd').textContent = fmt(audio.duration || t.dur);
    q('dv').querySelector('img').src = '/' + a.cover['400'];
    q('dplay').innerHTML = playing ? ICON.pause : ICON.play;
    q('dplay').setAttribute('aria-label', playing ? 'pause' : 'play');
    q('dl').innerHTML = linkRow({ ...a.links, ...t.links });
    q('dtracks').innerHTML = a.tracks.map((x, i) => `<li data-i="${i}" class="${i === T ? 'cur' : ''}"><span>${esc(x.title)}</span><em>${fmt(x.dur)}</em></li>`).join('');
    q('dtracks').querySelectorAll('li').forEach(li => { li.onclick = () => play(A, +li.dataset.i); });
    deck.classList.toggle('playing', playing);
    sw.innerHTML = `<span class="sl">music</span><span class="tg"><i></i></span><span class="st">${on ? 'on' : 'off'}</span>`;
    sw.setAttribute('aria-pressed', on);
    sw.classList.toggle('on', on);
    drawWave();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: data.artist.name, album: a.title, artwork: [{ src: '/' + a.cover['1000'], sizes: '1000x1000', type: 'image/webp' }] });
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }

  function load(a, t) {
    const changed = a !== A;
    A = (a + albums.length) % albums.length; T = t;
    audio.src = '/' + track().src;
    if (changed || !audio.dataset.cover) { audio.dataset.cover = album().cover['400']; onTrack(album(), track()); }
  }
  function play(a = A, t = T) {
    if (a !== A || t !== T || !audio.src) load(a, t);
    on = true;
    bus?.postMessage({ playing: me });
    audio.play().catch(() => {});
    paint();
  }
  function pause() { on = false; audio.pause(); paint(); }
  function toggle(force) {
    on = force ?? !on;
    if (on) play(); else pause();
  }
  function next() {
    if (T + 1 < album().tracks.length) play(A, T + 1);
    else play((A + 1) % albums.length, 0);                       // album over: the next record in the crate
  }
  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (T > 0) play(A, T - 1);
    else { const a = (A - 1 + albums.length) % albums.length; play(a, albums[a].tracks.length - 1); }
  }
  audio.addEventListener('ended', () => { if (on) next(); });
  audio.addEventListener('play', () => { if (!on) audio.pause(); });   // off means silent, whatever asked it to play
  audio.addEventListener('play', paint);
  audio.addEventListener('pause', paint);
  audio.addEventListener('loadedmetadata', paint);
  audio.addEventListener('timeupdate', () => { q('dc').textContent = fmt(audio.currentTime); if (!scrub) drawWave(); });
  addEventListener('resize', drawWave);
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => toggle(true));
    ms.setActionHandler('pause', () => toggle(false));
    ms.setActionHandler('previoustrack', prev);
    ms.setActionHandler('nexttrack', next);
    try { ms.setActionHandler('seekto', d => { audio.currentTime = d.seekTime; }); } catch { /* older browsers */ }
  }

  // ---------- the crate (shelf station)
  function openCrate() {
    card(`<div class="crate"><div class="chead"><p class="cap">records</p><p class="meta">${albums.length} records · ${esc(data.artist.name)}</p></div>
      ${linkRow(data.artist, 'links artist')}
      <div class="sleeves">${albums.map((a, i) => `<button class="sleeve${i === A && on ? ' cur' : ''}" data-a="${i}">
        ${disc(a.cover['400'], 'sdisc')}<img src="/${esc(a.cover['400'])}" alt="" loading="lazy">
        <b>${esc(a.title)}</b><i>${year(a)} · ${a.tracks.length} ${a.tracks.length > 1 ? 'tracks' : 'track'}</i></button>`).join('')}</div></div>`);
    cardEl.querySelectorAll('.sleeve').forEach(b => { b.onclick = () => openAlbum(+b.dataset.a); });
  }
  function openAlbum(i) {
    const a = albums[i];
    card(`<div class="crate"><button class="back" id="cback">← all records</button>
      <div class="ahead">${disc(a.cover['400'], 'vinyl big' + (i === A && !audio.paused ? ' spin' : ''))}
        <div><p class="cap">${esc(a.title)}</p><p class="meta">${[KIND[a.kind] || a.kind, year(a), esc(a.genre || ''), `${a.tracks.length} ${a.tracks.length > 1 ? 'tracks' : 'track'}`].filter(Boolean).join(' · ')}</p>
        <button class="playall" id="cplay">${ICON.play}<span>play ${a.tracks.length > 1 ? 'record' : 'track'}</span></button></div></div>
      ${linkRow(a.links)}
      <ol class="atracks">${a.tracks.map((t, k) => `<li data-t="${k}" class="${i === A && k === T && on ? 'cur' : ''}"><span>${esc(t.title)}</span><em>${fmt(t.dur)}</em></li>`).join('')}</ol></div>`);
    const go = k => { play(i, k); closeCard(); deck.classList.remove('mini'); };
    cardEl.querySelector('#cback').onclick = openCrate;
    cardEl.querySelector('#cplay').onclick = () => go(0);
    cardEl.querySelectorAll('.atracks li').forEach(li => { li.onclick = () => go(+li.dataset.t); });
  }

  load(0, 0);
  paint();
  return { audio, openCrate, toggle, next, prev, isOn: () => on };
}
