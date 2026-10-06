import { appearanceSlot } from './appearance.mjs';

// Presentation only: this costume does not change profession, stats or hitboxes.
export function characterAssetSlot(entity) {
  if (entity.id === 'doctor' && entity.profession === '医生' && entity.gender === 'female') return 'female_doctor';
  if (entity.id === 'teacher' && entity.profession === '老师' && entity.gender === 'female') return 'female_teacher';
  return appearanceSlot(entity.gender, entity.job);
}
