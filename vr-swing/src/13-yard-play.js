/* ======================= physics world ======================= */
import('rapier').then(async m => {
  const R = m.default || m; await R.init();
  const w = new R.World({ x: 0, y: -9.81, z: 0 });
  AR.R = R; AR.world = w;
  const fixed = (desc, x, y, z, q) => { const b = w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z)); if (q) b.setRotation(q, false); w.createCollider(desc.setFriction(.85), b); return b; };
  fixed(R.ColliderDesc.cuboid(18, .5, 18), 0, -.5, 0);
  PEDS.forEach(p => fixed(R.ColliderDesc.cylinder(.15, .2), p.x, .15, p.z));
  _aq.setFromEuler(new THREE.Euler(0, AR.consoleG.rotation.y, 0));
  fixed(R.ColliderDesc.cuboid(.33, .17, .2), CONSOLE.x, .17, CONSOLE.z, { x: _aq.x, y: _aq.y, z: _aq.z, w: _aq.w });
  fixed(R.ColliderDesc.cylinder(.16, .34), STONE.x, .16, STONE.z);
  fixed(R.ColliderDesc.cylinder(.08, 1.1), AR_PORTAL.x, .08, AR_PORTAL.z);
  // your paws and body shove pieces around
  AR.pawB = hands.map(() => { const b = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0)); w.createCollider(R.ColliderDesc.ball(PAW_R * .9).setFriction(1), b); return b; });
  AR.bodyB = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0)); w.createCollider(R.ColliderDesc.capsule(.17, .2), AR.bodyB);
  spawnSet(false); spawnMega(false);
  GL.panes.forEach(p => fixed(R.ColliderDesc.cuboid(p.W / 2 + .04, .035, .05), p.pos.x, .035, p.pos.z, { x: p.q.x, y: p.q.y, z: p.q.z, w: p.q.w }));
  { const [lx, lz, ly] = GL.labBox; _aq.setFromEuler(new THREE.Euler(0, ly, 0)); fixed(R.ColliderDesc.cuboid(.33, .17, .2), lx, .17, lz, { x: _aq.x, y: _aq.y, z: _aq.z, w: _aq.w }); }
  glassReset();
  // warm the cutter up (JIT) so the very first real slice is as quick as the rest
  const tp = tplFor(CUBE);
  for (let i = 0; i < 6; i++) { const nn = V(rnd() - .5, rnd() - .5, rnd() - .5).normalize(); const pp = { vis: tp.vis, phys: tp.phys }; chainSplit([pp], [[nn, .01]], []).slice(0, 2).forEach(h => h.forEach(p => childOf([p]) && withHull(p))); }
  try { renderer.compile(arena, camera, scene); } catch (e) {}
  AR.ready = true;
}).catch(e => { AR.failed = true; console.warn('Slicing Yard physics did not load', e); });

/* ======================= sword handling ======================= */
const GRIP_ROT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0, 'XYZ'));   // blade along the fist (-Z), flat facing the palm
const HAND_ROT = { right: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, -1), V(-1, 0, 0), V(0, 1, 0))),
  left: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0))) };
const DESK = { idleH: V(.2, -.25, -.36), idleD: V(-.12, .85, -.5).normalize(),
  H: [V(.24, -.02, -.3), V(.02, -.2, -.38), V(-.2, -.34, -.32)], D: [V(.35, .85, .3).normalize(), V(-.15, .25, -1).normalize(), V(-.75, -.5, -.4).normalize()] };
