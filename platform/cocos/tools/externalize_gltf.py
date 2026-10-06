"""Create traceable glTF derivatives with exact geometry and shared original PNGs."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import struct


def sha(data):return hashlib.sha256(data).hexdigest()


def read_glb(path):
    data=Path(path).read_bytes()
    if len(data)<20 or struct.unpack_from('<III',data)!= (0x46546c67,2,len(data)):
        raise ValueError('Invalid GLB header')
    offset,chunks=12,[]
    while offset<len(data):
        if offset+8>len(data):raise ValueError('Truncated GLB chunk')
        size,kind=struct.unpack_from('<II',data,offset);offset+=8
        if size%4 or offset+size>len(data):raise ValueError('Invalid GLB chunk size')
        chunks.append((kind,data[offset:offset+size]));offset+=size
    if len(chunks)!=2 or chunks[0][0]!=0x4e4f534a or chunks[1][0]!=0x004e4942:
        raise ValueError('Expected JSON and BIN GLB chunks')
    doc=json.loads(chunks[0][1]);binary=chunks[1][1]
    if len(doc['buffers'])!=1 or doc['buffers'][0].get('uri') or doc['buffers'][0]['byteLength']>len(binary):
        raise ValueError('Expected one embedded buffer')
    return data,doc,binary


def externalize(source,directory,name,transform=None):
    directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    textures=directory/'textures';textures.mkdir(exist_ok=True)
    original,doc,binary=read_glb(source)
    if transform is not None:doc,binary=transform(doc,binary)
    derived=copy.deepcopy(doc)
    image_views=set();images=[]
    for image in derived.get('images',[]):
        index=image.get('bufferView')
        if index is None or image.get('mimeType')!='image/png':raise ValueError('Only embedded PNG derivatives supported')
        view=doc['bufferViews'][index]
        if view['buffer']!=0:raise ValueError('Unexpected image buffer')
        offset=view.get('byteOffset',0);payload=binary[offset:offset+view['byteLength']]
        if len(payload)!=view['byteLength'] or not payload.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('Invalid embedded PNG')
        filename=sha(payload)+'.png';target=textures/filename
        if target.exists() and target.read_bytes()!=payload:raise ValueError('Texture hash collision')
        target.write_bytes(payload)
        images.append({'name':image.get('name'), 'path':'textures/'+filename,'sha256':sha(payload),'bytes':len(payload)})
        del image['bufferView'];image['uri']='textures/'+filename;image_views.add(index)
    mapping,new_views,new_binary={},[],bytearray()
    for index,view in enumerate(doc['bufferViews']):
        if index in image_views:continue
        if view['buffer']!=0:raise ValueError('Unexpected geometry buffer')
        while len(new_binary)%4:new_binary.append(0)
        offset=view.get('byteOffset',0);payload=binary[offset:offset+view['byteLength']]
        if len(payload)!=view['byteLength']:raise ValueError('Truncated geometry view')
        new_view=copy.deepcopy(view);new_view['byteOffset']=len(new_binary)
        new_binary.extend(payload);mapping[index]=len(new_views);new_views.append(new_view)
    def remap(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key=='bufferView':
                    if item not in mapping:raise ValueError('Non-image data depends on removed image view')
                    value[key]=mapping[item]
                else:remap(item)
        elif isinstance(value,list):
            for item in value:remap(item)
    remap(derived)
    derived['bufferViews']=new_views
    derived['buffers']=[{'byteLength':len(new_binary),'uri':name+'.bin'}]
    # Verify every retained view independently before writing the derivative.
    for old_index,new_index in mapping.items():
        a=doc['bufferViews'][old_index];b=new_views[new_index]
        if binary[a.get('byteOffset',0):a.get('byteOffset',0)+a['byteLength']]!=new_binary[b['byteOffset']:b['byteOffset']+b['byteLength']]:
            raise ValueError('Geometry/animation bytes changed')
    encoded=(json.dumps(derived,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    (directory/(name+'.gltf')).write_bytes(encoded);(directory/(name+'.bin')).write_bytes(new_binary)
    return {'source':str(source),'sourceSHA256':sha(original),'gltf':name+'.gltf','gltfSHA256':sha(encoded),'bin':name+'.bin','binSHA256':sha(new_binary),'retainedViews':len(mapping),'images':images,'preservedSections':['nodes','meshes','materials','skins','animations','scenes'],'bufferViewMap':mapping}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('directory');parser.add_argument('name');parser.add_argument('report')
    args=parser.parse_args();record=externalize(args.source,args.directory,args.name)
    Path(args.report).write_text(json.dumps(record,indent=2)+'\n')
    print('Externalized',len(record['images']),'images, retained',record['retainedViews'],'data views')
