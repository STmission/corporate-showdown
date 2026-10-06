import {WEAPONS} from './weapons.mjs';
import { FLOOR, BENCHES } from './office-design.mjs';
import { HEADQUARTERS_SOLIDS, LAYOUT_REVISION } from './headquarters-layout.mjs';
import { CHARACTER_REVISION } from './animation.mjs';
export { floorHeight } from './headquarters-layout.mjs';

export const LEVEL = Object.freeze({
  id: 'lv_001', revision: LAYOUT_REVISION, characterRevision:CHARACTER_REVISION,duration: 300,
  width: FLOOR.width, depth: FLOOR.depth,
  environment: '/assets/models/coastal-headquarters-gameplay.glb',
  spawn: { x: -18, z: 5.8 }, exit: { x: 0, z: .9 }, boss: { x: 0, z: -2.5 },
  objectives: [
    { id: 'file', label: '提交最终文件', x: -20, z: 5.8, seconds: 2 },
    { id: 'card', label: '取回个人门禁卡', x: -6.4, z: .6, seconds: 2 },
  ],
  desks: BENCHES.map(b => ({...b, w:5.4, d:1.6})),
  solids: HEADQUARTERS_SOLIDS,
  enemies: [
    { kind: 'runner', x: -22, z: 5.8 }, { kind: 'thrower', x: -8, z: -5.5 },
    { kind: 'shield', x: -7, z: .5 }, { kind: 'runner', x: 0, z: -3 },
  ],
  items: [
    { kind: 'keyboard', x: -18, z: 5.8 }, { kind: 'coffee', x: -7, z: 5.8 },
    { kind: 'chair', x: -7, z: -1 }, { kind: 'extinguisher', x: 0, z: -9 },
    { kind: 'box', x: 0, z: -17 },
  ],
});
export const ITEM_NAMES = { ...Object.fromEntries(Object.values(WEAPONS).map(w=>[w.id,w.name])), keyboard: '键盘', coffee: '咖啡', chair: '转椅', extinguisher: '灭火器', box: '纸箱护盾' };
export const ROLES = { coder: { label: '研发 · 阿程', skill: '干扰脉冲', color: '#63ddd0' }, admin: { label: '行政 · 安安', skill: '推车冲撞', color: '#fac578' } };
