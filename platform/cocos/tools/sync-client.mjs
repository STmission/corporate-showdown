import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../../../',import.meta.url),project=new URL('../',import.meta.url);
const modules=['client/motion-pace','client/session','client/input-controls','client/audio-cues','public/audio-settings','public/conversation-focus','shared/character-assets','shared/weapon-geometry','shared/weapon-grip','shared/weapons','shared/story','shared/camera-rig','shared/protocol','shared/level','shared/appearance','shared/animation','shared/movement','shared/headquarters-layout','shared/office-design','public/reliable-channel','public/network-state'];
const manifest=[];
for(const name of modules){const source=new URL(`prototype/${name}.mjs`,root),destination=new URL(`assets/scripts/canonical/${name}.js`,project);const text=await readFile(source,'utf8');await mkdir(new URL('./',destination),{recursive:true});await writeFile(destination,'// Generated from prototype/'+name+'.mjs; run sync:cocos.\n'+text.replaceAll('.mjs','.js'));manifest.push({source:fileURLToPath(source).slice(fileURLToPath(root).length),destination:fileURLToPath(destination).slice(fileURLToPath(project).length),sha256:createHash('sha256').update(text).digest('hex')});}
await writeFile(new URL('canonical-sources.json',project),JSON.stringify(manifest,null,2)+'\n');
const {stdout}=await promisify(execFile)('python3',[fileURLToPath(new URL('tools/sync_assets.py',project))]);
console.log(stdout.trim());
