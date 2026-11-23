/* ======================= 🎢 VIVI'S BIRTHDAY COASTER =======================
   At the back of the party island (party-local z -12..-20) there's a coaster station, locked until you
   CUT THE CAKE. Then the track builds itself out into the sky: a lift hill, a big drop, a camel hill, a
   LOOP-DE-LOOP, a swoopy turn and a kicker ramp. At the end you fly off the track, fireworks go off,
   "HAPPY BIRTHDAY VIVI!" pops up in the sky and a bunch of balloons floats you down to the landing pad.
   Comfort (Quest): smooth capped speeds, a soft vignette, and a COMFY button that keeps the horizon level.
   Rides with: RIDE button (VR poke / PC aim + E) or the 🎢 button on PC + phone. Test hook __kg.coaster. */
var RC = { open: false, ride: false, phase: '', s: 0, v: 0, t: 0, build: 1, building: false, cakeN: 1e9, comfy: store.get('kg-coaster-comfy') === '1',
  rides: 0, eye0: V(), clickT: 0, vig: 0, fly: null, cartFly: null, gold: false, wasIn: false, told: {} };
function rcRiding() { return RC.ride; }
const rcG = new THREE.Group(); partyG.add(rcG);
const CO = { S: [], T: [], U: [], R: [], NS: 0, L: 0, DS: .25, sStart: 0, sLift0: 0, sCrest: 0, sDrop: 0, LIFT: 5, CRUISE: 6, sLoop0: 0, sLoop1: 0, E0: 0, fric: 0, GE: 8 };

/* ---------- the track's shape (party-local) ---------- */
{
  const P = [[0, .35, -12.6], [0, .35, -15.5], [0, .35, -19], [0, .7, -22.5],
    [0, 3, -26], [0, 11, -34], [0, 21, -44], [0, 31, -54], [0, 38.5, -62], [-1.5, 40.5, -67],   // the long lift UP INTO THE CLOUDS
    [-6, 40.5, -72], [-13, 39.8, -76], [-20, 40.3, -82], [-22, 40, -90], [-17, 39.5, -97], [-8, 40, -100.5], [0, 39.6, -100.5],   // cruising through the clouds
    [7, 35, -100], [14, 22, -98.5], [20, 8, -95], [24, 0, -90], [26, -2.5, -84],   // the BIG drop out of the sky
    [29, 4.5, -77], [33, 5.5, -71], [36, 1, -66], [37.5, -1.6, -61.5], [39.7, -2.05, -55.5]];   // camel hill, line up for the loop
  const loop0 = P.length, cz = -48.5, cy = 4.8, R0 = 6.8;
  for (let k = 0; k <= 12; k++) { const f = k / 12 * Math.PI * 2, R = R0 * (1 - .22 * Math.sin(f / 2) ** 2); P.push([40 + 3 * k / 12, cy - R * Math.cos(f), cz + R * Math.sin(f)]); }
  const loop1 = P.length - 1;
  P.push([43.2, -2, -41], [44, .5, -31], [41, 3.5, -21], [35, 5, -12], [29, 2.6, -3.5], [24.5, 2.4, 2.4], [20.5, 4.3, 5.2], [16.8, 7.6, 5.8]);
  const pts = P.map(p => V(...p)), curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  CO.L = curve.getLength(); const NS = CO.NS = Math.ceil(CO.L / CO.DS) + 1; CO.DS = CO.L / (NS - 1);
  const up = V(0, 1, 0), Y = V(0, 1, 0), tmp = V();
  for (let i = 0; i < NS; i++) {
    const u = i / (NS - 1), p = curve.getPointAt(u), T = curve.getTangentAt(u).normalize();
    up.addScaledVector(T, -up.dot(T)).normalize();
    if (Math.abs(T.y) < .5 && up.y > .85) { tmp.copy(Y).addScaledVector(T, -T.y).normalize(); up.lerp(tmp, .25).normalize(); }   // stay level outside the loop
    CO.S.push(p); CO.T.push(T); CO.U.push(up.clone()); CO.R.push(V().crossVectors(T, up).normalize());
  }
  // gentle banking in the turns (not in the loop)
  const k = [];
  for (let i = 0; i < NS; i++) { const a = CO.T[Math.max(0, i - 1)], b = CO.T[Math.min(NS - 1, i + 1)]; k.push(tmp.subVectors(b, a).dot(CO.R[i]) / (2 * CO.DS)); }
  for (let i = 0; i < NS; i++) {
    let s = 0, n = 0; for (let j = -16; j <= 16; j++) { const q = i + j; if (q >= 0 && q < NS) { s += k[q]; n++; } }
    const r = clamp(s / n * 3.2, -.42, .42) * clamp((CO.U[i].y - .7) / .25, 0, 1), U = CO.U[i], Rr = CO.R[i];
    const nu = V().copy(U).multiplyScalar(Math.cos(r)).addScaledVector(Rr, Math.sin(r)); Rr.crossVectors(CO.T[i], nu).normalize(); U.copy(nu);
  }
  const near = v => { let bi = 0, bd = 1e9; CO.S.forEach((p, i) => { const d = p.distanceToSquared(v); if (d < bd) { bd = d; bi = i; } }); return bi * CO.DS; };
  CO.sStart = near(pts[1]); CO.sLift0 = near(pts[3]);
  CO.sCrest = near(pts[9]); CO.sDrop = near(pts[16]); const ci = Math.round(CO.sDrop / CO.DS);
  CO.sLoop0 = near(pts[loop0]) - 6; CO.sLoop1 = near(pts[loop1]) + 6;
  CO.E0 = .5 * CO.CRUISE * CO.CRUISE + CO.GE * CO.S[ci].y;
  const end = CO.S[NS - 1]; CO.fric = (CO.E0 - (.5 * 11 * 11 + CO.GE * end.y)) / (CO.L - CO.sDrop);
}
function coAt(s, p, T, U, Rr) {   // position + frame at distance s along the track
  const f = clamp(s / CO.DS, 0, CO.NS - 1.001), i = Math.floor(f), a = f - i;
  p.lerpVectors(CO.S[i], CO.S[i + 1], a); T.lerpVectors(CO.T[i], CO.T[i + 1], a).normalize(); U.lerpVectors(CO.U[i], CO.U[i + 1], a).normalize(); Rr.crossVectors(T, U).normalize();
}

