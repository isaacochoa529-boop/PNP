/* ======================= 🧸 SPROUT BEAR PLUSH (photo booth prop) =======================
   A fluffy teal plush bear with a green sprout on its head, huge glossy eyes, pink cheeks + paw beans,
   cream muzzle, belly and wrist cuffs and a round puff tail. Built from round shapes (no boxes!).
   - Holdable: it's a 'hand' prop in the booth (grab the big one in VR, look at it + E on PC, 🧸 in the panel).
   - A BIG one sits on its own pedestal next to the hats rack, bouncing softly. Grab it = it squishes.
   - The held one wobbles in your paw like a squishy plushie. */
const PLU = { mats: null, big: null, bigPiv: null, squish: 0, bigSquish: 0, taps: [], bloom: false, hearts: [] };
function plushMats() {
  if (PLU.mats) return PLU.mats;
  // fur: a little canvas of tiny strands, used as colour + bump so it looks fluffy, plus soft sheen
  const furT = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 7, l = 2 + Math.random() * 4, v = 170 + Math.random() * 85 | 0;
      c.strokeStyle = `rgb(${v},${v},${v})`; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  }, [3, 3]);
  const fur = (color, sheen) => new THREE.MeshPhysicalMaterial({ color, map: furT, bumpMap: furT, bumpScale: .35, roughness: .95, sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: .45 });
  const gloss = color => new THREE.MeshPhysicalMaterial({ color, roughness: .06, clearcoat: 1, clearcoatRoughness: .05, envMap: ENV, envMapIntensity: 1.2 });
  PLU.mats = {
    teal: fur(0x2cc6b6, 0xb5fff4), cream: fur(0xfff6d2, 0xffffff), pink: fur(0xf59cc4, 0xffd6ea),
    eyeW: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .35, clearcoat: .6 }), eyeB: gloss(0x0f1520), nose: gloss(0x0d4a32),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }), mouth: smat(0x0d3a2a, { roughness: .6 }),
    leaf: new THREE.MeshPhysicalMaterial({ color: 0x7fdc2a, roughness: .4, clearcoat: .4, sheen: .6, sheenColor: new THREE.Color(0xd8ff9a) }),
    stem: smat(0x5cb81e, { roughness: .5 }), bloom: smat(0xff6fb5, { roughness: .45 }), bloomC: smat(0xffd25a, { roughness: .4 }),
  };
  PLU.mats.cream.emissive = new THREE.Color(0x4a4430);   // keep the cream parts creamy in shade
  return PLU.mats;
}
// h = height in metres (feet to leaf tips). Front = -Z, bottom at y = 0.
function buildPlush(h = .32, bloom = false) {
  const M = plushMats(), root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const S = (r, m, x, y, z, sx = 1, sy = 1, sz = 1, par = g) => { const me = part(new THREE.SphereGeometry(r, 26, 18), m, x, y, z, par); me.scale.set(sx, sy, sz); return me; };
  // head ellipsoid: centre (0,.72,0), radii a,b,c. onHead puts a group on its surface, -Z pointing out.
  const HC = V(0, .72, 0), A = .315, B = .29, C = .285;
  const onHead = (x, y, out = 0) => {
    const dy = y - HC.y, k = 1 - (x / A) ** 2 - (dy / B) ** 2, z = -C * Math.sqrt(Math.max(0, k));
    const n = V(x / (A * A), dy / (B * B), z / (C * C)).normalize(), o = new THREE.Group();
    o.position.set(x, y, z).addScaledVector(n, out); o.quaternion.setFromUnitVectors(V(0, 0, -1), n); g.add(o); return o;
  };
  // body: a soft egg, cream belly patch, round puff tail
  S(.2, M.teal, 0, .3, 0, 1, 1.18, .92);
  S(.125, M.cream, 0, .29, -.145, .9, 1.2, .42);
  S(.065, M.teal, 0, .2, .175);
  // stubby feet with pink pads
  [-1, 1].forEach(s => { S(.075, M.teal, s * .1, .075, -.05, 1, .8, 1.2); S(.04, M.pink, s * .1, .07, -.135, 1, .9, .35); });
  // arms hang down and out: arm capsule, cream cuff, paw with 3 toe beans + a big bean
  [-1, 1].forEach(s => {
    const arm = new THREE.Group(); arm.position.set(s * .16, .43, -.01); arm.rotation.z = s * .55; g.add(arm);
    const up = part(new THREE.CapsuleGeometry(.05, .13, 6, 14), M.teal, 0, -.1, 0, arm);
    const cuff = part(new THREE.TorusGeometry(.052, .022, 10, 22), M.cream, 0, -.2, 0, arm); cuff.rotation.x = Math.PI / 2;
    const paw = new THREE.Group(); paw.position.set(0, -.255, -.01); paw.rotation.z = -s * .3; arm.add(paw);
    S(.068, M.teal, 0, 0, 0, 1.08, .82, 1, paw);
    S(.028, M.pink, 0, -.008, -.06, 1.15, .9, .35, paw);
    [-1, 0, 1].forEach(t => S(.012, M.pink, t * .026, .026 - Math.abs(t) * .006, -.056, 1, 1, .5, paw));
  });
  // head + ears (pink insides)
  S(1, M.teal, HC.x, HC.y, HC.z, A, B, C);
  [-1, 1].forEach(s => { const e = new THREE.Group(); e.position.set(s * .225, .955, .03); e.rotation.z = -s * .45; g.add(e);
    S(.1, M.teal, 0, 0, 0, 1, 1, .6, e); S(.062, M.pink, 0, -.005, -.042, 1, 1, .32, e); });
  // big glossy eyes: white ring, black eye, two shines
  [-1, 1].forEach(s => {
    const o = onHead(s * .125, .735, -.012);
    S(.098, M.eyeW, 0, 0, 0, 1, 1.1, .38, o);
    S(.078, M.eyeB, 0, -.004, -.012, 1, 1.08, .4, o);
    S(.024, M.shine, .028, .03, -.044, 1, 1, .4, o);
    S(.011, M.shine, -.028, -.028, -.04, 1, 1, .4, o);
  });
  // cream muzzle, green nose, little smile, pink cheeks
  { const o = onHead(0, .6, -.015); S(.115, M.cream, 0, 0, 0, 1.45, .9, .5, o); }
  { const o = onHead(0, .655, .045); S(.034, M.nose, 0, 0, 0, 1.35, .95, .8, o); S(.009, M.shine, -.012, .012, -.024, 1, 1, .5, o); }
  { const o = onHead(0, .6, .05); const sm = part(new THREE.TorusGeometry(.036, .0055, 6, 18, Math.PI * .8), M.mouth, 0, .012, 0, o); sm.rotation.z = Math.PI + Math.PI * .1; }
  [-1, 1].forEach(s => { const o = onHead(s * .2, .6, -.004); S(.045, M.pink, 0, 0, 0, 1.1, .85, .3, o); });
  // the sprout: a curvy stem and two plump leaves (or a flower when it blooms)
  const sp = new THREE.Group(); sp.position.set(0, .995, 0); g.add(sp);
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(.006, .04, 0), V(-.004, .08, 0), V(0, .105, 0)]);
  sp.add(Object.assign(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, .011, 8), M.stem), { castShadow: true }));
  [-1, 1].forEach(s => { const lf = new THREE.Group(); lf.position.set(0, .1, 0); lf.rotation.z = -s * .55; sp.add(lf);
    S(.06, M.leaf, s * .055, .012, 0, 1.15, .28, .72, lf);
    const vein = part(new THREE.CylinderGeometry(.003, .003, .1, 5), M.stem, s * .052, .028, 0, lf); vein.rotation.z = Math.PI / 2; });
  if (bloom) { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; S(.026, M.bloom, Math.cos(a) * .03, .145, Math.sin(a) * .03, 1, .5, 1, sp); } S(.02, M.bloomC, 0, .15, 0, 1, .7, 1, sp); }
  g.scale.setScalar(h / 1.12);
  root.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return root;
}

