// Chat commands (core, shared by the stream page, the website and the server; pure: no DOM, no three.js, so tests/stream.mjs runs it in node). What a viewer types becomes a note
// on his desk. Every command maps to one of his acts: `spot` is the routine spot he goes to, `secs` how long he keeps at it, `nudge`
// the whitelisted act (functions/api/nudge.js) a chat request leans the shared life toward, and `lines` what he says when he reads
// the note. {name} is the viewer. Nothing a viewer types is ever shown back verbatim except their name (cleaned).

export const COMMANDS = {
  tea:     { spot: 'tea', secs: 35, nudge: 'tea', hint: 'tea', lines: ['{name} says tea. fair, kettle is on.', 'chat wants tea. say no more.', 'tea, yes. thank you {name}.'] },
  synth:   { spot: 'keys', secs: 50, nudge: 'keys', hint: 'synth', alias: ['keys', 'music', 'piano', 'keyboard'], lines: ['{name} asked about the synth: it is an analog model patch. let me play it.', 'chat wants the synth. one sec.', 'okay {name}, keys it is.'] },
  guitar:  { spot: 'guitar', secs: 45, nudge: 'guitar', hint: 'guitar', alias: ['riff'], lines: ['guitar, from {name}. fingers are ready.', 'chat asked for a riff. fine.', 'picking it up for {name}.'] },
  art:     { spot: 'easel', secs: 50, nudge: 'art_refine', hint: 'art', alias: ['paint', 'draw', 'easel'], lines: ['{name} wants to see some art. going to the easel.', 'chat says paint. needs more magenta anyway.', 'art, yes. {name} has taste.'] },
  read:    { spot: 'read', secs: 35, nudge: 'read', hint: 'read', alias: ['book', 'books'], lines: ['a book, says {name}. good idea.', 'chat wants me to read. fine, one chapter.', 'reading for {name}.'] },
  tv:      { spot: 'tv', secs: 30, nudge: 'tv', hint: 'tv', alias: ['telly', 'movie'], lines: ['{name} wants the tv on. okay.', 'chat says tv. just for a bit.', 'tv time, thanks {name}.'] },
  records: { spot: 'records', secs: 25, nudge: 'records', hint: 'records', alias: ['record', 'vinyl'], lines: ['{name} asked for a record. flipping through.', 'vinyl, chat? good call.', 'let me find something warm, {name}.'] },
  snake:   { spot: 'snake', secs: 20, nudge: 'snake', hint: 'snake', alias: ['pet'], lines: ['{name} says go say hi to the snake.', 'chat wants snake time. same.', 'sss. for {name}.'] },
  window:  { spot: 'window', secs: 25, nudge: 'window', hint: 'window', alias: ['outside', 'sky'], lines: ['{name} says look outside. okay.', 'chat wants a view. one minute.', 'window break, from {name}.'] },
  work:    { spot: 'work', secs: 40, nudge: 'work', hint: 'work', alias: ['code', 'desk'], lines: ['chat says work. {name}, rude. but fair.', 'back to the desk, then.', 'one commit for {name}.'] },
  cook:    { spot: 'cook', secs: 35, nudge: 'cook', hint: 'cook', alias: ['kitchen'], lines: ['{name} wants me to cook. what am i making?', 'chat says cook. okay chef.', 'cooking for {name}.'] },
  eat:     { spot: 'eat', secs: 30, nudge: 'eat', hint: 'eat', alias: ['food'], lines: ['{name} says eat. good reminder.', 'chat is hungry on my behalf.', 'sitting down to eat, thanks {name}.'] },
  fridge:  { spot: 'fridge', secs: 15, nudge: 'fridge', hint: 'snack', alias: ['snack'], lines: ['a snack, says {name}. yes.', 'fridge run for chat.', 'anything sweet in there, {name}?'] },
  plant:   { spot: 'plant', secs: 25, nudge: 'water_plant', hint: 'plant', alias: ['monstera'], lines: ['{name} says water the plant. she is thirsty.', 'chat cares about the monstera. same.', 'plant first, then me.'] },
  call:    { spot: 'phone', secs: 35, nudge: 'phone_call', hint: 'call', alias: ['phone'], lines: ['{name} wants me to call someone. okay.', 'chat says call. fine, one call.', 'dialing for {name}.'] },
  wash:    { spot: 'wash', secs: 15, nudge: 'wash', hint: 'wash', alias: ['face'], lines: ['chat says wash my face. rude, but yes.', '{name} thinks i need a wash. fair.'] },
  brush:   { spot: 'brush', secs: 20, nudge: 'brush', hint: 'brush', alias: ['teeth'], lines: ['{name} says brush. yes mom.', 'chat is judging my teeth.'] },
  dress:   { spot: 'dress', secs: 15, nudge: 'dress', hint: 'outfit', alias: ['outfit', 'clothes'], lines: ['{name} wants a new look. let me see.', 'outfit change for chat.'] },
  letter:  { spot: 'write', secs: 30, nudge: null, hint: 'letter', alias: ['write'], lines: ['{name} says write a letter. to who?', 'chat wants words on paper.'] },
  stretch: { spot: 'stretch', secs: 6, nudge: null, hint: 'stretch', alias: ['yawn'], lines: ['chat says stretch. oh, yes.', '{name} noticed i am hunched. thanks.'] },
  water:   { spot: 'sip', secs: 6, nudge: null, hint: 'water', alias: ['drink', 'sip'], lines: ['chat told me to drink water... good reminder.', '{name} says drink water. okay okay.'] },
  pace:    { spot: 'pace', secs: 18, nudge: null, hint: 'pace', alias: ['walk'], lines: ['{name} thinks i need to move. fair.', 'pacing for chat.'] },
  roam:    { spot: 'roam', secs: 22, nudge: null, hint: 'roam', alias: ['wander', 'explore'], lines: ['wandering about, for {name}.', 'chat wants a tour of my room.'] },
  play:    { spot: 'records', secs: 25, nudge: 'records', hint: 'play <song>', lines: ['{name} asked for a song. flipping through the records.'] },       // !play <song>: the stream's player cues it
  ask:     { spot: 'glance', secs: 6, nudge: null, lines: ['…'] },                   // a viewer's question: he reads the note and answers (arg = index in ASKS)
  // answered with a line and no act
  loo:     { spot: null, lines: ['{name}. no.', 'chat, that is private.'] },
  shower:  { spot: null, lines: ['not on camera, {name}.', 'a shower? chat is bold today.'] },
  sleep:   { spot: null, lines: ['not sleepy yet, {name}.', 'bed can wait.'] },
};
const ALIAS = {}; for (const [k, c] of Object.entries(COMMANDS)) { if (k === 'ask') continue; ALIAS[k] = k; for (const a of c.alias || []) ALIAS[a] = k; }
export const HINTS = Object.values(COMMANDS).filter(c => c.spot && c.hint).map(c => c.hint);       // what the overlay teaches viewers to type

