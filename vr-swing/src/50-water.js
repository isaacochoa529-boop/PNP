/* ======================================================================
   THE WATER LAB (in the Slicing Yard, next to the Glass Lab)
   - A pool of wavy water: a cheap 2D wave grid (no heavy fluid sim). Anything that goes in makes
     ripples and waves, the whole pool sloshes, and the water level rises with what's in it.
     Cubes float, glass sinks, you get floaty and slow when you jump in.
   - The CUP button spawns a glass cup: dunk it to scoop water, tip it to your mouth to drink,
     tip it anywhere else to pour. Water on the floor makes a slippery puddle.
   - The WHETSTONE: rub a glass shard on it long enough and it turns into a GLASS SWORD.
   Net: t:'wat' with e = cs (cup state), cdel, pud (puddle), gsw (glass sword).
   ====================================================================== */
const POOL = { c: V(5.2, 0, 8.3), W: 2.4, rim: .42, base: .3, N: 36, level: .3, disp: 0, sx: 0, sz: 0, svx: 0, svz: 0, acc: 0, mesh: null, h0: null, h1: null, inT: 0, wasIn: false, told: false };
const WATER = { cups: [], puds: [], drops: [], cupN: 0, sharpT: 0, glassy: false, swordM: null, told: {}, sendT: 0 };
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
const waterM = makeWaterMat({ half: 1.2, alpha: .14 });
const cupWaterM = makeWaterMat({ alpha: .3, amp: .25, freq: 2.5, color: 0xc8eef7 });
const puddleM = makeWaterMat({ alpha: .12, amp: .35, freq: 1.5, color: 0xb8d8e0, fres: .45, soft: 1 }); puddleM.polygonOffset = true; puddleM.polygonOffsetFactor = -3;
const dropM = new THREE.MeshStandardMaterial({ color: 0xe8fbff, roughness: .02, envMap: ENV, envMapIntensity: 2.2, transparent: true, opacity: .6, depthWrite: false });
const cupM = new THREE.MeshStandardMaterial({ color: 0xeef8ff, roughness: .04, metalness: .1, envMap: ENV, envMapIntensity: 1.8, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false });
const _w1 = V(), _w2 = V(), _w3 = V(), _wq = new THREE.Quaternion(), _wq2 = new THREE.Quaternion(), _UP = V(0, 1, 0);
const poolW = () => _w3.copy(POOL.c).add(ARENA);   // pool centre in the world
/* ---------- the pool: a tiled basin with a rim you can climb over ---------- */
{
  const g = new THREE.Group(); g.position.copy(POOL.c); arena.add(g);
  const W = POOL.W, T = .12, R = POOL.rim, tileTex = labelTex(256, 256, (q, w, h) => { q.fillStyle = '#bfe9f5'; q.fillRect(0, 0, w, h); q.strokeStyle = '#8fcfe2'; q.lineWidth = 6; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.stroke(); q.beginPath(); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); } });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(4, 4);
  const tileM = addCaustics(new THREE.MeshStandardMaterial({ map: tileTex, roughness: .35 })), rimM = addCaustics(new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: .5 }));
  part(new THREE.BoxGeometry(W, .01, W), tileM, 0, .006, 0, g);
  [[0, W / 2 + T / 2, W + 2 * T, T], [0, -W / 2 - T / 2, W + 2 * T, T], [W / 2 + T / 2, 0, T, W], [-W / 2 - T / 2, 0, T, W]].forEach(([x, z, sx, sz]) => {
    part(new THREE.BoxGeometry(sx, R, sz), rimM, x, R / 2, z, g);
    addCol({ t: 0, x: ARENA.x + POOL.c.x + x, y: R / 2, z: ARENA.z + POOL.c.z + z, hx: sx / 2, hy: R / 2, hz: sz / 2, yaw: 0, tag: 'rock' });
  });
  // a sign so people know what it is
  const sgT = labelTex(512, 128, (q, w, h) => signText(q, w, h, [['💧 WATER LAB 💧', 64, '#7fd8ff', 80]], 'rgba(14,20,30,.92)', '#3fb2ff'));
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .275), new THREE.MeshBasicMaterial({ map: sgT, transparent: true })); sg.position.set(0, R + .32, -W / 2 - T); g.add(sg);
  part(new THREE.CylinderGeometry(.02, .02, .3, 8), smat(0xe9eef2, { roughness: .5 }), 0, R + .15, -W / 2 - T - .01, g);
  // the water surface: a grid we push up and down every frame
  const geo = new THREE.PlaneGeometry(W, W, POOL.N - 1, POOL.N - 1); geo.rotateX(-Math.PI / 2);
  POOL.mesh = new THREE.Mesh(geo, waterM); POOL.mesh.position.y = POOL.base; POOL.mesh.renderOrder = 2; g.add(POOL.mesh);
  POOL.h0 = new Float32Array(POOL.N * POOL.N); POOL.h1 = new Float32Array(POOL.N * POOL.N);
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
  fixed(R.ColliderDesc.cylinder(.165, .14), CUP_BTN.x, .165, CUP_BTN.z);
  fixed(R.ColliderDesc.cuboid(.25, .285, .15), WHET.x, .285, WHET.z);
}
/* ---------- waves ---------- */
function inPool(p, pad = 0) { const c = poolW(); return Math.abs(p.x - c.x) < POOL.W / 2 - pad && Math.abs(p.z - c.z) < POOL.W / 2 - pad; }
function poolPoke(p, amt, rad = .12) {   // push the water at a world point (amt > 0 pushes it down)
  const c = poolW(), N = POOL.N, cs = POOL.W / (N - 1);
  const cx = (p.x - c.x + POOL.W / 2) / cs, cz = (p.z - c.z + POOL.W / 2) / cs, r = Math.max(1, rad / cs);
  for (let j = Math.max(1, Math.floor(cz - r)); j <= Math.min(N - 2, Math.ceil(cz + r)); j++)
    for (let i = Math.max(1, Math.floor(cx - r)); i <= Math.min(N - 2, Math.ceil(cx + r)); i++) {
      const d2 = ((i - cx) ** 2 + (j - cz) ** 2) / (r * r); if (d2 < 1) POOL.h0[j * N + i] -= amt * (1 - d2);
    }
}
const RING_G = new THREE.RingGeometry(.8, 1, 40); RING_G.rotateX(-Math.PI / 2);
const RINGS = [];
function ring(p, s, life = 1.1) {   // a ring that spreads out across the surface
  if (RINGS.length > 14) { const o = RINGS.shift(); scene.remove(o.m); o.m.material.dispose(); }
  const m = new THREE.Mesh(RING_G, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false })); m.position.set(p.x, POOL.level + .006, p.z); m.scale.setScalar(.02); m.renderOrder = 3; scene.add(m);
  RINGS.push({ m, t: 0, s, life });
}
function stepRings(dt) {
  for (let i = RINGS.length - 1; i >= 0; i--) { const r = RINGS[i]; r.t += dt; const a = r.t / r.life; if (a >= 1) { scene.remove(r.m); r.m.material.dispose(); RINGS.splice(i, 1); continue; }
    r.m.scale.setScalar(.03 + r.s * Math.sqrt(a)); r.m.material.opacity = .45 * (1 - a) ** 1.5; r.m.position.y = POOL.level + .006;
    const c = poolW(); if (Math.abs(r.m.position.x - c.x) + r.m.scale.x > POOL.W / 2 + .05 || Math.abs(r.m.position.z - c.z) + r.m.scale.x > POOL.W / 2 + .05) r.m.material.opacity *= .5; }
}
function splash(p, k) {   // a splash you can see and hear
  ring(p, .35 + k * .5); if (k > .4) ring(p, .2 + k * .3, 1.4);
  for (let i = 0; i < Math.round(6 + k * 14); i++) WATER.drops.push({ p: p.clone(), v: V((rnd() - .5) * 2.2 * k, 1.2 + rnd() * 2.6 * k, (rnd() - .5) * 2.2 * k), t: 0, pool: true });
  if (ac) { const t = ac.currentTime, v = Math.min(.6, .12 + k * .25); noiseHit(t, .18 + k * .25, v, 'bandpass', 900 + rnd() * 500, .6); tone('sine', 700 + rnd() * 300, 180, .18, v * .25); }
}
function stepWaves(dt) {
  const N = POOL.N, a = POOL.h0, b = POOL.h1;
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {   // ripple tank: the classic two-buffer wave, one step a frame
    const k = j * N + i; b[k] = ((a[k - 1] + a[k + 1] + a[k - N] + a[k + N]) * .5 - b[k]) * .985;
  }
  POOL.h0 = b; POOL.h1 = a;
  // slosh: the whole surface tilts back and forth like a spring
  POOL.svx += (-POOL.sx * 22 - POOL.svx * 1.2) * dt; POOL.svz += (-POOL.sz * 22 - POOL.svz * 1.2) * dt; POOL.sx += POOL.svx * dt; POOL.sz += POOL.svz * dt;
  const pos = POOL.mesh.geometry.attributes.position, h = POOL.h0, t = tAll, hw = POOL.W / 2;
  for (let k = 0; k < N * N; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    pos.setY(k, h[k] * .6 + Math.sin(x * 3.1 + t * 1.3) * .004 + Math.sin(z * 2.7 - t * 1.1) * .004 + (x / hw) * POOL.sx + (z / hw) * POOL.sz);
  }
  pos.needsUpdate = true; POOL.mesh.geometry.computeVertexNormals();
}
/* ---------- what's in the water: cubes, glass, paws, you, friends, cups ---------- */
const _wPrev = new WeakMap();
function wetThing(key, p, r, dt) {   // ripples from anything crossing or moving through the surface
  const pv = _wPrev.get(key); _wPrev.set(key, p.clone()); if (!pv || !inPool(p, .02)) return;
  const L = POOL.level, vy = (p.y - pv.y) / dt, hs = Math.hypot(p.x - pv.x, p.z - pv.z) / dt;
  if (Math.abs(p.y - L) > r + .03) return;
  poolPoke(p, clamp(-vy * .012, -.05, .05) + clamp(hs * .004, 0, .03) * (rnd() < .5 ? 1 : -1), r + .05);
  if (hs > .5 && rnd() < dt * 7) ring(p, .12 + Math.min(.3, hs * .06), .8);
  if ((pv.y - r > L && p.y - r <= L && vy < -1.2) || (pv.y + r < L && p.y + r >= L && vy > 1.5)) { splash(V(p.x, L, p.z), clamp(Math.abs(vy) / 5, .2, 1.2) * Math.min(1.5, r * 6)); POOL.svx += (p.x - pv.x) / dt * .02; POOL.svz += (p.z - pv.z) / dt * .02; }
}
function stepPoolThings(dt) {
  const L = POOL.level; let disp = 0;
  // cubes and glass: float or sink by what they're made of
  if (AR.ready) for (const pc of AR.pieces) {
    if (!pc.body || pc.pane || pc.dying) continue;
    const t = pc.body.translation(); _w1.set(t.x, t.y, t.z).add(ARENA); if (!inPool(_w1)) continue;
    const r = pc.rad || .1, sub = clamp((L - (_w1.y - r)) / (2 * r), 0, 1); if (sub <= 0) { wetThing(pc, _w1, r, dt); continue; }
    disp += (pc.vol || r * r * r) * sub; wetThing(pc, _w1, r, dt);
    if (pc.held || !mine(pc) || pc.body.bodyType() !== 0) continue;
    const K = KINDS[pc.kind] || {}, B = K.glass ? .45 : K.rub ? 2.6 : 1.8, m = pc.body.mass();
    pc.body.applyImpulse({ x: 0, y: m * 9.81 * dt * sub * B, z: 0 }, true);
    const lv = pc.body.linvel(), f = Math.exp(-dt * 2.2 * sub), av = pc.body.angvel(), fa = Math.exp(-dt * 1.5 * sub);
    pc.body.setLinvel({ x: lv.x * f, y: lv.y * f, z: lv.z * f }, true); pc.body.setAngvel({ x: av.x * fa, y: av.y * fa, z: av.z * fa }, true);
  }
  // your paws
  hands.forEach(h => { if (h.tracked || !state.xr) wetThing(h, h.pos, PAW_R, dt); });
  // you: jump in and you get floaty and slow
  headWorld(_w1); const feet = _w1.y - state.bodyH;
  if (inPool(_w1, .05) && feet < L) {
    const fr = clamp((L - feet) / state.bodyH, 0, 1); disp += .25 * fr * BM.sc ** 3;
    state.vel.y += 9.81 * 1.15 * fr * dt; const f = Math.exp(-dt * 2.4 * fr); state.vel.multiplyScalar(f);
    if (!POOL.wasIn) { const vy = state.vel.y; splash(V(_w1.x, L, _w1.z), clamp(-vy / 4, .4, 1.5)); poolPoke(_w1, .09, .35); POOL.svx += state.vel.x * .05; POOL.svz += state.vel.z * .05; if (!POOL.told) { POOL.told = true; toast('💦 SPLASH! You\'re floaty in the water.', 3); } }
    POOL.wasIn = true; _w2.set(_w1.x, L, _w1.z); wetThing(POOL, _w2.set(_w1.x, feet + .1, _w1.z), .25, dt);
  } else POOL.wasIn = false;
  // friends
  for (const [id, f] of MP.others) { f.paws.forEach((p, i) => wetThing(p, p.getWorldPosition(_w2), PAW_R, dt)); }
  // cups bob too
  WATER.cups.forEach(c => wetThing(c, c.g.position, .06, dt));
  if (sword.g.visible) { sword.g.getWorldPosition(_w1); wetThing(sword, _w1, .08, dt); }
  POOL.disp += (disp - POOL.disp) * Math.min(1, dt * 3);
  POOL.level = POOL.base + Math.min(.08, POOL.disp * 2.2 / (POOL.W * POOL.W));   // the water rises with what's in it (a bit extra so you can SEE it)
  POOL.mesh.position.y = POOL.level;
}
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
  const L = POOL.level, tick = (WATER.sendT -= dt) < 0; if (tick) WATER.sendT = .1;
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
        if (inPool(_w1, .04) && _w1.y < L + .03) {   // float (sinks lower as it fills up)
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
    if ((!c.net || mine(c)) && inPool(_w1, .04) && _w1.y < L + .02 && g.localToWorld(_w2.set(0, .03, 0)).y < L && c.fill < 1) { c.fill = Math.min(1, c.fill + dt * (tilt < 1.2 ? 1.8 : .6)); if (rnd() < dt * 12) poolPoke(_w1, .012, .08); if (c.fill >= 1 && !c.toldFull && c.held) { c.toldFull = true; buzz(c.held, .4, 40); } }
    const thr = 1.45 - c.fill * 1.05;   // a full cup spills with a small tip, an almost-empty one needs a big one
    if (c.fill > .01 && tilt > thr && !(inPool(_w1, .04) && _w1.y < L)) {
      const rate = Math.min(1.2, (tilt - thr) * 1.4 + .15) * dt, out = Math.min(c.fill, rate); c.fill -= out;
      headWorld(_w3); _w3.y -= .07;
      if (c.held && c.held.cup === c && !c.net && _w1.distanceTo(_w3) < .16) {   // at your mouth: GULP
        if ((c.gulpT = (c.gulpT || 0) - dt) < 0) { c.gulpT = .32; if (ac) { tone('sine', 220, 120, .12, .12); noiseHit(ac.currentTime, .08, .05, 'lowpass', 600, .7); } buzz(c.held, .3, 20); }
        WATER.sip = (WATER.sip || 0) + out;
        if (c.fill < .02) { c.toldFull = false; if (WATER.sip > 4.5) { WATER.sip = 0; headWorld(_w3); confetti(_w3.add(V(0, 0, -.2).applyQuaternion(camera.getWorldQuaternion(_wq))), 30, [0xbfe8ff, 0xffffff, 0x9fe8ff]); if (ac) { tone('sawtooth', 110, 60, .9, .22); tone('square', 75, 50, .9, .1); } toast('🫧 BUURRRRP!', 2.5); } else if (!WATER.toldDrink) { WATER.toldDrink = true; toast('😋 Ahhh. Refreshing!', 2.5); } }
      } else {   // pour: a little stream from the low side of the rim
        _w2.set(0, 1, 0).applyQuaternion(g.quaternion); const side = V(_w2.x, 0, _w2.z); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
        const lip = _w1.clone().addScaledVector(side, .044); c.pourAcc = (c.pourAcc || 0) + out;
        if ((c.pourT -= dt) < 0) { c.pourT = .03; WATER.drops.push({ p: lip, v: side.multiplyScalar(.5 + rnd() * .3).add(c.v.clone().multiplyScalar(.5)), t: 0, amt: c.pourAcc, mine: !c.net || mine(c) }); c.pourAcc = 0; }
      }
    }
    w.visible = c.fill > .01; w.scale.set(1, Math.max(.001, c.fill * .118), 1);
    if (online() && (!c.net || mine(c)) && tick && (c.held || !c.rest || Math.abs(c.fill - c.sentF) > .02)) { cupSend(c); c.sentF = c.fill; }
    if (c.net && !mine(c) && c.np) { g.position.lerp(c.np, Math.min(1, dt * 12)); g.quaternion.slerp(c.nq, Math.min(1, dt * 12)); }
  }
}
/* ---------- drops and puddles ---------- */
const DROP_G = new THREE.SphereGeometry(.012, 6, 4);
let DROP_M = null;
function stepDrops(dt) {
  if (!DROP_M) { DROP_M = new THREE.InstancedMesh(DROP_G, dropM, 220); DROP_M.frustumCulled = false; DROP_M.renderOrder = 2; scene.add(DROP_M); }
  const L = POOL.level, m = new THREE.Matrix4(); let n = 0;
  for (let i = WATER.drops.length - 1; i >= 0; i--) {
    const d = WATER.drops[i]; d.t += dt; d.v.y -= 9.81 * dt; d.p.addScaledVector(d.v, dt);
    let gone = d.t > 2.5;
    if (!gone && inPool(d.p) && d.p.y < L) { gone = true; if (!d.pool) poolPoke(d.p, .006, .06); }
    else if (!gone && d.v.y < 0) { const hit = pawHit(d.p, .012); if (hit) { gone = true; if (d.amt && d.mine && hit.n.y > .7) addPuddle(d.p.clone().setY(d.p.y - .012 + .004), d.amt, true); } }
    if (gone) { WATER.drops.splice(i, 1); continue; }
    if (n < 220) { m.makeTranslation(d.p.x, d.p.y, d.p.z); DROP_M.setMatrixAt(n++, m); }
  }
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
  const near = state.area === 'arena';
  WU.uTime.value = tAll; WU.uLevel.value = POOL.level + .004;
  if (near) { stepPoolThings(dt); stepWaves(dt); stepRings(dt); }
  stepCups(dt); stepDrops(dt); stepPuddles(dt); stepSharpen(dt);
  if (WATER.glassy && sword.mode === 'stone') setGlassSword(false);   // back in the stone = the normal sword again
}
function waterReset() { WATER.cups.slice().forEach(c => killCup(c, false)); WATER.puds.forEach(p => scene.remove(p.m)); WATER.puds.length = 0; WATER.drops.length = 0; }
function watNet(d) {
  if (d.e === 'cs') {
    let c = WATER.cups.find(x => x.id === d.id); if (!c) { c = spawnCup(false, d); }
    c.net = true; c.own = d.from; if (c.held && c.held.cup === c) { c.held.cup = null; c.held = null; }
    c.np = (c.np || V()).set(...d.p); c.nq = (c.nq || new THREE.Quaternion()).set(...d.q); c.fill = +d.f || 0; c.rest = false;
  } else if (d.e === 'cdel') { const c = WATER.cups.find(x => x.id === d.id); if (c) killCup(c, false); }
  else if (d.e === 'pud') addPuddle(V(...d.p), +d.a || .05, false);
  else if (d.e === 'gsw') setGlassSword(true);
}
window.__kg.water = { POOL, WATER, spawnCup, holdCup, cupDrop, addPuddle, onPuddle, setGlassSword, glassToSword, poolPoke, stepWater, watNet, WHET, CUP_BTN };
