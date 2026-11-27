// Abandoned City: the game loop. Your body + hands, rounds, hiding, flares, HUD, secrets, auto-update.
import * as THREE from 'three';
import { buildCity, makeSky, makeMist, makeCrickets, SPAWN, HALF, hideZoneAt, secretSpots } from './city.js';
import { makeCrawler, buildCrawlerModel } from './crawler.js';
import * as SFX from './sound.js';
import { makeMonster, MONSTER_TYPES } from './monsters.js';
import { createNet } from './net.js';
import { createMover, EYE } from './move.js';
import { makeFriends } from './friends.js';
import { makeCreepy } from './creepy.js';
import { makeCar } from './car.js';
import { checkAdmin, makeAdminPanel } from './admin.js';
import { nearSolids, groundAt } from './city.js';

const VERSION = document.querySelector('meta[name="game-version"]')?.content || '0';
const BATTERY_SECS = 180;   // headlights last 3 minutes. Then the Crawler screams and hunts.
const RESTART_SECS = 6;     // pause after everyone is caught
const RED_CHANCE = 0.2;     // 1 in 5 nights is a RED NIGHT
const FLARE_SECS = 25, FLARE_RECHARGE = 75;
const SECRET_TOTAL = 7;

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
const FOG = new THREE.Color(0x080b13), FOG_RED = new THREE.Color(0x1c0508);
scene.background = FOG.clone();
scene.fog = new THREE.FogExp2(FOG.clone(), 0.03);
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
const creepy = makeCreepy(scene, SFX);
const car = makeCar(scene);
const D = { driving: false, relPos: new THREE.Vector3(), relYaw: 0, moverYaw0: 0, lastSend: 0, honks: [], laLa: false, near: false, latch: {}, hitCd: new Map(), tumbleT: 0 };

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
  wasFriends: 0, admin: false, boost: false, monster: false, noMain: false,
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

// ---------- extra monsters (spawned from the admin panel) ----------
const extras = [];   // { id, c }
function addExtra(id, tp, x, z, snap) {
  if (extras.some((e) => e.id === id) || extras.length >= 8) return;
  const c = MONSTER_TYPES.includes(tp) ? makeMonster(scene, tp) : makeCrawler(scene, { noLight: true });
  if (snap) c.applyRemote(snap); else c.reset(x, z);
  extras.push({ id, c, tp });
}
function clearExtras() { for (const e of extras) e.c.remove(); extras.length = 0; }
const allMonsters = () => { const l = []; if (crawler.model.root.visible) l.push(crawler); for (const e of extras) l.push(e.c); return l; };

