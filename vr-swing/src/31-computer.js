/* ======================================================================
   THE GROVE COMPUTER: a little desk by the spawn stump with a big screen and a poke-able keyboard.
   Tap the tabs on the screen: join a room, pick your fur + paw colors, change your name, see your player ID.
   Desktop: look at a key or button and click (or press E).
   ====================================================================== */
const COMP_AT = V(-2.1, 0, 1.9);
const COMP_COLORS = [0x2fc6a3, 0xff8a3d, 0x8b6bff, 0xff4fa8, 0xffd25a, 0x3fb2ff, 0xff4057, 0x5dd35d, 0xf2efe6, 0x34343f];
const KB_ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL⌫', 'ZXCVBNM-!✅', ' '];
Object.assign(CP, { page: 'join', code: '', nameT: '', flash: null, flashT: 0, hits: [], inK: [false, false], inS: [false, false], hackT: 0 });
function myId() {
  let id = store.get('kg-id');
  if (!id || !/^KG-[A-Z0-9]{4}$/.test(id)) { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; id = 'KG-' + Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); store.set('kg-id', id); }
  return id;
}
const readCol = k => { const s = store.get(k); if (s === 'rainbow') return -1; const n = parseInt(s, 10); return Number.isInteger(n) && n >= 0 && n <= 0xffffff ? n : null; };
function myFur() { const c = readCol('kg-fur'); return c != null ? c : (MP.myColor || COMP_COLORS[0]); }
function myPawCol() { const c = readCol('kg-paw'); return c != null ? c : myFur(); }
function setMyName(n) { n = n.trim().slice(0, 12); if (!n) return false; store.set('kg-name', n); MP.name = n; const el = $('mpName'); if (el) el.value = n; return true; }
const css = c => c === -1 ? '#fff' : '#' + new THREE.Color(c).getHexString();

/* ---------- the desk, screen and keyboard ---------- */
const comp = (() => {
  const g = new THREE.Group(); g.position.copy(COMP_AT); g.rotation.y = Math.atan2(-COMP_AT.x, -COMP_AT.z); scene.add(g);
  const wood = smat(0xa8713f, { roughness: .8 }), woodD = smat(0x7a4f2a, { roughness: .85 }), plastic = smat(0xf1ede2, { roughness: .5 }), dark = smat(0x22262e, { roughness: .45 });
  part(new THREE.BoxGeometry(1.06, .05, .66), wood, 0, .315, -.05, g);   // desk top
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => part(new THREE.CylinderGeometry(.03, .035, .3, 8), woodD, x * .47, .15, z * .27 - .05, g));
  part(new THREE.BoxGeometry(.9, .03, .04), woodD, 0, .08, -.3, g);   // foot rail
  part(new THREE.BoxGeometry(.9, .02, .4), plastic, 0, .35, .07, g);    // keyboard base
  // monitor: chunky retro frame on a little stand
  part(new THREE.CylinderGeometry(.11, .13, .02, 20), plastic, 0, .35, -.3, g);
  part(new THREE.BoxGeometry(.06, .12, .04), plastic, 0, .42, -.31, g);
  part(new THREE.BoxGeometry(1.0, .6, .07), plastic, 0, .74, -.31, g);
  part(new THREE.BoxGeometry(.7, .4, .12), plastic, 0, .74, -.4, g);    // the boxy back
  const led = part(new THREE.SphereGeometry(.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5dff8f }), .44, .465, -.27, g);
  // canvases: screen 1024x576, keyboard 1024x456 (they match the meshes' shapes)
  const scv = document.createElement('canvas'); scv.width = 1024; scv.height = 576; const sg = scv.getContext('2d');
  const stex = new THREE.CanvasTexture(scv); stex.colorSpace = THREE.SRGBColorSpace; stex.anisotropy = 4;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.9, .506), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false })); scr.position.set(0, .74, -.272); g.add(scr);
  const kcv = document.createElement('canvas'); kcv.width = 1024; kcv.height = 456; const kg = kcv.getContext('2d');
  const ktex = new THREE.CanvasTexture(kcv); ktex.colorSpace = THREE.SRGBColorSpace; ktex.anisotropy = 4;
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(.86, .383), new THREE.MeshStandardMaterial({ map: ktex, roughness: .6 })); kb.rotation.x = -Math.PI / 2; kb.position.set(0, .361, .07); g.add(kb);
  // a little sign so you know it's for multiplayer
  const sgnT = labelTex(512, 128, (cg, w, h) => signText(cg, w, h, [['🎮 PLAY WITH FRIENDS', 46, '#ffd25a', 66]], 'rgba(40,26,14,.92)', '#ffd25a'));
  const sgn = new THREE.Mesh(new THREE.PlaneGeometry(.6, .15), new THREE.MeshBasicMaterial({ map: sgnT, transparent: true })); sgn.position.set(0, 1.11, -.3); g.add(sgn);
  mergeStatic(g, c => c === scr || c === kb || c === led || c === sgn);
  g.updateMatrixWorld(true);
  const yaw = g.rotation.y, wp = (x, z) => V(x, 0, z).applyAxisAngle(V(0, 1, 0), yaw).add(COMP_AT);
  let p = wp(0, -.05); addCol({ t: 0, x: p.x, y: .16, z: p.z, hx: .53, hy: .16, hz: .33, yaw, tag: 'wood' });          // desk (a bit under the keys, so a paw or fingertip can press them in)
  p = wp(0, -.35); addCol({ t: 0, x: p.x, y: .74, z: p.z, hx: .5, hy: .3, hz: .1, yaw, tag: 'wood' });                 // monitor (front at -.25)
  return { g, scr, kb, sg, stex, kg, ktex, led };
})();

