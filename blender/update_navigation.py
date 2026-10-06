"""Patch the existing editable headquarters, preserving all furniture and employees.
Consumes the shared layout export; emits both complete and character-free gameplay GLBs.
"""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'blender'))
from normalize_glb import normalize
layout=json.loads((ROOT/'assets/models/headquarters-collision.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/models/coastal-headquarters.blend'))
scene=bpy.context.scene

def bounds(o):
 points=[o.matrix_world@Vector(p) for p in o.bound_box]
 lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
 return (lo+hi)/2,hi-lo

def find(x,z,w,d,h):
 result=[]
 for o in scene.objects:
  if o.type!='MESH':continue
  c,s=bounds(o)
  if max(abs(c[0]-x),abs(c[1]+z),abs(c[2]-h/2),abs(s[0]-w),abs(s[1]-d),abs(s[2]-h))<.003:result.append(o)
 return result
# Shorten the two internal shower panes, leaving a 1.3m walkway at the corridor side.
changed=[]
for side in [-1,1]:
 matches=find(side*3.7,18,2.6,.06,2.4)
 if not matches:matches=find(side*3.7,18,1.8,.06,2.4)
 assert len(matches)==1,('Shower pane not uniquely identified',side,len(matches))
 o=matches[0];c,s=bounds(o)
 if abs(s[0]-1.8)>.003:
  o.data=o.data.copy();inv=o.matrix_world.inverted()
  for v in o.data.vertices:
   p=o.matrix_world@v.co;p.x=c.x+(p.x-c.x)*1.8/s.x;v.co=inv@p
  o.data.update()
 changed.append(o.name)
# Toilet stall partitions retain privacy while leaving a usable circulation aisle.
for side in [-1,1]:
 for z in [8.9,12.5]:
  matches=find(side*3.55,z,2.9,.08,2.5)
  if not matches:matches=find(side*3.85,z,2.2,.08,2.5)
  assert len(matches)==1,('Toilet pane not uniquely identified',side,z)
  o=matches[0];c,s=bounds(o)
  if abs(s.x-2.2)>.003:
   o.data=o.data.copy();inv=o.matrix_world.inverted()
   for v in o.data.vertices:
    p=o.matrix_world@v.co;p.x=side*3.85+(p.x-c.x)*2.2/s.x;v.co=inv@p
   o.data.update()
# Replace six overlapping meeting-room front panes with a single shared boundary.
for x,w in [(9.125,2.25),(12.875,2.25),(15.125,2.25),(18.875,2.25),(20.375,.75),(22.625,.75)]:
 for o in find(x,2,w,.07,3.45):bpy.data.objects.remove(o,do_unlink=True)
# Find an existing pantry glass material rather than replacing approved finishes.
source=find(8,-8,.07,20,3.45);assert len(source)==1
material=source[0].data.materials[0]
collection=bpy.data.collections.get('14_Navigation_Corrections')
if not collection:collection=bpy.data.collections.new('14_Navigation_Corrections');scene.collection.children.link(collection)
for o in list(collection.objects):bpy.data.objects.remove(o,do_unlink=True)
for w in layout['walls']:
 if not w['id'].startswith('pantry-south-'):continue
 bpy.ops.mesh.primitive_cube_add(size=1,location=(w['x'],-w['z'],w['h']/2));o=bpy.context.object;o.name='SharedWall_'+w['id'];o.dimensions=(w['w'],w['d'],w['h']);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material)
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o)
# Trace every declared wall to actual world-space mesh geometry.
missing=[]
for w in layout['walls']:
 matches=find(w['x'],w['z'],w['w'],w['d'],w['h'])
 if not matches:missing.append(w['id'])
 for o in matches:o['collision_wall_id']=w['id']
assert not missing,('Shared walls missing from native geometry',missing)
text=bpy.data.texts.get('headquarters-collision.json') or bpy.data.texts.new('headquarters-collision.json');text.clear();text.write(json.dumps(layout,ensure_ascii=False))
scene['collision_revision']=layout['revision'];scene['production_stage']='Native Blender environment v0.8; synchronized wall layout and simple furniture collision'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/models/coastal-headquarters.blend'))
report={'revision':layout['revision'],'modified_shower_panes':changed,'walls_verified':len(layout['walls']),'collision_solids':len(layout['solids']),'exports':{}}
for name,employees in [('coastal-headquarters-complete.glb',True),('coastal-headquarters-gameplay.glb',False)]:
 bpy.ops.object.select_all(action='DESELECT')
 for o in scene.objects:
  if o.type not in {'MESH','EMPTY','ARMATURE'}:continue
  if not employees and o.get('environment_character',False):continue
  o.hide_set(False);o.select_set(True)
 path=ROOT/'assets/models'/name
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_morph=False,export_extras=True,export_skins=employees,export_cameras=False,export_lights=False)
 normalize(path);report['exports'][name]=path.stat().st_size
(ROOT/'blender/navigation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('NAVIGATION_EXPORT_COMPLETE',report,flush=True)
