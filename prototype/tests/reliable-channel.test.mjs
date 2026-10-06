import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandLedger } from '../command-ledger.mjs';
import { deliverySnapshot,acknowledgeEvents } from '../event-delivery.mjs';
import { createRoom,emit } from '../simulation.mjs';
import { ReliableCommands,consumeEvents } from '../public/reliable-channel.mjs';
test('command receipts replay success and failure once; changed payload and expired IDs cannot execute',()=>{
 const ledger=new CommandLedger();let calls=0;
 const a={type:'start',requestId:'a',commandSequence:0,eventAck:0};const first=ledger.execute(a,()=>calls++);
 assert.equal(first.ok,true);assert.deepEqual(ledger.execute({...a,eventAck:50},()=>calls++),first);assert.equal(calls,1);
 assert.equal(ledger.execute({...a,type:'ready'},()=>calls++).code,'COMMAND_CONFLICT');
 assert.equal(ledger.execute({...a,commandSequence:3},()=>calls++).code,'COMMAND_ORDER');
 const fail={type:'ready',requestId:'b',commandSequence:1};assert.equal(ledger.execute(fail,()=>{calls++;throw new Error('not ready');}).ok,false);
 assert.equal(ledger.execute(fail,()=>calls++).ok,false);assert.equal(calls,2);
 for(let i=2;i<=130;i++)ledger.execute({type:'ready',requestId:`c${i}`,commandSequence:i},()=>{});
 assert.equal(ledger.receipts.size,128);assert.equal(ledger.execute(a,()=>calls++).code,'COMMAND_EXPIRED');assert.equal(calls,2);
});
test('client serializes commands, retransmits identical intentions and retains them across reconnect',()=>{
 const sent=[],c=new ReliableCommands(d=>sent.push({...d}),()=>`id-${sent.length}`);c.synchronize(-1);
 c.enqueue({type:'ready'});c.enqueue({type:'start'});assert.equal(sent.at(-1).type,'ready');c.flush();assert.deepEqual(sent.at(-1),sent[0]);
 assert.equal(c.receive({requestId:'other',commandSequence:0}),false);c.suspend();const count=sent.length;c.flush();assert.equal(sent.length,count);
 c.synchronize(0,{resume:true});assert.equal(sent.at(-1).commandSequence,0);
 assert.equal(c.receive({...sent.at(-1),ok:true}),true);assert.equal(sent.at(-1).type,'start');assert.equal(sent.at(-1).commandSequence,1);
 c.receive({...sent.at(-1),ok:true});assert.equal(c.pending.length,0);c.reset();assert.equal(c.available,false);
});
test('event replay survives latest-30 window, advances only to delivered cursor and consumes once',()=>{
 const room=createRoom('EVENTS'),session={eventAck:0,eventSent:0};for(let i=0;i<150;i++)emit(room,`event ${i}`,'info');
 assert.equal(room.events.length,30);const seen=[];let cursor=0;
 for(let i=0;i<3;i++){
  const state=deliverySnapshot(room,session);assert.ok(state.events.length<=64);const replay=deliverySnapshot(room,session);assert.deepEqual(replay.events,state.events);
  cursor=consumeEvents(state,cursor,e=>seen.push(e.id));cursor=consumeEvents(replay,cursor,e=>seen.push(e.id));
  acknowledgeEvents(session,room.eventId+1);assert.notEqual(session.eventAck,room.eventId+1);acknowledgeEvents(session,cursor);
 }
 assert.equal(cursor,150);assert.equal(seen.length,150);assert.equal(new Set(seen).size,150);assert.equal(deliverySnapshot(room,session).events.length,0);
 acknowledgeEvents(session,-1);assert.equal(session.eventAck,150);
});
test('bounded event retention declares a gap, then resynchronizes without pretending lost feedback was replayed',()=>{
 const room=createRoom('GAP'),session={eventAck:0,eventSent:0};for(let i=0;i<2100;i++)emit(room,'event');
 const state=deliverySnapshot(room,session);assert.equal(room.eventJournal.length,2048);assert.equal(state.eventBase,53);assert.equal(state.eventGap,true);
 let seen=0;const cursor=consumeEvents(state,0,()=>seen++);assert.equal(seen,64);assert.equal(cursor,116);
 acknowledgeEvents(session,cursor);assert.equal(deliverySnapshot(room,session).eventGap,false);
 assert.equal(consumeEvents({...state,eventGap:false},0,()=>assert.fail('out-of-order event')),0);
});
