// ===== WEAPONS: real-feeling weapons on a table. Heavy ones lag, sag and swing slowly; two hands help. =====
// Each weapon is a loose physics body (kind 'weapon'). When held, springs pull it toward your hand:
// light weapons follow almost exactly, heavy ones trail behind with momentum (and gravity drags them down).
const WMAT = {
  steel: new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: .9, roughness: .28 }),
  dark: new THREE.MeshStandardMaterial({ color: '#4a4d55', metalness: .8, roughness: .45 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7a4b28', roughness: .85 }),
  leather: new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: .9 }),
  gold: new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: .85, roughness: .3 }),
};
const wm = (geo, mat, x, y, z, g, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
// a flat blade that narrows to a point (length along +y)
function bladeGeo(w, len, th, tipLen) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w * .42, len - tipLen); s.lineTo(0, len); s.lineTo(-w * .42, len - tipLen); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th * .4, bevelSize: th * .5, bevelSegments: 1 });
  g.translate(0, 0, -th / 2); return g;
}
function wrapGrip(g, r, y0, y1, mat) {
  wm(new THREE.CylinderGeometry(r, r, y1 - y0, 10), mat, 0, (y0 + y1) / 2, 0, g);
  for (let y = y0 + .02; y < y1 - .01; y += .035) wm(new THREE.TorusGeometry(r, r * .22, 4, 12), mat, 0, y, 0, g, Math.PI / 2);
}
// every weapon: built with the handle bottom at y=0, then shifted so the origin is the centre of mass
const WDEF = {
  sword: { mass: 1.3, com: .33, grip: [.02, .19], len: 1.06, build(g) {
    wrapGrip(g, .016, 0, .2, WMAT.leather);
    wm(new THREE.SphereGeometry(.028, 12, 10), WMAT.gold, 0, -.015, 0, g);
    wm(new THREE.BoxGeometry(.22, .026, .04), WMAT.gold, 0, .21, 0, g);
    [-1, 1].forEach(s => wm(new THREE.SphereGeometry(.018, 8, 6), WMAT.gold, s * .11, .21, 0, g));
    wm(bladeGeo(.052, .84, .006, .12), WMAT.steel, 0, .222, 0, g);
    wm(new THREE.BoxGeometry(.012, .6, .009), WMAT.dark, 0, .55, 0, g);
  }, dmg: [[0, .4, 'edge'], [0, .6, 'edge'], [0, .8, 'edge'], [0, .97, 'edge'], [0, 1.06, 'tip']], sever: 3.6 },
  dagger: { mass: .45, com: .13, grip: [.01, .1], len: .4, build(g) {
    wrapGrip(g, .013, 0, .11, WMAT.leather);
    wm(new THREE.SphereGeometry(.02, 10, 8), WMAT.dark, 0, -.01, 0, g);
    wm(new THREE.BoxGeometry(.09, .018, .03), WMAT.dark, 0, .118, 0, g);
    wm(bladeGeo(.032, .28, .005, .08), WMAT.steel, 0, .127, 0, g);
  }, dmg: [[0, .25, 'edge'], [0, .35, 'edge'], [0, .4, 'tip']], sever: 5 },
  axe: { mass: 2.2, com: .5, grip: [.03, .52], len: .8, build(g) {
    wm(new THREE.CylinderGeometry(.019, .023, .8, 10), WMAT.wood, 0, .4, 0, g);
    wrapGrip(g, .025, .02, .2, WMAT.leather);
    const s = new THREE.Shape(); s.moveTo(0, -.04); s.lineTo(.09, -.06); s.quadraticCurveTo(.2, -.11, .22, -.13); s.quadraticCurveTo(.24, 0, .22, .1); s.quadraticCurveTo(.15, .06, .09, .05); s.lineTo(0, .04); s.lineTo(0, -.04);
    const hg = new THREE.ExtrudeGeometry(s, { depth: .014, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 1 }); hg.translate(0, 0, -.007);
    wm(hg, WMAT.steel, .01, .7, 0, g);
    wm(new THREE.BoxGeometry(.06, .07, .045), WMAT.dark, -.01, .7, 0, g);
    wm(new THREE.BoxGeometry(.05, .045, .04), WMAT.dark, -.06, .7, 0, g);
  }, dmg: [[.22, .6, 'edge'], [.235, .68, 'edge'], [.22, .78, 'edge'], [-.08, .7, 'blunt']], sever: 2.8 },
  spear: { mass: 2.4, com: .95, grip: [.2, 1.45], len: 2.08, build(g) {
    wm(new THREE.CylinderGeometry(.017, .019, 1.85, 10), WMAT.wood, 0, .925, 0, g);
    wm(new THREE.CylinderGeometry(.022, .018, .05, 10), WMAT.dark, 0, .02, 0, g);
    wm(new THREE.CylinderGeometry(.015, .021, .09, 10), WMAT.dark, 0, 1.88, 0, g);
    const b = wm(new THREE.SphereGeometry(.05, 12, 10), WMAT.steel, 0, 1.99, 0, g); b.scale.set(.75, 2.1, .18);
    wrapGrip(g, .021, .6, .8, WMAT.leather);
  }, dmg: [[0, 1.98, 'edge'], [0, 2.08, 'tip']], sever: 4.5 },
  mace: { mass: 3, com: .44, grip: [.02, .36], len: .74, build(g) {
    wm(new THREE.CylinderGeometry(.018, .02, .6, 10), WMAT.dark, 0, .3, 0, g);
    wrapGrip(g, .021, 0, .24, WMAT.leather);
    wm(new THREE.SphereGeometry(.05, 14, 12), WMAT.dark, 0, .63, 0, g);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; wm(new THREE.BoxGeometry(.012, .11, .05), WMAT.steel, Math.cos(a) * .05, .63, Math.sin(a) * .05, g, 0, -a, 0); }
    wm(new THREE.ConeGeometry(.018, .06, 8), WMAT.steel, 0, .71, 0, g);
  }, dmg: [[0, .63, 'blunt'], [0, .71, 'tip']], blunt: true },
  sledge: { mass: 9, com: .86, grip: [.03, .85], len: 1.12, build(g) {
    wm(new THREE.CylinderGeometry(.021, .026, 1.05, 10), WMAT.wood, 0, .525, 0, g);
    wrapGrip(g, .028, .02, .22, WMAT.leather);
    wm(new THREE.BoxGeometry(.34, .13, .13), WMAT.dark, 0, 1.04, 0, g);
    [-1, 1].forEach(s => { wm(new THREE.BoxGeometry(.03, .145, .145), WMAT.steel, s * .17, 1.04, 0, g); wm(new THREE.BoxGeometry(.03, .15, .15), WMAT.dark, s * .06, 1.04, 0, g); });
  }, dmg: [[.18, 1.04, 'blunt'], [-.18, 1.04, 'blunt'], [0, 1.04, 'blunt']], blunt: true },
  warhammer: { mass: 16, com: 1.08, grip: [.05, 1.0], len: 1.42, build(g) {
    wm(new THREE.CylinderGeometry(.028, .034, 1.3, 10), WMAT.dark, 0, .65, 0, g);
    wrapGrip(g, .036, .04, .3, WMAT.leather); wrapGrip(g, .036, .7, .95, WMAT.leather);
    wm(new THREE.BoxGeometry(.48, .22, .22), WMAT.dark, 0, 1.26, 0, g);
    [-1, 1].forEach(s => { wm(new THREE.BoxGeometry(.04, .25, .25), WMAT.gold, s * .25, 1.26, 0, g); wm(new THREE.ConeGeometry(.04, .1, 6), WMAT.steel, 0, 1.26 + s * .15, 0, g, s < 0 ? Math.PI : 0); });
    wm(new THREE.ConeGeometry(.05, .16, 8), WMAT.steel, 0, 1.45, 0, g);
  }, dmg: [[.26, 1.26, 'blunt'], [-.26, 1.26, 'blunt'], [0, 1.26, 'blunt'], [0, 1.45, 'tip']], blunt: true },
};
const WEAPONS = [];
const TABLE = { x: -2.2, z: -.55, top: .8, hx: .6, hz: .85 };
// [x, y, z, lay]  lay 0 = flat on the table pointing at you, 1 = spear along the back edge, 2 = flat on the floor
const WSPOTS = { dagger: [TABLE.x + .12, TABLE.top + .03, .1, 0], sword: [TABLE.x + .15, TABLE.top + .03, -.22, 0], axe: [TABLE.x + .05, TABLE.top + .03, -.6, 0], mace: [TABLE.x, TABLE.top + .07, -1.05, 0],
  spear: [TABLE.x - .45, TABLE.top + .03, -.45, 1], sledge: [-1.2, .08, .6, 2], warhammer: [-1.15, .13, -1.75, 2] };
