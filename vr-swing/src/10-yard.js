/* ======================================================================
   THE SLICING YARD: a flat baseplate floating in the sky, reached through the
   glowing portal next to the spawn stump. A sword in a stone, five cubes on
   pedestals, a green SPAWN and a red RESET button.
   Cubes really get cut: the mesh is split along the plane the blade swept
   through, both halves get a cap face, and every piece is a Rapier rigid body.
   ====================================================================== */
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ARENA = V(400, 0, 0);                 // far past the grove's view distance, so only one place renders at a time
const GROVE_PORTAL = V(3.8, 0, 2.6);
const AR_SPAWN = V(0, 0, 4.6);             // everything below is arena-local
const AR_PORTAL = V(0, 0, 6.8);
const CUBE = .22, MEGA = .62, MIN_VOL = 1.0e-6, MIN_THICK = .01;   // MEGA: a cube about as tall as you
const MEGA_AT = V(0, 0, 1.45);
const BLADE_A = V(0, .115, 0), BLADE_B = V(0, .735, 0);   // sword-local blade line, guard to tip
const SWING_T = .24, RETURN_T = .16;
state.area = 'grove';

const arena = new THREE.Group(); arena.position.copy(ARENA); scene.add(arena); arena.updateMatrixWorld(true);
const AR = { R: null, world: null, ready: false, failed: false, pieces: [], portalCool: 0, swing: { t: 2, r: 2, dir: -1, queued: false }, snap: true,
  btnT: [0, 0], greenTimes: [], byId: new Map(), bladeOk: false, heat: 0, bladeV: V(), b0: V(), t0: V(), b1: V(), t1: V(), cuts: 0, spawnQ: [], cutQ: [] };
const pmrem = new THREE.PMREMGenerator(renderer);
const ENV = pmrem.fromScene(new RoomEnvironment(), .04).texture;
const _a1 = V(), _a2 = V(), _a3 = V(), _a4 = V(), _a5 = V(), _aq = new THREE.Quaternion(), _aq2 = new THREE.Quaternion();

/* ---------- little helpers ---------- */
const labelFns = [];
function labelTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const redraw = () => { g.clearRect(0, 0, w, h); draw(g, w, h); t.needsUpdate = true; };
  redraw(); labelFns.push(redraw); return t;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => labelFns.forEach(f => f()));
function signText(g, w, h, lines, bg, border) {
  g.fillStyle = bg; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 28); g.fill();
  g.lineWidth = 8; g.strokeStyle = border; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([txt, size, col, y]) => { g.font = `${size}px "Lilita One", Impact, sans-serif`; g.lineWidth = size / 7; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(txt, w / 2, y); g.fillStyle = col; g.fillText(txt, w / 2, y); });
}
const smat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .6, flatShading: false }, o));
function part(geo, m, x = 0, y = 0, z = 0, parent) { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; if (parent) parent.add(me); return me; }
// fewer draw calls (VR draws everything twice): bake a group's still parts into one mesh per material
const _mm = new THREE.Matrix4();
function mergeStatic(root, skip = () => false) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), byMat = new Map();
  const walk = o => { for (const c of o.children) { if (skip(c)) continue;
    if (c.isMesh && !c.isInstancedMesh && !Array.isArray(c.material) && !c.children.length) { const k = c.material.uuid + (c.castShadow ? 's' : '') + (c.receiveShadow ? 'r' : ''); if (!byMat.has(k)) byMat.set(k, []); byMat.get(k).push(c); }
    walk(c); } };
  walk(root);
  for (const list of byMat.values()) {
    if (list.length < 2) continue;
    const geos = list.map(m => {
      const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(), g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position); if (!src.attributes.normal) src.computeVertexNormals(); g.setAttribute('normal', src.attributes.normal);
      g.setAttribute('uv', src.attributes.uv || new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
      return g.applyMatrix4(_mm.multiplyMatrices(inv, m.matrixWorld));
    });
    const merged = mergeGeometries(geos); if (!merged) continue;
    const mm = new THREE.Mesh(merged, list[0].material); mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow; root.add(mm);
    list.forEach(m => m.parent.remove(m));
  }
}

