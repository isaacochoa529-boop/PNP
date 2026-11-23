# Knuckle Grove: where the code lives

`index.html` holds the page (HTML, CSS, menus). It loads the files in `src/` in this order, glues them
together and runs them as **one** module. Every file can use everything defined in the files before it
(and functions from any file). There's no build step: edit a file, push, and GitHub Pages serves it.

| File | What's in it |
|---|---|
| `src/00-treekit.js` | The low-poly tree kit (oak, pine, palm...) |
| `src/01-core.js` | Tuning numbers, renderer + scene, the collision world (`addCol`, colliders) |
| `src/02-world.js` | The grove: ground, cliffs, trees, stump, sign, mushrooms, treehouse, sky island, Knuckle Wall, pond, boulders, berries + secrets, Pip |
| `src/03-player.js` | Paws, the Thumpling avatar (`avSc`, `poseAvatar`), selfie screen, grabbable toys |
| `src/04-loop.js` | Audio, game state, arm-swing movement (`stepArms`), desktop walking, effects, toasts, input, XR controllers, main loop (`update`) |
| `src/10-yard.js` | Slicing Yard build: baseplate, portals, pedestals, console, sword, MEGA cube spot |
| `src/11-cubes.js` | Sliceable cubes and pieces (`makePiece`, `spawnCube`, cutting) |
| `src/12-glass.js` | Glass panes, cracks, breaking, glass lab, steam, glass sounds |
| `src/13-yard-play.js` | Rapier physics, sword handling, grabbing pieces, buttons, portal travel, yard per-frame |
| `src/20-horror.js` | Horror mode: switch, dark figure, screen effects, mirror, fake crash |
| `src/21-extras.js` | Slow-cut sizzle, bites, Pip pick-up, tough pulls (sword in stone, switch) |
| `src/30-multiplayer.js` | Rooms (PeerJS), sending your pose, friends' avatars, room-code menu |
| `src/31-computer.js` | The grove computer (desk, screen, keyboard) |
| `src/32-shared-world.js` | Shared world sync: owners, sending/receiving objects, snapshots for new friends |
| `src/33-phones.js` | Phone + tablet touch controls |
| `src/34-voice.js` | Voice chat (mic, calls, mouths) |
| `src/40-berry-menu.js` | The Berry Menu and its mods, plus the `window.__kg` test hooks |
| `src/41-pc-controls.js` | PC + phone versions of VR-only moves: click to punch (knock friends back, launch yourself), W into a wall to climb, mid-air platforms, U to free the mouse |
| `src/50-water.js` | Water Lab: wavy pool (ripples, slosh, floating/sinking, rising level), CUP button, drinking/pouring, slippery puddles, whetstone that turns glass into a glass sword |
| `src/60-royale.js` | Battle Royale mode: red start button by the spawn (🏆 on screens), loot (swords, guns, grenades, medkits, shields, jump boots), storm circle, health/shield HUD + wrist HUD, kill feed, bots, net `t:'br'` |
| `src/70-story.js` | Story intro cutscene (montage of the grove, letterbox, typed Elder Thump lore, VR theater screen), skippable, 🎬 STORY replay pedestal + menu button, black cheek paint |
| `src/80-wilds.js` | THE WILDS: huge 640 m open world behind the orange portal (Plaza + Beacon Tower, Frostfang Peak, river + Big Lake, Dune Temple + oasis, pine forest + Elder Tree, Old Town, Crystal Cave, Sky Islands). One heightfield collider (`t:4` in 01-core) holds the terrain plus a grid of every tree/rock/building. 8 waystones for fast travel (keys 1-8 / touch an orb), zipline, launch mushrooms, minimap, big-map Battle Royale |

New file? Add it to `PARTS` in `index.html`.
