
/* ======================= ✨ Claude's materialize powers: the buddy spawns things on command =======================
   Chat / voice Claude sends (through the buddy, see CLAUDE-AVATAR.md):
     spawn <thing> [count] [color] [tiny|small|big|huge|giant|size N] [at me|buddy|X Z|X Y Z]
     despawn <thing|last|all>      spawnables
   Things poof in with sparkles + a chime. Only Claude-made things can be despawned. Live things are capped for the
   Quest: the oldest one poofs away when a new one would go over the cap. Dummies only ever go in the Slicing Yard's
   DUMMY TEST zone (Isaiah: no dummies in the lobby). Sliceable cubes only work in the yard / party (their physics lives there). */
const SP = { list: [], MAX: 24, CUBES: 10, mat: null, ghostMat: null, rbMat: null, geo: new Map(), seq: 0 };
const SP_COL = { red: 0xff4f6d, orange: 0xff9a3c, yellow: 0xffd25a, gold: 0xffc93a, green: 0x5fd94a, lime: 0xb6f04a, teal: 0x3fe0bd, cyan: 0x4fe3ff,
  blue: 0x3fb2ff, navy: 0x2a4a9a, purple: 0x9a6bff, violet: 0x8b6bff, pink: 0xff7fc8, hotpink: 0xff4fa8, white: 0xf4f4f4, black: 0x2a2a30,
  gray: 0x8a8f98, grey: 0x8a8f98, brown: 0x8a5a2b, silver: 0xc8d0d8, rainbow: -1 };
const SP_RAINBOW = [0xff4f6d, 0xff9a3c, 0xffd25a, 0x5fd94a, 0x3fb2ff, 0x9a6bff];
const SP_SIZE = { tiny: .45, mini: .45, small: .7, little: .7, big: 1.8, large: 1.8, huge: 2.8, giant: 3.8, mega: 3.8 };
const SP_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, few: 3, some: 3, lots: 8, many: 8 };

/* ---------- little model kit: parts get a vertex color and merge into ONE mesh (one draw call each, Quest friendly) ---------- */
function spMat() { return SP.mat || (SP.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 })); }
function spPart(L, geo, col, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  if (geo.index) { const g2 = geo.toNonIndexed(); geo.dispose(); geo = g2; }
  geo.deleteAttribute('uv'); L.push(rdT(rdCol(geo, col), x, y, z, sx, sy, sz, rx, ry, rz));
}
const spS = r => new THREE.SphereGeometry(r, 16, 12), spB = (x, y, z) => new THREE.BoxGeometry(x, y, z),
  spCy = (a, b, h, n = 16) => new THREE.CylinderGeometry(a, b, h, n), spCo = (r, h, n = 14) => new THREE.ConeGeometry(r, h, n),
  spTo = (R, r, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, 10, 28, arc);
function spGeo(key, build, c) {   // merged geometry, cached per thing + color so 10 ducks share one
  const k = key + ':' + c; if (SP.geo.has(k)) return SP.geo.get(k);
  const L = []; build(L, c); const g = mergeGeometries(L); L.forEach(x => x.dispose()); g.computeBoundingSphere(); SP.geo.set(k, g); return g;
}
function spMesh(key, build, c, m) { const me = new THREE.Mesh(spGeo(key, build, c), m || spMat()); me.castShadow = true; return me; }
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();

/* ---------- the catalog. t: toy (grabbable, Claude can grab/throw it too) | critter | float | fx | cube | dummy | game (the grove's own toys)
   r = radius at size 1 (toys bounce on a ball of this size), c = default color, e = emoji for the bubble ---------- */
