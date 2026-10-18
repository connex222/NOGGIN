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
 targetOptions:[8,12,16],
 boardSpaces:board.SPACES.length,
 catchUp:{threshold:board.UNDERDOG_THRESHOLD,extraSmall:board.UNDERDOG_BONUS_SMALL,extraEight:board.UNDERDOG_BONUS_EIGHT},
 bonusStart:{pass:1,land:2},
 directorsCut:{cues:board.DIRECTORS_CUES,nudge:1,refill:1},
 headlineBet:{win:board.HEADLINE_WIN_BONUS,loss:board.HEADLINE_LOSS_PENALTY},
 roundScore:{hostWin:2,otherWinner:1},
 showdownTransfer:2,
 categories:Object.fromEntries(['speed','brain','create','together'].map(c=>[c,Object.values({...speedBrain,...createTogether}).filter(x=>x.category===c).map(x=>x.name)])),
 showdowns:Object.values(board.SHOWDOWNS),
 twoPlayerSkips:social.TWO_PLAYER_UNAVAILABLE.map(id=>createTogether[id].name),
 specialSpaces:Object.keys(board.COLORS).filter(k=>!['speed','brain','create','together','showdown'].includes(k)).map(k=>board.LABELS[k]),
 avatars:avatars.length
};
if(Object.values(data.categories).some(g=>g.length!==4))throw Error('Expected four mini-games per category');
console.log(JSON.stringify(data));
