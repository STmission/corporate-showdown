import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL } from '../shared/level.mjs';
import { JOBS, GENDERS, appearanceSlot } from '../shared/appearance.mjs';
import { createRoom, addPlayer, setAppearance, setReady, startRoom, snapshot, acceptInput, stepRoom } from '../simulation.mjs';
const ready=r=>r.players.forEach(p=>setReady(r,p,true,r.loadoutRevision,LEVEL.revision,LEVEL.characterRevision));

test('eight valid loadouts sync in snapshots without altering movement or combat values',()=>{
  const results=[];
  for(const gender of GENDERS)for(const job of Object.keys(JOBS)){
    const r=createRoom('OUTFIT'),p=addPlayer(r,'a','A','coder',gender,job);ready(r);assert.ok(startRoom(r));r.enemies=[];
    acceptInput(p,{sequence:0,x:1,z:0},0);stepRoom(r,1/30);
    assert.equal(snapshot(r).players[0].gender,gender);assert.equal(snapshot(r).players[0].job,job);
    results.push([p.hp,p.x,p.z,p.skillCd,p.energy,p.shield]);
    assert.equal(appearanceSlot(gender,job),`${gender}_${job}`);
  }
  results.forEach(r=>assert.deepEqual(r,results[0]));
});
test('invalid appearance is rejected before adding player or changing room revision',()=>{
  const r=createRoom('BAD');for(const [g,j]of [['other','sales'],['male','../sales'],['male',{}]])assert.throws(()=>addPlayer(r,'a','A','coder',g,j));
  assert.equal(r.players.length,0);assert.equal(r.loadoutRevision,0);
});
test('loadout changes and new members invalidate readiness; stale resources cannot start the game',()=>{
  const r=createRoom('REV'),p=addPlayer(r,'a','A');ready(r);const old=r.loadoutRevision;
  setAppearance(r,p,'female','sales');assert.equal(p.ready,false);assert.equal(p.loadedRevision,-1);
  assert.throws(()=>setReady(r,p,true,old,LEVEL.revision,LEVEL.characterRevision));assert.throws(()=>setReady(r,p,true,r.loadoutRevision,'old-version'));assert.throws(()=>setReady(r,p,true,r.loadoutRevision,LEVEL.revision,'old-character'));
  assert.equal(startRoom(r),false);ready(r);addPlayer(r,'b','B');assert.ok(r.players.every(p=>!p.ready));
  ready(r);assert.ok(startRoom(r));assert.throws(()=>setAppearance(r,p,'male','ecommerce'));
});
test('unchanged selection keeps prepared teammates and invalid update preserves chosen outfit',()=>{
  const r=createRoom('SAME'),p=addPlayer(r,'a','A','coder','female','celebrity');ready(r);const rev=r.loadoutRevision;
  setAppearance(r,p,'female','celebrity');assert.equal(r.loadoutRevision,rev);assert.equal(p.ready,true);
  assert.throws(()=>setAppearance(r,p,'female','invalid'));assert.equal(p.job,'celebrity');assert.equal(r.loadoutRevision,rev);
});
