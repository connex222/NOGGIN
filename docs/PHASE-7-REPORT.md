# Phase 7 — Repository tidy-up report

## Changes implemented

- Room broadcasts now use a per-room socket index rather than iterating through every bound client. Binding replacement, leave, and close remove sockets from this index.
- `GameRooms.state()` no longer mutates match-report statistics. In-game mutations, periodic ticks, match-report exports, and checkpoint saves update the report at real activity boundaries.
- Removed unused duplicate audio (`sfx-hop .mp3`) and unreferenced roulette sound (`spinopel-spinning-roulette-wheel-429832.mp3`). Neither filename had a code or manifest reference before removal.
- Removed `docs/test-history`, which contained historical generated run artefacts. Runtime code, test suites, and playable content are retained.
- Moved `source-art` into a separate archive supplied alongside the game ZIP. Runtime avatar checks and the release audit now verify bundled WebP assets, not optional archival PNGs.
- Consolidated all root-level Markdown notes into README.md, INSTALL.md, CHANGELOG.md, and DESIGN-NOTES.md. Earlier report text is retained in clearly headed archived sections of the latter two files.
- Corrected README's extracted folder name and replaced the obsolete `/health` release-candidate label. The endpoint still reads its version from `package.json`.
- Replaced unsupported audio originality/licensing claims with a file inventory and per-file source/licence review fields.

## Not completed or not claimed

- Drawing strokes still trigger a full state broadcast. Converting to stroke-only events safely requires client resynchronisation/reconnect design and dedicated security tests.
- Not every long one-line function has been reformatted. Functional changes were prioritised without rewriting unrelated game logic.
- The test suite retains some static-markup assertions; replacing them with browser behaviour tests remains future work.
- All original audio source licences remain unverified until provenance documents are supplied.
- Unresolved Phase 4 device acceptance tests and Phase 6 flagged factual entries remain outstanding.

## Documentation merge map

README and INSTALL remain standalone hosting and setup guides. Phase reports, implementation updates and historical test results moved into CHANGELOG.md. Design guides, checklists, rehearsal notes and playtesting guidance moved into DESIGN-NOTES.md. All original text from the removed root Markdown documents is preserved under an `Archived document:` heading.
