/* ======================================================================
   CHEESE PULL 🧀 + CHAINSAW 🪚 (for the ragdoll test dummies in 90-ragdolls.js)
   CHEESE PULL: grab a dummy by its top half (shoulder, chest, arm or head) AND its bottom half, then pull apart.
     The waist stretches like melted cheese: it gets long and skinny, gooey strings sag between the halves
     and snap one by one, then it tears in two. Cotton stuffing normally, meat + a spine bone in horror mode.
     VR: one grip on each half. PC: RIGHT-click a part to pin it (📌), then hold left click on the other half and walk back.
     Phone: 🧸 menu > 📌 Pin, then ✋ Grab the other half and walk back.
   CHAINSAW: lies on a chopping stump by the DUMMY TEST sign. VR: grip the back handle, hold TRIGGER to rev.
     PC: E takes it, hold left click to rev + push. Phone: ✋ Grab takes it, ⚔️ Use revs.
     Push the running chain into a dummy: it shakes, sprays stuffing, then pops into a pile of sliceable cubes
     in its own colors (keep cutting them with the sword or the saw). The saw cuts yard cubes too.
   ====================================================================== */
const RW = { U: [0, 1, 4, 5], L: [2, 3, 11, 12, 13, 14], EM: .5, ready: false, cutG: .39, cx: 0, cz: 0, R: .2, told: false, toldPin: false };
const _wa = V(), _wb = V(), _wc = V(), _wx = V(), _wy = V(), _wz = V(), _wm = new THREE.Matrix4(), _cwq = new THREE.Quaternion(), _cwq2 = new THREE.Quaternion(), _wY = V(0, 1, 0);
// the top half's and bottom half's own frames (built from their body balls), and what they were when standing still
function rwFrameU(P, o, q) {
  o.addVectors(P[0], P[1]).multiplyScalar(.5);
  _wx.subVectors(P[1], P[0]).normalize(); _wy.subVectors(P[4], o); _wy.addScaledVector(_wx, -_wy.dot(_wx)).normalize(); _wz.crossVectors(_wx, _wy);
  q.setFromRotationMatrix(_wm.makeBasis(_wx, _wy, _wz)); return q;
}
function rwFrameL(P, o, q) {
  o.addVectors(P[2], P[3]).multiplyScalar(.5);
  _wx.subVectors(P[3], P[2]).normalize(); _wz.copy(P[13]).add(P[14]).sub(P[11]).sub(P[12]); _wz.addScaledVector(_wx, -_wz.dot(_wx)).normalize(); _wy.crossVectors(_wz, _wx);
  q.setFromRotationMatrix(_wm.makeBasis(_wx, _wy, _wz)); return q;
}
{
  const P = RD_REST.map(a => V(...a));
  RW.oU0 = V(); RW.qU0i = rwFrameU(P, RW.oU0, new THREE.Quaternion()).invert();
  RW.oL0 = V(); RW.qL0i = rwFrameL(P, RW.oL0, new THREE.Quaternion()).invert();
  RW.offU = V().subVectors(RW.oL0, RW.oU0);   // the old torso sat at the hips' middle
}
// cut the baked torso into a top and a bottom half at the waist (and measure how fat the waist is there)
function rwSplit(geo) {
  const p = geo.attributes.position.array, n = geo.attributes.normal.array, c = geo.attributes.color.array;
  if (!RW.ready) {
    let y0 = 1e9, y1 = -1e9; for (let i = 1; i < p.length; i += 3) { y0 = Math.min(y0, p[i]); y1 = Math.max(y1, p[i]); }
    RW.cutG = clamp(.39, y0 + (y1 - y0) * .3, y1 - (y1 - y0) * .35);
    let sx = 0, sz = 0, k = 0; for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 1] - RW.cutG) < .03) { sx += p[i]; sz += p[i + 2]; k++; }
    const cx = k ? sx / k : 0, cz = k ? sz / k : 0; let r = 0; for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 1] - RW.cutG) < .03) r += Math.hypot(p[i] - cx, p[i + 2] - cz);
    RW.R = k ? r / k : .2; RW.cx = -cx; RW.cz = -cz; RW.cutL = RW.cutG - .26;   // torso-local (the body mesh is turned around and sits .26 lower)
    RW.ready = true; RW.y0 = y0; RW.y1 = y1;
  }
  const out = [[[], [], []], [[], [], []]];
  for (let t = 0; t < p.length; t += 9) {
    const d = out[(p[t + 1] + p[t + 4] + p[t + 7]) / 3 >= RW.cutG ? 0 : 1];
    for (let k = 0; k < 9; k++) { d[0].push(p[t + k]); d[1].push(n[t + k]); d[2].push(c[t + k]); }
  }
  return out.map(([a, b, cc]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); return g; });
}
// the stretchy waist: a gooey tube (each dummy has its own). Every frame it bends out of the top half's cut and into the
// bottom half's cut (a curve), sags a little and gets skinny in the middle the further you pull, like melted cheese
// called from rdSpawnAt: two torso halves + the waist tube, and the waist seams become stretchy
function rwBody(rd, GE, mk) {
  const top = mk(GE.top, 1); top.position.set(0, -.26, 0); top.rotation.y = Math.PI; rd.torso.add(top); top.visible = false;
  const lo = new THREE.Group(); lo.scale.setScalar(RD_DS); rd.g.add(lo); rd.torsoLo = lo;
  const bot = mk(GE.bot, 1); bot.position.set(0, -.26, 0); bot.rotation.y = Math.PI; lo.add(bot); bot.visible = false;
  // until it tears, the torso is ONE stretchy body: its waist band follows both halves, so pulling stretches the body itself
  if (!RW.skinL) {
    const p = GE.torso.attributes.position.array, n = p.length / 3; RW.skinL = new Float32Array(p.length); RW.skinT = new Float32Array(n);
    for (let i = 0; i < n; i++) { RW.skinL[i * 3] = -p[i * 3]; RW.skinL[i * 3 + 1] = p[i * 3 + 1] - .26; RW.skinL[i * 3 + 2] = -p[i * 3 + 2]; RW.skinT[i] = THREE.MathUtils.smoothstep(p[i * 3 + 1], RW.cutG - .15, RW.cutG + .15); }
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RW.skinL.length), 3).setUsage(THREE.DynamicDrawUsage));
  sg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(RW.skinL.length), 3)); sg.setAttribute('color', GE.torso.attributes.color);
  const tube = new THREE.Mesh(sg, RD_BODY); tube.castShadow = true; tube.frustumCulled = false; rd.g.add(tube); rd.halves = [top, bot];
  const U = new Set(RW.U), L = new Set(RW.L);
  for (const c of rd.C) if (c.k === 'h' && ((U.has(c.a) && L.has(c.b)) || (L.has(c.a) && U.has(c.b)))) { c.k = 'w'; c.em = RW.EM * RD_DS; }
  const str = [];
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + Math.random() * .4; str.push({ a, b: a + (Math.random() - .5) * .6, ra: .25 + Math.random() * .6, rb: .25 + Math.random() * .6, brk: .45 + Math.random() * .5, snap: false, k: 0, del: 0, col: i % 3 === 0 ? 1 : 0 }); }
  rd.W = { pulled: false, ratio: 0, strain: 0, ripped: false, tube, str, gap: 0, wU: V(), wL: V(), qU: new THREE.Quaternion(), qL: new THREE.Quaternion(), dangle: 0, lastStep: 0, seepT: 0 };
}
// the stretchy waist seam (k 'w'): stiff unless BOTH halves are being pulled, then soft like warm cheese
function rwSolveK(rd, c, e) { return rd.W.pulled ? .012 + .28 * (e / c.em) ** 2 : .3; }
function rwSide(rd, i) {
  return RW.L.includes(i) ? 2 : RW.U.includes(i) ? 1 : 0;   // Isaiah: only when you pull the TORSO with both hands
}
function rwPulled(rd) {
  if (!rd.W) return; let up = false, lo = false;
  // only when both paws pull the TORSO itself (top half + bottom half). Holding an arm or the head doesn't count (Isaiah)
  RD.held.forEach(x => { if (!x || x.rd !== rd) return; if (RW.U.includes(x.i)) up = true; else if (RW.L.includes(x.i)) lo = true; });
  rd.W.pulled = up && lo && !rd.W.ripped;
}
function rwStrain(rd, h) {   // from rdStep: how far the waist is stretched, and tear it when pulled long enough
  const W = rd.W; if (!W || W.ripped) return;
  let e = 0, n = 0; for (const c of rd.C) if (c.k === 'w') { e += Math.max(0, rd.P[c.a].p.distanceTo(rd.P[c.b].p) - c.L); n++; }
  W.ratio = n ? e / n / (RW.EM * RD_DS) : 0;
  if (W.pulled && W.ratio > .45) W.strain += h * ((W.ratio - .45) * 2.5 + .3); else W.strain = Math.max(0, W.strain - h);
  for (const s of W.str) if (!s.snap && W.ratio > s.brk + .08) { s.snap = true; s.k = 0; if (ac) tone('sine', 900 + Math.random() * 500, 300, .07, .05); }   // a string snaps early
  if (W.strain > .6) rwRip(rd);
}
function rwRip(rd) {
  const W = rd.W; W.ripped = true; W.pulled = false;
  rd.C = rd.C.filter(c => c.k !== 'w'); rd.pairs = null; rd.stand = 0; rd.anchor = null;
  rd.P.forEach((q, i) => { if (!RW.L.includes(i)) rd.det[i] = true; });   // the top half just flops now
  const cap = (parent, up) => { const m = new THREE.Mesh(rdCapG(), RD_MAT); m.position.set(RW.cx, RW.cutL, RW.cz); if (!up) m.rotation.x = Math.PI; m.scale.set(RW.R * .95, RW.R * .8, RW.R * .95); parent.add(m); rd.caps.push(m); };
  cap(rd.torso, false); cap(rd.torsoLo, true);
  W.tube.visible = false; rd.halves.forEach(m => { m.visible = true; });
  W.str.forEach(s => { if (!s.snap) s.del = Math.random() * .45; });   // the last gooey strings hang on for a moment, then snap
  W.dangle = 2.2;
  _wc.addVectors(W.wU, W.wL).multiplyScalar(.5); _wa.subVectors(W.wU, W.wL); if (_wa.lengthSq() < 1e-6) _wa.set(0, 1, 0); _wa.normalize();
  rdBurst(_wc, _wa, HZ.on ? 16 : 22, rd.floor); rdBurst(_wc, _wa.negate(), HZ.on ? 16 : 22, rd.floor);
  if (HZ.on) { splatAdd(_wc.x, rd.floor, _wc.z, .28); splatAdd(_wc.x + (Math.random() - .5) * .4, rd.floor, _wc.z + (Math.random() - .5) * .4, .15); }
  RD.held.forEach(x => { if (x && x.rd === rd && x.h) buzz(x.h, 1, 160); });
  if (ac) {
    if (HZ.on) { noiseHit(ac.currentTime, .4, .4, 'lowpass', 500, 1.2); tone('sawtooth', 120, 40, .35, .14); tone('square', 70, 35, .2, .1, .06); }
    else { noiseHit(ac.currentTime, .3, .35, 'bandpass', 2000, 1.2); tone('triangle', 520, 140, .3, .16); tone('sine', 250, 1100, .16, .1, .1); }
  }
  if (!RW.told) { RW.told = true; toast(HZ.on ? '🦴 RIPPED IN HALF! That was NOT cheese...' : '🧀 CHEESE PULL! Ripped right in half! (H fixes them)', 4); }
}
// from rdDraw: place both halves (and the stretched waist tube between them)
function rwPlace(rd) {
  const P = rd.P.map(q => q.p), W = rd.W;
  if (!W) { _rm.makeBasis(rd.rx, rd.up, rd.fwd); rd.torso.quaternion.setFromRotationMatrix(_rm); rd.torso.position.copy(rd.pc); return; }
  rwFrameU(P, _wa, W.qU).multiply(RW.qU0i); rd.torso.quaternion.copy(W.qU); rd.torso.position.copy(_wb.copy(RW.offU).applyQuaternion(W.qU)).add(_wa);
  rwFrameL(P, _wa, W.qL).multiply(RW.qL0i); rd.torsoLo.quaternion.copy(W.qL); rd.torsoLo.position.copy(_wa);
  W.wU.set(RW.cx, RW.cutL + .015, RW.cz).multiplyScalar(RD_DS).applyQuaternion(W.qU).add(rd.torso.position);
  W.wL.set(RW.cx, RW.cutL - .015, RW.cz).multiplyScalar(RD_DS).applyQuaternion(W.qL).add(rd.torsoLo.position);
  W.gap = W.wU.distanceTo(W.wL);
  if (W.ripped) {   // arms + head belong to the top half now: they turn with it
    rd.fwd.set(0, 0, 1).applyQuaternion(W.qU); rd.up.set(0, 1, 0).applyQuaternion(W.qU); rd.rx.set(1, 0, 0).applyQuaternion(W.qU);
    return;
  }
  // the one-piece stretchy torso: each point is placed by the bottom half, the top half, or a blend (the waist band);
  // the waist also gets skinnier the further it stretches
  const T = W.tube, pa = T.geometry.attributes.position, A = pa.array, L = RW.skinL, TT = RW.skinT, cx = RW.cx, cz = RW.cz;
  const pinch = clamp((W.gap - .02) / .5, 0, 1) * .55;
  const eU = _rm.compose(rd.torso.position, W.qU, _cS.setScalar(RD_DS)).elements.slice(), eL = _rm.compose(rd.torsoLo.position, W.qL, _cS).elements;
  for (let i = 0, j = 0; i < TT.length; i++, j += 3) {
    const t = TT[i], f = 1 - pinch * 4 * t * (1 - t);
    const x = cx + (L[j] - cx) * f, y = L[j + 1], z = cz + (L[j + 2] - cz) * f;
    const lx = eL[0] * x + eL[4] * y + eL[8] * z + eL[12], ly = eL[1] * x + eL[5] * y + eL[9] * z + eL[13], lz = eL[2] * x + eL[6] * y + eL[10] * z + eL[14];
    if (t <= 0) { A[j] = lx; A[j + 1] = ly; A[j + 2] = lz; continue; }
    const ux = eU[0] * x + eU[4] * y + eU[8] * z + eU[12], uy = eU[1] * x + eU[5] * y + eU[9] * z + eU[13], uz = eU[2] * x + eU[6] * y + eU[10] * z + eU[14];
    A[j] = lx + (ux - lx) * t; A[j + 1] = ly + (uy - ly) * t; A[j + 2] = lz + (uz - lz) * t;
  }
  pa.needsUpdate = true; T.geometry.computeVertexNormals();
}

