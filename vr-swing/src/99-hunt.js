/* ======================================================================
   🩸 THE HUNT (step 1: the map, the race and the Thumpling cutscene)
   LOBBY: a giant hole in the grove's cliff wall glowing RED. Walk into it (or tap 🩸 / the VOTE button) to vote.
   75% of the players in the room must vote before it starts. Alone = you are 100%, so it starts right away.
   🧪 TEST ALONE: jump in by yourself (with 3 race bots) without any vote.
   THE MAP (own area, state.area 'hunt', world HUNT): a dark horror arena in green fog.
   Gauntlet (race lane) -> central Playground (teal bear mural floor, green slide, swings, merry-go-round)
   -> Theater (north), Party Room (west), Water Area (east), Storage (south-west), Trap Room (dead end at the end
   of the red path, big X). Corridors loop between the rooms, purple glowing doors, hidden spots.
   THE RACE: hurdles, crate zig-zag, a climbing wall, then the RED Artifact in the middle of the playground.
   Grab it and pull it to your chest (PC / phone: E / ✋ next to it). Cutscene: bones crack, shaking, swelling,
   a burst of blood, and the THUMPLING MONSTER comes out. The winner becomes the Thumpling (hunting rules = next step).
   Net t:'hu' (vote / go / win / again). Test hook __kg.hunt
   ====================================================================== */
const HUNT = V(-1500, 0, 0);
const HU = { phase: 'off', inside: false, mode: 'test', votes: new Map(), bots: [], t: 0, raceT: 0, cd: 0, winner: null, iAmMon: false, saved: null, toured: false,
  secrets: new Set((store.get('kg-husec') || '').split(',').filter(Boolean)), relicH: null, cs: null, tour: null, mons: [], decor: [], xT: 0, voteSeen: 0, amb: null, lastB: false, toldGrab: false };
const hL = (x, y, z) => V(HUNT.x + x, HUNT.y + y, HUNT.z + z);
const HU_WALL_H = 4.5, HU_START_Z = 60, HU_HURDLES = [50, 46, 42];
const _hu1 = V(), _hu2 = V(), _hu3 = V(), _huQ = new THREE.Quaternion();
const HUG = new THREE.Group(); HUG.position.copy(HUNT); scene.add(HUG); HUG.visible = false;

