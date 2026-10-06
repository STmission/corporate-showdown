import { appearanceSlot } from './shared/appearance.mjs';
import { validFloorPosition } from './shared/headquarters-layout.mjs';
import { moveFloor as move, movementSpeed } from './shared/movement.mjs';
import { RULES_VERSION, PROTOCOL_VERSION } from './shared/protocol.mjs';
import {WEAPONS,WEAPON_PICKUPS,weaponRays} from './shared/weapons.mjs';
import {STORY_NPCS,NPC_ROUTINES,newStory,nextClueHint,storyDialogueText,storyEnding} from './shared/story.mjs';
import { LEVEL } from './shared/level.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export function validPosition(x, z, radius = 0.36) {
  return validFloorPosition(x,z,radius);
}
function clearLine(a, b) {
  const count = Math.ceil(dist(a, b) / 0.2);
  for (let i = 1; i < count; i++) {
    const t = i / count;
    if (!validPosition(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.05)) return false;
  }
  return true;
}
export function createRoom(id,mode='coop') {
  if(!['coop','single'].includes(mode))throw Error('游戏模式无效');
  return { id, mode, story:mode==='single'?newStory():null,npcs:mode==='single'?STORY_NPCS.map(n=>({...n,topics:[...n.topics,...(n.topics.some(t=>t.id==='where')?[]:[{id:'where',label:'接下来该找谁？',text:{teacher:'咱们一步一步来。',lawyer:'按材料缺项往下查。',finance:'先把缺的凭证补齐。',veteran:'先确认目标，再行动。',poet:'下一句先交给线索。'}[n.id]}])],hp:100,state:'active',fx:0,fz:1,behavior:'working',activity:NPC_ROUTINES[n.id][0].activity,routineIndex:0,nextRoutineAt:NPC_ROUTINES[n.id][0].seconds,navPath:null,conversation:null,visits:0})):[], status: 'lobby', players: [], enemies: [], items: [], projectiles: [], elapsed: 0, penalty: 0,
    loadoutRevision:0, tick: 0, objectives: LEVEL.objectives.map(o => ({ ...o, done: false })), bossSpawned: false,
    exitOpen: false, events: [], eventJournal: [], eventId: 0, result: null, host: null, createdAt: Date.now(), emptySince: null };
}
export function emit(room, text, kind = 'info', x, z) {
  const event={ id: ++room.eventId, text, kind, x, z, at: room.elapsed };room.events.push(event);room.eventJournal.push(event);
  if(room.eventJournal.length>2048)room.eventJournal.shift();
  if (room.events.length > 30) room.events.shift();
  return event;
}
export function addPlayer(room, id, name, role = 'coder', gender = 'male', job = 'programmer') {
  if (room.status !== 'lobby' || room.players.length >= (room.mode==='single'?1:4)) throw new Error('房间已开始或已满');
  appearanceSlot(gender,job);
  const p = { id, gender, job, loadedRevision:-1, name: String(name || '准点员工').trim().slice(0, 12) || '准点员工', role: role === 'admin' ? 'admin' : 'coder',
    x: LEVEL.spawn.x + room.players.length * 0.7, z: LEVEL.spawn.z, hp: 100, energy: 0, shield: 0,
    state: 'active', connected: true, ready: false, input: {}, pendingActions:{}, inputAt: 0, sequence: -1, appliedSequence: -1,
    attackCd: 0, skillCd: 0, dodgeCd: 0, dodgeUntil: 0, hitUntil: 0, attackUntil: 0,
    transformUntil: 0, speedUntil: 0, penaltyUntil: 0, combo: 0, weapon: null, durability: 0, inventory:[], reloadUntil:0, reloadingWeapon:null, fireHeld:false, reloadHeld:false, switchHeld:false, pickupHeld:false,
    interactProgress: 0, interactTarget: null, downUntil: 0, revives: 0, disconnectedAt: null,
    fx: 0, fz: -1, kills: 0, saved: 0 };
  room.players.push(p); invalidateLoadout(room);
  room.host ??= id;
  return p;
}
export function invalidateLoadout(room) {
  room.loadoutRevision++;
  for(const p of room.players){p.ready=false;p.loadedRevision=-1;}
}
export function setAppearance(room,p,gender,job) {
  if(room.status!=='lobby')throw new Error('行动中不能切换装扮');
  appearanceSlot(gender,job);
  if(p.gender===gender&&p.job===job)return;
  p.gender=gender;p.job=job;invalidateLoadout(room);
}
export function setReady(room,p,ready,assetRevision,assetVersion,characterVersion) {
  if(room.status!=='lobby')throw new Error('行动已开始');
  if(!ready){p.ready=false;return;}
  if(assetRevision!==room.loadoutRevision||assetVersion!==LEVEL.revision||characterVersion!==LEVEL.characterRevision)throw new Error('装扮或资源版本已变化，请加载后重新准备');
  p.loadedRevision=assetRevision;p.ready=true;
}
function spawnEnemy(room, kind, x, z) {
  const count = room.players.filter(p => p.connected).length || 1;
  const hp = Math.round((kind === 'boss' ? 500 : kind === 'shield' ? 95 : 65) * (1 + 0.35 * (count - 1)));
  room.enemies.push({ id: `e${room.tick}_${room.enemies.length}`, kind, x, z, hp, maxHp: hp,
    attackCd: 1.2, cast: null, stunUntil: 0, interruptUntil: 0, phase: 1, hitUntil: 0, path: [], pathAt: 0, fx: 0, fz: 1 });
}
export function startRoom(room) {
  if (room.status !== 'lobby' || !room.players.length || !room.players.every(p => p.connected && p.ready && p.loadedRevision===room.loadoutRevision)) return false;
  room.status = 'running';
  if(room.mode!=='single')LEVEL.enemies.forEach(e => spawnEnemy(room, e.kind, e.x, e.z));
  room.items = (room.mode==='single'?[...LEVEL.items.filter(i=>['coffee','box'].includes(i.kind)),...WEAPON_PICKUPS]:LEVEL.items).map((i, index) => ({ ...i, id: `i${index}`, taken: false }));
  emit(room,room.story?'第一章：先和许老师聊聊，查明加班名单的来历。':'文件交了，门禁拿了。今天准点走。');
  return true;
}
export function acceptInput(player, data, now) {
  if (!Number.isSafeInteger(data.sequence) || data.sequence <= player.sequence || data.sequence > player.sequence + 10000) return false;
  if (!finite(data.x) || !finite(data.z) || Math.abs(data.x) > 1 || Math.abs(data.z) > 1) return false;
  if(data.pitch!==undefined&&(!finite(data.pitch)||Math.abs(data.pitch)>1.15))return false;
  player.sequence = data.sequence;
  const length = Math.max(1, Math.hypot(data.x, data.z));
  const previous=player.input;player.pendingActions??={};if(data.cancelActions===true)player.pendingActions={};
  player.input = { x: data.x / length, z: data.z / length };
  if (finite(data.aimX) && finite(data.aimZ) && Math.hypot(data.aimX, data.aimZ) > 0.1) {
    const aimLength = Math.hypot(data.aimX, data.aimZ);
    player.input.aimX = data.aimX / aimLength; player.input.aimZ = data.aimZ / aimLength;
  }
  for (const key of ['attack', 'skill', 'dodge', 'interact', 'transform', 'throw','reload','weaponNext','pickup']) {player.input[key] = data.cancelActions!==true&&data[key] === true;if(key!=='interact'&&player.input[key]&&!previous[key])player.pendingActions[key]=true;}
  player.input.pitch=data.pitch??0;player.input.thirdPerson=data.thirdPerson===true;
  player.inputAt = now;
  return true;
}
export const remaining = r => r.story&&r.story.deadline===null?LEVEL.duration:Math.max(0,(r.story?.deadline??LEVEL.duration)-r.elapsed-r.penalty);
export function focusNpc(room,p,npcId,active=true){
 if(!active){for(const npc of room.npcs)if(npc.conversation?.playerId===p.id)npc.conversation=null;return;}
 if(room.status!=='running'||room.mode!=='single'||p.state!=='active'||!p.connected)throw Error('当前不能交谈');
 const npc=room.npcs.find(n=>n.id===npcId);
 if(!npc||dist(p,npc)>=2.3||!clearLine(p,npc))throw Error('请靠近可交谈的人物');
 for(const other of room.npcs)if(other!==npc&&other.conversation?.playerId===p.id)other.conversation=null;
 npc.conversation={playerId:p.id,until:room.elapsed+45};npc.behavior='talking';npc.activity='和'+p.name+'交谈';
 const d=dist(npc,p)||1;npc.fx=(p.x-npc.x)/d;npc.fz=(p.z-npc.z)/d;
}
export function talkToNpc(room,p,npcId,topicId){
 if(room.status!=='running'||room.mode!=='single'||p.state!=='active'||!p.connected)throw Error('当前不能交谈');
 const npc=room.npcs.find(n=>n.id===npcId),topic=npc?.topics.find(t=>t.id===topicId);
 if(!npc||!topic||dist(p,npc)>=2.3||!clearLine(p,npc))throw Error('请靠近可交谈的人物');
 if(topic.requires?.some(clue=>!room.story.clues.includes(clue)))throw Error('线索还没齐，请先询问其他人物');
 if(topic.route&&room.story.route&&topic.route!==room.story.route)throw Error('本次分支已确定，请继续当前行动');
 const key=npcId+':'+topicId,first=!room.story.choices.includes(key);
 if(first){room.story.choices.push(key);if(topic.clue&&!room.story.clues.includes(topic.clue))room.story.clues.push(topic.clue);if(topic.heal)p.hp=Math.min(100,p.hp+topic.heal);}
 const localClue=npc.topics.find(t=>['schedule','policy','ledger'].includes(t.clue)&&!room.story.clues.includes(t.clue));
 const hint=localClue?'我这里有'+{schedule:'原始日程',policy:'公司制度',ledger:'审批记录'}[localClue.clue]+'，你可以先问我“'+localClue.label+'”。':nextClueHint(room.story);
 focusNpc(room,p,npcId);room.story.dialogue={npcId,name:npc.name,profession:npc.profession,text:storyDialogueText(room.story,npc,topic,hint),topicId,at:room.elapsed};
 if(topic.route&&room.story.phase==='explore'){room.story.route=topic.route;room.story.phase=topic.route==='reason'?'resolved':'challenge';if(topic.route==='reason'){room.exitOpen=true;for(const o of room.objectives)o.done=true;}else{room.story.deadline=room.elapsed+LEVEL.duration;LEVEL.enemies.forEach(e=>spawnEnemy(room,e.kind,e.x,e.z));}}
 emit(room,topic.clue?'获得线索：'+topic.label:'与'+npc.name+'交谈','dialogue',npc.x,npc.z);
}

