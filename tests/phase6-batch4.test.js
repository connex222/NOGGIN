const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const plans = {
  'sketch-words': { key: 'word', count: 30 },
  'noise-clues': { key: 'clue', count: 30 },
  'unscramble': { key: 'word', count: 19 },
  'mind-categories': { key: 'category', count: 15 },
  'majority-questions': { key: 'question', count: 20 },
  'bid-categories': { key: 'prompt', count: 15 },
  'caption-scenes': { key: 'scene', count: 8 },
};
for (const [bank, spec] of Object.entries(plans)) {
  test(`Phase 6 Batch 4: ${bank} entry rules`, () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data', `${bank}.json`), 'utf8'));
    const items = data.filter(e => e.id.startsWith('p6b4-'));
    assert.equal(items.length, spec.count);
    const primary = data.map(e => String(e[spec.key]).trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' '));
    assert.equal(new Set(primary).size, data.length);
    for (const item of items) {
      assert.ok(item[spec.key] && String(item[spec.key]).trim());
      if (bank === 'unscramble') assert.ok(/^[A-Z]{6,8}$/.test(item.word));
      if (bank === 'majority-questions') assert.equal(new Set(item.options).size, 4);
      if (bank === 'bid-categories') {
        assert.equal(item.answers.length, 8);
        assert.equal(new Set(item.answers.map(a => a.toLowerCase())).size, 8);
        assert.equal(item.review, true);
      }
      if (bank === 'caption-scenes') assert.equal(item.avatars.length, 2);
      if (bank === 'noise-clues') assert.ok(Array.isArray(item.aliases));
    }
  });
}
