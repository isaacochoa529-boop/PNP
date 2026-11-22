/* ======================= GLASS: tink it, crack it, smash it, carve it ======================= */
// Each pane is a fixed piece made of convex slabs (one to start). A hit shatters only the bit round it:
// a Voronoi pattern of seeds packed round the hit turns into unique shards (real grabbable pieces), and
// the ring of seeds round that becomes the radial cracks you see in what is left. Anything that ends up
// cut off from the stand falls. A gentle tap just tinks, a firmer one cracks, cracks build up and give way.
const GL_T = .012, GL_TINK = 1.3, GL_BREAK = 3.0, GL_CARVE = 4.2, GL_MAX = 120;
const GL = { panes: [], epoch: 0, glit: null, tkT: 0, bodyP: null, bodyV: V(), told: false };
const GLASS_DEFS = [   // x, z, yaw, width, height: a glass run on the left, a big target pane on the right
  [-2.75, 3.55, Math.PI / 2, 1.0, 1.5], [-3.95, 3.55, Math.PI / 2, 1.0, 1.5], [-5.15, 3.55, Math.PI / 2, 1.0, 1.5], [3.35, 2.3, -.94, 1.4, 1.7]];
const LAB_DEF = [5.3, 4.1, -Math.PI / 2, 1.0, 1.25];   // the Glass Lab pane (its thickness is set on the counter); always the last pane
GLASS_DEFS.push(LAB_DEF);
const _gq = new THREE.Quaternion(), _g1 = V(), _g2 = V(), _g3 = V(), _g4 = V();
const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .04, metalness: .1, envMap: ENV, envMapIntensity: 1.9, transparent: true, depthWrite: false });
glassMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, { uMat: U_MAT, uMatSize: U_MATSZ, uTime: U_TIME });
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + SLOT_GLSL + '\nattribute vec4 orig; attribute float kind; varying vec4 vOrig; varying float vKind;')
    .replace('#include <beginnormal_vertex>', 'mat4 kgM = kgSlot(slot);\n#include <beginnormal_vertex>\nobjectNormal = mat3(kgM) * objectNormal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = (kgM * vec4(transformed, 1.)).xyz; vOrig = orig; vKind = kind;');
  // faint blue-white sheet with soft diagonal shine streaks, brighter at grazing angles; broken edges are thick sea-green
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec4 vOrig; varying float vKind;')
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4(.72, .9, 1., .2);
      bool kgRb = vKind > 11.5;
      if (kgRb) diffuseColor.rgb = .62 + .38 * cos(6.2832 * (vec3(0., .33, .67) + vOrig.x * 1.4 + vOrig.y * .9 + uTime * .15));
      float kgB = abs(fract(vOrig.x * .55 + vOrig.y * .8 + .2) - .5), kgSt = vOrig.w > .5 ? 0. : smoothstep(.07, .0, kgB) * .7 + smoothstep(.018, .0, abs(kgB - .13)) * .5;
      if (vOrig.w > .5) diffuseColor = vec4(kgRb ? diffuseColor.rgb : vec3(.42, .82, .7), .62);`)
    .replace('#include <opaque_fragment>', `{ float kgFr = pow(1. - clamp(abs(dot(normalize(vViewPosition), normal)), 0., 1.), 3.);
      outgoingLight += vec3(.9, .97, 1.) * kgSt * .22 + kgFr * .12; diffuseColor.a = clamp(diffuseColor.a + kgFr * .5 + kgSt * .1 + (kgRb ? .12 : 0.), 0., .92); }
      #include <opaque_fragment>`);
};
glassMat.customProgramCacheKey = () => 'kgGlass';

/* ---------- little 2D helpers (pane-local: x across, y up from the stand, z out of the face) ---------- */
const pArea = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const pCen = P => { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; };
function clipHalf(P, ax, ay, c) {   // keep ax*x + ay*y <= c
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], dp = ax * p[0] + ay * p[1] - c, dq = ax * q[0] + ay * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
function cleanPoly(P) {
  const o = [];
  for (const p of P) { const q = o[o.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 2e-5) o.push(p); }
  while (o.length > 2 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) <= 2e-5) o.pop();
  return o.length >= 3 && pArea(o) > 2e-6 ? o : null;
}
function segD(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1) : 0; return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function inPoly(P, x, y) { for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; if ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) < 0) return false; } return true; }
function polyDist(P, x, y) { if (inPoly(P, x, y)) return 0; let d = 1e9; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; d = Math.min(d, segD(x, y, p[0], p[1], q[0], q[1])); } return d; }
const glassAt = (pane, x, y, m = 0) => pane.polys.some(P => polyDist(P, x, y) <= m);
// a convex outline → a glass slab: faces show the sheet, sides show as edges
function prismPart(poly, T = GL_T) { return prismZ(poly, -T / 2, T / 2); }
function prismZ(poly, z0, z1) {
  const n = poly.length, vis = [], phys = [];
  const put = (x, y, z, nx, ny, nz, cap) => { vis.push(x, y, z, nx, ny, nz, x, y, z, cap, -1e4); phys.push(x, y, z); };
  for (let i = 1; i + 1 < n; i++) {
    const a = poly[0], b = poly[i], c = poly[i + 1];
    put(a[0], a[1], z1, 0, 0, 1, 0); put(b[0], b[1], z1, 0, 0, 1, 0); put(c[0], c[1], z1, 0, 0, 1, 0);
    put(a[0], a[1], z0, 0, 0, -1, 0); put(c[0], c[1], z0, 0, 0, -1, 0); put(b[0], b[1], z0, 0, 0, -1, 0);
  }
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n]; let nx = b[1] - a[1], ny = a[0] - b[0]; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
    put(a[0], a[1], z0, nx, ny, 0, 1); put(b[0], b[1], z0, nx, ny, 0, 1); put(b[0], b[1], z1, nx, ny, 0, 1);
    put(a[0], a[1], z0, nx, ny, 0, 1); put(b[0], b[1], z1, nx, ny, 0, 1); put(a[0], a[1], z1, nx, ny, 0, 1);
  }
  return { vis: new Float32Array(vis), phys: new Float32Array(phys) };
}

/* ---------- the panes: a steel stand with a glass sheet in it ---------- */
const GLASS_K = KINDS.findIndex(k => k.glass && !k.rainbow), RAINBOW_K = KINDS.findIndex(k => k.rainbow);
const glassLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false });
GLASS_DEFS.forEach(([x, z, yaw, W, H], i) => {
  const pane = { i, id: 'gp' + i, W, H, pos: V(x, .05, z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), yaw, kind: GLASS_K,
    polys: [], pc: null, gen: 0, crk: [], shown: 0, dmg: [], seq: [], hitT: -9, tinkT: -9, carveT: -9, side: 0, bTouch: false, T: GL_T, passT: -9, bodyT: -9, trace: null };
  if (i === GLASS_DEFS.length - 1) pane.T = 5 / 1000;
  pane.qi = pane.q.clone().invert(); pane.n = V(0, 0, 1).applyQuaternion(pane.q);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; arena.add(g);
  const steel = smat(0x8a95a3, { metalness: .8, roughness: .3, envMap: ENV, envMapIntensity: 1 }), rubber = smat(0x23272d, { roughness: .9 });
  part(new THREE.BoxGeometry(W + .08, .07, .1), steel, 0, .035, 0, g);
  part(new THREE.BoxGeometry(W + .04, .012, .03), rubber, 0, .076, 0, g);
  [-1, 1].forEach(s => { part(new THREE.BoxGeometry(.05, .02, .32), steel, s * (W / 2 + .01), .01, 0, g); part(new THREE.CylinderGeometry(.018, .018, .05, 10), rubber, s * (W / 2 + .01), .02, s * .13, g); });
  mergeStatic(g);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3000 * 6), 3).setUsage(THREE.DynamicDrawUsage)); geo.setDrawRange(0, 0);
  pane.lines = new THREE.LineSegments(geo, glassLineMat); pane.lines.position.copy(pane.pos); pane.lines.quaternion.copy(pane.q); pane.lines.frustumCulled = false; pane.lines.renderOrder = 2; arena.add(pane.lines);
  GL.panes.push(pane);
  // solid for paws, heads and bodies (collider type 3: its shape is the glass that is left)
  const c = V(x, .05 + H / 2, z).add(ARENA), e = Math.hypot(W / 2, .03) + .02;
  addCol({ t: 3, pane, tag: 'glass', minx: c.x - e, maxx: c.x + e, minz: c.z - e, maxz: c.z + e, miny: c.y - H / 2, maxy: c.y + H / 2 });
});
{ // a little sign at the start of the run
  const sg = new THREE.Group(); sg.position.set(-2.05, 0, 2.75); sg.rotation.y = .5; arena.add(sg);
  const tex = labelTex(512, 200, (g, w, h) => signText(g, w, h, [['🪟 GLASS RUN', 64, '#bfefff', 72], ['tap it · smash it · run through it', 30, '#ffffff', 144]], 'rgba(22,30,44,.92)', '#7fd8ff'));
  const b = new THREE.Mesh(new THREE.PlaneGeometry(.62, .24), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); b.position.set(0, 1.12, .02); sg.add(b);
  part(new THREE.BoxGeometry(.66, .28, .03), smat(0x2b3446, { roughness: .5 }), 0, 1.12, 0, sg);
  part(new THREE.CylinderGeometry(.018, .022, 1, 8), smat(0x8c96a4, { metalness: .6, roughness: .35 }), 0, .5, -.02, sg);
  mergeStatic(sg);
}
pileRepack(16384, GPILE);
function paneBuild(pane) {   // (re)make the pane's fixed piece from its outlines
  if (pane.pc && pane.pc.body) removePiece(pane.pc);
  pane.pc = null; if (!pane.polys.length) return;
  const keepOwn = AR.makeOwn; AR.makeOwn = 'host'; AR.forceId = `${pane.id}.${GL.epoch}.${pane.gen}`;
  const pc = makePiece(pane.kind, pane.polys.map(P => prismPart(P, pane.T)), 0, pane.pos, pane.q, V(), V(), false);
  AR.forceId = null; AR.makeOwn = keepOwn;
  if (!pc) return;
  pc.body.setBodyType(AR.R.RigidBodyType.Fixed, true); pc.pane = pane; pane.pc = pc; pileMatrix(pc);
  // a paw resting on glass that is gone now lets go
  for (const h of hands) if (h.stuck && h.col && h.col.pane === pane) { toPane(pane, _g4.copy(h.sp).sub(ARENA), _g1); if (!glassAt(pane, _g1.x, _g1.y, PAW_R * .4)) h.stuck = false; }
}
function paneFresh(pane) { pane.polys = [[[-pane.W / 2, 0], [pane.W / 2, 0], [pane.W / 2, pane.H], [-pane.W / 2, pane.H]]]; pane.crk = []; pane.shown = 0; pane.dmg = []; pane.seq = []; pane.trace = null; pane.stab = null; pane.galaxy = pane === labPane() && LAB.k === VOID_K; crackGeo(pane); }
function glassReset() {   // fresh panes (the yard's RESET button, or a new room)
  GL.epoch++;
  for (const pane of GL.panes) { paneFresh(pane); pane.gen = 0; pane.kind = GLASS_K; paneBuild(pane); }
}
const toPane = (pane, arenaP, out) => out.copy(arenaP).sub(pane.pos).applyQuaternion(pane.qi);
const toughOf = T => Math.pow(T / .012, 1.5);   // thicker glass is way tougher (3 mm ~0.13x, 35 mm ~5x)

