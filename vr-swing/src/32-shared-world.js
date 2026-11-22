/* ======================================================================
   SHARED WORLD: in a room everybody sees and moves the same toys, cubes, cuts, sword, Pip and spooky night.
   Every thing has an owner. The owner runs its physics and sends where it is ~15 times a second; everyone
   else just glides it there. Grab, throw, bump or slice something and it becomes yours. Cuts are sent as the
   cut itself (planes in the piece's own space), so every game carves the exact same shapes.
   The room's host owns everything nobody has touched, and catches anything a leaving player owned.
   ====================================================================== */
const NET_TAG = Math.random().toString(36).slice(2, 6);
let netIdC = 0;
const online = () => MP.status === 'host' || MP.status === 'joined';
const ownerOf = o => o.own || 'host';
const mine = o => !online() || ownerOf(o) === MP.me;
function netSend(d) {
  if (!online()) return; d.from = MP.me;
  if (MP.host) { for (const c of MP.conns.values()) if (c.open) c.send(d); }
  else if (MP.hostConn && MP.hostConn.open) MP.hostConn.send(d);
}
function objOf(k, id) { return k === 'p' ? props[id] : k === 'pip' ? pip : k === 'sw' ? sword : k === 'pc' ? AR.byId.get(id) : null; }
function claim(o, k, id) {
  if (!online()) return;
  if (ownerOf(o) === MP.me) { o.own = MP.me; return; }
  o.ov = (o.ov || 0) + 1; o.own = MP.me; o.nt = null;
  netSend({ t: 'own', k, id, v: o.ov });
  gotOwn(o, k, true);
}
function gotOwn(o, k, nowMine) {
  if (k === 'pc') {
    const pc = o; if (!pc.body || pc.pane) return;
    if (nowMine) { if (!pc.held && !(pc.frz > 0)) { pc.body.setBodyType(AR.R.RigidBodyType.Dynamic, true); if (pc.nv) pc.body.setLinvel(pc.nv, true); } }
    else { if (pc.held) { pc.held.piece = null; pc.held = null; } pc.frz = 0; pc.frzH = null; pc.body.setBodyType(AR.R.RigidBodyType.KinematicPositionBased, true); netSeed(pc); }
  } else if (k === 'p') { if (!nowMine && o.held) { o.held.holding = null; o.held.reset = true; o.held = null; } }
  else if (k === 'pip') { if (!nowMine && pip.heldBy) pip.heldBy = null; }
  else if (k === 'sw') {
    if (nowMine && sword.mode === 'far' && !sword.held) swordToStone();   // whoever had it left: back in the stone
    if (!nowMine) {
      if (sword.held) { sword.held.sword = false; sword.held = null; }
      if (sword.body) { AR.world.removeRigidBody(sword.body); sword.body = null; }
      if (sword.mode !== 'stone') sword.mode = 'far'; AR.bladeOk = false;
    }
  }
}
function netSeed(pc) { const t = pc.body.translation(), r = pc.body.rotation(); pc.np = V(t.x, t.y, t.z); pc.nq = new THREE.Quaternion(r.x, r.y, r.z, r.w); }
function reassertAll() {   // after joining or leaving: every piece's body matches who owns it now
  if (!online()) { [...props, pip, sword, ...AR.pieces].forEach(o => { o.nt = null; o.own = undefined; o.ov = 0; }); FIG.seen = -9; if (sword.mode === 'far') swordToStone(); }
  if (!AR.ready) return;
  for (const pc of AR.pieces) { if (!pc.body || pc.pane) continue; if (mine(pc)) { if (!pc.held && !(pc.frz > 0) && pc.body.bodyType() !== 0) pc.body.setBodyType(AR.R.RigidBodyType.Dynamic, true); } else gotOwn(pc, 'pc', false); }
}
function dropOwner(id) {   // a player left: the host looks after their stuff now
  const take = o => { if (o.own === id) { o.own = 'host'; if (MP.host) gotOwn(o, o === pip ? 'pip' : o === sword ? 'sw' : o.body !== undefined ? 'pc' : 'p', true); } };
  props.forEach(take); take(pip); take(sword); AR.pieces.forEach(take);
  if (FIG.from === id) { FIG.seen = -9; }
}

