'use strict';
// NOGGIN v3 board layout: a 28-space trapezium with a Showdown on every corner.
// Shared by the board engine, the Showdown engine and the generated TV metadata.
//
//            10 ─ 11 12 13 14 15 16 17 ─ 18          (top edge, narrower)
//           9                              19
//          8                                20
//         7                                  21
//        6 ─ 5 4 3 2 1 [0 START] 27 26 25 24 23 ─ 22  (bottom edge, wider)
//
// Index order runs clockwise from START (bottom middle) towards the bottom-left corner.
const SPACES = Object.freeze([
  'start',                                                          // 0
  'brain', 'speed', 'drain', 'create', 'applause',                  // 1-5  bottom-left
  'showdown',                                                       // 6    corner: Buzzer Battle
  'together', 'lift', 'brain',                                      // 7-9  left side
  'showdown',                                                       // 10   corner: Tug of Wits
  'speed', 'create', 'swap', 'wildcard', 'brain', 'pickpocket', 'together', // 11-17 top
  'showdown',                                                       // 18   corner: Bid to Win
  'create', 'lift', 'speed',                                        // 19-21 right side
  'showdown',                                                       // 22   corner: Nerve
  'together', 'drain', 'applause', 'wildcard', 'brain'              // 23-27 bottom-right
]);
const CORNERS = Object.freeze([6, 10, 18, 22]);
const SHOWDOWNS = Object.freeze({6: 'Buzzer Battle', 10: 'Tug of Wits', 18: 'Bid to Win', 22: 'Nerve'});
const SHOWDOWN_KINDS = Object.freeze({6: 'buzzer', 10: 'tug', 18: 'bid', 22: 'nerve'});
const LIFTS = Object.freeze({8: 20, 20: 8});
const CATEGORIES = Object.freeze(['speed', 'brain', 'create', 'together']);
const COLORS = Object.freeze({speed: '#ff667e', brain: '#64aeff', create: '#ffe477', together: '#9de97c', showdown: '#ffd168', start: '#ffffff', swap: '#be95ff', pickpocket: '#adb8cb', drain: '#98a1bc', wildcard: '#ff9ed9', lift: '#72f2ec', applause: '#ffb46b'});
const ICONS = Object.freeze({speed: '⚡', brain: '◆', create: '✎', together: '✚', showdown: '★', start: '⌂', swap: '⇄', pickpocket: '◈', drain: '−', wildcard: '✳', lift: '⇧', applause: '♪'});
const LABELS = Object.freeze({speed: 'Speed', brain: 'Brain', create: 'Create', together: 'Together', showdown: 'Showdown', start: 'Start', swap: 'Swap Seats', pickpocket: 'Pickpocket', drain: 'Brain Drain', wildcard: 'Wildcard', lift: 'Stage Lift', applause: 'Applause'});

function boardData() {
  return SPACES.map((type, index) => ({
    index, type, color: COLORS[type], icon: ICONS[type],
    label: type === 'showdown' ? SHOWDOWNS[index] : LABELS[type],
    ...(type === 'lift' ? {liftTo: LIFTS[index]} : {}),
    ...(CORNERS.includes(index) ? {corner: true} : {})
  }));
}

module.exports = {SPACES, CORNERS, SHOWDOWNS, SHOWDOWN_KINDS, LIFTS, CATEGORIES, COLORS, ICONS, LABELS, boardData};
