// ===== RAGDOLL: the dummy's body is a set of physics points held together by bones and joints =====
// Verlet points + distance constraints (position-based dynamics). Torso points are locked together
// (one solid chest + hips), limbs hang off them with bones, joint limits stop bad bends, and each limb
// is fixed to its socket by a JOINT that can stretch and TEAR. The meshes are posed from the points.
const RAG = { p: [], q: [], w: [], r: [], alive: [], owner: [], name: [], C: [], rest: [], holds: [], pinned: true, pin: [], musc: 1, ko: 0, pushers: [] };
const _ra = new V3(), _rb = new V3(), _rc = new V3(), _rm = new THREE.Matrix4(), _rq2 = new Q();
const RAG_SUB = 2, RAG_IT = 7;
const RAG_JK = { head: .32, arm: .15, leg: .13, waist: .3 };   // joint stiffness: lower = stretches more before tearing

function ragReset() { Object.assign(RAG, { p: [], q: [], w: [], r: [], alive: [], owner: [], name: [], C: [], rest: [], holds: [], pinned: true, pin: [], musc: 1, ko: 0, hit: 0, pushers: [] }); }
function ragAdd(name, owner, pos, mass, rad) {
  const i = RAG.p.length;
  RAG.p.push(pos.clone()); RAG.q.push(pos.clone()); RAG.w.push(1 / mass); RAG.r.push(rad);
  RAG.alive.push(true); RAG.owner.push(owner); RAG.name.push(name);
  RAG.idx = RAG.idx || {}; RAG.idx[name] = i;
  return i;
}
// kinds: 'rigid' (torso), 'bone', 'joint' (tearable socket, rest 0), 'min' (keep apart), 'range'
function ragC(a, b, kind, k = 1, lo, hi) {
  const len = RAG.p[a].distanceTo(RAG.p[b]);
  RAG.C.push({ a, b, kind, k, len, lo: lo ?? len, hi: hi ?? len });
}
// builds points from the posed meshes (so the rest pose is exactly the model's pose)
function buildRag(D) {
  ragReset(); RAG.idx = {};
  const T = D.torso; T.updateWorldMatrix(true, true);
  const W = (o, x, y, z) => o.localToWorld(new V3(x, y, z));
  // upper body (owner 'torso') and hips (owner 'hips'), joined at the waist by stretchy, tearable links
  const up = [['Ch', 0, .42, 0, .14], ['N', 0, .52, .005, .06], ['SL', -.2, .465, 0, .07], ['SR', .2, .465, 0, .07], ['Fr', 0, .26, .09, .1], ['Bk', 0, .26, -.09, .1]];
  const lo = [['Pz', 0, 0, 0, .13], ['HL', -.088, -.07, 0, .08], ['HR', .088, -.07, 0, .08], ['Lo', 0, .1, .08, .09], ['Lb', 0, .1, -.08, .09]];
  const ui = up.map(([n, x, y, z, r]) => ragAdd(n, 'torso', W(T, x, y, z), 4, r));
  const li = lo.map(([n, x, y, z, r]) => ragAdd(n, 'hips', W(T, x, y, z), 5, r));
  for (const set of [ui, li]) for (let a = 0; a < set.length; a++) for (let b = a + 1; b < set.length; b++) ragC(set[a], set[b], 'rigid', 1);
  for (const a of ui) for (const b of li) ragC(a, b, 'waist', RAG_JK.waist);
  RAG.torso = [...ui, ...li]; RAG.up = ui; RAG.lo = li; RAG.split = false; RAG.waistTear = 0;
  const P = D.parts;
  if (P.head) {
    const g = P.head.g;
    const h0 = ragAdd('H0', 'head', W(g, 0, 0, 0), 1.5, .05), hc = ragAdd('Hc', 'head', W(g, 0, .19, 0), 2.5, .115), hf = ragAdd('Hf', 'head', W(g, 0, .19, .1), 1, .05);
    ragC(h0, hc, 'bone'); ragC(hc, hf, 'bone'); ragC(h0, hf, 'bone');
    ragC(RAG.idx.N, h0, 'joint', RAG_JK.head);
    ragC(hc, RAG.idx.Ch, 'range', 1, .2, .33);          // neck can bend but not fold
    ragC(hf, RAG.idx.Ch, 'min', 1, .2);
    ragC(hf, RAG.idx.SL, 'range', .5, RAG.p[hf].distanceTo(RAG.p[RAG.idx.SL]) - .09, RAG.p[hf].distanceTo(RAG.p[RAG.idx.SL]) + .09);   // limited twist
    ragC(hf, RAG.idx.SR, 'range', .5, RAG.p[hf].distanceTo(RAG.p[RAG.idx.SR]) - .09, RAG.p[hf].distanceTo(RAG.p[RAG.idx.SR]) + .09);
    P.head.pts = [h0, hc, hf]; P.head.root = h0; P.head.sock = RAG.idx.N; P.head.end = hc;
  }
  for (const s of [-1, 1]) {
    const A = P[s < 0 ? 'armL' : 'armR'];
    if (A) {
      const g = A.g, el = g.userData.elbow, wr = g.userData.wrist;
      const a0 = ragAdd('A0' + s, A.name, W(g, 0, 0, 0), 1.2, .055), e = ragAdd('E' + s, A.name, W(el, 0, 0, 0), 1, .045), w = ragAdd('W' + s, A.name, W(wr, 0, -.05, 0), .8, .05);
      ragC(a0, e, 'bone'); ragC(e, w, 'bone');
      ragC(a0, w, 'min', 1, .24);                         // elbow can't fold flat
      const sk = RAG.idx[s < 0 ? 'SL' : 'SR'];
      ragC(sk, a0, 'joint', RAG_JK.arm);
      for (const t of [RAG.idx.Ch, RAG.idx.Fr, RAG.idx.Bk, RAG.idx.Pz]) { ragC(e, t, 'min', 1, RAG.r[e] + RAG.r[t] * .8); ragC(w, t, 'min', 1, RAG.r[w] + RAG.r[t] * .8); }
      ragC(e, RAG.idx[s < 0 ? 'SR' : 'SL'], 'min', 1, .3);  // arm can't cross through the chest
      A.pts = [a0, e, w]; A.root = a0; A.sock = sk; A.end = w;
    }
    const L = P[s < 0 ? 'legL' : 'legR'];
    if (L) {
      const g = L.g, kn = g.userData.knee;
      const l0 = ragAdd('L0' + s, L.name, W(g, 0, 0, 0), 3, .075), k = ragAdd('K' + s, L.name, W(kn, 0, 0, 0), 2.5, .06), f = ragAdd('F' + s, L.name, W(kn, 0, -.41, 0), 1.5, .055);
      ragC(l0, k, 'bone'); ragC(k, f, 'bone');
      ragC(l0, f, 'min', 1, .5);                          // knee bend limit
      const sk = RAG.idx[s < 0 ? 'HL' : 'HR'];
      ragC(sk, l0, 'joint', RAG_JK.leg);
      for (const t of [RAG.idx.Ch, RAG.idx.Fr, RAG.idx.Bk]) { ragC(k, t, 'min', 1, .3); ragC(f, t, 'min', 1, .45); }
      L.pts = [l0, k, f]; L.root = l0; L.sock = sk; L.end = f;
    }
  }
  // the other leg can't pass through: keep feet/knees apart a little
  if (P.legL && P.legR) { ragC(P.legL.pts[1], P.legR.pts[1], 'min', 1, .1); ragC(P.legL.pts[2], P.legR.pts[2], 'min', 1, .1); }
  // rest positions in torso space (for muscles) + pins for the post
  const iu = ragFrame('up', new THREE.Matrix4()).invert(), il = ragFrame('lo', new THREE.Matrix4()).invert();
  RAG.rest = RAG.p.map((p, i) => p.clone().applyMatrix4(RAG.owner[i].startsWith('leg') ? il : iu));
  RAG.pin = RAG.p.map(p => p.clone());
  RAG.pinned = true;
}
// body frames from the points: 'up' = chest (origin at the chest point), 'lo' = hips (origin at the pelvis point)
function ragFrame(which, m) {
  const I = RAG.idx, p = RAG.p;
  let o, up, right;
  if (which === 'up') { o = p[I.Ch]; up = _ra.addVectors(p[I.Fr], p[I.Bk]).multiplyScalar(.5).negate().add(p[I.Ch]).normalize(); right = _rb.subVectors(p[I.SR], p[I.SL]); }
  else { o = p[I.Pz]; up = _ra.addVectors(p[I.Lo], p[I.Lb]).multiplyScalar(.5).sub(p[I.Pz]).normalize(); right = _rb.subVectors(p[I.HR], p[I.HL]); }
  right.addScaledVector(up, -right.dot(up)).normalize();
  const fwd = _rc.crossVectors(right, up);
  m.makeBasis(right, up, fwd); m.setPosition(o);
  return m;
}
function ragTorsoMatrix(m) { return ragFrame('lo', m); }
// tear the body in two at the waist
function ragSplit() {
  if (RAG.split) return; RAG.split = true;
  RAG.C = RAG.C.filter(c => c.kind !== 'waist');
}
function ragKill(P) { for (const i of P.pts || []) RAG.alive[i] = false; RAG.C = RAG.C.filter(c => RAG.alive[c.a] && RAG.alive[c.b]); RAG.holds = RAG.holds.filter(h => RAG.alive[h.i]); }
function ragVel(i, h) { return RAG.p[i].clone().sub(RAG.q[i]).divideScalar(h); }
function ragAddVel(i, v, h) { RAG.q[i].addScaledVector(v, -h); }
// pick the nearest live point (for grabbing / punching)
function ragNearest(p, reach) {
  let best = -1, bd = reach;
  for (let i = 0; i < RAG.p.length; i++) { if (!RAG.alive[i]) continue; const d = RAG.p[i].distanceTo(p) - RAG.r[i]; if (d < bd) { bd = d; best = i; } }
  return best;
}
function ragRay(o, d, maxT) {
  let best = -1, bt = maxT;
  for (let i = 0; i < RAG.p.length; i++) {
    if (!RAG.alive[i]) continue;
    const t = _ra.subVectors(RAG.p[i], o).dot(d); if (t < .2 || t > bt) continue;
    if (_rb.copy(o).addScaledVector(d, t).distanceTo(RAG.p[i]) < RAG.r[i] + .06) { bt = t; best = i; }
  }
  return best < 0 ? null : { i: best, t: bt };
}
// ---- the simulation ----
const _mus = new THREE.Matrix4(), _musL = new THREE.Matrix4();
function stepRag(dt) {
  if (!RAG.p.length) return;
  const h = dt / RAG_SUB, g = -9.8 * h * h, N = RAG.p.length;
  RAG.hitBest = null;
  for (let s = 0; s < RAG_SUB; s++) {
    // move (verlet) + remember speed for impacts
    for (let i = 0; i < N; i++) {
      if (!RAG.alive[i]) continue;
      const p = RAG.p[i], q = RAG.q[i];
      const vx = (p.x - q.x) * .998, vy = (p.y - q.y) * .998, vz = (p.z - q.z) * .998;
      q.copy(p); p.x += vx; p.y += vy + g; p.z += vz;
    }
    // muscles: limbs gently try to get back to their pose (strong while standing, floppy when thrown or knocked out)
    const mk = RAG.ko > 0 ? 0 : RAG.pinned ? .035 * RAG.musc : .006 * RAG.musc;
    if (mk > 0) {
      ragFrame('up', _mus); ragFrame('lo', _musL);
      for (let i = 0; i < N; i++) {
        if (!RAG.alive[i] || RAG.owner[i] === 'torso' || RAG.owner[i] === 'hips') continue;
        const k = RAG.owner[i] === 'head' ? mk * 2.5 : mk;
        const t = _ra.copy(RAG.rest[i]);
        if (RAG.owner[i] === 'head' && RAG.look) t.sub(RAG.rest[RAG.idx.N]).applyAxisAngle(_rb.set(0, 1, 0), RAG.look).add(RAG.rest[RAG.idx.N]);   // looks at you
        t.applyMatrix4(RAG.owner[i].startsWith('leg') ? _musL : _mus);
        RAG.p[i].lerp(t, k);
      }
    }
    for (let it = 0; it < RAG_IT; it++) {
      for (const c of RAG.C) {
        const a = RAG.p[c.a], b = RAG.p[c.b], wa = RAG.w[c.a], wb = RAG.w[c.b], ws = wa + wb;
        const d = _ra.subVectors(b, a), L = d.length();
        let target;
        if (c.kind === 'min') { if (L >= c.lo) continue; target = c.lo; }
        else if (c.kind === 'range') { if (L >= c.lo && L <= c.hi) continue; target = L < c.lo ? c.lo : c.hi; }
        else target = c.len;
        if (L < 1e-6) continue;
        const corr = (L - target) / L / ws * c.k;
        a.addScaledVector(d, wa * corr); b.addScaledVector(d, -wb * corr);
      }
      // the post holds the chest and hips
      if (RAG.pinned) for (const i of RAG.torso) RAG.p[i].lerp(RAG.pin[i], .5);
      // hands hold points (soft so heavy things lag behind your hand)
      for (const H of RAG.holds) RAG.p[H.i].lerp(H.target, H.k);
      // floor + walls + pillars + crates
      for (let i = 0; i < N; i++) {
        if (!RAG.alive[i]) continue;
        const p = RAG.p[i], q = RAG.q[i], r = RAG.r[i];
        const fy = floorAt(p.x, p.z) + r;
        if (p.y < fy) {
          const vin = (q.y - p.y) / h;
          if (it === 0 && vin > 2.5 && (!RAG.hitBest || vin > RAG.hitBest.v)) RAG.hitBest = { i, v: vin, p: p.clone().setY(fy - r), n: new V3(0, 1, 0) };
          p.y = fy;
          q.x += (p.x - q.x) * .35; q.z += (p.z - q.z) * .35;      // friction
        }
        // your hands (and things you swing) physically shove the body
        for (const P of RAG.pushers) {
          const d = _rb.subVectors(p, P.p), L = d.length(), m = r + P.r;
          if (L < m && L > 1e-5) { p.addScaledVector(d, (m - L) / L * .5); if (it === 0) q.addScaledVector(P.v, -h * .04); }
        }
        _rc.copy(p); keepIn(_rc, r);
        if (_rc.distanceToSquared(p) > 1e-10) {
          const n = _rb.subVectors(_rc, p).normalize();
          const vin = -_ra.subVectors(p, q).dot(n) / h;
          if (it === 0 && vin > 2.5 && (!RAG.hitBest || vin > RAG.hitBest.v)) RAG.hitBest = { i, v: vin, p: p.clone(), n: n.clone() };
          p.copy(_rc);
          const vt = _ra.subVectors(p, q); const vn = vt.dot(n);
          if (vn < 0) q.addScaledVector(n, vn * 1.3);              // bounce a bit off walls
        }
      }
      // limbs are solid along their whole length, not just at the joints (no arm sliding through a pillar)
      if (it === RAG_IT - 1) for (const c of RAG.C) {
        if (c.kind !== 'bone' && c.kind !== 'joint') continue;
        if (!RAG.alive[c.a] || !RAG.alive[c.b]) continue;
        const a = RAG.p[c.a], b = RAG.p[c.b];
        _rc.addVectors(a, b).multiplyScalar(.5); _rb.copy(_rc); keepIn(_rc, .05);
        if (_rc.distanceToSquared(_rb) > 1e-10) { _rc.sub(_rb); a.add(_rc); b.add(_rc); }
      }
    }
  }
  if (RAG.ko > 0) RAG.ko -= dt;
  RAG.pushers.length = 0;
}
// put the meshes where the points are
const _pq2 = new Q(), _tm = new THREE.Matrix4(), _tq = new Q();
const _upOff = new THREE.Matrix4().makeTranslation(0, -.42, 0), _um = new THREE.Matrix4(), _pqi = new Q();
function poseRag(D) {
  const T = D.torso, U = D.torsoUp, p = RAG.p;
  ragFrame('lo', _tm); _tm.decompose(T.position, T.quaternion, _ra); T.scale.set(1, 1, 1);
  T.updateMatrixWorld(true);
  ragFrame('up', _um).multiply(_upOff);                       // chest frame -> upper-body group
  _tm.copy(T.matrixWorld).invert().multiply(_um); _tm.decompose(U.position, U.quaternion, _ra); U.scale.set(1, 1, 1);
  U.updateMatrixWorld(true);
  for (const P of Object.values(D.parts)) {
    if (!P.attached || !P.pts) continue;
    const par = P.g.parent; par.getWorldQuaternion(_pqi).invert(); const _tinv = _pqi;
    const local = v => par.worldToLocal(v.clone());
    const [i0, i1, i2] = P.pts, g = P.g;
    g.position.copy(local(p[i0]));
    if (P.type === 'head') {
      const up = _ra.subVectors(p[i1], p[i0]).normalize();
      const fw = _rb.subVectors(p[i2], p[i1]); fw.addScaledVector(up, -fw.dot(up)).normalize();
      const rt = _rc.crossVectors(up, fw);
      _rm.makeBasis(rt, up, fw); _tq.setFromRotationMatrix(_rm);
      g.quaternion.copy(_tinv).multiply(_tq);
      continue;
    }
    const du = _ra.subVectors(p[i1], p[i0]).normalize(), df = _rb.subVectors(p[i2], p[i1]).normalize();
    const leg = P.type === 'leg';
    let x = _rc.crossVectors(leg ? du : df, leg ? df : du);
    if (x.lengthSq() < .0025) { x.copy(P.lastX || new V3(1, 0, 0).applyQuaternion(par.getWorldQuaternion(new Q()))); }
    x.normalize(); P.lastX = (P.lastX || new V3()).copy(x);
    const y = du.clone().negate(), z = new V3().crossVectors(x, y).normalize(); x.crossVectors(y, z);
    _rm.makeBasis(x, y, z); _tq.setFromRotationMatrix(_rm);
    g.quaternion.copy(_tinv).multiply(_tq);
    const bend = Math.acos(clamp(du.dot(df), -1, 1));
    const sub = leg ? g.userData.knee : g.userData.elbow;
    sub.rotation.set(leg ? bend : -bend, 0, 0);
  }
}
