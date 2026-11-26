/* ======================= materials & builders ======================= */
const matCache = {};
const mat = (color, o = {}) => { const k = color + JSON.stringify(o); return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .9, flatShading: true }, o))); };
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true });
function jitterGeo(g, amt, k = 0) {
  if (g.index) g = g.toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + hsh(x, y, z, k) * amt, y + hsh(x, y, z, k + 1) * amt, z + hsh(x, y, z, k + 2) * amt); }
  g.computeVertexNormals(); return g;
}
function paint(g, fn) { const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(); for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i)); col.set([c.r, c.g, c.b], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; }
const OWN = { rock: { tag: 'rock' }, wood: { tag: 'wood' }, grass: { tag: 'grass' }, mush: { tag: 'mush' } };
const shadowy = m => { m.castShadow = true; m.receiveShadow = true; return m; };

function box(x, y, z, w, h, d, color, o = {}) {
  const m = shadowy(new THREE.Mesh(o.geo || new THREE.BoxGeometry(w, h, d), o.material || mat(color)));
  m.position.set(x, y, z); m.rotation.y = o.yaw || 0; scene.add(m);
  if (o.solid !== false) m.userData.col = addCol({ t: 0, x, y, z, hx: w / 2, hy: h / 2, hz: d / 2, yaw: o.yaw || 0, bounce: o.bounce, tag: o.tag || 'wood', mesh: m });
  return m;
}
function rock(x, y, z, r, o = {}) {
  const g = paint(jitterGeo(new THREE.IcosahedronGeometry(r, 1), r * .28, x), (c, px, py) => c.setHSL(.28 + hsh(px, py, 0, 3) * .04, .08, .42 + py / r * .12 + hsh(px, py, 1, 2) * .06));
  const m = shadowy(new THREE.Mesh(g, vcMat)); m.position.set(x, y, z); m.scale.set(1, o.sy || 1, 1); scene.add(m);
  addMeshCollider(m, OWN.rock);
  return m;
}

/* ---------------- ground ---------------- */
{
  const g = new THREE.PlaneGeometry(90, 90, 60, 60); g.rotateX(-Math.PI / 2);
  paint(g, (c, x, y, z) => { const r = Math.hypot(x, z); c.setHSL(.27 + hsh(x, 0, z, 1) * .05, .55, .38 + hsh(x, 0, z, 2) * .07 - (r > 28 ? .08 : 0)); });
  const m = new THREE.Mesh(g, vcMat); m.receiveShadow = true; scene.add(m);
  addCol({ t: 0, x: 0, y: -2, z: 0, hx: 60, hy: 2, hz: 60, tag: 'grass' });
  // grass tufts (instanced)
  const tg = new THREE.ConeGeometry(.07, .35, 4); tg.translate(0, .17, 0);
  const tm = new THREE.InstancedMesh(tg, mat(0x3f9b3c), 700); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 700; i++) { const a = rnd() * 6.283, r = 3 + rnd() * 26, s = .6 + rnd() * .9; q.setFromEuler(e.set((rnd() - .5) * .5, rnd() * 3, (rnd() - .5) * .5)); m4.compose(V(Math.cos(a) * r, 0, Math.sin(a) * r), q, V(s, s, s)); tm.setMatrixAt(i, m4); }
  scene.add(tm);
  // flowers
  const fg = new THREE.IcosahedronGeometry(.07, 0); const cols = [0xffe14f, 0xff6fb8, 0xffffff, 0xa98bff];
  cols.forEach((col, ci) => { const fm = new THREE.InstancedMesh(fg, mat(col, { emissive: col, emissiveIntensity: .15 }), 60);
    for (let i = 0; i < 60; i++) { const a = rnd() * 6.283, r = 3 + rnd() * 25; m4.compose(V(Math.cos(a) * r, .12, Math.sin(a) * r), q.identity(), V(1, .6, 1)); fm.setMatrixAt(i, m4); } scene.add(fm); });
}

