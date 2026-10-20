# Pose QC sheet: every MV pose from four sides (stills from `stage.mjs --qc`) -> <out>/pose_qc.png
import sys, os, glob
from PIL import Image, ImageDraw
D = os.path.join(os.path.dirname(__file__), '../../build-cache/review/stills')
out = sys.argv[1] if len(sys.argv) > 1 else D
files = sorted(glob.glob(f'{D}/mv-Q-*.png'))
poses = []
for f in files:
    k = os.path.basename(f)[5:-4].rsplit('-', 1)[0]
    if k not in poses: poses.append(k)
W, H = 400, 225
sheet = Image.new('RGB', (W * 4 + 120, H * len(poses)), '#111')
dr = ImageDraw.Draw(sheet)
for r, k in enumerate(poses):
    dr.text((8, r * H + H // 2), k, fill='#fff')
    for c, f in enumerate(sorted(glob.glob(f'{D}/mv-Q-{k}-*.png'))):
        sheet.paste(Image.open(f).convert('RGB').resize((W, H)), (120 + c * W, r * H))
sheet.save(f'{out}/pose_qc.png'); print('pose_qc', len(poses))