/* ---------------- the gooey cheese strings (one instanced mesh for all dummies) ---------------- */
const CHZ = { N: 220 };
{
  const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); g.translate(0, .5, 0);
  CHZ.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: .55, side: THREE.DoubleSide }), CHZ.N);
  CHZ.mesh.frustumCulled = false; CHZ.mesh.count = 0; CHZ.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  CHZ.mesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(CHZ.mesh);
}
const _cS = V(), _cC = new THREE.Color(), _chD = V(), _cM = V();
function chzSeg(n, a, b, w, col) {
  if (n >= CHZ.N) return n;
  _chD.subVectors(b, a); const L = _chD.length(); if (L < 1e-4) return n;
  _cwq.setFromUnitVectors(_wY, _chD.multiplyScalar(1 / L)); _rfM.compose(a, _cwq, _cS.set(w, L, w)); CHZ.mesh.setMatrixAt(n, _rfM); CHZ.mesh.setColorAt(n, col); return n + 1;
}
function stepCheese(dt) {
  let n = 0;
  for (const rd of RD.list) {
    const W = rd.W; if (!W) continue;
    const strOn = W.ripped && W.dangle > 0; if (strOn) W.dangle -= dt;   // gooey strings only when it tears (while pulling, the body itself stretches)
    const meat = HZ.on;
    if (strOn) for (const s of W.str) {
      const col = meat ? _cC.setHex(s.col ? 0xd65a5a : 0x8e1418) : s.col ? _cC.setHex(0xfffaf0) : _cC.set(rd.look.fur).lerp(_rfC.setHex(0xfff4c8), .55);
      _wa.set(RW.cx + Math.cos(s.a) * s.ra * RW.R, RW.cutL, RW.cz + Math.sin(s.a) * s.ra * RW.R).multiplyScalar(RD_DS).applyQuaternion(W.qU).add(rd.torso.position);
      _wb.set(RW.cx + Math.cos(s.b) * s.rb * RW.R, RW.cutL, RW.cz + Math.sin(s.b) * s.rb * RW.R).multiplyScalar(RD_DS).applyQuaternion(W.qL).add(rd.torsoLo.position);
      const gap = _wa.distanceTo(_wb);
      if (!s.snap && W.ripped && ((s.del -= dt) <= 0 || gap > .9)) { s.snap = true; s.k = 0; }
      if (!s.snap) {   // still one gooey string: it sags in the middle and gets thinner as you pull
        const st = clamp(W.ratio, 0, 1), w = .011 * (1 - .55 * st) + .0025, sag = Math.min(.18, gap * (.32 - .14 * st));
        _cM.addVectors(_wa, _wb).multiplyScalar(.5); _cM.y -= sag;
        n = chzSeg(n, _wa, _cM, w, col); n = chzSeg(n, _cM, _wb, w, col);
      } else {   // snapped: two floppy ends hang down and shrink away
        s.k += dt; if (s.k > 1) continue;
        const k = 1 - s.k, len = Math.min(.25, gap * .45) * k, w = .008 * k + .001;
        if (len < .004) continue;
        _chD.subVectors(_wb, _wa).normalize().multiplyScalar(.35); _chD.y -= 1; _chD.normalize(); _cM.copy(_wa).addScaledVector(_chD, len); n = chzSeg(n, _wa, _cM, w, col);
        _chD.subVectors(_wa, _wb).normalize().multiplyScalar(.35); _chD.y -= 1; _chD.normalize(); _cM.copy(_wb).addScaledVector(_chD, len); n = chzSeg(n, _wb, _cM, w, col);
      }
    }
    // stretchy sounds + stuffing seeping out of the thin waist
    if (!W.ripped && W.pulled) {
      const step = Math.floor(W.ratio * 7); if (step > W.lastStep && ac) { tone('sine', 180 + W.ratio * 420, 220 + W.ratio * 520, .1, .06); if (HZ.on) noiseHit(ac.currentTime, .1, .05, 'lowpass', 700, 1); } W.lastStep = step;
      if (W.ratio > .4 && (W.seepT -= dt) < 0) {
        W.seepT = .1; _cM.addVectors(W.wU, W.wL).multiplyScalar(.5); _rfV.set(Math.random() - .5, Math.random() * .4, Math.random() - .5).multiplyScalar(.7);
        if (HZ.on) rfxAdd(_cM, _rfV, .011, .009, .011, pick([0x7a0f14, 0x9b1b1f]), 8, 9.8, .3, rd.floor, 1); else rfxAdd(_cM, _rfV, .014, .012, .014, 0xffffff, 12, 3.2, 1.8, rd.floor);
      }
      RD.held.forEach(x => { if (x && x.rd === rd && x.h && (W.buzzT = (W.buzzT || 0) - dt) < 0) { W.buzzT = .06; buzz(x.h, .15 + W.ratio * .5, 40); } });
    } else W.lastStep = 0;
  }
  CHZ.mesh.count = n; if (n) { CHZ.mesh.instanceMatrix.needsUpdate = true; CHZ.mesh.instanceColor.needsUpdate = true; }
}

