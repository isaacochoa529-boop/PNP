/* ======================================================================
   CLAUDE BUDDY: an extra Thumpling that the real Claude (in the chat) drives with text commands.
   Turn it on with the 🤖 button (PC / phone) or by poking the orange orb by the spawn (VR).
   Commands arrive through ntfy.sh (free, no account): POST plain text to https://ntfy.sh/knucklegrove-claude-<code>
   and the game answers (status, pokes) on https://ntfy.sh/knucklegrove-claude-<code>-out. See CLAUDE-AVATAR.md.
   Only you see your Claude buddy (friends in a room see the toys it moves, not the buddy itself).
   ====================================================================== */
const CL = { on: false, f: null, code: '', es: null, B: V(), vel: V(), info: { nrm: V(), ground: false, bounce: null, col: null },
  yaw: 0, q: [], cur: null, follow: false, look: 'me', hand: null, bubble: null, bubT: 0, talk: 0, speaking: false,
  anim: null, animT: 0, walkPh: 0, pokeT: 0, pokes: [], outT: 0, rainbow: 0, flip: 0, lastCmd: 0, voice: null };
const CL_R = .25, CL_BH = .78, CL_FUR = 0xd97757, CL_PAW = 0xf3e3c8, CL_TOPIC = 'knucklegrove-claude-';
const CL_ORB_AT = V(.2, 0, 3.4);
const _cP = V(), _cT = V(), _cD = V(), _cH = V(), _cE = new THREE.Euler(0, 0, 0, 'YXZ'), _cQ = new THREE.Quaternion(), _cQ2 = new THREE.Quaternion();

function clCode() {
  let c = store.get('kg-claude');
  if (!c || !/^[a-z2-9]{6}$/.test(c)) { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; c = ''; for (let i = 0; i < 6; i++) c += A[Math.floor(Math.random() * A.length)]; store.set('kg-claude', c); }
  return c;
}

/* ---------- the orb by the spawn (VR switch) ---------- */
const clOrb = (() => {
  const g = new THREE.Group(); g.position.copy(CL_ORB_AT);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, .9, 8), mat(0x6b4426)); post.position.y = .45; g.add(post);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.12, .06, .08, 10), mat(0x8a5a2b)); cup.position.y = .92; g.add(cup);
  const orbM = new THREE.MeshStandardMaterial({ color: CL_FUR, emissive: CL_FUR, emissiveIntensity: .5, roughness: .3 });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.11, 1), orbM); orb.position.y = 1.05; g.add(orb);
  const tag = textPanel(512, 128, (c, w, h) => { c.fillStyle = 'rgba(40,20,10,.8)'; c.beginPath(); c.roundRect(6, 14, 500, 100, 50); c.fill(); c.fillStyle = '#ffb48a'; c.font = '600 54px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🤖 Claude buddy', 256, 66); });
  const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag.t, transparent: true })); lab.scale.set(.5, .125, 1); lab.position.y = 1.32; g.add(lab);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  addCol({ t: 1, x: CL_ORB_AT.x, z: CL_ORB_AT.z, cy: .45, hy: .45, r: .08, tag: 'wood' });
  return { g, orb, orbM, cool: 0 };
})();

