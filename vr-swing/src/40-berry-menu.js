/* ======================================================================
   THE BERRY MENU: collect every berry and it unlocks for good. X (left controller) opens it, M on a keyboard,
   the 🫐 button on a phone. Six mods: Grab, Platforms, No gravity, Cube attack, Stop-motion, Dramatic.
   ====================================================================== */
const BM = { peak: 0, wasAir: false, ps: [false, false], real: [], unlocked: store.get('kg-bm') === '1', open: false, grab: false, plat: false, nograv: false, cube: false, stop: false, drama: false,
  ghost: false, sc: 1, stick: [0, 0], trig: [false, false], held: null, statues: [], cubes: [], booms: [], plats: [], air: 0, wasG: true, fallV: 0, cubeT: 0, drawT: 0, pokeT: 0 };
const BM_BTN = [['grab', '🤏 GRAB'], ['plat', '🟫 PLATFORMS'], ['nograv', '🪐 NO GRAVITY'], ['cube', '🧊 CUBE ATTACK'], ['stop', '👻 STOP-MOTION'], ['drama', '💥 DRAMATIC'], ['fig', '👤 FIGURE']];
function bmSummon() {   // 7: call the dark figure right now (friends see it, just like a real visit)
  if (HZ.crash) return;
  if (HZ.phase !== 'none') { toast('👤 It\'s already here...', 2.5); return; }
  HZ.rollT = 0; spawnFig(); toast('👤 ...it heard you.', 3);
  if (ac) tone('sawtooth', 80, 40, .6, .12);
}
function bmGrav() { return BM.nograv ? 0 : BM.grab ? .45 : 1; }
function bmUnlock() {
  if (BM.unlocked) return; BM.unlocked = true; store.set('kg-bm', '1'); bmHudBtn();
  setTimeout(() => toast(state.xr ? '🫐 BERRY MENU unlocked! Press X to open it.' : '🫐 BERRY MENU unlocked! Press M (or tap 🫐) to open it.', 6), 2500);
}
// ---- the panel: a rainbow card that floats over your left paw in VR, an HTML card on a screen
const bmCv = document.createElement('canvas'); bmCv.width = 896; bmCv.height = 600;
const bmTex = new THREE.CanvasTexture(bmCv); bmTex.colorSpace = THREE.SRGBColorSpace;
const bmPanel = new THREE.Mesh(new THREE.PlaneGeometry(.42, .28125), new THREE.MeshBasicMaterial({ map: bmTex, transparent: true, depthTest: true }));
bmPanel.visible = false; scene.add(bmPanel);
const BM_W = 896, BM_H = 600, BM_PW = .42, BM_PH = .28125;   // two side-by-side columns of buttons
const BM_XY = i => [i < 4 ? 32 : 464, 150 + (i % 4) * 110];        // top-left x, center y of button i (0-3 left, 4-6 right)
const BM_ACT = { fig: 1 };   // buttons that DO something once instead of switching on/off
function bmDraw() {
  const g = bmCv.getContext('2d'), hue = (tAll * 60) % 360;   // the background slides through every color of the rainbow
  g.clearRect(0, 0, BM_W, BM_H);
  const gr = g.createLinearGradient(0, 0, BM_W, BM_H); gr.addColorStop(0, `hsl(${hue},90%,60%)`); gr.addColorStop(.5, `hsl(${(hue + 60) % 360},90%,60%)`); gr.addColorStop(1, `hsl(${(hue + 120) % 360},90%,60%)`);
  g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, BM_W, BM_H, 40); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.font = '64px "Lilita One", Impact, sans-serif';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText('Berry Menu', BM_W / 2, 66); g.fillText('Berry Menu', BM_W / 2, 66);
  BM_BTN.forEach(([k, label], i) => {
    const [x, y] = BM_XY(i), act = BM_ACT[k]; g.fillStyle = act ? '#1a1a22' : '#ffffff'; g.beginPath(); g.roundRect(x, y - 44, 400, 88, 18); g.fill();
    g.fillStyle = act ? '#ffffff' : '#000000'; g.font = '28px "Lilita One", Impact, sans-serif'; g.textAlign = 'left'; g.fillText(`${i + 1}  ${label}`, x + 16, y + 2);
    g.textAlign = 'right'; g.fillStyle = act ? '#ff5a5a' : BM[k] ? '#0a9a3a' : '#9a9a9a'; g.fillText(act ? 'GO!' : BM[k] ? 'ON' : 'OFF', x + 384, y + 2); g.textAlign = 'center';
  });
  bmTex.needsUpdate = true;
  const el = $('bmHtml'); if (el) el.querySelectorAll('button[data-k]').forEach(b => { const on = BM[b.dataset.k], act = BM_ACT[b.dataset.k]; b.querySelector('i').textContent = act ? 'GO!' : on ? 'ON' : 'OFF'; b.querySelector('i').style.color = act ? '#ff5a5a' : on ? '#0a9a3a' : '#999'; });
}
function bmToggle(force) {
  if (!BM.unlocked) return;
  BM.open = force === undefined ? !BM.open : force; bmDraw();
  if (!state.xr) { const el = $('bmHtml'); if (el) el.style.display = BM.open ? 'block' : 'none'; if (BM.open && document.pointerLockElement) document.exitPointerLock(); }
  if (ac) tone('triangle', BM.open ? 700 : 500, BM.open ? 1100 : 350, .1, .08);
}
(() => {   // the screen version
  const st = document.createElement('style');
  st.textContent = `#bmHtml{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(600px,94vw);max-height:92vh;overflow:auto;box-sizing:border-box;padding:18px;border-radius:22px;z-index:60;display:none;animation:bmRain 6s linear infinite;background:linear-gradient(135deg,#ff5a5a,#ffd25a,#5aff8a,#5ad7ff,#9a5aff,#ff5ad2);font-family:"Lilita One",Impact,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4)}
  @keyframes bmRain{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}
  #bmHtml h2{margin:0 0 12px;text-align:center;color:#fff;font-size:34px;text-shadow:0 3px 0 rgba(0,0,0,.3)}
  #bmHtml .bmG{display:grid;grid-template-columns:1fr 1fr;grid-auto-flow:column;grid-template-rows:repeat(4,auto);gap:0 10px}@media(max-width:420px){#bmHtml .bmG{grid-template-columns:1fr;grid-auto-flow:row}}
  #bmHtml button.act{background:#1a1a22;color:#fff}
  #bmHtml button{display:flex;justify-content:space-between;align-items:center;width:100%;margin:8px 0;box-sizing:border-box;padding:12px 16px;border:0;border-radius:12px;background:#fff;color:#000;font:inherit;font-size:20px;cursor:pointer}
  #bmHtml button i{font-style:normal}
  #bmBtn{position:fixed;right:14px;top:70px;z-index:55;width:52px;height:52px;border-radius:50%;border:0;font-size:28px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.3);display:none;cursor:pointer}`;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'bmHtml';
  d.innerHTML = '<h2>Berry Menu</h2><div class="bmG">' + BM_BTN.map(([k, l], i) => `<button data-k="${k}"${BM_ACT[k] ? ' class="act"' : ''}>${i + 1}&nbsp; ${l}<i>OFF</i></button>`).join('') + '</div><button data-close="1" style="justify-content:center">✖ close (M)</button>';
  d.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.close) bmToggle(false); else bmSet(b.dataset.k); });
  document.body.appendChild(d);
  const b = document.createElement('button'); b.id = 'bmBtn'; b.textContent = '🫐'; b.onclick = () => bmToggle(); document.body.appendChild(b);
  addEventListener('keydown', e => { if (e.code === 'KeyM' && state.mode === 'play' && !state.xr && document.activeElement.tagName !== 'INPUT') bmToggle(); if (e.code === 'KeyC') BM.trig[1] = true; if (e.code === 'KeyF' && BM.stop && !state.xr) bmStatue(true); });
  addEventListener('keyup', e => { if (e.code === 'KeyC') BM.trig[1] = false; });
})();
function bmHudBtn() { const b = $('bmBtn'); if (b) b.style.display = BM.unlocked && state.mode === 'play' && !state.xr ? 'block' : 'none'; }
function bmSet(k) {
  if (k === 'fig') return bmSummon();
  const on = !BM[k];
  if (k === 'grab') bmSize(on ? 2 : 1);
  if (k === 'stop') { if (on) { bmStatue(true); toast('🧍 Stop-motion! A frozen you stays behind. R grip (or F on PC) = freeze a new one.', 5); } else bmClearStatues(true); }
  BM[k] = on; bmDraw(); if (ac) tone('square', on ? 660 : 330, on ? 990 : 220, .08, .06);
  if (k === 'nograv' && on) toast('🪐 No gravity! Push off things to float around.', 3);
}
function bmSize(sc) {
  if (BM.sc === sc) return; const k = sc / BM.sc; BM.sc = sc; state.bodyH *= k;
  if (state.xr || sim.on) { rig.scale.setScalar(sc); rig.updateMatrixWorld(true); }
  hands.forEach(h => { h.stuck = false; h.ready = false; }); letGoAll();
}
function letGoAll() { hands.forEach(h => { if (h.hold) letGoHold(h); }); }
// ---- VR poking: tap a button with your right paw
function stepBerryMenu(dt) {
  bmHudBtn();
  if (BM.open && state.xr) {
    const hl = hands[0], hr = hands[1];
    if (hl.tracked) {
      headWorld(_bm1); bmPanel.position.copy(hl.pos).add(_bm2.set(0, .22 * BM.sc, 0)); bmPanel.lookAt(_bm1); bmPanel.scale.setScalar(BM.sc); bmPanel.visible = true;
      if ((BM.drawT -= dt) < 0) { BM.drawT = .1; bmDraw(); }
      if (hr.tracked && tAll > BM.pokeT) {
        bmPanel.worldToLocal(_bm3.copy(hr.pos));
        if (Math.abs(_bm3.z) < .04 && Math.abs(_bm3.x) < BM_PW / 2) {
          const px = (_bm3.x / BM_PW + .5) * BM_W, py = (BM_PH / 2 - _bm3.y) / BM_PH * BM_H;
          BM_BTN.forEach(([k], i) => { const [x, y] = BM_XY(i); if (px > x && px < x + 400 && Math.abs(py - y) < 44) { BM.pokeT = tAll + .45; bmSet(k); buzz(hr, .6, 30); } });
        }
      }
    } else bmPanel.visible = false;
  } else bmPanel.visible = false;
  // dramatic landings
  // dramatic landings: fall from up high and land on your feet OR slam down on your hands = KABOOM
  {
    const hy = headWorld(_bm1).y, air = !state.grounded && !hands.some(h => h.stuck) && !BM.held;
    if (BM.wasAir && !air && BM.drama) {
      const drop = (BM.peak - hy) / BM.sc, nh = hands.find((h, i) => h.stuck && !BM.ps[i]);
      let at = null;
      if (nh && drop > 1.0) at = nh.sp.clone();                                   // hands: you need a bit more height
      else if (!nh && state.grounded && drop > .8) at = _bm1.clone().setY(hy - state.bodyH);
      if (at) { const k = clamp(drop / 2.5, .55, 2.2) * Math.sqrt(BM.sc); bmBoom(at, k, true); netSend({ t: 'bm', e: 'boom', p: [r3(at.x), r3(at.y), r3(at.z)], k: r3(k) }); }
    }
    BM.peak = air ? Math.max(BM.peak, hy) : hy; BM.wasAir = air; hands.forEach((h, i) => { BM.ps[i] = h.stuck; });
  }
  // cube attack: hold the trigger (C on a keyboard)
  if (BM.cube && BM.trig[1] && (BM.cubeT -= dt) < 0) {
    const yard = AR.ready && Math.hypot(rig.position.x - ARENA.x, rig.position.z - ARENA.z) < 22;
    BM.cubeT = yard ? .16 : .12; const h = hands[1];
    if ((state.xr || sim.on) && h.tracked) { _bm1.copy(h.pos); _bm2.set(0, -.3, -1).normalize().applyQuaternion(h.paw.getWorldQuaternion(_bmQ)); }
    else { headWorld(_bm1); camera.getWorldDirection(_bm2); _bm1.addScaledVector(_bm2, .5); }
    const v = _bm2.clone().multiplyScalar(8).add(V((rnd() - .5) * 1.2, rnd() * .8, (rnd() - .5) * 1.2)), kind = Math.floor(rnd() * 5);
    _bm1.addScaledVector(_bm2, CUBE * .8);                                    // start just past your paw so it doesn't hit you
    if (yard) {   // REAL Slicing Yard cubes: slice them with the sword, punch them, they sync to friends
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), t = tplFor(CUBE), lp = _bm1.clone().sub(ARENA);
      const pc = makePiece(kind, [{ vis: Float32Array.from(t.vis), phys: Float32Array.from(t.phys) }], CUBE ** 3, lp, q, v, V(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4), false);
      sendSpawn(pc, 'c', v, V(), false); pc.bmT = tAll + 6; BM.real.push(pc);
      if (BM.real.length > 30) { const o = BM.real.shift(); if (AR.pieces.includes(o) && !o.dying) { o.dying = .2; sendKill([o]); } }
      if (ac && rnd() < .5) tone('square', 700 + rnd() * 300, 400, .05, .03);
    } else { bmCube(_bm1.clone(), v, kind, true); netSend({ t: 'bm', e: 'cube', p: [r3(_bm1.x), r3(_bm1.y), r3(_bm1.z)], v: [r3(v.x), r3(v.y), r3(v.z)], c: kind }); }
  }
  for (let i = BM.real.length - 1; i >= 0; i--) { const o = BM.real[i]; if (!AR.pieces.includes(o)) { BM.real.splice(i, 1); continue; } if (tAll > o.bmT && !o.held && !o.dying) { o.dying = .25; sendKill([o]); BM.real.splice(i, 1); } }
  stepCubes(dt); stepBooms(dt); stepPlats(dt);
  // grabbing friends: send where they are, 20x a second; being grabbed: go where they say
  hands.forEach(h => { if (h.grabF && (h.gfT = (h.gfT || 0) - dt) < 0) { h.gfT = .05; netSend({ t: 'bm', e: 'pg', to: h.grabF, p: [r3(h.pos.x), r3(h.pos.y - .1), r3(h.pos.z)] }); } });
  if (BM.held && tAll - BM.held.t < .4) { headWorld(_bm1); rig.position.add(_bm2.set(...BM.held.p).sub(_bm1).multiplyScalar(Math.min(1, dt * 20))); state.vel.set(0, 0, 0); hands.forEach(h => { h.stuck = false; }); }
  else BM.held = null;
}
const _bm1 = V(), _bm2 = V(), _bm3 = V(), _bmQ = new THREE.Quaternion();
// ---- 1: grab friends like they're toys
function bmGrabFriend(h) {
  if (!online() || !(state.xr || sim.on)) return false;
  let best = null, bd = .45 * BM.sc;
  for (const [id, f] of MP.others) { const d = f.head.position.distanceTo(h.pos); if (d < bd) { bd = d; best = id; } }
  if (!best) return false;
  h.grabF = best; h.gfT = 0; buzz(h, .9, 50); if (ac) tone('sine', 300, 700, .15, .12); return true;
}
function bmDropFriend(h) { const v = (h.vel || V()).clone().multiplyScalar(1.4); if (v.length() > 15) v.setLength(15); netSend({ t: 'bm', e: 'pr', to: h.grabF, v: [r3(v.x), r3(v.y), r3(v.z)] }); h.grabF = null; }
// ---- 2: platforms: squeeze in thin air and a little platform appears under your paw
const PLAT_G = new THREE.BoxGeometry(.32, .025, .32), PLAT_M = new THREE.MeshStandardMaterial({ color: 0x7a4dff, emissive: 0x3a1aa0, emissiveIntensity: .5, transparent: true, opacity: .85, roughness: .4 });
function bmPlatform(h) {   // a real little floor under your paw: push off it, stand on it, slide off it (it stays till you let go)
  const S = BM.sc, m = new THREE.Mesh(PLAT_G, PLAT_M); m.position.copy(h.pos).add(V(0, -PAW_R - .0125 * S - .004, 0)); m.scale.setScalar(S); scene.add(m); BM.plats.push(m);
  m.userData.col = addCol({ t: 0, x: m.position.x, y: m.position.y, z: m.position.z, hx: .16 * S, hy: .0125 * S, hz: .16 * S, yaw: 0, tag: 'wood' });
  h.plat = m; sfxTap('wood', .4); buzz(h, .5, 25); netSend({ t: 'bm', e: 'plat', p: [r3(m.position.x), r3(m.position.y), r3(m.position.z)], s: BM.sc });
}
function stepPlats(dt) {
  for (let i = BM.plats.length - 1; i >= 0; i--) { const m = BM.plats[i]; if (m.userData.fade === undefined) continue; m.userData.fade -= dt; m.scale.multiplyScalar(Math.exp(-dt * 10)); if (m.userData.fade <= 0) { const c = m.userData.col; if (c) { const j = colliders.indexOf(c); if (j >= 0) colliders.splice(j, 1); hands.forEach(h => { if (h.col === c) h.stuck = false; }); } scene.remove(m); BM.plats.splice(i, 1); } }
}
// ---- 3: no gravity (see bmGrav). 4: cube attack
const CUBE_G = new THREE.BoxGeometry(CUBE, CUBE, CUBE);
function bmCube(p, v, kind, mineC) {   // outside the yard: same size and colors as the yard cubes
  if (BM.cubes.length > 40) { const o = BM.cubes.shift(); scene.remove(o.m); o.m.material.dispose(); }
  const m = new THREE.Mesh(CUBE_G, new THREE.MeshStandardMaterial({ color: KINDS[(kind | 0) % 5].out, roughness: .45 })); m.position.copy(p); m.castShadow = true; scene.add(m);
  BM.cubes.push({ m, v, w: V(rnd() * 12 - 6, rnd() * 12 - 6, rnd() * 12 - 6), life: 3 });
  if (mineC && ac && rnd() < .5) tone('square', 900 + rnd() * 300, 500, .05, .03);
}
function stepCubes(dt) {
  for (let i = BM.cubes.length - 1; i >= 0; i--) {
    const o = BM.cubes[i], m = o.m; o.life -= dt;
    if (o.life <= 0) { scene.remove(m); m.material.dispose(); BM.cubes.splice(i, 1); continue; }   // gone after 3 seconds
    o.v.y -= G * dt; m.position.addScaledVector(o.v, dt); m.rotation.x += o.w.x * dt; m.rotation.y += o.w.y * dt; m.rotation.z += o.w.z * dt;
    const hit = pawHit(m.position, CUBE / 2); if (hit) { m.position.addScaledVector(hit.n, CUBE / 2 - hit.d); const vn = o.v.dot(hit.n); if (vn < 0) o.v.addScaledVector(hit.n, -1.5 * vn).multiplyScalar(.75); o.w.multiplyScalar(.7); }
    if (o.life < .3) m.scale.setScalar(Math.max(.01, o.life / .3));
  }
}
// ---- 5: stop-motion: a frozen copy of the real you, mid-pose
function bmStatue(send) {
  if (!AV.ready && !AV.head) return;
  const parts = [AV.head, AV.torso, ...hands.filter(h => h.paw.visible).map(h => h.paw), ...AV.arms.flatMap(a => [a.up, a.fore, a.elbow]).filter(o => o && o.visible)].filter(Boolean);
  const g = new THREE.Group(); scene.add(g); const pose = [];
  for (const o of parts) {
    o.updateMatrixWorld(true); const ud = o.userData; o.userData = {}; const c = o.clone(true); o.userData = ud; c.visible = true; o.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    c.traverse(q => { q.layers.set(0); q.visible = true; if (q.isMesh) q.castShadow = true; }); g.add(c);
  }
  bmClearStatues(false); BM.statues.push(g);   // one frozen frame at a time: the last one disappears
  if (ac) { tone('sine', 1800, 900, .25, .08); noiseHit(ac.currentTime, .3, .12, 'highpass', 4000, .5); }
  confetti(headWorld(V()), 16, [0xffffff, 0xffd25a, 0x7ad0ff]);
  if (send) { headWorld(_bm1); camera.getWorldQuaternion(_bmQ); netSend({ t: 'bm', e: 'stat', h: [r3(_bm1.x), r3(_bm1.y), r3(_bm1.z), r3(_bmQ.x), r3(_bmQ.y), r3(_bmQ.z), r3(_bmQ.w)], b: r3(state.bodyH), sz: r3(BM.sc), p: hands.map(h => h.paw.visible ? packPose(h.paw) : 0) }); }
}
function bmClearStatues(send) { BM.statues.forEach(g => scene.remove(g)); BM.statues.length = 0; if (send) netSend({ t: 'bm', e: 'unstat' }); }
function bmRemoteStatue(d) {   // a friend's frozen copy: their head, body and paws in their own colors
  if (!AV.tpl) return; const g = new THREE.Group(); scene.add(g);
  const hd = AV.tpl.head.clone(true); hd.position.set(d.h[0], d.h[1], d.h[2]); hd.quaternion.set(d.h[3], d.h[4], d.h[5], d.h[6]); g.add(hd);
  const fw = V(0, 0, -1).applyQuaternion(hd.quaternion), to = AV.tpl.torso.clone(true); to.position.set(d.h[0] - fw.x * .03, d.h[1] - clamp(d.b || .6, .35, 3) - .12, d.h[2] - fw.z * .03); to.rotation.y = Math.atan2(-fw.x, -fw.z); g.add(to);
  const f = MP.others.get(d.from), sz = clamp(+d.sz || 1, .5, 3);
  hd.scale.setScalar(sz); to.scale.setScalar(sz);
  (d.p || []).forEach((q, i) => { if (!q) return; const pw = makePaw(f && f.pawC >= 0 ? f.pawC : 0xffffff); pw.scale.setScalar(sz); if (!i) pw.scale.x = -1; pw.position.set(q[0], q[1], q[2]); pw.quaternion.set(q[3], q[4], q[5], q[6]); g.add(pw); });
  const fm = AV.tpl.fur.clone(); fm.color.set(f && f.color >= 0 ? f.color : 0xffffff);
  g.traverse(q => { q.layers.set(0); if (q.isMesh && q.material && q.material.name === 'Fur') q.material = fm; });
  BM.remote = (BM.remote || []).filter(r => { if (r.from === d.from) { scene.remove(r.g); return false; } return true; }); BM.remote.push({ g, from: d.from });
}
// ---- 6: dramatic landings
const BOOM = { parts: [], fl: 0, flOn: 0,
  sph: new THREE.IcosahedronGeometry(1, 1), rock: new THREE.DodecahedronGeometry(1, 0), ring: new THREE.RingGeometry(.85, 1, 40), disc: new THREE.CircleGeometry(1, 24),
  fireM: new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  smokeM: new THREE.MeshBasicMaterial({ color: 0x3a3532, transparent: true, depthWrite: false }),
  rockM: new THREE.MeshStandardMaterial({ color: 0x4a3a2e, roughness: 1, flatShading: true }),
  ringM: new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  scorchM: new THREE.MeshBasicMaterial({ color: 0x0c0806, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }) };
