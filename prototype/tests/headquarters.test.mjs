import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LEVEL, floorHeight } from '../shared/level.mjs';
import { validPosition } from '../simulation.mjs';

test('first-level spawns, handovers, items and boss are reachable floor points',()=>{
  for(let i=0;i<4;i++)assert.ok(validPosition(LEVEL.spawn.x+i*.7,LEVEL.spawn.z));
  for(const p of [...LEVEL.objectives,...LEVEL.items,...LEVEL.enemies,LEVEL.boss,LEVEL.exit])assert.ok(validPosition(p.x,p.z),JSON.stringify(p));
  assert.equal(floorHeight(16,-15),.36); assert.equal(floorHeight(16,-13.4),.24); assert.equal(floorHeight(16,-13),.12);assert.equal(floorHeight(0,0),0);
});
test('central lounge aisle is open while glass partitions and elevator wall block movement',()=>{
  for(let z=-18;z<=1;z+=.5)assert.ok(validPosition(0,z),`aisle z=${z}`);
  assert.equal(validPosition(-5,-5),false); assert.equal(validPosition(5,-5),false);
  assert.equal(validPosition(0,2),false); assert.equal(validPosition(-5,.6),true);
});
test('all eight character exports retain a 53-bone skin, eight matching animations and opaque body', async()=>{
  for(const gender of ['male','female'])for(const job of ['programmer','ecommerce','sales','celebrity']){
    const slot=`${gender}_${job}`, b=await readFile(`assets/characters/${slot}.glb`);
    assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
    const g=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
    assert.equal(g.skins[0].joints.length,53);assert.deepEqual(g.animations.map(a=>a.name),['Idle','Walk','Run','Attack','Hit','Down','Rescue','Cast'].map(n=>`${slot}_${n}`));
    const body=g.materials.find(m=>m.name===`${slot}_Body.body`);assert.ok(body);assert.equal(body.alphaMode??'OPAQUE','OPAQUE');
    for(const name of ['thigh_l','thigh_r','upperarm_l','upperarm_r'])assert.ok(g.nodes.some(n=>n.name===name));
  }
});
