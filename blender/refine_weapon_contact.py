"""Roll-corrected grip candidate using weighted mesh contact, never the live bank.
All objectives are authoring aids. Actual Blender mesh/render/import QA follows.
"""
import bpy
import hashlib
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'assets/animations/weapon-grip-v3'
OUT.mkdir(exist_ok=True)
SOURCE = ROOT/'assets/animations/weapon-poses-v1/weapon-pose-pilot.blend'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source_hash = sha(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type=='ARMATURE')
refs = json.loads((SOURCE.parent/'weapon-reference.json').read_text())
for track in rig.animation_data.nla_tracks:
    track.mute = True
rig.animation_data.action = bpy.data.actions['Weapon_PistolHold']
scene.frame_set(0)
bpy.context.view_layer.update()
hand = rig.pose.bones['hand_r']
axis = (rig.matrix_world @ hand.matrix).to_quaternion() @ Vector((0,1,0))
width = rig.matrix_world @ rig.pose.bones['index_01_r'].head - rig.matrix_world @ rig.pose.bones['pinky_01_r'].head
width = (width-axis*width.dot(axis)).normalized()
up = Vector((0,0,1))
up = (up-axis*up.dot(axis)).normalized()
roll_angle = math.atan2(axis.dot(width.cross(up)),width.dot(up))
roll = Quaternion((0,1,0),roll_angle)
roll_matrix = roll.to_matrix().to_4x4()
print('ANATOMICAL_HAND_ROLL_DEGREES', math.degrees(roll_angle),flush=True)
records = []
new_refs = {}

def update():
    bpy.context.view_layer.update()

def world(bone):
    return rig.matrix_world @ bone.matrix

