"""Sync exact-source glTF derivatives into the editable Cocos project."""
import hashlib
import json
from pathlib import Path
import shutil
import uuid
from externalize_gltf import externalize
from conversation_gltf import append_conversation

PROJECT=Path(__file__).resolve().parents[1]
ROOT=PROJECT.parents[1]
RESOURCES=PROJECT/'assets/resources'
BACKUP=ROOT/'.platform-staging/cocos-glb-backup'


def sync():
    sources=[('assets/models/coastal-headquarters-gameplay.glb','headquarters')]
    for gender in ['male','female']:
        for job in ['programmer','ecommerce','sales','celebrity']:
            slot=f'{gender}_{job}'
            source=f'assets/characters/weapon-ready-v1/{slot}.glb'
            sources.append((source,'programmer' if slot=='male_programmer' else slot))
    sources.extend([('assets/characters/weapon-ready-v1/female_doctor.glb','female_doctor'),('assets/characters/weapon-ready-v1/female_teacher.glb','female_teacher')])
    sources.extend((f'assets/characters/first-person-v1/{slot}.glb','fp_'+slot) for slot in ['male_programmer','male_ecommerce','male_sales','male_celebrity','female_programmer','female_ecommerce','female_sales','female_celebrity','female_doctor','female_teacher'])
    records=[];alpha_rules={};BACKUP.mkdir(parents=True,exist_ok=True)
    for source,name in sources:
        old=RESOURCES/(name+'.glb');meta=RESOURCES/(name+'.gltf.meta')
        if not meta.exists():
            original_meta=RESOURCES/(name+'.glb.meta')
            if original_meta.exists():
                data=json.loads(original_meta.read_text())
                shutil.copy2(original_meta,BACKUP/original_meta.name)
            elif name in ('female_doctor','female_teacher') or name.startswith('fp_'):
                # New profession assets receive their own stable identities; old scene UUIDs stay unchanged.
                data={'ver':'2.3.14','importer':'gltf','imported':False,'uuid':str(uuid.uuid5(uuid.NAMESPACE_URL,'corporate-showdown/'+source)),'files':[],'subMetas':{},'userData':{}}
            else:raise ValueError('Original importer metadata required for stable UUID: '+name)
            # Keep importer identities, mesh/rig/action and scene mappings. External images are resolved anew.
            data['userData']['imageMetas']=[]
            meta.write_text(json.dumps(data,indent=2)+'\n')
        transform=None;dependencies=[]
        if name!='headquarters' and not name.startswith('fp_'):
            slot='male_programmer' if name=='programmer' else name
            style='Comfort' if slot=='female_doctor' else 'Explain' if slot in ('female_teacher','male_sales','female_sales') else 'Listen'
            bank=ROOT/'assets/animations/conversation-v1/workplace-conversation.glb'
            transform=lambda doc,binary:append_conversation(doc,binary,bank,slot,style)
            dependencies=[{'source':str(bank.relative_to(ROOT)),'sha256':hashlib.sha256(bank.read_bytes()).hexdigest(),'style':style,'clip':slot+'_Talk'}]
        record=externalize(ROOT/source,RESOURCES,name,transform)
        buffers=PROJECT/'assets/source-buffers';buffers.mkdir(exist_ok=True)
        shutil.move(str(RESOURCES/record['bin']),str(buffers/record['bin']))
        buffer_meta=RESOURCES/(record['bin']+'.meta')
        if buffer_meta.exists():shutil.move(str(buffer_meta),str(buffers/buffer_meta.name))
        gltf_path=RESOURCES/record['gltf'];gltf=json.loads(gltf_path.read_text())
        # Cocos 3.8.8 imports BLEND state but drops baseColorFactor alpha.
        alpha_rules['male_programmer' if name=='programmer' else name]={m['name']:m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[3] for m in gltf.get('materials',[]) if m.get('alphaMode')=='BLEND' and m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[3]!=1}
        gltf['buffers'][0]['uri']='../source-buffers/'+record['bin']
        encoded=(json.dumps(gltf,ensure_ascii=False,separators=(',',':'))+'\n').encode();gltf_path.write_bytes(encoded)
        record['gltfSHA256']=hashlib.sha256(encoded).hexdigest()
        outputs=[{'destination':'assets/source-buffers/'+record['bin'],'sha256':record['binSHA256']}]
        outputs.extend({'destination':'assets/resources/'+i['path'],'sha256':i['sha256']}for i in record['images'])
        records.append({'source':source,'destination':'assets/resources/'+record['gltf'],'sha256':record['sourceSHA256'],'outputSHA256':record['gltfSHA256'],'format':'gltf-external-v1','outputs':outputs,'retainedViews':record['retainedViews'],'dependencies':dependencies})
        if old.exists():shutil.move(str(old),str(BACKUP/old.name))
        original_meta=RESOURCES/(name+'.glb.meta')
        if original_meta.exists():original_meta.unlink()
    (PROJECT/'assets/scripts/SourceMaterialAlpha.ts').write_text('// Generated from exact source glTF BLEND factors; run sync:cocos.\nexport const SOURCE_MATERIAL_ALPHA:Record<string,Record<string,number>>='+json.dumps(alpha_rules,sort_keys=True,separators=(',',':'))+';\n')
    (PROJECT/'source-assets.json').write_text(json.dumps(records,indent=2)+'\n')
    manifest={'format':'gltf-external-v1','toolSHA256':hashlib.sha256((PROJECT/'tools/externalize_gltf.py').read_bytes()).hexdigest(),'syncToolSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'conversationToolSHA256':hashlib.sha256((PROJECT/'tools/conversation_gltf.py').read_bytes()).hexdigest(),'sources':records}
    (PROJECT/'asset-derivatives.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Synced',len(records),'models with exact source images and stable importer UUIDs')


if __name__=='__main__':sync()
