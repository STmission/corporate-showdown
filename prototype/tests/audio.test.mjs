import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioDirector} from '../public/audio.mjs';
import {AUDIO_DEFAULTS,loadAudioSettings,saveAudioSettings,normalizeAudioSettings} from '../public/audio-settings.mjs';

function fixture(){
  const nodes=[],spoken=[];let cancelled=0,cleared=false;
  const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}});
  const node=()=>{const n={gain:param(),frequency:param(),connections:[],connect(to){this.connections.push(to);},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(at){if(at===undefined){this.stopped=true;this.onended?.();}else this.stopTime=at;}};nodes.push(n);return n;};
  class Context{currentTime=0;sampleRate=1000;destination={};createGain=node;createOscillator=node;createBufferSource=node;createBiquadFilter=node;createBuffer(channels,length){return{getChannelData:()=>new Float32Array(length)};}resume(){return Promise.resolve();}close(){this.closed=true;}}
  const storage=new Map();const environment={AudioContext:Context,document:{hidden:false},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},setInterval:()=>42,clearInterval:id=>{cleared=id===42;},speechSynthesis:{cancel(){cancelled++;},speak(v){spoken.push(v);}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}};
  const audio=new AudioDirector(environment);const captions=[];audio.onCaption(v=>captions.push(v));
  return{audio,environment,nodes,spoken,captions,get cancelled(){return cancelled;},get cleared(){return cleared;}};
}

test('audio preferences clamp valid values and survive invalid or unavailable storage',()=>{
  assert.deepEqual(normalizeAudioSettings(null),AUDIO_DEFAULTS);
  const result=normalizeAudioSettings({music:-2,master:5,alerts:NaN,voice:'0',enabled:false,captions:'false',unknown:8});
  assert.equal(result.music,0);assert.equal(result.master,1);assert.equal(result.alerts,1);assert.equal(result.voice,.62);assert.equal(result.enabled,false);assert.equal(result.captions,true);assert.equal(result.unknown,undefined);
  assert.deepEqual(loadAudioSettings({getItem:()=>'{bad'}),AUDIO_DEFAULTS);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.deepEqual(loadAudioSettings(blocked),AUDIO_DEFAULTS);assert.equal(saveAudioSettings(blocked,result),false);
  const f=fixture();f.audio.configure({music:.19,enabled:false});const restored=new AudioDirector(f.environment);assert.equal(restored.settings.music,.19);assert.equal(restored.enabled,false);restored.dispose();f.audio.dispose();
});

test('danger and speech duck background buses while preserving alert gain, then restore',()=>{
  const f=fixture(),a=f.audio;a.activate();a.start();a.context.currentTime=4;a.syncVolume();
  assert.equal(a.buses.music.gain.value,.55);a.configure({effects:0});assert.equal(a.buses.effects.gain.value,0);
  a.event('danger');assert.equal(a.buses.music.gain.value,.55*.22);assert.equal(a.buses.ambient.gain.value,.4*.22);assert.equal(a.buses.alerts.gain.value,1);
  const alert=[...a.voices].find(v=>v.channel==='alerts').source;assert.equal(alert.connections[0].connections[0],a.buses.alerts);
  a.context.currentTime=6;a.schedule();assert.equal(a.buses.music.gain.value,.55);assert.equal(a.buses.ambient.gain.value,.4);
  a.dispose();
});

test('effects cap and cooldown prevent snapshot storms and ended sources disconnect',()=>{
  const f=fixture(),a=f.audio;a.activate();a.start();
  for(let i=0;i<20;i++)a.tone(200);assert.equal(a.voices.size,8);
  const first=[...a.voices][0].source;first.onended();assert.equal(a.voices.size,7);assert.equal(first.disconnected,true);assert.equal(first.connections[0].disconnected,true);
  a.stop();assert.equal(a.voices.size,0);a.start();a.event('step');a.event('step');assert.equal(a.voices.size,2);
  a.context.currentTime=.21;a.event('step');assert.equal(a.voices.size,4);a.dispose();
});

test('mute preserves captions; late join broadcasts only the latest crossed threshold',()=>{
  const f=fixture(),a=f.audio;a.configure({enabled:false});a.start(8);
  assert.deepEqual(f.captions.map(x=>x?.text),['十秒，马上下班！']);assert.equal(f.spoken.length,0);
  a.update(7);a.update(5);assert.equal(f.captions.length,1);
  a.configure({captions:false});a.say('测试');assert.equal(f.captions.length,1);a.dispose();
});

test('cast warnings deduplicate snapshots, filter expired/distant enemies, and repeat new casts',()=>{
  const f=fixture(),a=f.audio;a.start(180);f.captions.length=0;
  const enemy={id:'boss',kind:'boss',x:1,z:0,cast:{end:5,type:'delay'}};
  a.warnEnemies([enemy],2,{x:0,z:0});a.warnEnemies([enemy],3,{x:0,z:0});assert.equal(f.captions.length,1);assert.equal(f.captions[0].priority,'danger');
  a.warnEnemies([{...enemy,cast:{end:6,type:'projectile'}}],3,{x:0,z:0});assert.match(f.captions.at(-1).text,/文件/);
  a.warnEnemies([{...enemy,id:'far',x:30}],3,{x:0,z:0});a.warnEnemies([{...enemy,id:'old'}],6,{x:0,z:0});assert.equal(f.captions.length,2);
  a.warnEnemies([],6,{x:0,z:0});assert.equal(a.castMarkers.size,0);a.stop();a.warnEnemies([enemy],1,{x:0,z:0});assert.equal(f.captions.at(-1),null);a.dispose();
});

test('inactive and hidden pages create no transient sounds; exit stops sounds and speech',()=>{
  const f=fixture(),a=f.audio;a.activate();a.tone(100);assert.equal(a.voices.size,0);a.start();f.environment.document.hidden=true;a.event('hit');a.schedule();assert.equal(a.voices.size,0);assert.equal(a.master.gain.value,0);
  f.environment.document.hidden=false;a.tone(100);const source=[...a.voices][0].source;a.stop();assert.equal(source.stopped,true);assert.equal(a.master.gain.value,0);assert.equal(a.voices.size,0);assert.equal(f.captions.at(-1),null);assert.ok(f.cancelled>0);a.dispose();assert.equal(f.cleared,true);assert.equal(a.context.closed,true);
});

test('missing Web Audio or blocked local storage still permits visual countdown',()=>{
  const env={setInterval:()=>1,clearInterval:()=>{}};Object.defineProperty(env,'localStorage',{get(){throw Error('denied');}});
  const a=new AudioDirector(env),captions=[];a.onCaption(v=>captions.push(v));assert.equal(a.activate(),false);a.start(50);assert.match(captions[0].text,/一分钟/);a.dispose();
});
