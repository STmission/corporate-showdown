import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Object3D,AnimationMixer,AnimationClip,QuaternionKeyframeTrack,VectorKeyframeTrack,Vector3 } from 'three';
import { CharacterAnimation } from '../public/character-animation.mjs';
import { ANIMATION_NAMES,selectAnimation } from '../shared/animation.mjs';
async function load(slot){
 const b=await readFile(`assets/characters/${slot}.glb`),n=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+n)),offset=20+n+8;
 function values(id){const a=g.accessors[id],v=g.bufferViews[a.bufferView],size={SCALAR:1,VEC3:3,VEC4:4}[a.type];assert.equal(a.componentType,5126);const data=new Float32Array(a.count*size);for(let i=0;i<a.count;i++)for(let j=0;j<size;j++)data[i*size+j]=b.readFloatLE(offset+(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*4)+j*4);return data;}
 const nodes=g.nodes.map(n=>{const o=new Object3D();o.name=n.name;if(n.matrix)o.applyMatrix4({elements:n.matrix});else{o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);o.scale.fromArray(n.scale??[1,1,1]);}return o;});
 g.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));const root=new Object3D();g.scenes[g.scene??0].nodes.forEach(i=>root.add(nodes[i]));
 const clips=g.animations.map(a=>new AnimationClip(a.name,-1,a.channels.map(c=>{
  const sampler=a.samplers[c.sampler],times=values(sampler.input),data=values(sampler.output);
  assert.ok([...times].every((t,i)=>Number.isFinite(t)&&(!i||t>times[i-1])));assert.ok([...data].every(Number.isFinite));
  const path={translation:'position',rotation:'quaternion',scale:'scale'}[c.target.path];
  if(['Idle','Walk','Run','Rescue'].some(n=>a.name.endsWith('_'+n))){
   const size=path==='quaternion'?4:3,first=data.slice(0,size),last=data.slice(-size);
   if(size===4)assert.ok(Math.abs(first.reduce((sum,v,i)=>sum+v*last[i],0))>.9999,'loop quaternion seam');
   else assert.ok(first.every((v,i)=>Math.abs(v-last[i])<1e-4),'loop translation/scale seam');
  }
  if(path==='quaternion')for(let i=0;i<data.length;i+=4)assert.ok(Math.abs(Math.hypot(...data.slice(i,i+4))-1)<.001);
  if(g.nodes[c.target.node].name==='Root'&&path==='position')for(let i=0;i<data.length;i+=3){assert.ok(Math.abs(data[i]-data[0])<1e-5);assert.ok(Math.abs(data[i+2]-data[2])<1e-5);}
  const Track=path==='quaternion'?QuaternionKeyframeTrack:VectorKeyframeTrack;return new Track(`${nodes[c.target.node].uuid}.${path}`,times,data);
 })));
 return {root,clips};
}
test('animation priorities use authoritative state and actual HP reaction, without changing gameplay',()=>{
 const e={state:'active',player:true,hitUntil:10,attackUntil:0};assert.equal(selectAnimation(e,1,4.6),'Run');
 assert.equal(selectAnimation(e,1,1.9),'Walk');assert.equal(selectAnimation(e,1,0,{hitActive:true}),'Hit');
 assert.equal(selectAnimation({...e,attackUntil:2},1,4.6),'Attack');assert.equal(selectAnimation({...e,cast:{end:2}},1,0),'Cast');
 assert.equal(selectAnimation({...e,state:'down',attackUntil:2},1,4.6),'Down');
 assert.equal(selectAnimation({...e,interactProgress:1,interactTarget:'teammate'},1,0,{rescueTargets:new Set(['teammate'])}),'Rescue');
 assert.equal(selectAnimation({...e,state:'down'},1,0,{lobby:true}),'Idle');assert.equal(e.state,'active');
});
test('all eight GLBs have finite skeletal tracks, animated legs and low downed head; no horizontal root motion',async()=>{
 for(const gender of ['male','female'])for(const job of ['programmer','ecommerce','sales','celebrity']){
  const slot=`${gender}_${job}`,{root,clips}=await load(slot);assert.deepEqual(clips.map(c=>c.name),ANIMATION_NAMES.map(n=>`${slot}_${n}`));
  const mixer=new AnimationMixer(root),controller=new CharacterAnimation(mixer,clips,slot);controller.update(0);root.updateMatrixWorld(true);
  const head=root.getObjectByName('head'),thigh=root.getObjectByName('thigh_l'),standing=head.getWorldPosition(new Vector3()).y,rest=thigh.quaternion.clone();assert.ok(standing>1.2&&standing<2);
  controller.play('Walk',null,1.8);controller.update(.25);assert.ok(rest.angleTo(thigh.quaternion)>.1,slot+' walk leg must actually move');
  controller.play('Run',null,4.6);controller.update(.2);assert.ok(thigh.quaternion.toArray().every(Number.isFinite));
  controller.play('Down');controller.update(1);root.updateMatrixWorld(true);assert.ok(head.getWorldPosition(new Vector3()).y<standing*.5,slot+' down head remains standing');
  controller.play('Idle');controller.update(.2);root.updateMatrixWorld(true);assert.ok(head.getWorldPosition(new Vector3()).y>standing*.9);
  controller.play('Rescue');controller.update(.3);root.updateMatrixWorld(true);
  for(const side of ['l','r']){const ankle=root.getObjectByName('foot_'+side).getWorldPosition(new Vector3()).y;assert.ok(ankle>-.1&&ankle<.2,`${slot} rescue ankle ${ankle} is off the ground`);}
  mixer.stopAllAction();mixer.uncacheRoot(root);
 }
});