/* ---------------- cliffs around the grove (climbable!) ---------------- */
const cliffTops = [];
{
  const N = 18, R = 31;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, h = i === 5 ? 17 : (i === 13 ? 7 : 9 + rnd() * 6), w = 2 * Math.PI * (R + 2) / N * 1.12, d = 4;
    const x = Math.cos(a) * (R + 2), z = Math.sin(a) * (R + 2), yaw = Math.atan2(Math.cos(a), Math.sin(a));
    const g = paint(jitterGeo(new THREE.BoxGeometry(w, h, d, 5, Math.ceil(h / 2), 1), .35, i), (c, px, py) => {
      const band = Math.sin((py + h / 2) * 1.7 + i) * .5 + .5; c.setHSL(.07 + band * .03, .32, .44 + band * .1 + hsh(px, py, i, 4) * .05);
    });
    addMeshCollider(box(x, h / 2, z, w, h, d, 0, { geo: g, material: vcMat, yaw, solid: false }), OWN.rock);
    // grassy cap on top
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w, .25, d + .2), mat(0x4caf50)); cap.position.set(x, h + .1, z); cap.rotation.y = yaw; cap.receiveShadow = true; scene.add(cap);
    cliffTops.push({ i, x: Math.cos(a) * (R + 1.5), z: Math.sin(a) * (R + 1.5), h });
    // invisible wall behind the rim so nobody climbs out of the world
    addCol({ t: 0, x: Math.cos(a) * (R + 6), y: 30, z: Math.sin(a) * (R + 6), hx: w / 2 + 1, hy: 30, hz: 1.5, yaw, tag: 'rock' });
  }
}

/* ---------------- trees from the model kit ---------------- */
function trunkRadius(geo, y0, y1) {
  const p = geo.attributes.position, rs = [];
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > y0 && y < y1) rs.push(Math.hypot(p.getX(i), p.getZ(i))); }
  rs.sort((a, b) => a - b); return rs.length ? rs[Math.floor(rs.length * .85)] : .5;
}
function bigTree(type, x, z, s, seed) {
  const t = TreeKit.mesh(type, { seed }); t.position.set(x, -.1, z); t.scale.setScalar(s); t.rotation.y = seed; scene.add(t);
  const inf = TreeKit.info[type], tr = trunkRadius(t.geometry, inf.canopyBase * .25, inf.canopyBase * .7) * s;
  const cut = -.1 + inf.canopyBase * s * .97;
  addMeshCollider(t, OWN.wood, (a, b, c) => Math.max(a.y, b.y, c.y) < cut);
  return { x, z, s, top: inf.canopyBase * s, r: tr };
}
const oakA = bigTree('oak', -12, -8, 1.6, 2);
const oakB = bigTree('oak', 14, -9, 1.45, 5);
const oakC = bigTree('oak', -17, 12, 1.5, 8);
const oakD = bigTree('oak', 11, 14, 1.35, 11);
bigTree('birch', 4, -22, 1.4, 3); bigTree('birch', -24, -2, 1.3, 6); bigTree('birch', 22, 4, 1.3, 9);
const HUNT_HOLE_A = -.95;   // where THE HUNT's red hole is in the cliff wall (99-hunt)
{ // ring of pines by the cliffs
  const pl = [];
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283 + rnd() * .15, r = 26 + rnd() * 2.5; pl.push({ x: Math.cos(a) * r, y: -.1, z: Math.sin(a) * r, s: .9 + rnd() * .6, ry: rnd() * 6 }); }
  for (let i = pl.length - 1; i >= 0; i--) { const d = Math.atan2(pl[i].z, pl[i].x) - HUNT_HOLE_A; if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < .26) pl.splice(i, 1); }   // keep THE HUNT's red hole clear (99-hunt)
  TreeKit.scatter('pine', pl, { variants: 4 }).meshes.forEach(m => scene.add(m));
  pl.forEach(p => addCol({ t: 1, x: p.x, z: p.z, cy: 1.8 * p.s, hy: 1.8 * p.s, r: .32 * p.s, tag: 'wood' }));
}

/* ---------------- spawn stump ---------------- */
{
  const top = document.createElement('canvas'); top.width = top.height = 256; const g = top.getContext('2d');
  g.fillStyle = '#d9a86a'; g.fillRect(0, 0, 256, 256);
  for (let r = 120; r > 4; r -= 9 + Math.random() * 6) { g.strokeStyle = r % 2 ? '#b98545' : '#c8955a'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); }
  const tt = new THREE.CanvasTexture(top); tt.colorSpace = THREE.SRGBColorSpace;
  const side = mat(0x7a4d2b);
  const m = shadowy(new THREE.Mesh(jitterGeo(new THREE.CylinderGeometry(2.2, 2.5, .55, 18, 2), .06), [side, new THREE.MeshStandardMaterial({ map: tt, roughness: .9 }), side]));
  m.position.set(0, .275, 0); scene.add(m);
  addMeshCollider(m, OWN.wood);
}

