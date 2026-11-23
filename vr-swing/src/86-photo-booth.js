/* ======================= 📸 PARTY PHOTO BOOTH =======================
   At Vivan's party, on the left side of the island. Two prop racks (hats + glasses / funny stuff), a star to
   stand on, a camera on a tripod that turns to follow you, and a BIG screen above the camera.
   Wear props: VR grab one off a rack, PC look at it + E, phone/PC tap it in the booth panel. Grab again = off.
   Press SNAP (button by the star, P key or the panel): 3-2-1, FLASH, and the screen shows your photo with a party
   frame. Every photo also prints a polaroid that flies onto the PHOTO WALL. On PC/phone you can save the photo.
   Head/eye/face props sit on the avatar's head, neck props on the torso (SELF_LAYER: cameras + mirrors see them,
   your own eyes don't), hand props float on your left paw. The outfit is saved ('kg-booth') and goes with you. */
const BO = { fit: false, W: .3, worn: { head: null, eyes: null, face: null, neck: null, hand: null }, inst: {}, anch: {}, snap: null, show: 0, shots: 0, strips: [],
  polas: [], near: false, told: false, frame: 0, look: V(), rack: [], flash: 0, horn: 0, ovKey: '', legend: false };
const B_SPOT = V(-8.2, 0, -3), B_CAM = V(-5.95, 0, -3);
const B_SLOTS = ['head', 'eyes', 'face', 'neck', 'hand'];
const B_PROPS = [
  ['crown', 'head', 'Crown', '👑'], ['tophat', 'head', 'Top hat', '🎩'], ['cowboy', 'head', 'Cowboy hat', '🤠'], ['bunny', 'head', 'Bunny ears', '🐰'], ['flowers', 'head', 'Flower crown', '🌸'],
  ['star', 'eyes', 'Star glasses', '⭐'], ['heart', 'eyes', 'Heart glasses', '💖'], ['shades', 'eyes', 'Cool shades', '😎'], ['nerd', 'eyes', 'Nerd glasses', '🤓'],
  ['stache', 'face', 'Mustache', '🥸'], ['nose', 'face', 'Clown nose', '🔴'], ['horn', 'face', 'Party horn', '🎉'],
  ['bowtie', 'neck', 'Bow tie', '🎀'], ['medal', 'neck', 'Gold medal', '🥇'], ['lei', 'neck', 'Flower lei', '🌺'],
  ['balloon', 'hand', 'Balloon', '🎈'], ['wand', 'hand', 'Magic wand', '🪄'], ['cupcake', 'hand', 'Cupcake', '🧁'], ['plush', 'hand', 'Sprout Bear', '🧸'],
].map(([id, slot, name, emo]) => ({ id, slot, name, emo }));
const BP = Object.fromEntries(B_PROPS.map(p => [p.id, p]));
const boothG = new THREE.Group(); partyG.add(boothG);

