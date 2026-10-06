import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer, Object3D, Matrix4, Vector3} from 'three';
import {conversationClip,conversationStyle,CONVERSATION_STYLES} from '../public/conversation-animation.mjs';
import {selectAnimation} from '../shared/animation.mjs';
const root=new URL('../../',import.meta.url);
const bytes=path=>readFile(new URL(path,root));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function bank(){const b=await bytes('assets/animations/conversation-v1/workplace-conversation.glb');return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
async function target(path){const b=await bytes(path),g=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));const nodes=g.nodes.map(n=>{const o=new Object3D();o.name=n.name;if(n.matrix)o.applyMatrix4(new Matrix4().fromArray(n.matrix));else{o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);o.scale.fromArray(n.scale??[1,1,1]);}return o;});g.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));const actor=new Object3D();g.scenes[g.scene??0].nodes.forEach(n=>actor.add(nodes[n]));return actor;}

test('conversation animation bank preserves source hashes, three actual GLB clips and closed loops',async()=>{
 const manifest=JSON.parse(await bytes('assets/animations/conversation-v1/manifest.json'));
 for(const [path,digest]of [[manifest.source,manifest.sourceSHA256],[manifest.blend,manifest.blendSHA256],[manifest.glb,manifest.glbSHA256],['blender/build_conversation_animations.py',manifest.scriptSHA256]])assert.equal(hash(await bytes(path)),digest,path);
 const actual=await bank();assert.deepEqual(actual.animations.map(c=>c.name),CONVERSATION_STYLES.map(n=>'Conversation_'+n));
 for(const clip of actual.animations){assert.equal(clip.duration,4);for(const track of clip.tracks){assert.ok([...track.values].every(Number.isFinite));const size=track.getValueSize(),a=track.values.slice(0,size),b=track.values.slice(-size);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-5),'loop seam '+track.name);}}
});

test('actual conversation GLB retargets all ten rigs without changing bone lengths, feet or original clips',async()=>{
 const source=await bank(),paths=['male','female'].flatMap(g=>['programmer','ecommerce','sales','celebrity'].map(j=>`assets/characters/${g}_${j}.glb`));paths.push('assets/characters/professions-v1/female_doctor.glb','assets/characters/professions-v1/teacher/female_teacher.glb');
 for(const path of paths)for(const profession of ['老师','退役特种兵','医生']){
  const actor=await target(path),translations=new Map();actor.traverse(o=>translations.set(o.uuid,o.position.toArray()));actor.updateMatrixWorld(true);const feet=['foot_l','foot_r'].map(n=>actor.getObjectByName(n).getWorldPosition(new Vector3())),head=actor.getObjectByName('head'),before=head.quaternion.clone();
  const clip=conversationClip(source,actor,'sample',profession);assert.equal(clip.tracks.length,53);assert.ok(clip.tracks.every(t=>t.name.endsWith('.quaternion')));const mixer=new AnimationMixer(actor);mixer.clipAction(clip).play();mixer.update(.95);actor.updateMatrixWorld(true);
  assert.ok(head.quaternion.angleTo(before)>.015,path+' head gesture');actor.traverse(o=>assert.deepEqual(o.position.toArray(),translations.get(o.uuid),'retarget changed local translation'));
  ['foot_l','foot_r'].forEach((n,i)=>assert.ok(actor.getObjectByName(n).getWorldPosition(new Vector3()).distanceTo(feet[i])<1e-4,path+' foot drift'));
  mixer.stopAllAction();mixer.uncacheRoot(actor);
 }
 assert.equal(conversationStyle('医生'),'Comfort');assert.equal(conversationStyle('律师'),'Explain');assert.equal(conversationStyle('诗人'),'Listen');
 assert.throws(()=>conversationClip(source,new Object3D(),'missing','医生'),/不兼容/);
});

test('authoritative conversation selects Talk only where the renderer has the clip and yields to combat reactions',()=>{
 const e={state:'active',player:true,conversing:true};assert.equal(selectAnimation(e,1,0),'Idle');assert.equal(selectAnimation(e,1,0,{talkAvailable:true}),'Talk');assert.equal(selectAnimation({...e,conversing:false},1,0,{talkAvailable:true}),'Idle');
 assert.equal(selectAnimation(e,1,0,{talkAvailable:true,hitActive:true}),'Hit');assert.equal(selectAnimation({...e,attackUntil:2},1,0,{talkAvailable:true}),'Attack');assert.equal(selectAnimation({...e,state:'down'},1,0,{talkAvailable:true}),'Down');
});
