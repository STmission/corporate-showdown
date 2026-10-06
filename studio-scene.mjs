import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { surfaceTexture, screenTexture } from '/corporate-showdown/studio-materials.mjs';
import { WALLS, HEADQUARTERS_SOLIDS, floorHeight } from '/corporate-showdown/shared/headquarters-layout.mjs';
import { FLOOR, BENCHES, ROOMS, EVENT_SPACE, CENTRAL_LOUNGE } from '/corporate-showdown/shared/office-design.mjs';
export function buildOffice() {
  const root=new T.Group();root.name='Coastal_Headquarters_Layout';root.userData={...FLOOR,stage:'Shared wall layout v0.8; native environment and rigged characters loaded separately'};
  const solids=HEADQUARTERS_SOLIDS, mats={}, geo={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,24,16),cyl:new T.CylinderGeometry(1,1,1,32)};
  const palette={wood:0xc9ad85,stone:0xeee9dd,cream:0xede5d5,dark:0x283d3a,metal:0x777f83,white:0xf5f2e9,leaf:0x376744,soil:0x564235,green:0x8d9a76,blue:0x81acc1,black:0x1c252a,gold:0xb49b68,pink:0xdcb5a3};
  for(const [k,c] of Object.entries(palette))mats[k]=new T.MeshStandardMaterial({color:c,roughness:k==='metal'?.28:.7,metalness:['metal','gold'].includes(k)?.8:0});
  mats.wood.map=surfaceTexture('oak');mats.wood.color.set(0xffffff);mats.wood.roughness=.52;
  mats.stone.map=surfaceTexture('stone');mats.stone.color.set(0xffffff);mats.stone.roughness=.38;
  mats.cream.map=surfaceTexture('fabric',2);mats.cream.color.set(0xffffff);mats.cream.bumpMap=mats.cream.map;mats.cream.bumpScale=.005;
  mats.green.map=surfaceTexture('rug',3);mats.green.color.set(0xffffff);mats.green.roughness=.96;
  mats.dark.map=surfaceTexture('mesh',2);mats.dark.color.set(0xffffff);mats.dark.roughness=.84;
  mats.glass=new T.MeshPhysicalMaterial({color:0xc9e2e2,transparent:true,opacity:.13,roughness:.06,metalness:.1,depthWrite:false,side:T.DoubleSide});
  mats.screen=new T.MeshStandardMaterial({map:screenTexture(),color:0xffffff,emissive:0xffffff,emissiveMap:screenTexture(),emissiveIntensity:.23,roughness:.4});
  mats.light=new T.MeshStandardMaterial({color:0xffedd0,emissive:0xffdda0,emissiveIntensity:3});
  mats.plastic=new T.MeshStandardMaterial({color:0x9ba98e,roughness:.28});
  const rounded=new Map();
  function soft(mat,x,y,z,w,h,d,r=.06,p=root){r=Math.min(r,w/2-.001,h/2-.001,d/2-.001);const key=[w,h,d,r].join(':');if(!rounded.has(key))rounded.set(key,new RoundedBoxGeometry(w,h,d,2,r));const m=new T.Mesh(rounded.get(key),mats[mat]);m.position.set(x,y,z);p.add(m);return m;}
  const node=(name,parent=root)=>{const g=new T.Group();g.name=name;parent.add(g);return g;};
  function mesh(type,mat,x,y,z,sx,sy,sz,parent=root){const m=new T.Mesh(geo[type],mats[mat]);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  const box=(mat,x,y,z,w,h,d,p=root)=>mesh('box',mat,x,y,z,w,h,d,p), ball=(mat,x,y,z,w,h,d,p=root)=>mesh('ball',mat,x,y,z,w,h,d,p), cyl=(mat,x,y,z,r,h,p=root)=>mesh('cyl',mat,x,y,z,r,h,r,p);
  const leafShape=new T.Shape();leafShape.moveTo(0,-.5);leafShape.bezierCurveTo(-.5,-.05,-.35,.3,0,.5);leafShape.bezierCurveTo(.35,.3,.5,-.05,0,-.5);const leafGeometry=new T.ShapeGeometry(leafShape,12);const leafMaterial=mats.leaf.clone();leafMaterial.side=T.DoubleSide;leafMaterial.roughness=.55;
  function branch(a,b,r,p){const dir=new T.Vector3().subVectors(b,a),m=new T.Mesh(geo.cyl,mats.wood);m.position.copy(a).add(b).multiplyScalar(.5);m.scale.set(r,dir.length(),r);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());p.add(m);}
  function plant(x,z,size=1,parent=root){const p=node('Indoor_Plant',parent);cyl('stone',x,.28*size,z,.3*size,.56*size,p);cyl('soil',x,.565*size,z,.25*size,.012,p);branch(new T.Vector3(x,.5*size,z),new T.Vector3(x,1.95*size,z),.025*size,p);for(let i=0;i<18;i++){const a=i*2.4,y=(.85+i*.055)*size,spread=(.24+(i%3)*.1)*size;const tx=x+Math.cos(a)*spread,tz=z+Math.sin(a)*spread;branch(new T.Vector3(x,y-.17*size,z),new T.Vector3(tx,y,tz),.01*size,p);const leaf=new T.Mesh(leafGeometry,leafMaterial);leaf.position.set(tx,y,tz);leaf.scale.set(.45*size,.7*size,1);leaf.rotation.set(-.5,a,.35*Math.sin(a));p.add(leaf);}return p;}
  function chair(x,z,rotation=0,parent=root){const g=node('Ergonomic_Chair',parent);g.position.set(x,0,z);g.rotation.y=rotation;cyl('metal',0,.33,0,.045,.52,g);cyl('black',0,.09,0,.06,.1,g);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const m=box('metal',Math.sin(a)*.18,.13,Math.cos(a)*.18,.055,.05,.4,g);m.rotation.y=a;ball('black',Math.sin(a)*.35,.07,Math.cos(a)*.35,.07,.07,.06,g);}soft('dark',0,.53,0,.55,.12,.5,.05,g);const back=soft('dark',0,.89,.25,.5,.65,.09,.035,g);back.rotation.x=-.13;soft('dark',0,1.29,.29,.3,.16,.09,.035,g);for(let side of[-1,1]){box('metal',side*.32,.67,0,.035,.28,.04,g);box('black',side*.32,.83,-.015,.1,.04,.3,g);}return g;}
  function monitor(x,z,side,parent){const g=node('Workstation_Monitor',parent);g.position.set(x,0,z);g.rotation.y=side===1?Math.PI:0;box('metal',0,.79,0,.2,.03,.18,g);box('metal',0,.95,0,.04,.3,.035,g);box('black',0,1.17,0,.62,.36,.05,g);box('screen',0,1.17,.029,.56,.3,.008,g);box('dark',0,.795,.32,.4,.02,.15,g);ball('dark',.29,.806,.32,.05,.02,.075,g);}
  function desk(x,z,w=5.4,d=1.6,parent=root){soft('wood',x,.76,z,w,.07,d,.025,parent);for(let s of[-1,1])box('metal',x+s*(w/2-.3),.36,z,.07,.72,d-.12,parent);}
  function sofa(x,z,w=2.8,rotation=0,parent=root){const g=node('Designer_Sofa',parent);g.position.set(x,0,z);g.rotation.y=rotation;soft('cream',0,.27,0,w,.28,.95,.12,g);soft('cream',0,.71,.36,w,.68,.28,.13,g);for(let i=0;i<3;i++)soft('cream',-w/3+i*w/3,.47,-.06,w/3-.025,.22,.78,.09,g);for(let side of[-1,1]){soft('cream',side*(w/2-.14),.58,0,.28,.47,.95,.12,g);const pillow=soft('green',side*w*.25,.74,.2,.43,.43,.17,.07,g);pillow.rotation.z=side*.16;cyl('gold',side*(w/2-.2),.08,-.27,.035,.14,g);cyl('gold',side*(w/2-.2),.08,.27,.035,.14,g);}return g;}
  function table(x,z,r=.7,parent=root){cyl('gold',x,.25,z,r*.45,.48,parent);cyl('stone',x,.51,z,r,.07,parent);}
  function angel(x,z,mat,parent=root){const g=node(`Angel_${mat}_Sculpture`,parent);cyl('stone',x,.16,z,.58,.32,g);const gown=new T.Mesh(new T.LatheGeometry([new T.Vector2(.32,0),new T.Vector2(.3,.15),new T.Vector2(.2,.7),new T.Vector2(.18,1.15),new T.Vector2(.23,1.3)],32),mats[mat]);gown.position.set(x,.32,z);g.add(gown);ball(mat,x,1.64,z,.23,.24,.15,g);ball(mat,x,2.04,z,.15,.2,.14,g);ball(mat,x,2.05,z-.13,.035,.055,.045,g);ball(mat,x,2.17,z+.025,.16,.13,.13,g);
    for(let side of[-1,1]){const arm=ball(mat,x+side*.27,1.72,z-.01,.075,.3,.07,g);arm.rotation.z=-side*.35;ball(mat,x+side*.38,1.89,z-.05,.07,.18,.06,g);ball(mat,x+side*.42,2.06,z-.07,.05,.08,.04,g);
      for(let i=0;i<12;i++){const a=.35+i*.09,spread=.25+i*.045;const feather=ball(mat,x+side*spread,1.78+i*.025,z+.12,.055,.52-i*.017,.035,g);feather.rotation.z=-side*a;}}
    return g;}
  box('white',0,-.15,0,64,.3,40);const floorMaterial=mats.stone.clone();floorMaterial.map=surfaceTexture('stone');floorMaterial.map.repeat.set(40,25);const floor=new T.Mesh(new T.PlaneGeometry(64,40),floorMaterial);floor.name='Porcelain_Tiled_Floor';floor.rotation.x=-Math.PI/2;floor.position.y=.003;root.add(floor);box('cream',0,-.4,0,64,.2,40);
  const ceiling=node('Ceiling_Optional');box('white',0,3.85,0,64,.18,40,ceiling);ceiling.visible=false;
  for(let x=-30;x<=30;x+=6){for(let z of[-20,20])box('dark',x,1.9,z,.08,3.8,.1);}
  for(let z=-18;z<=18;z+=6){for(let x of[-32,32])box('dark',x,1.9,z,.1,3.8,.08);}
  for(let x=-30;x<=30;x+=6)for(let z=-18;z<=18;z+=6){box('light',x,3.72,z,4.3,.035,.12,ceiling);}
  BENCHES.forEach((b,i)=>{const g=node(`Six_Person_Bench_${i+1}`);g.userData.seats=6;desk(b.x,b.z,5.4,1.6,g);box('green',b.x,.99,b.z,5.1,.38,.06,g);for(let dx of[-1.8,0,1.8])for(let side of[-1,1]){monitor(b.x+dx,b.z+side*.34,side,g);chair(b.x+dx,b.z+side*1.65,side===-1?Math.PI:0,g);}plant(b.x+2.8,b.z,.45,g);});
  const lounge=node('Central_Designer_Lounge');box('green',-20,.015,9,13,.025,4.6,lounge);sofa(-23,10,3,0,lounge);sofa(-18,8.2,2.5,Math.PI,lounge);table(-21,9,.9,lounge);table(-19.4,9.6,.5,lounge);for(let x of[-24,-17])cyl('cream',x,.22,8.6,.65,.44,lounge);angel(-27,9.5,'white',lounge);angel(-13,9.5,'metal',lounge);plant(-29,9,1.4,lounge);
  const central=node('Central_Elevator_Lounge');central.userData={purpose:'rest-and-conversation',clearAisleMeters:CENTRAL_LOUNGE.aisleWidth};
  for(const island of CENTRAL_LOUNGE.islands){box('green',island.x,.018,island.z+1,3.4,.028,6.2,central);}
  for(const item of CENTRAL_LOUNGE.furniture){const side=Math.sign(item.x);
    if(item.type==='sofa'){sofa(item.x,item.z,3,side===-1?-Math.PI/2:Math.PI/2,central);}
    else if(item.type==='table'){table(item.x,item.z,.525,central);cyl('white',item.x,.62,item.z,.065,.17,central);box('wood',item.x+.14,.56,item.z+.16,.28,.05,.2,central);}
    else if(item.type==='ottoman'){const g=node('Round_Backless_Lounge_Seat',central);cyl('cream',item.x,.23,item.z,.375,.46,g);cyl('gold',item.x,.035,item.z,.32,.055,g);}
    else {const g=node('Sculpted_Lounge_Armchair',central);ball('cream',item.x,.44,item.z,.49,.16,.48,g);ball('cream',item.x,.73,item.z+.34,.5,.42,.16,g);for(let s of[-1,1])ball('cream',item.x+s*.38,.6,item.z,.12,.2,.43,g);cyl('gold',item.x,.21,item.z,.12,.34,g);cyl('dark',item.x,.055,item.z,.38,.07,g);}

  }
  for(let side of[-1,1]){plant(side*4,-17.6,1.35,central);plant(side*4,-1.3,1.15,central);const shelf=node('Lounge_Book_And_Display_Shelf',central);box('wood',side*3.6,.72,-18.9,2,.08,.45,shelf);box('wood',side*3.6,.32,-18.9,2,.08,.45,shelf);for(let i=0;i<7;i++)box(i%2?'green':'pink',side*3.6-.75+i*.22,.94,-18.9,.12,.36,.25,shelf);}
  for(const w of WALLS){const m=box(w.material,w.x,w.h/2,w.z,w.w,w.h,w.d);m.name='SharedWall_'+w.id;m.userData.collision_wall_id=w.id;}
  const roomGroups=new Map();
  for(const r of ROOMS){
    const g=node(`Room_${r.id}`);roomGroups.set(r.id,g);g.userData={label:r.label,privacy:!!r.private};
    box('white',r.x,-.05,r.z,r.w,.025,r.d,g);const front=r.z-r.d/2;
    box('dark',r.x,3.42,front,r.w,.06,.07,g);
    if(r.private){const doorX=r.x+(r.doorSide==='right'?1:-1)*r.w/2;box('gold',doorX,2.5,r.doorZ,.14,.08,1.3,g);continue;}
    box('dark',r.x-r.w/2,1.75,front,.07,3.5,.08,g);box('dark',r.x+r.w/2,1.75,front,.07,3.5,.08,g);
    if(r.id.startsWith('office')){desk(r.x,r.z+1,2,1,g);monitor(r.x,r.z+1,1,g);chair(r.x,r.z+2,0,g);plant(r.x-1.4,r.z+2,.7,g);}
  }
  const pantry=node('Kitchen_Furniture',roomGroups.get('pantry'));pantry.position.set(53,0,-18);
  box('wood',-28, .46,18.8,7,.9,1.1,pantry);box('stone',-28,.96,18.8,7.1,.08,1.18,pantry);
  box('metal',-29.6,1.01,18.8,1,.025,.6,pantry);box('dark',-29.6,1.03,18.8,.78,.03,.44,pantry);cyl('metal',-29.6,1.25,19.03,.03,.5,pantry);box('metal',-29.6,1.5,18.9,.055,.04,.3,pantry);
  for(let [name,x,w,h] of[['Microwave',-27.8,.8,.45],['Toaster',-26.8,.5,.32],['Coffee_Machine',-25.8,.6,.65]]){const g=node(name,pantry);box('metal',x,1+h/2,18.8,w,h,.5,g);box('black',x,1+h/2,18.53,w*.75,h*.62,.025,g);}
  cyl('wood',-25.1,1.16,18.8,.13,.3,pantry); // coffee beans jar
  for(let y of[1.9,2.5]){box('wood',-28,y,19.4,7,.06,.42,pantry);for(let i=0;i<7;i++){cyl('white',-30.7+i*.55,y+.13,19.3,.07,.21,pantry);}}
  const fridge=node('Retro_Double_Door_Refrigerator',pantry);box('cream',-22.4,1.1,18.85,1.8,2.2,1.15,fridge);box('dark',-22.4,1.15,18.26,1.55,1.94,.02,fridge);for(let side of[-1,1]){let door=node('Open_Fridge_Door',fridge);door.position.set(-22.4+side*.9,0,18.23);door.rotation.y=side*-.9;box('cream',-side*.43,1.15,0,.86,1.99,.08,door);box('gold',-side*.72,1.2,-.06,.035,.65,.04,door);}for(let y of[.35,.78,1.21,1.64,2]){box('white',-22.4,y,18.6,1.55,.035,.7,fridge);for(let i=0;i<3;i++){box(i===0?'green':i===1?'pink':'white',-22.9+i*.5,y+.12,18.5,.36,.2,.3,fridge);}}
  box('wood',-26,.48,14.8,5,.96,1.2,pantry);box('stone',-26,1,14.8,5.2,.1,1.4,pantry);
  for(let i=0;i<3;i++){const x=-27.5+i*1.3;cyl('white',x,1.08,14.8,.43,.04,pantry);for(let tier=0;tier<3;tier++){cyl('pink',x,1.18+tier*.18,14.8,.3-tier*.07,.17,pantry);}cyl('white',x+.48,1.2,14.55,.07,.15,pantry);chair(x,13.4,Math.PI,pantry);}
  const cafe=node('Pantry_Cafe_Seating',roomGroups.get('pantry'));for(let z of[-14,-10,-6]){table(29,z,.75,cafe);chair(27.8,z,-Math.PI/2,cafe);chair(30.2,z,Math.PI/2,cafe);}plant(30,-16,1.4,cafe);
  const event=node('Townhall_Stage_And_Audience',roomGroups.get('pantry'));event.userData={audienceSeats:EVENT_SPACE.seats.length,sharedWith:'pantry',stageHeight:.36};
  const stage=node('Raised_Wooden_Stage',event),s=EVENT_SPACE.stage;
  box('wood',s.x,.18,s.z,s.w,.36,s.d,stage);box('wood',s.x,.12,-13.4,6,.24,.4,stage);box('wood',s.x,.06,-13,6,.12,.4,stage);box('gold',s.x,.365,-13.6,s.w,.025,.03,stage);
  const screen=node('Giant_Presentation_LED',event);box('black',16,2.05,-17.1,9.85,2.62,.16,screen);
  function displayPanel(name,x,y,z,w,h,parent=event){const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#143630';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#a9cab8';ctx.font='22px system-ui';ctx.fillText('COASTAL HEADQUARTERS / TEAM TALK',65,85);ctx.fillStyle='#faf3df';ctx.font='bold 72px system-ui';ctx.fillText('今天的灵感',65,222);ctx.fillText('从这里开始。',65,322);ctx.fillStyle='#f0bd70';ctx.fillRect(65,380,160,5);ctx.font='23px system-ui';ctx.fillText('分享 · 交流 · 一起准点下班',65,438);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const material=new T.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.35,roughness:.65});const m=box('screen',x,y,z,w,h,.015,parent);m.material=material;m.name=name;return m;}
  displayPanel('Presentation_Content',16,2.05,-17,9.6,2.45,screen);
  const podium=node('Lectern_With_Microphone',event);box('wood',12,.9,-15, .7,1.08,.6,podium);const top=box('dark',12,1.48,-15,.85,.07,.7,podium);top.rotation.x=.12;cyl('metal',12.25,1.68,-15,.018,.4,podium);ball('black',12.25,1.9,-15,.035,.04,.07,podium);
  const equipment=node('Presentation_Audio_Equipment',event);
  for(let x of[8.9,23.1]){box('black',x,.26,-14.7,.65,.52,.65,equipment);cyl('metal',x,1.05,-14.7,.035,1.55,equipment);box('black',x,1.9,-14.7,.48,.85,.4,equipment);for(let y of[1.7,2.08]){const cone=cyl('metal',x,y,-14.48,.14,.035,equipment);cone.rotation.x=Math.PI/2;}}
  for(let x of[10,22]){box('black',x,.47,-13.95,.7,.3,.35,equipment);const panel=displayPanel('Speaker_Confidence_Monitor',x,.65,-13.94,.62,.34,equipment);panel.rotation.x=-.65;}
  for(let x of[8.7,24.6]){cyl('metal',x,1,-9,.04,2,equipment);box('black',x,2,-9,1.8,1.1,.12,equipment);displayPanel('Side_Information_Display',x,2,-8.92,1.7,1,equipment);}
  for(const seat of EVENT_SPACE.seats){const g=node(seat.id,event);g.userData={type:'portable-round-plastic-stool',seatHeight:.46};cyl('plastic',seat.x,.43,seat.z,.34,.08,g);cyl('cream',seat.x,.23,seat.z,.25,.39,g);cyl('dark',seat.x,.035,seat.z,.29,.055,g);box('dark',seat.x,.29,seat.z-.252,.16,.06,.008,g);}
  const gifts=node('Gift_Distribution_Table',event);desk(10.5,0,4,1.1,gifts);for(let i=0;i<8;i++){const x=9+i%4*.8,z=-.25+Math.floor(i/4)*.5;box(i%2?'green':'pink',x,.98,z,.45,.36,.35,gifts);box('gold',x,1.17,z,.06,.015,.36,gifts);}displayPanel('Gift_Table_Sign',10.5,1.52,.27,1.1,.55,gifts);
  const av=node('Audio_Control_Desk',event);desk(24.5,-11,1.8,.8,av);box('black',24.5,.85,-11,1.4,.14,.6,av);for(let i=0;i<8;i++){cyl('metal',23.95+i*.15,.96,-11,.025,.1,av);}chair(24.5,-9.8,0,av);
  for(let x of[8.8,23.4])plant(x,-1.1,1.1,event);
  const catering=node('Catering_Service_Details',roomGroups.get('pantry'));box('wood',30.5,.42,-3,1.2,.84,.55,catering);for(let i=0;i<4;i++)cyl('white',30.2+i*.18,.9,-3,.07,.16,catering);box('metal',23.5,.4,.8,.5,.8,.5,catering);box('dark',23.5,.82,.8,.4,.04,.4,catering);
  for(const id of['chat','talk','phone']){const r=ROOMS.find(r=>r.id===id),g=roomGroups.get(id);if(id==='phone'){for(let z of[r.z-1.5,r.z+1.5]){table(r.x,z,.48,g);chair(r.x,z+.9,0,g);}}else{sofa(r.x-1.5,r.z,2.2,Math.PI/2,g);sofa(r.x+1.5,r.z,2.2,-Math.PI/2,g);table(r.x,r.z,.65,g);plant(r.x+2,r.z+3,.9,g);}}
  const rest=roomGroups.get('rest');for(let x of[6.3,12.5])for(let z of[10,18])plant(x,z,1.5,rest);
  for(let z of[11,15]){const recliner=node('Recliner',rest);box('wood',7.5,.3,z,.8,.25,1.7,recliner);let cushion=box('cream',7.5,.54,z,.75,.15,1.8,recliner);cushion.rotation.x=.28;ball('cream',7.5,.86,z+.6,.35,.18,.26,recliner);}
  // Rope lounge with cross woven strands and visible suspension.
  const hammock=node('Woven_Rope_Hammock',rest);for(let x of[9.8,12.8]){cyl('wood',x,1.35,15.5,.065,2.7,hammock);}
  for(let i=0;i<=14;i++){const x=9.8+i*3/14;const y=.75+(Math.abs(x-11.3)/1.5)**2*.7;box('cream',x,y,15.5,.035,.035,1.5,hammock);}for(let i=0;i<12;i++){const z=14.8+i*.13;for(let j=0;j<8;j++){const x=9.8+j*.4;const y=.75+(Math.abs(x-11.3)/1.5)**2*.7;const m=box('cream',x+.2,y,z,.41,.03,.025,hammock);m.rotation.z=(x-11.3)*.5;}}
  const cats=roomGroups.get('cats');for(let z of[11,17]){cyl('wood',19,1.1,z,.12,2.2,cats);for(let i=0;i<3;i++)cyl('cream',19+(i%2?-.4:.3),.45+i*.7,z,.65,.1,cats);}
  for(let x of[15.5,20.5]){box('wood',x,.35,18.5,1.2,.7,1,cats);ball('dark',x,.32,17.97,.3,.27,.02,cats);}for(let i=0;i<6;i++){const x=15.5+(i%3)*2,z=10.5+Math.floor(i/3)*4;const g=node('Ragdoll_Cat_Environment_Model',cats);ball('cream',x,.28,z,.33,.24,.5,g);ball('cream',x,.55,z-.35,.23,.22,.22,g);for(let s of[-1,1]){const e=ball('soil',x+s*.14,.76,z-.35,.08,.15,.07,g);e.rotation.z=s*.4;ball('blue',x+s*.09,.59,z-.54,.035,.04,.025,g);ball('soil',x+s*.2,.12,z-.2,.09,.1,.13,g);}ball('soil',x,.51,z-.55,.11,.09,.04,g);ball('cream',x+.4,.22,z+.3,.12,.12,.42,g);ball('pink',x+.6,.06,z-1,.07,.07,.07,cats);for(let side of[-1,1]){ball('black',x+side*.09,.59,z-.562,.014,.028,.008,g);ball('white',x+side*.082,.603,z-.572,.006,.006,.003,g);ball('white',x+side*.1,.48,z-.55,.085,.055,.055,g);ball('cream',x+side*.16,.09,z+.24,.095,.09,.13,g);}ball('pink',x,.52,z-.59,.027,.019,.014,g);for(let side of[-1,1])for(let j=0;j<3;j++){const whisker=box('white',x+side*.19,.5-j*.018,z-.574,.21,.003,.003,g);whisker.rotation.z=side*(j-1)*.12;}}
  const meeting=roomGroups.get('meeting');desk(27,14,7,2.3,meeting);for(let x of[24.2,26,27.8,29.6])for(let side of[-1,1])chair(x,14+side*1.95,side===-1?Math.PI:0,meeting);box('black',31.87,1.8,14,.05,1.3,2.3,meeting);box('screen',31.83,1.8,14,.01,1.2,2.15,meeting);plant(30.5,18.8,1.3,meeting);
  const core=node('Elevator_Core');
  for(let x of[-2.4,0,2.4]){box('metal',x,1.4,1.84,1.9,2.8,.04,core);box('black',x,1.4,1.8,.025,2.8,.01,core);box('gold',x,3,1.8,.3,.12,.02,core);}
  const corridor=node('Central_Mirror_Sanitary_Corridor');box('stone',0,.025,12,3,.04,16,corridor);box('gold',0,3.5,12,.08,.04,15,corridor);
  for(const side of[-1,1]){
    // The shared handwashing zone faces the central corridor; toilets remain deeper inside.
    box('wood',side*1.22,.44,12.2,.48,.88,3.1,corridor);box('stone',side*1.22,.91,12.2,.54,.06,3.2,corridor);
    for(let z of[11.4,12.8]){ball('white',side*1.2,.95,z,.22,.1,.35,corridor);cyl('metal',side*1.36,1.15,z,.025,.4,corridor);}
    const mirror=box('metal',side*1.425,1.8,12.2,.03,1.3,3.2,corridor);mirror.name=`Corridor_Mirror_${side}`;box('gold',side*1.4,2.48,12.2,.04,.035,3.25,corridor);
    const id=side===-1?'female':'male',r=ROOMS.find(r=>r.id===id),g=roomGroups.get(id);
    for(let z of[10.2,13.8]){const x=side*3.8;box('white',x,.55,z,.38,.75,.58,g);ball('white',x-side*.38,.38,z,.48,.22,.36,g);cyl('metal',x-side*.38,.66,z,.16,.025,g);box('white',x,1,z,.25,.04,.5,g);}
    // Offset entry screen prevents a direct view from the corridor into toilet stalls.
    
    const shower=roomGroups.get(id+'-shower');for(let z of[17.1,18.9]){box('stone',side*3.7,.07,z,1.5,.12,1.4,shower);box('metal',side*4.65,2.3,z,.42,.06,.42,shower);box('metal',side*4.8,1.7,z,.035,1.1,.035,shower);}
  }
  // Clear boundaries on both sides of the central elevator lobby, with wide lobby access.
  for(let x of[-5,5])for(const [z,d]of[[-11,18],[3,2]]){box('dark',x,3.42,z,.08,.07,d,core);}
  const details=node('Architectural_Finish_Details');
  for(let z of[-20,20]){box('gold',0,.09,z,64,.06,.08,details);box('dark',0,3.55,z,64,.06,.08,details);}
  for(let x of[-32,32]){box('gold',x,.09,0,.08,.06,40,details);box('dark',x,3.55,0,.08,.06,40,details);}
  for(const r of ROOMS.filter(r=>!r.private)){const front=r.z-r.d/2;box('gold',r.x,3.38,front,r.w,.03,.08,details);box('dark',r.x-r.w/2,.08,r.z,.06,.08,r.d,details);}
  for(const b of BENCHES){for(let dx of[-1.8,0,1.8])for(let side of[-1,1]){soft('cream',b.x+dx+.55,.82,b.z+side*.52,.18,.06,.22,.02,details);cyl('white',b.x+dx-.52,.88,b.z+side*.58,.065,.18,details);for(let i=0;i<7;i++)box('metal',b.x+dx-.17+i*.045,.81,b.z+side*.58,.025,.008,.012,details);}}
  function wayfinding(text,x,y,z,w=1.8){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#ece7d9';c.fillRect(0,0,512,128);c.fillStyle='#425447';c.font='38px system-ui';c.textAlign='center';c.fillText(text,256,76);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const board=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshStandardMaterial({map:tex,roughness:.6}));board.position.set(x,y,z);board.rotation.y=Math.PI;board.name='Wayfinding_'+text;details.add(board);}
  for(const r of ROOMS.filter(r=>!r.private&&!r.id.startsWith('office')))wayfinding(r.label.replace(' · 综合茶水间',''),r.x,2.8,r.z-r.d/2-.08,Math.min(r.w-1,2.5));
  wayfinding('电梯 / LIFT',0,3.22,1.8,2);wayfinding('女 / WOMEN',-2.6,2.7,5.92,1.8);wayfinding('男 / MEN',2.6,2.7,5.92,1.8);
  for(let x of[-31.7,31.7])for(let z of[-19.7,19.7])soft('wood',x,1.9,z,.5,3.8,.5,.02,details);
  const food=node('Pantry_Food_And_Appliance_Detail',pantry);
  for(let x of[-28,-26.8,-25.8]){cyl('metal',x,1.35,18.49,.045,.025,food).rotation.x=Math.PI/2;box('light',x+.15,1.35,18.48,.05,.015,.01,food);}
  for(let i=0;i<6;i++){cyl('white',-24.7,1.03+i*.018,18.7,.18,.016,food);}for(let i=0;i<7;i++){ball(i%2?'pink':'green',-26.5+i*.2,1.12,14.4,.09,.09,.09,food);}
  for(let y of[.78,1.21,1.64])for(let i=0;i<3;i++){const x=-22.9+i*.5;soft('white',x,y+.12,18.52,.36,.16,.28,.025,food);soft('green',x,y+.22,18.52,.32,.045,.25,.01,food);}
  const pendants=node('Pendant_Light_Fixtures');for(const {x,z}of CENTRAL_LOUNGE.islands){cyl('gold',x,3.25,z,.013,.7,pendants);cyl('gold',x,2.84,z,.42,.07,pendants);cyl('light',x,2.8,z,.39,.025,pendants);}
  for(let z of[-15,-9,-3]){box('dark',16,3.63,z,14,.04,.07,ceiling);for(let x of[10,16,22]){cyl('metal',x,3.48,z,.09,.21,ceiling);cyl('light',x,3.36,z,.07,.025,ceiling);}}
  root.updateMatrixWorld(true);
  return {root,ceiling,solids,floorHeight};
}
export function buildCoast(){const group=new T.Group();group.name='Coastal_Context';const materials=new Map(),cube=new T.BoxGeometry(1,1,1);const mat=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.65}));return materials.get(c);};function block(c,x,y,z,w,h,d){const m=new T.Mesh(cube,mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;}
  const water=mat(0xffffff).clone();water.map=surfaceTexture('water',16);water.roughness=.2;water.metalness=.15;const sea=block(0x41a9bb,0,-26.5,-240,1000,.3,700);sea.material=water;sea.name='Turquoise_Ocean';
  const sand=block(0xecd7aa,0,-26,-43,350,.3,32);sand.material=mat(0xffffff).clone();sand.material.map=surfaceTexture('sand',40);sand.name='Sunshine_Sandy_Beach';
  block(0x9faf8e,0,-26.3,45,350,.4,150);block(0xbcc7c5,0,-26,29,350,.1,12);block(0xd9d7cb,0,-13,0,63,26,39);
  for(let i=0;i<8;i++)block(0xe5f3e7,0,-26.28,-59-i*.32,330,.018,.12+i*.025);
  for(let i=0;i<14;i++){const side=i%2?-1:1,x=side*(48+Math.floor(i/2)*15),height=25+(i*13)%48,z=8+(i%4)*16;block(0x627f90,x,height/2-26,z,11,height,12);for(let y=-23;y<height-26;y+=3){block(0xd3d6cf,x,y,z-6.06,11,.13,.08);for(let dx=-4;dx<=4;dx+=2)block(0x9cb0b6,x+dx,y+1.4,z-6.06,.08,2.8,.08);}block(0xc6d0cd,x,height-25.7,z,11.3,.6,12.3);}
  const palmStem=new T.CylinderGeometry(.13,.21,1,10),frondGeo=new T.SphereGeometry(1,12,6);for(let x=-120;x<=120;x+=16){const palm=new T.Group();palm.name='Beach_Palm';palm.position.set(x,-26,-34);const trunk=new T.Mesh(palmStem,mat(0x806e4e));trunk.scale.y=5.5;trunk.position.y=2.75;palm.add(trunk);for(let i=0;i<9;i++){const a=i*Math.PI*2/9,leaf=new T.Mesh(frondGeo,mat(0x477e55));leaf.scale.set(.23,.1,2);leaf.position.set(Math.sin(a)*1.2,5.35,Math.cos(a)*1.2);leaf.rotation.set(.12,a,.08);palm.add(leaf);}group.add(palm);}
  for(let x=-100;x<=100;x+=25){const table=block(0xf4e8cb,x,-25.5,-49,1.3,.15,.8);table.name='Beach_Lounger';block(0x8b7558,x,-25.8,-49,.07,.6,.07);}
  return group;
}