/* ---------- prop models: built in "head widths" (1 = your head's width), front = -Z ---------- */
const bm = {
  gold: new THREE.MeshStandardMaterial({ color: 0xffc54a, metalness: 1, roughness: .22, envMap: ENV, envMapIntensity: 1.1 }),
  black: smat(0x1c1626, { roughness: .35 }), white: smat(0xffffff, { roughness: .5 }), pink: smat(0xff4fa8, { roughness: .4 }),
  red: new THREE.MeshStandardMaterial({ color: 0xe8203a, roughness: .25, envMap: ENV, envMapIntensity: .5 }),
  brown: smat(0x8a5428, { roughness: .8 }), darkBrown: smat(0x4a2a14, { roughness: .9 }), leaf: smat(0x4fbf4a, { roughness: .7 }),
  inner: smat(0xffa6c9, { roughness: .8 }), yellow: smat(0xffd25a, { roughness: .5 }),
  shade: new THREE.MeshStandardMaterial({ color: 0x15121e, roughness: .08, metalness: .4, envMap: ENV, envMapIntensity: 1.4 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: .05, transparent: true, opacity: .28, envMap: ENV, envMapIntensity: 1.2, depthWrite: false }),
  pinkGlass: new THREE.MeshStandardMaterial({ color: 0xff6fb8, roughness: .05, transparent: true, opacity: .55, envMap: ENV, depthWrite: false }),
  redGlass: new THREE.MeshStandardMaterial({ color: 0xff2a4a, roughness: .05, transparent: true, opacity: .55, envMap: ENV, depthWrite: false }),
  gemR: new THREE.MeshStandardMaterial({ color: 0xff2a55, roughness: .05, metalness: .2, emissive: 0x550010, envMap: ENV, envMapIntensity: 1.5 }),
  gemB: new THREE.MeshStandardMaterial({ color: 0x3fb2ff, roughness: .05, metalness: .2, emissive: 0x002255, envMap: ENV, envMapIntensity: 1.5 }),
  foam: smat(0xf4eee6, { roughness: .95 }), star: new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffb020, emissiveIntensity: .7, roughness: .3 }),
};
const petalMats = [0xff8fc8, 0xffffff, 0xffd25a, 0xc79bff, 0xff6f6f].map(c => smat(c, { roughness: .6 }));
const dotsT = canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#e8203a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; for (let x = 0; x < w; x += 22) for (let y = 0; y < h; y += 22) { c.beginPath(); c.arc(x + ((y / 22) % 2) * 11 + 6, y + 6, 4.5, 0, 7); c.fill(); } });
bm.dots = new THREE.MeshStandardMaterial({ map: dotsT, roughness: .55 });
const shapePts = (kind, r) => {   // outline points for glasses lenses
  const p = [];
  if (kind === 'star') for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * .5 : r * 1.12; p.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
  else if (kind === 'heart') for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); p.push(new THREE.Vector2(x * r / 15, (y + 2) * r / 15)); }
  else if (kind === 'shades') for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); p.push(new THREE.Vector2(Math.sign(c) * Math.abs(c) ** .45 * r * 1.25, Math.sign(s) * Math.abs(s) ** .55 * r * (s > 0 ? .8 : .95))); }
  else for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; p.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  return p;
};
function glasses(kind, e, frameM, lensM) {   // e = half the distance between the eyes
  const g = new THREE.Group(), r = e * (kind === 'shades' ? .8 : .86), th = kind === 'nerd' ? .2 : .14;
  [-1, 1].forEach(s => {
    const outer = shapePts(kind, r * (1 + th)), inner = shapePts(kind, r);
    const sh = new THREE.Shape(outer); sh.holes.push(new THREE.Path(inner));
    const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .035, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, curveSegments: 6 }), frameM);
    fr.position.set(s * e * 1.08, 0, -.035); g.add(fr);
    lensM.side = THREE.DoubleSide; const ln = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(inner)), lensM); ln.position.set(s * e * 1.08, 0, -.012); g.add(ln);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.025, .03, .55), frameM); arm.position.set(s * (e * 1.08 + r * (1 + th) * (kind === 'shades' ? 1.2 : 1)), r * .25, .25); arm.rotation.y = -s * .12; g.add(arm);
  });
  const br = new THREE.Mesh(new THREE.TorusGeometry(e * .3, .018, 6, 14, Math.PI), frameM); br.position.set(0, r * .2, -.02); g.add(br);
  if (kind === 'nerd') { const tape = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .045), bm.white); tape.position.set(0, r * .22, -.02); g.add(tape); }
  if (kind === 'star') for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.OctahedronGeometry(.022, 0), bm.star); sp.position.set((k - 2.5) * e * .62, r * 1.35 + (k % 2) * .03, -.03); g.add(sp); }
  return g;
}
function flower(g, x, y, z, k, s = 1) {
  const pm = petalMats[k % petalMats.length];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = new THREE.Mesh(new THREE.SphereGeometry(.035 * s, 8, 6), pm); p.scale.set(1, .45, 1); p.position.set(x + Math.cos(a) * .04 * s, y, z + Math.sin(a) * .04 * s); g.add(p); }
  const c = new THREE.Mesh(new THREE.SphereGeometry(.024 * s, 8, 6), bm.yellow); c.position.set(x, y + .01 * s, z); g.add(c);
}
const BUILD = {
  crown() {
    const g = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.27, .25, .13, 32, 1, true), bm.gold); band.material.side = THREE.DoubleSide; band.position.y = .03; g.add(band);
    [-.035, .095].forEach(y => { const t = new THREE.Mesh(new THREE.TorusGeometry(.262 + y * .1, .016, 8, 36), bm.gold); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, x = Math.sin(a) * .26, z = -Math.cos(a) * .26;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(.055, .17, 4), bm.gold); sp.position.set(x, .18, z); sp.rotation.y = -a; g.add(sp);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), bm.gold); ball.position.set(x, .275, z); g.add(ball);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.035, 0), i % 2 ? bm.gemB : bm.gemR); gem.position.set(Math.sin(a) * .275, .035, -Math.cos(a) * .275); gem.scale.set(1, 1.3, .5); gem.rotation.y = -a; g.add(gem);
    }
    g.position.y = -.07; return g;
  },
  tophat() {
    const g = new THREE.Group();
    const lathe = new THREE.LatheGeometry([[0, 0], [.4, 0], [.43, .02], [.4, .04], [.25, .04], [.24, .45], [.26, .5], [0, .5]].map(([x, y]) => new THREE.Vector2(x, y)), 36);
    g.add(new THREE.Mesh(lathe, bm.black));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.247, .246, .09, 36, 1, true), bm.pink); band.position.y = .1; g.add(band);
    flower(g, .1, .12, -.23, 0, 1.3);
    g.rotation.set(-.08, 0, .12); g.position.y = -.08; return g;
  },
  cowboy() {
    const g = new THREE.Group();
    const brim = new THREE.LatheGeometry([[0, .02], [.3, .02], [.45, .05], [.55, .14], [.56, .16], [.53, .15], [.44, .08], [.3, .05], [.24, .06]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
    const b = new THREE.Mesh(brim, bm.brown); b.material.side = THREE.DoubleSide; b.scale.z = .8; g.add(b);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(.26, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), bm.brown); crown.scale.set(1, 1.15, .85); crown.position.y = .05; g.add(crown);
    const dent = new THREE.Mesh(new THREE.BoxGeometry(.03, .08, .3), bm.darkBrown); dent.position.y = .33; g.add(dent);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.262, .262, .055, 28, 1, true), bm.darkBrown); band.scale.z = .85; band.position.y = .09; g.add(band);
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(.04, 0), bm.gold); st.position.set(0, .09, -.225); st.scale.z = .4; g.add(st);
    g.position.y = -.12; g.rotation.x = -.06; return g;
  },
  bunny() {
    const g = new THREE.Group();
    const hb = new THREE.Mesh(new THREE.TorusGeometry(.42, .025, 8, 30, Math.PI), bm.pink); hb.position.y = -.38; g.add(hb);
    [-1, 1].forEach(s => {
      const e = new THREE.Group(); e.position.set(s * .15, .0, 0); e.rotation.z = -s * .22; g.add(e);
      const outer = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 12), bm.white); outer.scale.set(.85, 2.7, .45); outer.position.y = .25; e.add(outer);
      const inn = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), bm.inner); inn.scale.set(.75, 2.6, .3); inn.position.set(0, .24, -.03); e.add(inn);
      if (s > 0) { e.rotation.x = .35; }   // one floppy ear
    });
    const bow = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), bm.pink); bow.position.set(-.23, .02, -.03); g.add(bow);
    return g;
  },
  flowers() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.28, .025, 8, 36), bm.leaf); ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; flower(g, Math.sin(a) * .29, .02, -Math.cos(a) * .29, i, i % 3 ? 1.2 : 1.6); }
    for (let i = 0; i < 10; i++) { const a = (i + .5) / 10 * Math.PI * 2, l = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), bm.leaf); l.scale.set(1.6, .3, .7); l.position.set(Math.sin(a) * .3, 0, -Math.cos(a) * .3); l.rotation.y = -a; g.add(l); }
    g.position.y = -.05; g.rotation.x = -.15; return g;
  },
  star: (e) => glasses('star', e, bm.pink, bm.pinkGlass),
  heart: (e) => glasses('heart', e, bm.red, bm.redGlass),
  shades: (e) => glasses('shades', e, bm.black, bm.shade),
  nerd: (e) => glasses('nerd', e, bm.black, bm.glass),
  stache() {
    const g = new THREE.Group(), pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40, x = (t - .5) * 2; pts.push(new THREE.Vector2(x * .2, .04 - Math.abs(x) ** 1.6 * .03 + (Math.abs(x) > .75 ? (Math.abs(x) - .75) * .25 : 0))); }
    for (let i = 40; i >= 0; i--) { const t = i / 40, x = (t - .5) * 2; pts.push(new THREE.Vector2(x * .2, -.035 + Math.abs(x) ** 1.2 * .035 - (Math.abs(x) < .12 ? .012 : 0))); }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: .03, bevelEnabled: true, bevelSize: .012, bevelThickness: .015, bevelSegments: 3 }), bm.darkBrown); m.position.z = -.03; g.add(m);
    [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.TorusGeometry(.03, .012, 6, 12, Math.PI * 1.4), bm.darkBrown); c.position.set(s * .21, .06, -.015); c.rotation.z = s > 0 ? -.4 : Math.PI + .4; g.add(c); });
    return g;
  },
  nose() { const g = new THREE.Group(); const n = new THREE.Mesh(new THREE.SphereGeometry(.085, 24, 16), bm.red); n.position.z = -.04; g.add(n); const sh = new THREE.Mesh(new THREE.SphereGeometry(.02, 8, 6), bm.white); sh.position.set(-.03, .035, -.11); g.add(sh); return g; },
  horn() { const B = makeBlower(); const g = new THREE.Group(); g.add(B.g); B.g.scale.setScalar(1 / BO.W); B.g.rotation.x = .25; g.userData.B = B; return g; },
  bowtie() {
    const g = new THREE.Group();
    [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.ConeGeometry(.09, .17, 4, 1), bm.dots); w.rotation.set(0, Math.PI / 4, s * Math.PI / 2); w.scale.set(1, 1, .45); w.position.x = s * .085; g.add(w); });
    const k = new THREE.Mesh(new THREE.SphereGeometry(.04, 12, 8), bm.red); k.scale.set(1, 1.1, .7); g.add(k);
    g.position.z = -.02; g.scale.setScalar(1.5); return g;
  },
  medal() {
    const g = new THREE.Group();
    [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, .012), s < 0 ? bm.red : smat(0x3fb2ff, { roughness: .6 })); r.position.set(s * .06, -.1, -.06); r.rotation.set(-.35, 0, s * .38); g.add(r); });
    const d = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .022, 32), bm.gold); d.rotation.x = Math.PI / 2; d.position.set(0, -.27, -.12); g.add(d);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.09, .012, 8, 32), bm.gold); rim.position.set(0, -.27, -.12); g.add(rim);
    const st = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(shapePts('star', .045)), { depth: .01, bevelEnabled: false }), bm.gemR); st.position.set(0, -.27, -.143); g.add(st);
    g.scale.setScalar(1.5); return g;
  },
  lei(r = .5) {
    const g = new THREE.Group();
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, y = -Math.max(0, -Math.cos(a)) * .12; flower(g, Math.sin(a) * r, y, -Math.cos(a) * r, i, 1.35); }
    g.rotation.x = .12; return g;
  },
  // hand props are in metres (they don't scale with your head)
  balloon(len = .55) {
    const g = new THREE.Group();
    const str = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, len, 4), strMat); str.position.y = len / 2; g.add(str);
    const b = new THREE.Mesh(BAL_G, balMats[0]); b.scale.set(1.25, 1.45, 1.25); b.position.y = len + .2; g.add(b);
    const k = new THREE.Mesh(KNOT_G, balMats[0]); k.position.y = len - .02; k.rotation.x = Math.PI; g.add(k);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 })); sh.position.set(-.07, len + .3, -.15); g.add(sh);
    return g;
  },
  wand() {
    const g = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.008, .01, .32, 10), bm.black); st.position.y = .12; g.add(st);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(.0085, .0085, .05, 10), bm.white); tip.position.y = .26; g.add(tip);
    const s = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(shapePts('star', .045)), { depth: .016, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1 }), bm.star); s.position.set(0, .32, -.008); g.add(s);
    for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.OctahedronGeometry(.01, 0), bm.star); sp.position.set(Math.cos(i * 1.6) * .07, .3 + Math.sin(i * 2.3) * .06, 0); g.add(sp); }
    return g;
  },
  plush() { return buildPlush(.25, PLU.bloom); },   // 🧸 in 87-plush.js
  cupcake() {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.055, .04, .055, 16, 1, true), bm.dots); cup.material.side = THREE.DoubleSide; cup.position.y = .03; g.add(cup);
    const cake = new THREE.Mesh(new THREE.CylinderGeometry(.054, .054, .012, 16), smat(0xc98a4a)); cake.position.y = .058; g.add(cake);
    const fm = smat(0xffb3d9, { roughness: .45 });
    [[.05, .07], [.038, .095], [.024, .115]].forEach(([r, y]) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, .02, 8, 18), fm); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); });
    const top = new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), fm); top.position.y = .13; g.add(top);
    const ch = new THREE.Mesh(new THREE.SphereGeometry(.016, 10, 8), bm.red); ch.position.y = .155; g.add(ch);
    for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.012, .004, .004), balMats[i % 7]); sp.position.set(Math.cos(i) * .04, .085 + (i % 3) * .015, Math.sin(i) * .04); sp.rotation.y = i; g.add(sp); }
    return g;
  },
};
function buildProp(id, forRack) {
  const P = BP[id]; let g;
  if (P.slot === 'eyes') g = BUILD[id](BO.e || .2); else if (id === 'lei') g = BUILD.lei(forRack ? .42 : BO.neckR || .5); else if (id === 'balloon') g = BUILD.balloon(forRack ? .3 : .38); else g = BUILD[id]();
  const root = new THREE.Group(); root.add(g);
  if (id !== 'horn') mergeStatic(root);
  root.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
  return root;
}

