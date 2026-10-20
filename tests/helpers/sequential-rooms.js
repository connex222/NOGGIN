'use strict';
// Legacy behaviour tests explicitly run the original one-at-a-time rules.
const original = require('../../server/rooms');
class GameRooms extends original.GameRooms {
  create(...args) {
    const created = super.create(...args);
    this.find(created.code).settings.roundStyle = 'sequential';
    this.find(created.code).settings.target = 12;
    return created;
  }
}
module.exports = {...original, GameRooms};