/* ---------------- 📌 pin a part in place (the "other hand" on PC and phones) ---------------- */
function rwPin() {
  if (state.xr) return false;
  if (RD.held[0] && RD.held[0].src === 'pin') { rdRelease(0); if (ac) tone('sine', 700, 400, .08, .06); return true; }
  const a = rdAim(); if (!a) { toast('📌 Aim at a dummy part first!', 2); return false; }
  const [rd, i] = a; RD.held[0] = { rd, i, h: null, src: 'pin', off: V(), t: rd.P[i].p.clone() };
  rd.asleep = false; rd.sleep = 0; rd.calm = 0; if (i < 6 || i > 10) rd.stand = 0;
  if (ac) tone('triangle', 600, 900, .08, .08);
  if (!RW.toldPin) { RW.toldPin = true; toast(IS_TOUCH ? '📌 Pinned! Now ✋ Grab the OTHER half and walk back for a CHEESE PULL 🧀' : '📌 Pinned! Now hold left click on the OTHER half and walk back for a CHEESE PULL 🧀 (right-click again = unpin)', 6); }
  return true;
}
canvas.addEventListener('pointerdown', e => {
  if (e.button === 2 && SAW.held === hands[1] && !state.xr && state.mode === 'play') {   // PC: right-click turns the saw on its side (cut across instead of up and down)
    SAW.roll = !SAW.roll; toast(SAW.roll ? '🪚 Saw on its side: cuts ACROSS (like at the waist)' : '🪚 Saw upright: cuts top to bottom', 2.5); e.stopImmediatePropagation(); return;
  }
  if (e.button !== 2 || state.mode !== 'play' || state.xr || CS.on || hands[1].sword || hands[1].saw || HM.held) return;
  if (!RD.list.length) return;
  if (rwPin()) e.stopImmediatePropagation();
}, true);

/* ======================================================================
   🪚 THE CHAINSAW
   model axes: +Y = along the bar (forward), -X = the top of the saw, +Z = its right side (the bar is flat in X-Y)
   ====================================================================== */
const SAW = { g: null, chain: null, held: null, rpm: 0, phase: 0, push: 0, mouse: false, revT: 0, au: null, buzzT: 0, smokeT: 0, load: 0, falling: false, v: V(), restT: 0,
  A: V(), B: V(), last: V(), vel: V(), N: 46, home: V(), homeQ: new THREE.Quaternion(), told: false, toldCube: false, on: false };