/* ======================= the baseplate ======================= */
const base = new THREE.Group(); arena.add(base);
{
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#a7afb9'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '20,30,40'},${.025 + rnd() * .04})`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    g.strokeStyle = 'rgba(60,68,80,.6)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, 251, 251);
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2; g.strokeRect(8, 8, 240, 240);
    [[20, 20], [236, 20], [20, 236], [236, 236]].forEach(([x, y]) => { g.fillStyle = 'rgba(60,68,80,.35)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); });   // bolt heads
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(18, 18); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: .88 }), side = smat(0x6a7380, { roughness: .8 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 36), [side, side, top, side, side, side]); plate.position.y = -.5; plate.receiveShadow = true; base.add(plate);
  // hazard-stripe trim round the edge
  const st = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#ffcf33'; g.fillRect(0, 0, 128, 32); g.fillStyle = '#2a2a30';
    for (let x = -32; x < 160; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(36, 1); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const trimM = new THREE.MeshStandardMaterial({ map: st, roughness: .6 });
  for (let k = 0; k < 4; k++) { const tr = new THREE.Mesh(new THREE.BoxGeometry(36.3, .06, .22), trimM); const a = k * Math.PI / 2; tr.position.set(Math.sin(a) * 18.04, .03, Math.cos(a) * 18.04); tr.rotation.y = a; tr.receiveShadow = true; base.add(tr); }
  // a rocky underside so it reads as a floating island when you peek over the edge
  const under = new THREE.Mesh(new THREE.CylinderGeometry(25.2, 5, 9, 4, 3), smat(0x59606b, { flatShading: true, roughness: 1 }));
  under.rotation.y = Math.PI / 4; under.position.y = -5.5; base.add(under);
  const lump = mat(0x6f7781);
  for (let i = 0; i < 9; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + rnd() * 2, 0), lump); const a = rnd() * 6.28, d = 4 + rnd() * 9; r.position.set(Math.cos(a) * d, -9 - rnd() * 3, Math.sin(a) * d); base.add(r); }
  addCol({ t: 0, x: ARENA.x, y: -.5, z: ARENA.z, hx: 18, hy: .5, hz: 18, tag: 'rock' });
  // big sign at the far side of the cubes
  const sg = new THREE.Group(); sg.position.set(0, 0, .6); base.add(sg);
  const tex2 = labelTex(1024, 256, (g, w, h) => signText(g, w, h, [['⚔️ THE SLICING YARD 🧈', 104, '#ffd25a', 132]], 'rgba(22,30,44,.92)', '#3fe0bd'));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .65), new THREE.MeshBasicMaterial({ map: tex2, transparent: true })); board.position.set(0, 1.55, .03); sg.add(board);
  const back = part(new THREE.BoxGeometry(2.72, .76, .05), smat(0x2b3446, { roughness: .5 }), 0, 1.55, 0, sg);
  const postM = smat(0x8c96a4, { metalness: .6, roughness: .35 });
  [-1.1, 1.1].forEach(x => { part(new THREE.CylinderGeometry(.04, .05, 1.6, 12), postM, x, .8, -.04, sg); part(new THREE.SphereGeometry(.07, 14, 10), mat(0x3fe0bd, { emissive: 0x3fe0bd, emissiveIntensity: .7, flatShading: false }), x, 1.98, -.04, sg); });
}
mergeStatic(base);

