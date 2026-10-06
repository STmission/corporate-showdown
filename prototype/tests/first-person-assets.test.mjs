import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {data} from '../tools/gltf-skin-floor.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('ten first-person assets contain actual arm-weighted skins and clothes without replacing full actors',async()=>{
 const manifest=JSON.parse(await readFile('assets/characters/first-person-v1/manifest.json'));assert.equal(manifest.characters.length,10);assert.equal(hash(await readFile('blender/extract_first_person_arms.py')),manifest.generatorSHA256);
 for(const c of manifest.characters){
  assert.equal(hash(await readFile(c.source)),c.sourceSHA256);assert.equal(hash(await readFile(c.blend)),c.blendSHA256);
  const bytes=await readFile(c.glb);assert.equal(hash(bytes),c.glbSHA256);const n=bytes.readUInt32LE(12),g={doc:JSON.parse(bytes.toString('utf8',20,20+n)),bin:bytes.subarray(28+n)};
  assert.equal(g.doc.skins.length,1);assert.equal(g.doc.skins[0].joints.length,53);assert.equal(g.doc.animations.length,16);
  const jointNames=g.doc.skins[0].joints.map(i=>g.doc.nodes[i].name),allowed=new Set();
  const visit=i=>{allowed.add(g.doc.nodes[i].name);for(const child of g.doc.nodes[i].children??[])visit(child);};
  for(const side of ['r','l'])visit(g.doc.nodes.findIndex(n=>n.name==='lowerarm_'+side));
  let vertices=0;
  for(const mesh of g.doc.meshes)for(const p of mesh.primitives){
   const weights=data(g,p.attributes.WEIGHTS_0),joints=data(g,p.attributes.JOINTS_0);vertices+=weights.length;
   for(let i=0;i<weights.length;i++){const arm=weights[i].reduce((total,w,k)=>total+(allowed.has(jointNames[joints[i][k]])?w:0),0);assert.ok(arm>=.649,`${c.slot} torso-weight vertex ${i}: ${arm}`);}
  }
  assert.ok(vertices>1000);assert.ok(c.meshes.every(m=>m.armFaces<m.sourceFaces));assert.equal(c.sourceReload,true);
 }
});

test('ten Cocos forearm derivatives preserve source rig, clips, geometry bytes and image provenance independently of full actors',async()=>{
 const records=JSON.parse(await readFile('platform/cocos/source-assets.json')).filter(r=>r.source.startsWith('assets/characters/first-person-v1/'));
 assert.equal(records.length,10);
 for(const record of records){
  assert.deepEqual(record.dependencies,[]);
  const bytes=await readFile(record.source),length=bytes.readUInt32LE(12),original={doc:JSON.parse(bytes.toString('utf8',20,20+length)),bin:bytes.subarray(28+length)};
  assert.equal(hash(bytes),record.sha256);
  const path='platform/cocos/'+record.destination,encoded=await readFile(path),doc=JSON.parse(encoded);
  assert.equal(hash(encoded),record.outputSHA256);
  const binOutput=record.outputs.find(o=>o.destination.endsWith('.bin')),bin=await readFile('platform/cocos/'+binOutput.destination);
  assert.equal(hash(bin),binOutput.sha256);
  for(const section of ['nodes','meshes','skins','animations','materials','scenes'])assert.deepEqual(doc[section],original.doc[section],path+' '+section);
  assert.equal(doc.skins[0].joints.length,53);assert.equal(doc.animations.length,16);
  for(let i=0;i<original.doc.accessors.length;i++){
   const a=original.doc.accessors[i],b=doc.accessors[i];assert.equal(a.count,b.count);assert.equal(a.type,b.type);assert.equal(a.componentType,b.componentType);
   if(a.bufferView!==undefined){const v=original.doc.bufferViews[a.bufferView],w=doc.bufferViews[b.bufferView];assert.deepEqual(original.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),bin.subarray(w.byteOffset??0,(w.byteOffset??0)+w.byteLength));}
  }
  for(let i=0;i<doc.images.length;i++){
   const v=original.doc.bufferViews[original.doc.images[i].bufferView],source=original.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
   const image=await readFile('platform/cocos/assets/resources/'+doc.images[i].uri);assert.deepEqual(image,source);
  }
 }
});
