/* ======================================================================
   🧪 PHYSICS PLAYGROUND: the empty back half of the Slicing Yard (arena-local z < -4) is full of physics toys.
   - 🎳 BOWLING: a heavy ball + 10 pins (STRIKE counter). Push, slap or grab-and-throw the ball (PC: E to roll it).
   - 🁢 DOMINO RUN: 44 dominoes in an S curve. Knock the first one over.
   - 🪐 LOW-GRAVITY DOME: inside, you and everything else float (gravity x0.2). Beach balls drift around.
   - 🟦 TRAMPOLINES: 3 pads, each one bouncier.
   - 💨 WIND TUNNEL: a fan blows you up into the sky.
   - 🏗️ WRECKING BALL: press SWING and it smashes the crate tower (and bonks anyone in the way).
   Everything is a Rapier body in the yard's physics world (local only, like the dummies). Buttons reset things.
   ====================================================================== */
const PGND = { ready: false, dyn: [], held: [null, null], inDome: false, told: false, wb: { t: -1, ang: 1.15 }, bowlT: -1, found: new Set() };
try { JSON.parse(store.get('kg-plsec') || '[]').forEach(k => PGND.found.add(k)); } catch (e) { }
const PL_DOME = V(-9, 0, -9), PL_DOME_R = 3.6, PL_TUN = V(-9, 0, -15.5), PL_TUN_R = 1.25, PL_WB = V(13, 6.6, -11.5), PL_WB_L = 5.5, PL_WB_R = .7;
const PL_LANE = { x: 7, z0: -5, z1: -16.5 }, PL_TRAMP = [[-14.5, -5, 8.5], [-14.5, -8.5, 12.5], [-14.5, -12, 17]];
const _pl1 = V(), _pl2 = V(), _pl3 = V(), _plq = new THREE.Quaternion(), _plm = new THREE.Matrix4(), _pls = V(1, 1, 1);
const plGroup = new THREE.Group(); arena.add(plGroup);
function playGrav() { return PGND.inDome ? .2 : 1; }

