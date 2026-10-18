# NOGGIN v1.3.0 — TV + Phone Party Game

NOGGIN is a local-first party board game for **2–8 players**. The TV or laptop browser displays a 36-space board; each player uses their own phone to roll, pick and answer. There are 12 characters, 16 mini-games and four corner Showdowns.

## Run it on a Windows laptop

1. Install **Node.js 20 or newer** if you have not already. An internet connection is needed **only on first install** to fetch the server dependencies.
2. Right-click the NOGGIN ZIP and select **Extract All**. Open the `NOGGIN-v1.3.0` folder inside.
3. Double-click **`start-noggin.bat`**. Keep the black command window open. If Windows asks about network access for Node.js, allow it on **Private** networks.
4. On the laptop, open the exact **TV address** shown in the black window (for example `http://localhost:3000/tv/`). If port 3000 is busy it might show 3001 instead; use the displayed port.
5. Make sure laptop and phones are on the **same home router/network** (laptop Ethernet plus phone Wi-Fi is fine). Scan the live QR on the TV, or type the displayed full join address into each phone browser.
6. Players choose different avatars and press **READY**; on TV select **Classic** (default: roll → move → play) or **Showtime** (Director Cues and extra choices), then start the show.

**If phones cannot join:** turn off mobile data temporarily, check the laptop's Windows Firewall is permitting Node.js on your Private network, and confirm both devices are on the same router. Guest Wi-Fi and some Wi-Fi isolation settings block phones from reaching the laptop.

For complete Windows/network/cloud installation help, see [INSTALL.md](INSTALL.md). For game rules, see [HOW-TO-PLAY.pdf](HOW-TO-PLAY.pdf). For verification results see [TEST-RESULTS.md](TEST-RESULTS.md).

The game runs without CDNs or external runtime resources. Starting a new Windows install requires `npm install` if dependencies are not already installed. Node.js/Express/Socket.IO serve the game from this folder; only one active server should host a given room.
