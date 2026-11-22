// ===== DUMMY: a training dummy that looks like YOU. Pull parts off, punch it, smash its head. =====
// The body is a physics ragdoll (05b-ragdoll.js). Each limb hangs on a JOINT that stretches when you pull
// and tears after enough force (stump + bone on both sides, blood squirts).
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
let DUM = null, DUM_ID = 0;
const tendonMat = new THREE.MeshStandardMaterial({ color: '#b3122a', roughness: .4, emissive: '#300' });

function buildDummy(opts = {}) {
  if (DUM) {
    scene.remove(DUM.root); scene.remove(DUM.torso);
    for (const P of Object.values(DUM.parts)) scene.remove(P.tendon);
    for (let i = LOOSE.length - 1; i >= 0; i--) if (LOOSE[i].kind !== 'weapon') killLoose(LOOSE[i]);
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
  scene.add(h.root); h.root.updateMatrixWorld(true);
  // the torso lives straight in the scene: the ragdoll moves it
  const T = h.torso; const wp = T.getWorldPosition(new V3()); h.root.remove(T); T.position.copy(wp); scene.add(T); T.updateMatrixWorld(true);
  const parts = {};
  for (const [name, g] of Object.entries(h.parts)) {
    const type = name.startsWith('arm') ? 'arm' : name.startsWith('leg') ? 'leg' : 'head';
    const side = name.endsWith('L') ? -1 : 1;
    const def = PDEF[type];
    const P = { name, type, side, g, def, restPos: g.position.clone(), restQuat: g.quaternion.clone(), attached: true, tear: 0, stretch: 0, body: null };
    if (type === 'arm') P.bodyStump = [[side * .19, .455, 0], [side, -.15, 0]];
    else if (type === 'leg') P.bodyStump = [[side * .088, -.16, 0], [0, -1, 0]];
    else P.bodyStump = def.bodyStump;
    P.tendon = new THREE.Mesh(new THREE.CylinderGeometry(.02, .028, 1, 8), tendonMat); P.tendon.visible = false; scene.add(P.tendon);
    parts[name] = P;
  }
  DUM = { id: ++DUM_ID, h, root: h.root, torso: T, torsoUp: h.torsoUp, wounds: [], parts, face: h.face, gold, blink: 2, faceT: 0, said: 0, empty: false, hs: 0, slams: 0 };
  buildRag(DUM); POST.off = true;
  if (gold) setTimeout(() => sayDummy('✨ I feel... SHINY ✨'), 400);
}
const ownerPart = i => DUM && DUM.parts[RAG.owner[i]];
function heldParts() { const s = new Set(); for (const h of RAG.holds) s.add(RAG.owner[h.i]); return s; }

// --- finding something to grab: {rag: pointIndex} on the dummy, or {body} for a loose piece ---
function findGrab(p, reach = .1) {
  let best = null, bd = reach;
  if (DUM) { const i = ragNearest(p, reach); if (i >= 0) { bd = RAG.p[i].distanceTo(p) - RAG.r[i]; best = { rag: i }; } }
  for (const b of LOOSE) {
    if (b.held || b.kind === 'weapon') continue;
    const d = b.obj.position.distanceTo(p) - b.r * .7;
    if (d < bd) { bd = d; best = { body: b }; }
  }
  // weapons are grabbed by the handle (a second hand can join the first)
  for (const b of WEAPONS) {
    const g = weaponGripAt(b, p);
    if (g.dist < .1 && g.dist < bd + .03) { bd = g.dist; best = { weapon: b, local: g.local }; }
  }
  return best;
}
// ray version for PC: the closest grab spot along the look ray
function findGrabRay(org, dir, maxD = 3.5) {
  let best = null, bt = maxD;
  if (DUM) { const r = ragRay(org, dir, maxD); if (r) { best = { rag: r.i, t: r.t }; bt = r.t; } }
  for (const b of WEAPONS) {
    if (b.held) continue;
    const g = weaponGripRay(b, org, dir, bt + .15);
    if (g) { bt = g.t; best = { weapon: b, local: g.local, t: g.t }; }
  }
  for (const b of LOOSE) {
    if (b.held || b.kind === 'weapon') continue;
    const t = _v2.subVectors(b.obj.position, org).dot(dir); if (t < .2 || t > bt) continue;
    if (_v3.copy(org).addScaledVector(dir, t).distanceTo(b.obj.position) < b.r * .45 + .05) { bt = t; best = { body: b, t }; }
  }
  return best;
}
function ragHold(H, i, target) {
  RAG.holds = RAG.holds.filter(x => x.H !== H);
  RAG.holds.push({ H, i, target: target.clone(), k: RAG.owner[i] === 'torso' || RAG.owner[i] === 'hips' ? .2 : RAG.owner[i] === 'head' ? .35 : .45 });
}
function ragRelease(H, vel) {
  const h = RAG.holds.find(x => x.H === H); if (!h) return;
  RAG.holds = RAG.holds.filter(x => x !== h);
  if (RAG.alive[h.i] && vel) {
    // throw: the held point gets your hand speed, the rest of the body most of it (it all flies together)
    const v = vel.clone().clampLength(0, 12), hh = RAG.h || 1 / 120;
    for (let i = 0; i < RAG.p.length; i++) {
      if (!RAG.alive[i]) continue;
      const k = i === h.i ? 1 : RAG.owner[i] === RAG.owner[h.i] ? .85 : .6;
      const cur = ragVel(i, hh); cur.lerp(v, k);
      RAG.q[i].copy(RAG.p[i]).addScaledVector(cur, -hh);
    }
  }
}

// --- punching: shove the nearest body point ---
function hitDummy(p, vel, who) {
  if (!DUM) return false;
  const sp = vel.length(); if (sp < 1.6) return false;
  const i = ragNearest(p, .06); if (i < 0) return false;
  const tor = RAG.owner[i] === 'torso' || RAG.owner[i] === 'hips';
  ragAddVel(i, _v1.copy(vel).multiplyScalar(tor ? .45 : .85), RAG.h || 1 / 120);
  if (tor && RAG.pinned && sp > 7) unpin('WHOA!');
  sfx.thud(Math.min(1, sp / 6)); if (sp > 5) sfx.crunch();
  if (sp > 2.4) addWound(RAG.p[i].clone().lerp(p, .5), vel, clamp(.012 + sp * .004, .015, .04), 'bruise');
  if (sp > 3.2) { spawnBlood(p.clone(), vel.clone().normalize(), Math.min(25, sp * 3 | 0), sp * .3, .6); sfx.squish(); }
  if (typeof bloodyHand === 'function') bloodyHand(who, sp);
  if (RAG.owner[i] === 'head' && sp > 5.5) headHit(RAG.p[i].clone(), sp * .7);
  if (sp > 6.5) RAG.ko = Math.max(RAG.ko, 1.2);
  if (DUM.face) setFace('ouch', 1.2);
  if (state.t - DUM.said > 1.6 && Math.random() < .6) { DUM.said = state.t; sayDummy(pick(LINES.punch)); }
  if (typeof buzz === 'function') buzz(who, Math.min(1, sp / 6), 50);
  return true;
}
function unpin(line) {
  if (!RAG.pinned) return;
  RAG.pinned = false; sfx.crunch(); sfx.thud(1);
  setTimeout(() => { if (!RAG.pinned) POST.off = false; }, 600);
  sayDummy(line || 'WHOA WHOA WHOA!');
}
// --- the body hits the floor / a wall ---
function ragImpact(hit) {
  const { i, v: speed, p, n } = hit;
  DUM.slamCool = state.t + .22;
  const owner = RAG.owner[i];
  if (owner === 'head' && speed > 4.5) headHit(p, speed);
  if (speed < 3.2) { sfx.thud(.35); return; }
  state.slams = (state.slams || 0) + 1; updateSign();
  DUM.slams++;
  if (DUM.slams === 10 && DUM.parts.armR && DUM.parts.armR.attached) {
    const hand = DUM.parts.armR.g.userData.elbow;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .5, 6), new THREE.MeshStandardMaterial({ color: '#6b4426' })); pole.position.set(0, -.3, .05); hand.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(.22, .14), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide })); flag.position.set(.11, -.12, .05); hand.add(flag);
    setTimeout(() => sayDummy('OK OK I GIVE UP 🏳️'), 600);
  }
  sfx.thud(1); sfx.squish(); if (speed > 6) { sfx.crunch(); sfx.crack(); }
  spawnBlood(p, n, Math.min(40, speed * 4 | 0), speed * .3, .8);
  if (n.y < .5) addSplat(p, n, Math.min(.35, .06 + speed * .03));
  if (typeof buzz === 'function') { for (const h of RAG.holds) buzz(h.H.side, Math.min(1, speed / 7), 70); }
  if (speed > 7) RAG.ko = 2.5;                 // knocked out: goes fully limp
  if (DUM.face) setFace('ouch', 1.5);
  if (state.t - DUM.said > 1.2) { DUM.said = state.t; sayDummy(pick(LINES.slam)); }
  if (speed > 9.5 && Math.random() < .35) {   // SNAP: a limb flies off from the impact
    const list = Object.values(DUM.parts).filter(P => P.attached && P.type !== 'head');
    if (list.length) { const P = pick(list); ripPart(P, n.clone().negate().add(_v1.set(rand(-1, 1), 1, rand(-1, 1))).normalize(), null); }
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

function ripPart(P, pullDir, hand) {
  const g = P.g, torso = P.type === 'leg' ? DUM.torso : DUM.torsoUp;
  g.updateWorldMatrix(true, true);
  const vel = new V3(); for (const i of P.pts || []) vel.add(ragVel(i, RAG.h || 1 / 120)); if (P.pts) vel.divideScalar(P.pts.length);
  for (const h of RAG.holds) if (RAG.owner[h.i] === P.name) h.ripped = true;
  ragKill(P); P.tendon.visible = false;
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
  b.P = P; P.body = b; P.attached = false; b.v.copy(vel).clampLength(0, 10);
  RAG.musc = Math.max(.3, RAG.musc - .2);
  state.rips++; updateSign(); sfx.rip();
  if (typeof buzz === 'function') buzz(hand, 1, 120);
  if (DUM.face) setFace('scream', 3);
  sayDummy(pick(LINES[P.type]), P.type === 'head' ? b : null);
  if (P.type === 'head') { DUM.face = null; P.g.userData.face.mouthO.visible = true; P.g.userData.face.mouth.visible = false; }
  if (Object.values(DUM.parts).every(x => !x.attached) && !DUM.empty) { DUM.empty = true; setTimeout(() => toast('🦴 Nothing left to rip! Hit the red button for a new dummy.'), 1500); }
  return b;
}


// --- head smashing (floor) ---
const toothMat = new THREE.MeshStandardMaterial({ color: '#fffdf0', roughness: .3 });
function smashHead(b, p, speed) {
  b.smash++;
  damageHead(b.P.g, b.smash, p, speed, b);
  if (b.smash >= 5) burstHead(b, p);
}
// an attached head hitting the floor or a wall
function headHit(p, speed) {
  const H = DUM.parts.head; if (!H || !H.attached || state.t < (DUM.headCool || 0)) return;
  DUM.headCool = state.t + .3; DUM.hs++;
  damageHead(H.g, DUM.hs, p, speed, null);
  if (DUM.hs >= 5) { const b = ripPart(H, new V3(0, 1, 0), null); b.smash = 5; burstHead(b, p); }
}
function damageHead(g, n, p, speed, b) {
  state.smashes++; updateSign();
  sfx.crunch(); if (typeof buzz === 'function') { buzz('L', 1, 90); buzz('R', 1, 90); }
  spawnBlood(p.clone().setY(p.y + .03), _v1.set(0, 1, 0), 30 + n * 6, 2 + speed * .25, .9);
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
  if (n === 3) {   // an eyeball pops out
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
  if (Math.random() < .5 || n === 1) sayDummy(pick(LINES.smash), b);
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
  const t = state.t;
  RAG.h = dt / RAG_SUB;
  // the head turns to watch you while he's standing on the post
  if (RAG.pinned && DUM.face && RAG.ko <= 0) {
    const tq = DUM.torso.getWorldQuaternion(_q1), cw = camera.getWorldPosition(_v1), hp = RAG.p[RAG.idx.N] ? RAG.p[RAG.idx.N] : DUM.torso.position;
    const fw = _v2.set(0, 0, 1).applyQuaternion(tq), toC = _v3.subVectors(cw, hp); toC.y = 0; fw.y = 0;
    const want = clamp(Math.atan2(fw.x * toC.z - fw.z * toC.x, fw.x * toC.x + fw.z * toC.z) * -1, -.7, .7);
    RAG.look = (RAG.look || 0) + (want - (RAG.look || 0)) * Math.min(1, dt * 3);
  } else RAG.look = (RAG.look || 0) * .95;
  stepRag(dt);
  // pulled hard enough by the chest? it rips off the post
  if (RAG.pinned) for (const h of RAG.holds) if ((RAG.owner[h.i] === 'torso' || RAG.owner[h.i] === 'hips') && RAG.p[RAG.idx.Ch].distanceTo(RAG.pin[RAG.idx.Ch]) > .1) { unpin(); break; }
  if (RAG.hitBest && RAG.hitBest.v > 2.6 && t > (DUM.slamCool || 0)) ragImpact(RAG.hitBest);
  // JOINTS: they stretch under force and slowly TEAR. The dummy fights back while you pull.
  const held = heldParts();
  for (const P of Object.values(DUM.parts)) {
    if (!P.attached || !P.pts) continue;
    const st = RAG.p[P.root].distanceTo(RAG.p[P.sock]);
    P.stretch = st;
    const lim = .035;
    P.tear = Math.max(0, P.tear + (st > lim ? dt * Math.min(1.15, Math.pow((st - lim) / .1, 1.5)) : -dt * .35));
    const k = clamp(P.tear, 0, 1);
    if (k > 0 && held.has(P.name)) {
      for (const o of Object.values(DUM.parts)) if (o !== P && o.attached && o.pts) ragAddVel(o.end, _v1.set(rand(-1, 1), rand(-.5, 1), rand(-1, 1)).multiplyScalar(5 * k), RAG.h);   // flailing
      if (DUM.face) setFace('scream', .6);
      if (k > .2 && !P.begged) { P.begged = true; sayDummy(pick(LINES.beg)); }
      for (const h of RAG.holds) if (RAG.owner[h.i] === P.name) { buzz(h.H.side, .15 + k * .7, 25); if (Math.random() < dt * 10 * k) sfx.stretch(k); }
      if (Math.random() < dt * 30 * k) spawnBlood(RAG.p[P.sock].clone(), _v1.subVectors(RAG.p[P.root], RAG.p[P.sock]).normalize(), 1, .6, .6);
    }
    if (P.tear < .05) P.begged = false;
    if (P.tear >= 1) {
      const dir = _v1.subVectors(RAG.p[P.root], RAG.p[P.sock]).normalize().clone();
      const holder = RAG.holds.find(h => RAG.owner[h.i] === P.name);
      ripPart(P, dir, holder ? holder.H.side : null);
    }
  }
  // WAIST: grab the top and bottom half and pull him in two
  if (!RAG.split) {
    let st = 0;
    for (const c of RAG.C) if (c.kind === 'waist') st = Math.max(st, RAG.p[c.a].distanceTo(RAG.p[c.b]) - c.len);
    DUM.waistSt = st;
    RAG.waistTear = Math.max(0, RAG.waistTear + (st > .05 ? dt * Math.min(1, Math.pow((st - .05) / .1, 1.5)) : -dt * .3));
    const k = clamp(RAG.waistTear, 0, 1);
    if (k > 0) {
      if (DUM.face) setFace('scream', .6);
      if (k > .2 && !DUM.waistBeg) { DUM.waistBeg = true; sayDummy(pick(['NOT THE MIDDLE!!', 'I WILL SNAP!', 'NO NO NO NO'])); }
      for (const h of RAG.holds) buzz(h.H.side, .2 + k * .7, 25);
      if (Math.random() < dt * 30 * k) spawnBlood(RAG.p[RAG.idx.Fr].clone(), _v1.set(0, -1, 0), 1, .6, .8);
    } else DUM.waistBeg = false;
    if (RAG.waistTear >= 1) splitDummy();
  }
  poseRag(DUM);
  // blinking + face reset
  const f = DUM.face;
  if (f) {
    DUM.blink -= dt; const bl = DUM.blink < .12 || RAG.ko > 0 ? .1 : 1; if (DUM.blink < 0) DUM.blink = rand(2, 5);
    f.eyes.forEach(e => e.scale.y = bl);
    if (DUM.faceT && t > DUM.faceT) setFace('calm');
  }
  // the stretchy torn meat between a pulled part and its socket
  for (const P of Object.values(DUM.parts)) {
    const ten = P.tendon; ten.visible = false;
    if (!P.attached || !P.pts || P.stretch < .02) continue;
    const a = RAG.p[P.sock], b = RAG.p[P.root], L = a.distanceTo(b);
    ten.position.copy(a).add(b).multiplyScalar(.5); ten.scale.set(Math.max(.35, 1 - L * 4), L + .03, Math.max(.35, 1 - L * 4));
    ten.quaternion.setFromUnitVectors(_v3.set(0, 1, 0), _v2.subVectors(b, a).normalize()); ten.visible = true;
  }
  // secret: put the head back on its neck
  const H = DUM.parts.head;
  if (H && !H.attached && H.body && H.body.held && H.body.smash < 5) {
    const neck = _v1.copy(RAG.p[RAG.idx.N]);
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

// --- torn in two at the waist ---
function splitDummy() {
  ragSplit();
  const U = DUM.torsoUp, T = DUM.torso;
  const sU = makeStump(.13, .022, .05); sU.position.set(0, .19, 0); sU.quaternion.setFromUnitVectors(_v1.set(0, 1, 0), _v2.set(0, -1, 0)); sU.scale.z = .65; U.add(sU);
  const sL = makeStump(.13, .022, .04); sL.position.set(0, .17, 0); sL.scale.z = .65; T.add(sL);
  // guts hanging out
  const gm = new THREE.MeshStandardMaterial({ color: '#d4707e', roughness: .35, emissive: '#3a0a10' });
  for (const [grp, y, dirY] of [[U, .17, -1], [T, .19, 1]]) for (let i = 0; i < 5; i++) {
    const gut = new THREE.Mesh(new THREE.TorusGeometry(rand(.025, .04), rand(.012, .018), 6, 10, rand(2.5, 5)), gm);
    gut.position.set(rand(-.07, .07), y + dirY * rand(.0, .05), rand(-.03, .04)); gut.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); gut.castShadow = true; grp.add(gut);
  }
  const col = goldBlood || state.rainbow ? () => bloodCol() : null;
  addBleeder(U, new V3(0, .17, 0), new V3(0, -1, 0), 7, 60, col);
  addBleeder(T, new V3(0, .19, 0), new V3(0, 1, 0), 7, 50, col);
  const mid = RAG.p[RAG.idx.Fr].clone();
  spawnBlood(mid, _v1.set(0, 1, 0), 80, 3.5, .9);
  sfx.rip(); sfx.crunch(); setTimeout(() => sfx.rip(), 90);
  for (const h of RAG.holds) buzz(h.H.side, 1, 200);
  state.rips++; updateSign();
  RAG.ko = 4; RAG.musc = .3;
  if (DUM.face) setFace('scream', 4);
  sayDummy("I'M IN TWO PIECES?!");
}

// --- bloody marks that stick to his body (and spray onto walls nearby) ---
const woundMat = new THREE.MeshStandardMaterial({ color: '#6a0510', roughness: .3, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const woundDeep = new THREE.MeshStandardMaterial({ color: '#2a0004', roughness: .5, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
const woundGeo = (() => { const g = new THREE.CircleGeometry(1, 10); const p = g.attributes.position; for (let i = 1; i < p.count; i++) { const k = rand(.7, 1.2); p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k); } return g; })();
const _ray = new THREE.Raycaster();
// kind: 'bruise' (punch), 'cut' (long gash), 'stab' (deep hole)
function addWound(p, dir, size, kind = 'bruise') {
  if (!DUM) return null;
  const d = dir.clone().normalize();
  _ray.set(p.clone().addScaledVector(d, -.3), d); _ray.far = .6;
  const hit = _ray.intersectObject(DUM.torso, true).find(h => h.object.isMesh && h.object.material !== woundMat && h.object.material !== woundDeep && h.face);
  if (!hit) return null;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const par = hit.object.parent;
  const m = new THREE.Mesh(woundGeo, kind === 'stab' ? woundDeep : woundMat);
  par.add(m);
  const pq = par.getWorldQuaternion(new Q()).invert();
  m.position.copy(par.worldToLocal(hit.point.clone().addScaledVector(n, .002)));
  m.quaternion.copy(pq).multiply(new Q().setFromUnitVectors(_v1.set(0, 0, 1), n)).multiply(new Q().setFromAxisAngle(_v2.set(0, 0, 1), kind === 'cut' ? Math.atan2(d.y, d.x) : rand(0, 6)));
  const ps = par.getWorldScale(new V3());
  m.scale.set(size * (kind === 'cut' ? 2.6 : 1) / ps.x, size * (kind === 'cut' ? .35 : 1) / ps.y, 1);
  if (kind === 'stab') { const ring = new THREE.Mesh(woundGeo, woundMat); ring.scale.set(1.8, 1.8, 1); ring.position.z = -.001; m.add(ring); }
  DUM.wounds.push(m); if (DUM.wounds.length > 90) { const o = DUM.wounds.shift(); if (o.parent) o.parent.remove(o); }
  // blood flies off the wound and splats on a wall if one is close
  const wallDir = d.clone(); wallDir.y = Math.max(wallDir.y, -.2);
  const tgt = hit.point.clone().addScaledVector(wallDir, 1.4), before = tgt.clone(); keepIn(tgt, .02);
  if (tgt.distanceToSquared(before) > 1e-6) addSplat(tgt, before.sub(tgt).normalize().negate(), size * 4);
  return { point: hit.point, n, obj: par };
}
