/* ======================= 🎂 VIVAN'S BIRTHDAY PARTY =======================
   Lobby: a big "HAPPY BIRTHDAY VIVAN!" banner and a red carpet that leads to a party hole. Jump in!
   You float down a rainbow tube with a party hat + party blower (blow / talk loud into the mic and it
   unrolls and goes off). Land at the party: grab the sword, press START and slice the cubes the CUBE
   BLASTER shoots at you for 30 s. Claude waits at the cutting station for questions. Then the CAKE ROOM:
   a huge cake to slice and eat (pick a piece up to your mouth, or F on PC). Blow out the candles too!
   The party is part of the Slicing Yard's physics world (state.area stays 'arena'), far off at PW. */
var PT = { inside: false, fall: false, built: false, phys: false, hat: 'pick', blow: 'pick', u: 0, blowing: false, pops: [], shots: [], kz: null,
  ch: { cd: 0, on: false, t: 0, cnt: 0, next: 0, best: +(store.get('kg-party-best') || 0), showT: 0, lastBoard: '' },
  candles: [], cakeOut: false, recoil: 0, cleanT: 0, balloons: [], disco: null, discoT: 0, told: {}, keyB: false, holdB: false, land: 0 };
const PW = V(-400, 0, 0);                         // the party's origin in the world (far from the grove, the yard and the Wilds)
const PL = V().subVectors(PW, ARENA);             // the same spot in the yard's physics coordinates
const pw = (x, y, z) => V(x, y, z).add(PW), pl = (x, y, z) => V(x, y, z).add(PL);
const P_LAND = V(0, 0, 6), P_STAND = V(0, 0, 0), P_SWORD = V(-1.05, 0, .55), P_START = V(1.05, 0, .55), P_BOARD = V(0, 0, -8.75),
  P_CLAUDE = V(-2.35, 0, -.8), P_GUN = V(0, 0, -9.5), P_TABLE = V(-1.7, 0, 5.1), P_OFF = V(1.7, 0, 5.1), P_CAKE = V(10.3, 0, -3.6),
  P_NEWCAKE = V(8.4, 0, -1.3), G_HOLE = V(3.2, 0, -13.1), CAKE_B = .7, CAKE_T = .42, PLATTER = .2;
const PARTY_COLS = [0xff4fa8, 0xffd25a, 0x3fb2ff, 0x8b6bff, 0x5fd94a, 0xff8a3d, 0xff5f6d];
const partyG = new THREE.Group(); partyG.position.copy(PW); scene.add(partyG); partyG.updateMatrixWorld(true);
const lobbyG = new THREE.Group(); scene.add(lobbyG);

/* ---------- little builders ---------- */
const BAL_G = new THREE.SphereGeometry(.16, 20, 14), KNOT_G = new THREE.ConeGeometry(.03, .05, 8), STR_G = new THREE.CylinderGeometry(.002, .002, 1, 4);
const balMats = PARTY_COLS.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .22, metalness: .05, envMap: ENV, envMapIntensity: .7 }));
const strMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
function balloon(parent, x, y, z, ci, len = .9, sc = 1) {   // y = where the string is tied
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const b = new THREE.Group(); g.add(b); b.position.y = len; b.userData.y0 = len; b.scale.setScalar(sc);
  const s = new THREE.Mesh(BAL_G, balMats[ci % balMats.length]); s.scale.y = 1.18; s.castShadow = true; b.add(s);
  const k = new THREE.Mesh(KNOT_G, balMats[ci % balMats.length]); k.position.y = -.2; k.rotation.x = Math.PI; b.add(k);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 })); shine.position.set(-.06, .08, .11); b.add(shine);
  const str = new THREE.Mesh(STR_G, strMat); str.scale.y = len - .2; str.position.y = (len - .2) / 2; g.add(str);
  PT.balloons.push({ g, b, ph: rnd() * 6.28, sp: .7 + rnd() * .6, ci });
  return g;
}
function bunting(parent, a, b, sag, n, cols = PARTY_COLS) {   // a string of triangle flags between two points (parent-local)
  const curve = new THREE.QuadraticBezierCurve3(a, V().lerpVectors(a, b, .5).add(V(0, -sag, 0)), b);
  const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .008, 4), mat(0xffffff)); parent.add(rope);
  const pos = [], col = [], c = new THREE.Color(), dir = V().subVectors(b, a).setY(0).normalize();
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n, p = curve.getPoint(t), w = .13, hgt = .2; c.set(cols[i % cols.length]);
    const L = V().copy(p).addScaledVector(dir, -w), R = V().copy(p).addScaledVector(dir, w), D = V().copy(p).add(V(0, -hgt, 0));
    pos.push(L.x, L.y, L.z, R.x, R.y, R.z, D.x, D.y, D.z); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .7 })); parent.add(m); return m;
}
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t;
}
function signBoard(parent, x, y, z, yaw, w, h, lines, bg, border, post = true) {
  const tex = labelTex(Math.round(512 * w / h) > 2048 ? 2048 : Math.round(512 * w / h), 512, (g, W, H) => signText(g, W, H, lines.map(([t, s, c, yy]) => [t, s, c, yy]), bg, border));
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; parent.add(g);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); m.position.z = .03; g.add(m);
  part(new THREE.BoxGeometry(w + .08, h + .08, .04), smat(0xffffff, { roughness: .5 }), 0, 0, 0, g);
  if (post) [-1, 1].forEach(s => part(new THREE.CylinderGeometry(.025, .03, y, 8), smat(0xffd25a, { metalness: .6, roughness: .3 }), s * (w / 2 - .06), -y / 2, -.03, g));
  return g;
}
const P_BTNS = [];
function partyButton(parent, p, yaw, label, col, css, act) {   // same look and feel as the yard console's buttons
  const g = new THREE.Group(); g.position.copy(p); g.rotation.y = yaw; parent.add(g);
  const body = smat(0xffffff, { roughness: .45 }), dark = smat(0x2b2140, { roughness: .5 }), steel = new THREE.MeshStandardMaterial({ color: 0xffd25a, metalness: 1, roughness: .25, envMap: ENV });
  part(new THREE.BoxGeometry(.3, .3, .3), body, 0, .15, 0, g);
  const stripeT = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.55)'; for (let x = -128; x < 256; x += 32) { c.beginPath(); c.moveTo(x, 128); c.lineTo(x + 16, 128); c.lineTo(x + 144, 0); c.lineTo(x + 128, 0); c.fill(); } });
  part(new THREE.BoxGeometry(.32, .06, .32), new THREE.MeshStandardMaterial({ map: stripeT, roughness: .5 }), 0, .03, 0, g);
  part(new THREE.BoxGeometry(.34, .03, .34), dark, 0, .315, 0, g);
  part(new THREE.CylinderGeometry(.085, .092, .03, 28), dark, 0, .345, 0, g);
  const ring = part(new THREE.TorusGeometry(.08, .009, 8, 36), steel, 0, .36, 0, g); ring.rotation.x = Math.PI / 2;
  const cap = new THREE.Group(); cap.position.set(0, .36, 0); g.add(cap);
  const cm = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, roughness: .25, envMap: ENV, envMapIntensity: .6 });
  part(new THREE.CylinderGeometry(.066, .068, .028, 28), cm, 0, .014, 0, cap);
  const dome = part(new THREE.SphereGeometry(.066, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), cm, 0, .028, 0, cap); dome.scale.y = .38;
  const tex = labelTex(384, 128, (cg, w, h) => signText(cg, w, h, [[label, 50, css, 66]], 'rgba(30,20,50,.95)', css));
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(.28, .093), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); lab.position.set(0, .2, .152); g.add(lab);
  parent.updateMatrixWorld(true);
  const b = { i: 30 + P_BTNS.length, cap, cm, top: V(), down: 0, g, act }; cap.getWorldPosition(b.top); b.top.y += .04;
  buttons.push(b); P_BTNS.push(b);
  const wp = V(); g.getWorldPosition(wp); addCol({ t: 0, x: wp.x, y: .165, z: wp.z, hx: .16, hy: .165, hz: .16, yaw, tag: 'wood' });
  return b;
}

