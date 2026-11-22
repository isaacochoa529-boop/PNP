// ===== PLAYER: VR hands (grab / pull / punch / throw), thumbstick or gorilla movement, PC mouse + keys =====
const handSkin = new THREE.MeshStandardMaterial({ color: SET.skin, roughness: .65 });
const handShirt = new THREE.MeshStandardMaterial({ color: SET.shirt, roughness: .85 });
function makePlayerHand(s) {
  const g = new THREE.Group();
  const h = makeHand(handSkin, s, .3); g.add(h);
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(.03, .036, .2, 10), handSkin); fore.position.y = .1; g.add(fore);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.042, .046, .1, 12), handShirt); cuff.position.y = .2; g.add(cuff);
  g.userData.hand = h;
  return g;
}
const mkH = (side) => ({ side, s: side === 'L' ? -1 : 1, grip: null, src: null, model: makePlayerHand(side === 'L' ? -1 : 1), grab: null,
  w: new V3(), prevW: new V3(), vel: new V3(), vbuf: [], loc: new V3(), prevLoc: new V3(), lvbuf: [], cool: 0, was: false, stuck: false, stuckP: new V3(), curl: .3, touchBtn: false });
const HANDS = { L: mkH('L'), R: mkH('R') };
for (let i = 0; i < 2; i++) {
  const grip = renderer.xr.getControllerGrip(i); rig.add(grip);
  grip.addEventListener('connected', e => {
    const H = HANDS[e.data.handedness === 'left' ? 'L' : 'R']; H.grip = grip; H.src = e.data;
    H.model.rotation.set(Math.PI / 2, 0, 0); H.model.position.set(0, -.01, .07); grip.add(H.model);
  });
  grip.addEventListener('disconnected', () => { for (const H of Object.values(HANDS)) if (H.grip === grip) { grip.remove(H.model); H.grip = null; H.src = null; drop(H); } });
}
function buzz(side, k, ms) {
  const list = side === 'L' || side === 'R' ? [HANDS[side]] : Object.values(HANDS);
  for (const H of list) { const a = H.src && H.src.gamepad && H.src.gamepad.hapticActuators; if (a && a[0]) try { a[0].pulse(clamp(k, 0, 1), ms); } catch (e) {} }
}
// floating text in front of your eyes (VR can't see the page)
const vrText = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.8, .125), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false }));
  m.position.set(0, -.22, -.85); m.renderOrder = 20; m.visible = false; camera.add(m);
  return { c, t, m, until: 0 };
})();
function say3D(msg, secs) {
  const x = vrText.c.getContext('2d'); x.clearRect(0, 0, 1024, 160);
  x.fillStyle = 'rgba(22,12,10,.88)'; x.beginPath(); x.roundRect(4, 4, 1016, 152, 40); x.fill();
  x.fillStyle = '#fff4ec'; x.font = 'bold 48px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(msg, 512, 82, 980);
  vrText.t.needsUpdate = true; vrText.m.visible = true; vrText.until = state.t + secs;
}

