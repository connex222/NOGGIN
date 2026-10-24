# Host voice recordings

Put your recordings in this folder, named exactly as in `VOICE-SCRIPT.md` (for example `welcome.mp3`, `game-odd-spot.mp3`; extra takes as `welcome-2.mp3`, `welcome-3.mp3`). MP3, M4A, OGG or WAV all work.

Upload them to GitHub in `public/voice/` and redeploy. The server finds them automatically; the TV picks a random take each time and stays silent for any line you haven't recorded.

Optional: `node tools/make-voice-manifest.js` ticks off recorded lines in `VOICE-SCRIPT.md`.