/* ---------- fitting: find your head's top, eyes, nose, mouth and the front of your neck ---------- */
const _bray = new THREE.Raycaster();
function frontZ(obj, x, y, fallback) {   // where the model's front surface is at (x, y), shooting a ray from the front
  _bray.set(V(x, y, -5), V(0, 0, 1)); _bray.layers.enableAll();
  const meshes = []; obj.traverse(c => { if (c.isMesh && !c.userData.acc) meshes.push(c); });
  const hit = _bray.intersectObjects(meshes, false)[0]; return hit ? hit.point.z : fallback;
}
function atRest(o, fn) { const p = o.position.clone(), q = o.quaternion.clone(), s = o.scale.clone(), par = o.parent; if (par) par.remove(o); o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.setScalar(1); o.updateMatrixWorld(true); try { return fn(); } finally { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); if (par) par.add(o); o.updateMatrixWorld(true); } }
function boxOf(o) { const b = new THREE.Box3(); o.traverse(c => { if (c.isMesh && !c.userData.acc && !(c.parent && c.parent.userData.accRoot)) { c.geometry.computeBoundingBox(); b.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld)); } }); return b; }
function boothFit() {
  if (BO.fit) return true;
  if (!AV.ready || !AV.head || !AV.torso) return false;
  if (PH.wornHat) PH.wornHat.traverse(c => c.userData.acc = true);
  atRest(AV.head, () => {
    const h = AV.head, box = boxOf(h), c = box.getCenter(V()), sz = box.getSize(V());
    BO.W = sz.x;
    const eL = h.getObjectByName('EyeL'), eR = h.getObjectByName('EyeR'), pl = V(), pr = V();
    if (eL && eR) { eL.getWorldPosition(pl); eR.getWorldPosition(pr); } else { pl.set(c.x - sz.x * .17, c.y + sz.y * .05, box.min.z); pr.set(c.x + sz.x * .17, c.y + sz.y * .05, box.min.z); }
    const eyes = V().addVectors(pl, pr).multiplyScalar(.5);
    BO.e = Math.max(.08, pl.distanceTo(pr) / 2 / BO.W);
    const sm = h.getObjectByName('Smile'); let mouth;
    if (sm) { sm.geometry.computeBoundingBox(); mouth = sm.geometry.boundingBox.clone().applyMatrix4(sm.matrixWorld).getCenter(V()); } else mouth = V(eyes.x, eyes.y - sz.y * .2, eyes.z);
    const ez = frontZ(h, eyes.x, eyes.y, box.min.z), mz = frontZ(h, mouth.x, mouth.y, box.min.z);
    const noseP = V().lerpVectors(mouth, eyes, .45), nz = frontZ(h, noseP.x, noseP.y, box.min.z), lip = V().lerpVectors(mouth, eyes, .28), lz = frontZ(h, lip.x, lip.y, box.min.z);
    const mk = (name, p, par) => { const a = new THREE.Group(); a.name = 'booth-' + name; a.userData.accRoot = true; a.position.copy(p); a.scale.setScalar(BO.W); par.add(a); BO.anch[name] = a; };
    // the top of the skull (rays a little off-centre, so a sprout or tuft on top doesn't lift the hat)
    let top = -1e9; _bray.layers.enableAll(); [[.13, 0], [-.13, 0], [0, .1], [0, -.1]].forEach(([dx, dz]) => { _bray.set(V(c.x + dx * sz.x, 5, c.z + dz * sz.z), V(0, -1, 0)); const ms = []; h.traverse(q => { if (q.isMesh && !q.userData.acc) ms.push(q); }); const hit = _bray.intersectObjects(ms, false)[0]; if (hit) top = Math.max(top, hit.point.y); });
    if (top < -1e8) top = box.max.y - sz.y * .1;
    mk('head', V(c.x, top - sz.y * .1, c.z), h);
    mk('eyes', V(eyes.x, eyes.y, Math.min(ez, eyes.z) - .004), h);
    mk('nose', V(noseP.x, noseP.y, nz), h); mk('lip', V(lip.x, lip.y, lz), h); mk('mouth', V(mouth.x, mouth.y, mz), h);
  });
  atRest(AV.torso, () => {
    const t = AV.torso, box = boxOf(t), c = box.getCenter(V()), sz = box.getSize(V()), y = box.max.y - sz.y * .12, fz = frontZ(t, c.x, y, box.min.z);
    BO.neckR = Math.max(.3, Math.abs(c.z - fz) * 1.04 / BO.W);
    // how far the round belly sticks out in front of the neck, every .05 (in head widths) going down: neck props hang over it, not through it
    BO.belly = []; for (let i = 0; i <= 16; i++) BO.belly.push((frontZ(t, c.x, y - i * .05 * BO.W, fz) - fz) / BO.W);
    BO.neckR = Math.max(BO.neckR, (c.z - fz) / BO.W - Math.min(0, BO.belly[2] + BO.belly[3]) / 2 + .06);   // the lei's front dips ~.12 down
    const a = new THREE.Group(); a.userData.accRoot = true; a.position.set(c.x, y, fz); a.scale.setScalar(BO.W); t.add(a); BO.anch.neck = a;
    const b = new THREE.Group(); b.userData.accRoot = true; b.position.set(c.x, y + .01, c.z); b.scale.setScalar(BO.W); t.add(b); BO.anch.neckC = b;
  });
  BO.anch.hand = new THREE.Group(); scene.add(BO.anch.hand);
  BO.fit = true; return true;
}
const ANCHOR_OF = { head: 'head', eyes: 'eyes', stache: 'lip', nose: 'nose', horn: 'mouth', bowtie: 'neck', medal: 'neck', lei: 'neckC', hand: 'hand' };
function wearShow(id, on) {
  if (!boothFit()) return;
  const P = BP[id];
  if (on) {
    let g = BO.inst[id]; if (!g) { g = BO.inst[id] = buildProp(id, false); if (P.slot !== 'hand') g.traverse(c => { if (c.isMesh) c.layers.set(SELF_LAYER); }); }
    const an = BO.anch[ANCHOR_OF[id] || ANCHOR_OF[P.slot]]; an.add(g); g.visible = true;
    if (id === 'medal' || id === 'bowtie') neckFit(id, g);
  } else if (BO.inst[id]) BO.inst[id].removeFromParent();
  if (P.slot === 'head') PH.wornHat.visible = !BO.worn.head && PT.hat === 'worn';
}
// tilt the medal out (and nudge the bow tie forward) until it clears the belly
function bellyAt(dy) { const B = BO.belly; if (!B || !B.length) return 0; const f = Math.min(B.length - 1, Math.max(0, -dy / .05)), i = Math.floor(f), j = Math.min(B.length - 1, i + 1); return B[i] + (B[j] - B[i]) * (f - i); }
function neckFit(id, g) {
  if (!BO.belly) return;
  if (id === 'bowtie') { const need = bellyAt(-.12) - .05 + .045; g.position.z = Math.min(-.02, -.02 + need); return; }
  const pts = [[-.27, -.12], [-.405, -.12], [-.2, -.06]].map(([y, z]) => [y * 1.5, z * 1.5 - .03]);   // disc middle, disc bottom, ribbon (scaled 1.5, minus a bit of thickness)
  let th = 0; for (; th < 1.3; th += .04) { const c = Math.cos(th), sn = Math.sin(th); if (pts.every(([y, z]) => { const y2 = y * c - z * sn, z2 = y * sn + z * c; return z2 <= bellyAt(y2) - .03; })) break; }
  g.rotation.x = th;
}
function wear(id, quiet) {
  const P = BP[id], cur = BO.worn[P.slot];
  if (cur) { wearShow(cur, false); BO.worn[P.slot] = null; }
  if (cur !== id) { BO.worn[P.slot] = id; wearShow(id, true); if (!quiet) { partyChime(); toast(`${P.emo} ${P.name} ON!` + (state.xr ? ' Look at the big screen 📺' : ''), 2.2); } }
  else if (!quiet) { if (ac) tone('sine', 600, 300, .12, .1); toast(`🙅 ${P.name} off`, 1.8); }
  if (P.slot === 'head') wearShow(id, BO.worn.head === id);
  if (id === 'plush' && !quiet) plushWorn(BO.worn.hand === id);
  store.set('kg-booth', JSON.stringify(BO.worn)); boothUiSync();
}
function wearClear() { B_SLOTS.forEach(s => { if (BO.worn[s]) { wearShow(BO.worn[s], false); BO.worn[s] = null; } }); PH.wornHat.visible = PT.hat === 'worn'; store.set('kg-booth', JSON.stringify(BO.worn)); boothUiSync(); toast('🧹 All props off!', 2); if (ac) tone('sine', 700, 250, .2, .1); }