const wispNearLate = () => { for (const ex of extras) if (ex.tp === 'wisp' && ex.c.C.vis.distanceTo(camera.getWorldPosition(_wv)) < 14) return true; return false; };
const _wv = new THREE.Vector3();
const buzz = (a, ms) => { for (const h of hands) { const ac = h.gp?.hapticActuators?.[0]; if (ac) try { ac.pulse(a, ms); } catch (e) {} } };
const shake = (p) => { const d = p.x === undefined ? 99 : Math.hypot(p.x - camera.position.x, p.z - camera.position.z); if (d < 20) buzz(Math.max(0.2, 1 - d / 20), 160); };

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
    else if (msg.t === 'car') {
      if (net.isHost) net.send(msg, from);
      if (msg.id === myId) return;
      if (msg.drv) { if (D.driving && msg.drv !== myId && msg.drv < myId) exitCar(); car.C.driver = msg.drv; car.C.driverSeen = performance.now(); }
      else if (car.C.driver === msg.id) car.C.driver = null;
      if (!D.driving) car.apply(msg);
    }
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
    case 'mfx': SFX.mfx(e.fx, p); if (e.fx === 'smash' || e.fx === 'stomp' || e.fx === 'drop') shake(p); break;
    // ----- admin-only events (ignored unless the sender says they're the admin) -----
    case 'spawnmon':
      if (!e.adm) break;
      if (e.main) { S.noMain = false; crawler.reset(e.x, e.z); } else addExtra(e.id, e.tp, e.x, e.z);
      if (!e.tp || e.tp === 'brute') SFX.roar(p); else if (e.tp === 'howler') SFX.mfx('howl2', p); else if (e.tp === 'wisp') SFX.mfx('wisp', p); else SFX.mfx('static', p);
      break;
    case 'rmmon':
      if (!e.adm) break;
      S.noMain = true; crawler.model.root.visible = false; clearExtras();
      break;
    case 'carspawn':
      if (!e.adm) break;
      if (D.driving) exitCar();
      car.place(e.x, e.z, e.yaw);
      SFX.honk();
      break;
    case 'shove':
      if (!e.adm || S.admin) break;   // only the admin can push, and nobody pushes the admin
      if (e.who === (myId || 'me') && !D.driving && !S.ghost) {
        for (const h of hands) { h.stuck = false; h.hold = false; h.cool = 0.6; }
        mover.vel.set(e.vx, 5.5, e.vz); mover.grounded = false; mover.wasStuck = false; mover.velBuf.length = 0;
        D.tumbleT = 1.5;
      }
      SFX.bonk();
      break;
    case 'splat': SFX.splat(p); for (const m of allMonsters()) if (!m.immune && Math.hypot(m.C.vis.x - e.x, m.C.vis.z - e.z) < 3) m.stun(8); if (e.by === myId || e.by === 'me') found('splat', '🥞 Pancake monster!'); break;
    case 'pop': SFX.hiss(p); break;
    case 'honk': SFX.honk(e.la); break;
    case 'bonk':
      if (e.who === (myId || 'me') && !D.driving && !S.ghost) {
        for (const h of hands) { h.stuck = false; h.hold = false; h.cool = 0.6; }
        mover.vel.set(e.vx * 0.7, 7.5, e.vz * 0.7); mover.grounded = false; mover.wasStuck = false; mover.velBuf.length = 0;
        D.tumbleT = 2;
      }
      SFX.bonk();
      break;
  }
}
function emit(e) {
  if (S.admin) e.adm = 1;
  net.send({ t: 'ev', ...e });
  onEvent(e, false);
}

function gotCaught() {
  if (S.ghost) return;
  exitCar();
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
  exitCar();
  S.noMain = false; clearExtras();
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
  H.screamed = false; H.restartAt = 0; H.caught.clear(); S.noMain = false;
  const p = crawler.spawnSpot(SPAWN);
  crawler.reset(p.x, p.z);
}
function applyWorld(m) {
  S.red = m.red; S.el = m.el; S.battery = m.bat; S.hunting = m.hunt;
  if (m.rid !== S.rid) { S.rid = m.rid; newRound(); }
  S.noMain = !m.m;
  if (m.m) crawler.applyRemote(m.m); else crawler.model.root.visible = false;
  if (m.x) {
    const ids = new Set(m.x.map((q) => q.id));
    for (const q of m.x) { const ex = extras.find((e) => e.id === q.id); if (ex) ex.c.applyRemote(q); else addExtra(q.id, q.tp, 0, 0, q); }
    for (let i = extras.length - 1; i >= 0; i--) if (!ids.has(extras[i].id)) { extras[i].c.remove(); extras.splice(i, 1); }
  }
}

