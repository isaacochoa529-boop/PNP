/* ======================= SWIMMING + SUNRAYS =======================
   SWIMMING: deep water (the Knuckle Beach sea past the wading shelf, the Wilds lake / river / oasis) floats you.
   - VR: pull your paws back like a frog (breaststroke) to swim where you LOOK. Look down + stroke = dive, look up = rise.
     Strokes forward (the recovery) barely count, so swinging back and forth still moves you. Buoyancy floats you to the top.
   - PC / phone: W / stick = swim where you look (look down past a little tilt to dive), Space / Jump = up and hop out
     at the surface, C (or Ctrl) = dive, Shift = fast.
   - Underwater: blue fog, muffled sound + rumble, bubbles from your mouth and paws, shimmering light shafts, a wavy
     bright "window" on the surface above you, caustics dancing on the sea floor. Surface rings + splashes.
   - Under the beach sea: seaweed that sways, coral, starfish, rocks, a sunken rowboat, two fish schools that flee you.
   SUNRAYS: god-ray shafts through the grove trees and around the Elder Tree in the Wilds (with dust motes + warm light
   puddles on the ground), and sunset rays fanning out from the sun behind the clouds at the beach. Off in horror mode.
   All of it is cheap additive meshes (no post-processing) so it stays smooth on Quest.
   Hooks: swimCheck (start of update, play only), swimArms (stepArms), swimDesk (stepDesktop), stepSwim (end of update).
   Secrets: 3 (localStorage 'kg-swsec'). Test hook: __kg.swim */
const SW = { on: false, under: false, surf: 0, floor: 0, diveT: 0, hopT: 0, told: false, save: null, lp: null, rum: null, bubT: 1, ringT: 0, enterT: -9, strokeT: 0, beamT: 0, sparkle: 0 };
let _swf = []; try { _swf = JSON.parse(store.get('kg-swsec') || '[]'); } catch (e) {}
SW.found = new Set(_swf);
const _sw1 = V(), _sw2 = V(), _sw3 = V(), _sw4 = V(), _swq = new THREE.Quaternion(), _swm = new THREE.Matrix4(), _swo = new THREE.Object3D(), _swc = new THREE.Color();
const SW_W = { y: 0, floor: 0 };
const SW_STROKE = 2.7;
const SW_U = { t: { value: 0 } };
const SUN_DIR = V(-12, -24, -8).normalize();   // the grove sun sits at (+12, +24, +8) from you, so its light travels this way

function swSecret(id, msg) {
  if (SW.found.has(id)) return false; SW.found.add(id); store.set('kg-swsec', JSON.stringify([...SW.found]));
  toast(msg, 7); sfxWin(); headWorld(_sw4); confetti(_sw4.clone().add(V(0, .3, 0)), 70); hands.forEach(h => buzz(h, 1, 120)); return true;
}

/* ---------- where is the water? ---------- */
function seaSwell(lx, lz, t) {   // the same waves the beach sea shader draws, so you bob with them
  const amp = .25 + .75 * sst(-1, -18, lz);
  return (Math.sin(lx * .33 + t * 1.3) * .07 + Math.sin(lz * .47 - t * 1.7 + lx * .11) * .09 + Math.sin((lx + lz) * .83 + t * 2.4) * .03) * amp;
}
function waterAt(x, z) {
  if (state.area === 'beach') {
    const lx = x - BEACH.x, lz = z - BEACH.z, f = beachH(lx, lz);
    if (lz < 2 && Math.abs(lx) < 60 && f < -.05) { SW_W.y = BEACH.y + seaSwell(lx, lz, tAll); SW_W.floor = BEACH.y + f; return SW_W; }
  } else if (state.area === 'wilds') {
    const lx = x - WILD.x, lz = z - WILD.z, f = gy(lx, lz);
    if (f < WL - .05) { SW_W.y = WILD.y + WL; SW_W.floor = WILD.y + f; return SW_W; }
  }
  return null;
}

/* ---------- am I swimming? (start of every play frame) ---------- */
function swimCheck(dt) {
  SW.diveT -= dt; SW.hopT -= dt;
  headWorld(_sw1); const W = waterAt(_sw1.x, _sw1.z);
  let on = SW.on;
  if (!W || rcRiding()) on = false;
  else {
    const eye = _sw1.y - W.y, deep = W.y - W.floor, b = state.bodyH;
    SW.surf = W.y; SW.floor = W.floor;
    if (!on) on = deep > b * .85 && eye < b * .45;
    else if (deep < b * .7 || eye > b * .95) on = false;
  }
  if (on !== SW.on) swimToggle(on);
  const under = SW.on && _sw1.y < SW.surf - .04;
  if (under !== SW.under) swimUnder(under);
}
function swimToggle(on) {
  SW.on = on; headWorld(_sw1);
  hands.forEach(h => { h.swp = null; });
  if (!on) return;
  const big = state.vel.y < -2.2, p = _sw4.set(_sw1.x, SW.surf + .03, _sw1.z);
  if (tAll - SW.enterT > .8) {
    if (ac) { noiseHit(ac.currentTime, big ? .45 : .22, big ? .55 : .2, 'lowpass', big ? 1300 : 900, .7); if (big) tone('sine', 320, 80, .35, .1); }
    confetti(p, big ? 34 : 10, [0xffffff, 0xaeeeff, 0x7fd8ff]); swRing(p, big ? 1.6 : .9); if (big) { swRing(p, .6); hands.forEach(h => buzz(h, .7, 80)); }
  }
  SW.enterT = tAll; state.vel.y *= .35;
  if (!SW.told) {
    SW.told = true;
    toast(state.xr ? '🏊 SWIMMING! Pull your paws back like a frog to swim where you LOOK. Look down + stroke = DIVE 🤿'
      : state.touch ? '🏊 SWIMMING! Stick = swim where you look (look down to DIVE 🤿) · Jump = swim up / hop out'
      : '🏊 SWIMMING! W = swim where you look (look down to DIVE 🤿) · Space = up / hop out · C = dive', 7);
  }
}

