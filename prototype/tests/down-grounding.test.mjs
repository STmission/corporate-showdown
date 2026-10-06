import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
function parse(b){const n=b.readUInt32LE(12);return {doc:JSON.parse(b.toString('utf8',20,20+n)),bin:b.subarray(28+n)};}
test('all ten grounded character derivatives preserve geometry, materials and seven other actions',async()=>{
 const manifest=JSON.parse(await readFile('assets/characters/grounded-v1/manifest.json'));
 assert.equal(manifest.status,'passed');assert.equal(manifest.characters.length,10);assert.equal(new Set(manifest.characters.map(c=>c.slot)).size,10);assert.equal(hash(await readFile(manifest.generator)),manifest.generatorSHA256);
 for(const c of manifest.characters){
  for(const [path,fingerprint]of [[c.source,c.sourceSHA256],[c.glb,c.glbSHA256],[c.blend,c.blendSHA256]])assert.equal(hash(await readFile(path)),fingerprint,path);
  assert.equal(c.sourceReload,true);assert.equal(c.gltfImport,true);assert.ok(c.validationSamples>140);assert.ok(c.newMinimum>=-.0005);assert.ok(c.newMaximum<.12);assert.ok(c.maxLift>0&&c.maxLift<.5);
  const a=parse(await readFile(c.source)),b=parse(await readFile(c.glb));
  assert.deepEqual(b.bin.subarray(0,a.doc.buffers[0].byteLength),a.bin.subarray(0,a.doc.buffers[0].byteLength),'all original image, geometry and action bytes retained');
  for(const key of ['meshes','nodes','skins','materials','images','textures','scenes','scene'])assert.deepEqual(b.doc[key],a.doc[key],c.slot+key);
  assert.deepEqual(b.doc.accessors.slice(0,a.doc.accessors.length),a.doc.accessors);assert.deepEqual(b.doc.bufferViews.slice(0,a.doc.bufferViews.length),a.doc.bufferViews);
  assert.equal(b.doc.animations.length,8);
  for(const [i,original]of a.doc.animations.entries()){
   const next=b.doc.animations[i];if(!original.name.endsWith('_Down')){assert.deepEqual(next,original);continue;}
   assert.deepEqual(next.channels,original.channels);
   const root=original.channels.find(ch=>ch.target.path==='translation'&&a.doc.nodes[ch.target.node].name==='Root').sampler;
   for(const [j,sampler]of original.samplers.entries())if(j!==root)assert.deepEqual(next.samplers[j],sampler);else {assert.equal(next.samplers[j].interpolation,'LINEAR');assert.ok(next.samplers[j].input>=a.doc.accessors.length);assert.ok(next.samplers[j].output>=a.doc.accessors.length);}
  }
 }
});

import {skinMinimum} from '../tools/gltf-skin-floor.mjs';
test('independent glTF skin evaluation places all ten Down poses above the floor',async()=>{
 const manifest=JSON.parse(await readFile('assets/characters/grounded-v1/manifest.json'));
 for(const c of manifest.characters){const g=parse(await readFile(c.glb));for(const t of [0,.17,.375,.62,c.duration]){const min=skinMinimum(g,t);assert.ok(min>=-.0005&&min<.12,`${c.slot} at ${t}s: floor ${min}`);}}
});
