"""Reload teacher source, import actual GLB, and inspect posed deformation and renders."""
import bpy,json,hashlib,struct
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/characters/professions-v1/teacher';manifest=json.loads((OUT/'manifest.json').read_text());KEY=manifest['id'];blend=ROOT/manifest['blend'];glb=ROOT/manifest['glb']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(ROOT/manifest['source'])==manifest['sourceSHA256'];assert sha(blend)==manifest['blendSHA256'];assert sha(glb)==manifest['glbSHA256'];bpy.ops.wm.open_mainfile(filepath=str(blend));s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE');meshes=[o for o in s.objects if o.type=='MESH'];assert len(meshes)==manifest['meshes'];assert len(rig.data.bones)==53;assert len(rig.animation_data.nla_tracks)==8
for o in meshes:
 assert any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers),o.name
 for v in o.data.vertices:
  weights=[g.weight for g in v.groups if rig.data.bones.get(o.vertex_groups[g.group].name)]
  assert sum(weights)>.98,(o.name,v.index,sum(weights))
raw=glb.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);assert len(doc['skins'])==1 and len(doc['skins'][0]['joints'])==53;assert len(doc['meshes'])==manifest['meshes'];assert set(a['name'] for a in doc['animations'])==set(manifest['clips']);assert next(m for m in doc['materials'] if 'high-poly' in m['name'])['alphaMode']=='BLEND';assert next(m for m in doc['materials'] if m['name']=='Teacher_Clear_Lenses')['alphaMode']=='BLEND';assert all(i.get('bufferView') is not None for i in doc.get('images',[]))
for o in [rig,*meshes]:bpy.data.objects.remove(o,do_unlink=True)
before=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(glb));imported=[o for o in s.objects if o not in before];rig=next(o for o in imported if o.type=='ARMATURE');meshes=[o for o in imported if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)];assert len(meshes)==manifest['meshes'];shapes={b.custom_shape for b in rig.pose.bones if b.custom_shape}
for o in imported:
 if o.type=='MESH' and o not in meshes:assert o in shapes;o.hide_render=True
posed=[]
for name,frame in [('Idle',1),('Walk',10),('Attack',7),('Down',18)]:
 for t in rig.animation_data.nla_tracks:t.mute=True
 track=next(t for t in rig.animation_data.nla_tracks if t.name==KEY+'_'+name);rig.animation_data.action=track.strips[0].action;s.frame_set(frame);bpy.context.view_layer.update();points=[];attachments=[]
 for o in meshes:
  e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=e.to_mesh();p=[e.matrix_world@v.co for v in mesh.vertices];points.extend(p);e.to_mesh_clear()
  if o.name.startswith('Teacher_'):attachments.extend(p)
 print('POSE_BOUNDS',name,[(min(p[i] for p in points),max(p[i] for p in points)) for i in range(3)],flush=True)
 # Down rotates the full 1.68 m body onto the floor, so its forward extent exceeds standing width.
 forward_limit=1.9 if name=='Down' else 1.5
 assert all(-1.5<p.x<1.5 and -forward_limit<p.y<forward_limit and -.15<p.z<2.1 for p in points),name
 head=rig.matrix_world@rig.pose.bones['head'].head
 assert attachments and all((p-head).length<.28 for p in attachments),(name,'glasses escaped head')
 posed.append({'clip':name,'frame':frame,'height':max(p.z for p in points)-min(p.z for p in points),'attachmentVertices':len(attachments)})
 if name=='Down':
  s.camera.location=(2,-3,2);s.camera.rotation_euler=(Vector((0,-.8,.2))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.lens=50
 s.cycles.samples=16;s.render.filepath=str(OUT/('teacher-glb-'+name.lower()+'.png'));bpy.ops.render.render(write_still=True)
report={'sourceReload':True,'sourceMeshes':manifest['meshes'],'bones':53,'animations':manifest['clips'],'embeddedTextures':len(doc.get('images',[])),'gltfReimport':True,'poses':posed,'blendSHA256':sha(blend),'glbSHA256':sha(glb),'scope':'actual source reload, skin-weight checks, GLB import and four posed render checks; not final art or Cocos/device acceptance','status':'passed'};(OUT/'validation.json').write_text(json.dumps(report,indent=2));manifest['status']='source reload and actual GLB reimport with Idle/Walk/Attack poses validated; renders awaiting visual review';(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('TEACHER_VALIDATED',flush=True)
