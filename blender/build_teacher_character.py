"""Independent teacher costume; retain source provenance and the animation skeleton."""
import bpy, math, json, hashlib, struct, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/characters/library-v1/female_programmer.blend'
OUT = ROOT / 'assets/characters/professions-v1/teacher'
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'female_teacher'
sys.path.insert(0, str(ROOT / 'blender'))
from normalize_glb import normalize

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

source_hash = sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
scene.frame_set(1)
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
meshes = [o for o in scene.objects if o.type == 'MESH']
for o in [rig, *meshes]:
    o.name = o.name.replace('female_programmer', KEY)
for material in bpy.data.materials:
    material.name = material.name.replace('female_programmer', KEY)
for track in rig.animation_data.nla_tracks:
    track.name = track.name.replace('female_programmer', KEY)
    for strip in track.strips:
        strip.name = strip.name.replace('female_programmer', KEY)
        strip.action.name = strip.action.name.replace('female_programmer', KEY)
if rig.animation_data.action:
    rig.animation_data.action.name = rig.animation_data.action.name.replace('female_programmer', KEY)

def material(name, color, roughness=.8, metallic=0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = next(n for n in result.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return result

top = material('Teacher_Ivory_Woven_Top', (.80, .75, .65), .88)
skirt = material('Teacher_Sage_Skirt', (.12, .19, .16), .88)
frame_material = material('Teacher_Brushed_Bronze', (.22, .13, .07), .38, .72)
lens = material('Teacher_Clear_Lenses', (.88, .94, .96), .13)
shader = next(n for n in lens.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
shader.inputs['Alpha'].default_value = .08
shader.inputs['Specular IOR Level'].default_value = .24
cloth = next(o for o in meshes if 'elegantsuit' in o.name)
cloth.data = cloth.data.copy()
cloth.data.materials.clear()
cloth.data.materials.append(skirt)
cloth.data.materials.append(top)
for polygon in cloth.data.polygons:
    # Original source has a skirt island and a separate long-sleeve top island.
    polygon.material_index = 1 if max((cloth.matrix_world @ cloth.data.vertices[i].co).z for i in polygon.vertices) > .995 else 0
    polygon.use_smooth = True
# Preserve mesh islands at the waist rather than painting a horizontal cut through the top.
adjacency = {v.index: set() for v in cloth.data.vertices}
for edge in cloth.data.edges:
    a, b = edge.vertices
    adjacency[a].add(b)
    adjacency[b].add(a)
seen, upper = set(), set()
for start in adjacency:
    if start in seen:
        continue
    queue, component = [start], []
    seen.add(start)
    while queue:
        i = queue.pop()
        component.append(i)
        for j in adjacency[i]:
            if j not in seen:
                seen.add(j)
                queue.append(j)
    if max((cloth.matrix_world @ cloth.data.vertices[i].co).z for i in component) > 1.2:
        upper.update(component)
for polygon in cloth.data.polygons:
    polygon.material_index = 1 if polygon.vertices[0] in upper else 0

accessories = []
def bind_head(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if obj.type != 'MESH':
        bpy.ops.object.convert(target='MESH')
        obj = bpy.context.object
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.matrix_world = world
    modifier = obj.modifiers.new('Teacher_Armature', 'ARMATURE')
    modifier.object = rig
    group = obj.vertex_groups.new(name='head')
    group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    accessories.append(obj)
    return obj

def tube(name, points, radius):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1)
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.data.materials.append(frame_material)
    return bind_head(obj)

for side in (-1, 1):
    x = side * .030
    points = [(x + .023*math.cos(i*math.tau/48), -.149, 1.552 + .014*math.sin(i*math.tau/48)) for i in range(49)]
    tube('Teacher_Frame_' + ('Left' if side < 0 else 'Right'), points, .00115)
    tube('Teacher_Temple_' + ('Left' if side < 0 else 'Right'), [(side*.053,-.149,1.552),(side*.065,-.110,1.553),(side*.068,-.035,1.552),(side*.066,-.018,1.54)], .00125)
    vertices = [(x, -.1493, 1.552)] + [(x+.0218*math.cos(i*math.tau/48), -.1493, 1.552+.0128*math.sin(i*math.tau/48)) for i in range(48)]
    faces = [(0, i+1, (i+1)%48+1) for i in range(48)]
    data = bpy.data.meshes.new('Teacher_Lens_' + ('Left' if side < 0 else 'Right'))
    data.from_pydata(vertices, [], faces)
    data.materials.append(lens)
    obj = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(obj)
    bind_head(obj)
tube('Teacher_Glasses_Bridge', [(-.007,-.149,1.555),(0,-.154,1.559),(.007,-.149,1.555)], .0011)

for obj in meshes:
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:
            continue
        p = next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        if obj.name.endswith('_Body'):
            p.inputs['Roughness'].default_value = .57
            p.inputs['Specular IOR Level'].default_value = .28
            p.inputs['Subsurface Weight'].default_value = .04
        if obj.name.endswith('_ponytail01'):
            texture = next((n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'diffuse' in n.image.name), None)
            if texture:
                original = texture.image
                pixels = list(original.pixels)
                values = []
                for i in range(0, len(pixels), 4):
                    r, g, b, alpha = pixels[i:i+4]
                    value = .025 + .14*(.2126*r + .7152*g + .0722*b)
                    values.extend((value, value*.78, value*.60, alpha))
                image = bpy.data.images.new('Teacher_Dark_Hair', width=original.size[0], height=original.size[1])
                image.pixels.foreach_set(values)
                image.pack()
                texture.image = image
                mat.node_tree.links.new(texture.outputs['Color'], p.inputs['Base Color'])
            p.inputs['Roughness'].default_value = .72
            p.inputs['Metallic'].default_value = 0

scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig, *meshes, *accessories]:
    obj.hide_set(False)
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
glb = OUT / (KEY+'.glb')
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_active_scene=True, use_selection=True, export_apply=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=False, export_force_sampling=True, export_skins=True, export_morph=False, export_extras=True)
normalize(glb, KEY, preserve_actions=True)
raw = glb.read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+length])
for mat in doc['materials']:
    if 'high-poly' in mat['name'] or mat['name'] == 'Teacher_Clear_Lenses':
        mat['alphaMode'] = 'BLEND'
        mat.pop('alphaCutoff', None)
        if mat['name'] == 'Teacher_Clear_Lenses':
            mat['doubleSided'] = True
