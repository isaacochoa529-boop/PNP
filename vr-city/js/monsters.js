// More monsters 👹. Each one has its own body, its own rules and its own sounds.
//   stalker  : tall faceless man in a suit. Freezes the instant ANYONE looks at it. Look away and it is closer.
//   howler   : gaunt screaming sprinter. Fast, loud, scared of your head lamp.
//   brute    : huge sack-faced thing with a cleaver. Slow, ignores light, smashes through walls, smells you inside.
//   dweller  : pale thing hanging on the ceiling of a building. Drops on you when you walk under it.
//   wisp     : a cold floating light that kills every lamp near it (harmless, just terrifying).
// They all work like the Crawler: the host runs the brain, everybody draws them from 10 snapshots a second.
// To add a new monster: write a build function (the body), a think function (the brain), add it to SPECS.
import * as THREE from 'three';
import { HALF, PITCH, nearSolids, groundAt, hideZones, hideZoneAt } from './city.js';

const SEG = new THREE.CylinderGeometry(1, 0.8, 1, 8, 1).translate(0, 0.5, 0);
const SPH = new THREE.SphereGeometry(1, 14, 10);
const CONE = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const TAU = Math.PI * 2;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
function mesh(g, m, parent, px, py, pz, sx = 1, sy = 1, sz = 1) {
  const o = new THREE.Mesh(g, m);
  o.position.set(px, py, pz); o.scale.set(sx, sy, sz);
  parent.add(o);
  return o;
}
// a two-part limb hanging down from (x,y,z). Rotate hip / knee to animate it.
function limb(parent, m, x, y, z, l1, l2, r1, r2) {
  const hip = new THREE.Group(); hip.position.set(x, y, z); parent.add(hip);
  const u = mesh(SEG, m, hip, 0, 0, 0, r1, l1, r1); u.rotation.x = Math.PI;
  const knee = new THREE.Group(); knee.position.y = -l1; hip.add(knee);
  const lo = mesh(SEG, m, knee, 0, 0, 0, r2, l2, r2); lo.rotation.x = Math.PI;
  const end = new THREE.Group(); end.position.y = -l2; knee.add(end);
  return { hip, knee, end };
}
let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (glowTex = new THREE.CanvasTexture(c));
}
const cl = (v, a, b) => Math.max(a, Math.min(b, v));

// =====================================================================
// BODIES
// =====================================================================
function buildStalker() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = mat(0xb9b3a4, { roughness: 0.9, emissive: 0x16140f }), suit = mat(0x08080a, { roughness: 0.85 }), shirt = mat(0xcfc8b8);
  const legs = [-1, 1].map((s) => limb(body, suit, s * 0.09, 1.28, 0, 0.66, 0.66, 0.05, 0.04));
  for (const l of legs) mesh(BOX, suit, l.end, 0, -0.02, -0.07, 0.07, 0.05, 0.2);   // shoes
  mesh(SPH, suit, body, 0, 1.3, 0, 0.14, 0.1, 0.1);                                // hips
  const torso = mesh(SPH, suit, body, 0, 1.72, 0, 0.17, 0.42, 0.1);                 // jacket (way too long)
  mesh(BOX, shirt, body, 0, 1.86, -0.095, 0.05, 0.3, 0.01);                         // shirt strip
  mesh(BOX, mat(0x4a0a0a), body, 0, 1.78, -0.1, 0.03, 0.22, 0.012);                 // tie
  const arms = [-1, 1].map((s) => {
    const a = limb(body, suit, s * 0.21, 2.02, 0, 0.82, 0.86, 0.04, 0.032);
    mesh(SPH, skin, a.end, 0, -0.04, 0, 0.035, 0.07, 0.03);
    for (let i = 0; i < 3; i++) mesh(CONE, skin, a.end, (i - 1) * 0.022, -0.09, 0, 0.008, -0.22 - i * 0.03, 0.008);   // long fingers
    return a;
  });
  mesh(SEG, skin, body, 0, 2.02, 0, 0.04, 0.2, 0.04);                                // neck
  const head = new THREE.Group(); head.position.set(0, 2.38, 0); body.add(head);
  mesh(SPH, skin, head, 0, 0, 0, 0.095, 0.17, 0.105);                                // smooth, faceless head
  mesh(SPH, mat(0x000000), head, 0, -0.05, -0.095, 0.006, 0.05, 0.006);              // a thin black slit for a mouth
  for (const s of [-1, 1]) mesh(SPH, mat(0x1a1814, { transparent: true, opacity: 0.5 }), head, s * 0.04, 0.03, -0.095, 0.022, 0.012, 0.01);   // two shallow dents
  const st = { tilt: 0.5 };
  function animate(a) {
    const w = a.mode === 'chase' ? 1 : 0, sw = Math.sin(a.ph * TAU) * 0.75 * w;
    legs[0].hip.rotation.x = sw; legs[1].hip.rotation.x = -sw;
    legs[0].knee.rotation.x = Math.max(0, -Math.sin(a.ph * TAU + 0.8)) * 1.0 * w; legs[1].knee.rotation.x = Math.max(0, Math.sin(a.ph * TAU + 0.8)) * 1.0 * w;
    arms[0].hip.rotation.x = -sw * 0.8; arms[1].hip.rotation.x = sw * 0.8;
    const frozen = a.mode === 'frozen';
    arms[0].hip.rotation.z = (frozen ? -0.28 : -0.05); arms[1].hip.rotation.z = (frozen ? 0.28 : 0.05);
    body.rotation.x = w * -0.18;
    const k = Math.min(1, a.dt * 12);
    head.rotation.z += ((frozen ? st.tilt : Math.sin(a.t * 7) * 0.08) - head.rotation.z) * k;
    head.rotation.x += ((frozen ? -0.25 : 0.1) - head.rotation.x) * k;
    if (!frozen && Math.random() < a.dt * 0.4) st.tilt = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4);
    body.position.y = w ? Math.abs(Math.sin(a.ph * TAU)) * 0.05 : 0;
  }
  void torso;
  return { root, animate };
}

