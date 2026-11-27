// 👑 Admin mode: only the owner gets a panel (and can push people).
// How you become admin: open the game once with  ?admin=YOUR-SECRET  on the end of the link.
// The game remembers it on that device. The secret is NOT in this file (only its fingerprint is),
// so your friend can't read it from the code.
//
// ADD A NEW BUTTON: put it in a page below. `run(ctx)` does the thing (ctx comes from main.js),
// `label(ctx)` is optional and lets the text change (like ON/OFF). Max 4 buttons per page.
// ADD A NEW PAGE: add another { title, buttons: [...] }. The ◀ ▶ buttons find it by themselves.
import * as THREE from 'three';

export const ADMIN_HASH = 'f912cc075ee43294137a5cc125ac7383ab49ae48a9a418a9d3450808306ab11b';

export const PAGES = [
  { title: '⚡ Powers', buttons: [
    { label: (c) => '🚀 Speed boost: ' + (c.S.boost ? 'ON' : 'OFF'), run: (c) => c.toggleBoost() },
  ] },
  { title: '🧪 Spawn', buttons: [
    { label: () => '🚗 Spawn car', run: (c) => c.spawnCar() },
    { label: () => '😈 Spawn Crawler', run: (c) => c.spawnMonster() },
    { label: () => '🕴️ Spawn Stalker', run: (c) => c.spawnMonster('stalker') },
    { label: () => '😱 Spawn Howler', run: (c) => c.spawnMonster('howler') },
  ] },
  { title: '🧪 Spawn 2', buttons: [
    { label: () => '🔨 Spawn Brute', run: (c) => c.spawnMonster('brute') },
    { label: () => '🕷️ Spawn Ceiling Dweller', run: (c) => c.spawnMonster('dweller') },
    { label: () => '👻 Spawn Wisp', run: (c) => c.spawnMonster('wisp') },
  ] },
  { title: '👹 Monsters', buttons: [
    { label: (c) => '🦖 Become monster: ' + (c.S.monster ? 'ON' : 'OFF'), run: (c) => c.toggleMonster() },
    { label: () => '🧹 Remove all monsters', run: (c) => c.removeMonsters() },
  ] },
];

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// true if this device has the right secret. Also picks up ?admin=SECRET from the link and tidies the address bar.
export async function checkAdmin() {
  try {
    const url = new URL(location.href);
    const given = url.searchParams.get('admin');
    if (given) {
      try { localStorage.setItem('city-admin-key', given); } catch (e) {}
      url.searchParams.delete('admin');
      history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    }
    let key = '';
    try { key = localStorage.getItem('city-admin-key') || ''; } catch (e) {}
    if (!key || !crypto.subtle) return false;
    return (await sha256(key)) === ADMIN_HASH;
  } catch (e) { return false; }
}

// The floating panel. In VR: poke the buttons with a finger/hand. On PC: keys 1-4, [ ] for pages.
export function makeAdminPanel(scene, camera, ctx) {
  const W = 512, H = 400, PW = 0.5, PH = PW * H / W;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false }));
  mesh.renderOrder = 995; mesh.visible = false;
  scene.add(mesh);
  const P = { open: false, page: 0, note: '', noteUntil: 0, flat: false, latch: new Map(), rects: [] };
  const _l = new THREE.Vector3(), _d = new THREE.Vector3();

  function draw() {
    P.rects = [];
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(10,8,16,0.93)'; x.beginPath(); x.roundRect(4, 4, W - 8, H - 8, 28); x.fill();
    x.strokeStyle = '#d4a020'; x.lineWidth = 6; x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ffd24a'; x.font = 'bold 34px sans-serif';
    x.fillText('👑 ADMIN · ' + PAGES[P.page].title, W / 2, 44);
    x.fillStyle = '#9a8a60'; x.font = '22px sans-serif';
    x.fillText('page ' + (P.page + 1) + ' of ' + PAGES.length, W / 2, 80);
    const btns = PAGES[P.page].buttons.slice(0, 4);
    btns.forEach((b, i) => {
      const r = { x: 30, y: 100 + i * 52, w: W - 60, h: 46, fn: () => b.run(ctx), key: i + 1 };
      x.fillStyle = '#2a2236'; x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, 14); x.fill();
      x.strokeStyle = '#6a5a90'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif';
      x.fillText(b.label(ctx), W / 2, r.y + r.h / 2 + 1, r.w - 20);
      P.rects.push(r);
    });
    const nav = (label, rx, rw, fn, key) => {
      const r = { x: rx, y: 318, w: rw, h: 56, fn, key };
      x.fillStyle = '#3a2a1a'; x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, 14); x.fill();
      x.strokeStyle = '#d4a020'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#ffd24a'; x.font = 'bold 32px sans-serif'; x.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
      P.rects.push(r);
    };
    nav('◀', 30, 130, () => P.go(-1), '[');
    nav('✖ close', 186, 140, () => P.toggle(), 'x');
    nav('▶', 352, 130, () => P.go(1), ']');
    if (P.note && performance.now() < P.noteUntil) { x.fillStyle = '#8f8'; x.font = 'bold 24px sans-serif'; x.fillText(P.note, W / 2, 300); }
    tex.needsUpdate = true;
  }
  P.say = (t) => { P.note = t; P.noteUntil = performance.now() + 2500; if (P.open) draw(); };
  P.go = (d) => { P.page = (P.page + d + PAGES.length) % PAGES.length; draw(); };
  // open (in front of you) or close
  P.toggle = (head, dir, flat) => {
    P.open = !P.open;
    mesh.visible = P.open;
    if (!P.open) return;
    P.flat = !!flat;
    if (flat) { camera.add(mesh); mesh.position.set(0, 0, -0.62); mesh.rotation.set(0, 0, 0); if (!mesh.parent) camera.add(mesh); }
    else {
      scene.add(mesh);
      _d.set(dir.x, 0, dir.z).normalize();
      mesh.position.set(head.x + _d.x * 0.62, head.y - 0.12, head.z + _d.z * 0.62);
      mesh.rotation.set(0, Math.atan2(-_d.x, -_d.z), 0);
    }
    draw();
  };
  // PC keys
  P.key = (k) => { const r = P.rects.find((q) => q.key === k); if (r) { r.fn(); draw(); } };
  // poke with a hand (VR). id = which hand.
  P.poke = (id, pos) => {
    if (!P.open || P.flat) return;
    mesh.updateMatrixWorld();
    _l.copy(pos); mesh.worldToLocal(_l);
    const px = (_l.x / PW + 0.5) * W, py = (0.5 - _l.y / PH) * H;
    const near = Math.abs(_l.z) < 0.05;
    const r = near ? P.rects.find((q) => px > q.x && px < q.x + q.w && py > q.y && py < q.y + q.h) : null;
    if (!r) { if (Math.abs(_l.z) > 0.09 || !near) P.latch.set(id, null); return; }
    if (P.latch.get(id) === r) return;
    P.latch.set(id, r);
    r.fn(); draw();
    return true;
  };
  // close if you walk away
  P.update = (head) => { if (P.open && !P.flat && head.distanceTo(mesh.position) > 3.5) { P.open = false; mesh.visible = false; } };
  P.refresh = () => { if (P.open) draw(); };
  return P;
}
