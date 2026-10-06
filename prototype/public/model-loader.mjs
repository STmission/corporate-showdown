import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Float32BufferAttribute} from 'three';
// CPU batching applies world matrices to attributes. Packed integer attributes
// cannot hold those results, so expand them after decoding, before batching.
function cpuAttribute(attribute){
  const array=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;
  if(array instanceof Float32Array)return attribute;
  const values=new Float32Array(attribute.count*attribute.itemSize);
  for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=attribute.getComponent(i,c);
  const result=new Float32BufferAttribute(values,attribute.itemSize);result.name=attribute.name;return result;
}
export function createModelLoader(){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),parse=loader.parse.bind(loader);
  loader.parse=(data,path,onLoad,onError)=>parse(data,path,result=>{
    try{
      const seen=new Set();for(const scene of result.scenes)scene.traverse(node=>{
        const g=node.geometry;if(!g||seen.has(g))return;seen.add(g);
        for(const [name,attribute]of Object.entries(g.attributes))if(name!=='skinIndex')g.setAttribute(name,cpuAttribute(attribute));
        for(const [name,attributes]of Object.entries(g.morphAttributes))g.morphAttributes[name]=attributes.map(cpuAttribute);
      });onLoad(result);
    }catch(e){onError?.(e);}
  },onError);return loader;
}