/* ---------- the look ---------- */
{
  const g = plGroup, wood = smat(0xc8955a, { roughness: .6 }), dark = smat(0x2b3446, { roughness: .5 }), steel = smat(0x9aa3ae, { metalness: .6, roughness: .35 });
  // arch sign
  [-3.2, 3.2].forEach(x => part(new THREE.CylinderGeometry(.12, .14, 3.4, 12), dark, x, 1.7, -4.3, g));
  const st = labelTex(1024, 192, (q, w, h) => signText(q, w, h, [['🧪 PHYSICS PLAYGROUND', 92, '#7fffd4', 120]], 'rgba(14,20,30,.95)', '#7fffd4'));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.15), new THREE.MeshBasicMaterial({ map: st, transparent: true, side: THREE.DoubleSide })); sign.position.set(0, 3.3, -4.3); sign.material.side = THREE.FrontSide; g.add(sign); const back = sign.clone(); back.rotation.y = Math.PI; back.position.z -= .01; g.add(back);
  // bowling lane: wood floor, gutters, pin deck
  part(new THREE.BoxGeometry(1.6, .02, 12), wood, PL_LANE.x, .01, -10.6, g);
  [-1, 1].forEach(s => { part(new THREE.BoxGeometry(.25, .04, 12), dark, PL_LANE.x + s * .93, .02, -10.6, g); part(new THREE.BoxGeometry(.08, .35, 12), steel, PL_LANE.x + s * 1.1, .175, -10.6, g);
    addCol({ t: 0, x: ARENA.x + PL_LANE.x + s * 1.1, y: .175, z: ARENA.z - 10.6, hx: .04, hy: .175, hz: 6, tag: 'wood' }); });
  part(new THREE.BoxGeometry(2.4, 1.2, .2), dark, PL_LANE.x, .6, -16.8, g);
  for (let k = 0; k < 7; k++) part(new THREE.BoxGeometry(.12, .01, .12), smat(0xff4f6d), PL_LANE.x - .6 + k * .2, .025, -7.5, g);
  // low-gravity dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(PL_DOME_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb48cff, transparent: true, opacity: .16, roughness: .1, side: THREE.DoubleSide, depthWrite: false, emissive: 0x6a3aff, emissiveIntensity: .25 }));
  dome.position.copy(PL_DOME); g.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PL_DOME_R, .07, 8, 48), new THREE.MeshBasicMaterial({ color: 0xc08bff })); ring.rotation.x = Math.PI / 2; ring.position.copy(PL_DOME).setY(.05); g.add(ring);
  const dl = sprite('🪐 LOW GRAVITY', 2.2, '#c08bff', 56); dl.position.copy(PL_DOME).setY(PL_DOME_R + .7); g.add(dl);
  // trampolines
  PL_TRAMP.forEach(([x, z, b], i) => {
    const col = [0x3fb2ff, 0x8b6bff, 0xff4fa8][i];
    part(new THREE.CylinderGeometry(.95, .95, .3, 24), dark, x, .15, z, g); part(new THREE.CylinderGeometry(.82, .82, .04, 24), smat(col, { roughness: .4, emissive: col, emissiveIntensity: .2 }), x, .31, z, g);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .4; part(new THREE.CylinderGeometry(.05, .05, .3, 6), steel, x + Math.cos(a) * .85, .15, z + Math.sin(a) * .85, g); }
    addCol({ t: 1, x: ARENA.x + x, z: ARENA.z + z, cy: .16, hy: .16, r: .95, tag: 'wood', bounce: b });
    const lb = sprite(['🟦 BOING', '🟪 BOING!', '🟥 MEGA BOING!!'][i], 1.4, '#' + new THREE.Color(col).getHexString(), 50); lb.position.set(x, 1.7, z); g.add(lb);
  });
  // wind tunnel: fan + see-through rings
  part(new THREE.CylinderGeometry(PL_TUN_R + .15, PL_TUN_R + .25, .3, 28), dark, PL_TUN.x, .15, PL_TUN.z, g);
  addCol({ t: 1, x: ARENA.x + PL_TUN.x, z: ARENA.z + PL_TUN.z, cy: .15, hy: .15, r: PL_TUN_R + .25, tag: 'rock' });
  const fan = new THREE.Group(); fan.position.set(PL_TUN.x, .32, PL_TUN.z); g.add(fan); PGND.fan = fan;
  for (let k = 0; k < 5; k++) { const bl = part(new THREE.BoxGeometry(1.05, .02, .3), steel, 0, 0, 0, fan); bl.geometry.translate(.55, 0, 0); bl.rotation.set(.25, k / 5 * Math.PI * 2, 0); }
  for (let k = 1; k < 6; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(PL_TUN_R, .025, 6, 32), new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: .5 })); r.rotation.x = Math.PI / 2; r.position.set(PL_TUN.x, k * 1.6, PL_TUN.z); g.add(r); }
  const wl = sprite('💨 WIND TUNNEL', 2, '#9ff3ff', 54); wl.position.set(PL_TUN.x + 1.9, 2.2, PL_TUN.z); g.add(wl);
  const wg = new THREE.BufferGeometry(), wp = new Float32Array(240 * 3); for (let i = 0; i < 240; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * PL_TUN_R; wp.set([PL_TUN.x + Math.cos(a) * r, Math.random() * 9, PL_TUN.z + Math.sin(a) * r], i * 3); }
  wg.setAttribute('position', new THREE.BufferAttribute(wp, 3)); PGND.wind = new THREE.Points(wg, new THREE.PointsMaterial({ color: 0xffffff, size: .06, transparent: true, opacity: .7, depthWrite: false })); g.add(PGND.wind);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(.25, 0), new THREE.MeshStandardMaterial({ color: 0xffd25a, emissive: 0xffb000, emissiveIntensity: .9, metalness: .5, roughness: .3 })); star.position.set(PL_TUN.x, 8.2, PL_TUN.z); g.add(star); PGND.star = star;
  // wrecking ball frame
  [-1.8, 1.8].forEach(dx => { part(new THREE.BoxGeometry(.25, PL_WB.y + .2, .25), steel, PL_WB.x + dx, (PL_WB.y + .2) / 2, PL_WB.z, g); addCol({ t: 0, x: ARENA.x + PL_WB.x + dx, y: (PL_WB.y + .2) / 2, z: ARENA.z + PL_WB.z, hx: .13, hy: (PL_WB.y + .2) / 2, hz: .13, tag: 'rock' }); });
  part(new THREE.BoxGeometry(3.85, .25, .25), steel, PL_WB.x, PL_WB.y + .1, PL_WB.z, g);
  PGND.ball = part(new THREE.SphereGeometry(PL_WB_R, 24, 16), smat(0x30343c, { metalness: .7, roughness: .35 }), 0, 0, 0, g);
  PGND.chain = part(new THREE.CylinderGeometry(.04, .04, 1, 6), steel, 0, 0, 0, g);
  mergeStatic(g, c => c === fan || fan.children.includes(c) || c === PGND.ball || c === PGND.chain || c === star || c === PGND.wind || c === dome);
}
// buttons (same look as the party ones)
function plButton(p, yaw, label, col, css, act) { const b = partyButton(arena, p, yaw, label, col, css, act); P_BTNS.splice(P_BTNS.indexOf(b), 1); b.i = 90 + (PGND.nb = (PGND.nb || 0) + 1); return b; }
const PL_BTNS = [
  plButton(V(PL_LANE.x + 1.7, 0, -4.6), 0, '🎳 NEW PINS', 0xff4f6d, '#ff8aa0', () => plReset('bowl')),
  plButton(V(-2.2, 0, -5.4), 0, '🁢 DOMINOES', 0xffd25a, '#ffd25a', () => plReset('dom')),
  plButton(V(PL_WB.x - 2.6, 0, -6.2), 0, '🏗️ SWING!', 0xff8a3d, '#ffb07a', () => plSwing()),
  plButton(V(PL_DOME.x + 4.3, 0, PL_DOME.z + 2.4), 0, '🪐 NEW BALLS', 0x8b6bff, '#c08bff', () => plReset('dome'))
];

