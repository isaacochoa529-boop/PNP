/* ======================= cubes and their pieces ======================= */
const KINDS = [
  { out: 0xff4f6d, ins: 0xffd9df }, { out: 0xff9a3c, ins: 0xffe9c9 }, { out: 0x5fd94a, ins: 0xebffd9 },
  { out: 0x3fb2ff, ins: 0xdaf2ff }, { out: 0x9a6bff, ins: 0xf0e6ff }, { out: 0xffd84f, ins: 0xfff6c9, butter: true },
  { out: 0xff4fc3, ins: 0xffe2f5, size: MEGA }];
// toys that come through the portal become sliceable too: 7 beach ball (bouncy rubber, even in pieces), 8 pinecone, 9 star
KINDS.push({ out: 0xff4f6d, ins: 0xffb3c0, size: .28, rub: true }, { out: 0x7a4d2b, ins: 0xe2c08f, size: .2 }, { out: 0xffc93a, ins: 0xfff1b8, size: .22 },
  { out: 0xffc4e1, ins: 0xf6d59a, size: .22 });   // 10: cake (pink frosting, sprinkles, sponge + cream + jam inside)
KINDS.push({ out: 0xcdefff, ins: 0x9fe8d0, size: .3, glass: true }, { out: 0xffffff, ins: 0xffffff, size: .3, glass: true, rainbow: true });   // 11 glass, 12 rainbow glass
KINDS.push({ out: 0xff9ec7, ins: 0xf6d59a, size: .7, cake: true }, { out: 0xfff1e0, ins: 0xf6d59a, size: .42, cake: true });   // 13 + 14: Vivan's giant birthday cake (bottom + top tier, 85-party.js)
// 15-22 + 23-30: test dummies the chainsaw turned into cubes (91-cheese-saw.js): fur outside, cotton inside (meat in horror mode)
[0x2fc6a3, 0xff8a3d, 0x8b6bff, 0xff5f9e, 0x3fa0ff, 0xffd25a, 0x5ad36b, 0xe8e8f0].forEach((c, i, A) => { KINDS.push({ out: c, ins: 0xf6f1e6, size: .17, dummy: c }); });
[0x2fc6a3, 0xff8a3d, 0x8b6bff, 0xff5f9e, 0x3fa0ff, 0xffd25a, 0x5ad36b, 0xe8e8f0].forEach(c => { KINDS.push({ out: c, ins: 0x9b1b1f, size: .17, dummy: c, meat: true }); });
KINDS.forEach(k => { k.size = k.size || CUBE; });
const VS = 11;   // vis soup stride: [px py pz nx ny nz ox oy oz cap hot] per vertex; phys soups are a sharp box, [px py pz]
let CUT_T = -1e4;   // cap faces made by the cut happening right now remember this time, so they glow hot and cool down

/* ---- every piece lives in ONE mesh: a shared vertex buffer plus a texture holding each piece's matrix.
   Hundreds of pieces still cost a single draw call, so you can slice forever and nothing has to vanish. ---- */
const SLOT_GLSL = `attribute float slot; uniform highp sampler2D uMat; uniform float uMatSize;
mat4 kgSlot(float s) { int j = int(s + .5) * 4, sz = int(uMatSize); ivec2 c = ivec2(j % sz, j / sz);
  return mat4(texelFetch(uMat, c, 0), texelFetch(uMat, c + ivec2(1, 0), 0), texelFetch(uMat, c + ivec2(2, 0), 0), texelFetch(uMat, c + ivec2(3, 0), 0)); }`;
