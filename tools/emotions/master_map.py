#!/usr/bin/env python3
"""Generate MASTER_MAP.html from the live data files (activities, chains, emotions, ledger, objects, midi, hazards)."""
import json, html, pathlib
D = pathlib.Path(__file__).parent; ROOT = D.parent.parent
L = lambda f: json.load(open(D / f))
acts = L('activities.json')['activities']; ch = L('chains.json'); em = L('emotions.json')['emotions']
led = L('ledger_events.json')['events']; obj = L('objects.json')['objects']; midi = L('midi_rewards.json')['pieces']
haz = L('hazards.json'); tune = L('tune.json'); taste = json.load(open(ROOT / 'tools/art/taste.json'))
e = html.escape
MOT = list(tune['decay'].keys()) if 'decay' in tune else ['energy','hunger','fun','focus','hygiene','bladder','social']
emos = list(em.items()) if isinstance(em, dict) else [(x['name'], x) for x in em]
cats = {}
for k, a in acts.items(): cats.setdefault(a['category'], []).append((k, a))
def chip(t, c=''): return f'<span class="chip {c}">{e(str(t))}</span>'

h = ['''<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>n1m21n master map</title>
<style>:root{--ink:#0A0618;--deep:#140B52;--volt:#3D5BFF;--lav:#B8B5F0;--cream:#FBF8E8;--mag:#ff3d8b}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--cream);font:14px/1.5 ui-sans-serif,system-ui,sans-serif;padding:0 16px 80px}
main{max-width:1100px;margin:auto}h1{font-size:28px;margin:32px 0 4px}h2{font-size:18px;margin:44px 0 8px;color:var(--lav);border-top:1px solid #ffffff22;padding-top:18px}
h3{font-size:14px;margin:18px 0 6px;color:var(--cream)}p.s{color:#B8B5F0aa;margin:0 0 12px;max-width:70ch}
.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:stretch}.box{background:var(--deep);border:1px solid var(--volt);border-radius:10px;padding:10px 12px;flex:1 1 150px;min-width:150px}
.box b{display:block;color:var(--lav);font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.box small{color:#FBF8E8bb}.ar{align-self:center;color:var(--volt);font-size:20px}
.chip{display:inline-block;background:#3D5BFF33;border:1px solid #3D5BFF88;border-radius:99px;padding:1px 9px;margin:2px 3px 2px 0;font-size:12px;white-space:nowrap}
.chip.m{background:#ff3d8b33;border-color:#ff3d8b99}.chip.g{background:#4ade8033;border-color:#4ade8099}.chip.w{background:#ffffff14;border-color:#ffffff44}
table{border-collapse:collapse;width:100%;margin:6px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ffffff1c;vertical-align:top;font-size:13px}th{color:var(--lav);font-weight:600;font-size:12px}
.sc{overflow-x:auto}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}.card{background:var(--deep);border-radius:10px;padding:10px 12px}
.card b{color:var(--lav)}.bar{height:5px;border-radius:3px;background:#ffffff1a;margin:3px 0}.bar i{display:block;height:100%;border-radius:3px;background:var(--volt)}
nav a{color:var(--lav);margin-right:12px;font-size:13px}button{background:var(--volt);color:var(--cream);border:0;border-radius:6px;padding:4px 10px;margin:3px 2px;cursor:pointer}td.c{min-width:44px;text-align:center}th.mh{cursor:pointer}code{background:#ffffff14;padding:1px 5px;border-radius:4px}</style><main>
<h1>n1m21n — master mapping</h1><p class=s>Generated from the live data files (tools/emotions, tools/art). One loop: drive → motive → desire → chain → act → outcome → ledger → chemistry → emotion → back into desire.</p>
<nav><a href=#pipe>pipeline</a><a href=#mot>motive weights</a><a href=#act>acts</a><a href=#chain>chains</a><a href=#free>free chains</a><a href=#emo>emotions</a><a href=#led>rewards</a><a href=#world>world</a><a href=#art>art</a></nav>
<h2 id=pipe>1 · The loop</h2><div class=flow>''']
steps = [('Drive','sleep, eat, clean, move, belong, create'),('Motives', f'{len(MOT)} meters decay in time: '+', '.join(MOT)),('Desire','utility + noise + emotion pull + clock window'),('Chain','a sequence of acts; breaks branch to the next sequence'),('Act', f'{len(acts)} acts, each with a motive reward / drain'),('Outcome','ok · partial · fail · side · surprise'),('Ledger','events add/deduct points, leak across motives'),('Chemistry','DA HT NE CORT OXY SLP'),('Emotion', f'{len(emos)} states with hysteresis')]
for i, (a, b) in enumerate(steps):
    h.append(f'<div class=box><b>{a}</b><small>{e(b)}</small></div>')
    if i < len(steps) - 1: h.append('<div class=ar>→</div>')
