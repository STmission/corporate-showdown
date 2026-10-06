"""Preserve UUID/playback settings; verify any source-index relocation explicitly."""
import json
from pathlib import Path
P=Path(__file__).resolve().parents[1]
path=P/'asset-identities.json';contract=json.loads(path.read_text())
suffixes={'PistolHold','PistolShot','PistolWalk','PistolRun','RifleHold','RifleShot','RifleWalk','RifleRun'}
for name,prior in contract['models'].items():
    meta=json.loads((P/'assets/resources'/f'{name}.gltf.meta').read_text())
    animations={k:{'uuid':v['uuid'],'name':v['name'],'settings':v['userData']} for k,v in meta['subMetas'].items() if v['importer']=='gltf-animation'}
    assert meta['imported'] and meta['uuid']==prior['uuid']
    gltf=json.loads((P/'assets/resources'/f'{name}.gltf').read_text())
    for k,v in prior['animations'].items():
        current=animations.get(k)
        assert current is not None and current['uuid']==v['uuid'] and current['name']==v['name'],(name,'prior identity drift',k)
        assert {a:b for a,b in current['settings'].items() if a!='gltfIndex'}=={a:b for a,b in v['settings'].items() if a!='gltfIndex'},(name,'playback settings drift',k)
        assert gltf['animations'][current['settings']['gltfIndex']]['name']==current['name'].removesuffix('.animation'),(name,'source index mismatch',k)
    if name!='headquarters':
        added={v['name'].removesuffix('.animation').rsplit('_',1)[1] for k,v in animations.items() if k not in prior['animations']}
        assert added==suffixes or (not added and len(animations)==17),(name,added)
        assert {a['name'] for a in gltf['animations']}=={v['name'].removesuffix('.animation') for v in animations.values()}
        prior['animations']=animations
contract['weaponMigration']='0.3.11: eight weapon actions added after actual import; prior UUID/playback settings retained; Talk source index verified at 16'
path.write_text(json.dumps(contract,indent=2)+'\n')
print('Weapon import identity migration passed.')