/* ---------- track meshes (they grow out of the station when the coaster appears) ---------- */
function coTube(off, side, up, r, rad, colFn) {
  const NS = CO.NS, pos = new Float32Array(NS * rad * 3), nor = new Float32Array(NS * rad * 3), col = colFn ? new Float32Array(NS * rad * 3) : null, idx = [], c = V(), n = V(), cc = new THREE.Color();
  for (let i = 0; i < NS; i++) {
    c.copy(CO.S[i]).addScaledVector(CO.R[i], side).addScaledVector(CO.U[i], up); if (colFn) colFn(i / NS, cc);
    for (let j = 0; j < rad; j++) {
      const a = j / rad * Math.PI * 2; n.copy(CO.R[i]).multiplyScalar(Math.cos(a)).addScaledVector(CO.U[i], Math.sin(a));
      const o = (i * rad + j) * 3; pos[o] = c.x + n.x * r; pos[o + 1] = c.y + n.y * r; pos[o + 2] = c.z + n.z * r; nor[o] = n.x; nor[o + 1] = n.y; nor[o + 2] = n.z;
      if (col) { col[o] = cc.r; col[o + 1] = cc.g; col[o + 2] = cc.b; }
    }
  }
  for (let i = 0; i < NS - 1; i++) for (let j = 0; j < rad; j++) { const a = i * rad + j, b = i * rad + (j + 1) % rad, d = a + rad, e = b + rad; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  g.userData.per = rad * 6; return g;
}
const CT = { tubes: [], ties: null, nTies: 0, bal: null, str: null, nBal: 0, balS: [], tieS: [] };
{
  const railM = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .7, roughness: .22, envMap: ENV, envMapIntensity: 1 });
  const spineM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .1, envMap: ENV, envMapIntensity: .6, emissive: 0x221133 });
  [-.42, .42].forEach(sd => CT.tubes.push(new THREE.Mesh(coTube(0, sd, 0, .045, 8), railM)));
  CT.tubes.push(new THREE.Mesh(coTube(0, 0, -.24, .12, 10, (u, c) => c.setHSL((u * 3) % 1, .85, .6)), spineM));
  CT.tubes.forEach(m => { m.frustumCulled = false; rcG.add(m); });
  // ties every 0.9 m
  const tieG = new THREE.BoxGeometry(1.0, .06, .14), tieM = smat(0xffffff, { roughness: .5 }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(1, 1, 1), p = V(), T = V(), U = V(), Rr = V(), Z = V();
  CT.nTies = Math.floor(CO.L / .9); CT.ties = new THREE.InstancedMesh(tieG, tieM, CT.nTies); CT.ties.frustumCulled = false;
  const cc = new THREE.Color();
  for (let i = 0; i < CT.nTies; i++) {
    const s = i * .9 + .3; coAt(s, p, T, U, Rr); CT.tieS.push(s);
    m4.makeBasis(Rr, U, Z.copy(T).negate()); q.setFromRotationMatrix(m4); p.addScaledVector(U, -.1);
    CT.ties.setMatrixAt(i, m4.compose(p, q, sc)); CT.ties.setColorAt(i, cc.setHex(i % 2 ? 0xffd25a : 0xff4fa8));
  }
  rcG.add(CT.ties);
  // balloon bunches hold the track up in the sky (where it's the right way up)
  const BAL = [], STR = [];
  for (let s = 26; s < CO.L - 4; s += 9) { coAt(s, p, T, U, Rr); if (U.y < .93 || (s > CO.sLoop0 - 4 && s < CO.sLoop1 + 4)) continue; const sd = (BAL.length % 2 ? 1 : -1) * .55; BAL.push({ s, p: p.clone().addScaledVector(Rr, sd), up: 2.2 + (BAL.length % 3) * .5 }); }
  CT.nBal = BAL.length;
  CT.bal = new THREE.InstancedMesh(new THREE.SphereGeometry(.42, 18, 12), new THREE.MeshStandardMaterial({ roughness: .22, metalness: .05, envMap: ENV, envMapIntensity: .7 }), BAL.length * 3);
  CT.str = new THREE.InstancedMesh(new THREE.CylinderGeometry(.008, .008, 1, 4), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), BAL.length * 3);
  CT.bal.frustumCulled = CT.str.frustumCulled = false; CT.balList = BAL;
  BAL.forEach((b, i) => { for (let k = 0; k < 3; k++) { CT.bal.setColorAt(i * 3 + k, cc.setHex(PARTY_COLS[(i * 3 + k) % 7])); CT.balS.push(b.s); } });
  rcG.add(CT.bal, CT.str);
  // fluffy clouds round the top (some right ON the track, so you ride through them)
  const cl = [], cp = V(), cT = V(), cU = V(), cR = V();
  for (let s = CO.sCrest - 14; s < CO.sDrop + 6; s += 3.2) {
    coAt(s, cp, cT, cU, cR); const k = cl.length, on = k % 5 === 2, sd = on ? 0 : (k % 2 ? 1 : -1) * (3.5 + (k * 7 % 5));
    const c = V().copy(cp).addScaledVector(cR, sd).add(V(0, on ? .4 : -1 + (k * 3 % 4), 0));
    const n = on ? 7 : 5; for (let j = 0; j < n; j++) { const a = j / n * 6.28 + k; cl.push({ s, p: V(c.x + Math.cos(a) * (on ? 1.8 : 2.4), c.y + Math.sin(j * 2.3) * .7, c.z + Math.sin(a) * (on ? 1.8 : 2.4)), r: (on ? 1.9 : 1.6) + (j * 13 % 7) * .18 }); }
    cl.push({ s, p: c.clone().add(V(0, .9, 0)), r: on ? 2.4 : 2.1 });
  }
  CT.cloud = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde6ff, emissiveIntensity: .35, roughness: 1, transparent: true, opacity: .93, side: THREE.DoubleSide, depthWrite: false }), cl.length);
  const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), cs = V();
  cl.forEach((c, i) => { CT.cloud.setMatrixAt(i, cm.compose(c.p, cq, cs.set(c.r, c.r * .72, c.r))); });
  // a SEA OF CLOUDS under the top: from up there you can't see the ground at all, and the drop punches through it
  const seaT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#f4f7ff'; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const x = Math.random() * w, y = Math.random() * h, r = 14 + Math.random() * 46, g = c.createRadialGradient(x, y, 0, x, y, r); const v = Math.random() < .5 ? '255,255,255' : '214,224,245'; g.addColorStop(0, `rgba(${v},.8)`); g.addColorStop(1, `rgba(${v},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); } }, [10, 10]);
  CT.sea = new THREE.Group(); CT.sea.position.set(-2, 33.5, -78); CT.sea.visible = false; rcG.add(CT.sea);
  [[0, 1], [-1.2, .8], [-2.6, .6]].forEach(([y, o], i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshStandardMaterial({ map: seaT, color: 0xffffff, emissive: 0xe6ecff, emissiveIntensity: .45, roughness: 1, transparent: i > 0, opacity: o, side: THREE.DoubleSide, depthWrite: i === 0, fog: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 1; CT.sea.add(m); });
  CT.cloudS = cl.map(c => c.s); CT.cloud.frustumCulled = false; CT.cloud.renderOrder = 2; rcG.add(CT.cloud);
  // a balloon arch where the track leaves the island, and one over the kicker ramp
  CT.arches = [];
  [[V(0, 0, -21), 0], [CO.S[CO.NS - 1].clone(), 1]].forEach(([c, kick], ai) => {
    const g = new THREE.Group(); g.position.copy(c); rcG.add(g); CT.arches.push(g);
    if (kick) { const T0 = CO.T[CO.NS - 1]; g.rotation.y = Math.atan2(T0.x, T0.z); g.position.y -= .4; }
    for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI, b = new THREE.Mesh(BAL_G, balMats[(i + ai) % balMats.length]); b.scale.setScalar(1.6); b.position.set(Math.cos(a) * 1.9, Math.sin(a) * 2.6 + .2, 0); g.add(b); }
  });
}
function coReveal(f) {   // f 0..1: how much of the track exists
  const sMax = f * CO.L, iMax = Math.floor(sMax / CO.DS);
  CT.tubes.forEach(m => m.geometry.setDrawRange(0, Math.max(0, iMax) * m.geometry.userData.per));
  let n = 0; while (n < CT.nTies && CT.tieS[n] < sMax) n++; CT.ties.count = n;
  let b = 0; while (b < CT.balS.length && CT.balS[b] < sMax) b++; CT.bal.count = CT.str.count = b;
  let c = 0; while (c < CT.cloudS.length && CT.cloudS[c] < sMax + 8) c++; CT.cloud.count = c;
  CT.arches[0].visible = f > .03; CT.arches[1].visible = f > .99;
}
function coBalloons() {   // bob the track balloons
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = V(), sc = V();
  CT.balList.forEach((b, i) => {
    for (let k = 0; k < 3; k++) {
      const j = i * 3 + k; if (j >= CT.bal.count) return;
      const a = k * 2.1 + i, w = Math.sin(tAll * 1.3 + a) * .12;
      p.set(b.p.x + Math.cos(a) * .35 + w, b.p.y + b.up + (k === 1 ? .35 : 0) + Math.sin(tAll * 1.7 + a) * .08, b.p.z + Math.sin(a) * .35);
      CT.bal.setMatrixAt(j, m4.compose(p, q.identity(), sc.set(1, 1.18, 1)));
      const top = V(p.x, p.y - .45, p.z), mid = V().lerpVectors(b.p, top, .5), L = top.distanceTo(b.p);
      q.setFromUnitVectors(V(0, 1, 0), V().subVectors(top, b.p).normalize());
      CT.str.setMatrixAt(j, m4.compose(mid, q, sc.set(1, L, 1)));
    }
  });
  CT.bal.instanceMatrix.needsUpdate = CT.str.instanceMatrix.needsUpdate = true;
}

