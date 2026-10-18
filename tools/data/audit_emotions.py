"""Compare our emotion prototypes (valence/arousal/dominance) with NRC VAD, Warriner and Cowen-Keltner ratings.
usage: python3 audit_emotions.py   -> prints a table, writes emotion_audit.json"""
import json, csv, os
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, '../../data/raw/emotion')
ours = json.load(open(os.path.join(H, '../emotions/emotions.json')))['emotions']
nrc = {}
for ln in open(os.path.join(R, 'nrc_vad/NRC-VAD-Lexicon-v2.1/NRC-VAD-Lexicon-v2.1.txt')).read().splitlines()[1:]:
    t, v, a, d = ln.split('\t'); nrc[t] = ((float(v) + 1) / 2, (float(a) + 1) / 2, (float(d) + 1) / 2)   # -1..1 -> 0..1
war = {}
for r in csv.DictReader(open(os.path.join(R, 'warriner.csv'))):
    war[r['Word']] = tuple((float(r[k]) - 1) / 8 for k in ('V.Mean.Sum', 'A.Mean.Sum', 'D.Mean.Sum'))
ck = json.load(open(os.path.join(R, 'ck_appraisal.json')))['emotions']
# our id -> lexicon words (several allowed) and Cowen-Keltner category
MAP = {'neutral': (['neutral'], None), 'calm': (['calm'], 'Calmness'), 'curious': (['curious'], 'Interest'), 'delighted': (['delighted'], 'Joy'),
 'uneasy': (['uneasy'], 'Anxiety'), 'dazed': (['dazed'], 'Confusion'), 'given_up': (['hopeless', 'resigned'], 'Disappointment'), 'sleep': (['asleep', 'sleepy'], None),
 'alarm': (['alarmed'], 'Fear'), 'content': (['content'], 'Satisfaction'), 'joyful': (['joyful'], 'Joy'), 'absorbed': (['absorbed', 'engrossed'], 'Entrancement'),
 'bored': (['bored'], 'Boredom'), 'restless': (['restless'], None), 'anxious': (['anxious'], 'Anxiety'), 'frustrated': (['frustrated'], 'Anger'), 'sad': (['sad'], 'Sadness'),
 'lonely': (['lonely'], None), 'proud': (['proud'], 'Pride'), 'relieved': (['relieved'], 'Relief'), 'embarrassed': (['embarrassed'], 'Awkwardness'), 'drowsy': (['drowsy', 'sleepy'], None)}
def avg(ws, lex):
    f = [lex[w] for w in ws if w in lex]
    return tuple(sum(x[i] for x in f) / len(f) for i in range(3)) if f else None
rows, out = [], {}
for k, e in ours.items():
    p = e['prototype']; ws, c = MAP.get(k, ([k], None))
    n, w = avg(ws, nrc), avg(ws, war)
    cv = ck.get(c) if c else None
    ckv = ((cv['Valence'] - 1) / 8, (cv['Arousal'] - 1) / 8, (cv['Dominance'] - 1) / 8) if cv else None
    ref = [x for x in (n, w, ckv) if x]
    mean = tuple(round(sum(x[i] for x in ref) / len(ref), 2) for i in range(3)) if ref else None
    out[k] = {'ours': [p['valence'], p['arousal'], p['dominance']], 'nrc': n, 'warriner': w, 'cowen_keltner': ckv, 'data_mean': mean}
    gap = max(abs(a - b) for a, b in zip((p['valence'], p['arousal'], p['dominance']), mean)) if mean else None
    rows.append((k, p, n, w, ckv, mean, gap))
fmt = lambda t: '  -  ' if not t else ' '.join(f'{x:.2f}' for x in t)
print('emotion        ours(V A D)    NRC            Warriner       CowenKeltner   data mean      max gap')
for k, p, n, w, c, m, g in rows:
    print(k.ljust(13), fmt((p['valence'], p['arousal'], p['dominance'])), '|', fmt(n), '|', fmt(w), '|', fmt(c), '|', fmt(m), '|', '' if g is None else f'{g:.2f}' + ('  <-- check' if g > .25 else ''))
used = {c for _, c in MAP.values() if c}
print('\nCowen-Keltner categories we have no emotion for:', ', '.join(sorted(set(ck) - used)))
json.dump(out, open(os.path.join(H, 'emotion_audit.json'), 'w'), indent=1)
