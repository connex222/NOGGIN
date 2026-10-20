// Read-only editorial quality report: no content is removed or marked verified.
const fs = require('node:fs');
const path = require('node:path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/bid-categories.json'), 'utf8'));
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function findOverlaps(items, threshold = 0.75) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = new Set(items[i].answers.map(norm));
      const b = new Set(items[j].answers.map(norm));
      const shared = [...a].filter(s => b.has(s)).length;
      const fraction = shared / Math.min(a.size, b.size);
      if (fraction >= threshold) results.push({a: items[i].id, b: items[j].id, shared, fraction: Number(fraction.toFixed(3)), firstPrompt: items[i].prompt, secondPrompt: items[j].prompt});
    }
  }
  return results.sort((x, y) => y.fraction - x.fraction || x.a.localeCompare(y.a));
}
if (require.main === module) {
  const overlaps = findOverlaps(data);
  const report = [
    '# Bid to Win — possible repeat-content review', '',
    `Generated from ${data.length} categories. ${overlaps.length} pairs share at least 75% of the smaller answer set.`,
    'These are possible duplicates, not proof of identical categories. Do not delete entries automatically.', '',
    '| Category A | Category B | Shared answers | Overlap |', '|---|---|---:|---:|',
    ...overlaps.map(x => `| ${x.a} | ${x.b} | ${x.shared} | ${(x.fraction * 100).toFixed(1)}% |`), '',
    'Editorial priority: rewrite overlapping categories with genuinely distinct themes, then verify all acceptable answers and spelling variants.', ''
  ].join('\n');
  fs.writeFileSync(path.join(__dirname,'../docs/editorial/BID-OVERLAP-REPORT.md'), report);
  process.stdout.write(`Found ${overlaps.length} potentially overlapping pairs.\n`);
}
module.exports = {findOverlaps};
