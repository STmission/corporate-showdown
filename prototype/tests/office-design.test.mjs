import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOOR, STATIONS, BENCHES, ROOMS, APPEARANCES, EVENT_SPACE, CENTRAL_LOUNGE } from '../shared/office-design.mjs';
test('office floor has exactly 52 unique stations in bounds',()=>{assert.equal(BENCHES.length,8);assert.equal(STATIONS.length,52);assert.equal(new Set(STATIONS.map(s=>s.id)).size,52);for(const s of STATIONS){assert.ok(Math.abs(s.x)<FLOOR.width/2);assert.ok(Math.abs(s.z)<FLOOR.depth/2);}});
test('all functional rooms fit the floor and sanitary rooms retain privacy',()=>{assert.equal(new Set(ROOMS.map(r=>r.id)).size,ROOMS.length);for(const r of ROOMS){assert.ok(Math.abs(r.x)+r.w/2<=FLOOR.width/2);assert.ok(Math.abs(r.z)+r.d/2<=FLOOR.depth/2);}assert.ok(ROOMS.filter(r=>['male','female'].includes(r.id)).every(r=>r.private));assert.equal(APPEARANCES.jobs.length*APPEARANCES.genders.length,8);});

test('one office wing remains and sanitary entrances face the central corridor',()=>{assert.ok(BENCHES.every(b=>b.x<0));const pantry=ROOMS.find(r=>r.id==='pantry');assert.ok(pantry.x-pantry.w/2>5);for(const gender of ['female','male']){const toilet=ROOMS.find(r=>r.id===gender),shower=ROOMS.find(r=>r.id===gender+'-shower');assert.ok(toilet.private&&shower.private);assert.equal(toilet.doorSide,gender==='female'?'right':'left');assert.equal(shower.doorSide,toilet.doorSide);assert.equal(toilet.z+toilet.d/2,shower.z-shower.d/2);}});

test('event seating stays inside the combined pantry with a clear center aisle',()=>{const r=ROOMS.find(r=>r.id==='pantry');assert.equal(EVENT_SPACE.seats.length,30);for(const seat of EVENT_SPACE.seats){assert.ok(Math.abs(seat.x-r.x)+.34<r.w/2);assert.ok(Math.abs(seat.z-r.z)+.34<r.d/2);assert.ok(Math.abs(seat.x-EVENT_SPACE.aisle.x)>.34+EVENT_SPACE.aisle.w/2);}assert.equal(new Set(EVENT_SPACE.seats.map(s=>s.id)).size,30);});

test('central lounge furniture leaves a continuous three-meter elevator aisle',()=>{assert.equal(CENTRAL_LOUNGE.islands.length,4);for(const f of CENTRAL_LOUNGE.furniture){assert.ok(Math.abs(f.x)-f.w/2>=CENTRAL_LOUNGE.aisleWidth/2);assert.ok(Math.abs(f.x)+f.w/2<5);assert.ok(f.z+f.d/2<-1.5);}});
