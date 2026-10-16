"""Foley for the site: picks takes from Kenney's CC0 packs (rpg-audio, impact-sounds, interface-sounds, from kenney.nl)
and writes them as small mono mp3s to site/public/media/sfx/<name>_<n>.mp3. sfx.js plays a random take per effect and
falls back to its synth while they load. Usage: python3 tools/export_sfx.py <folder holding the unzipped packs>"""
import json, pathlib, shutil, subprocess, sys

PICK = {                                            # effect -> takes (file stems, searched across all packs)
    'step':     [f'footstep_wood_00{i}' for i in range(5)],          # the room: wooden floor
    'stephard': [f'footstep_concrete_00{i}' for i in range(5)],      # gallery halls
    'bump':     [f'impactSoft_heavy_00{i}' for i in range(5)],
    'cloth':    ['cloth1', 'cloth2', 'cloth3', 'cloth4'],
    'creak':    ['creak1', 'creak2', 'creak3'],
    'sit':      [f'impactSoft_medium_00{i}' for i in range(5)],
    'page':     ['bookFlip1', 'bookFlip2', 'bookFlip3'],
    'book':     ['bookOpen', 'bookClose'],
    'place':    ['bookPlace1', 'bookPlace2', 'bookPlace3'],
    'key':      [f'click_00{i}' for i in range(1, 6)],
    'click':    ['switch_002', 'switch_003', 'switch_004'],
    'tick':     ['tick_001', 'tick_002', 'tick_004'],
    'lamp':     ['metalClick'],
    'card':     ['open_002', 'close_002'],
    'crate':    [f'impactWood_light_00{i}' for i in range(3)],
    'doorOpen': ['doorOpen_1', 'doorOpen_2'],
    'doorShut': [f'doorClose_{i}' for i in range(1, 5)],
}

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parent.parent / 'site/public/media/sfx'
out.mkdir(parents=True, exist_ok=True)
files = {p.stem: p for p in src.rglob('*.ogg')}
counts = {}
for name, stems in PICK.items():
    for n, stem in enumerate(stems):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(files[stem]), '-ac', '1', '-ar', '44100',
                        '-af', 'silenceremove=start_periods=1:start_threshold=-50dB', '-b:a', '80k', str(out / f'{name}_{n}.mp3')], check=True)
    counts[name] = len(stems)
shutil.copy(next(src.rglob('License.txt')), out / 'LICENSE-kenney-cc0.txt')
(out / 'sfx.json').write_text(json.dumps(counts))
print(counts, sum(f.stat().st_size for f in out.glob('*.mp3')) // 1024, 'KB')
