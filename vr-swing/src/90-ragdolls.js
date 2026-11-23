
/* ======================================================================
   RAGDOLLS: floppy plush dummies you can spawn, stretch, rip apart, bonk and fix.
   Spawn:  G on PC · 🧸 button on PC/phone · LEFT stick click in VR
   Fix:    H on PC · 🧸 menu · RIGHT stick click in VR (hold it 1 s = clear them all, J on PC)
   Grab:   VR grip on any body part · PC hold left click on a part (mouse wheel = pull closer/farther)
           · phone: aim, then ✋ Grab (or ⚔️ Use) to grab, tap again to let go
   Pull an arm or the head: the part itself stretches (up to half a person longer), then RIPS off.
   Normal = cotton stuffing pops out. Horror mode = meat + bones.
   They look like the player (a Thumpling made from the same model) and are blank, silent test dummies.
   3 of them stand ready in the DUMMY TEST zone of the Slicing Yard. There's a sledgehammer 🔨 to bonk them with.
   Not shared in multiplayer rooms (each player has their own dummies).
   ====================================================================== */
const RD = { list: [], MAX: 6, H: .95, acc: 0, hz: null, held: [null, null], pcDist: 1.3, stickPrev: [false, false], stickT: 0, hintT: 0, told: false, toldRip: false, seq: 0 };
const RD_EXTRA = RD.H * .5;                         // a part can stretch half a person longer before it rips
const RD_STEP = 1 / 60;
const RD_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: 0 });
// particles: 0 sL 1 sR 2 hL 3 hR 4 neck 5 belly | 6 head | 7 eL 8 eR 9 wL 10 wR | 11-14 the bean's bottom (hidden, they're its "feet")
const RD_DS = .85;   // a bit smaller than the model's full size, like a player
const RD_REST = [[-.235, .465, -.02], [.235, .465, -.02], [-.13, .14, 0], [.13, .14, 0], [0, .6, 0], [0, .33, .14], [0, .85, .02],
  [-.33, .27, .1], [.33, .27, .1], [-.36, .08, .26], [.36, .08, .26], [-.12, .08, -.13], [.12, .08, -.13], [-.12, .07, .08], [.12, .07, .08]].map(a => a.map(v => v * RD_DS));
