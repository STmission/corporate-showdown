import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,addPlayer,setReady,startRoom,acceptInput,stepRoom,snapshot} from '../simulation.mjs';
import {LEVEL} from '../shared/level.mjs';import {WEAPONS,WEAPON_PICKUPS,rayBox,traceRay,weaponRays} from '../shared/weapons.mjs';
import {validFloorPosition} from '../shared/headquarters-layout.mjs';
function game(){const r=createRoom('GUNS','single'),p=addPlayer(r,'p','玩家');setReady(r,p,true,r.loadoutRevision,LEVEL.revision,LEVEL.characterRevision);assert.ok(startRoom(r));return {r,p};}
function tick(r,p,input={},seconds=1/30){for(let i=0;i<Math.ceil(seconds*30);i++){assert.ok(acceptInput(p,{sequence:p.sequence+1,x:0,z:0,aimX:1,aimZ:0,...input},r.elapsed));stepRoom(r,1/30);}}
function equip(p,kind){const w=WEAPONS[kind];p.weapon=kind;p.inventory=[{kind,ammo:w.magazine,reserve:w.reserve,durability:w.durability}];p.fx=1;p.fz=0;}
function target(r,p,x=p.x+6,z=p.z){const e={id:'test-enemy',kind:'runner',x,z,hp:1000,maxHp:1000,attackCd:100,stunUntil:999,interruptUntil:0,phase:1,hitUntil:0,fx:0,fz:1};r.enemies=[e];return e;}

test('six gun categories and two melee pickups are reachable and acquired only once',()=>{
 const {r,p}=game();for(const i of WEAPON_PICKUPS)assert.ok(validFloorPosition(i.x,i.z));assert.equal(WEAPON_PICKUPS.length,8);
 const item=r.items.find(i=>i.kind==='pistol');p.x=item.x;p.z=item.z;tick(r,p,{interact:true},.4);assert.equal(p.weapon,'pistol');assert.equal(item.taken,true);assert.equal(p.inventory[0].ammo,12);
 tick(r,p,{interact:true},1);assert.equal(p.inventory.length,1);assert.equal(p.inventory[0].reserve,48);
 const smg=r.items.find(i=>i.kind==='smg');p.x=smg.x;p.z=smg.z;tick(r,p,{interact:true},.4);assert.equal(smg.taken,false,'a held interact cannot harvest a second gun');tick(r,p);tick(r,p,{interact:true},.4);assert.equal(p.weapon,'smg');assert.equal(p.inventory.length,2);
 tick(r,p,{weaponNext:true},1);assert.equal(p.weapon,'pistol');assert.equal(snapshot(r).players[0].inventory.length,2);
});

test('semi-automatic fire requires a release; automatic fire obeys cooldown and finite ammunition',()=>{
 for(const kind of ['pistol','smg']){const {r,p}=game();p.z=7;equip(p,kind);const e=target(r,p);tick(r,p,{attack:true},.5);const shots=r.eventJournal.filter(e=>e.kind==='shot');assert.equal(WEAPONS[kind].magazine-p.inventory[0].ammo,shots.length);if(kind==='pistol')assert.equal(shots.length,1);else assert.ok(shots.length>=4&&shots.length<=6);assert.ok(e.hp<1000);assert.equal(p.hp,100);}
 const {r,p}=game();p.z=7;equip(p,'smg');p.inventory[0].ammo=1;target(r,p);tick(r,p,{attack:true},1);assert.equal(p.inventory[0].ammo,0);assert.equal(r.eventJournal.filter(e=>e.kind==='shot').length,1);assert.ok(r.eventJournal.some(e=>e.kind==='empty'));
});

test('reload transfers finite reserves once and switch, disconnect or down cancels it',()=>{
 const {r,p}=game();equip(p,'pistol');p.inventory[0].ammo=2;p.inventory[0].reserve=3;tick(r,p,{reload:true});assert.ok(p.reloadUntil>r.elapsed);tick(r,p,{reload:true,attack:true},.4);assert.equal(p.inventory[0].ammo,2);assert.equal(r.eventJournal.filter(e=>e.kind==='shot').length,0);tick(r,p,{reload:true},2);assert.equal(p.inventory[0].ammo,5);assert.equal(p.inventory[0].reserve,0);assert.equal(r.eventJournal.filter(e=>e.kind==='reload').length,1);
 for(const stop of ['switch','disconnect','down']){const {r,p}=game();equip(p,'pistol');p.inventory[0].ammo=1;p.inventory.push({kind:'rifle',ammo:30,reserve:90,durability:0});tick(r,p,{reload:true});if(stop==='switch')tick(r,p,{weaponNext:true});else if(stop==='disconnect'){p.connected=false;stepRoom(r,.1);}else{p.state='down';p.downUntil=50;stepRoom(r,.1);}assert.equal(p.reloadUntil,0);assert.equal(p.inventory[0].ammo,1);}
});

