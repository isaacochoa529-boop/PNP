// The city of Hollow Creek: streets, ruined buildings, props, lamps, sky, mist and crickets.
// Every headset builds the SAME city (fixed random seed), so friends see the same map.
//
// Speed trick: all the little boxes are glued ("merged") into one mesh per material per chunk
// of the city, and chunks far away in the fog are switched off. That keeps it smooth on Quest.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTextures, graffiti, signTex } from './textures.js';

export const PITCH = 52;                            // distance between block centres
export const HALF = 3 * PITCH + 30;                 // city edge (7 x 7 blocks)
export const SPAWN = new THREE.Vector3(0, 0, 9);    // where everyone starts (the park)
export const hideZones = [];                        // buildings you can hide in
export const solids = [];                           // everything hands and bodies bump into {x0,x1,y0,y1,z0,z1,tag}
export const secretSpots = {};                      // filled by buildCity
const CHUNK = PITCH * 2;
const VIEW = 125;                                   // chunks further than this (plus their size) are hidden

// ---------- tiny helpers ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
let R = rng(1);
const pick = (a) => a[Math.floor(R() * a.length)];
const rr = (a, b) => a + R() * (b - a);

// ---------- colliders, with a grid so lookups are fast ----------
const GRID = 8, grid = new Map();
const gkey = (i, j) => i * 10007 + j;
export function addSolid(x0, x1, y0, y1, z0, z1, tag = '') {
  const b = { x0, x1, y0, y1, z0, z1, tag };
  solids.push(b);
  for (let i = Math.floor(x0 / GRID); i <= Math.floor(x1 / GRID); i++)
    for (let j = Math.floor(z0 / GRID); j <= Math.floor(z1 / GRID); j++) {
      const k = gkey(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(b);
    }
  return b;
}
let qStamp = 0;
// All solid boxes touching the square [x-r, x+r] x [z-r, z+r]
export function nearSolids(x, z, r, out = []) {
  out.length = 0; qStamp++;
  for (let i = Math.floor((x - r) / GRID); i <= Math.floor((x + r) / GRID); i++)
    for (let j = Math.floor((z - r) / GRID); j <= Math.floor((z + r) / GRID); j++) {
      const l = grid.get(gkey(i, j));
      if (!l) continue;
      for (const b of l) if (b._q !== qStamp) { b._q = qStamp; out.push(b); }
    }
  return out;
}
const _near = [];
// Height of the floor under (x, z), looking down from height y (roofs count if you are on them)
export function groundAt(x, z, y = 99) {
  let g = 0;
  for (const b of nearSolids(x, z, 0.01, _near)) {
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= y + 0.45 && b.y1 > g) g = b.y1;
  }
  return g;
}
export function hideZoneAt(p) {
  for (const z of hideZones) if (p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1 && p.y < z.top) return z;
  return null;
}

// ---------- geometry buckets: one merged mesh per (chunk, material) ----------
const buckets = new Map();
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const PLANE = new THREE.PlaneGeometry(1, 1).toNonIndexed();
function push(mat, geo, cx, cz) {
  const k = Math.floor(cx / CHUNK + 0.5) + ',' + Math.floor(cz / CHUNK + 0.5);
  let b = buckets.get(k);
  if (!b) buckets.set(k, (b = new Map()));
  if (!b.has(mat)) b.set(mat, []);
  b.get(mat).push(geo);
}
// A box with UVs in metres (so textures don't stretch). rot = [rx, ry, rz]. solid = add a collider.
function box(mat, cx, cy, cz, sx, sy, sz, rot = null, solid = false, tag = '') {
  const g = BOX.clone();
  const tile = mat.userData.tile || 0;
  if (tile) {
    const uv = g.attributes.uv, off = (cx + cz) * 0.37 / tile;
    for (let i = 0; i < uv.count; i++) {
      const f = Math.floor(i / 6);   // 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
      const a = f < 2 ? sz : sx, b = f < 2 ? sy : f < 4 ? sz : sy;
      uv.setXY(i, uv.getX(i) * a / tile + off, uv.getY(i) * b / tile);
    }
  }
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  g.applyMatrix4(_m.compose(_p.set(cx, cy, cz), _q.setFromEuler(_e), _s.set(sx, sy, sz)));
  push(mat, g, cx, cz);
  if (solid) {
    if (rot && (rot[1] % Math.PI) !== 0) { g.computeBoundingBox(); const bb = g.boundingBox; addSolid(bb.min.x, bb.max.x, bb.min.y, bb.max.y, bb.min.z, bb.max.z, tag); }
    else addSolid(cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, cz - sz / 2, cz + sz / 2, tag);
  }
}
// Box from corners
function boxC(mat, x0, x1, y0, y1, z0, z1, solid = true, tag = '') {
  box(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, null, solid, tag);
}
function geo(mat, g0, cx, cy, cz, sx = 1, sy = 1, sz = 1, rot = null) {
  const g = g0.index ? g0.toNonIndexed() : g0.clone();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  g.applyMatrix4(_m.compose(_p.set(cx, cy, cz), _q.setFromEuler(_e), _s.set(sx, sy, sz)));
  push(mat, g, cx, cz);
}
// A flat picture on a wall. face: 'n','s','e','w' = which way it looks
function decal(mat, cx, cy, cz, w, h, face) {
  const ry = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[face];
  geo(mat, PLANE, cx, cy, cz, w, h, 1, [0, ry, 0]);
}
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1);
const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1);
const CONE4 = new THREE.ConeGeometry(0.71, 1, 4, 1);
const SPH = new THREE.SphereGeometry(0.5, 10, 7);

// ---------- materials ----------
let M = null, T = null;
function lam(opts, tile = 0) {
  const m = new THREE.MeshLambertMaterial(opts);
  m.userData.tile = tile;
  return m;
}
function makeMaterials() {
  T = makeTextures();
  M = {
    asphalt: lam({ map: T.asphalt }, 8),
    sidewalk: lam({ map: T.sidewalk }, 4),
    brick: lam({ map: T.brick }, 2.2),
    brick2: lam({ map: T.brick, color: 0x8a9aa0 }, 2.2),
    concrete: lam({ map: T.concrete }, 4),
    concrete2: lam({ map: T.concrete, color: 0xb0a890 }, 4),
    plaster: lam({ map: T.plaster }, 2.5),
    plaster2: lam({ map: T.plaster, color: 0x8fa3a8 }, 2.5),
    plaster3: lam({ map: T.plaster, color: 0xc0a89a }, 2.5),
    metal: lam({ map: T.metal }, 2.5),
    wood: lam({ map: T.wood }, 1.2),
    planks: lam({ map: T.wood, color: 0xb08a60 }, 1.2),
    roof: lam({ map: T.roof }, 2),
    tar: lam({ map: T.tar }, 3),
    rust: lam({ map: T.rust }, 1.5),
    dark: lam({ color: 0x0c0c0e }),
    black: lam({ color: 0x040404 }),
    trunk: lam({ color: 0x15110d }),
    pole: lam({ color: 0x2a2b2e }),
    tire: lam({ color: 0x0b0b0b }),
    grass: lam({ color: 0x2a2a18 }),
    white: lam({ color: 0x8a8a84 }),
    yellow: lam({ color: 0x8a7a2a }),
    red: lam({ color: 0x5a1010 }),
    cloth: lam({ color: 0x3a2030 }),
    awning: lam({ color: 0x4a1a1a, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhongMaterial({ color: 0x0a0e14, specular: 0x1a2230, shininess: 30 }),
    lit: new THREE.MeshBasicMaterial({ color: 0xc07a30 }),
    litTV: new THREE.MeshBasicMaterial({ color: 0x5a7aa8 }),
    candle: new THREE.MeshBasicMaterial({ color: 0xffb050 }),
    fence: lam({ map: T.fence, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide }, 2),
    paint: [0x5a1c18, 0x1c3a5a, 0x3a4a2a, 0x6a6a60, 0x2a2a2a, 0x6a4a1a].map((c) => lam({ map: T.paint, color: c }, 2)),
    bulbs: [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: 0xffd9a0 })),
    shafts: [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true })),
  };
}

