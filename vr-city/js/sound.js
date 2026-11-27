// Sounds: all made with the Web Audio API (no sound files to download).
// 3D sounds use HRTF panners, so you can hear WHERE the Crawler is. Wear headphones (or the Quest speakers).
let ctx = null, master = null, verb = null, noiseBuf = null, amb = null;
let danger = 0;            // 0 = safe, 1 = it's right next to you (crickets go quiet, heart beats)
let breath = null;         // the Crawler's breathing, follows it around
let heartT = 0, cricketT = 0, howlT = 30;

export function initSound() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // a big echo for the empty streets
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.35;
    verb.connect(vg); vg.connect(master);
    startAmbience();
    startBreath();
  } catch (e) { ctx = null; }
}
export function resumeSound() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
export const ready = () => !!ctx;

export function setListener(pos, fwd, up) {
  if (!ctx) return;
  const l = ctx.listener;
  if (l.positionX) {
    const t = ctx.currentTime;
    l.positionX.setTargetAtTime(pos.x, t, 0.02); l.positionY.setTargetAtTime(pos.y, t, 0.02); l.positionZ.setTargetAtTime(pos.z, t, 0.02);
    l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
    l.upX.value = up.x; l.upY.value = up.y; l.upZ.value = up.z;
  } else if (l.setPosition) { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
}

function spot(pos, ref = 4, roll = 1.1, wet = 0) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
  p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 400;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 0.5; p.positionZ.value = pos.z; }
  else p.setPosition(pos.x, pos.y ?? 0.5, pos.z);
  p.connect(master);
  if (wet) { const g = ctx.createGain(); g.gain.value = wet; p.connect(g); g.connect(verb); }
  return p;
}
function noise(dest, t, dur, freq, gain, type = 'lowpass', q = 1) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(dest);
  n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
  return f;
}
function tone(dest, t, dur, f0, f1, gain, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
  return o;
}

// ---------- background: wind, crickets, a far-off howl ----------
function startAmbience() {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0.05;
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 0.07; lg.gain.value = 220;
  lfo.connect(lg); lg.connect(f.frequency);
  n.connect(f); f.connect(g); g.connect(master);
  n.start(); lfo.start();
  // a low drone that rises when it's close
  const o = ctx.createOscillator(), og = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = 43;
  const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 120;
  og.gain.value = 0.0;
  o.connect(of); of.connect(og); og.connect(master);
  o.start();
  amb = { wind: g, drone: og };
}
function chirp(t, vol, pan) {
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; p.connect(master); }
  for (let k = 0; k < 4; k++) {
    const s = t + k * 0.075;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 4200 + Math.random() * 300;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(vol, s + 0.01);
    g.gain.linearRampToValueAtTime(0, s + 0.04);
    o.connect(g); g.connect(p || master);
    o.start(s); o.stop(s + 0.05);
  }
}
function startBreath() {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2;
  const g = ctx.createGain(); g.gain.value = 0;
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.4;
  n.connect(f); f.connect(g); g.connect(p); p.connect(master);
  n.start();
  breath = { g, f, p, t: 0 };
}

// call every frame: crawler world position, how close (0..1), is it hunting
export function tick(dt, crawlerPos, d01, hunting, visible) {
  if (!ctx || ctx.state !== 'running') return;
  danger += (d01 - danger) * Math.min(1, dt * 2);
  const t = ctx.currentTime;
  // crickets go quiet when it's near. That's your warning!
  cricketT -= dt;
  if (cricketT <= 0) {
    cricketT = 0.35 + Math.random() * 0.8;
    const vol = 0.022 * (1 - Math.min(1, danger * 1.6));
    if (vol > 0.002) chirp(t + 0.02, vol * (0.4 + Math.random() * 0.6), Math.random() * 2 - 1);
  }
  howlT -= dt;
  if (howlT <= 0) { howlT = 50 + Math.random() * 60; howl(); }
  amb.drone.gain.setTargetAtTime(0.06 * danger + (hunting ? 0.02 : 0), t, 0.5);
  // breathing: in, out, in, out, wet and raspy
  if (breath && crawlerPos) {
    const p = breath.p;
    if (p.positionX) { p.positionX.setTargetAtTime(crawlerPos.x, t, 0.05); p.positionY.setTargetAtTime(crawlerPos.y + 1, t, 0.05); p.positionZ.setTargetAtTime(crawlerPos.z, t, 0.05); }
    else p.setPosition(crawlerPos.x, crawlerPos.y + 1, crawlerPos.z);
    breath.t += dt * (hunting ? 1.6 : 0.7);
    const b = Math.max(0, Math.sin(breath.t * Math.PI));
    breath.g.gain.setTargetAtTime(visible ? b * (hunting ? 0.5 : 0.25) : 0, t, 0.08);
    breath.f.frequency.setTargetAtTime(hunting ? 900 : 550 + b * 200, t, 0.1);
  }
  // heartbeat when it's close
  heartT -= dt;
  if (danger > 0.25 && heartT <= 0) {
    heartT = 1.0 - danger * 0.55;
    const v = 0.25 + danger * 0.5;
    tone(master, t, 0.12, 70, 40, v); tone(master, t + 0.16, 0.12, 60, 35, v * 0.7);
  }
}