const RD_RAD = [.1, .1, .13, .13, .1, .12, .2, .05, .05, .07, .07, .07, .07, .07, .07].map(v => v * RD_DS);
const RD_IM = [.25, .25, .25, .25, .25, .25, .6, 1, 1, 1, 1, .25, .25, .25, .25];
const RD_STAND_K = [.06, .06, .06, .06, .06, .06, .04, .012, .012, .008, .008, .03, .03, .02, .02];
const RD_FUR = [0x2fc6a3, 0xff8a3d, 0x8b6bff, 0xff5f9e, 0x3fa0ff, 0xffd25a, 0x5ad36b, 0xe8e8f0];
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------------- building the bodies: the same Thumpling model the player wears ---------------- */
function rdCol(g, c) { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function rdT(g, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) { g.scale(sx, sy, sz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; }
const rdS = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
function rdMerge(list) { const g = mergeGeometries(list); list.forEach(x => x.dispose()); return g; }
// Each Thumpling part is baked into ONE mesh with its colors painted on the vertices (1 draw call per part instead of ~50 per dummy: Quest stays smooth).
// No smile: blank test dummies.
const RD_GEO = {}, RD_BODY = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), _bkM = new THREE.Matrix4();
function rdBake(obj, fur) {
  obj.updateMatrixWorld(true); const inv = obj.matrixWorld.clone().invert(), parts = [];
  obj.traverse(c => {
    if (!c.isMesh || c.name === 'Smile') return;
    let g = c.geometry.clone(); if (g.index) g = g.toNonIndexed(); g.applyMatrix4(_bkM.multiplyMatrices(inv, c.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const m = Array.isArray(c.material) ? c.material[0] : c.material, n = m.name || '';
    rdCol(g, n === 'Fur' || m === obj.userData.fur ? fur : n === 'FurDark' ? rdShade(fur, .72) : m.color ? m.color.getHex() : 0xffffff); parts.push(g);
  });
  return rdMerge(parts);
}
const rdShade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
function rdGeo(fur) {
  if (RD_GEO[fur]) return RD_GEO[fur];
  const T = AV.tpl, paw = makePaw(fur), pw = new THREE.Group(); pw.add(paw); paw.rotation.x = Math.PI / 2; paw.position.y = .06;   // fingers point down the arm, cuff at the wrist
  const tor = rdBake(T.torso, fur), [top, bot] = rwSplit(tor);   // split at the waist for the cheese pull (91-cheese-saw.js)
  return (RD_GEO[fur] = { torso: tor, top, bot, head: rdBake(T.head, fur), arm: rdBake(T.arm, fur), elbow: rdBake(T.elbow, fur), paw: rdBake(pw, fur) });
}
// cotton puffs / meat + bone that show where a part tore off (unit size, pointing +Y)
const RD_CAP = {
  cotton: rdMerge([rdCol(new THREE.CylinderGeometry(1, 1, .2, 12), 0xf3efe6), ...[[0, .35, 0, .6], [.45, .25, .2, .45], [-.4, .3, .25, .45], [.1, .3, -.45, .5], [-.3, .55, -.15, .4], [.3, .6, .1, .38], [0, .75, .1, .35]]
    .map(([x, y, z, r], i) => rdCol(rdT(new THREE.IcosahedronGeometry(r, 1), x, y, z), i % 2 ? 0xffffff : 0xece6d8))].map(g => g.toNonIndexed())),
  meat: rdMerge([rdCol(rdT(new THREE.CylinderGeometry(1.75, 1.6, .06, 9), 0, -.05, 0, 1, 1, .85), 0x5e070b), rdCol(new THREE.CylinderGeometry(1, .95, .3, 12), 0x8e1418), rdCol(rdT(new THREE.TorusGeometry(.88, .13, 6, 14), 0, .14, 0, 1, 1, 1, Math.PI / 2), 0xe6c7a0),
    ...[[.45, .2, .25, .35, 0xa3242a], [-.4, .22, -.2, .38, 0x7a0f14], [.1, .25, -.5, .3, 0xb8333a], [-.35, .2, .4, .3, 0x9b1b1f]].map(([x, y, z, r, c]) => rdCol(rdT(new THREE.IcosahedronGeometry(r, 0), x, y, z, 1, .6, 1), c)),
    rdCol(rdT(new THREE.CylinderGeometry(.28, .32, 1.1, 8), 0, .6, 0), 0xefe6d2), rdCol(rdT(new THREE.IcosahedronGeometry(.42, 1), .1, 1.2, 0), 0xf4ecda), rdCol(rdT(new THREE.IcosahedronGeometry(.34, 1), -.18, 1.12, 0), 0xf4ecda)].map(g => g.toNonIndexed())),
};
const rdCapG = () => HZ.on ? RD_CAP.meat : RD_CAP.cotton;

/* ---------------- one ragdoll ---------------- */
const _rv = V(), _rd = V(), _rx = V(), _ry = V(), _rz = V(), _rm = new THREE.Matrix4(), _rdQ = new THREE.Quaternion(), _rinfo = { nrm: V(), ground: false };
function rdMakeSeg(rd, a, b, geo, stretch) {
  const m = new THREE.Group(); rd.g.add(m);
  const s = { m, a, b, L: rd.P[a].p.distanceTo(rd.P[b].p), stretch, pf: null }; rd.segs.push(s); return s;
}
function rdSpawnAt(base, yaw, look) {
  const L = look || { fur: pick(RD_FUR) }, rd = { look: L, P: [], C: [], G: {}, segs: [], caps: [], g: new THREE.Group(), id: ++RD.seq, sleep: 0, asleep: false, stand: 1, calm: 0, fwd: V(0, 0, 1), yaw,
    det: {}, talk: 0, talkDur: 0, line: '', sy: 0, idleT: 6 + Math.random() * 10, mouth: .3, eye: 1, blink: 0, blinkT: 2 + Math.random() * 3, squash: 0, hitCd: 0, said: {}, floor: base.y };
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  RD_REST.forEach(([x, y, z], i) => { const p = V(base.x + x * c + z * sn, base.y + y, base.z - x * sn + z * c); rd.P.push({ p, o: p.clone(), r: RD_RAD[i], im: RD_IM[i], pin: null }); });
  const con = (a, b, k, g, em) => { const c2 = { a, b, L: rd.P[a].p.distanceTo(rd.P[b].p), k, g, em }; rd.C.push(c2); return c2; };
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) con(i, j, 'h');   // the torso is one solid piece
  const neck = con(4, 6, 's', 'head', RD_EXTRA); con(6, 0, 'a', 'head'); con(6, 1, 'a', 'head'); con(6, 5, 'a', 'head');
  rd.G.head = { cons: [neck], parts: [6], root: 4, ripped: false, pulled: false, ratio: 0, strain: 0, seepT: 0, said: 0 };
  for (const [s, side] of [[0, 'L'], [1, 'R']]) {
    const S = s, E = 7 + s, W = 9 + s, la = rd.P[S].p.distanceTo(rd.P[E].p), lb = rd.P[E].p.distanceTo(rd.P[W].p);
    const c1 = con(S, E, 's', 'arm' + side, RD_EXTRA * la / (la + lb)), c2 = con(E, W, 's', 'arm' + side, RD_EXTRA * lb / (la + lb));
    con(S, W, 'm', 'arm' + side).L = .22;
    rd.G['arm' + side] = { cons: [c1, c2], parts: [E, W], root: S, ripped: false, pulled: false, ratio: 0, strain: 0, seepT: 0, said: 0 };
  }
  for (let i = 11; i < 15; i++) { for (let j = 0; j < 6; j++) con(i, j, 'h'); if (i > 11) for (let j = 11; j < i; j++) con(i, j, 'h'); }   // the bean's bottom is part of the body
  // meshes: Thumpling parts in a random fur color
  const GE = rdGeo(L.fur), mk = (g, sh) => { const m = new THREE.Mesh(g, RD_BODY); m.castShadow = !!sh; return m; };
  const torso = new THREE.Group(); rd.g.add(torso); rd.torso = torso; torso.scale.setScalar(RD_DS);
  rwBody(rd, GE, mk);   // top + bottom half and the stretchy waist
  const seg = (a, b, thick) => { const s = rdMakeSeg(rd, a, b, null, true); const m = mk(GE.arm); m.scale.set(thick * RD_DS, s.L, thick * RD_DS); s.m.add(m); return s; };
  rd.neck = seg(4, 6, 1.9);
  const head = new THREE.Group(); rd.g.add(head); rd.head = head; const hm = mk(GE.head, 1); hm.rotation.y = Math.PI; hm.scale.setScalar(RD_DS); head.add(hm);
  rd.arms = {};
  for (const [s, side] of [[0, 'L'], [1, 'R']]) {
    const S = s, E = 7 + s, W = 9 + s;
    const up = seg(S, E, 1), fo = seg(E, W, 1);
    const el = mk(GE.elbow); el.scale.setScalar(RD_DS); fo.m.add(el);
    const hand = mk(GE.paw); hand.scale.set((side === 'L' ? -1 : 1) * RD_DS, RD_DS, RD_DS); rd.g.add(hand);
    rd.arms[side] = { up, fo, hand, E, W };
  }
  scene.add(rd.g); RD.list.push(rd);
  return rd;
}

/* ---------------- physics: soft verlet ragdoll, stretchy arms + neck ---------------- */
function rdSolve(rd, c) {
  const A = rd.P[c.a], B = rd.P[c.b];
  _rd.subVectors(B.p, A.p); const len = _rd.length() || 1e-6;
  let target = c.L, k = 1;
  if (c.k === 'm') { if (len >= c.L) return; }
  else if (c.k === 'w') { const e = len - c.L; if (e > 0) { if (e >= c.em) target = c.L + c.em; else k = rwSolveK(rd, c, e); } }   // the waist (cheese pull)
  else if (c.k === 'a') { const G = rd.G[c.g]; if (G.pulled || G.ripped) return; k = .12; }
  else if (c.k === 's') {
    const G = rd.G[c.g], e = len - c.L;
    if (e > 0) {
      if (e >= c.em) target = c.L + c.em;                 // stretched all the way: it's a tight rope now
      else k = G.ripped || !G.pulled ? .3 : c.g === 'head' ? .002 + .05 * (e / c.em) ** 2 : .02 + .3 * (e / c.em) ** 2;
    }
  }
  const hv = rd.heavy && c.k === 's' ? .2 : 1;   // pulling an arm/head: the body digs in, so the part stretches instead of the dummy just sliding over
  const wa = A.pin ? 0 : A.im * (c.a < 6 || c.a > 10 ? hv : 1), wb = B.pin ? 0 : B.im * (c.b < 6 || c.b > 10 ? hv : 1), w = wa + wb; if (!w) return;
  const d = (len - target) / len * k / w;
  A.p.addScaledVector(_rd, d * wa); B.p.addScaledVector(_rd, -d * wb);
}
function rdTorsoFrame(rd) {
  const P = rd.P; _rx.subVectors(P[1].p, P[0].p).normalize(); rd.pc = (rd.pc || V()).addVectors(P[2].p, P[3].p).multiplyScalar(.5);
  _ry.subVectors(P[4].p, rd.pc).normalize(); _rz.crossVectors(_rx, _ry).normalize(); _ry.crossVectors(_rz, _rx);
  rd.fwd.copy(_rz); rd.up = (rd.up || V()).copy(_ry); rd.rx = (rd.rx || V()).copy(_rx);
  if (Math.hypot(_rz.x, _rz.z) > .5) rd.yaw = Math.atan2(_rz.x, _rz.z);
}
const _stC = V();
function rdStand(rd) {   // a gentle "puppet string" that keeps the dummy standing up (and gets it back up after a flop)
  if (rd.stand <= .01) return;
  const P = rd.P, yaw = rd.anchor ? rd.anchor.yaw : rd.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
  _stC.addVectors(P[13].p, P[14].p).multiplyScalar(.5); const by = Math.min(P[13].p.y, P[14].p.y) - RD_REST[13][1];
  const fz = (RD_REST[13][2] + RD_REST[14][2]) / 2; _stC.x -= fz * sn; _stC.z -= fz * c;   // the "feet" sit a bit forward of the body's middle
  // once it has settled, it stands on a fixed spot (it used to creep along by itself, like it was walking)
  if (!rd.anchor && rd.calm > 2.5) rd.anchor = { x: _stC.x, z: _stC.z, yaw: rd.yaw };
  if (rd.anchor) { _stC.x = rd.anchor.x; _stC.z = rd.anchor.z; }
  for (let i = 0; i < 15; i++) {
    const q = P[i]; if (q.pin || rd.det[i]) continue;
    const [x, y, z] = RD_REST[i], k = RD_STAND_K[i] * rd.stand;
    q.p.x += (_stC.x + x * c + z * sn - q.p.x) * k; q.p.y += (by + y - q.p.y) * k; q.p.z += (_stC.z - x * sn + z * c - q.p.z) * k;
  }
}
function rdStep(rd, h) {
  const P = rd.P, gdrop = 9.8 * h * h; let mv = 0;
  for (const q of P) {
    if (q.pin) { q.o.copy(q.p); q.p.copy(q.pin); mv = 1; continue; }
    _rv.subVectors(q.p, q.o).multiplyScalar(rd.heldNow ? .9 : .993); if (_rv.lengthSq() > .09) _rv.setLength(.3);   // held: calm it down so it can't spin like a top
    q.o.copy(q.p); q.p.add(_rv); q.p.y -= gdrop; mv = Math.max(mv, _rv.lengthSq());
  }
  rdStand(rd);
  for (let it = 0; it < 6; it++) for (const c of rd.C) rdSolve(rd, c);
  rdSelfHit(rd);
  let low = 1e9;
  for (const q of P) {
    if (q.pin) continue;
    _rinfo.nrm.set(0, 0, 0); _rinfo.ground = false;
    if (pushOut(q.p, q.r, _rinfo)) {   // touching the world: friction so they don't slide around like soap
      const n = _rinfo.nrm.normalize(); _rv.subVectors(q.p, q.o); const vn = _rv.dot(n);
      _rv.addScaledVector(n, -vn).multiplyScalar(.6); if (vn > 0) _rv.addScaledVector(n, vn * .3);
      q.o.subVectors(q.p, _rv);
    }
    low = Math.min(low, q.p.y - q.r);
  }
  rd.floor = low;
  // sleeping when nothing moves (saves Quest frames)
  if (mv < 4e-7 && !RD.held.some(x => x && x.rd === rd)) { if (++rd.sleep > 90) rd.asleep = true; } else rd.sleep = 0;
  // stretch + rip
  for (const gname in rd.G) {
    const G = rd.G[gname]; if (G.ripped) continue;
    let e = 0; for (const c of G.cons) e += Math.max(0, rd.P[c.a].p.distanceTo(rd.P[c.b].p) - c.L);
    G.ratio = e / RD_EXTRA;
    // the harder (and longer) you tug, the sooner the seam gives: a big yank rips fast, a steady pull takes a couple of seconds
    const thr = gname === 'head' ? .3 : .5, rate = gname === 'head' ? 4 : 2;   // Isaiah: heads were too much of a struggle
    if (G.pulled && G.ratio > thr) G.strain += h * (G.ratio - thr) * rate; else G.strain = Math.max(0, G.strain - h);
    if (G.strain > .55) rdRip(rd, gname);
  }
  rwStrain(rd, h);
}
// Isaiah: "each part of the dummy's bodies should have collision so they don't go through each other"
// every body ball keeps out of the others (except ones that are joined, or that already overlap when standing normally)
function rdPairs(rd) {
  if (rd.pairs && rd.pairsN === rd.P.length + rd.C.length) return rd.pairs;
  const P = rd.P, n = P.length, joined = new Set(rd.C.map(c => Math.min(c.a, c.b) * 64 + Math.max(c.a, c.b))), out = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    if (a < 6 && b < 6) continue;                              // the torso is one solid piece already
    if (joined.has(a * 64 + b)) continue;
    let m = P[a].r + P[b].r;
    if (a < RD_REST.length && b < RD_REST.length) { const A = RD_REST[a], B = RD_REST[b], rest = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); m = Math.min(m, rest * .9); }
    if (m > .02) out.push(a, b, m);
  }
  rd.pairs = out; rd.pairsN = n + rd.C.length; return out;
}
function rdPush(A, B, m) {
  _rd.subVectors(B.p, A.p); const d2 = _rd.lengthSq(); if (d2 >= m * m || d2 < 1e-10) return;
  const d = Math.sqrt(d2), wa = A.pin ? 0 : A.im, wb = B.pin ? 0 : B.im, w = wa + wb; if (!w) return;
  const k = (m - d) / d / w; A.p.addScaledVector(_rd, -k * wa); B.p.addScaledVector(_rd, k * wb);
}
function rdSelfHit(rd) { const pr = rdPairs(rd), P = rd.P; for (let i = 0; i < pr.length; i += 3) rdPush(P[pr[i]], P[pr[i + 1]], pr[i + 2]); }
function rdBetween() {   // dummies bump into each other too
  const L = RD.list;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; if (a.asleep && b.asleep) continue;
    if (a.P[0].p.distanceToSquared(b.P[0].p) > 4) continue;
    let hit = false;
    for (const p of a.P) for (const q of b.P) { const m = p.r + q.r; if (p.p.distanceToSquared(q.p) < m * m) { rdPush(p, q, m); hit = true; } }
    if (hit) { a.asleep = b.asleep = false; a.sleep = b.sleep = 0; }
  }
}
function rdRip(rd, gname) {
  const G = rd.G[gname], P = rd.P, root = P[G.root], n = P.length;
  P.push({ p: root.p.clone(), o: root.o.clone(), r: .045, im: 1, pin: null });
  const first = G.cons[0]; first.a = n; G.ripped = true; G.parts.push(n);
  rd.C = rd.C.filter(c => !(c.g === gname && (c.k === 'a' || c.k === 'm')));
  G.parts.forEach(i => { rd.det[i] = true; });
  rd.det[n] = true;
  const isHead = gname === 'head', side = gname.slice(3);
  // stumps: one on the body, one on the part that came off
  const cap = (parent, x, y, z, rx, rz, s) => { const m = new THREE.Mesh(rdCapG(), RD_MAT); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.scale.setScalar(s); parent.add(m); rd.caps.push(m); };
  if (isHead) { cap(rd.torso, 0, .46, 0, 0, 0, .09); rd.neck.a = n; rd.neck.pf = rd.fwd.clone(); cap(rd.neck.m, 0, 0, 0, Math.PI, 0, .09 * RD_DS); rd.headPf = rd.fwd.clone(); }
  else {
    const A = rd.arms[side], sx = side === 'L' ? -1 : 1; cap(rd.torso, sx * .235, .325, -.02, 0, -sx * Math.PI / 2, .07);
    A.up.a = n; A.up.pf = rd.fwd.clone(); A.fo.pf = rd.fwd.clone(); cap(A.up.m, 0, 0, 0, Math.PI, 0, .06 * RD_DS);
  }
  // burst
  _rv.subVectors(root.p, rd.pc || root.p); if (_rv.lengthSq() < 1e-6) _rv.set(0, 1, 0); _rv.normalize();
  rdBurst(root.p, _rv, HZ.on ? 22 : 30, rd.floor);
  if (HZ.on) splatAdd(root.p.x + _rv.x * .3, rd.floor, root.p.z + _rv.z * .3, .2 + Math.random() * .1);
  const hld = RD.held.find(x => x && x.rd === rd && G.parts.includes(x.i)); if (hld && hld.h) buzz(hld.h, 1, 120);
  if (ac) {
    if (HZ.on) { noiseHit(ac.currentTime, .25, .35, 'lowpass', 600, 1.2); tone('sawtooth', 140, 50, .25, .12); tone('square', 90, 40, .12, .1, .05); }
    else { noiseHit(ac.currentTime, .18, .3, 'bandpass', 2600, 1.4); tone('triangle', 700, 220, .18, .15); tone('sine', 300, 900, .12, .1, .08); }
  }
  if (!RD.toldRip) { RD.toldRip = true; toast(HZ.on ? '🦴 RIIIP! Meat and bones everywhere...' : '🧸 RIIIP! Cotton everywhere! Press H (right stick in VR) to fix them.', 4); }
}
function rdPulled(rd) {
  let pinBody = false, any = false;
  for (const g in rd.G) rd.G[g].pulled = false;
  RD.held.forEach(x => { if (!x || x.rd !== rd) return; any = true; for (const g in rd.G) if (rd.G[g].parts.includes(x.i)) rd.G[g].pulled = true; if (x.i < 6) pinBody = true; });
  rwPulled(rd);
  return { any, pinBody: pinBody || rd.W.pulled };
}