// ---------- buildings ----------
const DOOR_W = 2.0, DOOR_H = 2.4, T_W = 0.3;
// A wall along x or z with holes for a door and windows. Adds colliders.
// side: 'n' (z = z0), 's' (z = z1), 'w' (x = x0), 'e' (x = x1)
function wall(mat, b, side, y0, y1, holes) {
  const along = side === 'n' || side === 's' ? 'x' : 'z';
  const lo = along === 'x' ? b.x0 : b.z0, hi = along === 'x' ? b.x1 : b.z1;
  const f0 = side === 'n' ? b.z0 : side === 's' ? b.z1 - T_W : side === 'w' ? b.x0 : b.x1 - T_W, f1 = f0 + T_W;
  // holes: [{a, b, y0, y1}] along the wall. Build columns between holes, and pieces above/below holes.
  holes = (holes || []).filter((h) => h.a > lo + 0.2 && h.b < hi - 0.2).sort((p, q) => p.a - q.a);
  const put = (a0, a1, yy0, yy1) => {
    if (a1 - a0 < 0.01 || yy1 - yy0 < 0.01) return;
    if (along === 'x') boxC(mat, a0, a1, yy0, yy1, f0, f1, true, 'wall');
    else boxC(mat, f0, f1, yy0, yy1, a0, a1, true, 'wall');
  };
  let cur = lo;
  for (const h of holes) {
    put(cur, h.a, y0, y1);
    put(h.a, h.b, y0, h.y0);
    put(h.a, h.b, h.y1, y1);
    cur = h.b;
  }
  put(cur, hi, y0, y1);
  return { along, f0, f1, lo, hi };
}
// Windows: dark glass, some lit, some broken (black), some boarded
function windowPane(face, a, y, b, w, h, kind) {
  const out = 0.02;
  let cx, cz;
  if (face === 'n') { cx = a; cz = b.z0 - out; } else if (face === 's') { cx = a; cz = b.z1 + out; }
  else if (face === 'w') { cx = b.x0 - out; cz = a; } else { cx = b.x1 + out; cz = a; }
  const mat = kind === 'lit' ? M.lit : kind === 'tv' ? M.litTV : kind === 'broken' ? M.black : M.glass;
  decal(mat, cx, y, cz, w, h, face);
  // frame + sill
  const fw = 0.08, alongX = face === 'n' || face === 's', o = face === 'n' || face === 'w' ? -0.06 : 0.06;
  const px = alongX ? cx : cx + o, pz = alongX ? cz + o : cz;
  const sx = alongX ? w + 0.25 : 0.14, sz = alongX ? 0.14 : w + 0.25;
  box(M.white, px, y - h / 2 - 0.05, pz, sx, 0.1, sz);
  box(M.dark, px, y + h / 2 + fw / 2, pz, alongX ? w + 0.1 : 0.06, fw, alongX ? 0.06 : w + 0.1);
  if (kind === 'boarded') {
    for (let i = 0; i < 3; i++) {
      const yy = y - h / 3 + i * h / 3, tilt = (R() - 0.5) * 0.4;
      box(M.planks, px, yy, pz, alongX ? w + 0.3 : 0.05, 0.2, alongX ? 0.05 : w + 0.3, [alongX ? 0 : tilt, 0, alongX ? tilt : 0]);
    }
  }
}
function windowKind(litChance = 0.08) {
  const r = R();
  return r < litChance ? 'lit' : r < litChance + 0.03 ? 'tv' : r < 0.32 ? 'broken' : r < 0.45 ? 'boarded' : 'glass';
}
// Rows of windows on all faces except the door face's door span
function windowsOn(b, faces, floors, floorH, wW, wH, spacing, skipFirst = null, litChance) {
  for (const face of faces) {
    const alongX = face === 'n' || face === 's';
    const lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1, L = hi - lo;
    const n = Math.max(1, Math.floor((L - 1) / spacing));
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < n; i++) {
        const a = lo + (L / n) * (i + 0.5);
        if (f === 0 && skipFirst && skipFirst.face === face && Math.abs(a - skipFirst.at) < 1.8) continue;
        windowPane(face, a, f * floorH + 1.6, b, wW, wH, windowKind(litChance));
      }
    }
  }
}
// Planks nailed across a door hole: you can't get in
function boardedDoor(face, at, b) {
  const alongX = face === 'n' || face === 's';
  const o = 0.05, base = face === 'n' ? b.z0 - o : face === 's' ? b.z1 + o : face === 'w' ? b.x0 - o : b.x1 + o;
  const cx = alongX ? at : base, cz = alongX ? base : at;
  decal(M.dark, alongX ? cx : cx + (face === 'w' ? 0.03 : -0.03), DOOR_H / 2, alongX ? cz + (face === 'n' ? 0.03 : -0.03) : cz, DOOR_W, DOOR_H, face);
  for (let i = 0; i < 5; i++) {
    const y = 0.35 + i * 0.48, tilt = (R() - 0.5) * 0.5;
    box(M.planks, cx, y, cz, alongX ? DOOR_W + 0.5 : 0.06, 0.22, alongX ? 0.06 : DOOR_W + 0.5, [alongX ? 0 : tilt, 0, alongX ? tilt : 0], true, 'wood');
  }
}
function graffitiOn(face, b, y, tex) {
  const alongX = face === 'n' || face === 's';
  const lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1;
  if (hi - lo < 5) return;
  const a = rr(lo + 2.5, hi - 2.5), o = 0.035;
  const cx = alongX ? a : face === 'w' ? b.x0 - o : b.x1 + o, cz = alongX ? (face === 'n' ? b.z0 - o : b.z1 + o) : a;
  decal(tex, cx, y, cz, 3.6, 1.35, face);
}

const SIGNS = ['MART', 'PHARMACY', 'DINER', 'LAUNDRY', 'HARDWARE', 'PAWN', 'BAKERY', 'VIDEO', 'BARBER', 'TOYS'];
const GRAFFITI_TEXT = [
  ['LA LA LA', '#b0101a'], ["DON'T LOOK BACK", '#c8c8c8'], ['IT CANT SEE INSIDE', '#d0a020'],
  ['KEEP YOUR LIGHT ON', '#30a0c0'], ['IT CLIMBS', '#b0101a'], ['HIDE. MOVE. HIDE.', '#c8c8c8'],
  ['IT SMELLS YOU', '#b0101a'], ['WE WERE HERE', '#60c060'], ['RUN', '#b0101a'], ['THEY SING AT NIGHT', '#a050c0'],
];
let graffitiMats = [];

