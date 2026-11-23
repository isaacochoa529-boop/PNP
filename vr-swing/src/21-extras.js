/* ======================================================================
   PLAYTEST EXTRAS: a sizzle while you carve slowly, bites, toys that go through the portal
   (and turn sliceable, the ball stays rubbery), and Pip: hold it, hear it talk, watch it get scared.
   ====================================================================== */
const TOY_KIND = { ball: 7, cone: 8, star: 9 }, TOY_TPL = {};
function soupOf(geo, S) { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal, out = new Float32Array(p.count * S);
  for (let i = 0; i < p.count; i++) out.set(S === 3 ? [p.getX(i), p.getY(i), p.getZ(i)] : [p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), p.getX(i), p.getY(i), p.getZ(i), 0, -1e4], i * S); return out; }
function toyTpl(kind) {
  if (TOY_TPL[kind]) return TOY_TPL[kind];
  const k = TOY_KIND[kind]; let vis, phys, vol;
  if (kind === 'ball') { vis = new THREE.SphereGeometry(.14, 20, 14); phys = new THREE.IcosahedronGeometry(.14, 1); vol = 4 / 3 * Math.PI * .14 ** 3; }
  else if (kind === 'cone') { vis = new THREE.ConeGeometry(.085, .2, 10); vis.rotateX(Math.PI); phys = vis.clone(); vol = Math.PI * .085 ** 2 * .2 / 3; }
  else { vis = new THREE.OctahedronGeometry(.11, 0); phys = vis.clone(); vol = .11 ** 3 * 4 / 3; }
  return (TOY_TPL[kind] = { k, vis: soupOf(vis, VS), phys: soupOf(phys, 3), vol });
}
// a toy that goes into the yard leaves the grove and comes out of the yard's portal as a piece you can slice
function toyToYard(p, carried) {
  if (!AR.ready || p.spawned) return false;   // Claude-made toys stay where they are
  const t = toyTpl(p.kind), sp = Math.min(9, p.vel.length());
  const pos = V().copy(AR_PORTAL).add(V(0, 1, -.7)), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
  if (carried) { headWorld(_a1); pos.set(AR_SPAWN.x + .25, 1.2, AR_SPAWN.z - .7); }
  const lv = carried ? V(0, .5, 0) : V(0, 1 + sp * .15, -Math.max(1.5, sp * .8));
  const av = V(rnd() * 4 - 2, rnd() * 4 - 2, rnd() * 4 - 2), pc = makePiece(t.k, [{ vis: Float32Array.from(t.vis), phys: Float32Array.from(t.phys) }], t.vol, pos, q, lv, av, true);
  if (!pc) return false;
  sendSpawn(pc, p.kind, lv, av, true);
  // the grove gets its toy back a moment later
  p.g.position.copy(p.home); p.vel.set(0, 0, 0); p.w.set(0, 0, 0); p.rest = false; p.g.scale.setScalar(.01); p.regrow = 1;
  confetti(V().copy(pos).add(ARENA), 20, [0x3fe0bd, 0x8b6bff, 0xffffff]);
  if (!carried) { sfxWhoosh(); if (state.area === 'grove') toast(`✨ Your ${p.kind === 'cone' ? 'pinecone' : p.kind} zoomed to the Slicing Yard!`, 3); }
  else toast(`🎒 Your ${p.kind === 'cone' ? 'pinecone' : p.kind} came with you. Slice it!`, 3.5);
  return true;
}
function stepToyPortal(dt) {
  if (!AR.ready) return;
  for (const p of props) {
    if (p.regrow > 0) { p.regrow = Math.max(0, p.regrow - dt * 1.5); p.g.scale.setScalar(1 - p.regrow); }
    if (p.held || p.kind === 'bear' || p.vel.lengthSq() < .25 || !mine(p)) continue;
    portalGrove.g.worldToLocal(_a2.copy(p.g.position));
    if (Math.abs(_a2.z) < .3 && Math.hypot(_a2.x, _a2.y - 1) < .8) toyToYard(p, false);
  }
}