const SAW_BAR = [.25, .66], SAW_R = .033;
{
  const box = (w, h, d, r) => { const g = new RoundedBoxGeometry(w, h, d, 2, r); g.deleteAttribute('uv'); return g; };
  const cyl = (r0, r1, h, s = 12) => new THREE.CylinderGeometry(r0, r1, h, s);
  const ORG = 0xff7a1a, DARK = 0x26282c, GREY = 0x6d737c, STEEL = 0xc9ced6;
  const P = [
    rdCol(rdT(box(.13, .2, .11, .025), -.02, .16, 0), ORG),                                 // engine housing
    rdCol(rdT(box(.05, .16, .118, .012), .035, .17, 0), DARK),                               // dark belly pan
    rdCol(rdT(box(.03, .12, .02, .008), -.03, .19, .062), 0x3a3d42),                         // clutch cover
    rdCol(rdT(box(.035, .05, .03, .008), -.005, .245, .06), GREY),                           // muffler
    ...[0, 1, 2].map(i => rdCol(rdT(box(.006, .03, .004, .002), -.03 + i * .012, .245, .076), 0x222428)),   // muffler slots
    rdCol(rdT(cyl(.044, .044, .014, 16), -.02, .14, -.062, 1, 1, 1, Math.PI / 2), 0x34373c),  // starter cover (left side)
    rdCol(rdT(cyl(.03, .03, .016, 14), -.02, .14, -.064, 1, 1, 1, Math.PI / 2), ORG),
    rdCol(rdT(box(.012, .04, .012, .005), -.02, .14, -.078), DARK),                          // pull-cord handle
    rdCol(rdT(cyl(.014, .014, .018, 10), -.094, .1, .03, 1, 1, 1, 0, 0, Math.PI / 2), 0xffd25a),   // fuel cap
    rdCol(rdT(cyl(.012, .012, .016, 10), -.094, .1, -.03, 1, 1, 1, 0, 0, Math.PI / 2), 0x2b2b2b),  // oil cap
    rdCol(rdT(cyl(.018, .018, .14, 12), 0, -.01, 0), DARK),                                  // rear handle grip
    rdCol(rdT(box(.016, .15, .022, .007), -.07, -.01, 0), DARK),                             // rear handle top bar
    rdCol(rdT(box(.07, .018, .022, .007), -.035, -.08, 0), DARK),                            // rear handle back post
    rdCol(rdT(box(.022, .02, .014, .005), .024, .03, 0), 0xff3b30),                          // throttle trigger
    rdCol(rdT(box(.04, .02, .05, .008), -.01, .055, 0), ORG),                                // handle neck
    rdCol(rdT(new THREE.TorusGeometry(.078, .011, 8, 18, Math.PI), 0, 0, 0, 1, 1, 1, 0, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(-.02, .21, 0), DARK),   // front wrap handle
    rdCol(rdT(box(.07, .008, .1, .003), -.02, .275, 0), DARK),                               // chain brake guard
    rdCol(rdT(box(SAW_R * 2, SAW_BAR[1] - SAW_BAR[0], .008, .003), 0, (SAW_BAR[0] + SAW_BAR[1]) / 2, 0), STEEL),   // guide bar
    rdCol(rdT(cyl(SAW_R, SAW_R, .008, 18), 0, SAW_BAR[1], 0, 1, 1, 1, Math.PI / 2), STEEL),  // round bar tip
    ...[-1, 1].map(s => rdCol(rdT(box(.022, .2, .002, .001), 0, .45, s * .0048), ORG)),       // orange stripe on the bar
    ...[-1, 1].map(s => rdCol(rdT(box(.008, .2, .0022, .001), -.016, .45, s * .005), 0x1c1d20)),
  ].map(g => g.index ? g.toNonIndexed() : g);
  P.forEach(g => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k); });
  SAW.g = new THREE.Group(); SAW.body = new THREE.Mesh(rdMerge(P), RD_MAT); SAW.body.castShadow = true; SAW.g.add(SAW.body);
  // the chain: little teeth that run round the bar (instanced, they move when you rev)
  const tg = rdMerge([rdCol(new THREE.BoxGeometry(.006, .013, .011), 0x4a4f57), rdCol(rdT(new THREE.BoxGeometry(.007, .006, .012), -.004, .003, 0), 0xdfe4ea)].map(g => g.toNonIndexed()));
  SAW.chain = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .6, roughness: .35 }), SAW.N);
  SAW.chain.frustumCulled = false; SAW.chain.instanceMatrix.setUsage(THREE.DynamicDrawUsage); SAW.g.add(SAW.chain);
  // a see-through blur of the chain when it's really flying
  const blur = new THREE.Mesh(rdMerge([new THREE.BoxGeometry(.008, SAW_BAR[1] - SAW_BAR[0], .013).translate(-SAW_R, (SAW_BAR[0] + SAW_BAR[1]) / 2, 0), new THREE.BoxGeometry(.008, SAW_BAR[1] - SAW_BAR[0], .013).translate(SAW_R, (SAW_BAR[0] + SAW_BAR[1]) / 2, 0),
    new THREE.TorusGeometry(SAW_R, .004, 4, 12, Math.PI).translate(0, SAW_BAR[1], 0)].map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; })),
    new THREE.MeshBasicMaterial({ color: 0xaab2bd, transparent: true, opacity: 0, depthWrite: false }));
  SAW.blur = blur; SAW.g.add(blur);
  SAW.g.visible = false; scene.add(SAW.g);
}
const SAW_PATH = (() => {   // the loop the chain runs on (in the bar's X-Y plane)
  const L1 = SAW_BAR[1] - SAW_BAR[0] + .02, arc = Math.PI * SAW_R; return { L1, arc, len: 2 * L1 + 2 * arc };
})();
const _sp = V(), _sQ = new THREE.Quaternion(), _sZ = V(0, 0, 1), _sS = V(1, 1, 1);
function sawChain() {
  const { L1, arc, len } = SAW_PATH, y0 = SAW_BAR[0] - .02, y1 = SAW_BAR[1];
  for (let i = 0; i < SAW.N; i++) {
    let s = ((i / SAW.N) * len + SAW.phase) % len; if (s < 0) s += len; let ang;
    if (s < L1) { _sp.set(-SAW_R - .004, y0 + s, 0); ang = 0; }                              // top edge, running forward
    else if ((s -= L1) < arc) { const a = s / SAW_R; _sp.set(-Math.cos(a) * (SAW_R + .004), y1 + Math.sin(a) * (SAW_R + .004), 0); ang = -a; }   // round the tip
    else if ((s -= arc) < L1) { _sp.set(SAW_R + .004, y1 - s, 0); ang = -Math.PI; }        // bottom edge, coming back
    else { s -= L1; const a = s / SAW_R; _sp.set(Math.cos(a) * (SAW_R + .004), y0 - Math.sin(a) * (SAW_R + .004), 0); ang = -Math.PI - a; }
    _sQ.setFromAxisAngle(_sZ, ang); _rfM.compose(_sp, _sQ, _sS); SAW.chain.setMatrixAt(i, _rfM);
  }
  SAW.chain.instanceMatrix.needsUpdate = true;
}
sawChain();
// the chopping stump it waits on, next to the DUMMY TEST sign
const SAW_SPOT = V(-5.75, 0, .4);
{
  const g = new THREE.Group(); g.position.copy(SAW_SPOT); arena.add(g);
  const bark = new THREE.Mesh(new THREE.CylinderGeometry(.21, .25, .44, 14), new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: .95 })); bark.position.y = .22; bark.castShadow = bark.receiveShadow = true; g.add(bark);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .012, 18), new THREE.MeshStandardMaterial({ color: 0xd8b07a, roughness: .9 })); top.position.y = .445; g.add(top);
  for (let i = 1; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(i * .05, .003, 3, 20), new THREE.MeshBasicMaterial({ color: 0x9a7244 })); r.rotation.x = Math.PI / 2; r.position.y = .452; g.add(r); }
  const tex = labelTex(512, 128, (c, w, h) => signText(c, w, h, [['🪚 CHAINSAW', 80, '#ff8a3d', 100]], 'rgba(22,30,44,.92)', '#ffd25a'));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(.5, .125), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); sign.position.set(0, .25, .255); g.add(sign);
  addCol({ t: 1, x: ARENA.x + SAW_SPOT.x, z: ARENA.z + SAW_SPOT.z, cy: .22, hy: .22, r: .23, tag: 'wood' });
  // lying on top of the stump: top up, bar pointing at the dummies
  SAW.home.copy(ARENA).add(SAW_SPOT).add(V(-.12, .5, .05));
  SAW.homeQ.setFromRotationMatrix(_wm.makeBasis(V(0, -1, 0), V(.94, 0, .34).normalize(), V(0, -1, 0).cross(V(.94, 0, .34).normalize())));
}
function sawHome() { SAW.on = true; SAW.g.visible = true; SAW.falling = false; SAW.g.position.copy(SAW.home); SAW.g.quaternion.copy(SAW.homeQ); SAW.restT = 0; }

