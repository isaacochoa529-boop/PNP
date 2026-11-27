/* ======================================================================
   THE WATER LAB (in the Slicing Yard, next to the Glass Lab)
   - The pool is full of SLIME-WATER: hundreds of little blobs, each one its own drop. They squish apart,
     stick together and drag each other along, and the skin drawn around them melts close blobs together,
     so it moves like goo. Swipe through it and blobs fly; they plop back in or splat on the floor as puddles.
     Cubes float, glass sinks, you get floaty and slow when you jump in.
   - The CUP button spawns a glass cup: dunk it to scoop up blobs, tip it to your mouth to drink,
     tip it anywhere else to pour them out. Slime on the floor makes a slippery puddle.
   - The WHETSTONE: rub a glass shard on it long enough and it turns into a GLASS SWORD.
   Net: t:'wat' with e = cs (cup state), cdel, pud (puddle), gsw (glass sword). The slime itself is local.
   ====================================================================== */
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
const POOL = { c: V(5.2, 0, 8.3), W: 2.4, rim: .42, floor: .14, level: .25, mesh: null, wasIn: false, told: false };
const WATER = { cups: [], puds: [], drops: [], cupN: 0, sharpT: 0, glassy: false, swordM: null, told: {}, sendT: 0 };
const GOO = { MAX: 400, n: 0, R: .055, H: .13, CS: .21, p: new Float32Array(400 * 3), o: new Float32Array(400 * 3), v: new Float32Array(400 * 3),
  head: new Int32Array(4096), next: new Int32Array(400), pairs: new Int32Array(400 * 48), np: 0, cols: [], refT: 0, moving: 1, hm: new Float32Array(144), mc: null, out: [], dirty: true };
