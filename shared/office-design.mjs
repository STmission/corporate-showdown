export const FLOOR = { width: 64, depth: 40, height: 3.8, capacity: 52, units: 'meters' };
export const BENCHES = [-25, -14].flatMap(x => [-15, -9, -3, 3].map(z => ({ x, z })));
export const ROOMS = [
  { id:'pantry', label:'演讲活动区 · 综合茶水间', x:20,z:-8,w:24,d:20,backDoorX:29,backDoorWidth:1.8 },
  { id:'chat', label:'交流室', x:11,z:5,w:6,d:6 },
  { id:'talk', label:'洽谈室', x:17,z:5,w:6,d:6 },
  { id:'phone', label:'电话间', x:21.5,z:5,w:3,d:6,frontDoorX:20.9,frontDoorWidth:1.2 },
  { id:'rest', label:'植物休憩区', x:9.5,z:14,w:9,d:12 },
  { id:'cats', label:'封闭布偶猫房', x:18,z:14,w:8,d:12 },
  { id:'meeting', label:'大会议室', x:27,z:14,w:10,d:12 },
  { id:'female', label:'左侧女士卫生间', x:-3.25,z:11,w:3.5,d:10, private:true, doorSide:'right', doorZ:7.5 },
  { id:'male', label:'右侧男士卫生间', x:3.25,z:11,w:3.5,d:10, private:true, doorSide:'left', doorZ:7.5 },
  { id:'female-shower', label:'女士独立淋浴间', x:-3.25,z:18,w:3.5,d:4, private:true, doorSide:'right', doorZ:18 },
  { id:'male-shower', label:'男士独立淋浴间', x:3.25,z:18,w:3.5,d:4, private:true, doorSide:'left', doorZ:18 },
  ...[-29,-23,-17,-11].map((x,i)=>({id:`office${i}`,label:`独立办公室 ${i+1}`,x,z:17,w:5,d:6}))
];
export const STATIONS = BENCHES.flatMap((b,i)=>[-1.8,0,1.8].flatMap(dx=>[-1,1].map(side=>({id:`bench-${i}-${dx}-${side}`,x:b.x+dx,z:b.z+side*1.65,side})))).concat(ROOMS.filter(r=>r.id.startsWith('office')).map(r=>({id:r.id,x:r.x,z:r.z,side:1})));
export const APPEARANCES = {
  genders:['male','female'],
  jobs:[{id:'programmer',label:'程序员 · 格子衬衫',outfit:'plaid-shirt'}, {id:'ecommerce',label:'电商 · 商务休闲',outfit:'smart-casual'}, {id:'sales',label:'销售 · 西装',outfit:'tailored-suit'}, {id:'celebrity',label:'明星 · 潮流穿搭',outfit:'streetwear'}],
  assetPattern:'{gender}_{job}.glb', status:'Eight CC0-based rigged outfits available; combat animation pending'
};

export const EVENT_SPACE = {
  stage:{x:16,z:-15.3,w:14,d:3.4,height:.36},
  screen:{x:16,z:-17.05,w:9.6,h:2.45},
  seats:[-11.5,-9.5,-7.5,-5.5,-3.5].flatMap((z,row)=>[10.5,12.5,14.5,17.5,19.5,21.5].map((x,col)=>({id:`event-seat-${row}-${col}`,x,z}))),
  entry:{x:16,z:.5,yaw:0},
  aisle:{x:16,w:2.2},
};

export const CENTRAL_LOUNGE = {
  entry:{x:0,z:-18}, aisleWidth:3,
  islands:[-13,-5.5].flatMap(z=>[-1,1].map(side=>({side,x:side*3.2,z}))),
  furniture:[-13,-5.5].flatMap(z=>[-1,1].flatMap(side=>[
    {type:'sofa',x:side*3.8,z,w:.95,d:3},
    {type:'table',x:side*2.25,z,w:1.05,d:1.05},
    {type:'armchair',x:side*3.45,z:z+2.6,w:1,d:1},
    {type:'ottoman',x:side*2.4,z:z+2.6,w:.75,d:.75},
  ])),
};
