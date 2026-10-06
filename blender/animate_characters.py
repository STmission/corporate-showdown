"""Author editable in-place workplace actions, preserving original bodies, outfits and rigs.
All exports stage before replacing the public library. No motion-capture/actor likeness claim.
"""
import bpy,math,json,sys,os
from pathlib import Path
from mathutils import Vector,Quaternion
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'blender'))
from normalize_glb import normalize
OUT=ROOT/'assets/characters';STAGE=OUT/'.animation-staging';STAGE.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT/'workplace-characters.blend'))
s=bpy.context.scene;s.render.fps=24
CLIPS={'Idle':96,'Walk':24,'Run':18,'Attack':12,'Hit':9,'Down':18,'Rescue':48,'Cast':24}
rigs=sorted([o for o in s.objects if o.type=='ARMATURE'],key=lambda r:r.name);assert len(rigs)==8
report=[]
def rotate(b,base,axis,angle):
 local=b.bone.matrix_local.to_quaternion().inverted()@Vector(axis)
 b.rotation_quaternion=Quaternion(local,angle)@base
for r in rigs:
 key=r.name.removesuffix('_Rig');s.frame_set(1);bpy.context.view_layer.update()
 base={b.name:b.matrix_basis.to_quaternion().copy() for b in r.pose.bones}
 # Capture relaxed idle shoulders, reset all other bones to their unchanged rest basis.
 for b in r.pose.bones:
  if not b.name.startswith('upperarm_'):base[b.name]=Quaternion((1,0,0,0))
 r.animation_data.action=None
 for t in list(r.animation_data.nla_tracks):r.animation_data.nla_tracks.remove(t)
 for a in list(bpy.data.actions):
  if a.name.startswith(key+'_'):
   a.use_fake_user=False
   if a.users==0:bpy.data.actions.remove(a)
 for name,end in CLIPS.items():
  action=bpy.data.actions.new(key+'_'+name);action.use_fake_user=True;r.animation_data.action=action
  for frame in range(1,end+2):
   phase=(frame-1)/end;angles={};root_z=0
   for b in r.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=base[b.name];b.location=(0,0,0)
   if name=='Idle':angles['spine_02']=(0.009*math.sin(phase*2*math.pi),(1,0,0))
   if name in ['Walk','Run']:
    run=name=='Run';wave=math.sin(phase*2*math.pi);amp=.7 if run else .38
    root_z=(.025 if run else .012)*(1-math.cos(phase*4*math.pi))
    angles['spine_01']=(-.12 if run else -.025,(1,0,0))
    for side,sign in [('l',1),('r',-1)]:
     leg=wave*sign;calf=(1.0 if run else .5)*max(0,-leg)
     angles['thigh_'+side]=(amp*leg,(1,0,0));angles['calf_'+side]=(calf,(1,0,0))
     angles['foot_'+side]=(-amp*leg-calf*.6,(1,0,0));angles['upperarm_'+side]=(-amp*leg*.7,(1,0,0));angles['lowerarm_'+side]=(-.65 if run else -.12,(1,0,0))
   if name=='Attack':
    points=[(0,0),(.25,.45),(.5,-1.35),(.65,-1.15),(1,0)]
    for (a,x),(b,y) in zip(points,points[1:]):
     if a<=phase<=b:arm=x+(y-x)*(phase-a)/(b-a);break
    angles={'upperarm_r':(arm,(1,0,0)),'lowerarm_r':(-.5*(1-abs(math.sin(phase*math.pi))),(1,0,0)),'spine_03':(.12*math.sin(phase*2*math.pi),(0,0,1)),'upperarm_l':(-.3*math.sin(phase*math.pi),(1,0,0))}
   if name=='Hit':
    recoil=math.sin(phase*math.pi);angles={'spine_01':(-.24*recoil,(1,0,0)),'head':(-.12*recoil,(1,0,0)),'upperarm_l':(.25*recoil,(1,0,0)),'upperarm_r':(.25*recoil,(1,0,0))}
   if name=='Down':
    t=min(1,phase/.7);t=t*t*(3-2*t);angles={'Root':(math.pi/2*t,(1,0,0)),'calf_l':(.3*t,(1,0,0)),'thigh_l':(.25*t,(1,0,0)),'upperarm_l':(.3*t,(0,0,1)),'upperarm_r':(-.3*t,(0,0,1))};root_z=.15*t
   if name=='Rescue':
    reach=.08*math.sin(phase*4*math.pi);root_z=-.32;angles={'thigh_l':(-.7,(1,0,0)),'thigh_r':(-.7,(1,0,0)),'calf_l':(1.55,(1,0,0)),'calf_r':(1.55,(1,0,0)),'spine_01':(.3,(1,0,0)),'foot_l':(-.85,(1,0,0)),'foot_r':(-.85,(1,0,0)),'upperarm_l':(-.85+reach,(1,0,0)),'upperarm_r':(-.85-reach,(1,0,0))}
   if name=='Cast':
    reach=math.sin(phase*math.pi);angles={'upperarm_l':(-1.15*reach,(1,0,0)),'upperarm_r':(-1.15*reach,(1,0,0)),'spine_03':(-.1*reach,(1,0,0))}
   for bone,(angle,axis) in angles.items():rotate(r.pose.bones[bone],base[bone],axis,angle)
   r.pose.bones['Root'].location=r.pose.bones['Root'].bone.matrix_local.to_quaternion().inverted()@Vector((0,0,root_z))
   for b in r.pose.bones:b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name)
   r.pose.bones['Root'].keyframe_insert('location',frame=frame,group='Root')
  track=r.animation_data.nla_tracks.new();track.name=action.name;strip=track.strips.new(action.name,0,action);strip.blend_type='REPLACE';track.mute=True
 r.animation_data.action=bpy.data.actions[key+'_Idle'];s.frame_set(1);bpy.context.view_layer.update()
 location=r.location.copy();r.location.x=0;r.location.y=0
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
 for o in r.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=r
 path=STAGE/(key+'.glb')
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_morph=False,export_extras=True)
 normalize(path,key,preserve_actions=True)
 r.location=location
 report.append({'appearance':key,'clips':list(CLIPS),'bytes':path.stat().st_size});print('ACTIONS_EXPORTED',key,flush=True)
s['animation_stage']='v0.9 authored keyframe actions; visual polish and full action set still pending';s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(STAGE/'workplace-characters.blend'))
for item in report:os.replace(STAGE/(item['appearance']+'.glb'),OUT/(item['appearance']+'.glb'))
os.replace(STAGE/'workplace-characters.blend',OUT/'workplace-characters.blend')
manifest=json.loads((OUT/'manifest.json').read_text());manifest['version']='0.9';manifest['animationSource']='blender/animate_characters.py';manifest['actions']=CLIPS
for c in manifest['characters']:c['animations']=[c['appearance']+'_'+name for name in CLIPS]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(ROOT/'blender/animation-report.json').write_text(json.dumps({'version':'0.9','characters':report},indent=2)+'\n')
print('ANIMATION_LIBRARY_SAVED',flush=True)
# Real 3D contact sheet: one native clip per model, not an AI illustration.
for i,r in enumerate(rigs):
 r.animation_data.action=bpy.data.actions[r.name.removesuffix('_Rig')+'_'+list(CLIPS)[i]];r.location.x=i*1.5-5.25;r.location.y=0
s.frame_set(10);cam=s.camera;cam.location=(0,-16,4);cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=43
s.cycles.samples=8;s.render.resolution_x=1800;s.render.resolution_y=650;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/'assets/renders/character-actions-v09.png');bpy.ops.render.render(write_still=True)
