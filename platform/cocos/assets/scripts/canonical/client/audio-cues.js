// Generated from prototype/client/audio-cues.mjs; run sync:cocos.
// Presentation only: snapshots and reliable events remain server-authoritative.
export class AudioCues {
 constructor(){this.reset();}
 reset(){this.room='';this.active=false;this.thresholds=new Set();this.casts=new Map();this.events=new Set();this.hp=null;this.pose=null;this.stepAt=0;this.bpm=0;}
 update(state,player,now){
  const cues=[];
  if(!state||state.status!=='running'||!player){if(this.active)cues.push({stop:true});this.reset();return cues;}
  if(this.room!==state.id){this.reset();this.room=state.id;this.active=true;cues.push({name:'notice',channel:'voice',text:state.story?.deadline===null?'先和许老师聊聊，查明加班名单的来历。':'马上下班。完成交接，准备撤离。'});}
  const bpm=state.story?.deadline===null?0:state.remaining<=30?184:state.remaining<=60?158:state.remaining<=120?132:108;
  if(bpm!==this.bpm){this.bpm=bpm;cues.push({name:bpm?'pulse_'+bpm:'',channel:'music',loop:true});}
  let text='';for(const [limit,label]of (state.story?.deadline===null?[]:[[120,'还有两分钟'],[60,'下班倒计时，一分钟'],[30,'还有三十秒'],[10,'十秒，马上下班！']]))if(state.remaining<=limit&&!this.thresholds.has(limit)){this.thresholds.add(limit);text=label;}
  if(text)cues.push({name:'notice',channel:'voice',text});
  if(this.hp!==null&&player.hp<this.hp)cues.push({name:'hit',channel:'effects'});this.hp=player.hp;
  if(this.pose&&player.state==='active'&&Math.hypot(player.x-this.pose.x,player.z-this.pose.z)>.08&&now-this.stepAt>.25){cues.push({name:'step',channel:'effects'});this.stepAt=now;}this.pose={x:player.x,z:player.z};
  const alive=new Set(state.enemies.map(e=>e.id));for(const id of this.casts.keys())if(!alive.has(id))this.casts.delete(id);
  for(const e of state.enemies){if(!e.cast||e.cast.end<=state.elapsed||Math.hypot(e.x-player.x,e.z-player.z)>14||this.casts.get(e.id)===e.cast.end)continue;this.casts.set(e.id,e.cast.end);cues.push({name:'danger',channel:'alerts',text:e.cast.type==='projectile'?'文件投掷预警 · 注意攻击方向':'招式预警 · 闪避或离开危险圈',priority:'danger'});}
  return cues;
 }
 event(event){if(!this.active||!Number.isSafeInteger(event.id)||this.events.has(event.id))return [];this.events.add(event.id);if(this.events.size>256)this.events.delete(this.events.values().next().value);const name={shot:'shot',reload:'reload',empty:'empty',hit:'hit',swing:'hit',skill:'skill',danger:'danger'}[event.kind];return name?[{name,channel:event.kind==='danger'?'alerts':'effects',text:event.text||undefined,priority:event.kind==='danger'?'danger':'normal'}]:[];}
}