/* ---------- textures ---------- */
const HU_GLOW = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const huGlow = (col, s, op = .8) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: HU_GLOW, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(s); return sp; };
const huRand = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const HU_WALL_T = canvasTex(256, 512, (g, w, h) => {
  for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#22302e' : '#1b2725'; g.fillRect(x, 0, 32, h); g.fillStyle = 'rgba(120,160,140,.05)'; for (let y = 8; y < h * .76; y += 26) g.fillRect(x + 12, y, 8, 8); }
  g.fillStyle = '#121917'; g.fillRect(0, h * .76, w, h * .24); g.fillStyle = '#3b2a20'; g.fillRect(0, h * .755, w, 10); g.fillStyle = '#0a0d0c'; g.fillRect(0, h - 14, w, 14);
  for (let i = 0; i < 60; i++) { const x = huRand() * w, y = huRand() * h, r = 6 + huRand() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${huRand() < .5 ? '40,30,10' : '0,0,0'},.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 3; i++) { const x = 30 + huRand() * (w - 60), y0 = 8 + huRand() * 40, L = 60 + huRand() * 160; g.fillStyle = 'rgba(110,8,12,.85)'; g.fillRect(x, y0, 3 + huRand() * 3, L); g.beginPath(); g.arc(x + 2.5, y0 + L, 4, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; const sx = 60 + huRand() * 120, sy = 200 + huRand() * 80; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(sx + k * 12, sy); g.lineTo(sx + k * 12 + 26, sy + 70); g.stroke(); }
});
HU_WALL_T.wrapS = HU_WALL_T.wrapT = THREE.RepeatWrapping;
const HU_FLOOR_T = canvasTex(256, 256, (g, w, h) => {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#1d2421' : '#262f2a'; g.fillRect(i * 128, j * 128, 128, 128); }
  g.strokeStyle = '#0b0f0d'; g.lineWidth = 4; g.strokeRect(0, 0, 128, 128); g.strokeRect(128, 0, 128, 128); g.strokeRect(0, 128, 128, 128); g.strokeRect(128, 128, 128, 128);
  for (let i = 0; i < 40; i++) { const x = huRand() * w, y = huRand() * h, r = 4 + huRand() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { let x = huRand() * w, y = huRand() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (huRand() - .5) * 40; y += (huRand() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
});
HU_FLOOR_T.wrapS = HU_FLOOR_T.wrapT = THREE.RepeatWrapping;
const HU_MURAL_T = canvasTex(1024, 1024, (g, w) => {
  const c = w / 2; g.fillStyle = '#0f2422'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
  g.strokeStyle = '#2b6f66'; g.lineWidth = 34; g.beginPath(); g.arc(c, c, c - 40, 0, 7); g.stroke(); g.strokeStyle = '#c99a2e'; g.lineWidth = 8; g.setLineDash([30, 22]); g.beginPath(); g.arc(c, c, c - 72, 0, 7); g.stroke(); g.setLineDash([]);
  const T = '#3fbfae', TD = '#2b8f82';
  [[-1], [1]].forEach(([s]) => { g.fillStyle = T; g.beginPath(); g.arc(c + s * 230, c - 220, 105, 0, 7); g.fill(); g.fillStyle = '#ffb7c8'; g.beginPath(); g.arc(c + s * 230, c - 220, 55, 0, 7); g.fill(); });
  g.fillStyle = T; g.beginPath(); g.arc(c, c + 20, 310, 0, 7); g.fill(); g.fillStyle = TD; g.beginPath(); g.arc(c, c + 60, 310, .25, Math.PI - .25); g.fill(); g.fillStyle = T; g.beginPath(); g.arc(c, c + 5, 300, 0, 7); g.fill();
  g.fillStyle = '#d8f5ef'; g.beginPath(); g.ellipse(c, c + 120, 150, 110, 0, 0, 7); g.fill();
  g.fillStyle = '#16211f'; g.beginPath(); g.ellipse(c, c + 70, 46, 32, 0, 0, 7); g.fill();
  g.strokeStyle = '#16211f'; g.lineWidth = 12; g.beginPath(); g.arc(c - 45, c + 130, 45, .2, Math.PI - .5); g.stroke(); g.beginPath(); g.arc(c + 45, c + 130, 45, .5, Math.PI - .2); g.stroke();
  [-1, 1].forEach(s => { g.fillStyle = '#16211f'; g.beginPath(); g.arc(c + s * 120, c - 40, 46, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(c + s * 120 + 14, c - 56, 14, 0, 7); g.fill();
    g.strokeStyle = 'rgba(150,0,10,.9)'; g.lineWidth = 14; g.beginPath(); g.moveTo(c + s * 120 - 55, c - 95); g.lineTo(c + s * 120 + 55, c + 15); g.moveTo(c + s * 120 + 55, c - 95); g.lineTo(c + s * 120 - 55, c + 15); g.stroke(); });
  g.strokeStyle = '#3fae4a'; g.lineWidth = 16; g.beginPath(); g.moveTo(c, c - 290); g.quadraticCurveTo(c + 10, c - 360, c - 5, c - 400); g.stroke();
  g.fillStyle = '#5fd06a'; g.beginPath(); g.ellipse(c - 60, c - 405, 70, 30, -.4, 0, 7); g.fill(); g.beginPath(); g.ellipse(c + 55, c - 410, 70, 30, .4, 0, 7); g.fill();
  for (let i = 0; i < 9; i++) { const x = huRand() * w, y = huRand() * w; g.fillStyle = `rgba(${90 + huRand() * 50 | 0},0,6,${.35 + huRand() * .4})`; g.beginPath(); g.ellipse(x, y, 20 + huRand() * 70, 10 + huRand() * 30, huRand() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(120,0,8,.75)'; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(c + 260, c + 200); g.bezierCurveTo(c + 120, c + 260, c - 40, c + 230, c - 200, c + 330); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; for (let i = 0; i < 14; i++) { let x = huRand() * w, y = huRand() * w; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (huRand() - .5) * 90; y += (huRand() - .5) * 90; g.lineTo(x, y); } g.stroke(); }
});
function huBloodySign(text, sub) {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#3b2a1e'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 52) { g.fillStyle = y / 52 % 2 ? '#47331f' : '#3f2d1d'; g.fillRect(0, y, w, 50); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y + 49, w, 3); }
    g.strokeStyle = '#1c130c'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${sub ? 92 : 104}px "Lilita One", Impact, sans-serif`;
    g.lineWidth = 14; g.strokeStyle = '#1a0a06'; g.strokeText(text, w / 2, sub ? 100 : h / 2); g.fillStyle = '#f4efe2'; g.fillText(text, w / 2, sub ? 100 : h / 2);
    if (sub) { g.font = '50px "Lilita One", Impact, sans-serif'; g.fillStyle = '#ff5a5a'; g.fillText(sub, w / 2, 196); }
    for (let i = 0; i < 26; i++) { const x = 90 + huRand() * (w - 180), y = 50 + huRand() * 110, L = 20 + huRand() * 110; g.fillStyle = `rgba(${130 + huRand() * 40 | 0},0,8,.92)`; g.fillRect(x, y, 4 + huRand() * 6, L); g.beginPath(); g.arc(x + 4, y + L, 6, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(140,0,10,.8)'; g.beginPath(); g.arc(huRand() * w, huRand() * h, 2 + huRand() * 9, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(120,0,8,.8)'; const hx = w - 150, hy = 120; g.beginPath(); g.ellipse(hx, hy, 34, 40, 0, 0, 7); g.fill(); for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(hx - 30 + k * 20, hy - 58, 8, 22, (k - 1.5) * .15, 0, 7); g.fill(); }
  });
}

/* ---------- build helpers: walls are merged into ONE mesh, every piece still gets a real collider ---------- */
const HU_WALLS = [], HU_FRAMES = [], HU_DOORS = new Map();
function huWall(x, z, w, d, y0 = 0, y1 = HU_WALL_H) {
  const h = y1 - y0, g = new THREE.BoxGeometry(w, h, d); g.translate(x, y0 + h / 2, z); HU_WALLS.push(g);
  addCol({ t: 0, x: HUNT.x + x, y: HUNT.y + y0 + h / 2, z: HUNT.z + z, hx: w / 2, hy: h / 2, hz: d / 2, tag: 'rock' });
}
// a rectangle of walls; doors per side: numbers (3 m gap, purple frame) or { c, w, h, hide } for secret gaps
function huRoom(x0, x1, z0, z1, doors = {}) {
  const T = .4;
  const side = (key, fixed, a0, a1, horiz) => {
    const gaps = (doors[key] || []).map(o => typeof o === 'number' ? { c: o, w: 3, h: 3 } : Object.assign({ w: 3, h: 3 }, o)).sort((a, b) => a.c - b.c);
    const seg = (p0, p1, y0, y1) => { if (p1 - p0 < .05) return; const c = (p0 + p1) / 2, L = p1 - p0 + (y0 === 0 ? T : 0); if (horiz) huWall(c, fixed, L, T, y0, y1); else huWall(fixed, c, T, L, y0, y1); };
    let s = a0;
    for (const o of gaps) {
      const g0 = o.c - o.w / 2, g1 = o.c + o.w / 2;
      seg(s, Math.max(s, g0), 0, HU_WALL_H); seg(Math.max(a0, g0), Math.min(a1, g1), o.h, HU_WALL_H);
      if (!o.hide) { const key = horiz ? `${o.c.toFixed(1)},${fixed.toFixed(1)}` : `${fixed.toFixed(1)},${o.c.toFixed(1)}`; if (!HU_DOORS.has(key)) HU_DOORS.set(key, horiz ? { x: o.c, z: fixed, yaw: 0, w: o.w } : { x: fixed, z: o.c, yaw: Math.PI / 2, w: o.w }); }
      s = g1;
    }
    seg(s, a1, 0, HU_WALL_H);
  };
  side('n', z0, x0, x1, true); side('s', z1, x0, x1, true); side('w', x0, z0, z1, false); side('e', x1, z0, z1, false);
}
function huBox(x, y, z, w, h, d, m, o = {}) {   // a prop box (solid unless o.solid === false)
  const me = new THREE.Mesh(o.geo || new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.rotation.y = o.yaw || 0; me.castShadow = !!o.shadow; me.receiveShadow = true; (o.parent || HUG).add(me);
  if (o.solid !== false) addCol({ t: 0, x: HUNT.x + x, y: HUNT.y + y, z: HUNT.z + z, hx: w / 2, hy: h / 2, hz: d / 2, yaw: o.yaw || 0, tag: o.tag || 'wood' });
  return me;
}
function huCyl(x, y, z, r, h, m, o = {}) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(o.r2 || r, r, h, o.seg || 12), m); me.position.set(x, y, z); (o.parent || HUG).add(me);
  if (o.solid !== false) addCol({ t: 1, x: HUNT.x + x, z: HUNT.z + z, cy: HUNT.y + y, hy: h / 2, r: Math.max(r, o.r2 || 0), tag: o.tag || 'wood' });
  return me;
}
function huPlane(x, y, z, w, h, m, rx = 0, ry = 0) { const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.set(rx, ry, 0); HUG.add(me); return me; }
const hm = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, flatShading: true }, o));
const HUM = { wood: hm(0x4a3426), dark: hm(0x1b1d1c), metal: hm(0x5a6366, { metalness: .6, roughness: .45 }), rust: hm(0x6b3a22, { metalness: .3 }), green: hm(0x2f9e45, { roughness: .5 }), red: hm(0x8a1018), velvet: hm(0x5a0f1c),
  blood: new THREE.MeshStandardMaterial({ color: 0x5a0006, roughness: .25, transparent: true, opacity: .9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), purple: new THREE.MeshBasicMaterial({ color: 0xb04bff, fog: false }),
  redGlow: new THREE.MeshBasicMaterial({ color: 0xff2030 }), lamp: new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffe8a0, emissiveIntensity: 1 }) };
const HU_LAMPS = [];
function huLamp(x, z, y = HU_WALL_H - .05) {   // a dangling ceiling bulb that flickers
  const g = new THREE.Group(); g.position.set(x, y, z); HUG.add(g);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .7, 4), HUM.dark); cord.position.y = -.35; g.add(cord);
  const m = HUM.lamp.clone(); const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), m); b.position.y = -.75; g.add(b);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(.22, .16, 12, 1, true), hm(0x2a3330, { side: THREE.DoubleSide })); shade.position.y = -.68; g.add(shade);
  const gl = huGlow(0xffe0a0, 1.2, .5); gl.position.y = -.78; g.add(gl);
  HU_LAMPS.push({ g, m, gl, ph: huRand() * 9, base: .5 + huRand() * .3 }); return g;
}

/* ---------- THE LAYOUT (local metres, -z = north) ---------- */
huRoom(-13, 13, -13, 13, { n: [0], s: [0], w: [0], e: [0] });                   // 🛝 Playground
huRoom(-3, 3, 13, 64, { n: [0], w: [20] });                                      // 🏁 the Gauntlet (race lane)
huRoom(-17, -3, 18.5, 21.5, { w: [20], e: [20] });                               // corridor: Gauntlet <-> Storage
huRoom(-31, -17, 12, 28, { n: [-25], e: [20], w: [{ c: 16, w: 1.1, h: .9, hide: true }] });   // 📦 Storage (+ a vent)
huRoom(-37, -31, 14.9, 17.1, { e: [{ c: 16, w: 1.1, h: .9, hide: true }] }); huWall(-34, 16, 6.4, 2.6, 1.0, HU_WALL_H);   // the vent crawl (low ceiling)
huRoom(-26.5, -23.5, 8, 12, { n: [-25], s: [-25] });                             // corridor: Storage <-> Party
huRoom(-33, -17, -8, 8, { e: [0], n: [-25], s: [-25] });                         // 🎂 Party Room
huRoom(-17, -13, -1.5, 1.5, { w: [0], e: [0] });                                 // corridor: Party <-> Playground
huRoom(-26.5, -23.5, -26.5, -8, { s: [-25], e: [-25] });                         // NW corridor
huRoom(-23.5, -10, -26.5, -23.5, { w: [-25], e: [-25] });
huRoom(-10, 10, -35, -17, { s: [0], w: [-25], e: [-25], n: [{ c: 7.8, w: .9, h: 2.2, hide: true }] });   // 🎭 Theater (+ gap behind the curtain)
huRoom(4, 10, -39.5, -35, { s: [{ c: 7.8, w: .9, h: 2.2, hide: true }] });     // the projection closet behind the screen
huRoom(-1.5, 1.5, -17, -13, { n: [0], s: [0] });                                 // corridor: Playground <-> Theater
huRoom(13, 17, -1.5, 1.5, { w: [0], e: [0] });                                   // corridor: Playground <-> Water
huRoom(17, 33, -8, 8, { w: [0], n: [25] });                                      // 🏊 Water Area
huRoom(23.5, 26.5, -40, -8, { s: [25], n: [25], w: [-25] });                     // NE corridor + the red path north
huRoom(10, 23.5, -26.5, -23.5, { w: [-25], e: [-25] });
huRoom(19, 31, -52, -40, { s: [25] });                                           // ❌ Trap Room (dead end)
// floor, ceiling, outer ground collider
{
  const fg = new THREE.PlaneGeometry(80, 124); fg.rotateX(-Math.PI / 2); const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 62);
  const f = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: HU_FLOOR_T, roughness: .7 })); f.position.set(-2, 0, 6); f.receiveShadow = true; HUG.add(f);
  addCol({ t: 0, x: HUNT.x - 2, y: -2, z: HUNT.z + 6, hx: 42, hy: 2, hz: 64, tag: 'rock' });
  const c = new THREE.Mesh(new THREE.PlaneGeometry(80, 124), hm(0x0d1210)); c.rotation.x = Math.PI / 2; c.position.set(-2, HU_WALL_H, 6); HUG.add(c);
  addCol({ t: 0, x: HUNT.x - 2, y: HU_WALL_H + .6, z: HUNT.z + 6, hx: 42, hy: .6, hz: 64, tag: 'rock' });
}
// 🛝 THE PLAYGROUND
const HU_SWINGS = [], HU_SPIN = { g: null };
{
  const mur = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), new THREE.MeshStandardMaterial({ map: HU_MURAL_T, roughness: .6, polygonOffset: true, polygonOffsetFactor: -1 })); mur.rotation.x = -Math.PI / 2; mur.position.y = .012; HUG.add(mur);
  // welcome sign over the gauntlet door, inside the playground, and one over the race start
  const sm = new THREE.MeshStandardMaterial({ map: huBloodySign('Welcome to Knuckle Grove!'), roughness: .8 });
  huPlane(0, 3.75, 12.75, 5.6, 1.4, sm, 0, Math.PI);
  huPlane(0, 3.7, 57.6, 5.6, 1.4, new THREE.MeshStandardMaterial({ map: huBloodySign('Welcome to Knuckle Grove!', 'race to the RED Artifact'), roughness: .8 }), 0, Math.PI);
  // the green slide: tower, ladder (real climbing holds), chute you can slide down
  const sx = -7, sz = -6;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => huCyl(sx + a * .95, 1.25, sz + b * .95, .07, 2.5, HUM.metal, { seg: 8 }));
  huBox(sx, 2, sz, 2.1, .12, 2.1, HUM.green);
  [[0, -1.02, 2.1, .06], [-1.02, 0, .06, 2.1], [1.02, 0, .06, 2.1]].forEach(([dx, dz, w, d]) => huBox(sx + dx, 2.45, sz + dz, w, .06, d, HUM.green, { solid: false }));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, .9, 4), hm(0x2a7a3a)); roof.position.set(sx, 3.15, sz); roof.rotation.y = Math.PI / 4; HUG.add(roof);
  for (let i = 0; i < 6; i++) { const y = .3 + i * .32, rung = huBox(sx, y, sz - 1.25, .9, .05, .05, HUM.metal, { solid: false }); HOLDS.push({ m: rung, p: hL(sx, y, sz - 1.25), r: .06, n: V(0, 0, -1) }); }
  [-.45, .45].forEach(dx => huBox(sx + dx, 1.1, sz - 1.25, .05, 2.2, .05, HUM.metal, { solid: false }));
  const ang = Math.atan2(1.8, 4.2), L = Math.hypot(1.8, 4.2), cz = sz + 1.05 + 2.1, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(ang, 0, 0));
  const ch = new THREE.Group(); ch.position.set(sx, 1.05, cz); ch.quaternion.copy(q); HUG.add(ch);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1, .06, L), hm(0x46d45c, { roughness: .35, flatShading: false })); ch.add(bed);
  [-.5, .5].forEach(dx => { const r = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, L), HUM.green); r.position.set(dx, .14, 0); ch.add(r); });
  addCol({ t: 5, x: HUNT.x + sx, y: HUNT.y + 1.05, z: HUNT.z + cz, hx: .5, hy: .05, hz: L / 2, q: q.clone(), tag: 'wood' });
  // swings: one of them swings all by itself
  const fx = 7, fz = -6;
  [-2.4, 2.4].forEach(dx => [-.7, .7].forEach(dz => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.9, 8), HUM.rust); leg.position.set(fx + dx, 1.35, fz + dz * .5); leg.rotation.x = dz > 0 ? .25 : -.25; HUG.add(leg); }));
  huCyl(fx - 2.4, 1.3, fz, .2, 2.6, HUM.rust, { solid: true, seg: 6 }).visible = false; huCyl(fx + 2.4, 1.3, fz, .2, 2.6, HUM.rust, { seg: 6 }).visible = false;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 5, 8), HUM.rust); bar.rotation.z = Math.PI / 2; bar.position.set(fx, 2.75, fz); HUG.add(bar);
  [-1.5, 0, 1.5].forEach((dx, i) => {
    const p = new THREE.Group(); p.position.set(fx + dx, 2.72, fz); HUG.add(p);
    [-.22, .22].forEach(cx => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 1.95, 4), HUM.metal); c.position.set(cx, -.98, 0); p.add(c); });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(.55, .05, .22), i === 1 ? hm(0x9a1d2a) : hm(0x2b6f66)); seat.position.y = -1.96; p.add(seat);
    HU_SWINGS.push({ p, i });
  });
  // merry-go-round that turns slowly by itself
  const mg = new THREE.Group(); mg.position.set(7, 0, 6.5); HUG.add(mg); HU_SPIN.g = mg;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, .12, 24), hm(0x7a2a2a)); disc.position.y = .25; mg.add(disc);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, hb = new THREE.Mesh(new THREE.TorusGeometry(.35, .03, 6, 12, Math.PI), HUM.metal); hb.position.set(Math.cos(a) * 1.05, .62, Math.sin(a) * 1.05); hb.rotation.y = -a; mg.add(hb); }
  huCyl(7, .2, 6.5, 1.5, .4, hm(0x7a2a2a), { seg: 12 }).visible = false;
  // benches, a sandbox with a buried plush
  [[-10.5, 6], [-10.5, 9.5]].forEach(([x, z]) => { huBox(x, .45, z, .5, .08, 2.2, HUM.wood); huBox(x - .25, .8, z, .08, .6, 2.2, HUM.wood, { solid: false }); huBox(x, .22, z - .9, .4, .44, .1, HUM.dark, { solid: false }); huBox(x, .22, z + .9, .4, .44, .1, HUM.dark, { solid: false }); });
  huBox(-6.5, .15, 7.5, 3.4, .3, .2, HUM.wood); huBox(-6.5, .15, 10.3, 3.4, .3, .2, HUM.wood); huBox(-8.1, .15, 8.9, .2, .3, 3, HUM.wood); huBox(-4.9, .15, 8.9, .2, .3, 3, HUM.wood);
  const sand = new THREE.Mesh(new THREE.BoxGeometry(3, .2, 2.6), hm(0x5c5236)); sand.position.set(-6.5, .1, 8.9); HUG.add(sand);
  const plush = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), hm(0x3fbfae)); plush.position.set(-6.1, .25, 8.6); plush.scale.y = .8; HUG.add(plush);
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), hm(0x3fbfae)); e.position.set(-6.1 + s * .15, .42, 8.6); HUG.add(e); });
  huLamp(-6, -6); huLamp(6, 6); huLamp(6, -6); huLamp(-6, 6);
}
// 🎭 THE THEATER
const HU_SCREEN = { tex: null, cv: null, t: 0 };
{
  const cush = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, .18, .55), HUM.velvet, 40), back = new THREE.InstancedMesh(new THREE.BoxGeometry(.6, .7, .1), HUM.velvet, 40), m4 = new THREE.Matrix4();
  let n = 0;
  for (let r = 0; r < 5; r++) for (let s = 0; s < 8; s++) { const x = (s < 4 ? -7 + s * .7 : 1.6 + (s - 4) * .7) + .3, z = -27 + r * 1.6; m4.makeTranslation(x, .45, z); cush.setMatrixAt(n, m4); m4.makeTranslation(x, .8, z + .3); back.setMatrixAt(n, m4); n++; }
  HUG.add(cush, back);
  for (let r = 0; r < 5; r++) { const z = -27 + r * 1.6; huBox(-5.25, .45, z + .1, 2.9, .9, .7, HUM.velvet, { solid: true }).visible = false; huBox(3.95, .45, z + .1, 2.9, .9, .7, HUM.velvet).visible = false; }
  huBox(0, .3, -33, 16, .6, 3.6, HUM.wood);                       // stage
  const c = document.createElement('canvas'); c.width = 128; c.height = 72; HU_SCREEN.cv = c; HU_SCREEN.tex = new THREE.CanvasTexture(c); HU_SCREEN.tex.colorSpace = THREE.SRGBColorSpace;
  const scr = huPlane(0, 2.65, -34.75, 8.6, 3.3, new THREE.MeshBasicMaterial({ map: HU_SCREEN.tex, color: 0x9aa8b8 })); HU_SCREEN.m = scr;
  huBox(0, 2.65, -34.78, 9, 3.7, .05, HUM.dark, { solid: false });
  const cm = hm(0x6a0c16, { flatShading: false }); const fold = () => { const g = new THREE.CylinderGeometry(.16, .16, 4.4, 8, 1, false, 0, Math.PI); return g; };
  [[-5.4, -1], [5.4, 1]].forEach(([x0]) => { for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(fold(), cm); f.position.set(x0 + (x0 < 0 ? -k * .3 : k * .3) + (x0 > 0 ? 0 : 0), 2.2, -34.6); f.rotation.y = Math.PI; HUG.add(f); } });
  for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(fold(), cm); f.position.set(7.2 + k * .28, 2.2, -34.55); f.rotation.y = Math.PI; HUG.add(f); }   // the curtain hiding the gap 🤫
  const pm = new THREE.Mesh(new THREE.BoxGeometry(.5, .35, .7), HUM.dark); pm.position.set(7.4, .55, -37.6); HUG.add(pm);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .2, 12), HUM.metal); lens.rotation.x = Math.PI / 2; lens.position.set(7.4, .58, -37.15); HUG.add(lens);
  huLamp(-5, -22); huLamp(5, -22);
}
// 🎂 THE PARTY ROOM
const HU_CANDLES = [];
{
  huBox(-25, .75, 0, 2, .1, 9, hm(0xe8e0d0));
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.1, .4, 9.1), hm(0xd8c7c0)); cloth.position.set(-25, .55, 0); HUG.add(cloth);
  [[-.9, -4.3], [.9, -4.3], [-.9, 4.3], [.9, 4.3]].forEach(([dx, dz]) => huBox(-25 + dx, .36, dz, .08, .72, .08, HUM.wood, { solid: false }));
  for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1, z = -3.5 + (i >> 1) * 3.5, ch = new THREE.Group(); ch.position.set(-25 + side * 1.45, 0, z); ch.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; if (i === 3) { ch.rotation.z = Math.PI / 2; ch.position.y = .25; ch.position.x += .6; } HUG.add(ch);
    const s = new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .5), HUM.wood); s.position.y = .45; ch.add(s); const b = new THREE.Mesh(new THREE.BoxGeometry(.5, .55, .06), HUM.wood); b.position.set(0, .75, .22); ch.add(b);
    [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].forEach(([a, c]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(.05, .45, .05), HUM.wood); l.position.set(a, .22, c); ch.add(l); }); }
  // the rotten cake: two tiers, mold, candles
  const ck = hm(0xb07a86), mold = hm(0x4f7a3a);
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(.55, .58, .4, 18), ck); t1.position.set(-25, 1.0, 0); HUG.add(t1);
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(.36, .38, .32, 18), ck); t2.position.set(-25, 1.36, 0); HUG.add(t2);
  for (let i = 0; i < 9; i++) { const a = huRand() * 7, s = new THREE.Mesh(new THREE.SphereGeometry(.06 + huRand() * .05, 6, 5), mold); s.position.set(-25 + Math.cos(a) * .55, .9 + huRand() * .3, Math.sin(a) * .55); s.scale.z = .4; s.lookAt(hL(-25, 1, 0).sub(HUNT)); HUG.add(s); }
  const sl = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, .3), hm(0x2a0a0a)); sl.position.set(-25 + .42, 1.0, .2); sl.rotation.y = .6; HUG.add(sl);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, cn = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .14, 6), hm(0xf0e0ff)); cn.position.set(-25 + Math.cos(a) * .22, 1.59, Math.sin(a) * .22); HUG.add(cn);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(.018, .05, 6), new THREE.MeshBasicMaterial({ color: 0x7dff9a })); fl.position.set(cn.position.x, 1.69, cn.position.z); HUG.add(fl); const gl = huGlow(0x7dff9a, .25, .6); gl.position.copy(fl.position); HUG.add(gl); HU_CANDLES.push({ fl, gl, ph: i * 1.7 }); }
  // party hats, presents, balloons (some floating, some dead on the floor), torn banner
  const hatC = [0xc23b6a, 0x3b7ac2, 0xc2a83b];
  for (let i = 0; i < 5; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(.12, .3, 10), hm(hatC[i % 3])); h.position.set(-25 + (huRand() - .5) * 1.4, .95, -3.6 + i * 1.8); h.rotation.z = huRand() < .4 ? 1.4 : 0; HUG.add(h); }
  [[-31, -6, .8, 0x6a2a8a], [-30, -6.2, .6, 0x2a6a5a], [-31.5, 6.2, .9, 0x8a6a2a], [-19, 6.3, .7, 0x8a2a2a]].forEach(([x, z, s, c]) => { huBox(x, s / 2, z, s, s, s, hm(c), { tag: 'wood' }); const rb = new THREE.Mesh(new THREE.BoxGeometry(s + .02, s * .15, s * .15), hm(0xd8c7a0)); rb.position.set(x, s / 2, z); HUG.add(rb); });
  const balC = [0x7a1020, 0x4a1a6a, 0x1a4a5a];
  for (let i = 0; i < 6; i++) { const x = -31 + huRand() * 12, z = -7 + huRand() * 14, up = i < 3, bm = hm(balC[i % 3], { roughness: .3, flatShading: false });
    const b = new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 12), bm); b.scale.y = up ? 1.2 : .35; b.position.set(x, up ? 3.6 + huRand() * .5 : .08, z); HUG.add(b);
    if (up) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, 2.2, 3), hm(0xbbbbbb)); s.position.set(x, 2.3, z); HUG.add(s); } }
  const ban = canvasTex(1024, 128, (g, w, h) => { const L = 'HAPPY BIRTHDAY'; for (let i = 0; i < L.length; i++) { if (L[i] === ' ' || i === 9) continue; const x = 20 + i * 70; g.fillStyle = ['#7a1a2a', '#2a4a7a', '#7a6a1a'][i % 3]; g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 64, 6); g.lineTo(x + 32, 122); g.fill(); g.fillStyle = '#e8dcc8'; g.font = '48px "Lilita One", Impact'; g.textAlign = 'center'; g.fillText(L[i], x + 32, 60); } });
  const bn = huPlane(-25, 3.3, -7.75, 9.6, 1.2, new THREE.MeshStandardMaterial({ map: ban, transparent: true, side: THREE.DoubleSide, roughness: .9 })); bn.rotation.z = -.06;
  huLamp(-25, -4); huLamp(-25, 4);
}
// 🏊 THE WATER AREA
const HU_WATER = { m: null, rings: [] };
{
  const tile = canvasTex(128, 128, (g) => { g.fillStyle = '#3d6e6a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#1f3a37'; g.lineWidth = 3; for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); } for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(huRand() * 128, huRand() * 128, 10 + huRand() * 20, 6 + huRand() * 10); } }, [8, 8]);
  const tf = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 15.6), new THREE.MeshStandardMaterial({ map: tile, roughness: .35, polygonOffset: true, polygonOffsetFactor: -1 })); tf.rotation.x = -Math.PI / 2; tf.position.set(25, .01, 0); HUG.add(tf);
  // pool ring: a curb around a ring of murky green water with a tiled island in the middle
  const curbM = hm(0xc8d8d0, { roughness: .5 });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, .5, 40, 1, true), curbM); outer.position.set(25, .25, 0); outer.material.side = THREE.DoubleSide; HUG.add(outer);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(5.6, .12, 6, 40), curbM); lip.rotation.x = Math.PI / 2; lip.position.set(25, .5, 0); HUG.add(lip);
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; addCol({ t: 0, x: HUNT.x + 25 + Math.cos(a) * 5.6, y: .25, z: HUNT.z + Math.sin(a) * 5.6, hx: .14, hy: .25, hz: .9, yaw: -a, tag: 'rock' }); }
  const isl = huCyl(25, .3, 0, 1.8, .6, curbM, { seg: 24 });
  const wt = canvasTex(128, 128, (g) => { g.fillStyle = '#123a24'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(120,220,140,${.08 + huRand() * .12})`; g.lineWidth = 2; g.beginPath(); const y = huRand() * 128; g.moveTo(0, y); g.bezierCurveTo(40, y - 10, 80, y + 10, 128, y); g.stroke(); } }, [3, 3]);
  const wm = new THREE.MeshStandardMaterial({ map: wt, color: 0x6fae84, roughness: .15, metalness: .2, transparent: true, opacity: .88, emissive: 0x0a2a14 });
  const water = new THREE.Mesh(new THREE.RingGeometry(1.8, 5.55, 48, 1), wm); water.rotation.x = -Math.PI / 2; water.position.set(25, .38, 0); HUG.add(water); HU_WATER.m = wm;
  const fig = new THREE.Mesh(new THREE.CylinderGeometry(.25, .35, 1.6, 10), curbM); fig.position.set(25, 1.4, 0); HUG.add(fig);
  const fb = new THREE.Mesh(new THREE.SphereGeometry(.4, 12, 10), hm(0x3fbfae)); fb.position.set(25, 2.45, 0); HUG.add(fb);
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), hm(0x3fbfae)); e.position.set(25 + s * .28, 2.8, 0); HUG.add(e); });
  // floating rings
  [[0x9a2020, 3.8, 1], [0xd8d8d0, -3.6, 2.2]].forEach(([c, a, ph]) => { const r = new THREE.Mesh(new THREE.TorusGeometry(.42, .13, 8, 18), hm(c, { flatShading: false })); r.rotation.x = Math.PI / 2; HUG.add(r); HU_WATER.rings.push({ r, a, ph }); });
  // the water slide: a tower and a twisty chute down into the pool
  huBox(30.5, 1.75, -5.5, 2, 3.5, 2, hm(0x335a6a));
  const ladder = []; for (let i = 0; i < 9; i++) { const y = .3 + i * .36, rung = huBox(29.4, y, -5.5, .05, .05, .8, HUM.metal, { solid: false }); HOLDS.push({ m: rung, p: hL(29.42, y, -5.5), r: .06, n: V(-1, 0, 0) }); }
  const pts = []; for (let i = 0; i <= 24; i++) { const k = i / 24, a = k * Math.PI * 1.3; pts.push(V(30.5 - Math.sin(a) * 2.6 * k, 3.55 - k * 3.05, -5.5 + (1 - Math.cos(a)) * 2.2 * k + k * 1.2)); }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .45, 10, false), hm(0x3fb0c8, { side: THREE.DoubleSide, roughness: .3, flatShading: false })); HUG.add(tube);
  const buoy = new THREE.Mesh(new THREE.TorusGeometry(.35, .1, 8, 18), hm(0xd02020)); buoy.position.set(32.75, 2, 3); buoy.rotation.y = Math.PI / 2; HUG.add(buoy);
  huLamp(21, -4); huLamp(29, 4);
}
// 📦 STORAGE
{
  const shelf = (x, z, yaw) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; HUG.add(g);
    [[-1.2, -.3], [1.2, -.3], [-1.2, .3], [1.2, .3]].forEach(([a, b]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.6, .06), HUM.rust); p.position.set(a, 1.3, b); g.add(p); });
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.5, .05, .7), HUM.metal); s.position.y = .25 + k * .72; g.add(s);
      for (let j = 0; j < 3; j++) if (huRand() < .75) { const w = .3 + huRand() * .4, h = .2 + huRand() * .35, b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .45), hm([0x8a6a44, 0x6a5a3a, 0x5a3a2a][j])); b.position.set(-.8 + j * .8 + (huRand() - .5) * .2, .28 + k * .72 + h / 2, 0); b.rotation.y = (huRand() - .5) * .3; g.add(b); } }
    addCol({ t: 0, x: HUNT.x + x, y: 1.3, z: HUNT.z + z, hx: 1.25, hy: 1.3, hz: .36, yaw, tag: 'wood' }); };
  shelf(-29.4, 22, Math.PI / 2); shelf(-29.4, 25.5, Math.PI / 2); shelf(-21, 27.4, 0); shelf(-18.6, 15, Math.PI / 2);
  const crate = hm(0x7a5a34); [[-24, 22, 0], [-23, 22.1, 0], [-23.5, 22.05, 1], [-21, 17, 0], [-26, 15, 0], [-26, 15, 1]].forEach(([x, z, lv]) => { huBox(x, .5 + lv, z, 1, 1, 1, crate, { yaw: (huRand() - .5) * .3 });
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.02, .1, 1.02), HUM.wood); st.position.set(x, .5 + lv, z); HUG.add(st); });
  [[-19, 24], [-18.6, 25.2], [-29.6, 13.2]].forEach(([x, z]) => { huCyl(x, .5, z, .35, 1, hm(0x2a4a3a, { metalness: .3 }), { seg: 12 }); const rim = new THREE.Mesh(new THREE.TorusGeometry(.35, .03, 6, 14), HUM.metal); rim.rotation.x = Math.PI / 2; rim.position.set(x, .7, z); HUG.add(rim); });
  // the vent grate (you can crawl right through it 🤫)
  const gr = new THREE.Group(); gr.position.set(-30.78, .45, 16); HUG.add(gr);
  for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(.03, .9, .04), HUM.metal); s.position.z = -.5 + k * .2; gr.add(s); } const fr = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, 1.15), HUM.metal); fr.position.y = .44; gr.add(fr);
  huLamp(-24, 20);
}
// ❌ THE RED PATH + TRAP ROOM, and 🏁 THE GAUNTLET
const HU_GATE = { g: null, col: null, y: 0 }, HU_TRAP = { light: null };
{
  const pm = new THREE.MeshStandardMaterial({ color: 0x7a0a10, emissive: 0x3a0005, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2 });
  huPlane(19.5, .02, 0, 13, 1.1, pm, -Math.PI / 2, 0).rotation.z = Math.PI / 2;
  huPlane(25, .02, -26, 1.1, 36, pm, -Math.PI / 2, 0);
  const xm = new THREE.MeshStandardMaterial({ color: 0xc0101a, emissive: 0x600008, roughness: .5, polygonOffset: true, polygonOffsetFactor: -3 });
  [Math.PI / 4, -Math.PI / 4].forEach(r => { const x = huPlane(25, .025, -46, 7, 1.2, xm, -Math.PI / 2, 0); x.rotation.z = r; });
  const spike = new THREE.InstancedMesh(new THREE.ConeGeometry(.08, .55, 6).rotateX(Math.PI / 2), hm(0x6a6e70, { metalness: .7, roughness: .4 }), 64), m4 = new THREE.Matrix4(); let n = 0;
  for (let i = 0; i < 16; i++) for (const [x, z, ry] of [[19.2, -51 + i * .6, -Math.PI / 2], [30.8, -51 + i * .6, Math.PI / 2]]) { if (n >= 64) break; _huQ.setFromEuler(new THREE.Euler(0, ry, 0)); m4.compose(V(x, .6 + (i % 3) * 1.1, z), _huQ, V(1, 1, 1)); spike.setMatrixAt(n++, m4); }
  for (let i = 0; i < 16 && n < 64; i++) { _huQ.setFromEuler(new THREE.Euler(0, Math.PI, 0)); m4.compose(V(19.8 + i * .7, .6 + (i % 3) * 1.1, -51.8), _huQ, V(1, 1, 1)); spike.setMatrixAt(n++, m4); }
  spike.count = n; HUG.add(spike);
  const cage = new THREE.Group(); cage.position.set(25, 2.6, -44); HUG.add(cage); HU_TRAP.cage = cage;
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, b = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.5, 4), HUM.rust); b.position.set(Math.cos(a) * .5, 0, Math.sin(a) * .5); cage.add(b); }
  [-.75, .75].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(.5, .03, 6, 18), HUM.rust); r.rotation.x = Math.PI / 2; r.position.y = y; cage.add(r); });
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.2, 4), HUM.rust); ch.position.y = 1.35; cage.add(ch);
  const wr = canvasTex(1024, 256, (g, w, h) => { g.font = '120px "Lilita One", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(150,0,10,.9)'; g.fillText('NO WAY OUT', w / 2, h / 2); for (let i = 0; i < 30; i++) g.fillRect(120 + huRand() * 780, 150 + huRand() * 20, 4, 20 + huRand() * 80); });
  huPlane(25, 2.6, -51.75, 6, 1.5, new THREE.MeshBasicMaterial({ map: wr, transparent: true }));
  const tl = new THREE.PointLight(0xff1020, 0, 12, 1.5); tl.position.set(25, 3.6, -46); HUG.add(tl); HU_TRAP.light = tl;
  // gauntlet: start line, gate, hurdles, crate zig-zag, climbing block
  const ln = huPlane(0, .02, 58.4, 6, .3, new THREE.MeshBasicMaterial({ color: 0xffffff }), -Math.PI / 2, 0); ln.material.color.set(0x8a8a8a);
  const gate = new THREE.Group(); gate.position.set(0, 0, 56); HUG.add(gate); HU_GATE.g = gate;
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 3, 6), HUM.rust); b.position.set(-2.6 + i * .65, 1.5, 0); gate.add(b); }
  [.4, 2.8].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(6, .1, .08), HUM.rust); b.position.y = y; gate.add(b); });
  HU_GATE.col = addCol({ t: 0, x: HUNT.x, y: 1.6, z: HUNT.z + 56, hx: 3, hy: 1.6, hz: .12, tag: 'rock' });
  const stripe = canvasTex(64, 8, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#e8e8e8' : '#c01020'; g.fillRect(i * 8, 0, 8, 8); } }, [4, 1]);
  HU_HURDLES.forEach(z => { const b = new THREE.Mesh(new THREE.BoxGeometry(6, .12, .12), new THREE.MeshStandardMaterial({ map: stripe, roughness: .6 })); b.position.set(0, .55, z); HUG.add(b);
    [-2.85, 0, 2.85].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(.08, .55, .3), HUM.dark); p.position.set(x, .27, z); HUG.add(p); });
    addCol({ t: 0, x: HUNT.x, y: .5, z: HUNT.z + z, hx: 3, hy: .1, hz: .08, tag: 'wood' }); });
  huBox(-1.5, .5, 37, 3, 1, 2, hm(0x6a4a2a), { shadow: true }); huBox(1.5, .5, 34, 3, 1, 2, hm(0x6a4a2a), { shadow: true });
  [[-1.5, 37], [1.5, 34]].forEach(([x, z]) => { const s = new THREE.Mesh(new THREE.BoxGeometry(3.02, .08, 2.02), HUM.wood); s.position.set(x, .5, z); HUG.add(s); const s2 = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.02, 2.02), HUM.wood); s2.position.set(x, .5, z); HUG.add(s2); });
  // the climbing block: 3.2 m, colorful holds on its face (VR: grab them; PC: hold W into it)
  const cw = huBox(0, 1.6, 25.45, 6, 3.2, 3.9, new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g) => { g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#323642'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) g.fillRect(i * 32, j * 32, 32, 32); }, [4, 2]), roughness: .8 }), { tag: 'rock' });
  const hc = [0xff4f6d, 0xffd25a, 0x3fe0bd, 0x8b6bff, 0xff8a3d];
  for (let i = 0; i < 26; i++) { const r = .09 + huRand() * .05, x = -2.6 + huRand() * 5.2, y = .35 + (i / 26) * 2.7, hmh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), hm(hc[i % 5])); hmh.position.set(x, y, 27.42); HUG.add(hmh); HOLDS.push({ m: hmh, p: hL(x, y, 27.42), r, n: V(0, 0, 1) }); }
  const arrow = canvasTex(256, 128, (g) => { g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(128, 10); g.lineTo(230, 80); g.lineTo(170, 80); g.lineTo(170, 120); g.lineTo(86, 120); g.lineTo(86, 80); g.lineTo(26, 80); g.closePath(); g.fill(); g.fillStyle = '#1a1a1a'; g.font = '30px "Lilita One"'; g.textAlign = 'center'; g.fillText('CLIMB!', 128, 106); });
  huPlane(0, 3.9, 27.3, 1.3, .65, new THREE.MeshBasicMaterial({ map: arrow, transparent: true }));
  huLamp(0, 52); huLamp(0, 40); huLamp(0, 30); huLamp(0, 18);
}
// purple glowing door frames (merged) + every wall (merged, world-projected wallpaper)
{
  for (const d of HU_DOORS.values()) {
    const add = (w, h, dp, x, y, z) => { const g = new THREE.BoxGeometry(w, h, dp); if (d.yaw) g.rotateY(d.yaw); g.translate(d.x + (d.yaw ? z : x), y, d.z + (d.yaw ? x : z)); HU_FRAMES.push(g); };
    add(.12, 3.1, .5, -d.w / 2 - .02, 1.55, 0); add(.12, 3.1, .5, d.w / 2 + .02, 1.55, 0); add(d.w + .28, .12, .5, 0, 3.06, 0);
    const gl = huGlow(0xb04bff, 3.2, .18); gl.position.set(d.x, 1.6, d.z); HUG.add(gl);
  }
  const fr = new THREE.Mesh(mergeGeometries(HU_FRAMES), HUM.purple); HUG.add(fr);
  const wg = mergeGeometries(HU_WALLS), p = wg.attributes.position, nr = wg.attributes.normal, uv = wg.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = Math.abs(nr.getX(i)), ny = Math.abs(nr.getY(i));
    if (ny > .5) uv.setXY(i, x / 2, z / 2); else uv.setXY(i, (nx > .5 ? z : x) / 2, y / HU_WALL_H); }
  const wm = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ map: HU_WALL_T, roughness: .9 })); wm.receiveShadow = true; HUG.add(wm);
}
// green fog wisps drifting over the floor
const HU_FOG = [];
{
  const fogT = canvasTex(128, 128, (g) => { for (let i = 0; i < 14; i++) { const x = 20 + huRand() * 88, y = 30 + huRand() * 68, r = 18 + huRand() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } });
  const spots = [[0, 0], [-6, -8], [7, 8], [0, -26], [-25, 0], [25, 0], [-24, 20], [25, -46], [0, 45], [0, 30], [-25, -20], [25, -20]];
  spots.forEach(([x, z], i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogT, color: 0x4fd07a, transparent: true, opacity: .22, depthWrite: false })); s.scale.set(7, 2.2, 1); s.position.set(x, .6, z); HUG.add(s); HU_FOG.push({ s, x, z, ph: i }); });
}