encoded = json.dumps(doc, separators=(',', ':')).encode()
encoded += b' '*(-len(encoded)%4)
rest = raw[20+length:]
glb.write_bytes(struct.pack('<4sII', b'glTF', 2, 20+len(encoded)+len(rest)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + rest)

scene.world = bpy.data.worlds.new('Teacher_Preview_World')
scene.world.use_nodes = True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value = (.10,.13,.16,1)
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value = .35
for location, power, size in [((-2,-3,3),240,2.5),((2,-2,2),130,2),((1,1,3),190,2)]:
    data = bpy.data.lights.new('Teacher_Preview_Light','AREA')
    data.energy, data.size = power, size
    obj = bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0,0,1.1))-obj.location).to_track_quat('-Z','Y').to_euler()
data = bpy.data.cameras.new('Teacher_Preview_Camera')
camera = bpy.data.objects.new(data.name,data)
scene.collection.objects.link(camera)
camera.location = (1.2,-3.5,1.75)
camera.rotation_euler = (Vector((0,0,.98))-camera.location).to_track_quat('-Z','Y').to_euler()
data.lens = 65
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 800,1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT/'teacher-source.png')
bpy.ops.file.pack_all()
blend = OUT/(KEY+'.blend')
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.render.render(write_still=True)
assert sha(SOURCE) == source_hash
manifest = {'id':KEY,'source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':source_hash,'scriptSHA256':sha(Path(__file__)),'blend':str(blend.relative_to(ROOT)),'blendSHA256':sha(blend),'glb':str(glb.relative_to(ROOT)),'glbSHA256':sha(glb),'bones':53,'meshes':len(meshes)+len(accessories),'clips':[t.name for t in rig.animation_data.nla_tracks],'newAttachments':[o.name for o in accessories],'status':'generated; actual source reload and GLB render validation pending','limitations':['Original face topology and eight clips retained','Female teacher costume only; not final realistic character quality','No facial animation, lip sync, LOD or device acceptance']}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('TEACHER_MODEL_GENERATED',flush=True)