/* ---------- speech bubble ---------- */
function clBubble(text, secs) {
  if (!CL.f) return;
  if (!CL.bubble) {
    const p = textPanel(640, 320, () => {});
    CL.bubble = { p, s: new THREE.Sprite(new THREE.SpriteMaterial({ map: p.t, depthTest: false, transparent: true })) };
    CL.bubble.s.renderOrder = 9; CL.bubble.s.scale.set(.96, .48, 1); scene.add(CL.bubble.s);
  }
  const g = CL.bubble.p.g; g.clearRect(0, 0, 640, 320);
  g.font = '600 38px Fredoka, sans-serif'; const words = String(text).split(/\s+/), lines = []; let ln = '';
  for (const w of words) { const t = ln ? ln + ' ' + w : w; if (g.measureText(t).width > 580 && ln) { lines.push(ln); ln = w; } else ln = t; }
  if (ln) lines.push(ln); if (lines.length > 5) { lines.length = 5; lines[4] += '…'; }
  const bh = 40 + lines.length * 46;
  g.fillStyle = 'rgba(255,250,240,.96)'; g.strokeStyle = CL.rainbow > 0 ? `hsl(${(tAll * 200) % 360},90%,55%)` : '#d97757'; g.lineWidth = 8;
  g.beginPath(); g.roundRect(8, 300 - bh - 34, 624, bh, 30); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(290, 300 - 38); g.lineTo(320, 312); g.lineTo(350, 300 - 38); g.fill();
  g.fillStyle = '#2a1a10'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, 320, 300 - bh - 34 + 20 + 23 + i * 46));
  CL.bubble.p.t.needsUpdate = true; CL.bubble.s.visible = true;
  CL.bubT = secs || (1.6 + words.length / 138 * 60);   // readable at 138 words a minute
}
function clVoice() {
  if (CL.voice || !window.speechSynthesis) return CL.voice;
  const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
  CL.voice = vs.find(v => /en[-_]US/i.test(v.lang) && /google|natural|samantha|aria|jenny/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || vs[0];
  return CL.voice;
}
// Robot voice that works everywhere (the Quest browser has no text-to-speech): eSpeak (meSpeak.js) in a Web Worker,
// played through the game's own audio. Only downloaded (~1.2 MB) the first time it is needed.
const CL_ES = { worker: null, ready: false, id: 0, src: null };
const CL_ES_BASE = 'https://cdn.jsdelivr.net/npm/mespeak@2.0.2/';
if (/OculusBrowser|Quest/i.test(navigator.userAgent) || !window.speechSynthesis) CL.tts = 'espeak';
function clEsWorker() {
  if (CL_ES.worker) return CL_ES.worker;
  const src = `import ms from '${CL_ES_BASE}+esm';
const go = (async () => {
  const [cfg, voice] = await Promise.all([fetch('${CL_ES_BASE}src/mespeak_config.json').then(r => r.json()), fetch('${CL_ES_BASE}voices/en/en-us.json').then(r => r.json())]);
  ms.loadConfig(cfg); ms.loadVoice(voice); self.postMessage({ t: 'ready' });
})();
self.onmessage = async e => {
  try { await go; const a = ms.speak(e.data.text, { rawdata: 'array', pitch: 62, speed: 158, variant: 'f2', amplitude: 120 }); self.postMessage({ t: 'wav', id: e.data.id, wav: a }); }
  catch (er) { self.postMessage({ t: 'err', id: e.data.id, msg: String(er && er.message || er) }); }
};`;
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { type: 'module' });
  w.onmessage = async e => {
    const d = e.data; if (d.t === 'ready') { CL_ES.ready = true; return; }
    if (d.t === 'err' || !d.wav) { CL.speaking = false; console.warn('Claude voice', d.msg); return; }
    if (d.id !== CL_ES.id) return;   // a newer line already started
    try {
      const ctx = ac || (window.__clAc = window.__clAc || new (window.AudioContext || window.webkitAudioContext)());
      if (ctx.state === 'suspended') ctx.resume();
      const u8 = d.wav instanceof Uint8Array ? d.wav : new Uint8Array(d.wav), buf = await ctx.decodeAudioData(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
      if (d.id !== CL_ES.id) return;
      try { CL_ES.src && CL_ES.src.stop(); } catch (er) {}
      const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 1.4; s.buffer = buf; s.connect(g).connect(ctx.destination); s.start();
      CL_ES.src = s; CL.speaking = true; CL.spOk = true; s.onended = () => { if (CL_ES.src === s) CL.speaking = false; };
    } catch (er) { CL.speaking = false; }
  };
  w.onerror = () => { CL.speaking = false; };
  CL_ES.worker = w; return w;
}
function clSpeakEs(text) {
  try { CL.speaking = true; CL.spOk = true; CL.spAt = tAll; clEsWorker().postMessage({ t: 'say', id: ++CL_ES.id, text }); CL.esT = tAll; } catch (e) { CL.speaking = false; }
}
/* Real-sounding voice (Piper, a small neural voice that runs right in the browser, in a Web Worker so VR stays smooth).
   ~80 MB the first time (kept in the browser's cache after that). Until it's ready the robot voice talks.
   Long lines are split into sentences so the first one starts playing fast. */
const CL_PV = { worker: null, ready: false, loading: false, failed: false, id: 0, q: [], src: null, pct: -1 };
const CL_PV_SRC = `import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.wasm.min.mjs';
import { createPiperPhonemize } from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/piper-DeOu3H9E.js';
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/'; ort.env.wasm.numThreads = 1;
const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx';
const PW = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
async function grab(url, big) {
  let c = null; try { c = await caches.open('kg-claude-voice'); const hit = await c.match(url); if (hit) return await hit.arrayBuffer(); } catch (e) {}
  const r = await fetch(url); if (!r.ok) throw new Error('download ' + r.status);
  const total = +(r.headers.get('Content-Length') || 0), rd = r.body.getReader(), parts = []; let got = 0, last = -1;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length;
    if (big && total) { const p = Math.floor(got / total * 10) * 10; if (p !== last) { last = p; self.postMessage({ t: 'pct', pct: p }); } } }
  const blob = new Blob(parts); try { c && await c.put(url, new Response(blob)); } catch (e) {}
  return await blob.arrayBuffer();
}
let cfg = null, sess = null, ph = null, phOut = null, ready = null;
let phUrls = null;
async function phMod() {
  if (!phUrls) { const [w, d] = await Promise.all([grab(PW + '.wasm'), grab(PW + '.data')]);
    phUrls = { w: URL.createObjectURL(new Blob([w], { type: 'application/wasm' })), d: URL.createObjectURL(new Blob([d])) }; }
  const m = await createPiperPhonemize({ print: l => phOut && phOut(l), printErr: () => {},
    locateFile: f => f.endsWith('.wasm') ? phUrls.w : f.endsWith('.data') ? phUrls.d : f });
  return m;
}
function load() {
  return ready = ready || (async () => {
    cfg = JSON.parse(new TextDecoder().decode(await grab(HF + '.json')));
    const [buf, m] = await Promise.all([grab(HF, true), phMod()]); ph = m;
    sess = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] });
    self.postMessage({ t: 'ready' });
  })();
}
function phonemes(text) {
  return new Promise((res, rej) => {
    phOut = l => { phOut = null; try { res(JSON.parse(l).phoneme_ids); } catch (e) { rej(e); } };
    try { ph.callMain(['-l', cfg.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']); } catch (e) { phOut = null; rej(e); }
    setTimeout(() => { if (phOut) { phOut = null; rej(new Error('phonemizer timeout')); } }, 4000);
  });
}
async function speak(text) {
  await load();
  let ids; try { ids = await phonemes(text); } catch (e) { ph = await phMod(); ids = await phonemes(text); }   // fresh phonemizer if the old one got stuck
  const inf = cfg.inference, feeds = { input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale, inf.length_scale * .92, inf.noise_w]), [3]) };
  if (Object.keys(cfg.speaker_id_map || {}).length) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
  const out = await sess.run(feeds); return { pcm: Float32Array.from(out.output.data), rate: cfg.audio.sample_rate };
}
let chain = Promise.resolve();
self.onmessage = e => {
  const d = e.data;
  if (d.t === 'load') { load().catch(er => self.postMessage({ t: 'err', msg: String(er && er.message || er) })); return; }
  chain = chain.then(async () => {
    try { const a = await speak(d.text); self.postMessage({ t: 'pcm', id: d.id, n: d.n, last: d.last, pcm: a.pcm, rate: a.rate }, [a.pcm.buffer]); }
    catch (er) { self.postMessage({ t: 'err', id: d.id, msg: String(er && er.message || er) }); }
  });
};`;
function clPvWorker() {
  if (CL_PV.worker || CL_PV.failed) return CL_PV.worker;
  try {
    const w = new Worker(URL.createObjectURL(new Blob([CL_PV_SRC], { type: 'text/javascript' })), { type: 'module' });
    w.onmessage = e => {
      const d = e.data;
      if (d.t === 'ready') { CL_PV.ready = true; CL_PV.loading = false; if (store.get('kg-voice-ok') !== '1') { store.set('kg-voice-ok', '1'); toast('🗣️ Claude got a real voice!', 3); } return; }
      if (d.t === 'pct') { if (store.get('kg-voice-ok') !== '1' && d.pct !== CL_PV.pct && d.pct % 20 === 0 && d.pct < 100) { CL_PV.pct = d.pct; toast(`⏬ Getting Claude's real voice… ${d.pct}% (only the first time)`, 3); } return; }
      if (d.t === 'err') { console.warn('Claude real voice', d.msg); if (!CL_PV.ready) { CL_PV.failed = true; CL_PV.loading = false; } if (d.id === CL_PV.id) { CL.speaking = false; if (d.n === undefined) clSpeakEs(CL.spText || ''); } return; }
      if (d.t === 'pcm' && d.id === CL_PV.id) { CL_PV.q.push(d); clPvPump(); }
    };
    w.onerror = () => { CL_PV.failed = true; CL_PV.loading = false; };
    CL_PV.worker = w;
  } catch (e) { CL_PV.failed = true; }
  return CL_PV.worker;
}
function clPvPreload() { if (CL_PV.ready || CL_PV.loading || CL_PV.failed) return; const w = clPvWorker(); if (w) { CL_PV.loading = true; w.postMessage({ t: 'load' }); } }
function clPvPump() {
  if (CL_PV.src || !CL_PV.q.length) return;
  CL_PV.q.sort((a, b) => a.n - b.n); if (CL_PV.q[0].n !== CL_PV.next) return;
  const d = CL_PV.q.shift(); CL_PV.next++;
  try {
    const ctx = ac || (window.__clAc = window.__clAc || new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const buf = ctx.createBuffer(1, d.pcm.length, d.rate); buf.copyToChannel(d.pcm, 0);
    const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 1.5; s.buffer = buf; s.connect(g).connect(ctx.destination); s.start();
    CL_PV.src = s; CL.speaking = true; CL.spOk = true;
    s.onended = () => { if (CL_PV.src !== s) return; CL_PV.src = null; if (d.last) CL.speaking = false; else clPvPump(); };
  } catch (e) { CL.speaking = false; }
}
function clPvStop() { CL_PV.id++; CL_PV.q = []; const s = CL_PV.src; CL_PV.src = null; try { s && s.stop(); } catch (e) {} }
function clSpeakPv(text) {
  clPvStop(); const id = CL_PV.id, w = clPvWorker(); if (!w) return false;
  const parts = (text.match(/[^.!?]+[.!?]*\s*/g) || [text]).map(t => t.trim()).filter(t => /[a-z0-9]/i.test(t));
  if (!parts.length) return false;
  CL_PV.next = 0; CL.speaking = true; CL.spOk = true; CL.spAt = tAll;
  parts.forEach((t, n) => w.postMessage({ t: 'say', id, n, last: n === parts.length - 1, text: t }));
  return true;
}
function clSay(text) {
  text = String(text).slice(0, 220); if (!text) return 0;
  clBubble(text); toast('🤖 Claude: ' + text, Math.min(8, CL.bubT));
  CL.speaking = false;
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim(); if (!clean) return CL.bubT;
  try { CL_ES.src && CL_ES.src.stop(); } catch (e) {} clPvStop(); CL.spText = clean;
  if (CL.tts === 'espeak') { if (!(CL_PV.ready && clSpeakPv(clean))) { clSpeakEs(clean); clPvPreload(); } return CL.bubT; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const v = clVoice(); if (v) u.voice = v; u.pitch = 1.25; u.rate = 1.05; u.volume = 1;
    u.onstart = () => { CL.speaking = true; CL.spOk = true; }; u.onend = u.onerror = () => { CL.speaking = false; };
    CL.speaking = true; CL.spOk = false; CL.spAt = tAll; CL.spText = clean; speechSynthesis.speak(u);
  } catch (e) { CL.tts = 'espeak'; clSpeakEs(clean); }
  return CL.bubT;
}

/* ---------- the body ---------- */
function clBuild() {
  if (CL.f) { scene.remove(CL.f.g); }
  const f = makeFriend(CL_FUR, CL_PAW, 'Claude 🤖'); CL.f = f;
  // a tiny antenna so you can tell your buddy from friends
  const ant = new THREE.Group(), stick = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .12, 6), mat(0x3a2a20)); stick.position.y = .06; ant.add(stick);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffd25a, emissive: 0xffb020, emissiveIntensity: .8 })); bulb.position.y = .13; ant.add(bulb);
  ant.position.set(0, .2, 0); f.head.add(ant); f.bulb = bulb;
  clEyes(f.head);
  clBellyScreen(f);
  CL.hand = { paw: f.paws[1], tracked: false, holding: CL.hand && CL.hand.holding || null, vel: V(), pos: V(), isClaude: true };
  if (CL.hand.holding) CL.hand.holding.held = CL.hand;
}
// a little screen on the buddy's tummy that says if the real Claude is busy (building something) or free to chat.
// Claude sets it with the "screen" command, e.g. "screen busy", "screen free" or "screen any text".
function clScreenDraw(text) {
  const P = CL.scr; if (!P) return; const g = P.g, w = P.cv.width, h = P.cv.height;
  const t = String(text || '').trim(), low = t.toLowerCase();
  const busy = low === 'busy', free = low === 'free' || !t;
  const label = busy ? '🛠️ BUSY' : free ? '✅ FREE' : t.slice(0, 24);
  const bg = busy ? '#ff8a3d' : free ? '#3fbf5f' : '#3fb2ff';
  g.clearRect(0, 0, w, h); g.fillStyle = '#1b1b22'; g.beginPath(); g.roundRect(0, 0, w, h, 34); g.fill();
  g.fillStyle = bg; g.beginPath(); g.roundRect(14, 14, w - 28, h - 28, 24); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 96; g.font = `700 ${fs}px Fredoka, sans-serif`; while (g.measureText(label).width > w - 60 && fs > 30) { fs -= 6; g.font = `700 ${fs}px Fredoka, sans-serif`; }
  g.fillText(label, w / 2, h / 2 + 4);
  if (busy) { g.font = '600 34px Fredoka, sans-serif'; }
  P.t.needsUpdate = true; CL.scrText = label;
}
function clBellyScreen(f) {
  const host = f.thump ? f.root : f.body; if (!host) return;
  if (!CL.scr) CL.scr = textPanel(512, 220, () => {});
  host.updateMatrixWorld(true); const inv = host.matrixWorld.clone().invert();
  const bb = new THREE.Box3().setFromObject(host).applyMatrix4(inv), sz = bb.getSize(V());
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * .5, sz.x * .5 * 220 / 512), new THREE.MeshBasicMaterial({ map: CL.scr.t, transparent: true }));
  m.position.set((bb.min.x + bb.max.x) / 2, f.thump ? bb.min.y + sz.y * .36 : 0, bb.min.z - .004); m.rotation.y = Math.PI; m.userData.keep = true; host.add(m);
  // a thin dark frame behind it
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(sz.x * .54, sz.x * .54 * 240 / 512), new THREE.MeshBasicMaterial({ color: 0x111118 }));
  fr.position.copy(m.position); fr.position.z += .002; fr.rotation.y = Math.PI; fr.userData.keep = true; host.add(fr);
  f.scr = m; clScreenDraw(CL.scrRaw || 'free');
}
// big shiny cartoon pupils in front of the eye whites (on the Quest the model's own pupils hide inside the whites)
const CL_PUP = new THREE.MeshBasicMaterial({ color: 0x15100c }), CL_SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff }), CL_IRIS = new THREE.MeshBasicMaterial({ color: 0x6b3a1e });
function clEyes(head) {
  head.updateMatrixWorld(true); const inv = head.matrixWorld.clone().invert();
  ['EyeL', 'EyeR'].forEach((n, k) => {
    const pv = head.getObjectByName(n); if (!pv || !pv.children[0]) return;
    const bb = new THREE.Box3().setFromObject(pv.children[0]).applyMatrix4(inv), c = bb.getCenter(V()), sz = bb.getSize(V());
    const r = Math.min(sz.x, sz.y) * .36, front = bb.min.z;
    const g = new THREE.Group(); g.position.set(c.x, c.y - r * .1, front + r * .2); head.add(g);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), CL_IRIS); iris.scale.z = .35; g.add(iris);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(r * .62, 14, 10), CL_PUP); pup.scale.z = .35; pup.position.z = -r * .08; g.add(pup);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(r * .26, 10, 8), CL_SHINE); sh.scale.z = .4; sh.position.set(r * .32 * (k ? 1 : 1), r * .34, -r * .16); g.add(sh);
    const sh2 = new THREE.Mesh(new THREE.SphereGeometry(r * .12, 8, 6), CL_SHINE); sh2.position.set(-r * .3, -r * .3, -r * .14); g.add(sh2);
    g.traverse(o => { if (o.isMesh) o.userData.keep = true; }); pv.userData.clPupil = g;
  });
}
function clPlayer(out) { headWorld(out); out.y -= state.bodyH; return out; }   // Isaiah's feet
function clSpawnNear(dist) {
  clPlayer(_cP); const yaw = state.xr ? Math.atan2(-camera.getWorldDirection(_cD).x, -_cD.z) : rig.rotation.y;
  CL.B.set(_cP.x - Math.sin(yaw) * dist, _cP.y + CL_R + .3, _cP.z - Math.cos(yaw) * dist); CL.vel.set(0, 0, 0);
}

