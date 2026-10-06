import test from 'node:test';import assert from 'node:assert/strict';
import {ConversationFocus,conversationFacing} from '../public/conversation-focus.mjs';
const state=()=>({id:'room',status:'running',players:[{id:'player',state:'active',connected:true}],npcs:[{id:'teacher',conversing:false}]});
test('conversation waits for authority before observing release, and rejected/pending requests expire',()=>{
 const focus=new ConversationFocus(),s=state();focus.begin(s.id,'teacher',100);
 assert.equal(focus.observe(s,'player',101),null);assert.equal(focus.confirmed,false);
 s.npcs[0].conversing=true;assert.equal(focus.observe(s,'player',300),null);assert.equal(focus.confirmed,true);
 s.npcs[0].conversing=false;assert.equal(focus.observe(s,'player',400),'released');focus.end();assert.equal(focus.observe(s,'player',10000),null);
 focus.begin(s.id,'teacher',100);assert.equal(focus.observe(s,'player',5099),null);assert.equal(focus.observe(s,'player',5100),'timeout');
});
test('changing room, ending, missing NPC, downing or disconnecting ends local conversation focus',()=>{
 for(const edit of [s=>s.id='other',s=>s.status='ended',s=>s.npcs=[],s=>s.players[0].state='down',s=>s.players[0].connected=false,s=>s.players=[]]){
  const focus=new ConversationFocus(),s=state();focus.begin(s.id,'teacher',0);edit(s);assert.equal(focus.observe(s,'player',1),'unavailable');
 }
});
test('conversation camera faces the speaker in all quadrants without mutating player pose or gameplay angles',()=>{
 const player={x:2,z:3},before={...player};for(const [dx,dz] of [[0,-2],[2,0],[0,2],[-2,0],[1,1],[-1,-1]]){
  const facing=conversationFacing(player,{x:player.x+dx,z:player.z+dz});const distance=Math.hypot(dx,dz);
  assert.ok(Math.abs(-Math.sin(facing.yaw)-dx/distance)<1e-8);assert.ok(Math.abs(-Math.cos(facing.yaw)-dz/distance)<1e-8);assert.ok(facing.pitch<0&&facing.pitch>=-.6);
 }
 assert.deepEqual(player,before);assert.deepEqual(conversationFacing(player,player,{fallbackYaw:.8}),{yaw:.8,pitch:0});
 assert.deepEqual(conversationFacing(player,{x:NaN,z:3},{fallbackYaw:NaN}),{yaw:0,pitch:0});
 assert.ok(conversationFacing(player,{x:2,z:2},{targetGround:10}).pitch<=.6);
 assert.ok(conversationFacing(player,{x:2,z:1},{targetHeight:1.15}).pitch<conversationFacing(player,{x:2,z:1}).pitch,'narrow-screen framing raises the speaker above the bottom dialogue sheet');
});
