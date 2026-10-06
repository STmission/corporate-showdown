import {NodeIO,Logger,Verbosity} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,meshopt,textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import sharp from 'sharp';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function bonePath(node){const names=[];for(let n=node;n;n=n.getParentNode())names.unshift(n.getName());return names.join('/');}
function contract(doc){const r=doc.getRoot();return {animations:r.listAnimations().map(a=>a.getName()).sort(),skins:[...new Set(r.listSkins().map(s=>JSON.stringify(s.listJoints().map(bonePath).sort())))].sort().map(s=>JSON.parse(s))};}
export async function optimizePagesAssets(out,inventory){
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
 io.setLogger(new Logger(Verbosity.ERROR));const models=[];
 // Animation-only banks have intentionally unused skins; preserve their authored graph verbatim.
 for(const item of inventory.filter(item=>item.path.endsWith('.glb')&&!item.path.startsWith('assets/animations/'))){
  const file=join(out,item.path),original=await readFile(file),doc=await io.read(file),before=contract(doc);
  await doc.transform(dedup(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:85,effort:2}),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeWeight:16,quantizeNormal:12,quantizeTexcoord:14}));
  await io.write(file,doc);const decoded=await io.read(file);
  if(JSON.stringify(contract(decoded))!==JSON.stringify(before))throw Error('Optimized skin/animation contract changed: '+item.path);
  const bytes=await readFile(file);item.bytes=bytes.length;
  models.push({path:item.path,sourceSHA256:hash(original),exportSHA256:hash(bytes),sourceBytes:original.length,exportBytes:bytes.length,contract:before});
 }
 return {tool:'glTF Transform SDK 4.5.1',geometry:'Meshopt medium, position/weights 16-bit',textures:'WebP quality 85, max 1024',models};
}
