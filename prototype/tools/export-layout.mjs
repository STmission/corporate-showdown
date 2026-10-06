import { writeFile } from 'node:fs/promises';
import { LAYOUT_REVISION, WALLS, HEADQUARTERS_SOLIDS } from '../shared/headquarters-layout.mjs';
const path='assets/models/headquarters-collision.json';
await writeFile(path,JSON.stringify({revision:LAYOUT_REVISION,walls:WALLS,solids:HEADQUARTERS_SOLIDS},null,2)+'\n');
console.log(JSON.stringify({path,revision:LAYOUT_REVISION,walls:WALLS.length,solids:HEADQUARTERS_SOLIDS.length}));
