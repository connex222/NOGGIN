# NOGGIN Showrunner — interruption and recovery guide

## Normal pause

On the TV board, click **PAUSE**. A paused banner appears on the TV and all phones. Answers cannot be sent while paused. Press **RESUME** and the clocks restart with the remaining time intact. Pausing does not give a player extra Sparks, Cues or answers.

## A player's phone disconnects

When it is the current player's turn, the game pauses automatically for up to **30 seconds**. Reopen the same phone tab or site: the stored session should recover its original seat. If it cannot reconnect, the TV host may click **SKIP OFFLINE**, confirm the player's name and continue. If nobody intervenes, the normal 30-second rule skips the turn. Skipped Headline Bets are cancelled, not charged.

The TV cannot skip an **online** player. If the room is manually paused, press RESUME before considering a skip. This prevents accidental skipping while players have agreed to a break.

## TV host connection lost

The room pauses until the authenticated TV session returns. Reopen `/tv/` in the same browser profile (do not clear browser site data). A failed QR regeneration leaves the original host in place rather than replacing it. On recovery the game clocks continue from their prior position.

## Windows or Oracle restart with checkpoints

Use one running server and a writable private state directory. The optional `NOGGIN_STATE_FILE` points to a checkpoint file. If the game was paused deliberately before restarting, it stays paused on recovery. Reopen the original TV browser session and press RESUME once phones have rejoined. The checkpoint contains private reconnect tokens; **never upload it to a public repository or share it**.

## Render

Rooms normally live in memory and do not survive service replacement on an ephemeral free instance. PAUSE does not prevent the service from sleeping or restarting. A deployment to Oracle cannot recover a room from Render automatically. For uninterrupted paid public service, a future storage/coordination upgrade is needed.

## Ten-minute acceptance test

1. Start the TV, join two phones and play until a Quick Draw/Count Flash round occurs.
2. Pause mid-round; check that both phones show a paused state and cannot submit.
3. Resume after a break; check that the TV display and phone timers agree.
4. During the active player's turn, switch that phone to airplane mode and reconnect within 30 seconds. Check their original avatar and Sparks remain.
5. Disconnect the active phone again; use SKIP OFFLINE. Confirm only that turn is skipped and no Headline Bet penalty is charged.
6. Make sure an online player cannot be skipped and a phone cannot operate the TV host buttons.
7. Finish an entire four-player game and record any delays or games that feel repetitive.
