/* ======================================================================
   THE WILDS: a HUGE open world (640 m across) through the orange portal in the grove.
   Regions: a flat Plaza hub with the Beacon Tower, Frostfang Peak (snow, giant crystal) to the north,
   a winding river into the big south lake (with an island), the Dune Temple desert + oasis to the east,
   the deep pine forest with the Elder Tree to the west, Old Town ruins in the south-west,
   the Crystal Cave, and floating Sky Islands you reach with wLaunch mushrooms.
   Travel: 8 waystones (walk up to one to unlock it, touch an orb or press 1-8 to jump there),
   a zipline from the top of the Beacon Tower down to the lake, and portals back home.
   Ground is one heightfield collider (t:4 in 01-core) that also holds every tree, rock and building
   in a little grid, so nothing here slows down the grove. Battle Royale can run on this map too.
   ====================================================================== */
const WILD = V(0, 0, -1500), WS = 320, WCELL = 4, WN = 160, WL = -.6;   // WL = water level (local)
const WILD_SPAWN = V(0, 0, 10);
const WILDS_PORTAL_G = V(-4.9, 0, -.5);   // in the grove
const WD = { on: false, ways: new Set(['plaza']), near: null, orbs: null, cool: 0, zip: null, fly: null, lastStone: 'plaza', found: new Set(), mapT: 0, inside: false, birds: [], pads: [], secrets: [], cull: 0, small: [] };
try { JSON.parse(store.get('kg-ways') || '[]').forEach(k => WD.ways.add(k)); JSON.parse(store.get('kg-wsec') || '[]').forEach(k => WD.found.add(k)); } catch (e) { }
const _wz1 = V(), _wz2 = V(), _wz3 = V(), _wzn = V();
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wmix = (a, b, t) => a + (b - a) * t;

/* ---------- noise ---------- */
const wh = (i, j) => { let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = wh(i, j), b = wh(i + 1, j), c = wh(i, j + 1), d = wh(i + 1, j + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, z, o = 4) { let s = 0, a = .5, f = 1; for (let k = 0; k < o; k++) { s += vnoise(x * f + k * 17.3, z * f - k * 9.1) * a; f *= 2.03; a *= .5; } return s; }
function ridge(x, z) { let s = 0, a = .5, f = 1; for (let k = 0; k < 4; k++) { s += (1 - Math.abs(vnoise(x * f + k * 5.1, z * f + k * 3.7))) * a; f *= 2.1; a *= .5; } return s; }

/* ---------- where things are (local coords: WILD is the middle of the map) ---------- */
const RIV = z => 52 + 16 * Math.sin(z / 38) + 6 * Math.sin(z / 17 + 1);
const LAKE = { x: 10, z: 195, rx: 85, rz: 62 }, OASIS = { x: 185, z: 150 }, TOWN = { x: -165, z: 160 }, CAVE = { x: -72, z: -112 },
  W_ELDER = { x: -205, z: -35 }, PYR = { x: 215, z: 25 }, PEAK = { x: 30, z: -235 }, SKY = { x: 112, z: -78 }, TOWER = { x: -16, z: -12 }, ISLE = { x: 22, z: 200 };
const wPad = (h, x, z, P, r0, r1, y) => wmix(y, h, sst(r0, r1, Math.hypot(x - P.x, z - P.z)));
function wildH(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(x * .011, z * .011) * 7 + fbm(x * .05, z * .05, 2) * 1.2) * sst(28, 75, r);   // flat Plaza in the middle
  const north = sst(-95, -210, z);
  h += north * (ridge(x * .016 + 3, z * .016) * 46 + 6);
  const pk = Math.hypot(x - PEAK.x, z - PEAK.z); h += 58 * Math.exp(-pk * pk / 3000);
  const east = sst(105, 165, x) * (1 - north);
  if (east > 0) h = wmix(h, (Math.sin(x * .07 + Math.sin(z * .028) * 2.4) * .5 + .5) * 4.5 + fbm(x * .03, z * .03, 2) * 2.5 + 1.5, east);
  h += sst(-100, -150, x) * (fbm(x * .02 + 7, z * .02, 3) * 9 + 3);
  h = wPad(h, x, z, TOWN, 40, 58, 1.2); h = wPad(h, x, z, PYR, 30, 44, 3); h = wPad(h, x, z, W_ELDER, 16, 30, 4); h = wPad(h, x, z, CAVE, 20, 32, 2.5); h = wPad(h, x, z, SKY, 10, 18, h * .5);
  if (z > -132 && z < 152) {   // the river
    const m = sst(-132, -108, z) * sst(152, 130, z), d = Math.abs(x - RIV(z));
    h = wmix(h, .35, sst(26, 10, d) * m); h = wmix(h, -1.45, sst(7, 3.5, d) * m);
  }
  const ld = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz);
  if (ld < 1.35) h = wmix(-4.6 + sst(.2, 1, ld) * 4.3, h, sst(.95, 1.35, ld));   // deep enough to dive in (97-swim)
  const id = Math.hypot(x - ISLE.x, z - ISLE.z); if (id < 15) h = Math.max(h, 2.2 - id * id / 70);
  const od = Math.hypot(x - OASIS.x, z - OASIS.z); if (od < 30) h = wmix(-1.4 + sst(2, 14, od) * 1.1, h, sst(13, 30, od));
  h += sst(238, 300, r) * (52 + fbm(x * .02 + 2, z * .02, 3) * 24 + ridge(x * .03, z * .03) * 18);
  return h;
}
/* the height grid: the mesh and the collider both read it, so you stand exactly on what you see */
const HG = new Float32Array((WN + 1) * (WN + 1));
for (let j = 0; j <= WN; j++) for (let i = 0; i <= WN; i++) HG[j * (WN + 1) + i] = wildH(-WS + i * WCELL, -WS + j * WCELL);
function terrSdf(lx, lz, py, n) {
  const u = clamp((lx + WS) / WCELL, 0, WN - 1e-4), v = clamp((lz + WS) / WCELL, 0, WN - 1e-4), i = u | 0, j = v | 0, fx = u - i, fz = v - j, k = j * (WN + 1) + i;
  const h00 = HG[k], h10 = HG[k + 1], h01 = HG[k + WN + 1], h11 = HG[k + WN + 2];
  let h, gx, gz;
  if (fx + fz <= 1) { gx = h10 - h00; gz = h01 - h00; h = h00 + fx * gx + fz * gz; } else { gx = h11 - h01; gz = h11 - h10; h = h11 - (1 - fx) * gx - (1 - fz) * gz; }
  gx /= WCELL; gz /= WCELL; const L = Math.hypot(gx, 1, gz);
  if (n) n.set(-gx / L, 1 / L, -gz / L);
  return n ? (py - h) / L : h;
}
const wildAt = (lx, lz) => terrSdf(lx, lz, 0, null);
// ground height at a WORLD x,z (0 in the grove and the yard)
function groundAt(x, z) { const lx = x - WILD.x, lz = z - WILD.z; return Math.abs(lx) < WS && Math.abs(lz) < WS ? WILD.y + wildAt(lx, lz) : 0; }
const inWilds = p => Math.abs(p.x - WILD.x) < WS && Math.abs(p.z - WILD.z) < WS;

/* ---------- one collider for the whole map: terrain + a grid of trees, rocks and buildings ---------- */
const PC = 8, PN = WS * 2 / PC, PG = new Array(PN * PN); let pStamp = 0;
const T_G = { tag: 'grass' }, T_R = { tag: 'rock' };
function wprop(c) {   // c in WORLD coords; same shapes as addCol (0 box, 1 cylinder, 2 sphere)
  addCol(c); colliders.pop();
  const i0 = Math.max(0, Math.floor((c.minx - WILD.x + WS) / PC)), i1 = Math.min(PN - 1, Math.floor((c.maxx - WILD.x + WS) / PC));
  const j0 = Math.max(0, Math.floor((c.minz - WILD.z + WS) / PC)), j1 = Math.min(PN - 1, Math.floor((c.maxz - WILD.z + WS) / PC));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) (PG[j * PN + i] || (PG[j * PN + i] = [])).push(c);
  return c;
}
const WFIELD = { t: 4, tag: 'grass', last: T_G, minx: WILD.x - WS, maxx: WILD.x + WS, minz: WILD.z - WS, maxz: WILD.z + WS, miny: WILD.y - 60, maxy: WILD.y + 240,
  sdf(p, n) {
    const lx = p.x - WILD.x, lz = p.z - WILD.z;
    let best = terrSdf(lx, lz, p.y - WILD.y, n); this.last = n.y < .76 ? T_R : T_G;
    const i0 = Math.max(0, Math.floor((lx - 1 + WS) / PC)), i1 = Math.min(PN - 1, Math.floor((lx + 1 + WS) / PC));
    const j0 = Math.max(0, Math.floor((lz - 1 + WS) / PC)), j1 = Math.min(PN - 1, Math.floor((lz + 1 + WS) / PC)), st = ++pStamp;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const b = PG[j * PN + i]; if (!b) continue;
      for (const c of b) {
        if (c.st === st) continue; c.st = st;
        if (p.x + 1 < c.minx || p.x - 1 > c.maxx || p.y + 1 < c.miny || p.y - 1 > c.maxy || p.z + 1 < c.minz || p.z - 1 > c.maxz) continue;
        const d = sdf(c, p, _wzn); if (d < best) { best = d; n.copy(_wzn); this.last = c; }
      }
    }
    return best;
  } };
colliders.push(WFIELD);

