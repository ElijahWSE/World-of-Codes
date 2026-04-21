// _template.js — The player room template (THE CONTRACT)
//
// THIS FILE IS GIVEN TO PLAYERS AND TO GEMINI WHEN GENERATING ROOMS.
// DO NOT rename, remove, or restructure these hooks once finalized.
// Rooms that players submit will be generated against this exact API.
//
// HOW ROOMS WORK:
// Each player room is a single JavaScript file that exports these 5 hooks.
// The engine calls your hooks at the right time — you don't control the
// game loop directly. You only fill in what your room contains.
//
// The ONLY thing you interact with is the `scene` object passed into each hook.
// Think of `scene` as your toolbox. Everything you need is on it:
//   scene.add        — create visual objects (rectangles, text, images)
//   scene.physics    — create physics-enabled objects that can collide
//   scene.input      — detect keyboard and mouse input
//   scene.cameras    — control the camera
//   scene.time       — set up timers and delayed events
//   scene.tweens     — animate objects smoothly
//
// WORLD SIZE: 1600 × 1200 pixels
//   Your world is 1600px wide and 1200px tall — the same size as the town square.
//   The camera follows the player automatically, so players can explore the full space.
//   Place your exit zone at the bottom centre: around x=800, y=1150.
//
// RULES — read carefully:
//   ✅ DO: Create objects, text, shapes, and interactions inside the hooks
//   ✅ DO: Store your room's objects in local variables inside each hook,
//          or use `scene.roomData` (an object reserved for your room's state)
//   ✅ DO: Use scene.exitRoom() to send the player back to the town square
//   ❌ DON'T: import any outside libraries or use require()
//   ❌ DON'T: Use fetch(), XMLHttpRequest, or access the network
//   ❌ DON'T: Use global variables (window.anything, globalThis.anything)
//   ❌ DON'T: Modify other rooms or the WorldScene
//   ❌ DON'T: Use document, localStorage, or any browser API outside of scene
//
// ASSET KEYS — important:
//   If you load any images or audio, prefix the key with your room name
//   to avoid conflicts with other rooms in Phaser's asset cache.
//   Example: scene.load.image('myroom_floor', 'path/to/floor.png')
//   NOT:     scene.load.image('floor', 'path/to/floor.png')  ← BAD, may conflict

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED EXPORT: name
// The display name of your room. Shown above the door in the town square.
// Must be a string. Keep it short (under 20 characters).
// ─────────────────────────────────────────────────────────────────────────────
export const name = 'My Room';

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: onLoad(scene)
// Called during Phaser's preload phase, BEFORE the room is displayed.
// Use this hook to load any images, audio, or tilemaps your room needs.
// If your room uses only shapes and text (no external files), leave this empty.
//
// Example:
//   scene.load.image('myroom_wall', 'shared-assets/wall.png');
// ─────────────────────────────────────────────────────────────────────────────
export function onLoad(scene) {
  // Load your assets here. Leave empty if you only use shapes and text.
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: onCreate(scene)
// Called once when the player enters your room, after assets are loaded.
// This is where you build your room: place the floor, walls, objects, and text.
// Store any objects you need to reference in onUpdate in scene.roomData.
//
// Example:
//   scene.roomData = {};
//   scene.roomData.floor = scene.add.rectangle(800, 600, 1600, 1200, 0x3a1a5e);
//   scene.add.text(800, 120, 'Welcome to My World!', { fontSize: '24px', fill: '#fff' })
//     .setOrigin(0.5);
// ─────────────────────────────────────────────────────────────────────────────
export function onCreate(scene) {
  // Build your room here. This runs once when the player enters.
  scene.roomData = {}; // Use this object to store anything you need in onUpdate
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: onUpdate(scene)
// Called every frame (~60 times per second) while the player is in your room.
// Use this for animations, movement checks, or interactive logic.
// Keep this lean — heavy work here will slow the game down.
//
// Example:
//   if (scene.roomData.coin) {
//     scene.roomData.coin.angle += 1; // Spin the coin each frame
//   }
// ─────────────────────────────────────────────────────────────────────────────
export function onUpdate(scene) {
  // Per-frame logic goes here. Leave empty if your room has no animations.
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: onExit(scene)
// Called once when the player leaves your room (triggered by scene.exitRoom()).
// Use this to clean up anything your room created: destroy objects, stop timers.
// If you don't clean up, leftover objects may bleed into the town square.
//
// Example:
//   if (scene.roomData.timer) {
//     scene.roomData.timer.remove();
//   }
// ─────────────────────────────────────────────────────────────────────────────
export function onExit(scene) {
  // Cleanup your room here. Destroy objects, stop sounds, remove timers.
  // After this runs, the player is returned to the town square.
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL: Mini-game (Club Penguin style)
// If you want a playable mini-game inside your world, export these three things.
// Players walk to the game zone, see "[E] Play: <gameName>", and press E to open
// an 800×600 game overlay on top of the world.
//
// gameZoneX / gameZoneY — world coordinates of the game entrance trigger.
//   Place a visual marker here in onCreate (a glowing spot, arcade machine, etc.)
//
// game — an object with 4 hooks. The game runs in an 800×600 overlay panel.
//   Coordinates inside the game: x 0–800, y 65–590 (top 64px is the title bar).
//   Call scene.exitGame() when the player finishes or quits.
//
// Example:
//   export const gameZoneX = 800;
//   export const gameZoneY = 500;
//   export const game = {
//     gameName: 'Catch the Stars',
//     onGameLoad(scene) {},
//     onGameCreate(scene) {
//       scene.gameData = {};
//       // build your game UI here
//     },
//     onGameUpdate(scene) {
//       // per-frame game logic
//     },
//     onGameExit(scene) {
//       scene.gameData = null;
//     },
//   };
// ─────────────────────────────────────────────────────────────────────────────