/* ---------------- drawing the bodies ---------------- */
function rdOrient(m, pa, pb, fwd, L, stretch, out) {
  _ry.subVectors(pb, pa); const len = _ry.length() || 1e-6; _ry.multiplyScalar(1 / len);
  _rx.crossVectors(_ry, fwd); if (_rx.lengthSq() < 1e-6) _rx.set(1, 0, 0).cross(_ry); _rx.normalize(); _rz.crossVectors(_rx, _ry);
  _rm.makeBasis(_rx, _ry, _rz); m.quaternion.setFromRotationMatrix(_rm); m.position.copy(pa);
  const s = stretch ? len / L : 1, t = stretch ? clamp(1 / Math.sqrt(Math.max(s, 1e-3)), .55, 1.15) : 1;
  m.scale.set(t, stretch ? s : 1, t); if (out) out.copy(_rz);
  return s;
}
function rdTransport(pf, a, b) { _ry.subVectors(b, a).normalize(); pf.addScaledVector(_ry, -pf.dot(_ry)); if (pf.lengthSq() < 1e-6) pf.set(1, 0, 0).cross(_ry); pf.normalize(); return pf; }
function rdDraw(rd, dt) {
  const P = rd.P; rdTorsoFrame(rd);
  rwPlace(rd);
  for (const s of rd.segs) {
    const f = s.pf ? rdTransport(s.pf, P[s.a].p, P[s.b].p) : rd.fwd;
    rdOrient(s.m, P[s.a].p, P[s.b].p, f, s.L, s.stretch);
  }
  for (const side of ['L', 'R']) {   // hands follow their forearm
    const A = rd.arms[side]; A.hand.position.copy(P[A.W].p); A.hand.quaternion.copy(A.fo.m.quaternion);
  }
  // head sits on the neck and leans with it. Pulled by the head? The head stretches too.
  const nk = P[rd.neck.a].p, hd = P[6].p, hf = rd.headPf ? rdTransport(rd.headPf, nk, hd) : rd.fwd;
  rdOrient(rd.head, nk, hd, hf, 1, false); rd.head.position.copy(hd);
  const G = rd.G.head, hs = G.ripped ? 0 : clamp(G.ratio, 0, 1);
  rd.squash = Math.max(0, rd.squash - dt * 3);
  const sq = rd.squash > 0 ? 1 - Math.sin(rd.squash * Math.PI) * .35 : 1;
  rd.head.scale.set((1 - hs * .15) / Math.sqrt(sq), (1 + hs * .5) * sq, (1 - hs * .15) / Math.sqrt(sq));
}

