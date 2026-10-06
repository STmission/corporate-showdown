"""Actual source reload and GLB reimport; preview real skin at a first-person camera."""
import bpy, json, hashlib, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/characters/first-person-v1'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((OUT/'manifest.json').read_text());records=[]
for record in manifest['characters']:
    slot=record['slot'];bpy.ops.wm.open_mainfile(filepath=str(ROOT/record['blend']))
    s=bpy.context.scene;rig=next(o for o in s.objects if o.type=='ARMATURE')
    expected={}
    for name in ['PistolHold','RifleHold','PistolShot','RifleShot']:
        for t in rig.animation_data.nla_tracks:t.mute=True
        rig.animation_data.action=next(t.strips[0].action for t in rig.animation_data.nla_tracks if t.name==slot+'_'+name)
        for frame in [0,3,6]:
            s.frame_set(round(rig.animation_data.action.frame_range[0])+frame);bpy.context.view_layer.update()
            expected[(name,frame)]={n:rig.matrix_world@rig.pose.bones[n].head for n in ['hand_r','hand_l','lowerarm_r','lowerarm_l']}
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/record['glb']))
    s=bpy.context.scene;s.render.fps=24;rig=next(o for o in s.objects if o.type=='ARMATURE')
    assert len(rig.data.bones)==53
    assert len(rig.animation_data.nla_tracks)==16,(slot,len(rig.animation_data.nla_tracks))
    errors=[]
    for (name,frame),positions in expected.items():
        for t in rig.animation_data.nla_tracks:t.mute=True
        rig.animation_data.action=next(t.strips[0].action for t in rig.animation_data.nla_tracks if t.name==slot+'_'+name)
        s.frame_set(round(rig.animation_data.action.frame_range[0])+frame);bpy.context.view_layer.update()
        errors.extend((rig.matrix_world@rig.pose.bones[n].head-v).length for n,v in positions.items())
    assert max(errors)<.002,(slot,max(errors))
    records.append({'slot':slot,'bones':53,'clips':16,'sampledPoses':12,'maximumPositionErrorMetres':max(errors),'blendSHA256':sha(ROOT/record['blend']),'glbSHA256':sha(ROOT/record['glb'])})
    print('FP_IMPORT_VERIFIED',records[-1],flush=True)
    if slot not in ['male_programmer','female_programmer']:continue
    rig.animation_data.action=next(t.strips[0].action for t in rig.animation_data.nla_tracks if t.name==slot+'_PistolHold')
    s.frame_set(0)
    # Source camera backs off 20 cm so wrists below eye height stay in view.
    camera_data=bpy.data.cameras.new('第一人称验证相机');camera=bpy.data.objects.new('第一人称验证相机',camera_data);s.collection.objects.link(camera)
    camera.location=(0,.20,1.55);camera.rotation_euler=(Vector((0,-4,1.55))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.sensor_fit='VERTICAL';camera_data.sensor_height=24;camera_data.lens=24/(2*math.tan(math.radians(70)/2));s.camera=camera
    world=bpy.data.worlds.new('验证世界');s.world=world;world.use_nodes=True
    next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.06,.08,.10,1)
    light_data=bpy.data.lights.new('手臂主光','AREA');light_data.energy=600;light_data.size=3
    light=bpy.data.objects.new('手臂主光',light_data);s.collection.objects.link(light);light.location=(1,-1,3);light.rotation_euler=(Vector((0,-.2,1.3))-light.location).to_track_quat('-Z','Y').to_euler()
    s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.resolution_x=960;s.render.resolution_y=540;s.render.resolution_percentage=100
    s.render.filepath=str(OUT/(slot+'-camera.png'));bpy.ops.render.render(write_still=True)
(OUT/'validation.json').write_text(json.dumps({'scope':'Ten actual source reloads and GLB reimports; two actual skinned camera previews; no runtime/device validation','generatorSHA256':sha(Path(__file__)),'manifestSHA256':sha(OUT/'manifest.json'),'characters':records,'runtimeIntegrated':False},ensure_ascii=False,indent=2)+'\n')
print('FIRST_PERSON_LIBRARY_VERIFIED',flush=True)
