const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const banks = {
  'buzzer-questions': ['question','choices','correct'],
  'fib-facts': ['question','answer'],
  'close-call': ['question','answer','unit','source'],
  'majority-questions': ['question','options'],
  'mind-categories': ['category'],
  'caption-scenes': ['scene','avatars'],
  'sketch-words': ['word','category'],
  'unscramble': ['word','category'],
  'higher-lower': ['label','value','unit','source'],
  'noise-clues': ['clue','aliases'],
  'bid-categories': ['prompt','answers'],
};
for (const [bank,fields] of Object.entries(banks)) {
  test(`${bank}: format, ids, duplicate primary content and nonempty required fields`, () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname,'../data',`${bank}.json`),'utf8'));
    assert.ok(Array.isArray(data) && data.length>0);
    const ids = new Set(); const prompts = new Set();
    const primary = { 'buzzer-questions':'question', 'fib-facts':'question', 'close-call':'question', 'majority-questions':'question', 'mind-categories':'category', 'caption-scenes':'scene', 'sketch-words':'word', 'unscramble':'word', 'higher-lower':'label', 'noise-clues':'clue', 'bid-categories':'prompt'}[bank];
    for (const entry of data) {
      assert.ok(typeof entry.id === 'string' && entry.id.trim());
      assert.ok(!ids.has(entry.id), `${bank}: duplicate id ${entry.id}`); ids.add(entry.id);
      const norm = String(entry[primary]||'').trim().toLowerCase().replace(/\s+/g,' ');
      assert.ok(norm && !prompts.has(norm), `${bank}: duplicate ${primary}: ${norm}`); prompts.add(norm);
      for (const field of fields) {
        assert.ok(Object.hasOwn(entry,field), `${bank}/${entry.id}: missing ${field}`);
        const value=entry[field];
        assert.ok(value !== null && value !== undefined && !(typeof value==='string' && !value.trim() && !(field==='unit' && bank==='higher-lower')) && !(Array.isArray(value) && value.length===0 && !['aliases'].includes(field) && !(field==='unit' && bank==='higher-lower')), `${bank}/${entry.id}: empty ${field}`);
      }
      if (bank==='buzzer-questions') {
        assert.equal(entry.choices.length,4);
        assert.ok(Number.isInteger(entry.correct) && entry.correct>=0 && entry.correct<4);
        assert.equal(new Set(entry.choices.map(c=>String(c).toLowerCase())).size,4);
      }
      if (bank==='majority-questions') assert.ok(entry.options.length>=2);
      if (bank==='bid-categories') assert.ok(entry.answers.length>=3);
      if (bank==='close-call' || bank==='higher-lower') assert.ok(Number.isFinite(entry[bank==='close-call'?'answer':'value']));
    }
  });
}
test('phase 6 exact-arithmetic entries are independently recalculated', () => {
  const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',`${n}.json`),'utf8'));
  for (const e of read('close-call').filter(e=>/^cc-seconds-/.test(e.id))) {
    const minutes=Number(e.id.replace('cc-seconds-',''));
    assert.equal(e.answer,minutes*60);
    assert.equal(e.question,`How many seconds are in ${minutes} minutes?`);
  }
  for (const e of read('higher-lower').filter(e=>/^area-/.test(e.id))) {
    const side=Number(e.id.replace('area-',''));
    assert.equal(e.value,side**2);
    assert.equal(e.label,`Square centimetres in a ${side} cm by ${side} cm square`);
  }
  for (const e of read('buzzer-questions').filter(e=>/^buzz-p6-/.test(e.id))) {
    const n=Number(e.id.replace('buzz-p6-',''));
    assert.equal(Number(e.choices[e.correct]),n*(n+3));
  }
  for (const e of read('fib-facts').filter(e=>/^fb-p6-/.test(e.id))) {
    const n=Number(e.id.replace('fb-p6-',''));
    assert.equal(e.answer,String(n*60));
  }
});

test('Phase 6 batch 2: independently validate exact conversion values and factual review flags', () => {
  const read = n => JSON.parse(fs.readFileSync(path.join(__dirname, '../data', `${n}.json`), 'utf8'));
  const added = n => read(n).filter(e => e.id.startsWith('p6b2-'));
  for (const e of added('close-call')) {
    let m = e.question.match(/^How many (hours|centimetres|grams) are in (\d+) (full days|metres|kilograms)\?$/);
    assert.ok(m, `Unexpected conversion: ${e.question}`);
    const factor = {hours:24, centimetres:100, grams:1000}[m[1]];
    assert.equal(e.answer, Number(m[2]) * factor);
  }
  for (const e of added('higher-lower')) {
    const m = e.label.match(/^(Minutes in|Millimetres in|Degrees in) (\d+) (hours|centimetres|right angles)$/);
    assert.ok(m, `Unexpected quantity: ${e.label}`);
    assert.equal(e.value, Number(m[2]) * {'Minutes in':60,'Millimetres in':10,'Degrees in':90}[m[1]]);
  }
  for (const bank of ['buzzer-questions','fib-facts','bid-categories']) {
    for (const e of added(bank)) {
      if (e.editorialStatus === 'source-checked') {
        assert.match(e.sourceUrl, /^https:\/\//, `${bank}/${e.id} requires source evidence`);
      } else if (bank === 'fib-facts') {
        assert.ok(['editorially-reviewed-not-independently-sourced','verified-exact-arithmetic','logic-checked'].includes(e.editorialStatus), `${bank}/${e.id} requires explicit evidence level`);
      } else {
        assert.equal(e.review, true, `${bank}/${e.id} must remain flagged pending external verification`);
      }
    }
  }
  for (const e of added('buzzer-questions')) {
    assert.equal(e.choices.length, 4);
    assert.ok(e.choices[e.correct]);
  }
});

test('Phase 6 batch 3: independently recalculate every numeric answer and check creative prompts', () => {
  const read = n => JSON.parse(fs.readFileSync(path.join(__dirname,'../data',`${n}.json`),'utf8'));
  const added = n => read(n).filter(e => e.id.startsWith('p6b3-'));
  for (const e of added('buzzer-questions')) {
    const m = /^A shop has (\d+) balloons and sells (\d+) of them\. How many remain\?$/.exec(e.question);
    assert.ok(m, e.id);
    assert.equal(Number(e.choices[e.correct]), Number(m[1])-Number(m[2]));
  }
  for (const e of added('close-call')) {
    const m = /^How many seconds are in (\d+) hours\?$/.exec(e.question);
    assert.ok(m, e.id);
    assert.equal(e.answer,Number(m[1])*60*60);
  }
  for (const e of added('fib-facts')) {
    const m = /^(\d+) hours contain this many minutes ___$/.exec(e.question);
    assert.ok(m, e.id);
    assert.equal(Number(e.answer),Number(m[1])*60);
  }
  for (const e of added('higher-lower')) {
    const m = /^Seconds in (\d+) hours$/.exec(e.label);
    assert.ok(m,e.id);
    assert.equal(e.value,Number(m[1])*60*60);
  }
  for (const n of ['buzzer-questions','close-call','fib-facts','higher-lower']) {
    for (const e of added(n)) assert.equal(e.verified,'arithmetic');
  }
  for (const e of added('majority-questions')) assert.equal(e.options.length,4);
  for (const e of added('caption-scenes')) assert.equal(e.avatars.length,2);
});