function buildHowler() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = mat(0x6d726a, { roughness: 0.8 }), dark = mat(0x2c2f2a), mouthM = mat(0x2a0306, { emissive: 0x1a0204 }), tooth = mat(0xc4bca8), eyeM = new THREE.MeshBasicMaterial({ color: 0xe8f0ff });
  const torso = new THREE.Group(); torso.position.set(0, 0.95, 0); torso.rotation.x = 0.75; body.add(torso);   // hunched way forward
  mesh(SPH, skin, torso, 0, 0.22, 0, 0.17, 0.3, 0.12);
  for (let i = 0; i < 7; i++) { const sp = mesh(CONE, dark, torso, 0, 0.1 + i * 0.07, 0.11, 0.025, 0.08, 0.025); sp.rotation.x = 0.6; }   // spine knobs
  for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(1, 0.05, 5, 10, Math.PI), dark, torso, 0, 0.12 + i * 0.07, -0.02, 0.15, 0.1, 0.1).rotation.set(0, 0, Math.PI);
  mesh(SPH, skin, body, 0, 0.92, 0.02, 0.15, 0.12, 0.13);
  const legs = [-1, 1].map((s) => limb(body, skin, s * 0.11, 0.92, 0.04, 0.5, 0.5, 0.06, 0.04));
  const arms = [-1, 1].map((s) => {
    const a = limb(torso, skin, s * 0.2, 0.4, 0, 0.62, 0.7, 0.045, 0.035);
    for (let i = 0; i < 4; i++) mesh(CONE, dark, a.end, (i - 1.5) * 0.02, -0.04, 0, 0.007, -0.18, 0.007);
    return a;
  });
  const neck = new THREE.Group(); neck.position.set(0, 0.45, -0.02); torso.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.06, -0.1); neck.add(head);
  head.rotation.x = -0.9;                                                            // lifts the face up to look ahead
  mesh(SPH, skin, head, 0, 0.03, 0, 0.1, 0.12, 0.17);                                // long skull
  const jaw = new THREE.Group(); jaw.position.set(0, -0.03, 0.05); head.add(jaw);
  mesh(SPH, mouthM, head, 0, -0.04, -0.07, 0.08, 0.04, 0.12);
  mesh(SPH, skin, jaw, 0, -0.04, -0.07, 0.085, 0.04, 0.16);
  const T = new THREE.ConeGeometry(0.011, 0.07, 4);
  for (let i = 0; i < 8; i++) {
    const a = (i / 7 - 0.5) * 2;
    mesh(T, tooth, head, Math.sin(a) * 0.075, -0.045, -0.09 - Math.cos(a) * 0.07, 1, 1, 1).rotation.x = Math.PI;
    mesh(T, tooth, jaw, Math.sin(a) * 0.07, -0.02, -0.1 - Math.cos(a) * 0.07, 1, 1, 1);
  }
  for (const s of [-1, 1]) mesh(SPH, eyeM, head, s * 0.065, 0.075, -0.1, 0.03, 0.03, 0.02);   // blank white eyes
  function animate(a) {
    const w = cl(a.spd / 3, 0, 1.4), sw = Math.sin(a.ph * TAU) * 0.9 * w;
    legs[0].hip.rotation.x = sw; legs[1].hip.rotation.x = -sw;
    legs[0].knee.rotation.x = Math.max(0, -Math.sin(a.ph * TAU + 0.6)) * 1.3 * w; legs[1].knee.rotation.x = Math.max(0, Math.sin(a.ph * TAU + 0.6)) * 1.3 * w;
    arms[0].hip.rotation.x = -0.4 - sw * 0.9; arms[1].hip.rotation.x = -0.4 + sw * 0.9;
    body.position.y = Math.abs(Math.sin(a.ph * TAU)) * 0.08 * w;
    const scream = a.scream > 0;
    jaw.rotation.x += ((scream ? 0.95 + Math.sin(a.t * 40) * 0.12 : 0.18 + Math.sin(a.t * 3) * 0.05) - jaw.rotation.x) * Math.min(1, a.dt * 16);
    head.rotation.z = scream ? Math.sin(a.t * 30) * 0.12 : 0;
    torso.rotation.x = scream ? 0.2 : 0.75;   // throws its chest back to scream
  }
  return { root, animate };
}