/* ======================= portals ======================= */
const portalMat = (c1, c2) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  uniforms: { t: { value: 0 }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform float t; uniform vec3 c1; uniform vec3 c2; varying vec2 vUv; void main(){ vec2 p = vUv*2.-1.; float r = length(p); float a = atan(p.y,p.x); float s = sin(a*5. + r*13. - t*3.2)*.5+.5; float s2 = sin(a*3. - r*9. + t*2.1)*.5+.5; vec3 col = mix(c1, c2, s*.7+s2*.3) + (1.-r)*(1.-r)*.55; gl_FragColor = vec4(col, smoothstep(1.,.86,r)*.9); }' });
const portals = [];
function makePortal(pos, yaw, text, c1, c2, worldPos) {
  const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw;
  const stone = smat(0xc9ced6, { roughness: .7 }), gold = new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .3, envMap: ENV });
  part(new THREE.CylinderGeometry(1.05, 1.15, .12, 32), stone, 0, .06, 0, g);
  part(new THREE.CylinderGeometry(.9, .95, .05, 32), smat(0x8a93a0), 0, .145, 0, g);
  const ring = part(new THREE.TorusGeometry(.86, .085, 14, 56), stone, 0, 1.0, 0, g);
  part(new THREE.TorusGeometry(.95, .02, 8, 56), gold, 0, 1.0, 0, g); part(new THREE.TorusGeometry(.77, .02, 8, 56), gold, 0, 1.0, 0, g);
  const runeM = new THREE.MeshStandardMaterial({ color: c1, emissive: c1, emissiveIntensity: .9 });
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const b = part(new THREE.BoxGeometry(.07, .12, .2), runeM, Math.cos(a) * .86, 1.0 + Math.sin(a) * .86, 0, g); b.rotation.z = a; }
  [-1, 1].forEach(s => { const f = part(new THREE.BoxGeometry(.22, .2, .3), stone, s * .55, .24, 0, g); f.rotation.z = s * .3; });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(.8, 48), portalMat(c1, c2)); disc.position.y = 1.0; g.add(disc);
  const tex = labelTex(512, 128, (cg, w, h) => signText(cg, w, h, [[text, 54, '#ffffff', 66]], 'rgba(22,30,44,.9)', '#' + new THREE.Color(c1).getHexString()));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .325), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })); sign.position.set(0, 2.15, 0); g.add(sign);
  const sparks = []; const sm = new THREE.MeshBasicMaterial({ color: c2 });
  for (let k = 0; k < 10; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(.035, 0), sm); g.add(s); sparks.push({ s, a: k / 10 * 6.283, sp: .6 + rnd() * .6, r: .95 + rnd() * .25, y: rnd() }); }
  mergeStatic(g, c => c === disc || sparks.some(s => s.s === c));
  const P = { g, disc, sparks, world: worldPos };
  portals.push(P); return P;
}
const portalGrove = makePortal(GROVE_PORTAL, Math.atan2(-GROVE_PORTAL.x, -GROVE_PORTAL.z), 'SLICING YARD ⚔️', 0x3fe0bd, 0x8b6bff); scene.add(portalGrove.g); portalGrove.g.updateMatrixWorld(true);
addCol({ t: 1, x: GROVE_PORTAL.x, z: GROVE_PORTAL.z, cy: .06, hy: .06, r: 1.1, tag: 'rock' });
const portalYard = makePortal(AR_PORTAL, Math.PI, 'BACK TO THE GROVE 🌳', 0x6fdc4f, 0xffd25a); arena.add(portalYard.g); portalYard.g.updateMatrixWorld(true);
addCol({ t: 1, x: ARENA.x + AR_PORTAL.x, z: ARENA.z + AR_PORTAL.z, cy: .06, hy: .06, r: 1.1, tag: 'rock' });

/* ======================= pedestals for the cubes ======================= */
const PEDS = [-50, -25, 0, 25, 50].map(a => { const r = a * Math.PI / 180; return V(Math.sin(r) * 1.8, 0, AR_SPAWN.z - .2 - Math.cos(r) * 1.8); });
const PED_TOP = .3;
{
  const stone = smat(0xe3e6eb, { roughness: .55 }), dark = smat(0x4f5866, { roughness: .45, metalness: .3 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x7ff0ff }), pedRoot = new THREE.Group(); arena.add(pedRoot);
  const g1 = new THREE.CylinderGeometry(.21, .23, .05, 24), g2 = new THREE.CylinderGeometry(.17, .19, .03, 24), g3 = new THREE.CylinderGeometry(.11, .12, .17, 18),
    g4 = new THREE.CylinderGeometry(.19, .15, .035, 24), g5 = new THREE.CylinderGeometry(.2, .2, .03, 28), gf = new THREE.BoxGeometry(.016, .16, .016), gr = new THREE.TorusGeometry(.2, .008, 6, 40);
  PEDS.forEach(p => {
    const g = new THREE.Group(); g.position.copy(p); pedRoot.add(g);
    part(g1, dark, 0, .025, 0, g); part(g2, stone, 0, .065, 0, g); part(g3, stone, 0, .165, 0, g);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; part(gf, dark, Math.cos(a) * .116, .165, Math.sin(a) * .116, g); }   // flutes
    part(g4, stone, 0, .2675, 0, g); part(g5, dark, 0, .285, 0, g);
    const r = new THREE.Mesh(gr, glow); r.rotation.x = Math.PI / 2; r.position.y = .3; g.add(r);
    addCol({ t: 1, x: ARENA.x + p.x, z: ARENA.z + p.z, cy: .15, hy: .15, r: .2, tag: 'rock' });
  });
  mergeStatic(pedRoot);
}