/* ---------- sending: everything you own that is moving ---------- */
const r4 = x => Math.round(x * 1e4) / 1e4;
const qa = q => [r4(q.x), r4(q.y), r4(q.z), r4(q.w)], va = v => [r4(v.x), r4(v.y), r4(v.z)];
const SW_MODE = { stone: 0, held: 1, free: 2 };
function netTick(dt) {
  if (!online()) return;
  if ((MP.wT = (MP.wT || 0) - dt) > 0) return; MP.wT = 1 / 15;
  const o = [];
  props.forEach((p, i) => { if (!mine(p)) return; const moving = p.held || !p.rest; if (moving || !p.sentRest) { o.push(['p', i, ...va(p.g.position), ...qa(p.g.quaternion), ...va(p.vel), p.held ? 1 : 0, p.rest ? 1 : 0]); p.sentRest = !moving; } });
  if (mine(pip)) { const moving = pip.heldBy || !pip.resting; if (moving || !pip.sentRest) { o.push(['pip', 0, ...va(pip.g.position), ...va(pip.vel), pip.heldBy ? 1 : 0, pip.resting ? 1 : 0]); pip.sentRest = !moving; } }
  if (mine(sword) && sword.mode !== 'far') { const m = SW_MODE[sword.mode]; if (m !== 0 || sword.sentMode !== 0) { o.push(['sw', 0, m, ...va(sword.g.position), ...qa(sword.g.quaternion)]); sword.sentMode = m; } }
  if (AR.ready) {
    let n = 0;
    for (const pc of AR.pieces) {
      if (!pc.body || pc.dying || !mine(pc) || pc.pane) continue;
      const still = !pc.held && !(pc.frz > 0) && pc.body.isSleeping();
      if (still && pc.sentRest) continue;
      const t = pc.body.translation(), r = pc.body.rotation(), v = pc.body.linvel();
      o.push(['pc', pc.id, r4(t.x), r4(t.y), r4(t.z), r4(r.x), r4(r.y), r4(r.z), r4(r.w), r4(v.x), r4(v.y), r4(v.z)]); pc.sentRest = still;
      if (++n > 60) break;
    }
  }
  if (HZ.phase !== 'none' && fig.g.visible) { const g = fig.g.position; o.push(['fig', 0, r4(g.x), r4(g.y), r4(g.z), r4(fig.g.rotation.y), HZ.phase === 'tpose' ? 1 : HZ.phase === 'spazz' ? 2 : 3, r4(HZ.speed)]); }
  if (o.length) netSend({ t: 'w', o });
}