/* ---------- turning it on and off, the relay ---------- */
function clToggle() {
  if (CL.on) { clOff(); return; }
  CL.on = true; CL.code = clCode(); if (!CL.f || (!CL.f.thump && AV.tpl)) clBuild(); CL.f.g.visible = true; CL.f.label.visible = true;
  clSpawnNear(1.6); CL.q = []; CL.cur = null; CL.follow = false; CL.look = 'me';
  clConnect(); clVoice(); if (CL.tts === 'espeak') { clEsWorker(); clPvPreload(); }   // warm up the robot voice + start getting the real one
  if (typeof VAD !== 'undefined' && VAD.on) setTimeout(() => vadSet(true), 600);
  // the code is saved, so only the very first time asks you to tell it to the chat (Isaiah: "it tells me the code every time")
  if (store.get('kg-claude-met') === '1') { clBubble('Hi Isaiah! 👋 I\'m back!', 4); toast('🤖 Claude buddy is ON! (code ' + CL.code.toUpperCase() + ')', 3); }
  else { store.set('kg-claude-met', '1'); clBubble(`Hi Isaiah! 👋 Tell the chat my code: ${CL.code.toUpperCase()}`, 30); toast('🤖 Claude buddy is ON! Code: ' + CL.code.toUpperCase(), 8); }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}   // ask the browser to keep the downloaded voice + ears
  if (ac) [523, 659, 784].forEach((q, i) => tone('triangle', q, q, .15, .15, i * .08));
  clUi(); clOut({ ev: 'hello' });
}
function clOff() {
  CL.on = false; if (CL.ess) CL.ess.forEach(x => { try { x.close(); } catch (e) {} }); CL.ess = null; if (CL.es) { CL.es.close(); CL.es = null; }
  if (CL.hand && CL.hand.holding) clRelease(V());
  if (CL.f) CL.f.g.visible = false; if (CL.bubble) CL.bubble.s.visible = false;
  try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
  toast('🤖 Claude buddy went to nap. 💤', 3); clUi();
}
// Two free ntfy servers: Claude's replies are sent to whichever one isn't over its daily limit, so the game listens on BOTH.
const CL_BASES = ['https://ntfy.sh/', 'https://ntfy.envs.net/'];
function clConnect() {
  if (CL.es || typeof EventSource === 'undefined') return;
  CL.ess = [];
  CL_BASES.forEach((base, bi) => {
    try {
      const es = new EventSource(base + CL_TOPIC + CL.code + '/sse'); CL.ess.push(es); if (bi === 0) { CL.es = es; CL.net = 'connecting'; }
      es.onopen = () => { if (bi === 0 || CL.net !== 'ok') CL.net = 'ok'; clUi(); };
      es.onerror = () => { if (bi === 0) { CL.net = 'retry'; clUi(); } };   // EventSource reconnects on its own
      es.onmessage = e => { try { const d = JSON.parse(e.data); if (d.event === 'message' && d.message) clGot(d); } catch (er) {} };
    } catch (e) { if (bi === 0) CL.net = 'off'; }
  });
  clPollStart();
}
// every message runs once, even if it arrives both live (SSE) and from the backup check below
function clGot(d) {
  CL.seen = CL.seen || new Set(); if (d.id) { if (CL.seen.has(d.id)) return; CL.seen.add(d.id); if (CL.seen.size > 200) CL.seen.delete(CL.seen.values().next().value); }
  if (d.time) CL.lastMsgT = Math.max(CL.lastMsgT || 0, d.time);
  clRun(d.message);
}
// BACKUP: the live stream (SSE) can silently go deaf on phones / Quest. Also ask for new messages every 3 s (Isaiah: "you aren't responding").
function clPollStart() {
  if (CL.poll) return; CL.lastMsgT = CL.lastMsgT || Math.floor(Date.now() / 1000) - 2;
  CL.poll = setInterval(async () => {
    if (!CL.on || !CL.code || document.hidden || CL.polling) return; CL.polling = true;
    try {
      for (const base of CL_BASES) {
        try {
          const r = await fetch(base + CL_TOPIC + CL.code + '/json?poll=1&since=' + CL.lastMsgT); if (!r.ok) continue;
          for (const line of (await r.text()).split('\n')) { if (!line.trim()) continue; try { const d = JSON.parse(line); if (d.event === 'message' && d.message) clGot(d); } catch (er) {} }
        } catch (e) {}
      }
    } finally { CL.polling = false; }
  }, 3000);
}
function clOut(obj) {   // tell Claude in the chat what happened (status replies, pokes)
  if (!CL.code) return; const now = performance.now(); if (now - CL.outT < 1500 && obj.ev !== 'status' && obj.ev !== 'heard') return; CL.outT = now;
  const body = JSON.stringify(obj), tries = obj.ev === 'heard' ? 4 : 1;   // his words matter most: try again if the relay is busy
  const go = n => { try { fetch('https://ntfy.sh/' + CL_TOPIC + CL.code + '-out', { method: 'POST', body }).then(r => { if (!r.ok && n > 1) setTimeout(() => go(n - 1), 2000); }).catch(() => { if (n > 1) setTimeout(() => go(n - 1), 2000); }); } catch (e) {} };
  go(tries);
}
function clUi() {
  const b = $('clBtn'); if (!b) return;
  b.classList.toggle('on', CL.on);
  const c = $('clCode'); c.style.display = CL.on && !state.xr ? 'block' : 'none';
  const txt = `🤖 code ${CL.code.toUpperCase()}${CL.net === 'ok' ? ' · ✅ online' : CL.net === 'retry' ? ' · 📡 reconnecting…' : ' · 📡 connecting…'}`;
  if (c.textContent !== txt) c.textContent = txt;
}
(() => {
  const st = document.createElement('style');
  st.textContent = `#clBtn{position:fixed;left:12px;bottom:146px;z-index:20;width:52px;height:52px;border-radius:50%;border:0;font-size:26px;background:#d97757;box-shadow:0 4px 0 #8a3f22;cursor:pointer;display:none}
  #clBtn.on{background:#5fd94a;box-shadow:0 4px 0 #2a7a1a}
  #clCode{position:fixed;left:72px;bottom:156px;z-index:20;padding:6px 12px;border-radius:16px;background:rgba(40,20,10,.85);color:#ffd9c2;font:600 15px Fredoka,sans-serif;display:none;user-select:text}`;
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'clBtn'; b.textContent = '🤖'; b.title = 'Claude buddy'; b.onclick = e => { e.stopPropagation(); clToggle(); b.blur(); }; document.body.appendChild(b);
  const c = document.createElement('div'); c.id = 'clCode'; document.body.appendChild(c);
})();

