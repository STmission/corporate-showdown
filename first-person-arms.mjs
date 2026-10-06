import {Group,AnimationMixer,Vector3,Quaternion,Euler} from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {CharacterAnimation} from './character-animation.mjs';
import {selectAnimation} from '/corporate-showdown/shared/animation.mjs';
import {weaponGrip} from '/corporate-showdown/shared/weapon-grip.mjs';
import {MotionPace} from '/corporate-showdown/client/motion-pace.mjs';
import {WEAPONS} from '/corporate-showdown/shared/weapons.mjs';

export class FirstPersonArms {
 constructor(camera,templates,createWeapon,dispose){this.camera=camera;this.templates=templates;this.createWeapon=createWeapon;this.dispose=dispose;this.actor=null;this.pace=new MotionPace();}
 clear(){this.pace.reset();const a=this.actor;if(!a)return;a.mixer.stopAllAction();a.mixer.uncacheRoot(a.model);const skeletons=new Set();a.model.traverse(n=>{if(n.isSkinnedMesh)skeletons.add(n.skeleton);});for(const skeleton of skeletons)skeleton.dispose();a.group.removeFromParent();this.dispose(a.group);this.actor=null;}
 sync(me,slot,elapsed,dt,visible,pose=me){
  if(this.actor?.slot!==slot){this.clear();const template=this.templates.get(slot);if(!template)return false;
   const group=new Group(),model=clone(template.scene);group.name='真实第一人称前臂';group.rotation.y=Math.PI;group.add(model);this.camera.add(group);
   const mixer=new AnimationMixer(model),animation=new CharacterAnimation(mixer,template.animations,slot);animation.play('PistolHold');animation.update(.1);
   const hand=model.getObjectByName('hand_r');if(!hand)throw Error('第一人称资源缺少右手骨骼');this.camera.updateMatrixWorld(true);
   const wrist=this.camera.worldToLocal(hand.getWorldPosition(new Vector3()));group.position.set(.13-wrist.x,-.28-wrist.y,-.50-wrist.z);
   // Blender re-import preserves deformation but changes the hand-local basis.
   // Calibrate once in the reference hold; subsequent shot rotation is retained.
   const gripRotation=new Quaternion().setFromEuler(new Euler(...weaponGrip('pistol').rotation));
   const basis=hand.getWorldQuaternion(new Quaternion()).invert().multiply(this.camera.getWorldQuaternion(new Quaternion())).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2)).multiply(gripRotation.invert());
   this.actor={slot,group,model,mixer,animation,hand,basis,kind:null,weapon:null};
  }
  const a=this.actor;a.group.visible=visible;const speed=this.pace.sample(me.id??slot,pose,dt,visible);
  if(!visible)return true;
  const name=selectAnimation({...me,player:true},elapsed,speed,{weaponAvailable:true});
  // No unarmed first-person pose is authored yet; neutral hold keeps forearms in frame.
  a.animation.play(name==='Idle'?'PistolHold':name,name.endsWith('Shot')||name==='Attack'?me.attackUntil:null,speed);a.animation.update(dt);
  if(a.kind!==me.weapon){if(a.weapon){a.weapon.removeFromParent();this.dispose(a.weapon);}a.kind=me.weapon;a.weapon=null;
   if(WEAPONS[me.weapon]){const weapon=this.createWeapon(me.weapon),grip=weaponGrip(WEAPONS[me.weapon].family);weapon.position.set(...grip.position).applyQuaternion(a.basis);weapon.quaternion.copy(a.basis).multiply(new Quaternion().setFromEuler(new Euler(...grip.rotation)));a.hand.add(weapon);a.weapon=weapon;}
  }
  return true;
 }
 diagnostics(){const a=this.actor;return a?{slot:a.slot,visible:a.group.visible,action:a.animation.current,bone:a.hand.name,weapon:a.kind,position:a.group.position.toArray()}:null;}
}
