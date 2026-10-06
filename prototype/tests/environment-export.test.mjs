import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Matrix4, Quaternion, Vector3, Box3 } from 'three';
import { WALLS } from '../shared/headquarters-layout.mjs';

test('both native GLBs contain the declared walls; gameplay export has no character skins',async()=>{
 for(const file of ['coastal-headquarters-complete.glb','coastal-headquarters-gameplay.glb']){
  const b=await readFile(`assets/models/${file}`);assert.equal(b.readUInt32LE(8),b.length);
  const g=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12))),parents=new Map();
  g.nodes.forEach((n,i)=>n.children?.forEach(c=>parents.set(c,i)));
  const matrices=new Map();
  function matrix(i){if(matrices.has(i))return matrices.get(i);const n=g.nodes[i],m=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m;}
  const shapes=[];
  g.nodes.forEach((n,i)=>{if(!n.extras?.collision_wall_id||n.mesh===undefined)return;const box=new Box3();for(const p of g.meshes[n.mesh].primitives){const a=g.accessors[p.attributes.POSITION];box.union(new Box3(new Vector3().fromArray(a.min),new Vector3().fromArray(a.max)).applyMatrix4(matrix(i)));}shapes.push({center:box.getCenter(new Vector3()),size:box.getSize(new Vector3())});});
  for(const w of WALLS)assert.ok(shapes.some(s=>Math.max(Math.abs(s.center.x-w.x),Math.abs(s.center.y-w.h/2),Math.abs(s.center.z-w.z),Math.abs(s.size.x-w.w),Math.abs(s.size.y-w.h),Math.abs(s.size.z-w.d))<.003),`${file}: ${w.id}`);
  if(file.includes('gameplay')){assert.equal(g.skins?.length??0,0);assert.ok(g.nodes.every(n=>!n.extras?.environment_character));assert.ok(b.length<10*1024*1024);}
  else assert.equal(g.skins.length,8);
 }
});