/* ---------------- engine sound (WebAudio): a buzzy two-stroke that chugs at idle and screams when you rev ---------------- */
function sawAudio() {
  if (SAW.au || !ac) return SAW.au;
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), am = ac.createGain(), g = ac.createGain(), lfo = ac.createOscillator(), lfoG = ac.createGain();
  o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.Q.value = 3; lfo.type = 'square'; lfo.frequency.value = 11; lfoG.gain.value = 0; am.gain.value = 1; g.gain.value = 0;
  lfo.connect(lfoG); lfoG.connect(am.gain); o1.connect(lp); o2.connect(lp); lp.connect(am); am.connect(g); g.connect(master);
  const n = noise(); n.loop = true; const nf = ac.createBiquadFilter(), ng = ac.createGain(); nf.type = 'bandpass'; nf.frequency.value = 2600; nf.Q.value = 1.4; ng.gain.value = 0; n.connect(nf); nf.connect(ng); ng.connect(master);
  o1.start(); o2.start(); lfo.start(); n.start();
  return (SAW.au = { o1, o2, lp, g, lfoG, nf, ng });
}
function sawSound() {
  const A = SAW.au; if (!A) return; const t = ac.currentTime, r = SAW.rpm, on = SAW.held ? 1 : 0, ld = SAW.load;
  const f = (34 + 92 * r) * (1 - .22 * ld);
  A.o1.frequency.setTargetAtTime(f, t, .04); A.o2.frequency.setTargetAtTime(f * .503, t, .04);
  A.lp.frequency.setTargetAtTime(380 + 2600 * r, t, .05); A.lfoG.gain.setTargetAtTime(on * .55 * (1 - r), t, .05);
  A.g.gain.setTargetAtTime(on * (.05 + .07 * r), t, .06);
  A.nf.frequency.setTargetAtTime(1800 + 2200 * r - 900 * ld, t, .05); A.ng.gain.setTargetAtTime(on * (.004 + .05 * r * r + .09 * ld), t, .05);
}

/* ---------------- holding it ---------------- */
function sawTake(h) {
  if (SAW.held && SAW.held !== h) SAW.held.saw = false;
  SAW.held = h; h.saw = true; SAW.falling = false; SAW.restT = 0; audioOn(); sawAudio(); SAW.rpm = .5;
  buzz(h, .8, 80);
  if (ac) { noiseHit(ac.currentTime, .25, .12, 'bandpass', 900, 1); [0, .09, .17, .24].forEach((w, i) => tone('square', 50 + i * 12, 40 + i * 14, .08, .08, w)); }   // pull-start: brrm-brm-brm
  if (!SAW.told) { SAW.told = true; toast(state.xr ? '🪚 VROOM! Hold TRIGGER to rev, push the chain into a dummy! Let go of grip to drop it.' : IS_TOUCH ? '🪚 VROOM! ⚔️ Use = rev it, push into a dummy. ✋ Grab = drop it.' : '🪚 VROOM! Hold CLICK to rev and push it into a dummy to slice it. Right-click turns the saw sideways. E drops it.', 6); }
}
function sawDrop(throwV) {
  const h = SAW.held; if (!h) return; h.saw = false; SAW.held = null; SAW.mouse = false; SAW.revT = 0;
  SAW.falling = true; SAW.v.copy(throwV || SAW.vel); if (SAW.v.length() > 6) SAW.v.setLength(6);
  if (ac) tone('sawtooth', 60, 25, .5, .08);   // engine dies
}
function sawNear(h) { if (!SAW.on || SAW.held) return false; _wa.set(0, 0, 0).applyMatrix4(SAW.g.matrixWorld); _wb.set(0, .16, 0).applyMatrix4(SAW.g.matrixWorld); return distToSeg(h.pos, _wa, _wb) < .12; }
function sawGrab(h) { if (h.saw) return true; if (!sawNear(h)) return false; sawTake(h); return true; }
function sawAimed() { if (!SAW.on || SAW.held) return false; headWorld(_hp); camera.getWorldDirection(_rd); _rv.set(0, .2, 0).applyMatrix4(SAW.g.matrixWorld).sub(_hp); const al = _rv.dot(_rd); if (al <= 0 || al > 2.8) return false; return Math.sqrt(Math.max(0, _rv.lengthSq() - al * al)) < .25 + al * .03; }
function sawDesk() {   // E / phone ✋
  if (state.xr) return false; const h = hands[1];
  if (SAW.held === h) { camera.getWorldQuaternion(_hmQ); sawDrop(V(0, 1, -2.5).applyQuaternion(_hmQ)); return true; }
  if (h.sword || HM.held === h || RD.held[1] || BR.held[1] || hands.some(x => x.piece || x.cup)) return false;
  if (sawAimed()) { sawTake(h); return true; }
  return false;
}
function sawPointer(e) {   // PC click / phone ⚔️ while holding it = rev
  if (SAW.held !== hands[1] || e.button !== 0) return false;
  if (e.pointerId === 999) SAW.revT = 1.1; else SAW.mouse = true;
  return true;
}
addEventListener('pointerup', e => { if (e.button === 0) SAW.mouse = false; });

