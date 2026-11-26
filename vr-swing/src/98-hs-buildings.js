/* ======================================================================
   HIDE-AND-SEEK BUILDINGS in the Wilds (the Battle Royale map), all with big walk-in insides:
   - 🛍️ MEGA MALL in the plains: 3 floors, 24 shops, an atrium with a fountain and moving escalators.
   - 🏨 FROSTFANG LODGE in the snow: a 2-story log cabin hotel. Its 2 stone chimneys are hollow: crawl in
     through the fireplace and climb up inside them to hide (there are ledges to sit on).
   - 🏺 SUN TOMB in the desert: a 3-story step pyramid full of ancient stuff (pillars, sarcophagi, treasure).
   Stairs, escalators and roofs use tilted-box colliders (t:5 in 01-core). HSB.spots = hiding spots for bots.
   ====================================================================== */
const HSB = { spots: [], esc: [], secrets: [], escMat: null, found: new Set() };
try { JSON.parse(store.get('kg-hsec') || '[]').forEach(k => HSB.found.add(k)); } catch (e) { }
function hsMk(P) {   // a builder that works in coordinates around one building's middle (P.x, P.y, P.z)
  const g = new THREE.Group(); WG.add(g);
  const B = {
    g,
    box(x, y, z, w, h, d, m, solid = true, tag = 'rock', yaw = 0) { return wbox(P.x + x, P.y + y, P.z + z, w, h, d, m, { parent: g, solid, tag, yaw }); },
    rng(x0, x1, y0, y1, z0, z1, m, solid = true, tag) { return B.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, m, solid, tag); },
    cyl(x, y, z, r, h, m, solid = true, o = {}) { return wcyl(P.x + x, P.y + y, P.z + z, r, h, m, Object.assign({ parent: g, solid }, o)); },
    mesh(geo, m, x, y, z, ry = 0) { const me = new THREE.Mesh(geo, m); me.position.set(P.x + x, P.y + y, P.z + z); me.rotation.y = ry; me.castShadow = me.receiveShadow = true; g.add(me); return me; },
    // a straight wall from A to B (along x or along z) with openings: [from, to, top, bottom] measured along the wall from A
    wall(ax, az, bx, bz, y0, h, t, m, holes = [], tag) {
      const alongX = Math.abs(bx - ax) >= Math.abs(bz - az), L = alongX ? bx - ax : bz - az, s = Math.sign(L) || 1, len = Math.abs(L);
      const piece = (u0, u1, v0, v1) => { if (u1 - u0 < .01 || v1 - v0 < .01) return; const uc = (u0 + u1) / 2 * s;
        B.box(alongX ? ax + uc : ax, y0 + (v0 + v1) / 2, alongX ? az : az + uc, alongX ? u1 - u0 : t, v1 - v0, alongX ? t : u1 - u0, m, true, tag); };
      const hs = holes.map(q => [Math.max(0, q[0]), Math.min(len, q[1]), Math.min(h, q[2]), q[3] || 0]).sort((a, b) => a[0] - b[0]);
      let u = 0; for (const [u0, u1, top, bot] of hs) { piece(u, u0, 0, h); piece(u0, u1, 0, bot); piece(u0, u1, top, h); u = u1; }
      piece(u, len, 0, h);
    },
    // a floor (top at y) with rectangular holes [x0, x1, z0, z1]
    slab(x0, x1, z0, z1, y, th, m, holes = [], tag = 'wood') {
      const cuts = (a, b, k) => [...new Set([a, b, ...holes.flatMap(h => [h[k], h[k + 1]])])].filter(v => v >= a && v <= b).sort((p, q) => p - q);
      const xs = cuts(x0, x1, 0), zs = cuts(z0, z1, 2);
      for (let j = 0; j < zs.length - 1; j++) {
        let run = null; const cz = (zs[j] + zs[j + 1]) / 2;
        const emit = () => { if (run) B.rng(run[0], run[1], y - th, y, zs[j], zs[j + 1], m, true, tag); run = null; };
        for (let i = 0; i < xs.length - 1; i++) {
          const cx = (xs[i] + xs[i + 1]) / 2, open = holes.some(h => cx > h[0] && cx < h[1] && cz > h[2] && cz < h[3]);
          if (open) emit(); else { if (!run) run = [xs[i], 0]; run[1] = xs[i + 1]; }
        }
        emit();
      }
    },
    // stairs / escalator / roof from the bottom edge middle A to the top edge middle B (top surface), w wide
    ramp(ax, ay, az, bx, by, bz, w, m, o = {}) {
      const dx = bx - ax, dz = bz - az, Lh = Math.hypot(dx, dz), H = by - ay, L = Math.hypot(Lh, H), th = o.th || .3;
      const yaw = Math.atan2(dx, dz), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.atan2(H, Lh), yaw, 0, 'YXZ'));
      const nrm = V(0, 1, 0).applyQuaternion(q), rt = V(1, 0, 0).applyQuaternion(q), c = V((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2).addScaledVector(nrm, -th / 2);
      const col = (cc, hx, hy, hz) => wprop({ t: 5, x: WILD.x + P.x + cc.x, y: WILD.y + P.y + cc.y, z: WILD.z + P.z + cc.z, hx, hy, hz, q, tag: o.tag || 'rock' });
      col(c, w / 2, th / 2, L / 2 + .04);
      const slabM = new THREE.Mesh(new THREE.BoxGeometry(w, th, L), o.under || m); slabM.position.set(P.x + c.x, P.y + c.y, P.z + c.z); slabM.quaternion.copy(q); slabM.castShadow = slabM.receiveShadow = true; g.add(slabM);
      if (o.rails) [-1, 1].forEach(sd => {   // see-through side rails you can't fall over
        const rc = c.clone().addScaledVector(nrm, .55 + th / 2).addScaledVector(rt, sd * (w / 2 + .05));
        col(rc, .05, .55, L / 2); const rm = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.1, L), o.rails); rm.position.set(P.x + rc.x, P.y + rc.y, P.z + rc.z); rm.quaternion.copy(q); g.add(rm);
        const hr = new THREE.Mesh(new THREE.BoxGeometry(.14, .08, L), o.handrail || m); hr.position.copy(rm.position).addScaledVector(nrm, .58); hr.quaternion.copy(q); g.add(hr);
      });
      if (!o.plain) {   // steps on top
        const N = Math.max(2, Math.round(H / .22)), run = Lh / N, rise = H / N;
        for (let i = 0; i < N; i++) B.box(ax + dx / Lh * (i + .5) * run, ay + (i + .5) * rise - .05, az + dz / Lh * (i + .5) * run, w, rise + .1, run, o.step || m, false, 'rock', yaw);
      }
      if (o.esc) HSB.esc.push({ a: V(WILD.x + P.x + ax, WILD.y + P.y + ay, WILD.z + P.z + az), b: V(WILD.x + P.x + bx, WILD.y + P.y + by, WILD.z + P.z + bz), w, dir: o.esc });
      return { q, nrm, c };
    },
    spot(x, y, z) { HSB.spots.push(V(WILD.x + P.x + x, WILD.y + P.y + y, WILD.z + P.z + z)); },
    secret(id, x, y, z, r, msg) { HSB.secrets.push({ id, p: V(WILD.x + P.x + x, WILD.y + P.y + y, WILD.z + P.z + z), r, msg }); }
  };
  return B;
}
// one texture holds every sign (2 columns x 8 rows of 512x128)
const HS_SIGNS = ['🍕 PIZZA PALACE', '🧸 TOY TOWN', '👕 THREADS', '🎮 GAME ZONE', '🍦 SCOOPS', '📚 BOOK NOOK', '🐾 PET PALS', '👟 KICKS', '🍬 CANDY CLOUD', '🎸 MUSIC BOX', '⚽ SPORTS', '🧁 BAKERY',
  '🛍️ MEGA MALL', '🏨 FROSTFANG LODGE', '🏺 SUN TOMB', '🚪 STAFF ONLY'];
