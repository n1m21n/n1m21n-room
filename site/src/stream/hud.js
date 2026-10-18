// Stream overlay: teaches viewers what to type and shows what chat just asked for. Its own DOM and CSS, so the regular site carries none.
const CSS = `
#sx { position:fixed; right:16px; bottom:64px; text-align:right; z-index:6; max-width:min(440px,calc(100vw - 32px)); font:500 13px/1.4 'DM Mono',monospace; color:var(--ink,#140B52); pointer-events:none; }
#sx .tip { background:var(--paper,#FFFDF2); border:2px solid var(--ink,#140B52); border-radius:14px; padding:8px 12px; margin-bottom:8px; }
#sx .tip b { color:#E8263F; }
#sx .feed { display:flex; flex-direction:column; gap:5px; align-items:flex-end; }
#sx .chip { background:var(--paper,#FFFDF2); border:2px solid var(--ink,#140B52); border-radius:999px; padding:3px 11px; animation:sxin .35s cubic-bezier(.2,1.4,.4,1); }
#sx .chip.fade { opacity:.0; transition:opacity .8s; }
#sx .chip i { font-style:normal; color:#6B6290; }
@keyframes sxin { from { transform:translateX(30px) scale(.9); opacity:0 } to { transform:none; opacity:1 } }
@media (max-aspect-ratio:1/1) { #sx { font-size:11px; } }`;

export function makeHud({ hints }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'sx'; root.innerHTML = '<div class="tip"></div><div class="feed"></div>'; document.body.appendChild(root);
  const tip = root.querySelector('.tip'), feed = root.querySelector('.feed');
  let i = 0;
  function tipNow() {
    const a = [0, 1, 2, 3].map(k => '!' + hints[(i + k) % hints.length]); i = (i + 4) % hints.length;
    tip.innerHTML = '';
    const b = document.createElement('span'); b.textContent = 'type in chat: '; tip.append(b);
    a.forEach((c, k) => { const e = document.createElement('b'); e.textContent = c; tip.append(e, k < 3 ? ' ' : ''); });
  }
  tipNow(); setInterval(tipNow, 9000);
  function chip(name, what, votes = 1) {                                // textContent only: a viewer's name is never HTML
    const e = document.createElement('div'); e.className = 'chip';
    const n = document.createElement('i'); n.textContent = name + ' '; const w = document.createElement('span'); w.textContent = what + (votes > 1 ? ' ×' + votes : '');
    e.append(n, w); feed.append(e);
    while (feed.children.length > 4) feed.firstChild.remove();
    setTimeout(() => e.classList.add('fade'), 12000); setTimeout(() => e.remove(), 13000);
    return e;
  }
  return { chip };
}
