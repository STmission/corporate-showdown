import {InputControls} from '/input-controls.mjs';
import {TrialSocket} from './trial-socket.mjs';
import {ConversationFocus} from './conversation-focus.mjs';
import {weaponLabel} from '/shared/weapons.mjs';
import {nearestStoryNpc,storyTopicAvailable} from '/shared/story.mjs';
import { ReliableCommands,consumeEvents } from './reliable-channel.mjs';
import { MovementPrediction } from './network-state.mjs';
import { PROTOCOL_VERSION,RULES_VERSION,INPUT_HZ,compatible } from '/shared/protocol.mjs';
import { createView } from './view.mjs';
import { AudioDirector } from './audio.mjs';
import { AUDIO_GROUPS } from './audio-settings.mjs';
import { appearanceLabel } from '/shared/appearance.mjs';
import { LEVEL, ITEM_NAMES, ROLES } from '/shared/level.mjs';

const $ = id => document.getElementById(id);
const localTrial=document.documentElement.dataset.runtime==='local-trial';
const serviceLabel=localTrial?'单人试玩 · 本机运行':'服务已连接';
const commands=new ReliableCommands(wire,()=>crypto.randomUUID());
setInterval(()=>commands.flush(),1000);
const prediction=new MovementPrediction();
let fatalVersion=false;
let view;
try { view = createView($('scene')); } catch { $('connection').textContent = '3D 图形初始化失败'; $('toast').textContent = '当前环境无法启动 WebGL，请使用支持 WebGL 的浏览器。'; $('toast').classList.add('show'); throw new Error('WebGL unavailable'); }
let homeResourcesReady=false;
const resourceButtons = ['solo','create'];
function updateHomeButtons(){resourceButtons.forEach(id=>$(id).disabled=!homeResourcesReady||!connected);$('join-form').querySelector('button').disabled=!homeResourcesReady||!connected;}
resourceButtons.forEach(id => $(id).disabled=true);
$('join-form').querySelector('button').disabled=true;
$('resource-status').textContent='正在加载海岸总部场景…';
view.ready.then(() => {
  homeResourcesReady=true;updateHomeButtons();
  $('resource-status').textContent='海岸总部已就绪 · 52 工位 / 整层场景';
}).catch(e => {$('resource-status').textContent=`场景加载失败：${e.message}。请刷新重试。`;});
window.gameDiagnostics = () => ({...view.diagnostics(),network:{protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,ack:prediction.ack,pending:prediction.pending.length,correction:prediction.correction,predictionStopped:prediction.overflow}});
let socket, state = null, playerId = null, token = null, sequence = 0, lastEvent = 0;
let toastTimer, reconnectTimer, connected = false, soloPending = false, departing = false, againRole = 'coder';
let previousStatus = null, menuOpen = false;
const conversationFocus=new ConversationFocus();
const audio = new AudioDirector();
const movementControls=new InputControls();const movementKeys={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
const taps=new Set();const keys = new Set(), held = new Set(), stick = { x: 0, z: 0 }, screens = ['home', 'lobby', 'hud', 'result', 'help', 'pause-menu'];
function show(id) {
  screens.forEach(s => $(s).classList.toggle('hidden', s !== id));
  view.setHome(id === 'home');
  $('pickup-button').classList.toggle('hidden',id!=='hud');
  $('menu-button').classList.toggle('hidden', !['hud', 'pause-menu'].includes(id));
  document.body.classList.toggle('in-game', ['hud', 'pause-menu'].includes(id));
  if (!['hud', 'pause-menu'].includes(id)) audio.stop();
}
function toast(text) { if (!text) return; $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2500); }
function wire(data) { if (socket?.readyState === WebSocket.OPEN) {socket.send(JSON.stringify({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,eventAck:lastEvent,...data}));return true;} toast('正在重新连接，请稍候');return false; }
function send(data){if(['ready','appearance','start','dialogue','conversation'].includes(data.type)){const ok=commands.enqueue(data);if(!ok)toast('操作队列已满，请等待当前操作确认');return ok;}return wire(data);}
function escape(text) { const el = document.createElement('span'); el.textContent = text; return el.innerHTML; }
function beep(kind) { audio.event(kind); }
function connect() {
  clearTimeout(reconnectTimer);
  socket = localTrial ? new TrialSocket() : new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/socket`);
  socket.onopen = () => { send({type:'hello'}); }; 
  socket.onclose = () => { connected = false;finishConversation('连接中断，已结束交谈。'); updateHomeButtons(); resetInput(); commands.suspend();prediction.suspend();view.setPredictedPosition(prediction.pose); $('connection').textContent = token ? '网络断开 · 正在重连' : '服务断开 · 正在重连'; if(!fatalVersion)reconnectTimer = setTimeout(connect, 1500);else $('connection').textContent='版本不兼容 · 请刷新页面'; };
  socket.onerror = () => {};
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if(!compatible(data)||data.code==='VERSION_MISMATCH'){fatalVersion=true;resetLobby();toast('客户端与服务版本不一致，请刷新页面');socket.close();return;}
    if(data.type==='hello'){
      if(data.assetVersion!==LEVEL.revision||data.characterVersion!==LEVEL.characterRevision){fatalVersion=true;toast('场景版本不一致，请刷新页面');socket.close();return;}
      connected=true;updateHomeButtons();$('connection').textContent=serviceLabel;if(token)send({type:'resume',token});
    } else if (data.type === 'joined') {
      const resuming=playerId===data.playerId&&token===data.token;
      playerId = data.playerId; token = data.token;commands.synchronize(data.commandSequence,{resume:resuming}); sequence = (data.state.players.find(p => p.id === playerId)?.sequence ?? -1) + 1;
      previousStatus = null; if(!resuming)lastEvent = 0;prediction.reconcile(data.state,playerId,{reset:true});update(data.state);
      if (soloPending) { soloPending = false; prepareReady(true); show('help'); }
    } else if (data.type === 'state') update(data.state);
    else if(data.type==='commandResult'){if(commands.receive(data)&&!data.ok)toast(data.message);}
    else if (data.type === 'error') {
      toast(data.message);
      if (/重连保留期/.test(data.message)) resetLobby();
    } else if (data.type === 'left') {
      departing = false;
      resetLobby();
      if (soloPending) createSolo();
    }
  };
}
function resetInput() { movementControls.setActive(false);taps.clear();keys.clear(); held.clear(); stick.x = 0; stick.z = 0; $('stick').style.transform = ''; document.querySelectorAll('.pressed').forEach(b => b.classList.remove('pressed')); }
function resetLobby() { conversationFocus.end();view.setConversation(null);document.body.classList.remove('talking');$('story-dialogue').close(); commands.reset();prediction.reset();view.setPredictedPosition(null);roomResources=null; menuOpen = false; audio.stop(); state = null; playerId = null; token = null; previousStatus = null; lastEvent = 0; resetInput(); view.clear(); $('connection').textContent=connected?serviceLabel:'服务已断开'; show('home'); }
function update(next) {
  if (!playerId) return;
  if(next.assetVersion!==LEVEL.revision||next.characterVersion!==LEVEL.characterRevision){leaveGame();toast('客户端与房间场景版本不一致，请刷新页面后重新进入。');return;}
  if(state?.id===next.id&&next.tick<state.tick)return;
  prediction.reconcile(next,playerId);view.setPredictedPosition(next.status==='running'?prediction.pose:null);
  state = next; view.setState(next, playerId);const focusResult=conversationFocus.observe(next,playerId,performance.now());if(focusResult)finishConversation(focusResult==='released'?'本次交谈已结束，可再次靠近交流。':'当前无法继续交谈。');if($('story-dialogue').open&&next.story?.dialogue){const p=$('story-dialogue').querySelector('p');if(p&&p.dataset.npcId===next.story.dialogue.npcId)p.textContent=next.story.dialogue.text;}
  const me = next.players.find(p => p.id === playerId); if (!me) return;
  if (next.status !== previousStatus) {
    if (next.status === 'lobby') show('lobby');
    if (next.status === 'running') { menuOpen = false; show('hud'); resetInput(); audio.start(next.remaining,next.story?.deadline===null); toast('点击场景环视，交接完成后前往电梯。'); }
    if (next.status === 'ended') { resetInput(); showResult(next, me); }
    previousStatus = next.status;
  }
  $('connection').textContent = connected ? (localTrial?serviceLabel:`服务已连接 · 房间 ${next.id}`) : '网络断开 · 正在重连';
  const cursor=lastEvent;
  if(next.eventGap&&cursor<next.eventBase-1)toast('部分历史反馈已过期，已同步当前任务状态');
  lastEvent=consumeEvents(next,lastEvent,event=>{if(event.text&&event.kind!=='hit')toast(event.text);if(['hit','skill','danger','shot','reload','empty'].includes(event.kind)&&next.elapsed-event.at<2)beep(event.kind);});
  if(lastEvent>next.eventAck)send({type:'eventAck',eventAck:lastEvent});
  if (next.status === 'lobby') {
    $('room-code').textContent = next.id;
    $('members').innerHTML = next.players.map(p => `<div class="member"><span>${escape(p.name)}${p.id === playerId ? ' · 你' : ''}<small>${ROLES[p.role].label} · ${appearanceLabel(p)}${p.id === next.host ? ' / 房主' : ''}</small></span><b>${p.ready ? '已准备' : '等待准备'}</b></div>`).join('');
    $('lobby-gender').value=me.gender; $('lobby-job').value=me.job;
    prepareRoom(next);
    $('ready').textContent = roomResources?.failed ? '重新加载服装' : me.ready ? '取消准备' : '我准备好了';
    $('start').disabled = next.host !== playerId || !next.players.every(p => p.ready);
    return;
  }
  if (next.status !== 'running') return;
  audio.update(next.remaining,next.story?.deadline===null);
  if(me.state==='active')audio.warnEnemies(next.enemies,next.elapsed,me);
  const seconds = Math.ceil(next.remaining);
  $('timer').textContent = next.story?.deadline===null?'自由探索':`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  document.querySelector('.clock').classList.toggle('urgent', seconds <= 30);
  $('penalty').textContent = next.penalty ? `会议拖延已损失 ${next.penalty} 秒` : '准点行动已开始';
  const displayObjectives=next.story?.phase==='explore'?[['schedule','询问许老师：原始日程'],['policy','询问顾律师：公司制度'],['ledger','询问周姐：审批记录']].map(([id,label])=>({label,done:next.story.clues.includes(id)})):next.objectives;
  $('objectives').innerHTML = displayObjectives.map((o, i) => `<div class="objective ${o.done ? 'done' : ''}"><b>${o.done ? '✓' : i + 1}</b>${o.label}</div>`).join('') + `<div class="objective ${next.exitOpen ? 'done' : ''}"><b>↗</b>${next.exitOpen ? '电梯已开放 · 前往撤离' : next.story?.phase==='explore'?'证据齐全后选择协商或质询':'突破组长，解锁电梯'}</div>`;
  $('team').innerHTML = next.players.filter(p => p.id !== playerId).map(p => `<div class="team-member"><span>${escape(p.name)}</span><span>${p.state === 'extracted' ? '已下班' : p.state === 'down' ? '需要救援' : !p.connected ? '掉线' : `${Math.ceil(p.hp)} HP`}</span></div>`).join('');
  $('mission-title').textContent = next.story?.phase==='explore'?next.story.chapter:next.exitOpen ? '电梯开了。现在就走。' : next.objectives.every(o => o.done) ? '组长的两句话，明天说。' : '交接完成，就去电梯。';
  $('player-name').textContent = me.name; $('portrait').textContent = me.role === 'admin' ? '安' : '程';
  $('hp-fill').style.width = `${me.hp}%`; $('hp').textContent = `${Math.ceil(me.hp)}/100`;
  $('weapon').textContent = weaponLabel(me,next.elapsed)??(me.weapon ? `${ITEM_NAMES[me.weapon]} · 剩余 ${me.durability} 次` : me.shield ? `纸箱护盾 · ${Math.ceil(me.shield)} 点` : '空手 · E 拾取 / B 切换 / R 装填');
  $('skill-cd').textContent = me.skillCd > 0 ? `${Math.ceil(me.skillCd)}s` : ROLES[me.role].skill;
  $('dodge-cd').textContent = me.dodgeCd > 0 ? `${Math.ceil(me.dodgeCd)}s` : '准备就绪';
  $('energy').textContent = me.transformUntil > next.elapsed ? `${Math.ceil(me.transformUntil - next.elapsed)}s` : `${Math.floor(me.energy)}%`;
  document.querySelector('[data-action="transform"]').classList.toggle('charged', me.energy >= 100 || me.transformUntil > next.elapsed);
  const boss = next.enemies.find(e => e.kind === 'boss'); $('boss-hud').classList.toggle('hidden', !boss);
  if (boss) { $('boss-fill').style.width = `${boss.hp / boss.maxHp * 100}%`; $('boss-phase').textContent = `阶段 ${boss.phase} / 2`; }
  updatePrompt(me, next);
}
function updatePrompt(me, s) {
  const d = p => Math.hypot(p.x - me.x, p.z - me.z);
  const facing = view.direction();
  const focused = p => d(p) < 0.45 || ((p.x - me.x) * facing.x + (p.z - me.z) * facing.z) / d(p) > 0.3;
  let message = '', duration = 2;
  if (me.state === 'extracted') message = '你已下班 · 等待队友撤离';
  else if (me.state === 'eliminated' || me.state === 'left') message = '本次行动已结束 · 观察队友';
  else if (me.state === 'down') { message = s.players.length === 1 && me.revives < 1 ? '长按 E / 互动 · 免费自救' : '等待队友救援'; duration = 3; }
  else {
    const down = s.players.find(p => p.id !== me.id && p.state === 'down' && d(p) < 1.8 && focused(p)), obj = s.objectives.find(o => !o.done && d(o) < 1.8 && focused(o));
    const item = s.items.find(i => d(i) < 1.4 && focused(i));
    if (down) { message = '长按 E / 互动 · 救起队友'; duration = 3; }
    else if (obj) { message = `长按 E / 互动 · ${obj.label}`; duration = obj.seconds; }
    else if (s.exitOpen && d(LEVEL.exit) < 1.8 && focused(LEVEL.exit)) { message = '长按 E / 互动 · 准点撤离'; duration = 1; }
    else if (item) { message = `长按 E / 互动 · 拾取${ITEM_NAMES[item.kind]}`; duration = 0.25; }
  }
  $('prompt').classList.toggle('hidden', !message);
  if (message) $('prompt').innerHTML = `${message}${me.interactProgress > 0 ? `<progress max="${duration}" value="${me.interactProgress}"></progress>` : ''}`;
}
function showResult(s, me) {
  show('result');
  const r = s.result;
  if(r.storyEnding){const ending=r.storyEnding;$('result-label').textContent='第一章 · '+(r.success?'行动完成':'行动暂歇');$('result-title').textContent=ending.title;$('result-text').textContent=ending.summary+'\n\n'+ending.voices.map(v=>v.name+'：'+v.text).join('\n');$('result-stats').innerHTML=`<div><strong>${ending.evidence.length}/3</strong><small>核对证据</small></div><div><strong>${ending.selfCare?'有':'未选择'}</strong><small>给自己休息</small></div><div><strong>${ending.declaration?'已听':'未选择'}</strong><small>下班宣言</small></div>`;return;}
  $('result-label').textContent = r.all ? '全员准时下班' : r.success ? '团队通关' : '行动结束';
  $('result-title').textContent = me.state === 'extracted' ? '准点下班。' : r.success ? '队友已成功撤离。' : '明天，再来一次。';
  $('result-text').textContent = me.state === 'extracted' ? '工作交接完毕，电梯门打开。今晚的时间留给自己。' : r.success ? '团队已经通关，你本次未能撤离。下一班一起走。' : r.reason === 'timeout' ? '18:00 已到，这次错过了下班。试着利用道具和打断技能。' : '全队已失去行动能力。留意红色预警，闪避后再反击。';
  $('result-stats').innerHTML = `<div><strong>${Math.floor(r.remaining)}s</strong><small>剩余时间</small></div><div><strong>${me.kills}</strong><small>解除阻拦</small></div><div><strong>${me.saved}</strong><small>队友救援</small></div>`;
}
let roomResources=null;
function roomResourceStatus(text){$('room-resource-status').textContent=text;$('brief-resource-status').textContent=text;}
function prepareRoom(next) {
  const key=`${next.id}:${next.loadoutRevision}`;
  if(roomResources?.key===key)return roomResources.promise;
  $('ready').disabled=true; $('brief-start').disabled=true;
  $('retry-brief-assets').hidden=true;roomResourceStatus('正在下载人物与服装，首次进入请稍候…');
  const request={key}; roomResources=request;
  request.promise=view.prepareAppearances([...next.players,...(next.npcs??[])],playerId).then(()=>{
    if(roomResources!==request||state?.id!==next.id||state?.loadoutRevision!==next.loadoutRevision)return false;
    $('ready').disabled=false;$('brief-start').disabled=false;
    roomResourceStatus('人物已就绪，可以进入办公室。');return true;
  }).catch(e=>{if(roomResources===request){request.failed=true;$('ready').disabled=false;$('ready').textContent='重新加载服装';$('retry-brief-assets').hidden=false;roomResourceStatus(`人物加载失败：${e.message}。可重新加载或返回大厅。`);}return false;});
  return request.promise;
}
async function prepareReady(ready) {
  if(!state||state.status!=='lobby')return;
  if(!ready){send({type:'ready',ready:false});return;}
  if(roomResources?.failed)roomResources=null;
  const next=state;
  if(await prepareRoom(next))send({type:'ready',ready:true,assetRevision:next.loadoutRevision,assetVersion:LEVEL.revision,characterVersion:LEVEL.characterRevision});
}
for(const id of ['lobby-gender','lobby-job'])$(id).onchange=()=>{
  send({type:'appearance',gender:$('lobby-gender').value,job:$('lobby-job').value});
};
function profile() { return { name: $('name').value, role: $('role').value, gender:$('gender').value,job:$('job').value }; }
function createSolo() { if (!connected) { soloPending = false; toast('服务尚未连接，请稍候重试'); return; } soloPending = true; if (departing) return; againRole = $('role').value; send({ type: 'create', mode:'single',...profile() }); }
$('solo').onclick = createSolo;
$('create').onclick = () => { soloPending = false; againRole = $('role').value; send({ type: 'create', ...profile() }); };
$('join-form').onsubmit = e => { e.preventDefault(); soloPending = false; send({ type: 'join', code: $('code').value, ...profile() }); };
$('retry-brief-assets').onclick=()=>prepareReady(true);
$('ready').onclick = () => prepareReady(!state?.players.find(p => p.id === playerId)?.ready);
$('start').onclick = () => { show('help'); };
$('brief-start').onclick = () => { audio.activate(); send({ type: 'start' }); show('lobby'); };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(state.id); toast('房间码已复制'); } catch { toast(`房间码：${state.id}`); } };
function leaveGame() {
  soloPending = false; menuOpen = false; resetInput(); audio.stop();
  departing = connected;
  send({ type: 'leave' }); resetLobby(); view.unlock();
}
for (const id of ['leave-lobby', 'leave-game', 'home-button', 'cancel-brief', 'return-home']) $(id).onclick = leaveGame;
function openMenu() {
  if (state?.status !== 'running' || menuOpen) return;
  menuOpen = true; resetInput(); show('pause-menu'); view.unlock();
}
$('menu-button').onclick = openMenu;
$('resume-game').onclick = () => { menuOpen = false; resetInput(); show('hud'); audio.activate(); view.requestLock(); };
view.onLock(locked => {
  $('look-hint').classList.toggle('hidden', locked);
  if (!locked && state?.status === 'running' && !menuOpen) openMenu();
});
view.onStep(() => audio.event('step'));

