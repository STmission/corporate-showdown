import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { LEVEL } from '../shared/level.mjs';
const files=['assets/models/coastal-headquarters.blend','assets/models/coastal-headquarters-complete.glb','assets/models/coastal-headquarters-gameplay.glb','assets/models/headquarters-collision.json','assets/characters/workplace-characters.blend',...['male','female'].flatMap(g=>['programmer','ecommerce','sales','celebrity'].map(j=>`assets/characters/${g}_${j}.glb`))];
const grounding=JSON.parse(await readFile('assets/characters/grounded-v1/manifest.json','utf8'));
files.push(...grounding.characters.flatMap(c=>[c.blend,c.glb]));
const assets=[];
files.push('assets/characters/refined-v2/male_sales/male_sales.blend','assets/characters/refined-v2/male_sales/male_sales.glb');
for(const path of files){
  const data=await readFile(path), entry={path,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
  if(path.endsWith('.glb')){
    if(data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length)throw new Error(`Invalid GLB: ${path}`);
    const gltf=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
    Object.assign(entry,{nodes:gltf.nodes?.length??0,meshes:gltf.meshes?.length??0,skins:gltf.skins?.map(s=>s.joints.length)??[],animations:gltf.animations?.map(a=>a.name)??[],alphaModes:[...new Set(gltf.materials?.map(m=>m.alphaMode??'OPAQUE'))]});
  }
  assets.push(entry);
}
const report={generatedAt:new Date().toISOString(),revision:LEVEL.revision,characterRevision:LEVEL.characterRevision,scope:'Source/export traceability and GLB structure, not visual or device performance certification',sources:{environment:'blender/update_navigation.py',characters:'blender/build_characters.py',characterAnimation:'blender/animate_characters.py',alphaNormalization:'blender/normalize_glb.py',salesRefinement:'blender/refine_sales_character.py',salesValidation:'blender/validate_sales_refinement.py'},grounding:{manifest:'assets/characters/grounded-v1/manifest.json',generator:grounding.generator,characters:grounding.characters.map(c=>c.slot),runtimeExportDirectory:'assets/characters/grounded-v1'},priorMaterialOverrides:{male_sales:{source:'assets/characters/refined-v2/male_sales/manifest.json',export:'assets/characters/refined-v2/male_sales/male_sales.glb',consumers:['prototype/server.mjs','platform/cocos/tools/sync_assets.py']}},collision:{source:'prototype/shared/headquarters-layout.mjs',rectangles:LEVEL.solids.length,origin:'Versioned shared layout v0.8; native wall geometry verified during export; major furniture has simple footprint collision.'},assets};
await writeFile('assets/asset-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:'assets/asset-audit.json',assets:assets.length,colliders:report.collision.rectangles}));
