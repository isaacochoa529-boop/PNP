// The Goofy Car 🚗💨: a bright yellow clown car parked in the park.
// Stand next to it and press A or X to hop in. Right TRIGGER = gas, left TRIGGER = brake/reverse,
// left stick steers (or hold both GRIPs and turn your hands like a real wheel). A/X = horn, B/Y = get out.
// Run over the Crawler: it goes SPLAT flat and dizzy for a while. Run over your friend: they go flying!
// The driver's headset drives it and tells everyone else where it is.
import * as THREE from 'three';
import { nearSolids, HALF } from './city.js';

const START = { x: -13, z: 2, yaw: 0 };
const MAX = 15, REV = 6, ACC = 9, BRAKE = 14;

export function makeCar(scene) {
  const root = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: 0xffd21a });
  const red = new THREE.MeshLambertMaterial({ color: 0xe0242a });
  const black = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const white = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const glass = new THREE.MeshPhongMaterial({ color: 0x223344, transparent: true, opacity: 0.35, shininess: 80 });
  const lampM = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const add = (g, m, x, y, z, sx = 1, sy = 1, sz = 1, parent = body) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; };
  const body = new THREE.Group();
  root.add(body);
  const BOX = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.SphereGeometry(0.5, 14, 10), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
  // a short, round, bouncy body (it's a clown car)
  add(BOX, yellow, 0, 0.6, 0, 1.9, 0.55, 3.4);
  add(SPH, yellow, 0, 0.62, 1.55, 1.9, 0.6, 0.9);
  add(SPH, yellow, 0, 0.62, -1.55, 1.9, 0.6, 0.9);
  for (const sd of [-1, 1]) add(BOX, red, sd * 0.96, 0.75, 0, 0.03, 0.12, 3.0);   // racing stripes
  add(BOX, red, 0, 0.9, 1.25, 0.4, 0.02, 1.0);
  add(BOX, black, 0, 0.88, -0.35, 1.7, 0.02, 1.5);   // the open cockpit floor
  // seats (open top!) + steering wheel
  add(BOX, black, -0.42, 0.95, -0.35, 0.6, 0.15, 0.6);
  add(BOX, black, -0.42, 1.25, -0.68, 0.6, 0.6, 0.12);
  add(BOX, black, 0.42, 0.95, -0.35, 0.6, 0.15, 0.6);
  add(BOX, black, 0.42, 1.25, -0.68, 0.6, 0.6, 0.12);
  add(BOX, glass, 0, 1.2, 0.55, 1.8, 0.5, 0.06).rotation.x = -0.4;   // windshield
  const wheelPivot = new THREE.Group(); wheelPivot.position.set(-0.42, 1.18, 0.22); wheelPivot.rotation.x = -0.9; body.add(wheelPivot);
  const wheel = new THREE.Group(); wheelPivot.add(wheel);
  add(new THREE.TorusGeometry(0.17, 0.025, 8, 20), black, 0, 0, 0, 1, 1, 1, wheel);
  add(BOX, black, 0, 0, 0, 0.32, 0.03, 0.03, wheel);
  add(SPH, red, 0, 0, 0.01, 0.09, 0.09, 0.05, wheel);          // honk button
  // big googly headlights
  for (const s of [-1, 1]) {
    add(SPH, white, s * 0.6, 0.85, 1.85, 0.42, 0.42, 0.2);
    add(SPH, lampM, s * 0.6, 0.85, 1.93, 0.3, 0.3, 0.1);
    add(SPH, black, s * 0.6 + 0.05, 0.82, 1.99, 0.1, 0.1, 0.05);
  }
  // a silly giant horn on top
  add(new THREE.ConeGeometry(0.16, 0.5, 12, 1, true), red, 0.75, 1.25, -1.2, 1, 1, 1).rotation.x = -Math.PI / 2;
  add(SPH, black, 0.75, 1.25, -1.5, 0.22, 0.22, 0.22);
  // wheels
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.15], [0.95, 1.15], [-0.95, -1.15], [0.95, -1.15]]) {
    const w = new THREE.Group(); w.position.set(x, 0.38, z); root.add(w);
    const tire = add(CYL, black, 0, 0, 0, 0.76, 0.32, 0.76, w); tire.rotation.z = Math.PI / 2;
    const hub = add(CYL, red, Math.sign(x) * 0.17, 0, 0, 0.35, 0.04, 0.35, w); hub.rotation.z = Math.PI / 2;
    wheels.push({ w, front: z > 0 });
  }
  const lamp = new THREE.SpotLight(0xfff6c0, 0, 40, 0.55, 0.5, 1.0);
  lamp.position.set(0, 0.9, 2.0); lamp.target.position.set(0, 0, 12);
  root.add(lamp, lamp.target);
  scene.add(root);

  const C = {
    x: START.x, z: START.z, yaw: START.yaw, spd: 0, steer: 0, spin: 0, bounce: 0,
    driver: null, driverSeen: 0, tx: START.x, tz: START.z, tyaw: START.yaw, hits: new Map(),
  };
  const fwd = () => [Math.sin(C.yaw), Math.cos(C.yaw)];
  const near = [];
  function blocked(x, z) {
    const [fx, fz] = [Math.sin(C.yaw), Math.cos(C.yaw)];
    for (const [ox, oz] of [[0, 0], [fx * 1.5, fz * 1.5], [-fx * 1.5, -fz * 1.5]]) {
      const px = x + ox, pz = z + oz;
      for (const b of nearSolids(px, pz, 1.1, near)) {
        if (b.y1 < 0.5 || b.y0 > 1.3) continue;
        const cx = Math.max(b.x0, Math.min(px, b.x1)), cz = Math.max(b.z0, Math.min(pz, b.z1));
        if ((px - cx) ** 2 + (pz - cz) ** 2 < 1.0) return true;
      }
    }
    return Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2;
  }

  // driver only: in = { gas 0..1, brake 0..1, steer -1..1 }
  function drive(dt, inp) {
    if (inp.gas > 0.05) C.spd += inp.gas * ACC * dt;
    if (inp.brake > 0.05) C.spd -= inp.brake * (C.spd > 0.5 ? BRAKE : ACC * 0.6) * dt;
    if (inp.gas <= 0.05 && inp.brake <= 0.05) C.spd *= Math.exp(-0.8 * dt);
    C.spd = Math.max(-REV, Math.min(MAX, C.spd));
    C.steer += (inp.steer - C.steer) * Math.min(1, dt * 8);
    C.yaw -= C.steer * dt * Math.min(1.6, Math.abs(C.spd) * 0.35) * Math.sign(C.spd || 1) * 1.4;
    const [fx, fz] = fwd();
    const nx = C.x + fx * C.spd * dt, nz = C.z + fz * C.spd * dt;
    let crashed = false;
    if (!blocked(nx, nz)) { C.x = nx; C.z = nz; }
    else { crashed = Math.abs(C.spd) > 4; C.spd *= -0.35; C.bounce = 1; }
    return crashed;
  }
  // everyone: draw it
  function show(dt, iDrive) {
    if (!iDrive) {   // smooth the network position
      C.x += (C.tx - C.x) * Math.min(1, dt * 10); C.z += (C.tz - C.z) * Math.min(1, dt * 10);
      let da = C.tyaw - C.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); C.yaw += da * Math.min(1, dt * 10);
    }
    root.position.set(C.x, 0, C.z);
    root.rotation.y = C.yaw;
    C.spin += C.spd * dt / 0.38;
    C.bounce = Math.max(0, C.bounce - dt * 2);
    const t = performance.now() / 1000;
    body.position.y = Math.abs(Math.sin(t * (4 + Math.abs(C.spd)))) * 0.04 * Math.min(1, Math.abs(C.spd) / 3) + Math.sin(t * 25) * 0.08 * C.bounce;
    body.rotation.z = -C.steer * Math.min(1, Math.abs(C.spd) / 8) * 0.12;   // leans in turns
    body.rotation.x = -Math.max(-0.08, Math.min(0.08, (C.spd - (C.lastSpd || 0)) / dt * 0.01));
    C.lastSpd = C.spd;
    for (const w of wheels) { w.w.rotation.set(C.spin, w.front ? -C.steer * 0.5 : 0, 0, 'YXZ'); }
    wheel.rotation.z = C.steer * 1.6;
    lamp.intensity = C.driver ? 30 : 0;
  }
  function state() { return { x: +C.x.toFixed(2), z: +C.z.toFixed(2), yaw: +C.yaw.toFixed(3), spd: +C.spd.toFixed(2), st: +C.steer.toFixed(2) }; }
  function apply(m) { C.tx = m.x; C.tz = m.z; C.tyaw = m.yaw; C.spd = m.spd; C.steer = m.st; }
  // seat: where the driver's head goes (car space)
  const seat = new THREE.Vector3(-0.42, 1.65, -0.35);
  function seatWorld(out) { return out.copy(seat).applyAxisAngle(new THREE.Vector3(0, 1, 0), C.yaw).add(new THREE.Vector3(C.x, 0, C.z)); }
  function doorWorld(out) { return out.set(-1.9, 0, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), C.yaw).add(new THREE.Vector3(C.x, 0, C.z)); }
  function reset() { C.x = C.tx = START.x; C.z = C.tz = START.z; C.yaw = C.tyaw = START.yaw; C.spd = 0; C.steer = 0; }
  return { C, root, drive, show, state, apply, seatWorld, doorWorld, fwd, reset };
}
