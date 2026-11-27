// Gorilla-style movement 🦍
// Your hands are solid balls. Slap them on the ground, walls, cars or roofs and push:
// your body moves the other way. Let go mid-push and you fly with that speed (launch!).
// Hold GRIP while a hand touches something to grab it (climb walls, hang off roofs).
// Left stick walks a little too, right stick turns.
import * as THREE from 'three';
import { nearSolids, groundAt, HALF } from './city.js';

export const EYE = 0.95;          // your eyes are this high above your feet (small and fast, like a gorilla)
const HAND_R = 0.07;
const MAX_SPEED = 6.8;
const JUMP_BOOST = 1.12;
const GRAV = 9.8;
const RELEASE = 0.035;            // pull a hand this far away from a surface and it lets go
const V = () => new THREE.Vector3();

export function createMover({ rig, camera, renderer, onSlap, onLand }) {
  const M = {
    vel: V(), grounded: false, wasStuck: false, velBuf: [], ghost: false, frozen: false,
    turnLatch: false, flat: false, keys: {}, yaw: 0, pitch: 0, speed: 0,
  };
  const hands = [0, 1].map((i) => ({
    i, grip: renderer.xr.getControllerGrip(i), ctrl: renderer.xr.getController(i),
    gp: null, side: '', tracked: false, ready: false, local: V(), q: new THREE.Quaternion(),
    target: V(), pos: V(), prev: V(), stuck: false, hold: false, sp: V(), n: V(), cool: 0,
    vel: V(), last: V(), touching: false, model: null, gripV: 0, trigV: 0,
  }));
  for (const h of hands) {
    rig.add(h.grip, h.ctrl);
    h.ctrl.addEventListener('connected', (e) => { h.gp = e.data.gamepad || null; h.side = e.data.handedness || (h.i ? 'right' : 'left'); });
    h.ctrl.addEventListener('disconnected', () => { h.gp = null; h.tracked = false; h.ready = false; h.stuck = false; });
  }

  // ---------- collisions ----------
  const near = [], _c = V(), _d = V();
  // push a ball at p (radius r) out of everything. Returns the push normal (or null). Moves p.
  function pushOut(p, r, nrmOut) {
    let hit = false;
    if (nrmOut) nrmOut.set(0, 0, 0);
    if (p.y < r) { if (nrmOut) nrmOut.y += 1; p.y = r; hit = true; }   // the street
    for (const b of nearSolids(p.x, p.z, r + 0.05, near)) {
      if (p.y + r < b.y0 || p.y - r > b.y1) continue;
      _c.set(Math.max(b.x0, Math.min(p.x, b.x1)), Math.max(b.y0, Math.min(p.y, b.y1)), Math.max(b.z0, Math.min(p.z, b.z1)));
      _d.subVectors(p, _c);
      const dist = _d.length();
      if (dist >= r) continue;
      if (dist > 1e-5) { _d.multiplyScalar(1 / dist); p.addScaledVector(_d, r - dist); }
      else {   // centre is inside the box: leave by the nearest side
        const opts = [[p.x - b.x0, -1, 0, 0], [b.x1 - p.x, 1, 0, 0], [p.y - b.y0, 0, -1, 0], [b.y1 - p.y, 0, 1, 0], [p.z - b.z0, 0, 0, -1], [b.z1 - p.z, 0, 0, 1]];
        opts.sort((a, c) => a[0] - c[0]);
        const [pen, nx, ny, nz] = opts[0];
        _d.set(nx, ny, nz); p.addScaledVector(_d, pen + r);
      }
      if (nrmOut) nrmOut.add(_d);
      hit = true;
    }
    if (nrmOut && hit && nrmOut.lengthSq() > 0) nrmOut.normalize();
    return hit;
  }

  // ---------- reading the controllers ----------
  const _raw = V(), _rq = new THREE.Quaternion(), OFF = new THREE.Vector3(0, -0.015, 0.03);
  function sample(dt) {
    for (const h of hands) {
      const g = h.grip;
      const ok = renderer.xr.isPresenting && g.visible && !!h.gp;
      if (ok) {
        _rq.copy(g.quaternion);
        _raw.copy(OFF).applyQuaternion(_rq).add(g.position);
        if (!h.ready) { h.local.copy(_raw); h.q.copy(_rq); }
        else {   // smooth shaky tracking, but stay snappy when you swing fast
          const speed = _raw.distanceTo(h.local) / Math.max(dt, 1e-3), cutoff = 6 + speed * 4;
          h.local.lerp(_raw, 1 - Math.exp(-2 * Math.PI * cutoff * dt));
          h.q.slerp(_rq, 1 - Math.exp(-dt * 40));
        }
        h.tracked = true;
        const B = h.gp.buttons;
        h.gripV = B[1] ? B[1].value || (B[1].pressed ? 1 : 0) : 0;
        h.trigV = B[0] ? B[0].value || (B[0].pressed ? 1 : 0) : 0;
      } else { h.tracked = false; h.ready = false; h.stuck = false; h.hold = false; }
    }
  }
  function buzz(h, v, ms) {
    const a = h.gp && h.gp.hapticActuators && h.gp.hapticActuators[0];
    if (a) try { a.pulse(v, ms); } catch (e) {}
  }

  const _h = V(), _p = V(), _p0 = V(), _n = V(), _mv = V(), _tmp = V(), _fw = V(), _rt = V(), UP = new THREE.Vector3(0, 1, 0);
  const headWorld = (out) => { rig.updateMatrixWorld(); return camera.getWorldPosition(out); };

  // keep the body out of walls, on the floor, under ceilings
  function resolveBody() {
    const wasG = M.grounded;
    M.grounded = false;
    headWorld(_h);
    // feet on the floor (curbs, car roofs, rooftops...)
    let feet = _h.y - EYE;
    const g = groundAt(_h.x, _h.z, feet + 0.35);
    if (feet <= g + 0.02) {
      rig.position.y += g - feet;
      if (M.vel.y < 0) { if (!wasG && M.vel.y < -3.5 && onLand) onLand(-M.vel.y); M.vel.y = 0; }
      M.grounded = true;
      headWorld(_h);
      feet = g;
    }
    // body balls: head and chest
    for (const [dy, r] of [[0, 0.17], [-0.5, 0.25]]) {
      _p.set(_h.x, _h.y + dy, _h.z);
      if (dy < 0 && _p.y - r < feet + 0.15) _p.y = feet + 0.15 + r;
      _p0.copy(_p);
      if (pushOut(_p, r, _n)) {
        const push = _tmp.subVectors(_p, _p0);
        if (dy < 0 && M.grounded) push.y = Math.max(0, push.y) * 0;   // chest doesn't lift you off the floor
        rig.position.add(push);
        const vn = M.vel.dot(_n);
        if (vn < 0) M.vel.addScaledVector(_n, -vn);
        headWorld(_h);
      }
    }
    // stay inside the city
    const lim = HALF - 0.6;
    if (Math.abs(_h.x) > lim) rig.position.x -= _h.x - Math.sign(_h.x) * lim;
    if (Math.abs(_h.z) > lim) rig.position.z -= _h.z - Math.sign(_h.z) * lim;
  }

  function step(dt) {
    sample(dt);
    rig.updateMatrixWorld();
    for (const h of hands) {
      if (!h.tracked) continue;
      rig.localToWorld(h.target.copy(h.local));
      if (!h.ready) { h.prev.copy(h.target); h.pos.copy(h.target); h.ready = true; }
    }
    if (M.ghost) return ghostStep(dt);
    if (M.frozen) { for (const h of hands) { h.stuck = false; h.pos.copy(h.target); } return; }

    // 1) hands touching something drag your body
    _mv.set(0, 0, 0);
    let ns = 0;
    for (const h of hands) {
      if (!h.tracked || !h.stuck) continue;
      if (h.hold && h.gripV < 0.3) h.hold = false;
      _tmp.subVectors(h.target, h.sp);
      if (h.hold) {
        if (_tmp.length() > 0.9) { h.stuck = false; h.hold = false; h.cool = 0.15; continue; }
        _mv.sub(_tmp); ns++; continue;
      }
      const sep = _tmp.dot(h.n);
      if (sep > RELEASE || _tmp.length() > 0.6) { h.stuck = false; h.cool = 0.1; continue; }
      if (sep > 0) _tmp.addScaledVector(h.n, -sep);   // pulling away doesn't drag you back
      if (h.gripV > 0.6) h.hold = true;                // squeeze to grab on
      _mv.sub(_tmp); ns++;
    }
    if (ns) {
      _mv.multiplyScalar(1 / ns);
      if (_mv.length() > 0.3) _mv.setLength(0.3);
      rig.position.add(_mv);
      M.vel.set(0, 0, 0);
      M.velBuf.push(_mv.clone().multiplyScalar(1 / dt));
      if (M.velBuf.length > 6) M.velBuf.shift();
    } else {
      if (M.wasStuck && M.velBuf.length) {   // let go mid-push: LAUNCH
        const v = V();
        for (const b of M.velBuf) v.add(b);
        v.multiplyScalar(JUMP_BOOST / M.velBuf.length);
        if (v.length() > MAX_SPEED) v.setLength(MAX_SPEED);
        M.vel.copy(v);
        M.grounded = false;
      }
      M.velBuf.length = 0;
      M.vel.y -= GRAV * dt;
      if (M.grounded) { const f = Math.exp(-5 * dt); M.vel.x *= f; M.vel.z *= f; }
      rig.position.addScaledVector(M.vel, dt);
    }
    M.wasStuck = ns > 0;

    // left stick: walk (slower than arm-running, on purpose)
    const L = hands.find((h) => h.side === 'left' && h.gp), Rt = hands.find((h) => h.side === 'right' && h.gp);
    if (L && L.gp.axes.length >= 4) {
      const ax = L.gp.axes[2] || 0, ay = L.gp.axes[3] || 0;
      if (Math.hypot(ax, ay) > 0.2) {
        camera.getWorldDirection(_fw); _fw.y = 0; _fw.normalize();
        _rt.crossVectors(_fw, UP);
        const sp = (M.grounded ? 2.0 : 0.8) * dt;
        rig.position.addScaledVector(_rt, ax * sp).addScaledVector(_fw, -ay * sp);
      }
    }
    // right stick: snap turn 30°
    if (Rt && Rt.gp.axes.length >= 4) {
      const ax = Rt.gp.axes[2] || 0;
      if (Math.abs(ax) > 0.7 && !M.turnLatch) { M.turnLatch = true; snapTurn(ax > 0 ? -Math.PI / 6 : Math.PI / 6); }
      if (Math.abs(ax) < 0.3) M.turnLatch = false;
    }

    resolveBody();

    // 2) free hands: find something to slap. Hands can't go through things.
    rig.updateMatrixWorld();
    for (const h of hands) {
      if (!h.tracked) continue;
      rig.localToWorld(h.target.copy(h.local));
      h.cool -= dt;
      if (h.stuck) { h.pos.copy(h.sp); h.prev.copy(h.pos); continue; }
      let hit = false;
      for (let k = 1; k <= 4; k++) {
        _p.lerpVectors(h.prev, h.target, k / 4);
        if (pushOut(_p, HAND_R, _n)) { hit = true; break; }
      }
      if (hit) {
        const speed = h.prev.distanceTo(h.target) / dt;
        h.pos.copy(_p);
        if (h.cool <= 0) {
          h.stuck = true; h.sp.copy(_p); h.n.copy(_n); h.hold = h.gripV > 0.6;
          if (!hands.some((o) => o !== h && o.stuck)) M.velBuf.length = 0;
          if (speed > 0.4) { buzz(h, Math.min(1, speed / 4), 25); if (onSlap) onSlap(h, speed); }
        }
      } else h.pos.copy(h.target);
      h.prev.copy(h.pos);
    }
    for (const h of hands) {
      if (!h.tracked) continue;
      _tmp.subVectors(h.pos, h.last).multiplyScalar(1 / dt);
      h.vel.lerp(_tmp, 0.35);
      h.last.copy(h.pos);
    }
    M.speed = Math.hypot(M.vel.x, M.vel.z);
  }

  function snapTurn(a) {
    headWorld(_h);
    const before = _h.clone();
    rig.rotateY(a);
    headWorld(_h);
    rig.position.x += before.x - _h.x; rig.position.z += before.z - _h.z;
  }

  // when you get caught you become a ghost: float through everything
  function ghostStep(dt) {
    const L = hands.find((h) => h.side === 'left' && h.gp);
    camera.getWorldDirection(_fw);
    if (L && L.gp.axes.length >= 4) {
      const ay = L.gp.axes[3] || 0, ax = L.gp.axes[2] || 0;
      _rt.crossVectors(_fw, UP).normalize();
      rig.position.addScaledVector(_fw, -ay * 4 * dt).addScaledVector(_rt, ax * 4 * dt);
    }
    // swinging your arms also swims you through the air
    for (const h of hands) {
      if (!h.tracked) continue;
      _tmp.subVectors(h.target, h.last);
      if (h.gripV > 0.5) rig.position.addScaledVector(_tmp, -1);
      h.last.copy(h.target);
      h.pos.copy(h.target);
    }
    const Rt = hands.find((h) => h.side === 'right' && h.gp);
    if (Rt && Rt.gp.axes.length >= 4) {
      const ax = Rt.gp.axes[2] || 0;
      if (Math.abs(ax) > 0.7 && !M.turnLatch) { M.turnLatch = true; snapTurn(ax > 0 ? -Math.PI / 6 : Math.PI / 6); }
      if (Math.abs(ax) < 0.3) M.turnLatch = false;
    }
    if (rig.position.y < 0) rig.position.y = 0;
    M.vel.set(0, 0, 0);
  }

  // ---------- PC test mode: WASD + mouse, Space jumps ----------
  function flatStep(dt) {
    const k = M.keys;
    if (M.ghost || M.frozen) {
      if (M.ghost) {
        const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
        camera.getWorldDirection(_fw);
        rig.position.addScaledVector(_fw, f * 4 * dt);
      }
      return;
    }
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const sp = k.ShiftLeft ? 5.5 : 3.2;
    const fx = -Math.sin(M.yaw), fz = -Math.cos(M.yaw), rx = Math.cos(M.yaw), rz = -Math.sin(M.yaw);
    const wx = (fx * f + rx * s) * sp, wz = (fz * f + rz * s) * sp;
    const a = M.grounded ? 12 : 2;
    M.vel.x += (wx - M.vel.x) * Math.min(1, a * dt);
    M.vel.z += (wz - M.vel.z) * Math.min(1, a * dt);
    if (k.Space && M.grounded) { M.vel.y = 4.6; M.grounded = false; }
    M.vel.y -= GRAV * dt;
    rig.position.addScaledVector(M.vel, dt);
    resolveBody();
    M.speed = Math.hypot(M.vel.x, M.vel.z);
  }

  // just read the hands (used while you sit in the car)
  M.handsOnly = (dt) => {
    sample(dt); rig.updateMatrixWorld();
    for (const h of hands) { if (!h.tracked) continue; rig.localToWorld(h.target.copy(h.local)); h.pos.copy(h.target); h.prev.copy(h.pos); h.last.copy(h.pos); h.stuck = false; h.ready = true; }
    M.vel.set(0, 0, 0); M.velBuf.length = 0;
  };
  M.hands = hands;
  M.step = step;
  M.flatStep = flatStep;
  M.snapTurn = snapTurn;
  M.resolveBody = resolveBody;
  M.teleport = (p) => {
    // put your head above p (your real room position is kept)
    headWorld(_h);
    rig.position.x += p.x - _h.x; rig.position.z += p.z - _h.z;
    rig.position.y += p.y + EYE - _h.y;
    M.vel.set(0, 0, 0); M.velBuf.length = 0;
    for (const h of hands) { h.stuck = false; h.hold = false; h.ready = false; }
  };
  return M;
}