/* ---------- physics bodies ---------- */
function plInst(geo, m, n) { const im = new THREE.InstancedMesh(geo, m, n); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; plGroup.add(im); return im; }
function plBody(kind, desc, x, y, z, q, o = {}) {
  const R = AR.R, bd = R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setAngularDamping(o.ad ?? .1).setLinearDamping(o.ld ?? 0).setCcdEnabled(!!o.ccd);
  if (q) bd.setRotation(q); const b = AR.world.createRigidBody(bd);
  AR.world.createCollider(desc.setFriction(o.f ?? .6).setRestitution(o.r ?? .15).setDensity(o.d ?? 500), b);
  const D = { kind, b, home: { p: V(x, y, z), q: q ? { ...q } : { x: 0, y: 0, z: 0, w: 1 } }, im: o.im, idx: o.idx, m: o.m, r: o.rad || .2 }; PGND.dyn.push(D); return D;
}
function plInit() {
  const R = AR.R, C = R.ColliderDesc;
  // bowling: ball + pins
  const ballM = new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 16), smat(0x3b2cff, { metalness: .3, roughness: .15, emissive: 0x1a0f80, emissiveIntensity: .3 })); plGroup.add(ballM);
  [[.06, .07, -.08], [-.06, .07, -.06], [0, .1, -.12]].forEach(([x, y, z]) => part(new THREE.SphereGeometry(.025, 8, 6), smat(0x111111), x, y, z, ballM));
  PGND.bball = plBody('ball', C.ball(.2), PL_LANE.x, .21, -5.6, null, { m: ballM, d: 1400, r: .1, f: .4, rad: .2, ccd: true, ad: .05 });
  const pinPts = [[0, 0], [.06, .02], [.065, .06], [.045, .13], [.025, .2], [.035, .25], [.04, .3], [.03, .35], [0, .38]].map(([x, y]) => new THREE.Vector2(x, y - .19));
  const pinIm = plInst(new THREE.LatheGeometry(pinPts, 14), smat(0xffffff, { roughness: .3 }), 10), stripe = plInst(new THREE.CylinderGeometry(.027, .029, .03, 14), smat(0xff3040), 10); PGND.pinStripe = stripe;
  let n = 0; for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) plBody('pin', C.cylinder(.19, .06), PL_LANE.x + (k - row / 2) * .3, .2, -14 - row * .26, null, { im: pinIm, idx: n++, d: 260, r: .25, f: .5, rad: .2 });
  // dominoes along an S curve
  const domIm = plInst(new THREE.BoxGeometry(.3, .6, .08), smat(0xffffff, { roughness: .4 }), 44), cols = [0xff4f6d, 0xffd25a, 0x3fe0bd, 0x3fb2ff, 0x8b6bff, 0xff8a3d];
  const path = []; for (let s = 0; s <= 400; s++) { const u = s / 400, z = -6.2 - u * 7.2, x = Math.sin(u * Math.PI * 2) * 2.3; path.push(V(x, 0, z)); }
  let acc = 0, d = 0; for (let i = 1; i < path.length && d < 44; i++) { acc += path[i].distanceTo(path[i - 1]); if (acc < .3) continue; acc = 0; const t = _pl1.subVectors(path[i], path[i - 1]).normalize();
    _plq.setFromEuler(new THREE.Euler(0, Math.atan2(t.x, t.z), 0)); plBody('dom', C.cuboid(.15, .3, .04), path[i].x, .305, path[i].z, { x: _plq.x, y: _plq.y, z: _plq.z, w: _plq.w }, { im: domIm, idx: d, d: 600, r: .02, f: .35, rad: .3 }); domIm.setColorAt(d, new THREE.Color(cols[d % 6])); d++; }
  domIm.count = d; domIm.instanceColor.needsUpdate = true;
  // crate tower for the wrecking ball
  const crIm = plInst(new THREE.BoxGeometry(.5, .5, .5), smat(0xc8955a, { roughness: .7 }), 45); let c = 0;
  for (let y = 0; y < 5; y++) for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) plBody('crate', C.cuboid(.25, .25, .25), PL_WB.x - .5 + i * .5, .25 + y * .5, PL_WB.z - .5 + k * .5, null, { im: crIm, idx: c++, d: 220, r: .05, rad: .35 });
  // floaty beach balls in the dome
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, m = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 12), smat([0xff4f6d, 0xffd25a, 0x3fb2ff, 0x5fd94a, 0xff8a3d, 0x8b6bff, 0xffffff][i], { roughness: .4 })); plGroup.add(m);
    plBody('beach', C.ball(.28), PL_DOME.x + Math.cos(a) * 1.8, .6 + i * .3, PL_DOME.z + Math.sin(a) * 1.8, null, { m, d: 40, r: .7, rad: .28, ld: .3 }); }
  // the wrecking ball itself (moved by us)
  PGND.wbB = AR.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(PL_WB.x, 3, PL_WB.z + 4)); AR.world.createCollider(C.ball(PL_WB_R).setDensity(8000).setFriction(.5), PGND.wbB);
  PGND.ready = true;
}
function plReset(which) {
  if (!PGND.ready) return;
  const kinds = which === 'bowl' ? ['ball', 'pin'] : which === 'dom' ? ['dom'] : which === 'dome' ? ['beach'] : which === 'crate' ? ['crate'] : null;
  for (const D of PGND.dyn) { if (kinds && !kinds.includes(D.kind)) continue; if (PGND.held.includes(D)) continue; D.b.setTranslation(D.home.p, true); D.b.setRotation(D.home.q, true); D.b.setLinvel({ x: 0, y: 0, z: 0 }, true); D.b.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  if (which === 'bowl') { PGND.bowlT = -1; toast('🎳 Fresh pins! Roll the big blue ball down the lane.', 3); }
  if (which === 'dom') toast('🁢 Dominoes are set up! Push the first one.', 3);
}
function plSwing() {
  if (PGND.wb.t >= 0) return;
  PGND.wb.t = 0; toast('🏗️ LOOK OUT! Here comes the wrecking ball!', 3); if (ac) tone('sawtooth', 120, 60, .6, .08);
}

/* ---------- grabbing + PC rolling ---------- */
function plNear(p, r) { let best = null, bd = r; for (const D of PGND.dyn) { if (D.kind === 'crate' || D.kind === 'dom') continue; const t = D.b.translation(); const d = Math.hypot(t.x + ARENA.x - p.x, t.y + ARENA.y - p.y, t.z + ARENA.z - p.z) - D.r; if (d < bd) { bd = d; best = D; } } return best; }
function plGrab(h) {
  if (!PGND.ready || state.area !== 'arena' || !h.tracked) return false;
  const D = plNear(h.pos, .14); if (!D) return false;
  PGND.held[h.i] = D; D.b.setBodyType(AR.R.RigidBodyType.KinematicPositionBased, true); buzz(h, .6, 40); if (ac) tone('triangle', 400, 700, .08, .1); return true;
}
function plDrop(h) {
  const D = PGND.held[h.i]; if (!D) return false; PGND.held[h.i] = null;
  D.b.setBodyType(AR.R.RigidBodyType.Dynamic, true); const v = (h.vel || V()).clone().multiplyScalar(1.3); if (v.length() > 14) v.setLength(14); D.b.setLinvel(v, true); return true;
}
function plDesk() {   // PC / phone: E on a ball rolls it the way you look
  if (!PGND.ready || state.area !== 'arena') return false;
  const D = aimAt(2.8, f => PGND.dyn.forEach(D => { if (D.kind === 'ball' || D.kind === 'beach') { const t = D.b.translation(); f(D, V(t.x, t.y, t.z).add(ARENA), D.r + .1); } }));
  if (!D) return false; camera.getWorldDirection(_pl1); _pl1.y = Math.max(_pl1.y, 0); _pl1.normalize().multiplyScalar(D.kind === 'ball' ? 7.5 : 6); if (D.kind === 'beach') _pl1.y += 3;
  D.b.setLinvel(_pl1, true); if (ac) noiseHit(ac.currentTime, .1, .15, 'lowpass', 700, .8); return true;
}

/* ---------- every frame ---------- */
function plSecret(id, msg) { if (PGND.found.has(id)) return; PGND.found.add(id); store.set('kg-plsec', JSON.stringify([...PGND.found])); toast(msg, 7); sfxWin(); headWorld(_pl1); confetti(_pl1.clone(), 80); hands.forEach(h => buzz(h, 1, 120)); }
function stepPlayground(dt) {
  if (!AR.ready) return;
  if (!PGND.ready) plInit();
  const here = state.area === 'arena' && !(typeof PT !== 'undefined' && PT.inside);
  plGroup.visible = here; if (!here) { PGND.inDome = false; return; }
  headWorld(_pl1); const lx = _pl1.x - ARENA.x, ly = _pl1.y - ARENA.y, lz = _pl1.z - ARENA.z;
  if (!PGND.told && lz < -4.5 && state.mode === 'play') { PGND.told = true; toast(state.xr ? '🧪 PHYSICS PLAYGROUND! Bowling, dominoes, low gravity, trampolines, a wind tunnel and a wrecking ball. Grip grabs balls!' : '🧪 PHYSICS PLAYGROUND! Bowling, dominoes, low gravity, trampolines, a wind tunnel and a wrecking ball. E rolls the balls!', 8); }
  // low gravity
  PGND.inDome = Math.hypot(lx - PL_DOME.x, lz - PL_DOME.z) < PL_DOME_R && ly < PL_DOME_R + .5;
  // wind tunnel: blows you up, weaker the higher you go
  const tun = Math.hypot(lx - PL_TUN.x, lz - PL_TUN.z) < PL_TUN_R && ly < 11;
  if (tun && state.mode === 'play') { const k = Math.max(0, 1 - ly / 11); state.vel.y = Math.min(6, state.vel.y + (9.81 + 14 * k) * dt * (ly < 1.5 ? 1.6 : 1)); state.grounded = false; hands.forEach(h => { if (h.stuck) h.stuck = false; }); if (!PGND.tunT) { PGND.tunT = 1; if (ac) noiseHit(ac.currentTime, .8, .12, 'lowpass', 500, .6); } } else PGND.tunT = 0;
  PGND.fan.rotation.y += dt * 14; PGND.star.rotation.y += dt * 2;
  const wpos = PGND.wind.geometry.attributes.position; for (let i = 0; i < wpos.count; i++) { let y = wpos.getY(i) + dt * 6; if (y > 9) y = .3; wpos.setY(i, y); } wpos.needsUpdate = true;
  if (_pl1.distanceTo(_pl2.copy(PGND.star.position).add(ARENA)) < .7) plSecret('wind', '⭐ SECRET: you rode the wind all the way up to the STAR!');
  // wrecking ball: hangs pulled back, SWING lets it go, then it winches back
  let ang;
  if (PGND.wb.t >= 0) { PGND.wb.t += dt; const w = Math.sqrt(9.81 / PL_WB_L); ang = PGND.wb.ang * Math.cos(w * PGND.wb.t) * Math.exp(-PGND.wb.t * .12); if (PGND.wb.t > 14) { PGND.wb.t = -1; PGND.wb.back = 0; plReset('crate'); } }
  else { PGND.wb.back = Math.min(1, (PGND.wb.back ?? 1) + dt * .4); ang = PGND.wb.ang * PGND.wb.back; }
  _pl2.set(PL_WB.x, PL_WB.y - Math.cos(ang) * PL_WB_L, PL_WB.z + Math.sin(ang) * PL_WB_L);
  PGND.wbB.setNextKinematicTranslation(_pl2); PGND.ball.position.copy(_pl2);
  PGND.chain.position.set(PL_WB.x, (PL_WB.y + _pl2.y) / 2, (PL_WB.z + _pl2.z) / 2); PGND.chain.scale.y = PL_WB_L; PGND.chain.rotation.set(ang, 0, 0);
  _pl3.copy(_pl2).add(ARENA); const bd = _pl1.distanceTo(_pl3), bd2 = _pl1.clone().setY(_pl1.y - .4).distanceTo(_pl3);
  if (Math.min(bd, bd2) < PL_WB_R + .35 && PGND.wb.t >= 0 && (PGND.bonkT || 0) < tAll) { PGND.bonkT = tAll + .8; _pl3.subVectors(_pl1, _pl3).setY(0).normalize(); state.vel.addScaledVector(_pl3, 9); state.vel.y = Math.max(state.vel.y, 5); state.grounded = false; hands.forEach(h => { h.stuck = false; buzz(h, 1, 200); }); if (ac) { tone('square', 140, 50, .3, .2); noiseHit(ac.currentTime, .2, .3, 'lowpass', 400, .7); } toast('💥 BONK! The wrecking ball got you!', 2.5); }
  // held toys follow the paw
  for (const h of hands) { const D = PGND.held[h.i]; if (!D) continue; _pl2.copy(h.pos).sub(ARENA); D.b.setNextKinematicTranslation(_pl2); }
  // copy every body to its look; low gravity inside the dome; lost ones come home
  const touched = new Set();
  for (const D of PGND.dyn) {
    const t = D.b.translation(), r = D.b.rotation();
    if (t.y < -6) { D.b.setTranslation(D.home.p, true); D.b.setLinvel({ x: 0, y: 0, z: 0 }, true); D.b.setAngvel({ x: 0, y: 0, z: 0 }, true); continue; }
    const g = Math.hypot(t.x - PL_DOME.x, t.z - PL_DOME.z) < PL_DOME_R && t.y < PL_DOME_R ? .15 : 1; if (D.grav !== g) { D.grav = g; D.b.setGravityScale(g, true); }
    if (D.m) { D.m.position.set(t.x, t.y, t.z); D.m.quaternion.set(r.x, r.y, r.z, r.w); }
    else { _plq.set(r.x, r.y, r.z, r.w); _plm.compose(_pl2.set(t.x, t.y, t.z), _plq, _pls); D.im.setMatrixAt(D.idx, _plm); touched.add(D.im);
      if (D.kind === 'pin') { _pl3.set(0, .09, 0).applyQuaternion(_plq).add(_pl2); _plm.compose(_pl3, _plq, _pls); PGND.pinStripe.setMatrixAt(D.idx, _plm); touched.add(PGND.pinStripe); } }
  }
  touched.forEach(im => im.instanceMatrix.needsUpdate = true);
  // bowling score: once the ball reaches the pins, count them a moment later
  const bt = PGND.bball.b.translation();
  if (PGND.bowlT < 0 && bt.z < -13.2 && Math.abs(bt.x - PL_LANE.x) < 1.2) PGND.bowlT = 3;
  if (PGND.bowlT > 0 && (PGND.bowlT -= dt) <= 0) {
    let down = 0; for (const D of PGND.dyn) if (D.kind === 'pin') { const r = D.b.rotation(); _pl3.set(0, 1, 0).applyQuaternion(_plq.set(r.x, r.y, r.z, r.w)); if (_pl3.y < .8 || D.b.translation().y < .1) down++; }
    if (down === 10) { brBig('🎳 STRIKE!!! 🎳', 2.5); setTimeout(() => { if ($('brBig').textContent.includes('STRIKE')) brBig(''); }, 2600); confetti(V(PL_LANE.x, 1, -14.5).add(ARENA), 120); if (ac) [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .2, .14, i * .1)); }
    else toast(down ? `🎳 ${down} pin${down > 1 ? 's' : ''} down!${down >= 7 ? ' So close!' : ''}` : '🎳 Gutter ball! 😅', 3);
    PGND.bowlT = -2;
  }
}
window.__kg.play = { PGND, plReset, plSwing, plGrab, plDrop, plDesk, playGrav, stepPlayground };