/* ======================= THE LOBBY: banner, red carpet, the party hole ======================= */
// everything here is built in a frame centred on the hole, with +z pointing back along the carpet to the spawn stump
const lobby = { cloth: null, clothBase: null, hole: null, bulbs: [], sign: null };
const LOB_DIR = V(-G_HOLE.x, 0, -G_HOLE.z).normalize(), LOB_LEN = Math.hypot(G_HOLE.x, G_HOLE.z) - 3.55;
lobbyG.position.copy(G_HOLE); lobbyG.rotation.y = Math.atan2(LOB_DIR.x, LOB_DIR.z); lobbyG.updateMatrixWorld(true);
const lobW = (x, z) => lobbyG.localToWorld(V(x, 0, z));
const lobCyl = (x, z, cy, hy, r, tag = 'wood') => { const w = lobW(x, z); addCol({ t: 1, x: w.x, z: w.z, cy, hy, r, tag }); };
{
  const g = new THREE.Group(); lobbyG.add(g);
  const Z0 = 1.05, Z1 = LOB_LEN, L = Z1 - Z0;
  // the red carpet: deep velvet with a gold edge
  const carpetT = canvasTex(128, 512, (c, w, h) => {
    c.fillStyle = '#b3122a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '255,60,80' : '70,0,10'},${.05 + Math.random() * .08})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
    const gold = c.createLinearGradient(0, 0, 12, 0); gold.addColorStop(0, '#ffe18a'); gold.addColorStop(1, '#c8901f');
    c.fillStyle = gold; c.fillRect(0, 0, 12, h); c.fillRect(w - 12, 0, 12, h); c.fillStyle = '#7a0a18'; c.fillRect(12, 0, 3, h); c.fillRect(w - 15, 0, 3, h);
  }, [1, 3]);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.4, L), new THREE.MeshStandardMaterial({ map: carpetT, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, .014, (Z0 + Z1) / 2); carpet.receiveShadow = true; g.add(carpet);
  // gold stanchions with red velvet ropes along both sides
  const goldM = new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .25, envMap: ENV }), ropeM = smat(0xc0102a, { roughness: .8 });
  const n = 6;
  [-1, 1].forEach(s => {
    const x = s * .95, pts = [];
    for (let i = 0; i < n; i++) {
      const z = Z1 - .25 - i * (L - .9) / (n - 1);
      part(new THREE.CylinderGeometry(.11, .13, .04, 16), goldM, x, .02, z, g); part(new THREE.CylinderGeometry(.022, .022, .62, 10), goldM, x, .33, z, g); part(new THREE.SphereGeometry(.045, 14, 10), goldM, x, .66, z, g);
      pts.push(V(x, .6, z)); lobCyl(x, z, .33, .33, .05, 'rock');
    }
    for (let i = 0; i < n - 1; i++) { const a = pts[i], b = pts[i + 1], m = V().lerpVectors(a, b, .5); m.y -= .16; g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 16, .018, 6), ropeM)); }
  });
  // two tall striped poles + the big banner
  const poleT = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (let y = -64; y < h + 64; y += 64) { c.fillStyle = '#ff4fa8'; c.save(); c.translate(0, y); c.transform(1, -.5, 0, 1, 0, 0); c.fillRect(0, 0, w, 32); c.restore(); } }, [1, 4]);
  const poleM = new THREE.MeshStandardMaterial({ map: poleT, roughness: .45 }), BZ = LOB_LEN - 2.9, PX = [-2.5, 2.5];
  PX.forEach(x => { part(new THREE.CylinderGeometry(.07, .08, 3.9, 14), poleM, x, 1.95, BZ, g); part(new THREE.SphereGeometry(.13, 16, 12), goldM, x, 3.96, BZ, g); part(new THREE.CylinderGeometry(.2, .25, .12, 16), goldM, x, .06, BZ, g); lobCyl(x, BZ, 1.95, 1.95, .09); });
  // the JUMP IN sign behind the hole, facing down the carpet
  lobby.sign = signBoard(g, 0, 1.3, -1.55, 0, 1.3, .55, [['JUMP IN! 🎉', 150, '#ff4fa8', 190], ["VIVAN'S PARTY ↓", 96, '#3fb2ff', 350]], 'rgba(255,255,255,.96)', '#ffd25a');
  [-.59, .59].forEach(x => lobCyl(x, -1.55, .65, .65, .04));
  mergeStatic(g);
  const banT = labelTex(2048, 460, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); ['#ff4fa8', '#ff8a3d', '#ffd25a', '#5fd94a', '#3fb2ff', '#8b6bff'].forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col));
    c.fillStyle = '#fff7fb'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 40); c.fill(); c.lineWidth = 18; c.strokeStyle = gr; c.stroke();
    let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 160; i++) { c.fillStyle = '#' + new THREE.Color(PARTY_COLS[i % PARTY_COLS.length]).getHexString(); c.save(); c.translate(30 + r() * (w - 60), 30 + r() * (h - 60)); c.rotate(r() * 6); c.globalAlpha = .35; c.fillRect(-7, -3, 14, 6); c.restore(); }
    c.globalAlpha = 1; c.textAlign = 'center'; c.textBaseline = 'middle';
    const text = 'HAPPY BIRTHDAY VIVAN!'; c.font = '190px "Lilita One", Impact, sans-serif';
    const total = c.measureText(text).width, sc = Math.min(1, (w - 120) / total); c.font = `${Math.floor(190 * sc)}px "Lilita One", Impact, sans-serif`;
    let x = w / 2 - c.measureText(text).width / 2; const cols = ['#ff3d8f', '#ff8a1f', '#f5b800', '#38c43a', '#1e9bff', '#8b5bff'];
    [...text].forEach((ch, i) => { const cw = c.measureText(ch).width; const y = h / 2 + 10 + Math.sin(i * .9) * 16;
      if (ch !== ' ') { c.lineWidth = 26; c.strokeStyle = '#ffffff'; c.strokeText(ch, x + cw / 2, y); c.lineWidth = 8; c.strokeStyle = 'rgba(40,10,60,.55)'; c.strokeText(ch, x + cw / 2, y); c.fillStyle = cols[i % cols.length]; c.fillText(ch, x + cw / 2, y); }
      x += cw; });
  });
  const BW = 4.9, BH = 1.12;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH, 32, 4), new THREE.MeshStandardMaterial({ map: banT, roughness: .8, side: THREE.DoubleSide }));
  cloth.position.set(0, 3.15, BZ); cloth.castShadow = true; lobbyG.add(cloth); lobby.cloth = cloth; lobby.clothBase = Float32Array.from(cloth.geometry.attributes.position.array);
  bunting(lobbyG, V(PX[0], 2.45, BZ + .02), V(PX[1], 2.45, BZ + .02), .5, 18);
  PX.forEach((x, k) => { for (let i = 0; i < 3; i++) balloon(lobbyG, x + (k ? .05 : -.05), 1.5, BZ + .05, k * 3 + i, .9 + i * .25, 1.15).rotation.set((i - 1) * .25, 0, (k ? 1 : -1) * (.15 + i * .1)); });
  // the party hole: a deep rainbow tunnel going down, ringed with gold and twinkling bulbs
  const holeM = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 } }, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float t; varying vec2 vUv;
      vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
      void main(){ vec2 p = vUv*2.-1.; float r = length(p), a = atan(p.y,p.x);
        float z = 1./(r+.06);                                    // fake depth: the middle is far away
        float seg = floor((a + 3.14159) / 6.28318 * 12.);
        vec3 c = hue(fract(seg / 12. + floor(z * 1.6 - t * 1.2) * .13));
        float ring = smoothstep(.0, .12, fract(z * 1.6 - t * 1.2)) * smoothstep(1., .88, fract(z * 1.6 - t * 1.2));
        c *= .25 + .75 * ring;
        c *= smoothstep(.05, .85, r) * 1.1;                      // the bottom is dark
        float st = step(.992, fract(sin(seg * 91.7 + floor(z * 4. - t * 5.) * 13.1) * 4375.5));
        c += st * smoothstep(.2, .6, r);
        gl_FragColor = vec4(c, 1.); }` });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), holeM); hole.rotation.x = -Math.PI / 2; hole.position.set(0, .02, 0); lobbyG.add(hole); lobby.hole = holeM;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, .07, 10, 56), goldM); rim.rotation.x = Math.PI / 2; rim.position.set(0, .03, 0); lobbyG.add(rim);
  const bulbG = new THREE.SphereGeometry(.045, 10, 8);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, m = new THREE.Mesh(bulbG, new THREE.MeshStandardMaterial({ color: PARTY_COLS[i % 7], emissive: PARTY_COLS[i % 7], emissiveIntensity: 1 })); m.position.set(Math.cos(a) * 1.12, .1, Math.sin(a) * 1.12); lobbyG.add(m); lobby.bulbs.push(m); }
  balloon(lobbyG, -1.45, .05, -.6, 4, 1.2, 1.2); balloon(lobbyG, 1.45, .05, -.6, 0, 1.45, 1.1); balloon(lobbyG, -1.5, .05, .1, 2, 1.0, 1.1); balloon(lobbyG, 1.5, .05, .1, 5, 1.1, 1.15);
}

/* ======================= THE PARTY ISLAND ======================= */
const party = { tube: null, tubeT: null, board: null, boardCtx: null, gun: null, barrel: null, muzzle: V(), lights: [], portals: [], stand: null };
{
  const g = new THREE.Group(); partyG.add(g);
  // floor: pastel party tiles
  const floorT = canvasTex(256, 256, (c, w, h) => {
    const cols = ['#ffe6f2', '#e9f0ff', '#fff3d6', '#e8fbe9'];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = cols[(i + j * 2) % 4]; c.fillRect(i * 128, j * 128, 128, 128); }
    for (let i = 0; i < 120; i++) { c.fillStyle = '#' + new THREE.Color(PARTY_COLS[i % 7]).getHexString(); c.globalAlpha = .28; c.save(); c.translate(Math.random() * w, Math.random() * h); c.rotate(Math.random() * 6); c.fillRect(-4, -1.5, 8, 3); c.restore(); }
    c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4; c.strokeRect(0, 0, 128, 128); c.strokeRect(128, 128, 128, 128); c.strokeRect(128, 0, 128, 128); c.strokeRect(0, 128, 128, 128);
  }, [12, 16]);
  const top = new THREE.MeshStandardMaterial({ map: floorT, roughness: .55, envMap: ENV, envMapIntensity: .25 }), side = smat(0xff9ec7, { roughness: .7 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 32), [side, side, top, side, side, side]); plate.position.set(0, -.5, -5); plate.receiveShadow = true; g.add(plate);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(21, 4, 9, 6, 2), smat(0xc97aa8, { flatShading: true, roughness: 1 })); under.position.set(0, -5.5, -5); under.scale.z = 1.3; g.add(under);
  const trimT = canvasTex(128, 32, (c, w, h) => { PARTY_COLS.forEach((col, i) => { c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(i * w / 7, 0, w / 7 + 1, h); }); }, [24, 1]);
  const trimM = new THREE.MeshStandardMaterial({ map: trimT, roughness: .5 });
  [[0, 11, 24.3, 0], [0, -21, 24.3, 0], [12, -5, 32.3, Math.PI / 2], [-12, -5, 32.3, Math.PI / 2]].forEach(([x, z, w, r]) => { const m = part(new THREE.BoxGeometry(w, .08, .24), trimM, x, .04, z, g); m.rotation.y = r; });
  addCol({ t: 0, x: PW.x, y: -.5, z: PW.z - 5, hx: 12, hy: .5, hz: 16, tag: 'wood' });
  // low glass-ish railing so nobody walks off the edge by accident (there's a gap at the back for the brave)
  const railM = smat(0xffffff, { roughness: .3 });
  [[0, 11.0, 24, 0], [0, -21.0, 24, 0], [12, -5, 32, Math.PI / 2], [-12, -5, 32, Math.PI / 2]].forEach(([x, z, w, r]) => {
    const m = part(new THREE.BoxGeometry(w, .06, .06), railM, x, .55, z, g); m.rotation.y = r;
    const cs = Math.cos(r), sn = Math.sin(r); for (let k = -w / 2; k <= w / 2 + .01; k += 2) part(new THREE.CylinderGeometry(.03, .03, .55, 6), railM, x + cs * k, .275, z - sn * k, g);
    addCol({ t: 0, x: PW.x + x, y: .5, z: PW.z + z, hx: r ? .1 : w / 2, hy: .5, hz: r ? w / 2 : .1, tag: 'wood' });
  });
  // the landing pad, with a star target
  const padT = canvasTex(256, 256, (c, w, h) => {
    const gr = c.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#fff4b0'); gr.addColorStop(.7, '#ffd25a'); gr.addColorStop(.72, '#ff4fa8'); gr.addColorStop(.85, '#ff4fa8'); gr.addColorStop(.87, '#ffffff'); gr.addColorStop(1, '#ffffff');
    c.fillStyle = gr; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill();
    c.fillStyle = '#ff4fa8'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 30 : 72, a = i / 10 * Math.PI * 2 - Math.PI / 2; c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } c.fill();
  });
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), new THREE.MeshStandardMaterial({ map: padT, transparent: true, roughness: .5, polygonOffset: true, polygonOffsetFactor: -2 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(P_LAND.x, .012, P_LAND.z); g.add(pad);
  // the stand spot at the cutting station
  const standT = canvasTex(256, 256, (c, w, h) => { c.strokeStyle = '#ffffff'; c.lineWidth = 14; c.setLineDash([22, 14]); c.beginPath(); c.arc(128, 128, 112, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,79,168,.85)'; c.beginPath(); c.arc(128, 128, 96, 0, 7); c.fill(); c.font = '44px "Lilita One", Impact'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('STAND', 128, 118); c.fillText('HERE ⚔️', 128, 166); });
  const stand = new THREE.Mesh(new THREE.CircleGeometry(.5, 32), new THREE.MeshStandardMaterial({ map: standT, transparent: true, roughness: .6, polygonOffset: true, polygonOffsetFactor: -2 })); stand.rotation.x = -Math.PI / 2; stand.position.set(P_STAND.x, .013, P_STAND.z); g.add(stand); party.stand = stand;
  // dotted lane from the blaster to you
  for (let z = -8.2; z < -.8; z += .6) { const d = new THREE.Mesh(new THREE.CircleGeometry(.07, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, polygonOffset: true, polygonOffsetFactor: -2 })); d.rotation.x = -Math.PI / 2; d.position.set(0, .012, z); g.add(d); }

  /* ---- the rainbow tube you float down ---- */
  party.tubeT = canvasTex(512, 256, (c, w, h) => {
    const cols = ['#ff4fa8', '#ff8a3d', '#ffd25a', '#5fd94a', '#3fb2ff', '#8b6bff'];
    c.fillStyle = cols[5]; c.fillRect(0, 0, w, h);
    for (let i = -6; i < 14; i++) { c.fillStyle = cols[(i + 12) % 6]; c.beginPath(); const x = i * w / 12; c.moveTo(x, 0); c.lineTo(x + w / 12 + 1, 0); c.lineTo(x + w / 12 + 1 + h * .5, h); c.lineTo(x + h * .5, h); c.fill(); }
    for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 5; for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * .45 : r, a = k / 10 * Math.PI * 2; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); }
  }, [2, 3]);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 13, 32, 1, true), new THREE.MeshBasicMaterial({ map: party.tubeT, side: THREE.DoubleSide, fog: false }));
  tube.position.set(P_LAND.x, 3.3 + 6.5, P_LAND.z); g.add(tube); party.tube = tube;
  [3.3, 16.3].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.72, .09, 10, 48), new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .25, envMap: ENV })); r.rotation.x = Math.PI / 2; r.position.set(P_LAND.x, y, P_LAND.z); g.add(r); });
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, m = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), new THREE.MeshStandardMaterial({ color: PARTY_COLS[i % 7], emissive: PARTY_COLS[i % 7], emissiveIntensity: 1 })); m.position.set(P_LAND.x + Math.cos(a) * 1.72, 3.2, P_LAND.z + Math.sin(a) * 1.72); g.add(m); party.lights.push(m); }
  // 4 striped legs hold the tube up
  const poleT = canvasTex(64, 256, (c, w, h) => { for (let y = 0; y < h; y += 32) { c.fillStyle = (y / 32) % 2 ? '#ffffff' : '#3fb2ff'; c.save(); c.translate(0, y); c.transform(1, -.5, 0, 1, 0, 0); c.fillRect(0, 0, w, 32); c.restore(); } }, [1, 5]);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4, x = P_LAND.x + Math.cos(a) * 1.8, z = P_LAND.z + Math.sin(a) * 1.8; part(new THREE.CylinderGeometry(.06, .07, 3.3, 10), new THREE.MeshStandardMaterial({ map: poleT, roughness: .4 }), x, 1.65, z, g); addCol({ t: 1, x: PW.x + x, z: PW.z + z, cy: 1.65, hy: 1.65, r: .08, tag: 'wood' }); }

  /* ---- gift table (your hat + blower wait here if you didn't catch them) ---- */
  const cloth = smat(0xff9ec7, { roughness: .8 }), white = smat(0xffffff, { roughness: .5 }), goldM = new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .25, envMap: ENV });
  part(new THREE.CylinderGeometry(.38, .38, .04, 28), white, P_TABLE.x, .45, P_TABLE.z, g); part(new THREE.CylinderGeometry(.4, .44, .26, 28, 1, true), cloth, P_TABLE.x, .34, P_TABLE.z, g);
  part(new THREE.CylinderGeometry(.04, .05, .45, 10), goldM, P_TABLE.x, .225, P_TABLE.z, g); part(new THREE.CylinderGeometry(.2, .22, .03, 20), goldM, P_TABLE.x, .015, P_TABLE.z, g);
  addCol({ t: 1, x: PW.x + P_TABLE.x, z: PW.z + P_TABLE.z, cy: .235, hy: .235, r: .4, tag: 'wood' });
  signBoard(g, P_TABLE.x, .86, P_TABLE.z - .32, 0, .62, .2, [['🎉 PARTY GEAR', 120, '#ff4fa8', 256]], 'rgba(255,255,255,.96)', '#ffd25a', false);
  part(new THREE.CylinderGeometry(.015, .015, .4, 6), goldM, P_TABLE.x - .25, .66, P_TABLE.z - .34, g); part(new THREE.CylinderGeometry(.015, .015, .4, 6), goldM, P_TABLE.x + .25, .66, P_TABLE.z - .34, g);

  /* ---- sword table + START + scoreboard ---- */
  const tc = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#ff7fbf'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.6)'; for (let x = 0; x < w; x += 24) for (let y = 0; y < h; y += 24) { c.beginPath(); c.arc(x + ((y / 24) % 2) * 12, y, 5, 0, 7); c.fill(); } });
  const tclM = new THREE.MeshStandardMaterial({ map: tc, roughness: .85 });
  part(new THREE.BoxGeometry(.98, .04, .38), white, P_SWORD.x, .4, P_SWORD.z, g); part(new THREE.BoxGeometry(1.0, .2, .4), tclM, P_SWORD.x, .3, P_SWORD.z, g);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => part(new THREE.CylinderGeometry(.025, .025, .38, 8), goldM, P_SWORD.x + sx * .44, .19, P_SWORD.z + sz * .15, g));
  addCol({ t: 0, x: PW.x + P_SWORD.x, y: .21, z: PW.z + P_SWORD.z, hx: .5, hy: .21, hz: .2, tag: 'wood' });
  signBoard(g, P_SWORD.x, .82, P_SWORD.z + .22, 0, .66, .2, [['⚔️ GRAB ME!', 130, '#3fb2ff', 256]], 'rgba(255,255,255,.96)', '#ff4fa8', false);
  [-.3, .3].forEach(x => part(new THREE.CylinderGeometry(.012, .012, .36, 6), goldM, P_SWORD.x + x, .6, P_SWORD.z + .2, g));
  // the scoreboard: a big screen up above the CUBE BLASTER, so you can see it while you slice
  const bg = new THREE.Group(); bg.position.copy(P_BOARD); g.add(bg);
  const BW = 3.3, BH = BW * 448 / 768, BY = 4.05;
  part(new THREE.BoxGeometry(BW + .16, BH + .16, .12), smat(0x2b2140, { roughness: .4 }), 0, BY, -.07, bg);
  [-1, 1].forEach(s => { part(new THREE.CylinderGeometry(.06, .07, BY, 12), goldM, s * (BW / 2 - .2), BY / 2, -.12, bg); addCol({ t: 1, x: PW.x + P_BOARD.x + s * (BW / 2 - .2), z: PW.z + P_BOARD.z - .12, cy: BY / 2, hy: BY / 2, r: .08, tag: 'wood' }); });
  const bc = document.createElement('canvas'); bc.width = 768; bc.height = 448; party.boardCtx = bc.getContext('2d'); party.board = new THREE.CanvasTexture(bc); party.board.colorSpace = THREE.SRGBColorSpace; party.board.anisotropy = 4;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: party.board, toneMapped: false, fog: false })); scr.position.set(0, BY, 0); bg.add(scr);
  for (let i = 0; i < 26; i++) { const x = -BW / 2 - .02 + i / 25 * (BW + .04); [1, -1].forEach(sy => { const m = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), new THREE.MeshStandardMaterial({ color: PARTY_COLS[i % 7], emissive: PARTY_COLS[i % 7], emissiveIntensity: 1 })); m.position.set(x, BY + sy * (BH / 2 + .1), .02); bg.add(m); party.lights.push(m); }); }
  // the Claude corner
  const rug = new THREE.Mesh(new THREE.CircleGeometry(.7, 36), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (c, w, h) => { for (let r = 128; r > 0; r -= 16) { c.fillStyle = (r / 16) % 2 ? '#d97757' : '#f3e3c8'; c.beginPath(); c.arc(128, 128, r, 0, 7); c.fill(); } }), roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(P_CLAUDE.x, .012, P_CLAUDE.z); g.add(rug);
  signBoard(g, P_CLAUDE.x - .55, 1.35, P_CLAUDE.z - .55, .6, .95, .46, [['🤖 ASK CLAUDE!', 118, '#d97757', 170], ['questions? just talk 🎤', 74, '#2b2140', 330]], 'rgba(255,255,255,.97)', '#d97757');
  addCol({ t: 1, x: PW.x + P_CLAUDE.x - .55, z: PW.z + P_CLAUDE.z - .55, cy: .6, hy: .6, r: .07, tag: 'wood' });
  // how-to sign by the stand
  signBoard(g, 2.15, 1.35, -1.15, -1.0, 1.15, .62, [['HOW TO PLAY', 96, '#ff4fa8', 90], ['1. grab the sword ⚔️', 64, '#2b2140', 210], ['2. press START', 64, '#2b2140', 300], ['3. slice the cubes! ✂️', 64, '#2b2140', 390]], 'rgba(255,255,255,.97)', '#3fb2ff');
  { const c = Math.cos(-1.0), sn = Math.sin(-1.0); [-1, 1].forEach(k => addCol({ t: 1, x: PW.x + 2.15 + c * k * .515, z: PW.z - 1.15 - sn * k * .515, cy: .67, hy: .67, r: .05, tag: 'wood' })); }

  /* ---- the CUBE BLASTER: a giant gift box with a cannon ---- */
  const gun = new THREE.Group(); gun.position.copy(P_GUN); g.add(gun); party.gun = gun;
  const boxT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#8b6bff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < w; x += 42) for (let y = 0; y < h; y += 42) { c.beginPath(); c.arc(x + ((y / 42) % 2) * 21, y + 10, 9, 0, 7); c.fill(); } c.fillStyle = '#ffd25a'; c.fillRect(w / 2 - 22, 0, 44, h); });
  const boxM = new THREE.MeshStandardMaterial({ map: boxT, roughness: .45 });
  part(new THREE.BoxGeometry(2.6, .5, 2.6), smat(0xffffff, { roughness: .5 }), 0, .25, 0, gun);
  part(new THREE.BoxGeometry(1.6, 1.4, 1.6), boxM, 0, 1.2, 0, gun);
  part(new THREE.BoxGeometry(1.64, .16, .3), smat(0xffd25a, { roughness: .35, metalness: .2 }), 0, 1.92, 0, gun);
  [-1, 1].forEach(s => { const lp = part(new THREE.TorusGeometry(.26, .07, 10, 24), smat(0xffd25a, { roughness: .35 }), s * .26, 2.13, 0, gun); lp.rotation.set(0, Math.PI / 2, s * .5); lp.scale.set(1, .7, 1); });
  const barrel = new THREE.Group(); barrel.position.set(0, 1.35, .7); gun.add(barrel); party.barrel = barrel;
  const bm = new THREE.MeshStandardMaterial({ color: 0xff4fa8, roughness: .3, metalness: .3, envMap: ENV, envMapIntensity: .6 });
  const tubeM = part(new THREE.CylinderGeometry(.24, .3, 1.0, 24), bm, 0, 0, .5, barrel); tubeM.rotation.x = Math.PI / 2;
  const lip = part(new THREE.TorusGeometry(.25, .05, 10, 28), new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .25, envMap: ENV }), 0, 0, 1.0, barrel);
  const inner = part(new THREE.CircleGeometry(.22, 24), new THREE.MeshBasicMaterial({ color: 0x1a0d26 }), 0, 0, .99, barrel);
  barrel.rotation.x = -.18;   // aims a little up so cubes arc
  barrel.updateMatrixWorld(true);
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), new THREE.MeshStandardMaterial({ color: PARTY_COLS[i], emissive: PARTY_COLS[i], emissiveIntensity: 1 })); m.position.set(-.6 + i * .2, .65, .81); gun.add(m); party.lights.push(m); }
  signBoard(gun, 0, .26, 1.33, 0, 1.5, .34, [['💥 CUBE BLASTER 3000', 150, '#8b6bff', 256]], 'rgba(255,255,255,.97)', '#ff4fa8', false);
  addCol({ t: 0, x: PW.x + P_GUN.x, y: 1, z: PW.z + P_GUN.z, hx: 1.3, hy: 1, hz: 1.3, tag: 'wood' });

  /* ---- the CAKE ROOM ---- */
  const RX0 = 6.5, RX1 = 14 - 2.2, RZ0 = -8.6, RZ1 = 1.4, WH = 2.6, DOOR = [-4.4, -2.6];
  const wallT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ffe3ef'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffcfe3'; for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 28, h); c.fillStyle = 'rgba(255,210,90,.8)'; for (let x = 46; x < w; x += 64) for (let y = 16; y < h; y += 48) { c.beginPath(); c.arc(x, y + (x % 128 ? 24 : 0), 6, 0, 7); c.fill(); } }, [1, 1]);
  const wallM = side => { const t = wallT.clone(); t.needsUpdate = true; t.repeat.set(side / 1.2, WH / 1.2); return new THREE.MeshStandardMaterial({ map: t, roughness: .8, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .45 }); };
  const outM = smat(0xfff7fb, { roughness: .6 });
  const wall = (x0, z0, x1, z1) => {   // a wall from (x0,z0) to (x1,z1), wallpaper on both sides, colliders for you and for cake crumbs
    const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, yaw = Math.atan2(z1 - z0, x1 - x0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, WH, .14), [outM, outM, smat(0xff9ec7), outM, wallM(len), wallM(len)]); m.position.set(cx, WH / 2, cz); m.rotation.y = -yaw; m.castShadow = m.receiveShadow = true; g.add(m);
    part(new THREE.BoxGeometry(len + .02, .12, .2), new THREE.MeshStandardMaterial({ map: trimT, roughness: .5 }), cx, WH, cz, g).rotation.y = -yaw;
    addCol({ t: 0, x: PW.x + cx, y: WH / 2, z: PW.z + cz, hx: len / 2, hy: WH / 2, hz: .08, yaw: -yaw, tag: 'wood' });
    PT.walls = PT.walls || []; PT.walls.push([cx, cz, len, -yaw]);
  };
  wall(RX0, RZ0, RX1, RZ0); wall(RX0, RZ1, RX1, RZ1); wall(RX1, RZ0, RX1, RZ1);
  wall(RX0, RZ0, RX0, DOOR[0]); wall(RX0, DOOR[1], RX0, RZ1);
  // door arch with a sign + balloons
  part(new THREE.BoxGeometry(.2, .3, DOOR[1] - DOOR[0] + .3), smat(0xff4fa8, { roughness: .5 }), RX0, WH - .15, (DOOR[0] + DOOR[1]) / 2, g);
  signBoard(g, RX0 - .1, WH + .38, (DOOR[0] + DOOR[1]) / 2, -Math.PI / 2, 1.7, .5, [['🎂 CAKE ROOM', 150, '#ff4fa8', 256]], 'rgba(255,255,255,.98)', '#ffd25a', false);
  [DOOR[0] - .25, DOOR[1] + .25].forEach((z, k) => { for (let i = 0; i < 3; i++) balloon(g, RX0 - .2, .05, z + (i - 1) * .12, k * 2 + i + 1, 1.5 + i * .3, 1.1); });
  // floor rug inside
  const rugT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#fff1c9'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff9ec7'; c.lineWidth = 16; c.strokeRect(12, 12, w - 24, h - 24); c.fillStyle = 'rgba(255,79,168,.25)'; for (let i = 0; i < 9; i++) { const x = 64 + (i % 3) * 64, y = 64 + Math.floor(i / 3) * 64; c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 9 : 22, a = k / 10 * Math.PI * 2 - Math.PI / 2; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.fill(); } });
  const rm = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.4), new THREE.MeshStandardMaterial({ map: rugT, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 })); rm.rotation.x = -Math.PI / 2; rm.position.set(P_CAKE.x, .012, P_CAKE.z + .4); g.add(rm);
  // the cake table: a round table with a gold cake stand
  part(new THREE.CylinderGeometry(.82, .82, .05, 40), white, P_CAKE.x, .1, P_CAKE.z, g);
  part(new THREE.CylinderGeometry(.84, .9, .1, 40, 1, true), cloth, P_CAKE.x, .06, P_CAKE.z, g);
  part(new THREE.CylinderGeometry(.62, .55, .06, 40), goldM, P_CAKE.x, PLATTER - .03, P_CAKE.z, g);
  part(new THREE.CylinderGeometry(.12, .2, .05, 20), goldM, P_CAKE.x, .14, P_CAKE.z, g);
  addCol({ t: 1, x: PW.x + P_CAKE.x, z: PW.z + P_CAKE.z, cy: .1, hy: .1, r: .86, tag: 'wood' });
  // a big birthday sign on the back wall
  signBoard(g, RX1 - .1, 1.75, P_CAKE.z, -Math.PI / 2, 2.6, .8, [['🎉 HAPPY BIRTHDAY 🎉', 104, '#ff4fa8', 150], ['VIVAN!', 190, '#3fb2ff', 360]], 'rgba(255,255,255,.98)', '#ff4fa8', false);
  signBoard(g, P_CAKE.x - 1.4, 1.05, P_CAKE.z + 1.75, Math.PI - .5, .9, .42, [['SLICE ✂️ GRAB 🐾', 92, '#ff4fa8', 170], ['then EAT! 😋', 92, '#8b6bff', 340]], 'rgba(255,255,255,.97)', '#ffd25a');
  addCol({ t: 1, x: PW.x + P_CAKE.x - 1.4, z: PW.z + P_CAKE.z + 1.75, cy: .5, hy: .5, r: .07, tag: 'wood' });
  // corners: balloon bunches, bunting across the room
  [[RX0 + .4, RZ0 + .4], [RX1 - .4, RZ0 + .4], [RX1 - .4, RZ1 - .4], [RX0 + .4, RZ1 - .4]].forEach(([x, z], k) => { for (let i = 0; i < 4; i++) balloon(g, x, .05, z, k + i, 1.3 + i * .22, 1.2).rotation.set((i % 2 - .5) * .3, i, (i - 1.5) * .12); });
  bunting(g, V(RX0, WH - .05, RZ0), V(RX1, WH - .05, RZ1), .7, 26); bunting(g, V(RX0, WH - .05, RZ1), V(RX1, WH - .05, RZ0), .7, 26);
  bunting(g, V(-2.9, 2.4, .5), V(3.3, 2.4, .5), .5, 22);
  // poles for the station bunting
  [-2.9, 3.3].forEach(x => { part(new THREE.CylinderGeometry(.05, .06, 2.45, 10), new THREE.MeshStandardMaterial({ map: poleT, roughness: .4 }), x, 1.22, .5, g); addCol({ t: 1, x: PW.x + x, z: PW.z + .5, cy: 1.2, hy: 1.2, r: .07, tag: 'wood' }); });
  // balloons all round the edge of the island
  for (let i = 0; i < 16; i++) { const t = i / 16; const x = -11.4 + (i % 2) * 22.8, z = 10.4 - Math.floor(i / 2) * 3.9; if (x > 6 && z < 1.6 && z > -9) continue; balloon(g, x, .55, z, i, 1.0 + (i % 3) * .3, 1.25); }
  mergeStatic(g, c => c === party.tube || c === party.gun || party.lights.includes(c) || c === party.stand || PT.balloons.some(b => b.g === c));
}

/* ======================= portals home ======================= */
party.portals.push(makePortal(V(0, 0, 9.4), 0, 'BACK TO THE LOBBY 🌳', 0x6fdc4f, 0xffd25a));
party.portals.push(makePortal(V(11.1, 0, -.3), -Math.PI / 2 - .5, 'BACK TO THE LOBBY 🌳', 0x6fdc4f, 0xff4fa8));
party.portals.forEach(P => { partyG.add(P.g); partyG.updateMatrixWorld(true); const wp = V(); P.g.getWorldPosition(wp); addCol({ t: 1, x: wp.x, z: wp.z, cy: .06, hy: .06, r: 1.1, tag: 'rock' }); });

/* ======================= party hat + party blower ======================= */
const hatT = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#ff4fa8'; c.fillRect(0, 0, w, h);
  const cols = ['#ffd25a', '#3fb2ff', '#5fd94a', '#ffffff'];
  for (let i = -4; i < 12; i++) { c.fillStyle = cols[(i + 8) % 4]; c.save(); c.translate(i * 36, 0); c.transform(1, 0, -.6, 1, 0, 0); c.fillRect(0, 0, 14, h); c.restore(); }
  c.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 6, 0, 7); c.fill(); }
});
function makeHat() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.15, 28, 1, true), new THREE.MeshStandardMaterial({ map: hatT, roughness: .5, side: THREE.DoubleSide })); cone.position.y = .575; g.add(cone);
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(.15, 1), new THREE.MeshStandardMaterial({ color: 0xffd25a, roughness: .9, flatShading: true })); pom.position.y = 1.17; g.add(pom);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(.49, .05, 8, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8, flatShading: true })); trim.rotation.x = Math.PI / 2; trim.position.y = .02; g.add(trim);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, f = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 5), new THREE.MeshStandardMaterial({ color: PARTY_COLS[i % 7], roughness: .9, flatShading: true })); f.position.set(Math.cos(a) * .5, .03, Math.sin(a) * .5); g.add(f); }
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}
const BL_N = 16, BL_SEG = .019;
function makeBlower() {   // a mouthpiece + a curled paper tube made of jointed segments
  const g = new THREE.Group();
  const mp = new THREE.Mesh(new THREE.CylinderGeometry(.008, .012, .05, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3 })); mp.rotation.x = Math.PI / 2; mp.position.z = -.025; g.add(mp);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .012, 12), new THREE.MeshStandardMaterial({ color: 0xffd25a, metalness: .6, roughness: .3 })); band.rotation.x = Math.PI / 2; band.position.z = -.052; g.add(band);
  const segG = new THREE.BoxGeometry(.03, .006, BL_SEG + .002); segG.translate(0, 0, -BL_SEG / 2);
  const cols = [0xff4fa8, 0xffd25a, 0x3fb2ff, 0x5fd94a];
  const segs = []; let parent = new THREE.Group(); parent.position.z = -.056; g.add(parent);
  for (let i = 0; i < BL_N; i++) {
    const s = new THREE.Group(); if (i) s.position.z = -BL_SEG; parent.add(s);
    const m = new THREE.Mesh(segG, new THREE.MeshStandardMaterial({ color: cols[Math.floor(i / 2) % 4], roughness: .55, side: THREE.DoubleSide })); m.scale.x = 1 - i * .015; s.add(m);
    segs.push(s); parent = s;
  }
  const tip = new THREE.Group(); tip.position.z = -BL_SEG; parent.add(tip);
  for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(.004, .002, .035), new THREE.MeshStandardMaterial({ color: PARTY_COLS[k], roughness: .6 })); f.position.set((k - 2.5) * .005, 0, -.016); f.rotation.y = (k - 2.5) * .12; tip.add(f); }
  const B = { g, segs, tip }; blowerCurl(B, 0); return B;
}
function blowerCurl(B, u) {   // u 0 = all rolled up, 1 = all the way out
  for (let i = 0; i < BL_N; i++) { const s = clamp((u * (BL_N + 4) - i) / 4, 0, 1); B.segs[i].rotation.x = -(.38 + i * .055) * (1 - s) - Math.sin(tAll * 18 + i) * .02 * u; }
}
const PH = { pickHat: makeHat(), pickBlow: makeBlower(), wornHat: makeHat(), wornBlow: makeBlower(), hatFit: false };
PH.pickHat.scale.setScalar(.22); PH.pickBlow.g.scale.setScalar(1.8);
partyG.add(PH.pickHat, PH.pickBlow.g);
PH.wornHat.traverse(c => { if (c.isMesh) c.layers.set(SELF_LAYER); }); PH.wornHat.visible = false;
camera.add(PH.wornBlow.g); PH.wornBlow.g.position.set(0, -.07, -.075); PH.wornBlow.g.visible = false;
function fitHat() {   // sit the hat on top of the avatar's head, sized to it
  if (PH.hatFit || !AV.ready || !AV.head) return;
  const h = AV.head, p = h.position.clone(), q = h.quaternion.clone(), s = h.scale.clone();
  h.position.set(0, 0, 0); h.quaternion.identity(); h.scale.setScalar(1); h.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(h), c = box.getCenter(V()), sz = box.getSize(V());
  h.position.copy(p); h.quaternion.copy(q); h.scale.copy(s); h.updateMatrixWorld(true);
  const r = Math.min(sz.x, sz.z) * .26; PH.wornHat.scale.setScalar(r / .5); PH.wornHat.position.set(c.x, box.max.y - r * .45, c.z + sz.z * .04); PH.wornHat.rotation.set(-.12, 0, .14);
  h.add(PH.wornHat); PH.hatFit = true;
}
function putOn(what) {
  if (what === 'hat' && PT.hat !== 'worn') { PT.hat = 'worn'; PH.pickHat.visible = false; fitHat(); PH.wornHat.visible = true; partyChime(); toast(state.xr ? '🥳 Party hat ON! (look in a mirror later to see it)' : '🥳 Party hat ON! Press V to see yourself wearing it.', 3.5); }
  if (what === 'blow' && PT.blow !== 'worn') {
    PT.blow = 'worn'; PH.pickBlow.g.visible = false; PH.wornBlow.g.visible = true; partyChime(); micOn();
    toast(state.xr ? '🎺 Party blower ON! Blow or shout into the mic to make it go off! Grab it by your mouth to take it off.' : '🎺 Party blower ON! Blow / shout into the mic (or hold B) to make it go off!', 6);
  }
}
function blowerOff() {
  if (PT.blow !== 'worn') return false;
  PT.blow = 'pick'; PH.wornBlow.g.visible = false; PH.pickBlow.g.visible = true; PT.u = 0; blowSound(0); toast('🙅 Blower off! It is back on the party table (grab it again any time).', 3.5);
  if (ac) tone('sine', 600, 300, .15, .1); return true;
}
function partyChime() { if (ac) [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, .18, .12, i * .06)); }
function blowSound(lvl) {
  if (!ac) return;
  if (!PT.kz) {
    const o = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 330; vib.frequency.value = 7; vg.gain.value = 9; vib.connect(vg); vg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.4; o.connect(f); f.connect(g); g.gain.value = 0; g.connect(master || ac.destination); o.start(); vib.start();
    PT.kz = { o, g };
  }
  const t = ac.currentTime; PT.kz.g.gain.setTargetAtTime(lvl > 0 ? .05 + lvl * .07 : 0, t, .03); PT.kz.o.frequency.setTargetAtTime(300 + PT.u * 180, t, .05);
}
function micRaw() {   // like micLevel() but works when voice chat is muted too (this is just for the blower)
  if (!VC.an) return 0; VC.an.getByteTimeDomainData(VC.buf); let s = 0;
  for (let i = 0; i < VC.buf.length; i += 2) { const x = (VC.buf[i] - 128) / 128; s += x * x; }
  return clamp((Math.sqrt(s / (VC.buf.length / 2)) - .015) * 9, 0, 1);
}
function blowerPop() {   // all the way out: PARP! confetti from the tip
  const w = V(); PH.wornBlow.tip.getWorldPosition(w); confetti(w, state.xr ? 18 : 26);
  if (ac) { tone('square', 520, 880, .12, .08); tone('triangle', 1040, 1400, .2, .08, .05); const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 2500; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); n.connect(f); f.connect(g); g.connect(master || ac.destination); n.start(t); n.stop(t + .3); }
  PT.pops.push(tAll); PT.pops = PT.pops.filter(x => tAll - x < 5);
  if (PT.pops.length >= 5 && !PT.disco) { PT.pops.length = 0; discoOn(); }   // secret
  cakeBlow();
}

/* ======================= the 30 second cube challenge ======================= */
function boardDraw() {
  const C = PT.ch, key = [C.cd > 0 ? Math.ceil(C.cd) : -1, C.on ? Math.ceil(C.t * 10) : -1, C.cnt, C.best, C.showT > 0].join('|'); if (key === PT.ch.lastBoard) return; PT.ch.lastBoard = key;
  const c = party.boardCtx, w = 768, h = 448;
  const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b1a4a'); gr.addColorStop(1, '#1a1030'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#ff4fa8'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
  c.textAlign = 'center'; c.textBaseline = 'middle'; const F = s => `${s}px "Lilita One", Impact, sans-serif`;
  c.font = F(48); c.fillStyle = '#ffd25a'; c.fillText("🎂 VIVAN'S CUBE CHALLENGE", w / 2, 52);
  if (C.cd > 0) { c.font = F(220); c.fillStyle = '#ffffff'; c.fillText(String(Math.ceil(C.cd)), w / 2, 250); c.font = F(46); c.fillStyle = '#3fb2ff'; c.fillText('GET READY!', w / 2, 395); }
  else if (C.on) {
    c.font = F(40); c.fillStyle = '#ff9ec7'; c.fillText('CUBES CUT', w / 4 + 20, 130); c.fillText('TIME', w * .75 - 20, 130);
    c.font = F(170); c.fillStyle = '#5fd94a'; c.fillText(String(C.cnt), w / 4 + 20, 255); c.fillStyle = C.t < 5 ? '#ff5f6d' : '#ffffff'; c.fillText(Math.ceil(C.t).toString(), w * .75 - 20, 255);
    c.fillStyle = '#3a2a5a'; c.fillRect(60, 370, w - 120, 30); c.fillStyle = C.t < 5 ? '#ff5f6d' : '#3fb2ff'; c.fillRect(60, 370, (w - 120) * C.t / 30, 30);
  } else if (C.showT > 0) {
    c.font = F(54); c.fillStyle = '#ffffff'; c.fillText("⏰ TIME'S UP!", w / 2, 130); c.font = F(150); c.fillStyle = '#5fd94a'; c.fillText(C.cnt + ' ✂️', w / 2, 255);
    c.font = F(46); c.fillStyle = C.cnt >= C.best && C.cnt > 0 ? '#ffd25a' : '#ff9ec7'; c.fillText(C.cnt >= C.best && C.cnt > 0 ? '🏆 NEW RECORD! 🏆' : `best: ${C.best}`, w / 2, 380);
  } else {
    c.font = F(60); c.fillStyle = '#ffffff'; c.fillText('Grab the sword ⚔️', w / 2, 150); c.fillText('then press START!', w / 2, 230);
    c.font = F(44); c.fillStyle = '#3fb2ff'; c.fillText('slice as many cubes as you can in 30 s', w / 2, 315);
    c.font = F(48); c.fillStyle = '#ffd25a'; c.fillText(`🏆 best: ${C.best}`, w / 2, 392);
  }
  party.board.needsUpdate = true;
}
function chStart() {
  const C = PT.ch; if (C.cd > 0 || C.on) return;
  if (!AR.ready) { toast('⏳ Hold on, the party is still loading…', 3); return; }
  C.cd = 3; C.cnt = 0; C.showT = 0; PT.lastBeep = 4;
  if (!hands.some(h => h.sword)) toast(state.xr ? '⚔️ Quick! Grab the sword off the pink table!' : '⚔️ Quick! Look at the sword on the pink table and press E!', 4);
  else toast('🎯 Get ready… cubes incoming!', 2.5);
}
function chEnd() {
  const C = PT.ch; C.on = false; C.showT = 8; blowSound(0);
  const rec = C.cnt > C.best; if (rec) { C.best = C.cnt; store.set('kg-party-best', String(C.best)); }
  confetti(pw(P_BOARD.x, 3.4, P_BOARD.z + .4), state.xr ? 50 : 90); confetti(pw(0, 1.4, -.6), state.xr ? 30 : 60);
  if (ac) [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('triangle', f, f, .22, .14, i * .12));
  toast(`⏰ TIME'S UP! You cut ${C.cnt} cube${C.cnt === 1 ? '' : 's'}! ${rec ? '🏆 NEW RECORD!' : '🎉'} Now go find the 🎂 CAKE ROOM!`, 7);
  if (CL.on && PT.inside) clRun(`say Wow, ${C.cnt} cubes! ${rec ? 'A new record! ' : ''}Happy birthday Vivan! The cake room is right over there!`);
}
const _pf = V(), _pq = new THREE.Quaternion();
function chFire() {
  const C = PT.ch, R = AR.R;
  party.barrel.getWorldPosition(_pf); camera.getWorldQuaternion(_pq);
  headWorld(_tA);
  // aim at the player's head: the barrel turns to follow you
  party.gun.updateMatrixWorld(true);
  const mz = V(0, 0, 1.3); party.barrel.localToWorld(mz);
  const fw = V(0, 0, -1).applyQuaternion(_pq).setY(0); if (fw.lengthSq() < .01) fw.set(0, 0, -1); fw.normalize();
  const side = V(-fw.z, 0, fw.x), spread = Math.random() - .5;
  const tgt = V().copy(_tA).addScaledVector(fw, .55).addScaledVector(side, spread * .5); tgt.y = _tA.y - .12 + (Math.random() - .5) * .14;
  const T = 1.55 - Math.min(.35, (30 - C.t) * .012), gs = .42, gE = 9.81 * gs;
  const v = V().subVectors(tgt, mz).multiplyScalar(1 / T); v.y += .5 * gE * T;
  const kind = Math.floor(Math.random() * 5);
  const pc = spawnCube(kind, mz.clone().sub(ARENA), false); if (!pc || !pc.body) return;
  pc.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true); pc.body.setAngvel({ x: (Math.random() - .5) * 4, y: (Math.random() - .5) * 4, z: (Math.random() - .5) * 4 }, true);
  pc.body.setGravityScale(gs, true); pc.body.enableCcd(true);
  pc.ptShot = true; pc.ptT = tAll; PT.shots.push(pc);
  PT.recoil = 1; confetti(mz, state.xr ? 6 : 10, [0xffffff, PARTY_COLS[kind], 0xffd25a]);
  if (ac) { tone('sine', 190, 55, .22, .22); const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); n.connect(f); f.connect(g); g.connect(master || ac.destination); n.start(t); n.stop(t + .3); }
}
const _tA = V();
function stepChallenge(dt) {
  const C = PT.ch;
  if (C.cd > 0) {
    C.cd -= dt; const s = Math.ceil(C.cd);
    if (s !== PT.lastBeep && s > 0) { PT.lastBeep = s; if (ac) tone('square', 660, 660, .12, .1); }
    if (C.cd <= 0) { C.cd = 0; C.on = true; C.t = 30; C.next = .3; if (ac) tone('square', 1320, 1320, .3, .12); toast('✂️ GO GO GO!', 1.5); }
  }
  if (C.on) {
    C.t -= dt; C.next -= dt;
    if (C.next <= 0 && C.t > .6) { chFire(); C.next = 1.35 - (30 - C.t) * .02; }
    if (C.t <= 0) chEnd();
  }
  if (C.showT > 0) C.showT -= dt;
  // which shot cubes got cut? (a cut removes the cube and makes two new pieces)
  for (let i = PT.shots.length - 1; i >= 0; i--) {
    const pc = PT.shots[i];
    if (!pc.body) { PT.shots.splice(i, 1); if (!pc.ptGone && C.on) { C.cnt++; if (ac) tone('triangle', 1200 + Math.min(C.cnt, 30) * 25, 1600 + Math.min(C.cnt, 30) * 25, .1, .08); } continue; }
    const t = pc.body.translation(); if (t.y < -3) pc.ptGone = true;
    if (tAll - pc.ptT > 2.6 && pc.body.gravityScale() < 1) pc.body.setGravityScale(1, true);
    if (tAll - pc.ptT > 9 && !pc.held) { pc.ptGone = true; pc.dying = .3; }
  }
  boardDraw();
  const hud = $('ptHud');
  if (hud) {
    const show = PT.inside && !state.xr && (C.cd > 0 || C.on || C.showT > 0);
    hud.style.display = show ? 'block' : 'none';
    if (show) hud.textContent = C.cd > 0 ? `⏳ ${Math.ceil(C.cd)}…` : C.on ? `✂️ ${C.cnt}   ⏱ ${C.t.toFixed(1)}` : `🎉 ${C.cnt} cubes!${C.cnt >= C.best && C.cnt > 0 ? '  🏆 RECORD' : ''}`;
  }
}

