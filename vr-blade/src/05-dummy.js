// ===== DUMMY: a training dummy that looks like YOU. Pull parts off, punch it, smash its head. =====
// Each rippable part: pivot at the joint. While held it swings toward your hand and STRETCHES;
// pull past the limit and it tears off (stump + bone on both sides, blood squirts).
const PDEF = {
  head: { rip: .2, stumpR: .046, boneR: .016, com: [0, .17, 0], mass: 5, k: .09, maxAng: 1.1,
    grab: [[0, .2, 0], [0, .07, 0]], bodyStump: [[0, .535, 0], [0, 1, 0]], partStump: [[0, 0, 0], [0, -1, 0]],
    samples: [[0, .33, 0], [0, .06, 0], [.11, .19, 0], [-.11, .19, 0], [0, .19, .12], [0, .19, -.12], [.07, .1, .07], [-.07, .1, .07], [.07, .28, -.07], [-.07, .28, -.07]] },
  arm: { rip: .24, stumpR: .045, boneR: .016, com: [0, -.3, .03], mass: 3.5, k: .2, maxAng: 3.1,
    grab: [[0, -.62, .1], [0, -.45, .07], [0, -.28, 0], [0, -.1, 0]], partStump: [[0, .005, 0], [0, 1, 0]],
    samples: [[0, .05, 0], [.045, -.12, 0], [-.045, -.12, 0], [0, -.28, .04], [0, -.28, -.04], [0, -.42, .08], [.03, -.62, .14], [-.03, -.62, .14]] },
  leg: { rip: .3, stumpR: .062, boneR: .022, com: [0, -.35, .02], mass: 8, k: .26, maxAng: 1.4,
    grab: [[0, -.86, .06], [0, -.6, 0], [0, -.4, 0], [0, -.15, 0]], partStump: [[0, .01, 0], [0, 1, 0]], bodyStump: [[0, -.16, 0], [0, -1, 0]],
    samples: [[0, .06, 0], [.07, -.2, 0], [-.07, -.2, 0], [.05, -.44, .05], [-.05, -.44, -.05], [0, -.88, .17], [0, -.88, -.04], [.04, -.88, .06], [-.04, -.88, .06]] },
};
const LINES = {
  punch: ['OOF!', 'Ow!', 'Not the face!', 'Is that all? 😤', 'Rude!', 'Ouch!!'],
  arm: ['MY ARM!!', 'I needed that!', 'Give it BACK!', 'That was my good arm!'],
  leg: ['MY LEG!', 'How do I walk now?!', 'Leg day is CANCELLED'],
  head: ['HEY! PUT ME BACK!', 'I can see my body from here!', 'Not cool, man!'],
  beg: ['NO NO NO!', 'LET GO!!', 'STOP PULLING!', "IT'S STUCK ON!", 'NOT THE ARM!!'],
  slam: ['OOF!', 'MY SPINE!', 'Ow ow ow...', 'WHY THE WALL?!', 'I felt that!', 'Put me DOWN!'],
  smash: ['OW OW OW', 'My TEETH!!', 'I see stars ⭐', 'Brain hurty'],
};
const pick = a => a[Math.random() * a.length | 0];
let DUM = null;
const tendonMat = new THREE.MeshStandardMaterial({ color: '#b3122a', roughness: .4, emissive: '#300' });

