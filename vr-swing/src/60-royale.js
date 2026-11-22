/* ======================================================================
   BATTLE ROYALE: press the big red button by the spawn (or 🏆 on a screen) and the grove turns into a
   last-paw-standing match. Up to 4 fighters: friends in your room, and bots fill the empty spots.
   Loot is scattered everywhere (swords, pistol, shotgun, rifle, grenades, medkits, shields, jump boots),
   a storm circle shrinks in, and the last one alive wins. Then everything goes back to normal free play.
   Host runs the match (storm, loot, bots); each player owns their own health. Net: t:'br'.
   ====================================================================== */
const BR = { phase: 'off', t: 0, seed: 0, loot: new Map(), bots: [], alive: new Set(), names: new Map(), hp: 100, sh: 0, out: false, kills: 0, boots: false,
  storm: { c: V(), r: 32 }, held: [null, null], gren: [], fx: [], feed: [], winner: '', endT: 0, cool: [0, 0], wasTrig: [false, false], mouse: false, tap: false, sendHp: 0, botT: 0, outT: 0, hpBars: new Map(), friendW: new Map() };
const BR_START = V(2.4, 0, 2.1);   // the big red button in the grove
const BR_W = {   // weapons and items
  pistol: { n: '🔫 Pistol', gun: 1, dmg: 18, rate: .28, spread: .012, pellets: 1, col: 0x3fb2ff, auto: false },
  shotgun: { n: '💥 Shotgun', gun: 1, dmg: 9, rate: .85, spread: .07, pellets: 7, col: 0x9a6bff, auto: false },
  rifle: { n: '🎯 Rifle', gun: 1, dmg: 13, rate: .13, spread: .02, pellets: 1, col: 0xffb020, auto: true },
  sword: { n: '🗡️ Sword', melee: 1, dmg: 35, rate: .45, col: 0x5fd94a },
  gren: { n: '💣 Grenade', thrown: 1, dmg: 85, col: 0xff4f6d },
  med: { n: '❤️ Medkit', use: 1, col: 0xff4f6d }, shield: { n: '🛡️ Shield', use: 1, col: 0x3fb2ff }, boots: { n: '👟 Jump boots', use: 1, col: 0xffd84f } };
