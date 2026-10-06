"""Doctor outfit pilot derived from the existing CC0-based female source; originals unchanged."""
import bpy,math,json,hashlib,struct,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'assets/characters/library-v1/female_ecommerce.blend';OUT=ROOT/'assets/characters/professions-v1';OUT.mkdir(exist_ok=True);KEY='female_doctor'
sys.path.insert(0,str(ROOT/'blender'));from normalize_glb import normalize
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source_hash=sha(SOURCE);bpy.ops.wm.open_mainfile(filepath=str(SOURCE));s=bpy.context.scene;s.frame_set(1);rig=next(o for o in s.objects if o.type=='ARMATURE');meshes=[o for o in s.objects if o.type=='MESH'];coat=next(o for o in meshes if 'toigo' in o.name)
for o in [rig,*meshes]:o.name=o.name.replace('female_ecommerce',KEY)
for m in bpy.data.materials:m.name=m.name.replace('female_ecommerce',KEY)
for track in rig.animation_data.nla_tracks:
 track.name=track.name.replace('female_ecommerce',KEY)
 for strip in track.strips:strip.name=strip.name.replace('female_ecommerce',KEY);strip.action.name=strip.action.name.replace('female_ecommerce',KEY)
if rig.animation_data.action:rig.animation_data.action.name=rig.animation_data.action.name.replace('female_ecommerce',KEY)
def material(name,color,rough=.75,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
white=material('Doctor_Coat_OffWhite',(.89,.91,.87),.83);blue=material('Doctor_Trousers_Navy',(.025,.08,.115),.87);scrub=material('Doctor_Inner_Teal',(.10,.36,.40),.84);steel=material('Doctor_Brushed_Steel',(.46,.51,.55),.30,.80);tube=material('Doctor_Stethoscope_Charcoal',(.018,.025,.029),.55);badge_mat=material('Doctor_Badge_Blue',(.055,.20,.31),.50)
coat.data=coat.data.copy();coat.data.materials.clear()
for m in [white,blue,scrub,steel]:coat.data.materials.append(m)
adj={v.index:set() for v in coat.data.vertices}
for e in coat.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
seen=set();components=[]
for start in adj:
 if start in seen:continue
 stack=[start];seen.add(start);group=[]
 while stack:
  i=stack.pop();group.append(i)
  for j in adj[i]:
   if j not in seen:seen.add(j);stack.append(j)
 components.append(group)
vertex_material={};extended=0
for component in components:
 pts=[coat.matrix_world@coat.data.vertices[i].co for i in component];low=min(p.z for p in pts);high=max(p.z for p in pts)
 category=1 if high<1 and len(component)>100 else 0 if len(component)>3000 else 2 if len(component)>500 else 3
 for i in component:
  vertex_material[i]=category
  if category==0:
   v=coat.data.vertices[i];point=coat.matrix_world@v.co
   if point.z<.90:point.z-=.075*min(1, max(0,(.90-point.z)/.20));v.co=coat.matrix_world.inverted()@point;extended+=1
for p in coat.data.polygons:p.material_index=vertex_material[p.vertices[0]];p.use_smooth=True
coat.data.update()
# Surface attachments use the same torso skin weights, transferred from nearest coat vertices.
points=[coat.matrix_world@v.co for v in coat.data.vertices];tree=KDTree(len(points))
for i,p in enumerate(points):tree.insert(p,i)
tree.balance();accessories=[]
def bind(o):
 world=o.matrix_world.copy();bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=o;o.select_set(True)
 if o.type!='MESH':bpy.ops.object.convert(target='MESH');o=bpy.context.object
 o.parent=rig;o.matrix_world=world;o.matrix_parent_inverse=rig.matrix_world.inverted();o.matrix_world=world
 modifier=o.modifiers.new('Doctor_Armature','ARMATURE');modifier.object=rig
 for v in o.data.vertices:
  _,index,_=tree.find(o.matrix_world@v.co);weights=[(coat.vertex_groups[g.group].name,g.weight) for g in coat.data.vertices[index].groups if rig.data.bones.get(coat.vertex_groups[g.group].name)];total=sum(w for _,w in weights);assert total>0
  for name,weight in weights:group=o.vertex_groups.get(name) or o.vertex_groups.new(name=name);group.add([v.index],weight/total,'REPLACE')
 for p in o.data.polygons:p.use_smooth=True
 accessories.append(o);return o
bpy.ops.object.select_all(action='DESELECT')
def curve(name,points,r,mat):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,p in zip(sp.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);s.collection.objects.link(o);o.data.materials.append(mat);return bind(o)
curve('Doctor_Stethoscope_Tubing',[(-.065,-.115,1.39),(-.10,-.16,1.31),(-.07,-.17,1.17),(.01,-.18,1.10),(.065,-.17,1.17),(.095,-.16,1.31),(.060,-.115,1.39)],.0045,tube)
curve('Doctor_Chestpiece_Link',[(.01,-.18,1.10),(.045,-.185,1.12),(.055,-.18,1.15)],.003,steel)
bpy.ops.object.select_all(action='DESELECT');bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.017,depth=.006,location=(.055,-.185,1.15),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name='Doctor_Chestpiece';o.data.materials.append(steel);bind(o)
# Curved chest pocket follows the original coat surface rather than a rigid box.
vertices=[]
for z in [1.20,1.245]:
 for x in [-.12,-.09,-.06]:
  nearby=[p for p in points if abs(p.x-x)<.022 and abs(p.z-z)<.026];front=min(p.y for p in nearby);vertices.append((x,front-.006,z))
data=bpy.data.meshes.new('Doctor_Chest_Pocket');data.from_pydata(vertices,[],[(0,1,4,3),(1,2,5,4)]);data.update();o=bpy.data.objects.new(data.name,data);s.collection.objects.link(o);data.materials.append(white);bind(o)
curve('Doctor_Pocket_Seam',vertices[3:],.0013,white)
# Chest badge uses original simple geometry, no external logos or font texture.
bpy.ops.object.select_all(action='DESELECT');bpy.ops.mesh.primitive_cube_add(size=1,location=(.09,-.166,1.255));o=bpy.context.object;o.name='Doctor_ID_Badge';o.scale=(.055,.005,.032);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(badge_mat);bind(o)
for o in meshes:
 for m in o.data.materials:
  if not m or not m.use_nodes:continue
  p=m.node_tree.nodes.get('Principled BSDF')
  if o.name.endswith('_Body'):p.inputs['Roughness'].default_value=.54;p.inputs['Specular IOR Level'].default_value=.28;p.inputs['Subsurface Weight'].default_value=.04
  if o.name.endswith('_bob01'):
   texture=next((n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'diffuse' in n.image.name),None)
   if texture:
    original=texture.image;pixels=list(original.pixels);values=[]
    for i in range(0,len(pixels),4):
     r,g,b,a=pixels[i:i+4];value=.025+.16*(.2126*r+.7152*g+.0722*b);values.extend((value,value*.82,value*.70,a))
    image=bpy.data.images.new('Doctor_Original_Dark_Hair',width=original.size[0],height=original.size[1]);image.pixels.foreach_set(values);image.pack();texture.image=image;m.node_tree.links.new(texture.outputs['Color'],p.inputs['Base Color'])
   inverse=o.matrix_world.inverted()
   for v in o.data.vertices:
    point=o.matrix_world@v.co
    if point.y<-.05 and point.z<1.61 and point.x<.025:
     weight=min(1,max(0,(1.61-point.z)/.16))*min(1,max(0,(-point.y-.05)/.06));point.x-=.045*weight;point.z+=.05*weight;v.co=inverse@point
   o.data.update();p.inputs['Metallic'].default_value=0
   p.inputs['Roughness'].default_value=.68
# Keep authored v0.9 animation clips; this pilot changes costume, not the combat skeleton.
s.unit_settings.system='METRIC';s.unit_settings.scale_length=1;bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in [*meshes,*accessories]:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=rig;glb=OUT/(KEY+'.glb');bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_active_scene=True,use_selection=True,export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_morph=False,export_extras=True);normalize(glb,KEY,preserve_actions=True)
b=glb.read_bytes();n=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+n])
for m in doc['materials']:
 if 'high-poly' in m['name']:m['alphaMode']='BLEND';m.pop('alphaCutoff',None)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4);rest=b[20+n:];glb.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(j)+len(rest))+struct.pack('<I4s',len(j),b'JSON')+j+rest)
