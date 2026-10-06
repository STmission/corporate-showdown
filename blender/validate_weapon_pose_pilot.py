"""Reopen authored source, compare actual exported bone transforms, render pilot."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/animations/weapon-poses-v1'
report = json.loads((OUT / 'manifest.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'weapon-pose-pilot.blend'))
s = bpy.context.scene
rig = next(o for o in s.objects if o.type == 'ARMATURE')
expected = {}
for clip in report['clips']:
    rig.animation_data.action = bpy.data.actions[clip['clip']]
    for t in rig.animation_data.nla_tracks:
        t.mute = True
    for frame in [0, 3, 6, round(clip['duration'] * 24)]:
        s.frame_set(frame)
        bpy.context.view_layer.update()
        expected[(clip['clip'], frame)] = {name: rig.matrix_world @ rig.pose.bones[name].head for name in ['hand_r', 'hand_l', 'head', 'foot_r', 'foot_l']}

# Render editable source with shared runtime weapon geometry, not a concept image.
s.world = bpy.data.worlds.new('武器姿势预览世界')
s.world.use_nodes = True
next(n for n in s.world.node_tree.nodes if n.type == 'BACKGROUND').inputs[1].default_value = .35
bpy.ops.mesh.primitive_plane_add(size=20)
floor = bpy.context.object
floor.location.z = -.002
material = bpy.data.materials.new('预览地面')
material.diffuse_color = (.22, .25, .29, 1)
floor.data.materials.append(material)
for name, loc, energy, size in [('主光', (2,-4,5),900,4), ('补光',(-3,-1,3),600,3)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.size = size
    o = bpy.data.objects.new(name, data)
    s.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
data = bpy.data.cameras.new('持握检查相机')
camera = bpy.data.objects.new('持握检查相机', data)
s.collection.objects.link(camera)
camera.location = (-2.4,-3.8,2.0)
camera.rotation_euler = (Vector((0,-.1,1.0))-camera.location).to_track_quat('-Z','Y').to_euler()
data.type = 'ORTHO'
data.ortho_scale = 2.3
s.camera = camera
s.render.engine = 'CYCLES'
s.cycles.samples = 16
s.cycles.use_denoising = True
s.render.resolution_x = 900
s.render.resolution_y = 1000
s.render.resolution_percentage = 100
for family in ['pistol','rifle']:
    rig.animation_data.action = bpy.data.actions['Weapon_'+family.title()+'Hold']
    s.frame_set(0)
    bpy.context.view_layer.update()
    for f in ['pistol','rifle']:
        group = bpy.data.objects['持握验证_'+f]
        group.matrix_world = rig.matrix_world @ rig.pose.bones['hand_r'].matrix
        group.hide_render = f != family
        for part in group.children[0].children:
            part.hide_render = f != family
    s.render.filepath = str(OUT / (family+'-hold-source.png'))
    bpy.ops.render.render(write_still=True)

# Actual GLB import; exporter may change rest bone axes but wrist positions must match.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT / 'workplace-weapon-poses.glb'))
s = bpy.context.scene
s.render.fps = 24
rig = next(o for o in s.objects if o.type == 'ARMATURE')
for t in rig.animation_data.nla_tracks:
    t.mute = True
errors = []
for (name,frame), positions in expected.items():
    track = next(t for t in rig.animation_data.nla_tracks if t.name == name)
    rig.animation_data.action = track.strips[0].action
    s.frame_set(frame)
    bpy.context.view_layer.update()
    measured = {n: (rig.matrix_world @ rig.pose.bones[n].head - v).length for n,v in positions.items()}
    errors.append({'clip':name,'frame':frame,'positionErrorsMetres':measured})
    assert max(measured.values()) < .002, (name, frame, measured)
assert len(rig.data.bones) == 53
result = {'sourceReload':True, 'actualGlbImport':True, 'bones':53,'poses':errors,'maximumPositionErrorMetres':max(max(e['positionErrorsMetres'].values()) for e in errors),'renders':['pistol-hold-source.png','rifle-hold-source.png'],'runtimeIntegrated':False}
(OUT/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('WEAPON_POSE_SOURCE_AND_IMPORT_PASSED',result['maximumPositionErrorMetres'],flush=True)
