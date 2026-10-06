import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { characterAssetSlot } from '../shared/character-assets.mjs';
import { STORY_NPCS } from '../shared/story.mjs';
import { ANIMATION_NAMES } from '../shared/animation.mjs';

const file = path => new URL('../../' + path, import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('profession costume selects the authored doctor while preserving all playable gender/job combinations', () => {
  for (const gender of ['male', 'female']) for (const job of ['programmer', 'ecommerce', 'sales', 'celebrity']) {
    assert.equal(characterAssetSlot({ id: 'player', gender, job }), `${gender}_${job}`);
  }
  for (const npc of STORY_NPCS) assert.equal(characterAssetSlot(npc), npc.id === 'doctor' ? 'female_doctor' : npc.id === 'teacher' ? 'female_teacher' : `${npc.gender}_${npc.job}`);
  const doctor = STORY_NPCS.find(n => n.id === 'doctor');
  assert.equal(characterAssetSlot({ ...doctor, gender: 'male' }), 'male_ecommerce', 'no unfinished male doctor asset');
  assert.equal(characterAssetSlot({ ...doctor, id: 'another-person' }), 'female_ecommerce', 'profession labels alone do not replace player clothes');
  const teacher = STORY_NPCS.find(n => n.id === 'teacher');
  assert.equal(characterAssetSlot({ ...teacher, gender: 'male' }), 'male_programmer');
  assert.equal(characterAssetSlot({ ...teacher, id: 'player' }), 'female_programmer');
});

test('doctor library preserves source provenance, skin bindings, animation contract and embedded eye transparency', async () => {
  const manifest = JSON.parse(await readFile(file('assets/characters/professions-v1/manifest.json')));
  const validation = JSON.parse(await readFile(file('assets/characters/professions-v1/validation.json')));
  for (const [path, fingerprint] of [[manifest.source, manifest.sourceSHA256], [manifest.blend, manifest.blendSHA256], [manifest.glb, manifest.glbSHA256]]) {
    assert.equal(hash(await readFile(file(path))), fingerprint, path);
  }
  assert.equal(hash(await readFile(file('blender/build_doctor_character.py'))), manifest.scriptSHA256);
  assert.equal(validation.status, 'passed');
  assert.equal(validation.glbSHA256, manifest.glbSHA256);
  assert.equal(validation.blendSHA256, manifest.blendSHA256);
  const bytes = await readFile(file(manifest.glb));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.equal(gltf.skins.length, 1);
  assert.equal(gltf.skins[0].joints.length, 53);
  assert.equal(gltf.meshes.length, 15);
  assert.deepEqual(new Set(gltf.animations.map(a => a.name)), new Set(ANIMATION_NAMES.map(name => `female_doctor_${name}`)));
  for (const name of manifest.newAttachments) {
    const node = gltf.nodes.find(n => n.name === name);
    assert.ok(node, name);assert.equal(node.skin, 0, name);
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      assert.notEqual(primitive.attributes.JOINTS_0, undefined, name);
      assert.notEqual(primitive.attributes.WEIGHTS_0, undefined, name);
    }
  }
  for (const image of gltf.images) assert.notEqual(image.bufferView, undefined);
  const eyes = gltf.nodes.find(n => n.name === 'female_doctor_high-poly');
  assert.ok(eyes, 'authored MakeHuman high-poly eye mesh');
  for (const primitive of gltf.meshes[eyes.mesh].primitives) assert.equal(gltf.materials[primitive.material].alphaMode, 'BLEND');
});

test('teacher export preserves provenance and attaches transparent glasses to the head throughout the retained animation contract', async () => {
  const folder = 'assets/characters/professions-v1/teacher/';
  const manifest = JSON.parse(await readFile(file(folder + 'manifest.json')));
  const validation = JSON.parse(await readFile(file(folder + 'validation.json')));
  for (const [path, fingerprint] of [[manifest.source, manifest.sourceSHA256], [manifest.blend, manifest.blendSHA256], [manifest.glb, manifest.glbSHA256], ['blender/build_teacher_character.py', manifest.scriptSHA256]]) {
    assert.equal(hash(await readFile(file(path))), fingerprint, path);
  }
  assert.equal(validation.status, 'passed');
  assert.equal(validation.glbSHA256, manifest.glbSHA256);
  assert.equal(validation.blendSHA256, manifest.blendSHA256);
  assert.deepEqual(validation.poses.map(p => p.clip), ['Idle', 'Walk', 'Attack', 'Down']);
  const bytes = await readFile(file(manifest.glb));
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const length = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.toString('utf8', 20, 20 + length));
  const bin = bytes.subarray(28 + length);
  assert.equal(gltf.skins.length, 1);
  assert.equal(gltf.skins[0].joints.length, 53);
  assert.equal(gltf.meshes.length, 16);
  assert.deepEqual(new Set(gltf.animations.map(a => a.name)), new Set(ANIMATION_NAMES.map(n => `female_teacher_${n}`)));
  const head = gltf.skins[0].joints.findIndex(i => gltf.nodes[i].name === 'head');
  assert.ok(head >= 0);
  function values(index) {
    const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
    assert.equal(a.type, 'VEC4');
    assert.ok([5121, 5123, 5126].includes(a.componentType));
    const size = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1;
    return Array.from({length:a.count}, (_, i) => Array.from({length:4}, (_, c) => {
      const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i*(v.byteStride ?? size*4) + c*size;
      return a.componentType === 5126 ? bin.readFloatLE(offset) : a.componentType === 5123 ? bin.readUInt16LE(offset) : bin.readUInt8(offset);
    }));
  }
  for (const name of manifest.newAttachments) {
    const node = gltf.nodes.find(n => n.name === name);
    assert.equal(node?.skin, 0, name);
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const joints = values(primitive.attributes.JOINTS_0), weights = values(primitive.attributes.WEIGHTS_0);
      weights.forEach((w, i) => {assert.deepEqual(w, [1,0,0,0], name);assert.equal(joints[i][0], head, name);});
      if (name.includes('Lens')) {
        const material = gltf.materials[primitive.material];
        assert.equal(material.alphaMode, 'BLEND');
        assert.equal(material.doubleSided, true);
        assert.ok(material.pbrMetallicRoughness.baseColorFactor[3] < .15);
      }
    }
  }
  assert.ok(gltf.images.every(i => i.bufferView !== undefined));
});