/* ---------- receiving ---------- */
function netGot(d) {
  if (!d || !d.t) return;
  if (d.t === 'w') {
    for (const e of d.o || []) {
      const k = e[0];
      if (k === 'fig') { FIG.nt = e; FIG.seen = tAll; FIG.from = d.from; continue; }
      const o = objOf(k, e[1]); if (!o || mine(o)) continue;
      if (k === 'p') o.nt = { p: V(e[2], e[3], e[4]), q: new THREE.Quaternion(e[5], e[6], e[7], e[8]), v: V(e[9], e[10], e[11]), held: e[12], rest: e[13] };
      else if (k === 'pip') o.nt = { p: V(e[2], e[3], e[4]), v: V(e[5], e[6], e[7]), held: e[8], rest: e[9] };
      else if (k === 'sw') { o.nt = { m: e[2], p: V(e[3], e[4], e[5]), q: new THREE.Quaternion(e[6], e[7], e[8], e[9]) }; }
      else if (k === 'pc') { o.nt = { p: V(e[2], e[3], e[4]), q: new THREE.Quaternion(e[5], e[6], e[7], e[8]) }; o.nv = { x: e[9], y: e[10], z: e[11] }; if (!o.np) netSeed(o); }
    }
  } else if (d.t === 'own') {
    const o = objOf(d.k, d.id); if (!o) return;
    const v = o.ov || 0;
    if (d.v > v || (d.v === v && String(d.from) < String(ownerOf(o)))) { const was = mine(o); o.ov = d.v; o.own = d.from; if (was) gotOwn(o, d.k, false); }
  } else if (d.t === 'cut') {
    const pc = AR.byId.get(d.id); if (!pc || !AR.ready) return;
    const c = unpackCut(d.c); c.remote = true; c.fz = !!d.fz; c.cake = !!d.cake;
    AR.makeOwn = d.from; quietIfAway(() => cutPiece2(pc, c)); AR.makeOwn = null;
  } else if (d.t === 'spawn') {
    if (!AR.ready || AR.byId.has(d.id)) return;
    const t = d.tp === 'c' ? tplFor(KINDS[d.k].size) : toyTpl(d.tp);
    AR.forceId = d.id; AR.makeOwn = d.from;
    makePiece(d.k, [{ vis: Float32Array.from(t.vis), phys: Float32Array.from(t.phys) }], d.vol, V(...d.p), new THREE.Quaternion(...d.q), V(...d.lv), V(...d.av), !!d.pop);
    AR.forceId = null; AR.makeOwn = null;
    if (d.k === 6) megaSign();
  } else if (d.t === 'kill') {
    for (const id of d.ids || []) { const pc = AR.byId.get(id); if (!pc) continue; if (d.eat && pc.body) { const t = pc.body.translation(); crumbs(V(t.x, t.y, t.z).add(ARENA), pc.kind, 8); } removePiece(pc); }
  } else if (d.t === 'reset') {
    AR.pieces.forEach((p, i) => { if (p.pane) return; if (p.held) { p.held.piece = null; p.held = null; } p.dying = .2 + Math.min(i, 150) * .002; }); glassReset(); waterReset();
  } else if (d.t === 'hz') { HZ.fromNet = true; setHorror(!!d.on, d.quiet); HZ.fromNet = false; }
  else if (d.t === 'fig') {
    if (d.ev === 'spawn' && d.to === MP.me) { if (HZ.on && HZ.phase === 'none' && !HZ.crash) spawnFig(); }
    else if (d.ev === 'hit' && HZ.phase === 'tpose') { HZ.phase = 'none'; fig.g.visible = false; }   // someone else smacked it: it's after THEM now
  } else if (d.t === 'say') { if (!mine(pip)) pipSay(d.kind, d.m); }
  else if (d.t === 'snap') gotSnap(d);
  else if (d.t === 'pcs' || d.t === 'gls') { if (!AR.ready || MP.clearOnReady) { (MP.snapQ = MP.snapQ || []).push(d); return; } if (d.t === 'gls') glassFromSnap(d); else d.list.forEach(addSnapPiece); }
  else if (d.t === 'gl') glassNet(d);
  else if (d.t === 'bm') bmNet(d);
  else if (d.t === 'wat') watNet(d);
}
function quietIfAway(f) { const keep = ac; if (state.area !== 'arena') ac = null; try { return f(); } finally { ac = keep; } }
function packCut(c) {
  const pl = l => [l[0].x, l[0].y, l[0].z, l[1]];   // full precision: every game must carve the very same shape
  return { l: c.lines.map(pl), b: c.bis.map(pl), n: [c.nMain.x, c.nMain.y, c.nMain.z], e: [c.e.x, c.e.y, c.e.z], sp: c.sp || 0, x: c.extreme ? 1 : 0, bite: c.bite ? 1 : 0 };
}
function unpackCut(c) {
  const up = a => [V(a[0], a[1], a[2]), a[3]];
  return { lines: c.l.map(up), bis: c.b.map(up), nMain: V(...c.n), e: V(...c.e), sp: c.sp, extreme: !!c.x, bite: !!c.bite };
}
function newPieceId() { return NET_TAG + (++netIdC).toString(36); }
function sendSpawn(pc, tp, lv, av, pop) {
  if (!online() || !pc) return; const t = pc.body.translation(), r = pc.body.rotation();
  netSend({ t: 'spawn', id: pc.id, k: pc.kind, tp, vol: pc.vol, p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w], lv: va(lv), av: va(av), pop: pop ? 1 : 0 });
}
function sendKill(pcs, eat) { if (online() && pcs.length) netSend({ t: 'kill', ids: pcs.map(p => p.id), eat: eat ? 1 : 0 }); }

