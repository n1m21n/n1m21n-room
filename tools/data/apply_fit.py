#!/usr/bin/env python3
"""Turn atus_fit.json + smarthome_fit.json into tools/emotions/follow.json (act-pair multipliers + 24h circadian shapes)
and data-backed cells of motive_matrix.json.
Hand originals are kept in follow.hand.json / motive_matrix.hand.json; this script always rebuilds from them, so it is repeatable.
usage: python3 apply_fit.py [--blend=0.6]   (blend = share of the data value in a data-backed cell; the rest is the hand value)"""
import json, sys, os, math
H = os.path.dirname(os.path.abspath(__file__)); E = H + '/../emotions'
blend = float(next((a.split('=')[1] for a in sys.argv if a.startswith('--blend=')), 0.6))
fit = json.load(open(H + '/atus_fit.json')); cl = json.load(open(H + '/atus_classes.json'))['acts']
sh_path = H + '/smarthome_fit.json'
sh = json.load(open(sh_path)) if os.path.exists(sh_path) else {'lift': {}, 'hour_shape': {}, 'total_episodes': 0}
hand_f = json.load(open(H + '/follow.hand.json')); hand_m = json.load(open(H + '/motive_matrix.hand.json'))

# ---- follow: ATUS lift between classes applies to cross-class pairs; smart-home (CASAS+Kasteren) refines fine-grained indoor & within-groom pairs
LIFT = fit['lift']; SH_LIFT = sh.get('lift', {}); pairs = {}; src = {}
acts = list(cl)
for a in acts:
    for b in acts:
        if a == b: continue
        k = a + '>' + b
        v_atus = LIFT.get(cl[a] + '>' + cl[b]) if cl[a] != cl[b] else None
        v_sh = SH_LIFT.get(k)
        if v_atus is not None and v_sh is not None:
            v = 0.65 * v_atus + 0.35 * v_sh
        elif v_atus is not None:
            v = v_atus
        elif v_sh is not None:
            v = v_sh
        else:
            continue
        pairs[k] = round(min(4.0, max(0.4, v)), 2)
nd = len(pairs)
for k, v in hand_f['pairs'].items():      # hand pairs survive or blend where fine-grained sequence intent is strongest
    if k not in pairs:
        pairs[k] = v; src[k] = 'hand'
    else:
        pairs[k] = round(0.5 * pairs[k] + 0.5 * v, 2)

# Build 24-hour circadian multiplier per activity class (normalized so mean across 24h = 1.0)
hour_mult = {}
for c, h in fit.get('hour_shape', {}).items():
    s = sum(h) or 1.0
    hour_mult[c] = [round(min(2.6, max(0.25, (x / s) * 24.0)), 3) for x in h]

follow = {
    'doc': hand_f['doc'] + ' Cross-class pairs come from ATUS 2003-2024 transition lifts + CASAS/Kasteren smart-home indoor lifts (clipped 0.4-4); hand pairs fill the rest. Rebuild with tools/data/apply_fit.py.',
    'pairs': pairs,
    'cats': {},
    'hourShape': hour_mult,
    'sources': {
        'data_pairs': nd,
        'hand_pairs': len(pairs) - nd,
        'atus_diaries': fit['diaries'],
        'atus_episodes': fit['episodes'],
        'smarthome_episodes': sh.get('total_episodes', 0),
    }
}
json.dump(follow, open(E + '/follow.json', 'w'), indent=0)

# ---- matrix
wb = fit['wellbeing']; mean = fit['wellbeing_mean']
def sd(v): vals = [x[v] for x in wb.values()]; m = sum(vals) / len(vals); return math.sqrt(sum((y - m) ** 2 for y in vals) / len(vals))
S = {v: sd(v) for v in ('happy', 'stress', 'tired', 'meaning')}
z = lambda c, v: (wb[c][v] - mean[v]) / S[v]
def data_cell(c, m):
    if m == 'fun':    return max(-100, min(100, 45 + 45 * z(c, 'happy') - 40 * max(0, z(c, 'stress'))))
    if m == 'focus':  return max(-100, min(100, 45 * z(c, 'meaning') - 40 * z(c, 'stress') + 10))
    if m == 'energy': return max(-100, min(100, -35 * max(0, z(c, 'tired') + 0.2)))
mat = {a: dict(r) for a, r in hand_m['matrix'].items()}; msrc = {}; changed = 0
for a, r in mat.items():
    c = cl.get(a)
    if c not in wb: continue
    if a in ('sleep', 'nap_bench', 'bench'): continue        # sleep is not in the Well-Being module; rest stays hand-set
    for m in ('fun', 'focus', 'energy'):
        d = data_cell(c, m); old = r.get(m, 0)
        if m == 'energy' and old > 0 and d <= 0: continue      # an act that restores energy (tea, tv) keeps it; data only adds drains
        new = round(blend * d + (1 - blend) * old)
        if new != old: r[m] = new; changed += 1
        msrc.setdefault(a, {})[m] = f'atus-wb class {c} (blend {blend})'
out = dict(hand_m); out['matrix'] = {a: {m: v for m, v in r.items() if v} for a, r in mat.items()}
out['doc'] = hand_m['doc'] + f' fun/focus/energy cells of ATUS-mapped acts are blended {blend:.0%} toward ATUS Well-Being Module means (happy/stress/tired/meaning z-scores); hunger, hygiene, bladder, social and sleep/rest stay hand-set (see sources).'
out['sources'] = msrc
json.dump(out, open(E + '/motive_matrix.json', 'w'), indent=1)
print(f'follow: {nd} data pairs (ATUS+CASAS+Kasteren) + {len(pairs) - nd} hand, {len(hour_mult)} 24h class shapes; matrix: {changed} cells moved toward data')