const _Y = V(0, 1, 0), _dq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
function deskPose(pos, q) {
  const s = AR.swing, mir = s.dir;
  const H = i => _a1.copy(DESK.H[i]).multiply(_a2.set(mir, 1, 1)), Dq = (i, out) => out.setFromUnitVectors(_Y, _a3.copy(DESK.D[i]).multiply(_a2.set(mir, 1, 1)).normalize());
  _dq[3].setFromUnitVectors(_Y, DESK.idleD);
  if (s.t < 1) {
    const e = s.t;
    if (e < .25) { const k = e / .25, kk = k * k * (3 - 2 * k); pos.lerpVectors(DESK.idleH, H(0), kk); Dq(0, _dq[0]); q.slerpQuaternions(_dq[3], _dq[0], kk); }
    else { const k = (e - .25) / .75, kk = k * k * (3 - 2 * k);
      if (kk < .5) { const k2 = kk * 2; _a4.copy(H(0)); pos.lerpVectors(_a4, H(1), k2); Dq(0, _dq[0]); Dq(1, _dq[1]); q.slerpQuaternions(_dq[0], _dq[1], k2); }
      else { const k2 = (kk - .5) * 2; _a4.copy(H(1)); pos.lerpVectors(_a4, H(2), k2); Dq(1, _dq[1]); Dq(2, _dq[2]); q.slerpQuaternions(_dq[1], _dq[2], k2); } }
  } else if (s.r < 1) { const k = s.r, kk = k * k * (3 - 2 * k); _a4.copy(H(2)); pos.lerpVectors(_a4, DESK.idleH, kk); Dq(2, _dq[2]); q.slerpQuaternions(_dq[2], _dq[3], kk); }
  else { pos.copy(DESK.idleH); q.copy(_dq[3]); }
  camera.updateMatrixWorld(); camera.localToWorld(pos); camera.getWorldQuaternion(_aq2); q.premultiply(_aq2);
}
function swordCollide(h, dt) {   // the held blade is solid against the world: it rests on the floor and walls instead of sinking in
  let any = false; _swC.set(0, 0, 0);
  for (let it = 0; it < 3; it++) {
    let best = null, bd = 0;
    for (let j = 0; j <= 6; j++) {
      _swS.lerpVectors(BLADE_A, BLADE_B, j / 6).applyQuaternion(_swQ).add(_swP);
      const R = j === 6 ? .012 : .022;
      for (const c of colliders) {
        if (c.pane) continue;   // glass is for cutting
        if (_swS.x + R < c.minx || _swS.x - R > c.maxx || _swS.y + R < c.miny || _swS.y - R > c.maxy || _swS.z + R < c.minz || _swS.z - R > c.maxz) continue;
        const d = sdf(c, _swS, _n) - R; if (d < bd) { bd = d; best = { n: _n.clone(), c }; }
      }
      triQuery(_swS, R, (t, d, n) => { if (d - R < bd) { bd = d - R; best = { n: n.clone(), c: t.owner }; } });
    }
    if (!best) break;
    any = true; _swR.copy(best.n).multiplyScalar(-bd + .001); _swP.add(_swR); _swC.add(_swR); if (!sword.hitC) sword.hitC = best.c;
  }
  if (!any) { sword.hitC = null; sword.wasHit = false; return; }
  // like pushing on the ground with a paw: shove the blade in and you get pushed the other way
  const k = Math.min(1, _swC.length() / .2); if (_swC.length() > .12) _swC.setLength(.12);
  rig.position.add(_swC); if (_swC.y > 0) state.vel.y = Math.max(0, state.vel.y); else state.vel.y = Math.min(state.vel.y, 0);
  state.vel.x *= .9; state.vel.z *= .9;
  if (!sword.wasHit) { sword.wasHit = true; const sp = sword.lv.length(); if (sp > .5) { sfxTap(sword.hitC && sword.hitC.tag || 'rock', clamp(sp / 4, .1, .8)); if (ac) tone('triangle', 1900, 1500, .08, clamp(sp / 20, .02, .1)); } buzz(h, clamp(.3 + sword.lv.length() / 5, .3, 1), 40); }
  else if (k > .02) buzz(h, .2 + k * .5, 20);
}
function vrPose(h, pos, q) {
  _aq2.copy(rig.quaternion).multiply(h.q);
  if (h.src && h.src.hand) { rig.localToWorld(pos.copy(h.local)); q.copy(_aq2).multiply(HAND_ROT[h.side] || HAND_ROT.right); }
  else { pos.copy(PAW_OFF).applyQuaternion(h.q).negate().add(h.local); rig.localToWorld(pos); q.copy(_aq2).multiply(GRIP_ROT); }
}
const _swR = V(), _swC = V(), _swS = V();
function takeSword(h) {
  if (sword.held && sword.held !== h) sword.held.sword = false;
  if (sword.body) { AR.world.removeRigidBody(sword.body); sword.body = null; }
  const fromStone = sword.mode === 'stone'; claim(sword, 'sw', 0);
  sword.held = h; h.sword = true; sword.mode = 'held'; AR.bladeOk = false; trail.hist.length = 0;
  buzz(h, .8, 60); if (fromStone) { sfxShing(); crumbs(V().copy(ARENA).add(STONE).add(V(0, .35, 0)), 2, 6); if (!AR.toldSwing) { AR.toldSwing = true; toast(state.xr ? '⚔️ Got it! Swing slow to carve curvy cuts, swing SUPER fast for an anime slice. Let go of grip to drop it.' : '⚔️ Got it! Click to swing, right-click for an anime slash, E to drop it.', state.xr ? 9 : 6.5); } }
  else if (ac) tone('triangle', 900, 1300, .12, .12);
}
function releaseSword(h, throwV) {
  if (sword.held !== h) return;
  h.sword = false; sword.held = null; sword.mode = 'free'; AR.bladeOk = false;
  const R = AR.R, p = sword.g.position, q = sword.g.quaternion;
  const b = AR.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCcdEnabled(true).setAngularDamping(.4));
  const add = (desc, x, y, z) => AR.world.createCollider(desc.setTranslation(x, y, z).setFriction(.7).setRestitution(.15).setDensity(2500), b);
  add(R.ColliderDesc.cuboid(.03, .31, .005), 0, .425, 0); add(R.ColliderDesc.cuboid(.135, .013, .015), 0, .1, 0);
  add(R.ColliderDesc.cylinder(.085, .019), 0, 0, 0); add(R.ColliderDesc.ball(.029), 0, -.115, 0);
  const v = throwV || sword.lv; b.setLinvel({ x: v.x, y: v.y, z: v.z }, true); b.setAngvel({ x: sword.av.x * .6, y: sword.av.y * .6, z: sword.av.z * .6 }, true);
  sword.body = b; if (ac) tone('sine', 700, 400, .1, .1);
}