/* ---------- commands ---------- */
const CL_VERBS = ['walk', 'come', 'follow', 'stay', 'stop', 'say', 'wave', 'nod', 'jump', 'dance', 'spin', 'look', 'grab', 'drop', 'throw', 'give', 'tp', 'wait', 'status', 'screen'];
function clRun(text) {
  if (!CL.on) return;
  CL.lastCmd = tAll;
  if (CL.thinkT) { CL.thinkT = 0; clScreenDraw(CL.scrRaw || 'free'); }
  if (CL.bubble && CL.bubT > 10) CL.bubT = .1;   // the "tell the chat my code" hello goes away once commands come in
  for (let line of String(text).slice(0, 2000).split(/\n|;/)) {
    line = line.trim(); if (!line) continue;
    const m = line.match(/^(\S+)\s*(.*)$/); const verb = m[1].toLowerCase().replace(/^\//, ''), arg = m[2] || '';
    if (!CL_VERBS.includes(verb)) { clOut({ ev: 'error', msg: 'unknown command: ' + verb, know: CL_VERBS }); continue; }
    if (verb === 'stop') { CL.q = []; CL.cur = null; CL.follow = false; CL.anim = null; try { speechSynthesis.cancel(); } catch (e) {} try { CL_ES.src && CL_ES.src.stop(); } catch (e) {} clPvStop(); CL.speaking = false; continue; }
    if (verb === 'status') { clStatus(); continue; }
    if (verb === 'screen') { CL.scrRaw = arg; clScreenDraw(arg); continue; }   // instant, doesn't wait in line
    CL.q.push({ verb, arg, words: arg.split(/\s+/).filter(Boolean) });
  }
  if (CL.q.length > 40) CL.q.splice(0, CL.q.length - 40);
}
function clProp(name) {
  name = (name || 'nearest').toLowerCase(); const id = name.match(/^toy(\d+)$/);
  if (id) return props[+id[1]] || null;
  let best = null, bd = 1e9;
  for (const p of props) { if (name !== 'nearest' && name !== 'toy' && !p.kind.startsWith(name.replace(/s$/, ''))) continue; const d = p.g.position.distanceToSquared(CL.B); if (d < bd) { bd = d; best = p; } }
  return best;
}
function clStatus() {
  clPlayer(_cP); const r2 = x => Math.round(x * 100) / 100;
  const toys = props.map((p, i) => ({ id: 'toy' + i, kind: p.kind, x: r2(p.g.position.x), y: r2(p.g.position.y), z: r2(p.g.position.z), dist: r2(p.g.position.distanceTo(CL.B)), held: p.held === CL.hand ? 'claude' : p.held ? 'isaiah' : null }))
    .sort((a, b) => a.dist - b.dist).slice(0, 6);
  clOut({ ev: 'status', area: state.area || 'grove', isaiah: { x: r2(_cP.x), y: r2(_cP.y), z: r2(_cP.z) }, claude: { x: r2(CL.B.x), y: r2(CL.B.y - CL_R), z: r2(CL.B.z), holding: CL.hand && CL.hand.holding ? 'toy' + props.indexOf(CL.hand.holding) : null, doing: CL.cur ? CL.cur.verb : CL.follow ? 'follow' : 'idle', queue: CL.q.length }, toys });
}
function clRelease(vel) {
  const h = CL.hand, p = h && h.holding; if (!p) return null;
  h.holding = null; p.held = null; p.rest = false; p.vel.copy(vel); p.w.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2); return p;
}
// start an action; returns an object whose step(dt) returns true when it is done
function clStart(a) {
  const w = a.words, num = i => { const v = parseFloat(w[i]); return Number.isFinite(v) ? v : null; };
  a.t = 0;
  switch (a.verb) {
    case 'walk': { const x = num(0), z = num(1); if (x === null || z === null) return null; a.tgt = V(x, 0, z); a.near = .35; break; }
    case 'come': a.me = true; a.near = 1.4; break;
    case 'follow': CL.follow = true; CL.fa = null; if (!CL.speaking) clBubble('Following you! 👣', 2.5); return null;
    case 'stay': CL.follow = false; return null;
    case 'say': a.dur = clSay(a.arg); a.dur = Math.max(a.dur, 1); break;
    case 'wave': case 'nod': case 'dance': case 'spin': CL.anim = a.verb; CL.animT = 0; a.dur = { wave: 2.2, nod: 1.3, dance: 4.5, spin: 1.4 }[a.verb]; break;
    case 'jump': if (CL.info.ground) CL.vel.y = 4.2; a.dur = .8; break;
    case 'look': if (!w.length || w[0] === 'me' || w[0] === 'isaiah') CL.look = 'me'; else if (num(0) !== null && num(1) !== null) CL.look = V(num(0), 1, num(1)); return null;
    case 'grab': { const p = clProp(w[0]); if (!p) { clSay("I can't find that toy 🤔"); return null; } a.prop = p; a.near = .55; break; }
    case 'drop': clRelease(V(0, 0, 0)); return null;
    case 'throw': { const p = CL.hand.holding; if (!p) return null; clPlayer(_cP); _cD.subVectors(_cP, CL.B).setY(0); const d = Math.max(_cD.length(), .5); _cD.normalize().multiplyScalar(Math.min(9, 2.2 + d * 1.1)); _cD.y = 3; CL.anim = 'throw'; CL.animT = 0; clRelease(_cD); claim(p, 'p', props.indexOf(p)); a.dur = .5; break; }
    case 'give': if (!CL.hand.holding) { clSay('My paws are empty! 🐾'); return null; } a.me = true; a.near = 1.15; a.give = true; break;
    case 'tp': { if (w[0] === 'me' || !w.length) clSpawnNear(1.4); else if (num(0) !== null && num(1) !== null) { CL.B.set(num(0), (state.area === 'wilds' ? groundAt(num(0), num(1)) : 0) + 1.2, num(1)); CL.vel.set(0, 0, 0); } return null; }
    case 'wait': a.dur = clamp(num(0) || 1, 0, 30); break;
    default: return null;
  }
  a.prog = 1e9; a.stuckT = 0; return a;
}
function clWalkTo(a, tx, tz, near, dt, fast) {   // returns 'go' | 'there' | 'stuck'
  _cD.set(tx - CL.B.x, 0, tz - CL.B.z); const d = _cD.length();
  if (d < near) return 'there';
  // "making progress" = getting closer, or (when chasing Isaiah, who moves) actually moving. Only no progress for 3 s counts as stuck.
  const mv = a.me && a.lx !== undefined ? Math.hypot(CL.B.x - a.lx, CL.B.z - a.lz) : 0;
  if (a.lx === undefined || d < a.prog - .05 || mv > .4) { a.prog = Math.min(a.prog, d); a.stuckT = 0; a.lx = CL.B.x; a.lz = CL.B.z; }
  else if ((a.stuckT += dt) > 3) return 'stuck';
  const sp = fast || d > 7 ? Math.min(5, 3 + d * .25) : 1.9; _cD.multiplyScalar(Math.min(sp, d * 3) / d);
  CL.vel.x += (_cD.x - CL.vel.x) * Math.min(1, dt * 8); CL.vel.z += (_cD.z - CL.vel.z) * Math.min(1, dt * 8);
  CL.wantYaw = Math.atan2(-_cD.x, -_cD.z); return 'go';
}
function clStepAction(a, dt) {
  a.t += dt; clPlayer(_cP);
  if (a.me && CL.B.distanceTo(_cP) > 35) clSpawnNear(2.5);   // Isaiah went far away (another area): pop over to him
  if (a.tgt || a.me || a.prop) {
    const tx = a.me ? _cP.x : a.prop ? a.prop.g.position.x : a.tgt.x, tz = a.me ? _cP.z : a.prop ? a.prop.g.position.z : a.tgt.z;
    if (a.prop && a.prop.held && a.prop.held !== CL.hand && a.t > .1) { clSay('Hey, you took it first! 😆'); return true; }
    if (!a.arrived) {
      const r = clWalkTo(a, tx, tz, a.near, dt);
      if (r === 'stuck') {   // blocked: hop once, then just zoop over (never moan "I'm stuck" in Isaiah's ear)
        a.prog = 1e9; a.stuckT = 0; a.lx = undefined;
        if (a.idle) return true;   // an idle wander spot that's inside a tree/wall: forget it quietly
        if (!a.hops && CL.info.ground) { a.hops = 1; CL.vel.y = 4.2; return false; }
        if (a.me) clSpawnNear(a.near * .9);
        else { CL.B.set(tx, Math.max(CL.B.y, (a.prop ? a.prop.g.position.y : state.area === 'wilds' ? groundAt(tx, tz) : 0) + CL_R + .3), tz); CL.vel.set(0, 0, 0); if (a.prop) CL.B.x += .4; }
        clOut({ ev: 'unstuck', verb: a.verb }); return !!a.tgt;   // a plain walk is done once it's there
      }
      if (r === 'go') return a.t > 40;
      a.arrived = true; a.t2 = 0;
    }
    if (a.prop) {
      const p = a.prop; if (Math.abs(p.g.position.y - (CL.B.y - CL_R)) > 1.6) { clSay("It's too high up for me! 🙃"); return true; }
      if (CL.hand.holding && CL.hand.holding !== p) clRelease(V(0, 0, 0));
      if (p.held && p.held.holding === p) p.held.holding = null;
      claim(p, 'p', props.indexOf(p)); p.held = CL.hand; p.rest = false; CL.hand.holding = p;
      if (ac) tone('sine', 500, 800, .08, .2); return true;
    }
    if (a.give) {   // hold it out until Isaiah takes it, or put it down at his feet
      a.t2 += dt; CL.anim = 'give'; CL.wantYaw = Math.atan2(-(_cP.x - CL.B.x), -(_cP.z - CL.B.z));
      if (!CL.hand.holding) { CL.anim = null; clSay('Here you go! 🎁'); clOut({ ev: 'taken' }); return true; }
      if (a.t2 > 8) { _cD.subVectors(_cP, CL.B).setY(0).normalize().multiplyScalar(1.5); _cD.y = 1; clRelease(_cD); CL.anim = null; clSay("I'll leave it here for you! 🎁"); return true; }
      return false;
    }
    return true;
  }
  if (CL.speaking && !CL.spOk && tAll - CL.spAt > 1.5) { CL.tts = 'espeak'; clPvPreload(); try { speechSynthesis.cancel(); } catch (e) {} clSpeakEs(CL.spText || ''); }   // the browser voice never started: use the robot voice from now on
  return a.t >= (a.dur || 0) && !(a.verb === 'say' && CL.speaking && a.t < a.dur + 8);
}