/* ---------- the station ---------- */
const ST = {};
{
  const g = new THREE.Group(); rcG.add(g); ST.g = g;
  const stripeT = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff4fa8'; for (let y = -64; y < h; y += 48) { c.save(); c.translate(0, y); c.transform(1, .6, 0, 1, 0, 0); c.fillRect(0, 0, w, 20); c.restore(); } });
  const poleM = new THREE.MeshStandardMaterial({ map: stripeT, roughness: .4 });
  [[-1.55, -12.8], [1.55, -12.8], [-1.55, -19.4], [1.55, -19.4]].forEach(([x, z]) => { part(new THREE.CylinderGeometry(.07, .08, 3, 12), poleM, x, 1.5, z, g); addCol({ t: 1, x: PW.x + x, z: PW.z + z, cy: 1.5, hy: 1.5, r: .09, tag: 'wood' }); });
  // striped canopy roof with a scalloped edge
  const canT = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff4fa8'; c.fillRect(i * 32, 0, 32, h); } });
  const roof = part(new THREE.BoxGeometry(3.6, .12, 7.2), new THREE.MeshStandardMaterial({ map: canT, roughness: .6 }), 0, 3.05, -16.1, g); roof.rotation.z = 0;
  for (let i = 0; i < 18; i++) { const sc = part(new THREE.CylinderGeometry(.2, .2, .04, 14, 1, false, 0, Math.PI), smat(i % 2 ? 0xffd25a : 0xff4fa8), 0, 0, 0, g); sc.rotation.set(Math.PI / 2, 0, Math.PI / 2); sc.position.set(1.8, 2.99, -12.7 - i * .4); const s2 = sc.clone(); s2.position.x = -1.8; g.add(s2); }
  // station floor decal
  const flT = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#8b6bff'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd25a'; for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 6); c.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 4, 4); });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 7), new THREE.MeshStandardMaterial({ map: flT, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, .011, -16.1); g.add(fl);
  bunting(g, V(-1.55, 2.85, -12.8), V(1.55, 2.85, -12.8), .35, 12);
  // the big sign on the roof (it changes when the coaster opens)
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 320; ST.sCtx = sc.getContext('2d'); ST.sTex = new THREE.CanvasTexture(sc); ST.sTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), new THREE.MeshBasicMaterial({ map: ST.sTex, transparent: true })); sign.position.set(0, 3.75, -12.72); g.add(sign); ST.sign = sign;
  const sb = part(new THREE.BoxGeometry(3.48, 1.14, .05), smat(0xffffff), 0, 3.75, -12.76, g); sb.castShadow = false;
  // velvet rope across the boarding side + a little lock sign (gone once the cake is cut)
  const rope = new THREE.Group(); g.add(rope); ST.rope = rope; const gold = new THREE.MeshStandardMaterial({ color: 0xffd25a, metalness: 1, roughness: .25, envMap: ENV });
  [-13.6, -17.4].forEach(z => { part(new THREE.CylinderGeometry(.03, .045, .85, 10), gold, 1.3, .425, z, rope); part(new THREE.SphereGeometry(.06, 12, 8), gold, 1.3, .88, z, rope); });
  const rc = new THREE.QuadraticBezierCurve3(V(1.3, .82, -13.6), V(1.3, .5, -15.5), V(1.3, .82, -17.4));
  rope.add(new THREE.Mesh(new THREE.TubeGeometry(rc, 20, .025, 6), smat(0xc0133f, { roughness: .8 })));
  signBoard(rope, 1.33, .62, -15.5, Math.PI / 2, .9, .34, [['🔒 CUT THE CAKE', 120, '#ff4fa8', 190], ['TO OPEN! 🎂', 120, '#ffd25a', 330]], 'rgba(43,26,74,.95)', '#ff4fa8', false);
  // a big floating arrow so you can find it from the cake room
  const arr = new THREE.Group(); arr.position.set(0, 5.4, -14.5); g.add(arr); ST.arrow = arr;
  const am = new THREE.MeshStandardMaterial({ color: 0xff4fa8, emissive: 0xff4fa8, emissiveIntensity: .45, roughness: .3 });
  part(new THREE.CylinderGeometry(.16, .16, .8, 16), am, 0, .45, 0, arr); const cone = part(new THREE.ConeGeometry(.38, .55, 20), am, 0, -.15, 0, arr); cone.rotation.x = Math.PI;
  balloon(g, -1.55, 3.1, -12.8, 0, .9, 1.3); balloon(g, 1.55, 3.1, -12.8, 3, 1.1, 1.3); balloon(g, -1.55, 3.1, -19.4, 5, 1, 1.3); balloon(g, 1.55, 3.1, -19.4, 2, .8, 1.3);
}
function coSign() {
  const c = ST.sCtx, w = 1024, h = 320; c.clearRect(0, 0, w, h);
  signText(c, w, h, RC.open ? [["🎢 VIVI'S BIRTHDAY COASTER", 92, '#ffd25a', 120], [RC.ride ? 'HOLD ON TIGHT!' : 'PRESS RIDE! 👉', 78, '#ffffff', 235]] : [["🎢 VIVI'S BIRTHDAY COASTER", 92, '#ffd25a', 120], ['🔒 CUT THE CAKE TO OPEN!', 70, '#ff9ec7', 235]], 'rgba(43,26,74,.95)', '#ff4fa8');
  ST.sTex.needsUpdate = true;
}
coSign(); labelFns.push(coSign);