/* ---------------- sign with instructions ---------------- */
function textPanel(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return { cv, g, t };
}
{
  const p = textPanel(1024, 640, (g, w, h) => {
    g.fillStyle = '#8a5a32'; g.fillRect(0, 0, w, h); g.fillStyle = '#a8713f'; for (let y = 0; y < h; y += 80) g.fillRect(0, y + 4, w, 72);
    g.textAlign = 'center'; g.fillStyle = '#ffd25a'; g.font = '96px "Lilita One", Impact, sans-serif'; g.fillText('KNUCKLE GROVE', w / 2, 120);
    g.fillStyle = '#fff6e0'; g.font = '44px Fredoka, sans-serif';
    ['Slap the ground + push it back = RUN', 'Shove down hard + let go = JUMP', 'Grab a wall, pull down = CLIMB', 'Find all 15 glow berries!', 'Right stick turns · B / Y respawns']
      .forEach((s, i) => g.fillText(s, w / 2, 220 + i * 82));
  });
  const sg = new THREE.Group(); sg.position.set(3.6, 0, -3.2); sg.rotation.y = -0.75; scene.add(sg);
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, .08), [mat(0x6b4426), mat(0x6b4426), mat(0x6b4426), mat(0x6b4426), new THREE.MeshStandardMaterial({ map: p.t, roughness: .9 }), mat(0x6b4426)]);
  board.position.y = 1.75; board.castShadow = true; sg.add(board);
  [-1, 1].forEach(s => { const post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, 2.6, 8), mat(0x5a3a20))); post.position.set(s * 1.05, 1.3, -.06); sg.add(post); });
  addCol({ t: 0, x: 3.6, y: 1.3, z: -3.2, hx: 1.25, hy: 1.3, hz: .1, yaw: -0.75, tag: 'wood' });
}

/* ---------------- mushrooms (stepping stones + bouncy ones) ---------------- */
const mushrooms = [];
function mushroom(x, z, h, cr, color, bouncy) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const stem = shadowy(new THREE.Mesh(jitterGeo(new THREE.CylinderGeometry(cr * .24, cr * .32, h, 10, 3), .02), mat(0xf5ecd8))); stem.position.y = h / 2; g.add(stem);
  const capG = new THREE.Group(); capG.position.y = h; g.add(capG);
  const capMat = bouncy ? mat(color, { emissive: color, emissiveIntensity: .45 }) : mat(color);
  const cap = shadowy(new THREE.Mesh(new THREE.SphereGeometry(cr, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat)); cap.scale.y = .55; capG.add(cap);
  const under = new THREE.Mesh(new THREE.CircleGeometry(cr * .98, 18), mat(0xf0d9b5)); under.rotation.x = Math.PI / 2; under.position.y = .01; capG.add(under);
  const dm = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: bouncy ? .5 : .05 });
  for (let i = 0; i < 7; i++) { const a = rnd() * 6.283, el = .35 + rnd() * .8; const d = new THREE.Mesh(new THREE.SphereGeometry(cr * .11, 8, 6), dm);
    d.position.set(Math.cos(a) * Math.cos(el) * cr, Math.sin(el) * cr * .55, Math.sin(a) * Math.cos(el) * cr); d.scale.y = .4; d.lookAt(d.position.clone().multiplyScalar(2)); capG.add(d); }
  const top = h + cr * .55;
  const owner = { tag: 'mush', bounce: bouncy || 0 };
  const m = { g, capG, col: owner, bouncy, squish: 0, top };
  owner.mush = m; mushrooms.push(m);
  addMeshCollider(stem, OWN.mush); addMeshCollider(cap, owner); addMeshCollider(under, owner);
  return m;
}
// stepping path up to oak B's lookout
const path = [[5, -2, 1.1, 1.1, 0xff5a4f], [7.5, -4.5, 1.9, 1.2, 0xff8a3d], [9.5, -2.2, 2.7, 1.1, 0xffc93d], [11.2, -5.0, 3.5, 1.2, 0xff5a4f], [10.8, -7.6, 4.25, 1.0, 0xff8a3d]];
path.forEach(p => mushroom(p[0], p[1], p[2], p[3], p[4]));
const boingA = mushroom(2.2, 12.6, .55, 1.3, 0x3fd8ff, 11.5);  // in front of the climbing wall
const boingB = mushroom(-4.5, 4, .5, 1.2, 0xb36bff, 10);        // near spawn
const boingC = mushroom(-6, -16.5, .5, 1.1, 0x3fd8ff, 12);      // under the sky island
mushroom(-20, 4, 1.4, 1.3, 0xff5a4f); mushroom(-21.5, 6.5, 2.3, 1.1, 0xffc93d); mushroom(19, -16, 1.6, 1.4, 0xff8a3d);

