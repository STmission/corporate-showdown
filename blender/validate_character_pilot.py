"""Reload source and actual GLB, verify skeleton/clips/textures and render the GLB."""
import bpy,json,struct,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/characters/pilot-v2'
manifest=json.loads((OUT/'manifest.json').read_text());blend=ROOT/manifest['blend'];glb=ROOT/manifest['glb']
bpy.ops.wm.open_mainfile(filepath=str(blend));s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE');meshes=[o for o in s.objects if o.type=='MESH']
assert len(rig.data.bones)==53 and len(meshes)==9
assert len(rig.animation_data.nla_tracks)==9
assert all(any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers) for o in meshes)
assert all(img.packed_file for img in bpy.data.images if img.source=='FILE')
assert max(abs(c) for c in rig.location)<1e-5
raw=glb.read_bytes();magic,version,total=struct.unpack_from('<4sII',raw);length,kind=struct.unpack_from('<I4s',raw,12);doc=json.loads(raw[20:20+length])
assert magic==b'glTF' and version==2 and total==len(raw) and kind==b'JSON'
assert len(doc['skins'])==1 and len(doc['skins'][0]['joints'])==53
assert len(doc['animations'])==9 and any(a['name']=='male_programmer_Talk' for a in doc['animations'])
assert next(m for m in doc['materials'] if 'high-poly' in m['name'])['alphaMode']=='BLEND'
for o in [rig,*meshes]:bpy.data.objects.remove(o,do_unlink=True)
prior_names={o.name for o in s.objects};bpy.ops.import_scene.gltf(filepath=str(glb));imported=[o for o in s.objects if o.name not in prior_names];print('IMPORTED_OBJECTS',[(o.name,o.type) for o in imported],flush=True)
import_rigs=[o for o in imported if o.type=='ARMATURE'];assert len(import_rigs)==1
r=import_rigs[0]
import_meshes=[o for o in imported if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==r for m in o.modifiers)];assert len(import_meshes)==9
helpers=[o for o in imported if o.type=='MESH' and o not in import_meshes]
custom_shapes={b.custom_shape.name for b in r.pose.bones if b.custom_shape}
assert all(o.name in custom_shapes for o in helpers),[o.name for o in helpers]
# Blender's importer creates a viewport-only bone widget absent from the GLB.
# Exclude that verified custom shape from the beauty render, not any asset mesh.
for o in helpers:o.hide_render=True
# Imported rest pose is not the relaxed clip; explicitly select Idle after GLB import.
r=import_rigs[0];idle=next(t for t in r.animation_data.nla_tracks if t.name=='male_programmer_Idle')
for t in r.animation_data.nla_tracks:t.mute=True
r.animation_data.action=idle.strips[0].action
s.frame_set(1);s.cycles.samples=16
cam=s.camera;cam.location=(.26,-1.42,1.69);cam.data.lens=68;cam.rotation_euler=(Vector((0,-.01,1.55))-cam.location).to_track_quat('-Z','Y').to_euler()
s.render.filepath=str(OUT/'portrait-glb.png');bpy.ops.render.render(write_still=True)
report={'sourceReload':True,'sourceBones':53,'sourceMeshes':9,'sourceClips':9,'gltfJoints':53,'gltfAnimations':[a['name'] for a in doc['animations']],'gltfEyeAlpha':'BLEND','gltfImportedMeshes':len(import_meshes),'gltfImportedBones':len(r.data.bones),'importerViewportHelpersExcluded':[o.name for o in helpers],'gltfRender':'portrait-glb.png','blendSHA256':hashlib.sha256(blend.read_bytes()).hexdigest(),'glbSHA256':hashlib.sha256(glb.read_bytes()).hexdigest(),'scope':'Blender source reload and actual GLB reimport/render; no Cocos/device acceptance'}
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
manifest['status']='Blender source reload and GLB reimport/render verified; runtime promotion pending'
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('PILOT_VALIDATED',flush=True)
