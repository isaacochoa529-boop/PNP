// Abandoned City: game loop, your body and hands, round rules, secrets, auto-update.
import * as THREE from 'three';
import { buildCity, makeSky, makeCrickets, SPAWN, HALF, walls, hideZones } from './city.js';
import { makeCrawler } from './crawler.js';
import * as SFX from './sound.js';
import { createNet } from './net.js';

const VERSION = document.querySelector('meta[name="game-version"]')?.content || '0';
const ROUND_SECS = 180;   // headlight battery. When it dies, the Crawler screams and hunts.
const RESTART_SECS = 5;   // pause after someone gets caught

const $ = (id) => document.getElementById(id);
const ui = $('ui'), statusEl = $('status'), hintEl = $('hint');

// ---------- renderer, scene, your body ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060c);
scene.fog = new THREE.Fog(0x05060c, 45, 170);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 600);
const rig = new THREE.Group();   // your body on the ground. Moves when you pull the air.
rig.position.copy(SPAWN);
rig.add(camera);
scene.add(rig);
scene.add(new THREE.HemisphereLight(0x27365a, 0x050505, 0.4));
const moonLight = new THREE.DirectionalLight(0x9fb4ff, 0.25);
moonLight.position.set(-60, 90, -40);
scene.add(moonLight);

buildCity(scene);
const sky = makeSky(scene);
const crickets = makeCrickets(scene, 45);
const crawler = makeCrawler(scene);

// Headlight on your head. It turns off when the battery is dead.
const headlight = new THREE.SpotLight(0xfff0d0, 9, 90, 0.42, 0.45, 1.3);
headlight.target.position.set(0, -0.3, -12);
camera.add(headlight);
camera.add(headlight.target);

// Red flash and on-glass HUD, both stuck to your face
const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ color: 0xff0020, transparent: true, opacity: 0, depthTest: false }));
veil.position.z = -0.4;
veil.renderOrder = 999;
camera.add(veil);

const hudCanvas = document.createElement('canvas');
hudCanvas.width = 768; hudCanvas.height = 384;
const hctx = hudCanvas.getContext('2d');
const hudTex = new THREE.CanvasTexture(hudCanvas);
const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false }));
hud.position.set(0, -0.3, -0.8);
hud.renderOrder = 998;
camera.add(hud);

// Hands: controllers with a black glove on each
const glove = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.8 });
const hands = [0, 1].map((i) => {
  const grip = renderer.xr.getControllerGrip(i);
  const ctrl = renderer.xr.getController(i);
  const model = new THREE.Group();
  model.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glove));
  const fingers = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.09, 4, 8), glove);
  fingers.rotation.x = Math.PI / 2;
  fingers.position.set(0, -0.01, -0.07);
  model.add(fingers);
  model.visible = false;
  grip.add(model);
  rig.add(grip, ctrl);
  const h = { i, grip, ctrl, model, gamepad: null, hand: '', pos: new THREE.Vector3(), grab: null };
  ctrl.addEventListener('connected', (e) => { h.gamepad = e.data.gamepad || null; h.hand = e.data.handedness; model.visible = true; });
  ctrl.addEventListener('disconnected', () => { h.gamepad = null; model.visible = false; });
  return h;
});

// ---------- shared state ----------
const myName = 'Friend ' + Math.floor(100 + Math.random() * 899);
let myId = '';
let netText = '🔎 Looking for your friend…';
let pendingReload = false;
let flat = false;   // non-VR test mode (keyboard + mouse)
const startedAt = performance.now();
// If the network never connects, you still play alone: you become the host by yourself.
const amHost = () => net.isHost || (!net.myId && performance.now() - startedAt > 8000);

function readBest() { try { return +(localStorage.getItem('city-best') || 0); } catch (e) { return 0; } }
function saveBest(v) {
  if (v <= S.best) return;
  S.best = v;
  try { localStorage.setItem('city-best', String(v)); } catch (e) {}
}

const S = {
  rid: -1, el: 0, red: false, battery: ROUND_SECS, frozen: false,
  msg: '', msgUntil: 0, squishes: 0, squishTimes: [], lookT: 0,
  best: readBest(), secrets: new Set(), voice: false, veil: 0,
};

// The host runs the round clock and the monster brain. Starts as soon as you are the host.
const H = { started: false, rid: Math.floor(Math.random() * 1e6), t0: 0, red: false, screamed: false, restartAt: 0, lastW: 0 };

// Other players: { id, name, head, q, dir, lh, rh, seen, av }
const remote = new Map();

