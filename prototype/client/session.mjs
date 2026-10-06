import {PROTOCOL_VERSION,RULES_VERSION,compatible} from '../shared/protocol.mjs';
import {LEVEL} from '../shared/level.mjs';
import {ReliableCommands,consumeEvents} from '../public/reliable-channel.mjs';
import {MovementPrediction,SnapshotInterpolation} from '../public/network-state.mjs';

// Presentation/session coordinator only. Core combat is never evaluated here.
export class GameSession {
 /** @param {{openSocket:()=>any,requestId:()=>string,onChange?:()=>void,onEvent?:(event:any)=>void,onMessage?:(text:string)=>void,clock?:()=>number}} options */
 constructor({openSocket,requestId,onChange=()=>{},onEvent=()=>{},onMessage=()=>{},clock=()=>performance.now()}){
  Object.assign(this,{openSocket,requestId,onChange,onEvent,onMessage,clock});
  this.commands=new ReliableCommands(data=>this.send(data),requestId);this.prediction=new MovementPrediction();this.interpolation=new SnapshotInterpolation();
  this.reset();this.connected=false;this.closed=false;this.retryAt=0;this.commandAt=0;this.connectionIssue=false;
 }
 reset(){this.playerId=null;this.token=null;this.state=null;this.sequence=0;this.eventAck=0;this.commands.reset();this.prediction.reset();this.interpolation.reset();}
 connect(){
  this.closed=false;const socket=this.openSocket();this.socket=socket;
  socket.onopen=()=>{if(this.socket===socket)this.send({type:'hello'});};
  socket.onmessage=event=>{if(this.socket!==socket)return;try{this.receive(JSON.parse(event.data));}catch(error){this.onMessage(`无效服务消息：${error.message}`);}};
  socket.onerror=()=>{};
  socket.onclose=event=>{if(this.socket!==socket)return;if(!this.closed){this.connectionIssue=true;this.onMessage(`连接已断开（${event?.code??0}），正在重试`);}this.connected=false;this.commands.suspend();this.prediction.suspend();this.retryAt=this.clock()+1500;this.onChange();};
 }
 send(data){if(this.socket?.readyState!==1)return false;this.socket.send(JSON.stringify({protocolVersion:PROTOCOL_VERSION,rulesVersion:RULES_VERSION,eventAck:this.eventAck,...data}));return true;}
 receive(data){
  if(!compatible(data)||data.code==='VERSION_MISMATCH'){this.onMessage('协议或规则版本不兼容');this.disconnect();return;}
  if(data.type==='hello'){
   if(data.assetVersion!==LEVEL.revision||data.characterVersion!==LEVEL.characterRevision){this.onMessage('场景或人物版本不兼容');this.disconnect();return;}
   this.connected=true;if(this.connectionIssue){this.connectionIssue=false;this.onMessage('');}if(this.token)this.send({type:'resume',token:this.token});this.onChange();
  }else if(data.type==='joined'){
   const resume=this.playerId===data.playerId&&this.token===data.token;this.playerId=data.playerId;this.token=data.token;
   this.commands.synchronize(data.commandSequence,{resume});this.sequence=(data.state.players.find(p=>p.id===this.playerId)?.sequence??-1)+1;
   if(!resume)this.eventAck=0;this.apply(data.state,true);
  }else if(data.type==='state')this.apply(data.state);
  else if(data.type==='commandResult'){if(this.commands.receive(data)&&!data.ok)this.onMessage(data.message);this.onChange();}
  else if(data.type==='left'){this.reset();this.onChange();}
  else if(data.type==='error'){this.onMessage(data.message);if(/重连保留期/.test(data.message)){this.reset();this.onChange();}}
 }
 apply(state,reset=false){
  if(state.assetVersion!==LEVEL.revision||state.characterVersion!==LEVEL.characterRevision){this.onMessage('房间资源版本不兼容');this.disconnect();return;}
  if(this.state?.id===state.id&&state.tick<this.state.tick)return;
  if(!this.prediction.reconcile(state,this.playerId,{reset}))return;
  this.state=state;this.interpolation.push(state,this.clock());
  this.eventAck=consumeEvents(state,this.eventAck,event=>{if(state.elapsed-event.at<2)this.onEvent(event);});
  if(this.eventAck>state.eventAck)this.send({type:'eventAck'});this.onChange();
 }
 command(data){return this.commands.enqueue(data);}
 ready(){const s=this.state;if(s?.status!=='lobby')return false;return this.command({type:'ready',ready:true,assetRevision:s.loadoutRevision,assetVersion:s.assetVersion,characterVersion:s.characterVersion});}
 input(intent){if(!this.connected||this.state?.status!=='running')return false;const data={...intent,type:'input',sequence:this.sequence++};if(!this.send(data))return false;this.prediction.push(data);return true;}
 tick(){const now=this.clock();if(!this.closed&&!this.connected&&this.socket?.readyState===3&&now>=this.retryAt)this.connect();if(now>=this.commandAt){this.commands.flush();this.commandAt=now+1000;}}
 leave(){this.send({type:'leave'});this.reset();this.onChange();}
 disconnect(){this.closed=true;this.connected=false;this.socket?.close();this.commands.suspend();this.prediction.suspend();this.onChange();}
 dispose(){this.disconnect();this.reset();}
}
