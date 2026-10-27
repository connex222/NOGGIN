'use strict';
// NOGGIN v3.5.0 Q6: rebuild Buzzer Battle content — remove duplicates and the very
// easiest questions, cap planet questions at five, tag every general-knowledge question
// easy / medium / hard, add the new medium and hard questions, and refresh the
// Buzzer rows of the editorial review queue.
//   node tools/make-v350-buzzer.js
const fs = require('node:fs');
const path = require('node:path');
const {added, removed, medium, hard} = require('./v350-buzzer-content');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'data/buzzer-questions.json');
const bank = JSON.parse(fs.readFileSync(file, 'utf8')).filter(q => !q.id.startsWith('v35-'));
const ids = new Set(bank.map(q => q.id));
for (const id of [...medium, ...hard]) if (!ids.has(id)) throw new Error(`Unknown buzzer id ${id}`);
const level = id => hard.includes(id) ? 'hard' : medium.includes(id) ? 'medium' : 'easy';

const kept = bank.filter(q => !removed[q.id]).map(q => {
  const next = {...q};
  if (q.id === 'v3-buz-031') next.question = 'Which town is home to the Angel of the North?';
  if (q.topic !== 'maths') next.difficulty = level(q.id); else delete next.difficulty;
  return next;
});
const questions = new Set(kept.map(q => q.question.toLowerCase()));
const fresh = added.map(([difficulty, topic, question, answer, wrong, source], i) => {
  if (wrong.length !== 3) throw new Error(`${question}: needs exactly three wrong answers`);
  if (questions.has(question.toLowerCase())) throw new Error(`Duplicate question: ${question}`);
  questions.add(question.toLowerCase());
  const correct = i % 4, choices = [...wrong];
  choices.splice(correct, 0, answer); // spread answer positions; the server shuffles again when it asks
  if (new Set(choices.map(c => c.toLowerCase())).size !== 4) throw new Error(`${question}: choices must differ`);
  return {id: `v35-buz-${String(i + 1).padStart(3, '0')}`, question, choices, correct, topic, difficulty,
    sourceUrl: source, verified: 'needs-owner-check', review: true, editorialStatus: 'review-pending'};
});
const out = [...kept, ...fresh];
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');

// Editorial queue: drop rows for removed questions and add the new ones.
const queueFile = path.join(root, 'docs/editorial/RELEASE-REVIEW-QUEUE.csv');
const raw = fs.readFileSync(queueFile, 'utf8');
const bom = raw.startsWith('\uFEFF') ? '\uFEFF' : '';
const lines = raw.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
const q = v => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const keepLine = l => {
  if (!l.startsWith('buzzer-questions,')) return true;
  const id = l.split(',')[1];
  return !removed[id] && !id.startsWith('v35-');
};
const rows = fresh.map(x => ['buzzer-questions', x.id, 'multiple choice', q(x.question), q(x.choices[x.correct]), x.difficulty,
  q('Confirm the answer against one published source; check the three wrong answers are clearly wrong and UK wording'), 'pending', x.sourceUrl, q('Added in v3.5.0 (Q6)')].join(','));
fs.writeFileSync(queueFile, bom + [lines[0], ...lines.slice(1).filter(keepLine), ...rows].join('\n') + '\n');

const general = out.filter(x => x.topic !== 'maths');
const count = d => general.filter(x => x.difficulty === d).length;
const pct = d => Math.round(count(d) / general.length * 100);
console.log(`buzzer-questions.json: ${out.length} total, ${general.length} general knowledge — easy ${count('easy')} (${pct('easy')}%), medium ${count('medium')} (${pct('medium')}%), hard ${count('hard')} (${pct('hard')}%). Added ${fresh.length}, removed ${Object.keys(removed).length}.`);
