import { CommandLedger } from './command-ledger.mjs';
import { deliverySnapshot,acknowledgeEvents } from './event-delivery.mjs';
import { PROTOCOL_VERSION, RULES_VERSION, SIMULATION_HZ, SNAPSHOT_HZ, compatible } from './shared/protocol.mjs';
import { LEVEL } from './shared/level.mjs';
import http from 'node:http';
import { appearanceSlot } from './shared/appearance.mjs';
import { readFile } from 'node:fs/promises';
import { resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocketServer, WebSocket } from 'ws';
import { createRoom, focusNpc, talkToNpc, addPlayer, setAppearance, setReady, invalidateLoadout, startRoom, acceptInput, stepRoom, snapshot } from './simulation.mjs';

const base = new URL('./', import.meta.url), rooms = new Map(), sessions = new Map();
const port = Number(process.env.PORT || 4173), host = process.env.HOST || '127.0.0.1';
import { routes } from './static-routes.mjs';
const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return; }
    if(path==='/engine'){res.writeHead(302,{Location:'/engine/'});res.end();return;}
    if(path.startsWith('/engine/')&&['GET','HEAD'].includes(req.method)){
      const root=fileURLToPath(new URL('../platform/cocos/build/web-desktop/',base));
      const requested=decodeURIComponent(path.slice('/engine/'.length))||'index.html';
      const file=resolve(root,requested);
      if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(404);res.end();return;}
      const extension=file.split('.').at(-1);const mime={html:'text/html',js:'text/javascript',json:'application/json',css:'text/css',png:'image/png',jpg:'image/jpeg',ico:'image/x-icon',wav:'audio/wav'}[extension]??'application/octet-stream';
      try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404);res.end();}return;
    }
    const route = routes.get(path);
    if (!route || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
    const data = await readFile(fileURLToPath(new URL(route[0], base)));
    res.writeHead(200, { 'Content-Type': `${route[1]}; charset=utf-8`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500); res.end('Resource unavailable'); }
});
const wss = new WebSocketServer({ server, path: '/socket', maxPayload: 2048 });
const send = (ws, value) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256000) ws.send(JSON.stringify({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,...value})); };
function detach(ws) {
  if (!ws.session) return;
  const session = ws.session;
  if (session.ws !== ws) { ws.session = null; return; }
  const room = rooms.get(session.roomId), p = room?.players.find(p => p.id === session.playerId);
  if (p) {
    p.connected = false; p.input = {};p.pendingActions={};p.reloadUntil=0;p.reloadingWeapon=null; p.disconnectedAt = room.elapsed;
    if (room.status === 'lobby') {
      room.players = room.players.filter(q => q.id !== p.id); invalidateLoadout(room);
      if (room.host === p.id) room.host = room.players[0]?.id ?? null;
      sessions.delete(session.token);
    }
  }
  session.ws = null; ws.session = null;
}
function roomCode() {
  let code; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code)); return code;
}
wss.on('connection', (ws, req) => {
  // Local prototype only: reject cross-origin browser connections.
  let originValid = true;
  try { if (req.headers.origin) originValid = new URL(req.headers.origin).host === req.headers.host; } catch { originValid = false; }
  if (!originValid) { ws.close(1008, 'Origin mismatch'); return; }
  ws.alive = true; ws.on('pong', () => { ws.alive = true; });
  ws.rateAt = performance.now(); ws.messages = 0;
  ws.on('message', raw => {
    const now = performance.now();
    if (now - ws.rateAt > 1000) { ws.messages = 0; ws.rateAt = now; }
    if (++ws.messages > 80) { ws.close(1008, 'Rate limited'); return; }
    try {
      const data = JSON.parse(raw.toString());
      if (!data || typeof data !== 'object') throw new Error('请求格式错误');
      if(!compatible(data)){const e=new Error('客户端协议或规则版本不一致，请刷新页面');e.code='VERSION_MISMATCH';throw e;}
      if(data.type==='hello'){ws.negotiated=true;send(ws,{type:'hello',requestId:typeof data.requestId==='string'?data.requestId.slice(0,64):undefined,assetVersion:LEVEL.revision,characterVersion:LEVEL.characterRevision,simulationHz:SIMULATION_HZ,snapshotHz:SNAPSHOT_HZ});return;}
      if(!ws.negotiated){const e=new Error('请先完成版本握手');e.code='HANDSHAKE_REQUIRED';throw e;}
      if (data.type === 'create' || data.type === 'join') {
        if (ws.session) throw new Error('请先离开当前房间');
        appearanceSlot(data.gender===undefined?'male':data.gender,data.job===undefined?'programmer':data.job);
        let room;
        if (data.type === 'create') {
          if (rooms.size >= 32) throw new Error('原型房间已满，请稍后重试');
          room = createRoom(roomCode(),data.mode??'coop'); rooms.set(room.id, room);
        } else {
          room = rooms.get(String(data.code || '').trim().toUpperCase());
          if (!room) throw new Error('没有找到这个房间码');
        }
        const playerId = randomUUID(), token = randomBytes(24).toString('hex');
        addPlayer(room, playerId, data.name, data.role, data.gender, data.job);
        const session = { token, roomId: room.id, playerId, ws,eventAck:0,eventSent:0,commands:new CommandLedger() };
        sessions.set(token, session); ws.session = session;
        send(ws, { type: 'joined', token, playerId, code: room.id, commandSequence:session.commands.lastSequence,state:deliverySnapshot(room,session) });
      } else if (data.type === 'resume') {
        if (ws.session) throw new Error('当前连接已在房间内');
        const session = sessions.get(data.token), room = session && rooms.get(session.roomId);
        const p = room?.players.find(p => p.id === session.playerId);
        if (!p || p.state === 'left' || (p.disconnectedAt !== null && room.elapsed - p.disconnectedAt >= 60 && p.state !== 'extracted')) throw new Error('重连保留期已结束，请重新开局');
        if (session.ws && session.ws !== ws) { const old = session.ws; old.session = null; old.close(1000, 'Replaced'); }
        session.ws = ws; ws.session = session; p.connected = true; p.disconnectedAt = null; p.input = {};p.pendingActions={};
        acknowledgeEvents(session,data.eventAck);
        send(ws, { type: 'joined', token: session.token, playerId: p.id, code: room.id, commandSequence:session.commands.lastSequence,state:deliverySnapshot(room,session) });
      } else if (data.type === 'leave') {
        const session = ws.session, room = session && rooms.get(session.roomId);
        const p = room?.players.find(p => p.id === session.playerId);
        if (p && room.status === 'running' && p.state !== 'extracted') p.state = 'left';
        detach(ws); send(ws, { type: 'left' });
        if (session) sessions.delete(session.token);
      } else {
        const session = ws.session, room = session && rooms.get(session.roomId), p = room?.players.find(p => p.id === session.playerId);
        if (!p) throw new Error('请先建立房间');
        acknowledgeEvents(session,data.eventAck);
        if(['ready','appearance','start','dialogue','conversation'].includes(data.type)){
          const result=session.commands.execute(data,()=>{
            if(data.type==='ready')setReady(room,p,data.ready===true,data.assetRevision,data.assetVersion,data.characterVersion);
            else if(data.type==='appearance')setAppearance(room,p,data.gender,data.job);
            else if(data.type==='conversation')focusNpc(room,p,data.npcId,data.active===true);
            else if(data.type==='dialogue')talkToNpc(room,p,data.npcId,data.topicId);
            else {if(room.host!==p.id)throw new Error('由房主发起出发');if(!startRoom(room))throw new Error('请等待所有员工准备完成');}
          });send(ws,result);
        } else if (data.type === 'input' && room.status === 'running') acceptInput(p, data, room.elapsed);
      }
    } catch (error) { send(ws, { type: 'error', code:error.code??'REQUEST_REJECTED',message: error.message || '请求未完成' }); }
  });
  ws.on('error', () => {}); ws.on('close', () => detach(ws));
});
let last = performance.now(), accumulator = 0, broadcast = 0;
const timer = setInterval(() => {
  const now = performance.now(), elapsed = (now - last) / 1000; last = now;
  accumulator += elapsed;
  // Real server time continues if a browser becomes hidden. Fixed simulation steps avoid tunnelling.
  let steps = 0;
  while (accumulator >= 1 / SIMULATION_HZ && steps++ < 300) {
    for (const room of rooms.values()) stepRoom(room, 1 / SIMULATION_HZ);
    accumulator -= 1 / SIMULATION_HZ;
  }
  broadcast += elapsed;
  if (broadcast >= 1 / SNAPSHOT_HZ) {
    broadcast = 0;
    for (const room of rooms.values()) {
      for (const p of room.players) {
        for (const session of sessions.values()) if (session.roomId === room.id && session.playerId === p.id && session.ws) send(session.ws, { type: 'state', state:deliverySnapshot(room,session) });
      }
      if (!room.players.some(p => p.connected)) room.emptySince ??= now;
      else room.emptySince = null;
      if ((room.emptySince !== null && now - room.emptySince > 70000) || Date.now() - room.createdAt > 2 * 3600000) {
        rooms.delete(room.id);
        for (const [token, s] of sessions) if (s.roomId === room.id) { if (s.ws) s.ws.close(1000, 'Room expired'); sessions.delete(token); }
      }
    }
  }
}, 1000 / SIMULATION_HZ);
const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 10000);
server.listen(port, host, () => console.log(`Corporate Showdown prototype: http://${host}:${server.address().port}`));
function stop() { clearInterval(timer); clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