// ---------- helpers ----------
const mmss = (s) => { const t = Math.floor(s); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const clampH = (v) => Math.max(-HALF, Math.min(HALF, v));
function setMsg(text, ms) { S.msg = text; S.msgUntil = performance.now() + ms; }
function nameOf(id) { return remote.get(id)?.name || 'Someone'; }
function setStatus() { statusEl.textContent = netText + '   👥 ' + (remote.size + 1); }

function inHide(p) {
  for (const z of hideZones) if (p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1 && p.y < z.top) return true;
  return false;
}
function blocked(p) {
  for (const w of walls) if (p.x > w.x0 - 0.35 && p.x < w.x1 + 0.35 && p.z > w.z0 - 0.35 && p.z < w.z1 + 0.35) return true;
  return false;
}

// ---------- other players (avatars) ----------
function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 40px sans-serif'; x.fillStyle = '#ffb3b3'; x.textAlign = 'center';
  x.fillText(text, 128, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  s.scale.set(0.5, 0.125, 1);
  return s;
}
function makeAvatar(name) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 4, 8), glove);
  body.position.y = -0.55;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9 }));
  g.add(head);
  const label = makeLabel(name);
  label.position.y = 0.35;
  g.add(label);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glove);
  const hr = hl.clone();
  scene.add(g, hl, hr);
  return { g, hl, hr };
}
function getRemote(id, name) {
  let r = remote.get(id);
  if (!r) {
    r = { id, name, head: new THREE.Vector3(), q: new THREE.Quaternion(), dir: new THREE.Vector3(0, 0, -1),
      lh: new THREE.Vector3(), rh: new THREE.Vector3(), seen: 0, av: makeAvatar(name) };
    remote.set(id, r);
    setStatus();
  }
  return r;
}
function dropRemote(id) {
  const r = remote.get(id);
  if (!r) return;
  scene.remove(r.av.g, r.av.hl, r.av.hr);
  remote.delete(id);
  setStatus();
}
function onPose(m) {
  const r = getRemote(m.id, m.n || 'Friend');
  r.name = m.n || r.name;
  r.head.fromArray(m.h, 0);
  r.q.fromArray(m.h, 3);
  r.dir.set(0, 0, -1).applyQuaternion(r.q);
  r.lh.fromArray(m.l);
  r.rh.fromArray(m.r);
  r.seen = performance.now();
}

// ---------- voice chat ----------
function playVoice(stream) {
  const a = document.createElement('audio');
  a.srcObject = stream;
  a.autoplay = true;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.play?.().catch(() => {});
  S.voice = true;
}
async function turnOnVoice() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    net.setMic(stream);
    S.voice = true;
    $('mic').textContent = '🎙️ Voice chat is on';
    setMsg('🎙️ Voice on! Talk to your friend.', 3000);
  } catch (e) {
    hintEl.textContent = '🔇 No mic allowed, so voice chat is off.';
  }
}

// ---------- events (sound + messages), same for host and guests ----------
function onSquish() {
  S.squishes++;
  SFX.squish();
  const now = performance.now();
  S.squishTimes.push(now);
  S.squishTimes = S.squishTimes.filter((t) => now - t < 6000);
  if (S.squishTimes.length >= 7 && !S.secrets.has('golden')) {
    S.secrets.add('golden');
    SFX.chime();
    setMsg('🥇 Secret found! (' + S.secrets.size + '/2)', 4000);
  }
}
function onEvent(e) {
  if (e.k === 'step') SFX.thud({ x: e.x, y: 0.3, z: e.z });
  else if (e.k === 'sing') SFX.sing({ x: e.x, y: 0.8, z: e.z });
  else if (e.k === 'scream') { SFX.scream(); S.veil = 1; setMsg('😱 THEY SCREAM! They hunt now!', 4500); }
  else if (e.k === 'catch') {
    const m = crawler.snapshot();
    SFX.thud({ x: m.x, y: 0.3, z: m.z });
    if (e.who === myId) {
      S.frozen = true; S.veil = 1;
      saveBest(S.el);
      setMsg('💀 Caught! Back to the start…', 4000);
    } else {
      setMsg('💀 ' + nameOf(e.who) + ' got caught!', 3000);
    }
  }
}

// ---------- rounds ----------
function newRound() {
  rig.position.copy(SPAWN);
  S.frozen = false;
  S.el = 0;
  sky.moon.material.color.set(S.red ? 0xff2040 : 0xdfe6ff);
  setMsg(S.red ? '🚨 RED LIGHTS! They always know where you are!' : '🔦 Headlights on. Stay alive!', 4500);
}
function startRound(now) {
  H.rid++;
  H.t0 = now;
  H.red = Math.random() < 0.2;        // 1 in 5 rounds is a RED LIGHTS round
  H.screamed = false;
  H.restartAt = 0;
  let x, z;
  do {
    x = (Math.random() * 2 - 1) * HALF * 0.8;
    z = (Math.random() * 2 - 1) * HALF * 0.8;
  } while (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 90);
  crawler.reset(x, z);
}