/* ---------- the glass is solid: paws, heads and bodies bump into it (collider type 3) ---------- */
const _g5 = V();
function paneSdf(pane, p, n) {
  _g5.set(p.x - ARENA.x - pane.pos.x, p.y - ARENA.y - pane.pos.y, p.z - ARENA.z - pane.pos.z).applyQuaternion(pane.qi);
  const x = _g5.x, y = _g5.y, z = _g5.z, qz = Math.abs(z) - pane.T / 2, sz = z < 0 ? -1 : 1;
  let best = 1e9, bx = 0, by = 0, bz = 1;
  for (const P of pane.polys) {
    let inside = true, md = 1e9, cx = 0, cy = 0, ex = 0, ey = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      if (dx * (y - a[1]) - dy * (x - a[0]) < 0) inside = false;
      const t = L > 0 ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L, 0, 1) : 0, px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(x - px, y - py);
      if (d < md) { md = d; cx = px; cy = py; const l = Math.sqrt(L) || 1; ex = dy / l; ey = -dx / l; }
    }
    let sd, gx, gy;
    if (inside) { sd = -md; gx = ex; gy = ey; } else { sd = md; gx = md > 1e-9 ? (x - cx) / md : ex; gy = md > 1e-9 ? (y - cy) / md : ey; }
    let d, nx, ny, nz;
    if (sd <= 0 && qz <= 0) { if (sd > qz) { d = sd; nx = gx; ny = gy; nz = 0; } else { d = qz; nx = 0; ny = 0; nz = sz; } }
    else { const ox = Math.max(sd, 0), oz = Math.max(qz, 0); d = Math.hypot(ox, oz); nx = gx * ox / d; ny = gy * ox / d; nz = sz * oz / d; }
    if (d < best) { best = d; bx = nx; by = ny; bz = nz; }
  }
  n.set(bx, by, bz).applyQuaternion(pane.q); return best;
}
// your body against a pane: lean in and it stops you, slam into it hard enough and you burst through
function glassPush(c, p, nrm) {
  if (!GL.bodyCtx) return false;
  const pane = c.pane; if (pane.passT > tAll) return true;
  const vn = Math.max(-state.vel.dot(nrm), -GL.bodyV.dot(nrm));
  if (vn < .5 || tAll - pane.bodyT < .4) return false;
  pane.bodyT = tAll;
  toPane(pane, _g4.copy(p).sub(ARENA), _g1);
  const tf = toughOf(pane.T), vW = V().copy(nrm).multiplyScalar(-vn);
  let r;
  if (vn >= 2.4 * tf) r = glassHit(pane, clamp(_g1.x, -pane.W / 2 + .02, pane.W / 2 - .02), clamp(_g1.y, .35, pane.H - .25), vn * 1.5, vW, { through: true, R: .23, sy: 1.8 });
  else r = glassHit(pane, _g1.x, _g1.y, vn * 1.2, vW);
  if (r === 'break') { pane.passT = tAll + .45; return true; }
  return false;
}
// a paw lands on a pane: tap = tink, smack = crack, punch = smash (and the paw goes through)
function glassPaw(h, hit, p, speed) {
  const pane = hit.c.pane;
  if (h.glP === pane && tAll - h.glT < .15) { h.glT = tAll; return false; }   // still in contact
  h.glT = tAll; h.glP = pane;
  toPane(pane, _g4.copy(p).sub(ARENA), _g1);
  const vW = V().copy(hit.n).multiplyScalar(-speed);
  const r = glassHit(pane, _g1.x, _g1.y, speed, vW, { Rk: pane.T <= .0011 ? 2.5 : 1 });   // ultra-thin glass: punched holes are BIG
  buzz(h, r === 'break' ? 1 : r === 'crack' ? .7 : .25, r === 'break' ? 60 : 20);
  if (r === 'break') { h.glSkip = pane; h.glSkipT = tAll + .3; return true; }
  return false;
}

/* ---------- cracks: thin bright lines that race out from the hit ---------- */
function crackGeo(pane) {
  const a = pane.lines.geometry.attributes.position, P = a.array, C = pane.crk, n = Math.min(C.length / 4, 3000);
  for (let i = 0; i < n; i++) P.set([C[i * 4], C[i * 4 + 1], 0, C[i * 4 + 2], C[i * 4 + 3], 0], i * 6);
  a.needsUpdate = true; pane.shown = Math.min(pane.shown, n); pane.lines.geometry.setDrawRange(0, Math.floor(pane.shown) * 2);
}
function addCracks(pane, segs) {
  pane.crk.push(...segs);
  if (pane.crk.length > 3000 * 4) { const cut = pane.crk.length - 3000 * 4; pane.crk.splice(0, cut); pane.shown = Math.max(0, pane.shown - cut / 4); }
  crackGeo(pane);
}
const onGlass = (pane, x, y) => pane.polys.some(P => polyDist(P, x, y) < 2e-3);
function makeCracks(pane, hx, hy, s) {   // s 0..1: how hard
  const out = [], R = Math.random;
  const grow = (x, y, a, L, depth) => {
    let d = 0;
    while (d < L) {
      const st = .015 + R() * .02; a += (R() - .5) * .55;
      const nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
      if (!onGlass(pane, nx, ny) || !onGlass(pane, (x + nx) / 2, (y + ny) / 2)) break;   // cracks stop at an edge or a hole
      out.push(x, y, nx, ny); x = nx; y = ny; d += st;
      if (depth < 1 && R() < .1) grow(x, y, a + (R() < .5 ? -1 : 1) * (.5 + R() * .5), (L - d) * .55, depth + 1);
    }
  };
  const n = 3 + Math.floor(s * 4 + R() * 2), a0 = R() * 6.28;
  for (let k = 0; k < n; k++) grow(hx, hy, a0 + (k + (R() - .5) * .7) * 6.2832 / n, (.05 + .3 * s) * (.6 + .6 * R()), 0);
  if (s > .4) {   // a little spider-web ring round the middle
    const r0 = .02 + .035 * s, m = 9 + Math.floor(R() * 4);
    for (let k = 0; k < m; k++) { if (R() < .3) continue; const a = a0 + k / m * 6.2832, b = a0 + (k + 1) / m * 6.2832, r1 = r0 * (.85 + R() * .3), r2 = r0 * (.85 + R() * .3);
      const x1 = hx + Math.cos(a) * r1, y1 = hy + Math.sin(a) * r1, x2 = hx + Math.cos(b) * r2, y2 = hy + Math.sin(b) * r2;
      if (onGlass(pane, x1, y1) && onGlass(pane, x2, y2)) out.push(x1, y1, x2, y2); }
  }
  // closest first, so they visibly race outward as they draw in
  const idx = []; for (let i = 0; i < out.length; i += 4) idx.push(i);
  idx.sort((i, j) => Math.hypot(out[i] - hx, out[i + 1] - hy) - Math.hypot(out[j] - hx, out[j + 1] - hy));
  const sorted = []; for (const i of idx) sorted.push(out[i], out[i + 1], out[i + 2], out[i + 3]);
  return sorted.map(v => Math.round(v * 1e4) / 1e4);
}
function tidyCracks(pane) {   // only where glass is still standing: both ends and the middle on glass
  const C = pane.crk, keep = [];
  for (let i = 0; i < C.length; i += 4) if (onGlass(pane, C[i], C[i + 1]) && onGlass(pane, C[i + 2], C[i + 3]) && onGlass(pane, (C[i] + C[i + 2]) / 2, (C[i + 1] + C[i + 3]) / 2)) keep.push(C[i], C[i + 1], C[i + 2], C[i + 3]);
  pane.crk = keep; pane.shown = Math.min(pane.shown, keep.length / 4); crackGeo(pane);
}

