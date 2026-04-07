# World of Codes — Player Guide

Welcome to **World of Codes**, a shared 2D game world where every player gets their own room.
You explore the town square, find doors, and walk into rooms that other players have created.
Your room is built by AI based on a theme you choose — no coding required.

---

## How It Works

1. You pick a theme for your room (a forest, a haunted mansion, a candy land — anything)
2. You copy-paste a prompt into Gemini, tell it your theme, and it writes the room code
3. You send me the code file, I review it and add it to the game
4. Your room appears in the town square with your name on the door

---

## Step-by-Step: Getting Your Room

### Step 1 — Choose a theme
Pick a creative name and visual theme for your room. Examples:
- "The Crystal Cave" — glowing blue walls and floating gems
- "Neon Arcade" — bright colors, blinking lights
- "Ancient Library" — dark stone floor, floating books

### Step 2 — Open Gemini
Go to [gemini.google.com](https://gemini.google.com) and start a new conversation.

### Step 3 — Copy and paste the prompt below
Replace `[YOUR THEME HERE]` with your actual theme, then send the whole thing to Gemini.

---

## The Gemini Prompt (copy this exactly)

```
I need you to write a player room for a 2D top-down browser game built with Phaser.js.

The room must follow this EXACT template structure. Fill in the hooks only.
Do not add any imports, require() calls, or outside libraries.
Do not use fetch(), localStorage, document, or any browser API.
Do not use global variables (no window.x, no globalThis.x).
Only use the `scene` object passed into each hook.

Available on scene:
  scene.add         — create rectangles, text, images, shapes
  scene.physics     — create physics-enabled objects with collision
  scene.input       — keyboard and mouse input
  scene.cameras     — camera control
  scene.time        — timers and delayed events
  scene.tweens      — smooth animations
  scene.roomData    — use this object to store your room's state between frames
  scene.exitRoom()  — call this to send the player back to the town square

IMPORTANT: If you load any images, prefix every asset key with the room name
(e.g. 'myroom_floor', not 'floor') to avoid cache conflicts with other rooms.

Include an exit trigger: a visible object the player can walk into that calls
scene.exitRoom() to return them to the town square.

Return ONLY the completed JavaScript file with no explanation. No markdown code
fences, no commentary — just the raw .js file content.

Here is the template to fill in:

---
// The ONLY thing you interact with is the `scene` object passed into each hook.
//   scene.add        — create visual objects (rectangles, text, images, stars, circles)
//   scene.physics    — create physics-enabled objects that can collide
//   scene.input      — detect keyboard and mouse input
//   scene.cameras    — control the camera
//   scene.time       — set up timers and delayed events
//   scene.tweens     — animate objects smoothly
//   scene.roomData   — store anything your room needs between frames
//   scene.player     — reference to the local player sprite (a Phaser GameObject)
//   scene.exitRoom() — call this to return the player to the town square
//
// RULES:
//   ✅ DO: Create objects, text, shapes, and interactions inside the hooks
//   ✅ DO: Store state in scene.roomData (initialise it as {} in onCreate)
//   ✅ DO: Include an exit trigger that calls scene.exitRoom()
//   ❌ DON'T: import any outside libraries or use require()
//   ❌ DON'T: Use fetch(), XMLHttpRequest, or access the network
//   ❌ DON'T: Use global variables (window.anything, globalThis.anything)
//   ❌ DON'T: Use document, localStorage, or any browser API outside of scene
//
// CANVAS SIZE: 800 wide × 600 tall. Place objects within these bounds.
// ASSET KEYS: if you call scene.load.image(), prefix the key with your room
//   name to avoid cache conflicts. e.g. 'myroom_floor', not 'floor'.

export const name = 'My Room';

export function onLoad(scene) {
  // Load images or audio here. Leave empty if you only use shapes and text.
}

export function onCreate(scene) {
  scene.roomData = {};
  // Build your room here. Runs once when the player enters.
  // Use scene.add.rectangle(x, y, w, h, color) for solid shapes.
  // Use scene.add.text(x, y, 'string', { fontSize: '20px', fill: '#fff' }) for text.
  // Use scene.add.circle(x, y, radius, color) for circles.
  // Use scene.add.star(x, y, points, innerR, outerR, color) for star shapes.
  // For the exit trigger, create a zone and check overlap in onUpdate:
  //   const exitZone = scene.add.zone(x, y, width, height);
  //   scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  //   scene.roomData.exitZone = exitZone;
  //   scene.roomData.player = scene.player;
}

export function onUpdate(scene) {
  // Runs every frame (~60fps). Keep this lean.
  // Check for exit overlap like this:
  //   const d = scene.roomData;
  //   if (d.player && d.exitZone) {
  //     const hit = Phaser.Geom.Intersects.RectangleToRectangle(
  //       d.player.getBounds(), d.exitZone.getBounds()
  //     );
  //     if (hit) scene.exitRoom();
  //   }
}

export function onExit(scene) {
  // Clean up timers and tweens here. scene.add objects are destroyed automatically.
  scene.roomData = null;
}
---

My room theme is: [YOUR THEME HERE]
```

---

### Step 4 — Save the file Gemini gives you
Copy everything Gemini returns and save it as a `.js` file.
Name it something simple like `my-cool-room.js`.

### Step 5 — Send it to me
Send me the `.js` file (Discord, email, or however we're in contact).
I'll review the code, add it to the game, and let you know when your door appears.

---

## What Rooms CAN Do

- Add a colored floor, walls, and decorations using rectangles and shapes
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
Yes! Just generate a new version with Gemini and send it to me again.

**What if my room has a bug?**
The game is designed to handle broken rooms gracefully. If your room crashes,
it shows a friendly error and sends the player back to the town square automatically.
I'll let you know so you can fix it.

**Can my room have a custom name on the door?**
Yes — whatever you put as the `name` export in your room file is what shows on the door.
