/* ======================================================================
   MULTIPLAYER (see each other): one player makes a room and gets a 4-digit code, up to 3 friends type it in.
   Peer to peer through PeerJS (WebRTC); the host passes everyone's head + paws along to everyone else.
   Nothing loads until you press a button, so playing alone needs no internet at all.
   ====================================================================== */
const MP = { peer: null, host: false, code: '', conns: new Map(), hostConn: null, others: new Map(), sendT: 0, myColor: 0, name: '', status: 'off', typed: '' };
const MP_MAX = 4, MP_PREFIX = 'knucklegrove-room-', MP_COLORS = [0x2fc6a3, 0xff8a3d, 0x8b6bff, 0xff4fa8, 0xffd25a, 0x3fb2ff];
const MP_NAMES = ['Fuzzy', 'Bonk', 'Pebble', 'Noodle', 'Sprout', 'Biscuit', 'Wobble', 'Tater', 'Mochi', 'Zippy'];
const CP = { ready: false };
function mpNote(s) { const el = $('mpNote'); if (el) el.textContent = s; MP.note = s; compDraw(); }
function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return new Promise((ok, bad) => {
    const tryUrl = (urls) => {
      if (!urls.length) return bad(new Error('could not load'));
      const sc = document.createElement('script'); sc.src = urls[0]; sc.onload = () => window.Peer ? ok(window.Peer) : tryUrl(urls.slice(1)); sc.onerror = () => tryUrl(urls.slice(1)); document.head.appendChild(sc);
    };
    tryUrl(['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js']);
  });
}
function mpName() { const el = $('mpName'); let n = (el && el.value || '').trim().slice(0, 12); if (!n) n = MP_NAMES[Math.floor(Math.random() * MP_NAMES.length)] + Math.floor(Math.random() * 90 + 10); store.set('kg-name', n); return n; }
function mpLeave(quiet) {
  voiceStop();
  try { if (MP.peer) MP.peer.destroy(); } catch (e) {}
  MP.peer = null; MP.hostConn = null; MP.conns.clear(); MP.host = false; MP.code = ''; MP.status = 'off';
  for (const id of [...MP.others.keys()]) dropOther(id);
  MP.me = null; reassertAll();
  if (!quiet) mpNote('');
  mpUi();
}
async function mpHost() {
  mpLeave(true); MP.name = mpName(); mpNote('⏳ Making a room…'); micOn();
  let Peer; try { Peer = await loadPeerJS(); } catch (e) { mpNote('😕 Could not reach the internet. You can still play alone!'); return; }
  const tryCode = (left) => {
    const code = String(Math.floor(1000 + Math.random() * 9000)), peer = new Peer(MP_PREFIX + code);
    peer.on('open', () => {
      MP.peer = peer; MP.host = true; MP.code = code; MP.status = 'host'; MP.myColor = MP_COLORS[0]; MP.me = 'host';
      mpNote(`🏠 Your room code is ${code}. Tell your friends!`); mpUi(); toast(`🏠 Room ${code} is open! Friends type ${code} to join.`, 6);
    });
    peer.on('call', voiceAnswer);
    peer.on('connection', conn => {
      conn.on('open', () => {
        if (MP.conns.size >= MP_MAX - 1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
        const used = new Set([MP.myColor, ...[...MP.conns.values()].map(c => c.color)]), color = MP_COLORS.find(c => !used.has(c));
        conn.color = color; MP.conns.set(conn.peer, conn); conn.send({ t: 'hi', c: color, code }); sendSnap(conn);
        mpUi();
      });
      conn.on('data', d => { if (!d || !MP.conns.has(conn.peer)) return; if (d.t === 's') d.id = conn.peer; else d.from = conn.peer;
        if (d.t === 's') gotState(d); else netGot(d); for (const [id, c] of MP.conns) if (id !== conn.peer && c.open) c.send(d); });
      conn.on('close', () => { MP.conns.delete(conn.peer); byeOther(conn.peer); for (const c of MP.conns.values()) if (c.open) c.send({ t: 'bye', id: conn.peer }); mpUi(); });
    });
    peer.on('error', err => {
      if (err && err.type === 'unavailable-id' && left > 0) { try { peer.destroy(); } catch (e) {} tryCode(left - 1); return; }
      if (MP.status !== 'host') mpNote('😕 Could not make a room (' + (err && err.type || 'error') + '). Try again?');
    });
  };
  tryCode(4);
}
async function mpJoin(code) {
  mpLeave(true); MP.name = mpName(); mpNote(`⏳ Joining room ${code}…`); micOn();
  let Peer; try { Peer = await loadPeerJS(); } catch (e) { mpNote('😕 Could not reach the internet. You can still play alone!'); return; }
  const peer = new Peer(); MP.peer = peer; peer.on('call', voiceAnswer);
  const fail = (why) => { if (MP.status === 'joined') return; mpNote(why); mpLeave(true); mpNote(why); };
  const timer = setTimeout(() => fail(`😕 No room ${code} found. Check the number with your friend!`), 12000);
  peer.on('open', () => {
    const conn = peer.connect(MP_PREFIX + code, { reliable: true });
    conn.on('open', () => { MP.hostConn = conn; });
    conn.on('data', d => {
      if (!d) return;
      if (d.t === 'hi') { clearTimeout(timer); MP.status = 'joined'; MP.code = code; MP.myColor = d.c; MP.me = peer.id; reassertAll(); applyMyColors(); mpNote(`🎉 You're in room ${code}!`); mpUi(); toast(`🎉 Joined room ${code}!`, 4); }
      else if (d.t === 'full') { clearTimeout(timer); fail('😕 That room is full (4 players max).'); }
      else if (d.t === 's') gotState(d);
      else if (d.t === 'bye') byeOther(d.id);
      else netGot(d);
    });
    conn.on('close', () => { if (MP.status === 'joined') { toast('👋 The room closed.', 3); mpLeave(); } });
  });
  peer.on('error', err => { clearTimeout(timer); fail(err && err.type === 'peer-unavailable' ? `😕 No room ${code} found. Check the number with your friend!` : '😕 Could not connect (' + (err && err.type || 'error') + ').'); });
}

/* ---------- what we send: where your head and paws are, 20 times a second ---------- */
const _mq = new THREE.Quaternion(), _mpv = V();
const r3 = x => Math.round(x * 1000) / 1000;
function packPose(o) { o.updateMatrixWorld(); o.getWorldPosition(_mpv); o.getWorldQuaternion(_mq); return [r3(_mpv.x), r3(_mpv.y), r3(_mpv.z), r3(_mq.x), r3(_mq.y), r3(_mq.z), r3(_mq.w)]; }
function myState() {
  headWorld(_mpv); camera.getWorldQuaternion(_mq);
  const fc = myFur(), pc = myPawCol();
  const s = { t: 's', n: MP.name, i: myId(), c: fc, c2: pc, b: r3(state.bodyH), h: [r3(_mpv.x), r3(_mpv.y), r3(_mpv.z), r3(_mq.x), r3(_mq.y), r3(_mq.z), r3(_mq.w)] };
  s.p = hands.map(h => h.paw.visible ? packPose(h.paw) : 0);
  s.v = Math.round(VC.level * 20) / 20; if (BM.sc !== 1) { s.sz = BM.sc; s.b = r3(state.bodyH / BM.sc); }
  s.f = hands.map(h => (h.paw.userData.curl || [.25, .25, .25]).map(v => Math.round(v * 20) / 20));
  return s;
}
function mpSend(dt) {
  if (MP.status !== 'host' && MP.status !== 'joined') return;
  if ((MP.sendT -= dt) > 0) return; MP.sendT = .05;
  const s = myState();
  if (MP.host) { s.id = 'host'; for (const c of MP.conns.values()) if (c.open) c.send(s); }
  else if (MP.hostConn && MP.hostConn.open) MP.hostConn.send(s);
}

/* ---------- friends: a fuzzy head, a bean body, two paws and a name tag ---------- */
function makeFriend(color, pawC, name) {
  const g = new THREE.Group(), fur = new THREE.MeshStandardMaterial({ color: color < 0 ? 0xffffff : color, roughness: .85, flatShading: true });
  const paws = [makePaw(pawC < 0 ? 0xffffff : pawC), makePaw(pawC < 0 ? 0xffffff : pawC)]; paws[0].scale.x = -1; paws.forEach(p => g.add(p));
  let head, body, root = null, torso = null, arms = null;
  if (AV.tpl) {   // the same Thumpling you see in the mirror, in their colors
    const T = AV.tpl, f2 = T.fur.clone(); f2.color.set(color < 0 ? 0xffffff : color);
    const dress = o => { o.traverse(c => { if (c.isMesh) { c.userData.keep = true; c.castShadow = true; if (c.material.name === 'Fur') c.material = f2; } }); return o; };
    root = new THREE.Group(); g.add(root); torso = dress(T.torso.clone()); torso.position.set(0, -.12, 0); root.add(torso);
    head = dress(T.head.clone()); g.add(head); body = root; addMouth(head);
    arms = [0, 1].map(() => { const a = { up: dress(T.arm.clone()), fore: dress(T.arm.clone()), elbow: dress(T.elbow.clone()) }; g.add(a.up, a.fore, a.elbow); return a; });
    fur.dispose(); return finishFriend({ g, head, body, root, torso, arms, paws, name, color, pawC, fur: f2, thump: true });
  }
  head = new THREE.Group(); g.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(.17, 2), fur); skull.scale.set(1, .92, .95); head.add(skull);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), dark = new THREE.MeshBasicMaterial({ color: 0x1a1a22 });
  [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), white); e.position.set(sd * .065, .03, -.14); head.add(e); const pu = new THREE.Mesh(new THREE.SphereGeometry(.024, 8, 6), dark); pu.position.z = -.03; e.add(pu); });
  body = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .2, 4, 10), fur); g.add(body);
  return finishFriend({ g, head, body, paws, name, color, pawC, fur, thump: false });
}
function finishFriend(f) {
  const tag = textPanel(512, 128, () => {});
  const tg = tag.g; tg.fillStyle = 'rgba(16,40,34,.85)'; tg.beginPath(); tg.roundRect(6, 14, 500, 100, 50); tg.fill();
  tg.fillStyle = f.color < 0 ? '#ffd25a' : '#' + new THREE.Color(f.color).getHexString(); tg.font = '600 58px Fredoka, sans-serif'; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText(f.name, 256, 66); tag.t.needsUpdate = true;
  f.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tag.t, depthTest: false, transparent: true })); f.label.scale.set(.6, .15, 1); f.label.renderOrder = 8; f.g.add(f.label);
  f.g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(f.g);
  return Object.assign(f, { cur: null, tgt: null, seen: 0 });
}
// your own body wears the colors you picked on the computer too
function applyMyColors() {
  if (!AV.ready) return; const fc = myFur(), pc = myPawCol();
  if (fc >= 0) { AV.bodyFur.color.set(fc); if (!state.golden) AV.armFur.color.set(fc); }
  if (pc >= 0 && !state.golden) AV.pawFur.color.set(pc);
}
function stepMyColors() {
  if (!AV.ready) return; const fc = myFur(), pc = myPawCol();
  if (fc < 0) { AV.bodyFur.color.setHSL((tAll * .25) % 1, .8, .6); if (!state.golden) AV.armFur.color.copy(AV.bodyFur.color); }
  if (pc < 0 && !state.golden) AV.pawFur.color.setHSL((tAll * .25 + .33) % 1, .8, .6);
}
const _fS = V(), _fE = V(), _fW = V(), _fD = V(), _fP = V(), _fF = V();
function poseFriendArms(f, sc, yaw) {
  f.root.updateMatrixWorld(true);
  for (let side = 0; side < 2; side++) {
    const arm = f.arms[side], p = f.paws[side];
    f.torso.localToWorld(_fS.copy(SHOULDER[side]));
    p.updateMatrixWorld(); p.localToWorld(_fW.set(0, 0, .07));
    const l1 = L_UP * sc, l2 = L_FORE * sc;
    _fD.subVectors(_fW, _fS); let d = _fD.length(); _fD.multiplyScalar(1 / Math.max(d, 1e-5));
    let a1 = l1, a2 = l2; if (d > l1 + l2) { const k = d / (l1 + l2); a1 *= k; a2 *= k; }
    d = Math.max(d, 1e-3);
    const a = (a1 * a1 - a2 * a2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, a1 * a1 - a * a));
    _fP.set(side ? 1 : -1, -.7, .5).applyAxisAngle(_up, yaw); _fP.addScaledVector(_fD, -_fP.dot(_fD)).normalize();
    _fE.copy(_fS).addScaledVector(_fD, a).addScaledVector(_fP, hgt);
    placeSeg(arm.up, _fS, _fE, sc); placeSeg(arm.fore, _fE, _fW, sc * .95); arm.elbow.position.copy(_fE); arm.elbow.scale.setScalar(sc);
  }
}
const _fq = new THREE.Quaternion();
function gotState(d) {
  if (!d || !d.id || !Array.isArray(d.h)) return;
  let f = MP.others.get(d.id);
  const name = String(d.n || 'Friend').slice(0, 12), okc = x => x === -1 || (Number.isInteger(x) && x >= 0 && x <= 0xffffff);
  const c = okc(d.c) ? d.c : 0xffffff, c2 = okc(d.c2) ? d.c2 : c;
  if (!f || f.name !== name || f.color !== c || f.pawC !== c2) {
    const isNew = !f; if (f) dropOther(d.id, true); if (isNew) voiceMeet(d.id);
    f = makeFriend(c, c2, name); MP.others.set(d.id, f);
    if (isNew) { toast(`👋 ${name} is here!`, 3); if (ac) [660, 880].forEach((q, i) => tone('triangle', q, q, .2, .15, i * .1)); }
    mpUi();
  }
  f.pid = /^KG-[A-Z0-9]{4}$/.test(d.i) ? d.i : '?';
  f.tgt = d; f.seen = tAll; if (!f.cur) f.cur = JSON.parse(JSON.stringify(d));
}
function byeOther(id) { voiceBye(id); const f = MP.others.get(id); if (f) toast(`👋 ${f.name} left.`, 2.5); dropOther(id); dropOwner(id); }
function dropOther(id, quiet) { const f = MP.others.get(id); if (!f) return; if (f.rb && AR.world) f.rb.forEach(b => AR.world.removeRigidBody(b)); scene.remove(f.g); f.g.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); }); MP.others.delete(id); if (!quiet) mpUi(); }
function lerpPose(a, b, k) { if (!b) return a; if (!a) return b.slice(); for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * k; _fq.set(a[3], a[4], a[5], a[6]).slerp(_mq.set(b[3], b[4], b[5], b[6]), k); a[3] = _fq.x; a[4] = _fq.y; a[5] = _fq.z; a[6] = _fq.w; return a; }
function stepFriends(dt) {
  const k = 1 - Math.exp(-dt * 14);   // smooth between the 20-a-second updates
  for (const [id, f] of MP.others) {
    if (tAll - f.seen > 6) { byeOther(id); continue; }   // gone quiet: they probably lost connection
    const c = f.cur, t = f.tgt;
    if (!f.thump && AV.tpl) { f.color = null; continue; }   // the model just finished loading: rebuild them as a Thumpling
    if (f.color < 0) f.fur.color.setHSL((tAll * .25) % 1, .8, .6);   // rainbow fur!
    if (f.pawC < 0) f.paws.forEach(p => p.userData.fur.color.setHSL((tAll * .25 + .33) % 1, .8, .6));
    lerpPose(c.h, t.h, k); c.b = t.b;
    f.head.position.set(c.h[0], c.h[1], c.h[2]); f.head.quaternion.set(c.h[3], c.h[4], c.h[5], c.h[6]);
    f.talk = (f.talk || 0) + ((+t.v || 0) - (f.talk || 0)) * Math.min(1, dt * 18); setMouth(f.head, f.talk);   // their mouth moves when they talk
    const sz = clamp(+t.sz || 1, .5, 3), bh = clamp(c.b || .6, .35, 1.1) * sz;
    if (f.thump) {
      _fF.set(0, 0, -1).applyQuaternion(f.head.quaternion); const yaw = Math.atan2(-_fF.x, -_fF.z), sc = clamp(bh / sz / AVATAR_EYE, .75, 1.1) * sz;
      f.root.position.set(c.h[0] - _fF.x * .03, c.h[1] - bh, c.h[2] - _fF.z * .03); f.root.rotation.set(0, yaw, 0); f.root.scale.setScalar(sc); f.head.scale.setScalar(sc);
      f.label.position.set(c.h[0], c.h[1] + .38 * sc, c.h[2]);
    } else { f.body.position.set(c.h[0], c.h[1] - bh * .55, c.h[2]); f.body.scale.setScalar(clamp(bh / .7, .6, 1.3)); f.label.position.set(c.h[0], c.h[1] + .32, c.h[2]); }
    for (let i = 0; i < 2; i++) {
      const p = f.paws[i];
      if (t.f && t.f[i] && p.userData.curl) { const cc = p.userData.curl; for (let j = 0; j < 3; j++) cc[j] += ((+t.f[i][j] || 0) - cc[j]) * k; setCurl(p, cc); }
      p.scale.set((i ? 1 : -1) * sz, sz, sz);
      if (t.p && t.p[i]) { c.p = c.p || [0, 0]; c.p[i] = lerpPose(c.p[i] || null, t.p[i], k); p.visible = true; p.position.set(c.p[i][0], c.p[i][1], c.p[i][2]); p.quaternion.set(c.p[i][3], c.p[i][4], c.p[i][5], c.p[i][6]); }
      else { p.visible = true; _mpv.set(i ? .2 : -.2, -.3, -.25).applyQuaternion(_fq.set(0, f.head.quaternion.y, 0, f.head.quaternion.w).normalize()); p.position.copy(f.head.position).add(_mpv); p.quaternion.copy(_fq); }
    }
    if (f.thump) poseFriendArms(f, clamp(bh / AVATAR_EYE, .75, 1.1), f.root.rotation.y);
  }
}