/* ======================= the giant cake + candles ======================= */
const CANDLE_G = new THREE.CylinderGeometry(.011, .011, .11, 10), WICK_G = new THREE.CylinderGeometry(.0015, .0015, .02, 4), FLAME_G = new THREE.SphereGeometry(.014, 10, 8);
const candleT = canvasTex(32, 128, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff4fa8'; for (let y = -32; y < h; y += 24) { c.save(); c.translate(0, y); c.transform(1, .7, 0, 1, 0, 0); c.fillRect(0, 0, w, 10); c.restore(); } });
const flameM = new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }), flameCore = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
function cakeTop() { return PLATTER + CAKE_B + CAKE_T; }
function makeCandles() {
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group(); partyG.add(g);
    const m = new THREE.Mesh(CANDLE_G, new THREE.MeshStandardMaterial({ map: candleT, roughness: .5 })); m.castShadow = true; g.add(m);
    const wk = new THREE.Mesh(WICK_G, mat(0x222222)); wk.position.y = .064; g.add(wk);
    const fl = new THREE.Group(); fl.position.y = .085; g.add(fl);
    const f1 = new THREE.Mesh(FLAME_G, flameM); f1.scale.set(1, 1.9, 1); fl.add(f1); const f2 = new THREE.Mesh(FLAME_G, flameCore); f2.scale.set(.45, .9, .45); f2.position.y = -.004; fl.add(f2);
    PT.candles.push({ g, fl, body: null, lit: true, ph: Math.random() * 6 });
  }
}
makeCandles();
function candlesReset() {
  const R = AR.R, w = AR.world; if (!R) return;
  PT.candles.forEach((c, i) => {
    const a = i / 8 * Math.PI * 2, x = P_CAKE.x + Math.cos(a) * .13, z = P_CAKE.z + Math.sin(a) * .13, y = cakeTop() + .057;
    if (!c.body) { c.body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(PL.x + x, y, PL.z + z).setAngularDamping(.5)); w.createCollider(R.ColliderDesc.cylinder(.055, .011).setDensity(500).setFriction(.8), c.body); }
    c.body.setTranslation({ x: PL.x + x, y, z: PL.z + z }, true); c.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    c.lit = true; c.fl.visible = true;
  });
  PT.cakeOut = false;
}
function newCake(pop) {
  if (!AR.ready) return;
  for (const pc of [...AR.pieces]) if (KINDS[pc.kind].cake || (pc.kind === 10 && pc.body && pc.body.translation().x < PL.x + 40)) removePiece(pc);
  const mk = (kind, y) => { const s = KINDS[kind].size, t = tplFor(s); return makePiece(kind, [{ vis: Float32Array.from(t.vis), phys: Float32Array.from(t.phys) }], s ** 3, pl(P_CAKE.x, y, P_CAKE.z), new THREE.Quaternion(), V(), V(), pop); };
  mk(13, PLATTER + CAKE_B / 2 + .002); mk(14, PLATTER + CAKE_B + CAKE_T / 2 + .004);
  candlesReset();
  if (pop) { confetti(pw(P_CAKE.x, 1.4, P_CAKE.z), state.xr ? 40 : 70); partyChime(); toast('🎂 A brand new cake! Make a wish!', 3); }
}
function cakeBlow() {   // blowing near the cake blows the candles out
  if (!PT.inside || PT.cakeOut) return; headWorld(_tA);
  if (Math.hypot(_tA.x - (PW.x + P_CAKE.x), _tA.z - (PW.z + P_CAKE.z)) > 2.3) return;
  let any = false; PT.candles.forEach((c, i) => { if (c.lit) { any = true; c.lit = false; setTimeout(() => { c.fl.visible = false; const w = V(); c.fl.getWorldPosition(w); confetti(w, 3, [0xdddddd, 0xbbbbbb, 0xffffff]); }, i * 70); } });
  if (!any) return; PT.cakeOut = true;
  setTimeout(() => { confetti(pw(P_CAKE.x, 1.6, P_CAKE.z), state.xr ? 50 : 100); if (ac) [523, 523, 587, 523, 698, 659].forEach((f, i) => tone('triangle', f, f, .3, .14, i * .32)); toast('🕯️✨ You blew out the candles! Make a wish, Vivan! 🎂', 6); if (CL.on) clRun('say Yay! Make a wish, Vivan!'); }, 600);
}
function stepCandles(dt) {
  for (const c of PT.candles) {
    if (!c.body) { c.g.visible = false; continue; }
    c.g.visible = true; const t = c.body.translation(), r = c.body.rotation();
    c.g.position.set(t.x - PL.x, t.y - PL.y, t.z - PL.z); c.g.quaternion.set(r.x, r.y, r.z, r.w);
    if (c.lit) { const up = 1 - 2 * (r.x * r.x + r.z * r.z); if (up < .6 || t.y < .2) { c.lit = false; c.fl.visible = false; } else { const k = 1 + Math.sin(tAll * 23 + c.ph) * .12 + Math.sin(tAll * 37 + c.ph * 2) * .08; c.fl.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); c.fl.rotation.z = Math.sin(tAll * 9 + c.ph) * .08; } }
  }
}