const BR_POOL = ['pistol', 'pistol', 'pistol', 'pistol', 'shotgun', 'shotgun', 'rifle', 'rifle', 'rifle', 'sword', 'sword', 'sword', 'gren', 'gren', 'gren', 'med', 'med', 'med', 'shield', 'shield', 'boots'];
const BOT_NAMES = ['Bonkers', 'Sir Whiskers', 'Turbo Toast', 'Pickle Rick-o-bot', 'Noodle', 'Captain Crunch'];
const _b1 = V(), _b2 = V(), _b3 = V(), _b4 = V(), _bq = new THREE.Quaternion();
let brRnd = Math.random;
function seeded(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const brMe = () => MP.me || 'me';
const brName = id => id === brMe() ? 'You' : BR.names.get(id) || 'Someone';
/* ---------- models ---------- */
const BRM = (() => {
  const dark = smat(0x2b2f36, { metalness: .5, roughness: .35 }), steel = smat(0xc9d2dc, { metalness: .85, roughness: .2 }), wood = smat(0x8a5a32, { roughness: .8 }), gold = smat(0xffc93a, { metalness: .7, roughness: .3 });
  const out = {};
  const mk = (fn, col) => { const g = new THREE.Group(); fn(g, smat(col, { roughness: .4, emissive: col, emissiveIntensity: .15 })); mergeStatic(g); return g; };
  // guns point down -Z, grip at the origin
  out.pistol = mk((g, c) => { part(new THREE.BoxGeometry(.035, .05, .19), dark, 0, .035, -.06, g); part(new THREE.CylinderGeometry(.009, .009, .07, 10).rotateX(Math.PI / 2), steel, 0, .045, -.18, g); part(new THREE.BoxGeometry(.03, .09, .04), c, 0, -.015, .015, g).rotation.x = .25; part(new THREE.BoxGeometry(.037, .012, .12), c, 0, .064, -.06, g); }, 0x3fb2ff);
  out.shotgun = mk((g, c) => { part(new THREE.BoxGeometry(.045, .06, .3), dark, 0, .035, -.12, g); [-.012, .012].forEach(x => part(new THREE.CylinderGeometry(.011, .011, .32, 10).rotateX(Math.PI / 2), steel, x, .05, -.37, g)); part(new THREE.BoxGeometry(.04, .07, .2), wood, 0, -.005, .1, g); part(new THREE.BoxGeometry(.05, .035, .14), c, 0, .015, -.32, g); }, 0x9a6bff);
  out.rifle = mk((g, c) => { part(new THREE.BoxGeometry(.04, .07, .42), dark, 0, .035, -.14, g); part(new THREE.CylinderGeometry(.008, .008, .26, 10).rotateX(Math.PI / 2), steel, 0, .045, -.48, g); part(new THREE.CylinderGeometry(.017, .017, .13, 12).rotateX(Math.PI / 2), dark, 0, .095, -.12, g); part(new THREE.BoxGeometry(.03, .1, .04), c, 0, -.04, -.18, g); part(new THREE.BoxGeometry(.04, .08, .16), c, 0, .01, .12, g); }, 0xffb020);
  out.sword = mk((g, c) => { part(new THREE.BoxGeometry(.05, .008, .7), steel, 0, 0, -.42, g); part(new THREE.ConeGeometry(.025, .06, 4).rotateX(-Math.PI / 2), steel, 0, 0, -.8, g); part(new THREE.BoxGeometry(.16, .02, .025), gold, 0, 0, -.06, g); part(new THREE.CylinderGeometry(.016, .016, .12, 10).rotateX(Math.PI / 2), c, 0, 0, .01, g); }, 0x5fd94a);
  out.gren = mk((g, c) => { part(new THREE.SphereGeometry(.045, 14, 10), c, 0, 0, 0, g); part(new THREE.CylinderGeometry(.015, .015, .03, 10), dark, 0, .05, 0, g); part(new THREE.TorusGeometry(.015, .004, 6, 14), gold, .016, .065, 0, g); }, 0x3f7a3a);
  out.med = mk((g, c) => { part(new THREE.BoxGeometry(.16, .11, .1), smat(0xffffff, { roughness: .5 }), 0, 0, 0, g); part(new THREE.BoxGeometry(.1, .03, .102), c, 0, 0, 0, g); part(new THREE.BoxGeometry(.03, .08, .102), c, 0, 0, 0, g); }, 0xff3048);
  out.shield = mk((g, c) => { part(new THREE.CylinderGeometry(.05, .05, .1, 14), smat(0x3fb2ff, { emissive: 0x3fb2ff, emissiveIntensity: .6, transparent: true, opacity: .8 }), 0, 0, 0, g); part(new THREE.CylinderGeometry(.02, .03, .04, 10), smat(0xffffff), 0, .07, 0, g); }, 0x3fb2ff);
  out.boots = mk((g, c) => { [-.05, .05].forEach(x => { part(new THREE.BoxGeometry(.05, .07, .08), c, x, 0, 0, g); part(new THREE.BoxGeometry(.055, .03, .13), dark, x, -.04, -.02, g); }); }, 0xffd84f);
  out.ring = new THREE.RingGeometry(.22, .3, 28).rotateX(-Math.PI / 2);
  return out;
})();
/* ---------- the start button by the spawn ---------- */
const BR_BTN = (() => {
  const g = new THREE.Group(); g.position.copy(BR_START); scene.add(g);
  part(new THREE.CylinderGeometry(.16, .2, .9, 20), smat(0x2b3446, { roughness: .5 }), 0, .45, 0, g);
  const cap = part(new THREE.SphereGeometry(.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), smat(0xff3040, { emissive: 0xff3040, emissiveIntensity: .5, roughness: .3 }), 0, .9, 0, g); cap.scale.y = .5;
  const t = labelTex(512, 160, (q, w, h) => signText(q, w, h, [['⚔️ BATTLE ROYALE', 50, '#ffd25a', 64], ['tap the red button!', 40, '#ffffff', 122]], 'rgba(14,20,30,.95)', '#ff3040'));
  const s = new THREE.Mesh(new THREE.PlaneGeometry(.6, .19), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide })); s.position.set(0, 1.25, 0); g.add(s);
  part(new THREE.CylinderGeometry(.015, .015, .25, 8), smat(0x8c96a4), 0, 1.03, 0, g);
  addCol({ t: 1, x: BR_START.x, z: BR_START.z, cy: .45, hy: .45, r: .2, tag: 'rock' });
  return { g, cap, sign: s, top: V(BR_START.x, .96, BR_START.z), in: [false, false] };
})();
/* ---------- screen HUD (PC + phone) and the wrist HUD (VR) ---------- */
(() => {
  const st = document.createElement('style');
  st.textContent = `#brHud{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:40;display:none;font:700 15px Fredoka,system-ui,sans-serif;color:#fff;text-align:center;pointer-events:none;text-shadow:0 2px 0 rgba(0,0,0,.4)}
  #brHud .bar{width:200px;height:12px;border-radius:7px;background:rgba(0,0,0,.45);margin:3px auto;overflow:hidden}#brHud .bar i{display:block;height:100%;border-radius:7px}
  #brFeed{position:fixed;top:10px;right:10px;z-index:40;font:600 14px Fredoka,system-ui,sans-serif;color:#fff;text-align:right;pointer-events:none}#brFeed div{background:rgba(0,0,0,.5);border-radius:8px;padding:3px 8px;margin-bottom:4px}
  #brBig{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:45;pointer-events:none;font:900 54px Fredoka,system-ui,sans-serif;color:#ffd25a;text-shadow:0 4px 0 #000,0 0 30px rgba(255,200,60,.6);text-align:center}
  #brStorm{position:fixed;inset:0;z-index:30;pointer-events:none;background:radial-gradient(ellipse at center,rgba(120,40,200,0) 30%,rgba(120,40,200,.55));display:none}
  #brBtn{position:fixed;left:12px;bottom:84px;z-index:20;width:52px;height:52px;border-radius:50%;border:0;font-size:26px;background:#ff3040;box-shadow:0 4px 0 #9a1020;cursor:pointer;display:none}`;
  document.head.appendChild(st);
  const mk = (id, html) => { const d = document.createElement('div'); d.id = id; d.innerHTML = html || ''; document.body.appendChild(d); return d; };
  mk('brHud', '<div id="brAlive"></div><div class="bar"><i id="brHp" style="background:#5fd94a;width:100%"></i></div><div class="bar"><i id="brSh" style="background:#3fb2ff;width:0"></i></div><div id="brW"></div>');
  mk('brFeed'); mk('brBig'); mk('brStorm');
  const b = document.createElement('button'); b.id = 'brBtn'; b.textContent = '🏆'; b.title = 'Battle Royale'; b.onclick = () => brStartAsk(); document.body.appendChild(b);
})();
const brWrist = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.13, .065), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false })); m.renderOrder = 9; m.visible = false; scene.add(m);
  return { c, t, m, key: '' };
})();
function brHudDraw() {
  const alive = BR.alive.size, w = BR.held[1] || BR.held[0];
  const key = [BR.phase, Math.ceil(BR.hp), Math.ceil(BR.sh), alive, BR.kills, w && w.type, BR.out].join();
  if (key === brWrist.key) return; brWrist.key = key;
  $('brAlive').textContent = BR.out ? `👻 You're out!  ${alive} left` : `🐾 ${alive} left   💀 ${BR.kills} kills`;
  $('brHp').style.width = Math.max(0, BR.hp) + '%'; $('brSh').style.width = BR.sh + '%'; $('brW').textContent = w ? BR_W[w.type].n + (w.n > 1 ? ' x' + w.n : '') : (state.xr ? 'grip near loot to grab it' : 'E = grab loot');
  const g = brWrist.c.getContext('2d'); g.clearRect(0, 0, 256, 128); g.fillStyle = 'rgba(10,14,24,.85)'; g.beginPath(); g.roundRect(0, 0, 256, 128, 22); g.fill();
  g.fillStyle = '#333'; g.fillRect(16, 16, 224, 22); g.fillStyle = '#5fd94a'; g.fillRect(16, 16, 224 * Math.max(0, BR.hp) / 100, 22);
  g.fillStyle = '#333'; g.fillRect(16, 46, 224, 14); g.fillStyle = '#3fb2ff'; g.fillRect(16, 46, 224 * BR.sh / 100, 14);
  g.fillStyle = '#fff'; g.font = '700 30px Fredoka, sans-serif'; g.textBaseline = 'middle'; g.fillText(BR.out ? `👻 out  ${alive} left` : `🐾 ${alive} left 💀 ${BR.kills}`, 16, 96);
  brWrist.t.needsUpdate = true;
}
function brFeed(msg) {
  const d = document.createElement('div'); d.textContent = msg; const f = $('brFeed'); f.prepend(d); while (f.children.length > 5) f.lastChild.remove();
  setTimeout(() => d.remove(), 7000); if (state.xr) showVrToast(msg, 2.5);
}
function brBig(msg, secs) { const b = $('brBig'); b.textContent = msg; b.style.display = msg ? 'flex' : 'none'; if (state.xr && msg) showVrToast(msg, secs || 2); }
/* ---------- starting a match ---------- */
function brStartAsk(map = state.area === 'wilds' ? 'wilds' : 'grove') {
  if (BR.phase !== 'off') { if (BR.phase === 'play' && (!online() || MP.host)) { brStop(true); } return; }
  if (online() && !MP.host) { toast('⚔️ Only the room host can start Battle Royale. Ask them to tap the red button!', 4); return; }
  const players = [brMe(), ...(online() ? [...MP.others.keys()] : [])].slice(0, 4);
  const seed = (Math.random() * 1e9) | 0, R = seeded(seed), nb = Math.max(online() ? 0 : 1, 4 - players.length);
  const spots = {}, all = [...players, ...Array.from({ length: nb }, (_, i) => 'bot' + i)], a0 = R() * 6.28, big = map === 'wilds';
  // the big map: the circle starts somewhere near the Plaza, everyone drops on dry land around it
  const c = big ? [WILD.x + (R() - .5) * 90, WILD.z + (R() - .5) * 90] : [(R() - .5) * 10, (R() - .5) * 10];
  all.forEach((id, i) => { let a = a0 + i / all.length * 6.283, x, z;
    for (let k = 0; k < 12; k++) { const r = big ? 50 + R() * 25 : 15; x = (big ? c[0] : 0) + Math.cos(a) * r; z = (big ? c[1] : 0) + Math.sin(a) * r; if (!big || groundAt(x, z) > WL + .3) break; a += .4; }
    spots[id] = [r3(x), r3(z)]; });
  const names = {}; players.forEach(id => names[id] = id === brMe() ? (MP.name || 'Host') : ((MP.others.get(id) || {}).name || 'Friend'));
  const bots = Array.from({ length: nb }, (_, i) => ['bot' + i, BOT_NAMES[(i + seed) % BOT_NAMES.length] + ' 🤖', [0xff9a3c, 0x9a6bff, 0x5fd94a, 0xff4fc3][i % 4]]);
  const d = { t: 'br', e: 'start', seed, spots, names, bots, players, map, c: [r3(c[0]), r3(c[1])] };
  netSend(d); brStart(d);
}
function brStart(d) {
  brClear(); BR.seed = d.seed; brRnd = seeded(d.seed + 7); BR.phase = 'count'; BR.t = 0; BR.hp = 100; BR.sh = 0; BR.out = false; BR.kills = 0; BR.boots = false;
  BR.alive = new Set([...d.players, ...d.bots.map(b => b[0])]); BR.names = new Map(Object.entries(d.names)); d.bots.forEach(b => BR.names.set(b[0], b[1]));
  BR.map = d.map === 'wilds' ? 'wilds' : 'grove'; const big = BR.map === 'wilds';
  BR.storm.c.set(d.c[0], 0, d.c[1]); BR.storm.r = stormRadius(0);
  // loot: one weapon next to every drop spot, the rest scattered around the grove (not inside trees or rocks)
  const R = seeded(d.seed); let n = 0;
  const place = (type, x, z) => { for (let k = 0; k < 8; k++) { if (!pawHit(_b1.set(x, groundAt(x, z) + .45, z), .3) && (!big || groundAt(x, z) > WL + .1)) break; x += (R() - .5) * (big ? 6 : 2); z += (R() - .5) * (big ? 6 : 2); } brAddLoot('L' + n++, type, x, z); };
  const cx = big ? d.c[0] : 0, cz = big ? d.c[1] : 0;
  Object.values(d.spots).forEach(([x, z]) => place(['pistol', 'sword', 'shotgun'][Math.floor(R() * 3)], cx + (x - cx) * .93, cz + (z - cz) * .93));
  for (let i = 0; i < (big ? 120 : 26); i++) { const a = R() * 6.283, r = 3 + Math.sqrt(R()) * (big ? 105 : 21); place(BR_POOL[Math.floor(R() * BR_POOL.length)], cx + Math.cos(a) * r, cz + Math.sin(a) * r); }
  // bots
  BR.bots = d.bots.map(([id, name, col]) => { const f = makeFriend(col, col, name); f.arms && f.arms.forEach(a => { a.up.visible = a.fore.visible = a.elbow.visible = false; }); const s = d.spots[id];
    const gun = BRM[['pistol', 'shotgun', 'rifle'][Math.floor(R() * 3)]].clone(); scene.add(gun);
    return { id, name, f, p: V(s[0], groundAt(s[0], s[1]), s[1]), yaw: 0, hp: 100, alive: true, gun: gun, wp: V(), wT: 0, fireT: 1 + R() * 2, tgt: null, np: null, walk: 0 }; });
  BR.bots.forEach(b => { b.f.label.visible = true; b.bar = brBar(b.f); });
  // go to your drop spot
  if (state.area === 'arena') travel(false);
  hands.forEach(h => { if (h.cup) cupDrop(h); });
  WD.zip = null; WD.fly = null; if (state.area !== 'arena') state.area = big ? 'wilds' : 'grove';
  const s = d.spots[brMe()]; if (s && d.players.includes(brMe())) { rig.position.set(s[0], groundAt(s[0], s[1]), s[1]); rig.position.y += state.bodyH - eyeLocal(_b1).y + .05; state.vel.set(0, 0, 0); hands.forEach(h => { h.stuck = false; h.ready = false; }); if (!state.xr) { state.yaw = Math.atan2(s[0], s[1]); } }
  else BR.out = true;   // joined after it started: watch
  $('brHud').style.display = 'block'; brWrist.m.visible = state.xr; brStormMesh.visible = true;
  toast('⚔️ BATTLE ROYALE! Grab loot, stay inside the circle, be the last one standing!', 5);
  if (ac) { tone('square', 440, 880, .3, .1); }
}
function brAddLoot(id, type, x, z) {
  const g = new THREE.Group(), m = BRM[type].clone(); g.add(m); g.position.set(x, groundAt(x, z) + .38, z);
  const ring = new THREE.Mesh(BRM.ring, new THREE.MeshBasicMaterial({ color: BR_W[type].col, transparent: true, opacity: .7, depthWrite: false })); ring.position.y = -.35; g.add(ring);
  if (BR_W[type].gun || type === 'sword') m.rotation.set(0, 0, Math.PI / 2 * 0);
  scene.add(g); BR.loot.set(id, { id, type, g, m, ph: x * 3 + z });
}
function brTakeLoot(id, send) { const L = BR.loot.get(id); if (!L) return null; scene.remove(L.g); BR.loot.delete(id); if (send) netSend({ t: 'br', e: 'take', id }); return L; }
/* ---------- the storm ---------- */
const brStormMesh = (() => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 40, 64, 1, true), new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vU; varying float vY; void main(){ vU = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float t; varying vec2 vU; varying float vY; void main(){ float s = .5 + .5 * sin(vU.x * 180.0 + t * 2.0 + vY * .6) * sin(vY * 1.3 - t * 1.5); float fade = smoothstep(20.0, 2.0, abs(vY)); gl_FragColor = vec4(mix(vec3(.45,.15,.85), vec3(.9,.5,1.0), s * .5), (.18 + s * .12) * fade); }' }));
  m.position.y = 0; m.visible = false; m.renderOrder = 4; scene.add(m); return m;
})();
function stormRadius(t) {   // grove: waits 25 s, then closes in over ~2 minutes. big map: starts 120 m wide, waits 35 s, ~2.5 minutes to close
  return BR.map === 'wilds' ? (t < 35 ? 120 : Math.max(5, 120 - (t - 35) * .78)) : (t < 25 ? 34 : Math.max(3.5, 34 - (t - 25) * .26)); }
