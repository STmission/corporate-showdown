import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {buildPages} from '../tools/build-pages.mjs';
test('Pages artifact retains all routed GLBs and resolves imports under a repository subpath',{timeout:60000},async t=>{
 const out=await mkdtemp(join(tmpdir(),'showdown-pages-'));t.after(()=>rm(out,{recursive:true,force:true}));const base='/test-game/',report=await buildPages({out,base});
 assert.equal(report.runtime,'local-single-player');assert.ok(report.bytes<1024**3);
 assert.match(await readFile(join(out,'index.html'),'utf8'),/data-runtime="local-trial"/);
 for(const item of report.inventory){
  if(!/\.(mjs|js)$/.test(item.path))continue;
  const text=await readFile(join(out,item.path),'utf8');
  for(const match of text.matchAll(/^\s*(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)){
   const specifier=match[1];if(specifier==='three'||specifier.startsWith('three/addons/'))continue;
   const url=new URL(specifier,'https://example.com'+base+item.path);assert.ok(url.pathname.startsWith(base),item.path+' escaped Pages base: '+specifier);
   assert.ok((await stat(join(out,url.pathname.slice(base.length)))).isFile(),item.path+' import unavailable: '+specifier);
  }
 }
 assert.equal((await readFile(join(out,'assets/characters/first-person/female_sales.glb'))).toString('ascii',0,4),'glTF');
});
