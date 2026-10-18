"""Prototype (valence/arousal/dominance, 0..1) for the emotions we lack, from NRC VAD + Warriner + Cowen-Keltner. Writes emotion_candidates.json"""
import json, csv, os
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, '../../data/raw/emotion')
nrc = {}
for ln in open(os.path.join(R, 'nrc_vad/NRC-VAD-Lexicon-v2.1/NRC-VAD-Lexicon-v2.1.txt')).read().splitlines()[1:]:
    t, v, a, d = ln.split('\t'); nrc[t] = tuple((float(x) + 1) / 2 for x in (v, a, d))
war = {r['Word']: tuple((float(r[k]) - 1) / 8 for k in ('V.Mean.Sum', 'A.Mean.Sum', 'D.Mean.Sum')) for r in csv.DictReader(open(os.path.join(R, 'warriner.csv')))}
ck = json.load(open(os.path.join(R, 'ck_appraisal.json')))['emotions']
W = {'awe': ['awe', 'awestruck', 'wonder'], 'aesthetic_appreciation': ['beauty', 'beautiful', 'admiring'], 'nostalgia': ['nostalgia', 'nostalgic', 'wistful'],
     'amusement': ['amused', 'amusement'], 'triumph': ['triumph', 'triumphant'], 'admiration': ['admiration', 'admire'], 'excitement': ['excited', 'excitement'],
     'surprise': ['surprise', 'surprised'], 'guilt': ['guilt', 'guilty'], 'disgust': ['disgust', 'disgusted'], 'sympathy': ['sympathy', 'compassion'], 'envy': ['envy', 'envious'],
     'craving': ['craving', 'longing'], 'adoration': ['adoration', 'adore'], 'romance': ['romance', 'romantic'], 'contempt': ['contempt'], 'horror': ['horror', 'horrified'], 'empathic_pain': ['pity', 'anguish']}
CK = {'aesthetic_appreciation': 'Aesthetic Appreciation', 'empathic_pain': 'Empathic Pain'}
out = {}
for k, ws in W.items():
    ref = []
    for lex in (nrc, war):
        f = [lex[w] for w in ws if w in lex]
        if f: ref.append(tuple(sum(x[i] for x in f) / len(f) for i in range(3)))
    c = ck.get(CK.get(k, k.capitalize()))
    if c: ref.append(tuple((c[d] - 1) / 8 for d in ('Valence', 'Arousal', 'Dominance')))
    out[k] = {'sources': len(ref), 'valence': round(sum(r[0] for r in ref) / len(ref), 2), 'arousal': round(sum(r[1] for r in ref) / len(ref), 2), 'dominance': round(sum(r[2] for r in ref) / len(ref), 2)} if ref else None
for k, v in out.items(): print(k.ljust(24), v)
json.dump(out, open(os.path.join(H, 'emotion_candidates.json'), 'w'), indent=1)
