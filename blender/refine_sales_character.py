"""Independent material refinement; preserve the sales mesh, rig and eight clips."""
import bpy, json, struct, hashlib, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
from normalize_glb import normalize
KEY='male_sales'; SOURCE=ROOT/'assets/characters/library-v1'/f'{KEY}.blend'
OUT=ROOT/'assets/characters/refined-v2'/KEY;OUT.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE');meshes=[o for o in s.objects if o.type=='MESH']
assert len(meshes)==9 and len(rig.data.bones)==53 and len(rig.animation_data.nla_tracks)==8
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=640;s.render.resolution_y=800;s.render.resolution_percentage=100
s.view_settings.view_transform='AgX';s.frame_set(1)
for o in list(s.objects):
 if o.type in ('LIGHT','CAMERA'):bpy.data.objects.remove(o,do_unlink=True)
s.world=bpy.data.worlds.new('Refinement_Studio');s.world.use_nodes=True
bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.13,.16,.19,1);bg.inputs[1].default_value=.3
def look(o,t):o.rotation_euler=(Vector(t)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,size in [('Key',(-2,-3,3),220,2.5),('Fill',(2,-2,2),100,2),('Rim',(1,1,2.5),160,2)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;look(o,(0,0,1.4))
d=bpy.data.cameras.new('Portrait');cam=bpy.data.objects.new('Portrait',d);s.collection.objects.link(cam);s.camera=cam
cam.location=(.26,-1.42,1.69);d.lens=68;look(cam,(0,-.01,1.55))
s.render.filepath=str(OUT/'portrait-before.png');bpy.ops.render.render(write_still=True)
changes=[]
for o in meshes:
 for m in o.data.materials:
  if not m or not m.use_nodes:continue
  shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
  if 'high-poly' in o.name:
   shader.inputs['Roughness'].default_value=.32;shader.inputs['Specular IOR Level'].default_value=.24
   changes.append('Eye: alpha-cutout cornea mask, retained iris/sclera texture')
  elif 'short04' in o.name:
   tex=next(n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'diffuse' in n.image.name)
   old=tex.image;pixels=list(old.pixels);out=[]
   for i in range(0,len(pixels),4):
    r,g,b,a=pixels[i:i+4];lum=.2126*r+.7152*g+.0722*b;v=.018+.20*lum
    out.extend((v,v*.80,v*.69,a))
   hair=bpy.data.images.new('Sales_Original_DarkHair',width=old.size[0],height=old.size[1]);hair.pixels.foreach_set(out);hair.pack();tex.image=hair
   m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color']);shader.inputs['Roughness'].default_value=.72
   changes.append('Hair: restored source strand variation, original alpha retained')
  elif 'Body' in o.name and not any(k in o.name for k in ('eye','lash','brow','tongue','teeth','shoe','suit','jacket')):
   shader.inputs['Roughness'].default_value=.54;shader.inputs['Subsurface Weight'].default_value=.04;shader.inputs['Specular IOR Level'].default_value=.28
   changes.append('Skin: reduced waxy surface response')
  elif 'jacket' in o.name:shader.inputs['Roughness'].default_value=.86
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=rig
glb=OUT/f'{KEY}.glb';bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_morph=False,export_extras=True)
normalize(glb,KEY,preserve_actions=True)
raw=glb.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n])
eye=next(m for m in doc['materials'] if 'high-poly' in m['name']);eye['alphaMode']='MASK';eye['alphaCutoff']=.4
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);rest=raw[20+n:]
glb.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(rest))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+rest)
s['asset_stage']='Material refinement; no likeness scan or completed realistic-face claim'
s['eye_export_mode']='MASK, cutoff 0.4; clear outer shell omitted in real-time, iris retained'
bpy.ops.file.pack_all();blend=OUT/f'{KEY}.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
s.render.filepath=str(OUT/'portrait-source-after.png');bpy.ops.render.render(write_still=True)
manifest={'id':KEY,'source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':sha(SOURCE),'scriptSHA256':sha(Path(__file__)),'blend':str(blend.relative_to(ROOT)),'blendSHA256':sha(blend),'glb':str(glb.relative_to(ROOT)),'glbSHA256':sha(glb),'bones':53,'meshes':9,'clips':[t.name for t in rig.animation_data.nla_tracks],'changes':list(dict.fromkeys(changes)),'status':'exported; source reload, GLB render and runtime promotion pending','limitations':['Original facial topology and garment geometry','No expression or lip sync','Alpha-cutout eye has no separate refractive cornea','One appearance only']}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('SALES_REFINEMENT_READY',flush=True)
