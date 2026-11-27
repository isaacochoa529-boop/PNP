// The Crawler: the one monster of Hollow Creek.
// Its brain runs on the host; everyone else gets its position 10 times a second and animates it.
// Model: a starved black thing on all fours. Long arms with claws, ribs, a spine of spikes,
// a jaw full of teeth and four red eyes. Its limbs walk with real foot placement (simple IK).
import * as THREE from 'three';
import { HALF, PITCH, nearSolids, groundAt, hideZoneAt } from './city.js';

const SKIN = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.42, metalness: 0.25 });
const BONE = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.6 });
const TOOTH = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
const MOUTH = new THREE.MeshBasicMaterial({ color: 0x2a0204 });
const EYE = new THREE.MeshBasicMaterial({ color: 0xff1020 });
const UP = new THREE.Vector3(0, 1, 0);
const SEG = new THREE.CylinderGeometry(1, 0.75, 1, 7, 1).translate(0, 0.5, 0);
const SPH = new THREE.SphereGeometry(1, 14, 10);
const CONE = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);

let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,40,40,1)'); g.addColorStop(0.3, 'rgba(255,0,0,0.4)'); g.addColorStop(1, 'rgba(255,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (glowTex = new THREE.CanvasTexture(c));
}

function mesh(geo, mat, parent, px, py, pz, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(px, py, pz); m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
const _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function placeSeg(m, a, b, r) {
  _d.subVectors(b, a);
  const L = _d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / Math.max(L, 1e-5)));
  m.scale.set(r, L, r);
}
// two-bone IK: from S to F with lengths a, b. pole says which way the elbow bends.
const _dir = new THREE.Vector3(), _pole = new THREE.Vector3(), _F = new THREE.Vector3();
function ik(S, F, a, b, pole, E) {
  _F.copy(F);
  _dir.subVectors(_F, S);
  let d = _dir.length();
  const maxD = (a + b) * 0.999;
  if (d > maxD) { _dir.multiplyScalar(maxD / d); _F.copy(S).add(_dir); d = maxD; }
  d = Math.max(d, 1e-4);
  _dir.multiplyScalar(1 / d);
  const ax = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - ax * ax));
  _pole.copy(pole).addScaledVector(_dir, -pole.dot(_dir)).normalize();
  E.copy(S).addScaledVector(_dir, ax).addScaledVector(_pole, h);
  return _F;
}

