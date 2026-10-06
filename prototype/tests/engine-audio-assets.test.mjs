import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('native sound bank exports reproducible PCM, bounded peaks and continuous loop edges',async()=>{
 const {stdout}=await promisify(execFile)('python3',['-c',`
import sys,tempfile,hashlib,struct,wave
from pathlib import Path
sys.path.insert(0,'platform/cocos/tools')
from generate_audio import generate
with tempfile.TemporaryDirectory()as a,tempfile.TemporaryDirectory()as b:
 first=generate(a);second=generate(b)
 assert first==second and len(first['clips'])==13 and {'shot','reload','empty'}.issubset({c['name'] for c in first['clips']})
 for clip in first['clips']:
  p=Path(a)/clip['path'];assert p.read_bytes()==(Path(b)/clip['path']).read_bytes()
  assert hashlib.sha256(p.read_bytes()).hexdigest()==clip['sha256']
  with wave.open(str(p),'rb')as w:
   assert w.getnchannels()==1 and w.getsampwidth()==2 and w.getframerate()==22050
   values=struct.unpack('<'+'h'*w.getnframes(),w.readframes(w.getnframes()))
   assert len(values)==clip['frames'] and values[0]==values[-1]==0
   assert max(map(abs,values))<20000 and sum(v*v for v in values)>0
   assert abs(sum(values)/len(values))<200
 print('13 reproducible clips validated')
 `]);
 assert.match(stdout,/13 reproducible clips validated/);
});