h.append('</div><p class=s style="margin-top:10px">Side inputs: hazards (erratic events: knock, phone ring, …) interrupt chains; a visitor is a social reward; the clock gates windows; MIDI and art are acts that pay rewards.</p>')

MM = L('motive_matrix.json'); FO = L('follow.json')
try: MINED = json.load(open(ROOT / 'tools/sim/results/chains-mined.json'))
except Exception: MINED = None
h.append('<h2 id=mot>2 · Motive × act weights (%)</h2><p class=s>Every act can feed (+, green) or drain (−, magenta) every motive. 100 = the strongest effect in the sim. Click a motive to see everything ranked by weight; edit any cell, then “copy JSON” and send it to me (or paste into tools/emotions/motive_matrix.json and run gen.py).</p>')
h.append('<div id=tabs></div><div id=rank></div><div class=sc><table id=mx><tr><th>act<th>category' + ''.join(f'<th class=mh data-m="{m}">{m}' for m in MOT) + '</tr>')
for k, a_ in acts.items():
    row = MM['matrix'].get(k, {})
    h.append(f'<tr data-a="{k}"><td><b>{k}</b><td><small>{a_["category"]}</small>' + ''.join(f'<td class=c contenteditable data-m="{m}">{row.get(m, "")}' for m in MOT))
h.append('</table></div><button id=cp>copy matrix JSON</button> <small id=cpn></small>')
h.append("<script>const MOT=%s,DU=%s;const T=document.getElementById('mx');function paint(td){const v=parseFloat(td.textContent);td.style.background=isNaN(v)||v==0?'':(v>0?`rgba(74,222,128,${Math.min(.85,Math.abs(v)/100+.08)})`:`rgba(255,61,139,${Math.min(.85,Math.abs(v)/100+.08)})`);td.style.color=isNaN(v)?'':'#0A0618'}T.querySelectorAll('td.c').forEach(paint);T.addEventListener('input',e=>paint(e.target));function rank(m){const rows=[...T.querySelectorAll('tr[data-a]')].map(r=>[r.dataset.a,parseFloat(r.querySelector(`td[data-m=${m}]`).textContent)||0]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]);document.getElementById('rank').innerHTML=`<div class=grid><div class=card><b>${m} is fed by</b>${rows.filter(x=>x[1]>0).map(x=>`<div>${x[0]} <span class='chip g'>+${x[1]}%%</span></div>`).join('')}</div><div class=card><b>${m} is drained by</b>${rows.filter(x=>x[1]<0).reverse().map(x=>`<div>${x[0]} <span class='chip m'>${x[1]}%%</span></div>`).join('')}</div></div>`}document.getElementById('tabs').innerHTML=MOT.map(m=>`<button data-m=${m}>${m}</button>`).join(' ');document.getElementById('tabs').onclick=e=>e.target.dataset.m&&rank(e.target.dataset.m);T.querySelectorAll('th.mh').forEach(t=>t.onclick=()=>rank(t.dataset.m));rank('focus');document.getElementById('cp').onclick=()=>{const o={};T.querySelectorAll('tr[data-a]').forEach(r=>{const x={};r.querySelectorAll('td.c').forEach(c=>{const v=parseFloat(c.textContent);if(v)x[c.dataset.m]=v});o[r.dataset.a]=x});navigator.clipboard.writeText(JSON.stringify({drainUnit:DU,matrix:o},null,1));document.getElementById('cpn').textContent='copied'}</script>" % (json.dumps(MOT), MM['drainUnit']))
h.append('<h2 id=act>3 · Acts by category</h2><div class=grid>')
for c, lst in sorted(cats.items()):
    h.append(f'<div class=card><b>{c}</b> <small>({len(lst)})</small><br>' + ''.join(chip(f'{k}' + (' ⚡' if a.get('kind')=='erratic' else ''), 'm' if a.get('kind')=='erratic' else '') for k, a in lst) + '</div>')
