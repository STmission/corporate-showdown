"""Cut actual weighted arms/sleeves into editable assets; never replace actors."""
import bpy, bmesh, json, hashlib, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/characters/first-person-v1';OUT.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
sources=json.loads((ROOT/'assets/characters/weapon-ready-v1/manifest.json').read_text())
records=[]
for source in sources['characters']:
    slot=source['slot'];path=ROOT/source['glb'];before=sha(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    s=bpy.context.scene;s.render.fps=24
    rig=next(o for o in s.objects if o.type=='ARMATURE')
    assert len(rig.data.bones)==53
    for t in rig.animation_data.nla_tracks:t.mute=True
    rig.animation_data.action=next(t.strips[0].action for t in rig.animation_data.nla_tracks if t.name==slot+'_PistolHold')
    s.frame_set(0);bpy.context.view_layer.update()
    arm_names=set()
    def descend(b):
        arm_names.add(b.name)
        for c in b.children:descend(c)
    for side in ['r','l']:descend(rig.data.bones['lowerarm_'+side])
    meshes=[];counts=[]
    for o in list(s.objects):
        if o.type!='MESH':continue
        if not any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers):
            bpy.data.objects.remove(o,do_unlink=True);continue
        groups={g.index:g.name for g in o.vertex_groups}
        keep={v.index for v in o.data.vertices if sum(g.weight for g in v.groups if groups.get(g.group) in arm_names)>=.65}
        original=len(o.data.polygons)
        bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table()
        # Require every face corner to belong to arm weights, avoiding torso patches.
        faces=[f for f in bm.faces if not all(v.index in keep for v in f.verts)]
        bmesh.ops.delete(bm,geom=faces,context='FACES')
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
        bm.to_mesh(o.data);bm.free();o.data.update()
        if not o.data.polygons:
            bpy.data.objects.remove(o,do_unlink=True);continue
        assert len(o.data.polygons)<original,(slot,o.name,'cut did not remove torso')
        meshes.append(o);counts.append({'mesh':o.name,'sourceFaces':original,'armFaces':len(o.data.polygons),'vertices':len(o.data.vertices)})
    assert meshes and sum(c['armFaces'] for c in counts)>100,(slot,'empty arm asset')
    assert any('hand_r' in [g.name for g in o.vertex_groups] for o in meshes)
    s['asset_stage']='Actual skinned forearms/hands/sleeve ends at >=0.65 forearm weights; camera placement and runtime validation pending'
    s['source_glb']=source['glb'];s['source_sha256']=before
    bpy.ops.object.select_all(action='DESELECT')
    for o in [rig,*meshes]:o.select_set(True)
    bpy.context.view_layer.objects.active=rig
    glb=OUT/(slot+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_cameras=False,export_lights=False)
    bpy.ops.file.pack_all();blend=OUT/(slot+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    assert len(next(o for o in bpy.context.scene.objects if o.type=='ARMATURE').data.bones)==53
    assert sha(path)==before
    records.append({'slot':slot,'source':source['glb'],'sourceSHA256':before,'glb':str(glb.relative_to(ROOT)),'glbSHA256':sha(glb),'blend':str(blend.relative_to(ROOT)),'blendSHA256':sha(blend),'meshes':counts,'bones':53,'sourceReload':True})
    print('FIRST_PERSON_EXTRACTED',slot,counts,flush=True)
(OUT/'manifest.json').write_text(json.dumps({'version':'first-person-v0.1','generatorSHA256':sha(Path(__file__)),'sourceCharacterBankSHA256':sha(ROOT/'assets/characters/weapon-ready-v1/manifest.json'),'characters':records,'runtimeIntegrated':False,'limitations':['Open elbow edges must stay outside camera; camera fit pending','Finger closure and reload pending','Actual GLB reimport/render validation recorded separately']},ensure_ascii=False,indent=2)+'\n')