/* ---------------- every frame ---------------- */
const _sawE = new THREE.Euler(), _sawX = V(), _sawY = V(), _sawZ = V(), _sawP = V(), _sawL = V(), _sawN = V();
function sawStep(dt) {
  if (!SAW.on) { if (state.area === 'arena' && AR.ready) sawHome(); return; }
  const h = SAW.held;
  if (h && state.xr && !h.tracked) sawDrop();
  // rev: VR trigger, PC held click, phone tap
  let rev = false;
  if (h) {
    if (state.xr) { const gp = h.src && h.src.gamepad, b = gp && gp.buttons[0]; rev = !!(b && (b.value > .25 || b.pressed)); }
    else { SAW.revT -= dt; rev = SAW.mouse || SAW.revT > 0; }
  }
  const want = h ? (rev ? 1 : .16) : 0; SAW.rpm += (want - SAW.rpm) * Math.min(1, dt * (want > SAW.rpm ? 5 : 2.5));
  SAW.load = Math.max(0, SAW.load - dt * 4);
  if (h && state.xr) { vrPose(h, _hp, _hmQ); SAW.g.position.copy(_hp); SAW.g.quaternion.copy(_hmQ); }
  else if (h) {   // PC / phone: held at your right hip, bar pointing where you look; revving pushes it forward
    SAW.push += ((rev ? 1 : 0) - SAW.push) * Math.min(1, dt * 7);
    // it follows where you look, but only tips up/down a little, so it stays at dummy height (you're a short bear!)
    headWorld(_hp); camera.getWorldDirection(_rd); _hmQ.setFromEuler(_sawE.set(Math.asin(clamp(_rd.y, -1, 1)) * .35, Math.atan2(-_rd.x, -_rd.z), 0, 'YXZ'));
    const sh = SAW.rpm * .004;
    SAW.g.position.copy(_rv.set(.25 - SAW.push * .06 + (Math.random() - .5) * sh, -.3 + SAW.push * .08 + (Math.random() - .5) * sh, -.32 - SAW.push * .4).applyQuaternion(_hmQ)).add(_hp);
    _cwq.setFromRotationMatrix(_wm.makeBasis(_sawX.set(0, -1, 0), _sawY.set(-.2, -.05 + SAW.push * .05, -1).normalize(), _sawZ.set(1, 0, 0)));
    _sawZ.crossVectors(_sawX, _sawY).normalize(); _sawX.crossVectors(_sawY, _sawZ); _cwq.setFromRotationMatrix(_wm.makeBasis(_sawX, _sawY, _sawZ));
    if (SAW.roll) _cwq.multiply(_cwq2.setFromAxisAngle(_wY, Math.PI / 2));
    SAW.g.quaternion.copy(_hmQ).multiply(_cwq);
  } else if (SAW.falling) {   // dropped: it falls and lies down on its side
    SAW.v.y -= 9.8 * dt; SAW.g.position.addScaledVector(SAW.v, dt);
    _rinfo.nrm.set(0, 0, 0);
    if (pushOut(SAW.g.position, .07, _rinfo)) { const n = _rinfo.nrm.normalize(), vn = SAW.v.dot(n); SAW.v.addScaledVector(n, -vn * 1.3).multiplyScalar(.6); if (SAW.v.length() < .3 && n.y > .5) SAW.falling = false; }
    _wa.set(0, 1, 0).applyQuaternion(SAW.g.quaternion); _wa.y = 0; if (_wa.lengthSq() < 1e-4) _wa.set(1, 0, 0); _wa.normalize();
    _cwq.setFromRotationMatrix(_wm.makeBasis(_sawX.set(0, -1, 0), _wa, _sawZ.crossVectors(_sawX.set(0, -1, 0), _wa)));
    SAW.g.quaternion.slerp(_cwq, Math.min(1, dt * 3));
    if (SAW.g.position.y < -60) sawHome();
  } else if (state.area === 'arena' && SAW.g.position.distanceToSquared(SAW.home) > .01 && (SAW.restT += dt) > 12) {   // left lying around: it pops back onto its stump
    rdBurst(_rv.copy(SAW.g.position), V(0, 1, 0), 6, SAW.g.position.y - .1); sawHome();
  }
  SAW.g.updateMatrixWorld();
  _sawX.set(1, 0, 0).applyQuaternion(SAW.g.quaternion); _sawZ.set(0, 0, 1).applyQuaternion(SAW.g.quaternion);
  SAW.A.set(0, SAW_BAR[0], 0).applyMatrix4(SAW.g.matrixWorld); SAW.B.set(0, SAW_BAR[1] + SAW_R, 0).applyMatrix4(SAW.g.matrixWorld);
  SAW.vel.subVectors(SAW.B, SAW.last).multiplyScalar(1 / Math.max(dt, 1e-3)); SAW.last.copy(SAW.B);
  // the chain runs (and blurs when it's really flying)
  if (SAW.rpm > .22) { SAW.phase += dt * (SAW.rpm - .2) * 3.2; sawChain(); }
  SAW.blur.material.opacity = clamp((SAW.rpm - .45) * 1.2, 0, .55); SAW.blur.visible = SAW.blur.material.opacity > .01;
  if (h) {
    // exhaust puffs
    if ((SAW.smokeT -= dt) < 0) { SAW.smokeT = .4 - SAW.rpm * .22; _sawP.set(-.005, .26, .08).applyMatrix4(SAW.g.matrixWorld); _rfV.copy(_sawZ).multiplyScalar(.25).add(_rv.set(0, .2, 0)); rfxAdd(_sawP, _rfV, .011, .011, .011, SAW.rpm > .6 ? 0x9a9a9a : 0xc8c8c8, .7, -.4, 2.5, -1e3); }
    if (SAW.rpm > .3) { sawDummies(dt); sawWorld(); }
    // vibration
    if ((SAW.buzzT -= dt) < 0) { SAW.buzzT = .05; buzz(h, clamp(.12 + SAW.rpm * .35 + SAW.load * .6, 0, 1), 60); }
  }
  sawSound();
}
// chewing through a dummy: it shakes and sprays, then the chain goes right through and it falls apart in two halves
// along the blade (Isaiah: "go halfway in the middle and it should split them in half"). The halves can be cut again.
function sawGrind(p, fur, floor, dt, o) {   // stuffing / gore spraying off the chain
  if ((o.sprayT = (o.sprayT || 0) - dt) > 0) return; o.sprayT = .035;
  for (let j = 0; j < 3; j++) { _rfV.copy(_sawX).multiplyScalar(-1.2).add(_rv.set(Math.random() - .5, Math.random() * .5, Math.random() - .5).multiplyScalar(1.6));
    if (HZ.on) rfxAdd(p, _rfV, .01, .008, .01, pick([0x7a0f14, 0x9b1b1f, 0xb83a3a]), 6, 9.8, .3, floor, 1); else rfxAdd(p, _rfV, .012, .01, .012, j ? 0xffffff : fur, 8, 3.2, 1.6, floor); }
}
function sawDummies(dt) {
  const sp = Math.max(SAW.rpm, .45);   // even at idle it chews (just slower); revving is faster
  for (const rd of RD.list.slice()) {
    if (tAll - (rd.cutT || -9) < .35) continue;
    let hit = -1, bd = 1e9;
    // the hit zone is the whole bar + chain (with a bit of slack), against every body ball (made a bit fatter, like the fluffy mesh)
    rd.P.forEach((q, i) => { const d = distToSeg(q.p, SAW.A, SAW.B) - q.r * 1.3 - .05; if (d < 0 && d < bd) { bd = d; hit = i; } });
    if (hit < 0) { if (tAll - (rd.sawLast || -9) > .5) rd.sawT = 0; continue; }
    rd.sawLast = tAll; rd.sawT = (rd.sawT || 0) + dt * sp; SAW.load = 1;
    rd.asleep = false; rd.sleep = 0; rd.calm = 0;
    const hp = rd.P[hit].p;
    for (const q of rd.P) { if (q.pin) continue; const k = clamp(1 - q.p.distanceTo(hp) / .5, 0, 1) * .005; if (k > 0) q.p.add(_rv.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(k * 2)); }
    sawGrind(hp, rd.look.fur, rd.floor, dt, rd);
    if (rd.sawT > .28) sawCutRagdoll(rd);
  }
}

/* ---------------- sawing a ragdoll in two: the pieces STAY floppy ragdolls ----------------
   The dummy's look becomes one triangle soup that is cut along the blade (with a stuffed cut face). The body balls are
   split by the same plane and every joint that crosses it is removed, so each side keeps its own joints and physics:
   still floppy, grabbable, throwable, bonkable, and you can saw it again. Each point of the soup rides on the 3 nearest
   body balls of its own piece (a little triangle frame), so the pieces bend and flop with their balls. */