/* ---------- the land ---------- */
const WG = new THREE.Group(); WG.position.copy(WILD); scene.add(WG);
const _wzc = new THREE.Color(), _sand = new THREE.Color();
function groundCol(c, x, z, h, ny) {
  const nz = hsh(x, 0, z, 5) * .05, north = sst(-95, -210, z), east = sst(105, 165, x) * (1 - north), west = sst(-100, -150, x);
  if (h < WL + .3) return c.setHSL(.1, .32, .4 + nz);                                         // wet sand under the water
  if (h > 30 + hsh(x, 1, z, 7) * 10 && ny > .58) return c.setHSL(.58, .3, .92 + nz * .5);      // snow
  if (ny < .74) return c.setHSL(.07 + nz, .12, .4 + nz + Math.min(.15, h / 300));                // rock
  c.setHSL(.27 - west * .03 + nz * .4, .52 - west * .1, .41 - west * .1 + nz + north * .03);
  if (h < WL + 1.1) c.lerp(_sand.setHSL(.12, .45, .62), (WL + 1.1 - h) / .8);                   // beaches
  if (east > 0) c.lerp(_sand.setHSL(.11, .55, .66 + nz), clamp(east * 1.5, 0, 1));
  const td = Math.hypot(x - TOWN.x, z - TOWN.z); if (td < 34) c.lerp(_sand.setHSL(.09, .12, .55 + nz), sst(34, 24, td) * .7);
  return c;
}
{
  const CH = 20, NC = WN / CH, wcm = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (let cj = 0; cj < NC; cj++) for (let ci = 0; ci < NC; ci++) {
    const pos = [], col = [], idx = [];
    for (let j = 0; j <= CH; j++) for (let i = 0; i <= CH; i++) {
      const gi = ci * CH + i, gj = cj * CH + j, x = -WS + gi * WCELL, z = -WS + gj * WCELL, h = HG[gj * (WN + 1) + gi];
      const hx = HG[gj * (WN + 1) + Math.min(WN, gi + 1)] - HG[gj * (WN + 1) + Math.max(0, gi - 1)], hz = HG[Math.min(WN, gj + 1) * (WN + 1) + gi] - HG[Math.max(0, gj - 1) * (WN + 1) + gi];
      const ny = 1 / Math.hypot(hx / (2 * WCELL), 1, hz / (2 * WCELL));
      pos.push(x, h, z); groundCol(_wzc, x, z, h, ny); col.push(_wzc.r, _wzc.g, _wzc.b);
    }
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const a = j * (CH + 1) + i, b = a + 1, c = a + CH + 1, d = c + 1;   // a=(i,j) b=(i+1,j) c=(i,j+1) d=(i+1,j+1)
      idx.push(a, c, b, d, b, c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, wcm); m.receiveShadow = true; WG.add(m);
  }
  // water: the lake, the river and the oasis all sit at one level
  const wm = makeWaterMat({ color: 0x3d9fd0, alpha: .62, amp: .7, freq: .12, fres: .35 });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 64), wm); lake.rotation.x = -Math.PI / 2; lake.scale.set(LAKE.rx * 1.36, LAKE.rz * 1.36, 1); lake.position.set(LAKE.x, WL, LAKE.z); WG.add(lake);
  const oas = new THREE.Mesh(new THREE.CircleGeometry(15, 40), wm); oas.rotation.x = -Math.PI / 2; oas.position.set(OASIS.x, WL, OASIS.z); WG.add(oas);
  const rp = [];
  for (let z = -128; z <= 150; z += 4) { const x = RIV(z), x2 = RIV(z + 1), dx = x2 - x, L = Math.hypot(dx, 1), nx = 1 / L * 8, nz = -dx / L * 8; rp.push([x - nx, z - nz, x + nx, z + nz]); }
  const rpos = [], ridx = [];
  rp.forEach(([ax, az, bx, bz], k) => { rpos.push(ax, WL, az, bx, WL, bz); if (k) { const a = k * 2 - 2; ridx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3)); rg.setIndex(ridx); rg.computeVertexNormals();
  if (rg.attributes.normal.getY(0) < 0) { ridx.reverse(); rg.setIndex(ridx); rg.computeVertexNormals(); }
  WG.add(new THREE.Mesh(rg, wm));
}

/* ---------- little building helpers (local coords) ---------- */
function wbox(x, y, z, w, h, d, m, o = {}) {
  const me = new THREE.Mesh(o.geo || new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.rotation.y = o.yaw || 0; me.castShadow = o.shadow !== false; me.receiveShadow = true; (o.parent || WG).add(me);
  if (o.solid !== false) wprop({ t: 0, x: WILD.x + x, y: WILD.y + y, z: WILD.z + z, hx: w / 2, hy: h / 2, hz: d / 2, yaw: o.yaw || 0, tag: o.tag || 'rock', bounce: o.bounce });
  return me;
}
function wcyl(x, y, z, r, h, m, o = {}) {
  const me = new THREE.Mesh(o.geo || new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg || 12), m); me.position.set(x, y, z); me.castShadow = o.shadow !== false; me.receiveShadow = true; (o.parent || WG).add(me);
  if (o.solid !== false) me.userData.col = wprop({ t: 1, x: WILD.x + x, z: WILD.z + z, cy: WILD.y + y, hy: h / 2, r: o.cr || r, tag: o.tag || 'rock', bounce: o.bounce });
  return me;
}
const rockGeo = (r, k) => paint(jitterGeo(new THREE.IcosahedronGeometry(r, 1), r * .28, k), (c, px, py) => c.setHSL(.08 + hsh(px, py, 0, 3) * .03, .1, .42 + py / r * .12 + hsh(px, py, 1, 2) * .06));
const glowM = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, fog: false, transparent: o < 1, opacity: o });
function sprite(text, w, col = '#ffd25a', size = 56) {
  const t = labelTex(512, 128, (g, W, H) => signText(g, W, H, [[text, size, '#ffffff', 66]], 'rgba(22,30,44,.85)', col));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(w, w / 4, 1); return s;
}
const gy = (x, z) => wildAt(x, z);
const groundMax = (x, z, r) => Math.max(gy(x, z), gy(x + r, z), gy(x - r, z), gy(x, z + r), gy(x, z - r));
const noTree = [];   // wKeep-out circles for trees and rocks
const wKeep = (x, z, r) => noTree.push({ x, z, r });

/* ---------- the Plaza ---------- */
{
  const stone = mat(0xc9c2b3), dark = mat(0x8f8778), pg = new THREE.Group(); WG.add(pg);   // pg sits at the map origin, so local coords still work
  const fl = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.4, .3, 40), stone); fl.position.set(0, -.11, 4); fl.receiveShadow = true; pg.add(fl);
  for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; wcyl(Math.cos(a) * 11.6, .25, 4 + Math.sin(a) * 11.6, .35, .5, dark, { seg: 8, parent: pg }); }
  [[7.5, -1], [-7.5, -1], [7.5, 10], [-7.5, 10]].forEach(([x, z]) => { wcyl(x, 1.6, z, .45, 3.2, stone, { seg: 10, parent: pg }); wbox(x, 3.35, z, 1.2, .3, 1.2, dark, { parent: pg }); });
  mergeStatic(pg);
  wKeep(0, 4, 16);
}
// the Beacon Tower: spiral stairs to the top, a spinning lighthouse beam, and the zipline down to the lake
const TOWER_TOP = 24, TB = gy(TOWER.x, TOWER.z);
const ZIP_A = V(), ZIP_B = V(), ZIP_HANDLE = V();
const beam = (() => {
  const g = new THREE.Group(); g.position.set(TOWER.x, TB, TOWER.z); WG.add(g);
  const stone = mat(0xbdb5a4), band = mat(0x8c5a3c), win = mat(0x2a2f3a);
  wcyl(0, TOWER_TOP / 2, 0, 3.2, TOWER_TOP, stone, { parent: g, seg: 16, rt: 3.0, cr: 3.15, solid: false });
  wprop({ t: 1, x: WILD.x + TOWER.x, z: WILD.z + TOWER.z, cy: WILD.y + TB + TOWER_TOP / 2, hy: TOWER_TOP / 2, r: 3.15, tag: 'rock' });
  for (let k = 1; k < 4; k++) wcyl(0, k * 6, 0, 3.32, .35, band, { parent: g, seg: 16, solid: false });
  for (let k = 0; k < 8; k++) { const a = k * 1.9, y = 3 + k * 2.6; const w = wbox(Math.cos(a) * 3.05, y, Math.sin(a) * 3.05, .2, 1, .55, win, { parent: g, yaw: -a, solid: false }); }
  const N = Math.round(TOWER_TOP / .48), rise = TOWER_TOP / N, dA = 4 * Math.PI / N, a0 = .4;
  for (let k = 0; k < N; k++) {
    const a = a0 + k * dA, y = (k + 1) * rise - .15, x = Math.cos(a) * 4.3, z = Math.sin(a) * 4.3;
    wbox(x, y, z, 2.2, .3, 1.25, k % 2 ? band : mat(0x9b6a48), { parent: g, solid: false, yaw: -a });
    wprop({ t: 0, x: WILD.x + TOWER.x + x, y: WILD.y + TB + y, z: WILD.z + TOWER.z + z, hx: 1.1, hy: .15, hz: .62, yaw: -a, tag: 'wood' });
  }
  const aEnd = a0 + (N - 1) * dA;
  // zipline: leaves the top toward the lake
  ZIP_B.set(4, 0, 112); ZIP_B.y = gy(ZIP_B.x, ZIP_B.z) + 2.6;
  const dir = V(ZIP_B.x - TOWER.x, 0, ZIP_B.z - TOWER.z).normalize(), aZip = Math.atan2(dir.z, dir.x);
  for (let k = 0; k < 14; k++) {   // battlements, with gaps where the stairs arrive and where the zipline leaves
    const a = k / 14 * 6.283, dd = q => Math.abs(Math.atan2(Math.sin(a - q), Math.cos(a - q)));
    if (dd(aEnd) < .45 || dd(aZip) < .4) continue;
    wbox(Math.cos(a) * 2.9, TOWER_TOP + .4, Math.sin(a) * 2.9, .55, .8, .5, stone, { parent: g, solid: false, yaw: -a });
    wprop({ t: 0, x: WILD.x + TOWER.x + Math.cos(a) * 2.9, y: WILD.y + TB + TOWER_TOP + .4, z: WILD.z + TOWER.z + Math.sin(a) * 2.9, hx: .28, hy: .4, hz: .25, yaw: -a, tag: 'rock' });
  }
  ZIP_A.set(TOWER.x + dir.x * 2.2, TB + TOWER_TOP + 1.45, TOWER.z + dir.z * 2.2);
  ZIP_HANDLE.copy(ZIP_A).add(V(dir.x * .5, -.7, dir.z * .5));
  wcyl(TOWER.x + dir.x * 1.8 - WILD.x * 0, TB + TOWER_TOP + .8, TOWER.z + dir.z * 1.8, .07, 1.6, band, { seg: 6 });
  const post = wcyl(ZIP_B.x, (ZIP_B.y + gy(ZIP_B.x, ZIP_B.z)) / 2 + .2, ZIP_B.z, .14, ZIP_B.y - gy(ZIP_B.x, ZIP_B.z) + .4, band, { seg: 8 });
  const L = ZIP_A.distanceTo(ZIP_B), cab = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, L, 5), mat(0x30343c));
  cab.position.addVectors(ZIP_A, ZIP_B).multiplyScalar(.5); cab.quaternion.setFromUnitVectors(V(0, 1, 0), V().subVectors(ZIP_B, ZIP_A).normalize()); WG.add(cab);
  // beacon: pole, glowing gem and a sweeping beam you can see from anywhere
  wcyl(0, TOWER_TOP + 1.5, 0, .12, 3, band, { parent: g, seg: 6, solid: false });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.7, 0), glowM(0xffe27a)); gem.position.y = TOWER_TOP + 3.6; g.add(gem);
  const bm = new THREE.Mesh(new THREE.ConeGeometry(2.2, 46, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  bm.geometry.translate(0, -23, 0); bm.rotation.z = Math.PI / 2; const piv = new THREE.Group(); piv.position.y = TOWER_TOP + 3.6; piv.add(bm); g.add(piv);
  mergeStatic(g, c => c === gem || c === piv || c === bm);
  wKeep(TOWER.x, TOWER.z, 9);
  for (let s = 0; s <= 1; s += .02) wKeep(wmix(TOWER.x, ZIP_B.x, s), wmix(TOWER.z, ZIP_B.z, s), 6);
  return { gem, piv };
})();
const ZIP_HANDLE_M = (() => { const g = new THREE.Group(); const m = mat(0xffb23f); part(new THREE.CylinderGeometry(.035, .035, .5, 8), m, 0, 0, 0, g).rotation.z = Math.PI / 2; part(new THREE.CylinderGeometry(.015, .015, .7, 5), mat(0x30343c), 0, .35, 0, g); const w = new THREE.Mesh(new THREE.TorusGeometry(.07, .025, 6, 12), mat(0xc9ced6)); w.position.y = .7; g.add(w); g.position.copy(ZIP_HANDLE); WG.add(g); return g; })();
{ const s = sprite('🪂 ZIPLINE: grab the handle!', 1.6, '#ffb23f', 46); s.position.copy(ZIP_HANDLE).add(V(0, .55, 0)); WG.add(s); }

