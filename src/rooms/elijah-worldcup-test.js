export const name = 'Komorebi Coffee Roasters';

export const gameAnchorX = 1365;
export const gameAnchorY = 520;

export function onLoad(scene) {
  // Procedural assets drawn using Phaser Graphics API
}

export function onCreate(scene) {
  scene.roomData = {};

  scene.physics.world.setBounds(0, 0, 1600, 1200);

  // ── 1. SKY & HORIZON (y: 0–300) ─────────────────────────────────
  const skyGfx = scene.add.graphics();
  skyGfx.fillStyle(0xdbeafe, 1);
  skyGfx.fillRect(0, 0, 1600, 220);
  skyGfx.fillStyle(0xfef3c7, 0.7);
  skyGfx.fillRect(0, 180, 1600, 120);

  // Distant Japanese Mountain Silhouettes
  skyGfx.fillStyle(0x788c83, 0.65);
  skyGfx.fillPoints([
    { x: 0, y: 300 },
    { x: 180, y: 190 },
    { x: 380, y: 260 },
    { x: 620, y: 170 },
    { x: 880, y: 250 },
    { x: 1150, y: 160 },
    { x: 1420, y: 240 },
    { x: 1600, y: 210 },
    { x: 1600, y: 300 }
  ], true);

  skyGfx.fillStyle(0x4d6158, 0.85);
  skyGfx.fillPoints([
    { x: 0, y: 300 },
    { x: 260, y: 220 },
    { x: 500, y: 280 },
    { x: 780, y: 210 },
    { x: 1050, y: 270 },
    { x: 1380, y: 200 },
    { x: 1600, y: 260 },
    { x: 1600, y: 300 }
  ], true);

  const gardenGfx = scene.add.graphics();
  gardenGfx.fillStyle(0x3f6212, 0.9);
  for (let x = 60; x < 1550; x += 140) {
    gardenGfx.fillRect(x, 140, 12, 160);
    gardenGfx.fillRect(x + 25, 120, 8, 180);
  }
  gardenGfx.fillStyle(0x65a30d, 0.8);
  for (let x = 40; x < 1580; x += 130) {
    gardenGfx.fillCircle(x + 10, 140, 32);
    gardenGfx.fillCircle(x + 35, 120, 26);
  }

  // ── 2. INDOOR OAK FLOOR & WALLS (y: 300–1200) ────────────────────
  const floorGfx = scene.add.graphics();
  floorGfx.fillStyle(0xfef3c7, 0.38);
  floorGfx.fillRect(0, 300, 1600, 900);

  floorGfx.lineStyle(1, 0xd97706, 0.18);
  for (let y = 300; y < 1200; y += 32) {
    floorGfx.beginPath();
    floorGfx.moveTo(0, y);
    floorGfx.lineTo(1600, y);
    floorGfx.strokePath();
  }
  for (let x = 0; x < 1600; x += 120) {
    for (let y = 300; y < 1200; y += 64) {
      const shiftX = ((y / 32) % 2 === 0) ? 0 : 60;
      floorGfx.beginPath();
      floorGfx.moveTo(x + shiftX, y);
      floorGfx.lineTo(x + shiftX, y + 32);
      floorGfx.strokePath();
    }
  }

  const wallGfx = scene.add.graphics();
  wallGfx.fillStyle(0x334155, 0.9);
  wallGfx.fillRect(0, 280, 1600, 20);
  for (let x = 0; x <= 1600; x += 200) {
    wallGfx.fillRect(x, 0, 16, 300);
  }

  // ── 3. ELEVATED TATAMI NOOK ────────────────────────────────────
  const tatamiGfx = scene.add.graphics();
  tatamiGfx.fillStyle(0xb45309, 0.85);
  tatamiGfx.fillRect(70, 640, 400, 420);
  tatamiGfx.fillStyle(0xfffbe1, 0.92);
  tatamiGfx.fillRect(80, 650, 380, 400);

  tatamiGfx.lineStyle(4, 0x166534, 0.8);
  tatamiGfx.strokeRect(80, 650, 190, 200);
  tatamiGfx.strokeRect(270, 650, 190, 200);
  tatamiGfx.strokeRect(80, 850, 190, 200);
  tatamiGfx.strokeRect(270, 850, 190, 200);

  tatamiGfx.fillStyle(0x78350f, 0.9);
  tatamiGfx.fillCircle(175, 750, 45);
  tatamiGfx.fillCircle(365, 950, 45);

  tatamiGfx.fillStyle(0x1e3a8a, 0.8);
  tatamiGfx.fillRect(145, 680, 60, 20);
  tatamiGfx.fillRect(145, 800, 60, 20);
  tatamiGfx.fillRect(335, 880, 60, 20);
  tatamiGfx.fillRect(335, 1000, 60, 20);

  // ── 4. ESPRESSO & POUR-OVER BAR ─────────────────────────────────
  const barGfx = scene.add.graphics();
  barGfx.fillStyle(0xb45309, 1);
  barGfx.fillRect(550, 440, 650, 80);
  barGfx.fillStyle(0xfde68a, 0.75);
  for (let px = 560; px < 1190; px += 16) {
    barGfx.fillRect(px, 442, 8, 76);
  }
  barGfx.fillStyle(0xffffff, 0.95);
  barGfx.fillRect(540, 410, 670, 30);
  barGfx.fillStyle(0xf3f4f6, 0.8);
  barGfx.fillRect(540, 405, 670, 5);

  const espressoGfx = scene.add.graphics();
  espressoGfx.fillStyle(0x334155, 1);
  espressoGfx.fillRect(620, 360, 110, 45);
  espressoGfx.fillStyle(0xef4444, 1);
  espressoGfx.fillRect(615, 360, 8, 45);
  espressoGfx.fillRect(727, 360, 8, 45);
  espressoGfx.fillStyle(0x94a3b8, 1);
  espressoGfx.fillRect(640, 400, 15, 12);
  espressoGfx.fillRect(670, 400, 15, 12);
  espressoGfx.fillRect(700, 400, 15, 12);

  espressoGfx.fillStyle(0x0f172a, 1);
  espressoGfx.fillRect(750, 350, 35, 55);
  espressoGfx.fillStyle(0xf59e0b, 0.7);
  espressoGfx.fillTriangle(750, 350, 785, 350, 767, 330);

  espressoGfx.fillStyle(0x93c5fd, 0.35);
  espressoGfx.fillRect(820, 360, 110, 45);
  espressoGfx.lineStyle(2, 0xe2e8f0, 0.8);
  espressoGfx.strokeRect(820, 360, 110, 45);
  espressoGfx.fillStyle(0x65a30d, 0.9);
  espressoGfx.fillCircle(850, 390, 10);
  espressoGfx.fillCircle(875, 390, 10);
  espressoGfx.fillStyle(0xfbcfe8, 0.9);
  espressoGfx.fillCircle(905, 390, 8);

  // ── 5. GAME ANCHOR: SPECIALTY POUR-OVER STATION ──────────────────
  const anchorGfx = scene.add.graphics();
  anchorGfx.fillStyle(0xb45309, 1);
  anchorGfx.fillRect(1280, 520, 180, 60);
  anchorGfx.fillStyle(0xfef3c7, 1);
  anchorGfx.fillRect(1270, 500, 200, 20);

  anchorGfx.fillStyle(0xd97706, 1);
  anchorGfx.fillRect(1310, 470, 120, 30);
  anchorGfx.fillStyle(0x38bdf8, 0.9);
  anchorGfx.fillTriangle(1330, 460, 1360, 460, 1345, 480);
  anchorGfx.fillStyle(0xf43f5e, 0.9);
  anchorGfx.fillTriangle(1390, 460, 1420, 460, 1405, 480);

  const anchorPulse = scene.add.circle(1365, 510, 35, 0xf59e0b, 0.25);
  anchorPulse.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: anchorPulse,
    scaleX: 1.4,
    scaleY: 1.4,
    alpha: 0.05,
    duration: 1200,
    yoyo: true,
    repeat: -1
  });

  // ── 6. DINING TABLES & DECORATION ───────────────────────────────
  const diningGfx = scene.add.graphics();
  
  // Large rectangular communal tables (Light Blond Oak)
  const longTables = [
    { x: 550, y: 680, width: 310, height: 75 },
    { x: 930, y: 680, width: 310, height: 75 },
    { x: 600, y: 940, width: 440, height: 85 }
  ];

  longTables.forEach(t => {
    // Oblique Front Face / Depth shadow under table
    diningGfx.fillStyle(0x92400e, 0.85);
    diningGfx.fillRect(t.x, t.y + t.height - 12, t.width, 24);

    // Outer Table Frame
    diningGfx.fillStyle(0xd97706, 0.95);
    diningGfx.fillRect(t.x, t.y, t.width, t.height);

    // Inner Light Blond Oak Tabletop Slab
    diningGfx.fillStyle(0xfde68a, 0.95);
    diningGfx.fillRect(t.x + 4, t.y + 4, t.width - 8, t.height - 12);

    // Spaced chairs along the top and bottom of each table
    const topChairCount = Math.floor(t.width / 55);
    const spacingX = t.width / (topChairCount + 1);
    for (let i = 1; i <= topChairCount; i++) {
      const cx = t.x + spacingX * i;

      // Top chair backrest & light seat
      diningGfx.fillStyle(0xb45309, 1);
      diningGfx.fillRect(cx - 16, t.y - 20, 32, 14);
      diningGfx.fillStyle(0xf59e0b, 0.9);
      diningGfx.fillRect(cx - 14, t.y - 16, 28, 8);

      // Bottom chair backrest & light seat
      diningGfx.fillStyle(0xb45309, 1);
      diningGfx.fillRect(cx - 16, t.y + t.height + 10, 32, 14);
      diningGfx.fillStyle(0xf59e0b, 0.9);
      diningGfx.fillRect(cx - 14, t.y + t.height + 6, 28, 8);
    }

    // Tabletop decorative coffee cups & carafes
    diningGfx.fillStyle(0x0284c7, 0.8);
    diningGfx.fillCircle(t.x + 45, t.y + 25, 6);
    diningGfx.fillStyle(0xffffff, 0.9);
    diningGfx.fillCircle(t.x + t.width - 55, t.y + 30, 7);
    diningGfx.fillStyle(0x475569, 0.6);
    diningGfx.fillRect(t.x + t.width / 2 - 12, t.y + 20, 24, 18);
  });

  const plantPositions = [
    { x: 500, y: 420 },
    { x: 1230, y: 420 },
    { x: 490, y: 660 },
    { x: 1530, y: 900 }
  ];
  plantPositions.forEach(p => {
    diningGfx.fillStyle(0xe2e8f0, 1);
    diningGfx.fillRect(p.x - 18, p.y - 10, 36, 30);
    diningGfx.fillStyle(0x15803d, 0.95);
    diningGfx.fillCircle(p.x - 10, p.y - 25, 20);
    diningGfx.fillCircle(p.x + 10, p.y - 25, 22);
    diningGfx.fillCircle(p.x, p.y - 40, 24);
  });

  // ── 7. ANIMATED FOCAL POINTS (SUNLIGHT BEAMS & STEAM) ───────────
  const sunBeamGfx = scene.add.graphics();
  sunBeamGfx.setBlendMode(Phaser.BlendModes.ADD);
  sunBeamGfx.fillStyle(0xfef08a, 0.12);

  sunBeamGfx.fillPoints([
    { x: 100, y: 280 }, { x: 320, y: 280 },
    { x: 620, y: 1150 }, { x: 300, y: 1150 }
  ], true);

  sunBeamGfx.fillPoints([
    { x: 600, y: 280 }, { x: 880, y: 280 },
    { x: 1280, y: 1150 }, { x: 900, y: 1150 }
  ], true);

  scene.tweens.add({
    targets: sunBeamGfx,
    alpha: 0.6,
    duration: 3000,
    yoyo: true,
    repeat: -1
  });

  for (let i = 0; i < 18; i++) {
    const steam = scene.add.circle(
      Phaser.Math.Between(640, 710),
      360,
      Phaser.Math.Between(3, 7),
      0xffffff,
      0.4
    );
    steam.setBlendMode(Phaser.BlendModes.ADD);
    steam.setDepth(1200);

    scene.tweens.add({
      targets: steam,
      y: '-=60',
      x: '+=15',
      alpha: 0,
      scale: 2.2,
      duration: Phaser.Math.Between(1500, 2800),
      repeat: -1,
      delay: Phaser.Math.Between(0, 2000)
    });
  }

  for (let i = 0; i < 14; i++) {
    const petal = scene.add.ellipse(
      Phaser.Math.Between(50, 1550),
      Phaser.Math.Between(100, 300),
      8, 4, 0xfbcfe8, 0.7
    );
    petal.setDepth(1300);

    scene.tweens.add({
      targets: petal,
      x: '+=120',
      y: '+=450',
      rotation: 3.14 * 2,
      alpha: 0.2,
      duration: Phaser.Math.Between(6000, 11000),
      repeat: -1,
      delay: Phaser.Math.Between(0, 5000)
    });
  }

  // ── 8. PLAYER CHARACTER ──────────────────────────────────────────
  const player = scene.add.container(800, 900);

  const shadowGfx = scene.add.graphics();
  shadowGfx.fillStyle(0x0f172a, 0.4);
  shadowGfx.fillCircle(0, 20, 18);
  player.add(shadowGfx);

  const bodyGfx = scene.add.graphics();
  bodyGfx.fillStyle(0x1e293b, 1);
  bodyGfx.fillRect(-14, -20, 28, 32);
  bodyGfx.fillStyle(0xb45309, 1);
  bodyGfx.fillRect(-11, -12, 22, 28);
  player.add(bodyGfx);

  const headGfx = scene.add.graphics();
  headGfx.fillStyle(0xfde047, 0.2);
  headGfx.fillCircle(0, -32, 16);
  headGfx.fillStyle(0xfed7aa, 1);
  headGfx.fillCircle(0, -32, 14);
  headGfx.fillStyle(0x451a03, 1);
  headGfx.fillCircle(0, -38, 14);
  player.add(headGfx);

  scene.physics.world.enable(player);
  player.body.setCollideWorldBounds(true);
  player.body.setSize(36, 36);
  player.body.setOffset(-18, -10);

  scene.player = player;
  scene.cameras.main.startFollow(player, true, 0.1, 0.1);

  if (scene.input && scene.input.keyboard) {
    scene.cursors = scene.input.keyboard.createCursorKeys();
  }

  // ── exit trigger (keep this block exactly as-is) ──────────────────
  scene.add.rectangle(800, 1160, 120, 30, 0x333333);
  scene.add.text(800, 1160, 'EXIT', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
  const exitZone = scene.add.zone(800, 1155, 120, 40);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;
}

