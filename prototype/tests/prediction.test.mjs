import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom,addPlayer,setReady,startRoom,acceptInput,stepRoom,snapshot } from '../simulation.mjs';
import { LEVEL } from '../shared/level.mjs';
import { MovementPrediction,SnapshotInterpolation } from '../public/network-state.mjs';
function fixture(){const r=createRoom('PREDICT'),p=addPlayer(r,'p','员工');setReady(r,p,true,r.loadoutRevision,LEVEL.revision,LEVEL.characterRevision);startRoom(r);r.enemies=[];return {r,p};}
test('server acknowledges simulated input separately from receipt and rejects repeats without moving',()=>{
 const {r,p}=fixture();acceptInput(p,{sequence:0,x:1,z:0},r.elapsed);
 assert.equal(snapshot(r).players[0].sequence,0);assert.equal(snapshot(r).players[0].appliedSequence,-1);
 stepRoom(r,1/30);assert.equal(snapshot(r).players[0].appliedSequence,0);
 const x=p.x;assert.equal(acceptInput(p,{sequence:0,x:-1,z:0},r.elapsed),false);assert.equal(p.x,x);
});
test('prediction moves immediately, replays only unconfirmed movement and converges after authoritative stop',()=>{
 const {r,p}=fixture(),client=new MovementPrediction();client.reconcile(snapshot(r),p.id);
 const command={sequence:0,x:1,z:0,attack:true,hp:99999};client.push(command);
 assert.ok(client.pose.x>p.x);assert.equal(client.pose.hp,100);assert.equal(p.x,LEVEL.spawn.x);
 acceptInput(p,command,r.elapsed); // Receipt is not an applied acknowledgement.
 client.reconcile(snapshot(r),p.id);assert.equal(client.pending.length,1);
 stepRoom(r,1/30);client.push({sequence:1,x:0,z:1});client.reconcile(snapshot(r),p.id);
 assert.deepEqual(client.pending.map(i=>i.sequence),[1]);assert.equal(client.pose.x,p.x);assert.ok(client.pose.z>p.z);
 acceptInput(p,{sequence:1,x:0,z:1},r.elapsed);stepRoom(r,1/30);client.reconcile(snapshot(r),p.id);
 assert.equal(client.pending.length,0);assert.equal(client.pose.z,p.z);
 client.push({sequence:2,x:1,z:0});client.suspend();assert.equal(client.pending.length,0);assert.equal(client.pose.x,p.x);
 acceptInput(p,{sequence:2,x:0,z:0},r.elapsed);stepRoom(r,1/30);client.reconcile(snapshot(r),p.id,{reset:true});assert.equal(client.pose.x,p.x);
});
test('prediction respects furniture and authoritative down state, rejects stale snapshots and bounds outages',()=>{
 const {r,p}=fixture(),client=new MovementPrediction();p.x=-25;p.z=-17.6;client.reconcile(snapshot(r),p.id);
 for(let i=0;i<12;i++)client.push({sequence:i,x:0,z:1});assert.ok(client.pose.z<=-17.6+.46);
 for(let i=12;i<25;i++)client.push({sequence:i,x:1,z:0});assert.equal(client.overflow,true);assert.equal(client.pending.length,0);
 p.state='down';stepRoom(r,1/30);client.reconcile(snapshot(r),p.id);client.push({sequence:26,x:1,z:0});assert.equal(client.pose.x,p.x);
 assert.equal(client.reconcile({...snapshot(r),tick:-1},p.id),false);
});
test('remote interpolation buffers positions, handles state transitions and resets between rooms',()=>{
 const {r,p}=fixture(),buffer=new SnapshotInterpolation(),a=structuredClone(snapshot(r));buffer.push(a,0);
 p.x+=.46;r.elapsed=.1;r.tick=3;const b=structuredClone(snapshot(r));buffer.push(b,100);
 const position=buffer.entities(200).get(p.id);assert.ok(position.x>a.players[0].x&&position.x<b.players[0].x);
 assert.equal(buffer.entities(1000).get(p.id).x,p.x); // Never extrapolate beyond authority.
 buffer.push(a,1100);assert.equal(buffer.frames.length,2);
 p.state='down';r.elapsed=.2;r.tick=6;buffer.push(snapshot(r),200);assert.equal(buffer.entities(200).get(p.id).state,'down');
 buffer.push({...snapshot(r),id:'OTHER',tick:0},300);assert.equal(buffer.frames.length,1);
});