const MC_RES = 36, MC_HX = 1.42, MC_Y0 = .08, MC_HY = .62;   // the blob skin lives in a box over the pool (pool-local)
const WHET = V(6.85, 0, 6.15);                  // the whetstone (arena-local)
const CUP_BTN = V(3.55, 0, 7.55);               // the cup button pedestal (arena-local)
const WU = { uTime: { value: 0 }, uLevel: { value: .3 }, uBox: { value: new THREE.Vector3(POOL.c.x + ARENA.x, POOL.c.z + ARENA.z, POOL.W / 2 + .002) } };
// what water reflects: the open sky (blue overhead, pale at the horizon) and a bright sun, not a grey room
const SKY_ENV = (() => {
  const sc = new THREE.Scene(), m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: 'varying vec3 d; void main(){ d = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 d; void main(){ vec3 n = normalize(d); float h = n.y;
      vec3 c = h > 0.0 ? mix(vec3(.78, .9, 1.0), vec3(.22, .52, .95), pow(h, .55)) : mix(vec3(.62, .66, .7), vec3(.35, .38, .4), min(1.0, -h * 3.0));
      float s = max(0.0, dot(n, normalize(vec3(.45, .75, .35)))); c += vec3(1.0, .95, .85) * (pow(s, 900.0) * 30.0 + pow(s, 40.0) * .35);
      gl_FragColor = vec4(c, 1.0); }` });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), m));
  return pmrem.fromScene(sc, 0).texture;
})();   // shared by every water material + the caustics
// real-looking water: nearly clear, a teal tint that gets stronger at grazing angles (fresnel), tiny moving
// ripples bent into the normals (so the sky and sun glint off it), and soft foam where it meets the pool wall
function makeWaterMat({ color = 0x9fdcec, alpha = .2, amp = 1, half = 0, freq = 1, fres = .75, soft = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: .03, metalness: 0, envMap: SKY_ENV, envMapIntensity: 1.6, transparent: true, depthWrite: false });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = WU.uTime; sh.uniforms.uAmp = { value: amp }; sh.uniforms.uAlpha = { value: alpha }; sh.uniforms.uHalf = { value: half }; sh.uniforms.uFreq = { value: freq }; sh.uniforms.uFres = { value: fres }; sh.uniforms.uSoft = { value: soft };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position; vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; varying vec3 vLP; uniform float uTime, uAmp, uAlpha, uHalf, uFreq, uFres, uSoft;
vec2 wv(vec2 p, vec2 d, float k, float w, float a) { return d * cos(dot(d, p) * k + uTime * w) * a * k; }
vec2 wgrad(vec2 p) {
  p *= uFreq; vec2 g = vec2(0.);
  g += wv(p, vec2(.96, .28), 7.0, 1.9, .010); g += wv(p, vec2(-.37, .93), 9.0, 2.3, .008);
  g += wv(p, vec2(.6, -.8), 15.0, 3.1, .004); g += wv(p, vec2(-.99, -.12), 21.0, 3.9, .0028);
  g += wv(p, vec2(.2, .98), 33.0, 5.2, .0016); g += wv(p, vec2(.85, .53), 47.0, 6.1, .0011);
  return g;
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec2 g = wgrad(vWP.xz) * uAmp; normal = normalize(normal + (viewMatrix * vec4(-g.x, 0.0, -g.y, 0.0)).xyz); }`)
      .replace('#include <opaque_fragment>', `float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
float foam = 0.0;
if (uHalf > 0.0) { float e = uHalf - max(abs(vLP.x), abs(vLP.z)); float n = .55 + .45 * sin(vWP.x * 41.0 + uTime * 1.7) * sin(vWP.z * 37.0 - uTime * 1.3);
  foam = smoothstep(.09, .0, e) * n + smoothstep(.025, .0, e) * .6; }
outgoingLight = mix(outgoingLight, vec3(.95, .98, 1.0), clamp(foam, 0.0, 1.0) * .85);
diffuseColor.a = clamp(uAlpha + fr * uFres + foam * .7, 0.0, .97);
if (uSoft > 0.0) { float a = atan(vLP.z, vLP.x); float rr = length(vLP.xz) * (1.0 + .12 * sin(a * 3.0 + vWP.x * 7.0) + .08 * sin(a * 7.0 - vWP.z * 5.0)); diffuseColor.a *= smoothstep(1.0, .55, rr); }
#include <opaque_fragment>`);
  };
  return m;
}
// caustics: the wobbly bright net of light you see on the bottom of a sunny pool (only below the water line)
function addCaustics(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = WU.uTime; sh.uniforms.uLevel = WU.uLevel; sh.uniforms.uBox = WU.uBox;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW; varying float vCF;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCW = (modelMatrix * vec4(position, 1.0)).xyz; vCF = abs(normal.y);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCW; varying float vCF; uniform float uTime, uLevel; uniform vec3 uBox;
float caus(vec2 p) { vec2 q = p * 4.2; float v = 0.0; float t = uTime * .55;
  for (int i = 0; i < 3; i++) { q += vec2(sin(q.y * 1.37 + t), cos(q.x * 1.21 - t * 1.13)) * .7; v += 1.0 / (1.0 + 18.0 * abs(sin(q.x) * sin(q.y))); t *= 1.31; }
  return v / 3.0; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (vCW.y < uLevel && abs(vCW.x - uBox.x) <= uBox.z && abs(vCW.z - uBox.y) <= uBox.z) { float c = caus(vCF > .5 ? vCW.xz : vec2(vCW.x + vCW.z, vCW.y * 1.6)); c = c * c * 1.6; totalEmissiveRadiance += vec3(.75, .95, 1.0) * c * .55 * smoothstep(0.0, .03, uLevel - vCW.y); diffuseColor.rgb *= vec3(.82, .95, .98); }`);
  };
  return m;
}
const gooM = makeWaterMat({ color: 0x45b6ea, alpha: .72, amp: .18, freq: 2.2, fres: .3 }); gooM.depthWrite = true; gooM.roughness = .05;   // slime-water: thicker and glossier than plain water
const cupWaterM = makeWaterMat({ alpha: .3, amp: .25, freq: 2.5, color: 0xc8eef7 });
const puddleM = makeWaterMat({ alpha: .12, amp: .35, freq: 1.5, color: 0xb8d8e0, fres: .45, soft: 1 }); puddleM.polygonOffset = true; puddleM.polygonOffsetFactor = -3;
const dropM = new THREE.MeshStandardMaterial({ color: 0x7fd0f0, roughness: .04, envMap: SKY_ENV, envMapIntensity: 1.8, transparent: true, opacity: .8 });   // loose slime blobs
const cupM = new THREE.MeshStandardMaterial({ color: 0xeef8ff, roughness: .04, metalness: .1, envMap: ENV, envMapIntensity: 1.8, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false });
const _w1 = V(), _w2 = V(), _w3 = V(), _wq = new THREE.Quaternion(), _wq2 = new THREE.Quaternion(), _UP = V(0, 1, 0);
const _wpc = V(), poolW = () => _wpc.copy(POOL.c).add(ARENA);   // pool centre in the world
/* ---------- the pool: a tiled basin with a rim you can climb over ---------- */
{
  const g = new THREE.Group(); g.position.copy(POOL.c); arena.add(g);
  const W = POOL.W, T = .12, R = POOL.rim, tileTex = labelTex(256, 256, (q, w, h) => { q.fillStyle = '#bfe9f5'; q.fillRect(0, 0, w, h); q.strokeStyle = '#8fcfe2'; q.lineWidth = 6; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.stroke(); q.beginPath(); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); } });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(4, 4);
  const tileM = addCaustics(new THREE.MeshStandardMaterial({ map: tileTex, roughness: .35 })), rimM = addCaustics(new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: .5 }));
  part(new THREE.BoxGeometry(W, POOL.floor, W), tileM, 0, POOL.floor / 2, 0, g);   // a raised tiled floor, so the slime sits nice and deep
  addCol({ t: 0, x: ARENA.x + POOL.c.x, y: POOL.floor / 2, z: ARENA.z + POOL.c.z, hx: W / 2, hy: POOL.floor / 2, hz: W / 2, yaw: 0, tag: 'rock' });
  [[0, W / 2 + T / 2, W + 2 * T, T], [0, -W / 2 - T / 2, W + 2 * T, T], [W / 2 + T / 2, 0, T, W], [-W / 2 - T / 2, 0, T, W]].forEach(([x, z, sx, sz]) => {
    part(new THREE.BoxGeometry(sx, R, sz), rimM, x, R / 2, z, g);
    addCol({ t: 0, x: ARENA.x + POOL.c.x + x, y: R / 2, z: ARENA.z + POOL.c.z + z, hx: sx / 2, hy: R / 2, hz: sz / 2, yaw: 0, tag: 'rock' });
  });
  // a sign so people know what it is
  const sgT = labelTex(512, 128, (q, w, h) => signText(q, w, h, [['💧 WATER LAB 💧', 64, '#7fd8ff', 80]], 'rgba(14,20,30,.92)', '#3fb2ff'));
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .275), new THREE.MeshBasicMaterial({ map: sgT, transparent: true })); sg.position.set(0, R + .32, -W / 2 - T); g.add(sg);
  part(new THREE.CylinderGeometry(.02, .02, .3, 8), smat(0xe9eef2, { roughness: .5 }), 0, R + .15, -W / 2 - T - .01, g);
  // the slime-water: one blobby skin around all the little blobs (filled in by stepGoo)
  GOO.mc = new MarchingCubes(MC_RES, gooM, false, false, 26000); GOO.mc.position.set(0, MC_Y0 + MC_HY, 0); GOO.mc.scale.set(MC_HX, MC_HY, MC_HX);
  GOO.mc.isolation = .5; GOO.mc.frustumCulled = false; GOO.mc.renderOrder = 2; g.add(GOO.mc); POOL.mesh = GOO.mc;
  POOL.g = g;
}
/* ---------- the cup button and the whetstone ---------- */
{
  const g = new THREE.Group(); g.position.copy(CUP_BTN); arena.add(g);
  const st = smat(0x8c96a4, { metalness: .5, roughness: .4 }), dark = smat(0x2b3446, { roughness: .5 });
  part(new THREE.CylinderGeometry(.11, .14, .33, 20), dark, 0, .165, 0, g);
  const ring = part(new THREE.TorusGeometry(.08, .009, 8, 36), st, 0, .36, 0, g); ring.rotation.x = Math.PI / 2;
  const cap = new THREE.Group(); cap.position.set(0, .36, 0); g.add(cap);
  const cm = new THREE.MeshStandardMaterial({ color: 0x3fb2ff, emissive: 0x3fb2ff, emissiveIntensity: .35, roughness: .25 });
  part(new THREE.CylinderGeometry(.066, .068, .028, 28), cm, 0, .014, 0, cap);
  const dome = part(new THREE.SphereGeometry(.066, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), cm, 0, .028, 0, cap); dome.scale.y = .38;
  const lt = labelTex(256, 96, (q, w, h) => signText(q, w, h, [['🥛 CUP', 52, '#7fd8ff', 52]], 'rgba(14,20,30,.95)', '#3fb2ff'));
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(.2, .075), new THREE.MeshBasicMaterial({ map: lt, transparent: true })); lb.position.set(0, .2, .142); g.add(lb);
  const b = { i: AR.btnT.length, cap, cm, top: V(), down: 0, g, act: () => spawnCup(true) }; AR.btnT.push(0); buttons.push(b);
  g.updateMatrixWorld(true); cap.getWorldPosition(b.top); b.top.y += .04;
  addCol({ t: 1, x: ARENA.x + CUP_BTN.x, z: ARENA.z + CUP_BTN.z, cy: .165, hy: .165, r: .14, tag: 'rock' });
  // the whetstone: a rough grey block on a little wooden bench
  const w = new THREE.Group(); w.position.copy(WHET); arena.add(w);
  const wood = smat(0x8a5a32, { roughness: .9 }), rough = new THREE.MeshStandardMaterial({ color: 0x8e8a84, roughness: 1, flatShading: true });
  part(new THREE.BoxGeometry(.5, .5, .3), wood, 0, .25, 0, w);
  const stone = part(new THREE.BoxGeometry(.4, .07, .14, 6, 1, 3), rough, 0, .535, 0, w);
  const pa = stone.geometry.attributes.position; for (let i = 0; i < pa.count; i++) if (pa.getY(i) > 0) pa.setY(i, pa.getY(i) + (rnd() - .5) * .008); stone.geometry.computeVertexNormals();
  const wt = labelTex(512, 96, (q, ww, h) => signText(q, ww, h, [['🗡️ SHARPEN GLASS', 48, '#ffd25a', 52]], 'rgba(14,20,30,.95)', '#ffd25a'));
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(.42, .08), new THREE.MeshBasicMaterial({ map: wt, transparent: true })); wl.position.set(0, .3, .152); w.add(wl);
  addCol({ t: 0, x: ARENA.x + WHET.x, y: .285, z: ARENA.z + WHET.z, hx: .25, hy: .285, hz: .15, yaw: 0, tag: 'rock' });
}
function poolRapier(fixed) {   // the pool rim, the button and the whetstone are solid for cubes too
  const R = AR.R, W = POOL.W, T = .12, h = POOL.rim / 2;
  [[0, W / 2 + T / 2, W / 2 + T, T / 2], [0, -W / 2 - T / 2, W / 2 + T, T / 2], [W / 2 + T / 2, 0, T / 2, W / 2], [-W / 2 - T / 2, 0, T / 2, W / 2]].forEach(([x, z, hx, hz]) => fixed(R.ColliderDesc.cuboid(hx, h, hz), POOL.c.x + x, h, POOL.c.z + z));
  fixed(R.ColliderDesc.cuboid(W / 2, POOL.floor / 2, W / 2), POOL.c.x, POOL.floor / 2, POOL.c.z);
  fixed(R.ColliderDesc.cylinder(.165, .14), CUP_BTN.x, .165, CUP_BTN.z);
  fixed(R.ColliderDesc.cuboid(.25, .285, .15), WHET.x, .285, WHET.z);
}
/* ---------- the slime-water: hundreds of little blobs that squish, stick and merge ----------
   Every bit of water is its own little ball. Balls push apart when squeezed, pull together when close (sticky),
   and drag their neighbours along (gooey). The surface is drawn as ONE smooth blobby skin around all of them
   (marching cubes), so close blobs melt together and loose ones stay little round drops. */
const gooKey = (x, y, z) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & 4095;
function gooAdd(x, y, z, vx = 0, vy = 0, vz = 0) {
  if (GOO.n >= GOO.MAX) return false; const i = GOO.n++ * 3, p = GOO.p, o = GOO.o, v = GOO.v;
  p[i] = o[i] = x; p[i + 1] = o[i + 1] = y; p[i + 2] = o[i + 2] = z; v[i] = vx; v[i + 1] = vy; v[i + 2] = vz; GOO.dirty = true; return true;
}
function gooKill(k) {   // swap the last blob into this slot
  const n = --GOO.n, a = k * 3, b = n * 3, p = GOO.p, o = GOO.o, v = GOO.v;
  for (let c = 0; c < 3; c++) { p[a + c] = p[b + c]; o[a + c] = o[b + c]; v[a + c] = v[b + c]; } GOO.dirty = true;
}
const toPool = (w, out) => out.set(w.x - ARENA.x - POOL.c.x, w.y - ARENA.y, w.z - ARENA.z - POOL.c.z);
function gooPairs() {   // who's next to who (a hash grid, so it's cheap)
  const { p, head, next, CS } = GOO, n = GOO.n, P = GOO.pairs, lim = P.length - 2, C2 = CS * CS; head.fill(-1); let np = 0;
  for (let i = 0; i < n; i++) { const k = gooKey(Math.floor(p[i * 3] / CS), Math.floor(p[i * 3 + 1] / CS), Math.floor(p[i * 3 + 2] / CS)); next[i] = head[k]; head[k] = i; }
  for (let i = 0; i < n; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2], cx = Math.floor(x / CS), cy = Math.floor(y / CS), cz = Math.floor(z / CS);
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      let j = head[gooKey(cx + dx, cy + dy, cz + dz)];
      while (j >= 0) { if (j > i) { const ex = p[j * 3] - x, ey = p[j * 3 + 1] - y, ez = p[j * 3 + 2] - z; if (ex * ex + ey * ey + ez * ez < C2 && np < lim) { P[np++] = i; P[np++] = j; } } j = next[j]; }
    }
  }
  GOO.np = np;
}
function gooCols() {   // paws, you, cubes, cups and the sword shove the blobs (and slime sticks to paws a little)
  const p = GOO.p, v = GOO.v, n = GOO.n, R = GOO.R;
  for (const c of GOO.cols) {
    const rr = c.r + R, rr2 = rr * rr, st = c.r + R + .045, st2 = st * st;
    for (let i = 0; i < n; i++) {
      const k = i * 3, dx = p[k] - c.x, dy = p[k + 1] - c.y, dz = p[k + 2] - c.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= st2) continue;
      if (d2 < rr2) {   // inside the thing: pop out to its skin and get carried along with it
        const d = Math.sqrt(d2) || 1e-4, nx = dx / d, ny = dy / d, nz = dz / d, f = rr - d; p[k] += nx * f; p[k + 1] += ny * f; p[k + 2] += nz * f;
        const vn = (v[k] - c.vx) * nx + (v[k + 1] - c.vy) * ny + (v[k + 2] - c.vz) * nz; if (vn < 0) { v[k] -= nx * vn * 1.15; v[k + 1] -= ny * vn * 1.15; v[k + 2] -= nz * vn * 1.15; }
      }
      if (c.stick) { v[k] += (c.vx - v[k]) * .12; v[k + 1] += (c.vy - v[k + 1]) * .12; v[k + 2] += (c.vz - v[k + 2]) * .12; }
    }
  }
}
function gooBounds() {   // the tiles, the walls and the rim
  const p = GOO.p, o = GOO.o, v = GOO.v, R = GOO.R, in1 = POOL.W / 2 - R, rimTop = POOL.rim + R, outer = POOL.W / 2 + .12 + R, fl = POOL.floor + R;
  for (let i = 0; i < GOO.n; i++) {
    const k = i * 3;
    if (p[k + 1] < fl) { p[k + 1] = fl; if (v[k + 1] < 0) v[k + 1] *= -.1; v[k] *= .94; v[k + 2] *= .94; }   // sticky on the tiles
    if ((Math.abs(p[k]) > in1 || Math.abs(p[k + 2]) > in1) && p[k + 1] < rimTop) {
      if (Math.abs(o[k]) <= in1 + .01 && Math.abs(o[k + 2]) <= in1 + .01) {   // bumps the wall from inside
        if (Math.abs(p[k]) > in1) { p[k] = Math.sign(p[k]) * in1; v[k] *= -.15; } if (Math.abs(p[k + 2]) > in1) { p[k + 2] = Math.sign(p[k + 2]) * in1; v[k + 2] *= -.15; } }
      else if (Math.abs(p[k]) < outer && Math.abs(p[k + 2]) < outer) { p[k + 1] = rimTop; if (v[k + 1] < 0) v[k + 1] = 0; v[k] *= .9; v[k + 2] *= .9; }   // landed on top of the rim
    }
  }
}
const KREP = 1400, KCOH = 160, CDMP = 14;   // squish-apart push, sticky pull, gooey damping
function gooStep(dt) {
  const n = GOO.n, p = GOO.p, o = GOO.o, v = GOO.v, H = GOO.H, CS = GOO.CS, damp = Math.exp(-dt * .4);
  for (let i = 0; i < n * 3; i += 3) { v[i + 1] -= 9.81 * dt; v[i] *= damp; v[i + 1] *= damp; v[i + 2] *= damp; }
  gooPairs(); const P = GOO.pairs, np = GOO.np;
  for (let q = 0; q < np; q += 2) {
    const a = P[q] * 3, b = P[q + 1] * 3, dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d >= CS || d < 1e-5) continue;
    const nx = dx / d, ny = dy / d, nz = dz / d, vr = (v[b] - v[a]) * nx + (v[b + 1] - v[a + 1]) * ny + (v[b + 2] - v[a + 2]) * nz;
    const sp = d < H ? -KREP * (H - d) : KCOH * (d - H) * (1 - (d - H) / (CS - H));   // squished: push apart / close: stick together
    const f = (sp + CDMP * vr) * dt;
    v[a] += nx * f; v[a + 1] += ny * f; v[a + 2] += nz * f; v[b] -= nx * f; v[b + 1] -= ny * f; v[b + 2] -= nz * f;
  }
  for (let q = 0; q < np; q += 2) {   // gooey: neighbours drag each other along
    const a = P[q] * 3, b = P[q + 1] * 3;
    for (let c = 0; c < 3; c++) { const dv = (v[b + c] - v[a + c]) * .04; v[a + c] += dv; v[b + c] -= dv; }
  }
  let mv = 0;
  for (let i = 0; i < n * 3; i += 3) {
    const s2 = v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2]; if (s2 > 64) { const s = 8 / Math.sqrt(s2); v[i] *= s; v[i + 1] *= s; v[i + 2] *= s; }
    o[i] = p[i]; o[i + 1] = p[i + 1]; o[i + 2] = p[i + 2]; p[i] += v[i] * dt; p[i + 1] += v[i + 1] * dt; p[i + 2] += v[i + 2] * dt;
  }
  gooCols(); gooBounds();
  let sum = 0; for (let i = 0; i < n * 3; i += 3) { const s2 = v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2]; sum += s2; if (s2 > mv) mv = s2; }
  GOO.moving = mv; GOO.mean = n ? sum / n : 0;
}
function gooFill() {   // a full pool to start with, settled so it isn't jumpy
  GOO.n = 0; const S = 16, sp = (POOL.W - .16) / S;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) gooAdd(-POOL.W / 2 + .08 + (i + .5) * sp, POOL.floor + .065, -POOL.W / 2 + .08 + (j + .5) * sp);
  while (GOO.n < GOO.MAX) gooAdd((Math.random() - .5) * (POOL.W - .3), POOL.floor + .18 + Math.random() * .12, (Math.random() - .5) * (POOL.W - .3));
  GOO.cols.length = 0; for (let i = 0; i < 400; i++) gooStep(1 / 120);
  for (let i = 0; i < GOO.n * 3; i++) GOO.v[i] = 0; GOO.dirty = true;
}
function gooHeights() {   // a rough height map of the slime top, so things float on the actual blobs
  const hm = GOO.hm, p = GOO.p, cs = POOL.W / 12; hm.fill(POOL.floor); let s = 0;
  for (let i = 0; i < GOO.n; i++) { const k = i * 3, y = p[k + 1]; if (y > POOL.rim + .1) continue;
    const cx = Math.floor((p[k] + POOL.W / 2) / cs), cz = Math.floor((p[k + 2] + POOL.W / 2) / cs); if (cx < 0 || cz < 0 || cx > 11 || cz > 11) continue;
    const c = cz * 12 + cx; if (y + GOO.R > hm[c]) hm[c] = y + GOO.R; }
  for (let c = 0; c < 144; c++) s += hm[c];
  POOL.level = s / 144;
}
function levelAt(w) {   // slime height (world y) under a world point
  const cs = POOL.W / 12, cx = clamp(Math.floor((w.x - ARENA.x - POOL.c.x + POOL.W / 2) / cs), 0, 11), cz = clamp(Math.floor((w.z - ARENA.z - POOL.c.z + POOL.W / 2) / cs), 0, 11);
  return ARENA.y + GOO.hm[cz * 12 + cx];
}
function gooMesh() {   // melt all the blobs into one smooth skin
  const mc = GOO.mc, S = mc.size, f = mc.field, p = GOO.p, sx = S / (2 * MC_HX), sy = S / (2 * MC_HY), KR = .118, KR2 = KR * KR, ox = KR * sx, oy = KR * sy;
  f.fill(0); mc.normal_cache.fill(0); GOO.out.length = 0;
  for (let i = 0; i < GOO.n; i++) {
    const k = i * 3, gx = (p[k] + MC_HX) * sx, gy = (p[k + 1] - MC_Y0) * sy, gz = (p[k + 2] + MC_HX) * sx;
    if (Math.abs(p[k]) > POOL.W / 2 + .02 || Math.abs(p[k + 2]) > POOL.W / 2 + .02 || gy > S - 3 - .08 * sy) { GOO.out.push(i); continue; }   // flew out of the box: drawn as a lone blob
    const x0 = Math.max(1, Math.ceil(gx - ox)), x1 = Math.min(S - 2, Math.floor(gx + ox)), y0 = Math.max(1, Math.ceil(gy - oy)), y1 = Math.min(S - 2, Math.floor(gy + oy)), z0 = Math.max(1, Math.ceil(gz - ox)), z1 = Math.min(S - 2, Math.floor(gz + ox));
    for (let z = z0; z <= z1; z++) { const dz = (z - gz) / sx, dz2 = dz * dz;
      for (let y = y0; y <= y1; y++) { const dy = (y - gy) / sy, d2yz = dz2 + dy * dy; if (d2yz >= KR2) continue; const base = S * S * z + S * y;
        for (let x = x0; x <= x1; x++) { const dx = (x - gx) / sx, d2 = d2yz + dx * dx; if (d2 < KR2) { const w = 1 - d2 / KR2; f[base + x] += w * w; } } } }
  }
  mc.update();
  const g = mc.geometry, cnt = Math.max(3, mc.count);
  ['position', 'normal'].forEach(a => { const at = g.getAttribute(a); at.clearUpdateRanges(); at.addUpdateRange(0, cnt * 3); });
}
/* ---------- the pool talks to the slime ---------- */
function inPool(p, pad = 0) { const c = poolW(); return Math.abs(p.x - c.x) < POOL.W / 2 - pad && Math.abs(p.z - c.z) < POOL.W / 2 - pad; }
function poolPoke(p, amt, rad = .12) {   // shove the slime at a world point (amt > 0 pushes it down)
  toPool(p, _w2); const r2 = (rad + GOO.R) ** 2, P = GOO.p, v = GOO.v;
  for (let i = 0; i < GOO.n; i++) { const k = i * 3, dx = P[k] - _w2.x, dy = P[k + 1] - _w2.y, dz = P[k + 2] - _w2.z; if (dx * dx + dy * dy + dz * dz < r2) v[k + 1] -= amt * 25; }
}
function splash(p, k) {   // a splat you can hear (the blobs fly on their own)
  if (ac) { const t = ac.currentTime, v = Math.min(.6, .12 + k * .25); noiseHit(t, .16 + k * .22, v, 'lowpass', 700 + Math.random() * 400, .8); tone('sine', 380 + Math.random() * 160, 110, .22, v * .3); }
}
const _wPrev = new WeakMap(), _wg = V();
function gooCol(key, w, r, stick, dt) {   // add a thing as a slime pusher (its speed comes from where it was last frame)
  const pv = _wPrev.get(key); _wPrev.set(key, w.clone()); if (!inPool(w, -r - .1) || w.y - ARENA.y > 1.4) return;
  toPool(w, _wg); const c = { x: _wg.x, y: _wg.y, z: _wg.z, r, stick, vx: 0, vy: 0, vz: 0 };
  if (pv && dt > 0) { c.vx = (w.x - pv.x) / dt; c.vy = (w.y - pv.y) / dt; c.vz = (w.z - pv.z) / dt; if (c.vx * c.vx + c.vy * c.vy + c.vz * c.vz > 225) c.vx = c.vy = c.vz = 0; }   // teleports aren't swipes
  GOO.cols.push(c);
  if (pv && inPool(w)) { const L = levelAt(w); if (pv.y - r > L && w.y - r <= L && c.vy < -1.4) { splash(w, clamp(-c.vy / 5, .2, 1.2) * Math.min(1.5, r * 6)); } }
}
function stepPoolThings(dt) {
  GOO.cols.length = 0;
  if (HM.on && HM.held) gooCol(HM, HM.head, .09, false, dt);   // slam the sledgehammer into the slime: it splashes and ripples
  // cubes and glass: float or sink by what they're made of
  if (AR.ready) for (const pc of AR.pieces) {
    if (!pc.body || pc.pane || pc.dying) continue;
    const t = pc.body.translation(); _w1.set(t.x, t.y, t.z).add(ARENA); if (!inPool(_w1, -.1)) continue;
    const r = pc.rad || .1; gooCol(pc, _w1, r, false, dt); if (!inPool(_w1)) continue;
    const L = levelAt(_w1), sub = clamp((L - (_w1.y - r)) / (2 * r), 0, 1); if (sub <= 0) continue;
    if (pc.held || !mine(pc) || pc.body.bodyType() !== 0) continue;
    const K = KINDS[pc.kind] || {}, B = K.glass ? .45 : K.rub ? 2.6 : 1.8, m = pc.body.mass();
    pc.body.applyImpulse({ x: 0, y: m * 9.81 * dt * sub * B, z: 0 }, true);
    const lv = pc.body.linvel(), f = Math.exp(-dt * 3.5 * sub), av = pc.body.angvel(), fa = Math.exp(-dt * 2.5 * sub);   // slime is thick: things slow down a lot
    pc.body.setLinvel({ x: lv.x * f, y: lv.y * f, z: lv.z * f }, true); pc.body.setAngvel({ x: av.x * fa, y: av.y * fa, z: av.z * fa }, true);
  }
  // your paws (slime sticks to them a bit)
  hands.forEach(h => { if (h.tracked || !state.xr) gooCol(h, h.pos, PAW_R, true, dt); });
  // you: jump in and you get floaty and slow
  headWorld(_w1); const feet = _w1.y - state.bodyH, L = levelAt(_w1);
  if (inPool(_w1, .05) && feet < L + .25) gooCol(POOL, _w2.set(_w1.x, feet + .2 * BM.sc, _w1.z), .2 * BM.sc, false, dt);
  if (inPool(_w1, .05) && feet < L) {
    const fr = clamp((L - feet) / state.bodyH, 0, 1);
    state.vel.y += 9.81 * 1.15 * fr * dt; const f = Math.exp(-dt * 3.2 * fr); state.vel.multiplyScalar(f);
    if (!POOL.wasIn) { splash(_w1, clamp(-state.vel.y / 4, .4, 1.5)); if (!POOL.told) { POOL.told = true; toast('💦 SPLOOSH! The water is all blobby and slimy.', 3); } }
    POOL.wasIn = true;
  } else POOL.wasIn = false;
  // friends
  for (const [id, f] of MP.others) f.paws.forEach(p => gooCol(p, p.getWorldPosition(_w3), PAW_R, true, dt));
  // cups and the sword
  WATER.cups.forEach(c => gooCol(c, c.g.localToWorld(_w3.set(0, .065, 0)), .06, false, dt));
  if (sword.g.visible) [.25, .5, .72].forEach((u, i) => gooCol(SW_KEYS[i], sword.g.localToWorld(_w3.copy(BLADE_A).lerp(BLADE_B, u)), .045, false, dt));
}
const SW_KEYS = [{}, {}, {}];
function stepGoo(dt) {
  // a calm, full pool that nothing is touching naps (it was the biggest cost in the yard); anything touching it wakes it up
  if (!GOO.cols.length && !GOO.dirty && GOO.n >= GOO.MAX && GOO.mean < .003 && GOO.moving < .08) { if ((GOO.calm = (GOO.calm || 0) + dt) > 1.5) return; } else GOO.calm = 0;
  const st = dt > .02 ? 4 : 2, sdt = Math.min(dt, 1 / 30) / st;
  for (let s = 0; s < st; s++) gooStep(sdt);
  // blobs that flew over the rim and out: they become drops (and puddles where they land)
  const p = GOO.p, v = GOO.v, ow = POOL.W / 2 + .12 + GOO.R;
  for (let i = GOO.n - 1; i >= 0; i--) { const k = i * 3; if (Math.abs(p[k]) > ow || Math.abs(p[k + 2]) > ow || p[k + 1] < -1) {
    WATER.drops.push({ p: V(p[k], p[k + 1], p[k + 2]).add(POOL.c).add(ARENA), v: V(v[k], v[k + 1], v[k + 2]), t: 0, amt: 1 / 9, mine: true, big: true }); gooKill(i); } }
  // the pool slowly refills, plop by plop
  if (GOO.n < GOO.MAX && (GOO.refT -= dt) < 0) { GOO.refT = .35; gooAdd((Math.random() - .5) * (POOL.W - .3), .9, (Math.random() - .5) * (POOL.W - .3), 0, -1, 0); }
  gooHeights();
  if (GOO.moving > .006 || GOO.dirty) { gooMesh(); GOO.dirty = false; }   // nothing moving = keep last frame's skin
}
gooFill();
/* ---------- cups ---------- */
function makeCupMesh() {
  const g = new THREE.Group(), pts = [[0, 0], [.036, 0], [.04, .004], [.046, .13], [.042, .13], [.036, .008], [0, .008]].map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), cupM); m.renderOrder = 3; g.add(m);
  const wg = new THREE.CylinderGeometry(.041, .036, 1, 20); wg.translate(0, .5, 0);
  const w = new THREE.Mesh(wg, cupWaterM); w.position.y = .009; w.renderOrder = 2; g.add(w);
  g.userData.water = w; return g;
}
function spawnCup(send, d) {
  if (!d && WATER.cups.length >= 4) { const o = WATER.cups.shift(); killCup(o, true); }
  const c = { id: d ? d.id : (MP.me || 'me') + '-c' + (WATER.cupN++), g: makeCupMesh(), fill: 0, held: null, v: V(), own: d ? d.from : MP.me, rest: false, tilt: 0, pourT: 0, net: null, sentF: -1 };
  if (d) { c.g.position.set(...d.p); c.g.quaternion.set(...d.q); c.fill = +d.f || 0; }
  else { c.g.position.copy(CUP_BTN).add(ARENA).add(V(0, .5, 0)); c.v.set(.55, 1.6, -.25); confetti(c.g.position.clone(), 12, [0x7fd8ff, 0xffffff]); if (ac) tone('triangle', 600, 1200, .15, .1); }
  scene.add(c.g); WATER.cups.push(c);
  if (send) cupSend(c, true);
  if (!d && !WATER.told.cup) { WATER.told.cup = true; toast(state.xr ? '🥛 A cup! Grab it, dunk it in the pool, then tip it to your mouth to drink (or anywhere to spill).' : '🥛 A cup! E to grab it near the pool. Hold left click to drink, right click to pour.', 6); }
  return c;
}
function killCup(c, send) { scene.remove(c.g); if (c.held) c.held.cup = null; const i = WATER.cups.indexOf(c); if (i >= 0) WATER.cups.splice(i, 1); if (send) netSend({ t: 'wat', e: 'cdel', id: c.id }); }
function cupSend(c, force) {
  if (!online()) return; const p = c.g.position, q = c.g.quaternion;
  netSend({ t: 'wat', e: 'cs', id: c.id, p: [r3(p.x), r3(p.y), r3(p.z)], q: [r3(q.x), r3(q.y), r3(q.z), r3(q.w)], f: r3(c.fill), h: c.held ? 1 : 0 });
}
function cupNear(h) { let best = null, bd = .15 * BM.sc; for (const c of WATER.cups) { c.g.localToWorld(_w1.set(0, .065, 0)); const d = _w1.distanceTo(h.pos); if (d < bd) { bd = d; best = c; } } return best; }
function cupGrab(h) {
  if (state.area !== 'arena' || h.cup) return false; const c = cupNear(h); if (!c) return false;
  holdCup(h, c); return true;
}
function holdCup(h, c) {
  if (c.held && c.held !== h) c.held.cup = null;
  c.held = h; h.cup = c; c.own = MP.me; c.rest = false;
  h.paw.getWorldQuaternion(_wq); c.relQ = _wq.clone().invert().multiply(c.g.quaternion);
  c.g.localToWorld(_w1.set(0, .065, 0)).sub(h.pos).applyQuaternion(_wq.clone().invert()); if (_w1.length() > .05) _w1.setLength(.05); c.relP = _w1.clone();
  if (!state.xr && !sim.on) { c.relQ = null; c.relP = null; }
  buzz(h, .5, 30); if (ac) tone('sine', 1500, 1800, .05, .05); cupSend(c, true);
}
function cupDrop(h, throwV) {
  const c = h.cup; if (!c) return; h.cup = null; c.held = null; c.rest = false;
  c.v.copy(throwV || h.vel || V()).multiplyScalar(throwV ? 1 : 1.2); if (c.v.length() > 12) c.v.setLength(12); cupSend(c, true);
}
function cupDesk(h) {   // desktop: E grabs the cup you look at (or drops/throws the one you hold)
  const holder = hands.find(x => x.cup); if (holder) { camera.getWorldQuaternion(_wq); cupDrop(holder, V(0, 1.2, -4).applyQuaternion(_wq)); return true; }
  if (h.piece || hands[0].piece) return false;
  const c = aimAt(2.4, f => WATER.cups.forEach(c => f(c, c.g.localToWorld(V(0, .065, 0)), .07))); if (c) { holdCup(h, c); return true; }
  return false;
}
const DESK_TIP = { drink: false, pour: false };
canvas.addEventListener('pointerdown', e => { if (state.xr || state.area !== 'arena' || !hands.some(h => h.cup)) return; if (e.button === 0) DESK_TIP.drink = true; if (e.button === 2) DESK_TIP.pour = true; });
addEventListener('pointerup', e => { if (e.button === 0) DESK_TIP.drink = false; if (e.button === 2) DESK_TIP.pour = false; });
function stepCups(dt) {
  const tick = (WATER.sendT -= dt) < 0; if (tick) WATER.sendT = .1;
  for (const c of WATER.cups.slice()) {
    const h = c.held, g = c.g, w = g.userData.water;
    if (h && h.cup === c) {
      if (c.relQ) { h.paw.getWorldQuaternion(_wq); g.quaternion.copy(_wq).multiply(c.relQ); _w1.copy(c.relP).applyQuaternion(_wq).add(h.pos); }
      else {   // desktop: in front of you, tipping toward your mouth (left click) or forward (right click)
        camera.getWorldQuaternion(_wq); const want = DESK_TIP.drink ? 1.9 : DESK_TIP.pour ? -1.9 : 0; c.dt = (c.dt || 0) + (want - (c.dt || 0)) * Math.min(1, dt * 6);
        _w2.set(0, 0, -1).applyQuaternion(_wq); _wq2.setFromAxisAngle(_UP, Math.atan2(-_w2.x, -_w2.z));   // face where you look, stay upright
        g.quaternion.copy(_wq2).multiply(_wq.setFromAxisAngle(_w2.set(1, 0, 0), c.dt));
        headWorld(_w1); _w1.add(V(0, -.12 + Math.max(0, c.dt) * .06, -.32 + Math.max(0, c.dt) * .14).applyQuaternion(_wq2));
      }
      _w2.set(0, .065, 0).applyQuaternion(g.quaternion); g.position.copy(_w1).sub(_w2);
      if (h.vel) c.v.copy(h.vel);
    } else if (!c.net || mine(c)) {
      if (!c.rest) {   // falling, bouncing, floating
        c.v.y -= 9.81 * dt; g.position.addScaledVector(c.v, dt);
        g.localToWorld(_w1.set(0, .065, 0));
        const L = levelAt(_w1);
        if (inPool(_w1, .04) && _w1.y < L + .03) {   // float on the blobs (sinks lower as it fills up)
          const want = L - .02 - c.fill * .09; c.v.y += (want - _w1.y) * 40 * dt; c.v.multiplyScalar(Math.exp(-dt * 3));
          g.quaternion.slerp(_wq.identity(), Math.min(1, dt * 2));
        }
        const hit = pawHit(_w1, .065);
        if (hit) { g.position.addScaledVector(hit.n, .065 - hit.d); const vn = c.v.dot(hit.n); if (vn < 0) { if (vn < -2.5 && ac) tone('triangle', 2400, 1900, .06, .05); c.v.addScaledVector(hit.n, -1.3 * vn).multiplyScalar(.6); }
          if (hit.n.y > .7) { _w2.set(0, 1, 0).applyQuaternion(g.quaternion); if (_w2.y > .5) g.quaternion.slerp(_wq.identity(), Math.min(1, dt * 8)); else { c.v.multiplyScalar(.9); }   // lands upright, or rolls on its side
            if (c.v.length() < .08) c.rest = true; } }
        if (g.position.y < -10) { killCup(c, true); continue; }
      }
    }
    // tipping: spill, drink or scoop
    _w2.set(0, 1, 0).applyQuaternion(g.quaternion); const tilt = Math.acos(clamp(_w2.y, -1, 1));
    g.localToWorld(_w1.set(0, .13, 0));   // rim centre
    const L = levelAt(_w1), dunk = inPool(_w1, .04) && _w1.y < L + .02;
    if ((!c.net || mine(c)) && dunk && c.fill < .99 && (c.scoopT = (c.scoopT || 0) - dt) < 0) {   // scoop: blobs near the mouth go in the cup (9 make a full cup)
      toPool(_w1, _w2); let best = -1, bd = .15 * .15; const P = GOO.p;
      for (let i = 0; i < GOO.n; i++) { const k = i * 3, d = (P[k] - _w2.x) ** 2 + (P[k + 1] - _w2.y) ** 2 + (P[k + 2] - _w2.z) ** 2; if (d < bd) { bd = d; best = i; } }
      if (best >= 0) { gooKill(best); c.fill = Math.min(1, c.fill + 1 / 9); c.scoopT = tilt < 1.2 ? .07 : .2; if (ac && Math.random() < .5) tone('sine', 300 + Math.random() * 200, 160, .07, .05); }
      if (c.fill >= .99 && !c.toldFull && c.held) { c.toldFull = true; buzz(c.held, .4, 40); }
    }
    const thr = 1.45 - c.fill * 1.05;   // a full cup spills with a small tip, an almost-empty one needs a big one
    if (c.fill > .01 && tilt > thr && !dunk) {
      const rate = Math.min(1.2, (tilt - thr) * 1.4 + .15) * dt, out = Math.min(c.fill, rate); c.fill -= out;
      headWorld(_w3); _w3.y -= .07;
      if (c.held && c.held.cup === c && !c.net && _w1.distanceTo(_w3) < .16) {   // at your mouth: GULP
        if ((c.gulpT = (c.gulpT || 0) - dt) < 0) { c.gulpT = .32; if (ac) { tone('sine', 220, 120, .12, .12); noiseHit(ac.currentTime, .08, .05, 'lowpass', 600, .7); } buzz(c.held, .3, 20); }
        WATER.sip = (WATER.sip || 0) + out;
        if (c.fill < .02) { c.toldFull = false; if (WATER.sip > 4.5) { WATER.sip = 0; headWorld(_w3); confetti(_w3.add(V(0, 0, -.2).applyQuaternion(camera.getWorldQuaternion(_wq))), 30, [0xbfe8ff, 0xffffff, 0x9fe8ff]); if (ac) { tone('sawtooth', 110, 60, .9, .22); tone('square', 75, 50, .9, .1); } toast('🫧 BUURRRRP!', 2.5); } else if (!WATER.toldDrink) { WATER.toldDrink = true; toast('😋 Ahhh. Refreshing!', 2.5); } }
      } else {   // pour: a little stream from the low side of the rim
        _w2.set(0, 1, 0).applyQuaternion(g.quaternion); const side = V(_w2.x, 0, _w2.z); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
        const lip = _w1.clone().addScaledVector(side, .044); c.pourAcc = (c.pourAcc || 0) + out;
        if (c.pourAcc >= 1 / 9 || (c.fill < .01 && c.pourAcc > .005)) {   // it glops out one blob at a time
          WATER.drops.push({ p: lip, v: side.multiplyScalar(.35 + Math.random() * .25).add(c.v.clone().multiplyScalar(.5)), t: 0, amt: c.pourAcc, mine: !c.net || mine(c), big: true }); c.pourAcc = 0;
          if (ac) tone('sine', 520 + Math.random() * 200, 200, .09, .06);
        }
      }
    }
    w.visible = c.fill > .01; w.scale.set(1, Math.max(.001, c.fill * .118), 1);
    if (online() && (!c.net || mine(c)) && tick && (c.held || !c.rest || Math.abs(c.fill - c.sentF) > .02)) { cupSend(c); c.sentF = c.fill; }
    if (c.net && !mine(c) && c.np) { g.position.lerp(c.np, Math.min(1, dt * 12)); g.quaternion.slerp(c.nq, Math.min(1, dt * 12)); }
  }
}
/* ---------- drops and puddles ---------- */
const DROP_G = new THREE.SphereGeometry(1, 10, 8);
let DROP_M = null;
const _bM = new THREE.Matrix4(), _bQ = new THREE.Quaternion(), _bS = V(), _bP = V(), _bV = V();
function blobAt(n, p, v, r) {   // a lone blob, stretched a bit in the way it's flying (like a gummy drop)
  const sp = v.length(), st = Math.min(.9, sp * .1);
  if (sp > .05) _bQ.setFromUnitVectors(_UP, _bV.copy(v).divideScalar(sp)); else _bQ.identity();
  _bS.set(r * (1 - st * .3), r * (1 + st), r * (1 - st * .3)); _bM.compose(p, _bQ, _bS); DROP_M.setMatrixAt(n, _bM);
}
function stepDrops(dt) {
  if (!DROP_M) { DROP_M = new THREE.InstancedMesh(DROP_G, dropM, 260); DROP_M.frustumCulled = false; DROP_M.renderOrder = 2; scene.add(DROP_M); }
  let n = 0;
  for (let i = WATER.drops.length - 1; i >= 0; i--) {
    const d = WATER.drops[i]; d.t += dt; d.v.y -= 9.81 * dt; d.p.addScaledVector(d.v, dt);
    let gone = d.t > 4;
    if (!gone && inPool(d.p) && d.p.y < levelAt(d.p) + .03) { gone = true; if (d.mine || !d.amt) { toPool(d.p, _bP); gooAdd(_bP.x, Math.max(_bP.y, POOL.floor + .07), _bP.z, d.v.x, d.v.y, d.v.z); } }   // plops back in and joins the slime
    else if (!gone && d.v.y < 0) { const hit = pawHit(d.p, d.big ? .04 : .012); if (hit) { gone = true; if (d.amt && d.mine && hit.n.y > .7) addPuddle(d.p.clone().setY(d.p.y - (d.big ? .04 : .012) + .004), d.amt, true); if (d.big && ac && Math.random() < .6) noiseHit(ac.currentTime, .1, .07, 'lowpass', 900, .8); } }
    if (gone) { WATER.drops.splice(i, 1); continue; }
    if (n < 200) blobAt(n++, d.p, d.v, d.big ? .045 : .014);
  }
  if (state.area === 'arena') for (const i of GOO.out) { if (i >= GOO.n || n >= 260) continue; const k = i * 3;   // slime blobs flying high above the pool
    _bP.set(GOO.p[k], GOO.p[k + 1], GOO.p[k + 2]).add(POOL.c).add(ARENA); blobAt(n++, _bP, _bV.set(GOO.v[k], GOO.v[k + 1], GOO.v[k + 2]), .06); }
  DROP_M.count = n; DROP_M.instanceMatrix.needsUpdate = true;
}
const PUD_G = new THREE.CircleGeometry(1, 20); PUD_G.rotateX(-Math.PI / 2);
function addPuddle(p, amt, send) {
  let pd = WATER.puds.find(q => Math.hypot(q.p.x - p.x, q.p.z - p.z) < q.r + .1 && Math.abs(q.p.y - p.y) < .08);
  if (!pd) { if (WATER.puds.length > 24) { const o = WATER.puds.shift(); scene.remove(o.m); } pd = { p: p.clone(), vol: 0, r: 0, m: new THREE.Mesh(PUD_G, puddleM), age: 0 }; pd.m.position.copy(p); pd.m.renderOrder = 1; scene.add(pd.m); WATER.puds.push(pd); if (ac && rnd() < .5) noiseHit(ac.currentTime, .12, .06, 'bandpass', 1800, .9); }
  pd.vol += amt; pd.age = 0; pd.r = Math.min(.8, .06 + Math.sqrt(pd.vol) * .38); pd.m.scale.setScalar(pd.r); pd.m.scale.x *= 1.15;
  if (send && online()) { WATER.pudQ = (WATER.pudQ || 0) + amt; WATER.pudP = p; }
}
function stepPuddles(dt) {
  for (let i = WATER.puds.length - 1; i >= 0; i--) { const pd = WATER.puds[i]; pd.age += dt; if (pd.age > 60) { pd.r -= dt * .02; pd.m.scale.setScalar(Math.max(.001, pd.r)); if (pd.r <= .02) { scene.remove(pd.m); WATER.puds.splice(i, 1); } } }
  if (WATER.pudQ && (WATER.pudT = (WATER.pudT || 0) - dt) < 0) { WATER.pudT = .2; const p = WATER.pudP; netSend({ t: 'wat', e: 'pud', p: [r3(p.x), r3(p.y), r3(p.z)], a: r3(WATER.pudQ) }); WATER.pudQ = 0; }
}
function onPuddle() {   // standing in a puddle = slippery!
  if (!WATER.puds.length || !state.grounded) return false;
  headWorld(_w1); const fy = _w1.y - state.bodyH;
  return WATER.puds.some(pd => Math.abs(pd.p.y - fy) < .15 && Math.hypot(pd.p.x - _w1.x, pd.p.z - _w1.z) < pd.r + .1);
}
/* ---------- sharpening glass into a sword ---------- */
const glassSwordM = new THREE.MeshStandardMaterial({ color: 0xd8f4ff, roughness: .03, metalness: .1, envMap: ENV, envMapIntensity: 2.2, transparent: true, opacity: .55, emissive: 0x2a6a8a, emissiveIntensity: .25 });
function setGlassSword(on) {
  if (WATER.glassy === on) return; WATER.glassy = on;
  sword.g.traverse(o => { if (!o.isMesh) return; if (on) { o.userData.realM = o.material; o.material = glassSwordM; } else if (o.userData.realM) o.material = o.userData.realM; });
}
function stepSharpen(dt) {
  if (!AR.ready) return;
  const top = _w1.copy(WHET).add(ARENA).setY(.57);
  for (const h of hands) {
    const pc = h.piece; if (!pc || !KINDS[pc.kind] || !KINDS[pc.kind].glass || !pc.body) continue;
    const t = pc.body.translation(); _w2.set(t.x, t.y, t.z).add(ARENA);
    const near = Math.abs(_w2.x - top.x) < .24 && Math.abs(_w2.z - top.z) < .12 && _w2.y - top.y < (pc.rad || .05) + .035 && _w2.y > top.y - .05;
    const sp = h.vel ? h.vel.length() : 0;
    if (near && sp > .25) {
      pc.sharp = (pc.sharp || 0) + Math.min(sp, 2) * dt; buzz(h, .35, 20);
      if ((WATER.sharpT -= dt) < 0) { WATER.sharpT = .07; if (ac) noiseHit(ac.currentTime, .07, .09, 'bandpass', 3000 + rnd() * 2500, 2.5); confetti(_w2.clone().setY(top.y), 2, [0xffffff, 0xcdefff]); }
      if (!WATER.told.sharp) { WATER.told.sharp = true; toast('🗡️ Shhhk shhk... keep rubbing to sharpen it!', 3); }
      if (pc.sharp > 3.5) glassToSword(h, pc);
    }
  }
}
function deskSharpen() {   // desktop: click while holding glass next to the whetstone
  const h = hands.find(x => x.piece && KINDS[x.piece.kind] && KINDS[x.piece.kind].glass); if (!h) return false;
  headWorld(_w1); if (_w1.distanceTo(_w2.copy(WHET).add(ARENA)) > 1.6) return false;
  const pc = h.piece; pc.sharp = (pc.sharp || 0) + .5; if (ac) noiseHit(ac.currentTime, .15, .12, 'bandpass', 3500, 2.5); confetti(_w2.setY(.6), 5, [0xffffff, 0xcdefff]);
  if (pc.sharp > 3.5) glassToSword(h, pc); else toast('🗡️ Sharpening... ' + Math.round(pc.sharp / 3.5 * 100) + '%', 1); return true;
}
function glassToSword(h, pc) {
  if (sword.held && sword.held !== h) { toast('🗡️ Someone else has the sword right now!', 2.5); pc.sharp = 0; return; }
  releasePiece(h); sendKill([pc]); pc.dying = .05;
  setGlassSword(true); takeSword(h); netSend({ t: 'wat', e: 'gsw' });
  confetti(h.pos.clone(), 40, [0xffffff, 0xcdefff, 0x9fe8ff]); if (ac) { sfxShing(); tone('sine', 1800, 2600, .4, .1); }
  toast('🗡️✨ Your glass turned into a GLASS SWORD!', 4);
}
/* ---------- every frame ---------- */
function stepWater(dt) {
  if (!POOL.mesh) return;
  headWorld(_w1); const near = state.area === 'arena' && _w1.distanceTo(poolW()) < 30;   // only simulate the slime when you could see it
  WU.uTime.value = tAll; WU.uLevel.value = POOL.level + .004;
  if (near) { stepPoolThings(dt); stepGoo(dt); }
  stepCups(dt); stepDrops(dt); stepPuddles(dt); stepSharpen(dt);
  if (WATER.glassy && sword.mode === 'stone') setGlassSword(false);   // back in the stone = the normal sword again
}
function waterReset() { gooFill(); WATER.cups.slice().forEach(c => killCup(c, false)); WATER.puds.forEach(p => scene.remove(p.m)); WATER.puds.length = 0; WATER.drops.length = 0; }
function watNet(d) {
  if (d.e === 'cs') {
    let c = WATER.cups.find(x => x.id === d.id); if (!c) { c = spawnCup(false, d); }
    c.net = true; c.own = d.from; if (c.held && c.held.cup === c) { c.held.cup = null; c.held = null; }
    c.np = (c.np || V()).set(...d.p); c.nq = (c.nq || new THREE.Quaternion()).set(...d.q); c.fill = +d.f || 0; c.rest = false;
  } else if (d.e === 'cdel') { const c = WATER.cups.find(x => x.id === d.id); if (c) killCup(c, false); }
  else if (d.e === 'pud') addPuddle(V(...d.p), +d.a || .05, false);
  else if (d.e === 'gsw') setGlassSword(true);
}
window.__kg.water = { POOL, WATER, GOO, gooAdd, gooFill, levelAt, spawnCup, holdCup, cupDrop, addPuddle, onPuddle, setGlassSword, glassToSword, poolPoke, stepWater, watNet, WHET, CUP_BTN };
