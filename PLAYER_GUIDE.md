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
// _template.js — The player room template (THE CONTRACT)
//
// THIS FILE IS GIVEN TO PLAYERS AND TO GEMINI WHEN GENERATING ROOMS.
// DO NOT rename, remove, or restructure these hooks once finalized.
// Rooms that players submit will be generated against this exact API.
//
// The ONLY thing you interact with is the `scene` object passed into each hook.
//   scene.add        — create visual objects (rectangles, text, images)
//   scene.physics    — create physics-enabled objects that can collide
//   scene.input      — detect keyboard and mouse input
//   scene.cameras    — control the camera
//   scene.time       — set up timers and delayed events
//   scene.tweens     — animate objects smoothly
//
// RULES:
//   ✅ DO: Create objects, text, shapes, and interactions inside the hooks
//   ✅ DO: Store your room's objects in scene.roomData
//   ✅ DO: Use scene.exitRoom() to send the player back to the town square
//   ❌ DON'T: import any outside libraries or use require()
//   ❌ DON'T: Use fetch(), XMLHttpRequest, or access the network
//   ❌ DON'T: Use global variables (window.anything, globalThis.anything)
//   ❌ DON'T: Modify other rooms or the WorldScene
//   ❌ DON'T: Use document, localStorage, or any browser API outside of scene

export const name = 'My Room';

export function onLoad(scene) {
  // Load your assets here. Leave empty if you only use shapes and text.
}

export function onCreate(scene) {
  scene.roomData = {};
  // Build your room here. This runs once when the player enters.
}

export function onUpdate(scene) {
  // Per-frame logic goes here. Leave empty if your room has no animations.
}

export function onExit(scene) {
  // Cleanup your room here. Destroy objects, stop sounds, remove timers.
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