function buildBrute() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = mat(0x5a2e26, { roughness: 0.9 }), scar = mat(0x2a0e0c), sack = mat(0x9a8660, { roughness: 1 }), iron = mat(0x2a2a2c, { metalness: 0.5, roughness: 0.5 }), rust = mat(0x5a3418);
  const legs = [-1, 1].map((s) => limb(body, skin, s * 0.34, 1.15, 0, 0.58, 0.58, 0.18, 0.15));
  for (const l of legs) mesh(BOX, iron, l.end, 0, -0.04, -0.06, 0.34, 0.14, 0.5);
  mesh(SPH, skin, body, 0, 1.2, 0, 0.5, 0.3, 0.38);
  const torso = mesh(SPH, skin, body, 0, 1.85, 0.05, 0.72, 0.8, 0.5);
  for (let i = 0; i < 3; i++) mesh(BOX, scar, body, -0.2 + i * 0.2, 1.95, -0.46, 0.02, 0.5, 0.02).rotation.z = 0.5;   // claw scars
  mesh(new THREE.TorusGeometry(1, 0.07, 6, 16), iron, body, 0, 1.28, 0, 0.55, 0.55, 0.9).rotation.x = Math.PI / 2;      // chain belt
  for (let i = 0; i < 5; i++) mesh(BOX, rust, body, -0.5 + i * 0.25, 2.55, 0.15, 0.2, 0.28, 0.06).rotation.set(0.4, 0, (i - 2) * 0.12);   // rusty plates on the shoulders
  const arms = [-1, 1].map((s) => {
    const a = limb(body, skin, s * 0.78, 2.35, 0, 0.95, 1.0, 0.2, 0.17);
    mesh(SPH, skin, a.end, 0, -0.1, 0, 0.26, 0.28, 0.26);
    return a;
  });
  // the cleaver in the right hand
  const cleaver = new THREE.Group(); arms[1].end.add(cleaver);
  mesh(BOX, rust, cleaver, 0, -0.5, -0.1, 0.07, 1.1, 0.07);
  mesh(BOX, iron, cleaver, 0, -1.15, -0.1, 0.06, 0.55, 0.5);
  cleaver.rotation.x = -0.3;
  const head = new THREE.Group(); head.position.set(0, 2.55, -0.1); body.add(head);
  mesh(SPH, sack, head, 0, 0, 0, 0.27, 0.3, 0.27);                                   // a burlap sack over the head
  mesh(SPH, mat(0x000000), head, -0.1, 0.05, -0.24, 0.07, 0.06, 0.03);              // empty eye hole
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
  mesh(SPH, eyeM, head, 0.1, 0.05, -0.25, 0.04, 0.04, 0.025);                        // one red eye
  for (let i = 0; i < 7; i++) mesh(BOX, mat(0x120a06), head, -0.15 + i * 0.05, -0.12, -0.255, 0.012, 0.07, 0.01);   // stitched mouth
  mesh(new THREE.TorusGeometry(1, 0.03, 5, 14), mat(0x3a2a14), head, 0, -0.22, 0, 0.2, 0.2, 0.2).rotation.x = Math.PI / 2;   // rope around the neck
  function animate(a) {
    const w = cl(a.spd / 2, 0, 1.2), sw = Math.sin(a.ph * TAU);
    legs[0].hip.rotation.x = sw * 0.5 * w; legs[1].hip.rotation.x = -sw * 0.5 * w;
    legs[0].knee.rotation.x = Math.max(0, -sw) * 0.6 * w; legs[1].knee.rotation.x = Math.max(0, sw) * 0.6 * w;
    arms[0].hip.rotation.x = -sw * 0.25 * w; arms[1].hip.rotation.x = sw * 0.15 * w - 0.25;
    body.rotation.z = sw * 0.06 * w; body.rotation.x = 0.12;
    body.position.y = Math.abs(sw) * 0.06 * w;
    head.rotation.y += ((a.look || 0) - head.rotation.y) * Math.min(1, a.dt * 4);
    head.rotation.z = Math.sin(a.t * 1.3) * 0.05;
  }
  void torso;
  return { root, animate };
}

