# NOGGIN v1.2 Windows Startup Fix

This package fixes the `EADDRINUSE 0.0.0.0:3000` crash caused by another program already listening on port 3000.

## Simple Windows steps

1. Close the old NOGGIN error window.
2. Extract this complete ZIP to a NEW folder (don't mix it with an older extracted game).
3. Double-click `start-noggin.bat`.
4. Look for `NOGGIN SERVER IS RUNNING`. The black window will display the **actual** TV URL. It might use port 3000, 3001, 3002, etc.
5. Open exactly that URL on your PC. Example: `http://localhost:3001/tv/`.
6. Join from a phone using the freshly displayed QR code or phone address. Do not use an old saved URL or QR code.

The launcher attempts the next available port from the configured port through ten higher ports. It does not terminate any other Windows process and does not change the required port when hosted on Render or Oracle.

## If there is still an error

Open Command Prompt and run:

    netstat -ano | findstr :3000

If you see `LISTENING`, another program owns port 3000. Find its PID (last column), then run `tasklist /FI "PID eq 12345"`, replacing 12345 with the actual PID. Only stop the process if you recognise it.

Use `http://localhost:3000/health` to see if an older NOGGIN server already responds on port 3000.

This is a startup bug fix only. Live Socket.IO sessions still need real-device testing.
