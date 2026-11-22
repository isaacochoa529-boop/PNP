// ===== WORLD: the stone training yard, sky, torches, trees, sign, respawn button, hidden alcove =====
const AR_R = 9.4;                 // walkable radius inside the wall
const DUMMY_POS = new V3(0, 0, -2.2);
const RESP_POS = new V3(1.35, 1.02, -1.7);   // top of the red button
const GARY_POS = new V3(0, .78, -11.25);

scene.add(new THREE.HemisphereLight('#ffe0c4', '#5a3d2e', 1.1));
const sun = new THREE.DirectionalLight('#ffd2a1', 2.2);
sun.position.set(6, 12, 5); sun.target.position.set(0, 0, -2);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
sun.shadow.bias = -0.0008; sun.shadow.normalBias = .02;
scene.add(sun, sun.target);

function canvasTex(w, h, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
  return t;
}
// sky dome: warm dusk gradient
{
  const g = new THREE.SphereGeometry(300, 24, 12);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(.22,.24,.45); vec3 mid = vec3(.95,.58,.42); vec3 low = vec3(.98,.78,.55);' +
      'vec3 c = h > .05 ? mix(mid, top, smoothstep(.05,.6,h)) : mix(low, mid, smoothstep(-.1,.05,h)); gl_FragColor = vec4(c,1.); }' });
  scene.add(new THREE.Mesh(g, m));
}
// ground outside + stone arena floor
{
  const grass = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshStandardMaterial({ color: '#6b6a3a', roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -.01; grass.receiveShadow = true; scene.add(grass);
  const stone = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#6d6258'; x.fillRect(0, 0, w, h);
    const s = 64;
    for (let j = 0; j < h / s; j++) for (let i = 0; i < w / s; i++) {
      const off = (j % 2) * s / 2, l = 38 + Math.random() * 14;
      x.fillStyle = `hsl(25, ${8 + Math.random() * 8}%, ${l}%)`;
      x.fillRect(i * s + off + 3, j * s + 3, s - 6, s - 6);
      x.fillRect(i * s + off + 3 - w, j * s + 3, s - 6, s - 6);
      for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; x.fillRect(i * s + off + Math.random() * s, j * s + Math.random() * s, 6, 6); }
    }
  }, 6);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(10.2, 48), new THREE.MeshStandardMaterial({ map: stone, roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
}
// round wall made of chunky stone blocks, with ONE gap behind a banner (north)
{
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: '#8a7d70', roughness: .95 });
  const list = [];
  const N = 44, R = 10.1;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    const gap = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < .07;
    for (let row = 0; row < 2; row++) {
      if (gap) continue;
      const aa = a + (row ? Math.PI / N : 0);
      list.push({ x: Math.cos(aa) * R, z: Math.sin(aa) * R, y: .33 + row * .64, ry: -aa, sx: .66, sy: .62 + Math.random() * .06, sz: 1.5 });
    }
  }
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  list.forEach((b, i) => {
    m4.compose(new V3(b.x, b.y, b.z), _q1.setFromEuler(new THREE.Euler(rand(-.03, .03), b.ry, rand(-.03, .03))), new V3(b.sx, b.sy, b.sz));
    im.setMatrixAt(i, m4); im.setColorAt(i, c.setHSL(.07, rand(.05, .14), rand(.38, .52)));
  });
  im.receiveShadow = true; scene.add(im);
  // the secret little room behind the north banner
  const rm = new THREE.MeshStandardMaterial({ color: '#5d544c', roughness: 1 });
  const add = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rm); m.position.set(x, y, z); scene.add(m); };
  add(2.2, .1, 2.2, 0, -.04, -11.2); add(.3, 2, 2.2, -1.15, 1, -11.2); add(.3, 2, 2.2, 1.15, 1, -11.2); add(2.2, 2, .3, 0, 1, -12.35); add(2.6, .2, 2.6, 0, 2.05, -11.2);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, .6, 10), new THREE.MeshStandardMaterial({ color: '#9a8f84' })); ped.position.set(0, .3, -11.25); scene.add(ped);
  // (no extra point light here: Quest is happier with fewer lights; Gary glows a little instead)
}
// banners (cloth sways). The north one hides the gap and has a torn corner.
const banners = [];
{
  const tex = torn => canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = '#7a0f18'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e9c46a'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 40, w, 6);
    x.fillStyle = '#f1e6cf'; x.beginPath(); x.arc(64, 100, 30, 0, 7); x.fill(); x.fillRect(46, 120, 36, 22);   // skull
    x.fillStyle = '#7a0f18'; x.beginPath(); x.arc(52, 100, 9, 0, 7); x.arc(76, 100, 9, 0, 7); x.fill(); x.fillRect(54, 130, 4, 12); x.fillRect(62, 130, 4, 12); x.fillRect(70, 130, 4, 12);
    x.strokeStyle = '#f1e6cf'; x.lineWidth = 8; x.beginPath(); x.moveTo(24, 170); x.lineTo(104, 220); x.moveTo(104, 170); x.lineTo(24, 220); x.stroke();
    if (torn) { x.clearRect(84, 200, 44, 56); x.beginPath(); x.moveTo(84, 256); x.lineTo(100, 222); x.lineTo(128, 210); x.lineTo(128, 256); x.fill(); }
  });
  [[-Math.PI / 2, true], [0, false], [Math.PI / 2, false], [Math.PI, false]].forEach(([a, torn]) => {
    const t = tex(torn);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.2, 6, 10), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, transparent: torn, alphaTest: .5, roughness: 1 }));
    const r = torn ? 9.7 : 9.6;
    m.position.set(Math.cos(a) * r, 1.15, Math.sin(a) * r); m.lookAt(0, 1.15, 0);
    scene.add(m); banners.push({ m, base: m.geometry.attributes.position.array.slice(), ph: a });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.6, 6), new THREE.MeshStandardMaterial({ color: '#4a2f1d' }));
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.1, 0); m.add(bar);
  });
}
function stepBanners(t) {
  for (const b of banners) {
    const p = b.m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = b.base[i * 3 + 1], x = b.base[i * 3]; p.setZ(i, Math.sin(t * 1.6 + x * 2 + b.ph) * .05 * (1.1 - y) / 2.2); }
    p.needsUpdate = true;
  }
}
// torches with flickering fire
const flames = [];
{
  const wood = new THREE.MeshStandardMaterial({ color: '#4a2f1d', roughness: 1 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2b2b', metalness: .6, roughness: .5 });
  const fire = new THREE.MeshBasicMaterial({ color: '#ffb347' }), core = new THREE.MeshBasicMaterial({ color: '#fff2a8' });
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) / 8 * Math.PI * 2, x = Math.cos(a) * 9.4, z = Math.sin(a) * 9.4;
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 1.8, 8), wood); pole.position.y = .9; g.add(pole);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.16, .08, .16, 10, 1, true), iron); bowl.position.y = 1.85; g.add(bowl);
    const f = new THREE.Mesh(new THREE.ConeGeometry(.12, .38, 8), fire); f.position.y = 2.05; g.add(f);
    const c = new THREE.Mesh(new THREE.ConeGeometry(.06, .22, 6), core); c.position.y = 2.0; g.add(c);
    flames.push(f, c); scene.add(g);
  }
}
const torchLight = new THREE.PointLight('#ff9a3c', 3, 14, 1.6); torchLight.position.set(0, 2.6, -3); scene.add(torchLight);
function stepFlames(t) {
  flames.forEach((f, i) => { const k = 1 + Math.sin(t * 13 + i * 2.1) * .12 + Math.sin(t * 29 + i) * .06; f.scale.set(1 / k, k, 1 / k); f.rotation.y = t * 3 + i; });
  torchLight.intensity = 2.6 + Math.sin(t * 11) * .3 + Math.sin(t * 23) * .2;
}
// trees and far mountains (an open horizon around the yard)
{
  const pine = [], oak = [];
  for (let i = 0; i < 140; i++) {
    const a = Math.random() * Math.PI * 2, r = rand(16, 90);
    (Math.random() < .65 ? pine : oak).push({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, s: rand(.9, 1.7), ry: Math.random() * 6 });
  }
  TreeKit.scatter('pine', pine, { detail: 0 }).meshes.forEach(m => scene.add(m));
  TreeKit.scatter('oak', oak, { detail: 0 }).meshes.forEach(m => scene.add(m));
  const mm = new THREE.MeshStandardMaterial({ color: '#7a6070', flatShading: true, roughness: 1, fog: false });
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + rand(-.1, .1), r = rand(150, 200), h = rand(30, 70);
    const m = new THREE.Mesh(new THREE.ConeGeometry(rand(30, 50), h, 6), mm); m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r); m.rotation.y = rand(0, 3); scene.add(m);
  }
}
// rip counter sign
const sign = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(); g.position.set(-1.7, 0, -2.4); g.rotation.y = .5;
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 1 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 1.5, 8), wood); post.position.y = .75; g.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(.8, .42, .04), wood); board.position.y = 1.5; g.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.74, .37), new THREE.MeshBasicMaterial({ map: t })); face.position.set(0, 1.5, .022); g.add(face);
  scene.add(g);
  return { c, t };
})();
function updateSign() {
  const x = sign.c.getContext('2d');
  x.fillStyle = '#2a1a10'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#f1e6cf'; x.font = 'bold 21px Fredoka, sans-serif'; x.textAlign = 'center';
  x.fillText('🦴 PARTS RIPPED: ' + state.rips, 128, 38);
  x.fillText('💀 HEAD SMASHES: ' + state.smashes, 128, 72);
  x.fillText('💥 BODY SLAMS: ' + (state.slams || 0), 128, 106);
  sign.t.needsUpdate = true;
}
updateSign();
// big red "new dummy" button
const respBtn = (() => {
  const g = new THREE.Group(); g.position.set(RESP_POS.x, 0, RESP_POS.z);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, .95, 10), new THREE.MeshStandardMaterial({ color: '#3b3b40', metalness: .4, roughness: .6 })); ped.position.y = .475; g.add(ped);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .04, 16), new THREE.MeshStandardMaterial({ color: '#f0b429' })); rim.position.y = .97; g.add(rim);
  const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e0202e', emissive: '#600', roughness: .4 })); b.position.y = .99; b.scale.y = .6; g.add(b);
  scene.add(g); return b;
})();
// Gary the chicken (just a chicken in a secret room)
const gary = (() => {
  const g = new THREE.Group(); g.position.copy(GARY_POS); g.rotation.y = 0;
  const w = new THREE.MeshStandardMaterial({ color: '#fbfbf5', roughness: .8, emissive: '#5a4a20' }), o = new THREE.MeshStandardMaterial({ color: '#f39c12' }), r = new THREE.MeshStandardMaterial({ color: '#d11a2a' }), k = new THREE.MeshStandardMaterial({ color: '#111' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), w); body.scale.set(1, .9, 1.25); body.position.y = .2; g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.07, .14, 8), w); tail.position.set(0, .28, -.15); tail.rotation.x = -.8; g.add(tail);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), w); head.position.set(0, .36, .12); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.025, .06, 8), o); beak.rotation.x = Math.PI / 2; beak.position.set(0, .35, .2); g.add(beak);
  const comb = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), r); comb.scale.set(.5, 1, 1.4); comb.position.set(0, .43, .12); g.add(comb);
  const wat = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), r); wat.position.set(0, .31, .18); g.add(wat);
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), k); e.position.set(s * .045, .38, .17); g.add(e);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), w); wing.scale.set(.3, .7, 1.1); wing.position.set(s * .12, .21, -.01); g.add(wing);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .1, 6), o); leg.position.set(s * .04, .06, 0); g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.04, .01, .05), o); foot.position.set(s * .04, .01, .02); g.add(foot);
  });
  scene.add(g); return g;
})();
// stone pillars + wooden crates to slam things into
const PILLARS = [[-4.2, -3.8], [4.6, -4.4], [-5.6, 2.6], [5.2, 3.2]].map(([x, z]) => ({ x, z, r: .42, h: 3.2 }));
const POST = { x: DUMMY_POS.x, z: DUMMY_POS.z - .2, r: .05, h: 1.35, off: true }; PILLARS.push(POST);   // the dummy's wooden post (solid once he's off it)
const CRATES = [[3, .4, .9], [-3.3, -.9, .8], [2.4, -5.6, .8]].map(([x, z, s]) => ({ x, z, h: s / 2, top: s }));
{
  const sm = new THREE.MeshStandardMaterial({ color: '#9b8f82', roughness: .9 });
  for (const P of PILLARS) {
    const g = new THREE.Group(); g.position.set(P.x, 0, P.z);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.36, .4, 3, 14), sm); col.position.y = 1.5; g.add(col);
    for (let i = 0; i < 8; i++) { const fl = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.6, .06), new THREE.MeshStandardMaterial({ color: '#83786c' })); const a = i / 8 * Math.PI * 2; fl.position.set(Math.cos(a) * .37, 1.5, Math.sin(a) * .37); g.add(fl); }
    const base = new THREE.Mesh(new THREE.BoxGeometry(1, .22, 1), sm); base.position.y = .11; g.add(base);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.95, .2, .95), sm); cap.position.y = 3.05; g.add(cap);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
  }
  const plank = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#8a5a32'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#7a4e2a' : '#946338'; x.fillRect(0, i * 32 + 2, w, 28); }
    x.strokeStyle = '#4a2f1d'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8); x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, h - 8); x.stroke();
  });
  for (const C of CRATES) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(C.h * 2, C.top, C.h * 2), new THREE.MeshStandardMaterial({ map: plank, roughness: 1 }));
    m.position.set(C.x, C.top / 2, C.z); m.castShadow = m.receiveShadow = true; scene.add(m);
  }
}
// keep a point inside the yard (or the secret room corridor) and out of pillars/crates
function keepIn(p, r = .25) {
  const inCorr = Math.abs(p.x) < .75 && p.z < -8.5;
  if (inCorr) { p.z = Math.max(p.z, -12.1 + r); p.x = clamp(p.x, -.9 + r, .9 - r); return p; }
  const d = Math.hypot(p.x, p.z), lim = AR_R + .5 - r;
  if (d > lim) { p.x *= lim / d; p.z *= lim / d; }
  for (const P of PILLARS) {
    const dx = p.x - P.x, dz = p.z - P.z, dd = Math.hypot(dx, dz), m = P.r + r;
    if (P.off) continue;
    if (dd < m && p.y < P.h) { const k = m / (dd || 1e-4); p.x = P.x + dx * k; p.z = P.z + dz * k; }
  }
  for (const C of CRATES) {
    if (p.y > C.top) continue;
    const dx = p.x - C.x, dz = p.z - C.z, m = C.h + r;
    if (Math.abs(dx) < m && Math.abs(dz) < m) {
      const ox = m - Math.abs(dx), oz = m - Math.abs(dz), oy = C.top - p.y;
      if (oy < Math.min(ox, oz) && oy < .25) p.y = C.top;           // landed on top of the crate
      else if (ox < oz) p.x = C.x + Math.sign(dx || 1) * m; else p.z = C.z + Math.sign(dz || 1) * m;
    }
  }
  return p;
}
