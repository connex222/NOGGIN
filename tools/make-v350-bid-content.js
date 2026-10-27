'use strict';
// NOGGIN v3.5.0 Q7: rebuild data/bid-categories.json from tools/v350-bid-content.js.
// Removes trivial or vague categories, expands everyday ones to 40+ answers, adds
// new checkable ones, and refreshes the Bid rows of the editorial review queue.
//   node tools/make-v350-bid-content.js
const fs = require('node:fs');
const path = require('node:path');
const {removed, kept, added} = require('./v350-bid-content');
const {normalise} = require('../server/bid-answers');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'data/bid-categories.json');
const current = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(current.map(x => [x.id, x]));
const MIN_OPEN = 40;

const accounted = new Set([...Object.keys(removed), ...kept.map(x => x.id), ...added.map(x => x.id)]);
const unaccounted = current.filter(x => !accounted.has(x.id) && !x.id.startsWith('v35-'));
if (unaccounted.length) throw new Error(`Decide keep/remove for: ${unaccounted.map(x => x.id).join(', ')}`);

function check(cat) {
  const seen = new Map();
  for (const a of cat.answers) {
    const k = normalise(a);
    if (seen.has(k)) throw new Error(`${cat.id}: duplicate answer ${a}`);
    seen.set(k, a);
  }
  for (const [answer, list] of Object.entries(cat.aliases || {})) {
    if (!cat.answers.includes(answer)) throw new Error(`${cat.id}: alias key "${answer}" is not an answer`);
    for (const alias of list) {
      const k = normalise(alias);
      if (seen.has(k) && seen.get(k) !== answer) throw new Error(`${cat.id}: alias "${alias}" clashes with "${seen.get(k)}"`);
      seen.set(k, answer);
    }
  }
  if (cat.kind === 'open' && cat.answers.length < MIN_OPEN) throw new Error(`${cat.id}: open category needs ${MIN_OPEN}+ answers (has ${cat.answers.length})`);
}

const out = [];
for (const cat of [...kept, ...added]) {
  check(cat);
  const old = byId.get(cat.id) || {};
  const row = {...old, id: cat.id, prompt: cat.prompt, answers: cat.answers, kind: cat.kind,
    review: true, editorialStatus: 'review-pending', verified: 'needs-owner-check'};
  if (cat.aliases) row.aliases = cat.aliases; else delete row.aliases;
  out.push(row);
}
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

// Refresh the Bid rows in the editorial queue (other banks are untouched).
const queueFile = path.join(root, 'docs/editorial/RELEASE-REVIEW-QUEUE.csv');
const raw = fs.readFileSync(queueFile, 'utf8');
const bom = raw.startsWith('\uFEFF') ? '\uFEFF' : '';
const lines = raw.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
const header = lines[0], others = lines.slice(1).filter(l => !l.startsWith('bid-categories,'));
const q = v => `"${String(v).replace(/"/g, '""')}"`;
const bidRows = out.map(c => ['bid-categories', c.id, c.kind === 'open' ? 'open-ended accepted-answer set' : 'closed fixed set', q(c.prompt), q(JSON.stringify(c.answers)), c.kind === 'open' ? 'medium' : 'low',
  q(c.kind === 'open' ? 'Check accepted answers, aliases and UK wording; unlisted answers are judged in play' : 'Check the list is complete and correct'), 'pending', '', ''].join(','));
fs.writeFileSync(queueFile, bom + [header, ...others, ...bidRows].join('\n') + '\n');

const open = out.filter(c => c.kind === 'open'), closed = out.filter(c => c.kind === 'closed');
console.log(`bid-categories.json: ${out.length} categories (${closed.length} closed, ${open.length} open; smallest open list ${Math.min(...open.map(c => c.answers.length))}). Removed ${Object.keys(removed).length}.`);