// ---- grabbing ----
const _hm = new THREE.Matrix4(), _bm = new THREE.Matrix4();
function startGrab(H, found, handMatrix, handW) {
  if (found.rag !== undefined) { H.grab = { rag: found.rag, dum: DUM.id }; ragHold(H, found.rag, handW || RAG.p[found.rag]); }
  else { const b = found.body; H.grab = { body: b, off: new THREE.Matrix4().copy(handMatrix).invert().multiply(b.obj.matrixWorld) }; b.held = H; b.still = 0; }
  sfx.squish(); buzz(H.side, .4, 30);
}
function drop(H) {
  const g = H.grab; if (!g) return; H.grab = null;
  if (g.rag !== undefined) { ragRelease(H, avgVel(H.vbuf, 4).multiplyScalar(.9)); return; }
  if (g.body) {
    const b = g.body; b.held = null; b.still = 0;
    const v = avgVel(H.vbuf, 4); b.v.copy(v).clampLength(0, 14);
    b.w.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(Math.min(14, v.length() * 2.5));
  }
}
function avgVel(buf, n) { const v = new V3(); const k = Math.min(n, buf.length); for (let i = buf.length - k; i < buf.length; i++) v.add(buf[i]); return k ? v.divideScalar(k) : v; }
function grabValid(H) {
  const g = H.grab; if (!g) return false;
  if (g.rag !== undefined) {
    if (!DUM || g.dum !== DUM.id) { H.grab = null; ragRelease(H); return false; }
    if (!RAG.alive[g.rag]) {          // it tore off: keep holding the torn-off piece
      const P = DUM.parts[RAG.owner[g.rag]]; ragRelease(H);
      if (P && P.body && !P.body.held) { const b = P.body; H.grab = { body: b, off: new THREE.Matrix4().copy(H.mat).invert().multiply(b.obj.matrixWorld) }; b.held = H; return true; }
      H.grab = null; return false;
    }
    return true;
  }
  if (g.body && !LOOSE.includes(g.body)) { H.grab = null; return false; }
  return true;
}
// moves a held loose body with the hand and handles floor smashes
function carry(H, dt, handW) {
  const b = H.grab.body, o = b.obj;
  const prev = _v3.copy(o.position);
  _bm.multiplyMatrices(H.mat, H.grab.off); _bm.decompose(o.position, o.quaternion, _v1);
  o.scale.set(1, 1, 1);
  b.v.subVectors(o.position, prev).divideScalar(Math.max(dt, 1e-3));
  const r = collideFloor(b, false);
  if (r.deepest > 0 && b.v.y < -2.4 && b.cool <= 0) onImpact(b, r.hp, -b.v.y);
  keepIn(o.position, b.r * .5);
  if (b.v.length() > 2.2 && H.cool <= 0 && hitDummy(o.position, b.v, H.side)) H.cool = .3;
}
function handStep(H, dt, pressed, handW, handMatrix) {
  H.mat = handMatrix;
  H.vel.subVectors(handW, H.prevW).divideScalar(Math.max(dt, 1e-3)); H.prevW.copy(handW);
  H.vbuf.push(H.vel.clone()); if (H.vbuf.length > 8) H.vbuf.shift();
  H.cool -= dt;
  if (pressed && !H.was && !H.grab && !H.stuck) {
    const f = inVR() ? findGrab(handW, .14) : H.pcFound;
    if (f) startGrab(H, f, handMatrix, handW);
  }
  if (!pressed && H.was) drop(H);
  H.was = pressed;
  if (H.grab && grabValid(H)) {
    if (H.grab.rag !== undefined) {
      const hd = RAG.holds.find(x => x.H === H); if (hd) hd.target.copy(handW);
      // weight: the further the body lags behind your hand, the more it pulls on your hand
      const lag = RAG.p[H.grab.rag].distanceTo(handW);
      if (lag > .04) buzz(H.side, Math.min(.5, lag * 1.5), 16);
    } else carry(H, dt, handW);
  } else if (inVR() && H.vel.length() > 1.6 && H.cool <= 0) { if (hitDummy(handW, avgVel(H.vbuf, 3), H.side)) H.cool = .25; }
  // buttons you can touch
  const nearBtn = handW.distanceTo(RESP_POS) < .13;
  if (nearBtn && !H.touchBtn) pressRespawn();
  H.touchBtn = nearBtn;
  if (handW.distanceTo(GARY_POS) < .3 && !state.garyT) touchGary();
  // finger curl
  const want = H.grab ? 1.3 : pressed ? 1.1 : .3;
  H.curl += (want - H.curl) * Math.min(1, dt * 18);
  H.model.userData.hand.userData.fingers.forEach(f => f.rotation.z = -H.s * H.curl);
}
function pressRespawn() {
  respBtn.position.y = .97; setTimeout(() => respBtn.position.y = .99, 150);
  sfx.click(); sfx.pop(); buildDummy(); toast('🧍 Fresh dummy!');
}
function touchGary() {
  state.garyT = 1; state.rainbow = !state.rainbow;
  sfx.chime(); toast(state.rainbow ? '🐔 Gary says: BAWK! 🌈' : '🐔 Gary says: bawk.');
  setTimeout(() => state.garyT = 0, 2000);
}

