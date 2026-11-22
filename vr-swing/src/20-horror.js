/* ======================================================================
   HORROR MODE (secret): a little switch hidden deep in one tree's leaves turns the grove to a foggy night.
   Then: a flashlight, creepy sounds, a mirror that stares back, things at the edge of your eye, words that
   flash and vanish, and (very rarely) a black figure that T-poses... and you should NOT hit it.
   ====================================================================== */
const HZ = { on: false, phase: 'none', pt: 0, speed: 0, rollT: 0, textT: 22, textOn: 0, stare: 0, vanish: 0, wasLook: false,
  peekCool: 10, peekT: -1, yawHist: [], crash: 0, flipCool: 0, swIn: false, pipPrev: 0, ghostT: 0, red: 0, slam: 0, amb: null, ambT: 6, scream: null, fadeIn: 0 };
const HZ_GROUND = 0;
const hemi = scene.children.find(o => o.isHemisphereLight);
const skyU = scene.userData.sky.material.uniforms;
const DAY = { bg: scene.background.clone(), fog: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far, hemi: hemi.intensity,
  hc: hemi.color.clone(), hg: hemi.groundColor.clone(), sun: sun.intensity, top: skyU.top.value.clone(), bot: skyU.bot.value.clone() };

// the flashlight lives on your head the whole time (switched off by day), so turning horror on never stalls to rebuild shaders
const torch = new THREE.SpotLight(0xfff0cf, 0, 24, .52, .6, 1.2);
torch.position.set(0, -.04, 0); torch.target.position.set(0, -.12, -1); camera.add(torch, torch.target);
const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
moon.position.set(-70, 95, -110); moon.visible = false; scene.userData.sky.add(moon);

/* ---------- the switch, tucked inside the leaves ---------- */
const SWITCH_AT = V(3.3, .75, 18.07);   // tucked away on the back of the climbing wall
const lever = new THREE.Group();
const swG = (() => {
  const g = new THREE.Group(); g.position.copy(SWITCH_AT); g.rotation.y = 0; scene.add(g);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.15, .21, .035), mat(0x3a2a1c)); g.add(plate);
  [-1, 1].forEach(s => { const sc = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .01, 6), mat(0x9a9a9a, { metalness: .6 })); sc.rotation.x = Math.PI / 2; sc.position.set(0, s * .085, .02); g.add(sc); });
  const slot = new THREE.Mesh(new THREE.BoxGeometry(.025, .1, .01), new THREE.MeshBasicMaterial({ color: 0x050505 })); slot.position.z = .019; g.add(slot);
  lever.position.z = .02; g.add(lever);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.01, .012, .11, 8), mat(0xb8b8b8, { metalness: .7, roughness: .4, flatShading: false })); stick.position.y = .055; lever.add(stick);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.026, 12, 9), mat(0xd0302a, { emissive: 0x801010, emissiveIntensity: .6, flatShading: false })); knob.position.y = .115; lever.add(knob);
  lever.rotation.x = .25;
  return g;
})();