/* ======================= physics for the party (once the yard's Rapier world exists) ======================= */
function partyPhys() {
  const R = AR.R, w = AR.world;
  const fixed = (desc, x, y, z, yaw) => { const b = w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(PL.x + x, PL.y + y, PL.z + z)); if (yaw) { _pq.setFromEuler(new THREE.Euler(0, yaw, 0)); b.setRotation({ x: _pq.x, y: _pq.y, z: _pq.z, w: _pq.w }, false); } w.createCollider(desc.setFriction(.85), b); };
  fixed(R.ColliderDesc.cuboid(12, .5, 16), 0, -.5, -5);
  fixed(R.ColliderDesc.cuboid(.49, .02, .19), P_SWORD.x, .4, P_SWORD.z);
  fixed(R.ColliderDesc.cuboid(.5, .19, .2), P_SWORD.x, .19, P_SWORD.z);
  fixed(R.ColliderDesc.cylinder(.235, .4), P_TABLE.x, .235, P_TABLE.z);
  fixed(R.ColliderDesc.cylinder(PLATTER / 2, .62), P_CAKE.x, PLATTER / 2, P_CAKE.z);
  fixed(R.ColliderDesc.cylinder(.06, .85), P_CAKE.x, .06, P_CAKE.z);
  fixed(R.ColliderDesc.cuboid(1.3, 1, 1.3), P_GUN.x, 1, P_GUN.z);
  (PT.walls || []).forEach(([cx, cz, len, yaw]) => fixed(R.ColliderDesc.cuboid(len / 2, 1.3, .07), cx, 1.3, cz, yaw));
  P_BTNS.forEach(b => { const p = V(); b.g.getWorldPosition(p); p.sub(ARENA); fixed(R.ColliderDesc.cuboid(.16, .165, .16), p.x - PL.x, .165, p.z - PL.z, b.g.rotation.y); });
  PT.phys = true;
}
function swordToParty() {   // the sword lies on the pink table, ready to grab
  if (!AR.ready) return;
  if (sword.held) { sword.held.sword = false; sword.held = null; }
  if (sword.body) { AR.world.removeRigidBody(sword.body); sword.body = null; }
  const R = AR.R, p = pl(P_SWORD.x - .32, .47, P_SWORD.z - .02), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)));
  sword.g.position.copy(p); sword.g.quaternion.copy(q); sword.mode = 'free'; AR.bladeOk = false;
  const b = AR.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCcdEnabled(true).setAngularDamping(.4));
  const add = (desc, x, y, z) => AR.world.createCollider(desc.setTranslation(x, y, z).setFriction(.7).setRestitution(.15).setDensity(2500), b);
  add(R.ColliderDesc.cuboid(.03, .31, .005), 0, .425, 0); add(R.ColliderDesc.cuboid(.135, .013, .015), 0, .1, 0);
  add(R.ColliderDesc.cylinder(.085, .019), 0, 0, 0); add(R.ColliderDesc.ball(.029), 0, -.115, 0);
  sword.body = b;
}