/* ---------- Frostfang Peak: a giant crystal on the summit ---------- */
const CRYSTAL = (() => {
  let best = -1e9, bx = PEAK.x, bz = PEAK.z;
  for (let dz = -20; dz <= 20; dz += 2) for (let dx = -20; dx <= 20; dx += 2) { const h = gy(PEAK.x + dx, PEAK.z + dz); if (h > best) { best = h; bx = PEAK.x + dx; bz = PEAK.z + dz; } }
  const g = new THREE.Group(); g.position.set(bx, best - .4, bz); WG.add(g);
  const cm = new THREE.MeshStandardMaterial({ color: 0x7fe8ff, emissive: 0x3fb2ff, emissiveIntensity: .9, roughness: .15, flatShading: true, fog: false, transparent: true, opacity: .92 });
  [[0, 7, 0, 2.2, 0], [2.2, 3.6, 1, 1.2, .5], [-2, 3, .6, 1.1, -.6], [.6, 2.6, -2.1, .9, .4], [-1, 2.4, -1.6, .8, -.3]].forEach(([x, h, z, r, tilt]) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), cm); m.scale.set(r, h, r); m.position.set(x, h * .8, z); m.rotation.z = tilt; m.rotation.y = x; g.add(m); });
  wprop({ t: 1, x: WILD.x + bx, z: WILD.z + bz, cy: WILD.y + best + 4, hy: 4.5, r: 1.6, tag: 'rock' });
  wKeep(bx, bz, 10);
  return { g, top: V(bx, best, bz), cm };
})();

/* ---------- the Dune Temple (stepped pyramid) + cacti + oasis ---------- */
const IDOL = (() => {
  const g = new THREE.Group(); g.position.set(PYR.x, 3, PYR.z); WG.add(g);
  const a = mat(0xd9b77a), b = mat(0xc49a5e);
  const NL = 14;
  for (let k = 0; k < NL; k++) { const s = 34 - k * 30 / (NL - 1); wbox(0, k * 1.2 + .6, 0, s, 1.2, s, k % 2 ? a : b, { parent: g, solid: false });
    wprop({ t: 0, x: WILD.x + PYR.x, y: WILD.y + 3 + k * 1.2 + .6, z: WILD.z + PYR.z, hx: s / 2, hy: .6, hz: s / 2, tag: 'rock' }); }
  [[-20, -14], [-20, 14]].forEach(([x, z]) => { wbox(x, 4, z, 1.6, 8, 1.6, b, { parent: g, solid: false }); wprop({ t: 0, x: WILD.x + PYR.x + x, y: WILD.y + 7, z: WILD.z + PYR.z + z, hx: .8, hy: 4, hz: .8, tag: 'rock' });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 4), mat(0xffc54a, { metalness: .6, roughness: .3 })); tip.position.set(x, 8.8, z); tip.rotation.y = Math.PI / 4; g.add(tip); });
  mergeStatic(g);
  // golden idol on top (secret)
  const top = 3 + NL * 1.2, gold = new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .25, envMap: ENV, emissive: 0x3a2400 });
  const idol = new THREE.Group(); idol.position.set(PYR.x, top, PYR.z); WG.add(idol);
  part(new THREE.CylinderGeometry(.35, .45, .3, 8), mat(0x8c7a5a), 0, .15, 0, idol);
  part(new THREE.SphereGeometry(.28, 14, 10), gold, 0, .55, 0, idol); [-1, 1].forEach(s => part(new THREE.SphereGeometry(.1, 8, 6), gold, s * .2, .82, 0, idol));
  wKeep(PYR.x, PYR.z, 30);
  // cacti
  const cg = mat(0x4f9a46), R = seeded(77), cacti = new THREE.Group(); WG.add(cacti);
  for (let i = 0; i < 26; i++) {
    const x = 150 + R() * 130, z = -70 + R() * 200; if (Math.hypot(x - PYR.x, z - PYR.z) < 26 || Math.hypot(x - OASIS.x, z - OASIS.z) < 20 || Math.hypot(x, z) > 270) continue;
    const y = gy(x, z), h = 1.6 + R() * 2; if (y < WL + .4) continue;
    const c = new THREE.Group(); c.position.set(x, y, z); cacti.add(c);
    part(new THREE.CylinderGeometry(.28, .32, h, 8), cg, 0, h / 2, 0, c); part(new THREE.SphereGeometry(.28, 8, 6), cg, 0, h, 0, c);
    [-1, 1].forEach(s => { if (R() < .3) return; const ay = h * (.35 + R() * .3); const arm = part(new THREE.CylinderGeometry(.16, .16, .6, 6), cg, s * .4, ay, 0, c); arm.rotation.z = Math.PI / 2; part(new THREE.CylinderGeometry(.16, .16, .7, 6), cg, s * .62, ay + .3, 0, c); });
    wprop({ t: 1, x: WILD.x + x, z: WILD.z + z, cy: WILD.y + y + h / 2, hy: h / 2, r: .32, tag: 'wood' }); wKeep(x, z, 2);
  }
  mergeStatic(cacti);
  return { idol, top: V(PYR.x, top, PYR.z) };
})();

/* ---------- the Elder Tree: a giant oak you can climb ---------- */
{
  const s = 5.2, y = gy(W_ELDER.x, W_ELDER.z) - .2, t = TreeKit.mesh('oak', { seed: 7 }); t.position.set(W_ELDER.x, y, W_ELDER.z); t.scale.setScalar(s); WG.add(t);
  const cut = WILD.y + y + TreeKit.info.oak.canopyBase * s * .97;
  addMeshCollider(t, OWN.wood, (a, b, c) => Math.max(a.y, b.y, c.y) < cut);
  const lm = glowM(0xffd27a), lg = new THREE.Group(); WG.add(lg);
  for (let k = 0; k < 10; k++) { const a = k * .63, r = 6 + (k % 3) * 3; const l = new THREE.Mesh(new THREE.OctahedronGeometry(.25, 0), lm); l.position.set(W_ELDER.x + Math.cos(a) * r, y + 16 + (k % 4) * 2.2, W_ELDER.z + Math.sin(a) * r); WG.add(l);
    lg.add(l); const st = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 2, 3), mat(0x30343c)); st.position.copy(l.position).add(V(0, 1.1, 0)); lg.add(st); }
  mergeStatic(lg);
  wKeep(W_ELDER.x, W_ELDER.z, 22);
}

