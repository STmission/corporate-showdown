"""Import the agreed environment, add native Blender modeling and render setup.
Run with Blender --background --factory-startup --python this_file.
Original procedural assets; does not download third-party models.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/models/coastal-headquarters-environment.glb'
OUT=ROOT/'assets/models/coastal-headquarters.blend'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.3
# Organize by the original named hierarchy while preserving parenting and transforms.
collections={}
for name in ['01_Office','02_Central_Lounge','03_Townhall','04_Pantry','05_Service_Core','06_Cats_And_Rest','07_Meeting_Rooms','08_Architecture','09_Coastal_Exterior','10_Blender_Details','11_Lights_Cameras']:
 c=bpy.data.collections.new(name);scene.collection.children.link(c);collections[name]=c

def ancestry(obj):
 names=[]
 while obj: names.append(obj.name);obj=obj.parent
 return ' / '.join(names)
for obj in list(scene.objects):
 n=ancestry(obj)
 key='08_Architecture'
 if 'Coastal_Context' in n:key='09_Coastal_Exterior'
 elif any(t in n for t in ['Kitchen_Furniture','Catering','Pantry_Cafe']):key='04_Pantry'
 elif any(t in n for t in ['Townhall','Gift_Distribution','Presentation','Raised_Wooden']):key='03_Townhall'
 elif any(t in n for t in ['Central_Elevator_Lounge','Central_Designer_Lounge']):key='02_Central_Lounge'
 elif any(t in n for t in ['Elevator_Core','Sanitary','Room_female','Room_male']):key='05_Service_Core'
 elif any(t in n for t in ['Room_cats','Room_rest']):key='06_Cats_And_Rest'
 elif any(t in n for t in ['Room_meeting','Room_chat','Room_talk','Room_phone']):key='07_Meeting_Rooms'
 elif any(t in n for t in ['Six_Person_Bench','Room_office']):key='01_Office'
 for c in list(obj.users_collection):c.objects.unlink(obj)
 collections[key].objects.link(obj)
# GLB does not carry the browser's reflection sky or lighting; rebuild those here.
world=bpy.data.worlds.new('Coastal_Daylight');scene.world=world;world.use_nodes=True
nodes=world.node_tree.nodes;nodes.clear();bg=nodes.new('ShaderNodeBackground');bg.inputs['Color'].default_value=(.64,.78,.88,1);bg.inputs['Strength'].default_value=.28
output=nodes.new('ShaderNodeOutputWorld');world.node_tree.links.new(bg.outputs['Background'],output.inputs['Surface'])

def relocate(obj,collection='10_Blender_Details'):
 for c in list(obj.users_collection):c.objects.unlink(obj)
 collections[collection].objects.link(obj)
 return obj

def material(name,color,rough=.5,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
fabric=material('Blender_Warm_Linen',(.78,.73,.62),.83)
gold=material('Blender_Brushed_Champagne',(.53,.39,.2),.26,.78)
wood=material('Blender_Oak_Detail',(.55,.4,.23),.5)
porcelain=material('Blender_White_Porcelain',(.89,.86,.79),.2)
leaf=material('Blender_Eucalyptus',(.12,.24,.13),.7)
# Fine linen normal detail made with native shader nodes.
p=fabric.node_tree.nodes.get('Principled BSDF');noise=fabric.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=180;noise.inputs['Detail'].default_value=2
bump=fabric.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.002
fabric.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);fabric.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])

def rounded(name,location,dimensions,mat,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.dimensions=dimensions;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 modifier=o.modifiers.new('Manufactured edge radius','BEVEL');modifier.width=min(bevel,min(dimensions)/3);modifier.segments=3
 for polygon in o.data.polygons:polygon.use_smooth=True
 relocate(o);return o

def cylinder(name,loc,radius,depth,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(mat)
 for polygon in o.data.polygons:polygon.use_smooth=True
 relocate(o);return o

def linkrod(name,a,b,r,mat):
 a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,r,(b-a).length,mat);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
# Blender-native additions: suspended wooden slats above the lounge islands.
for z in [-13,-5.5]:
 for side in [-1,1]:
  x=side*3.2
  for i in range(13):rounded('Lounge_Ceiling_Oak_Slat',(x-1.5+i*.25,-(z+1),3.62),(.08,5.4,.09),wood,.015)
# Original couch hierarchy gives exact transform for additional seam trims and pillows.
sofas=[o for o in scene.objects if o.type=='EMPTY' and o.name.startswith('Designer_Sofa')]
for index,sofa in enumerate(sofas):
 # Positions below are in original local Y-up coordinates, transformed by the imported parent.
 for side in [-1,1]:
  local=Vector((side*.65,-.05,.72));position=sofa.matrix_world@local
  cushion=rounded('Native_Linen_Cushion',position,(.4,.17,.4),fabric,.07)
  cushion.rotation_euler=sofa.matrix_world.to_quaternion().to_euler()
# Flowers and stems on the lounge tables, handcrafted in Blender.
for side in [-1,1]:
 for z in [-13,-5.5]:
  x=side*2.25;y=-z
  cylinder('Ceramic_Bud_Vase',(x,y,.65),.09,.27,porcelain)
  for j in range(5):
   end=(x+(j-2)*.04,y+math.sin(j)*.06,.94+(j%2)*.08)
   linkrod('Flower_Stem',(x,y,.72),end,.006,leaf)
   for k in range(5):
    angle=k*math.tau/5
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=(end[0]+math.cos(angle)*.025,end[1]+math.sin(angle)*.025,end[2]))
    o=bpy.context.object;o.name='Cream_Flower_Petal';o.scale=(.023,.023,.012);o.data.materials.append(porcelain);relocate(o)
# Add handles to public room doors, without reducing the agreed doorway clearance.
for x,z in [(11,2),(17,2),(21.5,2),(18,8),(27,8)]:
 linkrod('Door_Champagne_Pull',(x+.64,-z-.05,.9),(x+.64,-z-.05,1.3),.013,gold)
# Mirror slabs become proper reflective surfaces in Cycles.
mirror_material=material('True_Silver_Mirror',(.94,.94,.94),.015,1)
for o in scene.objects:
 if o.name.startswith('Corridor_Mirror_') and o.type=='MESH':o.data.materials.clear();o.data.materials.append(mirror_material)
# Keep surfaces smooth on curved shapes, preserve the original rectangular faces.
for o in scene.objects:
 if o.type=='MESH' and any(t in o.name for t in ['Angel_','Ragdoll_Cat']):
  for polygon in o.data.polygons:polygon.use_smooth=True

def light(name,kind,location,power,color=(1,.88,.71),size=4,target=None):
 data=bpy.data.lights.new(name,kind);data.energy=power;data.color=color
 if kind=='AREA':data.shape='DISK';data.size=size
 o=bpy.data.objects.new(name,data);collections['11_Lights_Cameras'].objects.link(o);o.location=location
 if target:o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 return o
sun=light('Seaside_Sun','SUN',(-30,35,30),2,(1,.91,.77),target=(0,0,0));sun.data.angle=math.radians(8)
for x in [-26,-14,0,16,28]:
 for y in [-14,-4,9,17]:light('Warm_Ceiling_Fill','AREA',(x,y,3.55),90,(1,.88,.72),size=5)
light('Window_Daylight','AREA',(0,19.7,2.6),1800,(.74,.86,1),size=25,target=(0,0,1))

def camera(name,location,target,lens=24):
 data=bpy.data.cameras.new(name);data.lens=lens;data.clip_end=1500;data.clip_start=.08
 o=bpy.data.objects.new(name,data);collections['11_Lights_Cameras'].objects.link(o);o.location=location;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
scene.camera=camera('Camera_Central_Lounge',(0,17.4,1.68),(0,-2,1.45),22)
camera('Camera_Townhall',(16,-.3,1.68),(16,15.8,1.5),23)
camera('Camera_Office',(-20,18,1.68),(-20,-7,1.4),23)
camera('Camera_Pantry',(29,7,1.68),(26,0,1.3),24)
# Set opening view to the central lounge camera and material preview.
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_perspective='CAMERA'
   area.spaces.active.shading.type='MATERIAL'
   area.spaces.active.clip_end=1500
   area.spaces.active.overlay.show_extras=False
scene['production_stage']='Native Blender environment modeling v0.6'
scene['asset_scope']='Environment only. Realistic humans, clothing rigs and cat fur remain separate production tasks.'
# Embed texture assets, save native editable project before attempting a render.
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
report={'blender':bpy.app.version_string,'objects':len(scene.objects),'materials':len(bpy.data.materials),'native_details':len(collections['10_Blender_Details'].objects),'project':str(OUT)}
(ROOT/'blender/build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('PROJECT_SAVED',json.dumps(report))
scene.render.filepath=str(ROOT/'assets/renders/blender-central-lounge.png')
bpy.ops.render.render(write_still=True)
print('RENDER_SAVED',scene.render.filepath)