/* ---------- a black human figure, built from real body parts so it reads as a person, not a stack of boxes ---------- */
const SHADE = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });   // pure black even deep in the fog, so it shows as a silhouette
function shCap(r, len, along = 'y') { const g = new THREE.CapsuleGeometry(r, len, 4, 10); if (along === 'x') g.rotateZ(Math.PI / 2); return new THREE.Mesh(g, SHADE); }
function makeShade() {
  const g = new THREE.Group(), P = {};
  const hips = new THREE.Group(); hips.position.y = 1.0; g.add(hips); P.hips = hips;
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), SHADE); pelvis.scale.set(1.05, .8, .7); hips.add(pelvis);
  const torso = new THREE.Group(); hips.add(torso); P.torso = torso;
  const chestG = new THREE.LatheGeometry([[.001, 0], [.13, .02], [.125, .14], [.15, .3], [.17, .42], [.15, .5], [.06, .55], [.001, .56]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  const chest = new THREE.Mesh(chestG, SHADE); chest.scale.z = .62; torso.add(chest);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.042, .05, .12, 10), SHADE); neck.position.y = .6; torso.add(neck);
  const head = new THREE.Group(); head.position.y = .64; torso.add(head); P.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.105, 16, 12), SHADE); skull.position.y = .12; skull.scale.set(.92, 1.18, 1.02); head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), SHADE); jaw.position.set(0, .05, .03); jaw.scale.set(1, .8, 1); head.add(jaw);
  P.arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * .19, .47, 0); torso.add(sh);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.058, 10, 8), SHADE); sh.add(ball);
    const up = shCap(.048, .25, 'x'); up.position.x = s * .17; sh.add(up);
    const el = new THREE.Group(); el.position.x = s * .34; sh.add(el);
    const fo = shCap(.04, .25, 'x'); fo.position.x = s * .15; el.add(fo);
    const hand = new THREE.Group(); hand.position.x = s * .31; el.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(.08, .025, .07), SHADE); palm.position.x = s * .035; hand.add(palm);
    for (let f = 0; f < 4; f++) { const fi = shCap(.009, .07, 'x'); fi.position.set(s * .11, 0, -.026 + f * .017); hand.add(fi); }
    const th = shCap(.01, .04); th.position.set(s * .03, 0, .04); th.rotation.x = 1.2; hand.add(th);
    return { sh, el, hand, s };
  });
  P.legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s * .1, -.02, 0); hips.add(hip);
    const th = shCap(.072, .34); th.position.y = -.23; hip.add(th);
    const kn = new THREE.Group(); kn.position.y = -.46; hip.add(kn);
    const sh = shCap(.055, .34); sh.position.y = -.21; kn.add(sh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.09, .06, .23), SHADE); foot.position.set(0, -.46, .05); kn.add(foot);
    return { hip, kn, s };
  });
  g.visible = false; scene.add(g);
  return { g, P };
}
const fig = makeShade();
const peek = makeShade(); peek.g.scale.setScalar(.9);
function tPose(F) {
  F.P.hips.rotation.set(0, 0, 0); F.P.torso.rotation.set(0, 0, 0); F.P.head.rotation.set(0, 0, 0); F.g.rotation.x = F.g.rotation.z = 0;
  F.P.arms.forEach(a => { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); a.hand.rotation.set(0, 0, 0); });
  F.P.legs.forEach(l => { l.hip.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); });
}
const jr = () => rnd() * 2 - 1;
function spazz(F, k, run, t) {
  const P = F.P;
  P.head.rotation.set(jr() * .9 * k, jr() * 1.1 * k, jr() * 1.3 * k);
  P.torso.rotation.set(jr() * .35 * k + (run ? .25 : 0), jr() * .4 * k, jr() * .35 * k);
  P.arms.forEach(a => { a.sh.rotation.set(jr() * 1.2 * k, jr() * .9 * k, jr() * 1.1 * k); a.el.rotation.set(jr() * k, jr() * 1.4 * k, jr() * .8 * k); a.hand.rotation.set(jr() * 1.5 * k, 0, jr() * 1.5 * k); });
  P.legs.forEach((l, i) => {
    const cyc = run ? Math.sin(t * run + i * Math.PI) : 0;   // a flailing run on top of the twitching
    l.hip.rotation.set(cyc * .9 + jr() * .5 * k, jr() * .2 * k, jr() * .25 * k); l.kn.rotation.x = Math.max(0, -cyc) * 1.3 + rnd() * .6 * k;
  });
  F.g.rotation.z = jr() * .12 * k;
}

/* ---------- screen effects on your face: a red multiply, a red glow, glitch static, and words ---------- */
const QUAD = new THREE.PlaneGeometry(2.4, 2.4);
const fullQuad = (m, order) => { const q = new THREE.Mesh(QUAD, m); q.position.z = -.25; q.renderOrder = order; q.frustumCulled = false; q.visible = false; camera.add(q); return q; };
const qv = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
const redMul = fullQuad(new THREE.ShaderMaterial({ uniforms: { k: { value: 0 } }, vertexShader: qv, depthTest: false, depthWrite: false, transparent: true,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
  fragmentShader: 'uniform float k; void main(){ gl_FragColor = vec4(mix(vec3(1.), vec3(1.25, .05, .04), k), 1.); }' }), 30);
const redAdd = fullQuad(new THREE.ShaderMaterial({ uniforms: { k: { value: 0 } }, vertexShader: qv, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
  fragmentShader: 'uniform float k; varying vec2 vUv; void main(){ float v = length(vUv - .5); gl_FragColor = vec4(vec3(.5, 0., 0.) * k * (.6 + v), 1.); }' }), 31);
const fxMat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, stat: { value: 0 }, black: { value: 0 } }, vertexShader: qv, depthTest: false, depthWrite: false, transparent: true,
  fragmentShader: `uniform float t, stat, black; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    float row = floor(vUv.y * 70.), ft = floor(t * 24.);
    float bar = step(.82, h(vec2(row, ft)));
    float n = h(floor(vUv * vec2(360., 260.)) + ft * 7.13);
    vec3 c = vec3(n);
    c = mix(c, vec3(h(vec2(row, ft + 1.)), h(vec2(row + 3., ft)), h(vec2(row + 7., ft))), bar * .85);
    c *= .75 + .25 * sin(vUv.y * 900. + t * 40.);
    float a = clamp(stat * (.55 + .45 * bar) + stat * stat, 0., 1.);
    gl_FragColor = vec4(mix(c, vec3(0.), black), max(a, black));
  }` });