const HS_SIGN_COL = ['#ff5f3d', '#ff4fa8', '#8b6bff', '#3fb2ff', '#ff9ad5', '#5fd94a', '#ffb23f', '#3fe0bd', '#ff7ae0', '#ffd25a', '#4f8bff', '#e08a4f', '#ffd25a', '#bfe8ff', '#ffc54a', '#bbbbbb'];
const HS_ATLAS = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const g = c.getContext('2d');
  HS_SIGNS.forEach((s, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
    g.fillStyle = 'rgba(20,24,36,1)'; g.fillRect(x + 4, y + 4, 504, 120); g.strokeStyle = HS_SIGN_COL[i]; g.lineWidth = 8; g.strokeRect(x + 8, y + 8, 496, 112);
    g.fillStyle = HS_SIGN_COL[i]; g.font = '700 56px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x + 256, y + 68, 470);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: t, fog: true });
})();
function hsSign(B, i, x, y, z, ry, w) {
  const geo = new THREE.PlaneGeometry(w, w / 4), uv = geo.attributes.uv, u0 = (i % 2) * .5, v1 = 1 - Math.floor(i / 2) * .125;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * .5, v1 - .125 + uv.getY(k) * .125);
  const m = B.mesh(geo, HS_ATLAS, x, y, z, ry); m.castShadow = false; return m;
}
const hsGlass = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .3, roughness: .1, metalness: .2, depthWrite: false });
const hsLight = new THREE.MeshBasicMaterial({ color: 0xfff6dc });
// moving escalator stripes
HSB.escMat = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#4a515c'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#8f98a6'; for (let i = 0; i < 64; i += 8) g.fillRect(0, i, 64, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({ map: t, roughness: .4, metalness: .6 });
})();