/* ---------- Old Town ruins ---------- */
{
  const g = new THREE.Group(); g.position.set(TOWN.x, 1.2, TOWN.z); WG.add(g);
  const wall = mat(0xd8cbb0), wall2 = mat(0xbfae8c), roof = mat(0xb5523b), wood = mat(0x7a4d2b);
  const W = (x, y, z, w, h, d, m, yaw = 0) => { wbox(x, y, z, w, h, d, m, { parent: g, solid: false, yaw }); const c = Math.cos(yaw), s = Math.sin(yaw);
    wprop({ t: 0, x: WILD.x + TOWN.x + x, y: WILD.y + 1.2 + y, z: WILD.z + TOWN.z + z, hx: w / 2, hy: h / 2, hz: d / 2, yaw, tag: 'rock' }); };
  const house = (cx, cz, yaw, broken) => {   // 4.4 x 4.4, door facing the town square
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c], H = broken ? 1.6 : 2.6, m = broken ? wall2 : wall;
    let [x, z] = P(0, -2.1); W(x, H / 2, z, 4.4, H, .25, m, yaw);
    [x, z] = P(-2.1, 0); W(x, H / 2, z, .25, H, 4.4, m, yaw); [x, z] = P(2.1, 0); W(x, H / 2, z, .25, H, 4.4, m, yaw);
    [x, z] = P(-1.4, 2.1); W(x, H / 2, z, 1.6, H, .25, m, yaw); [x, z] = P(1.4, 2.1); W(x, H / 2, z, 1.6, H, .25, m, yaw);
    if (!broken) { [x, z] = P(0, 2.1); W(x, 2.25, z, 1.2, .7, .25, m, yaw);
      W(cx, 2.68, cz, 4.6, .16, 4.6, wood, yaw);
      const r = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.8, 4), roof); r.position.set(cx, 3.66, cz); r.rotation.y = yaw + Math.PI / 4; r.castShadow = true; g.add(r); }
  };
  const ring = [[0, 16, 0], [14, 9, 1], [16, -6, 0], [5, -16, 1], [-11, -12, 0], [-16, 3, 1], [-8, 15, 0]];
  ring.forEach(([x, z, b]) => house(x, z, Math.atan2(-x, -z) + Math.PI, !!b));
  // clock tower
  W(0, 7, 0, 3, 14, 3, wall2);
  const face = labelTex(256, 256, (cg, w, h) => { cg.fillStyle = '#f6ecd2'; cg.beginPath(); cg.arc(128, 128, 120, 0, 7); cg.fill(); cg.lineWidth = 10; cg.strokeStyle = '#5a3a20'; cg.stroke();
    cg.fillStyle = '#5a3a20'; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; cg.fillRect(128 + Math.cos(a) * 98 - 5, 128 + Math.sin(a) * 98 - 5, 10, 10); }
    cg.lineCap = 'round'; cg.lineWidth = 12; cg.beginPath(); cg.moveTo(128, 128); cg.lineTo(128, 52); cg.stroke(); cg.lineWidth = 8; cg.beginPath(); cg.moveTo(128, 128); cg.lineTo(185, 150); cg.stroke(); });
  for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), new THREE.MeshStandardMaterial({ map: face, roughness: .8 })); const a = k * Math.PI / 2; f.position.set(Math.sin(a) * 1.52, 11.5, Math.cos(a) * 1.52); f.rotation.y = a; g.add(f); }
  const cr = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 4), roof); cr.position.set(0, 15.5, 0); cr.rotation.y = Math.PI / 4; g.add(cr);
  // broken columns + well
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + .2, h = 1 + (k * 37 % 5) * .5; wbox(Math.cos(a) * 9, h / 2, Math.sin(a) * 9, .7, h, .7, wall, { parent: g, solid: false, geo: new THREE.CylinderGeometry(.35, .38, h, 10) });
    wprop({ t: 1, x: WILD.x + TOWN.x + Math.cos(a) * 9, z: WILD.z + TOWN.z + Math.sin(a) * 9, cy: WILD.y + 1.2 + h / 2, hy: h / 2, r: .38, tag: 'rock' }); }
  const well = new THREE.Mesh(new THREE.TorusGeometry(1, .28, 8, 16), wall2); well.rotation.x = Math.PI / 2; well.position.set(5, .4, 4); g.add(well);
  wprop({ t: 1, x: WILD.x + TOWN.x + 5, z: WILD.z + TOWN.z + 4, cy: WILD.y + 1.2 + .4, hy: .4, r: 1.25, tag: 'rock' });
  mergeStatic(g);
  wKeep(TOWN.x, TOWN.z, 28);
}

/* ---------- Crystal Cave (with a tiny secret room) ---------- */
const SHROOM = (() => {
  const g = new THREE.Group(); const y0 = 2.5; g.position.set(CAVE.x, y0, CAVE.z); WG.add(g);
  const rm = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const W = (x, y, z, w, h, d) => { const geo = paint(jitterGeo(new THREE.BoxGeometry(w, h, d, Math.ceil(w / 2), Math.ceil(h / 2), Math.ceil(d / 2)), .18, x + z), (c, px, py) => c.setHSL(.07, .1, .28 + hsh(px, py, x, 4) * .06));
    wbox(x, y, z, w, h, d, rm, { parent: g, geo, solid: false }); wprop({ t: 0, x: WILD.x + CAVE.x + x, y: WILD.y + y0 + y, z: WILD.z + CAVE.z + z, hx: w / 2, hy: h / 2, hz: d / 2, tag: 'rock' }); };
  // entrance tunnel (opens south, toward the Plaza), main hall, secret nook through a skinny gap
  W(-1.7, 1.6, 9, 1, 3.2, 6); W(1.7, 1.6, 9, 1, 3.2, 6); W(0, 3.6, 9, 4.4, .8, 6.2);
  W(-7, 2, 0, 1, 4, 13); W(7, 2, 0, 1, 4, 13); W(-4.3, 2, 6, 4.4, 4, 1); W(4.3, 2, 6, 4.4, 4, 1); W(0, 4.4, 0, 15, .8, 13.4);
  W(-3, 2, -6, 8, 4, 1); W(4.35, 2, -6, 4.3, 4, 1);   // back wall with a 0.7 m gap at x=1.35
  W(1.35, 2, -10.5, 6, 4, 1); W(-1.1, 2, -8.25, 1, 4, 4.5); W(3.8, 2, -8.25, 1, 4, 4.5); W(1.35, 4.4, -8.3, 6, .8, 5.6);
  // a hill of boulders on top so it looks like a cave in a hill
  const R = seeded(5); for (let k = 0; k < 14; k++) { const r = 2 + R() * 2.5, m = new THREE.Mesh(rockGeo(r, k), vcMat); m.position.set((R() - .5) * 14, 4.6 + R() * 1.4, (R() - .5) * 18 - 1); m.scale.y = .6; m.castShadow = true; g.add(m); }
  const cms = [0x7fe8ff, 0xc08bff, 0x7fffc0].map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.1, flatShading: true, roughness: .2 }));
  for (let k = 0; k < 16; k++) { const a = k * 2.4, x = Math.cos(a) * (3 + (k % 4)), z = Math.sin(a) * 4, side = k % 2 ? 1 : -1;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(.3, 0), cms[k % 3]); m.scale.y = 2.2; m.position.set(clamp(x, -6.2, 6.2), .5 + (k % 3) * .2, clamp(z, -5.2, 5.2)); m.rotation.z = side * .4; g.add(m); }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(14, .2, 18), mat(0x6a5e50)); floor.position.set(0, .02, 1.5); floor.receiveShadow = true; g.add(floor);
  mergeStatic(g, c => !!c.geometry.attributes.color);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffa800, emissiveIntensity: .9, roughness: .3 });
  const sh = new THREE.Group(); sh.position.set(CAVE.x + 1.35, y0, CAVE.z - 8.6); WG.add(sh);
  part(new THREE.CylinderGeometry(.09, .12, .4, 8), mat(0xfff3d6), 0, .2, 0, sh); const cap = part(new THREE.SphereGeometry(.3, 14, 8, 0, 6.283, 0, 1.6), gold, 0, .38, 0, sh); cap.scale.y = .7;
  wKeep(CAVE.x, CAVE.z, 16);
  return { sh, at: V(CAVE.x + 1.35, y0 + .4, CAVE.z - 8.6) };
})();

/* ---------- Sky Islands + wLaunch mushrooms ---------- */
const ISLANDS = [[0, 0, 12, 5], [11, -7, 19, 4.5], [20, 3, 26, 4.5], [10, 14, 33, 4], [-4, 8, 41, 6]].map(([dx, dz, up, r]) => ({ x: SKY.x + dx, z: SKY.z + dz, top: gy(SKY.x, SKY.z) + up, r }));
{
  const grass = mat(0x52b84a), dirt = mat(0x7a5236);
  ISLANDS.forEach((I, k) => {
    const g = new THREE.Group(); g.position.set(I.x, I.top, I.z); WG.add(g);
    part(new THREE.CylinderGeometry(I.r, I.r * .95, .5, 12), grass, 0, -.25, 0, g);
    const u = part(jitterGeo(new THREE.ConeGeometry(I.r * .95, I.r * 1.6, 10, 3), .35, k), dirt, 0, -.5 - I.r * .8, 0, g); u.rotation.x = Math.PI;
    for (let j = 0; j < 4; j++) { const a = j * 1.7 + k, f = new THREE.Mesh(new THREE.IcosahedronGeometry(.08, 0), mat([0xffe14f, 0xff6fb8, 0xffffff][j % 3])); f.position.set(Math.cos(a) * I.r * .6, .06, Math.sin(a) * I.r * .6); g.add(f); }
    mergeStatic(g);
    wprop({ t: 1, x: WILD.x + I.x, z: WILD.z + I.z, cy: WILD.y + I.top - .4, hy: .4, r: I.r, tag: 'grass' });
    wKeep(I.x, I.z, I.r + 2);
  });
}
// wLaunch pads: stand on one and it flings you to the next island
function makePad(x, y, z, to, col, text) {
  const g = new THREE.Group(); g.position.set(x, y, z); WG.add(g);
  part(new THREE.CylinderGeometry(.22, .3, .5, 8), mat(0xfff3d6), 0, .25, 0, g);
  const cap = part(new THREE.SphereGeometry(1.1, 18, 8, 0, 6.283, 0, 1.4), mat(col, { emissive: col, emissiveIntensity: .35 }), 0, .45, 0, g); cap.scale.y = .45;
  for (let k = 0; k < 6; k++) { const a = k * 1.05, d = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), mat(0xffffff)); d.position.set(Math.cos(a) * .7, .72, Math.sin(a) * .7); d.scale.y = .5; g.add(d); }
  const s = sprite(text, 1.5, '#' + new THREE.Color(col).getHexString(), 46); s.position.y = 1.7; g.add(s); mergeStatic(g, q => q === cap || q === s); WD.small.push(g);
  const c = wprop({ t: 1, x: WILD.x + x, z: WILD.z + z, cy: WILD.y + y + .45, hy: .3, r: 1.05, tag: 'mush' });
  const P = { g, cap, c, to, sq: 0 }; c.wLaunch = P; WD.pads.push(P); wKeep(x, z, 3); return P;
}
{
  const I = ISLANDS, base = gy(SKY.x - 9, SKY.z + 3);
  makePad(SKY.x - 9, base, SKY.z + 3, V(I[0].x, I[0].top, I[0].z), 0xff4fa8, '🍄 LAUNCH!');
  for (let k = 0; k < 4; k++) { const A = I[k], B = I[k + 1], d = V(B.x - A.x, 0, B.z - A.z).normalize(); makePad(A.x + d.x * (A.r - 1.5), A.top, A.z + d.z * (A.r - 1.5), V(B.x, B.top, B.z), 0xff4fa8, '🍄 UP!'); }
  const T = I[4]; makePad(T.x - 3, T.top, T.z - 2.5, V(0, 0, 6), 0xff3040, '🚀 TO THE PLAZA!');
}
const CHEST = (() => {   // treasure on the top island (secret)
  const T = ISLANDS[4], g = new THREE.Group(); g.position.set(T.x + 2.4, T.top, T.z + 1.5); g.rotation.y = -.6; WG.add(g);
  const wood = mat(0x8a5a32), gold = mat(0xffc54a, { metalness: .7, roughness: .3 });
  part(new THREE.BoxGeometry(.8, .45, .5), wood, 0, .22, 0, g); part(new THREE.BoxGeometry(.84, .06, .54), gold, 0, .1, 0, g);
  const lid = new THREE.Group(); lid.position.set(0, .45, -.25); g.add(lid); part(new THREE.CylinderGeometry(.25, .25, .8, 10, 1, false, 0, Math.PI), wood, 0, 0, .25, lid).rotation.z = Math.PI / 2;
  part(new THREE.BoxGeometry(.12, .14, .06), gold, 0, .4, .27, g);
  return { g, lid, at: g.position.clone().add(V(0, .3, 0)), open: 0 };
})();

