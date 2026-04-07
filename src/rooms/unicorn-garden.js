// unicorn-garden.js — "Unicorn Garden Bedroom" player room
// Submitted by a player, reviewed and formatted for the game engine.

export const name = 'Unicorn Garden Bedroom';

export function onLoad(scene) {
  // No external assets — all visuals use shapes and text.
}

export function onCreate(scene) {
  scene.roomData = {};

  // Background — soft lavender floor
  scene.add.rectangle(400, 300, 800, 600, 0xfce4ec);

  // Rainbow arch (layered circles, largest to smallest)
  const rainbowColors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
  rainbowColors.forEach((color, i) => {
    scene.add.circle(400, 300, 280 - (i * 15), color);
  });
  // Mask the middle to create an arch effect
  scene.add.circle(400, 300, 175, 0xfce4ec);
  // Cut off the bottom half of the arch
  scene.add.rectangle(400, 450, 800, 300, 0xfce4ec);

  // Garden patches (pink grass)
  scene.add.circle(150, 450, 120, 0xf8bbd0);
  scene.add.circle(650, 450, 120, 0xf8bbd0);

  // Magical cloud bed (top-left)
  scene.add.circle(120, 150, 40, 0xffffff);
  scene.add.circle(160, 150, 50, 0xffffff);
  scene.add.circle(200, 150, 40, 0xffffff);
  scene.add.rectangle(160, 170, 120, 60, 0xffffff);
  scene.add.rectangle(160, 170, 100, 40, 0xe1f5fe);

  // Unicorn statue (top-right)
  scene.add.circle(650, 150, 30, 0xffffff);
  scene.add.circle(680, 130, 20, 0xffffff);
  scene.add.star(685, 110, 3, 5, 15, 0xffeb3b);

  // Scattered flowers across the lower half
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * 800;
    const y = 320 + Math.random() * 230;
    scene.add.circle(x, y, 5, 0xff80ab);
    scene.add.circle(x, y, 2, 0xffff00);
  }

  // Floating stars (twinkling via tweens)
  for (let i = 0; i < 15; i++) {
    const star = scene.add.star(Math.random() * 800, Math.random() * 250, 5, 4, 8, 0xfff59d);
    scene.tweens.add({
      targets: star,
      alpha: 0.2,
      duration: 1000 + Math.random() * 2000,
      yoyo: true,
      repeat: -1,
    });
  }

  // Exit portal visual
  scene.add.rectangle(400, 560, 100, 20, 0xffffff);
  scene.add.text(375, 525, 'EXIT', { fontSize: '20px', fill: '#ff4081', fontStyle: 'bold' });

  // Exit trigger zone — player walks into this to leave
  const exitZone = scene.add.zone(400, 545, 80, 60);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;

  // Room title and instructions
  scene.add.text(20, 20, 'Unicorn Dream Garden', { fontSize: '24px', fill: '#ad1457', fontStyle: 'italic' });
  scene.add.text(20, 50, 'Move with WASD or Arrow Keys', { fontSize: '16px', fill: '#ad1457' });
}

export function onUpdate(scene) {
  const d = scene.roomData;
  if (d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) scene.exitRoom();
  }
}

export function onExit(scene) {
  // Tweens and scene objects are destroyed automatically when the scene shuts down.
  scene.roomData = null;
}