function bmBoom(p, k = 1, own = false) {   // a REAL explosion: flash, fireball, smoke, shockwave, flying rocks, scorch mark, BOOM
  BOOM.fl = Math.max(BOOM.fl, clamp(2.2 * k - headWorld(V()).distanceTo(p) * .12, 0, 2.5));   // the whole world lights up for a blink (no extra lamp = no lag)
  const add = (geo, mat, pos, sc, o) => { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.scale.setScalar(sc); m.layers.set(0); scene.add(m); BOOM.parts.push(Object.assign({ m, t: 0 }, o)); return m; };
  for (let i = 0; i < 9; i++) {   // fireball: hot blobs that swell, rise and cool from white to red
    const d = V(rnd() - .5, rnd() * .7 + .1, rnd() - .5).normalize();
    add(BOOM.sph, BOOM.fireM.clone(), p.clone().addScaledVector(d, .1 * k), .1, { kind: 'fire', v: d.multiplyScalar((2 + rnd() * 2) * k), s0: (.35 + rnd() * .35) * k, life: .55 + rnd() * .3 });
  }
  for (let i = 0; i < 10; i++) {   // smoke: dark puffs that billow up and hang around
    const d = V(rnd() - .5, .4 + rnd(), rnd() - .5).normalize();
    add(BOOM.sph, BOOM.smokeM.clone(), p.clone().addScaledVector(d, .2 * k), .2, { kind: 'smoke', v: d.multiplyScalar((.6 + rnd()) * k), s0: (.5 + rnd() * .5) * k, life: 2.2 + rnd() * 1.4, dl: .12 + rnd() * .2 });
  }
  for (let i = 0; i < 16; i++) {   // debris: chunks of ground flung everywhere
    const d = V(rnd() - .5, .6 + rnd() * .9, rnd() - .5).normalize(), r = (.025 + rnd() * .05) * Math.sqrt(k);
    add(BOOM.rock, BOOM.rockM, p.clone().add(V(0, .05, 0)), r, { kind: 'rock', v: d.multiplyScalar((4 + rnd() * 5) * Math.sqrt(k)), w: V(rnd() * 20 - 10, rnd() * 20 - 10, rnd() * 20 - 10), r, life: 2.2, gy: p.y });
  }
  const ring = add(BOOM.ring, BOOM.ringM.clone(), p.clone().add(V(0, .04, 0)), .2, { kind: 'ring', life: .6, k }); ring.rotation.x = -Math.PI / 2;
  const sc = add(BOOM.disc, BOOM.scorchM.clone(), p.clone().add(V(0, .012, 0)), 1.1 * k, { kind: 'scorch', life: 8 }); sc.rotation.x = -Math.PI / 2;
  confetti(p.clone().add(V(0, .2, 0)), Math.round(30 * k), [0xff4a1a, 0xffb020, 0xffe060]);
  if (ac) {   // deep thump + crack + rumble that rolls away
    const t = ac.currentTime, v = Math.min(1.2, .6 + k * .3);
    noiseHit(t, .08, .9 * v, 'bandpass', 3000, .6); tone('sine', 120, 28, 1.1, .5 * v); tone('sawtooth', 70, 25, .9, .22 * v);
    noiseHit(t, 1.6 * Math.min(1.5, k), .7 * v, 'lowpass', 380, .7); noiseHit(t + .05, .7, .35 * v, 'lowpass', 1400, .6);
  }
  const me = headWorld(V()).distanceTo(p); hands.forEach(h => buzz(h, clamp(1.4 - me / 6, .2, 1), 220));
  if (!own) return;   // only the one who exploded shoves things, so friends don't fight over who moved what
  const R = 3.2 * k;
  for (const q of props) if (!q.held) { const dd = q.g.position.distanceTo(p); if (dd < R) { q.vel.add(_bm1.subVectors(q.g.position, p).setLength((R - dd) * 2.8).add(V(0, 3 * k, 0))); q.rest = false; } }
  if (AR.ready) for (const pc of AR.pieces) {   // and blasts Slicing Yard cubes across the yard
    if (!pc.body || pc.held || pc.pane || pc.dying || !mine(pc)) continue;
    const t = pc.body.translation(); _bm1.set(t.x, t.y, t.z).add(ARENA); const dd = _bm1.distanceTo(p); if (dd > R) continue;
    if (pc.body.bodyType() !== 0) continue; _bm1.sub(p).setLength((R - dd) * 3.2).add(V(0, 3.5 * k, 0)); const lv = pc.body.linvel();
    pc.body.setLinvel({ x: lv.x + _bm1.x, y: lv.y + _bm1.y, z: lv.z + _bm1.z }, true);
  }
}
function stepBooms(dt) {
  if (BOOM.flOn || BOOM.fl > 0) { const hm = scene.children.find(o => o.isHemisphereLight); hm.intensity -= BOOM.flOn; BOOM.fl *= Math.exp(-dt * 9); if (BOOM.fl < .01) BOOM.fl = 0; BOOM.flOn = BOOM.fl; hm.intensity += BOOM.flOn; }
  for (let i = BOOM.parts.length - 1; i >= 0; i--) {
    const o = BOOM.parts[i], m = o.m; o.t += dt; const a = o.t / o.life;
    if (a >= 1) { scene.remove(m); if (m.material !== BOOM.rockM) m.material.dispose(); BOOM.parts.splice(i, 1); continue; }
    if (o.kind === 'fire') { o.v.multiplyScalar(Math.exp(-dt * 3)); o.v.y += dt * 1.5; m.position.addScaledVector(o.v, dt); m.scale.setScalar(o.s0 * (.3 + 1.2 * Math.sqrt(a))); m.material.color.setHSL(.13 - a * .13, 1, .85 - a * .5); m.material.opacity = (1 - a) ** 1.5; }
    else if (o.kind === 'smoke') { const b = Math.max(0, o.t - o.dl) / (o.life - o.dl); o.v.multiplyScalar(Math.exp(-dt * 1.2)); o.v.y += dt * .25; m.position.addScaledVector(o.v, dt); m.scale.setScalar(o.s0 * (.4 + 1.3 * Math.sqrt(b))); m.material.opacity = o.t < o.dl ? 0 : Math.min(1, b * 6) * .75 * (1 - b); }
    else if (o.kind === 'rock') { o.v.y -= G * dt; m.position.addScaledVector(o.v, dt); m.rotation.x += o.w.x * dt; m.rotation.y += o.w.y * dt; if (m.position.y < o.gy + o.r) { m.position.y = o.gy + o.r; o.v.y *= -.35; o.v.x *= .6; o.v.z *= .6; o.w.multiplyScalar(.6); } if (a > .8) m.scale.setScalar(o.r * (1 - a) * 5); }
    else if (o.kind === 'ring') { m.scale.setScalar(.2 + a * 5 * o.k); m.material.opacity = (1 - a) * .8; }
    else if (o.kind === 'scorch') m.material.opacity = .7 * Math.min(1, (1 - a) * 4);
  }
}
// ---- the net: what friends see
function bmNet(d) {
  if (d.e === 'boom') bmBoom(V(...d.p), +d.k || 1, false);
  else if (d.e === 'cube') bmCube(V(...d.p), V(...d.v), +d.c || 0, false);
  else if (d.e === 'plat') { const m = new THREE.Mesh(PLAT_G, PLAT_M); m.position.set(...d.p); m.scale.setScalar(+d.s || 1); m.userData.fade = 1.2; scene.add(m); BM.plats.push(m); }
  else if (d.e === 'stat') bmRemoteStatue(d);
  else if (d.e === 'unstat') { BM.remote = (BM.remote || []).filter(r => { if (r.from === d.from) { scene.remove(r.g); return false; } return true; }); }
  else if (d.e === 'pg' && d.to === MP.me) { if (!BM.held) { toast('🤏 You got grabbed!', 2); if (ac) tone('sine', 700, 300, .15, .12); } BM.held = { p: d.p, t: tAll }; }
  else if (d.e === 'pr' && d.to === MP.me) { BM.held = null; state.vel.set(...d.v); }
}
window.__kg.bm = { BM, BOOM, bmSet, bmToggle, bmUnlock, bmStatue, bmBoom, bmNet, stepBerryMenu };
window.__kg.voice = { VC, micOn, setMute, voiceMeet, micLevel, setMouth, AV };
window.__kg.holds = HOLDS; window.__kg.glass = { GL, glassHit, paneHole, paneCarve, paneCarvePath, blade: glassBlade, LAB, labSet, paneSdf, pieceShatter, glassReset, glassSeeds, paneShatter, GPILE, stepGlassPre, netSend };
window.__kg.arena = { AR, sword, buttons, PEDS, ARENA, PILE, KINDS, MEGA_AT, seam, drips, travel, takeSword, releaseSword, grabAny, dropAny, holdPiece, releasePiece, cutPiece, planeCut, pressButton, startSwing, deskInteract, spawnSet, spawnMega };