/* ---------- the cart (with a teddy bear in the back seat) ---------- */
function makeCart() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const pink = new THREE.MeshStandardMaterial({ color: 0xff5fb0, roughness: .25, metalness: .15, envMap: ENV, envMapIntensity: .9 }), white = smat(0xffffff, { roughness: .4 }),
    gold = new THREE.MeshStandardMaterial({ color: 0xffd25a, metalness: 1, roughness: .22, envMap: ENV }), dark = smat(0x2b2140, { roughness: .6 });
  const sh = new THREE.Shape(); sh.moveTo(-1, .14); sh.lineTo(.8, .14); sh.quadraticCurveTo(1.12, .16, 1.08, .42); sh.quadraticCurveTo(1.03, .66, .74, .66);
  sh.lineTo(.48, .64); sh.quadraticCurveTo(.4, .52, .26, .5); sh.lineTo(-.2, .5); sh.lineTo(-.28, .82); sh.lineTo(-.4, .82); sh.lineTo(-.46, .5); sh.lineTo(-.82, .5); sh.lineTo(-.9, .98); sh.lineTo(-1.02, .98); sh.lineTo(-1, .14);
  const eg = new THREE.ExtrudeGeometry(sh, { depth: .98, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 10 }); eg.translate(0, 0, -.49); eg.rotateY(Math.PI / 2);
  const shell = new THREE.Mesh(eg, pink); shell.castShadow = true; body.add(shell);
  part(new THREE.BoxGeometry(.9, .07, .44), white, 0, .53, -.02, body); part(new THREE.BoxGeometry(.9, .07, .34), white, 0, .53, .64, body);   // seat cushions
  part(new THREE.BoxGeometry(1.1, .05, 1.95), gold, 0, .14, 0, body);   // gold skirt
  // VIVI on both sides
  const vt = canvasTex(512, 160, (c, w, h) => { c.font = '120px "Lilita One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 14; c.strokeStyle = '#ffffff'; c.strokeText('VIVI ★', w / 2, h / 2 + 6); const gr = c.createLinearGradient(0, 0, w, 0); ['#ff4fa8', '#ffd25a', '#3fb2ff', '#8b6bff'].forEach((col, i) => gr.addColorStop(i / 3, col)); c.fillStyle = gr; c.fillText('VIVI ★', w / 2, h / 2 + 6); });
  [-1, 1].forEach(s => { const d = new THREE.Mesh(new THREE.PlaneGeometry(.95, .3), new THREE.MeshBasicMaterial({ map: vt, transparent: true })); d.position.set(s * .555, .33, .05); d.rotation.y = s * Math.PI / 2; body.add(d); });
  // headlights + a birthday candle on the nose
  const hl = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xfff2a0, emissiveIntensity: 1.2 });
  [-.3, .3].forEach(x => { part(new THREE.SphereGeometry(.07, 14, 10), hl, x, .42, -1.08, body); part(new THREE.TorusGeometry(.075, .015, 8, 20), gold, x, .42, -1.07, body); });
  const cnd = part(new THREE.CylinderGeometry(.045, .045, .34, 14), new THREE.MeshStandardMaterial({ map: candleT, roughness: .5 }), 0, .82, -.82, body);
  const flame = new THREE.Group(); flame.position.set(0, 1.03, -.82); body.add(flame);
  const f1 = new THREE.Mesh(FLAME_G, flameM); f1.scale.set(3, 5.5, 3); flame.add(f1); const f2 = new THREE.Mesh(FLAME_G, flameCore); f2.scale.set(1.4, 2.6, 1.4); flame.add(f2);
  // wheels on the rails
  const wheels = [];
  [-.42, .42].forEach(x => [-.7, .7].forEach(z => { const w = part(new THREE.CylinderGeometry(.09, .09, .08, 16), dark, x, .09, z, body); w.rotation.z = Math.PI / 2; wheels.push(w); part(new THREE.CylinderGeometry(.04, .04, .09, 10), gold, x, .09, z, body).rotation.z = Math.PI / 2; }));
  // lap bar (lifts up when you get on/off)
  const bar = new THREE.Group(); bar.position.set(0, .72, .12); body.add(bar);
  const bt = new THREE.Mesh(new THREE.TorusGeometry(.34, .03, 8, 24, Math.PI), gold); bt.rotation.set(0, 0, 0); bt.position.set(0, 0, -.28); bt.rotation.x = -Math.PI / 2; bar.add(bt);
  bt.scale.set(1.25, 1, 1);
  // the teddy in the back
  const ted = new THREE.Group(); ted.position.set(0, .56, .64); body.add(ted);
  const fur = smat(0xc98a52, { roughness: .9 }), furL = smat(0xf1cfa3, { roughness: .9 }), eyeM = smat(0x1a1212, { roughness: .3 });
  const tb = part(new THREE.SphereGeometry(.2, 18, 14), fur, 0, .18, 0, ted); tb.scale.set(1, 1.15, .9);
  part(new THREE.SphereGeometry(.12, 14, 10), furL, 0, .18, -.12, ted).scale.set(1, 1.2, .5);
  const head = new THREE.Group(); head.position.set(0, .48, 0); ted.add(head);
  part(new THREE.SphereGeometry(.16, 18, 14), fur, 0, 0, 0, head);
  part(new THREE.SphereGeometry(.07, 12, 10), furL, 0, -.03, -.13, head).scale.set(1, .8, .8);
  part(new THREE.SphereGeometry(.025, 8, 6), eyeM, 0, -.01, -.19, head);
  [-1, 1].forEach(s => { part(new THREE.SphereGeometry(.022, 8, 6), eyeM, s * .06, .04, -.145, head); part(new THREE.SphereGeometry(.06, 12, 10), fur, s * .12, .12, 0, head); part(new THREE.SphereGeometry(.035, 10, 8), furL, s * .12, .12, -.03, head); });
  const hat = part(new THREE.ConeGeometry(.08, .2, 14), new THREE.MeshStandardMaterial({ color: 0x3fb2ff, roughness: .4 }), .04, .21, 0, head); hat.rotation.z = -.25;
  const arms = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * .19, .28, 0); ted.add(a); const m = part(new THREE.CapsuleGeometry(.055, .16, 6, 10), fur, 0, -.12, 0, a); return a; });
  balloon(body, -.3, .98, .95, 1, .8, .9); balloon(body, .3, .98, .95, 4, 1.0, .9);
  return { g, body, bar, flame, wheels, ted, head, arms, pink };
}
const CART = makeCart(); rcG.add(CART.g); CART.g.visible = false;
function cartPlace(s) {   // put the cart on the track at distance s
  const p = V(), T = V(), U = V(), Rr = V(); coAt(s, p, T, U, Rr);
  const m4 = new THREE.Matrix4().makeBasis(Rr, U, T.clone().negate()); CART.g.quaternion.setFromRotationMatrix(m4); CART.g.position.copy(p);
}
cartPlace(CO.sStart);

