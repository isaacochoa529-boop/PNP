// City: streets, buildings, dead trees, wrecked cars, crickets and the night sky.
// Every headset builds the SAME city (fixed random seed), so everyone sees the same map.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const HALF = 190;                            // city edge, metres from the centre
export const SPAWN = new THREE.Vector3(0, 0, 14);   // where everyone starts
export const walls = [];                            // solid walls you can't walk through {x0,x1,z0,z1}
export const hideZones = [];                        // open buildings you can hide in {x0,x1,z0,z1,top}

const PITCH = 52;   // distance between block centres
const T = 0.4;      // wall thickness
const DOOR = 2.2;   // width of an open doorway
const BOX = new THREE.BoxGeometry(1, 1, 1);

const M = {
  ground: new THREE.MeshStandardMaterial({ color: 0x0f1014, roughness: 1 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.95 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 1 }),
  plank: new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x18161a, roughness: 0.95 }),
  glassDark: new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 0.3, metalness: 0.4 }),
  lit: new THREE.MeshBasicMaterial({ color: 0xffa640 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x0a0907, roughness: 1 }),
  carBody: new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.6, metalness: 0.3 }),
};
const WALL_COLORS = [0x3a3d45, 0x4a3b33, 0x2c3238, 0x5a4a3c, 0x3d3a36];
const WALLS = WALL_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));

const KINDS = {
  house:     { w: 9,  d: 9,  h: 6,   hide: true,  steeple: 0 },
  shop:      { w: 12, d: 8,  h: 4.5, hide: false, steeple: 0 },
  tower:     { w: 10, d: 10, h: 30,  hide: false, steeple: 0 },
  warehouse: { w: 18, d: 12, h: 8,   hide: true,  steeple: 0 },
  church:    { w: 8,  d: 14, h: 9,   hide: true,  steeple: 6 },
  garage:    { w: 10, d: 7,  h: 4,   hide: false, steeple: 0 },
};
const KIND_LIST = Object.keys(KINDS);

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// Static boxes are merged per material at the end, so the whole city is only a few draw calls.
const buckets = new Map();
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
function box(mat, x0, x1, y0, y1, z0, z1) {
  _p.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  _s.set(x1 - x0, y1 - y0, z1 - z0);
  const g = BOX.clone().applyMatrix4(_m.compose(_p, _q, _s));
  if (!buckets.has(mat)) buckets.set(mat, []);
  buckets.get(mat).push(g);
}

function boardUp(key, s, mid) {
  const out = key === 'n' || key === 'w' ? s.f0 - 0.08 : s.f1 + 0.08;
  const a0 = mid - 1.1, a1 = mid + 1.1;
  if (s.along === 'x') {
    box(M.wood, a0, a1, 0.05, 2.5, out - 0.02, out + 0.02);
    for (const y of [0.6, 1.3, 2.0]) box(M.plank, a0 - 0.1, a1 + 0.1, y, y + 0.22, out - 0.06, out + 0.06);
  } else {
    box(M.wood, out - 0.02, out + 0.02, 0.05, 2.5, a0, a1);
    for (const y of [0.6, 1.3, 2.0]) box(M.plank, out - 0.06, out + 0.06, y, y + 0.22, a0 - 0.1, a1 + 0.1);
  }
}

function building(R, kind, cx, cz) {
  const k = KINDS[kind];
  const x0 = cx - k.w / 2, x1 = cx + k.w / 2, z0 = cz - k.d / 2, z1 = cz + k.d / 2;
  const wm = WALLS[Math.floor(R() * WALLS.length)];
  const door = ['n', 's', 'w', 'e'][Math.floor(R() * 4)];
  const sides = {
    n: { along: 'x', lo: x0, hi: x1, f0: z0, f1: z0 + T },
    s: { along: 'x', lo: x0, hi: x1, f0: z1 - T, f1: z1 },
    w: { along: 'z', lo: z0, hi: z1, f0: x0, f1: x0 + T },
    e: { along: 'z', lo: z0, hi: z1, f0: x1 - T, f1: x1 },
  };
  for (const key of ['n', 's', 'w', 'e']) {
    const s = sides[key];
    const mid = (s.lo + s.hi) / 2;
    const gap = k.hide && key === door;   // hideable buildings have an open doorway
    const spans = gap ? [[s.lo, mid - DOOR / 2], [mid + DOOR / 2, s.hi]] : [[s.lo, s.hi]];
    for (const [a, b] of spans) {
      const r = s.along === 'x' ? { x0: a, x1: b, z0: s.f0, z1: s.f1 } : { x0: s.f0, x1: s.f1, z0: a, z1: b };
      walls.push(r);
      box(wm, r.x0, r.x1, 0, k.h, r.z0, r.z1);
    }
    if (!k.hide && key === door) boardUp(key, s, mid);   // boarded-up door
  }
  if (k.hide) {
    hideZones.push({ x0: x0 + T, x1: x1 - T, z0: z0 + T, z1: z1 - T, top: k.h });
    box(M.wood, x0 + T, x1 - T, 0, 0.06, z0 + T, z1 - T);
  }
  box(M.roof, x0 - 0.25, x1 + 0.25, k.h, k.h + 0.35, z0 - 0.25, z1 + 0.25);
  if (k.steeple) box(M.roof, cx - 1, cx + 1, k.h + 0.35, k.h + k.steeple, cz - 1, cz + 1);
  const n = 2 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const face = ['n', 's', 'w', 'e'][Math.floor(R() * 4)];
    if (k.hide && face === door) continue;
    const y = 1.8 + R() * Math.max(0.5, k.h - 3.5);
    const t = (R() - 0.5) * 0.6;
    const mat = R() < 0.3 ? M.lit : M.glassDark;
    if (face === 'n' || face === 's') {
      const xc = cx + t * k.w, zf = face === 'n' ? z0 - 0.03 : z1 + 0.03;
      box(mat, xc - 0.5, xc + 0.5, y, y + 1.2, zf - 0.03, zf + 0.03);
    } else {
      const zc = cz + t * k.d, xf = face === 'w' ? x0 - 0.03 : x1 + 0.03;
      box(mat, xf - 0.03, xf + 0.03, y, y + 1.2, zc - 0.5, zc + 0.5);
    }
  }
}

