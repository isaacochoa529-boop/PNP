/* ======================================================================
   🙈 HIDE & SEEK on the big Wilds map (with the mall, the snowy lodge and the pyramid from 98-hs-buildings).
   One random player is the SEEKER (glowing red eye, 1.5x faster). Hiders get 1 minute to hide while the
   seeker counts with black eyes, then the seeker has 5 minutes. Hiders win if anyone is left.
   Seeker gear: CATCHER GUN (bursts a hider into stuffing; holster it: VR right stick click, PC X, phone ✋),
   a throwable REVEALER every 2 minutes (lights green if a hider is near, red if not; VR: left grip + let go,
   PC T, phone 🔮), and RADARS lying around the map (walk into one: it says which way most hiders are).
   Caught hiders pick a ghost: 😈 EVIL (touch the seeker = black eyes for 2 s, once a minute; DING a
   hider's spot once a minute: VR trigger, PC T, phone 🔔) or 😇 HOLY (every minute hiders see the seeker).
   The host runs the match + bots. Net: t:'hs'.
   ====================================================================== */
const HS = { phase: 'off', t: 0, seeker: null, players: [], names: new Map(), alive: new Set(), ghosts: new Map(), bots: [], hol: false, rev: 0, revGiven: 0, revs: [], radars: [],
  dingCd: 0, touchCd: 0, holyT: 0, evilT: 0, botT: 0, endT: 0, blindT: 0, gun: null, fireCd: 0, fire: false, wasTrig: false, fx: [], fGun: new Map(), eyes: new Map(), ghostM: new Map(),
  holdRev: false, arrow: null, arrowT: 0, radarMsg: '', radarMsgT: 0, beam: null, beamT: 0, pickT: 0, msgT: 0, ended: false };
const HS_HIDE = 60, HS_SEEK = 300, HS_REV_R = 12;
const _hs1 = V(), _hs2 = V(), _hs3 = V(), _hs4 = V(), _hsq = new THREE.Quaternion();
const hsMe = () => brMe();
function hsSpeed() { if (HS.phase === 'seek' && HS.seeker === hsMe()) return 1.5; if (HS.phase !== 'off' && HS.ghosts.has(hsMe())) return 1.3; return 1; }
function hsHasGun() { return HS.phase === 'seek' && HS.seeker === hsMe() && !HS.hol && HS.blindT <= 0; }
const hsWild = (x, z) => V(WILD.x + x, 0, WILD.z + z);
function compass(dx, dz) { const a = Math.atan2(dx, -dz), i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; return ['north ⬆️', 'north-east ↗️', 'east ➡️', 'south-east ↘️', 'south ⬇️', 'south-west ↙️', 'west ⬅️', 'north-west ↖️'][i]; }

/* ---------- models ---------- */
const HSM = (() => {
  const o = {};
  const orange = smat(0xff7a1a, { roughness: .35 }), dark = smat(0x2b2f36, { metalness: .5, roughness: .35 }), glow = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
  o.gun = (() => { const g = new THREE.Group();   // catcher gun: grip at the origin, points down -Z
    part(new THREE.BoxGeometry(.06, .07, .22), orange, 0, .04, -.06, g); part(new THREE.CylinderGeometry(.035, .045, .14, 14).rotateX(Math.PI / 2), dark, 0, .045, -.23, g);
    part(new THREE.TorusGeometry(.05, .01, 8, 18), glow, 0, .045, -.3, g); part(new THREE.SphereGeometry(.035, 12, 8), smat(0x7fe8ff, { emissive: 0x3fb2ff, emissiveIntensity: .8, transparent: true, opacity: .8 }), 0, .095, -.02, g);
    part(new THREE.BoxGeometry(.04, .1, .045), dark, 0, -.02, .02, g).rotation.x = .25; return g; })();
  o.rev = () => new THREE.Mesh(new THREE.IcosahedronGeometry(.09, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc9b8ff, emissiveIntensity: .9, roughness: .3 }));
  o.radar = () => { const g = new THREE.Group(); part(new THREE.CylinderGeometry(.04, .06, .9, 8), dark, 0, .45, 0, g);
    const dish = part(new THREE.SphereGeometry(.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), smat(0xd8e0ea, { metalness: .6, roughness: .3, side: THREE.DoubleSide }), 0, 1.05, 0, g); dish.rotation.x = Math.PI * .75;
    part(new THREE.SphereGeometry(.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5fff8a }), 0, 1.1, 0, g); const s = sprite('📡 RADAR', .9, '#5fff8a', 54); s.position.y = 1.7; g.add(s); g.userData.dish = dish; return g; };
  o.eye = () => { const g = new THREE.Group(); part(new THREE.SphereGeometry(.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff1a1a }), 0, 0, 0, g);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff2020, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(.22); g.add(s); return g; };
  o.ghost = (evil) => { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: evil ? 0x9a5cff : 0xfff6d8, emissive: evil ? 0x4a1a8a : 0xffd25a, emissiveIntensity: .35, transparent: true, opacity: .6, depthWrite: false });
    part(new THREE.SphereGeometry(.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0, 0, g); part(new THREE.CylinderGeometry(.24, .3, .45, 16, 1, true), m, 0, -.22, 0, g);
    [-1, 1].forEach(s => part(new THREE.SphereGeometry(.045, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }), s * .08, .06, -.21, g));
    if (evil) [-1, 1].forEach(s => { const h = part(new THREE.ConeGeometry(.04, .14, 6), smat(0xff2a4a), s * .12, .25, 0, g); h.rotation.z = -s * .4; });
    else { const halo = part(new THREE.TorusGeometry(.13, .018, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffd25a }), 0, .36, 0, g); halo.rotation.x = Math.PI / 2; }
    g.traverse(c => { if (c.isMesh) c.castShadow = false; }); return g; };
  o.arrow = (() => { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0x5fff8a, depthTest: false, transparent: true, opacity: .9 });
    const a = new THREE.Mesh(new THREE.ConeGeometry(.08, .18, 12).rotateX(-Math.PI / 2), m); a.position.z = -.2; a.renderOrder = 11; g.add(a);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .25, 8).rotateX(Math.PI / 2), m); b.position.z = -.02; b.renderOrder = 11; g.add(b); g.visible = false; scene.add(g); return g; })();
  return o;
})();

