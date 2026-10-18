# NOGGIN TV sounds

**No MP3 files are necessary.** The TV creates sound effects and musical motifs with its local Web Audio engine in `/tv/sound.js`. Players must click **Enable sound** on the TV at least once because browsers block autoplay. Sound is TV-only; phones vibrate if supported.

To supply professional MP3 files later, copy the files into this folder and add the actual filenames to `sound-manifest.json`'s `files` array. When a named clip is absent or fails to play, code synthesizes the requested cue. File names:

`sfx-join.mp3`, `sfx-dice-roll.mp3`, `sfx-hop.mp3`, `sfx-reel.mp3`, `sfx-reel-stop.mp3`, `sfx-countdown.mp3`, `sfx-go.mp3`, `sfx-tick.mp3`, `sfx-correct.mp3`, `sfx-wrong.mp3`, `sfx-buzz.mp3`, `sfx-gunshot.mp3`, `sfx-boom.mp3`, `sfx-spark-gain.mp3`, `sfx-spark-lose.mp3`, `sfx-swap.mp3`, `sfx-showdown.mp3`, `sfx-crowd-cheer.mp3`, `sfx-crowd-aww.mp3`, `mus-lobby.mp3`, `mus-board.mp3`, `mus-tension.mp3`, `mus-victory.mp3`.

Sound file licensing and music composition remain separate release tasks. Do not copy licensed broadcast/game-show clips without appropriate rights.
