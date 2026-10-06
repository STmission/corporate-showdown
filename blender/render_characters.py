import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/characters/workplace-characters.blend'))
s=bpy.context.scene;s.cycles.samples=24
rigs=sorted([o for o in s.objects if o.type=='ARMATURE'],key=lambda o:o.name)
for i,r in enumerate(rigs):r.location.x=i*1.32-4.62;r.location.y=0
cam=s.camera;cam.location=(0,-14,2.15);cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=43
s.render.resolution_x=2200;s.render.resolution_y=660;s.render.filepath=str(ROOT/'assets/renders/workplace-lineup.png');bpy.ops.render.render(write_still=True)
heroes=[bpy.data.objects['male_sales_Rig'],bpy.data.objects['female_sales_Rig']]
for r in rigs:
 if r not in heroes:
  for o in [r,*r.children_recursive]:o.hide_render=True
for i,r in enumerate(heroes):r.location.x=i*.9-.45;r.location.y=0
cam.location=(.2,-4.0,1.85);cam.rotation_euler=(Vector((0,0,.96))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=48
s.render.resolution_x=1000;s.render.resolution_y=1000;s.render.filepath=str(ROOT/'assets/renders/workplace-heroes.png');bpy.ops.render.render(write_still=True)
