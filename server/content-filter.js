'use strict';
/**
 * A deliberately small, conservative filter for obvious adult language in
 * family rooms. This is NOT comprehensive content moderation and it does not
 * police speech or drawings. Whole-token matching avoids the Scunthorpe bug.
 */
const blocked=new Set(['fuck','fucking','fucker','motherfucker','shit','shitty','bitch','cunt','wanker','arsehole','asshole']);
function containsBlockedText(input){
 if(typeof input!=='string')return false;
 const tokens=input.normalize('NFKC').toLocaleLowerCase('en-GB').match(/[\p{L}]+/gu)||[];
 return tokens.some(w=>blocked.has(w));
}
function enforceFamilyText(room,input){
 if(room.settings?.familyFriendly!==false&&containsBlockedText(input)){
  const e=new Error('Please choose family-friendly wording for this room.');e.code='FAMILY';throw e;
 }
 return input;
}
module.exports={containsBlockedText,enforceFamilyText};
