import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PerspectiveCamera,Group,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FirstPersonArms} from '../public/first-person-arms.mjs';

// Keep the real mesh, weights, hierarchy and clips. Images require a browser;
// this runtime test does not verify material appearance.
async function loadSkin(path){
 const b=await readFile(path),length=b.readUInt32LE(12),doc=JSON.parse(b.toString('utf8',20,20+length));
 for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 delete doc.images;delete doc.textures;delete doc.materials;
 const json=Buffer.from(JSON.stringify(doc)),pad=(4-json.length%4)%4;
 const body=Buffer.concat([json,Buffer.alloc(pad,32)]),bin=b.subarray(20+length);
 const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(20+body.length+bin.length,8);head.writeUInt32LE(body.length,12);head.writeUInt32LE(0x4e4f534a,16);
 const bytes=Buffer.concat([head,body,bin]);return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}

test('actual ten arm skins fit the camera wrist independently of gender, clone bones and release bone textures on replacement/exit',async()=>{
 const manifest=JSON.parse(await readFile('assets/characters/first-person-v1/manifest.json'));
 const templates=new Map();for(const c of manifest.characters)templates.set(c.slot,await loadSkin(c.glb));
 const camera=new PerspectiveCamera(76,16/9,.05,900);camera.position.set(17,1.6,-8);camera.rotation.set(.2,1.3,0,'YXZ');
 const disposed=[],arms=new FirstPersonArms(camera,templates,()=>new Group(),o=>disposed.push(o));
 for(const c of manifest.characters){
  const source=templates.get(c.slot).scene.getObjectByName('hand_r'),position=source.position.clone();
  arms.sync({state:'active',weapon:'pistol',attackUntil:0},c.slot,1,.016,true);
  const a=arms.actor;camera.updateMatrixWorld(true);
  const wrist=camera.worldToLocal(a.hand.getWorldPosition(new Vector3()));
  assert.ok(wrist.distanceTo(new Vector3(.13,-.28,-.50))<1e-5,c.slot);
  assert.notEqual(a.hand,source);assert.deepEqual(source.position,position);
  assert.equal(a.weapon.parent,a.hand);assert.equal(a.animation.current,'PistolHold');
  camera.updateMatrixWorld(true);
  const forward=new Vector3(1,0,0).transformDirection(a.weapon.matrixWorld),up=new Vector3(0,1,0).transformDirection(a.weapon.matrixWorld);
  assert.ok(forward.dot(camera.getWorldDirection(new Vector3()))>.999);
  assert.ok(up.dot(new Vector3(0,1,0).applyQuaternion(camera.quaternion))>.999);
  for(let i=0;i<30;i++)arms.sync({id:'local',x:i*.03,z:0,state:'active',weapon:'pistol',attackUntil:0},c.slot,1,.016,true);
  assert.equal(a.animation.current,'PistolWalk');
  for(let i=0;i<30;i++)arms.sync({id:'local',x:.87+i*.074,z:0,state:'active',weapon:'rifle',attackUntil:0},c.slot,1,.016,true);
  assert.equal(a.animation.current,'RifleRun');
  arms.sync({state:'active',weapon:'pistol',attackUntil:0},c.slot,1,.016,true);
  const originalWeapon=a.weapon;
  arms.sync({state:'active',weapon:'rifle',attackUntil:2},c.slot,1,.016,true);
  assert.equal(a.animation.current,'RifleShot');assert.equal(a.weapon.parent,a.hand);
  assert.equal(originalWeapon.parent,null);assert.ok(disposed.includes(originalWeapon));
  arms.sync({state:'active',weapon:'rifle',attackUntil:0},c.slot,3,.016,false);
  assert.equal(a.group.visible,false);
  const skeletons=new Set();a.model.traverse(n=>{if(n.isSkinnedMesh)skeletons.add(n.skeleton);});
  let texturesDisposed=0;for(const s of skeletons){s.computeBoneTexture();s.boneTexture.addEventListener('dispose',()=>texturesDisposed++);}
  arms.clear();assert.equal(texturesDisposed,skeletons.size);assert.equal(camera.children.length,0);assert.equal(arms.diagnostics(),null);
  arms.clear();
 }
 assert.equal(arms.sync({weapon:'pistol'},'missing',0,.016,true),false);assert.equal(camera.children.length,0);
});
