"""Bake measured floor contact into ten independent Down animation derivatives.
Preserve every original BIN byte; replace only Down/Root translation sampler.
Reimport derivatives for floor checks and save editable, packed Blender assets.
"""
import bpy,json,struct,hashlib,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets/characters/grounded-v1';OUT.mkdir(exist_ok=True)
SOURCES={f'{g}_{j}':f'assets/characters/{g}_{j}.glb' for g in ['male','female'] for j in ['programmer','ecommerce','sales','celebrity']}
SOURCES['male_sales']='assets/characters/refined-v2/male_sales/male_sales.glb'
SOURCES.update(female_doctor='assets/characters/professions-v1/female_doctor.glb',female_teacher='assets/characters/professions-v1/teacher/female_teacher.glb')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def accessor(d,b,k,width):
 a=d['accessors'][k];v=d['bufferViews'][a['bufferView']];assert a['componentType']==5126 and not a.get('sparse');return np.array([struct.unpack_from('<'+'f'*width,b,v.get('byteOffset',0)+a.get('byteOffset',0)+i*v.get('byteStride',width*4)) for i in range(a['count'])])
def append(d,b,values,width):
 b+=b'\0'*(-len(b)%4);off=len(b);values=np.asarray(values,dtype='<f4').reshape(-1,width);b+=values.tobytes();view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(b)-off});a={'bufferView':view,'componentType':5126,'count':len(values),'type':'SCALAR' if width==1 else 'VEC3'}
 if width==1:a.update(min=[float(values.min())],max=[float(values.max())])
 k=len(d['accessors']);d['accessors'].append(a);return k,b

def load(p,slot):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(p));s=bpy.context.scene;s.render.fps=24
 r=next(o for o in s.objects if o.type=='ARMATURE');meshes=[o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==r for m in o.modifiers)]
 assert len(r.data.bones)==53
 for t in r.animation_data.nla_tracks:t.mute=True
 track=next(t for t in r.animation_data.nla_tracks if t.name==slot+'_Down');r.animation_data.action=track.strips[0].action
 for o in s.objects:
  if o.type=='MESH' and o not in meshes:o.hide_render=True
 return s,r,meshes

def lowest(s,meshes,time):
 frame=time*24;s.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();low=math.inf
 for o in meshes:
  e=o.evaluated_get(dg);m=e.to_mesh();coords=np.empty(len(m.vertices)*3,dtype=np.float32);m.vertices.foreach_get('co',coords);xyz=coords.reshape(-1,3);matrix=e.matrix_world;z=xyz@np.array(matrix[2][:3])+matrix[2][3];low=min(low,float(z.min()));e.to_mesh_clear()
 return low
records=[]
for slot,relative in SOURCES.items():
 source=ROOT/relative;doc,binary=read(source);clip=next(a for a in doc['animations'] if a['name']==slot+'_Down');channel=next(c for c in clip['channels'] if c['target']['path']=='translation' and doc['nodes'][c['target']['node']]['name']=='Root');sampler=clip['samplers'][channel['sampler']];times=accessor(doc,binary,sampler['input'],1).ravel();values=accessor(doc,binary,sampler['output'],3);assert sampler.get('interpolation','LINEAR')=='LINEAR';end=float(times[-1]);dense=np.linspace(0,end,round(end*96)+1)
 # Parent has fixed transform. Reject an animated parent or matrix until supported.
 node=channel['target']['node'];parents={child:i for i,n in enumerate(doc['nodes']) for child in n.get('children',[])};chain=[]
 while node in parents:node=parents[node];chain.append(node)
 matrix=Matrix.Identity(4)
 for i in reversed(chain):
  n=doc['nodes'][i];assert 'matrix' not in n;assert not any(c['target']['node']==i for c in clip['channels']);q=n.get('rotation',[0,0,0,1]);matrix=matrix@Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((q[3],*q[:3])),Vector(n.get('scale',[1,1,1])))
 up=matrix.to_3x3().inverted()@Vector((0,1,0))
 s,r,meshes=load(source,slot);before=[lowest(s,meshes,float(t)) for t in dense];correction=[max(0,.002-z) for z in before]
 translated=np.stack([np.interp(dense,times,values[:,i]) for i in range(3)],axis=1)+np.outer(correction,list(up));input_index,binary=append(doc,binary,dense,1);output_index,binary=append(doc,binary,translated,3);sampler.update(input=input_index,output=output_index,interpolation='LINEAR');doc['buffers'][0]['byteLength']=len(binary);encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);binary+=b'\0'*(-len(binary)%4);out=OUT/(slot+'.glb');out.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary)
 s,r,meshes=load(out,slot);check=np.linspace(0,end,round(end*192)+1);after=[lowest(s,meshes,float(t)) for t in check];assert min(after)>=-.0005,(slot,min(after));assert max(after)<.12,(slot,max(after));s.frame_set(19);s['source_glb']=relative;s['source_glb_sha256']=sha(source);s['grounding']='Down/Root translation only; 96 Hz bake, 192 Hz reimport validation; 2 mm floor clearance'
 bpy.ops.file.pack_all();blend=OUT/(slot+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend));bpy.ops.wm.open_mainfile(filepath=str(blend));assert len(next(o for o in bpy.context.scene.objects if o.type=='ARMATURE').data.bones)==53
 records.append({'slot':slot,'source':relative,'sourceSHA256':sha(source),'glb':str(out.relative_to(ROOT)),'glbSHA256':sha(out),'blend':str(blend.relative_to(ROOT)),'blendSHA256':sha(blend),'samples':len(dense),'validationSamples':len(check),'duration':end,'oldMinimum':min(before),'newMinimum':min(after),'newMaximum':max(after),'maxLift':max(correction),'sourceReload':True,'gltfImport':True})
 print('GROUNDED',slot,'old',min(before),'new',min(after),flush=True)
report={'version':'grounded-v1','generator':'blender/ground_character_down.py','generatorSHA256':sha(Path(__file__)),'status':'passed','scope':'10 source reloads and actual GLB Down poses sampled at 192 Hz, runtime/crossfade/device verification pending','characters':records};(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('GROUNDING_LIBRARY_READY',flush=True)