/* ---------- breaking ---------- */
function glassSeeds(x, y, R, sy = 1) {
  const R0 = Math.random, s = [x + (R0() - .5) * R * .15, y + (R0() - .5) * R * .15 * sy, 1];
  const N = clamp(Math.round(5 + R * 40 * Math.sqrt(sy)), 5, 22), minD = R * .95 / Math.sqrt(N);
  for (let t = 0; t < 500 && s.length / 3 < N; t++) {
    const r = R * Math.pow(R0(), .7), a = R0() * 6.2832, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * sy, need = minD * (.45 + .8 * r / R);
    let ok = true; for (let i = 0; i < s.length; i += 3) if (Math.hypot(s[i] - px, (s[i + 1] - py) / sy) < need) { ok = false; break; }
    if (ok) s.push(px, py, 1);
  }
  const M = clamp(Math.round(6 + R * 12), 6, 11), a0 = R0() * 6.2832;   // the ring round the hole: its cells stay up, split by radial cracks
  for (let k = 0; k < M; k++) { const a = a0 + (k + (R0() - .5) * .6) * 6.2832 / M, r = R * (1.45 + R0() * .4); s.push(x + Math.cos(a) * r, y + Math.sin(a) * r * sy, 0); }
  return s.map(v => Math.round(v * 1e5) / 1e5);
}
function voronoi(P, seeds, i) {
  let cell = P; const sx = seeds[i], sy = seeds[i + 1], s2 = sx * sx + sy * sy;
  for (let j = 0; j < seeds.length && cell.length >= 3; j += 3) { if (j === i) continue; const tx = seeds[j], ty = seeds[j + 1]; cell = clipHalf(cell, tx - sx, ty - sy, (tx * tx + ty * ty - s2) / 2); }
  return cell.length >= 3 ? cleanPoly(cell) : null;
}
// long shards split along a radial line through the hit: glass breaks into pointy slivers
function sliver(shards, hx, hy) {
  const bits = [];
  for (const S of shards) {
    const c = pCen(S), dx = c[0] - hx, dy = c[1] - hy, d = Math.hypot(dx, dy), A = Math.abs(pArea(S));
    if (A > .0035 && d > 1e-3) {
      const ang = Math.atan2(dy, dx) + hsh(c[0], c[1], 0, 7) * .5, nx = -Math.sin(ang), ny = Math.cos(ang), cc = nx * hx + ny * hy;
      const a = cleanPoly(clipHalf(S, nx, ny, cc)), b = cleanPoly(clipHalf(S, -nx, -ny, -cc));
      if (a && b) { bits.push(a, b); continue; }
    }
    bits.push(S);
  }
  return bits;
}
// a loose bit of glass from outlines in some frame (pane or piece): frame = { pos, q, kind, z0, z1 }
function glassPiece(fr, poly, id, vW, avW) {
  const polys = Array.isArray(poly[0][0]) ? poly : [poly];
  const c = childOf(polys.map(P => prismZ(P, fr.z0, fr.z1))); if (!c.parts.length || c.vol < 2e-7) return null;
  for (const p of c.parts) { shiftSoup(p.phys, 3, c.c); shiftSoup(p.vis, VS, c.c); p.hull = null; }
  const pos = c.c.clone().applyQuaternion(fr.q).add(fr.pos);
  AR.forceId = id; const pc = makePiece(fr.kind, c.parts, c.vol, pos, fr.q.clone(), vW, avW, false); AR.forceId = null;
  if (pc) { pc.cool = .12; pc.gT = fr.z1 - fr.z0; }
  return pc;
}
const paneFrame = pane => ({ pos: pane.pos, q: pane.q, kind: pane.kind, z0: -pane.T / 2, z1: pane.T / 2 });
function touching(A, B) {   // do two outlines share a stretch of edge (not just a corner)?
  const pts = [], on = (p, Q) => { for (let i = 0; i < Q.length; i++) { const q = Q[i], r = Q[(i + 1) % Q.length]; if (segD(p[0], p[1], q[0], q[1], r[0], r[1]) < 4e-5) return true; } return false; };
  for (const p of A) if (on(p, B)) pts.push(p);
  for (const p of B) if (on(p, A)) pts.push(p);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) > 1e-3) return true;
  return false;
}
// connected groups of outlines (labels: outlines on different sides of a carve never hold on to each other)
function glassGroups(polys, labels, anchored) {
  const n = polys.length, box = polys.map(P => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of P) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return [x0, y0, x1, y1]; });
  const adj = polys.map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = box[i], b = box[j]; if (a[0] > b[2] + 1e-4 || b[0] > a[2] + 1e-4 || a[1] > b[3] + 1e-4 || b[1] > a[3] + 1e-4) continue;
    if (labels && labels[i] !== labels[j]) continue;
    if (touching(polys[i], polys[j])) { adj[i].push(j); adj[j].push(i); }
  }
  const grp = new Int32Array(n).fill(-1), q = [];
  if (anchored) { for (let i = 0; i < n; i++) if (box[i][1] < 1e-4) { grp[i] = 0; q.push(i); } while (q.length) { const i = q.pop(); for (const j of adj[i]) if (grp[j] < 0) { grp[j] = 0; q.push(j); } } }
  let g = 0;
  for (let i = 0; i < n; i++) if (grp[i] < 0) { g++; grp[i] = g; q.push(i); while (q.length) { const k = q.pop(); for (const j of adj[k]) if (grp[j] < 0) { grp[j] = g; q.push(j); } } }
  const out = []; for (let k = 0; k <= g; k++) out.push(polys.filter((_, i) => grp[i] === k));
  return out;   // out[0] = held by the stand (when anchored)
}
// whatever no longer reaches the stand (through other glass) falls off as a loose chunk
function paneSettle(pane, polys, vW, push, labels) {
  const gs = glassGroups(polys, labels, true);
  pane.polys = gs[0];
  pane.gen++; paneBuild(pane); tidyCracks(pane);
  const fr = paneFrame(pane);
  for (let k = 1; k < gs.length; k++) { if (!gs[k].length) continue; const v = V().copy(vW).multiplyScalar(.3).addScaledVector(pane.n, push * .25); glassPiece(fr, gs[k], `${pane.id}.${GL.epoch}.${pane.gen}c${k}`, v, V((Math.random() - .5) * .6, (Math.random() - .5) * .6, (Math.random() - .5) * .6)); }
  return gs.length - 1;
}
function flyShards(fr, bits, hx, hy, R, vW, base, idp, normal, push) {
  const sp = vW.length(); let made = 0;
  bits.forEach((S, k) => {
    const c = pCen(S), A = Math.abs(pArea(S)), w = _g1.set(c[0] - hx, c[1] - hy, 0), r = w.length(); if (r > 1e-4) w.multiplyScalar(1 / r);
    const wp = fr.pos.clone().add(_g2.set(c[0], c[1], 0).applyQuaternion(fr.q));
    if (A < 1.6e-4) { glitBurst(wp, 2, vW); return; }   // crumbs too small to hold: just glitter
    w.applyQuaternion(fr.q);
    const v = V().copy(base).add(_g3.copy(vW).multiplyScalar(.25 + .45 * Math.random() * Math.max(0, 1 - r / (R * 2))))
      .addScaledVector(w, (.25 + Math.random() * .9) * Math.min(1, .4 + sp * .12)).addScaledVector(normal, push * (.15 + Math.random() * .5)); v.y += Math.random() * .6;
    if (glassPiece(fr, S, idp + k, v, V((Math.random() - .5) * 14, (Math.random() - .5) * 14, (Math.random() - .5) * 14))) made++;
  });
  return made;
}
function paneShatter(pane, hx, hy, R, seeds, vW, sy = 1) {
  if (pane.galaxy) { pane.galaxy = false; sfxVoidBreak(); }
  const keep = [], shards = [], seamSegs = [], reach = R * Math.max(1, sy) * 2;
  for (const P of pane.polys) {
    if (polyDist(P, hx, hy) > reach) { keep.push(P); continue; }
    for (let i = 0; i < seeds.length; i += 3) {
      const cell = voronoi(P, seeds, i); if (!cell) continue;
      if (seeds[i + 2]) shards.push(cell);
      else {
        keep.push(cell);
        for (let e = 0; e < cell.length; e++) { const a = cell[e], b = cell[(e + 1) % cell.length], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;   // new edges inside the old glass = cracks
          let inner = true; for (let k = 0; k < P.length; k++) { const p = P[k], q = P[(k + 1) % P.length]; if (segD(mx, my, p[0], p[1], q[0], q[1]) < 1e-4) { inner = false; break; } }
          if (inner) seamSegs.push(a[0], a[1], b[0], b[1]); }
      }
    }
  }
  const bits = sliver(shards, hx, hy);
  const idx = []; for (let i = 0; i < seamSegs.length; i += 4) idx.push(i);
  idx.sort((i, j) => Math.hypot(seamSegs[i] - hx, seamSegs[i + 1] - hy) - Math.hypot(seamSegs[j] - hx, seamSegs[j + 1] - hy));
  const segs = []; for (const i of idx) segs.push(seamSegs[i], seamSegs[i + 1], seamSegs[i + 2], seamSegs[i + 3]);
  const push = Math.sign(vW.dot(pane.n)) || 1;
  pane.crk.push(...segs);
  const loose = paneSettle(pane, keep, vW, push);
  // the shards fly: carried along by whatever hit, spraying out from the middle
  const made = flyShards(paneFrame(pane), bits, hx, hy, R, vW, V(), `${pane.id}.${GL.epoch}.${pane.gen}s`, pane.n, push);
  glitBurst(pane.pos.clone().add(_g2.set(hx, hy, 0).applyQuaternion(pane.q)), 26 + Math.min(40, made * 2), vW);
  sfxShatter(clamp(R / .35 + .3, .35, 1)); if (loose) sfxCrack(.8);
  pane.dmg = pane.dmg.filter(d => Math.hypot(d[0] - hx, d[1] - hy) > R * 1.4);
  glassCap();
  return made;
}
// the sword scores along a path (a straight line, or the curve you dragged) and the glass snaps along it
function paneHole(pane, hx, hy, r, vW) {   // a clean round hole: the disc pops out as one plug
  const N = 18, H = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; H.push([hx + Math.cos(a) * r, hy + Math.sin(a) * r]); }
  const E = H.map((p, i) => { const q = H[(i + 1) % N], nx = q[1] - p[1], ny = -(q[0] - p[0]), L = Math.hypot(nx, ny); return [nx / L, ny / L, (nx * p[0] + ny * p[1]) / L]; });   // outward edge normals
  const out = [], labels = []; let hit = false;
  for (const P of pane.polys) {
    if (polyDist(P, hx, hy) > r) { out.push(P); labels.push(1); continue; }
    let rest = P;
    for (let i = 0; i < N && rest; i++) {
      const [nx, ny, c] = E[i], outside = cleanPoly(clipHalf(rest, -nx, -ny, -c));
      if (outside) { out.push(outside); labels.push(1); }
      rest = cleanPoly(clipHalf(rest, nx, ny, c));
    }
    if (rest) { out.push(rest); labels.push(2); hit = true; }
  }
  if (!hit) return 0;
  const push = Math.sign(vW.dot(pane.n)) || 1;
  pane.dmg = pane.dmg.filter(d => Math.hypot(d[0] - hx, d[1] - hy) > r * 1.5);
  paneSettle(pane, out, vW, push, labels);
  glitBurst(pane.pos.clone().add(_g2.set(hx, hy, 0).applyQuaternion(pane.q)), 24, vW); sfxGlassCarve(); sfxCrack(.5);
  glassCap(); return 1;
}
function chainCut(polys, pts) {
  const out = [], labels = [], lines = [], bis = [];
  for (let j = 0; j + 1 < pts.length; j++) { const dx = pts[j + 1][0] - pts[j][0], dy = pts[j + 1][1] - pts[j][1], L = Math.hypot(dx, dy) || 1; lines.push([-dy / L, dx / L, (-dy * pts[j][0] + dx * pts[j][1]) / L, dx / L, dy / L]); }
  for (let j = 1; j < lines.length; j++) { let tx = lines[j - 1][3] + lines[j][3], ty = lines[j - 1][4] + lines[j][4]; const L = Math.hypot(tx, ty); if (L < .3) return null; tx /= L; ty /= L; bis.push([tx, ty, tx * pts[j][0] + ty * pts[j][1]]); }
  let hit = false;
  for (const P of polys) {
    let rem = P;
    for (let j = 0; j < lines.length && rem; j++) {
      let slab = rem;
      if (j < bis.length) { const [tx, ty, c] = bis[j]; slab = cleanPoly(clipHalf(rem, tx, ty, c)); rem = cleanPoly(clipHalf(rem, -tx, -ty, -c)); } else rem = null;
      if (!slab) continue;
      const [nx, ny, d] = lines[j], a = cleanPoly(clipHalf(slab, nx, ny, d)), b = cleanPoly(clipHalf(slab, -nx, -ny, -d));
      if (a && b) hit = true;
      if (a) { out.push(a); labels.push(1); } if (b) { out.push(b); labels.push(2); }
    }
  }
  return hit ? { out, labels } : null;
}
function paneCarvePath(pane, pts, vW) {
  const r = chainCut(pane.polys, pts); if (!r) return 0;
  // a bright scratch along the cut, stretched to wherever the glass is
  const segs = [], ext = (a, b, k) => [a[0] + (a[0] - b[0]) * k, a[1] + (a[1] - b[1]) * k];
  const P = [ext(pts[0], pts[1], 4 / Math.max(.01, Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]))), ...pts, ext(pts[pts.length - 1], pts[pts.length - 2], 4 / Math.max(.01, Math.hypot(pts[pts.length - 1][0] - pts[pts.length - 2][0], pts[pts.length - 1][1] - pts[pts.length - 2][1])))];
  for (let j = 0; j + 1 < P.length; j++) { const L = Math.hypot(P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1]), n = Math.max(1, Math.ceil(L / .03)); for (let k = 0; k < n; k++) segs.push(P[j][0] + (P[j + 1][0] - P[j][0]) * k / n, P[j][1] + (P[j + 1][1] - P[j][1]) * k / n, P[j][0] + (P[j + 1][0] - P[j][0]) * (k + 1) / n, P[j][1] + (P[j + 1][1] - P[j][1]) * (k + 1) / n); }
  pane.crk.push(...segs);
  const push = Math.sign(vW.dot(pane.n)) || 1;
  const loose = paneSettle(pane, r.out, vW, push, r.labels);
  const m = pts[Math.floor(pts.length / 2)], mid = pane.pos.clone().add(_g2.set(m[0], m[1], 0).applyQuaternion(pane.q));
  glitBurst(mid, 30, vW); sfxGlassCarve(); if (loose) sfxCrack(1);
  glassCap();
  return 1;
}
function paneCarve(pane, nx, ny, d, vW) { return paneCarvePath(pane, [[nx * d + ny, ny * d - nx], [nx * d - ny, ny * d + nx]], vW); }
function glassCap() {   // keep it smooth: past GL_MAX loose bits, the oldest of yours quietly vanish
  const mineG = AR.pieces.filter(p => KINDS[p.kind].glass && !p.pane && !p.dying && !p.held && mine(p));
  if (mineG.length <= GL_MAX) return;
  mineG.sort((a, b) => a.born - b.born); const gone = mineG.slice(0, mineG.length - GL_MAX);
  gone.forEach(p => { p.dying = .3; }); sendKill(gone);
}
/* ---------- loose glass smashes when it crashes into something ---------- */
function hull2(pts) {   // convex hull of 2D points (monotone chain), counter-clockwise
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const lo = [], hi = [], cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-12) hi.pop(); hi.push(p); }
  lo.pop(); hi.pop(); return cleanPoly(lo.concat(hi));
}
function pieceOutlines(pc) {   // a glass piece's slab outlines, in its own frame (its z is the glass's thickness)
  let z0 = 1e9, z1 = -1e9; const polys = [];
  for (const p of pc.parts) { const h = p.hull, pts = []; for (let i = 0; i < h.length; i += 3) { pts.push([h[i], h[i + 1]]); z0 = Math.min(z0, h[i + 2]); z1 = Math.max(z1, h[i + 2]); } const P = hull2(pts); if (P) polys.push(P); }
  return { polys, z0, z1 };
}
function pieceShatter(pc, hx, hy, R, seeds, vW) {
  if (!pc.body) return 0;
  const o = pieceOutlines(pc), t = pc.body.translation(), r = pc.body.rotation(), lv = pc.body.linvel();
  const fr = { pos: V(t.x, t.y, t.z), q: new THREE.Quaternion(r.x, r.y, r.z, r.w), kind: pc.kind, z0: o.z0, z1: o.z1 };
  const keep = [], shards = [];
  for (const P of o.polys) for (let i = 0; i < seeds.length; i += 3) { const cell = voronoi(P, seeds, i); if (cell) (seeds[i + 2] ? shards : keep).push(cell); }
  removePiece(pc);
  const base = V(lv.x, lv.y, lv.z).multiplyScalar(.35), id = pc.id;
  glassGroups(keep, null, false).forEach((g, k) => { if (g.length) glassPiece(fr, g, `${id}~c${k}`, base.clone(), V((Math.random() - .5) * 3, (Math.random() - .5) * 3, (Math.random() - .5) * 3)); });
  const made = flyShards(fr, sliver(shards, hx, hy), hx, hy, R, vW, base, `${id}~s`, V(0, 0, 1).applyQuaternion(fr.q), 0);
  glitBurst(fr.pos.clone().add(_g2.set(hx, hy, 0).applyQuaternion(fr.q)), 20 + Math.min(30, made * 2), vW);
  sfxShatter(clamp(R / .3, .3, .9)); glassCap();
  return made;
}