function howl() {
  const t = ctx.currentTime, p = spot({ x: (Math.random() - 0.5) * 600, y: 5, z: (Math.random() - 0.5) * 600 }, 60, 1, 0.8);
  const o = tone(p, t, 3.5, 380, 300, 0.12, 'triangle');
  o.frequency.setValueAtTime(380, t); o.frequency.linearRampToValueAtTime(620, t + 1.2); o.frequency.linearRampToValueAtTime(420, t + 3.4);
}

// ---------- the Crawler ----------
// claws clicking + a soft heavy thump for each hand/foot
export function step(pos, front) {
  if (!ctx) return;
  const p = spot(pos, 3, 1.15, 0.15), t = ctx.currentTime;
  noise(p, t, 0.035, 3500, front ? 0.5 : 0.3, 'highpass');
  if (front) noise(p, t + 0.03, 0.03, 4200, 0.3, 'highpass');
  tone(p, t, 0.18, 80, 35, front ? 0.55 : 0.35);
}
// The creepy kid "la la la". Different little tunes.
const TUNES = [[659, 587, 523], [523, 659, 523, 440], [784, 659, 784, 659], [440, 466, 440, 415, 392], [587, 587, 523, 494]];
export function sing(pos) {
  if (!ctx) return;
  const p = spot(pos, 6, 0.9, 0.9), t0 = ctx.currentTime + 0.05;
  const tune = TUNES[Math.floor(Math.random() * TUNES.length)], slow = 0.38 + Math.random() * 0.12;
  tune.forEach((f, i) => {
    const t = t0 + i * slow;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.94, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.08);
    o.frequency.linearRampToValueAtTime(f * (i === tune.length - 1 ? 0.88 : 0.98), t + slow * 0.9);
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    vib.frequency.value = 5.5; vg.gain.value = f * 0.012;
    vib.connect(vg); vg.connect(o.frequency);
    // "l" then "aah" formants (a child's voice)
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.setValueAtTime(0.45, t + slow * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + slow * 0.95);
    for (const [fr, q, amp] of [[1000, 6, 1], [1600, 8, 0.5], [3200, 10, 0.25]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(fr * 0.45, t); bp.frequency.linearRampToValueAtTime(fr, t + 0.07);
      const ag = ctx.createGain(); ag.gain.value = amp;
      o.connect(bp); bp.connect(ag); ag.connect(g);
    }
    g.connect(p);
    vib.start(t); vib.stop(t + slow);
    o.start(t); o.stop(t + slow);
  });
}
export function hiss(pos) {
  if (!ctx) return;
  const p = spot(pos, 4, 1, 0.3), t = ctx.currentTime;
  noise(p, t, 0.9, 5000, 0.5, 'highpass');
  tone(p, t, 0.6, 300, 120, 0.2, 'sawtooth');
}
export function roar(pos) {
  if (!ctx) return;
  const p = spot(pos, 8, 0.9, 0.7), t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain(), ws = ctx.createWaveShaper();
  const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); }
  ws.curve = curve;
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(90, t + 0.6); o.frequency.exponentialRampToValueAtTime(600, t + 1.0); o.frequency.exponentialRampToValueAtTime(200, t + 1.8);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
  o.connect(ws); ws.connect(g); g.connect(p);
  o.start(t); o.stop(t + 2);
  noise(p, t + 0.6, 1.2, 2200, 0.5, 'bandpass', 1.5);
}
export function lunge(pos) {
  if (!ctx) return;
  const p = spot(pos, 4, 1, 0.3), t = ctx.currentTime;
  tone(p, t, 0.5, 1400, 500, 0.35, 'sawtooth');
  noise(p, t, 0.4, 3000, 0.4, 'bandpass', 2);
}
export function climb(pos) {
  if (!ctx) return;
  const p = spot(pos, 3, 1, 0.2), t = ctx.currentTime;
  for (let i = 0; i < 6; i++) noise(p, t + i * 0.17, 0.09, 2500 + Math.random() * 2000, 0.4, 'bandpass', 3);
}
// Everyone hears this when the headlights die and the hunt starts
export function scream() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [f0, f1, v] of [[1100, 260, 0.45], [1170, 240, 0.3], [560, 140, 0.3]]) tone(master, t, 2.6, f0, f1, v, 'sawtooth');
  noise(master, t, 2.3, 2500, 0.4, 'bandpass', 0.8);
  const g = ctx.createGain(); g.gain.value = 1; g.connect(verb);
  tone(g, t, 2.6, 1100, 260, 0.5, 'sawtooth');
}
// right in your face
export function jumpscare() {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [f0, f1, v] of [[1600, 400, 0.6], [1650, 380, 0.5], [800, 200, 0.5], [90, 40, 0.9]]) tone(master, t, 1.4, f0, f1, v, f0 < 100 ? 'sine' : 'sawtooth');
  noise(master, t, 1.2, 3000, 0.9, 'bandpass', 0.7);
}

