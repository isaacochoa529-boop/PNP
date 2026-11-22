/* ======================= paws ======================= */
// a paw with three fingers you control: thumb, pointer and a big middle finger (see setCurl)
const FINGERS = [{ x: -.06, y: .004, z: -.018, yaw: -.75, l: [.026, .022], r: .02 }, { x: -.022, y: .006, z: -.05, yaw: -.06, l: [.032, .028], r: .0185 }, { x: .026, y: .004, z: -.048, yaw: .1, l: [.032, .028], r: .022 }];
function makePaw(color) {
  const g = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(1.15); g.add(body);
  const furM = new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true }), padM = mat(0xff8fb1), cuffM = mat(0xffffff);
  const palm = new THREE.Mesh(new THREE.IcosahedronGeometry(.06, 2), furM); palm.scale.set(1.08, .78, 1.05); body.add(palm);
  const pad = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), padM); pad.position.set(0, -.044, -.005); pad.scale.set(1.25, .35, 1); body.add(pad);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(.045, .018, 8, 16), cuffM); cuff.position.z = .06; body.add(cuff);
  const fingers = FINGERS.map(f => {
    const a = new THREE.Group(); a.position.set(f.x, f.y, f.z); a.rotation.y = f.yaw; body.add(a);
    const s1 = new THREE.Mesh(new THREE.CapsuleGeometry(f.r, f.l[0], 3, 8).rotateX(Math.PI / 2), furM); s1.position.z = -f.l[0] / 2; a.add(s1);
    const b = new THREE.Group(); b.position.z = -f.l[0]; a.add(b);
    const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(f.r * .94, f.l[1], 3, 8).rotateX(Math.PI / 2), furM); s2.position.z = -f.l[1] / 2; b.add(s2);
    const bean = new THREE.Mesh(new THREE.SphereGeometry(f.r * .55, 8, 6), padM); bean.position.set(0, -f.r * .7, -f.l[1] + .002); bean.scale.y = .5; b.add(bean);
    const end = new THREE.Object3D(); end.position.z = -f.l[1] - f.r * .8; b.add(end);
    return { a, b, end, yaw: f.yaw };
  });
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.fur = furM; g.userData.fingers = fingers; g.userData.curl = [.25, .25, .25]; setCurl(g, g.userData.curl);
  return g;
}
// curl: 0 = straight out, 1 = tucked in. [thumb, pointer, middle]
function setCurl(paw, c) {
  const F = paw.userData.fingers; if (!F) return;
  F[0].a.rotation.set(-c[0] * .5, F[0].yaw + c[0] * 1.1, 0); F[0].b.rotation.x = -c[0] * 1.1;
  for (let i = 1; i < 3; i++) { F[i].a.rotation.x = -c[i] * 1.45; F[i].b.rotation.x = -c[i] * 1.7; }
}
const PAW_COLOR = 0x2fc6a3;
const hands = [0, 1].map(i => {
  const paw = makePaw(PAW_COLOR); scene.add(paw); paw.visible = false;
  return { i, paw, src: null, side: i ? 'right' : 'left', tracked: false, local: V(), q: new THREE.Quaternion(), target: V(), pos: V(), prev: V(), stuck: false, sp: V(), n: V(), col: null, cool: 0, ready: false };
});
const setSide = h => { h.paw.scale.x = h.side === 'left' ? -1 : 1; };
hands.forEach(setSide);
// desktop paws, attached to the camera for a bit of personality
const deskPaws = [];

// wrist panel on the left paw
const wrist = textPanel(256, 128, () => {});
{ const pm = new THREE.Mesh(new THREE.PlaneGeometry(.12, .06), new THREE.MeshBasicMaterial({ map: wrist.t, transparent: true }));
  pm.position.set(0, .075, .07); pm.rotation.x = -1.0; pm.scale.x = -1; hands[0].paw.add(pm); wrist.mesh = pm; }