/* ---------- floating: buoyancy + water drag ---------- */
function swimBuoy(dt, diving, drag = true) {
  headWorld(_sw1); const v = state.vel, d = SW.surf + .13 - _sw1.y;   // float with your eyes just above the waves
  let ay;
  if (d < 0) ay = -G * bmGrav();                                     // above the float line: drop back in
  else if (d < .7) ay = (d * 16 - v.y * 3.2) * (diving ? .15 : 1);   // a springy bob at the top
  else ay = diving ? .25 : 1.5;                                      // deep down you slowly drift up
  v.y += ay * dt;
  if (drag) { const kh = Math.exp(-dt * 1.3); v.x *= kh; v.z *= kh; }
  v.y *= Math.exp(-dt * (d < 0 ? .1 : 1.5));
  if (v.length() > 5) v.setLength(5);
}

/* ---------- VR: arm strokes (called from stepArms when no paw is stuck) ---------- */
function swimArms(dt) {
  if (!SW.on) return false;
  camera.getWorldDirection(_sw2);
  let dive = SW.diveT > 0;
  for (const h of hands) {
    if (!h.tracked || h.stuck) { h.swp = null; continue; }
    if (!h.swp) { h.swp = h.local.clone(); h.swv = V(); continue; }
    _sw3.subVectors(h.local, h.swp).multiplyScalar(1 / Math.max(dt, 1e-3)); h.swp.copy(h.local); h.swv.lerp(_sw3, .5);
    const sp = h.swv.length(); if (sp < .4) continue;
    _sw3.copy(h.swv).applyQuaternion(rig.quaternion);              // your paw's own swing, in the world
    const c = _sw3.dot(_sw2) / sp, w = .1 + .9 * sst(.15, -.55, c); // pulling back = power, reaching forward = recovery
    state.vel.addScaledVector(_sw3, -w * SW_STROKE * dt);
    if (-_sw3.y * w < -.6) { SW.diveT = .5; dive = true; }
    if (w > .6 && sp > 1.1) swimStrokeFx(h, sp);
  }
  swimBuoy(dt, dive);
  return true;
}
function swimStrokeFx(h, sp) {
  h.swfx = (h.swfx || 0); if (tAll - h.swfx < .28) return; h.swfx = tAll;
  buzz(h, clamp(sp * .12, .1, .4), 18);
  if (h.pos.y < SW.surf - .05) { swBubble(h.pos, 3, .05); if (ac) tone('sine', 150, 90, .18, .025); }
  else if (h.pos.y < SW.surf + .25) { _sw4.set(h.pos.x, SW.surf + .03, h.pos.z); confetti(_sw4, 6, [0xffffff, 0xaeeeff]); swRing(_sw4, .5); if (ac) noiseHit(ac.currentTime, .16, .09, 'bandpass', 800, 1); }
}

/* ---------- PC / phone (called from stepDesktop) ---------- */
function swimDesk(dt, f, s) {
  if (!SW.on) return false;
  const k = state.keys, v = state.vel, cp = Math.cos(state.pitch);
  const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw), rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw);
  let dx = fx * cp * f + rx * s, dz = fz * cp * f + rz * s, dy = Math.abs(state.pitch) > .3 ? f * Math.sin(state.pitch) : 0;   // a little tilt = stay level
  if (Math.abs(state.pitch) <= .3) { const L2 = Math.hypot(dx, dz); if (L2 > 0) { const m = Math.hypot(f, s) / L2; dx *= m; dz *= m; } }
  dy += (k.Space ? 1 : 0) - (k.KeyC || k.ControlLeft ? 1 : 0);
  const L = Math.hypot(dx, dy, dz); if (L > 1) { dx /= L; dy /= L; dz /= L; }
  const spd = k.ShiftLeft || k.ShiftRight ? 4 : 2.6, a = Math.min(1, 2.6 * dt);
  headWorld(_sw1);
  if (k.Space && SW.hopT <= 0 && !SW.under && _sw1.y > SW.surf - .02) {   // dolphin hop: out of the water (onto the pier!)
    v.y = 5.6; SW.hopT = 1; _sw4.set(_sw1.x, SW.surf + .03, _sw1.z); confetti(_sw4, 14, [0xffffff, 0xaeeeff, 0x7fd8ff]); swRing(_sw4, 1);
    if (ac) noiseHit(ac.currentTime, .25, .25, 'lowpass', 1100, .7);
    return true;
  }
  v.x += (dx * spd - v.x) * a; v.z += (dz * spd - v.z) * a;
  if (Math.abs(dy) > .05) v.y += (dy * spd - v.y) * a;
  swimBuoy(dt, dy < -.1, false);
  if (L > .1 && (SW.strokeT -= dt) < 0) {   // stroke sounds + bubbles in time with the paw animation
    SW.strokeT = .62;
    if (SW.under) { _sw4.set(0, -.15, -.4); camera.localToWorld(_sw4); swBubble(_sw4, 3, .08); if (ac) tone('sine', 150, 90, .18, .02); }
    else { _sw4.set(_sw1.x, SW.surf + .03, _sw1.z); swRing(_sw4, .7); if (ac) noiseHit(ac.currentTime, .14, .06, 'bandpass', 800, 1); }
  }
  return true;
}

