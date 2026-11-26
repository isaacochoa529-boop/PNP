/* ======================================================================
   PC + PHONE CONTROLS for the stuff that used to need VR hands:
   - CLICK (or the phone's Use button) = PUNCH. Punch a friend and they get knocked back a little;
     punch the ground or a wall and YOU go flying the other way (punch the floor while looking down = rocket jump).
   - Walk into a wall while holding W (or the stick forward) = CLIMB it (that's how you reach the berry on the Knuckle Wall).
   - Platforms mod on: press Space (Jump) in the air = a platform appears under your feet. Q does it too.
   - U (or Alt) = free the mouse without opening the pause menu. Click the game to grab it again.
   - M = Berry Menu straight away (no pause menu popping up any more).
   Net: t:'bm' e:'pu' = you got punched (adds a little push to your speed).
   ====================================================================== */
const PUNCH = { cd: 0, side: 0, anim: [0, 0], told: false, platT: 0, climbT: 0, toldClimb: false };
const _pcA = V(), _pcD = V(), _pcP = V(), _pcF = V();
function pcPunchOff(i) { const a = PUNCH.anim[i]; return a > 0 ? Math.sin(a / .2 * Math.PI) * .32 : 0; }
function pcPunch() {
  if (PUNCH.cd > 0 || state.mode !== 'play' || state.xr || BM.open) return;
  if (hands.some(h => h.piece || h.cup || h.sword || h.holding || h.grabF) || BR.held[1] || HZ.phase === 'tpose' || hsHasGun()) return;   // busy hands (or a weapon) don't punch
  if (state.area === 'arena' && aimButton()) return;                                   // that click is for a button
  PUNCH.cd = .3; PUNCH.side ^= 1; PUNCH.anim[PUNCH.side] = .2;
  headWorld(_pcA); camera.getWorldDirection(_pcD);
  if (ac) noiseHit(ac.currentTime, .09, .07, 'bandpass', 1400, 1.2);
  // a friend in front of you? POW (they slide back a little)
  let best = null, bd = 1.9;
  for (const [id, f] of MP.others) { _pcP.copy(f.head.position).sub(_pcA); const d = _pcP.length(); if (d < bd && _pcP.normalize().dot(_pcD) > .78) { bd = d; best = [id, f]; } }
  if (best) {
    _pcF.set(_pcD.x, 0, _pcD.z).normalize().multiplyScalar(3.2); _pcF.y = 1.6;
    netSend({ t: 'bm', e: 'pu', to: best[0], v: [r3(_pcF.x), r3(_pcF.y), r3(_pcF.z)] });
    confetti(best[1].head.position.clone(), 14, [0xffffff, 0xffd25a, 0xff5a5a]); if (ac) { tone('square', 180, 70, .12, .14); noiseHit(ac.currentTime, .1, .15, 'lowpass', 500, .9); }
    if (!PUNCH.told) { PUNCH.told = true; toast('👊 POW! You punched your friend!', 2.5); } return;
  }
  // something solid in front? push off it like a big shove: you fly the other way
  for (let s = .15; s <= 1.3; s += .08) {
    _pcP.copy(_pcA).addScaledVector(_pcD, s); const hit = pawHit(_pcP, .07); if (!hit) continue;
    const k = 8.5 * (1 - s / 1.7);
    state.vel.addScaledVector(_pcD, -k); if (state.vel.y > 9) state.vel.y = 9; if (state.vel.y > .5) state.grounded = false;
    sfxTap(hit.c && hit.c.tag || 'rock', .5); confetti(_pcP.clone(), 8, [0xffffff, 0xd8d8d8]);
    if (!PUNCH.toldL) { PUNCH.toldL = true; toast('💥 Punch the ground or a wall to launch yourself!', 3); } return;
  }
}
canvas.addEventListener('pointerdown', e => {
  if (state.mode !== 'play' || state.xr || e.button !== 0 || CS.on || (document.pointerLockElement !== canvas && !state.touch)) return;
  if (!state.touch && e.pointerId !== 999 && PUNCH.lockedAt && performance.now() - PUNCH.lockedAt < 150) return;   // the click that grabbed the mouse isn't a punch
  pcPunch();
});
function pcClimb(dt, f) {   // W into a wall = climb up it
  if (f <= 0 || BM.nograv) return;
  headWorld(_pcA); _pcF.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  let wall = false;
  for (const dy of [-.25, -.55]) { _pcP.copy(_pcA).addScaledVector(_pcF, .42 * BM.sc); _pcP.y += dy * BM.sc; const hit = pawHit(_pcP, .16 * BM.sc); if (hit && Math.abs(hit.n.y) < .65) { wall = true; break; } }
  if (!wall) return;
  state.vel.y = Math.max(state.vel.y, 3.6); state.grounded = false;
  if ((PUNCH.climbT -= dt) < 0) { PUNCH.climbT = .28; sfxTap('rock', .15); }
  if (!PUNCH.toldClimb) { PUNCH.toldClimb = true; toast('🧗 Climbing! Keep holding forward.', 2.5); }
}
function pcPlat() {   // Platforms mod: a little floor under your feet, mid-air
  if (!BM.plat || state.grounded || PUNCH.platT > 0) return; PUNCH.platT = .25;
  headWorld(_pcA); const S = BM.sc, m = new THREE.Mesh(PLAT_G, PLAT_M); m.position.set(_pcA.x, _pcA.y - state.bodyH - .0125 * S - .01, _pcA.z); m.scale.setScalar(S); scene.add(m); BM.plats.push(m);
  m.userData.col = addCol({ t: 0, x: m.position.x, y: m.position.y, z: m.position.z, hx: .16 * S, hy: .0125 * S, hz: .16 * S, yaw: 0, tag: 'wood' });
  setTimeout(() => { m.userData.fade = .3; }, 2500);
  if (state.vel.y < 0) state.vel.y = 0; sfxTap('wood', .4);
  netSend({ t: 'bm', e: 'plat', p: [r3(m.position.x), r3(m.position.y), r3(m.position.z)], s: S });
}
function pcStep(dt) {
  PUNCH.cd -= dt; PUNCH.platT -= dt; PUNCH.anim[0] -= dt; PUNCH.anim[1] -= dt;
  if (!state.xr && state.mode === 'play' && state.keys.Space && BM.plat) pcPlat();
}
function pcFreeMouse() {
  if (state.xr || state.mode !== 'play' || document.pointerLockElement !== canvas) return;
  state.freeMouse = true; document.exitPointerLock(); toast('🖱️ Mouse is free! Click the game to grab it again.', 3);
}
addEventListener('keydown', e => {
  if (state.xr || state.mode !== 'play' || (document.activeElement && document.activeElement.tagName === 'INPUT')) return;
  if (e.code === 'KeyU' || e.code === 'AltLeft' || e.code === 'AltRight') { e.preventDefault(); pcFreeMouse(); }
  if (e.code === 'KeyQ') { if (BM.plat) pcPlat(); else if (BM.unlocked) toast('🟫 Turn on PLATFORMS in the Berry Menu (M) first!', 2.5); }
});
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement === canvas) { state.freeMouse = false; PUNCH.lockedAt = performance.now(); } });
window.__kg.pc = { PUNCH, pcPunch, pcPlat };
