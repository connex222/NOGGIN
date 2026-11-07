**ARCHIVE — historical local test report (5 November 2026).** Full 422/422 automated tests subsequently passed on the Windows release kit; PR #8 GitHub Actions succeeded and was deployed. Current release state and remaining visual acceptance limits: [NOGGIN-ALPHA-CONSOLIDATED.md](NOGGIN-ALPHA-CONSOLIDATED.md).

# NOGGIN Visual 2.0 — local QA report (5 Nov 2026)

## Results
- **PASS:** `npm run check` — exit 0 (JavaScript syntax checks).
- **PASS:** `node --test tests/assets.test.js tests/splash-integration.test.js` — 6/6 passing.
- **FAIL / ENVIRONMENT BLOCKED:** `npm test` — 422 tests: **420 passed, 1 failed, 1 skipped**. Failure: `tests/audio-end-to-end.test.js` could not start the NOGGIN HTTP server (`NOGGIN exited before health check`). In this offline staging environment, `node_modules` is absent; the normal app server requires Express / Socket.IO, so this is not established as a product defect. Retest after `npm ci` in an environment with dependencies.
- **PASS:** Five WebP image assets exist in the local patch; the host includes transparency.
- **NOT RUN:** Live TV/phone browser screenshots, QR interaction, 2/4/6/8-player complete-show acceptance, reduced-motion device review, visual pixel comparison, audio playback over rounds, real Render smoke and independent current-main parity.

## Limitations / release gate
The NOGGIN ZIP is a snapshot without Git metadata; no authentic remote-based branch or hosted GitHub PR was created. The preview is opt-in via `?visual2=1`, defaults to original visuals, and is NOT ready to merge. Visual approvals are concepts; the integrated preview has not been signed off. Generated widescreen assets are 1672×941, below the 1920×1080 native target.

**Recommendation:** Leave the PR as a local review package. Install dependencies, run browser screenshots and multiplayer/audio checks, correct any layout issues, then create a remote branch and PR from verified current main. Do not merge/deploy yet.