# Linear-blend skinning objective based on every weighted finger vertex.
# Exact evaluated Blender vertices are checked independently after saving.
meshes = [o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
for obj in meshes:
    assert not any(m.type=='ARMATURE' and m.use_deform_preserve_volume for m in obj.modifiers), 'Dual-quaternion skinning needs another evaluator'
caches = {}
for finger in ['index','middle','ring','pinky','thumb']:
    points, weights, tip_mask = [], [], []
    for obj in meshes:
        groups = {g.index:g.name for g in obj.vertex_groups}
        for vertex in obj.data.vertices:
            w = {groups[g.group]:g.weight for g in vertex.groups if groups[g.group] in rig.pose.bones and g.weight>1e-6}
            if sum(w.get(f'{finger}_{i:02d}_r',0) for i in [1,2,3])<.5:
                continue
            points.append(list(rig.matrix_world.inverted() @ obj.matrix_world @ vertex.co)+[1])
            weights.append(w)
            tip_mask.append(w.get(f'{finger}_03_r',0)>=.5)
    names = sorted(set(n for w in weights for n in w))
    w_array = np.array([[w.get(n,0) for n in names] for w in weights])
    points = np.array(points)
    mask = np.array(tip_mask)
    assert mask.any() and len(points)>30
    # Distal skin extremity in the rest joint's local Y, not imported bone.tail.
    distal = rig.data.bones[f'{finger}_03_r']
    local = (np.array(distal.matrix_local.inverted()) @ points.T).T[:,1]
    mask &= local>=np.quantile(local[mask],.8)
    caches[finger] = (points,names,w_array,mask)

def skin(finger):
    points,names,weights,mask = caches[finger]
    matrices = np.array([rig.matrix_world @ rig.pose.bones[n].matrix @ rig.data.bones[n].matrix_local.inverted() for n in names])
    deformed = np.einsum('nb,bij,nj->ni',weights,matrices,points)[:,:3]
    return deformed, deformed[mask].mean(axis=0)

for family in ['pistol','rifle']:
    for shot in [False,True]:
        name = 'Weapon_'+family.title()+('Shot' if shot else 'Hold')
        action = bpy.data.actions[name]
        rig.animation_data.action = action
        end = round(action.frame_range[1])
        names = ['hand_r']+[f'{f}_{i:02d}_r' for f in caches for i in [1,2,3]]
        snapshots = []
        for frame in range(end+1):
            scene.frame_set(frame)
            update()
            snapshots.append({n:rig.pose.bones[n].rotation_quaternion.copy() for n in names})
        scene.frame_set(0)
        update()
        hand = rig.pose.bones['hand_r']
        hand.rotation_quaternion = snapshots[0]['hand_r'] @ roll
        update()
        # Counter-rotate the socket so the gun still points forward with upright sights.
        original = json.loads(json.dumps(refs[family]))
        part = next(p for p in original['parts'] if p['name']=='握把')
        old_pivot = Vector(part['pos'])
        part['size'] = [.045,.12,.032]
        part['pos'][1] = -.105
        socket = Matrix.Rotation(original['grip']['rotation'][2],4,'Z')
        socket.translation = Vector(original['grip']['position'])
        socket.translation += socket.to_3x3() @ (old_pivot-Vector(part['pos']))
        socket = roll_matrix.inverted() @ socket @ Matrix.Translation(Vector((-.009,0,.026)))
        part = next(p for p in original['parts'] if p['name']=='握把')
        box = world(hand) @ socket @ Matrix.Translation(Vector(part['pos'])) @ Matrix.Rotation(math.radians(part.get('tilt',0)),4,'Z')
        inverse = np.array(box.inverted())
        half = np.array(part['size'])/2
        reference = json.loads(json.dumps(original))
        reference['grip']['position'] = list(socket.translation)
        reference['grip']['rotation'] = list(socket.to_euler('XYZ'))
        reference['grip']['palm'] = list(socket @ Vector(part['pos']))
        reference['authoredRearwardSocketShiftMetres'] = .009
        reference['authoredLateralSocketShiftMetres'] = .026
        reference['grip']['pivot'] = part['pos'][:]
        reference['anatomicalHandRollDegrees'] = math.degrees(roll_angle)
        reference['socketMatrixColumnMajor'] = [socket[r][c] for c in range(4) for r in range(4)]
        new_refs[family] = reference
        offsets, contacts = {}, []
        for finger in caches:
            bones = [rig.pose.bones[f'{finger}_{i:02d}_r'] for i in [1,2,3]]
            base = [b.rotation_quaternion.copy() for b in bones]
            root = world(bones[0]).translation
            local = box.inverted() @ root
            side = -1 if finger=='thumb' else 1
            target_local = Vector((half[0]+.006,max(-half[1]+.014,min(half[1]-.014,local.y)),side*(half[2]+.006)))
            if finger=='thumb':
                target_local.x = half[0]*.55
            target = box @ target_local
            if finger=='index':
                trigger = next(p for p in original['parts'] if p['name']=='扳机')
                trigger_box = world(hand) @ socket @ Matrix.Translation(Vector(trigger['pos'])) @ Matrix.Rotation(math.radians(trigger.get('tilt',0)),4,'Z')
                target = trigger_box @ Vector((0,0,-trigger['size'][2]/2-.003))
            initial_mesh, initial_tip = skin(finger)
            axis = (Vector(initial_tip)-root).cross(target-root).normalized()
            axes = [world(b).to_quaternion().inverted() @ axis for b in bones]
            spread_axis = Vector((0,1,0)).cross(axes[0]).normalized()
            angles = [0.,0.,0.,0.]
            limits = np.radians([95,105,80,25])
            def apply():
                for i,(b,q,a,v) in enumerate(zip(bones,base,angles,axes)):
                    spread = Quaternion(spread_axis,angles[3]) if i==0 else Quaternion()
                    b.rotation_quaternion = q @ spread @ Quaternion(v,a)
                update()
                mesh,tip = skin(finger)
                points = (inverse[:3,:3] @ mesh.T).T+inverse[:3,3]
                depth = np.maximum(0,np.min(half-np.abs(points),axis=1))
                if finger=='index':
                    trigger_inverse = np.array(trigger_box.inverted())
                    tp = (trigger_inverse[:3,:3] @ mesh.T).T+trigger_inverse[:3,3]
                    trigger_depth = np.maximum(0,np.min(np.array(trigger['size'])/2-np.abs(tp),axis=1))
                    depth = np.maximum(depth,trigger_depth)
                distance = np.linalg.norm(tip-np.array(target))
                score = distance**2+1000*np.mean(depth**2)+100*max(depth)**2
                return score,distance,float(max(depth)),int(np.count_nonzero(depth>.001))
            initial = apply()
            best_angles, best_score = None,float('inf')
            for seed in [[30,75,55,0],[60,75,35,-15],[60,75,35,15],[0,0,0,0]]:
                angles[:] = list(np.radians(seed))
                for step in [12,6,3,1.5,.75]:
                    for iteration in range(10):
                        changed = False
                        for i in [3,2,1,0]:
                            old = angles[i]
                            score = apply()[0]
                            choice = old
                            for delta in [-math.radians(step),math.radians(step)]:
                                angles[i] = max(-limits[i] if i==3 else 0,min(limits[i],old+delta))
                                candidate = apply()[0]
                                if candidate<score-1e-9:
                                    score,choice = candidate,angles[i]
                            angles[i] = choice
                            changed |= abs(choice-old)>1e-8
                        if not changed:
                            break
                score = apply()[0]
                if score<best_score:
                    best_score,best_angles = score,angles[:]
            angles[:] = best_angles
            result = apply()
            for b,q in zip(bones,base):
                offsets[b.name] = q.inverted() @ b.rotation_quaternion
            contacts.append({'finger':finger,'target':list(target),'beforeTipDistanceMetres':initial[1],'afterTipDistanceMetres':result[1],'maximumPenetrationMetres':result[2],'verticesInsideGrip':result[3],'anglesDegrees':list(np.degrees(angles[:3])),'mcpSpreadDegrees':math.degrees(angles[3])})
        for frame,pose in enumerate(snapshots):
            scene.frame_set(frame)
            for n,q in pose.items():
                bone = rig.pose.bones[n]
                bone.rotation_quaternion = q @ (roll if n=='hand_r' else offsets[n])
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=n)
        records.append({'clip':name,'frames':len(snapshots),'contacts':contacts})
        print('MESH_CONTACT_CANDIDATE',json.dumps(records[-1]),flush=True)

