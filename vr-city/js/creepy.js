// Creepy stuff 😱: things that make Hollow Creek feel wrong.
// - It WATCHES you: you glimpse the Crawler standing still far away. Look right at it and it's gone.
// - Shadows: a tall thin figure flickers at the corner of your eye.
// - Sounds: whispers next to your ear, creaking, footsteps right behind you (nothing there),
//   a kid giggling, doors slamming, "la la la" from far away. Then long silences.
// None of this can catch you. Only the real Crawler can.
import * as THREE from 'three';
import { buildCrawlerModel } from './crawler.js';
import { groundAt } from './city.js';

export function makeCreepy(scene, SFX) {
  // the watcher: a second Crawler body, standing up, staring
  const watcher = buildCrawlerModel(1.35);
  watcher.root.visible = false;
  scene.add(watcher.root);
  const W = { on: false, t: 0, next: 35 + Math.random() * 30, pos: new THREE.Vector3(), seen: 0 };

  // the shadow figure: tall, thin, no face
  const shadowM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, fog: true });
  const shadow = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.7, 4, 8), shadowM); body.position.y = 1.05; shadow.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), shadowM); head.position.y = 2.15; head.scale.y = 1.3; shadow.add(head);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.2, 3, 6), shadowM); arm.position.set(s * 0.24, 1.2, 0); arm.rotation.z = s * 0.08; shadow.add(arm); }
  shadow.visible = false;
  scene.add(shadow);
  const SH = { t: 0, next: 50 + Math.random() * 40 };

  let soundT = 12;
  let quietT = 0;
  const _v = new THREE.Vector3(), _to = new THREE.Vector3(), _side = new THREE.Vector3();
  const around = (head, dir, dist, angle) => {   // a point `dist` away at `angle` from where you look
    const yaw = Math.atan2(dir.x, dir.z) + angle;
    _v.set(head.x + Math.sin(yaw) * dist, 0, head.z + Math.cos(yaw) * dist);
    _v.y = groundAt(_v.x, _v.z, 0.5);
    return _v;
  };

  // st = { head, dir, hunting, crawlerDist, ghost, inside }
  function update(dt, st) {
    const t = performance.now() / 1000;
    const calm = st.crawlerDist > 30;

    // --- the watcher ---
    if (!W.on) {
      W.next -= dt;
      if (W.next <= 0 && calm && !st.ghost) {
        // stand it 35-55 m away, off to the side of where you look
        const ang = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
        W.pos.copy(around(st.head, st.dir, 35 + Math.random() * 20, ang));
        W.on = true; W.t = 0; W.seen = 0;
        watcher.root.position.copy(W.pos);
        watcher.root.visible = true;
      }
    } else {
      W.t += dt;
      watcher.root.rotation.y = Math.atan2(st.head.x - W.pos.x, st.head.z - W.pos.z);
      watcher.animate({ dt, spd: 0, hunting: false, lookAt: st.head, rear: 1, jaw: 0 });
      _to.subVectors(W.pos, st.head).setY(0).normalize();
      const look = _to.dot(_v.set(st.dir.x, 0, st.dir.z).normalize());
      if (look > 0.97) W.seen += dt;   // you looked right at it...
      const d = st.head.distanceTo(W.pos);
      if (W.seen > 0.35 || W.t > 14 || d < 20 || !calm) {
        watcher.root.visible = false; W.on = false;
        W.next = 60 + Math.random() * 70;
        if (W.seen > 0.35) { SFX.whisper(around(st.head, st.dir, 1.2, Math.PI * 0.9).clone().setY(st.head.y)); quietT = 6; }
      }
    }

    // --- the shadow at the corner of your eye ---
    if (SH.t > 0) {
      SH.t -= dt;
      _to.subVectors(shadow.position, st.head).setY(0).normalize();
      const look = _to.dot(_v.set(st.dir.x, 0, st.dir.z).normalize());
      if (SH.t <= 0 || look > 0.85) { shadow.visible = false; SH.t = 0; }
    } else {
      SH.next -= dt;
      if (SH.next <= 0 && !st.ghost) {
        SH.next = 45 + Math.random() * 60;
        const p = around(st.head, st.dir, 9 + Math.random() * 8, (Math.random() < 0.5 ? -1 : 1) * (1.05 + Math.random() * 0.25));
        shadow.position.copy(p);
        shadow.rotation.y = Math.atan2(st.head.x - p.x, st.head.z - p.z);
        shadow.visible = true; SH.t = 0.8;
      }
    }

    // --- sounds, with long quiet gaps ---
    if (quietT > 0) { quietT -= dt; return; }
    soundT -= dt;
    if (soundT <= 0) {
      soundT = 10 + Math.random() * 18;
      const r = Math.random();
      const h = st.head;
      if (r < 0.2) SFX.whisper(around(h, st.dir, 1.0, Math.PI * (0.6 + Math.random() * 0.8)).clone().setY(h.y));
      else if (r < 0.38) SFX.creak(around(h, st.dir, 4 + Math.random() * 8, Math.random() * 6.28).clone().setY(2));
      else if (r < 0.55) {   // footsteps right behind you... nothing there
        for (let i = 0; i < 3; i++) setTimeout(() => SFX.step(around(h, st.dir, 4.5 - i * 0.8, Math.PI).clone(), i % 2 === 0), i * 420);
        quietT = 5;
      } else if (r < 0.68) SFX.giggle(around(h, st.dir, 25 + Math.random() * 20, Math.random() * 6.28).clone().setY(1));
      else if (r < 0.82) SFX.slam(around(h, st.dir, 30 + Math.random() * 30, Math.random() * 6.28).clone().setY(1));
      else if (!st.hunting) SFX.farSing(around(h, st.dir, 60 + Math.random() * 40, Math.random() * 6.28).clone().setY(2));
      if (Math.random() < 0.3) quietT = 15 + Math.random() * 15;   // then... silence
    }
    void t; void _side;
  }
  return { update };
}