$('again').onclick = () => { soloPending = true; departing = true; $('role').value = againRole; send({ type: 'leave' }); };
function toggleSound() { audio.toggle();syncAudioControls(); }
$('sound').onclick = toggleSound; $('menu-sound').onclick = toggleSound;

const audioDialog=$('audio-settings');
let captionTimer, dangerCaptionUntil=0;
audio.onCaption(message=>{
  if(message&&message.priority!=='danger'&&performance.now()<dangerCaptionUntil)return;
  clearTimeout(captionTimer);
  const el=$('audio-caption');el.classList.toggle('hidden',!message);el.classList.toggle('danger',message?.priority==='danger');el.textContent=message?.text??'';
  if(!message){dangerCaptionUntil=0;return;}
  if(message.priority==='danger')dangerCaptionUntil=performance.now()+2200;
  captionTimer=setTimeout(()=>el.classList.add('hidden'),message.priority==='danger'?2600:4200);
});
function syncAudioControls(){
  $('sound').textContent=audio.enabled?'音效：开':'音效：关';
  for(const group of AUDIO_GROUPS){const percent=Math.round(audio.settings[group]*100);$('audio-'+group).value=percent;$('audio-'+group+'-value').textContent=percent+'%';}
  $('audio-captions').checked=audio.settings.captions;
}
for(const group of AUDIO_GROUPS)$('audio-'+group).oninput=e=>{audio.configure({[group]:Number(e.target.value)/100});syncAudioControls();};
$('audio-captions').onchange=e=>{audio.configure({captions:e.target.checked});if(!e.target.checked)audio.caption(null);};
$('audio-settings-button').onclick=()=>{openMenu();resetInput();audio.activate();syncAudioControls();audioDialog.showModal();};
audioDialog.addEventListener('close',resetInput);
syncAudioControls();

