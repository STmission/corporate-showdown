import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';

test('platform PNG pipeline preserves scanlines/color/paths and refuses corrupted assets',async()=>{
 const {stderr}=await promisify(execFile)('python3',['platform/cocos/tools/test_optimize_png.py']);
 assert.match(stderr,/Ran 7 tests/);assert.match(stderr,/OK/);
});

test('platform glTF derivative keeps real character geometry, skeleton, actions and shared image bytes',async()=>{
 const {stderr}=await promisify(execFile)('python3',['platform/cocos/tools/test_externalize_gltf.py']);
 assert.match(stderr,/Ran 3 tests/);assert.match(stderr,/OK/);
});

test('conversation derivatives reject incompatible skeletons, unknown styles and duplicate clips',async()=>{
 const {stderr}=await promisify(execFile)('python3',['platform/cocos/tools/test_conversation_gltf.py']);
 assert.match(stderr,/Ran 3 tests/);assert.match(stderr,/OK/);
});


test('actual coastal cube pixels have complete source provenance and seam-matched adjacent faces',async()=>{
 const {stderr}=await promisify(execFile)('python3',['platform/cocos/tools/test_coastal_sky.py']);
 assert.match(stderr,/Ran 2 tests/);assert.match(stderr,/OK/);
});