/* ======================= grabbing pieces ======================= */
function pieceNear(h, maxD = .1) {
  let best = null, bd = 1e9;
  for (const pc of AR.pieces) { if (pc.dying || pc.held || !pc.body || pc.pane) continue; const t = pc.body.translation(); _a1.set(t.x, t.y, t.z).add(ARENA); const d = _a1.distanceTo(h.pos) - pc.rad * .8; if (d < maxD && d < bd) { bd = d; best = pc; } }
  return best;
}
function pawQuat(h, out) { return (state.xr || sim.on) ? out.copy(rig.quaternion).multiply(h.q) : out.copy(h.paw.quaternion); }
const PALM = V(0, -.55, -.83).normalize();   // paw-local: just under the palm pad and a bit forward, where a held thing sits
function relToPaw(h, pc) {   // where the piece is right now, in the paw's frame
  const t = pc.body.translation(), r = pc.body.rotation();
  pawQuat(h, _aq).invert();
  pc.relP0 = V(t.x, t.y, t.z).add(ARENA).sub(h.pos).applyQuaternion(_aq);
  pc.relQ0 = _aq.clone().multiply(_aq2.set(r.x, r.y, r.z, r.w));
  pc.relP = pc.relP0.clone(); pc.relQ = pc.relQ0.clone(); pc.relPT = pc.relP0.clone(); pc.relQT = pc.relQ0.clone(); pc.hk = 1;
}
function holdPiece(h, pc) {
  claim(pc, 'pc', pc.id);
  pc.held = h; h.piece = pc; pc.trk = null; pc.frz = 0; pc.frzH = null;
  wakeNear(pc); pc.body.setBodyType(AR.R.RigidBodyType.KinematicPositionBased, true);
  relToPaw(h, pc);
  // it eases snug into the paw: pulled in against the palm, and turned a little so a flat face rests on it
  const dir = V().copy(pc.relP0), L = dir.length(); if (L > 1e-4) dir.multiplyScalar(1 / L); else dir.copy(PALM);
  dir.lerp(PALM, (state.xr || sim.on) ? .6 : 1).normalize();
  let best = null, bd = -2; _a2.copy(dir).negate();
  for (const p of pc.parts) for (const pl of p.planes) { _a3.set(pl[0], pl[1], pl[2]).applyQuaternion(pc.relQ0); const sd = _a3.dot(_a2); if (sd > bd) { bd = sd; best = pl; } }
  if (best) {
    _a3.set(best[0], best[1], best[2]).applyQuaternion(pc.relQ0); _aq.setFromUnitVectors(_a3, _a2);
    const ang = 2 * Math.acos(clamp(Math.abs(_aq.w), 0, 1)); if (ang > 1) _aq.slerp(_aq2.identity(), 1 - 1 / ang);
    pc.relQT.copy(_aq).multiply(pc.relQ0);
  }
  let ext = 0; const hh = pc.hull;   // how far the piece reaches back toward the paw, once turned
  for (let i = 0; i < hh.length; i += 3) { _a3.set(hh[i], hh[i + 1], hh[i + 2]).applyQuaternion(pc.relQT); const sd = -_a3.dot(dir); if (sd > ext) ext = sd; }
  pc.relPT.copy(dir).multiplyScalar(ext + .045); pc.hk = 0;
  buzz(h, .5, 30); if (ac) tone('sine', 500, 800, .08, .2);
}
function releasePiece(h, throwV) {
  const pc = h.piece; if (!pc) return; h.piece = null; pc.held = null;
  if (!pc.body) return;
  pc.body.setBodyType(AR.R.RigidBodyType.Dynamic, true); pc.body.enableCcd(true);
  const v = throwV || (h.vel ? _a1.copy(h.vel).multiplyScalar(1.25) : _a1.set(0, 0, 0)); if (v.length() > 14) v.setLength(14);
  pc.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true); pc.body.setAngvel({ x: (rnd() - .5) * 4, y: (rnd() - .5) * 4, z: (rnd() - .5) * 4 }, true);
}
function swordNear(h) {
  if (sword.mode === 'held' && sword.held === h) return false;
  _a1.copy(sword.g.position).add(ARENA);
  return _a1.distanceTo(h.pos) < (sword.mode === 'stone' ? .22 : .2);
}
function holdGrab(h) {   // squeeze near a climbing hold: your paw clamps onto it
  if (!h.tracked || state.area === 'arena' || h.holding) return false;
  let best = null, bd = 1e9;
  for (const o of HOLDS) { const d = o.p.distanceTo(h.target) - o.r; if (d < .16 && d < bd) { bd = d; best = o; } }
  if (!best) return false;
  h.hold = best; h.stuck = true; h.cool = 0; h.col = null;
  h.sp.copy(best.p).addScaledVector(best.n, best.r * .55 + PAW_R * .5); h.n.copy(best.n); h.pos.copy(h.sp); h.prev.copy(h.sp);
  if (!hands.some(o => o !== h && o.stuck)) state.velBuf.length = 0;
  best.m.scale.setScalar(1.18); sfxTap('rock', .5); buzz(h, .6, 35);
  if (!state.toldHold) { state.toldHold = true; toast('🧗 Got a hold! Pull down to climb, grab the next one, let go to drop.', 4.5); }
  return true;
}
function letGoHold(h) { if (h.hold) { if (h.hold.plat) h.hold.m.userData.fade = .25; else h.hold.m.scale.setScalar(1); h.hold = null; } }
function grabAny(h) {
  if (BM.stop && h.side === 'right') { bmStatue(true); return; }   // stop-motion: R grip freezes another you
  if (BM.grab && bmGrabFriend(h)) return;
  if (toughGrab(h)) return;
  if (holdGrab(h)) return;
  if (state.area === 'arena' && AR.ready && h.tracked) {
    if (swordNear(h)) { takeSword(h); return; }
    const pc = pieceNear(h); if (pc) { holdPiece(h, pc); return; }
  }
  if (pipGrab(h)) return;
  grabProp(h);
  if (BM.plat && !h.holding && !h.piece && !h.sword && !h.stuck && !h.hold && h.tracked) bmPlatform(h);
}
function dropAny(h) {
  if (h.plat) { h.plat.userData.fade = .25; h.plat = null; }
  if (h.grabF) { bmDropFriend(h); return; }
  if (h.hold) { letGoHold(h); h.stuck = false; h.cool = .15; return; }
  if (PULL.h === h) { pullStop(false); return; }
  if (h.sword) { releaseSword(h); return; }
  if (h.piece) { releasePiece(h); return; }
  if (pip.heldBy === h) { pipDrop(h); return; }
  dropProp(h);
}

