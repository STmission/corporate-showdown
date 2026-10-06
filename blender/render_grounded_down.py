"""Render actual ten editable grounded assets together on a contact floor."""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/characters/grounded-v1'
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=24
records=json.loads((OUT/'manifest.json').read_text())['characters']
for i,c in enumerate(records):
 with bpy.data.libraries.load(str(ROOT/c['blend']),link=False) as (src,dst):dst.objects=src.objects
 objects=[o for o in dst.objects if o]
 for o in objects:s.collection.objects.link(o)
 rig=next(o for o in objects if o.type=='ARMATURE');rig.location+=Vector(((i%5-2)*2.15,(i//5)*3.3,0))
 # Imported meshes share rig transforms through their parent; helpers stay hidden.
 for o in objects:
  if o.type=='MESH' and not any(m.type=='ARMATURE' for m in o.modifiers):o.hide_render=True
 s.frame_set(18);bpy.context.view_layer.update()
 bpy.ops.object.text_add(location=((i%5-2)*2.15-.75,(i//5)*3.3+.35,.006));label=bpy.context.object;label.data.body=c['slot'];label.data.size=.14
bpy.ops.mesh.primitive_plane_add(size=35,location=(0,0,0));floor=bpy.context.object;mat=bpy.data.materials.new('Contact_floor');mat.diffuse_color=(.36,.4,.44,1);floor.data.materials.append(mat)
world=bpy.data.worlds.new('Grounding_world');s.world=world;world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[1].default_value=.35
for name,loc,power,size in [('Key',(0,-5,8),1800,7),('Fill',(5,4,6),1000,6)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,.5,0))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('ContactCamera');cam=bpy.data.objects.new('ContactCamera',d);s.collection.objects.link(cam);cam.location=(.8,-8.2,9);cam.rotation_euler=(Vector((0,.9,0))-cam.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=12;s.camera=cam
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=1800;s.render.resolution_y=1100;s.render.resolution_percentage=100;s.render.filepath=str(OUT/'down-contact-sheet.png');bpy.ops.render.render(write_still=True)
print('DOWN_CONTACT_RENDERED',flush=True)