const SP_THINGS = {
  ball: { t: 'game', e: '⚽' }, cone: { t: 'game', e: '🌰' }, star: { t: 'game', e: '⭐' },
  duck: { t: 'toy', r: .11, c: 0xffd25a, e: '🦆', b(L, c) { spPart(L, spS(.1), c, 0, -.02, .01, 1.15, .8, 1.3); spPart(L, spS(.062), c, 0, .07, -.07);
    spPart(L, spB(.06, .02, .06), 0xff8a3d, 0, .06, -.13); [-1, 1].forEach(s => { spPart(L, spS(.012), 0x1a1a1a, s * .032, .09, -.118); spPart(L, spS(.05), shade(c, .85), s * .085, -.01, .02, .35, .6, 1.1); });
    spPart(L, spCo(.035, .07), c, 0, .03, .12, 1, 1, 1, -1.1); } },
  donut: { t: 'toy', r: .1, c: 0xff7fc8, e: '🍩', b(L, c) { spPart(L, spTo(.065, .035), 0xd99a55, 0, 0, 0, 1, 1, 1, Math.PI / 2); spPart(L, spTo(.065, .03, Math.PI * 2), c, 0, .014, 0, 1, 1, .75, Math.PI / 2);
    for (let i = 0; i < 12; i++) { const a = i * 2.4; spPart(L, spB(.018, .006, .006), SP_RAINBOW[i % 6], Math.cos(a) * .066, .04, Math.sin(a) * .066, 1, 1, 1, 0, a * 3); } } },
  pizza: { t: 'toy', r: .12, c: 0xffd25a, e: '🍕', b(L, c) { spPart(L, spCy(.15, .15, .02, 3), c, 0, 0, 0, 1, 1, 1, 0, Math.PI / 2); spPart(L, spCy(.022, .022, .17, 8), 0xc98a45, .075, .005, 0, 1, 1, 1, Math.PI / 2);
    [[-.03, .03], [-.06, -.02], [.02, -.03], [-.09, .01]].forEach(([x, z]) => spPart(L, spCy(.022, .022, .008, 12), 0xc8323c, x, .013, z)); } },
  burger: { t: 'toy', r: .1, c: 0xd99a55, e: '🍔', b(L, c) { spPart(L, spS(.09), c, 0, .03, 0, 1, .5, 1); spPart(L, spCy(.085, .085, .025), 0x5a3420, 0, -.005, 0);
    spPart(L, spCy(.095, .09, .008, 10), 0x5fd94a, 0, .012, 0); spPart(L, spB(.15, .006, .15), 0xffc93a, 0, .018, 0, 1, 1, 1, 0, .7); spPart(L, spCy(.085, .08, .03), c, 0, -.035, 0);
    for (let i = 0; i < 6; i++) spPart(L, spS(.006), 0xfff1d0, Math.cos(i) * .05, .07, Math.sin(i * 1.7) * .05); } },
  apple: { t: 'toy', r: .08, c: 0xff4f6d, e: '🍎', b(L, c) { spPart(L, spS(.075), c, 0, 0, 0, 1, .92, 1); spPart(L, spCy(.006, .008, .05, 6), 0x6b4426, 0, .075, 0, 1, 1, 1, 0, 0, .2);
    spPart(L, spS(.025), 0x5fd94a, .022, .085, 0, 1, .35, .6, 0, 0, -.5); } },
  heart: { t: 'toy', r: .11, c: 0xff4fa8, e: '💖', b(L, c) { [-1, 1].forEach(s => spPart(L, spS(.06), c, s * .045, .035, 0, 1, 1, .7)); spPart(L, spCo(.098, .12, 18), c, 0, -.05, 0, 1, 1, .62, Math.PI); } },
  crown: { t: 'toy', r: .1, c: 0xffc93a, e: '👑', b(L, c) { spPart(L, spCy(.08, .075, .07, 20), c, 0, 0, 0); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3;
    spPart(L, spCo(.022, .055, 6), c, Math.cos(a) * .075, .06, Math.sin(a) * .075); spPart(L, spS(.012), SP_RAINBOW[i], Math.cos(a) * .081, .005, Math.sin(a) * .081); } } },
  present: { t: 'toy', r: .13, c: 0x3fb2ff, e: '🎁', b(L, c) { spPart(L, spB(.18, .16, .18), c); spPart(L, spB(.19, .165, .035), 0xffd25a); spPart(L, spB(.035, .165, .19), 0xffd25a);
    [-1, 1].forEach(s => spPart(L, spTo(.03, .011), 0xffd25a, s * .03, .095, 0, 1, 1, 1, 0, s * .6)); } },
  cupcake: { t: 'toy', r: .09, c: 0xff7fc8, e: '🧁', b(L, c) { spPart(L, spCy(.065, .045, .07, 12), 0x3fb2ff, 0, -.03, 0); spPart(L, spS(.07), c, 0, .02, 0, 1, .6, 1);
    spPart(L, spS(.05), c, 0, .055, 0, 1, .7, 1); spPart(L, spS(.02), 0xd9223c, 0, .1, 0); } },
  cake: { t: 'toy', r: .14, c: 0xffc4e1, e: '🎂', b(L, c) { spPart(L, spCy(.13, .13, .1, 24), c, 0, -.03, 0); spPart(L, spTo(.13, .012), 0xffffff, 0, .02, 0, 1, 1, 1, Math.PI / 2);
    spPart(L, spCy(.008, .008, .06, 6), 0x9adcff, 0, .05, 0); spPart(L, spS(.012), 0xffb020, 0, .088, 0, .8, 1.4, .8); for (let i = 0; i < 8; i++) spPart(L, spS(.014), 0xd9223c, Math.cos(i * .785) * .1, .025, Math.sin(i * .785) * .1); } },
  icecream: { t: 'toy', r: .11, c: 0xff9ec7, e: '🍦', b(L, c) { spPart(L, spCo(.05, .14, 12), 0xe0a860, 0, -.05, 0, 1, 1, 1, Math.PI); spPart(L, spS(.055), c, 0, .035, 0); spPart(L, spS(.045), 0xfff6e0, 0, .09, 0); spPart(L, spS(.015), 0xd9223c, 0, .135, 0); } },
  diamond: { t: 'toy', r: .1, c: 0x7fe8ff, e: '💎', b(L, c) { spPart(L, new THREE.OctahedronGeometry(.1, 0), c, 0, 0, 0, 1, 1.25, 1); } },
  trophy: { t: 'toy', r: .13, c: 0xffc93a, e: '🏆', b(L, c) { spPart(L, spCy(.07, .035, .1, 16), c, 0, .05, 0); spPart(L, spCy(.012, .012, .06, 8), c, 0, -.03, 0); spPart(L, spB(.09, .03, .09), shade(c, .7), 0, -.075, 0);
    [-1, 1].forEach(s => spPart(L, spTo(.028, .008), c, s * .075, .06, 0)); } },
  pumpkin: { t: 'toy', r: .13, c: 0xff8a3d, e: '🎃', b(L, c) { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; spPart(L, spS(.07), i % 2 ? c : shade(c, .9), Math.cos(a) * .045, 0, Math.sin(a) * .045, 1, .9, 1); }
    spPart(L, spCy(.012, .016, .05, 6), 0x5a7a2a, 0, .075, 0); } },
  snowman: { t: 'toy', r: .17, c: 0xf8fbff, e: '⛄', b(L, c) { spPart(L, spS(.1), c, 0, -.07, 0); spPart(L, spS(.075), c, 0, .07, 0); spPart(L, spS(.055), c, 0, .18, 0);
    spPart(L, spCo(.012, .07, 8), 0xff8a3d, 0, .18, -.08, 1, 1, 1, -Math.PI / 2); [-1, 1].forEach(s => spPart(L, spS(.009), 0x1a1a1a, s * .02, .2, -.048));
    spPart(L, spCy(.04, .04, .06, 14), 0x2a2a30, 0, .245, 0); spPart(L, spCy(.06, .06, .008, 14), 0x2a2a30, 0, .215, 0); spPart(L, spTo(.06, .014), 0xff4f6d, 0, .13, 0, 1, 1, 1, Math.PI / 2); } },
  rock: { t: 'toy', r: .11, c: 0x8a8f98, e: '🪨', b(L, c) { spPart(L, new THREE.DodecahedronGeometry(.1, 0), c, 0, 0, 0, 1.1, .8, 1); } },
  sword: { t: 'toy', r: .14, c: 0xc8d0d8, e: '🗡️', b(L, c) { spPart(L, spB(.035, .3, .008), c, 0, .07, 0); spPart(L, spCo(.0175, .04, 4), c, 0, .24, 0, 1, 1, .25, 0, Math.PI / 4);   // a foam toy sword (the yard's real one is the slicer)
    spPart(L, spB(.11, .022, .03), 0xffc93a, 0, -.08, 0); spPart(L, spCy(.014, .014, .09, 8), 0x6b4426, 0, -.135, 0); spPart(L, spS(.02), 0xffc93a, 0, -.185, 0); } },
  box: { t: 'toy', r: .14, c: 0x3fb2ff, e: '📦', b(L, c) { spPart(L, spB(.2, .2, .2), c); } },
  sphere: { t: 'toy', r: .13, c: 0x9a6bff, e: '🔮', b(L, c) { spPart(L, new THREE.SphereGeometry(.13, 22, 16), c); } },
  pillar: { t: 'toy', r: .14, c: 0xf4f4f4, e: '🏛️', b(L, c) { spPart(L, spCy(.07, .07, .26, 18), c); } },
  pyramid: { t: 'toy', r: .13, c: 0xffd25a, e: '🔺', b(L, c) { spPart(L, spCo(.13, .2, 4), c, 0, 0, 0, 1, 1, 1, 0, Math.PI / 4); } },
  ring: { t: 'toy', r: .12, c: 0xffc93a, e: '💍', b(L, c) { spPart(L, spTo(.09, .028), c); } },
  plush: { t: 'toy', r: .16, e: '🧸' },   // the teal sprout bear (87-plush.js)
  balloon: { t: 'float', c: 0xff4f6d, e: '🎈' },
  bunny: { t: 'critter', c: 0xf4f0ea, e: '🐰' }, chick: { t: 'critter', c: 0xffd84f, e: '🐥' }, puppy: { t: 'critter', c: 0xd9a066, e: '🐶' },
  ghost: { t: 'critter', c: 0xeef4ff, e: '👻' }, butterfly: { t: 'critter', c: 0x9a6bff, e: '🦋' },
  firework: { t: 'fx', e: '🎆' }, confetti: { t: 'fx', e: '🎉' }, rainbow: { t: 'fx', e: '🌈' },
  cube: { t: 'cube', k: -1, e: '🧊' }, megacube: { t: 'cube', k: 6, e: '🟪' }, butter: { t: 'cube', k: 5, e: '🧈' }, glasscube: { t: 'cube', k: 11, e: '🪟' }, rainbowcube: { t: 'cube', k: 12, e: '🌈' },
  dummy: { t: 'dummy', e: '🧸' },
};
const SP_ALIAS = { pinecone: 'cone', soccerball: 'ball', bear: 'plush', teddy: 'plush', teddybear: 'plush', sproutbear: 'plush', gift: 'present', block: 'box', crate: 'box',
  orb: 'sphere', cylinder: 'pillar', column: 'pillar', bunnyrabbit: 'bunny', rabbit: 'bunny', bird: 'chick', chicken: 'chick', dog: 'puppy', doggy: 'puppy', puppies: 'puppy',
  rubberduck: 'duck', ducky: 'duck', icecreamcone: 'icecream', gem: 'diamond', crystal: 'diamond', cup: 'trophy', boulder: 'rock', stone: 'rock', jackolantern: 'pumpkin',
  fireworks: 'firework', rocket: 'firework', party: 'confetti', glass: 'glasscube', rainbowglass: 'rainbowcube', mega: 'megacube', megacubes: 'megacube',
  butterblock: 'butter', ragdoll: 'dummy', dummies: 'dummy', target: 'dummy', toysword: 'sword', snowmen: 'snowman', birthdaycake: 'cake', boo: 'ghost', ballon: 'balloon' };
