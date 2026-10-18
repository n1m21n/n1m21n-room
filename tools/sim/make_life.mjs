// Precompute weekly checkpoints of the canonical life -> site/public/sim/life.json
// usage: node tools/sim/make_life.mjs [--blocks=26]   (re-run after any tuning change; the file records the seed/epoch it was made with)
import { writeFileSync, mkdirSync } from 'node:fs';
import { makeSimCore } from '../../site/src/sim/core.js';
import { LIFE_SEED, LIFE_EPOCH_MS } from '../../site/src/sim/life.js';
import { HER } from '../../site/src/sim/data/her.gen.js';
const her = process.argv.includes('--her');                    // --her: her own life (tools/emotions/her.json) -> life.her.json
const blocks = +(process.argv.find(a => a.startsWith('--blocks='))?.split('=')[1] || 26);
const seed = her ? HER.seed : LIFE_SEED, c = makeSimCore({ profile: her ? HER : null, seed, withGrid: false }), snaps = [];
for (let w = 1; w <= blocks; w++) {
  c.advance(28 * 1440);
  const s = c.snapshot(); s.journal = s.journal.slice(-40); s.days = s.days.slice(-14); delete s.lastSeen; snaps.push(s);
}
mkdirSync('site/public/sim', { recursive: true });
writeFileSync(her ? 'site/public/sim/life.her.json' : 'site/public/sim/life.json', JSON.stringify({ v: 1, seed, epochMs: LIFE_EPOCH_MS, snaps }));
console.log('wrote', blocks, 'checkpoints', (JSON.stringify(snaps).length / 1024).toFixed(0), 'KB');
