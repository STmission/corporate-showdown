"""Reopen authored source, compare actual exported bone transforms, render pilot."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/animations/weapon-grip-v3'
report = json.loads((OUT / 'manifest.json').read_text())
for name, key in [('weapon-grip-pilot.blend','blendSHA256'),('workplace-weapon-grip.glb','glbSHA256')]:
    assert hashlib.sha256((OUT/name).read_bytes()).hexdigest()==report[key], 'Validation input changed: '+name
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'weapon-grip-pilot.blend'))
s = bpy.context.scene
rig = next(o for o in s.objects if o.type == 'ARMATURE')
# Contact boxes must match the actual saved reference geometry, not only JSON.
from mathutils import Matrix
refs = json.loads((OUT/'weapon-reference.json').read_text())
for family, ref in refs.items():
    parent = bpy.data.objects['持握验证_'+family].children[0]
    socket = Matrix([ref['socketMatrixColumnMajor'][i::4] for i in range(4)])
    assert max(abs(parent.matrix_basis[r][c]-socket[r][c]) for r in range(4) for c in range(4))<1e-5
    for obj in parent.children:
        label = obj.name.rsplit('.',1)[0] if obj.name.rsplit('.',1)[-1].isdigit() else obj.name
        part = next(p for p in ref['parts'] if p['name']==label)
        assert (obj.location-Vector(part['pos'])).length<1e-5
        if part['shape']=='box':
            assert (obj.scale-Vector(part['size'])).length<1e-5
expected = {}
expected_skin = {}
for clip in report['clips']:
    rig.animation_data.action = bpy.data.actions[clip['clip']]
    for t in rig.animation_data.nla_tracks:
        t.mute = True
    for frame in [0, 3, 6, clip['frames'] - 1]:
        s.frame_set(frame)
        bpy.context.view_layer.update()
        expected[(clip['clip'], frame)] = {name: rig.matrix_world @ rig.pose.bones[name].head for name in ['hand_r', 'hand_l', 'head', 'foot_r', 'foot_l'] + [f'{finger}_{i:02d}_r' for finger in ['index','middle','ring','pinky','thumb'] for i in [1,2,3]]}
        expected_skin[(clip['clip'],frame)] = {b.name:rig.matrix_world @ b.matrix @ b.bone.matrix_local.inverted() @ rig.matrix_world.inverted() for b in rig.pose.bones}

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
    camera.location = (.6,-1.0,1.6)
    camera.rotation_euler = (Vector((-.1,-.37,1.31))-camera.location).to_track_quat('-Z','Y').to_euler()
    s.render.filepath = str(OUT / (family+'-hold-opposite.png'))
    bpy.ops.render.render(write_still=True)
    camera.location = (-.7,-1.1,1.65)
    camera.rotation_euler = (Vector((-.1,-.37,1.31))-camera.location).to_track_quat('-Z','Y').to_euler()

# Exact evaluated mesh contacts across every sampled hold/shot pose.
refs = json.loads((OUT/'weapon-reference.json').read_text())
from mathutils import Matrix

def inspect_contact(family, clip, frame):
    rig.animation_data.action = bpy.data.actions[clip]
    s.frame_set(frame)
    bpy.context.view_layer.update()
    ref = refs[family]
    transform = Matrix([ref['socketMatrixColumnMajor'][i::4] for i in range(4)])
    gun = rig.matrix_world @ rig.pose.bones['hand_r'].matrix @ transform
    forward = gun.to_quaternion() @ Vector((1,0,0))
    up = gun.to_quaternion() @ Vector((0,1,0))
    assert forward.dot(Vector((0,-1,0)))>.9999 and up.dot(Vector((0,0,1)))>.9999
    part = next(p for p in ref['parts'] if p['name']=='握把')
    inverse = (gun @ Matrix.Translation(Vector(part['pos'])) @ Matrix.Rotation(math.radians(part.get('tilt',0)),4,'Z')).inverted()
    half = Vector(part['size'])/2
    trigger = next(p for p in ref['parts'] if p['name']=='扳机')
    trigger_inverse = (gun @ Matrix.Translation(Vector(trigger['pos'])) @ Matrix.Rotation(math.radians(trigger.get('tilt',0)),4,'Z')).inverted()
    trigger_half = Vector(trigger['size'])/2
    stats = {f:{'weightedVertices':0,'verticesInsideGrip':0,'maximumPenetrationMetres':0,'minimumSurfaceDistanceMetres':None} for f in ['palm','index','middle','ring','pinky','thumb']}
    stats['index'].update(verticesInsideTrigger=0,minimumTriggerSurfaceDistanceMetres=None)
    for obj in [o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]:
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        assert len(mesh.vertices)==len(obj.data.vertices), 'Contact mapping requires stable topology'
        groups = {g.index:g.name for g in obj.vertex_groups}
        for original, vertex in zip(obj.data.vertices,mesh.vertices):
            for finger, stat in stats.items():
                wanted = ['hand_r'] if finger=='palm' else [f'{finger}_{i:02d}_r' for i in [1,2,3]]
                weight = sum(g.weight for g in original.groups if groups[g.group] in wanted)
                if weight<.5:continue
                world_point = evaluated.matrix_world @ vertex.co
                point = inverse @ world_point
                distances = [abs(point[i])-half[i] for i in range(3)]
                stat['weightedVertices'] += 1
                stat['maximumPenetrationMetres'] = max(stat['maximumPenetrationMetres'],max(0,-max(distances)))
                if max(distances)<-.001:stat['verticesInsideGrip'] += 1
                distance = math.sqrt(sum(max(0,d)**2 for d in distances)) if max(distances)>=0 else -max(distances)
                old = stat['minimumSurfaceDistanceMetres']
                stat['minimumSurfaceDistanceMetres'] = distance if old is None else min(old,distance)
                if finger=='index':
                    tp = trigger_inverse @ world_point
                    td = [abs(tp[i])-trigger_half[i] for i in range(3)]
                    if max(td)<-.001:stat['verticesInsideTrigger'] += 1
                    distance = math.sqrt(sum(max(0,d)**2 for d in td)) if max(td)>=0 else -max(td)
                    old = stat['minimumTriggerSurfaceDistanceMetres']
                    stat['minimumTriggerSurfaceDistanceMetres'] = distance if old is None else min(old,distance)
        evaluated.to_mesh_clear()
    return {'family':family,'clip':clip,'frame':frame,'weaponForward':list(forward),'weaponUp':list(up),'fingers':stats,'method':'Evaluated skinned vertices with at least 0.5 summed finger or palm weight; grip/trigger box strict interior with 1mm margin. Surface vertices only, not full triangle or volume collision.'}

mesh_contacts = []
for item in report['clips']:
    family = 'pistol' if 'Pistol' in item['clip'] else 'rifle'
    for frame in [0,3,6,item['frames']-1]:
        mesh_contacts.append(inspect_contact(family,item['clip'],frame))

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
    skin_errors = {}
    for bone_name, matrix in expected_skin[(name,frame)].items():
        bone = rig.pose.bones[bone_name]
        imported = rig.matrix_world @ bone.matrix @ bone.bone.matrix_local.inverted() @ rig.matrix_world.inverted()
        skin_errors[bone_name] = max((imported @ Vector(p)-matrix @ Vector(p)).length for p in [(0,0,0),(1,0,0),(0,1,0),(0,0,1)])
    assert max(skin_errors.values()) < .002, (name,frame,skin_errors)
    errors.append({'clip':name,'frame':frame,'positionErrorsMetres':measured,'skinTransformPointErrorsMetres':skin_errors})
    assert max(measured.values()) < .002, (name, frame, measured)
assert len(rig.data.bones) == 53
result = {'sourceReload':True, 'actualGlbImport':True, 'bones':53,'poses':errors,'maximumPositionErrorMetres':max(max(e['positionErrorsMetres'].values()) for e in errors),'maximumSkinTransformPointErrorMetres':max(max(e['skinTransformPointErrorsMetres'].values()) for e in errors),'renders':['pistol-hold-source.png','pistol-hold-opposite.png','rifle-hold-source.png','rifle-hold-opposite.png'],'runtimeIntegrated':False,'meshContacts':mesh_contacts,'visualQA':{'accepted':None,'status':'pending independent review of rendered files'}}
result['validatorSHA256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
result['inputBlendSHA256'] = report['blendSHA256']
result['inputGlbSHA256'] = report['glbSHA256']
result['inputReferenceSHA256'] = hashlib.sha256((OUT/'weapon-reference.json').read_bytes()).hexdigest()
result['referenceGeometryMatchesSource'] = True
report['validationFile'] = 'validation.json'
report['visualStatus'] = 'pending'
report['limitations'] = list(dict.fromkeys([l for l in report['limitations'] if l != 'Exact evaluated Blender mesh and independent import/render QA pending'] + ['Independent visual review pending','Actual runtime and all-costume checks pending']))
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(OUT/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('WEAPON_GRIP_SOURCE_AND_IMPORT_PASSED',result['maximumPositionErrorMetres'],flush=True)