/* ---------- one hit on the glass: tink, crack or smash ---------- */
const TINK_NOTES = [1568, 1760, 2093, 2349, 2637, 3136, 3520];
function glassHit(pane, x, y, s, vW, opt = {}) {
  if (!glassAt(pane, x, y, .01)) return 'miss';
  x = clamp(x, -pane.W / 2, pane.W / 2); y = clamp(y, 0, pane.H);
  if (pane.galaxy && !opt.entity) {   // THE VOID: nothing you have can break it
    if (tAll - pane.tinkT > .12) { pane.tinkT = tAll; if (ac) { tone('sine', 110, 70, .5, .14); tone('triangle', 1760, 1700, .3, .04, .02); } glitBurst(pane.pos.clone().add(_g2.set(x, y, 0).applyQuaternion(pane.q)), 6, V()); }
    return 'tink';
  }
  const fox = pane.T >= .07 && !opt.entity, wisp = pane.T <= .0011;
  if (wisp && s > 0) opt = Object.assign({}, opt, { through: true });   // 1 mm and thinner: ANY touch breaks it
  const tf = toughOf(pane.T), TK = fox ? 4 : GL_TINK * Math.sqrt(tf), BR = fox ? Infinity : Math.max(GL_BREAK * tf, TK * 1.15);
  if (s < TK && !opt.through) {
    if (tAll - pane.tinkT < .09) return 'tink'; pane.tinkT = tAll;
    const z = clamp(Math.floor(y / pane.H * 7), 0, 6); sfxTink(TINK_NOTES[z] / Math.sqrt(tf), clamp(.08 + s / tf * .12, .08, .25));
    glitBurst(pane.pos.clone().add(_g2.set(x, y, 0).applyQuaternion(pane.q)), 2, V());
    // secret: tink five notes going up the pane, low to high
    pane.seq = pane.seq.filter(e => tAll - e[1] < 3); pane.seq.push([z, tAll]);
    if (pane.kind !== RAINBOW_K && pane.seq.length >= 5) { const t = pane.seq.slice(-5); if (t.every((e, i) => !i || e[0] > t[i - 1][0])) { pane.seq = []; paneRainbow(pane); netSend({ t: 'gl', op: 'rb', i: pane.i }); } }
    return 'tink';
  }
  if (tAll - pane.hitT < .12 && !opt.through) return 'cool'; pane.hitT = tAll;
  let near = 0; for (const d of pane.dmg) if (Math.hypot(d[0] - x, d[1] - y) < .14) near += d[2];
  const k = clamp((s - TK) / (BR - TK), 0, 1);
  if (s >= BR || near + k > 1.3 || (fox && near > 1.3) || opt.through) {
    const R = Math.min(.6, (opt.R || clamp(.07 + (Math.min(s, 20) - TK) * .04 / Math.sqrt(tf) + (opt.size || 0), .07, .4)) * (opt.Rk || 1)), sy = opt.sy || 1;
    const seeds = glassSeeds(x, y, R, sy);
    paneShatter(pane, x, y, R, seeds, vW, sy);
    netSend({ t: 'gl', op: 'brk', i: pane.i, x, y, R, sy, s: seeds, v: va(vW) });
    if (!GL.told) { GL.told = true; toast('💥 SMASH! Grab the shards, they are real pieces. Tap gently to just tink.', 6); }
    return 'break';
  }
  const segs = makeCracks(pane, x, y, k);
  const dm = fox ? .045 : (.35 + k * .6) / Math.max(1, Math.pow(tf, .8));   // fox-proof: about 30 hard punches in the same spot   // tough glass shrugs off each crack: it takes many more hits
  pane.dmg.push([x, y, dm]); addCracks(pane, segs); sfxCrack(.4 + k * .6);
  glitBurst(pane.pos.clone().add(_g2.set(x, y, 0).applyQuaternion(pane.q)), 4, vW);
  netSend({ t: 'gl', op: 'crk', i: pane.i, x, y, d: dm, c: segs });
  return 'crack';
}
function paneRainbow(pane) {
  pane.kind = RAINBOW_K; pane.gen++; paneBuild(pane);
  const p = pane.pos.clone().add(V(0, pane.H / 2, 0)); confetti(V().copy(p).add(ARENA), 40, [0xff4f6d, 0xffd84f, 0x5fd94a, 0x3fb2ff, 0x9a6bff]);
  if (ac) [1568, 1976, 2349, 3136, 3951].forEach((f, i) => tone('sine', f, f, .5, .12, i * .07));
}
function glassNet(d) {
  if (!AR.ready) return;
  const keep = AR.makeOwn; AR.makeOwn = d.from;
  quietIfAway(() => {
    if (d.op === 'pbrk') { const pc = AR.byId.get(d.id); if (pc) pieceShatter(pc, d.x, d.y, d.R, d.s, V(...d.v)); return; }
    if (d.op === 'thk') { labSet(d.k, true); return; }
    const pane = GL.panes[d.i]; if (!pane) return;
    if (d.op === 'stm') { steamBurst(pane.pos.clone().add(_g2.set(d.x, d.y, 0).applyQuaternion(pane.q)), pane.n, d.k >= 2 ? 70 : 3 + Math.round(d.k * 6), d.k >= 2 ? 1.7 : .4 + d.k); sfxHiss(d.k >= 2 ? 1.4 : .3 + d.k * .6); return; }
    if (d.op === 'brk') paneShatter(pane, d.x, d.y, d.R, d.s, V(...d.v), d.sy || 1);
    else if (d.op === 'crk') { addCracks(pane, d.c); pane.dmg.push([d.x, d.y, d.d]); sfxCrack(.6); }
    else if (d.op === 'cut') paneCarve(pane, d.n[0], d.n[1], d.d, V(...d.v));
    else if (d.op === 'cutp') paneCarvePath(pane, d.p, V(...d.v));
    else if (d.op === 'hole') paneHole(pane, d.x, d.y, d.r, V(...d.v));
    else if (d.op === 'rb') paneRainbow(pane);
  });
  AR.makeOwn = keep;
}
function glassSnap() { return { t: 'gls', ep: GL.epoch, lab: LAB.k, panes: GL.panes.map(p => ({ k: p.kind, g: p.gen, polys: p.polys, c: p.crk, dm: p.dmg })) }; }
function glassFromSnap(d) {
  GL.epoch = d.ep; if (d.lab !== undefined) { LAB.k = d.lab; labPane().T = LAB_T[LAB.k] / 1000; labDraw(); }
  d.panes.forEach((s, i) => { const p = GL.panes[i]; if (!p) return; p.kind = s.k; p.gen = s.g; p.polys = s.polys; p.crk = s.c || []; p.dmg = s.dm || []; p.shown = p.crk.length / 4; p.galaxy = p === labPane() && LAB.k === VOID_K && p.polys.length === 1; crackGeo(p); paneBuild(p); });
}

