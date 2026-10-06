"""Build original clothed office characters using MPFB CC0 anatomical assets.
Run with Blender 5.2 and the MPFB extension enabled; never export helper anatomy.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
from bl_ext.user_default.mpfb.services.humanservice import HumanService as H
from bl_ext.user_default.mpfb.services.targetservice import TargetService as T
from bl_ext.user_default.mpfb.services.assetservice import AssetService as A
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
from normalize_glb import normalize
OUT=ROOT/'assets/characters';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.fps=24;scene.frame_end=96
scene.world.use_nodes=True;next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.35,.42,.5,1);next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.4

def asset(sub,name):
 p=A.find_asset_absolute_path(name,asset_subdir=sub)
 if not p:raise FileNotFoundError(f'{sub}/{name}: install official system assets and suits01 CC0 packs')
 return p

def material(name,color,rough=.65,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
# Original image texture, UV based, exported as ordinary PBR texture in GLB.
plaid=bpy.data.images.new('Original_Indigo_Plaid',width=512,height=512)
pixels=[]
for y in range(512):
 for x in range(512):
  u=x%64;v=y%64;dark=(u<20)+(v<20);fine=u<3 or v<3
  c=(.14,.22,.3) if dark==0 else ((.055,.09,.14) if dark==1 else (.025,.04,.065))
  if fine:c=(.45,.48,.44)
  pixels.extend((*c,1))
plaid.pixels.foreach_set(pixels);plaid.pack()
plaidmat=material('Original_Programmer_Plaid',(.2,.3,.4),.82);plaidmat.use_fake_user=True;plaid.use_fake_user=True
tex=plaidmat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=plaid;plaidmat.node_tree.links.new(tex.outputs['Color'],next(n for n in plaidmat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'])

clothes={
 'male':{'programmer':'male_casualsuit03','ecommerce':'male_casualsuit01','sales':'toigo_male_suit_tie_and_jacket','celebrity':'male_casualsuit05'},
 'female':{'programmer':'female_elegantsuit01','ecommerce':'toigo_female_suit_2','sales':'toigo_female_suit','celebrity':'female_casualsuit01'}}
hairs={'male':['short02','short01','short04','short03'],'female':['ponytail01','bob01','bob02','long01']}
# Mesh islands separate shirts from trousers / skirts, preserving their original UV materials.
def plaid_shirt(o):
 adjacency=[set() for _ in o.data.vertices]
 for e in o.data.edges:
  a,b=e.vertices;adjacency[a].add(b);adjacency[b].add(a)
 ids={};groups=[]
 for v in range(len(adjacency)):
  if v in ids:continue
  queue=[v];ids[v]=len(groups);group=[]
  while queue:
   i=queue.pop();group.append(i)
   for j in adjacency[i]:
    if j not in ids:ids[j]=ids[v];queue.append(j)
  groups.append(group)
 zs=[v.co.z for v in o.data.vertices];height=max(zs)
 shirt={i for i,g in enumerate(groups) if min(zs[j] for j in g)>height*.44 and max(zs[j] for j in g)>height*.78}
 o.data.materials.append(plaidmat);mi=len(o.data.materials)-1
 for p in o.data.polygons:
  if ids[p.vertices[0]] in shirt:p.material_index=mi
 print('PLAID_ISLANDS',o.name,len(shirt))

characters=[];report=[]
for gi,gender in enumerate(['male','female']):
 for ji,job in enumerate(clothes[gender]):
  key=f'{gender}_{job}'
  d=T.get_default_macro_info_dict();d.update(gender=1 if gender=='male' else 0,age=.5+ji*.014,muscle=.42 if gender=='female' else .53,weight=.46,height=.58 if gender=='male' else .5,proportions=.62)
  d['race']={'asian':.9,'caucasian':.1,'african':0}
  body=H.create_human(macro_detail_dict=d);body.name=key+'_Body'
  H.set_character_skin(asset('skins',f'young_asian_{gender}.mhmat'),body,skin_type='GAMEENGINE')
  rig=H.add_builtin_rig(body,'game_engine');rig.name=key+'_Rig'
  for sub,name,kind in [('eyes','high-poly','Eyes'),('eyebrows','eyebrow001','Eyebrows'),('eyelashes','eyelashes01','Eyelashes'),('teeth','teeth_base','Teeth'),('tongue','tongue01','Tongue'),('hair',hairs[gender][ji],'Hair'),('clothes',clothes[gender][job],'Clothes'),('clothes','shoes04' if job=='sales' else 'shoes05','Clothes')]:
   obj=H.add_mhclo_asset(asset(sub,name+'.mhclo'),body,asset_type=kind,subdiv_levels=0,material_type='GAMEENGINE');obj.name=key+'_'+name
   if sub=='clothes' and job=='programmer' and name==clothes[gender][job]:plaid_shirt(obj)
  # Freeze the chosen original face/body; remove all helper geometry before exporting.
  bpy.context.view_layer.objects.active=body;body.select_set(True)
  if body.data.shape_keys:bpy.ops.object.shape_key_remove(all=True,apply_mix=True)
  for o in [body,*rig.children_recursive]:
   if o.type!='MESH':continue
   bpy.context.view_layer.objects.active=o
   for mod in list(o.modifiers):
    if mod.type=='MASK':bpy.ops.object.modifier_apply(modifier=mod.name)
   for p in o.data.polygons:p.use_smooth=True
   for m in o.data.materials:
    if not m or not m.use_nodes:continue
    shader=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if shader:
     shader.inputs['Roughness'].default_value=.48 if o==body else .78
     if any(t in o.name for t in ['_short','_bob','_ponytail','_long']):
      for link in list(shader.inputs['Base Color'].links):m.node_tree.links.remove(link)
      shader.inputs['Base Color'].default_value=(.022,.015,.012,1);shader.inputs['Roughness'].default_value=.43
     if o==body:shader.inputs['Subsurface Weight'].default_value=.08
  # Relax shoulders from the anatomical A pose. This pose is held throughout idle.
  for side in ['l','r']:
   bone=rig.pose.bones.get('upperarm_'+side)
   direction=Vector((.15 if side=='l' else -.15,-.04,-1)).normalized()
   local=bone.bone.matrix_local.to_quaternion().inverted()@direction
   bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Vector((0,1,0)).rotation_difference(local)
  for f,breath in [(1,0),(25,.008),(49,0),(73,-.004),(97,0)]:
   for side in ['l','r']:rig.pose.bones['upperarm_'+side].keyframe_insert('rotation_quaternion',frame=f,group='Relaxed arms')
   spine=rig.pose.bones['spine_02'];spine.rotation_mode='XYZ';spine.rotation_euler.x=breath;spine.keyframe_insert('rotation_euler',frame=f,group='Breathing')
  rig.animation_data.action.name=key+'_Idle'
  scene.frame_set(1);bpy.context.view_layer.update()
  meshes=[o for o in rig.children_recursive if o.type=='MESH']
  # Height normalization is uniform on the skeleton, not per body part.
  bounds=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];low=min(v.z for v in bounds);high=max(v.z for v in bounds)
  rig.scale*= (1.78 if gender=='male' else 1.68)/(high-low);rig.location.z=-low*rig.scale.z
  bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
  for o in rig.children_recursive:o.select_set(True)
  bpy.context.view_layer.objects.active=rig
  # Keep mobile-friendly embedded textures while retaining 2K facial skin maps.
  for image in bpy.data.images:
   if image.source=='FILE' and max(image.size)>2048:
    target=2048 if 'asian' in image.name else 1024
    w,h=image.size;image.scale(round(w*target/max(w,h)),round(h*target/max(w,h)));image.pack()
  bpy.ops.export_scene.gltf(filepath=str(OUT/(key+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_skins=True,export_morph=False,export_extras=True)
  normalize(OUT/(key+'.glb'),key)
  collection=bpy.data.collections.new('角色_'+key);scene.collection.children.link(collection)
  for o in [rig,*rig.children_recursive]:
   for c in list(o.users_collection):c.objects.unlink(o)
   collection.objects.link(o)
  rig['appearance']=key;rig['character_design']='Original East Asian office character; no actor likeness';rig.location.x=ji*1.3-1.95;rig.location.y=gi*1.5
  characters.append(rig);report.append({'appearance':key,'rig_bones':len(rig.data.bones),'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'outfit':clothes[gender][job],'file':str(OUT/(key+'.glb'))})
  print('CHARACTER_EXPORTED',key,flush=True)
  if '--preview-two' in sys.argv and ji==0:break
# A neutral studio for validating faces, outfits, shoes and relaxed anatomy.
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio_Floor';floor.data.materials.append(material('Studio_Warm_Gray',(.19,.2,.22),.85))
for name,loc,power,size in [('Key',(-4,-4,5),650,5),('Fill',(4,-2,3),350,4),('Rim',(0,4,4),650,4)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('Character_Preview');cam=bpy.data.objects.new('Character_Preview',camdata);scene.collection.objects.link(cam);cam.location=(4,-7,3.1);cam.rotation_euler=(Vector((0,.7,.95))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=45;scene.camera=cam
if '--preview-two' in sys.argv:
 for i,r in enumerate(characters):r.location.x=i*.9-.45;r.location.y=0
 cam.location=(.3,-4,2);cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=1000;scene.render.resolution_y=1000
scene['asset_stage']='Anatomical rigged workplace character prototype v0.7; further face sculpting and garment refinement remain.'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'workplace-characters.blend'))
(OUT/'manifest.json').write_text(json.dumps({'version':'0.7','characters':report,'license':'MakeHuman system assets and suits01 CC0; MPFB code GPLv3; original styling'},ensure_ascii=False,indent=2))
scene.render.filepath=str(ROOT/'assets/renders/workplace-characters.png');bpy.ops.render.render(write_still=True)
