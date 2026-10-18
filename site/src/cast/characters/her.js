// Her. Everything that makes her herself, in one light file (the heavy parts load when she is first brought in): her look (her.js), her sim and
// body rhythm (tools/emotions/characters/her.json -> characters.gen.js), her voice (her-thought-lines.js), her prop (cast/props/her.js).
// To add someone else, copy this file (or run `node tools/cast/new_character.mjs <id>`): see .claude/skills/add-room-character/SKILL.md
import { CHARACTERS } from '../../sim/data/characters.gen.js';

export default {
  id: 'her',
  name: 'her',
  label: 'meet her',
  profile: CHARACTERS.her,                                       // seed, emotional baselines, act set and motion (the rhythm of her body)
  look: async () => (await import('../../her.js')).loadHer(),    // -> the puppet (man.js loadMan, dressed)
  lines: () => import('../../her-thought-lines.js'),             // her voice for thought bubbles
  props: async () => (await import('../props/her.js')).herBook,   // (man, player, READ) -> update(); her own book
  life: { file: '/sim/life.her.json', offsetMs: 211e3 },         // her checkpoint file; her beats and breaks run a few minutes off his
  spawn: { at: [3.0, 1.6], heading: -Math.PI / 2 },              // she walks in at the door
  bedOffset: 0.3,
  likes: { write: 'work', phone: 'window', nap: 'read', bench: 'window', plant: 'roam', easel: 'roam', greet: 'roam', answer: 'window' },   // acts she has no spot for: the nearest thing
  away: ['eat', 'cook', 'tea', 'fridge', 'shower', 'brush', 'wash', 'loo', 'dress', 'night_shower'],                                     // she steps out of the room for these (no props for them yet)
  standIn: ['window', 'roam', 'pace', 'dance', 'records'],       // what she does when he holds the seat she wants
  bubble: { every: 28, hold: 6.5, tint: '#E0368F' },             // a line every ~28 s (his is 20), a pink shadow
  intro: 'she lives her own day in the same room, on the same india clock for everyone. calmer than him: more reading, more window, less desk.',
};
