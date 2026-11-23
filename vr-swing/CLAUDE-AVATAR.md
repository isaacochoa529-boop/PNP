# 🤖 Claude buddy: how to drive it from a chat

Isaiah turns the buddy on in the game:

- **PC / phone:** tap the orange **🤖** button (left side, above 🏆). It turns green and shows a code, e.g. `HZF7BN`.
- **VR:** poke the glowing orange orb on the little post by the spawn (it turns green). The code shows in Claude's speech bubble.

He tells the chat the code. The code is saved, so it stays the same next time.

## Sending commands

Commands go through **ntfy.sh** (free, no account). Topic = `knucklegrove-claude-` + the code in **lowercase**.

```bash
curl -s -d "say Hi Isaiah! 👋" https://ntfy.sh/knucklegrove-claude-hzf7bn
```

Send several at once, one per line (or split with `;`). They run **in order**, each waits for the last to finish:

```bash
curl -s -d $'grab ball\ncome\nsay Catch!\nthrow' https://ntfy.sh/knucklegrove-claude-hzf7bn
```

**If curl answers `429` / "daily message quota reached"**: the cloud computer shares its internet address with lots of
others, so ntfy sometimes says no. Just send it again (a few tries usually works). A good one comes back with `"event":"message"`.

```bash
send() { for i in 1 2 3 4 5 6; do r=$(curl -s -m 10 -d "$2" "https://ntfy.sh/knucklegrove-claude-$1"); case "$r" in *'"event":"message"'*) echo sent; return 0;; esac; sleep 1; done; echo "failed: $r"; }
send hzf7bn "wave"
```

## Commands