/* ---------- starting ---------- */
function hsStartAsk(fromVote) {
  if (HS.phase !== 'off') { if (!online() || MP.host) { netSend({ t: 'hs', e: 'stop' }); hsClear(); toast('🙈 Hide & Seek stopped.', 3); } return; }
  if (online() && !MP.host) { toast('🙈 Only the room host can start Hide & Seek. Ask them!', 4); return; }
  if (TG.on || BR.phase !== 'off') { toast('⏳ Finish the game that is going on first!', 3); return; }
  const players = mdPeople(), nb = Math.max(0, 4 - players.length), seed = (Math.random() * 1e9) | 0, R = seeded(seed);
  const bots = Array.from({ length: nb }, (_, i) => ['hbot' + i, MD_BOT_NAMES[(i + seed) % MD_BOT_NAMES.length], MD_BOT_COLS[i % 4]]);
  const all = [...players, ...bots.map(b => b[0])], seeker = all[Math.floor(R() * all.length)], spots = {}, botSpots = {};
  all.forEach((id, i) => { const a = i / all.length * 6.283; spots[id] = id === seeker ? [0, 4] : [r3(Math.cos(a) * 3.5), r3(4 + Math.sin(a) * 3.5)]; });
  const free = HSB.spots.slice(); bots.forEach(([id]) => { if (id === seeker) return; const s = free.splice(Math.floor(R() * free.length), 1)[0]; botSpots[id] = [r3(s.x), r3(s.y), r3(s.z)]; });
  // radars: next to each building + scattered on dry land
  const radars = [[MALL.x + 28, MALL.z - 6], [MALL.x - 6, MALL.z + 20], [CABIN.x + 4, CABIN.z + 14], [CABIN.x - 18, CABIN.z - 4], [TOMB.x - 4, TOMB.z + 24], [TOMB.x - 24, TOMB.z - 10], [MALL.x + 4, MALL.y + 9.1, MALL.z - 6.5]];
  for (let k = 0; k < 40 && radars.length < 16; k++) { const a = R() * 6.283, r = 30 + R() * 190, x = Math.cos(a) * r, z = Math.sin(a) * r; if (wildAt(x, z) > WL + .4) radars.push([x, z]); }
  const names = {}; players.forEach(id => names[id] = id === brMe() ? (MP.name || 'Host') : ((MP.others.get(id) || {}).name || 'Friend'));
  const d = { t: 'hs', e: 'start', seeker, players, names, bots, spots, botSpots, radars: radars.map(p => p.map(r3)), seed }; netSend(d); hsStart(d);
}
function hsStart(d) {
  hsClear(); HS.phase = 'hide'; HS.t = 0; HS.ended = false; HS.seeker = d.seeker; HS.players = [...d.players, ...d.bots.map(b => b[0])];
  HS.names = new Map(Object.entries(d.names)); d.bots.forEach(b => HS.names.set(b[0], b[1]));
  HS.alive = new Set(HS.players.filter(id => id !== d.seeker)); HS.ghosts.clear(); HS.rev = 0; HS.revGiven = 0; HS.hol = false; HS.dingCd = 0; HS.touchCd = 0; HS.holyT = 50; HS.evilT = 55;
  if (typeof PT !== 'undefined' && PT.inside) { PT.inside = false; PT.fall = false; }
  if (HZ.on) { HZ.fromNet = true; setHorror(false, true); HZ.fromNet = false; }
  HS.bots = d.bots.map(([id, name, col]) => { const b = mdBot(id, name, col), s = d.spots[id]; b.p.set(WILD.x + s[0], 0, WILD.z + s[1]); b.p.y = groundAt(b.p.x, b.p.z); b.wp.copy(b.p);
    b.spot = d.botSpots[id] ? V(...d.botSpots[id]) : null; b.hid = false; scene.add(b.f.g); return b; });
  HS.radars = d.radars.map(r => { const m = HSM.radar(); const x = WILD.x + r[0], z = WILD.z + r[r.length - 1], y = r.length === 3 ? WILD.y + r[1] : groundAt(x, z); m.position.set(x, y, z); m.visible = false; scene.add(m); return m; });
  const s = d.spots[hsMe()];
  if (s && d.players.includes(hsMe())) { arrive(V(WILD.x + s[0], 0, WILD.z + s[1]), Math.atan2(s[0], s[1] - 4) || 0, 'wilds'); }
  else { HS.alive.delete(hsMe()); HS.ghosts.set(hsMe(), 'watch'); }
  if (HS.seeker === hsMe()) { brBig('🙈 YOU ARE THE SEEKER!', 3); toast('👁️ You\'re the SEEKER! Count to 60 with your eyes closed... then find everyone!', 6); }
  else { brBig(`🏃 HIDE! ${mdIdName(HS.seeker)} is the seeker!`, 3); toast('🏃 You have 1 minute to HIDE! Try the mall 🛍️, the snowy lodge 🏨 (climb up the chimneys!) or the pyramid 🏺', 7); }
  setTimeout(() => { if (HS.phase === 'hide') brBig(''); }, 3200);
  if (ac) [392, 523, 659].forEach((f, i) => tone('triangle', f, f, .2, .12, i * .15));
}
function hsClear() {
  HS.phase = 'off'; HS.bots.forEach(b => { scene.remove(b.f.g); if (b.gun) scene.remove(b.gun); }); HS.bots = []; HS.radars.forEach(m => scene.remove(m)); HS.radars = [];
  HS.revs.forEach(r => { scene.remove(r.m); if (r.ring) scene.remove(r.ring); }); HS.revs = []; HS.fx.forEach(f => scene.remove(f.m)); HS.fx = [];
  if (HS.gun) { scene.remove(HS.gun); HS.gun = null; } HS.fGun.forEach(m => scene.remove(m)); HS.fGun.clear(); HS.eyes.forEach(e => e.parent && e.parent.remove(e)); HS.eyes.clear();
  HS.ghostM.forEach(m => scene.remove(m)); HS.ghostM.clear(); if (HS.held) { scene.remove(HS.held); HS.held = null; } HS.holdRev = false;
  if (HS.beam) { scene.remove(HS.beam); HS.beam = null; } HSM.arrow.visible = false; HS.alive.clear(); HS.ghosts.clear(); HS.blindT = 0; HS.hol = false;
  for (const f of MP.others.values()) f.g.visible = true;
  blind(null); mdHud(null); mdFreeze(false); $('mdRed').style.display = 'none'; hsBtns(); if (CARDS.on && CARDS.title.startsWith('👻')) cardsHide();
}