function spFind(name) {
  name = (name || '').toLowerCase().replace(/[^a-z]/g, ''); if (!name) return null;
  for (const n of [name, name.replace(/ies$/, 'y'), name.replace(/es$/, ''), name.replace(/s$/, '')]) { if (SP_THINGS[n]) return n; if (SP_ALIAS[n]) return SP_ALIAS[n]; }
  return null;
}

/* ---------- where: in front of Isaiah, in front of the buddy, or world coordinates ---------- */
const _spA = V(), _spB = V(), _spF = V();
function spGround(x, y, z) { if (state.area === 'wilds') return groundAt(x, z); const g = rdGround(x, y, z); return g === null ? y : g; }
function spWhere(at) {   // returns { p: ground point, f: forward from it toward where things go }
  clPlayer(_spA); camera.getWorldDirection(_spF); _spF.y = 0; if (_spF.lengthSq() < 1e-4) _spF.set(0, 0, -1); _spF.normalize();
  if (Array.isArray(at)) { const p = at.length === 3 ? V(at[0], at[1], at[2]) : V(at[0], 0, at[1]); if (at.length === 2) p.y = spGround(p.x, _spA.y + 2, p.z); return { p, f: _spF.clone() }; }
  if (at === 'buddy' && CL.on) { const f = _spB.subVectors(_spA, CL.B).setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, 1); f.normalize(); const p = V().copy(CL.B).addScaledVector(f, .75); p.y = spGround(p.x, CL.B.y, p.z); return { p, f: f.clone() }; }
  const p = V().copy(_spA).addScaledVector(_spF, 1.5); p.y = spGround(p.x, _spA.y + .5, p.z); return { p, f: _spF.clone() };
}
function spParse(arg) {
  const w = String(arg).toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean), o = { what: '', n: 1, col: null, size: 1, at: 'me' }, isN = s => s !== undefined && /^-?\d+(\.\d+)?$/.test(s);
  for (let i = 0; i < w.length; i++) {
    const t = w[i];
    if (t === 'at' || t === 'near' || t === 'by' || t === 'next') {
      if (w[i + 1] === 'to') i++;
      const a = w[i + 1];
      if (['me', 'isaiah', 'player', 'him', 'her', 'us', 'here'].includes(a)) { o.at = 'me'; i++; }
      else if (['buddy', 'claude', 'you', 'yourself'].includes(a)) { o.at = 'buddy'; i++; }
      else if (isN(a) && isN(w[i + 2])) { o.at = [+a, +w[i + 2]]; i += 2; if (isN(w[i + 1])) { o.at.push(+w[++i]); } }
      continue;
    }
    if (t === 'size' && isN(w[i + 1])) { o.size = +w[++i]; continue; }
    if (SP_SIZE[t]) { o.size = SP_SIZE[t]; continue; }
    if (isN(t)) { o.n = +t; continue; }
    if (SP_NUM[t] && !o.what) { o.n = SP_NUM[t]; continue; }
    if (t in SP_COL) { o.col = SP_COL[t]; continue; }
    if (/^#[0-9a-f]{6}$/.test(t)) { o.col = parseInt(t.slice(1), 16); continue; }
    if (['the', 'of', 'please', 'for', 'me'].includes(t)) continue;
    o.what += t;   // "ice cream" -> icecream, "mega cube" -> megacube
  }
  o.n = clamp(Math.round(o.n) || 1, 1, 10); o.size = clamp(o.size, .3, 4);
  return o;
}

