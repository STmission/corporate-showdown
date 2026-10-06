"""Original modular gun/melee source assets. Shared dimensions; bevels for export.
No weapon parts copied from another game's models. Not production art acceptance.
"""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/weapons'
data=json.loads((OUT/'parts.json').read_text());report={'source':data['source'],'sourceSHA256':data['sourceSHA256'],'scriptSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'license':'Original project-authored part definitions and geometry','status':'source and export generated; reload and visual verification pending','weapons':[]}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.unit_settings.system='METRIC';s.unit_settings.scale_length=1;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True
materials={}
def material(color):
 if color not in materials:
  m=bpy.data.materials.new('Original_'+color);m.use_nodes=True;p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=tuple(int(color[i:i+2],16)/255 for i in [1,3,5])+(1,);p.inputs['Roughness'].default_value=.55;p.inputs['Metallic'].default_value=.38;materials[color]=m
 return materials[color]
assets=[]
for weapon in data['weapons']:
 bpy.ops.object.select_all(action='DESELECT');root=bpy.data.objects.new('武器_'+weapon['id'],None);s.collection.objects.link(root);objs=[]
 for part in weapon['parts']:
  if part['shape']=='box':
   bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;a,b,c=part['size'];o.scale=(a,c,b);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.rotation_euler.y=-part.get('tilt',0)*math.pi/180
  else:
   bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=part['r'],depth=part['length']);o=bpy.context.object;axis={'x':Vector((1,0,0)),'y':Vector((0,0,1)),'z':Vector((0,-1,0))}[part.get('axis','x')];o.rotation_euler=Vector((0,0,1)).rotation_difference(axis).to_euler()
  o.name=weapon['id']+'_'+part['name'];x,y,z=part['pos'];o.location=(x,-z,y);o.parent=root;o.data.materials.append(material(part['color']))
  bevel=o.modifiers.new('圆角','BEVEL');bevel.width=.003;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name);objs.append(o)
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in objs:o.select_set(True)
 glb=OUT/(weapon['id']+'.glb');bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
 # Write only this character-free weapon source, independent of the rest of the library.
 scene=bpy.data.scenes.new(weapon['id']+'_Asset');scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 for o in [root,*objs]:scene.collection.objects.link(o)
 bpy.context.window.scene=scene;bpy.context.view_layer.update();blend=OUT/(weapon['id']+'.blend');bpy.data.libraries.write(str(blend),{scene},compress=True)
 bpy.context.window.scene=s;bpy.data.scenes.remove(scene)
 report['weapons'].append({'id':weapon['id'],'name':weapon['name'],'parts':len(objs),'blend':blend.name,'blendSHA256':hashlib.sha256(blend.read_bytes()).hexdigest(),'glb':glb.name,'glbSHA256':hashlib.sha256(glb.read_bytes()).hexdigest(),'vertices':sum(len(o.data.vertices) for o in objs)});assets.append(root)
 print('WEAPON_EXPORTED',weapon['id'],flush=True)
for i,root in enumerate(assets):root.location=(i%4*1.5-2.2,i//4*1.4,1)
s.world.use_nodes=True;bg=next(n for n in s.world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs[0].default_value=(.13,.17,.2,1);bg.inputs[1].default_value=.4
for loc,power,size in [((-2,-2,5),450,4),((3,3,3),350,3)]:
 d=bpy.data.lights.new('Weapon_Studio','AREA');d.energy=power;d.size=size;o=bpy.data.objects.new('Weapon_Studio',d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Weapons_Preview');cam=bpy.data.objects.new('Weapons_Preview',d);s.collection.objects.link(cam);cam.location=(1,-5,5.5);cam.rotation_euler=(Vector((0,.65,1))-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=6.8;s.camera=cam
s.render.resolution_x=1400;s.render.resolution_y=800;s.render.resolution_percentage=100;s.render.filepath=str(OUT/'weapon-library.png');bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'weapon-library.blend'));bpy.ops.render.render(write_still=True)
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('WEAPON_LIBRARY_READY',flush=True)