/* ---------- catching + ghosts ---------- */
function hsPoof(p) {   // burst into stuffing!
  confetti(p.clone(), state.xr ? 50 : 110, [0xffffff, 0xf6f0e6, 0xfff2f8, 0xe8e4dc]);
  for (let i = 0; i < (state.xr ? 8 : 16); i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.05 + Math.random() * .06, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true }));
    m.position.copy(p); scene.add(m); HS.fx.push({ m, t: 0, life: 4, v: V((Math.random() - .5) * 5, 2 + Math.random() * 4, (Math.random() - .5) * 5), fluff: true }); }
  if (ac) { tone('sine', 300, 90, .25, .2); noiseHit(ac.currentTime, .3, .25, 'lowpass', 700, .6); }
}
function hsCatch(who) { const d = { t: 'hs', e: 'catch', who, by: HS.seeker }; if (HS.bots.some(b => b.id === who)) d.g = Math.random() < .5 ? 'evil' : 'holy'; netSend(d); hsOnCatch(d); }
function hsOnCatch(d) {
  if (!HS.alive.has(d.who)) return; HS.alive.delete(d.who);
  const p = mdHeadOf(d.who); if (p) hsPoof(p.clone().setY(p.y - .25));
  brFeed(`🔫 ${mdIdName(d.by)} caught ${mdIdName(d.who)}! 🧸`);
  const b = HS.bots.find(x => x.id === d.who); if (b) { b.f.g.visible = false; if (d.g) HS.ghosts.set(d.who, d.g); }
  if (d.who === hsMe()) {
    hands.forEach(h => buzz(h, 1, 200)); brBig('🧸 POOF! You got caught!', 2.5); setTimeout(() => { if ($('brBig').textContent.includes('POOF')) brBig(''); }, 2600);
    HS.pickT = 15;
    cardsShow('👻 You got caught! Pick your ghost:', [{ k: 'evil', e: '😈', l: 'Evil Ghost' }, { k: 'holy', e: '😇', l: 'Holy Ghost' }], k => hsGhostPick(k));
  }
  if (d.by === hsMe() && ac) [660, 990].forEach((f, i) => tone('triangle', f, f, .15, .14, i * .1));
  if (!online() || MP.host) hsCheckEnd();
}
function hsGhostPick(k) {
  if (HS.ghosts.get(hsMe()) === k) return; cardsHide(); const d = { t: 'hs', e: 'ghost', who: hsMe(), g: k }; netSend(d); HS.ghosts.set(hsMe(), k);
  toast(k === 'evil' ? `😈 EVIL GHOST! Touch the seeker to black out their eyes (once a minute). ${state.xr ? 'Pull the trigger' : IS_TOUCH ? 'Tap 🔔' : 'Press T'} to DING where a hider is (once a minute)!`
    : '😇 HOLY GHOST! Every minute, all the hiders get to see where the seeker is. Fly around and cheer them on!', 9);
  hsBtns();
}
function hsCheckEnd() {
  if (HS.phase !== 'seek' && HS.phase !== 'hide') return;
  for (const id of [...HS.alive]) if (id !== hsMe() && !id.startsWith('hbot') && !MP.others.has(id)) HS.alive.delete(id);   // left the room
  const seekerGone = HS.seeker !== hsMe() && !HS.seeker.startsWith('hbot') && !MP.others.has(HS.seeker);
  if (HS.alive.size === 0) hsSendEnd('seeker'); else if ((HS.phase === 'seek' && HS.t >= HS_SEEK) || seekerGone) hsSendEnd('hiders');
}
function hsSendEnd(w) { const d = { t: 'hs', e: 'end', w, s: [...HS.alive].map(id => id === hsMe() ? (MP.name || 'Host') : mdIdName(id)) }; netSend(d); hsEnd(d); }
function hsEnd(d) {
  if (HS.ended) return; HS.ended = true; HS.phase = 'end'; HS.endT = 8; blind(null); cardsHide();
  const iWin = d.w === 'seeker' ? HS.seeker === hsMe() : HS.seeker !== hsMe() && HS.alive.has(hsMe());
  brBig(d.w === 'seeker' ? `👁️ ${HS.seeker === hsMe() ? 'YOU' : mdIdName(HS.seeker)} found everyone!\nSEEKER WINS!` : '🙈 HIDERS WIN!\nThe seeker ran out of time!', 6);
  if (d.w === 'hiders' && d.s.length) toast(`🏆 Still hidden: ${d.s.join(', ')}`, 6);
  if (iWin) { confetti(headWorld(V()), 120); if (ac) [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .25, .14, i * .15)); }
}