const fxQ = fullQuad(fxMat, 32);
const words = textPanel(1024, 320, () => {});
const wordsMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .375), new THREE.MeshBasicMaterial({ map: words.t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
wordsMesh.renderOrder = 33; wordsMesh.visible = false; wordsMesh.position.set(0, .05, -1.25); camera.add(wordsMesh);
const CREEPY = ['BEHIND YOU', 'IT SEES YOU', "DON'T TURN AROUND", 'YOU ARE NOT ALONE', 'LEAVE', 'HE IS AWAKE', 'CLOSER', 'WHY ARE YOU HERE', 'LOOK UP', 'TOO LATE', 'STAY'];
function drawWords(msg) {
  const g = words.g; g.clearRect(0, 0, 1024, 320); g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 140; do { g.font = `${fs}px "Lilita One", Impact, sans-serif`; fs -= 8; } while (fs > 40 && g.measureText(msg).width > 940);   // always fits
  for (let i = 0; i < 4; i++) { g.fillStyle = i < 3 ? `rgba(${i ? 255 : 0},${i === 2 ? 255 : 0},${i === 1 ? 0 : 255},.35)` : '#e11'; g.fillText(msg, 512 + (i < 3 ? jr() * 9 : 0), 165 + (i < 3 ? jr() * 6 : 0)); }
  words.t.needsUpdate = true;
}
function flashWords(msg) {
  drawWords(msg); wordsMesh.visible = true;
  HZ.textOn = Math.max(1.3, msg.split(' ').length / 2.3 + .9);   // long enough to read (138 words a minute) and no longer
  wordsMesh.position.set(jr() * .25, .05 + jr() * .18, -1.25); wordsMesh.rotation.z = jr() * .08;
  if (ac) { tone('sawtooth', 70, 40, .35, .08); const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime; f.type = 'highpass'; f.frequency.value = 2500; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + .3); }
}
function drawCrashBox() {
  const g = words.g; g.clearRect(0, 0, 1024, 320);
  g.fillStyle = '#2b2b30'; g.beginPath(); g.roundRect(40, 10, 944, 300, 28); g.fill(); g.strokeStyle = '#55555d'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '600 50px system-ui, sans-serif'; g.fillText('Knuckle Grove isn’t responding', 90, 100);
  g.fillStyle = '#c8c8d0'; g.font = '36px system-ui, sans-serif'; g.fillText('The app stopped working. Close it, or wait?', 90, 160);
  [['Wait', 520], ['Close app', 740]].forEach(([s, x]) => { g.fillStyle = '#3d6fe0'; g.beginPath(); g.roundRect(x, 205, 200, 74, 37); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '600 34px system-ui, sans-serif'; g.fillText(s, x + 100, 254); g.textAlign = 'left'; });
  words.t.needsUpdate = true;
}

/* ---------- the mirror stares back ---------- */
const mirScreen = selfie.g.children[0], mirDay = mirScreen.material;
const mirNight = new THREE.ShaderMaterial({ uniforms: { map: { value: mirDay.map }, amt: { value: 0 }, t: { value: 0 } }, vertexShader: qv, toneMapped: false,
  fragmentShader: `uniform sampler2D map; uniform float amt, t; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 c = vec2(.5, .6), uv = vUv; float d = length((uv - c) * vec2(1., 1.35));
    float w = amt * smoothstep(.5, 0., d);
    uv += vec2(sin(uv.y * 19. + t * 3.1), cos(uv.x * 15. - t * 2.4)) * .04 * w;
    float a = w * 2.2 * sin(t * .9); vec2 r = uv - c; uv = c + mat2(cos(a), -sin(a), sin(a), cos(a)) * r * (1. - .3 * w);
    float row = floor(uv.y * 40.); uv.x += (h(vec2(row, floor(t * 12.))) - .5) * .1 * amt * step(.75, h(vec2(row * 1.7, floor(t * 7.))));
    vec3 col = vec3(texture2D(map, uv + vec2(.015 * amt, 0.)).r, texture2D(map, uv).g, texture2D(map, uv - vec2(.015 * amt, 0.)).b);
    col = mix(col, vec3(dot(col, vec3(.3, .59, .11))) * vec3(1., .3, .26), amt * .75);
    col *= 1. - amt * .6 * smoothstep(.2, .8, d);
    gl_FragColor = vec4(col, 1.);
    #include <colorspace_fragment>
  }` });

/* ---------- secret #5 lives on Pip ---------- */
const ghost = (() => {
  const pts = [[.001, .74], [.12, .72], [.24, .64], [.31, .48], [.33, .25], [.34, .02]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 20, 0, Math.PI * 2); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < .03) p.setY(i, p.getY(i) + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 7) * .035);   // wavy hem
  geo.computeVertexNormals();
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat(0xf4f4ff, { flatShading: false, side: THREE.DoubleSide, roughness: .7 })));
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0x111111 })); e.position.set(s * .1, .46, .29); e.scale.set(1, 1.5, .4); g.add(e); });
  const m = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), new THREE.MeshBasicMaterial({ color: 0x111111 })); m.position.set(0, .33, .31); m.scale.set(1, 1.3, .4); g.add(m);
  g.visible = false; pip.body.add(g); return g;
})();