/* ---------------- 🛍️ MEGA MALL (plains) ---------------- */
{
  const B = hsMk(MALL), F = [0, 4.5, 9], TOP = 13.5, HX = 24, HZ = 16, T = .4;
  const wallM = mat(0xeee6d8), trimM = mat(0x55657f), floorM = mat(0xd9d3c7), tileM = mat(0xc4ccd8), steel = mat(0x9aa3ae, { metalness: .5, roughness: .4 });
  const ATR = [-9, 9, -5, 5], ESC2 = [12.6, 20.8, -1.8, 1.8];
  B.rng(-HX, HX, -.3, .06, -HZ, HZ, tileM);
  B.slab(-HX, HX, -HZ, HZ, F[1], .3, floorM, [ATR]);
  B.slab(-HX, HX, -HZ, HZ, F[2], .3, floorM, [ATR, ESC2]);
  B.rng(-HX - .5, HX + .5, TOP, TOP + .5, -HZ - .5, HZ + .5, trimM);
  for (const sx of [-1, 1]) B.wall(sx * HX, -HZ, sx * HX, HZ, 0, TOP, T, wallM, [[13.5, 18.5, 3.6], [4, 9, 7.6, 5.6], [23, 28, 7.6, 5.6], [4, 9, 12.1, 10.1], [23, 28, 12.1, 10.1]]);
  for (const sz of [-1, 1]) B.wall(-HX - .2, sz * HZ, HX + .2, sz * HZ, 0, TOP, T, wallM, [[2, 6, 3, 1], [42.4, 46.4, 3, 1]]);
  // facade stripes + the big sign facing the Plaza
  for (const y of [4.4, 8.9]) for (const sx of [-1, 1]) B.rng(sx * HX - .3, sx * HX + .3, y - .2, y + .2, -HZ, HZ, trimM, false);
  hsSign(B, 12, HX + .26, 5.6, 0, Math.PI / 2, 9); hsSign(B, 12, -HX - .26, 5.6, 0, -Math.PI / 2, 9);
  // shops: 4 on each side, on every floor (24 in all)
  const kinds = ['food', 'toys', 'clothes', 'arcade', 'food', 'books', 'misc', 'clothes', 'food', 'misc', 'misc', 'food'];
  const R = seeded(911), cols = [0xff5f6d, 0xffd25a, 0x3fb2ff, 0x8b6bff, 0x5fd94a, 0xff8a3d, 0xff4fa8, 0x3fe0bd];
  let n = 0;
  for (let k = 0; k < 3; k++) {
    const f = F[k], top = k < 2 ? F[k + 1] - .3 : TOP;
    for (const sd of [-1, 1]) {
      B.wall(-HX, sd * 8, HX, sd * 8, f, top - f, .25, wallM, [0, 1, 2, 3].map(i => [i * 12 + 3, i * 12 + 9, 3.2]));
      for (const x of [-12, 0, 12]) B.rng(x - .12, x + .12, f, top, sd > 0 ? 8 : -HZ, sd > 0 ? HZ : -8, wallM);
      for (let i = 0; i < 4; i++) {
        const x0 = -HX + i * 12, type = n % 12, kind = kinds[type]; n++;
        hsSign(B, type, x0 + 6, f + 3.75, sd * (8 - .14) + (sd > 0 ? 0 : 0), sd > 0 ? Math.PI : 0, 5);
        const zf = z => sd * z;   // 8 = shop front, 16 = back wall
        // counter + back shelves full of colorful stuff
        B.rng(x0 + 1, x0 + 4.2, f, f + 1.05, Math.min(zf(10.2), zf(11)), Math.max(zf(10.2), zf(11)), mat(cols[type % 8]));
        B.rng(x0 + 1.5, x0 + 10.5, f, f + 2.2, Math.min(zf(15.1), zf(15.8)), Math.max(zf(15.1), zf(15.8)), mat(0x9b7a55));
        for (let j = 0; j < 7; j++) B.box(x0 + 2.2 + j * 1.2, f + 1.15 + (j % 2) * .6, zf(15.1) - sd * .05, .5, .4, .3, mat(cols[(j + type) % 8]), false);
        B.spot(x0 + 2.6, f, zf(11.7));
        if (kind === 'food') {   // tables + a giant food sign
          for (const [tx, tz] of [[7, 10.5], [9.6, 12.6]]) { B.cyl(x0 + tx, f + .4, zf(tz), .7, .08, mat(0xffffff), true, { seg: 14 }); B.cyl(x0 + tx, f + .2, zf(tz), .08, .4, steel); }
          B.cyl(x0 + 6, f + 3.2, zf(15.3), .9, .2, mat(cols[(type + 3) % 8]), false, { seg: 16 }).rotation.x = Math.PI / 2;
        } else if (kind === 'toys') {   // a ball pit (you can sink in and hide!) + a giant plush
          B.wall(x0 + 6, zf(9.5), x0 + 10.5, zf(9.5), f, .5, .15, mat(0xff4fa8)); B.wall(x0 + 6, zf(13.5), x0 + 10.5, zf(13.5), f, .5, .15, mat(0xff4fa8));
          B.wall(x0 + 6, zf(9.5), x0 + 6, zf(13.5), f, .5, .15, mat(0xff4fa8)); B.wall(x0 + 10.5, zf(9.5), x0 + 10.5, zf(13.5), f, .5, .15, mat(0xff4fa8));
          const bg = new THREE.SphereGeometry(.13, 8, 6), ballM = new THREE.MeshStandardMaterial({ roughness: .4 }), im = new THREE.InstancedMesh(bg, ballM, 140), m4 = new THREE.Matrix4(), cc = new THREE.Color();
          for (let b = 0; b < 140; b++) { im.setMatrixAt(b, m4.makeTranslation(MALL.x + x0 + 6.2 + R() * 4.1, MALL.y + f + .1 + R() * .55, MALL.z + zf(9.7 + R() * 3.6))); im.setColorAt(b, cc.set(cols[b % 8])); }
          im.computeBoundingSphere(); B.g.add(im); B.spot(x0 + 8.2, f - .2, zf(11.5));
          const bear = mat(0xb07a4a); B.mesh(new THREE.SphereGeometry(.9, 14, 10), bear, x0 + 2.5, f + .9, zf(13.6)); B.mesh(new THREE.SphereGeometry(.6, 14, 10), bear, x0 + 2.5, f + 2.2, zf(13.6));
          [-1, 1].forEach(e => B.mesh(new THREE.SphereGeometry(.22, 10, 8), bear, x0 + 2.5 + e * .45, f + 2.7, zf(13.6)));
        } else if (kind === 'clothes') {   // racks + changing rooms with curtains (hide inside!)
          for (const rx of [5.5, 8]) { B.cyl(x0 + rx, f + 1.6, zf(10.8), .04, 3.2, steel, false).rotation.x = Math.PI / 2; for (let c = 0; c < 6; c++) B.box(x0 + rx + (R() - .5) * .2, f + 1.1, zf(9.6 + c * .45), .55, .9, .08, mat(cols[(c + rx | 0) % 8]), false); }
          for (const bx of [9.2, 10.7]) {
            B.rng(x0 + bx - .7, x0 + bx + .7, f, f + 2.3, Math.min(zf(15.05), zf(15.1)), Math.max(zf(15.05), zf(15.1)), wallM);
            B.box(x0 + bx - .7, f + 1.15, zf(14.3), .08, 2.3, 1.5, wallM); B.box(x0 + bx + .7, f + 1.15, zf(14.3), .08, 2.3, 1.5, wallM);
            B.box(x0 + bx, f + 1.25, zf(13.55), 1.32, 2.1, .04, mat(0x8b1e3f), false);   // curtain: walk right through it
            B.spot(x0 + bx, f, zf(14.4));
          }
        } else if (kind === 'arcade') {
          for (let a = 0; a < 4; a++) { B.rng(x0 + 5 + a * 1.4, x0 + 6 + a * 1.4, f, f + 1.9, Math.min(zf(14.2), zf(15)), Math.max(zf(14.2), zf(15)), mat(0x24283a)); B.box(x0 + 5.5 + a * 1.4, f + 1.45, zf(14.18), .7, .5, .02, new THREE.MeshBasicMaterial({ color: cols[a + 2] }), false); }
        } else if (kind === 'books') {
          for (const bz of [10, 12]) { B.rng(x0 + 5, x0 + 10.5, f, f + 2.1, Math.min(zf(bz), zf(bz + .5)), Math.max(zf(bz), zf(bz + .5)), mat(0x7a5232)); for (let c = 0; c < 9; c++) B.box(x0 + 5.3 + c * .6, f + 1.5, zf(bz) - sd * .03, .45, .5, .05, mat(cols[(c + bz) % 8]), false); }
        } else {   // misc: crates + a tall display you can hide behind
          for (let c = 0; c < 3; c++) B.box(x0 + 6 + c * 1.5, f + .45, zf(12.5 + (c % 2)), .9, .9, .9, mat(0xc49a5e));
          B.rng(x0 + 9.5, x0 + 10.6, f, f + 2.6, Math.min(zf(9.6), zf(10.4)), Math.max(zf(9.6), zf(10.4)), mat(cols[(type + 5) % 8]));
        }
      }
    }
    // ceiling lights
    for (const x of [-18, -6, 6, 18]) for (const z of [-6.5, 6.5]) B.box(x, top - .04, z, 2.4, .06, .5, hsLight, false);
  }
  // atrium: fountain, benches, plants
  B.cyl(0, .3, 1, 2.4, .6, mat(0xb8c2cc), true, { seg: 24 }); B.cyl(0, .55, 1, 2.1, .08, new THREE.MeshStandardMaterial({ color: 0x4fb8ff, roughness: .1, metalness: .3, transparent: true, opacity: .8 }), false, { seg: 24 });
  B.cyl(0, 1.2, 1, .25, 1.4, mat(0xb8c2cc)); B.mesh(new THREE.SphereGeometry(.4, 12, 8), new THREE.MeshStandardMaterial({ color: 0x9fe0ff, transparent: true, opacity: .55 }), 0, 2.05, 1);
  for (const [x, z] of [[-8.3, 4.4], [7.5, 4], [7.5, -3.5], [3.5, -4]]) { B.cyl(x, .45, z, .45, .9, mat(0xc4733f)); B.mesh(new THREE.IcosahedronGeometry(.75, 1), mat(0x3f9b3c), x, 1.4, z); }
  for (const x of [-15, 15]) for (const z of [-4, 4]) { B.box(x, .25, z, 2.4, .5, .6, mat(0x8a5a32)); B.spot(x, 0, z + Math.sign(z) * .8); }
  // escalators: ground -> floor 2 in the atrium, floor 2 -> floor 3 in the east hall (one goes up, one goes down)
  const escO = d => ({ esc: d, step: HSB.escMat, under: steel, rails: hsGlass, handrail: mat(0x202530), tag: 'rock' });
  B.ramp(-6.6, 0, 2.8, -6.6, F[1], -5, 1.4, steel, escO(1)); B.ramp(-4.8, 0, 2.8, -4.8, F[1], -5, 1.4, steel, escO(-1));
  B.ramp(20.6, F[1], -.8, 12.6, F[2], -.8, 1.4, steel, escO(1)); B.ramp(20.6, F[1], .8, 12.6, F[2], .8, 1.4, steel, escO(-1));
  // glass railings
  B.wall(-9, -5, 9, -5, F[1], 1.1, .08, hsGlass, [[1.5, 5.1, 1.1]]); B.wall(-9, 5, 9, 5, F[1], 1.1, .08, hsGlass); B.wall(-9, -5, -9, 5, F[1], 1.1, .08, hsGlass); B.wall(9, -5, 9, 5, F[1], 1.1, .08, hsGlass);
  B.wall(-9, -5, 9, -5, F[2], 1.1, .08, hsGlass); B.wall(-9, 5, 9, 5, F[2], 1.1, .08, hsGlass); B.wall(-9, -5, -9, 5, F[2], 1.1, .08, hsGlass); B.wall(9, -5, 9, 5, F[2], 1.1, .08, hsGlass);
  B.wall(12.6, -1.8, 20.8, -1.8, F[2], 1.1, .08, hsGlass); B.wall(12.6, 1.8, 20.8, 1.8, F[2], 1.1, .08, hsGlass); B.wall(20.8, -1.8, 20.8, 1.8, F[2], 1.1, .08, hsGlass);
  // a rooftop surprise
  B.secret('mall', 17, TOP + .9, -11, 1.3, '🌟 SECRET: you found the MALL ROOF ARCADE TOKEN! Only real climbers get up here 🛍️');
  const tok = B.mesh(new THREE.CylinderGeometry(.35, .35, .08, 20), mat(0xffc54a, { metalness: .8, roughness: .25 }), 17, TOP + 1, -11); tok.rotation.x = Math.PI / 2; HSB.token = tok;
  mergeStatic(B.g, o => o === tok);
}