/* ======================= buttons ======================= */
const B_START = partyButton(partyG, P_START, 0, 'START ▶', 0x36e06a, '#5dff8f', () => chStart());
const B_OFF = partyButton(partyG, P_OFF, 0, 'BLOWER OFF', 0x3fb2ff, '#8fd0ff', () => { if (!blowerOff()) toast('🎺 You are not wearing the blower. Grab it from the party table!', 3); });
const B_CAKE = partyButton(partyG, P_NEWCAKE, Math.PI * .75, 'NEW CAKE', 0xff4fa8, '#ff9ec7', () => newCake(true));
// a mic post in the Claude corner (VR: poke it to talk to Claude, same as the one by the spawn)
const P_MIC = (() => {
  const g = new THREE.Group(); g.position.copy(P_CLAUDE).add(V(.75, 0, .35)); partyG.add(g);
  part(new THREE.CylinderGeometry(.02, .025, .9, 8), smat(0xffd25a, { metalness: .6, roughness: .3 }), 0, .45, 0, g);
  const head = part(new THREE.SphereGeometry(.07, 18, 14), new THREE.MeshStandardMaterial({ color: 0x3fb2ff, emissive: 0x3fb2ff, emissiveIntensity: .6, roughness: .3 }), 0, .95, 0, g);
  const grill = part(new THREE.SphereGeometry(.072, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .4 }), 0, .95, 0, g);
  addCol({ t: 1, x: PW.x + g.position.x, z: PW.z + g.position.z, cy: .45, hy: .45, r: .04, tag: 'wood' });
  return { g, head, cool: 0, armed: true };
})();

