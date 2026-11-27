// Abandoned City: the game loop. Your body + hands, rounds, hiding, flares, HUD, secrets, auto-update.
import * as THREE from 'three';
import { buildCity, makeSky, makeMist, makeCrickets, SPAWN, HALF, hideZoneAt, secretSpots } from './city.js';
import { makeCrawler, buildCrawlerModel } from './crawler.js';
import * as SFX from './sound.js';
import { createNet } from './net.js';
import { createMover, EYE } from './move.js';
import { makeFriends } from './friends.js';
import { nearSolids, groundAt } from './city.js';

const VERSION = document.querySelector('meta[name="game-version"]')?.content || '0';
const BATTERY_SECS = 180;   // headlights last 3 minutes. Then the Crawler screams and hunts.
const RESTART_SECS = 6;     // pause after everyone is caught
const RED_CHANCE = 0.2;     // 1 in 5 nights is a RED NIGHT
const FLARE_SECS = 25, FLARE_RECHARGE = 75;
const SECRET_TOTAL = 5;

const $ = (id) => document.getElementById(id);
const ui = $('ui'), statusEl = $('status'), hintEl = $('hint'), friendEl = $('friend'), deskHud = $('deskhud');

// ---------- renderer + scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
try { renderer.xr.setFoveation(1); } catch (e) {}
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const FOG = new THREE.Color(0x0b0f1a), FOG_RED = new THREE.Color(0x1c0508);
scene.background = FOG.clone();
scene.fog = new THREE.FogExp2(FOG.clone(), 0.024);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.04, 700);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

const hemi = new THREE.HemisphereLight(0x46587e, 0x0c0a08, 0.9);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0xa8b8ff, 0.45);
moonLight.position.set(-170, 190, -250);
scene.add(moonLight);
// your head lamp
const headlight = new THREE.SpotLight(0xfff0d0, 40, 48, 0.5, 0.55, 1.0);
headlight.position.set(0, 0.02, 0);
headlight.target.position.set(0, -0.25, -10);
camera.add(headlight, headlight.target);
// your friend's head lamp (one real light, moved onto the nearest friend)
const friendLamp = new THREE.SpotLight(0xfff0d0, 0, 40, 0.5, 0.55, 1.0);
scene.add(friendLamp, friendLamp.target);
// flare light + the park lamp. (Lights are made once and only dimmed, so the headset never stutters.)
const flareLight = new THREE.PointLight(0xff3a20, 0, 18, 1.2);
scene.add(flareLight);
const parkLight = new THREE.PointLight(0xffd9a0, 0, 20, 1.2);
scene.add(parkLight);

const city = buildCity(scene);
const sky = makeSky(scene, city.T);
const mist = makeMist(scene, city.T);
const crickets = makeCrickets(scene, 60);
const crawler = makeCrawler(scene);
parkLight.position.copy(secretSpots.parkLamp);
const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const friends = makeFriends(scene, beamMat);

// ---------- your hands: black gloves with fingers that curl ----------
const gloveM = new THREE.MeshLambertMaterial({ color: 0x15151a });
const cuffM = new THREE.MeshLambertMaterial({ color: 0x7a1218 });
function makeGlove(left) {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 9), gloveM);
  palm.scale.set(1, 0.6, 1.15); g.add(palm);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.05, 12), cuffM);
  cuff.rotation.x = Math.PI / 2; cuff.position.z = 0.065; g.add(cuff);
  const fingers = [];
  const SEGG = new THREE.CapsuleGeometry(0.012, 0.03, 3, 6).rotateX(Math.PI / 2).translate(0, 0, -0.022);
  for (let i = 0; i < 5; i++) {
    const thumb = i === 0;
    const a = new THREE.Group();
    const sx = left ? -1 : 1;
    if (thumb) { a.position.set(sx * 0.045, -0.005, -0.005); a.rotation.y = sx * -0.9; }
    else a.position.set(sx * (0.03 - (i - 1) * 0.02), 0, -0.05);
    g.add(a);
    const s1 = new THREE.Mesh(SEGG, gloveM); a.add(s1);
    const b = new THREE.Group(); b.position.z = -0.042; a.add(b);
    const s2 = new THREE.Mesh(SEGG, gloveM); s2.scale.setScalar(0.9); b.add(s2);
    fingers.push({ a, b, thumb });
  }
  g.userData.fingers = fingers;
  g.visible = false;
  scene.add(g);
  return g;
}
const gloves = [makeGlove(true), makeGlove(false)];
function curl(g, grip, trig, dt) {
  const F = g.userData.fingers;
  const k = Math.min(1, dt * 20);
  F.forEach((f, i) => {
    const want = f.thumb ? grip * 0.8 : (i === 1 ? trig : grip);
    f.c = (f.c || 0.2) + (Math.max(0.15, want) - (f.c || 0.2)) * k;
    if (f.thumb) { f.a.rotation.x = -f.c * 0.5; f.b.rotation.x = -f.c * 0.8; }
    else { f.a.rotation.x = -f.c * 1.4; f.b.rotation.x = -f.c * 1.6; }
  });
}

