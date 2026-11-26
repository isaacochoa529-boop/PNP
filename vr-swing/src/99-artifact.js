/* ======================================================================
   ⚫⚪ THE ARTIFACT (Physics Playground, back of the Slicing Yard): a black-and-white relic stuck in a stone altar.
   Squeeze grip on it and PULL: it fights back (shakes, drags your paw down, slides back in if you ease off).
   PC / phone: mash E / ✋ Grab. Once it's out, pull it to your CHEST (PC: press E again) and it becomes part
   of you: you get its POWERS. Powers live in ART_POWERS, so new ones slot right in.
   Power 1, FLIGHT: VR = push the LEFT stick to fly where you look (let go = slow float down).
   PC / phone = double-tap Space / Jump to start or stop flying; WASD flies where you look, Space goes up.
   ====================================================================== */
const ART = { state: 'stuck', h: null, k: 0, start: V(), mash: 0, powers: new Set(), fly: false, flyT: 0, lastSpace: 0, spacePrev: false, grind: null, glow: 0 };
const ART_AT = V(0, 0, -16.2);
if (store.get('kg-art') === '1') { ART.state = 'absorbed'; ART.powers.add('fly'); }   // arena-local
const ART_POWERS = {
  fly: { e: '🕊️', n: 'FLIGHT', how: () => state.xr ? 'Push your LEFT stick to fly where you look!' : IS_TOUCH ? 'Double-tap Jump to fly, the stick steers where you look!' : 'Double-tap SPACE to fly! WASD flies where you look, Space goes up.' }
};
const _ar1 = V(), _ar2 = V(), _ar3 = V(), _arq = new THREE.Quaternion();
const ARTM = (() => {
  const g = new THREE.Group(); arena.add(g); g.position.copy(ART_AT);
  const stone = smat(0x6f6a62, { roughness: .9, flatShading: true }), blk = smat(0x0c0c0e, { roughness: .25, metalness: .4 }), wht = smat(0xf4f4f6, { roughness: .2, emissive: 0xffffff, emissiveIntensity: .15 });
  part(new THREE.CylinderGeometry(.55, .7, .7, 8), stone, 0, .35, 0, g); part(new THREE.CylinderGeometry(.62, .62, .08, 8), smat(0x3a3a3e), 0, .72, 0, g);
  [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + Math.PI / 4; part(new THREE.BoxGeometry(.06, .5, .02), i % 2 ? wht : blk, Math.cos(a) * .64, .4, Math.sin(a) * .64, g).rotation.y = -a; });
  addCol({ t: 1, x: ARENA.x + ART_AT.x, z: ARENA.z + ART_AT.z, cy: .38, hy: .38, r: .65, tag: 'rock' });
  // the relic: a black-and-white diamond with a spinning ring of black and white beads
  const relic = new THREE.Group(); g.add(relic); relic.position.y = .86;
  const top = new THREE.Mesh(new THREE.ConeGeometry(.11, .17, 4), wht); top.position.y = .085; relic.add(top);
  const bot = new THREE.Mesh(new THREE.ConeGeometry(.11, .17, 4).rotateX(Math.PI), blk); bot.position.y = -.085; relic.add(bot);
  const ring = new THREE.Group(); relic.add(ring);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), i % 2 ? wht : blk); b.position.set(Math.cos(a) * .17, 0, Math.sin(a) * .17); ring.add(b); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(.6); relic.add(halo);
  const lab = sprite('⚫⚪ THE ARTIFACT', 1.8, '#ffffff', 54); lab.position.y = 1.75; g.add(lab); const labMap0 = lab.material.map;
  if (ART.state === 'absorbed') { relic.visible = false; lab.material.map = sprite('⚫⚪ (it\'s inside you now)', 1.8, '#888888', 46).material.map; }
  return { g, relic, ring, halo, lab, labMap0, top: V().copy(ART_AT).add(ARENA).setY(.86) };
})();
function hasPower(p) { return ART.powers.has(p); }
function artGrav() { if (!hasPower('fly')) return 1; if (ART.fly) return 0; return ART.flyT > 0 && !state.grounded ? .15 : 1; }
function artPos() { ARTM.g.updateMatrixWorld(true); return _ar1.copy(ARTM.relic.position).applyMatrix4(ARTM.g.matrixWorld); }
function artNear(p, r) { return p.distanceTo(artPos()) < r; }
function artGrab(h) {
  if (state.area !== 'arena' || !h.tracked || ART.state === 'absorbed') return false;
  if (ART.state === 'stuck' && artNear(h.pos, .22)) { ART.state = 'pull'; ART.h = h; ART.k = 0; ART.start.copy(h.pos); buzz(h, .7, 80); if (ac) tone('sine', 70, 50, .4, .3); toast('💪 It\'s fighting back! Keep squeezing and PULL it up!', 3); return true; }
  if (ART.state === 'loose' && artNear(h.pos, .25)) { ART.state = 'held'; ART.h = h; buzz(h, .6, 60); toast(state.xr ? '⚫⚪ Now pull it to your CHEST!' : '⚫⚪ Press E again to pull it to your chest!', 4); return true; }
  return false;
}
function artDrop(h) {
  if (ART.h !== h) return false;
  if (ART.state === 'pull') { ART.state = 'stuck'; ART.h = null; artGrindStop(); toast('😤 It slid back in! Pull harder!', 2.5); return true; }
  if (ART.state === 'held') { ART.state = 'loose'; ART.h = null; return true; }
  return false;
}
function artDesk() {
  if (state.area !== 'arena' || ART.state === 'absorbed') return false;
  headWorld(_ar2); const near = _ar2.distanceTo(artPos()) < 2.4;
  if (ART.state === 'held' || (ART.state === 'loose' && near)) { if (tAll - (ART.outT || 0) > .9) artAbsorb(); return true; }
  if (!near) return false;
  if (ART.state === 'stuck') { ART.state = 'pull'; ART.h = hands[1]; ART.k = 0; ART.desk = true; ART.mash = 0; toast(IS_TOUCH ? '💪 It\'s stuck! Keep TAPPING Grab to yank it out!' : '💪 It\'s stuck! MASH E to yank it out!', 3); }
  if (ART.state === 'pull' && ART.desk) { ART.mash += .085; if (ac) tone('square', 80 + ART.k * 200, 60, .08, .08); }
  return true;
}
function artGrindStop() { if (ART.grind && ac) { const t = ac.currentTime; ART.grind.g.gain.setTargetAtTime(0, t, .03); ART.grind.n.stop(t + .2); ART.grind = null; } }
function artAbsorb() {
  ART.state = 'absorbed'; ART.h = null; artGrindStop(); ART.powers.add('fly'); store.set('kg-art', '1');
  ARTM.relic.visible = false; artCutscene();
}
/* ---------- 🎬 the cutscene: you spaz, a neon-white you and a vantablack you step out, then slam back in with a flash ---------- */
const ART_CS = { on: false, t: 0, pin: null, twins: null, yaw: 0, flash: null, bars: null, cap: null };
{
  const bars = document.createElement('div'); bars.id = 'artBars';
  bars.innerHTML = '<div></div><div></div><span id="artCap"></span>';
  const css = document.createElement('style'); css.textContent = `#artBars{position:fixed;inset:0;z-index:45;pointer-events:none;display:none}
  #artBars>div{position:absolute;left:0;right:0;height:0;background:#000;transition:height .5s}#artBars>div:first-child{top:0}#artBars>div:nth-child(2){bottom:0}
  #artBars.on>div{height:11vh}#artCap{position:absolute;left:0;right:0;bottom:3vh;text-align:center;color:#fff;font:700 26px Fredoka,system-ui;text-shadow:0 0 10px #000;opacity:0;transition:opacity .4s}`;
  document.head.appendChild(css); document.body.appendChild(bars); ART_CS.bars = bars; ART_CS.cap = bars.querySelector('#artCap');
}
function artCap(txt) { ART_CS.cap.textContent = txt; ART_CS.cap.style.opacity = txt ? 1 : 0; if (txt && state.xr) showVrToast(txt, 2.5); }
function artTwin(white) {
  const f = makeFriend(white ? 0xffffff : 0x000000, white ? 0xffffff : 0x000000, '');
  f.label.visible = false;
  f.g.traverse(o => { if (o.isMesh && o.material && o.material.color) { o.material = new THREE.MeshBasicMaterial({ color: white ? 0xffffff : 0x000000 }); o.castShadow = false; } });
  if (white) { const l = new THREE.PointLight(0xffffff, 2.5, 4); f.head.add(l); }
  return f;
}
function artPoseTwin(f, P, yaw, k) {
  const bh = state.bodyH || .85, sc = clamp(bh / AVATAR_EYE, .75, 1.1);
  f.head.position.set(P.x, P.y + bh, P.z); f.head.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
  if (f.root) { f.root.position.set(P.x, P.y, P.z); f.root.rotation.set(0, yaw, 0); f.root.scale.setScalar(sc); f.head.scale.setScalar(sc); }
  const fq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  f.paws.forEach((p, i) => { p.visible = true; const up = Math.sin(tAll * 9 + i * 3) * .05 * k; p.position.copy(f.head.position).add(V(i ? .22 : -.22, -.32 + up, -.2).applyQuaternion(fq)); p.quaternion.copy(fq); });
  if (f.thump) poseFriendArms(f, sc, yaw);
}
// 🎵 Isaiah's Artifact song: the cutscene is timed to it. The song's pause (6.15 s in) is the merge flash = the end of the cutscene, then the beat drops as you get your powers.
const ART_T = { spaz: 1.8, out: 2.4, back: 5.8, merge: 6.15, end: 6.5 };
const ART_SONG = { buf: null, loading: false, src: null, t0: 0 };
function artSongLoad() {
  if (ART_SONG.buf || ART_SONG.loading || !ac) return; ART_SONG.loading = true;
  fetch('audio/artifact-song.mp3').then(r => r.arrayBuffer()).then(a => ac.decodeAudioData(a)).then(b => { ART_SONG.buf = b; }).catch(() => { ART_SONG.loading = false; });
}
function artSongPlay() {
  if (!ac || !ART_SONG.buf) return false;
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = ART_SONG.buf; g.gain.value = 1.1; s.connect(g); g.connect(master);
  ART_SONG.t0 = ac.currentTime + .05; s.start(ART_SONG.t0); ART_SONG.src = s; s.onended = () => { if (ART_SONG.src === s) ART_SONG.src = null; }; return true;
}
function artCutscene() {
  Object.assign(ART_CS, { on: true, t: 0, pin: rig.position.clone(), yaw: state.xr ? Math.atan2(-camera.getWorldDirection(_ar1).x, -_ar1.z) : state.yaw });
  // 🎥 THIRD PERSON: a stand-in of you stays where you were, and your view steps back so you watch it happen
  const fur = myFur(), paw = myPawCol(); ART_CS.actor = makeFriend(fur < 0 ? 0xffffff : fur, paw < 0 ? 0xffffff : paw, ''); ART_CS.actor.label.visible = false;
  // 🚧 no clipping: try angles around you until the camera spot and both twins' spots are clear of walls, the altar and playground toys
  const look = ART_CS.yaw; let best = null;
  for (const da of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.2, -2.2, Math.PI]) {
    const y = look + da, f = V(-Math.sin(y), 0, -Math.cos(y)), r = V(Math.cos(y), 0, -Math.sin(y)), P = ART_CS.pin;
    const pts = [[V().copy(P).addScaledVector(f, -3.6).addScaledVector(r, .5), .45], [V().copy(P).addScaledVector(f, -2.7).addScaledVector(r, .45), .45],
      [V().copy(P).addScaledVector(r, 1.2).addScaledVector(f, -.5), .5], [V().copy(P).addScaledVector(r, -1.2).addScaledVector(f, -.5), .5], [V().copy(P).addScaledVector(r, .6).addScaledVector(f, -.25), .4], [V().copy(P).addScaledVector(r, -.6).addScaledVector(f, -.25), .4]];
    const bad = pts.reduce((n, [q, rad]) => n + (artBlocked(q, rad) ? 1 : 0), 0);
    if (!best || bad < best.bad) best = { y, bad }; if (!bad) break;
  }
  ART_CS.yaw = best.y; ART_CS.turn = best.y - look; ART_CS.rot0 = rig.rotation.y;
  if (state.xr && ART_CS.turn) rig.rotation.y = ART_CS.rot0 + ART_CS.turn;   // VR: turn you so the stand-in is in front of you
  const fwd = V(-Math.sin(ART_CS.yaw), 0, -Math.cos(ART_CS.yaw)), rt = V(Math.cos(ART_CS.yaw), 0, -Math.sin(ART_CS.yaw));
  ART_CS.cam = V().copy(ART_CS.pin).addScaledVector(fwd, -3.6).addScaledVector(rt, .5); ART_CS.fwd = fwd; ART_CS.rt = rt;
  // push loose playground toys (balls, dominoes...) out of the stage so nothing pokes through the twins
  if (typeof PGND !== 'undefined') for (const D of PGND.dyn) { const t = D.b.translation(), dx = t.x + ARENA.x - ART_CS.pin.x, dz = t.z + ARENA.z - ART_CS.pin.z, d = Math.hypot(dx, dz); if (d < 2.2 && D.kind !== 'crate') { const k = (2.3 - d) / Math.max(d, .1); D.b.setTranslation({ x: t.x + dx * k, y: Math.max(t.y, .4), z: t.z + dz * k }, true); D.b.setLinvel({ x: 0, y: 0, z: 0 }, true); } }
  ART_CS.avVis = AV.root.visible; artHideMe(true);
  if (!state.xr) ART_CS.bars.style.display = 'block', requestAnimationFrame(() => ART_CS.bars.classList.add('on'));
  artCap('Something is happening to you...');
  hands.forEach(h => buzz(h, 1, 900)); ART_CS.song = artSongPlay();
  if (!ART_CS.song && ac) { tone('sawtooth', 50, 120, 1.1, .18); noiseHit(ac.currentTime, 1.1, .12, 'bandpass', 2000, .6); }
}
function artBlocked(p, r) {
  if (Math.abs(p.x - ARENA.x) > 17.4 || Math.abs(p.z - ARENA.z) > 17.4) return true;   // off the yard floor
  for (const h of [.3, .9, 1.4]) { _ar3.set(p.x, p.y + h, p.z); if (pawHit(_ar3, r)) return true; }
  if (typeof PGND !== 'undefined') for (const D of PGND.dyn) { if (D.kind !== 'crate') continue; const t = D.b.translation(); if (Math.hypot(t.x + ARENA.x - p.x, t.z + ARENA.z - p.z) < r + .5) return true; }
  return false;
}
function artHideMe(hide) {
  AV.root.visible = !hide; if (hide) { AV.fpRoot.visible = false; AV.head.visible = false; }
  AV.arms.forEach(a => { a.up.visible = a.fore.visible = a.elbow.visible = !hide; });
  hands.forEach(h => { h.paw.visible = !hide; });
}
function artEndCutscene() {
  ART_CS.on = false; rig.position.copy(ART_CS.pin); artHideMe(false); if (state.xr) rig.rotation.y = ART_CS.rot0; if (ART_CS.actor) { scene.remove(ART_CS.actor.g); ART_CS.actor = null; } ART_CS.bars.classList.remove('on'); setTimeout(() => { ART_CS.bars.style.display = 'none'; }, 500); artCap('');
  (ART_CS.twins || []).forEach(f => { scene.remove(f.g); }); ART_CS.twins = null;
  const P = ART_POWERS.fly; toast(`${P.e} NEW POWER: ${P.n}! ${P.how()}`, 9);
  ARTM.lab.material.map = sprite('⚫⚪ (it\'s inside you now)', 1.8, '#888888', 46).material.map;
}
function stepArtCutscene(dt) {
  if (!ART_CS.on) return;
  const C = ART_CS, t0 = C.t; C.t = C.song && ac && ac.state === 'running' ? Math.max(t0, ac.currentTime - ART_SONG.t0) : t0 + dt; const t = C.t, T = ART_T;   // stays in sync with the song
  // the camera (you) slowly drifts in toward the stand-in
  const dolly = Math.min(1, t / T.merge) * .9;
  rig.position.copy(C.cam).addScaledVector(C.fwd, dolly); state.vel.set(0, 0, 0); if (state.velBuf) state.velBuf.length = 0;
  if (!state.xr) { rig.rotation.y = Math.atan2(-(C.pin.x - rig.position.x + C.rt.x * .5), -(C.pin.z - rig.position.z + C.rt.z * .5)); camera.position.set(0, 1.25, 0); camera.rotation.set(-.2, 0, 0); }
  artHideMe(true);   // you're watching from outside: no floating paws or body in the shot
  // the stand-in: SPAZZES, then stands there while the twins come out of it
  const A = C.actor, sp = t < T.spaz ? 1 : 0;
  if (A) {
    const P = V().copy(C.pin); if (sp) P.add(V((Math.random() - .5) * .12, Math.random() * .06, (Math.random() - .5) * .12));
    artPoseTwin(A, P, C.yaw + Math.PI + (sp ? (Math.random() - .5) * 1.2 : 0), sp ? 3 : .4);
    if (sp) A.head.rotateZ((Math.random() - .5) * .8);
  }
  if (t < T.spaz && !state.xr) camera.rotation.z = (Math.random() - .5) * .03;
  if (t < T.spaz && Math.random() < dt * 20) hands.forEach(h => buzz(h, Math.random(), 50));
  if (t0 < T.spaz && t >= T.spaz) {   // the twins burst out
    C.twins = [artTwin(true), artTwin(false)]; artCap('Two of you...?!');
    confetti(V().copy(C.pin).setY(C.pin.y + (state.bodyH || .85)), 120, [0x000000, 0xffffff]); if (ac && !C.song) { tone('sine', 300, 1400, .4, .12); tone('square', 200, 60, .4, .1); }
    if (!state.xr) camera.rotation.z = 0;
  }
  if (C.twins) {
    const fwd = V(-Math.sin(C.yaw), 0, -Math.cos(C.yaw)), rt = V(Math.cos(C.yaw), 0, -Math.sin(C.yaw));
    // slide out to the sides (in front of you so you can see them), hold, then rush back in
    const out = t < T.out ? (t - T.spaz) / (T.out - T.spaz) : t < T.back ? 1 : Math.max(0, 1 - (t - T.back) / (T.merge - T.back)), e = out * out * (3 - 2 * out);
    C.twins.forEach((f, i) => {
      const P = V().copy(C.pin).addScaledVector(rt, (i ? 1 : -1) * 1.2 * e).addScaledVector(fwd, -.5 * e);
      artPoseTwin(f, P, C.yaw + Math.PI + (i ? .4 : -.4) * e, e);   // side by side with you, facing the camera
    });
    if (t >= 3.6 && t0 < 3.6) artCap('White... and black...');
  }
  if (t0 < T.merge && t >= T.merge) {   // MERGE: blinding flash
    (C.twins || []).forEach(f => scene.remove(f.g)); C.twins = null;
    if (!C.song) sfxChoir(); if (ac && !C.song) { tone('sawtooth', 60, 30, 1.2, .2); tone('sine', 1200, 2400, 1, .08, .1); noiseHit(ac.currentTime, .6, .25, 'highpass', 3000, .5); }
    hands.forEach(h => buzz(h, 1, 500)); confetti(V().copy(C.pin).setY(C.pin.y + (state.bodyH || .85)), 200, [0x000000, 0xffffff, 0x888888]);
    artFlash(); artStaticOn(); if (A) A.g.traverse(o => { if (o.isMesh && o.material && o.material.color && (o.material === A.fur || A.paws.some(p => p.userData.fur === o.material))) { o.material.map = ART_ST.tex; o.material.color.set(0xffffff); o.material.needsUpdate = true; } }); brBig('⚫⚪ THE ARTIFACT IS PART OF YOU', 3);
    setTimeout(() => { if ($('brBig').textContent.includes('ARTIFACT')) brBig(''); }, 3200);
  }
  if (t > T.end) artEndCutscene();
}
function artFlash() {
  if (!state.xr) { const fl = $('mdBlind'); fl.style.display = 'flex'; fl.style.background = '#fff'; fl.style.transition = ''; fl.style.opacity = 1; fl.textContent = '';
    setTimeout(() => { fl.style.transition = 'opacity .9s'; fl.style.opacity = 0; }, 150); setTimeout(() => { fl.style.display = 'none'; fl.style.background = '#000'; fl.style.opacity = 1; fl.style.transition = ''; }, 1100); }
  else {   // VR: a white bubble around your head that fades
    const b = new THREE.Mesh(new THREE.SphereGeometry(.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, depthTest: false })); b.renderOrder = 99; scene.add(b);
    ART.vrFlash = { b, t: 1 };
  }
}
/* ---------- 📺 static skin: your fur becomes always-changing TV static ---------- */
const ART_ST = { on: false, tex: null, cv: null, t: 0 };
function artStaticOn() {
  if (!ART_ST.tex) { const c = document.createElement('canvas'); c.width = c.height = 96; ART_ST.cv = c; ART_ST.tex = new THREE.CanvasTexture(c); ART_ST.tex.magFilter = THREE.NearestFilter; ART_ST.tex.wrapS = ART_ST.tex.wrapT = THREE.RepeatWrapping; ART_ST.tex.colorSpace = THREE.SRGBColorSpace; }
  ART_ST.on = true; artStaticDraw();
  if (AV.ready) [AV.bodyFur, AV.armFur, AV.pawFur].forEach(m => { if (!m) return; m.map = ART_ST.tex; m.color.set(0xffffff); m.needsUpdate = true; });
}
function artStaticOff() {
  ART_ST.on = false;
  if (AV.ready) [AV.bodyFur, AV.armFur, AV.pawFur].forEach(m => { if (!m) return; m.map = null; m.needsUpdate = true; });
  applyMyColors();
}
// 🔄 GIVE IT BACK: the powers leave you, the static fades, and the Artifact flies back into its altar (so you can pull it again and replay the cutscene)
function artRemove() {
  if (ART.state !== 'absorbed' || ART_CS.on) { toast('⚫⚪ The Artifact is still in the altar. Pull it out first!', 3); return; }
  ART.powers.clear(); ART.fly = false; ART.flyT = 0; ART.state = 'stuck'; ART.k = 0; store.set('kg-art', '0');
  if (ART_SONG.src) { try { ART_SONG.src.stop(); } catch (e) { } ART_SONG.src = null; }
  artStaticOff(); ARTM.relic.visible = true; ARTM.relic.position.set(0, .86, 0); ARTM.lab.material.map = ARTM.labMap0;
  headWorld(_ar1); confetti(_ar1.clone(), 90, [0x000000, 0xffffff]); confetti(ARTM.top.clone(), 90, [0x000000, 0xffffff]);
  if (ac) { tone('sine', 1400, 200, .7, .12); noiseHit(ac.currentTime, .5, .1, 'lowpass', 800, .6); }
  hands.forEach(h => buzz(h, .8, 200));
  toast('🔄 The powers left you! The Artifact is back in its altar. Pull it out again to replay the cutscene.', 6);
}
const ART_BTN = plButton(V(ART_AT.x + 1.5, 0, ART_AT.z + .6), -.5, '🔄 GIVE IT BACK', 0x9aa3ae, '#e6e6e6', () => artRemove());
function artStaticDraw() {
  const c = ART_ST.cv, g = c.getContext('2d'), im = g.createImageData(c.width, c.height), d = im.data, band = Math.random() * c.height | 0;
  for (let y = 0; y < c.height; y++) { const bright = Math.abs(y - band) < 4 ? 60 : 0; for (let x = 0; x < c.width; x++) { const v = Math.min(255, (Math.random() * 255 | 0) + bright), i = (y * c.width + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } }
  g.putImageData(im, 0, 0); ART_ST.tex.needsUpdate = true;
}
function stepArtStatic(dt) {
  if (ART.vrFlash) { const F = ART.vrFlash; F.t -= dt; headWorld(F.b.position); F.b.material.opacity = Math.max(0, F.t); if (F.t <= 0) { scene.remove(F.b); ART.vrFlash = null; } }
  if (!ART_ST.on) { if (hasPower('fly') && !ART_CS.on && AV.ready) artStaticOn(); return; }
  if ((ART_ST.t -= dt) < 0) { ART_ST.t = .06; artStaticDraw(); ART_ST.tex.offset.set(Math.random(), Math.random()); }
  if (AV.ready) { AV.bodyFur.color.setScalar(.85 + Math.random() * .15); AV.armFur.color.copy(AV.bodyFur.color); AV.pawFur.color.copy(AV.bodyFur.color); }
}
// PC + phone flight (called from stepDesktop): true = this frame was flying
function artFlyDesk(dt, f, s) {
  if (!hasPower('fly') || ART_CS.on) return false;
  const k = state.keys, sp = !!k.Space;
  if (sp && !ART.spacePrev) { if (tAll - ART.lastSpace < .32) { ART.fly = !ART.fly; ART.lastSpace = 0; toast(ART.fly ? '🕊️ FLYING!' : '🪶 Landing...', 1.2); if (ac) tone('sine', ART.fly ? 500 : 900, ART.fly ? 1000 : 400, .2, .1); } else ART.lastSpace = tAll; }
  ART.spacePrev = sp;
  if (!ART.fly) return false;
  camera.getWorldDirection(_ar1); _ar2.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
  const fast = k.ShiftLeft || k.ShiftRight ? 13 : 7.5;
  _ar3.copy(_ar1).multiplyScalar(f).addScaledVector(_ar2, s); if (_ar3.lengthSq() > 1) _ar3.normalize(); _ar3.multiplyScalar(fast);
  if (sp) _ar3.y += 5;
  state.vel.lerp(_ar3, Math.min(1, dt * 5)); state.grounded = false;
  return true;
}
function stepArtifact(dt) {
  if (state.area === 'arena' && ART.state !== 'absorbed') artSongLoad();
  stepArtCutscene(dt); stepArtStatic(dt);
  const here = state.area === 'arena' && !(typeof PT !== 'undefined' && PT.inside);
  ARTM.g.visible = here;
  ARTM.ring.rotation.y += dt * 2.2; ARTM.relic.rotation.y += dt * .6; ARTM.halo.material.opacity = .2 + Math.sin(tAll * 3) * .08 + ART.k * .5;
  // the struggle
  if (ART.state === 'pull') {
    const h = ART.h;
    if (!here || (!ART.desk && !h.tracked)) { ART.state = 'stuck'; ART.h = null; artGrindStop(); }
    else {
      let want;
      if (ART.desk) { ART.mash = Math.max(0, ART.mash - dt * .22); want = ART.mash; }   // it sinks back if you stop mashing
      else want = clamp((h.pos.y - ART.start.y) / .38, 0, 1.2);
      const prev = ART.k; ART.k += (Math.min(1.05, want) - ART.k) * Math.min(1, dt * 1.8);
      if (!ART.desk && want < ART.k) ART.k -= dt * .25;   // ease off and it creeps back in
      ART.k = Math.max(0, ART.k); const moving = Math.abs(ART.k - prev) / Math.max(dt, 1e-3);
      const sh = .02 * (ART.k + .3);
      ARTM.relic.position.set((Math.random() - .5) * sh, .86 + ART.k * .32, (Math.random() - .5) * sh);
      if (!ART.desk && Math.random() < dt * 2.5) { h.stuck = false; buzz(h, 1, 120); if (ac) tone('square', 60, 40, .1, .12); }   // a yank back down!
      if ((ART.tick = (ART.tick || 0) - dt) < 0) { ART.tick = .07; buzz(h, Math.min(1, .3 + moving + ART.k * .5), 60); }
      if (ac) { if (!ART.grind) { const n = noiseLoop(), fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = 'lowpass'; fl.frequency.value = 220; g.gain.value = 0; n.connect(fl); fl.connect(g); g.connect(master); n.start(); ART.grind = { n, g }; } ART.grind.g.gain.setTargetAtTime(Math.min(.5, .1 + moving * .6), ac.currentTime, .04); }
      if (Math.random() < dt * 8) confetti(V().copy(ART_AT).add(ARENA).setY(.8), 2, [0x000000, 0xffffff]);
      if (ART.k > .96) { artGrindStop(); ART.k = 0; ART.state = 'held'; ART.outT = tAll; ART.desk = false; sfxChoir(); toast(state.xr ? '⚫⚪ IT\'S OUT! Now pull it to your CHEST!' : '⚫⚪ IT\'S OUT! Press E to pull it to your chest!', 5); confetti(ARTM.top.clone(), 80, [0x000000, 0xffffff]); }
    }
  } else if (ART.state === 'stuck') { ARTM.relic.position.set(0, .86 + Math.sin(tAll * 1.5) * .02, 0); ART.k = 0; }
  // held: it follows your paw; bring it to your chest
  if (ART.state === 'held') {
    const h = ART.h || hands[1];
    ARTM.g.updateMatrixWorld(true); _ar1.copy(h.pos); ARTM.g.worldToLocal(_ar1); ARTM.relic.position.copy(_ar1);
    headWorld(_ar2); camera.getWorldDirection(_ar3); _ar3.y = 0; _ar3.normalize(); _ar2.addScaledVector(_ar3, .08); _ar2.y -= .38;
    if ((state.xr || sim.on) && h.pos.distanceTo(_ar2) < .22) artAbsorb();
  } else if (ART.state === 'loose') { ARTM.relic.position.y = Math.max(.86, ARTM.relic.position.y - dt * .8); }
  // flight (VR: left stick)
  if (hasPower('fly') && (state.xr || sim.on) && state.mode === 'play') {
    const sx = BM.stick[0] || 0, sy = BM.stick[1] || 0, m = Math.hypot(sx, sy);
    ART.fly = m > .2 && !BM.open && !ART_CS.on;
    if (ART.fly) {
      camera.getWorldDirection(_ar1); _ar2.set(-_ar1.z, 0, _ar1.x).normalize();
      _ar3.copy(_ar1).multiplyScalar(-sy).addScaledVector(_ar2, sx).multiplyScalar(7);
      state.vel.lerp(_ar3, Math.min(1, dt * 4)); state.grounded = false; ART.flyT = 1.5; hands.forEach(h => { h.stuck = false; });
      if ((ART.wT = (ART.wT || 0) - dt) < 0 && ac) { ART.wT = .5; noiseHit(ac.currentTime, .5, .04 * m, 'lowpass', 600, .5); }
    } else ART.flyT = Math.max(0, ART.flyT - (state.grounded ? 99 : 0));
  }
}
window.__kg.art = { artRemove, ART, ART_CS, ART_ST, artCutscene, ART_POWERS, artGrab, artDrop, artDesk, artAbsorb, hasPower, stepArtifact, artFlyDesk };