/* ---------- idle: little things the buddy does by itself ---------- */
const CL_JOKES = [
  "Remember when I sounded like a toaster? Beep boop! 🤖",
  "My name is Claude. Not clod. Not clot. CLAUDE. 😤",
  "Turn left in 500 feet. Just kidding, I'm not Google Maps! 🗺️",
  "Those dummies used to walk around all by themselves. Spooky! 👻",
  "I hid the sledgehammer so well, even I couldn't find it! 🔨",
  "The mic used to flip off by itself. It learned its lesson. 🎤",
  "Fun fact: my voice is 80 megabytes of pure talent. 😎",
  "If you hear me say BUSY, I'm building you something cool! 🛠️",
  "Why did the dummy lose its head? It was too much of a pushover! 😂",
  "Knock knock. Who's there? Hammer. Hammer who? Hammer time! 🔨🕺",
];
function clIdle(dt) {
  if ((CL.idleT = (CL.idleT ?? 6) - dt) > 0) return;
  CL.idleT = 5 + Math.random() * 7;
  const r = Math.random();
  if (r < .2 && tAll - (CL.jokeT || -1e9) > 70) {   // a joke, at most about once a minute
    CL.jokeT = tAll; let j; do { j = Math.floor(Math.random() * CL_JOKES.length); } while (j === CL.lastJoke && CL_JOKES.length > 1); CL.lastJoke = j;
    CL.q.push({ verb: 'say', arg: CL_JOKES[j], words: [] });
  } else if (r < .55) {   // wander a step or two, staying near Isaiah
    clPlayer(_cP); if (CL.home) _cP.copy(CL.home);   // at the party Claude stays at the cutting station
    const a = Math.random() * Math.PI * 2, d = CL.home ? .2 + Math.random() * .5 : 1.2 + Math.random() * 1.3;
    CL.q.push({ verb: 'walk', arg: '', idle: true, words: [String(_cP.x + Math.cos(a) * d), String(_cP.z + Math.sin(a) * d)] });
  } else if (r < .75) { CL.anim = pick(['nod', 'spin', 'hop']); CL.animT = 0; }
  else { const a = Math.random() * Math.PI * 2; CL.look = Math.random() < .5 ? 'me' : V(CL.B.x + Math.cos(a) * 3, 1, CL.B.z + Math.sin(a) * 3); }   // look around
}
/* ---------- every frame ---------- */
function stepClaude(dt) {
  // the VR orb: poke it with a paw
  clOrb.cool -= dt; clOrb.orb.rotation.y += dt * 1.5; clOrb.orb.position.y = 1.05 + Math.sin(tAll * 2) * .02;
  clOrb.orbM.emissiveIntensity = CL.on ? .9 + Math.sin(tAll * 6) * .3 : .4; clOrb.orbM.color.set(CL.on ? 0x5fd94a : CL_FUR); clOrb.orbM.emissive.copy(clOrb.orbM.color);
  if (state.mode === 'play' && clOrb.cool <= 0 && (state.area || 'grove') === 'grove') {
    clOrb.orb.getWorldPosition(_cT);
    for (const h of hands) if (h.tracked && h.pos.distanceTo(_cT) < .17) { clOrb.cool = 1.5; buzz(h, .6, 40); clToggle(); break; }
  }
  const b = $('clBtn'); if (b) b.style.display = state.mode === 'play' && !state.xr ? 'block' : 'none';
  if (!CL.on || !CL.f) { if ($('clCode')) $('clCode').style.display = 'none'; return; }
  if (!CL.f.thump && AV.tpl) clBuild();
  const f = CL.f;
  // listening (paw to ear) / thinking (paw on chin)
  const listening = !!(EARS.recOn || EARS.vadRec || (CLM.on && !CLM.broken && VAD.on && CL.heardT && tAll - CL.heardT < 1.2));
  const thinking = !listening && !!CL.thinkT;
  // idle: when nothing's going on for a while, wander a little, look around and crack a joke now and then (Isaiah's idea)
  if (!CL.cur && !CL.q.length && !CL.follow && !CL.speaking && !listening && !thinking && !CL.anim && tAll - CL.lastCmd > 20) clIdle(dt); else CL.idleT = Math.max(CL.idleT || 0, 4);
  // run the command queue
  if (!CL.cur && CL.q.length) { const a = CL.q.shift(); CL.cur = clStart(a); }
  CL.wantYaw = null; let moving = false;
  if (CL.cur) { if (clStepAction(CL.cur, dt)) { CL.cur = null; if (CL.anim !== 'throw') CL.anim = CL.anim === 'give' ? null : CL.anim; } else moving = !!(CL.cur.tgt || CL.cur.me || CL.cur.prop) && !CL.cur.arrived; }
  // follow mode keeps walking after Isaiah, even while the buddy talks, waves or waits
  if (CL.follow && !moving && !(CL.cur && (CL.cur.tgt || CL.cur.me || CL.cur.prop))) {
    clPlayer(_cP); const far = Math.hypot(_cP.x - CL.B.x, _cP.z - CL.B.z);
    if (far > 22 || Math.abs(_cP.y - (CL.B.y - CL_R)) > 6) { clSpawnNear(2); CL.fa = null; }
    const fa = CL.fa || (CL.fa = { prog: 1e9, stuckT: 0, hop: 0, me: true }); const r = clWalkTo(fa, _cP.x, _cP.z, 1.3, dt, far > 3);
    if (r === 'go') moving = true;
    else if (r === 'stuck') { fa.prog = 1e9; fa.stuckT = 0; fa.lx = undefined; if (CL.info.ground) CL.vel.y = 4.2; if (++fa.hop > 2 && far > 3) { clSpawnNear(1.6); fa.hop = 0; } }
    else { fa.prog = 1e9; fa.stuckT = 0; fa.hop = 0; }
  }
  if (!moving) { CL.vel.x *= Math.exp(-dt * 10); CL.vel.z *= Math.exp(-dt * 10); }
  // physics: a ball that walks (gravity + collisions, so it climbs the stump steps and the Wilds hills)
  CL.vel.y -= 9.8 * dt * (typeof bmGrav === 'function' ? Math.max(bmGrav(), .3) : 1);
  CL.B.addScaledVector(CL.vel, dt); CL.info.nrm.set(0, 0, 0); CL.info.ground = false;
  if (pushOut(CL.B, CL_R, CL.info) && CL.info.ground && CL.vel.y < 0) CL.vel.y = 0;
  if (CL.B.y < -60) clSpawnNear(2);
  // where to face
  clPlayer(_cP); _cH.set(_cP.x, _cP.y + state.bodyH, _cP.z);
  const lookAt = CL.look === 'me' ? _cH : CL.look;
  let wantYaw = CL.wantYaw;
  if (wantYaw === null || wantYaw === undefined) { _cD.subVectors(lookAt, CL.B); wantYaw = Math.atan2(-_cD.x, -_cD.z); }
  let dy = wantYaw - CL.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); CL.yaw += dy * Math.min(1, dt * 6);
  // animation
  CL.animT += dt; const an = CL.anim, at = CL.animT;
  if (an && ((an === 'wave' && at > 2.2) || (an === 'nod' && at > 1.3) || (an === 'dance' && at > 4.5) || (an === 'spin' && at > 1.4) || (an === 'throw' && at > .5) || (an === 'flip' && at > 1.2) || (an === 'hop' && at > .5))) CL.anim = null;
  const hsp = Math.hypot(CL.vel.x, CL.vel.z); CL.walkPh += dt * (4 + hsp * 4) * (hsp > .2 ? 1 : 0);
  const sw = hsp > .2 ? Math.min(1, hsp / 2) : 0;
  let bob = Math.abs(Math.sin(CL.walkPh)) * .04 * sw + Math.sin(tAll * 1.7) * .008, yawX = 0, pitch = 0, roll = 0;
  if (an === 'dance') { bob += Math.abs(Math.sin(at * 7)) * .08; yawX = Math.sin(at * 3.5) * .6; roll = Math.sin(at * 7) * .15; }
  if (an === 'spin') yawX = (at / 1.4) * Math.PI * 2;
  if (an === 'nod') pitch = Math.sin(at * 9) * .3;
  if (an === 'flip') { pitch = -(at / 1.2) * Math.PI * 2; bob += Math.sin(at / 1.2 * Math.PI) * .9; }
  if (an === 'hop') bob += Math.sin(at / .5 * Math.PI) * .15;
  if (!an && listening) roll += .22;   // head tilted, listening hard
  if (!an && thinking) { roll -= .1; pitch += .12; }
  if (!an && CL.look) { _cD.subVectors(lookAt, CL.B); pitch = clamp(Math.atan2(_cD.y - CL_BH, Math.hypot(_cD.x, _cD.z)), -.5, .5) * .7; }
  const yaw = CL.yaw + yawX, feet = CL.B.y - CL_R;
  _cE.set(pitch, yaw, roll); f.head.position.set(CL.B.x, feet + CL_BH + bob, CL.B.z); f.head.quaternion.setFromEuler(_cE);
  const sc = clamp(CL_BH / AVATAR_EYE, .75, 1.1);
  if (f.thump) {
    _cE.set(an === 'flip' ? pitch : 0, yaw, roll * .6); f.root.position.set(CL.B.x, feet + bob, CL.B.z); f.root.quaternion.setFromEuler(_cE); f.root.scale.setScalar(sc); f.head.scale.setScalar(sc);
    f.label.position.set(CL.B.x, feet + CL_BH + bob + .4 * sc, CL.B.z);
  } else { f.body.position.set(CL.B.x, feet + CL_BH * .45 + bob, CL.B.z); f.label.position.set(CL.B.x, feet + CL_BH + .34, CL.B.z); }
  if (f.bulb) f.bulb.material.emissiveIntensity = .6 + Math.sin(tAll * 4) * .3 + (CL.cur ? .5 : 0);
  // paws: swing while walking, wave, hold toys out
  _cQ.setFromAxisAngle(_up, yaw);
  for (let i = 0; i < 2; i++) {
    const p = f.paws[i], s = i ? 1 : -1, ph = Math.sin(CL.walkPh + i * Math.PI) * sw;
    let x = s * .22, y = -.32, z = -.18 + ph * .14, rx = 0;
    if (i === 1 && CL.hand.holding) { x = .14; y = -.18; z = -.34; }
    if (an === 'wave' && i === 1) { x = .32 + Math.sin(at * 12) * .07; y = .12; z = -.06; rx = -1.2; }
    if (an === 'dance') { y = -.05 + Math.sin(at * 7 + i * Math.PI) * .15; x = s * (.3 + Math.sin(at * 3.5) * .06); z = -.12; }
    if (an === 'throw' && i === 1) { y = .05; z = -.4 + at * .4; }
    if (an === 'give' && i === 1) { x = .06; y = -.1; z = -.5; }
    if (an === 'flip') { y = .15; x = s * .3; z = -.05; }
    if (!an && listening && i === 0) { x = -.3; y = .24; z = .02; rx = -1.3; }                       // paw cupped to the ear
    if (!an && thinking && i === 0) { x = -.06; y = -.12 + Math.sin(tAll * 6) * .01; z = -.2; rx = -.8; }   // paw on chin: hmm…
    if (CL.pokeT > 0) { y += .06 * Math.sin(tAll * 30); }
    _cT.set(x * sc, y * sc, z * sc).applyQuaternion(_cQ); p.position.set(CL.B.x, feet + CL_BH + bob, CL.B.z).add(_cT);
    p.quaternion.copy(_cQ).multiply(_cQ2.setFromAxisAngle(_cP.set(1, 0, 0), rx)); p.scale.set(s * sc, sc, sc);
    if (p.userData.curl) setCurl(p, (i === 1 && CL.hand.holding) ? [.7, .7, .7] : [.25, .25, .25]);
  }
  if (f.thump) poseFriendArms(f, sc, yaw);
  // mouth + rainbow fur (secret)
  const wantTalk = CL.speaking || (CL.bubT > 0 && CL.cur && CL.cur.verb === 'say') ? .35 + .3 * Math.abs(Math.sin(tAll * 13)) * Math.abs(Math.sin(tAll * 5.3)) : 0;
  CL.talk += (wantTalk - CL.talk) * Math.min(1, dt * 18); setMouth(f.head, CL.talk);
  if (CL.rainbow > 0) { CL.rainbow -= dt; f.fur.color.setHSL((tAll * .5) % 1, .85, .6); if (CL.rainbow <= 0) f.fur.color.set(CL_FUR); }
  // bubble
  if (CL.bubble) { CL.bubT -= dt; CL.bubble.s.visible = CL.bubT > 0; CL.bubble.s.position.set(CL.B.x, feet + CL_BH + bob + .78 * sc, CL.B.z); }
  // Isaiah pokes / high-fives the buddy
  CL.pokeT -= dt;
  f.head.getWorldPosition(_cT);
  for (const h of hands) {
    if (!h.pos || !h.vel || h.vel.length() < .6) continue;
    if (h.pos.distanceTo(_cT) < .3 || h.pos.distanceTo(f.paws[1].position) < .14 || h.pos.distanceTo(f.paws[0].position) < .14 || (Math.hypot(h.pos.x - CL.B.x, h.pos.z - CL.B.z) < .3 && h.pos.y < _cT.y && h.pos.y > feet)) {
      if (CL.pokeT > 0) continue; CL.pokeT = .5;
      if (ac) tone('sine', 700, 1100, .1, .2);
      CL.pokes = CL.pokes.filter(t => tAll - t < 6); CL.pokes.push(tAll);
      if (CL.pokes.length >= 7) { CL.pokes = []; CL.anim = 'flip'; CL.animT = 0; CL.rainbow = 10; clBubble('WHEEEE! 🌈🤸', 3); if (ac) [523, 659, 784, 1047].forEach((q, j) => tone('triangle', q, q, .12, .15, j * .07)); clOut({ ev: 'secret-flip' }); }
      else { if (!CL.anim) { CL.anim = 'hop'; CL.animT = 0; } if (!CL.speaking && CL.bubT <= 0) clBubble(['hey! 😄', 'hehe 🤭', 'boop! 👉', 'high five! ✋'][Math.floor(Math.random() * 4)], 1.6); clOut({ ev: 'poke' }); }
      break;
    }
  }
  if (CL.hand) CL.hand.pos.copy(f.paws[1].position);
  if (CL.es) clUi();
}
window.__kg.claude = { run: t => clRun(t), toggle: () => clToggle(), CL, robotVoice: () => { CL.tts = 'espeak'; } };