function buildDummy(opts = {}) {
  if (DUM) {
    scene.remove(DUM.root);
    for (let i = LOOSE.length - 1; i >= 0; i--) killLoose(LOOSE[i]);
  }
  const gold = opts.gold ?? Math.random() < 1 / 20;
  goldBlood = gold;
  const legs = !inVR();      // in VR the dummy floats like you (no legs). On PC it gets legs you can rip too.
  const h = makeHuman({ skin: SET.skin, shirt: SET.shirt, hair: SET.hair, legs, gold, partyHat: !!opts.partyHat });
  h.root.position.copy(DUMMY_POS);
  // wooden stand behind the dummy
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 1 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, 1.35, 10), wood); pole.position.set(0, .675, -.2); pole.castShadow = true; h.root.add(pole);
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .16, 8), wood); peg.rotation.x = Math.PI / 2; peg.position.set(0, 1.12, -.12); h.root.add(peg);
  [0, Math.PI / 2].forEach(a => { const f = new THREE.Mesh(new THREE.BoxGeometry(.7, .06, .09), wood); f.rotation.y = a; f.position.set(0, .03, -.2); f.castShadow = true; h.root.add(f); });
  scene.add(h.root);
  const parts = {};
  for (const [name, g] of Object.entries(h.parts)) {
    const type = name.startsWith('arm') ? 'arm' : name.startsWith('leg') ? 'leg' : 'head';
    const side = name.endsWith('L') ? -1 : 1;
    const def = PDEF[type];
    const P = { name, type, side, g, def, restPos: g.position.clone(), restQuat: g.quaternion.clone(), attached: true, held: null,
      grab: def.grab.map(a => new V3(...a)), sx: 0, sz: 0, vx: 0, vz: 0, body: null };
    if (type === 'arm') P.bodyStump = [[side * .19, .455, 0], [side, -.15, 0]];
    else if (type === 'leg') P.bodyStump = [[side * .088, -.16, 0], [0, -1, 0]];
    else P.bodyStump = def.bodyStump;
    parts[name] = P;
  }
  const tendon = new THREE.Mesh(new THREE.CylinderGeometry(.022, .03, 1, 8), tendonMat); tendon.visible = false; scene.add(tendon);
  DUM = { h, root: h.root, torso: h.torso, parts, face: h.face, gold, sway: { x: 0, z: 0, vx: 0, vz: 0 }, blink: 2, faceT: 0, said: 0, tendon, tendons: [], empty: false, free: false, body: null };
  h.root.updateMatrixWorld(true);
  if (gold) setTimeout(() => sayDummy('✨ I feel... SHINY ✨'), 400);
}

// --- ragdoll: the whole dummy pops off the post and becomes one physics body with floppy limbs ---
const BODY_COM = new V3(0, .25, 0);
const TORSO_GRAB = [[0, .32, .1], [0, .45, 0], [0, .08, .1], [0, .2, -.11], [.13, .4, 0], [-.13, .4, 0]].map(a => new V3(...a));
function bodySamples() {
  const P = DUM.parts, L = [[.16, .45, 0], [-.16, .45, 0], [0, .56, 0], [.13, -.02, .07], [-.13, -.02, -.07], [0, .25, .11], [0, .25, -.11]];
  if (P.head && P.head.attached) L.push([0, .86, 0], [0, .72, .12], [0, .72, -.11], [.1, .72, 0], [-.1, .72, 0]);
  for (const s of [-1, 1]) {
    const a = P[s < 0 ? 'armL' : 'armR'], l = P[s < 0 ? 'legL' : 'legR'];
    if (a && a.attached) L.push([s * .27, -.13, .08], [s * .25, .17, 0]);
    if (l && l.attached) L.push([s * .09, -.95, .15], [s * .09, -.95, -.04], [s * .09, -.5, .06]);
  }
  return L.map(a => new V3(...a).sub(BODY_COM));
}
function freeDummy() {
  if (DUM.free) return DUM.body;
  const T = DUM.torso; T.updateWorldMatrix(true, false);
  const wrap = new THREE.Group();
  T.localToWorld(wrap.position.copy(BODY_COM)); T.getWorldQuaternion(wrap.quaternion);
  T.parent.remove(T); wrap.add(T); T.position.copy(BODY_COM).negate(); T.rotation.set(0, 0, 0);
  scene.add(wrap); wrap.updateMatrixWorld(true);
  const b = makeLoose(wrap, { mass: 30, k: .3, kind: 'body', r: .5, samples: bodySamples() });
  b.soft = true; DUM.free = true; DUM.body = b; DUM.prevV = new V3();
  sfx.crunch(); sayDummy('WHOA WHOA WHOA!');
  return b;
}
// drags point gp of body b toward target (velocity-level spring), used for grabbing the ragdoll
function softPull(b, gp, target, tv, dt, k = 1) {
  _r.subVectors(gp, b.obj.position);
  const vp = _vp.crossVectors(b.w, _r).add(b.v);
  const vd = _v1.subVectors(target, gp).multiplyScalar(14).addScaledVector(tv, .35).clampLength(0, 13);
  const dv = vd.sub(vp), l = dv.length(); if (l < 1e-4) return;
  dv.divideScalar(l); _rn.crossVectors(_r, dv);
  const j = l / (1 / b.m + b.invI * _rn.lengthSq()) * .5 * k;
  b.v.addScaledVector(dv, j / b.m); b.w.addScaledVector(_rn, j * b.invI);
  b.still = 0;
}
function bodyImpact(b, p, speed, n) {
  if (speed < 3) { if (speed > 2) sfx.thud(.4); return; }
  b.cool = .2; state.slams = (state.slams || 0) + 1; updateSign();
  DUM.slams = (DUM.slams || 0) + 1;
  if (DUM.slams === 10 && DUM.parts.armR && DUM.parts.armR.attached) {
    const hand = DUM.parts.armR.g.userData.elbow;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .5, 6), new THREE.MeshStandardMaterial({ color: '#6b4426' })); pole.position.set(0, -.3, .05); hand.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(.22, .14), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide })); flag.position.set(.11, -.12, .05); hand.add(flag);
    setTimeout(() => sayDummy('OK OK I GIVE UP 🏳️'), 600);
  }
  sfx.thud(1); sfx.squish(); if (speed > 6) sfx.crunch();
  spawnBlood(p, n, Math.min(40, speed * 4 | 0), speed * .3, .8);
  if (typeof buzz === 'function') buzz(null, Math.min(1, speed / 8), 60);
  if (DUM.face) setFace('ouch', 1.5);
  if (state.t - DUM.said > 1.2) { DUM.said = state.t; sayDummy(pick(LINES.slam)); }
  if (speed > 8.5 && Math.random() < .5) {   // SNAP: a limb flies off from the impact
    const list = Object.values(DUM.parts).filter(P => P.attached && !P.held);
    if (list.length) { const P = pick(list); P.heldLocal = P.grab[0].clone(); ripPart(P, n.clone().negate().add(_v1.set(rand(-1, 1), 1, rand(-1, 1))).normalize(), null); }
  }
}

