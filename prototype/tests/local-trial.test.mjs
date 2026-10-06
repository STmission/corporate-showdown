import test from 'node:test';import assert from 'node:assert/strict';
import {LocalTrial} from '../local-trial.mjs';import {PROTOCOL_VERSION,RULES_VERSION} from '../shared/protocol.mjs';import {LEVEL} from '../shared/level.mjs';
test('Pages sandbox uses real rules, validates commands, deduplicates dialogue, fires and exits cleanly',()=>{
 const messages=[],trial=new LocalTrial(data=>messages.push(data));const send=data=>trial.receive({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,...data});let sequence=0;
 const command=data=>{const request={requestId:'trial-'+sequence,commandSequence:sequence++,...data};send(request);return request;};
 send({type:'create',mode:'single'});assert.equal(messages.at(-1).type,'error');
 send({type:'hello'});send({type:'create',mode:'coop'});assert.equal(trial.room,null);send({type:'create',mode:'single',gender:'female',job:'sales'});
 assert.equal(trial.room.players[0].job,'sales');assert.equal(trial.room.mode,'single');
 command({type:'start'});assert.equal(trial.room.status,'lobby');
 command({type:'ready',ready:true,assetRevision:trial.room.loadoutRevision,assetVersion:LEVEL.revision,characterVersion:LEVEL.characterRevision});command({type:'start'});assert.equal(trial.room.status,'running');
 command({type:'dialogue',npcId:'finance',topicId:'ledger'});assert.deepEqual(trial.room.story.clues,[]);
 const dialogue=command({type:'dialogue',npcId:'teacher',topicId:'schedule'});send(dialogue);assert.deepEqual(trial.room.story.clues,['schedule']);assert.equal(trial.room.story.choices.filter(k=>k==='teacher:schedule').length,1);
 send({type:'input',sequence:0,x:0,z:0,pickup:true});trial.step();assert.equal(trial.room.players[0].weapon,'pistol');
 send({type:'input',sequence:1,x:0,z:0,aimX:1,aimZ:0,attack:true,ammo:999,damage:999});trial.step();assert.equal(trial.room.players[0].inventory[0].ammo,11);
 send({type:'join',code:'LOCAL'});assert.equal(messages.at(-1).type,'error');assert.equal(trial.room.players.length,1);
 send({type:'leave'});assert.equal(trial.room,null);assert.equal(trial.session,null);assert.equal(messages.at(-1).type,'left');trial.broadcast();send({type:'create',mode:'single'});assert.equal(trial.room.status,'lobby');assert.deepEqual(trial.room.story.clues,[]);
});
