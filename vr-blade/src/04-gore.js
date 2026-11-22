// ===== GORE: blood drops, floor splats, stumps with bones, bleeding, and loose-body physics =====
const BLOOD = new THREE.Color('#a8001a'), GOLDB = new THREE.Color('#ffcc33');
let goldBlood = false;
function bloodCol() {
  if (state.rainbow) return new THREE.Color().setHSL(Math.random(), 1, .5);
  return (goldBlood ? GOLDB : BLOOD).clone().offsetHSL(0, 0, rand(-.06, .04));
}
const floorAt = (x, z) => (z < -10.05 && Math.abs(x) < 1.1) ? .012 : 0;

// --- flying drops (one instanced mesh) ---
const DROPS_N = 700;
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ roughness: .25, metalness: .1 }), DROPS_N);
drops.frustumCulled = false; drops.count = DROPS_N; scene.add(drops);
const D = [];
const _m4 = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < DROPS_N; i++) { D.push({ p: new V3(), v: new V3(), life: 0, s: .01, c: new THREE.Color() }); drops.setMatrixAt(i, _zero); drops.setColorAt(i, BLOOD); }
let dI = 0;
function spawnBlood(p, dir, n, speed = 2, spread = .6, col) {
  for (let k = 0; k < n; k++) {
    const d = D[dI]; dI = (dI + 1) % DROPS_N;
    d.p.copy(p).add(_v1.set(rand(-.02, .02), rand(-.02, .02), rand(-.02, .02)));
    d.v.copy(dir).normalize().multiplyScalar(speed * rand(.4, 1.2)).add(_v1.set(rand(-1, 1), rand(-.5, 1), rand(-1, 1)).multiplyScalar(speed * spread));
    d.life = 3; d.s = rand(.006, .016); d.c.copy(col || bloodCol());
    drops.setColorAt(dI === 0 ? DROPS_N - 1 : dI - 1, d.c);
  }
  drops.instanceColor.needsUpdate = true;
}
function stepDrops(dt) {
  for (let i = 0; i < DROPS_N; i++) {
    const d = D[i]; if (d.life <= 0) continue;
    d.life -= dt; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt);
    const fy = floorAt(d.p.x, d.p.z);
    if (d.p.y < fy + .003 || d.life <= 0) {
      if (d.life > 0 && Math.random() < .55) addDecal(d.p.x, d.p.z, d.s * rand(2.5, 6), d.c);
      d.life = 0; drops.setMatrixAt(i, _zero); continue;
    }
    const sp = d.v.length();
    _q1.setFromUnitVectors(_v2.set(0, 1, 0), _v3.copy(d.v).divideScalar(sp || 1));
    _m4.compose(d.p, _q1, _v2.set(d.s, d.s * (1 + Math.min(sp * .25, 2)), d.s));
    drops.setMatrixAt(i, _m4);
  }
  drops.instanceMatrix.needsUpdate = true;
}
// --- floor splats ---
const DEC_N = 500;
const decGeo = new THREE.CircleGeometry(1, 12); decGeo.rotateX(-Math.PI / 2);
{ const p = decGeo.attributes.position; for (let i = 1; i < p.count; i++) { const k = rand(.75, 1.15); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
const decals = new THREE.InstancedMesh(decGeo, new THREE.MeshStandardMaterial({ roughness: .2, metalness: .1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), DEC_N);
decals.count = 0; decals.receiveShadow = true; decals.frustumCulled = false; scene.add(decals);
for (let i = 0; i < DEC_N; i++) decals.setColorAt(i, BLOOD);
let decI = 0;
function addDecal(x, z, s, col) {
  const i = decI % DEC_N; decI++;
  _m4.compose(_v1.set(x, floorAt(x, z) + .002 + (i % 8) * .0003, z), _q1.setFromAxisAngle(_v2.set(0, 1, 0), Math.random() * 6), _v3.set(s, 1, s * rand(.7, 1.3)));
  decals.setMatrixAt(i, _m4); decals.setColorAt(i, (col || BLOOD).clone().multiplyScalar(.7));
  decals.count = Math.min(DEC_N, decI); decals.instanceMatrix.needsUpdate = true; decals.instanceColor.needsUpdate = true;
}
function clearGore() { decals.count = 0; decI = 0; for (const d of D) d.life = 0; }

// --- stumps: raw meat + a bone sticking out, pointing along the group's +Y ---
const meatMat = new THREE.MeshStandardMaterial({ color: '#8f0f1c', roughness: .35, emissive: '#2a0004' });
const meat2Mat = new THREE.MeshStandardMaterial({ color: '#d0485a', roughness: .5 });
const boneMat = new THREE.MeshStandardMaterial({ color: '#efe4cc', roughness: .55 });
function makeStump(r, boneR, boneLen = .05) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * .97, r, .014, 14), meatMat); disc.position.y = .004; g.add(disc);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r * .6, r * .65, .016, 12), meat2Mat); inner.position.y = .008; g.add(inner);
  for (let i = 0; i < 7; i++) {   // ragged torn bits around the edge
    const a = i / 7 * Math.PI * 2 + rand(-.2, .2);
    const t = new THREE.Mesh(new THREE.ConeGeometry(r * .22, r * rand(.3, .6), 5), meatMat);
    t.position.set(Math.cos(a) * r * .85, .015, Math.sin(a) * r * .85); t.rotation.set(rand(-.3, .3), 0, rand(-.3, .3)); g.add(t);
  }
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(boneR, boneR * 1.15, boneLen, 10), boneMat); bone.position.y = boneLen / 2 + .006; g.add(bone);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(boneR * 1.45, 10, 8), boneMat); knob.position.y = boneLen + .006; knob.scale.y = .8; g.add(knob);
  const marrow = new THREE.Mesh(new THREE.CircleGeometry(boneR * .5, 8), meatMat); marrow.rotation.x = -Math.PI / 2; marrow.position.y = boneLen + .006 + boneR * 1.17; g.add(marrow);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// --- bleeding spots that drip/squirt for a while ---
