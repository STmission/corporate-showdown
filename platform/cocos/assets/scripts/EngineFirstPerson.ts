import {Node,Prefab,instantiate,SkeletalAnimation,AnimationClip,Vec3,Quat,Mat4} from 'cc';
import {selectAnimation,WEAPON_ANIMATION_NAMES} from './canonical/shared/animation.js';
import {MotionPace} from './canonical/client/motion-pace.js';
import {weaponGrip} from './canonical/shared/weapon-grip.js';

const looping=new Set(['Idle','Walk','Run','Rescue',...WEAPON_ANIMATION_NAMES.filter(n=>!n.endsWith('Shot'))]);
type Arms={group:Node;model:Node;animation:SkeletalAnimation;slot:string;socket:Node;basis:Quat;path:string;action:string;marker:unknown};

// Independent skinned arms. Baked animations must drive a registered socket,
// rather than reading the unanimated joint Node each frame.
export class EngineFirstPerson{
 private actor:Arms|null=null;private pace=new MotionPace();
 constructor(private camera:Node,private prefabs:Map<string,Prefab>,private materials:(node:Node,slot:string)=>void){}
 clear(){this.pace.reset();const a=this.actor;if(!a)return;a.animation.stop();a.animation.sockets=a.animation.sockets.filter(s=>s.target!==a.socket);a.group.destroy();this.actor=null;}
 sync(me:any,slot:string,elapsed:number,visible:boolean,dt:number,pose:any=me){
  if(this.actor?.slot!==slot){
   this.clear();const prefab=this.prefabs.get('fp_'+slot);if(!prefab)return null;
   const group=new Node('第一人称真实前臂'),model=instantiate(prefab);this.camera.addChild(group);group.addChild(model);group.setRotationFromEuler(0,180,0);this.materials(model,'fp_'+slot);
   const animation=model.getComponent(SkeletalAnimation)??model.getComponentInChildren(SkeletalAnimation);
   if(!animation){group.destroy();throw Error('第一人称资源缺少骨骼动画');}
   const find=(n:Node):Node|null=>{if(n.name==='hand_r')return n;for(const child of n.children){const found=find(child);if(found)return found;}return null;};
   const hand=find(animation.node);if(!hand){group.destroy();throw Error('第一人称资源缺少右手');}
   const parts:string[]=[];for(let n:Node|null=hand;n&&n!==animation.node;n=n.parent)parts.unshift(n.name);
   const path=parts.join('/'),socket=animation.createSocket(path);if(!socket){group.destroy();throw Error('第一人称右手挂点创建失败');}
   animation.play(slot+'_PistolHold');const hold=animation.getState(slot+'_PistolHold');hold.wrapMode=AnimationClip.WrapMode.Loop;// Frame zero may already be cached before socket registration.
   // Reference holds are constant; sample a later frame to update the baked socket.
   hold.time=.1;hold.sample();
   const inverse=new Mat4();Mat4.invert(inverse,this.camera.worldMatrix);const wrist=new Vec3();Vec3.transformMat4(wrist,socket.worldPosition,inverse);group.setPosition(.13-wrist.x,-.28-wrist.y,-.50-wrist.z);
   const basis=new Quat();Quat.invert(basis,socket.worldRotation);Quat.multiply(basis,basis,this.camera.worldRotation);const desired=new Quat(),gripRotation=new Quat();Quat.fromEuler(desired,0,90,0);Quat.fromEuler(gripRotation,0,0,weaponGrip('pistol').rotation[2]*180/Math.PI);Quat.invert(gripRotation,gripRotation);Quat.multiply(basis,basis,desired);Quat.multiply(basis,basis,gripRotation);
   this.actor={group,model,animation,slot,socket,basis,path,action:'PistolHold',marker:null};
  }
  const a=this.actor!;a.group.active=visible;const speed=this.pace.sample(me.id??slot,pose,dt,visible);if(!visible)return null;
  let name=selectAnimation({...me,player:true},elapsed,speed,{weaponAvailable:true});if(name==='Idle')name='PistolHold';
  const marker=name==='Attack'||name.endsWith('Shot')?me.attackUntil:name==='Cast'?me.cast?.end:null;
  if(a.action!==name||a.marker!==marker){a.animation.crossFade(`${slot}_${name}`,.1);const state=a.animation.getState(`${slot}_${name}`);state.wrapMode=looping.has(name)?AnimationClip.WrapMode.Loop:AnimationClip.WrapMode.Normal;if(name==='Attack'||name.endsWith('Shot'))state.speed=state.duration/.22;a.action=name;a.marker=marker;}
  if(name.endsWith('Walk')||name.endsWith('Run'))a.animation.getState(`${slot}_${name}`).speed=Math.max(.5,Math.min(2,speed/(name.endsWith('Walk')?1.8:4.6)));
  return {socket:a.socket,basis:a.basis,path:a.path};
 }
 diagnostics(){const a=this.actor;if(!a)return null;const inverse=new Mat4(),wrist=new Vec3();Mat4.invert(inverse,this.camera.worldMatrix);Vec3.transformMat4(wrist,a.socket.worldPosition,inverse);return {slot:a.slot,visible:a.group.activeInHierarchy,action:a.action,bonePath:a.path,position:{x:a.group.position.x,y:a.group.position.y,z:a.group.position.z},cameraWrist:{x:wrist.x,y:wrist.y,z:wrist.z}};}
}
