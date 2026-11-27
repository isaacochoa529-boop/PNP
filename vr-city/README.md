# Abandoned City 🌃 (2-player VR horror, version 2)

Open the link on a Quest: https://isaacochoa529-boop.github.io/PNP/vr-city/
The first person in is the host, and the next person joins automatically (no codes).
Voice chat turns on when you press "Enter the city" (allow the mic).

## How to play
- 🦍 Gorilla movement: slap the ground and push to run, push down hard to jump, push off walls.
- ✊ Hold GRIP while touching a wall or roof to grab it and climb (fire escapes, roofs, cars...).
- 🔦 Your head lamp scares the Crawler away for 3 minutes. Then it screams and HUNTS.
- 🏚️ Hide inside open buildings (houses, shops, warehouses, churches). After about 40 s it smells you.
- 🔥 Pull the TRIGGER to throw a flare. It won't come near a flare for 25 s (one flare, recharges in 75 s).
- 🚨 1 in 5 nights is a RED NIGHT: it knows where you are from the start.
- 👻 Caught? You become a ghost and float around. When everyone is caught, a new night starts.
- ⌚ Your left wrist shows lights, timer, best time, friend status and hiding.

## Easy updates
- Files in `js/`:
  - `city.js`: streets, buildings, props, lamps, sky, mist, crickets
  - `textures.js`: the painted textures (bricks, asphalt, signs, graffiti)
  - `crawler.js`: the monster (its model, animation and brain)
  - `move.js`: gorilla movement and collisions
  - `friends.js`: what your friend looks like, their voice
  - `sound.js`: all sounds
  - `net.js`: auto-join and voice chat
  - `main.js`: rounds, hiding, flares, wrist, secrets, auto-update
- New file? Add its name to the `files` list in `index.html`.
- Then bump the number in `version.txt` AND in `<meta name="game-version">` in `index.html`.
  Every file gets `?v=<number>` so the update shows up right away; open headsets reload when you leave VR.

## More monsters (v7)
`js/monsters.js` holds 5 extra monsters: Stalker (freezes when looked at), Howler (screams, sprints, fears your lamp), Brute (slow, smashes walls, ignores light), Ceiling Dweller (drops from building ceilings) and Wisp (kills your lamp and street lights). Spawn them from the admin panel (Spawn / Spawn 2 pages). New player avatar lives in `js/friends.js` (face, clothes, walking legs, finger-curling hands).