// ---------- wrist watch + face toasts ----------
function canvasPlane(w, h, cw, ch) {
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
  m.renderOrder = 990;
  return { m, c, x: c.getContext('2d'), tex };
}
const wrist = canvasPlane(0.15, 0.075, 512, 256);
wrist.m.position.set(0, 0.035, 0.085);
wrist.m.rotation.x = -Math.PI / 2;
gloves[0].add(wrist.m);
const toast = canvasPlane(0.8, 0.25, 1024, 320);
toast.m.position.set(0, 0.13, -0.9);
// subtitles removed (Isaiah asked): the toast is no longer shown on your face
toast.m.visible = false;
const veil = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0xff0020, transparent: true, opacity: 0, depthTest: false, fog: false }));
veil.position.z = -0.3; veil.renderOrder = 999;
camera.add(veil);
// the jumpscare face
const scare = buildCrawlerModel(0.8);
scare.root.position.set(0, -0.97 * 0.8 + 0.02, -0.55 - 0.78 * 0.8);
scare.root.visible = false;
camera.add(scare.root);

// ---------- state ----------
const NAMES = ['Ghost', 'Shadow', 'Moth', 'Raven', 'Echo', 'Ember', 'Fox', 'Owl'];
const myName = NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + Math.floor(10 + Math.random() * 89);
let myId = '';
let flat = false, entered = false, pendingReload = false;
const startedAt = performance.now();