/* ======================= desktop: E to grab / drop, click to swing or press ======================= */
function aimAt(maxD, test) {
  headWorld(_a1); camera.getWorldQuaternion(_aq); _a2.set(0, 0, -1).applyQuaternion(_aq);
  let best = null, bs = -1;
  test((obj, p, r) => { _a3.subVectors(p, _a1); const d = _a3.length(); if (d > maxD) return; const along = _a3.dot(_a2); if (along <= 0) return; const off = Math.sqrt(Math.max(0, d * d - along * along)); const s = 1 - off / (r + .05 + d * .06); if (s > bs) { bs = s; best = obj; } });
  return bs > 0 ? best : null;
}
function aimButton() { return aimAt(2.6, f => buttons.forEach(b => f(b, b.top, .09))); }
function deskInteract() {
  if (compDesk()) return;
  const h = hands[1], hl = hands[0];
  if (state.area === 'arena' && AR.ready) {
    const holder = h.piece ? h : hl.piece ? hl : null;
    if (holder) { camera.getWorldQuaternion(_aq); releasePiece(holder, V(0, 1.5, -6.5).applyQuaternion(_aq)); return; }
    const b = aimButton(); if (b) { pressButton(b, null); return; }
    const pc = aimAt(2.6, f => AR.pieces.forEach(p => { if (!p.dying && p.body && !p.held && !p.pane) { const t = p.body.translation(); f(p, V(t.x, t.y, t.z).add(ARENA), p.rad); } }));
    if (pc) {
      holdPiece(h.sword ? hl : h, pc);
      if (h.sword && !AR.toldLeft) { AR.toldLeft = true; toast('🐾 Your other paw grabbed it! Swing at it: you keep the bit you are holding. E throws it.', 8.5); }
      return;
    }
    if (h.sword) { headWorld(_a1); camera.getWorldQuaternion(_aq); releaseSword(h, V(0, .5, -2.2).applyQuaternion(_aq)); return; }
    const sw = aimAt(3, f => f(sword, _a4.copy(sword.g.position).add(ARENA), .25)); if (sw) { if (sword.mode === 'stone') pullStart(h, 'sword', true); else takeSword(h); return; }
  }
  deskGrab();
}
canvas.addEventListener('pointerdown', e => {
  if (state.mode !== 'play' || state.xr || e.button !== 0 || (document.pointerLockElement !== canvas && !state.touch) || state.area !== 'arena') return;
  if (hands[1].sword) startSwing(false); else { const b = aimButton(); if (b) pressButton(b, null); }
});
// right click: a lightning-fast anime slash
canvas.addEventListener('pointerdown', e => { if (state.mode === 'play' && !state.xr && e.button === 2 && (document.pointerLockElement === canvas || state.touch) && state.area === 'arena' && hands[1].sword) startSwing(true); });
canvas.addEventListener('contextmenu', e => { if (state.area === 'arena') e.preventDefault(); });
function startSwing(fast) { const s = AR.swing; if (s.t < 1) { s.queued = true; return; } s.dir = -s.dir; s.t = 0; s.r = 0; s.fast = !!fast; if (ac) tone('sine', fast ? 500 : 300, 180, .15, .05); }

