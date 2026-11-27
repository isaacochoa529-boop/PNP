# Abandoned City 🌃 (2-player VR horror)

Open the link on a Quest. The first person in is the host, and the next person joins automatically (no codes).

## Easy updates
- Change files in `js/`:
  - `city.js`: streets, buildings, crickets, sky
  - `crawler.js`: the monster (its brain and how it moves)
  - `sound.js`: footsteps, singing, screams
  - `net.js`: auto-join and voice
  - `main.js`: your hands, round rules, HUD, secrets
- Then bump the number in `version.txt` AND in `<meta name="game-version">` in `index.html`.
  Players' headsets reload on their own within about a minute.