/* ---------- lake island + dock (and a bottle) ---------- */
const BOTTLE = (() => {
  const y = gy(ISLE.x, ISLE.z); const p = TreeKit.mesh('palm', { seed: 3 }); p.position.set(ISLE.x - 2, y - .1, ISLE.z); p.scale.setScalar(.9); WG.add(p);
  wprop({ t: 1, x: WILD.x + ISLE.x - 2, z: WILD.z + ISLE.z, cy: WILD.y + y + 3, hy: 3, r: .3, tag: 'wood' });
  const b = new THREE.Group(); b.position.set(ISLE.x + 2.5, gy(ISLE.x + 2.5, ISLE.z + 1.5) + .08, ISLE.z + 1.5); b.rotation.set(0, .7, Math.PI / 2 - .2); WG.add(b);
  const gl = new THREE.MeshStandardMaterial({ color: 0x9fe0b0, roughness: .1, transparent: true, opacity: .7 });
  part(new THREE.CylinderGeometry(.08, .08, .26, 10), gl, 0, 0, 0, b); part(new THREE.CylinderGeometry(.03, .06, .1, 8), gl, 0, .17, 0, b); part(new THREE.CylinderGeometry(.032, .032, .05, 6), mat(0x8a5a32), 0, .24, 0, b);
  part(new THREE.CylinderGeometry(.05, .05, .18, 6), mat(0xf6ecd2), 0, 0, 0, b);
  wKeep(ISLE.x, ISLE.z, 14);
  // dock on the north shore
  const wood = mat(0x8a5a32), dz = LAKE.z - LAKE.rz - 2, dx = -24;
  const dg = new THREE.Group(); WG.add(dg);
  for (let k = 0; k < 9; k++) wbox(dx, WL + .5, dz + 2 + k * 1.1, 2.4, .14, 1, k % 2 ? wood : mat(0xa0703f), { tag: 'wood', parent: dg });
  [[-1.1, 0], [1.1, 0], [-1.1, 9], [1.1, 9]].forEach(([x, z]) => wcyl(dx + x, WL, dz + 2 + z, .12, 1.6, wood, { seg: 6, solid: false, parent: dg }));
  mergeStatic(dg);
  // oasis palms
  for (let k = 0; k < 7; k++) { const a = k * .9, x = OASIS.x + Math.cos(a) * 18, z = OASIS.z + Math.sin(a) * 18, py = gy(x, z); const pm = TreeKit.mesh('palm', { seed: k }); pm.position.set(x, py - .1, z); pm.scale.setScalar(.8 + (k % 3) * .15); pm.rotation.y = k; WG.add(pm); wprop({ t: 1, x: WILD.x + x, z: WILD.z + z, cy: WILD.y + py + 3, hy: 3, r: .28, tag: 'wood' }); }
  wKeep(OASIS.x, OASIS.z, 24);
  return { b, at: b.position.clone() };
})();
// wooden bridge over the river by the Plaza
{
  const bz = 0, bx = RIV(bz), wood = mat(0x8a5a32), wood2 = mat(0xa0703f), g = new THREE.Group(); g.position.set(bx, 0, bz); WG.add(g);
  for (let k = -11; k <= 11; k++) { const x = k * .9, y = .55 + Math.cos(k / 11 * Math.PI / 2) * .9; wbox(x, y, 0, .86, .16, 3, k % 2 ? wood : wood2, { parent: g, solid: false });
    wprop({ t: 0, x: WILD.x + bx + x, y: WILD.y + y, z: WILD.z + bz, hx: .45, hy: .08, hz: 1.5, tag: 'wood' }); }
  [-1, 1].forEach(s => { for (let k = -11; k <= 11; k += 2) { const x = k * .9, y = .55 + Math.cos(k / 11 * Math.PI / 2) * .9; wbox(x, y + .45, s * 1.45, .1, .8, .1, wood, { parent: g, solid: false }); } });
  mergeStatic(g); wKeep(bx, bz, 14);
}

/* ---------- forests, rocks and grass (instanced in 4x4 tiles so far tiles get culled) ---------- */
{
  const R = seeded(2024), tiles = new Map(), add = (type, pl) => { const k = type + (Math.floor((pl.x + WS) / 160) * 4 + Math.floor((pl.z + WS) / 160)); (tiles.get(k) || tiles.set(k, { type, list: [] }).get(k)).list.push(pl); };
  const rocks = [];
  let n = 0;
  for (let t = 0; t < 22000; t++) {
    const x = (R() - .5) * 2 * 290, z = (R() - .5) * 2 * 290, r = Math.hypot(x, z); if (r > 292) continue;
    const ny = (() => { terrSdf(x, z, 0, _wzn); return _wzn.y; })(), h = wildAt(x, z);
    if (h < WL + .5 || ny < .76) { if (ny < .76 && h > WL && R() < .012) rocks.push([x, z]); continue; }
    if (noTree.some(k => Math.hypot(x - k.x, z - k.z) < k.r)) continue;
    if (z > -135 && z < 155 && Math.abs(x - RIV(z)) < 11) continue;
    const north = sst(-95, -210, z), east = sst(105, 165, x) * (1 - north), west = sst(-100, -150, x), edge = sst(238, 270, r);
    let type = null, p;
    if (h > 46) continue;
    if (east > .5) { p = .035; type = 'dead'; }
    else if (north > .4 || h > 20) { p = .5; type = 'snowpine'; }
    else if (west > .5) { p = .9; const q = R(); type = q < .62 ? 'pine' : q < .82 ? 'oak' : 'birch'; }
    else if (edge > .3) { p = .5; type = 'pine'; }
    else { p = .07; const q = R(); type = q < .4 ? 'oak' : q < .75 ? 'birch' : 'pine'; }
    if (R() > p * .35) { if (R() < .008) rocks.push([x, z]); continue; }
    const s = type === 'dead' ? .7 + R() * .4 : .85 + R() * .65;
    add(type, { x, y: h - .1, z, s, ry: R() * 6.28 }); n++;
    const inf = TreeKit.info[type], tr = (type === 'pine' || type === 'snowpine' ? .32 : inf.trunkR * .55) * s;
    wprop({ t: 1, x: WILD.x + x, z: WILD.z + z, cy: WILD.y + h + inf.canopyBase * s * .5, hy: inf.canopyBase * s * .5, r: tr, tag: 'wood' });
  }
  const tm = TreeKit.material();
  for (const { type, list } of tiles.values()) TreeKit.scatter(type, list, { variants: 1, detail: type === 'oak' || type === 'birch' ? 0 : undefined, material: tm }).meshes.forEach(m => { m.computeBoundingSphere(); WG.add(m); });
  WD.trees = n;
  // rocks
  for (let k = 0; k < 140; k++) { const x = (R() - .5) * 560, z = (R() - .5) * 560; if (Math.hypot(x, z) < 290 && !noTree.some(q => Math.hypot(x - q.x, z - q.z) < q.r)) rocks.push([x, z]); }
  const rg = rockGeo(1, 3), rt = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  rocks.forEach(([x, z], k) => { const h = wildAt(x, z); if (h < WL - .3) return; const s = .5 + R() * 1.6, key = Math.floor((x + WS) / 160) * 4 + Math.floor((z + WS) / 160);
    (rt.get(key) || rt.set(key, []).get(key)).push(m4.compose(V(x, h + s * .2, z), q.setFromEuler(e.set(0, R() * 6, 0)), V(s, s * .75, s)).clone());
    wprop({ t: 2, c: V(WILD.x + x, WILD.y + h + s * .2, WILD.z + z), r: s * .8, tag: 'rock' }); });
  for (const list of rt.values()) { const im = new THREE.InstancedMesh(rg, vcMat, list.length); list.forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); WG.add(im); }
  WD.rocks = rocks.length;
  // grass tufts + flowers around the Plaza and the meadows
  const tg = new THREE.ConeGeometry(.08, .4, 4); tg.translate(0, .18, 0);
  const tufts = new THREE.InstancedMesh(tg, mat(0x3f9b3c), 1600); let ti = 0;
  for (let k = 0; k < 4000 && ti < 1600; k++) { const a = R() * 6.283, r = 12 + Math.sqrt(R()) * 110, x = Math.cos(a) * r, z = Math.sin(a) * r, h = wildAt(x, z);
    if (h < WL + .6 || sst(105, 165, x) > .3) continue; const s = .6 + R() * .9; tufts.setMatrixAt(ti++, m4.compose(V(x, h, z), q.setFromEuler(e.set((R() - .5) * .5, R() * 3, (R() - .5) * .5)), V(s, s, s))); }
  tufts.count = ti; tufts.computeBoundingSphere(); WG.add(tufts);
}

