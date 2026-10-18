# Editable game content

Phase 3: `higher-lower.json` (150 facts), `close-call.json` (60 numerical questions), `unscramble.json` (120 anagram words).

Phase 4:

- `sketch-words.json` — 200 family-friendly drawing prompts.
- `noise-clues.json` — 80 performer-only sound cues, with accepted shorter guessing aliases.
- `caption-scenes.json` — 30 stage situations using the original 12 avatars.
- `fib-facts.json` — 60 factual fill-in-the-blank questions; each carries `editorialStatus: review-pending`. They are playable starter material, **not externally fact-checked for commercial release**.
- `mind-categories.json` — 60 secret-word matching themes.
- `majority-questions.json` — 60 four-choice opinion questions.

Edit the JSON files with a text editor. Do not put answer keys, saboteur identity, or private clue cards into public web files. Edit `server/games/phase4.js` only to alter mechanics and timers. The `npm test` command checks item counts and IDs. All prompts aim to be family-friendly; the Family toggle does **not** yet filter user-generated caption, bluff or drawing content automatically. A live room is supervised by the players.