/* ---------------- treehouse on oak A + spiral steps ---------------- */
const wood = 0xa86b3c, woodD = 0x7c4a26;
function deck(cx, y, cz, w, d, rails) {
  const plankG = new THREE.Group(); scene.add(plankG);
  for (let i = 0; i < Math.round(w / .5); i++) { const pm = shadowy(new THREE.Mesh(new THREE.BoxGeometry(.46, .22, d), mat(i % 2 ? wood : 0xb87a46))); pm.position.set(cx - w / 2 + .25 + i * .5, y, cz); plankG.add(pm); }
  addCol({ t: 0, x: cx, y, z: cz, hx: w / 2, hy: .11, hz: d / 2, tag: 'wood' });
  (rails || []).forEach(s => { // s: 'n','s','e','w'
    const along = s === 'n' || s === 's', L = along ? w : d;
    const rx = s === 'e' ? cx + w / 2 - .06 : s === 'w' ? cx - w / 2 + .06 : cx, rz = s === 'n' ? cz - d / 2 + .06 : s === 's' ? cz + d / 2 - .06 : cz;
    box(rx, y + .55, rz, along ? L : .1, .1, along ? .1 : L, woodD);
    for (let k = 0; k <= L / 1.2; k++) { const t = -L / 2 + k * (L / Math.ceil(L / 1.2)); box(along ? rx + t : rx, y + .3, along ? rz : rz + t, .1, .5, .1, woodD, { solid: false }); }
  });
}
const houseY = 5.5;
deck(oakA.x, houseY, oakA.z, 5, 5, ['w', 'n']);
{ // little roof + walls of the treehouse hut
  const hx = oakA.x - 1.2, hz = oakA.z - 1.2;
  box(hx, houseY + 1.1, hz - 1.0, 2.4, 2, .12, 0xd58b4a); box(hx - 1.15, houseY + 1.1, hz, .12, 2, 2, 0xd58b4a);
  const roof = shadowy(new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.3, 4), mat(0xd94f3d))); roof.position.set(hx, houseY + 2.75, hz); roof.rotation.y = Math.PI / 4; scene.add(roof);
  addCol({ t: 0, x: hx, y: houseY + 2.2, z: hz, hx: 1.3, hy: .15, hz: 1.3, tag: 'wood' });
}
for (let i = 0; i < 10; i++) { // spiral plank steps around oak A
  const a = 2.4 + i * .62, r = 3.25, y = .5 + i * .5;
  box(oakA.x + Math.cos(a) * r, y, oakA.z + Math.sin(a) * r, 1.25, .2, .8, i % 2 ? wood : 0xb87a46, { yaw: -a });
}
// lookout on oak B (end of the mushroom path)
deck(oakB.x, 4.6, oakB.z, 3.6, 3.6, ['e', 's']);
// small branch ledge on oak D
deck(oakD.x + 1.6, 3.3, oakD.z, 1.8, 1.4);