function charge(p, n) { p.energy = Math.min(100, p.energy + n); }
function hurtEnemy(room, e, damage, p, interrupt = false) {
  if (e.hp <= 0) return;
  if (e.kind === 'shield' && !interrupt && ((p.x - e.x) * e.fx + (p.z - e.z) * e.fz) > 0) damage *= 0.4;
  e.hp = Math.max(0, e.hp - damage);
  e.hitUntil = room.elapsed + 0.15;
  charge(p, 3);
  if (interrupt && room.elapsed >= e.interruptUntil) {
    if (e.cast) { e.cast = null; charge(p, 8); emit(room, '打断！这两句，明天说。', 'hit', e.x, e.z); }
    e.stunUntil = room.elapsed + (e.kind === 'boss' ? 0.8 : 1.2);
    e.interruptUntil = room.elapsed + (e.kind === 'boss' ? 3 : 1.5);
  }
  if (!e.hp) {
    p.kills++; charge(p, 12); emit(room, e.kind === 'boss' ? '组长退场。电梯已解锁！' : '阻拦已解除', 'hit', e.x, e.z);
    if (e.kind === 'boss') { room.exitOpen = true; room.projectiles = [];if(room.story){room.story.phase='resolved';emit(room,'质询结束：电梯已开放，带着自己的时间离开。','story');} }
  }
}
export function damagePlayer(room, p, damage, delayed = false) {
  if (p.state !== 'active' || room.elapsed < p.dodgeUntil || room.elapsed < p.hitUntil) return;
  const absorb = Math.min(p.shield, damage); p.shield -= absorb; damage -= absorb;
  p.hp = Math.max(0, p.hp - damage); p.hitUntil = room.elapsed + 0.65;
  p.interactProgress = 0;
  if (delayed && room.elapsed >= p.penaltyUntil && room.penalty < 30) {
    const cost = Math.min(3, 30 - room.penalty); room.penalty += cost; p.penaltyUntil = room.elapsed + 5;
    emit(room, `会议拖延 −${cost}s`, 'danger', p.x, p.z);
  }
  if (!p.hp) { p.state = 'down'; p.downUntil = room.elapsed + 20; emit(room, `${p.name}倒地，需要救援`, 'danger'); }
}
function ownedWeapon(p){return p.inventory.find(w=>w.kind===p.weapon);}
function cancelReload(p){p.reloadUntil=0;p.reloadingWeapon=null;}
function nextWeapon(p){if(!p.inventory.length)return;cancelReload(p);const index=p.inventory.findIndex(w=>w.kind===p.weapon);p.weapon=p.inventory[(index+1)%p.inventory.length].kind;p.durability=ownedWeapon(p).durability??0;}
function beginReload(room,p){const def=WEAPONS[p.weapon],owned=ownedWeapon(p);if(!def||def.melee||!owned||owned.ammo>=def.magazine||owned.reserve<=0||p.reloadUntil>room.elapsed)return;cancelReload(p);p.reloadingWeapon=p.weapon;p.reloadUntil=room.elapsed+def.reload;emit(room,'装填 '+def.name,'reload',p.x,p.z);}
function fireWeapon(room,p){const def=WEAPONS[p.weapon],owned=ownedWeapon(p);if(!owned||p.reloadUntil>room.elapsed)return;
 if(!owned.ammo){p.attackCd=.25;emit(room,'弹匣已空，按 R 装填','empty',p.x,p.z);return;}
 owned.ammo--;p.attackCd=def.cooldown;p.attackUntil=room.elapsed+.12;
 const rays=weaponRays(p,def,[...room.enemies,...room.npcs],room.tick*131+p.sequence);
 for(const ray of rays)if(ray.entity&&room.enemies.includes(ray.entity))hurtEnemy(room,ray.entity,def.damage,p,false);
 const event=emit(room,'','shot',p.x,p.z);event.weapon=p.weapon;event.rays=rays.map(({from,to})=>({from,to}));
}
function attack(room, p, skill = false) {
  const def=WEAPONS[p.weapon];if(!skill&&def&&!def.melee){fireWeapon(room,p);return;}
  const transformed = room.elapsed < p.transformUntil;
  const radius = skill ? p.role === 'coder' ? 3.8 : 3 : def?.melee?def.range:transformed ? 3.2 : 2;
  const damage = skill ? 42 : def?.melee?def.damage:p.weapon === 'chair' ? 42 : p.weapon === 'keyboard' ? 30 : p.weapon === 'extinguisher' ? 16 : [10, 12, 18][p.combo % 3];
  let hits = 0;
  const targets = room.enemies.filter(e => e.hp > 0 && dist(e, p) <= radius && clearLine(p, e));
  const nearest = targets.sort((a, b) => dist(a, p) - dist(b, p))[0];
  if (nearest && p.input.aimX === undefined) { const d = dist(nearest, p) || 1; p.fx = (nearest.x - p.x) / d; p.fz = (nearest.z - p.z) / d; }
  for (const e of targets) {
    const d = dist(p, e) || 1;
    if (!skill && (p.fx * (e.x - p.x) + p.fz * (e.z - p.z)) / d < 0.1) continue;
    hurtEnemy(room, e, transformed ? damage * 2 : damage, p, skill || p.weapon === 'chair' || p.combo % 3 === 2);
    if (p.weapon === 'extinguisher') e.stunUntil = room.elapsed + 0.3;
    hits++;
  }
  p.attackUntil = room.elapsed + 0.22; p.combo++;
  if (skill) { p.skillCd = 9; emit(room, p.role === 'coder' ? '干扰脉冲' : '推车冲撞', 'skill', p.x, p.z); }
  else { p.attackCd = def?.melee?def.cooldown:transformed ? 0.25 : 0.38; emit(room, hits ? '命中' : '', 'swing', p.x, p.z); }
  if(!skill&&def?.melee){const owned=ownedWeapon(p);if(owned){owned.durability--;p.durability=owned.durability;if(owned.durability<=0){p.inventory=p.inventory.filter(w=>w!==owned);p.weapon=null;}}}
  else if (!skill && p.weapon && --p.durability <= 0) p.weapon = null;
}
function interaction(room, p, dt) {
  const reset = () => { p.interactProgress = 0; p.interactTarget = null; };
  if (!p.input.interact&&!p.input.pickup) { p.pickupHeld=false;reset(); return; }
  let target, seconds, complete;
  if (p.state === 'down') {
    if (p.input.interact && room.players.length === 1 && p.revives < 1) {
      target = 'self'; seconds = 3; complete = () => { p.state = 'active'; p.hp = 40; p.revives++; p.hitUntil = room.elapsed + 1; emit(room, '免费自救完成'); };
    }
  } else if (p.state === 'active') {
    const inFocus = target => {
      if (p.input.aimX === undefined || dist(p, target) < 0.45) return true;
      return ((target.x - p.x) * p.fx + (target.z - p.z) * p.fz) / dist(p, target) > 0.3;
    };
    const down = p.input.interact&&room.players.find(q => q !== p && q.state === 'down' && q.revives < 2 && dist(p, q) < 1.8 && inFocus(q));
    const obj = p.input.interact&&room.objectives.find(o => !o.done && dist(p, o) < 1.8 && inFocus(o));
    if (down) {
      target = down.id; seconds = 3; complete = () => { down.state = 'active'; down.hp = 40; down.revives++; down.hitUntil = room.elapsed + 1; p.saved++; charge(p, 15); emit(room, '队友已救起'); };
    } else if (obj) {
      target = obj.id; seconds = obj.seconds;
      complete = () => { obj.done = true; room.players.forEach(q => charge(q, 15)); emit(room, `${obj.label} · 已完成`); };
    } else if (p.input.interact && room.exitOpen && dist(p, LEVEL.exit) < 1.8 && inFocus(LEVEL.exit)) {
      target = 'exit'; seconds = 1; complete = () => { p.state = 'extracted'; emit(room, `${p.name}已准点下班`); };
    } else {
      const item = room.items.filter(i => !i.taken && dist(i,p)<1.4&&inFocus(i)&&clearLine(p,i)).sort((a,b)=>dist(a,p)-dist(b,p))[0];
      if (item && !(WEAPONS[item.kind]&&p.pickupHeld)) {
        target = item.id; seconds = p.input.pickup?0:0.25; complete = () => {
          item.taken = true;
          if (item.kind === 'coffee') p.speedUntil = room.elapsed + 10;
          else if (item.kind === 'box') p.shield = 30;
          else if(WEAPONS[item.kind]){const def=WEAPONS[item.kind];if(!p.inventory.some(w=>w.kind===item.kind))p.inventory.push({kind:item.kind,ammo:def.magazine,reserve:def.reserve,durability:def.durability});p.weapon=item.kind;p.durability=def.durability;p.pickupHeld=true;cancelReload(p);}
          else { p.weapon = item.kind; p.durability = item.kind === 'extinguisher' ? 10 : item.kind === 'chair' ? 2 : 3; }
          emit(room, WEAPONS[item.kind]?WEAPONS[item.kind].name+'已拾取 · B 切换 / R 装填':'办公道具已拾取');
        };
      }
    }
  }
  if (!target) { reset(); return; }
  if (p.interactTarget !== target) { p.interactProgress = 0; p.interactTarget = target; }
  p.interactProgress += dt;
  if (p.interactProgress >= seconds) { complete(); reset(); }
}

