// Stream engine, pure logic: chat parsing, the note queue, replies. node tests/stream.mjs
import { COMMANDS, parse, makeQueue, replyFor, cleanName, selfNote, SELF_LINES } from '../src/errands/commands.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
ok(parse('!tea').cmd === 'tea', '!tea'); ok(parse('!Synth please').cmd === 'synth', 'case + trailing'); ok(parse('!keys').cmd === 'synth', 'alias');
ok(parse('!nonsense') === null, 'unknown'); ok(!parse('just chatting') && !parse('nice room'), 'plain chat ignored');
ok(parse('what synth is that?').ask?.includes('analog'), 'question'); ok(parse('hey!').ask?.includes('{name}'), 'greeting');
ok(parse('!' + 'a'.repeat(500)) === null, 'long');
ok(cleanName('<b>Sam</b> Smith') === 'bSamb' || cleanName('<b>Sam</b> Smith').length <= 14, 'name cleaned'); ok(!/[<>&]/.test(cleanName('<img src=x onerror=1>')), 'no markup');
let now = 1e6; const q = makeQueue({ max: 3, cooldown: 1000, now: () => now });
ok(q.offer({ user: 'a', name: 'a', text: '!tea' }).ok, 'offer');
ok(q.offer({ user: 'a', name: 'a', text: '!art' }).why === 'cooldown', 'cooldown');
now += 1500; ok(q.offer({ user: 'b', name: 'b', text: '!art' }).ok, 'second');
ok(q.offer({ user: 'c', name: 'c', text: '!art' }).stacked && q.size === 2, 'stack votes');
now += 1500; ok(q.offer({ user: 'c', name: 'c', text: '!art' }).why === 'again', 'no double vote');
ok(q.offer({ user: 'd', name: 'd', text: '!read' }).ok && q.offer({ user: 'e', name: 'e', text: '!tv' }).why === 'full', 'cap');
ok(q.next().cmd === 'art', 'most voted first'); ok(q.next().cmd === 'tea', 'then oldest'); 
for (const [k, c] of Object.entries(COMMANDS)) { ok(c.lines.length > 0, k + ' lines'); if (c.spot) ok(c.secs > 0 && c.secs < 60, k + ' under a minute'); }
ok(replyFor({ cmd: 'water', name: 'sam' }).length > 5, 'reply'); ok(replyFor({ ask: 'hi {name}', name: 'sam' }) === 'hi sam', 'ask fill');
ok(SELF_LINES[selfNote(() => 0).cmd], 'self note line');
ok(parse('!play Teri Aankhon Mein').arg === 'Teri Aankhon Mein' && parse('!play') === null, '!play arg'); ok(parse('!play <script>x</script>').arg.indexOf('<') < 0, 'play arg clean');
console.log(`stream: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