/* ---------- underwater look + sound ---------- */
const SW_TINT = { beach: new THREE.Color(0x1d6d88), lake: new THREE.Color(0x2a6a66), dark: new THREE.Color(0x061219) };
function swimUnder(on) {
  SW.under = on;
  const sky = scene.userData.sky;
  if (on) {
    SW.save = { bg: scene.background.clone(), fog: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far, sky: sky.visible };
    const c = HZ.on ? SW_TINT.dark : state.area === 'beach' ? SW_TINT.beach : SW_TINT.lake;
    scene.background.copy(c); scene.fog.color.copy(c); scene.fog.near = .4; scene.fog.far = state.area === 'beach' ? 26 : 17; sky.visible = false;
    CEIL_U.fogc.value.copy(c); CEIL_U.hi.value.set(state.area === 'beach' ? 0xffe0b0 : 0xd8f8ff);
    VEIL.material.color.copy(c).offsetHSL(0, 0, .12);
    if (ac) tone('sine', 260, 80, .3, .08);
    swBubble(headWorld(_sw4), 8, .12);
  } else if (SW.save) {
    const S = SW.save; SW.save = null;
    scene.background.copy(S.bg); scene.fog.color.copy(S.fog); scene.fog.near = S.near; scene.fog.far = S.far; sky.visible = S.sky;
    if (ac && state.mode === 'play') noiseHit(ac.currentTime, .2, .12, 'lowpass', 1400, .7);
  }
  VEIL.visible = on; CEIL.visible = on; UW_RAYS.visible = on;
  swimMuffle(on);
}
function swimMuffle(on) {
  if (!ac || !master) return;
  if (!SW.lp) {   // route everything through one low-pass so the whole world goes "mmmf" underwater
    SW.lp = ac.createBiquadFilter(); SW.lp.type = 'lowpass'; SW.lp.frequency.value = 20000; SW.lp.Q.value = .5;
    try { master.disconnect(); } catch (e) {} master.connect(SW.lp); SW.lp.connect(ac.destination);
    const len = ac.sampleRate * 2, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 4; }
    const src = ac.createBufferSource(); src.buffer = b; src.loop = true; const g = ac.createGain(); g.gain.value = 0; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    src.connect(f); f.connect(g); g.connect(ac.destination); src.start(); SW.rum = g;   // the rumble skips the muffle (it IS the muffle)
  }
  SW.lp.frequency.setTargetAtTime(on ? 520 : 20000, ac.currentTime, .06);
  SW.rum.gain.setTargetAtTime(on ? .22 : 0, ac.currentTime, .15);
}
// a soft blue veil right on your face (camera child) so everything looks wet
const VEIL = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 10), new THREE.MeshBasicMaterial({ color: 0x3aa8c8, transparent: true, opacity: .14, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }));
VEIL.renderOrder = 9998; VEIL.visible = false; VEIL.frustumCulled = false; camera.add(VEIL);
// the underside of the water: a bright wavy window straight above you, darker mirror-ish water further out
const CEIL_U = { t: SW_U.t, hi: { value: new THREE.Color(0xffe0b0) }, fogc: { value: new THREE.Color(0x1d6d88) } };
const CEIL = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.ShaderMaterial({ uniforms: CEIL_U, transparent: true, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `uniform float t; uniform vec3 hi; uniform vec3 fogc; varying vec3 vW;
    void main(){ vec2 d = vW.xz - cameraPosition.xz; float r = length(d), dep = max(vW.y - cameraPosition.y, .1);
      float win = 1. - smoothstep(dep*.9, dep*1.3 + .4, r);
      float rip = sin(vW.x*2.3+t*1.7)*sin(vW.z*2.1-t*1.3) + sin((vW.x-vW.z)*3.7+t*2.3)*.5 + sin(vW.z*5.3+t*3.1)*.25;
      vec3 deepc = fogc*1.35 + vec3(.02,.05,.06);
      vec3 col = mix(deepc, hi, win*(.72 + .28*rip));
      col += vec3(.55,.75,.8) * pow(max(rip, 0.), 4.) * .3 * (.3 + win);
      col = mix(col, fogc, smoothstep(9., 45., r) * (1. - win));
      gl_FragColor = vec4(col, mix(.9, .97, win)); }` }));
CEIL.rotation.x = Math.PI / 2; CEIL.renderOrder = 3; CEIL.visible = false; CEIL.frustumCulled = false; scene.add(CEIL);

