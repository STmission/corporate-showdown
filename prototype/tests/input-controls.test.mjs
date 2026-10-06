import test from 'node:test';
import assert from 'node:assert/strict';
import {InputControls} from '../client/input-controls.mjs';

test('input controls preserve quick action taps but cancel them on modal, hide and touch cancellation',()=>{
 const c=new InputControls();c.press('attack');assert.equal(c.next().attack,false);
 c.setActive(true);c.press('attack');c.release('attack');assert.equal(c.next().attack,true);assert.equal(c.next().attack,false);
 c.press('skill');c.release('skill',{cancel:true});assert.equal(c.next().skill,false);
 c.press('forward');c.press('dodge');c.setActive(false);assert.equal(c.next().z,0);assert.equal(c.next().dodge,false);
 c.press('attack');c.setActive(true);assert.equal(c.next().attack,false);assert.equal(c.next().z,0);
 c.press('interact');c.release('interact');assert.equal(c.next().interact,false,'duration-based interaction must not be extended by a tap queue');
 c.press('attack');c.press('attack');assert.equal(c.next().attack,true);assert.equal(c.next().attack,true,'holding retains existing repeat semantics');
 c.release('attack');assert.equal(c.next().attack,false);
 c.press('forward');c.press('forward','touch');c.release('forward',{source:'touch'});assert.equal(c.next().z,-1,'a touch release must not cancel keyboard movement');c.release('forward');assert.equal(c.next().z,0);
});

test('input direction stays normalized and follows camera yaw; opposing keys and unknown controls are inert',()=>{
 const c=new InputControls();c.setActive(true);c.press('forward');c.press('right');let p=c.next();assert.ok(Math.abs(Math.hypot(p.x,p.z)-1)<1e-12);assert.ok(p.x>0&&p.z<0);
 c.release('right');p=c.next(90);assert.ok(p.x<-.99&&Math.abs(p.z)<1e-12);
 c.press('back');p=c.next();assert.equal(p.x,0);assert.equal(p.z,0);
 c.clear();c.press('unknown');p=c.next(NaN);assert.equal(p.x,0);assert.equal(p.z,0);assert.equal(p.aimZ,-1);assert.equal(p.unknown,undefined);
});

test('every discrete action is recognized and survives a short press',()=>{const c=new InputControls();c.setActive(true);for(const action of ['attack','skill','dodge','throw','transform','reload','weaponNext','pickup']){c.press(action);c.release(action);assert.equal(c.next()[action],true,action);assert.equal(c.next()[action],false,action+' consumed');}});


test('direction taps between samples survive once, held releases add no drift, and opposing pulses cancel',()=>{
 const c=new InputControls();c.setActive(true);
 for(const [key,x,z]of [['forward',0,-1],['back',0,1],['left',-1,0],['right',1,0]]){c.press(key);c.release(key);let intent=c.next();assert.equal(intent.x,x);assert.equal(intent.z,z);intent=c.next();assert.equal(intent.x,0);assert.equal(intent.z,0);}
 c.press('forward');assert.equal(c.next().z,-1);c.release('forward');assert.equal(c.next().z,0,'an observed hold must stop immediately');
 c.press('forward');c.release('forward');c.press('back');c.release('back');assert.equal(c.next().z,0);
 c.press('forward');c.release('forward');assert.ok(c.next(90).x<-.99);
});

test('cancelled movement pulses do not cross modal boundaries or cancel another source',()=>{
 const c=new InputControls();c.setActive(true);c.press('forward','keyboard');c.release('forward',{source:'keyboard'});c.press('forward','touch');c.release('forward',{source:'touch',cancel:true});assert.equal(c.next().z,-1);
 c.press('forward','touch');c.release('forward',{source:'touch',cancel:true});assert.equal(c.next().z,0);
 c.press('right');c.release('right');c.setActive(false);c.setActive(true);assert.equal(c.next().x,0);
 c.press('interact');c.release('interact');assert.equal(c.next().interact,false);
});