function drawWrist() {
  const g = wrist.g; g.clearRect(0, 0, 256, 128); g.fillStyle = 'rgba(16,52,38,.85)'; g.beginPath(); g.roundRect(4, 4, 248, 120, 24); g.fill();
  g.textAlign = 'center'; g.fillStyle = '#ff7fd0'; g.font = '50px "Lilita One", Impact, sans-serif'; g.fillText(`🫐 ${state.got}/${BERRIES_TOTAL}`, 128, 60);
  g.fillStyle = '#fff'; g.font = '34px Fredoka, sans-serif'; g.fillText(fmtTime(state.time), 128, 106); wrist.t.needsUpdate = true;
}

/* ======================= the Thumpling (modelled in Blender: models/thumpling.glb) ======================= */
// Torso + head live on SELF_LAYER: the selfie screen and the desktop third-person camera see them, your own eyes don't.
// FP_LAYER holds a shorter copy of the body that only your own eyes see: it sits on the ground and comes up to your waist.
const SELF_LAYER = 5, FP_LAYER = 6;
camera.layers.enable(FP_LAYER);
const AV = { ready: false, root: new THREE.Group(), fpRoot: new THREE.Group(), torso: null, head: null, arms: [], armFur: null };
scene.add(AV.fpRoot); AV.fpRoot.visible = false;
scene.add(AV.root); AV.root.visible = false;
const avSc = () => clamp(state.bodyH / BM.sc / AVATAR_EYE, .75, 1.1) * BM.sc;   // the model is built with its eyes 0.85 m up
const SHOULDER = [V(-.235, .585, .02), V(.235, .585, .02)];   // torso space (model faces -Z)
const L_UP = .3, L_FORE = .3;
// the preview page ships the model as base64 (window.THUMPLING_B64); the real site loads the .glb file
(window.THUMPLING_B64 ? (cb, _p, eb) => new GLTFLoader().parse(Uint8Array.from(atob(window.THUMPLING_B64), c => c.charCodeAt(0)).buffer, '', cb, eb)
  : (cb, p, eb) => new GLTFLoader().load('models/thumpling.glb', cb, p, eb))(gltf => {
  const get = n => gltf.scene.getObjectByName(n);
  (() => {   // the smile is drawn with the pupil material: split it into its own mesh so talking can swap it for an open mouth
    const hd = get('Head'); let pm = null; hd.traverse(c => { if (c.isMesh && c.material.name === 'Pupil') pm = c; });
    if (!pm || !pm.geometry.index) return;
    const g = pm.geometry, y = g.attributes.position, ix = g.index.array, keep = [], sm = [];
    for (let i = 0; i < ix.length; i += 3) (y.getY(ix[i]) < -.07 && y.getY(ix[i + 1]) < -.07 && y.getY(ix[i + 2]) < -.07 ? sm : keep).push(ix[i], ix[i + 1], ix[i + 2]);
    if (!sm.length) return;
    const sg = g.clone(); sg.setIndex(sm); g.setIndex(keep);
    const smile = new THREE.Mesh(sg, pm.material); smile.name = 'Smile'; smile.position.copy(pm.position); smile.quaternion.copy(pm.quaternion); smile.scale.copy(pm.scale);
    pm.parent.add(smile);
  })();
  (() => {   // each eye (white + pupil) gets its own pivot, so eyes can grow when you shout
    const hd = get('Head'), byMat = {}; hd.traverse(c => { if (c.isMesh && (c.material.name === 'EyeWhite' || c.material.name === 'Pupil') && c.name !== 'Smile') byMat[c.material.name] = c; });
    const W = byMat.EyeWhite, P = byMat.Pupil; if (!W || !W.geometry.index) return;
    const parent = W.parent; parent.updateMatrix(); W.updateMatrix(); if (P) P.updateMatrix();
    const side = (m, sgn) => {   // the triangles of mesh m on one side (x < 0 or x > 0), baked into parent space
      const g = m.geometry.clone(); g.applyMatrix4(m.matrix); const pos = g.attributes.position, ix = g.index.array, keep = [];
      for (let i = 0; i < ix.length; i += 3) if ((pos.getX(ix[i]) + pos.getX(ix[i + 1]) + pos.getX(ix[i + 2])) * sgn > 0) keep.push(ix[i], ix[i + 1], ix[i + 2]);
      g.setIndex(keep); return keep.length ? g : null;
    };
    [-1, 1].forEach(sgn => {
      const wg = side(W, sgn); if (!wg) return; const bb = new THREE.Box3(), wp = wg.attributes.position, wi = wg.index.array; for (let i = 0; i < wi.length; i++) bb.expandByPoint(_tmp.fromBufferAttribute(wp, wi[i])); const c = bb.getCenter(V());   // only the vertices this eye uses
      const pv = new THREE.Group(); pv.name = sgn < 0 ? 'EyeL' : 'EyeR'; pv.position.copy(c); parent.add(pv);
      wg.translate(-c.x, -c.y, -c.z); pv.add(new THREE.Mesh(wg, W.material));
      const pg = P && side(P, sgn); if (pg) { pg.translate(-c.x, -c.y, -c.z); pv.add(new THREE.Mesh(pg, P.material)); }
    });
    W.removeFromParent(); if (P) P.removeFromParent();
  })();
  const furOf = o => { let m = null; o.traverse(c => { if (c.isMesh && c.material.name === 'Fur') m = c.material; }); return m; };
  const prep = (o, layer) => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; if (layer) c.layers.set(layer); } }); return o; };
  paintCheeks(get('Head'));   // the mark of the Knuckle (everyone's head is copied from this one)
  AV.torso = prep(get('Torso').clone(), SELF_LAYER); AV.head = prep(get('Head').clone(), SELF_LAYER);
  AV.torso.position.set(0, -.12, 0); AV.head.position.set(0, 0, 0); AV.head.visible = false;   // -.12: the bean's bottom sits on the floor
  AV.root.add(AV.torso); scene.add(AV.head);
  const fp = prep(get('Torso').clone(), FP_LAYER); fp.position.set(0, -.12, 0); AV.fpRoot.add(fp);
  AV.armFur = furOf(get('Paw')).clone(); AV.pawFur = AV.armFur.clone(); AV.bodyFur = furOf(get('Torso')).clone();
  [AV.torso, AV.head, fp].forEach(o => o.traverse(c => { if (c.isMesh && c.material.name === 'Fur') c.material = AV.bodyFur; }));
  AV.tpl = { torso: get('Torso'), head: get('Head'), arm: get('ArmSeg'), elbow: get('Elbow'), fur: furOf(get('Torso')) };   // friends are built from the same model
  const withArmFur = o => { o.traverse(c => { if (c.isMesh && c.material.name === 'Fur') c.material = AV.armFur; }); return o; };
  for (let i = 0; i < 2; i++) {
    const arm = { up: withArmFur(prep(get('ArmSeg').clone())), fore: withArmFur(prep(get('ArmSeg').clone())), elbow: withArmFur(prep(get('Elbow').clone())) };
    arm.up.position.set(0, 0, 0); arm.fore.position.set(0, 0, 0); arm.elbow.position.set(0, 0, 0);
    arm.up.visible = arm.fore.visible = arm.elbow.visible = false;
    scene.add(arm.up, arm.fore, arm.elbow); AV.arms.push(arm);
    const h = hands[i], oldFur = h.paw.userData.fur;   // the paw keeps its three fingers, it just wears the model's fur
    h.paw.traverse(c => { if (c.isMesh && c.material === oldFur) { c.material = AV.pawFur; c.castShadow = true; } }); h.paw.userData.fur = AV.pawFur;
    if (state.golden) { AV.armFur.color.set(0xffc83a); AV.armFur.emissive.set(0x553300); AV.armFur.metalness = .5; }
  }
  AV.ready = true; applyMyColors();
}, undefined, e => console.warn('Thumpling model did not load, using the simple paws', e));