/* ---------------- stuffing / gore bits (one instanced mesh, cheap on Quest) ---------------- */
const RFX = { N: 300, i: 0, live: 0 };
{
  RFX.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: .9 }), RFX.N);
  RFX.mesh.frustumCulled = false; RFX.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(RFX.mesh);
  RFX.p = new Float32Array(RFX.N * 3); RFX.v = new Float32Array(RFX.N * 3); RFX.s = new Float32Array(RFX.N * 3); RFX.life = new Float32Array(RFX.N);
  RFX.floor = new Float32Array(RFX.N); RFX.kind = new Uint8Array(RFX.N); RFX.g = new Float32Array(RFX.N); RFX.drag = new Float32Array(RFX.N); RFX.q = [];
  const z = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color(1, 1, 1);
  for (let i = 0; i < RFX.N; i++) { RFX.mesh.setMatrixAt(i, z); RFX.mesh.setColorAt(i, c); RFX.q.push(new THREE.Quaternion()); }
}
function rfxAdd(p, v, sx, sy, sz, color, life, grav, drag, floor, kind = 0) {
  const i = RFX.i; RFX.kind[i] = kind; RFX.i = (RFX.i + 1) % RFX.N; const k = i * 3;
  RFX.p[k] = p.x; RFX.p[k + 1] = p.y; RFX.p[k + 2] = p.z; RFX.v[k] = v.x; RFX.v[k + 1] = v.y; RFX.v[k + 2] = v.z;
  RFX.s[k] = sx; RFX.s[k + 1] = sy; RFX.s[k + 2] = sz; RFX.life[i] = life; RFX.g[i] = grav; RFX.drag[i] = drag; RFX.floor[i] = floor;
  RFX.q[i].setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
  RFX.mesh.setColorAt(i, _rfC.set(color)); RFX.mesh.instanceColor.needsUpdate = true; RFX.live = Math.max(RFX.live, 1);
}
const _rfC = new THREE.Color(), _rfV = V(), _rfP = V(), _rfS = V(), _rfM = new THREE.Matrix4();
// horror mode: dark red splats on the floor where the gore lands (one instanced mesh, they fade after a minute)
const SPL = { N: 140, i: 0, life: new Float32Array(140), s: new Float32Array(140), live: 0 };
{
  const parts = [new THREE.CircleGeometry(1, 14)];
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + Math.random() * .5, r = .75 + Math.random() * .45, g = new THREE.CircleGeometry(.22 + Math.random() * .25, 8); g.translate(Math.cos(a) * r, Math.sin(a) * r, 0); parts.push(g); }
  for (let i = 0; i < 5; i++) { const a = Math.random() * 6.3, r = 1.35 + Math.random() * .5, g = new THREE.CircleGeometry(.07 + Math.random() * .1, 6); g.translate(Math.cos(a) * r, Math.sin(a) * r, 0); parts.push(g); }
  const geo = mergeGeometries(parts); geo.rotateX(-Math.PI / 2);
  SPL.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x6a070c, roughness: .35, metalness: .1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), SPL.N);
  SPL.mesh.frustumCulled = false; SPL.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(SPL.mesh);
  const z = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color(1, 1, 1); for (let i = 0; i < SPL.N; i++) { SPL.mesh.setMatrixAt(i, z); SPL.mesh.setColorAt(i, c); }
}
const _spQ = new THREE.Quaternion(), _spY = V(0, 1, 0);
function splatAdd(x, y, z, size) {
  const i = SPL.i; SPL.i = (SPL.i + 1) % SPL.N; SPL.life[i] = 60; SPL.s[i] = size; SPL.live = 1;
  _spQ.setFromAxisAngle(_spY, Math.random() * 6.3); _rfM.compose(_rfP.set(x, y + .004 + Math.random() * .002, z), _spQ, _rfS.set(size, 1, size * (.7 + Math.random() * .5)));
  SPL.mesh.setMatrixAt(i, _rfM); SPL.mesh.setColorAt(i, _rfC.setHSL(.99, .85, .2 + Math.random() * .12)); SPL.mesh.instanceMatrix.needsUpdate = true; SPL.mesh.instanceColor.needsUpdate = true;
}
function splatStep(dt) {
  if (!SPL.live) return; let any = 0, ch = false;
  for (let i = 0; i < SPL.N; i++) { if (SPL.life[i] <= 0) continue; any = 1; SPL.life[i] -= dt;
    if (SPL.life[i] < 2) { SPL.mesh.getMatrixAt(i, _rfM); _rfM.decompose(_rfP, _spQ, _rfS); const k = Math.max(0, SPL.life[i] / 2) * SPL.s[i]; _rfS.x = _rfS.z = k; _rfM.compose(_rfP, _spQ, _rfS); SPL.mesh.setMatrixAt(i, _rfM); ch = true; } }
  if (ch) SPL.mesh.instanceMatrix.needsUpdate = true; if (!any) SPL.live = 0;
}
function rdBurst(pos, dir, n, floor) {
  for (let i = 0; i < n; i++) {
    _rfV.set(Math.random() - .5, Math.random() - .3, Math.random() - .5).multiplyScalar(1.6).addScaledVector(dir, 1 + Math.random() * 1.6); _rfV.y += .8;
    if (HZ.on) {
      const bone = i % 5 === 0, s = .012 + Math.random() * .018;
      if (bone) rfxAdd(pos, _rfV, .009, .03 + Math.random() * .02, .009, Math.random() < .5 ? 0xefe6d2 : 0xe2d6bc, 14, 9.8, .3, floor);
      else rfxAdd(pos, _rfV, s, s * (.6 + Math.random() * .5), s, pick([0x7a0f14, 0x9b1b1f, 0x5a080c, 0xb83a3a, 0x8e1418, 0xd98a8a]), 14, 9.8, .3, floor, 1);
    } else {
      const s = .014 + Math.random() * .02; _rfV.multiplyScalar(.8); _rfV.y -= .5;
      rfxAdd(pos, _rfV, s, s * (.75 + Math.random() * .3), s, pick([0xffffff, 0xf7f3ea, 0xece6d8]), 16 + Math.random() * 6, 3.2, 1.8, floor);
    }
  }
}
function rfxStep(dt) {
  if (!RFX.live) return; let any = 0;
  for (let i = 0; i < RFX.N; i++) {
    if (RFX.life[i] <= 0) continue; const k = i * 3;
    if ((RFX.life[i] -= dt) <= 0) { RFX.mesh.setMatrixAt(i, _rfM.makeScale(0, 0, 0)); continue; }
    any = 1;
    const dr = Math.exp(-RFX.drag[i] * dt); RFX.v[k] *= dr; RFX.v[k + 1] = RFX.v[k + 1] * dr - RFX.g[i] * dt; RFX.v[k + 2] *= dr;
    RFX.p[k] += RFX.v[k] * dt; RFX.p[k + 1] += RFX.v[k + 1] * dt; RFX.p[k + 2] += RFX.v[k + 2] * dt;
    const fl = RFX.floor[i] + RFX.s[k + 1];
    if (RFX.p[k + 1] < fl) { RFX.p[k + 1] = fl; if (RFX.kind[i] && Math.random() < .55) splatAdd(RFX.p[k], fl - RFX.s[k + 1], RFX.p[k + 2], .03 + Math.random() * .07); RFX.kind[i] = 0; RFX.v[k + 1] *= -.15; RFX.v[k] *= .5; RFX.v[k + 2] *= .5; }
    const sh = Math.min(1, RFX.life[i] / .6);
    _rfM.compose(_rfP.set(RFX.p[k], RFX.p[k + 1], RFX.p[k + 2]), RFX.q[i], _rfS.set(RFX.s[k] * sh, RFX.s[k + 1] * sh, RFX.s[k + 2] * sh)); RFX.mesh.setMatrixAt(i, _rfM);
  }
  RFX.mesh.instanceMatrix.needsUpdate = true; if (!any) RFX.live = 0;
}