// ---------- you + the world ----------
export function hit(speed) {   // your hand slaps a surface
  if (!ctx) return;
  const t = ctx.currentTime, v = Math.min(0.35, 0.05 + speed * 0.06);
  noise(master, t, 0.06, 900 + speed * 300, v);
  tone(master, t, 0.07, 160, 70, v * 0.8);
}
export function land() { if (!ctx) return; const t = ctx.currentTime; noise(master, t, 0.12, 400, 0.3); tone(master, t, 0.15, 90, 40, 0.3); }
export function squish() {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(master, t, 0.15, 800, 0.6);
  tone(master, t, 0.14, 140, 40, 0.4);
}
export function chime() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [660, 880, 1320].forEach((f, i) => tone(master, t0 + i * 0.12, 0.6, f, f, 0.3, 'triangle'));
}
export function friendChime(joined) {
  if (!ctx) return;
  const t0 = ctx.currentTime, notes = joined ? [523, 659, 784, 1046] : [784, 659, 523];
  notes.forEach((f, i) => tone(master, t0 + i * 0.1, 0.4, f, f, 0.22, 'sine'));
}
export function thunder() {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(master, t, 0.25, 3000, 0.5);
  noise(master, t + 0.05, 4.5, 180, 0.7);
  noise(verb, t + 0.1, 3.5, 300, 0.6);
}
export function flareLight(pos) {
  if (!ctx) return;
  const p = spot(pos, 3, 1), t = ctx.currentTime;
  noise(p, t, 0.6, 4000, 0.6, 'highpass');
  noise(p, t + 0.1, 2.5, 1500, 0.15, 'bandpass', 0.7);
}
export function ringPhone(pos) {
  if (!ctx) return;
  const p = spot(pos, 3, 1, 0.4), t0 = ctx.currentTime;
  for (let r = 0; r < 2; r++) for (let i = 0; i < 20; i++) {
    const t = t0 + r * 1.4 + i * 0.05;
    tone(p, t, 0.045, 1200, 1200, 0.15, 'square'); tone(p, t, 0.045, 1600, 1600, 0.1, 'square');
  }
  // then a whisper: "la... la... la..."
  for (let i = 0; i < 3; i++) noise(p, t0 + 3 + i * 0.6, 0.4, 2500, 0.25, 'bandpass', 4);
}
export function musicBox(pos) {
  if (!ctx) return;
  const p = spot(pos, 3, 1, 0.6), t0 = ctx.currentTime;
  [659, 587, 523, 587, 659, 659, 659, 0, 587, 587, 587, 0, 659, 784, 784].forEach((f, i) => {
    if (!f) return;
    const t = t0 + i * 0.28 * (1 + i * 0.03);   // slowing down, like it's winding out
    tone(p, t, 0.9, f * 2, f * 2, 0.18, 'sine'); tone(p, t, 0.5, f * 4, f * 4, 0.05, 'sine');
  });
}
export function squeak() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = tone(master, t, 0.35, 900, 1400, 0.25, 'triangle');
  o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1500, t + 0.15); o.frequency.linearRampToValueAtTime(1100, t + 0.33);
}