/* ---------- light shafts (one shader for grove, Elder Tree and underwater) ---------- */
const SHAFT_GEO = new THREE.CylinderGeometry(.75, 1.15, 1, 14, 1, true).translate(0, -.5, 0);   // y 0 (top) .. -1 (bottom), widening as it falls
function shaftMat(color, inten, fr, nearF) {
  return new THREE.ShaderMaterial({ uniforms: { t: SW_U.t, col: { value: new THREE.Color(color).multiplyScalar(inten) }, fr: { value: fr }, nearF: { value: nearF } },
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying float vU; varying vec3 vN; varying vec3 vW; varying float vId;
      void main(){ vU = -position.y; vId = float(gl_InstanceID); mat4 m = modelMatrix * instanceMatrix; vec4 w = m * vec4(position, 1.);
        vW = w.xyz; vN = normalize(mat3(m) * vec3(normal.x, 0., normal.z)); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float t; uniform vec3 col; uniform float fr; uniform float nearF; varying float vU; varying vec3 vN; varying vec3 vW; varying float vId;
      void main(){ vec3 Vd = normalize(cameraPosition - vW); float e = abs(dot(normalize(vN), Vd)); e *= e;
        float along = smoothstep(0., .2, vU) * (1. - smoothstep(.45, 1., vU));
        float fl = .62 + .38 * sin(t*fr + vId*2.7) * sin(t*fr*.43 + vId*1.3);
        float nr = smoothstep(nearF*.35, nearF, distance(cameraPosition, vW));
        gl_FragColor = vec4(col * e * along * fl * nr, 1.); }` });
}
function shaftSet(list, color, inten, fr, nearF, parent = scene) {
  const im = new THREE.InstancedMesh(SHAFT_GEO, shaftMat(color, inten, fr, nearF), list.length); im.frustumCulled = false; im.renderOrder = 4;
  list.forEach((s, i) => { _swq.setFromUnitVectors(V(0, -1, 0), s.dir); _swm.compose(s.top, _swq, V(s.r, s.L, s.r)); im.setMatrixAt(i, _swm); });
  parent.add(im); return im;
}
// a shaft that lands on the ground at gp, coming down the sun's way from H metres up
const sunShaft = (gx, gy0, gz, H, r) => ({ gp: V(gx, gy0, gz), top: V(gx, gy0, gz).addScaledVector(SUN_DIR, -H / -SUN_DIR.y), dir: SUN_DIR, L: H / -SUN_DIR.y * 1.03, r });
// warm light puddles where the shafts touch down + floating dust
const PUDDLE_TEX = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
function puddles(list, color, op) {
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, map: PUDDLE_TEX, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, fog: true }), list.length);
  list.forEach((s, i) => { _swo.position.copy(s.gp).y += .03; _swo.rotation.set(0, Math.atan2(SUN_DIR.x, SUN_DIR.z), 0); _swo.scale.set(s.r * 2.4, 1, s.r * 2.4 / Math.max(.5, -SUN_DIR.y)); _swo.updateMatrix(); im.setMatrixAt(i, _swo.matrix); });
  im.frustumCulled = false; im.renderOrder = 4; scene.add(im); return im;
}
function motes(list, n) {
  const pos = new Float32Array(n * 3), sd = new Float32Array(n);
  for (let i = 0; i < n; i++) { const s = list[i % list.length], u = .25 + Math.random() * .7, a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * s.r * .9;
    _sw4.copy(s.top).addScaledVector(s.dir, s.L * u); pos.set([_sw4.x + Math.cos(a) * rr, _sw4.y, _sw4.z + Math.sin(a) * rr], i * 3); sd[i] = Math.random() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { t: SW_U.t }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float t; attribute float sd; varying float vA;
      void main(){ vec3 p = position + vec3(sin(t*.31+sd)*.35, sin(t*.23+sd*1.7)*.5, cos(t*.27+sd*.7)*.35);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(16. / -mv.z, 1., 9.);
        vA = (.5 + .5*sin(t*1.3 + sd*3.)) * smoothstep(.6, 2.5, -mv.z); }`,
    fragmentShader: 'varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float a = smoothstep(.5, .1, length(c)) * vA; gl_FragColor = vec4(vec3(1., .93, .7) * a * .9, 1.); }' });
  const P = new THREE.Points(g, m); P.frustumCulled = false; P.renderOrder = 5; scene.add(P); return P;
}

/* ---------- SUNRAYS in the grove: through the oaks + birches ---------- */
const GROVE_SHAFTS = [[-10.5, -6.8, .9], [-13.8, -10.2, .7], [15.6, -7.4, .8], [12.2, -10.8, 1], [-15.4, 13.6, .8], [12.8, 12.2, .9], [9.2, 15.6, .7], [5.4, -20.4, .8], [-22.6, -.6, .7], [20.4, 5.6, .75], [-6, 3.5, .55], [2.5, 9.5, .6]]
  .map(([x, z, r]) => sunShaft(x, 0, z, 10.5, r));
const GOLD_SHAFT = sunShaft(-18.6, 0, 9.8, 10.5, .55);   // this one is different...
const SUNRAY = {
  grove: shaftSet(GROVE_SHAFTS, 0xfff0c2, .45, .9, 3),
  gold: shaftSet([GOLD_SHAFT], 0xffc640, .5, 1.6, 2.2),
  gpud: puddles([...GROVE_SHAFTS, GOLD_SHAFT], 0xffe6a8, .32),
  gmotes: motes([...GROVE_SHAFTS, GOLD_SHAFT], 260),
};
/* ...and around the Elder Tree in the Wilds */
{
  const L = [[5, 3, 1.1], [-4.5, 6, .9], [7, -5, .8], [-7, -3.5, 1], [1.5, -8.5, .8], [-2, 9.5, .9], [9.5, 1.5, .7]].map(([dx, dz, r]) => {
    const x = W_ELDER.x + dx, z = W_ELDER.z + dz; return sunShaft(WILD.x + x, WILD.y + gy(x, z), WILD.z + z, 17, r); });
  SUNRAY.elder = shaftSet(L, 0xfff0c2, .32, .8, 3); SUNRAY.epud = puddles(L, 0xffe6a8, .3); SUNRAY.emotes = motes(L, 160);
}
/* ...and sunset rays fanning out of the sun behind the clouds at the beach */
SUNRAY.fan = (() => {
  const N = 34, pos = [], uv = [], id = [];
  for (let i = 0; i < N; i++) {
    const h1 = hsh(i, 1, 2, 3) + .5, h2 = hsh(i, 4, 5, 6) + .5, a = -.42 + (i + h1 * .8) / N * (Math.PI + .84), w = .012 + h2 * .03, L = 110 + hsh(i, 7, 8, 9) * 120;
    pos.push(0, 0, 0, Math.cos(a - w) * L, Math.sin(a - w) * L, 0, Math.cos(a + w) * L, Math.sin(a + w) * L, 0);
    uv.push(0, 0, 1, -1, 1, 1); id.push(i, i, i);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('rid', new THREE.Float32BufferAttribute(id, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { t: SW_U.t, hy: { value: BEACH.y + .5 } }, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float rid; varying vec2 vUv; varying float vId; varying float vY; void main(){ vUv = uv; vId = rid; vec4 w = modelMatrix*vec4(position,1.); vY = w.y; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float t; uniform float hy; varying vec2 vUv; varying float vId; varying float vY;
      void main(){ float u = vUv.x, e = 1. - pow(abs(vUv.y) / max(u, .001), 2.);
        float fl = .55 + .45 * sin(t*.35 + vId*2.1) * sin(t*.21 + vId*.7);
        float a = e * pow(1. - u, 1.4) * smoothstep(.02, .1, u) * fl * smoothstep(hy - 1., hy + 9., vY);
        gl_FragColor = vec4(vec3(1., .82, .55) * a * .38, 1.); }` });
  const me = new THREE.Mesh(g, m); me.position.set(0, 8, -184); me.frustumCulled = false; me.renderOrder = 2; BG.add(me); return me;
})();

/* ---------- underwater light shafts (follow you, snapped to a grid so they stay put while you swim past) ---------- */
const UW_RAYS = new THREE.InstancedMesh(SHAFT_GEO, shaftMat(0xc8f4ff, .2, 2.2, 1.6), 16); UW_RAYS.frustumCulled = false; UW_RAYS.renderOrder = 4; UW_RAYS.visible = false; scene.add(UW_RAYS);
function stepUwRays() {
  const c = camera.getWorldPosition(_sw1), cell = 4.5, ci = Math.floor(c.x / cell), cj = Math.floor(c.z / cell);
  const dir = state.area === 'beach' ? _sw2.set(0, -1, .42).normalize() : _sw2.set(SUN_DIR.x * .4, SUN_DIR.y, SUN_DIR.z * .4).normalize();
  let n = 0;
  for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) {
    const gi = ci + i, gj = cj + j, x = (gi + .5 + hsh(gi, 0, gj, 1) * .7) * cell, z = (gj + .5 + hsh(gi, 0, gj, 2) * .7) * cell;
    _sw3.set(x - dir.x * 4, SW.surf - .05, z - dir.z * 4);
    _swq.setFromUnitVectors(_sw4.set(0, -1, 0), dir); _swm.compose(_sw3, _swq, _sw4.set(.45 + (hsh(gi, 1, gj, 3) + .5) * .7, 15, .45 + (hsh(gi, 1, gj, 3) + .5) * .7));
    UW_RAYS.setMatrixAt(n++, _swm);
  }
  UW_RAYS.instanceMatrix.needsUpdate = true;
}

/* ---------- bubbles + surface rings (pools, one draw call each) ---------- */
const BUB_N = 90, BUB = { im: null, p: new Float32Array(BUB_N * 3), life: new Float32Array(BUB_N), sz: new Float32Array(BUB_N), sd: new Float32Array(BUB_N), top: new Float32Array(BUB_N), next: 0 };
BUB.im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: .55, depthWrite: false }), BUB_N);
BUB.im.frustumCulled = false; BUB.im.renderOrder = 6; BUB.im.count = 0; scene.add(BUB.im);
function swBubble(p, n, spread) {
  for (let k = 0; k < n; k++) {
    const i = BUB.next; BUB.next = (BUB.next + 1) % BUB_N;
    BUB.p.set([p.x + (Math.random() - .5) * spread, p.y + (Math.random() - .5) * spread, p.z + (Math.random() - .5) * spread], i * 3);
    BUB.life[i] = 3 + Math.random() * 2; BUB.sz[i] = .006 + Math.random() * .018; BUB.sd[i] = Math.random() * 9; BUB.top[i] = SW.surf;
  }
}
const RING_N = 12, RING = { im: null, life: new Float32Array(RING_N), sz: new Float32Array(RING_N), p: new Float32Array(RING_N * 3), next: 0 };
RING.im = new THREE.InstancedMesh(new THREE.RingGeometry(.86, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), RING_N);
RING.im.frustumCulled = false; RING.im.renderOrder = 6; scene.add(RING.im);
for (let i = 0; i < RING_N; i++) { RING.im.setMatrixAt(i, _swm.makeScale(0, 0, 0)); RING.im.setColorAt(i, _swc.setRGB(0, 0, 0)); }
function swRing(p, size) { const i = RING.next; RING.next = (RING.next + 1) % RING_N; RING.p.set([p.x, p.y, p.z], i * 3); RING.life[i] = 1; RING.sz[i] = size; }
function stepBubbles(dt, t) {
  let hi = 0;
  for (let i = 0; i < BUB_N; i++) {
    if (BUB.life[i] <= 0) { _swm.makeScale(0, 0, 0); BUB.im.setMatrixAt(i, _swm); continue; }
    BUB.life[i] -= dt; const j = i * 3, s = BUB.sz[i];
    BUB.p[j + 1] += (.35 + s * 30) * dt; BUB.p[j] += Math.sin(t * 7 + BUB.sd[i]) * .12 * dt; BUB.p[j + 2] += Math.cos(t * 6 + BUB.sd[i]) * .12 * dt;
    if (BUB.p[j + 1] > BUB.top[i] - .01) BUB.life[i] = 0;   // pop at the surface
    const w = 1 + Math.sin(t * 14 + BUB.sd[i]) * .15;
    _swm.makeScale(s * w, s / w, s * w).setPosition(BUB.p[j], BUB.p[j + 1], BUB.p[j + 2]); BUB.im.setMatrixAt(i, _swm); hi = i + 1;
  }
  BUB.im.count = hi; BUB.im.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < RING_N; i++) {
    if (RING.life[i] <= 0) { RING.im.setColorAt(i, _swc.setRGB(0, 0, 0)); continue; }
    RING.life[i] -= dt * .8; const l = Math.max(0, RING.life[i]), s = RING.sz[i] * (.3 + (1 - l) * 1.4), j = i * 3;
    _swm.makeScale(s, 1, s).setPosition(RING.p[j], RING.p[j + 1], RING.p[j + 2]); RING.im.setMatrixAt(i, _swm); RING.im.setColorAt(i, _swc.setRGB(l * .55, l * .6, l * .6));
  }
  RING.im.instanceMatrix.needsUpdate = true; RING.im.instanceColor.needsUpdate = true;
}

/* ---------- caustics dancing on the beach sea floor ---------- */
{
  const sand = BG.children.find(o => o.isMesh && o.material && o.material.isMeshLambertMaterial && o.material.vertexColors);
  if (sand) {
    const m = sand.material;
    m.onBeforeCompile = sh => {
      sh.uniforms.uSwT = SW_U.t;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSwW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSwW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vSwW; uniform float uSwT;
float swCaus(vec2 p){ float t = uSwT*.6; vec2 q = p*.9 + vec2(sin(p.y*1.2+t), cos(p.x*1.05-t*.8))*.55;
  float v = sin(q.x*2.1+t)*sin(q.y*2.3-t*1.1) + sin((q.x+q.y)*1.7+t*1.3)*.6; return pow(max(1. - abs(v), 0.), 7.); }`)
        .replace('#include <tonemapping_fragment>', `{ float dd = clamp(${BEACH.y.toFixed(2)} - vSwW.y, 0., 9.); float kk = smoothstep(.05, .5, dd) * (1. - dd/11.);
  if (kk > 0.) gl_FragColor.rgb += vec3(1., .93, .78) * swCaus(vSwW.xz) * kk * .32; }
#include <tonemapping_fragment>`);
    };
    m.needsUpdate = true;
  }
}

/* ---------- life under the beach sea ---------- */
const SG = new THREE.Group(); BG.add(SG);   // still decor, merged by material
const sfloor = (x, z) => beachH(x, z);
{
  const rnd2 = (i, k) => hsh(i, k, 7, 3) + .5;
  const CORAL = [0xff6f91, 0xff9a4d, 0xb07cff, 0xffd24d, 0x4fd6c8, 0xff5a5a].map(c => mat(c, { roughness: .8 }));
  const rock = mat(0x6f7a80), wood = mat(0x6b4a30), woodD = mat(0x4f3622), starM = [mat(0xff7a3d), mat(0xe8455a), mat(0xffb03d)];
  for (let i = 0; i < 34; i++) {
    const x = (rnd2(i, 1) * 2 - 1) * 42, z = -11 - rnd2(i, 2) * 42; if (Math.abs(x - 18) < 2.2 && z > -27) continue;   // not on the pier posts
    const y = sfloor(x, z), M = CORAL[i % CORAL.length], k = i % 4, g = new THREE.Group(); g.position.set(x, y - .05, z); g.rotation.y = rnd2(i, 3) * 6; SG.add(g);
    const s = .6 + rnd2(i, 4) * .9; g.scale.setScalar(s);
    if (k === 0) for (let b = 0; b < 6; b++) { const a = b / 6 * 6.28, c = part(new THREE.CylinderGeometry(.035, .06, .7, 6), M, Math.cos(a) * .12, .3, Math.sin(a) * .12, g); c.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5);
      part(new THREE.SphereGeometry(.06, 8, 6), M, Math.cos(a) * .3, .62, Math.sin(a) * .3, g); }
    else if (k === 1) { const b = part(new THREE.SphereGeometry(.4, 14, 8, 0, 6.29, 0, 1.6), M, 0, 0, 0, g); b.scale.y = .7; }
    else if (k === 2) { const f = part(new THREE.CircleGeometry(.5, 14), M, 0, .5, 0, g); f.scale.y = 1.2; part(new THREE.CylinderGeometry(.03, .04, .2, 5), M, 0, .1, 0, g); }
    else for (let b = 0; b < 3; b++) part(new THREE.CylinderGeometry(.08, .1, .4 + b * .25, 8, 1, true), M, (b - 1) * .13, .2 + b * .12, (b % 2) * .1, g);
  }
  CORAL.forEach(m => { m.side = THREE.DoubleSide; });
  for (let i = 0; i < 22; i++) {   // rocks
    const x = (rnd2(i, 5) * 2 - 1) * 44, z = -10 - rnd2(i, 6) * 44, s = .4 + rnd2(i, 7) * 1.3;
    const r = part(new THREE.DodecahedronGeometry(s, 0), rock, x, sfloor(x, z) + s * .2, z, SG); r.scale.set(1, .55 + rnd2(i, 8) * .3, 1.2); r.rotation.y = i;
  }
  const star = new THREE.Shape(); for (let p = 0; p <= 10; p++) { const a = p / 10 * 6.283 + Math.PI / 2, rr = p % 2 ? .05 : .13; p ? star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const starG = new THREE.ExtrudeGeometry(star, { depth: .025, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1 }).rotateX(-Math.PI / 2);
  for (let i = 0; i < 16; i++) { const x = (rnd2(i, 9) * 2 - 1) * 40, z = -9 - rnd2(i, 10) * 40, s = .8 + rnd2(i, 11) * .8; const m = part(starG, starM[i % 3], x, sfloor(x, z) + .01, z, SG); m.scale.setScalar(s); m.rotation.y = i * 1.3; }
  // a sunken rowboat
  const boat = new THREE.Group(); boat.position.set(7, sfloor(7, -34) + .25, -34); boat.rotation.set(.15, .7, .35); SG.add(boat);
  const hull = part(new THREE.CylinderGeometry(.75, .75, 3.2, 12, 1, true, Math.PI / 2, Math.PI), wood, 0, 0, 0, boat); hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, .7);
  for (let b = -1; b <= 1; b++) part(new THREE.BoxGeometry(1.4, .06, .22), woodD, 0, .02, b * .9, boat);
  const oar = part(new THREE.BoxGeometry(.06, .05, 1.9), woodD, 1.2, -.2, .3, boat); oar.rotation.y = .5;
  wood.side = THREE.DoubleSide;
}
mergeStatic(SG);
// seaweed that sways (instanced, the sway is in the shader)
const WEED = (() => {
  const n = 90, g = new THREE.PlaneGeometry(.14, 1, 1, 7).translate(0, .5, 0);
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.uniforms.uSwT = SW_U.t; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSwT;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat hh = position.y; float ii = float(gl_InstanceID); transformed.x += sin(uSwT*1.3 + ii*.9 + hh*2.) * hh*hh*.3; transformed.z += cos(uSwT*1.05 + ii*1.3) * hh*hh*.22; transformed.x *= 1. - hh*.5;'); };
  const im = new THREE.InstancedMesh(g, m, n); let k = 0;
  for (let i = 0; i < n; i++) {
    const cx = (hsh(i, 2, 3, 4)) * 84, cz = -12 - (hsh(i, 5, 6, 7) + .5) * 40; if (Math.abs(cx - 18) < 1.6 && cz > -27) continue;
    for (let b = 0; b < 3 && k < n; b++, i++) {
      const x = cx + hsh(i, 1, b, 9) * .7, z = cz + hsh(i, 2, b, 9) * .7, h = 1 + (hsh(i, 3, b, 9) + .5) * 2;
      _swo.position.set(x, sfloor(x, z) - .05, z); _swo.rotation.set(0, (hsh(i, 4, b, 9) + .5) * 6, 0); _swo.scale.set(1, h, 1); _swo.updateMatrix(); im.setMatrixAt(k, _swo.matrix);
      im.setColorAt(k, _swc.setHSL(.27 + hsh(i, 5, b, 9) * .1, .6, .28 + (hsh(i, 6, b, 9) + .5) * .15)); k++;
    }
  }
  im.count = k; im.frustumCulled = false; BG.add(im); return im;
})();
// two fish schools: they circle, wag their tails and scatter when you swim close
const FISH = (() => {
  const body = new THREE.SphereGeometry(1, 10, 8).scale(.045, .075, .15), tail = new THREE.ConeGeometry(.07, .12, 4).rotateX(Math.PI / 2).scale(.25, 1, 1).translate(0, 0, -.2);
  const fin = new THREE.ConeGeometry(.04, .08, 3).scale(.2, 1, 1).translate(0, .09, -.02);
  const strip = g => { const n = g.index ? g.toNonIndexed() : g; const o = new THREE.BufferGeometry(); o.setAttribute('position', n.attributes.position); o.setAttribute('normal', n.attributes.normal); return o; };
  const geo = mergeGeometries([strip(body), strip(tail), strip(fin)]);
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = sh => { sh.uniforms.uSwT = SW_U.t; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSwT;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat ii = float(gl_InstanceID); float bk = max(0., -position.z + .02); transformed.x += sin(uSwT*13. + ii*1.7 - position.z*9.) * bk * .55;'); };
  const schools = [{ c: V(4, 0, -26), y: -2.2, n: 18, r: 2.6, sp: .55, cols: [0xff9a2e, 0xffd24d, 0xff7a3d] }, { c: V(-16, 0, -40), y: -3.5, n: 14, r: 3.2, sp: -.42, cols: [0x3fb2ff, 0x4fd6c8, 0x8b6bff] }];
  const fish = []; schools.forEach((S, si) => { for (let i = 0; i < S.n; i++) fish.push({ S, a: i / S.n * 6.28 + Math.random(), r: S.r * (.6 + Math.random() * .7), h: (Math.random() - .5) * 1.2, ph: Math.random() * 6, p: V(), push: V(), si }); });
  const im = new THREE.InstancedMesh(geo, m, fish.length);
  fish.forEach((f, i) => { const cs = f.S.cols; im.setColorAt(i, _swc.set(cs[i % cs.length])); });
  im.frustumCulled = false; BG.add(im); return { im, fish, schools };
})();
function stepFish(dt, t, hx, hy, hz) {
  for (const S of FISH.schools) { S.c.x += Math.sin(t * .05 + S.y) * .1 * dt; }   // the school wanders a bit
  FISH.fish.forEach((f, i) => {
    const S = f.S; f.a += S.sp * dt * (1 + f.push.length() * .6);
    _sw3.set(S.c.x + Math.cos(f.a) * f.r, S.y + f.h + Math.sin(f.a * 2 + f.ph) * .25, S.c.z + Math.sin(f.a) * f.r);
    _sw4.set(_sw3.x - hx, _sw3.y - hy, _sw3.z - hz); const d = _sw4.length();
    if (d < 2.2) f.push.addScaledVector(_sw4.normalize(), (2.2 - d) * 4 * dt);   // eek, a Thumpling!
    f.push.multiplyScalar(Math.exp(-dt * .7)); _sw3.add(f.push);
    _sw3.y = Math.max(_sw3.y, sfloor(_sw3.x, _sw3.z) + .2); _sw3.y = Math.min(_sw3.y, -.25);
    _swo.position.copy(_sw3); _sw4.subVectors(_sw3, f.p); f.p.copy(_sw3);
    if (_sw4.lengthSq() > 1e-8) _swo.lookAt(_sw3.x + _sw4.x, _sw3.y + _sw4.y, _sw3.z + _sw4.z);
    _swo.scale.setScalar(1); _swo.updateMatrix(); FISH.im.setMatrixAt(i, _swo.matrix);
  });
  FISH.im.instanceMatrix.needsUpdate = true;
}
// a giant clam that slowly opens and closes (something shiny inside)
const CLAM = (() => {
  const x = -30, z = -44, g = new THREE.Group(); g.position.set(x, sfloor(x, z) + .05, z); g.rotation.y = .6; BG.add(g);
  const sh = mat(0xb9a7d6, { roughness: .6 }), inn = mat(0xffd9e6, { flatShading: false, roughness: .4 });
  const lo = part(new THREE.SphereGeometry(.7, 16, 8, 0, 6.29, Math.PI / 2, Math.PI / 2), sh, 0, .08, 0, g); lo.scale.y = .45;
  part(new THREE.CircleGeometry(.66, 20).rotateX(-Math.PI / 2), inn, 0, .09, 0, g);
  const hinge = new THREE.Object3D(); hinge.position.set(0, .1, -.62); g.add(hinge);
  const up = part(new THREE.SphereGeometry(.7, 16, 8, 0, 6.29, 0, Math.PI / 2), sh, 0, 0, .62, hinge); up.scale.y = .45;
  for (let r = 0; r < 7; r++) { const ridge = part(new THREE.BoxGeometry(.05, .03, 1.3), sh, (r - 3) * .17, .3 - Math.abs(r - 3) * .03, .62, hinge); ridge.rotation.z = (r - 3) * .1; }
  const pearl = part(new THREE.SphereGeometry(.13, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfff6ee, roughness: .08, metalness: .25, envMap: ENV, emissive: 0x332a38 }), 0, .22, 0, g);
  if (SW.found.has('pearl')) pearl.visible = false;
  return { g, hinge, pearl };
})();
// a sunken treasure chest, half buried
const CHEST2 = (() => {
  const x = 27, z = -42, g = new THREE.Group(); g.position.set(x, sfloor(x, z) - .08, z); g.rotation.set(.12, -.5, .08); BG.add(g);
  const wood = mat(0x7a4f2a), band = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: .9, roughness: .35, envMap: ENV });
  part(new THREE.BoxGeometry(.9, .5, .6), wood, 0, .25, 0, g);
  [-.32, .32].forEach(bx => part(new THREE.BoxGeometry(.07, .52, .62), band, bx, .25, 0, g));
  const lid = new THREE.Object3D(); lid.position.set(0, .5, -.3); g.add(lid);
  const top = part(new THREE.CylinderGeometry(.3, .3, .9, 12, 1, false, 0, Math.PI), wood, 0, 0, .3, lid); top.rotation.z = Math.PI / 2;
  [-.32, .32].forEach(bx => { const b = part(new THREE.CylinderGeometry(.31, .31, .07, 12, 1, false, 0, Math.PI), band, bx, 0, .3, lid); b.rotation.z = Math.PI / 2; });
  part(new THREE.BoxGeometry(.12, .14, .05), band, 0, .42, .31, g);
  const gold = part(new THREE.SphereGeometry(.26, 12, 6, 0, 6.29, 0, 1.2), new THREE.MeshStandardMaterial({ color: 0xffcc33, metalness: 1, roughness: .25, envMap: ENV, emissive: 0x553300 }), 0, .32, 0, g); gold.scale.set(1.4, .5, 1);
  return { g, lid, open: 0 };
})();

