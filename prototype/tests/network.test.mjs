import { LEVEL } from '../shared/level.mjs';
import { PROTOCOL_VERSION,RULES_VERSION } from '../shared/protocol.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';

test('real server: four-player ready, locked joining, authoritative input, reconnect and static isolation', { timeout: 15000 }, async t => {
  const server = spawn(process.execPath, ['prototype/server.mjs'], { env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { server.kill(); });
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000);
    server.stdout.on('data', data => { const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    server.on('error', reject);
  });
  const clients = [];
  async function client() {
    const socket = new WebSocket(url.replace('http', 'ws') + '/socket');
    const frames = [], waits = [];let commandSequence=0;
    socket.on('message', raw => { const frame = JSON.parse(raw.toString()); if(frame.type==='joined')commandSequence=frame.commandSequence+1;frames.push(frame); if (frames.length > 100) frames.shift(); for (const wait of [...waits]) if (wait.match(frame)) { clearTimeout(wait.timeout); waits.splice(waits.indexOf(wait), 1); wait.resolve(frame); } });
    await once(socket, 'open');
    const c = { socket, next: match => new Promise((resolve,reject)=>{const w={match,resolve,timeout:setTimeout(()=>{waits.splice(waits.indexOf(w),1);reject(new Error('Next frame timeout'));},4000)};waits.push(w);}), send: data => socket.send(JSON.stringify({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,...(['ready','appearance','start'].includes(data.type)?{requestId:`test-${commandSequence}`,commandSequence:commandSequence++}:{}),...data})), wait: match => {
      const existing = frames.findLast(match); if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => { const w = { match, resolve, timeout: setTimeout(() => { waits.splice(waits.indexOf(w), 1); reject(new Error('Message timeout')); }, 4000) }; waits.push(w); });
    } };
    clients.push(c);c.send({type:'hello'});await c.wait(f=>f.type==='hello'); return c;
  }
  t.after(() => clients.forEach(c => c.socket.terminate()));
  const health = await fetch(url + '/health'); assert.equal(health.status, 200);
  assert.equal((await fetch(url + '/simulation.mjs')).status, 404);
  assert.equal((await fetch(url + '/vendor/three.js')).status, 200);
  const a = await client(); a.send({ type: 'create', name: '房主', role: 'coder',gender:'female',job:'celebrity' });
  const joined = await a.wait(f => f.type === 'joined');
  const members = [a];
  for (let i = 0; i < 3; i++) { const c = await client(); c.send({ type: 'join', code: joined.code, name: `队友${i}` }); await c.wait(f => f.type === 'joined'); members.push(c); }
  const late = await client(); late.send({ type: 'join', code: joined.code });
  assert.match((await late.wait(f => f.type === 'error')).message, /已满/);
  const loaded=await a.wait(f=>f.type==='state'&&f.state.players.length===4);
  a.send({type:'ready',ready:true,assetRevision:loaded.state.loadoutRevision-1,assetVersion:loaded.state.assetVersion,characterVersion:LEVEL.characterRevision});
  assert.match((await a.wait(f=>f.type==='commandResult'&&!f.ok&&/资源版本/.test(f.message))).message,/资源版本/);
  a.send({type:'appearance',gender:'female',job:'sales'});
  const changed=await a.wait(f=>f.type==='state'&&f.state.loadoutRevision>loaded.state.loadoutRevision);
  assert.ok(changed.state.players.every(p=>!p.ready));
  assert.equal(changed.state.players[0].job,'sales');
  members.forEach(c => c.send({ type: 'ready', ready: true,assetRevision:changed.state.loadoutRevision,assetVersion:changed.state.assetVersion,characterVersion:LEVEL.characterRevision }));
  await a.wait(f => f.type === 'state' && f.state.players.length === 4 && f.state.players.every(p => p.ready));
  a.send({ type: 'start' });await a.wait(f=>f.type==='commandResult'&&f.command==='start'&&f.ok);
  const duplicate=a.next(f=>f.type==='commandResult'&&f.requestId==='test-3');
  a.socket.send(JSON.stringify({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,type:'start',requestId:'test-3',commandSequence:3}));assert.equal((await duplicate).ok,true);
  const running = await a.wait(f => f.type === 'state' && f.state.status === 'running');
  a.send({ type: 'input', sequence: 0, x: 999, z: 0, hp: 9999, remaining: 9999 });
  const afterInput = await a.wait(f => f.type === 'state' && f.state.tick > running.state.tick + 3);
  const before = running.state.players.find(p => p.id === joined.playerId), after = afterInput.state.players.find(p => p.id === joined.playerId);
  assert.equal(before.x, after.x); assert.equal(after.hp, 100); assert.ok(afterInput.state.remaining < 300);
  a.socket.close(); await once(a.socket, 'close');
  const resumed = await client(); resumed.send({ type: 'resume', token: joined.token,eventAck:running.state.eventHead });
  const resume = await resumed.wait(f => f.type === 'joined');assert.equal(resume.state.eventAck,running.state.eventHead);
  assert.equal(resume.state.players.find(p=>p.id===joined.playerId).gender,'female');assert.equal(resume.state.players.find(p=>p.id===joined.playerId).job,'sales');
  const replayed=resumed.next(f=>f.type==='commandResult'&&f.requestId==='test-1');
  resumed.socket.send(JSON.stringify({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,type:'appearance',gender:'female',job:'sales',requestId:'test-1',commandSequence:1}));assert.equal((await replayed).ok,true);
  assert.equal(resume.playerId, joined.playerId); assert.equal(resume.state.players.length, 4); assert.ok(resume.state.remaining < running.state.remaining);
  assert.equal(resume.state.players.find(p => p.id === joined.playerId).connected, true);
  late.send({ type: 'join', code: joined.code });
  assert.match((await late.wait(f => f.type === 'error' && /已开始/.test(f.message))).message, /已开始/);
  resumed.send({ type: 'leave' }); await resumed.wait(f => f.type === 'left');
  const leftState = await members[1].wait(f => f.type === 'state' && f.state.players.find(p => p.id === joined.playerId)?.state === 'left');
  assert.equal(leftState.state.players.find(p => p.id === joined.playerId).connected, false);
  const expired = await client(); expired.send({ type: 'resume', token: joined.token,eventAck:running.state.eventHead });
  assert.match((await expired.wait(f => f.type === 'error')).message, /重连保留期/);
});