// furniture inside hide buildings (low colliders so hands bump them)
function bed(x, z, rotY) {
  const w = rotY ? 2 : 1.1, d = rotY ? 1.1 : 2;
  boxC(M.wood, x - w / 2, x + w / 2, 0.06, 0.4, z - d / 2, z + d / 2);
  box(M.cloth, x, 0.5, z, w - 0.1, 0.2, d - 0.1);
  box(M.white, rotY ? x - w / 2 + 0.3 : x, 0.66, rotY ? z : z - d / 2 + 0.3, rotY ? 0.4 : 0.8, 0.12, rotY ? 0.8 : 0.4);
}
function table(x, z) {
  boxC(M.wood, x - 0.6, x + 0.6, 0.72, 0.78, z - 0.4, z + 0.4);
  for (const [dx, dz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) box(M.wood, x + dx, 0.37, z + dz, 0.06, 0.72, 0.06);
  box(M.wood, x + 0.9, 0.23, z, 0.45, 0.45, 0.45, [0, 0, 0.3]);   // knocked-over chair
}
function shelf(x, z, alongX, h = 1.8) {
  const w = alongX ? 1.6 : 0.4, d = alongX ? 0.4 : 1.6;
  boxC(M.wood, x - w / 2, x + w / 2, 0.06, h, z - d / 2, z + d / 2);
  for (let i = 0; i < 5; i++) box(pick(M.paint), x + (alongX ? rr(-0.6, 0.6) : 0), rr(0.3, h - 0.2), z + (alongX ? 0 : rr(-0.6, 0.6)), 0.18, 0.22, 0.18, [0, R(), 0]);
}
function crate(x, y, z, s = 0.8) { box(M.planks, x, y + s / 2, z, s, s, s, [0, R() * 0.6, 0], true, 'wood'); }

function addHideZone(b, top, door, kind) {
  const z = { x0: b.x0 + T_W, x1: b.x1 - T_W, z0: b.z0 + T_W, z1: b.z1 - T_W, top, kind, id: hideZones.length,
    door: { ox: door.ox, oz: door.oz, ix: door.ix, iz: door.iz } };
  hideZones.push(z);
  return z;
}
// door hole on face `face` at position `at`, returns outside + inside points for the monster's path
function doorPoints(face, at, b) {
  if (face === 'n') return { ox: at, oz: b.z0 - 1.6, ix: at, iz: b.z0 + 1.4 };
  if (face === 's') return { ox: at, oz: b.z1 + 1.6, ix: at, iz: b.z1 - 1.4 };
  if (face === 'w') return { ox: b.x0 - 1.6, oz: at, ix: b.x0 + 1.4, iz: at };
  return { ox: b.x1 + 1.6, oz: at, ix: b.x1 - 1.4, iz: at };
}
const FACES = ['n', 's', 'w', 'e'];
const facesBut = (f) => FACES.filter((x) => x !== f);
function midOf(face, b) { return face === 'n' || face === 's' ? (b.x0 + b.x1) / 2 : (b.z0 + b.z1) / 2; }

// Flat roof with a little wall (parapet) around it. Climbable!
function flatRoof(b, h, mat = M.tar) {
  boxC(mat, b.x0 - 0.1, b.x1 + 0.1, h, h + 0.3, b.z0 - 0.1, b.z1 + 0.1, true, 'roof');
  const p = 0.25, ph = 0.7;
  boxC(M.concrete, b.x0 - 0.1, b.x1 + 0.1, h + 0.3, h + ph, b.z0 - 0.1, b.z0 - 0.1 + p);
  boxC(M.concrete, b.x0 - 0.1, b.x1 + 0.1, h + 0.3, h + ph, b.z1 + 0.1 - p, b.z1 + 0.1);
  boxC(M.concrete, b.x0 - 0.1, b.x0 - 0.1 + p, h + 0.3, h + ph, b.z0 + 0.15, b.z1 - 0.15);
  boxC(M.concrete, b.x1 + 0.1 - p, b.x1 + 0.1, h + 0.3, h + ph, b.z0 + 0.15, b.z1 - 0.15);
}
function waterTower(x, y, z) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(M.wood, x + dx, y + 1.2, z + dz, 0.15, 2.4, 0.15);
  geo(M.planks, CYL, x, y + 3.4, z, 2.8, 2.2, 2.8);
  geo(M.roof, new THREE.ConeGeometry(0.5, 1, 8), x, y + 4.9, z, 3, 0.9, 3);
  addSolid(x - 1.4, x + 1.4, y, y + 4.5, z - 1.4, z + 1.4, 'wood');
}
function gableRoof(b, h, alongX, mat = M.roof) {
  const w = alongX ? b.z1 - b.z0 : b.x1 - b.x0, L = (alongX ? b.x1 - b.x0 : b.z1 - b.z0) + 0.8, rise = w * 0.38;
  const half = w / 2 + 0.4, slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  // two tilted slabs
  for (const s of [-1, 1]) {
    const off = (half / 2) * s;
    if (alongX) box(mat, cx, h + rise / 2, cz + off, L, 0.12, slope, [ang * -s, 0, 0]);
    else box(mat, cx + off, h + rise / 2, cz, slope, 0.12, L, [0, 0, ang * s]);
  }
  // triangle ends (gables)
  const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
  const tg = new THREE.ShapeGeometry(tri);
  for (const s of [-1, 1]) {
    const lx = alongX ? cx + s * (L / 2 - 0.4) : cx, lz = alongX ? cz : cz + s * (L / 2 - 0.4);
    geo(M.plaster, tg, lx, h, lz, 1, 1, 1, [0, alongX ? Math.PI / 2 * s : (s > 0 ? 0 : Math.PI), 0]);
  }
  // stepped colliders, so hands can climb it
  boxC(mat, b.x0, b.x1, h, h + 0.15, b.z0, b.z1, true, 'roof');
  for (let k = 1; k <= 3; k++) {
    const f = k / 4, y = h + rise * f, inset = (w / 2) * f;
    if (alongX) addSolid(b.x0, b.x1, h, y, b.z0 + inset, b.z1 - inset, 'roof');
    else addSolid(b.x0 + inset, b.x1 - inset, h, y, b.z0, b.z1, 'roof');
  }
}

function house(b, door, wm) {
  const h = 3.2, at = midOf(door, b);
  for (const f of FACES) wall(wm, b, f, 0, h, f === door ? [{ a: at - DOOR_W / 2, b: at + DOOR_W / 2, y0: 0, y1: DOOR_H }] : []);
  windowsOn(b, FACES, 1, 3.2, 1.0, 1.2, 3, { face: door, at }, 0.1);
  const alongX = (b.x1 - b.x0) >= (b.z1 - b.z0);
  gableRoof(b, h, alongX);
  // chimney
  const chx = rr(b.x0 + 1.5, b.x1 - 1.5), chz = rr(b.z0 + 1.5, b.z1 - 1.5);
  boxC(M.brick, chx - 0.4, chx + 0.4, h, h + 3.6, chz - 0.4, chz + 0.4);
  // porch: little roof over the door on two posts
  const dp = doorPoints(door, at, b);
  const px = (dp.ox + (door === 'w' ? b.x0 : door === 'e' ? b.x1 : at)) / 2, pz = (dp.oz + (door === 'n' ? b.z0 : door === 's' ? b.z1 : at)) / 2;
  const alongDoor = door === 'n' || door === 's';
  box(M.planks, px, 2.75, pz, alongDoor ? 3.2 : 1.8, 0.12, alongDoor ? 1.8 : 3.2, [alongDoor ? (door === 'n' ? -0.15 : 0.15) : 0, 0, alongDoor ? 0 : (door === 'w' ? 0.15 : -0.15)], true, 'wood');
  for (const s of [-1, 1]) {
    const ox = alongDoor ? s * 1.4 : (door === 'w' ? -0.7 : 0.7), oz = alongDoor ? (door === 'n' ? -0.7 : 0.7) : s * 1.4;
    box(M.wood, (door === 'w' ? b.x0 : door === 'e' ? b.x1 : at) + ox, 1.35, (door === 'n' ? b.z0 : door === 's' ? b.z1 : at) + oz, 0.12, 2.7, 0.12, null, true, 'wood');
  }
  // inside: wood floor, bed, table, shelf, rug
  boxC(M.planks, b.x0 + T_W, b.x1 - T_W, 0, 0.06, b.z0 + T_W, b.z1 - T_W, true, 'floor');
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const far = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[door];
  bed(cx + far[0] * ((b.x1 - b.x0) / 2 - 1.5) + (far[0] ? 0 : 1.5), cz + far[1] * ((b.z1 - b.z0) / 2 - 1.5) + (far[1] ? 0 : 1.5), !far[1]);
  table(cx - (far[1] ? 2 : 0), cz - (far[0] ? 2 : 0));
  shelf(b.x0 + 0.6, cz + 1.5, false);
  box(M.cloth, cx, 0.07, cz, 2.2, 0.01, 1.6);
  return addHideZone(b, h, dp, 'house');
}

function apartment(b, door, wm) {
  const floors = 3 + Math.floor(R() * 3), fh = 3.2, h = floors * fh, at = midOf(door, b);
  for (const f of FACES) wall(wm, b, f, 0, h, []);
  windowsOn(b, FACES, floors, fh, 1.1, 1.4, 2.6, { face: door, at }, 0.06);
  boardedDoor(door, at, b);
  flatRoof(b, h);
  if (R() < 0.6) waterTower(rr(b.x0 + 2.5, b.x1 - 2.5), h + 0.3, rr(b.z0 + 2.5, b.z1 - 2.5));
  // AC units on the roof
  for (let i = 0; i < 2; i++) box(M.metal, rr(b.x0 + 1.5, b.x1 - 1.5), h + 0.7, rr(b.z0 + 1.5, b.z1 - 1.5), 1.2, 0.8, 1, null, true, 'metal');
  // fire escape on a side face: platforms every floor + ladder rungs. Great for climbing!
  const fe = pick(facesBut(door));
  const alongX = fe === 'n' || fe === 's';
  const lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1, a0 = lo + (hi - lo) * 0.25, a1 = a0 + 3.2;
  const outer = fe === 'n' ? b.z0 - 1.2 : fe === 's' ? b.z1 + 1.2 : fe === 'w' ? b.x0 - 1.2 : b.x1 + 1.2;
  const inner = fe === 'n' ? b.z0 : fe === 's' ? b.z1 : fe === 'w' ? b.x0 : b.x1;
  const o0 = Math.min(outer, inner), o1 = Math.max(outer, inner);
  for (let f = 1; f < floors; f++) {
    const y = f * fh;
    if (alongX) { boxC(M.rust, a0, a1, y - 0.06, y, o0, o1, true, 'metal'); boxC(M.rust, a0, a1, y + 0.9, y + 0.96, outer < inner ? o0 : o1 - 0.06, outer < inner ? o0 + 0.06 : o1); }
    else { boxC(M.rust, o0, o1, y - 0.06, y, a0, a1, true, 'metal'); boxC(M.rust, outer < inner ? o0 : o1 - 0.06, outer < inner ? o0 + 0.06 : o1, y + 0.9, y + 0.96, a0, a1); }
  }
  // the ladder down the side
  for (let y = 1.2; y < (floors - 1) * fh; y += 0.45) {
    if (alongX) boxC(M.rust, a1 - 0.6, a1, y, y + 0.05, outer < inner ? o0 : o1 - 0.1, outer < inner ? o0 + 0.1 : o1, true, 'metal');
    else boxC(M.rust, outer < inner ? o0 : o1 - 0.1, outer < inner ? o0 + 0.1 : o1, y, y + 0.05, a1 - 0.6, a1, true, 'metal');
  }
  return null;
}

