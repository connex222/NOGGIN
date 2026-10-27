"""NOGGIN v3.5.0 Q3 helper (dev only): list real-word anagrams of every Unscramble word.
Needs:  pip install wordfreq
Output: tools/v350-unscramble-accept.json  (word -> other accepted spellings)
Names, brands and unsuitable words are excluded by the EXCLUDE list below; review the
output by eye before committing it."""
import json
from pathlib import Path
from wordfreq import top_n_list, zipf_frequency
ROOT = Path(__file__).resolve().parent.parent
EXCLUDE = set('''DEARING PARTYS ERAGON RASHID MACRAE LENNART PLANTE NUSRAT KINSLEY WILFRIED BALMER BELMAR
CATRIONA CYRANO AMHERST MATHERS ROBBINS ROSETTA GARNIER BORTLES STROBEL CARSON NARCOS SALMOND CHARIS
CROOKES LOGGINS GRANDES GASPER BORDELLO TAMPONS CHECKIN'''.split())
EXTRA = {'POSTERS': ['PRESTOS'], 'CHICKEN': []}
words = [w.upper() for w in top_n_list('en', 300000) if w.isalpha() and w.isascii() and 6 <= len(w) <= 8]
index = {}
for w in words: index.setdefault(''.join(sorted(w)), set()).add(w)
bank = json.loads((ROOT / 'data/unscramble.json').read_text())
out = {}
for item in bank:
    word = item['word']
    alts = sorted(a for a in index.get(''.join(sorted(word)), ()) if a != word and a not in EXCLUDE and zipf_frequency(a.lower(), 'en') >= 2.0)
    alts = sorted(set(alts) | set(EXTRA.get(word, [])))
    if alts: out[word] = alts
(ROOT / 'tools/v350-unscramble-accept.json').write_text(json.dumps(out, indent=2) + '\n')
print(len(out), 'words have other accepted anagrams')
