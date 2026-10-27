'use strict';
// NOGGIN v3.5.0 Q4/Q5 — fair, forgiving answer matching for typed guesses.
// Server-only. Never sends answers or aliases to phones.
//  - case, punctuation, hyphens and spaces don't matter ("hot-air balloon" = "hotair balloon")
//  - "the", "a" and "an" in front don't matter
//  - simple plurals don't matter ("roller skates" = "roller skate", "boxes" = "box")
//  - numbers can be typed as digits or words ("5" = "five", "42" = "forty-two")

const ARTICLES = new Set(['the', 'a', 'an']);
// Short words that never count as a "key word" when deciding whether a guess is close.
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'up', 'out', 'off',
  'into', 'onto', 'over', 'its', 'it', 'your', 'my', 'their', 'that', 'this', 'is', 'are', 'be', 'being', 'some', 'someone', 'very',
  'one', 'two', 'three', 'just', 'not', 'will', 'come', 'trying', 'going', 'getting', 'during', 'after', 'before', 'across', 'along',
  'around', 'round', 'against', 'through', 'about', 'end']);

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const NUMBER_WORD = new Map([...UNITS.map((w, i) => [w, i]), ...TENS.map((w, i) => [w, i * 10]).filter(([w]) => w), ['fourty', 40], ['hundred', 100], ['thousand', 1000]]);

function tokens(text) {
  return String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-GB')
    .replace(/&/g, ' and ').replace(/(\d),(\d{3})\b/g, '$1$2').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

// Turn runs of number words into digits: "forty two" -> "42", "a hundred" -> "100",
// "two hundred and five" -> "205", "three thousand" -> "3000". Covers 0–9999.
function wordsToDigits(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    if (!NUMBER_WORD.has(words[i]) && !(words[i] === 'a' && words[i + 1] === 'hundred')) {out.push(words[i]); continue;}
    let total = 0, current = 0, j = i, used = false;
    while (j < words.length) {
      const w = words[j];
      if (w === 'a' && words[j + 1] === 'hundred') {current = 1; j++; continue;}
      if (w === 'and' && used && NUMBER_WORD.has(words[j + 1] || '')) {j++; continue;}
      if (!NUMBER_WORD.has(w)) break;
      const v = NUMBER_WORD.get(w);
      if (v === 100) current = (current || 1) * 100;
      else if (v === 1000) {total += (current || 1) * 1000; current = 0;}
      else current += v;
      used = true; j++;
    }
    if (!used) {out.push(words[i]); continue;}
    out.push(String(total + current)); i = j - 1;
  }
  return out;
}

// Words whose singular really ends in "oe" (shoe, canoe...), unlike potato or tomato.
const OE = /^(shoe|toe|hoe|oboe|canoe|sloe|floe|doe|foe|roe|woe|horseshoe|snowshoe|tiptoe|mistletoe)$/;
function singular(word) {
  if (/^\d+$/.test(word) || word.length <= 3) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (/ies$/.test(word) && word.length > 4) return word.slice(0, -3) + 'y';
  if (/oes$/.test(word)) return OE.test(word.slice(0, -1)) ? word.slice(0, -1) : word.slice(0, -2); // shoes→shoe, potatoes→potato
  if (/(ches|shes|xes|zes|sses)$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

function words(text) {
  const list = wordsToDigits(tokens(text));
  while (list.length > 1 && ARTICLES.has(list[0])) list.shift();
  return list.map(singular);
}
// One comparable string: spacing and hyphens removed, so "double-decker" = "double decker".
function canon(text) {return words(text).join('');}
function same(a, b) {const x = canon(a); return x.length > 0 && x === canon(b);}
function sameAsAny(guess, targets) {const g = canon(guess); return g.length > 0 && targets.some(t => canon(t) === g);}

// True when the guess contains an alias as whole words: "an owl hooting" contains "owl",
// but "bowling" does not contain "owl", and "water" alone never matches "water pistol".
function containsPhrase(guess, alias) {
  const g = words(guess), a = words(alias);
  if (!a.length || a.length > g.length) return false;
  for (let i = 0; i + a.length <= g.length; i++) if (a.every((w, k) => g[i + k] === w)) return true;
  // also allow the alias typed as one word, e.g. "rollercoaster" for "roller coaster"
  return g.join('').includes(a.join('')) && a.join('').length >= 6 && g.length === 1;
}

function keyWords(text) {return words(text).filter(w => w.length >= 3 && !STOP.has(w));}
// "Close!" — the guess shares a real word with the answer but is not the answer.
function sharesKeyWord(guess, answer) {
  const target = new Set(keyWords(answer));
  return keyWords(guess).some(w => target.has(w));
}

module.exports = {tokens, words, canon, same, sameAsAny, containsPhrase, keyWords, sharesKeyWord, wordsToDigits, singular};