/* ---------- a sizzle while a slow cut is going through ---------- */
let SZ = null;
function stepSizzleLoop(dt) {
  const on = AR.inCut > 0; AR.inCut = Math.max(0, (AR.inCut || 0) - dt * 8);
  if (!ac) return;
  if (!SZ) {
    if (!on) return;
    const n = noiseLoop(), hp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), g = ac.createGain();
    hp.type = 'highpass'; hp.frequency.value = 2600; bp.type = 'peaking'; bp.frequency.value = 5200; bp.gain.value = 8; g.gain.value = 0;
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(master); n.start(); SZ = { n, g, pop: 0 };
  }
  const t = ac.currentTime;
  // a steady hiss with little crackles in it, like something hot on a pan
  const target = on ? .07 + (rnd() < .25 ? rnd() * .12 : 0) : 0;
  SZ.g.gain.setTargetAtTime(target, t, on ? .015 : .08);
  if (on && (SZ.pop -= dt) < 0) { SZ.pop = .04 + rnd() * .1; sfxPlip(); if (sword.held && rnd() < .5) buzz(sword.held, .12, 12); }
}

/* ---------- bites ---------- */
let biteCool = 0;
function sfxChomp(big) { if (!ac) return; const t = ac.currentTime; for (let i = 0; i < (big ? 3 : 2); i++) { const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(), k = t + i * .14; f.type = 'lowpass'; f.frequency.value = 1400 + rnd() * 900; g.gain.setValueAtTime(.0001, k); g.gain.exponentialRampToValueAtTime(.45, k + .012); g.gain.exponentialRampToValueAtTime(.001, k + .1); n.connect(f); f.connect(g); g.connect(master); n.start(k); n.stop(k + .12); tone('sine', 220, 120, .08, .2, i * .14); }
  if (big) tone('triangle', 520, 780, .18, .12, .4); }