function buildDweller() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = mat(0x9ca7a8, { roughness: 0.85, emissive: 0x0c1010 }), dark = mat(0x1a1e20), eyeM = new THREE.MeshBasicMaterial({ color: 0x000000 }), mouthM = mat(0x1a0608), tooth = mat(0xd8d0bc);
  mesh(SPH, skin, body, 0, 1.0, 0, 0.17, 0.22, 0.12);                                // thin chest
  mesh(SPH, skin, body, 0, 0.78, 0, 0.12, 0.1, 0.1);
  for (let i = 0; i < 6; i++) mesh(new THREE.TorusGeometry(1, 0.04, 5, 10, Math.PI), dark, body, 0, 0.8 + i * 0.07, 0, 0.14, 0.09, 0.1).rotation.set(0, 0, Math.PI);
  const arms = [-1, 1].map((s) => {
    const a = limb(body, skin, s * 0.19, 1.15, 0, 0.7, 0.75, 0.035, 0.028);
    for (let i = 0; i < 4; i++) mesh(CONE, dark, a.end, (i - 1.5) * 0.018, -0.02, 0, 0.007, -0.2, 0.007);
    return a;
  });
  const legs = [-1, 1].map((s) => limb(body, skin, s * 0.1, 0.72, 0, 0.62, 0.66, 0.045, 0.035));
  mesh(SEG, skin, body, 0, 1.12, 0, 0.04, 0.22, 0.04).rotation.x = -0.3;           // long neck
  const head = new THREE.Group(); head.position.set(0, 1.36, -0.07); body.add(head);
  mesh(SPH, skin, head, 0, 0, 0, 0.1, 0.13, 0.1);
  mesh(SPH, mouthM, head, 0, -0.06, -0.06, 0.07, 0.05, 0.035);                       // a wide, wrong grin
  for (let i = 0; i < 10; i++) { const a = (i / 9 - 0.5) * 1.8; mesh(new THREE.ConeGeometry(0.008, 0.04, 4), tooth, head, Math.sin(a) * 0.06, -0.05, -0.085, 1, 1, 1).rotation.x = Math.PI; }
  for (const s of [-1, 1]) mesh(SPH, eyeM, head, s * 0.05, 0.03, -0.085, 0.032, 0.045, 0.02);   // solid black eyes
  function animate(a) {
    const crawl = a.mode === 'chase' || a.mode === 'return', w = crawl ? 1 : 0, sw = Math.sin(a.ph * TAU);
    const perched = a.mode === 'perch' || a.mode === 'leap';
    // chasing: runs hunched on all fours-ish. perched: arms up gripping the ceiling, head twitching.
    body.rotation.x = crawl ? 0.9 : 0;
    arms[0].hip.rotation.x = crawl ? -1.3 + sw * 0.8 : (perched ? Math.PI * 0.96 : -0.2);
    arms[1].hip.rotation.x = crawl ? -1.3 - sw * 0.8 : (perched ? Math.PI * 0.96 : -0.2);
    arms[0].knee.rotation.x = perched ? 0.15 : 0.3; arms[1].knee.rotation.x = perched ? 0.15 : 0.3;
    legs[0].hip.rotation.x = crawl ? sw * 0.9 : 0.05; legs[1].hip.rotation.x = crawl ? -sw * 0.9 : -0.05;
    legs[0].knee.rotation.x = crawl ? Math.max(0, -sw) * 1.2 + 0.3 : 0.1; legs[1].knee.rotation.x = crawl ? Math.max(0, sw) * 1.2 + 0.3 : 0.1;
    const k = Math.min(1, a.dt * (perched ? 5 : 14));
    const tw = perched ? Math.sin(a.t * 1.7) * 0.7 + (Math.random() < a.dt * 0.6 ? 0.8 : 0) : 0;
    head.rotation.y += (((a.look || 0) * 0.8) + tw * 0.4 - head.rotation.y) * k;
    head.rotation.z = perched ? Math.sin(a.t * 0.9) * 0.4 : Math.sin(a.t * 20) * 0.05;
    head.rotation.x = perched ? 0.5 : -0.2;
  }
  return { root, animate };
}

