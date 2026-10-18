"""Pull act durations toward the real ATUS episode median of their class (blend 0.5 with the hand value). Rerunnable: keeps the hand value in baseMinutesHand.
Only 1:1 acts (one act stands for the class); persona acts, micro-acts and composite classes are left alone."""
import json, os
H = os.path.dirname(os.path.abspath(__file__)); P = os.path.join(H, '../emotions/activities.json')
fit = json.load(open(os.path.join(H, 'atus_fit.json')))['duration_min']
d = json.load(open(P)); A = d['activities']
ONE = {'tv': 'tv', 'read': 'read', 'work': 'work', 'work_through': 'work', 'phone_call': 'phone', 'gather': 'chores', 'snake': 'game', 'greet_visitor': 'social', 'cook': 'cook', 'write_letter': 'write'}
for a, c in ONE.items():
    if a not in A: continue
    hand = A[a].setdefault('baseMinutesHand', A[a]['baseMinutes'])
    A[a]['baseMinutes'] = round(0.5 * hand + 0.5 * fit[c]['median'], 1)
    A[a]['durationSource'] = f'blend 0.5 hand {hand} + ATUS {c} median {fit[c]["median"]}'
    print(a, hand, '->', A[a]['baseMinutes'])
json.dump(d, open(P, 'w'), indent=1)