/* ---------------- 🏨 FROSTFANG LODGE (snow) ---------------- */
{
  const B = hsMk(CABIN), HX = 12, HZ = 7, F1 = 3.6, TOP = 7.2, T = .4;
  const logM = mat(0x8a5a32), logD = mat(0x6e4524), stoneM = mat(0x8f8a84), roofM = mat(0x5b3a2a), snowM = mat(0xf4f8ff), woodF = mat(0xa8774a), red = mat(0xb8323a), cream = mat(0xf0e4cc);
  B.rng(-HX, HX, -.3, .08, -HZ, HZ, woodF);
  B.slab(-HX, HX, -HZ, HZ, F1, .3, woodF, [[-6.1, .6, -6.8, -5.0]]);
  B.rng(-HX - .2, HX + .2, TOP - .3, TOP, -HZ - .2, HZ + .2, woodF);
  // log walls with a door, windows on both floors and a fireplace hole at each end
  B.wall(-HX - .2, HZ, HX + .2, HZ, 0, TOP, T, logM, [[11.2, 13.2, 2.6], [3, 5, 2.2, .9], [19.4, 21.4, 2.2, .9], [3, 5, F1 + 2.2, F1 + .9], [8, 10, F1 + 2.2, F1 + .9], [14.4, 16.4, F1 + 2.2, F1 + .9], [19.4, 21.4, F1 + 2.2, F1 + .9]]);
  B.wall(-HX - .2, -HZ, HX + .2, -HZ, 0, TOP, T, logM, [[16, 18, 2.2, .9], [3, 5, F1 + 2.2, F1 + .9], [19.4, 21.4, F1 + 2.2, F1 + .9]]);
  for (const sx of [-1, 1]) B.wall(sx * HX, -HZ, sx * HX, HZ, 0, TOP, T, logM, [[6.5, 7.5, 1.4], [2, 4, F1 + 2.2, F1 + .9], [10, 12, F1 + 2.2, F1 + .9]]);
  for (let y = .2; y < TOP; y += .4) for (const sz of [-1, 1]) B.cyl(0, y, sz * (HZ + .22), .2, 2 * HX + .8, logD, false, { seg: 6 }).rotation.z = Math.PI / 2;
  // hollow stone chimneys outside each end: crawl in through the fireplace, climb up inside
  for (const sx of [-1, 1]) {
    const xi = sx * (HX + .4), xo = sx * (HX + 1.8), CH = 11.8;
    B.wall(xi, -.9, xi, .9, 0, CH, .4, stoneM, [[.4, 1.4, 1.4]]);
    B.wall(xo, -.9, xo, .9, 0, CH, .4, stoneM);
    for (const sz of [-1, 1]) B.rng(Math.min(xi, xo) - .2, Math.max(xi, xo) + .2, 0, CH, sz > 0 ? .5 : -.9, sz > 0 ? .9 : -.5, stoneM);
    for (const y of [4.6, 8.6]) B.rng(Math.min(sx * (HX + 1.1), xo), Math.max(sx * (HX + 1.1), xo), y - .15, y, -.5, .5, mat(0x3a3a3a));   // ledges to sit on
    B.rng(Math.min(xi, xo) - .3, Math.max(xi, xo) + .3, CH, CH + .2, -1, -.5, mat(0x5e5a55)); B.rng(Math.min(xi, xo) - .3, Math.max(xi, xo) + .3, CH, CH + .2, .5, 1, mat(0x5e5a55));
    B.box(sx * (HX - .5), .06, 0, 1, .06, 1.8, mat(0x2a2a2a), false);   // hearth
    for (let l = 0; l < 3; l++) B.cyl(sx * (HX - .6), .15 + l * .2, 1.4, .1, .9, logD, false, { seg: 6 }).rotation.x = Math.PI / 2;   // firewood (the fire is out: crawl in!)
    B.spot(sx * (HX + 1.1), 4.6, 0); B.spot(sx * (HX + 1.1), 8.6, 0);
  }
  B.secret('chimney', HX + 1.1, 11.4, 0, .9, '🎅 SECRET: you climbed ALL the way up the chimney! Ho ho HIDE!');
  // pitched roof (you can climb on it) with snow on top
  for (const sz of [-1, 1]) { B.ramp(0, TOP - .25, sz * (HZ + .9), 0, TOP + 3.5, 0, 2 * HX + .6, roofM, { plain: true, th: .35, tag: 'wood' }); B.ramp(0, TOP - .03, sz * (HZ + .9), 0, TOP + 3.72, 0, 2 * HX + .6, snowM, { plain: true, th: .1, tag: 'grass' }); }
  for (const sx of [-1, 1]) { const sh = new THREE.Shape(); sh.moveTo(-HZ - .2, 0); sh.lineTo(HZ + .2, 0); sh.lineTo(0, 3.5); sh.closePath(); const m = B.mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0x8a5a32, side: THREE.DoubleSide, roughness: .9 }), sx * HX, TOP - .3, 0, Math.PI / 2); }
  // stairs to the 2nd floor + railing
  B.ramp(-6, 0, -5.9, .6, F1, -5.9, 1.4, woodF, { tag: 'wood' });
  B.wall(-6.1, -5, .6, -5, F1, 1, .1, logD); B.wall(-6.1, -6.8, -6.1, -5, F1, 1, .1, logD);
  // ground floor: reception, couches, rug, piano, kitchen with a walk-in fridge
  B.rng(-2.5, 2.5, 0, 1.1, 2.2, 3, logD); hsSign(B, 13, 0, 2.6, 6.75, Math.PI, 3.6); hsSign(B, 13, 0, 3.0, HZ + .45, 0, 4);
  B.box(-7, .3, 3, 3, .6, 1, red); B.box(-7, .75, 3.45, 3, .9, .2, red); B.box(-7, .03, 1.4, 4, .04, 3, mat(0x7a2a3a), false);
  B.box(7.5, .5, 4.6, 2.2, 1, 1, mat(0x1d1d22)); B.box(7.5, 1.2, 5.05, 2.2, .5, .12, mat(0x1d1d22)); B.box(7.5, 1.02, 4.4, 2, .04, .3, cream, false);
  B.rng(5, 11.6, 0, 1, -6.8, -6, mat(0xd8d2c6)); B.rng(10.4, 11.7, 0, 2.4, -2.5, -.8, mat(0xe9eef2));
  B.rng(9.4, 11.7, 0, 2.4, -4.9, -4.8, mat(0xdfe6ea)); B.rng(9.4, 9.5, 0, 2.4, -6.8, -4.9, mat(0xdfe6ea));   // walk-in fridge (open side)
  B.spot(10.5, 0, -6); B.spot(-1.5, 0, 3.6);
  // 2nd floor: 4 guest rooms with bunk beds + wardrobes
  B.wall(-HX, -1, HX, -1, F1, TOP - .3 - F1, .2, logM, [[2.4, 3.6, 2.3], [8.4, 9.6, 2.3], [14.4, 15.6, 2.3], [20.4, 21.6, 2.3]]);
  for (const x of [-6, 0, 6]) B.rng(x - .1, x + .1, F1, TOP - .3, -1, HZ, logM);
  for (const rx of [-9, -3, 3, 9]) {
    const bed = (y) => { B.rng(rx - 2.6, rx - .2, F1 + y, F1 + y + .25, 4.8, 6.8, cream); B.box(rx - 1.4, F1 + y + .27, 5.8, 2.3, .06, 1.9, red, false); };
    bed(.3); bed(1.6); [[-2.6, 4.8], [-2.6, 6.8], [-.2, 4.8], [-.2, 6.8]].forEach(([dx, dz]) => B.rng(rx + dx - .05, rx + dx + .05, F1, F1 + 2.2, dz - .05, dz + .05, logD));
    B.rng(rx + 1, rx + 2.7, F1, F1 + 2.3, 6.6, 6.8, logD); B.rng(rx + 1, rx + 1.1, F1, F1 + 2.3, 5.6, 6.6, logD); B.rng(rx + 2.6, rx + 2.7, F1, F1 + 2.3, 5.6, 6.6, logD); B.rng(rx + 1, rx + 2.7, F1 + 2.2, F1 + 2.3, 5.6, 6.8, logD);
    B.box(rx + 1.3, F1 + 1.1, 5.4, .6, 2.1, .05, logM, false).rotation.y = -.9;   // wardrobe door, half open
    B.spot(rx + 1.85, F1, 6.1); B.spot(rx - 1.4, F1 + .55, 5.8);
  }
  // porch + snowman
  B.rng(-4, 4, 0, .3, HZ, HZ + 3, woodF); for (const sx of [-3.6, 3.6]) B.cyl(sx, 1.5, HZ + 2.7, .12, 3, logD);
  B.rng(-4.2, 4.2, 3, 3.2, HZ, HZ + 3.2, roofM);
  [[.7, 0], [.5, 1.05], [.35, 1.8]].forEach(([r, y]) => B.mesh(new THREE.SphereGeometry(r, 12, 10), snowM, 6.5, y + r * .8, HZ + 3.5));
  B.mesh(new THREE.ConeGeometry(.07, .35, 8).rotateX(Math.PI / 2), mat(0xff8a2a), 6.5, 2.1, HZ + 3.85);
  mergeStatic(B.g);
}