/* ---------- poof! sparkles + a chime ---------- */
function spPoof(pos, col, k = 1) {
  confetti(pos, Math.round((state.xr ? 14 : 26) * Math.min(2, k)), [col >= 0 ? col : 0xff7fc8, 0xffffff, 0xffd25a, 0x9adcff]);
  if (!ac) return; [1046, 1318, 1568, 2093].forEach((f, i) => tone('sine', f, f * 1.01, .16, .05, i * .045)); tone('triangle', 260, 820, .14, .06);
}
function spPoofOut(pos, col) { confetti(pos, state.xr ? 8 : 14, [col >= 0 ? col : 0xffffff, 0xffffff]); if (ac) { tone('sine', 1400, 500, .16, .05); tone('triangle', 700, 260, .12, .04, .03); } }
const spPop = x => x >= 1 ? 1 : 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2;   // ease-out-back: grows a tiny bit too big, then settles

/* ---------- making things ---------- */
function spColor(o, def, i) { return o.col === -1 ? SP_RAINBOW[(SP.seq + i) % 6] : o.col !== null ? o.col : def; }
function spToy(name, o, i, at) {
  const T = SP_THINGS[name], s = o.size, c = spColor(o, T.c, i);
  let g;
  if (name === 'plush') { g = new THREE.Group(); const b = buildPlush(.32 * s); b.position.y = -.16 * s; g.add(b); }
  else { g = new THREE.Group(); const m = spMesh(name, T.b, c); m.scale.setScalar(s); g.add(m); }
  g.position.copy(at); g.scale.setScalar(.01); scene.add(g);
  const p = { kind: name, g, r: T.r * s, vel: V((Math.random() - .5) * .6, 1.6, (Math.random() - .5) * .6), held: null, rest: false, home: at.clone(), info: { nrm: V(), ground: false, bounce: null, col: null }, w: V(Math.random() - .5, Math.random() - .5, Math.random() - .5), spawned: true };
  props.push(p);
  return { t: 'toy', name, obj: p, g, s, c };
}
function spBalloon(o, i, at) {
  const c = spColor(o, SP_COL.red, i), s = o.size, g = new THREE.Group();
  const m = spMesh('balloon', (L, c) => { spPart(L, spS(.15), c, 0, .17, 0, .92, 1.1, .92); spPart(L, spCo(.025, .035, 8), c, 0, .01, 0, 1, 1, 1, Math.PI); spPart(L, spS(.03), 0xffffff, -.05, .26, -.1, .6, 1, .5);
    spPart(L, spCy(.003, .003, .7, 4), 0xffffff, 0, -.34, 0); }, c);
  m.scale.setScalar(s); g.add(m); g.position.copy(at); g.scale.setScalar(.01); scene.add(g);
  return { t: 'float', name: 'balloon', g, s, c, base: at.y, ph: Math.random() * 6, life: 40 + Math.random() * 10 };
}
// critters: a body mesh plus the bits that move (legs, wings, tail, ears)
function spCritter(name, o, i, at, f) {
  const c = spColor(o, SP_THINGS[name].c, i), s = o.size, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const parts = {}, sub = (key, build, x, y, z) => { const piv = new THREE.Group(); piv.position.set(x, y, z); piv.add(spMesh(name + key, build, c, name === 'ghost' ? spGhostMat() : null)); body.add(piv); return piv; };
  if (name === 'bunny') {
    body.add(spMesh('bunny', (L, c) => { spPart(L, spS(.12), c, 0, .12, .02, 1, .9, 1.2); spPart(L, spS(.085), c, 0, .22, -.11); spPart(L, spS(.045), 0xffffff, 0, .13, .16);
      [-1, 1].forEach(s => { spPart(L, spS(.014), 0x1a1a1a, s * .045, .245, -.18); spPart(L, spS(.04), c, s * .07, .03, .07, .8, .5, 1.4); });
      spPart(L, spS(.014), 0xff8fb0, 0, .215, -.19); }, c));
    parts.ears = [-1, 1].map(s => { const e = sub('ear', (L, c) => { spPart(L, spS(.03), c, 0, .08, 0, 1, 2.8, .5); spPart(L, spS(.018), 0xffb3c8, 0, .08, -.01, 1, 2.4, .3); }, s * .04, .28, -.1); e.rotation.z = -s * .2; return e; });
  } else if (name === 'chick') {
    body.add(spMesh('chick', (L, c) => { spPart(L, spS(.1), c, 0, .13, 0, 1, .95, 1.05); spPart(L, spS(.07), c, 0, .25, -.03);
      spPart(L, spCo(.025, .05, 8), 0xff8a3d, 0, .24, -.11, 1, 1, 1, -Math.PI / 2); [-1, 1].forEach(s => spPart(L, spS(.012), 0x1a1a1a, s * .035, .27, -.085));
      spPart(L, spCo(.02, .05, 6), c, 0, .33, -.02); }, c));
    parts.legs = [-1, 1].map(s => sub('leg', L => { spPart(L, spCy(.008, .008, .05, 5), 0xff8a3d, 0, -.025, 0); spPart(L, spB(.035, .008, .04), 0xff8a3d, 0, -.05, -.01); }, s * .04, .05, 0));
    parts.wings = [-1, 1].map(s => sub('wing', (L, c) => spPart(L, spS(.05), shade(c, .9), 0, -.03, 0, .35, .8, 1), s * .1, .17, 0));
  } else if (name === 'puppy') {
    body.add(spMesh('puppy', (L, c) => { spPart(L, spS(.1), c, 0, .2, 0, .85, .8, 1.4); spPart(L, spS(.085), c, 0, .3, -.15); spPart(L, spS(.045), 0xf4e6d0, 0, .27, -.22, 1, .8, 1.1);
      spPart(L, spS(.016), 0x1a1a1a, 0, .29, -.27); [-1, 1].forEach(s => { spPart(L, spS(.013), 0x1a1a1a, s * .035, .33, -.215); spPart(L, spS(.04), shade(c, .7), s * .075, .3, -.13, .5, 1.3, .8, 0, 0, s * .3); });
      spPart(L, spTo(.06, .012), 0xff4f6d, 0, .24, -.1, 1, 1, 1, Math.PI / 2 - .5); }, c));
    parts.legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => sub('leg', (L, c) => { spPart(L, spCy(.022, .02, .12, 8), c, 0, -.06, 0); spPart(L, spS(.026), 0xf4e6d0, 0, -.12, -.008, 1, .7, 1.2); }, x * .055, .14, z * .09));
    parts.tail = sub('tail', (L, c) => spPart(L, spCo(.018, .1, 6), c, 0, .045, 0), 0, .25, .14); parts.tail.rotation.x = .7;
  } else if (name === 'ghost') {
    body.add(spMesh('ghost', (L, c) => { spPart(L, spS(.16), c, 0, .1, 0, 1, 1.05, 1); spPart(L, spCy(.16, .19, .2, 18), c, 0, -.05, 0);
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; spPart(L, spCo(.05, .09, 8), c, Math.cos(a) * .14, -.19, Math.sin(a) * .14, 1, 1, 1, Math.PI); }
      [-1, 1].forEach(s => spPart(L, spS(.03), 0x1a1a2a, s * .055, .14, -.145, 1, 1.4, .5)); spPart(L, spS(.03), 0x1a1a2a, 0, .06, -.155, 1, 1, .5); }, c, spGhostMat()));
    parts.arms = [-1, 1].map(s => sub('arm', (L, c) => spPart(L, spS(.045), c, s * .03, 0, 0, 1.2, .6, .7), s * .17, .02, -.02));
  } else {   // butterfly
    body.add(spMesh('butterfly', L => { spPart(L, spCy(.012, .008, .12, 6), 0x2a2a30, 0, 0, 0, 1, 1, 1, Math.PI / 2); spPart(L, spS(.016), 0x2a2a30, 0, 0, -.07);
      [-1, 1].forEach(s => spPart(L, spCy(.002, .002, .06, 3), 0x2a2a30, s * .015, .03, -.09, 1, 1, 1, -.6, 0, s * .4)); }, c));
    parts.wings = [-1, 1].map(s => sub('wing' + s, (L, c) => { spPart(L, spS(.06), c, s * .06, 0, -.02, 1, .12, .9); spPart(L, spS(.045), shade(c, .75), s * .05, 0, .05, 1, .12, .8);
      spPart(L, spS(.015), 0xffffff, s * .07, .008, -.03, 1, .3, 1); }, 0, 0, 0));
  }
  g.scale.setScalar(.01); g.position.copy(at); g.rotation.y = Math.atan2(f.x, f.z); scene.add(g);
  const y = name === 'ghost' ? at.y + .9 * s : name === 'butterfly' ? at.y + 1.2 : at.y;
  g.position.y = y;
  return { t: 'critter', name, g, body, parts, s, c, home: at.clone(), gy: at.y, tgt: null, hopT: -1, wait: Math.random() * 1.2, ph: Math.random() * 6, from: V(), pet: 0, petT: 0 };
}
function spGhostMat() { return SP.ghostMat || (SP.ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, transparent: true, opacity: .78, emissive: 0x334466, emissiveIntensity: .35 })); }
function spFirework(o, i, at) {
  const c = spColor(o, SP_RAINBOW[(SP.seq + i) % 6], i), g = new THREE.Group();
  g.add(spMesh('rocket', (L, c) => { spPart(L, spCy(.035, .035, .22, 10), c); spPart(L, spCo(.045, .09, 10), 0xffffff, 0, .155, 0); spPart(L, spCy(.004, .004, .2, 4), 0x8a5a2b, .045, -.1, 0); }, c));
  g.position.copy(at).add(V(0, .15, 0)); scene.add(g);
  return { t: 'fx', name: 'firework', g, s: 1, c, vy: 0, fuse: .25 + i * .35, sparkT: 0, boomed: false };
}
function spRainbow(o, at, f) {
  const s = o.size, g = new THREE.Group();
  if (!SP.rbMat) SP.rbMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(spGeo('rainbow', L => [0xff4f6d, 0xff9a3c, 0xffd25a, 0x5fd94a, 0x3fb2ff, 0x9a6bff].forEach((cc, k) => spPart(L, spTo(4 - k * .22, .11, Math.PI), cc, 0, 0, 0, 1, 1, .25))), SP.rbMat.clone());
  m.scale.setScalar(s); g.add(m);
  g.position.copy(at).addScaledVector(f, 5 * s); g.position.y -= .3; g.rotation.y = Math.atan2(f.x, f.z); scene.add(g);
  return { t: 'fx', name: 'rainbow', g, s, c: -1, life: 30, age: 0 };
}