/* ---------- birds circling the sky ---------- */
{
  const bm = mat(0x2d2f3a), wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.25, 0, 0, .2, 1.1, 0, 0], 3)); wg.computeVertexNormals();
  const flocks = [[0, 0, 70, 28], [10, 190, 60, 18], [-200, -30, 40, 40], [30, -200, 50, 70]];
  flocks.forEach(([cx, cz, r, h], fi) => { for (let k = 0; k < 3; k++) {
    const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.ConeGeometry(.16, .8, 5), bm); body.rotation.x = Math.PI / 2; g.add(body);
    const wl = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ color: 0x2d2f3a, side: THREE.DoubleSide })), wr = wl.clone(); wr.scale.x = -1; g.add(wl, wr); WG.add(g);
    WD.small.push(g); WD.birds.push({ g, wl, wr, cx, cz, r: r + k * 6, h: h + k * 2.5, a: k * .5 + fi, sp: (.12 + k * .015) * (fi % 2 ? -1 : 1) }); } });
}

/* ---------- waystones (fast travel) ---------- */
const STONES = [
  ['plaza', '🏛️ Plaza', 7, 5, 0xffd25a], ['cave', '💎 Crystal Cave', CAVE.x + 5, CAVE.z + 17, 0x7fe8ff], ['peak', '🏔️ Frostfang Peak', CRYSTAL.top.x + 6, CRYSTAL.top.z + 4, 0xbfe8ff],
  ['dunes', '🏜️ Dune Temple', PYR.x - 28, PYR.z + 6, 0xffb23f], ['lake', '🌊 Lakeside', -14, LAKE.z - LAKE.rz - 8, 0x3fb2ff], ['elder', '🌳 Elder Tree', W_ELDER.x + 20, W_ELDER.z + 6, 0x6fdc4f],
  ['town', '🏘️ Old Town', TOWN.x + 30, TOWN.z - 20, 0xff8a3d], ['sky', '☁️ Sky Islands', ISLANDS[4].x + 2.5, ISLANDS[4].z - 3, 0xc08bff]
].map(([id, name, x, z, col], i) => {
  const y = id === 'sky' ? ISLANDS[4].top : groundMax(x, z, 1.3);
  const g = new THREE.Group(); g.position.set(x, y, z); WG.add(g);
  part(new THREE.CylinderGeometry(1.3, 1.45, 2.2, 14), mat(0x9a948a), 0, -.95, 0, g);
  part(new THREE.BoxGeometry(.5, 1.6, .32), mat(0x6f6a62), 0, .95, 0, g);
  const rune = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0 });
  part(new THREE.BoxGeometry(.26, .9, .34), rune, 0, 1.0, 0, g);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.16, 0), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .6, flatShading: true })); gem.position.y = 2.05; g.add(gem);
  const lab = sprite(name, 1.7, '#' + new THREE.Color(col).getHexString(), 50); lab.position.y = 2.6; g.add(lab);
  mergeStatic(g, q => q === gem || q === lab); WD.small.push(g);
  if (id !== 'sky') wprop({ t: 1, x: WILD.x + x, z: WILD.z + z, cy: WILD.y + y - .95, hy: 1.1, r: 1.35, tag: 'rock' });
  wprop({ t: 0, x: WILD.x + x, y: WILD.y + y + .95, z: WILD.z + z, hx: .25, hy: .8, hz: .16, tag: 'rock' });
  const S = { id, name, i, col, g, rune, gem, p: V(x, y, z), labT: null }; return S;
});
const STONE_BY = new Map(STONES.map(s => [s.id, s]));
const lockTex = sprite('🔒 ???', .44, '#888888', 60).material;
STONES.forEach(S => { S.orbLab = sprite(S.name, .62, '#' + new THREE.Color(S.col).getHexString(), 48).material; });
const orbGeo = new THREE.SphereGeometry(.09, 16, 10), orbLock = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: .6 });
function waysSave() { store.set('kg-ways', JSON.stringify([...WD.ways])); }
function openOrbs(S) {
  closeOrbs(); headWorld(_wz1); _wz1.sub(WILD);
  const a0 = Math.atan2(_wz1.z - S.p.z, _wz1.x - S.p.x), list = STONES.filter(o => o !== S), g = new THREE.Group(); g.position.copy(S.p); WG.add(g);
  const orbs = list.map((o, k) => {
    const a = a0 + (k - (list.length - 1) / 2) * .42, unl = WD.ways.has(o.id);
    const m = new THREE.Mesh(orbGeo, unl ? new THREE.MeshStandardMaterial({ color: o.col, emissive: o.col, emissiveIntensity: .7 }) : orbLock);
    m.position.set(Math.cos(a) * 1.1, .5 + (k % 2) * .3, Math.sin(a) * 1.1); g.add(m);
    const l = new THREE.Sprite(unl ? o.orbLab : lockTex); l.scale.set(.44, .11, 1); l.position.copy(m.position).add(V(0, .14, 0)); g.add(l);
    return { m, o, unl, w: V() };
  });
  WD.orbs = { S, g, orbs, t: 0 }; showWsPanel(S);
}
function closeOrbs() { if (!WD.orbs) return; WG.remove(WD.orbs.g); WD.orbs = null; showWsPanel(null); }
function wayGo(o) {
  if (!WD.ways.has(o.id)) { toast('🔒 Find that waystone out in the Wilds first to unlock it!', 3); return; }
  closeOrbs(); WD.near = o; const p = V().copy(o.p).add(WILD); const off = V(1.6, 0, 1.6); if (o.id === 'sky') off.set(-1.2, 0, 1.6);
  arrive(p.add(off), Math.atan2(-off.x, -off.z) + Math.PI); WD.lastStone = o.id;
  toast('✨ Whoosh! ' + o.name, 2.5);
}
// put me at a world point (feet), facing yaw
function arrive(dest, yaw, area = 'wilds') {
  hands.forEach(h => { if (h.holding) dropProp(h); if (h.cup) cupDrop(h); if (h.sword) swordToStone(); if (h.piece) releasePiece(h); });
  WD.zip = null; WD.fly = null; headWorld(_wz1);
  const d = V().copy(dest); d.y = (area === 'wilds' ? groundAt(d.x, d.z) : 0) + state.bodyH + .03; if (dest.y > d.y - state.bodyH) d.y = dest.y + state.bodyH + .03;
  rig.position.add(d.sub(_wz1));
  state.vel.set(0, 0, 0); state.velBuf.length = 0; state.wasStuck = false;
  hands.forEach(h => { h.stuck = false; h.reset = true; });
  if (!state.xr && yaw !== undefined) state.yaw = yaw;
  state.area = area; AR.portalCool = 1; AR.snap = true;
  sfxWhoosh(); confetti(V().copy(dest).add(V(0, .4, 0)), 24, [0xffb23f, 0x3fb2ff, 0xffffff]);
}
function wildRespawn() { const S = STONE_BY.get(WD.lastStone) || STONES[0]; if (S.id === 'plaza') arrive(V().copy(WILD).add(WILD_SPAWN), 0); else wayGo(S); }
// desktop fast-travel panel (keys 1-8, or tap on a phone)
const wsPanel = (() => {
  const d = document.createElement('div'); d.id = 'wsPanel';
  d.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);display:none;flex-wrap:wrap;gap:6px;justify-content:center;max-width:min(94vw,720px);padding:10px 12px;border-radius:16px;background:rgba(22,30,44,.82);color:#fff;font:600 14px Fredoka,system-ui,sans-serif;z-index:30';
  document.body.appendChild(d); return d;
})();
function showWsPanel(S) {
  if (!S || state.xr) { wsPanel.style.display = 'none'; return; }
  wsPanel.innerHTML = '<div style="width:100%;text-align:center;margin-bottom:2px">✨ Fast travel: press a number (or tap)</div>';
  STONES.forEach((o, k) => { if (o === S) return; const b = document.createElement('button'); const unl = WD.ways.has(o.id);
    b.textContent = `${k + 1} ${unl ? o.name : '🔒 ???'}`; b.style.cssText = `border:0;border-radius:10px;padding:6px 10px;font:inherit;cursor:pointer;background:${unl ? '#' + new THREE.Color(o.col).getHexString() : '#555'};color:${unl ? '#14202e' : '#ccc'}`;
    b.onclick = () => wayGo(o); wsPanel.appendChild(b); });
  wsPanel.style.display = 'flex';
}
addEventListener('keydown', e => {
  if (!WD.orbs || state.xr || state.mode !== 'play') return; const m = /^Digit([1-8])$/.exec(e.code); if (!m) return;
  const o = STONES[+m[1] - 1]; if (o && o !== WD.orbs.S) wayGo(o);
});

