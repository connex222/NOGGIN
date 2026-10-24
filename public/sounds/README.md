# NOGGIN — original audio production pack

This build bundles **20 newly composed sound-effect cues** as MP3 and **three seamless original ambient music loops** in OGG format. The sounds are **newly rendered electronic audio designs**, not professionally recorded field sounds, and use no sampled third-party music, recordings, soundfonts or external assets. They are local files that work offline. Generated programmatically for this NOGGIN release.

## TV controls

- Click **Enable sound** once per browser session: browsers require user interaction for audio.
- **FX** changes the volume of effects; **MUSIC** separately sets ambient volume.
- **Music on/off** independently switches background tracks. Your preferences persist on the TV browser.
- Lobby, board and challenge/Showdown have separate music loops; winner events silence the music for the victory cue.
- Music is automatically quieter while a sound effect plays. Phones remain silent.

Files are listed in `sound-manifest.json`. To replace an effect with a licensed studio-produced recording, overwrite the named MP3. To replace background music, overwrite the `mus-lobby.ogg`, `mus-board.ogg`, or `mus-tension.ogg` file with OGG audio, or edit the music map in the manifest to a local MP3. Prefer edited loops without abrupt tails. NOGGIN uses the file extension only for browser loading; it does not fetch assets from external servers.

## Licensing and commercial use

These audio files were created from original synthesis without third-party samples. They are supplied as part of this NOGGIN build. For additional recorded effects, use sources with clear commercial rights such as Kenney CC0 packs (https://kenney.nl/assets/interface-sounds) and retain license attribution as required. Avoid television-game-show samples, broadcast jingles, or sound effects from commercial games.

## NOGGIN Dice Theatre (v2)

The TV now calls `sfx-dice-roll` when the die starts tumbling and `sfx-dice-land` when it stops.
If no `sfx-dice-land.mp3` is included in `sound-manifest.json`, the game plays the
existing `sfx-reel-stop.mp3` as its temporary landing sound. You can replace that
with a recorded wooden or resin dice clack in future. Add its filename to the manifest
`files` array when supplying the replacement. Audio never chooses the roll result.
