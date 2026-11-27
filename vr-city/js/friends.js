// Your friends in the city: a body that follows their head, two gloved hands with arms,
// a glowing head lamp with a light beam, a name tag, and their voice coming from their mouth.
import * as THREE from 'three';

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

export function makeFriends(scene, beamMat) {
  const list = new Map();
  const glove = new THREE.MeshLambertMaterial({ color: 0x111116 });

  function make(id, name) {
    const col = colorFor(id);
    const jacket = new THREE.MeshLambertMaterial({ color: col });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8b090 });
    const g = new THREE.Group();
    // head: face, hair, eyes, and a head lamp
    const head = new THREE.Group();
    g.add(head);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), skin); face.scale.set(1, 1.15, 1); head.add(face);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x2a1a10 }));
    hair.position.y = 0.02; head.add(hair);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), eyeM); e.position.set(s * 0.04, 0.02, -0.1); head.add(e); }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), eyeM); mouth.position.set(0, -0.045, -0.105); head.add(mouth);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.117, 0.012, 6, 20), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    strap.rotation.x = Math.PI / 2; strap.position.y = 0.04; head.add(strap);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.04, 10), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 0.05, -0.12); head.add(lamp);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 14, 1, true).translate(0, -4.5, 0).rotateX(-Math.PI / 2), beamMat);
    beam.position.set(0, 0.05, -0.13); head.add(beam);
    // body: jacket torso, hips, backpack
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.26, 4, 10), jacket);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.1), new THREE.MeshLambertMaterial({ color: 0x3a3020 }));
    g.add(torso, pack);
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.2, 4, 8), new THREE.MeshLambertMaterial({ color: 0x22283a }));
    g.add(legs);
    // arms + gloves
    const arms = [0, 1].map(() => {
      const up = new THREE.Mesh(SEG, jacket), lo = new THREE.Mesh(SEG, jacket);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), glove);
      g.add(up, lo, hand);
      return { up, lo, hand, E: new THREE.Vector3() };
    });
    const tag = label(name);
    g.add(tag);
    scene.add(g);
    return { id, name, g, head, torso, pack, legs, arms, tag, beam, mouth,
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
    scene.remove(f.g);
    if (f.audio) { try { f.audio.srcObject = null; f.audio.remove(); } catch (e) {} }
    list.delete(id);
  }
  // pose message: h = head xyz + quat, l / r = hand xyz
  function pose(m) {
    const f = get(m.id, m.n);
    f.headT.fromArray(m.h, 0); f.qT.fromArray(m.h, 3);
    f.hT[0].fromArray(m.l); f.hT[1].fromArray(m.r);
    f.ghost = !!m.g; f.light = !!m.lt; f.hidden = !!m.hd; f.hideT = m.ht || 0; f.menu = !!m.m;
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
      const neck = f.headP.clone(); neck.y -= 0.16;
      f.torso.position.set(neck.x, neck.y - 0.22, neck.z); f.torso.rotation.set(0, f.yaw, 0);
      f.pack.position.set(neck.x + Math.sin(f.yaw) * 0.15, neck.y - 0.2, neck.z + Math.cos(f.yaw) * 0.15); f.pack.rotation.y = f.yaw;
      f.legs.position.set(neck.x, neck.y - 0.6, neck.z); f.legs.rotation.y = f.yaw;
      _side.set(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
      for (let i = 0; i < 2; i++) {
        const A = f.arms[i], sgn = i ? 1 : -1;
        _s.copy(neck).addScaledVector(_side, sgn * 0.17); _s.y -= 0.05;
        const hp = f.hP[i], d = Math.min(0.62, _s.distanceTo(hp));
        // elbow sags down and out
        A.E.lerpVectors(_s, hp, 0.5);
        _pole.copy(_side).multiplyScalar(sgn * 0.5); _pole.y = -1;
        A.E.addScaledVector(_pole.normalize(), Math.sqrt(Math.max(0, 0.31 * 0.31 - (d / 2) ** 2)));
        placeSeg(A.up, _s, A.E, 0.045); placeSeg(A.lo, A.E, hp, 0.04);
        A.hand.position.copy(hp);
      }
      f.tag.position.set(f.headP.x, f.headP.y + 0.3, f.headP.z);
      f.beam.visible = f.light && !f.ghost;
      // ghosts are see-through and blue
      if (f.wasGhost !== f.ghost) {
        f.wasGhost = f.ghost;
        f.g.traverse((o) => { if (o.isMesh && o.material !== f.beam.material) { o.material = o.material.clone(); o.material.transparent = f.ghost; o.material.opacity = f.ghost ? 0.3 : 1; } });
      }
      f.g.visible = !f.menu;
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
