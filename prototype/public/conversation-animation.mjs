import { AnimationClip, PropertyBinding, Quaternion, QuaternionKeyframeTrack } from 'three';

export const CONVERSATION_STYLES=Object.freeze(['Explain','Listen','Comfort']);
export function conversationStyle(profession) {
  return profession==='医生'?'Comfort':['老师','律师','金融／财务'].includes(profession)?'Explain':'Listen';
}

// Keep each actor's rest translations and scale. Only transfer rotations relative
// to the source rest basis, so female proportions never replace male bone lengths.
export function conversationClip(bank, target, slot, profession) {
  const style=conversationStyle(profession),source=bank.animations.find(c=>c.name==='Conversation_'+style);
  if(!source)throw Error('交流动作资源不完整：'+style);
  const tracks=[];
  for(const track of source.tracks) {
    const binding=PropertyBinding.parseTrackName(track.name);
    if(binding.propertyName!=='quaternion')continue;
    const from=bank.scene.getObjectByName(binding.nodeName),to=target.getObjectByName(binding.nodeName);
    if(!from||!to)throw Error('交流动作骨骼不兼容：'+binding.nodeName);
    const inverse=from.quaternion.clone().invert(),rest=to.quaternion.clone(),values=new Float32Array(track.values.length);
    for(let i=0;i<values.length;i+=4) {
      const rotation=new Quaternion().fromArray(track.values,i);
      rotation.premultiply(inverse).premultiply(rest).normalize().toArray(values,i);
    }
    tracks.push(new QuaternionKeyframeTrack(to.uuid+'.quaternion',track.times.slice(),values,track.getInterpolation()));
  }
  if(tracks.length!==53)throw Error('交流动作须覆盖现有 53 根骨骼');
  return new AnimationClip(slot+'_Talk',source.duration,tracks);
}
