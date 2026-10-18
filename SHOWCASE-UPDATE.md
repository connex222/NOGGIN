# NOGGIN v1.4 — The Two-Screen Showcase

The opening TV screen and the room lobby now use the two selected game-show designs.

**Welcome:** Click START GAME or JOIN WITH PHONES. HOW TO PLAY opens the instructions. The live room QR, real code, and join URL also appear while the opening art is on screen.

**Lobby:** The second design displays actual host room data, a scannable QR, live player slots, and working settings. The options use the existing Spark target and game-clock modes; the fictional round-count selector in the mockup was not reproduced. A real match still starts only when 2+ players are connected and ready.

**Characters:** Both screens show the same 12 real NOGGIN avatars with expressions chosen independently on each fresh page load. Their images are drawn separately over the art.

**QR / security:** Both QR images are sourced from the server-owned host room. There are no demo credentials, hardcoded room codes, or external CDNs.

**Deployment:** Commit the changed `public/tv/` assets to GitHub (including `public/tv/art/`) and deploy the latest commit on Render. Clear browser cache on update.

**Testing:** `npm run check`, `npm test`, `npm run audit`; test the actual QR with a phone on the live deployment and test room creation/reconnect.