// what he says to a plain question or hello (no !), by keyword; first match wins
const ASKS = [
  [/\b(synth|keys?|keyboard|patch)\b/i, 'someone in chat asked about the synth: it is an analog model patch.'],
  [/\b(song|track|music|playing|midi)\b/i, 'the music comes off my midi shelf, picked by how i feel right now.'],
  [/\b(tea|chai)\b/i, 'ginger and black tea, mostly.'],
  [/\b(who|name)\b/i, 'naman. n1m21n.'],
  [/\b(where|city|country)\b/i, 'my room, india time.'],
  [/\b(snake)\b/i, 'the snake keeps me, not the other way round.'],
  [/\b(hi|hello|hey|namaste)\b/i, 'hey {name}, welcome in.'],
];

export const cleanName = n => String(n || 'someone').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().split(/\s+/)[0].slice(0, 14) || 'someone';

// text -> { cmd } for !tea style, { ask } for a question or hello, or null
export function parse(text) {
  const t = String(text || '').trim().slice(0, 200);
  const m = /^[!/]([a-z]{2,12})\b/i.exec(t);
  if (m) {
    const cmd = ALIAS[m[1].toLowerCase()]; if (!cmd) return null;
    if (cmd === 'play') { const arg = t.slice(m[0].length).replace(/[^\p{L}\p{N} '&?!.,-]/gu, '').trim().slice(0, 40); return arg.length >= 3 ? { cmd, arg } : null; }
    return { cmd };
  }
  if (t.length < 3 || t.length > 120) return null;
  if (/\?/.test(t) || /^(hi|hello|hey|namaste)\b/i.test(t)) { const i = ASKS.findIndex(([re]) => re.test(t)); if (i >= 0) return { ask: ASKS[i][1], askId: i }; }
  return null;
}

export const askText = i => ASKS[+i]?.[1] || '…';
const fill = (s, name) => s.replaceAll('{name}', name);
export function replyFor(note, rnd = Math.random) {
  if (note.ask) return fill(note.ask, note.name);
  const l = COMMANDS[note.cmd].lines; return fill(l[Math.floor(rnd() * l.length)], note.name);
}

// the pile of notes on his desk. One note per viewer at a time, the same command from several viewers stacks as votes (×3), a viewer
// waits `cooldown` between notes, and the pile holds at most `max`. next() takes the most voted, oldest first.
export function makeQueue({ max = 6, cooldown = 20000, now = Date.now } = {}) {
  const notes = [], last = new Map(); let seq = 0;
  function offer({ user, name, text }) {
    const p = parse(text); if (!p) return { ok: false, why: 'ignored' };
    const who = String(user || name || 'anon').slice(0, 64), nm = cleanName(name), t = now();
    if (t - (last.get(who) || 0) < cooldown) return { ok: false, why: 'cooldown' };
    const key = (p.cmd || p.ask) + (p.arg ? ':' + p.arg.toLowerCase() : ''), dup = notes.find(n => ((n.cmd || n.ask) + (n.arg ? ':' + n.arg.toLowerCase() : '')) === key);
    if (dup) { if (dup.voters.has(who)) return { ok: false, why: 'again' }; dup.voters.add(who); dup.votes++; last.set(who, t); return { ok: true, note: dup, stacked: true }; }
    if (notes.length >= max) return { ok: false, why: 'full' };
    const note = { id: ++seq, ...p, name: nm, votes: 1, voters: new Set([who]), t };
    notes.push(note); last.set(who, t); return { ok: true, note };
  }
  function next() {
    if (!notes.length) return null;
    let best = 0; notes.forEach((n, i) => { if (n.votes > notes[best].votes) best = i; });
    return notes.splice(best, 1)[0];
  }
  return { offer, next, get notes() { return notes; }, get size() { return notes.length; } };
}

// a note he writes himself when chat has gone quiet, so the stream never just sits there
const SELF = ['water', 'stretch', 'tea', 'window', 'plant', 'records', 'snake', 'roam'];
export function selfNote(rnd = Math.random) { return { id: -1, cmd: SELF[Math.floor(rnd() * SELF.length)], name: 'me', votes: 1, voters: new Set(), self: true }; }
export const SELF_LINES = { water: 'note to self: drink water.', stretch: 'note to self: stretch. my back.', tea: 'note to self: tea.', window: 'note to self: look up from the screen.', plant: 'note to self: the monstera.', records: 'note to self: put a record on.', snake: 'note to self: say hi to the snake.', roam: 'note to self: move a bit.' };