function makeWeapon(type) {
  const d = WDEF[type];
  const inner = new THREE.Group(); d.build(inner); inner.position.y = -d.com;
  const g = new THREE.Group(); g.add(inner); scene.add(g);
  const samples = [new V3(0, -d.com, 0), new V3(0, d.len - d.com, 0), new V3(0, (d.len / 2) - d.com, 0)];
  for (const [x, y] of d.dmg) samples.push(new V3(x, y - d.com, .02), new V3(x, y - d.com, -.02));
  const b = makeLoose(g, { mass: d.mass, k: d.len * .3, kind: 'weapon', r: d.len * .5, samples });
  b.type = type; b.def = d; b.hands = []; b.hitCool = 0;
  b.dmg = d.dmg.map(([x, y, kind]) => ({ p: new V3(x, y - d.com, 0), kind }));
  b.g0 = new V3(0, d.grip[0] - d.com, 0); b.g1 = new V3(0, d.grip[1] - d.com, 0);
  WEAPONS.push(b); resetWeapon(b);
  return b;
}
const LAY_FLAT = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(0, 0, -1), new V3(-1, 0, 0), new V3(0, 1, 0)));   // handle points at you
const LAY_ALONG = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(1, 0, 0), new V3(0, 0, 1), new V3(0, -1, 0)));
function resetWeapon(b) {
  const [x, y, z, lay] = WSPOTS[b.type];
  b.obj.position.set(x, y, z);
  b.obj.quaternion.copy(lay === 1 ? LAY_ALONG : LAY_FLAT);
  b.v.set(0, 0, 0); b.w.set(0, 0, 0); b.still = 0;
  b.hands = []; b.held = null; b.soft = false; b.pc2 = false;
}
function setupWeapons() { if (WEAPONS.length) return; for (const t of Object.keys(WDEF)) makeWeapon(t); }
// closest point on the handle (local) to a world point; returns {local, dist}
function weaponGripAt(b, wp) {
  const a = b.obj.localToWorld(b.g0.clone()), c = b.obj.localToWorld(b.g1.clone());
  const ab = c.clone().sub(a), t = clamp(wp.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  const pt = a.addScaledVector(ab, t);
  return { local: b.g0.clone().lerp(b.g1, t), dist: pt.distanceTo(wp) };
}
function weaponGripRay(b, o, d, maxT) {
  let best = null;
  for (let k = 0; k <= 8; k++) {
    const lp = b.g0.clone().lerp(b.g1, k / 8), w = b.obj.localToWorld(lp.clone());
    const t = _v2.subVectors(w, o).dot(d); if (t < .2 || t > maxT) continue;
    const off = _v3.copy(o).addScaledVector(d, t).distanceTo(w);
    if (off < .07 && (!best || t < best.t)) best = { local: lp, t };
  }
  return best;
}
// --- holding: springs drive the weapon toward where your hand(s) want it ---
const GRIP_TILT = new Q().setFromEuler(new THREE.Euler(-Math.PI / 2 + .35, 0, 0));
const _wm = new THREE.Matrix4(), _wq = new Q(), _wq2 = new Q(), _wt = new V3();
function driveWeapon(b, dt) {
  const hs = b.hands.filter(h => h.H.grab && h.H.grab.weapon === b && h.H.mat);
  if (!hs.length) return;
  const m = b.m, two = hs.length > 1 || !!b.pc2;
  const H0 = hs[0];
  const hp0 = new V3().setFromMatrixPosition(H0.H.mat);
  _wq.setFromRotationMatrix(_wm.extractRotation(H0.H.mat)).multiply(GRIP_TILT);
  if (hs.length > 1) {
    // two hands: the handle lines up between your hands (much more control)
    const hp1 = new V3().setFromMatrixPosition(hs[1].H.mat);
    const lo = H0.local.y < hs[1].local.y ? hp0 : hp1, hi = lo === hp0 ? hp1 : hp0;
    const dir = hi.clone().sub(lo); if (dir.lengthSq() > 1e-4) { dir.normalize(); const cur = new V3(0, 1, 0).applyQuaternion(_wq); _wq.premultiply(_wq2.setFromUnitVectors(cur, dir)); }
    _wt.copy(hp0).sub(H0.local.clone().applyQuaternion(_wq)).add(hp1.clone().sub(hs[1].local.clone().applyQuaternion(_wq))).multiplyScalar(.5);
  } else _wt.copy(hp0).sub(H0.local.clone().applyQuaternion(_wq));
  // linear spring (stiff for light weapons, soft for heavy ones) — gravity in stepLoose makes heavy ones sag
  const K = clamp(900 / m, 45, 900) * (two ? 2.6 : 1), C = 2 * Math.sqrt(K) * .9;
  const hv = avgVel(H0.H.vbuf, 3);
  _v1.subVectors(_wt, b.obj.position).multiplyScalar(K).addScaledVector(_v2.subVectors(hv, b.v), C);
  _v1.y += 9.8 * Math.min(1, 2.2 / m);                 // your arm holds light things up; heavy ones droop
  b.v.addScaledVector(_v1, dt);
  // angular spring
  _wq2.copy(_wq).multiply(_q1.copy(b.obj.quaternion).invert());
  if (_wq2.w < 0) { _wq2.x *= -1; _wq2.y *= -1; _wq2.z *= -1; _wq2.w *= -1; }
  const ang = 2 * Math.acos(clamp(_wq2.w, -1, 1)), sn = Math.sqrt(1 - _wq2.w * _wq2.w);
  const Kr = clamp(70 / Math.pow(m, .75), 3.2, 60) * (two ? 3 : 1);
  if (sn > 1e-4) { const wt = _v3.set(_wq2.x / sn, _wq2.y / sn, _wq2.z / sn).multiplyScalar(ang * Kr); b.w.lerp(wt, Math.min(1, dt * (two ? 14 : 9) / Math.sqrt(m / 1.3))); }
  // feel the weight: the further it lags, the harder the buzz
  const lag = _wt.distanceTo(b.obj.position);
  for (const h of hs) buzz(h.H.side, clamp(lag * 2 + m * .01, 0, .6), 16);
  b.still = 0;
}
// --- hitting things with weapons ---
const _dp = new V3(), _dv = new V3();
function stepWeapons(dt) {
  for (const b of WEAPONS) {
    if (b.held || b.hands.length) driveWeapon(b, dt);
    b.hitCool -= dt;
    if (b.held && !b.blessed && b.obj.position.distanceTo(GARY_POS) < .45) blessWeapon(b);
    if (b.v.lengthSq() + b.w.lengthSq() * .3 < 2) continue;
    for (const d of b.dmg) {
      _dp.copy(d.p).applyQuaternion(b.obj.quaternion).add(b.obj.position);
      _dv.crossVectors(b.w, _r.subVectors(_dp, b.obj.position)).add(b.v);
      const sp = _dv.length();
      if (b.held) RAG.pushers.push({ p: _dp.clone(), r: .045, v: _dv.clone().multiplyScalar(Math.min(1, b.m / 6)) });
      if (sp < 2.3 || b.hitCool > 0) continue;
      // the dummy
      if (DUM) {
        let i = ragNearest(_dp, .05);
        if (i >= 0 && d.kind === 'edge') {        // blades prefer limbs (so you can actually chop an arm off)
          let bj = -1, bdd = .09;
          for (let j = 0; j < RAG.p.length; j++) { if (!RAG.alive[j] || RAG.owner[j] === 'torso' || RAG.owner[j] === 'hips') continue; const dd = RAG.p[j].distanceTo(_dp) - RAG.r[j]; if (dd < bdd) { bdd = dd; bj = j; } }
          if (bj >= 0) i = bj;
        }
        if (i >= 0) { weaponHit(b, d, i, _dp.clone(), _dv.clone(), sp); break; }
      }
      // loose pieces (smash a head on the floor with a hammer!)
      for (const L of LOOSE) {
        if (L === b || L.kind === 'weapon' || L.held === undefined) continue;
        if (L.obj.position.distanceTo(_dp) < L.r * .5 + .05) {
          L.v.addScaledVector(_dv, Math.min(1.5, b.m / (L.m + 1))); L.w.add(_v1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(sp * 2)); L.still = 0;
          if (L.kind === 'head' && d.kind === 'blunt' && sp * Math.sqrt(b.m) > 5) smashHead(L, _dp.clone(), sp * 1.2);
          else { spawnBlood(_dp.clone(), _dv.clone().normalize(), 8, sp * .3, .6); sfx.thud(.6); }
          b.hitCool = .2; break;
        }
      }
    }
  }
}
function blessWeapon(b) {
  b.blessed = true; b.def = Object.assign({}, b.def, { sever: b.def.sever ? b.def.sever * .6 : 0 });
  const gm = new THREE.MeshStandardMaterial({ color: '#ffd84a', metalness: 1, roughness: .2, emissive: '#5a3c00' });
  b.obj.traverse(o => { if (o.isMesh && o.material !== WMAT.leather && o.material !== WMAT.wood) o.material = gm; });
  sfx.chime(); toast('🐔✨ BAWK! Gary blessed your weapon!');
}
function weaponHit(b, d, i, p, vel, sp) {
  b.hitCool = .22;
  if (window.__wlog) window.__wlog.push([b.type, d.kind, RAG.owner[i], +sp.toFixed(1)]);
  const owner = RAG.owner[i], P = DUM.parts[owner], force = sp * Math.sqrt(b.m), dir = vel.clone().normalize();
  const tor = owner === 'torso' || owner === 'hips';
  // shove the body (heavy weapons shove a LOT)
  ragAddVel(i, vel.clone().multiplyScalar(clamp(b.m / (b.m + 3), .15, .85) * (tor ? .7 : 1.1)), RAG.h || 1 / 120);
  const holders = b.hands.map(h => h.H.side);
  holders.forEach(s => buzz(s, clamp(force / 10, .3, 1), 70));
  if (d.kind === 'edge') {
    sfx.slice(); sfx.squish();
    addWound(p, dir, .03 + sp * .004, 'cut');
    spawnBlood(p, dir, 18 + sp * 3 | 0, sp * .35, .5);
    if (P && P.attached && sp > b.def.sever) { ripPart(P, dir, holders[0] || null); b.v.multiplyScalar(.85); }
    else if (tor && !RAG.split && sp > b.def.sever * 1.4 && _v1.addVectors(RAG.p[RAG.idx.Fr], RAG.p[RAG.idx.Lo]).multiplyScalar(.5).distanceTo(p) < .17) {
      RAG.waistTear += clamp(.12 * b.m, .15, .45); spawnBlood(p, dir, 40, 3, .7); sayDummy('MY WAIST!!'); b.v.multiplyScalar(.4);   // chop him in half!
    }
    else { if (tor) { const G = owner === 'hips' ? DUM.torso : DUM.torsoUp; addBleeder(G, G.worldToLocal(p.clone()), new V3(0, 0, 1), 3, 18); } b.v.multiplyScalar(.5); }
  } else if (d.kind === 'tip') {
    const along = dir.dot(new V3(0, 1, 0).applyQuaternion(b.obj.quaternion));
    if (along < .5) { sfx.thud(.5); b.v.multiplyScalar(.6); return; }
    sfx.squish(); sfx.crack();
    const w = addWound(p, dir, .028, 'stab');
    if (w) addBleeder(w.obj, w.obj.worldToLocal(w.point.clone()), w.obj.worldToLocal(w.point.clone().add(w.n)).sub(w.obj.worldToLocal(w.point.clone())), 6, 30);
    spawnBlood(p, dir.clone().negate(), 25, 2.5, .4);
    if (P && P.attached && b.type === 'spear' && sp > 5) { P.tear += .5; }
    b.v.multiplyScalar(.35);
  } else {
    // BLUNT: crush
    sfx.thud(1); sfx.crunch(); if (force > 9) sfx.crack();
    addWound(p, dir, clamp(.02 + force * .004, .025, .07), 'bruise');
    spawnBlood(p, dir, Math.min(50, force * 3 | 0), sp * .3, .8);
    if (owner === 'head') { if (force > 20 && DUM.parts.head.attached) DUM.hs += 2; headHit(p, force * .7); }
    if (P && P.attached && P.type !== 'head') { P.tear += force * .045; if (force > 14) P.tear = 1; }
    if (force > 8) RAG.ko = Math.max(RAG.ko, 2.5);
    if (force > 10 && RAG.pinned) unpin('OOOF!!');
    b.v.multiplyScalar(.55);
  }
  if (DUM.face) setFace('ouch', 1.2);
  if (state.t - DUM.said > 1.5) { DUM.said = state.t; sayDummy(pick(d.kind === 'blunt' ? LINES.slam : LINES.punch)); }
}
// the weapons table
{
  const g = new THREE.Group(); g.position.set(TABLE.x, 0, TABLE.z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.hx * 2, .06, TABLE.hz * 2), new THREE.MeshStandardMaterial({ color: '#7a4e2a', roughness: .9 })); top.position.y = TABLE.top - .03; top.castShadow = top.receiveShadow = true; g.add(top);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => [a * (TABLE.hx - .07), c * (TABLE.hz - .07)])) { const l = new THREE.Mesh(new THREE.BoxGeometry(.07, TABLE.top - .06, .07), WMAT.wood); l.position.set(x, (TABLE.top - .06) / 2, z); l.castShadow = true; g.add(l); }
  scene.add(g);
  CRATES.push({ x: TABLE.x, z: TABLE.z, h: TABLE.hx, hx: TABLE.hx, hz: TABLE.hz, top: TABLE.top });
}