/* ---------------- sky island + log bridge ---------------- */
const isl = { x: -2, z: -16, top: 5.6 };
{
  const under = shadowy(new THREE.Mesh(paint(jitterGeo(new THREE.ConeGeometry(3.1, 3.2, 10, 3), .25, 5), (c, x, y) => c.setHSL(.08, .3, .38 + y * .04)), vcMat));
  under.rotation.x = Math.PI; under.position.set(isl.x, isl.top - 1.85, isl.z); scene.add(under);
  const grass = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.1, .3, 10), mat(0x52b84a))); grass.position.set(isl.x, isl.top - .15, isl.z); scene.add(grass);
  addMeshCollider(grass, OWN.grass); addMeshCollider(under, OWN.rock);
  rock(isl.x + 1.6, isl.top + .3, isl.z - 1.2, .6);
  const ib = TreeKit.mesh('birch', { seed: 4 }); ib.scale.setScalar(.6); ib.position.set(isl.x - 1.4, isl.top - .1, isl.z - 1); scene.add(ib);
  addMeshCollider(ib, OWN.wood, (a, b, c) => Math.max(a.y, b.y, c.y) < isl.top - .1 + 5.4 * .6 * .97);
}
// log from the treehouse deck edge to the island
const logA = V(oakA.x + 2.6, houseY, oakA.z - 1.2), logB = V(isl.x - 2.8, isl.top - .2, isl.z + 1.2);
{
  const mid = logA.clone().add(logB).multiplyScalar(.5), dx = logB.x - logA.x, dz = logB.z - logA.z, L = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
  const g = paint(jitterGeo(new THREE.CylinderGeometry(.38, .42, L, 10, 6), .03), (c, x, y, z) => c.setHSL(.07, .45, .3 + hsh(x, y, z, 5) * .08));
  g.rotateZ(Math.PI / 2);
  const m = shadowy(new THREE.Mesh(g, vcMat)); m.position.set(mid.x, mid.y, mid.z); m.rotation.y = yaw; scene.add(m);
  addMeshCollider(m, OWN.wood);
  scene.userData.logMid = mid;
}

/* ---------------- the Knuckle Wall (a climbing wall with holds you can GRAB) ---------------- */
const HOLDS = [];
{
  const wx = 0, wz = 17.5, w = 9, h = 5;
  box(wx, h / 2, wz, w, h, 1, 0, { geo: paint(new THREE.BoxGeometry(w, h, 1, 9, 5, 1), (c, x, y) => c.setHSL(.6, .2, .5 + ((Math.floor(x + 10) + Math.floor(y)) % 2) * .06)), material: vcMat, tag: 'rock' });
  const hc = [0xff4f6d, 0xffd25a, 0x3fe0bd, 0x8b6bff, 0xff8a3d];
  for (let i = 0; i < 40; i++) { const r = .12 + rnd() * .08, hm = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(hc[i % 5])); hm.position.set(wx - w / 2 + .4 + rnd() * (w - .8), .4 + rnd() * (h - .6), wz - .55); scene.add(hm); HOLDS.push({ m: hm, p: hm.position, r, n: V(0, 0, -1) }); }
  deck(wx, h + .1, wz + 1.2, w, 3.4, ['s', 'e', 'w']);
}

/* ---------------- pond with lily pads ---------------- */
{
  const pond = new THREE.Mesh(new THREE.CircleGeometry(4.2, 28), new THREE.MeshStandardMaterial({ color: 0x3fa9e8, roughness: .15, metalness: .1, transparent: true, opacity: .85 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(-10, .03, 13); scene.add(pond); scene.userData.pond = pond;
  for (let i = 0; i < 6; i++) { const a = i * 1.1, r = 1 + (i % 3) * 1.1; const pad = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .05, 12, 1, false, 0, 5.6), mat(0x2f9a4a)); pad.position.set(-10 + Math.cos(a) * r, .06, 13 + Math.sin(a) * r); pad.rotation.y = a; scene.add(pad); }
}

/* ---------------- boulders ---------------- */
const bigRock = { x: 6, z: 6, r: 1.9 };
rock(bigRock.x, .9, bigRock.z, bigRock.r);
[[-7, -3, 1.1], [17, 9, 1.4], [-15, -18, 1.6], [20, -4, 1.0], [-3, 22, 1.2], [23.5, 14.5, 1.3], [-25, 15, 1.5], [8, -14, .9], [-19, -11, 1.0], [0, -9, .8]]
  .forEach(([x, z, r]) => rock(x, r * .55, z, r, { sy: .8 }));

/* ======================= glow berries & secrets ======================= */
const berries = [];
const berryMat = new THREE.MeshStandardMaterial({ color: 0xc23cff, emissive: 0xa020ff, emissiveIntensity: .9, roughness: .3 });
const leafMat = mat(0x4fd65a);
function berry(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  [[0, 0, 0], [.11, -.05, .05], [-.09, -.06, .06], [.01, -.07, -.1]].forEach(([a, b, c]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), berryMat); s.position.set(a, b, c); g.add(s); });
  const lf = new THREE.Mesh(new THREE.ConeGeometry(.06, .14, 4), leafMat); lf.position.y = .1; g.add(lf);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xd070ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(.9); g.add(halo);
  berries.push({ g, base: y, taken: false, ph: rnd() * 6 });
}
let _glow;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c));
}
const lm = scene.userData.logMid;
const lowCliff = cliffTops.find(c => c.i === 13), tallCliff = cliffTops.find(c => c.i === 5);
[
  [oakA.x + 1.5, houseY + .7, oakA.z + 1.5],          // treehouse
  [isl.x + .5, isl.top + .6, isl.z + .5],               // sky island
  [lm.x, lm.y + .9, lm.z],                              // middle of the log
  [0, 5.9, 18.6],                                       // top of the Knuckle Wall
  [path[4][0], path[4][2] + 1.3, path[4][1]],           // last mushroom
  [oakB.x + .8, 5.3, oakB.z + .8],                      // oak B lookout
  [bigRock.x, bigRock.r * 2 + .5, bigRock.z],           // top of the big boulder
  [-10, .55, 13],                                        // middle of the pond
  [24.2, .6, 16.4],                                      // tucked behind a rock
  [oakD.x + 1.9, 3.95, oakD.z],                         // oak D branch
  [-7, .7, -.6],                                         // easy one near spawn
  [lowCliff.x, lowCliff.h + .8, lowCliff.z],            // on the lowest cliff rim
  [17, 1.4 * 1.35 + .45, 9],                             // on top of three more boulders
  [-15, 1.6 * 1.35 + .45, -18],
  [-25, 1.5 * 1.35 + .45, 15],
].forEach(p => berry(...p));

