import { loadAudioSettings,saveAudioSettings,normalizeAudioSettings } from './audio-settings.mjs';
// Original synthesized soundscape. No external audio, tracking or copyrighted game recordings.
export class AudioDirector {
  enabled = true;
  context = null;
  active = false;
  remaining = 300;
  lastPulse = 0;
  lastSecond = null;
  announced = new Set();
  constructor(environment=globalThis) {this.environment=environment;try{this.storage=environment.localStorage;}catch{}this.settings=loadAudioSettings(this.storage);this.enabled=this.settings.enabled;this.voices=new Set();this.cooldowns=new Map();this.castMarkers=new Map();this.duckUntil=0;this.caption=()=>{};this.timer=environment.setInterval(()=>this.schedule(),100);}
  onCaption(handler){this.caption=handler;}
  configure(patch){this.settings=normalizeAudioSettings({...this.settings,...patch});this.enabled=this.settings.enabled;saveAudioSettings(this.storage,this.settings);if(!this.enabled||!this.settings.voice||'master'in patch||'voice'in patch)this.environment.speechSynthesis?.cancel();this.syncVolume();return {...this.settings};}
  publishCaption(text,priority='normal'){if(this.active&&this.settings.captions)this.caption({text,priority});}
  prioritize(seconds=1.2){this.duckUntil=Math.max(this.duckUntil,(this.context?.currentTime??0)+seconds);this.syncVolume();}
  activate() {
    try{this.context ??= new (this.environment.AudioContext || this.environment.webkitAudioContext)();}catch{return false;}
    if (!this.master) {
      this.master = this.context.createGain(); this.master.gain.value = 0.42; this.master.connect(this.context.destination);this.buses={};for(const name of ['music','effects','alerts','ambient']){const bus=this.context.createGain();bus.connect(this.master);this.buses[name]=bus;}
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      this.noise = buffer;
      this.ambient = this.context.createGain(); this.ambient.gain.value = 0; this.ambient.connect(this.buses.ambient);
      const source = this.context.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 220;
      source.connect(filter); filter.connect(this.ambient); source.start();
    }
    this.context.resume().catch(() => {}); this.syncVolume();return true;
  }
  syncVolume() {
    if (!this.context) return;
    this.master.gain.setTargetAtTime(this.enabled && this.active && !this.environment.document?.hidden ? this.settings.master*.525 : 0, this.context.currentTime, 0.08);
    const duck=this.context.currentTime<this.duckUntil;for(const [name,bus]of Object.entries(this.buses))bus.gain.setTargetAtTime(this.settings[name]*(['music','ambient'].includes(name)&&duck ? .22 : 1),this.context.currentTime,.04);
    this.ambient.gain.setTargetAtTime(this.active && this.enabled ? 0.09 : 0, this.context.currentTime, 0.15);
  }
  toggle() {this.configure({enabled:!this.enabled});if(this.enabled)this.activate();return this.enabled;}
  start(remaining=300,explore=false) {this.explore=explore;this.active=true;this.remaining=remaining;this.lastPulse=0;this.cooldowns.clear();this.announced.clear();this.castMarkers.clear();this.syncVolume();if(explore)this.say('先和许老师聊聊，看看这份名单出了什么问题。');else if(remaining>120)this.say(`还有${Math.ceil(remaining/60)}分钟，马上下班。完成交接，准备离开。`);else this.update(remaining);}
  stop() {this.active=false;this.syncVolume();this.environment.speechSynthesis?.cancel();for(const voice of [...this.voices]){try{voice.source.stop();}catch{}}this.caption(null);}
  dispose(){this.stop();this.environment.clearInterval(this.timer);this.context?.close();}
  say(text) {
    this.publishCaption(text);if(!this.active||!this.enabled||!this.settings.voice||!this.environment.speechSynthesis||!this.environment.SpeechSynthesisUtterance)return;
    const voice=new this.environment.SpeechSynthesisUtterance(text);voice.lang='zh-CN';voice.rate=1.13;voice.volume=this.settings.voice*this.settings.master;
    this.prioritize(3);this.environment.speechSynthesis.cancel();this.environment.speechSynthesis.speak(voice);
  }
  track(source,nodes,channel){
    if([...this.voices].filter(v=>v.channel===channel).length>=(channel==='effects'?8:4))return false;
    const voice={source,channel};this.voices.add(voice);source.onended=()=>{this.voices.delete(voice);for(const node of [source,...nodes])node.disconnect?.();};return true;
  }
  tone(frequency, duration = 0.1, volume = 0.05, type = 'sine', delay = 0, end = frequency,channel='effects') {
    if (!this.context || !this.enabled || !this.active || this.environment.document?.hidden) return;
    const ctx = this.context, t = ctx.currentTime + delay, source = ctx.createOscillator(), gain = ctx.createGain();
    source.type = type; source.frequency.setValueAtTime(frequency, t); source.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(gain); gain.connect(this.buses[channel]);if(!this.track(source,[gain],channel)){source.disconnect();gain.disconnect();return;} source.start(t); source.stop(t + duration + 0.01);
  }
  noiseHit(duration, volume, frequency,channel='effects') {
    if (!this.context || !this.enabled || !this.active || this.environment.document?.hidden) return;
    const ctx = this.context, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.buses[channel]);if(!this.track(source,[gain,filter],channel)){source.disconnect();filter.disconnect();gain.disconnect();return;}source.start(); source.stop(ctx.currentTime + duration);
  }
  event(kind) {
    if(!this.active)return;const now=this.context?.currentTime??0;if(now<(this.cooldowns.get(kind)??-1))return;this.cooldowns.set(kind,now+({step:.2,hit:.08,skill:.25,danger:.5}[kind]??.1));if(kind==='danger')this.prioritize();
    if (kind === 'step') { this.noiseHit(0.07, 0.075, 450); this.tone(85, 0.09, 0.05, 'sine', 0, 45); }
    if (kind === 'hit') { this.noiseHit(0.11, 0.17, 1900); this.tone(160, 0.09, 0.11, 'triangle', 0, 48); }
    if(kind==='shot'){this.noiseHit(.075,.19,6500);this.tone(140,.09,.12,'triangle',0,45);}
    if(kind==='reload'){this.noiseHit(.12,.075,2100);this.tone(340,.06,.045,'square',.13,250);}
    if(kind==='empty')this.tone(320,.04,.04,'square');
    if (kind === 'skill') { this.tone(130, 0.3, 0.06, 'triangle', 0, 850); this.noiseHit(0.22, 0.065, 1200); }
    if (kind === 'danger') { this.tone(660,.1,.07,'triangle',0,660,'alerts');this.tone(480,.12,.07,'triangle',.14,480,'alerts'); }
  }
  update(remaining,explore=false) {
    this.explore=explore;this.remaining = remaining;if(explore)return;
    const crossed=[];for(const [limit,text] of [[120,'还有两分钟，准备下班。'],[60,'下班倒计时，一分钟。请尽快撤离。'],[30,'还有三十秒，电梯就在前方。'],[10,'十秒，马上下班！']])if(remaining<=limit&&!this.announced.has(limit)){this.announced.add(limit);crossed.push(text);}if(crossed.length&&this.active)this.say(crossed.at(-1));
  }
  warnEnemies(enemies,elapsed,listener){
    if(!this.active||!listener)return;const alive=new Set(enemies.map(e=>e.id));for(const id of this.castMarkers.keys())if(!alive.has(id))this.castMarkers.delete(id);
    for(const e of enemies){if(!e.cast||e.cast.end<=elapsed||Math.hypot(e.x-listener.x,e.z-listener.z)>14||this.castMarkers.get(e.id)===e.cast.end)continue;this.castMarkers.set(e.id,e.cast.end);this.event('danger');this.publishCaption(e.cast.type==='projectile'?'文件投掷预警 · 注意攻击方向':e.kind==='boss'?'组长招式预警 · 离开地面危险圈':'近战预警 · 闪避或打断','danger');}
  }

  schedule() {
    this.syncVolume();if(this.environment.document?.hidden)this.environment.speechSynthesis?.cancel();
    if (!this.context || !this.enabled || !this.active || this.environment.document?.hidden||this.explore) return;
    this.syncVolume();const now = this.context.currentTime;
    const bpm = this.remaining <= 30 ? 184 : this.remaining <= 60 ? 158 : this.remaining <= 120 ? 132 : 108;
    if (now - this.lastPulse < 60 / bpm) return;
    this.lastPulse = now;
    this.tone(62, 0.12, this.remaining <= 60 ? 0.045 : 0.018, 'sine', 0, 42,'music');
    this.noiseHit(0.035, this.remaining <= 60 ? 0.035 : 0.013, 3600,'music');
    if (this.remaining <= 60) this.tone(880, 0.055, 0.03, 'sine', 0.12, 750,'music');
    if (this.remaining <= 10) this.tone(1100, 0.08, 0.04, 'triangle', 0.2, 900,'music');
  }
}
