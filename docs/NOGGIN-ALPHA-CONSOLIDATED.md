# NOGGIN Alpha — consolidated release baseline

**Consolidated on:** 7 November 2026  
**Canonical source:** GitHub `connex222/NOGGIN` → `main`  
**App package version:** `3.5.0-alpha.1` (unchanged; this consolidation is documentation only)  
**Latest game-code merge:** `c141960fb780eb1f84ef55848b3bca4b693b30a6` (PR #8, 6 November 2026)  
**Render app:** https://noggin-0u32.onrender.com/tv/  
**Render service:** `srv-dba8j9gm7kps73ft4d2g` (automatic deployment from `main`)

## What is in the consolidated game

- Existing server-authoritative NOGGIN Alpha: 2–8 players, TV show and phone controllers, unique room codes/QR joining, reconnect handling, 28-space board, round games and Showdowns, live scores and match outcomes.
- Approved original studio art, NOGGIN brand, playable avatar identities, audio and HEADSTART narrated tutorial preserved.
- Visual 2.0 image assets integrated under `public/tv/art/visual-v2/`; this is an **optional visual preview** activated by `?visual2=1`. **It has not been promoted to the default live board art.**
- Lobby readability repair for Room Code and Game Settings, including a scroll fallback for constrained displays.
- GAME NIGHT cinematic and separate NOGGIN welcome screen bypassed, taking visitors directly to the lobby (PR #7).
- Decorative avatar strip hidden only on the lobby to avoid covering the NOGGIN logo; player roster and phone avatars remain.
- HOW TO PLAY button contained in the Game Settings card and wired to the existing HEADSTART tutorial; tutorial opening failures surface an error (PR #8).
- HTML, JavaScript and CSS are served with `Cache-Control: no-store, max-age=0` to prevent stale startup UI following updates (PR #8). Art and media retain ordinary caching.

## Release evidence

- **GitHub PR #7**: https://github.com/connex222/NOGGIN/pull/7 — merged.
- **GitHub PR #8**: https://github.com/connex222/NOGGIN/pull/8 — merged.
- **PR #8 GitHub Actions:** workflow run `42186657588`, `completed/success`.
- **Render:** deploy `dep-dbmoqmtckfvc738rnjjg` (game-code commit `c141960...`), `live` as checked 7 November 2026.
- **User acceptance:** lobby described as “seems ok now” after deployment. This is a practical smoke report, not a certified 2–8-player game-night acceptance.
- **Prior local release tests:** 422/422 automated tests passed in the reconciled Windows log before the later lobby PRs. Do not present this historical number as a fresh test of this documentation commit.

## What is not claimed complete

- Real-device visual comparison at 1920×1080, 1366×768, tablet and small phone widths has not been independently captured in this consolidation.
- The optional Visual 2.0 artwork remains review-only, with previous source dimensions below the native 1920×1080 target.
- Full attended 2-, 4-, 6- and 8-player match acceptance, narration-on-device and all interaction paths have not been re-certified in this consolidation.
- Historical cinematic branches remain on GitHub. They are superseded or archival **not** new work to merge into `main`; merging them would risk reinstating unwanted intros.
- No branch cleanup or deletion has been authorised by this document.

## Safe workflow for the next change

1. Start from **fresh GitHub `main`**, not older `NOGGIN-main(2).zip`, local preview ZIPs or old merge kits.
2. Make any change in a new development branch; keep the approved NOGGIN artwork, avatars, gameplay and audio intact unless explicitly approved otherwise.
3. Run `npm ci`, `npm run check`, `npm test`; inspect TV and phone browser layouts and verify HOW TO PLAY and room join.
4. Open a PR, confirm tests, merge only approved changes. Render auto-deploys from `main`; verify `live` and smoke-test the URL.
5. In a future rollout, only promote `?visual2=1` imagery as default after visual checks and approval; do not remove the feature flag incidentally.

## Historical records

`docs/VISUAL-2-PR-SUMMARY.md`, `docs/VISUAL-2-QA-REPORT.md` and `VISUAL-2-RECONCILIATION.md` describe early staging and are retained for provenance. This file supersedes their outdated release-status statements. Do not reapply old merge ZIPs.
