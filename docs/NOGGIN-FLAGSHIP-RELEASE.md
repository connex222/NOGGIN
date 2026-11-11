# NOGGIN — Flagship release record

**Date:** 11 November 2026
**Owner instruction:** Merge, deploy and consolidate flagship work.
**Repository:** `connex222/NOGGIN`
**Pull request:** [#10 — flagship improvements](https://github.com/connex222/NOGGIN/pull/10)
**Source branch:** `improvement/noggin-flagship`
**Target / configured Render branch:** `main`
**Render service:** [NOGGIN](https://dashboard.render.com/web/srv-dba8j9gm7kps73ft4d2g)
**Game address:** https://noggin-0u32.onrender.com/tv/

## Release changes

1. Result timing now distinguishes quiet, minor and headline outcomes. Normal holds are 1,300 / 2,000 / 2,900 milliseconds; relaxed holds are 2,600 / 3,400 / 4,200 milliseconds. Existing points rules are preserved.
2. HEADSTART tutorial takes exclusive control of host narration and backing music; final winner audio interrupts previous host speech.
3. TV timing cues for special explainers, final-round standings and movement stay aligned after host reconnect or optional local checkpoint restore.
4. Five targeted regression test files cover audio, pacing, gameplay, room sizes, reconnect and round progression.
5. The model simulator now counts quiet/ordinary/headline results and compares modelled result-hold savings with the prior 2,900 ms normal hold.
6. `RUN-FLAGSHIP-QA.bat` runs installation, syntax checking, unit tests, simulation and release audit from a **Git checkout on `main` or the improvement branch**. It writes `NOGGIN-FLAGSHIP-QA-RESULTS.txt`.
7. Editorial duplicate candidates are **documented for owner review**; data banks were not changed.

## Verification status at merge request

- PASS (targeted only): isolated V8 function execution for result timers, room seating and reconnect, tutorial audio and automatic roll progression; all 11 inspected JS files parsed in that harness. See [targeted evidence](NOGGIN-FLAGSHIP-TARGETED-EXECUTION.md).
- NOT PASSED: full `npm test`, CI, `npm run audit`, 100-match simulations, real 2/4/6/8 physical phone acceptance and a complete visual/audio assessment.
- CI failure also appeared on unchanged baseline `main`. GitHub Actions jobs end in seconds without steps or assigned runner; **root cause unconfirmed**. No branch protection bypass or false test status is claimed.
- Render uses a single free Docker web service with automatic deployment from `main`, health path `/health`. No persistent disk or state backend is confirmed; server restarts may abandon active rooms.
- Previously owner-attested content and licensing signoffs are preserved, not independently re-verified here.

## Release governance

The owner expressly instructed release on 11 November 2026 **despite the known QA gaps**, superseding the earlier development-branch instruction to withhold merging. Treat this as an **owner-authorised, provisionally verified Alpha release**, not a passed acceptance certification.

## Post-deploy acceptance still required

- Verify Render deploy status is `live` for the merged commit; verify `/health`, `/tv/` and QR joins.
- Run `RUN-FLAGSHIP-QA.bat` on a checkout of `main`, archive the output and correct any failures.
- Test 2/4/6/8 phones in both game styles with host reconnect, phone reconnect, voice/tutorial, winner reveal and full session completion.
- Keep the editorial duplicate review open. Avoid new scores/rules/assets until post-release issues are documented.

Historical Visual 2.0 and Alpha baseline notes remain in `docs/` for provenance; **this is the canonical flagship change record**, not a claim that historical preview instructions are current.