/* ---------- health ---------- */
function brBar(f) {   // a little health bar over someone's head
  const c = document.createElement('canvas'); c.width = 128; c.height = 20; const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(.42, .066, 1); s.renderOrder = 8; f.g.add(s);
  const o = { s, c, t, k: '' }; o.set = (hp, sh) => { const k = Math.ceil(hp) + '/' + Math.ceil(sh); if (k === o.k) return; o.k = k; const g = c.getContext('2d'); g.clearRect(0, 0, 128, 20); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, 128, 20); g.fillStyle = '#5fd94a'; g.fillRect(2, 2, 124 * Math.max(0, hp) / 100, 10); g.fillStyle = '#3fb2ff'; g.fillRect(2, 13, 124 * sh / 100, 5); t.needsUpdate = true; };
  o.set(100, 0); return o;
}
function brHurt(dmg, by, w) {   // I got hit
  if (BR.phase !== 'play' || BR.out) return;
  const s = Math.min(BR.sh, dmg); BR.sh -= s; BR.hp -= dmg - s; BR.sendHp = 0;
  hands.forEach(h => buzz(h, .9, 90)); if (ac) { tone('square', 220, 90, .12, .12); noiseHit(ac.currentTime, .1, .15, 'lowpass', 900, .7); }
  const fl = $('brStorm'); if (!state.xr) { fl.style.display = 'block'; fl.style.background = 'rgba(255,0,0,.25)'; setTimeout(() => { fl.style.background = ''; fl.style.display = 'none'; }, 120); }
  if (BR.hp <= 0) brDie(by, w);
}
function brDie(by, w) {
  BR.out = true; BR.hp = 0; BR.alive.delete(brMe()); dropHeld();
  const msg = { t: 'br', e: 'dead', who: brMe(), by, w }; netSend(msg); brOnDead(msg);
  brBig('💀 You got knocked out!', 2.5); setTimeout(() => { if (BR.phase === 'play') brBig(''); }, 2500);
  toast('👻 You\'re out! You can still walk around and watch.', 4);
}
function brOnDead(d) {
  BR.alive.delete(d.who);
  const bw = BR_W[d.w] ? BR_W[d.w].n.split(' ')[0] : d.w === 'storm' ? '🌀' : '💥';
  brFeed(d.who === d.by || !d.by ? `${brName(d.who)} ${d.w === 'storm' ? 'got lost in the storm 🌀' : 'blew up 💥'}` : `${brName(d.by)} ${bw} ${brName(d.who)}`);
  if (d.by === brMe() && d.who !== brMe()) { BR.kills++; if (ac) tone('triangle', 900, 1400, .2, .12); }
  const b = BR.bots.find(x => x.id === d.who); if (b) { b.alive = false; b.hp = 0; bmBoom(b.p.clone(), .5, false); b.f.g.visible = false; b.gun.visible = false; }
  const f = MP.others.get(d.who); if (f) bmBoom(f.head.position.clone().setY(0), .5, false);
  if (!online() || MP.host) brCheckWin();
}
function brCheckWin() {
  if (BR.phase !== 'play' || BR.alive.size > 1) return;
  const w = [...BR.alive][0], d = { t: 'br', e: 'end', w: w || '', n: w ? brName(w) === 'You' ? (MP.name || 'Host') : brName(w) : 'Nobody' };
  netSend(d); brEnd(d);
}
function brEnd(d) {
  BR.phase = 'end'; BR.endT = 7;
  const me = d.w === brMe();
  brBig(me ? '🏆 WINNER WINNER! 🏆\nLast paw standing!' : `🏆 ${d.n} wins!`, 6);
  if (me) { confetti(headWorld(V()), 120); if (ac) [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .25, .14, i * .15)); }
}
function brStop(send) { if (send) netSend({ t: 'br', e: 'stop' }); brClear(); toast('⚔️ Back to free play!', 3); }
function brClear() {
  BR.phase = 'off'; dropHeld(true); BR.loot.forEach(L => scene.remove(L.g)); BR.loot.clear();
  BR.bots.forEach(b => { scene.remove(b.f.g); scene.remove(b.gun); }); BR.bots = []; BR.gren.forEach(g => scene.remove(g.m)); BR.gren = [];
  BR.fx.forEach(f => scene.remove(f.m)); BR.fx = []; BR.friendW.forEach(m => m.parent && m.parent.remove(m)); BR.friendW.clear(); BR.hpBars.forEach(o => o.s.parent && o.s.parent.remove(o.s)); BR.hpBars.clear();
  BR.out = false; BR.hp = 100; BR.sh = 0; BR.boots = false; BR.alive.clear();
  $('brHud').style.display = 'none'; $('brStorm').style.display = 'none'; brBig(''); brWrist.m.visible = false; brStormMesh.visible = false;
  for (const f of MP.others.values()) { f.brOut = false; f.g.visible = true; f.brHp = 100; f.brSh = 0; }
}
/* ---------- holding things ---------- */
function brGrab(h) {
  if (BR.phase !== 'play' || BR.out) return false;
  let best = null, bd = .32 * BM.sc; for (const L of BR.loot.values()) { const d = L.g.position.distanceTo(h.pos); if (d < bd) { bd = d; best = L; } }
  if (!best) return false; brPick(h, best); return true;
}
function brPick(h, L) {
  brTakeLoot(L.id, true); const W = BR_W[L.type];
  if (W.use) {
    if (L.type === 'med') { BR.hp = Math.min(100, BR.hp + 50); toast('❤️ +50 health!', 2); }
    else if (L.type === 'shield') { BR.sh = Math.min(100, BR.sh + 50); toast('🛡️ +50 shield!', 2); }
    else { BR.boots = true; toast('👟 JUMP BOOTS! You jump way higher now.', 3); }
    BR.sendHp = 0; if (ac) tone('sine', 600, 1200, .2, .12); buzz(h, .5, 40); return;
  }
  const cur = BR.held[h.i];
  if (cur && cur.type === 'gren' && L.type === 'gren') { cur.n = Math.min(3, cur.n + 1); toast('💣 x' + cur.n, 1.5); return; }
  if (cur) dropOne(h.i);
  const m = BRM[L.type].clone(); scene.add(m); BR.held[h.i] = { type: L.type, m, n: 1, prev: V(), tip: V() };
  netSend({ t: 'br', e: 'hold', h: h.i, w: L.type });
  if (ac) tone('triangle', 500, 900, .1, .12); buzz(h, .6, 40);
  if (!BR.toldGun && W.gun) { BR.toldGun = true; toast(state.xr ? '🔫 Pull the TRIGGER to shoot. Aim with your hand!' : '🔫 Click to shoot!', 3); }
  if (!BR.toldGren && W.thrown) { BR.toldGren = true; toast(state.xr ? '💣 Swing and let go of grip to throw it!' : '💣 Click to throw it!', 3); }
}
function dropOne(i, quiet) {
  const H = BR.held[i]; if (!H) return; scene.remove(H.m); BR.held[i] = null;
  if (!quiet && BR.phase === 'play' && H.type !== 'gren') { const id = 'd' + brMe() + (BR.dropN = (BR.dropN || 0) + 1); const p = hands[i].pos; brAddLoot(id, H.type, p.x, p.z); netSend({ t: 'br', e: 'loot', id, w: H.type, x: r3(p.x), z: r3(p.z) }); }
  netSend({ t: 'br', e: 'hold', h: i, w: '' });
}
function dropHeld(quiet) { [0, 1].forEach(i => dropOne(i, quiet)); }
function brDrop(h) {   // let go of grip: a grenade gets THROWN, anything else is dropped
  const H = BR.held[h.i]; if (!H) return false;
  if (H.type === 'gren') { throwGren(h.pos.clone(), (h.vel || V()).clone().multiplyScalar(1.5), true); H.n--; if (H.n <= 0) { scene.remove(H.m); BR.held[h.i] = null; netSend({ t: 'br', e: 'hold', h: h.i, w: '' }); } return true; }
  dropOne(h.i); return true;
}
function brDesk() {   // E on a keyboard (or Grab on a phone): pick up the loot you look at
  if (BR.phase !== 'play' || BR.out) return false;
  const L = aimAt(2.6, f => BR.loot.forEach(L => f(L, L.g.position, .25))); if (L) { brPick(hands[1], L); return true; }
  return false;
}
canvas.addEventListener('pointerdown', e => {
  if (state.xr || BR.phase !== 'play' || BR.out || !BR.held[1] || e.button !== 0) return;
  if (e.pointerId === 999) BR.tap = true; else BR.mouse = true;   // phone Use button = one shot per tap
});
addEventListener('pointerup', e => { if (e.button === 0) BR.mouse = false; });
/* ---------- shooting ---------- */
function brTargets() {   // everyone you could hit: friends and bots that are still in
  const out = [];
  for (const [id, f] of MP.others) if (BR.alive.has(id) && !f.brOut) out.push({ id, p: f.head.position });
  for (const b of BR.bots) if (b.alive) out.push({ id: b.id, p: b.f.head.position });
  return out;
}
function rayHit(o, d, maxD, skip) {   // closest person along a ray (head + body capsule), then check walls
  let best = null, bt = maxD;
  for (const T of brTargets()) {
    if (T.id === skip) continue;
    for (const [dy, r] of [[0, .19], [-.3, .24], [-.55, .22]]) {
      _b3.copy(T.p).setY(T.p.y + dy).sub(o); const t = _b3.dot(d); if (t < 0 || t > bt) continue;
      const dd2 = _b3.lengthSq() - t * t; if (dd2 < r * r) { bt = t; best = { id: T.id, t, head: dy === 0 }; }
    }
  }
  // walls, trees and rocks stop bullets
  for (let s = .3; s < bt; s += .35) { if (pawHit(_b4.copy(o).addScaledVector(d, s), .02)) return { id: null, t: s }; }
  return best || { id: null, t: bt };
}
function sendHit(to, dmg, w) {
  if (to === brMe()) { brHurt(dmg, brMe(), w); return; }
  const b = BR.bots.find(x => x.id === to);
  if (b && (!online() || MP.host)) botHurt(b, dmg, brMe(), w); else netSend({ t: 'br', e: 'hit', to, d: Math.round(dmg), by: brMe(), w });
  if (ac) tone('sine', 1400, 1100, .05, .1);   // hit marker
}
function fireGun(i, o, dir) {
  const H = BR.held[i], W = BR_W[H.type], hs = []; let mx = 0;
  for (let k = 0; k < W.pellets; k++) {
    _b2.copy(dir).add(_b1.set((Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2).multiplyScalar(W.spread)).normalize();
    const r = rayHit(o, _b2, 60, brMe()); const end = o.clone().addScaledVector(_b2, r.t); tracer(o, end, W.col); hs.push([r3(end.x), r3(end.y), r3(end.z)]);
    if (r.id) { const dmg = W.dmg * (r.head ? 1.5 : 1); sendHit(r.id, dmg, H.type); mx++; }
  }
  netSend({ t: 'br', e: 'shot', o: [r3(o.x), r3(o.y), r3(o.z)], e2: hs, c: W.col });
  muzzle(o, W.col); if (ac) { const t = ac.currentTime; noiseHit(t, H.type === 'shotgun' ? .25 : .1, H.type === 'shotgun' ? .5 : .3, 'bandpass', H.type === 'rifle' ? 1800 : 900, .5); tone('square', 160, 60, .08, .12); }
  const h = hands[i]; buzz(h, H.type === 'shotgun' ? 1 : .7, H.type === 'shotgun' ? 90 : 40);
  H.kick = H.type === 'shotgun' ? 1 : .5;
}
const TR_G = new THREE.CylinderGeometry(.006, .006, 1, 5, 1, true).rotateX(Math.PI / 2).translate(0, 0, .5);
function tracer(a, b, col) {
  const m = new THREE.Mesh(TR_G, new THREE.MeshBasicMaterial({ color: col || 0xffe080, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.copy(a); m.lookAt(b); m.scale.set(1, 1, a.distanceTo(b)); scene.add(m); BR.fx.push({ m, t: 0, life: .12 });
}
function muzzle(p, col) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(p); scene.add(m); BR.fx.push({ m, t: 0, life: .06, grow: 3 });
}
function throwGren(p, v, mine) {
  const m = BRM.gren.clone(); m.position.copy(p); scene.add(m);
  BR.gren.push({ m, v: v.clone(), t: 0, mine });
  if (mine) netSend({ t: 'br', e: 'gren', p: [r3(p.x), r3(p.y), r3(p.z)], v: [r3(v.x), r3(v.y), r3(v.z)] });
}
function stepGren(dt) {
  for (let i = BR.gren.length - 1; i >= 0; i--) {
    const g = BR.gren[i]; g.t += dt; g.v.y -= 9.81 * dt; g.m.position.addScaledVector(g.v, dt); g.m.rotation.x += dt * 8;
    const hit = pawHit(g.m.position, .05); if (hit) { g.m.position.addScaledVector(hit.n, .05 - hit.d); const vn = g.v.dot(hit.n); if (vn < 0) g.v.addScaledVector(hit.n, -1.4 * vn).multiplyScalar(.6); }
    if (g.t > 2) {   // BOOM
      const p = g.m.position.clone(); scene.remove(g.m); BR.gren.splice(i, 1); bmBoom(p, 1.1, false);
      if (g.mine) { for (const T of brTargets()) { const d = T.p.distanceTo(p) - .3; if (d < 3.5) sendHit(T.id, BR_W.gren.dmg * (1 - Math.max(0, d) / 3.5), 'gren'); }
        headWorld(_b1); const d = _b1.distanceTo(p) - .3; if (d < 3.5 && !BR.out) brHurt(BR_W.gren.dmg * .6 * (1 - Math.max(0, d) / 3.5), brMe(), 'gren'); }
      else { headWorld(_b1); const d = _b1.distanceTo(p) - .3; if (d < 3.5) hands.forEach(h => buzz(h, .8, 120)); }
    }
  }
}
/* ---------- bots (the host thinks for them) ---------- */
function botHurt(b, dmg, by, w) {
  if (!b.alive) return; b.hp -= dmg; b.hitT = .15;
  if (b.hp <= 0) { const d = { t: 'br', e: 'dead', who: b.id, by, w }; netSend(d); brOnDead(d); }
}
function stepBots(dt) {
  const host = !online() || MP.host, tgts = [];
  if (host) { if (!BR.out) tgts.push({ id: brMe(), p: headWorld(V()) }); for (const [id, f] of MP.others) if (BR.alive.has(id)) tgts.push({ id, p: f.head.position }); for (const b of BR.bots) if (b.alive) tgts.push({ id: b.id, p: b.f.head.position }); }
  for (const b of BR.bots) {
    if (!b.alive) continue;
    if (host && BR.phase === 'play') {
      // pick a target: the closest one it can see within 16 m
      let best = null, bd = 16; for (const T of tgts) { if (T.id === b.id) continue; const d = T.p.distanceTo(b.f.head.position); if (d < bd) { bd = d; best = T; } }
      const sc = BR.storm, toC = _b1.set(sc.c.x - b.p.x, 0, sc.c.z - b.p.z), outside = toC.length() > sc.r - 2;
      if (outside || !best) {   // wander toward the safe circle
        if ((b.wT -= dt) < 0 || outside) { b.wT = 2 + brRnd() * 3; const a = brRnd() * 6.28, r = brRnd() * Math.max(2, sc.r * .6); b.wp.set(sc.c.x + Math.cos(a) * r, 0, sc.c.z + Math.sin(a) * r); if (BR.map === 'wilds' && groundAt(b.wp.x, b.wp.z) < WL) b.wp.lerp(sc.c, .5); if (outside) b.wp.copy(sc.c); }
      } else { b.wp.copy(best.p).setY(0); if (bd < 5) b.wp.copy(b.p).addScaledVector(_b2.set(-(best.p.x - b.p.x), 0, -(best.p.z - b.p.z)).normalize(), 2); }
      _b2.subVectors(b.wp, b.p).setY(0); const dist = _b2.length(), mv = dist > .4 ? 2.4 : 0;
      if (mv) { b.p.addScaledVector(_b2.normalize(), Math.min(dist, mv * dt)); }
      b.p.y = groundAt(b.p.x, b.p.z); _b3.copy(b.p); _b3.y += .5; const hit = pawHit(_b3, .3); if (hit && hit.n.y < .7) { b.p.addScaledVector(hit.n.setY(0), .3 - hit.d); b.p.y = groundAt(b.p.x, b.p.z); }   // don't walk through trees
      b.walk = mv ? b.walk + dt * 9 : b.walk * .9;
      if (best) b.yaw = Math.atan2(best.p.x - b.p.x, best.p.z - b.p.z); else if (mv) b.yaw = Math.atan2(_b2.x, _b2.z);
      if (best && (b.fireT -= dt) < 0) {   // shoot (bots miss a lot)
        b.fireT = 1.1 + brRnd() * 1.1; const o = b.f.paws[1].getWorldPosition(V()); const d = _b2.subVectors(best.p, o).normalize();
        d.add(_b1.set(brRnd() - .5, brRnd() - .5, brRnd() - .5).multiplyScalar(.16 + bd * .008)).normalize();
        const r = rayHit(o, d, 40, b.id); let hitMe = false;
        if (!r.id && !BR.out && best.id === brMe()) { headWorld(_b4); _b4.sub(o); const t = _b4.dot(d); if (t > 0 && t < r.t && _b4.lengthSq() - t * t < .3 * .3) { hitMe = true; r.t = t; } }
        const end = o.clone().addScaledVector(d, r.t); tracer(o, end, 0xff8060); muzzle(o);
        netSend({ t: 'br', e: 'shot', o: [r3(o.x), r3(o.y), r3(o.z)], e2: [[r3(end.x), r3(end.y), r3(end.z)]], c: 0xff8060 });
        if (ac) noiseHit(ac.currentTime, .08, .12, 'bandpass', 1100, .5);
        const dmg = 6 + brRnd() * 4;
        if (hitMe) brHurt(dmg, b.id, 'pistol');
        else if (r.id) { const bb = BR.bots.find(x => x.id === r.id); if (bb) botHurt(bb, dmg, b.id, 'pistol'); else netSend({ t: 'br', e: 'hit', to: r.id, d: Math.round(dmg), by: b.id, w: 'pistol' }); }
      }
      if (outside && (b.stormT = (b.stormT || 0) + dt) > 1) { b.stormT = 0; botHurt(b, 6, b.id, 'storm'); }
    } else if (b.np) { b.p.lerp(b.np, Math.min(1, dt * 10)); }
    poseBot(b, dt);
  }
  if (host && online() && (BR.botT -= dt) < 0) { BR.botT = .1; netSend({ t: 'br', e: 'bots', b: BR.bots.map(b => [b.id, r3(b.p.x), r3(b.p.z), r3(b.yaw), Math.ceil(b.hp), b.walk > .1 ? 1 : 0]) }); }
}
function poseBot(b, dt) {
  const f = b.f, y = b.yaw, gy0 = b.p.y, hy = gy0 + AVATAR_EYE + Math.abs(Math.sin(b.walk)) * .04, fx = Math.sin(y), fz = Math.cos(y);
  f.head.position.set(b.p.x, hy, b.p.z); f.head.rotation.set(0, y + Math.PI, 0);
  if (f.root) { f.root.position.set(b.p.x - fx * .03, gy0, b.p.z - fz * .03); f.root.rotation.set(0, y + Math.PI, 0); }
  else f.body.position.set(b.p.x, gy0 + (hy - gy0) * .45, b.p.z);
  f.paws.forEach((p, i) => { const sd = i ? -1 : 1, sw = Math.sin(b.walk + i * Math.PI) * .08; p.visible = true; p.position.set(b.p.x + fx * (.28 + (i ? .05 : sw)) + fz * sd * .2, hy - .3 + (i ? .05 : 0), b.p.z + fz * (.28 + (i ? .05 : sw)) - fx * sd * .2); p.rotation.set(0, y + Math.PI, 0); });
  const rp = f.paws[1].position; b.gun.position.set(rp.x, rp.y + .02, rp.z); b.gun.rotation.set(0, y + Math.PI, 0);
  f.label.position.set(b.p.x, hy + .42, b.p.z); if (b.bar) { b.bar.s.position.set(b.p.x, hy + .31, b.p.z); b.bar.set(b.hp, 0); }
  if (b.hitT > 0) { b.hitT -= dt; f.head.scale.setScalar(1 + b.hitT); } else f.head.scale.setScalar(1);
}
/* ---------- every frame ---------- */
function stepRoyale(dt) {
  // the start button: tap it with a paw
  BR_BTN.cap.material.emissiveIntensity = .4 + Math.sin(tAll * 4) * .2;
  if (state.area === 'grove') for (const h of hands) { if (!h.tracked || !(state.xr || sim.on)) continue; const inside = h.pos.distanceTo(BR_BTN.top) < .13; if (inside && !BR_BTN.in[h.i]) { buzz(h, .7, 40); brStartAsk(); } BR_BTN.in[h.i] = inside; }
  $('brBtn').style.display = state.mode === 'play' && !state.xr ? 'block' : 'none';
  if (BR.phase === 'off') return;
  BR.t += dt; brStormMesh.material.uniforms.t.value = tAll;
  if (BR.phase === 'count') {
    const n = Math.ceil(4 - BR.t); if (n !== BR.lastN) { BR.lastN = n; brBig(n > 0 ? String(n) : 'GO! ⚔️', .9); if (ac) tone('square', n > 0 ? 520 : 1040, n > 0 ? 520 : 1040, .15, .12); }
    if (BR.t > 4) { BR.phase = 'play'; BR.t = 0; setTimeout(() => { if (BR.phase === 'play') brBig(''); }, 900); }
  }
  // storm
  const S = BR.storm; S.r = stormRadius(BR.phase === 'play' ? BR.t : 0); brStormMesh.position.set(S.c.x, BR.map === 'wilds' ? groundAt(S.c.x, S.c.z) : 0, S.c.z); brStormMesh.scale.set(S.r, BR.map === 'wilds' ? 4 : 1, S.r);
  headWorld(_b1); const outside = Math.hypot(_b1.x - S.c.x, _b1.z - S.c.z) > S.r;
  $('brStorm').style.display = outside && !state.xr && !BR.out ? 'block' : 'none';
  if (outside && BR.phase === 'play' && !BR.out && (BR.outT += dt) > 1) { BR.outT = 0; brHurt(5, null, 'storm'); if (state.xr) showVrToast('🌀 Get back in the circle!', 1); }
  // loot spins
  for (const L of BR.loot.values()) { L.m.rotation.y = tAll * 1.5 + L.ph; L.m.position.y = Math.sin(tAll * 2 + L.ph) * .04; }
  // held things follow your paws; triggers shoot
  for (const h of hands) {
    const H = BR.held[h.i]; if (!H) continue; const W = BR_W[H.type];
    if (state.xr || sim.on) { vrPose(h, _b1, _bq); _bq.copy(rig.quaternion).multiply(h.q); }
    else { _b1.copy(h.pos); camera.getWorldQuaternion(_bq); }
    H.kick = Math.max(0, (H.kick || 0) - dt * 8); H.m.position.copy(_b1); H.m.quaternion.copy(_bq); if (H.kick) H.m.rotateX(H.kick * .35);
    const dir = _b2.set(0, 0, -1).applyQuaternion(_bq);
    const trig = (state.xr || sim.on) ? !!BM.trig[h.i] : h.i === 1 && (BR.mouse || BR.tap);
    const fresh = trig && !BR.wasTrig[h.i]; BR.wasTrig[h.i] = trig; BR.cool[h.i] -= dt;
    if (BR.phase !== 'play' || BR.out) continue;
    if (W.gun && trig && (fresh || W.auto) && BR.cool[h.i] <= 0) {
      BR.cool[h.i] = W.rate; const o = (state.xr || sim.on) ? _b3.copy(_b1).addScaledVector(dir, H.type === 'rifle' ? .62 : H.type === 'shotgun' ? .52 : .22).add(_b4.set(0, .045, 0).applyQuaternion(_bq)) : headWorld(_b3).addScaledVector(dir, .3);
      fireGun(h.i, o.clone(), (state.xr || sim.on) ? dir.clone() : _b4.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_bq)).clone());
    }
    if (W.melee) {   // swing the sword through someone
      H.tip.copy(_b1).addScaledVector(dir, .75); const sp = H.tip.distanceTo(H.prev) / Math.max(dt, 1e-3); H.prev.copy(H.tip);
      const swing = (state.xr || sim.on) ? sp > 2.2 : fresh;
      if (swing && BR.cool[h.i] <= 0) {
        for (const T of brTargets()) {
          let d; if (state.xr || sim.on) { const ln = new THREE.Line3(_b1, H.tip), cp = ln.closestPointToPoint(T.p.clone().setY(T.p.y - .25), true, V()); d = cp.distanceTo(T.p.clone().setY(T.p.y - .25)); }
          else { headWorld(_b4); const to = T.p.clone().sub(_b4); d = to.length() < 2.3 && to.normalize().dot(dir) > .8 ? 0 : 9; }
          if (d < .4) { BR.cool[h.i] = W.rate; sendHit(T.id, W.dmg, 'sword'); buzz(h, 1, 60); if (ac) noiseHit(ac.currentTime, .12, .3, 'bandpass', 2600, 1.2); break; }
        }
        if (!(state.xr || sim.on) && fresh) { H.kick = 1.5; if (ac) tone('sine', 400, 200, .12, .06); }
      }
    }
    if (W.thrown && !(state.xr || sim.on) && fresh) {   // PC: click throws
      throwGren(headWorld(V()).addScaledVector(dir, .4), dir.clone().multiplyScalar(9).add(V(0, 3, 0)), true); H.n--; if (H.n <= 0) { scene.remove(H.m); BR.held[h.i] = null; netSend({ t: 'br', e: 'hold', h: h.i, w: '' }); }
    }
  }
  BR.tap = false;
  stepGren(dt); stepBots(dt);
  // effects
  for (let i = BR.fx.length - 1; i >= 0; i--) { const f = BR.fx[i]; f.t += dt; const a = f.t / f.life; if (a >= 1) { scene.remove(f.m); f.m.material.dispose(); BR.fx.splice(i, 1); continue; } f.m.material.opacity = 1 - a; if (f.grow) f.m.scale.setScalar(1 + a * f.grow); }
  // friends: knocked-out friends vanish; health bars + what they hold
  for (const [id, f] of MP.others) {
    if (f.brOut) { f.g.visible = false; continue; }
    let bar = BR.hpBars.get(id); if (!bar) { bar = brBar(f); BR.hpBars.set(id, bar); }
    bar.s.position.copy(f.head.position).add(_b1.set(0, .31, 0)); bar.set(f.brHp ?? 100, f.brSh ?? 0);
    const wm = BR.friendW.get(id); if (wm) { const p = f.paws[wm.userData.h || 1]; if (p) { wm.position.copy(p.position); wm.quaternion.copy(p.quaternion); } }
  }
  // tell others my health
  if ((BR.sendHp -= dt) < 0 && online()) { BR.sendHp = .5; netSend({ t: 'br', e: 'hp', hp: Math.ceil(BR.hp), sh: Math.ceil(BR.sh) }); }
  brHudDraw();
  if (brWrist.m.visible && hands[0].tracked) { headWorld(_b1); brWrist.m.position.copy(hands[0].pos).add(_b2.set(0, .1, 0)); brWrist.m.lookAt(_b1); }
  if (BR.phase === 'end' && (BR.endT -= dt) < 0) { brClear(); respawn(); toast('⚔️ Back to free play! Tap the red button for another round.', 4); }
}
function brJump() { return BR.boots && BR.phase !== 'off' ? 1.7 : 1; }
function brNet(d) {
  if (d.e === 'start') { brStart(d); if (!d.players.includes(brMe())) toast('⚔️ A Battle Royale started! You\'re watching this one.', 4); }
  else if (d.e === 'stop') brStop(false);
  else if (d.e === 'take') brTakeLoot(d.id, false);
  else if (d.e === 'loot') brAddLoot(d.id, d.w, d.x, d.z);
  else if (d.e === 'hit') { if (d.to === brMe()) brHurt(d.d, d.by, d.w); else if (MP.host) { const b = BR.bots.find(x => x.id === d.to); if (b) botHurt(b, d.d, d.by, d.w); } }
  else if (d.e === 'dead') { const f = MP.others.get(d.who); if (f) f.brOut = true; brOnDead(d); }
  else if (d.e === 'end') brEnd(d);
  else if (d.e === 'shot') { const o = V(...d.o); (d.e2 || []).forEach(e => tracer(o, V(...e), d.c)); muzzle(o); if (ac) { headWorld(_b1); const v = clamp(1 - _b1.distanceTo(o) / 30, .05, .4); noiseHit(ac.currentTime, .08, v, 'bandpass', 1100, .5); } }
  else if (d.e === 'gren') throwGren(V(...d.p), V(...d.v), false);
  else if (d.e === 'hp') { const f = MP.others.get(d.from); if (f) { f.brHp = d.hp; f.brSh = d.sh; } }
  else if (d.e === 'hold') { const f = MP.others.get(d.from); if (!f) return; const old = BR.friendW.get(d.from); if (old) { scene.remove(old); BR.friendW.delete(d.from); } if (d.w && BRM[d.w]) { const m = BRM[d.w].clone(); m.userData.h = d.h; scene.add(m); BR.friendW.set(d.from, m); } }
  else if (d.e === 'bots') { for (const s of d.b) { const b = BR.bots.find(x => x.id === s[0]); if (!b) continue; b.np = (b.np || V()).set(s[1], groundAt(s[1], s[2]), s[2]); b.yaw = s[3]; b.hp = s[4]; b.walk = s[5] ? b.walk + .15 : b.walk * .9; } }
}
window.__kg.royale = { BR, BR_W, BRM, brStartAsk, brStart, brNet, brPick, brGrab, brDrop, brHurt, sendHit, fireGun, throwGren, stepRoyale, botHurt, rayHit, brTargets, BR_BTN };
