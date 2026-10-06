// Generated from prototype/client/input-controls.mjs; run sync:cocos.
// Local intent only; cadence and gameplay results remain server-authoritative.
const directions=new Set(['forward','back','left','right']);
const actions=new Set(['attack','skill','dodge','throw','transform','reload','weaponNext','pickup']);
// Cocos loose spread lowering treats a Set as a single concat entry. Convert explicitly.
const known=new Set(['forward','back','left','right','interact'].concat(Array.from(actions)));
export class InputControls {
 constructor(){this.active=false;this.held=new Map();this.taps=new Set();this.directionTaps=new Map();}
 setActive(active){this.active=Boolean(active);if(!this.active)this.clear();}
 clear(){this.held.clear();this.taps.clear();this.directionTaps.clear();}
 press(action,source='primary'){if(!this.active||!known.has(action))return;const sources=this.held.get(action)??new Set();if(sources.has(source))return;sources.add(source);this.held.set(action,sources);if(actions.has(action))this.taps.add(action);if(directions.has(action)){const pending=this.directionTaps.get(action)??new Set();pending.add(source);this.directionTaps.set(action,pending);}}
 release(action,{cancel=false,source='primary'}={}){const sources=this.held.get(action);sources?.delete(source);if(!sources?.size)this.held.delete(action);if(cancel){this.taps.delete(action);const pending=this.directionTaps.get(action);pending?.delete(source);if(!pending?.size)this.directionTaps.delete(action);}}
 next(yaw=0){
  const angle=(Number.isFinite(yaw)?yaw:0)*Math.PI/180,aimX=-Math.sin(angle),aimZ=-Math.cos(angle);
  const held=action=>this.active&&this.held.has(action);
  const moving=action=>held(action)||(this.active&&this.directionTaps.has(action));
  const forward=Number(moving('forward'))-Number(moving('back')),right=Number(moving('right'))-Number(moving('left'));
  const x=aimX*forward-aimZ*right,z=aimZ*forward+aimX*right,length=Math.max(1,Math.hypot(x,z));
  const intent={x:x/length||0,z:z/length||0,aimX,aimZ,interact:held('interact')};
  for(const action of actions)intent[action]=Boolean(this.active&&(this.held.has(action)||this.taps.has(action)));
  this.taps.clear();this.directionTaps.clear();return intent;
 }
}