/* ---------- the BIG one, on a pedestal next to the hats rack ---------- */
(function plushStand() {
  const P = V(B_SPOT.x + 1.65, 0, B_SPOT.z + 1.55), sg = new THREE.Group(); sg.position.copy(P); boothG.add(sg);
  const tgt = V(B_SPOT.x + .6, 0, B_SPOT.z); sg.rotation.y = Math.atan2(-(tgt.x - P.x), -(tgt.z - P.z));
  const st = new THREE.Group(); sg.add(st);
  part(new THREE.CylinderGeometry(.34, .38, .5, 32), smat(0xbff3ec, { roughness: .6 }), 0, .25, 0, st);
  part(new THREE.TorusGeometry(.355, .025, 8, 32), bm.gold, 0, .5, 0, st).rotation.x = Math.PI / 2;
  part(new THREE.TorusGeometry(.385, .025, 8, 32), bm.gold, 0, .02, 0, st).rotation.x = Math.PI / 2;
  const cush = part(new THREE.SphereGeometry(.3, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), smat(0x7fdc2a, { roughness: .9 }), 0, .5, 0, st); cush.scale.y = .25;
  signBoard(sg, 0, .3, -.37, Math.PI, .6, .16, [['🧸 SPROUT BEAR 🌱', 90, '#13897d', 256]], 'rgba(255,255,255,.98)', '#7fdc2a', false);
  const piv = new THREE.Group(); piv.position.y = .55; st.add(piv);
  PLU.big = buildPlush(.85); piv.add(PLU.big); PLU.bigPiv = piv;
  const glow = new THREE.Mesh(new THREE.TorusGeometry(.33, .02, 6, 32), new THREE.MeshBasicMaterial({ color: 0x5dff8f })); glow.rotation.x = Math.PI / 2; glow.position.y = .515; glow.visible = false; st.add(glow);
  const show = new THREE.Group(); st.add(show);   // the booth spins "show" a bit; the big bear turns with its own pivot instead
  BO.rack.push({ id: 'plush', st, show, glow, w: V(), rad: .25, big: true });
  sg.updateMatrixWorld(true); const wp = V(); sg.getWorldPosition(wp); addCol({ t: 1, x: wp.x, z: wp.z, cy: .26, hy: .26, r: .4, tag: 'wood' });
})();

