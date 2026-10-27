# NOGGIN — Game Night Checklist

One page. Tick it off on the day.

## The day before
- [ ] **Don't change anything on game day.** No deploying to Render and no pushing to GitHub. A push makes Render restart, and a restart wipes any game in progress.
- [ ] Do one quick test the day before: TV page plus one phone, join, ready, start, play one round.
- [ ] Charge the laptop you'll use as the backup (see the bottom of this page).

## 5 minutes before guests arrive
- [ ] Open the TV page (`https://noggin-0u32.onrender.com/tv/`). The free Render server goes to sleep when nobody uses it. The first visit wakes it, which can take up to a minute.
- [ ] Wait until the room code and QR code appear.
- [ ] Click **▶ Enable sound** once on the TV. Browsers stay silent until someone clicks.

## When players join
- [ ] Everyone scans the QR code, picks a character and taps **READY**.
- [ ] Tell players: **keep the NOGGIN page open.** If your screen keeps locking, turn off battery saver and come straight back to the page. Your lobby seat is held for 10 minutes.
- [ ] A player shown as RECONNECTING but READY does **not** stop you starting. They drop back into their seat when their phone wakes.

## During the game
- [ ] A phone dropping out is fine. In most games the show carries on. In Sketch Sabotage, Noise Annoys, Mind Meld and Bomb Squad the game waits 30 seconds for the host, then hands hosting to the next player.
- [ ] Refreshing a phone is safe. It goes back into the same seat.

## If the TV says "The game server restarted"
- The previous game is lost. Sorry, the free server can't keep it.
- [ ] Everyone scans the **new** QR code on the TV and joins again.
- [ ] Phones show "The game was reset on the TV — scan the new QR code".

## Backup plan: no internet, or Render won't wake
- [ ] On the Windows laptop, double-click **`start-noggin.bat`**.
- [ ] Open the TV address it shows (for example `http://localhost:3000/tv/`) and put that on the TV.
- [ ] **Every phone must be on the same Wi-Fi as the laptop.** Mobile data won't work.
- [ ] Phones scan the QR code on the TV as normal.

## After the night
- [ ] On the TV, click **↓ MATCH REPORT** to download the results file before closing the page.
- [ ] Then close the TV page.