function buildWisp() {
  const root = new THREE.Group();
  const orbM = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const orb = mesh(SPH, orbM, root, 0, 0, 0, 0.28, 0.34, 0.28);
  const haloM = new THREE.SpriteMaterial({ map: glow(), color: 0x90c0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Sprite(haloM); halo.scale.set(3.2, 3.2, 1); root.add(halo);
  const black = new THREE.MeshBasicMaterial({ color: 0x000a14 });
  const face = new THREE.Group(); root.add(face);
  for (const s of [-1, 1]) mesh(SPH, black, face, s * 0.09, 0.07, -0.25, 0.045, 0.075, 0.02);     // hollow eyes
  const mouth = mesh(SPH, black, face, 0, -0.1, -0.26, 0.05, 0.12, 0.02);                          // screaming mouth
  const tail = [];
  for (let i = 0; i < 7; i++) { const t = new THREE.Sprite(haloM); t.scale.setScalar(1.4 - i * 0.17); root.add(t); tail.push(t); }
  const hist = [];
  function animate(a) {
    orb.scale.set(0.28 + Math.sin(a.t * 3) * 0.02, 0.34 + Math.sin(a.t * 2.3) * 0.03, 0.28);
    haloM.opacity = 0.55 + Math.sin(a.t * 11) * 0.12 + (Math.random() < 0.05 ? -0.3 : 0);
    mouth.scale.y = 0.12 + Math.abs(Math.sin(a.t * 6)) * 0.08;
    face.rotation.y = cl(a.look || 0, -1, 1) * 0.5;
    // tail follows where it has been (world positions stored then converted)
    hist.unshift(root.position.clone()); if (hist.length > 40) hist.pop();
    tail.forEach((t, i) => { const h = hist[Math.min(hist.length - 1, (i + 1) * 4)]; if (h) t.position.set(h.x - root.position.x, h.y - root.position.y + (i * 0.02), h.z - root.position.z); });
  }
  return { root, animate };
}

// =====================================================================
// BRAINS
// =====================================================================
const near = [];
function blockedAt(x, z, y, o) {
  const R = o.r || 0.45;
  for (const b of nearSolids(x, z, R + 0.1, near)) {
    if (b.y1 <= y + 1.5 || b.y0 >= y + 1.1) continue;
    const cx = cl(x, b.x0, b.x1), cz = cl(z, b.z0, b.z1);
    if ((x - cx) ** 2 + (z - cz) ** 2 >= R * R) continue;
    if (o.smash && (b.tag === 'wall' || b.tag === 'wood' || b.tag === 'fence')) { o.smashed = true; continue; }   // brute: goes right through
    return b;
  }
  return null;
}
const onStreet = () => {
  const k = Math.floor(Math.random() * 7) - 3, a = (Math.random() * 2 - 1) * HALF * 0.85, line = k * PITCH + PITCH / 2;
  return Math.random() < 0.5 ? new THREE.Vector3(line, 0, a) : new THREE.Vector3(a, 0, line);
};
function walk(C, dx, dz, spd, dt, o) {
  if (o.snap) C.spd = spd; else C.spd += (spd - C.spd) * Math.min(1, dt * 4);
  if (C.detourT > 0) { C.detourT -= dt; dx = C.detour.x; dz = C.detour.y; }
  const step = C.spd * dt;
  o.smashed = false;
  if (step > 0) {
    const nx = C.pos.x + dx * step, nz = C.pos.z + dz * step;
    if (!blockedAt(nx, C.pos.z, C.pos.y, o)) C.pos.x = nx;
    if (!blockedAt(C.pos.x, nz, C.pos.y, o)) C.pos.z = nz;
  }
  C.pos.x = cl(C.pos.x, -HALF + 1, HALF - 1); C.pos.z = cl(C.pos.z, -HALF + 1, HALF - 1);
  const g = groundAt(C.pos.x, C.pos.z, C.pos.y + 1.0);
  if (C.pos.y > g + 0.05) { C.vy -= 14 * dt; C.pos.y = Math.max(g, C.pos.y + C.vy * dt); } else { C.pos.y += (g - C.pos.y) * Math.min(1, dt * 10); C.vy = 0; }
  if (C.spd > 0.6) {   // stuck? sidestep
    if (C.stuckFrom.distanceTo(C.pos) < 0.35) {
      C.stuckT += dt;
      if (C.stuckT > 1.3 && C.detourT <= 0) { const s = Math.random() < 0.5 ? -1 : 1; C.detour.set(-dz * s - dx * 0.3, dx * s - dz * 0.3).normalize(); C.detourT = 1.2; }
    } else { C.stuckFrom.copy(C.pos); C.stuckT = 0; }
  }
  if (Math.hypot(dx, dz) > 0.01) { let da = Math.atan2(dx, dz) - C.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); C.yaw += da * Math.min(1, dt * (o.turn || 6)); }
}
// go through doors to reach someone inside a building (and out of one to reach someone outside)
function wayTo(C, goal, goalZone) {
  const here = hideZoneAt({ x: C.pos.x, y: C.pos.y + 0.5, z: C.pos.z });
  if (here && here !== goalZone) {
    const d = here.door;
    if (C.exiting !== here && Math.hypot(C.pos.x - d.ix, C.pos.z - d.iz) > 1.0) return [d.ix, d.iz];
    C.exiting = here; return [d.ox, d.oz];
  }
  C.exiting = null;
  if (goalZone && here !== goalZone) {
    const d = goalZone.door;
    if (C.entering !== goalZone && Math.hypot(C.pos.x - d.ox, C.pos.z - d.oz) > 1.0) return [d.ox, d.oz];
    C.entering = goalZone; return [d.ix, d.iz];
  }
  C.entering = null;
  return [goal.x, goal.z];
}
const alive = (w) => w.players.filter((p) => !p.ghost);
function nearest(list, pos, ok) {
  let best = null, bd = 1e9;
  for (const p of list) { const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z); if ((!ok || ok(p, d)) && d < bd) { best = p; bd = d; } }
  return best ? { p: best, d: bd } : null;
}
function chaseDir(C, t) {
  const zone = hideZoneAt(t.pos);
  const [wx, wz] = wayTo(C, t.pos, zone);
  const dx = wx - C.pos.x, dz = wz - C.pos.z, d = Math.hypot(dx, dz) || 1;
  return [dx / d, dz / d];
}
function catchCheck(C, list, r, ev) {
  for (const p of list) {
    if (Math.hypot(p.pos.x - C.pos.x, p.pos.z - C.pos.z) < r && Math.abs(p.pos.y - (C.pos.y + 0.9)) < 1.6) { ev.push({ k: 'catch', who: p.id }); return true; }
  }
  return false;
}
const lit = (C, w, range) => {   // is a head lamp pointed at it?
  for (const L of w.lights) {
    if (!L.on) continue;
    const dx = C.pos.x - L.pos.x, dz = C.pos.z - L.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.1 && d < range && (dx * L.dir.x + dz * L.dir.z) / (d * (Math.hypot(L.dir.x, L.dir.z) || 1)) > 0.85) return { dx: dx / d, dz: dz / d };
  }
  return null;
};
const fx = (C, name, y = 1) => ({ k: 'mfx', fx: name, x: C.pos.x, y: C.pos.y + y, z: C.pos.z });