/* ---------- drawing ---------- */
const KB = { x0: 16, y0: 14, kw: 99.2, kh: 80, gap: 7 };
function keyRect(r, c) { if (r === 4) return [KB.x0 + 2 * KB.kw, KB.y0 + 4 * KB.kh, 6 * KB.kw, KB.kh]; return [KB.x0 + c * KB.kw, KB.y0 + r * KB.kh, KB.kw, KB.kh]; }
function drawKb() {
  const g = comp.kg; g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, 1024, 456);
  KB_ROWS.forEach((row, r) => [...row].forEach((k, c) => {
    const [x, y, w, h] = keyRect(r, c), hot = CP.flash === k, ok = k === '✅', back = k === '⌫';
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(x + KB.gap / 2, y + KB.gap / 2 + 6, w - KB.gap, h - KB.gap, 14); g.fill();
    g.fillStyle = hot ? '#ffd25a' : ok ? '#36e06a' : back ? '#ff8a8a' : '#fffdf6'; g.beginPath(); g.roundRect(x + KB.gap / 2, y + KB.gap / 2 + (hot ? 5 : 0), w - KB.gap, h - KB.gap, 14); g.fill();
    g.fillStyle = '#23303a'; g.font = (k.length > 1 || /[⌫✅]/.test(k) ? '40px' : '46px') + ' "Lilita One", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(k === ' ' ? 'SPACE' : k, x + w / 2, y + h / 2 + (hot ? 7 : 2));
  }));
  comp.ktex.needsUpdate = true;
}
function btn(g, x, y, w, h, label, col, fn, size = 40) {
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(x, y + 6, w, h, 18); g.fill();
  g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill();
  g.fillStyle = '#16232b'; g.font = `${size}px "Lilita One", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h / 2 + 2);
  CP.hits.push({ x, y, w, h, fn });
}
function txt(g, s, x, y, size, col = '#fff6e0', align = 'center') { g.font = `${size}px "Lilita One", Impact, sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(s, x, y); }
function playersList() {
  const me = { n: MP.name || store.get('kg-name') || 'You', i: myId(), c: myFur(), me: true };
  return [me, ...[...MP.others.values()].map(f => ({ n: f.name, i: f.pid || '?', c: f.color }))];
}
function compDraw() {
  if (!CP.ready) return;
  const g = comp.sg; CP.hits = [];
  if (CP.hackT > 0) {   // shh
    g.fillStyle = '#021a06'; g.fillRect(0, 0, 1024, 576);
    for (let i = 0; i < 60; i++) txt(g, String.fromCharCode(0x30a0 + Math.floor(Math.random() * 90)), Math.random() * 1024, Math.random() * 576, 30, 'rgba(60,255,120,.5)');
    txt(g, 'ACCESS GRANTED', 512, 230, 84, '#5dff8f'); txt(g, '🌈 Secret rainbow fur unlocked!', 512, 340, 44, '#b8ffd0');
    btn(g, 362, 430, 300, 90, 'COOL!', '#5dff8f', () => { CP.hackT = 0; CP.page = 'color'; compDraw(); });
    comp.stex.needsUpdate = true; return;
  }
  const grad = g.createLinearGradient(0, 0, 0, 576); grad.addColorStop(0, '#163a4a'); grad.addColorStop(1, '#0e2230'); g.fillStyle = grad; g.fillRect(0, 0, 1024, 576);
  // tabs
  [['join', '🌐 Rooms'], ['name', '✏️ Name'], ['color', '🎨 Colors'], ['id', '🆔 My ID'], ['claude', '🤖 Claude']].forEach(([k, l], i) =>
    btn(g, 12 + i * 202, 12, 192, 84, l, CP.page === k ? '#ffd25a' : '#2fc6a3', () => { CP.page = k; if (k === 'name') CP.nameT = MP.name || store.get('kg-name') || ''; compDraw(); }, 32));
  const st = MP.status;
  if (CP.page === 'join') {
    if (st === 'off') {
      txt(g, 'Type a room code on the keyboard:', 512, 145, 40);
      g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.roundRect(312, 180, 400, 110, 20); g.fill();
      txt(g, (CP.code + '____').slice(0, 4).split('').join(' '), 512, 238, 84, '#ffd25a');
      btn(g, 120, 330, 360, 100, '✅ Join room', CP.code.length === 4 ? '#36e06a' : '#6a8f7c', () => compJoin());
      btn(g, 544, 330, 360, 100, '🏠 Make a room', '#ffd25a', () => { mpHost(); });
      txt(g, MP.note || 'Make a room, then tell friends the 4 numbers!', 512, 500, 32, '#bfe9dc');
    } else {
      txt(g, st === 'host' ? `🏠 Your room: ${MP.code}` : `🎉 In room ${MP.code}`, 512, 150, 62, '#ffd25a');
      playersList().forEach((p, i) => { txt(g, `${p.me ? '⭐ ' : '🐾 '}${p.n}  ·  ${p.i}`, 512, 225 + i * 52, 38, css(p.c)); });
      btn(g, 150, 450, 340, 90, '👋 Leave', '#ff8a8a', () => { mpLeave(); toast('👋 Left the room.', 2); compDraw(); });
      btn(g, 534, 450, 340, 90, !VC.mic ? '🎤 Mic on' : VC.muted ? '🔇 Unmute' : '🎤 Mute', !VC.mic || VC.muted ? '#ffd25a' : '#2fc6a3', () => { if (!VC.mic) { VC.asked = false; micOn(); } else setMute(!VC.muted); });
    }
  } else if (CP.page === 'name') {
    txt(g, 'Your name:', 512, 145, 42);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(162, 180, 700, 110, 20); g.fill();
    txt(g, CP.nameT + ((tAll * 2 | 0) % 2 ? '' : '|'), 512, 238, 72, '#ffd25a');
    btn(g, 120, 330, 360, 100, '🎲 Random', '#2fc6a3', () => { CP.nameT = MP_NAMES[Math.floor(Math.random() * MP_NAMES.length)] + Math.floor(Math.random() * 90 + 10); compDraw(); });
    btn(g, 544, 330, 360, 100, '✅ Save', '#36e06a', () => compSaveName());
    txt(g, 'Type on the keyboard, then press ✅', 512, 500, 32, '#bfe9dc');
  } else if (CP.page === 'color') {
    const rows = [['Fur', 'kg-fur', myFur()], ['Paws', 'kg-paw', myPawCol()]];
    const cols = readCol('kg-rainbow-ok') === 1 || store.get('kg-rainbow-ok') ? [...COMP_COLORS, -1] : COMP_COLORS;
    rows.forEach(([lab, key, cur], r) => {
      const y = 150 + r * 150; txt(g, lab, 30, y + 34, 44, '#fff6e0', 'left');
      cols.forEach((c, i) => {
        const x = 150 + i * 62, on = c === cur;
        g.fillStyle = on ? '#fff' : 'rgba(0,0,0,.4)'; g.beginPath(); g.roundRect(x - 4, y - 4, 60, 76, 14); g.fill();
        if (c === -1) { const rg = g.createLinearGradient(x, y, x + 52, y + 68); ['#ff4057', '#ffd25a', '#5dd35d', '#3fb2ff', '#8b6bff'].forEach((s, j) => rg.addColorStop(j / 4, s)); g.fillStyle = rg; } else g.fillStyle = css(c);
        g.beginPath(); g.roundRect(x, y, 52, 68, 10); g.fill();
        CP.hits.push({ x: x - 4, y: y - 4, w: 60, h: 76, fn: () => { store.set(key, c === -1 ? 'rainbow' : String(c)); applyMyColors(); if (ac) tone('sine', 500 + i * 40, 700 + i * 40, .08, .1); compDraw(); } });
      });
    });
    // a little preview critter
    const fc = myFur(), pc = myPawCol(), fx = fc === -1 ? `hsl(${(tAll * 90) % 360},80%,60%)` : css(fc), pcx = pc === -1 ? `hsl(${(tAll * 90 + 120) % 360},80%,60%)` : css(pc);
    g.fillStyle = fx; [[-1], [1]].forEach(([s]) => { g.beginPath(); g.moveTo(870 + s * 40, 440); g.lineTo(870 + s * 70, 380); g.lineTo(870 + s * 15, 420); g.fill(); });
    g.beginPath(); g.arc(870, 470, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; [-28, 28].forEach(dx => { g.beginPath(); g.arc(870 + dx, 460, 18, 0, 7); g.fill(); }); g.fillStyle = '#1a1a22'; [-28, 28].forEach(dx => { g.beginPath(); g.arc(870 + dx, 465, 9, 0, 7); g.fill(); });
    g.fillStyle = pcx; [-95, 95].forEach(dx => { g.beginPath(); g.arc(870 + dx, 520, 30, 0, 7); g.fill(); });
    txt(g, 'Friends see you in these colors!', 380, 490, 32, '#bfe9dc');
  } else if (CP.page === 'claude') {   // Claude buddy options (the hooks live in 95-claude-avatar.js)
    const C = window.__clOpts;
    if (!C) txt(g, 'Claude buddy is still loading…', 512, 280, 40);
    else {
      txt(g, 'Claude buddy', 512, 140, 48);
      if (!C.on()) { txt(g, 'Turn on your Claude buddy first! 🤖', 512, 250, 40, '#ffd25a'); txt(g, '(the orange orb by the spawn)', 512, 310, 32, '#bfe9dc'); }
      else {
        btn(g, 162, 190, 700, 110, C.ear() ? '👂 Always listening: ON' : '👂 Always listening: OFF', C.ear() ? '#36e06a' : '#6a8f7c', () => { C.setEar(!C.ear()); if (ac) tone('square', 300, 300, .04, .1); compDraw(); }, 46);
        txt(g, C.ear() ? 'Claude hears you whenever you talk.' : 'Poke the tiny mic to talk to Claude.', 512, 345, 34, '#bfe9dc');
      }
    }
  } else {
    txt(g, 'Your player ID', 512, 150, 44);
    txt(g, myId(), 512, 250, 120, '#ffd25a');
    txt(g, 'This is YOU! It stays the same on this headset.', 512, 350, 34, '#bfe9dc');
    txt(g, `Name: ${MP.name || store.get('kg-name') || '(none yet)'}`, 512, 420, 40, css(myFur()));
    if (st !== 'off') txt(g, `Room ${MP.code} · ${MP.others.size + 1} players`, 512, 490, 36, '#fff6e0');
  }
  comp.stex.needsUpdate = true;
}
function compJoin() {
  if (CP.code.length < 4) { MP.note = 'Type all 4 numbers first 🙂'; compDraw(); return; }
  if (CP.code === '1337') { CP.code = ''; store.set('kg-rainbow-ok', '1'); CP.hackT = 1; confetti(V(0, .9, .1).applyMatrix4(comp.g.matrixWorld), 40, [0x5dff8f, 0xb8ffd0, 0xffffff]); if (ac) [392, 523, 659, 784].forEach((f, i) => tone('square', f, f, .12, .08, i * .08)); compDraw(); return; }
  const c = CP.code; CP.code = ''; mpJoin(c);
}
function compSaveName() {
  if (setMyName(CP.nameT)) { toast(`✏️ Hi ${MP.name}!`, 2.5); if (ac) [660, 990].forEach((f, i) => tone('triangle', f, f, .15, .12, i * .08)); CP.page = 'id'; }
  else { CP.nameT = ''; }
  compDraw();
}
function compKey(k) {
  CP.flash = k; CP.flashT = .14; drawKb();
  if (ac) tone('square', 1500 + Math.random() * 500, 900, .03, .05);   // clicky!
  if (CP.hackT > 0) return;
  if (CP.page === 'join' && MP.status === 'off') {
    if (k === '⌫') CP.code = CP.code.slice(0, -1);
    else if (k === '✅') { compJoin(); return; }
    else if (/[0-9]/.test(k)) { if (CP.code.length < 4) CP.code += k; }
    else MP.note = 'Room codes are just numbers 🔢';
  } else if (CP.page === 'name') {
    if (k === '⌫') CP.nameT = CP.nameT.slice(0, -1);
    else if (k === '✅') { compSaveName(); return; }
    else if (CP.nameT.length < 12) CP.nameT += CP.nameT.length ? k.toLowerCase() : k;
  } else if (/[A-Z]/.test(k)) { CP.page = 'name'; CP.nameT = k; }
  compDraw();
}
function compTapScreen(u, v) { const x = u * 1024, y = (1 - v) * 576; const h = CP.hits.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); if (h) { if (ac) tone('sine', 800, 1100, .06, .1); h.fn(); return true; } return false; }
function compTapKb(u, v) {
  const x = u * 1024, y = (1 - v) * 456;
  for (let r = 0; r < KB_ROWS.length; r++) for (let c = 0; c < KB_ROWS[r].length; c++) { const [kx, ky, kw, kh] = keyRect(r, c); if (x >= kx && x <= kx + kw && y >= ky && y <= ky + kh) { compKey([...KB_ROWS[r]][c]); return true; } }
  return false;
}
/* ---------- poking: VR paws tap it; on desktop you look and click ---------- */
const _cpv = V(), _cpw = V(), _ray = new THREE.Raycaster();
function stepComputer(dt) {
  if (CP.flashT > 0 && (CP.flashT -= dt) <= 0) { CP.flash = null; drawKb(); }
  if (state.area !== 'grove') return;
  const near = _cpv.copy(COMP_AT).sub(rig.position).setY(0).lengthSq() < 9;
  comp.led.material.color.setHex((tAll * 2 | 0) % 2 ? 0x5dff8f : 0x2a8f4f);
  if (!near) return;
  if (CP.page === 'name' && ((tAll * 2 | 0) !== (CP.blinkS | 0))) { CP.blinkS = tAll * 2 | 0; compDraw(); }   // blinking cursor
  if (CP.page === 'color' && (myFur() === -1 || myPawCol() === -1) && (CP.rbT = (CP.rbT || 0) - dt) <= 0) { CP.rbT = .1; compDraw(); }
  if (!(state.xr || sim.on)) return;
  for (const h of hands) {
    if (!h.tracked) { CP.inK[h.i] = CP.inS[h.i] = false; continue; }
    // poke with your pointer finger when it's out (trigger let go), otherwise with the whole paw
    const point = h.paw.userData.curl && h.paw.userData.curl[1] < .45, P = point ? tipWorld(h, _cpw) : _cpw.copy(h.pos), tk = point ? .012 : PAW_R + .015, ts = point ? .015 : PAW_R + .03;
    // keyboard (lying flat, facing up)
    comp.kb.worldToLocal(_cpv.copy(P));
    const inK = Math.abs(_cpv.x) < .43 && Math.abs(_cpv.y) < .19 && _cpv.z < tk && _cpv.z > -.08;
    if (inK && !CP.inK[h.i]) { if (compTapKb(_cpv.x / .86 + .5, _cpv.y / .383 + .5)) buzz(h, .5, 30); }
    CP.inK[h.i] = inK ? true : (_cpv.z > tk + .015 || Math.abs(_cpv.x) > .45 || Math.abs(_cpv.y) > .21) ? false : CP.inK[h.i];
    // screen (standing up, facing you)
    comp.scr.worldToLocal(_cpv.copy(P));
    const inS = Math.abs(_cpv.x) < .45 && Math.abs(_cpv.y) < .253 && _cpv.z < ts && _cpv.z > -.1;
    if (inS && !CP.inS[h.i]) { if (compTapScreen(_cpv.x / .9 + .5, _cpv.y / .506 + .5)) buzz(h, .5, 30); }
    CP.inS[h.i] = inS ? true : (_cpv.z > ts + .02 || Math.abs(_cpv.x) > .47 || Math.abs(_cpv.y) > .27) ? false : CP.inS[h.i];
  }
}
function compDesk() {
  if (state.area !== 'grove' || state.xr) return false;
  headWorld(_cpv); _ray.set(_cpv, camera.getWorldDirection(V())); _ray.far = 2.6;
  const hit = _ray.intersectObjects([comp.scr, comp.kb], false)[0]; if (!hit || !hit.uv) return false;
  return hit.object === comp.scr ? (compTapScreen(hit.uv.x, hit.uv.y), true) : (compTapKb(hit.uv.x, hit.uv.y), true);
}
canvas.addEventListener('pointerdown', e => { if (state.mode === 'play' && !state.xr && e.button === 0 && (document.pointerLockElement === canvas || state.touch)) compDesk(); });
CP.ready = true; drawKb(); compDraw();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawKb(); compDraw(); });
window.__kg.comp = { CP, comp, compKey, compTapScreen, compTapKb, compDraw, myId, COMP_AT };
window.__kg.mp = { MP, mpHost, mpJoin, mpLeave, gotState, myState };
