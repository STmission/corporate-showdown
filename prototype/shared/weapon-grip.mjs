import {weaponParts} from './weapon-geometry.mjs';
// Neutral carry socket: hand bone +Y follows the fingers. Aim/left-hand IK
// and finger closure are authored separately; this is not a firing pose.
export function weaponGrip(family){
 if(!['pistol','smg','rifle','sniper','shotgun','lmg','hammer','scissors'].includes(family))throw Error('未知武器握持类型：'+family);
 const parts=weaponParts(family),part=parts.find(p=>p.name===(family==='hammer'?'木柄':family==='scissors'?'握柄-1':'握把'));
 if(!part)throw Error('缺少武器握持基准：'+family);
 const pivot=family==='hammer'?[0,-.28,0]:family==='scissors'?[-.14,0,0]:part.pos.slice();
 const angle=family==='hammer'?0:Math.PI/2,cos=Math.cos(angle),sin=Math.sin(angle),palm=[0,.065,.012];
 return {bone:'hand_r',pivot,palm,rotation:[0,0,angle],position:[palm[0]-(pivot[0]*cos-pivot[1]*sin),palm[1]-(pivot[0]*sin+pivot[1]*cos),palm[2]-pivot[2]]};
}