/* ---------- 🩸 THE RED ARTIFACT ---------- */
const HREL = (() => {
  const g = new THREE.Group(); HUG.add(g);
  const stone = hm(0x2a2423); part(new THREE.CylinderGeometry(.5, .66, .75, 8), stone, 0, .375, 0, g); part(new THREE.CylinderGeometry(.58, .58, .08, 8), hm(0x170f0f), 0, .78, 0, g);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = part(new THREE.BoxGeometry(.05, .4, .02), HUM.redGlow, Math.cos(a) * .6, .4, Math.sin(a) * .6, g); r.rotation.y = -a + Math.PI / 2; r.rotation.z = (i % 2 ? .3 : -.3); }
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), HUM.blood); pool.rotation.x = -Math.PI / 2; pool.position.y = .02; pool.scale.y = .8; g.add(pool);
  addCol({ t: 1, x: HUNT.x, z: HUNT.z, cy: .4, hy: .4, r: .64, tag: 'rock' });
  const relic = new THREE.Group(); relic.position.y = 1.08; g.add(relic);
  const rm = new THREE.MeshStandardMaterial({ color: 0xff1a2a, emissive: 0xff0a1a, emissiveIntensity: .7, roughness: .2, metalness: .3 }), bm = new THREE.MeshStandardMaterial({ color: 0x1a0003, roughness: .25, metalness: .5 });
  const top = new THREE.Mesh(new THREE.ConeGeometry(.12, .19, 4), rm); top.position.y = .095; relic.add(top);
  const bot = new THREE.Mesh(new THREE.ConeGeometry(.12, .19, 4).rotateX(Math.PI), bm); bot.position.y = -.095; relic.add(bot);
  const ring = new THREE.Group(); relic.add(ring);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(.024, 10, 8), i % 2 ? rm : bm); b.position.set(Math.cos(a) * .19, 0, Math.sin(a) * .19); ring.add(b); }
  const halo = huGlow(0xff1a2a, .9, .55); relic.add(halo);
  const light = new THREE.PointLight(0xff2030, 2.2, 10, 1.6); light.position.y = 1.5; g.add(light);
  const lab = sprite('🩸 THE RED ARTIFACT', 2.2, '#ff3040', 50); lab.position.y = 2.25; g.add(lab);
  return { g, relic, ring, halo, light, lab, rm };
})();
function huRelicHome() { HREL.relic.visible = true; HUG.add(HREL.relic); HREL.relic.position.set(0, 1.08, 0); HREL.relic.scale.setScalar(1); HU.relicH = null; HREL.lab.visible = true; }

