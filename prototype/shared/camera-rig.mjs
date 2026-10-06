// Presentation camera: world collision changes the view, never the player's hitbox.
/** @param {{x:number,z:number,ground?:number,yaw?:number,pitch?:number,thirdPerson?:boolean,down?:boolean,walls?:Array<{x:number,z:number,w:number,d:number,h?:number}>}} options */
export function cameraPose({x,z,ground=0,yaw=0,pitch=0,thirdPerson=true,down=false,walls=[]}){
 const y=ground+(down?.7:1.68),target={x,y,z};if(!thirdPerson)return {...target,distance:0};
 const angle=Number.isFinite(yaw)?yaw:0,tilt=Math.max(-1.15,Math.min(1.15,Number.isFinite(pitch)?pitch:0));
 const back=3.1*Math.cos(tilt),dx=Math.sin(angle)*back+Math.cos(angle)*.38,dz=Math.cos(angle)*back-Math.sin(angle)*.38;
 const dy=Math.max(ground+.25,y-3.1*Math.sin(tilt)+.25)-y;
 let limit=1;
 for(const wall of walls){
  const bounds=[[x,dx,wall.x-wall.w/2-.15,wall.x+wall.w/2+.15],[z,dz,wall.z-wall.d/2-.15,wall.z+wall.d/2+.15],[y,dy,-.15,(wall.h??3.45)+.15]];
  let enter=0,exit=1;
  for(const [start,delta,min,max]of bounds){if(Math.abs(delta)<1e-9){if(start<min||start>max){exit=-1;break;}continue;}const a=(min-start)/delta,b=(max-start)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
  if(enter<=exit&&exit>=0&&enter<=1)limit=Math.min(limit,Math.max(0,enter-.03));
 }
 return {x:x+dx*limit,y:y+dy*limit,z:z+dz*limit,distance:Math.hypot(dx,dy,dz)*limit};
}

// Keep the chosen perspective; hide only the local avatar when the wall pushes
// the lens inside its silhouette. Hysteresis avoids blinking at a wall edge.
export function cameraAvatarVisible(distance,wasVisible=true){
 if(!Number.isFinite(distance)||distance<=.9)return false;
 if(distance>=1.2)return true;
 return Boolean(wasVisible);
}