function finishConversation(message='') {
  const active=Boolean(conversationFocus.npcId);conversationFocus.end();view.setConversation(null);document.body.classList.remove('talking');
  if(!active)return;
  menuOpen=false;resetInput();
  if(connected&&state?.status==='running')send({type:'conversation',active:false});
  if($('story-dialogue').open)$('story-dialogue').close();
  if(state?.status==='running')show('hud');
  if(message)toast(message);
}
function openDialogue(){
  if(!connected||state?.status!=='running'||menuOpen||$('story-dialogue').open)return;
  const me=state.players.find(p=>p.id===playerId),npc=me?.state==='active'&&nearestStoryNpc(state,me);
  if(!npc){toast('靠近人物后再交谈');return;}
  if(!send({type:'conversation',npcId:npc.id,active:true}))return;
  conversationFocus.begin(state.id,npc.id,performance.now());menuOpen=true;resetInput();document.body.classList.add('talking');view.setConversation(npc.id);view.unlock();
  const box=$('story-dialogue');box.replaceChildren();
  const header=document.createElement('header'),eyebrow=document.createElement('small');eyebrow.textContent='面对面交谈';header.append(eyebrow);
  const heading=document.createElement('h2');heading.textContent=npc.name+' · '+npc.profession;header.append(heading);box.append(header);
  const content=document.createElement('div');content.className='dialogue-content';box.append(content);
  const text=document.createElement('p');text.dataset.npcId=npc.id;text.textContent=state.story?.dialogue?.npcId===npc.id?state.story.dialogue.text:'正在'+(npc.activity??npc.habit)+'，愿意和你聊聊。';content.append(text);
  for(const topic of npc.topics){const button=document.createElement('button');button.textContent=topic.label;button.disabled=!storyTopicAvailable(state.story,topic);button.onclick=()=>send({type:'dialogue',npcId:npc.id,topicId:topic.id});content.append(button);}
  const footer=document.createElement('footer'),close=document.createElement('button');close.textContent='结束交谈';close.onclick=()=>finishConversation();footer.append(close);box.append(footer);box.showModal();
}
$('talk-button').onclick=openDialogue;
$('story-dialogue').addEventListener('close',()=>finishConversation());
function switchCamera(){const third=view.toggleCamera();$('camera-mode').textContent=third?'V / 第三人称':'V / 第一人称';}
$('camera-mode').onclick=switchCamera;
const actionKeys = { KeyJ: 'attack', KeyK: 'skill', KeyE: 'interact', KeyQ: 'transform', KeyL: 'throw', KeyR:'reload',KeyB:'weaponNext',KeyF:'pickup', Space: 'dodge' };
addEventListener('keydown', e => {
  if(audioDialog.open||$('story-dialogue').open)return;
  if(e.code==='KeyT'&&!e.repeat){e.preventDefault();openDialogue();return;}
  if(e.code==='KeyV'&&!e.repeat){e.preventDefault();switchCamera();return;}
  if (e.code === 'Escape' && state?.status === 'running') { e.preventDefault(); openMenu(); return; }
  if (state?.status !== 'running' || menuOpen || ['INPUT', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (actionKeys[e.code] || ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); keys.add(e.code);if(movementKeys[e.code]){movementControls.setActive(true);movementControls.press(movementKeys[e.code],e.code);}if(actionKeys[e.code]&&actionKeys[e.code]!=='interact'&&!e.repeat)taps.add(actionKeys[e.code]); }
});
addEventListener('keyup', e => {keys.delete(e.code);if(movementKeys[e.code])movementControls.release(movementKeys[e.code],{source:e.code});});
$('scene').addEventListener('pointerdown', e => {
  if (state?.status === 'running' && !menuOpen && e.pointerType === 'mouse' && e.button === 0 && document.pointerLockElement) held.add('attack');
});
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') held.delete('attack'); });

addEventListener('blur', resetInput); document.addEventListener('visibilitychange',()=>{resetInput();audio.syncVolume();if(document.hidden)audio.environment.speechSynthesis?.cancel();});
for (const button of document.querySelectorAll('[data-action]')) {
  button.onpointerdown = e => { e.preventDefault(); button.setPointerCapture(e.pointerId); held.add(button.dataset.action);if(button.dataset.action!=='interact')taps.add(button.dataset.action); button.classList.add('pressed'); };
  const release = () => { held.delete(button.dataset.action); button.classList.remove('pressed'); };
  button.onpointerup = release; button.onpointercancel = ()=>{taps.delete(button.dataset.action);release();}; button.onlostpointercapture = release;
}
let joystickPointer = null;
$('joystick').onpointerdown = e => { joystickPointer = e.pointerId; $('joystick').setPointerCapture(e.pointerId); updateStick(e); };
$('joystick').onpointermove = e => { if (e.pointerId === joystickPointer) updateStick(e); };
function updateStick(e) {
  const rect = $('joystick').getBoundingClientRect(), radius = 34;
  let x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
  const length = Math.max(radius, Math.hypot(x, y)); x = x / length * radius; y = y / length * radius;
  stick.x = x / radius; stick.z = y / radius; $('stick').style.transform = `translate(${x}px,${y}px)`;
}
const releaseStick = () => { joystickPointer = null; stick.x = 0; stick.z = 0; $('stick').style.transform = ''; };
$('joystick').onpointerup = releaseStick; $('joystick').onpointercancel = releaseStick; $('joystick').onlostpointercapture = releaseStick;
setInterval(() => {
  if (!connected || state?.status !== 'running') return;
  const blocked=$('story-dialogue').open;
  if(blocked)resetInput();
  const keyMovement=movementControls.next();
  const sx=Math.sign(keyMovement.x)+stick.x,sz=Math.sign(keyMovement.z)+stick.z;
  const facing = view.direction();
  const forward = menuOpen ? 0 : -sz, right = menuOpen ? 0 : sx;
  const x = facing.x * forward - facing.z * right, z = facing.z * forward + facing.x * right;
  const length = Math.max(1, Math.hypot(x, z));
  const input = { type: 'input', sequence: sequence++, x: x / length, z: z / length, aimX: facing.x, aimZ: facing.z,pitch:facing.pitch,thirdPerson:facing.thirdPerson,cancelActions:menuOpen||audioDialog.open||$('story-dialogue').open||document.hidden };
  for (const [key, action] of Object.entries(actionKeys)) input[action] = !menuOpen && (keys.has(key) || held.has(action)||taps.has(action));
  taps.clear();if(send(input)){prediction.push(input);view.setPredictedPosition(prediction.pose);}
}, 1000/INPUT_HZ);
connect();
