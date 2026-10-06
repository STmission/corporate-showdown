"""Add ten arm identities after actual import; preserve all prior model contracts."""
import json
import uuid
from pathlib import Path

PROJECT=Path(__file__).resolve().parents[1]
ROOT=PROJECT.parents[1]
SAMPLER=('wrapModeS','wrapModeT','minfilter','magfilter','mipfilter','anisotropy')

def extend():
    path=PROJECT/'asset-identities.json'
    contract=json.loads(path.read_text())
    sources=json.loads((PROJECT/'source-assets.json').read_text())
    arms=json.loads((ROOT/'assets/characters/first-person-v1/manifest.json').read_text())
    expected={'fp_'+c['slot']:c for c in arms['characters']}
    assert len(expected)==10
    images=set()
    for source in sources:
        name=Path(source['destination']).stem
        gltf=json.loads((PROJECT/source['destination']).read_text())
        meta=json.loads((PROJECT/'assets/resources'/f'{name}.gltf.meta').read_text())
        if not meta['imported']:raise ValueError('Actual import required: '+name)
        subs=meta['subMetas']
        current={'uuid':meta['uuid'],'prefabs':[v['uuid'] for v in subs.values() if v['importer']=='gltf-scene'],
                 'meshes':sum(v['importer']=='gltf-mesh' for v in subs.values()),
                 'skeletons':sum(v['importer']=='gltf-skeleton' for v in subs.values()),
                 'animations':{k:{'uuid':v['uuid'],'name':v['name'],'settings':v['userData']} for k,v in subs.items() if v['importer']=='gltf-animation'},
                 'textureSamplers':{k:{s:v['userData'][s] for s in SAMPLER} for k,v in subs.items() if v['importer']=='texture'}}
        if name in expected:
            asset=expected[name]
            if source['source']!=asset['glb'] or source['dependencies']:raise ValueError('Unexpected arm source/dependency: '+name)
            if meta['uuid']!=str(uuid.uuid5(uuid.NAMESPACE_URL,'corporate-showdown/'+asset['glb'])):raise ValueError('Arm UUID drift: '+name)
            if current['skeletons']!=1 or current['meshes']!=len(gltf['meshes']) or len(current['animations'])!=16:raise ValueError('Arm inventory mismatch: '+name)
            if {v['name'].removesuffix('.animation') for v in current['animations'].values()}!={a['name'] for a in gltf['animations']}:raise ValueError('Arm clip names differ: '+name)
            if name in contract['models'] and contract['models'][name]!=current:raise ValueError('Arm identity drift: '+name)
            contract['models'][name]=current
        elif contract['models'].get(name)!=current:raise ValueError('Prior identity/settings drift: '+name)
        for image in gltf.get('images',[]):images.add(image['uri'])
    if set(contract['models'])!={Path(s['destination']).stem for s in sources}:raise ValueError('Source inventory mismatch')
    contract['sharedImages']=len(images)
    contract['firstPersonMigration']='0.3.12: ten original skinned forearm assets,16 clips each,existing11 model identities/settings retained after actual import'
    path.write_text(json.dumps(contract,indent=2)+'\n')
    print('First-person import migration passed:',len(contract['models']),'models,',len(images),'shared images')

if __name__=='__main__':extend()
