import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {GameSession} from '../client/session.mjs';
import {InputControls} from '../client/input-controls.mjs';

async function wait(predicate,timeout=7000){const end=performance.now()+timeout;while(performance.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,15));}throw Error('Session condition timed out');}

test('shared engine session: four distinct loadouts, reliable start, authoritative movement and resume', {timeout:20000},async t=>{
 const server=spawn(process.execPath,['prototype/server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});t.after(()=>server.kill());
 const url=await new Promise((resolve,reject)=>{server.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(match)resolve(match[0]);});server.once('error',reject);});
 const messages=[],events=[];const clients=Array.from({length:4},()=>new GameSession({openSocket:()=>new WebSocket(url.replace('http:','ws:')+'/socket'),requestId:randomUUID,onMessage:text=>messages.push(text),onEvent:event=>events.push(event.id)}));
 t.after(()=>clients.forEach(c=>c.dispose()));const timer=setInterval(()=>clients.forEach(c=>c.tick()),30);t.after(()=>clearInterval(timer));clients.forEach(c=>c.connect());await wait(()=>clients.every(c=>c.connected));
 clients[0].send({type:'create',name:'Engine host',role:'coder',gender:'female',job:'sales'});await wait(()=>clients[0].state?.status==='lobby');
 const code=clients[0].state.id;clients.slice(1).forEach((c,i)=>c.send({type:'join',code,name:`Engine ${i}`,role:i===0?'admin':'coder',gender:i===1?'female':'male',job:['ecommerce','celebrity','programmer'][i]}));await wait(()=>clients.every(c=>c.state?.players.length===4));
 clients.forEach(c=>c.ready());await wait(()=>clients.every(c=>c.state.players.every(p=>p.ready)));clients[0].command({type:'start'});await wait(()=>clients.every(c=>c.state.status==='running'));
 assert.equal(new Set(clients[0].state.players.map(p=>`${p.gender}_${p.job}`)).size,4);
 const c=clients[0],before=c.prediction.pose.z,id=c.playerId,token=c.token;
 c.input({x:0,z:-1,aimX:0,aimZ:-1});assert.ok(c.prediction.pose.z<before,'prediction precedes a server snapshot');
 const controls=new InputControls();controls.setActive(true);controls.press('forward');
 const movement=setInterval(()=>c.input(controls.next()),34);t.after(()=>clearInterval(movement));
 // No render/update callbacks: input heartbeat must outlive the 300 ms server lease.
 await new Promise(r=>setTimeout(r,600));await wait(()=>c.state.players.find(p=>p.id===id).z<before-1);
 controls.setActive(false);c.input(controls.next());clearInterval(movement);
 await wait(()=>c.state.players.find(p=>p.id===id).appliedSequence>=c.sequence-1);const stopped=c.state.players.find(p=>p.id===id).z;await new Promise(r=>setTimeout(r,200));assert.equal(c.state.players.find(p=>p.id===id).z,stopped,'modal neutral input stops server movement');
 const latest=c.state;c.apply({...latest,tick:latest.tick-1,players:latest.players.map(p=>({...p,x:99}))});assert.equal(c.state,latest);assert.notEqual(c.prediction.pose.x,99);
 c.disconnect();await wait(()=>c.socket.readyState===3);c.connect();await wait(()=>c.connected&&c.socket.readyState===1&&c.state.players.find(p=>p.id===id).connected&&c.commands.available);
 assert.equal(c.playerId,id);assert.equal(c.token,token);assert.equal(c.state.id,code);assert.ok(c.eventAck>=0);assert.deepEqual(messages,[]);
 c.leave();assert.equal(c.token,null);assert.equal(c.prediction.pose,null);await wait(()=>clients[1].state.players.find(p=>p.id===id).state==='left');
 assert.equal((await fetch(url+'/engine/%2e%2e%2f%2e%2e%2fAGENTS.md')).status,404);
});

test('engine session refuses resource mismatch; disposed sessions do not reconnect',()=>{
 let opened=0,closed=0;const socket={readyState:1,send(){},close(){closed++;}};let now=0;const notices=[];
 const c=new GameSession({openSocket:()=>{opened++;return socket;},requestId:()=>String(now),clock:()=>now,onMessage:text=>notices.push(text)});c.connect();
 c.receive({type:'hello',protocolVersion:3,rulesVersion:'rules-0.5.0',assetVersion:'wrong',characterVersion:'wrong'});assert.equal(c.closed,true);assert.equal(closed,1);socket.readyState=3;now=5000;c.tick();assert.equal(opened,1);assert.match(notices[0],/版本/);c.dispose();
});