/* ---------- sound: all made up on the spot, nothing borrowed ---------- */
let loopNoise = null;
function noiseLoop() { if (!loopNoise) { loopNoise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = loopNoise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ac.createBufferSource(); s.buffer = loopNoise; s.loop = true; return s; }
function startAmb() {
  if (!ac || HZ.amb) return; const t = ac.currentTime, out = ac.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.5, t + 4); out.connect(master);
  const nodes = [];
  [[49, .16], [49.7, .16], [73.4, .05], [98.6, .03]].forEach(([f, v]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = f > 70 ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.value = v; o.connect(g); g.connect(out); o.start(t); nodes.push(o); });
  const wn = noiseLoop(), lp = ac.createBiquadFilter(), wg = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 3; wg.gain.value = .14; lfo.frequency.value = .09; lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency);
  wn.connect(lp); lp.connect(wg); wg.connect(out); wn.start(t); lfo.start(t); nodes.push(wn, lfo);
  HZ.amb = { out, nodes };
}
function stopAmb(fast) {
  const a = HZ.amb; if (!a || !ac) return; HZ.amb = null; const t = ac.currentTime;
  a.out.gain.cancelScheduledValues(t); a.out.gain.setValueAtTime(a.out.gain.value, t); a.out.gain.linearRampToValueAtTime(0, t + (fast ? .02 : 1.2));
  a.nodes.forEach(n => n.stop(t + (fast ? .05 : 1.3)));
}
const pan = (node, x) => { if (!ac.createStereoPanner) return node; const p = ac.createStereoPanner(); p.pan.value = x; node.connect(p); return p; };
function creepySound() {
  if (!ac) return; const t = ac.currentTime, kind = Math.floor(rnd() * 4), side = jr();
  if (kind === 0) { for (let i = 0; i < 3; i++) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(95, t + i * .38); o.frequency.exponentialRampToValueAtTime(45, t + i * .38 + .2); g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(.45, t + i * .38); g.gain.exponentialRampToValueAtTime(.001, t + i * .38 + .25); o.connect(g); pan(g, side).connect(master); o.start(t); o.stop(t + 1.4); } }   // knock knock knock
  else if (kind === 1) {   // whispers
    const n = noiseLoop(), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = 'bandpass'; bp.Q.value = 6;
    for (let i = 0; i < 6; i++) { const k = t + i * .28; bp.frequency.setValueAtTime(900 + rnd() * 2400, k); g.gain.setValueAtTime(0, k); g.gain.linearRampToValueAtTime(.22 * rnd() + .06, k + .1); g.gain.linearRampToValueAtTime(0, k + .26); }
    n.connect(bp); bp.connect(g); pan(g, side).connect(master); n.start(t); n.stop(t + 1.8);
  } else if (kind === 2) {   // a long creak
    const o = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(38, t); o.frequency.linearRampToValueAtTime(24 + rnd() * 20, t + 1.4);
    bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 9; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .3); g.gain.linearRampToValueAtTime(0, t + 1.5);
    o.connect(bp); bp.connect(g); pan(g, side).connect(master); o.start(t); o.stop(t + 1.6);
  } else {   // an out-of-tune music box, far away
    const b = 880 + rnd() * 200; [0, 3, 1, 6].forEach((s, i) => tone('sine', b * Math.pow(2, s / 12) * (1 + jr() * .02), b * Math.pow(2, s / 12) * .97, .9, .05, i * .45));
  }
}
function startScream() {
  if (!ac) return; stopScream(); const t = ac.currentTime;
  // SLAM
  tone('sine', 140, 28, 1.1, 1); const nb = noise(), ng = ac.createGain(); ng.gain.setValueAtTime(.9, t); ng.gain.exponentialRampToValueAtTime(.001, t + .3); nb.connect(ng); ng.connect(master); nb.start(t); nb.stop(t + .3);
  // a wall of distorted, pulsing noise that does not stop
  const out = ac.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.42, t + .06); out.connect(master);
  const sh = ac.createWaveShaper(), curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 9); } sh.curve = curve;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
  const pulse = ac.createGain(); pulse.gain.value = .6; const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.type = 'square'; lfo.frequency.value = 7.5; lg.gain.value = .4; lfo.connect(lg); lg.connect(pulse.gain);
  sh.connect(lp); lp.connect(pulse); pulse.connect(out);
  const nodes = [lfo];
  [[92, 'sawtooth'], [97.6, 'sawtooth'], [138.5, 'square'], [185.2, 'sawtooth'], [61, 'square']].forEach(([f, ty]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = ty; o.frequency.value = f; g.gain.value = .25; o.connect(g); g.connect(sh); o.start(t); nodes.push(o); });
  const n = noiseLoop(), bp = ac.createBiquadFilter(), g2 = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = .8; g2.gain.value = .5; n.connect(bp); bp.connect(g2); g2.connect(sh); n.start(t); nodes.push(n);
  lfo.start(t);
  HZ.scream = { out, nodes };
}
function stopScream() { const s = HZ.scream; if (!s || !ac) return; HZ.scream = null; const t = ac.currentTime; s.out.gain.cancelScheduledValues(t); s.out.gain.setValueAtTime(0, t); s.nodes.forEach(n => n.stop(t + .02)); }
function crashSound() {   // the sound of a game locking up: one tiny chunk of noise stuck on repeat
  if (!ac) return; const t = ac.currentTime, sr = ac.sampleRate, b = ac.createBuffer(1, Math.floor(sr * .055), sr), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.sin(i / sr * 2 * Math.PI * 130) > 0 ? .5 : -.5) * .6 + (Math.random() * 2 - 1) * .4;
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.loop = true; g.gain.value = .35; s.connect(g); g.connect(master); s.start(t); s.stop(t + 1.25);
}
function sfxSwitch(on) {
  if (!ac) return; tone('square', 180, 90, .06, .25); tone('sine', 70, 40, .2, .5, .02);
  if (on) { tone('sine', 60, 22, 2.6, .8, .15); tone('sawtooth', 44, 30, 2.2, .1, .2); }
  else [523, 659, 784].forEach((f, i) => tone('triangle', f, f, .25, .12, .1 + i * .08));
}
function sfxBoo() { if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), v = ac.createOscillator(), vg = ac.createGain(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(260, t + .9); v.frequency.value = 7; vg.gain.value = 18; v.connect(vg); vg.connect(o.frequency);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3, t + .08); g.gain.exponentialRampToValueAtTime(.001, t + 1); o.connect(g); g.connect(master); o.start(t); v.start(t); o.stop(t + 1.05); v.stop(t + 1.05); }