function thinkStalker(C, dt, now, w, ev) {
  const al = alive(w), X = C.x;
  let seen = false;
  for (const p of al) {   // anyone looking at it, even a little, even through your lamp, freezes it
    const dx = C.pos.x - p.pos.x, dz = C.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.01 || d > 110) continue;
    if ((dx * p.dir.x + dz * p.dir.z) / (d * (Math.hypot(p.dir.x, p.dir.z) || 1)) > 0.5) { seen = true; break; }
  }
  const t = nearest(al, C.pos, (p, d) => !p.hidden || d < 18);
  if (!t) { C.mode = 'wander'; C.spd = 0; return; }
  if (seen) { if (C.mode !== 'frozen') { C.mode = 'frozen'; X.freezeT = 0; } C.spd = 0; X.freezeT += dt; return; }
  if (C.mode === 'frozen') { ev.push(fx(C, 'static')); X.tick = 0.4; }
  C.mode = 'chase';
  const [dx, dz] = chaseDir(C, t.p);
  walk(C, dx, dz, t.d > 70 ? 9 : t.d > 30 ? 6 : 4.8, dt, { r: 0.4, snap: true, turn: 20 });
  X.tick -= dt;
  if (t.d < 40 && X.tick <= 0) { X.tick = 0.6 + Math.random() * 0.7; ev.push(fx(C, 'static')); }
  catchCheck(C, al, 1.25, ev);
}

function thinkHowler(C, dt, now, w, ev) {
  const al = alive(w), X = C.x;
  X.scream = Math.max(0, X.scream - dt); X.cool = Math.max(0, X.cool - dt); X.scared = Math.max(0, X.scared - dt);
  C.scream = X.scream;
  const lamp = !w.red && lit(C, w, 18);
  if (lamp) { if (X.scared <= 0) ev.push(fx(C, 'howl2')); X.scared = 2.2; X.flee = lamp; }
  const t = nearest(al, C.pos, (p, d) => w.red || (!p.hidden && d < 75));
  if (X.scared > 0) { C.mode = 'flee'; walk(C, X.flee.dx, X.flee.dz, 6.5, dt, { r: 0.4 }); return; }
  if (t) {
    if (C.mode !== 'hunt' && X.cool <= 0) { ev.push(fx(C, 'howl')); X.scream = 2.0; X.cool = 9; }
    C.mode = 'hunt'; X.lost = 0; X.last = t.p.pos.clone();
    if (X.scream > 1.3) { C.spd = 0; return; }   // it stops dead to scream
    if (X.cool <= 0) { ev.push(fx(C, 'howl')); X.scream = 1.4; X.cool = 8; }
    const [dx, dz] = chaseDir(C, t.p);
    walk(C, dx, dz, 6.6, dt, { r: 0.4 });
    catchCheck(C, al, 1.3, ev);
  } else if (C.mode === 'hunt' || C.mode === 'sniff') {
    X.lost += dt; C.mode = 'sniff';
    const dx = X.last.x - C.pos.x, dz = X.last.z - C.pos.z, d = Math.hypot(dx, dz) || 1;
    walk(C, dx / d, dz / d, d > 2 ? 3.5 : 0, dt, { r: 0.4 });
    if (X.lost > 6) { C.mode = 'wander'; C.goal.copy(onStreet()); }
  } else {
    if (Math.hypot(C.goal.x - C.pos.x, C.goal.z - C.pos.z) < 3) C.goal.copy(onStreet());
    const dx = C.goal.x - C.pos.x, dz = C.goal.z - C.pos.z, d = Math.hypot(dx, dz) || 1;
    walk(C, dx / d, dz / d, 1.7, dt, { r: 0.4 });
    if (Math.random() < dt * 0.04) ev.push(fx(C, 'howl2'));   // a far-off cry now and then
  }
}

function thinkBrute(C, dt, now, w, ev) {
  const al = alive(w), X = C.x;
  X.smashCd = Math.max(0, X.smashCd - dt);
  // it feels footsteps: hunts you even while you hide, if you are close
  const t = nearest(al, C.pos, (p, d) => d < (p.hidden ? 22 : 40));
  const o = { r: 0.8, smash: true, turn: 3 };
  if (t) {
    C.mode = 'hunt';
    const dx = t.p.pos.x - C.pos.x, dz = t.p.pos.z - C.pos.z, d = Math.hypot(dx, dz) || 1;
    walk(C, dx / d, dz / d, 2.7, dt, o);   // straight at you
    catchCheck(C, al, 1.9, ev);
    if (X.roarCd <= 0 && d < 30) { X.roarCd = 14; ev.push(fx(C, 'howl3')); } else X.roarCd -= dt;
  } else {
    C.mode = 'wander';
    if (Math.hypot(C.goal.x - C.pos.x, C.goal.z - C.pos.z) < 4) C.goal.copy(onStreet());
    const dx = C.goal.x - C.pos.x, dz = C.goal.z - C.pos.z, d = Math.hypot(dx, dz) || 1;
    walk(C, dx / d, dz / d, 1.3, dt, o);
  }
  if (o.smashed && X.smashCd <= 0) { X.smashCd = 0.9; ev.push(fx(C, 'smash')); }
}