// --- speech bubble (sprite) ---
const bubble = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(.9, .225, 1); s.visible = false; s.renderOrder = 10; scene.add(s);
  return { c, t, s, until: 0, follow: null };
})();
function sayDummy(text, from) {
  const x = bubble.c.getContext('2d');
  x.clearRect(0, 0, 512, 128);
  x.fillStyle = 'rgba(255,255,255,.95)'; x.strokeStyle = '#1a0a08'; x.lineWidth = 6;
  x.beginPath(); x.roundRect(8, 8, 496, 92, 30); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(230, 98); x.lineTo(256, 124); x.lineTo(270, 98); x.fill();
  x.fillStyle = '#1a0a08'; x.font = 'bold 44px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, 56, 470);
  bubble.t.needsUpdate = true; bubble.s.visible = true;
  bubble.until = state.t + Math.max(1.8, text.split(/\s+/).length / 2.3 + .8);
  bubble.follow = from || null;
}
function setFace(kind, secs = 1.5) {
  const f = DUM.face; if (!f) return;
  f.mouth.visible = kind === 'calm' || kind === 'ouch'; f.mouthO.visible = kind === 'scream';
  f.mouth.rotation.z = kind === 'ouch' ? 0 : Math.PI;   // frown vs smile
  f.mouth.position.y = kind === 'ouch' ? .125 : .138;
  const b = kind === 'calm' ? 0 : .35;
  f.browL.rotation.z = Math.PI / 2 - b; f.browR.rotation.z = Math.PI / 2 + b;
  f.mouthO.scale.set(1, kind === 'scream' ? 1.6 : 1.3, .5);
  DUM.faceT = kind === 'calm' ? 0 : state.t + secs;
}

