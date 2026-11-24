/* ---------- KNUCKLE BEACH 🏖️ ----------
   A sunset beach through the sandy portal in the grove (BEACH_PORTAL_G). Its own area: state.area 'beach',
   far away at BEACH. Sand slopes into a wavy ocean (shader) with foam that washes up and down the shore,
   palms (TreeKit), umbrellas, towels, tiki torches, a pier, a lifeguard tower, a bouncy beach ball (a real toy),
   a sandcastle you can smash (it builds itself back), crabs that scuttle sideways and run from you, and seagulls
   that glide, land, walk, peck and flap away when you get close. The sky turns to sunset while you're here.
   Ground = one t:4 collider (the sand heightfield); props are normal colliders.
   Creatures are drawn with a few InstancedMeshes (BB): every body part is an Object3D in BB.root and its matrix
   is copied into its batch each frame, so ~260 moving parts cost ~16 draw calls (Quest!). */
const BEACH = V(1500, 0, 0);
const BEACH_SPAWN = V(0, 0, 14);
const BEACH_PORTAL_G = V(-2.6, 0, -7.6);   // in the grove
let _bsec = []; try { _bsec = JSON.parse(store.get('kg-bsec') || '[]'); } catch (e) {}
const BC = { inside: false, sunset: false, found: new Set(_bsec), crabs: [], gulls: [], amb: null, cawT: 3, wet: false, smash: 0, chunks: [], castleT: 0, gold: null, bottle: null };
const _bz1 = V(), _bz2 = V(), _bz3 = V();

/* ---------- the land: sand, wet sand, dunes, rocky ends ---------- */
function beachH(x, z) {
  const s = Math.sin;
  const base = z < 0 ? Math.max(-.42, .12 + z * .06) : .12 + z * .045;          // sea floor levels off so your eyes stay above the water
  const dune = sst(20, 34, z) * (2.2 + 1.2 * s(x * .13) + .8 * s(x * .31 + 1.3));
  const rip = z > 0 ? .05 * s(x * .21 + z * .17) * s(z * .23 - x * .07) : .02 * s(x * .9) * s(z * .7);
  const ends = sst(46, 60, Math.abs(x)) * 5.5;                                   // rocky headlands make a cove
  return base + dune + rip + ends;
}
const BT_S = { tag: 'grass' };
const BFIELD = { t: 4, tag: 'grass', last: BT_S, minx: BEACH.x - 62, maxx: BEACH.x + 62, minz: BEACH.z - 62, maxz: BEACH.z + 48, miny: BEACH.y - 4, maxy: BEACH.y + 14,
  sdf(p, n) {
    const lx = p.x - BEACH.x, lz = p.z - BEACH.z, e = .15, h = beachH(lx, lz);
    n.set(-(beachH(lx + e, lz) - beachH(lx - e, lz)) / (2 * e), 1, -(beachH(lx, lz + e) - beachH(lx, lz - e)) / (2 * e));
    const L = n.length(); n.multiplyScalar(1 / L); this.last = BT_S;
    return (p.y - BEACH.y - h) / L;
  } };
colliders.push(BFIELD);
const bCol = c => { c.x += BEACH.x; c.z += BEACH.z; if (c.t === 0) c.y += BEACH.y; else if (c.t === 1) c.cy += BEACH.y; return addCol(c); };

