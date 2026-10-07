"""Independent grip candidate on real weighted fingers; source bank stays intact."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/animations/weapon-grip-v2';OUT.mkdir(exist_ok=True)
SOURCE=ROOT/'assets/animations/weapon-poses-v1/weapon-pose-pilot.blend';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before=sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE');refs=json.loads((SOURCE.parent/'weapon-reference.json').read_text())
for t in rig.animation_data.nla_tracks:t.mute=True
records=[]
def update():bpy.context.view_layer.update()
def world(b):return rig.matrix_world@b.matrix
for family in ['pistol','rifle']:
 for shot in [False,True]:
  name='Weapon_'+family.title()+('Shot' if shot else 'Hold');action=bpy.data.actions[name];rig.animation_data.action=action;s.frame_set(0);update()
  end=round(action.frame_range[1]);snapshots=[]
  names=[f'{finger}_{n:02d}_r' for finger in ['middle','ring','pinky','thumb'] for n in [1,2,3]]
  for frame in range(end+1):
   s.frame_set(frame);update();snapshots.append({n:rig.pose.bones[n].rotation_quaternion.copy() for n in names})
  s.frame_set(0);update()
  reference=refs[family];grip=reference['grip'];R=Matrix.Rotation(grip['rotation'][2],4,'Z');R.translation=Vector(grip['position']);part=next(p for p in reference['parts'] if p['name']=='握把')
  box=world(rig.pose.bones['hand_r'])@R@Matrix.Translation(Vector(part['pos']))@Matrix.Rotation(math.radians(part.get('tilt',0)),4,'Z');inverse=box.inverted();size=part['size'];offsets={};contacts=[]
  for finger in ['middle','ring','pinky','thumb']:
   bones=[rig.pose.bones[f'{finger}_{n:02d}_r'] for n in [1,2,3]];base=[b.rotation_quaternion.copy() for b in bones]
   root=world(bones[0]).translation;local=inverse@root
   target=box@Vector((size[0]*.35 if finger=='thumb' else -size[0]/2+.007,max(-size[1]/2+.012,min(size[1]/2-.012,local.y)),(-1 if finger=='thumb' else 1)*(size[2]/2+.006)))
   tip=lambda:rig.matrix_world@bones[-1].tail
   axis=(tip()-root).cross(target-root).normalized();axes=[world(b).to_quaternion().inverted()@axis for b in bones];angles=[0.,0.,0.];limits=[math.radians(95),math.radians(105),math.radians(80)]
   start=(tip()-target).length
   def apply():
    for b,q,a,v in zip(bones,base,angles,axes):b.rotation_quaternion=q@Quaternion(v,a)
    update();return (tip()-target).length
   for step in [12,6,3,1.5]:
    for iteration in range(12):
     changed=False
     for i in [2,1,0]:
      old=angles[i];best=apply();choice=old
      for delta in [-math.radians(step),math.radians(step)]:
       angles[i]=max(0,min(limits[i],old+delta));error=apply()
       if error<best-1e-7:best=error;choice=angles[i]
      angles[i]=choice;apply();changed|=abs(choice-old)>1e-8
     if not changed:break
   error=apply()
   for b,q in zip(bones,base):offsets[b.name]=q.inverted()@b.rotation_quaternion
   contacts.append({'finger':finger,'target':list(target),'beforeMetres':start,'afterMetres':error,'anglesDegrees':[math.degrees(a) for a in angles]})
   assert error<start*.8,(name,finger,start,error)
  for frame,pose in enumerate(snapshots):
   s.frame_set(frame)
   for n,q in pose.items():rig.pose.bones[n].rotation_quaternion=q@offsets[n];rig.pose.bones[n].keyframe_insert('rotation_quaternion',frame=frame,group=n)
  records.append({'clip':name,'frames':len(snapshots),'contacts':contacts})
  print('GRIP_CANDIDATE',json.dumps(records[-1]),flush=True)
rig.animation_data.action=bpy.data.actions['Weapon_PistolHold'];s.frame_set(0);update()
for f in ['pistol','rifle']:
 group=bpy.data.objects['持握验证_'+f];group.matrix_world=world(rig.pose.bones['hand_r']);group.hide_render=f!='pistol'
 for p in group.children[0].children:p.hide_render=f!='pistol'
s['production_stage']='Right middle/ring/pinky/thumb closure candidate; index, wrist anatomy and left-hand fit pending'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bank=OUT/'workplace-weapon-grip.glb';bpy.ops.export_scene.gltf(filepath=str(bank),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_cameras=False,export_lights=False)
bpy.ops.file.pack_all();blend=OUT/'weapon-grip-pilot.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend));assert sha(SOURCE)==before
(OUT/'manifest.json').write_text(json.dumps({'version':'weapon-grip-v0.2','source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':before,'generatorSHA256':sha(Path(__file__)),'blendSHA256':sha(blend),'glbSHA256':sha(bank),'clips':records,'runtimeIntegrated':False,'limitations':['Right-hand candidate only','Bone-tail objectives are not mesh contact verification','Index/trigger contact, wrist anatomy and left support still pending','Source reload, GLB reimport and render verification pending']},ensure_ascii=False,indent=2)+'\n')