/* ---------- squish, wobble, hearts (+ a little something) ---------- */
const heartT = labelTex(64, 64, (c, w, h) => { c.fillStyle = '#ff5fa8'; c.beginPath(); c.moveTo(32, 54); c.bezierCurveTo(-6, 28, 14, 2, 32, 20); c.bezierCurveTo(50, 2, 70, 28, 32, 54); c.fill(); });
function plushHearts(at, n = 5) {
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartT, transparent: true, depthWrite: false })); s.scale.setScalar(.07 + Math.random() * .05);
    s.position.copy(at).add(V((Math.random() - .5) * .25, Math.random() * .1, (Math.random() - .5) * .25)); scene.add(s); PLU.hearts.push({ s, t: 0, vx: (Math.random() - .5) * .3, vz: (Math.random() - .5) * .3 }); }
}
function plushSqueak() { if (ac) { tone('sine', 900, 1500, .12, .1); tone('triangle', 1400, 900, .14, .06, .08); } }
function plushWorn(on) {   // called by the booth when the bear goes in / out of your paw
  PLU.squish = 1; PLU.bigSquish = 1; plushSqueak();
  const at = V(); PLU.bigPiv.getWorldPosition(at); at.y += .6; plushHearts(at, on ? 6 : 3);
  const now = tAll; PLU.taps = PLU.taps.filter(t => now - t < 12); PLU.taps.push(now);
  if (!PLU.bloom && PLU.taps.length >= 7) {
    PLU.bloom = true; PLU.taps = [];
    const old = PLU.big; PLU.big = buildPlush(.85, true); PLU.bigPiv.remove(old); PLU.bigPiv.add(PLU.big);
    if (BO.inst.plush) { const par = BO.inst.plush.parent, nb = buildProp('plush', false); if (par) { par.remove(BO.inst.plush); par.add(nb); } BO.inst.plush = nb; }
    plushHearts(at, 18); partyChime(); toast('🌸 The sprout BLOOMED! Sprout Bear loves you 💖', 4);
  }
}
function stepPlush(dt) {
  PLU.squish = Math.max(0, PLU.squish - dt * 1.6); PLU.bigSquish = Math.max(0, PLU.bigSquish - dt * 1.2);
  const held = BO.inst.plush;
  if (held && held.parent) {   // squishy idle wobble in your paw (+ a big squash right after you grab it)
    const q = Math.sin(tAll * 3.2) * .035 + Math.sin(tAll * 18) * .22 * PLU.squish;
    held.scale.set(1 - q * .6, 1 + q, 1 - q * .6); held.rotation.z = Math.sin(tAll * 2.1) * .07; held.rotation.x = Math.sin(tAll * 1.7) * .05;
  }
  if (PLU.bigPiv) {   // the big bear bounces softly and turns to look around
    const q = Math.sin(tAll * 2) * .02 + Math.sin(tAll * 14) * .16 * PLU.bigSquish;
    PLU.big.scale.set(1 - q * .6, 1 + q, 1 - q * .6); PLU.bigPiv.rotation.y = Math.sin(tAll * .5) * .35;
    const r = BO.rack.find(r => r.big); if (r) { r.st.getWorldPosition(r.w); r.w.y += .95; }
  }
  for (let i = PLU.hearts.length - 1; i >= 0; i--) { const H = PLU.hearts[i]; H.t += dt; H.s.position.y += dt * .45; H.s.position.x += H.vx * dt; H.s.position.z += H.vz * dt; H.s.material.opacity = 1 - H.t / 1.4;
    if (H.t > 1.4) { scene.remove(H.s); H.s.material.dispose(); PLU.hearts.splice(i, 1); } }
}
