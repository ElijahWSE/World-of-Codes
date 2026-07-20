// _template.js — The interactive-object contract (THE CONTRACT)
//
// THIS FILE IS GIVEN TO PLAYERS AND TO GEMINI WHEN GENERATING INTERACTIVE
// OBJECTS. DO NOT rename, remove, or restructure these hooks once finalized.
//
// WHAT AN INTERACTIVE OBJECT IS:
// A small, standalone piece of code attached to one spot in someone's room —
// something with real logic (physics, randomness, reacting to more than
// just "is the player nearby"). If your object is just shapes/colors with
// no behavior, you don't need this file — use the in-game [O] Add Object
// overlay's Decorative mode instead (a JSON shape list, approved instantly,
// no code review).
//
// An interactive object is submitted and reviewed on its own — approving it
// never touches or resubmits the room it lives in.
//
// HOW INTERACTIVE OBJECTS WORK:
// Your file exports the hooks below. The engine calls them at the right
// time — you don't control the game loop directly. Unlike a room, your
// object doesn't own the whole scene: it's placed at one (x, y) spot
// alongside everything else already in the room.
//
// The `scene` argument is the same Phaser scene toolbox a room gets:
//   scene.add        — create visual objects (rectangles, text, images)
//   scene.physics    — create physics-enabled objects that can collide
//   scene.tweens     — animate objects smoothly
//   scene.time       — set up timers and delayed events
//
// The `ctx` argument is YOUR object's own private state bucket — the same
// object reference every time, across onCreate/onUpdate/onInteract/onRemove.
// It arrives pre-filled with:
//   ctx.x, ctx.y   — where your object was placed in the room
//   ctx.id         — your object's unique id
// Stash anything you create onto it (e.g. ctx.sprite = scene.add.circle(...))
// so later hooks can read it back — this is the object-level equivalent of
// a room's scene.roomData.
//
// RULES — read carefully:
//   ✅ DO: Build your object inside onCreate, at ctx.x/ctx.y
//   ✅ DO: Store references on `ctx` so onUpdate/onInteract/onRemove can use them
//   ❌ DON'T: import any outside libraries or use require()
//   ❌ DON'T: Use fetch(), XMLHttpRequest, or access the network
//   ❌ DON'T: Use document, localStorage, or any browser API outside of scene
//   ❌ DON'T: Modify the room, other objects, or the WorldScene
//
// WHAT THIS MILESTONE DOESN'T SUPPORT YET:
//   Interactive objects can't be dragged/repositioned by their owner and
//   can't carry a linked-artifact URL — both decorative-object features.
//   Deletion works normally ([X] near your object).

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: onLoad(scene)
// Called once, before your object is placed, the same way a room's onLoad
// works. Use it to load any images/audio your object needs. Leave empty if
// you only use shapes and text.
// ─────────────────────────────────────────────────────────────────────────────
export function onLoad(scene) {
  // Load your assets here. Leave empty if you only use shapes and text.
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: onCreate(scene, ctx)
// Called once when your object is placed into the room. Build your object
// here, positioned at ctx.x/ctx.y.
//
// Example:
//   ctx.sprite = scene.add.circle(ctx.x, ctx.y, 20, 0xf4a261);
// ─────────────────────────────────────────────────────────────────────────────
export function onCreate(scene, ctx) {
  // Build your object here, at ctx.x / ctx.y.
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: onUpdate(scene, ctx)
// Called every frame (~60 times per second) while the room is open. Keep
// this lean — heavy work here will slow the game down.
//
// Example:
//   if (ctx.sprite) ctx.sprite.rotation += 0.01;
// ─────────────────────────────────────────────────────────────────────────────
export function onUpdate(scene, ctx) {
  // Per-frame logic goes here. Leave empty if your object has no animation.
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: onInteract(scene, ctx)
// Called when a nearby player presses [E]. This is your object's one
// required behavior — make it do SOMETHING (change color, pop up text,
// play an animation, etc).
//
// Example:
//   if (ctx.sprite) ctx.sprite.fillColor = Phaser.Display.Color.RandomRGB().color;
// ─────────────────────────────────────────────────────────────────────────────
export function onInteract(scene, ctx) {
  // What happens when a player interacts with your object.
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL HOOK: onRemove(scene, ctx)
// Only needed if onCreate made extra scene objects beyond what's on `ctx`.
// Called once, right before your object is deleted, so you can clean up.
// Most objects don't need this — omit it entirely if you have nothing to do.
//
// Example:
//   export function onRemove(scene, ctx) {
//     ctx.sprite?.destroy();
//   }
// ─────────────────────────────────────────────────────────────────────────────
