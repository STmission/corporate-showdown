import {weaponParts} from '/corporate-showdown/shared/weapon-geometry.mjs';
import {weaponGrip} from '/corporate-showdown/shared/weapon-grip.mjs';
import {WEAPONS} from '/corporate-showdown/shared/weapons.mjs';
import { FirstPersonArms } from './first-person-arms.mjs';
import { CharacterAnimation } from './character-animation.mjs';
import { conversationClip } from './conversation-animation.mjs';
import { conversationFacing } from './conversation-focus.mjs';
import { ANIMATION_NAMES,selectAnimation } from '/corporate-showdown/shared/animation.mjs';
import {cameraPose,cameraAvatarVisible} from '/corporate-showdown/shared/camera-rig.mjs';
import {WALLS} from '/corporate-showdown/shared/headquarters-layout.mjs';
import { validFloorPosition } from '/corporate-showdown/shared/headquarters-layout.mjs';
import { SnapshotInterpolation } from './network-state.mjs';
import * as THREE from '/corporate-showdown/vendor/three.js';
import {createModelLoader} from './model-loader.mjs';
import { clone as cloneSkinned } from '/corporate-showdown/vendor/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from '/corporate-showdown/vendor/addons/utils/BufferGeometryUtils.js';
import { appearanceSlot } from '/corporate-showdown/shared/appearance.mjs';
import { characterAssetSlot } from '/corporate-showdown/shared/character-assets.mjs';
import { LEVEL, floorHeight } from '/corporate-showdown/shared/level.mjs';