// ---- VR movement ----
const gor = { v: new V3() };
let snapReady = true;
function rigGround() { return SET.move === 'gorilla' ? -.72 : 0; }
function stepVR(dt) {
  rig.updateMatrixWorld(true);
  const sticks = { L: [0, 0], R: [0, 0] }, btn = {};
  for (const H of Object.values(HANDS)) {
    if (!H.grip || !H.src) continue;
    const gp = H.src.gamepad;
    const pressed = gp && gp.buttons[1] ? gp.buttons[1].value > .55 : false;
    if (gp && gp.axes.length >= 4) sticks[H.side] = [gp.axes[2], gp.axes[3]];
    if (gp && gp.buttons[4]) btn[H.side] = gp.buttons[4].pressed;
    H.loc.copy(H.grip.position);
    const lv = _v1.subVectors(H.loc, H.prevLoc).divideScalar(Math.max(dt, 1e-3)).applyQuaternion(rig.quaternion);
    H.lvbuf.push(lv.clone()); if (H.lvbuf.length > 6) H.lvbuf.shift(); H.prevLoc.copy(H.loc);
    H.grip.updateMatrixWorld(true);
    H.grip.getWorldPosition(H.w);
    handStep(H, dt, pressed, H.w.clone(), H.grip.matrixWorld.clone());
  }
  // snap turn (right stick)
  const tx = sticks.R[0];
  if (Math.abs(tx) > .7 && snapReady) { snapReady = false; snapTurn(tx > 0 ? -Math.PI / 4 : Math.PI / 4); }
  if (Math.abs(tx) < .3) snapReady = true;
  if (SET.move === 'gorilla') gorilla(dt);
  else {
    const [x, y] = sticks.L;
    if (Math.hypot(x, y) > .15) {
      camera.getWorldDirection(_v1); _v1.y = 0; _v1.normalize();
      _v2.set(-_v1.z, 0, _v1.x);
      rig.position.addScaledVector(_v1, -y * 2.4 * dt).addScaledVector(_v2, x * 2.4 * dt);
    }
    rig.position.y = 0;
  }
  // keep your head inside the yard
  rig.updateMatrixWorld(true);
  const cw = camera.getWorldPosition(_v1), c2 = keepIn(cw.clone(), .3);
  rig.position.x += c2.x - cw.x; rig.position.z += c2.z - cw.z;
}
function snapTurn(a) {
  const before = camera.getWorldPosition(new V3());
  rig.rotation.y += a; rig.updateMatrixWorld(true);
  const after = camera.getWorldPosition(new V3());
  rig.position.x += before.x - after.x; rig.position.z += before.z - after.z;
}
// gorilla arms: hands that touch the floor (or wall) stick; your body moves the other way; let go to fling
function gorilla(dt) {
  const corr = new V3(); let n = 0, released = null;
  for (const H of Object.values(HANDS)) {
    if (!H.grip) continue;
    const raw = _v2.copy(H.loc).applyMatrix4(rig.matrixWorld);
    const wallHit = Math.hypot(raw.x, raw.z) > AR_R + .4 && !(Math.abs(raw.x) < .75 && raw.z < -8.5);
    const touch = raw.y < floorAt(raw.x, raw.z) + .02 || wallHit;
    if (!H.stuck && touch && !H.grab) { H.stuck = true; H.stuckWall = wallHit && raw.y >= .02; H.stuckP.copy(raw); if (raw.y < 0.02) H.stuckP.y = .02; buzz(H.side, .25, 25); }
    if (H.stuck) {
      const inward = Math.hypot(raw.x, raw.z) < Math.hypot(H.stuckP.x, H.stuckP.z) - .04;
      if (H.stuckWall ? inward : raw.y - H.stuckP.y > .03) { H.stuck = false; released = H; continue; }
      corr.add(_v3.subVectors(H.stuckP, raw)); n++;
    }
  }
  if (n) { rig.position.addScaledVector(corr, 1 / n); gor.v.set(0, 0, 0); }
  else {
    if (released) {
      const v = avgVel(released.lvbuf, 5).multiplyScalar(-1.3);
      if (v.length() > .5) gor.v.copy(v.clampLength(0, 7));
    }
    gor.v.y -= 9.8 * dt;
    rig.position.addScaledVector(gor.v, dt);
    const g = rigGround();
    if (rig.position.y < g) { rig.position.y = g; gor.v.y = 0; gor.v.x *= Math.exp(-7 * dt); gor.v.z *= Math.exp(-7 * dt); }
  }
  rig.position.y = Math.min(rig.position.y, 2.5);
}