/* ---------- buttons ---------- */
const B_RIDE = partyButton(ST.g, V(1.85, 0, -14.6), Math.PI / 2, 'RIDE! 🎢', 0x5fd94a, '#9cf28a', () => coBoard());
const B_COMFY = partyButton(ST.g, V(1.85, 0, -16.6), Math.PI / 2, 'COMFY', 0x3fb2ff, '#9ad8ff', () => {
  RC.comfy = !RC.comfy; store.set('kg-coaster-comfy', RC.comfy ? '1' : '0');
  toast(RC.comfy ? '😌 COMFY ON: the horizon stays level and the edges dim on the ride. Press again to turn it off.' : '🌀 COMFY OFF: you go all the way upside down in the loop!', 5);
});

/* ---------- comfort vignette ---------- */
const VIG = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, uniforms: { k: { value: 0 } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: 'uniform float k; varying vec2 vU; void main(){ float r = length(vU); float a = smoothstep(.95 - k * .55, 1.25 - k * .45, r) * min(1., k * 1.6); gl_FragColor = vec4(.05, .02, .1, a); }' }));
VIG.position.z = -.25; VIG.scale.setScalar(.32); VIG.renderOrder = 999; VIG.frustumCulled = false; VIG.visible = false; camera.add(VIG);
const vigDom = document.createElement('div'); vigDom.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:15;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(12,4,24,.85) 100%)'; document.body.appendChild(vigDom);
const rideBtn = document.createElement('button'); rideBtn.className = 'ptB'; rideBtn.style.cssText = 'top:176px;background:#5fd94a;box-shadow:0 4px 0 #2f8a22;font-size:18px';
rideBtn.textContent = '🎢 Ride the coaster!'; rideBtn.onclick = e => { e.stopPropagation(); rideBtn.blur(); coBoard(); }; document.body.appendChild(rideBtn);

/* ---------- fireworks ---------- */
const RC_R = [];
const FW = { N: 2600, n: 0, pos: null, vel: [], life: [], max: [], col: [], rockets: [] };
{
  FW.pos = new Float32Array(FW.N * 3); FW.colA = new Float32Array(FW.N * 3);
  for (let i = 0; i < FW.N; i++) { FW.vel.push(V()); FW.life.push(0); FW.max.push(1); FW.col.push(new THREE.Color()); FW.pos[i * 3 + 1] = -999; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(FW.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(FW.colA, 3));
  const dot = canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  FW.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .55, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  FW.pts.frustumCulled = false; rcG.add(FW.pts);
}
function fwSpark(p, v, c, life) { const i = FW.n = (FW.n + 1) % FW.N; FW.pos[i * 3] = p.x; FW.pos[i * 3 + 1] = p.y; FW.pos[i * 3 + 2] = p.z; FW.vel[i].copy(v); FW.col[i].copy(c); FW.life[i] = FW.max[i] = life; }
const FW_COLS = [0xff4fa8, 0xffd25a, 0x3fb2ff, 0x8b6bff, 0x5fd94a, 0xff8a3d, 0xffffff].map(c => new THREE.Color(c));
function fwBurst(p, big = 1) {
  const c1 = FW_COLS[Math.floor(Math.random() * 7)], c2 = FW_COLS[Math.floor(Math.random() * 7)], n = Math.round((state.xr ? 90 : 150) * big), heart = Math.random() < .3, v = V();
  for (let i = 0; i < n; i++) {
    if (heart) { const t = i / n * Math.PI * 2; v.set(16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t), (Math.random() - .5) * 2).multiplyScalar(.42 * big); }
    else { v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar((6 + Math.random() * 2) * big); }
    fwSpark(p, v, i % 3 ? c1 : c2, 1.6 + Math.random() * .8);
  }
  if (ac) { tone('sine', 140, 40, .6, .3 * Math.min(1, big)); const ns = noise(), f = ac.createBiquadFilter(), gg = ac.createGain(), t = ac.currentTime; f.type = 'lowpass'; f.frequency.value = 900; gg.gain.setValueAtTime(.35, t); gg.gain.exponentialRampToValueAtTime(.001, t + .5); ns.connect(f); f.connect(gg); gg.connect(master); ns.start(t); ns.stop(t + .5); }
}
function fwRocket(from, to) { RC_R.push({ p: from.clone(), v: V().subVectors(to, from).multiplyScalar(1 / 1.3), t: 1.3, big: .8 + Math.random() * .6 }); if (ac) tone('sine', 300, 1400, 1.1, .05); }
function stepFireworks(dt) {
  const g = .8;
  for (let i = RC_R.length - 1; i >= 0; i--) { const r = RC_R[i]; r.p.addScaledVector(r.v, dt); r.t -= dt; fwSpark(r.p, V((Math.random() - .5) * .4, -1, (Math.random() - .5) * .4), FW_COLS[1], .5); if (r.t <= 0) { fwBurst(r.p, r.big); RC_R.splice(i, 1); } }
  for (let i = 0; i < FW.N; i++) {
    if (FW.life[i] <= 0) continue; const o = i * 3, v = FW.vel[i];
    FW.life[i] -= dt; v.y -= g * dt; v.multiplyScalar(1 - dt * 1.4);
    FW.pos[o] += v.x * dt; FW.pos[o + 1] += v.y * dt; FW.pos[o + 2] += v.z * dt;
    const k = Math.max(0, FW.life[i] / FW.max[i]), tw = k < .4 ? (Math.random() < .5 ? k * 2 : 0) : k;
    FW.colA[o] = FW.col[i].r * tw; FW.colA[o + 1] = FW.col[i].g * tw; FW.colA[o + 2] = FW.col[i].b * tw;
    if (FW.life[i] <= 0) FW.pos[o + 1] = -999;
  }
  FW.pts.geometry.attributes.position.needsUpdate = FW.pts.geometry.attributes.color.needsUpdate = true;
}

