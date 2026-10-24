'use strict';
// Regenerates public/shared/board-data.json from server/layout.js.
// Run after changing the board: node tools/make-board-data.js
const fs = require('node:fs');
const path = require('node:path');
const {boardData} = require('../server/layout');
const out = path.join(__dirname, '..', 'public', 'shared', 'board-data.json');
fs.writeFileSync(out, JSON.stringify(boardData(), null, 2) + '\n');
console.log(`Wrote ${boardData().length} spaces to ${path.relative(process.cwd(), out)}`);