/* ---------- the Plaza: map board, portals home, the big-map Battle Royale button ---------- */
function wildMapCanvas(size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d'), img = g.createImageData(size, size), c = new THREE.Color();
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = -WS + (px + .5) / size * WS * 2, z = -WS + (py + .5) / size * WS * 2, h = wildAt(x, z); terrSdf(x, z, 0, _wzn);
    if (h < WL) c.setHSL(.56, .55, .5 - Math.min(.12, (WL - h) * .1)); else groundCol(c, x, z, h, _wzn.y);
    const sh = clamp(1 + (_wzn.x - _wzn.z) * 1.4, .65, 1.3); const k = (py * size + px) * 4;
    img.data[k] = Math.min(255, c.r * 255 * sh); img.data[k + 1] = Math.min(255, c.g * 255 * sh); img.data[k + 2] = Math.min(255, c.b * 255 * sh); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0); return cv;
}
const MAP_IMG = wildMapCanvas(256);
const toMap = (x, z, S) => [(x + WS) / (2 * WS) * S, (z + WS) / (2 * WS) * S];
{
  const t = labelTex(1024, 1024, (g, W, H) => {
    g.fillStyle = '#5a3a20'; g.fillRect(0, 0, W, H); g.drawImage(MAP_IMG, 40, 110, W - 80, H - 150);
    g.textAlign = 'center'; g.fillStyle = '#ffd25a'; g.font = '72px "Lilita One", Impact, sans-serif'; g.fillText('THE WILDS', W / 2, 84);
    g.font = '30px "Lilita One", Impact, sans-serif';
    const lab = (x, z, txt) => { const [mx, my] = toMap(x, z, W - 80); g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(txt, 40 + mx, 110 + my * (H - 150) / (W - 80)); g.fillStyle = '#fff'; g.fillText(txt, 40 + mx, 110 + my * (H - 150) / (W - 80)); };
    lab(0, 8, '⭐ YOU ARE HERE'); lab(PEAK.x, PEAK.z + 20, 'Frostfang Peak'); lab(PYR.x, PYR.z + 30, 'Dune Temple'); lab(LAKE.x, LAKE.z, 'Big Lake'); lab(W_ELDER.x, W_ELDER.z + 26, 'Elder Tree');
    lab(TOWN.x, TOWN.z + 28, 'Old Town'); lab(CAVE.x, CAVE.z - 14, 'Crystal Cave'); lab(SKY.x, SKY.z - 18, 'Sky Islands'); lab(TOWER.x - 10, TOWER.z - 14, 'Beacon');
  });
  const g = new THREE.Group(); g.position.set(-7, 0, 5); g.rotation.y = Math.atan2(WILD_SPAWN.x + 7, WILD_SPAWN.z - 5); WG.add(g);
  const wood = mat(0x5a3a20);
  [-1, 1].forEach(s => part(new THREE.CylinderGeometry(.07, .08, 2.6, 8), wood, s * 1.05, 1.3, -.06, g));
  const b = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); b.position.set(0, 1.55, 0); g.add(b);
  wprop({ t: 0, x: WILD.x - 7, y: WILD.y + 1.55, z: WILD.z + 5, hx: 1.1, hy: 1.1, hz: .08, yaw: g.rotation.y, tag: 'wood' });
}
const wPortalGrove = makePortal(V(-3.5, 0, 15.5), Math.atan2(3.5, -5.5), 'BACK TO THE GROVE 🌳', 0x6fdc4f, 0xffd25a); WG.add(wPortalGrove.g); wPortalGrove.g.updateMatrixWorld(true);
const wPortalYard = makePortal(V(3.5, 0, 15.5), Math.atan2(-3.5, -5.5), 'SLICING YARD ⚔️', 0x3fe0bd, 0x8b6bff); WG.add(wPortalYard.g); wPortalYard.g.updateMatrixWorld(true);
[[-3.5, 15.5], [3.5, 15.5]].forEach(([x, z]) => wprop({ t: 1, x: WILD.x + x, z: WILD.z + z, cy: WILD.y + .06, hy: .06, r: 1.1, tag: 'rock' }));
const gPortalWilds = makePortal(WILDS_PORTAL_G, Math.atan2(-WILDS_PORTAL_G.x, -WILDS_PORTAL_G.z), 'THE WILDS 🗺️', 0xffb23f, 0x3fb2ff); scene.add(gPortalWilds.g); gPortalWilds.g.updateMatrixWorld(true);
addCol({ t: 1, x: WILDS_PORTAL_G.x, z: WILDS_PORTAL_G.z, cy: .06, hy: .06, r: 1.1, tag: 'rock' });
const BRW_BTN = (() => {
  const g = new THREE.Group(); g.position.set(3.2, 0, 7.2); WG.add(g);
  part(new THREE.CylinderGeometry(.16, .2, .8, 12), mat(0x5b6270), 0, .4, 0, g);
  const cap = part(new THREE.SphereGeometry(.13, 20, 10, 0, 6.283, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xff3040, emissiveIntensity: .5, roughness: .3 }), 0, .8, 0, g); cap.scale.y = .5;
  const s = sprite('⚔️ BIG MAP BATTLE ROYALE', 1.5, '#ff3040', 44); s.position.y = 1.3; g.add(s);
  wprop({ t: 1, x: WILD.x + 3.2, z: WILD.z + 7.2, cy: WILD.y + .4, hy: .4, r: .2, tag: 'rock' });
  return { g, cap, top: V(3.2, .84, 7.2).add(WILD), in: [false, false] };
})();

/* ---------- secrets ---------- */
function wSecret(id, msg) {
  if (WD.found.has(id)) return false; WD.found.add(id); store.set('kg-wsec', JSON.stringify([...WD.found]));
  toast(msg, 7); sfxWin(); headWorld(_wz1); confetti(_wz1.clone().add(V(0, .3, 0)), 70); hands.forEach(h => buzz(h, 1, 120)); return true;
}

