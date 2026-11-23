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
| `src/85-party.js` | 🎂 Vivan's birthday party: lobby banner + red carpet + party hole (hole at grove (3.2, -13.1)). Jump in = float down a rainbow tube with a party hat + party blower (mic loudness or hold B unrolls it, PARP + confetti; BLOWER OFF button / grab it at your mouth / 🙅 button). Party island at world (-400, 0, 0) uses the yard's physics (`state.area` stays `'arena'`, `PT.inside` = at the party): sword table, START button, CUBE BLASTER that shoots cubes at you for 30 s with a cut counter + best (`kg-party-best`), Claude buddy waits at the cutting station (`CL.home`), CAKE ROOM with a giant 2-tier sliceable cake (kinds 13 + 14), candles you can blow out, NEW CAKE button. Hooks: `partyGrab` / `partyDesk` / `partyRespawn` / `stepParty`. Test hook `__kg.party` |
| `src/86-photo-booth.js` | 📸 Photo booth at Vivan's party (left side of the island, star spot at party-local (-8.2, -3)): 18 props on two racks (head / eyes / face / neck / hand slots) worn on the avatar (head + torso props on `SELF_LAYER`, hand props float on the left paw), tripod camera that follows you, SNAP button / P / panel: a strip of 4 photos (3-2-1 each, flash), big screen shows each photo then a 2x2 grid (live mirror view in between), the tall photo strip flies to the PHOTO WALL (last 4), 💾 save strip / 📂 save all strips on PC/phone. Rack colliders cover only the table so paws reach the bottom shelf. Outfit saved in `kg-booth`. Hooks: `boothGrab` / `boothDesk` (called from `partyGrab` / `partyDesk`), `stepBooth` (from `stepParty`). Test hook `__kg.booth` |
| `src/87-coaster.js` | 🎢 Vivi's birthday coaster at the back of the party island (station party-local (0, -12.6..-19.4)). Locked (rope + sign) until the cake is cut (more cake pieces than at the start of the visit), then the track builds itself: long lift up into the clouds (~40 m), cloud cruise through puffs with a sea-of-clouds layer `CT.sea` hiding the ground while you are up top, plus `CT.sky` (~450 instanced puffs, opaque) filling the whole sky at 35-44 m once the track is built, big drop through it, camel hill, LOOP-DE-LOOP, turn, kicker ramp. RIDE button / 🎢 DOM button near the station; COMFY button (`kg-coaster-comfy`) keeps the horizon level. Ride locks player movement (`rcRiding()` in 04-loop, respawn ignored), capped speeds + vignette in VR. Off the ramp you fly over the island: fireworks, Happy Birthday song, "HAPPY BIRTHDAY VIVI!" letters in the sky, balloons float you down at party-local (-4, 2.5). Hook: `stepCoaster` (from `stepParty`). Test hook `__kg.coaster` |
| `src/90-ragdolls.js` | Ragdoll test dummies that look like the player (Thumpling parts baked to one mesh each), blank and silent. 3 stand in the DUMMY TEST zone of the Slicing Yard (`RD_TEST`). Spawn (G / 🧸 / left stick click), fix (H / right stick click), clear (J / hold right stick). Grab and pull arms + head: the part itself stretches up to half a player longer, then rips. Cotton stuffing normally, meat + bones + floor splats in horror mode. Sledgehammer to bonk them. Not shared in rooms |
| `src/91-cheese-saw.js` | 🧀 CHEESE PULL + 🪚 CHAINSAW for the dummies. The torso is split at the waist (`rwSplit`, top half = `rd.torso`, bottom = `rd.torsoLo`); waist seams are constraint kind `'w'` that only go soft when BOTH halves are held (`rd.W.pulled`), so the waist stretches into a bendy gooey tube (rebuilt each frame on a curve, skinny in the middle) with sagging cheese strings (`CHZ` instanced) that snap, then it tears in two (cotton / meat caps). PC: right-click pins a part (`src:'pin'` in `RD.held[0]`), phone: 🧸 menu 📌. Chainsaw `SAW` waits on a stump next to the DUMMY TEST sign (arena-local (-5.75, .4)): VR grip + trigger revs, PC E + hold click, phone ✋ + ⚔️. Engine = WebAudio oscillators + noise, chain teeth are instanced and run round the bar, haptics. Sawing a dummy ~0.5 s turns it into 11 sliceable cubes (KINDS 15-22 cotton, 23-30 meat, added in 11-cubes.js); it cuts yard cubes too. Test hook `__kg.saw` |
| `src/95-claude-avatar.js` | Claude buddy: an extra Thumpling that Claude drives from the chat through ntfy.sh (walk, say with text-to-speech, grab/give/throw toys, wave, follow). 🤖 button / orange orb by the spawn. Commands: see `CLAUDE-AVATAR.md` |

New file? Add it to `PARTS` in `index.html`.