/* ---------- a new friend gets the whole world from the host ---------- */
function sendSnap(conn) {
  const pk = o => ({ own: ownerOf(o), ov: o.ov || 0 });
  conn.send({ t: 'snap', hz: HZ.on ? 1 : 0,
    props: props.map(p => [...va(p.g.position), ...qa(p.g.quaternion), p.rest ? 1 : 0, ownerOf(p), p.ov || 0]),
    pip: [...va(pip.g.position), ownerOf(pip), pip.ov || 0],
    sword: [sword.mode === 'stone' ? 0 : sword.mode === 'held' || sword.mode === 'far' ? 1 : 2, ...va(sword.g.position), ...qa(sword.g.quaternion), ownerOf(sword), sword.ov || 0], cnt: AR.pieces.length });
  if (!AR.ready) return;
  const list = AR.pieces.filter(p => p.body && !p.dying && !p.pane).map(pc => {
    const t = pc.body.translation(), r = pc.body.rotation();
    return { id: pc.id, k: pc.kind, vol: pc.vol, p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w], o: ownerOf(pc), ov: pc.ov || 0,
      parts: pc.parts.map(pt => [pt.vis.buffer.slice(pt.vis.byteOffset, pt.vis.byteOffset + pt.vis.byteLength), pt.phys.buffer.slice(pt.phys.byteOffset, pt.phys.byteOffset + pt.phys.byteLength)]) };
  });
  for (let i = 0; i < list.length; i += 6) conn.send({ t: 'pcs', list: list.slice(i, i + 6) });
  conn.send(glassSnap());
}
function gotSnap(d) {
  (d.props || []).forEach((a, i) => { const p = props[i]; if (!p) return; if (p.held) { p.held.holding = null; p.held = null; } p.g.position.set(a[0], a[1], a[2]); p.g.quaternion.set(a[3], a[4], a[5], a[6]); p.rest = !!a[7]; p.vel.set(0, 0, 0); p.own = a[8]; p.ov = a[9]; p.nt = null; });
  if (d.pip) { pip.heldBy = null; pip.g.position.set(d.pip[0], d.pip[1], d.pip[2]); pip.own = d.pip[3]; pip.ov = d.pip[4]; pip.resting = true; }
  if (d.sword) { const s = d.sword; sword.own = s[8]; sword.ov = s[9]; if (s[0] === 0) { swordToStone(); } else { gotOwn(sword, 'sw', false); sword.mode = s[0] === 1 ? 'far' : 'free'; sword.g.position.set(s[1], s[2], s[3]); sword.g.quaternion.set(s[4], s[5], s[6], s[7]); } }
  HZ.fromNet = true; setHorror(!!d.hz, true); HZ.fromNet = false;
  const clear = () => { for (const pc of [...AR.pieces]) removePiece(pc); MP.snapQ = []; };
  if (AR.ready) clear(); else MP.clearOnReady = true;
}
function addSnapPiece(s) {
  if (AR.byId.has(s.id)) return;
  const parts = s.parts.map(([v, ph]) => ({ vis: new Float32Array(v), phys: new Float32Array(ph) }));
  AR.forceId = s.id; AR.makeOwn = s.o;
  const pc = makePiece(s.k, parts, s.vol, V(...s.p), new THREE.Quaternion(...s.q), V(), V(), false);
  AR.forceId = null; AR.makeOwn = null;
  if (pc) { pc.ov = s.ov; pc.cool = .2; }
}

