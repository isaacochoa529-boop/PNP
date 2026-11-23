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
| `walk <x> <z>` | Walk to a spot (world meters). Grove spawn is about `0 0`. Gives up and says "I'm stuck" if blocked for 3 s |
| `come` | Walk over to Isaiah (pops next to him if he's more than 35 m away, e.g. another area) |
| `follow` / `stay` | Keep following Isaiah around / stop following |
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

## Reading what happens in the game

The game posts JSON to the `-out` topic. Read the last few minutes with:

```bash
curl -s "https://ntfy.sh/knucklegrove-claude-hzf7bn-out/json?poll=1&since=5m"
```

Each line's `message` is JSON with `ev`:

- `hello`: the buddy was just switched on.
- `status`: `{area, isaiah:{x,y,z}, claude:{x,y,z,holding,doing,queue}, toys:[{id,kind,x,y,z,dist,held}]}` (6 nearest toys).
- `heard`: **Isaiah talked to you!** `{text, how}`. `how` is `voice` (speech-to-text), `typed` (type box) or `button` (VR quick-talk board). Answer with `say`.
- `poke`: Isaiah poked / high-fived the buddy. `taken`: he took the toy you were giving. `stuck`: a walk or grab failed.
- `error`: unknown command (lists the ones it knows).

Tip: send `status` first, wait 2-3 s, then read `-out` to plan where to walk.

## Isaiah talking to Claude 🎤

- **PC / phone:** the blue **🎤** button (shows once the buddy is on). It listens with the browser's speech-to-text and also opens a type box.
  On a phone, the keyboard's own mic button works in the type box too.
- **VR:** poke the blue mic on the little post next to the orange orb. If the browser can't do speech-to-text (the Quest browser
  usually can't), a **quick-talk board** pops up next to the buddy instead: poke "Hi Claude!", "Come here!", "Follow me!",
  "Give me that!", "Dance!", "Throw it!", "Yes", "No".
- Everything he says shows as a toast ("🎤 You: ...") and lands on the `-out` topic as `ev: heard`.

## Honest limits

- **It's not real time.** Claude only acts when Isaiah sends a chat message, and each turn takes some seconds.
  The relay itself is fast (about a second). Line up a few commands at once so the buddy keeps busy.
- Only Isaiah sees his own buddy. Friends in a room see toys it moves, but not the buddy itself.
- Voice uses the browser's built-in text-to-speech. Some browsers (sometimes the Quest browser) have no voice: the bubble still shows.
- Grabbing works on the grove toys (balls, cones, stars), not swords, cubes or ragdolls.
- Speech-to-text works in Chrome / Edge / Safari on PC and phones. The Quest browser usually doesn't support it, so VR uses the quick-talk board.
- Anyone who knows the code can send commands, so keep it in the chat.
