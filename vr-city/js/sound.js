// Sounds: footsteps, the creepy singing, screams, crickets and little chimes.
// Everything is made with the Web Audio API, so there are no sound files to download.
let ctx = null, master = null, noiseBuf = null;

export function initSound() {
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(crickets, 900);
  } catch (e) {
    ctx = null;
  }
}

export function resumeSound() {
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
}

export function setListener(pos, fwd) {
  if (!ctx) return;
  const l = ctx.listener;
  if (l.positionX) {
    l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
    l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
  }
}

// A 3D sound spot: sounds placed here get louder when you get closer.
function spot(pos) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = 4;
  p.rolloffFactor = 1.1;
  p.setPosition(pos.x, pos.y ?? 0.5, pos.z);
  p.connect(master);
  return p;
}

function noise(dest, t, dur, freq, gain) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f); f.connect(g); g.connect(dest);
  n.start(t, Math.random() * 0.5);
  n.stop(t + dur + 0.05);
}

// Loud heavy footstep
export function thud(pos) {
  if (!ctx) return;
  const p = spot(pos), t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.2, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g); g.connect(p);
  o.start(t); o.stop(t + 0.45);
  noise(p, t, 0.12, 500, 0.5);
}

// The creepy "la, la, la!"
export function sing(pos) {
  if (!ctx) return;
  const p = spot(pos), t0 = ctx.currentTime + 0.05;
  const notes = [[262, 0], [294, 0.36], [247, 0.72]];
  for (const [f, dt] of notes) {
    const t = t0 + dt;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.92, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.12);
    o.frequency.linearRampToValueAtTime(f * 0.96, t + 0.3);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 5;
    const vib = ctx.createOscillator(), vg = ctx.createGain();
    vib.frequency.value = 6; vg.gain.value = 8;
    vib.connect(vg); vg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(bp); bp.connect(g); g.connect(p);
    vib.start(t); vib.stop(t + 0.4);
    o.start(t); o.stop(t + 0.35);
  }
}

// Everyone hears this when the monster starts hunting.
export function scream() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(1100, t);
  o.frequency.exponentialRampToValueAtTime(260, t + 2.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.7, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 2.7);
  noise(master, t, 2.2, 2500, 0.4);
}

export function squish() {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(master, t, 0.15, 800, 0.6);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + 0.15);
}

export function chime() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [660, 880, 1320].forEach((f, i) => {
    const t = t0 + i * 0.12;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.65);
  });
}

// Ambient crickets chirping in the dark
function crickets() {
  if (!ctx || ctx.state !== 'running' || Math.random() < 0.3) return;
  const t = ctx.currentTime + 0.02;
  for (let k = 0; k < 5; k++) {
    const s = t + k * 0.09;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 4300;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(0.02, s + 0.01);
    g.gain.linearRampToValueAtTime(0, s + 0.045);
    o.connect(g); g.connect(master);
    o.start(s); o.stop(s + 0.05);
  }
}