/* ======================= secret: disco party ======================= */
function discoOn() {
  if (PT.disco) return;
  const g = new THREE.Group(); g.position.set(0, 4.5, -2); partyG.add(g);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .08, flatShading: true, envMap: ENV, envMapIntensity: 1.6 })); g.add(ball);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 3, 4), strMat); str.position.y = 1.9; g.add(str);
  PT.disco = { g, ball, t: 15 };
  toast('🪩 SECRET: PARTY MODE!!! 💃🕺', 4); if (ac) [392, 523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, .15, .07, i * .09));
  if (CL.on) clRun('dance');
}
function stepDisco(dt) {
  const D = PT.disco; if (!D) return;
  D.t -= dt; D.ball.rotation.y += dt * 1.6; D.g.position.y = 2.9 + Math.min(1.6, D.t) * .1 + Math.sin(tAll * 2) * .05;
  PT.balloons.forEach((b, i) => b.b.children[0].material = balMats[(i + Math.floor(tAll * 4)) % balMats.length]);
  if (Math.random() < dt * 6) confetti(pw((Math.random() - .5) * 8, 3.2, -2 + (Math.random() - .5) * 6), 4);
  if (D.t <= 0) { partyG.remove(D.g); PT.disco = null; PT.balloons.forEach(b => b.b.children[0].material = balMats[b.ci % balMats.length]); }
}