// ---- PC controls ----
const pc = { yaw: 0, pitch: 0, keys: {}, down: false, dist: 1.2, T: new V3(), punchT: 0 };
const pcHandR = HANDS.R, pcHandL = makePlayerHand(-1);
function pcAttach() {
  pcHandR.model.rotation.set(1.2, 0, -.15); pcHandR.model.position.set(.22, -.2, -.42); camera.add(pcHandR.model);
  pcHandL.rotation.set(1.2, 0, .15); pcHandL.position.set(-.24, -.22, -.44); camera.add(pcHandL);
}
function pcDetach() { camera.remove(pcHandR.model); camera.remove(pcHandL); }
const canvas = renderer.domElement;
canvas.addEventListener('mousedown', e => {
  if (state.mode !== 'pc') return;
  audio();
  if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  if (e.button === 0) pc.down = true;
  if (e.button === 2) pcPunch();
});
addEventListener('mouseup', e => { if (e.button === 0) pc.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (state.mode !== 'pc' || document.pointerLockElement !== canvas) return;
  pc.yaw -= e.movementX * .0025; pc.pitch = clamp(pc.pitch - e.movementY * .0025, -1.45, 1.4);
});
addEventListener('wheel', e => { if (state.mode === 'pc') pc.dist = clamp(pc.dist - e.deltaY * .0015, .35, 3); });
addEventListener('keydown', e => {
  pc.keys[e.code] = true;
  if (state.mode !== 'pc') return;
  if (e.code === 'KeyR') pressRespawn();
  if (e.code === 'KeyQ' && pcHandR.grab) { pc.dist = Math.max(.3, pc.dist - .5); pc.yank = .12; }
  if (e.code === 'Escape') showMenu();
});
addEventListener('keyup', e => { pc.keys[e.code] = false; });
document.addEventListener('pointerlockchange', () => { if (state.mode === 'pc' && document.pointerLockElement !== canvas) pc.down = false; });
function pcRay() { const o = camera.getWorldPosition(new V3()), d = camera.getWorldDirection(new V3()); return { o, d }; }
function pcPunch() {
  pc.punchT = .25; const { o, d } = pcRay();
  for (let t = .3; t < 2.2; t += .04) { if (hitDummy(_v1.copy(o).addScaledVector(d, t), d.clone().multiplyScalar(6), 'R')) return; }
  for (const b of LOOSE) if (!b.held && b.obj.position.distanceTo(o) < 2.5 && _v1.subVectors(b.obj.position, o).normalize().dot(d) > .96) { b.v.addScaledVector(d, 4).y += 2; b.still = 0; b.w.set(rand(-8, 8), rand(-8, 8), rand(-8, 8)); sfx.thud(.6); }
}
function stepPC(dt) {
  rig.rotation.set(0, pc.yaw, 0); camera.rotation.set(pc.pitch, 0, 0, 'YXZ'); camera.position.set(0, 1.65, 0);
  const f = new V3(-Math.sin(pc.yaw), 0, -Math.cos(pc.yaw)), r = new V3(-f.z, 0, f.x);
  const k = pc.keys, mv = new V3();
  if (k.KeyW || k.ArrowUp) mv.add(f); if (k.KeyS || k.ArrowDown) mv.sub(f);
  if (k.KeyD || k.ArrowRight) mv.add(r); if (k.KeyA || k.ArrowLeft) mv.sub(r);
  if (mv.lengthSq()) rig.position.addScaledVector(mv.normalize(), (k.ShiftLeft ? 4.5 : 2.6) * dt);
  keepIn(rig.position, .3);
  rig.updateMatrixWorld(true);
  const { o, d } = pcRay();
  // look for something to grab when you click
  if (pc.down && !pcHandR.was) {
    const fnd = findGrabRay(o, d);
    pcHandR.pcFound = fnd;
    if (fnd) pc.dist = clamp(fnd.t, .35, 3);
    else { const t = _v1.subVectors(RESP_POS, o).dot(d); if (t > 0 && t < 3.5 && _v2.copy(o).addScaledVector(d, t).distanceTo(RESP_POS) < .15) pressRespawn();
      const tg = _v1.subVectors(GARY_POS, o).dot(d); if (tg > 0 && tg < 3 && _v2.copy(o).addScaledVector(d, tg).distanceTo(GARY_POS) < .3) touchGary(); }
  }
  if (pc.yank > 0) pc.yank -= dt;
  let dd = pc.dist;   // looking down steeply while holding something = slam it into the floor
  if (pcHandR.grab && d.y < -.55) dd = Math.max(dd, o.y / -d.y + .12);
  pc.T.copy(o).addScaledVector(d, dd);
  if (pc.T.y < .01) pc.T.y = Math.max(pc.T.y, -.25);
  const m = new THREE.Matrix4().compose(pc.T, camera.getWorldQuaternion(new Q()), new V3(1, 1, 1));
  handStep(pcHandR, dt, pc.down && !!(pcHandR.grab || pcHandR.pcFound), pc.T.clone(), m);
  if (!pc.down) pcHandR.pcFound = null;
  // show the right hand where it's grabbing, or punching
  pc.punchT = Math.max(0, pc.punchT - dt);
  if (pcHandR.grab) { const lp = camera.worldToLocal((pcHandR.grab.rag !== undefined ? RAG.p[pcHandR.grab.rag] : pc.T).clone()); pcHandR.model.position.copy(lp).add(_v1.set(0, -.03, .09)); }
  else pcHandR.model.position.set(.22 - Math.sin(pc.punchT / .25 * Math.PI) * .18, -.2 + Math.sin(pc.punchT / .25 * Math.PI) * .08, -.42 - Math.sin(pc.punchT / .25 * Math.PI) * .35);
}

