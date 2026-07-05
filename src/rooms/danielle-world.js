export const name = 'The Hunny Woodlands';

export const gameAnchorX = 800;
export const gameAnchorY = 750;

export function onLoad(scene) {
  // Procedural graphics are generated dynamically, so no asset loading is required.
}

export function onCreate(scene) {
  scene.roomData = {};

  // Enable physics world bounds for the large 1600x1200 world
  scene.physics.world.setBounds(0, 0, 1600, 1200);

  // --- BACKGROUND LAYERS (y: 0–300) ---
  // Sky base gradient
  const bgGfx = scene.add.graphics();
  bgGfx.setScrollFactor(0); // Sky stays fixed relative to camera for scale depth!
  
  // Draw warm peach-yellow sky gradient
  for (let i = 0; i < 300; i += 4) {
    const ratio = i / 300;
    const r = Math.floor(0xff * (1 - ratio) + 0xff * ratio);
    const g = Math.floor(0x9e * (1 - ratio) + 0xeb * ratio);
    const b = Math.floor(0x22 * (1 - ratio) + 0x60 * ratio);
    const color = (r << 16) + (g << 8) + b;
    bgGfx.fillStyle(color, 1.0);
    bgGfx.fillRect(0, i, 800, 4);
  }

  // Sun
  bgGfx.fillStyle(0xfffcd3, 0.9);
  bgGfx.fillCircle(150, 120, 45);
  bgGfx.fillStyle(0xffe28a, 0.4);
  bgGfx.fillCircle(150, 120, 65);

  // Distant silhouette mountains along the horizon (y: 190 to 300)
  const mountainGfx = scene.add.graphics();
  mountainGfx.setScrollFactor(0.15);
  mountainGfx.fillStyle(0xd97706, 0.55); // Warm rust mountains
  
  // Hill 1
  mountainGfx.beginPath();
  mountainGfx.moveTo(-100, 300);
  mountainGfx.lineTo(200, 160);
  mountainGfx.lineTo(500, 300);
  mountainGfx.closePath();
  mountainGfx.fillPath();

  // Hill 2
  mountainGfx.fillStyle(0xb45309, 0.7);
  mountainGfx.beginPath();
  mountainGfx.moveTo(300, 300);
  mountainGfx.lineTo(600, 140);
  mountainGfx.lineTo(1000, 300);
  mountainGfx.closePath();
  mountainGfx.fillPath();

  // Hill 3
  mountainGfx.fillStyle(0x78350f, 0.85);
  mountainGfx.beginPath();
  mountainGfx.moveTo(800, 300);
  mountainGfx.lineTo(1200, 120);
  mountainGfx.lineTo(1700, 300);
  mountainGfx.closePath();
  mountainGfx.fillPath();

  // --- GROUND FOREGROUND LAYER (y: 300–1200) ---
  // Grass floor
  const floorGfx = scene.add.graphics();
  floorGfx.fillStyle(0x3f6212, 1); // Rich forest green
  floorGfx.fillRect(0, 300, 1600, 900);

  // Whimsical yellow-tan paths that wind through the woods
  floorGfx.fillStyle(0xfef08a, 0.25); // Path colour
  
  // Main winding trail
  floorGfx.beginPath();
  floorGfx.moveTo(800 - 60, 300);
  for (let y = 300; y <= 1200; y += 15) {
    let xOffset = Math.sin(y * 0.006) * 120 + Math.cos(y * 0.012) * 40;
    floorGfx.lineTo(800 + xOffset - 60, y);
  }
  for (let y = 1200; y >= 300; y -= 15) {
    let xOffset = Math.sin(y * 0.006) * 120 + Math.cos(y * 0.012) * 40;
    floorGfx.lineTo(800 + xOffset + 60, y);
  }
  floorGfx.closePath();
  floorGfx.fillPath();

  // Side path to the left pond
  floorGfx.beginPath();
  floorGfx.moveTo(760, 560);
  for (let x = 760; x >= 200; x -= 20) {
    let t = (760 - x) / 560;
    let yOffset = 560 + Math.sin(t * Math.PI) * 40 + t * t * 50;
    floorGfx.lineTo(x, yOffset - 30);
  }
  for (let x = 200; x <= 760; x += 20) {
    let t = (760 - x) / 560;
    let yOffset = 560 + Math.sin(t * Math.PI) * 40 + t * t * 50;
    floorGfx.lineTo(x, yOffset + 30);
  }
  floorGfx.closePath();
  floorGfx.fillPath();

  // Warm Sunbeam filter on top of the world
  const beamGfx = scene.add.graphics();
  beamGfx.fillStyle(0xfef08a, 0.08);
  beamGfx.beginPath();
  beamGfx.moveTo(100, 0);
  beamGfx.lineTo(400, 0);
  beamGfx.lineTo(1200, 1200);
  beamGfx.lineTo(800, 1200);
  beamGfx.closePath();
  beamGfx.fillPath();

  // --- FOREST SCENERY OBJECTS ---
  // 1. The Honey River (y: 850–980 crossing horizontally)
  const riverGfx = scene.add.graphics();
  riverGfx.fillStyle(0xd97706, 0.85); // Creamy liquid honey river
  riverGfx.fillRect(0, 880, 1600, 80);
  
  // River Shoreline detailing
  riverGfx.fillStyle(0x78350f, 0.3); // River shadows
  riverGfx.fillRect(0, 872, 1600, 8);
  riverGfx.fillRect(0, 960, 1600, 8);

  // 2. Interactive Wooden Bridge (allows crossing)
  const bridgeGfx = scene.add.graphics();
  bridgeGfx.fillStyle(0x451a03, 1); // Dark wood supports
  bridgeGfx.fillRect(750, 860, 180, 120);
  // Planks
  bridgeGfx.fillStyle(0x78350f, 1);
  for (let px = 760; px < 930; px += 20) {
    bridgeGfx.fillRect(px, 860, 15, 120);
  }
  // Handrails
  bridgeGfx.fillStyle(0x92400e, 1);
  bridgeGfx.fillRect(745, 860, 190, 8);
  bridgeGfx.fillRect(745, 972, 190, 8);

  // --- NOSTALGIC POOH SIGNPOST ---
  const signContainer = scene.add.container(650, 500);
  const signGfx = scene.add.graphics();
  // Pole shadow
  signGfx.fillStyle(0x000000, 0.2);
  signGfx.fillRect(4, 10, 8, 60);
  // Pole
  signGfx.fillStyle(0x7c2d12, 1);
  signGfx.fillRect(0, 0, 10, 70);
  // Board
  signGfx.fillStyle(0x9a3412, 1);
  signGfx.fillRect(-35, -20, 80, 25);
  // Text
  const signText = scene.add.text(5, -10, "HUNNY →", {
    fontSize: '11px',
    fontStyle: 'bold',
    fontFamily: 'Courier',
    color: '#fef08a'
  }).setOrigin(0.5);
  signContainer.add([signGfx, signText]);

  // --- GIANT HONEY TREES (Procedural graphics with height/depth) ---
  scene.roomData.trees = scene.physics.add.staticGroup();

  const createTree = (x, y, scale = 1) => {
    const tree = scene.add.container(x, y);
    const tgfx = scene.add.graphics();
    
    // Shadow
    tgfx.fillStyle(0x000000, 0.25);
    tgfx.fillCircle(0, 20, 45 * scale);

    // Trunk
    tgfx.fillStyle(0x451a03, 1);
    tgfx.beginPath();
    tgfx.moveTo(-20 * scale, 20 * scale);
    tgfx.lineTo(-12 * scale, -100 * scale);
    tgfx.lineTo(12 * scale, -100 * scale);
    tgfx.lineTo(20 * scale, 20 * scale);
    tgfx.closePath();
    tgfx.fillPath();

    tgfx.fillRect(-30 * scale, -70 * scale, 30 * scale, 8 * scale);
    tgfx.fillRect(5 * scale, -85 * scale, 32 * scale, 8 * scale);

    // Golden Canopy
    tgfx.fillStyle(0xeab308, 0.95);
    tgfx.fillCircle(0, -110 * scale, 45 * scale);
    tgfx.fillStyle(0xfacc15, 0.95);
    tgfx.fillCircle(-25 * scale, -130 * scale, 35 * scale);
    tgfx.fillCircle(25 * scale, -125 * scale, 38 * scale);
    tgfx.fillStyle(0xfef08a, 0.9);
    tgfx.fillCircle(-5 * scale, -150 * scale, 30 * scale);

    tgfx.fillStyle(0xf59e0b, 1);
    tgfx.fillCircle(15 * scale, -60 * scale, 4 * scale);

    tree.add(tgfx);
    tree.setDepth(y); // Depth Sorting

    const baseCollider = scene.add.circle(x, y + 10 * scale, 20 * scale, 0x000000, 0);
    scene.physics.world.enable(baseCollider, Phaser.Physics.Arcade.STATIC_BODY);
    scene.roomData.trees.add(baseCollider);
  };

  // Populate forests
  // Left side
  createTree(150, 400, 1.4);
  createTree(280, 450, 1.1);
  createTree(100, 520, 1.3);
  createTree(320, 600, 1.2);
  createTree(180, 720, 1.5);
  createTree(120, 1050, 1.4);
  createTree(280, 1100, 1.1);

  // Right side
  createTree(1450, 380, 1.5);
  createTree(1300, 480, 1.2);
  createTree(1500, 580, 1.3);
  createTree(1400, 700, 1.4);
  createTree(1320, 800, 1.1);
  createTree(1480, 1050, 1.5);
  createTree(1300, 1120, 1.2);

  // Center
  createTree(1050, 450, 1.3);
  createTree(580, 650, 1.1);
  createTree(1100, 1050, 1.2);

  // Canopy sway
  scene.tweens.add({
    targets: [signContainer],
    angle: { from: -2, to: 2 },
    duration: 2500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // --- ANIMATED FOCAL POINT 1: THE DRIPPING HONEY TREE ---
  const honeyTree = scene.add.container(800, 420);
  const hGfx = scene.add.graphics();
  hGfx.fillStyle(0x000000, 0.3);
  hGfx.fillCircle(0, 30, 70);

  hGfx.fillStyle(0x271306, 1);
  hGfx.beginPath();
  hGfx.moveTo(-40, 30);
  hGfx.lineTo(-25, -110);
  hGfx.lineTo(25, -110);
  hGfx.lineTo(40, 30);
  hGfx.closePath();
  hGfx.fillPath();

  hGfx.fillStyle(0x0a0502, 1);
  hGfx.fillCircle(0, -40, 16);
  hGfx.fillStyle(0xf59e0b, 1);
  hGfx.fillCircle(0, -36, 12);

  hGfx.fillStyle(0xeab308, 0.95);
  hGfx.fillCircle(-40, -130, 55);
  hGfx.fillCircle(40, -130, 55);
  hGfx.fillCircle(0, -160, 65);
  hGfx.fillStyle(0xfef08a, 0.9);
  hGfx.fillCircle(0, -180, 40);

  honeyTree.add(hGfx);
  honeyTree.setDepth(420);

  const centralTreeCollider = scene.add.circle(800, 440, 45, 0x000000, 0);
  scene.physics.world.enable(centralTreeCollider, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.trees.add(centralTreeCollider);

  const dripGfx = scene.add.graphics();
  dripGfx.fillStyle(0xf59e0b, 0.9);
  dripGfx.setDepth(421);
  scene.roomData.dripGfx = dripGfx;
  
  scene.roomData.dripY = -30;
  scene.roomData.dripState = 0;
  scene.roomData.dripAlpha = 1.0;

  // --- FOCAL POINT 2: GOLDEN POLLEN PARTICLES ---
  scene.roomData.pollenParticles = [];
  for (let i = 0; i < 35; i++) {
    const px = Phaser.Math.Between(50, 1550);
    const py = Phaser.Math.Between(320, 1150);
    const size = Phaser.Math.FloatBetween(2.5, 5);
    const speed = Phaser.Math.FloatBetween(0.5, 1.5);
    const shineGfx = scene.add.graphics();
    shineGfx.fillStyle(0xfef08a, Phaser.Math.FloatBetween(0.4, 0.9));
    shineGfx.fillCircle(0, 0, size);
    shineGfx.setBlendMode(Phaser.BlendModes.ADD);
    shineGfx.x = px;
    shineGfx.y = py;
    shineGfx.setDepth(1190);
    
    scene.roomData.pollenParticles.push({
      obj: shineGfx,
      speed: speed,
      baseY: py,
      amplitude: Phaser.Math.FloatBetween(10, 40),
      waveSpeed: Phaser.Math.FloatBetween(0.001, 0.003)
    });
  }

  // --- GAME ANCHOR: MYSTERIOUS HONEY CHEST VAULT ---
  const chestContainer = scene.add.container(800, 750);
  const chestShadow = scene.add.graphics();
  chestShadow.fillStyle(0x000000, 0.3);
  chestShadow.fillEllipse(0, 20, 100, 40);
  
  const chestGfx = scene.add.graphics();
  chestGfx.fillStyle(0xbf5b17, 1);
  chestGfx.fillCircle(0, -10, 32);
  chestGfx.fillCircle(0, -28, 25);
  chestGfx.fillRect(-22, -35, 44, 15);

  chestGfx.fillStyle(0xd97706, 1);
  chestGfx.fillRect(-28, -44, 56, 10);
  
  chestGfx.fillStyle(0xfacc15, 1);
  chestGfx.fillTriangle(-12, -10, 0, -27, 12, -10);
  chestGfx.fillCircle(-10, -10, 3);
  chestGfx.fillCircle(0, -27, 4);
  chestGfx.fillCircle(10, -10, 3);
  chestGfx.fillRect(-10, -10, 20, 15);

  chestGfx.fillStyle(0xf59e0b, 1);
  chestGfx.fillRect(-24, -38, 48, 8);
  chestGfx.fillCircle(-14, -30, 6);
  chestGfx.fillCircle(-4, -26, 8);
  chestGfx.fillCircle(8, -28, 7);
  chestGfx.fillCircle(18, -32, 5);

  const chestLabel = scene.add.text(0, -75, "🍯 HUNNY VAULT", {
    fontSize: '12px',
    fontStyle: 'bold',
    backgroundColor: '#451a03',
    padding: { x: 8, y: 4 },
    color: '#fbbf24',
    borderRadius: 4
  }).setOrigin(0.5);

  chestContainer.add([chestShadow, chestGfx, chestLabel]);
  chestContainer.setDepth(750);

  const vaultCollider = scene.add.circle(800, 750, 35, 0x000000, 0);
  scene.physics.world.enable(vaultCollider, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.trees.add(vaultCollider);

  vaultCollider.setInteractive();
  
  scene.roomData.sparks = scene.add.group();
  scene.roomData.triggerChestBurst = function() {
    for (let i = 0; i < 12; i++) {
      const sparkle = scene.add.graphics();
      sparkle.fillStyle(0xfef08a, 1);
      sparkle.fillRect(-4, -4, 8, 8);
      sparkle.x = 800;
      sparkle.y = 710;
      sparkle.setDepth(1200);
      sparkle.setBlendMode(Phaser.BlendModes.ADD);

      scene.physics.world.enable(sparkle);
      const vx = Phaser.Math.Between(-150, 150);
      const vy = Phaser.Math.Between(-250, -50);
      sparkle.body.setVelocity(vx, vy);
      sparkle.body.setGravityY(200);

      scene.tweens.add({
        targets: sparkle,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 1000 + Math.random() * 500,
        onComplete: () => sparkle.destroy()
      });
    }
  };

  // --- PLAYER CHARACTER BEAR ---
  const player = scene.add.container(800, 600);
  const pShadow = scene.add.graphics();
  pShadow.fillStyle(0x000000, 0.35);
  pShadow.fillEllipse(0, 16, 32, 16);

  const pGfx = scene.add.graphics();
  pGfx.fillStyle(0xeab308, 1);
  pGfx.fillCircle(-8, 10, 6);
  pGfx.fillCircle(8, 10, 6);

  pGfx.fillStyle(0xeab308, 1);
  pGfx.fillEllipse(0, 2, 24, 20);

  pGfx.fillStyle(0xd97706, 1);
  pGfx.fillStyle(0xe11d48, 1);
  pGfx.fillRect(-12, -14, 24, 18);
  pGfx.fillCircle(0, -6, 12);
  pGfx.fillRect(-16, -14, 8, 8);
  pGfx.fillRect(8, -14, 8, 8);

  pGfx.fillStyle(0xeab308, 1);
  pGfx.fillCircle(-16, -6, 5);
  pGfx.fillCircle(16, -6, 5);

  pGfx.fillCircle(0, -22, 14);
  pGfx.fillCircle(-11, -34, 6);
  pGfx.fillCircle(11, -34, 6);
  pGfx.fillStyle(0xb45309, 1);
  pGfx.fillCircle(-11, -34, 3);
  pGfx.fillCircle(11, -34, 3);

  pGfx.fillStyle(0xfef08a, 1);
  pGfx.fillCircle(0, -19, 6);
  pGfx.fillStyle(0x1c1917, 1);
  pGfx.fillCircle(0, -21, 2.5);
  pGfx.fillCircle(-5, -24, 1.5);
  pGfx.fillCircle(5, -24, 1.5);

  player.add([pShadow, pGfx]);
  player.setDepth(600);

  scene.physics.world.enable(player);
  player.body.setCollideWorldBounds(true);
  player.body.setCircle(14, -14, 2);

  scene.physics.add.collider(player, scene.roomData.trees);
  scene.player = player;

  // Controls & Camera Follow
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.cameras.main.setBounds(0, 0, 1600, 1200);
  scene.cameras.main.startFollow(player, true, 0.08, 0.08);

  // --- EXIT TRIGGER (keep this block exactly as-is) ---
  scene.add.rectangle(800, 1160, 120, 30, 0x333333);
  scene.add.text(800, 1160, 'EXIT', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
  const exitZone = scene.add.zone(800, 1155, 120, 40);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;

  // --- MINIMAL IN-GAME HUD ---
  const hudContainer = scene.add.container(16, 16).setScrollFactor(0).setDepth(2000);
  const hudBg = scene.add.graphics();
  hudBg.fillStyle(0x000000, 0.65);
  hudBg.fillRoundedRect(0, 0, 240, 75, 8);
  
  const hudText = scene.add.text(12, 12, "THE HUNDRED ACRE WOOD", {
    fontSize: '11px',
    fontStyle: 'bold',
    color: '#fdeb8a',
    fontFamily: 'monospace'
  });

  const posText = scene.add.text(12, 32, "Coords: X: 800, Y: 600\nUse arrow keys to walk around!", {
    fontSize: '10px',
    color: '#ffffff',
    fontFamily: 'monospace',
    lineSpacing: 4
  });

  hudContainer.add([hudBg, hudText, posText]);
  scene.roomData.hud = hudContainer;
  scene.roomData.posText = posText;
}

export function onUpdate(scene) {
  // --- exit check (keep this block exactly as-is) ---
  const d = scene.roomData;
  if (d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) scene.exitRoom();
  }

  // --- BEAR WADDLE MOVEMENT ---
  const player = scene.player;
  const cursors = scene.cursors;

  if (!player) return;

  const speed = 180;
  let vx = 0;
  let vy = 0;

  if (cursors.left.isDown) {
    vx = -speed;
    player.scaleX = -1;
  } else if (cursors.right.isDown) {
    vx = speed;
    player.scaleX = 1;
  }

  if (cursors.up.isDown) {
    vy = -speed;
  } else if (cursors.down.isDown) {
    vy = speed;
  }

  if (vx !== 0 && vy !== 0) {
    vx *= 0.7071;
    vy *= 0.7071;
  }

  player.body.setVelocity(vx, vy);
  player.setDepth(player.y);

  if (vx !== 0 || vy !== 0) {
    const time = scene.time.now;
    player.angle = Math.sin(time * 0.015) * 8;
    if (Math.random() < 0.15) {
      const dust = scene.add.graphics();
      dust.fillStyle(0x854d0e, 0.4);
      dust.fillCircle(player.x + Phaser.Math.Between(-8, 8), player.y + 12, Phaser.Math.Between(3, 6));
      scene.tweens.add({
        targets: dust,
        alpha: 0,
        y: player.y + 2,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 400,
        onComplete: () => dust.destroy()
      });
    }
  } else {
    player.angle = 0;
  }

  if (scene.roomData.posText) {
    scene.roomData.posText.setText(
      `Coords: X: ${Math.round(player.x)}, Y: ${Math.round(player.y)}\n` +
      `Use ARROWS to walk • Go south to EXIT`
    );
  }

  // --- HONEY DROP ACTION ---
  const dGfx = scene.roomData.dripGfx;
  if (dGfx) {
    dGfx.clear();
    const originX = 800;
    const originY = 380;

    if (scene.roomData.dripState === 0) {
      scene.roomData.dripY = originY;
      const size = 3 + (scene.time.now % 1800) / 450;
      dGfx.fillStyle(0xf59e0b, 1.0);
      dGfx.fillCircle(originX, originY, size);
      dGfx.fillRect(originX - 1.5, originY - 10, 3, 10);

      if (scene.time.now % 1800 > 1750) {
        scene.roomData.dripState = 1;
      }
    } else if (scene.roomData.dripState === 1) {
      scene.roomData.dripY += 6;
      dGfx.fillStyle(0xf59e0b, 1.0);
      dGfx.fillCircle(originX, scene.roomData.dripY, 4.5);
      dGfx.fillTriangle(originX - 4.5, scene.roomData.dripY, originX + 4.5, scene.roomData.dripY, originX, scene.roomData.dripY - 8);

      if (scene.roomData.dripY >= 435) {
        scene.roomData.dripState = 2;
        scene.roomData.splashTime = scene.time.now;
      }
    } else if (scene.roomData.dripState === 2) {
      const elapsed = scene.time.now - scene.roomData.splashTime;
      const progress = elapsed / 250;

      if (progress >= 1) {
        scene.roomData.dripState = 0;
      } else {
        dGfx.fillStyle(0xf59e0b, 1.0 - progress);
        const dist = progress * 14;
        dGfx.fillCircle(originX - dist, 435 - (progress * 5), 3 * (1 - progress));
        dGfx.fillCircle(originX + dist, 435 - (progress * 5), 3 * (1 - progress));
        dGfx.fillCircle(originX, 435 - (progress * 12), 2 * (1 - progress));
      }
    }
  }

  // --- POLLEN DRIFT ---
  if (scene.roomData.pollenParticles) {
    const time = scene.time.now;
    scene.roomData.pollenParticles.forEach(p => {
      p.obj.x -= p.speed * 0.7;
      p.obj.y = p.baseY + Math.sin(time * p.waveSpeed + p.baseY) * p.amplitude * 0.2;

      if (p.obj.x < -10) {
        p.obj.x = 1610;
        p.baseY = Phaser.Math.Between(300, 1200);
        p.obj.y = p.baseY;
      }
    });
  }

  // --- PROXIMITY CHEST ACTION ---
  const distToChest = Phaser.Math.Distance.Between(player.x, player.y, 800, 750);
  if (distToChest < 75) {
    if (!scene.roomData.lastProximitySpark || scene.time.now - scene.roomData.lastProximitySpark > 600) {
      scene.roomData.triggerChestBurst();
      scene.roomData.lastProximitySpark = scene.time.now;
    }
  }
}

export function onExit(scene) {
  scene.roomData = null;
}

// --- Custom themed player character (Waddly Bear) ---
export function createOtherPlayer(scene, { x, y }) {
  const container = scene.add.container(x, y);

  // Soft drop shadow at player base
  const pShadow = scene.add.graphics();
  pShadow.fillStyle(0x000000, 0.35);
  pShadow.fillEllipse(0, 16, 32, 16);

  // Golden yellow bear body & red shirt
  const pGfx = scene.add.graphics();

  // Legs
  pGfx.fillStyle(0xeab308, 1);
  pGfx.fillCircle(-8, 10, 6);
  pGfx.fillCircle(8, 10, 6);

  // Chubby Bear Belly
  pGfx.fillStyle(0xeab308, 1);
  pGfx.fillEllipse(0, 2, 24, 20);

  // Famous Little Red T-Shirt
  pGfx.fillStyle(0xd97706, 1);
  pGfx.fillStyle(0xe11d48, 1);
  pGfx.fillRect(-12, -14, 24, 18);
  pGfx.fillCircle(0, -6, 12);
  pGfx.fillRect(-16, -14, 8, 8);
  pGfx.fillRect(8, -14, 8, 8);

  // Gold Paws
  pGfx.fillStyle(0xeab308, 1);
  pGfx.fillCircle(-16, -6, 5);
  pGfx.fillCircle(16, -6, 5);

  // Cute round bear head
  pGfx.fillCircle(0, -22, 14);

  // Left & Right Ears
  pGfx.fillCircle(-11, -34, 6);
  pGfx.fillCircle(11, -34, 6);
  pGfx.fillStyle(0xb45309, 1);
  pGfx.fillCircle(-11, -34, 3);
  pGfx.fillCircle(11, -34, 3);

  // Face Snout and Black Nose
  pGfx.fillStyle(0xfef08a, 1);
  pGfx.fillCircle(0, -19, 6);
  pGfx.fillStyle(0x1c1917, 1);
  pGfx.fillCircle(0, -21, 2.5);
  pGfx.fillCircle(-5, -24, 1.5);
  pGfx.fillCircle(5, -24, 1.5);

  container.add([pShadow, pGfx]);
  container._labelOffsetY = 48; // pixels from origin to above head
  return container;
}