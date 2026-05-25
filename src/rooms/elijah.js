export const name = 'Primary Palette Cafeteria';

export const gameAnchorX = 1430;
export const gameAnchorY = 320;

export function onLoad(scene) {
  // Built strictly with vector drawing primitives. No external asset loads required.
}

export function onCreate(scene) {
  scene.roomData = {};

  const colors = {
    sky: 0x2e86c1,
    skyGlow: 0xd35400,
    mountains: 0x1a252f,
    floor: 0xf2f4f4,
    tileRed: 0xe74c3c,
    tileYellow: 0xf1c40f,
    tileBlue: 0x3498db,
    metalTrim: 0x95a5a6,
    counterBody: 0x34495e,
    wood: 0xaf601a,
    glass: 0xeefcff,
    neonSlushie: 0x9b59b6,
    arcadeBody: 0x1b2631,
    doorBase: 0xe74c3c
  };

  // 1. Horizon & Background Scenery
  const skyGfx = scene.add.graphics();
  skyGfx.setDepth(1);
  skyGfx.fillStyle(colors.sky, 1);
  skyGfx.fillRect(0, 0, 1600, 300);

  skyGfx.fillStyle(colors.skyGlow, 0.35);
  skyGfx.fillRect(0, 180, 1600, 120);

  skyGfx.fillStyle(colors.mountains, 1);
  skyGfx.beginPath();
  skyGfx.moveTo(0, 300);
  skyGfx.lineTo(120, 140);
  skyGfx.lineTo(280, 220);
  skyGfx.lineTo(460, 110);
  skyGfx.lineTo(620, 240);
  skyGfx.lineTo(840, 90);
  skyGfx.lineTo(1050, 210);
  skyGfx.lineTo(1280, 130);
  skyGfx.lineTo(1440, 250);
  skyGfx.lineTo(1600, 300);
  skyGfx.closePath();
  skyGfx.fillPath();

  skyGfx.fillStyle(0xffffff, 0.2);
  skyGfx.fillCircle(300, 100, 70);
  skyGfx.fillCircle(360, 90, 85);
  skyGfx.fillCircle(430, 110, 60);
  skyGfx.fillCircle(1150, 120, 80);
  skyGfx.fillCircle(1230, 110, 90);

  // 2. Canteen Floor Layer
  const floorGfx = scene.add.graphics();
  floorGfx.setDepth(2);
  floorGfx.fillStyle(colors.floor, 1);
  floorGfx.fillRect(0, 300, 1600, 900);

  const gridSpacing = 80;
  for (let x = 0; x < 1600; x += gridSpacing * 3) {
    for (let y = 320; y < 1180; y += gridSpacing * 2) {
      floorGfx.fillStyle(colors.tileRed, 0.4);
      floorGfx.fillRect(x, y, gridSpacing, gridSpacing);
      floorGfx.fillStyle(colors.tileYellow, 0.4);
      floorGfx.fillRect(x + gridSpacing, y, gridSpacing, gridSpacing);
      floorGfx.fillStyle(colors.tileBlue, 0.4);
      floorGfx.fillRect(x + (gridSpacing * 2), y, gridSpacing, gridSpacing);
    }
  }

  floorGfx.lineStyle(8, 0x111111, 1);
  floorGfx.beginPath();
  floorGfx.moveTo(0, 300);
  floorGfx.lineTo(1600, 300);
  floorGfx.strokePath();

  // 3. Front Face Structures (Oblique Tables & Counters)
  const structuresGfx = scene.add.graphics();
  structuresGfx.setDepth(3);

  structuresGfx.fillStyle(colors.counterBody, 1);
  structuresGfx.fillRect(150, 300, 1300, 75);
  
  structuresGfx.fillStyle(colors.metalTrim, 1);
  structuresGfx.fillRect(150, 300, 1300, 12);

  const stallNames = ["YELLOW CHURROS", "RED HOT CHILI", "BLUEBERRY DRINKS", "BURGER BAR", "RAMEN CLUB"];
  const stallColors = [colors.tileYellow, colors.tileRed, colors.tileBlue, colors.tileYellow, colors.tileRed];
  for (let i = 0; i < 5; i++) {
    let sX = 180 + (i * 260);
    structuresGfx.fillStyle(0x1a252f, 1);
    structuresGfx.fillRect(sX, 318, 220, 45);
    structuresGfx.fillStyle(stallColors[i], 1);
    structuresGfx.fillRect(sX + 5, 323, 8, 35);
    scene.add.text(sX + 22, 332, stallNames[i], {
      font: "bold 13px Courier New",
      fill: "#ffffff"
    }).setDepth(4);
  }

  const tableRowsY = [460, 680, 900];
  const tableColsX = [120, 620, 1120];
  tableRowsY.forEach((ty, rowIndex) => {
    tableColsX.forEach((tx, colIndex) => {
      structuresGfx.fillStyle(colors.wood, 1);
      structuresGfx.fillRect(tx, ty, 360, 25);
      structuresGfx.fillStyle(0x874a12, 1);
      structuresGfx.fillRect(tx, ty + 25, 360, 20);

      structuresGfx.fillStyle(0x111111, 1);
      structuresGfx.fillRect(tx + 20, ty + 45, 12, 30);
      structuresGfx.fillRect(tx + 174, ty + 45, 12, 30);
      structuresGfx.fillRect(tx + 328, ty + 45, 12, 30);

      const trayColors = [colors.tileRed, colors.tileYellow, colors.tileBlue];
      structuresGfx.fillStyle(trayColors[rowIndex % 3], 1);
      structuresGfx.fillRect(tx + 40, ty + 4, 50, 16);
      structuresGfx.fillStyle(trayColors[(rowIndex + 1) % 3], 1);
      structuresGfx.fillRect(tx + 155, ty + 4, 50, 16);
      structuresGfx.fillStyle(trayColors[(rowIndex + 2) % 3], 1);
      structuresGfx.fillRect(tx + 270, ty + 4, 50, 16);

      structuresGfx.fillStyle(0xffffff, 1);
      structuresGfx.fillCircle(tx + 55, ty + 12, 5);
      structuresGfx.fillCircle(tx + 170, ty + 12, 5);
      structuresGfx.fillCircle(tx + 285, ty + 12, 5);
    });
  });

  // 4. Animated Slushie Fountain
  const centerVatX = 800;
  const centerVatY = 270;

  structuresGfx.fillStyle(0x2c3e50, 1);
  structuresGfx.fillRect(centerVatX - 70, centerVatY, 140, 95);
  structuresGfx.fillStyle(colors.tileBlue, 1);
  structuresGfx.fillRect(centerVatX - 70, centerVatY + 45, 140, 14);
  structuresGfx.fillStyle(colors.tileRed, 1);
  structuresGfx.fillCircle(centerVatX - 45, centerVatY + 25, 7);
  structuresGfx.fillStyle(colors.tileYellow, 1);
  structuresGfx.fillCircle(centerVatX - 20, centerVatY + 25, 7);

  structuresGfx.fillStyle(colors.glass, 0.5);
  structuresGfx.fillRect(centerVatX - 55, centerVatY - 120, 110, 120);
  structuresGfx.fillStyle(colors.neonSlushie, 0.85);
  structuresGfx.fillRect(centerVatX - 50, centerVatY - 95, 100, 95);

  const slushieGlow = scene.add.graphics();
  slushieGlow.setDepth(5);
  slushieGlow.setBlendMode(Phaser.BlendModes.ADD);
  slushieGlow.fillStyle(colors.neonSlushie, 0.25);
  slushieGlow.fillCircle(centerVatX, centerVatY - 45, 75);

  scene.roomData.bubbles = [];
  for (let i = 0; i < 15; i++) {
    let randX = Phaser.Math.Between(centerVatX - 45, centerVatX + 45);
    let randY = Phaser.Math.Between(centerVatY - 90, centerVatY - 10);
    let bubbleSize = Phaser.Math.Between(3, 8);
    
    let bubbleObj = scene.add.circle(randX, randY, bubbleSize, 0xffffff);
    bubbleObj.setDepth(6);
    bubbleObj.setAlpha(Phaser.Math.FloatBetween(0.3, 0.95));

    scene.tweens.add({
      targets: bubbleObj,
      y: centerVatY - 92,
      alpha: { from: 0.8, to: 0.1 },
      duration: Phaser.Math.Between(1000, 2200),
      repeat: -1,
      onRepeat: () => {
        bubbleObj.y = centerVatY - 10;
        bubbleObj.x = Phaser.Math.Between(centerVatX - 45, centerVatX + 45);
      }
    });
    scene.roomData.bubbles.push(bubbleObj);
  }

  scene.add.text(centerVatX - 60, centerVatY - 145, "THE SLUSH-O-MATIC", {
    font: "bold 11px Courier New",
    fill: "#f1c40f",
    backgroundColor: "#111111",
    padding: { x: 6, y: 3 }
  }).setDepth(5);

  // 5. Arcade Console Game Anchor
  structuresGfx.fillStyle(colors.arcadeBody, 1);
  structuresGfx.fillRect(gameAnchorX, gameAnchorY - 70, 90, 140);
  structuresGfx.fillStyle(colors.tileRed, 1);
  structuresGfx.fillRect(gameAnchorX, gameAnchorY - 70, 6, 140);
  structuresGfx.fillRect(gameAnchorX + 84, gameAnchorY - 70, 6, 140);
  structuresGfx.fillStyle(colors.tileYellow, 1);
  structuresGfx.fillRect(gameAnchorX, gameAnchorY - 70, 90, 22);

  scene.add.text(gameAnchorX + 11, gameAnchorY - 66, "SNACK ATTACK", {
    font: "black 9px sans-serif",
    fill: "#111111"
  }).setDepth(5);

  structuresGfx.fillStyle(0x0a1118, 1);
  structuresGfx.fillRect(gameAnchorX + 10, gameAnchorY - 40, 70, 50);

  const monitorGlow = scene.add.graphics();
  monitorGlow.setDepth(4);
  monitorGlow.setBlendMode(Phaser.BlendModes.ADD);
  monitorGlow.fillStyle(colors.tileBlue, 0.4);
  monitorGlow.fillRect(gameAnchorX + 10, gameAnchorY - 40, 70, 50);

  scene.tweens.add({
    targets: monitorGlow,
    alpha: 0.05,
    duration: 600,
    yoyo: true,
    repeat: -1
  });

  structuresGfx.fillStyle(colors.tileYellow, 1);
  structuresGfx.fillRect(gameAnchorX + 10, gameAnchorY + 10, 70, 12);
  structuresGfx.fillStyle(colors.tileRed, 1);
  structuresGfx.fillCircle(gameAnchorX + 35, gameAnchorY + 16, 4);

  scene.add.text(gameAnchorX + 8, gameAnchorY + 80, "[SPACE] TO PLAY", {
    font: "bold 9px Arial",
    fill: "#f1c40f"
  }).setDepth(4);

  // 6. Player Configuration
  const player = scene.add.container(800, 750);
  player.setSize(44, 76);
  
  const torso = scene.add.rectangle(0, 12, 36, 46, colors.tileBlue);
  torso.setStrokeStyle(2.5, 0x111111);
  const bagpack = scene.add.rectangle(-15, 18, 8, 32, colors.tileRed);
  bagpack.setStrokeStyle(2, 0x111111);
  const tie = scene.add.rectangle(0, 5, 6, 20, colors.tileYellow);
  const head = scene.add.circle(0, -22, 16, 0xfcd0a1);
  head.setStrokeStyle(2.5, 0x111111);
  const capHat = scene.add.rectangle(0, -34, 28, 10, colors.tileYellow);
  const capBrim = scene.add.rectangle(12, -31, 14, 4, colors.tileYellow);

  player.add([bagpack, torso, tie, head, capHat, capBrim]);
  scene.physics.world.enable(player);
  player.body.setCollideWorldBounds(true);
  
  player.setDepth(10); // Bring the student player on top of the floor and tables
  
  scene.player = player;
  scene.cameras.main.startFollow(player, true, 0.1, 0.1);

  // Decorative labels
  scene.add.text(710, 390, "★ CANTEEN SQUARE ★", {
    font: "900 16px Inter, sans-serif",
    fill: "#ffffff",
    backgroundColor: "#e74c3c",
    padding: { x: 12, y: 6 }
  }).setDepth(4);

  // 7. Visual Exit Guides & Warning Striping
  const exitGuides = scene.add.graphics();
  exitGuides.setDepth(3);

  // High contrast hazard lines leading to the door threshold
  const stripeY = 1130;
  const stripeWidth = 220;
  exitGuides.fillStyle(0xf1c40f, 1); // Bright yellow baseline
  exitGuides.fillRect(800 - stripeWidth / 2, stripeY, stripeWidth, 16);

  exitGuides.fillStyle(0x111111, 1); // Dark diagonal stripes
  for (let sx = 800 - stripeWidth / 2 + 5; sx < 800 + stripeWidth / 2; sx += 24) {
    exitGuides.beginPath();
    exitGuides.moveTo(sx, stripeY);
    exitGuides.lineTo(sx + 10, stripeY);
    exitGuides.lineTo(sx, stripeY + 16);
    exitGuides.lineTo(sx - 10, stripeY + 16);
    exitGuides.closePath();
    exitGuides.fillPath();
  }

  // Neon indicators pointing to exit
  const neonArrows = scene.add.graphics();
  neonArrows.setDepth(4);
  neonArrows.setBlendMode(Phaser.BlendModes.ADD);
  neonArrows.fillStyle(0xe74c3c, 0.6); // Red high visibility pulse
  for (let ax = 715; ax <= 885; ax += 85) {
    neonArrows.fillTriangle(ax, 1105, ax + 12, 1092, ax - 12, 1092);
    neonArrows.fillTriangle(ax, 1122, ax + 12, 1109, ax - 12, 1109);
  }

  scene.tweens.add({
    targets: neonArrows,
    alpha: 0.15,
    duration: 550,
    yoyo: true,
    repeat: -1
  });

  // Large overhead direction label
  scene.add.text(800, 1060, "▼ OUT TO CAMPUS COURT ▼", {
    font: "900 16px Inter, sans-serif",
    fill: "#ffffff",
    backgroundColor: "#e74c3c",
    padding: { x: 16, y: 6 }
  }).setOrigin(0.5).setDepth(4);

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

  // ── per-frame animation/movement logic ───────────────────────────
  const cursors = scene.input.keyboard.createCursorKeys();
  if (d.player && d.player.body) {
    d.player.body.setVelocity(0);

    const baseSpeed = 240;
    const sprintMultiplier = cursors.shift.isDown ? 1.75 : 1.0;
    const finalSpeed = baseSpeed * sprintMultiplier;

    if (cursors.left.isDown) {
      d.player.body.setVelocityX(-finalSpeed);
    } else if (cursors.right.isDown) {
      d.player.body.setVelocityX(finalSpeed);
    }

    if (cursors.up.isDown) {
      if (d.player.y > 340) {
        d.player.body.setVelocityY(-finalSpeed);
      }
    } else if (cursors.down.isDown) {
      if (d.player.y < 1180) {
        d.player.body.setVelocityY(finalSpeed);
      }
    }
  }
}

