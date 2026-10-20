# Choke key sheet: the six escalation keys (VI) plus the VI-3 pose from four sides, each with its overlap check in mm
# (contact.js report: into = snake inside him / the stool, his = him inside the snake, self = snake inside itself).
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheet import ST, OUT, font, still
from PIL import Image, ImageDraw
qc = json.load(open(ST + 'epm-qc-r2.json'))
rows = [("VI-1", "climbs his back from the floor"), ("VI-2", "head round his neck"), ("VI-3", "the loop closes, hands on it"),
        ("VI-5", "tighter, head back"), ("VI-6", "b96 hold"), ("VI-7", "lets go"),
        ("C-front", "VI-3 front"), ("C-side", "VI-3 side"), ("C-back", "VI-3 back"), ("C-low", "VI-3 low"),
        ("III-2", "ankles tied to the stool"), ("III-4", "the tie, his left")]
W, IH, pad = 600, 338, 18; cols = 3; F = font(22); FB = font(26, True)
img = Image.new('RGB', (cols * W + (cols + 1) * pad, 90 + 4 * (IH + 80)), '#0A0618'); d = ImageDraw.Draw(img)
d.text((pad, 24), "EK PINJARE MAI r2   choke + tie keys   overlap check in mm (0 = no part of the snake inside him, the stool or itself)", font=FB, fill='white')
for i, (sid, what) in enumerate(rows):
    x = pad + (i % cols) * (W + pad); y = 80 + (i // cols) * (IH + 80)
    img.paste(still(sid).resize((W, IH)), (x, y)); q = qc.get(sid, {})
    worst = max(q.get('into', 0), q.get('his', 0), q.get('self', 0))
    d.rectangle([x, y, x + W, y + IH], outline='#3DDC84' if worst == 0 else '#FF2E4A', width=4)
    d.text((x, y + IH + 6), f"{sid}  {what}", font=FB, fill='white')
    d.text((x, y + IH + 40), f"into {q.get('into', '-')}  his {q.get('his', '-')}  self {q.get('self', '-')}  stretch {q.get('stretch', '-')}", font=F, fill='#3DDC84' if worst == 0 else '#FF2E4A')
img.save(OUT + 'epm_choke_keys.png'); print(img.size)
