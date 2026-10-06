"""Reload doctor source, import actual GLB, and inspect posed deformation and renders."""
import bpy,json,hashlib,struct
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/characters/professions-v1';manifest=json.loads((OUT/'manifest.json').read_text());KEY=manifest['id'];blend=ROOT/manifest['blend'];glb=ROOT/manifest['glb']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(ROOT/manifest['source'])==manifest['sourceSHA256'];assert sha(blend)==manifest['blendSHA256'];assert sha(glb)==manifest['glbSHA256'];bpy.ops.wm.open_mainfile(filepath=str(blend));s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE');meshes=[o for o in s.objects if o.type=='MESH'];assert len(meshes)==manifest['meshes'];assert len(rig.data.bones)==53;assert len(rig.animation_data.nla_tracks)==8
for o in meshes:
 assert any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers),o.name
 for v in o.data.vertices:
  weights=[g.weight for g in v.groups if rig.data.bones.get(o.vertex_groups[g.group].name)]
  assert sum(weights)>.98,(o.name,v.index,sum(weights))
raw=glb.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);assert len(doc['skins'])==1 and len(doc['skins'][0]['joints'])==53;assert len(doc['meshes'])==manifest['meshes'];assert set(a['name'] for a in doc['animations'])==set(manifest['clips']);assert next(m for m in doc['materials'] if 'high-poly' in m['name'])['alphaMode']=='BLEND';assert all(i.get('bufferView') is not None for i in doc.get('images',[]))
for o in [rig,*meshes]:bpy.data.objects.remove(o,do_unlink=True)
before=set(s.objects);bpy.ops.import_scene.gltf(filepath=str(glb));imported=[o for o in s.objects if o not in before];rig=next(o for o in imported if o.type=='ARMATURE');meshes=[o for o in imported if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)];assert len(meshes)==manifest['meshes'];shapes={b.custom_shape for b in rig.pose.bones if b.custom_shape}
for o in imported:
 if o.type=='MESH' and o not in meshes:assert o in shapes;o.hide_render=True
posed=[]
for name,frame in [('Idle',1),('Walk',10),('Attack',7)]:
 for t in rig.animation_data.nla_tracks:t.mute=True
 track=next(t for t in rig.animation_data.nla_tracks if t.name==KEY+'_'+name);rig.animation_data.action=track.strips[0].action;s.frame_set(frame);bpy.context.view_layer.update();points=[];attachments=[]
 for o in meshes:
  e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=e.to_mesh();p=[e.matrix_world@v.co for v in mesh.vertices];points.extend(p);e.to_mesh_clear()
  if o.name.startswith('Doctor_'):attachments.extend(p)
 assert all(-1.5<p.x<1.5 and -1.5<p.y<1.5 and -.15<p.z<2.1 for p in points),name
 assert attachments and all(.85<p.z<1.55 and abs(p.x)<.3 and -.5<p.y<.5 for p in attachments),(name,'attachment escaped torso')
 posed.append({'clip':name,'frame':frame,'height':max(p.z for p in points)-min(p.z for p in points),'attachmentVertices':len(attachments)})
 s.cycles.samples=16;s.render.filepath=str(OUT/('doctor-glb-'+name.lower()+'.png'));bpy.ops.render.render(write_still=True)
report={'sourceReload':True,'sourceMeshes':manifest['meshes'],'bones':53,'animations':manifest['clips'],'embeddedTextures':len(doc.get('images',[])),'gltfReimport':True,'poses':posed,'blendSHA256':sha(blend),'glbSHA256':sha(glb),'scope':'actual source reload, skin-weight checks, GLB import and three posed render checks; not final art or Cocos/device acceptance','status':'passed'};(OUT/'validation.json').write_text(json.dumps(report,indent=2));manifest['status']='source reload and actual GLB reimport with Idle/Walk/Attack poses validated; renders awaiting visual review';(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('DOCTOR_VALIDATED',flush=True)
