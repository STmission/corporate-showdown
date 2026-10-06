import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL } from '../shared/level.mjs';
import { createRoom, addPlayer, setReady, startRoom, acceptInput, stepRoom, damagePlayer, finishRoom, remaining, snapshot, validPosition } from '../simulation.mjs';

function game(count = 1) {
  const room = createRoom('TEST01');
  for (let i = 0; i < count; i++) { const p = addPlayer(room, `p${i}`, `员工${i}`); }
  for(const p of room.players)setReady(room,p,true,room.loadoutRevision,LEVEL.revision,LEVEL.characterRevision);
  assert.equal(startRoom(room), true);
  return room;
}
function run(room, seconds, input = {}) {
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    for (const p of room.players) acceptInput(p, { sequence: p.sequence + 1, x: 0, z: 0, ...input }, room.elapsed);
    stepRoom(room, 1 / 30);
  }
}
test('loading/lobby does not use the countdown and every member must be ready', () => {
  const r = createRoom('WAIT'); addPlayer(r, 'a', 'A'); stepRoom(r, 20);
  assert.equal(r.elapsed, 0); assert.equal(startRoom(r), false);
  setReady(r,r.players[0],true,r.loadoutRevision,LEVEL.revision,LEVEL.characterRevision); assert.equal(startRoom(r), true);
});
test('normal damage does not penalize time; delay penalties have cooldown and cap', () => {
  const r = game(), p = r.players[0]; p.hp = 10000;
  damagePlayer(r, p, 10); assert.equal(r.penalty, 0);
  r.elapsed += 1; damagePlayer(r, p, 1, true); assert.equal(r.penalty, 3);
  r.elapsed += 1; damagePlayer(r, p, 1, true); assert.equal(r.penalty, 3);
  for (let i = 0; i < 15; i++) { r.elapsed += 6; damagePlayer(r, p, 1, true); }
  assert.equal(r.penalty, 30);
});
test('invalid or duplicate inputs cannot move players, accelerate time, or change hp', () => {
  const r = game(), p = r.players[0];
  assert.equal(acceptInput(p, { sequence: 0, x: Infinity, z: 0 }, 0), false);
  assert.equal(acceptInput(p, { sequence: 0, x: 1, z: 1, hp: 9999, elapsed: -100 }, 0), true);
  assert.equal(Math.hypot(p.input.x, p.input.z), 1);
  assert.equal(acceptInput(p, { sequence: 0, x: -1, z: 0 }, 0), false);
  assert.equal(p.hp, 100); assert.equal(r.elapsed, 0);
});
test('desk collisions prevent moving through the level geometry', () => {
  const r = game(), p = r.players[0]; r.enemies = [];
  const desk=LEVEL.desks[0]; p.x=desk.x+2.5; p.z=desk.z-desk.d/2-.5; run(r, 1, {z:1});
  assert.equal(validPosition(p.x, p.z), true); assert.ok(p.z <= desk.z-desk.d/2-.36);
});
test('exit is locked until objectives and boss are resolved', () => {
  const r = game(), p = r.players[0]; r.enemies = []; p.x = LEVEL.exit.x; p.z = LEVEL.exit.z;
  run(r, 2, { interact: true }); assert.equal(p.state, 'active'); assert.equal(r.exitOpen, false);
});
test('objective interaction is shared and only produces one completion', () => {
  const r = game(2); r.enemies = [];
  for (const p of r.players) { p.x = r.objectives[0].x; p.z = r.objectives[0].z; }
  run(r, 3, { interact: true });
  assert.equal(r.objectives[0].done, true); assert.equal(r.objectives[1].done, false);
  assert.equal(r.events.filter(e => e.text.includes('提交最终文件 · 已完成')).length, 1);
  assert.equal(r.players[0].energy, 15); assert.equal(r.players[1].energy, 15);
});
test('two players cannot acquire the same item', () => {
  const r = game(2); r.enemies = [];
  const item = r.items.find(i => i.kind === 'keyboard');
  for (const p of r.players) { p.x = item.x; p.z = item.z; }
  run(r, 1, { interact: true });
  assert.equal(r.players.filter(p => p.weapon === 'keyboard').length, 1);
  assert.equal(item.taken, true);
});
test('thrown office items damage enemies and never damage teammates', () => {
  const r = game(2), [p, q] = r.players, e = r.enemies[0];
  r.enemies = [e]; e.x = p.x + 1.3; e.z = p.z; e.attackCd = 10;
  q.x = p.x + 0.7; q.z = p.z;
  p.weapon = 'keyboard'; p.durability = 3; p.fx = 1; p.fz = 0;
  const hp = e.hp;
  run(r, 0.5, { throw: true });
  assert.equal(p.weapon, null); assert.equal(e.hp, hp - 40); assert.equal(q.hp, 100);
});
test('elapsed inputs expire rather than continuing to move after a browser is hidden', () => {
  const r = game(), p = r.players[0]; r.enemies = [];
  acceptInput(p, { sequence: 0, x: 1, z: 0 }, 0);
  for (let i = 0; i < 60; i++) stepRoom(r, 1 / 30);
  assert.ok(p.x - LEVEL.spawn.x < 1.5);
  assert.ok(remaining(r) < 299);
});
test('first-person aim stays independent of strafe movement', () => {
  const r = game(), p = r.players[0]; r.enemies = [];
  run(r, 0.5, { x: 1, aimX: 0, aimZ: -1 });
  assert.ok(p.x > LEVEL.spawn.x); assert.equal(p.fx, 0); assert.equal(p.fz, -1);
});
test('first-person melee cannot auto-turn to hit an enemy behind the player', () => {
  const r = game(), p = r.players[0], e = r.enemies[0]; r.enemies = [e];
  e.x = p.x; e.z = p.z + 1.2; e.attackCd = 10;
  run(r, 0.1, { attack: true, aimX: 0, aimZ: -1 });
  assert.equal(e.hp, e.maxHp); assert.equal(p.fz, -1);
});
test('first-person handover requires facing the nearby target', () => {
  const r = game(), p = r.players[0], o = r.objectives[0]; r.enemies = [];
  p.x = o.x; p.z = o.z + 1.3;
  run(r, 2.5, { interact: true, aimX: 0, aimZ: 1 }); assert.equal(o.done, false);
  run(r, 2.5, { interact: true, aimX: 0, aimZ: -1 }); assert.equal(o.done, true);
});
test('a disconnected player stops input, time continues and expires after 60 seconds', () => {
  const r = game(2), p = r.players[0]; r.enemies = [];
  acceptInput(p, { sequence: 0, x: 1, z: 0 }, r.elapsed);
  p.connected = false; p.disconnectedAt = 0;
  const x = p.x; run(r, 61);
  assert.equal(p.x, x); assert.equal(p.state, 'left'); assert.ok(remaining(r) < 240);
});
test('single-player self rescue is free and only available once', () => {
  const r = game(), p = r.players[0]; r.enemies = [];
  damagePlayer(r, p, 100); run(r, 3.1, { interact: true });
  assert.equal(p.state, 'active'); assert.equal(p.hp, 40); assert.equal(p.revives, 1);
  r.elapsed += 2; damagePlayer(r, p, 100); stepRoom(r, 1 / 30);
  assert.equal(r.status, 'ended'); assert.equal(r.result.success, false);
});
test('cooperative rescue restores teammates without duplicating completion', () => {
  const r = game(2); r.enemies = [];
  const [p, q] = r.players; q.x = p.x; q.z = p.z; damagePlayer(r, q, 100);
  run(r, 3.1, { interact: true });
  assert.equal(q.state, 'active'); assert.equal(q.hp, 40); assert.equal(p.saved, 1);
});
test('timeout resolves once and preserves an already-extracted player', () => {
  const r = game(2); r.enemies = []; r.players[0].state = 'extracted'; r.elapsed = 299.9;
  run(r, 0.2);
  assert.equal(r.status, 'ended'); assert.equal(r.result.success, true); assert.equal(r.result.all, false);
  const original = r.result; finishRoom(r, 'resolved'); stepRoom(r, 1);
  assert.equal(r.result, original); assert.equal(r.result.reason, 'timeout'); assert.equal(remaining(r), 0);
});
test('both handovers summon a boss once, and snapshot does not expose raw input', () => {
  const r = game(); r.objectives.forEach(o => o.done = true); run(r, 0.2);
  assert.equal(r.enemies.filter(e => e.kind === 'boss').length, 1);
  assert.equal('input' in snapshot(r).players[0], false);
});
for (const count of [1, 2, 4]) test(`natural ${count}-player first-level route can complete through real interactions and combat`, () => {
  const r = game(count);
  const route = [{...LEVEL.objectives[0],objective:0}, {x:-7,z:5.8}, {x:-7,z:.6}, {...LEVEL.objectives[1],objective:1}, {x:0,z:.6}, {x:0,z:-2.5}];
  let waypoint = 0;
  for (let tick = 0; tick < 300 * 30 && r.status === 'running'; tick++) {
    const p = r.players[0], boss = r.enemies.find(e => e.kind === 'boss' && e.hp > 0);
    let goal = waypoint < route.length ? route[waypoint] : boss || LEVEL.exit;
    const near = Math.hypot(p.x - goal.x, p.z - goal.z) < 0.4;
    if (waypoint < route.length && near && (goal.objective === undefined || r.objectives[goal.objective].done)) waypoint++;
    for (const q of r.players) {
      const dx = goal.x - q.x, dz = goal.z - q.z, d = Math.hypot(dx, dz);
      const attackingBoss = waypoint >= route.length && boss && d < 1.7;
      const stop = d < 0.3 || attackingBoss;
      acceptInput(q, { sequence: q.sequence + 1, x: stop ? 0 : dx / Math.max(1, d), z: stop ? 0 : dz / Math.max(1, d), attack: true, skill: true, interact: true, transform: true, dodge: false }, r.elapsed);
    }
    stepRoom(r, 1 / 30);
  }
  assert.equal(r.result?.all, true, JSON.stringify({ result: r.result, players: r.players.map(p => ({ x: p.x, z: p.z, hp: p.hp, state: p.state })), waypoint }));
});
