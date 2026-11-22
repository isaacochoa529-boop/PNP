/* ======================================================================
   KNUCKLE GROVE: arm-swing locomotion. Your paws stick to whatever they
   touch; moving a stuck paw moves your whole body the opposite way.
   ====================================================================== */
const $ = id => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hsh = (x, y, z, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 19.19) * 43758.5453; return v - Math.floor(v) - .5; };
let seedS = 7;
const rnd = () => { seedS = (Math.imul(seedS, 1664525) + 1013904223) >>> 0; return seedS / 4294967296; };
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

/* ---------------- tuning ---------------- */
const G = 9.8;              // gravity m/s^2
const PAW_R = 0.075;        // paw contact radius (a bit generous so the ground is easy to catch)
const MAX_LAUNCH = 8.5;     // cap on fling speed
const LAUNCH_MUL = 1.15;    // a little extra oomph when you let go
const RELEASE = 0.02;       // pull a stuck paw this far off the surface (in total) to let go
const SPAWN = V(0, 0.55, 0);
const SIZES = [{ name: 'Tiny', h: .5 }, { name: 'Small', h: .6 }, { name: 'Medium', h: .7 }, { name: 'Big', h: .82 }];   // eye height above the ground while resting
const AVATAR_EYE = .85;   // the Thumpling model's own eye height; it keeps this size no matter where the ground is
const BERRIES_TOTAL = 15;

/* ---------------- renderer / scene ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
const IS_TOUCH = (matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0xa6dcff, 34, 95);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 220);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
camera.position.set(0, .85, 0);

scene.add(new THREE.HemisphereLight(0xdff4ff, 0x4a7a3a, 1.15));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.9);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/* sky dome with a soft gradient */
{
  const g = new THREE.SphereGeometry(180, 32, 16);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x4fb0ff) }, bot: { value: new THREE.Color(0xd9f3ff) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ float k = clamp(h*1.6+.15,0.,1.); gl_FragColor = vec4(mix(bot, top, k), 1.); }' });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -1; scene.add(sky); scene.userData.sky = sky;
  // puffy clouds
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group(), a = i / 14 * Math.PI * 2 + rnd(), r = 70 + rnd() * 40;
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rnd() * 3, 1), cm); s.position.set(k * 4 - 6, rnd() * 1.5, rnd() * 3); s.scale.y = .6; c.add(s); }
    c.position.set(Math.cos(a) * r, 32 + rnd() * 18, Math.sin(a) * r); c.lookAt(0, c.position.y, 0); sky.add(c);
  }
}

/* ======================= collision world ======================= */
// t: 0 = box (yaw-rotated), 1 = vertical cylinder, 2 = sphere. Each has an AABB for a cheap first test.
const colliders = [];
function addCol(c) {
  if (c.t === 0) { const e = Math.hypot(c.hx, c.hz); Object.assign(c, { minx: c.x - e, maxx: c.x + e, minz: c.z - e, maxz: c.z + e, miny: c.y - c.hy, maxy: c.y + c.hy, cs: Math.cos(c.yaw || 0), sn: Math.sin(c.yaw || 0) }); }
  else if (c.t === 1) Object.assign(c, { minx: c.x - c.r, maxx: c.x + c.r, minz: c.z - c.r, maxz: c.z + c.r, miny: c.cy - c.hy, maxy: c.cy + c.hy });
  else if (c.t !== 3 && c.t !== 4) Object.assign(c, { minx: c.c.x - c.r, maxx: c.c.x + c.r, miny: c.c.y - c.r, maxy: c.c.y + c.r, minz: c.c.z - c.r, maxz: c.c.z + c.r });
  colliders.push(c); return c;
}
// signed distance from p to the collider surface; writes the outward normal into n
function sdf(c, p, n) {
  if (c.t === 3) return paneSdf(c.pane, p, n);   // glass
  if (c.t === 4) return c.sdf(p, n);             // a whole landscape (the Wilds): it remembers what it hit in c.last
  if (c.t === 0) {
    const wx = p.x - c.x, wz = p.z - c.z;
    const lx = c.cs * wx - c.sn * wz, lz = c.sn * wx + c.cs * wz, ly = p.y - c.y;
    const qx = Math.abs(lx) - c.hx, qy = Math.abs(ly) - c.hy, qz = Math.abs(lz) - c.hz;
    let nx = 0, ny = 0, nz = 0, d;
    if (qx <= 0 && qy <= 0 && qz <= 0) {
      if (qx > qy && qx > qz) { d = qx; nx = Math.sign(lx) || 1; } else if (qy > qz) { d = qy; ny = Math.sign(ly) || 1; } else { d = qz; nz = Math.sign(lz) || 1; }
    } else {
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0); d = Math.hypot(ox, oy, oz);
      nx = Math.sign(lx) * ox / d; ny = Math.sign(ly) * oy / d; nz = Math.sign(lz) * oz / d;
    }
    n.set(c.cs * nx + c.sn * nz, ny, -c.sn * nx + c.cs * nz); return d;
  }
  if (c.t === 1) {
    const dx = p.x - c.x, dz = p.z - c.z, rr = Math.hypot(dx, dz);
    const ux = rr > 1e-6 ? dx / rr : 1, uz = rr > 1e-6 ? dz / rr : 0, sy = Math.sign(p.y - c.cy) || 1;
    const qr = rr - c.r, qy = Math.abs(p.y - c.cy) - c.hy;
    if (qr <= 0 && qy <= 0) { if (qr > qy) { n.set(ux, 0, uz); return qr; } n.set(0, sy, 0); return qy; }
    const or = Math.max(qr, 0), oy = Math.max(qy, 0), d = Math.hypot(or, oy);
    n.set(ux * or / d, sy * oy / d, uz * or / d); return d;
  }
  n.subVectors(p, c.c); const L = n.length();
  if (L < 1e-6) { n.set(0, 1, 0); return -c.r; }
  n.multiplyScalar(1 / L); return L - c.r;
}
const _n = V();
/* Exact shapes: rocks, cliffs, tree trunks + branches, mushrooms, the stump, the log and the island collide with
   their real triangles (bucketed in a 2 m grid), so paws touch exactly what you see. */
