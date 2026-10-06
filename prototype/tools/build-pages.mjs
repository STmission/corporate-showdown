import {mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {routes} from '../static-routes.mjs';
import {optimizePagesAssets} from './optimize-pages-assets.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function buildPages({out=resolve(root,'dist/pages'),base='/corporate-showdown/',optimize=false}={}){
  if(!/^\/(?:[\w-]+\/)*$/.test(base))throw Error('Invalid Pages base path');
  await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
  const inventory=[];
  const relocate=text=>text.replace(/(['"`])\/([^'"`\s]*)/g,(match,quote,path)=>{
    if(path===''||routes.has('/'+path)||/^(assets|shared|vendor)\//.test(path))return quote+base+(path==='studio'?'studio/':path);
    return match;
  });
  for(const [url,[source,mime]] of routes){
    const target=url==='/'?'index.html':url==='/studio'?'studio/index.html':url.slice(1);
    let bytes=await readFile(resolve(root,'prototype',source));
    if(mime==='text/javascript'||mime==='text/html'||mime==='text/css'){
      let text=relocate(bytes.toString()).replace(/(['"])\.\.\/shared\//g,'$1'+base+'shared/');
      if(url==='/')text=text.replace('<html lang="zh-CN">','<html lang="zh-CN" data-runtime="local-trial">').replace('单人剧情改版 · 可交谈人物 / 双视角 / 分支线索','公开网页试玩 · 单人 / 无云存档 / 刷新后重新开局 · 建议电脑 Chrome 或 Edge');
      bytes=Buffer.from(text);
    }
    const file=resolve(out,target);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);inventory.push({path:target,bytes:bytes.length});
  }
  for(const file of ['trial-worker.mjs','local-trial.mjs','simulation.mjs','command-ledger.mjs','event-delivery.mjs']){const bytes=await readFile(resolve(root,'prototype',file));await writeFile(resolve(out,file),bytes);inventory.push({path:file,bytes:bytes.length});}
  await writeFile(resolve(out,'.nojekyll'),'');
  const optimization=optimize?await optimizePagesAssets(out,inventory):null;
  const report={runtime:'local-single-player',base,optimization,files:inventory.length,bytes:inventory.reduce((sum,f)=>sum+f.bytes,0),inventory};
  await writeFile(resolve(out,'release.json'),JSON.stringify(report,null,2));
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await buildPages({base:process.env.PAGES_BASE??'/corporate-showdown/',optimize:process.env.PAGES_OPTIMIZE!=='0'});console.log(JSON.stringify({runtime:report.runtime,base:report.base,files:report.files,bytes:report.bytes}));
}