/* ---------- 🤫 secrets (4) ---------- */
const HU_SEC = [];
{
  const mk = (id, x, y, z, build) => { const g = new THREE.Group(); g.position.set(x, y, z); HUG.add(g); build(g); const gl = huGlow(0xffe08a, .5, .5); g.add(gl); HU_SEC.push({ id, g, p: hL(x, y, z), gl }); if (HU.secrets.has(id)) g.visible = false; };
  mk('reel', 7.4, .95, -37.6, g => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .05, 16), hm(0x8a8a90, { metalness: .8, roughness: .3 })); r.rotation.x = Math.PI / 2; g.add(r); for (let i = 0; i < 5; i++) { const h = new THREE.Mesh(new THREE.CircleGeometry(.04, 8), HUM.dark); const a = i / 5 * 7; h.position.set(Math.cos(a) * .11, Math.sin(a) * .11, .03); g.add(h); } });
  mk('vent', -36.2, .2, 16, g => { const e = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), hm(0x3fbfae)); e.scale.set(1, 1.2, .5); g.add(e); const s = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), hm(0xeeeeee)); s.position.set(0, -.08, .02); g.add(s); });
  mk('tooth', -7.2, .12, -6.3, g => { const t = new THREE.Mesh(new THREE.ConeGeometry(.04, .14, 6), hm(0xf4f0e0, { roughness: .3 })); t.rotation.z = Math.PI; g.add(t); });
  mk('x', 25, 1.2, -46, g => { const s = new THREE.Mesh(new THREE.OctahedronGeometry(.12), new THREE.MeshBasicMaterial({ color: 0xff2030 })); g.add(s); }); HU_SEC[3].g.visible = false;   // appears only after standing on the X
}
function huSecretFound(o) {
  if (HU.secrets.has(o.id)) return; HU.secrets.add(o.id); store.set('kg-husec', [...HU.secrets].join(','));
  o.g.visible = false; confetti(o.p.clone(), 60, [0xffe08a, 0xff3040, 0xb04bff]); sfxChoir(); hands.forEach(h => buzz(h, .8, 120));
  toast(`🤫 SECRET FOUND! (${HU.secrets.size} / ${HU_SEC.length} in THE HUNT)`, 4);
}

/* ======================= 🕳️ THE LOBBY HOLE ======================= */
const HOLE_A = HUNT_HOLE_A, HOLE = V(Math.cos(HOLE_A) * 30.2, 0, Math.sin(HOLE_A) * 30.2);
const HOLE_G = (() => {
  const g = new THREE.Group(); g.position.copy(HOLE); g.rotation.y = Math.atan2(-HOLE.x, -HOLE.z); scene.add(g);   // +z faces the middle of the grove
  const tg = new THREE.CylinderGeometry(3, 3.4, 7, 32, 6, true); tg.rotateX(Math.PI / 2); tg.translate(0, 3, -3.5);
  const col = new Float32Array(tg.attributes.position.count * 3); for (let i = 0; i < tg.attributes.position.count; i++) { const z = tg.attributes.position.getZ(i), k = Math.max(0, 1 + z / 7); col.set([.9 * k * k + .04, .02 * k, .04 * k], i * 3); }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const tun = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })); g.add(tun);
  const back = new THREE.Mesh(new THREE.CircleGeometry(3.5, 24), new THREE.MeshBasicMaterial({ color: 0x050000, fog: false })); back.position.set(0, 3, -7); g.add(back);
  const core = huGlow(0xff1020, 6, .7); core.position.set(0, 3, -5.5); g.add(core);
  // the mouth: painted as a deep pit (the cliff hides the real tunnel behind it): black middle, glowing red edge
  const mt = canvasTex(256, 256, (q) => { const gr = q.createRadialGradient(128, 128, 4, 128, 128, 128); gr.addColorStop(0, '#000'); gr.addColorStop(.45, '#070001'); gr.addColorStop(.72, '#3a0006'); gr.addColorStop(.9, '#c0101e'); gr.addColorStop(1, '#ff3a3a'); q.fillStyle = gr; q.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) { const a = Math.random() * 7, r = 70 + Math.random() * 50; q.fillStyle = `rgba(255,${40 + Math.random() * 60 | 0},40,${Math.random() * .5})`; q.beginPath(); q.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1 + Math.random() * 3, 0, 7); q.fill(); } });
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(3.05, 40), new THREE.MeshBasicMaterial({ map: mt, fog: false })); mouth.position.set(0, 3, .03); g.add(mouth);
  const eyes = [-1, 1].map(s => { const e = huGlow(0xff1010, .5, 0); e.position.set(s * .35, 3.2, .1); g.add(e); return e; });   // 👁️👁️ sometimes
  const rimG = jitterGeo(new THREE.TorusGeometry(3.15, .5, 7, 30), .18, 3); paint(rimG, (c, x, y) => { const cr = Math.abs(Math.sin(x * 4.3 + y * 2.1)) < .12; c.setHSL(cr ? 0 : .06, cr ? .9 : .15, cr ? .45 : .2 + hsh(x, y, 0, 2) * .05); });
  const rim = new THREE.Mesh(rimG, vcMat); rim.position.set(0, 3, .05); g.add(rim);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + .2, L = 1 + Math.random() * 1.8, cr = new THREE.Mesh(new THREE.BoxGeometry(.08, L, .04), new THREE.MeshBasicMaterial({ color: 0xff2030 })); cr.position.set(Math.cos(a) * (3.7 + L / 2), 3 + Math.sin(a) * (3.7 + L / 2), .3); cr.rotation.z = a - Math.PI / 2; g.add(cr); }
  for (let i = 0; i < 7; i++) { const x = -2.4 + i * .8, L = .4 + Math.random() * .9, d = new THREE.Mesh(new THREE.BoxGeometry(.07, L, .05), new THREE.MeshBasicMaterial({ color: 0x8a0010 })); const y = 3 + Math.sqrt(Math.max(0, 9.6 - x * x)) - L / 2 - .25; if (y < 3.3) continue; d.position.set(x, y, .45); g.add(d); }
  const bm = new THREE.MeshBasicMaterial({ color: 0xff1020, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(2.6 + i, 9, 20, 1, true), bm); b.rotation.x = -Math.PI / 2 + .25; b.position.set((i - 1) * 1.4, 2.2, 4.2); g.add(b); }
  const glowFloor = new THREE.Mesh(new THREE.CircleGeometry(5, 24), new THREE.MeshBasicMaterial({ color: 0xff1020, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); glowFloor.rotation.x = -Math.PI / 2; glowFloor.position.set(0, .03, 3); g.add(glowFloor);
  const light = new THREE.PointLight(0xff1020, 3, 16, 1.4); light.position.set(0, 2.5, 2); g.add(light);
  const embers = []; for (let i = 0; i < 26; i++) { const e = huGlow(0xff3a20, .25, .9); g.add(e); embers.push({ e, t: Math.random() * 4 }); }
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 320; const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.875), new THREE.MeshBasicMaterial({ map: st, transparent: true, fog: false })); sign.position.set(0, 7.6, .6); g.add(sign);
  // two pedestals in front: VOTE and TEST ALONE
  const ped = (x, lab1, lab2, c) => { const pg = new THREE.Group(); pg.position.set(x, 0, 4.2); g.add(pg);
    part(new THREE.CylinderGeometry(.16, .2, .9, 20), smat(0x2b2030, { roughness: .5 }), 0, .45, 0, pg);
    const cap = part(new THREE.SphereGeometry(.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), smat(c, { emissive: c, emissiveIntensity: .6, roughness: .3 }), 0, .9, 0, pg); cap.scale.y = .5;
    const t = labelTex(512, 160, (q, w, h) => signText(q, w, h, [[lab1, 50, '#ffffff', 64], [lab2, 34, '#ffd0d0', 122]], 'rgba(20,6,10,.95)', '#' + new THREE.Color(c).getHexString()));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(.66, .21), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide })); s.position.set(0, 1.25, 0); pg.add(s);
    g.updateMatrixWorld(true); const wp = pg.getWorldPosition(V()); addCol({ t: 1, x: wp.x, z: wp.z, cy: .45, hy: .45, r: .2, tag: 'rock' });
    return { cap, top: V(wp.x, .96, wp.z), in: [false, false], p: wp }; };
  const vote = ped(-2.2, '🗳️ VOTE: HUNT', 'or walk into the hole', 0xff2030), test = ped(2.2, '🧪 TEST ALONE', 'no vote needed', 0xb04bff);
  return { g, light, core, embers, sc, st, sign, vote, test, rim, eyes };
})();
function huHoleSign() {
  const c = HOLE_G.sc, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(14,2,4,.9)'; g.beginPath(); g.roundRect(8, 8, c.width - 16, c.height - 16, 40); g.fill(); g.lineWidth = 10; g.strokeStyle = '#ff2030'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '110px "Lilita One", Impact, sans-serif'; g.fillStyle = '#ff3a3a'; g.fillText('🩸 THE HUNT 🩸', c.width / 2, 110);
  const v = huVoteInfo(); g.font = '52px "Lilita One", Impact, sans-serif'; g.fillStyle = '#fff';
  g.fillText(online() ? `votes: ${v.yes} / ${v.n}  (need ${v.need})` : 'walk in to start!', c.width / 2, 230); HOLE_G.st.needsUpdate = true;
}
function huVoteInfo() { const ids = mdPeople(), n = ids.length, need = Math.max(1, Math.ceil(n * .75)); let yes = 0; for (const id of ids) { const t = HU.votes.get(id); if (t && tAll - t < 60) yes++; } return { n, need, yes }; }

