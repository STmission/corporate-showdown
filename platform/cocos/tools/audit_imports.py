"""Validate Cocos-imported derivative identities, sampler settings and rig references."""
import argparse
import hashlib
import json
from pathlib import Path

PROJECT=Path(__file__).resolve().parents[1]


def audit():
    document=json.loads((PROJECT/'asset-identities.json').read_text());contract=document['models']
    sources=json.loads((PROJECT/'source-assets.json').read_text())
    if set(contract)!={Path(s['destination']).stem for s in sources}:raise ValueError('Source/contract inventory differs')
    rows=[];images=set()
    def load(uuid):return json.loads((PROJECT/'library'/uuid[:2]/(uuid+'.json')).read_text())
    for name,expected in contract.items():
        meta_path=PROJECT/'assets/resources'/(name+'.gltf.meta');meta=json.loads(meta_path.read_text());subs=meta['subMetas']
        if meta['uuid']!=expected['uuid']:raise ValueError('Model identity changed: '+name)
        prefabs=[v['uuid']for v in subs.values()if v['importer']=='gltf-scene']
        if prefabs!=expected['prefabs']:raise ValueError('Prefab identity changed: '+name)
        if sum(v['importer']=='gltf-mesh'for v in subs.values())!=expected['meshes']:raise ValueError('Mesh count changed: '+name)
        if any(v['importer']=='gltf-embeded-image'for v in subs.values()):raise ValueError('Embedded images remain: '+name)
        skeletons=[v for v in subs.values()if v['importer']=='gltf-skeleton']
        if len(skeletons)!=expected['skeletons']:raise ValueError('Skeleton count changed: '+name)
        for skeleton in skeletons:
            if len(load(skeleton['uuid'])['_joints'])!=53:raise ValueError('Rig joint count changed: '+name)
        animations={k:v for k,v in subs.items()if v['importer']=='gltf-animation'}
        if set(animations)!=set(expected['animations']):raise ValueError('Animation set changed: '+name)
        for key,prior in expected['animations'].items():
            clip=animations[key]
            if clip['uuid']!=prior['uuid'] or clip['name']!=prior['name'] or clip['userData']!=prior['settings']:raise ValueError('Animation contract changed: '+name)
            for suffix in clip['files']:
                if not (PROJECT/'library'/clip['uuid'][:2]/(clip['uuid']+suffix)).is_file():raise ValueError('Imported animation data missing: '+name)
        if animations:
            prefab=load(prefabs[0]);components=[v for v in prefab if isinstance(v,dict)and v.get('__type__')=='cc.SkeletalAnimation']
            if len(components)!=1 or {v['__uuid__']for v in components[0]['_clips']}!={v['uuid']for v in animations.values()}:raise ValueError('Prefab skeletal actions not bound: '+name)
        for key,sampler in expected['textureSamplers'].items():
            texture=subs[key];settings=texture['userData']
            if any(settings.get(k)!=v for k,v in sampler.items()):raise ValueError('Texture sampling changed: '+name)
            uri=settings['imageUuidOrDatabaseUri']
            if not uri.startswith('db://assets/resources/textures/'):raise ValueError('Texture is not a shared image: '+name)
            png=PROJECT/uri.removeprefix('db://');png_meta=json.loads(Path(str(png)+'.meta').read_text())
            image_uuid=png_meta['uuid'];images.add(image_uuid)
            imported=load(texture['uuid'])
            if imported['content']['mipmaps']!=[image_uuid]:raise ValueError('Imported texture image reference differs: '+name)
            if not (PROJECT/'library'/image_uuid[:2]/(image_uuid+'.png')).is_file():raise ValueError('Shared image native data missing')
        if name in ('female_doctor','female_teacher'):
            gltf=json.loads((PROJECT/'assets/resources'/(name+'.gltf')).read_text())
            materials=[v for v in subs.values() if v['importer']=='gltf-material']
            if len(materials)!=len(gltf['materials']):raise ValueError('Profession material inventory differs: '+name)
            for material in materials:
                source=gltf['materials'][material['userData']['gltfIndex']]
                mode=source.get('alphaMode','OPAQUE');actual=load(material['uuid'])
                state=actual['_states'][0];blend=state.get('blendState',{}).get('targets',[{}])[0].get('blend',False)
                if blend!=(mode=='BLEND'):raise ValueError('Imported material blend mode differs: '+source['name'])
                if mode=='BLEND' and state.get('depthStencilState',{}).get('depthWrite')!=False:raise ValueError('Transparent material writes depth: '+source['name'])
                if mode=='MASK' and not actual['_defines'][0].get('USE_ALPHA_TEST'):raise ValueError('Hair alpha cutout missing: '+source['name'])
        rows.append({'name':name,'uuid':meta['uuid'],'prefabs':prefabs,'meshCount':expected['meshes'],'skeletonCount':len(skeletons),'animationCount':len(animations),'textureCount':len(expected['textureSamplers']),'metadataSHA256':hashlib.sha256(meta_path.read_bytes()).hexdigest()})
    if len(images)!=document.get('sharedImages',52):raise ValueError('Unexpected shared image count: '+str(len(images)))
    return {'scope':'actual Cocos imported metadata and library references; not runtime animation/render/device validation','models':rows,'sharedImages':len(images),'totalTextureReferences':sum(r['textureCount']for r in rows)}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('report');args=parser.parse_args()
    result=audit();Path(args.report).write_text(json.dumps(result,indent=2)+'\n');print('Imported model audit passed:',len(result['models']),'models,',result['sharedImages'],'images')