function shop(b, door, wm, n) {
  const h = 4.2, alongX = door === 'n' || door === 's', mid = midOf(door, b);
  const sw = Math.min(5, (alongX ? b.x1 - b.x0 : b.z1 - b.z0) - DOOR_W - 1.3);
  const total = sw + 0.3 + DOOR_W, start = mid - total / 2, at = start + sw / 2;
  // storefront: a big smashed window (you can climb through it) and a door next to it
  for (const f of FACES) wall(wm, b, f, 0, h, f === door ? [{ a: start, b: start + sw, y0: 0.6, y1: 3.0 }, { a: start + sw + 0.3, b: start + total, y0: 0, y1: DOOR_H }] : []);
  const dAt = start + sw + 0.3 + DOOR_W / 2;
  for (let i = 0; i < 6; i++) {   // jagged glass bits left in the window
    const a = at - sw / 2 + R() * sw, o = 0.15;
    const base = door === 'n' ? b.z0 + o : door === 's' ? b.z1 - o : door === 'w' ? b.x0 + o : b.x1 - o;
    const gx = alongX ? a : base, gz = alongX ? base : a, gs = 0.3 + R() * 0.5;
    box(M.glass, gx, R() < 0.5 ? 0.75 : 2.85, gz, alongX ? gs : 0.02, gs, alongX ? 0.02 : gs, [0, 0, alongX ? R() : 0]);
  }
  windowsOn(b, facesBut(door), 1, 4, 1.2, 1.4, 3.5, null, 0.04);
  flatRoof(b, h);
  // awning + sign
  const o1 = 1.5, base = door === 'n' ? b.z0 : door === 's' ? b.z1 : door === 'w' ? b.x0 : b.x1, out = door === 'n' || door === 'w' ? -1 : 1;
  if (alongX) box(M.awning, at, 3.3, base + out * o1 / 2, sw + 1, 0.06, o1, [out * 0.35, 0, R() < 0.3 ? 0.15 : 0]);
  else box(M.awning, base + out * o1 / 2, 3.3, at, o1, 0.06, sw + 1, [R() < 0.3 ? 0.15 : 0, 0, -out * 0.35]);
  const sm = lam({ map: signTex([{ text: SIGNS[n % SIGNS.length], y: 128, size: 120 }], '#16120e', '#c8b070') });
  decal(sm, alongX ? at : base + out * 0.05, 3.75, alongX ? base + out * 0.05 : at, Math.min(6, sw + 1), 0.8, door);
  // inside: shelves + counter
  boxC(M.concrete, b.x0 + T_W, b.x1 - T_W, 0, 0.05, b.z0 + T_W, b.z1 - T_W, true, 'floor');
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  for (let i = -1; i <= 1; i++) shelf(cx + (alongX ? i * 2.5 : 0), cz + (alongX ? 0 : i * 2.5), alongX, 1.5);
  const dp = doorPoints(door, dAt, b);
  return addHideZone(b, h, dp, 'shop');
}

function warehouse(b, door, wm) {
  const h = 6.5, at = midOf(door, b), W = 4;
  for (const f of FACES) wall(M.metal, b, f, 0, h, f === door ? [{ a: at - W / 2, b: at + W / 2, y0: 0, y1: 3.4 }] : []);
  // roll-up door stuck half open above the hole
  const alongX = door === 'n' || door === 's', o = 0.18, base = door === 'n' ? b.z0 - o : door === 's' ? b.z1 + o : door === 'w' ? b.x0 - o : b.x1 + o;
  box(M.rust, alongX ? at : base, 2.9, alongX ? base : at, alongX ? W + 0.2 : 0.1, 1.0, alongX ? 0.1 : W + 0.2);
  windowsOn(b, facesBut(door), 1, 4, 1.6, 0.8, 4, null, 0.0);
  flatRoof(b, h, M.metal);
  boxC(M.concrete, b.x0 + T_W, b.x1 - T_W, 0, 0.05, b.z0 + T_W, b.z1 - T_W, true, 'floor');
  for (let i = 0; i < 9; i++) {
    const x = rr(b.x0 + 1.5, b.x1 - 1.5), z = rr(b.z0 + 1.5, b.z1 - 1.5);
    const dp = doorPoints(door, at, b);
    if (Math.hypot(x - dp.ix, z - dp.iz) < 3) continue;
    crate(x, 0.05, z, rr(0.7, 1.2));
    if (R() < 0.4) crate(x, 1.05, z, 0.7);
  }
  return addHideZone(b, h, doorPoints(door, at, b), 'warehouse');
}

function church(b, door, isFirst) {
  const h = 7, at = midOf(door, b), wm = M.concrete2;
  for (const f of FACES) wall(wm, b, f, 0, h, f === door ? [{ a: at - 1.2, b: at + 1.2, y0: 0, y1: 3.2 }] : []);
  windowsOn(b, facesBut(door), 1, 7, 0.9, 3.0, 2.8, null, 0.0);
  const alongX = door === 'w' || door === 'e';   // roof ridge runs away from the door
  gableRoof(b, h, alongX, M.roof);
  // bell tower over the door
  const base = door === 'n' ? b.z0 : door === 's' ? b.z1 : door === 'w' ? b.x0 : b.x1, out = door === 'n' || door === 'w' ? 1 : -1;
  const tx = alongX ? base + out * 1.6 : at, tz = alongX ? at : base + out * 1.6;
  boxC(wm, tx - 1.6, tx + 1.6, h, h + 6, tz - 1.6, tz + 1.6);
  geo(M.roof, CONE4, tx, h + 9, tz, 3.6, 6, 3.6, [0, Math.PI / 4, 0]);
  box(M.dark, tx, h + 13.2, tz, 0.15, 1.6, 0.15); box(M.dark, tx, h + 13.5, tz, 0.9, 0.15, 0.15);
  // inside: pews, altar, candles
  boxC(M.planks, b.x0 + T_W, b.x1 - T_W, 0, 0.05, b.z0 + T_W, b.z1 - T_W, true, 'floor');
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, dir = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[door];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const px = cx + (dir[0] ? dir[0] * (i * 2 - 3) : s * 1.8), pz = cz + (dir[1] ? dir[1] * (i * 2 - 3) : s * 1.8);
    const tilt = R() < 0.25 ? 0.5 : 0;
    box(M.wood, px, 0.45, pz, dir[1] ? 2.4 : 0.5, 0.5, dir[1] ? 0.5 : 2.4, [0, tilt, 0], true, 'wood');
  }
  const ax = cx + dir[0] * ((b.x1 - b.x0) / 2 - 1.3), az = cz + dir[1] * ((b.z1 - b.z0) / 2 - 1.3);
  boxC(M.white, ax - 0.8, ax + 0.8, 0.05, 1.05, az - 0.8, az + 0.8, true, 'wood');
  for (let i = 0; i < 5; i++) {
    const x = ax + rr(-0.6, 0.6), z = az + rr(-0.6, 0.6);
    box(M.white, x, 1.15, z, 0.06, 0.2, 0.06); box(M.candle, x, 1.28, z, 0.03, 0.05, 0.03);
  }
  if (isFirst) secretSpots.musicBox = new THREE.Vector3(ax, 1.15, az);
  return addHideZone(b, h, doorPoints(door, at, b), 'church');
}