const _S = V(), _E = V(), _W = V(), _dir = V(), _pole = V(), _fw = V(), _up = V(0, 1, 0), _hq = new THREE.Quaternion();
function placeSeg(m, a, b, sc) { _dir.subVectors(b, a); const L = _dir.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(_up, _dir.multiplyScalar(1 / Math.max(L, 1e-5))); m.scale.set(sc, L, sc); }
function poseAvatar(dt) {
  if (!AV.ready) return;
  const sc = avSc();
  rig.updateMatrixWorld(); camera.updateMatrixWorld();
  headWorld(_h);
  // facing: where your head looks, flattened
  if (state.xr || sim.on) camera.getWorldQuaternion(_hq); else _hq.copy(rig.quaternion).multiply(_q.setFromEuler(_eul.set(state.pitch, 0, 0)));
  _fw.set(0, 0, -1).applyQuaternion(_hq); const yaw = Math.atan2(-_fw.x, -_fw.z);
  AV.root.visible = true; AV.head.visible = true;
  AV.root.position.set(_h.x - _fw.x * .03, _h.y - state.bodyH, _h.z - _fw.z * .03);   // sits on the ground
  AV.root.rotation.set(0, yaw, 0); AV.root.scale.setScalar(sc);
  // first-person body: same spot, a little behind your paws, squashed so its top is at your waist
  AV.fpRoot.visible = !(state.third && !state.xr);
  AV.fpRoot.position.set(_h.x - _fw.x * .12, _h.y - state.bodyH, _h.z - _fw.z * .12); AV.fpRoot.rotation.set(0, yaw, 0);
  AV.fpRoot.scale.set(sc, Math.max(.15, state.bodyH * .45) / .6, sc);
  // lean forward a little while you're in the air
  const air = state.grounded ? 0 : 1; AV.torso.rotation.x += ((air ? -.15 : 0) - AV.torso.rotation.x) * Math.min(1, dt * 6);
  AV.head.position.copy(_h); AV.head.quaternion.copy(_hq); AV.head.scale.setScalar(sc);
  AV.root.updateMatrixWorld(true);
  hands.forEach((h, i) => {
    const arm = AV.arms[i]; if (!arm) return;
    const show = h.paw.visible; arm.up.visible = arm.fore.visible = arm.elbow.visible = show; if (!show) return;
    const side = h.side === 'left' ? 0 : 1;
    AV.torso.localToWorld(_S.copy(SHOULDER[side]));
    h.paw.updateMatrixWorld(); h.paw.localToWorld(_W.set(0, 0, .07));       // the wrist, just behind the cuff
    const l1 = L_UP * sc, l2 = L_FORE * sc;
    _dir.subVectors(_W, _S); let d = _dir.length(); _dir.multiplyScalar(1 / Math.max(d, 1e-5));
    let a1 = l1, a2 = l2;
    if (d > l1 + l2) { const k = d / (l1 + l2); a1 *= k; a2 *= k; }                 // cartoon stretch when you reach far
    d = Math.max(d, 1e-3);
    const a = (a1 * a1 - a2 * a2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, a1 * a1 - a * a));
    // elbows point outward, down and back, like a real arm
    _pole.set(side ? 1 : -1, -.7, .5).applyAxisAngle(_up, yaw); _pole.addScaledVector(_dir, -_pole.dot(_dir)).normalize();
    _E.copy(_S).addScaledVector(_dir, a).addScaledVector(_pole, hgt);
    placeSeg(arm.up, _S, _E, sc); placeSeg(arm.fore, _E, _W, sc * .95);
    arm.elbow.position.copy(_E); arm.elbow.scale.setScalar(sc);
  });
}

