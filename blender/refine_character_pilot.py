"""Non-destructive material/idle/talk pilot; keep v0.9 runtime assets unchanged.
Produces an independently editable Blender source, GLB and matched render evidence.
No actor scan, motion capture or completed realistic-character claim.
"""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'blender'))
from normalize_glb import normalize
KEY='male_programmer'
SOURCE=ROOT/'assets/characters/library-v1'/(KEY+'.blend')
OUT=ROOT/'assets/characters/pilot-v2';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
meshes=[o for o in s.objects if o.type=='MESH'];assert len(meshes)==9 and len(rig.data.bones)==53
s.unit_settings.system='METRIC';s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=720;s.render.resolution_y=900;s.render.resolution_percentage=100
s.view_settings.view_transform='AgX';s.render.fps=24
s.world=bpy.data.worlds.new('Pilot_Studio');s.world.use_nodes=True
bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.13,.16,.19,1);bg.inputs[1].default_value=.3

def look(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy,size in [('Key',(-2,-3,3),220,2.5),('Fill',(2,-2,2),100,2),('Rim',(1,1,2.5),160,2)]:
 d=bpy.data.lights.new('Pilot_'+name,'AREA');d.energy=energy;d.size=size;o=bpy.data.objects.new('Pilot_'+name,d);s.collection.objects.link(o);o.location=loc;look(o,(0,0,1.4))
d=bpy.data.cameras.new('Pilot_Portrait');cam=bpy.data.objects.new('Pilot_Portrait',d);s.collection.objects.link(cam);s.camera=cam
cam.location=(.26,-1.42,1.69);d.lens=68;look(cam,(0,-.01,1.55))
s.frame_set(1);bpy.context.view_layer.update()
s.render.filepath=str(OUT/'portrait-before.png');bpy.ops.render.render(write_still=True)
changes=[]
for o in meshes:
 for m in o.data.materials:
  if not m or not m.use_nodes:continue
  shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
  if '_high-poly' in o.name:
   shader.inputs['Roughness'].default_value=.32;shader.inputs['Coat Weight'].default_value=.03;shader.inputs['Coat Roughness'].default_value=.15
   changes.append('Eye: retain transparent corneal layer; restrained wet surface')
  elif o.name.endswith('_short02'):
   texture=next(n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'diffuse' in n.image.name)
   # Preserve the source strand variation and alpha; previously a flat color replaced it.
   source=texture.image;source_pixels=list(source.pixels);pixels=[]
   for i in range(0,len(source_pixels),4):
    r,g,b,a=source_pixels[i:i+4];lum=.2126*r+.7152*g+.0722*b
    value=.045+.33*lum
    pixels.extend((value,value*.8,value*.69,a))
   hair=bpy.data.images.new('Pilot_Original_DarkHair',width=source.size[0],height=source.size[1]);hair.pixels.foreach_set(pixels);hair.pack();texture.image=hair
   m.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color']);shader.inputs['Roughness'].default_value=.68
   # Original UV texture remains an ordinary image so it survives GLB export.
   changes.append('Hair: source strand variation restored; matte dark-brown palette')
  elif o.name.endswith('_Body'):
   shader.inputs['Roughness'].default_value=.54;shader.inputs['Subsurface Weight'].default_value=.055
   shader.inputs['Specular IOR Level'].default_value=.28
   changes.append('Skin: reduced uniform waxy highlight')
  elif 'casualsuit03' in o.name:
   if m.name=='Original_Programmer_Plaid':
    cloth=bpy.data.images.new('Pilot_Original_FinePlaid',width=1024,height=1024);values=[]
    for y in range(1024):
     for x in range(1024):
      u=x%32;v=y%32;dark=(u<12)+(v<12);fine=u<2 or v<2
      c=(.105,.16,.205) if dark==0 else ((.052,.075,.105) if dark==1 else (.026,.04,.06))
      if fine:c=(.31,.34,.30)
      weave=.965 if (x+y)%2 else 1
      values.extend((c[0]*weave,c[1]*weave,c[2]*weave,1))
    cloth.pixels.foreach_set(values);cloth.pack()
    texture=next(n for n in m.node_tree.nodes if n.type=='TEX_IMAGE');texture.image=cloth
    changes.append('Original finer plaid texture with textile variation')
   shader.inputs['Roughness'].default_value=.86
   changes.append('Clothing: matte cloth response; source UV and normal map retained')
# Keep old eight clips; add a restrained speaking gesture with asynchronous shoulders.
base={b.name:b.matrix_basis.to_quaternion().copy() for b in rig.pose.bones}
old_action=rig.animation_data.action
clip=bpy.data.actions.new(KEY+'_Talk');clip.use_fake_user=True;rig.animation_data.action=clip
for f in range(1,98):
 t=(f-1)/96
 for b in rig.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=base[b.name]
 gesture=max(0,math.sin(t*math.pi))
 values={'head':((0,0,1),.055*math.sin(t*2*math.pi)), 'spine_02':((1,0,0),.014*math.sin(t*2*math.pi)), 'upperarm_l':((1,0,0),-.22*gesture), 'lowerarm_l':((1,0,0),-.35*gesture), 'upperarm_r':((1,0,0),-.07*math.sin(t*math.pi)), 'lowerarm_r':((1,0,0),-.1*gesture)}
 for name,(axis,angle) in values.items():
  b=rig.pose.bones[name];local=b.bone.matrix_local.to_quaternion().inverted()@Vector(axis);b.rotation_quaternion=Quaternion(local,angle)@base[name]
  b.keyframe_insert('rotation_quaternion',frame=f,group=name)
track=rig.animation_data.nla_tracks.new();track.name=clip.name;strip=track.strips.new(clip.name,0,clip);strip.blend_type='REPLACE';track.mute=True
rig.animation_data.action=old_action;s.frame_set(1);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=rig
path=OUT/(KEY+'.glb')
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_morph=False,export_extras=True)
normalize(path,KEY,preserve_actions=True)
# The CC0 high-poly eye includes a transparent cornea shell over the iris.
# OPAQUE incorrectly turns its dark transparent pixels into a black surface.
import struct
raw=path.read_bytes();length,kind=struct.unpack_from('<I4s',raw,12);doc=json.loads(raw[20:20+length])
for mat in doc['materials']:
 if 'high-poly' in mat['name']:mat['alphaMode']='BLEND';mat.pop('alphaCutoff',None)
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);rest=raw[20+length:]
path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(rest))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+rest)
s['asset_stage']='Material and dialogue gesture pilot; likeness, face expression, outfit and runtime validation pending'
s.render.filepath=str(OUT/'portrait-after.png');bpy.ops.render.render(write_still=True)
cam.location=(2,-4,2.3);cam.data.lens=70;look(cam,(0,0,1.05));s.render.filepath=str(OUT/'body-after.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=clip;s.frame_set(40);s.render.filepath=str(OUT/'talk-after.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=old_action;s.frame_set(1)
bpy.ops.file.pack_all();blend=OUT/(KEY+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report={'id':KEY,'source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':sha(SOURCE),'scriptSHA256':sha(Path(__file__)),'blend':str(blend.relative_to(ROOT)),'blendSHA256':sha(blend),'glb':str(path.relative_to(ROOT)),'glbSHA256':sha(path),'bones':len(rig.data.bones),'meshes':len(meshes),'clips':[t.name for t in rig.animation_data.nla_tracks],'changes':list(dict.fromkeys(changes)),'status':'exported and matched-render evidence generated; independent reload and runtime checks pending','limitations':['Same v0.9 facial mesh and garment geometry','No lip sync or facial expression','Authored gesture, not motion capture','Pilot has not replaced runtime assets']}
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('PILOT_READY',flush=True)
