# NOGGIN Visual 2.0 — PR-ready local review package

**Proposed branch:** `feature/noggin-visual-2-review` (local packaging only; NOT pushed to GitHub).
**Source baseline:** supplied `NOGGIN-main(2).zip`, package `3.5.0-alpha.1`; current remote main and live Render parity NOT VERIFIED.

## Change scope
- Five original AI-generated visuals stored separately under `public/tv/art/visual-v2/`.
- Add an opt-in stylesheet at `public/tv/visual-v2.css` and a controlled `?visual2=1` class toggle in TV `index.html`.
- Existing art, avatars, voice, audio, Socket.IO/server, questions and rules remain unmodified.
- The host portrait is shipped for review but deliberately NOT overlaid until its identity and placement are checked in a browser.

## Caution
These assets originated at **1672×941** widescreen / **1122×1402** portrait, not native 1920×1080 backgrounds. The full-HD source requirement remains unmet. Stage artworks contain baked NOGGIN logos; the live UI may also show logos. The opt-in implementation is a review slice, not a production-approved replacement.

## To preview locally
1. Install dependencies using `npm ci` in the project root.
2. Run `npm start`.
3. Open the TV URL with `?visual2=1` (or `&visual2=1` if it already has query parameters).
4. Open the URL without this option to compare unchanged Alpha appearance.
5. Inspect QR/buttons at 1920×1080, 1366×768, 1024×768, 390×844 and 320px before authorising merge.

## Release / rollback
No merge or deploy is authorised. To roll back in review, remove the `visual2=1` query flag. For later source rollback, revert the preview commit. No database/schema migration or game protocol change.
