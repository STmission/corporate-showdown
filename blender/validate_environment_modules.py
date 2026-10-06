"""Independent source reopen, GLB import and reassembly against approved geometry."""
import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/environment-modules/staging';manifest=json.loads((OUT/'manifest.json').read_text());SOURCE=ROOT/manifest['source']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(SOURCE)==manifest['sourceSHA256'];bpy.ops.wm.open_mainfile(filepath=str(SOURCE));original=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get()
def geometry(o):
 e=o.evaluated_get(bpy.context.evaluated_depsgraph_get()) if o.modifiers else o;m=e.to_mesh() if o.modifiers else o.data;m.calc_loop_triangles();points=[e.matrix_world@v.co for v in m.vertices];triangles=len(m.loop_triangles);area=sum((points[t.vertices[1]]-points[t.vertices[0]]).cross(points[t.vertices[2]]-points[t.vertices[0]]).length/2 for t in m.loop_triangles);
 if o.modifiers:e.to_mesh_clear()
 return points,triangles,area
expected={o.name:geometry(o) for o in original.objects if o.type=='MESH' and not o.get('environment_character',False)}
assert len(expected)==manifest['sourceMeshCount'];listed=[name for item in manifest['modules'] for name in item['sourceObjects']];assert len(listed)==len(set(listed))==len(expected);assert set(listed)==set(expected)
source_reloads=[]
for item in manifest['modules']:
 assert sha(OUT/item['blend'])==item['blendSHA256'];assert sha(OUT/item['glb'])==item['glbSHA256']
 # Load only saved module scene in the actual .blend library, independent of originals.
 with bpy.data.libraries.load(str(OUT/item['blend']),link=False) as (src,dst):dst.scenes=src.scenes
 saved=dst.scenes[0];bpy.context.window.scene=saved;assert saved.unit_settings.scale_length==1;meshes=[o for o in saved.objects if o.type=='MESH'];assert len(meshes)==item['meshes'];assert set(o['source_object'] for o in meshes)==set(item['sourceObjects']);shift=Vector((item['placement'][0],-item['placement'][2],item['placement'][1]));worst=0
 for o in meshes:
  points,triangles,area=geometry(o);points=[p+shift for p in points];reference,reference_triangles,reference_area=expected[o['source_object']];assert triangles==reference_triangles
  error=max(abs(fn(p[a] for p in points)-fn(p[a] for p in reference)) for a in range(3) for fn in [min,max]);worst=max(worst,error);assert error<.00003,(item['id'],o.name,error)
 source_reloads.append({'id':item['id'],'meshes':len(meshes),'units':'meters','maxBoundsErrorMeters':worst});bpy.context.window.scene=original
 for s in dst.scenes:bpy.data.scenes.remove(s)
scene=bpy.data.scenes.new('Validated_Module_Reassembly');scene.world=original.world;bpy.context.window.scene=scene;results=[];seen=set()
def nearest_error(a,b):
 tree=KDTree(len(b))
 for i,p in enumerate(b):tree.insert(p,i)
 tree.balance();return max((tree.find(p)[2] for p in a),default=0)
for item in manifest['modules']:
 before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(OUT/item['glb']));imported=[o for o in scene.objects if o not in before and o.type=='MESH'];assert len(imported)==item['meshes'],(item['id'],len(imported),item['meshes'],[o.name for o in imported[:3]])
 shift=Matrix.Translation(Vector((item['placement'][0],-item['placement'][2],item['placement'][1])));worst=0;area_error=0;tri_count=0
 for o in imported:
  local=o.matrix_world.copy();o.parent=None;o.matrix_world=shift@local;name=o['source_object'];assert name not in seen;seen.add(name);actual,triangles,area=geometry(o);points,expected_triangles,expected_area=expected[name];error=max(nearest_error(actual,points),nearest_error(points,actual));worst=max(worst,error);assert error<.0003,(name,error);assert triangles==expected_triangles,(name,triangles,expected_triangles);area_error=max(area_error,abs(area-expected_area)/max(expected_area,1e-6));assert abs(area-expected_area)<max(.001,expected_area*.0002),(name,area,expected_area);tri_count+=triangles
 results.append({'id':item['id'],'importedMeshes':len(imported),'triangles':tri_count,'maxBidirectionalVertexErrorMeters':worst,'maxRelativeAreaError':area_error})
assert seen==set(expected);assert sha(SOURCE)==manifest['sourceSHA256']
# Render actual exported and recomposed scene, with a separate preview camera.
for o in original.objects:
 if o.type=='LIGHT':copy=o.copy();scene.collection.objects.link(copy);copy.matrix_world=o.matrix_world.copy()
data=bpy.data.cameras.new('Module_Reassembly_Camera');cam=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cam);cam.location=(-48,42,40);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=85;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=1200;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'reassembled.png')
# Ceiling is retained in geometry checks but hidden for the cutaway preview only.
for o in scene.objects:
 if o.get('is_ceiling'):o.hide_render=True
bpy.ops.file.pack_all();bpy.data.libraries.write(str(OUT/'reassembled-preview.blend'),{scene},compress=True);bpy.ops.render.render(write_still=True)
report={'sourceSHA256':manifest['sourceSHA256'],'scope':'nine saved Blender scenes loaded; actual nine GLB imports and reassembly; all source mesh IDs, bidirectional world vertices, triangles and surface area compared; cutaway render; no engine/device acceptance','sourceReloads':source_reloads,'modules':results,'sourceMeshes':len(expected),'status':'passed'};(OUT/'validation.json').write_text(json.dumps(report,indent=2));manifest['status']='source scenes reopened and actual GLB reassembly geometry validated; preview rendered; runtime integration pending';manifest['validationScriptSHA256']=sha(Path(__file__));(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('MODULE_VALIDATION_COMPLETE',len(expected),flush=True)
