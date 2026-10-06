"""Reload editable conversation source and actually import its animation-only GLB."""
import bpy, json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/animations/conversation-v1'
manifest=json.loads((OUT/'manifest.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for key in ['source','blend','glb']:
    assert sha(ROOT/manifest[key])==manifest[key+'SHA256']
bpy.ops.wm.open_mainfile(filepath=str(ROOT/manifest['blend']))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
assert len(rig.data.bones)==53
assert {t.name for t in rig.animation_data.nla_tracks}==set(manifest['clips'])
for track in rig.animation_data.nla_tracks:track.mute=True
checked=[]
for name in manifest['clips']:
    rig.animation_data.action=next(t for t in rig.animation_data.nla_tracks if t.name==name).strips[0].action
    for frame in [1,24,48,72,97]:
        scene.frame_set(frame);bpy.context.view_layer.update()
        assert all(all(abs(v)<3 for v in bone.matrix.translation) for bone in rig.pose.bones)
        checked.append({'clip':name,'frame':frame})
# Blender recognizes the exported armature even though the GLB has no mesh/skin.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/manifest['glb']))
objects=list(bpy.context.scene.objects)
rigs=[o for o in objects if o.type=='ARMATURE']
assert len(rigs)==1 and len(rigs[0].data.bones)==53
shapes={b.custom_shape for b in rigs[0].pose.bones if b.custom_shape}
assert all(o in shapes for o in objects if o.type=='MESH'), 'unexpected exported mesh'
tracks={t.name for t in rigs[0].animation_data.nla_tracks}
assert set(manifest['clips'])==tracks,tracks
report={'status':'passed','sourceReload':True,'sourceBones':53,'checkedSourcePoses':checked,'actualGLBImport':True,'importedBones':53,'importerDisplayMeshes':len(shapes),'importedClips':sorted(tracks),'glbSHA256':manifest['glbSHA256'],'scope':'source reload and animation-only GLB actual import; runtime retarget and visual quality checked separately'}
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('CONVERSATION_BANK_VALIDATED',flush=True)