/* ---------- the booth itself ---------- */
const booth = { cam: null, head: null, lens: null, flashM: null, rec: null, live: null, photo: null, ov: null, ovCtx: null, wall: null, slots: [], liveRT: null, photoRT: null };
{
  const g = new THREE.Group(); boothG.add(g);   // still parts (merged at the end)
  // a round pink carpet + the STAND HERE star
  const rugT = canvasTex(512, 512, (c, w, h) => {
    const gr = c.createRadialGradient(256, 256, 30, 256, 256, 256); gr.addColorStop(0, '#ffd6ea'); gr.addColorStop(.9, '#ff9ec7'); gr.addColorStop(.92, '#ffd25a'); gr.addColorStop(.97, '#ffd25a'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(256, 256, 256, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 60; i++) { const a = Math.random() * 7, r = 40 + Math.random() * 180; c.beginPath(); c.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 4, 0, 7); c.fill(); }
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshStandardMaterial({ map: rugT, transparent: true, roughness: .9, polygonOffset: true, polygonOffsetFactor: -1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(B_SPOT.x + .5, .008, B_SPOT.z); rug.receiveShadow = true; g.add(rug);
  const starT = labelTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ffd25a'; c.strokeStyle = '#ffffff'; c.lineWidth = 10; c.beginPath(); shapePts('star', 92).forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](128 + p.x, 128 - p.y)); c.closePath(); c.fill(); c.stroke();
    c.font = '30px "Lilita One", Impact, sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff4fa8'; c.fillText('STAND', 128, 128); c.fillText('HERE', 128, 158);
  });
  const star = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshStandardMaterial({ map: starT, transparent: true, roughness: .5, polygonOffset: true, polygonOffsetFactor: -3 }));
  star.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); star.position.set(B_SPOT.x, .014, B_SPOT.z); g.add(star);

  /* backdrop: a sparkly wall behind you with a balloon arch and velvet curtains */
  const bd = new THREE.Group(); bd.position.set(B_SPOT.x - 1.55, 0, B_SPOT.z); bd.rotation.y = Math.PI / 2; g.add(bd);
  const BW = 3.8, BH = 2.7;
  const bdT = labelTex(1024, 728, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7a3cff'); gr.addColorStop(.55, '#ff4fa8'); gr.addColorStop(1, '#ff9a5a'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(255,255,255,${.08 + Math.random() * .3})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3.5, 0, 7); c.fill(); }   // sequins
    for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = 10 + Math.random() * 18; c.fillStyle = ['#ffd25a', '#ffffff', '#8fe9ff'][i % 3]; c.globalAlpha = .75; c.beginPath(); shapePts('star', r).forEach((p, k) => c[k ? 'lineTo' : 'moveTo'](x + p.x, y - p.y)); c.fill(); }
    c.globalAlpha = 1; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '84px "Lilita One", Impact, sans-serif'; c.lineWidth = 14; c.strokeStyle = 'rgba(60,0,80,.55)'; c.strokeText('HAPPY BIRTHDAY', w / 2, 120); c.fillStyle = '#fff'; c.fillText('HAPPY BIRTHDAY', w / 2, 120);
    c.font = '130px "Lilita One", Impact, sans-serif'; c.lineWidth = 18; c.strokeText('VIVAN!', w / 2, 232); const tg = c.createLinearGradient(0, 180, 0, 290); tg.addColorStop(0, '#fff6b0'); tg.addColorStop(1, '#ffc54a'); c.fillStyle = tg; c.fillText('VIVAN!', w / 2, 232);
  });
  const bdM = new THREE.MeshStandardMaterial({ map: bdT, roughness: .45, metalness: .15, envMap: ENV, envMapIntensity: .5, emissive: 0xffffff, emissiveMap: bdT, emissiveIntensity: .35 });
  part(new THREE.BoxGeometry(BW, BH, .1), smat(0xfff0f7), 0, BH / 2, -.06, bd);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BW - .1, BH - .1), bdM); face.position.set(0, BH / 2, .0); bd.add(face); booth.bdFace = face;
  part(new THREE.BoxGeometry(BW + .12, .12, .16), bm.gold, 0, BH + .02, -.04, bd);
  // header sign
  signBoard(bd, 0, BH + .45, .02, 0, 2.4, .56, [['📸 PHOTO BOOTH 📸', 150, '#ff4fa8', 256]], 'rgba(255,255,255,.98)', '#ffd25a', false);
  // curtains: soft red folds on both sides
  const velvet = new THREE.MeshStandardMaterial({ color: 0xc0103a, roughness: .55, metalness: .05, envMap: ENV, envMapIntensity: .3 });
  [-1, 1].forEach(s => {
    for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.075, .095, BH + .1, 10, 1), velvet); f.position.set(s * (BW / 2 - .05 + k * .1 - .25), (BH + .1) / 2, .12 + (k % 2) * .05); f.scale.z = .7; bd.add(f); }
    const tie = new THREE.Mesh(new THREE.TorusGeometry(.2, .03, 8, 20), bm.gold); tie.position.set(s * (BW / 2 + .02), 1.15, .2); tie.scale.set(1.3, .5, 1); bd.add(tie);
  });
  // balloon arch
  for (let i = 0; i <= 30; i++) {
    const t = i / 30 * Math.PI, x = -Math.cos(t) * (BW / 2 + .35), y = Math.sin(t) * (BH + .35) + .2;
    for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(BAL_G, balMats[(i + k * 3) % balMats.length]); const r = .95 + ((i * 7 + k * 3) % 5) * .1; b.scale.set(r, r * 1.1, r); b.position.set(x + (k ? .08 : -.05) * Math.cos(t), y + (k ? -.1 : .07), .2 + k * .14); bd.add(b); }
  }
  bd.updateMatrixWorld(true);
  { const c = Math.cos(bd.rotation.y), s = Math.sin(bd.rotation.y); addCol({ t: 0, x: PW.x + bd.position.x, y: BH / 2, z: PW.z + bd.position.z, hx: BW / 2 + .4, hy: BH / 2, hz: .3, yaw: bd.rotation.y, tag: 'wood' }); }

  /* two prop racks: a little vanity table with two shelves and foam heads */
  const tcT = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#ff9ec7'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.65)'; for (let x = 0; x < w; x += 24) for (let y = 0; y < h; y += 24) { c.beginPath(); c.arc(x + ((y / 24) % 2) * 12, y, 5, 0, 7); c.fill(); } }, [3, 1]);
  const skirt = new THREE.MeshStandardMaterial({ map: tcT, roughness: .85 }), backM = smat(0xfff3d6, { roughness: .7 });
  const RACKS = [
    { z: B_SPOT.z + 1.6, yaw: Math.PI, title: '👑 HATS + GLASSES 😎', ids: ['crown', 'tophat', 'cowboy', 'bunny', 'flowers', 'star', 'heart', 'shades', 'nerd'] },
    { z: B_SPOT.z - 1.6, yaw: 0, title: '🥸 FUNNY STUFF 🎈', ids: ['bowtie', 'medal', 'lei', 'wand', 'cupcake', 'stache', 'nose', 'horn', 'balloon'] },
  ];
  RACKS.forEach(R => {
    const rg = new THREE.Group(); rg.position.set(B_SPOT.x + .15, 0, R.z); rg.rotation.y = R.yaw; g.add(rg);
    part(new THREE.BoxGeometry(2.1, .05, .52), bm.white, 0, .72, 0, rg);
    part(new THREE.BoxGeometry(2.06, .66, .48), skirt, 0, .36, 0, rg);
    part(new THREE.BoxGeometry(2.12, .03, .54), bm.gold, 0, .695, 0, rg);
    part(new THREE.BoxGeometry(2.1, 1.05, .05), backM, 0, 1.25, -.25, rg);
    part(new THREE.BoxGeometry(2.1, .04, .24), bm.white, 0, 1.12, -.13, rg);
    part(new THREE.BoxGeometry(2.14, .04, .07), bm.gold, 0, 1.79, -.24, rg);
    [-1, 1].forEach(s => part(new THREE.BoxGeometry(.05, 1.1, .07), bm.gold, s * 1.06, 1.24, -.24, rg));
    signBoard(rg, 0, 1.62, -.2, 0, 1.5, .26, [[R.title, 110, '#8b6bff', 256]], 'rgba(255,255,255,.98)', '#ff4fa8', false);
    for (let k = 0; k < 7; k++) { const bulb = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 1.2 })); bulb.position.set(-.9 + k * .3, 1.42, -.215); rg.add(bulb); }
    const wp = V(); rg.getWorldPosition(wp); addCol({ t: 0, x: wp.x, y: .36, z: wp.z, hx: 1.06, hy: .36, hz: .27, yaw: R.yaw, tag: 'wood' });   // just the table, so paws can reach the props on it
    { const b = rg.localToWorld(V(0, 0, -.25)); addCol({ t: 0, x: b.x, y: 1.25, z: b.z, hx: 1.06, hy: .55, hz: .04, yaw: R.yaw, tag: 'wood' }); }
    R.ids.forEach((id, i) => {
      const upper = i >= 5, k = upper ? i - 5 : i, x = upper ? -.66 + k * .44 : -.8 + k * .4, y = upper ? 1.14 : .745, z = upper ? -.13 : .05;
      const st = new THREE.Group(); st.position.set(x, y, z); rg.add(st);
      part(new THREE.CylinderGeometry(.075, .085, .03, 20), bm.gold, 0, .015, 0, st);
      const P = BP[id], show = new THREE.Group(); st.add(show);
      const head = P.slot === 'head' || P.slot === 'eyes';
      if (head) { const f = part(new THREE.SphereGeometry(.13, 20, 14), bm.foam, 0, .16, 0, show); f.scale.set(1, 1.05, .95); part(new THREE.CylinderGeometry(.04, .06, .06, 12), bm.foam, 0, .04, 0, show); }
      const m = buildProp(id, true), sc = .27;
      if (P.slot === 'head') { m.scale.setScalar(sc); m.position.y = .29; }
      else if (P.slot === 'eyes') { m.scale.setScalar(sc); m.position.set(0, .19, -.11); }
      else if (P.slot === 'face') { m.scale.setScalar(id === 'horn' ? sc * 1.3 : sc * 1.5); m.position.set(0, .12, 0); if (id === 'horn') m.rotation.y = Math.PI / 2; }
      else if (P.slot === 'neck') { m.scale.setScalar(id === 'lei' ? sc * .55 : sc * 1.2); m.position.set(0, id === 'medal' ? .2 : .1, 0); if (id === 'lei') m.position.y = .06; }
      else { m.position.y = .03; }
      show.add(m); show.rotation.y = 0;
      // name tag on the shelf edge
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(.3, .075), new THREE.MeshBasicMaterial({ map: labelTex(256, 64, (c, w, h) => signText(c, w, h, [[`${P.emo} ${P.name}`, 30, '#2b2140', 34]], 'rgba(255,255,255,.97)', '#ffd25a')), transparent: true }));
      tag.position.set(x, upper ? 1.105 : .69, upper ? -.005 : .262); if (!upper) tag.rotation.x = -.15; rg.add(tag);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(.1, .012, 6, 24), new THREE.MeshBasicMaterial({ color: 0x5dff8f })); glow.rotation.x = Math.PI / 2; glow.position.y = .035; glow.visible = false; st.add(glow);
      BO.rack.push({ id, st, show, glow, w: V() });
    });
  });

  /* the camera on its tripod; its head turns to follow you */
  const cg = new THREE.Group(); cg.position.copy(B_CAM); cg.rotation.y = Math.PI / 2; boothG.add(cg); booth.cam = cg;
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + .5, leg = new THREE.Mesh(new THREE.CylinderGeometry(.018, .014, 1.13, 8), bm.black); leg.position.set(Math.cos(a) * .2, .525, Math.sin(a) * .2); leg.quaternion.setFromUnitVectors(V(0, 1, 0), V(-Math.cos(a) * .4, 1.05, -Math.sin(a) * .4).normalize()); cg.add(leg); part(new THREE.SphereGeometry(.03, 8, 6), bm.black, Math.cos(a) * .4, .02, Math.sin(a) * .4, cg); }
  part(new THREE.CylinderGeometry(.035, .035, .2, 10), bm.gold, 0, 1.05, 0, cg);
  addCol({ t: 1, x: PW.x + B_CAM.x, z: PW.z + B_CAM.z, cy: .7, hy: .7, r: .3, tag: 'wood' });
  const head = new THREE.Group(); head.position.y = 1.2; cg.add(head); booth.head = head;
  const camBody = smat(0xff6fb0, { roughness: .35, envMap: ENV, envMapIntensity: .4 }), cream = smat(0xfff3e6, { roughness: .5 });
  part(new THREE.BoxGeometry(.36, .22, .2), camBody, 0, 0, 0, head);
  part(new THREE.BoxGeometry(.37, .08, .21), cream, 0, -.05, 0, head);
  part(new THREE.BoxGeometry(.12, .07, .1), camBody, -.08, .14, .02, head);
  const lensG = new THREE.Group(); lensG.position.set(.03, 0, -.1); head.add(lensG); booth.lens = lensG;
  const barrel = part(new THREE.CylinderGeometry(.085, .095, .14, 28), bm.black, 0, 0, -.07, lensG); barrel.rotation.x = Math.PI / 2;
  [-.03, -.13].forEach(z => { const r = part(new THREE.TorusGeometry(.09, .012, 8, 28), bm.gold, 0, 0, z, lensG); });
  const glassL = part(new THREE.SphereGeometry(.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a2a5a, roughness: .02, metalness: .6, envMap: ENV, envMapIntensity: 2 }), 0, 0, -.14, lensG); glassL.rotation.x = -Math.PI / 2; glassL.scale.y = .35;
  booth.flashM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: .2, roughness: .2 });
  part(new THREE.BoxGeometry(.14, .08, .06), bm.black, .1, .16, -.02, head); part(new THREE.BoxGeometry(.12, .06, .01), booth.flashM, .1, .16, -.053, head);
  booth.rec = part(new THREE.SphereGeometry(.018, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff2030, emissiveIntensity: .4 }), -.14, .07, -.1, head);
  const smileTag = new THREE.Mesh(new THREE.PlaneGeometry(.18, .06), new THREE.MeshBasicMaterial({ map: labelTex(256, 86, (c, w, h) => signText(c, w, h, [['SMILE! 😁', 46, '#ff4fa8', 46]], 'rgba(255,255,255,.98)', '#ffd25a')), transparent: true }));
  smileTag.position.set(-.1, -.05, -.107); smileTag.rotation.set(0, Math.PI, 0); head.add(smileTag);   // on the front (-Z), facing you

  /* the BIG screen above the camera */
  const sg = new THREE.Group(); sg.position.set(B_CAM.x + .3, 0, B_CAM.z); sg.rotation.y = -Math.PI / 2; boothG.add(sg);
  const SW = 2.5, SH = SW * 684 / 1024, SY = 2.95;
  part(new THREE.BoxGeometry(SW + .2, SH + .2, .12), smat(0x2b2140, { roughness: .4 }), 0, SY, -.07, sg);
  [-1, 1].forEach(s => { part(new THREE.CylinderGeometry(.06, .07, SY, 12), bm.gold, s * (SW / 2 - .15), SY / 2, -.14, sg); const w = sg.localToWorld(V(s * (SW / 2 - .15), 0, -.14)); addCol({ t: 1, x: w.x, z: w.z, cy: SY / 2, hy: SY / 2, r: .08, tag: 'wood' }); });
  for (let i = 0; i < 28; i++) { const x = -SW / 2 - .03 + i / 27 * (SW + .06); [1, -1].forEach(sy => { const m = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), new THREE.MeshStandardMaterial({ color: PARTY_COLS[i % 7], emissive: PARTY_COLS[i % 7], emissiveIntensity: 1 })); m.position.set(x, SY + sy * (SH / 2 + .08), 0); sg.add(m); booth.bulbs = booth.bulbs || []; booth.bulbs.push(m); }); }
  signBoard(sg, 0, SY + SH / 2 + .42, -.02, 0, 1.9, .42, [['📺 SAY CHEESE! 🧀', 140, '#3fb2ff', 256]], 'rgba(255,255,255,.98)', '#ff4fa8', false);
  booth.liveRT = new THREE.WebGLRenderTarget(478, 278); booth.liveRT.texture.colorSpace = THREE.SRGBColorSpace;
  const HX = 956 / 1024, HY = 556 / 684, HC = SH * (.5 - (34 + 278) / 684);
  booth.live = new THREE.Mesh(new THREE.PlaneGeometry(SW * HX, SH * HY), new THREE.MeshBasicMaterial({ map: booth.liveRT.texture, toneMapped: false, fog: false }));
  booth.live.position.set(0, SY + HC, .005); booth.live.scale.x = -1; sg.add(booth.live);   // flipped, like a mirror
  const oc = document.createElement('canvas'); oc.width = 1024; oc.height = 684; booth.ovCtx = oc.getContext('2d'); booth.ovT = new THREE.CanvasTexture(oc); booth.ovT.colorSpace = THREE.SRGBColorSpace;
  booth.ov = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: booth.ovT, transparent: true, toneMapped: false, fog: false })); booth.ov.position.set(0, SY, .01); sg.add(booth.ov);
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 684; booth.pCanvas = pc; booth.pCtx = pc.getContext('2d'); booth.pT = new THREE.CanvasTexture(pc); booth.pT.colorSpace = THREE.SRGBColorSpace;
  booth.photo = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: booth.pT, toneMapped: false, fog: false })); booth.photo.position.set(0, SY, .015); booth.photo.visible = false; sg.add(booth.photo);
  booth.sg = sg;
  booth.bcam = new THREE.PerspectiveCamera(30, 956 / 556, .05, 70); booth.bcam.layers.enable(SELF_LAYER);

  /* the PHOTO WALL: polaroids fly here */
  const wg = new THREE.Group(); wg.position.set(B_CAM.x - .45, 0, B_SPOT.z - 2.75); wg.rotation.y = -.35; boothG.add(wg); booth.wall = wg;
  const corkT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c98f55'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { c.fillStyle = Math.random() < .5 ? 'rgba(90,50,20,.35)' : 'rgba(255,230,190,.3)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  part(new THREE.BoxGeometry(1.7, 1.15, .06), new THREE.MeshStandardMaterial({ map: corkT, roughness: .95 }), 0, 1.45, 0, wg);
  [[0, 2.06, 1.82, .08], [0, .84, 1.82, .08], [-.88, 1.45, .08, 1.3], [.88, 1.45, .08, 1.3]].forEach(([x, y, w, h]) => part(new THREE.BoxGeometry(w, h, .1), bm.gold, x, y, .01, wg));
  [-1, 1].forEach(s => part(new THREE.CylinderGeometry(.04, .05, .84, 10), bm.white, s * .7, .42, -.03, wg));
  signBoard(wg, 0, 2.3, .02, 0, 1.3, .3, [['🖼️ PHOTO WALL', 140, '#ff4fa8', 256]], 'rgba(255,255,255,.98)', '#3fb2ff', false);
  { const w = wg.localToWorld(V()); addCol({ t: 0, x: w.x, y: 1.05, z: w.z, hx: .9, hy: 1.05, hz: .1, yaw: wg.rotation.y, tag: 'wood' }); }
  for (let c = 0; c < 4; c++) booth.slots.push(V(-.6 + c * .4, 1.45, .07));
  boothG.updateMatrixWorld(true);
  mergeStatic(g, c => BO.rack.some(r => r.st === c));
}
// pedestals + buttons by the star
const B_SNAP = (() => {
  const mk = (dz, label, col, css, act) => {
    const p = V(B_SPOT.x + .3, .52, B_SPOT.z + dz);
    part(new THREE.CylinderGeometry(.13, .17, .52, 16), bm.white, p.x, .26, p.z, boothG); part(new THREE.CylinderGeometry(.18, .18, .04, 16), bm.gold, p.x, .02, p.z, boothG);
    addCol({ t: 1, x: PW.x + p.x, z: PW.z + p.z, cy: .42, hy: .42, r: .17, tag: 'wood' });
    return partyButton(boothG, p, -Math.PI / 2, label, col, css, act);
  };
  mk(-1.0, 'CLEAR 🧹', 0x3fb2ff, '#8fd0ff', () => wearClear());
  return mk(1.0, '📸 SNAP!', 0xff4fa8, '#ff9ec7', () => boothSnap());
})();

