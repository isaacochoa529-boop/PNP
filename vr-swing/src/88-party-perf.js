
/* ---------- party speed-up (Quest was laggy at Vivan's party) ----------
   The party is built from ~800 little meshes with ~500 materials, so every frame was ~1000 draw calls
   (twice in VR, plus the shadow pass). Two tricks, both automatic, nothing removed:
   1) GLUE: decorations that STAY STILL get glued into a few big meshes, grouped by "same look" + a 10 m cell
      (so off-screen cells still get culled).
   2) COPIES: things that MOVE but repeat the same shape (bobbing balloons, spinning props...) get drawn as one
      InstancedMesh per shape, following the originals every frame.
   The original meshes stay in the scene (game code, physics, raycasts all still see them); they just move to a
   layer the cameras don't draw. Right before each render we check every glued original: the moment one moves,
   hides, changes parent or its material changes (grabbed prop, flashing light, coaster cart...) it is un-glued
   and draws itself again. New still things are glued in on the next scan. */
const PF = { on: true, items: new Map(), batches: new Map(), queue: new Set(), scanT: 0, seen: new Map(), live: [], ev: 0, inst: new Map(), instOf: new Map(), dirty: false };
const PF_LAYER = 30, PF_MASK = 1 << PF_LAYER;
const _pfInv = new THREE.Matrix4(), _pfRel = new THREE.Matrix4(), _pfV = new THREE.Vector3(), _pfZ = new THREE.Matrix4().makeScale(0, 0, 0);
const PF_UVMAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap', 'lightMap', 'specularMap'];
const PF_PROTO_OBR = THREE.Object3D.prototype.onBeforeRender, PF_PROTO_OBC = THREE.Material.prototype.onBeforeCompile, PF_PROTO_CPK = THREE.Material.prototype.customProgramCacheKey;
function pfVis(o) { while (o && o !== partyG) { if (!o.visible) return false; o = o.parent; } return o === partyG; }
function pfMatKey(m, inst) {
  if (!m || Array.isArray(m) || m.isShaderMaterial || m.wireframe || m.alphaTest > 0) return null;
  if (!(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return null;
  if (m.onBeforeCompile !== PF_PROTO_OBC || m.customProgramCacheKey !== PF_PROTO_CPK) return null;
  if (inst ? m.vertexColors : m.transparent) return null;   // glued = opaque only; copies get their colour per copy
  const tex = PF_UVMAPS.map(k => m[k] ? m[k].uuid : '').join(',');
  return [m.type, inst ? '' : (m.emissive ? m.emissive.getHex() : ''), inst ? '' : m.emissiveIntensity, m.roughness, m.metalness, m.envMap ? m.envMap.uuid : '', m.envMapIntensity,
    m.side, m.flatShading, m.transparent, m.opacity, m.blending, m.fog, m.toneMapped, m.depthWrite, m.depthTest, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits,
    m.shininess, m.specular ? m.specular.getHex() : '', m.colorWrite, m.clearcoat, m.transmission, m.sheen, m.iridescence, tex].join('|');
}
// the bits of a material that game code likes to change at runtime (flashing, swapping colour, fading)
function pfMatSnap(m) { return m.color.getHex() * 3 + (m.emissive ? m.emissive.getHex() : 0) + (m.emissiveIntensity || 0) * 7919 + m.opacity * 104729 + (m.map ? m.map.id : 0) * 31 + (m.transparent ? 1e9 : 0) + (m.visible ? 0 : 2e9); }
function pfMeshOk(o) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.pfBatch || o.userData.pfNo) return false;
  if (o.layers.mask !== 1 || o.renderOrder !== 0 || o.onBeforeRender !== PF_PROTO_OBR) return false;
  const g = o.geometry; if (!g || !g.isBufferGeometry || !g.attributes.position || !g.attributes.normal || g.morphAttributes.position) return false;
  if (g.drawRange.start !== 0 || g.drawRange.count !== Infinity || g.attributes.position.isInterleavedBufferAttribute || g.attributes.normal.isInterleavedBufferAttribute) return false;
  return true;
}
function pfCandidate(o) {   // key for gluing, or null
  if (!pfMeshOk(o)) return null; const m = o.material, g = o.geometry;
  const mk = pfMatKey(m, false); if (!mk || g.attributes.position.count > 24000) return null;
  const uv = PF_UVMAPS.some(k => m[k]); if (uv && (!g.attributes.uv || g.attributes.uv.isInterleavedBufferAttribute)) return null;
  if (m.vertexColors && (!g.attributes.color || g.attributes.color.isInterleavedBufferAttribute || g.attributes.color.itemSize !== 3)) return null;
  if (o.matrixWorld.determinant() < 0 && m.side !== THREE.DoubleSide) return null;
  return mk + '#' + (uv ? 'u' : '') + (g.index ? 'i' : '') + '#' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
}
function pfInstKey(o) {     // key for copies (same shape + same look except colour), or null
  if (!pfMeshOk(o)) return null; const mk = pfMatKey(o.material, true); if (!mk) return null;
  const g = o.geometry, gk = g.parameters && g.type !== 'BufferGeometry' ? g.type + JSON.stringify(g.parameters) : g.uuid;   // same shape made twice still counts
  return mk + '#' + gk + '#' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0);
}
function pfSameM(a, b) { const x = a.elements, y = b.elements; for (let i = 0; i < 16; i++) if (x[i] !== y[i]) return false; return true; }
function pfCell(o) {
  const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
  _pfV.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld).sub(partyG.position);
  return Math.floor(_pfV.x / 10) + ',' + Math.floor(_pfV.y / 10) + ',' + Math.floor(_pfV.z / 10);
}

