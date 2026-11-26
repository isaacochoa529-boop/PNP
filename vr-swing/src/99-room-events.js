/* ======================================================================
   ROOM MODES + RANDOM EVENTS + TAG
   - Making a room, you pick 🎲 Random Events or 🙂 Regular (MP.mode 'rand' / 'reg', sent to joiners in 'hi').
   - Random Events: the host's game pops up a vote every 5 minutes (matches like Hide & Seek, Battle Royale
     and Tag pause the clock, then a new vote comes 20 s after they end). 3 choices from: the grove, the
     birthday party, the beach, Battle Royale, the physics range (Slicing Yard), horror mode, Tag,
     Hide & Seek. Everyone votes on floating cards (VR: poke one; PC: 1/2/3 or click; phone: tap). Net t:'ev'.
   - TAG: the tagger is 1.2x faster. Touch someone to pass it on; the new tagger is stunned for 2 s and
     can't tag for 2 s. Bots fill up to 4. Least time as IT wins. Net t:'tg'.
   Shared helpers used by 99-hide-seek too: mode cards, mode HUD, blindfold, bots, modeSpeed().
   ====================================================================== */
const EV_LIST = { grove: ['🌳', 'Knuckle Grove'], party: ['🎂', 'Birthday Party'], beach: ['🏖️', 'Knuckle Beach'], royale: ['⚔️', 'Battle Royale'], range: ['🧪', 'Physics Range'],
  horror: ['👻', 'Horror Mode'], tag: ['🏃', 'Tag'], hide: ['🙈', 'Hide & Seek'] };
const EV = { next: 30, vote: null, cur: 'grove', busy: false, nextLocal: 0, hudKey: '' };
const _ev1 = V(), _ev2 = V(), _ev3 = V(), _evq = new THREE.Quaternion();
MP.mode = MP.mode || 'reg';

/* ---------- screen bits: mode HUD, red edges, blindfold ---------- */
(() => {
  const st = document.createElement('style');
  st.textContent = `#mdHud{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:40;display:none;font:700 17px Fredoka,system-ui,sans-serif;color:#fff;text-align:center;pointer-events:none;text-shadow:0 2px 0 rgba(0,0,0,.45);background:rgba(10,14,24,.55);padding:6px 14px;border-radius:12px;white-space:pre-line}
  #mdRed{position:fixed;inset:0;z-index:29;pointer-events:none;display:none;background:radial-gradient(ellipse at center,rgba(255,0,0,0) 55%,rgba(255,20,40,.45))}
  #mdBlind{position:fixed;inset:0;z-index:44;pointer-events:none;display:none;background:#000;color:#fff;font:800 38px Fredoka,system-ui,sans-serif;align-items:center;justify-content:center;text-align:center;white-space:pre-line}
  #mdCards{position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:46;display:none;text-align:center;font:700 18px Fredoka,system-ui,sans-serif;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.5)}
  #mdCards .row{display:flex;gap:10px;justify-content:center;margin-top:6px}
  #mdCards button{min-width:120px;padding:10px 12px;border-radius:16px;border:3px solid #fff3;background:#1d2740;color:#fff;font:700 17px Fredoka,system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 0 #0008}
  #mdCards button b{display:block;font-size:34px}#mdCards button.on{border-color:#ffd25a;background:#3a3010}
  .mdBtn{position:fixed;left:12px;z-index:20;width:52px;height:52px;border-radius:50%;border:0;font-size:26px;cursor:pointer;display:none}
  #mdEv{position:fixed;right:10px;bottom:10px;z-index:20;font:600 14px Fredoka,system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.45);padding:4px 10px;border-radius:10px;display:none;pointer-events:none}`;
  document.head.appendChild(st);
  const mk = (id, tag = 'div') => { const d = document.createElement(tag); d.id = id; document.body.appendChild(d); return d; };
  mk('mdHud'); mk('mdRed'); mk('mdBlind'); mk('mdEv');
  const c = mk('mdCards'); c.innerHTML = '<div id="mdCardT"></div><div class="row" id="mdCardRow"></div>';
  const b1 = mk('mdTagBtn', 'button'); b1.className = 'mdBtn'; b1.textContent = '🏃'; b1.title = 'Tag'; b1.style.bottom = '144px'; b1.style.background = '#ff8a3d'; b1.style.boxShadow = '0 4px 0 #a04a10'; b1.onclick = () => tgStartAsk();
  const b2 = mk('mdHideBtn', 'button'); b2.className = 'mdBtn'; b2.textContent = '🙈'; b2.title = 'Hide & Seek'; b2.style.bottom = '204px'; b2.style.background = '#8b6bff'; b2.style.boxShadow = '0 4px 0 #4a2fa0'; b2.onclick = () => hsStartAsk();
})();
const mdWrist = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.14, .07), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false })); m.renderOrder = 9; m.visible = false; scene.add(m);
  return { c, t, m };
})();
let mdKey = '';
function mdHud(lines, col = '#ffd25a') {   // lines = null hides it
  const k = lines ? lines.join('|') + col + state.xr : ''; if (k === mdKey) return; mdKey = k;
  const h = $('mdHud'); h.style.display = lines && !state.xr ? 'block' : 'none'; if (lines) h.textContent = lines.join('\n');
  mdWrist.m.visible = !!lines && state.xr;
  if (!lines) return;
  const g = mdWrist.c.getContext('2d'); g.clearRect(0, 0, 256, 128); g.fillStyle = 'rgba(10,14,24,.88)'; g.beginPath(); g.roundRect(0, 0, 256, 128, 22); g.fill();
  g.strokeStyle = col; g.lineWidth = 5; g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.slice(0, 3).forEach((l, i) => { g.font = (i ? '600 24px' : '700 30px') + ' Fredoka, sans-serif'; g.fillText(l, 128, 30 + i * 36, 240); });
  mdWrist.t.needsUpdate = true;
}
const BLIND = (() => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 10), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }));
  m.renderOrder = 990; m.visible = false; m.layers.set(FP_LAYER); camera.add(m);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(.24, .12), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  p.renderOrder = 991; p.position.z = -.18; p.layers.set(FP_LAYER); m.add(p);
  return { m, c, t, msg: null };
})();
function blind(msg) {   // msg = null: you can see again
  const on = msg !== null && msg !== undefined;
  BLIND.m.visible = on && (state.xr || sim.on); const d = $('mdBlind'); d.style.display = on && !state.xr ? 'flex' : 'none';
  if (!on || msg === BLIND.msg) { if (!on) BLIND.msg = null; return; }
  BLIND.msg = msg; d.textContent = msg;
  const g = BLIND.c.getContext('2d'); g.clearRect(0, 0, 512, 256); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  msg.split('\n').forEach((l, i, a) => { g.font = (i ? '600 34px' : '800 52px') + ' Fredoka, sans-serif'; g.fillText(l, 256, 128 + (i - (a.length - 1) / 2) * 60, 500); }); BLIND.t.needsUpdate = true;
}