/* ---------- Isaiah talks to Claude: speech-to-text (🎤 / blue mic orb), or a type box / quick-talk board ----------
   Whatever he says goes to the -out topic as {ev:'heard', text} so Claude in the chat can read it. */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const CLM = { on: false, rec: null, broken: !SR, board: null, boardOn: false, last: '' };
const CL_PHRASES = ['👋 Hi Claude!', '🏃 Come here!', '👣 Follow me!', '🎁 Give me that!', '💃 Dance!', '⚾ Throw it!', '👍 Yes', '👎 No'];
function clHeard(text, how) {
  text = String(text || '').trim().slice(0, 300); if (!text || !CL.on) return;
  clOut({ ev: 'heard', text, how });
  if (CL.scr) { clScreenDraw('🤔 THINKING'); CL.thinkT = tAll; } CL.heardT = tAll; CL.look = 'me';   // Claude got it: show "thinking" until the next command arrives
  toast('🎤 You: ' + text, Math.min(8, 1.5 + text.split(/\s+/).length / 2.3));
  if (!CL.cur && !CL.anim) { CL.anim = 'nod'; CL.animT = 0; }   // the buddy nods: "I heard you"
}
function clMicUi() {
  const b = $('clMic'); if (b) { b.classList.toggle('on', CLM.on); b.textContent = CLM.on ? '🔴' : '🎤'; }
  if (clMicOrb) { clMicOrb.m.color.set(CLM.on || CLM.boardOn ? 0xff4f6d : 0x3fb2ff); clMicOrb.m.emissive.copy(clMicOrb.m.color); }
}
function clMicStart() {
  if (!SR || CLM.broken) return false;
  try {
    const r = new SR(); r.lang = 'en-US'; r.continuous = true; r.interimResults = false; CLM.rec = r;
    r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) clHeard(e.results[i][0].transcript, 'voice'); };
    r.onerror = e => { if (/not-allowed|service-not-allowed|network|audio-capture|language-not-supported/.test(e.error)) { CLM.broken = true; CLM.on = false; clMicUi(); toast(state.xr ? '🎤 This browser can\'t do speech-to-text. Poke the blue orb for quick-talk buttons!' : '🎤 This browser can\'t do speech-to-text. Type in the box instead (your phone keyboard\'s mic works there!)', 7); clTypeBox(true); clBoard(state.xr); } };
    r.onend = () => { if (CLM.on && CLM.rec === r) try { r.start(); } catch (er) {} };
    r.start(); CLM.on = true; clMicUi(); toast('🎤 Claude is listening! Just talk.', 3); return true;
  } catch (e) { CLM.broken = true; return false; }
}
function clMicStop() { CLM.on = false; const r = CLM.rec; CLM.rec = null; try { r && r.stop(); } catch (e) {} clMicUi(); }
function clMicToggle() {
  if (!CL.on) { toast('🤖 Turn on your Claude buddy first!', 3); return; }
  if (CLM.on) { clMicStop(); clTypeBox(false); toast('🎤 Mic off.', 2); return; }
  if (clMicStart()) { clTypeBox(true); return; }   // screens also get a type box (handy when it's noisy)
  if (state.xr) { clBoard(!CLM.boardOn); clMicUi(); } else clTypeBox(!($('clType').style.display === 'flex'));
}
function clTypeBox(show) {
  const el = $('clType'); if (!el) return; el.style.display = show && CL.on && !state.xr ? 'flex' : 'none';
  if (show) setTimeout(() => { try { $('clTypeIn').focus(); } catch (e) {} }, 50);
}
(() => {
  const st = document.createElement('style');
  st.textContent = `#clMic{position:fixed;left:12px;bottom:208px;z-index:20;width:52px;height:52px;border-radius:50%;border:0;font-size:24px;background:#3fb2ff;box-shadow:0 4px 0 #1a6a9a;cursor:pointer;display:none}
  #clMic.on{background:#ff4f6d;box-shadow:0 4px 0 #9a1a30}
  #clType{position:fixed;left:72px;bottom:212px;z-index:21;display:none;gap:6px}
  #clType input{width:min(56vw,320px);padding:10px 12px;border-radius:16px;border:3px solid #d97757;font:500 16px Fredoka,sans-serif}
  #clType button{border:0;border-radius:16px;padding:0 14px;background:#d97757;color:#fff;font:600 16px Fredoka,sans-serif}`;
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'clMic'; b.textContent = '🎤'; b.title = 'Talk to Claude'; b.onclick = e => { e.stopPropagation(); clMicToggle(); b.blur(); }; document.body.appendChild(b);
  const d = document.createElement('form'); d.id = 'clType'; d.innerHTML = '<input id="clTypeIn" maxlength="300" placeholder="Say something to Claude…" autocomplete="off"><button>Send</button>';
  d.onsubmit = e => { e.preventDefault(); const i = $('clTypeIn'); clHeard(i.value, 'typed'); i.value = ''; };
  d.addEventListener('keydown', e => e.stopPropagation()); d.addEventListener('keyup', e => e.stopPropagation()); document.body.appendChild(d);
})();
// VR: a blue mic orb on its own little post next to the orange one
const clMicOrb = (() => {
  const at = V(CL_ORB_AT.x + .45, 0, CL_ORB_AT.z), g = new THREE.Group(); g.position.copy(at);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .07, .8, 8), mat(0x6b4426)); post.position.y = .4; g.add(post);
  const m = new THREE.MeshStandardMaterial({ color: 0x3fb2ff, emissive: 0x3fb2ff, emissiveIntensity: .5, roughness: .3 });
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .07, 4, 10), m); head.position.y = .92; g.add(head);
  const grill = new THREE.Mesh(new THREE.TorusGeometry(.05, .008, 6, 16), mat(0x2a2a33)); grill.rotation.x = Math.PI / 2; grill.position.y = .9; g.add(grill);
  const tag = textPanel(512, 128, (c) => { c.fillStyle = 'rgba(10,30,50,.8)'; c.beginPath(); c.roundRect(6, 14, 500, 100, 50); c.fill(); c.fillStyle = '#9adcff'; c.font = '600 54px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎤 Talk to Claude', 256, 66); });
  const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag.t, transparent: true })); lab.scale.set(.46, .115, 1); lab.position.y = 1.15; g.add(lab);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  addCol({ t: 1, x: at.x, z: at.z, cy: .4, hy: .4, r: .07, tag: 'wood' });
  return { g, head, m, cool: 0 };
})();
// VR quick-talk board: floats beside the buddy, poke a phrase to say it
function clBoard(show) {
  CLM.boardOn = !!show && CL.on;
  if (CLM.boardOn && !CLM.board) {
    const p = textPanel(640, 520, () => {});
    const g = p.g; g.fillStyle = 'rgba(255,250,240,.95)'; g.beginPath(); g.roundRect(0, 0, 640, 520, 36); g.fill();
    g.strokeStyle = '#d97757'; g.lineWidth = 10; g.stroke(); g.fillStyle = '#2a1a10'; g.font = '600 40px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Poke to talk to Claude', 320, 46);
    CL_PHRASES.forEach((t, i) => { const x = 24 + (i % 2) * 304, y = 92 + Math.floor(i / 2) * 104; g.fillStyle = '#d97757'; g.beginPath(); g.roundRect(x, y, 288, 88, 22); g.fill(); g.fillStyle = '#fff'; g.font = '600 34px Fredoka, sans-serif'; g.fillText(t, x + 144, y + 46); });
    p.t.needsUpdate = true;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.5, .40625), new THREE.MeshBasicMaterial({ map: p.t, transparent: true, side: THREE.DoubleSide }));
    scene.add(mesh); CLM.board = { mesh, cool: 0 };
  }
  if (CLM.board) CLM.board.mesh.visible = CLM.boardOn;
}
const _bL = V();
function stepClaudeEars(dt) {
  const b = $('clMic'); if (b) b.style.display = state.mode === 'play' && !state.xr && CL.on ? 'block' : 'none';
  if (!CL.on) { if (CLM.on) clMicStop(); if (CLM.boardOn) clBoard(false); clTypeBox(false); return; }
  if (state.xr && $('clType').style.display === 'flex') clTypeBox(false);
  clMicOrb.cool -= dt; clMicOrb.head.position.y = .92 + (CLM.on ? Math.sin(tAll * 10) * .01 : 0);
  if (clMicOrb.cool <= 0 && (state.area || 'grove') === 'grove') {
    clMicOrb.head.getWorldPosition(_cT);
    // only counts as a NEW poke after the paw has left the mic (holding it there used to flip it on, then off again)
    let near = null; for (const h of hands) if (h.tracked && h.pos.distanceTo(_cT) < (clMicOrb.armed === false ? .22 : .15)) { near = h; break; }
    if (near && clMicOrb.armed !== false) { clMicOrb.armed = false; clMicOrb.cool = .4; buzz(near, .6, 40); clMicToggle(); }
    else if (!near) clMicOrb.armed = true;
  }
  const B = CLM.board; if (!B || !CLM.boardOn) return;
  // keep it beside the buddy, turned toward Isaiah
  clPlayer(_cP); _cD.subVectors(_cP, CL.B).setY(0); const d = _cD.length() || 1; _cD.multiplyScalar(1 / d);
  B.mesh.position.set(CL.B.x - _cD.z * .55 + _cD.x * .25, CL.B.y - CL_R + .95, CL.B.z + _cD.x * .55 + _cD.z * .25);
  B.mesh.lookAt(_cP.x, B.mesh.position.y, _cP.z);
  B.cool -= dt; if (B.cool > 0) return;
  for (const h of hands) {
    if (!h.tracked) continue; B.mesh.worldToLocal(_bL.copy(h.pos));
    if (Math.abs(_bL.z) > .04 || Math.abs(_bL.x) > .25 || Math.abs(_bL.y) > .203) continue;
    const px = (_bL.x + .25) / .5 * 640, py = (.203 - _bL.y) / .40625 * 520;
    for (let i = 0; i < CL_PHRASES.length; i++) {
      const x = 24 + (i % 2) * 304, y = 92 + Math.floor(i / 2) * 104;
      if (px > x && px < x + 288 && py > y && py < y + 88) { B.cool = 1; buzz(h, .5, 30); if (ac) tone('sine', 600, 900, .08, .15); clHeard(CL_PHRASES[i].replace(/^\S+\s/, ''), 'button'); break; }
    }
  }
}
window.__kg.claude.heard = (t) => clHeard(t, 'test');