/* ======================= selfie screen at spawn ======================= */
// A camera in the frame films you and shows it flipped like a mirror. Unlike a real reflection it looks the same
// to both eyes in VR, so it stays smooth and steady in the headset.
const selfie = (() => {
  const g = new THREE.Group(); g.position.set(-3.4, 0, -3.0); g.rotation.y = Math.atan2(3.4, 3.0); scene.add(g);
  const rt = new THREE.WebGLRenderTarget(384, 540); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false }));
  screen.position.set(0, 1.35, .075); screen.scale.x = -1; g.add(screen);     // flipped, so it behaves like a mirror
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.66, 2.26, .1), mat(0x6b4426)); back.position.set(0, 1.35, 0); back.castShadow = true; g.add(back);
  const fm = mat(0x8a5a32);
  [[0, 2.45, 1.8, .16], [0, .25, 1.8, .16], [-.83, 1.35, .16, 2.3], [.83, 1.35, .16, 2.3]].forEach(([x, y, w, h]) => { const b = shadowy(new THREE.Mesh(new THREE.BoxGeometry(w, h, .14), fm)); b.position.set(x, y, .02); g.add(b); });
  const leaf = mat(0x4fd65a); for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), leaf); l.scale.set(1, .4, .6); l.position.set(-.8 + k * .32, 2.58, .05); l.rotation.z = k % 2 ? .4 : -.4; g.add(l); }
  addCol({ t: 0, x: g.position.x, y: 1.3, z: g.position.z, hx: .92, hy: 1.3, hz: .12, yaw: g.rotation.y, tag: 'wood' });
  const cam = new THREE.PerspectiveCamera(48, 384 / 540, .05, 80); cam.layers.enable(SELF_LAYER);
  g.updateMatrixWorld(true); g.localToWorld(cam.position.set(0, 1.35, .15));
  const look = V(), _sh = V(); let frame = 0;
  return {
    g, near: false,
    update() {
      headWorld(_sh); this.near = _sh.distanceTo(cam.position) < 9 && state.mode === 'play';
      if (!this.near || (frame++ & 1)) return;                       // only when you're close, every other frame
      look.lerp(_sh.clone().add(V(0, -.25, 0)), look.lengthSq() ? .25 : 1); cam.lookAt(look);
      const xrOn = renderer.xr.enabled, shadowAuto = renderer.shadowMap.autoUpdate, prev = renderer.getRenderTarget();
      renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false; screen.visible = false;
      renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev);
      renderer.xr.enabled = xrOn; renderer.shadowMap.autoUpdate = shadowAuto; screen.visible = true;
    },
  };
})();

