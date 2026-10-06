import {Mat4,Mesh,MeshRenderer,Node,Quat,Vec3,gfx} from 'cc';

// Mesh.merge in 3.8.8 rotates normals but does not transform tangents. Keep each
// batch in a common linear basis: only translations are baked into vertex data.
// Transparent objects retain their original renderer and sorting granularity.
export type BatchReport={before:number;after:number;groups:number;merged:number;failed:number;verifiedVertices:number;maxPositionError:number;milliseconds:number;skipped:Record<string,number>};
type Source={renderer:MeshRenderer;world:Mat4;vertices:number;indices:number};
const linear=(m:Mat4)=>[m.m00,m.m01,m.m02,m.m04,m.m05,m.m06,m.m08,m.m09,m.m10];
const clock=()=>Date.now();

export class EnvironmentBatching {
 readonly report:BatchReport={before:0,after:0,groups:0,merged:0,failed:0,verifiedVertices:0,maxPositionError:0,milliseconds:0,skipped:{}};
 private meshes:Mesh[]=[];
 private originals:MeshRenderer[]=[];
 private nodes:Node[]=[];
 constructor(private root:Node,enabled=true){if(enabled){try{this.build();}catch(error){this.report.failed++;this.skip('setup:'+String(error));console.warn('Environment batching setup failed; original geometry retained',String(error));}}else{this.report.before=this.root.getComponentsInChildren(MeshRenderer).length;this.report.after=this.report.before;}}
 private build(){
  const started=clock();const renderers=this.root.getComponentsInChildren(MeshRenderer);
  this.report.before=renderers.length;this.report.after=renderers.length;
  const groups=new Map<string,Source[]>();
  for(const renderer of renderers){
   const mesh=renderer.mesh,material=renderer.getRenderMaterial(0);
   if(!renderer.enabledInHierarchy){this.skip('inactive');continue;}
   if(!mesh||renderer.sharedMaterials.length!==1||!material){this.skip('missing-or-multiple-material');continue;}
   // Standard's forward-add and planar-shadow passes blend even for opaque materials.
   if(material.effectAsset?.name!=='builtin-standard'){this.skip('unsupported-effect');continue;}
   if(material.effectAsset.techniques[material.technique]?.name!=='opaque'||!material.passes[0]||material.passes[0].blendState.targets.some(t=>t.blend)){this.skip('transparent');continue;}
   if(mesh.struct.dynamic||mesh.struct.morph||mesh.struct.vertexBundles.length!==1||mesh.struct.primitives.length!==1||!mesh.struct.primitives[0].indexView){this.skip('mesh-layout');continue;}
   if(renderer.bakeSettings.texture||renderer.bakeSettings.useLightProbe){this.skip('baked-or-probe');continue;}
   const world=renderer.node.worldMatrix.clone(),basis=linear(world);
   if(basis.some(v=>!Number.isFinite(v))||Math.abs(Mat4.determinant(world))<1e-12)continue;
   const position=renderer.node.worldPosition;
   const key=JSON.stringify([material.uuid,basis,Math.floor(position.x/8),Math.floor(position.z/8),renderer.node.layer,renderer.shadowCastingMode,renderer.receiveShadow,renderer.shadowBias,renderer.shadowNormalBias]);
   const source={renderer,world,vertices:mesh.struct.vertexBundles[0].view.count,indices:mesh.struct.primitives[0].indexView!.count};
   if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(source);
  }
  for(const sources of Array.from(groups.values())){
   let chunk:Source[]=[],vertices=0,indices=0;
   const flush=()=>{if(chunk.length>1)this.merge(chunk);chunk=[];vertices=0;indices=0;};
   for(const source of sources){
    // Conservative 16-bit bounds also avoid the engine's index-count-based
    // stride selection overflowing sparse meshes with many unused vertices.
    if(source.vertices>60000||source.indices>60000)continue;
    if(chunk.length>=64||vertices+source.vertices>60000||indices+source.indices>60000)flush();
    if(chunk.length&&!chunk[0].renderer.mesh!.validateMergingMesh(source.renderer.mesh!))flush();
    chunk.push(source);vertices+=source.vertices;indices+=source.indices;
   }
   flush();
  }
  this.report.milliseconds=clock()-started;
 }
 private skip(reason:string){this.report.skipped[reason]=(this.report.skipped[reason]??0)+1;}
 private merge(sources:Source[]){
  const first=sources[0],inverse=new Mat4();Mat4.invert(inverse,first.world);
  const mesh=new Mesh(),translations:Vec3[]=[];let candidateNode:Node|null=null;
  try{
   for(const source of sources){
    if(source.renderer.getRenderMaterial(0)!==first.renderer.getRenderMaterial(0))throw Error('Material instances differ');
    const relative=new Mat4();Mat4.multiply(relative,inverse,source.world);
    if(linear(relative).some((v,i)=>Math.abs(v-([1,0,0,0,1,0,0,0,1][i]))>1e-6))throw Error('Linear basis changed');
    const offset=new Vec3(relative.m12,relative.m13,relative.m14);translations.push(offset);
    const translation=new Mat4();Mat4.fromTranslation(translation,offset);
    if(!mesh.merge(source.renderer.mesh!,translation,sources.indexOf(source)>0))throw Error('Merge rejected');
   }
   const proof=this.verify(mesh,sources,translations);
   const parentInverse=new Mat4(),local=new Mat4();Mat4.invert(parentInverse,this.root.worldMatrix);Mat4.multiply(local,parentInverse,first.world);
   const position=new Vec3(),rotation=new Quat(),scale=new Vec3();Mat4.toRTS(local,rotation,position,scale);
   const node=new Node(`Static-cell-${this.nodes.length}`);candidateNode=node;node.layer=first.renderer.node.layer;this.root.addChild(node);node.setRTS(rotation,position,scale);
   // Reject any TRS decomposition drift before hiding source geometry.
   const actual=node.worldMatrix;
   if(linear(actual).some((v,i)=>Math.abs(v-linear(first.world)[i])>1e-6)||Math.abs(actual.m12-first.world.m12)>1e-4||Math.abs(actual.m13-first.world.m13)>1e-4||Math.abs(actual.m14-first.world.m14)>1e-4){node.destroy();throw Error('Target transform changed');}
   const renderer=node.addComponent(MeshRenderer);renderer.mesh=mesh;renderer.sharedMaterials=first.renderer.sharedMaterials;
   renderer.shadowCastingMode=first.renderer.shadowCastingMode;renderer.receiveShadow=first.renderer.receiveShadow;renderer.shadowBias=first.renderer.shadowBias;renderer.shadowNormalBias=first.renderer.shadowNormalBias;
   for(const source of sources){source.renderer.enabled=false;this.originals.push(source.renderer);}
   this.nodes.push(node);this.meshes.push(mesh);this.report.groups++;this.report.merged+=sources.length;this.report.after-=sources.length-1;this.report.verifiedVertices+=proof.vertices;this.report.maxPositionError=Math.max(this.report.maxPositionError,proof.error);
  }catch(error){candidateNode?.destroy();mesh.destroy();this.report.failed++;this.skip('failure:'+String(error));if(this.report.failed<=3)console.warn('Static batch retained original geometry:',String(error));}
 }
 private verify(merged:Mesh,sources:Source[],translations:Vec3[]){
  let vertices=0,indexOffset=0,error=0;
  const indices=merged.readIndices(0)!;
  const attributes=sources[0].renderer.mesh!.struct.vertexBundles[0].attributes;
  const output=new Map(attributes.map(a=>[a.name,merged.readAttribute(0,a.name as gfx.AttributeName)!]));
  for(let i=0;i<sources.length;i++){
   const source=sources[i],mesh=source.renderer.mesh!,offset=translations[i];
   for(const attribute of attributes){
    const before=mesh.readAttribute(0,attribute.name as gfx.AttributeName)!,after=output.get(attribute.name)!;
    const width=before.length/source.vertices;
    for(let n=0;n<before.length;n++){
     const component=n%width,translation=attribute.name==='a_position'?[offset.x,offset.y,offset.z][component]??0:0;
     const difference=Math.abs(after[vertices*width+n]-(before[n]+translation));
     if(!Number.isFinite(difference)||difference>(attribute.name==='a_position'?1e-4:1e-6))throw Error('Vertex attribute changed: '+attribute.name);
     if(attribute.name==='a_position')error=Math.max(error,difference);
    }
   }
   const original=mesh.readIndices(0)!;
   for(let n=0;n<original.length;n++)if(indices[indexOffset+n]!==original[n]+vertices)throw Error('Triangle indices changed');
   vertices+=source.vertices;indexOffset+=original.length;
  }
  if(indices.length!==indexOffset||merged.struct.vertexBundles[0].view.count!==vertices)throw Error('Geometry count changed');
  return {vertices,error};
 }
 dispose(){for(const renderer of this.originals)if(renderer.isValid)renderer.enabled=true;for(const node of this.nodes)node.destroy();for(const mesh of this.meshes)mesh.destroy();this.nodes=[];this.meshes=[];this.originals=[];}
}
