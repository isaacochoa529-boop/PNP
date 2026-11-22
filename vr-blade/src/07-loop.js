// ===== LOOP: runs every frame =====
buildDummy();
const clock = new THREE.Clock();
function step(dt) {
  state.t += dt;
  if (inVR()) stepVR(dt);
  else if (state.mode === 'pc') stepPC(dt);
  else { camera.position.set(0, 1.55, 0); camera.rotation.set(-.08, Math.sin(state.t * .2) * .15, 0); }
  stepDummy(dt);
  stepLoose(dt);
  stepBleeders(dt);
  stepDrops(dt);
  stepBanners(state.t);
  stepFlames(state.t);
  stepToast(dt);
  if (vrText.m.visible && state.t > vrText.until) vrText.m.visible = false;
  gary.rotation.y = Math.sin(state.t * .7) * .4; gary.position.y = GARY_POS.y + Math.abs(Math.sin(state.t * 3)) * .02;
}
renderer.setAnimationLoop(() => { step(Math.min(clock.getDelta(), 1 / 30)); renderer.render(scene, camera); });
// test hook for automated checks
window.__bbCam = () => camera.getWorldPosition(new V3());
window.__bb = { step, freeDummy, rig, camera, state, HANDS, pc, get DUM() { return DUM; }, LOOSE, pullPart, ripPart, smashHead, hitDummy, buildDummy, findGrabRay, startPC, keepIn };
