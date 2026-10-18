#!/usr/bin/env node
// Scaffold a new character for the room: node tools/cast/new_character.mjs <id> [--name=..] [--skin=#hex] [--top=#hex] [--pants=#hex] [--hair=#hex]
// Writes (nothing is overwritten):
//   tools/emotions/characters/<id>.json   her-style tuning: seed, emotional baselines, act set, body rhythm (motion)
//   site/src/cast/characters/<id>.js      the spec the cast picks up by itself (a button appears in the top bar)
//   site/src/cast/looks/<id>.js           a starter look (his puppet, your colours); replace with real art
//   site/src/cast/lines/<id>.js           starter thought lines (copy of his shape, to be rewritten in the character's voice)
// then: gen.py, make_life --char=<id>, build, tests/cast.mjs. See .claude/skills/add-room-character/SKILL.md
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2), id = args.find(a => !a.startsWith('--'));
const opt = (k, d) => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
if (!id || !/^[a-z][a-z0-9_]*$/.test(id)) { console.error('usage: new_character.mjs <id: lowercase letters, digits, _> [--name= --skin= --top= --pants= --hair=]'); process.exit(1); }
const name = opt('name', id), skin = opt('skin', '#E8B48F'), top = opt('top', '#3A8F8A'), pants = opt('pants', '#2B2F55'), hair = opt('hair', '#2A1A12');
const seed = parseInt(createHash('sha1').update(id).digest('hex').slice(0, 6), 16);
const Cap = id[0].toUpperCase() + id.slice(1);
const put = (rel, body) => { const p = join(root, rel); if (existsSync(p)) { console.log('exists, left alone:', rel); return; } mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); console.log('wrote', rel); };

const her = JSON.parse(readFileSync(join(root, 'tools/emotions/characters/her.json'), 'utf8'));
const tune = { ...her.tune }, neuro = JSON.parse(JSON.stringify(her.neuro));
put(`tools/emotions/characters/${id}.json`, JSON.stringify({
  doc: `${name}: an extra character. tune/neuro are overrides on tune.json and neuro.json (their emotional tuning, starting from the flatmate's); actOff/actMul/emotionPull shape their act set; motion is their body rhythm (1 = as he moves). gen.py bakes this into characters.gen.js. Retune, then: python3 tools/emotions/gen.py && node tools/sim/make_life.mjs --char=${id}`,
  name: id, seed, tune, neuro, actOff: [], actMul: {}, emotionPull: {},
  motion: { walk: 1, cadence: 1, swing: 1, sway: 1, bounce: 1, lean: 0, shoulders: 0, headTilt: 0, breath: 1, expressive: 1, glance: 1, blink: 1, tempo: 1, face: { valence: 0, arousal: 0 } },
}, null, 1) + '\n');

put(`site/src/cast/characters/${id}.js`, `// ${name}. Everything that makes them themselves, in one light file (the heavy parts load when they are first brought in).
// See her.js for a fully worked one and .claude/skills/add-room-character/SKILL.md for what each field does.
import { CHARACTERS } from '../../sim/data/characters.gen.js';

export default {
  id: '${id}',
  name: '${name}',
  label: 'meet ${name}',
  profile: CHARACTERS.${id},                                       // tools/emotions/characters/${id}.json
  look: async () => (await import('../looks/${id}.js')).load${Cap}(),
  lines: () => import('../lines/${id}.js'),                        // their voice for thought bubbles
  life: { file: '/sim/life.${id}.json', offsetMs: ${100e3 + (seed % 400) * 1000} },   // their checkpoint file; their beats run a little off everyone else's
  spawn: { at: [3.0, 1.6], heading: -Math.PI / 2 },                // walks in at the door
  bedOffset: -0.3,
  likes: { write: 'work', phone: 'window', nap: 'read', bench: 'window', plant: 'roam', easel: 'roam', greet: 'roam', answer: 'window' },
  away: ['eat', 'cook', 'tea', 'fridge', 'shower', 'brush', 'wash', 'loo', 'dress', 'night_shower'],
  standIn: ['window', 'roam', 'pace', 'records'],
  bubble: { every: 26, hold: 6, tint: '${top}' },
  intro: 'a few lines about who they are, shown on their card.',
};
`);
put(`site/src/cast/looks/${id}.js`, `// ${name}'s look: a starter (his puppet in other colours). Make it theirs: hair (see her.js makeHerHair), face texture (herFaceTex), clothes (her.js jacket / tank), props.
import { loadMan } from '../../man.js';

export async function load${Cap}() {
  return loadMan({
    look: {
      skin: ['${skin}', { shadeCol: '#9A5C48', shade: 1, ink: 0.011 }],
      ear: ['${skin}', { shadeCol: '#9A5C48', shade: 1, ink: 0.008 }],
      tee: ['${top}', { shadeCol: '#1B3F3D', shade: 0.42, ink: 0.013 }],
      pants: ['${pants}', { shadeCol: '#161830', shade: 1, ink: 0.012 }],
      hair: ['${hair}', { shadeCol: '#0B0820', shade: 0.6, ink: 0.014, twoSided: true }],
    },
  });
}
`);
put(`site/src/cast/lines/${id}.js`, `// ${name}'s thought lines: same exports as site/src/thought-lines.js (his) and site/src/her-thought-lines.js. Rewrite every line in their own voice;
// only use a real person's words with their agreement, and write original lines in their manner rather than quoting messages.
export { NEED_LINES, NEED_FIX, EMOTION_LINES, NEXT_LINES, DAY_THOUGHTS, ACT_LINES, TIME_LINES, hourBucket, SELF_LINES } from '../../her-thought-lines.js';
`);
console.log(`\nnext:\n  PYTHONPATH=tools/emotions python3 -s tools/emotions/gen.py\n  node tools/sim/make_life.mjs --char=${id} --blocks=13\n  cd site && npm run build && node tests/cast.mjs`);