/* ---------- pick-a-card (votes, ghost choice): DOM buttons + floating VR cards you poke ---------- */
const CARDS = { on: false, opts: [], pick: null, cb: null, counts: {}, g: null, cards: [], inside: [false, false], title: '' };
function cardTex(o, sel, n) {
  const c = o.cv || (o.cv = document.createElement('canvas')); c.width = 256; c.height = 300; const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 300); g.fillStyle = sel ? '#3a3010' : '#1d2740'; g.beginPath(); g.roundRect(6, 6, 244, 288, 30); g.fill();
  g.lineWidth = 10; g.strokeStyle = sel ? '#ffd25a' : '#ffffff55'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '110px serif'; g.fillStyle = '#fff'; g.fillText(o.e, 128, 110);
  g.font = '700 32px Fredoka, sans-serif'; g.fillText(o.l, 128, 205, 236);
  if (n !== undefined) { g.font = '600 30px Fredoka, sans-serif'; g.fillStyle = '#ffd25a'; g.fillText('🗳️ ' + n, 128, 255); }
  if (!o.tex) { o.tex = new THREE.CanvasTexture(c); o.tex.colorSpace = THREE.SRGBColorSpace; } else o.tex.needsUpdate = true;
  return o.tex;
}
function cardsShow(title, opts, cb, showCounts) {
  cardsHide(); CARDS.on = true; CARDS.opts = opts.map(o => ({ ...o })); CARDS.pick = null; CARDS.cb = cb; CARDS.counts = {}; CARDS.showCounts = !!showCounts; CARDS.title = title;
  $('mdCardT').textContent = title + (state.xr ? '' : IS_TOUCH ? '  (tap one)' : '  (press 1, 2' + (opts.length > 2 ? ' or 3' : '') + ')');
  const row = $('mdCardRow'); row.innerHTML = '';
  CARDS.opts.forEach((o, i) => { const b = document.createElement('button'); b.innerHTML = `<b>${o.e}</b>${o.l}<span></span>`; b.onclick = () => cardsPick(i); o.btn = b; row.appendChild(b); });
  $('mdCards').style.display = state.xr ? 'none' : 'block';
  const g = new THREE.Group(); scene.add(g); CARDS.g = g;
  const tt = labelTex(512, 96, (q, w, h) => signText(q, w, h, [[title, 40, '#ffd25a', 52]], 'rgba(14,20,30,.9)', '#ffd25a'));
  const tm = new THREE.Mesh(new THREE.PlaneGeometry(.9, .17), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthTest: false })); tm.renderOrder = 12; tm.position.y = .3; g.add(tm);
  CARDS.cards = CARDS.opts.map((o, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(.26, .3), new THREE.MeshBasicMaterial({ map: cardTex(o, false, showCounts ? 0 : undefined), transparent: true, depthTest: false }));
    m.renderOrder = 12; m.position.x = (i - (CARDS.opts.length - 1) / 2) * .31; g.add(m); return m; });
  g.visible = state.xr || sim.on; CARDS.placed = false;
  if (ac) [660, 880, 990].forEach((f, i) => tone('triangle', f, f, .14, .1, i * .08));
}
function cardsHide() {
  CARDS.on = false; $('mdCards').style.display = 'none';
  if (CARDS.g) { scene.remove(CARDS.g); CARDS.g.traverse(o => { if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } if (o.geometry) o.geometry.dispose(); }); CARDS.g = null; }
  CARDS.cards = []; CARDS.opts = [];
}
function cardsPick(i) {
  if (!CARDS.on || !CARDS.opts[i]) return; CARDS.pick = i;
  CARDS.opts.forEach((o, j) => { o.btn.className = j === i ? 'on' : ''; if (CARDS.cards[j]) CARDS.cards[j].material.map = cardTex(o, j === i, CARDS.showCounts ? CARDS.counts[o.k] || 0 : undefined); });
  if (ac) tone('sine', 700, 1100, .1, .12); hands.forEach(h => buzz(h, .6, 40));
  if (CARDS.cb) CARDS.cb(CARDS.opts[i].k, i);
}
function cardsCounts(c) {
  if (!CARDS.on) return; CARDS.counts = c || {};
  CARDS.opts.forEach((o, j) => { const n = CARDS.counts[o.k] || 0; o.btn.querySelector('span').textContent = CARDS.showCounts ? ` · 🗳️ ${n}` : ''; if (CARDS.cards[j]) cardTex(o, j === CARDS.pick, CARDS.showCounts ? n : undefined); });
}
addEventListener('keydown', e => {
  if (!CARDS.on || state.xr || document.activeElement.tagName === 'INPUT') return;
  const m = /^Digit([1-3])$/.exec(e.code); if (!m || !CARDS.opts[+m[1] - 1]) return;
  e.stopImmediatePropagation(); cardsPick(+m[1] - 1);
}, true);
function stepCards(dt) {
  if (!CARDS.on || !CARDS.g) return;
  const vr = state.xr || sim.on; CARDS.g.visible = vr; $('mdCards').style.display = vr ? 'none' : 'block'; if (!vr) return;
  // float in front of you (a little below eye height), gently following where you look
  headWorld(_ev1); camera.getWorldDirection(_ev2); _ev2.y = 0; if (_ev2.lengthSq() < 1e-4) _ev2.set(0, 0, -1); _ev2.normalize();
  _ev3.copy(_ev1).addScaledVector(_ev2, .55); _ev3.y -= .22;
  if (!CARDS.placed || CARDS.g.position.distanceTo(_ev3) > .5) { CARDS.g.position.copy(_ev3); CARDS.placed = true; } else CARDS.g.position.lerp(_ev3, Math.min(1, dt * 2));
  CARDS.g.lookAt(_ev1.x, CARDS.g.position.y, _ev1.z); CARDS.g.updateMatrixWorld(true);
  for (const h of hands) {
    if (!h.tracked) continue; let inside = -1;
    CARDS.cards.forEach((m, i) => { m.worldToLocal(_ev1.copy(h.pos)); if (Math.abs(_ev1.x) < .13 && Math.abs(_ev1.y) < .15 && Math.abs(_ev1.z) < .07) inside = i; });
    if (inside >= 0 && CARDS.inside[h.i] !== inside) cardsPick(inside);
    CARDS.inside[h.i] = inside;
  }
}

