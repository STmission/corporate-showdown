import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]??'platform/cocos/build/web-desktop');
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name.endsWith('.js'))files.push(p);}}await walk(root);
const registrations=new Map();const context=vm.createContext({System:{register(name,deps,factory){if(Array.isArray(name)){deps({},{meta:{}}).execute();return;}registrations.set(name,{deps,factory});}}});
// Register actual bundled modules without executing platform or application code.
for(const p of files){const s=await readFile(p,'utf8');if(s.includes('chunks:///_virtual/input-controls.js')||s.includes('System.register("chunks:///_virtual/rollupPluginModLoBabelHelpers.js"'))vm.runInContext(s,context,{timeout:1000});}
const loaded=new Map();function load(name){if(loaded.has(name))return loaded.get(name);const record=registrations.get(name);assert.ok(record,'compiled dependency '+name);const out={};loaded.set(name,out);const module=record.factory((k,v)=>{if(typeof k==='object'){Object.assign(out,k);return k;}out[k]=v;return v;});record.deps.forEach((dep,i)=>module.setters[i](dep==='cc'?{cclegacy:{_RF:{push(){},pop(){}}}}:load(new URL(dep,name).href)));module.execute();return out;}
const {InputControls}=load('chunks:///_virtual/input-controls.js');const controls=new InputControls();controls.setActive(true);
for(const action of ['attack','skill','dodge','throw','transform','reload','weaponNext','pickup']){controls.press(action);controls.release(action);assert.equal(controls.next()[action],true,action+' short press in compiled client');assert.equal(controls.next()[action],false,action+' consumed once');}
controls.press('forward');assert.equal(controls.next().z,-1);controls.press('pickup');controls.setActive(false);assert.equal(controls.next().pickup,false);console.log('Actual Cocos compiled input module: eight actions, movement and modal cancellation passed.');
const {ConversationFocus,conversationFacing}=load('chunks:///_virtual/conversation-focus.js');
const focus=new ConversationFocus(),state={id:'room',status:'running',players:[{id:'p',state:'active',connected:true}],npcs:[{id:'teacher',conversing:false}]};
focus.begin('room','teacher',0);assert.equal(focus.observe(state,'p',100),null);state.npcs[0].conversing=true;assert.equal(focus.observe(state,'p',150),null);state.npcs[0].conversing=false;assert.equal(focus.observe(state,'p',200),'released');focus.end();assert.equal(focus.npcId,null);
focus.begin('room','teacher',0);assert.equal(focus.observe(state,'p',5000),'timeout');assert.equal(focus.observe({...state,id:'another-room'},'p',50),'unavailable');
const facing=conversationFacing({x:0,z:0},{x:0,z:-2});assert.ok(Math.abs(facing.yaw)<1e-8);assert.ok(facing.pitch<0);
const {characterAssetSlot}=load('chunks:///_virtual/character-assets.js');assert.equal(characterAssetSlot({id:'teacher',profession:'老师',gender:'female',job:'programmer'}),'female_teacher');assert.equal(characterAssetSlot({id:'doctor',profession:'医生',gender:'female',job:'ecommerce'}),'female_doctor');assert.equal(characterAssetSlot({id:'p',profession:'老师',gender:'female',job:'programmer'}),'female_programmer');
const {selectAnimation}=load('chunks:///_virtual/animation.js');assert.equal(selectAnimation({state:'active',player:true,conversing:true},1,0,{talkAvailable:true}),'Talk');assert.equal(selectAnimation({state:'down',player:true,conversing:true},1,0,{talkAvailable:true}),'Down');
assert.equal(selectAnimation({state:'active',weapon:'pistol'},1,0,{weaponAvailable:true}),'PistolHold');assert.equal(selectAnimation({state:'active',weapon:'rifle',attackUntil:2},1,0,{weaponAvailable:true}),'RifleShot');assert.equal(selectAnimation({state:'active',weapon:'smg'},1,2,{weaponAvailable:true}),'RifleWalk');assert.equal(selectAnimation({state:'down',weapon:'rifle',attackUntil:2},1,0,{weaponAvailable:true}),'Down');
console.log('Actual compiled weapon hold, shot, locomotion and down priority passed.');
console.log('Actual compiled conversation focus, profession selection and Talk priority passed.');
const {newStory,storyTopicAvailable,storyDialogueText,storyEnding}=load('chunks:///_virtual/story.js');
const story=newStory();story.clues=['schedule','policy','ledger','verse'];story.choices=['doctor:rest'];story.route='reason';story.phase='resolved';
assert.equal(storyTopicAvailable(story,{route:'challenge'}),false);assert.equal(storyTopicAvailable(story,{route:'reason',requires:['ledger']}),true);assert.match(storyDialogueText(story,{id:'teacher'},{id:'schedule'},''),/晚上领回来/);
const ending=storyEnding(story,true,'resolved');assert.equal(ending.id,'reason');assert.equal(ending.evidence.length,3);assert.equal(ending.voices.length,3);assert.equal(storyEnding(story,false,'timeout').id,'timeout');console.log('Actual compiled story branch lock, resolved dialogue and personal endings passed.');

controls.clear();controls.setActive(true);controls.press('forward');controls.release('forward');assert.equal(controls.next().z,-1);assert.equal(controls.next().z,0);controls.press('right');controls.release('right',{cancel:true});assert.equal(controls.next().x,0);console.log('Actual compiled movement tap, release and cancellation passed.');

const {cameraPose,cameraAvatarVisible}=load('chunks:///_virtual/camera-rig.js');
const tight=cameraPose({x:0,z:1.1,walls:[{x:0,z:1.5,w:4,d:.1,h:3.45}]});assert.ok(tight.distance<.9);assert.equal(cameraAvatarVisible(tight.distance),false);assert.equal(cameraAvatarVisible(3.1,false),true);assert.equal(cameraAvatarVisible(1.05,false),false);assert.equal(cameraAvatarVisible(1.05,true),true);assert.equal(cameraAvatarVisible(cameraPose({x:0,z:0,thirdPerson:false}).distance),false);console.log('Actual compiled near-wall local avatar visibility and hysteresis passed.');
const {weaponGrip}=load('chunks:///_virtual/weapon-grip.js');
for(const family of ['pistol','smg','rifle','sniper','shotgun','lmg','hammer','scissors']){const g=weaponGrip(family),a=g.rotation[2],x=g.pivot[0]*Math.cos(a)-g.pivot[1]*Math.sin(a)+g.position[0],y=g.pivot[0]*Math.sin(a)+g.pivot[1]*Math.cos(a)+g.position[1];assert.equal(g.bone,'hand_r');assert.ok(Math.abs(x-g.palm[0])<1e-7&&Math.abs(y-g.palm[1])<1e-7);}assert.throws(()=>weaponGrip('invalid'));console.log('Actual compiled weapon grip: eight geometric pivots match the right-hand palm; unknown families rejected.');