/* ---------- the screen: live view + the frame around it ---------- */
function boothFrame(c, w, h, legend) {   // the party frame (shared by the live view and the photos); leaves the photo hole clear
  const gr = c.createLinearGradient(0, 0, w, h);
  if (legend) { gr.addColorStop(0, '#fff3a0'); gr.addColorStop(.5, '#ffc54a'); gr.addColorStop(1, '#ff9a1a'); } else { gr.addColorStop(0, '#ff4fa8'); gr.addColorStop(.5, '#8b6bff'); gr.addColorStop(1, '#3fb2ff'); }
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.save(); c.globalAlpha = .9; for (let i = 0; i < 70; i++) { const side = i % 4, t = (i * 0.618) % 1, x = side < 2 ? t * w : (side === 2 ? 14 : w - 14), y = side < 2 ? (side ? h - 40 : 16) : t * h;
    c.fillStyle = ['#ffffff', '#ffd25a', '#5fd94a', '#ff8a3d'][i % 4]; c.save(); c.translate(x, y); c.rotate(i); c.fillRect(-6, -2.5, 12, 5); c.restore(); } c.restore();
  c.clearRect(34, 34, 956, 556);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '50px "Lilita One", Impact, sans-serif'; c.lineWidth = 8; c.strokeStyle = 'rgba(40,10,60,.5)';
}
function ovDraw(key) {
  if (BO.ovKey === key) return; BO.ovKey = key;
  const c = booth.ovCtx; c.clearRect(0, 0, 1024, 684); boothFrame(c, 1024, 684, false);
  const n = BO.snap ? Math.ceil(BO.snap.t) : 0, k = BO.snap ? BO.snap.k + 1 : 0;
  const cap = BO.snap ? (n > 0 ? `😁 PHOTO ${k} OF ${STRIP_N} · ${['SMILE!', 'BE SILLY!', 'STRIKE A POSE!', 'BIG FINISH!'][k - 1]}` : '📸 CHEESE!') : '🔴 LIVE · stand on the ⭐ and press SNAP!';
  c.strokeText(cap, 512, 637); c.fillStyle = '#fff'; c.fillText(cap, 512, 637);
  if (BO.snap && n > 0) { c.font = '330px "Lilita One", Impact, sans-serif'; c.lineWidth = 22; c.strokeStyle = 'rgba(40,10,60,.6)'; c.strokeText(n, 512, 330); c.fillStyle = 'rgba(255,255,255,.92)'; c.fillText(n, 512, 330); }
  booth.ovT.needsUpdate = true;
}
labelFns.push(() => { BO.ovKey = ''; });