function readJSON(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
const S = {
  rid: -1, el: 0, red: false, battery: BATTERY_SECS, hunting: false,
  alive: 0, ghost: false, best: readJSON('city-best', 0),
  secrets: new Set(readJSON('city-secrets', [])), squishes: 0, squishTimes: [], moonT: 0,
  voice: false, veil: 0, scareT: 0,
  hideZone: null, hideT: 0, flares: 1, flareCd: 0, lightOn: true,
  toast: '', toastUntil: 0, toastStart: 0, link: 'search', linkText: '🔎 Looking for your friend…',
  wasFriends: 0,
};
// host only: round clock + crawler brain
const H = { started: false, rid: Math.floor(Math.random() * 1e6), t0: 0, red: false, screamed: false, restartAt: 0, lastW: 0, caught: new Set() };
const flares = [];   // {id, mesh, pos, vel, landed, t}

const mmss = (s) => { const t = Math.max(0, Math.floor(s)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const amHost = () => net.isHost || (!net.myId && performance.now() - startedAt > 8000);

// timed text stays long enough to read (138 words per minute)
function say(text, minMs = 0) {
  const words = text.split(/\s+/).length;
  const ms = Math.max(minMs, 2200 + (words / 138) * 60000);
  S.toast = text; S.toastStart = performance.now(); S.toastUntil = S.toastStart + ms;
  drawToast();
}
function drawToast() {
  const x = toast.x;
  x.clearRect(0, 0, 1024, 320);
  if (S.toast && performance.now() < S.toastUntil) {
    x.fillStyle = 'rgba(0,0,0,0.6)';
    x.beginPath(); x.roundRect(10, 20, 1004, 280, 40); x.fill();
    x.fillStyle = '#ffe2a8'; x.font = 'bold 50px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const words = S.toast.split(' '); let line = '', lines = [];
    for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > 940) { lines.push(line); line = w; } else line = t; }
    lines.push(line);
    lines = lines.slice(0, 4);
    lines.forEach((l, i) => x.fillText(l, 512, 160 + (i - (lines.length - 1) / 2) * 60));
  }
  toast.tex.needsUpdate = true;
}

function found(key, text) {
  if (S.secrets.has(key)) return;
  S.secrets.add(key);
  writeJSON('city-secrets', [...S.secrets]);
  SFX.chime();
  say(text + ' 🤫 Secret found! (' + S.secrets.size + '/' + SECRET_TOTAL + ')', 4500);
}
function saveBest() { if (S.alive > S.best) { S.best = S.alive; writeJSON('city-best', S.best); } }

// ---------- movement ----------
const mover = createMover({
  rig, camera, renderer,
  onSlap: (h, speed) => SFX.hit(speed),
  onLand: () => SFX.land(),
});
const hands = mover.hands;

// ---------- network ----------
function setStatus() {
  const n = friends.list.size;
  statusEl.textContent = S.linkText + '   👥 ' + (n + 1);
  friendEl.textContent = n ? '🟢 Your friend is in the city! (' + (n + 1) + ' players)' : (S.link === 'search' ? '🔎 Looking for your friend…' : '🟡 No friend yet. Send them this link!');
  friendEl.className = n ? 'good' : '';
}
const net = createNet({
  onStatus: (t, lvl) => { S.linkText = t; S.link = lvl === 'good' ? 'good' : lvl === 'bad' ? 'bad' : 'search'; setStatus(); },
  onLink: () => setStatus(),
  onMessage: (msg, from) => {
    if (msg.t === 'p') {
      if (msg.id === myId) return;
      const before = friends.list.has(msg.id);
      friends.pose(msg);
      if (!before) friendJoined(msg);
      if (net.isHost) net.send(msg, from);
    } else if (msg.t === 'w') { if (!net.isHost) applyWorld(msg); }
    else if (msg.t === 'ev') {
      if (net.isHost) net.send(msg, from);
      onEvent(msg, true);
    }
  },
  onVoice: (id, stream) => { friends.voice(id, stream); S.voice = true; },
  onGone: (id) => {},
});
function friendJoined(m) {
  SFX.friendChime(true);
  say('🟢 ' + (m.n || 'Your friend') + ' joined the city! 👋', 4000);
  setStatus();
}

// ---------- events (everyone) ----------
function onEvent(e, fromNet) {
  const p = { x: e.x, y: e.y ?? 0.5, z: e.z };
  switch (e.k) {
    case 'sing': SFX.sing(p); crawler.sang(); break;
    case 'hiss': SFX.hiss(p); break;
    case 'roar': SFX.roar(p); break;
    case 'lunge': SFX.lunge(p); break;
    case 'climb': SFX.climb(p); break;
    case 'scream':
      SFX.scream(); S.veil = 0.8;
      say(S.red ? '🚨 RED NIGHT! It knows where you are. RUN! 🏃' : '😱 Your lights are dead. IT IS HUNTING. Hide inside! 🏚️', 5000);
      break;
    case 'catch':
      if (amHost()) H.caught.add(e.who);
      if (e.who === myId || (e.who === 'me' && !net.myId)) gotCaught();
      else { say('💀 ' + (friends.list.get(e.who)?.name || 'Your friend') + ' got caught!', 3500); }
      break;
    case 'flare': spawnFlare(e); break;
  }
}
function emit(e) {
  net.send({ t: 'ev', ...e });
  onEvent(e, false);
}

function gotCaught() {
  if (S.ghost) return;
  S.ghost = true;
  mover.ghost = true;
  S.scareT = 1.4;
  S.veil = 1;
  SFX.jumpscare();
  saveBest();
  for (const h of hands) { const a = h.gp?.hapticActuators?.[0]; if (a) try { a.pulse(1, 600); } catch (e) {} }
  setTimeout(() => say('👻 You got caught! You are a ghost now. Float around and help your friend.', 5000), 1500);
}

// ---------- rounds ----------
function newRound() {
  S.ghost = false; mover.ghost = false; mover.frozen = false;
  S.alive = 0; S.flares = 1; S.flareCd = 0; S.hideT = 0;
  for (const f of flares) scene.remove(f.g);
  flares.length = 0;
  if (entered) mover.teleport(new THREE.Vector3(SPAWN.x + (Math.random() - 0.5) * 3, 0.12, SPAWN.z + (Math.random() - 0.5) * 2));
  say(S.red ? '🚨 RED NIGHT! It always knows where you are. Keep moving! 🩸' : '🔦 New night. Your head lamp keeps it away for 3 minutes. Then HIDE.', 5500);
}
function startRound(now) {
  H.rid++;
  H.t0 = now;
  H.red = Math.random() < RED_CHANCE;
  H.screamed = false; H.restartAt = 0; H.caught.clear();
  const p = crawler.spawnSpot(SPAWN);
  crawler.reset(p.x, p.z);
}
function applyWorld(m) {
  S.red = m.red; S.el = m.el; S.battery = m.bat; S.hunting = m.hunt;
  if (m.rid !== S.rid) { S.rid = m.rid; newRound(); }
  crawler.applyRemote(m.m);
}

function players(headPos, headDir) {
  const list = [];
  if (entered) list.push({ id: myId || 'me', pos: headPos.clone(), dir: headDir.clone(), hidden: !!S.hideZone, hideT: S.hideT, ghost: S.ghost, light: S.lightOn });
  for (const f of friends.list.values()) {
    if (f.menu) continue;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(f.q);
    list.push({ id: f.id, pos: f.headP, dir, hidden: f.hidden, hideT: f.hideT || 0, ghost: f.ghost || H.caught.has(f.id), light: f.light });
  }
  return list;
}

function hostTick(now, dt, list) {
  if (H.restartAt && now >= H.restartAt) startRound(now);
  const el = (now - H.t0) / 1000;
  const bat = H.red ? BATTERY_SECS : Math.max(0, BATTERY_SECS - el);
  const hunting = H.red ? el > 6 : bat <= 0;
  S.red = H.red; S.el = el; S.battery = bat; S.hunting = hunting;
  if (!H.screamed && hunting) { H.screamed = true; emit({ k: 'scream' }); }
  for (const p of list) if (H.caught.has(p.id)) p.ghost = true;
  const lights = list.filter((p) => !p.ghost).map((p) => ({ pos: p.pos, dir: p.dir, on: p.light && bat > 0 }));
  const fl = flares.filter((f) => f.landed && f.t < FLARE_SECS).map((f) => ({ x: f.pos.x, z: f.pos.z }));
  const evs = crawler.update(dt, now, { players: list, hunting, red: H.red, lights, flares: fl });
  for (const e of evs) {
    if (e.k === 'catch') {
      if (H.caught.has(e.who)) continue;
      H.caught.add(e.who);
      emit({ k: 'catch', who: e.who });
    } else emit(e);
  }
  // everyone caught (and someone was playing)? new night soon
  const playing = list.length;
  if (playing && !H.restartAt && list.every((p) => p.ghost)) H.restartAt = now + RESTART_SECS * 1000;
  if (S.rid !== H.rid) { S.rid = H.rid; newRound(); }
  if (now - H.lastW > 100) {
    H.lastW = now;
    net.send({ t: 'w', rid: H.rid, el: +el.toFixed(2), red: H.red, bat: +bat.toFixed(1), hunt: hunting, m: crawler.snapshot() });
  }
}

// ---------- flares (the fun extra 🔥): throw one, the Crawler won't come near it ----------
const flareStick = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8);
const flareMat = new THREE.MeshBasicMaterial({ color: 0xff3020 });
const flareGlowMat = new THREE.SpriteMaterial({ map: city.T.glow, color: 0xff5030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
function spawnFlare(e) {
  if (flares.some((f) => f.id === e.fid)) return;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(flareStick, flareMat));
  const gl = new THREE.Sprite(flareGlowMat); gl.scale.set(1.6, 1.6, 1); g.add(gl);
  const sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(30 * 3), 3)),
    new THREE.PointsMaterial({ color: 0xffa060, size: 0.05, map: city.T.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  scene.add(g, sparks);
  const f = { id: e.fid, g, gl, sparks, pos: new THREE.Vector3().fromArray(e.p), vel: new THREE.Vector3().fromArray(e.v), landed: false, t: 0, spin: Math.random() * 10 };
  flares.push(f);
  SFX.flareLight(f.pos);
}
function throwFlare(h) {
  if (S.flares <= 0 || S.ghost || !entered) return;
  S.flares--;
  S.flareCd = FLARE_RECHARGE;
  const p = h ? h.pos.clone() : camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.2, 0));
  const fw = camera.getWorldDirection(new THREE.Vector3());
  const v = h ? h.vel.clone().multiplyScalar(1.3) : fw.clone().multiplyScalar(8).add(new THREE.Vector3(0, 3, 0));
  if (v.length() < 3) v.copy(fw).multiplyScalar(5).add(new THREE.Vector3(0, 2.5, 0));
  if (v.length() > 16) v.setLength(16);
  emit({ k: 'flare', fid: (myId || 'me') + ':' + Date.now(), p: p.toArray(), v: v.toArray() });
  say('🔥 Flare! It hates the light. It won\'t come close for 25 seconds.', 3500);
}
const _near = [];
function updateFlares(dt) {
  let bright = null;
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i];
    f.t += dt;
    if (!f.landed) {
      f.vel.y -= 9.8 * dt;
      const next = f.pos.clone().addScaledVector(f.vel, dt);
      const g = groundAt(next.x, next.z, f.pos.y);
      let hitWall = false;
      for (const b of nearSolids(next.x, next.z, 0.05, _near)) if (next.x > b.x0 && next.x < b.x1 && next.z > b.z0 && next.z < b.z1 && next.y > b.y0 && next.y < b.y1 && b.y1 > f.pos.y + 0.05) hitWall = true;
      if (hitWall) { f.vel.x *= -0.3; f.vel.z *= -0.3; next.x = f.pos.x; next.z = f.pos.z; }
      if (next.y <= g + 0.02) { next.y = g + 0.02; f.vel.multiplyScalar(0.3); f.vel.y = Math.abs(f.vel.y) > 1 ? -f.vel.y * 0.3 : 0; if (f.vel.length() < 0.5) f.landed = true; }
      f.pos.copy(next);
      f.spin += dt * 12;
    }
    f.g.position.copy(f.pos);
    f.g.rotation.set(f.landed ? Math.PI / 2 : f.spin, 0, f.landed ? 0.3 : f.spin * 0.7);
    const life = 1 - f.t / FLARE_SECS;
    f.gl.scale.setScalar(1.2 + Math.random() * 0.6 * Math.max(0, life));
    f.gl.material.opacity = 1;
    // sparks
    const a = f.sparks.geometry.attributes.position;
    for (let k = 0; k < a.count; k++) {
      if (Math.random() < 0.15 || a.getY(k) > f.pos.y + 0.8) a.setXYZ(k, f.pos.x, f.pos.y + 0.05, f.pos.z);
      else a.setXYZ(k, a.getX(k) + (Math.random() - 0.5) * 0.03, a.getY(k) + 0.02, a.getZ(k) + (Math.random() - 0.5) * 0.03);
    }
    a.needsUpdate = true;
    if (f.t > FLARE_SECS) { scene.remove(f.g, f.sparks); flares.splice(i, 1); continue; }
    if (!bright || f.t < bright.t) bright = f;
  }
  if (bright) { flareLight.position.copy(bright.pos).y += 0.3; flareLight.intensity = (12 + Math.random() * 6) * Math.min(1, (FLARE_SECS - bright.t) / 3); }
  else flareLight.intensity = 0;
}

