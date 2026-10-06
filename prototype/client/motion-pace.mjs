// Presentation only. Never supplies trusted movement or combat state.
export class MotionPace {
 constructor(){this.last=null;this.speed=0;}
 reset(){this.last=null;this.speed=0;}
 sample(id,pose,dt,active=true){
  if(!active||!pose||![pose.x,pose.z,dt].every(Number.isFinite)||dt<=0||dt>.25){this.reset();return 0;}
  const previous=this.last;this.last={id,x:pose.x,z:pose.z};
  if(!previous||previous.id!==id){this.speed=0;return 0;}
  const measured=Math.hypot(pose.x-previous.x,pose.z-previous.z)/dt;
  // Teleports and large reconciliation corrections are not a running pose.
  if(measured>12){this.speed=0;return 0;}
  this.speed+=(measured-this.speed)*(1-Math.exp(-dt/.08));
  if(this.speed<.05)this.speed=0;return this.speed;
 }
}