/* ---------- bots (Tag + Hide & Seek): a Thumpling that walks on the ground ---------- */
function mdBot(id, name, col) {
  const f = makeFriend(col, col, name); f.arms && f.arms.forEach(a => { a.up.visible = a.fore.visible = a.elbow.visible = false; });
  return { id, name, f, p: V(), yaw: 0, walk: 0, wp: V(), wT: 0, np: null, ny: null, stun: 0 };
}
function mdPoseBot(b) {
  const f = b.f, y = b.yaw, gy0 = b.p.y, hy = gy0 + AVATAR_EYE + Math.abs(Math.sin(b.walk)) * .04, fx = Math.sin(y), fz = Math.cos(y);
  f.head.position.set(b.p.x, hy, b.p.z); f.head.rotation.set(0, y + Math.PI, 0);
  if (f.root) { f.root.position.set(b.p.x - fx * .03, gy0, b.p.z - fz * .03); f.root.rotation.set(0, y + Math.PI, 0); f.root.scale.setScalar(1); f.head.scale.setScalar(1); } else f.body.position.set(b.p.x, gy0 + (hy - gy0) * .45, b.p.z);
  f.paws.forEach((p, i) => { const sd = i ? -1 : 1, sw = Math.sin(b.walk + i * Math.PI) * .1; p.visible = true; p.scale.set(i ? 1 : -1, 1, 1); p.position.set(b.p.x + fx * (.26 + sw) + fz * sd * .2, hy - .32, b.p.z + fz * (.26 + sw) - fx * sd * .2); p.rotation.set(0, y + Math.PI, 0); });
  f.label.position.set(b.p.x, hy + .42, b.p.z);
}
function mdBotWalk(b, dt, sp, ground) {   // walk toward b.wp; trees and rocks push it aside
  _ev1.subVectors(b.wp, b.p).setY(0); const dist = _ev1.length(), mv = dist > .4 ? sp : 0;
  if (mv) b.p.addScaledVector(_ev1.normalize(), Math.min(dist, mv * dt));
  b.p.y = ground ? ground(b.p.x, b.p.z) : groundAt(b.p.x, b.p.z);
  _ev2.copy(b.p); _ev2.y += .5; const hit = pawHit(_ev2, .3); if (hit && hit.n.y < .7) { b.p.addScaledVector(hit.n.setY(0), .3 - hit.d); }
  b.walk = mv ? b.walk + dt * 9 : b.walk * .9; if (mv) b.yaw = Math.atan2(_ev1.x, _ev1.z);
  return dist;
}
function placeMe(x, z, y) {   // drop the player at a spot
  rig.position.set(x, y ?? groundAt(x, z), z); rig.position.y += state.bodyH - eyeLocal(_ev1).y + .05;
  state.vel.set(0, 0, 0); state.velBuf.length = 0; state.wasStuck = false; hands.forEach(h => { h.stuck = false; h.ready = false; });
}
// faster (tagger 1.2x, seeker 1.5x) and frozen (stunned tagger, counting seeker)
function modeSpeed() { if (TG.on && TG.it === brMe()) return 1.2; return hsSpeed(); }
let mdPin = null;
function mdFreeze(on) {   // keep you where you are this frame
  if (!on) { mdPin = null; return; }
  if (!mdPin) mdPin = rig.position.clone(); rig.position.copy(mdPin); state.vel.set(0, 0, 0); state.velBuf.length = 0;
}
const mdIdName = id => id === brMe() ? 'You' : (MP.others.get(id) || {}).name || TG.names.get(id) || HS.names.get(id) || 'Someone';
const mdPeople = () => [brMe(), ...(online() ? [...MP.others.keys()] : [])].slice(0, 4);
const MD_BOT_COLS = [0xff9a3c, 0x9a6bff, 0x5fd94a, 0xff4fc3];
const MD_BOT_NAMES = ['Bonkers 🤖', 'Sir Whiskers 🤖', 'Turbo Toast 🤖', 'Noodle 🤖', 'Captain Crunch 🤖', 'Pickle 🤖'];
function mdHeadOf(id) {   // where someone's head is (me, a friend or a bot)
  if (id === brMe()) return headWorld(V());
  const f = MP.others.get(id); if (f) return f.head.position;
  const b = TG.bots.find(x => x.id === id) || HS.bots.find(x => x.id === id); return b ? b.f.head.position : null;
}