/* ---------- turning it on and off ---------- */
function setHorror(on, quiet) {
  if (HZ.on === on) return; HZ.on = on;
  if (!HZ.fromNet) netSend({ t: 'hz', on: on ? 1 : 0, quiet: quiet ? 1 : 0 });
  const fogC = on ? new THREE.Color(0x151a26) : DAY.fog;
  scene.background.copy(on ? new THREE.Color(0x0b0e16) : DAY.bg); scene.fog.color.copy(fogC); scene.fog.near = on ? 1.5 : DAY.near; scene.fog.far = on ? 21 : DAY.far;
  hemi.intensity = on ? .16 : DAY.hemi; hemi.color.set(on ? 0x6f7fb0 : DAY.hc); hemi.groundColor.set(on ? 0x0e140e : DAY.hg); sun.intensity = on ? 0 : DAY.sun;
  skyU.top.value.copy(on ? new THREE.Color(0x03040a) : DAY.top); skyU.bot.value.copy(on ? new THREE.Color(0x151a26) : DAY.bot);
  torch.intensity = on ? 9 : 0; moon.visible = on;
  scene.userData.sky.children.forEach(c => { if (c !== moon) c.visible = !on; });   // no fluffy clouds at night
  mirScreen.material = on ? mirNight : mirDay;
  lever.rotation.x = on ? 1.7 : .25;
  if (on) { startAmb(); HZ.rollT = 0; HZ.textT = 14 + rnd() * 12; HZ.ambT = 4 + rnd() * 5; HZ.peekCool = 8; if (!quiet) { sfxSwitch(true); toast('🔦 ...the lights went out.', 3); } }
  else { stopAmb(quiet); clearFig(); peek.g.visible = false; wordsMesh.visible = false; ghost.visible = false; if (!quiet) { sfxSwitch(false); toast('☀️ Phew. The sun is back.', 2.5); } }
}
function clearFig() { fig.g.visible = false; HZ.phase = 'none'; HZ.red = 0; stopScream(); }