// ---------- wrist watch ----------
function drawWrist() {
  const x = wrist.x;
  x.clearRect(0, 0, 512, 256);
  x.fillStyle = 'rgba(8,10,14,0.92)';
  x.beginPath(); x.roundRect(4, 4, 504, 248, 28); x.fill();
  x.strokeStyle = S.red ? '#c02030' : '#3a4a60'; x.lineWidth = 6; x.stroke();
  x.textBaseline = 'middle'; x.textAlign = 'left';
  // lights / hunt
  x.font = 'bold 40px sans-serif';
  if (S.red) { x.fillStyle = '#ff4050'; x.fillText('🚨 RED NIGHT', 22, 44); }
  else if (S.battery > 0) {
    x.fillStyle = S.battery < 20 ? '#ff9040' : '#ffe8a0';
    x.fillText('🔦 ' + mmss(S.battery), 22, 44);
    x.fillStyle = '#222'; x.fillRect(250, 26, 230, 36);
    x.fillStyle = S.battery < 20 ? '#ff6030' : '#e0d070'; x.fillRect(254, 30, 222 * (S.battery / BATTERY_SECS), 28);
  } else { x.fillStyle = '#ff4050'; x.fillText('😈 IT IS HUNTING', 22, 44); }
  // survive timer
  x.fillStyle = '#e8e8e8'; x.font = 'bold 36px sans-serif';
  x.fillText((S.ghost ? '👻 ' : '⏱ ') + mmss(S.alive) + '   🏆 ' + mmss(S.best), 22, 104);
  // friend + voice
  const n = friends.list.size;
  x.fillStyle = n ? '#60e080' : S.link === 'bad' ? '#ff8060' : '#c0c080';
  x.fillText(n ? '🟢 Friend connected' : S.link === 'bad' ? '🔴 Reconnecting…' : '🟡 No friend yet', 22, 160);
  x.fillStyle = '#9ab'; x.font = 'bold 30px sans-serif';
  x.fillText(S.voice ? '🎙️' : '🔇', 440, 160);
  // hiding + flare
  x.font = 'bold 32px sans-serif';
  if (S.hideZone) {
    const smell = S.hideT > 30;
    x.fillStyle = smell ? '#ff7050' : '#90c0ff';
    x.fillText(smell ? '👃 It smells you! MOVE!' : '🫣 Hidden (' + Math.floor(40 - S.hideT) + 's)', 22, 215);
  } else {
    x.fillStyle = S.flares ? '#ff9060' : '#777';
    x.fillText(S.flares ? '🔥 Flare ready (trigger)' : '🔥 Flare in ' + Math.ceil(S.flareCd) + 's', 22, 215);
  }
  wrist.tex.needsUpdate = true;
  if (flat) {
    deskHud.innerHTML = (S.red ? '🚨 RED NIGHT' : S.battery > 0 ? '🔦 ' + mmss(S.battery) : '😈 HUNTING') +
      ' &nbsp; ⏱ ' + mmss(S.alive) + ' &nbsp; 🏆 ' + mmss(S.best) + '<br>' + (n ? '🟢 Friend connected' : '🟡 No friend yet') +
      ' &nbsp; ' + (S.hideZone ? (S.hideT > 30 ? '👃 It smells you!' : '🫣 Hidden') : S.flares ? '🔥 F = flare' : '🔥 ' + Math.ceil(S.flareCd) + 's');
  }
}