/* ---------- HAPPY BIRTHDAY VIVI! in the sky (each letter bounces in) ---------- */
const HB = { g: new THREE.Group(), L: [], t: -1 };
{
  HB.g.position.set(-17, 10.5, 2.5); HB.g.rotation.y = Math.PI / 2; HB.g.visible = false; rcG.add(HB.g);
  const lines = [['HAPPY BIRTHDAY', 2.1, 0], ['VIVI!', 3.6, -3.4]];
  let ci = 0;
  lines.forEach(([txt, sz, y]) => {
    const chars = [...txt], wd = sz * .66, x0 = -(chars.length - 1) * wd / 2;
    chars.forEach((ch, i) => {
      if (ch === ' ') return;
      const col = '#' + new THREE.Color(PARTY_COLS[ci++ % 7]).getHexString();
      const t = canvasTex(256, 256, (c, w, h) => { c.font = '230px "Lilita One", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 30; c.strokeStyle = '#ffffff'; c.strokeText(ch, 128, 140); c.fillStyle = col; c.fillText(ch, 128, 140); c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.25)'; c.strokeText(ch, 128, 140); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.position.set(x0 + i * wd, y, 0); m.userData.y0 = y; m.renderOrder = 5; HB.g.add(m); HB.L.push(m);
    });
  });
}
function stepHB(dt) {
  if (HB.t < 0) return; HB.t += dt; HB.g.visible = true;
  HB.L.forEach((m, i) => {
    const a = HB.t - i * .09, s = a <= 0 ? 0 : a < .5 ? Math.sin(a / .5 * Math.PI * .5) * (1 + .35 * Math.sin(a / .5 * Math.PI)) : 1;
    const out = HB.t > 22 ? Math.max(0, 1 - (HB.t - 22) / 1.5) : 1;
    m.scale.setScalar(Math.max(.001, s * out)); m.position.y = m.userData.y0 + Math.sin(tAll * 3 + i * .5) * .25; m.rotation.z = Math.sin(tAll * 2 + i) * .08;
  });
  if (HB.t > 24) { HB.t = -1; HB.g.visible = false; }
}

/* ---------- sounds ---------- */
let windSrc = null, windGain = null, windF = null;
function coWind(on) {
  if (!ac) return;
  if (on && !windSrc) { windSrc = noise(); windSrc.loop = true; windF = ac.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 500; windF.Q.value = .6; windGain = ac.createGain(); windGain.gain.value = 0; windSrc.connect(windF); windF.connect(windGain); windGain.connect(master); windSrc.start(); }
  if (!on && windSrc) { try { windSrc.stop(); } catch (e) {} windSrc = null; }
}
function hbSong() { if (!ac) return; const N = [[392, .3], [392, .15], [440, .45], [392, .45], [523, .45], [494, .9], [392, .3], [392, .15], [440, .45], [392, .45], [587, .45], [523, .9], [392, .3], [392, .15], [784, .45], [659, .45], [523, .45], [494, .45], [440, .9], [698, .3], [698, .15], [659, .45], [523, .45], [587, .45], [523, 1.2]];
  let t = 0; N.forEach(([f, d]) => { tone('triangle', f, f, d * .95, .13, t); tone('sine', f * 2, f * 2, d * .6, .04, t); t += d; }); }

/* ---------- riding ---------- */
const _rcP = V(), _rcT = V(), _rcU = V(), _rcR = V(), _rcM4 = new THREE.Matrix4(), _rcQ = new THREE.Quaternion(), _rcYQ = new THREE.Quaternion();
function coBoard() {
  if (!PT.inside) return;
  if (!RC.open) { toast('🔒 The coaster opens after you CUT THE CAKE! 🎂🗡️', 4); return; }
  if (RC.ride || RC.building) return;
  RC.ride = true; RC.phase = 'board'; RC.t = 0; RC.s = CO.sStart; RC.v = 0; RC.rides++; RC.fly = null;
  RC.gold = RC.rides % 3 === 0;   // 🤫
  CART.pink.color.setHex(RC.gold ? 0xffc93a : 0xff5fb0); CART.pink.metalness = RC.gold ? .9 : .15;
  CART.g.visible = true; cartPlace(RC.s); CART.bar.rotation.x = -1.3;
  eyeLocal(RC.eye0); if (!state.xr && !sim.on) RC.eye0.set(0, state.bodyH, 0);
  state.vel.set(0, 0, 0); state.velBuf.length = 0; hands.forEach(h => { h.stuck = false; h.ready = false; });
  if (!state.xr) { state.yaw = 0; state.pitch = 0; }
  coSign(); coWind(true); partyChime();
  if (RC.gold) toast('✨✨✨', 2); else toast('🎢 Buckle up! The lap bar is coming down...', 2.6);
  if (CL.on) clRun('say Woohoo! Have fun on the coaster!');
}
function coSeat(eye, q) {   // put your eyes at `eye`, looking along q
  rig.quaternion.copy(q); rig.updateMatrixWorld();
  rig.position.copy(eye).sub(V().copy(RC.eye0).applyQuaternion(q)); rig.updateMatrixWorld();
  if (!state.xr && !sim.on) camera.position.set(0, state.bodyH, 0), camera.rotation.set(state.pitch, 0, 0);
}
function coHands(dt, q, hup) {   // paws: real controllers in VR, gripping the bar (or hands up!) on PC
  if (state.xr || sim.on) {
    sampleHands(dt); rig.updateMatrixWorld(); readHands();
    for (const h of hands) { h.paw.visible = h.tracked; if (!h.tracked) continue; h.pos.copy(h.target); h.prev.copy(h.pos); h.paw.position.copy(h.pos); h.paw.quaternion.copy(rig.quaternion).multiply(h.q); clutch(h, dt); }
  } else {
    hands.forEach((h, i) => {
      const sd = i ? 1 : -1; h.pos.set(sd * (.22 + hup * .08), -.32 + hup * .62 + Math.sin(tAll * 9 + i) * .02 * hup, -.42 + hup * .1);
      camera.updateMatrixWorld(); camera.localToWorld(h.pos); h.paw.position.copy(h.pos); camera.getWorldQuaternion(h.paw.quaternion); h.paw.visible = true; clutch(h, dt);
    });
  }
}
function coEnd(landed) {
  CT.sea.visible = false; RC.wasTop = false;
  RC.ride = false; RC.phase = ''; coWind(false); VIG.visible = false; vigDom.style.opacity = 0;
  rig.quaternion.setFromAxisAngle(V(0, 1, 0), (RC.fly ? RC.fly.yaw : 0) + (!state.xr && !sim.on ? state.yaw : 0)); rig.rotation.set(0, rig.rotation.y, 0);
  if (!state.xr) { state.yaw = rig.rotation.y; state.pitch = 0; }
  state.vel.set(0, 0, 0); state.velBuf.length = 0; state.grounded = true; hands.forEach(h => { h.stuck = false; h.ready = false; });
  if (!landed) partyRespawn();
  coSign();
}
function stepRide(dt) {
  if (state.mode !== 'play') return;
  if (!PT.inside) { coEnd(false); return; }
  RC.t += dt;
  const hupAuto = RC.phase === 'go' && (RC.v > 10 || (RC.s > CO.sDrop && RC.s < CO.sDrop + 14)) ? 1 : 0;
  RC.hup = (RC.hup || 0) + (hupAuto - (RC.hup || 0)) * Math.min(1, dt * 4);
  if (RC.phase === 'board') {
    CART.bar.rotation.x = -1.3 * Math.max(0, 1 - RC.t / .8);
    const n = 3 - Math.floor((RC.t - .9) / .8);
    if (RC.t > .9 && n !== RC.cnt && n >= 0) { RC.cnt = n; toast(n ? `🎢 ${n}...` : '🎉 GO GO GO!', .9); if (ac) tone('triangle', n ? 660 : 990, n ? 660 : 990, .18, .14); }
    if (RC.t > .9 + 3.2) { RC.phase = 'go'; RC.v = 1; }
  } else if (RC.phase === 'go') {
    // speed: station roll-out, chain lift, then gravity (energy) with a bit of friction, capped to stay comfy
    let want;
    if (RC.s < CO.sLift0) want = 3.6; else if (RC.s < CO.sCrest) want = CO.LIFT; else if (RC.s < CO.sDrop) want = CO.CRUISE;
    else { coAt(RC.s, _rcP, _rcT, _rcU, _rcR); want = Math.sqrt(Math.max(2 * (CO.E0 - CO.GE * _rcP.y - CO.fric * (RC.s - CO.sDrop)), 16)); want = Math.min(want, 15); }
    RC.v += (want - RC.v) * Math.min(1, dt * (RC.s < CO.sCrest ? 1.5 : 4));
    RC.s += RC.v * dt;
    if (RC.s >= CO.sLift0 && RC.s < CO.sCrest && (RC.clickT -= dt) <= 0) { RC.clickT = .17; if (ac) tone('square', 1100, 700, .02, .04); }
    if (!RC.told.sky && RC.s > CO.sCrest - 4) { RC.told.sky = 1; toast('☁️ We are UP IN THE CLOUDS! Look how high we are!', 4); if (ac) [784, 988, 1175].forEach((f, i) => tone('sine', f, f, .5, .06, i * .15)); }
    if (!RC.told.drop && RC.s > CO.sDrop + 1) { RC.told.drop = 1; toast(state.xr ? '🙌 HANDS UP!!!' : '🙌 WHEEEEE!!!', 2); if (ac) tone('sawtooth', 500, 900, .6, .05); }
    if (!RC.told.loop && RC.s > CO.sLoop0) { RC.told.loop = 1; toast('🌀 LOOP-DE-LOOP!', 2.2); }
    if (RC.s >= CO.L - .05) { RC.s = CO.L; coLaunch(); return; }
  }
  if (RC.phase === 'fly') { stepFly(dt); return; }
  // the cart and you, glued to the track
  coAt(RC.s, _rcP, _rcT, _rcU, _rcR);
  _rcM4.makeBasis(_rcR, _rcU, V().copy(_rcT).negate()); _rcQ.setFromRotationMatrix(_rcM4);
  CART.g.position.copy(_rcP); CART.g.quaternion.copy(_rcQ); CART.wheels.forEach(w => w.rotation.x += RC.v * dt / .09);
  CART.flame.scale.setScalar(1 + Math.sin(tAll * 30) * .1); CART.flame.rotation.x = Math.min(.9, RC.v * .06);
  CART.arms.forEach((a, i) => a.rotation.z = (i ? 1 : -1) * (RC.hup * 2.6 + Math.sin(tAll * 8 + i) * .2 * RC.hup) + (i ? .25 : -.25) * (1 - RC.hup));
  CART.head.rotation.z = Math.sin(tAll * 3) * .1;
  const eye = V(0, 1.12, .02).applyQuaternion(_rcQ).add(_rcP).add(PW);
  let q = _rcQ;
  if (RC.comfy) { const yaw = Math.atan2(-_rcT.x, -_rcT.z); _rcYQ.setFromAxisAngle(V(0, 1, 0), Math.abs(_rcT.y) > .97 ? (RC.lastYaw || 0) : yaw); RC.lastYaw = Math.abs(_rcT.y) > .97 ? RC.lastYaw : yaw; q = _rcYQ; }
  if (!state.xr && !sim.on) { q = _rcYQ.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), state.yaw)); }
  coSeat(eye, q); coHands(dt, q, RC.hup);
  // comfort: dim the edges when it's fast
  const k = state.xr ? clamp((RC.comfy ? .45 : .2) + (RC.v - 5) / 20, 0, .8) : clamp((RC.v - 8) / 14, 0, .45);
  RC.vig += (k - RC.vig) * Math.min(1, dt * 3);
  VIG.visible = state.xr && RC.vig > .02; VIG.material.uniforms.k.value = RC.vig; vigDom.style.opacity = state.xr ? 0 : RC.vig;
  { const ly = eye.y - PW.y, top = ly > 30; CT.sea.visible = top; if (top !== RC.wasTop) { RC.wasTop = top; if (RC.phase === 'go' && RC.s > CO.sDrop && !top) { toast('☁️💥 WHOOSH! Right through the clouds!', 2.5); if (ac) tone('sine', 900, 200, .6, .08); } } }
  if (windGain) { windGain.gain.value = clamp((RC.v - 2) / 13, 0, 1) * .22; windF.frequency.value = 300 + RC.v * 70; }
}
function coLaunch() {
  // off the end of the kicker: you fly up over the party, the cart tumbles away
  coAt(CO.L, _rcP, _rcT, _rcU, _rcR);
  const P0 = V().copy(_rcP).add(V(0, 1.12, 0)), dir = V().copy(_rcT).setY(0).normalize(), land = V(-4, state.bodyH, 2.5);   // clear of the rainbow tube
  const P1 = V().copy(P0).addScaledVector(_rcT, 9), P2 = V(land.x + 2, 20, land.z - 1.5), P3 = land;
  RC.fly = { c: new THREE.CubicBezierCurve3(P0, P1, P2, P3), u: 0, t: 0, yaw: Math.atan2(-dir.x, -dir.z), fw: 0, song: false };
  RC.fly.len = RC.fly.c.getLength();
  RC.cartFly = { p: V().copy(_rcP), v: V().copy(_rcT).multiplyScalar(RC.v).add(V(0, 2, 0)), r: V(2, 0, 3), t: 0 };
  RC.phase = 'fly'; RC.told = {};
  toast('🚀 WHOOOOAAAA!!!', 2); if (ac) { tone('sawtooth', 300, 1200, .9, .06); }
  coWind(true);
}
function stepFly(dt) {
  const F = RC.fly; F.t += dt;
  // fast up and over, a slow floaty moment at the top for the fireworks, then balloons carry you down
  const sp = F.t < 1.4 ? Math.max(5, RC.v * (1 - F.t / 1.9)) : F.u < .62 ? 2.2 : 2.6;
  F.u = Math.min(1, F.u + sp * dt / F.len);
  const eye = F.c.getPointAt(F.u).add(PW);
  _rcYQ.setFromAxisAngle(V(0, 1, 0), F.yaw); if (!state.xr && !sim.on) _rcYQ.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), state.yaw));
  coSeat(eye, _rcYQ); coHands(dt, _rcYQ, 1);
  if (windGain) windGain.gain.value = clamp((sp - 2) / 12, 0, 1) * .2;
  if (state.xr) { RC.vig += (.3 - RC.vig) * Math.min(1, dt * 2); VIG.material.uniforms.k.value = RC.vig; VIG.visible = true; } else vigDom.style.opacity = Math.max(0, +vigDom.style.opacity - dt);
  // balloons appear above you as you start to come down
  if (F.u > .55 && !F.bal) {
    F.bal = new THREE.Group(); rcG.add(F.bal);
    for (let i = 0; i < 7; i++) { const b = balloon(F.bal, Math.cos(i) * .35, 0, Math.sin(i * 1.7) * .35, i, 1.4 + (i % 3) * .3, 1.4); }
    toast('🎈 The balloons caught you!', 3); if (ac) partyChime();
  }
  if (F.bal) { const e = V().copy(eye).sub(PW); F.bal.position.set(e.x, e.y + .5, e.z); F.bal.scale.setScalar(Math.min(1, (F.u - .55) * 8)); }
  // the cart tumbles away and goes POOF
  const C = RC.cartFly;
  if (C && CART.g.visible) {
    C.t += dt; C.v.y -= 9 * dt; C.p.addScaledVector(C.v, dt); CART.g.position.copy(C.p); CART.g.rotateX(dt * 3); CART.g.rotateZ(dt * 2);
    if (C.t > 1.5) { CART.g.visible = false; confetti(V().copy(C.p).add(PW), state.xr ? 50 : 90); if (ac) tone('square', 500, 120, .2, .1); }
  }
  // fireworks + the giant message + the birthday song
  if (!F.song && F.t > 1.1) { F.song = true; HB.t = 0; hbSong(); toast('🎂🎉 HAPPY BIRTHDAY VIVI!!! 🎉🎂', 7); if (CL.on) clRun('dance\nsay Happy birthday Vivi!'); }
  if ((F.fw -= dt) <= 0 && F.t < 14) {
    F.fw = F.t < 6 ? .35 : .7;
    const a = Math.random() * Math.PI * 2, from = V(Math.cos(a) * 11, 0, -5 + Math.sin(a) * 14), to = V(-12 + Math.random() * 10, 11 + Math.random() * 9, -6 + Math.random() * 22);
    fwRocket(from, to);
  }
  if (F.u >= 1) {
    if (F.bal) { RC.floatAway = { g: F.bal, t: 0 }; F.bal = null; }
    confetti(pw(-4, .3, 2.5), state.xr ? 50 : 100); if (ac) { tone('sine', 140, 60, .25, .25); partyChime(); }
    toast(state.xr ? '🎢 What a ride! Press RIDE again any time 🎈' : '🎢 What a ride! Walk back to the coaster to ride again 🎈', 5);
    coEnd(true); RC.respawnT = 2;
  }
}