function thinkDweller(C, dt, now, w, ev) {
  const al = alive(w), X = C.x, z = X.zone;
  if (!z) return;
  const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2;
  switch (C.mode) {
    case 'perch': {
      C.spd = 0; C.pos.set(cx, z.top, cz);
      const t = nearest(al, C.pos, (p) => p.pos.y < z.top + 0.5);
      if (t && t.d > 14) X.warned = false;
      if (t && t.d < 9 && !X.warned) { X.warned = true; ev.push(fx(C, 'twitch')); }
      if (t && t.d < 4.8) { C.mode = 'drop'; C.vy = 0; ev.push(fx(C, 'drop')); }
      break;
    }
    case 'drop': {
      C.vy -= 18 * dt; C.pos.y += C.vy * dt;
      const g = groundAt(C.pos.x, C.pos.z, C.pos.y + 1);
      if (C.pos.y <= g) { C.pos.y = g; C.mode = 'chase'; X.chaseT = 10; ev.push(fx(C, 'smash')); }
      break;
    }
    case 'chase': {
      X.chaseT -= dt;
      const t = nearest(al, C.pos, (p, d) => d < 45);
      if (!t || X.chaseT <= 0) { C.mode = 'return'; break; }
      const [dx, dz] = chaseDir(C, t.p);
      walk(C, dx, dz, 6.0, dt, { r: 0.4 });
      catchCheck(C, al, 1.3, ev);
      break;
    }
    case 'return': {
      const [wx, wz] = wayTo(C, { x: cx, z: cz }, z);
      const dx = wx - C.pos.x, dz = wz - C.pos.z, d = Math.hypot(dx, dz) || 1;
      walk(C, dx / d, dz / d, 3.2, dt, { r: 0.4 });
      if (Math.hypot(cx - C.pos.x, cz - C.pos.z) < 1.2) { C.mode = 'leap'; X.leapT = 0; X.leapFrom = C.pos.y; }
      // someone came back? drop again right away
      const t = nearest(al, C.pos, (p, d2) => d2 < 6);
      if (t) { C.mode = 'chase'; X.chaseT = 6; }
      break;
    }
    case 'leap': {
      X.leapT += dt; C.spd = 0;
      const k = Math.min(1, X.leapT / 0.5);
      C.pos.x += (cx - C.pos.x) * k; C.pos.z += (cz - C.pos.z) * k;
      C.pos.y = X.leapFrom + (z.top - X.leapFrom) * k;
      if (k >= 1) { C.mode = 'perch'; X.warned = false; ev.push(fx(C, 'twitch')); }
      break;
    }
  }
}

function thinkWisp(C, dt, now, w, ev) {
  const al = alive(w), X = C.x;
  X.whisperCd = Math.max(0, X.whisperCd - dt);
  const t = nearest(al, C.pos);
  C.mode = 'drift';
  let tx = C.pos.x, tz = C.pos.z, ty = 2;
  if (t) { tx = t.p.pos.x; tz = t.p.pos.z; ty = t.p.pos.y + 0.2; }
  const dx = tx - C.pos.x, dz = tz - C.pos.z, d = Math.hypot(dx, dz) || 1;
  const spd = t ? (d > 40 ? 5 : 1.9) : 0;
  C.spd += (spd - C.spd) * Math.min(1, dt * 2);
  C.pos.x += dx / d * C.spd * dt; C.pos.z += dz / d * C.spd * dt;   // walls mean nothing to it
  C.pos.y += (ty + Math.sin(now / 700) * 0.2 - C.pos.y) * Math.min(1, dt * 1.5);
  if (d > 0.1) C.yaw = Math.atan2(dx, dz);
  C.killLights = t ? d < 15 : false;
  if (t && d < 12 && X.whisperCd <= 0) { X.whisperCd = 5 + Math.random() * 5; ev.push(fx(C, 'wisp')); }
}