/* ----- 1) glue ----- */
// a mesh's "chain" = it and its parents up to the party. If only a parent higher up moves (a spinning display,
// the bouncing big bear) we glue it onto that moving parent instead ("anchor"), so it still rides along.
function pfChain(o) { const ch = []; for (let n = o; n && n !== partyG; n = n.parent) ch.push([n, n.matrix.clone(), n.parent]); return ch; }
function pfStableCount(ch) { let j = 0; for (; j < ch.length; j++) { const [n, m, p] = ch[j]; if (n.parent !== p || !n.visible || !pfSameM(n.matrix, m)) break; } return j; }
function pfEvict(it) {
  if (!it.inB) return; it.inB = false; it.o.layers.mask = it.mask; it.ev++; PF.ev++;
  const b = PF.batches.get(it.bk); if (!b) return; b.items.delete(it);
  // squash its triangles in the glued mesh to nothing (no rebuild needed, it now draws itself)
  if (b.mesh && it.vc) { const pa = b.mesh.geometry.attributes.position; pa.array.fill(0, it.vs * 3, (it.vs + it.vc) * 3); pa.needsUpdate = true; it.vc = 0; }
  if (b.items.size < 2) PF.queue.add(it.bk);   // nearly empty: tidy it away
}
function pfDrop(b, bk) { b.items.forEach(it => { it.inB = false; it.o.layers.mask = it.mask; }); b.items.clear(); b.mat.dispose(); PF.batches.delete(bk); }
function pfBuild(bk) {
  const b = PF.batches.get(bk); if (!b) return;
  if (b.mesh) { b.mesh.parent && b.mesh.parent.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh = null; }
  b.items.forEach(it => { if (pfStableCount(it.ch) < it.ch.length) { b.items.delete(it); it.inB = false; it.o.layers.mask = it.mask; } });
  if (b.items.size < 2 || !pfVis(b.A) && b.A !== partyG) { pfDrop(b, bk); return; }
  b.A.updateWorldMatrix(true, false); _pfInv.copy(b.A.matrixWorld).invert();
  const geos = [], keep = b.uv ? ['position', 'normal', 'uv'] : ['position', 'normal'];
  let vs = 0;
  b.items.forEach(it => {
    const s = it.o.geometry, g = new THREE.BufferGeometry();
    keep.forEach(n => g.setAttribute(n, s.attributes[n].clone()));
    if (s.index) g.setIndex(s.index.clone());
    const n = s.attributes.position.count, ca = new Float32Array(n * 3), mc = it.mat.color, vc = it.mat.vertexColors ? s.attributes.color : null;
    for (let i = 0; i < n; i++) { ca[i * 3] = mc.r * (vc ? vc.getX(i) : 1); ca[i * 3 + 1] = mc.g * (vc ? vc.getY(i) : 1); ca[i * 3 + 2] = mc.b * (vc ? vc.getZ(i) : 1); }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    it.o.updateWorldMatrix(true, false); g.applyMatrix4(_pfRel.multiplyMatrices(_pfInv, it.o.matrixWorld)); geos.push(g);
    it.vs = vs; it.vc = n; vs += n;
  });
  const merged = mergeGeometries(geos); geos.forEach(g => g.dispose());
  if (!merged) { b.items.forEach(it => { it.o.userData.pfNo = true; }); pfDrop(b, bk); return; }
  merged.computeBoundingSphere(); merged.computeBoundingBox();
  const me = new THREE.Mesh(merged, b.mat); me.castShadow = b.cast; me.receiveShadow = b.recv; me.userData.pfBatch = true; me.matrixAutoUpdate = false;
  b.A.add(me); b.mesh = me;
  b.items.forEach(it => { it.o.layers.mask = PF_MASK; it.built = true; });   // only now stop drawing the originals (no blink)
}
function pfGlue(o, rec) {
  const A = rec.j >= rec.ch.length ? partyG : rec.ch[rec.j][0], ch = rec.ch.slice(0, rec.j);
  const bk = rec.key + '@' + (A === partyG ? pfCell(o) : A.uuid); let b = PF.batches.get(bk);
  if (!b) { const m = o.material; b = { A, items: new Set(), mesh: null, mat: m.clone(), cast: o.castShadow, recv: o.receiveShadow, uv: PF_UVMAPS.some(k => m[k]) }; b.mat.color.setHex(0xffffff); b.mat.vertexColors = true; PF.batches.set(bk, b); }
  let it = PF.items.get(o); if (!it) { it = { o, mask: o.layers.mask, ev: 0 }; PF.items.set(o, it); PF.live.push(it); }
  it.inB = true; it.built = false; it.bk = bk; it.mat = o.material; it.snap = rec.snap; it.ch = ch; it.mask = o.layers.mask;
  b.items.add(it); PF.queue.add(bk);
}

