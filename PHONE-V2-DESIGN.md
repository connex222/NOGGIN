# NOGGIN v2 — Phone Interface Design & Testing

**Source of truth:** your supplied `NOGGIN-v1.3.0(1).zip`; this release is a forward redesign of that project, **not** a rebuild from older v1.2 files.

## What changed

- **Official game-show logo:** bundled WebP artwork extracted from the existing welcome-stage image and shown on phones.
- **Brand system:** deep navy, electric blue, violet accents, amber marquee borders and illuminated call-to-action buttons.
- **Common player card:** avatar, player name, room code, Spark total, Director Cues.
- **Round panel:** category/status badge, dynamic mini-game title, server-supplied instructions, live countdown and proportional timer bar.
- **Join/READY:** same stage styling on room-code entry, 12-avatar selection and player readiness.
- **All 16 mini-games:** original 1.3.0 game input controls remain in place, but their HTML controls share the v2 visual system.
- **Showdowns and board:** buzzer, rope, bidding, nerve, numerical Noggin-Off, dice/route/target/category decision actions share the same components.
- **Dense/specialist controls:** Odd Spot preserves all 36 numbered squares (NOT the conceptual four-duck picture); Memory Lane retains six playable pads; sketch retains a touch-action-free drawable canvas; written/numeric answers remain native forms.
- **Accessibility:** visible focus states, tactile-size targets where layout allows, reduced-motion media query, scrollable long inputs and no fixed-height phone viewport traps.

## Source changes

- `public/play/index.html` — new structural markup with existing IDs intact.
- `public/play/play.js` — presentation-only state classes and timed progress.
- `public/play/studio.css` — complete game-show design layer over original gameplay CSS.
- `public/play/art/noggin-logo.webp` — local logo artwork using the game's existing welcome image.
- `tests/phone-v2.test.js` — regression checks.
- `tools/phone-v2-browser-smoke.py` — mocked browser test across sizes.
- `docs/previews/phone-v2/` — screenshots and measured browser results.

## Verification

`npm test`, `npm run check` and `npm run audit` are executed for this package before release.
The browser smoke tests exercise 16 mini-games, seven showdown/duel states and six board/result states at 360×640, 390×844 and 430×932. The smoke setup uses a **mock Socket.IO connection**, not live players. A successful mock test does not establish that every mini-game works on actual phones or that music/audio/haptics work on every device.

## Still to verify with actual devices

1. Scan the TV QR into at least two different phones; join, change avatar and ready up.
2. Play a full match and verify phone buttons submit once, the TV advances, and disabled controls react to lost connection.
3. Test the canvas using a finger, number keyboard submissions, Memory Lane pads and the full 36-square Odd Spot round.
4. Test phone browser scaling and legibility with Android and iPhone; test an on-screen keyboard while the game timer runs.
5. Test 2/4/8-player devices over your actual Render / Windows network.

**The playing-board TV graphic remains the updated original from 1.3.0.** This release focuses on the phone UIs; the separate TV board art concept is not yet incorporated as a working SVG board.