/* ======================= DOM: buttons, HUD, cutscene overlays ======================= */
{
  const st = document.createElement('style');
  st.textContent = `.huBtn{position:fixed;right:12px;z-index:20;width:52px;height:52px;border-radius:50%;border:0;font-size:25px;cursor:pointer;display:none}
  #huHud{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:40;display:none;font:700 18px Fredoka,system-ui,sans-serif;color:#fff;text-align:center;pointer-events:none;text-shadow:0 2px 0 rgba(0,0,0,.6);background:rgba(30,0,6,.6);padding:6px 16px;border-radius:14px;border:2px solid #ff3040}
  #huTitle{position:fixed;inset:0;z-index:46;pointer-events:none;display:none;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:15vh;box-sizing:border-box;text-align:center;font-family:"Lilita One",Impact,sans-serif}
  #huTitle b{font-size:min(9vw,76px);color:#ff2030;letter-spacing:4px;text-shadow:0 6px 0 #000,0 0 40px rgba(255,0,30,.8);transform:scale(1.6);opacity:0;transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .2s}
  #huTitle i{font-style:normal;font-size:min(5vw,30px);color:#e8d8d8;text-shadow:0 3px 0 #000;margin-top:8px;opacity:0;transition:opacity .6s .35s}#huTitle.on b{transform:scale(1);opacity:1}#huTitle.on i{opacity:1}
  #huSplat,#huFade{position:fixed;inset:0;z-index:44;pointer-events:none;display:none}#huFade{background:#000;opacity:0}
  #huVig{position:fixed;inset:0;z-index:28;pointer-events:none;display:none;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 50%,rgba(140,0,20,.55))}
  #huSkip{position:fixed;right:16px;bottom:16px;z-index:47;display:none;border:0;border-radius:12px;padding:8px 14px;font:700 16px Fredoka,system-ui;background:rgba(255,255,255,.85);cursor:pointer}`;
  document.head.appendChild(st);
  const mkB = (id, txt, title, bottom, bg, sh, fn) => { const b = document.createElement('button'); b.id = id; b.className = 'huBtn'; b.textContent = txt; b.title = title; b.style.bottom = bottom + 'px'; b.style.background = bg; b.style.boxShadow = `0 4px 0 ${sh}`; b.onclick = fn; document.body.appendChild(b); return b; };
  mkB('huVoteBtn', '🩸', 'THE HUNT: vote', 150, '#ff2030', '#7a0010', () => huVote());
  mkB('huTestBtn', '🧪', 'THE HUNT: test alone', 90, '#b04bff', '#5a2090', () => huEnter('test'));
  mkB('huAgainBtn', '🔁', 'Race again', 210, '#ff8a3d', '#a04a10', () => huAgain(true));
  mkB('huTourBtn', '🗺️', 'Map tour', 150, '#3fb2ff', '#1a5a90', () => huTourStart());
  mkB('huLeaveBtn', '🚪', 'Back to the lobby', 90, '#5a6a72', '#2a3236', () => huLeave());
  const d = (id) => { const e = document.createElement('div'); e.id = id; document.body.appendChild(e); return e; };
  d('huHud'); d('huVig'); d('huFade'); const t = d('huTitle'); t.innerHTML = '<b></b><i></i>';
  const sp = document.createElement('canvas'); sp.id = 'huSplat'; document.body.appendChild(sp);
  const sk = document.createElement('button'); sk.id = 'huSkip'; sk.textContent = 'Skip ⏭ (Esc)'; sk.onclick = () => huSkip(); document.body.appendChild(sk);
  addEventListener('keydown', e => { if (e.code === 'Escape' && (HU.cs || HU.tour)) { e.preventDefault(); e.stopImmediatePropagation(); huSkip(); } }, true);
}
function huHud(txt) { const h = $('huHud'); h.style.display = txt ? 'block' : 'none'; if (txt) h.textContent = txt; }
function huTitle(big, small) { const t = $('huTitle'); if (!big) { t.classList.remove('on'); setTimeout(() => { if (!t.classList.contains('on')) t.style.display = 'none'; }, 400); return; }
  t.querySelector('b').textContent = big; t.querySelector('i').textContent = small || ''; t.style.display = 'flex'; requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('on'))); if (state.xr) showVrToast(big + (small ? '\n' + small : ''), 3); }
function huDomBtns() {
  const pc = state.mode === 'play' && !state.xr, inG = pc && state.area === 'grove', inH = pc && state.area === 'hunt' && !HU.cs && !HU.tour;
  $('huVoteBtn').style.display = inG ? 'block' : 'none'; $('huTestBtn').style.display = inG ? 'block' : 'none';
  $('huAgainBtn').style.display = inH ? 'block' : 'none'; $('huTourBtn').style.display = inH ? 'block' : 'none'; $('huLeaveBtn').style.display = inH ? 'block' : 'none';
  $('huSkip').style.display = pc && (HU.cs || HU.tour) ? 'block' : 'none';
}

/* ======================= vote, enter, leave ======================= */
function huVote() {
  if (HU.phase !== 'off' || state.area !== 'grove') return;
  if (!online()) { huEnter('vote'); return; }   // alone = 1 of 1 = 100%
  HU.votes.set(brMe(), tAll); netSend({ t: 'hu', e: 'vote' }); huHoleSign();
  const v = huVoteInfo(); toast(`🩸 You voted for THE HUNT! ${v.yes} / ${v.n} (need ${v.need} = 75%)`, 4); if (ac) tone('sawtooth', 110, 55, .5, .1);
  huVoteCheck();
}
function huVoteCheck() {
  if (online() && !MP.host) return;
  const v = huVoteInfo(); if (v.yes < v.need) return;
  HU.votes.clear(); const d = { t: 'hu', e: 'go' }; netSend(d); huNet(Object.assign({}, d, { from: brMe() }));
}
function huNet(d) {
  if (d.e === 'vote') { HU.votes.set(d.from, tAll); huHoleSign(); const f = MP.others.get(d.from); if (state.area === 'grove') toast(`🩸 ${f ? f.name : 'Someone'} voted for THE HUNT! (${huVoteInfo().yes} / ${huVoteInfo().n})`, 3.5); huVoteCheck(); }
  else if (d.e === 'go') { HU.votes.clear(); huHoleSign(); if (HU.phase === 'off' || HU.mode === 'vote') huEnter('vote', true); }
  else if (d.e === 'win') { if (HU.mode !== 'vote' || state.area !== 'hunt' || HU.phase === 'cs' || HU.phase === 'after') return; const f = MP.others.get(d.from); huWin({ id: d.from, name: d.name || (f ? f.name : 'Someone'), col: f ? f.color : 0x3fbfae, paw: f ? f.pawC : 0x3fbfae, remote: f }); }
  else if (d.e === 'again') { if (HU.mode === 'vote' && state.area === 'hunt') huAgain(false); }
}
function huSaveLook(on) {
  const sky = scene.userData.sky;
  if (on) {
    if (HU.saved) return;
    HU.saved = { bg: scene.background.clone(), fog: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far, hi: hemi.intensity, hc: hemi.color.clone(), hg: hemi.groundColor.clone(), sun: sun.intensity, sky: sky.visible };
    scene.background.set(0x030605); scene.fog.color.set(0x07140c); scene.fog.near = 4; scene.fog.far = 36; hemi.intensity = 1.5; hemi.color.set(0x9fcfaf); hemi.groundColor.set(0x1a0c0c); sun.intensity = .12; sky.visible = false;
  } else if (HU.saved) {
    const S = HU.saved; scene.background.copy(S.bg); scene.fog.color.copy(S.fog); scene.fog.near = S.near; scene.fog.far = S.far; hemi.intensity = S.hi; hemi.color.copy(S.hc); hemi.groundColor.copy(S.hg); sun.intensity = S.sun; sky.visible = S.sky; HU.saved = null;
  }
}
function huAmb(on) {
  if (!ac) return;
  if (on && !HU.amb) { const g = ac.createGain(), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; g.gain.value = 0; f.connect(g); g.connect(master);
    const o = [55, 55.7, 82.4].map(fr => { const x = ac.createOscillator(); x.type = 'sawtooth'; x.frequency.value = fr; x.connect(f); x.start(); return x; }); g.gain.setTargetAtTime(.045, ac.currentTime, 1); HU.amb = { g, o }; }
  if (!on && HU.amb) { const A = HU.amb; A.g.gain.setTargetAtTime(0, ac.currentTime, .3); setTimeout(() => A.o.forEach(x => { try { x.stop(); } catch (e) { } }), 1500); HU.amb = null; }
}
function huFaceVR(yaw) {   // VR: turn the rig around your head so you look along yaw
  if (!state.xr) { state.yaw = yaw; return; }
  camera.getWorldDirection(_hu1); const cur = Math.atan2(-_hu1.x, -_hu1.z); headWorld(_hu2); rig.rotation.y += yaw - cur; rig.updateMatrixWorld(true); headWorld(_hu3); rig.position.x += _hu2.x - _hu3.x; rig.position.z += _hu2.z - _hu3.z;
}
function huEnter(mode, fromNet) {
  if (HU.cs || HU.tour) return;
  if (state.area === 'arena') travel(false);
  HU.mode = mode; huMonsterOff(); huClearMons();
  arrive(hL(0, 0, HU_START_Z), 0, 'hunt'); huFaceVR(0);
  huSaveLook(true); huAmb(true);
  toast(mode === 'test' ? '🧪 TEST MODE: just you and 3 race bots. No vote needed!' : '🩸 THE HUNT is starting! Race to the RED Artifact!', 5);
  huResetRace();
  if (!HU.toured) { HU.toured = true; huTourStart(); } else huCountdown();
}
function huLeave() {
  if (HU.cs) return; huTourEnd(true);
  HU.phase = 'off'; huClearBots(); huClearMons(); huMonsterOff(); huHud(''); huTitle('');
  HOLE_G.g.updateMatrixWorld(true); const p = HOLE_G.g.localToWorld(V(0, 0, 6));
  arrive(p, Math.atan2(HOLE.x, HOLE.z), 'grove'); huFaceVR(Math.atan2(HOLE.x, HOLE.z));
  toast('🌳 Back in the lobby. (Something followed you out... just kidding. Probably.)', 4);
}
function huRespawn() { arrive(hL(0, 0, HU_START_Z), 0, 'hunt'); }

/* ======================= 🏁 THE RACE ======================= */
function huClearBots() { HU.bots.forEach(b => scene.remove(b.f.g)); HU.bots.length = 0; }
function huMakeBots() {
  huClearBots(); if (online() && HU.mode === 'vote') return;
  [-2.1, -1, 2.1].forEach((x, i) => { const col = MP_COLORS[(i + 1) % MP_COLORS.length], f = makeFriend(col, col, ['Bonk-bot', 'Noodle-bot', 'Mochi-bot'][i]);
    HU.bots.push({ f, x, lane: x, z: HU_START_Z, y: 0, vy: 0, sp: 3.6 + Math.random() * .6, st: 'run', name: f.name, col, done: false }); });
}
function huResetRace() {
  huRelicHome(); HU.winner = null; HU.phase = 'ready'; HU.raceT = 0; HU.toldGrab = false;
  HU_GATE.g.position.y = 0; Object.assign(HU_GATE.col, { y: 1.6, miny: 0, maxy: 3.2 });
  huMakeBots(); huClearSplats();
}
function huCountdown() { HU.phase = 'count'; HU.cd = 3.99; HU.lastCd = 4; }
function huAgain(send) {
  if (HU.cs || HU.tour || state.area !== 'hunt') return;
  if (send && HU.mode === 'vote' && online()) netSend({ t: 'hu', e: 'again' });
  huMonsterOff(); huClearMons(); huResetRace(); huTitle(''); arrive(hL(0, 0, HU_START_Z), 0, 'hunt'); huFaceVR(0); huCountdown();
}
function huProgress(z, y) { return HU_START_Z - z + (z < 27.5 && z > 23.4 ? y : 0); }
function stepRace(dt) {
  headWorld(_hu1); const lz = _hu1.z - HUNT.z, lx = _hu1.x - HUNT.x;
  if (HU.phase === 'count') {
    // keep everyone behind the gate
    if (lz < 56.6) { rig.position.z += 56.6 - lz; state.vel.z = Math.max(0, state.vel.z); }
    const prev = Math.ceil(HU.cd); HU.cd -= dt; const now = Math.ceil(HU.cd);
    if (now !== prev && now > 0) { brBig(String(now), .9); if (ac) tone('square', 440, 440, .15, .1); hands.forEach(h => buzz(h, .5, 60)); }
    if (HU.cd <= 0) { HU.phase = 'race'; HU.raceT = 0; brBig('🩸 GO!', 1.2); setTimeout(() => { if ($('brBig').textContent.includes('GO')) brBig(''); }, 1100); if (ac) { tone('square', 880, 880, .35, .12); noiseHit(ac.currentTime, .4, .2, 'lowpass', 600, .7); } HU_GATE.open = 1; }
  }
  if (HU_GATE.open) { HU_GATE.g.position.y = Math.max(-3.1, HU_GATE.g.position.y - dt * 4); if (HU_GATE.g.position.y <= -3.1) HU_GATE.open = 0; Object.assign(HU_GATE.col, { y: -10, miny: -11.6, maxy: -8.4 }); }
  // bots
  const racing = HU.phase === 'race';
  for (const b of HU.bots) {
    if (racing && !b.done) {
      let tx = b.lane; if (b.z < 38.6 && b.z > 35.6) tx = 1.6; else if (b.z < 35.6 && b.z > 32.4) tx = -1.6; else if (b.z < 13.5) tx = b.lane * .25; else if (b.z < 32.4) tx = b.lane * .6;
      if (b.st === 'run') { b.z -= b.sp * dt; b.x += (tx - b.x) * Math.min(1, dt * 3);
        for (const hz of HU_HURDLES) if (b.y <= 0 && b.z - hz < 1 && b.z - hz > .6) b.vy = 4.2;
        if (b.z <= 27.75 && b.z > 26 && b.y < 1) { b.z = 27.75; b.st = 'climb'; } }
      else if (b.st === 'climb') { b.y += (1.05 + b.sp * .08) * dt; if (b.y >= 3.22) { b.y = 3.22; b.st = 'top'; b.z = 27.2; b.vy = 0; } }
      else if (b.st === 'top') { b.z -= b.sp * dt; if (b.z < 23.4) b.st = 'run'; }
      if (b.st !== 'climb') { b.vy -= 9.8 * dt; b.y += b.vy * dt; const fl = b.st === 'top' ? 3.22 : 0; if (b.y <= fl) { b.y = fl; b.vy = 0; } }
      if (b.z < 1.15 && Math.abs(b.x) < 1.4) { b.done = true; huWin({ bot: b, name: b.name, col: b.col, paw: b.col }); }
    }
    const P = hL(b.x, b.y, b.z), k = racing && !b.done ? 1 : .3;
    artPoseTwin(b.f, P, 0, k);
    if (b.st === 'climb' && racing) b.f.paws.forEach((p, i) => { p.position.y = P.y + (state.bodyH || .85) * .9 + Math.sin(tAll * 7 + i * Math.PI) * .25; });
  }
  if (!racing) return;
  HU.raceT += dt;
  const me = huProgress(lz, _hu1.y - (state.bodyH || .85)); let place = 1; HU.bots.forEach(b => { if (huProgress(b.z, b.y) > me) place++; });
  const nth = ['1st 🥇', '2nd 🥈', '3rd 🥉', '4th'][place - 1] || place + 'th';
  huHud(`🏁 ${fmtTime(HU.raceT)}  •  ${HU.bots.length ? nth : 'race!'}  •  get the RED Artifact!`);
  // grabbing the relic
  const rp = _hu2; HREL.relic.getWorldPosition(rp);
  if (HU.relicH) {
    const h = HU.relicH; HUG.worldToLocal(_hu3.copy(h.pos)); HREL.relic.position.copy(_hu3);
    headWorld(_hu2); camera.getWorldDirection(_hu3); _hu3.y = 0; _hu3.normalize(); _hu2.addScaledVector(_hu3, .08); _hu2.y -= .38;
    if (h.pos.distanceTo(_hu2) < .25) huMyWin();
  } else if (!state.xr && !sim.on && _hu1.distanceTo(rp) < 2.3 && !HU.toldGrab) { HU.toldGrab = true; toast(state.touch ? '🩸 Tap ✋ GRAB to take the RED Artifact!' : '🩸 Press E to take the RED Artifact!', 3); }
}
function huntGrab(h) {
  if (state.area !== 'hunt' || HU.phase !== 'race' || HU.relicH || !h.tracked) return false;
  if (h.pos.distanceTo(HREL.relic.getWorldPosition(_hu1)) > .35) return false;
  HU.relicH = h; HREL.lab.visible = false; buzz(h, 1, 120); if (ac) tone('sawtooth', 70, 40, .6, .25);
  toast('🩸 GOT IT! Pull it to your CHEST!', 3); return true;
}
function huntDrop(h) { if (HU.relicH !== h) return false; HU.relicH = null; huRelicHome(); HREL.lab.visible = false; return true; }
function huntDesk() {
  if (state.area === 'grove' && HU.phase === 'off') { headWorld(_hu1); if (_hu1.distanceTo(HOLE_G.vote.p) < 1.6) { huVote(); return true; } if (_hu1.distanceTo(HOLE_G.test.p) < 1.6) { huEnter('test'); return true; } return false; }
  if (state.area !== 'hunt') return false;
  if (HU.phase === 'race') { headWorld(_hu1); if (_hu1.distanceTo(HREL.relic.getWorldPosition(_hu2)) < 2.3) { huMyWin(); return true; } }
  return HU.phase === 'cs';
}
function huMyWin() {
  if (HU.phase !== 'race') return;
  if (HU.mode === 'vote' && online()) netSend({ t: 'hu', e: 'win', name: MP.name || 'Host' });
  huWin({ me: true, name: 'You', col: myFur() < 0 ? 0x3fbfae : myFur(), paw: myPawCol() < 0 ? 0x3fbfae : myPawCol() });
}