function tower(b) {
  const floors = 6 + Math.floor(R() * 5), fh = 3.4, h = floors * fh;
  const wm = pick([M.concrete, M.concrete2, M.brick2]);
  for (const f of FACES) wall(wm, b, f, 0, h, []);
  // window strips: lots of glass, many dark/broken
  for (const face of FACES) {
    const alongX = face === 'n' || face === 's';
    const lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1, n = Math.floor((hi - lo) / 2);
    for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
      const a = lo + (hi - lo) / n * (i + 0.5);
      const k = R(), out = 0.02;
      const mat = k < 0.05 ? M.lit : k < 0.45 ? M.black : M.glass;
      const cx = alongX ? a : face === 'w' ? b.x0 - out : b.x1 + out, cz = alongX ? (face === 'n' ? b.z0 - out : b.z1 + out) : a;
      decal(mat, cx, f * fh + 1.8, cz, 1.6, 1.8, face);
    }
  }
  boardedDoor(pick(FACES), midOf('n', b), b);
  // broken top: a chunk of the roof caved in, rubble and a bent antenna
  flatRoof(b, h);
  for (let i = 0; i < 8; i++) box(wm, rr(b.x0 + 1, b.x1 - 1), h + rr(0.4, 1.2), rr(b.z0 + 1, b.z1 - 1), rr(0.6, 2), rr(0.4, 1), rr(0.6, 2), [R(), R(), R()]);
  const ax = rr(b.x0 + 2, b.x1 - 2), az = rr(b.z0 + 2, b.z1 - 2);
  box(M.pole, ax, h + 4, az, 0.2, 8, 0.2, [0.25, 0, 0.1]);
  return null;
}

function ruin(b) {
  // burnt-out shell: broken walls of random heights, no roof, rubble inside
  const wm = pick([M.brick, M.brick2, M.concrete]);
  for (const f of FACES) {
    const alongX = f === 'n' || f === 's', lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1;
    let a = lo;
    while (a < hi - 0.5) {
      const L = Math.min(hi - a, rr(1.2, 3.5)), hh = R() < 0.2 ? 0 : rr(0.6, 5.5);
      if (hh > 0) {
        if (alongX) { const z0 = f === 'n' ? b.z0 : b.z1 - T_W; boxC(wm, a, a + L, 0, hh, z0, z0 + T_W, true, 'wall'); }
        else { const x0 = f === 'w' ? b.x0 : b.x1 - T_W; boxC(wm, x0, x0 + T_W, 0, hh, a, a + L, true, 'wall'); }
      }
      a += L;
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = rr(b.x0 + 1, b.x1 - 1), z = rr(b.z0 + 1, b.z1 - 1), s = rr(0.4, 1.6);
    box(R() < 0.5 ? wm : M.trunk, x, s * 0.3, z, s, s * 0.6, s * rr(0.6, 1.4), [R() * 0.6, R() * 3, R() * 0.6], s > 1, 'rubble');
  }
  for (let i = 0; i < 3; i++) box(M.trunk, rr(b.x0 + 2, b.x1 - 2), 1, rr(b.z0 + 2, b.z1 - 2), 0.25, 0.25, rr(3, 6), [rr(-0.5, 0.5), R() * 3, 0.4]);
  return null;
}

function gasStation(cx, cz) {
  // canopy on four posts, two pumps, and a tiny shop you can hide in
  boxC(M.white, cx - 7, cx + 7, 4.6, 5.0, cz - 5, cz + 5, true, 'roof');
  box(M.red, cx, 4.8, cz - 5.02, 14, 0.4, 0.04);
  for (const [dx, dz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) box(M.white, cx + dx, 2.3, cz + dz, 0.4, 4.6, 0.4, null, true, 'metal');
  for (const dx of [-3, 3]) {
    boxC(M.concrete, cx + dx - 1, cx + dx + 1, 0.12, 0.3, cz - 2, cz + 2, true, 'floor');
    box(M.red, cx + dx, 1.0, cz, 0.6, 1.4, 0.9, [0, 0, dx > 0 && R() < 0.5 ? 0.3 : 0], true, 'metal');
    box(M.litTV, cx + dx + 0.31, 1.3, cz, 0.01, 0.3, 0.4);
  }
  const sm = lam({ map: signTex([{ text: 'GAS', y: 90, size: 110 }, { text: '$0.00', y: 190, size: 60 }], '#2a0c0c', '#e0d0b0') });
  box(M.pole, cx - 9, 3, cz - 6, 0.3, 6, 0.3, null, true, 'metal');
  decal(sm, cx - 9, 6.5, cz - 6.2, 3, 1.5, 'n');
  decal(sm, cx - 9, 6.5, cz - 5.8, 3, 1.5, 's');
  const b = { x0: cx - 4, x1: cx + 4, z0: cz + 8, z1: cz + 14 };
  return shop(b, 'n', M.plaster3, 0);
}

// ---------- street props ----------
const lamps = [];   // lit lamps: {x, z, g (flicker group)}
function streetLamp(x, z, faceX, faceZ) {
  box(M.pole, x, 2.8, z, 0.16, 5.6, 0.16, null, true, 'metal');
  const hx = x + faceX * 1.2, hz = z + faceZ * 1.2;
  box(M.pole, (x + hx) / 2, 5.55, (z + hz) / 2, Math.abs(faceX) * 1.3 + 0.08, 0.08, Math.abs(faceZ) * 1.3 + 0.08);
  box(M.pole, hx, 5.45, hz, 0.5, 0.18, 0.5);
  const roll = R();
  if (roll < 0.3) {
    const g = Math.floor(R() * 3);
    box(M.bulbs[g], hx, 5.32, hz, 0.34, 0.06, 0.34);
    geo(M.shafts[g], new THREE.ConeGeometry(1, 1, 12, 1, true), hx, 2.7, hz, 2.6, 5.3, 2.6);
    lamps.push({ x: hx, z: hz, g });
  } else if (roll < 0.45) {
    // a fallen lamp head lying on the sidewalk
    box(M.pole, hx + 0.4, 0.15, hz + 0.3, 0.5, 0.2, 0.5, [0.5, R() * 3, 0.3], true, 'metal');
  }
}
function car(x, z, alongX) {
  const paint = pick(M.paint), flipped = R() < 0.12, burnt = R() < 0.2;
  const body = burnt ? M.rust : paint, yaw = (alongX ? 0 : Math.PI / 2) + rr(-0.25, 0.25), L = 4.2, W = 1.8;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
  const P = (lx, ly, lz, sx, sy, sz, mat, extraRot = 0) => { const [px, py, pz] = at(lx, ly, lz); box(mat, px, py, pz, sx, sy, sz, [0, yaw + extraRot, 0]); };
  const Y = flipped ? (y) => 1.55 - y : (y) => y;
  P(0, Y(0.62), 0, L, 0.6, W, body);
  P(-0.2, Y(1.15), 0, 2.2, 0.5, W - 0.15, flipped ? body : (burnt ? M.black : M.glass));
  P(-0.2, Y(1.42), 0, 2.0, 0.06, W - 0.2, body);
  for (const [lx, lz] of [[1.35, 0.85], [-1.35, 0.85], [1.35, -0.85], [-1.35, -0.85]]) {
    if (burnt && R() < 0.5) continue;
    const [px, , pz] = at(lx, 0, lz);
    geo(M.tire, CYL, px, Y(0.36), pz, 0.72, 0.26, 0.72, [Math.PI / 2, yaw + Math.PI / 2, 0]);
  }
  if (!burnt) { P(L / 2 + 0.01, Y(0.7), 0.6, 0.02, 0.14, 0.3, M.white); P(L / 2 + 0.01, Y(0.7), -0.6, 0.02, 0.14, 0.3, M.white); }
  const r = Math.max(Math.abs(c) * L + Math.abs(s) * W, Math.abs(s) * L + Math.abs(c) * W) / 2;
  const rz = Math.max(Math.abs(s) * L + Math.abs(c) * W, Math.abs(c) * L + Math.abs(s) * W) / 2;
  const ex = Math.abs(c) * L / 2 + Math.abs(s) * W / 2, ez = Math.abs(s) * L / 2 + Math.abs(c) * W / 2;
  void r; void rz;
  addSolid(x - ex, x + ex, 0, 0.95, z - ez, z + ez, 'car');
  addSolid(x - ex * 0.55, x + ex * 0.55, 0.95, 1.45, z - ez * 0.55, z + ez * 0.55, 'car');
}
function deadTree(x, z) {
  const h = rr(4, 7);
  box(M.trunk, x, h / 2, z, 0.32, h, 0.32, [rr(-0.08, 0.08), R() * 3, rr(-0.08, 0.08)]);
  addSolid(x - 0.2, x + 0.2, 0, h, z - 0.2, z + 0.2, 'tree');
  for (let i = 0; i < 5; i++) {
    const y = h * rr(0.45, 0.95), L = rr(1, 2.4), a = R() * 6.28, tilt = rr(0.5, 1.1);
    const dx = Math.cos(a) * Math.sin(tilt) * L / 2, dz = Math.sin(a) * Math.sin(tilt) * L / 2, dy = Math.cos(tilt) * L / 2;
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
    _e.setFromQuaternion(_q);
    box(M.trunk, x + dx, y + dy, z + dz, 0.1, L, 0.1, [_e.x, _e.y, _e.z]);
    // little twigs
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx + rr(-0.5, 0.5), dy, dz + rr(-0.5, 0.5)).normalize());
    _e.setFromQuaternion(_q);
    box(M.trunk, x + dx * 2, y + dy * 2 + 0.2, z + dz * 2, 0.05, 0.7, 0.05, [_e.x, _e.y, _e.z]);
  }
}
function dumpster(x, z, alongX) {
  const w = alongX ? 2 : 1.3, d = alongX ? 1.3 : 2;
  boxC(pick([M.paint[1], M.paint[2], M.rust]), x - w / 2, x + w / 2, 0.15, 1.3, z - d / 2, z + d / 2, true, 'metal');
  box(M.dark, x, 1.38, z, w + 0.05, 0.08, d + 0.05, [alongX ? 0 : 0.3, 0, alongX ? 0.3 : 0]);
  for (let i = 0; i < 3; i++) geo(M.black, SPH, x + rr(-1.2, 1.2), 0.25, z + rr(-1.2, 1.2), rr(0.5, 0.8), rr(0.4, 0.55), rr(0.5, 0.8));   // trash bags
}
function barrel(x, z, fallen = false) {
  if (fallen) { geo(M.rust, CYL, x, 0.3, z, 0.6, 0.9, 0.6, [Math.PI / 2, R() * 3, 0]); addSolid(x - 0.45, x + 0.45, 0, 0.6, z - 0.45, z + 0.45, 'metal'); }
  else { geo(M.rust, CYL, x, 0.45, z, 0.6, 0.9, 0.6); addSolid(x - 0.3, x + 0.3, 0, 0.9, z - 0.3, z + 0.3, 'metal'); }
}
function hydrant(x, z) { geo(M.red, CYL6, x, 0.35, z, 0.25, 0.7, 0.25); geo(M.red, SPH, x, 0.72, z, 0.25, 0.2, 0.25); addSolid(x - 0.15, x + 0.15, 0, 0.8, z - 0.15, z + 0.15, 'metal'); }
function fenceRun(x0, z0, x1, z1) {
  const L = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  box(M.fence, (x0 + x1) / 2, 1.1, (z0 + z1) / 2, alongX ? L : 0.03, 2.2, alongX ? 0.03 : L, [rr(-0.05, 0.05), 0, rr(-0.05, 0.05)]);
  addSolid(Math.min(x0, x1) - 0.05, Math.max(x0, x1) + 0.05, 0, 2.2, Math.min(z0, z1) - 0.05, Math.max(z0, z1) + 0.05, 'fence');
  for (let a = 0; a <= L; a += 2.5) {
    const t = a / L;
    box(M.pole, x0 + (x1 - x0) * t, 1.15, z0 + (z1 - z0) * t, 0.07, 2.3, 0.07);
  }
}
const wires = [];
function powerPole(x, z) {
  box(M.wood, x, 4.5, z, 0.26, 9, 0.26, [rr(-0.04, 0.04), 0, rr(-0.04, 0.04)], true, 'wood');
  box(M.wood, x, 8.4, z, 2.4, 0.15, 0.15);
  wires.push([x, z]);
}