/* ======================= buttons ======================= */
function pressButton(b, h) {
  if (tAll - AR.btnT[b.i] < (b.i >= 2 ? .25 : .45) || !AR.ready) return;
  AR.btnT[b.i] = tAll; b.down = 1; sfxPress(b.i === 0 || b.i === 3); if (h) buzz(h, .6, 40);
  if (b.i >= 2) labSet(LAB.k + (b.i === 3 ? 1 : -1));
  else if (b.i === 0) {
    AR.greenTimes = AR.greenTimes.filter(t => tAll - t < 2.2); AR.greenTimes.push(tAll);
    if (AR.greenTimes.length >= 3) { AR.greenTimes.length = 0; butterBlock(); }   // secret: triple-tap SPAWN
    else spawnSet(true);
  } else {
    AR.pieces.forEach((p, i) => { if (!p.held && !p.pane) p.dying = .2 + Math.min(i, 150) * .002; }); glassReset();
    if (sword.mode !== 'held' && sword.mode !== 'far' && mine(sword)) swordToStone();
    netSend({ t: 'reset' });
    AR.spawnQ.push([tAll + .45, true]);
    toast('🔄 Fresh cubes coming up!', 2.5);
  }
}
function checkButtons(dt) {
  for (const b of buttons) {
    for (const h of hands) {
      if (!b.in) b.in = [false, false];
      let inside = false;
      if (h.tracked && (state.xr || sim.on)) { const dx = h.pos.x - b.top.x, dz = h.pos.z - b.top.z, dy = h.pos.y - b.top.y; inside = dx * dx + dz * dz < .085 * .085 && dy < PAW_R + .012 && dy > -.08; }
      if (inside && !b.in[h.i]) pressButton(b, h);   // only a fresh tap counts, resting your paw on it doesn't repeat
      b.in[h.i] = inside;
    }
    b.down = Math.max(0, b.down - dt * 3.5);
    b.cap.position.y = .36 - .018 * Math.min(1, b.down * 2);
    b.cm.emissiveIntensity = .35 + b.down * 1.2;
  }
}