/* ======================= the button console ======================= */
const CONSOLE = V(1.7, 0, AR_SPAWN.z + .35);
const buttons = [];
{
  const g = new THREE.Group(); g.position.copy(CONSOLE); g.rotation.y = Math.atan2(AR_SPAWN.x - CONSOLE.x, AR_SPAWN.z - CONSOLE.z); arena.add(g);
  const body = smat(0x37506e, { roughness: .45, metalness: .35, envMap: ENV, envMapIntensity: .5 }), dark = smat(0x1e2633, { roughness: .5 }), steel = new THREE.MeshStandardMaterial({ color: 0xc9d2dc, metalness: 1, roughness: .25, envMap: ENV });
  part(new THREE.BoxGeometry(.62, .28, .36), body, 0, .16, 0, g);
  part(new THREE.BoxGeometry(.66, .03, .4), dark, 0, .315, 0, g);
  part(new THREE.BoxGeometry(.5, .16, .01), dark, 0, .15, .181, g);   // front panel inset
  for (let k = 0; k < 4; k++) part(new THREE.BoxGeometry(.4, .012, .012), steel, 0, .1 + k * .035, .188, g);   // vent slats
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => part(new THREE.CylinderGeometry(.03, .035, .03, 12), dark, x * .27, .015, z * .15, g));
  // blinking beacon on a little mast
  part(new THREE.CylinderGeometry(.008, .008, .2, 8), steel, .27, .42, -.14, g);
  const beacon = part(new THREE.SphereGeometry(.025, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffd25a, emissive: 0xffd25a, emissiveIntensity: 1 }), .27, .53, -.14, g);
  [['SPAWN', 0x36e06a, '#5dff8f', -.15], ['RESET', 0xff4057, '#ff7a8a', .15]].forEach(([name, col, css, x], i) => {
    part(new THREE.CylinderGeometry(.085, .092, .03, 28), dark, x, .345, 0, g);
    const ring = part(new THREE.TorusGeometry(.08, .009, 8, 36), steel, x, .36, 0, g); ring.rotation.x = Math.PI / 2;
    const cap = new THREE.Group(); cap.position.set(x, .36, 0); g.add(cap);
    const cm = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, roughness: .25, envMap: ENV, envMapIntensity: .6 });
    part(new THREE.CylinderGeometry(.066, .068, .028, 28), cm, 0, .014, 0, cap);
    const dome = part(new THREE.SphereGeometry(.066, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), cm, 0, .028, 0, cap); dome.scale.y = .38;
    const tex = labelTex(256, 96, (cg, w, h) => signText(cg, w, h, [[name, 52, css, 50]], 'rgba(14,20,30,.95)', css));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(.17, .064), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); lab.position.set(x, .272, .183); g.add(lab);
    buttons.push({ i, cap, cm, top: V(), down: 0, g });
  });
  mergeStatic(g, c => buttons.some(b => b.cap === c));
  g.updateMatrixWorld(true);
  buttons.forEach(b => { b.cap.getWorldPosition(b.top); b.top.y += .04; });
  AR.beacon = beacon;
  AR.consoleG = g;
  addCol({ t: 0, x: ARENA.x + CONSOLE.x, y: .165, z: ARENA.z + CONSOLE.z, hx: .33, hy: .165, hz: .2, yaw: g.rotation.y, tag: 'wood' });
}