/* ---------- spawn / despawn / list ---------- */
function spAdd(e) { e.born = tAll; e.pop = 0; e.id = ++SP.seq; SP.list.push(e);
  const live = SP.list.filter(x => !x.die && x.t !== 'fx');
  if (live.length > SP.MAX) spKill(live[0]);
  if (e.t === 'cube') { const cubes = SP.list.filter(x => !x.die && x.t === 'cube'); if (cubes.length > SP.CUBES) spKill(cubes[0]); }
}
function spKill(e, quiet) {
  if (e.die) return; e.die = 1;
  const pos = e.g ? e.g.position : e.obj && e.obj.body ? V().copy(e.obj.body.translation()).add(ARENA) : null;
  if (!quiet && pos) spPoofOut(pos.clone(), e.c);
}
function spRemove(e) {
  SP.list.splice(SP.list.indexOf(e), 1);
  if (e.t === 'toy') { const p = e.obj; if (p.held) { p.held.holding = null; p.held = null; } const i = props.indexOf(p); if (i >= 0) props.splice(i, 1); }
  if (e.t === 'cube') { const pc = e.obj; if (pc.body && !pc.dying) { pc.dying = .3; sendKill([pc]); } }
  if (e.t === 'dummy') { if (RD.list.includes(e.obj)) rdKill(e.obj); }
  if (e.g) { scene.remove(e.g); if (e.name === 'rainbow') e.g.children[0].material.dispose(); }
}
function spawnThing(arg) {
  const o = spParse(arg), name = spFind(o.what);
  if (!name) { clBubble(o.what ? `I don't know how to make "${o.what}" yet 🤔` : 'Spawn what? 🤔', 3); clOut({ ev: 'error', msg: "can't spawn: " + (o.what || '(nothing)'), know: Object.keys(SP_THINGS) }); return .3; }
  const T = SP_THINGS[name], W = spWhere(o.at), side = V(-W.f.z, 0, W.f.x); audioOn();
  let made = 0, note = '';
  if (T.t === 'dummy') {   // ONLY in the Slicing Yard's DUMMY TEST zone, never in the lobby
    if (!AV.tpl) { clBubble('🧸 Dummies are still loading, try again in a sec!', 3); return .3; }
    for (let i = 0; i < Math.min(o.n, RD.MAX); i++) {
      const own = SP.list.filter(x => x.t === 'dummy' && !x.die && RD.list.includes(x.obj));
      if (RD.list.length >= RD.MAX) { const old = own[0] ? own[0] : null; if (old) spKill(old, true), spRemove(old); else rdKill(RD.list.find(r => !r.home) || RD.list[0]); }
      const a = Math.random() * Math.PI * 2, base = V().copy(ARENA).add(V(-4.5 + Math.cos(a) * .9, .06, 1.7 + Math.sin(a) * .6));
      const rd = rdSpawnAt(base, Math.atan2(AR_SPAWN.x + 4.5, AR_SPAWN.z - 1.7) * .4); rdTorsoFrame(rd); rdDraw(rd, 0);
      rdBurst(V().copy(base).add(V(0, .6, 0)), V(0, 1, 0), 10, base.y); spPoof(V().copy(base).add(V(0, .9, 0)), 0xffd25a);
      spAdd({ t: 'dummy', name, obj: rd, c: 0xffd25a }); made++;
    }
    if (state.area !== 'arena' || clPlayer(_spA).distanceTo(V().copy(ARENA).add(V(-4.5, 0, 1.5))) > 30) note = ' in the DUMMY TEST zone of the Slicing Yard';
  } else if (T.t === 'cube') {
    if (!AR.ready || state.area !== 'arena') { clBubble('🔪 Sliceable cubes only work in the Slicing Yard or the party! Go there and ask again.', 4); clOut({ ev: 'error', msg: 'cubes only spawn in the Slicing Yard / party (area arena)', area: state.area }); return .3; }
    const cols = [0xff4f6d, 0xff9a3c, 0x5fd94a, 0x3fb2ff, 0x9a6bff];
    for (let i = 0; i < o.n; i++) {
      let k = T.k; if (k < 0) { k = o.col !== null && o.col >= 0 ? cols.reduce((b, cc, j) => Math.abs(cc - o.col) < Math.abs(cols[b] - o.col) ? j : b, 0) : o.col === -1 ? i % 5 : Math.floor(Math.random() * 5); if (o.col !== null && o.col >= 0 && !cols.includes(o.col)) k = Math.floor(Math.random() * 5); }
      const at = V().copy(W.p).addScaledVector(side, (i - (o.n - 1) / 2) * .45).add(V(0, 1.2 + i * .05 + (k === 6 ? .6 : 0), 0));
      const pc = spawnCube(k, at.clone().sub(ARENA), true); if (!pc) continue;
      spPoof(at, KINDS[k].out); spAdd({ t: 'cube', name, obj: pc, c: KINDS[k].out }); made++;
    }
  } else if (T.t === 'game') {
    for (let i = 0; i < o.n; i++) { const at = V().copy(W.p).addScaledVector(side, (i - (o.n - 1) / 2) * .35).add(V(0, 1.1, 0)); const p = makeProp(name, at.x, at.y, at.z); p.spawned = true; p.vel.set(0, 1.2, 0);
      p.g.scale.setScalar(.01); spPoof(at, 0xffd25a); spAdd({ t: 'toy', name, obj: p, g: p.g, s: 1, c: 0xffd25a }); made++; }
  } else if (T.t === 'fx' && name === 'confetti') {
    for (let i = 0; i < o.n; i++) confetti(V().copy(W.p).add(V((Math.random() - .5) * 1.5, 1.6 + Math.random() * .6, (Math.random() - .5) * 1.5)), state.xr ? 50 : 90);
    if (ac) [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .14, .08, i * .08)); made = o.n;
  } else if (T.t === 'fx' && name === 'rainbow') {
    SP.list.filter(x => x.name === 'rainbow' && !x.die).forEach(x => spKill(x, true));
    const e = spRainbow(o, W.p, W.f); spAdd(e); if (ac) [784, 988, 1175, 1568, 1976].forEach((f, i) => tone('sine', f, f, .3, .05, i * .09)); made = 1;
  } else {
    for (let i = 0; i < o.n; i++) {
      const ring = o.n === 1 ? 0 : (.3 + .12 * o.n) * Math.max(1, o.size * .6), a = i / o.n * Math.PI * 2;
      const at = V().copy(W.p).addScaledVector(side, Math.cos(a) * ring).addScaledVector(W.f, Math.sin(a) * ring * .6);
      let e;
      if (T.t === 'toy') { at.y += (1 + i * .08) * Math.max(1, o.size * .6); e = spToy(name, o, i, at); }
      else if (T.t === 'float') { at.y += 1.1; e = spBalloon(o, i, at); }
      else if (T.t === 'critter') { at.y = spGround(at.x, W.p.y + .5, at.z); e = spCritter(name, o, i, at, W.f); }
      else e = spFirework(o, i, at);
      spAdd(e); spPoof(V().copy(e.g.position).add(V(0, .1, 0)), e.c, o.size); made++;
    }
  }
  if (CL.on && !CL.speaking) { clBubble(`✨ Poof! ${T.e}${made > 1 ? ' x' + made : ''}${note}`, 2.5); if (!CL.anim) { CL.anim = 'wave'; CL.animT = 0; } }
  const live = SP.list.filter(x => !x.die).length;
  clOut({ ev: 'spawned', what: name, n: made, at: o.at, area: state.area || 'grove', live, cap: SP.MAX });
  return .35;
}
function despawnThing(arg) {
  const w = String(arg).toLowerCase().trim() || 'last', live = SP.list.filter(x => !x.die);
  let kill = [];
  if (w === 'all' || w === 'everything') kill = live;
  else if (w === 'last' || w === 'it' || w === 'that') kill = live.slice(-1);
  else { const n = spFind(w); kill = n ? live.filter(x => x.name === n) : []; }
  kill.forEach(e => spKill(e));
  if (!kill.length) clBubble('Nothing like that to poof away 🤷', 2.5);
  else if (CL.on && !CL.speaking) clBubble(`💨 Poof! Gone${kill.length > 1 ? ' x' + kill.length : ''}`, 2);
  clOut({ ev: 'despawned', n: kill.length, live: live.length - kill.length });
  return .3;
}
function spawnables() {
  const by = {}; for (const [k, v] of Object.entries(SP_THINGS)) (by[v.t] = by[v.t] || []).push(k);
  clOut({ ev: 'spawnables', toys: [...by.game, ...by.toy], critters: by.critter, floaty: by.float, effects: by.fx, yard_only_cubes: by.cube, dummy: 'only in the Slicing Yard DUMMY TEST zone',
    colors: Object.keys(SP_COL), sizes: Object.keys(SP_SIZE).concat(['size N (0.3-4)']), live: SP.list.filter(x => !x.die).length, cap: SP.MAX });
  if (CL.on && !CL.speaking) clBubble('✨ I can make toys, food, critters, balloons, fireworks, rainbows, cubes + dummies!', 4);
  return .3;
}
Object.assign(CL_EXT, { spawn: spawnThing, make: spawnThing, summon: spawnThing, despawn: despawnThing, unspawn: despawnThing, spawnables, spawnlist: spawnables });

