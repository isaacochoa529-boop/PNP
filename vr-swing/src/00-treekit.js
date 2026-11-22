import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// TreeKit: finished low-poly trees for Three.js. Safe on r128 and newer (no CapsuleGeometry, no newer-only APIs).
// Every tree is ONE merged BufferGeometry with vertex colors and flat (per-face) normals, so it can be
// instanced (hundreds of trees = one draw call) and needs no textures.
//   const mesh = TreeKit.mesh('oak', {seed: 3});                  // a single tree, y=0 at the roots
//   const {meshes, slots} = TreeKit.scatter('pine', placements);  // placements: [{x,y,z,s,ry}] -> instanced forest
// Cost: pine/snowpine ~200 triangles, oak/birch/palm ~700 at the default detail. Pass {detail: 0} (to mesh() or scatter())
// for roughly 60% fewer triangles on the round-canopy trees: use it on phones or for very large forests.
// TreeKit.info[type] gives the envelope (height, canopy base height, canopy radius, trunk radius) at scale 1,
// for collision, camera fading, spawning, and so on.
const TreeKit = (() => {
  const C = h => new THREE.Color(h);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function rng(seed) { let s = (Math.floor((seed || 1) * 7919) + 1013904223) >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  // same input coordinate -> same offset, so jittered vertices that share a corner never crack apart
  const hash3 = (x, y, z, k) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 19.19) * 43758.5453; return v - Math.floor(v) - .5; };
  const prep = g => g.index ? g.toNonIndexed() : g;
  function jitter(g, amt, k) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + hash3(x, y, z, k) * amt, y + hash3(x, y, z, k + 1) * amt, z + hash3(x, y, z, k + 2) * amt); } return g; }
  function put(g, { pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], quat = null } = {}) {
    const q = quat || new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(pos[0], pos[1], pos[2]), q, new THREE.Vector3(scl[0], scl[1], scl[2]))); return g;
  }
  const along = (from, to) => new THREE.Quaternion().setFromUnitVectors(from, to.clone().normalize());
  const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
  function paint(g, fn) { const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(); for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; }
  function merge(list) {
    let n = 0; list.forEach(g => n += g.attributes.position.count);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const g of list) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeVertexNormals(); return out; // not indexed => every face gets its own normal => crisp faceted look
  }
  // bark: tapered, slightly bent trunk with darker roots and lighter upper trunk
  function trunk(r, rTop, rBot, h, light, dark, k) {
    const g = prep(new THREE.CylinderGeometry(rTop, rBot, h, 7, 3)); jitter(g, rBot * .12, k); put(g, { pos: [0, h / 2, 0], rot: [0, r() * 6, 0] });
    return paint(g, (c, x, y) => c.copy(light).lerp(dark, clamp(1 - y / (h * .7), 0, 1)));
  }
  function flare(r, rad, k) { // root flare so the trunk does not look like a stick stuck in the ground
    const g = prep(new THREE.ConeGeometry(rad, .9, 7)); jitter(g, rad * .1, k); put(g, { pos: [0, .45, 0], rot: [0, r() * 6, 0] });
    return paint(g, c => c.set(0x3f2a18));
  }
  function branch(from, to, r0, r1, col) { // a stick from point to point
    const d = to.clone().sub(from), len = d.length(), g = prep(new THREE.CylinderGeometry(r1, r0, len, 5));
    put(g, { pos: [(from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2], quat: along(UP, d) }); return paint(g, c => c.copy(col));
  }

  // ---------------- pine ----------------
  function pine(o) {
    const r = rng(o.seed), parts = [], bark = C(0x7a4f2c), barkD = C(0x3b2716);
    parts.push(trunk(r, .32, .62, 4.6, bark, barkD, 1), flare(r, .95, 2));
    const N = 5;
    for (let i = 0; i < N; i++) {
      const by = 3.5 + i * 1.25, h = 4.2 - i * .55, rad = 2.6 - i * .5 + (r() - .5) * .15;
      const g = prep(new THREE.ConeGeometry(rad, h, 8, 1));
      const pa = g.attributes.position;
      for (let v = 0; v < pa.count; v++) { // jagged drooping skirt: every other base vertex hangs lower and flares out
        const x = pa.getX(v), y = pa.getY(v), z = pa.getZ(v);
        if (y < -h / 2 + 1e-3 && Math.hypot(x, z) > .01) { const k = Math.round(Math.atan2(z, x) / (Math.PI / 4)); if (k & 1) pa.setXYZ(v, x * 1.12, y - .32, z * 1.12); }
      }
      jitter(g, .22, 10 + i); put(g, { pos: [0, by + h / 2, 0], rot: [0, r() * 6, 0] });
      const base = C(0x1d5a2b).lerp(C(0x2f8a3e), i / (N - 1)).offsetHSL((r() - .5) * .03, 0, 0), dk = base.clone().multiplyScalar(.74), lt = base.clone().multiplyScalar(1.35);
      parts.push(paint(g, (c, x, y) => c.copy(dk).lerp(lt, clamp((y - by) / h, 0, 1))));
    }
    return parts;
  }
  function snowpine(o) { // pine whose upward-facing surfaces are snow
    const parts = pine(o), out = [];
    for (const g of parts) { g.computeVertexNormals(); const n = g.attributes.normal, p = g.attributes.position, col = g.attributes.color, c = new THREE.Color();
      for (let i = 0; i < p.count; i++) { if (p.getY(i) > 3.4 && n.getY(i) > .1) { c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).lerp(C(0xf4f8fc), clamp((n.getY(i) + .05) * 3, 0, 1));col.setXYZ(i, c.r, c.g, c.b); } }
      out.push(g); }
    return out;
  }
  // ---------------- oak (round canopy of overlapping blobs) ----------------
  function oak(o) {
    const r = rng(o.seed), parts = [], bark = C(0x7b5532), barkD = C(0x3e2a18), leaf = C(0x3f9a3f);
    parts.push(trunk(r, .4, .7, 4.8, bark, barkD, 1), flare(r, 1.05, 2));
    for (let i = 0; i < 3; i++) { const a = r() * 6.28 + i * 2.1, from = new THREE.Vector3(0, 3.6 + i * .3, 0), to = new THREE.Vector3(Math.cos(a) * 1.7, 5.4 + r() * .8, Math.sin(a) * 1.7); parts.push(branch(from, to, .24, .12, bark)); }
    const blobs = [[0, 7.6, 0, 2.2]];
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + r() * .6, s = 1.5 + r() * 1.1; blobs.push([Math.cos(a) * s, 5.9 + r() * 1.7, Math.sin(a) * s, 1.4 + r() * .8]); }
    for (const [x, y, z, rad] of blobs) {
      const g = prep(new THREE.IcosahedronGeometry(rad, o.detail === 0 ? 0 : 1)); jitter(g, rad * .3, 20); put(g, { pos: [x, y, z], rot: [r() * 3, r() * 3, 0], scl: [1, .85, 1] });
      const base = leaf.clone().offsetHSL((r() - .5) * .05, (r() - .5) * .08, (r() - .5) * .06), dk = base.clone().multiplyScalar(.68), lt = base.clone().multiplyScalar(1.3);
      parts.push(paint(g, (c, px, py) => c.copy(dk).lerp(lt, clamp((py - 4.5) / 5.2, 0, 1))));
    }
    return parts;
  }
  // ---------------- birch (white bark with dark marks, airy yellow-green leaves) ----------------
  function birch(o) {
    const r = rng(o.seed), parts = [], g0 = prep(new THREE.CylinderGeometry(.22, .36, 6.6, 6, 3)); jitter(g0, .05, 1); put(g0, { pos: [0, 3.3, 0], rot: [0, r() * 6, 0] });
    parts.push(paint(g0, (c, x, y) => c.set(0xece8dc).lerp(C(0xb5ae9c), clamp(1 - y / 2.5, 0, 1) * .6)));
    for (let i = 0; i < 9; i++) { const y = .6 + r() * 5.4, a = r() * 6.28, rd = .3 - y * .01, m = prep(new THREE.BoxGeometry(.26 + r() * .2, .1 + r() * .08, .06)); put(m, { pos: [Math.cos(a) * rd, y, Math.sin(a) * rd], rot: [0, -a + 1.57, 0] }); parts.push(paint(m, c => c.set(0x2a2622))); }
    parts.push(branch(new THREE.Vector3(0, 5, 0), new THREE.Vector3(1.2, 6.4, .3), .12, .06, C(0xd8d3c4)), branch(new THREE.Vector3(0, 4.4, 0), new THREE.Vector3(-1.1, 5.9, -.4), .1, .05, C(0xd8d3c4)));
    const base = C(0x7fae3f);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + r(), s = r() * 1.3, rad = 1 + r() * .6, x = Math.cos(a) * s, y = 6.4 + r() * 2, z = Math.sin(a) * s;
      const g = prep(new THREE.IcosahedronGeometry(rad, o.detail === 0 ? 0 : 1)); jitter(g, rad * .3, 30); put(g, { pos: [x, y, z], rot: [r() * 3, r() * 3, 0], scl: [1, .8, 1] });
      const b = base.clone().offsetHSL((r() - .5) * .05, 0, (r() - .5) * .08); parts.push(paint(g, (c, px, py) => c.copy(b).multiplyScalar(.8).lerp(b.clone().multiplyScalar(1.15), clamp((py - 5.4) / 3.5, 0, 1)))); }
    return parts;
  }
  // ---------------- palm (bent trunk, drooping fronds, coconuts) ----------------
  function palm(o) {
    const r = rng(o.seed), parts = [], phi = r() * 6.28, lean = .12 + r() * .16, p =new THREE.Vector3(0, 0, 0), seg = 8, len = .95;
    for (let i = 0; i < seg; i++) {
      const a = lean * (i / (seg - 1)) * 1.3, d = new THREE.Vector3(Math.sin(a) * Math.cos(phi), Math.cos(a), Math.sin(a) * Math.sin(phi)), rb = .4 - i * .03, rt = .4 - (i + 1) * .03;
      const g = prep(new THREE.CylinderGeometry(rt, rb, len, 7)); put(g, { pos: [p.x + d.x * len / 2, p.y + d.y * len / 2, p.z + d.z * len / 2], quat: along(UP, d) });
      parts.push(paint(g, c => c.set(i % 2 ? 0x8a6a45 : 0x7a5a38))); p.addScaledVector(d, len);
    }
    for (let k = 0; k < 10; k++) { // fronds: chained leaf plates that curve downward
      const yaw = k / 10 * 6.28 + r() * .3, fp = p.clone(); let pitch = .6 + r() * .25;
      for (let j = 0; j < 4; j++) {
        const d = new THREE.Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)), l = 1.5 - j * .12;
        const g = prep(new THREE.BoxGeometry(1.05 - j * .2, .05, l)); put(g, { pos: [fp.x + d.x * l / 2, fp.y + d.y * l / 2, fp.z + d.z * l / 2], quat: along(FWD, d) });
        const gc = C(0x2f8f3a).lerp(C(0x7fc24a), j / 3); parts.push(paint(g, c => c.copy(gc))); fp.addScaledVector(d, l); pitch -= .42 + r() * .1;
      }
    }
    for (let i = 0; i < 3; i++) { const a = i * 2.1, g = prep(new THREE.IcosahedronGeometry(.24, 0)); put(g, { pos: [p.x + Math.cos(a) * .3, p.y - .25, p.z + Math.sin(a) * .3] }); parts.push(paint(g, c => c.set(0x5a3b1f))); }
    return parts;
  }
  // ---------------- dead tree ----------------
  function dead(o) {
    const r = rng(o.seed), parts = [], bark = C(0x6f655a), barkD = C(0x3a342d);
    parts.push(trunk(r, .26, .55, 5.6, bark, barkD, 1), flare(r, .9, 2));
    for (let i = 0; i < 6; i++) {
      const a = r() * 6.28 + i, y = 2.4 + i * .5, from = new THREE.Vector3(0, y, 0), to = new THREE.Vector3(Math.cos(a) * (1.4 + r()), y + .9 + r() * 1.1, Math.sin(a) * (1.4 + r()));
      parts.push(branch(from, to, .2, .08, bark));
      const mid = from.clone().lerp(to, .6), tip = to.clone().add(new THREE.Vector3(Math.cos(a + .8) * .8, .7 + r() * .5, Math.sin(a + .8) * .8)); parts.push(branch(mid, tip, .1, .04, barkD));
    }
    return parts;
  }

  const builders = { pine, snowpine, oak, birch, palm, dead };
  const info = { // envelope at scale 1: height, canopy base height, canopy radius (at its widest), trunk radius
    pine: { height: 10.5, canopyBase: 3.5, canopyR: 2.6, trunkR: .6 }, snowpine: { height: 10.5, canopyBase: 3.5, canopyR: 2.8, trunkR: .6 },
    oak: { height: 9.8, canopyBase: 4.6, canopyR: 3.6, trunkR: .7 }, birch: { height: 8.8, canopyBase: 5.4, canopyR: 2.4, trunkR: .36 },
    palm: { height: 8.5, canopyBase: 7.2, canopyR: 3.6, trunkR: .34 }, dead: { height: 6.8, canopyBase: 2.4, canopyR: 2.4, trunkR: .55 },
  };
  const geometry = (type, o) => { if (!builders[type]) throw new Error('TreeKit: unknown type ' + type + ' (use ' + Object.keys(builders).join(', ') + ')'); return merge(builders[type](o || {})); };
  const material = () => new THREE.MeshLambertMaterial({ vertexColors: true });
  function mesh(type, o) { const m = new THREE.Mesh(geometry(type, o), material()); m.castShadow = true; m.receiveShadow = true; return m; }
  // forest: placements [{x,y,z,s,ry}] -> InstancedMesh per variant (variants stop the forest looking cloned).
  // slots[k] = {mesh, index} tells you which instance placement k became (handy for per-tree effects like fading).
  function scatter(type, placements, o) {
    o = o || {}; const variants = o.variants || 4, mat = o.material || material(), groups = [], slots = new Array(placements.length), meshes = [];
    for (let v = 0; v < variants; v++) groups.push([]);
    placements.forEach((pl, k) => groups[k % variants].push(k));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    groups.forEach((ids, v) => {
      if (!ids.length) return; const im = new THREE.InstancedMesh(geometry(type, { seed: v + 1, detail: o.detail }), mat, ids.length); im.castShadow = im.receiveShadow = true;
      ids.forEach((k, idx) => { const pl = placements[k], s = pl.s || 1; q.setFromEuler(e.set(0, pl.ry || 0, 0)); m4.compose(new THREE.Vector3(pl.x, pl.y || 0, pl.z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(idx, m4); slots[k] = { mesh: im, index: idx }; });
      meshes.push(im);
    });
    return { meshes, slots };
  }
  return { types: Object.keys(builders), info, geometry, material, mesh, scatter };
})();