function players(headPos, headDir) {
  const list = [];
  if (entered) list.push({ id: myId || 'me', pos: headPos.clone(), dir: headDir.clone(), hidden: !!S.hideZone, hideT: S.hideT, ghost: S.ghost || S.monster, mon: S.monster, light: S.lightOn });
  for (const f of friends.list.values()) {
    if (f.menu) continue;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(f.q);
    list.push({ id: f.id, pos: f.headP, dir, hidden: f.hidden, hideT: f.hideT || 0, ghost: f.ghost || f.mon || H.caught.has(f.id), mon: f.mon, light: f.light });
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
  const brain = (evs) => {
    for (const e of evs) {
      if (e.k === 'catch') {
        if (H.caught.has(e.who)) continue;
        H.caught.add(e.who);
        emit({ k: 'catch', who: e.who });
      } else emit(e);
    }
  };
  if (!S.noMain) brain(crawler.update(dt, now, { players: list, hunting, red: H.red, lights, flares: fl }));
  for (const ex of extras) brain(ex.c.update(dt, now, { players: list, hunting: true, red: false, lights, flares: fl }));
  // everyone caught (and someone was playing)? new night soon
  const real = list.filter((p) => !p.mon);
  if (real.length && !H.restartAt && real.every((p) => p.ghost)) H.restartAt = now + RESTART_SECS * 1000;
  if (S.rid !== H.rid) { S.rid = H.rid; newRound(); }
  if (now - H.lastW > 100) {
    H.lastW = now;
    net.send({ t: 'w', rid: H.rid, el: +el.toFixed(2), red: H.red, bat: +bat.toFixed(1), hunt: hunting, m: S.noMain ? null : crawler.snapshot(), x: extras.map((e) => ({ id: e.id, tp: e.tp, ...e.c.snapshot() })) });
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
  if (S.flares <= 0 || S.ghost || !entered || D.driving || S.monster || adminPanel.open) return;
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
  } else if (S.monster) {
    x.fillStyle = '#ff5060'; x.fillText('🦖 YOU ARE THE MONSTER', 22, 215);
  } else if (D.driving) {
    x.fillStyle = '#ffd21a'; x.fillText('🚗 TRIGGER gas · B = get out', 22, 215);
  } else if (D.near) {
    x.fillStyle = '#ffd21a'; x.fillText('🚗 Press A or X to drive!', 22, 215);
  } else {
    x.fillStyle = S.flares ? '#ff9060' : '#777';
    x.fillText(S.flares ? '🔥 Flare ready (trigger)' : '🔥 Flare in ' + Math.ceil(S.flareCd) + 's', 22, 215);
  }
  wrist.tex.needsUpdate = true;
  if (flat) {
    deskHud.innerHTML = (S.red ? '🚨 RED NIGHT' : S.battery > 0 ? '🔦 ' + mmss(S.battery) : '😈 HUNTING') +
      ' &nbsp; ⏱ ' + mmss(S.alive) + ' &nbsp; 🏆 ' + mmss(S.best) + '<br>' + (n ? '🟢 Friend connected' : '🟡 No friend yet') +
      ' &nbsp; ' + (S.hideZone ? (S.hideT > 30 ? '👃 It smells you!' : '🫣 Hidden') : (D.driving ? '🚗 W/S drive, A/D steer, H honk, E get out' : D.near ? '🚗 E = drive' : S.flares ? '🔥 F = flare' : '🔥 ' + Math.ceil(S.flareCd) + 's'));
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
    if (secretSpots.roofDoll && p.distanceTo(secretSpots.roofDoll) < 0.35 && !S.secrets.has('roofdoll')) { SFX.giggle(secretSpots.roofDoll); found('roofdoll', '🪆 How did the doll get up here?'); }
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
  hemi.intensity = 0.6 + fl * 3.5;
  hemi.color.setHex(S.red ? 0x7a3040 : 0x46587e);
}

// ---------- PC test mode ----------
addEventListener('keydown', (e) => {
  mover.keys[e.code] = true;
  if (!flat || e.repeat) return;
  if (e.code === 'KeyF') throwFlare(null);
  if (S.admin) {
    if (e.code === 'KeyP') adminPanel.toggle(headPos, headDir, true);
    else if (adminPanel.open && e.key >= '1' && e.key <= '4') adminPanel.key(+e.key);
    else if (adminPanel.open && (e.key === '[' || e.key === ']')) adminPanel.key(e.key);
  }
  if (e.code === 'KeyE') { if (D.driving) exitCar(); else tryEnterCar(); }
  if (e.code === 'KeyH' && D.driving) honk();
});
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

// ---------- the goofy car 🚗 ----------
const _cv = new THREE.Vector3(), _cv2 = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
function carMatrix() { return new THREE.Matrix4().compose(new THREE.Vector3(car.C.x, 0, car.C.z), new THREE.Quaternion().setFromAxisAngle(UPV, car.C.yaw), new THREE.Vector3(1, 1, 1)); }
function tryEnterCar() {
  if (D.driving || S.ghost || !entered) return;
  if (car.C.driver && car.C.driver !== myId && performance.now() - car.C.driverSeen < 2000) { SFX.honk(); return; }
  camera.getWorldPosition(_cv);
  if (Math.hypot(_cv.x - car.C.x, _cv.z - car.C.z) > 3.2) return;
  D.driving = true;
  car.C.driver = myId || 'me';
  car.C.spd = 0;
  // put your head on the driver's seat, facing forward
  const turn = car.C.yaw + Math.PI - rig.rotation.y - Math.atan2(-camera.getWorldDirection(_cv2).x, -_cv2.z) + rig.rotation.y;
  rig.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn));
  rig.updateMatrixWorld();
  camera.getWorldPosition(_cv);
  car.seatWorld(_cv2);
  rig.position.add(_cv2.sub(_cv));
  D.relPos.copy(rig.position).applyMatrix4(carMatrix().invert());
  D.relYaw = rig.rotation.y - car.C.yaw;
  D.moverYaw0 = mover.yaw = rig.rotation.y;
  SFX.honk();
}
function exitCar() {
  if (!D.driving) return;
  D.driving = false;
  car.C.driver = null;
  car.C.spd = 0;
  mover.teleport(car.doorWorld(_cv).setY(0.15));
  if (flat) mover.yaw = rig.rotation.y;
  if (net.myId) net.send({ t: 'car', id: myId, drv: null, ...car.state() });
}
function btn(side, i) {
  const h = hands.find((q) => q.side === side && q.gp);
  const b = h && h.gp.buttons[i];
  return !!(b && b.pressed);
}
function edge(key, now) { const was = D.latch[key]; D.latch[key] = now; return now && !was; }
function honk() {
  const t = performance.now();
  D.honks.push(t); D.honks = D.honks.filter((x) => t - x < 5000);
  if (D.honks.length >= 10 && !D.laLa) { D.laLa = true; found('horn', '🎺 The horn learned a new song…'); }
  emit({ k: 'honk', la: D.laLa ? 1 : 0 });
}
function carButtons() {
  if (flat) return;
  const ax = edge('ax', btn('right', 4) || btn('left', 4)), by = edge('by', btn('right', 5) || btn('left', 5));
  if (D.driving) { if (by) exitCar(); else if (ax) honk(); }
  else if (ax && D.near) tryEnterCar();
}
function driveTick(dt, now) {
  if (!flat) mover.handsOnly(dt);
  const inp = { gas: 0, brake: 0, steer: 0 };
  if (flat) {
    const k = mover.keys;
    inp.gas = k.KeyW ? 1 : 0; inp.brake = k.KeyS ? 1 : 0; inp.steer = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  } else {
    const L = hands.find((h) => h.side === 'left' && h.gp), R = hands.find((h) => h.side === 'right' && h.gp);
    inp.gas = R ? R.trigV : 0; inp.brake = L ? L.trigV : 0;
    if (L && L.gp.axes.length >= 4 && Math.abs(L.gp.axes[2]) > 0.15) inp.steer = L.gp.axes[2];
    if (L && R && L.gripV > 0.5 && R.gripV > 0.5) {   // both hands on the wheel: turn it like a real one
      const dy = R.pos.y - L.pos.y, dx = Math.hypot(R.pos.x - L.pos.x, R.pos.z - L.pos.z);
      inp.steer = Math.max(-1, Math.min(1, -Math.atan2(dy, dx) * 1.6));
    }
  }
  if (car.drive(dt, inp)) { SFX.crash(); for (const h of hands) { const a = h.gp?.hapticActuators?.[0]; if (a) try { a.pulse(0.8, 120); } catch (e) {} } }
  // you ride along
  rig.position.copy(D.relPos).applyMatrix4(carMatrix());
  rig.rotation.y = car.C.yaw + D.relYaw + (flat ? mover.yaw - D.moverYaw0 : 0);
  if (flat) camera.rotation.x = mover.pitch;
  // run stuff over!
  const [fx, fz] = car.fwd(), sp = Math.abs(car.C.spd);
  const bx = car.C.x + fx * 1.3 * Math.sign(car.C.spd || 1), bz = car.C.z + fz * 1.3 * Math.sign(car.C.spd || 1);
  if (sp > 3) for (const m of allMonsters()) {
    const c = m.C.vis;
    if (!m.immune && m.C.stunT <= 0 && Math.hypot(c.x - bx, c.z - bz) < 2.1 && Math.abs(c.y) < 1.5) {
      m.stun(8);   // only for the one hit; the others keep chasing
      emit({ k: 'splat', x: c.x, y: c.y, z: c.z, by: myId || 'me' });
    }
  }
  for (const f of friends.list.values()) {
    if (f.ghost || f.menu) continue;
    if ((D.hitCd.get(f.id) || 0) > now) continue;
    if (Math.hypot(f.headP.x - bx, f.headP.z - bz) < 1.7) {
      D.hitCd.set(f.id, now + 2000);
      emit({ k: 'bonk', who: f.id, vx: fx * car.C.spd, vz: fz * car.C.spd });
    }
  }
  if (net.myId && now - D.lastSend > 66) { D.lastSend = now; net.send({ t: 'car', id: myId, drv: myId, ...car.state() }); }
}
function carShow(dt, now) {
  if (car.C.driver && car.C.driver !== (myId || 'me') && now - (car.C.driverSeen || 0) > 2500) car.C.driver = null;
  car.show(dt, D.driving);
  D.near = entered && !D.driving && !S.ghost && Math.hypot(headPos.x - car.C.x, headPos.z - car.C.z) < 3.2;
  D.tumbleT = Math.max(0, D.tumbleT - dt);
  SFX.engine({ x: car.C.x, z: car.C.z }, car.C.spd, !!car.C.driver);
}

