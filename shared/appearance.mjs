export const GENDERS = Object.freeze(['male','female']);
export const JOBS = Object.freeze({programmer:'程序员 · 格子衬衫',ecommerce:'电商 · 商务穿搭',sales:'销售 · 西装',celebrity:'明星 · 潮流穿搭'});
export function appearanceSlot(gender,job){
  if(!GENDERS.includes(gender)||!Object.hasOwn(JOBS,job))throw new Error('请选择有效的性别与职务装扮');
  return `${gender}_${job}`;
}
export function appearanceLabel(p){return `${p.gender==='female'?'女生':'男生'} / ${JOBS[p.job]}`;}
