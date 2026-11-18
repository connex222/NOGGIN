'use strict';
// Legacy behaviour tests explicitly run the original one-at-a-time rules.
const original = require('../../server/rooms');
class GameRooms extends original.GameRooms {
  create(...args) {
    const created = super.create(...args);
    const settings = this.find(created.code).settings;
    settings.roundStyle = 'sequential';
    // Legacy timing tests predate the Ready Check and the Relaxed default.
    settings.readyCheck = false;
    settings.timerSpeed = 'normal';
    return created;
  }
}
module.exports = {...original, GameRooms};
