export const routes = new Map([
  ['/trial-socket.mjs', ['public/trial-socket.mjs', 'text/javascript']],
  ['/model-loader.mjs', ['public/model-loader.mjs', 'text/javascript']],
  ['/vendor/THREE-LICENSE.txt', ['../node_modules/three/LICENSE', 'text/plain']],
  ['/vendor/MESHOPT-LICENSE.txt', ['../assets/licenses/meshoptimizer-0.22-MIT.txt', 'text/plain']],
  ['/asset-credits.txt', ['../assets/characters/README.md', 'text/plain']],
  ['/', ['public/index.html', 'text/html']], ['/style.css', ['public/style.css', 'text/css']],
  ['/game.mjs', ['public/game.mjs', 'text/javascript']], ['/view.mjs', ['public/view.mjs', 'text/javascript']],
  ['/audio-settings.mjs', ['public/audio-settings.mjs', 'text/javascript']],
  ['/audio.mjs', ['public/audio.mjs', 'text/javascript']],
  ['/shared/level.mjs', ['shared/level.mjs', 'text/javascript']],
  ['/vendor/three.js', ['../node_modules/three/build/three.module.js', 'text/javascript']],
  ['/vendor/three.core.js', ['../node_modules/three/build/three.core.js', 'text/javascript']],
]);
for (const name of ['studio.html', 'studio.css', 'studio.mjs', 'studio-scene.mjs', 'studio-materials.mjs']) {
  routes.set(name === 'studio.html' ? '/studio' : '/' + name, ['public/' + name, name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript']);
}
for(const name of ['protocol.mjs','movement.mjs','animation.mjs','camera-rig.mjs','weapons.mjs','weapon-geometry.mjs', 'story.mjs'])routes.set('/shared/'+name,['shared/'+name,'text/javascript']);
routes.set('/character-animation.mjs',['public/character-animation.mjs','text/javascript']);
routes.set('/first-person-arms.mjs',['public/first-person-arms.mjs','text/javascript']);
routes.set('/conversation-animation.mjs',['public/conversation-animation.mjs','text/javascript']);
routes.set('/conversation-focus.mjs',['public/conversation-focus.mjs','text/javascript']);
routes.set('/assets/animations/conversation-v1/workplace-conversation.glb',['../assets/animations/conversation-v1/workplace-conversation.glb','model/gltf-binary']);
routes.set('/reliable-channel.mjs',['public/reliable-channel.mjs','text/javascript']);
routes.set('/input-controls.mjs',['client/input-controls.mjs','text/javascript']);
routes.set('/network-state.mjs',['public/network-state.mjs','text/javascript']);
routes.set('/shared/headquarters-layout.mjs', ['shared/headquarters-layout.mjs', 'text/javascript']);
routes.set('/shared/headquarters-collision.mjs', ['shared/headquarters-collision.mjs', 'text/javascript']);
routes.set('/shared/appearance.mjs', ['shared/appearance.mjs', 'text/javascript']);
routes.set('/shared/office-design.mjs', ['shared/office-design.mjs', 'text/javascript']);
routes.set('/assets/concepts/coastal-office.png', ['../assets/concepts/coastal-office.png', 'image/png']);
for (const name of ['controls/OrbitControls.js', 'exporters/GLTFExporter.js', 'loaders/GLTFLoader.js', 'libs/meshopt_decoder.module.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js', 'objects/Reflector.js', 'geometries/RoundedBoxGeometry.js']) {
  routes.set('/vendor/addons/' + name, ['../node_modules/three/examples/jsm/' + name, 'text/javascript']);
}
routes.set('/assets/environment-modules/v0.1/manifest.json',['../assets/environment-modules/v0.1/manifest.json','application/json']);
for(const id of ['office','central-lounge','townhall','pantry','service-core','cats-rest','meeting-rooms','architecture','coastal-exterior'])routes.set('/assets/environment-modules/v0.1/'+id+'.glb',['../assets/environment-modules/v0.1/'+id+'.glb','model/gltf-binary']);
routes.set('/assets/models/coastal-headquarters-gameplay.glb', ['../assets/models/coastal-headquarters-gameplay.glb', 'model/gltf-binary']);
routes.set('/assets/models/coastal-headquarters-complete.glb', ['../assets/models/coastal-headquarters-complete.glb', 'model/gltf-binary']);
for (const gender of ['male','female']) for (const job of ['programmer','ecommerce','sales','celebrity']) {
  const name=`${gender}_${job}.glb`;
  routes.set('/assets/characters/'+name, ['../assets/characters/'+name, 'model/gltf-binary']);
}
routes.set('/shared/character-assets.mjs', ['shared/character-assets.mjs', 'text/javascript']);
routes.set('/assets/characters/female_teacher.glb', ['../assets/characters/professions-v1/teacher/female_teacher.glb', 'model/gltf-binary']);
routes.set('/assets/characters/female_doctor.glb', ['../assets/characters/professions-v1/female_doctor.glb', 'model/gltf-binary']);
routes.set('/assets/characters/male_sales.glb', ['../assets/characters/refined-v2/male_sales/male_sales.glb', 'model/gltf-binary']);
for(const slot of ['male_programmer','male_ecommerce','male_sales','male_celebrity','female_programmer','female_ecommerce','female_sales','female_celebrity','female_doctor','female_teacher'])routes.set('/assets/characters/'+slot+'.glb',['../assets/characters/weapon-ready-v1/'+slot+'.glb','model/gltf-binary']);
for(const slot of ['male_programmer','male_ecommerce','male_sales','male_celebrity','female_programmer','female_ecommerce','female_sales','female_celebrity','female_doctor','female_teacher'])routes.set('/assets/characters/first-person/'+slot+'.glb',['../assets/characters/first-person-v1/'+slot+'.glb','model/gltf-binary']);
routes.set('/shared/weapon-grip.mjs',['shared/weapon-grip.mjs','text/javascript']);