const SPECS = {
  stalker: { build: buildStalker, think: thinkStalker, stride: 0.34, init: (C) => { C.x = { tick: 0, freezeT: 0 }; } },
  howler: { build: buildHowler, think: thinkHowler, stride: 0.5, init: (C) => { C.x = { scream: 0, cool: 3, scared: 0, lost: 0, flee: { dx: 0, dz: 1 }, last: new THREE.Vector3() }; C.goal.copy(onStreet()); } },
  brute: { build: buildBrute, think: thinkBrute, stride: 0.42, immune: true, init: (C) => { C.x = { smashCd: 0, roarCd: 4 }; C.goal.copy(onStreet()); } },
  dweller: {
    build: buildDweller, think: thinkDweller, stride: 0.5,
    init: (C, x, z) => {
      let best = null, bd = 1e9;
      for (const zn of hideZones) { const d = Math.hypot((zn.x0 + zn.x1) / 2 - x, (zn.z0 + zn.z1) / 2 - z); if (d < bd) { bd = d; best = zn; } }
      C.x = { zone: best, warned: false, chaseT: 0, leapT: 0, leapFrom: 0 };
      if (best) { C.pos.set((best.x0 + best.x1) / 2, best.top, (best.z0 + best.z1) / 2); C.vis.copy(C.pos); }
      C.mode = 'perch';
    },
  },
  wisp: { build: buildWisp, think: thinkWisp, stride: 0, immune: true, free: true, init: (C, x, z) => { C.x = { whisperCd: 3 }; C.pos.y = 2; C.vis.copy(C.pos); } },
};
export const MONSTER_TYPES = Object.keys(SPECS);

// =====================================================================
// the shared machinery (same shape as the Crawler, so main.js treats them all alike)
// =====================================================================
export function makeMonster(scene, type) {
  const spec = SPECS[type];
  const model = spec.build();
  const root = model.root;
  root.visible = false;
  scene.add(root);
  const C = {
    pos: new THREE.Vector3(), vis: new THREE.Vector3(), vy: 0, yaw: 0, visYaw: 0, mode: 'wander', spd: 0, stunT: 0, squash: 0, flip: 0, ph: 0, lastStep: 0,
    goal: new THREE.Vector3(), entering: null, exiting: null, stuckT: 0, stuckFrom: new THREE.Vector3(), detourT: 0, detour: new THREE.Vector2(),
    x: {}, scream: 0, hostRuns: false, killLights: false, look: 0,
  };
  const self = { type, C, model: { root }, immune: !!spec.immune };

  self.reset = (x, z) => {
    C.pos.set(x, spec.free ? 2 : groundAt(x, z, 3), z); C.vis.copy(C.pos);
    C.spd = 0; C.stunT = 0; C.mode = 'wander'; C.entering = C.exiting = null;
    spec.init(C, x, z);
    root.visible = true;
  };
  self.update = (dt, now, world) => {
    const ev = [];
    C.hostRuns = true;
    if (C.stunT > 0) { C.stunT -= dt; C.spd = 0; return ev; }
    spec.think(C, dt, now, world, ev);
    return ev;
  };
  self.stun = (s) => { if (!spec.immune) C.stunT = s; };
  self.sang = () => {};
  self.show = (dt, looker, onStep) => {
    C.vis.lerp(C.pos, Math.min(1, dt * 10));
    let da = C.yaw - C.visYaw; da = Math.atan2(Math.sin(da), Math.cos(da)); C.visYaw += da * Math.min(1, dt * 10);
    if (C.stunT > 0 && !C.hostRuns) C.stunT -= dt;
    C.squash += ((C.stunT > 0 ? 1 : 0) - C.squash) * Math.min(1, dt * (C.stunT > 0 ? 20 : 4));
    const flipT = (C.mode === 'perch' || C.mode === 'leap') ? 1 : 0;
    C.flip += (flipT - C.flip) * Math.min(1, dt * 8);
    root.position.copy(C.vis);
    root.rotation.set(0, C.visYaw, 0);
    if (C.flip > 0.01) root.rotateX(C.flip * Math.PI);
    root.scale.set(1 + C.squash * 0.5, 1 - C.squash * 0.85, 1 + C.squash * 0.3);
    C.ph += C.spd * dt * (spec.stride || 0);
    const stepN = Math.floor(C.ph * 2);
    if (spec.stride && stepN !== C.lastStep) { C.lastStep = stepN; if (C.spd > 0.6 && onStep) onStep(C.vis, true, type); }
    let look = 0;
    if (looker && looker.distanceTo(C.vis) < 30) {
      const dx = looker.x - C.vis.x, dz = looker.z - C.vis.z;
      let a = Math.atan2(dx, dz) - C.visYaw; a = Math.atan2(Math.sin(a), Math.cos(a));
      look = cl(a, -1.3, 1.3);
    }
    model.animate({ dt, spd: C.spd, mode: C.mode, ph: C.ph, t: performance.now() / 1000, look, scream: C.scream, onStep });
  };
  self.snapshot = () => ({ x: +C.pos.x.toFixed(2), y: +C.pos.y.toFixed(2), z: +C.pos.z.toFixed(2), yaw: +C.yaw.toFixed(2), mode: C.mode, spd: +C.spd.toFixed(2), st: +Math.max(0, C.stunT).toFixed(1), sc: C.scream > 0 ? 1 : 0, kl: C.killLights ? 1 : 0, tp: type });
  self.applyRemote = (m) => {
    C.pos.set(m.x, m.y, m.z); C.yaw = m.yaw; C.mode = m.mode; C.spd = m.spd; C.stunT = m.st || 0; C.scream = m.sc ? 1 : 0; C.killLights = !!m.kl;
    if (!root.visible) { root.visible = true; C.vis.copy(C.pos); C.visYaw = C.yaw; }
  };
  self.remove = () => scene.remove(root);
  return self;
}
