const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const get = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', `${name}.json`), 'utf8'));
for (const [name, primary, max] of [['sketch-words', 'word', 500], ['unscramble', 'word', 350], ['noise-clues', 'clue', 250]]) {
  test(`Batch 7 ${name}: original prompts, stable IDs and format`, () => {
    const bank = get(name);
    const added = bank.filter(x => x.id.startsWith('p6b7-'));
    assert.ok(added.length > 0);
    assert.ok(bank.length <= max, `Original target exceeded for ${name}`);
    const prompts = new Set();
    for (const entry of bank) {
      const norm = entry[primary].trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');
      assert.ok(!prompts.has(norm), `Duplicate prompt: ${norm}`);
      prompts.add(norm);
    }
    for (const entry of added) {
      assert.ok(entry[primary].trim().length > 2);
      if (name === 'unscramble') {
        assert.match(entry.word, /^[A-Z]{6,8}$/);
        assert.ok(entry.category.trim());
      } else if (name === 'sketch-words') {
        assert.ok(entry.category.trim());
      } else {
        assert.ok(Array.isArray(entry.aliases));
      }
    }
  });
}