// secret #1: a golden acorn on top of the tallest cliff
const acorn = new THREE.Group();
{
  const nut = new THREE.Mesh(new THREE.SphereGeometry(.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0xff9a00, emissiveIntensity: .6, metalness: .6, roughness: .3 })); nut.scale.y = 1.25; acorn.add(nut);
  const capM = new THREE.Mesh(new THREE.SphereGeometry(.18, 14, 8, 0, 6.3, 0, 1.6), mat(0x8a5a2b)); capM.position.y = .06; acorn.add(capM);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .1, 6), mat(0x5a3a20)); st.position.y = .24; acorn.add(st);
  acorn.position.set(tallCliff.x, tallCliff.h + .7, tallCliff.z); scene.add(acorn);
}

/* ======================= Pip, the friendly critter at spawn ======================= */
const pip = (() => {
  const g = new THREE.Group(); g.position.set(1.4, .55, -1.1); scene.add(g);
  const fur = mat(0xff8a3d), cream = mat(0xffe3b8), dark = new THREE.MeshBasicMaterial({ color: 0x1a1a22 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const body = new THREE.Group(); g.add(body);
  const b = shadowy(new THREE.Mesh(new THREE.SphereGeometry(.3, 18, 14), fur)); b.position.y = .3; b.scale.set(1, .92, .95); body.add(b);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), cream); belly.position.set(0, .25, .16); belly.scale.set(1, 1, .5); body.add(belly);
  const eyes = [];
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 10), white); e.position.set(s * .11, .42, .24); body.add(e);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(.042, 10, 8), dark); pu.position.set(0, 0, .045); e.add(pu);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(.013, 6, 5), white); hl.position.set(.015, .02, .035); pu.add(hl);
    eyes.push(e);
    const ear = shadowy(new THREE.Mesh(new THREE.ConeGeometry(.08, .2, 8), fur)); ear.position.set(s * .17, .6, 0); ear.rotation.z = -s * .35; body.add(ear);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), cream); foot.position.set(s * .13, .03, .1); foot.scale.set(1, .5, 1.3); body.add(foot);
  });
  const blush = mat(0xff6f8f); [-1, 1].forEach(s => { const bl = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), blush); bl.position.set(s * .19, .33, .22); bl.scale.z = .3; body.add(bl); });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.035, .01, 6, 12, Math.PI), dark); mouth.position.set(0, .33, .285); mouth.rotation.z = Math.PI; body.add(mouth);
  const arms = [-1, 1].map(s => { const piv = new THREE.Group(); piv.position.set(s * .27, .3, .02); body.add(piv); const a = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), fur); a.position.y = -.1; a.scale.set(.8, 1.4, .8); piv.add(a); return piv; });
  const tail = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), cream); tail.position.set(0, .18, -.28); body.add(tail);
  return { g, body, eyes, arms, hop: 0, hearts: 0 };
})();