/* ---------- seeker gear ---------- */
function hsShoot(o, dir) {
  HS.fireCd = .55; let best = null, bt = 60;
  for (const id of HS.alive) { const p = mdHeadOf(id); if (!p) continue;
    for (const [dy, r] of [[0, .22], [-.3, .27], [-.55, .25]]) { _hs3.copy(p).setY(p.y + dy).sub(o); const t = _hs3.dot(dir); if (t < 0 || t > bt) continue; if (_hs3.lengthSq() - t * t < r * r) { bt = t; best = id; } } }
  for (let s = .3; s < bt; s += .35) if (pawHit(_hs4.copy(o).addScaledVector(dir, s), .02)) { best = null; bt = s; break; }
  const end = o.clone().addScaledVector(dir, bt); hsTracer(o, end); netSend({ t: 'hs', e: 'shot', o: [r3(o.x), r3(o.y), r3(o.z)], p: [r3(end.x), r3(end.y), r3(end.z)] });
  if (ac) { tone('sawtooth', 900, 200, .15, .08); noiseHit(ac.currentTime, .1, .12, 'bandpass', 1800, .9); }
  if (best) hsCatch(best);
}
function hsTracer(a, b) {
  const m = new THREE.Mesh(TR_G, new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.copy(a); m.lookAt(b); m.scale.set(3, 3, a.distanceTo(b)); scene.add(m); HS.fx.push({ m, t: 0, life: .18 });
  const n = new THREE.Mesh(new THREE.TorusGeometry(.18, .02, 6, 18), new THREE.MeshBasicMaterial({ color: 0xff9af0, transparent: true, depthWrite: false })); n.position.copy(b); n.lookAt(a); scene.add(n); HS.fx.push({ m: n, t: 0, life: .35, grow: 2.5 });
}
function hsThrowRev(p, v) {
  if (HS.rev <= 0) return; HS.rev--; const m = HSM.rev(); m.position.copy(p); scene.add(m);
  HS.revs.push({ m, p: p.clone(), v: v.clone(), mine: true, landed: false, t: 0 }); if (ac) tone('sine', 500, 900, .2, .1);
}
function hsRevLand(r, ok) {
  r.landed = true; r.t = 0; r.ok = ok; const col = ok ? 0x3fff6a : 0xff3040;
  r.m.material.color.set(col); r.m.material.emissive.set(col); r.m.scale.setScalar(2);
  r.ring = new THREE.Mesh(new THREE.RingGeometry(HS_REV_R - .25, HS_REV_R, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .6, depthWrite: false, side: THREE.DoubleSide }));
  r.ring.position.copy(r.p).setY(r.p.y + .1); scene.add(r.ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 15; r.m.add(beam);
  if (r.mine) { toast(ok ? '🟢 GREEN! A hider is close to your revealer!' : '🔴 Red... nobody is hiding near there.', 4); if (ac) tone('triangle', ok ? 880 : 300, ok ? 1320 : 200, .3, .14); }
}
function hsRadar(m) {
  scene.remove(m); HS.radars = HS.radars.filter(x => x !== m);
  const me = headWorld(_hs1).clone(), cnt = { N: 0, E: 0, S: 0, W: 0 };
  for (const id of HS.alive) { const p = mdHeadOf(id); if (!p) continue; const dx = p.x - me.x, dz = p.z - me.z; cnt[Math.abs(dz) > Math.abs(dx) ? (dz < 0 ? 'N' : 'S') : (dx > 0 ? 'E' : 'W')]++; }
  const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0], nm = { N: 'NORTH ⬆️', E: 'EAST ➡️', S: 'SOUTH ⬇️', W: 'WEST ⬅️' }[best[0]];
  HS.radarMsg = best[1] ? `📡 Most hiders: ${nm} (${best[1]})` : '📡 Radar: no hiders left?!'; HS.radarMsgT = 10; toast(HS.radarMsg, 5);
  HS.arrowDir = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[best[0]]; HS.arrowT = best[1] ? 8 : 0;
  if (ac) [700, 1000, 1300].forEach((f, i) => tone('sine', f, f, .1, .1, i * .09)); hands.forEach(h => buzz(h, .7, 60));
}
function hsDing(p) {   // a ding sound right where a hider is (left/right + quieter far away)
  const s = sprite('🔔 DING!', 1.6, '#ffd25a', 60); s.position.copy(p).setY(p.y + .9); s.material.depthTest = false; s.renderOrder = 9; scene.add(s); HS.fx.push({ m: s, t: 0, life: 6, keep: true });
  if (!ac) return; headWorld(_hs1); camera.getWorldDirection(_hs2); const d = _hs1.distanceTo(p), rx = -_hs2.z, rz = _hs2.x, dx = p.x - _hs1.x, dz = p.z - _hs1.z, L = Math.hypot(dx, dz) || 1;
  const pan = ac.createStereoPanner(); pan.pan.value = clamp((dx * rx + dz * rz) / L, -1, 1); pan.connect(master);
  const vol = clamp(1.2 / (1 + d / 18), .05, .6);
  [1568, 2093].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, ac.currentTime + i * .18); g.gain.linearRampToValueAtTime(vol, ac.currentTime + i * .18 + .01); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + i * .18 + 1.4); o.connect(g); g.connect(pan); o.start(ac.currentTime + i * .18); o.stop(ac.currentTime + i * .18 + 1.5); });
}
function hsTryDing() {
  if (HS.ghosts.get(hsMe()) !== 'evil' || HS.phase !== 'seek') return false;
  if (HS.dingCd > 0) { toast(`🔔 Ding is ready in ${Math.ceil(HS.dingCd)} s`, 2); return true; }
  const ids = [...HS.alive]; if (!ids.length) return true; const p = mdHeadOf(ids[Math.floor(Math.random() * ids.length)]); if (!p) return true;
  HS.dingCd = 60; const d = { t: 'hs', e: 'ding', p: [r3(p.x), r3(p.y), r3(p.z)] }; netSend(d); hsDing(V(...d.p)); toast('🔔 DING! The seeker heard that 😈', 3); return true;
}
function hsPower() {   // T key / 🔮🔔 button
  if (HS.phase !== 'seek') return;
  if (HS.seeker === hsMe()) { if (HS.rev <= 0) { toast('🔮 No revealer yet. You get one every 2 minutes!', 2.5); return; } camera.getWorldDirection(_hs2); hsThrowRev(headWorld(V()).addScaledVector(_hs2, .4), _hs2.clone().multiplyScalar(11).add(V(0, 4, 0))); return; }
  hsTryDing();
}
function hsHolster() { if (HS.seeker !== hsMe() || HS.phase !== 'seek') return; HS.hol = !HS.hol; netSend({ t: 'hs', e: 'hol', on: HS.hol ? 1 : 0 }); toast(HS.hol ? '✋ Catcher gun holstered' : '🔫 Catcher gun out!', 1.5); if (ac) tone('square', 300, HS.hol ? 200 : 500, .08, .08); hsBtns(); }
addEventListener('keydown', e => {
  if (state.mode !== 'play' || state.xr || HS.phase === 'off' || document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'KeyT') hsPower(); if (e.code === 'KeyX') hsHolster();
});
canvas.addEventListener('pointerdown', e => { if (state.xr || e.button !== 0 || !hsHasGun()) return; if (!state.touch && e.pointerId !== 999 && document.pointerLockElement !== canvas) return; HS.fire = true; });
// phone / PC buttons
(() => {
  const mk = (id, txt, bottom, bg, fn) => { const b = document.createElement('button'); b.id = id; b.className = 'mdBtn'; b.textContent = txt; b.style.left = 'auto'; b.style.right = '12px'; b.style.bottom = bottom; b.style.background = bg; b.onclick = fn; document.body.appendChild(b); return b; };
  mk('hsPow', '🔮', '260px', '#8b6bff', () => hsPower()); mk('hsHol', '✋', '320px', '#ff7a1a', () => hsHolster());
})();
function hsBtns() {
  const on = HS.phase === 'seek' && state.mode === 'play' && !state.xr, seeker = HS.seeker === hsMe(), evil = HS.ghosts.get(hsMe()) === 'evil';
  $('hsPow').style.display = on && (seeker || evil) ? 'block' : 'none'; $('hsPow').textContent = seeker ? '🔮' : '🔔';
  $('hsHol').style.display = on && seeker ? 'block' : 'none'; $('hsHol').textContent = HS.hol ? '🔫' : '✋';
}
// VR buttons: right stick click = holster, left grip = take the revealer (let go to throw), right trigger = shoot / ding
function hsGrab(h) { if (HS.phase !== 'seek' || HS.seeker !== hsMe() || h.i !== 0 || HS.rev <= 0) return false; HS.holdRev = true; HS.held = HSM.rev(); scene.add(HS.held); buzz(h, .6, 40); return true; }
function hsDrop(h) { if (!HS.holdRev || h.i !== 0) return false; HS.holdRev = false; scene.remove(HS.held); HS.held = null; hsThrowRev(h.pos.clone(), (h.vel || V()).clone().multiplyScalar(1.6)); return true; }
function hsSticks() {
  const s = renderer.xr.getSession && renderer.xr.getSession(); if (!s) return;
  for (const src of s.inputSources) { if (src.handedness !== 'right' || !src.gamepad || !src.gamepad.buttons[3]) continue; const on = src.gamepad.buttons[3].pressed; if (on && !HS.stickPrev) hsHolster(); HS.stickPrev = on; }
}

