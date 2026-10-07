"""Reopen authored source, compare actual exported bone transforms, render pilot."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/animations/weapon-grip-v2'
report = json.loads((OUT / 'manifest.json').read_text())
for name, key in [('weapon-grip-pilot.blend','blendSHA256'),('workplace-weapon-grip.glb','glbSHA256')]:
    assert hashlib.sha256((OUT/name).read_bytes()).hexdigest()==report[key], 'Validation input changed: '+name
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'weapon-grip-pilot.blend'))
s = bpy.context.scene
rig = next(o for o in s.objects if o.type == 'ARMATURE')
expected = {}
for clip in report['clips']:
    rig.animation_data.action = bpy.data.actions[clip['clip']]
    for t in rig.animation_data.nla_tracks:
        t.mute = True
    for frame in [0, 3, 6, clip['frames'] - 1]:
        s.frame_set(frame)
        bpy.context.view_layer.update()
        expected[(clip['clip'], frame)] = {name: rig.matrix_world @ rig.pose.bones[name].head for name in ['hand_r', 'hand_l', 'head', 'foot_r', 'foot_l'] + [f'{finger}_{i:02d}_r' for finger in ['index','middle','ring','pinky','thumb'] for i in [1,2,3]]}

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
camera.location = (-.7,-1.1,1.65)
camera.rotation_euler = (Vector((-.1,-.37,1.31))-camera.location).to_track_quat('-Z','Y').to_euler()
data.type = 'ORTHO'
data.ortho_scale = .55
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

# Actual weighted mesh contact, independent of virtual bone-tail objectives.
refs = json.loads((ROOT/'assets/animations/weapon-poses-v1/weapon-reference.json').read_text())
mesh_contacts = []
from mathutils import Matrix
for family in ['pistol', 'rifle']:
    rig.animation_data.action = bpy.data.actions['Weapon_'+family.title()+'Hold']
    s.frame_set(0)
    bpy.context.view_layer.update()
    ref = refs[family]
    grip = ref['grip']
    transform = Matrix.Rotation(grip['rotation'][2],4,'Z')
    transform.translation = Vector(grip['position'])
    part = next(p for p in ref['parts'] if p['name']=='握把')
    box = rig.matrix_world @ rig.pose.bones['hand_r'].matrix @ transform @ Matrix.Translation(Vector(part['pos'])) @ Matrix.Rotation(math.radians(part.get('tilt',0)),4,'Z')
    inverse = box.inverted()
    half = Vector(part['size'])/2
    stats = {f:{'weightedVertices':0,'verticesInsideGrip':0,'minimumSurfaceDistanceMetres':None} for f in ['index','middle','ring','pinky','thumb']}
    for obj in [o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]:
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        assert len(mesh.vertices)==len(obj.data.vertices), 'Contact mapping requires stable topology'
        groups = {g.index:g.name for g in obj.vertex_groups}
        for original, vertex in zip(obj.data.vertices,mesh.vertices):
            for finger, stat in stats.items():
                weight = sum(g.weight for g in original.groups if groups[g.group] in [f'{finger}_{i:02d}_r' for i in [1,2,3]])
                if weight<.5:continue
                point = inverse @ (evaluated.matrix_world @ vertex.co)
                distances = [abs(point[i])-half[i] for i in range(3)]
                stat['weightedVertices'] += 1
                if max(distances)<-.001:stat['verticesInsideGrip'] += 1
                distance = math.sqrt(sum(max(0,d)**2 for d in distances)) if max(distances)>=0 else -max(distances)
                old = stat['minimumSurfaceDistanceMetres']
                stat['minimumSurfaceDistanceMetres'] = distance if old is None else min(old,distance)
        evaluated.to_mesh_clear()
    mesh_contacts.append({'family':family,'fingers':stats,'method':'Evaluated skinned vertices with at least 0.5 summed finger weight; grip box strict interior with 1mm margin. Surface vertices only, not full triangle or volume collision.'})

# Actual GLB import; exporter may change rest bone axes but wrist positions must match.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT / 'workplace-weapon-grip.glb'))
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
result = {'sourceReload':True, 'actualGlbImport':True, 'bones':53,'poses':errors,'maximumPositionErrorMetres':max(max(e['positionErrorsMetres'].values()) for e in errors),'renders':['pistol-hold-source.png','rifle-hold-source.png'],'runtimeIntegrated':False,'meshContacts':mesh_contacts,'visualQA':{'accepted':False,'issues':['Fingers visibly intersect grip','Wrist and index posture need correction','Left support remains unrefined']}}
result['validatorSHA256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
result['inputBlendSHA256'] = report['blendSHA256']
result['inputGlbSHA256'] = report['glbSHA256']
report['validationFile'] = 'validation.json'
report['visualStatus'] = 'rejected'
report['limitations'] = [l for l in report['limitations'] if l != 'Source reload, GLB reimport and render verification pending'] + ['Actual runtime and all-costume checks pending','Visible mesh penetration: candidate rejected']
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(OUT/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('WEAPON_GRIP_SOURCE_AND_IMPORT_PASSED',result['maximumPositionErrorMetres'],flush=True)
