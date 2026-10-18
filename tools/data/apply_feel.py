"""Per-act mood offsets from the ATUS Well-Being Module. valence = (happy_class - mean)/6, stress = (stress_class - mean)/6.
Writes tools/emotions/act_feel.json (then run tools/emotions/gen.py). Acts whose class has < 100 episodes stay 0 (hand-set)."""
import json, os
H = os.path.dirname(os.path.abspath(__file__))
fit = json.load(open(os.path.join(H, 'atus_fit.json'))); cls = json.load(open(os.path.join(H, 'atus_classes.json')))['acts']
wb, mean = fit['wellbeing'], fit['wellbeing_mean']
out = {}
for act, c in cls.items():
    w = wb.get(c)
    if not w or w['n'] < 100 or c == 'other': continue
    out[act] = {'valence': round((w['happy'] - mean['happy']) / 6, 3), 'stress': round((w['stress'] - mean['stress']) / 6, 3), 'source': f'ATUS WB class {c}, n={w["n"]}'}
json.dump({'doc': 'additive mood offset while doing the act; scaled by TUNE.feelPull', 'acts': out}, open(os.path.join(H, '../emotions/act_feel.json'), 'w'), indent=1)
print(len(out), 'acts;', 'work', out.get('work'), 'social', out.get('social'))