/* ---------- every frame: glide what other people own, and let friends' paws push your stuff ---------- */
const FIG = { nt: null, seen: -9, from: null, shown: false };
const _sv1 = V();
function stepShared(dt) {
  if (!online()) return;
  if (AR.ready && MP.clearOnReady) { MP.clearOnReady = false; for (const pc of [...AR.pieces]) removePiece(pc); }
  if (AR.ready && MP.snapQ && MP.snapQ.length) { const q = MP.snapQ; MP.snapQ = []; q.forEach(d => d.t === 'gls' ? glassFromSnap(d) : d.list.forEach(addSnapPiece)); }
  const k = 1 - Math.exp(-dt * 14);
  for (const p of props) if (!mine(p) && p.nt) { p.g.position.lerp(p.nt.p, k); p.g.quaternion.slerp(p.nt.q, k); p.vel.copy(p.nt.v); p.rest = !!p.nt.rest; }
  if (!mine(pip) && pip.nt) { pip.g.position.lerp(pip.nt.p, k); pip.vel.copy(pip.nt.v); pip.resting = !!pip.nt.rest; pip.body.rotation.z = pip.nt.held ? Math.sin(tAll * 9) * .15 : pip.body.rotation.z * .9; }
  if (!mine(sword) && sword.nt) {
    const n = sword.nt;
    if (n.m === 0) { if (sword.mode !== 'stone') { sword.mode = 'stone'; sword.g.position.copy(STONE_POSE.p); sword.g.quaternion.copy(STONE_POSE.q); } }
    else { sword.mode = n.m === 1 ? 'far' : 'free'; sword.g.position.lerp(n.p, Math.min(1, k * 1.5)); sword.g.quaternion.slerp(n.q, Math.min(1, k * 1.5)); }
  }
  if (AR.ready) {
    for (const pc of AR.pieces) {
      if (!pc.body || mine(pc) || !pc.nt || pc.pane) continue;
      if (!pc.np) netSeed(pc);
      pc.np.lerp(pc.nt.p, k); pc.nq.slerp(pc.nt.q, k);
      pc.body.setNextKinematicTranslation(pc.np); pc.body.setNextKinematicRotation({ x: pc.nq.x, y: pc.nq.y, z: pc.nq.z, w: pc.nq.w });
    }
    // friends' paws and bodies are solid in the yard too
    for (const f of MP.others.values()) {
      if (!f.rb) { const R = AR.R; f.rb = [0, 1, 2].map(i => { const b = AR.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -60, 0)); AR.world.createCollider(i < 2 ? R.ColliderDesc.ball(PAW_R * .9).setFriction(1) : R.ColliderDesc.capsule(.17, .2), b); return b; }); }
      f.paws.forEach((p, i) => { _sv1.copy(p.position).sub(ARENA); if (!p.visible) _sv1.set(i * 3 + 9, -60, 0); f.rb[i].setNextKinematicTranslation(_sv1); });
      _sv1.copy(f.head.position).sub(ARENA); _sv1.y -= ((f.cur && f.cur.b) || .6) * .4; f.rb[2].setNextKinematicTranslation(_sv1);
    }
  }
  netTick(dt);
}
// a friend's fig (in someone else's game): show it where they say, and you can still smack it
function stepFigRemote(dt) {
  const live = online() && HZ.on && HZ.phase === 'none' && FIG.nt && tAll - FIG.seen < .6;
  if (!live) { if (FIG.shown) { FIG.shown = false; if (HZ.phase === 'none') fig.g.visible = false; } return; }
  const e = FIG.nt, k = 1 - Math.exp(-dt * 14);
  if (!FIG.shown) { fig.g.position.set(e[2], e[3], e[4]); FIG.shown = true; }
  fig.g.position.lerp(_sv1.set(e[2], e[3], e[4]), k); fig.g.rotation.set(0, e[5], 0); fig.g.visible = true;
  if (e[6] === 1) {
    tPose(fig);
    // smack it and it comes after YOU
    let hit = false;
    if (state.area === 'arena' && sword.mode === 'held') for (let j = 0; j <= 4 && !hit; j++) { _hzP.lerpVectors(AR.b1, AR.t1, j / 4).add(ARENA); hit = figTouches(_hzP, .04); }
    for (const h of hands) if (!hit && h.tracked && h.vel && h.vel.length() > 1 && figTouches(h.pos, PAW_R)) hit = true;
    if (hit) { FIG.shown = false; FIG.seen = -9; HZ.phase = 'tpose'; netSend({ t: 'fig', ev: 'hit' }); hitFig(); }
  } else spazz(fig, .9, 8 + e[7] * 1.6, tAll);
}
function figRoll() {
  if (!online()) return spawnFig();
  if (!MP.host || tAll - FIG.seen < 2) return;
  const ids = ['host', ...MP.others.keys()], who = ids[Math.floor(rnd() * ids.length)];
  if (who === 'host') spawnFig(); else netSend({ t: 'fig', ev: 'spawn', to: who });
}
window.__kg.net = { online, mine, claim, netGot, netSend, sendSnap, objOf, FIG, packCut, unpackCut };