/* ---------- the GLASS LAB: how tough is it? set the thickness with + and − ---------- */
const LAB_T = [.5, 1, 3, 5, 8, 12, 18, 25, 35, 80, 80], LAB_NAMES = ['STEP-CRACK', 'ULTRA FRAGILE', 'SUPER FRAGILE', 'FRAGILE', 'THIN', 'NORMAL', 'THICK', 'TOUGH', 'BULLETPROOF', 'FOX-PROOF 🦊', '∞ THE VOID ∞'];
const VOID_K = LAB_T.length - 1, LAB_MAX = VOID_K - 1;   // the last one is hidden
const LAB = { k: 3, tex: null, draw: null, mash: [] };
const labPane = () => GL.panes[GL.panes.length - 1];
function labDraw() { if (LAB.draw) LAB.draw(); }
function labSet(k, fromNet) {
  if (!fromNet && k > LAB_MAX) {
    if (LAB.k !== LAB_MAX) k = LAB.k === VOID_K ? VOID_K : LAB_MAX;
    else {   // mashing + on the last one...
      LAB.mash = LAB.mash.filter(t => tAll - t < 2.2); LAB.mash.push(tAll);
      if (LAB.mash.length < 6) k = LAB_MAX;
      else { LAB.mash = []; k = VOID_K; if (!state.secrets.has('void')) toast('🌌 ...something opened.  (Secret found!)', 4); state.secrets.add('void'); }
    }
  }
  k = clamp(k, 0, VOID_K);
  if (k === LAB.k && !fromNet) { if (ac) tone('square', 160, 120, .08, .05); return; }
  LAB.k = k; const pane = labPane(); pane.T = LAB_T[k] / 1000;
  paneFresh(pane); pane.gen++; paneBuild(pane); labDraw();
  if (!fromNet) netSend({ t: 'gl', op: 'thk', k });
  glitBurst(pane.pos.clone().add(V(0, pane.H / 2, 0)), 14, V());
  if (ac) { const f = 420 + k * 90; tone('triangle', f, f * 1.25, .12, .12); tone('sine', 2600 / Math.sqrt(toughOf(pane.T)), 2580, .4, .06, .05); }
}
{
  const [x, z, yaw, W, H] = LAB_DEF, pane = labPane(); pane.T = LAB_T[LAB.k] / 1000;
  const cx = x - .75, cz = z + 1.05, g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = Math.atan2(AR_SPAWN.x - cx, AR_SPAWN.z - cz) * .6 + yaw * .4; arena.add(g);
  const body = smat(0x4a3f6e, { roughness: .45, metalness: .35, envMap: ENV, envMapIntensity: .5 }), dark = smat(0x1e2633, { roughness: .5 }), steel = new THREE.MeshStandardMaterial({ color: 0xc9d2dc, metalness: 1, roughness: .25, envMap: ENV });
  part(new THREE.BoxGeometry(.62, .28, .36), body, 0, .16, 0, g);
  part(new THREE.BoxGeometry(.66, .03, .4), dark, 0, .315, 0, g);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => part(new THREE.CylinderGeometry(.03, .035, .03, 12), dark, a * .27, .015, b * .15, g));
  // the counter: a screen on a stalk behind the buttons
  part(new THREE.CylinderGeometry(.016, .02, .42, 10), steel, 0, .5, -.13, g);
  part(new THREE.BoxGeometry(.56, .3, .04), dark, 0, .82, -.14, g);
  const c = document.createElement('canvas'); c.width = 512; c.height = 272; const cg = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.52, .276), new THREE.MeshBasicMaterial({ map: tex })); scr.position.set(0, .82, -.118); g.add(scr);
  LAB.draw = () => {
    const k = LAB.k, hue = 200 - k * 22;
    cg.fillStyle = k === VOID_K ? '#05030c' : '#0d1420'; cg.fillRect(0, 0, 512, 272);
    if (k === VOID_K) for (let i = 0; i < 70; i++) { cg.fillStyle = ['#7df9ff', '#b48cff', '#5cffb0', '#ffffff'][i % 4]; cg.fillRect((i * 97) % 512, (i * 57) % 272, 2, 2); }
    cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.font = '34px "Lilita One", Impact, sans-serif'; cg.fillStyle = '#9fe8ff'; cg.fillText('🧪 GLASS LAB · THICKNESS', 256, 34);
    cg.font = '96px "Lilita One", Impact, sans-serif'; cg.fillStyle = '#ffffff'; cg.fillText(k === VOID_K ? '??? mm' : LAB_T[k] + ' mm', 256, 112);
    cg.font = '40px "Lilita One", Impact, sans-serif'; cg.fillStyle = `hsl(${hue},90%,62%)`; cg.fillText(LAB_NAMES[k], 256, 180);
    for (let i = 0; i <= LAB_MAX; i++) { cg.fillStyle = k === VOID_K ? '#3b1d6e' : i <= k ? `hsl(${200 - i * 22},85%,58%)` : '#2a3446'; cg.beginPath(); cg.roundRect(36 + i * 45, 218, 37, 30, 8); cg.fill(); }
    tex.needsUpdate = true;
  };
  labelFns.push(LAB.draw); LAB.draw();
  [['−', 0xff9a3c, '#ffc07a', -.15, 2], ['+', 0x36e0c0, '#6fffe0', .15, 3]].forEach(([name, col, css, bx, i]) => {
    part(new THREE.CylinderGeometry(.085, .092, .03, 28), dark, bx, .345, 0, g);
    const ring = part(new THREE.TorusGeometry(.08, .009, 8, 36), steel, bx, .36, 0, g); ring.rotation.x = Math.PI / 2;
    const cap = new THREE.Group(); cap.position.set(bx, .36, 0); g.add(cap);
    const cm = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, roughness: .25, envMap: ENV, envMapIntensity: .6 });
    part(new THREE.CylinderGeometry(.066, .068, .028, 28), cm, 0, .014, 0, cap);
    const dome = part(new THREE.SphereGeometry(.066, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), cm, 0, .028, 0, cap); dome.scale.y = .38;
    const t2 = labelTex(128, 128, (q, w, h) => { q.fillStyle = '#ffffff'; q.font = 'bold 110px Arial, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(name, w / 2, h / 2 + 6); });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(.07, .07), new THREE.MeshBasicMaterial({ map: t2, transparent: true })); lab.rotation.x = -Math.PI / 2; lab.position.set(0, .04, 0); cap.add(lab);
    const fl = labelTex(256, 96, (q, w, h) => signText(q, w, h, [[name === '+' ? 'TOUGHER' : 'WEAKER', 44, css, 50]], 'rgba(14,20,30,.95)', css));
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(.17, .064), new THREE.MeshBasicMaterial({ map: fl, transparent: true })); fp.position.set(bx, .2, .183); g.add(fp);
    buttons.push({ i, cap, cm, top: V(), down: 0, g });
  });
  mergeStatic(g, q => buttons.some(b => b.cap === q) || q === scr);
  g.updateMatrixWorld(true);
  buttons.forEach(b => { if (b.i >= 2) { b.cap.getWorldPosition(b.top); b.top.y += .04; } });
  addCol({ t: 0, x: ARENA.x + cx, y: .165, z: ARENA.z + cz, hx: .33, hy: .165, hz: .2, yaw: g.rotation.y, tag: 'wood' });
  GL.labBox = [cx, cz, g.rotation.y];
  {
    GL.voidU = { uTime: { value: 0 } };
    const vm = new THREE.ShaderMaterial({ uniforms: GL.voidU, side: THREE.DoubleSide, fog: false,
      vertexShader: `varying vec3 vL, vC;
        void main(){ vL = position; vC = (inverse(modelMatrix) * vec4(cameraPosition, 1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec3 vL, vC;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        vec3 layer(vec2 uv, float sc, float ang, float spd, vec3 col){
          float c = cos(ang), s = sin(ang); uv = mat2(c, -s, s, c) * uv * sc; uv.y += uTime * spd;
          vec2 id = floor(uv), f = fract(uv) - .5; float r = h(id);
          vec2 o = vec2(h(id + 3.1), h(id + 7.7)) - .5; float d = length(f - o * .6);
          float star = smoothstep(.13 * (.4 + r), 0., d) * step(.3, r);
          return col * star * (.6 + .4 * sin(uTime * 2. + r * 40.));
        }
        void main(){
          // star layers sit at fixed depths BEHIND the glass, like a deep box: both eyes see the same real 3D stars
          vec3 d = normalize(vL - vC); vec2 dd = d.xy / max(abs(d.z), .2);
          #define L(D) (vL.xy + dd * D)
          vec2 uv = L(1.2);
          vec3 c = vec3(.012, .02, .035) + vec3(.02, .07, .08) * (sin(uv.x * 1.3 + uTime * .1) * sin(uv.y * 1.7 - uTime * .07) + 1.) * .5;
          c += layer(L(.35), 3.0, .0, .04, vec3(.3, .95, .85));
          c += layer(L(.7), 4.0, .9, .06, vec3(.45, .3, 1.));
          c += layer(L(1.1), 5.5, 2.1, .09, vec3(.2, 1., .55));
          c += layer(L(1.7), 7.5, 3.7, .12, vec3(.9, .95, 1.));
          c += layer(L(2.6), 10., 5.1, .16, vec3(.35, .8, 1.)) * .7;
          gl_FragColor = vec4(c, 1.);
        }` });
    const vg = new THREE.PlaneGeometry(W - .004, H - .004); vg.translate(0, H / 2, 0);
    const m = new THREE.Group(), a = new THREE.Mesh(vg, vm), b = new THREE.Mesh(vg, vm); a.position.z = .045; b.position.z = -.045; m.add(a, b);
    m.position.copy(pane.pos); m.quaternion.copy(pane.q); m.visible = false; arena.add(m); GL.voidM = m;
  }
  AR.btnT.push(0, 0);
}