const BLEED = [];
function addBleeder(obj, local, dirLocal, secs, rate, col) { BLEED.push({ obj, local: local.clone(), dir: dirLocal.clone(), until: state.t + secs, start: state.t, rate, acc: 0, col }); }
function stepBleeders(dt) {
  for (let i = BLEED.length - 1; i >= 0; i--) {
    const b = BLEED[i];
    if (state.t > b.until || !b.obj.parent) { BLEED.splice(i, 1); continue; }
    const k = 1 - (state.t - b.start) / (b.until - b.start);
    const pump = .6 + .4 * Math.sin(state.t * 9);          // heartbeat-ish squirting
    b.acc += dt * b.rate * k * pump;
    if (b.acc >= 1) {
      const n = Math.floor(b.acc); b.acc -= n;
      b.obj.updateWorldMatrix(true, false);
      const p = _v2.copy(b.local).applyMatrix4(b.obj.matrixWorld);
      const d = _v3.copy(b.dir).transformDirection(b.obj.matrixWorld);
      spawnBlood(p.clone(), d.clone(), n, 1.6 * k + .3, .35, b.col ? b.col() : undefined);
    }
  }
}

// --- loose bodies: simple rigid bodies (ripped limbs, heads, teeth, chunks) ---
const LOOSE = [];
const GRAV = 9.8;
// obj = a Group whose origin is the centre of mass. samples = local points used for floor contact.
function makeLoose(obj, { mass = 3, k = .12, samples, kind = 'part', life = 0, r = .15 } = {}) {
  const b = { obj, v: new V3(), w: new V3(), m: mass, invI: 1 / (mass * k * k), samples, kind, life, r, held: null, still: 0, cool: 0, smash: 0 };
  LOOSE.push(b);
  if (LOOSE.length > 45) { const old = LOOSE.findIndex(x => !x.held && x.kind !== 'head' && x.kind !== 'body'); if (old >= 0) killLoose(LOOSE[old]); }
  return b;
}
function killLoose(b) { const i = LOOSE.indexOf(b); if (i >= 0) LOOSE.splice(i, 1); if (b.obj.parent) b.obj.parent.remove(b.obj); if (b.held) b.held.grab = null; }
const _r = new V3(), _vp = new V3(), _t = new V3(), _rn = new V3();
function stepLoose(dt) {
  for (let i = LOOSE.length - 1; i >= 0; i--) {
    const b = LOOSE[i];
    if (b.life) { b.life -= dt; if (b.life <= 0) { killLoose(b); continue; } }
    b.cool -= dt;
    if (b.held && !b.soft) continue;
    if (b.held) b.still = 0;
    if (b.still > .6) continue;
    const o = b.obj;
    b.v.y -= GRAV * dt; b.v.multiplyScalar(1 - .1 * dt); b.w.multiplyScalar(1 - (b.soft ? 1.5 : .3) * dt);
    o.position.addScaledVector(b.v, dt);
    const wl = b.w.length();
    if (wl > 1e-5) { _q1.setFromAxisAngle(_v1.copy(b.w).divideScalar(wl), wl * dt); o.quaternion.premultiply(_q1); }
    collideFloor(b, true);
    collideWalls(b);
    if (b.v.lengthSq() < .004 && b.w.lengthSq() < .02 && b.touch) b.still += dt; else b.still = 0;
  }
}
// bounce one contact point off a surface with normal n (unit). Returns impact speed (0 if separating).
function bounce(b, p, n, e = .25, mu = .5) {
  _r.subVectors(p, b.obj.position);
  _vp.crossVectors(b.w, _r).add(b.v);
  const vn = _vp.dot(n); if (vn >= 0) return 0;
  _rn.crossVectors(_r, n);
  const j = -(1 + (-vn > 1.5 ? e : 0)) * vn / (1 / b.m + b.invI * _rn.lengthSq());
  b.v.addScaledVector(n, j / b.m); b.w.addScaledVector(_rn, j * b.invI);
  _vp.crossVectors(b.w, _r).add(b.v); _t.copy(_vp).addScaledVector(n, -_vp.dot(n));
  const tl = _t.length();
  if (tl > 1e-4) {
    _t.divideScalar(tl); const rt = _v2.crossVectors(_r, _t);
    const jt = Math.min(tl / (1 / b.m + b.invI * rt.lengthSq()), mu * j);
    b.v.addScaledVector(_t, -jt / b.m); b.w.addScaledVector(rt, -jt * b.invI);
  }
  return -vn;
}
// walls, pillars and crates: every sample point is kept inside with keepIn()
const _wc = new V3();
function collideWalls(b) {
  const o = b.obj; let worst = 0, wn = null, wp = null;
  const pts = b.samples.length ? b.samples : [new V3()];
  for (const s of pts) {
    const p = _v1.copy(s).applyQuaternion(o.quaternion).add(o.position);
    _wc.copy(p); keepIn(_wc, .02);
    const d = _wc.sub(p), l = d.length();
    if (l > worst) { worst = l; wn = d.divideScalar(l).clone(); wp = p.clone(); }
  }
  if (!wn) return;
  o.position.addScaledVector(wn, worst);
  const hit = bounce(b, wp.addScaledVector(wn, worst), wn, .35, .4);
  if (hit > 2.2 && b.cool <= 0) onImpact(b, wp, hit, wn);
}
// pushes the body out of the floor with bounce + friction. Returns the hardest impact speed.
function collideFloor(b, dynamic) {
  const o = b.obj; let hit = 0, deepest = 0, hp = null; b.touch = false;
  for (const s of b.samples) {
    const p = _v1.copy(s).applyQuaternion(o.quaternion).add(o.position);
    const fy = floorAt(p.x, p.z), pen = fy - p.y;
    if (pen <= 0) continue;
    b.touch = true; if (pen > deepest) { deepest = pen; hp = p.clone(); }
    if (!dynamic) continue;
    _r.subVectors(p, o.position);
    _vp.crossVectors(b.w, _r).add(b.v);
    const vn = _vp.y;
    if (vn >= 0) continue;
    hit = Math.max(hit, -vn);
    _rn.set(-_r.z, 0, _r.x);                       // r x up
    const e = -vn > 1.5 ? .25 : 0;
    const j = -(1 + e) * vn / (1 / b.m + b.invI * _rn.lengthSq());
    b.v.y += j / b.m; b.w.addScaledVector(_rn, j * b.invI);
    // friction
    _vp.crossVectors(b.w, _r).add(b.v); _t.set(_vp.x, 0, _vp.z);
    const tl = _t.length();
    if (tl > 1e-4) {
      _t.divideScalar(tl);
      const rt = _v2.crossVectors(_r, _t);
      const jt = Math.min(tl / (1 / b.m + b.invI * rt.lengthSq()), .6 * j);
      b.v.addScaledVector(_t, -jt / b.m); b.w.addScaledVector(rt, -jt * b.invI);
    }
  }
  if (deepest > 0) { o.position.y += deepest; if (dynamic) b.w.multiplyScalar(.985); }
  if (hit > 0 && hp && dynamic && b.cool <= 0) onImpact(b, hp, hit);
  return { deepest, hp };
}
function onImpact(b, p, speed, n) {
  b.cool = .12; n = n || _v3.set(0, 1, 0);
  if (n.y < .5 && speed > 2.5 && b.kind !== 'tooth' && b.kind !== 'eye' && b.kind !== 'chunk') addSplat(p, n, Math.min(.35, .05 + speed * .025));
  if (b.kind === 'body') { bodyImpact(b, p, speed, n); return; }
  if (b.kind === 'head' && speed > 3.2) { smashHead(b, p, speed); return; }
  if (b.kind === 'tooth' || b.kind === 'eye') { if (speed > 1) sfx.click(); return; }
  if (speed > 2) { sfx.thud(Math.min(1, speed / 6)); if (b.kind !== 'chunk') { spawnBlood(p, n, Math.min(14, speed * 2 | 0), speed * .25, .9); sfx.splat(); } }
}
// blood splats stuck on walls / pillars / crates (face along the normal)
const SPL_N = 160;
const splats = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12), new THREE.MeshStandardMaterial({ roughness: .2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), SPL_N);
splats.count = 0; splats.frustumCulled = false; scene.add(splats);
for (let i = 0; i < SPL_N; i++) splats.setColorAt(i, BLOOD);
let splI = 0;
function addSplat(p, n, s) {
  const i = splI % SPL_N; splI++;
  _m4.compose(_v1.copy(p).addScaledVector(n, .012), _q1.setFromUnitVectors(_v2.set(0, 0, 1), n).multiply(new Q().setFromAxisAngle(_v2, Math.random() * 6)), _v3.set(s, s * rand(.6, 1.4), 1));
  splats.setMatrixAt(i, _m4); splats.setColorAt(i, bloodCol().multiplyScalar(.75));
  splats.count = Math.min(SPL_N, splI); splats.instanceMatrix.needsUpdate = true; splats.instanceColor.needsUpdate = true;
  // drips run down from it
  spawnBlood(p.clone().addScaledVector(n, .03), n, 6, 1, .5);
}
