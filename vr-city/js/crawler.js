// The Crawler: the one monster. Its brain runs on the host; everyone else just watches it.
import * as THREE from 'three';
import { HALF } from './city.js';

const BLACK = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.6, metalness: 0.1 });
const EYE = new THREE.MeshBasicMaterial({ color: 0xff1a2a });

export function makeCrawler(scene) {
  const root = new THREE.Group();
  root.visible = false;   // hidden until a round starts
  scene.add(root);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), BLACK);
  body.scale.set(0.62, 0.42, 1.2);
  body.position.y = 0.62;
  root.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), BLACK);
  head.position.set(0, 0.66, 1.0);
  root.add(head);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), EYE);
    eye.position.set(0.1 * s, 0.72, 1.22);
    root.add(eye);
  }
  const eyeLight = new THREE.PointLight(0xff1a2a, 1.2, 7, 2);
  eyeLight.position.set(0, 0.7, 1.3);
  root.add(eyeLight);

  // six long legs, splayed out like a spider
  const UP = new THREE.CylinderGeometry(0.05, 0.035, 0.5, 6); UP.translate(0, -0.25, 0);
  const LO = new THREE.CylinderGeometry(0.035, 0.02, 0.5, 6); LO.translate(0, -0.25, 0);
  const legs = [];
  for (const z of [0.55, 0.0, -0.5]) {
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.3 * s, 0.55, z);
      hip.rotation.z = s * 0.6;
      hip.add(new THREE.Mesh(UP, BLACK));
      const knee = new THREE.Group();
      knee.position.set(0, -0.5, 0);
      knee.rotation.z = s * 0.55;
      knee.add(new THREE.Mesh(LO, BLACK));
      hip.add(knee);
      root.add(hip);
      legs.push({ hip, knee, s, ph: z * 3 + (s > 0 ? 0 : Math.PI) });
    }
  }

  const pickGoal = () => new THREE.Vector3((Math.random() * 2 - 1) * HALF * 0.85, 0, (Math.random() * 2 - 1) * HALF * 0.85);
  const clampH = (v) => Math.max(-HALF, Math.min(HALF, v));

  const C = {
    pos: new THREE.Vector3(),   // where the brain says it is
    vis: new THREE.Vector3(),   // where it is drawn (smoothed)
    yaw: 0, mode: 'wander', spd: 0,
    goal: new THREE.Vector3(),
    ph: 0, stepAcc: 0, singT: 12,
    scaredT: 0, flee: new THREE.Vector2(), lastSeen: -1e9,
  };

  function reset(x, z) {
    C.pos.set(x, 0, z);
    C.vis.copy(C.pos);
    C.goal.copy(pickGoal());
    C.mode = 'wander'; C.scaredT = 0; C.lastSeen = -1e9; C.spd = 0;
    root.visible = true;
  }

  // Host only: decides what the monster does. world = {players, hunting, red, lights}
  function update(dt, now, world) {
    const events = [];
    C.scaredT = Math.max(0, C.scaredT - dt);

    // 1) Light hurts it: a headlight pointed at it makes it back away.
    for (const L of world.lights) {
      if (!L.on) continue;
      const dx = C.pos.x - L.pos.x, dz = C.pos.z - L.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.1 && d < 18) {
        const fl = Math.hypot(L.dir.x, L.dir.z) || 1;
        const dot = (dx * L.dir.x + dz * L.dir.z) / (d * fl);
        if (dot > 0.8) { C.scaredT = 2.5; C.flee.set(dx / d, dz / d); }
      }
    }

    // 2) Hunting: once the battery dies (or it's a RED LIGHTS round) it goes after people it can see.
    if (world.hunting) {
      let best = null, bestD = 1e9;
      for (const p of world.players) {
        const d = Math.hypot(p.pos.x - C.pos.x, p.pos.z - C.pos.z);
        const seen = world.red || (!p.hidden && d < 40);
        if (seen && d < bestD) { best = p; bestD = d; }
      }
      if (best) {
        C.lastSeen = now;
        C.goal.set(best.pos.x, 0, best.pos.z);
        C.mode = 'hunt';
      } else if (C.mode === 'hunt' && now - C.lastSeen > 8000) {
        C.mode = 'wander'; C.goal.copy(pickGoal());
      }
    } else if (C.mode === 'hunt') {
      C.mode = 'wander'; C.goal.copy(pickGoal());
    }

    // 3) Movement
    let dx, dz, spd;
    if (C.scaredT > 0) {
      dx = C.flee.x; dz = C.flee.y; spd = 4.2; C.mode = 'scared';
    } else {
      if (C.mode === 'scared') C.mode = world.hunting ? 'hunt' : 'wander';
      let gx = C.goal.x - C.pos.x, gz = C.goal.z - C.pos.z, gd = Math.hypot(gx, gz);
      if (C.mode === 'wander' && gd < 2) {
        C.goal.copy(pickGoal());
        gx = C.goal.x - C.pos.x; gz = C.goal.z - C.pos.z; gd = Math.hypot(gx, gz);
      }
      dx = gx / (gd || 1); dz = gz / (gd || 1);
      spd = C.mode === 'hunt' ? 3.6 : 1.3;
      if (C.mode === 'hunt' && gd < 1.2) spd = 0;
    }
    C.spd += (spd - C.spd) * Math.min(1, dt * 3);
    C.pos.x = clampH(C.pos.x + dx * C.spd * dt);
    C.pos.z = clampH(C.pos.z + dz * C.spd * dt);
    const want = Math.atan2(dx, dz);
    let da = want - C.yaw;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    C.yaw += da * Math.min(1, dt * 5);

    // 4) Sounds the players hear: footsteps every ~1.4 m, and the creepy "la la la"
    C.stepAcc += C.spd * dt;
    if (C.stepAcc > 1.4) { C.stepAcc = 0; events.push({ k: 'step', x: C.pos.x, z: C.pos.z }); }
    C.singT -= dt;
    if (C.singT <= 0) {
      C.singT = 14 + Math.random() * 16;
      events.push({ k: 'sing', x: C.pos.x, z: C.pos.z });
    }

    // 5) Caught: someone is close enough
    for (const p of world.players) {
      if (Math.hypot(p.pos.x - C.pos.x, p.pos.z - C.pos.z) < 1.3) { events.push({ k: 'catch', who: p.id }); break; }
    }
    return events;
  }

  // Everyone: draw the monster smoothly and animate its legs.
  function show(dt) {
    C.vis.lerp(C.pos, Math.min(1, dt * 12));
    root.position.copy(C.vis);
    root.rotation.y = C.yaw;
    C.ph += C.spd * dt * 2.2;
    const w = Math.min(1, C.spd / 1.5);
    for (const L of legs) {
      const sw = Math.sin(C.ph + L.ph);
      L.hip.rotation.x = sw * 0.45 * w;
      L.knee.rotation.z = L.s * (0.55 + 0.22 * Math.max(0, -sw) * w);
    }
    eyeLight.intensity = C.mode === 'hunt' ? 3 : 1.2;
  }

  function snapshot() {
    return { x: C.pos.x, z: C.pos.z, yaw: C.yaw, mode: C.mode, spd: C.spd };
  }
  function applyRemote(m) {
    C.pos.set(m.x, 0, m.z);
    C.yaw = m.yaw; C.mode = m.mode; C.spd = m.spd;
    root.visible = true;
  }

  return { reset, update, show, snapshot, applyRemote };
}
