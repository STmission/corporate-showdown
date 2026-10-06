// Generated from prototype/public/conversation-focus.mjs; run sync:cocos.
// Local presentation state; this never grants dialogue, rewards or an NPC lease.
export class ConversationFocus {
  constructor(){this.end();}
  begin(roomId,npcId,now){this.roomId=roomId;this.npcId=npcId;this.startedAt=now;this.confirmed=false;}
  end(){this.roomId=null;this.npcId=null;this.startedAt=0;this.confirmed=false;}
  observe(state,playerId,now){
    if(!this.npcId)return null;
    const me=state?.players.find(p=>p.id===playerId),npc=state?.npcs?.find(n=>n.id===this.npcId);
    if(state?.id!==this.roomId||state.status!=='running'||me?.state!=='active'||me.connected===false||!npc)return 'unavailable';
    if(npc.conversing){this.confirmed=true;return null;}
    if(this.confirmed)return 'released';
    return now-this.startedAt>=5000?'timeout':null;
  }
}

export function conversationFacing(player,npc,{ground=0,targetGround=0,targetHeight=1.52,fallbackYaw=0}={}){
  const dx=npc.x-player.x,dz=npc.z-player.z,distance=Math.hypot(dx,dz);
  if(!Number.isFinite(distance)||distance<.05)return {yaw:Number.isFinite(fallbackYaw)?fallbackYaw:0,pitch:0};
  return {yaw:Math.atan2(-dx,-dz),pitch:Math.max(-.6,Math.min(.6,Math.atan2(targetGround+targetHeight-(ground+1.68),distance)))};
}