/* ======================= RANDOM EVENTS ======================= */
function evHome() { if (state.area === 'arena') travel(false); state.area = 'grove'; respawn(); }
function evCleanup(k) {
  if (TG.on) tgClear();
  if (HS.phase !== 'off') hsClear();
  if (BR.phase !== 'off') brClear();
  if (HZ.on && k !== 'horror') { HZ.fromNet = true; setHorror(false, true); HZ.fromNet = false; }
  if (typeof PT !== 'undefined' && PT.inside && k !== 'party') { PT.inside = false; PT.fall = false; }
}
function evGo(d) {   // everyone: the vote is done, go!
  const k = d.k; cardsHide(); EV.vote = null; EV.cur = k; EV.nextLocal = d.n || 300; evCleanup(k);
  const [e, l] = EV_LIST[k] || ['🎲', k];
  brBig(`${e} ${l}!`, 2.5); setTimeout(() => { if ($('brBig').textContent === `${e} ${l}!`) brBig(''); }, 2600);
  sfxWhoosh();
  if (k === 'grove') { evHome(); toast('🌳 Back to Knuckle Grove! Free play until the next vote.', 4); }
  else if (k === 'horror') { evHome(); HZ.fromNet = true; setHorror(true, true); HZ.fromNet = false; toast('👻 HORROR MODE... stay together...', 4); }
  else if (k === 'party') { if (!(typeof PT !== 'undefined' && PT.inside)) partyEnter(); }
  else if (k === 'beach') { beachGo(); toast('🏖️ Beach time! Swim, build, chase the crabs!', 4); }
  else if (k === 'range') { evHome(); travel(true); }
  else evHome();   // royale / tag / hide: the host starts the match right after
}
function evPickOptions() {
  const keys = Object.keys(EV_LIST).filter(k => k !== EV.cur), out = [];
  while (out.length < 3 && keys.length) out.push(keys.splice(Math.floor(Math.random() * keys.length), 1)[0]);
  return out;
}
function evStartVote() {
  const d = { t: 'ev', e: 'vote', o: evPickOptions(), dur: 20 }; netSend(d); evGotVote(d);
}
function evGotVote(d) {
  EV.vote = { o: d.o, t: d.dur || 20, by: new Map(), counts: {} };
  cardsShow('🎲 VOTE for the next event!', d.o.map(k => ({ k, e: EV_LIST[k][0], l: EV_LIST[k][1] })), k => {
    if (MP.host || !online()) evVoteIn(brMe(), k); else netSend({ t: 'ev', e: 'v', k });
  }, true);
  toast(state.xr ? '🎲 Time to VOTE! Poke a card with your paw.' : '🎲 Time to VOTE! Pick the next event.', 4);
}
function evVoteIn(id, k) {   // host: count a vote
  if (!EV.vote || !EV.vote.o.includes(k)) return; EV.vote.by.set(id, k);
  const c = {}; for (const v of EV.vote.by.values()) c[v] = (c[v] || 0) + 1; EV.vote.counts = c;
  netSend({ t: 'ev', e: 'cnt', c }); cardsCounts(c);
}
function evFinish() {
  const v = EV.vote, c = v.counts; let best = -1, win = [];
  v.o.forEach(k => { const n = c[k] || 0; if (n > best) { best = n; win = [k]; } else if (n === best) win.push(k); });
  const k = win[Math.floor(Math.random() * win.length)], d = { t: 'ev', e: 'go', k, n: ['royale', 'tag', 'hide'].includes(k) ? 0 : 300 };
  netSend(d); evGo(d); EV.next = 300;
  setTimeout(() => { if (!MP.host && online()) return; if (k === 'royale') brStartAsk('grove'); else if (k === 'tag') tgStartAsk(true); else if (k === 'hide') hsStartAsk(true); }, 600);
}
function evNet(d) {
  if (d.e === 'vote') evGotVote(d);
  else if (d.e === 'v') { if (MP.host) evVoteIn(d.from, d.k); }
  else if (d.e === 'cnt') cardsCounts(d.c);
  else if (d.e === 'go') evGo(d);
}
function stepEvents(dt) {
  const rand = online() && MP.mode === 'rand';
  if (!rand && EV.vote) { EV.vote = null; cardsHide(); }
  const busy = BR.phase !== 'off' || HS.phase !== 'off' || TG.on;
  if (EV.vote) EV.vote.t -= dt;
  EV.nextLocal = Math.max(0, EV.nextLocal - (busy ? 0 : dt));
  // little corner clock for Random Events rooms
  const ev = $('mdEv'), show = rand && state.mode === 'play' && !state.xr && !busy;
  ev.style.display = show ? 'block' : 'none';
  if (show) { const s = EV.vote ? Math.ceil(EV.vote.t) : Math.ceil(MP.host ? EV.next : EV.nextLocal); ev.textContent = EV.vote ? `🗳️ Voting… ${s}s` : `🎲 Next vote in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  if (!rand || !MP.host) { EV.busy = busy; return; }
  if (EV.vote) { if (EV.vote.t <= 0 || EV.vote.by.size >= MP.conns.size + 1) evFinish(); return; }
  if (EV.busy && !busy) EV.next = Math.min(EV.next, 20);   // a match just ended: vote again soon
  EV.busy = busy; if (busy) return;
  if ((EV.next -= dt) <= 0) evStartVote();
}

/* ======================= TAG ======================= */
const TG = { on: false, t: 0, dur: 240, it: null, players: [], names: new Map(), bots: [], itTime: new Map(), stun: 0, noTag: 0, botT: 0, sign: null, mark: new Map(), endT: 0, ended: false };
const TG_SIGN = (() => {   // the 🔥 IT marker that floats over the tagger
  const t = labelTex(256, 96, (q, w, h) => signText(q, w, h, [['🔥 IT!', 56, '#ff4040', 52]], 'rgba(30,6,6,.9)', '#ff4040'));
  return () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(.42, .16, 1); s.renderOrder = 9; return s; };
})();
const TG_SPOT = V(0, 0, 0);
function tgStartAsk(fromVote) {
  if (TG.on) { if (!online() || MP.host) { const d = { t: 'tg', e: 'stop' }; netSend(d); tgClear(); toast('🏃 Tag stopped. Back to free play!', 3); } return; }
  if (online() && !MP.host) { toast('🏃 Only the room host can start Tag. Ask them!', 4); return; }
  if (HS.phase !== 'off' || BR.phase !== 'off') { toast('⏳ Finish the game that is going on first!', 3); return; }
  if (!fromVote && state.area !== 'grove') evHome();
  const players = mdPeople(), nb = Math.max(0, 4 - players.length), seed = (Math.random() * 1e9) | 0;
  const bots = Array.from({ length: nb }, (_, i) => ['tbot' + i, MD_BOT_NAMES[(i + seed) % MD_BOT_NAMES.length], MD_BOT_COLS[i % 4]]);
  const all = [...players, ...bots.map(b => b[0])], it = all[Math.floor(Math.random() * all.length)], a0 = Math.random() * 6.28, spots = {};
  all.forEach((id, i) => { const a = a0 + i / all.length * 6.283; spots[id] = [r3(Math.cos(a) * 7), r3(Math.sin(a) * 7)]; });
  const names = {}; players.forEach(id => names[id] = id === brMe() ? (MP.name || 'Host') : ((MP.others.get(id) || {}).name || 'Friend'));
  const d = { t: 'tg', e: 'start', it, players, names, bots, spots, dur: 240 }; netSend(d); tgStart(d);
}
function tgStart(d) {
  tgClear(); evHome(); TG.on = true; TG.ended = false; TG.t = 0; TG.dur = d.dur || 240; TG.it = d.it; TG.players = [...d.players, ...d.bots.map(b => b[0])];
  TG.names = new Map(Object.entries(d.names)); d.bots.forEach(b => TG.names.set(b[0], b[1])); TG.itTime = new Map(TG.players.map(id => [id, 0]));
  TG.bots = d.bots.map(([id, name, col]) => { const b = mdBot(id, name, col), s = d.spots[id]; b.p.set(s[0], 0, s[1]); b.wp.copy(b.p); scene.add(b.f.g); return b; });
  const s = d.spots[brMe()]; if (s && d.players.includes(brMe())) { placeMe(s[0], s[1], 0); if (!state.xr) state.yaw = Math.atan2(s[0], s[1]); }
  tgGotIt(d.it, null, true);
  toast(`🏃 TAG! ${TG.it === brMe() ? 'YOU are IT! Touch someone to pass it on!' : mdIdName(TG.it) + ' is IT! RUN!'}`, 5);
}
function tgGotIt(to, by, first) {
  TG.it = to; TG.lastTag = tAll;
  if (to === brMe()) { TG.stun = first ? 3 : 2; TG.noTag = TG.stun; hands.forEach(h => buzz(h, 1, 150)); if (ac) { tone('square', 300, 120, .3, .12); } if (!first) brBig('😵 YOU\'RE IT!', 1.5); setTimeout(() => { if ($('brBig').textContent.includes('IT!')) brBig(''); }, 1600); }
  else { if (by === brMe()) { confetti(mdHeadOf(to).clone(), 30, [0xff4040, 0xffd25a, 0xffffff]); if (ac) tone('triangle', 700, 1400, .2, .14); } else if (ac) tone('sine', 500, 300, .12, .08); }
  const b = TG.bots.find(x => x.id === to); if (b) { b.stun = first ? 3 : 2; b.noTag = b.stun; }
  if (!first) { const msg = `🏃 ${mdIdName(by)} tagged ${mdIdName(to)}!`; brFeed(msg); }
}
function tgSendTag(to) { if (TG.it !== brMe() && !TG.bots.some(b => b.id === TG.it)) return; const d = { t: 'tg', e: 'tag', to, by: TG.it }; netSend(d); tgGotIt(to, d.by); }
function tgEnd(d) {
  TG.ended = true; TG.endT = 6;
  const me = d.w === brMe(); brBig(me ? '🏆 YOU WIN TAG!\nLeast time as IT!' : `🏆 ${d.wn} wins Tag!`, 5);
  toast(`🔥 ${mdIdName(d.it)} was IT at the end. ${d.wn} was IT for only ${d.ws} seconds!`, 6);
  if (me) { confetti(headWorld(V()), 120); if (ac) [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .25, .14, i * .15)); }
}
function tgClear() {
  TG.on = false; TG.bots.forEach(b => { scene.remove(b.f.g); }); TG.bots = []; TG.mark.forEach(s => s.parent && s.parent.remove(s)); TG.mark.clear(); TG.stun = 0; TG.noTag = 0;
  mdHud(null); $('mdRed').style.display = 'none'; mdFreeze(false); brBig('');
}
function tgNet(d) {
  if (d.e === 'start') tgStart(d);
  else if (d.e === 'stop') { tgClear(); toast('🏃 Tag stopped.', 2); }
  else if (d.e === 'tag') { if (TG.on && d.by === TG.it) tgGotIt(d.to, d.by); }
  else if (d.e === 'end') { if (TG.on) tgEnd(d); }
  else if (d.e === 'bots') { for (const s of d.b) { const b = TG.bots.find(x => x.id === s[0]); if (!b) continue; b.np = (b.np || V()).set(s[1], 0, s[2]); b.yaw = s[3]; b.walk = s[4] ? b.walk + .15 : b.walk * .9; } }
}
function tgTouch(head, p) {   // did someone's body (head p) get touched by MY paws or body?
  for (const h of hands) { if (!h.paw.visible) continue; if (h.pos.distanceTo(p) < .42 || h.pos.distanceTo(_ev3.copy(p).setY(p.y - .35)) < .45) return true; }
  return Math.hypot(head.x - p.x, head.z - p.z) < .75 && Math.abs(head.y - p.y) < 1;
}
function stepTag(dt) {
  if (!TG.on) return;
  const me = brMe(), host = !online() || MP.host;
  if (TG.ended) { if ((TG.endT -= dt) < 0) { tgClear(); } return; }
  TG.t += dt; TG.itTime.set(TG.it, (TG.itTime.get(TG.it) || 0) + dt);
  TG.stun = Math.max(0, TG.stun - dt); TG.noTag = Math.max(0, TG.noTag - dt);
  mdFreeze(TG.stun > 0 && TG.it === me);
  // I'm IT: touch someone
  if (TG.it === me && TG.noTag <= 0) {
    const hw = headWorld(_ev1).clone();
    for (const id of TG.players) { if (id === me) continue; const p = mdHeadOf(id); if (p && tgTouch(hw, p)) { tgSendTag(id); break; } }
  }
  // bots (the host thinks for them)
  for (const b of TG.bots) {
    b.stun = Math.max(0, b.stun - dt); b.noTag = Math.max(0, (b.noTag || 0) - dt);
    if (host) {
      if (b.stun > 0) { b.walk *= .9; }
      else if (TG.it === b.id) {   // chase the closest one
        let best = null, bd = 1e9; for (const id of TG.players) { if (id === b.id) continue; const p = mdHeadOf(id); if (!p) continue; const d = Math.hypot(p.x - b.p.x, p.z - b.p.z); if (d < bd) { bd = d; best = [id, p]; } }
        if (best) { b.wp.set(best[1].x, 0, best[1].z); if (bd < .8 && b.noTag <= 0 && Math.abs(best[1].y - b.f.head.position.y) < 1.2) tgSendTag(best[0]); }
        mdBotWalk(b, dt, 4.2 * 1.2, () => 0);
      } else {   // run away from IT, otherwise wander around the grove
        const p = mdHeadOf(TG.it); const d = p ? Math.hypot(p.x - b.p.x, p.z - b.p.z) : 99;
        if (p && d < 9) { _ev2.set(b.p.x - p.x, 0, b.p.z - p.z).normalize(); if (Math.hypot(b.p.x, b.p.z) > 14) _ev2.add(_ev3.set(-b.p.x, 0, -b.p.z).normalize().multiplyScalar(.8)).normalize(); b.wp.copy(b.p).addScaledVector(_ev2, 4); }
        else if ((b.wT -= dt) < 0) { b.wT = 2 + Math.random() * 3; const a = Math.random() * 6.28, r = 3 + Math.random() * 11; b.wp.set(Math.cos(a) * r, 0, Math.sin(a) * r); }
        mdBotWalk(b, dt, d < 9 ? 4.2 : 2.2, () => 0);
      }
    } else if (b.np) b.p.lerp(b.np, Math.min(1, dt * 10));
    mdPoseBot(b);
  }
  if (host && online() && (TG.botT -= dt) < 0) { TG.botT = .1; netSend({ t: 'tg', e: 'bots', b: TG.bots.map(b => [b.id, r3(b.p.x), r3(b.p.z), r3(b.yaw), b.walk > .1 ? 1 : 0]) }); }
  // the 🔥 IT marker over the tagger
  for (const id of TG.players) {
    if (id === me) continue; const p = mdHeadOf(id); let s = TG.mark.get(id);
    if (id === TG.it && p) { if (!s) { s = TG_SIGN(); scene.add(s); TG.mark.set(id, s); } s.position.copy(p).add(_ev2.set(0, .62, 0)); s.scale.setScalar(1).set(.42, .16, 1); }
    else if (s) { scene.remove(s); TG.mark.delete(id); }
  }
  const left = Math.max(0, TG.dur - TG.t), ls = Math.ceil(left), clock = `${Math.floor(ls / 60)}:${String(ls % 60).padStart(2, '0')}`, mine = Math.round(TG.itTime.get(me) || 0);
  const amIt = TG.it === me;
  mdHud([amIt ? (TG.stun > 0 ? `😵 STUNNED ${TG.stun.toFixed(1)}` : '🔥 YOU\'RE IT! Tag someone!') : `🏃 RUN! ${mdIdName(TG.it)} is IT`, `⏱️ ${clock}   🔥 you: ${mine}s as IT`], amIt ? '#ff4040' : '#5fd94a');
  $('mdRed').style.display = amIt && !state.xr ? 'block' : 'none';
  if (mdWrist.m.visible && hands[0].tracked) { headWorld(_ev1); mdWrist.m.position.copy(hands[0].pos).add(_ev2.set(0, .1, 0)); mdWrist.m.lookAt(_ev1); }
  if (host && TG.t >= TG.dur) {
    let w = null, ws = 1e9; for (const [id, s] of TG.itTime) if (s < ws) { ws = s; w = id; }
    const d = { t: 'tg', e: 'end', w, wn: w === me ? (MP.name || 'Host') : mdIdName(w), ws: Math.round(ws), it: TG.it }; netSend(d); tgEnd(d);
  }
}

/* ---------- the grove start pedestals (next to the Battle Royale button) ---------- */
function mdPedestal(pos, title, col, hex) {
  const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
  part(new THREE.CylinderGeometry(.16, .2, .9, 20), smat(0x2b3446, { roughness: .5 }), 0, .45, 0, g);
  const cap = part(new THREE.SphereGeometry(.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), smat(col, { emissive: col, emissiveIntensity: .5, roughness: .3 }), 0, .9, 0, g); cap.scale.y = .5;
  const t = labelTex(512, 160, (q, w, h) => signText(q, w, h, [[title, 50, '#ffffff', 64], ['tap the button!', 38, hex, 122]], 'rgba(14,20,30,.95)', hex));
  const s = new THREE.Mesh(new THREE.PlaneGeometry(.6, .19), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide })); s.position.set(0, 1.25, 0); g.add(s);
  s.lookAt(0, 1.25, 0); s.rotation.set(0, Math.atan2(-pos.x, -pos.z), 0);
  addCol({ t: 1, x: pos.x, z: pos.z, cy: .45, hy: .45, r: .2, tag: 'rock' });
  return { g, cap, top: V(pos.x, .96, pos.z), in: [false, false] };
}
const MD_PEDS = [
  [mdPedestal(V(3.3, 0, -.4), '🏃 TAG', 0xff8a3d, '#ff8a3d'), () => tgStartAsk()],
  [mdPedestal(V(3.0, 0, -1.7), '🙈 HIDE & SEEK', 0x8b6bff, '#b9a4ff'), () => hsStartAsk()]
];
function stepModes(dt) {
  for (const [P, go] of MD_PEDS) {
    P.cap.material.emissiveIntensity = .4 + Math.sin(tAll * 4 + P.g.position.x) * .2;
    if (state.area !== 'grove') continue;
    for (const h of hands) { if (!h.tracked || !(state.xr || sim.on)) continue; const inside = h.pos.distanceTo(P.top) < .13; if (inside && !P.in[h.i]) { buzz(h, .7, 40); go(); } P.in[h.i] = inside; }
  }
  const showBtns = state.mode === 'play' && !state.xr ? 'block' : 'none'; $('mdTagBtn').style.display = showBtns; $('mdHideBtn').style.display = showBtns;
  stepCards(dt); stepEvents(dt); stepTag(dt); stepHideSeek(dt);
  if (!TG.on && HS.phase === 'off') { mdHud(null); $('mdRed').style.display = 'none'; mdFreeze(false); }
}
window.__kg.modes = { EV, TG, CARDS, evStartVote, evGo, evNet, evFinish, tgStartAsk, tgStart, tgNet, tgSendTag, cardsShow, cardsPick, mdHud, blind, modeSpeed };