test('guns cannot be thrown and melee durability is retained across inventory switches',()=>{
 const {r,p}=game();equip(p,'pistol');tick(r,p,{throw:true},1);assert.equal(p.weapon,'pistol');assert.equal(r.projectiles.length,0);assert.equal(p.inventory[0].ammo,12);
 equip(p,'hammer');p.inventory.push({kind:'scissors',ammo:0,reserve:0,durability:24});tick(r,p,{attack:true});assert.equal(p.inventory[0].durability,17);tick(r,p,{weaponNext:true});assert.equal(p.weapon,'scissors');tick(r,p);tick(r,p,{weaponNext:true});assert.equal(p.weapon,'hammer');assert.equal(p.durability,17);
});

test('3D rays stop at the nearest wall and distinguish ground, high aim and friendly NPCs',()=>{
 const origin={x:0,y:1.55,z:0},direction={x:1,y:0,z:0},enemy={id:'enemy',x:5,z:0,hp:100},wall={id:'test-wall',x:2,z:0,w:.1,d:3,h:3};assert.equal(traceRay(origin,direction,10,[enemy],[wall]).entity,null);assert.ok(traceRay(origin,direction,10,[enemy],[wall]).blocked);assert.equal(traceRay(origin,direction,10,[enemy],[]).entity.id,'enemy');assert.equal(traceRay(origin,{x:0,y:1,z:0},10,[enemy],[]).entity,null);assert.equal(rayBox(origin,direction,{min:{x:2,y:0,z:-1},max:{x:3,y:3,z:1}},10),2);
 const {r,p}=game();p.z=7;equip(p,'sniper');p.input={pitch:1.1,thirdPerson:true};const e=target(r,p);assert.equal(weaponRays(p,WEAPONS.sniper,[e],1)[0].entity,null);
 p.input={pitch:0,thirdPerson:false};const friendly={id:'friend',x:p.x+2,z:p.z,hp:100};assert.equal(weaponRays(p,WEAPONS.sniper,[e,friendly],1)[0].entity.id,'friend');r.npcs=[friendly];tick(r,p,{attack:true});assert.equal(e.hp,1000);assert.equal(friendly.hp,100);
});

test('invalid pitch and replayed input cannot supply ammunition or client-chosen hit results',()=>{
 const {r,p}=game();equip(p,'pistol');assert.equal(acceptInput(p,{sequence:0,x:0,z:0,pitch:Infinity},0),false);assert.equal(acceptInput(p,{sequence:0,x:0,z:0,pitch:2},0),false);assert.equal(p.sequence,-1);tick(r,p,{attack:true,ammo:10000,damage:10000,hitEnemy:'teacher'});assert.equal(p.inventory[0].ammo,11);assert.equal(acceptInput(p,{sequence:p.sequence,x:0,z:0,attack:true},r.elapsed),false);
});

test('tap pickup works in one authority tick and never performs a downed self-revive',()=>{const {r,p}=game();tick(r,p,{pickup:true,aimX:0,aimZ:-1});assert.equal(p.weapon,'pistol');assert.equal(p.inventory.length,1);p.state='down';p.downUntil=r.elapsed+20;p.hp=0;tick(r,p,{pickup:true},3.5);assert.equal(p.state,'down');assert.equal(p.hp,0);assert.equal(p.revives,0);});

test('a released short action survives until one tick, while modal cancellation and replay cannot queue it again',()=>{const {r,p}=game();const input={sequence:0,x:0,z:0,aimX:0,aimZ:-1,pickup:true};assert.ok(acceptInput(p,input,r.elapsed));assert.ok(acceptInput(p,{...input,sequence:1,pickup:false},r.elapsed));stepRoom(r,1/30);assert.equal(p.weapon,'pistol');assert.equal(p.inventory.length,1);assert.equal(acceptInput(p,input,r.elapsed),false);
 assert.ok(acceptInput(p,{...input,sequence:2,pickup:false,attack:true},r.elapsed));assert.ok(acceptInput(p,{...input,sequence:3,pickup:false,attack:false},r.elapsed));stepRoom(r,1/30);assert.equal(p.inventory[0].ammo,11);
 assert.ok(acceptInput(p,{...input,sequence:4,pickup:false,attack:true},r.elapsed));assert.ok(acceptInput(p,{...input,sequence:5,pickup:false,cancelActions:true},r.elapsed));stepRoom(r,.4);assert.equal(p.inventory[0].ammo,11);assert.equal(snapshot(r).players[0].pendingActions,undefined);});