// ---------- 👑 admin (only you, the owner) ----------
const adminCtx = {
  S,
  toggleBoost() { S.boost = !S.boost; adminPanel.say(S.boost ? '🚀 Zoom!' : 'Boost off'); },
  spawnCar() {
    const fw = camera.getWorldDirection(new THREE.Vector3()); fw.y = 0; fw.normalize();
    const x = Math.max(-HALF + 4, Math.min(HALF - 4, headPos.x + fw.x * 6)), z = Math.max(-HALF + 4, Math.min(HALF - 4, headPos.z + fw.z * 6));
    emit({ k: 'carspawn', x, z, yaw: Math.atan2(fw.x, fw.z) + Math.PI / 2 });
    adminPanel.say('🚗 Car spawned!');
  },
  spawnMonster(tp) {
    const fw = camera.getWorldDirection(new THREE.Vector3()); fw.y = 0; fw.normalize();
    const x = Math.max(-HALF + 4, Math.min(HALF - 4, headPos.x + fw.x * 22)), z = Math.max(-HALF + 4, Math.min(HALF - 4, headPos.z + fw.z * 22));
    if (!tp && S.noMain) emit({ k: 'spawnmon', main: 1, x, z });
    else if (extras.length >= 8) { adminPanel.say('Max 8 extra monsters'); return; }
    else emit({ k: 'spawnmon', id: 'x' + Date.now(), tp: tp || 'crawler', x, z });
    adminPanel.say('😈 Monster spawned!');
  },
  removeMonsters() { emit({ k: 'rmmon' }); adminPanel.say('🧹 All monsters gone'); },
  toggleMonster() {
    S.monster = !S.monster;
    if (S.monster) { exitCar(); say('🦖 You are the monster!'); }
    adminPanel.say(S.monster ? '🦖 You are the monster! Catch your friend!' : 'Back to human');
  },
};
const adminPanel = makeAdminPanel(scene, camera, adminCtx);
checkAdmin().then((ok) => { S.admin = ok; if (ok) { hintEl.textContent = '👑 Admin mode is ON. Click your LEFT thumbstick to open the panel.'; console.log('admin on'); } });
const shoveCd = new Map();
function adminFrame(dt, now) {
  mover.boost = (S.boost || S.monster) ? 1.6 : 1;
  if (!S.admin || !entered) return;
  adminPanel.update(headPos);
  if (!flat) {
    const L = hands.find((h) => h.side === 'left' && h.gp);
    if (edge('stick', !!(L && L.gp.buttons[3] && L.gp.buttons[3].pressed))) adminPanel.toggle(headPos, headDir, false);
    for (const h of hands) if (h.tracked) adminPanel.poke(h.i, h.pos);
  }
  // PUSH: only the admin can shove people. Swing a hand into your friend.
  for (const f of friends.list.values()) {
    if (f.ghost || f.menu || (shoveCd.get(f.id) || 0) > now) continue;
    let from = null, sp = 0;
    if (flat) { if (mover.keys.KeyX && f.headP.distanceTo(headPos) < 3) { from = headPos; sp = 5; } }
    else for (const h of hands) { if (h.tracked && h.vel.length() > 1.4 && h.pos.distanceTo(_cv.set(f.headP.x, f.headP.y - 0.3, f.headP.z)) < 0.55) { from = h.pos; sp = h.vel.length(); break; } }
    if (!from) continue;
    shoveCd.set(f.id, now + 1500);
    const dx = f.headP.x - from.x, dz = f.headP.z - from.z, d = Math.hypot(dx, dz) || 1, k = Math.min(9, 3 + sp * 1.2);
    emit({ k: 'shove', who: f.id, vx: dx / d * k, vz: dz / d * k });
  }
  // MONSTER MODE: touch your friend and they're caught
  if (S.monster) for (const f of friends.list.values()) {
    if (f.ghost || f.menu || (shoveCd.get('c' + f.id) || 0) > now) continue;
    if (Math.hypot(f.headP.x - headPos.x, f.headP.z - headPos.z) < 1.5 && Math.abs(f.headP.y - headPos.y) < 1.8) {
      shoveCd.set('c' + f.id, now + 3000);
      emit({ k: 'catch', who: f.id });
    }
  }
}

