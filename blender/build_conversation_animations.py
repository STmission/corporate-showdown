"""Reusable authored conversation clips on the existing 53-bone workplace rig.
Keep all original character sources unchanged; export only armature animations.
"""
import bpy, math, hashlib, json
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/characters/professions-v1/female_doctor.blend'
OUT = ROOT / 'assets/animations/conversation-v1'
OUT.mkdir(parents=True, exist_ok=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source_hash = sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
scene.frame_set(1)
bpy.context.view_layer.update()
base = {b.name: b.matrix_basis.to_quaternion().copy() for b in rig.pose.bones}
for track in list(rig.animation_data.nla_tracks):
    rig.animation_data.nla_tracks.remove(track)
rig.animation_data.action = None
rig.name = 'Workplace_Conversation_Rig'
scene.render.fps = 24
clips = []
for name in ['Explain', 'Listen', 'Comfort']:
    action = bpy.data.actions.new('Conversation_' + name)
    action.use_fake_user = True
    rig.animation_data.action = action
    for frame in range(1, 98):
        t = (frame - 1) / 96
        pulse = math.sin(math.pi * t) ** 2
        left = math.sin(math.pi * min(1, t / .65)) ** 2 if t < .65 else 0
        right = math.sin(math.pi * max(0, (t - .35) / .65)) ** 2 if t > .35 else 0
        angles = {'head': ((1, 0, 0), -.05 * pulse), 'spine_02': ((1, 0, 0), .015 * pulse)}
        if name == 'Explain':
            angles.update({'upperarm_l': ((1, 0, 0), -.38 * left), 'lowerarm_l': ((1, 0, 0), -.58 * left), 'upperarm_r': ((1, 0, 0), -.22 * right), 'lowerarm_r': ((1, 0, 0), -.35 * right), 'head': ((0, 0, 1), .04 * math.sin(2 * math.pi * t) * pulse)})
        elif name == 'Comfort':
            angles.update({'upperarm_l': ((1, 0, 0), -.18 * pulse), 'lowerarm_l': ((1, 0, 0), -.32 * pulse), 'upperarm_r': ((1, 0, 0), -.12 * pulse), 'lowerarm_r': ((1, 0, 0), -.25 * pulse), 'head': ((1, 0, 0), -.075 * pulse)})
        else:
            angles.update({'lowerarm_l': ((1, 0, 0), -.10 * pulse), 'lowerarm_r': ((1, 0, 0), -.08 * pulse), 'head': ((1, 0, 0), -.06 * math.sin(2 * math.pi * t) * pulse)})
        for bone in rig.pose.bones:
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = base[bone.name]
            if bone.name in angles:
                axis, angle = angles[bone.name]
                local = bone.bone.matrix_local.to_quaternion().inverted() @ Vector(axis)
                bone.rotation_quaternion = Quaternion(local, angle) @ base[bone.name]
            bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
    track = rig.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, 0, action)
    track.mute = True
    clips.append(action.name)

rig.animation_data.action = bpy.data.actions[clips[0]]
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
glb = OUT / 'workplace-conversation.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True, use_active_scene=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=False, export_force_sampling=True, export_skins=True, export_morph=False, export_extras=True, export_cameras=False, export_lights=False)
scene['asset_stage'] = 'Authored conversation gestures; no lip sync or facial performance'
blend = OUT / 'workplace-conversation.blend'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
for name in ['Explain', 'Comfort']:
    rig.animation_data.action = bpy.data.actions['Conversation_' + name]
    scene.frame_set(34)
    scene.render.filepath = str(OUT / (name.lower() + '-source.png'))
    bpy.ops.render.render(write_still=True)
assert sha(SOURCE) == source_hash
report = {'version': 'conversation-v0.1', 'source': str(SOURCE.relative_to(ROOT)), 'sourceSHA256': source_hash, 'blend': str(blend.relative_to(ROOT)), 'blendSHA256': sha(blend), 'glb': str(glb.relative_to(ROOT)), 'glbSHA256': sha(glb), 'scriptSHA256': sha(Path(__file__)), 'bones': 53, 'clips': clips, 'durationSeconds': 4, 'status': 'exported; actual import and retarget validation pending', 'limitations': ['Authored gestures, not motion capture', 'No lip sync or facial expression', 'Original character proportions and meshes retained']}
(OUT / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('CONVERSATION_BANK_EXPORTED', flush=True)
