import { predictMovement } from '/corporate-showdown/shared/movement.mjs';
import { INPUT_HZ, SNAPSHOT_HZ } from '/corporate-showdown/shared/protocol.mjs';
import { validFloorPosition } from '/corporate-showdown/shared/headquarters-layout.mjs';
const dt=1/INPUT_HZ;
export class MovementPrediction {
 constructor(){this.reset();}
 reset(){this.pending=[];this.base=null;this.pose=null;this.tick=-1;this.ack=-1;this.correction=0;this.overflow=false;}
 rebuild(){
  this.pose=this.base?{...this.base}:null;
  if(this.pose)for(let i=0;i<this.pending.length;i++)predictMovement(this.pose,this.pending[i],dt,this.elapsed+(i+1)*dt);
 }
 reconcile(state,id,{reset=false}={}){
  if(reset)this.reset();
  if(state.tick<this.tick)return false;
  const p=state.players.find(p=>p.id===id);if(!p)return false;
  const old=this.pose;this.tick=state.tick;this.elapsed=state.elapsed;this.ack=p.appliedSequence??-1;
  this.pending=this.pending.filter(i=>i.sequence>this.ack);
  if(state.status!=='running'||p.state!=='active'||!p.connected)this.pending=[];
  this.base={...p};this.overflow=false;this.rebuild();
  this.correction=old?Math.hypot(old.x-this.pose.x,old.z-this.pose.z):0;return true;
 }
 push(input){
  if(!this.base||input.sequence<=this.ack||this.pending.at(-1)?.sequence>=input.sequence)return;
  // Bounded prediction horizon: prolonged stalls stop anticipation until a new snapshot.
  if(this.pending.length>=INPUT_HZ*.5){this.overflow=true;this.pending=[];this.rebuild();return;}
  if(this.overflow)return;
  this.pending.push({...input});this.rebuild();
 }
 suspend(){this.pending=[];this.overflow=true;this.rebuild();}
}
export class SnapshotInterpolation {
 constructor(){this.reset();}
 reset(){this.frames=[];}
 push(state,now){
  if(this.frames.at(-1)?.state.id!==state.id||this.frames.at(-1)?.state.status!==state.status)this.reset();
  if(this.frames.at(-1)?.state.tick>=state.tick)return;
  this.frames.push({state,now});if(this.frames.length>12)this.frames.shift();
 }
 entities(now){
  const last=this.frames.at(-1);if(!last)return new Map();
  const target=Math.min(last.state.elapsed,last.state.elapsed+(now-last.now)/1000-2/SNAPSHOT_HZ);
  let a=this.frames[0],b=a;
  for(const f of this.frames){if(f.state.elapsed<=target)a=f;if(f.state.elapsed>=target){b=f;break;}b=f;}
  const list=s=>[...s.players,...s.enemies,...(s.npcs??[])],before=new Map(list(a.state).map(e=>[e.id,e]));
  const t=b.state.elapsed===a.state.elapsed?1:Math.max(0,Math.min(1,(target-a.state.elapsed)/(b.state.elapsed-a.state.elapsed)));
  return new Map(list(last.state).map(e=>{
   const p=before.get(e.id),q=list(b.state).find(x=>x.id===e.id);
   if(!p||!q||p.state!==e.state||Math.hypot(q.x-p.x,q.z-p.z)>2)return [e.id,e];
   const x=p.x+(q.x-p.x)*t,z=p.z+(q.z-p.z)*t;
   return [e.id,validFloorPosition(x,z)?{...e,x,z}:e];
  }));
 }
}
