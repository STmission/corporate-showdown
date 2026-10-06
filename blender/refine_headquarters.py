"""Continue the saved native office; add production details and anatomical employees.
Does not rebuild or replace the approved floor plan. Exports self-contained GLB.
"""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
from normalize_glb import normalize
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/models/coastal-headquarters.blend'))
scene=bpy.context.scene
for name in ['12_Environment_Finish','13_Workplace_Characters']:
 old=bpy.data.collections.get(name)
 if old:
  for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.data.collections.remove(old)
collection=bpy.data.collections.new('12_Environment_Finish');scene.collection.children.link(collection)
def mat(name,color,rough=.5,metal=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
brass=mat('Finish_Brushed_Brass',(.48,.35,.18),.3,.85);steel=mat('Finish_Stainless_Steel',(.65,.68,.71),.25,.9);ceramic=mat('Finish_Ivory_Ceramic',(.8,.78,.72),.24);dark=mat('Finish_Rubber',(.025,.03,.032),.83);paper=mat('Finish_Paper',(.8,.76,.62),.8);leaf=mat('Finish_Plant',(.08,.17,.075),.7)
def place(o,name,m):
 o.name=name;o.data.materials.append(m)
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o)
 return o
def box(name,pos,dim,m,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=place(bpy.context.object,name,m);o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 b=o.modifiers.new('Soft manufactured edges','BEVEL');b.width=min(bevel,min(dim)/3);b.segments=3
 return o
def cyl(name,pos,r,depth,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=pos);o=place(bpy.context.object,name,m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def rod(name,a,b,r,m):
 a,b=Vector(a),Vector(b);o=cyl(name,(a+b)/2,r,(b-a).length,m);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
# Consistent microbevels on manufactured furniture, avoiding walls, screens and glass.
finish_count=0
for o in list(scene.objects):
 if o.type!='MESH' or o.modifiers:continue
 parent_names=[];p=o
 while p:parent_names.append(p.name);p=p.parent
 if not any(t in ' / '.join(parent_names) for t in ['Microwave','Toaster','Coffee_Machine','Open_Fridge_Door','Lectern','Gift_','Audio_Control_Desk']):continue
 if len(o.data.polygons)>12 or min(o.dimensions)<.03:continue
 b=o.modifiers.new('Furniture edge rounding','BEVEL');b.width=min(.012,min(o.dimensions)/5);b.segments=2;finish_count+=1
# Pantry cabinet door fronts, brass pulls and useful counter objects.
for x in [22,23,24,25,26,27,28]:
 box('Pantry_Cabinet_Front',(x,-.245,.47),(.93,.035,.79),ceramic)
 rod('Pantry_Cabinet_Handle',(x-.15,-.273,.8),(x+.15,-.273,.8),.009,brass)
for x,y in [(24.3,-.76),(26.6,-.83),(27.1,-.83)]:
 box('Pantry_Tray',(x,y,1.02),(.45,.34,.025),steel)
 for j in range(3):cyl('Stacked_Ceramic_Plate',(x,y,1.043+j*.017),.13,.013,ceramic)
for j in range(5):
 x=27.65+j*.075;rod('Pantry_Cutlery',(x,-.7,1.04),(x,-.92,1.045),.004,steel)
box('Pantry_Napkin_Holder',(26.9,-1.13,1.11),(.2,.09,.17),paper)
# Real shower mixers, overhead rain heads, towel bars and towels.
for side in [-1,1]:
 x=side*3.8;y=-19.65
 rod('Rain_Shower_Column',(x,y,.95),(x,y,2.47),.018,steel)
 rod('Rain_Shower_Arm',(x,y,2.47),(x,y+.38,2.47),.018,steel)
 cyl('Rain_Shower_Head',(x,y+.38,2.44),.14,.025,steel)
 box('Shower_Mixer',(x,y+.035,1.02),(.18,.055,.07),steel)
 rod('Shower_Towel_Bar',(side*4.75,-17.6,1.45),(side*4.75,-18.25,1.45),.012,brass)
 box('Folded_Shower_Towel',(side*4.74,-17.93,1.17),(.05,.49,.53),ceramic)
# Doorway plaques and corridor amenities; the agreed corridor stays clear.
for side in [-1,1]:
 box('Restroom_Door_Plaque',(side*1.5,-8.25,1.72),(.04,.32,.16),brass)
 box('Mirror_Soap_Dispenser',(side*1.28,-11.2,1.09),(.1,.1,.22),ceramic)
 cyl('Mirror_Soap_Pump',(side*1.28,-11.2,1.23),.02,.055,steel)
# Small workplace objects on selected desks, keeping the walkable aisles untouched.
for x in [-25,-14]:
 for y in [15,9,3,-3]:
  box('Desk_Notebook',(x-.65,y,.865),(.23,.3,.018),paper)
  rod('Desk_Pen',(x-.58,y-.09,.885),(x-.58,y+.08,.885),.004,dark)
  cyl('Desk_Water_Bottle',(x+.67,y,.995),.035,.26,steel)
# Rounded speaker cones and stage lip lights make the event area less blocky.
for x in [8.9,23.1]:
 for z in [1.05,1.52]:
  o=cyl('PA_Speaker_Driver',(x,16.72,z),.13,.025,dark);o.rotation_euler.x=math.pi/2
for x in [10,13,16,19,22]:
 box('Stage_Warm_Edge_Light',(x,13.595,.31),(1,.008,.028),brass)
# Append the actual armatures and fitted wardrobes into the native headquarters.
charfile=ROOT/'assets/characters/workplace-characters.blend'
with bpy.data.libraries.load(str(charfile),link=False) as (source,target):
 target.collections=[n for n in source.collections if n.startswith('角色_')]
people=bpy.data.collections.new('13_Workplace_Characters');scene.collection.children.link(people)
placements=[(-23,7,0),(-13,7,0),(-25,-9,math.pi/2),(-17,-4,.5),(-20,7,math.pi),(-12,-11,0),(14,15.1,math.pi),(25,-.4,0)]
for i,c in enumerate(target.collections):
 people.children.link(c)
 rig=next(o for o in c.objects if o.type=='ARMATURE')
 x,y,angle=placements[i%len(placements)];rig.location.x=x;rig.location.y=y;rig.rotation_euler.z=angle
 for o in c.objects:o['environment_character']=True
scene.frame_set(1)
# A named roof flag survives glTF export and enables bird's-eye viewing on the web.
for o in scene.objects:
 p=o
 while p:
  if p.name.startswith('Ceiling_Optional'):o['is_ceiling']=True;break
  p=p.parent
scene['production_stage']='Native Blender environment and anatomical characters v0.7'
scene['asset_scope']='Approved office layout; eight original clothed, skinned human prototypes. Cats remain stylized.'
scene.cycles.samples=20;scene.render.resolution_x=1200;scene.render.resolution_y=760
scene.camera=bpy.data.objects.get('Camera_Office');scene.render.filepath=str(ROOT/'assets/renders/headquarters-with-characters.png')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/models/coastal-headquarters.blend'))
# Export office and coast without lights/cameras: viewport builds its own lighting.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in {'MESH','EMPTY','ARMATURE'}:o.hide_set(False);o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/models/coastal-headquarters-complete.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_morph=False,export_extras=True,export_skins=True,export_cameras=False,export_lights=False)
normalize(ROOT/'assets/models/coastal-headquarters-complete.glb')
report={'version':'0.7','objects':len(scene.objects),'extra_details':len(collection.objects),'rounded_furniture':finish_count,'characters':len(target.collections),'editable_project':str(ROOT/'assets/models/coastal-headquarters.blend'),'scene_glb':str(ROOT/'assets/models/coastal-headquarters-complete.glb')}
(ROOT/'blender/refinement-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('ENVIRONMENT_REFINED',report,flush=True)
bpy.ops.render.render(write_still=True)