/* ---------- every frame ---------- */
function stepHideSeek(dt) {
  stepHsWorld(dt);
  // effects
  for (let i = HS.fx.length - 1; i >= 0; i--) { const f = HS.fx[i]; f.t += dt; const a = f.t / f.life; if (a >= 1) { scene.remove(f.m); if (!f.keep) f.m.material.dispose(); HS.fx.splice(i, 1); continue; }
    if (f.fluff) { f.v.y -= 9.8 * dt; f.m.position.addScaledVector(f.v, dt); const gy = groundAt(f.m.position.x, f.m.position.z) + .05; if (f.m.position.y < gy) { f.m.position.y = gy; f.v.multiplyScalar(.3); } f.m.material.opacity = a > .7 ? (1 - a) / .3 : 1; }
    else if (!f.keep) { f.m.material.opacity = 1 - a; if (f.grow) f.m.scale.setScalar(1 + a * f.grow); } else f.m.material.opacity = a > .8 ? (1 - a) / .2 : 1; }
  if (HS.phase === 'off') return;
  const me = hsMe(), host = !online() || MP.host, seeker = HS.seeker === me, ghost = HS.ghosts.get(me);
  HS.t += dt; hsBtns();
  if (state.xr) hsSticks();
  if (HS.phase === 'end') { if ((HS.endT -= dt) < 0) { hsClear(); toast('🙈 That was fun! Back to free play in the Wilds.', 4); } return; }
  // phases
  if (HS.phase === 'hide' && HS.t >= HS_HIDE) {
    HS.phase = 'seek'; HS.t = 0; blind(null); mdFreeze(false);
    brBig(seeker ? '👁️ READY OR NOT!\nHere I come!' : '👁️ The seeker is looking!', 2.5); setTimeout(() => { if (HS.phase === 'seek') brBig(''); }, 2600);
    if (ac) tone('square', 220, 880, .5, .1);
    if (seeker) toast(state.xr ? '🔫 Trigger = catch. Right stick click = holster. Walk into 📡 radars to find hiders!' : IS_TOUCH ? '🔫 Use = catch, ✋ holster, 🔮 revealer. Walk into 📡 radars!' : '🔫 Click = catch, X = holster, T = throw a revealer. Walk into 📡 radars!', 8);
  }
  if (HS.phase === 'hide') {
    if (seeker) { blind(`🙈 COUNTING... ${Math.ceil(HS_HIDE - HS.t)}\nEveryone is hiding!`); mdFreeze(true); }
  }
  if (HS.phase === 'seek' && seeker && HS.revGiven < Math.floor(HS.t / 120)) { HS.revGiven++; HS.rev++; toast(state.xr ? '🔮 You got a REVEALER! Squeeze LEFT grip, then throw it!' : `🔮 You got a REVEALER! ${IS_TOUCH ? 'Tap 🔮' : 'Press T'} to throw it!`, 5); if (ac) tone('sine', 900, 1500, .3, .12); }
  HS.dingCd = Math.max(0, HS.dingCd - dt); HS.touchCd = Math.max(0, HS.touchCd - dt); HS.fireCd -= dt;
  // black eyes from an evil ghost
  if (HS.blindT > 0) { HS.blindT -= dt; blind(HS.blindT > 0 ? '😈 A GHOST GRABBED YOUR EYES!' : null); }
  // the gun
  if (seeker && HS.phase === 'seek' && !HS.hol) {
    if (!HS.gun) { HS.gun = HSM.gun.clone(); scene.add(HS.gun); }
    const h = hands[1];
    if (state.xr || sim.on) { vrPose(h, _hs1, _hsq); _hsq.copy(rig.quaternion).multiply(h.q); } else { _hs1.copy(h.pos); camera.getWorldQuaternion(_hsq); }
    HS.gun.position.copy(_hs1); HS.gun.quaternion.copy(_hsq); HS.gun.visible = true;
    const trig = (state.xr || sim.on) ? !!BM.trig[1] : HS.fire; const fresh = trig && !HS.wasTrig; HS.wasTrig = (state.xr || sim.on) ? trig : false; HS.fire = false;
    if (fresh && HS.fireCd <= 0 && HS.blindT <= 0) {
      const dir = (state.xr || sim.on) ? V(0, 0, -1).applyQuaternion(_hsq) : camera.getWorldDirection(V());
      const o = (state.xr || sim.on) ? _hs1.clone().addScaledVector(dir, .3) : headWorld(V()).addScaledVector(dir, .3);
      hsShoot(o, dir);
    }
  } else if (HS.gun) HS.gun.visible = false;
  if (HS.held && HS.holdRev) HS.held.position.copy(hands[0].pos);
  // evil ghost: trigger = ding (VR), touch the seeker = black eyes
  if (ghost === 'evil' && HS.phase === 'seek') {
    const trig = (state.xr || sim.on) && !!BM.trig[1]; if (trig && !HS.wasTrig) hsTryDing(); HS.wasTrig = trig;
    const sp = mdHeadOf(HS.seeker);
    if (sp && HS.touchCd <= 0 && tgTouch(headWorld(_hs1).clone(), sp)) { HS.touchCd = 60; const d = { t: 'hs', e: 'blind', to: HS.seeker }; netSend(d); hsGotBlind(d); toast('😈 BOO! The seeker can\'t see for 2 seconds!', 3); }
  }
  if (HS.pickT > 0 && CARDS.on && (HS.pickT -= dt) <= 0) hsGhostPick(Math.random() < .5 ? 'evil' : 'holy');
  // revealers flying + glowing
  for (let i = HS.revs.length - 1; i >= 0; i--) {
    const r = HS.revs[i]; r.t += dt;
    if (!r.landed) {
      r.v.y -= 9.8 * dt; r.p.addScaledVector(r.v, dt); r.m.position.copy(r.p); r.m.rotation.x += dt * 8;
      const gy = groundAt(r.p.x, r.p.z), hit = pawHit(r.p, .09);
      if (r.p.y < gy + .09 || hit || r.t > 6) { if (r.p.y < gy + .09) r.p.y = gy + .09; let ok = false; for (const id of HS.alive) { const p = mdHeadOf(id); if (p && p.distanceTo(r.p) < HS_REV_R) ok = true; }
        hsRevLand(r, ok); netSend({ t: 'hs', e: 'rev', p: [r3(r.p.x), r3(r.p.y), r3(r.p.z)], ok: ok ? 1 : 0 }); }
    } else { r.m.scale.setScalar(2 + Math.sin(r.t * 6) * .3); if (r.ring) r.ring.material.opacity = .6 * (1 - r.t / 10); if (r.t > 10) { scene.remove(r.m); if (r.ring) scene.remove(r.ring); HS.revs.splice(i, 1); } }
  }
  // radars: only the seeker sees them
  for (const m of HS.radars) { m.visible = seeker && HS.phase === 'seek'; m.userData.dish.rotation.y = tAll * 2; }
  if (seeker && HS.phase === 'seek') { headWorld(_hs1); for (const m of HS.radars) if (Math.hypot(m.position.x - _hs1.x, m.position.z - _hs1.z) < 1.6 && Math.abs(m.position.y + .8 - _hs1.y) < 2) { hsRadar(m); break; } }
  if (HS.arrowT > 0) { HS.arrowT -= dt; headWorld(_hs1); camera.getWorldDirection(_hs2); _hs2.y = 0; _hs2.normalize(); HSM.arrow.position.copy(_hs1).addScaledVector(_hs2, .8); HSM.arrow.position.y -= .25; HSM.arrow.lookAt(HSM.arrow.position.x + HS.arrowDir[0], HSM.arrow.position.y, HSM.arrow.position.z + HS.arrowDir[1]); HSM.arrow.rotateY(Math.PI); HSM.arrow.visible = true; } else HSM.arrow.visible = false;
  HS.radarMsgT -= dt;
  // holy beam over the seeker
  if (HS.beam) { HS.beamT -= dt; const sp = mdHeadOf(HS.seeker); if (sp) HS.beam.position.set(sp.x, sp.y + 12, sp.z); HS.beam.material.opacity = .5 * Math.min(1, HS.beamT); if (HS.beamT <= 0) { scene.remove(HS.beam); HS.beam = null; } }
  // friends: seeker's red eye + gun, ghosts instead of bodies
  for (const [id, f] of MP.others) {
    let eye = HS.eyes.get(id); if (id === HS.seeker) { if (!eye) { eye = HSM.eye(); HS.eyes.set(id, eye); f.head.add(eye); eye.position.set(0, .05, -.17); } } else if (eye) { eye.parent && eye.parent.remove(eye); HS.eyes.delete(id); }
    let gm = HS.fGun.get(id); if (id === HS.seeker && HS.phase === 'seek' && !f.hsHol) { if (!gm) { gm = HSM.gun.clone(); scene.add(gm); HS.fGun.set(id, gm); } gm.position.copy(f.paws[1].position); gm.quaternion.copy(f.paws[1].quaternion); } else if (gm) { scene.remove(gm); HS.fGun.delete(id); }
    const gk = HS.ghosts.get(id); let gh = HS.ghostM.get(id);
    if (gk && gk !== 'watch' && !HS.alive.has(id)) { f.g.visible = false; if (!gh || gh.userData.k !== gk) { if (gh) scene.remove(gh); gh = HSM.ghost(gk === 'evil'); gh.userData.k = gk; scene.add(gh); HS.ghostM.set(id, gh); } gh.position.copy(f.head.position); gh.position.y += Math.sin(tAll * 2) * .05; gh.quaternion.copy(f.head.quaternion); }
    else if (!HS.alive.has(id) && id !== HS.seeker) f.g.visible = false;
    else { f.g.visible = true; if (gh) { scene.remove(gh); HS.ghostM.delete(id); } }
  }
  // bots
  hsBots(dt, host);
  // HUD
  const left = HS.phase === 'hide' ? HS_HIDE - HS.t : HS_SEEK - HS.t, ls = Math.ceil(Math.max(0, left)), clk = `${Math.floor(ls / 60)}:${String(ls % 60).padStart(2, '0')}`, n = HS.alive.size;
  let lines, col = '#b9a4ff';
  if (seeker) { lines = HS.phase === 'hide' ? [`🙈 Counting… ${clk}`, 'Hiders are hiding!'] : [`👁️ FIND THEM! ${clk}`, `🐾 ${n} left  🔮 x${HS.rev}  ${HS.hol ? '✋' : '🔫'}`, HS.radarMsgT > 0 ? HS.radarMsg : '']; col = '#ff3040'; }
  else if (ghost && ghost !== 'watch') lines = [`${ghost === 'evil' ? '😈 Evil' : '😇 Holy'} ghost  ${clk}`, ghost === 'evil' ? (HS.dingCd > 0 ? `🔔 ding in ${Math.ceil(HS.dingCd)}s` : '🔔 ding READY') + (HS.touchCd > 0 ? `  👆 ${Math.ceil(HS.touchCd)}s` : '  👆 touch READY') : `🐾 ${n} hiders left`];
  else if (ghost === 'watch') lines = [`👀 Watching Hide & Seek  ${clk}`, `🐾 ${n} hiders left`];
  else lines = HS.phase === 'hide' ? [`🏃 HIDE! ${clk}`, `${mdIdName(HS.seeker)} is the seeker`] : [`🙈 Stay hidden! ${clk}`, `🐾 ${n} hiders left`];
  mdHud(lines.filter(Boolean), col);
  $('mdRed').style.display = seeker && !state.xr && HS.phase === 'seek' ? 'block' : 'none';
  if (mdWrist.m.visible && hands[0].tracked) { headWorld(_hs1); mdWrist.m.position.copy(hands[0].pos).add(_hs2.set(0, .1, 0)); mdWrist.m.lookAt(_hs1); }
  // the host: timers for ghost powers of bots + holy ghosts, and the end
  if (host && HS.phase === 'seek') {
    const vals = [...HS.ghosts.entries()].filter(([id]) => !HS.alive.has(id));
    if (vals.some(([, g]) => g === 'holy') && (HS.holyT -= dt) <= 0) { HS.holyT = 60; const p = mdHeadOf(HS.seeker); if (p) { const d = { t: 'hs', e: 'holy', p: [r3(p.x), r3(p.y), r3(p.z)] }; netSend(d); hsHoly(d); } }
    if (vals.some(([id, g]) => g === 'evil' && id.startsWith('hbot')) && (HS.evilT -= dt) <= 0 && HS.alive.size) { HS.evilT = 60; const ids = [...HS.alive], p = mdHeadOf(ids[Math.floor(Math.random() * ids.length)]); if (p) { const d = { t: 'hs', e: 'ding', p: [r3(p.x), r3(p.y), r3(p.z)] }; netSend(d); hsDing(V(...d.p)); } }
    hsCheckEnd();
  }
}
function hsHoly(d) {
  if (HS.seeker === hsMe() || !HS.alive.has(hsMe())) { if (HS.seeker === hsMe()) toast('😇 A holy ghost just showed the hiders where you are!', 3); return; }
  const p = V(...d.p); if (HS.beam) scene.remove(HS.beam);
  HS.beam = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 24, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  HS.beam.position.set(p.x, p.y + 12, p.z); scene.add(HS.beam); HS.beamT = 7;
  headWorld(_hs1); toast(`😇 A holy ghost shows you the seeker: ${Math.round(Math.hypot(p.x - _hs1.x, p.z - _hs1.z))} m to the ${compass(p.x - _hs1.x, p.z - _hs1.z)} (golden beam!)`, 6);
  if (ac) [784, 988, 1175].forEach((f, i) => tone('sine', f, f, .3, .1, i * .12));
}
function hsGotBlind(d) {
  if (d.to === hsMe()) { HS.blindT = 2; hands.forEach(h => buzz(h, 1, 300)); if (ac) tone('sawtooth', 160, 60, .5, .15); }
  const b = HS.bots.find(x => x.id === d.to); if (b) b.stun = 2;
}
function hsBots(dt, host) {
  for (const b of HS.bots) {
    if (!HS.alive.has(b.id) && b.id !== HS.seeker) { b.f.g.visible = false; continue; }
    b.stun = Math.max(0, b.stun - dt);
    if (b.id === HS.seeker) {
      let eye = HS.eyes.get(b.id); if (!eye) { eye = HSM.eye(); HS.eyes.set(b.id, eye); b.f.head.add(eye); eye.position.set(0, .05, -.17); }
      if (!b.gun) { b.gun = HSM.gun.clone(); scene.add(b.gun); }
      if (host && HS.phase === 'seek' && b.stun <= 0) {
        // pick a hider to hunt; aim gets better as time goes on
        if ((b.wT -= dt) < 0 || !b.tgt || !HS.alive.has(b.tgt)) { const ids = [...HS.alive]; b.tgt = ids[Math.floor(Math.random() * ids.length)]; b.wT = 10; b.noise = Math.max(3, 30 - HS.t / 9); b.off = V((Math.random() - .5) * 2 * b.noise, 0, (Math.random() - .5) * 2 * b.noise); }
        const p = b.tgt && mdHeadOf(b.tgt);
        if (p) {
          b.wp.copy(p).add(b.off); const flat = Math.hypot(p.x - b.p.x, p.z - b.p.z);
          if (flat < 12) {   // close: search mode (sneaks through the building toward them)
            b.wp.copy(p); _hs1.subVectors(p, b.f.head.position); const L = _hs1.length();
            if (L > .5) { b.p.addScaledVector(_hs1.normalize(), Math.min(L, 2.6 * dt)); b.p.y = Math.max(b.p.y, groundAt(b.p.x, b.p.z)); b.walk += dt * 8; b.yaw = Math.atan2(_hs1.x, _hs1.z); }
            if (L < 3.2 || (L < 9 && (b.fireT = (b.fireT || 0) - dt) < 0)) { b.fireT = 1.4; const o = b.f.head.position.clone(), dir = p.clone().sub(o).normalize(); dir.x += (Math.random() - .5) * .12; dir.y += (Math.random() - .5) * .12; dir.normalize(); hsShootBot(b, o, dir, L < 3.2 ? b.tgt : null); }
          } else mdBotWalk(b, dt, 4.6, null);
        }
      } else if (!host && b.np) { b.p.lerp(b.np, Math.min(1, dt * 10)); }
      b.gun.position.copy(b.f.paws[1].position); b.gun.rotation.set(0, b.yaw + Math.PI, 0); b.gun.visible = HS.phase === 'seek';
    } else if (HS.alive.has(b.id)) {
      // hiders run off from the Plaza, then pop into their hiding spot
      if (!b.hid && HS.t > 2.5) { b.hid = true; hsPoofSmall(b.f.head.position); if (b.spot) b.p.copy(b.spot); }
      else if (!b.hid) { b.wp.set(b.p.x + Math.sin(b.id.length + tAll) * 5, 0, b.p.z + 5); mdBotWalk(b, dt, 4, null); }
    }
    mdPoseBot(b);
  }
  if (host && online() && (HS.botT -= dt) < 0) { HS.botT = .1; const sb = HS.bots.find(b => b.id === HS.seeker); if (sb) netSend({ t: 'hs', e: 'bots', b: [[sb.id, r3(sb.p.x), r3(sb.p.y), r3(sb.p.z), r3(sb.yaw), sb.walk > .1 ? 1 : 0]] }); }
}
function hsShootBot(b, o, dir, sure) {
  let hit = sure;
  if (!hit) for (const id of HS.alive) { const p = mdHeadOf(id); if (!p) continue; _hs3.copy(p).sub(o); const t = _hs3.dot(dir); if (t > 0 && _hs3.lengthSq() - t * t < .3 * .3) { let wall = false; for (let s = .4; s < t; s += .4) if (pawHit(_hs4.copy(o).addScaledVector(dir, s), .02)) { wall = true; break; } if (!wall) hit = id; } }
  const end = hit ? mdHeadOf(hit).clone() : o.clone().addScaledVector(dir, 12); hsTracer(o, end); netSend({ t: 'hs', e: 'shot', o: [r3(o.x), r3(o.y), r3(o.z)], p: [r3(end.x), r3(end.y), r3(end.z)] });
  if (hit) hsCatch(hit);
}
function hsPoofSmall(p) { confetti(p.clone(), 20, [0xffffff, 0xb9a4ff]); }
function hsNet(d) {
  if (d.e === 'start') hsStart(d);
  else if (d.e === 'stop') { hsClear(); toast('🙈 Hide & Seek stopped.', 2); }
  else if (HS.phase === 'off') return;
  else if (d.e === 'catch') hsOnCatch(d);
  else if (d.e === 'ghost') HS.ghosts.set(d.who, d.g);
  else if (d.e === 'end') hsEnd(d);
  else if (d.e === 'shot') hsTracer(V(...d.o), V(...d.p));
  else if (d.e === 'rev') { const m = HSM.rev(), r = { m, p: V(...d.p), v: V(), mine: false, t: 0 }; m.position.copy(r.p); scene.add(m); HS.revs.push(r); hsRevLand(r, !!d.ok); }
  else if (d.e === 'ding') hsDing(V(...d.p));
  else if (d.e === 'holy') hsHoly(d);
  else if (d.e === 'blind') hsGotBlind(d);
  else if (d.e === 'hol') { const f = MP.others.get(d.from); if (f) f.hsHol = !!d.on; }
  else if (d.e === 'bots') { for (const s of d.b) { const b = HS.bots.find(x => x.id === s[0]); if (!b) continue; b.np = (b.np || V()).set(s[1], s[2], s[3]); b.yaw = s[4]; b.walk = s[5] ? b.walk + .15 : b.walk * .9; } }
}

