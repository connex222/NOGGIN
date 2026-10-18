# NOGGIN Rehearsal v1.2

**Start here:** `REHEARSAL-GUIDE.md` explains running the TV and phones on Windows, Render and Oracle, and saving match reports.

# Installing NOGGIN v1.1 — Showrunner Edition

The install instructions below from v1.0 still apply, with two changes:

- After the game starts, the TV has **PAUSE** and **SKIP OFFLINE** controls. Both are restricted to the authenticated TV host. PAUSE freezes all round clocks; SKIP appears only if the current contestant is offline. Always check with the players before skipping.
- A restored Windows/Oracle checkpoint can retain a manual host pause. After reopening the TV session, press **RESUME** when everybody is ready. Remember: only one server can own a room; running a second Render/Oracle copy does not provide failover.

Windows: Node.js 20+, extract the folder, double-click `start-noggin.bat`, then open `http://localhost:3000/tv/`. Phones visit the displayed QR link. The PC can be Ethernet and phones Wi-Fi on the same router. For public hosting, retain the existing Render and Oracle setup instructions below.

---

# NOGGIN Stagecraft v0.9 — install

This complete project retains the Windows `start-noggin.bat`, `render.yaml`, `Dockerfile`, `docker-compose.yml` and `deploy/oracle` configuration. Run **one game server per room**; separate hosts do not share rooms. On Windows, extract this ZIP and double-click `start-noggin.bat`, then open `http://localhost:3000/tv/` and join phones from the displayed QR code.

The revised rules are in `HOW-TO-PLAY.pdf`; confirm the Headline Bet control, surprise-target Count Flash and reverse Memory Lane on real phones before inviting outside players. The first Windows run must download npm packages.

# NOGGIN v0.8 Director’s Cut — Installation (Windows, Render, Oracle Cloud)

**For beginners: test on Windows first.** After that, choose Render for the simplest online demo or Oracle Cloud if you want control of a VM. No accounts or apps are needed on players' phones.

## A. Start the game on Windows

1. Download **NOGGIN-Directors-Cut.zip** and right-click **Extract All**. Open the extracted **NOGGIN-Directors-Cut** folder.
2. Ensure Node.js **20+** is installed. If you already use Node.js for your other games, there is nothing else to install manually.
3. Double-click **start-noggin.bat**. The first run automatically runs `npm install` (internet needed). Keep the black window open while playing.
4. On the Windows computer, visit **http://localhost:3000/tv/** in Chrome or Edge. Click **Enable sound** if you want audio.
5. Put phones on the same home router as the computer. An Ethernet cable to the PC and Wi-Fi to the phones **is fine**. Scan the TV QR code, pick a character and tap **Ready**. Repeat with at least two phones.
6. Press **Start the Show** on the TV. Players roll and answer using their phones.

If a phone cannot load the QR link:

- Run `ipconfig` in Command Prompt. Copy **IPv4 Address** for your PC's actual Ethernet/Wi-Fi adapter, not a virtual adapter.
- On the phone visit **http://YOUR-PC-IP:3000/play/**, replacing `YOUR-PC-IP` with that address.
- Check that Windows Defender Firewall allows **Node.js on Private networks**. Do not disable the firewall entirely. Guest/isolated Wi-Fi can block phone-to-PC connections.
- If `3000` is already used, in Command Prompt run `set PORT=3100` then `start-noggin.bat` in the same window. Use port **3100** on both TV and phone URLs.

The Windows launcher saves an optional checkpoint to `state/rooms.json` about every five seconds. **Keep this file private; it holds host/player reconnect tokens.** It is excluded from `.gitignore` commits.

## B. Deploy on Render (easiest internet-hosted demo)

1. Create an empty GitHub repository and upload the contents of the **NOGGIN-Directors-Cut** folder (not the outer ZIP). Include `render.yaml`, `server`, `public`, `data` and `package.json`.
2. In the Render Dashboard choose **New → Blueprint** and connect your repository. Review the free-plan web service proposed by `render.yaml`. Alternatively create **New → Web Service** directly, with build command `npm install --omit=dev` and start command `npm start`.
3. The app uses `process.env.PORT` and binds to `0.0.0.0`. Set `/health` as the health-check path. Set `NODE_ENV=production`. Optionally define `NOGGIN_PUBLIC_URL=https://YOUR-RENDER-HOST.onrender.com` once the URL is known, to force correct QR links. Do not use `localhost` in a public URL.
4. When Render reports **Live**, open `https://YOUR-RENDER-HOST.onrender.com/tv/` on the host TV and use the TV QR code on phones using **any** internet connection.
5. Test a real Showdown and phone reconnect; check Render logs if any client fails to connect.

**Free service constraints:** an idle free service spins down after about 15 minutes with neither inbound HTTP requests nor WebSocket messages; wake-up can take about a minute. It can restart at other times. Its local file system is ephemeral, and this Blueprint deliberately **does not** persist rooms. **Do not promise an uninterrupted public match on the free plan.** There is no cross-server room replication.

Official details: https://render.com/docs/free and https://render.com/docs/web-services .

## C. Deploy on Oracle Cloud (HTTPS on your own VM)

This route needs a Linux virtual machine and a real domain/DNS name. Read the full **deploy/oracle/README.md** first.

1. In Oracle Cloud create an Always Free-eligible Ubuntu VM with a public IPv4 address (choose ARM64 Ampere or AMD64 as available). Free capacity is **not guaranteed**; Oracle may reclaim idle instances.
2. Point a DNS **A** record such as `noggin.example.com` at the VM public IPv4 address.
3. Configure both the Oracle subnet security list/NSG and the VM firewall to allow **TCP 80 and 443**. Restrict SSH **22** to your own IP where possible. Do **not** expose Node's 3000 directly.
4. Install Docker Engine and the Docker Compose plugin using the current instructions at https://docs.docker.com/engine/install/ubuntu/ .
5. Upload/extract the NOGGIN project onto the VM. In its root directory run:

```bash
cp deploy/oracle/.env.example .env
nano .env          # set NOGGIN_DOMAIN=noggin.example.com (your real domain)
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs --tail=80 noggin
```

6. Open `https://noggin.example.com/tv/`. Caddy automatically provisions TLS if the DNS name resolves and ports 80/443 are reachable. Phones can connect via mobile data or any Wi-Fi.
7. State is checkpointed to a Docker volume. Back up that private volume before upgrades. Use **one** backend; never run two instances writing the same JSON checkpoint.

Official details: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm and https://caddyserver.com/docs/quick-starts/https .

## D. Want to use Render *and* Oracle?

They will be **two separate NOGGIN installations**, each with its own 4-letter codes, players and Sparks. A game started on Render cannot migrate to Oracle or vice versa. For now: use Render for demo/backup and Oracle for longer planned sessions. **Do not load-balance active rooms across them.** Shared global rooms are a future architectural project.

## E. Verify before inviting friends

- On a host, open `/health`: JSON should say `"ok":true`, `"phase":"playtest"`, version `1.0.0-playtest`.
- Try `npm test`, `npm run check` and `npm run audit` (offline tests; not actual websocket delivery).
- Test at least one TV, two phones, room joining, private answers, reconnect, audio, and one complete match.
- Complete the checks in `RELEASE-CHECKLIST.md` before claiming production readiness.

**If a package fails to install:** check internet/DNS, current Node version and npm output. Dependencies are downloaded on first run; they were not bundled into the ZIP.
