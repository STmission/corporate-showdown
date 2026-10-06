import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir,writeFile } from 'node:fs/promises';
import { WebSocket } from 'ws';
import { PROTOCOL_VERSION,RULES_VERSION } from '../shared/protocol.mjs';
import { LEVEL } from '../shared/level.mjs';
import { consumeEvents } from '../public/reliable-channel.mjs';
import { MovementPrediction } from '../public/network-state.mjs';

async function serverFixture(t){
 const child=spawn(process.execPath,['prototype/server.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());
 const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Server startup timeout')),8000);child.stdout.on('data',b=>{const m=b.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timeout);resolve(m[0]);}});child.once('error',reject);});
 async function client(rtt=0){
  const ws=new WebSocket(url.replace('http','ws')+'/socket'),frames=[],waits=[],timers=new Set();let commandSequence=0;let count=0,onState=()=>{};
  const later=fn=>{if(!rtt){fn();return;}const ms=Math.max(0,rtt/2+(count++%3-1)*10);const h=setTimeout(()=>{timers.delete(h);fn();},ms);timers.add(h);};
  ws.on('message',raw=>{const f=JSON.parse(raw.toString());if(f.type==='joined')commandSequence=f.commandSequence+1;later(()=>{frames.push(f);if(frames.length>300)frames.shift();if(f.state)onState(f.state);for(const w of [...waits])if(w.match(f)){clearTimeout(w.timer);waits.splice(waits.indexOf(w),1);w.resolve(f);}});});
  t.after(()=>{timers.forEach(clearTimeout);waits.forEach(w=>clearTimeout(w.timer));ws.terminate();});
  await once(ws,'open');
  return {ws,send(data){data={...(['ready','appearance','start'].includes(data.type)?{requestId:`quality-${commandSequence}`,commandSequence:commandSequence++}:{}),...data};later(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,...data}));});},onState(fn){onState=fn;},wait(match){const f=frames.findLast(match);if(f)return Promise.resolve(f);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>{waits.splice(waits.indexOf(w),1);reject(new Error('Frame timeout'));},8000)};waits.push(w);});}};
 }
 return {url,client};
}
test('version handshake rejects old rules and prevents room mutation before agreement',{timeout:20000},async t=>{
 const {url,client}=await serverFixture(t),c=await client();
 c.send({type:'create'});assert.equal((await c.wait(f=>f.code==='HANDSHAKE_REQUIRED')).type,'error');
 c.send({type:'hello',protocolVersion:PROTOCOL_VERSION+1});assert.equal((await c.wait(f=>f.code==='VERSION_MISMATCH')).type,'error');
 assert.equal((await (await fetch(url+'/health')).json()).rooms,0);
 c.send({type:'hello',requestId:'match'});const hello=await c.wait(f=>f.requestId==='match');assert.equal(hello.rulesVersion,RULES_VERSION);assert.equal(hello.assetVersion,LEVEL.revision);assert.equal(hello.characterVersion,LEVEL.characterRevision);
 c.send({type:'create',name:'版本验证'});assert.equal((await c.wait(f=>f.type==='joined')).state.protocolVersion,PROTOCOL_VERSION);
});
test('real WebSocket delayed-message prediction recovers at 100/200ms with jitter and reconnect',{timeout:40000},async t=>{
 const {client}=await serverFixture(t),report=[];
 for(const rtt of [100,200]){
  const c=await client(rtt),start=performance.now();c.send({type:'hello',requestId:'rtt'});await c.wait(f=>f.requestId==='rtt');const measured=performance.now()-start;
  c.send({type:'create',name:`延迟${rtt}`});const joined=await c.wait(f=>f.type==='joined');
  c.send({type:'ready',ready:true,assetRevision:joined.state.loadoutRevision,assetVersion:LEVEL.revision,characterVersion:LEVEL.characterRevision});await c.wait(f=>f.state?.players[0].ready);
  c.send({type:'start'});const running=(await c.wait(f=>f.state?.status==='running')).state;
  const prediction=new MovementPrediction();prediction.reconcile(running,joined.playerId);let latest=running,maxCorrection=0;
  c.onState(s=>{latest=s;prediction.reconcile(s,joined.playerId);maxCorrection=Math.max(maxCorrection,prediction.correction);});
  let sequence=0;
  for(let i=0;i<30;i++){const input={type:'input',sequence:sequence++,x:1,z:0,aimX:1,aimZ:0};prediction.push(input);c.send(input);await delay(1000/30);}
  const stop={type:'input',sequence:sequence++,x:0,z:0};prediction.push(stop);c.send(stop);
  await c.wait(f=>f.state?.players[0].appliedSequence===stop.sequence);
  await delay(rtt+150);
  const p=latest.players.find(p=>p.id===joined.playerId);
  assert.ok(p.x>LEVEL.spawn.x+1);assert.equal(prediction.pending.length,0);assert.ok(Math.hypot(prediction.pose.x-p.x,prediction.pose.z-p.z)<1e-8);
  assert.equal(p.hp<=100,true);assert.equal(prediction.ack,stop.sequence);
  c.ws.close();await once(c.ws,'close');prediction.suspend();
  const resumed=await client(rtt);resumed.send({type:'hello',requestId:'resume'});await resumed.wait(f=>f.requestId==='resume');resumed.send({type:'resume',token:joined.token});const restored=await resumed.wait(f=>f.type==='joined');
  prediction.reconcile(restored.state,joined.playerId,{reset:true});assert.equal(prediction.pending.length,0);assert.equal(restored.playerId,joined.playerId);
  assert.ok(restored.state.elapsed>running.elapsed);assert.equal(restored.state.players[0].appliedSequence,stop.sequence);
  resumed.send({type:'leave'});await resumed.wait(f=>f.type==='left');
  report.push({configuredRttMs:rtt,measuredHandshakeRttMs:Math.round(measured),oneWayJitterPatternMs:[-10,0,10],maxCorrectionMeters:maxCorrection,finalPending:prediction.pending.length,reconnect:'passed'});
 }
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/network-delay-report.json',JSON.stringify({generatedAt:new Date().toISOString(),method:'Application-message delays over real local WebSocket; no TCP loss shaping, no device or public Internet certification',runs:report},null,2)+'\n');
});

 test('30-second actual socket interruption retains identity, command receipts and unconfirmed events',{timeout:50000},async t=>{
 const {client}=await serverFixture(t),c=await client();c.send({type:'hello',requestId:'long'});await c.wait(f=>f.requestId==='long');
 c.send({type:'create',name:'恢复验证'});const joined=await c.wait(f=>f.type==='joined');
 c.send({type:'ready',ready:true,assetRevision:joined.state.loadoutRevision,assetVersion:LEVEL.revision,characterVersion:LEVEL.characterRevision});await c.wait(f=>f.state?.players[0].ready);
 c.send({type:'start'});const running=(await c.wait(f=>f.state?.status==='running')).state;
 const seen=[];const cursor=consumeEvents(running,0,e=>seen.push(e.id));
 c.ws.close();await once(c.ws,'close');const began=performance.now();await delay(30000);const interruptedMs=performance.now()-began;
 const resumed=await client();resumed.send({type:'hello',requestId:'back'});await resumed.wait(f=>f.requestId==='back');resumed.send({type:'resume',token:joined.token,eventAck:cursor});const recovered=await resumed.wait(f=>f.type==='joined');
 assert.equal(recovered.playerId,joined.playerId);assert.equal(recovered.commandSequence,1);assert.equal(recovered.state.eventAck,cursor);assert.ok(recovered.state.elapsed>running.elapsed);assert.equal(recovered.state.eventGap,false);
 const next=consumeEvents(recovered.state,cursor,e=>seen.push(e.id));assert.equal(new Set(seen).size,seen.length);assert.ok(next>=cursor);
 resumed.send({type:'eventAck',eventAck:next});await resumed.wait(f=>f.state&&f.state.events.every(e=>e.id>next));
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/network-long-reconnect.json',JSON.stringify({generatedAt:new Date().toISOString(),interruptedMs,playerIdentity:'preserved',commandSequence:recovered.commandSequence,eventCursorBefore:cursor,eventCursorAfter:next,duplicateEvents:0,status:recovered.state.status,elapsedBefore:running.elapsed,elapsedAfter:recovered.state.elapsed,scope:'actual local WebSocket close and 30-second wait; no TCP loss shaping or public Internet validation'},null,2)+'\n');
 resumed.send({type:'leave'});await resumed.wait(f=>f.type==='left');
 });
