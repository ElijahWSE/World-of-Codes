// tropical-surf-haven.js — "Tropical Surf Haven" player room
// Submitted by a player, reviewed and formatted for the game engine.
// v2: added volleyball court and beach umbrellas.

export const name = 'Tropical Surf Haven';

export function onLoad(scene) {
  // No external assets required — all visuals use primitive shapes.
}

export function onCreate(scene) {
  scene.roomData = {};
  const d = scene.roomData;

  // Background — deep sea (top half)
  scene.add.rectangle(400, 150, 800, 300, 0x0077be);

  // Shore — sand (bottom half)
  scene.add.rectangle(400, 450, 800, 300, 0xedc9af);

  // Animated waves
  d.waves = [];
  for (let i = 0; i < 3; i++) {
    const wave = scene.add.rectangle(400, 100 + (i * 60), 900, 20, 0xffffff, 0.3);
    scene.tweens.add({
      targets: wave,
      x: { from: 350, to: 450 },
      alpha: { from: 0.1, to: 0.5 },
      duration: 2000 + (i * 500),
      yoyo: true,
      repeat: -1,
    });
    d.waves.push(wave);
  }

  // Surfers (bobbing on the waves)
  d.surfers = [];
  const colors = [0xff0000, 0xffff00, 0x00ff00];
  for (let i = 0; i < 3; i++) {
    const surfboard = scene.add.rectangle(150 + (i * 250), 120 + (i * 30), 60, 20, colors[i]);
    const surfer    = scene.add.circle(150 + (i * 250), 120 + (i * 30), 10, 0xffdbac);
    scene.tweens.add({
      targets: [surfboard, surfer],
      y: '+=20',
      rotation: 0.1,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      delay: i * 300,
    });
    d.surfers.push({ board: surfboard, person: surfer });
  }

  // Volleyball court
  scene.add.rectangle(200, 450, 160, 100, 0xd2b48c); // court (slightly darker sand)
  scene.add.rectangle(200, 450, 160, 2, 0xffffff);   // net
  scene.add.rectangle(120, 450, 4, 20, 0x333333);    // left pole
  scene.add.rectangle(280, 450, 4, 20, 0x333333);    // right pole
  scene.add.circle(180, 430, 8, 0xffffff);            // volleyball

  // Beach umbrellas
  const umbrellaColors = [0xff6b6b, 0x4ecdc4];
  [500, 620].forEach((x, i) => {
    scene.add.rectangle(x, 445, 4, 45, 0x7a5901);    // pole
    scene.add.circle(x, 425, 35, umbrellaColors[i]);  // canopy
    scene.add.circle(x, 405, 5, 0xffffff);            // top cap
  });

  // Island decoration (top-right)
  scene.add.circle(700, 400, 40, 0xc2b280);           // sand mound
  scene.add.rectangle(700, 360, 10, 60, 0x654321);    // palm trunk
  scene.add.star(700, 330, 5, 20, 40, 0x228b22);      // palm leaves

  // Exit sign
  scene.add.rectangle(400, 570, 100, 40, 0x333333);
  scene.add.text(375, 560, 'EXIT', { fontSize: '18px', fill: '#ffffff' });

  // Exit trigger zone
  const exitZone = scene.add.zone(400, 545, 80, 60);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;
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
  scene.roomData = null;
}
