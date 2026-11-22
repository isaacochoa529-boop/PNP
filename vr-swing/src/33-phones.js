/* ======================================================================
   PHONES + TABLETS: a stick to run, drag anywhere to look, big buttons to jump, grab and swing.
   Tap the grove computer's keys right on the screen. Same rooms, same world as PC and VR.
   ====================================================================== */
state.touch = IS_TOUCH;
if (IS_TOUCH) { $('btnDesk').textContent = '📱 Play on phone / tablet'; const hint = $('hud').querySelector('.hint'); if (hint) hint.textContent = '☰ = menu'; }
function tapAt(x, y) {   // a quick tap on the computer presses what you tapped
  if (state.area !== 'grove') return false;
  const r = canvas.getBoundingClientRect(); _ray.setFromCamera({ x: (x - r.left) / r.width * 2 - 1, y: -((y - r.top) / r.height * 2 - 1) }, camera); _ray.far = 3;
  const hit = _ray.intersectObjects([comp.scr, comp.kb], false)[0]; if (!hit || !hit.uv) return false;
  if (hit.object === comp.scr) compTapScreen(hit.uv.x, hit.uv.y); else compTapKb(hit.uv.x, hit.uv.y);
  return true;
}
{
  const stick = $('stick'), nub = $('nub'); let sid = null, cx = 0, cy = 0;
  const setNub = (x, y) => { nub.style.transform = `translate(${x}px, ${y}px)`; };
  const move = e => { if (e.pointerId !== sid) return; let dx = e.clientX - cx, dy = e.clientY - cy; const L = Math.hypot(dx, dy), RR = 55; if (L > RR) { dx *= RR / L; dy *= RR / L; } state.joy.x = dx / RR; state.joy.y = dy / RR; setNub(dx, dy); };
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; try { stick.setPointerCapture(sid); } catch (er) {} const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); audioOn(); e.preventDefault(); });
  stick.addEventListener('pointermove', move);
  const end = e => { if (e.pointerId !== sid) return; sid = null; state.joy.x = state.joy.y = 0; setNub(0, 0); };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  // look: drag anywhere else. A quick tap pokes the computer where you tapped.
  const looks = new Map();
  canvas.addEventListener('pointerdown', e => { if (!e.isTrusted || !state.touch || state.mode !== 'play' || state.xr) return; looks.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }); });
  canvas.addEventListener('pointermove', e => { const L = looks.get(e.pointerId); if (!L) return; const dx = e.clientX - L.x, dy = e.clientY - L.y; L.x = e.clientX; L.y = e.clientY; state.yaw -= dx * .0055; state.pitch = clamp(state.pitch - dy * .0045, -1.45, 1.45); });
  const lookEnd = e => { const L = looks.get(e.pointerId); if (!L) return; looks.delete(e.pointerId); if (e.type === 'pointerup' && Math.hypot(e.clientX - L.sx, e.clientY - L.sy) < 12 && performance.now() - L.t < 350) tapAt(e.clientX, e.clientY); };
  canvas.addEventListener('pointerup', lookEnd); canvas.addEventListener('pointercancel', lookEnd);
  const btn = (id, on, off) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); audioOn(); on(); }); if (off) ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, off)); b.addEventListener('contextmenu', e => e.preventDefault()); };
  const click = button => canvas.dispatchEvent(new PointerEvent('pointerdown', { button, pointerId: 999 }));
  btn('tJump', () => { state.keys.Space = true; }, () => { state.keys.Space = false; });
  btn('tGrab', () => deskInteract());
  btn('tUse', () => click(0));
  btn('tSlash', () => click(2));
  btn('tBite', () => { const h = hands.find(x => x.piece); if (h && biteCool <= 0) takeBite(h.piece); });
  btn('tMenu', () => openMenu());
  btn('tView', () => { state.third = !state.third; camera.layers[state.third ? 'enable' : 'disable'](SELF_LAYER); camera.layers[state.third ? 'disable' : 'enable'](FP_LAYER); });
  btn('tResp', () => respawn());
}
let _tuiS = '';
function stepTouchUi() {   // only show Slash and Bite when they do something
  if (!state.touch || state.mode !== 'play') return;
  const sl = !!hands[1].sword, bi = hands.some(h => h.piece), k = (sl ? 1 : 0) + (bi ? 2 : 0) + '';
  if (k === _tuiS) return; _tuiS = k; $('tSlash').hidden = !sl; $('tBite').hidden = !bi;
}
window.__kg.touch = { tapAt, stepTouchUi };
