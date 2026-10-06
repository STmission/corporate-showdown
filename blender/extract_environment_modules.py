"""Non-destructive module extraction from the approved v0.8 Blender source."""
import bpy,json,hashlib,sys
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'assets/models/coastal-headquarters.blend';OUT=ROOT/'assets/environment-modules/staging';OUT.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
before=sha(SOURCE);bpy.ops.wm.open_mainfile(filepath=str(SOURCE));original=bpy.context.scene
specs=[('office','办公工位与独立办公室','01_Office',[-20,0,0]),('central-lounge','中央休息区','02_Central_Lounge',[0,0,-9]),('townhall','演讲活动区','03_Townhall',[16,0,-10]),('pantry','综合茶水间','04_Pantry',[27,0,-5]),('service-core','电梯与卫浴核心','05_Service_Core',[0,0,12]),('cats-rest','猫区与植物休憩','06_Cats_And_Rest',[15,0,14]),('meeting-rooms','会议与交流房间','07_Meeting_Rooms',[20,0,8]),('architecture','建筑壳体','08_Architecture',[0,0,0]),('coastal-exterior','海岸与楼外环境','09_Coastal_Exterior',[0,0,0])]
by_collection={c:key for key,_,c,_ in specs};groups={s[0]:[] for s in specs}
def assign(o):
 collections=[c.name for c in o.users_collection]
 for c in collections:
  if c in by_collection:return by_collection[c]
 if '14_Navigation_Corrections' in collections:return 'pantry'
 p=o.matrix_world@Vector(sum((Vector(v) for v in o.bound_box),Vector())/8);x,z=p.x,-p.y
 if abs(x)<7 and z>4:return 'service-core'
 if abs(x)<8:return 'central-lounge'
 if x<0:return 'office'
 if z>8:return 'meeting-rooms' if x>22 else 'cats-rest'
 if z>2:return 'meeting-rooms'
 return 'pantry' if x>24 or z>0 else 'townhall'
source_objects=[o for o in original.objects if o.type=='MESH' and not o.get('environment_character',False)]
for o in source_objects:groups[assign(o)].append(o)
report={'revision':'environment-modules-v0.1','layoutRevision':original.get('collision_revision'),'source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':before,'scriptSHA256':sha(Path(__file__)),'units':'meters','axis':'GLB +Y up; Blender +Z up','sourceMeshCount':len(source_objects),'modules':[],'status':'generated; source reopen and actual GLB reassembly pending'}
for key,title,collection,pivot in specs:
 scene=bpy.data.scenes.new(key);scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1;scene['module_id']=key;scene['source_revision']=report['layoutRevision'];bpy.context.window.scene=scene;origin=Vector((pivot[0],-pivot[2],pivot[1]));objects=[]
 for original_object in groups[key]:
  copy=original_object.copy();copy.parent=None;copy.matrix_world=Matrix.Translation(-origin)@original_object.matrix_world;copy['source_object']=original_object.name;copy['environment_module']=key;scene.collection.objects.link(copy);objects.append(copy)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.hide_set(False);o.select_set(True)
 bpy.ops.file.pack_all();blend=OUT/(key+'.blend');bpy.data.libraries.write(str(blend),{scene},compress=True)
 glb=OUT/(key+'.glb');bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_animations=False,export_extras=True,export_skins=False,export_cameras=False,export_lights=False)
 report['modules'].append({'id':key,'title':title,'collection':collection,'placement':pivot,'sourceObjects':[o.name for o in groups[key]],'meshes':len(objects),'blend':blend.name,'glb':glb.name,'blendSHA256':sha(blend),'glbSHA256':sha(glb),'bytes':glb.stat().st_size})
 bpy.context.window.scene=original;bpy.data.scenes.remove(scene)
 for o in objects:bpy.data.objects.remove(o,do_unlink=True)
assert sha(SOURCE)==before
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('MODULE_EXTRACTION_COMPLETE',len(source_objects),flush=True)
