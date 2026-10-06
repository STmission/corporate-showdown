import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ROOMS } from '../shared/office-design.mjs';
import { WALLS, HEADQUARTERS_SOLIDS, ROOM_ENTRIES, validFloorPosition, floorHeight, LAYOUT_REVISION } from '../shared/headquarters-layout.mjs';
import { LEVEL } from '../shared/level.mjs';

function flood(){
 const cell=.25,w=257,h=161,pt=i=>({x:i%w*cell-32,z:Math.floor(i/w)*cell-20}),id=(x,z)=>Math.round((z+20)/cell)*w+Math.round((x+32)/cell);
 const start=id(LEVEL.spawn.x,LEVEL.spawn.z),seen=new Set([start]),queue=[start];
 for(let n=0;n<queue.length;n++){
  const i=queue[n],cx=i%w,cz=Math.floor(i/w);
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=cx+dx,z=cz+dz,j=z*w+x;if(x<0||x>=w||z<0||z>=h||seen.has(j))continue;
   const p=pt(j);if(validFloorPosition(p.x,p.z)){seen.add(j);queue.push(j);}
  }
 }
 return p=>validFloorPosition(p.x,p.z)&&seen.has(id(p.x,p.z));
}
test('all functional rooms and stage have a floor route from the player spawn',()=>{
 const reachable=flood();
 for(const r of ROOMS){
  const target=r.id.includes('shower')?{x:Math.sign(r.x)*3.7,z:17.1}:r.private?{x:Math.sign(r.x)*3.25,z:7}:{x:r.x,z:r.z-r.d/2+1};
  // Pantry primary doorway is the southern entrance beside the fridge.
  if(r.id==='pantry'){target.x=29;target.z=-1.4;}
  if(r.id==='phone'){target.x=20.5;target.z=6;}
  if(['female','male'].includes(r.id)){target.x=Math.sign(r.x)*2.5;target.z=10.5;}
  assert.ok(reachable(target),`${r.id}: ${JSON.stringify(target)}`);
 }
 for(const side of [-1,1])for(const z of [13.8,18.9])assert.ok(reachable({x:side*2.5,z}),`deep sanitary fixture ${side},${z}`);
 assert.ok(reachable({x:16,z:-15.3}));assert.ok(reachable(LEVEL.exit));
 for(const [id,p]of Object.entries(ROOM_ENTRIES))assert.ok(reachable(p),`studio room entry ${id}`);
});
test('pantry separation leaves its southern door and the cabinet/fridge passage clear',()=>{
 assert.equal(validFloorPosition(26,2),false);assert.equal(validFloorPosition(29,2),true);
 for(let z=2;z>=-1.5;z-=.25)assert.ok(validFloorPosition(29,z),`entry z=${z}`);
 assert.equal(validFloorPosition(25,.8),false);assert.equal(validFloorPosition(30.6,.85),false);
 assert.equal(validFloorPosition(-25,-16.65),false); // Station chair footprint.
 for(const x of [-2.1,2.1])assert.ok(validFloorPosition(x,18));
 assert.equal(floorHeight(3.7,17.1),.12);
});
test('Blender collision export is identical to the live shared layout',async()=>{
 const data=JSON.parse(await readFile('assets/models/headquarters-collision.json','utf8'));
 assert.equal(data.revision,LAYOUT_REVISION);assert.deepEqual(data.walls,WALLS);assert.deepEqual(data.solids,HEADQUARTERS_SOLIDS);
});
test('collision broad phase matches exhaustive rectangles at bucket edges and different radii',()=>{
 for(const radius of [.05,.36,.4,1,1.25])for(let x=-32;x<=32;x+=.5)for(let z=-20;z<=20;z+=.5){
  const linear=Math.abs(x)<=32-radius&&Math.abs(z)<=20-radius&&!HEADQUARTERS_SOLIDS.some(o=>Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius);
  assert.equal(validFloorPosition(x,z,radius),linear,`${x},${z},${radius}`);
 }
 assert.equal(validFloorPosition(0,0,-1),false);assert.equal(validFloorPosition(0,0,NaN),false);
});
