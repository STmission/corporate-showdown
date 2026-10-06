"""Normalize MPFB's transparent defaults for real-time PBR while preserving BIN data.
Skin/clothes are opaque; hair, brows and lashes use alpha cutout and depth writes.
"""
import json,struct
from pathlib import Path

def normalize(path,appearance=None,preserve_actions=False):
 path=Path(path);b=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',b)
 assert magic==b'glTF' and version==2 and total==len(b)
 n,kind=struct.unpack_from('<I4s',b,12);assert kind==b'JSON'
 doc=json.loads(b[20:20+n]);changed=0
 for m in doc.get('materials',[]):
  name=m.get('name','')
  if '_Body.' not in name and name!='Original_Programmer_Plaid':continue
  cutout=any(part in name for part in ['short0','bob0','long0','ponytail','eyebrow','eyelash'])
  m['alphaMode']='MASK' if cutout else 'OPAQUE'
  if cutout:m['alphaCutoff']=.4
  else:m.pop('alphaCutoff',None)
  changed+=1
 if appearance:
  doc['animations']=[a for a in doc.get('animations',[]) if (a.get('name','').startswith(appearance+'_') if preserve_actions else a.get('name')==appearance+'_Idle')]
  assert any(a['name']==appearance+'_Idle' for a in doc['animations']),'Missing appearance-specific idle animation'
 encoded=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*(-len(encoded)%4)
 rest=b[20+n:];path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(rest))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+rest)
 return changed

if __name__=='__main__':
 root=Path(__file__).resolve().parents[1]
 for p in (root/'assets/characters').glob('*.glb'):print(p.name,normalize(p,p.stem,preserve_actions=True))
 p=root/'assets/models/coastal-headquarters-complete.glb';print(p.name,normalize(p))
