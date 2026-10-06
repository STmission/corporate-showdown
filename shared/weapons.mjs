// Original game parameters, not CSGO weapon statistics or imported game assets.
import {cameraPose} from './camera-rig.mjs';
import {WALLS,FURNITURE_SOLIDS,floorHeight} from './headquarters-layout.mjs';
export const WEAPON_REVISION='weapons-v0.1';
export const WEAPONS=Object.freeze(Object.fromEntries([
 ['pistol','海风手枪','pistol',24,12,48,.28,1.4,32,.009,false],
 ['smg','疾风冲锋枪','smg',13,30,120,.095,1.8,30,.028,true],
 ['rifle','破局步枪','rifle',26,30,90,.14,2.1,48,.012,true],
 ['sniper','远望狙击枪','sniper',90,5,20,1.1,2.7,64,.003,false],
 ['shotgun','回声霰弹枪','shotgun',12,6,24,.85,2.4,22,.075,false],
 ['lmg','风暴机关枪','lmg',18,60,180,.105,3.2,45,.035,true],
 ['hammer','解压锤','hammer',38,0,0,.65,0,2.2,0,false],
 ['scissors','办公剪刀','scissors',20,0,0,.3,0,1.65,0,false],
].map(([id,name,family,damage,magazine,reserve,cooldown,reload,range,spread,automatic])=>[id,Object.freeze({id,name,family,damage,magazine,reserve,cooldown,reload,range,spread,automatic,pellets:id==='shotgun'?6:1,melee:!magazine,durability:id==='hammer'?18:id==='scissors'?24:0})])));
export const WEAPON_PICKUPS=Object.freeze(Object.keys(WEAPONS).map((kind,i)=>Object.freeze({kind,x:[-18,-16.8,-15.6,-14.4,-13.2,-12,-22,-23.2][i],z:i===0?4.6:7})));
export function weaponLabel(p,elapsed=0){const def=WEAPONS[p.weapon];if(!def)return null;const owned=p.inventory?.find(w=>w.kind===p.weapon);return def.name+(def.melee?` · 剩余 ${owned?.durability??0} 次`:p.reloadUntil>elapsed?` · 装填中 ${Math.max(0,p.reloadUntil-elapsed).toFixed(1)}秒`:` · 弹药 ${owned?.ammo??0}/${owned?.reserve??0}`);}
export function rayBox(origin,direction,box,maxDistance){
 let near=0,far=maxDistance;
 for(const axis of ['x','y','z']){const delta=direction[axis],start=origin[axis],min=box.min[axis],max=box.max[axis];if(Math.abs(delta)<1e-9){if(start<min||start>max)return null;continue;}const a=(min-start)/delta,b=(max-start)/delta;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;}
 return near<=maxDistance&&far>=0?near:null;
}
function solidHeight(s){return s.h??(s.id.includes('fridge')?2.05:s.id.includes('bookshelf')?2:s.id.includes('speaker')?1.55:s.id.includes('sink')?.9:s.id.includes('hammock')?.7:s.id.includes('chair')?1.15:.85);}
export function traceRay(origin,direction,range,targets=[],solids=[...WALLS,...FURNITURE_SOLIDS]){
 let distance=range,entity=null,blocked=false;
 for(const s of solids){const floor=floorHeight(s.x,s.z),t=rayBox(origin,direction,{min:{x:s.x-s.w/2,y:floor,z:s.z-s.d/2},max:{x:s.x+s.w/2,y:floor+solidHeight(s),z:s.z+s.d/2}},distance);if(t!==null&&t<=distance){distance=t;entity=null;blocked=true;}}
 for(const e of targets){if(e.hp<=0)continue;const ground=floorHeight(e.x,e.z),t=rayBox(origin,direction,{min:{x:e.x-.3,y:ground+.05,z:e.z-.3},max:{x:e.x+.3,y:ground+1.75,z:e.z+.3}},distance);if(t!==null&&t<distance){distance=t;entity=e;blocked=false;}}
 return {entity,blocked,distance,to:{x:origin.x+direction.x*distance,y:origin.y+direction.y*distance,z:origin.z+direction.z*distance}};
}
// Aim at the camera's center, then trace from the player's eye so the camera cannot shoot around walls.
export function weaponRays(p,def,targets,seed=0){
 const yaw=Math.atan2(-p.fx,-p.fz),pitch=p.input?.pitch??0,ground=floorHeight(p.x,p.z);
 const camera=cameraPose({x:p.x,z:p.z,ground,yaw,pitch,thirdPerson:p.input?.thirdPerson===true,walls:WALLS});
 const forward={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
 const center=traceRay(camera,forward,def.range+camera.distance,targets),from={x:p.x,y:ground+1.55,z:p.z};
 const dx=center.to.x-from.x,dy=center.to.y-from.y,dz=center.to.z-from.z;
 const targetYaw=Math.atan2(-dx,-dz),targetPitch=Math.atan2(dy,Math.hypot(dx,dz));
 let random=(seed>>>0)||1;const next=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296-.5;};
 return Array.from({length:def.pellets},()=>{const y=targetYaw+next()*def.spread*2,t=targetPitch+next()*def.spread*2,direction={x:-Math.sin(y)*Math.cos(t),y:Math.sin(t),z:-Math.cos(y)*Math.cos(t)};return {from,...traceRay(from,direction,def.range,targets)};});
}
