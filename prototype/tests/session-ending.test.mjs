import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {randomUUID} from 'node:crypto';
import {GameSession} from '../client/session.mjs';
import {LEVEL} from '../shared/level.mjs';
async function wait(fn,timeout=7000){const end=performance.now()+timeout;while(performance.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Ending session timed out');}

test('real WebSocket chapter travels the approved floor, gathers evidence, negotiates and extracts to its personal ending',{timeout:60000},async t=>{
 const server=spawn(process.execPath,['prototype/server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});t.after(()=>server.kill());const url=await new Promise((resolve,reject)=>{server.stdout.on('data',s=>{const m=String(s).match(/http:\/\/127\.0\.0\.1:\d+/);if(m)resolve(m[0]);});server.once('error',reject);});
 const messages=[],trace=[];const c=new GameSession({openSocket:()=>new WebSocket(url.replace('http:','ws:')+'/socket'),requestId:randomUUID,onMessage:m=>messages.push(m)});t.after(()=>c.dispose());let intent={x:0,z:0};const timer=setInterval(()=>{c.tick();if(c.state?.status==='running')c.input(intent);},1000/30);t.after(()=>clearInterval(timer));
 const me=()=>c.state.players.find(p=>p.id===c.playerId),record=label=>trace.push({label,elapsed:c.state.elapsed,x:me().x,z:me().z,phase:c.state.story.phase,clues:[...c.state.story.clues],route:c.state.story.route});
 async function travel(x,z){await wait(()=>{const p=me(),dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);intent={x:d<.32?0:dx/Math.max(1,d),z:d<.32?0:dz/Math.max(1,d),aimX:dx/Math.max(.01,d),aimZ:dz/Math.max(.01,d)};return d<.32;},12000);intent={x:0,z:0};}
 async function talk(npcId,topicId){c.command({type:'dialogue',npcId,topicId});await wait(()=>c.state.story.dialogue?.npcId===npcId&&c.state.story.dialogue.topicId===topicId);record(npcId+':'+topicId);c.command({type:'conversation',active:false});}
 c.connect();await wait(()=>c.connected);c.send({type:'create',mode:'single',name:'剧情回归员工'});await wait(()=>c.state?.status==='lobby');c.ready();await wait(()=>me().ready);c.command({type:'start'});await wait(()=>c.state.status==='running');record('start');
 await talk('teacher','schedule');await travel(-7,5.8);await talk('poet','verse');await travel(-7,.6);await talk('lawyer','policy');await travel(0,.6);await travel(0,-9);await talk('doctor','rest');await travel(0,-16.9);await talk('finance','ledger');
 await travel(0,.6);await travel(-7,.6);await talk('lawyer','reason');assert.equal(c.state.exitOpen,true);assert.equal(c.state.enemies.length,0);
 c.command({type:'dialogue',npcId:'lawyer',topicId:'reason'});await new Promise(r=>setTimeout(r,100));assert.equal(c.state.story.choices.filter(k=>k==='lawyer:reason').length,1);
 await travel(LEVEL.exit.x,LEVEL.exit.z);await wait(()=>{if(c.state.status==='ended')return true;const p=me(),dx=LEVEL.exit.x-p.x,dz=LEVEL.exit.z-p.z,d=Math.max(.01,Math.hypot(dx,dz));intent={x:0,z:0,aimX:dx/d,aimZ:dz/d,interact:true};return false;});record('extracted');
 assert.equal(c.state.result.storyEnding.id,'reason');assert.equal(c.state.result.storyEnding.evidence.length,3);assert.equal(c.state.result.storyEnding.voices.length,3);assert.equal(c.state.result.success,true);assert.equal(me().state,'extracted');assert.ok(c.state.npcs.every(n=>!n.conversing));assert.deepEqual(messages,[]);
 await writeFile('artifacts/story-ending-network-playthrough.json',JSON.stringify({scope:'actual local WebSocket/GameSession rules playthrough; no browser/device visual claim',protocol:c.state.protocolVersion,rules:c.state.rulesVersion,trace,result:c.state.result},null,2)+'\n');c.leave();assert.equal(c.state,null);
});
