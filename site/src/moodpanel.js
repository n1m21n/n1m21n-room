// "how's he doing": a chip beside the clock names the feeling; tap it for a friendly card (a line about it, four meters, today in small wins).
// Reads the sim core only. Shown when the sim drives him (?sim=1 | ?sim=life). Add &stats=1 for the full numbers (needs, affect, chains) for the owner.
const nice = s => String(s || '').replace(/_/g, ' ');
const SAYS = {
  neutral: 'just being.', calm: 'nothing to prove right now.', curious: 'poking at something new.', delighted: 'caught off guard by a good thing.', uneasy: 'something feels a little off.',
  dazed: 'running on fumes.', given_up: 'done for now. it happens.', sleep: 'out cold.', alarm: 'that startled him!', content: 'quietly happy with the day.', joyful: 'it is a good one.',
  absorbed: 'deep in it. do not poke him.', bored: 'wants something to happen.', restless: 'cannot sit still.', anxious: 'a lot in his head.', frustrated: 'it is not going to plan.',
  sad: 'a low one. he will ride it out.', lonely: 'wishes someone would drop by.', proud: 'made something he likes.', relieved: 'phew. that is over.', embarrassed: 'pretend you did not see that.',
  drowsy: 'eyes getting heavy.', awe: 'stopped in his tracks.', aesthetic_appreciation: 'looking at something beautiful.', nostalgia: 'a warm, faraway feeling.', amusement: 'trying not to laugh.', triumph: 'he did the thing!',
};
const DOING = { sleep: 'sleeping', bench: 'on the bench', eat: 'eating', cook: 'cooking', fridge: 'raiding the fridge', tea: 'making tea', guitar: 'playing guitar', keys: 'playing keys', tv: 'watching tv', records: 'picking a record', snake: 'with the snake', window: 'at the window', read: 'reading', work: 'at the desk', work_through: 'at the desk', night_work: 'working late', shower: 'showering', night_shower: 'showering', brush: 'brushing teeth', wash: 'washing up', dress: 'getting dressed', roam: 'wandering', pace: 'pacing', gallery_view: 'looking at art', build: 'building something', gather: 'gathering records', nap_bench: 'napping', phone_call: 'on the phone', write_letter: 'writing a letter', art_sketch: 'sketching', art_refine: 'refining a piece', art_render: 'rendering a piece', art_review: 'judging his own work', answer_phone: 'on the phone', water_plant: 'watering the plant', greet_visitor: 'at the door', run_indoors: 'running about', wall_bump: 'bumped into something', stumble: 'stumbled', false_start: 'changed his mind', yawn: 'yawning', stretch: 'stretching', sigh: 'sighing', fidget: 'fidgeting', sip: 'having a sip', glance: 'looking round' };
const WINS = [['tea', 'cups of tea'], ['eat', 'meals'], ['keys', 'songs on keys'], ['guitar', 'songs on guitar'], ['tv', 'tv sessions'], ['read', 'reading sessions']];
const FLOAT = { energy: 'energy', hunger: 'belly', fun: 'fun', social: 'company', hygiene: 'clean', focus: 'focus', bladder: 'bladder' };
const METERS = [['energy', 'energy'], ['hunger', 'belly'], ['fun', 'fun'], ['social', 'company']];

const PUSH = { guitar: 'guitar songs', keys: 'keys songs', records: 'records', tv: 'tv nights', snake: 'snake pets', window: 'window gazes', read: 'reading sessions', work: 'desk sessions', eat: 'meals', tea: 'cups of tea', cook: 'cooking', fridge: 'fridge raids', shower: 'showers', brush: 'teeth brushed', wash: 'face washes', loo: 'loo trips', dress: 'outfit changes', bench: 'bench sits', gallery_view: 'art looks', sleep: 'lie-downs', lamp: 'lamp flicks', sit: 'stool sits', timeline: 'timeline peeks', phone_call: 'phone calls', water_plant: 'plant waterings', art_refine: 'paint sessions' };
const pills = o => Object.entries(o).filter(([k, n]) => n && PUSH[k]).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `<span><b>${n}</b> ${PUSH[k]}</span>`).join('');

