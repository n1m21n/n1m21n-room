#!/usr/bin/env python3
"""Builds site/public/about/index.html from the sim's own data files (so the page never drifts from the code).
Run: python3 tools/about/build_about.py"""
import json, os
R = os.path.join(os.path.dirname(__file__), '..', '..')
E = os.path.join(R, 'tools', 'emotions')
J = lambda *p: json.load(open(os.path.join(*p)))
emo = J(E, 'emotions.json')['emotions']
neuro = J(E, 'neuro.json'); led = J(E, 'ledger_events.json'); ch = J(E, 'chains.json')
haz = J(E, 'hazards.json'); out = J(E, 'outcomes.json'); act = J(E, 'activities.json')['activities']
stab = J(E, 'stability.json'); tune = J(E, 'tune.json')
midi = len([f for f in os.listdir(os.path.join(R, 'site', 'public', 'media', 'midi')) if f.endswith('.mid')])
cats = {}
for a in act.values(): cats[a['category']] = cats.get(a['category'], 0) + 1
D = {
  'emotions': [{'n': k, 'v': v['prototype']['valence'], 'a': v['prototype']['arousal'], 's': v['prototype']['stress'], 'e': v['prototype']['energy'], 'd': v['prototype']['dominance'], 'm': v['margin'], 'new': not v.get('existing')} for k, v in emo.items()],
  'neuro': [{'k': k, 'name': v['name'], 'role': v['role'], 'base': v['base'], 'tau': v['tau']} for k, v in neuro['vars'].items()],
  'affect': neuro['affect'], 'effects': neuro['effects'], 'cube': neuro['lovheimCube']['corners'], 'lovheim': neuro['lovheimCube'].get('lovheim', {}),
  'traces': {k: v['tau'] for k, v in led['traces'].items()}, 'kw': led['kindWeight'],
  'events': [{'n': k, 'kind': v['kind'], 'd': v.get('deltas', {}), 'nu': v.get('neuro', {})} for k, v in led['events'].items()],
  'chains': [{'n': k, 'kind': v['kind'], 'steps': [s['act'] if isinstance(s, dict) else s for s in v['steps']]} for k, v in ch['chains'].items()],
  'haz': [{'n': k, 'h0': v.get('h0', 0), 'ks': v.get('kStress', 0), 'kf': v.get('kFatigue', 0), 'trig': v.get('trigger', ''), 'req': v.get('requires', '')} for k, v in haz['events'].items()],
  'outcomes': {k: v['p'] for k, v in out['categories'].items()}, 'oscale': out['scale'],
  'cats': cats, 'nActs': len(act), 'decay': tune['decay'], 'midi': midi,
  'regimes': {k: {'sigma': v['sigmaMul'], 'hours': v['hours']} for k, v in stab['regimes'].items()},
  'stages': {k: {'sigma': v['sigma0'], 'tau': v['wobbleTau'], 'clamp': v['gainClamp']} for k, v in stab['stages'].items()},
}
tpl = open(os.path.join(os.path.dirname(__file__), 'about.tpl.html')).read()
html = tpl.replace('/*DATA*/null', json.dumps(D, separators=(',', ':')))
dst = os.path.join(R, 'site', 'public', 'about'); os.makedirs(dst, exist_ok=True)
open(os.path.join(dst, 'index.html'), 'w').write(html)
print('about page', len(html) // 1024, 'KB;', len(D['emotions']), 'emotions,', D['nActs'], 'acts,', len(D['chains']), 'chains,', midi, 'midi')