/* ======================= 👹 THE THUMPLING MONSTER ======================= */
const HU_MON_FUR = 0x24564f;
function huMonsterParts(f, sc = 1) {   // corrupt a Thumpling: glowing eyes, teeth, wilted sprout, torn fur, stuffing, claws, back spikes
  const add = [], eyeM = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false }), tooth = hm(0xf2ead6, { roughness: .4 }), dark = hm(0x0a0606), wound = new THREE.MeshStandardMaterial({ color: 0x5a0a0e, emissive: 0x2a0004, roughness: .3 }), stuff = hm(0xe0d8c8);
  f.head.updateMatrixWorld(true); const hb = new THREE.Box3().setFromObject(f.head), hs = hb.getSize(V()), hr = Math.max(.12, Math.min(hs.x, hs.z) / 2 / (f.head.scale.x || 1));
  const H = (m, x, y, z) => { m.position.set(x, y, z); f.head.add(m); add.push(m); return m; };
  f.eyes = [-1, 1].map(s => { const e = H(new THREE.Mesh(new THREE.SphereGeometry(hr * .2, 10, 8), eyeM), s * hr * .42, hr * .22, -hr * .86); const gl = huGlow(0xff2010, hr * 1.6, .9); e.add(gl); return e; });
  const mouth = H(new THREE.Mesh(new THREE.BoxGeometry(hr * 1.1, hr * .38, hr * .2), dark), 0, -hr * .28, -hr * .84);
  for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(hr * .07, hr * .26, 4), tooth); t.rotation.x = Math.PI; t.position.set(-hr * .47 + i * hr * .135, hr * .1, -hr * .06); mouth.add(t); }
  for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(hr * .06, hr * .22, 4), tooth); t.position.set(-hr * .4 + i * hr * .135, -hr * .1, -hr * .06); mouth.add(t); }
  const stem = H(new THREE.Mesh(new THREE.CylinderGeometry(hr * .05, hr * .06, hr * .6, 5), hm(0x3a4a20)), hr * .1, hr * 1.15, 0); stem.rotation.z = -.7;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(hr * .3, 6, 4), hm(0x3a3a14)); leaf.scale.set(1, .2, .5); leaf.position.set(0, hr * .3, 0); leaf.rotation.z = 1.2; stem.add(leaf);
  H(new THREE.Mesh(new THREE.SphereGeometry(hr * .28, 8, 6), wound), -hr * .7, hr * .5, -hr * .4).scale.z = .3;
  if (f.torso) { f.torso.updateMatrixWorld(true); const tb = new THREE.Box3().setFromObject(f.torso), ts = tb.getSize(V()), tr = Math.max(.14, ts.x / 2 / (f.root ? f.root.scale.x : 1)), th = ts.y / (f.root ? f.root.scale.x : 1);
    const T = (m, x, y, z) => { m.position.set(x, y, z); f.torso.add(m); add.push(m); return m; };
    [[.5, .45], [-.4, .3], [.1, .7], [-.55, .62]].forEach(([a, h]) => { const w = T(new THREE.Mesh(new THREE.SphereGeometry(tr * .3, 8, 6), wound), Math.sin(a * 3) * tr * .8, th * h, -Math.cos(a * 3) * tr * .75); w.scale.set(1, 1.3, .35); w.lookAt(w.position.clone().multiplyScalar(2).add(f.torso.position)); });
    for (let i = 0; i < 6; i++) T(new THREE.Mesh(new THREE.IcosahedronGeometry(tr * .12, 0), stuff), (huRand() - .5) * tr * 1.4, th * (.3 + huRand() * .5), -tr * .85);
    for (let i = 0; i < 5; i++) { const s = T(new THREE.Mesh(new THREE.ConeGeometry(tr * .09, tr * .5, 5), dark), 0, th * (.35 + i * .13), tr * .85); s.rotation.x = Math.PI / 2 - .5; }
    const tail = T(new THREE.Mesh(new THREE.ConeGeometry(tr * .8, th * .9, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x0b1e1b, transparent: true, opacity: .75, side: THREE.DoubleSide })), 0, -th * .25, 0); tail.rotation.x = Math.PI; }
  f.paws.forEach(p => { for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.016, .2, 5), dark); c.rotation.x = -Math.PI / 2 - .35; c.position.set(-.04 + k * .04, -.02, -.13); p.add(c); add.push(c); } });
  return add;
}
function huMakeMon() {
  const f = makeFriend(HU_MON_FUR, 0x163a35, ''); f.label.visible = false;
  f.parts = huMonsterParts(f); f.g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  f.mon = { arm: 0, rise: 0, sc: 1.7 };
  return f;
}
function huPoseMon(f, P, yaw, t) {
  const M = f.mon, sc = M.sc, bh = (state.bodyH || .85) * .95, fq = _huQ.setFromEuler(new THREE.Euler(0, yaw, 0));
  const bob = Math.sin(t * 1.7) * .08, base = P.y + .35 * M.rise + bob;
  f.root.position.set(P.x, base, P.z); f.root.rotation.set(0, yaw, 0); f.root.scale.setScalar(sc);
  f.head.position.set(P.x, base + bh * sc, P.z); f.head.quaternion.copy(fq); f.head.rotateZ(Math.sin(t * .9) * .15); f.head.rotateX(Math.sin(t * 1.3) * .08); f.head.scale.setScalar(sc);
  const reach = .25 + M.arm * .95;
  f.paws.forEach((p, i) => { const s = i ? 1 : -1; p.scale.setScalar(1.2 + M.arm * .5); p.position.copy(f.head.position).add(_hu3.set(s * (.42 + M.arm * .35) * sc * .6, -bh * sc * reach + Math.sin(t * 2 + i) * .06, -.25 - M.arm * .25).applyQuaternion(fq));
    p.position.y = Math.max(P.y + .12, p.position.y); p.quaternion.copy(fq); p.rotateX(.6 * M.arm); });
  poseFriendArms(f, sc, yaw);
  if (f.eyes) f.eyes.forEach(e => { e.children[0].material.opacity = .65 + Math.sin(t * 9) * .2; });
}
function huClearMons() { HU.mons.forEach(m => scene.remove(m.f.g)); HU.mons.length = 0; if (HU.decorF) { HU.decorF.parts.forEach(m => m.parent && m.parent.remove(m)); HU.decorF = null; } }
// YOU become the Thumpling: dark torn fur, glowing eyes + teeth on your head, claws on your paws, red vignette
function huMonsterOn() {
  if (HU.iAmMon) return; HU.iAmMon = true;
  if (AV.ready) { HU.myCols = [AV.bodyFur.color.getHex(), AV.armFur.color.getHex(), AV.pawFur.color.getHex()]; AV.bodyFur.color.set(HU_MON_FUR); AV.armFur.color.set(HU_MON_FUR); AV.pawFur.color.set(0x163a35);
    const fake = { head: AV.head, torso: AV.torso, root: AV.root, paws: hands.map(h => h.paw) }; HU.decor = huMonsterParts(fake); HU.decor.forEach(m => { if (m.parent !== hands[0].paw && m.parent !== hands[1].paw) m.traverse(o => o.layers.set(SELF_LAYER)); }); }
  if (!state.xr) $('huVig').style.display = 'block';
}
function huMonsterOff() {
  if (!HU.iAmMon) return; HU.iAmMon = false;
  HU.decor.forEach(m => m.parent && m.parent.remove(m)); HU.decor = [];
  if (AV.ready && HU.myCols) { AV.bodyFur.color.set(HU.myCols[0]); AV.armFur.color.set(HU.myCols[1]); AV.pawFur.color.set(HU.myCols[2]); applyMyColors(); }
  $('huVig').style.display = 'none';
}