// ---------- network ----------
const net = createNet({
  onStatus: (t) => { netText = t; setStatus(); },
  onMessage: (msg, from) => {
    if (msg.t === 'p') {
      onPose(msg);
      if (net.isHost) net.send(msg, from);     // host relays to everyone else
    } else if (msg.t === 'w') applyWorld(msg);
    else if (msg.t === 'ev') onEvent(msg);
  },
  onVoice: (id, stream) => playVoice(stream),
  onGone: (id) => dropRemote(id),
});

function applyWorld(m) {
  S.red = m.red; S.el = m.el; S.battery = m.bat;
  if (m.rid !== S.rid) { S.rid = m.rid; newRound(); }
  crawler.applyRemote(m.m);
}

function hostTick(now, dt, players) {
  if (H.restartAt && now >= H.restartAt) startRound(now);
  const el = (now - H.t0) / 1000;
  const bat = Math.max(0, ROUND_SECS - el);
  S.red = H.red; S.el = el; S.battery = bat;

  if (!H.screamed && (bat <= 0 || H.red)) {
    H.screamed = true;
    net.send({ t: 'ev', k: 'scream' });
    onEvent({ k: 'scream' });
  }

  const list = players.map((p) => ({ id: p.id, pos: p.pos, dir: p.dir, hidden: inHide(p.pos) }));
  const lights = list.map((p) => ({ pos: p.pos, dir: p.dir, on: bat > 0 }));
  const events = crawler.update(dt, now, { players: list, hunting: H.screamed || H.red, red: H.red, lights });
  for (const e of events) {
    if (e.k === 'catch') {
      if (!H.restartAt) {
        H.restartAt = now + RESTART_SECS * 1000;
        const msg = { t: 'ev', k: 'catch', who: e.who };
        net.send(msg);
        onEvent(msg);
      }
    } else {
      const msg = { t: 'ev', ...e };
      net.send(msg);
      onEvent(msg);
    }
  }

  if (S.rid !== H.rid) { S.rid = H.rid; newRound(); }
  if (now - H.lastW > 100) {
    H.lastW = now;
    net.send({ t: 'w', rid: H.rid, el, red: H.red, bat, m: crawler.snapshot() });
  }
}

// ---------- your body: pull the air to walk, thumbstick too ----------
const tmpFwd = new THREE.Vector3(), tmpRight = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function moveYou(dt) {
  const prev = rig.position.clone();
  // Pull the air: hold the side button and move your hand. Your body moves the other way.
  for (const h of hands) {
    const b = h.gamepad && h.gamepad.buttons[1];
    if (!b || !b.pressed) { h.grab = null; continue; }
    if (!h.grab) { h.grab = h.pos.clone(); continue; }
    const d = h.pos.clone().sub(h.grab);
    d.y = 0;
    rig.position.sub(d);
    h.grab.copy(h.pos).sub(d);
  }
  // Left thumbstick: walk
  const L = hands.find((h) => h.hand === 'left' && h.gamepad);
  if (L && L.gamepad.axes.length >= 4) {
    const ax = L.gamepad.axes[2] || 0, ay = L.gamepad.axes[3] || 0;
    if (Math.hypot(ax, ay) > 0.2) {
      camera.getWorldDirection(tmpFwd);
      tmpFwd.y = 0; tmpFwd.normalize();
      tmpRight.crossVectors(tmpFwd, UP);
      const sp = 2.0 * dt;
      rig.position.addScaledVector(tmpRight, ax * sp);
      rig.position.addScaledVector(tmpFwd, -ay * sp);
    }
  }
  if (blocked(rig.position)) rig.position.copy(prev);
  rig.position.x = clampH(rig.position.x);
  rig.position.z = clampH(rig.position.z);
}

// Flat (non-VR) test mode: WASD to walk, drag the mouse to look
const keys = {};
let yaw = 0, pitch = 0;
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousemove', (e) => {
  if (!flat || !(e.buttons & 1)) return;
  yaw -= e.movementX * 0.003;
  pitch = Math.max(-1.3, Math.min(1.3, pitch - e.movementY * 0.003));
  rig.rotation.y = yaw;
  camera.rotation.x = pitch;
});
function flatMove(dt) {
  const sp = 2.2 * dt;
  const f = [-Math.sin(yaw), -Math.cos(yaw)], r = [Math.cos(yaw), -Math.sin(yaw)];
  let mx = 0, mz = 0;
  if (keys.KeyW) { mx += f[0]; mz += f[1]; }
  if (keys.KeyS) { mx -= f[0]; mz -= f[1]; }
  if (keys.KeyD) { mx += r[0]; mz += r[1]; }
  if (keys.KeyA) { mx -= r[0]; mz -= r[1]; }
  const prev = rig.position.clone();
  rig.position.x += mx * sp;
  rig.position.z += mz * sp;
  if (blocked(rig.position)) rig.position.copy(prev);
}

