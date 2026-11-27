/* ---------- Quest speed-ups for the whole game (Nov 27, "it is very laggy") ----------
   Nothing is removed and nothing should look different. The tricks:
   1) GLUE everywhere: the party's glue/copies trick (88-party-perf.js) now also runs on the grove, THE HUNT,
      the Wilds and the beach, so hundreds of little still meshes draw as a few big ones (fewer draw calls).
   2) Places you can't possibly see (farther than the camera can draw) skip their matrix maths, and the
      Slicing Yard hides itself while you're far away from it (it was being checked every frame from the grove).
   3) In VR the sun's shadow map is redrawn every 2nd frame (72 fps headset = 36 shadow updates a second).
   4) The flashlight only counts as a light while it's actually on (an "off" light still cost every pixel).
      Its shaders are warmed up in the menu, so turning horror on still doesn't stall.
   Also elsewhere: the selfie mirror draws only when you look at it (03-player), far-away dummies nap
   (90-ragdolls), a calm slime pool naps (50-water). */
const PZ = { on: true, frame: 0, inScene: false, tick: 0, warm: false };

/* ----- 1) glue the other places ----- */
const PZ_ZONES = [arena, WG, partyG, BG, HUG];
const PG_GROVE = makeGlue(scene, { cell: 16,
  skip: new Set([...PZ_ZONES, rig]),
  near: o => { const e = o.matrixWorld.elements; return e[12] * e[12] + e[14] * e[14] < 95 * 95 && Math.abs(e[13]) < 90; },   // only the grove itself
});
const PG_HUNT = makeGlue(HUG, { cell: 16 }), PG_WILDS = makeGlue(WG, { cell: 16 }), PG_BEACH = makeGlue(BG, { cell: 16 });
// things that hand their own picture to a camera or get raycast: leave them alone
selfie.g.children[0].userData.pfNo = true;
if (typeof comp !== 'undefined' && comp) [comp.scr, comp.kb].forEach(m => { if (m) m.userData.pfNo = true; });
if (typeof _ray !== 'undefined' && _ray.layers) _ray.layers.enable(PF_LAYER);

/* ----- 2) far-away places: no matrix maths, and the yard hides when you can't see it ----- */
{
  const sUMW = scene.updateMatrixWorld;
  scene.updateMatrixWorld = function (force) { PZ.inScene = true; PZ.tick++; try { return sUMW.call(this, force); } finally { PZ.inScene = false; } };
  for (const R of PZ_ZONES) {
    const own = R.updateMatrixWorld;
    // hidden: refresh only now and then (so anything built there meanwhile still gets a proper spot)
    R.updateMatrixWorld = function (force) { if (PZ.on && PZ.inScene && !this.visible && (PZ.tick + this.id) % 30) return; return own.call(this, force); };
  }
}
const _pz1 = V(), _pz2 = V();
function pzYard() {
  // the yard (and the party's physics bits, which live in the yard's group) can only be seen from near them
  const lim = camera.far + 80, lim2 = lim * lim;
  camera.getWorldPosition(_pz1); const f = (CS.on || huCam()) && CS.cam ? CS.cam.position : _pz1;
  const seen = p => _pz1.distanceToSquared(p) < lim2 || f.distanceToSquared(p) < lim2 || rig.position.distanceToSquared(p) < lim2;
  arena.visible = !PZ.on || state.area === 'arena' || PT.inside || seen(ARENA) || seen(PW);
}

/* ----- 3) + 4) every frame ----- */
function stepPerf(dt) {
  pzYard();
  // the flashlight: a light that's "off" still made every pixel do the maths
  torch.visible = !PZ.on || HZ.on || torch.intensity > 0 || !PZ.warm;
  // glue: the grove when you're around it, the other places when you're in them (their groups are hidden otherwise)
  _pz2.copy(rig.position); if (_pz2.x * _pz2.x + _pz2.z * _pz2.z < 200 * 200) PG_GROVE.step(dt);
  if (HUG.visible) PG_HUNT.step(dt);
  if (WG.visible) PG_WILDS.step(dt);
  if (BG.visible) PG_BEACH.step(dt);
}
function perfFrame() {
  const sm = renderer.shadowMap;
  if (PZ.on && state.xr) { sm.autoUpdate = false; if ((PZ.frame++ & 1) === 0) sm.needsUpdate = true; }
  else sm.autoUpdate = true;
}
// warm up the flashlight's shaders in the menu, so switching horror on later never freezes the game
setTimeout(async () => {
  try { torch.visible = true; if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) {}
  PZ.warm = true;
}, 2500);
function pzOff() { PZ.on = false; PF_ALL.forEach(g => { if (g !== PG_PARTY) g.pfOff(); }); arena.visible = true; torch.visible = true; renderer.shadowMap.autoUpdate = true; }
window.__kg.perf = { PZ, PG_GROVE, PG_HUNT, PG_WILDS, PG_BEACH, pzOff, stats: () => ({ grove: PG_GROVE.stats(), hunt: PG_HUNT.stats(), wilds: PG_WILDS.stats(), beach: PG_BEACH.stats(), party: PG_PARTY.stats() }) };