const TRI_CELL = 2, triGrid = new Map(), tris = [];
let triStamp = 0;
const cellKey = (i, j) => i * 4096 + j;
function addMeshCollider(mesh, owner, keep) {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry, p = g.attributes.position, idx = g.index, n = idx ? idx.count : p.count;
  const va = V(), vb = V(), vc = V();
  for (let k = 0; k < n; k += 3) {
    const ia = idx ? idx.getX(k) : k, ib = idx ? idx.getX(k + 1) : k + 1, ic = idx ? idx.getX(k + 2) : k + 2;
    va.fromBufferAttribute(p, ia).applyMatrix4(mesh.matrixWorld); vb.fromBufferAttribute(p, ib).applyMatrix4(mesh.matrixWorld); vc.fromBufferAttribute(p, ic).applyMatrix4(mesh.matrixWorld);
    if (keep && !keep(va, vb, vc)) continue;
    const tri = new THREE.Triangle(va.clone(), vb.clone(), vc.clone()), nrm = V(); tri.getNormal(nrm);
    if (nrm.lengthSq() < .5) continue;   // degenerate sliver
    const t = { tri, n: nrm, owner, stamp: 0,
      minx: Math.min(va.x, vb.x, vc.x), maxx: Math.max(va.x, vb.x, vc.x), miny: Math.min(va.y, vb.y, vc.y), maxy: Math.max(va.y, vb.y, vc.y), minz: Math.min(va.z, vb.z, vc.z), maxz: Math.max(va.z, vb.z, vc.z) };
    tris.push(t);
    for (let i = Math.floor(t.minx / TRI_CELL); i <= Math.floor(t.maxx / TRI_CELL); i++)
      for (let j = Math.floor(t.minz / TRI_CELL); j <= Math.floor(t.maxz / TRI_CELL); j++) { const key = cellKey(i, j); let b = triGrid.get(key); if (!b) triGrid.set(key, b = []); b.push(t); }
  }
}
const _cp = V(), _dv = V(), _pn = V();
// calls fn(t, signedDistance, normal) for every triangle within r of p
function triQuery(p, r, fn) {
  triStamp++;
  for (let i = Math.floor((p.x - r) / TRI_CELL); i <= Math.floor((p.x + r) / TRI_CELL); i++)
    for (let j = Math.floor((p.z - r) / TRI_CELL); j <= Math.floor((p.z + r) / TRI_CELL); j++) {
      const b = triGrid.get(cellKey(i, j)); if (!b) continue;
      for (const t of b) {
        if (t.stamp === triStamp) continue; t.stamp = triStamp;
        if (p.x + r < t.minx || p.x - r > t.maxx || p.y + r < t.miny || p.y - r > t.maxy || p.z + r < t.minz || p.z - r > t.maxz) continue;
        t.tri.closestPointToPoint(p, _cp); _dv.subVectors(p, _cp); const d = _dv.length();
        if (d >= r) continue;
        if (_dv.dot(t.n) < 0) fn(t, -d, t.n);                       // centre slipped behind the surface: push out through the face
        else fn(t, d, d > 1e-6 ? _n.copy(_dv).multiplyScalar(1 / d) : t.n);
      }
    }
}
// push sphere (p, r) out of everything; info collects what it touched
function pushOut(p, r, info) {
  let any = false;
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (let c of colliders) {
      if (p.x + r < c.minx || p.x - r > c.maxx || p.y + r < c.miny || p.y - r > c.maxy || p.z + r < c.minz || p.z - r > c.maxz) continue;
      const d = sdf(c, p, _n);
      if (d < r) {
        if (c.t === 4) c = c.last;
        if (c.pane && glassPush(c, p, _n)) continue;
        p.addScaledVector(_n, r - d); moved = any = true;
        if (info) { info.nrm.add(_n); if (_n.y > 0.6) { info.ground = true; if (c.bounce) info.bounce = c; } info.col = c; }
      }
    }
    let deep = null, dd = r; const dn = _pn;
    triQuery(p, r, (t, d, n) => { if (d < dd) { dd = d; deep = t; dn.copy(n); } });
    if (deep) {
      p.addScaledVector(dn, r - dd); moved = any = true;
      if (info) { info.nrm.add(dn); if (dn.y > 0.6) { info.ground = true; if (deep.owner.bounce) info.bounce = deep.owner; } info.col = deep.owner; }
    }
    if (!moved) break;
  }
  return any;
}
// deepest contact for a paw point: returns {c, d, n} or null
function pawHit(p, R = PAW_R, h) {
  let best = null, bd = R;
  for (const c of colliders) {
    if (c.pane && h && h.glSkip === c.pane && h.glSkipT > tAll) continue;   // just punched through this pane
    if (p.x + R < c.minx || p.x - R > c.maxx || p.y + R < c.miny || p.y - R > c.maxy || p.z + R < c.minz || p.z - R > c.maxz) continue;
    const d = sdf(c, p, _n);
    if (d < bd) { bd = d; best = { c: c.t === 4 ? c.last : c, d, n: _n.clone() }; }
  }
  triQuery(p, R, (t, d, n) => { if (d < bd) { bd = d; best = { c: t.owner, d, n: n.clone() }; } });
  return best;
}