function deadTree(R, x, z) {
  const h = 5 + R() * 4;
  box(M.trunk, x - 0.18, x + 0.18, 0, h, z - 0.18, z + 0.18);
  for (let i = 0; i < 3; i++) {
    const y = h * 0.6 + i * 0.7;
    box(M.trunk, x, x + 1.1 + R(), y, y + 0.12, z - 0.06, z + 0.06);
  }
}

function wreck(R, x, z) {
  const along = R() < 0.5;
  const L = 4.2, W = 1.9;
  const x0 = along ? x - L / 2 : x - W / 2, x1 = along ? x + L / 2 : x + W / 2;
  const z0 = along ? z - W / 2 : z - L / 2, z1 = along ? z + W / 2 : z + L / 2;
  box(M.carBody, x0, x1, 0.3, 1.0, z0, z1);
  if (along) box(M.glassDark, x0 + 1.0, x1 - 1.0, 1.0, 1.4, z0 + 0.15, z1 - 0.15);
  else box(M.glassDark, x0 + 0.15, x1 - 0.15, 1.0, 1.4, z0 + 1.0, z1 - 1.0);
}

// Builds the whole city into the scene. Call once.
export function buildCity(scene) {
  const R = rng(20251127);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2.6, HALF * 2.6), M.ground);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  for (let ix = -3; ix <= 3; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      const cx = ix * PITCH, cz = iz * PITCH;
      box(M.pad, cx - 22, cx + 22, 0, 0.12, cz - 22, cz + 22);
      const plaza = ix === 0 && iz === 0;   // the spawn plaza stays empty
      if (!plaza) building(R, KIND_LIST[Math.floor(R() * KIND_LIST.length)], cx + (R() - 0.5) * 8, cz + (R() - 0.5) * 8);
      if (R() < 0.7) deadTree(R, cx + 18 + R() * 3, cz - 18 + R() * 3);
      if (R() < 0.6) deadTree(R, cx - 18 + R() * 3, cz + 18 + R() * 3);
      if (R() < 0.5) wreck(R, cx + 26, cz + (R() - 0.5) * 30);
      if (R() < 0.35) wreck(R, cx + (R() - 0.5) * 30, cz + 26);
    }
  }
  for (const [mat, list] of buckets) scene.add(new THREE.Mesh(mergeGeometries(list, false), mat));
  buckets.clear();
}

// Night sky: a dome of stars and a pale moon.
export function makeSky(scene) {
  const N = 1500, arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2, y = 0.05 + Math.random() * 0.95, r = 380, k = Math.sqrt(1 - y * y) * r;
    arr[i * 3] = Math.cos(th) * k;
    arr[i * 3 + 1] = y * r;
    arr[i * 3 + 2] = Math.sin(th) * k;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
  moon.position.set(-150, 170, -230);
  scene.add(moon);
  return { stars, moon };
}

// Crickets on the ground. They hop away from your hands, and you can squish them.
export function makeCrickets(scene, n = 45) {
  const geo = new THREE.SphereGeometry(0.07, 6, 4);
  geo.scale(1.1, 0.7, 1.6);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4 }), n);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const clamp = (v) => Math.max(-HALF * 0.9, Math.min(HALF * 0.9, v));
  const place = (c) => {
    c.x = (Math.random() * 2 - 1) * HALF * 0.8;
    c.z = (Math.random() * 2 - 1) * HALF * 0.8;
    c.vx = 0; c.vz = 0; c.dead = 0;
  };
  const cs = [];
  for (let i = 0; i < n; i++) {
    const c = { x: 0, z: 0, vx: 0, vz: 0, dead: 0, yaw: Math.random() * 6.28 };
    place(c);
    cs.push(c);
  }
  function update(dt, hands, onSquish) {
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.dead > 0) {
        c.dead -= dt;
        if (c.dead <= 0) place(c);
        mesh.setMatrixAt(i, hidden);
        continue;
      }
      let squished = false;
      for (const h of hands) {
        const dx = c.x - h.x, dz = c.z - h.z, d = Math.hypot(dx, dz) || 1e-4;
        if (d < 0.6) { c.vx += (dx / d) * 5 * dt; c.vz += (dz / d) * 5 * dt; }
        if (Math.hypot(dx, h.y - 0.05, dz) < 0.16) { squished = true; break; }
      }
      if (squished) {
        c.dead = 25 + Math.random() * 10;
        onSquish(i);
        mesh.setMatrixAt(i, hidden);
        continue;
      }
      if (Math.random() < dt * 0.25) { c.vx += (Math.random() - 0.5) * 2; c.vz += (Math.random() - 0.5) * 2; }
      const damp = Math.exp(-3 * dt);
      c.vx *= damp; c.vz *= damp;
      c.x = clamp(c.x + c.vx * dt);
      c.z = clamp(c.z + c.vz * dt);
      if (Math.hypot(c.vx, c.vz) > 0.1) c.yaw = Math.atan2(c.vx, c.vz);
      p.set(c.x, 0.04, c.z);
      q.setFromAxisAngle(up, c.yaw);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { update };
}