/* ---------------- the hammer ---------------- */
const HM = { g: null, held: null, a: V(), ao: V(), b: V(), bo: V(), pf: V(1, 0, 0), head: V(), last: V(), vel: V(), on: false, swing: -1, cd: 0, L: .5 };
{   // a sledgehammer: long wooden handle, heavy steel block head
  const box = (w, h, d, r) => { const g = new RoundedBoxGeometry(w, h, d, 2, r); g.deleteAttribute('uv'); return g; };
  const P = [rdCol(rdT(new THREE.CylinderGeometry(.016, .021, .62, 10), 0, .2, 0), 0xa8743f), rdCol(rdT(new THREE.CylinderGeometry(.023, .023, .16, 10), 0, -.03, 0), 0x3a2a22),
    rdCol(rdT(rdS(.025, 10, 6), 0, -.11, 0), 0x3a2a22),
    rdCol(rdT(box(.24, .1, .1, .018), 0, HM.L, 0), 0x6f747c),
    ...[-1, 1].map(s => rdCol(rdT(box(.02, .085, .085, .01), s * .125, HM.L, 0), 0xa9adb4)),
    rdCol(rdT(box(.06, .112, .112, .01), 0, HM.L, 0), 0x4a4e55)].map(g => g.index ? g.toNonIndexed() : g);
  P.forEach(g => { if (g.attributes.uv) g.deleteAttribute('uv'); });
  HM.g = new THREE.Mesh(rdMerge(P), RD_MAT); HM.g.castShadow = true; HM.g.visible = false; scene.add(HM.g);
}
function hmPlace(p) { HM.on = true; HM.g.visible = true; HM.a.copy(p); HM.ao.copy(p); HM.b.copy(p).add(_rv.set(HM.L, 0, 0)); HM.bo.copy(HM.b); HM.pf.set(0, 1, 0); }
function hmTake(h) { if (HM.held && HM.held !== h) HM.held.hammer = false; HM.held = h; h.hammer = true; buzz(h, .7, 50); if (ac) tone('triangle', 500, 800, .1, .1);
  if (!RD.toldHammer) { RD.toldHammer = true; toast(state.xr ? '🔨 Got the hammer! Swing it at a dummy. Let go of grip to drop it.' : IS_TOUCH ? '🔨 Got the hammer! ⚔️ Use = swing, ✋ Grab = drop.' : '🔨 Got the hammer! Click to swing, E to drop it.', 5); } }
function hmDrop(throwV) {
  const h = HM.held; if (!h) return; h.hammer = false; HM.held = null;
  const v = throwV || HM.vel; HM.ao.copy(HM.a).addScaledVector(v, -RD_STEP); HM.bo.copy(HM.b).addScaledVector(v, -RD_STEP);
}
const _hmQ = new THREE.Quaternion(), _hp = V(), _hE = new THREE.Euler();
function hmStep(dt) {
  if (!HM.on) return;
  HM.cd -= dt;
  const h = HM.held;
  if (h && state.xr) { vrPose(h, _hp, _hmQ); HM.g.position.copy(_hp); HM.g.quaternion.copy(_hmQ); }
  else if (h) {   // PC / phone: held in front of you, click swings it down
    let th = .55, reach = 0;
    if (HM.swing >= 0) { HM.swing += dt; const t = HM.swing; reach = t < .16 ? 0 : t < .3 ? (t - .16) / .14 : t < .6 ? 1 - (t - .3) / .3 : 0; th = t < .16 ? .55 + (-.25 - .55) * (t / .16) : t < .3 ? -.25 + 2.15 * ((t - .16) / .14) ** 1.5 : t < .6 ? 1.9 - 1.35 * ((t - .3) / .3) : .55; if (t >= .6) HM.swing = -1; }
    headWorld(_hp); camera.getWorldQuaternion(_hmQ);
    HM.g.position.copy(_rv.set(.3 - reach * .2, -.42 + reach * .1, -.5 - reach * .7).applyQuaternion(_hmQ)).add(_hp);
    HM.g.quaternion.copy(_hmQ).multiply(new THREE.Quaternion().setFromEuler(_hE.set(-th, 0, .15)));
  }
  if (h) {
    HM.g.updateMatrixWorld(); HM.last.copy(HM.head); HM.head.set(0, HM.L, 0).applyMatrix4(HM.g.matrixWorld);
    HM.vel.subVectors(HM.head, HM.last).multiplyScalar(1 / Math.max(dt, 1e-3)); if (!HM.wasHeld) HM.vel.set(0, 0, 0);
    HM.a.copy(HM.g.position); HM.b.copy(HM.head); HM.wasHeld = true;
    hmHit();
    return;
  }
  HM.wasHeld = false;
  // lying around: a little two-point verlet stick
  for (const [p, o, r] of [[HM.a, HM.ao, .03], [HM.b, HM.bo, .085]]) {
    _rv.subVectors(p, o).multiplyScalar(.99); o.copy(p); p.add(_rv); p.y -= 9.8 * dt * dt;
    _rinfo.nrm.set(0, 0, 0); if (pushOut(p, r, _rinfo)) { const n = _rinfo.nrm.normalize(); _rv.subVectors(p, o); const vn = _rv.dot(n); _rv.addScaledVector(n, -vn).multiplyScalar(.5); if (vn > 0) _rv.addScaledVector(n, vn * .25); o.subVectors(p, _rv); }
  }
  _rd.subVectors(HM.b, HM.a); const len = _rd.length() || 1e-6, d = (len - HM.L) / len * .5; HM.a.addScaledVector(_rd, d); HM.b.addScaledVector(_rd, -d);
  rdOrient(HM.g, HM.a, HM.b, rdTransport(HM.pf, HM.a, HM.b), HM.L, false);
  if (HM.a.y < -60) hmPlace(V(rig.position.x, rig.position.y + 1, rig.position.z));
}
function hmHit() {
  const sp = HM.vel.length(); if (sp < 1.4) return;
  for (const rd of RD.list) {
    if (rd.hitCd > 0) continue;
    let hit = -1, bd = 1e9;
    rd.P.forEach((q, i) => { const d = q.p.distanceTo(HM.head) - q.r - (state.xr ? .11 : .16); if (d < 0 && d < bd) { bd = d; hit = i; } });
    if (hit < 0) continue;
    rd.hitCd = .25; rd.asleep = false; rd.sleep = 0; rd.calm = 0; rd.anchor = null; if (sp > 3) rd.stand = 0;
    const k = Math.min(sp, 9) * .85 * RD_STEP, hp = rd.P[hit].p;
    for (const q of rd.P) { if (q.pin) continue; const d = q.p.distanceTo(hp), f = d < .01 ? 1 : clamp(1 - d / .45, 0, 1) * .6; if (f > 0) { q.o.copy(q.p).addScaledVector(HM.vel, -k * f / Math.max(sp, 1e-3) * Math.min(sp, 9)); } }
    if (hit === 6) rd.squash = 1;
    if (ac) { tone('sine', 260, 90, .16, clamp(sp / 18, .06, .3)); noiseHit(ac.currentTime, .08, clamp(sp / 25, .05, .25), 'lowpass', 900, 1); if (!HZ.on) tone('triangle', 900, 1400, .08, .05, .03); }
    if (HM.held) buzz(HM.held, clamp(sp / 8, .3, 1), 50);
    _rv.copy(HM.vel).normalize().negate();
    if (sp > 2.5) { const n = Math.min(8, Math.floor(sp)); for (let i = 0; i < n; i++) { _rfV.set(Math.random() - .5, Math.random() * .8, Math.random() - .5).multiplyScalar(1.4).addScaledVector(_rv, .6);
      if (HZ.on) rfxAdd(hp, _rfV, .012, .01, .012, pick([0x7a0f14, 0x9b1b1f, 0xb83a3a]), 10, 9.8, .3, rd.floor, 1); else rfxAdd(hp, _rfV, .015, .012, .015, 0xffffff, 12, 3.2, 1.8, rd.floor); } }
  }  hmWorld(sp);
}
// Isaiah: "the sledgehammer doesn't interact with anything in the Slicing Yard": now it smashes glass and knocks cubes around
const _hmN = V(), _hmL = V(), _hmP = V();
function hmWorld(sp) {
  if (state.area !== 'arena') return;
  if (typeof GL !== 'undefined') for (const pane of GL.panes) {
    if (tAll - (pane.hmT || 0) < .3 || paneSdf(pane, HM.head, _hmN) > .075) continue;
    pane.hmT = tAll; toPane(pane, _hmP.copy(HM.head).sub(ARENA), _hmL);
    const r = glassHit(pane, clamp(_hmL.x, -pane.W / 2 + .03, pane.W / 2 - .03), clamp(_hmL.y, .05, pane.H - .05), sp * 1.7, HM.vel.clone(), { R: .17 });
    if (HM.held && r !== 'miss') buzz(HM.held, r === 'break' ? 1 : .6, 50);
  }
  if (typeof AR !== 'undefined' && AR.pieces) for (const pc of AR.pieces) {
    if (!pc.body || pc.dying || pc.held || pc.pane || tAll - (pc.hmT || 0) < .25) continue;
    _hmP.copy(HM.head).sub(ARENA);   // cube bodies live in yard coordinates
    const t = pc.body.translation(); if ((t.x - _hmP.x) ** 2 + (t.y - _hmP.y) ** 2 + (t.z - _hmP.z) ** 2 > (pc.rad + .07) ** 2) continue;
    if (typeof mine === 'function' && !mine(pc)) continue;
    // only a real touch counts (the bounding ball is bigger than the cube)
    toLocal(pc, _hmP, _hmL); if (outside(pc.parts, _hmL) > .07) continue;
    pc.hmT = tAll;
    // a hard smash knocks a chunk out of it where the hammer lands (Isaiah: "make a hole in the cubes")
    if (sp > 4.5 && !pc.inQ && pc.pop >= 1) {
      toLocal(pc, _hmN.copy(_hmP).addScaledVector(HM.vel, 1 / sp), _hmN); const n = _hmN.sub(_hmL).normalize();
      const w = widthAlong(pc, n), e = _hmL.clone().addScaledVector(n, Math.max(0, -outside(pc.parts, _hmL)) + clamp(w * .3, .03, .12));
      pc.inQ = true; AR.cutQ.push({ pc, lines: [[n.clone(), n.dot(e)]], bis: [], nMain: n.clone(), e, sp, extreme: false });
    }
    const m = pc.body.mass() * Math.min(sp, 10) * .7, d = _hmN.copy(HM.vel).normalize();
    pc.body.applyImpulseAtPoint({ x: d.x * m, y: d.y * m + m * .15, z: d.z * m }, { x: _hmP.x, y: _hmP.y, z: _hmP.z }, true);
    if (ac) { tone('sine', 220, 80, .14, clamp(sp / 20, .06, .25)); noiseHit(ac.currentTime, .06, clamp(sp / 30, .04, .2), 'bandpass', 1400, 1); }
    if (HM.held) buzz(HM.held, clamp(sp / 8, .3, 1), 40);
  }
}