/* ---------- minimap (screens only) ---------- */
const miniMap = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 168; c.id = 'wildMap';
  c.style.cssText = 'position:fixed;right:12px;top:64px;width:150px;height:150px;border-radius:50%;border:4px solid #ffd25a;box-shadow:0 4px 14px rgba(0,0,0,.35);display:none;z-index:20;pointer-events:none';
  document.body.appendChild(c); return c;
})();
function drawMiniMap() {
  const g = miniMap.getContext('2d'), S = 168, sc = S / 120;   // shows 120 m across
  headWorld(_wz1); const px = _wz1.x - WILD.x, pz = _wz1.z - WILD.z;
  g.save(); g.clearRect(0, 0, S, S); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip();
  g.fillStyle = '#4a7a3a'; g.fillRect(0, 0, S, S);
  const k = MAP_IMG.width / (2 * WS); g.imageSmoothingEnabled = true;
  g.drawImage(MAP_IMG, (px - 60 + WS) * k, (pz - 60 + WS) * k, 120 * k, 120 * k, 0, 0, S, S);
  const dot = (x, z, col, r) => { const mx = S / 2 + (x - px) * sc, my = S / 2 + (z - pz) * sc; if (Math.hypot(mx - S / 2, my - S / 2) > S / 2 - 4) return; g.fillStyle = col; g.beginPath(); g.arc(mx, my, r, 0, 7); g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#000'; g.stroke(); };
  STONES.forEach(s => dot(s.p.x, s.p.z, WD.ways.has(s.id) ? '#' + new THREE.Color(s.col).getHexString() : '#888', 4));
  for (const f of MP.others.values()) dot(f.head.position.x - WILD.x, f.head.position.z - WILD.z, '#ff4fa8', 4);
  if (BR.phase !== 'off') { g.strokeStyle = '#c08bff'; g.lineWidth = 3; g.beginPath(); g.arc(S / 2 + (BR.storm.c.x - WILD.x - px) * sc, S / 2 + (BR.storm.c.z - WILD.z - pz) * sc, BR.storm.r * sc, 0, 7); g.stroke(); }
  g.restore();
  g.save(); g.translate(S / 2, S / 2); g.rotate(-state.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
  g.fillStyle = '#fff'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('N', S / 2, 15);
}

/* ---------- riding the zipline + wLaunch flights ---------- */
function zipStart(h) {
  if (WD.zip) return; WD.zip = { s: 0, v: 2, h }; toast('🪂 WHEEE! Let go to drop off.', 3); if (h) buzz(h, 1, 80);
  if (ac) tone('sawtooth', 300, 600, .4, .05);
}
function zipDrop() { if (!WD.zip) return; const v = WD.zip.v; WD.zip = null; _wz2.subVectors(ZIP_B, ZIP_A).normalize(); state.vel.copy(_wz2).multiplyScalar(v); state.vel.y = Math.max(state.vel.y, 1); hands.forEach(h => { h.stuck = false; h.reset = true; }); }
function wLaunch(P) {
  headWorld(_wz1); const from = V().copy(_wz1); from.y -= state.bodyH;
  const to = V().copy(P.to).add(WILD); if (P.to.y === 0) to.y = groundAt(to.x, to.z);
  const up = Math.max(from.y, to.y) + 3.5 - from.y, vy = Math.sqrt(2 * G * up), tUp = vy / G, tDn = Math.sqrt(2 * (from.y + up - to.y) / G), T = tUp + tDn;
  WD.fly = { from, v: V((to.x - from.x) / T, vy, (to.z - from.z) / T), t: 0, T }; P.sq = 1; sfxBoing(); hands.forEach(h => { h.stuck = false; buzz(h, 1, 90); });
}

/* ---------- hooks: grip, E key ---------- */
function wildGrab(h) {
  if (state.area !== 'wilds') return false;
  if (h.pos.distanceTo(_wz1.copy(ZIP_HANDLE).add(WILD)) < .35) { zipStart(h); return true; }
  return false;
}
function wildDrop(h) { if (WD.zip && WD.zip.h === h) { zipDrop(); return true; } return false; }
function wildDesk() {
  if (state.area !== 'wilds') return false;
  if (WD.zip) { zipDrop(); return true; }
  if (aimAt(3, f => f('brw', BRW_BTN.top, .15)) === 'brw') { brStartAsk('wilds'); return true; }
  headWorld(_wz1); if (_wz1.distanceTo(_wz2.copy(ZIP_HANDLE).add(WILD)) < 2.2) { zipStart(null); return true; }
  if (WD.orbs) { const o = aimAt(3, f => WD.orbs.orbs.forEach(q => f(q, q.m.getWorldPosition(q.w), .12))); if (o) { wayGo(o.o); return true; } }
  return false;
}
addEventListener('keydown', e => { if (e.code === 'Space' && WD.zip && !state.xr) zipDrop(); });

/* ---------- every frame ---------- */
function stepWilds(dt) {
  const here = state.area === 'wilds';
  if (here !== WD.inside) {   // see further out here, and a light haze
    WD.inside = here; scene.fog.near = here ? 70 : 34; scene.fog.far = here ? 250 : 95; camera.far = here ? 320 : 220; camera.updateProjectionMatrix(); if (CS.cam) { CS.cam.far = camera.far; CS.cam.updateProjectionMatrix(); }
    miniMap.style.display = here && !state.xr && state.mode === 'play' ? 'block' : 'none'; if (!here) closeOrbs();
  }
  WG.visible = here;
  if (state.mode !== 'play') { miniMap.style.display = 'none'; }
  // the grove portal into the Wilds
  if (state.mode === 'play' && AR.portalCool <= 0) {
    headWorld(_wz1);
    const ring = P => { P.g.worldToLocal(_wz2.copy(_wz1)); return Math.abs(_wz2.z) < .32 && Math.hypot(_wz2.x, _wz2.y - 1) < .8; };
    if (state.area === 'grove' && ring(gPortalWilds)) { arrive(V().copy(WILD).add(WILD_SPAWN), 0); toast(state.xr ? '🗺️ THE WILDS! Huge world. Walk up to waystones to unlock fast travel!' : '🗺️ THE WILDS! Huge world. Walk up to waystones to unlock fast travel (number keys)!', 7); }
    else if (here && ring(wPortalGrove)) { arrive(V().copy(WILDS_PORTAL_G).add(V(WILDS_PORTAL_G.x, 0, WILDS_PORTAL_G.z).normalize().multiplyScalar(-1.6)), Math.atan2(WILDS_PORTAL_G.x, WILDS_PORTAL_G.z), 'grove'); toast('🌳 Back in the grove!', 2.5); }
    else if (here && ring(wPortalYard)) { state.area = 'grove'; travel(true); }
  }
  if (!here || state.area !== 'wilds') return;
  const t = tAll;
  // waystones: unlock when close, show orbs when right next to one
  headWorld(_wz1); const lx = _wz1.x - WILD.x, lz = _wz1.z - WILD.z;
  let near = null;
  for (const S of STONES) {
    const d = Math.hypot(lx - S.p.x, lz - S.p.z), dy = Math.abs(_wz1.y - WILD.y - S.p.y);
    if (d < 7 && dy < 6 && !WD.ways.has(S.id)) { WD.ways.add(S.id); waysSave(); toast(`✨ Waystone unlocked: ${S.name}! (${WD.ways.size}/8)`, 4); sfxBerry(WD.ways.size); confetti(V().copy(S.p).add(WILD).add(V(0, 2, 0)), 40, [S.col, 0xffffff]); }
    if (d < 2.6 && dy < 3) near = S;
    S.rune.emissiveIntensity = WD.ways.has(S.id) ? 1.1 + Math.sin(t * 3 + S.i) * .3 : 0; S.gem.rotation.y = t * 1.5 + S.i; S.gem.position.y = 2.05 + Math.sin(t * 2 + S.i) * .06;
  }
  if (near && (!WD.orbs || WD.orbs.S !== near)) { openOrbs(near); WD.lastStone = near.id; }
  else if (!near && WD.orbs) closeOrbs();
  if (WD.orbs) {
    WD.orbs.t += dt; const s = Math.min(1, WD.orbs.t * 3); WD.orbs.g.scale.setScalar(s);
    WD.orbs.orbs.forEach((q, k) => { q.m.position.y += Math.sin(t * 2 + k) * .0006; if (q.unl) q.m.rotation.y = t * 2; });
    if (state.xr || sim.on) for (const h of hands) { if (!h.tracked) continue; for (const q of WD.orbs.orbs) if (h.pos.distanceTo(q.m.getWorldPosition(q.w)) < .13) { buzz(h, .8, 50); wayGo(q.o); return; } }
  }
  // the big-map Battle Royale button
  BRW_BTN.cap.material.emissiveIntensity = .4 + Math.sin(t * 4) * .2;
  if (state.xr || sim.on) for (const h of hands) { if (!h.tracked) continue; const ins = h.pos.distanceTo(BRW_BTN.top) < .13; if (ins && !BRW_BTN.in[h.i]) { buzz(h, .7, 40); brStartAsk('wilds'); } BRW_BTN.in[h.i] = ins; }
  // wLaunch pads
  for (const P of WD.pads) { P.sq = Math.max(0, P.sq - dt * 3); const s = P.sq; P.cap.scale.set(1 + s * .25, .45 * (1 - s * .4 + Math.sin(s * 12) * s * .2), 1 + s * .25); }
  if (!WD.fly && !WD.zip && bodyInfo.col && bodyInfo.col.wLaunch && state.vel.y < 2) wLaunch(bodyInfo.col.wLaunch);
  if (WD.fly) {
    const F = WD.fly; F.t += dt; const tt = Math.min(F.t, F.T);
    _wz2.copy(F.from).addScaledVector(F.v, tt); _wz2.y += -.5 * G * tt * tt + state.bodyH; headWorld(_wz1); rig.position.add(_wz2.sub(_wz1));
    state.vel.set(F.v.x, F.v.y - G * tt, F.v.z);
    if (F.t >= F.T) { WD.fly = null; state.vel.set(state.vel.x * .15, -2, state.vel.z * .15); }
  }
  // zipline
  if (WD.zip) {
    const Z = WD.zip, L = ZIP_A.distanceTo(ZIP_B); Z.v = Math.min(17, Z.v + 5 * dt); Z.s += Z.v * dt;
    if (Z.s > L - 4) { zipDrop(); toast('🌊 Splashdown zone! Nice ride.', 2.5); }
    else { _wz2.lerpVectors(ZIP_A, ZIP_B, Z.s / L).add(WILD); _wz2.y -= .85; headWorld(_wz1); rig.position.add(_wz2.sub(_wz1)); state.vel.set(0, 0, 0); ZIP_HANDLE_M.position.lerpVectors(ZIP_A, ZIP_B, Z.s / L).add(V(0, -.7, 0)); }
    if (Z.h && !Z.h.tracked) zipDrop();
  } else ZIP_HANDLE_M.position.lerp(ZIP_HANDLE, Math.min(1, dt * .8));
  // wading: water slows you down a little, with a splash when you land in it
  const feet = _wz1.y - WILD.y - state.bodyH;
  if (!SW.on && feet < WL - .05 && gy(lx, lz) < WL) { const k = Math.exp(-dt * 1.6); state.vel.x *= k; state.vel.z *= k; if (!WD.wet && state.vel.y < -3 && ac) noiseHit(ac.currentTime, .25, .4, 'lowpass', 900, .7); WD.wet = true; } else WD.wet = false;
  // wKeep inside the world: the edge mountains are huge, but just in case
  const r = Math.hypot(lx, lz); if (r > 296) { rig.position.x -= lx / r * (r - 296); rig.position.z -= lz / r * (r - 296); }
  // life
  beam.gem.rotation.y = t; beam.piv.rotation.y = t * .6;
  CRYSTAL.cm.emissiveIntensity = .8 + Math.sin(t * 1.3) * .25;
  for (const B of WD.birds) { B.a += B.sp * dt; const x = B.cx + Math.cos(B.a) * B.r, z = B.cz + Math.sin(B.a) * B.r; B.g.position.set(x, B.h + Math.sin(B.a * 3) * 1.5 + gy(B.cx, B.cz), z); B.g.rotation.y = -B.a + (B.sp > 0 ? 0 : Math.PI); const fl = Math.sin(t * 9 + B.r) * .55; B.wl.rotation.z = fl; B.wr.rotation.z = -fl; }
  if ((WD.cull -= dt) < 0) { WD.cull = .3; for (const o of WD.small) { o.getWorldPosition(_wz2); o.visible = _wz2.distanceToSquared(_wz1) < 150 * 150; } }
  IDOL.idol.rotation.y = t * .5; SHROOM.sh.rotation.y = t * .7;
  if (CHEST.open > 0 && CHEST.open < 1) { CHEST.open = Math.min(1, CHEST.open + dt * 2); CHEST.lid.rotation.x = -CHEST.open * 1.9; }
  // secrets
  if (_wz1.distanceTo(_wz2.copy(CRYSTAL.top).add(WILD).add(V(0, 1, 0))) < 4.5 && wSecret('summit', '⛰️ SECRET! You reached the top of Frostfang Peak! The crystal hums your name...')) CRYSTAL.cm.emissiveIntensity = 3;
  if (_wz1.distanceTo(_wz2.copy(IDOL.top).add(WILD)) < 1.6) wSecret('idol', '🏺 SECRET! The Golden Idol of Elder Thump, lost for a thousand naps!');
  if (_wz1.distanceTo(_wz2.copy(BOTTLE.at).add(WILD)) < 1.2) wSecret('bottle', '📜 SECRET! A message in a bottle: "The cave remembers who squeezes through the crack."');
  if (_wz1.distanceTo(_wz2.copy(SHROOM.at).add(WILD)) < 1.3) wSecret('shroom', '🍄 SECRET! The Golden Shroom! Only the tiniest Thumplings fit back here.');
  if (_wz1.distanceTo(_wz2.copy(CHEST.at).add(WILD)) < 1.4 && wSecret('chest', '💰 SECRET! Sky treasure! The highest island had loot all along!')) { CHEST.open = .01; confetti(_wz2.clone().add(V(0, .5, 0)), 90, [0xffc54a, 0xffe27a, 0xffffff]); }
  if ((WD.mapT -= dt) < 0 && miniMap.style.display !== 'none') { WD.mapT = .1; drawMiniMap(); }
  miniMap.style.display = !state.xr && state.mode === 'play' && !CS.on ? 'block' : 'none';
}
window.__kg.wilds = { WD, WILD, WS, WL, STONES, ISLANDS, CRYSTAL, IDOL, SHROOM, CHEST, BOTTLE, ZIP_A, ZIP_B, ZIP_HANDLE, BRW_BTN, wildAt, groundAt, arrive, wayGo, zipStart, zipDrop, wLaunch, wildRespawn, gPortalWilds, wPortalGrove, wPortalYard, WFIELD, PG };
