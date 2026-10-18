## NOGGIN v2 — Show arena board update (18 October 2026)

The main TV gameplay board now matches the selected illuminated studio concept. The original static illustration is bundled as a venue backdrop, with 36 **live** numbered tiles, contestant position tokens, player portraits and Sparks overlaid by the actual game engine. Both two-player and eight-player layouts are supported. The lobby, real QR join and redesigned phone UIs are preserved.

**Run on Windows:** extract the ZIP, double-click `start-noggin.bat`, leave the black window running and open the TV address it displays. Phones join from the same room QR. On Render, redeploy the updated files after uploading them to your repository.

See [`BOARD-V2-IMPLEMENTATION.md`](BOARD-V2-IMPLEMENTATION.md) and `docs/previews/arena-board/` for screenshots and browser-check results. This build has not been independently tested with real phones on Windows/Render.

# NOGGIN v2.0 — TV + Phone Party Game

NOGGIN is a local-first party board game for **2–8 players**. The TV or laptop browser displays a 36-space board; each player uses their own phone to roll, pick and answer. There are 12 characters, 16 mini-games and four corner Showdowns.

## What changed in v2

- New matching NOGGIN stage theme on all phone pages, based on the existing gold-logo TV welcome screen.
- Redesigned room-code join, avatar selection, READY lobby and in-game player card.
- Unified interactive presentation for all 16 mini-games, four corner Showdowns, board decisions and results.
- Restyled controls for the 36-square Odd Spot grid, Memory Lane pads, sketch canvas, choices and text/numeric entry.
- Added a visible timer progress bar and distinct phase/status indicator.
- Kept the existing 1.3.0 server/game rules, multiplayer protocol, Windows launcher, QR join URLs and TV designs.
- Details and testing limits: [PHONE-V2-DESIGN.md](PHONE-V2-DESIGN.md).

## Run it on a Windows laptop

1. Install **Node.js 20 or newer** if you have not already. An internet connection is needed **only on first install** to fetch the server dependencies.
2. Right-click the NOGGIN ZIP and select **Extract All**. Open the `NOGGIN-v2` folder inside.
3. Double-click **`start-noggin.bat`**. Keep the black command window open. If Windows asks about network access for Node.js, allow it on **Private** networks.
4. On the laptop, open the exact **TV address** shown in the black window (for example `http://localhost:3000/tv/`). If port 3000 is busy it might show 3001 instead; use the displayed port.
5. Make sure laptop and phones are on the **same home router/network** (laptop Ethernet plus phone Wi-Fi is fine). Scan the live QR on the TV, or type the displayed full join address into each phone browser.
6. Players choose different avatars and press **READY**; on TV select **Classic** (default: roll → move → play) or **Showtime** (Director Cues and extra choices), then start the show.

**If phones cannot join:** turn off mobile data temporarily, check the laptop's Windows Firewall is permitting Node.js on your Private network, and confirm both devices are on the same router. Guest Wi-Fi and some Wi-Fi isolation settings block phones from reaching the laptop.

For complete Windows/network/cloud installation help, see [INSTALL.md](INSTALL.md). For game rules, see [HOW-TO-PLAY.pdf](HOW-TO-PLAY.pdf). For verification results see [TEST-RESULTS.md](TEST-RESULTS.md).

The game runs without CDNs or external runtime resources. Starting a new Windows install requires `npm install` if dependencies are not already installed. Node.js/Express/Socket.IO serve the game from this folder; only one active server should host a given room.