const U_MAT = { value: null }, U_MATSZ = { value: 4 }, U_TIME = { value: 0 };
const PILE_ATTR = [['position', 3], ['normal', 3], ['orig', 4], ['hot', 1], ['slot', 1], ['kind', 1]];
const PILE = { cap: 0, used: 0, dead: 0, mesh: null, slots: 1, free: [], maxSlots: 0, data: null, adds: 0, repacks: 0 };   // slot 0 = a zero matrix for dead vertices
const GPILE = { cap: 0, used: 0, dead: 0, mesh: null, repacks: 0 };   // glass pieces: same matrices, their own see-through mesh
const pileOf = pc => KINDS[pc.kind].glass ? GPILE : PILE;
function pileTexture(n) {
  const size = Math.max(4, Math.ceil(Math.sqrt(n * 4) / 4) * 4), data = new Float32Array(size * size * 4);
  if (PILE.data) data.set(PILE.data.subarray(0, Math.min(PILE.data.length, data.length)));   // texel i sits at float i * 4 whatever the width
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true;
  if (U_MAT.value) U_MAT.value.dispose();
  U_MAT.value = t; U_MATSZ.value = size; PILE.data = data; PILE.maxSlots = size * size / 4;
}
pileTexture(1024);
const pileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .32, envMap: ENV, envMapIntensity: .45 });
pileMat.onBeforeCompile = sh => {
  const NK = KINDS.length;
  Object.assign(sh.uniforms, { uMat: U_MAT, uMatSize: U_MATSZ, uTime: U_TIME, uOut: { value: KINDS.map(k => new THREE.Color(k.out)) }, uIns: { value: KINDS.map(k => new THREE.Color(k.ins)) }, uHalf: { value: KINDS.map(k => k.size / 2) } });
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + SLOT_GLSL + '\nattribute vec4 orig; attribute float hot; attribute float kind; varying vec4 vOrig; varying float vHot; varying float vKind;')
    .replace('#include <beginnormal_vertex>', 'mat4 kgM = kgSlot(slot);\n#include <beginnormal_vertex>\nobjectNormal = mat3(kgM) * objectNormal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = (kgM * vec4(transformed, 1.)).xyz; vOrig = orig; vHot = hot; vKind = kind;');
  // cut faces (orig.w = 1) show the inside: a soft swirl with a thin rind of the outer colour round the edge.
  // Fresh cuts are MELTED, like the blade was red hot: bubbly flowing lava that slowly crusts over into dark rock
  // with glowing cracks, then cools back to the normal inside. The lava is bumpy too (the light catches the blobs).
  const NOISE = `float kgHs(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float kgN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
      return mix(mix(mix(kgHs(i), kgHs(i + vec3(1., 0., 0.)), f.x), mix(kgHs(i + vec3(0., 1., 0.)), kgHs(i + vec3(1., 1., 0.)), f.x), f.y),
                 mix(mix(kgHs(i + vec3(0., 0., 1.)), kgHs(i + vec3(1., 0., 1.)), f.x), mix(kgHs(i + vec3(0., 1., 1.)), kgHs(i + vec3(1., 1., 1.)), f.x), f.y), f.z); }
    float kgF(vec3 p){ return .55 * kgN(p) + .3 * kgN(p * 2.03 + 7.1) + .15 * kgN(p * 4.1 + 3.3); }
    vec3 kgRamp(float x){ vec3 c = mix(vec3(.3, .02, .01), vec3(.92, .13, .02), smoothstep(0., .4, x)); c = mix(c, vec3(1., .46, .05), smoothstep(.38, .78, x)); return mix(c, vec3(1., .88, .45), smoothstep(.8, 1., x)); }`;
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\nuniform vec3 uOut[${NK}]; uniform vec3 uIns[${NK}]; uniform float uHalf[${NK}]; uniform float uTime; varying vec4 vOrig; varying float vHot; varying float vKind;\n${NOISE}`)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `int kk = int(vKind + .5); vec3 kOut = uOut[kk]; float kHalf = uHalf[kk];
      vec4 diffuseColor = vec4( kOut, opacity ); vec3 kgHot = vec3(0.);
      if ((kk == 10 || kk == 13 || kk == 14) && vOrig.w < .5) { float sp = kgHs(floor(vOrig.xyz * 70.) + 3.); if (sp > .92) diffuseColor.rgb = sp > .973 ? vec3(.3, .7, 1.) : (sp > .946 ? vec3(1., .9, .2) : vec3(.4, .9, .5)); }
      if ((kk == 13 || kk == 14) && vOrig.w < .5) {   // Vivan's birthday cake: frosting drips on top, piped beads round the bottom, a ribbon
        vec3 co = vOrig.xyz; vec3 cream = kk == 13 ? vec3(1., .97, .92) : vec3(1., .52, .74);
        if (co.y > kHalf - (.03 + .055 * pow(abs(sin((co.x + co.z) * 21.)), 3.))) diffuseColor.rgb = cream;
        if (co.y < -kHalf + .035) diffuseColor.rgb = cream * (sin((co.x + co.z) * 95.) > 0. ? 1. : .84);
        if (kk == 13 && abs(co.y + .06) < .028) diffuseColor.rgb = vec3(.36, .74, 1.) * (abs(co.y + .06) > .02 ? .8 : 1.);
      }
      if (kk == 7 && vOrig.w < .5) diffuseColor.rgb = mod(floor(atan(vOrig.z, vOrig.x) / 1.5708 + 4.), 2.) < .5 ? kOut : vec3(1.);
      float kgBump = 0., kgMelt = 0.;
      if (vOrig.w > .5) {
        vec3 o = vOrig.xyz; float mx = (kk >= 7 && kk < 13) ? length(o) : max(abs(o.x), max(abs(o.y), abs(o.z)));
        float sw = sin(o.x * 61. + sin(o.y * 47. + o.z * 13.) * 2.4 + o.z * 39.) * .5 + .5;
        float rind = smoothstep(kHalf - .017, kHalf - .008, mx);
        diffuseColor.rgb = mix(uIns[kk] * (.92 + .12 * sw), kOut * .92, rind);
        if (kk == 10 || kk == 13 || kk == 14) { float L = fract(o.y * (kk == 10 ? 14. : 6.) + .3); vec3 lay = L < .6 ? vec3(.96, .8, .5) * (.93 + .1 * sw) : (L < .8 ? vec3(1., .97, .92) : vec3(.8, .1, .22)); diffuseColor.rgb = mix(lay, kOut, rind); }
        float age = max(uTime - vHot, 0.), h = (kk == 10 || kk >= 13) ? 0. : exp(-age * .5);
        if (h > .01) {
          // the lava flows fast at first, then slows and sets as it cools
          float tf = 1.6 * (1. - exp(-age * .7)), on = smoothstep(.01, .09, h);
          vec3 q = o * 24.;
          vec3 wq = vec3(kgN(q * .6 + vec3(0., tf, 0.)), kgN(q * .6 + vec3(5.2, -tf, 1.3)), kgN(q * .6 + vec3(2.1, 1.7, tf)));
          float n = kgF(q + wq * 2.4 + vec3(0., -tf * 1.4, 0.)), n2 = kgN(q * 1.3 + wq * 1.8 + 11.);
          float molten = smoothstep(-.07, .07, n - (1. - h) * .95);                  // crust grows in from the cool spots
          float crack = (1. - smoothstep(.0, .045, abs(n2 - .5))) * smoothstep(.02, .35, h);   // glowing cracks between crust plates
          float rim = smoothstep(kHalf - .05, kHalf - .004, mx);                     // where the blade came out is hottest
          float lava = molten * (.45 + .55 * smoothstep(.25, .8, n));                // bright bubbly blobs, deeper orange between them
          float heat = max(max(lava, crack * .7), rim * h) * on, temp = clamp(heat * (.25 + .8 * h), 0., 1.);
          kgHot = kgRamp(temp) * heat * (.3 + .9 * temp);
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(.1, .05, .04), vec3(.25, .04, .01), molten), smoothstep(.02, .45, h) * .92);   // dark scorched rock under the glow
          kgBump = (n * .0045 + molten * .0015) * smoothstep(.01, .3, h);           // lumpy, not a flat plate
          kgMelt = h * molten;
        }
      }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { float bx = dFdx(kgBump), by = dFdy(kgBump);
        if (bx != 0. || by != 0.) { vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
          vec3 g = sign(det) * (bx * r1 + by * r2); vec3 nn = abs(det) * normal - g; if (dot(nn, nn) > 1e-20) normal = normalize(nn); } }`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(roughnessFactor, .72, step(.5, vOrig.w)), .3, kgMelt);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += kgHot;');
};
pileMat.customProgramCacheKey = () => 'kgPile';
const pileDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });   // shadows need the same per-piece matrices
pileDepth.onBeforeCompile = sh => {
  sh.uniforms.uMat = U_MAT; sh.uniforms.uMatSize = U_MATSZ;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SLOT_GLSL).replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = (kgSlot(slot) * vec4(transformed, 1.)).xyz;');
};
pileDepth.customProgramCacheKey = () => 'kgPileDepth';
function pileGeo(cap) {
  const g = new THREE.BufferGeometry();
  for (const [name, n] of PILE_ATTR) { const a = new THREE.BufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); }
  g.boundingSphere = new THREE.Sphere(V(), 80); g.setDrawRange(0, 0); return g;
}
// pack the live pieces to the front of a fresh buffer (and grow it if needed). Rare, so a full upload is fine.
function pileRepack(cap, pl = PILE) {
  const old = pl.mesh ? pl.mesh.geometry : null, g = pileGeo(cap); let at = 0;
  for (const pc of AR.pieces) {
    if (!(pc.slot > 0) || pileOf(pc) !== pl) continue;
    if (old) for (const [name, n] of PILE_ATTR) g.attributes[name].array.set(old.attributes[name].array.subarray(pc.start * n, (pc.start + pc.count) * n), at * n);
    pc.start = at; at += pc.count;
  }
  pl.used = at; pl.dead = 0; pl.cap = cap; pl.repacks++; g.setDrawRange(0, at);
  if (pl.mesh) { pl.mesh.geometry = g; old.dispose(); }
  else if (pl === GPILE) { const m = pl.mesh = new THREE.Mesh(g, glassMat); m.frustumCulled = false; m.renderOrder = 1; arena.add(m); }
  else { const m = pl.mesh = new THREE.Mesh(g, pileMat); m.frustumCulled = false; m.castShadow = m.receiveShadow = true; m.customDepthMaterial = pileDepth; arena.add(m); }
}
const pileCapFor = live => { let c = 65536; while (c < live * 1.6) c *= 2; return c; };
pileRepack(65536);
function pileTidy() {   // dead vertices still cost the GPU a little each frame: squeeze them out once there are lots
  for (const pl of [PILE, GPILE]) if (pl.dead > 30000 && pl.dead > (pl.used - pl.dead) * .6) pileRepack(pileCapFor(pl.used - pl.dead), pl);
}
function pileAdd(pc) {
  let count = 0; for (const p of pc.parts) count += p.vis.length / VS;
  const pl = pileOf(pc);
  if (pl.used + count > pl.cap) pileRepack(pileCapFor(pl.used - pl.dead + count), pl);
  const slot = PILE.free.length ? PILE.free.pop() : PILE.slots++;
  if (slot >= PILE.maxSlots) pileTexture(PILE.maxSlots * 2);
  pc.slot = slot; pc.start = pl.used; pc.count = count;
  const A = pl.mesh.geometry.attributes, P = A.position.array, N = A.normal.array, O = A.orig.array, H = A.hot.array, S = A.slot.array, K = A.kind.array;
  let at = pc.start;
  for (const p of pc.parts) {
    const v = p.vis;
    for (let b = 0; b < v.length; b += VS, at++) {
      P[at * 3] = v[b]; P[at * 3 + 1] = v[b + 1]; P[at * 3 + 2] = v[b + 2];
      N[at * 3] = v[b + 3]; N[at * 3 + 1] = v[b + 4]; N[at * 3 + 2] = v[b + 5];
      O[at * 4] = v[b + 6]; O[at * 4 + 1] = v[b + 7]; O[at * 4 + 2] = v[b + 8]; O[at * 4 + 3] = v[b + 9];
      H[at] = v[b + 10]; S[at] = slot; K[at] = pc.kind;
    }
  }
  for (const [name, n] of PILE_ATTR) { const a = A[name]; a.addUpdateRange(pc.start * n, count * n); a.needsUpdate = true; }
  pl.used += count; PILE.adds++; pl.mesh.geometry.setDrawRange(0, pl.used);
  pileMatrix(pc);
}
function pileRemove(pc) {
  if (!(pc.slot > 0)) return;
  const pl = pileOf(pc), a = pl.mesh.geometry.attributes.slot; a.array.fill(0, pc.start, pc.start + pc.count); a.addUpdateRange(pc.start, pc.count); a.needsUpdate = true;
  pl.dead += pc.count; PILE.free.push(pc.slot); pc.slot = -1;
}
const _m4 = new THREE.Matrix4(), _pmP = V(), _pmS = V(), _pmQ = new THREE.Quaternion();
function pileMatrix(pc) {
  const t = pc.body.translation(), r = pc.body.rotation();
  _m4.compose(_pmP.set(t.x, t.y, t.z), _pmQ.set(r.x, r.y, r.z, r.w), _pmS.setScalar(pc.sc)).toArray(PILE.data, pc.slot * 16);
  U_MAT.value.needsUpdate = true;
}

// templates: a softly rounded cube to look at, a sharp box to collide with
const TPL = {};
function tplFor(size) {
  if (TPL[size]) return TPL[size];
  const rb = new RoundedBoxGeometry(size, size, size, size === CUBE ? 1 : 2, size === CUBE ? .022 : .055), g = rb.index ? rb.toNonIndexed() : rb, p = g.attributes.position, n = g.attributes.normal, vis = new Float32Array(p.count * VS);
  for (let i = 0; i < p.count; i++) vis.set([p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), p.getX(i), p.getY(i), p.getZ(i), 0, -1e4], i * VS);
  const phys = Float32Array.from(new THREE.BoxGeometry(size, size, size).toNonIndexed().attributes.position.array);
  return (TPL[size] = { vis, phys });
}

/* ---- the cutter: split a convex triangle soup by the plane n.p = d, and cap both halves ---- */
const EPS = 1e-6;
function splitSoup(v, S, n, d, capIt = true) {
  // flat number arrays out, no per-vertex objects: cutting has to fit inside one VR frame
  const nt = v.length / (3 * S), outs = [[], []], capPts = [], nx = n.x, ny = n.y, nz = n.z;
  const ds = [0, 0, 0], bs = [0, 0, 0], cross = [null, null, null];
  const pushV = (o, b) => { for (let i = 0; i < S; i++) o.push(v[b + i]); };
  const pushA = (o, a) => { for (let i = 0; i < S; i++) o.push(a[i]); };
  const lerpV = (a, b, t) => { const r = new Array(S); for (let i = 0; i < S; i++) r[i] = v[a + i] + (v[b + i] - v[a + i]) * t; if (S >= 6) { const L = Math.hypot(r[3], r[4], r[5]) || 1; r[3] /= L; r[4] /= L; r[5] /= L; } return r; };
  for (let t = 0; t < nt; t++) {
    let pos = 0, neg = 0;
    for (let k = 0; k < 3; k++) {
      const b = bs[k] = (t * 3 + k) * S, dd = ds[k] = nx * v[b] + ny * v[b + 1] + nz * v[b + 2] - d;
      if (dd > EPS) pos++; else if (dd < -EPS) neg++; else capPts.push(Array.prototype.slice.call(v, b, b + S));
    }
    if (!pos && !neg) {   // lies in the plane: give it to the half it faces away from
      const a = bs[0], b = bs[1], c = bs[2];
      const ax = v[b] - v[a], ay = v[b + 1] - v[a + 1], az = v[b + 2] - v[a + 2], bx = v[c] - v[a], by = v[c + 1] - v[a + 1], bz = v[c + 2] - v[a + 2];
      const o = outs[((ay * bz - az * by) * nx + (az * bx - ax * bz) * ny + (ax * by - ay * bx) * nz) > 0 ? 0 : 1];
      pushV(o, a); pushV(o, b); pushV(o, c); continue;
    }
    if (!neg || !pos) { const o = outs[neg ? 0 : 1]; pushV(o, bs[0]); pushV(o, bs[1]); pushV(o, bs[2]); continue; }
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3; cross[k] = null;
      if ((ds[k] > EPS && ds[k2] < -EPS) || (ds[k] < -EPS && ds[k2] > EPS)) { const p = lerpV(bs[k], bs[k2], ds[k] / (ds[k] - ds[k2])); cross[k] = p; capPts.push(p); }
    }
    for (let side = 0; side < 2; side++) {
      const sg = side ? 1 : -1, poly = [];   // entries: a number = index into v, an array = new point
      for (let k = 0; k < 3; k++) { if (ds[k] * sg >= -EPS) poly.push(bs[k]); if (cross[k]) poly.push(cross[k]); }
      const o = outs[side], put = x => typeof x === 'number' ? pushV(o, x) : pushA(o, x);
      for (let i = 1; i + 1 < poly.length; i++) { put(poly[0]); put(poly[i]); put(poly[i + 1]); }
    }
  }
  // cap: the cross-section of a convex shape is a convex polygon, so sort its points round the centre and fan it
  let poly = null;
  if (capPts.length >= 3) {
    const u = Math.abs(nx) < .9 ? V(1, 0, 0) : V(0, 1, 0); u.addScaledVector(n, -u.dot(n)).normalize(); const w = V().crossVectors(n, u);
    let cx = 0, cy = 0, cz = 0; for (const p of capPts) { cx += p[0]; cy += p[1]; cz += p[2]; } cx /= capPts.length; cy /= capPts.length; cz /= capPts.length;
    const ang = capPts.map(p => ({ p, a: Math.atan2((p[0] - cx) * w.x + (p[1] - cy) * w.y + (p[2] - cz) * w.z, (p[0] - cx) * u.x + (p[1] - cy) * u.y + (p[2] - cz) * u.z) })).sort((a, b) => a.a - b.a);
    poly = [];
    for (const { p } of ang) { const q = poly[poly.length - 1]; if (!q || (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 > 1e-10) poly.push(p); }
    while (poly.length > 1) { const a = poly[0], b = poly[poly.length - 1]; if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 <= 1e-10) poly.pop(); else break; }
    if (poly.length >= 3 && capIt) {
      for (let side = 0; side < 2; side++) {
        const cn = side ? -1 : 1, o = outs[side];   // the negative half's cap faces +n, the positive half's faces -n
        let qx = 0, qy = 0, qz = 0; for (const p of poly) { qx += p[0]; qy += p[1]; qz += p[2]; } qx /= poly.length; qy /= poly.length; qz /= poly.length;
        const cv = poly.map(p => { const r = p.slice();
          // a join between two slabs of one curvy cut: draw it too (if the slabs end up in different halves it is the outside!),
          // but pulled in a hair from the edge so where it is hidden inside it never flickers through the surface
          if (capIt === 'inner') { const dx = qx - r[0], dy = qy - r[1], dz = qz - r[2], L = Math.hypot(dx, dy, dz), k = L > 1e-9 ? Math.min(.5, .0005 / L) : 0; r[0] += dx * k; r[1] += dy * k; r[2] += dz * k; }
          if (S >= 6) { r[3] = nx * cn; r[4] = ny * cn; r[5] = nz * cn; } if (S >= 10) r[9] = 1; if (S >= 11) r[10] = CUT_T; return r; });
        for (let i = 1; i + 1 < cv.length; i++) { pushA(o, cv[0]); if (cn > 0) { pushA(o, cv[i]); pushA(o, cv[i + 1]); } else { pushA(o, cv[i + 1]); pushA(o, cv[i]); } }
      }
    } else if (poly.length < 3) poly = null;
  }
  return [new Float32Array(outs[0]), new Float32Array(outs[1]), poly];
}
function volCen(v) {   // signed volume + centre of mass of a closed soup (stride 3)
  let V6 = 0, cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < v.length; i += 9) {
    const ax = v[i], ay = v[i + 1], az = v[i + 2], bx = v[i + 3], by = v[i + 4], bz = v[i + 5], qx = v[i + 6], qy = v[i + 7], qz = v[i + 8];
    const vol = ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx);
    V6 += vol; cx += (ax + bx + qx) * vol; cy += (ay + by + qy) * vol; cz += (az + bz + qz) * vol;
  }
  return V6 > 1e-12 ? { vol: V6 / 6, c: V(cx / (4 * V6), cy / (4 * V6), cz / (4 * V6)) } : { vol: 0, c: V() };
}
function shiftSoup(v, S, c) { for (let i = 0; i < v.length; i += S) { v[i] -= c.x; v[i + 1] -= c.y; v[i + 2] -= c.z; } }
function hullInfo(phys) {
  const pts = [], seen = new Set(), planes = []; let rad = 0;
  for (let i = 0; i < phys.length; i += 3) { const k = Math.round(phys[i] * 1e4) + ',' + Math.round(phys[i + 1] * 1e4) + ',' + Math.round(phys[i + 2] * 1e4); if (!seen.has(k)) { seen.add(k); pts.push(phys[i], phys[i + 1], phys[i + 2]); rad = Math.max(rad, Math.hypot(phys[i], phys[i + 1], phys[i + 2])); } }
  for (let i = 0; i < phys.length; i += 9) {
    _a1.set(phys[i + 3] - phys[i], phys[i + 4] - phys[i + 1], phys[i + 5] - phys[i + 2]); _a2.set(phys[i + 6] - phys[i], phys[i + 7] - phys[i + 1], phys[i + 8] - phys[i + 2]);
    _a3.crossVectors(_a1, _a2); const L = _a3.length(); if (L < 1e-9) continue; _a3.multiplyScalar(1 / L);
    const d = _a3.x * phys[i] + _a3.y * phys[i + 1] + _a3.z * phys[i + 2];
    // a sliver triangle's normal can point anywhere: keep only planes the whole part really sits behind,
    // or the blade test thinks the piece is somewhere it isn't and it can't be cut again
    let ok = true; for (let j = 0; j < pts.length; j += 3) if (_a3.x * pts[j] + _a3.y * pts[j + 1] + _a3.z * pts[j + 2] - d > 2e-4) { ok = false; break; }
    if (!ok) continue;
    if (!planes.some(p => p[0] * _a3.x + p[1] * _a3.y + p[2] * _a3.z > .9999 && Math.abs(p[3] - d) < 1e-4)) planes.push([_a3.x, _a3.y, _a3.z, d]);
  }
  return { hull: new Float32Array(pts), planes, rad };
}
// a piece is ONE rigid body made of one or more convex parts: a curvy cut leaves a dent, and a dent takes several convex parts
function withHull(p) { if (!p.hull) Object.assign(p, hullInfo(p.phys)); return p; }
// split one part by a plane; a part that sits wholly on one side skips the work
function splitPart(p, n, d, polys, inner) {
  withHull(p); let lo = 1e9, hi = -1e9; const h = p.hull;
  for (let i = 0; i < h.length; i += 3) { const s = n.x * h[i] + n.y * h[i + 1] + n.z * h[i + 2] - d; if (s < lo) lo = s; if (s > hi) hi = s; }
  if (hi <= 2e-5) return [p, null]; if (lo >= -2e-5) return [null, p];
  const ph = splitSoup(p.phys, 3, n, d), vh = splitSoup(p.vis, VS, n, d, inner ? 'inner' : true);
  if (polys && ph[2]) polys.push([ph[2], n]);
  return [ph[0].length ? { vis: vh[0], phys: ph[0] } : null, ph[1].length ? { vis: vh[1], phys: ph[1] } : null];
}
// cut along a chain of planes. lines[j] = [n, d] does the cutting inside slab j, bis[j] = [n, d] separates slab j from slab j + 1.
// A straight cut is one line and no slabs. Every part ends up on the negative side (A) or the positive side (B).
function chainSplit(parts, lines, bis) {
  const A = [], B = [], polys = [];
  for (const p0 of parts) {
    let rem = p0;
    for (let j = 0; j < lines.length && rem; j++) {
      let slab = rem;
      if (j < bis.length) { const s = splitPart(rem, bis[j][0], bis[j][1], null, true); slab = s[0]; rem = s[1]; }
      if (!slab) continue;
      const s = splitPart(slab, lines[j][0], lines[j][1], polys);
      if (s[0]) A.push(s[0]); if (s[1]) B.push(s[1]);
    }
  }
  return [A, B, polys];
}
function childOf(parts) {
  let vol = 0; const c = V(), keep = [];
  for (const p of parts) { const vc = volCen(p.phys); if (vc.vol < 3e-8) continue; keep.push(p); vol += vc.vol; c.addScaledVector(vc.c, vc.vol); }
  if (vol > 0) c.multiplyScalar(1 / vol);
  return { parts: keep, vol, c };
}
// make a piece from parts already centred on their shared centre of mass; pos/quat are arena-local
function makePiece(kind, parts, vol, pos, quat, lv, av, pop) {
  parts = parts.map(withHull).filter(p => p.planes.length >= 4 && p.vis.length);
  if (!parts.length) return null;
  const R = AR.R, body = AR.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    .setLinvel(lv.x, lv.y, lv.z).setAngvel({ x: av.x, y: av.y, z: av.z }).setCcdEnabled(lv.length() > 3).setAngularDamping(.4).setLinearDamping(.05));
  let ok = 0, rad = 0, nh = 0;
  for (const p of parts) { const cd = R.ColliderDesc.convexHull(p.hull); if (cd) { const rub = KINDS[kind].rub, gl = KINDS[kind].glass; cd.setFriction(rub ? .9 : gl ? .4 : .5).setRestitution(rub ? .82 : gl ? .12 : .06).setDensity(rub ? 450 : gl ? 2500 : 700); if (rub) cd.setRestitutionCombineRule(R.CoefficientCombineRule.Max); AR.world.createCollider(cd, body); ok++; } rad = Math.max(rad, p.rad); nh += p.hull.length; }
  if (!ok) { AR.world.removeRigidBody(body); return null; }
  const hull = new Float32Array(nh); nh = 0; for (const p of parts) { hull.set(p.hull, nh); nh += p.hull.length; }
  const pc = { kind, parts, vol, body, hull, rad, cool: .06, trk: null, held: null, dying: 0, born: tAll, pop: pop ? 0 : 1, sc: pop ? .01 : 1, frz: 0, frzH: null, slot: -1 };
  pc.id = AR.forceId || (AR.ready ? newPieceId() : 'i' + AR.pieces.length); pc.own = AR.makeOwn || (online() ? MP.me : undefined); AR.byId.set(pc.id, pc);
  pileAdd(pc); AR.pieces.push(pc);
  if (!mine(pc)) { body.setBodyType(AR.R.RigidBodyType.KinematicPositionBased, true); netSeed(pc); }
  return pc;
}
function wakeNear(pc) {   // something moved away: whatever was resting on or against it wakes up and falls
  if (!pc.body) return; const t = pc.body.translation();
  for (const o of AR.pieces) { if (o === pc || !o.body || !o.body.isSleeping()) continue; const u = o.body.translation(), r = pc.rad + o.rad + .03; if ((u.x - t.x) ** 2 + (u.y - t.y) ** 2 + (u.z - t.z) ** 2 < r * r) o.body.wakeUp(); }
}
function removePiece(pc) {
  wakeNear(pc);
  const i = AR.pieces.indexOf(pc); if (i >= 0) AR.pieces.splice(i, 1);
  if (pc.held) { pc.held.piece = null; pc.held = null; }
  if (AR.byId.get(pc.id) === pc) AR.byId.delete(pc.id);
  pileRemove(pc); if (pc.body) AR.world.removeRigidBody(pc.body); pc.body = null;
}
function spawnCube(kind, p, pop) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, kind === 6 ? 0 : rnd() * .6 - .3, 0)), t = tplFor(KINDS[kind].size), lv = V(0, pop ? -.5 : 0, 0);
  const pc = makePiece(kind, [{ vis: Float32Array.from(t.vis), phys: Float32Array.from(t.phys) }], KINDS[kind].size ** 3, p, q, lv, V(), pop);
  if (AR.ready) sendSpawn(pc, 'c', lv, V(), pop);
  return pc;
}
function spawnSet(drop) { PEDS.forEach((p, i) => spawnCube(i, V(p.x, drop ? 1.25 + i * .06 : PED_TOP + CUBE / 2 + .002, p.z), drop)); }
function spawnMega(drop) { spawnCube(6, V(MEGA_AT.x, drop ? 1.9 : MEGA / 2 + .002, MEGA_AT.z), drop); megaSign(); }
function butterBlock() {
  const p = PEDS[2]; spawnCube(5, V(p.x, 1.5, p.z), true); confetti(V().copy(ARENA).add(V(p.x, 1.4, p.z)), 50, [0xffd84f, 0xfff6c9, 0xffffff]);
  toast('🧈 A wild BUTTER BLOCK appeared! Smooth as… well, you know.', 5);
  if (ac) [523, 659, 784].forEach((f, i) => tone('triangle', f, f * 1.01, .3, .2, i * .08));
}

/* ---- slicing: follow the blade through each piece, then cut along the path it drew ---- */
const FAST = 2.4, EXTREME = 8;   // blade speed at the cut, m/s: quicker than FAST cuts dead straight on contact, quicker than EXTREME is an anime cut
const _bl = V(), _tl = V(), _pl = V(), _tlp = V(), _blp = V(), _iq = new THREE.Quaternion(), _pt = V(), _sv = V();
function toLocal(pc, w, out) { const t = pc.body.translation(), r = pc.body.rotation(); _iq.set(r.x, r.y, r.z, r.w).invert(); return out.set(w.x - t.x, w.y - t.y, w.z - t.z).applyQuaternion(_iq); }
// clip the segment a->b against a convex part's planes (shrunk a hair); returns [tIn, tOut] or null
function clipSeg(planes, a, b) {
  let t0 = 0, t1 = 1;
  for (const p of planes) {
    const num = p[3] - .0004 - (p[0] * a.x + p[1] * a.y + p[2] * a.z), den = p[0] * (b.x - a.x) + p[1] * (b.y - a.y) + p[2] * (b.z - a.z);
    if (Math.abs(den) < 1e-9) { if (num < 0) return null; continue; }
    const t = num / den;
    if (den < 0) { if (t > t0) t0 = t; } else if (t < t1) t1 = t;
    if (t0 > t1) return null;
  }
  return [t0, t1];
}
function clipPiece(pc, a, b) {
  let lo = 2, hi = -1;
  for (const p of pc.parts) { const h = clipSeg(p.planes, a, b); if (h) { if (h[0] < lo) lo = h[0]; if (h[1] > hi) hi = h[1]; } }
  return hi >= lo ? [lo, hi] : null;
}
function bladeSlice(dt) {
  const b0 = AR.b0, t0 = AR.t0, b1 = AR.b1, t1 = AR.t1;
  const move = Math.max(b0.distanceTo(b1), t0.distanceTo(t1));
  if (move > .9) { AR.pieces.forEach(pc => pc.trk = null); return; }   // a tracking glitch teleported the blade: don't slice along that jump
  AR.bladeV.copy(b1).add(t1).sub(b0).sub(t0).multiplyScalar(.5 / Math.max(dt, 1e-3));
  const mnx = Math.min(b0.x, t0.x, b1.x, t1.x), mxx = Math.max(b0.x, t0.x, b1.x, t1.x), mny = Math.min(b0.y, t0.y, b1.y, t1.y), mxy = Math.max(b0.y, t0.y, b1.y, t1.y), mnz = Math.min(b0.z, t0.z, b1.z, t1.z), mxz = Math.max(b0.z, t0.z, b1.z, t1.z);
  const cuts = [];
  for (const pc of AR.pieces) {
    if (pc.dying || !pc.body || pc.pop < 1 || pc.pane || pc.inQ) continue;
    if (pc.cool > 0) { pc.cool -= dt; continue; }
    const c = pc.body.translation(), r = pc.rad;
    if (c.x < mnx - r || c.x > mxx + r || c.y < mny - r || c.y > mxy + r || c.z < mnz - r || c.z > mxz + r) { pc.trk = null; continue; }
    const travel = clamp(.3 * r, .003, .012), subs = clamp(Math.ceil(move / Math.max(.003, .3 * r)), 1, 24);
    toLocal(pc, b0, _blp); toLocal(pc, t0, _tlp);
    for (let s = 1; s <= subs; s++) {
      const f = s / subs;
      _a4.lerpVectors(b0, b1, f); _a5.lerpVectors(t0, t1, f); toLocal(pc, _a4, _bl); toLocal(pc, _a5, _tl);
      const hit = clipPiece(pc, _bl, _tl);
      if (hit) {
        const fm = (hit[0] + hit[1]) / 2; _pt.lerpVectors(_bl, _tl, fm);
        if (!pc.trk) pc.trk = { e: _pt.clone(), ax: V().subVectors(_tl, _bl).normalize(), f: fm, lm: V(), path: [], spMax: 0 };
        const k = pc.trk;
        k.lm.lerpVectors(_bl, _tl, k.f).sub(_a3.lerpVectors(_blp, _tlp, k.f));   // how the blade moved at the contact this sub-step
        const sp = k.lm.length() * subs / Math.max(dt, 1e-3); if (sp > k.spMax) k.spMax = sp;
        if (sp < FAST) AR.inCut = 1;   // a slow cut sizzles while the blade is in
        // remember the path: where the blade goes in and out of the surface (the hot line) and its middle (for curvy cuts)
        const last = k.path[k.path.length - 1];
        if (!last || last.m.distanceToSquared(_pt) > 9e-6) k.path.push({ m: _pt.clone(), a: V().lerpVectors(_bl, _tl, hit[0]), b: V().lerpVectors(_bl, _tl, hit[1]), ax: V().subVectors(_tl, _bl).normalize() });
        _a1.subVectors(_pt, k.e); _a1.addScaledVector(k.ax, -_a1.dot(k.ax));
        const L = _a1.length();
        // a quick swing cuts dead straight on contact; slower ones follow your hand and part once the blade is through
        if (L > travel && sp > FAST * (1 + 2.5 * Math.max(0, pc.rad - .2))) {   // big pieces need a really quick swing before a cut snaps straight
 cuts.push(planeCut(pc, k.ax, _a1, k.e, sp)); pc.trk = null; break; }
        if (L > travel && L > .9 * widthAlong(pc, _a1)) { cuts.push(pathCut(pc, k)); pc.trk = null; break; }
      } else if (pc.trk) {
        // the blade came out: cut if it went through, not if it was pulled back the way it came
        const k = pc.trk; pc.trk = null;
        _sv.lerpVectors(_bl, _tl, k.f); _a1.subVectors(_sv, k.e); _a1.addScaledVector(k.ax, -_a1.dot(k.ax));
        if (_a1.length() > travel) { k.path.push({ m: _sv.clone(), a: _sv.clone(), b: _sv.clone(), ax: V().subVectors(_tl, _bl).normalize() }); cuts.push(pathCut(pc, k)); }
        break;
      }
      _blp.copy(_bl); _tlp.copy(_tl);
    }
  }
  // at most two cuts per frame; any extra wait a frame so a wild swing through a pile never stutters
  for (const c of cuts) if (c && !c.pc.inQ) { c.pc.inQ = true; AR.cutQ.push(c); }   // one queued cut per piece: a swing through a pile never backs the blade up
}
function widthAlong(pc, dir) {   // how wide the piece is in this direction
  const h = pc.hull, L = dir.length() || 1, x = dir.x / L, y = dir.y / L, z = dir.z / L; let lo = 1e9, hi = -1e9;
  for (let i = 0; i < h.length; i += 3) { const s = h[i] * x + h[i + 1] * y + h[i + 2] * z; if (s < lo) lo = s; if (s > hi) hi = s; }
  return hi - lo;
}
function planeCut(pc, ax, mv, e, sp) {
  const n = V().crossVectors(ax, mv); if (n.lengthSq() < 1e-12) return null; n.normalize();
  // desktop clicks always swing fast, so there only the right-click slash is an anime cut
  const extreme = (state.xr || sim.on) ? sp > EXTREME : (AR.swing.fast && AR.swing.t < 1 && sp > 4);
  return { pc, lines: [[n, n.dot(e)]], bis: [], nMain: n, e: e.clone(), sp, extreme };
}
// Douglas-Peucker: keep only the points that bend the path by more than tol
const _dp1 = V(), _dp2 = V();
function simplify(pts, tol) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const rec = (i, j) => {
    if (j <= i + 1) return; const a = pts[i]; _dp1.subVectors(pts[j], a); const L2 = _dp1.lengthSq(); let best = -1, bd = tol;
    for (let k = i + 1; k < j; k++) { _dp2.subVectors(pts[k], a); const t = L2 > 0 ? clamp(_dp2.dot(_dp1) / L2, 0, 1) : 0; const dd = _dp2.addScaledVector(_dp1, -t).length(); if (dd > bd) { bd = dd; best = k; } }
    if (best >= 0) { keep[best] = 1; rec(i, best); rec(best, j); }
  };
  rec(0, pts.length - 1); return pts.filter((_, i) => keep[i]);
}
// a slow cut follows the path your blade drew: a chain of flat cuts that bends where you bent
function pathCut(pc, k) {
  const P = k.path; if (P.length < 2) return null;
  const ax = V(); for (const s of P) ax.addScaledVector(s.ax, s.ax.dot(k.ax) < 0 ? -1 : 1); ax.normalize();
  let pts = P.map(s => s.m.clone().addScaledVector(ax, -s.m.dot(ax)));   // flatten onto the plane square to the blade
  const chord = V().subVectors(pts[pts.length - 1], pts[0]); if (chord.length() < 1e-3) return null;
  const big = pc.rad > .3;   // the MEGA cube follows your swing much more closely
  let tol = Math.max(.003, (big ? .012 : .035) * widthAlong(pc, chord));
  let ch = simplify(pts, tol); while (ch.length > (big ? 10 : 6)) { tol *= 1.4; ch = simplify(pts, tol); }
  ch = ch.filter((p, i) => i === 0 || i === ch.length - 1 || p.distanceTo(ch[i - 1]) > .006);
  if (ch.length < 3) return planeCut(pc, ax, chord, pts[0], k.spMax);
  const lines = [], bis = [], dirs = [];
  for (let j = 0; j + 1 < ch.length; j++) { const d = V().subVectors(ch[j + 1], ch[j]).normalize(); dirs.push(d); const n = V().crossVectors(ax, d).normalize(); lines.push([n, n.dot(ch[j])]); }
  for (let j = 1; j + 1 < ch.length; j++) {
    const t = V().addVectors(dirs[j - 1], dirs[j]); if (t.length() < .3) return planeCut(pc, ax, chord, pts[0], k.spMax);   // a hairpin: just cut straight
    t.normalize(); bis.push([t, t.dot(ch[j])]);
  }
  return { pc, lines, bis, nMain: V().crossVectors(ax, chord).normalize(), e: pts[0].clone(), sp: k.spMax, extreme: false };
}
function cutPiece(pc, cut) {
  const t0 = performance.now(), r = cutPiece2(pc, cut), ms = performance.now() - t0; AR.cutMs = Math.max(AR.cutMs || 0, ms); return r;
}
// how far outside a set of convex parts a point is (negative = inside)
function outside(parts, p) { let best = 1e9; for (const pt of parts) { let m = -1e9; for (const pl of pt.planes) { const s = pl[0] * p.x + pl[1] * p.y + pl[2] * p.z - pl[3]; if (s > m) m = s; } if (m < best) best = m; } return best; }
function cutPiece2(pc, cut) {
  if (!pc || !pc.body || pc.dying) return false;
  const { lines, bis } = cut;
  if (lines.length === 1) {   // no paper-thin shavings: each half must be at least MIN_THICK thick across the cut
    const [n, d] = lines[0], h = pc.hull; let lo = 1e9, hi = -1e9;
    for (let i = 0; i < h.length; i += 3) { const s = n.x * h[i] + n.y * h[i + 1] + n.z * h[i + 2]; if (s < lo) lo = s; if (s > hi) hi = s; }
    if (d - lo < MIN_THICK || hi - d < MIN_THICK) { pc.cool = .04; return false; }
  }
  CUT_T = cut.bite ? -1e4 : tAll;   // a bite is a bite, not a hot cut
  const [Ap, Bp, polys] = chainSplit(pc.parts, lines, bis), ch = [childOf(Ap), childOf(Bp)];
  CUT_T = -1e4;
  if (ch[0].vol < MIN_VOL || ch[1].vol < MIN_VOL) { pc.cool = .05; return false; }
  // the outline of the cut (minus the hidden joins between slabs): it glows round the rim of both halves
  const seg = [];
  const onBis = p => bis.some(([bn, bd]) => Math.abs(bn.x * p[0] + bn.y * p[1] + bn.z * p[2] - bd) < 2e-4);
  if (!cut.bite) for (const [poly, n] of polys) for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if (onBis(a) && onBis(b)) continue; seg.push(a[0], a[1], a[2], b[0], b[1], b[2], n.x, n.y, n.z); }
  const t = pc.body.translation(), r = pc.body.rotation(), lv = pc.body.linvel(), av = pc.body.angvel();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w), T = V(t.x, t.y, t.z), LV = V(lv.x, lv.y, lv.z), AV = V(av.x, av.y, av.z);
  const held = pc.held, frzH = pc.frzH, kind = pc.kind;
  for (const c of ch) for (const p of c.parts) { shiftSoup(p.phys, 3, c.c); shiftSoup(p.vis, VS, c.c); p.hull = null; withHull(p); }
  // the half your paw is in (or nearest to) stays in your paw
  let keep = -1;
  if (held) { toLocal(pc, _a1.copy(held.pos).sub(ARENA), _pl); keep = outside(ch[0].parts, _a2.subVectors(_pl, ch[0].c)) <= outside(ch[1].parts, _a3.subVectors(_pl, ch[1].c)) ? 0 : 1; }
  const frozen = cut.fz !== undefined ? cut.fz : cut.extreme && (held || frzH || LV.length() < 1.5);   // anime cut: it looks fine... for a second
  removePiece(pc);
  const cake = cut.cake !== undefined ? cut.cake : !cut.bite && kind !== 10 && !KINDS[kind].cake && !KINDS[kind].glass && (AR.forceCake || rnd() < .005); AR.forceCake = false;   // 1 in 200: it was CAKE all along
  const nW = cut.nMain.clone().applyQuaternion(q); let made = 0;
  const bs = AR.bladeV.length(), carry = AR.bladeV.clone().multiplyScalar(.14); if (carry.length() > 1.4) carry.setLength(1.4);
  for (let s = 0; s < 2; s++) {
    const c = ch[s], off = c.c.clone().applyQuaternion(q), P = off.clone().add(T);
    // halves ease apart along the cut, and a quick swing carries them a little in its direction
    const v = frozen ? V() : LV.clone().add(_a2.crossVectors(AV, off)).addScaledVector(nW, (s ? 1 : -1) * (.28 + .04 * Math.min(bs, 8))).add(carry);
    AR.forceId = pc.id + (s ? 'b' : 'a'); const child = makePiece(cake ? 10 : kind, c.parts, c.vol, P, q, v, frozen ? V() : AV, false); AR.forceId = null;
    if (!child) continue;
    child.cool = .07; made++;
    if (!KINDS[kind].glass) addSeam(child, seg, c.c, frozen ? FREEZE_T : 0);
    if (held && s === keep) { keepHeld(held, child); if (cut.remote) claim(child, 'pc', child.id); }
    else if (frozen) freezePiece(child, held || frzH, nW.clone().multiplyScalar(s ? 1 : -1));
  }
  if (!cut.remote && made) netSend({ t: 'cut', id: pc.id, c: packCut(cut), fz: frozen ? 1 : 0, cake: cake ? 1 : 0 });
  if (cut.bite) return made > 0;
  if (cake) itsCake(V().copy(cut.e).applyQuaternion(q).add(T));
  AR.cuts++; AR.heat = Math.min(1, AR.heat + .5); AR.lastSp = cut.sp;
  const cw = V().copy(cut.e).applyQuaternion(q).add(T);
  if (KINDS[kind].glass) { glitBurst(cw.clone(), 18, AR.bladeV); sfxGlassCarve(); } else { sparkBurst(cw, frozen ? 26 : 12, bs); sfxSlice(pc.vol); sfxSizzle(); } if (frozen) sfxAnime(); if (sword.held) buzz(sword.held, .65, 28);
  if (kind === 6) megaSign();
  return made > 0;
}
const CRUMB_G = new THREE.TetrahedronGeometry(.012, 0);
function crumbs(w, kind, n) {
  const g = CRUMB_G;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(g, mat(KINDS[kind].ins, { emissive: KINDS[kind].ins, emissiveIntensity: .25 })); m.position.copy(w); scene.add(m);
    fx.push({ m, v: V((rnd() - .5) * 1.6, .6 + rnd() * 1.2, (rnd() - .5) * 1.6), spin: V(rnd() * 12, rnd() * 12, rnd() * 12), life: .7 + rnd() * .4, drag: 1.2 });
  }
}

/* ---- anime cuts: too fast to see. The cube just sits there... then slides apart ---- */
const FREEZE_T = 1;
function keepHeld(h, pc) {
  pc.held = h; h.piece = pc;
  pc.body.setBodyType(AR.R.RigidBodyType.KinematicPositionBased, true);
  relToPaw(h, pc);
}
function freezePiece(pc, h, out) {
  pc.frz = FREEZE_T; pc.frzH = h || null; pc.out = out; pc.swing = AR.bladeV.clone().normalize();
  pc.body.setBodyType(AR.R.RigidBodyType.KinematicPositionBased, true);
  if (h) relToPaw(h, pc);
}
function unfreeze(pc) {
  const h = pc.frzH; pc.frz = 0; pc.frzH = null;
  if (!pc.body || pc.held || !mine(pc)) return;
  pc.body.setBodyType(AR.R.RigidBodyType.Dynamic, true);
  const n = pc.out, v = V(), w = V();
  if (h && h.vel) v.copy(h.vel);
  if (n.y > .3) {   // the top half slides off down the cut (or along the swing, if the cut is flat)
    _a1.set(0, -1, 0).addScaledVector(n, n.y); if (_a1.length() < .25) _a1.copy(pc.swing).addScaledVector(n, -pc.swing.dot(n));
    if (_a1.lengthSq() > 1e-6) v.addScaledVector(_a1.normalize(), 1.4); v.addScaledVector(n, .12);
  } else if (n.y > -.3) { v.addScaledVector(n, .35); w.crossVectors(_a1.set(0, 1, 0), n).multiplyScalar(2.6); }   // upright cut: the halves topple apart
  pc.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true); pc.body.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
  pc.cool = .1;
  if (!(tAll - (AR.slideT || -9) < .12)) { AR.slideT = tAll; sfxSlide(); }
}

/* ---- hot seams: glowing lines on the surface where the blade is cutting, and round the rim of fresh cuts ---- */
const SEAM_MAX = 6000;
const seam = (() => {
  const pos = new Float32Array(SEAM_MAX * 8 * 3), k = new Float32Array(SEAM_MAX * 8), idx = new Uint16Array(SEAM_MAX * 12);
  for (let i = 0; i < SEAM_MAX; i++) { const a = i * 8; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2, a + 4, a + 5, a + 6, a + 5, a + 7, a + 6], i * 12); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('k', new THREE.BufferAttribute(k, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.setDrawRange(0, 0); geo.boundingSphere = new THREE.Sphere(V(), 80);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: 'attribute float k; varying float vk; void main(){ vk = k; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying float vk; void main(){ float h = clamp(vk, 0., 1.); vec3 c = mix(vec3(1., .32, .02), vec3(1., .9, .28), h); gl_FragColor = vec4(c, clamp(vk * 1.5, 0., 1.)); }' });
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = 2; arena.add(mesh);
  return { mesh, pos, k, geo, list: [], n: 0 };
})();
function addSeam(pc, seg, c, hold) {
  if (!seg.length) return;
  const s = Float32Array.from(seg); for (let i = 0; i < s.length; i += 9) { s[i] -= c.x; s[i + 1] -= c.y; s[i + 2] -= c.z; s[i + 3] -= c.x; s[i + 4] -= c.y; s[i + 5] -= c.z; }
  seam.list.push({ pc, s, t0: tAll, hold, dripT: .12 + rnd() * .2, drips: 0 });
}
const _sa = V(), _sb = V(), _sn = V(), _sd = V(), _sw = V(), _sq = new THREE.Quaternion(), _sT = V();
function seamQuad(a, b, n, w, k) {   // two crossed strips along a->b, so the line reads from any angle
  if (seam.n >= SEAM_MAX) return;
  const o = seam.n * 24, P = seam.pos; seam.n++;
  _sd.subVectors(b, a); _sw.crossVectors(_sd, n); const L = _sw.length(); if (L < 1e-9) _sw.set(0, 0, 0); else _sw.multiplyScalar(w / L);
  const put = (i, p, dx, dy, dz) => { P[o + i * 3] = p.x + dx; P[o + i * 3 + 1] = p.y + dy; P[o + i * 3 + 2] = p.z + dz; };
  put(0, a, n.x * w, n.y * w, n.z * w); put(1, a, -n.x * w, -n.y * w, -n.z * w); put(2, b, n.x * w, n.y * w, n.z * w); put(3, b, -n.x * w, -n.y * w, -n.z * w);
  put(4, a, _sw.x, _sw.y, _sw.z); put(5, a, -_sw.x, -_sw.y, -_sw.z); put(6, b, _sw.x, _sw.y, _sw.z); put(7, b, -_sw.x, -_sw.y, -_sw.z);
  seam.k.fill(k, (seam.n - 1) * 8, seam.n * 8);
}
function stepSeams() {
  seam.n = 0;
  const xf = (pc, out, x, y, z) => out.set(x, y, z).applyQuaternion(_sq).add(_sT);
  const bodyXf = pc => { const t = pc.body.translation(), r = pc.body.rotation(); _sT.set(t.x, t.y, t.z); _sq.set(r.x, r.y, r.z, r.w); };
  // fresh cuts: the rim glows, then cools off (anime cuts stay white-hot until they slide apart)
  for (let i = seam.list.length - 1; i >= 0; i--) {
    const e = seam.list[i], pc = e.pc;
    const age = tAll - e.t0 - (pc.frz > 0 ? 1e9 : e.hold), k = age < 0 ? 1 : Math.exp(-age * 2.4);
    if (!pc.body || k < .03) { seam.list.splice(i, 1); continue; }
    bodyXf(pc); const w = clamp(pc.rad * .028, .0028, .008), s = e.s;
    let lowY = 1e9, lowJ = -1; const canDrip = age > 0 && age < 1.5 && e.drips < 3 + pc.rad * 12 && (e.dripT -= AR.dt) <= 0;
    for (let j = 0; j < s.length; j += 9) { xf(pc, _sa, s[j], s[j + 1], s[j + 2]); xf(pc, _sb, s[j + 3], s[j + 4], s[j + 5]); _sn.set(s[j + 6], s[j + 7], s[j + 8]).applyQuaternion(_sq); seamQuad(_sa, _sb, _sn, w, k);
      if (canDrip && _sa.y < lowY) { lowY = _sa.y; lowJ = j; } }
    if (lowJ >= 0) { e.dripT = .22 + rnd() * .35; e.drips++; drip(pc, s[lowJ], s[lowJ + 1], s[lowJ + 2]); }
  }
  // cuts in progress: a hot line where the blade went in and where it comes out
  for (const pc of AR.pieces) {
    const k = pc.trk; if (!k || k.path.length < 2 || !pc.body) continue;
    bodyXf(pc); const w = clamp(pc.rad * .028, .0028, .008), P = k.path;
    for (let j = 1; j < P.length; j++) for (const key of ['a', 'b']) {
      const p0 = P[j - 1][key], p1 = P[j][key]; _sd.subVectors(p1, p0); _sn.crossVectors(k.ax, _sd); if (_sn.lengthSq() < 1e-12) continue; _sn.normalize().applyQuaternion(_sq);
      xf(pc, _sa, p0.x, p0.y, p0.z); xf(pc, _sb, p1.x, p1.y, p1.z); seamQuad(_sa, _sb, _sn, w, 1.2);
    }
  }
  seam.geo.setDrawRange(0, seam.n * 12);
  if (seam.n) { seam.geo.attributes.position.addUpdateRange(0, seam.n * 24); seam.geo.attributes.position.needsUpdate = true; seam.geo.attributes.k.addUpdateRange(0, seam.n * 8); seam.geo.attributes.k.needsUpdate = true; }
}

/* ---- hot sparks fly off every cut ---- */
const SPK_N = 256;
const sparks = (() => {
  const pos = new Float32Array(SPK_N * 3).fill(-500), col = new Float32Array(SPK_N * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(V(), 80);
  const dot = document.createElement('canvas'); dot.width = dot.height = 32; { const g = dot.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(.45, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
  const m = new THREE.PointsMaterial({ size: .016, vertexColors: true, transparent: true, depthWrite: false, map: new THREE.CanvasTexture(dot), fog: false });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; arena.add(pts);
  return { pos, col, geo, v: new Float32Array(SPK_N * 3), life: new Float32Array(SPK_N), i: 0, alive: 0 };
})();
function sparkBurst(p, n, speed) {
  for (let j = 0; j < n; j++) {
    const i = sparks.i = (sparks.i + 1) % SPK_N, s = 1 + Math.min(speed, 8) * .25;
    sparks.pos.set([p.x, p.y, p.z], i * 3);
    sparks.v.set([(rnd() - .5) * 2.2 * s, (.4 + rnd() * 1.4) * s, (rnd() - .5) * 2.2 * s], i * 3);
    sparks.life[i] = .3 + rnd() * .45;
  }
  sparks.alive = .8;
}
function stepSparks(dt) {
  if (sparks.alive <= 0) return; sparks.alive -= dt;
  const P = sparks.pos, Vv = sparks.v, C = sparks.col;
  for (let i = 0; i < SPK_N; i++) {
    if (sparks.life[i] <= 0) { if (P[i * 3 + 1] > -400) P[i * 3 + 1] = -500; continue; }
    const l = sparks.life[i] -= dt; Vv[i * 3 + 1] -= 6 * dt;
    P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt;
    const k = clamp(l / .5, 0, 1); C[i * 3] = 1; C[i * 3 + 1] = .3 + .6 * k; C[i * 3 + 2] = .05 + .2 * k * k;
  }
  sparks.geo.attributes.position.needsUpdate = true; sparks.geo.attributes.color.needsUpdate = true;
}

/* ---- molten drips: fresh cuts drip little blobs of glowing goo that splat and cool on whatever is below ---- */
const DRIP_N = 96;
const drips = (() => {
  const pos = new Float32Array(DRIP_N * 3).fill(-500), col = new Float32Array(DRIP_N * 3), sz = new Float32Array(DRIP_N);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('sz', new THREE.BufferAttribute(sz, 1).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(V(), 80);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, vertexColors: true,
    vertexShader: 'attribute float sz; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = sz * projectionMatrix[1][1] * 600. / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d) * 2.; if (r > 1.) discard; gl_FragColor = vec4(vC * (1.25 - .45 * r), smoothstep(1., .55, r)); }' });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 3; arena.add(pts);
  return { pos, col, sz, geo, v: new Float32Array(DRIP_N), land: new Float32Array(DRIP_N), life: new Float32Array(DRIP_N), hang: new Float32Array(DRIP_N), i: 0, alive: 0 };
})();
const _dripRay = { o: { x: 0, y: 0, z: 0 }, d: { x: 0, y: -1, z: 0 } }, _dripQ = new THREE.Quaternion(), _dp = V();
drips.pc = new Array(DRIP_N).fill(null); drips.loc = new Float32Array(DRIP_N * 3); drips.rare = new Uint8Array(DRIP_N); const _dripC = new THREE.Color();
function dripAt(pc, i) {   // where a hanging drip is now: stuck to the rim of its piece, which may be moving
  const t = pc.body.translation(), r = pc.body.rotation();
  _dp.set(drips.loc[i * 3], drips.loc[i * 3 + 1], drips.loc[i * 3 + 2]).applyQuaternion(_dripQ.set(r.x, r.y, r.z, r.w)).add(_a1.set(t.x, t.y, t.z));
  drips.pos[i * 3] = _dp.x; drips.pos[i * 3 + 1] = _dp.y - .005; drips.pos[i * 3 + 2] = _dp.z;
}
function drip(pc, lx, ly, lz) {
  const i = drips.i = (drips.i + 1) % DRIP_N;
  drips.pc[i] = pc; drips.loc.set([lx, ly, lz], i * 3); dripAt(pc, i);
  drips.v[i] = 0; drips.rare[i] = rnd() < 1 / 30 ? 1 : 0; drips.hang[i] = .18 + rnd() * .27; drips.life[i] = 2.8; drips.land[i] = -1e9; drips.alive = 3.2;
}
function dripFall(i) {   // let go of the rim: find where it will land (floor, a pedestal, the other half...)
  const P = drips.pos, body = drips.pc[i] && drips.pc[i].body; drips.pc[i] = null;
  let land = 0;
  if (AR.R && AR.world) { _dripRay.o.x = P[i * 3]; _dripRay.o.y = P[i * 3 + 1]; _dripRay.o.z = P[i * 3 + 2];
    const hit = AR.world.castRay(new AR.R.Ray(_dripRay.o, _dripRay.d), 6, true, undefined, undefined, undefined, body || undefined);
    if (hit) land = P[i * 3 + 1] - (hit.timeOfImpact ?? hit.toi ?? 0); }
  drips.land[i] = Math.min(P[i * 3 + 1], land + .004);
}
function stepDrips(dt) {
  if (drips.alive <= 0) return; drips.alive -= dt;
  const P = drips.pos, C = drips.col, Z = drips.sz;
  for (let i = 0; i < DRIP_N; i++) {
    if (drips.life[i] <= 0) { if (P[i * 3 + 1] > -400) { P[i * 3 + 1] = -500; Z[i] = 0; drips.pc[i] = null; } continue; }
    const l = drips.life[i] -= dt; let heat = 1;
    if (drips.hang[i] > 0) {                                     // swells on the rim...
      drips.hang[i] -= dt; const pc = drips.pc[i];
      if (pc && pc.body && !pc.dying) dripAt(pc, i); else drips.hang[i] = 0;
      Z[i] = .008 + .01 * clamp(1 - drips.hang[i] / .45, 0, 1);
      if (drips.hang[i] <= 0) dripFall(i);
    } else if (P[i * 3 + 1] > drips.land[i]) {                   // ...falls...
      drips.v[i] -= 9.8 * dt; P[i * 3 + 1] = Math.max(drips.land[i], P[i * 3 + 1] + drips.v[i] * dt); Z[i] = .016;
      if (P[i * 3 + 1] <= drips.land[i]) { drips.life[i] = Math.min(l, 1.7); if (drips.rare[i]) { if (ac) { tone('sine', 1320, 1760, .2, .07); tone('sine', 1980, 2640, .25, .05, .08); } } else if (rnd() < .4) sfxPlip(); }
    } else { heat = clamp(l / 1.7, 0, 1); Z[i] = .025 * (1.25 - .45 * heat); }   // ...splats flat and cools down
    C[i * 3] = .5 + .5 * heat; C[i * 3 + 1] = .07 + .62 * heat * heat; C[i * 3 + 2] = .02 + .22 * heat * heat * heat;
    if (drips.rare[i]) { _dripC.setHSL((tAll * .9 + i * .13) % 1, 1, .45 + .2 * heat); C[i * 3] = _dripC.r; C[i * 3 + 1] = _dripC.g; C[i * 3 + 2] = _dripC.b; }
  }
  drips.geo.attributes.position.needsUpdate = true; drips.geo.attributes.color.needsUpdate = true; drips.geo.attributes.sz.needsUpdate = true;
}

/* ---- sounds ---- */
function sfxSlice(vol) {
  if (!ac) return; const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'bandpass'; f.Q.value = 1.6; f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(1500, t + .13);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.45, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + .16);
  n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + .18);
  const p = 300 + 500 * Math.pow(clamp(1 - vol / (CUBE ** 3), 0, 1), 2);
  tone('sine', p * 1.6, p, .07, .16);
}
const sfxSizzle = () => { if (!ac) return; const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 3800; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.1, t + .03); g.gain.exponentialRampToValueAtTime(.001, t + .5); n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + .55); };
const sfxPlip = () => { if (!ac) return; const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 5200; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.035, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + .18); n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + .2); };
const sfxAnime = () => { if (!ac) return; tone('sine', 2900, 2700, .6, .1); tone('triangle', 4400, 4300, .35, .05, .02); };
const sfxSlide = () => { if (!ac) return; const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(300, t + .35); g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .4); n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + .42); tone('sine', 160, 70, .2, .25, .3); };
const sfxShing = () => { if (!ac) return; tone('triangle', 1800, 2600, .35, .12); tone('sine', 3200, 3900, .45, .08, .03); sfxTap('rock', .4); };
const sfxPress = good => { if (!ac) return; tone('square', good ? 520 : 300, good ? 880 : 180, .12, .14); tone('sine', 140, 90, .08, .3); };
const sfxWhoosh = () => { if (!ac) return; const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + .35); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .5); n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + .5); tone('sine', 200, 900, .45, .2); };