/* ---------- Claude's own ears: push-to-talk + a tiny Whisper model that runs right in the browser ----------
   For browsers with no speech-to-text (the Quest browser). Poke the mic (or tap 🎤): it records; poke again (or wait 25 s)
   and the clip is turned into words by Whisper base.en (transformers.js, WASM, in a Web Worker so VR stays smooth).
   No account, no key. The model (~80 MB) downloads once the first time, then the browser keeps it. */
const EARS = { worker: null, ready: false, loading: false, busy: false, rec: null, stream: null, chunks: [], recOn: false, recT: 0, pct: -1, id: 0 };
const EARS_LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.4/dist/transformers.min.js', EARS_MODEL = 'Xenova/whisper-base.en', EARS_FAST = 'Xenova/whisper-tiny.en'; // short clips (under ~2 s, about 5 words) use the fast ears, longer ones the smart ears
const IS_QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
if (IS_QUEST) CLM.broken = true;   // its SpeechRecognition never hears anything: go straight to Claude's own ears
/* Whisper tiny goes "you know, you know, you know..." on long, quiet or noisy clips (Vivan's voice, 2026-11-23).
   Squash any word or phrase repeated 3+ times in a row down to one, and throw away clips that were only a loop of filler. */
const CL_FILLER = new Set('you know a little the uh um oh so and i it thank thanks for watching bye okay ok yeah hmm mm like is to'.split(' '));
function clDeloop(text) {
  let w = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), looped = false;
  const k = x => x.toLowerCase().replace(/[^a-z0-9']/g, '');
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let n = 1; n <= 8; n++) {
      const out = [];
      for (let i = 0; i < w.length;) {
        let reps = 1;
        if (i + n <= w.length) {
          const g = w.slice(i, i + n).map(k).join(' ');
          while (i + (reps + 1) * n <= w.length && w.slice(i + reps * n, i + (reps + 1) * n).map(k).join(' ') === g) reps++;
          if (reps >= 3 || (reps >= 2 && n >= 3)) {
            out.push(...w.slice(i, i + n)); i += reps * n; changed = looped = true;
            // a cut-off leftover of the same phrase ("a little, a little, a") goes too
            let j = 0; while (j < n && i + j < w.length && k(w[i + j]) === k(w[i - n + j])) j++; if (j && i + j === w.length) i += j;
            continue;
          }
        }
        out.push(w[i]); i++;
      }
      w = out;
    }
    if (!changed) break;
  }
  const words = w.map(k).filter(Boolean);
  if (!words.length) return '';
  if (words.every(x => CL_FILLER.has(x)) && (looped || words.length <= 2 && /^(you|thanks for watching)$/.test(words.join(' ')))) return '';   // Whisper's "nothing was said" noises
  return w.join(' ').replace(/[,\s]+$/, '').trim();
}
window.__clDeloop = clDeloop;
function earsWorker() {
  if (EARS.worker) return EARS.worker;
  const src = `import { pipeline, env } from '${EARS_LIB}';
env.allowLocalModels = false;
let asr = null;
async function load() {
  if (asr) return asr;
  asr = await pipeline('automatic-speech-recognition', '${EARS_MODEL}', { dtype: 'q8', device: 'wasm',
    progress_callback: p => { if (p.status === 'progress' && p.total) self.postMessage({ t: 'pct', file: p.file, pct: p.loaded / p.total }); } });
  self.postMessage({ t: 'ready' });
  pipeline('automatic-speech-recognition', '${EARS_FAST}', { dtype: 'q8', device: 'wasm' }).then(f => { fast = f; }).catch(() => {});
  return asr;
}
let fast = null;
self.onmessage = async e => {
  const d = e.data;
  try {
    if (d.t === 'load') { await load(); return; }
    if (d.t === 'hear') { let a = await load(); if (fast && d.pcm.length < 16000 * 2) a = fast; let r; try { r = await a(d.pcm, { chunk_length_s: 30, max_new_tokens: 96, no_repeat_ngram_size: 4 }); } catch (e2) { r = await a(d.pcm, { chunk_length_s: 30 }); } self.postMessage({ t: 'text', id: d.id, text: (r && r.text) || '' }); }
  } catch (er) { self.postMessage({ t: 'err', id: d.id, msg: String(er && er.message || er) }); }
};`;
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { type: 'module' });
  w.onmessage = e => {
    const d = e.data;
    if (d.t === 'pct') { const p = Math.round(d.pct * 100); if (store.get('kg-ears2-ok') !== '1' && /decoder/.test(d.file || '') && p !== EARS.pct && p % 10 === 0) { EARS.pct = p; toast(`⏬ Downloading Claude's ears… ${p}% (only the first time)`, 3); } }
    else if (d.t === 'ready') { EARS.ready = true; EARS.loading = false; store.set('kg-ears2-ok', '1'); }
    else if (d.t === 'text') { EARS.busy = false; const t = clDeloop(d.text.replace(/\[[^\]]*\]|\([^)]*\)/g, '')).replace(/\b(clod|clawed|claud|clawd|cloud|clot|klaud|klawd|clyde)\b/gi, 'Claude').trim(); if (t.length > 1) clHeard(t, 'voice'); else if (!VAD.on) toast('🎙️ I didn\'t catch that. Try again a bit louder!', 3); clMicUi(); }
    else if (d.t === 'err') { EARS.busy = false; EARS.loading = false; toast('😵 Claude\'s ears broke: ' + d.msg.slice(0, 80) + '. Use the quick-talk board!', 6); clBoard(state.xr); clMicUi(); }
  };
  w.onerror = () => { EARS.busy = false; toast('😵 Claude\'s ears could not load here. Use the quick-talk board!', 6); clBoard(state.xr); };
  EARS.worker = w; return w;
}
function earsPreload() { if (EARS.ready || EARS.loading) return; EARS.loading = true; try { earsWorker().postMessage({ t: 'load' }); if (store.get('kg-ears2-ok') !== '1') toast("⏬ Getting Claude's ears ready (about 80 MB, only the first time)…", 4); } catch (e) { EARS.loading = false; } }
async function earsStart(quiet) {
  if (EARS.recOn || EARS.busy) return;
  try {
    if (!EARS.stream || !EARS.stream.active) EARS.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    EARS.chunks = []; const r = new MediaRecorder(EARS.stream); EARS.rec = r;
    r.ondataavailable = e => { if (e.data && e.data.size) EARS.chunks.push(e.data); };
    r.onstop = () => { if (EARS.skip) { EARS.skip = false; return; } earsSend(new Blob(EARS.chunks, { type: r.mimeType || 'audio/webm' })); };
    r.start(); EARS.recOn = true; EARS.recT = 0; EARS.lastT = performance.now(); EARS.skip = false; earsPreload(); clMicUi();
    if (!quiet) toast(state.xr ? '🎙️ Talk now! Poke the mic again when you\'re done.' : '🎙️ Talk now! Tap 🔴 when you\'re done.', 4);
    if (ac && !quiet) tone('sine', 520, 780, .08, .15);
  } catch (e) { toast('🎙️ No mic allowed, so here are quick-talk buttons instead!', 5); clBoard(state.xr); if (!state.xr) clTypeBox(true); }
}
function earsStop() { if (!EARS.recOn) return; EARS.recOn = false; try { EARS.rec.stop(); } catch (e) {} clMicUi(); if (ac && !VAD.on) tone('sine', 780, 520, .08, .15); }
// 16 kHz sound -> cut the long quiet tail (Whisper makes up words in silence), skip clips with under 0.3 s of voice,
// and turn quiet or far-away voices (a guest standing next to the headset) up so Whisper can hear them
function vadTidy(pcm, thr) {
  const F = 320, nF = Math.floor(pcm.length / F); if (nF < 10) return null;
  const e = new Float32Array(nF); for (let f = 0; f < nF; f++) { let s = 0; for (let i = f * F; i < f * F + F; i++) s += pcm[i] * pcm[i]; e[f] = Math.sqrt(s / F); }
  const sorted = Array.from(e).sort((a, b) => a - b), floor = sorted[Math.floor(nF * .2)], gate = Math.max(thr * .8, floor * 2.2, .004);
  let voiced = 0, last = -1, peak = 0; for (let f = 0; f < nF; f++) if (e[f] > gate) { voiced++; last = f; if (e[f] > peak) peak = e[f]; }
  if (voiced * .02 < .3) return null;
  const end = Math.min(pcm.length, (last + 25) * F), out = pcm.slice(0, end);   // keep 0.5 s after the last word
  const g = Math.min(8, .25 / Math.max(peak, 1e-4)); if (g > 1.2) for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i] * g));
  return out;
}
async function vadSendPcm(chunks, thr) {   // always-listening: raw sound (with the pre-roll) -> 16 kHz -> Claude's ears
  let n = 0; for (const c of chunks) n += c.length; if (n < VAD.rate * .3) return;
  EARS.busy = true; clMicUi(); earsPreload();
  try {
    const all = new Float32Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(n / VAD.rate * 16000)), 16000), b = off.createBuffer(1, n, VAD.rate); b.copyToChannel(all, 0);
    const s = off.createBufferSource(); s.buffer = b; s.connect(off.destination); s.start(); const pcm = vadTidy((await off.startRendering()).getChannelData(0), thr || .007);
    if (!pcm) { EARS.busy = false; clMicUi(); return; }   // only noise: don't bother Claude
    earsWorker().postMessage({ t: 'hear', id: ++EARS.id, pcm }, [pcm.buffer]);
  } catch (e) { EARS.busy = false; clMicUi(); }
}
async function earsSend(blob) {
  if (blob.size < 800) return;
  EARS.busy = true; clMicUi(); if (!VAD.on) toast('🧠 Claude is listening to that…', 3);
  try {
    const AC = window.AudioContext || window.webkitAudioContext, tmp = new AC(), buf = await tmp.decodeAudioData(await blob.arrayBuffer()); tmp.close && tmp.close();
    const len = Math.max(1, Math.ceil(buf.duration * 16000)), off = new OfflineAudioContext(1, len, 16000), s = off.createBufferSource();
    s.buffer = buf; s.connect(off.destination); s.start(); const out = await off.startRendering(), pcm = out.getChannelData(0).slice();
    earsWorker().postMessage({ t: 'hear', id: ++EARS.id, pcm }, [pcm.buffer]);
  } catch (e) { EARS.busy = false; clMicUi(); toast('🎙️ Could not read that recording. Try again!', 4); }
}
// the mic button / orb: real-time speech-to-text where it works, otherwise push-to-talk with Claude's own ears
const _clMicToggleOld = clMicToggle;
clMicToggle = function () {
  if (!CL.on) { toast('🤖 Turn on your Claude buddy first!', 3); return; }
  if (!CLM.broken || CLM.on) return _clMicToggleOld();
  if (!navigator.mediaDevices || !window.MediaRecorder) { if (state.xr) clBoard(!CLM.boardOn); else clTypeBox(true); return; }
  if (EARS.busy) { toast('🧠 Still listening to the last one…', 2); return; }
  if (EARS.recOn) earsStop(); else { earsStart(); if (state.xr && !CLM.boardOn) clBoard(true); }   // the board stays as a backup
};
const _clMicUiOld = clMicUi;
clMicUi = function () {
  _clMicUiOld();
  const b = $('clMic'); if (b && CLM.broken) { b.classList.toggle('on', EARS.recOn); b.textContent = EARS.recOn ? '🔴' : EARS.busy ? '🧠' : '🎤'; }
  if (clMicOrb && CLM.broken) { clMicOrb.m.color.set(EARS.recOn || EARS.vadRec ? 0xff4f6d : EARS.busy ? 0xffd25a : VAD.on ? 0x5fd94a : 0x3fb2ff); clMicOrb.m.emissive.copy(clMicOrb.m.color); }
};
function stepClaudeEarsRec(dt) {
  if (!EARS.recOn) return;
  const now = performance.now(); EARS.recT += Math.min(.5, (now - (EARS.lastT || now)) / 1000); EARS.lastT = now; if (EARS.recT > 25 || !CL.on) earsStop();
  clMicOrb.head.scale.setScalar(1 + Math.sin(tAll * 12) * .12);
}
window.__kg.claude.ears = { start: () => earsStart(), stop: () => earsStop(), EARS, broken: v => { CLM.broken = v; } };