// The immutable navigation grid covers the approved floor; authority remains on the server.
const cell = .5, minX = -LEVEL.width / 2 + .5, minZ = -LEVEL.depth / 2 + .5;
const w = Math.floor((LEVEL.width - 1) / cell) + 1, h = Math.floor((LEVEL.depth - 1) / cell) + 1;
const navigable = Uint8Array.from({length:w*h}, (_,i) => Number(validPosition((i%w)*cell+minX,Math.floor(i/w)*cell+minZ,.4)));
function pathTo(entity, target) {
  const coord = (a) => [Math.max(0, Math.min(w - 1, Math.round((a.x - minX) / cell))), Math.max(0, Math.min(h - 1, Math.round((a.z - minZ) / cell)))];
  const point = (id) => ({ x: (id % w) * cell + minX, z: Math.floor(id / w) * cell + minZ });
  const [sx, sz] = coord(entity), [tx, tz] = coord(target), start = sz * w + sx, goal = tz * w + tx;
  const prev = new Int32Array(w * h).fill(-2), queue = [start]; prev[start] = -1;
  let head = 0;
  while (head < queue.length) {
    const n = queue[head++]; if (n === goal) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = n % w + dx, z = Math.floor(n / w) + dz, next = z * w + x;
      if (x < 0 || x >= w || z < 0 || z >= h || prev[next] !== -2) continue;
      if (!navigable[next]) continue;
      prev[next] = n; queue.push(next);
    }
  }
  if (prev[goal] === -2) return [];
  const result = []; let n = goal;
  while (n !== start && n >= 0) { result.unshift(point(n)); n = prev[n]; }
  return result;
}
function npcStep(room,n,dt){
 const partner=n.conversation&&room.players.find(p=>p.id===n.conversation.playerId&&p.connected&&p.state==='active');
 if(partner&&room.elapsed<n.conversation.until&&dist(n,partner)<2.6&&clearLine(n,partner)){const d=dist(n,partner)||1;n.fx=(partner.x-n.x)/d;n.fz=(partner.z-n.z)/d;n.behavior='talking';n.activity='和'+partner.name+'交谈';return;}
 n.conversation=null;
 const stations=NPC_ROUTINES[n.id];if(!stations)return;
 const threat=room.enemies.some(e=>e.hp>0&&dist(n,e)<5);
 if(threat){n.behavior='waiting';n.activity='避让冲突，暂停手头工作';return;}
 if(!n.navPath&&room.elapsed>=n.nextRoutineAt){n.routineIndex=(n.routineIndex+1)%stations.length;n.navPath=pathTo(n,stations[n.routineIndex]);}
 const destination=stations[n.routineIndex];
 if(n.navPath){while(n.navPath.length&&dist(n,n.navPath[0])<.12)n.navPath.shift();const target=n.navPath[0]??destination;const d=dist(n,target);
  if(d<.12){n.navPath=null;n.nextRoutineAt=room.elapsed+destination.seconds;n.visits++;}
  else{const step=Math.min(d,1.05*dt),dx=(target.x-n.x)/d*step,dz=(target.z-n.z)/d*step;const next={x:n.x+dx,z:n.z+dz};
   if(room.players.some(p=>p.connected&&p.state==='active'&&dist(p,next)<.75)||room.npcs.some(other=>other!==n&&dist(other,next)<.55)){n.behavior='waiting';n.activity='等通道让开';return;}
   if(!validPosition(next.x,next.z,.36)){n.navPath=null;n.nextRoutineAt=room.elapsed+2;n.behavior='waiting';n.activity='重新查看通道';return;}
   move(n,dx,dz);n.fx=dx/step;n.fz=dz/step;n.behavior='walking';n.activity='前往'+destination.activity+'的位置';return;
  }
 }
 n.behavior='working';n.activity=destination.activity;
}
function enemyStep(room, e, dt) {
  if (e.hp <= 0 || room.elapsed < e.stunUntil) return;
  const targets = room.players.filter(p => p.state === 'active');
  const target = targets.sort((a, b) => dist(a, e) - dist(b, e))[0];
  if (!target) return;
  e.attackCd -= dt;
  if (e.kind === 'boss' && e.phase === 1 && e.hp <= e.maxHp / 2) {
    e.phase = 2; spawnEnemy(room, 'runner', 7, -6); spawnEnemy(room, 'thrower', 10, -3);
    emit(room, '第二阶段 · 大家都没走！', 'danger');
  }
  if (e.cast) {
    if (room.elapsed >= e.cast.end) {
      const cast = e.cast; e.cast = null; e.attackCd = e.kind === 'boss' ? 1.6 : 1.8;
      if (cast.type === 'projectile') {
        const dx = target.x - e.x, dz = target.z - e.z, d = Math.hypot(dx, dz) || 1;
        room.projectiles.push({ id: `pr${room.tick}_${e.id}`, x: e.x, z: e.z, vx: dx / d * 8, vz: dz / d * 8, life: 2.5 });
      } else for (const p of room.players) {
        if (dist(p, cast) <= cast.radius) damagePlayer(room, p, e.kind === 'boss' ? 18 : 9, cast.type === 'delay');
      }
    }
    return;
  }
  const ranged = e.kind === 'thrower', distance = dist(e, target);
  const range = ranged ? 7 : e.kind === 'boss' ? 3 : 1.4;
  if (distance <= range && e.attackCd <= 0) {
    const type = ranged ? 'projectile' : e.kind === 'boss' && room.tick % 3 !== 0 ? 'delay' : 'melee';
    e.cast = { x: type === 'delay' ? target.x : e.x, z: type === 'delay' ? target.z : e.z,
      type, radius: type === 'delay' ? 2.6 : e.kind === 'boss' ? 2.4 : 1.6, end: room.elapsed + (e.kind === 'boss' ? 1 : 0.6) };
    return;
  }
  if (distance > (ranged ? 5 : 1.1)) {
    if (room.elapsed >= e.pathAt || !e.path.length) { e.path = pathTo(e, target); e.pathAt = room.elapsed + 0.6; }
    let goal = e.path[0] || target;
    if (dist(e, goal) < 0.25) { e.path.shift(); goal = e.path[0] || target; }
    const dx = goal.x - e.x, dz = goal.z - e.z, d = Math.hypot(dx, dz) || 1;
    e.fx = dx / d; e.fz = dz / d;
    move(e, e.fx * dt * (e.kind === 'boss' ? 1.5 : 1.9), e.fz * dt * (e.kind === 'boss' ? 1.5 : 1.9));
  }
}
export function finishRoom(room, reason) {
  if (room.status !== 'running') return;
  room.status = 'ended';
  const extracted = room.players.filter(p => p.state === 'extracted');
  room.result = { success: extracted.length > 0, all: extracted.length === room.players.length, reason,
    remaining: remaining(room), players: room.players.map(p => ({ id: p.id, name: p.name, extracted: p.state === 'extracted', kills: p.kills, saved: p.saved })) };
  if(room.story){room.result.storyEnding=storyEnding(room.story,extracted.length>0,reason);room.story.phase='ended';for(const npc of room.npcs)npc.conversation=null;}
  emit(room, extracted.length ? '已打卡。剩下的时间，是自己的。' : '今天晚了一点，明天再来。');
}
export function stepRoom(room, dt) {
  if (room.status !== 'running' || !finite(dt) || dt <= 0) return;
  // Clamp to the deadline so a long scheduling interval cannot accept interactions after 18:00.
  dt = Math.min(dt, remaining(room));
  room.elapsed += dt; room.tick++;
  for (const p of room.players) {
    p.appliedSequence=p.sequence;
    if (!p.connected || room.elapsed - p.inputAt > 0.3){p.input={};p.pendingActions={};}
    const heldInput=p.input,pressed=p.pendingActions;p.input={...heldInput,...pressed};p.pendingActions={};
    p.attackCd = Math.max(0, p.attackCd - dt); p.skillCd = Math.max(0, p.skillCd - dt); p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    if (!p.connected && p.disconnectedAt !== null && room.elapsed - p.disconnectedAt >= 60 && p.state !== 'extracted') p.state = 'left';
    if (p.state === 'down' && room.elapsed >= p.downUntil) p.state = 'eliminated';
    if(p.state!=='active'||!p.connected)cancelReload(p);
    if(p.reloadingWeapon&&p.reloadUntil<=room.elapsed){const owned=p.inventory.find(w=>w.kind===p.reloadingWeapon),def=WEAPONS[p.reloadingWeapon];if(owned&&p.weapon===p.reloadingWeapon){const n=Math.min(def.magazine-owned.ammo,owned.reserve);owned.ammo+=n;owned.reserve-=n;}cancelReload(p);}
    if (p.state === 'active') {
      if(p.input.weaponNext&&(!p.switchHeld||pressed.weaponNext))nextWeapon(p);
      if(p.input.reload&&(!p.reloadHeld||pressed.reload))beginReload(room,p);
      const x = p.input.x || 0, z = p.input.z || 0;
      if (p.input.aimX !== undefined) { p.fx = p.input.aimX; p.fz = p.input.aimZ; }
      else if (x || z) { const len = Math.hypot(x, z); p.fx = x / len; p.fz = z / len; }
      if (p.input.dodge && p.dodgeCd <= 0) { p.dodgeCd = 3; p.dodgeUntil = room.elapsed + 0.18; move(p, p.fx * 0.6, p.fz * 0.6); }
      const speed = movementSpeed(p,room.elapsed);
      move(p, x * speed * dt, z * speed * dt);
      if (p.input.transform && p.energy >= 100 && room.elapsed >= p.transformUntil) {
        p.energy = 0; p.transformUntil = room.elapsed + 12; p.shield = Math.max(p.shield, 30); emit(room, '闪退侠 · 下班意志觉醒', 'skill', p.x, p.z);
      }
      if (p.input.skill && p.skillCd <= 0) attack(room, p, true);
      else if (p.input.throw && p.weapon && (!WEAPONS[p.weapon]||WEAPONS[p.weapon].melee) && p.attackCd <= 0) {
        room.projectiles.push({ id: `throw${room.tick}_${p.id}`, owner: p.id, kind: p.weapon, x: p.x, z: p.z, vx: p.fx * 10, vz: p.fz * 10, life: 1.5 });
        p.inventory=p.inventory.filter(w=>w.kind!==p.weapon);cancelReload(p);p.weapon = null; p.durability = 0; p.attackCd = 0.5; p.attackUntil = room.elapsed + 0.2;
      }
      else if (p.input.attack && p.attackCd <= 0 && (!WEAPONS[p.weapon]||WEAPONS[p.weapon].melee||WEAPONS[p.weapon].automatic||!p.fireHeld||pressed.attack)) attack(room, p);
    }
    p.fireHeld=Boolean(heldInput.attack);p.reloadHeld=Boolean(heldInput.reload);p.switchHeld=Boolean(heldInput.weaponNext);
    interaction(room, p, dt);p.input=heldInput;
  }
  if (!room.exitOpen && (!room.story||room.story.phase==='challenge') && !room.bossSpawned && room.objectives.every(o => o.done)) {
    room.bossSpawned = true; spawnEnemy(room, 'boss', LEVEL.boss.x, LEVEL.boss.z);
    room.players.forEach(p => charge(p, 25)); emit(room, '组长：就两句话，真的。', 'danger');
  }
  for(const n of room.npcs)npcStep(room,n,dt);
  for (const e of room.enemies) enemyStep(room, e, dt);
  for (const pr of room.projectiles) {
    pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.life -= dt;
    if (!validPosition(pr.x, pr.z, 0.1)) pr.life = 0;
    if (pr.life <= 0) continue;
    if (pr.owner) {
      const owner = room.players.find(p => p.id === pr.owner);
      for (const e of room.enemies) if (e.hp > 0 && dist(pr, e) < 0.7 && owner) { hurtEnemy(room, e, pr.kind === 'chair' ? 65 : 40, owner, true); pr.life = 0; break; }
    } else for (const p of room.players) if (p.state === 'active' && dist(pr, p) < 0.6) { damagePlayer(room, p, 8); pr.life = 0; break; }
  }
  room.projectiles = room.projectiles.filter(p => p.life > 0);
  if (remaining(room) <= 0) finishRoom(room, 'timeout');
  else if (room.players.every(p => ['extracted', 'eliminated', 'left'].includes(p.state))) finishRoom(room, 'resolved');
  else if (!room.players.some(p => p.state === 'active') && !room.players.some(p => p.state === 'down' && room.players.length === 1 && p.revives < 1)) finishRoom(room, 'team_down');
}
export function snapshot(room) {
  return { protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,id: room.id, mode:room.mode,story:room.story,npcs:room.npcs.map(({navPath,routineIndex,nextRoutineAt,conversation,...npc})=>({...npc,conversing:Boolean(conversation)})),status: room.status, host: room.host, tick: room.tick, elapsed: room.elapsed,
    loadoutRevision:room.loadoutRevision, assetVersion:LEVEL.revision,characterVersion:LEVEL.characterRevision, remaining: remaining(room), penalty: room.penalty, exitOpen: room.exitOpen, result: room.result,
    objectives: room.objectives,
    players: room.players.map(({ input, pendingActions, inputAt, disconnectedAt, ...p }) => p),
    enemies: room.enemies.filter(e => e.hp > 0).map(({ path, pathAt, ...e }) => e),
    items: room.items.filter(i => !i.taken), projectiles: room.projectiles, events: room.events };
}