// --- finding something to grab: returns {P, local} for an attached part or {body} for a loose one ---
function findGrab(p, reach = .13) {
  let best = null, bd = reach;
  if (DUM) for (const P of Object.values(DUM.parts)) {
    if (!P.attached || P.held) continue;
    for (const gp of P.grab) {
      const w = P.g.localToWorld(_v1.copy(gp)); const d = w.distanceTo(p);
      if (d < bd) { bd = d; best = { P, local: P.g.worldToLocal(p.clone()) }; }
    }
  }
  if (DUM && !(DUM.free && DUM.body.held)) for (const gp of TORSO_GRAB) {
    const d = DUM.torso.localToWorld(_v1.copy(gp)).distanceTo(p);
    if (d < bd) { bd = d; best = { torso: true, p: p.clone() }; }
  }
  for (const b of LOOSE) {
    if (b.held || b.kind === 'body') continue;
    const d = b.obj.position.distanceTo(p) - b.r * .7;
    if (d < bd) { bd = d; best = { body: b }; }
  }
  return best;
}
// ray version for PC: the closest grab spot along the look ray
function findGrabRay(org, dir, maxD = 3.5) {
  let best = null, bt = maxD;
  const test = (w, rad, make) => {
    const t = _v2.subVectors(w, org).dot(dir); if (t < .2 || t > bt) return;
    const off = _v3.copy(org).addScaledVector(dir, t).distanceTo(w);
    if (off < rad) { bt = t; best = make(t); }
  };
  if (DUM) for (const P of Object.values(DUM.parts)) {
    if (!P.attached || P.held) continue;
    for (const gp of P.grab) { const w = P.g.localToWorld(gp.clone()); test(w, P.type === 'head' ? .14 : .1, t => ({ P, local: gp.clone(), t })); }
  }
  if (DUM && !(DUM.free && DUM.body.held)) for (const gp of TORSO_GRAB) { const w = DUM.torso.localToWorld(gp.clone()); test(w, .13, t => ({ torso: true, p: w.clone(), t })); }
  for (const b of LOOSE) if (!b.held && b.kind !== 'body') test(b.obj.position, b.r * .45 + .05, t => ({ body: b, t }));
  return best;
}

// --- pulling an attached part toward the hand. Returns how close it is to ripping (0..1) ---
const _J = new V3(), _pq = new Q(), _rq = new Q();
function pullPart(P, handW, hand, dt = 1 / 60, handVel) {
  const parent = P.g.parent; parent.updateWorldMatrix(true, false);
  _J.copy(P.restPos).applyMatrix4(parent.matrixWorld);
  parent.getWorldQuaternion(_pq);
  _rq.copy(_pq).multiply(P.restQuat);                                  // rest orientation in world
  const pl = P.heldLocal;
  const a = _v1.copy(pl).applyQuaternion(_rq).normalize();
  const d = _v2.subVectors(handW, _J); const dist = d.length(); d.divideScalar(dist || 1);
  const swing = new Q().setFromUnitVectors(a, d);
  const ang = 2 * Math.acos(clamp(swing.w, -1, 1));
  const lim = Math.min(1, P.def.maxAng / Math.max(ang, 1e-4));
  swing.slerp(new Q(), 1 - lim * .9);
  const wq = swing.multiply(_rq);
  P.g.quaternion.copy(_pq).invert().multiply(wq);
  const s = dist - pl.length();
  // a free (ragdoll) dummy gets DRAGGED by the part you hold
  if (DUM.free && DUM.body && s > 0) softPull(DUM.body, _J.clone(), handW, handVel || _v3.set(0, 0, 0), dt, .55);
  const move = s > 0 ? Math.min(s * .5, .17) : 0;
  const off = _v3.copy(d).multiplyScalar(move);
  const invPQ = _q1.copy(_pq).invert();
  P.g.position.copy(P.restPos).add(off.applyQuaternion(invPQ));
  P.stretch = move;
  // RESISTANCE: it only tears after you keep pulling hard. The harder you pull, the faster it tears.
  const over = s - P.def.rip * .35;
  P.tear = Math.max(0, (P.tear || 0) + (over > 0 ? dt * over / (P.def.rip * .65) * 1.15 : -dt * .6));
  const k = clamp(P.tear, 0, 1);
  if (k > 0) {
    // shaking part + the whole dummy struggles and flails
    P.g.position.add(_v1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(.012 * k));
    P.g.rotateX(rand(-1, 1) * .06 * k); P.g.rotateZ(rand(-1, 1) * .06 * k);
    for (const o of Object.values(DUM.parts)) if (o !== P && o.attached && !o.held) { o.vx += rand(-1, 1) * 90 * k * dt * 4; o.vz += rand(-1, 1) * 90 * k * dt * 4; }
    if (!DUM.free) { DUM.sway.vx += rand(-1, 1) * 30 * k * dt; DUM.sway.vz += rand(-1, 1) * 30 * k * dt; }
    else if (DUM.body) DUM.body.w.add(_v1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(6 * k * dt));
    if (DUM.face) setFace('scream', .6);
    if (k > .25 && !P.begged) { P.begged = true; sayDummy(pick(LINES.beg)); }
    if (Math.random() < dt * 25 * k) spawnBlood(_J.clone().addScaledVector(d, move * .5), d, 1, .5, .6);
  }
  if (P.tear >= 1) { ripPart(P, d.clone(), hand); return 1; }
  return k;
}