/* ---------- the figure ---------- */
const _hz = V(), _hz2 = V(), _hz3 = V(), _fwd = V();
function camFwd(out) { camera.getWorldDirection(out); out.y = 0; if (out.lengthSq() < 1e-6) out.set(0, 0, -1); return out.normalize(); }
function spawnFig() {
  headWorld(_hz); camFwd(_fwd);
  const a = Math.atan2(_fwd.x, _fwd.z) + jr() * .45, d = 5 + rnd() * 3.5;   // in front of you, where the flashlight can catch it
  const p = V(_hz.x + Math.sin(a) * d, HZ_GROUND, _hz.z + Math.cos(a) * d);
  if (state.area !== 'arena') { const r = Math.hypot(p.x, p.z); if (r > 27) p.multiplyScalar(27 / r); p.y = 0; }
  fig.g.position.copy(p); fig.g.rotation.set(0, Math.atan2(_hz.x - p.x, _hz.z - p.z), 0); tPose(fig); fig.g.visible = true;
  HZ.phase = 'tpose'; HZ.pt = 0;
  if (ac) tone('sine', 52, 49, 2.5, .25);
}
function hitFig() {
  if (HZ.phase !== 'tpose') return;
  HZ.phase = 'spazz'; HZ.pt = 0; HZ.speed = 2.2; HZ.red = 1; HZ.slam = 1; stopAmb(true); startScream();
  hands.forEach(h => buzz(h, 1, 300));
}
function segDist(p, a, b) { _hz3.subVectors(b, a); const t = clamp(_hz2.subVectors(p, a).dot(_hz3) / _hz3.lengthSq(), 0, 1); return _hz2.copy(a).addScaledVector(_hz3, t).distanceTo(p); }
const _hzA = V(), _hzB = V(), _hzL = V(), _hzR = V(), _hzP = V();
function figTouches(p, r) {   // is point p within r of the figure's body or outstretched arms?
  const g = fig.g.position, s = fig.g.scale.x;
  _hzA.set(g.x, g.y + .15 * s, g.z); _hzB.set(g.x, g.y + 1.8 * s, g.z);
  if (segDist(p, _hzA, _hzB) < r + .17) return true;
  _hzL.set(-.95, 1.47, 0).applyQuaternion(fig.g.quaternion).multiplyScalar(s).add(g); _hzR.set(.95, 1.47, 0).applyQuaternion(fig.g.quaternion).multiplyScalar(s).add(g);
  return segDist(p, _hzL, _hzR) < r + .06;
}
function hitCheck() {
  // the sword (in the Slicing Yard), a hard paw smack (anywhere), or a desktop click (see below)
  if (state.area === 'arena' && typeof sword !== 'undefined' && sword.mode === 'held') {
    for (let k = 0; k <= 4; k++) { _hzP.lerpVectors(AR.b1, AR.t1, k / 4).add(ARENA); if (figTouches(_hzP, .04)) return hitFig(); }
  }
  for (const h of hands) if (h.tracked && h.vel && h.vel.length() > 1 && figTouches(h.pos, PAW_R)) return hitFig();
}
canvas.addEventListener('pointerdown', e => {
  if (!HZ.on || HZ.phase !== 'tpose' || state.xr || state.mode !== 'play' || e.button > 2) return;
  headWorld(_hz); camera.getWorldDirection(_fwd); _hz2.copy(fig.g.position).add(V(0, 1.1, 0)).sub(_hz);
  if (_hz2.length() < 3.4 && _hz2.normalize().dot(_fwd) > .75) hitFig();
});