/* ======================= portals: walk through to travel ======================= */
function travel(toArena) {
  if (toArena) hands.forEach(h => { if (h.holding) { const p = h.holding; dropProp(h); toyToYard(p, true); } });
  headWorld(_a1);
  if (!toArena) { hands.forEach(h => { if (h.sword) { swordToStone(); } if (h.piece) releasePiece(h); }); }
  const dest = toArena ? V().copy(ARENA).add(AR_SPAWN) : V().copy(GROVE_PORTAL).add(V(-GROVE_PORTAL.x, 0, -GROVE_PORTAL.z).normalize().multiplyScalar(1.6));
  dest.y = (toArena ? ARENA.y : .02) + state.bodyH + .03;
  rig.position.add(dest.sub(_a1));
  state.vel.set(0, 0, 0); state.velBuf.length = 0; state.wasStuck = false;
  hands.forEach(h => { h.stuck = false; h.reset = true; });
  if (!state.xr) state.yaw = toArena ? 0 : Math.atan2(GROVE_PORTAL.x, GROVE_PORTAL.z);
  state.area = toArena ? 'arena' : 'grove'; AR.portalCool = 1; AR.snap = true; AR.bladeOk = false;
  sfxWhoosh(); confetti(V().copy(dest).add(V(0, .3, 0)), 24, toArena ? [0x3fe0bd, 0x8b6bff, 0xffffff] : [0x6fdc4f, 0xffd25a, 0xffffff]);
  if (toArena) toast(AR.failed ? '😵 The Slicing Yard physics could not load. Check your connection and reload.'
    : state.xr ? '⚔️ The Slicing Yard! Squeeze grip on the sword handle to pull it out, then slice!' : '⚔️ The Slicing Yard! Look at the sword, press E, then click to slice!', 7);
  else toast('🌳 Back in the grove!', 2.5);
}
function arenaRespawn() {
  rig.position.copy(ARENA).add(AR_SPAWN); rig.position.y += state.bodyH - eyeLocal(_a2).y + .05;
  state.vel.set(0, 0, 0); state.velBuf.length = 0; state.wasStuck = false;
  hands.forEach(h => { h.stuck = false; h.ready = false; });
  if (!state.xr) { state.yaw = 0; state.pitch = 0; rig.rotation.y = 0; }
  AR.snap = true;
}
function portalCheck(dt) {
  AR.portalCool = Math.max(0, AR.portalCool - dt);
  headWorld(_a1);
  const P = state.area === 'arena' ? portalYard : portalGrove;
  P.g.worldToLocal(_a2.copy(_a1));
  const inRing = Math.abs(_a2.z) < .32 && Math.hypot(_a2.x, _a2.y - 1) < .8;
  if (AR.portalCool <= 0 && inRing) travel(state.area !== 'arena');
}
function animPortals(dt, t) {
  for (const P of portals) {
    P.disc.material.uniforms.t.value = t;
    P.sparks.forEach(s => { s.a += s.sp * dt; s.s.position.set(Math.cos(s.a) * s.r, 1 + Math.sin(s.a) * s.r, Math.sin(t * 2 + s.y * 6) * .12); s.s.rotation.y += dt * 3; });
  }
  if (AR.beacon) AR.beacon.material.emissiveIntensity = .4 + (Math.sin(t * 5) > .3 ? 1.2 : 0);
}