/* ======================= the sword ======================= */
const runeTex = (() => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 32, 512); g.strokeStyle = '#fff'; g.lineWidth = 2.4; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 5;
  for (let i = 0; i < 13; i++) {           // made-up glyphs, a few strokes each
    const cy = 50 + i * 33;
    g.beginPath();
    for (let s = 0; s < 3 + (i % 2); s++) { const x0 = 8 + rnd() * 16, y0 = cy - 10 + rnd() * 20, x1 = 8 + rnd() * 16, y1 = cy - 10 + rnd() * 20; g.moveTo(x0, y0); if (rnd() < .4) g.arc(16, cy, 5 + rnd() * 4, rnd() * 3, 2 + rnd() * 3); else g.lineTo(x1, y1); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function makeSword() {
  const g = new THREE.Group();
  // the blade is HOT: its edges glow and the steel blushes orange as you cut
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 1, roughness: .2, envMap: ENV, envMapIntensity: 1.1, emissive: 0xff4a10, emissiveIntensity: 0 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .06, envMap: ENV, envMapIntensity: 1.5, emissive: 0xff8a20, emissiveIntensity: .3 });
  const fullerM = new THREE.MeshStandardMaterial({ color: 0x9aa7b6, metalness: 1, roughness: .32, envMap: ENV, emissive: 0x47e6ff, emissiveMap: runeTex, emissiveIntensity: 1.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .26, envMap: ENV, envMapIntensity: 1.2 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: .85 });
  const cord = new THREE.MeshStandardMaterial({ color: 0x2d1a10, roughness: .9 });
  const gem = new THREE.MeshStandardMaterial({ color: 0x47e6ff, emissive: 0x20b8e6, emissiveIntensity: .9, roughness: .08, metalness: .1, envMap: ENV });
  const gemR = new THREE.MeshStandardMaterial({ color: 0xff4f8a, emissive: 0xd0204f, emissiveIntensity: .7, roughness: .08, envMap: ENV });
  /* blade: a lofted diamond cross-section with bevelled edges and a rune-lit fuller, tapering to a point */
  const L = BLADE_B.y - BLADE_A.y, RINGS = 30;
  const wAt = s => { const w84 = .029 - .007 * .84; if (s < .84) return .029 - .007 * s; const u = (s - .84) / .16; return w84 * Math.pow(Math.max(0, 1 - u), .8) * (1 + .3 * u * (1 - u)); };
  const tAt = s => (.0095 - .0045 * s) * (s < .84 ? 1 : Math.max(.15, 1 - (s - .84) / .16));
  const fullerAt = s => { const a = clamp((s - .03) / .05, 0, 1) * clamp((.7 - s) / .08, 0, 1); return a * a * (3 - 2 * a); };
  const prof = s => {
    const w = wAt(s), t = tAt(s), fz = .5 * t - .22 * t * fullerAt(s), fw = .17 * w;
    return [[w, 0], [.6 * w, .5 * t], [.3 * w, .5 * t], [fw, fz], [-fw, fz], [-.3 * w, .5 * t], [-.6 * w, .5 * t], [-w, 0], [-.6 * w, -.5 * t], [-.3 * w, -.5 * t], [-fw, -fz], [fw, -fz], [.3 * w, -.5 * t], [.6 * w, -.5 * t]];
  };
  const kindOf = k => (k === 0 || k === 6 || k === 7 || k === 13) ? 0 : (k === 3 || k === 10) ? 2 : 1;   // 0 edge, 1 flat steel, 2 fuller
  const bufs = [[], [], []].map(() => ({ p: [], uv: [], idx: [] }));
  const ss = []; for (let i = 0; i <= RINGS; i++) { const u = i / RINGS; ss.push(u < .75 ? u * .84 / .75 : .84 + (u - .75) / .25 * .16); }
  const rings = ss.map(prof);
  for (let k = 0; k < 14; k++) {
    const b = bufs[kindOf(k)], base = b.p.length / 3;
    for (let i = 0; i <= RINGS; i++) {
      const y = BLADE_A.y + ss[i] * L, A = rings[i][k], B = rings[i][(k + 1) % 14];
      b.p.push(A[0], y, A[1], B[0], y, B[1]); b.uv.push(0, ss[i] / .72, 1, ss[i] / .72);
    }
    for (let i = 0; i < RINGS; i++) { const a = base + i * 2; b.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  [edge, steel, fullerM].forEach((m, i) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(bufs[i].p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(bufs[i].uv, 2)); geo.setIndex(bufs[i].idx);
    geo.computeVertexNormals(); part(geo, m, 0, 0, 0, g);
  });
  // base cap of the blade (hidden under the guard, but keeps it closed)
  { const sh = new THREE.Shape(); rings[0].forEach(([x, z], i) => i ? sh.lineTo(x, z) : sh.moveTo(x, z)); const cg = new THREE.ShapeGeometry(sh); cg.rotateX(Math.PI / 2); part(cg, steel, 0, BLADE_A.y, 0, g); }
  // langets: little gold tongues hugging the blade above the guard
  [1, -1].forEach(s => { const l = part(new THREE.ConeGeometry(.013, .045, 3), gold, 0, .135, s * .0052, g); l.scale.z = .25; });
  /* crossguard: curved quillons with ball finials and a gem-set centre block */
  const qc = new THREE.CatmullRomCurve3([V(-.128, .142, 0), V(-.104, .113, 0), V(-.055, .099, 0), V(0, .096, 0), V(.055, .099, 0), V(.104, .113, 0), V(.128, .142, 0)]);
  part(new THREE.TubeGeometry(qc, 48, .0095, 10), gold, 0, 0, 0, g);
  [-1, 1].forEach(s => {
    part(new THREE.SphereGeometry(.0165, 16, 12), gold, s * .13, .146, 0, g);
    const tip = part(new THREE.ConeGeometry(.007, .022, 10), gold, s * .137, .165, 0, g); tip.rotation.z = -s * .45;
  });
  const blk = part(new THREE.CylinderGeometry(.027, .027, .024, 6), gold, 0, .1, 0, g); blk.rotation.x = Math.PI / 2;
  [1, -1].forEach(s => {
    const gm = part(new THREE.SphereGeometry(.0115, 16, 10), gemR, 0, .1, s * .0115, g); gm.scale.z = .55;
    const rr = part(new THREE.TorusGeometry(.0125, .0022, 6, 20), gold, 0, .1, s * .0118, g);
  });
  /* grip: a waisted leather handle with a spiral cord wrap and gold ferrules */
  const gpts = []; for (let i = 0; i <= 12; i++) { const y = -.085 + i / 12 * .17; gpts.push(new THREE.Vector2(.0152 + .0028 * Math.sin(Math.PI * i / 12), y)); }
  part(new THREE.LatheGeometry(gpts, 20), leather, 0, 0, 0, g);
  const hp = []; for (let i = 0; i <= 140; i++) { const u = i / 140, y = -.079 + u * .158, a = u * Math.PI * 2 * 6.5, r = .0154 + .0028 * Math.sin(Math.PI * (y + .085) / .17) + .0012; hp.push(V(Math.cos(a) * r, y, Math.sin(a) * r)); }
  part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 220, .0021, 5), cord, 0, 0, 0, g);
  [.087, -.087].forEach(y => { part(new THREE.CylinderGeometry(.0196, .0196, .012, 20), gold, 0, y, 0, g); const bd = part(new THREE.TorusGeometry(.0196, .0022, 6, 22), gold, 0, y + Math.sign(y) * .006, 0, g); bd.rotation.x = Math.PI / 2; });
  /* pommel: a gold bulb with a ring and gems */
  const pp = [[.0, -.0915], [.012, -.092], [.022, -.098], [.029, -.11], [.027, -.124], [.018, -.135], [.007, -.1405], [0, -.141]].map(([r, y]) => new THREE.Vector2(r, y));
  part(new THREE.LatheGeometry(pp, 24), gold, 0, 0, 0, g);
  const prg = part(new THREE.TorusGeometry(.0293, .0028, 8, 30), gold, 0, -.11, 0, g); prg.rotation.x = Math.PI / 2;
  part(new THREE.SphereGeometry(.0075, 12, 8), gem, 0, -.141, 0, g);
  [1, -1].forEach(s => { const pg = part(new THREE.SphereGeometry(.0085, 12, 8), gem, 0, -.112, s * .027, g); pg.scale.z = .5; });
  mergeStatic(g); g.userData.hot = { edge, steel };
  return g;
}
const sword = { g: makeSword(), held: null, mode: 'stone', body: null, pq: new THREE.Quaternion(), ppos: V(), av: V(), lv: V() };
sword.hot = sword.g.userData.hot;
arena.add(sword.g);
const STONE = V(-1.7, 0, AR_SPAWN.z + .35);
{
  const g = new THREE.Group(); g.position.copy(STONE); arena.add(g);
  const rock = mat(0x8e959e), moss = mat(0x58b84a);
  const b = part(new THREE.DodecahedronGeometry(.38, 1), rock, 0, .12, 0, g); b.scale.set(1, .55, .9);
  [[.33, .05, .15, .12], [-.3, .04, -.2, .1], [.1, .03, -.34, .08], [-.18, .04, .3, .09]].forEach(([x, y, z, r]) => part(new THREE.DodecahedronGeometry(r, 0), rock, x, y, z, g));
  [[.13, .3, .1, .06], [-.15, .29, -.06, .05], [.21, .23, -.15, .045], [-.05, .31, .16, .04], [-.24, .22, .12, .045]].forEach(([x, y, z, r]) => { const m = part(new THREE.SphereGeometry(r, 10, 8), moss, x, y, z, g); m.scale.y = .35; });
  // a wooden "PULL!" sign
  const tex = labelTex(256, 128, (cg, w, h) => signText(cg, w, h, [['PULL ME!', 56, '#ffd25a', 66]], 'rgba(92,58,30,.98)', '#3a2412'));
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(.3, .15), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); sg.position.set(.05, .42, .42); sg.rotation.y = .25; g.add(sg);
  part(new THREE.CylinderGeometry(.012, .012, .36, 8), mat(0x6b4426), .05, .18, .4, g);
  mergeStatic(g);
  addCol({ t: 1, x: ARENA.x + STONE.x, z: ARENA.z + STONE.z, cy: .16, hy: .16, r: .34, tag: 'rock' });
}
/* ======================= the MEGA cube's spot ======================= */
const megaSign = (() => {
  const g = new THREE.Group(); g.position.copy(MEGA_AT); arena.add(g);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.53, .57, 48), new THREE.MeshBasicMaterial({ color: 0xff7fd6 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .004; g.add(ring);
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const cg = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(.56, .175), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); board.position.set(.74, .62, .1); board.rotation.y = -.25; g.add(board);
  part(new THREE.CylinderGeometry(.014, .017, .54, 8), smat(0x8c96a4, { metalness: .6, roughness: .35 }), .74, .27, .08, g);
  let last = -1;
  const draw = () => { const n = AR.pieces.filter(p => p.kind === 6).length; if (n === last) return; last = n; cg.clearRect(0, 0, 512, 160); signText(cg, 512, 160, [['MEGA CUBE', 60, '#ff8fe0', 56], [n <= 1 ? 'slice me!' : `${n} pieces!`, 44, '#ffffff', 116]], 'rgba(22,30,44,.92)', '#ff4fc3'); tex.needsUpdate = true; };
  labelFns.push(() => { last = -1; draw(); });
  return draw;
})();
const STONE_POSE = { p: V().copy(STONE).add(V(0, .53, 0)), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, .7, .07)) };
function swordToStone() {
  if (sword.body) { AR.world.removeRigidBody(sword.body); sword.body = null; }
  if (sword.held) { sword.held.sword = false; sword.held = null; }
  sword.mode = 'stone'; sword.g.position.copy(STONE_POSE.p); sword.g.quaternion.copy(STONE_POSE.q); AR.bladeOk = false;
}
swordToStone();

/* trail behind the blade when you swing fast: it glows hot, like the blade */
const TRAIL_N = 16;
const trail = (() => {
  const pos = new Float32Array(TRAIL_N * 2 * 3), al = new Float32Array(TRAIL_N * 2), idx = [];
  for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('a', new THREE.BufferAttribute(al, 1)); geo.setIndex(idx);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { col: { value: new THREE.Color(0xffb43c) }, hot: { value: new THREE.Color(0xfff2b0) } },
    vertexShader: 'attribute float a; varying float va; void main(){ va = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 col; uniform vec3 hot; varying float va; void main(){ gl_FragColor = vec4(mix(col, hot, va * va) * va, va); }' });
  const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; arena.add(mesh);
  return { mesh, pos, al, geo, hist: [], k: 0 };
})();

