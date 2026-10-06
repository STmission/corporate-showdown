import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/characters/library-v1';manifest=json.loads((OUT/'manifest.json').read_text());checks=[]
assert hashlib.sha256((ROOT/manifest['source']).read_bytes()).hexdigest()==manifest['sourceSHA256']
for item in manifest['characters']:
 path=ROOT/item['blend'];assert hashlib.sha256(path.read_bytes()).hexdigest()==item['blendSHA256'];bpy.ops.wm.open_mainfile(filepath=str(path))
 rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(rigs)==1 and len(meshes)==9
 rig=rigs[0];assert rig.name==item['id']+'_Rig' and len(rig.data.bones)==53
 assert all(any(m.type=='ARMATURE' and m.object==rig for m in obj.modifiers) for obj in meshes)
 clips=[t.name for t in rig.animation_data.nla_tracks];assert len(clips)==8 and clips==item['clips'];assert tuple(rig.location)==(0,0,0)
 images=[i for i in bpy.data.images if i.type!='RENDER_RESULT'];assert all(i.packed_file or i.packed_files for i in images)
 item['status']='individual Blender source reload verified; visual refinement pending'
 checks.append({'id':item['id'],'scene':bpy.context.scene.name,'bones':53,'meshes':9,'clips':clips,'images':len(images),'packedImages':True,'origin':list(rig.location),'bytes':path.stat().st_size});print('LIBRARY_VALIDATED',item['id'],flush=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(OUT/'validation.json').write_text(json.dumps({'scope':'actual individual Blender reload, geometry/rig/action/image/origin checks; visual quality and mobile runtime not accepted','checks':checks},ensure_ascii=False,indent=2)+'\n')