/* ----- 2) copies ----- */
// copies can each have their own colour AND their own glow (twinkling bulbs), via one extra per-copy value
function pfEmiPatch(mat) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec3 iEmi;\nvarying vec3 vEmi;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vEmi = iEmi;');
    sh.fragmentShader = 'varying vec3 vEmi;\n' + sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vEmi;');
  };
  mat.customProgramCacheKey = () => 'pfEmi';
}
function pfInstBuild(key, list) {
  let G = PF.inst.get(key);
  const mem = G ? G.mem.filter(x => !x.out) : [];
  list.forEach(o => mem.push({ o, mask: o.layers.mask, mat: o.material, c: -1, e: -1, out: false }));
  if (G) { partyG.remove(G.mesh); G.mesh.dispose(); G.mesh.material.dispose(); }
  const src = mem[0].o, sg = src.geometry, geo = new THREE.BufferGeometry(), mat = src.material.clone(); mat.color.setHex(0xffffff);
  for (const n in sg.attributes) geo.setAttribute(n, sg.attributes[n]); if (sg.index) geo.setIndex(sg.index);
  const emi = !!mat.emissive; if (emi) { geo.setAttribute('iEmi', new THREE.InstancedBufferAttribute(new Float32Array(mem.length * 3), 3)); pfEmiPatch(mat); }
  const me = new THREE.InstancedMesh(geo, mat, mem.length);
  me.castShadow = src.castShadow; me.receiveShadow = src.receiveShadow; me.frustumCulled = false; me.userData.pfBatch = true; me.matrixAutoUpdate = false;
  mem.forEach((x, i) => { x.i = i; x.c = -1; x.e = -1; me.setColorAt(i, _pfCol.setHex(0xffffff)); me.setMatrixAt(i, _pfZ); });
  partyG.add(me);
  G = { key, mem, mesh: me, emi }; PF.inst.set(key, G);
  mem.forEach(x => { PF.instOf.set(x.o, G); x.o.layers.mask = PF_MASK; });
  pfInstSync(G);
}
function pfInstSync(G) {
  const me = G.mesh, ea = G.emi ? me.geometry.attributes.iEmi : null; let colD = false, emD = false;
  for (const x of G.mem) {
    if (x.out) continue; const o = x.o;
    if (o.material !== x.mat) { x.mat = o.material; if (pfInstKey(o) !== G.key) { x.out = true; o.layers.mask = x.mask; PF.instOf.delete(o); me.setMatrixAt(x.i, _pfZ); continue; } }
    if (o.layers.mask !== PF_MASK) { x.out = true; PF.instOf.delete(o); me.setMatrixAt(x.i, _pfZ); continue; }   // someone else changed its layer: let it be
    const m = o.material, c = m.color.getHex(); if (c !== x.c) { x.c = c; me.setColorAt(x.i, _pfCol.setHex(c)); colD = true; }
    if (ea) { const e = m.emissive.getHex() + m.emissiveIntensity * 16777216; if (e !== x.e) { x.e = e; _pfCol.copy(m.emissive).multiplyScalar(m.emissiveIntensity); ea.setXYZ(x.i, _pfCol.r, _pfCol.g, _pfCol.b); emD = true; } }
    if (!pfVis(o)) { me.setMatrixAt(x.i, _pfZ); continue; }
    me.setMatrixAt(x.i, _pfRel.multiplyMatrices(_pfInv, o.matrixWorld));
  }
  me.instanceMatrix.needsUpdate = true; if (colD) me.instanceColor.needsUpdate = true; if (emD) ea.needsUpdate = true;
}
const _pfCol = new THREE.Color();