/* ---------- every frame: bodies, thrown things and the sword against the glass ---------- */
function stepGlassPre(dt) {
  if (!GL.panes.some(p => p.pc)) return;
  // 0.5 mm glass cracks when you walk near it
  if (state.area === 'arena') for (const pane of GL.panes) {
    if (pane.T > .0006 || !pane.pc || pane.galaxy) continue;
    headWorld(_g4); _g4.sub(ARENA); toPane(pane, _g4, _g1);
    const moving = Math.hypot(state.vel.x, state.vel.z) > .35 || Math.hypot(GL.bodyV.x, GL.bodyV.z) > .35;
    if (moving && Math.abs(_g1.z) < 1.6 && Math.abs(_g1.x) < pane.W / 2 + 1.2 && tAll - (pane.stepT || 0) > .4) {
      pane.stepT = tAll; const x = clamp(_g1.x + (Math.random() - .5) * .6, -pane.W / 2 + .05, pane.W / 2 - .05), y = .04 + Math.random() * .45;
      if (glassAt(pane, x, y, 0)) { const segs = makeCracks(pane, x, y, .2 + Math.random() * .3); addCracks(pane, segs); sfxCrack(.25); netSend({ t: 'gl', op: 'crk', i: pane.i, x, y, d: 0, c: segs }); }
    }
  }
  // the black figure, chasing you, bursts through any glass in its way (even THE VOID)
  if (HZ.on && HZ.phase === 'chase' && fig.g.visible) for (const pane of GL.panes) {
    if (!pane.pc || tAll - (pane.figT || 0) < .5) continue;
    _g4.copy(fig.g.position).sub(ARENA); _g4.y += .9; toPane(pane, _g4, _g1);
    if (Math.abs(_g1.z) < .35 && glassAt(pane, _g1.x, _g1.y, .25)) { pane.figT = tAll; glassHit(pane, clamp(_g1.x, -pane.W / 2 + .05, pane.W / 2 - .05), clamp(_g1.y, .4, pane.H - .3), 30, pane.n.clone().multiplyScalar(_g1.z > 0 ? -6 : 6), { through: true, entity: true, R: .3, sy: 1.8 }); }
  }
  // how fast you are going (for bursting through)
  headWorld(_g3); _g3.sub(ARENA); _g3.y -= .45;
  if (GL.bodyP && state.area === 'arena') { GL.bodyV.subVectors(_g3, GL.bodyP).multiplyScalar(1 / Math.max(dt, 1e-3)); if (GL.bodyV.length() > 12) GL.bodyV.set(0, 0, 0); } else GL.bodyV.set(0, 0, 0);
  GL.bodyP = state.area === 'arena' ? (GL.bodyP || V()).copy(_g3) : null;
  // thrown (or swung) things: heavy and fast smashes, light and slow just tinks off
  for (const pc of AR.pieces) {
    if (pc.pane || !pc.body || pc.dying || !mine(pc) || pc.pop < 1) continue;
    const v = pc.held && pc.held.vel ? pc.held.vel : pc.body.linvel(), sp = Math.hypot(v.x, v.y, v.z); if (sp < 1.2) continue;
    const t = pc.body.translation(); _g4.set(t.x, t.y, t.z);
    for (const pane of GL.panes) {
      if (!pane.pc) continue;
      toPane(pane, _g4, _g1); _g2.set(v.x, v.y, v.z).applyQuaternion(pane.qi);
      if (Math.abs(_g1.x) > pane.W / 2 + pc.rad || _g1.y < -pc.rad || _g1.y > pane.H + pc.rad) continue;
      if (_g1.z * _g2.z >= 0 || Math.abs(_g1.z) > pc.rad * .8 + pane.T / 2 + Math.abs(_g2.z) * dt * 1.5 + .01) continue;
      if (pc.glT && tAll - pc.glT < .25) continue;
      const tc = clamp(-_g1.z / _g2.z, 0, .2), x = _g1.x + _g2.x * tc, y = _g1.y + _g2.y * tc;
      if (!glassAt(pane, x, y, pc.rad * .5)) continue;
      pc.glT = tAll;
      const m = pc.vol * (KINDS[pc.kind].glass ? 2500 : 700), I = Math.abs(_g2.z) * clamp(Math.pow(m / .8, .25), .45, 1.6) + (sp - Math.abs(_g2.z)) * .15;
      const r = glassHit(pane, x, y, I, V(v.x, v.y, v.z), { size: pc.rad * .45 });
      if (r === 'break' && !pc.held) pc.body.setLinvel({ x: v.x * .8, y: v.y * .8, z: v.z * .8 }, true);
    }
  }
  // a thrown sword goes through glass too
  if (sword.mode === 'free' && sword.body && mine(sword)) {
    const v = sword.body.linvel(), sp = Math.hypot(v.x, v.y, v.z), t = sword.body.translation();
    if (sp > 2.5) for (const pane of GL.panes) {
      toPane(pane, _g4.set(t.x, t.y, t.z), _g1); _g2.set(v.x, v.y, v.z).applyQuaternion(pane.qi);
      if (Math.abs(_g1.z) < .4 && _g1.z * _g2.z < 0 && Math.abs(_g1.z) < Math.abs(_g2.z) * dt * 2 + .05 && glassAt(pane, _g1.x, _g1.y, .05) && !(tAll - pane.hitT < .3))
        glassHit(pane, _g1.x, _g1.y, sp >= GL_BREAK * toughOf(pane.T) * .7 ? Math.max(GL_BREAK * toughOf(pane.T), sp) : sp, V(v.x, v.y, v.z), { R: .14 });
    }
  }
}
// the held sword against the panes: swing hard = clean straight carve, swing medium = crack/smash,
// push it in and drag it slowly = score a line (curvy if you curve) that snaps when you pull the blade out
function glassBlade(dt) {
  if (Math.max(AR.b0.distanceTo(AR.b1), AR.t0.distanceTo(AR.t1)) > .9) { GL.panes.forEach(p => traceEnd(p)); return; }
  const desk = !(state.xr || sim.on);
  for (const pane of GL.panes) {
    if (!pane.pc) { pane.trace = null; pane.stab = null; continue; }
    const tf = toughOf(pane.T), CARVE = GL_CARVE * Math.max(.8, Math.pow(tf, .7));
    let best = -1, bx = 0, by = 0, touch = false; const mv = V(), ax = V();
    for (let j = 0; j <= 10; j++) {
      const f = j / 10; _g3.lerpVectors(AR.b0, AR.t0, f); _g4.lerpVectors(AR.b1, AR.t1, f);
      toPane(pane, _g3, _g1); toPane(pane, _g4, _g2);
      if (_g1.z * _g2.z < 0) {
        const t = _g1.z / (_g1.z - _g2.z), x = _g1.x + (_g2.x - _g1.x) * t, y = _g1.y + (_g2.y - _g1.y) * t;
        if (glassAt(pane, x, y, .005)) { const sp = _g1.distanceTo(_g2) / Math.max(dt, 1e-3); if (sp > best) { best = sp; bx = x; by = y; mv.subVectors(_g2, _g1); } }
      } else if (Math.abs(_g2.z) < pane.T / 2 + .006 && glassAt(pane, _g2.x, _g2.y, 0)) { touch = true; if (best < 0) { bx = _g2.x; by = _g2.y; } }
    }
    // where the blade goes through the glass right now
    toPane(pane, AR.b1, _g1); toPane(pane, AR.t1, _g2); let cur = null;
    if (_g1.z * _g2.z < 0) { const t = _g1.z / (_g1.z - _g2.z), x = _g1.x + (_g2.x - _g1.x) * t, y = _g1.y + (_g2.y - _g1.y) * t; if (glassAt(pane, x, y, .004)) cur = [x, y]; }
    let s = best; if (desk && best >= 0) s = AR.swing.fast ? 9 : Math.min(best, 3.6);
    const vW = AR.bladeV.clone();
    if (best >= 0 && s >= CARVE) {   // a hard swing: one clean straight cut
      traceEnd(pane, true);
      ax.subVectors(_g2, _g1).normalize();
      const n = V().crossVectors(ax, mv); if (n.lengthSq() > 1e-12) n.normalize(); const n2 = Math.hypot(n.x, n.y);
      if (n2 > .35 && tAll - pane.carveT > .3) {
        pane.carveT = tAll; const nx = n.x / n2, ny = n.y / n2, d = Math.round((nx * bx + ny * by) * 1e5) / 1e5, rx = Math.round(nx * 1e6) / 1e6, ry = Math.round(ny * 1e6) / 1e6;
        if (paneCarve(pane, rx, ry, d, vW)) { netSend({ t: 'gl', op: 'cut', i: pane.i, n: [rx, ry], d, v: va(vW) }); if (sword.held) buzz(sword.held, 1, 50); AR.heat = Math.min(1, AR.heat + .3); }
      } else glassHit(pane, bx, by, s, vW, { size: .02 });
      pane.bTouch = true; continue;
    }
    if (cur) {   // the glass grips the blade: it pushes back, harder the thicker it is
      GL.drag = Math.max(GL.drag || 0, pane.galaxy ? .93 : clamp(.5 + .2 * Math.sqrt(tf), .5, .93));
      if (sword.held && tAll - (GL.rT || 0) > .07) { GL.rT = tAll; buzz(sword.held, clamp(.25 + .25 * Math.sqrt(tf), .25, 1), 60); if (Math.random() < .5) sfxScratch(); }
    }
    if (pane.stab) { stabStep(pane, cur, tf); pane.bTouch = true; continue; }   // stabbed in: twist it to bore a hole
    if (pane.trace) {   // scoring: follow the blade
      if (!cur) { traceEnd(pane); pane.bTouch = touch; continue; }
      const T = pane.trace, last = T.pts[T.pts.length - 1];
      T.tw = (T.tw || 0) + swordTurn(); T.mv = (T.mv || 0) + sword.g.position.distanceTo(sword.ppos);
      if (!desk && T.tw > .3 && T.tw > T.mv * 5) { stabStart(pane, T.pts[0], tf); pane.bTouch = true; continue; }   // you turned it instead of dragging: that's a stab
      if (Math.hypot(cur[0] - last[0], cur[1] - last[1]) > .012) {
        T.pts.push(cur); T.len += Math.hypot(cur[0] - last[0], cur[1] - last[1]);
        pane.crk.push(last[0], last[1], cur[0], cur[1]); T.segs++; pane.shown = pane.crk.length / 4; crackGeo(pane);
        if (tAll - T.sT > .05) { T.sT = tAll; sfxScratch(); glitBurst(pane.pos.clone().add(_g2.set(cur[0], cur[1], 0).applyQuaternion(pane.q)), 1, V()); if (sword.held) buzz(sword.held, .25, 12); }
      }
      pane.bTouch = true; continue;
    }
    if (best >= 0 && s >= GL_TINK * tf * 1.85) { const r = glassHit(pane, bx, by, s, vW, { size: .02 }); if (sword.held && r !== 'miss') buzz(sword.held, r === 'break' ? 1 : .6, 30); pane.bTouch = true; continue; }
    if (cur) { pane.trace = { pts: [cur], len: 0, segs: 0, sT: 0 }; sfxScratch(); pane.bTouch = true; continue; }   // the blade is in, slowly: start scoring
    if (touch && !pane.bTouch) glassHit(pane, bx, by, .5, V());
    pane.bTouch = touch;
  }
}
function bladeTwist() {   // how far the sword turned about its own blade since last frame
  if (sword.mode !== 'held') return 0;
  _gq.copy(sword.pq).invert().multiply(sword.g.quaternion); let w = _gq.w, y = _gq.y; if (w < 0) { w = -w; y = -y; }
  return Math.abs(2 * Math.atan2(y, w));
}
function swordTurn() {   // how far the sword turned (any way: twist, wiggle, drill) since last frame
  if (sword.mode !== 'held') return 0;
  _gq.copy(sword.pq).invert().multiply(sword.g.quaternion); return 2 * Math.acos(clamp(Math.abs(_gq.w), 0, 1));
}
function stabStart(pane, p, tf) {
  traceEnd(pane, true);
  if (pane.galaxy || pane.T >= .07) { glassHit(pane, p[0], p[1], .5, V()); if (ac) tone('square', 300, 200, .08, .06); if (!GL.toldFox) { GL.toldFox = true; toast(pane.galaxy ? '🌌 The blade just... slides off.' : '🦊 FOX-PROOF! Way too tough to stab. Only patience will do it...', 4); } return; }
  pane.stab = { x: p[0], y: p[1], tw: 0, need: .9 * Math.max(.7, Math.pow(tf, .2)), cT: 0, hT: 0, nT: 0, out: 0 };
  sfxCrack(.5); sfxScratch(); if (sword.held) buzz(sword.held, .8, 40);
  if (!GL.toldStab) { GL.toldStab = true; toast('🗡️ STABBED! Now twist the sword round and round 🌀💨', 4.5); }
}
function stabStep(pane, cur, tf) {
  const S = pane.stab;
  if (!cur || Math.hypot(cur[0] - S.x, cur[1] - S.y) > .4) { if ((S.out += AR.dt || 1 / 72) > .18) { pane.stab = null; sfxScratch(); } return; }   // pulled out (a little wobble is fine)
  S.out = 0;
  const d = swordTurn(), k = clamp((S.tw += d) / S.need, 0, 1);
  const wp = pane.pos.clone().add(_g2.set(S.x, S.y, 0).applyQuaternion(pane.q));
  if (d > .012) {
    steamBurst(wp, pane.n, 1 + Math.round(k * 4), .35 + k);
    if (tAll - S.hT > .08) { S.hT = tAll; sfxHiss(.3 + k * .7); sfxScratch(); if (sword.held) buzz(sword.held, .15 + k * .5, 14); }
    if (tAll - S.nT > .25) { S.nT = tAll; netSend({ t: 'gl', op: 'stm', i: pane.i, x: S.x, y: S.y, k }); }
  }
  if (S.tw >= S.need) {   // POP: a hole, and a big gush of steam
    pane.stab = null;
    const side = Math.sign(AR.t1.clone().sub(AR.b1).dot(pane.n)) || 1, r = Math.round((.06 + .008 * Math.min(4, tf)) * 1e4) / 1e4, vW = pane.n.clone().multiplyScalar(side * .8);
    if (paneHole(pane, S.x, S.y, r, vW)) netSend({ t: 'gl', op: 'hole', i: pane.i, x: S.x, y: S.y, r, v: va(vW) });
    steamBurst(wp, pane.n, 70, 1.7); sfxHiss(1.4); netSend({ t: 'gl', op: 'stm', i: pane.i, x: S.x, y: S.y, k: 2 });
    if (sword.held) buzz(sword.held, 1, 80);
    if (!GL.toldHole) { GL.toldHole = true; toast('💨 PSSSHHH! You bored a hole!', 3.5); }
  }
}
function traceEnd(pane, quiet) {
  const T = pane.trace; if (!T) return; pane.trace = null;
  pane.crk.splice(pane.crk.length - T.segs * 4, T.segs * 4); crackGeo(pane);   // the scratch becomes the real cut (or fades if too short)
  if (quiet || T.len < .07 || T.pts.length < 2) return;
  if (toughOf(pane.T) >= 2.5) { glassHit(pane, T.pts[0][0], T.pts[0][1], .5, V()); if (!GL.toldThick) { GL.toldThick = true; toast('🛡️ Too thick to score! Stab it and TWIST the sword to bore through 🌀', 5); } return; }
  const v3 = T.pts.map(p => V(p[0], p[1], 0));
  let tol = .006, ch = simplify(v3, tol); while (ch.length > 8) { tol *= 1.4; ch = simplify(v3, tol); }
  let pts = ch.map(p => [Math.round(p.x * 1e5) / 1e5, Math.round(p.y * 1e5) / 1e5]);
  if (!chainCut(pane.polys, pts)) pts = [pts[0], pts[pts.length - 1]];   // too twisty: snap straight
  const vW = AR.bladeV.clone();
  if (paneCarvePath(pane, pts, vW)) { netSend({ t: 'gl', op: 'cutp', i: pane.i, p: pts, v: va(vW) }); if (sword.held) buzz(sword.held, .9, 40); }
}
function stepGlassPost(dt) {
  for (const pane of GL.panes) { const n = pane.crk.length / 4; if (pane.shown < n) { pane.shown = Math.min(n, pane.shown + dt * 700 + 2); pane.lines.geometry.setDrawRange(0, Math.floor(pane.shown) * 2); } }
  // loose glass: tinkles when it lands, and a big piece SMASHES if it crashes down hard enough
  let smashed = 0;
  for (const pc of AR.pieces) {
    if (!KINDS[pc.kind].glass || pc.pane || !pc.body || pc.dying) continue;
    if (pc.held || pc.body.bodyType() !== 0) { pc.gvh = []; pc.gsp = 0; continue; }   // in a paw: no crash history, so a throw doesn't smash it
    const v = pc.body.linvel(), sp = Math.hypot(v.x, v.y, v.z), gh = pc.gvh || (pc.gvh = []), gv = gh.length >= 6 ? gh[0] : null;   // its velocity ~0.1 s ago
    if (gv && mine(pc) && !smashed && tAll - pc.born > .25 && pc.body.bodyType() === 0) {
      if (!pc.gT) { let z0 = 1e9, z1 = -1e9; const hh = pc.hull; for (let i = 2; i < hh.length; i += 3) { z0 = Math.min(z0, hh[i]); z1 = Math.max(z1, hh[i]); } pc.gT = Math.max(.002, z1 - z0); }
      const dv = Math.hypot(v.x - gv.x, v.y - gv.y, v.z - gv.z), T = pc.gT, tf = toughOf(T), area = pc.vol / T;
      if (area > .01 && dv > Math.max(1.2, 3.2 * tf)) {
        // where it hit: the corner that was leading the way
        const r = pc.body.rotation(); _gq.set(r.x, r.y, r.z, r.w).invert(); _g1.set(gv.x, gv.y, gv.z).applyQuaternion(_gq);
        let bi = 0, bd = -1e9; const h = pc.hull; for (let i = 0; i < h.length; i += 3) { const d = h[i] * _g1.x + h[i + 1] * _g1.y + h[i + 2] * _g1.z; if (d > bd) { bd = d; bi = i; } }
        const hx = h[bi], hy = h[bi + 1], R = clamp(.07 + (dv - Math.max(1.2, 3.2 * tf)) * .03 / Math.sqrt(tf) + Math.sqrt(area) * .25, .07, .3);
        const seeds = glassSeeds(hx, hy, R), vW = V(gv.x, gv.y, gv.z).multiplyScalar(.5), id = pc.id;
        pieceShatter(pc, hx, hy, R, seeds, vW); smashed++;
        netSend({ t: 'gl', op: 'pbrk', id, x: hx, y: hy, R, s: seeds, v: va(vW) });
        continue;
      }
    }
    if ((pc.gsp || 0) > 1.1 && sp < pc.gsp * .55 && tAll - GL.tkT > .04) { GL.tkT = tAll; sfxTinkle(clamp(pc.gsp * .03, .02, .1)); }
    pc.gsp = sp; gh.push({ x: v.x, y: v.y, z: v.z }); if (gh.length > 6) gh.shift();
  }
  stepGlit(dt); stepSteam(dt);
  GL.drag = Math.max(0, (GL.drag || 0) - dt * 5);
  const lp = labPane(); if (GL.voidM) GL.voidM.visible = !!(lp.galaxy && lp.pc); if (GL.voidM && GL.voidM.visible) GL.voidU.uTime.value = tAll;
}