// ---------- secrets ----------
function onSquish() {
  S.squishes++;
  SFX.squish();
  const now = performance.now();
  S.squishTimes.push(now);
  S.squishTimes = S.squishTimes.filter((t) => now - t < 6000);
  if (S.squishTimes.length >= 7) found('golden', '🥇 Cricket smasher!');
}
const moonDir = new THREE.Vector3(-170, 190, -250).normalize();
let teddyAwake = 0;
function checkSecrets(dt, headDir, handPts) {
  if (headDir.dot(moonDir) > 0.97 && !S.ghost) S.moonT += dt; else S.moonT = Math.max(0, S.moonT - dt * 2);
  if (S.moonT > 8) found('moon', '🌙 The moon stares back…');
  for (const p of handPts) {
    if (secretSpots.musicBox && p.distanceTo(secretSpots.musicBox) < 0.35 && !S.secrets.has('musicbox')) { SFX.musicBox(secretSpots.musicBox); found('musicbox', '🎶 A music box…'); }
    if (secretSpots.phone && p.distanceTo(secretSpots.phone) < 0.3 && !S.secrets.has('phone')) { SFX.ringPhone(secretSpots.phone); found('phone', '☎️ Someone is calling…'); }
    if (secretSpots.teddy && p.distanceTo(secretSpots.teddy) < 0.3 && teddyAwake <= 0) {
      teddyAwake = 4; SFX.squeak();
      found('teddy', '🧸 Teddy is watching you.');
    }
  }
  if (city.teddy) {
    teddyAwake = Math.max(0, teddyAwake - dt);
    city.teddy.eyeM.color.setHex(teddyAwake > 0 ? 0xff1020 : 0x000000);
    city.teddy.g.rotation.y = teddyAwake > 0 ? Math.sin(performance.now() / 60) * 0.2 : 0;
  }
}

