'use strict';
// Rebuilds public/voice/voice-manifest.json and VOICE-SCRIPT.md. Optional:
// the running server already serves a live manifest built from the folder.
require('../server/voice').build && console.log((() => {const r = require('../server/voice').build(); return `Voice: ${r.done}/${r.total} lines recorded.${r.unknown.length ? ' Ignored (unknown names): ' + r.unknown.join(', ') : ''}`;})());
