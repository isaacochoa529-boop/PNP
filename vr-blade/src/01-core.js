import * as THREE from 'three';
// ===== CORE: renderer, scene, camera rig, settings, sounds, little helpers =====
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _q1 = new Q();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);
const $ = id => document.getElementById(id);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // cheaper on Quest
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9a37a');
scene.fog = new THREE.Fog('#e9a37a', 40, 160);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 400);
camera.position.set(0, 1.65, 0);
const rig = new THREE.Group();          // the player: everything that moves together (camera + hands)
rig.add(camera); scene.add(rig);
rig.position.set(0, 0, 1.2);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---- settings (saved) ----
const SKINS = ['#f2cfb0', '#d9a37e', '#b87a52', '#8a5636', '#5c3a24'];
const SHIRTS = ['#c0392b', '#2f6fd6', '#2e9e5b', '#f0b429', '#7d3cc8', '#222428'];
const HAIRS = ['#1d120b', '#5a3417', '#c98a3a', '#e8d27a', '#b23a1e', '#d8d8d8'];
const SET = Object.assign({ move: 'stick', skin: SKINS[1], shirt: SHIRTS[0], hair: HAIRS[0] }, (() => { try { return JSON.parse(localStorage.getItem('bb-set')) || {}; } catch (e) { return {}; } })());
const saveSet = () => { try { localStorage.setItem('bb-set', JSON.stringify(SET)); } catch (e) {} };

const state = { mode: 'menu', t: 0, rips: 0, smashes: 0, rainbow: false };
const inVR = () => renderer.xr.isPresenting;

// ---- toast (stays up long enough to read: ~138 words per minute) ----
let toastT = 0;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.style.opacity = 1;
  const words = msg.split(/\s+/).length; toastT = Math.max(2, words / 2.3 + 1);
  if (typeof say3D === 'function' && inVR()) say3D(msg, toastT);
}
function stepToast(dt) { if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; } }

// ---- sounds (made with WebAudio, no files) ----
let AC = null, noiseBuf = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function noise(dur, freq, q, vol, type = 'lowpass', sweep = 0) {
  if (!AC) return; const t = AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rand(.7, 1.2);
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f).connect(g).connect(AC.destination); s.start(t, rand(0, .5)); s.stop(t + dur + .05);
}
function tone(f0, f1, dur, vol, type = 'sine') {
  if (!AC) return; const t = AC.currentTime;
  const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + .05);
}
const sfx = {
  rip() { noise(.45, 2200, 1.5, .7, 'bandpass', .25); noise(.25, 300, 1, .6); tone(140, 50, .3, .4, 'triangle'); this.crack(); },
  crack() { noise(.07, 4200, 2, .7, 'bandpass'); setTimeout(() => noise(.05, 2600, 3, .5, 'bandpass'), 35); tone(220, 70, .08, .3, 'square'); },
  squish() { noise(.18, 900, 3, .35, 'bandpass', .4); },
  splat() { noise(.12, 600, 1, .3); },
  thud(v = 1) { tone(rand(95, 125), 40, .2, .4 * v, 'sine'); noise(.1, rand(300, 520), 1, .25 * v); },
  crunch() { noise(.3, 3000, .8, .6, 'highpass'); noise(.25, 500, 2, .6, 'bandpass', .3); tone(90, 40, .25, .5, 'triangle'); },
  pop() { tone(500, 1400, .12, .3, 'sine'); },
  stretch(k) { tone(80 + k * 120, 60 + k * 90, .08, .05 + .08 * k, 'sawtooth'); },
  chime() { [0, .12, .24].forEach((d, i) => setTimeout(() => tone(660 * (1 + i * .25), 900 * (1 + i * .25), .4, .2), d * 1000)); },
  clang(v = 1, m = 1) { const f = m > 5 ? 380 : 1500; tone(f * rand(.9, 1.1), f * .7, .5, .18 * v, 'triangle'); tone(f * 2.7, f * 2, .3, .07 * v, 'sine'); noise(.08, 3500, 2, .3 * v, 'bandpass'); },
  slice() { noise(.16, 5200, 1.2, .45, 'highpass', .5); noise(.12, 1400, 2, .3, 'bandpass', .5); },
  whoosh(v = 1) { noise(.22, 700, 1.4, .18 * v, 'bandpass', 2.4); },
  click() { tone(900, 500, .06, .2, 'square'); },
};
