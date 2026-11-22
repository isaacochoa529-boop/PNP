// ===== HUMAN: builds a real-looking person (the dummy looks like YOU) =====
// Hierarchy: root -> torso (hips at y .95) -> head / arms / legs. Every rippable part has its pivot AT the joint.
function mats(o) {
  const shiny = o.gold ? { metalness: .9, roughness: .25 } : { roughness: .65 };
  return {
    skin: new THREE.MeshStandardMaterial(Object.assign({ color: o.gold ? '#e8b923' : o.skin }, shiny)),
    shirt: new THREE.MeshStandardMaterial({ color: o.shirt, roughness: .85 }),
    pants: new THREE.MeshStandardMaterial({ color: '#2d3442', roughness: .9 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: .7 }),
    hair: new THREE.MeshStandardMaterial({ color: o.gold ? '#c9961a' : o.hair, roughness: .8 }),
    white: new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: .3 }),
    iris: new THREE.MeshStandardMaterial({ color: '#3d6b9a', roughness: .3 }),
    dark: new THREE.MeshStandardMaterial({ color: '#120808', roughness: .5 }),
    lip: new THREE.MeshStandardMaterial({ color: '#7a2f2a', roughness: .6 }),
    belt: new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: .6 }),
  };
}
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (parent) parent.add(m); return m; };
// tapered limb segment hanging DOWN from the parent's origin
function limb(parent, r0, r1, len, mat, y0 = 0) {
  const m = mesh(new THREE.CylinderGeometry(r0, r1, len, 12), mat, 0, y0 - len / 2, 0, parent);
  return m;
}
// a hand: palm + 4 fingers + thumb, fingers point DOWN (-y), palm faces inward (side = -1 left, +1 right)
function makeHand(skinMat, side, curl = .3) {
  const g = new THREE.Group();
  const palm = mesh(new THREE.SphereGeometry(.045, 12, 10), skinMat, 0, -.045, 0, g); palm.scale.set(.55, 1.05, 1);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group(); f.position.set(0, -.09, .028 - i * .019); g.add(f);
    const len = [.034, .04, .037, .028][i];
    mesh(new THREE.CapsuleGeometry(.0085, len, 3, 6), skinMat, 0, -len / 2, 0, f);
    f.rotation.z = -side * curl; fingers.push(f);
  }
  const th = new THREE.Group(); th.position.set(-side * .012, -.04, .04); g.add(th);
  mesh(new THREE.CapsuleGeometry(.01, .03, 3, 6), skinMat, 0, -.02, 0, th);
  th.rotation.set(.5, 0, -side * .5);
  g.userData.fingers = fingers; g.userData.thumb = th;
  return g;
}
function makeHead(m, o) {
  const g = new THREE.Group();                 // origin = base of the neck
  mesh(new THREE.CylinderGeometry(.048, .055, .11, 12), m.skin, 0, .05, 0, g);
  const skull = mesh(new THREE.SphereGeometry(.105, 24, 18), m.skin, 0, .19, 0, g); skull.scale.set(.95, 1.15, 1.05);
  const jaw = mesh(new THREE.SphereGeometry(.075, 16, 12), m.skin, 0, .13, .025, g); jaw.scale.set(1, .8, 1);
  const face = { eyes: [], pupils: [] };
  [-1, 1].forEach(s => {
    const eg = new THREE.Group(); eg.position.set(s * .038, .2, .088); g.add(eg);
    const w = mesh(new THREE.SphereGeometry(.019, 12, 10), m.white, 0, 0, 0, eg); w.scale.z = .6;
    const ir = mesh(new THREE.SphereGeometry(.0105, 10, 8), m.iris, 0, 0, .009, eg); ir.scale.z = .5;
    const pu = mesh(new THREE.SphereGeometry(.005, 8, 6), m.dark, 0, 0, .013, eg);
    mesh(new THREE.SphereGeometry(.0025, 6, 4), m.white, .004, .004, .016, eg);
    face.eyes.push(eg); face.pupils.push(pu);
    const brow = mesh(new THREE.CapsuleGeometry(.005, .028, 2, 6), m.hair, s * .038, .232, .098, g); brow.rotation.z = Math.PI / 2; face['brow' + (s < 0 ? 'L' : 'R')] = brow;
    const ear = mesh(new THREE.SphereGeometry(.026, 10, 8), m.skin, s * .1, .19, 0, g); ear.scale.set(.45, 1, .75);
  });
  const nose = mesh(new THREE.SphereGeometry(.016, 10, 8), m.skin, 0, .17, .108, g); nose.scale.set(.9, 1.35, 1.1);
  const mouth = mesh(new THREE.TorusGeometry(.024, .005, 6, 14, Math.PI), m.lip, 0, .138, .1, g); mouth.rotation.z = Math.PI;
  const mouthO = mesh(new THREE.SphereGeometry(.017, 12, 10), m.dark, 0, .13, .098, g); mouthO.scale.set(1, 1.3, .5); mouthO.visible = false;
  face.mouth = mouth; face.mouthO = mouthO;
  // hair: a cap that sits ABOVE the forehead + messy clumps
  const cap = mesh(new THREE.SphereGeometry(.112, 20, 12, 0, Math.PI * 2, 0, Math.PI * .5), m.hair, 0, .2, -.006, g);
  cap.scale.set(.98, 1.25, 1.1); cap.rotation.x = -.32;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const cl = mesh(new THREE.SphereGeometry(.04, 8, 6), m.hair, Math.cos(a) * .06, .3 + Math.random() * .01, Math.sin(a) * .06 - .02, g);
    cl.scale.set(1, .7, 1);
  }
  mesh(new THREE.SphereGeometry(.06, 10, 8), m.hair, 0, .23, -.07, g).scale.set(1.5, 1.3, .8);
  if (o.partyHat) {
    const hat = mesh(new THREE.ConeGeometry(.06, .16, 14), new THREE.MeshStandardMaterial({ color: '#ff4fa8' }), .02, .39, 0, g); hat.rotation.z = -.2;
    mesh(new THREE.SphereGeometry(.018, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd25a' }), .036, .47, 0, g);
  }
  g.userData.face = face; g.userData.skull = skull;
  return g;
}
function makeArm(m, side) {
  const g = new THREE.Group();                 // origin = shoulder joint
  mesh(new THREE.SphereGeometry(.058, 14, 10), m.shirt, 0, 0, 0, g);
  limb(g, .05, .046, .14, m.shirt, 0);          // short sleeve
  limb(g, .043, .038, .26, m.skin, -.02);       // upper arm
  const el = new THREE.Group(); el.position.y = -.28; g.add(el);
  mesh(new THREE.SphereGeometry(.039, 12, 10), m.skin, 0, 0, 0, el);
  limb(el, .037, .028, .25, m.skin, 0);
  const wr = new THREE.Group(); wr.position.y = -.25; el.add(wr);
  const hand = makeHand(m.skin, side, .4); wr.add(hand);
  g.rotation.z = side * .1; el.rotation.x = -.25;
  g.userData.elbow = el; g.userData.wrist = wr;
  return g;
}
function makeLeg(m, side) {
  const g = new THREE.Group();                 // origin = hip joint
  mesh(new THREE.SphereGeometry(.075, 14, 10), m.pants, 0, 0, 0, g);
  limb(g, .074, .055, .43, m.pants, 0);
  const kn = new THREE.Group(); kn.position.y = -.44; g.add(kn);
  mesh(new THREE.SphereGeometry(.056, 12, 10), m.pants, 0, 0, 0, kn);
  limb(kn, .052, .04, .4, m.pants, 0);
  const shoe = mesh(new THREE.SphereGeometry(.055, 14, 10), m.shoe, 0, -.43, .045, kn); shoe.scale.set(.85, .6, 1.9);
  mesh(new THREE.BoxGeometry(.085, .015, .2), m.belt, 0, -.455, .045, kn);
  kn.rotation.x = .04; g.rotation.z = side * .03;
  g.userData.knee = kn;
  return g;
}
// opts: {skin, shirt, hair, legs, gold, partyHat}
function makeHuman(o) {
  const m = mats(o);
  const root = new THREE.Group();
  const torso = new THREE.Group(); torso.position.y = .97; root.add(torso);
  const lathe = new THREE.LatheGeometry([[.0, -.06], [.13, -.06], [.155, 0], [.15, .1], [.14, .2], [.16, .33], [.185, .44], [.175, .5], [.11, .55], [.0, .56]].map(p => new THREE.Vector2(p[0], p[1])), 20);
  const chest = mesh(lathe, m.shirt, 0, 0, 0, torso); chest.scale.z = .62;
  const coll = mesh(new THREE.TorusGeometry(.06, .012, 6, 16), m.shirt, 0, .545, 0, torso); coll.rotation.x = Math.PI / 2;
  const belt = mesh(new THREE.TorusGeometry(.15, .018, 6, 20), m.belt, 0, -.02, 0, torso); belt.rotation.x = Math.PI / 2; belt.scale.y = .64;
  mesh(new THREE.BoxGeometry(.05, .04, .02), new THREE.MeshStandardMaterial({ color: '#c9a227', metalness: .8, roughness: .3 }), 0, -.02, .1, torso);
  if (o.legs) {
    const pelvis = mesh(new THREE.SphereGeometry(.16, 16, 12), m.pants, 0, -.07, 0, torso); pelvis.scale.set(1, .6, .66);
  }
  const parts = {};
  const head = makeHead(m, o); head.position.set(0, .52, .005); torso.add(head); parts.head = head;
  [-1, 1].forEach(s => {
    const a = makeArm(m, s); a.position.set(s * .2, .465, 0); torso.add(a); parts[s < 0 ? 'armL' : 'armR'] = a;
    if (o.legs) { const l = makeLeg(m, s); l.position.set(s * .088, -.07, 0); torso.add(l); parts[s < 0 ? 'legL' : 'legR'] = l; }
  });
  return { root, torso, parts, face: head.userData.face, mats: m };
}