// ---------- the model (also used for the jumpscare) ----------
export function buildCrawlerModel(scale = 1.35) {
  const root = new THREE.Group();
  const body = new THREE.Group();   // everything above the feet; bobs and leans
  root.add(body);
  root.scale.setScalar(scale);

  // torso: chest, belly (thin, starved) and hips
  const chest = mesh(SPH, SKIN, body, 0, 0.82, 0.28, 0.24, 0.2, 0.3);
  mesh(SPH, SKIN, body, 0, 0.78, -0.08, 0.14, 0.13, 0.28);
  const hips = mesh(SPH, SKIN, body, 0, 0.76, -0.42, 0.2, 0.16, 0.18);
  void chest; void hips;
  // ribs poking out
  const RIB = new THREE.TorusGeometry(1, 0.06, 5, 12, Math.PI);
  for (let i = 0; i < 5; i++) {
    const r = mesh(RIB, BONE, body, 0, 0.8, 0.42 - i * 0.09, 0.21 - i * 0.012, 0.2 - i * 0.01, 0.2);
    r.rotation.set(0, 0, Math.PI);   // arch hangs under the body
    r.rotation.x = 0.1;
  }
  // spine of spikes along the back
  for (let i = 0; i < 9; i++) {
    const z = 0.5 - i * 0.12, h = 0.06 + Math.sin(i / 8 * Math.PI) * 0.07;
    const s = mesh(CONE, BONE, body, 0, 0.95 + Math.sin(i / 8 * Math.PI) * 0.05 - (i > 6 ? 0.05 : 0), z, 0.025, h, 0.025);
    s.rotation.x = -0.5;
  }
  // a thin tail dragging behind
  const tail = [];
  let tp = new THREE.Vector3(0, 0.74, -0.58);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(SEG, SKIN); body.add(m);
    tail.push({ m, a: tp.clone() });
    tp = tp.clone().add(new THREE.Vector3(0, -0.08, -0.16));
  }

  // neck + head
  const neck = mesh(SEG, SKIN, body, 0, 0.86, 0.5, 0.06, 0.3, 0.06);
  neck.rotation.x = 1.2;
  const head = new THREE.Group();
  head.position.set(0, 0.97, 0.78);
  body.add(head);
  mesh(SPH, SKIN, head, 0, 0.02, 0.05, 0.14, 0.12, 0.2);   // skull
  mesh(SPH, SKIN, head, 0, 0.07, 0.0, 0.15, 0.06, 0.12);   // heavy brow
  // upper teeth + mouth inside
  mesh(SPH, MOUTH, head, 0, -0.04, 0.12, 0.1, 0.05, 0.12);
  const TEETH = new THREE.ConeGeometry(0.012, 0.06, 4).rotateX(Math.PI);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * 2.2;
    const t = mesh(TEETH, TOOTH, head, Math.sin(a) * 0.095, -0.05, 0.1 + Math.cos(a) * 0.12, 1, 1 + (i % 2) * 0.6, 1);
    void t;
  }
  // the jaw hinges open
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.04, -0.02);
  head.add(jaw);
  mesh(SPH, SKIN, jaw, 0, -0.03, 0.12, 0.11, 0.04, 0.17);
  const LT = new THREE.ConeGeometry(0.011, 0.055, 4);
  for (let i = 0; i < 8; i++) {
    const a = (i / 7 - 0.5) * 2.1;
    mesh(LT, TOOTH, jaw, Math.sin(a) * 0.085, 0.0, 0.12 + Math.cos(a) * 0.12, 1, 1 + ((i + 1) % 2) * 0.5, 1);
  }
  // four red eyes, two big two small, with a glow
  const eyes = [];
  for (const [x, y, z, s] of [[-0.07, 0.04, 0.2, 0.026], [0.07, 0.04, 0.2, 0.026], [-0.105, 0.075, 0.13, 0.016], [0.105, 0.075, 0.13, 0.016]]) {
    eyes.push(mesh(SPH, EYE, head, x, y, z, s, s * 0.8, s));
  }
  const glowM = new THREE.SpriteMaterial({ map: glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
  for (const s of [-1, 1]) {
    const g = new THREE.Sprite(glowM);
    g.position.set(s * 0.07, 0.04, 0.22);
    g.scale.set(0.16, 0.16, 1);
    head.add(g);
  }

  // limbs: two long arms in front, two bent legs behind
  const limbs = [];
  const mkLimb = (side, front) => {
    const shoulder = new THREE.Vector3(side * (front ? 0.2 : 0.17), front ? 0.82 : 0.76, front ? 0.36 : -0.44);
    const home = new THREE.Vector3(side * (front ? 0.62 : 0.5), 0, front ? 0.86 : -0.38);
    const a = front ? 0.62 : 0.5, b = front ? 0.66 : 0.55;
    const up = new THREE.Mesh(SEG, SKIN), lo = new THREE.Mesh(SEG, SKIN);
    body.add(up, lo);
    const joint = mesh(SPH, BONE, body, 0, 0, 0, 0.045, 0.045, 0.045);
    // a clawed hand / foot
    const hand = new THREE.Group();
    body.add(hand);
    mesh(SPH, SKIN, hand, 0, 0.03, 0, 0.06, 0.03, 0.07);
    const CLAW = new THREE.ConeGeometry(0.012, 1, 4).translate(0, 0.5, 0);
    for (let i = 0; i < 4; i++) {
      const ang = (i / 3 - 0.5) * 1.1;
      const f = mesh(CLAW, i === 0 ? BONE : SKIN, hand, Math.sin(ang) * 0.04, 0.02, 0.04, 1, front ? 0.22 : 0.13, 1);
      f.rotation.set(Math.PI / 2 - 0.25, 0, -ang);
      const cl = mesh(CLAW, BONE, f, 0, 1, 0, 0.8, 0.35, 0.8);
      cl.rotation.x = 0.5;
    }
    const pole = new THREE.Vector3(side * 0.6, 1, front ? -0.2 : 0.6).normalize();   // arms: elbows up and out; legs: knees up and forward
    const L = { side, front, shoulder, home, a, b, up, lo, joint, hand, pole,
      off: (front ? 0 : 0.5) + (side > 0 ? 0.5 : 0), foot: home.clone(), E: new THREE.Vector3(), down: true };
    limbs.push(L);
  };
  mkLimb(-1, true); mkLimb(1, true); mkLimb(-1, false); mkLimb(1, false);

  const st = { ph: 0, twitch: new THREE.Euler(), twitchT: 0, jaw: 0, look: new THREE.Vector3(), rear: 0 };
  const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _w = new THREE.Vector3();

  // a = { spd, dt, hunting, jaw (0..1 extra), lookAt (world pos or null), rear (0..1), onStep(worldPos) }
  function animate(a) {
    const dt = a.dt;
    const w = Math.min(1, a.spd / 1.4);
    st.ph += dt * (0.4 + a.spd * 0.9);
    const bob = Math.sin(st.ph * Math.PI * 4) * 0.025 * w;
    body.position.y = bob - st.rear * 0.0;
    body.rotation.z = Math.sin(st.ph * Math.PI * 2) * 0.06 * w;
    st.rear += ((a.rear || 0) - st.rear) * Math.min(1, dt * 6);
    body.rotation.x = -st.rear * 0.55 + (a.hunting ? 0.08 : 0);   // rears up onto its back legs
    body.position.z = -st.rear * 0.2;
    root.updateMatrixWorld();
    // legs + arms
    for (const L of limbs) {
      const t = ((st.ph + L.off) % 1 + 1) % 1;
      const stride = 0.55 * w, lift = (L.front ? 0.22 : 0.16) * Math.max(w, 0.15);
      let fz, fy;
      if (t < 0.62) { fz = stride / 2 - (t / 0.62) * stride; fy = 0; }
      else { const u = (t - 0.62) / 0.38; fz = -stride / 2 + u * stride; fy = Math.sin(u * Math.PI) * lift; }
      const down = fy <= 0.001;
      if (down && !L.down && a.onStep && w > 0.1) a.onStep(L.hand.getWorldPosition(_w), L.front);
      L.down = down;
      _T.set(L.home.x, fy, L.home.z + fz);
      if (L.front && st.rear > 0.05) { _T.y += st.rear * 0.9; _T.z += st.rear * 0.15; _T.x *= 1 + st.rear * 0.3; }   // claws up!
      // the body leans, so bring the target into body space
      body.worldToLocal(root.localToWorld(_T));
      _S.copy(L.shoulder);
      const F = ik(_S, _T, L.a, L.b, L.pole, L.E);
      placeSeg(L.up, _S, L.E, L.front ? 0.04 : 0.055);
      placeSeg(L.lo, L.E, F, L.front ? 0.03 : 0.04);
      L.joint.position.copy(L.E);
      L.hand.position.copy(F);
      L.hand.rotation.set(0, L.side * 0.25, 0);
    }
    // tail sways
    let prev = tail[0].a.clone();
    for (let i = 0; i < tail.length; i++) {
      const sw = Math.sin(st.ph * Math.PI * 2 - i * 0.6) * 0.06 * (i + 1) * (0.3 + w);
      const nxt = new THREE.Vector3(sw, Math.max(0.02 - body.position.y, 0.74 - (i + 1) * 0.12), -0.58 - (i + 1) * 0.15);
      placeSeg(tail[i].m, prev, nxt, 0.035 * (1 - i / tail.length) + 0.008);
      prev = nxt;
    }
    // head: looks at you, with sudden twitches
    st.twitchT -= dt;
    if (st.twitchT <= 0) {
      st.twitchT = 0.3 + Math.random() * (a.hunting ? 0.8 : 2.2);
      st.twitch.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 1.2);
    }
    let yaw = 0, pitch = 0;
    if (a.lookAt) {
      head.parent.worldToLocal(_w.copy(a.lookAt));
      _w.sub(head.position);
      yaw = Math.max(-1.2, Math.min(1.2, Math.atan2(_w.x, _w.z)));
      pitch = Math.max(-0.8, Math.min(0.8, -Math.atan2(_w.y, Math.hypot(_w.x, _w.z))));
    }
    const k = Math.min(1, dt * 18);   // fast = creepy
    head.rotation.x += (pitch + st.twitch.x * 0.4 - head.rotation.x) * k;
    head.rotation.y += (yaw + st.twitch.y * 0.4 - head.rotation.y) * k;
    head.rotation.z += (st.twitch.z * (a.hunting ? 0.5 : 0.9) - head.rotation.z) * k;
    // jaw
    const wantJaw = Math.min(1, (a.hunting ? 0.35 + Math.abs(Math.sin(performance.now() / 90)) * 0.15 : 0.08) + (a.jaw || 0));
    st.jaw += (wantJaw - st.jaw) * Math.min(1, dt * 14);
    jaw.rotation.x = st.jaw * 0.75;
  }
  return { root, body, head, jaw, eyes, animate };
}

