import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';
import {data} from './gltf-skin-floor.mjs';
import {weaponGrip} from '../shared/weapon-grip.mjs';

const bytes=await fs.readFile('assets/animations/weapon-poses-v1/workplace-weapon-poses.glb');
const length=bytes.readUInt32LE(12),g={doc:JSON.parse(bytes.subarray(20,20+length)),bin:bytes.subarray(28+length)};
assert.deepEqual(g.doc.animations.map(a=>a.name).sort(),['Weapon_PistolHold','Weapon_PistolShot','Weapon_RifleHold','Weapon_RifleShot']);
const records=[];
for(const clip of g.doc.animations){
 const family=clip.name.includes('Pistol')?'pistol':'rifle',grip=weaponGrip(family);
 const locals=g.doc.nodes.map(n=>({translation:n.translation??[0,0,0],rotation:n.rotation??[0,0,0,1],scale:n.scale??[1,1,1]}));
 for(const ch of clip.channels){const s=clip.samplers[ch.sampler];locals[ch.target.node][ch.target.path]=data(g,s.output)[0];}
 const parents=new Map();g.doc.nodes.forEach((n,i)=>(n.children??[]).forEach(j=>parents.set(j,i)));
 const world=i=>{const t=locals[i],m=new Matrix4().compose(new Vector3(...t.translation),new Quaternion(...t.rotation),new Vector3(...t.scale));return parents.has(i)?m.premultiply(world(parents.get(i))):m;};
 const hand=world(g.doc.nodes.findIndex(n=>n.name==='hand_r'));
 const gun=hand.clone().multiply(new Matrix4().compose(new Vector3(...grip.position),new Quaternion().setFromAxisAngle(new Vector3(0,0,1),grip.rotation[2]),new Vector3(1,1,1)));
 const forward=new Vector3(1,0,0).transformDirection(gun),up=new Vector3(0,1,0).transformDirection(gun);
 assert.ok(forward.dot(new Vector3(0,0,1))>.999,clip.name+' barrel direction');
 assert.ok(up.dot(new Vector3(0,1,0))>.999,clip.name+' weapon upright');
 records.push({clip:clip.name,forward:forward.toArray(),up:up.toArray()});
}
await fs.writeFile('artifacts/weapon-pose-exported-axes.json',JSON.stringify({scope:'Actual exported GLB initial pose, shared weapon grip, model-forward +Z and up +Y; not gameplay aim/animated muzzle verification',records},null,2)+'\n');
console.log('Four exported clips preserve forward barrel and upright weapon axes.');
