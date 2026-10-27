'use strict';
// NOGGIN v3.5.0 Q1: merge the new estimation questions and Higher-or-Lower facts into
// data/close-call.json and data/higher-lower.json. Safe to re-run: earlier v35 items
// are replaced, and existing items are only tagged, never removed.
//   node tools/make-v350-brain-content.js
const fs = require('node:fs');
const path = require('node:path');
const {closeCall, higherLower} = require('./v350-brain-content');
const dataDir = path.resolve(__dirname, '../data');
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const write = (name, rows) => fs.writeFileSync(path.join(dataDir, name), JSON.stringify(rows, null, 2) + '\n');

// Old items are exact unit conversions or sums: keep them only as a fallback pool.
const tagOld = rows => rows.filter(x => !x.id.startsWith('v35-')).map(x => x.kind ? x : {...x, kind: 'arithmetic'});

const cc = tagOld(read('close-call.json'));
closeCall.forEach(([question, answer, unit, source], i) => {
  if (!Number.isInteger(answer) || answer < 0 || answer > 100_000_000) throw new Error(`Close Call answer must be a whole number: ${question}`);
  cc.push({id: `v35-cc-${String(i + 1).padStart(3, '0')}`, question, answer, unit, source, verified: 'needs-owner-check', kind: 'estimate'});
});
write('close-call.json', cc);

const hl = tagOld(read('higher-lower.json'));
let added = 0;
for (const [group, [unit, items]] of Object.entries(higherLower)) {
  items.forEach(([label, value, source], i) => {
    if (!Number.isFinite(value)) throw new Error(`Bad value: ${label}`);
    hl.push({id: `v35-hl-${group}-${String(i + 1).padStart(2, '0')}`, label, value, unit, source, verified: 'needs-owner-check', group, kind: 'fact'});
    added++;
  });
}
write('higher-lower.json', hl);
console.log(`close-call.json: ${cc.length} (${closeCall.length} estimation questions) · higher-lower.json: ${hl.length} (${added} facts in ${Object.keys(higherLower).length} groups)`);
