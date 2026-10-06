"""Append weapon actions to ten originals; preserve geometry, bind pose and clips."""
import sys, json, struct, hashlib, copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'platform/cocos/tools'))
from externalize_gltf import read_glb
from conversation_gltf import multiply, unit, read_accessor

OUT=ROOT/'assets/characters/weapon-ready-v1'
OUT.mkdir(exist_ok=True)
BANK=ROOT/'assets/animations/weapon-poses-v1/workplace-weapon-poses.glb'
_,bank,bank_binary=read_glb(BANK)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
records=[]
for item in json.loads((ROOT/'assets/characters/grounded-v1/manifest.json').read_text())['characters']:
    slot=item['slot'];source=ROOT/item['glb'];original,doc,binary=read_glb(source)
    target=copy.deepcopy(doc);data=bytearray(binary[:doc['buffers'][0]['byteLength']])
    indices={n.get('name'):i for i,n in enumerate(doc['nodes'])}
    assert len(doc['skins'][0]['joints'])==53
    joints=set(doc['skins'][0]['joints'])
    def append(values,width):
        data.extend(b'\0'*(-len(data)%4));offset=len(data)
        for row in values:data.extend(struct.pack('<'+'f'*width,*row))
        view=len(target['bufferViews']);target['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)-offset})
        a={'bufferView':view,'componentType':5126,'count':len(values),'type':'SCALAR' if width==1 else 'VEC4'}
        if width==1:a.update(min=[values[0][0]],max=[values[-1][0]])
        index=len(target['accessors']);target['accessors'].append(a);return index
    def rotation_clip(name,source_clip):
        clip={'name':slot+'_'+name,'channels':[],'samplers':[]}
        for c in source_clip['channels']:
            if c['target']['path']!='rotation':continue
            n=bank['nodes'][c['target']['node']];i=indices[n['name']];assert i in joints
            rest=unit(doc['nodes'][i].get('rotation',(0,0,0,1)));q=unit(n.get('rotation',(0,0,0,1)));inv=(-q[0],-q[1],-q[2],q[3])
            s=source_clip['samplers'][c['sampler']];times=read_accessor(bank,bank_binary,s['input'],1);values=read_accessor(bank,bank_binary,s['output'],4)
            rotated=[unit(multiply(rest,multiply(inv,v))) for v in values]
            clip['channels'].append({'sampler':len(clip['samplers']),'target':{'node':i,'path':'rotation'}})
            clip['samplers'].append({'input':append(times,1),'output':append(rotated,4),'interpolation':'LINEAR'})
        assert len(clip['channels'])==53
        return clip
    added=[]
    for family in ['Pistol','Rifle']:
        hold=rotation_clip(family+'Hold',next(a for a in bank['animations'] if a['name']=='Weapon_'+family+'Hold'))
        shot=rotation_clip(family+'Shot',next(a for a in bank['animations'] if a['name']=='Weapon_'+family+'Shot'))
        for clip in [hold,shot]:target['animations'].append(clip);added.append(clip['name'])
        # Retain actual authored locomotion of legs/root/torso; replace arm descendants.
        arms=set()
        def descendants(i):
            arms.add(i)
            for j in doc['nodes'][i].get('children',[]):descendants(j)
        for side in ['l','r']:descendants(indices['clavicle_'+side])
        hold_channels={c['target']['node']:c for c in hold['channels']}
        for motion in ['Walk','Run']:
            clip=copy.deepcopy(next(a for a in doc['animations'] if a['name']==slot+'_'+motion));clip['name']=slot+'_'+family+motion
            for c in clip['channels']:
                if c['target']['path']=='rotation' and c['target']['node'] in arms:
                    replacement=hold['samplers'][hold_channels[c['target']['node']]['sampler']]
                    # Constant hold at both locomotion endpoints, preserving loop duration.
                    old=clip['samplers'][c['sampler']];a=doc['accessors'][old['input']];duration=a['max'][0]
                    view=target['bufferViews'][target['accessors'][replacement['output']]['bufferView']];v=struct.unpack_from('<ffff',data,view['byteOffset'])
                    clip['samplers'][c['sampler']]={'input':append([(0,),(duration,)],1),'output':append([v,v],4),'interpolation':'LINEAR'}
            target['animations'].append(clip);added.append(clip['name'])
    target['buffers'][0]['byteLength']=len(data)
    encoded=json.dumps(target,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);data.extend(b'\0'*(-len(data)%4))
    out=OUT/(slot+'.glb');out.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(data))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(data),b'BIN\0')+data)
    assert data[:doc['buffers'][0]['byteLength']]==binary[:doc['buffers'][0]['byteLength']]
    records.append({'slot':slot,'source':item['glb'],'sourceSHA256':sha(source),'sourceBlend':item['blend'],'sourceBlendSHA256':sha(ROOT/item['blend']),'glb':str(out.relative_to(ROOT)),'glbSHA256':sha(out),'clips':added})
    print('WEAPON_RETARGETED',slot,flush=True)
(OUT/'manifest.json').write_text(json.dumps({'version':'weapon-ready-v1','generatorSHA256':sha(Path(__file__)),'bank':str(BANK.relative_to(ROOT)),'bankSHA256':sha(BANK),'bankBlend':'assets/animations/weapon-poses-v1/weapon-pose-pilot.blend','characters':records,'scope':'Rotation retarget and arm-over-locomotion derivatives; runtime and rendered costume validation pending'},ensure_ascii=False,indent=2)+'\n')