// ---------- the park in the middle (where you spawn) ----------
function park() {
  box(M.grass, 0, 0.13, 0, 43.5, 0.02, 43.5);
  // dry fountain with a statue
  geo(M.concrete, CYL, 0, 0.4, -6, 7, 0.8, 7);
  geo(M.dark, CYL, 0, 0.42, -6, 6.2, 0.8, 6.2);
  addSolid(-3.5, 3.5, 0, 0.8, -9.5, -2.5, 'stone');
  geo(M.concrete, CYL, 0, 1.4, -6, 0.9, 2, 0.9);
  addSolid(-0.45, 0.45, 0, 2.4, -6.45, -5.55, 'stone');
  // the statue: a figure with its head knocked off
  geo(M.concrete2, CYL, 0, 3.1, -6, 0.7, 1.4, 0.5);
  box(M.concrete2, 0.5, 3.2, -6, 0.2, 1.1, 0.2, [0, 0, 0.6]);
  box(M.concrete2, -0.5, 3.4, -6, 0.2, 1.1, 0.2, [0, 0, -0.9]);
  geo(M.concrete2, SPH, 2.2, 0.95, -4.6, 0.45, 0.45, 0.45);   // the head, lying on the rim
  // benches
  for (const [x, z, r] of [[-6, 2, 0], [6, 2, 0], [-9, -6, Math.PI / 2], [9, -6, Math.PI / 2]]) {
    box(M.wood, x, 0.5, z, r ? 0.5 : 2, 0.08, r ? 2 : 0.5, null, true, 'wood');
    box(M.wood, x + (r ? 0.25 : 0), 0.8, z + (r ? 0 : 0.25), r ? 0.06 : 2, 0.5, r ? 2 : 0.06, [r ? 0 : -0.15, 0, r ? 0.15 : 0]);
    for (const s of [-0.8, 0.8]) box(M.pole, x + (r ? 0 : s), 0.25, z + (r ? s : 0), 0.06, 0.5, 0.4);
  }
  // swing set (the seats move: see update)
  const sx = 11, sz = 10;
  for (const s of [-2, 2]) {
    box(M.rust, sx + s, 1.3, sz - 0.9, 0.1, 2.8, 0.1, [0.35, 0, 0], true, 'metal');
    box(M.rust, sx + s, 1.3, sz + 0.9, 0.1, 2.8, 0.1, [-0.35, 0, 0], true, 'metal');
  }
  box(M.rust, sx, 2.6, sz, 4.2, 0.1, 0.1, null, true, 'metal');
  // the welcome sign
  const sign = lam({ map: signTex([{ text: 'WELCOME TO', y: 70, size: 48 }, { text: 'HOLLOW CREEK', y: 135, size: 72 }, { text: 'pop. 0', y: 205, size: 44 }]) });
  for (const s of [-1.6, 1.6]) box(M.wood, s, 1.1, 14, 0.15, 2.2, 0.15, null, true, 'wood');
  boxC(M.wood, -2, 2, 1.2, 3.2, 13.9, 14.02, true, 'wood');
  decal(sign, 0, 2.2, 13.86, 3.9, 1.9, 'n');
  decal(sign, 0, 2.2, 14.06, 3.9, 1.9, 's');
  // payphone (secret spot)
  box(M.pole, -8, 1.1, 12, 0.12, 2.2, 0.12, null, true, 'metal');
  boxC(M.paint[1], -8.35, -7.65, 1.0, 1.8, 11.7, 11.94, true, 'metal');
  box(M.black, -8, 1.5, 11.68, 0.25, 0.4, 0.04);
  box(M.dark, -8.2, 1.45, 11.66, 0.08, 0.3, 0.06);
  secretSpots.phone = new THREE.Vector3(-8, 1.45, 11.6);
  // park lamp (the one real light in town, it flickers)
  box(M.pole, 4, 2, 10, 0.14, 4, 0.14, null, true, 'metal');
  geo(M.bulbs[0], SPH, 4, 4.1, 10, 0.35, 0.35, 0.35);
  secretSpots.parkLamp = new THREE.Vector3(4, 4.1, 10);
  for (const [x, z] of [[-14, -14], [15, -13], [-15, 14], [14, -2]]) deadTree(x, z);
  return { swing: new THREE.Vector3(sx, 2.6, sz) };
}