export function onUpdate(scene) {
  // ── exit check (keep this block exactly as-is) ────────────────────
  const d = scene.roomData;
  if (d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) scene.exitRoom();
  }

  // ── per-frame animation logic ──────────────────────────────────────
  if (scene.player && scene.cursors) {
    const speed = 220;
    const body = scene.player.body;
    body.setVelocity(0);

    let moving = false;
    if (scene.cursors.left.isDown) {
      body.setVelocityX(-speed);
      moving = true;
    } else if (scene.cursors.right.isDown) {
      body.setVelocityX(speed);
      moving = true;
    }

    if (scene.cursors.up.isDown) {
      body.setVelocityY(-speed);
      moving = true;
    } else if (scene.cursors.down.isDown) {
      body.setVelocityY(speed);
      moving = true;
    }

    body.velocity.normalize().scale(speed);

    if (moving) {
      scene.player.setRotation(Math.sin(scene.time.now * 0.012) * 0.08);
    } else {
      scene.player.setRotation(0);
    }

    scene.player.setDepth(scene.player.y);
  }
}

export function onExit(scene) {
  scene.roomData = null;
}

// ── Uncomment if you built a themed player character above ───────────
export function createOtherPlayer(scene, { x, y }) {
  const container = scene.add.container(x, y);

  const shadowGfx = scene.add.graphics();
  shadowGfx.fillStyle(0x0f172a, 0.4);
  shadowGfx.fillCircle(0, 20, 18);
  container.add(shadowGfx);

  const bodyGfx = scene.add.graphics();
  bodyGfx.fillStyle(0x1e293b, 1);
  bodyGfx.fillRect(-14, -20, 28, 32);
  bodyGfx.fillStyle(0xb45309, 1);
  bodyGfx.fillRect(-11, -12, 22, 28);
  container.add(bodyGfx);

  const headGfx = scene.add.graphics();
  headGfx.fillStyle(0xfde047, 0.2);
  headGfx.fillCircle(0, -32, 16);
  headGfx.fillStyle(0xfed7aa, 1);
  headGfx.fillCircle(0, -32, 14);
  headGfx.fillStyle(0x451a03, 1);
  headGfx.fillCircle(0, -38, 14);
  container.add(headGfx);

  container._labelOffsetY = 52; // pixels from origin to above head
  return container;
}