// ---- menu + starting ----
function showMenu() {
  if (document.pointerLockElement) document.exitPointerLock();
  $('menu').hidden = false; $('hud').hidden = true; $('cross').hidden = true;
  if (state.mode === 'pc') { pcDetach(); drop(pcHandR); }
  state.mode = 'menu';
}
function startPC() {
  audio(); state.mode = 'pc'; $('menu').hidden = true; $('hud').hidden = false; $('cross').hidden = false;
  rig.position.set(0, 0, 1.2); pc.yaw = 0; pc.pitch = -.12; pcAttach(); buildDummy();
  canvas.requestPointerLock && canvas.requestPointerLock();
  toast('Click to look around. HOLD left click on the dummy and yank! 😈');
}
async function startVR() {
  audio();
  try {
    const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(s);
    state.mode = 'vr'; $('menu').hidden = true;
    rig.position.set(0, rigGround(), 1.2); rig.rotation.set(0, 0, 0); gor.v.set(0, 0, 0);
    buildDummy();
    toast(SET.move === 'gorilla' ? '🦍 Push the floor to move. GRIP a body part and PULL!' : '🕹️ Left stick walks. GRIP a body part and PULL!');
    s.addEventListener('end', () => { state.mode = 'menu'; $('menu').hidden = false; for (const H of Object.values(HANDS)) { drop(H); H.stuck = false; } rig.position.set(0, 0, 1.2); buildDummy(); });
  } catch (e) { console.error(e); $('xrnote').textContent = '😕 Could not start VR: ' + e.message; }
}
// menu wiring
function swatches(id, list, key) {
  const el = $(id);
  list.forEach(c => {
    const i = document.createElement('i'); i.style.background = c; if (SET[key] === c) i.className = 'on';
    i.onclick = () => { SET[key] = c; saveSet(); [...el.children].forEach(x => x.className = ''); i.className = 'on'; applyLook(); };
    el.appendChild(i);
  });
}
function applyLook() { handSkin.color.set(SET.skin); handShirt.color.set(SET.shirt); buildDummy({ gold: DUM ? DUM.gold : false }); }
swatches('skin', SKINS, 'skin'); swatches('shirt', SHIRTS, 'shirt'); swatches('hair', HAIRS, 'hair');
document.querySelectorAll('[data-move]').forEach(b => {
  b.classList.toggle('on', b.dataset.move === SET.move);
  b.onclick = () => { SET.move = b.dataset.move; saveSet(); document.querySelectorAll('[data-move]').forEach(x => x.classList.toggle('on', x === b)); };
});
$('pc').onclick = startPC;
$('vr').onclick = startVR;
$('hud').onclick = showMenu;
if (navigator.xr) navigator.xr.isSessionSupported('immersive-vr').then(ok => { if (!ok) { $('vr').disabled = true; $('xrnote').textContent = 'No VR headset found here. Open this page on your Quest to play in VR. 🥽'; } }).catch(() => {});
else { $('vr').disabled = true; $('xrnote').textContent = 'No VR here. Open this page on your Quest to play in VR. 🥽'; }