const BITE_R = .05, ONE_BITE = 3.4e-4;   // bite radius, and anything smaller than ~7 cm across goes down in one
function mouthWorld(out) { headWorld(out); camera.getWorldQuaternion(_aq); return out.add(_a1.set(0, -.07, -.03).applyQuaternion(_aq)); }
function eatWhole(pc) {
  const t = pc.body.translation(), w = V(t.x, t.y, t.z).add(ARENA); sendKill([pc], true); removePiece(pc); crumbs(w, pc.kind, 10); sfxChomp(true);
  if (!AR.toldEat) { AR.toldEat = true; toast('😋 Gulp! Down in one bite.', 2.5); }
}
function takeBite(pc) {
  if (!pc || !pc.body || pc.dying) return;
  biteCool = .55;
  if (pc.vol < ONE_BITE) return eatWhole(pc);
  // a round bite: a chain of cuts in a bowl shape, then the bit on the mouth side gets eaten
  mouthWorld(_a4).sub(ARENA); const t = pc.body.translation(); _a5.set(t.x, t.y, t.z);
  const f = V().subVectors(_a5, _a4).normalize();                      // from the mouth into the piece
  camera.getWorldQuaternion(_aq); const up = V(0, 1, 0).applyQuaternion(_aq), side = V().crossVectors(f, up).normalize();
  if (side.lengthSq() < .5) side.set(1, 0, 0);
  const fl = toLocal(pc, _a1.copy(_a5).add(f), V()).sub(toLocal(pc, _a5, V())).normalize(), sl = toLocal(pc, _a1.copy(_a5).add(side), V()).sub(toLocal(pc, _a5, V())).normalize();
  const ax = V().crossVectors(fl, sl).normalize(), ml = toLocal(pc, _a4, V());
  let front = 1e9; const h = pc.hull; for (let i = 0; i < h.length; i += 3) front = Math.min(front, h[i] * fl.x + h[i + 1] * fl.y + h[i + 2] * fl.z);   // the near surface, along f
  const base = V().copy(ml).addScaledVector(fl, front - ml.dot(fl));
  const pts = [];
  for (let i = 0; i <= 6; i++) { const u = (i / 6 * 2 - 1) * 1.7, dep = BITE_R * (1 - u * u) * .95; pts.push(V().copy(base).addScaledVector(sl, u * BITE_R).addScaledVector(fl, dep)); }
  const lines = [], bis = [], dirs = [];
  for (let j = 0; j + 1 < pts.length; j++) { const d = V().subVectors(pts[j + 1], pts[j]).normalize(); dirs.push(d); const n = V().crossVectors(ax, d).normalize(); lines.push([n, n.dot(pts[j])]); }
  for (let j = 1; j + 1 < pts.length; j++) { const tt = V().addVectors(dirs[j - 1], dirs[j]).normalize(); bis.push([tt, tt.dot(pts[j])]); }
  const before = new Set(AR.pieces), kind = pc.kind, holder = pc.held;
  if (!cutPiece2(pc, { pc, lines, bis, nMain: lines[3][0], e: base, sp: 0, extreme: false, bite: true })) { if (pc.vol < ONE_BITE * 3) eatWhole(pc); return; }
  const kids = AR.pieces.filter(c => !before.has(c)).sort((a, b) => a.vol - b.vol), bite = kids.length > 1 ? kids[0] : null, rest = kids[kids.length - 1];
  if (bite) { const u = bite.body.translation(); crumbs(V(u.x, u.y, u.z).add(ARENA), kind, 6); sendKill([bite], true); removePiece(bite); }
  if (holder && !holder.piece && rest && rest.body && !rest.held) holdPiece(holder, rest);   // you keep holding what's left
  sfxChomp(false);
  if (!AR.toldBite) { AR.toldBite = true; toast('😋 Nom! Little pieces go down in one bite.', 3); }
}
function stepBites(dt) {
  biteCool = Math.max(0, biteCool - dt);
  if (state.area !== 'arena' || !AR.ready || biteCool > 0) return;
  mouthWorld(_a4).sub(ARENA);
  for (const h of hands) {   // bring a piece you're holding up to your mouth
    const pc = h.piece; if (!pc || !pc.body) continue;
    const t = pc.body.translation();
    if (KINDS[pc.kind].glass) { if ((t.x - _a4.x) ** 2 + (t.y - _a4.y) ** 2 + (t.z - _a4.z) ** 2 < (pc.rad + .08) ** 2 && !(tAll - (GL.noEat || -9) < 4)) { GL.noEat = tAll; toast('🙅 No eating glass, silly! Throw it instead.', 3); } continue; }
    if ((t.x - _a4.x) ** 2 + (t.y - _a4.y) ** 2 + (t.z - _a4.z) ** 2 > (pc.rad + .1) ** 2) continue;
    toLocal(pc, _a4, _a5); if (outside(pc.parts, _a5) < .025) { takeBite(pc); return; }
  }
}
addEventListener('keydown', e => {   // desktop: F bites what you're holding
  if (e.code !== 'KeyF' || state.mode !== 'play' || state.xr || state.area !== 'arena' || biteCool > 0) return;
  const h = hands.find(x => x.piece); if (h && KINDS[h.piece.kind].glass) { toast('🙅 No eating glass, silly! Throw it instead.', 3); return; } if (h) takeBite(h.piece);
});