/* ---------------- spawning, fixing, clearing ---------------- */
function rdGround(x, y0, z) { for (let y = y0 + .6; y > y0 - 5; y -= .05) { const h = pawHit(_rfP.set(x, y, z), .05); if (h && h.n.y > .5) return y - .05; } return null; }
function rdKill(rd) { scene.remove(rd.g); if (rd.W) rd.W.tube.geometry.dispose();   // shapes are cached per fur color and shared, nothing to free
  RD.held.forEach((x, i) => { if (x && x.rd === rd) RD.held[i] = null; }); RD.list.splice(RD.list.indexOf(rd), 1); }
function rdSpawn() {
  if (state.mode !== 'play') return;
  if (!AV.tpl) { toast('🧸 Dummies are still loading, try again in a sec!', 2.5); return; }
  if (state.area === 'grove') { toast('🧸 No dummies in the lobby! Go to the Slicing Yard (DUMMY TEST sign).', 3.5); return; }   // Isaiah: keep the lobby dummy-free
  audioOn();
  if (RD.list.length >= RD.MAX) rdKill(RD.list[0]);
  headWorld(_hp); camera.getWorldDirection(_rd); _rd.y = 0; if (_rd.lengthSq() < 1e-4) _rd.set(0, 0, -1); _rd.normalize();
  const base = _hp.clone().addScaledVector(_rd, 1 + Math.random() * .3).add(_rv.set(-_rd.z, 0, _rd.x).multiplyScalar((Math.random() - .5) * .6));
  const gy = rdGround(base.x, _hp.y, base.z); base.y = (gy === null ? _hp.y - .9 : gy) + .06;
  const rd = rdSpawnAt(base, Math.atan2(_hp.x - base.x, _hp.z - base.z));
  rdTorsoFrame(rd); rdDraw(rd, 0);
  rdBurst(_rv.copy(base).add(V(0, .7, 0)), V(0, 1, 0), 10, base.y);   // poof!
  if (ac) { tone('triangle', 400, 1000, .15, .15); tone('sine', 800, 1600, .1, .08, .08); }
  if (!HM.on) hmPlace(base.clone().add(_rv.set(-_rd.z, 0, _rd.x).multiplyScalar(.55)).setY(base.y + .5));
  if (!RD.told) { RD.told = true; store.set('kg-rd', '1');
    toast(state.xr ? '🧸 Squeeze grip on an arm or the head and PULL! 🔨 Grab the hammer too.' : IS_TOUCH ? '🧸 Aim at an arm or head, tap ✋ Grab, then walk back to pull! ✋ on the 🔨 hammer takes it.'
      : '🧸 Hold click on an arm or head and pull away (walk back, mouse wheel = reel). E grabs the 🔨 hammer.', 7); }
}
function rdReset() {
  if (!RD.list.length) { toast('🧸 No dummies yet! Spawn one first.', 2.5); return; }
  const olds = RD.list.slice();
  for (const o of olds) {
    const pc = o.home ? o.home.clone() : o.pc ? o.pc.clone() : o.P[0].p.clone(), gy = o.home ? o.home.y - .06 : rdGround(pc.x, pc.y + .4, pc.z), base = V(pc.x, (gy === null ? o.floor : gy) + .06, pc.z);
    const look = o.look, yaw = o.home ? o.homeYaw : o.yaw, home = o.home, hy = o.homeYaw; rdKill(o);
    const rd = rdSpawnAt(base, yaw, look); rd.home = home; rd.homeYaw = hy; rdTorsoFrame(rd); rdDraw(rd, 0);
    rdBurst(_rv.copy(base).add(V(0, .5, 0)), V(0, 1, 0), 8, base.y);
  }
  for (let i = 0; i < RFX.N; i++) RFX.life[i] = Math.min(RFX.life[i], .5);   // tidy up the mess
  for (let i = 0; i < SPL.N; i++) SPL.life[i] = Math.min(SPL.life[i], 1.5);
  if (HM.on && !HM.held) { headWorld(_hp); camera.getWorldDirection(_rd); _rd.y = 0; _rd.normalize(); const p = _hp.clone().addScaledVector(_rd, .7); p.y = (rdGround(p.x, _hp.y, p.z) ?? _hp.y - 1) + .3; hmPlace(p); }
  if (ac) [523, 659, 784].forEach((f, i) => tone('triangle', f, f, .15, .1, i * .07));
  toast('🔧 All dummies fixed!', 2);
}
function rdClear() {
  if (!RD.list.length && !HM.on) return;
  while (RD.list.length) rdKill(RD.list[0]);
  for (let i = 0; i < RFX.N; i++) RFX.life[i] = Math.min(RFX.life[i], .3);
  for (let i = 0; i < SPL.N; i++) SPL.life[i] = Math.min(SPL.life[i], 1);
  if (HM.held) hmDrop(V()); HM.on = false; HM.g.visible = false;
  if (ac) tone('sine', 600, 150, .25, .12); toast('🗑️ Dummies cleared!', 2);
}