const SLC = { mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide }) };
const _slN3 = new THREE.Matrix3(), _slv0 = V(), _slv1 = V(), _slv2 = V(), _slCol = new THREE.Color();
// read a mesh into a world-space triangle soup: positions, normals, colors (9 floats per triangle each)
function slcRead(m, P, N, C) {
  const g = m.geometry, pa = g.attributes.position, na = g.attributes.normal, ca = g.attributes.color; if (!pa || !ca) return;
  const mw = m.matrixWorld; _slN3.getNormalMatrix(mw); const idx = g.index, cnt = idx ? idx.count : pa.count;
  for (let t = 0; t < cnt; t++) {
    const i = idx ? idx.getX(t) : t;
    _slv0.fromBufferAttribute(pa, i).applyMatrix4(mw); P.push(_slv0.x, _slv0.y, _slv0.z);
    if (na) _slv1.fromBufferAttribute(na, i).applyMatrix3(_slN3).normalize(); else _slv1.set(0, 1, 0); N.push(_slv1.x, _slv1.y, _slv1.z);
    C.push(ca.getX(i), ca.getY(i), ca.getZ(i));
  }
}
// cut a soup with the plane n·x = d: returns the two sides, each with a stuffed cap where the cut went through
function slcClip(P, N, C, n, d, inside) {
  const side = [{ P: [], N: [], C: [] }, { P: [], N: [], C: [] }], segs = [];
  const put = (o, a, b, c) => { for (const v of [a, b, c]) { o.P.push(v[0], v[1], v[2]); o.N.push(v[3], v[4], v[5]); o.C.push(v[6], v[7], v[8]); } };
  const vert = i => [P[i], P[i + 1], P[i + 2], N[i], N[i + 1], N[i + 2], C[i], C[i + 1], C[i + 2]];
  const lerp = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);
  for (let t = 0; t < P.length; t += 9) {
    const v = [vert(t), vert(t + 3), vert(t + 6)], s = v.map(q => q[0] * n.x + q[1] * n.y + q[2] * n.z - d);
    const pos = s.map(x => x >= 0);
    if (pos[0] === pos[1] && pos[1] === pos[2]) { put(side[pos[0] ? 0 : 1], v[0], v[1], v[2]); continue; }
    // the lone vertex is on one side, the other two on the other
    const lone = pos[0] !== pos[1] && pos[0] !== pos[2] ? 0 : pos[1] !== pos[0] && pos[1] !== pos[2] ? 1 : 2, a = v[lone], b = v[(lone + 1) % 3], c = v[(lone + 2) % 3];
    const sa = s[lone], sb = s[(lone + 1) % 3], sc = s[(lone + 2) % 3];
    const ab = lerp(a, b, sa / (sa - sb)), ac = lerp(a, c, sa / (sa - sc));
    const L = side[pos[lone] ? 0 : 1], O = side[pos[lone] ? 1 : 0];
    put(L, a, ab, ac); put(O, ab, b, c); put(O, ab, c, ac);
    segs.push([ab[0], ab[1], ab[2]], [ac[0], ac[1], ac[2]]);
  }
  // caps: join the cut segments into loops (they share end points) and fill each loop with a fan from its middle
  const key = p => Math.round(p[0] * 2e3) + ',' + Math.round(p[1] * 2e3) + ',' + Math.round(p[2] * 2e3), par = new Map();
  const find = k => { while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; };
  for (let i = 0; i < segs.length; i += 2) { const ka = key(segs[i]), kb = key(segs[i + 1]); if (!par.has(ka)) par.set(ka, ka); if (!par.has(kb)) par.set(kb, kb); par.set(find(ka), find(kb)); }
  const groups = new Map();
  for (let i = 0; i < segs.length; i += 2) { const r = find(key(segs[i])); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  for (const list of groups.values()) {
    const c = [0, 0, 0]; for (const i of list) for (const q of [segs[i], segs[i + 1]]) { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; } c.forEach((x, k) => { c[k] = x / (list.length * 2); });
    for (const i of list) {
      const ins = inside(), cc = [ins.r, ins.g, ins.b], A = segs[i], B = segs[i + 1];
      // wind each cap triangle so its front faces out of its own half (two-sided material lights back faces dark)
      const w = ((A[1] - c[1]) * (B[2] - c[2]) - (A[2] - c[2]) * (B[1] - c[1])) * n.x + ((A[2] - c[2]) * (B[0] - c[0]) - (A[0] - c[0]) * (B[2] - c[2])) * n.y + ((A[0] - c[0]) * (B[1] - c[1]) - (A[1] - c[1]) * (B[0] - c[0])) * n.z;
      const [P0, P1] = w > 0 ? [B, A] : [A, B];
      put(side[0], [...c, -n.x, -n.y, -n.z, ...cc], [...P0, -n.x, -n.y, -n.z, ...cc], [...P1, -n.x, -n.y, -n.z, ...cc]);
      put(side[1], [...c, n.x, n.y, n.z, ...cc], [...P1, n.x, n.y, n.z, ...cc], [...P0, n.x, n.y, n.z, ...cc]);
    }
  }
  return { side, cut: segs.length > 0 };
}
const slcInside = () => () => HZ.on ? _slCol.setHex(Math.random() < .2 ? 0xe9dcc4 : Math.random() < .5 ? 0x9b1b1f : 0x7a0f14) : _slCol.setHex(Math.random() < .5 ? 0xffffff : 0xf1ebdd);
function rdSoup(rd) {   // what the dummy looks like right now, as a world-space triangle soup
  if (rd.cut) { const g = rd.cut.mesh.geometry; return { P: Array.from(g.attributes.position.array), N: Array.from(g.attributes.normal.array), C: Array.from(g.attributes.color.array) }; }
  rd.g.updateMatrixWorld(true); const P = [], N = [], C = [];
  rd.g.traverse(m => { if (m.isMesh && m.geometry) { let v = true; for (let o = m; o && o !== rd.g; o = o.parent) if (!o.visible) v = false; if (v) slcRead(m, P, N, C); } });
  return { P, N, C };
}
const _cb1 = V(), _cb2 = V(), _cb3 = V(), _cbM = new THREE.Matrix3(), _cbD = V();
function sawCutRagdoll(rd) {
  const S = rdSoup(rd), { n, d } = sawPlane(), cut = slcClip(S.P, S.N, S.C, n, d, slcInside());
  const nA = cut.side[0].P.length, nB = cut.side[1].P.length, tot = S.P.length;
  if (!cut.cut || nA < tot * .02 || nB < tot * .02) { rd.sawT = 0; return; }   // only nicked the edge: keep sawing
  const P = rd.P, side = P.map(q => q.p.dot(n) - d >= 0 ? 0 : 1);
  // every side needs body balls: a piece of mesh with none (an ear, a slice of belly) gets its own little balls
  for (const s of [0, 1]) if (!side.includes(s)) { const SP = cut.side[s].P; const c = V(); for (let i = 0; i < SP.length; i += 3) c.add(_cbD.set(SP[i], SP[i + 1], SP[i + 2])); c.multiplyScalar(3 / SP.length); P.push({ p: c.clone(), o: c.clone(), r: .04, im: 1, pin: null }); side.push(s); }
  rd.C = rd.C.filter(c => side[c.a] === side[c.b]);   // joints across the cut are gone
  // which balls still hang together (pieces)
  const par = P.map((_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  for (const c of rd.C) par[f(c.a)] = f(c.b);
  // a piece with fewer than 3 balls gets helper balls (needed to know how it turns), stiffly joined to it
  const groups = new Map(); P.forEach((_, i) => { const r = f(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  for (const g of [...groups.values()]) {
    if (g.length >= 3) continue;
    const s = side[g[0]], SP = cut.side[s].P, base = P[g[0]].p; let far = null, fd = -1;
    for (let i = 0; i < SP.length; i += 3) { const dd = base.distanceToSquared(_cbD.set(SP[i], SP[i + 1], SP[i + 2])); if (dd > fd && dd < .16) { fd = dd; far = _cbD.clone(); } }
    if (!far) far = base.clone().add(V(.05, 0, 0));
    const mid = base.clone().lerp(far, .6), side2 = V().crossVectors(_cbD.subVectors(far, base), n).setLength(.04);
    const add = [mid.clone().add(side2), mid.clone().sub(side2), base.clone().addScaledVector(n, s ? -.03 : .03)].slice(0, 3 - g.length + 1);
    for (const p of add) { const i = P.length; P.push({ p: p.clone(), o: p.clone(), r: .03, im: 1, pin: null }); side.push(s); par.push(i); for (const j of g) rd.C.push({ a: i, b: j, L: P[i].p.distanceTo(P[j].p), k: 'h' }); g.push(i); }
    for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) if (!rd.C.some(c => (c.a === g[x] && c.b === g[y]) || (c.a === g[y] && c.b === g[x]))) rd.C.push({ a: g[x], b: g[y], L: P[g[x]].p.distanceTo(P[g[y]].p), k: 'h' });
  }
  // glue the two sides' soups into one mesh, each point riding on 3 nearby balls of its own side
  const nv = (nA + nB) / 3, pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const bi = new Uint16Array(nv * 3), bw = new Float32Array(nv * 6);
  let o = 0;
  const ballsOf = s => P.map((q, i) => i).filter(i => side[i] === s);
  for (const s of [0, 1]) {
    const SD = cut.side[s], B = ballsOf(s);
    for (let i = 0; i < SD.P.length; i += 3, o++) {
      pos.set([SD.P[i], SD.P[i + 1], SD.P[i + 2]], o * 3); nrm.set([SD.N[i], SD.N[i + 1], SD.N[i + 2]], o * 3); col.set([SD.C[i], SD.C[i + 1], SD.C[i + 2]], o * 3);
      _cbD.set(SD.P[i], SD.P[i + 1], SD.P[i + 2]);
      // nearest ball, then the nearest balls of the SAME piece that make a good (not flat) triangle with it
      let a = B[0], ad = 1e9; for (const j of B) { const dd = P[j].p.distanceToSquared(_cbD); if (dd < ad) { ad = dd; a = j; } }
      const ra = f(a), mates = B.filter(j => j !== a && f(j) === ra && P[j].p.distanceToSquared(P[a].p) > 4e-4).sort((x, y) => P[x].p.distanceToSquared(_cbD) - P[y].p.distanceToSquared(_cbD));
      if (mates.length < 2) for (const j of B.filter(j => j !== a && !mates.includes(j)).sort((x, y) => P[x].p.distanceToSquared(_cbD) - P[y].p.distanceToSquared(_cbD))) { if (mates.length >= 2) break; mates.push(j); }
      let b = mates[0], c = mates[1], best = -1;
      for (let x = 0; x < Math.min(mates.length, 5); x++) for (let y = x + 1; y < Math.min(mates.length, 6); y++) {
        _cb1.subVectors(P[mates[x]].p, P[a].p); _cb2.subVectors(P[mates[y]].p, P[a].p);
        const q = _cb3.crossVectors(_cb1, _cb2).length() / (_cb1.length() * _cb2.length() + 1e-9) - (x + y) * .05;
        if (q > best) { best = q; b = mates[x]; c = mates[y]; }
      }
      bi[o * 3] = a; bi[o * 3 + 1] = b; bi[o * 3 + 2] = c;
      rdFrame(P, a, b, c); _cbM.invert();
      _cb1.subVectors(_cbD, P[a].p).applyMatrix3(_cbM); bw[o * 6] = _cb1.x; bw[o * 6 + 1] = _cb1.y; bw[o * 6 + 2] = _cb1.z;
      _cb1.set(SD.N[i], SD.N[i + 1], SD.N[i + 2]).applyMatrix3(_cbM); bw[o * 6 + 3] = _cb1.x; bw[o * 6 + 4] = _cb1.y; bw[o * 6 + 5] = _cb1.z;
    }
  }
  // swap the old look for the new one
  const old = rd.cut; rd.g.clear(); if (old) old.mesh.geometry.dispose();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, SLC.mat); mesh.castShadow = true; mesh.frustumCulled = false; rd.g.add(mesh);
  rd.cut = { mesh, bi, bw, n: nv };
  rd.W.ripped = true; rd.W.pulled = false; rd.C = rd.C.filter(c => c.k !== 'w' || side[c.a] === side[c.b]); for (const c of rd.C) if (c.k === 'w') c.k = 'h';
  for (const g2 in rd.G) rd.G[g2].pulled = false;
  P.forEach((_, i) => { rd.det[i] = true; }); rd.stand = 0; rd.anchor = null; rd.pairs = null; rd.cutT = tAll; rd.sawT = 0; rd.asleep = false; rd.sleep = 0;
  // the two sides spring apart a little
  P.forEach((q, i) => { if (!q.pin) q.o.addScaledVector(n, side[i] ? .006 : -.006); });
  slcSplitFx(_rv.copy(SAW.A).lerp(SAW.B, .5), n, rd.look.fur, rd.floor, true);
  if (!SAW.toldCut) { SAW.toldCut = true; toast(HZ.on ? '🪚 SLICED! The pieces are still floppy... keep cutting!' : '🪚 SLICED IN HALF! Grab the floppy pieces, throw them, or saw them again! 🧸', 5); }
}
// a little frame from 3 balls: the first two edges plus their (scaled) normal, as columns of _cbM
function rdFrame(P, a, b, c) {
  _cb1.subVectors(P[b].p, P[a].p); _cb2.subVectors(P[c].p, P[a].p); _cb3.crossVectors(_cb1, _cb2);
  const l = _cb3.length() || 1e-9; _cb3.multiplyScalar(Math.sqrt((_cb1.length() * _cb2.length()) || 1e-6) / l);
  _cbM.set(_cb1.x, _cb2.x, _cb3.x, _cb1.y, _cb2.y, _cb3.y, _cb1.z, _cb2.z, _cb3.z); return _cbM;
}
function rdCutDraw(rd) {   // from rdDraw: move every point with its 3 balls
  const C = rd.cut, P = rd.P, pa = C.mesh.geometry.attributes.position, na = C.mesh.geometry.attributes.normal, A = pa.array, Nn = na.array, bi = C.bi, bw = C.bw;
  let la = -1, lb = -1, lc = -1, e;
  for (let v = 0; v < C.n; v++) {
    const a = bi[v * 3], b = bi[v * 3 + 1], c = bi[v * 3 + 2];
    if (a !== la || b !== lb || c !== lc) { rdFrame(P, a, b, c); e = _cbM.elements; la = a; lb = b; lc = c; }
    const pa0 = P[a].p, u = bw[v * 6], w = bw[v * 6 + 1], z = bw[v * 6 + 2], k = v * 3;
    A[k] = pa0.x + e[0] * u + e[3] * w + e[6] * z; A[k + 1] = pa0.y + e[1] * u + e[4] * w + e[7] * z; A[k + 2] = pa0.z + e[2] * u + e[5] * w + e[8] * z;
    const nu = bw[v * 6 + 3], nw = bw[v * 6 + 4], nz = bw[v * 6 + 5];
    let x = e[0] * nu + e[3] * nw + e[6] * nz, y = e[1] * nu + e[4] * nw + e[7] * nz, q = e[2] * nu + e[5] * nw + e[8] * nz; const l = Math.hypot(x, y, q) || 1;
    Nn[k] = x / l; Nn[k + 1] = y / l; Nn[k + 2] = q / l;
  }
  pa.needsUpdate = true; na.needsUpdate = true;
}
function slcSplitFx(p, n, fur, floor, big) {
  rdBurst(p, n, HZ.on ? 12 : 16, floor); rdBurst(p, _rv.copy(n).negate(), HZ.on ? 12 : 16, floor);
  if (HZ.on) splatAdd(p.x, floor, p.z, big ? .3 : .18);
  if (ac) { noiseHit(ac.currentTime, .25, .25, 'bandpass', 1600, 1); tone('square', 160, 60, .2, .1); if (HZ.on) tone('sawtooth', 110, 40, .3, .1, .05); else tone('triangle', 700, 300, .15, .1, .05); }
  if (SAW.held) buzz(SAW.held, 1, 160);
}
// the plane goes along the bar, through the chain
function sawPlane() { const n = _sawZ.clone().normalize(); return { n, d: n.dot(SAW.A) }; }
// the saw cuts the yard's cubes too (straight along the bar), and knocks them about
function sawWorld() {
  if (state.area !== 'arena' || typeof AR === 'undefined' || !AR.pieces) return;
  for (const pc of AR.pieces) {
    if (!pc.body || pc.dying || pc.held || pc.pane || pc.inQ || pc.pop < 1 || tAll - (pc.sawT || 0) < .3) continue;
    const t = pc.body.translation();
    let at = null;
    for (let k = 0; k <= 6; k++) {
      _sawP.lerpVectors(SAW.A, SAW.B, k / 6).sub(ARENA);
      if ((t.x - _sawP.x) ** 2 + (t.y - _sawP.y) ** 2 + (t.z - _sawP.z) ** 2 > (pc.rad + .03) ** 2) continue;
      if (outside(pc.parts, toLocal(pc, _sawP, _sawL)) < .012) { at = _sawP.clone(); break; }
    }
    if (!at || (typeof mine === 'function' && !mine(pc))) continue;
    pc.sawT = tAll; SAW.load = 1;
    const e = toLocal(pc, at, V()), n = toLocal(pc, _sawN.copy(at).add(_sawZ), V()).sub(e).normalize();
    pc.inQ = true; AR.cutQ.push({ pc, lines: [[n.clone(), n.dot(e)]], bis: [], nMain: n.clone(), e, sp: 3, extreme: false });
    const m = pc.body.mass() * .6; pc.body.applyImpulse({ x: (Math.random() - .5) * m, y: m * .5, z: (Math.random() - .5) * m }, true);
    _sawP.copy(at).add(ARENA); const kc = KINDS[pc.kind];
    for (let j = 0; j < 8; j++) { _rfV.copy(_sawX).multiplyScalar(-1.4).add(_rv.set(Math.random() - .5, Math.random(), Math.random() - .5).multiplyScalar(1.5)); rfxAdd(_sawP, _rfV, .01, .008, .01, j % 2 ? kc.ins : kc.out, 4, 9.8, .5, ARENA.y + .005); }
    if (ac) noiseHit(ac.currentTime, .12, .08, 'bandpass', 3200, 1);
  }
}
window.__kg.saw = { SAW, RW, take: sawTake, drop: sawDrop, home: sawHome, cut: sawCutRagdoll, pin: rwPin, rip: rwRip };