/* ----- scan: who is still (glue) and who moves but repeats (copies) ----- */
function pfScan() {
  const now = new Map(), glue = [], anch = [], movers = new Map();
  const mover = o => { const ik = pfInstKey(o); if (!ik) return false; if (!movers.has(ik)) movers.set(ik, []); movers.get(ik).push(o); return true; };
  partyG.traverseVisible(o => {
    if (!o.isMesh || PF.instOf.has(o)) return; const it0 = PF.items.get(o); if (it0 && it0.inB) return;
    if (!pfMeshOk(o)) return;
    const key = pfCandidate(o), prev = PF.seen.get(o), snap = key ? pfMatSnap(o.material) : 0;
    if (!prev) { now.set(o, { key, snap, ch: pfChain(o), j: -1, n: 1 }); return; }   // first look: wait and see
    if (!key || prev.key !== key || prev.snap !== snap) { now.set(o, { key, snap, ch: pfChain(o), j: -1, n: 1 }); mover(o); return; }   // its look changes (twinkles) or can't glue
    const j = pfStableCount(prev.ch), rec = { key, snap, ch: j > 0 ? prev.ch : pfChain(o), j, n: j > 0 && prev.j === j ? prev.n + 1 : 2 };
    now.set(o, rec);
    if (j === 0) { mover(o); return; }   // it moves by itself
    const need = it0 ? (it0.ev >= 3 ? 1e9 : 2 + it0.ev * 4) : 2; // things that keep moving have to sit still longer before we glue them again
    if (rec.n < need) return;
    if (j >= rec.ch.length) glue.push([o, rec]); else anch.push([o, rec]);
  });
  PF.seen = now;
  for (const [o, rec] of glue) pfGlue(o, rec);
  // something riding on a moving parent: lots of the same shape -> copies, otherwise glue it onto that parent
  const cnt = ik => (movers.get(ik) || []).length + (PF.inst.has(ik) ? PF.inst.get(ik).mem.filter(x => !x.out).length : 0);
  const ak = anch.map(([o]) => pfInstKey(o)); ak.forEach(ik => { if (ik && !movers.has(ik)) movers.set(ik, []); });
  anch.forEach(([o], i) => { if (ak[i]) movers.get(ak[i]).push(o); });
  anch.forEach(([o, rec], i) => { if (!ak[i] || cnt(ak[i]) < 3) { const l = ak[i] && movers.get(ak[i]); if (l) l.splice(l.indexOf(o), 1); pfGlue(o, rec); } });
  for (const [ik, list] of movers) if (list.length && cnt(ik) >= 3) pfInstBuild(ik, list);
}
function stepPartyPerf(dt) {
  if (!PF.on) return;
  PF.dirty = true;
  if ((PF.scanT -= dt) <= 0) { PF.scanT = 1.5; pfScan(); }
  let n = 0; for (const bk of PF.queue) { PF.queue.delete(bk); pfBuild(bk); if (++n >= 12) break; }
}
// right before the frame is drawn (world matrices are fresh here): un-glue anything that changed, move the copies
scene.onBeforeRender = () => {
  if (!PF.dirty || !partyG.visible) return; PF.dirty = false;
  for (const it of PF.live) {
    if (!it.inB) continue; const o = it.o;
    const why = o.material !== it.mat ? 'mat' : (it.built && o.layers.mask !== PF_MASK) ? 'layer' : pfStableCount(it.ch) < it.ch.length ? 'moved' : pfMatSnap(o.material) !== it.snap ? 'look' : '';
    if (why) { if (PF.dbg) PF.dbg[why + ':' + it.ch.length] = (PF.dbg[why + ':' + it.ch.length] || 0) + 1; pfEvict(it); }
  }
  _pfInv.copy(partyG.matrixWorld).invert();
  PF.inst.forEach(pfInstSync);
};
function pfOff() { // switch it all off (test hook): everything draws itself again
  PF.on = false;
  PF.live.forEach(it => { if (it.inB) { it.inB = false; it.o.layers.mask = it.mask; } });
  PF.batches.forEach(b => { if (b.mesh) { b.mesh.parent && b.mesh.parent.remove(b.mesh); b.mesh.geometry.dispose(); } }); PF.batches.clear(); PF.queue.clear(); PF.seen.clear();
  PF.inst.forEach(G => { G.mem.forEach(x => { if (!x.out) x.o.layers.mask = x.mask; }); partyG.remove(G.mesh); G.mesh.dispose(); }); PF.inst.clear(); PF.instOf.clear();
}
window.__kg.partyPerf = { PF, pfScan, pfCandidate, pfInstKey, pfOff, stepPartyPerf,
  stats: () => ({ batches: PF.batches.size, glued: PF.live.filter(i => i.inB).length, copyGroups: PF.inst.size, copies: [...PF.inst.values()].reduce((a, G) => a + G.mem.filter(x => !x.out).length, 0), evictions: PF.ev }) };
