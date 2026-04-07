// example-room.js — A fully working example room using the template hooks.
//
// This file demonstrates what a complete player room looks like.
// Visual style: a deep-space observatory with a spinning star and an exit portal.
// Every line is commented to show exactly what each part does.

// ─────────────────────────────────────────────────────────────────────────────
// name — shown above the door in the town square
// ─────────────────────────────────────────────────────────────────────────────
export const name = 'Observatory';

// ─────────────────────────────────────────────────────────────────────────────
// onLoad(scene) — runs during Phaser's preload phase, before the room appears.
// Use this to load images or audio. This room uses only shapes and text,
// so onLoad is intentionally left empty.
// ─────────────────────────────────────────────────────────────────────────────
export function onLoad(scene) {
  // No external assets needed — everything is drawn with shapes and text.
}

// ─────────────────────────────────────────────────────────────────────────────
// onCreate(scene) — runs once when the player enters the room.
// Build everything here: floor, decorations, text, the exit trigger.
// ─────────────────────────────────────────────────────────────────────────────
export function onCreate(scene) {
  // scene.roomData is the safe place to store state between frames.
  // Anything you need in onUpdate must go here.
  scene.roomData = {};

  // --- Floor ---
  // A dark navy rectangle covering the whole room canvas (800×600).
  scene.add.rectangle(400, 300, 800, 600, 0x0a0a2e);

  // --- Stars (decorative, static) ---
  // Scatter small white dots across the background to look like space.
  for (let i = 0; i < 60; i++) {
    const x = Phaser.Math.Between(20, 780);  // random x within room bounds
    const y = Phaser.Math.Between(20, 580);  // random y within room bounds
    const size = Phaser.Math.Between(1, 3);  // stars are 1–3px wide
    scene.add.rectangle(x, y, size, size, 0xffffff);
  }

  // --- Title text ---
  // scene.add.text(x, y, string, style) — places text at the given position.
  // .setOrigin(0.5) centers the text on its x/y point.
  scene.add.text(400, 60, '✦ Observatory ✦', {
    fontSize: '28px',
    fill: '#c8b8ff',   // soft purple
    fontFamily: 'monospace',
  }).setOrigin(0.5);

  scene.add.text(400, 100, 'Gaze into the cosmos', {
    fontSize: '14px',
    fill: '#7a6aaa',
    fontFamily: 'monospace',
  }).setOrigin(0.5);

  // --- Central spinning star ---
  // A yellow star shape created as a rectangle (close enough for a prototype).
  // We store it in scene.roomData so onUpdate can rotate it each frame.
  scene.roomData.star = scene.add.star(400, 280, 6, 18, 40, 0xffe066);
  // scene.add.star(x, y, points, innerRadius, outerRadius, fillColor)

  // --- Orbit ring ---
  // A circle outline drawn around the star to show its orbit path.
  const ring = scene.add.circle(400, 280, 70, 0x000000, 0); // transparent fill
  ring.setStrokeStyle(1, 0x5555aa, 0.6); // thin dark-blue stroke, 60% opacity
  scene.roomData.ring = ring;

  // --- Orbiting dot ---
  // A small white dot that travels around the ring using a tween.
  scene.roomData.dot = scene.add.circle(470, 280, 5, 0xaaddff);

  // Tween: smoothly animate the dot in a circular orbit.
  // We use scene.tweens.add() with onUpdate to reposition the dot each frame.
  scene.roomData.orbitAngle = 0; // track the orbit angle ourselves in onUpdate

  // --- Instruction text ---
  scene.add.text(400, 480, 'Walk into the portal to leave', {
    fontSize: '13px',
    fill: '#554477',
    fontFamily: 'monospace',
  }).setOrigin(0.5);

  // --- Exit portal ---
  // A glowing magenta circle at the bottom of the room.
  // We use scene.physics.add.staticImage workaround — but since we don't load
  // images, we use an overlap check with a zone instead.
  // The portal is a visible circle (display only), plus an invisible Zone for overlap.
  scene.add.circle(400, 545, 28, 0xcc44ff, 0.85); // visible glow
  scene.add.circle(400, 545, 22, 0xff88ff, 0.5);  // inner lighter glow

  scene.add.text(400, 545, 'EXIT', {
    fontSize: '11px',
    fill: '#ffffff',
    fontFamily: 'monospace',
  }).setOrigin(0.5);

  // The overlap zone: a physics-enabled static zone the player walks into.
  // scene.physics.add.staticGroup() gives us a static body we can overlap-test.
  const exitZone = scene.add.zone(400, 545, 56, 56); // x, y, width, height
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;

  // --- Player reference ---
  // The engine exposes the local player sprite as scene.player.
  // We store a reference so onUpdate can check for overlap with the exit zone.
  scene.roomData.player = scene.player; // set by RoomScene before onCreate runs
}

// ─────────────────────────────────────────────────────────────────────────────
// onUpdate(scene) — runs every frame (~60 fps).
// Keep this lean. Only update things that change each frame.
// ─────────────────────────────────────────────────────────────────────────────
export function onUpdate(scene) {
  const data = scene.roomData;

  // Spin the central star a little each frame.
  if (data.star) {
    data.star.angle += 0.4; // degrees per frame
  }

  // Advance the orbiting dot around its circle.
  if (data.dot) {
    data.orbitAngle += 0.02; // radians per frame (slow orbit)
    const radius = 70;
    data.dot.x = 400 + Math.cos(data.orbitAngle) * radius;
    data.dot.y = 280 + Math.sin(data.orbitAngle) * radius;
  }

  // Check if the player is overlapping the exit zone.
  // If yes, call scene.exitRoom() to return them to the town square.
  if (data.player && data.exitZone) {
    const overlap = Phaser.Geom.Intersects.RectangleToRectangle(
      data.player.getBounds(),
      data.exitZone.getBounds()
    );
    if (overlap) {
      scene.exitRoom(); // hands control back to the engine
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// onExit(scene) — runs once when the player leaves the room.
// Clean up anything that would otherwise persist or leak.
// ─────────────────────────────────────────────────────────────────────────────
export function onExit(scene) {
  // All objects created with scene.add.* are destroyed automatically when the
  // RoomScene shuts down, so explicit cleanup is only needed for timers/tweens.
  if (scene.roomData && scene.roomData.orbitTween) {
    scene.roomData.orbitTween.remove();
  }
  // Clear roomData to release references.
  scene.roomData = null;
}