/* ---------- Pip: pick it up, it talks, it gets scared ---------- */
pip.home = pip.g.position.clone(); pip.vel = V(); pip.heldBy = null; pip.talkT = 6; pip.scare = 0; pip.resting = true; pip.info = { nrm: V(), ground: false, bounce: null, col: null };
const bubble = textPanel(512, 160, () => {});
const bubbleS = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubble.t, depthTest: false, transparent: true })); bubbleS.scale.set(.75, .234, 1); bubbleS.renderOrder = 9; bubbleS.visible = false; scene.add(bubbleS);
let bubbleT = 0;
const PIP_SAY = {
  idle: ['Hi friend! 👋', 'Boop me!', 'Found all the berries yet?', 'I like your paws!', 'Pick me up! Pleeease', 'The yard has cubes! 🧊', 'Wheee, nice jump!'],
  held: ['Wheee! 🎈', 'Higher! Higher!', 'This is the best!', "Don't drop me! 😆", 'I can see my stump from here!'],
  dark: ["I-it's so dark... 😨", 'Did you hear that?!', 'I want the sun back 😢', "Don't leave me!", 'Something is watching...', 'Hold my paw?'],
  sword: ['EEK! The pointy thing!', 'Put that AWAY! 😱', 'Not the sword!!', 'Keep it away from me!'],
  thrown: ['WAAAAH!', 'Again! Again!', 'Ooof!'],
};
function pipSay(kind, forced) {
  const L = PIP_SAY[kind] || PIP_SAY.idle, msg = forced ? String(forced).slice(0, 60) : L[Math.floor(rnd() * L.length)], g = bubble.g;
  if (!forced && online() && mine(pip)) netSend({ t: 'say', kind, m: msg }); g.clearRect(0, 0, 512, 160);
  g.fillStyle = kind === 'dark' || kind === 'sword' ? '#2a1f3a' : '#ffffff'; g.beginPath(); g.roundRect(8, 8, 496, 118, 36); g.fill();
  g.beginPath(); g.moveTo(230, 124); g.lineTo(256, 154); g.lineTo(282, 124); g.fill();
  g.fillStyle = kind === 'dark' || kind === 'sword' ? '#ffd6f0' : '#5a2d0c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 44; do { g.font = `600 ${fs}px Fredoka, sans-serif`; fs -= 2; } while (g.measureText(msg).width > 470 && fs > 20); g.fillText(msg, 256, 68);
  bubble.t.needsUpdate = true; bubbleS.visible = true; bubbleT = Math.max(2.2, msg.split(' ').length / 2.3 + 1.2);
  if (ac) for (let i = 0; i < 3; i++) tone('sine', (kind === 'dark' || kind === 'sword' ? 700 : 900) + rnd() * 500, 600 + rnd() * 600, .07, .07, i * .09);   // chirpy critter talk
}
function pipCenter(out) { return out.copy(pip.g.position).add(_a3.set(0, .3, 0)); }
function pipGrab(h) {
  if (pip.heldBy || !h.tracked || pipCenter(_a1).distanceTo(h.pos) > .42) return false;
  claim(pip, 'pip', 0); pip.heldBy = h; pip.vel.set(0, 0, 0); buzz(h, .5, 40); sfxSqueak(); pipSay('held'); return true;
}
function pipDrop(h) { if (pip.heldBy !== h) return; pip.heldBy = null; pip.vel.copy(h.vel || V()).multiplyScalar(1.1); if (pip.vel.length() > 10) pip.vel.setLength(10); pip.flying = pip.vel.length() > 2.5; }
function pipDeskGrab() {
  const h = hands[1];
  if (pip.heldBy) { const f = V(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_aq)); pip.heldBy = null; pip.vel.copy(f).multiplyScalar(4).add(V(0, 2, 0)); pip.flying = true; return true; }
  if (h.holding || h.piece || h.sword) return false;
  const hit = aimAt(2.6, f => f(pip, pipCenter(V()), .32)); if (!hit) return false;
  claim(pip, 'pip', 0); pip.heldBy = h; sfxSqueak(); pipSay('held'); return true;
}
const _pw = V();
function stepPip(dt) {
  const g = pip.g.position, inYard = g.x > 200, floorY = inYard ? ARENA.y : -1e9;
  const pipMine = mine(pip);
  if (!pipMine) { /* someone else has Pip: it glides along (see stepShared) */ }
  else if (pip.heldBy) {
    const h = pip.heldBy;
    if ((state.xr || sim.on) && h.tracked) g.copy(h.pos).add(_a1.set(0, -.3, 0));
    else { h.paw.updateMatrixWorld(); h.paw.localToWorld(g.set(0, -.25, -.45)); }
    pip.body.rotation.z = Math.sin(tAll * 9) * .15;
  } else {
    // falls, bounces off whatever it hits, and settles wherever it lands
    pip.body.rotation.z *= Math.exp(-dt * 6);
    if (!pip.resting) {
      pip.vel.y -= 9.8 * dt; g.addScaledVector(pip.vel, dt);
      pipCenter(_pw); const before = _a1.copy(_pw); pip.info.nrm.set(0, 0, 0); pip.info.ground = false;
      if (!inYard && pushOut(_pw, .3, pip.info)) { g.add(_a2.subVectors(_pw, before)); const n = pip.info.nrm.normalize(), vn = pip.vel.dot(n); if (vn < 0) pip.vel.addScaledVector(n, -vn * (pip.flying ? 1.5 : 1)); }
      if (g.y < floorY) { g.y = floorY; if (pip.vel.y < 0) pip.vel.y *= -.4; pip.info.ground = true; }
      if (pip.info.ground) { pip.vel.x *= Math.exp(-dt * 8); pip.vel.z *= Math.exp(-dt * 8); if (pip.flying && pip.vel.length() < 2) { pip.flying = false; pipSay('thrown'); } if (pip.vel.lengthSq() < .01) { pip.resting = true; pip.vel.set(0, 0, 0); } }
    }
    if (g.y < -10 || (!inYard && Math.hypot(g.x, g.z) > 45)) { g.copy(pip.home); pip.vel.set(0, 0, 0); pip.resting = true; }
    if (inYard && state.area === 'grove' && (pip.away = (pip.away || 0) + dt) > 12) { g.copy(pip.home); pip.resting = true; pip.away = 0; }
  }
  if (pipMine && (pip.heldBy || pip.vel.lengthSq() > .01)) pip.resting = false;
  // into the grove's portal? off to the yard (and back through the yard's portal)
  if (pipMine && !pip.heldBy && pip.vel.lengthSq() > .3) {
    const P = inYard ? portalYard : portalGrove; P.g.worldToLocal(_a2.copy(g).add(_a3.set(0, .3, 0)));
    if (Math.abs(_a2.z) < .3 && Math.hypot(_a2.x, _a2.y - 1) < .8) {
      if (inYard) g.copy(GROVE_PORTAL).add(V(-GROVE_PORTAL.x, 0, -GROVE_PORTAL.z).normalize().multiplyScalar(1.4));
      else g.copy(ARENA).add(AR_PORTAL).add(V(0, .4, -.9));
      pip.vel.set(0, 1.5, inYard ? 0 : -2); sfxWhoosh(); pipSay('thrown');
    }
  }
  // scared: in the dark, or with a sword near
  let swordNear = false;
  if (inYard && typeof sword !== 'undefined') { _a1.copy(sword.g.position).add(ARENA); swordNear = _a1.distanceTo(pipCenter(_a2)) < 1.7; }
  const dark = HZ.on;
  pip.scare = clamp(pip.scare + ((swordNear || dark) ? dt * 4 : -dt * 2), 0, 1);
  const sc = pip.scare;
  if (sc > .05) {
    pip.body.position.x = Math.sin(tAll * 60) * .012 * sc * (swordNear ? 2 : 1);   // shivering
    pip.eyes.forEach(e => { e.children[0].scale.setScalar(1 - .5 * sc); e.scale.setScalar(1 + .25 * sc); });   // eyes wide, pupils tiny
    pip.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (2.6 * sc) + (i ? .2 : -.2) * (1 - sc); a.rotation.x = -.8 * sc; });   // paws up over its face
  } else { pip.body.position.x = 0; pip.eyes.forEach(e => { e.children[0].scale.setScalar(1); e.scale.x = e.scale.z = 1; }); }
  if (pipMine && swordNear && !pip.heldBy && !pip.wasSword) { pipSay('sword'); pip.vel.set(0, 2.6, 0); _a1.subVectors(g, _a2.copy(sword.g.position).add(ARENA)); _a1.y = 0; if (_a1.lengthSq() > 1e-4) pip.vel.addScaledVector(_a1.normalize(), 2.2); pip.resting = false; }
  pip.wasSword = swordNear;
  // now and then it says something (only if you're near enough to hear)
  headWorld(_a1); const near = _a1.distanceTo(g) < 7;
  if ((pip.talkT -= dt) < 0 && pipMine) { pip.talkT = 11 + rnd() * 14; if (near && bubbleT <= 0) pipSay(swordNear ? 'sword' : dark ? 'dark' : pip.heldBy ? 'held' : 'idle'); }
  if (bubbleT > 0) { bubbleT -= dt; bubbleS.position.copy(g).add(_a2.set(0, 1.05, 0)); if (bubbleT <= 0) bubbleS.visible = false; }
}
function stepExtras(dt) {
  if (state.mode !== 'play') return;
  stepSizzleLoop(dt); stepToyPortal(dt); stepBites(dt); stepPip(dt); stepPull(dt);
}
/* ---------- tough pulls: the sword in the stone and the secret switch both fight back ---------- */
// squeeze grip on it, then PULL: it only gives a little at a time, rumbling and shaking, until it comes free
const PULL = { h: null, what: null, start: V(), dir: V(), k: 0, desk: false, grind: null };
HZ.pullK = 0;
const PULL_NEED = { sword: .3, switch: .26 };   // how far your paw must haul it (metres)
function pullStart(h, what, desk) {
  if (PULL.h) pullStop(false);
  PULL.h = h; PULL.what = what; PULL.k = 0; PULL.dt = 0; PULL.desk = !!desk; PULL.start.copy(h.pos);
  PULL.dir.set(0, what === 'sword' ? 1 : 0, what === 'sword' ? 0 : 1);   // the sword comes UP, the lever comes TOWARD you
  buzz(h, .6, 60); if (ac) { tone('sine', 90, 70, .25, .3); }
  if (what === 'sword' && !AR.toldPull) { AR.toldPull = true; toast(desk ? '💪 Heave...!' : '💪 It is stuck tight! Keep squeezing and PULL it up hard!', desk ? 1.5 : 4); }
  return true;
}
function pullStop(done) {
  const what = PULL.what, h = PULL.h; PULL.h = null; PULL.what = null;
  if (PULL.grind && ac) { const t = ac.currentTime; PULL.grind.g.gain.setTargetAtTime(0, t, .03); PULL.grind.n.stop(t + .2); PULL.grind = null; }
  if (what === 'sword' && sword.mode === 'stone') { sword.g.position.copy(STONE_POSE.p); sword.g.quaternion.copy(STONE_POSE.q); }
  if (done) {
    if (what === 'sword') { takeSword(h); sfxChoir(); confetti(V().copy(ARENA).add(STONE).add(V(0, 1, 0)), 60, [0xfff3b0, 0xffffff, 0xffd25a]); }
    else { HZ.flipCool = 1.5; setHorror(!HZ.on); }
  }
  PULL.k = 0; HZ.pullK = 0;
}
function toughGrab(h) {
  if (!h.tracked) return false;
  if (state.area === 'arena' && AR.ready && sword.mode === 'stone' && swordNear(h)) return pullStart(h, 'sword', false);
  if (state.area !== 'arena' && !HZ.crash && HZ.flipCool <= 0 && h.pos.distanceTo(SWITCH_AT) < .2) return pullStart(h, 'switch', false);
  return false;
}
function deskSwitch() {
  if (state.area === 'arena' || HZ.crash || HZ.flipCool > 0 || PULL.h) return false;
  headWorld(_a1); if (_a1.distanceTo(SWITCH_AT) > 2) return false;
  return !!aimAt(2, f => f(1, SWITCH_AT, .25)) && pullStart(hands[1], 'switch', true);
}
function stepPull(dt) {
  if (!PULL.h) return;
  const h = PULL.h;
  if (PULL.what === 'sword' && (state.area !== 'arena' || sword.mode !== 'stone')) return pullStop(false);
  let want;
  if (PULL.desk) want = (PULL.dt = (PULL.dt || 0) + dt) / 1.3;                                   // desktop: a long heave on its own
  else { if (!h.tracked) return pullStop(false); want = clamp(_a1.subVectors(h.pos, PULL.start).dot(PULL.dir) / PULL_NEED[PULL.what], 0, 1.2); }
  const prev = PULL.k; PULL.k += (Math.min(1.08, want) - PULL.k) * Math.min(1, dt * 2.6);   // it gives slowly, however hard you yank
  const k = PULL.k, moving = Math.abs(k - prev) / Math.max(dt, 1e-3);
  if (PULL.what === 'sword') {   // it creeps up out of the stone, shaking
    sword.g.position.copy(STONE_POSE.p).add(_a2.set((rnd() - .5) * .012 * (k + .2), k * .09, (rnd() - .5) * .012 * (k + .2)));
    if (rnd() < moving * .5) crumbs(V().copy(ARENA).add(STONE).add(V(0, .35, 0)), 2, 1);
  } else HZ.pullK = k;
  if ((PULL.tick = (PULL.tick || 0) - dt) < 0) { PULL.tick = .07; buzz(h, Math.min(1, .25 + .9 * moving + .4 * k), 60); }
  if (ac) {   // a deep stony grind while it moves
    if (!PULL.grind) { const n = noiseLoop(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 320; g.gain.value = 0; n.connect(f); f.connect(g); g.connect(master); n.start(); PULL.grind = { n, g }; }
    PULL.grind.g.gain.setTargetAtTime(Math.min(.5, moving * .6), ac.currentTime, .04);
  }
  if (k > .97) pullStop(true);
}
// the holy-grail moment: a choir swells up out of nowhere
function sfxChoir() {
  if (!ac) return; const t = ac.currentTime, out = ac.createGain(), dl = ac.createDelay(1), fb = ac.createGain();
  out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.5, t + .5); out.gain.setValueAtTime(.5, t + 2.2); out.gain.linearRampToValueAtTime(0, t + 3.6);
  dl.delayTime.value = .19; fb.gain.value = .45; out.connect(master); out.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(master);   // a little echo, like a big hall
  [[220, 0], [277.2, 0], [329.6, 0], [440, .25], [554.4, .25], [659.3, .5]].forEach(([f, d]) => {
    for (const det of [-4, 0, 5]) {   // each note is a few singers, slightly out of step, singing "aaah"
      const o = ac.createOscillator(), v = ac.createOscillator(), vg = ac.createGain(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), g = ac.createGain(), g2 = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; v.frequency.value = 5 + Math.random(); vg.gain.value = f * .006; v.connect(vg); vg.connect(o.frequency);
      f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 6; f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 8;
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.09, t + d + .6); g2.gain.value = .6;
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g2); g2.connect(g); g.connect(out); o.start(t + d); v.start(t + d); o.stop(t + 3.8); v.stop(t + 3.8);
    }
  });
  [1760, 2217, 2637].forEach((f, i) => tone('sine', f, f, 1.6, .03, .4 + i * .15));   // sparkle on top
}
function itsCake(pLocal) {
  const w = V().copy(pLocal).add(ARENA); confetti(w, 50, [0xffc4e1, 0xffffff, 0x6fd3ff, 0xffe066]);
  if (ac) [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.01, .25, .15, i * .09));
  toast('🎂 Wait... IT WAS CAKE THE WHOLE TIME?!', 4);
}
window.__kg.extras = { PULL, pullStart, sfxChoir, pip, pipGrab, pipDrop, pipSay, takeBite, toyToYard, toyTpl, stepSizzleLoop };
