# NOGGIN v1.2 — Real Multiplayer Rehearsal (Windows, Render, Oracle)

This guide is for a non-technical host. The game has passed unit and simulated-gateway tests, **not** a complete real network match in this development environment.

## A. Start with Windows (two phones, one TV)

1. Unzip the entire `NOGGIN-Rehearsal-v1.2` folder on your Windows computer.
2. Double-click `start-noggin.bat`; allow Windows Firewall access on **Private networks** if requested. Keep the black window open.
3. On your PC, open `http://localhost:3000/tv/` in Chrome or Edge. You should see the studio and a four-character room code.
4. Make sure both phones are on the same home network as the PC. Wired Ethernet for the PC and Wi-Fi for phones is fine **if the router connects both to the same local network**. Avoid guest Wi-Fi or mobile data.
5. Scan the QR with phone 1 and phone 2, select **different** characters, enter names, then tap **READY**.
6. Start on the TV. Confirm: phone 1 can roll, TV shows an animated move, mini-game opens, both phones get the right controls, results appear, and phone 2 receives the next turn.
7. Test **PAUSE** on the TV during a countdown; confirm the phone countdown stops, then resume.
8. Test reconnection: lock the active phone for 5 seconds, unlock it and confirm the same seat returns. Separately, close that phone's browser for 30+ seconds and verify the host can use **SKIP OFFLINE**.
9. Click **↓ MATCH REPORT** on the TV and save the downloaded JSON after the match. This file contains only timing and round-count metrics, not names, answers or tokens.

If the QR doesn't work, enter on the phone `http://<COMPUTER-ETHERNET-IP>:3000/play/` with the address shown by `ipconfig` on Windows (do not use `localhost` on the phone). Verify both devices use the same router and the Windows firewall permits Node.js on the Private network.

## B. Public hosted games — Render

1. Push this full source folder to a private GitHub repository (do not include any `node_modules` directory, state files or `.env`).
2. Connect GitHub to Render. Its `render.yaml` defines a **single** Node web service and a `/health` check.
3. After deploy, open `https://YOUR-SERVICE.onrender.com/tv/`, then open the phone QR link. All users can be on different networks.
4. On low/no-cost plans, the service may sleep or restart, causing room loss. A saved report from one instance does **not** merge with a second instance. Do not advertise uninterrupted games until you have tested restarts.

## C. Public hosted games — Oracle Cloud

1. Follow `deploy/oracle/README.md` for a Linux VM with Docker Compose, a domain, and ports 80/443 open in both the VM firewall and Oracle security rules.
2. Set `NOGGIN_DOMAIN` in `.env`. Caddy provides HTTPS and forwards to the Node game service.
3. Open `https://YOUR_DOMAIN/tv/` and test with at least two phones on external networks.
4. The container keeps checkpoints on a Docker volume. Test recovering from a container restart and verify report timers exclude offline server time.

Render and Oracle host separate rooms. Running both is **not** cross-server failover: players and rooms are not synchronised.

## D. What to record

After each real match, save the JSON report and ask the players:

- Which two rounds were most fun, and which were boring or confusing?
- Did you understand Director Cues and Headline Bets without explanation?
- How often did you wait without an interesting decision?
- Did each mini-game run correctly on your particular phone?
- Did anyone lose progress on a Wi-Fi reconnect?

Interpret `waitingPercent` as time in board decisions, result cards and pre-roll waits, not as a direct measurement of boredom. The report gives evidence about timing, **not** an entertainment score. Aim to complete 4–6-person matches with no disconnect-related crashes before a public launch.

## E. Tests on your computer

The easiest method on Windows is to double-click `verify-noggin.bat` (does not need network access). Alternatively, open a Command Prompt in the game folder:

```bat
npm install
npm test
npm run check
npm run audit
```

You should see 129 automated tests pass on v1.2. To perform the simulated Socket.IO-gateway rehearsal without a running browser or external networking, run `node --test tests/rehearsal.test.js`.

### Limitations

The gateway test uses in-process fake sockets, **not** the actual `socket.io` transport. The browser test uses mocked connections. Neither proves live phone-to-TV connectivity. An actual full match and real Render/Oracle deployments must still be checked by a person with network access. The 60 editorial Fib Factory facts remain pending verification.