/* ---------------- grabbing ---------------- */
function rdGrabAt(slot, rd, i, h, src, off) {
  RD.held[slot] = { rd, i, h, src, off: off || V(), t: V().copy(rd.P[i].p) };
  rd.asleep = false; rd.sleep = 0; rd.calm = 0;
  if (i < 6) rd.stand = 0;
  if (ac) tone('sine', 520 + Math.random() * 200, 900, .09, .08);
}
function rdRelease(slot) {
  const x = RD.held[slot]; if (!x) return false; RD.held[slot] = null;
  const q = x.rd.P[x.i]; q.pin = null; _rv.subVectors(q.p, q.o); if (_rv.length() > .15) q.o.copy(q.p).addScaledVector(_rv.setLength(.15), -1);
  return true;
}
function rdGrab(h) {   // VR grip
  if (!h.tracked || RD.held[h.i] || h.hammer || h.saw) return false;
  if (sawGrab(h)) return true;
  if (HM.on && !HM.held) { const d = distToSeg(h.pos, HM.a, HM.b); if (d < .1) { hmTake(h); return true; } }
  let best = null, bd = .1;
  for (const rd of RD.list) rd.P.forEach((q, i) => { const d = q.p.distanceTo(h.pos) - q.r; if (d < bd) { bd = d; best = [rd, i]; } });
  if (!best) return false;
  rdGrabAt(h.i, best[0], best[1], h, 'vr', V().subVectors(best[0].P[best[1]].p, h.pos)); buzz(h, .6, 40); return true;
}
function rdDrop(h) {
  if (SAW.held === h) { sawDrop(); return true; }
  if (HM.held === h) { hmDrop(); return true; }
  if (RD.held[h.i] && RD.held[h.i].src === 'vr') return rdRelease(h.i);
  return false;
}
function distToSeg(p, a, b) { _rd.subVectors(b, a); const t = clamp(_rv.subVectors(p, a).dot(_rd) / _rd.lengthSq(), 0, 1); return _rv.copy(a).addScaledVector(_rd, t).distanceTo(p); }
function rdAim(maxD = 3) {   // PC / phone: what part are you looking at?
  headWorld(_hp); camera.getWorldDirection(_rd); let best = null, ba = 1e9;
  for (const rd of RD.list) rd.P.forEach((q, i) => { _rv.subVectors(q.p, _hp); const along = _rv.dot(_rd); if (along <= 0 || along > maxD) return; const off = Math.sqrt(Math.max(0, _rv.lengthSq() - along * along)); if (off < q.r + .05 + along * .03 && along < ba) { ba = along; best = [rd, i, along]; } });
  return best;
}
function hmAimed() { if (!HM.on || HM.held) return false; headWorld(_hp); camera.getWorldDirection(_rd); _rv.addVectors(HM.a, HM.b).multiplyScalar(.5).sub(_hp); const al = _rv.dot(_rd); if (al <= 0 || al > 2.8) return false; return Math.sqrt(Math.max(0, _rv.lengthSq() - al * al)) < .25 + al * .03; }
function rdDesk() {   // E key / phone ✋: toggle-grab what you aim at, or take/drop the hammer
  if (state.xr) return false; const h = hands[1];
  if (sawDesk()) return true;
  if (HM.held === h) { camera.getWorldQuaternion(_hmQ); hmDrop(V(0, 1, -3).applyQuaternion(_hmQ)); return true; }
  if (RD.held[1]) { rdRelease(1); return true; }
  if (hmAimed() && !h.sword && !BR.held[1]) { hmTake(h); return true; }
  const a = rdAim(); if (!a) return false;
  RD.pcDist = clamp(a[2], .5, 3); rdGrabAt(1, a[0], a[1], null, 'toggle'); return true;
}
canvas.addEventListener('pointerdown', e => {
  if (state.mode !== 'play' || state.xr || e.button !== 0 || CS.on || (document.pointerLockElement !== canvas && !state.touch)) return;
  if (!state.touch && e.pointerId !== 999 && PUNCH.lockedAt && performance.now() - PUNCH.lockedAt < 150) return;
  const h = hands[1];
  if (sawPointer(e)) { e.stopImmediatePropagation(); return; }
  if (HM.held === h) { if (HM.swing < 0) { HM.swing = 0; if (ac) noiseHit(ac.currentTime, .12, .05, 'bandpass', 700, .8); } e.stopImmediatePropagation(); return; }
  if (RD.held[1]) { rdRelease(1); e.stopImmediatePropagation(); return; }
  if (h.sword || BR.held[1] || hands.some(x => x.piece || x.cup)) return;
  if (hmAimed()) { hmTake(h); e.stopImmediatePropagation(); return; }
  const a = rdAim(); if (!a) return;
  RD.pcDist = clamp(a[2], .5, 3); rdGrabAt(1, a[0], a[1], null, e.pointerId === 999 ? 'toggle' : 'mouse'); e.stopImmediatePropagation();
}, true);
addEventListener('pointerup', e => { if (e.button === 0 && RD.held[1] && RD.held[1].src === 'mouse') rdRelease(1); });
addEventListener('wheel', e => { if (RD.held[1] && !state.xr) RD.pcDist = clamp(RD.pcDist - e.deltaY * .0015, .4, 3.2); }, { passive: true });
addEventListener('keydown', e => {
  if (state.xr || state.mode !== 'play' || (document.activeElement && document.activeElement.tagName === 'INPUT')) return;
  if (e.code === 'KeyG') rdSpawn(); if (e.code === 'KeyH') rdReset(); if (e.code === 'KeyJ') rdClear();
});

/* ---------------- 🧸 button + little menu for PC and phones ---------------- */
(() => {
  const st = document.createElement('style');
  st.textContent = `#rdBtn{position:fixed;right:14px;top:226px;z-index:55;width:52px;height:52px;border-radius:50%;border:0;font-size:28px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.3);display:none;cursor:pointer}
  #rdHtml{position:fixed;right:76px;top:200px;z-index:60;display:none;width:min(250px,70vw);padding:12px;border-radius:18px;background:#fff8ef;box-shadow:0 8px 30px rgba(0,0,0,.35);font-family:"Lilita One",Impact,sans-serif}
  #rdHtml h3{margin:0 0 6px;text-align:center;font-size:24px;color:#e2453c}#rdHtml button{display:block;width:100%;margin:6px 0;padding:10px 12px;border:0;border-radius:12px;background:#ffd9a8;font:inherit;font-size:18px;cursor:pointer;text-align:left}
  #rdHtml button:active{transform:scale(.97)}#rdHtml small{display:block;text-align:center;font-family:Fredoka,system-ui,sans-serif;font-size:12px;color:#7a6a5a}`;
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'rdBtn'; b.textContent = '🧸'; document.body.appendChild(b);
  const d = document.createElement('div'); d.id = 'rdHtml';
  d.innerHTML = `<h3>🧸 Dummies</h3><button data-a="s">➕ Spawn one${IS_TOUCH ? '' : ' (G)'}</button><button data-a="r">🔧 Fix them all${IS_TOUCH ? '' : ' (H)'}</button><button data-a="c">🗑️ Clear${IS_TOUCH ? '' : ' (J)'}</button><button data-a="p">📌 Pin what I aim at${IS_TOUCH ? '' : ' (right-click)'}</button><small>${IS_TOUCH ? 'Aim + ✋ Grab an arm or head, walk back to pull!' : 'Hold click on an arm or head and pull. Wheel = reel. E = hammer / chainsaw. 🧀 Pin one half (right-click), pull the other!'}</small>`;
  document.body.appendChild(d);
  b.onclick = () => { audioOn(); d.style.display = d.style.display === 'block' ? 'none' : 'block'; };
  d.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return; ({ s: rdSpawn, r: rdReset, c: rdClear, p: rwPin })[t.dataset.a](); });
})();
let _rdUi = '';
function rdUi() {
  const k = state.mode === 'play' && !state.xr && !CS.on ? '1' : '0'; if (k === _rdUi) return; _rdUi = k;
  $('rdBtn').style.display = k === '1' ? 'block' : 'none'; if (k === '0') $('rdHtml').style.display = 'none';
}

