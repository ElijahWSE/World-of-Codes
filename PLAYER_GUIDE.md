# World of Codes — Player Guide

Welcome to **World of Codes**, a shared 2D game world where every player gets their own room.
You explore the town square, find doors, and walk into rooms that other players have created.
Your room is built by AI based on a theme you choose — no coding required.

---

## How It Works

1. You pick a theme for your room (a forest, a haunted mansion, a candy land — anything)
2. You use Gemini in two steps to design and export your room code
3. You send me the final code, I review it and add it to the game
4. Your room appears in the town square with your name on the door

---

## Step-by-Step: Getting Your Room

### Step 1 — Choose a theme
Pick a creative name and visual theme for your room. Examples:
- "The Crystal Cave" — glowing blue walls and floating gems
- "Neon Arcade" — bright colors, blinking lights
- "Ancient Library" — dark stone floor, floating books

### Step 2 — Open Gemini
Go to [gemini.google.com](https://gemini.google.com) and start a **new conversation**.

---

## Prompt 1 — Design & Preview

Use this prompt first. It lets Gemini build a working preview so you can **see your room
and tweak the design** until you're happy. Replace `[YOUR THEME HERE]` with your theme.

```
I want to design a room for a 2D top-down browser game built with Phaser.js.
My room theme is: [YOUR THEME HERE]

Create an interactive preview of this room using a mock Phaser scene so I can see
what it looks like. The room should:
- Have a distinct visual style matching my theme (use rectangles, circles, stars, and text)
- Include animated elements (tweens for movement, blinking, spinning, etc.)
- Have an EXIT zone at the bottom centre of the screen (around x=400, y=560)

Store all the actual room logic inside a const called roomCode with these exact properties:
  name       — a string with the room's display name
  onLoad     — function(scene) for loading assets (leave empty if using only shapes)
  onCreate   — function(scene) for building the room
  onUpdate   — function(scene) for per-frame animations and the exit check
  onExit     — function(scene) for cleanup (set scene.roomData = null)

Inside onCreate, always include this exit trigger block at the end:
  const exitZone = scene.add.zone(400, 555, 120, 40);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;

Inside onUpdate, always include this exit check:
  const d = scene.roomData;
  if (d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) scene.exitRoom();
  }

Show me the preview so I can test it and ask for changes.
```

### Step 3 — Tweak your room
Play around with the preview in Gemini. Ask it to:
- Change colours, sizes, or positions of objects
- Add or remove decorations
- Make animations faster or slower
- Add text, signs, or welcome messages

Keep going until you're happy with how it looks.

---

## Prompt 2 — Export for Submission

Once you're happy with your design, send this second prompt **in the same Gemini conversation**.
Do not change anything in this prompt — copy it exactly.

```
Now take the room logic from the roomCode object above and rewrite it using the
exact template below. Fill in only the body of each function with the room code
you already designed. Do not change the structure.

STRICT RULES for the output:
  ✅ Return ONLY what is between the template markers — nothing else
  ✅ Keep all 5 export statements exactly as named
  ✅ Keep the exit trigger block in onCreate exactly as shown
  ✅ Keep the exit check block in onUpdate exactly as shown
  ❌ Do NOT add import, require(), or export default at the top
  ❌ Do NOT wrap in React, HTML, or any framework
  ❌ Do NOT include any explanation, commentary, or code fences
  ❌ Do NOT use fetch(), document, localStorage, or window

--- START OF TEMPLATE ---

export const name = 'My Room'; // ← use your room name

export function onLoad(scene) {
}

export function onCreate(scene) {
  scene.roomData = {};

  // ── your room design goes here ────────────────────────────────────────


  // ── exit trigger (keep this block exactly as-is) ──────────────────────
  scene.add.rectangle(400, 570, 120, 30, 0x333333);
  scene.add.text(400, 570, 'EXIT', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
  const exitZone = scene.add.zone(400, 555, 120, 40);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;
}

export function onUpdate(scene) {
  // ── exit check (keep this block exactly as-is) ────────────────────────
  const d = scene.roomData;
  if (d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) scene.exitRoom();
  }

  // ── per-frame animation logic goes here ───────────────────────────────

}

export function onExit(scene) {
  scene.roomData = null;
}

--- END OF TEMPLATE ---
```

### Step 4 — Send it to me
Copy everything Gemini returns from Prompt 2 and send it to me.
I'll review the code, add it to the game, and let you know when your door appears.

---

## What Rooms CAN Do

- Add a coloured floor, walls, and decorations using rectangles and shapes
- Display text (welcome messages, signs, story beats)
- Create simple animations (spinning objects, blinking lights, moving platforms)
- Add interactive triggers (walk into something to make it react)
- Include an exit door that returns you to the town square

## What Rooms CANNOT Do

- Import outside JavaScript libraries
- Make network requests (no fetch, no API calls)
- Read or write browser storage (no localStorage, no cookies)
- Interact with other players' rooms or the town square directly
- Use global variables or modify `window`

These rules exist so that every room runs safely inside the shared game world
without breaking other players' experiences.

---

## FAQ

**How long does it take for my room to appear?**
Usually within a day or two — I review each file manually before adding it.

**Can I update my room after it's added?**
Yes! Just go through the two prompts again with your changes and send me the new output.

**What if my room has a bug?**
The game is designed to handle broken rooms gracefully. If your room crashes,
it shows a friendly error and sends the player back to the town square automatically.
I'll let you know so you can fix it.

**Can my room have a custom name on the door?**
Yes — whatever you put as the `name` export in your room file is what shows on the door.
