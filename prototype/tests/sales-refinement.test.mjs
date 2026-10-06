import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='assets/characters/refined-v2/male_sales/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const glb=b=>{const n=b.readUInt32LE(12);return {doc:JSON.parse(b.toString('utf8',20,20+n)),bin:b.subarray(28+n)};};
function values(g,index){const a=g.doc.accessors[index],v=g.doc.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],width={5126:4,5123:2,5121:1}[a.componentType];assert.ok(size&&width);const out=[];for(let i=0;i<a.count;i++)for(let c=0;c<size;c++){const p=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*width)+c*width;out.push(width===4?g.bin.readFloatLE(p):width===2?g.bin.readUInt16LE(p):g.bin.readUInt8(p));}return out;}
test('sales material refinement keeps original geometry, skeleton and animation contract with traceable source',async()=>{
 const m=JSON.parse(await readFile(folder+'manifest.json'));const v=JSON.parse(await readFile(folder+'validation.json'));
 for(const [p,h]of [[m.source,m.sourceSHA256],[m.blend,m.blendSHA256],[m.glb,m.glbSHA256],['blender/refine_sales_character.py',m.scriptSHA256]])assert.equal(hash(await readFile(p)),h,p);
 assert.equal(v.status,'passed');assert.equal(v.sourceReload,true);assert.equal(v.gltfImport,true);assert.equal(v.poses.length,4);
 const old=glb(await readFile('assets/characters/male_sales.glb')),next=glb(await readFile(m.glb));
 assert.equal(next.doc.meshes.length,old.doc.meshes.length);assert.equal(next.doc.skins[0].joints.length,53);
 assert.deepEqual(next.doc.animations.map(a=>a.name).sort(),old.doc.animations.map(a=>a.name).sort());
 let originDelta=null;
 for(const mesh of old.doc.meshes){const target=next.doc.meshes.find(n=>n.name===mesh.name);assert.ok(target,mesh.name);assert.equal(target.primitives.length,mesh.primitives.length);for(let i=0;i<mesh.primitives.length;i++)for(const key of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']){const a=values(old,mesh.primitives[i].attributes[key]),b=values(next,target.primitives[i].attributes[key]);assert.equal(a.length,b.length,mesh.name+key);const offset=key==='POSITION'?a.slice(0,3).map((v,i)=>v-b[i]):[0,0,0];if(key==='POSITION'){assert.ok(offset.every(v=>Math.abs(v)<.003),'source extraction origin must remain within 3 mm');if(originDelta)offset.forEach((v,i)=>assert.ok(Math.abs(v-originDelta[i])<1e-5,'same translation for all meshes'));else originDelta=offset;}for(let j=0;j<a.length;j++)assert.ok(Math.abs(a[j]-b[j]-(key==='POSITION'?offset[j%3]:0))<1e-5,mesh.name+key+j);}}
 const eye=next.doc.materials.find(m=>m.name.includes('high-poly'));assert.equal(eye.alphaMode,'MASK');assert.equal(eye.alphaCutoff,.4);assert.ok(eye.pbrMetallicRoughness.baseColorTexture);
 const hair=next.doc.materials.find(m=>m.name.includes('short04'));assert.ok(hair.pbrMetallicRoughness.baseColorTexture);assert.equal(hair.alphaMode,'MASK');assert.ok(hair.pbrMetallicRoughness.roughnessFactor>.7);
});