/* ---------- every frame: grow in, shrink out, critters wander, balloons bob, fireworks fly ---------- */
const _spH = V(), _spD = V();
function spHandNear(pos, r) { for (const h of hands) if (h.tracked && h.pos.distanceTo(pos) < r) return h; return null; }
function stepSpawn(dt) {
  if (!SP.list.length) return;
  clPlayer(_spA);
  for (let i = SP.list.length - 1; i >= 0; i--) {
    const e = SP.list[i];
    if (e.die) { e.die -= dt * 3; if (e.g) e.g.scale.setScalar(Math.max(.001, e.die) * (e.t === 'toy' ? 1 : e.s)); if (e.die <= 0 || !e.g) spRemove(e); continue; }
    if (e.pop < 1) { e.pop = Math.min(1, e.pop + dt * 2.6); if (e.g && e.name !== 'rainbow') e.g.scale.setScalar(Math.max(.01, spPop(e.pop)) * (e.t === 'toy' ? 1 : e.t === 'critter' ? e.s : 1)); }
    const age = tAll - e.born;
    if (e.t === 'toy') { if (e.obj.g.position.y < -9) spKill(e, true); spDuck(e, dt); }
    else if (e.t === 'cube') { if (!e.obj.body || e.obj.dying || !AR.pieces.includes(e.obj)) spRemove(e); }
    else if (e.t === 'dummy') { if (!RD.list.includes(e.obj)) spRemove(e); }
    else if (e.t === 'float') {   // balloon: rises a bit, bobs, pops when touched, floats away after a while
      const g = e.g, up = Math.min(1, age / 1.4); e.ph += dt;
      g.position.y = e.base + up * .9 + Math.sin(e.ph * 1.7) * .06 + (age > e.life ? (age - e.life) ** 2 * .4 : 0);
      g.position.x += Math.sin(e.ph * .7) * dt * .05; g.rotation.z = Math.sin(e.ph * 1.3) * .08;
      if (spHandNear(_spH.copy(g.position).add(V(0, .17 * e.s, 0)), .18 * e.s + .06) || age > e.life + 4) { spBalloonPop(e); continue; }
    } else if (e.t === 'critter') spStepCritter(e, dt, age);
    else if (e.name === 'firework') spStepFirework(e, dt);
    else if (e.name === 'rainbow') { e.age += dt; const m = e.g.children[0].material; m.opacity = Math.min(.75, e.age * .5, Math.max(0, (e.life - e.age) * .4)); if (e.age > e.life) spRemove(e); }
  }
}
function spBalloonPop(e) {
  confetti(V().copy(e.g.position).add(V(0, .17 * e.s, 0)), state.xr ? 14 : 24, [e.c, 0xffffff]);
  if (ac) { tone('square', 1100, 160, .07, .12); tone('sine', 300, 80, .1, .1); }
  e.die = .001; e.g.visible = false;
}
let SP_DUCK = 0, SP_DUCKT = 0;
function spDuck(e, dt) {   // poke a rubber duck and it squeaks (keep poking...)
  if (e.name !== 'duck' || e.obj.held) return; e.qt = (e.qt || 0) - dt;
  if (e.qt > 0 || !spHandNear(e.obj.g.position, e.obj.r + .07)) return;
  e.qt = .35; if (ac) { tone('square', 900, 1400, .06, .05); tone('square', 1300, 700, .09, .05, .06); }
  e.obj.vel.y += 1.2; e.obj.rest = false;
  if (tAll - SP_DUCKT > 4) SP_DUCK = 0; SP_DUCKT = tAll;
  if (++SP_DUCK >= 5) { SP_DUCK = 0;   // 🤫
    const m = e.g.children[0]; m.geometry = spGeo('duck', SP_THINGS.duck.b, 0xffc93a); m.material = SP.goldMat || (SP.goldMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .9, roughness: .2, emissive: 0x553300, emissiveIntensity: .4 }));
    confetti(e.obj.g.position.clone(), 60, [0xffc93a, 0xfff1b8, 0xffffff]); if (ac) [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, .2, .08, i * .1)); toast('🦆✨ GOLDEN DUCK! Quack-tastic!', 3); }
}
function spStepCritter(e, dt, age) {
  const g = e.g, P = e.parts, s = e.s; e.ph += dt;
  // pet it: hearts + a happy sound
  e.petT -= dt;
  if (e.petT <= 0 && spHandNear(_spH.copy(g.position).add(V(0, .2 * s, 0)), .22 * s + .08)) { e.petT = .8; hearts(_spH.clone().add(V(0, .2, 0))); if (ac) tone('sine', 700, 1100, .12, .06); }
  if (e.name === 'ghost' || e.name === 'butterfly') {   // flyers drift around Isaiah
    if (!e.tgt || g.position.distanceTo(e.tgt) < .3 || (e.wait -= dt) < 0) { const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 1.8;
      e.tgt = V(_spA.x + Math.cos(a) * r, _spA.y + (e.name === 'ghost' ? 1.1 + Math.random() * .7 : .8 + Math.random() * 1.2), _spA.z + Math.sin(a) * r); e.wait = 4 + Math.random() * 3; }
    _spD.subVectors(e.tgt, g.position); const d = _spD.length(), sp = e.name === 'ghost' ? .55 : 1.1;
    if (d > .01) { g.position.addScaledVector(_spD, Math.min(1, sp * dt / d)); const yaw = Math.atan2(-_spD.x, -_spD.z); g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 3); }
    if (e.name === 'ghost') { e.body.position.y = Math.sin(e.ph * 2) * .06; e.body.rotation.z = Math.sin(e.ph * 1.3) * .12; P.arms.forEach((a, k) => { a.rotation.z = (k ? -1 : 1) * (.4 + Math.sin(e.ph * 3 + k) * .35); }); }
    else { const f = Math.sin(e.ph * 26) * .9; P.wings[0].rotation.z = f; P.wings[1].rotation.z = -f; e.body.position.y = Math.sin(e.ph * 4) * .05; }
    return;
  }
  // walkers: pick a spot near Isaiah (or home), go there, rest, repeat
  const near = g.position.distanceTo(_spA) < 12;
  if (!e.tgt) { if ((e.wait -= dt) > 0) { spIdle(e, dt); return; }
    const c = near ? _spA : e.home, a = Math.random() * Math.PI * 2, r = (e.name === 'puppy' ? .9 : 1.2) + Math.random() * 1.6;
    e.tgt = V(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r); e.tgt.y = spGround(e.tgt.x, g.position.y + .6, e.tgt.z); e.from.copy(g.position); e.hopT = 0; }
  _spD.subVectors(e.tgt, g.position).setY(0); const d = _spD.length();
  const yaw = Math.atan2(-_spD.x, -_spD.z); g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 6);
  if (e.name === 'bunny') {   // hop, hop, hop
    e.hopT += dt * 2.3; const k = e.hopT % 1, hop = Math.sin(k * Math.PI);
    if (d > .05) g.position.addScaledVector(_spD, Math.min(1, dt * .9 * s / d) * (k < 1 ? 1.3 : 0));
    g.position.y += ((e.tgt.y + hop * .22 * s) - g.position.y) * Math.min(1, dt * 14);
    e.body.scale.set(1 + (1 - hop) * .12, 1 - (1 - hop) * .18 + hop * .1, 1); e.body.rotation.x = (k - .5) * .5;
    P.ears.forEach((ea, j) => { ea.rotation.x = .2 + hop * .5; });
    if (d < .1 && k > .9) { e.tgt = null; e.wait = .6 + Math.random() * 1.8; e.body.scale.set(1, 1, 1); e.body.rotation.x = 0; }
    return;
  }
  // chick waddles, puppy trots
  const sp = (e.name === 'puppy' ? 1.3 : .45) * Math.sqrt(s), step = e.ph * (e.name === 'puppy' ? 13 : 11);
  if (d > .08) g.position.addScaledVector(_spD, Math.min(1, sp * dt / d)); else { e.tgt = null; e.wait = 1 + Math.random() * 2.5; }
  g.position.y += (e.tgt ? e.tgt.y : g.position.y) - g.position.y > 0 ? Math.min(.02, dt) : 0;
  if (e.tgt) g.position.y += ((e.from.y + (e.tgt.y - e.from.y) * (1 - d / Math.max(.01, e.from.distanceTo(e.tgt)))) - g.position.y) * Math.min(1, dt * 8);
  if (e.name === 'chick') { e.body.rotation.z = Math.sin(step) * .18; e.body.position.y = Math.abs(Math.sin(step)) * .015; P.legs[0].rotation.x = Math.sin(step) * .6; P.legs[1].rotation.x = -Math.sin(step) * .6; P.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * .15; }); }
  else { P.legs.forEach((l, k) => { l.rotation.x = Math.sin(step + (k === 0 || k === 3 ? 0 : Math.PI)) * .7; }); P.tail.rotation.z = Math.sin(e.ph * 18) * .6; e.body.position.y = Math.abs(Math.sin(step)) * .012; }
}
function spIdle(e, dt) {   // resting: chicks peck, puppies wag + sit, bunnies twitch their ears
  const P = e.parts, t = e.ph;
  if (e.name === 'chick') { e.body.rotation.z *= .9; e.body.rotation.x = Math.max(0, Math.sin(t * 5)) ** 8 * .6; P.legs.forEach(l => { l.rotation.x *= .9; }); P.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * (.15 + Math.max(0, Math.sin(t * 9)) * (Math.sin(t * .7) > .6 ? .7 : 0)); }); }
  else if (e.name === 'puppy') { P.tail.rotation.z = Math.sin(t * 22) * .7; P.legs.forEach(l => { l.rotation.x *= .85; }); e.body.position.y *= .9;
    const look = Math.atan2(-(_spA.x - e.g.position.x), -(_spA.z - e.g.position.z)); e.g.rotation.y += Math.atan2(Math.sin(look - e.g.rotation.y), Math.cos(look - e.g.rotation.y)) * Math.min(1, dt * 3); }
  else { P.ears.forEach((ea, k) => { ea.rotation.x = .1 + (Math.sin(t * 3 + k) > .95 ? .35 : 0); }); e.body.scale.set(1, 1 + Math.sin(t * 6) * .015, 1); }
}
function spStepFirework(e, dt) {
  const g = e.g;
  if ((e.fuse -= dt) > 0) { g.rotation.z = Math.sin(tAll * 40) * .03; return; }
  if (!e.lit) { e.lit = true; if (ac) tone('sawtooth', 300, 1800, 1.1, .05); }
  e.vy = Math.min(14, e.vy + dt * 30); g.position.y += e.vy * dt;
  if ((e.sparkT -= dt) < 0) { e.sparkT = .07; confetti(g.position.clone().add(V(0, -.15, 0)), 2, [0xffd25a, 0xff9a3c, 0xffffff]); }
  if (!e.boomed && (e.up = (e.up || 0) + dt) > 1.25) {
    e.boomed = true; const p = g.position.clone(), n = state.xr ? 60 : 120;
    confetti(p, n, [e.c, shade(e.c, 1.3), 0xffffff, 0xffd25a]); confetti(p.clone().add(V(0, .3, 0)), n / 2, [e.c, 0xffffff]);
    if (ac) { tone('sine', 120, 40, .6, .3); const t = ac.currentTime; for (let k = 0; k < 8; k++) tone('square', 2000 + Math.random() * 2500, 1500, .03, .03, .25 + k * .06 + Math.random() * .05); }
    e.die = .001; g.visible = false;
  }
}
Object.assign(window.__kg, { cl: t => clRun(t), clToggle: () => clToggle(), travel: a => travel(a), spawned: () => SP.list.map(e => e.name) });   // test hooks
