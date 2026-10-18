// The cast: the people who live in the room. Him is the lead (the shared life everyone sees, on the page from the start); everyone else is a spec file in
// cast/characters/ (picked up automatically) that a visitor can bring in, follow with the camera, take control of, or send off. One place for what they
// share: who is where (awareness.js), which one the camera follows, which one the keys and the stick drive, the buttons in the top bar and the card.
// Adding a character adds nothing here: drop a spec file in cast/characters/ (see .claude/skills/add-room-character/SKILL.md).
import { makeAwareness, manners } from './awareness.js';

const SPECS = import.meta.glob('./characters/*.js', { eager: false });     // id -> () => import(spec); the spec file itself is light
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// lead: { id, name, player, routine, man }; ctx: what a companion needs from the room (scene, camera, solids, walls, nav, rooms, seats, snake, ROAM, PACE)
// ui: { status (the pill row), before (the element new buttons go before), box (the card), toast, panelTop, closeOthers }
export function makeCast({ lead, ctx, ui, storeKey = 'n1m21n.cast' }) {
  const aware = makeAwareness();
  const leadMember = aware.add({ id: lead.id, lead: true, player: lead.player, routine: lead.routine, doing: () => lead.routine.doing, visible: () => true });
  lead.player.setAvoid(() => aware.circlesFor(leadMember));
  const comps = new Map();                                    // id -> companion (once loaded)
  const specs = new Map();                                    // id -> spec (light, loaded at start)
  let focusId = lead.id, controlId = lead.id, openId = null, himCam = null, busy = false;

  const member = id => id === lead.id ? { id, spec: { name: lead.name || lead.id }, player: lead.player, routine: lead.routine, on: true, doing: lead.routine.doing } : comps.get(id);
  const present = () => [lead.id, ...[...comps.values()].filter(c => c.on).map(c => c.id)];
  const nameOf = id => id === lead.id ? (lead.name || lead.id) : specs.get(id)?.name || id;

  // ---- the camera follows one of them (the lead's player runs the camera; it is told whose position to orbit)
  function focus(id) {
    if (!present().includes(id)) id = lead.id;
    const was = focusId; focusId = id;
    if (id !== lead.id && was === lead.id) himCam = { yaw: lead.player.st.yaw, dist: lead.player.st.dist, pitch: lead.player.st.pitch };
    if (id === lead.id && himCam) { Object.assign(lead.player.st, himCam); himCam = null; }
    if (id === lead.id) lead.player.setCamFocus(null);
    else {
      const c = comps.get(id), hp = c.player.pos;
      lead.player.st.yaw = Math.atan2(-hp.x, -hp.z); lead.player.st.dist = 3.4; lead.player.st.pitch = 0.36;       // from the room's middle, so walls and furniture are not between the lens and them
      lead.player.setCamFocus(() => { const s = c.player.st, sp = s.seated; return { x: c.player.pos.x, z: c.player.pos.z, low: !!sp && (s.spec ? (s.spec.y || 0) < -0.1 || !!s.spec.lie : true) }; });
    }
    render();
  }
  // ---- the keys, the stick and the taps drive one of them; the others carry on with their own day
  function control(id) {
    if (!present().includes(id)) id = lead.id;
    if (controlId === id) return; controlId = id;
    for (const c of comps.values()) c.setControlled(c.id === id, lead.player);
    lead.player.setInput(id === lead.id); lead.routine.listen(id === lead.id);
    if (id === lead.id) lead.routine.handBack();
    focus(id);
  }
  // what E does for whoever is under control (null while it is the lead: main.js has his own stations)
  const interactable = () => controlId === lead.id ? null : comps.get(controlId)?.nearSpot() || null;
  // a tap on the floor walks whoever is under control; true = handled here (main.js then skips its own tap)
  function tap(x, z) {
    if (controlId === lead.id) return false;
    comps.get(controlId)?.player.goTo(x, z); return true;
  }

  async function spawn(id) {
    if (busy) return; busy = true;
    try {
      const spec = specs.get(id); if (!spec) return;
      if (!comps.has(id)) {
        const { makeCompanion } = await import('../companion.js');
        const c = await makeCompanion({ ...ctx, aware, lead: { id: lead.id, player: lead.player, routine: lead.routine }, bubbleEl: bubbleFor }, spec);
        comps.set(id, c); aware.add(c.self); c.self.routine = c.routine;

      }
      comps.get(id).show(); remember(); render();
      return comps.get(id);
    } catch (e) { console.warn('cast: could not bring in', id, e); } finally { busy = false; }
  }
  function dismiss(id) {
    const c = comps.get(id); if (!c) return;
    if (controlId === id) control(lead.id);
    if (focusId === id) focus(lead.id);
    c.hide(); if (openId === id) openId = null; remember(); render();
  }
  function remember() { try { localStorage.setItem(storeKey, JSON.stringify([...comps.values()].filter(c => c.on).map(c => c.id))); } catch {} }
  function bubbleFor(spec) {
    const el = document.createElement('div'); el.className = 'tb'; el.hidden = true; el.innerHTML = '<p></p><i></i><i></i>';
    if (spec.bubble?.tint) el.style.setProperty('--tint', spec.bubble.tint);
    document.body.appendChild(el); return el;
  }

  // ---- the top bar: him + whoever is here as chips (the one the camera follows is filled), a "+" for each one not here yet; many of them fold into one "cast" button
  const btns = new Map();
  function chip(id, label, cls, title, onclick) {
    let b = btns.get(id);
    if (!b) { b = document.createElement('button'); b.className = 'meta cast'; b.innerHTML = '<i></i><span></span>'; ui.status.insertBefore(b, ui.before); btns.set(id, b); b.addEventListener('click', e => { e.stopPropagation(); b.onclick_?.(); }); }
    b.onclick_ = onclick; b.hidden = false; b.className = 'meta cast ' + cls; b.lastElementChild.textContent = label; b.title = b.ariaLabel = title; return b;
  }
  function render() {
    const here = present(), away = [...specs.keys()].filter(id => !here.includes(id));
    for (const b of btns.values()) b.hidden = true;
    if (here.length + away.length > 1) chip('_cast', nameOf(focusId), 'who' + (controlId !== lead.id ? ' ctl' : ''), 'choose a character', () => toggle('_list'));
    card();
  }
  function toggle(id, force) { const open = force ?? openId !== id; openId = open ? id : null; if (open) ui.closeOthers?.(); card(); ui.panelTop?.(); }
  function card() {
    const box = ui.box; if (!openId) { box.hidden = true; return; }
    box.hidden = false;
    if (openId === '_list') {
      const all = [lead.id, ...specs.keys()];
      box.innerHTML = '<h3>who</h3><div class="pick">' + all.map(id => { const here = present().includes(id); return `<button class="${id === focusId ? 'sel' : ''}" data-a="${here ? 'open' : 'spawn'}" data-id="${esc(id)}"><b></b><span>${esc(nameOf(id))}</span><em>${id === focusId ? 'following' : here ? 'here' : 'bring in'}</em></button>`; }).join('') + '</div>';
      return;
    }
    const id = openId, spec = id === lead.id ? null : specs.get(id), c = comps.get(id);
    const btn = (a, label, alt, extra = '') => `<button class="go${alt ? ' alt' : ''}" data-a="${a}" data-id="${esc(id)}"${extra}>${label}</button>`;
    box.innerHTML = `<h3>${esc(nameOf(id))}</h3><p>${esc(spec?.intro || 'the one who lives here. everyone who visits sees n1m21n doing the same thing, right now.')}</p>`
      + `<p>${id === focusId ? 'the camera is following ' + esc(nameOf(id)) + '.' : ''}${controlId === id ? ' you have the controls: move with the keys or the stick, tap the floor to walk.' : ''}</p>`
      + '<div class="row">'
      + (id === focusId ? '' : btn('focus', 'follow', true))
      + (id === controlId ? btn('release', 'let go', true) : btn('control', 'take control', false))
      + (spec ? btn('off', 'send off', true) : '') + '</div>';
  }
  ui.box.addEventListener('click', e => {
    const a = e.target.dataset?.a; if (!a) return; const id = e.target.dataset.id, to = e.target.dataset.to;
    if (a === 'focus') focus(id);
    else if (a === 'control') control(id);
    else if (a === 'release') control(lead.id);
    else if (a === 'off') dismiss(id);
    else if (a === 'open') { present().includes(id) && (focus(id), toggle(id, true)); }
    else if (a === 'spawn') spawn(id).then(c => { if (c?.on) { focus(id); toggle(id, true); } });
  });
  // `id` says hi to `to`: walks over and waves (or only nods if they are absorbed); someone doing something private is left alone
  function greet(id, to) {
    const who = comps.get(id), target = comps.get(to);
    let r;
    if (who) r = who.greet(to);
    else if (target) r = target.greet(id);                       // the lead does not walk over by himself: the other comes to him
    else r = { ok: false };
    if (!r?.ok) ui.toast?.(r?.why === 'busy' ? `${nameOf(to)} is busy · not now` : r?.why === 'on the move' ? `${nameOf(to)} is on the move · try again in a moment` : 'not now');
    else openId = null, card();
    return r;
  }

  async function init({ want = [] } = {}) {
    for (const [path, load] of Object.entries(SPECS)) { const s = (await load()).default; if (s?.id) specs.set(s.id, s); }
    render();
    for (const id of want) if (specs.has(id)) await spawn(id);
  }
  // talking is decided by closeness: when two of them are within a few metres, whoever is free (not under the visitor's hands) walks over and greets,
  // or only nods if the other is absorbed; someone asleep or washing is left alone. A pair does not greet again for two minutes.
  const NEAR = 2.2, again = new Map(); let nearAt = 0;
  function nearby(dt) {
    if ((nearAt += dt) < 0.5) return; nearAt = 0;
    const ms = aware.members.filter(m => m.visible());
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i], b = ms[j], key = a.id + '|' + b.id;
      if (aware.distance(a, b) > NEAR || (again.get(key) || 0) > Date.now()) continue;
      const g = [a, b].map(m => comps.get(m.id)).find(c => c && !c.controlled && !c.meeting);
      if (g) { const r = g.greet(g.id === a.id ? b.id : a.id); again.set(key, Date.now() + (r.ok ? 120e3 : 20e3)); }
      else {                                                    // the visitor is walking one of them up to the lead: the lead turns round to them
        const l = [a, b].find(m => m.lead), o = l === a ? b : a;
        if (l && o && manners(l.doing()) === 'free' && !lead.player.st.seated && !lead.routine.walking) lead.player.st.turnTo = Math.atan2(o.player.pos.x - lead.player.pos.x, o.player.pos.z - lead.player.pos.z);
        again.set(key, Date.now() + 60e3);
      }
    }
  }
  function update(dt, t) { for (const c of comps.values()) c.update(dt, t); nearby(dt); }
  return { init, update, interactable, spawn, dismiss, focus, control, tap, greet, aware, render, present, get focusId() { return focusId; }, get controlId() { return controlId; }, comps, specs };
}
