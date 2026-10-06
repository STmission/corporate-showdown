"""Extract editable, portable single-character source assets without replacing the master."""
import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/characters/workplace-characters.blend'
OUT=ROOT/'assets/characters/library-v1';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
report={'source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'toolSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'scope':'editable source extraction; original v0.9 art and animations, visual refinement pending','characters':[]}
original_scene=bpy.context.scene
rigs=sorted([o for o in bpy.data.objects if o.type=='ARMATURE'],key=lambda o:o.name)
assert len(rigs)==8
for rig in rigs:
 key=rig.name.removesuffix('_Rig');meshes=[o for o in rig.children_recursive if o.type=='MESH'];assert len(rig.data.bones)==53 and len(meshes)==9
 scene=bpy.data.scenes.new(key+'_Asset');scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 collection=bpy.data.collections.new(key+'_Character');scene.collection.children.link(collection)
 for obj in [rig,*meshes]:collection.objects.link(obj)
 bpy.context.window.scene=scene;bpy.context.view_layer.update()
 location=rig.location.copy();rig.location=(0,0,0)
 destination=OUT/(key+'.blend');bpy.data.libraries.write(str(destination),{scene},path_remap='RELATIVE_ALL',fake_user=False,compress=True)
 rig.location=location
 glb=ROOT/'assets/characters'/(key+'.glb')
 report['characters'].append({'id':key,'blend':str(destination.relative_to(ROOT)),'blendSHA256':hashlib.sha256(destination.read_bytes()).hexdigest(),'glb':str(glb.relative_to(ROOT)),'glbSHA256':hashlib.sha256(glb.read_bytes()).hexdigest(),'bones':53,'meshes':9,'clips':[t.name for t in rig.animation_data.nla_tracks],'packedImages':True,'status':'source extracted; individual reload validation pending'})
 bpy.context.window.scene=original_scene
 bpy.data.scenes.remove(scene);bpy.data.collections.remove(collection)
 print('EXTRACTED',key,flush=True)
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