/* ---------- taking the photos: SNAP = a strip of 4 ---------- */
const STRIP_N = 4;
const _bsW = new THREE.Vector3(), _bsC = new THREE.Vector3(), _bsD = new THREE.Vector3();
function boothSeen() { booth.live.getWorldPosition(_bsW); camera.getWorldPosition(_bsC); camera.getWorldDirection(_bsD); return _bsW.sub(_bsC).normalize().dot(_bsD) > .25; }
function boothRender(rt) {
  const xrOn = renderer.xr.enabled, sa = renderer.shadowMap.autoUpdate, prev = renderer.getRenderTarget();
  renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false; booth.sg.visible = false;
  renderer.setRenderTarget(rt); renderer.render(scene, booth.bcam); renderer.setRenderTarget(prev);
  renderer.xr.enabled = xrOn; renderer.shadowMap.autoUpdate = sa; booth.sg.visible = true;
}
function boothSnap() {
  if (!PT.inside) return;
  if (BO.snap) return;
  BO.snap = { t: 3, last: 4, k: 0, pics: [] }; BO.show = 0; booth.photo.visible = false;
  headWorld(_tA); const d = Math.hypot(_tA.x - PW.x - B_SPOT.x, _tA.z - PW.z - B_SPOT.z);
  toast(d > 1.4 ? `📸 ${STRIP_N} photos coming! Run to the ⭐ and look at the camera!` : `📸 ${STRIP_N} photos in a row! Do a different pose for each one! 😁`, 3.5);
}
const sticker = (c, x, y, r, col, rot) => { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = Math.max(3, r * .18); c.beginPath(); shapePts('star', r).forEach((p, k) => c[k ? 'lineTo' : 'moveTo'](p.x, -p.y)); c.closePath(); c.fill(); c.stroke(); c.restore(); };
function boothCapture() {   // render the camera's view into a 956 x 556 canvas
  if (!booth.photoRT) { booth.photoRT = new THREE.WebGLRenderTarget(956, 556); booth.photoRT.texture.colorSpace = THREE.SRGBColorSpace; }
  boothRender(booth.photoRT);
  const W = 956, H = 556, buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(booth.photoRT, 0, 0, W, H, buf);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
  const img = cx.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) { const s = (H - 1 - y) * W * 4, o = y * W * 4; for (let i = 0; i < W * 4; i += 4) { d[o + i] = Math.min(255, buf[s + i] * 1.06 + 6); d[o + i + 1] = Math.min(255, buf[s + i + 1] * 1.06 + 6); d[o + i + 2] = Math.min(255, buf[s + i + 2] * 1.06 + 6); d[o + i + 3] = 255; } }   // + a little flash
  cx.putImageData(img, 0, 0); return cv;
}
function boothCaption(c, x, y, txt, legend) { c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 9; c.strokeStyle = 'rgba(40,10,60,.55)'; if (!legend) c.strokeText(txt, x, y); c.fillStyle = legend ? '#5a2a00' : '#fff'; c.fillText(txt, x, y); }
function boothShoot() {
  const S = BO.snap; if (BO.inst.horn && BO.inst.horn.parent) BO.horn = 1.6;
  stepBoothHorn(0);
  const cv = boothCapture(); S.pics.push(cv);
  // show this one on the big screen for a moment
  const c = booth.pCtx, legend = B_SLOTS.every(s => BO.worn[s]); c.clearRect(0, 0, 1024, 684); boothFrame(c, 1024, 684, legend); c.drawImage(cv, 34, 34);
  sticker(c, 60, 60, 34, '#ffd25a', -.2); sticker(c, 964, 64, 30, '#ff4fa8', .3);
  c.font = '52px "Lilita One", Impact, sans-serif'; boothCaption(c, 512, 637, `📸 PHOTO ${S.k + 1} OF ${STRIP_N}`, legend);
  booth.pT.needsUpdate = true; booth.photo.visible = true;
  BO.flash = 1; if (ac) { tone('square', 2600, 900, .04, .12); tone('triangle', 1400, 300, .09, .1, .03); }
  confetti(pw(B_SPOT.x, 1.6, B_SPOT.z), state.xr ? 15 : 35);
  if (!state.xr && BO.near) { const f = $('boothFlash'); if (f) { f.style.transition = 'none'; f.style.opacity = .85; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .7s'; f.style.opacity = 0; })); } }
  S.k++;
  if (S.k < STRIP_N) { S.t = 3; S.last = 4; BO.show = 1.1; return; }   // next photo: 1 s to look, then 3-2-1 again
  BO.snap = null; BO.shots++;
  boothStrip(S.pics, legend);
}
function boothStrip(pics, legend) {
  // the big screen: all 4 in a 2 x 2 grid
  const c = booth.pCtx; c.clearRect(0, 0, 1024, 684); boothFrame(c, 1024, 684, legend);
  c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(34, 34, 956, 556);
  pics.forEach((p, i) => { const x = 46 + (i % 2) * 472, y = 44 + Math.floor(i / 2) * 274; c.drawImage(p, x, y, 460, 266); });
  sticker(c, 60, 60, 34, '#ffd25a', -.2); sticker(c, 964, 64, 30, '#ff4fa8', .3); sticker(c, 970, 560, 26, '#5fd94a', .1); sticker(c, 56, 556, 28, '#3fb2ff', -.4);
  const dt = new Date(), date = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
  c.font = '50px "Lilita One", Impact, sans-serif'; boothCaption(c, 512, 637, legend ? '✨ LEGENDARY PARTY FIT ✨' : `🎂 VIVAN'S BIRTHDAY · ${date} · strip #${BO.shots}`, legend);
  booth.pT.needsUpdate = true; booth.photo.visible = true; BO.show = 16;
  // the real photo strip: tall and thin, like a photo booth prints
  const SW = 600, PH = 349, M = 24, TOP = 130, BOT = 120, s = document.createElement('canvas'); s.width = SW; s.height = TOP + pics.length * (PH + M) + BOT;
  const g = s.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, s.height);
  if (legend) { gr.addColorStop(0, '#fff3a0'); gr.addColorStop(.5, '#ffc54a'); gr.addColorStop(1, '#ff9a1a'); } else { gr.addColorStop(0, '#ff4fa8'); gr.addColorStop(.5, '#8b6bff'); gr.addColorStop(1, '#3fb2ff'); }
  g.fillStyle = gr; g.fillRect(0, 0, SW, s.height);
  for (let i = 0; i < 60; i++) { g.fillStyle = ['#ffffff', '#ffd25a', '#5fd94a', '#ff8a3d'][i % 4]; g.globalAlpha = .7; g.save(); g.translate((i * 97) % SW, (i * 211) % s.height); g.rotate(i); g.fillRect(-6, -2.5, 12, 5); g.restore(); } g.globalAlpha = 1;
  pics.forEach((p, i) => { const y = TOP + i * (PH + M); g.fillStyle = '#fff'; g.fillRect(M - 6, y - 6, SW - 2 * M + 12, PH + 12); g.drawImage(p, M, y, SW - 2 * M, PH); });
  g.font = '60px "Lilita One", Impact, sans-serif'; boothCaption(g, SW / 2, 58, legend ? '✨ LEGENDARY ✨' : "📸 VIVAN'S PARTY", legend);
  g.font = '34px "Lilita One", Impact, sans-serif'; boothCaption(g, SW / 2, 104, 'HAPPY BIRTHDAY! 🎂', legend);
  g.font = '38px "Lilita One", Impact, sans-serif'; boothCaption(g, SW / 2, s.height - 72, `${date} · strip #${BO.shots}`, legend);
  g.font = '26px "Lilita One", Impact, sans-serif'; boothCaption(g, SW / 2, s.height - 30, 'Knuckle Grove Photo Booth', legend);
  sticker(g, 40, 40, 26, '#ffd25a', -.2); sticker(g, SW - 40, 44, 22, '#5fd94a', .3);
  BO.strips.push({ n: BO.shots, url: s.toDataURL('image/png') }); if (BO.strips.length > 12) BO.strips.shift();
  if (ac) setTimeout(() => partyChime(), 250);
  if (legend) {   // secret: every slot filled
    if (ac) [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, .2, .1, .3 + i * .1));
    confetti(pw(B_SPOT.x, 2.2, B_SPOT.z), state.xr ? 40 : 120, [0xffd25a, 0xffc54a, 0xffffff, 0xfff3a0]);
    if (!BO.legend) { BO.legend = true; toast('✨ SECRET: LEGENDARY PARTY FIT! Golden photo strip unlocked! ✨', 5); }
  } else toast(state.xr ? '🎞️ Your photo strip is printing! Look at the big screen + the PHOTO WALL!' : '🎞️ Photo strip done! Save it with the 💾 button!', 4);
  boothPolaroid(s); boothCard();
}
function boothPolaroid(strip) {   // the strip prints out of the camera and flies to the photo wall
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = Math.round(128 * strip.height / strip.width); cv.getContext('2d').drawImage(strip, 0, 0, cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const w = .3, h = w * strip.height / strip.width, g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, .006), bm.white));
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); pm.position.z = .0035; g.add(pm);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), new THREE.MeshStandardMaterial({ color: PARTY_COLS[BO.shots % 7], roughness: .3 })); pin.position.set(0, h / 2 - .03, .012); g.add(pin);
  booth.lens.updateMatrixWorld(true); const from = booth.lens.localToWorld(V(0, -.12, .05)).sub(PW);
  g.position.copy(from); g.scale.setScalar(.3); boothG.add(g);
  const slot = (BO.shots - 1) % booth.slots.length, old = BO.polas.find(p => p.slot === slot);
  if (old) { boothG.remove(old.g); old.tex.dispose(); BO.polas.splice(BO.polas.indexOf(old), 1); }
  const to = booth.wall.localToWorld(V().copy(booth.slots[slot])).sub(PW);
  BO.polas.push({ g, tex: t, slot, from, to, u: 0, tilt: (Math.random() - .5) * .12 });
}
function stepPolas(dt) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, booth.wall.rotation.y, 0));
  for (const P of BO.polas) {
    if (P.u >= 1) continue;
    P.u = Math.min(1, P.u + dt * .7); const u = P.u, e = u < .25 ? 0 : (u - .25) / .75, s = e * e * (3 - 2 * e);
    if (u < .25) { P.g.position.copy(P.from).add(V(0, -.18 * u / .25, 0)); P.g.scale.setScalar(.3 + u * 1.2); P.g.rotation.set(0, Math.PI / 2, 0); }   // prints out of the camera
    else { P.g.position.lerpVectors(P.from, P.to, s); P.g.position.y += Math.sin(s * Math.PI) * .9 - .18 * (1 - s); P.g.scale.setScalar(.6 + s * .4); P.g.quaternion.slerpQuaternions(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), q, s); P.g.rotateZ(P.tilt * s + Math.sin(s * Math.PI) * 1.2); }
    if (u >= 1) { P.g.position.copy(P.to); P.g.quaternion.copy(q); P.g.rotateZ(P.tilt); P.g.scale.setScalar(1); if (ac) tone('sine', 900, 1300, .06, .05); }
  }
}
function stepBoothHorn(dt) {
  const hn = BO.inst.horn; if (!hn) return; const B = hn.children[0] && hn.children[0].userData.B; if (!B) return;
  BO.horn = Math.max(0, BO.horn - dt); const u = BO.horn > 0 ? 1 : (BO.snap && BO.snap.t < .6 ? 1 - BO.snap.t / .6 : .05 + Math.max(0, Math.sin(tAll * 1.3)) ** 8 * .9);
  blowerCurl(B, u);
}