/* ---------- the fake crash ---------- */
function startCrash() {
  HZ.crash = .0001; stopScream(); stopAmb(true); crashSound(); HZ.red = 0;
  redMul.visible = redAdd.visible = false; fxQ.visible = true; fxMat.uniforms.stat.value = .08; fxMat.uniforms.black.value = 0;
  hands.forEach(h => buzz(h, 1, 1200));
}
function stepCrash(dt) {
  HZ.crash += dt; const c = HZ.crash, u = fxMat.uniforms; u.t.value = tAll + c;
  if (c < 1.2) { u.stat.value = c < .35 ? .06 : Math.min(1, (c - .35) * 1.6); }               // frozen... then static eats the screen
  else if (c < 1.35) { u.stat.value = 1; u.black.value = (c - 1.2) / .15; }
  else if (c < 3.9) { u.black.value = 1; u.stat.value = 0; if (!HZ.boxUp && c > 1.7) { HZ.boxUp = true; drawCrashBox(); wordsMesh.position.set(0, 0, -1.25); wordsMesh.rotation.z = 0; wordsMesh.visible = true; } }
  else {
    // ...it never crashed. You wake up back in the sunny grove, and the switch is off again.
    HZ.crash = 0; HZ.boxUp = false; wordsMesh.visible = false; fig.g.visible = false; HZ.phase = 'none';
    if (state.area === 'arena') travel(false);
    setHorror(false, true); respawn(); HZ.fadeIn = 1;
    setTimeout(() => toast('😴 ...was that a dream?', 3.5), 300);
  }
}
function horrorFrozen(dt) { if (!HZ.crash) return false; stepCrash(dt); return true; }

