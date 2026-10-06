import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Object3D,Matrix4} from 'three';
import {conversationClip} from '../public/conversation-animation.mjs';

const root=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,root)),sha=b=>createHash('sha256').update(b).digest('hex');
function glb(bytes){const length=bytes.readUInt32LE(12);return {doc:JSON.parse(bytes.toString('utf8',20,20+length)),bin:bytes.subarray(28+length)};}
function rig(doc){const nodes=doc.nodes.map(n=>{const o=new Object3D();o.name=n.name;if(n.matrix)o.applyMatrix4(new Matrix4().fromArray(n.matrix));else{o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);o.scale.fromArray(n.scale??[1,1,1]);}return o;});doc.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));const scene=new Object3D();doc.scenes[doc.scene??0].nodes.forEach(i=>scene.add(nodes[i]));return scene;}
function floats(doc,bin,index,width){const a=doc.accessors[index],v=doc.bufferViews[a.bufferView];assert.equal(a.componentType,5126);return Array.from({length:a.count*width},(_,i)=>bin.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+Math.floor(i/width)*(v.byteStride??4*width)+(i%width)*4));}

test('ten Cocos actor derivatives retain original data and match the independent Three.js conversation retarget',async()=>{
 const manifest=JSON.parse(await read('platform/cocos/source-assets.json')),bankBytes=await read('assets/animations/conversation-v1/workplace-conversation.glb'),bank=await new GLTFLoader().parseAsync(bankBytes.buffer.slice(bankBytes.byteOffset,bankBytes.byteOffset+bankBytes.byteLength),'');
 const records=manifest.filter(r=>r.dependencies?.length);assert.equal(records.length,10);
 for(const record of records){
  const originalBytes=await read(record.source),original=glb(originalBytes);assert.equal(sha(originalBytes),record.sha256);
  const derivative=JSON.parse(await read('platform/cocos/'+record.destination)),binRecord=record.outputs.find(o=>o.destination.endsWith('.bin')),binary=await read('platform/cocos/'+binRecord.destination);
  assert.equal(sha(binary),binRecord.sha256);assert.equal(sha(await read('platform/cocos/'+record.destination)),record.outputSHA256);
  for(const section of ['nodes','meshes','skins','materials','scenes'])assert.deepEqual(derivative[section],original.doc[section],record.source+' '+section);
  assert.deepEqual(derivative.animations.slice(0,original.doc.animations.length),original.doc.animations);assert.equal(derivative.animations.length,original.doc.animations.length+1);
  original.doc.accessors.forEach((a,i)=>{const b=derivative.accessors[i];assert.equal(a.count,b.count);assert.equal(a.componentType,b.componentType);assert.equal(a.type,b.type);if(a.bufferView!==undefined){const v=original.doc.bufferViews[a.bufferView],w=derivative.bufferViews[b.bufferView];assert.deepEqual(binary.subarray(w.byteOffset??0,(w.byteOffset??0)+w.byteLength),original.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),'original data bytes');}});
  for(const dependency of record.dependencies)assert.equal(sha(await read(dependency.source)),dependency.sha256);
  const dependency=record.dependencies[0],actor=rig(original.doc),expected=conversationClip(bank,actor,'expected',dependency.style==='Comfort'?'医生':dependency.style==='Explain'?'老师':'诗人'),clip=derivative.animations.at(-1);assert.equal(clip.name,dependency.clip);assert.equal(clip.channels.length,53);
  for(const channel of clip.channels){assert.equal(channel.target.path,'rotation');const node=actor.getObjectByName(derivative.nodes[channel.target.node].name),track=expected.tracks.find(t=>t.name===node.uuid+'.quaternion'),sampler=clip.samplers[channel.sampler];assert.ok(track);const values=floats(derivative,binary,sampler.output,4),times=floats(derivative,binary,sampler.input,1);assert.deepEqual(times,[...track.times]);assert.equal(values.length,track.values.length);values.forEach((v,i)=>assert.ok(Math.abs(v-track.values[i])<2e-6,'rest-relative rotation'));}
 }
});


test('Cocos transparency factors exactly follow source GLB materials without altering opaque or masked assets',async()=>{
 const generated=await read('platform/cocos/assets/scripts/SourceMaterialAlpha.ts');
 const rules=JSON.parse(generated.toString().split('>>=')[1].trim().replace(/;$/,''));
 const records=JSON.parse(await read('platform/cocos/source-assets.json'));
 const expected={};
 for(const record of records){
  const doc=glb(await read(record.source)).doc;
  const name=record.destination.split('/').at(-1).replace('.gltf',''),slot=name==='programmer'?'male_programmer':name;
  expected[slot]=Object.fromEntries(doc.materials.filter(m=>m.alphaMode==='BLEND'&&(m.pbrMetallicRoughness?.baseColorFactor?.[3]??1)!==1).map(m=>[m.name,m.pbrMetallicRoughness.baseColorFactor[3]]));
 }
 assert.deepEqual(rules,expected);
 assert.ok(Math.abs(rules.headquarters.Material_6-.13)<1e-7);
 assert.ok(Math.abs(rules.female_teacher.Teacher_Clear_Lenses-.08)<1e-7);
 assert.equal(Object.keys(rules).length,21);
});
