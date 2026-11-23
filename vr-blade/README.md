# Bonebreaker Yard 🦴

A brutal physics VR game (WebXR + Three.js). Quest first, PC works too.
Play: https://isaacochoa529-boop.github.io/PNP/vr-blade/

`index.html` loads the files in `src/` in order and runs them as ONE module (they share one scope).
Trees come from `../vr-swing/src/00-treekit.js`.

| File | What it owns |
|---|---|
| 01-core.js | renderer, scene, camera rig, saved settings (`bb-set`), toast, WebAudio sounds |
| 02-world.js | stone yard, sky, banners, torches, trees, rip-counter sign, red respawn button, secret room, `keepIn()` bounds |
| 03-human.js | `makeHuman()` real-looking person (pivots at joints), `makeHand()` |
| 04-gore.js | blood drops, floor splats, stumps with bones, bleeders, loose rigid bodies + floor collision, `onImpact()` |
| 05-dummy.js | the dummy that looks like you: grabbing, joint tearing, punching, slams, head smashing, speech bubble |
| 05c-weapons.js | weapons (`WEAPONS`): sword, dagger, axe, spear, mace, sledgehammer, war hammer. Spring-driven grip (heavy = lag + sag, two hands = control), cut / stab / crush damage, the weapons table |
| 05b-ragdoll.js | the ragdoll: verlet points + bones/joints/limits (`RAG`), post pin, muscles, collisions, posing the meshes |
| 06-player.js | VR hands (grip grab/pull/throw/punch), thumbstick or gorilla-arm movement, PC mouse/keys, menu |
| 07-loop.js | frame loop + `window.__bb` test hook |
