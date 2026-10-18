# NOGGIN tools (Phase 6)

- `simulate.js` — deterministic, model-based run through all player counts, writes one JSON summary line per player count. `node tools/simulate.js 1000 > phase6-simulation.jsonl`. Assumes 75s per turn; **not a real human playtest**.
- `export-guide-data.js` — reads the live board configuration, game catalogs and avatar list; outputs one JSON rules snapshot.
- `make-how-to-play.py` — renders the snapshot to `HOW-TO-PLAY.pdf` using ReportLab (install with `python -m pip install -r requirements-docs.txt`).
- `release-audit.js` — validates distributions, source assets and the shipping skeleton without downloading dependencies.
- `phase5-browser-smoke.py` — retained name from Phase 5: mock Socket.IO UI browser rendering at two TV and two phone viewports, **not real networking**. It writes `phase5-browser-results.json` (copy to `phase6-browser-results.json` to archive release results).
- Other `phase3-*` and `phase4-*` smoke tools are preserved for regression checks.