/* ---------- per frame (end of update) ---------- */
let _swLastArea = '';
function stepSwim(dt) {
  const t = tAll; SW_U.t.value = t;
  if (state.mode !== 'play' && (SW.on || SW.under)) { if (SW.under) swimUnder(false); SW.on = false; }
  // sunrays: daytime only
  const day = !HZ.on;
  SUNRAY.grove.visible = SUNRAY.gold.visible = SUNRAY.gpud.visible = SUNRAY.gmotes.visible = day && state.area === 'grove';
  SUNRAY.elder.visible = SUNRAY.epud.visible = SUNRAY.emotes.visible = day && state.area === 'wilds';
  SUNRAY.fan.visible = day; SUNRAY.fan.rotation.z = Math.sin(t * .05) * .035;
  if (state.area !== _swLastArea) { _swLastArea = state.area; if (SW.under && SW.save) swimUnder(false); }
  // the golden sunbeam: stand in it for a while...
  if (state.mode === 'play' && state.area === 'grove' && day) {
    headWorld(_sw1); const S = GOLD_SHAFT, u = (_sw1.y - S.gp.y) / -S.dir.y;
    _sw2.copy(S.gp).addScaledVector(S.dir, -u);
    if (Math.hypot(_sw1.x - _sw2.x, _sw1.z - _sw2.z) < .75) {
      SW.beamT += dt; if (SW.beamT > .5 && Math.random() < dt * 6) confetti(_sw1.clone().add(V(0, .25, 0)), 2, [0xffe07a, 0xffc640, 0xffffff]);
      if (SW.beamT > 4 && swSecret('sunbeam', '☀️ SECRET! You soaked up the GOLDEN SUNBEAM. You are now 100% solar powered ✨😎')) SW.sparkle = 25;
    } else SW.beamT = 0;
  }
  if (SW.sparkle > 0) { SW.sparkle -= dt; if (Math.random() < dt * 5) hands.forEach(h => { if (h.paw.visible) confetti(h.pos.clone(), 1, [0xffe07a, 0xffffff]); }); }
  // swimming extras
  if (SW.on) {
    headWorld(_sw1);
    if (SW.under) {
      CEIL.position.set(_sw1.x, SW.surf - .01, _sw1.z);
      stepUwRays();
      if ((SW.bubT -= dt) < 0) { SW.bubT = 1.4 + Math.random() * 1.6; _sw4.set(0, -.07, -.12); camera.localToWorld(_sw4); swBubble(_sw4, 4 + (Math.random() * 4 | 0), .04); if (ac) tone('sine', 420 + Math.random() * 300, 950, .07, .025); }
    } else if ((SW.ringT -= dt) < 0) { SW.ringT = 2.2; _sw4.set(_sw1.x, SW.surf + .03, _sw1.z); swRing(_sw4, .55); }   // little rings while you float
    // PC / phone: paws do a breaststroke
    if (!state.xr && !sim.on) {
      const moving = Math.hypot(state.vel.x, state.vel.z) > .4 || Math.abs(state.vel.y) > .6, ph = t * (moving ? 10.1 : 3), sw = Math.sin(ph), out = Math.max(0, sw);
      hands.forEach((h, i) => {
        const sd = i ? 1 : -1;
        if (state.third) { h.pos.set(sd * (.18 + out * .3) * avSc(), .3 * avSc() + Math.cos(ph) * .05, -.35 - (1 - out) * .25 * (moving ? 1 : .3)).applyQuaternion(rig.quaternion).add(rig.position); }
        else camera.localToWorld(h.pos.set(sd * (.1 + out * .26), -.18 + Math.cos(ph) * .04, -.48 + out * .18 * (moving ? 1 : .3)));
        h.paw.position.copy(h.pos);
      });
    }
  }
  stepBubbles(dt, t);
  if (state.area === 'beach') {
    headWorld(_sw1);
    const hx = _sw1.x - BEACH.x, hy = _sw1.y - BEACH.y, hz = _sw1.z - BEACH.z;
    if (hz < -6) stepFish(dt, t, hx, hy, hz);
    // the clam breathes; the pearl
    const op = Math.max(0, Math.sin(t * .45)); CLAM.hinge.rotation.x = -op * .75; CLAM.pearl.material.emissiveIntensity = .6 + Math.sin(t * 2) * .4;
    if (CLAM.pearl.visible) {
      CLAM.pearl.getWorldPosition(_sw2);
      if (_sw1.distanceTo(_sw2) < 1.1 || hands.some(h => h.tracked && h.pos.distanceTo(_sw2) < .3)) {
        if (swSecret('pearl', '🦪 SECRET! The GIANT PEARL! The clam says "finders keepers" (rude) 💎')) { CLAM.pearl.visible = false; swBubble(_sw2, 20, .3); }
      }
    }
    if (CHEST2.open < 1) {
      CHEST2.g.getWorldPosition(_sw2); _sw2.y += .4;
      if (CHEST2.open > 0 || _sw1.distanceTo(_sw2) < 1.3 || hands.some(h => h.tracked && h.pos.distanceTo(_sw2) < .45)) {
        if (CHEST2.open === 0) { swSecret('chest', '🏴‍☠️ SECRET! SUNKEN TREASURE! You are now a pirate. Say "arrr" 🪙'); confetti(_sw2, 50, [0xffcc33, 0xffe07a, 0xfff2b0]); swBubble(_sw2, 24, .5); }
        CHEST2.open = Math.min(1, CHEST2.open + dt * 1.5); CHEST2.lid.rotation.x = -CHEST2.open * 1.9;
      }
    }
  }
}

window.__kg.swim = { SW, waterAt, swimCheck, swimToggle, swimUnder, SUNRAY, GOLD_SHAFT, FISH, CLAM, CHEST2, UW_RAYS, CEIL, BUB, beachH };
