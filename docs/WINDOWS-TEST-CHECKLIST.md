# NOGGIN 1.3.0 — real laptop and phone testing

These are practical checks **you still need to perform**. They were not run during this release build.

## Start the game and connect the phones

1. On your Windows laptop, make a folder for the new version. Right-click `NOGGIN-v1.3.0.zip`, click **Extract All**, and open the **NOGGIN-v1.3.0** folder inside. **Do not merge it** with an old game folder.
2. Make sure **Node.js 20 or newer** is installed. Use the internet for the initial package installation; after it has installed successfully, the game needs only your local network.
3. Double-click **`verify-noggin.bat`** to run the automated local tests. A black window should finish with **ALL LOCAL AUTOMATED CHECKS PASSED**. Report any error text if it does not.
4. Double-click **`start-noggin.bat`**. On first start, wait for `npm install` to complete. Keep the black window open.
5. In that window find **NOGGIN SERVER IS RUNNING** and the printed TV web address. Your browser may open by itself. If not, type the *exact* address, including `/tv/` and the port number.
6. Connect four phones to the **same home router** as the laptop. Laptop Ethernet and phone Wi-Fi work together. Avoid **guest Wi-Fi**. If Windows Firewall asks, allow **Node.js** on **Private networks**. Each phone opens the QR address shown by the TV, chooses an avatar and taps **READY**.
7. Confirm four different avatars appear on the TV and all four players are marked ready. You can add up to eight phones to inspect the eight-player scoreboard.

## What to check for each fix

| Section | Action on laptop/phones | Expected result |
|---|---|---|
| A1 — Timer | Start a match and play Odd Spot, Colour Clash, Higher or Lower, Close Call and Unscramble. Leave one phone untouched. | The mini-game eventually continues without that idle phone; regular round countdowns last only seconds, not many minutes or hours. Relaxed mode should be a little slower, but still short. |
| A2 — QR/port | Note the number after the colon in the laptop TV address. Check the phone QR link uses the **same port**. If a later launch uses 3001 instead of 3000, scan its **new** QR. | Phone opens the lobby successfully; no wrong-port link. |
| B1/B2 — TV board | Start the game with four players, then with eight if available. Examine the TV at 1280×720 and 1920×1080. | Small header, no footer; board left; two-column scoreboard on the **right**; all eight players visible; scoreboard never covers numbered board spaces. |
| B3 — Sketch | Play **Sketch & Sabotage** at both TV screen sizes. | Full drawing, prompt and timer fit the screen without their bottom being cut off. |
| B4 — Phone grid | Play **Odd Spot** on a narrow phone; turn the phone upright. | Six columns × six rows of numbers, no horizontal movement. Each number easy to tap. |
| B5 — Other screens | Check lobby, all 16 mini-games, each Showdown and end result on the two TV sizes and your available phones. Check brightness in light/dark rooms. | No clipped text/controls; comfortable readable text; every interactive phone button large enough to use (roughly at least 44 pixels). **Report exceptions**; this is not yet fully verified. |
| C1 — TV-only Odd Spot | During Odd Spot, compare TV and phone. Tap a wrong number, then try again quickly. | TV has the symbols **with small numbers**. Phone has **numbers only**, no revealed odd symbol; wrong tap locks play for about three seconds. |
| C2/C4 — Board | Watch the tokens move and land together; inspect spaces 1 and 36. | Avatar faces with different rings; active token stands out; shared spaces fan the tokens; the start/end track looks continuous. |
| C3 — Classic | In the TV lobby leave **Classic** selected; start and watch the active phone. | Only **ROLL DICE** on the normal turn screen; no Director Cues, landing planning, Headline Bets, Spotlight Picks, Surprise Target or reversed Memory Lane final. |
| C3 — Showtime | Start a **new game** selecting **Showtime** in the lobby. | Original extra mechanics and optional decisions are available again. |
| D1 — Source art | Check the extracted folder. | `source-art/avatars/` contains 36 PNG originals, while `public/avatars/` contains only the `thumbs/` directory; art does not download through the game website. |
| D4 — Fonts | Open the game with internet access disconnected but the devices still connected locally via Wi-Fi/router. | Titles/body text still load without external font sites; sound and avatars remain local. |

## Play five complete turns

1. Start a match with **four READY phones** and choose Classic.
2. Phone 1 taps **ROLL DICE** and follows the TV instructions to finish the challenge.
3. Repeat when phones 2, 3 and 4 are prompted. On each turn, check the board shows the active player's face and the phone matches the TV.
4. Complete **at least five turns**, with one phone intentionally doing nothing in one timed round. Watch for a stuck countdown, lost connection, missed turn or browser error.
5. If any screen breaks, write down: TV/phone model, browser, screen size, room code, the game/round, the exact message, and which action caused it. For advanced debugging on a laptop browser press **F12**, open **Console**, and copy any red errors.

**If the TV is blank:** take the TV URL from the black window and replace `/tv/` with `/check/` to run the built-in diagnostic page. Use the **actual port number**, not an assumed `3000`. If the phone cannot connect, ensure it uses the same home network, not mobile data/guest Wi-Fi, and permit Node.js through the Windows firewall.