rig.animation_data.action = bpy.data.actions['Weapon_PistolHold']
scene.frame_set(0)
update()
for family,reference in new_refs.items():
    group = bpy.data.objects['持握验证_'+family]
    group.matrix_world = world(rig.pose.bones['hand_r'])
    child = group.children[0]
    child.matrix_basis = Matrix([reference['socketMatrixColumnMajor'][i::4] for i in range(4)])
    group.hide_render = family!='pistol'
    for obj in child.children:
        label = obj.name.rsplit('.',1)[0] if obj.name.rsplit('.',1)[-1].isdigit() else obj.name
        part = next(p for p in reference['parts'] if p['name']==label)
        if part['shape']=='box':
            obj.scale = part['size']
        obj.location = part['pos']
        obj.hide_render = family!='pistol'
        material = obj.data.materials[0]
        material.use_nodes = True
        h = part['color'].lstrip('#')
        color = tuple(int(h[i:i+2],16)/255 for i in (0,2,4))+(1,)
        shader = next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        shader.inputs['Base Color'].default_value = color
scene['production_stage'] = 'Roll-corrected weighted-mesh grip candidate; independent visual and contact QA required'
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bank = OUT/'workplace-weapon-grip.glb'
bpy.ops.export_scene.gltf(filepath=str(bank),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_cameras=False,export_lights=False)
bpy.ops.file.pack_all()
blend = OUT/'weapon-grip-pilot.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
assert sha(SOURCE)==source_hash
(OUT/'weapon-reference.json').write_text(json.dumps(new_refs,ensure_ascii=False,indent=2)+'\n')
(OUT/'manifest.json').write_text(json.dumps({'version':'weapon-grip-v0.3','source':str(SOURCE.relative_to(ROOT)),'sourceSHA256':source_hash,'generatorSHA256':sha(Path(__file__)),'blendSHA256':sha(blend),'glbSHA256':sha(bank),'clips':records,'runtimeIntegrated':False,'visualStatus':'pending','limitations':['Right hand roll and five fingers only','Left support and trigger press animation pending','Exact evaluated Blender mesh and independent import/render QA pending','Socket counter-rotation and resized grip geometry must accompany bank if integrated']},ensure_ascii=False,indent=2)+'\n')