export function onExit(scene) {
  if (scene.roomData && scene.roomData.bubbles) {
    scene.roomData.bubbles.forEach(b => b.destroy());
  }
  scene.roomData = null;
}

// ── Uncomment if you built a themed player character above ───────────
export function createOtherPlayer(scene, { x, y }) {
  const container = scene.add.container(x, y);
  
  const colors = {
    tileRed: 0xe74c3c,
    tileYellow: 0xf1c40f,
    tileBlue: 0x3498db
  };

  const torso = scene.add.rectangle(0, 12, 36, 46, colors.tileBlue);
  torso.setStrokeStyle(2.5, 0x111111);
  const bagpack = scene.add.rectangle(-15, 18, 8, 32, colors.tileRed);
  bagpack.setStrokeStyle(2, 0x111111);
  const tie = scene.add.rectangle(0, 5, 6, 20, colors.tileYellow);
  const head = scene.add.circle(0, -22, 16, 0xfcd0a1);
  head.setStrokeStyle(2.5, 0x111111);
  const capHat = scene.add.rectangle(0, -34, 28, 10, colors.tileYellow);
  const capBrim = scene.add.rectangle(12, -31, 14, 4, colors.tileYellow);

  container.add([bagpack, torso, tie, head, capHat, capBrim]);
  container._labelOffsetY = 44; // pixels from origin to above head
  return container;
}