/* ======================= in and out ======================= */
function partyEnter() {
  if (PT.inside) return;
  PT.inside = true; PT.fall = true; PT.land = 0; PT.fallT = 0; PT.portalCool = 1.5;
  if (PT.hat !== 'worn') PT.hat = 'float'; if (PT.blow !== 'worn') PT.blow = 'float';
  PH.pickHat.visible = PT.hat !== 'worn'; PH.pickBlow.g.visible = PT.blow !== 'worn';
  arrive(pw(P_LAND.x, 14.5, P_LAND.z + .15), 0, 'arena'); AR.bladeOk = false;
  if (ac) { tone('sine', 1400, 300, 1.1, .12); tone('triangle', 700, 150, 1.1, .06); }
  if (AR.ready) { if (!PT.phys) partyPhys(); swordToParty(); if (!AR.pieces.some(p => KINDS[p.kind].cake)) newCake(false); }
  toast(state.xr ? '🎉 WHEEE! Grab your party hat and blower while you float down! (grip)' : '🎉 WHEEE! Press E to grab your party hat and blower while you float down!', 6);
}
function partyExit() {
  PT.inside = false; PT.fall = false; PT.ch.cd = 0; if (PT.ch.on) { PT.ch.on = false; }
  arrive(V().copy(G_HOLE).addScaledVector(LOB_DIR, 2.6), Math.atan2(-LOB_DIR.x, -LOB_DIR.z), 'grove');
  if (sword.mode !== 'held') swordToStone();
  if (CL.on) { CL.home = null; clSpawnNear(1.6); }
  toast('🌳 Back in the lobby! The party hole is still open, jump back in any time 🎉', 4);
}
function partyRespawn() {   // R / B in the party: back on the landing pad (no fall)
  rig.position.copy(PW).add(P_LAND); rig.position.y += state.bodyH - eyeLocal(_tA).y + .05;
  state.vel.set(0, 0, 0); state.velBuf.length = 0; state.wasStuck = false;
  hands.forEach(h => { h.stuck = false; h.ready = false; });
  if (!state.xr) { state.yaw = 0; state.pitch = 0; rig.rotation.y = 0; }
  AR.snap = true; if (PT.fall) partyLanded();
}
function partyLanded() {
  PT.fall = false; PT.land = 1;
  confetti(pw(P_LAND.x, .3, P_LAND.z), state.xr ? 40 : 80); if (ac) { tone('sine', 140, 60, .25, .25); partyChime(); }
  if (PT.hat === 'float') PT.hat = 'pick'; if (PT.blow === 'float') PT.blow = 'pick';
  setTimeout(() => { if (PT.inside) toast(state.xr ? '🎂 Welcome to the party! Grab the sword at the cutting station, then press START!' : '🎂 Welcome to the party! Walk to the cutting station, press E on the sword, then click START!', 6); }, 2500);
  // Claude waits at the cutting station
  if (!CL.on) clToggle();
  if (CL.on) {
    CL.home = pw(P_CLAUDE.x, 0, P_CLAUDE.z); CL.B.set(CL.home.x, 1.2, CL.home.z); CL.vel.set(0, 0, 0); CL.q = []; CL.cur = null; CL.follow = false; CL.look = 'me';
    setTimeout(() => { if (PT.inside && CL.on) clRun("wave\nsay Happy birthday Vivan! I'm Claude. I'll be right here at the cutting station if you have any questions!"); }, 1200);
  }
}
// hooks the rest of the game calls
function partyGrab(h) {
  if (boothTakeOff(h)) return true;   // costumes come off anywhere, not just at the party
  if (!PT.inside || !h.tracked) return false;
  if (boothGrab(h)) return true;
  const near = (o, r) => { const w = V(); o.getWorldPosition(w); return w.distanceTo(h.pos) < r; };
  if ((PT.hat === 'float' || PT.hat === 'pick') && near(PH.pickHat, .22)) { putOn('hat'); buzz(h, .7, 50); return true; }
  if ((PT.blow === 'float' || PT.blow === 'pick') && near(PH.pickBlow.g, .22)) { putOn('blow'); buzz(h, .7, 50); return true; }
  if (PT.blow === 'worn') { const m = V(); mouthWorld(m); if (m.distanceTo(h.pos) < .16) { blowerOff(); buzz(h, .5, 40); return true; } }
  return false;
}
function partyDesk() {
  if (!PT.inside) return false;
  if (boothDesk()) return true;
  const ok = (o, st) => { if (st !== 'float' && st !== 'pick') return false; const w = V(); o.getWorldPosition(w); headWorld(_tA); return w.distanceTo(_tA) < (st === 'float' ? 3 : 2.2); };
  const a = ok(PH.pickHat, PT.hat), b = ok(PH.pickBlow.g, PT.blow); if (!a && !b) return false;
  if (a) putOn('hat'); if (b) putOn('blow'); return true;
}
function stepPartyPick(dt) {
  // floating next to you on the way down, then waiting on the gift table
  headWorld(_tA); camera.getWorldQuaternion(_pq);
  const fw = V(0, 0, -1).applyQuaternion(_pq).setY(0); if (fw.lengthSq() < .01) fw.set(0, 0, -1); fw.normalize(); const sd = V(-fw.z, 0, fw.x);
  const place = (o, st, s, tx) => {
    if (st === 'float') { const t = V().copy(_tA).addScaledVector(fw, .45).addScaledVector(sd, s * .17).sub(PW); t.y += -.12 + Math.sin(tAll * 2.2 + s) * .025; o.position.copy(t); o.rotation.y += dt * 1.2; }
    else if (st === 'pick') { o.position.lerp(tx, Math.min(1, dt * 4)); o.rotation.y += dt * .8; }
  };
  place(PH.pickHat, PT.hat, -1, V(P_TABLE.x - .14, .48 + Math.sin(tAll * 2) * .01, P_TABLE.z + .03));
  place(PH.pickBlow.g, PT.blow, 1, V(P_TABLE.x + .16, .52 + Math.sin(tAll * 2 + 1) * .01, P_TABLE.z + .05));
  blowerCurl(PH.pickBlow, .15 + Math.sin(tAll * 1.5) * .1);
}
function stepBlower(dt) {
  const B = PH.wornBlow;
  if (PT.blow !== 'worn') { if (PT.blowing) { PT.blowing = false; blowSound(0); } return; }
  B.g.visible = !(state.third && !state.xr);
  const lvl = Math.max(micRaw(), PT.keyB || PT.holdB ? .9 : 0);
  const blowing = lvl > .4;
  const was = PT.u;
  PT.u = blowing ? Math.min(1, PT.u + dt * (2 + lvl * 3)) : Math.max(0, PT.u - dt * 3.2);
  if (blowing && PT.u >= 1 && was < 1) blowerPop();
  if (blowing !== PT.blowing) { PT.blowing = blowing; if (!blowing) blowSound(0); }
  if (blowing) { blowSound(lvl); if (lvl > .55) cakeBlow(); }
  blowerCurl(B, PT.u);
}
function stepLobby(dt) {
  // banner waves in the breeze, the hole swirls, the bulbs twinkle
  if ((state.area || 'grove') !== 'grove') return;
  const pa = lobby.cloth.geometry.attributes.position, b = lobby.clothBase;
  for (let i = 0; i < pa.count; i++) { const x = b[i * 3], y = b[i * 3 + 1]; pa.setZ(i, Math.sin(x * 1.6 + tAll * 2.4) * .06 * (.5 + (x / 2.25) ** 2 * .5) + Math.sin(y * 3 + tAll * 3.1 + x) * .02); }
  pa.needsUpdate = true;
  lobby.hole.uniforms.t.value = tAll;
  lobby.bulbs.forEach((m, i) => m.material.emissiveIntensity = (Math.sin(tAll * 6 - i * .8) > 0) ? 1.3 : .25);
  // jump in!
  if (state.mode !== 'play' || PT.inside) return;
  headWorld(_tA); const feet = _tA.y - state.bodyH;
  if (Math.hypot(_tA.x - G_HOLE.x, _tA.z - G_HOLE.z) < .9 && feet < .45) partyEnter();
}
function partyRing(P) { headWorld(_tA); const l = P.g.worldToLocal(V().copy(_tA)); return Math.abs(l.z) < .32 && Math.hypot(l.x, l.y - 1) < .8; }
function stepParty(dt) {
  for (const b of PT.balloons) { const s = Math.sin(tAll * b.sp + b.ph); b.b.position.set(s * .03, b.b.userData.y0 + Math.sin(tAll * b.sp * 1.3 + b.ph) * .03, 0); b.b.rotation.z = s * .05; }
  stepLobby(dt);
  // left the party some other way (story, horror crash, Battle Royale...)
  if (PT.inside && state.area !== 'arena') { PT.inside = false; PT.fall = false; PT.ch.on = false; PT.ch.cd = 0; if (sword.mode !== 'held' && sword.g.position.x < PL.x + 40) swordToStone(); if (typeof CL !== 'undefined') CL.home = null; }
  partyG.visible = PT.inside;
  const ptb = $('ptOff'), ptw = $('ptBlow'); const showB = PT.inside && !state.xr && state.mode === 'play' && PT.blow === 'worn';
  if (ptb) ptb.style.display = showB ? 'block' : 'none'; if (ptw) ptw.style.display = showB ? 'block' : 'none';
  stepBlower(dt);
  stepBooth(dt);
  stepCoaster(dt);
  if (!PT.inside) { if ($('ptHud')) $('ptHud').style.display = 'none'; return; }
  stepPartyPerf(dt);
  if (AR.ready && !PT.phys) { partyPhys(); swordToParty(); newCake(false); }
  if (PT.fall) {
    state.vel.y = Math.max(state.vel.y, -2.1);   // float down like a balloon
    headWorld(_tA); const dx = PW.x + P_LAND.x - _tA.x, dz = PW.z + P_LAND.z - _tA.z;
    if (Math.hypot(dx, dz) > .7) { rig.position.x += dx * dt * 1.5; rig.position.z += dz * dt * 1.5; }
    party.tubeT.offset.y = (party.tubeT.offset.y + dt * .35) % 1;
    PT.fallT += dt; if (PT.fallT > .5 && (state.grounded || _tA.y - state.bodyH < .08)) partyLanded();
  }
  stepPartyPick(dt);
  party.tube.visible = true;
  party.lights.forEach((m, i) => m.material.emissiveIntensity = (Math.sin(tAll * 5 - i * .7) > 0) ? 1.2 : .25);
  PT.recoil = Math.max(0, PT.recoil - dt * 4); party.barrel.position.z = .7 - PT.recoil * .18; party.barrel.scale.setScalar(1 + PT.recoil * .06);
  { let want = 0; if (PT.ch.on || PT.ch.cd > 0) { headWorld(_tA); want = clamp(Math.atan2(_tA.x - PW.x - P_GUN.x, _tA.z - PW.z - P_GUN.z), -1, 1); } party.gun.rotation.y += (want - party.gun.rotation.y) * Math.min(1, dt * 5); }
  if (state.mode === 'play' && !PT.fall && (PT.portalCool = Math.max(0, PT.portalCool - dt)) <= 0 && party.portals.some(partyRing)) { partyExit(); return; }
  stepChallenge(dt); stepCandles(dt); stepDisco(dt);
  // tidy up: old cube pieces in the party vanish (cake pieces stay so you can eat them)
  if ((PT.cleanT -= dt) <= 0) { PT.cleanT = 1; for (const pc of AR.pieces) { if (!pc.body || pc.held || pc.dying || KINDS[pc.kind].cake || pc.kind === 10) continue; const t = pc.body.translation(); if (t.x < PL.x + 40 && tAll - pc.born > 9) { pc.dying = .3; pc.ptGone = true; } } }
  // the VR mic post in the Claude corner
  P_MIC.cool -= dt; P_MIC.head.material.emissiveIntensity = CL.on && CLM.on ? .9 + Math.sin(tAll * 10) * .3 : .5;
  if (P_MIC.cool <= 0 && (state.xr || sim.on)) {
    const w = V(); P_MIC.head.getWorldPosition(w); let nearH = null; for (const h of hands) if (h.tracked && h.pos.distanceTo(w) < (P_MIC.armed ? .14 : .22)) { nearH = h; break; }
    if (nearH && P_MIC.armed) { P_MIC.armed = false; P_MIC.cool = .4; buzz(nearH, .6, 40); if (!CL.on) clToggle(); clMicToggle(); } else if (!nearH) P_MIC.armed = true;
  }
}