function ripPart(P, pullDir, hand) {
  const g = P.g, torso = DUM.torso;
  g.position.copy(P.restPos).add(_v1.copy(pullDir).multiplyScalar(.06).applyQuaternion(_q1.copy(torso.getWorldQuaternion(new Q())).invert()));
  g.updateWorldMatrix(true, true);
  const com = new V3(...P.def.com);
  const wrap = new THREE.Group();
  g.getWorldPosition(wrap.position); g.getWorldQuaternion(wrap.quaternion);
  wrap.position.add(com.clone().applyQuaternion(wrap.quaternion));
  g.parent.remove(g); wrap.add(g); g.position.copy(com).negate(); g.quaternion.identity();
  scene.add(wrap); wrap.updateMatrixWorld(true);
  if (P.type !== 'head') g.children[0].visible = false;   // hide the joint ball so the torn end shows
  // stumps
  const ps = makeStump(P.def.stumpR, P.def.boneR, P.type === 'leg' ? .06 : .045);
  ps.position.set(...P.def.partStump[0]); ps.quaternion.setFromUnitVectors(_v1.set(0, 1, 0), _v2.set(...P.def.partStump[1]).normalize()); g.add(ps);
  const bs = makeStump(P.def.stumpR * 1.05, P.def.boneR, .03);
  bs.position.set(...P.bodyStump[0]); bs.quaternion.setFromUnitVectors(_v1.set(0, 1, 0), _v2.set(...P.bodyStump[1]).normalize()); torso.add(bs);
  const col = goldBlood || state.rainbow ? () => bloodCol() : null;
  addBleeder(torso, bs.position.clone().add(_v1.set(...P.bodyStump[1]).multiplyScalar(.03)), _v2.set(...P.bodyStump[1]), 6, 45, col);
  addBleeder(g, ps.position.clone().add(_v1.set(...P.def.partStump[1]).multiplyScalar(.03)), _v2.set(...P.def.partStump[1]), 4, 30, col);
  const jw = bs.getWorldPosition(new V3());
  spawnBlood(jw, pullDir, 45, 3.2, .5); spawnBlood(jw, _v1.set(0, 1, 0), 20, 2, .8);
  const b = makeLoose(wrap, { mass: P.def.mass, k: P.def.k, kind: P.type === 'head' ? 'head' : 'part', r: P.type === 'leg' ? .5 : P.type === 'arm' ? .35 : .16,
    samples: P.def.samples.map(a => new V3(...a).sub(com)) });
  b.P = P; P.body = b; P.attached = false; P.held = null;
  if (DUM.free && DUM.body) { DUM.body.samples = bodySamples(); b.v.copy(DUM.body.v); }
  state.rips++; updateSign(); sfx.rip();
  if (typeof buzz === 'function') buzz(hand, 1, 120);
  if (DUM.face) setFace('scream', 3);
  sayDummy(pick(LINES[P.type]), P.type === 'head' ? b : null);
  if (P.type === 'head') { DUM.face = null; P.g.userData.face.mouthO.visible = true; P.g.userData.face.mouth.visible = false; }
  if (Object.values(DUM.parts).every(x => !x.attached) && !DUM.empty) { DUM.empty = true; setTimeout(() => toast('🦴 Nothing left to rip! Hit the red button for a new dummy.'), 1500); }
  return b;
}