// ---------- graffiti, teddy etc ----------
function teddy(x, y, z) {
  // a dusty teddy bear sitting on a bed (secret spot)
  const fur = lam({ color: 0x6a4a30 });
  const g = new THREE.Group();
  const add = (geo0, px, py, pz, sx, sy, sz, m = fur) => { const mm = new THREE.Mesh(geo0, m); mm.position.set(px, py, pz); mm.scale.set(sx, sy, sz); g.add(mm); return mm; };
  add(SPH, 0, 0.13, 0, 0.22, 0.26, 0.18);
  add(SPH, 0, 0.32, 0, 0.17, 0.16, 0.16);
  add(SPH, -0.07, 0.4, 0, 0.06, 0.06, 0.04); add(SPH, 0.07, 0.4, 0, 0.06, 0.06, 0.04);
  add(SPH, 0, 0.3, 0.07, 0.07, 0.05, 0.05, lam({ color: 0x9a7a5a }));
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const e1 = add(SPH, -0.035, 0.34, 0.075, 0.025, 0.025, 0.02, eyeM), e2 = add(SPH, 0.035, 0.34, 0.075, 0.025, 0.025, 0.02, eyeM);
  for (const s of [-1, 1]) { add(SPH, s * 0.12, 0.16, 0.02, 0.07, 0.12, 0.07); add(SPH, s * 0.07, 0.03, 0.08, 0.08, 0.07, 0.1); }
  g.position.set(x, y, z);
  return { g, eyeM };
}

// ---------- build it all ----------
export function buildCity(scene) {
  R = rng(20251127);
  makeMaterials();
  graffitiMats = GRAFFITI_TEXT.map(([t, c], i) => new THREE.MeshLambertMaterial({ map: graffiti(t, c, 40 + i), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));

  // ground (asphalt everywhere) and the city edge
  const groundGeo = new THREE.PlaneGeometry(HALF * 3, HALF * 3);
  const uv = groundGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * HALF * 3 / 8, uv.getY(i) * HALF * 3 / 8);
  const ground = new THREE.Mesh(groundGeo, M.asphalt);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const parkInfo = park();
  let shopN = 0, firstChurch = true, firstHouse = true, gasDone = false;
  const KINDS = ['house', 'house', 'house', 'apartment', 'apartment', 'shop', 'shop', 'warehouse', 'church', 'ruin', 'ruin', 'empty'];
  let teddyAt = null;

  for (let ix = -3; ix <= 3; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      const cx = ix * PITCH, cz = iz * PITCH;
      // sidewalk slab with a curb
      boxC(M.sidewalk, cx - 22, cx + 22, 0, 0.12, cz - 22, cz + 22, true, 'curb');
      // road lines on the street east and south of this block
      for (let a = -20; a < 22; a += 5) {
        box(M.yellow, cx + 26, 0.012, cz + a, 0.15, 0.01, 2.2);
        box(M.yellow, cx + a, 0.012, cz + 26, 2.2, 0.01, 0.15);
      }
      geo(M.dark, CYL, cx + 26, 0.015, cz + rr(-15, 15), 0.9, 0.01, 0.9);   // manhole
      // lamps on the corners
      streetLamp(cx + 21, cz + 21, 1, 0); streetLamp(cx - 21, cz - 21, -1, 0);
      if (R() < 0.5) streetLamp(cx + 21, cz - 21, 0, -1);
      if (ix === 0 && iz === 0) continue;   // the park

      if (!gasDone && ix === 1 && iz === -1) { gasDone = true; gasStation(cx, cz - 6); continue; }

      // a tall tower takes a whole block sometimes
      if (R() < 0.13 && (Math.abs(ix) + Math.abs(iz) > 1)) {
        const s = rr(14, 20);
        tower({ x0: cx - s / 2, x1: cx + s / 2, z0: cz - s / 2, z1: cz + s / 2 });
      } else {
        // otherwise four lots, each maybe with a building. Doors face the street.
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          let kind = pick(KINDS);
          if (firstChurch && ix === -1 && iz === 1 && lx === 1 && lz === -1) kind = 'church';
          if (firstHouse && ix === 0 && iz === 1) kind = 'house';
          if (kind === 'empty') {
            // an empty lot with a fence, a car or junk
            const ox = cx + lx * 11, oz = cz + lz * 11;
            if (R() < 0.6) fenceRun(ox - 8, oz + lz * 8, ox + 8, oz + lz * 8);
            if (R() < 0.5) car(ox + rr(-4, 4), oz + rr(-4, 4), R() < 0.5);
            for (let i = 0; i < 4; i++) barrel(ox + rr(-6, 6), oz + rr(-6, 6), R() < 0.4);
            continue;
          }
          const w = kind === 'house' ? rr(8, 10.5) : kind === 'church' ? 9 : kind === 'warehouse' ? rr(14, 18) : rr(9, 15);
          const d = kind === 'house' ? rr(8, 10) : kind === 'church' ? 15 : kind === 'warehouse' ? rr(11, 15) : rr(9, 15);
          const bx = cx + lx * 11 + rr(-1, 1), bz = cz + lz * 11 + rr(-1, 1);
          const b = { x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2 };
          // clamp inside the block
          const sh = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
          const dx = sh(0, cx - 21 - b.x0, cx + 21 - b.x1), dz = sh(0, cz - 21 - b.z0, cz + 21 - b.z1);
          b.x0 += dx; b.x1 += dx; b.z0 += dz; b.z1 += dz;
          if (kind === 'warehouse' && (w > 18 || d > 18)) continue;
          const door = R() < 0.5 ? (lx < 0 ? 'w' : 'e') : (lz < 0 ? 'n' : 's');
          const wm = pick([M.plaster, M.plaster2, M.plaster3]);
          let zone = null;
          if (kind === 'house') {
            zone = house(b, door, wm);
            if (firstHouse && ix === 0 && iz === 1) {
              firstHouse = false;
              // the teddy sits on the bed in this house
              teddyAt = { b, door };
            }
          } else if (kind === 'apartment') apartment(b, door, pick([M.brick, M.brick, M.brick2]));
          else if (kind === 'shop') zone = shop(b, door, pick([M.brick, M.concrete, M.plaster2]), shopN++);
          else if (kind === 'warehouse') zone = warehouse(b, door, M.metal);
          else if (kind === 'church') { zone = church(b, door, firstChurch); firstChurch = false; }
          else ruin(b);
          void zone;
          // graffiti on a wall that's not the door
          if (kind !== 'ruin' && R() < 0.55) graffitiOn(pick(facesBut(door)), b, rr(1.2, 2.2), pick(graffitiMats));
          // stuff around the building
          if (R() < 0.5) dumpster(b.x0 - 0.9 > cx - 21 ? b.x0 - 1 : b.x1 + 1, (b.z0 + b.z1) / 2 + rr(-2, 2), false);
          if (R() < 0.3) barrel(rr(b.x0, b.x1), b.z1 + 1.2 < cz + 21 ? b.z1 + 1.2 : b.z0 - 1.2, R() < 0.3);
        }
      }
      // street stuff: cars, trees, hydrants, power poles
      if (R() < 0.75) car(cx + 26 + rr(-2, 2), cz + rr(-18, 18), false);
      if (R() < 0.6) car(cx + rr(-18, 18), cz + 26 + rr(-2, 2), true);
      if (R() < 0.6) deadTree(cx + rr(-20, 20), cz + 21.2);
      if (R() < 0.6) deadTree(cx - 21.2, cz + rr(-20, 20));
      if (R() < 0.4) hydrant(cx + 21.3, cz + rr(-15, 15));
      if (R() < 0.7) powerPole(cx + 22.5, cz);
      if (R() < 0.5) for (let i = 0; i < 4; i++) box(M.concrete, cx + 26 + rr(-3, 3), 0.15, cz + rr(-20, 20), rr(0.3, 0.9), 0.3, rr(0.3, 0.9), [R(), R() * 3, R()]);   // rubble in the road
    }
  }
  // park street lamps also in the middle
  // the city edge: a tall broken fence + barriers all around
  for (const s of [-1, 1]) {
    fenceRun(-HALF, s * HALF, HALF, s * HALF);
    fenceRun(s * HALF, -HALF, s * HALF, HALF);
  }

  // teddy
  let teddyObj = null;
  if (teddyAt) {
    const { b, door } = teddyAt, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const far = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[door];
    const bx = cx + far[0] * ((b.x1 - b.x0) / 2 - 1.5) + (far[0] ? 0 : 1.5), bz = cz + far[1] * ((b.z1 - b.z0) / 2 - 1.5) + (far[1] ? 0 : 1.5);
    teddyObj = teddy(bx, 0.6, bz);
    scene.add(teddyObj.g);
    secretSpots.teddy = teddyObj.g.position.clone().add(new THREE.Vector3(0, 0.25, 0));
  }

  // power lines: sagging wires between poles in the same column
  {
    const pts = [];
    const cols = new Map();
    for (const [x, z] of wires) { const k = Math.round(x); if (!cols.has(k)) cols.set(k, []); cols.get(k).push([x, z]); }
    for (const list of cols.values()) {
      list.sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < list.length - 1; i++) {
        const [x0, z0] = list[i], [, z1] = list[i + 1];
        if (z1 - z0 > PITCH * 1.1) continue;
        for (const off of [-1.1, 0, 1.1]) {
          for (let k = 0; k < 8; k++) {
            const t0 = k / 8, t1 = (k + 1) / 8, sag = (t) => 8.4 - Math.sin(t * Math.PI) * 1.6;
            pts.push(x0 + off, sag(t0), z0 + (z1 - z0) * t0, x0 + off, sag(t1), z0 + (z1 - z0) * t1);
          }
        }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x050505 })));
  }

  // glue it all together, chunk by chunk
  const chunks = [];
  for (const [k, mats] of buckets) {
    const [i, j] = k.split(',').map(Number);
    const group = new THREE.Group();
    for (const [mat, list] of mats) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    group.matrixAutoUpdate = false;
    scene.add(group);
    chunks.push({ group, x: i * CHUNK, z: j * CHUNK });
  }
  buckets.clear();

  // swings: two seats that sway by themselves
  const seats = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(parkInfo.swing.x + s * 1, 2.6, parkInfo.swing.z);
    const chainM = new THREE.MeshLambertMaterial({ color: 0x333333 });
    for (const c of [-0.25, 0.25]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.9, 0.02), chainM); ch.position.set(c, -0.95, 0); piv.add(ch); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.22), M.rust); seat.position.y = -1.9; piv.add(seat);
    scene.add(piv);
    seats.push({ piv, ph: s * 1.7 });
  }

  // flicker the lamps in three groups
  const flick = [1, 1, 1];
  function update(dt, t, camPos, red) {
    for (let g = 0; g < 3; g++) {
      const n = Math.sin(t * (7 + g * 3)) * Math.sin(t * (2.3 + g)) + Math.sin(t * 0.7 + g * 2);
      flick[g] = n > 1.2 ? 0.15 : n > 1.0 ? 0.5 : 1;
      const c = red ? 0xff3030 : 0xffd9a0;
      M.bulbs[g].color.setHex(c).multiplyScalar(flick[g]);
      M.shafts[g].color.setHex(c);
      M.shafts[g].opacity = 0.07 * flick[g];
    }
    for (const s of seats) s.piv.rotation.x = Math.sin(t * 1.1 + s.ph) * 0.25;   // nobody is on them...
    for (const c of chunks) {
      const d = Math.hypot(c.x - camPos.x, c.z - camPos.z);
      c.group.visible = d < VIEW + CHUNK * 0.75;
    }
  }

  return { update, lamps, flick, teddy: teddyObj, M, T };
}