/* ---------------- VR stick clicks ---------------- */
function rdSticks(dt) {
  const s = renderer.xr.getSession && renderer.xr.getSession(); if (!s) return;
  for (const src of s.inputSources) {
    const gp = src.gamepad; if (!gp || !gp.buttons[3]) continue; const i = src.handedness === 'left' ? 0 : 1, on = gp.buttons[3].pressed;
    if (i === 0 && on && !RD.stickPrev[0]) rdSpawn();
    if (i === 1) {
      if (on) { RD.stickT += dt; if (RD.stickT > 1 && RD.stickT - dt <= 1) rdClear(); }
      else if (RD.stickPrev[1] && RD.stickT <= 1) rdReset();
      if (!on) RD.stickT = 0;
    }
    RD.stickPrev[i] = on;
  }
}

/* ---------------- the DUMMY TEST zone in the Slicing Yard: 3 dummies stand ready ---------------- */
const RD_TEST = [V(-3.6, 0, 1.3), V(-4.5, 0, 1.1), V(-5.4, 0, 1.3)];   // arena-local, they face the yard's spawn
{
  const g = new THREE.Group(); g.position.set(-4.5, 0, .35); arena.add(g);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.035, .04, 1.35, 8), mat(0x6a7380)); post.position.y = .67; g.add(post);
  const tex = labelTex(1024, 256, (c, w, h) => signText(c, w, h, [['🧸 DUMMY TEST', 104, '#ffd25a', 132]], 'rgba(22,30,44,.92)', '#ff8a3d'));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .3), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); sign.position.set(0, 1.42, .04); g.add(sign);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, .012, 32), new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: .8, transparent: true, opacity: .35 })); pad.position.set(0, .006, .85); pad.scale.z = .45; g.add(pad);
}
function rdTestZone() {   // fill the empty test spots (missing dummies come back when you return to the yard)
  if (!AV.tpl) return false;
  if (tAll - (RD.cubeT ?? -99) < 4) return true;   // just got cubed by the chainsaw: wait a moment before a new one pops in
  for (const sp of RD_TEST) {
    const at = V().copy(ARENA).add(sp);
    if (RD.list.some(r => r.home && r.home.distanceTo(at.clone().setY(.06)) < .1)) continue;
    if (RD.list.length >= RD.MAX) rdKill(RD.list.find(r => !r.home) || RD.list[0]);
    at.y = .06; const yaw = Math.atan2(AR_SPAWN.x - sp.x, AR_SPAWN.z - sp.z) * .4;
    const rd = rdSpawnAt(at, yaw); rd.home = at.clone(); rd.homeYaw = yaw; rdTorsoFrame(rd); rdDraw(rd, 0);
  }
  if (!HM.on) hmPlace(V().copy(ARENA).add(_rv.set(-4.5, .5, .55)));   // the sledgehammer waits by the sign too
  return true;
}
// a wrecked or thrown-away test dummy pops back home by itself after a few seconds (Isaiah: "the dummies don't respawn")
function rdHomeAgain(o) {
  const base = V(o.home.x, o.home.y, o.home.z), look = o.look, yaw = o.homeYaw, home = o.home; rdKill(o);
  const rd = rdSpawnAt(base, yaw, look); rd.home = home; rd.homeYaw = yaw; rdTorsoFrame(rd); rdDraw(rd, 0);
  rdBurst(_rv.copy(base).add(V(0, .6, 0)), V(0, 1, 0), 10, base.y);
  if (ac) { tone('triangle', 400, 1000, .15, .12); tone('sine', 800, 1600, .1, .06, .08); }
}
function rdTestRespawn(dt) {
  if ((RD.fillT = (RD.fillT || 0) - dt) < 0) { RD.fillT = 2; rdTestZone(); }   // missing ones (fell off the world) come back too
  for (const rd of RD.list.slice()) {
    if (!rd.home) continue;
    const wrecked = Object.values(rd.G).some(G => G.ripped) || rd.W.ripped, far = Math.hypot(rd.P[0].p.x - rd.home.x, rd.P[0].p.z - rd.home.z) > 2.5 || rd.P[0].p.y < rd.home.y - 3;
    const held = RD.held.some(x => x && x.rd === rd);
    if ((wrecked || far) && !held) { if ((rd.backT = (rd.backT || 0) + dt) > 6) rdHomeAgain(rd); } else rd.backT = 0;
  }
}

/* ---------------- per frame ---------------- */
function stepRagdolls(dt) {
  rdUi();
  if (state.mode !== 'play') return;
  if (state.xr) rdSticks(dt);
  if (!RD.told && store.get('kg-rd') !== '1' && !CS.on && (RD.hintT += dt) > 30) {
    RD.told = true; toast('🧸 NEW: Test dummies are waiting in the Slicing Yard, by the DUMMY TEST sign!', 6);
  }
  if (HZ.on !== RD.hz) { RD.hz = HZ.on; for (const rd of RD.list) rd.caps.forEach(m => { m.geometry = rdCapG(); }); }
  if (state.area === 'arena' && RD.area !== 'arena') { if (rdTestZone()) { RD.area = 'arena'; if (!RD.toldTest) { RD.toldTest = true; setTimeout(() => toast('🧸 Test dummies are waiting by the DUMMY TEST sign! Pull them apart 😈', 5), 3500); } } }
  else if (state.area !== 'arena') RD.area = state.area;
  if (state.area === 'arena' && RD.area === 'arena') rdTestRespawn(dt);
  hmStep(dt); sawStep(dt); rfxStep(dt); splatStep(dt);
  if (!RD.list.length) { CHZ.mesh.count = 0; return; }
  // where each held part should be
  headWorld(_hp); camera.getWorldDirection(_rd);
  RD.held.forEach((x, slot) => {
    if (!x) return; if (!RD.list.includes(x.rd)) { RD.held[slot] = null; return; }
    if (x.src === 'vr') { if (!x.h.tracked) { rdRelease(slot); return; } x.t.copy(x.h.pos).add(x.off); }
    else if (x.src !== 'pin') x.t.copy(_hp).addScaledVector(_rd, RD.pcDist);
    x.rd.P[x.i].pin = x.t;
  });
  RD.acc = Math.min(RD.acc + dt, RD_STEP * 3);
  let n = 0; while (RD.acc >= RD_STEP) { RD.acc -= RD_STEP; n++; }
  if (n) rdBetween();
  for (const rd of RD.list.slice()) {
    rd.hitCd -= dt;
    const pl = rdPulled(rd); rd.heavy = pl.any && !pl.pinBody; rd.heldNow = pl.any;
    if (pl.any) { rd.asleep = false; rd.calm = 0; rd.anchor = null; if (pl.pinBody) rd.stand = Math.max(0, rd.stand - dt * 4); else rd.stand = Math.min(rd.stand, .8); }
    else if ((rd.calm += dt) > 2.5) rd.stand = Math.min(1, rd.stand + dt * .8);
    if (!rd.asleep) for (let i = 0; i < n; i++) rdStep(rd, RD_STEP);
    if (rd.P[0].p.y < -60) { rdKill(rd); continue; }
    // stretch sounds + yells, and stuffing leaking out of the seam
    for (const gname in rd.G) {
      const G = rd.G[gname]; if (G.ripped || !G.pulled) continue;
      const step = Math.floor(G.ratio * 6); if (step > (G.lastStep || 0) && ac) tone('sine', 260 + G.ratio * 600, 300 + G.ratio * 700, .08, .05); G.lastStep = step;
      if (G.ratio > .55 && (G.seepT -= dt) < 0) {
        G.seepT = .14; const p = rd.P[G.cons[0].a].p; _rfV.set(Math.random() - .5, Math.random() * .5, Math.random() - .5).multiplyScalar(.6);
        if (HZ.on) rfxAdd(p, _rfV, .01, .008, .01, pick([0x7a0f14, 0x9b1b1f]), 8, 9.8, .3, rd.floor, 1); else rfxAdd(p, _rfV, .013, .011, .013, 0xffffff, 12, 3.2, 1.8, rd.floor);
      }
    }
    if (!rd.asleep || rd.squash > 0) rdDraw(rd, dt);
  }
  stepCheese(dt);
}
window.__kg.rd = { RD, HM, RFX, SPL, spawn: rdSpawn, reset: rdReset, clear: rdClear, grabAt: rdGrabAt, release: rdRelease, aim: rdAim, desk: rdDesk, test: rdTestZone };