// ---------- lightning ----------
let boltT = 40, flashT = 0;
function lightning(dt) {
  boltT -= dt;
  if (boltT <= 0) { boltT = 45 + Math.random() * 60; flashT = 0.5; setTimeout(() => SFX.thunder(), 1200 + Math.random() * 1500); }
  flashT = Math.max(0, flashT - dt);
  const fl = flashT > 0.38 || (flashT > 0.12 && flashT < 0.22) ? 1 : 0;
  hemi.intensity = 0.9 + fl * 3.5;
  hemi.color.setHex(S.red ? 0x7a3040 : 0x46587e);
}

// ---------- PC test mode ----------
addEventListener('keydown', (e) => { mover.keys[e.code] = true; if (e.code === 'KeyF' && flat) throwFlare(null); });
addEventListener('keyup', (e) => { mover.keys[e.code] = false; });
addEventListener('mousemove', (e) => {
  if (!flat || !(document.pointerLockElement || e.buttons & 1)) return;
  mover.yaw -= e.movementX * 0.0025;
  mover.pitch = Math.max(-1.4, Math.min(1.4, mover.pitch - e.movementY * 0.0025));
  rig.rotation.y = mover.yaw;
  camera.rotation.x = mover.pitch;
});
renderer.domElement.addEventListener('click', () => { if (flat && !document.pointerLockElement) renderer.domElement.requestPointerLock?.(); });