// ---------- creepy extras ----------
// a breathy whisper from somewhere near you (shaped noise that sounds like "sss... hhh...")
export function whisper(pos) {
  if (!ctx) return;
  const p = spot(pos, 2, 1.3, 0.5), t0 = ctx.currentTime;
  const n = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * (0.16 + Math.random() * 0.12);
    noise(p, t, 0.12 + Math.random() * 0.15, 2000 + Math.random() * 2500, 0.18, 'bandpass', 5 + Math.random() * 6);
  }
}
// old wood creaking
export function creak(pos) {
  if (!ctx) return;
  const p = spot(pos, 4, 1, 0.6), t = ctx.currentTime, dur = 0.8 + Math.random() * 0.8;
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70 + Math.random() * 40, t);
  o.frequency.linearRampToValueAtTime(110 + Math.random() * 60, t + dur);
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 18 + Math.random() * 12; lg.gain.value = 25;
  lfo.connect(lg); lg.connect(o.frequency);
  f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(p);
  o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
}
// a little kid giggling far away
export function giggle(pos) {
  if (!ctx) return;
  const p = spot(pos, 6, 1, 0.9), t0 = ctx.currentTime;
  for (let i = 0; i < 5; i++) {
    const t = t0 + i * 0.13, f = 700 - i * 40;
    const o = tone(p, t, 0.1, f, f * 0.8, 0.18, 'triangle');
    void o;
    noise(p, t, 0.08, 3000, 0.05, 'bandpass', 3);
  }
}
// a door slamming somewhere in the city
export function slam(pos) {
  if (!ctx) return;
  const p = spot(pos, 10, 1, 1.0), t = ctx.currentTime;
  tone(p, t, 0.4, 120, 40, 0.8);
  noise(p, t, 0.25, 900, 0.7);
}
// a quiet low "la... la..." that comes from very far away (it's out there somewhere)
export function farSing(pos) { sing(pos); }

// ---------- the goofy car ----------
export function honk(laLa = false) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (laLa) { [659, 587, 523].forEach((f, i) => { tone(master, t + i * 0.22, 0.2, f, f, 0.25, 'square'); tone(master, t + i * 0.22, 0.2, f * 1.26, f * 1.26, 0.15, 'square'); }); return; }
  tone(master, t, 0.35, 392, 380, 0.3, 'square'); tone(master, t, 0.35, 494, 480, 0.2, 'square');
}
export function splat(pos) {
  if (!ctx) return;
  const p = spot(pos, 6, 0.8), t = ctx.currentTime;
  noise(p, t, 0.35, 700, 0.9);
  tone(p, t, 0.25, 220, 60, 0.6);
  const o = tone(p, t + 0.15, 0.6, 200, 200, 0.35, 'sine');   // boiiing
  o.frequency.setValueAtTime(200, t + 0.15); o.frequency.exponentialRampToValueAtTime(900, t + 0.35); o.frequency.exponentialRampToValueAtTime(300, t + 0.7);
}
export function bonk() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(master, t, 0.12, 900, 300, 0.5, 'square');
  const o = tone(master, t + 0.1, 1.0, 400, 400, 0.3, 'sine');   // slide whistle up: WHEEE
  o.frequency.setValueAtTime(400, t + 0.1); o.frequency.exponentialRampToValueAtTime(1800, t + 1.0);
}
export function crash() { if (!ctx) return; const t = ctx.currentTime; noise(master, t, 0.4, 1500, 0.6); tone(master, t, 0.3, 100, 40, 0.5); }
// engine hum: call every frame with the car position and speed
let eng = null;
export function engine(pos, speed, on) {
  if (!ctx) return;
  if (!eng) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.refDistance = 4; p.rolloffFactor = 1.2;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(p); p.connect(master);
    o.start(); o2.start();
    eng = { o, o2, g, p };
  }
  const t = ctx.currentTime, s = Math.abs(speed);
  eng.o.frequency.setTargetAtTime(38 + s * 6, t, 0.1); eng.o2.frequency.setTargetAtTime(19 + s * 3, t, 0.1);
  eng.g.gain.setTargetAtTime(on ? 0.12 + Math.min(0.15, s * 0.012) : 0, t, 0.15);
  if (eng.p.positionX) { eng.p.positionX.setTargetAtTime(pos.x, t, 0.05); eng.p.positionY.setTargetAtTime(0.8, t, 0.05); eng.p.positionZ.setTargetAtTime(pos.z, t, 0.05); }
}