// --- punching ---
function hitDummy(p, vel, who) {
  if (!DUM) return false;
  const sp = vel.length(); if (sp < 1.6) return false;
  const T = DUM.torso; T.updateWorldMatrix(true, false);
  let hit = null, hd = 1;
  const torsoC = T.localToWorld(_v1.set(0, .25, 0));
  if (DUM.free ? p.distanceTo(torsoC) < .27 : Math.hypot(p.x - torsoC.x, p.z - torsoC.z) < .2 && Math.abs(p.y - torsoC.y) < .33) hit = { what: 'torso' };
  for (const P of Object.values(DUM.parts)) {
    if (!P.attached) continue;
    for (const gp of P.grab) { const d = P.g.localToWorld(_v2.copy(gp)).distanceTo(p); if (d < (P.type === 'head' ? .14 : .085) && d < hd) { hd = d; hit = { what: 'part', P }; } }
  }
  if (!hit) return false;
  if (DUM.free && DUM.body) { const b = DUM.body; b.v.addScaledVector(vel, .14); _r.subVectors(p, b.obj.position); b.w.add(_rn.crossVectors(_r, vel).multiplyScalar(.5)); b.still = 0; }
  const loc = _v3.copy(vel).applyQuaternion(_q1.copy(T.getWorldQuaternion(new Q())).invert());
  const s = DUM.sway; s.vx += loc.z * .45; s.vz -= loc.x * .45;
  if (hit.P) { hit.P.vx += loc.z * 1.6; hit.P.vz -= loc.x * 1.6; }
  sfx.thud(Math.min(1, sp / 6));
  if (sp > 3.2) { spawnBlood(p.clone(), vel.clone().normalize(), Math.min(25, sp * 3 | 0), sp * .3, .6); sfx.squish(); }
  if (DUM.face) setFace('ouch', 1.2);
  if (state.t - DUM.said > 1.6 && Math.random() < .6) { DUM.said = state.t; sayDummy(pick(LINES.punch)); }
  if (typeof buzz === 'function') buzz(who, Math.min(1, sp / 6), 50);
  return true;
}

