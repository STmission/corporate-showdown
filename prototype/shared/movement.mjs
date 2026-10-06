import { validFloorPosition } from './headquarters-layout.mjs';
export function moveFloor(entity,dx,dz){
 if(validFloorPosition(entity.x+dx,entity.z))entity.x+=dx;
 if(validFloorPosition(entity.x,entity.z+dz))entity.z+=dz;
}
export function movementSpeed(p,elapsed){return (elapsed<p.speedUntil?6:4.6)*(elapsed<p.dodgeUntil?2.5:1);}
// Presentation prediction only: actions and state transitions remain authoritative.
export function predictMovement(p,input,dt,elapsed){
 if(p.state!=='active'||!p.connected)return;
 const speed=movementSpeed(p,elapsed);
 moveFloor(p,(input.x||0)*speed*dt,(input.z||0)*speed*dt);
}