// ---------- new monsters ----------
export function mfx(fx, pos) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (fx === 'static') { const p = spot(pos, 5, 1, 0.5); noise(p, t, 0.35, 6000, 0.7, 'highpass'); tone(p, t, 0.3, 60, 55, 0.3, 'square'); }
  else if (fx === 'howl' || fx === 'howl2') {   // the Howler's scream
    const big = fx === 'howl', p = spot(pos, big ? 14 : 20, 0.9, 0.8);
    const o = ctx.createOscillator(), g = ctx.createGain(), ws = ctx.createWaveShaper();
    const cv = new Float32Array(256); for (let i = 0; i < 256; i++) cv[i] = Math.tanh((i / 128 - 1) * 8);
    ws.curve = cv; o.type = 'sawtooth';
    const d = big ? 2 : 1.3;
    o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.3); o.frequency.linearRampToValueAtTime(900, t + d);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(big ? 0.55 : 0.3, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(ws); ws.connect(g); g.connect(p); o.start(t); o.stop(t + d + 0.1); lfo.start(t); lfo.stop(t + d + 0.1);
    noise(p, t, d, 3000, 0.4, 'bandpass', 2);
  } else if (fx === 'howl3') {   // the Brute's roar: low and wet
    const p = spot(pos, 14, 0.9, 0.8);
    tone(p, t, 1.6, 70, 38, 0.7, 'sawtooth'); tone(p, t, 1.6, 105, 55, 0.4, 'square'); noise(p, t, 1.4, 500, 0.5, 'lowpass');
  } else if (fx === 'stomp') { const p = spot(pos, 6, 1, 0.4); tone(p, t, 0.3, 70, 30, 0.7); noise(p, t, 0.2, 200, 0.5, 'lowpass'); }
  else if (fx === 'smash') {   // wood and brick breaking
    const p = spot(pos, 10, 1, 0.5);
    noise(p, t, 0.5, 1800, 0.8, 'bandpass', 0.8); tone(p, t, 0.4, 120, 35, 0.7);
    for (let i = 0; i < 5; i++) noise(p, t + 0.05 + Math.random() * 0.4, 0.06, 900 + Math.random() * 2500, 0.5, 'bandpass', 3);
  } else if (fx === 'drop') {   // something big lets go of the ceiling
    const p = spot(pos, 8, 1, 0.5); tone(p, t, 0.3, 600, 90, 0.5, 'sawtooth'); noise(p, t + 0.2, 0.3, 300, 0.7, 'lowpass');
  } else if (fx === 'twitch') {   // a dry click-click from above
    const p = spot(pos, 4, 1, 0.3);
    for (let i = 0; i < 4; i++) noise(p, t + i * 0.07 + Math.random() * 0.04, 0.03, 3500 + Math.random() * 2500, 0.6, 'bandpass', 6);
  } else if (fx === 'wisp') {   // a cold whisper-chord
    const p = spot(pos, 8, 1, 0.5);
    tone(p, t, 2.2, 880, 870, 0.07, 'sine'); tone(p, t, 2.2, 932, 920, 0.07, 'sine'); tone(p, t, 2.2, 1318, 1290, 0.04, 'sine'); noise(p, t, 2.2, 7000, 0.12, 'highpass');
  }
}