// ---------- version check: a newer game on the site = reload (only when you're not in VR) ----------
async function checkVersion() {
  try {
    const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
    const v = (await r.text()).trim();
    if (v && v !== VERSION) {
      pendingReload = v;
      if (!renderer.xr.isPresenting && !entered) location.replace(location.pathname + '?v=' + v);
      else if (!S.updateSaid) { S.updateSaid = true; say('✨ A new update is ready! Take off your headset to get it.', 5000); }
    }
  } catch (e) {}
}
setInterval(checkVersion, 45000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
checkVersion();

// ---------- main loop ----------
const headPos = new THREE.Vector3(), headDir = new THREE.Vector3(), headQ = new THREE.Quaternion(), headUp = new THREE.Vector3();
let last = performance.now(), lastPose = 0, lastHud = 0;
let firstHost = true;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (net.myId) myId = net.myId;

  // you
  if (entered) { if (flat) mover.flatStep(dt); else mover.step(dt); }
  camera.getWorldPosition(headPos);
  camera.getWorldDirection(headDir);
  camera.getWorldQuaternion(headQ);
  headUp.set(0, 1, 0).applyQuaternion(headQ);

  // hands
  const handPts = [];
  for (const h of hands) {
    const g = gloves[h.i];
    g.visible = h.tracked && renderer.xr.isPresenting;
    if (!g.visible) continue;
    g.position.copy(h.pos);
    g.quaternion.copy(rig.quaternion).multiply(h.q);
    curl(g, h.gripV, h.trigV, dt);
    handPts.push(h.pos);
    // trigger throws a flare
    if (h.trigV > 0.8 && !h.trigLatch) { h.trigLatch = true; throwFlare(h); }
    if (h.trigV < 0.3) h.trigLatch = false;
  }
  if (flat) handPts.push(headPos.clone().addScaledVector(headDir, 0.6));

  // hiding
  const zone = entered && !S.ghost ? hideZoneAt(headPos) : null;
  if (zone !== S.hideZone) {
    S.hideZone = zone; S.hideT = 0;
    if (zone && S.hunting) say('🫣 You are hiding. It can\'t see you in here… for a while.', 3500);
  }
  if (zone) {
    S.hideT += dt;
    if (S.hideT > 30 && S.hideT - dt <= 30) say('👃 It can SMELL you! Find a new hiding spot!', 4000);
  }

  // host: rounds + monster brain
  if (amHost()) {
    if (!H.started) {
      H.started = true;
      if (S.rid >= 0 && !firstHost) {   // the old host left: carry on the same night
        H.rid = S.rid; H.t0 = now - S.el * 1000; H.red = S.red; H.screamed = S.hunting;
      } else startRound(now);
    }
    hostTick(now, dt, players(headPos, headDir));
  } else { H.started = false; firstHost = false; }

  // timers
  if (entered && !S.ghost) S.alive += dt;
  if (S.flareCd > 0) { S.flareCd -= dt; if (S.flareCd <= 0 && S.flares === 0) { S.flares = 1; say('🔥 Your flare is ready again! Pull the trigger to throw.', 3000); } }

  // headlight: on while the battery lasts (flickers when it's nearly dead)
  const bat = S.battery;
  let on = !S.ghost && (S.red || bat > 0);
  if (on && !S.red && bat < 12) on = Math.sin(now / 37) + Math.sin(now / 91) > -0.6 - bat / 12;
  S.lightOn = on;
  headlight.intensity = on ? (S.red ? 28 : 40) : 0;
  headlight.color.setHex(S.red ? 0xffb0a0 : 0xfff0d0);

  // the world
  const t = now / 1000;
  city.update(dt, t, headPos, S.red);
  sky.update(dt, t, headPos, S.red);
  mist.update(dt, headPos, S.red);
  crickets.update(dt, headPos, handPts, onSquish);
  updateFlares(dt);
  lightning(dt);
  parkLight.intensity = 10 * city.flick[0] * (S.red ? 0.6 : 1);
  parkLight.color.setHex(S.red ? 0xff3030 : 0xffd9a0);
  scene.fog.color.lerp(S.red ? FOG_RED : FOG, Math.min(1, dt * 2));
  scene.background.copy(scene.fog.color);

  // the Crawler
  crawler.show(dt, headPos, (p, front) => { if (p.distanceTo(headPos) < 45) SFX.step(p, front); });
  const cp = crawler.C.vis, dist = cp.distanceTo(headPos);
  SFX.tick(dt, cp, Math.max(0, Math.min(1, 1 - (dist - 4) / 26)), S.hunting, crawler.model.root.visible);

  // friends
  friends.update(dt, headPos);
  let nearest = null, nd = 1e9;
  for (const f of friends.list.values()) { const d = f.headP.distanceTo(headPos); if (d < nd && f.light && !f.ghost) { nd = d; nearest = f; } }
  if (nearest) {
    friendLamp.position.copy(nearest.headP);
    friendLamp.target.position.set(0, -0.25, -10).applyQuaternion(nearest.q).add(nearest.headP);
    friendLamp.intensity = 40;
  } else friendLamp.intensity = 0;
  if (friends.list.size !== S.wasFriends) {
    if (friends.list.size < S.wasFriends) { SFX.friendChime(false); say('🔴 Your friend left the city.', 3000); }
    S.wasFriends = friends.list.size; setStatus();
  }

  // send your pose 15 times a second
  if (net.myId && now - lastPose > 66) {
    lastPose = now;
    const L = hands[0].tracked ? hands[0].pos : headPos.clone().add(new THREE.Vector3(-0.2, -0.45, -0.1));
    const Rh = hands[1].tracked ? hands[1].pos : headPos.clone().add(new THREE.Vector3(0.2, -0.45, -0.1));
    const r3 = (v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
    net.send({ t: 'p', id: myId, n: myName, h: [...r3(headPos), ...headQ.toArray().map((v) => +v.toFixed(4))], l: r3(L), r: r3(Rh),
      g: S.ghost ? 1 : 0, lt: S.lightOn ? 1 : 0, hd: S.hideZone ? 1 : 0, ht: +S.hideT.toFixed(1), m: entered ? 0 : 1 });
  }

  checkSecrets(dt, headDir, handPts);

  // jumpscare + red flash
  if (S.scareT > 0) {
    S.scareT -= dt;
    scare.root.visible = S.scareT > 0;
    scare.root.position.x = (Math.random() - 0.5) * 0.03;
    scare.animate({ dt, spd: 0, hunting: true, jaw: 1, lookAt: headPos, rear: 0 });
  } else scare.root.visible = false;
  S.veil = Math.max(0, S.veil - dt * 0.7);
  veil.material.opacity = Math.max(S.veil * 0.75, S.ghost ? 0.12 : 0);
  veil.material.color.setHex(S.ghost ? 0x2040a0 : 0xff0020);

  SFX.setListener(headPos, headDir, headUp);
  if (now - lastHud > 200) { lastHud = now; drawWrist(); if (S.toast && now > S.toastUntil) { S.toast = ''; drawToast(); } }
  toast.m.material.opacity = S.toast ? Math.min(1, (S.toastUntil - now) / 400) : 0;
  renderer.render(scene, camera);
}

// ---------- start ----------
async function turnOnVoice() {
  if (S.voiceAsked) return;
  S.voiceAsked = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    net.setMic(stream);
    S.voice = true;
    $('mic').textContent = '🎙️ Voice chat is ON';
  } catch (e) {
    S.voiceAsked = false;
    hintEl.textContent = '🔇 Mic not allowed, so your friend can\'t hear you (you can still hear them).';
  }
}
function enterWorld() {
  entered = true;
  mover.teleport(new THREE.Vector3(SPAWN.x + (Math.random() - 0.5) * 3, 0.12, SPAWN.z));
  friends.replayAll();
  setTimeout(() => say('⌚ Look at your LEFT wrist: lights, timer and your friend. Slap the ground to run! 🦍', 6000), 800);
}
$('mic').onclick = () => turnOnVoice();
$('go').onclick = async () => {
  SFX.initSound();
  SFX.resumeSound();
  turnOnVoice();
  if (navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false))) {
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      await renderer.xr.setSession(session);
      ui.style.display = 'none';
      enterWorld();
      session.addEventListener('end', () => {
        entered = false;
        if (pendingReload) { location.replace(location.pathname + '?v=' + pendingReload); return; }
        ui.style.display = '';
      });
      return;
    } catch (e) {
      hintEl.textContent = '😬 Could not start VR: ' + e.message;
      return;
    }
  }
  flat = true;
  deskHud.style.display = 'block';
  camera.position.set(0, 0, 0);
  ui.style.display = 'none';
  enterWorld();
  // in PC mode the camera is the head: put it at eye height
  rig.position.y = 0.12 + EYE;
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Auto-join: starts right away, no codes or buttons
rig.position.set(SPAWN.x, 0.12, SPAWN.z);
net.start();
setStatus();
renderer.setAnimationLoop(frame);

// test hooks
window.__city = { S, H, crawler, mover, friends, net, rig, camera, scene, renderer, throwFlare, say, emit, hideZoneAt, flares };
