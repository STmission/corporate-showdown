import {spawn,execFile} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {promisify} from 'node:util';

const project=fileURLToPath(new URL('../',import.meta.url));
const repository=path.resolve(project,'../..');
const platform=process.argv[2];
if(!['web-desktop','wechatgame','ios'].includes(platform))throw Error('Choose web-desktop, wechatgame or ios');
const editor=process.env.COCOS_EDITOR_PATH??'/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator';
const {stdout:editorVersion}=await promisify(execFile)('plutil',['-extract','CFBundleShortVersionString','raw','-o','-',path.resolve(path.dirname(editor),'../Info.plist')]);
if(editorVersion.trim()!=='3.8.8')throw Error('This probe is locked to Cocos Creator 3.8.8');
const scene=JSON.parse(await readFile(path.join(project,'assets/scenes/Headquarters.scene'),'utf8'));
const component=scene[scene[1]._components[0].__id__];
for(const [field,name]of [['environment','headquarters'],['character','programmer']]){
 const meta=JSON.parse(await readFile(path.join(project,`assets/resources/${name}.gltf.meta`),'utf8'));
 const prefab=Object.values(meta.subMetas).find(asset=>asset.importer==='gltf-scene');
 if(!prefab||component[field]?.__uuid__!==prefab.uuid)throw Error(`Scene component does not reference imported ${name} prefab`);
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=JSON.parse(await readFile(path.join(project,'source-assets.json'),'utf8'));
for(const asset of sources){
 for(const dependency of asset.dependencies??[])if(hash(await readFile(path.join(repository,dependency.source)))!==dependency.sha256)throw Error('Animation dependency drift: '+dependency.source);
 if(hash(await readFile(path.join(repository,asset.source)))!==asset.sha256)throw Error('Source drift: '+asset.source);
 if(hash(await readFile(path.join(project,asset.destination)))!==asset.outputSHA256)throw Error('Derivative drift: '+asset.destination);
 for(const output of asset.outputs)if(hash(await readFile(path.join(project,output.destination)))!==output.sha256)throw Error('Derivative data drift: '+output.destination);
}
const audioBank=JSON.parse(await readFile(path.join(project,'assets/resources/audio/bank.json')));
if(audioBank.generatorSHA256!==hash(await readFile(path.join(project,'tools/generate_audio.py'))))throw Error('Audio generator changed: regenerate sound bank');
for(const clip of audioBank.clips){if(!/^[a-z0-9_]+\.wav$/.test(clip.path)||hash(await readFile(path.join(project,'assets/resources/audio',clip.path)))!==clip.sha256)throw Error('Audio source drift: '+clip.path);}
const sky=JSON.parse(await readFile(path.join(project,'assets/resources/coastal-sky/provenance.json')));
if(sky.generatorSHA256!==hash(await readFile(path.join(project,'tools/generate_coastal_sky.py'))))throw Error('Sky generator drift: regenerate coastal sky');
for(const face of sky.faces)if(hash(await readFile(path.join(project,face.path)))!==face.sha256)throw Error('Sky face drift: '+face.face);
const derivatives=JSON.parse(await readFile(path.join(project,'asset-derivatives.json')));
if(derivatives.toolSHA256!==hash(await readFile(path.join(project,'tools/externalize_gltf.py')))||derivatives.syncToolSHA256!==hash(await readFile(path.join(project,'tools/sync_assets.py')))||derivatives.conversationToolSHA256!==hash(await readFile(path.join(project,'tools/conversation_gltf.py'))))throw Error('Derivative tool changed: run sync:cocos');
for(const module of JSON.parse(await readFile(path.join(project,'canonical-sources.json'),'utf8'))){
 const source=await readFile(path.join(repository,module.source),'utf8');
 const generated='// Generated from '+module.source+'; run sync:cocos.\n'+source.replaceAll('.mjs','.js');
 if(hash(source)!==module.sha256||await readFile(path.join(project,module.destination),'utf8')!==generated)throw Error('Canonical client drift: run npm run sync:cocos');
}
const artifacts=path.join(repository,'artifacts');await mkdir(artifacts,{recursive:true});
const logPath=path.join(artifacts,`cocos-${platform}-build.log`),log=createWriteStream(logPath);
const projectSources={};
for(const relative of ['package.json','assets/scenes/Headquarters.scene','assets/scripts/PlatformProbe.ts','assets/scripts/EngineMaterialAlpha.ts','assets/scripts/EngineCoastalSky.ts','tools/generate_coastal_sky.py','assets/resources/coastal-sky/provenance.json','assets/scripts/SourceMaterialAlpha.ts','assets/scripts/EngineUi.ts','assets/scripts/EngineFirstPerson.ts','assets/scripts/EngineWeapons.ts','assets/scripts/EngineAudio.ts','assets/scripts/EnvironmentBatching.ts','assets/scripts/EnvironmentInstancing.ts','canonical-sources.json','asset-derivatives.json','asset-identities.json','tools/audit_imports.py','tools/extend_first_person_contract.py','tools/extend_conversation_contract.py','tools/externalize_gltf.py','tools/conversation_gltf.py','tools/sync_assets.py','tools/optimize_png.py','tools/build.mjs','tools/generate_audio.py','assets/resources/audio/bank.json',platform+'.build.json'])projectSources[relative]=hash(await readFile(path.join(project,relative)));
const started=new Date();
const child=spawn(editor,['--project',project,'--build',`configPath=${path.join(project,platform+'.build.json')}`],{stdio:['ignore','pipe','pipe']});
child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
await new Promise(resolve=>log.end(resolve));
let optimization=null,optimizationError=null,importAudit=null,importAuditError=null;
if(exitCode===36){
 const auditPath=path.join(artifacts,`cocos-${platform}-import-audit.json`);
 try{await promisify(execFile)('python3',[path.join(project,'tools/audit_imports.py'),auditPath]);importAudit=JSON.parse(await readFile(auditPath,'utf8'));}catch(error){importAuditError=String(error.stderr||error.message);}
}
if(exitCode===36&&!importAuditError){
 const reportPath=path.join(artifacts,`cocos-${platform}-png-optimization.json`);
 try {
  await promisify(execFile)('python3',[path.join(project,'tools/optimize_png.py'),path.join(project,'build',platform),reportPath]);
  optimization=JSON.parse(await readFile(reportPath,'utf8'));
 } catch(error) { optimizationError=String(error.stderr||error.message); } 
}
const report={importAudit,importAuditError,optimization,optimizationError,platform,editorVersion:editorVersion.trim(),editorExecutableSHA256:hash(await readFile(editor)),started:started.toISOString(),finished:new Date().toISOString(),exitCode,buildSuccess:exitCode===36&&!optimizationError&&!importAuditError,logPath,sources,projectSources,deviceValidated:false,signed:false};
await writeFile(path.join(artifacts,`cocos-${platform}-build.json`),JSON.stringify(report,null,2)+'\n');
console.log(`${platform}: editor exit ${exitCode}; log ${logPath}`);
if(importAuditError)console.error(importAuditError);
if(optimizationError)console.error(optimizationError);
if(!report.buildSuccess)process.exitCode=1;