/* ======================= per-frame ======================= */
const _swP = V(), _swQ = new THREE.Quaternion();
// a paw holding the sword closes on the handle: the palm presses on the grip, the fingertips tuck in just under the guard
const DESK_PAW_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), HOLD_ALONG = V(0, .012, 0), HOLD_UP = V(0, .036, 0);
function followPaw(h, pc, dt) {   // a kinematic piece riding along with a paw
  if (pc.hk < 1) {
    pc.hk = Math.min(1, pc.hk + dt / .14); const e = pc.hk * pc.hk * (3 - 2 * pc.hk);
    pc.relP.lerpVectors(pc.relP0, pc.relPT, e); pc.relQ.slerpQuaternions(pc.relQ0, pc.relQT, e);
  }
  pawQuat(h, _aq); _a2.copy(pc.relP).applyQuaternion(_aq).add(h.pos).sub(ARENA);
  pc.body.setNextKinematicTranslation(_a2);
  _aq2.copy(_aq).multiply(pc.relQ); pc.body.setNextKinematicRotation({ x: _aq2.x, y: _aq2.y, z: _aq2.z, w: _aq2.w });
}
function stepArena(dt) {
  if (state.mode === 'play') portalCheck(dt);
  if ((state.area !== 'arena' && !online()) || !AR.ready || state.mode !== 'play') return;
  const w = AR.world;
  U_TIME.value = tAll;
  // 1) where the sword is this frame
  if (sword.mode === 'held') {
    const h = sword.held;
    sword.ppos.copy(sword.g.position); sword.pq.copy(sword.g.quaternion);
    if (state.xr || sim.on) { vrPose(h, _swP, _swQ); if (GL.drag > .01) { _a1.copy(sword.g.position).add(ARENA); if (_a1.distanceTo(_swP) < .35) _swP.lerp(_a1, GL.drag); } swordCollide(h, dt); } else { deskPose(_swP, _swQ); const s = AR.swing; if (s.t < 1) { s.t += dt / (s.fast ? SWING_T * .55 : SWING_T); if (s.t >= 1 && s.queued) { s.queued = false; s.t = 1; s.r = 1; startSwing(false); } } else if (s.r < 1) s.r += dt / RETURN_T; }
    sword.g.position.copy(_swP).sub(ARENA); sword.g.quaternion.copy(_swQ);
    sword.lv.subVectors(sword.g.position, sword.ppos).multiplyScalar(1 / Math.max(dt, 1e-3));
    _aq.copy(sword.pq).invert().premultiply(sword.g.quaternion); const ang = 2 * Math.acos(clamp(Math.abs(_aq.w), 0, 1)); const sgn = _aq.w < 0 ? -1 : 1;
    sword.av.set(_aq.x * sgn, _aq.y * sgn, _aq.z * sgn); if (sword.av.lengthSq() > 1e-12) sword.av.normalize().multiplyScalar(ang / Math.max(dt, 1e-3)); else sword.av.set(0, 0, 0);
    // the paw closes on the handle (it keeps its own turn, so the arm still joins it properly)
    if (!(state.xr || sim.on)) { h.paw.quaternion.copy(_swQ).multiply(DESK_PAW_Q); h.pos.copy(_swP); }
    h.paw.position.copy(HOLD_ALONG).applyQuaternion(_swQ).add(_swP).add(_a1.copy(HOLD_UP).applyQuaternion(h.paw.quaternion));
  }
  // the blade runs hot: it glows brighter with every cut, then cools
  AR.heat = Math.max(0, AR.heat - dt * .3);
  sword.hot.edge.emissiveIntensity = .3 + 1.7 * AR.heat; sword.hot.steel.emissiveIntensity = .7 * AR.heat * AR.heat;
  // 2) kinematic paws, body and held pieces, then step the world
  hands.forEach((h, i) => {
    const b = AR.pawB[i];
    if (h.tracked && (state.xr || sim.on)) _a1.copy(h.pos).sub(ARENA); else _a1.set(i * 3, -50, 0);
    if (AR.snap || _a1.distanceTo(b.translation()) > 1) b.setTranslation(_a1, false); else b.setNextKinematicTranslation(_a1);
  });
  headWorld(_a1); _a1.y -= (state.bodyH - .25) / 2; _a1.sub(ARENA);
  if (AR.snap || _a1.distanceTo(AR.bodyB.translation()) > 1) AR.bodyB.setTranslation(_a1, false); else AR.bodyB.setNextKinematicTranslation(_a1);
  for (const h of hands) { const pc = h.piece; if (pc && pc.body) followPaw(h, pc, dt); }
  for (const pc of AR.pieces) if (pc.frz > 0 && pc.frzH && !pc.held) followPaw(pc.frzH, pc, dt);
  AR.snap = false;
  stepGlassPre(dt);
  w.timestep = clamp(dt, 1 / 144, 1 / 30); w.step();
  // 3) anime cuts let go, the dying shrink, the lost drop out, and every piece's matrix goes to the shared mesh
  for (let i = AR.pieces.length - 1; i >= 0; i--) {
    const pc = AR.pieces[i];
    if (pc.frz > 0) { pc.frz -= dt; if (pc.frz <= 0) unfreeze(pc); }
    if (pc.pop < 1) { pc.pop = Math.min(1, pc.pop + dt * 5); const k = pc.pop; pc.sc = Math.max(.01, k * (1 + Math.sin(k * Math.PI) * .25 * (1 - k))); }
    if (pc.dying) { pc.dying -= dt; pc.sc *= Math.exp(-dt * 14); if (pc.dying <= 0) { removePiece(pc); continue; } }
    if (pc.body.translation().y < -8) { if (!mine(pc)) continue; sendKill([pc]); removePiece(pc); continue; }
    const asleep = pc.body.isSleeping();
    // piles settle for good: a piece that has been still for a moment naps (anything that bumps it wakes it again)
    if (!asleep && !pc.held && !pc.frz && pc.body.bodyType() === 0) {
      const v = pc.body.linvel(), a = pc.body.angvel();
      if (v.x * v.x + v.y * v.y + v.z * v.z < .0064 && a.x * a.x + a.y * a.y + a.z * a.z < .5) { if ((pc.still = (pc.still || 0) + dt) > .7) { pc.body.sleep(); pc.still = 0; } } else pc.still = 0;
    }
    if ((!asleep && !pc.pane) || pc.held || pc.frz > 0 || pc.sc !== pc.scW) { pileMatrix(pc); pc.scW = pc.sc; }
  }
  if (sword.mode === 'free' && sword.body) {
    const t = sword.body.translation(), r = sword.body.rotation(); sword.g.position.set(t.x, t.y, t.z); sword.g.quaternion.set(r.x, r.y, r.z, r.w);
    if (t.y < -8) swordToStone();
  }
  if (AR.spawnQ.length && tAll >= AR.spawnQ[0][0]) { const [, mega] = AR.spawnQ.shift(); spawnSet(true); if (mega) spawnMega(true); }
  // 4) the blade: slice whatever it swept through since last frame
  sword.g.updateMatrixWorld();
  AR.b1.copy(BLADE_A).applyMatrix4(sword.g.matrix); AR.t1.copy(BLADE_B).applyMatrix4(sword.g.matrix);
  if (sword.mode === 'held') {
    if (!AR.bladeOk) { AR.b0.copy(AR.b1); AR.t0.copy(AR.t1); AR.bladeOk = true; }
    bladeSlice(dt); glassBlade(dt);
  } else AR.bladeOk = false;
  AR.b0.copy(AR.b1); AR.t0.copy(AR.t1);
  for (let n = 0; n < 2 && AR.cutQ.length;) { const c = AR.cutQ.shift(); c.pc.inQ = false; if (!c.pc.body || c.pc.dying) continue; cutPiece(c.pc, c); n++; }   // gone pieces don't use up the turn
  stepTrail(dt); AR.dt = dt; stepSeams(); stepSparks(dt); stepDrips(dt); stepGlassPost(dt); pileTidy();
  checkButtons(dt);
  if ((AR.signT = (AR.signT || 0) + dt) > .25) { AR.signT = 0; megaSign(); }
}
function stepTrail(dt) {
  const hs = trail.hist;
  if (sword.mode === 'held') { _a1.lerpVectors(AR.b1, AR.t1, .35); hs.unshift([_a1.clone(), AR.t1.clone()]); } else hs.unshift(null);
  if (hs.length > TRAIL_N) hs.length = TRAIL_N;
  let speed = 0; if (hs[0] && hs[1]) speed = hs[0][1].distanceTo(hs[1][1]) / Math.max(dt, 1e-3);
  trail.k += ((speed > 2.2 ? 1 : 0) - trail.k) * Math.min(1, dt * (speed > 2.2 ? 20 : 8));
  let last = null;
  for (let i = 0; i < TRAIL_N; i++) {
    const e = hs[i] || last; if (hs[i]) last = hs[i];
    const a = e ? e[0] : AR.b1, b = e ? e[1] : AR.t1;
    trail.pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    const al = hs[i] ? trail.k * Math.pow(1 - i / (TRAIL_N - 1), 1.6) * .55 : 0; trail.al[i * 2] = al * .15; trail.al[i * 2 + 1] = al;
  }
  trail.geo.attributes.position.needsUpdate = true; trail.geo.attributes.a.needsUpdate = true;
}