/* ---------------- 🏺 SUN TOMB (desert): a 3-story step pyramid ---------------- */
{
  const B = hsMk(TOMB), sand = mat(0xd9b77a), sand2 = mat(0xc49a5e), dark = mat(0x8a6a44), gold = mat(0xffc54a, { metalness: .6, roughness: .3 }), blue = mat(0x2f6fb0), T = .8;
  const tiers = [[17.5, 0], [12.5, 6], [8, 12]];
  B.rng(-17.5, 17.5, -.3, .08, -17.5, 17.5, dark);
  tiers.forEach(([h, y0], i) => {
    const doors = i === 0 ? [[16, 19, 3.8]] : i === 1 ? [[11, 14, 2.6]] : [[6.5, 9.5, 2.6]];
    B.wall(-h, h, h, h, y0, 6, T, i % 2 ? sand2 : sand, doors);
    B.wall(-h, -h, h, -h, y0, 6, T, i % 2 ? sand2 : sand, i === 0 ? [[16.9, 18.1, 1.3]] : []);   // a crawl tunnel out the back
    B.wall(-h, -h, -h, h, y0, 6, T, i % 2 ? sand2 : sand); B.wall(h, -h, h, h, y0, 6, T, i % 2 ? sand2 : sand);
    B.slab(-h - .4, h + .4, -h - .4, h + .4, y0 + 6.4, .5, sand2, i === 0 ? [[-6.4, 4.1, -11, -9]] : i === 1 ? [[-6.4, 4.1, -5.5, -3.5]] : [], 'rock');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(sx * (h - .2), y0 + 6.6, sz * (h - .2), .9, .4, .9, gold, false);
  });
  // gold cap
  B.mesh(new THREE.ConeGeometry(5.5, 4, 4), gold, 0, 20.4, 0, Math.PI / 4); B.box(0, 19.2, 0, 7, .8, 7, gold, true); B.box(0, 20.4, 0, 4, 1.6, 4, gold, true).visible = false;
  // ramps inside (and one outside up to the first terrace)
  B.ramp(-6.4, 0, -10, 4.1, 6.4, -10, 1.8, sand2); B.ramp(-6.4, 6.4, -4.5, 4.1, 12.4, -4.5, 1.8, sand2); B.ramp(28.4, 0, 10, 17.9, 6.4, 10, 2.2, sand2);
  B.wall(-6.4, -11, 4.1, -11, 6.4, 1, .2, dark); B.wall(-6.4, -9, 4.1, -9, 6.4, 1, .2, dark); B.wall(-6.4, -5.5, 4.1, -5.5, 12.4, 1, .2, dark); B.wall(-6.4, -3.5, 4.1, -3.5, 12.4, 1, .2, dark);
  // 1st floor: great hall with pillars, treasure room (west), sarcophagus room (east)
  for (const sx of [-1, 1]) B.wall(sx * 9, -16.7, sx * 9, 16.7, 0, 6, .6, sand, [[15.1, 18.3, 3]]);
  for (const x of [-5.5, 5.5]) for (const z of [-3, 4, 11]) { B.cyl(x, 3, z, .7, 6, sand2, true, { seg: 10 }); B.cyl(x, 5.7, z, .95, .5, gold, false, { seg: 10 }); }
  for (let c = 0; c < 6; c++) { const x = -15 + (c % 2) * 3, z = -12 + c * 4.4; B.box(x, .45, z, 1.4, .9, .9, mat(0x7a4a22)); B.box(x, .95, z, 1.5, .12, 1, gold, false); }
  for (let p = 0; p < 9; p++) B.mesh(new THREE.SphereGeometry(.5 + (p % 3) * .25, 10, 8), gold, -12.5 + (p % 3) * 1.3, .1, -2 + Math.floor(p / 3) * 1.6).scale.y = .45;
  for (let j = 0; j < 10; j++) { const x = -16 + (j % 2) * 1.1, z = 3 + j * 1.3; B.cyl(x, .45, z, .32, .9, j % 3 ? sand2 : blue, true, { rt: .2, seg: 10 }); }
  for (const z of [-10, -3, 4, 11]) { B.rng(12, 15, 0, 1.1, z - .7, z + .7, blue); B.rng(11.9, 15.1, 1.1, 1.25, z - .8, z + .8, gold); B.spot(13.5, 0, z + 1.4); }
  for (const z of [-14, 14]) { B.rng(15.6, 16.6, 0, 2.6, z - .6, z + .6, gold); B.spot(14.8, 0, z); }
  B.spot(-12.5, 0, -6); B.spot(-15, 0, 15); B.spot(0, 0, 15.5);
  // torches
  const flame = new THREE.MeshBasicMaterial({ color: 0xff9a2a });
  for (const [x, z] of [[-8.5, 0], [8.5, 0], [0, -16.6], [-3, 16.6], [3, 16.6]]) { B.cyl(x, 2.2, z, .06, .8, dark, false); B.mesh(new THREE.ConeGeometry(.14, .4, 6), flame, x, 2.75, z).castShadow = false; }
  // hieroglyph strips on the walls
  const glyph = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#c49a5e'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#5a3a1a'; g.font = '64px serif'; const s = '𓀀𓁐𓂀𓃒𓅓𓆣𓇳𓉐𓊝𓋹𓌳𓍝𓎛𓏏'; for (let i = 0; i < 12; i++) g.fillText([...s][i % 14], 8 + i * 42, 90); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: .9 }); })();
  for (const sz of [-1, 1]) B.mesh(new THREE.PlaneGeometry(16, 1), glyph, 0, 4, sz * 16.65, sz > 0 ? Math.PI : 0).castShadow = false;
  for (const sx of [-1, 1]) B.mesh(new THREE.PlaneGeometry(14, 1), glyph, sx * 11.65, 10, 0, -sx * Math.PI / 2).castShadow = false;
  // 2nd floor: a little maze + a secret room behind a fake wall (south-west corner)
  B.wall(-11.7, 2, -2, 2, 6.4, 5.6, .5, sand); B.wall(2, 2, 11.7, 2, 6.4, 5.6, .5, sand); B.wall(6, 2, 6, 9, 6.4, 5.6, .5, sand); B.wall(-6, -1, -6, 2, 6.4, 5.6, .5, sand);
  B.wall(-7.5, 7.5, -7.5, 11.7, 6.4, 5.6, .5, sand); B.wall(-11.7, 7.5, -7.5, 7.5, 6.4, 5.6, .5, sand, [[1.4, 2.8, 2.2]]);
  B.box(-9.6, 6.4 + 1.1, 7.5, 1.4, 2.2, .5, sand, false);   // looks solid... it isn't 👀
  B.mesh(new THREE.OctahedronGeometry(.28, 0), mat(0x3fe0bd, { emissive: 0x3fe0bd, emissiveIntensity: .8 }), -9.6, 7.4, 9.6);
  B.secret('tomb', -9.6, 7.2, 9.6, 1.2, '🪲 SECRET: a fake wall in the Sun Tomb! You found the glowing scarab room!');
  for (const [x, z] of [[-9, -9], [9, -9], [9, 9], [0, 6]]) { B.rng(x - .6, x + .6, 6.4, 8.6, z - .4, z + .4, sand2); B.box(x, 7.6, z + .42, .9, 1.8, .04, blue, false); B.spot(x, 6.4, z + 1.1); }
  B.spot(-9.6, 6.4, 9.8);
  // 3rd floor: the golden sarcophagus
  B.rng(-1.2, 1.2, 12.4, 13.4, -2.6, 2.6, gold); B.rng(-1.3, 1.3, 13.4, 13.6, -2.7, 2.7, blue);
  B.spot(0, 12.4, 4); B.spot(-6, 12.4, 6);
  // outside: cat statues + obelisks by the door
  for (const sx of [-1, 1]) {
    B.rng(sx * 3.2 - .6, sx * 3.2 + .6, 0, 1.2, 18.6, 20.4, sand2); B.mesh(new THREE.SphereGeometry(.6, 10, 8), sand, sx * 3.2, 1.8, 19.5); B.mesh(new THREE.ConeGeometry(.2, .45, 4), sand, sx * 3.2 - .25, 2.4, 19.5); B.mesh(new THREE.ConeGeometry(.2, .45, 4), sand, sx * 3.2 + .25, 2.4, 19.5);
    B.box(sx * 7, 3.5, 21, 1, 7, 1, sand2); B.mesh(new THREE.ConeGeometry(.72, 1, 4), gold, sx * 7, 7.5, 21, Math.PI / 4);
  }
  hsSign(B, 14, 0, 4.6, 17.95, 0, 5);
  mergeStatic(B.g);
}
