import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {selectAnimation,WEAPON_ANIMATION_NAMES,weaponAnimation} from '../shared/animation.mjs';
import {data} from '../tools/gltf-skin-floor.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function parse(b){const n=b.readUInt32LE(12);return {doc:JSON.parse(b.toString('utf8',20,20+n)),bin:b.subarray(28+n)};}
test('weapon animation uses trusted attack window while preserving hit, down, conversation and utility priorities',()=>{
 const e={player:true,state:'active',weapon:'rifle',attackUntil:0},options={weaponAvailable:true};
 assert.equal(selectAnimation(e,1,0,options),'RifleHold');assert.equal(selectAnimation(e,1,2,options),'RifleWalk');assert.equal(selectAnimation(e,1,4.6,options),'RifleRun');
 assert.equal(selectAnimation({...e,attackUntil:2},1,0,options),'RifleShot');assert.equal(selectAnimation({...e,weapon:'pistol',attackUntil:2},1,0,options),'PistolShot');
 assert.equal(selectAnimation({...e,attackUntil:2,state:'down'},1,0,options),'Down');assert.equal(selectAnimation({...e,attackUntil:2},1,0,{...options,hitActive:true}),'Hit');
 assert.equal(selectAnimation({...e,conversing:true},1,0,{...options,talkAvailable:true}),'Talk');assert.equal(selectAnimation({...e,cast:{end:2}},1,0,options),'Cast');
 assert.equal(selectAnimation({...e,attackUntil:2},1,0),'Attack');assert.equal(weaponAnimation('hammer','Attack'),'Attack');assert.equal(weaponAnimation('unknown','Idle'),'Idle');
});
test('ten weapon derivatives preserve every original byte, bind pose and original clip; locomotion keeps authored legs/root',async()=>{
 const m=JSON.parse(await readFile('assets/characters/weapon-ready-v1/manifest.json'));assert.equal(m.characters.length,10);assert.equal(hash(await readFile('blender/retarget_weapon_poses.py')),m.generatorSHA256);assert.equal(hash(await readFile(m.bank)),m.bankSHA256);
 for(const c of m.characters){
  const source=await readFile(c.source),output=await readFile(c.glb);assert.equal(hash(source),c.sourceSHA256);assert.equal(hash(output),c.glbSHA256);assert.equal(hash(await readFile(c.sourceBlend)),c.sourceBlendSHA256);
  const a=parse(source),b=parse(output);assert.deepEqual(b.bin.subarray(0,a.doc.buffers[0].byteLength),a.bin.subarray(0,a.doc.buffers[0].byteLength));
  for(const k of ['meshes','nodes','skins','materials','images','textures'])assert.deepEqual(b.doc[k],a.doc[k]);assert.deepEqual(b.doc.animations.slice(0,8),a.doc.animations);assert.equal(b.doc.animations.length,16);
  assert.deepEqual(new Set(c.clips),new Set(WEAPON_ANIMATION_NAMES.map(n=>c.slot+'_'+n)));
  for(const clip of b.doc.animations.slice(8)){
   for(const s of clip.samplers){for(const row of data(b,s.output))assert.ok(row.every(Number.isFinite));}
   if(clip.name.endsWith('Walk')||clip.name.endsWith('Run')){
    const motion=clip.name.endsWith('Walk')?'Walk':'Run',original=a.doc.animations.find(x=>x.name===c.slot+'_'+motion);
    for(const ch of clip.channels)if(['Root','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'].includes(b.doc.nodes[ch.target.node].name))assert.deepEqual(clip.samplers[ch.sampler],original.samplers[ch.sampler]);
   }
  }
 }
});
