'use strict';
// NOGGIN v3.5.0 Q3: give every Unscramble word a specific category clue and an
// "accept" list of other real words made from the same letters.
//   node tools/make-v350-unscramble.js
const fs = require('node:fs');
const path = require('node:path');
const categories = require('./v350-unscramble-categories');
const accept = require('./v350-unscramble-accept.json');
const file = path.resolve(__dirname, '../data/unscramble.json');
const VAGUE = new Set(['Everyday words', 'Things and objects', 'Objects', 'Nature and space']);
const bank = JSON.parse(fs.readFileSync(file, 'utf8'));
const sorted = w => [...w].sort().join('');
let recategorised = 0;
const out = bank.map(item => {
  const next = {...item};
  if (VAGUE.has(item.category)) {
    if (!categories[item.word]) throw new Error(`No specific category for ${item.word}`);
    next.category = categories[item.word]; recategorised++;
  }
  const alts = accept[item.word] || [];
  for (const a of alts) if (sorted(a) !== sorted(item.word)) throw new Error(`${a} is not an anagram of ${item.word}`);
  if (alts.length) next.accept = alts; else delete next.accept;
  return next;
});
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
console.log(`unscramble.json: ${recategorised} clues made specific, ${out.filter(x => x.accept).length} words accept other anagrams`);