/* ---------- the buildings at any time: moving escalators, secrets, spinning token ---------- */
function hsSecret(id, msg) {
  if (HSB.found.has(id)) return; HSB.found.add(id); store.set('kg-hsec', JSON.stringify([...HSB.found]));
  toast(msg, 7); sfxWin(); headWorld(_hs1); confetti(_hs1.clone().add(V(0, .3, 0)), 70); hands.forEach(h => buzz(h, 1, 120));
}
const HS_INSIDE = [[MALL, 24, 16, 14], [CABIN, 14, 7.5, 11], [TOMB, 18, 18, 19]];
let hsLit = 0;
function stepHsWorld(dt) {
  // inside a building the sky light gets a bit stronger, so rooms in the shade aren't pitch black
  let want = 0;
  if (state.area === 'wilds' && !HZ.on) { headWorld(_hs1); for (const [P, hx, hz, hy] of HS_INSIDE) { const x = _hs1.x - WILD.x - P.x, z = _hs1.z - WILD.z - P.z, y = _hs1.y - WILD.y - P.y; if (Math.abs(x) < hx && Math.abs(z) < hz && y < hy && y > -1) want = 1; } }
  if (want || hsLit) { hsLit += (want - hsLit) * Math.min(1, dt * 3); if (hsLit < .01 && !want) hsLit = 0; if (!HZ.on) hemi.intensity = DAY.hemi * (1 + hsLit * 1.3); }
  if (state.area !== 'wilds') return;
  HSB.escMat.map.offset.y = (HSB.escMat.map.offset.y + dt * .6) % 1; if (HSB.token) HSB.token.rotation.z = tAll * 2;
  if (state.mode !== 'play') return;
  headWorld(_hs1); const fx = _hs1.x, fy = _hs1.y - state.bodyH, fz = _hs1.z;
  for (const E of HSB.esc) {   // standing on an escalator carries you along it
    _hs2.subVectors(E.b, E.a); const L2 = _hs2.x * _hs2.x + _hs2.z * _hs2.z, t = ((fx - E.a.x) * _hs2.x + (fz - E.a.z) * _hs2.z) / L2;
    if (t < 0 || t > 1) continue; const side = Math.abs((fx - E.a.x) * _hs2.z - (fz - E.a.z) * _hs2.x) / Math.sqrt(L2); if (side > E.w / 2) continue;
    const ly = E.a.y + _hs2.y * t; if (fy < ly - .3 || fy > ly + .45) continue;
    _hs2.normalize(); const vd = state.vel.dot(_hs2); if (E.dir > 0 && vd < 0) state.vel.addScaledVector(_hs2, -vd);   // no sliding back down
    rig.position.addScaledVector(_hs2, E.dir * 1.1 * dt); if (E.dir > 0) rig.position.y += .01;
    break;
  }
  for (const S of HSB.secrets) if (!HSB.found.has(S.id) && _hs1.distanceTo(S.p) < S.r + .4) hsSecret(S.id, S.msg);
}
window.__kg.hs = { HS, HSB, hsStartAsk, hsStart, hsNet, hsCatch, hsGhostPick, hsPower, hsHolster, hsShoot, hsRadar, hsTryDing, stepHideSeek,
  tp: (x, z, yaw = 0, y) => { arrive(V(WILD.x + x, y == null ? 0 : WILD.y + y, WILD.z + z), yaw, 'wilds'); state.pitch = 0; }, MALL, CABIN, TOMB };