/* ---------- PC + phone: the booth panel, the photo card, the flash ---------- */
{
  const st = document.createElement('style');
  st.textContent = `#boothUi{position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:22;display:none;max-width:calc(100vw - 160px);padding:6px 8px;border-radius:16px;background:rgba(43,26,74,.88);border:3px solid #ff4fa8;color:#fff;font:500 12px Fredoka,system-ui,sans-serif;box-shadow:0 4px 0 rgba(0,0,0,.25);user-select:none;-webkit-user-select:none}
  #boothUi .bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:5px}
  #boothUi .t{font:400 18px "Lilita One",Impact,sans-serif;color:#ffd25a;white-space:nowrap}
  #boothUi .grp{display:flex;gap:2px;padding:2px;border-radius:12px;background:rgba(255,255,255,.08)}
  #boothUi button{border:0;border-radius:10px;cursor:pointer;font:inherit}
  #boothUi .p{width:36px;height:34px;font-size:20px;background:rgba(255,255,255,.12);padding:0}#boothUi .p.on{background:#5dff8f;box-shadow:0 0 0 2px #fff inset}
  #boothUi .big{padding:7px 12px;font:400 18px "Lilita One",Impact,sans-serif;color:#fff;background:#ff4fa8;box-shadow:0 3px 0 #a01f63;white-space:nowrap}
  #boothUi .sm{width:36px;height:34px;font-size:18px;background:#3fb2ff;box-shadow:0 3px 0 #1b6fa8}#boothUi .hint{margin-top:4px;font-size:11px;opacity:.8;text-align:center}
  #boothPic{position:fixed;right:74px;top:70px;z-index:22;display:none;width:230px;padding:8px;border-radius:16px;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.35);transform:rotate(2deg);font:600 14px Fredoka,system-ui,sans-serif}
  #boothPic img{width:100%;border-radius:8px;display:block}#boothPic .r{display:flex;gap:6px;margin-top:6px}#boothPic a,#boothPic button{flex:1;text-align:center;border:0;border-radius:10px;padding:7px;color:#fff;text-decoration:none;cursor:pointer;font:inherit}
  #boothPic a{background:#5fd94a}#boothPic a.all{background:#3fb2ff}#boothPic button{background:#ff5f6d;flex:.45}
  #boothFlash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:40}
  @media (max-width:900px),(max-height:520px){#boothUi{top:4px;padding:4px 6px;max-width:calc(100vw - 200px)}#boothUi .p,#boothUi .sm{width:30px;height:29px;font-size:17px}#boothUi .t{display:none}#boothUi .big{font-size:15px;padding:6px 9px}#boothUi .hint{display:none}#boothPic{width:150px;top:auto;bottom:120px;right:70px;padding:6px}#boothPic .r{font-size:12px}}`;
  document.head.appendChild(st);
  const ui = document.createElement('div'); ui.id = 'boothUi';
  ui.innerHTML = '<div class="bar"><span class="t">📸 PHOTO BOOTH</span>' + B_SLOTS.map(sl => `<div class="grp" title="${sl}">${B_PROPS.filter(p => p.slot === sl).map(p => `<button class="p" data-id="${p.id}" title="${p.name}">${p.emo}</button>`).join('')}</div>`).join('') +
    '<button class="sm" data-act="clear" title="Take it all off">🧹</button><button class="big" data-act="snap">📸 SNAP! (P)</button></div><div class="hint">tap a prop to wear it (again = off) · or look at a prop + E · U frees the mouse</div>';
  const stop = e => { e.stopPropagation(); };
  ui.addEventListener('pointerdown', stop); ui.addEventListener('touchstart', stop, { passive: true });
  ui.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (!b) return; if (b.dataset.id) wear(b.dataset.id); else if (b.dataset.act === 'snap') boothSnap(); else if (b.dataset.act === 'clear') wearClear(); b.blur(); });
  const pic = document.createElement('div'); pic.id = 'boothPic'; pic.innerHTML = '<img alt="your photo strip"><div class="r"><a class="one">💾 Save strip</a><button>✖</button></div><div class="r"><a class="all" href="#">📂 Save ALL strips</a></div>';
  pic.querySelector('.all').onclick = e => { e.preventDefault(); e.stopPropagation(); BO.strips.forEach((s, i) => setTimeout(() => { const a = document.createElement('a'); a.href = s.url; a.download = `vivan-party-strip-${s.n}.png`; document.body.appendChild(a); a.click(); a.remove(); }, i * 400)); toast(`📂 Saving ${BO.strips.length} photo strip${BO.strips.length > 1 ? 's' : ''} to your Downloads!`, 3.5); };
  pic.addEventListener('pointerdown', stop); pic.querySelector('button').onclick = e => { e.stopPropagation(); pic.style.display = 'none'; };
  const fl = document.createElement('div'); fl.id = 'boothFlash';
  document.body.append(ui, pic, fl);
  addEventListener('keydown', e => { if (e.code === 'KeyP' && state.mode === 'play' && !state.xr && PT.inside && BO.near) boothSnap(); });
}
function boothUiSync() { document.querySelectorAll('#boothUi .p').forEach(b => b.classList.toggle('on', BO.worn[BP[b.dataset.id].slot] === b.dataset.id)); BO.rack.forEach(r => r.glow.visible = BO.worn[BP[r.id].slot] === r.id); }
function boothCard() {
  if (state.xr) return;
  const pic = $('boothPic'); if (!pic) return;
  pic.querySelector('img').src = booth.pCanvas.toDataURL('image/jpeg', .85); const s = BO.strips[BO.strips.length - 1], a = pic.querySelector('.one'); a.href = s.url; a.download = `vivan-party-strip-${s.n}.png`;
  pic.querySelector('.all').textContent = `📂 Save ALL strips (${BO.strips.length})`;
  pic.style.display = 'block';
}

