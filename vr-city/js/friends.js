// Your friends in the city: a body that follows their head, two gloved hands with arms,
// a glowing head lamp with a light beam, a name tag, and their voice coming from their mouth.
import * as THREE from 'three';
import { buildCrawlerModel } from './crawler.js';

const UP = new THREE.Vector3(0, 1, 0);
const SEG = new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0);
const _d = new THREE.Vector3();
function placeSeg(m, a, b, r) {
  _d.subVectors(b, a);
  const L = _d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / Math.max(L, 1e-5)));
  m.scale.set(r, L, r);
}

const COLORS = [0x2f7fd0, 0xd0802f, 0x3fb070, 0xb04fd0, 0xd0c02f];
export function colorFor(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function label(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 38px sans-serif'; x.textAlign = 'center';
  x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(20, 6, 216, 52);
  x.fillStyle = '#e8fff0'; x.fillText(text, 128, 46);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  s.scale.set(0.5, 0.125, 1);
  return s;
}

const CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
const SPHG = new THREE.SphereGeometry(1, 14, 10);
const add = (g, parent, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; };
const addM = (g, m, parent, ...r) => add(g, parent, m, ...r);

// a hand: palm + 4 curling fingers (2 bones each) + thumb. Fingers point along +y; curl by `c` (0 open .. 1 fist)
function makeHand(mat, skin) {
  const h = new THREE.Group();
  add(SPHG, h, mat, 0, 0.02, 0, 0.034, 0.045, 0.02);
  const fing = [];
  for (let i = 0; i < 4; i++) {
    const f1 = new THREE.Group(); f1.position.set((i - 1.5) * 0.017, 0.055, 0); h.add(f1);
    add(CAP(0.0085, 0.022), f1, mat, 0, 0.016, 0);
    const f2 = new THREE.Group(); f2.position.y = 0.036; f1.add(f2);
    add(CAP(0.0075, 0.018), f2, mat, 0, 0.013, 0);
    fing.push([f1, f2]);
  }
  const th = new THREE.Group(); th.position.set(0.03, 0.01, 0); th.rotation.z = -0.8; h.add(th);
  add(CAP(0.009, 0.026), th, mat, 0, 0.02, 0);
  h.userData = { fing, th, skin };
  return h;
}
function curlHand(h, c, side) {
  const { fing, th } = h.userData;
  for (let i = 0; i < 4; i++) { fing[i][0].rotation.x = -(0.15 + c * 1.25); fing[i][1].rotation.x = -(0.1 + c * 1.35); }
  th.rotation.z = -0.8 + c * 0.7;
  void side;
}

export function makeFriends(scene, beamMat) {
  const list = new Map();
  const glove = new THREE.MeshLambertMaterial({ color: 0x14141a });

  function make(id, name) {
    const col = colorFor(id);
    const jacket = new THREE.MeshLambertMaterial({ color: col });
    const jacketDark = new THREE.MeshLambertMaterial({ color: new THREE.Color(col).multiplyScalar(0.55) });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8b090 });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x232a40 });
    const boot = new THREE.MeshLambertMaterial({ color: 0x1b1713 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0c0c0e });
    const g = new THREE.Group();   // holds the head (it follows the real head exactly)
    const head = new THREE.Group(); g.add(head);
    add(SPHG, head, skin, 0, 0, 0, 0.1, 0.115, 0.105);                               // skull
    add(SPHG, head, new THREE.MeshLambertMaterial({ color: 0x2a1a10 }), 0, 0.03, 0.012, 0.108, 0.105, 0.108);   // hair
    for (const s of [-1, 1]) {
      add(SPHG, head, skin, s * 0.1, -0.005, 0.0, 0.016, 0.03, 0.02);                // ears
      add(SPHG, head, new THREE.MeshBasicMaterial({ color: 0xf2f2ee }), s * 0.04, 0.018, -0.088, 0.022, 0.016, 0.014);   // eye whites
      add(SPHG, head, dark, s * 0.04, 0.018, -0.1, 0.0105, 0.0105, 0.006);           // pupils
      add(SPHG, head, new THREE.MeshLambertMaterial({ color: 0x2a1a10 }), s * 0.042, 0.05, -0.088, 0.026, 0.006, 0.012).rotation.z = s * 0.15;   // brows
    }
    const eyeLids = [];
    for (const s of [-1, 1]) eyeLids.push(add(SPHG, head, skin, s * 0.04, 0.034, -0.0895, 0.0235, 0.0001, 0.0145));   // lids that close on a blink
    add(SPHG, head, skin, 0, -0.012, -0.1, 0.014, 0.022, 0.016);                     // nose
    // gaiter mask over the nose-less lower face: a pale cloth with a dark mouth hole that moves when they talk
    const mask = add(SPHG, head, new THREE.MeshLambertMaterial({ color: 0x1c1c22 }), 0, -0.055, -0.026, 0.092, 0.058, 0.082);
    const mouth = add(SPHG, head, new THREE.MeshBasicMaterial({ color: 0x050506 }), 0, -0.06, -0.098, 0.022, 0.007, 0.008);
    void mask;
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.011, 6, 20), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    strap.rotation.x = Math.PI / 2; strap.position.y = 0.05; head.add(strap);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.04, 10), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 0.055, -0.112); head.add(lamp);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 14, 1, true).translate(0, -4.5, 0).rotateX(-Math.PI / 2), beamMat);
    beam.position.set(0, 0.055, -0.13); head.add(beam);

    // ---- the body: stands on the floor, turns with the head, walks when they walk ----
    const body = new THREE.Group(); scene.add(body);          // origin = hips
    const torsoG = new THREE.Group(); torsoG.position.y = 0.0; body.add(torsoG);
    const chest = add(CAP(0.1, 0.1), torsoG, jacket, 0, 0.17, 0, 1.2, 1, 0.85);     // parka
    add(CAP(0.09, 0.05), torsoG, jacketDark, 0, 0.0, 0, 1.15, 1, 0.9);              // lower jacket hem
    const scarf = addM(new THREE.TorusGeometry(0.075, 0.03, 8, 16), jacketDark, torsoG, 0, 0.33, -0.005); scarf.rotation.x = Math.PI / 2;
    const pack = addM(new THREE.BoxGeometry(0.2, 0.22, 0.09), new THREE.MeshLambertMaterial({ color: 0x3a3020 }), torsoG, 0, 0.19, 0.115);
    addM(new THREE.BoxGeometry(0.2, 0.05, 0.095), new THREE.MeshLambertMaterial({ color: 0x2a2216 }), torsoG, 0, 0.26, 0.118);
    for (const s of [-1, 1]) addM(new THREE.BoxGeometry(0.02, 0.2, 0.02), dark, torsoG, s * 0.07, 0.2, -0.085);   // pack straps
    add(SPHG, torsoG, skin, 0, 0.37, -0.005, 0.04, 0.05, 0.04);                    // neck
    const legs = [-1, 1].map((sx) => {
      const hip = new THREE.Group(); hip.position.set(sx * 0.055, 0, 0); body.add(hip);
      add(CAP(0.05, 0.2), hip, jeans, 0, -0.14, 0);
      const knee = new THREE.Group(); knee.position.y = -0.27; hip.add(knee);
      add(CAP(0.042, 0.2), knee, jeans, 0, -0.13, 0);
      addM(new THREE.BoxGeometry(0.075, 0.06, 0.14), boot, knee, 0, -0.27, -0.03);
      return { hip, knee };
    });

    const arms = [0, 1].map((i) => {
      const sh = add(SPHG, torsoG, jacket, 0, 0, 0, 0.05, 0.05, 0.05); sh.visible = true; sh.userData.i = i;
      const up = new THREE.Mesh(SEG, jacket), lo = new THREE.Mesh(SEG, jacket);
      const el = new THREE.Mesh(SPHG, jacket); el.scale.setScalar(0.042);
      const cuff = new THREE.Mesh(SEG, jacketDark);
      const hand = makeHand(glove, skin);
      scene.add(up, lo, el, cuff, hand); sh.visible = false;
      return { up, lo, el, cuff, hand, E: new THREE.Vector3(), S: new THREE.Vector3() };
    });
    const tag = label(name);
    scene.add(tag);
    g.visible = true; scene.add(g);
    const parts = [g, body, tag, ...arms.flatMap((a) => [a.up, a.lo, a.el, a.cuff, a.hand])];
    const monM = buildCrawlerModel(1.35); monM.root.visible = false; scene.add(monM.root);   // admin can become the monster
    return { monM, id, name, g, parts, head, body, torsoG, chest, scarf, legs, arms, tag, beam, mouth, eyeLids, nextBlink: performance.now() + 1500 + Math.random() * 3000, phase: Math.random() * 6, phase0: Math.random() * 6, lean: 0, wspd: 0,
      gp: [0, 0], gpT: [0, 0],
      headT: new THREE.Vector3(), qT: new THREE.Quaternion(), hT: [new THREE.Vector3(), new THREE.Vector3()],
      headP: new THREE.Vector3(), q: new THREE.Quaternion(), hP: [new THREE.Vector3(), new THREE.Vector3()],
      seen: 0, fresh: true, ghost: false, light: true, hidden: false, audio: null, talk: 0, yaw: 0 };
  }

  function get(id, name) {
    let f = list.get(id);
    if (!f) { f = make(id, name || 'Friend'); list.set(id, f); }
    return f;
  }
  function drop(id) {
    const f = list.get(id);
    if (!f) return;
    for (const o of f.parts) scene.remove(o);
    scene.remove(f.monM.root);
    if (f.audio) { try { f.audio.srcObject = null; f.audio.remove(); } catch (e) {} }
    list.delete(id);
  }
  // pose message: h = head xyz + quat, l / r = hand xyz
  function pose(m) {
    const f = get(m.id, m.n);
    f.headT.fromArray(m.h, 0); f.qT.fromArray(m.h, 3);
    f.hT[0].fromArray(m.l); f.hT[1].fromArray(m.r);
    f.ghost = !!m.g; f.light = !!m.lt; f.hidden = !!m.hd; f.hideT = m.ht || 0; f.menu = !!m.m; f.tb = !!m.tb; f.mon = !!m.mo;
    if (m.gp) { f.gpT[0] = m.gp[0]; f.gpT[1] = m.gp[1]; }
    f.seen = performance.now();
    if (f.fresh) { f.headP.copy(f.headT); f.q.copy(f.qT); f.hP[0].copy(f.hT[0]); f.hP[1].copy(f.hT[1]); f.fresh = false; }
    return f;
  }

  const _s = new THREE.Vector3(), _fw = new THREE.Vector3(), _side = new THREE.Vector3(), _pole = new THREE.Vector3();
  function update(dt, listener) {
    const k = Math.min(1, dt * 14);
    for (const f of list.values()) {
      f.headP.lerp(f.headT, k); f.q.slerp(f.qT, k);
      f.hP[0].lerp(f.hT[0], k); f.hP[1].lerp(f.hT[1], k);
      f.head.position.copy(f.headP); f.head.quaternion.copy(f.q);
      _fw.set(0, 0, -1).applyQuaternion(f.q); _fw.y = 0;
      if (_fw.lengthSq() > 1e-4) f.yaw = Math.atan2(-_fw.x, -_fw.z);
      const now = performance.now();
      // how fast are they walking? (from how fast their head moves on the floor)
      const hsp0 = f.lastHead0 ? Math.hypot(f.headP.x - f.lastHead0.x, f.headP.z - f.lastHead0.z) / Math.max(dt, 1e-3) : 0;
      (f.lastHead0 = f.lastHead0 || new THREE.Vector3()).copy(f.headP);
      f.wspd += (Math.min(4, hsp0) - f.wspd) * Math.min(1, dt * 6);
      f.phase += f.wspd * dt * 2.6;
      const w = Math.min(1, f.wspd / 1.2), sw = Math.sin(f.phase) * 0.7 * w;
      const hipY = f.headP.y - 0.45, bob = Math.abs(Math.sin(f.phase)) * 0.015 * w;
      f.body.position.set(f.headP.x, hipY + bob, f.headP.z); f.body.rotation.set(0, f.yaw, 0);
      f.lean += (Math.min(0.2, f.wspd * 0.05) - f.lean) * Math.min(1, dt * 5);
      f.torsoG.rotation.set(f.lean, 0, Math.sin(f.phase) * 0.04 * w);
      const br = 1 + Math.sin(now / 900 + f.phase0) * 0.018;
      f.chest.scale.set(1.2 * br, br, 0.85 * br);
      f.legs[0].hip.rotation.x = sw; f.legs[1].hip.rotation.x = -sw;
      f.legs[0].knee.rotation.x = Math.max(0, -Math.sin(f.phase + 0.6)) * 0.9 * w; f.legs[1].knee.rotation.x = Math.max(0, Math.sin(f.phase + 0.6)) * 0.9 * w;
      // crouching / hiding: bend the knees when the head is low
      const crouch = Math.max(0, Math.min(1, (0.8 - (f.headP.y - (f.groundY ?? 0))) / 0.3));
      void crouch;
      if (f.tb) { const r = now / 70; f.body.rotation.set(r, f.yaw, r * 0.7); f.legs[0].hip.rotation.x = 0.8; f.legs[1].hip.rotation.x = -0.8; }   // WHEEE tumbling
      // blink
      if (now > f.nextBlink) { f.nextBlink = now + 2000 + Math.random() * 4000; f.blinkT = now + 120; }
      for (const l of f.eyeLids) l.scale.y = now < (f.blinkT || 0) ? 0.012 : 0.0001;
      const neck = f.headP.clone(); neck.y -= 0.14;
      _side.set(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
      for (let i = 0; i < 2; i++) {
        const A = f.arms[i], sgn = i ? 1 : -1;
        f.gp[i] += (f.gpT[i] - f.gp[i]) * Math.min(1, dt * 18);
        _s.copy(neck).addScaledVector(_side, sgn * 0.13); _s.y -= 0.06;
        if (f.tb) _s.copy(neck);
        const hp = f.hP[i], d = Math.min(0.58, _s.distanceTo(hp));
        // elbow sags down and out
        A.E.lerpVectors(_s, hp, 0.5);
        _pole.copy(_side).multiplyScalar(sgn * 0.5); _pole.y = -1;
        A.E.addScaledVector(_pole.normalize(), Math.sqrt(Math.max(0, 0.29 * 0.29 - (d / 2) ** 2)));
        placeSeg(A.up, _s, A.E, 0.047); placeSeg(A.lo, A.E, hp, 0.04);
        A.el.position.copy(A.E);
        // glove cuff + oriented hand with curling fingers
        _fw.subVectors(hp, A.E).normalize();
        placeSeg(A.cuff, hp.clone().addScaledVector(_fw, -0.07), hp, 0.046);
        A.hand.position.copy(hp);
        A.hand.quaternion.setFromUnitVectors(UP, _fw);
        A.hand.rotateY(sgn * 1.4);
        curlHand(A.hand, f.gp[i], sgn);
      }
      _fw.set(0, 0, -1).applyQuaternion(f.q); _fw.y = 0;
      f.tag.position.set(f.headP.x, f.headP.y + 0.3, f.headP.z);
      f.beam.visible = f.light && !f.ghost;
      // ghosts are see-through, pale blue and glowing
      if (f.wasGhost !== f.ghost) {
        f.wasGhost = f.ghost;
        for (const root of f.parts) root.traverse((o) => {
          if (!o.isMesh || o.material === f.beam.material) return;
          if (!o.userData.m0) o.userData.m0 = o.material;
          o.material = f.ghost ? o.userData.m0.clone() : o.userData.m0;
          if (f.ghost) { o.material.transparent = true; o.material.opacity = 0.32; o.material.depthWrite = false; if (o.material.emissive) o.material.emissive.setHex(0x3a78c8); else o.material.color.lerp(new THREE.Color(0x9ac8ff), 0.6); }
        });
      }
      const show = !f.menu && !f.mon;
      for (const o of f.parts) o.visible = show;
      if (f.ghost && show) { f.body.position.y += Math.sin(now / 500 + f.phase) * 0.04; f.arms.forEach((a) => a.hand.position.y += 0); }
      f.monM.root.visible = f.mon && !f.menu;
      if (f.monM.root.visible) {   // a real Crawler body follows their head
        const hsp = f.lastHead ? Math.hypot(f.headP.x - f.lastHead.x, f.headP.z - f.lastHead.z) / Math.max(dt, 1e-3) : 0;
        (f.lastHead = f.lastHead || new THREE.Vector3()).copy(f.headP);
        f.monM.root.position.set(f.headP.x, Math.max(0, f.headP.y - 1.0), f.headP.z);
        f.monM.root.rotation.y = Math.atan2(_fw.x, _fw.z);
        f.monM.animate({ dt, spd: Math.min(5, hsp), hunting: true, lookAt: null, rear: 0, jaw: f.talk > 0 ? 0.5 : 0 });
      }
      // voice: louder when close, and their mouth moves while they talk
      if (f.audio && listener) {
        const d = listener.distanceTo(f.headP);
        f.audio.volume = Math.max(0.3, Math.min(1, 6 / (d + 3)));
      }
      f.talk = Math.max(0, f.talk - dt);
      f.mouth.scale.y = 1 + (f.talk > 0 ? Math.abs(Math.sin(performance.now() / 70)) * 5 : 0);
      if (performance.now() - f.seen > 8000) drop(f.id);
    }
  }

  // voice stream for a friend: a hidden <audio> plays it (works on Quest), plus a meter for the mouth
  let actx = null;
  function voice(id, stream) {
    const f = get(id);
    if (!f.audio) { f.audio = document.createElement('audio'); f.audio.autoplay = true; f.audio.playsInline = true; document.body.appendChild(f.audio); }
    f.audio.srcObject = stream;
    f.audio.play?.().catch(() => {});
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaStreamSource(stream), an = actx.createAnalyser();
      an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      clearInterval(f.meter);
      f.meter = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128));
        if (m > 14) f.talk = 0.2;
      }, 100);
    } catch (e) {}
  }
  function replayAll() {
    actx && actx.resume && actx.resume().catch(() => {});
    for (const f of list.values()) if (f.audio) f.audio.play?.().catch(() => {});
  }

  return { list, get, drop, pose, update, voice, replayAll };
}