// --- head smashing (floor) ---
const toothMat = new THREE.MeshStandardMaterial({ color: '#fffdf0', roughness: .3 });
function smashHead(b, p, speed) {
  const P = b.P; const g = P.g;
  b.smash++; state.smashes++; updateSign();
  sfx.crunch(); if (typeof buzz === 'function') { buzz('L', 1, 90); buzz('R', 1, 90); }
  spawnBlood(p.clone().setY(p.y + .03), _v1.set(0, 1, 0), 30 + b.smash * 6, 2 + speed * .25, .9);
  for (let i = 0; i < 3; i++) addDecal(p.x + rand(-.12, .12), p.z + rand(-.12, .12), rand(.08, .18), bloodCol());
  const sk = g.userData.skull; sk.scale.y *= .87; sk.scale.x *= 1.05; sk.scale.z *= 1.04;
  // a bloody dent on the skull
  const dent = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), meatMat);
  const dir = new V3(rand(-1, 1), rand(-.2, 1), rand(-1, 1)).normalize();
  dent.position.set(0, .19, 0).addScaledVector(dir, .1); dent.scale.set(1, 1, .35); dent.lookAt(dent.position.clone().add(dir).applyMatrix4(g.matrixWorld)); g.add(dent);
  // teeth fly
  for (let i = 0; i < 1 + (Math.random() * 2 | 0); i++) {
    const tg = new THREE.Group(); const tm = new THREE.Mesh(new THREE.BoxGeometry(.012, .016, .01), toothMat); tm.castShadow = true; tg.add(tm);
    tg.position.copy(p).setY(p.y + .05); scene.add(tg);
    const tb = makeLoose(tg, { mass: .02, k: .01, kind: 'tooth', r: .02, life: 25, samples: [new V3(0, -.008, 0), new V3(0, .008, 0), new V3(.006, 0, 0), new V3(-.006, 0, 0)] });
    tb.v.set(rand(-2, 2), rand(2, 4), rand(-2, 2)); tb.w.set(rand(-20, 20), rand(-20, 20), rand(-20, 20));
  }
  if (b.smash === 3) {   // an eyeball pops out
    const eg = g.userData.face.eyes[0];
    if (eg && eg.parent) {
      const wp = eg.getWorldPosition(new V3()); eg.parent.remove(eg);
      const wrap = new THREE.Group(); wrap.position.copy(wp); wrap.add(eg); eg.position.set(0, 0, 0); eg.scale.setScalar(1.3); scene.add(wrap);
      const nerve = new THREE.Mesh(new THREE.CylinderGeometry(.004, .006, .05, 6), tendonMat); nerve.rotation.x = Math.PI / 2; nerve.position.z = -.03; eg.add(nerve);
      const eb = makeLoose(wrap, { mass: .05, k: .02, kind: 'eye', r: .03, life: 40, samples: [new V3(0, -.02, 0), new V3(.02, 0, 0), new V3(-.02, 0, 0), new V3(0, 0, .02), new V3(0, 0, -.02)] });
      eb.v.set(rand(-1.5, 1.5), 3, rand(-1.5, 1.5));
      const sock = new THREE.Mesh(new THREE.SphereGeometry(.017, 8, 6), meatMat); sock.position.set(-.038, .2, .088); g.add(sock);
    }
  }
  if (Math.random() < .5 || b.smash === 1) sayDummy(pick(LINES.smash), b);
  if (b.smash >= 5) burstHead(b, p);
}
function burstHead(b, p) {
  const wp = b.obj.position.clone();
  if (b.held) { b.held.grab = null; b.held = null; }
  killLoose(b);
  sfx.crunch(); sfx.rip(); bubble.s.visible = false;
  spawnBlood(wp, _v1.set(0, 1, 0), 90, 4, 1);
  for (let i = 0; i < 8; i++) addDecal(wp.x + rand(-.4, .4), wp.z + rand(-.4, .4), rand(.06, .22), bloodCol());
  const skinM = DUM.h.mats.skin, hairM = DUM.h.mats.hair;
  for (let i = 0; i < 11; i++) {
    const m = i < 4 ? skinM : i < 7 ? boneMat : i < 9 ? meat2Mat : hairM;
    const tg = new THREE.Group(); const cm = new THREE.Mesh(new THREE.SphereGeometry(rand(.025, .05), 6, 5), m); cm.scale.set(1, rand(.4, .8), rand(.6, 1)); cm.castShadow = true; tg.add(cm);
    tg.position.copy(wp).add(_v1.set(rand(-.05, .05), rand(0, .08), rand(-.05, .05))); scene.add(tg);
    const cb = makeLoose(tg, { mass: .2, k: .03, kind: 'chunk', r: .05, life: 30, samples: [new V3(0, -.025, 0), new V3(.03, 0, 0), new V3(-.03, 0, 0), new V3(0, .02, 0)] });
    cb.v.set(rand(-3, 3), rand(1.5, 5), rand(-3, 3)); cb.w.set(rand(-15, 15), rand(-15, 15), rand(-15, 15));
  }
  toast('💥 KABOOM! That head is GONE.');
}

