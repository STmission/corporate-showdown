// GitHub Pages single-player sandbox. Never grants online rewards or paid rights.
import {CommandLedger} from './command-ledger.mjs';
import {deliverySnapshot,acknowledgeEvents} from './event-delivery.mjs';
import {PROTOCOL_VERSION,RULES_VERSION,SIMULATION_HZ,SNAPSHOT_HZ,compatible} from './shared/protocol.mjs';
import {LEVEL} from './shared/level.mjs';
import {createRoom,addPlayer,setReady,setAppearance,startRoom,focusNpc,talkToNpc,acceptInput,stepRoom} from './simulation.mjs';

export class LocalTrial {
  constructor(send){this.send=value=>send({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,...value});this.room=null;this.session=null;this.negotiated=false;}
  receive(data){
    try {
      if(!compatible(data)){const e=Error('试玩版本不一致，请刷新页面');e.code='VERSION_MISMATCH';throw e;}
      if(data.type==='hello'){this.negotiated=true;this.send({type:'hello',assetVersion:LEVEL.revision,characterVersion:LEVEL.characterRevision,simulationHz:SIMULATION_HZ,snapshotHz:SNAPSHOT_HZ});return;}
      if(!this.negotiated)throw Error('请先完成版本握手');
      if(data.type==='create'){
        if(this.room)throw Error('请先退出当前行动');
        if(data.mode!=='single')throw Error('网页试玩仅提供单人模式');
        const room=createRoom('LOCAL','single');const player=addPlayer(room,'local-player',data.name,data.role,data.gender,data.job);
        this.room=room;this.session={playerId:player.id,token:'local-trial',commands:new CommandLedger(),eventAck:0,eventSent:0};this.joined();return;
      }
      if(data.type==='join')throw Error('网页试玩仅提供单人模式');
      if(data.type==='leave'){this.room=null;this.session=null;this.send({type:'left'});return;}
      if(data.type==='resume'&&(!this.room||!this.session))throw Error('重连保留期已结束，请重新开局');
      if(!this.room||!this.session)throw Error('请先开始单人行动');
      if(data.type==='resume'){if(data.token!==this.session.token)throw Error('本次试玩已结束，请重新开局');this.joined();return;}
      const room=this.room,session=this.session,p=room.players[0];acknowledgeEvents(session,data.eventAck);
      if(['ready','appearance','start','dialogue','conversation'].includes(data.type)){
        this.send(session.commands.execute(data,()=>{
          if(data.type==='ready')setReady(room,p,data.ready===true,data.assetRevision,data.assetVersion,data.characterVersion);
          else if(data.type==='appearance')setAppearance(room,p,data.gender,data.job);
          else if(data.type==='conversation')focusNpc(room,p,data.npcId,data.active===true);
          else if(data.type==='dialogue')talkToNpc(room,p,data.npcId,data.topicId);
          else if(!startRoom(room))throw Error('请等待资源准备完成');
        }));this.broadcast();
      }else if(data.type==='input'&&room.status==='running')acceptInput(p,data,room.elapsed);
    }catch(e){this.send({type:'error',code:e.code??'REQUEST_REJECTED',message:e.message});}
  }
  joined(){this.send({type:'joined',token:this.session.token,playerId:this.session.playerId,code:this.room.id,commandSequence:this.session.commands.lastSequence,state:deliverySnapshot(this.room,this.session)});}
  step(){if(this.room)stepRoom(this.room,1/SIMULATION_HZ);}
  broadcast(){if(this.room)this.send({type:'state',state:deliverySnapshot(this.room,this.session)});}
}
