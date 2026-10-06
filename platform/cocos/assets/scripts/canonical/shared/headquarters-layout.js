// Generated from prototype/shared/headquarters-layout.mjs; run sync:cocos.
import { FLOOR, BENCHES, ROOMS, STATIONS, CENTRAL_LOUNGE, EVENT_SPACE } from './office-design.js';
export const LAYOUT_REVISION='headquarters-v0.8';
// One world-space wall definition feeds modeling, collision and the Blender correction export.
export const WALLS=[];
function wall(id,x,z,w,d,material='glass',h=3.45){WALLS.push({id,x,z,w,d,h,material});}
for(let x=-30;x<=30;x+=6)for(const z of [-20,20])wall(`facade-${x}-${z}`,x,z,6,.07);
for(let z=-18;z<=18;z+=6)for(const x of [-32,32])wall(`facade-${x}-${z}`,x,z,.07,6);
for(const r of ROOMS){
 const front=r.z-r.d/2,back=r.z+r.d/2;
 if(r.private){
  const sign=r.doorSide==='right'?1:-1,doorX=r.x+sign*r.w/2;
  wall(`${r.id}-outer`,r.x-sign*r.w/2,r.z,.12,r.d,'white');
  wall(`${r.id}-front`,r.x,front,r.w,.12,'white');wall(`${r.id}-back`,r.x,back,r.w,.12,'white');
  for(const [i,[a,b]]of [[front,r.doorZ-.65],[r.doorZ+.65,back]].entries())if(b>a)wall(`${r.id}-entry-${i}`,doorX,(a+b)/2,.12,b-a,'white');
 }else{
  for(const side of [-1,1])wall(`${r.id}-side-${side}`,r.x+side*r.w/2,r.z,.07,r.d);
  if(!['chat','talk','phone'].includes(r.id))for(const side of [-1,1])wall(`${r.id}-front-${side}`,r.x+side*(r.w+1.5)/4,front,(r.w-1.5)/2,.07);
  if(r.backDoorX!==undefined){
   const left=r.x-r.w/2,right=r.x+r.w/2;
   const openings=[...ROOMS.filter(v=>['chat','talk','phone'].includes(v.id)).map(v=>({x:v.frontDoorX??v.x,w:v.frontDoorWidth??1.5})),{x:r.backDoorX,w:r.backDoorWidth}].sort((a,b)=>a.x-b.x);
   let cursor=left,index=0;
   for(const o of openings){const a=o.x-o.w/2,b=o.x+o.w/2;if(a>cursor)wall(`${r.id}-south-${index++}`,(cursor+a)/2,back,a-cursor,.07);cursor=b;}
   if(cursor<right)wall(`${r.id}-south-${index}`,(cursor+right)/2,back,right-cursor,.07);
  }
 }
}
wall('elevator-core',0,2,7,.25,'wood',3.6);
for(const side of [-1,1]){
 for(const z of [10.2,13.8])wall(`toilet-partition-${side}-${z}`,side*3.85,z-1.3,2.2,.08,'white',2.5);
 wall(`privacy-screen-${side}`,side*2.5,8.65,.1,2.5,'white',2.6);
 wall(`shower-divider-${side}`,side*3.7,18,1.8,.06,'glass',2.4);
}
for(const x of [-5,5])for(const [z,d]of [[-11,18],[3,2]])wall(`lobby-${x}-${z}`,x,z,.08,d);
const furniture=[];
function solid(id,x,z,w,d){furniture.push({id,x,z,w,d});}
BENCHES.forEach((b,i)=>solid(`bench-${i}`,b.x,b.z,5.4,1.6));
ROOMS.filter(r=>r.id.startsWith('office')).forEach(r=>solid(`${r.id}-desk`,r.x,r.z+1,2,1));
CENTRAL_LOUNGE.furniture.forEach((f,i)=>solid(`central-${i}`,f.x,f.z,f.w,f.d));
for(const side of [-1,1])solid(`bookshelf-${side}`,side*3.6,-18.9,2,.45);
for(const x of [8.9,23.1])solid(`stage-speaker-${x}`,x,-14.7,.7,.7);
EVENT_SPACE.seats.forEach(s=>solid(s.id,s.x,s.z,.68,.68));
solid('gift-table',10.5,0,4,1.1);solid('av-desk',24.5,-11,1.8,.8);solid('meeting-table',27,14,7,2.3);
// Major furniture has simple, documented footprints; leaves and small tabletop props do not block.
solid('pantry-counter',25,.8,7.1,1.18);solid('pantry-island',27,-3.2,5.2,1.4);
solid('pantry-fridge',30.6,.85,1.8,1.15);solid('pantry-cart',30.5,-3,1.2,.55);solid('pantry-bin',23.5,.8,.5,.5);
for(const z of [-14,-10,-6]){solid(`cafe-table-${z}`,29,z,1.5,1.5);for(const x of [27.8,30.2])solid(`cafe-chair-${x}-${z}`,x,z,.75,.65);}
STATIONS.forEach(s=>solid(`chair-${s.id}`,s.x,s.z,.65,.75));
for(const x of [24.2,26,27.8,29.6])for(const side of [-1,1])solid(`meeting-chair-${x}-${side}`,x,14+side*1.95,.65,.75);
solid('west-sofa-a',-23,10,3,.95);solid('west-sofa-b',-18,8.2,2.5,.95);
solid('west-table-a',-21,9,1.8,1.8);solid('west-table-b',-19.4,9.6,1,1);
for(const x of [-24,-17])solid(`west-ottoman-${x}`,x,8.6,1.3,1.3);
for(const r of ROOMS.filter(r=>['chat','talk'].includes(r.id))){for(const side of [-1,1])solid(`${r.id}-sofa-${side}`,r.x+side*1.5,r.z,.95,2.2);solid(`${r.id}-table`,r.x,r.z,1.3,1.3);}
for(const z of [3.5,6.5]){solid(`phone-table-${z}`,21.5,z,.96,.96);solid(`phone-chair-${z}`,21.5,z+.9,.65,.75);}
for(const z of [11,15])solid(`rest-recliner-${z}`,7.5,z,.8,1.8);
solid('rest-hammock',11.3,15.5,3.1,1.6);
for(const side of [-1,1]){
 solid(`corridor-sink-${side}`,side*1.22,12.2,.54,3.2);
 for(const z of [10.2,13.8])solid(`toilet-${side}-${z}`,side*3.42,z,.85,.65);
}
export const FURNITURE_SOLIDS=furniture;
export const HEADQUARTERS_SOLIDS=[...WALLS,...FURNITURE_SOLIDS];
// Broad phase for the immutable layout: expanded footprints cover supported player/AI radii.
const collisionBuckets=new Map(),bucketSize=4;
for(const o of HEADQUARTERS_SOLIDS){
 for(let ix=Math.floor((o.x-o.w/2-1)/bucketSize);ix<=Math.floor((o.x+o.w/2+1)/bucketSize);ix++){
  for(let iz=Math.floor((o.z-o.d/2-1)/bucketSize);iz<=Math.floor((o.z+o.d/2+1)/bucketSize);iz++){
   const key=`${ix},${iz}`;if(!collisionBuckets.has(key))collisionBuckets.set(key,[]);collisionBuckets.get(key).push(o);
  }
 }
}
// Safe interior destinations for the studio's room selector, also covered by route tests.
export const ROOM_ENTRIES=Object.fromEntries(ROOMS.map(r=>{
 let p={x:r.x,z:r.z-r.d/2+1,yaw:Math.PI};
 if(r.id==='pantry')p={...EVENT_SPACE.entry};
 if(r.id==='phone')p={x:20.5,z:6,yaw:0};
 if(['female','male'].includes(r.id))p={x:Math.sign(r.x)*2.5,z:10.5,yaw:Math.PI};
 if(r.id.includes('shower'))p={x:Math.sign(r.x)*3.7,z:17.1,yaw:Math.PI};
 return [r.id,p];
}));
export function floorHeight(x,z){
 const s=EVENT_SPACE.stage;if(Math.abs(x-s.x)<=s.w/2&&Math.abs(z-s.z)<=s.d/2)return .36;
 if(Math.abs(x-16)<=3&&z>=-13.6&&z<=-13.2)return .24;
 if(Math.abs(x-16)<=3&&z>-13.2&&z<=-12.8)return .12;
 if(Math.abs(Math.abs(x)-3.7)<=.75&&[17.1,18.9].some(v=>Math.abs(z-v)<=.7))return .12;
 return 0;
}
export function validFloorPosition(x,z,radius=.36){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||Math.abs(x)>FLOOR.width/2-radius||Math.abs(z)>FLOOR.depth/2-radius)return false;
 const candidates=radius<=1?(collisionBuckets.get(`${Math.floor(x/bucketSize)},${Math.floor(z/bucketSize)}`)??[]):HEADQUARTERS_SOLIDS;
 return !candidates.some(o=>Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius);
}
