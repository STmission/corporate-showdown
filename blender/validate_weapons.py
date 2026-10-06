"""Reload every weapon's source and actual export; compare world bounds in metres."""
import bpy,json,struct,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/weapons';manifest=json.loads((OUT/'manifest.json').read_text());results=[]
for weapon in manifest['weapons']:
 blend=OUT/weapon['blend'];glb=OUT/weapon['glb'];assert hashlib.sha256(blend.read_bytes()).hexdigest()==weapon['blendSHA256'];assert hashlib.sha256(glb.read_bytes()).hexdigest()==weapon['glbSHA256']
 bpy.ops.wm.open_mainfile(filepath=str(blend));s=bpy.context.scene;source_meshes=[o for o in s.objects if o.type=='MESH'];assert len(source_meshes)==weapon['parts'];assert not any(o.type=='ARMATURE' for o in s.objects)
 def bounds(meshes):
  bpy.context.view_layer.update();points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];return [[min(v[i] for v in points),max(v[i] for v in points)] for i in range(3)]
 expected=bounds(source_meshes);root=next(o for o in s.objects if o.type=='EMPTY');assert root.location.length<1e-6
 raw=glb.read_bytes();magic,version,total=struct.unpack_from('<4sII',raw);n,kind=struct.unpack_from('<I4s',raw,12);doc=json.loads(raw[20:20+n]);assert magic==b'glTF' and version==2 and total==len(raw) and kind==b'JSON';assert not doc.get('skins') and not doc.get('animations')
 for o in list(s.objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.ops.import_scene.gltf(filepath=str(glb));meshes=[o for o in s.objects if o.type=='MESH'];assert len(meshes)==weapon['parts'];actual=bounds(meshes);error=max(abs(a-b) for pair1,pair2 in zip(expected,actual) for a,b in zip(pair1,pair2));assert error<1e-5,(weapon['id'],error)
 results.append({'id':weapon['id'],'sourceMeshes':len(source_meshes),'importedMeshes':len(meshes),'boundsMeters':actual,'boundsError':error,'sourceReload':True,'gltfReimport':True})
 print('WEAPON_VALIDATED',weapon['id'],flush=True)
(OUT/'validation.json').write_text(json.dumps({'scope':'eight actual source reloads and GLB reimports; bounds/axis/scale consistency, no Cocos or device art acceptance','weapons':results},ensure_ascii=False,indent=2)+'\n')
manifest['status']='eight source reloads and actual GLB reimports validated; independent library render inspected; runtime uses shared part definitions, export bevel geometry not yet used by Cocos'
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('WEAPONS_VALIDATED',flush=True)