h.append('</div><p class=s style="margin-top:8px">⚡ = erratic. forcedOnly acts (greet_visitor, art review stages) are triggered by events/chains, never picked freely.</p>')

h.append('<h2 id=chain>4 · Chains and what happens when they break</h2><p class=s>Cause of break: interrupt (event), skipped (a required step was skipped), timeout (gap too long). Branches are filtered by cause and current emotion. @resume re-enters the same chain once. Depth cap 3, then he settles. Completion may continue into “next” (p .6).</p><div class=sc><table><tr><th>chain<th>kind<th>steps<th>on break →<th>on complete →<th>reward</tr>')
def br(bs): return ''.join(chip(f"{b['to']} ×{b.get('w',1)}" + (f" [{'/'.join(b['cause'])}]" if b.get('cause') else '') + (' [mood]' if b.get('emotion') else ''), 'w') for b in bs) or '—'
for k, c in ch['chains'].items():
    st = ' → '.join(s['act'] + ('?' if s.get('optional') else '') + (f"×{s['count']}" if s.get('count') and not isinstance(s['count'], list) else (f"×{s['count'][0]}-{s['count'][1]}" if s.get('count') else '')) for s in c['steps'])
    h.append(f"<tr><td><b>{k}</b><td>{c['kind']}<td>{e(st)}<td>{br(c.get('branches', []))}<td>{br(c.get('next', []))}<td>{c.get('reward','')}")
h.append('</table></div><h3>Defaults when a chain has no eligible branch</h3>')
for kd, bs in ch['defaults'].items(): h.append(f'<p class=s><b>{kd}</b>: {br(bs)}</p>')

h.append('<h2 id=free>4b · Free chains: unlimited by design</h2><p class=s>A chain is any sequence of acts. Nothing is forbidden: every next act is just more or less likely given the last (affinity below), and sometimes he plans a whole sequence ahead and sticks to it until something interrupts. The named chains above are only motifs we recognise and reward specially.</p>')
if MINED:
    h.append(f"<div class=grid><div class=card><b>sampled</b><br>{MINED['lives']} lives × {MINED['days']} days<br>{MINED['freeChains']} chains happened<br><b>{MINED['distinct']}</b> were distinct<br>{MINED['seenOnce']} happened exactly once</div><div class=card><b>most common 100</b><br>cover only {MINED['massTop100']*100:.1f}% of all chains<br>top 1000: {MINED['massTop1000']*100:.1f}%</div><div class=card><b>distinct sub-chains</b><br>pairs: {MINED['distinct2gram']}<br>triples: {MINED['distinct3gram']}</div></div><h3>Commonest pairs and triples</h3><p class=s>"+''.join(chip(f"{x['seq']} ×{x['n']}") for x in MINED['top2'][:18])+'</p><p class=s>'+''.join(chip(f"{x['seq']} ×{x['n']}", 'g') for x in MINED['top3'][:14])+'</p>')
h.append('<h3>Act-to-act affinity (multiplier on the next act)</h3><p class=s>'+''.join(chip(f'{k} ×{v}', 'w') for k, v in FO['pairs'].items())+'</p><p class=s>By category: '+''.join(chip(f'{k} ×{v}') for k, v in FO['cats'].items())+'</p><p class=s>Test any chain: <code>node tools/sim/chainlab.mjs probe read guitar loo sleep --hour=21</code> prints its per-step and whole-chain probability. <code>mine</code> samples lives and counts what actually happens.</p>')
h.append('<h2 id=emo>5 · Emotions (22) — prototype in valence / arousal / stress / energy / dominance</h2><div class=grid>')
for n, d in emos:
    p = d.get('prototype', {})
    bars = ''.join(f'<div class=bar title="{k} {v:.2f}"><i style="width:{int(v*100)}%"></i></div>' for k, v in p.items())
    h.append(f'<div class=card><b>{n}</b><small> {"· " + d["face"]["expression"] if d.get("face") else ""}</small>{bars}</div>')
