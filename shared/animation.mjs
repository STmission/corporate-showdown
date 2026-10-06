export const CHARACTER_REVISION='characters-v0.12';
export const ANIMATION_NAMES=Object.freeze(['Idle','Walk','Run','Attack','Hit','Down','Rescue','Cast']);
export const WEAPON_ANIMATION_NAMES=Object.freeze(['PistolHold','PistolShot','PistolWalk','PistolRun','RifleHold','RifleShot','RifleWalk','RifleRun']);
export function weaponAnimation(weapon,base){
 const prefix=weapon==='pistol'?'Pistol':['smg','rifle','sniper','shotgun','lmg'].includes(weapon)?'Rifle':null;
 return prefix&&['Idle','Attack','Walk','Run'].includes(base)?prefix+({Idle:'Hold',Attack:'Shot'}[base]??base):base;
}
export function selectAnimation(e,elapsed,speed,{lobby=false,rescueTargets=new Set(),hitActive=!e.player&&e.hitUntil>elapsed,talkAvailable=false,weaponAvailable=false}={}){
 if(lobby)return 'Idle';
 if(['down','eliminated'].includes(e.state))return 'Down';
 if(hitActive)return 'Hit';
 if(e.attackUntil>elapsed)return weaponAvailable?weaponAnimation(e.weapon,'Attack'):'Attack';
 if(e.cast)return 'Cast';
 if(e.interactProgress>0&&rescueTargets.has(e.interactTarget))return 'Rescue';
 if(e.conversing&&talkAvailable)return 'Talk';
 const base=speed>.1?(speed>=3.5?'Run':'Walk'):'Idle';
 return weaponAvailable?weaponAnimation(e.weapon,base):base;
}
