/* ======================================================================
   THE STORY: a movie-style intro with the lore of the grove. It plays the first time you start,
   and you can watch it again from the menu (🎬 Story) or the 🎬 button by the spawn.
   PC + phone: the real camera flies a montage, with letterbox bars and typed dialogue.
   VR: the same movie plays on a big screen in a dark theater around you, so your view never moves.
   Also here: the black paint stripes on every Thumpling's cheeks (the mark of the Knuckle).
   ====================================================================== */
const CS = { on: false, i: 0, t: 0, total: 0, typed: 0, lineDone: false, wait: 0, cam: new THREE.PerspectiveCamera(50, 16 / 9, .05, 500), from: V(), to: V(), la: V(), lb: V(), look: V(), shine: [], figWas: null, vr: null, cv: null, lastB: false, lastT: [false, false], bar: 0, fade: 1, ending: false };
const THEATER = 7;
CS.cam.layers.enable(SELF_LAYER);
camera.layers.enable(THEATER);
const ELDER = 'Elder Thump';
// the movie, shot by shot: one steady camera move each (only ONE push-in, saved for the portal)
const CS_SHOTS = [
  { from: [7, 8, 27], to: [3, 15, 23], look: [0, 1.5, 0], look2: [-1, 2.5, -2], cap: 'The Knuckle Grove', who: ELDER,
    line: 'Long ago, a falling star made of pure squish crashed into this valley. Where it landed, the Knuckle Grove grew.' },
  { orbit: { c: [0, .9, 0], r: 2.6, h: 1.3, a0: .9, a1: -.3 }, who: ELDER, hero: true,
    line: 'From the glowing goo crawled the first Thumplings. No legs. All knuckles. They slap the ground to run and fling themselves at the sky.' },
  { berry: true, who: ELDER,
    line: 'Fifteen glow berries hide all over the grove. Find every last one and the old Berry Menu wakes up, with powers no Thumpling should have.' },
  { from: [-5.5, 2.2, -1.5], to: [-5.5, 6.8, -1.5], look: [-12, 5, -8], look2: [-12, 6.5, -8], cap: 'The Treehouse', who: ELDER,
    line: 'Every Thumpling paints two black stripes on their cheeks. The mark of the Knuckle: climb high, swing hard, never let go.' },
  { from: [-.9, 1.8, -.7], to: [1.1, 1.55, .75], look: [3.8, 1.3, 2.6], look2: [3.8, 1.3, 2.6], cap: 'The Portal', who: ELDER, shinePortal: true,
    line: 'Then one morning, the portal woke up. On the other side floats the Slicing Yard: cubes, glass, water, and a sword stuck in a stone.' },
  { yard: true, from: [-4.5, 1.9, 10], to: [4.5, 1.9, 10], look: [-1, .7, 4], look2: [2, .7, 5], cap: 'The Slicing Yard', who: ELDER, shineSword: true,
    line: 'Scientists showed up and built a Glass Lab, then a Water Lab. Nobody knows why. Science, probably.' },
  { night: true, from: [-1.5, 1.4, 12.5], to: [-2.6, 1.3, 11], look: [-6, 1.4, 6.5], look2: [-6, 1.4, 6.5], who: ELDER,
    line: 'But when the lights go out, something tall and dark walks the grove. If it finds you... run. Run fast.' },
  { from: [0, 1.3, 3.2], to: [0, 3.6, 6], look: [0, 1, 0], look2: [0, .9, 0], who: ELDER, hero: true, title: true,
    line: 'Now it is your turn, little Thumpling. The grove is waiting.' },
];
const readSecs = s => s.split(/\s+/).length / 138 * 60 + 1.6;   // 138 words a minute, plus a beat
CS_SHOTS.forEach(s => { s.dur = Math.max(5, readSecs(s.line) + 1.2); });
/* ---------- black cheek paint on the Thumpling model (friends and statues copy it) ---------- */
function paintCheeks(head) {
  head.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(head), c = box.getCenter(V()), r = box.getSize(V()).length() / 2;
  const inv = head.matrixWorld.clone().invert(), rc = new THREE.Raycaster(), pm = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: .55 }); pm.name = 'Paint';
  const geo = new THREE.BoxGeometry(1, 1, 1);
  [-1, 1].forEach(sx => [-.02, .05].forEach((dy, k) => {
    const dir = V(sx * .5, -.2 - dy * 2.4, -.84).normalize(); rc.set(c.clone().addScaledVector(dir, r * 2.5), dir.clone().negate());
    const hit = rc.intersectObject(head, true).find(h => h.object.isMesh && h.object.material && h.object.material.name === 'Fur'); if (!hit) return;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).transformDirection(inv).normalize();
    const p = hit.point.clone().applyMatrix4(inv);
    const s = new THREE.Mesh(geo, pm); s.name = 'CheekPaint';
    const W = r * .15, H = r * .026; s.scale.set(W, H, r * .012);
    s.position.copy(p).addScaledVector(n, r * .005);   // flat on the fur, facing out
    s.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(V(), n.clone().negate(), V(0, 1, 0))); s.rotateZ(sx * (.15 + k * .08));
    head.add(s);
  }));
}
/* ---------- overlays ---------- */
(() => {
  const st = document.createElement('style');
  st.textContent = `#csCv{position:fixed;inset:0;width:100vw;height:100vh;z-index:70;display:none;pointer-events:auto}
  #csSkip{position:fixed;right:16px;bottom:16px;z-index:71;display:none;padding:10px 16px;border:0;border-radius:12px;background:rgba(255,255,255,.9);font:700 16px Fredoka,system-ui,sans-serif;cursor:pointer}`;
  document.head.appendChild(st);
  const cv = document.createElement('canvas'); cv.id = 'csCv'; document.body.appendChild(cv); CS.cv = cv;
  cv.addEventListener('pointerdown', e => { e.preventDefault(); csAdvance(); });
  canvas.addEventListener('pointerdown', e => { if (CS.on && !state.xr) { e.stopImmediatePropagation(); csAdvance(); } }, true);   // mouse still locked to the game
  const sk = document.createElement('button'); sk.id = 'csSkip'; sk.textContent = 'Skip ⏭'; sk.onclick = e => { e.stopPropagation(); csEnd(); }; document.body.appendChild(sk);
  addEventListener('keydown', e => { if (!CS.on) return; if (e.code === 'Escape') { e.preventDefault(); csEnd(); } else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); csAdvance(); } }, true);
  // replay from the menu
  const mb = document.querySelector('#menu .btns'); if (mb) { const b = document.createElement('button'); b.className = 'alt'; b.textContent = '🎬 Story'; b.onclick = () => { startDesktop(); csPlay(); }; mb.appendChild(b); }
})();
// portrait of the Elder: a round orange Thumpling with a fluffy white beard and the black cheek stripes
function drawElder(g, x, y, s) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#ff9a3c'; g.beginPath(); g.arc(0, 0, s, 0, 7); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, s * .55, s * .6, s * .45, 0, 0, 7); g.fill();
  [-1, 1].forEach(k => { g.fillStyle = '#fff'; g.beginPath(); g.arc(k * s * .36, -s * .15, s * .24, 0, 7); g.fill(); g.fillStyle = '#1a1a22'; g.beginPath(); g.arc(k * s * .34, -s * .12, s * .12, 0, 7); g.fill();
    g.fillStyle = '#0b0b0e'; for (let j = 0; j < 2; j++) { g.save(); g.translate(k * s * .62, s * (.12 + j * .16)); g.rotate(k * .2); g.fillRect(-s * .18, -s * .035, s * .36, s * .07); g.restore(); } });
  g.fillStyle = '#7a4a20'; g.beginPath(); g.ellipse(-s * .5, -s * .7, s * .25, s * .12, -.5, 0, 7); g.ellipse(s * .5, -s * .7, s * .25, s * .12, .5, 0, 7); g.fill();   // bushy brows
  g.restore();
}
function csDraw(g, W, H) {
  g.clearRect(0, 0, W, H);
  const s = CS_SHOTS[CS.i] || CS_SHOTS[CS_SHOTS.length - 1], u = Math.min(W, H * 16 / 9) / 1024;
  if (CS.night) { g.fillStyle = 'rgba(5,10,40,.55)'; g.fillRect(0, 0, W, H); }
  // fades between shots
  if (CS.fade > 0) { g.fillStyle = `rgba(0,0,0,${CS.fade})`; g.fillRect(0, 0, W, H); }
  // letterbox bars
  const bh = H * .12 * CS.bar; g.fillStyle = '#000'; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh);
  // caption naming the place
  if (s.cap && CS.t < 3.2) { const a = Math.min(1, CS.t / .5, (3.2 - CS.t) / .5); g.globalAlpha = Math.max(0, a); g.textAlign = 'left'; g.font = `700 ${Math.round(40 * u)}px Fredoka, sans-serif`; g.fillStyle = '#ffd25a'; g.shadowColor = '#000'; g.shadowBlur = 8 * u; g.fillText(s.cap, 40 * u, bh + 56 * u); g.shadowBlur = 0; g.globalAlpha = 1; }
  // title card
  if (s.title && CS.t > 1.5) { const a = Math.min(1, (CS.t - 1.5) / .8); g.globalAlpha = a; g.textAlign = 'center'; g.font = `900 ${Math.round(96 * u)}px Fredoka, sans-serif`; g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 16 * u; g.fillText('KNUCKLE GROVE', W / 2, H * .38); g.font = `600 ${Math.round(32 * u)}px Fredoka, sans-serif`; g.fillStyle = '#ffd25a'; g.fillText('Swing hard. Stick the landing.', W / 2, H * .38 + 52 * u); g.shadowBlur = 0; g.globalAlpha = 1; }
  // dialogue box with the speaker's portrait
  if (s.line && CS.bar > .9) {
    const bw = Math.min(W - 40 * u, 900 * u), bx = (W - bw) / 2, by = H - bh - 150 * u, bht = 136 * u;
    g.fillStyle = 'rgba(12,16,26,.88)'; g.beginPath(); g.roundRect(bx, by, bw, bht, 18 * u); g.fill(); g.strokeStyle = 'rgba(255,210,90,.8)'; g.lineWidth = 3 * u; g.stroke();
    g.fillStyle = '#2a3346'; g.beginPath(); g.arc(bx + 66 * u, by + bht / 2, 50 * u, 0, 7); g.fill(); drawElder(g, bx + 66 * u, by + bht / 2, 42 * u);
    g.textAlign = 'left'; g.fillStyle = '#ffd25a'; g.font = `700 ${Math.round(24 * u)}px Fredoka, sans-serif`; g.fillText(s.who, bx + 130 * u, by + 34 * u);
    g.fillStyle = '#ffffff'; g.font = `500 ${Math.round(24 * u)}px Fredoka, sans-serif`;
    const txt = s.line.slice(0, Math.floor(CS.typed)), words = txt.split(' '), maxW = bw - 150 * u; let line = '', yy = by + 68 * u;
    for (const w of words) { const t2 = line ? line + ' ' + w : w; if (g.measureText(t2).width > maxW) { g.fillText(line, bx + 130 * u, yy); line = w; yy += 30 * u; } else line = t2; }
    g.fillText(line, bx + 130 * u, yy);
    if (CS.lineDone && Math.sin(tAll * 6) > 0) { g.fillStyle = '#ffd25a'; g.textAlign = 'right'; g.fillText('▶', bx + bw - 18 * u, by + bht - 16 * u); }
  }
  if (state.xr) { g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `600 ${Math.round(18 * u)}px Fredoka, sans-serif`; g.fillText('trigger = next   B / Y = skip', W - 20 * u, H - 12 * u); }
}
/* ---------- star shine: the cartoon ✨ ting on shiny things ---------- */
const SHINE_T = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 40); gr.addColorStop(0, 'rgba(255,255,230,.9)'); gr.addColorStop(1, 'rgba(255,255,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, 2); g.lineTo(70, 58); g.lineTo(126, 64); g.lineTo(70, 70); g.lineTo(64, 126); g.lineTo(58, 70); g.lineTo(2, 64); g.lineTo(58, 58); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); return t; })();
function shine(p, size = .35, delay = 0) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHINE_T, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  s.position.copy(p); s.scale.setScalar(.001); s.renderOrder = 9; scene.add(s); CS.shine.push({ s, t: -delay, size });
  return s;
}
function stepShine(dt) {
  for (let i = CS.shine.length - 1; i >= 0; i--) { const o = CS.shine[i]; o.t += dt; if (o.t < 0) continue; const a = o.t / .55;
    if (a >= 1) { scene.remove(o.s); o.s.material.dispose(); CS.shine.splice(i, 1); continue; }
    const k = a < .35 ? a / .35 * 1.2 : a < .5 ? 1.2 - (a - .35) / .15 * .2 : 1 - (a - .5) / .5; o.s.scale.setScalar(Math.max(.001, k * o.size)); o.s.material.rotation = a * .8; }
}
/* ---------- playing ---------- */
function csMaybe() { if (store.get('kg-story') !== '1') setTimeout(() => { if (state.mode === 'play' && !CS.on) csPlay(); }, state.xr ? 1500 : 200); }
function csPlay() {
  if (CS.on) return; CS.on = true; CS.i = -1; CS.total = 0; CS.bar = 0; CS.ending = false; CS.endT = 0;
  if (!state.xr) { CS.cv.style.display = 'block'; $('csSkip').style.display = 'block'; }
  else csTheater(true);
  if (state.area === 'arena') travel(false);
  if (state.area === 'wilds') arrive(V().copy(SPAWN), 0, 'grove');
  csNext();
  if (ac) { tone('sine', 220, 220, 2.5, .05); tone('sine', 330, 330, 2.5, .04, .1); tone('sine', 440, 440, 2.5, .03, .2); }
}
function csNext() {
  CS.i++; csShotEnd();
  if (CS.i >= CS_SHOTS.length) { csEnd(); return; }
  const s = CS_SHOTS[CS.i]; CS.t = 0; CS.typed = 0; CS.lineDone = false; CS.fade = 1; CS.night = !!s.night;
  if (s.orbit) { CS.orb = s.orbit; }
  else if (s.berry) { const b = berries.find(b => !b.taken) || berries[0], p = b.g.position.clone(); CS.from.copy(p).add(V(2.6, 1.3, 2.2)); CS.to.copy(p).add(V(1.4, .9, 1.5)); CS.la.copy(p); CS.lb.copy(p); CS.orb = null; CS.berryP = p; }
  else { const off = s.yard ? ARENA : V(); CS.from.set(...s.from).add(off); CS.to.set(...s.to).add(off); CS.la.set(...s.look).add(off); CS.lb.set(...s.look2).add(off); CS.orb = null; }
  if (s.night) { CS.figWas = fig.g.visible; if (HZ.phase === 'none') { fig.g.position.set(-6, HZ_GROUND, 6.5); fig.g.rotation.set(0, Math.atan2(-2.6 + 6, 11 - 6.5), 0); tPose(fig); fig.g.visible = true; } if (ac) { tone('sawtooth', 55, 50, 4, .05); tone('sine', 41, 40, 4, .08); } }
  if (ac && !s.night) tone('triangle', [392, 440, 494, 523, 587, 523, 440, 659][CS.i % 8], [392, 440, 494, 523, 587, 523, 440, 659][CS.i % 8], 1.2, .035);
}
function csShotEnd() { if (CS.figWas !== null && HZ.phase === 'none') { fig.g.visible = CS.figWas; } CS.figWas = null; }
function csAdvance() {   // Enter / click / tap / trigger: finish the typing, or go to the next shot
  if (!CS.on || CS.ending) return; const s = CS_SHOTS[CS.i]; if (!s) return;
  if (!CS.lineDone) { CS.typed = s.line.length; CS.lineDone = true; } else csNext();
}
function csEnd() {
  if (!CS.on) return; csShotEnd(); CS.on = false; store.set('kg-story', '1');
  CS.cv.style.display = 'none'; $('csSkip').style.display = 'none'; csTheater(false);
  CS.shine.forEach(o => scene.remove(o.s)); CS.shine.length = 0;
  toast('🐾 Go get \'em, Thumpling!', 2.5);
}
// VR: a dark theater bubble and a big screen that stays put in front of you
function csTheater(on) {
  if (on) {
    if (!CS.vr) {
      const rt = new THREE.WebGLRenderTarget(1024, 576, { colorSpace: THREE.SRGBColorSpace }), ov = document.createElement('canvas'); ov.width = 1024; ov.height = 576; const ot = new THREE.CanvasTexture(ov); ot.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group(), scr = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: rt.texture, toneMapped: false })), over = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: ot, transparent: true, toneMapped: false }));
      over.position.z = .01; g.add(scr, over);
      const room = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 12), new THREE.MeshBasicMaterial({ color: 0x05060a, side: THREE.BackSide, transparent: true, opacity: .96, depthWrite: false }));
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), new THREE.MeshBasicMaterial({ color: 0x111418 })); fr.position.z = -.01; g.add(fr);
      [g, room, scr, over, fr].forEach(o => o.layers.set(THEATER)); room.renderOrder = -1;
      scene.add(g, room); CS.vr = { rt, ov, ot, g, room, frame: 0 };
    }
    headWorld(_cs1); camera.getWorldDirection(_cs2); _cs2.y = 0; _cs2.normalize();
    CS.vr.g.position.copy(_cs1).addScaledVector(_cs2, 2.6); CS.vr.g.position.y = _cs1.y; CS.vr.g.lookAt(_cs1.x, _cs1.y, _cs1.z); CS.vr.room.position.copy(_cs1);
    CS.vr.g.visible = CS.vr.room.visible = true;
  } else if (CS.vr) CS.vr.g.visible = CS.vr.room.visible = false;
}
const _cs1 = V(), _cs2 = V();
function csRenderRT() {   // VR only: film the shot into the screen's texture (every other frame, to stay smooth)
  if (!CS.vr || (CS.vr.frame++ & 1)) return;
  const xrOn = renderer.xr.enabled, prev = renderer.getRenderTarget(), sa = renderer.shadowMap.autoUpdate;
  renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(CS.vr.rt); renderer.render(scene, CS.cam); renderer.setRenderTarget(prev);
  renderer.xr.enabled = xrOn; renderer.shadowMap.autoUpdate = sa;
  csDraw(CS.vr.ov.getContext('2d'), 1024, 576); CS.vr.ot.needsUpdate = true;
}
function csRender() {   // called by the main loop instead of renderer.render
  const hc = huCam();   // 🩸 THE HUNT map tour / Thumpling cutscene camera (99-hunt)
  if (hc && !state.xr) { hc.aspect = innerWidth / innerHeight; hc.updateProjectionMatrix(); renderer.render(scene, hc); return; }
  if (hc && HU.tour) { huRenderRT(); renderer.render(scene, camera); return; }
  if (CS.on && !state.xr) { CS.cam.aspect = innerWidth / innerHeight; CS.cam.updateProjectionMatrix(); renderer.render(scene, CS.cam);
    const c = CS.cv, d = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(innerWidth * d)) { c.width = Math.round(innerWidth * d); c.height = Math.round(innerHeight * d); } csDraw(c.getContext('2d'), c.width, c.height); return; }
  if (CS.on) csRenderRT();
  renderer.render(scene, camera);
}
const ease = x => x * x * (3 - 2 * x);
function stepStory(dt) {
  stepShine(dt);
  // the 🎬 button by the spawn
  if (state.area === 'grove' && (state.xr || sim.on) && !CS.on) for (const h of hands) { if (!h.tracked) continue; const ins = h.pos.distanceTo(STORY_BTN.top) < .12; if (ins && !STORY_BTN.in[h.i]) { buzz(h, .6, 40); csPlay(); } STORY_BTN.in[h.i] = ins; }
  if (!CS.on) return;
  const s = CS_SHOTS[CS.i]; if (!s) return;
  CS.t += dt; CS.total += dt;
  CS.bar = CS.ending ? Math.max(0, CS.bar - dt * 2) : Math.min(1, CS.bar + dt * 1.6);
  CS.fade = CS.t < .4 ? 1 - CS.t / .4 : CS.t > s.dur - .35 ? Math.min(1, (CS.t - (s.dur - .35)) / .35) : 0;
  if (CS.t > .5) { CS.typed = Math.min(s.line.length, CS.typed + dt * 34); if (CS.typed >= s.line.length && !CS.lineDone) CS.lineDone = true; if (ac && Math.floor(CS.typed) % 4 === 0 && Math.floor(CS.typed) !== CS.tick && !CS.lineDone) { CS.tick = Math.floor(CS.typed); tone('square', 900 + rnd() * 200, 900, .015, .012); } }
  // camera: one smooth move per shot
  const k = ease(Math.min(1, CS.t / s.dur));
  if (CS.orb) { const o = CS.orb, a = o.a0 + (o.a1 - o.a0) * k, c = _cs1.set(...o.c); if (s.hero) headWorld(c).y -= .25; CS.cam.position.set(c.x + Math.sin(a) * o.r, c.y + o.h * .5, c.z + Math.cos(a) * o.r); CS.look.copy(c); }
  else { CS.cam.position.lerpVectors(CS.from, CS.to, k); CS.look.lerpVectors(CS.la, CS.lb, k); if (s.hero) { headWorld(_cs1); CS.look.lerp(_cs1.setY(_cs1.y - .2), .6); } }
  CS.cam.lookAt(CS.look);
  // star shines on the shiny things, right as the camera settles
  if (!CS.shone && CS.t > 1.6) { CS.shone = true;
    if (s.berry) { shine(CS.berryP.clone().add(V(.06, .08, .05)), .4); const others = berries.filter(b => !b.taken).slice(1, 3); others.forEach((b, i) => shine(b.g.position.clone(), .3, .3 + i * .25)); }
    if (s.shinePortal) shine(V(3.8, 2.3, 2.6), .6); if (s.shineSword) shine(V().copy(ARENA).add(STONE).add(V(0, .75, 0)), .5); if (s.title) shine(headWorld(V()).add(V(.15, .1, 0)), .35); }
  if (CS.t < .1) CS.shone = false;
  // VR: trigger = next, B/Y = skip
  if (state.xr) { hands.forEach(h => { const gp = h.src && h.src.gamepad; if (!gp) return; const tr = !!(gp.buttons[0] && gp.buttons[0].pressed), b = !!(gp.buttons[5] && gp.buttons[5].pressed);
    if (tr && !CS.lastT[h.i]) csAdvance(); CS.lastT[h.i] = tr; if (b && !CS.lastB) csEnd(); CS.lastB = b; }); }
  if (CS.t >= s.dur && CS.lineDone) csNext();
}
// the 🎬 STORY button by the spawn (tap it to watch again)
const STORY_BTN = (() => {
  const P = V(1.3, 0, 3.1), g = new THREE.Group(); g.position.copy(P); scene.add(g);
  part(new THREE.CylinderGeometry(.12, .15, .85, 16), smat(0x2b3446, { roughness: .5 }), 0, .425, 0, g);
  const cap = part(new THREE.BoxGeometry(.2, .05, .14), smat(0x1a1a22), 0, .88, 0, g);
  const st = new THREE.Mesh(new THREE.BoxGeometry(.2, .03, .14), smat(0xffffff)); st.position.set(0, .925, -.05); st.rotation.x = -.35; g.add(st);
  const t = labelTex(256, 96, (q, w, h) => signText(q, w, h, [['🎬 STORY', 50, '#ffd25a', 52]], 'rgba(14,20,30,.95)', '#ffd25a'));
  const s = new THREE.Mesh(new THREE.PlaneGeometry(.32, .12), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide })); s.position.set(0, 1.12, 0); g.add(s);
  addCol({ t: 1, x: P.x, z: P.z, cy: .43, hy: .43, r: .16, tag: 'rock' });
  return { g, top: V(P.x, .92, P.z), in: [false, false] };
})();
window.__kg.story = { CS, CS_SHOTS, csPlay, csEnd, csAdvance, csNext, stepStory, paintCheeks };