h.append('</div><p class=s style="margin-top:8px">Bars top→bottom: valence, arousal, stress, energy, dominance.</p>')

h.append('<h2 id=led>6 · Reward ledger (event → what it pays)</h2><div class=sc><table><tr><th>event<th>kind<th>deltas<th>chemistry</tr>')
for k, v in led.items():
    h.append(f"<tr><td><b>{k}</b><td>{v.get('kind','')}<td>{''.join(chip(f'{a} {b:+g}','g' if b>0 else 'm') for a,b in v.get('deltas',{}).items())}<td>{''.join(chip(f'{a} {b:+g}','w') for a,b in v.get('neuro',{}).items())}")
h.append('</table></div>')

h.append('<h2 id=world>7 · World: objects, visitors, hazards, music</h2><h3>Objects</h3><div class=grid>')
for k, o in (obj.items() if isinstance(obj, dict) else [(x['name'], x) for x in obj]):
    h.append(f"<div class=card><b>{k}</b> {chip(o.get('status',''),'g' if o.get('status')=='built' else 'm')}<br><small>acts: {', '.join(o.get('acts',[]))}<br>motives: {', '.join(o.get('motives',[]))}<br>{e(o.get('placement',''))}</small></div>")
h.append('</div><h3>Visitor = social reward</h3><p class=s>A knock (hazard) or a real site visitor at the door fires greet_visitor: pays social + fun, may be interrupted. Visitor nudges are a local layer only; the shared life never changes.</p><h3>Hazards (erratic events)</h3><p class=s>')
hz = haz.get('hazards', haz) if isinstance(haz, dict) else haz
for k in (hz.keys() if isinstance(hz, dict) else [x.get('name') for x in hz]): h.append(chip(k, 'm'))
h.append('</p><h3>MIDI → reward profile (per file, new files auto-profiled)</h3><div class=sc><table><tr><th>piece<th>target mood (V/A/E)<th>pays<th>best for</tr>')
for k, p in midi.items():
    a = {**p.get('auto', {}), **p.get('manual', {})}; t = a.get('target', {})
    sv = sorted(a.get('suits', {}).items(), key=lambda x: -x[1])[:3]
    h.append(f"<tr><td><b>{k}</b><td>{'/'.join(f'{t.get(x,0):.2f}' for x in ('valence','arousal','energy'))}<td>{''.join(chip(f'{x} {y:.2f}','g') for x,y in a.get('pays',{}).items())}<td>{''.join(chip(x) for x,_ in sv)}")
h.append('</table></div>')

h.append('<h2 id=art>8 · Art: judgement and the feed</h2><div class=flow>')
st = [('Emotion → axes','9 axes: speed amount size noise softness brightness hue contrast symmetry'),('Taste target','guidelines .5 · emotion .3 · learned .2'),('Sketch','emotion blend .6, noisy'),('Refine','perception sharpens with skill'),('Render','craft multiplier from outcome'),('Review','match → serene / proud / flat'),('Satisfaction','only if chain serene_savour completes, calm/content/proud, stress < .3 — RARE = “good”'),('Feed','last 300 pieces → owner picks for the gallery')]
for i, (a, b) in enumerate(st):
    h.append(f'<div class=box><b>{a}</b><small>{e(b)}</small></div>')
    if i < len(st) - 1: h.append('<div class=ar>→</div>')
h.append('</div><p class=s style="margin-top:10px">Only a satisfied piece updates learned taste. Guidelines = brand book: ink #0A0618, deep #140B52, volt #3D5BFF, lav #B8B5F0, cream #FBF8E8; 70/20/10; riso sketchbook. Not built yet: the executor that turns the axis vector into an Infinite patch, the feed UI, 3D objects, and the 13 missing emotion faces.</p></main>')
(ROOT / 'MASTER_MAP.html').write_text(''.join(h))
print('wrote MASTER_MAP.html', len(''.join(h)) // 1024, 'KB')
