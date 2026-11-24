/* ======================= audio (all synthesized) ======================= */
let ac = null, master = null;
function audioOn() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .7; master.connect(ac.destination); } catch (e) { ac = null; }
}
let noiseBuf = null;
function noise() { if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ac.createBufferSource(); s.buffer = noiseBuf; return s; }
function tone(type, f0, f1, dur, vol, when = 0) {
  const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
const TAP = { grass: [180, 900], wood: [260, 1800], rock: [140, 2600], mush: [380, 700] };
function sfxTap(tag, vol) {
  if (!ac) return; const [f, cut] = TAP[tag] || TAP.grass, v = clamp(vol, .05, 1);
  tone('sine', f * 1.4, f * .6, .09, .5 * v);
  const n = noise(), flt = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  flt.type = 'lowpass'; flt.frequency.value = cut; g.gain.setValueAtTime(.35 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + .08);
  n.connect(flt); flt.connect(g); g.connect(master); n.start(t); n.stop(t + .1);
}
const sfxBoing = () => { if (!ac) return; tone('triangle', 160, 620, .35, .5); tone('sine', 320, 1240, .3, .2, .02); };
const sfxBerry = n => { if (!ac) return; const b = 660 * Math.pow(2, (n % 6) * 2 / 12); [1, 1.25, 1.5].forEach((m, i) => tone('triangle', b * m, b * m * 1.01, .35, .25, i * .06)); };
const sfxWin = () => { if (!ac) return; [523, 659, 784, 1046, 1318].forEach((f, i) => tone('square', f, f, .3, .12, i * .1)); };
const sfxSqueak = () => { if (!ac) return; tone('sine', 900, 1500, .12, .25); tone('sine', 1300, 1900, .1, .2, .12); };

/* ======================= game state ======================= */
const state = { mode: 'menu', xr: false, got: 0, time: 0, running: false, done: false, size: 1, bodyH: .6, third: false, vel: V(), grounded: false, wasStuck: false, velBuf: [], golden: false, claps: [], yaw: 0, pitch: 0, keys: {}, typed: '', joy: { x: 0, y: 0 }, touch: false };
window.__kg = { state, hands, rig, camera, colliders, berries, sim: { on: false, local: [V(-.25, 1, -.3), V(.25, 1, -.3)] }, step: null };
const sim = window.__kg.sim;

function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)} s`; }
let toastT = 0;
function toast(msg, secs = 3) { const el = $('toast'); el.textContent = msg; el.style.opacity = 1; toastT = secs; showVrToast(msg, secs); }
function updateHud() { $('hudB').textContent = `🫐 ${state.got} / ${BERRIES_TOTAL}`; drawWrist(); }

function respawn() {
  if (typeof RC !== 'undefined' && RC.ride) return;   // no bailing out mid-coaster
  if (typeof PT !== 'undefined' && PT && PT.inside) return partyRespawn();
  if (state.area === 'arena') return arenaRespawn();
  if (state.area === 'wilds') return wildRespawn();
  if (state.area === 'beach') return beachRespawn();
  rig.position.copy(SPAWN); rig.position.y += state.bodyH - eyeLocal(_e).y + .05;
  state.vel.set(0, 0, 0); state.velBuf.length = 0; state.wasStuck = false;
  hands.forEach(h => { h.stuck = false; h.ready = false; });
  if (!state.xr) { state.yaw = 0; state.pitch = 0; rig.rotation.y = 0; }
}
function resetRun() {
  state.got = 0; state.time = 0; state.running = false; state.done = false;
  berries.forEach(b => { b.taken = false; b.g.visible = true; b.g.scale.setScalar(1); });
  updateHud();
}

/* ---------- velocity buffer for flings ---------- */
function pushVel(v) { const c = v.clone(); c.t = tAll; state.velBuf.push(c); if (state.velBuf.length > 6) state.velBuf.shift(); }
function launch() {
  // only the last moment of the shove counts: old pushes, and the tiny wobbles of a paw just resting there, never fling you
  const buf = state.velBuf.filter(v => tAll - v.t < .12); state.velBuf.length = 0;
  if (!buf.length) return;
  const plain = V(); for (const v of buf) plain.add(v); plain.multiplyScalar(1 / buf.length);
  if (plain.length() < .45) { state.vel.copy(plain).multiplyScalar(.3); if (state.vel.y > .1) state.vel.y = .1; return; }   // a let-go, not a jump
  state.velBuf.push(...buf);
  // speed-weighted average: the quick part of your shove counts most, so even a light one-paw hop keeps its pop
  const avg = V(); let w = 0;
  for (const v of state.velBuf) { const sp = v.length(); avg.addScaledVector(v, sp); w += sp; }
  state.velBuf.length = 0;
  if (w < 1e-4) return;
  avg.multiplyScalar(LAUNCH_MUL / w);
  if (avg.length() > MAX_LAUNCH) avg.setLength(MAX_LAUNCH);
  if (avg.length() < .25) avg.multiplyScalar(.3);     // only a really slow let-go turns into a gentle drop
  state.vel.copy(avg).multiplyScalar(brJump());
}

/* ---------- body collision: feet, middle and head spheres ---------- */
const bodyInfo = { nrm: V(), ground: false, bounce: null, col: null };
const _h = V(), _p = V(), _p0 = V();
const _e = V();
// where the critter's eyes are, in rig space (the desktop third-person camera floats behind them)
function eyeLocal(out) { return (!state.xr && !sim.on && state.third) ? out.set(0, state.bodyH, 0) : out.copy(camera.position); }
function headWorld(out) { return rig.localToWorld(eyeLocal(out)); }
function resolveBody(stuck) {
  bodyInfo.nrm.set(0, 0, 0); bodyInfo.ground = false; bodyInfo.bounce = null; bodyInfo.col = null;
  GL.bodyCtx = true;
  for (let pass = 0; pass < 2; pass++) {
    rig.updateMatrixWorld(); headWorld(_h);
    const feetY = _h.y - state.bodyH + .25;   // your base hangs below your head, so you rest at critter height wherever your real head is
    const spheres = [[_h.x, feetY, _h.z, .25]];
    if (_h.y - feetY > .55) spheres.push([_h.x, (feetY + _h.y) / 2, _h.z, .24]);
    spheres.push([_h.x, _h.y, _h.z, .17]);
    for (const [x, y, z, r] of spheres) {
      _p.set(x, y, z); _p0.copy(_p);
      if (pushOut(_p, r, bodyInfo)) rig.position.add(_p.sub(_p0));
    }
  }
  GL.bodyCtx = false;
  state.grounded = bodyInfo.ground;
  if (bodyInfo.nrm.lengthSq() > 0 && !stuck) {
    const n = bodyInfo.nrm.normalize(), vn = state.vel.dot(n);
    if (vn < 0) state.vel.addScaledVector(n, -vn);
  }
  if (bodyInfo.bounce && state.vel.y < 1 && (!stuck || bodyInfo.nrm.y > .5)) bounceOff(bodyInfo.bounce, 1);
}
function bounceOff(c, k) {
  state.vel.y = Math.max(state.vel.y, c.bounce * k);
  if (c.mush) c.mush.squish = 1;
  sfxBoing(); hands.forEach(h => { if (h.stuck) { h.stuck = false; h.cool = .25; } buzz(h, .8, 60); });
  state.velBuf.length = 0; state.wasStuck = false;
}

/* ---------- reading paws from XR (or from the test simulator) ---------- */
const PAW_OFF = V(0, -.01, -.06);
const _q = new THREE.Quaternion(), _eul = new THREE.Euler();
const _raw = V(), _rq = new THREE.Quaternion();
// Read each paw once per frame. Shaky tracking (hands out of view, controllers seen only by their motion sensors)
// is smoothed with a speed-aware filter: still paws stay steady, fast swings stay snappy. If tracking drops for a
// moment the paw holds its last spot for up to 0.35 s instead of letting go.
function sampleHands(dt) {
  for (const h of hands) {
    let ok = false;
    if (sim.on) { _raw.copy(sim.local[h.i]); if (sim.q && sim.q[h.i]) _rq.copy(sim.q[h.i]); else _rq.identity(); ok = true; }
    else if (state.xr && h.src) {
      if (h.src.hand) {
        const j = h.xhand && h.xhand.joints && h.xhand.joints['middle-finger-metacarpal'];
        if (j && j.visible) { _raw.copy(j.position); _rq.copy(j.quaternion); ok = true; }
      } else if (h.grip && h.grip.visible) { _rq.copy(h.grip.quaternion); _raw.copy(PAW_OFF).applyQuaternion(_rq).add(h.grip.position); ok = true; }
      else if (h.ctl && h.ctl.visible) { _rq.copy(h.ctl.quaternion); _raw.copy(PAW_OFF).applyQuaternion(_rq).add(h.ctl.position); ok = true; }
    }
    if (ok) {
      h.lost = 0;
      if (!h.ready || sim.on) { h.local.copy(_raw); h.q.copy(_rq); }
      else {
        const speed = _raw.distanceTo(h.local) / Math.max(dt, 1e-3), cutoff = 5 + speed * 3;   // Hz
        h.local.lerp(_raw, 1 - Math.exp(-2 * Math.PI * cutoff * dt)); h.q.slerp(_rq, 1 - Math.exp(-dt * 40));
      }
      h.tracked = true;
    } else {
      h.lost = (h.lost || 0) + dt;
      h.tracked = h.ready && h.lost < .35;
    }
    if (!h.tracked) { h.ready = false; h.stuck = false; if (h.holding || h.sword || h.piece) dropAny(h); }
  }
}
// h.target is where the paw's contact point should be. While holding a toy, the toy is the contact point:
// it sits in front of the paw and touches the world for you, like a longer arm.
function readHands() {
  for (const h of hands) {
    if (!h.tracked) continue;
    rig.localToWorld(h.target.copy(h.local));
    if (!h.off) h.off = V();
    if (h.holding) { _q2.copy(rig.quaternion).multiply(h.q); h.off.set(0, -.015, -(.085 + h.holding.r)).applyQuaternion(_q2); }
    else h.off.set(0, 0, 0);
    h.target.add(h.off); h.cr = h.holding ? h.holding.r : PAW_R;
    if (!h.ready || h.reset) { h.prev.copy(h.target); h.pos.copy(h.target); h.ready = true; h.reset = false; }
  }
}
const _q2 = new THREE.Quaternion();
function clutch(h, dt) {   // a paw holding something squeezes into a fist
  const on = (h.holding || h.sword || h.piece || pip.heldBy === h) ? 1 : 0; h.cl = (h.cl || 0) + (on - (h.cl || 0)) * Math.min(1, dt * 16);
  const S = BM.sc; h.paw.scale.set((h.side === 'left' ? -1 : 1) * (1 + .03 * h.cl) * S, (1 - .05 * h.cl) * S, (1 - .06 * h.cl) * S);
  // fingers: trigger = pointer, grip = middle finger, thumb rests on the buttons/stick = thumb down
  const want = h.cw || (h.cw = [.25, .25, .25]), gp = state.xr && h.src && h.src.gamepad;
  if (gp && !h.src.hand) {
    const B = gp.buttons, val = i => (B[i] ? (B[i].value || (B[i].pressed ? 1 : 0)) : 0), touch = i => B[i] && (B[i].touched || B[i].pressed);
    want[1] = .08 + .92 * val(0); want[2] = .08 + .92 * val(1); want[0] = (touch(3) || touch(4) || touch(5)) ? .95 : .05;
  } else if (!state.xr && !sim.on) {   // desktop: point at the computer, otherwise relaxed
    const pt = h.i === 1 && state.area === 'grove' && comp && comp.g.position.distanceToSquared(rig.position) < 7;
    want[0] = pt ? .9 : .3; want[1] = pt ? 0 : .3; want[2] = pt ? 1 : .35;
  } else if (state.xr) { want[0] = want[1] = want[2] = .25; }
  if (on) { want[0] = Math.max(want[0], .75); want[1] = Math.max(want[1], .8); want[2] = Math.max(want[2], .85); }
  const c = h.paw.userData.curl, k = Math.min(1, dt * 22);
  for (let j = 0; j < 3; j++) c[j] += (want[j] - c[j]) * k;
  setCurl(h.paw, c);
}
function tipWorld(h, out) { const F = h.paw.userData.fingers; return F ? F[1].end.getWorldPosition(out) : out.copy(h.pos); }
function buzz(h, v, ms) { const gp = h.src && h.src.gamepad; if (gp && gp.hapticActuators && gp.hapticActuators[0]) try { gp.hapticActuators[0].pulse(v, ms); } catch (e) {} }

/* ---------- the arm-swing step ---------- */
const _d = V(), _mv = V(), _tmp = V();
function stepArms(dt) {
  sampleHands(dt); rig.updateMatrixWorld(); readHands();
  // 1) paws that are stuck drag the body
  _mv.set(0, 0, 0); let ns = 0, pushing = false;
  for (const h of hands) {
    if (!h.stuck) { if (h.hold) letGoHold(h); continue; }
    if (h.hold) {   // gripping a climbing hold: it's a real handle, pull any way you like
      _d.subVectors(h.target, h.sp); if (_d.length() > .9) { letGoHold(h); h.stuck = false; continue; }
      _mv.sub(_d); ns++; pushing = true; continue;
    }
    _d.subVectors(h.target, h.sp); const sep = _d.dot(h.n);
    if (sep < .004) pushing = true;
    if (sep > RELEASE || _d.length() > .7) { h.stuck = false; h.cool = .12; continue; }
    // pushing into or along the surface moves you; pulling away doesn't drag you back, it just counts toward letting go
    if (sep > 0) _d.addScaledVector(h.n, -sep);
    _mv.sub(_d); ns++;
  }
  if (ns) {
    _mv.multiplyScalar(1 / ns); if (_mv.length() > .35) _mv.setLength(.35);
    rig.position.add(_mv); state.vel.set(0, 0, 0);
    if (pushing) pushVel(_tmp.copy(_mv).multiplyScalar(1 / dt));   // frames where you're just peeling the paw off don't water down your jump
  } else {
    if (state.wasStuck) launch();
    if (!swimArms(dt)) {   // in deep water your arms swim instead (97-swim)
      state.vel.y -= G * bmGrav() * dt; if (BM.nograv) state.vel.multiplyScalar(Math.exp(-dt * .8));
      if (state.grounded) { const f = Math.exp(-(onPuddle() ? .35 : 7) * dt); state.vel.x *= f; state.vel.z *= f; }
    }
    rig.position.addScaledVector(state.vel, dt);
  }
  state.wasStuck = ns > 0;
  resolveBody(ns > 0);
  // 2) free paws look for something to grab
  rig.updateMatrixWorld(); readHands();
  for (const h of hands) {
    if (!h.tracked) continue;
    h.cool -= dt;
    if (h.stuck) { h.pos.copy(h.sp); h.prev.copy(h.pos); continue; }
    let hit = null;
    for (let k = 1; k <= 4 && !hit; k++) { _p.lerpVectors(h.prev, h.target, k / 4); hit = pawHit(_p, h.cr, h); }
    if (hit) {
      _p.addScaledVector(hit.n, h.cr - hit.d);
      const speed = h.prev.distanceTo(h.target) / dt;
      if (hit.c.pane && glassPaw(h, hit, _p, speed)) { h.pos.copy(h.target); h.prev.copy(h.pos); continue; }   // smashed right through
      if (h.cool <= 0) {
        h.stuck = true; h.sp.copy(_p); h.n.copy(hit.n); h.col = hit.c; h.pos.copy(_p);
        if (!hands.some(o => o !== h && o.stuck)) state.velBuf.length = 0;
        if (speed > .3) { if (!hit.c.pane) sfxTap(hit.c.tag, speed / 3); buzz(h, clamp(speed / 4, .15, 1), 25); }
        if (hit.c.mush) hit.c.mush.squish = Math.max(hit.c.mush.squish, clamp(speed / 6, .1, .5));
        if (!state.running && !state.done && speed > .3) state.running = true;
      } else h.pos.copy(_p);
    } else h.pos.copy(h.target);
    h.prev.copy(h.pos);
  }
  // 3) paw visuals + paw speed (for throwing)
  for (const h of hands) {
    if (h.tracked) { if (!h.vel) { h.vel = V(); h.last = h.pos.clone(); } _tmp.subVectors(h.pos, h.last).multiplyScalar(1 / dt); h.vel.lerp(_tmp, .35); h.last.copy(h.pos); }
    h.paw.visible = h.tracked;
    if (!h.tracked) continue;
    h.paw.position.copy(h.pos).sub(h.off); h.paw.quaternion.copy(rig.quaternion).multiply(h.q);   // the paw sits behind the toy it holds
    clutch(h, dt);
  }
  clapCheck(dt);
}

/* ---------- desktop walking ---------- */
function stepDesktop(dt) {
  const k = state.keys, J = state.joy, jm = Math.hypot(J.x, J.y);
  let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  if (jm > .12) { f = -J.y; s = J.x; }   // phone stick: push it all the way to run
  const sp = k.ShiftLeft || k.ShiftRight || jm > .92 ? 7.5 : jm > .12 ? 4.5 * Math.min(1, jm * 1.3) : 4.5;
  const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw), rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw);
  let wx = fx * f + rx * s, wz = fz * f + rz * s; const L = Math.hypot(wx, wz); if (L > 0) { wx /= L; wz /= L; }
  const acc = state.grounded ? (onPuddle() ? 1.1 : 14) : 3.5, v = state.vel;
  if (!swimDesk(dt, f, s)) {   // in deep water you swim instead (97-swim)
    v.x += (wx * sp - v.x) * Math.min(1, acc * dt); v.z += (wz * sp - v.z) * Math.min(1, acc * dt);
    if (k.Space && BM.nograv && !state.grounded) v.y = 3;
    if (k.Space && state.grounded) { v.y = 5.3 * brJump(); state.grounded = false; sfxTap('grass', .3); }
    v.y -= G * bmGrav() * dt;
  }
  pcClimb(dt, f);
  rig.position.addScaledVector(v, dt);
  resolveBody(false);
  if (L > 0 && !state.running && !state.done) state.running = true;
  rig.rotation.y = state.yaw; camera.rotation.set(state.pitch, 0, 0);
  // third-person camera orbits behind the critter
  if (state.third) { camera.position.set(0, state.bodyH + .35 - Math.sin(state.pitch) * 2.4, Math.cos(state.pitch) * 2.4); camera.rotation.set(state.pitch, 0, 0); }
  else camera.position.set(0, state.bodyH, 0);
  // desktop paws swing as you run
  const t = performance.now() / 1000, moving = L > 0 && state.grounded;
  rig.updateMatrixWorld(); camera.updateMatrixWorld();
  hands.forEach((h, i) => {
    const sd = i ? 1 : -1, ph = t * (sp > 5 ? 11 : 8) + i * Math.PI, sw = moving ? Math.sin(ph) : 0, bob = moving ? Math.cos(ph) * .03 : Math.sin(t * 2 + i) * .006;
    if (state.third) { h.pos.set(sd * .3 * avSc(), .14 * avSc() + bob + (state.grounded ? 0 : .35), -.1 - sw * .22).applyQuaternion(rig.quaternion); h.pos.add(rig.position); h.paw.quaternion.copy(rig.quaternion); }
    else { const pu = pcPunchOff(i); camera.localToWorld(h.pos.set(sd * (.2 - pu * .45), -.2 + bob + pu * .2, -.42 + sw * .04 - pu)); camera.getWorldQuaternion(h.paw.quaternion).multiply(_q.setFromEuler(_eul.set(.5, 0, 0))); }
    h.paw.position.copy(h.pos); h.paw.visible = true; clutch(h, dt);
  });
}

/* ---------- claps (secret #2) ---------- */
let clapPrev = 1, clapArmed = true;
function clapCheck(dt) {
  if (!hands[0].tracked || !hands[1].tracked) return;
  const d = hands[0].pos.distanceTo(hands[1].pos), closing = (clapPrev - d) / dt; clapPrev = d;
  if (clapArmed && d < .14 && closing > 1.2) { clapArmed = false; registerClap(); }
  if (d > .25) clapArmed = true;
}
function registerClap() {
  const now = performance.now(); state.claps = state.claps.filter(t => now - t < 2500); state.claps.push(now);
  if (ac) tone('square', 1800, 600, .05, .15);
  if (state.claps.length >= 3) { state.claps.length = 0; clapParty(); }
}

/* ======================= effects: confetti, hearts ======================= */
const fx = [];
function confetti(pos, n = 80, colors = [0xff4fa8, 0xffd25a, 0x3fe0bd, 0x8b6bff, 0xff8a3d]) {
  const g = new THREE.BoxGeometry(.06, .06, .01);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(g, mat(colors[i % colors.length], { emissive: colors[i % colors.length], emissiveIntensity: .4, side: THREE.DoubleSide }));
    m.position.copy(pos); scene.add(m);
    fx.push({ m, v: V((rnd() - .5) * 5, 2 + rnd() * 4, (rnd() - .5) * 5), spin: V(rnd() * 10, rnd() * 10, rnd() * 10), life: 2.2 + rnd(), drag: 1.8 });
  }
}
function hearts(pos) {
  const sh = new THREE.Shape(); sh.moveTo(0, -.06); sh.bezierCurveTo(.12, .04, .05, .12, 0, .06); sh.bezierCurveTo(-.05, .12, -.12, .04, 0, -.06);
  const g = new THREE.ShapeGeometry(sh);
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff5f8f, side: THREE.DoubleSide, transparent: true })); m.position.copy(pos); scene.add(m);
    fx.push({ m, v: V((rnd() - .5) * .8, 1 + rnd() * .6, (rnd() - .5) * .8), spin: V(0, 2, 0), life: 1.4, drag: 0, fade: true, nograv: true }); }
}
function stepFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i]; p.life -= dt;
    if (!p.nograv) p.v.y -= 4 * dt; p.v.multiplyScalar(Math.exp(-p.drag * dt));
    p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt; p.m.rotation.z += p.spin.z * dt;
    if (p.fade) p.m.material.opacity = clamp(p.life, 0, 1);
    if (p.life <= 0) { scene.remove(p.m); if (p.fade) p.m.material.dispose(); fx.splice(i, 1); }
  }
}
function clapParty() { headWorld(_h); confetti(_h.clone().add(V(0, .6, 0)), 120); sfxWin(); toast('👏 Secret found: CLAP PARTY!'); state.secrets.add('clap'); }

/* ======================= VR toast panel (floats in front of you) ======================= */
const vrToast = textPanel(1024, 160, () => {});
const vrToastMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .19), new THREE.MeshBasicMaterial({ map: vrToast.t, transparent: true, depthTest: false }));
vrToastMesh.renderOrder = 10; vrToastMesh.visible = false; camera.add(vrToastMesh); vrToastMesh.position.set(0, -.25, -1.3);
let vrToastT = 0;
function showVrToast(msg, secs) {
  if (!state.xr) return; const g = vrToast.g; g.clearRect(0, 0, 1024, 160);
  g.fillStyle = 'rgba(16,52,38,.88)'; g.beginPath(); g.roundRect(8, 8, 1008, 144, 40); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '56px Fredoka, sans-serif'; g.fillText(msg, 512, 100); vrToast.t.needsUpdate = true;
  vrToastMesh.visible = true; vrToastT = secs;
}
state.secrets = new Set();

/* ======================= per-frame world animation ======================= */
function collectCheck() {
  headWorld(_h);
  berries.forEach((b, i) => {
    if (b.taken) return;
    const near = _h.distanceTo(b.g.position) < .6 || hands.some(h => h.tracked && h.pos.distanceTo(b.g.position) < .35);
    if (!near) return;
    b.taken = true; state.got++; sfxBerry(state.got); confetti(b.g.position, 24, [0xc23cff, 0xff4fa8, 0xffffff]); b.pop = .25;
    if (!state.running && !state.done) state.running = true;
    updateHud();
    if (state.got === BERRIES_TOTAL) { win(); bmUnlock(); } else toast(`🫐 ${state.got} / ${BERRIES_TOTAL}${state.got === BERRIES_TOTAL - 1 ? ' · one more!' : ''}`, 1.6);
  });
  if (acorn.visible && (_h.distanceTo(acorn.position) < .7 || hands.some(h => h.tracked && h.pos.distanceTo(acorn.position) < .4))) {
    acorn.visible = false; state.golden = true; state.secrets.add('acorn');
    [...hands.map(h => h.paw.userData.fur), AV.armFur].forEach(m => { if (!m) return; m.color.set(0xffc83a); m.emissive.set(0x553300); m.metalness = .5; });
    confetti(acorn.position, 100, [0xffc83a, 0xffffff, 0xff9a00]); sfxWin(); toast('✨ Secret found: GOLDEN PAWS!', 4);
  }
}
function win() {
  state.done = true; state.running = false; sfxWin(); headWorld(_h); confetti(_h.clone().add(V(0, 1, 0)), 160);
  const best = parseFloat(store.get('kg-best') || '0');
  const isBest = !best || state.time < best; if (isBest) store.set('kg-best', state.time.toFixed(1));
  toast(`🏆 GROVE CHAMPION! ${fmtTime(state.time)}${isBest ? ' · new best!' : ''}`, 6); showBest();
}
function showBest() { const b = store.get('kg-best'); $('best').textContent = b ? `🏆 Best berry run: ${fmtTime(parseFloat(b))}` : ''; }
function animateWorld(dt, t) {
  berries.forEach(b => {
    if (b.taken) { if (b.pop > 0) { b.pop -= dt; b.g.scale.setScalar(Math.max(.01, b.pop * 6)); if (b.pop <= 0) b.g.visible = false; } return; }
    b.g.position.y = b.base + Math.sin(t * 2 + b.ph) * .08; b.g.rotation.y = t * 1.5 + b.ph;
  });
  acorn.rotation.y = t * 2; acorn.position.y = tallCliff.h + .7 + Math.sin(t * 3) * .1;
  mushrooms.forEach(m => { if (m.squish > 0) m.squish = Math.max(0, m.squish - dt * 3); const s = m.squish; m.capG.scale.set(1 + s * .25, 1 - s * .4 + Math.sin(s * 12) * s * .2, 1 + s * .25); });
  // Pip looks at you, blinks, waves, and hops when you boop it
  headWorld(_h);
  const dx = _h.x - pip.g.position.x, dz = _h.z - pip.g.position.z;
  const want = Math.atan2(dx, dz); let dy = want - pip.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); pip.g.rotation.y += dy * Math.min(1, dt * 3);
  const blink = (t % 3.3) < .12 ? .1 : 1; pip.eyes.forEach(e => e.scale.y = blink);
  const close = Math.hypot(dx, dz) < 4;
  pip.arms[1].rotation.z = close ? 2.3 + Math.sin(t * 9) * .5 : .2 + Math.sin(t * 2) * .05; pip.arms[0].rotation.z = -.2;
  pip.hop = Math.max(0, pip.hop - dt * 2.2);
  pip.body.position.y = Math.abs(Math.sin(pip.hop * Math.PI * 2)) * .45 * pip.hop + Math.sin(t * 2.5) * .01;
  pip.body.scale.set(1 + Math.sin(t * 2.5) * .02, 1 - Math.sin(t * 2.5) * .02, 1);
  const pc = _p.copy(pip.g.position).add(V(0, .3, 0));
  if (pip.hop <= 0 && !pip.heldBy && hands.some(h => h.tracked && h.pos.distanceTo(pc) < .36)) { pip.hop = 1; sfxSqueak(); hearts(pc.clone().add(V(0, .4, 0))); }
  if (scene.userData.pond) scene.userData.pond.material.color.setHSL(.56, .7, .55 + Math.sin(t) * .03);
}

/* ======================= input ======================= */
addEventListener('keydown', e => {
  state.keys[e.code] = true;
  if (e.code === 'KeyR' && state.mode === 'play') respawn();
  if (e.code === 'KeyE' && state.mode === 'play' && !state.xr) deskInteract();
  if (e.code === 'KeyV' && state.mode === 'play' && !state.xr) { state.third = !state.third; camera.layers[state.third ? 'enable' : 'disable'](SELF_LAYER); camera.layers[state.third ? 'disable' : 'enable'](FP_LAYER); }
  if (e.code === 'Escape' && state.mode === 'play' && !state.xr) openMenu();
  if (e.key && e.key.length === 1) { state.typed = (state.typed + e.key.toLowerCase()).slice(-4); if (state.typed === 'bonk' && state.mode === 'play') clapParty(); }
  if (state.mode === 'play' && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { state.keys[e.code] = false; });
addEventListener('blur', () => { state.keys = {}; });
const canvas = renderer.domElement;
let dragging = false, lastX = 0, lastY = 0;
document.addEventListener('mousemove', e => {
  if (state.mode !== 'play' || state.xr) return;
  let dx = 0, dy = 0;
  if (document.pointerLockElement === canvas) { dx = clamp(e.movementX, -200, 200); dy = clamp(e.movementY, -200, 200); }
  else if (dragging) { dx = e.clientX - lastX; dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; }
  state.yaw -= dx * .0025; state.pitch = clamp(state.pitch - dy * .0022, -1.45, 1.45);
});
canvas.addEventListener('pointerdown', e => {
  if (state.mode !== 'play' || state.xr) return;
  audioOn();
  if (state.touch) return;   // phones look around with the touch controls instead
  if (document.pointerLockElement !== canvas && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {} }
  dragging = true; lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointerup', () => { dragging = false; });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state.mode === 'play' && !state.xr && !dragging && !CS.on && !state.freeMouse && !BM.open) openMenu(); });   // U / Berry Menu free the mouse without pausing

function openMenu() { if (state.mode === 'play') state.savedPos = rig.position.clone(); state.mode = 'menu'; if ($('touch')) $('touch').hidden = true; state.joy.x = state.joy.y = 0; state.keys = {}; $('menu').hidden = false; $('hud').hidden = true; $('cross').hidden = true; hands.forEach(h => h.paw.visible = false); }
function startDesktop() {
  audioOn(); state.mode = 'play'; $('menu').hidden = true; $('hud').hidden = false; $('cross').hidden = false;
  camera.position.set(0, state.bodyH, 0);
  if (state.done || (!state.running && state.got === 0)) { resetRun(); respawn(); }
  else if (state.savedPos) rig.position.copy(state.savedPos);   // the menu's fly-over moved the camera rig; put you back
  csMaybe();
  if (state.touch) { $('touch').hidden = false; $('cross').hidden = false; toast('🕹️ Left stick runs, drag to look, tap the buttons to jump, grab and swing!', 5); return; }
  try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  toast('🐾 WASD to run, Space to jump, E to grab, V to see yourself!', 4);
}
$('btnDesk').onclick = startDesktop;
function setSize(i) { state.size = (i + SIZES.length) % SIZES.length; state.bodyH = SIZES[state.size].h; $('btnSize').textContent = SIZES[state.size].name; store.set('kg-size2', state.size); if (!state.xr && state.mode === 'play') camera.position.y = state.bodyH; }
$('btnSize').onclick = () => setSize(state.size + 1);
setSize(store.get('kg-size2') !== null ? parseInt(store.get('kg-size2')) || 0 : 1);
showBest();

/* ---------- XR controllers ---------- */
for (let i = 0; i < 2; i++) {
  const grip = renderer.xr.getControllerGrip(i); rig.add(grip);
  const ctl = renderer.xr.getController(i); rig.add(ctl);
  const xh = renderer.xr.getHand(i); rig.add(xh);
  const h = hands[i]; h.grip = grip; h.xhand = xh; h.ctl = ctl;
  ctl.addEventListener('squeezestart', () => { audioOn(); grabAny(h); }); ctl.addEventListener('squeezeend', () => dropAny(h));
  ctl.addEventListener('selectstart', () => { BM.trig[h.i] = true; if (h.src && h.src.hand) grabAny(h); }); ctl.addEventListener('selectend', () => { BM.trig[h.i] = false; if (h.src && h.src.hand) dropAny(h); });
  ctl.addEventListener('connected', e => { h.src = e.data; h.side = e.data.handedness === 'left' ? 'left' : 'right'; setSide(h); if (h.side === 'left') hands[i].paw.add(wrist.mesh); });
  ctl.addEventListener('disconnected', () => { h.src = null; h.stuck = false; h.paw.visible = false; });
}
const btnPrev = {};
function pollGamepads() {
  const s = renderer.xr.getSession(); if (!s) return;
  for (const src of s.inputSources) {
    const gp = src.gamepad; if (!gp) continue; const key = src.handedness;
    const ax = gp.axes.length >= 4 ? gp.axes[2] : (gp.axes[0] || 0);
    const pressedB = gp.buttons[5] && gp.buttons[5].pressed, pressedA = gp.buttons[4] && gp.buttons[4].pressed, prev = btnPrev[key] || {};
    if (pressedA && !prev.a) { if (key === 'left' && BM.unlocked) bmToggle(); else calibrate(); }
    if (key === 'left') { BM.stick[0] = gp.axes.length >= 4 ? gp.axes[2] : 0; BM.stick[1] = gp.axes.length >= 4 ? gp.axes[3] : 0; }
    prev.a = pressedA;
    if (key === 'right') {
      if (Math.abs(ax) > .7 && !prev.turned) { snapTurn(ax > 0 ? -Math.PI / 4 : Math.PI / 4); prev.turned = true; }
      if (Math.abs(ax) < .3) prev.turned = false;
    }
    if (pressedB && !prev.b) { respawn(); toast('🌀 Back to the stump!', 1.5); }
    prev.b = pressedB; btnPrev[key] = prev;
  }
}
// Stand up straight with your arms hanging and press A or X: the ground moves to just under your relaxed paws.
function calibrate() {
  const ys = hands.filter(h => h.tracked).map(h => h.local.y);
  if (!ys.length) return;
  const drop = camera.position.y - Math.min(...ys);              // eyes to relaxed paws
  if (drop < .4 || ys.some(y => y > camera.position.y - .25)) { toast('🙅 Arms DOWN by your sides, then press A!', 3); return; }   // arms up would squash your head into your body
  state.bodyH = clamp(drop - .06, .35, 1.1) * BM.sc;
  respawn(); toast(`📏 Got it! Your paws now reach the ground (${Math.round(state.bodyH * 100)} cm below your eyes)`, 3.5);
}
function snapTurn(a) {
  rig.updateMatrixWorld(); const before = headWorld(V());
  rig.rotation.y += a; rig.updateMatrixWorld(); const after = headWorld(V());
  rig.position.add(before.sub(after)); hands.forEach(h => { h.stuck = false; h.ready = false; });
}

async function setupVR() {
  const btn = $('btnVR'), note = $('vrNote');
  let ok = false;
  try { ok = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) { ok = false; }
  if (!ok) {
    btn.textContent = 'VR not available here';
    note.textContent = window.isSecureContext && navigator.xr ? 'No headset found. Open this page in your headset browser (Quest Browser works) to play in VR.' : 'VR needs a headset browser on an https page. Desktop mode works right now!';
    return;
  }
  btn.disabled = false; btn.textContent = '🥽 Enter VR';
  btn.onclick = async () => {
    audioOn();
    if (!VC.mic && !(VC.asked && VC.denied)) { VC.asked = false; VC.denied = false; micOn(); }   // ask for the mic NOW, before VR: the headset can't always ask inside VR
    try {
      const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      renderer.xr.setFoveation(1);
      await renderer.xr.setSession(s);
      state.xr = true; state.mode = 'play'; $('menu').hidden = true;
      rig.rotation.y = 0; camera.rotation.set(0, 0, 0);
      resetRun(); respawn(); csMaybe();
      setTimeout(() => toast('🐾 Arms down + press A to fit the ground to you!', 4.5), 600);
      s.addEventListener('visibilitychange', () => audioOn());
      s.addEventListener('end', () => {
        if (VC.retry && !VC.mic) { VC.retry = false; micOn(); }
        state.xr = false; hands.forEach(h => { h.paw.visible = false; h.stuck = false; }); vrToastMesh.visible = false;
        camera.position.set(0, state.bodyH, 0); camera.quaternion.identity(); openMenu(); respawn();
      });
    } catch (e) { note.textContent = 'The headset refused to start VR: ' + e.message; }
  };
}
setupVR();

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

/* ======================= main loop ======================= */
const clock = new THREE.Clock();
let tAll = 0, lastWristSec = -1;
function update(dt) {
  tAll += dt;
  if (horrorFrozen(dt)) return;   // the fake crash: the world stops dead
  if (state.mode === 'play') {
    swimCheck(dt);
    if (state.xr || sim.on) { pollGamepads(); if (!CS.on && !rcRiding()) stepArms(dt); } else if (!CS.on && !rcRiding()) stepDesktop(dt);
    if (state.area === 'wilds' ? rig.position.y < -40 : state.area === 'beach' ? rig.position.y < -20 : state.area === 'arena' ? rig.position.y < -14 : (rig.position.y < -12 || Math.hypot(rig.position.x, rig.position.z) > 45)) respawn();
    stepProps(dt);
    stepArena(dt);
    poseAvatar(dt);
    collectCheck();
    if (state.running) { state.time += dt; $('hudT').textContent = fmtTime(state.time); const s = Math.floor(state.time); if (state.xr && s !== lastWristSec) { lastWristSec = s; drawWrist(); } }
  } else if (!state.xr) { // menu: slow orbit of the grove
    AV.root.visible = false; AV.fpRoot.visible = false; if (AV.head) AV.head.visible = false; AV.arms.forEach(a => a.up.visible = a.fore.visible = a.elbow.visible = false);
    rig.position.set(Math.sin(tAll * .05) * 14, 3, Math.cos(tAll * .05) * 14); rig.rotation.y = tAll * .05; camera.rotation.set(-.12, 0, 0);
  }
  animateWorld(dt, tAll); animPortals(dt, tAll); stepFx(dt);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  if (vrToastT > 0) { vrToastT -= dt; if (vrToastT <= 0) vrToastMesh.visible = false; }
  const focus = CS.on && !state.xr ? CS.cam.position : rig.position;   // the story camera can fly far from you
  sun.position.set(focus.x + 12, focus.y + 24, focus.z + 8); sun.target.position.copy(focus);
  scene.userData.sky.position.copy(focus);
  stepHorror(dt); stepExtras(dt); mpSend(dt); stepFriends(dt); stepComputer(dt); stepShared(dt); stepFigRemote(dt); stepTouchUi(); stepMyColors(); stepVoice(dt); stepBerryMenu(dt); pcStep(dt); stepWater(dt); stepRoyale(dt); stepStory(dt); stepWilds(dt); stepBeach(dt); stepParty(dt); stepRagdolls(dt); stepClaude(dt); stepSpawn(dt); stepClaudeEars(dt); stepClaudeEarsRec(dt); stepVad(dt); stepSwim(dt);

}
window.__kg.calibrate = () => calibrate();
window.__kg.step = (dt, n = 1) => { for (let i = 0; i < n; i++) update(dt); };
window.__kg.start = () => { state.mode = 'play'; $('menu').hidden = true; resetRun(); respawn(); };
window.__kg.renderOnce = () => renderer.render(scene, camera); window.__kg.scene = scene; window.__kg.renderer = renderer;
window.__kg.respawn = respawn; window.__kg.props = props; window.__kg.grab = grabProp; window.__kg.drop = dropProp; window.__kg.pawHit = pawHit; window.__kg.tris = tris;
updateHud();
renderer.setAnimationLoop(() => { if (window.__kg.paused) return; update(Math.min(.05, clock.getDelta())); selfie.update(); csRender(); });