| Command | What happens |
|---|---|
| `say <text>` | Speech bubble + text-to-speech voice (up to 220 characters). Waits until it's done talking |
| `walk <x> <z>` | Walk to a spot (world meters). Grove spawn is about `0 0`. If blocked for 3 s it hops, then teleports there (no more "I'm stuck") |
| `come` | Walk over to Isaiah (pops next to him if he's more than 35 m away, e.g. another area) |
| `follow` / `stay` | Keep following Isaiah around (keeps following while it talks or waves; hops when stuck, pops next to him if left far behind) / stop following |
| `look me` / `look <x> <z>` | Where to look while standing still (default: looks at Isaiah) |
| `wave` `nod` `jump` `dance` `spin` | Little animations |
| `grab <ball\|cone\|star\|nearest\|toyN>` | Walk to that toy and pick it up (nearest of that kind). Says so if it's too high or Isaiah has it |
| `drop` | Put the toy down |
| `throw` | Throw the held toy to Isaiah |
| `give` | Walk to Isaiah and hold the toy out. He grabs it (VR grip / desktop grab). After 8 s it's left at his feet |
| `tp me` / `tp <x> <z>` | Teleport next to Isaiah / to a spot |
| `wait <seconds>` | Pause the queue (max 30) |
| `stop` | Clear the queue, stop following, stop talking (happens right away) |
| `status` | The game posts where everyone is (see below) |
| `screen busy` / `screen free` / `screen <text>` / `screen <color> <text>` | The little screen on the buddy's tummy: 🛠️ BUSY (orange), ✅ FREE (green) or any text with emoji (blue, up to 48 letters, wraps to 2 lines). Start with a color name, #hex or `rainbow` to paint it, e.g. `screen pink 🍕 pizza time`. Instant. Claude sets busy while building, free when done. The game itself shows 🤔 THINKING from when Isaiah says something until the next command arrives (or 30 s) |

## ✨ Materialize powers: spawn anything

Claude can make things appear with a sparkly poof + chime (lines run in order with the other commands):

| Command | What happens |
|---|---|
| `spawn <thing> [count] [color] [size] [at ...]` | Poofs things in. Count 1-10. Color: red orange yellow gold green lime teal cyan blue navy purple violet pink hotpink white black gray brown silver `rainbow` or `#ff8800`. Size: `tiny` `small` `big` `huge` `giant` or `size 2.5` (0.3-4). Where: `at me` (default, 1.5 m in front of Isaiah), `at buddy`, `at X Z` or `at X Y Z`. Words can go in any order: `spawn 3 big pink ducks at buddy` |
| `despawn <thing>` / `despawn last` / `despawn all` | Poofs away Claude-made things only (never the game's own stuff) |
| `spawnables` | The game posts `ev: spawnables` with the full list, colors and sizes |

What you can spawn:

- **Toys** (Isaiah can grab + throw them, and the buddy can `grab duck` / `throw` / `give` them too): `ball` `cone` `star` `duck` `donut` `pizza` `burger` `apple` `heart` `crown` `present` `cupcake` `cake` `icecream` `diamond` `trophy` `pumpkin` `snowman` `rock` `sword` (a foam toy, it doesn't cut) `plush` (the sprout bear), plus plain shapes `box` `sphere` `pillar` `pyramid` `ring` to build anything else
- **Critters** (animated, they wander around Isaiah; petting gives hearts): `bunny` (hops) `puppy` (trots, wags) `chick` (waddles, pecks) `ghost` (floats) `butterfly` (flutters)
- **Floaty:** `balloon` (bobs, pops when poked, drifts off after ~45 s)
- **Effects:** `firework` (launches + bursts) `confetti` `rainbow` (big arc for 30 s)
- **Slicing Yard / party only** (their physics lives there): `cube` (color picks the cube), `megacube`, `butter`, `glasscube`, `rainbowcube`. Elsewhere the buddy says to go to the yard.
- **Dummies:** `dummy` ALWAYS appears in the Slicing Yard's DUMMY TEST zone, never in the lobby, wherever Isaiah is.

Limits (Quest performance): 24 live things at once, 10 cubes. Going over poofs the oldest away. Plurals and lots of nicknames
work (`bunnies`, `rabbit`, `dog`, `teddy`, `gift`, `rocket`...). An unknown thing posts `ev: error` with the known list: build it
from shapes instead, e.g. `spawn box brown big; spawn pyramid red at buddy`.
The game posts `ev: spawned` `{what, n, at, area, live, cap}` and `ev: despawned` `{n, live}`. Only Isaiah sees spawned things (not friends in a room).

## Reading what happens in the game

The game posts JSON to the `-out` topic. Read the last few minutes with:

```bash
curl -s "https://ntfy.sh/knucklegrove-claude-hzf7bn-out/json?poll=1&since=5m"
```

Each line's `message` is JSON with `ev`:

- `hello`: the buddy was just switched on.
- `status`: `{area, isaiah:{x,y,z}, claude:{x,y,z,holding,doing,queue}, toys:[{id,kind,x,y,z,dist,held}]}` (6 nearest toys).
- `heard`: **Isaiah talked to you!** `{text, how}`. `how` is `voice` (speech-to-text), `typed` (type box) or `button` (VR quick-talk board). Answer with `say`.
- `poke`: Isaiah poked / high-fived the buddy. `taken`: he took the toy you were giving. `unstuck`: a walk/come/grab was blocked, so the buddy teleported (next to Isaiah, or to the spot/toy).
- `error`: unknown command (lists the ones it knows).

Tip: send `status` first, wait 2-3 s, then read `-out` to plan where to walk.

## Isaiah talking to Claude 🎤

- **PC / phone:** the blue **🎤** button (shows once the buddy is on). It listens with the browser's speech-to-text and also opens a type box.
  On a phone, the keyboard's own mic button works in the type box too.
- **VR:** poke the tiny blue mic on the grove computer's desk, beside the keyboard. If the browser can't do speech-to-text (the Quest browser
  usually can't), a **quick-talk board** pops up next to the buddy instead: poke "Hi Claude!", "Come here!", "Follow me!",
  "Give me that!", "Dance!", "Throw it!", "Yes", "No".
- **Quest (and any browser without speech-to-text): push-to-talk with Claude's own ears.** Poke the mic (or tap 🎤), talk,
  poke again (or it stops after 25 s). A small Whisper model (tiny.en, transformers.js) turns it into words right in the
  browser, no account or key. It downloads about 40 MB the first time, then the browser keeps it. A clip takes a few seconds.
  The mic turns yellow 🧠 while it's thinking. The quick-talk board pops up too, as a backup.
- **Always listening 👂:** the 👂 button (PC/phone) or the 🤖 Claude tab on the grove computer (VR). It remembers the
  choice. With real speech-to-text it just keeps listening; on Quest it notices when he starts and stops talking and sends each
  sentence to the in-browser Whisper on its own (the mic glows green while waiting, red while recording, yellow while thinking).
  It ignores the buddy's own voice. Words said while it's still thinking about the last sentence can get missed.
- Everything he says shows as a toast ("🎤 You: ...") and lands on the `-out` topic as `ev: heard`.

## Honest limits

- **It's not real time.** Claude only acts when Isaiah sends a chat message, and each turn takes some seconds.
  The relay itself is fast (about a second). Line up a few commands at once so the buddy keeps busy.
- Only Isaiah sees his own buddy. Friends in a room see toys it moves, but not the buddy itself.
- Voice: the browser's text-to-speech where it works. On Quest (no text-to-speech) and anywhere the browser voice doesn't start, it
  uses a real-sounding neural voice (Piper `en_US-hfc_female-medium`, onnxruntime-web in a Web Worker, ~80 MB the first time,
  then kept in the browser cache). Lines are split into sentences so the first one starts fast. Until it has downloaded (or if it
  fails) the robot voice (eSpeak via meSpeak.js, ~1.2 MB) talks instead.
- Always listening waits for about 1.7 s of quiet before sending, and clips can be up to 25 s long.
- Grabbing works on the grove toys (balls, cones, stars), not swords, cubes or ragdolls.
- Speech-to-text works in Chrome / Edge / Safari on PC and phones. The Quest browser doesn't, so there it uses push-to-talk with the in-browser Whisper model (English only).
- Anyone who knows the code can send commands, so keep it in the chat.

## At Vivan's birthday party

When someone lands at the party (the hole at the end of the red carpet in the lobby), the buddy turns on by itself and waits on the rug at the
**cutting station** (it only wanders a tiny bit there, `CL.home`). It says happy birthday to Vivan. Answer her questions with `say ...` as usual.
Use `come` / `follow` if she wants Claude to walk with her (to the cake room, say).
