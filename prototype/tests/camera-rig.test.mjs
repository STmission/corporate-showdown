import test from 'node:test';import assert from 'node:assert/strict';import {cameraPose,cameraAvatarVisible} from '../shared/camera-rig.mjs';
test('first and third person cameras share player anchor, with wall-safe shoulder orbit',()=>{
 const input={x:0,z:0,ground:.3};let p=cameraPose({...input,thirdPerson:false});assert.equal(p.y,1.98);assert.equal(p.distance,0);
 p=cameraPose(input);assert.ok(p.z>3&&p.x>0);assert.ok(p.distance>3);
 const walls=[{x:0,z:1.5,w:4,d:.1,h:3.45}];p=cameraPose({...input,walls});assert.ok(p.z<1.3&&p.z>0);assert.ok(p.distance<1.4);
 p=cameraPose({...input,yaw:Math.PI/2});assert.ok(p.x>3&&p.z<0);
 p=cameraPose({...input,pitch:1.15,down:true});assert.ok(p.y>=.55,'upward orbit must not place camera below the floor');
 p=cameraPose({...input,walls:[{x:0,z:1.5,w:4,d:.1,h:.5}]});assert.ok(p.z>3,'low obstacle below the entire camera segment must not shorten it');
 p=cameraPose({...input,walls:[{x:0,z:0,w:4,d:4,h:3}]});assert.equal(p.distance,0,'embedded anchor safely collapses orbit');
});

test('near-wall local silhouette is hidden without changing orbit or perspective, and restores with hysteresis',()=>{
 const walls=[{x:0,z:1.5,w:4,d:.1,h:3.45}];
 const open=cameraPose({x:0,z:0}),close=cameraPose({x:0,z:1.1,walls});
 assert.ok(close.distance<.9);assert.equal(cameraAvatarVisible(close.distance),false);
 assert.equal(cameraAvatarVisible(open.distance,false),true);
 assert.equal(cameraAvatarVisible(1.05,true),true);assert.equal(cameraAvatarVisible(1.05,false),false);
 assert.equal(cameraAvatarVisible(.9,true),false);assert.equal(cameraAvatarVisible(1.2,false),true);
 assert.equal(cameraAvatarVisible(NaN),false);
 const first=cameraPose({x:0,z:0,thirdPerson:false});assert.equal(cameraAvatarVisible(first.distance),false);
 assert.deepEqual(cameraPose({x:0,z:1.1,walls}),close,'visibility decisions cannot change player or camera collision');
});