// ---------- HUD on your face ----------
function drawHud(now) {
  const c = hctx;
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(0, 0, 768, 384);
  c.textBaseline = 'middle';
  c.fillStyle = '#e8e8e8';
  c.font = 'bold 40px sans-serif';
  c.fillText(S.battery > 0 ? '🔦 Headlights ' + mmss(S.battery) : '🔦 Headlights DEAD 💀', 24, 50);
  c.fillText(S.red ? '🚨 RED LIGHTS 🚨' : '👥 ' + (remote.size + 1) + ' in the city', 24, 120);
  c.fillText('⏱ ' + mmss(S.el) + '   🏆 best ' + mmss(S.best), 24, 190);
  c.fillText('🦗 squished ' + S.squishes + '   ' + (S.voice ? '🎙️ voice on' : '🔇 no voice'), 24, 260);
  if (S.msg && now < S.msgUntil) {
    c.fillStyle = '#ffd27a';
    c.font = 'bold 34px sans-serif';
    c.fillText(S.msg, 24, 330);
  }
  hudTex.needsUpdate = true;
}

// ---------- version check: newer version on the site = reload ----------
async function checkVersion() {
  try {
    const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
    const v = (await r.text()).trim();
    if (v && v !== VERSION) {
      pendingReload = true;
      const key = 'city-reload-' + v;
      if (!renderer.xr.isPresenting && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        location.reload();
      }
    }
  } catch (e) {}
}
setInterval(checkVersion, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
checkVersion();

// ---------- main loop ----------
const headPos = new THREE.Vector3(), headDir = new THREE.Vector3(), headQ = new THREE.Quaternion();
let last = performance.now(), lastPose = 0, lastHud = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (net.myId) myId = net.myId;
  for (const h of hands) h.grip.getWorldPosition(h.pos);
  camera.getWorldPosition(headPos);
  camera.getWorldDirection(headDir);
  camera.getWorldQuaternion(headQ);

  if (!S.frozen) {
    if (flat) flatMove(dt); else moveYou(dt);
  }

  // Are you the host right now? Run the round + monster brain.
  if (amHost()) {
    if (!H.started) { H.started = true; startRound(now); }
    const players = [{ id: myId || 'me', pos: headPos, dir: headDir }];
    for (const r of remote.values()) players.push({ id: r.id, pos: r.head, dir: r.dir });
    hostTick(now, dt, players);
  }
  crawler.show(dt);
  headlight.visible = S.battery > 0;

  // Crickets: hands scare and squish them
  const handPts = hands.filter((h) => h.model.visible).map((h) => h.pos);
  crickets.update(dt, handPts, onSquish);

  // Secret 2: look straight up at the moon for 8 seconds
  if (headDir.y > 0.9 && !S.frozen) S.lookT += dt;
  else S.lookT = Math.max(0, S.lookT - dt * 2);
  if (S.lookT > 8 && !S.secrets.has('moon')) {
    S.secrets.add('moon');
    SFX.chime();
    setMsg('🌙 Secret found! (' + S.secrets.size + '/2)', 4000);
  }

  // Other players
  for (const r of [...remote.values()]) {
    r.av.g.position.copy(r.head);
    r.av.g.rotation.y = Math.atan2(r.dir.x, r.dir.z);
    r.av.hl.position.copy(r.lh);
    r.av.hr.position.copy(r.rh);
    if (performance.now() - r.seen > 6000) dropRemote(r.id);
  }

  // Send your pose to the others, 10 times a second
  if (net.myId && now - lastPose > 100) {
    lastPose = now;
    myId = net.myId;
    net.send({ t: 'p', id: myId, n: myName, h: [...headPos.toArray(), ...headQ.toArray()], l: hands[0].pos.toArray(), r: hands[1].pos.toArray() });
  }

  S.veil = Math.max(0, S.veil - dt * 0.8);
  veil.material.opacity = Math.max(S.veil * 0.8, S.frozen ? 0.5 : 0);

  SFX.setListener(headPos, headDir);
  if (now - lastHud > 250) { lastHud = now; drawHud(now); }
  renderer.render(scene, camera);
}

// ---------- start buttons ----------
$('mic').onclick = () => turnOnVoice();
$('go').onclick = async () => {
  SFX.initSound();
  SFX.resumeSound();
  if (navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false))) {
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      await renderer.xr.setSession(session);
      ui.style.display = 'none';
      session.addEventListener('end', () => {
        if (pendingReload) { location.reload(); return; }
        ui.style.display = '';
      });
      return;
    } catch (e) {
      hintEl.textContent = '😬 Could not start VR: ' + e.message;
      return;
    }
  }
  flat = true;
  camera.position.y = 1.6;
  ui.style.display = 'none';
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Auto-join: starts right away, no buttons needed
net.start();
setStatus();
renderer.setAnimationLoop(frame);