/* ======================= grabbable toys: squeeze grip near one to pick it up, let go to throw ======================= */
const props = [];
function makeProp(kind, x, y, z) {
  const g = new THREE.Group(); let r = .13;
  if (kind === 'ball') {
    const cols = [0xff4f6d, 0xffd25a, 0x3fe0bd, 0x8b6bff][props.length % 4];
    for (let k = 0; k < 4; k++) { const seg = new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 12, k * Math.PI / 2, Math.PI / 2), mat(k % 2 ? 0xffffff : cols, { flatShading: false, roughness: .5 })); g.add(seg); }
    r = .14;
  } else if (kind === 'cone') {
    for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.085 - k * .012, .07, 8), mat(k % 2 ? 0x8a5a2b : 0x6b4426)); c.position.y = -.07 + k * .04; c.rotation.y = k * .4; g.add(c); }
    r = .09;
  } else {   // star: a glowy spiky toy
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(.11, 0), mat(0xffd25a, { emissive: 0xffb020, emissiveIntensity: .6 })); g.add(st);
    const st2 = st.clone(); st2.rotation.set(.6, .6, 0); g.add(st2); r = .11;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.set(x, y, z); scene.add(g);
  const p = { kind, g, r, vel: V(), held: null, rest: false, home: V(x, y, z), info: { nrm: V(), ground: false, bounce: null, col: null }, w: V() };
  props.push(p); return p;
}
[['ball', 1.2, .9, 1.3], ['ball', -1.4, .9, 1.1], ['ball', 6, 3.2, 6], ['ball', -11, 6, -6.5], ['cone', -.6, .9, 1.7], ['cone', 13.5, 5.2, -8.2],
 ['star', .2, .9, -1.6], ['star', isl.x, isl.top + .4, isl.z - .5], ['cone', 0, 5.6, 18.4], ['ball', -9, .4, 9]].forEach(a => makeProp(...a));

