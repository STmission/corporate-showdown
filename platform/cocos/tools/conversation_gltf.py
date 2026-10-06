"""Append rest-relative rotation-only Talk clips without changing authored asset data."""
import copy
import math
import struct
from externalize_gltf import read_glb


def multiply(a, b):
    x, y, z, w = a
    X, Y, Z, W = b
    return (w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X,
            w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z)


def unit(q):
    length = math.sqrt(sum(v*v for v in q))
    if not math.isfinite(length) or length < 1e-8:
        raise ValueError('Invalid conversation rotation')
    return tuple(v/length for v in q)


def read_accessor(doc, binary, index, width):
    accessor = doc['accessors'][index]
    if accessor.get('sparse') or accessor['componentType'] != 5126 or accessor['type'] != ('SCALAR' if width == 1 else 'VEC4'):
        raise ValueError('Expected packed float conversation accessor')
    view = doc['bufferViews'][accessor['bufferView']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    stride = view.get('byteStride', width*4)
    return [struct.unpack_from('<'+'f'*width, binary, offset+i*stride) for i in range(accessor['count'])]


def append_conversation(doc, binary, bank_path, slot, style):
    if style not in ('Explain', 'Listen', 'Comfort'):
        raise ValueError('Unknown conversation style')
    _, bank, source_bytes = read_glb(bank_path)
    source = next((a for a in bank['animations'] if a['name'] == 'Conversation_'+style), None)
    if source is None:
        raise ValueError('Missing conversation source clip')
    if any(a.get('name') == slot+'_Talk' for a in doc.get('animations', [])):
        raise ValueError('Talk already exists; do not append twice')
    target = copy.deepcopy(doc)
    data = bytearray(binary[:doc['buffers'][0]['byteLength']])
    indices = {n.get('name'): i for i, n in enumerate(target['nodes'])}
    if len(target.get('skins', [])) != 1 or len(target['skins'][0]['joints']) != 53:
        raise ValueError('Expected original 53-joint actor')
    joints = set(target['skins'][0]['joints'])
    clip = {'name': slot+'_Talk', 'channels': [], 'samplers': []}

    def append(values, width):
        while len(data) % 4:
            data.append(0)
        offset = len(data)
        for value in values:
            data.extend(struct.pack('<'+'f'*width, *value))
        view = len(target['bufferViews'])
        target['bufferViews'].append({'buffer':0, 'byteOffset':offset, 'byteLength':len(data)-offset})
        accessor = {'bufferView':view, 'componentType':5126, 'count':len(values), 'type':'SCALAR' if width == 1 else 'VEC4'}
        if width == 1:
            accessor['min'], accessor['max'] = [values[0][0]], [values[-1][0]]
        index = len(target['accessors'])
        target['accessors'].append(accessor)
        return index

    for channel in source['channels']:
        if channel['target']['path'] != 'rotation':
            continue
        source_node = bank['nodes'][channel['target']['node']]
        target_index = indices.get(source_node['name'])
        if target_index not in joints:
            raise ValueError('Missing target bone: '+source_node['name'])
        target_node = target['nodes'][target_index]
        if 'matrix' in source_node or 'matrix' in target_node:
            raise ValueError('Bone rest matrices require explicit decomposition')
        rest = unit(target_node.get('rotation', (0,0,0,1)))
        x, y, z, w = unit(source_node.get('rotation', (0,0,0,1)))
        inverse = (-x,-y,-z,w)
        sampler = source['samplers'][channel['sampler']]
        if sampler.get('interpolation', 'LINEAR') not in ('LINEAR','STEP'):
            raise ValueError('Unsupported conversation interpolation')
        times = read_accessor(bank, source_bytes, sampler['input'], 1)
        rotations = read_accessor(bank, source_bytes, sampler['output'], 4)
        if len(times) != len(rotations) or not times or times[0][0] != 0 or times[-1][0] != 4:
            raise ValueError('Expected four-second conversation loop')
        values = [unit(multiply(rest, multiply(inverse, q))) for q in rotations]
        clip['channels'].append({'sampler':len(clip['samplers']), 'target':{'node':target_index,'path':'rotation'}})
        clip['samplers'].append({'input':append(times,1),'output':append(values,4),'interpolation':sampler.get('interpolation','LINEAR')})
    if len(clip['channels']) != 53 or len({c['target']['node'] for c in clip['channels']}) != 53:
        raise ValueError('Conversation must cover exactly 53 different bones')
    target.setdefault('animations', []).append(clip)
    target['buffers'][0]['byteLength'] = len(data)
    return target, bytes(data)
