'use strict';
// Directly reads the same server-side board and game modules used during play.
const board=require('../server/board');
const speedBrain=require('../server/games/phase3').SPECS;
const social=require('../server/games/phase4');
const createTogether=social.SPECS;
const avatars=require('../public/shared/avatars.json');
const data={
 name:'NOGGIN — Use Your Head',
 players:{min:2,max:8},
 roundOptions:board.ROUND_OPTIONS.filter(Number.isInteger),
 autoRounds:{small:board.autoRounds(2),medium:board.autoRounds(4),large:board.autoRounds(8)},
 boardSpaces:board.SPACES.length,
 catchUp:{threshold:board.UNDERDOG_THRESHOLD,extraSmall:board.UNDERDOG_BONUS_SMALL,extraEight:board.UNDERDOG_BONUS_EIGHT},
 bonusStart:{pass:board.START_PASS_BONUS,land:board.START_LAND_BONUS},
 applause:board.APPLAUSE_BONUS,
 roundGameBonus:board.ROUND_GAME_BONUS,
 cornerBonus:board.CORNER_BONUS,
 directorsCut:{cues:board.DIRECTORS_CUES,nudge:1,refill:1},
 roundScore:{hostWin:2+board.ROUND_GAME_BONUS,otherWinner:1+board.ROUND_GAME_BONUS},
 showdownTransfer:2,
 categories:Object.fromEntries(['speed','brain','create','together'].map(c=>[c,Object.values({...speedBrain,...createTogether}).filter(x=>x.category===c).map(x=>x.name)])),
 showdowns:Object.values(board.SHOWDOWNS),
 twoPlayerSkips:social.TWO_PLAYER_UNAVAILABLE.map(id=>createTogether[id].name),
 specialSpaces:Object.keys(board.COLORS).filter(k=>!['speed','brain','create','together','showdown'].includes(k)).map(k=>board.LABELS[k]),
 avatars:avatars.length
};
if(Object.values(data.categories).some(g=>g.length!==4))throw Error('Expected four mini-games per category');
console.log(JSON.stringify(data));