export function makeMoodPanel({ nudges, getCore, getDoing, bonus = () => null, other = () => null }) {      // other: { name } while the camera follows someone else (their numbers, their pronoun)
  const btn = document.getElementById('moodbtn'), box = document.getElementById('mood');
  const full = (() => { try { return new URLSearchParams(location.search).has('stats'); } catch { return false; } })();
  btn.hidden = false;
  const meter = (label, v) => `<div class="mrow"><span>${label}</span><b class="mbar"><i style="width:${Math.round(Math.max(0.04, Math.min(1, v)) * 100)}%"></i></b></div>`;
  const num = (label, v, bad) => `<div class="mrow"><span>${label}</span><b class="mbar${bad ? ' bad' : ''}"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></i></b><em>${Math.round(v * 100)}</em></div>`;
  let open = false, acc = 0, last = '', prev = null, tab = 'today';
  box.addEventListener('click', e => { const t = e.target.closest?.('[data-tab]'); if (t) { tab = t.dataset.tab; acc = 9; } });
  const fl = document.getElementById('moodfloat');
  function pop(txt, up) {                                          // a pill that rises from the chip and fades
    const el = document.createElement('span'); el.textContent = txt; el.className = up ? 'up' : 'down';
    el.style.setProperty('--dx', (Math.random() * 30 - 15) + 'px'); fl.append(el); setTimeout(() => el.remove(), 2600);
  }
  let lastWho = '';
  function watch(m) {                                              // slow decay is ~1 point per sample; an act's reward is a jump
    if (prev) { let n = 0; for (const k in FLOAT) { const d = Math.round(((m[k] ?? 0) - (prev[k] ?? 0)) * 100); if (Math.abs(d) >= 4 && n++ < 4) setTimeout(() => pop(`${d > 0 ? '+' : '−'}${Math.abs(d)} ${FLOAT[k]}`, d > 0), n * 220); } }
    prev = { ...m };
  }
  btn.addEventListener('click', () => { open = !open; box.hidden = !open; btn.setAttribute('aria-expanded', open); acc = 9; });

  function spark(days, now) {                                      // his mood, one point per day, oldest to today; the dot is today
    const pts = [...days.slice(-6).map(d => d.v), now].filter(v => v > 0);
    if (pts.length < 2) return '';
    const w = 220, h = 46, pad = 5, step = (w - 2 * pad) / (pts.length - 1), y = v => (h - pad - Math.max(0, Math.min(1, v)) * (h - 2 * pad)).toFixed(1);
    const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(pad + i * step).toFixed(1)} ${y(v)}`).join('');
    const lo = Math.min(...pts), hi = Math.max(...pts), trend = pts[pts.length - 1] - pts[0];
    const say = Math.abs(trend) < 0.04 ? 'about the same all week' : trend > 0 ? 'a brighter week so far' : 'a heavier week so far';
    return `<svg viewBox="0 0 ${w} ${h}" aria-label="his mood over the last days"><line class="base" x1="${pad}" x2="${w - pad}" y1="${y(0.5)}" y2="${y(0.5)}"/><path d="${d}"/><circle cx="${(pad + (pts.length - 1) * step).toFixed(1)}" cy="${y(pts[pts.length - 1])}" r="3.6"/></svg><p class="mnote">his mood, one point a day, up is happier. ${say}${hi - lo > 0.2 ? ' with some ups and downs' : ''}.</p>`;
  }

  function update(dt) {
    acc += dt; if (acc < 0.6) return; acc = 0;
    const core = getCore(), o = other(), b = o ? null : bonus(), mot = {}; for (const k in core.motives) mot[k] = Math.max(0, Math.min(1, core.motives[k] + (b?.[k] || 0)));   // his own state + what this visitor just did
    if ((o?.name || '') !== lastWho) { lastWho = o?.name || ''; prev = null; }                                  // switching character is not a reward: no +/- floats
    watch(mot);
    const emo = core.emotion.current, a = core.affect, face = core.emotion.faceOf(emo);
    const chip = `<img src="/media/man/face-${face}.webp" alt="" width="18" height="18"><span>${nice(emo)}</span>`;
    if (chip !== last) { btn.innerHTML = chip; last = chip; }
    if (!open) return;
    const t = core.today, doing = getDoing() || core.doing;
    const wins = WINS.map(([k, l]) => [t.acts[k] || 0, l]).filter(w => w[0]);
    if (t.art?.pieces) wins.push([t.art.pieces, t.art.pieces === 1 ? 'piece of art' : 'pieces of art']);
    if (t.social) wins.push([t.social, t.social === 1 ? 'visitor' : 'visitors']);
    const everyone = !o && nudges?.online ? pills(nudges.counts) : '', you = nudges?.online ? pills(nudges.mine || {}) : '';
    const body = tab === 'visitors' && o ? `<p class="mnote">visitors only nudge the shared n1m21n for now. ${o.name} lives her own day.</p>`
      : tab === 'visitors'
      ? (nudges?.online
        ? `${everyone ? `<p class="mlab">everyone · ${nudges.visitors} visitor${nudges.visitors === 1 ? '' : 's'}</p><p class="mwins">${everyone}</p>` : '<p class="mnote">nobody has played with him yet. take the controls and he will remember your visit.</p>'}${you ? `<p class="mlab">you</p><p class="mwins">${you}</p>` : ''}`
        : '<p class="mnote">visits are not loading right now.</p>')
      : tab === 'week' ? (spark(core.days, t.ticks ? t.vSum / t.ticks : 0) || '<p class="mnote">his week fills in as the days go by.</p>')
      : (wins.length ? `<p class="mwins">${wins.slice(0, 6).map(([n, l]) => `<span><b>${n}</b> ${l}</span>`).join('')}</p>` : '<p class="mnote">just getting started.</p>');
    let html = `
      <div class="mhead"><img src="/media/man/face-${face}.webp" alt="" width="46" height="46"><div><b>${nice(emo)}</b><span>${SAYS[emo] || ''}</span></div></div>
      <p class="mnow">${DOING[doing] || nice(doing) || 'thinking'}</p>
      <div class="mmeters">${METERS.map(([k, l]) => meter(l, mot[k] ?? 0)).join('')}</div>
      <div class="mtabs" role="tablist">${[['today', 'today'], ['visitors', 'visitors'], ['week', 'his week']].map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      <div class="mbody">${body}</div>`;
    if (full) {
      html += `<h3>full numbers</h3>${['hygiene', 'focus', 'bladder'].map(k => num(k, mot[k] ?? 0)).join('')}${[['valence', 'mood'], ['arousal', 'wired'], ['stress', 'stress'], ['dominance', 'control']].map(([k, l]) => num(l, a[k] ?? 0, k === 'stress')).join('')}
        <div class="mgrid"><span>acts</span><b>${t.n}</b><span>chains done</span><b>${t.chainsDone}</b><span>chains broken</span><b>${t.chainsBroken}</b><span>went wrong</span><b>${t.outcomes.fail}</b></div>`;
    }
    if (o) html = html.replace(/\bhis\b/g, 'her').replace(/\bhim\b/g, 'her').replace(/\bhe\b/g, 'she').replace(/\bhe'll\b/g, "she'll");     // her numbers, said about her
    btn.title = btn.ariaLabel = o ? `how ${o.name} feels · tap for the numbers` : 'how he feels · tap for the numbers';
    box.innerHTML = html;
  }
  return { update };
}