// ---------- the brain + network ----------
export function makeCrawler(scene, hooks = {}) {
  const model = buildCrawlerModel(1.35);
  const root = model.root;
  root.visible = false;
  scene.add(root);
  const eyeLight = new THREE.PointLight(0xff1a2a, 0, 9, 2);
  scene.add(eyeLight);

  const C = {
    pos: new THREE.Vector3(), vis: new THREE.Vector3(), vy: 0,
    yaw: 0, visYaw: 0, pitch: 0, visPitch: 0, mode: 'wander', spd: 0,
    goal: new THREE.Vector3(), target: null,
    singT: 10, scaredT: 0, flee: new THREE.Vector2(), lastSeen: -1e9, lastSeenPos: new THREE.Vector3(),
    stalkT: 20, stalkWho: null, lungeT: 0, lungeCd: 0, rearT: 0, roarCd: 0,
    stuckT: 0, stuckFrom: new THREE.Vector3(), detourT: 0, detour: new THREE.Vector2(),
    climbing: false, entering: null, exiting: null, sniffT: 0, jaw: 0, singFx: 0,
  };
  const R = 0.45;   // body radius

  const onStreet = () => {
    // random point in the middle of a street
    const k = Math.floor(Math.random() * 7) - 3, a = (Math.random() * 2 - 1) * HALF * 0.85;
    const line = k * PITCH + PITCH / 2;
    return Math.random() < 0.5 ? new THREE.Vector3(line, 0, a) : new THREE.Vector3(a, 0, line);
  };

  function reset(x, z) {
    C.pos.set(x, 0, z); C.vis.copy(C.pos); C.vy = 0;
    C.goal.copy(onStreet());
    C.mode = 'wander'; C.scaredT = 0; C.lastSeen = -1e9; C.spd = 0; C.climbing = false;
    C.stalkT = 25 + Math.random() * 15; C.entering = C.exiting = null; C.sniffT = 0; C.rearT = 0;
    root.visible = true;
  }
  function spawnSpot(awayFrom) {
    for (let i = 0; i < 40; i++) {
      const p = onStreet();
      if (Math.hypot(p.x - awayFrom.x, p.z - awayFrom.z) > 80) return p;
    }
    return new THREE.Vector3(HALF * 0.8, 0, HALF * 0.8);
  }

  // which solid boxes block the body at height y (low stuff it just climbs over)
  const near = [];
  function blockedAt(x, z, y) {
    for (const b of nearSolids(x, z, R + 0.1, near)) {
      if (b.y1 <= y + 1.5 || b.y0 >= y + 1.1) continue;
      const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
      if ((x - cx) ** 2 + (z - cz) ** 2 < R * R) return b;
    }
    return null;
  }

  // Where to walk next: through doors when going in or out of buildings
  function waypoint(goal, goalZone) {
    const here = hideZoneAt({ x: C.pos.x, y: C.pos.y + 0.5, z: C.pos.z });
    if (here && here !== goalZone) {
      const d = here.door;
      if (C.exiting !== here && Math.hypot(C.pos.x - d.ix, C.pos.z - d.iz) > 1.0) return [d.ix, d.iz];
      C.exiting = here;
      return [d.ox, d.oz];
    }
    C.exiting = null;
    if (goalZone && here !== goalZone) {
      const d = goalZone.door;
      if (C.entering !== goalZone && Math.hypot(C.pos.x - d.ox, C.pos.z - d.oz) > 1.0) return [d.ox, d.oz];
      C.entering = goalZone;
      return [d.ix, d.iz];
    }
    C.entering = null;
    return [goal.x, goal.z];
  }

  // Host only. world = { players:[{id,pos,dir,hidden,hideT,ghost}], hunting, red, lights:[{pos,dir,on}], flares:[{x,z}] }
  function update(dt, now, world) {
    const ev = [];
    C.scaredT = Math.max(0, C.scaredT - dt);
    C.lungeT = Math.max(0, C.lungeT - dt);
    C.lungeCd = Math.max(0, C.lungeCd - dt);
    C.rearT = Math.max(0, C.rearT - dt);
    C.roarCd = Math.max(0, C.roarCd - dt);
    const alive = world.players.filter((p) => !p.ghost);

    // 1) Light hurts it (not on RED nights): a headlight pointed at it makes it run
    if (!world.red) {
      for (const L of world.lights) {
        if (!L.on) continue;
        const dx = C.pos.x - L.pos.x, dz = C.pos.z - L.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.1 && d < 22) {
          const fl = Math.hypot(L.dir.x, L.dir.z) || 1, dot = (dx * L.dir.x + dz * L.dir.z) / (d * fl);
          if (dot > 0.85) {
            if (C.scaredT <= 0) ev.push({ k: 'hiss', x: C.pos.x, y: C.pos.y, z: C.pos.z });
            C.scaredT = 2.8; C.flee.set(dx / d, dz / d);
          }
        }
      }
    }
    // flares: it won't go near them
    for (const f of world.flares) {
      const dx = C.pos.x - f.x, dz = C.pos.z - f.z, d = Math.hypot(dx, dz);
      if (d < 9 && d > 0.01) {
        if (C.scaredT <= 0.5) { C.scaredT = 1.5; C.flee.set(dx / d, dz / d); if (Math.random() < 0.02) ev.push({ k: 'hiss', x: C.pos.x, y: C.pos.y, z: C.pos.z }); }
      }
    }

    // 2) Who can it see?
    let best = null, bestD = 1e9;
    if (world.hunting) {
      for (const p of alive) {
        const d = Math.hypot(p.pos.x - C.pos.x, p.pos.z - C.pos.z);
        const smelled = p.hidden && p.hideT > 40;
        const seen = world.red || smelled || (!p.hidden && d < 48);
        if (seen && d < bestD) { best = p; bestD = d; }
      }
    }
    if (best) {
      if (C.mode !== 'hunt' && C.roarCd <= 0) { ev.push({ k: 'roar', x: C.pos.x, y: C.pos.y, z: C.pos.z }); C.rearT = 1.2; C.roarCd = 12; }
      C.mode = 'hunt';
      C.target = best;
      C.lastSeen = now;
      C.lastSeenPos.copy(best.pos);
    } else if (C.mode === 'hunt') {
      // lost you: go to where you were last seen and sniff around
      C.mode = 'sniff'; C.sniffT = 7; C.target = null;
    }
    if (C.mode === 'sniff') {
      C.sniffT -= dt;
      if (C.sniffT <= 0) { C.mode = 'wander'; C.goal.copy(onStreet()); }
    }
    // not hunting: wander, and sometimes stalk someone from behind
    if (!world.hunting && (C.mode === 'hunt' || C.mode === 'sniff')) { C.mode = 'wander'; C.goal.copy(onStreet()); }
    if (C.mode === 'wander' || C.mode === 'stalk') {
      C.stalkT -= dt;
      if (C.stalkT <= 0) {
        if (C.mode === 'wander' && alive.length) {
          C.mode = 'stalk'; C.stalkWho = alive[Math.floor(Math.random() * alive.length)].id; C.stalkT = 25 + Math.random() * 20;
        } else { C.mode = 'wander'; C.goal.copy(onStreet()); C.stalkT = 20 + Math.random() * 20; }
      }
    }

    // 3) Where is it heading?
    let gx, gz, goalZone = null, spd;
    if (C.mode === 'hunt' && C.target) {
      gx = C.target.pos.x; gz = C.target.pos.z;
      goalZone = hideZoneAt(C.target.pos);
      const d = Math.hypot(gx - C.pos.x, gz - C.pos.z);
      if (d < 7 && C.lungeCd <= 0 && Math.abs(C.target.pos.y - C.pos.y) < 2) { C.lungeT = 0.8; C.lungeCd = 3.2; ev.push({ k: 'lunge', x: C.pos.x, y: C.pos.y, z: C.pos.z }); }
      spd = C.lungeT > 0 ? 5.4 : world.red ? 3.4 : 3.2;
    } else if (C.mode === 'sniff') {
      gx = C.lastSeenPos.x; gz = C.lastSeenPos.z;
      spd = Math.hypot(gx - C.pos.x, gz - C.pos.z) > 2 ? 2.2 : 0;
    } else if (C.mode === 'stalk') {
      const p = alive.find((q) => q.id === C.stalkWho);
      if (!p) { C.mode = 'wander'; C.goal.copy(onStreet()); gx = C.goal.x; gz = C.goal.z; spd = 1.2; }
      else {
        const fl = Math.hypot(p.dir.x, p.dir.z) || 1;
        gx = p.pos.x - (p.dir.x / fl) * 15; gz = p.pos.z - (p.dir.z / fl) * 15;   // 15 m behind you
        const d = Math.hypot(gx - C.pos.x, gz - C.pos.z);
        spd = d > 3 ? 2.6 : 0;
      }
    } else {
      if (Math.hypot(C.goal.x - C.pos.x, C.goal.z - C.pos.z) < 2) C.goal.copy(onStreet());
      gx = C.goal.x; gz = C.goal.z; spd = 1.3;
    }
    // stay away from flares
    for (const f of world.flares) {
      const dx = gx - f.x, dz = gz - f.z, d = Math.hypot(dx, dz);
      if (d < 9) { const k = 9 / Math.max(d, 0.01); gx = f.x + dx * k; gz = f.z + dz * k; }
    }
    if (C.rearT > 0) spd = 0;

    let dx, dz;
    if (C.scaredT > 0) { dx = C.flee.x; dz = C.flee.y; spd = 4.6; }
    else {
      const [wx, wz] = waypoint({ x: gx, z: gz }, goalZone);
      const ddx = wx - C.pos.x, ddz = wz - C.pos.z, d = Math.hypot(ddx, ddz) || 1;
      dx = ddx / d; dz = ddz / d;
      if (C.mode === 'hunt' && d < 1.0 && !goalZone) spd = 0.6;
    }
    // stuck? take a short detour sideways
    if (C.detourT > 0) { C.detourT -= dt; dx = C.detour.x; dz = C.detour.y; }

    // 4) Move, slide along walls, climb when needed
    C.spd += (spd - C.spd) * Math.min(1, dt * 4);
    const step = C.spd * dt;
    if (C.climbing) {
      C.pos.y += 2.3 * dt;
      const b = blockedAt(C.pos.x + dx * 0.3, C.pos.z + dz * 0.3, C.pos.y);
      if (!b) { C.climbing = false; C.pos.x += dx * 0.6; C.pos.z += dz * 0.6; }
      if (C.pos.y > 40) C.climbing = false;
    } else if (step > 0) {
      const nx = C.pos.x + dx * step, nz = C.pos.z + dz * step;
      const bx = blockedAt(nx, C.pos.z, C.pos.y), bz = blockedAt(C.pos.x, nz, C.pos.y);
      if (!bx) C.pos.x = nx;
      if (!bz) C.pos.z = nz;
      // climb a wall when its target is up on a roof (or it has been stuck a while)
      const wantUp = C.mode === 'hunt' && C.target && C.target.pos.y - C.pos.y > 2.2;
      if ((bx || bz) && (wantUp || C.stuckT > 3) && !hideZoneAt({ x: C.pos.x, y: C.pos.y + 0.5, z: C.pos.z })) {
        C.climbing = true; C.stuckT = 0;
        ev.push({ k: 'climb', x: C.pos.x, y: C.pos.y, z: C.pos.z });
      }
    }
    C.pos.x = Math.max(-HALF + 1, Math.min(HALF - 1, C.pos.x));
    C.pos.z = Math.max(-HALF + 1, Math.min(HALF - 1, C.pos.z));
    // fall / step onto things
    if (!C.climbing) {
      const g = groundAt(C.pos.x, C.pos.z, C.pos.y + 1.0);
      if (C.pos.y > g + 0.05) { C.vy -= 14 * dt; C.pos.y = Math.max(g, C.pos.y + C.vy * dt); }
      else { C.pos.y += (g - C.pos.y) * Math.min(1, dt * 10); C.vy = 0; }
    }
    // stuck check
    if (C.spd > 0.6 && !C.climbing) {
      if (C.stuckFrom.distanceTo(C.pos) < 0.4) {
        C.stuckT += dt;
        if (C.stuckT > 1.5 && C.detourT <= 0) {
          const s = Math.random() < 0.5 ? -1 : 1;
          C.detour.set(-dz * s + dx * -0.3, dx * s + dz * -0.3).normalize();
          C.detourT = 1.4;
        }
      } else { C.stuckFrom.copy(C.pos); C.stuckT = 0; }
    }
    const want = Math.atan2(dx, dz);
    let da = want - C.yaw;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    C.yaw += da * Math.min(1, dt * 6);
    C.pitch = C.climbing ? -Math.PI / 2 : 0;

    // 5) singing
    C.singT -= dt;
    if (C.singT <= 0) {
      C.singT = C.mode === 'hunt' ? 8 + Math.random() * 6 : 14 + Math.random() * 16;
      ev.push({ k: 'sing', x: C.pos.x, y: C.pos.y + 1, z: C.pos.z });
    }

    // 6) caught someone?
    for (const p of alive) {
      const dxy = Math.hypot(p.pos.x - C.pos.x, p.pos.z - C.pos.z), dy = p.pos.y - (C.pos.y + 0.9);
      if (dxy < 1.35 && Math.abs(dy) < 1.4) { ev.push({ k: 'catch', who: p.id }); break; }
    }
    return ev;
  }

  // Everyone: draw it smoothly and animate the body
  let lookAt = null;
  function show(dt, looker, onStep) {
    C.vis.lerp(C.pos, Math.min(1, dt * 10));
    let da = C.yaw - C.visYaw; da = Math.atan2(Math.sin(da), Math.cos(da));
    C.visYaw += da * Math.min(1, dt * 10);
    C.visPitch += (C.pitch - C.visPitch) * Math.min(1, dt * 6);
    root.position.copy(C.vis);
    root.rotation.set(0, C.visYaw, 0);
    root.rotateX(C.visPitch);
    if (C.climbing) root.position.y += 0.3;
    lookAt = looker && looker.distanceTo(C.vis) < 25 ? looker : null;
    C.singFx = Math.max(0, C.singFx - dt);
    model.animate({ dt, spd: C.climbing ? 2 : C.spd, hunting: C.mode === 'hunt', lookAt, rear: C.rearT > 0 ? 1 : 0,
      jaw: C.singFx > 0 ? Math.abs(Math.sin(C.singFx * 8.7)) * 0.6 : 0, onStep });
    const hunting = C.mode === 'hunt';
    eyeLight.position.copy(model.head.getWorldPosition(_d));
    eyeLight.intensity = root.visible ? (hunting ? 2.6 : 1.0) : 0;
  }
  function sang() { C.singFx = 1.1; }

  function snapshot() {
    return { x: +C.pos.x.toFixed(2), y: +C.pos.y.toFixed(2), z: +C.pos.z.toFixed(2), yaw: +C.yaw.toFixed(2), mode: C.mode, spd: +C.spd.toFixed(2), cl: C.climbing ? 1 : 0, r: C.rearT > 0 ? 1 : 0 };
  }
  function applyRemote(m) {
    C.pos.set(m.x, m.y || 0, m.z);
    C.yaw = m.yaw; C.mode = m.mode; C.spd = m.spd; C.climbing = !!m.cl; C.pitch = m.cl ? -Math.PI / 2 : 0; C.rearT = m.r ? 0.2 : 0;
    if (!root.visible) { root.visible = true; C.vis.copy(C.pos); }
  }

  return { reset, update, show, snapshot, applyRemote, sang, spawnSpot, C, model };
}