// ---------- the night sky ----------
export function makeSky(scene, T) {
  const group = new THREE.Group();
  const mkStars = (N, size, seed) => {
    const r0 = rng(seed), arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = r0() * Math.PI * 2, y = 0.08 + r0() * 0.92, r = 420, k = Math.sqrt(1 - y * y) * r;
      arr[i * 3] = Math.cos(th) * k; arr[i * 3 + 1] = y * r; arr[i * 3 + 2] = Math.sin(th) * k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: false, fog: false, transparent: true }));
    group.add(p);
    return p;
  };
  const stars = [mkStars(1400, 1.5, 7), mkStars(400, 2.5, 8), mkStars(90, 3.5, 9)];
  const moon = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ map: T.moon, fog: false }));
  moon.position.set(-170, 190, -250);
  group.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0x8090c0, transparent: true, opacity: 0.55, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(150, 150, 1);
  halo.position.copy(moon.position);
  group.add(halo);
  // a few dark clouds drifting past
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.mist, color: 0x10131c, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
    c.scale.set(260, 90, 1);
    c.position.set(-400 + i * 120, 230 + (i % 3) * 25, -300 + (i % 2) * 80);
    group.add(c);
    clouds.push(c);
  }
  scene.add(group);
  function update(dt, t, camPos, red) {
    group.position.set(camPos.x, 0, camPos.z);   // the sky goes with you
    for (let i = 0; i < 3; i++) stars[i].material.opacity = 0.65 + 0.35 * Math.sin(t * (1.3 + i * 0.9) + i);
    for (const c of clouds) { c.position.x += dt * 3; if (c.position.x > 450) c.position.x = -450; }
    moon.material.color.setHex(red ? 0xff3040 : 0xffffff);
    halo.material.color.setHex(red ? 0xa01020 : 0x8090c0);
  }
  return { update, moon };
}

// ---------- mist drifting near the ground, around you ----------
export function makeMist(scene, T) {
  const N = 60, list = [];
  const mat = new THREE.SpriteMaterial({ map: T.mist, color: 0x6a7590, transparent: true, opacity: 0.32, depthWrite: false, fog: true });
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(mat);
    const sc = 9 + Math.random() * 10;
    s.scale.set(sc, sc * 0.35, 1);
    s.position.set((Math.random() - 0.5) * 80, 0.6 + Math.random() * 1.6, (Math.random() - 0.5) * 80);
    scene.add(s);
    list.push(s);
  }
  function update(dt, cam, red) {
    mat.color.setHex(red ? 0x702030 : 0x6a7590);
    for (const s of list) {
      s.position.x += dt * 0.6;
      const dx = s.position.x - cam.x, dz = s.position.z - cam.z;
      if (dx > 40) s.position.x -= 80; else if (dx < -40) s.position.x += 80;
      if (dz > 40) s.position.z -= 80; else if (dz < -40) s.position.z += 80;
    }
  }
  return { update };
}

// ---------- crickets you can squish ----------
export function makeCrickets(scene, n = 60) {
  const geo0 = new THREE.SphereGeometry(0.06, 6, 4);
  geo0.scale(1.1, 0.7, 1.7);
  const mesh = new THREE.InstancedMesh(geo0, new THREE.MeshLambertMaterial({ color: 0x0b0a05 }), n);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const cs = [];
  let center = new THREE.Vector3();
  const place = (c) => {
    // crickets live near you (they appear in the dark around you)
    c.x = center.x + (Math.random() * 2 - 1) * 30;
    c.z = center.z + (Math.random() * 2 - 1) * 30;
    c.y = groundAt(c.x, c.z, 0.5);
    c.ground = c.y; c.vx = 0; c.vz = 0; c.vy = 0; c.dead = 0;
  };
  for (let i = 0; i < n; i++) { const c = { yaw: Math.random() * 6.28 }; place(c); cs.push(c); }
  function update(dt, cam, handPts, onSquish) {
    center = cam;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.dead > 0) { c.dead -= dt; if (c.dead <= 0) place(c); mesh.setMatrixAt(i, hidden); continue; }
      if (Math.abs(c.x - cam.x) > 34 || Math.abs(c.z - cam.z) > 34) place(c);
      let squished = false;
      for (const h of handPts) {
        const dx = c.x - h.x, dz = c.z - h.z, d = Math.hypot(dx, dz) || 1e-4;
        if (d < 0.7 && c.y === c.ground) { c.vx += (dx / d) * 2.5; c.vz += (dz / d) * 2.5; c.vy = 2.5; }   // hop away
        if (Math.hypot(dx, h.y - c.y - 0.04, dz) < 0.13) { squished = true; break; }
      }
      if (squished) { c.dead = 20 + Math.random() * 10; onSquish(c); mesh.setMatrixAt(i, hidden); continue; }
      if (Math.random() < dt * 0.15) { c.vx += (Math.random() - 0.5) * 2; c.vz += (Math.random() - 0.5) * 2; c.vy = 1.8; }
      c.ground = groundAt(c.x, c.z, c.y + 0.1);
      c.vy -= 9 * dt;
      c.y += c.vy * dt;
      if (c.y <= c.ground) { c.y = c.ground; c.vy = 0; const damp = Math.exp(-8 * dt); c.vx *= damp; c.vz *= damp; }
      c.x += c.vx * dt; c.z += c.vz * dt;
      if (Math.hypot(c.vx, c.vz) > 0.1) c.yaw = Math.atan2(c.vx, c.vz);
      p.set(c.x, c.y + 0.035, c.z);
      q.setFromAxisAngle(up, c.yaw);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { update };
}