/* ======================= 🎬 THE CUTSCENE: bones crack, shaking, swelling, BURST, the Thumpling ======================= */
const HC_T = { crack: .9, swell: 3.4, burst: 4.5, roar: 5.4, title: 5.9, end: 9 };
const HC_PIN = () => hL(0, 0, 1.25);   // the winner stands in front of the altar, facing the camera (south)
const HU_BLOOD = (() => {
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0x8a0010, roughness: .2, emissive: 0x200002 }), 220);
  drops.count = 0; drops.frustumCulled = false; scene.add(drops);
  const splats = new THREE.InstancedMesh(new THREE.CircleGeometry(.5, 12).rotateX(-Math.PI / 2), HUM.blood, 90); splats.count = 0; splats.frustumCulled = false; scene.add(splats);
  return { drops, splats, list: [], ns: 0 };
})();
function huClearSplats() { HU_BLOOD.splats.count = 0; HU_BLOOD.ns = 0; HU_BLOOD.list.length = 0; HU_BLOOD.drops.count = 0; }
function huBurst(P) {
  for (let i = 0; i < 220; i++) { const a = Math.random() * Math.PI * 2, up = Math.random(), sp = 2 + Math.random() * 5.5; HU_BLOOD.list.push({ p: V(P.x, P.y + .5 + Math.random() * .6, P.z), v: V(Math.cos(a) * sp * (1 - up * .5), 2 + up * 5, Math.sin(a) * sp * (1 - up * .5)), s: .5 + Math.random() * 1.2 }); }
  confetti(V(P.x, P.y + .8, P.z), 160, [0x8a0010, 0x5a0008, 0xc01020, 0x3a0004]);
  if (!state.xr) huSplatScreen(); else { const b = new THREE.Mesh(new THREE.SphereGeometry(.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xa00010, side: THREE.BackSide, transparent: true, depthTest: false })); b.renderOrder = 99; scene.add(b); HU.vrFlash = { b, t: 1.2 }; }
}
function stepBlood(dt) {
  const B = HU_BLOOD, m4 = new THREE.Matrix4(); let n = 0;
  for (let i = B.list.length - 1; i >= 0; i--) { const d = B.list[i]; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt);
    if (d.p.y < .02) { if (B.ns < 90) { const k = B.ns++; m4.compose(_hu1.set(d.p.x, .015 + k * .0004, d.p.z), _huQ.setFromAxisAngle(_up, Math.random() * 6), _hu2.set(d.s * .5, 1, d.s * (.3 + Math.random() * .4))); B.splats.setMatrixAt(k, m4); B.splats.count = B.ns; B.splats.instanceMatrix.needsUpdate = true; } B.list.splice(i, 1); continue; }
    if (n < 220) { m4.compose(d.p, _huQ.identity(), _hu2.set(d.s, d.s * (1 + Math.min(1.5, Math.abs(d.v.y) * .12)), d.s)); B.drops.setMatrixAt(n++, m4); } }
  B.drops.count = n; B.drops.instanceMatrix.needsUpdate = true;
  if (HU.vrFlash) { const F = HU.vrFlash; F.t -= dt; headWorld(F.b.position); F.b.material.opacity = Math.max(0, Math.min(.85, F.t)); if (F.t <= 0) { scene.remove(F.b); HU.vrFlash = null; } }
}
function huSplatScreen() {
  const c = $('huSplat'), d = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * d; c.height = innerHeight * d; c.style.width = '100%'; c.style.height = '100%';
  const g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H);
  HU.drips = [];
  for (let i = 0; i < 11; i++) { const edge = Math.random() < .5, x = edge ? (Math.random() < .5 ? Math.random() * W * .22 : W - Math.random() * W * .22) : Math.random() * W, y = edge ? Math.random() * H * .8 : Math.random() * H * .25, r = (14 + Math.random() * 55) * d; g.fillStyle = `rgba(${110 + Math.random() * 50 | 0},0,8,.88)`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    for (let k = 0; k < 7; k++) { const a = Math.random() * 7, rr = r * (1 + Math.random() * .7); g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * (.1 + Math.random() * .25), 0, 7); g.fill(); }
    if (Math.random() < .7) HU.drips.push({ x: x + (Math.random() - .5) * r, y: y + r * .6, w: (5 + Math.random() * 9) * d, v: (30 + Math.random() * 60) * d }); }
  c.style.opacity = .92; c.style.transition = ''; c.style.display = 'block'; HU.splatT = 2.6;
}
function stepSplat(dt) {
  if (!(HU.splatT > 0)) return; HU.splatT -= dt; const c = $('huSplat'), g = c.getContext('2d');
  for (const d of HU.drips) { g.fillStyle = 'rgba(120,0,8,.9)'; g.fillRect(d.x, d.y, d.w, d.v * dt + 1); d.y += d.v * dt; d.v *= .995; }
  if (HU.splatT < 1.8) c.style.opacity = Math.max(0, HU.splatT / 1.8 * .92); if (HU.splatT <= 0) c.style.display = 'none';
}
const huSfxCrack = (big) => { if (!ac) return; const t = ac.currentTime; noiseHit(t, .05, big ? .7 : .45, 'highpass', 2200 + Math.random() * 1500, 1.2); tone('square', 220 + Math.random() * 120, 60, .05, .1); tone('sine', 95, 40, .14, big ? .35 : .22); };
function huWin(w) {
  if (HU.phase === 'cs' || HU.phase === 'after') return;
  HU.phase = 'cs'; HU.winner = w; HU.relicH = null; huHud(''); brBig('');
  const pin = HC_PIN(), yawCam = Math.PI;   // actor faces south (+z), toward the camera
  let actor;
  if (w.bot) { actor = w.bot.f; } else { actor = makeFriend(w.col, w.paw, ''); actor.label.visible = false; }
  if (w.remote) w.remote.g.visible = false;
  HREL.relic.visible = true; HREL.lab.visible = false;
  // the camera spot: 3.8 m south of the actor, a little to the side
  const cam = hL(.8, 0, 1.25 + 3.8);
  HU.cs = { t: 0, w, actor, pin, yaw: yawCam, cam, burst: false, roared: false, titled: false, mon: null, nextCrack: HC_T.crack, twist: [0, 0, 0], sc: 1 };
  HU.bots.forEach(b => { if (b !== w.bot) b.done = true; });
  if (!state.xr) { ART_CS.bars.style.display = 'block'; requestAnimationFrame(() => ART_CS.bars.classList.add('on')); }
  else { HU.cs.rig0 = rig.position.clone(); headWorld(_hu1); rig.position.x += cam.x - _hu1.x; rig.position.z += cam.z - _hu1.z; huFaceVR(Math.atan2(-(pin.x - cam.x), -(pin.z - cam.z))); HU.cs.rigPin = rig.position.clone(); }
  artCap(w.me ? 'The RED Artifact sinks into your chest...' : `The RED Artifact sinks into ${w.name}...`);
  hands.forEach(h => buzz(h, .8, 400)); if (ac) { tone('sine', 60, 50, 1.2, .3); tone('sawtooth', 120, 30, 1, .08); }
  HREL.light.color.set(0xff0010);
}
function stepHuntCs(dt) {
  const C = HU.cs; if (!C) return; const t0 = C.t; C.t += dt; const t = C.t, T = HC_T, P = C.pin;
  // stage the actor (the winner) until the burst
  if (!C.burst) {
    const A = C.actor, crk = t >= T.crack, sw = t >= T.swell ? Math.min(1, (t - T.swell) / (T.burst - T.swell)) : 0;
    const shake = crk ? .02 + sw * .1 : 0, jp = V(P.x + (Math.random() - .5) * shake, P.y + Math.random() * shake * .5, P.z + (Math.random() - .5) * shake);
    if (A.root) A.root.scale.setScalar(1);
    artPoseTwin(A, jp, C.yaw + C.twist[2] * .4, crk ? 1.5 + sw * 3 : .2, false);
    // the relic glows in their paws, then sinks into their chest
    const chest = _hu1.copy(A.head.position); chest.y -= .3; chest.addScaledVector(_hu2.set(Math.sin(C.yaw), 0, Math.cos(C.yaw)), -.12);
    if (t < T.crack) { HUG.worldToLocal(_hu3.copy(chest).addScaledVector(_hu2, -.2 * (1 - t / T.crack))); HREL.relic.position.copy(_hu3); HREL.relic.scale.setScalar(1 - t / T.crack * .7); A.paws.forEach((p, i) => p.position.lerp(chest.clone().add(V(i ? .1 : -.1, 0, 0)), .5)); }
    else HREL.relic.visible = false;
    // crack crack crack: every crack snaps a joint the wrong way and it stays that way
    if (crk && t >= C.nextCrack && t < T.burst) { const big = Math.random() < .4; huSfxCrack(big); C.twist[Math.floor(Math.random() * 3)] += (Math.random() < .5 ? -1 : 1) * (.25 + Math.random() * .35); C.nextCrack = t + (t < T.swell ? .28 + Math.random() * .35 : .09 + Math.random() * .12);
      hands.forEach(h => buzz(h, big ? 1 : .6, 60)); if (!state.xr) C.kick = .06; if (t < T.swell && !C.saidCrack) { C.saidCrack = true; artCap('*CRACK*  ...  *CRACK*'); } }
    A.head.rotateZ(C.twist[0]); A.head.rotateX(C.twist[1] * .6);
    A.paws.forEach((p, i) => { p.position.y += (i ? C.twist[1] : C.twist[2]) * .15; p.rotateZ(C.twist[i] * 1.5); });
    // swelling: bigger, darker, glowing red from inside
    const s = 1 + sw * .45 + Math.sin(t * 40) * .03 * sw; if (A.root) { A.root.scale.multiplyScalar(s); } A.head.scale.multiplyScalar(s);
    if (A.fur) A.fur.color.lerp(_hu3Col.set(0x4a0a10), Math.min(1, dt * (crk ? .5 + sw * 3 : 0)));
    HREL.light.position.set(chest.x - HUNT.x, chest.y - HUNT.y, chest.z - HUNT.z + .3); HREL.light.intensity = 2.2 + sw * 9 + (crk ? Math.random() * 2 : 0);
    if (t0 < T.swell && t >= T.swell) { artCap('Something is tearing its way out!'); if (ac) { tone('sawtooth', 40, 90, 1.1, .12); noiseHit(ac.currentTime, 1.1, .12, 'lowpass', 400, .6); } }
    if (t >= T.burst) huCsBurst();
  }
  // the monster: rises out of the blood, arms unfold, ROAR
  if (C.mon) {
    const M = C.mon.mon, k = Math.min(1, (t - T.burst) / .7); M.sc = .7 + k * 1.0; M.rise = Math.min(1, (t - T.burst) / 1.2); M.arm = Math.min(1, Math.max(0, (t - T.burst - .3) / .9));
    huPoseMon(C.mon, P, C.yaw, t);
    if (!C.roared && t >= T.roar) { C.roared = true; if (ac) { tone('sawtooth', 110, 38, 2.2, .3); tone('square', 70, 30, 2, .12); noiseHit(ac.currentTime, 1.8, .4, 'lowpass', 700, .5); } hands.forEach(h => buzz(h, 1, 900)); C.kick = .25;
      C.mon.eyes.forEach((e, i) => shine(e.getWorldPosition(V()), .45, i * .12)); }
    if (!C.titled && t >= T.title) { C.titled = true; artCap(''); const w = C.w;
      huTitle(w.me ? 'YOU ARE THE THUMPLING' : `${w.name.toUpperCase()} IS THE THUMPLING`, w.me ? 'everyone else is the prey now...' : 'RUN.'); }
  }
  // camera
  C.kick = Math.max(0, (C.kick || 0) - dt * .5);
  if (!state.xr) {
    const cam = CS.cam; const bh = state.bodyH || .85, look = _hu1.copy(P); look.y += C.mon ? .35 * C.mon.mon.rise + bh * .95 * C.mon.mon.sc * .7 : bh * .8;
    if (t < T.burst) { const a = -.45 + ease(Math.min(1, t / T.burst)) * .75, r = 2.7 - t * .06; cam.position.set(P.x + Math.sin(a) * r, P.y + .95 + t * .04, P.z + Math.cos(a) * r); }
    else { const k = ease(Math.min(1, Math.max(0, (t - T.roar) / 1.4))), r = 5 - k * 1.4, a = .3; cam.position.set(P.x + Math.sin(a) * r, P.y + .75 + k * .2, P.z + Math.cos(a) * r); }
    if (C.kick > 0) cam.position.add(_hu2.set((Math.random() - .5) * C.kick, (Math.random() - .5) * C.kick, (Math.random() - .5) * C.kick));
    cam.lookAt(look);
  } else if (C.rigPin) { rig.position.copy(C.rigPin); }
  state.vel.set(0, 0, 0); if (state.velBuf) state.velBuf.length = 0;
  if (C.w.me) { AV.root.visible = false; if (AV.head) AV.head.visible = false; AV.arms.forEach(a => a.up.visible = a.fore.visible = a.elbow.visible = false); }
  if (C.w.remote) C.w.remote.g.visible = false;
  if (t >= T.end) huCsEnd();
}
const _hu3Col = new THREE.Color();
function huCsBurst() {
  const C = HU.cs; if (C.burst) return; C.burst = true;
  if (C.w.bot) C.w.bot.f.g.visible = false; else scene.remove(C.actor.g);
  huBurst(C.pin); C.mon = huMakeMon(); C.mon.mon.sc = .7;
  hands.forEach(h => buzz(h, 1, 500)); C.kick = .35;
  if (ac) { noiseHit(ac.currentTime, .7, .7, 'lowpass', 900, .5); tone('sine', 70, 30, .8, .4); tone('square', 300, 80, .3, .1); }
  HREL.light.intensity = 6; HREL.light.color.set(0xff0010); hemi.color.set(0xa03030); hemi.groundColor.set(0x300000);
}
function huCsEnd() {
  const C = HU.cs; if (!C) return; huCsBurst(); HU.cs = null; HU.phase = 'after';
  ART_CS.bars.classList.remove('on'); setTimeout(() => { ART_CS.bars.style.display = 'none'; }, 500); artCap(''); setTimeout(() => huTitle(''), 2200);
  hemi.color.set(0x9fcfaf); hemi.groundColor.set(0x1a0c0c); HREL.light.intensity = 1.2; HREL.light.position.set(0, 1.5, 0); HREL.relic.visible = false; HREL.lab.visible = false;
  if (state.xr && C.rig0) { rig.position.x += C.pin.x - C.cam.x; rig.position.z += C.pin.z - C.cam.z + .6; }
  const w = C.w;
  if (w.me) { scene.remove(C.mon.g); huMonsterOn(); if (!state.xr) { arrive(V(C.pin.x, 0, C.pin.z + .6), Math.PI, 'hunt'); }
    toast('🩸 YOU ARE THE THUMPLING! Hunting the others comes in the next update. 🔁 races again, 🚪 goes back to the lobby.', 9); }
  else if (w.remote) { scene.remove(C.mon.g); w.remote.g.visible = true; HU.decorF = { f: w.remote, parts: huMonsterParts(w.remote) };
    toast(`🩸 ${w.name} is the THUMPLING! (hunting rules come in the next update)`, 7); }
  else { HU.mons.push({ f: C.mon, p: C.pin.clone(), yaw: C.yaw, a: 0 }); if (w.bot) { scene.remove(w.bot.f.g); HU.bots.splice(HU.bots.indexOf(w.bot), 1); }
    toast(`🩸 ${w.name} became the THUMPLING! It's watching you... (hunting comes next update) 🔁 to race again!`, 8); }
}
function huSkip() {
  if (HU.tour) { huTourEnd(); return; }
  if (HU.cs) { HU.cs.t = Math.max(HU.cs.t, HC_T.burst); huCsBurst(); HU.cs.t = HC_T.end; huCsEnd(); }
}

