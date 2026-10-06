import { LoopRepeat,LoopOnce } from 'three';
import { ANIMATION_NAMES,WEAPON_ANIMATION_NAMES } from '../shared/animation.mjs';
const looping=new Set(['Idle','Walk','Run','Rescue','Talk',...WEAPON_ANIMATION_NAMES.filter(n=>!n.endsWith('Shot'))]);
export class CharacterAnimation {
 constructor(mixer,clips,slot){
  this.mixer=mixer;this.actions=new Map();this.current=null;this.marker=null;this.retiring=[];
  for(const name of ANIMATION_NAMES){const clip=clips.find(c=>c.name===`${slot}_${name}`);if(!clip)throw new Error(`人物动作缺失：${slot}/${name}`);const action=mixer.clipAction(clip);action.setLoop(looping.has(name)?LoopRepeat:LoopOnce,looping.has(name)?Infinity:1);action.clampWhenFinished=true;this.actions.set(name,action);}
  const talk=clips.find(c=>c.name===`${slot}_Talk`);if(talk){const action=mixer.clipAction(talk);action.setLoop(LoopRepeat,Infinity);this.actions.set('Talk',action);}
  for(const name of WEAPON_ANIMATION_NAMES){const clip=clips.find(c=>c.name===`${slot}_${name}`);if(clip){const action=mixer.clipAction(clip);action.setLoop(looping.has(name)?LoopRepeat:LoopOnce,looping.has(name)?Infinity:1);action.clampWhenFinished=true;this.actions.set(name,action);}}
  this.play('Idle');
 }
 play(name,marker=null,speed=0){
  const action=this.actions.get(name);if(this.current!==name||marker!==this.marker){
   const previous=this.actions.get(this.current);action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();if(previous){action.crossFadeFrom(previous,.1,false);this.retiring.push({action:previous,time:.1});}this.current=name;this.marker=marker;
  }
  if(name.endsWith('Walk')||name.endsWith('Run'))action.setEffectiveTimeScale(Math.max(.5,Math.min(2,speed/(name.endsWith('Walk')?1.8:4.6))));
  if(name==='Hit')action.setEffectiveTimeScale(action.getClip().duration/.2);
  if(name==='Attack'||name.endsWith('Shot'))action.setEffectiveTimeScale(action.getClip().duration/.22);
 }
 update(dt){this.mixer.update(dt);for(const r of this.retiring)r.time-=dt;for(const r of this.retiring)if(r.time<=0&&r.action!==this.actions.get(this.current))r.action.stop();this.retiring=this.retiring.filter(r=>r.time>0);}
}