// ---------- main loop ----------
const headPos = new THREE.Vector3(), headDir = new THREE.Vector3(), headQ = new THREE.Quaternion(), headUp = new THREE.Vector3();
let last = performance.now(), lastPose = 0, lastHud = 0;
let firstHost = true;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (net.myId) myId = net.myId;

  // you
  if (entered) { if (D.driving) driveTick(dt, now); else if (flat) mover.flatStep(dt); else mover.step(dt); }
  if (entered) carButtons();
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
  // your lamp stutters when it is close
  if (on && crawler.model.root.visible && crawler.C.vis.distanceTo(headPos) < 14 && Math.random() < 0.12) on = false;
  if (S.monster) on = false;   // monsters don't need a lamp
  if (on && wispNearLate()) on = Math.random() < 0.08;   // the Wisp drinks your light
  S.lightOn = on;
  headlight.intensity = on ? (S.red ? 28 : 40) : 0;
  headlight.color.setHex(S.red ? 0xffb0a0 : 0xfff0d0);

  // the world
  const t = now / 1000;
  let cDist = 999, cNear = crawler.C.vis;
  for (const m of allMonsters()) { const d = m.C.vis.distanceTo(headPos); if (d < cDist) { cDist = d; cNear = m.C.vis; } }
  let wispNear = false;
  for (const ex of extras) if (ex.tp === 'wisp' && ex.c.C.vis.distanceTo(headPos) < 14) wispNear = true;
  const dread = Math.max(wispNear ? 0.95 : 0, cDist < 999 ? Math.max(0, Math.min(1, 1 - (cDist - 6) / 22)) : 0);
  city.update(dt, t, headPos, S.red, dread);
  if (entered) creepy.update(dt, { head: headPos, dir: headDir, hunting: S.hunting, crawlerDist: cDist, ghost: S.ghost });
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
  carShow(dt, now);
  adminFrame(dt, now);
  const stepFx = (p, front, tp) => {
    if (p.distanceTo(headPos) >= 45) return;
    if (tp === 'brute') { SFX.mfx('stomp', p); if (p.distanceTo(headPos) < 14) buzz(0.7, 90); } else SFX.step(p, front);
  };
  crawler.show(dt, headPos, stepFx);
  for (const ex of extras) ex.c.show(dt, headPos, stepFx);
  SFX.tick(dt, cNear, Math.max(0, Math.min(1, 1 - (cDist - 4) / 26)), S.hunting || extras.length > 0, cDist < 999);

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
    net.send({ t: 'p', id: myId, n: myName, h: [...r3(headPos), ...headQ.toArray().map((v) => +v.toFixed(4))], l: r3(L), r: r3(Rh), gp: [+(hands[0].gripV || 0).toFixed(2), +(hands[1].gripV || 0).toFixed(2)],
      g: S.ghost ? 1 : 0, mo: S.monster ? 1 : 0, tb: D.tumbleT > 0 ? 1 : 0, lt: S.lightOn ? 1 : 0, hd: S.hideZone ? 1 : 0, ht: +S.hideT.toFixed(1), m: entered ? 0 : 1 });
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
window.__city = { adminPanel, adminCtx, extras, car, D, tryEnterCar, exitCar, S, H, crawler, mover, friends, net, rig, camera, scene, renderer, throwFlare, say, emit, hideZoneAt, flares };
