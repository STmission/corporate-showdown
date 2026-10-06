// Generated from prototype/shared/weapon-geometry.mjs; run sync:cocos.
// Original modular weapon silhouettes, in metres: barrel points along +X, +Y up.
export function weaponParts(family){
 const parts=[];const box=(name,pos,size,color='#303941',tilt=0)=>parts.push({name,shape:'box',pos,size,color,tilt});const tube=(name,pos,r,length,color='#525d66',axis='x')=>parts.push({name,shape:'cylinder',pos,r,length,color,axis});
 if(family==='hammer'){box('木柄',[0,-.22,0],[.045,.5,.045],'#8c6240');box('钢锤头',[0,.055,0],[.23,.095,.095],'#90999e');tube('锤面',[.14,.055,0],.055,.045);return parts;}
 if(family==='scissors'){for(const sign of [-1,1]){box('刀刃'+sign,[.12,sign*.028,0],[.29,.017,.012],'#a5afb5',sign*12);box('握柄'+sign,[-.14,sign*.056,0],[.13,.07,.028],sign<0?'#cf6544':'#446e91');}tube('铰轴',[0,0,0],.023,.04,'#888f95','z');return parts;}
 const pistol=family==='pistol',long=family==='sniper',heavy=family==='lmg',pump=family==='shotgun',smg=family==='smg';
 const body=pistol?.23:smg?.32:.42,barrel=pistol?.14:long?.48:pump?.44:heavy?.4:.3;
 box('机匣',[0,0,0],[body,.115,pistol?.045:.066]);
 tube('枪管',[body/2+barrel/2,.02,0],pistol?.018:.022,barrel);
 tube('枪口套',[body/2+barrel,.02,0],.028,.05,'#181f25');
 box('握把',[-body*.2,-.13,0],[.065,.18,.052],'#222b33',-15);
 box('扳机护圈前',[.075,-.075,0],[.018,.07,.034]);box('扳机护圈下',[.012,-.11,0],[.145,.015,.034]);box('扳机',[.035,-.06,0],[.016,.045,.02],'#acb3b7',-20);
 box('抛壳窗',[.09,.026,.036],[.09,.035,.005],'#a0a7ac');
 if(pistol){box('套筒',[.025,.075,0],[.28,.05,.054],'#68747d');box('准星',[.15,.108,0],[.024,.02,.012],'#171e24');}
 else{
  box('枪托',[-body/2-.12,-.015,0],[.24,.12,.072],pump?'#795940':'#46505a');box('托底',[-body/2-.25,-.015,0],[.025,.15,.078],'#1e272e');
  box('护木',[body/2+.05,.01,0],[.22,.095,.074],pump?'#8b6647':'#485662');
  for(let i=0;i<5;i++)box('护木槽'+i,[body/2-.03+i*.035,.058,0],[.012,.01,.082],'#202830');
  if(heavy)box('供弹盒',[.05,-.15,0],[.16,.19,.13],'#626954');else if(!pump)box('弹匣',[.055,-.17,0],[.077,smg?.22:.2,.046],'#53616b',-12);
  box('顶导轨',[0,.076,0],[body,.024,.037],'#77838d');
  if(long){tube('瞄准镜',[.0,.15,0],.037,.25,'#26323e');tube('镜片',[.14,.15,0],.031,.014,'#386774');box('镜座',[0,.1,0],[.15,.055,.04]);}
  else{box('照门',[-.14,.108,0],[.026,.04,.047],'#171e24');box('准星',[body/2+.14,.108,0],[.025,.04,.018],'#171e24');}
  if(pump)tube('管式弹仓',[body/2+.1,-.035,0],.021,.3,'#67717a');
  if(heavy)for(const sign of [-1,1])box('折叠脚架'+sign,[body/2+.16,-.045,sign*.058],[.12,.023,.018],'#626d76');
 }
 return parts;
}