/* ---------- glitter: tiny glints of glass dust ---------- */
const GLIT_N = 320;
GL.glit = (() => {
  const pos = new Float32Array(GLIT_N * 3).fill(-500), col = new Float32Array(GLIT_N * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(V(), 80);
  const dot = document.createElement('canvas'); dot.width = dot.height = 32; { const g = dot.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(.3, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .012, vertexColors: true, transparent: true, depthWrite: false, map: new THREE.CanvasTexture(dot), fog: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; arena.add(pts);
  return { pos, col, geo, v: new Float32Array(GLIT_N * 3), life: new Float32Array(GLIT_N), i: 0, alive: 0 };
})();
function glitBurst(p, n, vW) {
  const G = GL.glit;
  for (let j = 0; j < n; j++) {
    const i = G.i = (G.i + 1) % GLIT_N; G.pos.set([p.x + (Math.random() - .5) * .06, p.y + (Math.random() - .5) * .06, p.z + (Math.random() - .5) * .06], i * 3);
    G.v.set([vW.x * .3 + (Math.random() - .5) * 2.2, vW.y * .3 + Math.random() * 1.6, vW.z * .3 + (Math.random() - .5) * 2.2], i * 3); G.life[i] = .5 + Math.random() * 1.1;
  }
  G.alive = 1.8;
}
/* ---------- steam: soft puffs that drift out of a twisted-open hole ---------- */
const STEAM_N = 220;
GL.steam = (() => {
  const pos = new Float32Array(STEAM_N * 3).fill(-500), col = new Float32Array(STEAM_N * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(V(), 80);
  const c = document.createElement('canvas'); c.width = c.height = 64; { const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.45, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .11, vertexColors: true, transparent: true, depthWrite: false, map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; arena.add(pts);
  return { pos, col, geo, v: new Float32Array(STEAM_N * 3), life: new Float32Array(STEAM_N), max: new Float32Array(STEAM_N), i: 0, alive: 0 };
})();
function steamBurst(p, nrm, n, k = 1) {
  const S = GL.steam;
  for (let j = 0; j < n; j++) {
    const i = S.i = (S.i + 1) % STEAM_N, sd = Math.random() < .5 ? -1 : 1, sp = (.25 + Math.random() * .7) * k;
    S.pos.set([p.x + (Math.random() - .5) * .03, p.y + (Math.random() - .5) * .03, p.z + (Math.random() - .5) * .03], i * 3);
    S.v.set([nrm.x * sd * sp + (Math.random() - .5) * .35 * k, nrm.y * sd * sp + .15 + Math.random() * .3, nrm.z * sd * sp + (Math.random() - .5) * .35 * k], i * 3);
    S.life[i] = S.max[i] = .9 + Math.random() * 1.3;
  }
  S.alive = 2.4;
}
function stepSteam(dt) {
  const S = GL.steam; if (S.alive <= 0) return; S.alive -= dt;
  const P = S.pos, Vv = S.v, C = S.col, dr = Math.exp(-dt * 2.4);
  for (let i = 0; i < STEAM_N; i++) {
    if (S.life[i] <= 0) { if (P[i * 3 + 1] > -400) P[i * 3 + 1] = -500; continue; }
    const f = (S.life[i] -= dt) / S.max[i];
    Vv[i * 3] *= dr; Vv[i * 3 + 1] = Vv[i * 3 + 1] * dr + .5 * dt; Vv[i * 3 + 2] *= dr;
    P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt;
    const b = Math.max(0, f) * Math.min(1, (1 - f) * 8) * .32; C[i * 3] = b * .95; C[i * 3 + 1] = b; C[i * 3 + 2] = b * 1.05;
  }
  S.geo.attributes.position.needsUpdate = true; S.geo.attributes.color.needsUpdate = true;
}
function sfxVoidBreak() { if (!ac) return; const t = ac.currentTime; tone('sawtooth', 70, 30, 1.4, .18); noiseHit(t, 1.2, .3, 'lowpass', 600, .7); [880, 1320, 1760].forEach((f, i) => tone('sine', f, f * .5, 1.2, .06, i * .08)); }
function sfxHiss(k) { if (!ac) return; const t = ac.currentTime; noiseHit(t, .18 + k * .35, .03 + k * .09, 'highpass', 2600 + Math.random() * 1800, .6); if (k > 1) noiseHit(t + .05, .9, .12, 'bandpass', 1400, .5); }
function stepGlit(dt) {
  const G = GL.glit; if (G.alive <= 0) return; G.alive -= dt;
  const P = G.pos, Vv = G.v, C = G.col;
  for (let i = 0; i < GLIT_N; i++) {
    if (G.life[i] <= 0) { if (P[i * 3 + 1] > -400) P[i * 3 + 1] = -500; continue; }
    const l = G.life[i] -= dt; Vv[i * 3 + 1] -= 9.8 * dt;
    P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt;
    if (P[i * 3 + 1] < .003) { P[i * 3 + 1] = .003; Vv[i * 3 + 1] *= -.25; Vv[i * 3] *= .5; Vv[i * 3 + 2] *= .5; }
    const tw = .55 + .45 * Math.sin(tAll * 40 + i * 2.7), k = clamp(l / .4, 0, 1) * tw; C[i * 3] = .75 * k; C[i * 3 + 1] = .92 * k; C[i * 3 + 2] = k;
  }
  G.geo.attributes.position.needsUpdate = true; G.geo.attributes.color.needsUpdate = true;
}

/* ---------- glass sounds (all synthesized) ---------- */
function sfxTink(f, vol) {
  if (!ac) return;
  tone('sine', f, f * .997, .7, vol); tone('sine', f * 2.76, f * 2.75, .3, vol * .35); tone('sine', f * 5.4, f * 5.38, .12, vol * .18);
}
function noiseHit(t, dur, vol, type, freq, Q = .8) {
  const n = noiseLoop(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = Q; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random() * 1.5); n.stop(t + dur + .02);
}
function sfxCrack(k) {
  if (!ac) return; const t = ac.currentTime;
  for (let i = 0; i < 3 + Math.round(k * 3); i++) noiseHit(t + i * (.012 + Math.random() * .02), .035, .25 * k, 'highpass', 2500 + Math.random() * 2500);
  tone('square', 3400, 1900, .03, .03 * k); tone('sine', 2600 + Math.random() * 800, 2500, .18, .05 * k, .01);
}
function sfxShatter(k) {
  if (!ac) return; const t = ac.currentTime;
  noiseHit(t, .55 * k + .15, .6 * k, 'highpass', 1700, .5); noiseHit(t, .12, .4 * k, 'bandpass', 900, .9);
  tone('sine', 150, 55, .18, .35 * k);
  const n = Math.round(8 + k * 12);
  for (let i = 0; i < n; i++) { const f = 2400 + Math.random() * 5600, w = .02 + Math.random() * Math.random() * .9 * k; tone('sine', f, f * .995, .1 + Math.random() * .2, (.03 + Math.random() * .07) * k, w); }
}
function sfxTinkle(vol) { if (!ac) return; for (let i = 0; i < 2; i++) { const f = 3000 + Math.random() * 5000; tone('sine', f, f * .996, .08 + Math.random() * .1, vol * (1 - i * .4), i * (.02 + Math.random() * .04)); } }
function sfxScratch() { if (!ac) return; noiseHit(ac.currentTime, .07, .12, 'bandpass', 4500 + Math.random() * 2500, 4); tone('sine', 3800 + Math.random() * 900, 3600, .06, .025); }
function sfxGlassCarve() {
  if (!ac) return; const t = ac.currentTime;
  noiseHit(t, .22, .35, 'bandpass', 5200, 2.5); tone('sine', 4200, 2900, .25, .08); tone('triangle', 1900, 1890, .6, .06, .03);
}