/* ---------- screen buttons: blow + take the blower off, and the challenge HUD ---------- */
{
  const st = document.createElement('style');
  st.textContent = `#ptHud{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:25;display:none;padding:10px 22px;border-radius:18px;background:rgba(43,26,74,.88);color:#fff;font:400 34px "Lilita One",Impact,sans-serif;letter-spacing:1px;border:4px solid #ff4fa8;box-shadow:0 6px 0 rgba(0,0,0,.25)}
  .ptB{position:fixed;right:78px;z-index:20;display:none;border:0;border-radius:16px;padding:10px 14px;font:600 16px Fredoka,system-ui,sans-serif;color:#fff;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none}
  #ptBlow{top:72px;background:#ff4fa8;box-shadow:0 4px 0 #a01f63}#ptOff{top:124px;background:#3fb2ff;box-shadow:0 4px 0 #1b6fa8}`;
  document.head.appendChild(st);
  const hud = document.createElement('div'); hud.id = 'ptHud'; document.body.appendChild(hud);
  const bw = document.createElement('button'); bw.id = 'ptBlow'; bw.className = 'ptB'; bw.textContent = '🎺 Blow (hold B)';
  const on = e => { e.preventDefault(); e.stopPropagation(); PT.holdB = true; }, off = e => { PT.holdB = false; };
  bw.addEventListener('pointerdown', on); bw.addEventListener('pointerup', off); bw.addEventListener('pointerleave', off); bw.addEventListener('pointercancel', off);
  const bo = document.createElement('button'); bo.id = 'ptOff'; bo.className = 'ptB'; bo.textContent = '🙅 Take blower off';
  bo.onclick = e => { e.stopPropagation(); blowerOff(); bo.blur(); };
  document.body.append(bw, bo);
  addEventListener('keydown', e => { if (e.code === 'KeyB' && state.mode === 'play' && !state.xr) PT.keyB = true; });
  addEventListener('keyup', e => { if (e.code === 'KeyB') PT.keyB = false; });
}
boardDraw(); labelFns.push(() => { PT.ch.lastBoard = ''; boardDraw(); });
partyG.visible = false;

window.__kg.party = { PT, PH, PW, PL, party, lobby, partyEnter, partyExit, partyLanded, chStart, chFire, newCake, putOn, blowerOff, blowerPop, cakeBlow, discoOn, B_START, B_OFF, B_CAKE, G_HOLE, P_CAKE, P_SWORD, swordToParty };
