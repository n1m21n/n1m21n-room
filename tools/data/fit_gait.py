"""Per-style gait statistics from Bandai-Namco Motiondataset-2 (CC BY-NC 4.0; walk clips only).
Output tools/data/gait_fit.json: walk speed, step rate, and mean local rotation of spine/chest/neck/head/shoulders per style,
as ratios/differences vs the 'normal' style. Run: .venv/bin/python -I tools/data/fit_gait.py"""
import json, glob, os, re
import numpy as np
D = os.path.expanduser('~/music videos/n1m21n-room/data/raw/motion/bandai_namco/dataset/Bandai-Namco-Research-Motiondataset-2/data/')
def parse(p):
    names, lines = [], open(p).read().split('\n')
    i = 0
    while not lines[i].startswith('MOTION'):
        m = re.match(r'\s*(ROOT|JOINT)\s+(\S+)', lines[i])
        if m: names.append(m.group(2))
        i += 1
    n = int(lines[i + 1].split()[1]); dt = float(lines[i + 2].split()[2])
    a = np.array([[float(x) for x in l.split()] for l in lines[i + 3:i + 3 + n]])
    return names, a, dt
out = {}
for st in ['normal', 'active', 'elderly', 'exhausted', 'feminine', 'masculine', 'youthful']:
    sp, rot, rate = [], {}, []
    for p in sorted(glob.glob(D + f'dataset-2_walk_{st}_*.bvh')):
        names, a, dt = parse(p)
        h = names.index('Hips'); pos = a[:, h * 6:h * 6 + 3] / 100.0
        # horizontal axes = the two with the largest travel (Y is up)
        d = np.linalg.norm(np.diff(pos[:, [0, 2]], axis=0), axis=1)
        sp.append(d.sum() / (len(d) * dt))
        for j in ['Spine', 'Chest', 'Neck', 'Head', 'Shoulder_L', 'UpperArm_L', 'LowerArm_L']:
            k = names.index(j); r = a[:, k * 6 + 3:k * 6 + 6]
            rot.setdefault(j, []).append(r.mean(0))
        # step rate: dominant frequency of hips vertical oscillation
        y = pos[:, 1] - pos[:, 1].mean(); f = np.abs(np.fft.rfft(y)); fr = np.fft.rfftfreq(len(y), dt)
        m = (fr > 0.8) & (fr < 4); rate.append(fr[m][f[m].argmax()])
    out[st] = {'n': len(sp), 'speed_mps': float(np.mean(sp)), 'step_hz': float(np.mean(rate)),
               'rot_deg': {j: np.mean(v, 0).round(2).tolist() for j, v in rot.items()}}
b = out['normal']
for st, v in out.items():
    v['speed_ratio'] = round(v['speed_mps'] / b['speed_mps'], 3); v['step_ratio'] = round(v['step_hz'] / b['step_hz'], 3)
    v['rot_delta_deg'] = {j: (np.array(r) - np.array(b['rot_deg'][j])).round(2).tolist() for j, r in v['rot_deg'].items()}
json.dump(out, open('tools/data/gait_fit.json', 'w'), indent=1)
for st, v in out.items(): print(st, v['n'], 'speed', round(v['speed_mps'], 2), 'x', v['speed_ratio'], 'step', round(v['step_hz'], 2), 'x', v['step_ratio'], 'head Δ', v['rot_delta_deg']['Head'], 'spine Δ', v['rot_delta_deg']['Spine'])
