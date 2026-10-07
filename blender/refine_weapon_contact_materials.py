"""Material-only postprocess of v3: convert reference sRGB colors to linear.
The generated rig, actions, geometry and animation GLB must remain unchanged.
"""
import bpy
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/animations/weapon-grip-v3'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = OUT/'weapon-grip-pilot.blend'
bank = OUT/'workplace-weapon-grip.glb'
report = json.loads((OUT/'manifest.json').read_text())
assert sha(source)==report['blendSHA256'] and sha(bank)==report['glbSHA256']
input_hash = sha(source)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type=='ARMATURE')
for track in rig.animation_data.nla_tracks:
    track.mute = True
current_action,current_frame = rig.animation_data.action,scene.frame_current

def poses():
    digest = hashlib.sha256()
    for item in report['clips']:
        rig.animation_data.action = bpy.data.actions[item['clip']]
        for frame in range(item['frames']):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            for bone in rig.pose.bones:
                digest.update(struct.pack('<16f',*[bone.matrix[r][c] for r in range(4) for c in range(4)]))
    return digest.hexdigest()

pose_hash = poses()
refs = json.loads((OUT/'weapon-reference.json').read_text())
material_records = []
for family,ref in refs.items():
    parent = bpy.data.objects['持握验证_'+family].children[0]
    for obj in parent.children:
        name = obj.name.rsplit('.',1)[0] if obj.name.rsplit('.',1)[-1].isdigit() else obj.name
        part = next(p for p in ref['parts'] if p['name']==name)
        material = obj.data.materials[0]
        material.use_nodes = True
        shader = next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        srgb = [int(part['color'].lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
        linear = [c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in srgb]
        shader.inputs['Base Color'].default_value = tuple(linear)+(1,)
        material_records.append({'family':family,'part':name,'referenceSRGB':part['color'],'linearBaseColor':linear})
assert poses()==pose_hash, 'Material postprocess changed rig pose sampling'
rig.animation_data.action = current_action
scene.frame_set(current_frame)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(source))
assert sha(bank)==report['glbSHA256'], 'Material postprocess changed animation bank'
report['blendSHA256'] = sha(source)
report['materialRefinement'] = {'generatorSHA256':sha(Path(__file__)),'inputBlendSHA256':input_hash,'outputBlendSHA256':sha(source),'poseSamplesSHA256':pose_hash,'scope':'sRGB reference colors converted to linear Principled base colors; full-frame rig pose fingerprint and GLB byte hash unchanged','materials':material_records}
report['visualStatus'] = 'pending'
report.pop('validationFile',None)
(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('MATERIAL_REFINEMENT_PASSED_RIG_AND_BANK_UNCHANGED',flush=True)
