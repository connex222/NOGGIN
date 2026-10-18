# NOGGIN v2 — TV lobby redesign

- Corrected the second screen to three equally aligned panels, a dedicated 8-player roster and a separate Start button. All are contained within the 16:9 stage, including 720p displays.
- Original NOGGIN stage art and 12 rotating avatar expressions remain on both TV pages.
- Real server-created room code, QR image and join URL are still supplied by the existing socket-hosted game engine.
- Updated settings, music and sound controls to avoid overlapping the player roster or Start button.
- Small-width layouts stack rather than squeezing information off-screen.
- Gameplay, client controllers, room logic and deployment configuration are unchanged.

## Play

Windows: extract ZIP, open NOGGIN-v2, double-click start-noggin.bat; use the TV address shown in the console. Phones scan QR code / open displayed join link.
Render: commit NOGGIN-v2 contents to repository root and deploy the current branch. Do not upload the enclosing NOGGIN-v2 folder as a nested directory.

## Verification

These are code tests and browser simulations, not actual phone-to-Render acceptance tests.
