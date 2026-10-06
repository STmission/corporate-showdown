import {director,gfx,Material,Mat4,Mesh,MeshRenderer,Node} from 'cc';

export class EnvironmentInstancing {
 readonly report={mode:'instance',before:0,after:0,enabled:0,meshGroups:0,materials:0,failed:0,supported:false,milliseconds:0,skipped:{} as Record<string,number>};
 private originals:{renderer:MeshRenderer;materials:(Material|null)[]}[]=[];
 private variants=new Map<Material,Material>();
 constructor(root:Node){
  const started=Date.now(),renderers=root.getComponentsInChildren(MeshRenderer);
  this.report.before=renderers.length;this.report.after=renderers.length;
  this.report.supported=Boolean(director.root?.device.hasFeature(gfx.Feature.INSTANCED_ARRAYS));
  if(!this.report.supported){this.skip('device-unsupported');return;}
  const groups=new Map<Material,Map<Mesh,MeshRenderer[]>>();
  for(const renderer of renderers){
   const mesh=renderer.mesh,material=renderer.getRenderMaterial(0);
   if(!renderer.enabledInHierarchy||!mesh||!material||renderer.sharedMaterials.length!==1){this.skip('inactive-or-material-layout');continue;}
   if(material.effectAsset?.name!=='builtin-standard'||material.effectAsset.techniques[material.technique]?.name!=='opaque'||material.passes[0]?.blendState.targets.some(t=>t.blend)){this.skip('transparent-or-effect');continue;}
   if(mesh.struct.dynamic||mesh.struct.morph||renderer.bakeSettings.texture||renderer.bakeSettings.useLightProbe){this.skip('dynamic-or-baked');continue;}
   // Standard instanced normal transform assumes orthogonal basis columns.
   const m=renderer.node.worldMatrix,a=[m.m00,m.m01,m.m02],b=[m.m04,m.m05,m.m06],c=[m.m08,m.m09,m.m10];
   const length=(v:number[])=>Math.hypot(...v),dot=(x:number[],y:number[])=>x.reduce((s,n,i)=>s+n*y[i],0)/(length(x)*length(y));
   if(![...a,...b,...c].every(Number.isFinite)||Mat4.determinant(m)<=1e-12||[dot(a,b),dot(a,c),dot(b,c)].some(n=>!Number.isFinite(n)||Math.abs(n)>1e-6)){this.skip('singular-mirrored-or-sheared');continue;}
   if(!groups.has(material))groups.set(material,new Map());const meshes=groups.get(material)!;
   if(!meshes.has(mesh))meshes.set(mesh,[]);meshes.get(mesh)!.push(renderer);
  }
  for(const [original,meshes]of Array.from(groups.entries())){
   const repeated=Array.from(meshes.values()).filter(group=>group.length>1);if(!repeated.length)continue;
   const variant=new Material(),checkpoint=this.originals.length,groupCheckpoint=this.report.meshGroups;
   try{
    variant.copy(original,{defines:{USE_INSTANCING:true}});
    if(variant.passes[0]?.batchingScheme!==1)throw Error('Instancing variant unavailable');
    
    for(const group of repeated){
     this.report.meshGroups++;
     for(const renderer of group){this.originals.push({renderer,materials:renderer.sharedMaterials.slice()});renderer.sharedMaterials=[variant];this.report.enabled++;}
    }
    this.variants.set(original,variant);this.report.materials++;
   }catch(error){const rollback=this.originals.splice(checkpoint);for(const entry of rollback)entry.renderer.sharedMaterials=entry.materials;this.report.enabled-=rollback.length;this.report.meshGroups=groupCheckpoint;variant.destroy();this.report.failed++;this.skip(String(error));console.warn('Instancing retained original material:',String(error));}
  }
  this.report.milliseconds=Date.now()-started;
 }
 private skip(reason:string){this.report.skipped[reason]=(this.report.skipped[reason]??0)+1;}
 dispose(){for(const {renderer,materials}of this.originals)if(renderer.isValid)renderer.sharedMaterials=materials;for(const material of Array.from(this.variants.values()))material.destroy();this.originals=[];this.variants.clear();}
}
