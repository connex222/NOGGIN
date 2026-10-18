'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(base,'public/tv/board-view.js'),'utf8');
const html=fs.readFileSync(path.join(base,'public/tv/index.html'),'utf8');
const css=fs.readFileSync(path.join(base,'public/tv/arena-board.css'),'utf8');

class FakeClasses {
 constructor(...names){this.set=new Set(names);}
 add(s){this.set.add(s);}
 remove(s){this.set.delete(s);}
 contains(s){return this.set.has(s);}
 toggle(s,on){on?this.add(s):this.remove(s);}
}
class FakeNode {
 constructor(tag){this.tagName=tag;this.className='';this.children=[];this.dataset={};this.style={};this.classList=new FakeClasses();this.attributes={};this.textContent='';this.animations=0;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;}
 animate(frames,timing){this.animations++;this.frames=frames;this.timing=timing;return {};}
}
function environment(reduced=false){
 const ids={diceOverlay:new FakeNode('div'),diceTray:new FakeNode('div'),diceInfo:new FakeNode('div')};
 ids.diceOverlay.classList.add('hidden');const pending=new Map();let tick=0,timerId=0;
 const context={window:{matchMedia:()=>({matches:false})},
   document:{createElement:tag=>new FakeNode(tag),getElementById:id=>ids[id],documentElement:{classList:new FakeClasses(...(reduced?['reduce-motion']:[]))}},
   setTimeout(fn,ms){const id=++timerId;pending.set(id,{fn,ms});return id;},
   clearTimeout(id){pending.delete(id);}
 };
 vm.runInNewContext(source,context);
 return {view:new context.window.NogginBoardView([]),ids,pending,run(ms){const actions=[...pending.entries()].filter(([,e])=>e.ms<=ms);for(const [id,a] of actions){if(pending.delete(id))a.fn();}}};
}

test('Dice Theatre keeps the old code and live game routes intact',()=>{
 assert.match(html,/id="diceTray"/);
 assert.match(html,/id="diceInfo"/);
 assert.match(html,/id="qrImage"/);
 assert.match(html,/id="boardGraphic"/);
 assert.match(css,/noggin-die-face/);
 assert.match(css,/preserve-3d/);
 assert.match(source,/b\.lastMove\.die/);
 assert.doesNotMatch(source,/Math\.random\(/);
});
test('Every die face has the correct number of pips (1 to 6)',()=>{
 const {view}=environment();
 for(let n=1;n<=6;n++){
   const {outer,cube}=view.createDie(n);
   assert.equal(outer.dataset.result,String(n));
   assert.equal(cube.children.length,6);
   const faces=[1,6,3,4,2,5];
   assert.deepEqual(cube.children.map(f=>f.children.length),faces);
   assert.equal(view.dieAngles(n).length,2);
 }
});
test('Single die animates the server-picked value exactly once',()=>{
 const x=environment();const events=[];x.view.onDiceFx=s=>events.push(s);
 let settled=0;
 x.view.showDie([5],true,()=>{settled++;},'revision-17');
 assert.equal(x.ids.diceTray.children.length,1);
 assert.equal(x.ids.diceTray.children[0].dataset.result,'5');
 assert.equal(x.ids.diceTray.children[0].children[0].animations,1);
 assert.equal(x.ids.diceInfo.textContent,'ROLLING THE DICE…');
 x.view.showDie([5],true,()=>{settled++;},'revision-17');
 assert.equal(events.length,1,'repeated room states must not restart roll SFX');
 x.run(1240);
 assert.equal(settled,1);
 assert.equal(x.ids.diceInfo.textContent,"IT'S A 5!");
 assert.deepEqual(events,['start','land']);
 x.run(650);
 assert.ok(x.ids.diceOverlay.classList.contains('hidden'));
});
test('Catch-up dice stay visible until the player chooses a die',()=>{
 const x=environment();
 x.view.showDie([2,6],true,null,'catchup-7',true,'CHOOSE YOUR DIE');
 assert.equal(x.ids.diceTray.children.length,2);
 x.run(1240);
 assert.equal(x.ids.diceInfo.textContent,'CHOOSE YOUR DIE · 2 OR 6');
 x.run(2000);
 assert.ok(!x.ids.diceOverlay.classList.contains('hidden'));
 x.view.hideDie();
 assert.ok(x.ids.diceOverlay.classList.contains('hidden'));
});
test('Reduce Motion shows the correct die without 3D tumbling',()=>{
 const x=environment(true);let done=0;
 x.view.showDie([4],true,()=>{done++;},'revision-18');
 assert.equal(x.ids.diceTray.children[0].children[0].animations,0);
 x.run(0);
 assert.equal(x.ids.diceInfo.textContent,"IT'S A 4!");
 assert.equal(done,1);
});
