import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,addPlayer,startRoom,setReady,talkToNpc,remaining,stepRoom,snapshot,acceptInput,finishRoom} from '../simulation.mjs';
import {LEVEL} from '../shared/level.mjs';import {STORY_NPCS} from '../shared/story.mjs';
import {validFloorPosition} from '../shared/headquarters-layout.mjs';
function single(){const r=createRoom('SOLO','single'),p=addPlayer(r,'p','玩家');setReady(r,p,true,r.loadoutRevision,LEVEL.revision,LEVEL.characterRevision);assert.ok(startRoom(r));return {r,p};}
function talk(r,p,id,topic){const n=r.npcs.find(n=>n.id===id);p.x=n.x;p.z=n.z;talkToNpc(r,p,id,topic);}
test('single story has safe professional NPCs, free exploration, authoritative dialogue checks and one-time rest',()=>{
 const {r,p}=single();assert.throws(()=>addPlayer(r,'b','其他玩家'));assert.equal(r.enemies.length,0);for(const n of STORY_NPCS)assert.ok(validFloorPosition(n.x,n.z));
 stepRoom(r,301);assert.equal(r.status,'running');assert.equal(remaining(r),300);
 assert.throws(()=>talkToNpc(r,p,'finance','ledger'));assert.throws(()=>talk(r,p,'lawyer','reason'),/线索/);assert.throws(()=>talk(r,p,'teacher','fake'));
 p.hp=40;talk(r,p,'doctor','rest');assert.equal(p.hp,60);talk(r,p,'doctor','rest');assert.equal(p.hp,60);
 assert.equal(snapshot(r).story.dialogue.name,'林医生');
});
test('evidence offers distinct peaceful and challenge routes without duplicated clues or enemy waves',()=>{
 for(const route of ['reason','challenge']){const {r,p}=single();for(const [id,topic]of [['teacher','schedule'],['lawyer','policy'],['finance','ledger']]){talk(r,p,id,topic);talk(r,p,id,topic);}assert.equal(r.story.clues.length,3);
 talk(r,p,route==='reason'?'lawyer':'finance',route);const count=r.enemies.length;talk(r,p,route==='reason'?'lawyer':'finance',route);assert.equal(r.enemies.length,count);
 if(route==='reason'){assert.equal(r.exitOpen,true);stepRoom(r,1);assert.equal(r.enemies.length,0);assert.equal(r.story.phase,'resolved');}else{assert.equal(count,LEVEL.enemies.length);stepRoom(r,1);assert.ok(remaining(r)<300);assert.equal(r.story.phase,'challenge');}
 }
});


test('chosen route is authoritative, resolved NPCs acknowledge it, and extraction produces a personal ending once',()=>{
 const {r,p}=single();for(const [id,topic]of [['teacher','schedule'],['lawyer','policy'],['finance','ledger'],['doctor','rest'],['poet','verse']])talk(r,p,id,topic);
 talk(r,p,'lawyer','reason');const choices=[...r.story.choices];assert.throws(()=>talk(r,p,'finance','challenge'),/分支已确定/);assert.deepEqual(r.story.choices,choices);assert.equal(r.enemies.length,0);
 talk(r,p,'teacher','schedule');assert.match(r.story.dialogue.text,/晚上领回来/);assert.equal(r.story.clues.filter(c=>c==='schedule').length,1);
 p.x=LEVEL.exit.x;p.z=LEVEL.exit.z;
 for(let i=0;i<35&&r.status==='running';i++){acceptInput(p,{sequence:p.sequence+1,x:0,z:0,interact:true,aimX:0,aimZ:1},r.elapsed);stepRoom(r,1/30);}
 assert.equal(r.status,'ended');assert.equal(r.result.storyEnding.id,'reason');assert.equal(r.result.storyEnding.evidence.length,3);assert.equal(r.result.storyEnding.voices.length,3);assert.equal(r.result.storyEnding.selfCare,true);assert.equal(r.result.storyEnding.declaration,true);assert.ok(snapshot(r).npcs.every(n=>!n.conversing));
 const result=r.result;finishRoom(r,'timeout');stepRoom(r,1);assert.equal(r.result,result);
});

test('single challenge reaches its ending through real handovers, combat, boss defeat and extraction inputs',()=>{
 const {r,p}=single();for(const [id,topic]of [['teacher','schedule'],['lawyer','policy'],['finance','ledger']])talk(r,p,id,topic);talk(r,p,'finance','challenge');
 const route=[{x:0,z:.6},{x:-7,z:.6},{x:-7,z:5.8},{...LEVEL.objectives[0],objective:0},{x:-7,z:5.8},{...LEVEL.objectives[1],objective:1},{x:0,z:.6},{x:0,z:-2.5}];let waypoint=0,sawResolved=false;
 for(let tick=0;tick<300*30&&r.status==='running';tick++){
  const boss=r.enemies.find(e=>e.kind==='boss'&&e.hp>0),goal=waypoint<route.length?route[waypoint]:boss||LEVEL.exit;
  const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);if(waypoint<route.length&&d<.4&&(goal.objective===undefined||r.objectives[goal.objective].done))waypoint++;
  const stop=d<.3||(waypoint>=route.length&&boss&&d<1.7);acceptInput(p,{sequence:p.sequence+1,x:stop?0:dx/Math.max(1,d),z:stop?0:dz/Math.max(1,d),attack:true,skill:true,interact:true,transform:true},r.elapsed);stepRoom(r,1/30);
  if(r.story.phase==='resolved'){sawResolved=true;assert.equal(r.exitOpen,true);assert.ok(r.enemies.some(e=>e.kind==='boss'&&e.hp===0));}
 }
 assert.equal(r.result?.success,true,JSON.stringify({result:r.result,waypoint,x:p.x,z:p.z,hp:p.hp}));assert.ok(sawResolved);assert.equal(r.result.storyEnding.id,'challenge');assert.equal(r.story.phase,'ended');assert.ok(p.kills>0);
});

test('failure endings distinguish timeout, downing and departure without inventing optional conversations',()=>{
 for(const [reason,id]of [['timeout','timeout'],['team_down','down'],['resolved','left']]){const {r}=single();finishRoom(r,reason);assert.equal(r.result.storyEnding.id,id);assert.equal(r.result.storyEnding.evidence.length,0);assert.equal(r.result.storyEnding.voices.length,1);assert.equal(r.result.storyEnding.selfCare,false);assert.equal(r.result.storyEnding.declaration,false);}
});
