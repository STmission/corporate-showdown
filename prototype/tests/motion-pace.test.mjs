import test from 'node:test';import assert from 'node:assert/strict';import {MotionPace} from '../client/motion-pace.mjs';
test('presentation motion follows movement and settles on stop without animating teleports or inactive view changes',()=>{
 const pace=new MotionPace();assert.equal(pace.sample('a',{x:0,z:0},.02),0);
 for(let i=1;i<=30;i++)pace.sample('a',{x:i*.092,z:0},.02);
 assert.ok(Math.abs(pace.speed-4.6)<.01);
 for(let i=0;i<40;i++)pace.sample('a',{x:2.76,z:0},.02);
 assert.equal(pace.speed,0);
 assert.equal(pace.sample('a',{x:100,z:100},.02),0);
 assert.equal(pace.sample('b',{x:101,z:100},.02),0);
 assert.equal(pace.sample('b',{x:101.02,z:100},.02,false),0);
 assert.equal(pace.sample('b',{x:102,z:100},.02),0);
 assert.equal(pace.sample('b',{x:103,z:100},1),0);
 assert.equal(pace.sample('b',{x:NaN,z:0},.02),0);
});
