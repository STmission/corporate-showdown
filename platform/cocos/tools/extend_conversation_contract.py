"""Explicit migration: retain prior identities, add Talk and two authored professions."""
import json
import uuid
from pathlib import Path

PROJECT=Path(__file__).resolve().parents[1]
SAMPLER=('wrapModeS','wrapModeT','minfilter','magfilter','mipfilter','anisotropy')

def extend():
    path=PROJECT/'asset-identities.json'
    contract=json.loads(path.read_text())
    sources=json.loads((PROJECT/'source-assets.json').read_text())
    expected_images=set()
    for source in sources:
        name=Path(source['destination']).stem
        gltf=json.loads((PROJECT/source['destination']).read_text())
        meta=json.loads((PROJECT/'assets/resources'/f'{name}.gltf.meta').read_text())
        if not meta['imported']:raise ValueError('Actual editor import required: '+name)
        subs=meta['subMetas']
        prefabs=[v['uuid'] for v in subs.values() if v['importer']=='gltf-scene']
        animations={k:{'uuid':v['uuid'],'name':v['name'],'settings':v['userData']} for k,v in subs.items() if v['importer']=='gltf-animation'}
        meshes=sum(v['importer']=='gltf-mesh' for v in subs.values())
        skeletons=sum(v['importer']=='gltf-skeleton' for v in subs.values())
        samplers={k:{s:v['userData'][s] for s in SAMPLER} for k,v in subs.items() if v['importer']=='texture'}
        if meshes!=len(gltf['meshes']) or skeletons!=len(gltf.get('skins',[])):raise ValueError('Source/import counts differ: '+name)
        if {v['name'].removesuffix('.animation') for v in animations.values()}!={a['name'] for a in gltf.get('animations',[])}:raise ValueError('Source/import animation names differ: '+name)
        prior=contract['models'].get(name)
        if prior:
            if meta['uuid']!=prior['uuid'] or prefabs!=prior['prefabs'] or meshes!=prior['meshes'] or skeletons!=prior['skeletons'] or samplers!=prior['textureSamplers']:raise ValueError('Prior import identity/sampler drift: '+name)
            for key,value in prior['animations'].items():
                if animations.get(key)!=value:raise ValueError('Prior animation identity/settings drift: '+name)
            added=[v for key,v in animations.items() if key not in prior['animations']]
            if added and (len(added)!=1 or not added[0]['name'].removesuffix('.animation').endswith('_Talk')):raise ValueError('Unexpected animation contract expansion')
            prior['animations']=animations
        else:
            if name not in ('female_doctor','female_teacher') or meta['uuid']!=str(uuid.uuid5(uuid.NAMESPACE_URL,'corporate-showdown/'+source['source'])):raise ValueError('Unexpected new model identity')
            if len(animations)!=9 or skeletons!=1 or meshes!=(15 if name=='female_doctor' else 16):raise ValueError('New profession contract mismatch')
            contract['models'][name]={'uuid':meta['uuid'],'prefabs':prefabs,'meshes':meshes,'skeletons':skeletons,'animations':animations,'textureSamplers':samplers}
        for image in gltf.get('images',[]):expected_images.add(image['uri'])
    if set(contract['models'])!={Path(s['destination']).stem for s in sources}:raise ValueError('Contract/source inventory mismatch')
    contract['sharedImages']=len(expected_images)
    contract['conversationMigration']='0.3.2: original identities/settings preserved, rotation-only Talk and two new profession models added after actual Cocos import'
    path.write_text(json.dumps(contract,indent=2)+'\n')
    print('Extended contract:',len(contract['models']),'models;',len(expected_images),'source-derived shared images')

if __name__=='__main__':extend()