// --- every frame ---
function stepDummy(dt) {
  if (!DUM) return;
  const t = state.t, s = DUM.sway;
  s.vx += (-70 * s.x - 5 * s.vx) * dt; s.vz += (-70 * s.z - 5 * s.vz) * dt;
  s.x += s.vx * dt; s.z += s.vz * dt; s.x = clamp(s.x, -.6, .6); s.z = clamp(s.z, -.6, .6);
  const T = DUM.torso;
  if (!DUM.free) T.rotation.set(s.x, 0, s.z);
  const br = 1 + Math.sin(t * 1.7) * .012; T.scale.set(br, 1, br);
  // ragdoll: limbs hang toward gravity and swing when the body is shaken
  let gl = null, al = null;
  if (DUM.free && DUM.body) {
    const iq = T.getWorldQuaternion(new Q()).invert();
    gl = new V3(0, -1, 0).applyQuaternion(iq);
    al = _v3.subVectors(DUM.body.v, DUM.prevV).divideScalar(Math.max(dt, 1e-3)).clampLength(0, 60).applyQuaternion(iq).clone();
    DUM.prevV.copy(DUM.body.v);
  }
  for (const P of Object.values(DUM.parts)) {
    if (!P.attached) continue;
    let tx = 0, tz = 0, K = 90, C = 7;
    if (gl) {
      const lim = P.type === 'head' ? .6 : P.type === 'leg' ? 1.3 : 1.6;
      if (P.type === 'head') { tx = Math.asin(clamp(gl.z, -1, 1)) * .6; tz = -Math.asin(clamp(gl.x, -1, 1)) * .6; }   // floppy neck
      else { tx = clamp(Math.atan2(-gl.z, -gl.y), -lim, lim); tz = clamp(Math.atan2(gl.x, -gl.y), -lim, lim); }
      K = P.type === 'head' ? 60 : 30; C = 4;
      P.vx += -al.z * .02; P.vz += al.x * .02;
    }
    P.vx += (-K * (P.sx - tx) - C * P.vx) * dt; P.vz += (-K * (P.sz - tz) - C * P.vz) * dt;
    P.sx = clamp(P.sx + P.vx * dt, -1.7, 1.7); P.sz = clamp(P.sz + P.vz * dt, -1.7, 1.7);
    if (P.held) continue;
    P.g.position.lerp(P.restPos, 1 - Math.exp(-dt * 12));
    let q = _q1.setFromEuler(new THREE.Euler(P.sx * (P.type === 'head' && !DUM.free ? .4 : 1), 0, P.sz * (P.type === 'head' && !DUM.free ? .4 : 1))).premultiply(P.restQuat);
    if (P.type === 'head' && DUM.face && !DUM.free) {   // head watches you (a little)
      const cw = camera.getWorldPosition(_v1); const hp = P.g.getWorldPosition(_v2);
      const yaw = clamp(Math.atan2(cw.x - hp.x, cw.z - hp.z) - DUM.root.rotation.y, -.6, .6);
      q = q.multiply(new Q().setFromEuler(new THREE.Euler(0, yaw, 0)));
    }
    P.g.quaternion.slerp(q, 1 - Math.exp(-dt * 10));
  }
  // blinking + face reset
  const f = DUM.face;
  if (f) {
    DUM.blink -= dt; const bl = DUM.blink < .12 ? .1 : 1; if (DUM.blink < 0) DUM.blink = rand(2, 5);
    f.eyes.forEach(e => e.scale.y = bl);
    if (DUM.faceT && t > DUM.faceT) setFace('calm');
  }
  // the stretchy torn meat between a held part and its socket
  const ten = DUM.tendon; ten.visible = false;
  for (const P of Object.values(DUM.parts)) {
    if (!P.attached || !P.held || (P.stretch || 0) < .015) continue;
    const a = _v1.copy(P.restPos).applyMatrix4(P.g.parent.matrixWorld), b = P.g.getWorldPosition(_v2);
    const L = a.distanceTo(b);
    ten.position.copy(a).add(b).multiplyScalar(.5); ten.scale.set(1 - L * 3, L, 1 - L * 3);
    ten.quaternion.setFromUnitVectors(_v3.set(0, 1, 0), b.sub(a).normalize()); ten.visible = true;
    if (Math.random() < dt * 20) spawnBlood(ten.position.clone(), _v3.set(0, -1, 0), 1, .3, .3);
  }
  // secret: put the head back on its neck
  const H = DUM.parts.head;
  if (H && !H.attached && H.body && H.body.held && H.body.smash < 5) {
    const neck = _v1.copy(H.restPos).applyMatrix4(DUM.torso.matrixWorld);
    const dn = H.g.getWorldPosition(_v2).distanceTo(neck);
    if (dn > .5) H.body.away = true;
    if (H.body.away && dn < .1) {
      H.body.held.grab = null; H.body.held = null;
      sfx.chime(); toast('🎉 Good as new!');
      buildDummy({ partyHat: true, gold: DUM.gold });
      sayDummy('THANK YOU!! 🎉');
    }
  }
  // speech bubble follows the head
  if (bubble.s.visible) {
    if (t > bubble.until) bubble.s.visible = false;
    else {
      const src = bubble.follow && bubble.follow.obj.parent ? bubble.follow.obj : (DUM.parts.head && DUM.parts.head.attached ? DUM.parts.head.g : DUM.torso);
      src.getWorldPosition(bubble.s.position); bubble.s.position.y += src === DUM.torso ? .95 : .45;
    }
  }
}