const PAW_HOLD = V(0, -.015, -.2);   // desktop: in front of the paw
function grabProp(h) {
  if (h.holding || !h.tracked) return;
  let best = null, bd = .3;
  for (const p of props) { const d = p.g.position.distanceTo(h.pos) - p.r; if (d < bd) { bd = d; best = p; } }
  if (!best) return;
  if (best.held) best.held.holding = null;
  claim(best, 'p', props.indexOf(best));
  best.held = h; best.rest = false; h.holding = best; h.stuck = false; h.reset = true;
  buzz(h, .5, 30); if (ac) tone('sine', 500, 800, .08, .2);
}
const PROP_UP = V(0, 1, 0);
function throwSpin(p) { p.w.crossVectors(PROP_UP, p.vel).multiplyScalar(1 / p.r); }
function dropProp(h) {
  const p = h.holding; if (!p) return;
  h.holding = null; p.held = null; p.rest = false; h.reset = true; h.stuck = false;
  p.vel.copy(h.vel || V()).multiplyScalar(1.35); if (p.vel.length() > 16) p.vel.setLength(16);   // throw with your paw's speed
  if (p.kind === 'ball') throwSpin(p);   // thrown balls already spin the way they fly, so they land rolling instead of skidding or veering
  else p.w.set(rnd() * 6 - 3, rnd() * 6 - 3, rnd() * 6 - 3);                     // pinecones and stars tumble
}
function deskGrab() {
  if (deskSwitch()) return;
  if (pipDeskGrab()) return;
  const h = hands[1];
  if (h.holding) { const p = h.holding; dropProp(h); const f = V(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_hq)); p.vel.copy(f).multiplyScalar(9).add(V(0, 2, 0)); if (p.kind === 'ball') throwSpin(p); return; }
  headWorld(_h); const f = V(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_hq));
  let best = null, bd = 3.5;
  for (const p of props) { const to = p.g.position.clone().sub(_h), d = to.length(); if (d < bd && to.normalize().dot(f) > .6) { bd = d; best = p; } }
  if (best) { if (best.held) best.held.holding = null; claim(best, 'p', props.indexOf(best)); best.held = h; h.holding = best; best.rest = false; if (ac) tone('sine', 500, 800, .08, .2); }
}
const _pp = V(), _rw = V(), _ut = V(), _spinQ = new THREE.Quaternion(), _bh = V(), _bhPrev = V(), _bv = V();
let _bhInit = false;
function propTouched(p, feetY) {   // your paw or body bumps someone else's toy: it's yours now
  for (const h of hands) if (h.tracked && h.vel && !h.holding && h.pos.distanceTo(p.g.position) < p.r + PAW_R && h.vel.length() > .5) return true;
  const by = Math.min(Math.max(p.g.position.y, feetY), _bh.y); return _pp.set(_bh.x, by, _bh.z).distanceTo(p.g.position) < p.r + (by === _bh.y ? .17 : .25);
}
function stepProps(dt) {
  // your body is solid to toys: roll into a ball and it gets shoved along
  headWorld(_bh); if (!_bhInit) { _bhPrev.copy(_bh); _bhInit = true; }
  _bv.subVectors(_bh, _bhPrev).multiplyScalar(1 / Math.max(dt, 1e-3)); _bhPrev.copy(_bh);
  if (_bv.length() > 20) _bv.set(0, 0, 0);   // teleports / respawns aren't shoves
  const feetY = _bh.y - state.bodyH + .25;
  for (const p of props) {
    if (!mine(p)) { if (propTouched(p, feetY)) claim(p, 'p', props.indexOf(p)); else continue; }
    if (p.held) {
      const h = p.held;
      if ((state.xr || sim.on) && h.tracked) p.g.position.copy(h.pos);              // VR: the toy IS the paw's contact point
      else { h.paw.updateMatrixWorld(); h.paw.localToWorld(p.g.position.set(0, -.015, -(.085 + p.r))); }
      p.g.quaternion.copy(h.paw.quaternion);
      continue;
    }
    // free paws can bonk resting toys around
    for (const h of hands) if (h.tracked && h.vel && !h.holding && h.pos.distanceTo(p.g.position) < p.r + PAW_R && h.vel.length() > .8) { p.vel.copy(h.vel).multiplyScalar(1.1); p.rest = false; }
    {
      const by = Math.min(Math.max(p.g.position.y, feetY), _bh.y);   // closest point on your body's centre line
      _pp.set(_bh.x, by, _bh.z).sub(p.g.position).multiplyScalar(-1);
      const d = _pp.length(), min = p.r + (by === _bh.y ? .17 : .25);
      if (d < min && d > 1e-4) {
        _pp.multiplyScalar(1 / d); p.g.position.addScaledVector(_pp, min - d);
        const rel = _bv.dot(_pp) - p.vel.dot(_pp);
        if (rel > 0) p.vel.addScaledVector(_pp, rel * 1.3);
        p.rest = false;
      }
    }
    if (p.rest) continue;
    p.vel.y -= G * dt;
    p.g.position.addScaledVector(p.vel, dt);
    p.info.nrm.set(0, 0, 0); p.info.ground = false; _pp.copy(p.g.position);
    if (pushOut(p.g.position, p.r, p.info)) {
      const n = p.info.nrm.normalize(), vn = p.vel.dot(n);
      if (vn < 0) {
        if (vn < -2) sfxTap(p.info.col ? p.info.col.tag : 'grass', -vn / 8);
        const bounce = vn < -.8 ? (p.kind === 'ball' ? .6 : .3) : 0;          // balls are bouncier; tiny contacts just stop
        p.vel.addScaledVector(n, -(1 + bounce) * vn);
      }
      if (p.info.ground) {
        if (p.kind === 'ball') {
          // grippy rubber: friction at the contact point cancels any skid, so it truly rolls (spin = n x v / r).
          // solid-ball maths: a sliding ball keeps 5/7 of its speed as it starts rolling; a spinning one kicks off sideways
          _ut.crossVectors(p.w, n).multiplyScalar(-p.r).add(p.vel); _ut.addScaledVector(n, -_ut.dot(n));
          p.vel.addScaledVector(_ut, -2 / 7);
          p.w.add(_rw.crossVectors(n, _ut).multiplyScalar(5 / (7 * p.r)));
          p.vel.multiplyScalar(Math.exp(-dt * .55)); p.w.multiplyScalar(Math.exp(-dt * .55));                // gentle rolling resistance; slopes still roll it downhill
          if (n.y > .99 && p.vel.length() < .05) { p.rest = true; p.vel.set(0, 0, 0); p.w.set(0, 0, 0); }
        } else {
          p.vel.multiplyScalar(Math.exp(-dt * 4)); p.w.multiplyScalar(Math.exp(-dt * 6));   // pinecones and stars skid to a stop
          if (p.vel.length() < .12) { p.rest = true; p.vel.set(0, 0, 0); p.w.set(0, 0, 0); }
        }
      }
    }
    const wl = p.w.length();
    if (wl > 1e-3) { _spinQ.setFromAxisAngle(_rw.copy(p.w).multiplyScalar(1 / wl), wl * dt); p.g.quaternion.premultiply(_spinQ); }
    // bonk Pip!
    if (pip.hop <= 0 && p.vel.length() > 2 && p.g.position.distanceTo(_pp.copy(pip.g.position).add(V(0, .3, 0))) < .45) { pip.hop = 1; sfxSqueak(); hearts(_pp.clone().add(V(0, .4, 0))); }
    if (p.g.position.y < -10) { p.g.position.copy(p.home); p.vel.set(0, 0, 0); p.rest = false; }
  }
  // toys bump into each other (a held toy pushes like a wall that moves with your paw)
  for (let a = 0; a < props.length; a++) for (let b = a + 1; b < props.length; b++) {
    const A = props[a], B = props[b];
    _pp.subVectors(B.g.position, A.g.position); const d = _pp.length(), min = A.r + B.r;
    const aW = A.held || !mine(A), bW = B.held || !mine(B);   // held toys and other people's toys push like moving walls
    if (d >= min || d < 1e-5 || (aW && bW)) continue;
    const n = _pp.multiplyScalar(1 / d), over = min - d;
    const va = A.held ? (A.held.vel || V()) : A.vel, vb = B.held ? (B.held.vel || V()) : B.vel;
    const rel = vb.clone().sub(va).dot(n);
    if (aW) { B.g.position.addScaledVector(n, over); if (rel < 0) B.vel.addScaledVector(n, -1.8 * rel); }
    else if (bW) { A.g.position.addScaledVector(n, -over); if (rel < 0) A.vel.addScaledVector(n, 1.8 * rel); }
    else {
      A.g.position.addScaledVector(n, -over / 2); B.g.position.addScaledVector(n, over / 2);
      if (rel < 0) { const j = -.9 * rel; A.vel.addScaledVector(n, -j); B.vel.addScaledVector(n, j); }
    }
    if (rel < -1.5) sfxTap('mush', -rel / 6);
    A.rest = A.rest && !(rel < -.2); B.rest = B.rest && !(rel < -.2);
  }
}