const BG = new THREE.Group(); BG.position.copy(BEACH); BG.visible = false; scene.add(BG);
const BS = new THREE.Group(); BG.add(BS);   // still things: glued together by material at the end
{
  const g = new THREE.PlaneGeometry(124, 110, 100, 88); g.rotateX(-Math.PI / 2); g.translate(0, 0, -7);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), dry = new THREE.Color(0xf3d7a0), wet = new THREE.Color(0xc59a62),
    grass = new THREE.Color(0x86a852), rock = new THREE.Color(0x8b8076), under = new THREE.Color(0xd9c08c);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = beachH(x, z); p.setY(i, h);
    const ends = sst(46, 60, Math.abs(x)), dune = sst(22, 32, z) * (.6 + .4 * Math.sin(x * .4 + z * .3));
    c.copy(dry).lerp(wet, sst(2.4, .4, z)).lerp(under, sst(-1, -3, z));
    c.offsetHSL(0, 0, hsh(x, 0, z, 1) * .05);
    c.lerp(grass, clamp(dune * .85, 0, .85)).lerp(rock, clamp(ends * 1.4 - .2, 0, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; BG.add(m);
}

/* ---------- the ocean + the foam that laps the sand ---------- */
const SEA_U = { t: { value: 0 }, deep: { value: new THREE.Color(0x1c4a78) }, shal: { value: new THREE.Color(0x3fc0b4) }, hor: { value: new THREE.Color(0xf6a07a) },
  skyc: { value: new THREE.Color(0xff9e86) }, glow: { value: new THREE.Color(0xffd890) } };
const sea = (() => {
  const g = new THREE.PlaneGeometry(440, 300, 88, 60); g.rotateX(-Math.PI / 2); g.translate(0, 0, -146);
  const m = new THREE.ShaderMaterial({ uniforms: SEA_U, transparent: true, depthWrite: false, fog: false,
    vertexShader: `uniform float t; varying vec3 vW; varying vec3 vL; varying vec3 vN;
      float wv(vec2 q){ return sin(q.x*.33+t*1.3)*.07 + sin(q.y*.47-t*1.7+q.x*.11)*.09 + sin((q.x+q.y)*.83+t*2.4)*.03; }
      void main(){ vec3 p = position; float amp = .25 + .75*smoothstep(-1., -18., p.z);
        float h = wv(p.xz)*amp; float hx = wv(p.xz+vec2(.6,0.))*amp, hz = wv(p.xz+vec2(0.,.6))*amp;
        p.y += h; vN = normalize(vec3(h-hx, .6, h-hz)); vL = p; vec4 w = modelMatrix*vec4(p,1.); vW = w.xyz;
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float t; uniform vec3 deep; uniform vec3 shal; uniform vec3 hor; uniform vec3 skyc; uniform vec3 glow; varying vec3 vW; varying vec3 vL; varying vec3 vN;
      void main(){ vec3 N = normalize(vN);
        float rx = sin(vL.x*2.1+t*2.)*cos(vL.z*1.7-t*1.6) + sin(vL.x*3.7-vL.z*2.9+t*3.1)*.5;
        float rz = cos(vL.x*1.9-t*1.4)*sin(vL.z*2.3+t*2.2) + cos(vL.z*4.1+vL.x*1.3-t*2.7)*.5;
        N = normalize(N + vec3(rx,0.,rz)*.07);
        vec3 Vd = cameraPosition - vW; float dist = length(Vd); Vd /= dist;
        float fr = pow(1.-max(dot(N,Vd),0.), 4.);
        vec3 col = mix(shal, deep, smoothstep(0., -22., vL.z));
        col = mix(col, skyc, .22 + fr*.6);
        vec3 R = reflect(-Vd, N); float s = max(dot(R, normalize(vec3(0.,.045,-1.))), 0.);
        col += glow*(pow(s, 300.)*3. + pow(s, 24.)*.45);
        col = mix(col, hor, smoothstep(50., 215., dist));
        gl_FragColor = vec4(col, mix(.62, .97, smoothstep(-.3, -6., vL.z))); }` });
  const me = new THREE.Mesh(g, m); me.renderOrder = 1; me.frustumCulled = false; BG.add(me); return me;
})();
const FOAM_U = { t: { value: 0 } };
const BWASH = (x, t) => -1.4 + 1.5 * (.5 + .5 * Math.sin(t * .8 + x * .045)) + .25 * Math.sin(x * .37 + t * 1.1) + .15 * Math.sin(x * .91 - t * .7);   // where the water reaches (local z)
{
  const g = new THREE.PlaneGeometry(112, 7, 112, 14); g.rotateX(-Math.PI / 2); g.translate(0, 0, -1.2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.max(beachH(p.getX(i), p.getZ(i)), -.03) + .02);
  const m = new THREE.ShaderMaterial({ uniforms: FOAM_U, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t; varying vec3 vL;
      float hs(vec2 q){ return fract(sin(dot(q, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ float x = vL.x, z = vL.z;
        float e = -1.4 + 1.5*(.5+.5*sin(t*.8+x*.045)) + .25*sin(x*.37+t*1.1) + .15*sin(x*.91-t*.7);
        float d = e - z;
        float line = smoothstep(-.06, .04, d) * (1. - smoothstep(.08, .45, d));
        float e2 = e - 1. - .3*sin(x*.23 - t*1.3); float d2 = e2 - z;
        float line2 = smoothstep(-.05, .05, d2) * (1. - smoothstep(.06, .3, d2));
        float wash = smoothstep(0., .15, d) * .38;
        float bub = .55 + .45*step(.45, hs(floor(vec2(x,z)*9.) + floor(t*3.)));
        float a = clamp(line*.95*bub + line2*.55*bub + wash, 0., 1.) * smoothstep(55., 48., abs(x));
        gl_FragColor = vec4(mix(vec3(.55,.9,.92), vec3(1.), clamp(line+line2,0.,1.)), a); }` });
  const me = new THREE.Mesh(g, m); me.renderOrder = 2; BG.add(me);
}

/* ---------- the sunset: a big low sun, its glow and some pink cloud streaks ---------- */
{
  const sunM = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshBasicMaterial({ color: 0xffd47a, fog: false })); sunM.position.set(0, 8, -190); BG.add(sunM);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cg = cv.getContext('2d'), gr = cg.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,230,160,1)'); gr.addColorStop(.35, 'rgba(255,170,100,.55)'); gr.addColorStop(1, 'rgba(255,120,90,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(95, 95, 1); glow.position.set(0, 8, -186); BG.add(glow);
  const cl = [0xff8fa3, 0xffb27a, 0xa98bd6].map(c => new THREE.MeshBasicMaterial({ color: c, fog: false }));
  [[-55, 22, -175, 34, 0], [30, 30, -180, 42, 2], [-15, 38, -170, 28, 1], [70, 18, -165, 26, 0], [-90, 28, -150, 30, 2], [5, 15, -178, 22, 1]].forEach(([x, y, z, w, k]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), cl[k]); m.position.set(x, y, z); m.scale.set(w, 2.4, 4); BS.add(m);
  });
}

/* ---------- props ---------- */
const bh = (x, z) => beachH(x, z);
function bpart(geo, m, x, y, z, parent = BS) { const me = part(geo, m, x, y, z, parent); return me; }
// palms (from the tree kit) along the back of the beach and on the headlands
{
  const P = [[-30, 10], [-24.5, 14], [-18, 18.5], [-9.5, 21], [-4, 24.5], [6.5, 22], [11, 17.5], [24, 13], [29.5, 17.5], [35, 11],
    [-36, 6], [41, 7], [-44, 15], [45, 19], [-12, 28], [16, 27], [2, 31], [-25, 30], [27, 29]].map(([x, z], k) => ({ x, z, y: bh(x, z) - .05, s: .72 + hsh(x, 0, z, 4) * .35 + .17, ry: k * 2.1 }));
  TreeKit.scatter('palm', P).meshes.forEach(m => BG.add(m));
  P.forEach(p => bCol({ t: 1, x: p.x, z: p.z, cy: p.y + 1.4, hy: 1.4, r: .3 * p.s, tag: 'wood' }));
}
// umbrellas with striped tops + towels underneath
const towelTex = (a, b) => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * 16, 64, 16); } g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(0, 0, 64, 5); g.fillRect(0, 123, 64, 5); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
function umbrella(x, z, c1, c2, tilt) {
  const y = bh(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(tilt * .6, tilt * 3, tilt); BS.add(g);
  part(new THREE.CylinderGeometry(.03, .03, 2.3, 8), mat(0xeeeeee, { flatShading: false }), 0, 1.1, 0, g);
  const A = mat(c1, { side: THREE.DoubleSide }), B = mat(c2, { side: THREE.DoubleSide }), N = 10, th = Math.PI * 2 / N;
  for (let k = 0; k < N; k++) part(new THREE.ConeGeometry(1.35, .5, 2, 1, true, k * th, th), k % 2 ? A : B, 0, 2.2, 0, g).castShadow = true;
  part(new THREE.SphereGeometry(.06, 10, 8), mat(c1), 0, 2.47, 0, g);
  bCol({ t: 1, x, z, cy: y + 1.1, hy: 1.1, r: .05, tag: 'wood' });
}
function towel(x, z, yaw, a, b) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.85, .015, 1.75), new THREE.MeshLambertMaterial({ map: towelTex(a, b) }));
  m.position.set(x, bh(x, z) + .012, z); m.rotation.set(Math.atan(.045), yaw, 0); m.receiveShadow = true; BG.add(m);
}
[[-7, 4, 0xff4f6d, 0xffffff, .05, -5.6, 4.6, .3, '#ff4f6d', '#ffe08a'], [-2.5, 6, 0x3fb2ff, 0xffffff, -.06, -1.2, 6.2, -.2, '#3fb2ff', '#ffffff'],
 [5, 4.5, 0xffd25a, 0xff8a3d, .04, 6.3, 5.4, .15, '#8b6bff', '#3fe0bd'], [9.5, 7, 0x3fe0bd, 0xffffff, -.05, 8.4, 8.1, -.35, '#ff8a3d', '#fff3c2'],
 [-21, 5, 0x8b6bff, 0xffe08a, .07, -19.6, 5.6, .1, '#3fb2ff', '#ffd25a'], [26, 5.5, 0xff4fa8, 0xffffff, -.04, 27.3, 6.4, -.1, '#ff4fa8', '#ffffff']]
  .forEach(([x, z, c1, c2, tl, tx, tz, ty, ta, tb]) => { umbrella(x, z, c1, c2, tl); towel(tx, tz, ty, ta, tb); });
// cooler, surfboards, driftwood, shells + starfish, a wooden sign
{
  const cx = 3.6, cz = 6, cy = bh(cx, cz);
  bpart(new THREE.BoxGeometry(.6, .36, .38), mat(0x3fb2ff), cx, cy + .18, cz); bpart(new THREE.BoxGeometry(.64, .08, .42), mat(0xffffff), cx, cy + .4, cz);
  bCol({ t: 0, x: cx, y: cy + .22, z: cz, hx: .32, hy: .22, hz: .21, tag: 'wood' });
  [[12, 9.5, .2, 0xff8a3d], [12.9, 9.8, -.15, 0x3fe0bd], [-27, 8, .1, 0xffd25a]].forEach(([x, z, r, c]) => {
    const g = new THREE.Group(); g.position.set(x, bh(x, z), z); g.rotation.set(r, r * 4, r * .6); BS.add(g);
    part(new THREE.SphereGeometry(1, 18, 10), mat(c, { flatShading: false }), 0, .95, 0, g).scale.set(.28, 1.15, .045);   // a surfboard stuck in the sand
    part(new THREE.BoxGeometry(.035, 2.1, .05), mat(0xffffff), 0, .95, .0, g);
    bCol({ t: 1, x, z, cy: bh(x, z) + 1, hy: 1, r: .16, tag: 'wood' });
  });
  [[-25, 1.8, .4], [33, 2.6, -.8]].forEach(([x, z, yw]) => { const l = bpart(new THREE.CylinderGeometry(.18, .22, 3.2, 9), mat(0x9a8068), x, bh(x, z) + .12, z); l.rotation.set(0, yw, Math.PI / 2); });
  for (let i = 0; i < 26; i++) {
    const x = (hsh(i, 1, 2, 5) * 2) * 48, z = .8 + (hsh(i, 2, 1, 6) + .5) * 9, y = bh(x, z);
    if (i % 3 === 0) { const s = bpart(new THREE.CylinderGeometry(.1, .1, .02, 5), mat(0xff7a59), x, y + .01, z); s.rotation.y = i; }   // starfish
    else { const s = bpart(new THREE.SphereGeometry(.05, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(i % 2 ? 0xfff1e0 : 0xffc2b8), x, y, z); s.scale.set(1, .5, 1.3); }
  }
  // sign by the spawn
  const sg = new THREE.Group(); sg.position.set(3.4, bh(3.4, 17), 17); sg.rotation.y = Math.atan2(BEACH_SPAWN.x - 3.4, BEACH_SPAWN.z - 17); BS.add(sg);
  const wood = mat(0x7a5232); [-1, 1].forEach(s => part(new THREE.CylinderGeometry(.06, .07, 2, 8), wood, s * .85, 1, 0, sg));
  const t = labelTex(512, 220, (cg, w, h) => signText(cg, w, h, [['KNUCKLE BEACH 🏖️', 58, '#ffd25a', 70], ['crabs pinch. gulls steal. 🦀', 30, '#ffffff', 150]], 'rgba(90,52,28,.95)', '#ffb27a'));
  const b = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .82), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); b.position.set(0, 1.55, .04); sg.add(b);
  bCol({ t: 0, x: 3.4, y: bh(3.4, 17) + 1.55, z: 17, hx: .95, hy: .41, hz: .06, yaw: sg.rotation.y, tag: 'wood' });
}
// the pier: walk out over the water
const PIER = { x: 18, z0: 3.6, z1: -26, top: .64 };
{
  const plank = mat(0x9c7350), dark = mat(0x6d4c33), L = PIER.z0 - PIER.z1, mz = (PIER.z0 + PIER.z1) / 2;
  bpart(new THREE.BoxGeometry(2.4, .12, L), plank, PIER.x, PIER.top - .06, mz);
  for (let z = PIER.z1 + .4; z < PIER.z0; z += .55) bpart(new THREE.BoxGeometry(2.42, .02, .06), dark, PIER.x, PIER.top + .005, z);
  for (let z = PIER.z1 + .3; z < PIER.z0; z += 3.2) [-1, 1].forEach(s => {
    bpart(new THREE.CylinderGeometry(.1, .11, 1.6, 8), dark, PIER.x + s * 1.1, PIER.top - .7, z);
    bpart(new THREE.CylinderGeometry(.05, .05, .75, 6), dark, PIER.x + s * 1.15, PIER.top + .37, z);
    bCol({ t: 1, x: PIER.x + s * 1.1, z, cy: PIER.top - .7, hy: .8, r: .11, tag: 'wood' });
  });
  [-1, 1].forEach(s => { bpart(new THREE.BoxGeometry(.08, .08, L), plank, PIER.x + s * 1.15, PIER.top + .72, mz); bCol({ t: 0, x: PIER.x + s * 1.15, y: PIER.top + .4, z: mz, hx: .05, hy: .36, hz: L / 2, tag: 'wood' }); });
  bCol({ t: 0, x: PIER.x, y: PIER.top - .1, z: mz, hx: 1.2, hy: .1, hz: L / 2, tag: 'wood' });
  const sy = bh(PIER.x, PIER.z0 + .5);   // a step up from the sand
  bpart(new THREE.BoxGeometry(2.2, .5, .6), plank, PIER.x, sy + (PIER.top - sy) / 2 - .2, PIER.z0 + .4);
  bCol({ t: 0, x: PIER.x, y: (sy + PIER.top) / 2 - .32, z: PIER.z0 + .4, hx: 1.1, hy: .25, hz: .3, tag: 'wood' });
  // a lantern at the end
  bpart(new THREE.CylinderGeometry(.05, .05, 1.4, 6), dark, PIER.x - .9, PIER.top + .7, PIER.z1 + .4);
  BC.lamp = bpart(new THREE.SphereGeometry(.13, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd28a }), PIER.x - .9, PIER.top + 1.5, PIER.z1 + .4, BG);
}
// lifeguard tower (climb the ladder; something shiny lives on the roof)
const LG_TOWER = { x: -14, z: 9 };
{
  const x = LG_TOWER.x, z = LG_TOWER.z, y = bh(x, z), wood = mat(0xf2f2ec), red = mat(0xff4f4f), top = y + 2.1;
  [[-.7, -.6], [.7, -.6], [-.7, .6], [.7, .6]].forEach(([dx, dz]) => { bpart(new THREE.CylinderGeometry(.07, .08, 2.1, 8), wood, x + dx, y + 1.05, z + dz); bCol({ t: 1, x: x + dx, z: z + dz, cy: y + 1.05, hy: 1.05, r: .08, tag: 'wood' }); });
  bpart(new THREE.BoxGeometry(1.7, .1, 1.5), wood, x, top, z); bCol({ t: 0, x, y: top, z, hx: .85, hy: .06, hz: .75, tag: 'wood' });
  bpart(new THREE.BoxGeometry(1.7, 1.2, .06), red, x, top + .65, z + .72); bCol({ t: 0, x, y: top + .65, z: z + .72, hx: .85, hy: .6, hz: .04, tag: 'wood' });
  [-1, 1].forEach(s => { bpart(new THREE.BoxGeometry(.06, .5, 1.5), red, x + s * .82, top + .3, z); bCol({ t: 0, x: x + s * .82, y: top + .3, z, hx: .04, hy: .25, hz: .75, tag: 'wood' }); });
  [-1, 1].forEach(s => bpart(new THREE.CylinderGeometry(.04, .04, 1.25, 6), wood, x + s * .8, top + .65, z - .7));
  bpart(new THREE.BoxGeometry(1.95, .12, 1.8), red, x, top + 1.33, z); bpart(new THREE.BoxGeometry(1.75, .06, 1.6), wood, x, top + 1.42, z);
  bCol({ t: 0, x, y: top + 1.36, z, hx: .97, hy: .09, hz: .9, tag: 'wood' });
  [[0, .88, 1.95, .1], [0, -.88, 1.95, .1], [.95, 0, .1, 1.8], [-.95, 0, .1, 1.8]].forEach(([dx, dz, w, d]) => bpart(new THREE.BoxGeometry(w, .26, d), red, x + dx, top + 1.52, z + dz));   // a rim: you only see the roof from up there
  for (let k = 0; k < 7; k++) {   // ladder on the sea side
    const ry = y + .25 + k * .3, rz = z - .95 - (6 - k) * .06;
    bpart(new THREE.BoxGeometry(.6, .05, .06), wood, x, ry, rz); bCol({ t: 0, x, y: ry, z: rz, hx: .3, hy: .03, hz: .04, tag: 'wood' });
  }
  [-1, 1].forEach(s => { const r = bpart(new THREE.BoxGeometry(.05, 2.25, .06), wood, x + s * .3, y + 1.15, z - 1.13); r.rotation.x = -.2; });
  // the rescue sign
  const t = labelTex(256, 96, (cg, w, h) => signText(cg, w, h, [['LIFEGUARD', 46, '#ffffff', 60]], 'rgba(255,79,79,1)', '#ffffff'));
  const sgn = new THREE.Mesh(new THREE.PlaneGeometry(.9, .34), new THREE.MeshBasicMaterial({ map: t })); sgn.position.set(x, top - .35, z - .62); sgn.rotation.y = Math.PI; BG.add(sgn);
}
// rocks out in the water at the left end (and what hides behind them)
{
  const rm = mat(0x847a70);
  [[-38, -4.5, 1.2], [-40, -6.5, 1.6], [-41.6, -4.8, .9], [-39.2, -8.6, 1.1], [-36.8, -6.8, .7], [36, -3, 1.1], [38, -5.2, 1.5], [-47, 3, 1.4], [48, 4, 1.7]].forEach(([x, z, r], k) => {
    const y = bh(x, z) + r * .25, m = bpart(rockGeo(r, k + 3), rm, x, y, z); m.scale.y = .8;
    bCol({ t: 2, c: V(x + BEACH.x, y + BEACH.y, z + BEACH.z), r: r * .85, tag: 'rock' });
  });
}
// tiki torches lighting the path from the spawn (flames flicker)
const TIKI = [[-2.2, 11.5], [2.2, 11.5], [-2.4, 7.5], [2.4, 7.5]].map(([x, z]) => {
  const y = bh(x, z); bpart(new THREE.CylinderGeometry(.04, .05, 1.5, 6), mat(0x6d4c33), x, y + .75, z); bpart(new THREE.CylinderGeometry(.08, .06, .2, 8), mat(0x3b2a1a), x, y + 1.55, z);
  bCol({ t: 1, x, z, cy: y + .8, hy: .8, r: .06, tag: 'wood' });
  return V(x, y + 1.72, z);
});

// the beach ball: a real toy (grab it, throw it, bonk it)
const BEACH_BALL = (() => {
  const x = 1.5, z = 8.4, p = makeProp('ball', BEACH.x + x, BEACH.y + bh(x, z) + .3, BEACH.z + z);
  p.g.clear(); p.r = .22;
  const cols = [0xff4f6d, 0xffffff, 0x3fb2ff, 0xffffff, 0xffd25a, 0xffffff];
  for (let k = 0; k < 6; k++) p.g.add(new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 12, k * Math.PI / 3, Math.PI / 3), mat(cols[k], { flatShading: false, roughness: .45 })));
  [1, -1].forEach(s => { const c = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 6), mat(0xffd25a, { flatShading: false })); c.position.y = s * .2; c.scale.y = .35; p.g.add(c); });
  p.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return p;
})();

// the sandcastle: smash it with a paw (or run through it), it builds itself back
const CASTLE = (() => {
  const x = -5, z = 2.4, g = new THREE.Group(); g.position.set(x, bh(x, z), z); BG.add(g);
  const sand = mat(0xe6c287), dk = mat(0xcfa86e);
  part(new THREE.BoxGeometry(.9, .32, .9), sand, 0, .16, 0, g);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { part(new THREE.CylinderGeometry(.13, .15, .55, 10), sand, a * .45, .27, b * .45, g); part(new THREE.ConeGeometry(.15, .2, 10), dk, a * .45, .64, b * .45, g); });
  part(new THREE.CylinderGeometry(.2, .24, .7, 12), sand, 0, .55, 0, g); part(new THREE.ConeGeometry(.24, .3, 12), dk, 0, 1.05, 0, g);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; part(new THREE.BoxGeometry(.08, .08, .08), sand, Math.cos(a) * .2, .93, Math.sin(a) * .2, g); }
  part(new THREE.BoxGeometry(.18, .2, .04), mat(0x8a5a2b), 0, .1, .46, g);   // door
  part(new THREE.CylinderGeometry(.008, .008, .3, 5), mat(0x6d4c33), 0, 1.33, 0, g);
  const flag = part(new THREE.BoxGeometry(.16, .09, .005), mat(0xff4f6d), .08, 1.43, 0, g);
  const moat = new THREE.Mesh(new THREE.RingGeometry(.75, .95, 28), new THREE.MeshLambertMaterial({ color: 0x6fc3d0, transparent: true, opacity: .75 }));
  moat.rotation.x = -Math.PI / 2; moat.position.set(x, bh(x, z) + .015, z); BG.add(moat);
  const C = { g, flag, at: V(x, bh(x, z) + .45, z), up: true, grow: 1 };
  const chunkM = new THREE.InstancedMesh(new THREE.BoxGeometry(.09, .09, .09), sand, 30); chunkM.count = 0; chunkM.castShadow = true; chunkM.frustumCulled = false; BG.add(chunkM);
  C.chunkM = chunkM; return C;
})();

/* ---------- creatures: little rigs made of Object3D parts, drawn as instanced batches ---------- */
const BB = { list: new Map(), root: new THREE.Object3D(), zero: new THREE.Matrix4().makeScale(0, 0, 0) };
const SPH = new THREE.SphereGeometry(1, 12, 8), CYL = new THREE.CylinderGeometry(1, 1, 1, 7), CONE = new THREE.ConeGeometry(1, 1, 8), BOX = new THREE.BoxGeometry(1, 1, 1);
function piv(parent, x = 0, y = 0, z = 0) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; }
function bp(geo, m, parent, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const o = piv(parent, x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz);
  const k = geo.uuid + m.uuid; let b = BB.list.get(k); if (!b) BB.list.set(k, b = { geo, m, objs: [] }); b.objs.push(o); return o;
}
function bbBuild() { for (const b of BB.list.values()) { const im = new THREE.InstancedMesh(b.geo, b.m, b.objs.length); im.frustumCulled = false; im.castShadow = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); b.im = im; BG.add(im); } bbSync(); }
function bbSync() {
  BB.root.updateMatrixWorld(true);
  for (const b of BB.list.values()) { b.objs.forEach((o, i) => b.im.setMatrixAt(i, o.parent && o.parent.visible !== false && o.visible ? o.matrixWorld : BB.zero)); b.im.instanceMatrix.needsUpdate = true; }
}
const CRAB_M = { b: mat(0xe2552e, { flatShading: false, roughness: .55 }), s: mat(0xb8381f, { flatShading: false, roughness: .5 }) };
const GOLD_M = { b: new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .25, envMap: ENV }), s: new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 1, roughness: .2, envMap: ENV }) };
const BLK = mat(0x111111, { flatShading: false, roughness: .3 }), WHT = mat(0xf7f7f2, { flatShading: false }), GRY = mat(0x9aa4b0, { flatShading: false }), BEAK = mat(0xffc23d, { flatShading: false }), LEG = mat(0xf0a050, { flatShading: false });

// a crab: faces +z, walks sideways along its own x
function makeCrab(M, sc = 1) {
  const g = piv(BB.root), rig = piv(g); rig.scale.setScalar(sc); const body = piv(rig, 0, .075, 0);
  bp(SPH, M.b, body, 0, 0, 0, .15, .06, .115); bp(SPH, M.s, body, 0, .022, -.012, .13, .045, .095);
  const eyes = [-1, 1].map(s => { const st = piv(body, s * .04, .035, .085); bp(CYL, M.b, st, 0, .03, 0, .008, .06, .008); bp(SPH, BLK, st, 0, .066, 0, .017, .017, .017); return st; });
  const claws = [-1, 1].map(s => {
    const arm = piv(body, s * .1, 0, .07); arm.rotation.y = s * .55;
    bp(CYL, M.b, arm, 0, 0, .05, .02, .1, .02, Math.PI / 2);
    const hand = piv(arm, 0, 0, .11); bp(SPH, M.b, hand, 0, 0, .035, .042, .032, .052);
    bp(BOX, M.s, hand, -s * .014, 0, .095, .016, .016, .065);
    const jaw = piv(hand, s * .014, 0, .065); bp(BOX, M.s, jaw, 0, 0, .03, .016, .016, .065);
    return { arm, hand, jaw, s };
  });
  const legs = [];
  [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) {
    const hip = piv(body, s * .11, -.01, .035 - i * .045); hip.rotation.y = s * (i - 1) * .3;
    const up = piv(hip); bp(BOX, M.b, up, s * .05, 0, 0, .1, .017, .017);
    const knee = piv(up, s * .1, 0, 0); bp(BOX, M.s, knee, s * .06, 0, 0, .12, .014, .014);
    legs.push({ up, knee, s, i });
  } });
  return { g, rig, body, eyes, claws, legs, ph: Math.random() * 6, mv: 0, snap: 0, raise: 0, hop: 0, hv: 0 };
}
function poseCrab(C, dt, t) {
  for (const L of C.legs) {
    const ph = C.ph + ((L.i % 2) ^ (L.s > 0 ? 1 : 0)) * Math.PI, lift = Math.max(0, Math.sin(ph)) * C.mv;
    L.up.rotation.z = L.s * (.5 + lift * .35); L.up.rotation.y = Math.cos(ph) * .35 * C.mv; L.knee.rotation.z = -L.s * (1.6 - lift * .2);
  }
  C.body.position.y = .075 + Math.abs(Math.sin(C.ph)) * .01 * C.mv + C.hop;
  C.body.rotation.z = Math.sin(C.ph) * .06 * C.mv;
  const snap = C.snap > 0 ? Math.abs(Math.sin(C.snap * 14)) * .5 : .08 + Math.sin(t * 1.3 + C.ph) * .04;
  C.claws.forEach(c => { c.arm.rotation.x = -C.raise * .9 + Math.sin(t * 2 + c.s) * .05; c.jaw.rotation.y = c.s * snap; });
  C.eyes.forEach((e, k) => { e.rotation.z = Math.sin(t * 1.7 + k + C.ph) * .2; e.rotation.x = -C.raise * .3; });
}
// a seagull: faces +z
function makeGull() {
  const g = piv(BB.root), body = piv(g, 0, .21, 0);
  bp(SPH, WHT, body, 0, 0, 0, .085, .08, .2); bp(SPH, GRY, body, 0, .04, -.03, .08, .05, .17);
  bp(BOX, GRY, body, 0, .015, -.22, .1, .014, .11); bp(BOX, BLK, body, 0, .015, -.28, .1, .015, .03);
  const neck = piv(body, 0, .06, .15), head = piv(neck);
  bp(SPH, WHT, head, 0, .02, 0, .062, .058, .07); bp(CONE, BEAK, head, 0, .01, .1, .017, .075, .017, Math.PI / 2);
  bp(SPH, BLK, head, .04, .035, .035, .011, .011, .011); bp(SPH, BLK, head, -.04, .035, .035, .011, .011, .011);
  const wings = [-1, 1].map(s => {
    const sh = piv(body, s * .06, .045, .02); bp(BOX, GRY, sh, s * .14, 0, 0, .28, .016, .13);
    const el = piv(sh, s * .28, 0, 0); bp(BOX, GRY, el, s * .12, 0, -.01, .24, .013, .11); bp(BOX, BLK, el, s * .28, 0, -.025, .08, .014, .08);
    return { sh, el, s };
  });
  const legs = [-1, 1].map(s => { const hip = piv(body, s * .035, -.07, 0); bp(CYL, LEG, hip, 0, -.065, 0, .008, .13, .008); bp(BOX, LEG, hip, 0, -.132, .02, .045, .006, .05); return hip; });
  return { g, body, neck, head, wings, legs };
}
const bpick = (r = 26) => V((Math.random() * 2 - 1) * r, 0, 2 + Math.random() * 10);
for (let i = 0; i < 5; i++) {
  const C = makeCrab(CRAB_M, .9 + Math.random() * .35), p = bpick(30);
  Object.assign(C, { x: p.x, z: p.z * .7 - .5, yaw: Math.random() * 6, tx: p.x, tz: p.z, wait: Math.random() * 3, fear: 0, boop: 0 });
  BC.crabs.push(C);
}
BC.gold = (() => { const C = makeCrab(GOLD_M, 1.3); C.g.position.set(LG_TOWER.x + .1, bh(LG_TOWER.x, LG_TOWER.z) + 2.1 + 1.45, LG_TOWER.z - .05); C.g.rotation.y = Math.PI; C.ph = 0; return C; })();
for (let i = 0; i < 6; i++) {
  const o = makeGull(), lander = i >= 3, p = bpick(22);
  BC.gulls.push({ o, mode: lander ? 'ground' : 'air', p: lander ? V(p.x, bh(p.x, p.z), p.z) : V(p.x, 9, -p.z), v: V(), yaw: Math.random() * 6, ph: Math.random() * 6, fold: lander ? 1 : 0,
    cx: (Math.random() * 2 - 1) * 14, cz: -2 + Math.random() * 8, r: 9 + Math.random() * 10, h: 7 + Math.random() * 6, ang: Math.random() * 6, w: (.25 + Math.random() * .15) * (i % 2 ? 1 : -1),
    lander, timer: 6 + Math.random() * 10, tgt: V(), walkT: 0, peck: 0, flap: 0 });
}
// a message in a bottle bobbing behind the rocks
BC.bottle = (() => {
  const g = new THREE.Group(); g.position.set(-43.6, 0, -9.6); BG.add(g);
  const gl = new THREE.MeshStandardMaterial({ color: 0x7fe0a0, transparent: true, opacity: .6, roughness: .1, metalness: .1, envMap: ENV });
  part(new THREE.CylinderGeometry(.07, .07, .26, 12), gl, 0, 0, 0, g); part(new THREE.CylinderGeometry(.03, .06, .08, 10), gl, 0, .16, 0, g);
  part(new THREE.CylinderGeometry(.028, .028, .05, 8), mat(0x8a5a2b), 0, .22, 0, g); part(new THREE.CylinderGeometry(.035, .035, .16, 8), mat(0xfff1c8), 0, 0, 0, g);
  g.rotation.z = 1.2; return g;
})();
bbBuild();
mergeStatic(BS);

/* ---------- portals: grove <-> beach ---------- */
const gPortalBeach = makePortal(BEACH_PORTAL_G, Math.atan2(-BEACH_PORTAL_G.x, -BEACH_PORTAL_G.z), 'THE BEACH 🏖️', 0xffb86b, 0x3fd0ff); scene.add(gPortalBeach.g); gPortalBeach.g.updateMatrixWorld(true);
addCol({ t: 1, x: BEACH_PORTAL_G.x, z: BEACH_PORTAL_G.z, cy: .06, hy: .06, r: 1.1, tag: 'rock' });
const BP_HOME = V(-4.2, 0, 17.8);
const bPortalHome = makePortal(V(BP_HOME.x, bh(BP_HOME.x, BP_HOME.z) - .02, BP_HOME.z), Math.atan2(BEACH_SPAWN.x - BP_HOME.x, BEACH_SPAWN.z - BP_HOME.z), 'BACK TO THE GROVE 🌳', 0x6fdc4f, 0xffd25a);
BG.add(bPortalHome.g); bPortalHome.g.updateMatrixWorld(true);
bCol({ t: 1, x: BP_HOME.x, z: BP_HOME.z, cy: bh(BP_HOME.x, BP_HOME.z) + .06, hy: .08, r: 1.1, tag: 'rock' });

function beachGo() { arrive(V(BEACH.x + BEACH_SPAWN.x, BEACH.y + bh(BEACH_SPAWN.x, BEACH_SPAWN.z), BEACH.z + BEACH_SPAWN.z), 0, 'beach'); }
function beachRespawn() { beachGo(); }
function bSecret(id, msg) {
  if (BC.found.has(id)) return false; BC.found.add(id); store.set('kg-bsec', JSON.stringify([...BC.found]));
  toast(msg, 7); sfxWin(); headWorld(_bz1); confetti(_bz1.clone().add(V(0, .3, 0)), 70); hands.forEach(h => buzz(h, 1, 120)); return true;
}

/* ---------- sunset sky (only while you're here, and not in horror mode) ---------- */
const SUNSET = { bg: new THREE.Color(0xf6a27a), fog: new THREE.Color(0xf3a882), top: new THREE.Color(0x3d3f8f), bot: new THREE.Color(0xff9a5c), hc: new THREE.Color(0xffd0b0), hg: new THREE.Color(0x7a5a48), sc: new THREE.Color(0xffb27a) };
const DAY_SUNC = sun.color.clone();
function applySunset(on) {
  BC.sunset = on;
  if (on) {
    scene.background.copy(SUNSET.bg); scene.fog.color.copy(SUNSET.fog); scene.fog.near = 45; scene.fog.far = 210;
    hemi.color.copy(SUNSET.hc); hemi.groundColor.copy(SUNSET.hg); hemi.intensity = 1; sun.color.copy(SUNSET.sc); sun.intensity = 1.6;
    skyU.top.value.copy(SUNSET.top); skyU.bot.value.copy(SUNSET.bot);
    SEA_U.hor.value.copy(SUNSET.bot).lerp(SUNSET.top, .15);
  } else if (!HZ.on) {
    scene.background.copy(DAY.bg); scene.fog.color.copy(DAY.fog); scene.fog.near = DAY.near; scene.fog.far = DAY.far;
    hemi.color.copy(DAY.hc); hemi.groundColor.copy(DAY.hg); hemi.intensity = DAY.hemi; sun.color.copy(DAY_SUNC); sun.intensity = DAY.sun;
    skyU.top.value.copy(DAY.top); skyU.bot.value.copy(DAY.bot);
  }
}

/* ---------- sounds: waves, gulls, crab squeaks ---------- */
function beachAmb(on) {
  if (on && !BC.amb && ac) {
    const len = ac.sampleRate * 3, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const s = ac.createBufferSource(); s.buffer = b; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); BC.amb = { s, f, g };
  }
  if (!on && BC.amb) { const A = BC.amb; BC.amb = null; A.g.gain.setTargetAtTime(0, ac.currentTime, .2); A.s.stop(ac.currentTime + 1.2); }
}
const sfxGull = (n = 2) => { if (!ac) return; for (let k = 0; k < n; k++) { tone('triangle', 1650, 1050, .2, .07, k * .26); tone('sawtooth', 1650 * 1.5, 1050 * 1.5, .16, .015, k * .26); } };
const sfxPinch = () => { if (ac) { tone('square', 1300, 1900, .05, .05); tone('square', 1300, 1900, .05, .05, .09); } };

/* ---------- per frame ---------- */
function stepBeach(dt) {
  const here = state.area === 'beach';
  if (here !== BC.inside) {
    BC.inside = here; BG.visible = here;
    camera.far = here ? 270 : (state.area === 'wilds' ? 320 : 220); camera.updateProjectionMatrix(); if (CS.cam) { CS.cam.far = camera.far; CS.cam.updateProjectionMatrix(); }
    if (!here) beachAmb(false);
  }
  const wantSun = here && !HZ.on; if (wantSun !== BC.sunset) applySunset(wantSun);
  // the grove portal in, the beach portal home
  if (state.mode === 'play' && AR.portalCool <= 0) {
    headWorld(_bz1);
    const ring = P => { P.g.worldToLocal(_bz2.copy(_bz1)); return Math.abs(_bz2.z) < .32 && Math.hypot(_bz2.x, _bz2.y - 1) < .8; };
    if (state.area === 'grove' && ring(gPortalBeach)) { beachGo(); toast('🏖️ KNUCKLE BEACH! Sunset vibes. Watch out for crabs 🦀', 6); setTimeout(() => sfxGull(3), 600); return; }
    if (here && ring(bPortalHome)) { arrive(V().copy(BEACH_PORTAL_G).add(V(BEACH_PORTAL_G.x, 0, BEACH_PORTAL_G.z).normalize().multiplyScalar(-1.6)), Math.atan2(BEACH_PORTAL_G.x, BEACH_PORTAL_G.z), 'grove'); toast('🌳 Back in the grove! (sand in your fur forever)', 3); return; }
  }
  if (!here) return;
  const t = tAll; SEA_U.t.value = t; FOAM_U.t.value = t;
  headWorld(_bz1); const hx = _bz1.x - BEACH.x, hz = _bz1.z - BEACH.z, feet = _bz1.y - BEACH.y - state.bodyH;
  if (state.mode === 'play') {
    // stay in the cove
    const cx = clamp(hx, -51, 51), cz = clamp(hz, -12, 40); if (cx !== hx || cz !== hz) { rig.position.x += cx - hx; rig.position.z += cz - hz; }
    // wading slows you down; splash when you land in the water
    if (feet < -.05 && bh(hx, hz) < -.02) {
      const k = Math.exp(-dt * 1.8); state.vel.x *= k; state.vel.z *= k;
      if (!BC.wet && state.vel.y < -2.5) { if (ac) noiseHit(ac.currentTime, .3, .45, 'lowpass', 1000, .7); confetti(_bz2.set(_bz1.x, BEACH.y + .05, _bz1.z), 18, [0xffffff, 0xaeeeff, 0x7fd8ff]); }
      BC.wet = true;
    } else BC.wet = false;
  }
  // waves you can hear, in time with the foam
  beachAmb(true);
  if (BC.amb) { const sw = .5 + .5 * Math.sin(t * .8 + hx * .045), near = clamp(1 - Math.abs(hz) / 40, .25, 1); BC.amb.g.gain.setTargetAtTime((.04 + .16 * sw * sw) * near, ac.currentTime, .15); BC.amb.f.frequency.setTargetAtTime(380 + 900 * sw, ac.currentTime, .2); }
  if ((BC.cawT -= dt) < 0) { BC.cawT = 5 + Math.random() * 9; sfxGull(1 + (Math.random() * 3 | 0)); }
  // tiki flames + pier lamp (no real lights: cheap on Quest)
  BC.lamp.scale.setScalar(1 + Math.sin(t * 3) * .06);
  // the beach ball floats in the sea and drifts back to shore; on dry sand it slows down (sand is grabby)
  const BBp = BEACH_BALL;
  if (!BBp.held && mine(BBp)) {
    const P = BBp.g.position, lx = P.x - BEACH.x, lz = P.z - BEACH.z, ly = P.y - BEACH.y;
    if (Math.abs(lx) < 60 && lz > -60 && lz < 46) {
      if (ly < .08 && bh(lx, lz) < .02) { BBp.rest = false; BBp.vel.y += (G * 1.25 + (.08 - ly) * 30) * dt; const k = Math.exp(-dt * 2.2); BBp.vel.x *= k; BBp.vel.y *= k; BBp.vel.z *= k; BBp.vel.z += .5 * dt; BBp.vel.x += Math.sin(t * .8 + lx * .045) * .15 * dt; }
      else if (BBp.info.ground && !BBp.rest) { const k = Math.exp(-dt * 2.4); BBp.vel.x *= k; BBp.vel.z *= k; BBp.w.multiplyScalar(k); if (Math.hypot(BBp.vel.x, BBp.vel.z) < .08) { BBp.rest = true; BBp.vel.set(0, 0, 0); BBp.w.set(0, 0, 0); } }
    }
  }
  stepCrabs(dt, t, hx, hz);
  stepGulls(dt, t, hx, hz);
  stepCastle(dt, t, hx, hz);
  // the bottle bobs; touch it (or wade up to it)
  if (BC.bottle.visible) {
    BC.bottle.position.y = Math.sin(t * 1.4) * .06 + .02; BC.bottle.rotation.x = Math.sin(t * 1.1) * .25;
    BC.bottle.getWorldPosition(_bz2);
    if (_bz1.distanceTo(_bz2) < 1.9 || hands.some(h => h.tracked && h.pos.distanceTo(_bz2) < .3)) {
      if (bSecret('bottle', '🍾 SECRET! A message in a bottle: "Elder Thump was here. The crabs know things." 🦀')) BC.bottleGo = 1;
    }
    if (BC.bottleGo > 0) { BC.bottleGo += dt; BC.bottle.position.y += BC.bottleGo * 1.5; BC.bottle.rotation.y += dt * 12; if (BC.bottleGo > 1.6) BC.bottle.visible = false; }
  }
  bbSync();
  if (!TIKI.flames) {   // made once on the first visit
    TIKI.flames = TIKI.map(p => { const f = new THREE.Mesh(new THREE.ConeGeometry(.07, .26, 8), new THREE.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: .9 })); f.position.copy(p); BG.add(f);
      const c = new THREE.Mesh(new THREE.ConeGeometry(.04, .16, 6), new THREE.MeshBasicMaterial({ color: 0xfff0a0 })); c.position.y = -.03; f.add(c); return f; });
  }
  TIKI.flames.forEach((f, k) => { const s = 1 + Math.sin(t * 13 + k * 2) * .12 + Math.sin(t * 7.3 + k) * .08; f.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); f.rotation.z = Math.sin(t * 5 + k) * .1; });
}

function angTo(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function stepCrabs(dt, t, hx, hz) {
  for (const C of BC.crabs) {
    const dx = C.x - hx, dz = C.z - hz, dp = Math.hypot(dx, dz);
    let sp = 0, ux = 0, uz = 0;
    if (dp < 2.4 && state.mode === 'play') C.fear = 2.2;
    // boop: a paw touches the crab -> it hops, snaps and squeaks
    if (C.boop > 0) C.boop -= dt;
    for (const h of hands) if (h.tracked && C.boop <= 0) { _bz2.set(C.x + BEACH.x, BEACH.y + bh(C.x, C.z) + .08, C.z + BEACH.z); if (h.pos.distanceTo(_bz2) < .22) { C.boop = 1.2; C.hv = 1.6; C.snap = .6; C.fear = 2.5; sfxPinch(); buzz(h, .9, 60); if (!BC.pinched) { BC.pinched = true; toast('🦀 PINCH! (it was more scared than you)', 3); } } }
    if (C.fear > 0) { C.fear -= dt; sp = 1.8; ux = dx / (dp || 1); uz = dz / (dp || 1); }
    else if (C.wait > 0) { C.wait -= dt; if (Math.random() < dt * .4) C.snap = .5; }
    else { const tx = C.tx - C.x, tz = C.tz - C.z, d = Math.hypot(tx, tz); if (d < .2) { C.wait = 1 + Math.random() * 4; const p = bpick(32); C.tx = p.x; C.tz = p.z * .75 - 1; } else { sp = .45; ux = tx / d; uz = tz / d; } }
    if (sp > 0) {
      let want = Math.atan2(-uz, ux), d = angTo(C.yaw, want); if (Math.abs(d) > Math.PI / 2) d = angTo(C.yaw, want + Math.PI);   // crabs go sideways, either side
      C.yaw += d * Math.min(1, dt * 6);
      C.x = clamp(C.x + ux * sp * dt, -40, 40); C.z = clamp(C.z + uz * sp * dt, -1.6, 14);
      C.ph += dt * sp * 24;
    }
    C.mv += ((sp > 0 ? 1 : 0) - C.mv) * Math.min(1, dt * 8);
    C.raise += ((C.fear > 0 ? 1 : 0) - C.raise) * Math.min(1, dt * 6);
    if (C.snap > 0) C.snap -= dt;
    if (C.hv !== 0 || C.hop > 0) { C.hv -= G * dt; C.hop = Math.max(0, C.hop + C.hv * dt); if (C.hop === 0) C.hv = 0; }
    C.g.position.set(C.x, bh(C.x, C.z), C.z); C.g.rotation.y = C.yaw;
    poseCrab(C, dt, t);
  }
  // King Pinchy on the lifeguard roof waves his golden claws
  const K = BC.gold; K.ph = t * 2; K.mv = 0; K.raise = .6 + Math.sin(t * 2.2) * .4; K.snap = (t % 3 < .6) ? .3 : 0; K.hop = BC.found.has('king') ? Math.abs(Math.sin(t * 6)) * .06 : 0;
  poseCrab(K, dt, t);
  K.g.getWorldPosition(_bz2); _bz2.add(BEACH);
  if ((_bz1.distanceTo(_bz2) < 1.1 && _bz1.y > _bz2.y) || hands.some(h => h.tracked && h.pos.distanceTo(_bz2) < .35)) bSecret('king', '👑🦀 SECRET! You found KING PINCHY on the lifeguard roof! He approves of your climbing.');
}
function stepGulls(dt, t, hx, hz) {
  for (const B of BC.gulls) {
    const o = B.o; B.timer -= dt;
    const dpl = Math.hypot(B.p.x - hx, B.p.z - hz);
    if (B.mode === 'ground') {
      if (dpl < 3.6 && state.mode === 'play') {   // too close! flap away
        B.mode = 'air'; B.timer = 18 + Math.random() * 20; B.v.set((B.p.x - hx) / (dpl || 1) * 2.5, 3.8, (B.p.z - hz) / (dpl || 1) * 2.5); B.cx = B.p.x * .5; B.cz = Math.min(B.p.z, 4) - 3; B.ang = Math.atan2(B.p.z - B.cz, B.p.x - B.cx); sfxGull(2);
      } else {
        // walk to a spot, peck, look around
        if (B.walkT <= 0 && B.peck <= 0) { if (Math.random() < .5) B.peck = .8 + Math.random(); else { const p = bpick(26); B.tgt.set(clamp(B.p.x + (p.x - B.p.x) * .2, -30, 30), 0, p.z); B.walkT = 4; } }
        let walking = false;
        if (B.walkT > 0) { B.walkT -= dt; const tx = B.tgt.x - B.p.x, tz = B.tgt.z - B.p.z, d = Math.hypot(tx, tz); if (d < .1) B.walkT = 0; else { walking = true; B.p.x += tx / d * .45 * dt; B.p.z += tz / d * .45 * dt; B.yaw += angTo(B.yaw, Math.atan2(tx, tz)) * Math.min(1, dt * 5); } }
        if (B.peck > 0) B.peck -= dt;
        B.p.y = bh(B.p.x, B.p.z); B.ph += dt * (walking ? 11 : 0);
        o.legs.forEach((l, k) => { l.rotation.x = walking ? Math.sin(B.ph + k * Math.PI) * .5 : 0; });
        o.neck.position.z = .15 + (walking ? Math.sin(B.ph * 2) * .025 : 0);
        o.head.rotation.x = B.peck > 0 ? (Math.sin(B.peck * 9) > 0 ? 1 : .3) : Math.sin(t * .7 + B.cx) * .1;
        o.head.rotation.y = B.peck > 0 ? 0 : Math.sin(t * .9 + B.cz) * .5;
        o.body.rotation.set(B.peck > 0 ? .35 : 0, 0, walking ? Math.sin(B.ph) * .06 : 0);
        o.body.position.y = .21;
        B.fold += (1 - B.fold) * Math.min(1, dt * 6); B.flap = 0;
      }
    } else {
      if (B.mode === 'air' && B.lander && B.timer < 0) { B.mode = 'land'; const p = bpick(24); B.tgt.set(p.x, bh(p.x, p.z), p.z); }
      let dx, dy, dz, spd = 5.2;
      if (B.mode === 'air') { B.ang += B.w * dt; const a = B.ang + Math.sign(B.w) * .45; dx = B.cx + Math.cos(a) * B.r - B.p.x; dz = B.cz + Math.sin(a) * B.r - B.p.z; dy = B.h + Math.sin(B.ang * 2) * 1.2 - B.p.y; }
      else { dx = B.tgt.x - B.p.x; dy = B.tgt.y - B.p.y; dz = B.tgt.z - B.p.z; const d = Math.hypot(dx, dy, dz); spd = clamp(d * .9, 1, 5.2);
        if (d < .2) { B.mode = 'ground'; B.p.copy(B.tgt); B.v.set(0, 0, 0); B.walkT = 0; B.peck = 1; B.timer = 0; continue; } }
      const L = Math.hypot(dx, dy, dz) || 1;
      _bz3.set(dx / L * spd, dy / L * spd, dz / L * spd);
      const turn = Math.min(1, dt * (B.mode === 'land' ? 2.5 : 1.4));
      const oldYaw = Math.atan2(B.v.x, B.v.z);
      B.v.lerp(_bz3, turn); B.p.addScaledVector(B.v, dt);
      const ny = Math.atan2(B.v.x, B.v.z); B.yaw = ny;
      const bank = clamp(angTo(oldYaw, ny) / Math.max(dt, 1e-3) * -.25, -.7, .7);
      B.fold += (0 - B.fold) * Math.min(1, dt * 8);
      // flap when climbing or slow, glide otherwise (with a few lazy flaps)
      const climbing = B.v.y > .4 || (B.mode === 'land' && Math.hypot(dx, dz) < 3);
      const want = climbing ? 1 : (Math.sin(t * .5 + B.cx) > .6 ? .6 : 0); B.flap += (want - B.flap) * Math.min(1, dt * 3);
      B.ph += dt * (6 + B.flap * 8);
      o.body.rotation.set(-clamp(B.v.y * .08, -.4, .4) + (B.mode === 'land' && Math.hypot(dx, dz) < 1.5 ? -.5 : 0), 0, o.body.rotation.z + (bank - o.body.rotation.z) * Math.min(1, dt * 4));
      o.legs.forEach(l => { l.rotation.x = B.mode === 'land' && Math.hypot(dx, dz) < 2 ? -.3 : 1.2; });
      o.head.rotation.set(Math.sin(t * 2 + B.r) * .08, Math.sin(t * .8 + B.r) * .3, 0); o.neck.position.z = .15;
      o.body.position.y = .21;
    }
    // wings: flap (with the outer wing lagging behind) or fold back along the body
    const fl = B.flap * Math.sin(B.ph), fo = B.fold;
    o.wings.forEach(W => {
      W.sh.rotation.set(0, W.s * 1.35 * fo, W.s * ((.12 + fl * .75) * (1 - fo) + .25 * fo));
      W.el.rotation.set(0, W.s * .2 * fo, W.s * ((B.flap * Math.sin(B.ph - .7) * .45 - .05) * (1 - fo) - .2 * fo));
    });
    o.g.position.copy(B.p); o.g.rotation.y = B.yaw;
  }
}
function stepCastle(dt, t, hx, hz) {
  const C = CASTLE; C.flag.rotation.y = Math.sin(t * 4) * .4; C.flag.scale.x = 1 + Math.sin(t * 7) * .1;
  if (C.up) {
    if (C.grow < 1) { C.grow = Math.min(1, C.grow + dt * 1.4); const k = C.grow; C.g.scale.set(1, k * (1 + Math.sin(k * Math.PI) * .15), 1); }
    _bz2.copy(C.at).add(BEACH);
    let hit = false;
    for (const h of hands) if (h.tracked && h.vel && h.pos.distanceTo(_bz2) < .65 && h.vel.length() > 1) hit = true;
    if (state.mode === 'play' && !state.xr && Math.hypot(hx - C.at.x, hz - C.at.z) < 1.1 && (Math.hypot(state.vel.x, state.vel.z) > 1.5 || pcPunchOff(1) > .2 || pcPunchOff(0) > .2)) hit = true;
    if (hit && C.grow >= 1) {
      C.up = false; C.g.visible = false; C.downT = 6; BC.smash++;
      C.chunks = []; for (let i = 0; i < 30; i++) { const a = Math.random() * 6.283, s = 1 + Math.random() * 2.5; C.chunks.push({ p: V(C.at.x + Math.cos(a) * .2, C.at.y + Math.random() * .4, C.at.z + Math.sin(a) * .2), v: V(Math.cos(a) * s, 2 + Math.random() * 3, Math.sin(a) * s), r: V(Math.random() * 6, Math.random() * 6, 0), s: .6 + Math.random() * .8 }); }
      if (ac) { noiseHit(ac.currentTime, .35, .5, 'lowpass', 700, .6); tone('sine', 160, 60, .3, .3); }
      hands.forEach(h => buzz(h, .8, 70)); confetti(_bz2, 20, [0xe6c287, 0xcfa86e, 0xffffff]);
      toast(BC.smash === 1 ? '🏰💥 SMASH! (it\'ll build itself back)' : `🏰💥 SMASH x${BC.smash}!`, 2.5);
      if (BC.smash >= 5) bSecret('smash', '🏰👑 SECRET! SAND SMASHER x5! The crabs crown you Beach Boss!');
    }
  } else if ((C.downT -= dt) <= 0) { C.up = true; C.g.visible = true; C.grow = 0; C.g.scale.set(1, .01, 1); if (ac) [523, 659, 784].forEach((f, i) => tone('triangle', f, f, .15, .08, i * .07)); }
  // flying sand chunks
  if (C.chunks && C.chunks.length) {
    const M = C.chunkM, m4 = _bcm4 || (_bcm4 = new THREE.Matrix4()), q = _bcq || (_bcq = new THREE.Quaternion()), e = new THREE.Euler();
    let alive = 0;
    C.chunks.forEach((c, i) => {
      const gy = bh(c.p.x, c.p.z) + .04;
      if (c.p.y > gy || c.v.y > 0) { c.v.y -= G * dt; c.p.addScaledVector(c.v, dt); c.r.x += dt * 8; if (c.p.y < gy) { c.p.y = gy; c.v.set(0, 0, 0); } }
      const s = C.up ? Math.max(0, 1 - C.grow * 1.5) * c.s : c.s; if (s > 0) alive++;
      m4.compose(c.p, q.setFromEuler(e.set(c.r.x, c.r.y, 0)), _bz3.set(s, s, s)); M.setMatrixAt(i, m4);
    });
    M.count = C.chunks.length; M.instanceMatrix.needsUpdate = true;
    if (!alive) { C.chunks = []; M.count = 0; }
  }
}
let _bcm4 = null, _bcq = null;
window.__kg.beach = { BC, BEACH, beachH, go: beachGo, CASTLE, BEACH_BALL };