/* ---------- hooks: grabbing props (VR), E on a prop (PC), and the per-frame step ---------- */
// anywhere in the game: grab next to your head to take off what's on it (hats, glasses, noses...), or at your neck for neck things
function boothTakeOff(h) {
  if (!h.tracked) return false;
  headWorld(_tO); const dh = h.pos.distanceTo(_tO); _tO.y -= .28; const dn = h.pos.distanceTo(_tO);
  const slots = dh < .2 ? ['head', 'eyes', 'face'] : dn < .16 ? ['neck'] : [];
  const off = slots.filter(s => BO.worn[s]); if (!off.length) return false;
  const s = off[0], id = BO.worn[s]; wearShow(id, false); BO.worn[s] = null;
  if (s === 'head') PH.wornHat.visible = PT.hat === 'worn';
  store.set('kg-booth', JSON.stringify(BO.worn)); boothUiSync(); buzz(h, .6, 40); if (ac) tone('sine', 600, 300, .12, .1); toast(`🙅 ${BP[id].emo} ${BP[id].name} off`, 1.8);
  return true;
}
const _tO = V();
function boothGrab(h) {
  if (!PT.inside || !h.tracked) return false;
  let best = null, bd = .2; for (const r of BO.rack) { const d = r.w.distanceTo(h.pos) - (r.rad || 0); if (d < bd) { bd = d; best = r; } }
  if (!best) return false; wear(best.id); buzz(h, .7, 45); return true;
}
function boothDesk() {
  if (!PT.inside) return false;
  const r = aimAt(2.6, f => BO.rack.forEach(r => f(r, r.w, r.rad ? .35 : .12))); if (!r) return false;
  wear(r.id); return true;
}
function stepBooth(dt) {
  const ui = $('boothUi');
  // hand props float on your left paw, standing up
  const hp = BO.anch.hand; if (hp) { const h = hands[0]; hp.visible = !!BO.worn.hand && h.paw.visible; if (hp.visible) { h.paw.getWorldPosition(hp.position); hp.position.y += .03; camera.getWorldQuaternion(_pq); const f = V(0, 0, -1).applyQuaternion(_pq); hp.rotation.set(0, Math.atan2(-f.x, -f.z), 0); } }
  stepBoothHorn(dt);
  if (!PT.inside) { BO.near = false; if (ui) ui.style.display = 'none'; const p = $('boothPic'); if (p) p.style.display = 'none'; return; }
  headWorld(_tA); const lx = _tA.x - PW.x, lz = _tA.z - PW.z, dS = Math.hypot(lx - B_SPOT.x, lz - B_SPOT.z);
  BO.near = dS < 4.6;
  if (ui) ui.style.display = BO.near && !state.xr && state.mode === 'play' && !PT.fall ? 'block' : 'none';
  if (BO.near && !BO.told && !PT.fall) { BO.told = true; toast(state.xr ? '📸 PHOTO BOOTH! Grab props off the racks, stand on the ⭐ and press SNAP!' : '📸 PHOTO BOOTH! Pick props (panel or E), stand on the ⭐ and press SNAP or P!', 6); }
  // rack: props turn slowly; remember where they are for grabbing
  for (const r of BO.rack) { if (r.big) continue; r.show.rotation.y = Math.sin(tAll * .6 + r.st.position.x * 3) * .5; r.st.getWorldPosition(r.w); r.w.y += .16; }
  // the camera turns to look at you
  const tgt = V(_tA.x, PW.y + (_tA.y - PW.y) * .74, _tA.z);
  BO.look.lengthSq() ? BO.look.lerp(tgt, Math.min(1, dt * 5)) : BO.look.copy(tgt);
  const loc = booth.cam.worldToLocal(V().copy(BO.look)).sub(booth.head.position);
  const yaw = clamp(Math.atan2(-loc.x, -loc.z), -1.1, 1.1), pitch = clamp(Math.atan2(loc.y, Math.hypot(loc.x, loc.z)), -.5, .6);
  booth.head.rotation.set(0, 0, 0); booth.head.rotateY(yaw); booth.head.rotateX(pitch);
  booth.head.updateMatrixWorld(true); booth.lens.localToWorld(booth.bcam.position.set(0, 0, -.16)); booth.bcam.lookAt(BO.look);
  { const eye = Math.max(.4, _tA.y - PW.y), fov = clamp(2 * Math.atan(eye * .56 / Math.max(1, booth.bcam.position.distanceTo(BO.look))) * 180 / Math.PI, 16, 50); if (Math.abs(fov - booth.bcam.fov) > .2) { booth.bcam.fov += (fov - booth.bcam.fov) * Math.min(1, dt * 4); booth.bcam.updateProjectionMatrix(); } }
  // countdown
  if (BO.snap) {
    const was = Math.ceil(BO.snap.t); BO.snap.t -= dt; const n = Math.ceil(BO.snap.t);
    if (n !== was && n > 0 && ac) tone('sine', 880, 880, .12, .14);
    if (n !== BO.snap.last) { BO.snap.last = n; if (ac && n === 3) tone('sine', 880, 880, .12, .14); }
    booth.rec.material.emissiveIntensity = (tAll * 4 % 1) < .5 ? 2.5 : .2;
    if (BO.snap.t <= 0) boothShoot();
  } else booth.rec.material.emissiveIntensity = .5 + Math.sin(tAll * 2) * .2;
  ovDraw(BO.snap ? 'c' + Math.ceil(BO.snap.t) : 'live');
  BO.flash = Math.max(0, BO.flash - dt * 2.5); booth.flashM.emissiveIntensity = .2 + BO.flash * 8;
  if (BO.show > 0) { BO.show -= dt; if (BO.show <= 0) booth.photo.visible = false; }
  if (BO.snap && BO.show > 0) BO.snap.t += dt;   // countdown waits while the last photo is on screen
  booth.bulbs.forEach((m, i) => m.material.emissiveIntensity = (Math.sin(tAll * (BO.snap ? 14 : 4) - i * .6) > 0) ? 1.3 : .25);
  // live view (only when you're close, every 2nd frame (3rd in VR), and not while a photo is on screen)
  if (dS < 9 && !booth.photo.visible && BO.frame++ % (state.xr ? 4 : 2) === 0 && boothSeen()) boothRender(booth.liveRT);   // the live screen only redraws when you can see it (it's a whole extra picture of the party)
  stepPolas(dt); stepPlush(dt);
}
// put your saved outfit back on once your avatar has loaded
(function boothRestore() {
  if (!AV.ready) { setTimeout(boothRestore, 500); return; }
  let w = null; try { w = JSON.parse(store.get('kg-booth') || 'null'); } catch (e) {}
  if (w) B_SLOTS.forEach(s => { if (w[s] && BP[w[s]] && BP[w[s]].slot === s) wear(w[s], true); });
})();
window.__kg.booth = { BO, booth, wear, wearClear, boothSnap, boothShoot, boothFit, B_SPOT, B_CAM, B_SNAP };
