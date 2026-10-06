export const AUDIO_DEFAULTS=Object.freeze({enabled:true,captions:true,master:.8,music:.55,effects:.85,alerts:1,ambient:.4,voice:.62});
export const AUDIO_GROUPS=Object.freeze(['master','music','effects','alerts','ambient','voice']);
export const AUDIO_SETTINGS_KEY='corporate-showdown.audio.v1';
export function normalizeAudioSettings(value){const result={...AUDIO_DEFAULTS};if(!value||typeof value!=='object')return result;for(const k of AUDIO_GROUPS)if(typeof value[k]==='number'&&Number.isFinite(value[k]))result[k]=Math.max(0,Math.min(1,value[k]));for(const k of ['enabled','captions'])if(typeof value[k]==='boolean')result[k]=value[k];return result;}
export function loadAudioSettings(storage){try{return normalizeAudioSettings(JSON.parse(storage?.getItem(AUDIO_SETTINGS_KEY)));}catch{return {...AUDIO_DEFAULTS};}}
export function saveAudioSettings(storage,value){try{storage?.setItem(AUDIO_SETTINGS_KEY,JSON.stringify(normalizeAudioSettings(value)));return !!storage;}catch{return false;}}