# Separate actual model preview lighting; not part of the export.
s.world=bpy.data.worlds.new('Doctor_Preview_World');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.13,.16,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.35
for loc,power,size in [((-2,-3,3),240,2.5),((2,-2,2),130,2),((1,1,3),190,2)]:
 d=bpy.data.lights.new('Doctor_Preview_Light','AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(d.name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1.1))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Doctor_Preview_Camera');cam=bpy.data.objects.new(d.name,d);s.collection.objects.link(cam);cam.location=(1.7,-3.5,1.75);cam.rotation_euler=(Vector((0,0,.98))-cam.location).to_track_quat('-Z','Y').to_euler();d.lens=65;s.camera=cam;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=800;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath=str(OUT/'doctor-source.png')
bpy.ops.file.pack_all();blend=OUT/(KEY+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend));bpy.ops.render.render(write_still=True);assert sha(SOURCE)==source_hash
manifest={'id':KEY,'source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':source_hash,'scriptSHA256':sha(Path(__file__)),'blend':str(blend.relative_to(ROOT)),'blendSHA256':sha(blend),'glb':str(glb.relative_to(ROOT)),'glbSHA256':sha(glb),'bones':53,'meshes':len(meshes)+len(accessories),'clips':[t.name for t in rig.animation_data.nla_tracks],'extendedHemVertices':extended,'newAttachments':[o.name for o in accessories],'status':'generated; source reopen and actual GLB deformation/render validation pending','limitations':['Original v0.9 face mesh and eight animations retained','Female costume pilot only','No facial expressions, lip sync, medical gestures or final realistic art acceptance']};(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('DOCTOR_MODEL_GENERATED',flush=True)