export function createView(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c5e1e9');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.045, 500);
  camera.rotation.order = 'YXZ'; scene.add(camera);
  scene.add(new THREE.HemisphereLight('#dbe6f5', '#85866f', 2.1));
  const sunlight = new THREE.DirectionalLight('#fff2da', 3.1); sunlight.position.set(-10, 15, -14); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048); Object.assign(sunlight.shadow.camera, { left: -36, right: 36, top: 25, bottom: -25, far: 120 });
  sunlight.shadow.bias = -0.001; scene.add(sunlight);
  const sharedGeometry = new Set(), sharedMaterial = new Set(), humanTemplates = new Map();
  const materials = new Map(), actors = new Map(), items = new Map(), shots = new Map(), warnings = new Map(), effects = [];
  function mat(color, metalness = 0, roughness = 0.75) {
    const key = `${color}:${metalness}:${roughness}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return materials.get(key);
  }
  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(parent, x, y, z, w, h, d, color, metal = 0) { return mesh(parent, new THREE.BoxGeometry(w, h, d), mat(color, metal), x, y, z); }
  function cyl(parent, x, y, z, r, h, color, rTop = r) { return mesh(parent, new THREE.CylinderGeometry(rTop, r, h, 16), mat(color), x, y, z); }
  function sphere(parent, x, y, z, r, color, sx = 1, sy = 1, sz = 1) { const m = mesh(parent, new THREE.SphereGeometry(r, 16, 12), mat(color), x, y, z); m.scale.set(sx, sy, sz); return m; }
  function dispose(group) {
    scene.remove(group); const shared = new Set(materials.values());
    group.traverse(o => { if (!sharedGeometry.has(o.geometry)) o.geometry?.dispose(); if (o.material && !shared.has(o.material) && !sharedMaterial.has(o.material)) { o.material.map?.dispose(); o.material.dispose(); } });
  }
  function label(parent, title, x, y, z, width = 2.5, subtitle = '', fixed = false) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 192; const ctx = c.getContext('2d');
    ctx.fillStyle = '#16232c'; ctx.fillRect(0, 0, 512, 192); ctx.fillStyle = '#e4b881'; ctx.fillRect(0, 0, 8, 192);
    ctx.font = '600 42px sans-serif'; ctx.fillStyle = '#e5edf1'; ctx.textAlign = 'center'; ctx.fillText(title, 256, 84);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#94a6b0'; ctx.fillText(subtitle, 256, 137);
    const texture = new THREE.CanvasTexture(c);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
    if (fixed) { const m = mesh(parent, new THREE.PlaneGeometry(width, width * 192 / 512), material, x, y, z); return m; }
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: true }); material.dispose();
    const sprite = new THREE.Sprite(spriteMaterial); sprite.position.set(x, y, z); sprite.scale.set(width, width * 192 / 512, 1); parent.add(sprite); return sprite;
  }
  function ring(parent, x, z, radius, color) {
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false });
    const m = mesh(parent, new THREE.RingGeometry(radius - 0.04, radius, 48), material, x, 0.022, z); m.rotation.x = -Math.PI / 2; return m;
  }
  const office = new THREE.Group(); scene.add(office);
  function chair(parent, x, z) {
    cyl(parent, x, 0.28, z, 0.045, 0.5, '#46515b'); box(parent, x, 0.5, z, 0.56, 0.12, 0.52, '#343e47');
    box(parent, x, 0.84, z + 0.22, 0.54, 0.66, 0.11, '#3c4650');
    for (const a of [0, 1, 2, 3, 4]) { const angle = a * Math.PI * 2 / 5; const beam = box(parent, x + Math.cos(angle) * 0.17, 0.1, z + Math.sin(angle) * 0.17, 0.42, 0.035, 0.035, '#525d67', 0.6); beam.rotation.y = -angle; sphere(parent, x + Math.cos(angle) * 0.36, 0.06, z + Math.sin(angle) * 0.36, 0.055, '#222b32'); }
  }
  const exitRing = ring(office, LEVEL.exit.x, LEVEL.exit.z, .85, '#dfa76e');
  const markers = LEVEL.objectives.map(o => {
    label(office, o.label, o.x, 2.05, o.z, 1.8, 'E / 长按交接');
    return ring(office, o.x, o.z, 1.15, '#a5d9d7');
  });
  // Terminals are interactive additions; their centers stay reachable on the floor.
  for (const o of LEVEL.objectives) {
    box(office, o.x, .5, o.z, .4, 1, .3, '#777f83', .6);
    box(office, o.x, 1.1, o.z, .5, .28, .035, '#4c7c86');
  }
  label(office, '电梯撤离', LEVEL.exit.x, 2.4, LEVEL.exit.z, 1.8, '完成交接 · 突破组长');
  let environment = null, loadError = null;
  const useModules=new URLSearchParams(location.search).get('environment')==='modules';
  const environmentRequest=useModules?(async()=>{
    const response=await fetch('/corporate-showdown/assets/environment-modules/v0.1/manifest.json');if(!response.ok)throw Error('模块场景清单不可用');const manifest=await response.json();
    if(manifest.layoutRevision!==LEVEL.revision||manifest.modules.length!==9)throw Error('模块场景版本或数量不匹配');
    const assembled=new THREE.Group();assembled.name='Modular_Coastal_Headquarters';
    const loaded=await Promise.all(manifest.modules.map(async module=>{if(!/^[a-z-]+\.glb$/.test(module.glb)||module.placement.length!==3||!module.placement.every(Number.isFinite))throw Error('模块坐标或资源名无效');const result=await createModelLoader().loadAsync('/corporate-showdown/assets/environment-modules/v0.1/'+module.glb);result.scene.position.fromArray(module.placement);return result.scene;}));
    loaded.forEach(model=>assembled.add(model));return {scene:assembled};
  })():createModelLoader().loadAsync(LEVEL.environment);
  const environmentReady = environmentRequest.then(gltf => {
    environment = gltf.scene; environment.updateMatrixWorld(true);
    const batches = new Map();
    environment.traverse(m => {
      if (!m.isMesh) return;
      // Studio NPCs are not combat entities; avoid indistinguishable static duplicates.
      let character = m.isSkinnedMesh;
      for (let p=m;p;p=p.parent) character ||= !!p.userData.environment_character;
      if (character) return;
      const material = m.material;
      const position = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
      const key = `${material.uuid}:${Math.floor(position.x/12)}:${Math.floor(position.z/12)}`;
      const geometry = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
      if (!batches.has(key)) batches.set(key, {material, geometries:[]});
      batches.get(key).geometries.push(geometry);
    });
    const visual = new THREE.Group(); visual.name='Playable_Coastal_Headquarters';
    for (const {material, geometries} of batches.values()) {
      const geometry=mergeGeometries(geometries);
      if (!geometry) throw new Error('场景几何属性不兼容');
      const m=new THREE.Mesh(geometry,material); m.castShadow=!material.transparent; m.receiveShadow=true;
      visual.add(m); geometries.forEach(g=>g.dispose());
    }
    scene.add(visual);document.getElementById('scene').dataset.environmentSource=useModules?'modules-v0.1':'complete-gameplay-v0.8';document.getElementById('scene').dataset.environmentBatches=String(batches.size);
    return {revision:LEVEL.revision, batches:batches.size};
  }).catch(e => {loadError=e.message; throw e;});
  const pendingHumans=new Map(),armTemplates=new Map(),pendingArms=new Map();
  function loadArms(slot){if(!pendingArms.has(slot))pendingArms.set(slot,createModelLoader().loadAsync(`/corporate-showdown/assets/characters/first-person/${slot}.glb`).then(result=>{result.scene.traverse(o=>{if(o.isMesh){sharedGeometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])sharedMaterial.add(m);}});armTemplates.set(slot,result);return result;}).catch(e=>{pendingArms.delete(slot);throw e;}));return pendingArms.get(slot);}
  function loadHuman(slot) {
    if(!pendingHumans.has(slot))pendingHumans.set(slot,createModelLoader().loadAsync(`/corporate-showdown/assets/characters/${slot}.glb`).then(result=>{
      result.scene.traverse(o=>{if(o.isMesh){sharedGeometry.add(o.geometry);sharedMaterial.add(o.material);o.castShadow=true;o.receiveShadow=true;}});
      for(const name of ANIMATION_NAMES)if(!result.animations.some(a=>a.name===`${slot}_${name}`))throw new Error(`人物动作资源版本不完整：${slot}/${name}`);
      humanTemplates.set(slot,result);container.dataset.characterAssets=[...humanTemplates.keys()].sort().join(',');return result;
    }).catch(e=>{pendingHumans.delete(slot);throw e;}));
    return pendingHumans.get(slot);
  }
  const humanReady = Promise.all(['male_programmer','male_sales'].map(loadHuman));
  let conversationBank;
  const conversationReady=createModelLoader().loadAsync('/corporate-showdown/assets/animations/conversation-v1/workplace-conversation.glb').then(bank=>{conversationBank=bank;container.dataset.conversationBank='conversation-v0.1';return bank;});
  const ready=Promise.all([environmentReady,humanReady,conversationReady]).catch(e=>{loadError=e.message;throw e;});
  async function prepareAppearances(players,localPlayerId){await ready;await Promise.all(players.flatMap(p=>[loadHuman(characterAssetSlot(p)),...(p.id===localPlayerId?[loadArms(characterAssetSlot(p))]:[])]));}
  function actor(e, player) {
    const slot=player ? characterAssetSlot(e) : (e.kind==='boss'||e.kind==='shield'?'male_sales':'male_programmer');
    const template=humanTemplates.get(slot);
    const group=new THREE.Group(), body=new THREE.Group(); group.add(body); scene.add(group);
    const model=cloneSkinned(template.scene), bounds=new THREE.Box3().setFromObject(model), height=slot.startsWith('female')?1.68:1.78;
    model.scale.multiplyScalar(height/bounds.getSize(new THREE.Vector3()).y);bounds.setFromObject(model);
    const center=bounds.getCenter(new THREE.Vector3());model.position.set(-center.x,-bounds.min.y,-center.z);body.add(model);
    const clips=e.profession&&conversationBank?[...template.animations,conversationClip(conversationBank,model,slot,e.profession)]:template.animations;
    const mixer=new THREE.AnimationMixer(model),animation=new CharacterAnimation(mixer,clips,slot);mixer.update(0);
    if(e.kind==='shield')box(body,-.29,.95,.25,.56,.8,.045,'#3c4e5d',.35);
    if(e.kind==='boss')box(body,.34,.63,.1,.4,.32,.1,'#463932');
    const tag=label(group,player?e.name:e.kind==='boss'?'再说两句组长':e.kind==='thrower'?'文档投手':e.kind==='shield'?'盾牌督导':'甩锅专员',0,2.05,0,.85,e.profession??'');
    const hp=box(group,0,1.94,0,.5,.015,.02,player?'#9bdad1':'#e2a380');
    group.position.set(e.x,floorHeight(e.x,e.z),e.z);
    return {group,body,hand:model.getObjectByName('hand_r'),hp,tag,mixer,animation,lastX:e.x,lastZ:e.z,lastHp:e.hp,hitVisualUntil:0,appearance:slot};
  }
  function weaponModel(kind){const g=new THREE.Group();for(const p of weaponParts(WEAPONS[kind].family)){let m;if(p.shape==='box'){m=box(g,...p.pos,...p.size,p.color,.45);m.rotation.z=p.tilt*Math.PI/180;}else{m=cyl(g,...p.pos,p.r,p.length,p.color);if(p.axis==='x')m.rotation.z=Math.PI/2;if(p.axis==='z')m.rotation.x=Math.PI/2;}}return g;}
  function itemModel(i) {
    const g = new THREE.Group(); scene.add(g); g.position.set(i.x, 0, i.z); ring(g, 0, 0, 0.4, '#e6c38c');
    if(WEAPONS[i.kind]){const model=weaponModel(i.kind);model.position.y=.45;g.add(model);label(g,WEAPONS[i.kind].name,0,.9,0,1.1,'E 拾取');}
    else if (i.kind === 'keyboard') { box(g, 0, 0.12, 0, 0.62, 0.035, 0.22, '#35414c'); for (let x = -0.25; x <= 0.25; x += 0.07) box(g, x, 0.15, 0, 0.05, 0.015, 0.17, '#889197'); }
    else if (i.kind === 'chair') chair(g, 0, 0);
    else if (i.kind === 'coffee') { cyl(g, 0, 0.18, 0, 0.07, 0.24, '#c6b593', 0.095); cyl(g, 0, 0.31, 0, 0.098, 0.025, '#4b4641'); }
    else if (i.kind === 'box') { box(g, 0, 0.23, 0, 0.48, 0.46, 0.4, '#a88c65'); box(g, 0, 0.47, 0, 0.06, 0.01, 0.4, '#ceba89'); }
    else { cyl(g, 0, 0.3, 0, 0.13, 0.6, '#a83e35'); cyl(g, 0, 0.65, 0, 0.04, 0.1, '#444d54'); box(g, 0.09, 0.62, 0, 0.05, 0.15, 0.07, '#343e45'); }
    return g;
  }
  const hands = new THREE.Group(); camera.add(hands);
  const sleeves=[], sleeveMaterials=new Map();
  const leftHand = new THREE.Group(), rightHand = new THREE.Group(); hands.add(leftHand, rightHand);
  for (const [arm, sign] of [[leftHand, -1], [rightHand, 1]]) {
    const sleeve = cyl(arm, 0, 0, 0, 0.065, 0.4, '#384c5d', 0.08); sleeve.rotation.x = Math.PI / 2; sleeves.push(sleeve);
    const wrist = cyl(arm, 0, 0, -0.24, 0.045, 0.15, '#bda38c'); wrist.rotation.x = Math.PI / 2;
    sphere(arm, 0, 0, -0.35, 0.07, '#262f38', 0.8, 0.72, 1.1);
    for (let i = 0; i < 4; i++) sphere(arm, -0.045 + i * 0.025, 0.025, -0.395, 0.017, '#53606b', 0.6, 0.7, 1.4);
    arm.position.set(sign * 0.29, -0.31, -0.25); arm.rotation.z = sign * -0.16;
  }
  function updateSleeves(me) {
    const slot=appearanceSlot(me.gender,me.job);if(hands.userData.appearance===slot)return;
    hands.userData.appearance=slot;
    if(!sleeveMaterials.has(me.job)){
      let material;
      if(me.job==='programmer'){
        const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
        ctx.fillStyle='#234967';ctx.fillRect(0,0,128,128);
        for(let i=0;i<128;i+=32){ctx.fillStyle='#b8c9cf';ctx.fillRect(i,0,6,128);ctx.fillRect(0,i,128,6);ctx.fillStyle='#071c2b';ctx.fillRect(i+14,0,10,128);ctx.fillRect(0,i+14,128,10);}
        const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,3);
        material=new THREE.MeshStandardMaterial({map:texture,roughness:.85});sharedMaterial.add(material);
      }else material=mat({sales:'#222934',ecommerce:'#c295a6',celebrity:'#32649b'}[me.job]);
      sleeveMaterials.set(me.job,material);
    }
    sleeves.forEach(m=>m.material=sleeveMaterials.get(me.job));
  }
  const heldModel = new THREE.Group(); heldModel.position.set(0.24, -0.24, -0.56); heldModel.rotation.set(-0.16, -0.3, 0.14); hands.add(heldModel);
  const realArms=new FirstPersonArms(camera,armTemplates,weaponModel,dispose);
  let heldKind = null;
  function changeWeapon(kind) {
    if (kind === heldKind) return; heldKind = kind;
    for (const child of [...heldModel.children]) { heldModel.remove(child); dispose(child); }
    if(WEAPONS[kind]){const model=weaponModel(kind);model.rotation.y=Math.PI/2;heldModel.add(model);}
    else if (kind === 'keyboard') { box(heldModel, 0, 0, 0, 0.62, 0.025, 0.22, '#3a4651'); for (let i = 0; i < 9; i++) box(heldModel, -0.27 + i * 0.065, 0.025, 0, 0.04, 0.015, 0.17, '#96a0a6'); }
    else if (kind === 'extinguisher') { cyl(heldModel, 0, -0.05, 0, 0.09, 0.38, '#a84036'); box(heldModel, 0, 0.17, 0, 0.14, 0.035, 0.05, '#4c565c'); }
    else if (kind === 'chair') { box(heldModel, 0, 0, 0, 0.5, 0.08, 0.42, '#3e4b55'); box(heldModel, 0, 0.2, 0.2, 0.5, 0.35, 0.04, '#3e4b55'); }
  }
  const interpolation=new SnapshotInterpolation();let predictedPosition=null;
  let home = true, state = null, playerId = null, yaw = 0, pitch = 0, lastEvents = 0, lastTime = performance.now(),conversationId=null;
  let motionPose=null;let thirdPerson=true;let avatarVisible=true;
  let moving = false, lastStepAt = 0, onStep = () => {}, onLock = () => {};
  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => { if (!home && state?.status === 'running' && !matchMedia('(pointer:coarse)').matches) requestLock(); });
  function requestLock() {
    if (home || state?.status !== 'running') return;
    try { const result = canvas.requestPointerLock(); result?.catch(() => {}); } catch {}
  }
  document.addEventListener('pointerlockchange', () => onLock(document.pointerLockElement === canvas));
  document.addEventListener('mousemove', e => { if (!home && document.pointerLockElement === canvas) turn(e.movementX, e.movementY); });
  let drag = null;
  canvas.addEventListener('pointerdown', e => { if (!home) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', e => { if (drag?.id === e.pointerId && document.pointerLockElement !== canvas) { turn(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; } });
  for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { drag = null; });
  function turn(dx, dy) { if(conversationId)return;yaw -= dx * 0.0025; pitch = THREE.MathUtils.clamp(pitch - dy * 0.0022, -1.15, 1.15); }
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  function setState(next, id) {
    if (state?.id !== next.id) { yaw = 0; pitch = 0; lastEvents = 0; camera.position.set(LEVEL.spawn.x, 1.68, LEVEL.spawn.z); }
    if(next.status==='running'&&state?.status!=='running'){const me=next.players.find(p=>p.id===id);if(me)camera.position.set(me.x,floorHeight(me.x,me.z)+1.68,me.z);}
    state = next; playerId = id;interpolation.push(next,performance.now());
    for (const event of next.events) if (event.id > lastEvents) {
      if(event.kind==='shot'&&next.elapsed-event.at<.25){for(const ray of event.rays??[]){const a=new THREE.Vector3(ray.from.x,ray.from.y,ray.from.z),b=new THREE.Vector3(ray.to.x,ray.to.y,ray.to.z);const m=mesh(scene,new THREE.CylinderGeometry(.008,.008,a.distanceTo(b),6),new THREE.MeshBasicMaterial({color:'#ffe1a1',transparent:true,opacity:.7}));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());effects.push({m,time:.09});}}
      if (event.x !== undefined && event.kind === 'skill' && next.elapsed-event.at<1) { const m = ring(scene, event.x, event.z, 3.5, '#9adfdb'); effects.push({ m, time: 0.4 }); }
      lastEvents = event.id;
    }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000); lastTime = now;
    const me = state?.players.find(p => p.id === playerId);
    if (home || !me) { if(realArms.actor)realArms.actor.group.visible=false;camera.position.set(-9, 1.7, 5.8); camera.lookAt(-20 + Math.sin(now * 0.00012), 1.4, -2); hands.visible = false; }
    else if(state.status==='lobby'){if(realArms.actor)realArms.actor.group.visible=false;camera.position.set(me.x+2.5,1.6,me.z+2.8);camera.lookAt(me.x-1.2,1.05,me.z);hands.visible=false;}
    else {
      const pose=predictedPosition??me;
      updateSleeves(me);
      moving=Boolean(motionPose&&Math.hypot(pose.x-motionPose.x,pose.z-motionPose.z)>.02);motionPose={x:pose.x,z:pose.z};
      const focused=state.npcs?.find(n=>n.id===conversationId),ground=floorHeight(pose.x,pose.z),facing=focused?conversationFacing(pose,focused,{ground,targetGround:floorHeight(focused.x,focused.z),targetHeight:renderer.domElement.clientWidth<=900?1.15:1.52,fallbackYaw:yaw}):{yaw,pitch};
      const orbit=cameraPose({x:pose.x,z:pose.z,ground,yaw:facing.yaw,pitch:facing.pitch,thirdPerson:focused?false:thirdPerson,down:me.state==='down',walls:WALLS});camera.position.set(orbit.x,orbit.y,orbit.z);camera.rotation.set(facing.pitch,facing.yaw,0,'YXZ');avatarVisible=cameraAvatarVisible(orbit.distance,avatarVisible);container.dataset.cameraDistance=String(orbit.distance);container.dataset.localAvatarVisible=String(thirdPerson&&!focused&&avatarVisible);hands.visible=!focused&&!thirdPerson&&state.status==='running'&&me.state==='active';
      container.dataset.cameraView=focused?'conversation':thirdPerson?'third':'first';
      const gameplayAim=JSON.stringify({yaw,pitch,thirdPerson});if(container.dataset.gameplayAim!==gameplayAim)container.dataset.gameplayAim=gameplayAim;
      if (moving && now - lastStepAt > 360 && me.state === 'active') { onStep(); lastStepAt = now; }
      const strike = me.attackUntil > state.elapsed ? Math.sin((me.attackUntil - state.elapsed) / 0.22 * Math.PI) : 0;
      rightHand.position.z = -0.25 - strike * 0.3; rightHand.rotation.x = -strike * 0.35;
      leftHand.position.y = -0.31 + (moving ? Math.sin(now * 0.014) * 0.008 : 0);
      heldModel.rotation.x = -0.16 - strike * 0.55; changeWeapon(me.weapon);
      const real=realArms.sync(me,characterAssetSlot(me),state.elapsed,dt,hands.visible);leftHand.visible=rightHand.visible=!real;heldModel.visible=!real||!WEAPONS[me.weapon];container.dataset.firstPersonArms=JSON.stringify(realArms.diagnostics());
    }
    if (state && humanTemplates.size>=2 && conversationBank) {
      const samples=interpolation.entities(now);
      const entities = [...state.players.map(p => ({ ...p, player: true })), ...state.enemies,...(state.npcs??[]).map(n=>({...n,player:true}))].map(e=>({...e,x:samples.get(e.id)?.x??e.x,z:samples.get(e.id)?.z??e.z})); const ids = new Set(entities.map(e => e.id));
      for (const [id, a] of actors) if (!ids.has(id)) { a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.mixer.getRoot()); dispose(a.group); actors.delete(id); }
      for (const e of entities) {
        const slot=e.player?characterAssetSlot(e):(e.kind==='boss'||e.kind==='shield'?'male_sales':'male_programmer');
        if(!humanTemplates.has(slot))continue;
        let a = actors.get(e.id);
        if(a&&a.appearance!==slot){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.mixer.getRoot());dispose(a.group);actors.delete(e.id);a=null;}
        if (!a) { a = actor(e, e.player); actors.set(e.id, a); }
        a.group.position.x += (e.x - a.group.position.x) * Math.min(1, dt * 20); a.group.position.z += (e.z - a.group.position.z) * Math.min(1, dt * 20); a.group.position.y = floorHeight(e.x,e.z);
        a.body.rotation.y = state.status==='lobby' ? Math.atan2(camera.position.x-e.x,camera.position.z-e.z) : Math.atan2(e.fx ?? 0, e.fz ?? 1); a.body.rotation.z = 0;
        if(a.weaponKind!==e.weapon){if(a.weaponModel){a.weaponModel.removeFromParent();dispose(a.weaponModel);}a.weaponKind=e.weapon;a.weaponModel=null;if(WEAPONS[e.weapon]){a.weaponModel=weaponModel(e.weapon);const grip=weaponGrip(WEAPONS[e.weapon].family);a.weaponModel.position.set(...grip.position);a.weaponModel.rotation.set(...grip.rotation);if(!a.hand)throw Error('人物缺少右手握持骨骼');a.hand.add(a.weaponModel);}}
        if(e.profession&&a.activity!==e.activity){dispose(a.tag);a.tag.removeFromParent();a.tag=label(a.group,e.name,0,2.15,0,1.5,e.profession+' · '+(e.activity??e.habit));a.activity=e.activity;}a.tag.visible=e.id!==playerId&&!(conversationId&&e.profession);a.hp.visible=e.id!==playerId&&!e.profession;
        a.group.visible = (e.id !== playerId || state.status==='lobby'||(thirdPerson&&!conversationId&&avatarVisible)) && !['extracted', 'left'].includes(e.state);
        const speed=Math.hypot(e.x-a.lastX,e.z-a.lastZ)/Math.max(dt,.001);a.lastX=e.x;a.lastZ=e.z;
        if(e.hp<a.lastHp)a.hitVisualUntil=state.elapsed+.2;a.lastHp=e.hp;
        const clip=selectAnimation(e,state.elapsed,speed,{lobby:state.status==='lobby',hitActive:a.hitVisualUntil>state.elapsed,rescueTargets:new Set(state.players.map(p=>p.id)),talkAvailable:a.animation.actions.has('Talk'),weaponAvailable:a.animation.actions.has('PistolHold')});
        const marker=(clip==='Attack'||clip.endsWith('Shot'))?e.attackUntil:clip==='Hit'?a.hitVisualUntil:clip==='Cast'?e.cast.end:null;
        a.animation.play(clip,marker,speed);a.animation.update(dt);
        a.hp.scale.x = Math.max(0.01, e.hp / (e.maxHp || 100));
      }
      container.dataset.weaponAttachments=JSON.stringify([...actors].filter(([id,a])=>a.weaponModel).map(([id,a])=>({id,kind:a.weaponKind,action:a.animation.current,parent:a.weaponModel.parent?.name,world:a.weaponModel.getWorldPosition(new THREE.Vector3()).toArray()})));
      const npcAnimations=JSON.stringify((state.npcs??[]).map(n=>({id:n.id,clip:actors.get(n.id)?.animation.current??null,conversing:n.conversing})));
      if(container.dataset.npcAnimations!==npcAnimations)container.dataset.npcAnimations=npcAnimations;
      const itemIds = new Set(state.items.map(i => i.id)); for (const [id, m] of items) if (!itemIds.has(id)) { dispose(m); items.delete(id); }
      for (const i of state.items) if (!items.has(i.id)) items.set(i.id, itemModel(i));
      const warnIds = new Set(); for (const e of state.enemies) if (e.cast) {
        warnIds.add(e.id); let m = warnings.get(e.id); if (!m) { m = ring(scene, e.cast.x, e.cast.z, e.cast.radius, '#fa6b55'); warnings.set(e.id, m); }
        m.position.set(e.cast.x, 0.03, e.cast.z); m.material.opacity = 0.65 + Math.sin(now * 0.02) * 0.3;
      }
      for (const [id, m] of warnings) if (!warnIds.has(id)) { dispose(m); warnings.delete(id); }
      const shotIds = new Set(state.projectiles.map(p => p.id)); for (const p of state.projectiles) { let m = shots.get(p.id); if (!m) { m = box(scene, p.x, 1.1, p.z, 0.3, 0.03, 0.2, '#e7dfca'); shots.set(p.id, m); } m.position.set(p.x, 1.1, p.z); m.rotation.y += dt * 10; }
      for (const [id, m] of shots) if (!shotIds.has(id)) { dispose(m); shots.delete(id); }
      state.objectives.forEach((o, i) => { markers[i].visible = !o.done; });
      exitRing.material.color.set(state.exitOpen ? '#9bdbca' : '#dfa76e');
    }
    for (let i = effects.length - 1; i >= 0; i--) { effects[i].time -= dt; effects[i].m.material.opacity = Math.max(0, effects[i].time * 2); if (effects[i].time <= 0) { dispose(effects[i].m); effects.splice(i, 1); } }
    office.traverse(o=>{if(o.isSprite)o.visible=!conversationId;});
    renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    ready, prepareAppearances, diagnostics() {return {environmentLoaded:!!environment,environmentSource:useModules?'modules-v0.1':'complete-gameplay-v0.8',loadError,revision:LEVEL.revision,characterRevision:LEVEL.characterRevision,actorAnimations:[...actors.values()].map(a=>({appearance:a.appearance,action:a.animation.current})),cameraMode:thirdPerson?'third':'first',firstPersonAppearance:hands.userData.appearance,firstPersonArms:realArms.diagnostics(),humanTemplates:[...humanTemplates.keys()],actors:[...actors.values()].map(a=>a.appearance),visibleActors:[...actors.values()].filter(a=>a.group.visible).map(a=>a.appearance),render:renderer.info.render};},
    toggleCamera(){thirdPerson=!thirdPerson;return thirdPerson;},setPredictedPosition(p){predictedPosition=p;},setState, setHome(value) { home = value; if (value) document.exitPointerLock?.(); }, requestLock,
    setConversation(npcId){conversationId=npcId;},
    unlock() { document.exitPointerLock?.(); }, onLock(fn) { onLock = fn; }, onStep(fn) { onStep = fn; },
    direction() { return { x: -Math.sin(yaw), z: -Math.cos(yaw),pitch,thirdPerson }; },
    clear() { realArms.clear();container.dataset.firstPersonArms='null';container.dataset.weaponAttachments='[]';conversationId=null;motionPose=null;predictedPosition=null;interpolation.reset();state = null; for (const map of [actors, items, shots, warnings]) { for (const m of map.values()) {m.mixer?.stopAllAction(); if(m.mixer)m.mixer.uncacheRoot(m.mixer.getRoot()); dispose(m.group || m);} map.clear(); } markers.forEach(m => { m.visible = true; }); },
  };
}