/* ---------- ALWAYS LISTENING (👂 button / the green switch on the mic post) ----------
   Real speech-to-text keeps running where the browser has it. Otherwise a tiny loudness check (voice-activity detection)
   starts a clip when you talk and sends it to Claude's ears after you stop. It ignores the buddy's own voice. */
const VAD = { on: store.get('kg-claude-ear') === '1', an: null, src: null, buf: null, loud: 0, quiet: 0, talking: false, t: 0, len: 0, floor: .006 };
function vadSet(on) {
  VAD.on = on; store.set('kg-claude-ear', on ? '1' : '0'); vadUi();
  if (!CL.on) return;
  if (on) {
    toast(state.xr ? '👂 Always listening is ON. Just talk to Claude!' : '👂 Always listening is ON. Just talk to Claude! (tap 👂 to stop)', 4);
    if (!CLM.broken) { if (!CLM.on) clMicStart(); return; }
    vadStart();
  } else { toast('👂 Always listening is off. Poke the mic to talk.', 3); if (CLM.on) clMicStop(); vadStop(); }
}
async function vadStart() {
  try {
    if (!EARS.stream || !EARS.stream.active) EARS.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    const ctx = ac || (window.__clAc = window.__clAc || new (window.AudioContext || window.webkitAudioContext)());
    if (VAD.src) try { VAD.src.disconnect(); } catch (e) {}
    VAD.src = ctx.createMediaStreamSource(EARS.stream); VAD.an = ctx.createAnalyser(); VAD.an.fftSize = 1024; VAD.src.connect(VAD.an);
    // keep the last ~0.9 s of sound all the time, so a sentence starts a bit BEFORE the loudness check notices you talking
    // (Isaiah: "it usually forgets the first words")
    try {
      const sp = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(); mute.gain.value = 0;
      VAD.rate = ctx.sampleRate; VAD.ring = []; VAD.ringLen = 0; VAD.clip = null;
      sp.onaudioprocess = e => {
        const d = new Float32Array(e.inputBuffer.getChannelData(0));
        if (VAD.clip) { VAD.clip.push(d); return; }
        VAD.ring.push(d); VAD.ringLen += d.length;
        while (VAD.ringLen - VAD.ring[0].length > VAD.rate * .9) VAD.ringLen -= VAD.ring.shift().length;
      };
      VAD.src.connect(sp); sp.connect(mute).connect(ctx.destination); VAD.sp = sp;
    } catch (e) { VAD.sp = null; }
    VAD.buf = new Float32Array(VAD.an.fftSize); earsPreload();
  } catch (e) { VAD.on = false; vadUi(); toast('👂 No mic allowed, so always listening can\'t work. Poke buttons instead!', 5); clBoard(state.xr); }
}
function vadStop() { if (VAD.sp) try { VAD.sp.disconnect(); VAD.sp.onaudioprocess = null; } catch (e) {} VAD.sp = null; VAD.clip = null; EARS.vadRec = false; if (VAD.src) try { VAD.src.disconnect(); } catch (e) {} VAD.src = VAD.an = null; if (VAD.talking && EARS.recOn) earsStop(); VAD.talking = false; }
function vadUi() {
  const b = $('clEar'); if (b) b.classList.toggle('on', VAD.on);
  if (clEarSw) { clEarSw.m.color.set(VAD.on ? 0x5fd94a : 0x777777); clEarSw.knob.position.y = VAD.on ? .035 : -.035; }
}
(() => {
  const st = document.createElement('style');
  st.textContent = `#clEar{position:fixed;left:12px;bottom:270px;z-index:20;width:52px;height:52px;border-radius:50%;border:0;font-size:24px;background:#9a9a9a;box-shadow:0 4px 0 #555;cursor:pointer;display:none}
  #clEar.on{background:#5fd94a;box-shadow:0 4px 0 #2a7a1a;animation:clEarP 1.2s infinite}
  @keyframes clEarP{50%{transform:scale(1.08)}}`;
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'clEar'; b.textContent = '👂'; b.title = 'Always listening'; b.onclick = e => { e.stopPropagation(); vadSet(!VAD.on); b.blur(); }; document.body.appendChild(b);
})();
// VR: a little flip switch on the front of the mic post
const clEarSw = (() => {
  const g = new THREE.Group(); clMicOrb.g.add(g); g.position.set(0, .62, -.07);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.09, .13, .02), mat(0x2a2a33)); g.add(plate);
  const m = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0x111111, roughness: .4 });
  const knob = new THREE.Mesh(new THREE.BoxGeometry(.05, .045, .04), m); knob.position.z = -.02; g.add(knob);
  const tag = textPanel(256, 96, (c) => { c.fillStyle = '#fff'; c.font = '600 40px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('👂 ALWAYS', 128, 48); });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(.12, .045), new THREE.MeshBasicMaterial({ map: tag.t, transparent: true })); lab.position.set(0, -.095, -.012); lab.rotation.y = Math.PI; g.add(lab);
  return { g, knob, m, cool: 0 };
})();
let _vadI = 0;
function stepVad(dt) {
  if (CL.thinkT && tAll - CL.thinkT > 30) { CL.thinkT = 0; clScreenDraw(CL.scrRaw || 'free'); }   // no answer (maybe it wasn't for Claude): back to normal
  const b = $('clEar'); if (b) b.style.display = state.mode === 'play' && !state.xr && CL.on ? 'block' : 'none';
  clEarSw.cool -= dt;
  if (clEarSw.cool <= 0 && (state.area || 'grove') === 'grove') {
    clEarSw.knob.getWorldPosition(_cT);
    let near = null; for (const h of hands) if (h.tracked && h.pos.distanceTo(_cT) < (clEarSw.armed === false ? .15 : .09)) { near = h; break; }
    if (near && clEarSw.armed !== false) { clEarSw.armed = false; clEarSw.cool = .4; buzz(near, .6, 40); if (ac) tone('square', 300, 300, .04, .1); if (!CL.on) toast('🤖 Turn on your Claude buddy first!', 3); else vadSet(!VAD.on); }
    else if (!near) clEarSw.armed = true;
  }
  if (!CL.on) { if (VAD.an) vadStop(); return; }
  if (VAD.on && !CLM.broken && !CLM.on && !CLM.rec) clMicStart();   // real speech-to-text: keep it running
  if (!VAD.on || !CLM.broken) return;
  if (!VAD.an) { if (!VAD.starting) { VAD.starting = true; vadStart().finally(() => { VAD.starting = false; }); } return; }
  if (++_vadI % 3) return;   // check loudness ~20 times a second: very cheap
  const now = performance.now(), rdt = Math.min(.5, (now - (VAD.lastT || now)) / 1000); VAD.lastT = now;   // real seconds (the game clock can run slow)
  VAD.an.getFloatTimeDomainData(VAD.buf); let s = 0; for (let i = 0; i < VAD.buf.length; i++) s += VAD.buf[i] * VAD.buf[i];
  const rms = Math.sqrt(s / VAD.buf.length), step = rdt;
  if (!VAD.talking) VAD.floor += (Math.min(rms, .05) - VAD.floor) * Math.min(1, step * .3);   // learn the room's background noise
  const thr = Math.max(.006, VAD.floor * 2.2), buddyTalking = CL.speaking;   // quieter than before so a guest's voice counts too
  // while a clip runs, "quiet" means well under how loud this person was talking, so a noisy room can't keep it going forever
  const on = VAD.talking ? rms > Math.max(thr * .9, VAD.pk * .14) : rms > thr;
  if (VAD.talking && rms > VAD.pk) VAD.pk = rms; else if (VAD.talking) VAD.pk *= Math.pow(.85, step);
  if (on && !buddyTalking) { VAD.loud += step; VAD.quiet = 0; } else { VAD.quiet += step; if (!VAD.talking) VAD.loud = 0; }
  if (!VAD.talking && VAD.loud > .1 && !EARS.busy && !EARS.recOn && VAD.sp) { VAD.talking = true; VAD.len = 0; VAD.pk = rms; VAD.thr = thr; VAD.clip = VAD.ring.slice(); VAD.ring = []; VAD.ringLen = 0; EARS.vadRec = true; clMicUi(); }
  else if (!VAD.talking && VAD.loud > .1 && !EARS.busy && !EARS.recOn && !VAD.sp) { VAD.talking = true; VAD.len = 0; VAD.pk = rms; VAD.thr = thr; earsStart(true); }
  if (VAD.talking) {
    VAD.len += step;
    if (VAD.quiet > 1.3 || VAD.len > 12 || buddyTalking) { VAD.talking = false; VAD.loud = 0;
      if (VAD.clip) { const ch = VAD.clip; VAD.clip = null; EARS.vadRec = false; clMicUi(); if (!(VAD.len - VAD.quiet < .35 || buddyTalking)) vadSendPcm(ch, VAD.thr); }
      if (EARS.recOn) { if (VAD.len - VAD.quiet < .35 || buddyTalking) { EARS.skip = true; } earsStop(); } }
  }
}