/* ---------- the menu: a name box and a big number pad (no keyboard needed) ---------- */
function mpUi() {
  const st = MP.status, n = MP.others.size;
  $('mpStart').hidden = st !== 'off'; $('mpPad').hidden = !(st === 'off' && MP.padOpen); $('mpIn').hidden = st === 'off';
  if (st !== 'off') $('mpInfo').textContent = st === 'host' ? `🏠 Room ${MP.code} · ${MP.conns.size + 1}/4 players` : `🎉 In room ${MP.code} · ${n + 1} players`;
  $('mpCode').textContent = (MP.typed + '____').slice(0, 4).split('').join(' ');
  compDraw();
}
{
  const nm = $('mpName'); nm.value = store.get('kg-name') || ''; nm.placeholder = MP_NAMES[Math.floor(Math.random() * MP_NAMES.length)];
  nm.addEventListener('keydown', e => e.stopPropagation());
  nm.addEventListener('change', () => { setMyName(nm.value); compDraw(); });
  $('btnHost').onclick = () => mpHost();
  $('btnJoin').onclick = () => { MP.padOpen = !MP.padOpen; MP.typed = ''; mpUi(); };
  $('btnLeave').onclick = () => { mpLeave(); toast('👋 Left the room.', 2); };
  const pad = $('mpKeys');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✅'].forEach(k => {
    const b = document.createElement('button'); b.textContent = k; b.className = k === '✅' ? '' : 'alt';
    b.onclick = () => {
      if (k === '⌫') MP.typed = MP.typed.slice(0, -1);
      else if (k === '✅') { if (MP.typed.length === 4) { MP.padOpen = false; mpJoin(MP.typed); } else mpNote('Type all 4 numbers 🙂'); }
      else if (MP.typed.length < 4) { MP.typed += k; if (MP.typed.length === 4) { MP.padOpen = false; mpJoin(MP.typed); } }
      mpUi();
    };
    pad.appendChild(b);
  });
  mpUi();
}