/* ======================= 🗺️ THE MAP TOUR (a montage of every room) ======================= */
const HU_TOUR = [
  { from: [0, 2.3, 63], to: [0, 2.7, 58.6], look: [0, 3.3, 56], look2: [0, 2.2, 50], cap: 'THE GAUNTLET', sub: 'the race starts here' },
  { from: [2.4, 1.4, 49], to: [2.3, 2.2, 36], look: [0, .8, 42], look2: [0, 2.6, 27], cap: 'Jump. Zig-zag. CLIMB.', sub: 'hurdles, crates and a climbing wall' },
  { orbit: [0, 1, 0, 9.5, 4, .7, -.5], cap: 'THE PLAYGROUND', sub: 'the RED Artifact waits in the middle', shine: true },
  { from: [-7.5, 2.4, -18.4], to: [5.5, 2.5, -18.8], look: [0, 2.2, -34], look2: [0, 2.3, -34], cap: 'THE THEATER', sub: 'the show never ends' },
  { from: [-18.4, 2.5, 6.5], to: [-18.8, 2.2, -5.5], look: [-25, 1, 1], look2: [-25, 1, -1], cap: 'THE PARTY ROOM', sub: 'nobody blew out the candles' },
  { from: [18.6, 2.7, -6.8], to: [19, 2.2, 6.8], look: [25, .5, 0], look2: [25, .8, 0], cap: 'THE WATER AREA', sub: 'don\'t look under the water' },
  { from: [-18.4, 2.6, 26.6], to: [-19, 2.1, 13.6], look: [-25, 1, 20], look2: [-25, 1, 21], cap: 'STORAGE', sub: 'so many places to hide' },
  { from: [25, 1.8, -40.6], to: [25, 2.6, -43], look: [25, 0, -47], look2: [25, .4, -49], cap: 'THE TRAP ROOM', sub: 'never follow the red path...' },
  { from: [0, 1.7, 51], to: [0, 1.5, 56.6], look: [0, 1.2, 60], look2: [0, 1.1, 61], cap: 'READY?', sub: 'race to the RED Artifact!' }
];
const HU_TOUR_D = 2.6;
function huTourStart() {
  if (HU.cs || HU.tour || state.area !== 'hunt') return;
  HU.tour = { i: -1, t: 0, prevPhase: HU.phase, rigPin: rig.position.clone() }; HU.phase = 'tour';
  if (!state.xr) { ART_CS.bars.style.display = 'block'; requestAnimationFrame(() => ART_CS.bars.classList.add('on')); }
  else csTheater(true);
  huTourNext();
}
function huTourNext() {
  const T = HU.tour; T.i++; T.t = 0; T.shone = false;
  if (T.i >= HU_TOUR.length) { huTourEnd(); return; }
  const s = HU_TOUR[T.i]; artCap(''); huTitle(s.cap, s.sub); if (ac) tone('sine', [196, 220, 185, 165, 175, 147, 165, 131, 262][T.i], 0, 1.4, .05);
  const idx = T.i; setTimeout(() => { if (HU.tour && HU.tour.i === idx) huTitle(''); }, HU_TOUR_D * 1000 - 500);
}
function huTourEnd(quiet) {
  const T = HU.tour; if (!T) return; HU.tour = null; huTitle('');
  ART_CS.bars.classList.remove('on'); setTimeout(() => { if (!HU.cs) ART_CS.bars.style.display = 'none'; }, 500); csTheater(false); $('huFade').style.display = 'none';
  if (quiet) return;
  if (T.prevPhase === 'ready' || T.prevPhase === 'count') huCountdown(); else HU.phase = T.prevPhase;
}
function stepHuntTour(dt) {
  const T = HU.tour; if (!T) return; T.t += dt; if (T.t > HU_TOUR_D) { huTourNext(); if (!HU.tour) return; }
  const s = HU_TOUR[T.i], k = ease(Math.min(1, T.t / HU_TOUR_D)), cam = CS.cam;
  if (s.orbit) { const [x, y, z, r, h, a0, a1] = s.orbit, a = a0 + (a1 - a0) * k; cam.position.set(HUNT.x + x + Math.sin(a) * r, HUNT.y + y + h, HUNT.z + z + Math.cos(a) * r); cam.lookAt(HUNT.x + x, HUNT.y + y, HUNT.z + z); }
  else { cam.position.set(...s.from).lerp(_hu1.set(...s.to), k).add(HUNT); cam.lookAt(_hu2.set(...s.look).lerp(_hu3.set(...s.look2), k).add(HUNT)); }
  if (s.shine && !T.shone && T.t > 1.2) { T.shone = true; shine(HREL.relic.getWorldPosition(V()).add(V(.05, .12, 0)), .6); }
  const fade = T.t < .3 ? 1 - T.t / .3 : T.t > HU_TOUR_D - .25 ? (T.t - (HU_TOUR_D - .25)) / .25 : 0; T.fade = fade;
  if (!state.xr) { const f = $('huFade'); f.style.display = fade > 0 ? 'block' : 'none'; f.style.opacity = fade; }
  rig.position.copy(T.rigPin); state.vel.set(0, 0, 0); if (state.velBuf) state.velBuf.length = 0;
  // VR: the B / Y button skips
  if (state.xr) { let b = false; hands.forEach(h => { const gp = h.src && h.src.gamepad; if (gp && gp.buttons[5] && gp.buttons[5].pressed) b = true; }); if (b && !HU.lastB) huSkip(); HU.lastB = b; }
}
function huRenderRT() {   // VR: film the tour camera onto the floating theater screen (every other frame)
  if (!CS.vr || (CS.vr.frame++ & 1)) return;
  const xrOn = renderer.xr.enabled, prev = renderer.getRenderTarget(), sa = renderer.shadowMap.autoUpdate;
  renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false; CS.cam.aspect = 16 / 9; CS.cam.updateProjectionMatrix();
  renderer.setRenderTarget(CS.vr.rt); renderer.render(scene, CS.cam); renderer.setRenderTarget(prev);
  renderer.xr.enabled = xrOn; renderer.shadowMap.autoUpdate = sa;
  const g = CS.vr.ov.getContext('2d'), T = HU.tour, s = T && HU_TOUR[T.i]; g.clearRect(0, 0, 1024, 576);
  if (s) { g.fillStyle = `rgba(0,0,0,${T.fade || 0})`; g.fillRect(0, 0, 1024, 576); g.textAlign = 'center'; g.font = '64px "Lilita One", Impact'; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(s.cap, 512, 470); g.fillStyle = '#ff3040'; g.fillText(s.cap, 512, 470);
    g.font = '30px Fredoka, sans-serif'; g.fillStyle = '#eee'; g.fillText(s.sub + '   (B / Y = skip)', 512, 530); }
  CS.vr.ot.needsUpdate = true;
}
function huCam() { return (HU.tour || (HU.cs && !state.xr)) ? CS.cam : null; }

/* ======================= per frame ======================= */
function huInside(on) {
  HU.inside = on; HUG.visible = on;
  if (!on) { huSaveLook(false); huAmb(false); huHud(''); if (HU.phase !== 'off' && !HU.cs) { HU.phase = 'off'; huClearBots(); huClearMons(); huMonsterOff(); huTourEnd(true); } }
}
function stepHole(dt) {
  const g = HOLE_G, here = state.area === 'grove';
  g.g.visible = here; if (!here) return;
  g.light.intensity = 2.6 + Math.sin(tAll * 2.1) * .6 + (Math.random() < .03 ? 1.5 : 0); const blink = (tAll % 23) > 21.6 && (tAll % 23) < 22.9 && Math.sin(tAll * 9) > -.8; g.eyes.forEach(e => { e.material.opacity = blink ? .95 : 0; }); g.core.material.opacity = .55 + Math.sin(tAll * 1.3) * .15;
  g.embers.forEach(o => { o.t += dt * .5; if (o.t > 1) { o.t = 0; o.x = (Math.random() - .5) * 4.4; o.y = .4 + Math.random() * 4.5; } const k = o.t; o.e.position.set((o.x || 0) + Math.sin(k * 7 + o.y) * .3, (o.y || 2) + k * 1.4, -1 + k * 6); o.e.material.opacity = Math.sin(k * Math.PI) * .9; });
  if (!g.signT || (g.signT -= dt) < 0) { g.signT = 1; huHoleSign(); }
  const v = huVoteInfo(); if (online() && v.yes > 0 && HU.phase === 'off') huHud(`🩸 THE HUNT vote: ${v.yes} / ${v.n} (need ${v.need}). Walk into the red hole to vote!`); else if (HU.phase === 'off') huHud('');
  if (state.mode !== 'play' || HU.phase !== 'off') return;
  // walk into the hole = vote
  headWorld(_hu1); g.g.worldToLocal(_hu2.copy(_hu1));
  const inHole = _hu2.z < 1.4 && Math.hypot(_hu2.x, _hu2.y - 3) < 2.8;
  if (inHole && !HU.wasIn && (!HU.voteCool || tAll > HU.voteCool)) { HU.voteCool = tAll + 3; huVote(); }
  HU.wasIn = inHole;
  for (const P of [g.vote, g.test]) { P.cap.material.emissiveIntensity = .5 + Math.sin(tAll * 4) * .25;
    for (const h of hands) { if (!h.tracked || !(state.xr || sim.on)) continue; const ins = h.pos.distanceTo(P.top) < .13; if (ins && !P.in[h.i]) { buzz(h, .7, 40); if (P === g.vote) huVote(); else huEnter('test'); } P.in[h.i] = ins; } }
}
function stepHunt(dt) {
  const here = state.area === 'hunt';
  if (here !== HU.inside) huInside(here);
  stepHole(dt); huDomBtns(); stepBlood(dt); stepSplat(dt);
  if (!here) { if (HU.cs) huCsEnd(); return; }
  const t = tAll;
  // the world: flickering lamps, creepy swings, merry-go-round, candles, water, fog, relic, theater static
  HU_LAMPS.forEach(L => { const f = Math.sin(t * 13 + L.ph) > .93 || Math.random() < .015 ? .1 : 1; L.m.emissiveIntensity = L.base * f * 1.6; L.gl.material.opacity = .45 * f; });
  HU_SWINGS.forEach(S => { S.p.rotation.x = S.i === 1 ? Math.sin(t * 1.7) * .55 : Math.sin(t * .6 + S.i) * .05; });
  if (HU_SWINGS[1] && ac && Math.abs(Math.sin(t * 1.7)) > .995 && (!HU.creak || t - HU.creak > .8)) { HU.creak = t; headWorld(_hu1); const d = _hu1.distanceTo(hL(7, 1, -6)); if (d < 14) tone('sawtooth', 620, 520, .35, .03 * (1 - d / 14)); }
  if (HU_SPIN.g) HU_SPIN.g.rotation.y += dt * .25;
  HU_CANDLES.forEach(c => { const f = .8 + Math.sin(t * 17 + c.ph) * .2; c.fl.scale.set(1, f, 1); c.gl.material.opacity = .4 + f * .2; });
  if (HU_WATER.m.map) HU_WATER.m.map.offset.set(t * .01, t * .006);
  HU_WATER.rings.forEach(R => { const a = R.a + t * .05; R.r.position.set(25 + Math.cos(a) * 3.7, .42 + Math.sin(t * 1.3 + R.ph) * .03, Math.sin(a) * 3.7); });
  HU_FOG.forEach(F => { F.s.position.set(F.x + Math.sin(t * .13 + F.ph) * 1.5, .5 + Math.sin(t * .3 + F.ph) * .15, F.z + Math.cos(t * .11 + F.ph) * 1.5); });
  if (HU_TRAP.cage) HU_TRAP.cage.rotation.z = Math.sin(t * .7) * .06;
  HU_TRAP.light.intensity = Math.random() < .08 ? 0 : 1.6 + Math.sin(t * 5) * .4;
  if ((HU_SCREEN.t -= dt) < 0) { HU_SCREEN.t = .09; const c = HU_SCREEN.cv, g = c.getContext('2d'), im = g.createImageData(c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 160 | 0; d[i] = v * .8; d[i + 1] = v; d[i + 2] = v * .9; d[i + 3] = 255; } g.putImageData(im, 0, 0);
    if (Math.random() < .08) { g.fillStyle = 'rgba(0,0,0,.85)'; g.beginPath(); g.arc(64, 36, 22, 0, 7); g.fill(); g.fillStyle = '#ff2020'; g.beginPath(); g.arc(56, 32, 3, 0, 7); g.arc(72, 32, 3, 0, 7); g.fill(); }
    HU_SCREEN.tex.needsUpdate = true; }
  if (!HU.cs) { HREL.ring.rotation.y += dt * 2.4; HREL.relic.rotation.y += dt * .7; if (!HU.relicH && HREL.relic.visible) HREL.relic.position.y = 1.08 + Math.sin(t * 1.5) * .03; HREL.halo.material.opacity = .45 + Math.sin(t * 3) * .15; HREL.light.intensity = HU.phase === 'after' ? 1 : 2 + Math.sin(t * 2.3) * .5; }
  // secrets
  headWorld(_hu1);
  for (const o of HU_SEC) { if (!o.g.visible) continue; o.g.rotation.y += dt * 1.5; o.gl.material.opacity = .35 + Math.sin(t * 4) * .2;
    if (_hu1.distanceTo(o.p) < 1.0 || hands.some(h => h.tracked && h.pos.distanceTo(o.p) < .3)) huSecretFound(o); }
  if (!HU.secrets.has('x')) { const onX = Math.hypot(_hu1.x - HUNT.x - 25, _hu1.z - HUNT.z + 46) < 1.3; HU.xT = onX ? HU.xT + dt : 0;
    if (HU.xT > 4 && !HU_SEC[3].g.visible) { HU_SEC[3].g.visible = true; HU_SEC[3].p.copy(hL(25, 1.2, -46)); toast('...you shouldn\'t have stayed on the X. 👁️', 3.5); if (ac) { tone('sine', 300, 120, 2, .08); tone('sine', 303, 119, 2, .08); } } }
  // the race, the cutscene, the tour, monsters left behind by bots
  if (HU.tour) stepHuntTour(dt);
  else if (HU.phase === 'count' || HU.phase === 'race' || HU.phase === 'ready') stepRace(dt);
  else HU.bots.forEach(b => artPoseTwin(b.f, hL(b.x, b.y, b.z), 0, .2));
  if (HU.cs) stepHuntCs(dt);
  for (const M of HU.mons) { M.a += dt * .12; const P = _hu2.set(HUNT.x + Math.sin(M.a) * 6, 0, HUNT.z + Math.cos(M.a * .8) * 6); headWorld(_hu1); const yaw = Math.atan2(-(_hu1.x - P.x), -(_hu1.z - P.z)); M.f.mon.sc = 1.7; M.f.mon.rise = 1; M.f.mon.arm = 1; huPoseMon(M.f, P, yaw, t); }
  if (HU.phase === 'after') huHud(HU.iAmMon ? '🩸 You are the THUMPLING  •  hunting comes next update  •  🔁 race again  •  🚪 lobby' : '🩸 The THUMPLING is awake  •  🔁 race again  •  🚪 lobby');
  // VR: the start pedestals (race again, tour) and walking into the exit
  if (state.mode === 'play' && !HU.cs && !HU.tour) {
    for (const P of HU_PEDS) { P.cap.material.emissiveIntensity = .5 + Math.sin(t * 4) * .25;
      for (const h of hands) { if (!h.tracked || !(state.xr || sim.on)) continue; const ins = h.pos.distanceTo(P.top) < .13; if (ins && !P.in[h.i]) { buzz(h, .7, 40); P.act(); } P.in[h.i] = ins; } }
    if (_hu1.z - HUNT.z > 62.7 && HU.phase !== 'count') huLeave();
  }
}
// pedestals at the start (VR): 🔁 RACE AGAIN, 🗺️ MAP TOUR, and the exit door behind you
const HU_PEDS = [];
{
  const ped = (x, z, lab1, lab2, c, act) => { const pg = new THREE.Group(); pg.position.set(x, 0, z); pg.rotation.y = 0; HUG.add(pg);
    part(new THREE.CylinderGeometry(.16, .2, .9, 20), smat(0x2b2030, { roughness: .5 }), 0, .45, 0, pg);
    const cap = part(new THREE.SphereGeometry(.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), smat(c, { emissive: c, emissiveIntensity: .6, roughness: .3 }), 0, .9, 0, pg); cap.scale.y = .5;
    const t = labelTex(512, 160, (q, w, h) => signText(q, w, h, [[lab1, 50, '#ffffff', 64], [lab2, 34, '#ffd0d0', 122]], 'rgba(20,6,10,.95)', '#' + new THREE.Color(c).getHexString()));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(.66, .21), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide })); s.position.set(0, 1.25, 0); pg.add(s);
    addCol({ t: 1, x: HUNT.x + x, z: HUNT.z + z, cy: .45, hy: .45, r: .2, tag: 'rock' });
    HU_PEDS.push({ cap, top: hL(x, .96, z), in: [false, false], act }); };
  ped(-2.3, 61.6, '🔁 RACE AGAIN', 'restart the race', 0xff8a3d, () => huAgain(true));
  ped(2.3, 61.6, '🗺️ MAP TOUR', 'see every room', 0x3fb2ff, () => huTourStart());
  const ex = canvasTex(512, 128, (g, w, h) => signText(g, w, h, [['🚪 EXIT TO LOBBY ↓', 56, '#ffffff', 64]], 'rgba(10,20,14,.95)', '#5fd06a'));
  huPlane(0, 3.4, 63.75, 3, .75, new THREE.MeshBasicMaterial({ map: ex, transparent: true }), 0, Math.PI);
  const door = huPlane(0, 1.4, 63.78, 2.2, 2.8, new THREE.MeshBasicMaterial({ color: 0x5fd06a, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }), 0, Math.PI);
}
window.__kg.hunt = { HU, HUNT, HOLE, HOLE_G, huEnter, huVote, huLeave, huAgain, huTourStart, huSkip, huWin, huMyWin, huMonsterOn, huMonsterOff, stepHunt, HREL, HU_SEC, HU_TOUR, hL, huMakeMon, huPoseMon };
