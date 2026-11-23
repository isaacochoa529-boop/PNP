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
function clSay(text) {
  text = String(text).slice(0, 220); if (!text) return 0;
  clBubble(text); toast('🤖 Claude: ' + text, Math.min(8, CL.bubT));
  CL.speaking = false;
  try {
    if (window.speechSynthesis) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
      const v = clVoice(); if (v) u.voice = v; u.pitch = 1.25; u.rate = 1.05; u.volume = 1;
      u.onstart = () => { CL.speaking = true; CL.spOk = true; }; u.onend = u.onerror = () => { CL.speaking = false; };
      CL.speaking = true; CL.spOk = false; CL.spAt = tAll; speechSynthesis.speak(u);
    }
  } catch (e) { CL.speaking = false; }
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
  CL.hand = { paw: f.paws[1], tracked: false, holding: CL.hand && CL.hand.holding || null, vel: V(), pos: V(), isClaude: true };
  if (CL.hand.holding) CL.hand.holding.held = CL.hand;
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
  clConnect(); clVoice();
  const msg = `Hi Isaiah! 👋 Tell the chat my code: ${CL.code.toUpperCase()}`;
  clBubble(msg, 30); toast('🤖 Claude buddy is ON! Code: ' + CL.code.toUpperCase(), 8);
  if (ac) [523, 659, 784].forEach((q, i) => tone('triangle', q, q, .15, .15, i * .08));
  clUi(); clOut({ ev: 'hello' });
}
function clOff() {
  CL.on = false; if (CL.es) { CL.es.close(); CL.es = null; }
  if (CL.hand && CL.hand.holding) clRelease(V());
  if (CL.f) CL.f.g.visible = false; if (CL.bubble) CL.bubble.s.visible = false;
  try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
  toast('🤖 Claude buddy went to nap. 💤', 3); clUi();
}
function clConnect() {
  if (CL.es || typeof EventSource === 'undefined') return;
  try {
    const es = new EventSource('https://ntfy.sh/' + CL_TOPIC + CL.code + '/sse'); CL.es = es; CL.net = 'connecting';
    es.onopen = () => { CL.net = 'ok'; clUi(); };
    es.onerror = () => { CL.net = 'retry'; clUi(); };   // EventSource reconnects on its own
    es.onmessage = e => { try { const d = JSON.parse(e.data); if (d.event === 'message' && d.message) clRun(d.message); } catch (er) {} };
  } catch (e) { CL.net = 'off'; }
}
function clOut(obj) {   // tell Claude in the chat what happened (status replies, pokes)
  if (!CL.code) return; const now = performance.now(); if (now - CL.outT < 1500 && obj.ev !== 'status') return; CL.outT = now;
  try { fetch('https://ntfy.sh/' + CL_TOPIC + CL.code + '-out', { method: 'POST', body: JSON.stringify(obj) }).catch(() => {}); } catch (e) {}
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
const CL_VERBS = ['walk', 'come', 'follow', 'stay', 'stop', 'say', 'wave', 'nod', 'jump', 'dance', 'spin', 'look', 'grab', 'drop', 'throw', 'give', 'tp', 'wait', 'status'];
function clRun(text) {
  if (!CL.on) return;
  CL.lastCmd = tAll;
  if (CL.bubble && CL.bubT > 10) CL.bubT = .1;   // the "tell the chat my code" hello goes away once commands come in
  for (let line of String(text).slice(0, 2000).split(/\n|;/)) {
    line = line.trim(); if (!line) continue;
    const m = line.match(/^(\S+)\s*(.*)$/); const verb = m[1].toLowerCase().replace(/^\//, ''), arg = m[2] || '';
    if (!CL_VERBS.includes(verb)) { clOut({ ev: 'error', msg: 'unknown command: ' + verb, know: CL_VERBS }); continue; }
    if (verb === 'stop') { CL.q = []; CL.cur = null; CL.follow = false; CL.anim = null; try { speechSynthesis.cancel(); } catch (e) {} continue; }
    if (verb === 'status') { clStatus(); continue; }
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
    case 'follow': CL.follow = true; return null;
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
  if (d < a.prog - .05) { a.prog = d; a.stuckT = 0; } else if ((a.stuckT += dt) > 3) return 'stuck';
  const sp = fast || d > 7 ? 3.6 : 1.9; _cD.multiplyScalar(Math.min(sp, d * 3) / d);
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
      if (r === 'stuck') { clSay(a.prop ? "I can't reach it 😅" : "I'm stuck! 😅"); clOut({ ev: 'stuck', verb: a.verb }); return true; }
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
  if (CL.speaking && !CL.spOk && tAll - CL.spAt > 2) CL.speaking = false;   // no voice on this device (or it never started): the bubble still shows
  return a.t >= (a.dur || 0) && !(a.verb === 'say' && CL.speaking && a.t < a.dur + 8);
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
  // run the command queue
  if (!CL.cur && CL.q.length) { const a = CL.q.shift(); CL.cur = clStart(a); }
  CL.wantYaw = null; let moving = false;
  if (CL.cur) { if (clStepAction(CL.cur, dt)) { CL.cur = null; if (CL.anim !== 'throw') CL.anim = CL.anim === 'give' ? null : CL.anim; } else moving = !!(CL.cur.tgt || CL.cur.me || CL.cur.prop) && !CL.cur.arrived; }
  else if (CL.follow) {
    clPlayer(_cP); if (CL.B.distanceTo(_cP) > 35) clSpawnNear(2.5);
    const fa = CL.fa || (CL.fa = { prog: 1e9, stuckT: 0 }); const r = clWalkTo(fa, _cP.x, _cP.z, 1.6, dt, CL.B.distanceTo(_cP) > 4);
    if (r !== 'go') { fa.prog = 1e9; fa.stuckT = 0; } else moving = true;
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
window.__kg.claude = { run: t => clRun(t), toggle: () => clToggle(), CL };
