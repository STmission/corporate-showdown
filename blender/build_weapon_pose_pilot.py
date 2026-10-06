"""Author independent, editable weapon hold/shot pilot; original actors stay intact.
Two-link arm IK is baked into the existing 53-joint rig. No runtime IK claim.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/animations/weapon-poses-v1'
SOURCE = ROOT / 'assets/characters/grounded-v1/male_programmer.blend'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source_hash = sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
s = bpy.context.scene
s.render.fps = 24
rig = next(o for o in s.objects if o.type == 'ARMATURE')
for track in rig.animation_data.nla_tracks:
    track.mute = True
rig.animation_data.action = next(t.strips[0].action for t in rig.animation_data.nla_tracks if t.name == 'male_programmer_Idle')
s.frame_set(0)
bpy.context.view_layer.update()
base = {b.name: b.matrix_basis.copy() for b in rig.pose.bones}
for track in list(rig.animation_data.nla_tracks):
    rig.animation_data.nla_tracks.remove(track)
rig.animation_data.action = None
targets = {}
constraints = []
for side in ['r', 'l']:
    target = bpy.data.objects.new('握持目标_' + side, None)
    s.collection.objects.link(target)
    pole = bpy.data.objects.new('肘部方向_' + side, None)
    s.collection.objects.link(pole)
    pole.location = ((-.65 if side == 'r' else .65), -.1, 1.05)
    ik = rig.pose.bones['lowerarm_' + side].constraints.new('IK')
    ik.target = target
    ik.pole_target = pole
    ik.chain_count = 2
    ik.use_stretch = False
    ik.pole_angle = -math.pi / 2
    targets[side] = target
    constraints.append(ik)

# Gun +X becomes hand +Y; gun +Y becomes -hand +X, therefore hand -X is up.
hand_basis = Matrix(((0, 0, -1), (0, -1, 0), (-1, 0, 0)))
records = []
actions = []
for family in ['pistol', 'rifle']:
    for shot in [False, True]:
        name = ('Pistol' if family == 'pistol' else 'Rifle') + ('Shot' if shot else 'Hold')
        end = 12 if shot else 48
        rig.animation_data.action = None
        poses = []
        errors = []
        for frame in range(end + 1):
            for b in rig.pose.bones:
                b.matrix_basis = base[b.name]
            t = frame / end
            recoil = math.sin(math.pi * min(1, t / .35)) ** 2 if shot and t < .35 else 0
            right = Vector((-.10, -.28 + .025 * recoil, 1.30 + .008 * recoil))
            left = right + (Vector((.055, -.035, -.015)) if family == 'pistol' else Vector((.10, -.15, .04)))
            targets['r'].location = right
            targets['l'].location = left
            bpy.context.view_layer.update()
            for side in ['r', 'l']:
                hand = rig.pose.bones['hand_' + side]
                wrist = (rig.matrix_world @ hand.matrix).translation.copy()
                world = hand_basis.to_4x4()
                world.translation = wrist
                hand.matrix = rig.matrix_world.inverted() @ world
            bpy.context.view_layer.update()
            poses.append({b.name: b.matrix.copy() for b in rig.pose.bones})
            errors.append({side: (rig.matrix_world @ rig.pose.bones['hand_' + side].head - targets[side].location).length for side in ['r', 'l']})
        for c in constraints:
            c.mute = True
        action = bpy.data.actions.new('Weapon_' + name)
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame, pose in enumerate(poses):
            for b in rig.pose.bones:
                kwargs = {'parent_matrix': pose[b.parent.name], 'parent_matrix_local': b.parent.bone.matrix_local} if b.parent else {}
                b.matrix_basis = b.bone.convert_local_to_pose(pose[b.name], b.bone.matrix_local, invert=True, **kwargs)
                b.rotation_mode = 'QUATERNION'
            bpy.context.view_layer.update()
            for b in rig.pose.bones:
                b.keyframe_insert('location', frame=frame, group=b.name)
                b.keyframe_insert('rotation_quaternion', frame=frame, group=b.name)
                b.keyframe_insert('scale', frame=frame, group=b.name)
        bake_error = 0
        for frame, pose in enumerate(poses):
            s.frame_set(frame)
            bpy.context.view_layer.update()
            for b in rig.pose.bones:
                bake_error = max(bake_error, (b.matrix.translation - pose[b.name].translation).length)
        assert bake_error < .0005, (name, bake_error)
        track = rig.animation_data.nla_tracks.new()
        track.name = action.name
        track.strips.new(action.name, 0, action)
        track.mute = True
        for c in constraints:
            c.mute = False
        actions.append(action.name)
        records.append({'clip': action.name, 'duration': end / 24, 'samples': len(poses), 'maximumBakeErrorMetres': bake_error, 'initialElbows': {side: list(rig.matrix_world @ poses[0]['lowerarm_'+side].translation) for side in ['r','l']}, 'maximumWristErrorMetres': {side: max(e[side] for e in errors) for side in ['r', 'l']}})
        print('WEAPON_POSE_BAKED', records[-1], flush=True)
for c in constraints:
    c.mute = True
rig.animation_data.action = bpy.data.actions[actions[0]]
s.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bank = OUT / 'workplace-weapon-poses.glb'
bpy.ops.export_scene.gltf(filepath=str(bank), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=False, export_force_sampling=True, export_skins=True, export_cameras=False, export_lights=False)

references = json.loads((OUT / 'weapon-reference.json').read_text())
for family in ['pistol', 'rifle']:
    rig.animation_data.action = bpy.data.actions['Weapon_' + ('Pistol' if family == 'pistol' else 'Rifle') + 'Hold']
    s.frame_set(0)
    bpy.context.view_layer.update()
    group = bpy.data.objects.new('持握验证_' + family, None)
    s.collection.objects.link(group)
    hand = rig.pose.bones['hand_r']
    group.matrix_world = rig.matrix_world @ hand.matrix
    grip = references[family]['grip']
    parent = bpy.data.objects.new('原始武器挂点_' + family, None)
    s.collection.objects.link(parent)
    parent.parent = group
    parent.location = grip['position']
    parent.rotation_euler = grip['rotation']
    for part in references[family]['parts']:
        if part['shape'] == 'box':
            bpy.ops.mesh.primitive_cube_add(size=1)
            o = bpy.context.object
            o.scale = part['size']
            o.rotation_euler.z = math.radians(part.get('tilt', 0))
        else:
            bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=part['r'], depth=part['length'])
            o = bpy.context.object
            o.rotation_euler.y = math.pi / 2 if part.get('axis') == 'x' else 0
        o.name = part['name']
        o.parent = parent
        o.location = part['pos']
        mat = bpy.data.materials.new(family + '_' + part['name'])
        h = part['color'].lstrip('#')
        mat.diffuse_color = tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4)) + (1,)
        mat.use_nodes = True
        shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        shader.inputs['Base Color'].default_value = mat.diffuse_color
        shader.inputs['Metallic'].default_value = .35
        shader.inputs['Roughness'].default_value = .55
        o.data.materials.append(mat)
    group['pose_clip'] = rig.animation_data.action.name
    group.hide_render = family != 'rifle'
    for child in parent.children:
        child.hide_render = family != 'rifle'
rig.animation_data.action = bpy.data.actions['Weapon_RifleHold']
s.frame_set(0)
s['production_stage'] = 'Weapon pose pilot: baked IK; finger closure and runtime retarget pending'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'weapon-pose-pilot.blend'))
assert sha(SOURCE) == source_hash
(OUT / 'manifest.json').write_text(json.dumps({'version': 'weapon-poses-v0.1', 'source': str(SOURCE.relative_to(ROOT)), 'sourceSHA256': source_hash, 'generatorSHA256': sha(Path(__file__)), 'blendSHA256': sha(OUT / 'weapon-pose-pilot.blend'), 'glbSHA256': sha(bank), 'clips': records, 'runtimeIntegrated': False, 'limitations': ['Finger closure pending', 'No reload or moving aim clips', 'Only male programmer source authored', 'Actual GLB reimport and rendered validation pending']}, ensure_ascii=False, indent=2) + '\n')
