import {Color,Material,MeshRenderer,Node} from 'cc';
import {SOURCE_MATERIAL_ALPHA} from './SourceMaterialAlpha';

// Retain imported RGB/texture/blending; restore only the source factor alpha.
// Share one local variant per imported material, without modifying source assets.
export class EngineMaterialAlpha {
 readonly report={renderers:0,materials:[] as {slot:string;name:string;sourceAlpha:number;appliedAlpha:number}[],failed:[] as string[]};
 private variants=new Map<Material,Material>();
 apply(root:Node,slot:string){
  const rules=SOURCE_MATERIAL_ALPHA[slot]??{};
  for(const renderer of root.getComponentsInChildren(MeshRenderer)){
   let changed=false;const materials=renderer.sharedMaterials.map(original=>{
    if(!original||rules[original.name]===undefined)return original;
    let variant=this.variants.get(original);
    if(!variant){
     const alpha=rules[original.name];
     if(!Number.isFinite(alpha)||alpha<0||alpha>1||original.effectAsset?.name!=='builtin-standard'||!original.passes[0]?.blendState.targets.some(t=>t.blend)||original.passes[0]?.depthStencilState.depthWrite){this.report.failed.push(slot+':'+original.name);return original;}
     variant=new Material();variant.copy(original);variant.name=original.name;
     const current=original.getProperty('mainColor') as Color|null;
     variant.setProperty('mainColor',new Color(current?.r??255,current?.g??255,current?.b??255,Math.round(alpha*255)));
     const applied=variant.getProperty('mainColor') as Color;
     this.variants.set(original,variant);this.report.materials.push({slot,name:original.name,sourceAlpha:alpha,appliedAlpha:applied.a/255});
    }
    changed=true;return variant;
   });
   if(changed){renderer.sharedMaterials=materials;this.report.renderers++;}
  }
 }
 dispose(){for(const variant of this.variants.values())variant.destroy();this.variants.clear();}
}
