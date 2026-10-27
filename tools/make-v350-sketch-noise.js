'use strict';
// NOGGIN v3.5.0 Q4: apply Sketch accept lists / duplicate fixes and Noise key-noun aliases.
//   node tools/make-v350-sketch-noise.js
const fs = require('node:fs');
const path = require('node:path');
const {canon} = require('../server/answer-match');
const sketchFix = require('./v350-sketch-content');
const noiseAliases = require('./v350-noise-aliases');
const data = name => path.resolve(__dirname, '../data', name);
const load = name => JSON.parse(fs.readFileSync(data(name), 'utf8'));
const save = (name, rows) => fs.writeFileSync(data(name), JSON.stringify(rows, null, 2) + '\n');

// ---- Sketch
let sketch = load('sketch-words.json');
sketch = sketch.map(x => {
  let word = sketchFix.respace[x.word] || x.word, category = x.category;
  const swap = sketchFix.replace[x.id] || sketchFix.replaceByWord[x.word];
  if (swap) [word, category] = swap;
  const next = {id: x.id, word, category};
  const alts = (sketchFix.accept[word] || []).filter(a => canon(a) !== canon(word));
  if (alts.length) next.accept = alts;
  return next;
});
const seen = new Map();
for (const x of sketch) {
  const k = canon(x.word);
  if (seen.has(k)) throw new Error(`Duplicate sketch prompt: ${x.word} (${seen.get(k)} and ${x.id})`);
  seen.set(k, x.id);
}
const words = new Set(sketch.map(x => x.word));
for (const key of Object.keys(sketchFix.accept)) if (!words.has(key)) throw new Error(`Accept list for missing word ${key}`);
save('sketch-words.json', sketch);

// ---- Noise
const noise = load('noise-clues.json').map(x => {
  const list = noiseAliases[x.id];
  if (!list) throw new Error(`No key-noun aliases for ${x.id}: ${x.clue}`);
  return {...x, aliases: list.split('|').map(a => a.trim().toLowerCase()).filter(Boolean)};
});
save('noise-clues.json', noise);
console.log(`sketch-words.json: ${sketch.length} prompts, ${sketch.filter(x => x.accept).length} with accept lists · noise-clues.json: ${noise.length} clues, all with key-noun aliases`);