/* ---------- every frame ---------- */
let _lookCool = 0;
function stepHorror(dt) {
  const u = fxMat.uniforms; u.t.value = tAll;
  if (HZ.fadeIn > 0) { HZ.fadeIn = Math.max(0, HZ.fadeIn - dt * 1.2); fxQ.visible = HZ.fadeIn > 0; u.black.value = HZ.fadeIn; u.stat.value = 0; }
  if (state.mode !== 'play') return;
  headWorld(_hz);
  // the switch is pulled by hand now (see the tough pulls below)
  if (HZ.pullK !== undefined) { const from = HZ.on ? 1.7 : .25; lever.rotation.x = from + ((HZ.on ? .25 : 1.7) - from) * HZ.pullK; }
  if (!HZ.on) { redMul.visible = redAdd.visible = false; return; }

  // flicker: the moonlight stutters and the flashlight sometimes cuts out
  const fl = Math.sin(tAll * 23) * Math.sin(tAll * 7.3) > .93 ? .25 : 1;
  hemi.intensity = .16 * fl * (.85 + .15 * Math.sin(tAll * 1.7));
  torch.intensity = (rnd() < .006 ? 0 : 9) * (Math.sin(tAll * 31) * Math.sin(tAll * 3.1) > .96 ? .15 : 1);

  // creepy sounds now and then, and words that flash and vanish
  if ((HZ.ambT -= dt) < 0) { HZ.ambT = 6 + rnd() * 10; if (HZ.phase === 'none') creepySound(); }
  if (HZ.textOn > 0) { HZ.textOn -= dt; if (HZ.textOn <= 0 && !HZ.crash) wordsMesh.visible = false; else if (rnd() < .2) wordsMesh.position.x += jr() * .01; }
  else if ((HZ.textT -= dt) < 0) { HZ.textT = 20 + rnd() * 30; if (HZ.phase === 'none') flashWords(CREEPY[Math.floor(rnd() * CREEPY.length)]); }

  // the mirror: look at it and your face is gone for a moment... then it starts to warp, more the longer you stare
  const mp = mirScreen.getWorldPosition(_hz2); camera.getWorldDirection(_fwd); _hz3.subVectors(mp, _hz);
  const look = _hz3.length() < 8 && _hz3.normalize().dot(_fwd) > .92;
  if (look && !HZ.wasLook && _lookCool <= 0) { HZ.vanish = .5; _lookCool = 3; if (ac) tone('sine', 1900, 1700, .5, .04); }
  _lookCool -= dt; HZ.wasLook = look;
  HZ.stare = look ? HZ.stare + dt : Math.max(0, HZ.stare - dt * 2);
  mirNight.uniforms.t.value = tAll; mirNight.uniforms.amt.value = clamp((HZ.stare - .5) / 7, 0, 1);
  if (HZ.vanish > 0) { HZ.vanish -= dt; if (AV.head) AV.head.visible = false; }

  // look behind you: something dark at the edge of your eye sinks into the ground
  camFwd(_fwd); const yaw = Math.atan2(_fwd.x, _fwd.z);
  HZ.yawHist.push([tAll, yaw]); while (HZ.yawHist.length && tAll - HZ.yawHist[0][0] > .9) HZ.yawHist.shift();
  HZ.peekCool -= dt;
  if (HZ.peekT < 0 && HZ.peekCool <= 0 && HZ.phase === 'none' && HZ.yawHist.length > 2) {
    let dy = yaw - HZ.yawHist[0][1]; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if (Math.abs(dy) > 2.2) {
      HZ.peekCool = 14 + rnd() * 16; HZ.yawHist.length = 0;
      if (rnd() < .75) { const a = yaw + (rnd() < .5 ? -1 : 1) * (.85 + rnd() * .2), d = 4.5 + rnd() * 2;
        peek.g.position.set(_hz.x + Math.sin(a) * d, HZ_GROUND, _hz.z + Math.cos(a) * d); peek.g.rotation.y = Math.atan2(_hz.x - peek.g.position.x, _hz.z - peek.g.position.z);
        tPose(peek); peek.P.arms.forEach(r => { r.sh.rotation.z = -r.s * 1.35; }); peek.P.head.rotation.z = .5; peek.g.visible = true; HZ.peekT = 0; }
    }
  }
  if (HZ.peekT >= 0) {
    HZ.peekT += dt; const k = Math.max(0, HZ.peekT - .3);
    peek.g.position.y = HZ_GROUND - k * k * 2.6; peek.P.head.rotation.x = Math.sin(HZ.peekT * 40) * .05;
    if (peek.g.position.y < -2.2) { peek.g.visible = false; HZ.peekT = -1; }
  }

  // the figure: 1 in 90 every second (about every 2 minutes), but never within 30 s of its last visit
  if (HZ.phase !== 'none') HZ.figEnd = tAll;
  if (HZ.phase === 'none') { HZ.rollT += dt; while (HZ.rollT >= 1) { HZ.rollT -= 1; if (tAll - (HZ.figEnd || -99) > 30 && rnd() < 1 / 90) { figRoll(); break; } } }
  else HZ.pt += dt;
  if (HZ.phase === 'tpose') { hitCheck(); if (HZ.phase === 'tpose' && HZ.pt > 5) { fig.g.visible = false; HZ.phase = 'none'; if (ac) tone('sawtooth', 60, 30, .15, .1); } }
  else if (HZ.phase === 'spazz' || HZ.phase === 'chase') {
    const g = fig.g.position;
    if (HZ.phase === 'spazz') { spazz(fig, 1, 0, tAll); g.x += jr() * .03; g.z += jr() * .03; if (HZ.pt > 3) { HZ.phase = 'chase'; HZ.pt = 0; } }
    else {
      HZ.speed = Math.min(15, 1.4 + HZ.pt * .8 + HZ.pt * HZ.pt * .08);   // faster... and faster
      _hz2.set(_hz.x, Math.max(HZ_GROUND, _hz.y - 1.15), _hz.z);
      if (g.distanceTo(_hz2) > 40) { camFwd(_fwd); g.copy(_hz2).addScaledVector(_fwd, -12); g.y = Math.max(HZ_GROUND, g.y); }   // you can't outrun it through a portal
      _hz3.subVectors(_hz2, g); const dist = _hz3.length(); if (dist > 1e-3) g.addScaledVector(_hz3, Math.min(dist, HZ.speed * dt) / dist);
      g.x += jr() * .04; g.z += jr() * .04;
      fig.g.rotation.y = Math.atan2(_hz.x - g.x, _hz.z - g.z) + jr() * .25;
      spazz(fig, .9, 8 + HZ.speed * 1.6, tAll);
      if (figTouches(_hz, .3)) startCrash();
    }
    HZ.red = Math.max(HZ.phase === 'spazz' ? .85 : .75, HZ.red - dt * .6);
  }
  // the red-and-black filter (with a hard flash when you land the hit)
  HZ.slam = Math.max(0, HZ.slam - dt * 2.5);
  const r = HZ.phase === 'spazz' || HZ.phase === 'chase' ? HZ.red : 0;
  redMul.visible = redAdd.visible = r > 0;
  redMul.material.uniforms.k.value = Math.min(1, r * (.92 + .08 * Math.sin(tAll * 47)));
  redAdd.material.uniforms.k.value = r * (.6 + .4 * Math.abs(Math.sin(tAll * 7.5 * Math.PI))) + HZ.slam * 2;

  // secret: boop Pip at night
  if (pip.hop > HZ.pipPrev + .5 && HZ.phase === 'none') { ghost.visible = true; HZ.ghostT = 4; sfxBoo(); if (!state.secrets.has('boo')) toast('👻 Pip: "boo!"  (Secret found!)', 3.5); state.secrets.add('boo'); }
  HZ.pipPrev = pip.hop;
  if (HZ.ghostT > 0) { HZ.ghostT -= dt; ghost.position.y = Math.sin(tAll * 4) * .03; ghost.rotation.y = Math.sin(tAll * 2) * .2; if (HZ.ghostT <= 0) ghost.visible = false; }
}
window.__kg.horror = { HZ, setHorror, spawnFig, hitFig, startCrash, SWITCH_AT, fig, peek, flashWords, mirNight };
try { renderer.compile(arena, camera, scene); } catch (e) {}