/* ---------- each frame ---------- */
function stepCoaster(dt) {
  if (!PT.inside) {
    if (RC.wasIn) { RC.wasIn = false; RC.open = false; RC.cakeN = 1e9; RC.build = 0; coReveal(0); CART.g.visible = false; ST.rope.visible = true; coSign(); }
    rideBtn.style.display = 'none'; if (RC.ride) coEnd(false); return;
  }
  if (!RC.wasIn) { RC.wasIn = true; RC.open = false; RC.cakeN = 1e9; RC.build = 0; coReveal(0); CART.g.visible = false; ST.rope.visible = true; coSign(); }
  // did someone cut the cake? (more cake pieces than there were)
  if (!RC.open && AR.ready) {
    let n = 0; for (const pc of AR.pieces) if (KINDS[pc.kind].cake) n++;
    if (n < RC.cakeN) RC.cakeN = n; else if (n > RC.cakeN && n >= 3) coOpen();
  }
  if (RC.building) {
    RC.build = Math.min(1, RC.build + dt / 4.5); const e = RC.build * RC.build * (3 - 2 * RC.build); coReveal(e);
    if ((RC.sparkT = (RC.sparkT || 0) - dt) <= 0) { RC.sparkT = .12; coAt(e * CO.L, _rcP, _rcT, _rcU, _rcR); confetti(V().copy(_rcP).add(PW), state.xr ? 6 : 12); if (ac) tone('triangle', 500 + e * 900, 600 + e * 900, .08, .05); }
    if (RC.build >= 1) { RC.building = false; CART.g.visible = true; cartPlace(CO.sStart); confetti(pw(0, 1.5, -15.5), state.xr ? 40 : 80); partyChime(); }
  }
  if (RC.open && !RC.building) coBalloons();
  ST.arrow.visible = RC.open && !RC.ride; ST.arrow.position.y = 5.4 + Math.sin(tAll * 3) * .25; ST.arrow.rotation.y += dt * 1.5;
  if (RC.ride) stepRide(dt);
  else if (RC.respawnT > 0 && (RC.respawnT -= dt) <= 0) { CART.g.visible = true; cartPlace(CO.sStart); CART.g.quaternion.multiply(_rcYQ.identity()); CART.bar.rotation.x = -1.3; confetti(pw(0, 1.2, -15.5), state.xr ? 30 : 60); }
  if (RC.floatAway) { const f = RC.floatAway; f.t += dt; f.g.position.y += dt * 2.5; if (f.t > 6) { rcG.remove(f.g); PT.balloons = PT.balloons.filter(b => b.g.parent !== f.g); RC.floatAway = null; } }
  stepFireworks(dt); stepHB(dt);
  // the 🎢 button on PC + phone when you're near the station
  let near = false; if (!state.xr && RC.open && !RC.ride && !RC.building && state.mode === 'play') { headWorld(_rcP); near = Math.hypot(_rcP.x - PW.x, _rcP.z - PW.z + 15.8) < 3.6; }
  rideBtn.style.display = near ? 'block' : 'none';
}
function coOpen() {
  if (RC.open) return; RC.open = true; RC.building = true; RC.build = 0; ST.rope.visible = false; coSign();
  toast('🎢 WHOA! A ROLLER COASTER just appeared at the back of the party! Go ride it!', 6);
  if (ac) { tone('sine', 300, 1200, 1.5, .08); partyChime(); }
  if (CL.on) setTimeout(() => clRun('say Whoa! A roller coaster just appeared behind the cube blaster! Go ride it!'), 1200);
}
mergeStatic(ST.g, c => c === ST.sign || c === ST.rope || c === ST.arrow || P_BTNS.some(b => b.cap === c) || PT.balloons.some(b => b.g === c));
coReveal(0);
window.__kg.coaster = { RC, CO, CART, coOpen, coBoard, coLaunch, fwBurst, HB, stepCoaster };
