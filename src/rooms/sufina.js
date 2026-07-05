// ==========================================
// UNICORN PRINCESS LAND - PHASER.JS ROOM
// ==========================================

// 1. Core Module Exports (Required by Environment)
export const name = "Unicorn Princess Land";

export function onLoad(scene) {
  // No external assets required as we draw all elements procedurally with Phaser Graphics
}

export function onCreate(scene) {
  console.log("Creating Unicorn Princess Land...");
  scene.roomData = {};

  // Initialize UI & Room States inside roomData
  scene.roomData.collectedFlowersCount = 0;
  scene.roomData.totalFlowersCount = 6;
  scene.roomData.mana = 100;
  scene.roomData.currentLocation = "Forest Path";

  // Setup world boundaries (1600px wide, 1200px tall)
  scene.physics.world.setBounds(0, 0, 1600, 1200);

  // Group structures to handle depth sorting dynamically inside update loop
  scene.depthGroup = scene.add.group();

  // --- 1. SKY & HORIZON (y: 0 - 300) ---
  const skyGfx = scene.add.graphics();
  skyGfx.setScrollFactor(0); // Sky stays fixed to camera
  
  // Colorful magical sunset gradient bands
  const skyColors = [0x2e113d, 0x48124b, 0x731a5b, 0xa32d73, 0xd04886, 0xe87299, 0xffa4b4];
  const bandHeight = 45;
  for (let i = 0; i < skyColors.length; i++) {
    skyGfx.fillStyle(skyColors[i], 1.0);
    skyGfx.fillRect(0, i * bandHeight, 1600, bandHeight);
  }

  // Giant glowing magical moon/sun
  skyGfx.fillStyle(0xfff7d1, 0.4);
  skyGfx.fillCircle(1000, 140, 120);
  skyGfx.fillStyle(0xfff7d1, 0.7);
  skyGfx.fillCircle(1000, 140, 80);

  // Wispy parallax clouds
  scene.clouds = [];
  for (let i = 0; i < 6; i++) {
    const cloudGfx = scene.add.graphics();
    const cloudX = Phaser.Math.Between(50, 1500);
    const cloudY = Phaser.Math.Between(40, 180);
    const size = Phaser.Math.Between(20, 45);
    
    cloudGfx.fillStyle(0xffffff, 0.25);
    cloudGfx.fillCircle(cloudX, cloudY, size);
    cloudGfx.fillCircle(cloudX - size * 0.7, cloudY + size * 0.2, size * 0.7);
    cloudGfx.fillCircle(cloudX + size * 0.7, cloudY + size * 0.2, size * 0.7);
    cloudGfx.fillCircle(cloudX + size * 1.3, cloudY + size * 0.4, size * 0.4);
    
    scene.clouds.push({ gfx: cloudGfx, initialX: cloudX, speed: Phaser.Math.Between(1, 3) * 0.05 });
  }

  // --- 2. BACKGROUND MOUNTAINS along horizon (y: 200 - 300) ---
  const bgSceneryGfx = scene.add.graphics();
  bgSceneryGfx.setScrollFactor(0.1); // Slowly pans with camera

  // Dark background mountain layer
  bgSceneryGfx.fillStyle(0x3e1747, 1);
  bgSceneryGfx.beginPath();
  bgSceneryGfx.moveTo(0, 300);
  bgSceneryGfx.lineTo(100, 150);
  bgSceneryGfx.lineTo(250, 240);
  bgSceneryGfx.lineTo(400, 100);
  bgSceneryGfx.lineTo(600, 260);
  bgSceneryGfx.lineTo(750, 120);
  bgSceneryGfx.lineTo(950, 230);
  bgSceneryGfx.lineTo(1100, 80);
  bgSceneryGfx.lineTo(1300, 240);
  bgSceneryGfx.lineTo(1450, 130);
  bgSceneryGfx.lineTo(1600, 300);
  bgSceneryGfx.closePath();
  bgSceneryGfx.fillPath();

  // Midground mountain layer
  bgSceneryGfx.fillStyle(0x522359, 1);
  bgSceneryGfx.beginPath();
  bgSceneryGfx.moveTo(0, 300);
  bgSceneryGfx.lineTo(150, 200);
  bgSceneryGfx.lineTo(350, 170);
  bgSceneryGfx.lineTo(500, 230);
  bgSceneryGfx.lineTo(700, 160);
  bgSceneryGfx.lineTo(850, 240);
  bgSceneryGfx.lineTo(1050, 150);
  bgSceneryGfx.lineTo(1250, 220);
  bgSceneryGfx.lineTo(1450, 180);
  bgSceneryGfx.lineTo(1600, 300);
  bgSceneryGfx.closePath();
  bgSceneryGfx.fillPath();

  // Foreground pink mountain layer
  bgSceneryGfx.fillStyle(0x7c3476, 1);
  bgSceneryGfx.beginPath();
  bgSceneryGfx.moveTo(0, 300);
  bgSceneryGfx.lineTo(80, 240);
  bgSceneryGfx.lineTo(220, 210);
  bgSceneryGfx.lineTo(450, 260);
  bgSceneryGfx.lineTo(600, 220);
  bgSceneryGfx.lineTo(800, 250);
  bgSceneryGfx.lineTo(1000, 200);
  bgSceneryGfx.lineTo(1200, 240);
  bgSceneryGfx.lineTo(1380, 210);
  bgSceneryGfx.lineTo(1600, 300);
  bgSceneryGfx.closePath();
  bgSceneryGfx.fillPath();

  // --- 3. GROUND/FLOOR (y: 300 - 1200) ---
  const groundGfx = scene.add.graphics();
  
  // Base land (violet magical grass)
  groundGfx.fillStyle(0x19082b, 1);
  groundGfx.fillRect(0, 300, 1600, 900);

  // Soft glow magic paths
  groundGfx.fillStyle(0x2a113d, 1);
  groundGfx.beginPath();
  groundGfx.moveTo(700, 300);
  groundGfx.lineTo(900, 300);
  groundGfx.lineTo(1000, 1200);
  groundGfx.lineTo(600, 1200);
  groundGfx.closePath();
  groundGfx.fillPath();

  groundGfx.beginPath();
  groundGfx.moveTo(0, 500);
  groundGfx.lineTo(1600, 800);
  groundGfx.lineTo(1600, 900);
  groundGfx.lineTo(0, 600);
  groundGfx.closePath();
  groundGfx.fillPath();

  // Glowing ground runes
  groundGfx.lineStyle(2, 0xe67299, 0.4);
  for (let i = 0; i < 15; i++) {
    const rx = Phaser.Math.Between(50, 1550);
    const ry = Phaser.Math.Between(350, 1150);
    const size = Phaser.Math.Between(15, 40);
    groundGfx.strokeCircle(rx, ry, size);
    groundGfx.strokeCircle(rx, ry, size - 5);
  }

  // --- 4. ANIMATED FOCAL POINT: RAINBOW RIVER (y: 650 to 730) ---
  scene.riverGfx = scene.add.graphics();
  scene.riverTime = 0;

  const riverBoundGfx = scene.add.graphics();
  riverBoundGfx.lineStyle(4, 0xffa4b4, 0.7);
  riverBoundGfx.moveTo(0, 650);
  riverBoundGfx.lineTo(1600, 650);
  riverBoundGfx.moveTo(0, 730);
  riverBoundGfx.lineTo(1600, 730);
  riverBoundGfx.strokePath();

  // Rainbow River Sparkles
  scene.streamSparkles = [];
  for (let i = 0; i < 20; i++) {
    const particle = scene.add.circle(
      Phaser.Math.Between(0, 1600),
      Phaser.Math.Between(650, 720),
      Phaser.Math.Between(2, 5),
      0xcceeff,
      0.8
    );
    scene.physics.add.existing(particle);
    scene.tweens.add({
      targets: particle,
      x: particle.x + Phaser.Math.Between(100, 200),
      alpha: { from: 0.8, to: 0.1 },
      duration: Phaser.Math.Between(2000, 4000),
      repeat: -1,
      onRepeat: () => {
        particle.x = Phaser.Math.Between(-10, 100);
        particle.alpha = 0.8;
      }
    });
  }

  // Interactive wooden bridge (walkway deck)
  const bridgeX = 800;
  const bridgeY = 690;
  const bridgeGfx = scene.add.graphics();
  bridgeGfx.fillStyle(0x5c2b12, 1);
  bridgeGfx.fillRect(bridgeX - 100, bridgeY - 50, 200, 100);
  bridgeGfx.lineStyle(6, 0xffd700, 1);
  bridgeGfx.strokeRect(bridgeX - 100, bridgeY - 50, 200, 10);
  bridgeGfx.strokeRect(bridgeX - 100, bridgeY + 40, 200, 10);
  for (let bx = bridgeX - 90; bx <= bridgeX + 90; bx += 30) {
    bridgeGfx.lineBetween(bx, bridgeY - 50, bx, bridgeY - 40);
    bridgeGfx.lineBetween(bx, bridgeY + 40, bx, bridgeY + 50);
  }

  // --- 5. GAME ANCHOR: CELESTIAL FOUNTAIN (X: 800, Y: 480) ---
  const fountainContainer = scene.add.container(800, 480);
  const ftShadow = scene.add.ellipse(0, 35, 140, 50, 0x000000, 0.4);
  fountainContainer.add(ftShadow);

  const ftGfx = scene.add.graphics();
  // Bottom basin tier
  ftGfx.fillStyle(0xab7bc9, 1);
  ftGfx.fillRect(-60, 0, 120, 30);
  ftGfx.fillStyle(0xccaae6, 1);
  ftGfx.fillEllipse(0, 0, 120, 25);
  ftGfx.fillStyle(0x73fffa, 0.8);
  ftGfx.fillEllipse(0, -2, 110, 20);

  // Pillar
  ftGfx.fillStyle(0x774199, 1);
  ftGfx.fillRect(-15, -60, 30, 60);
  ftGfx.fillStyle(0xab7bc9, 1);
  ftGfx.fillRect(-12, -60, 24, 60);

  // Top basin tier
  ftGfx.fillStyle(0xab7bc9, 1);
  ftGfx.fillRect(-35, -70, 70, 15);
  ftGfx.fillStyle(0xccaae6, 1);
  ftGfx.fillEllipse(0, -70, 70, 15);
  ftGfx.fillStyle(0x73fffa, 0.8);
  ftGfx.fillEllipse(0, -72, 64, 12);

  // Fountain spouter
  ftGfx.fillStyle(0xffffff, 0.9);
  ftGfx.fillCircle(0, -90, 10);
  fountainContainer.add(ftGfx);

  // Hovering Wishing Orb
  const wishingOrb = scene.add.circle(0, -115, 16, 0xffffff, 1);
  scene.tweens.add({
    targets: wishingOrb,
    y: -135,
    scaleX: 1.1,
    scaleY: 0.9,
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
  fountainContainer.add(wishingOrb);

  // Fountain sparkle particles
  scene.fountainParticles = [];
  for (let i = 0; i < 15; i++) {
    const spark = scene.add.circle(
      Phaser.Math.Between(-80, 80),
      Phaser.Math.Between(-140, 10),
      Phaser.Math.Between(3, 7),
      0x73fffa,
      0.8
    );
    spark.setBlendMode(Phaser.BlendModes.ADD);
    fountainContainer.add(spark);
    
    scene.tweens.add({
      targets: spark,
      y: spark.y - Phaser.Math.Between(20, 60),
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(1500, 3000),
      repeat: -1,
      onRepeat: () => {
        spark.y = Phaser.Math.Between(-100, 10);
        spark.x = Phaser.Math.Between(-60, 60);
        spark.alpha = 0.8;
        spark.scale = 1;
      }
    });
  }

  fountainContainer.depthY = 515;
  scene.depthGroup.add(fountainContainer);
  scene.roomData.fountain = fountainContainer;

  // Physical Fountain Collider
  const ftPhysicsObj = scene.add.circle(800, 500, 65);
  scene.physics.add.existing(ftPhysicsObj, true);
  scene.roomData.fountainCollider = ftPhysicsObj;

  // --- 6. COTTON CANDY BLOSSOM TREES ---
  const treePositions = [
    { x: 180, y: 380 }, { x: 300, y: 360 }, { x: 1300, y: 380 }, { x: 1450, y: 420 },
    { x: 220, y: 550 }, { x: 120, y: 650 }, { x: 1380, y: 580 }, { x: 1480, y: 720 },
    { x: 200, y: 880 }, { x: 340, y: 920 }, { x: 1240, y: 860 }, { x: 1390, y: 950 },
    { x: 550, y: 1020 }, { x: 1050, y: 1040 }, { x: 720, y: 350 }, { x: 920, y: 360 }
  ];

  treePositions.forEach((pos) => {
    const treeContainer = scene.add.container(pos.x, pos.y);
    const shadow = scene.add.ellipse(0, 5, 60, 20, 0x000000, 0.45);
    treeContainer.add(shadow);

    const trunk = scene.add.graphics();
    trunk.fillStyle(0x431e54, 1);
    trunk.fillRect(-12, -70, 24, 75);
    trunk.fillStyle(0x602a78, 1);
    trunk.fillRect(-5, -70, 10, 75);
    treeContainer.add(trunk);

    const foliage = scene.add.graphics();
    foliage.fillStyle(0x8f265c, 1);
    foliage.fillCircle(-25, -90, 40);
    foliage.fillCircle(25, -90, 40);
    foliage.fillCircle(0, -125, 45);

    foliage.fillStyle(0xe65e94, 1);
    foliage.fillCircle(-20, -95, 34);
    foliage.fillCircle(20, -95, 34);
    foliage.fillCircle(0, -120, 38);

    foliage.fillStyle(0xff99bd, 1);
    foliage.fillCircle(-10, -100, 24);
    foliage.fillCircle(10, -100, 24);
    foliage.fillCircle(0, -125, 28);
    treeContainer.add(foliage);

    treeContainer.depthY = pos.y + 5;
    scene.depthGroup.add(treeContainer);

    const coll = scene.add.circle(pos.x, pos.y + 2, 20);
    scene.physics.add.existing(coll, true);
  });

  // --- 7. GLOWING CRYSTALS ---
  const crystalPositions = [
    { x: 450, y: 410 }, { x: 1100, y: 420 },
    { x: 50, y: 550 }, { x: 1530, y: 550 },
    { x: 950, y: 880 }, { x: 620, y: 900 }
  ];

  crystalPositions.forEach((pos) => {
    const crysContainer = scene.add.container(pos.x, pos.y);
    const sh = scene.add.ellipse(0, 10, 45, 18, 0x000000, 0.5);
    crysContainer.add(sh);

    const cGfx = scene.add.graphics();
    cGfx.fillStyle(0x00ccff, 1);
    cGfx.beginPath();
    cGfx.moveTo(0, -45);
    cGfx.lineTo(15, -15);
    cGfx.lineTo(8, 10);
    cGfx.lineTo(-8, 10);
    cGfx.lineTo(-15, -15);
    cGfx.closePath();
    cGfx.fillPath();

    cGfx.fillStyle(0x99f3ff, 1);
    cGfx.beginPath();
    cGfx.moveTo(0, -45);
    cGfx.lineTo(15, -15);
    cGfx.lineTo(0, 10);
    cGfx.closePath();
    cGfx.fillPath();

    cGfx.fillStyle(0x0099e6, 1);
    cGfx.beginPath();
    cGfx.moveTo(-20, -25);
    cGfx.lineTo(-5, -5);
    cGfx.lineTo(-10, 10);
    cGfx.lineTo(-25, 10);
    cGfx.closePath();
    cGfx.fillPath();

    cGfx.fillStyle(0x80dfff, 1);
    cGfx.beginPath();
    cGfx.moveTo(-20, -25);
    cGfx.lineTo(-5, -5);
    cGfx.lineTo(-12, 10);
    cGfx.closePath();
    cGfx.fillPath();

    crysContainer.add(cGfx);

    scene.tweens.add({
      targets: cGfx,
      alpha: 0.7,
      duration: Phaser.Math.Between(1000, 1800),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    crysContainer.depthY = pos.y + 10;
    scene.depthGroup.add(crysContainer);

    const coll = scene.add.circle(pos.x, pos.y + 5, 15);
    scene.physics.add.existing(coll, true);
  });

  // --- 8. COLLECTIBLE FLOWERS ---
  scene.flowers = scene.add.group();
  const flowerPositions = [
    { x: 500, y: 350 }, { x: 1150, y: 360 },
    { x: 280, y: 600 }, { x: 1350, y: 610 },
    { x: 420, y: 850 }, { x: 1100, y: 920 }
  ];

  flowerPositions.forEach((pos, index) => {
    const flContainer = scene.add.container(pos.x, pos.y);
    const aura = scene.add.circle(0, 0, 18, 0xffa4b4, 0.4);
    flContainer.add(badgeAura => {
      // Dynamic scaling
    });
    flContainer.add(aura);
    
    scene.tweens.add({
      targets: aura,
      scale: 1.5,
      alpha: 0,
      duration: 1500,
      repeat: -1
    });

    const pGfx = scene.add.graphics();
    pGfx.fillStyle(0xff69b4, 1);
    for (let deg = 0; deg < 360; deg += 60) {
      const rad = Phaser.Math.DegToRad(deg);
      pGfx.fillCircle(Math.cos(rad) * 6, Math.sin(rad) * 6, 5);
    }
    pGfx.fillStyle(0xffe600, 1);
    pGfx.fillCircle(0, 0, 4);
    flContainer.add(pGfx);

    flContainer.depthY = pos.y;
    scene.depthGroup.add(flContainer);

    const sensor = scene.add.circle(pos.x, pos.y, 25);
    scene.physics.add.existing(sensor, true);
    sensor.flowerContainer = flContainer;
    sensor.flowerId = index;
    sensor.isCollected = false;

    scene.flowers.add(sensor);
  });

  // --- 9. CHIBI PRINCESS CHARACTER ---
  const princess = scene.add.container(800, 600);
  const pShadow = scene.add.ellipse(0, 18, 28, 10, 0x000000, 0.5);
  princess.add(pShadow);

  const charGfx = scene.add.graphics();
  // Royal Cape
  charGfx.fillStyle(0xd04886, 1);
  charGfx.fillRect(-12, -15, 24, 28);
  charGfx.fillCircle(-10, 13, 6);
  charGfx.fillCircle(0, 13, 6);
  charGfx.fillCircle(10, 13, 6);

  // Dress
  charGfx.fillStyle(0xff99bd, 1);
  charGfx.beginPath();
  charGfx.moveTo(-10, -10);
  charGfx.lineTo(10, -10);
  charGfx.lineTo(16, 15);
  charGfx.lineTo(-16, 15);
  charGfx.closePath();
  charGfx.fillPath();

  charGfx.fillStyle(0xffffff, 1);
  charGfx.fillRect(-6, -10, 12, 12);
  charGfx.fillCircle(0, 15, 6);

  // Chibi Head
  charGfx.fillStyle(0xffdfcb, 1);
  charGfx.fillCircle(0, -22, 15);

  // Hair
  charGfx.fillStyle(0x731a5b, 1);
  charGfx.fillCircle(-12, -22, 8);
  charGfx.fillCircle(12, -22, 8);
  charGfx.fillRect(-15, -34, 30, 12);
  charGfx.fillCircle(-10, -32, 6);
  charGfx.fillCircle(10, -32, 6);

  // Crown
  charGfx.fillStyle(0xffd700, 1);
  charGfx.beginPath();
  charGfx.moveTo(-10, -34);
  charGfx.lineTo(-12, -45);
  charGfx.lineTo(-5, -38);
  charGfx.lineTo(0, -48);
  charGfx.lineTo(5, -38);
  charGfx.lineTo(12, -45);
  charGfx.lineTo(10, -34);
  charGfx.closePath();
  charGfx.fillPath();
  
  charGfx.fillStyle(0xff0066, 1);
  charGfx.fillCircle(0, -48, 2);
  charGfx.fillCircle(-12, -45, 1.5);
  charGfx.fillCircle(12, -45, 1.5);

  // Face details
  charGfx.fillStyle(0x2a113d, 1);
  charGfx.fillCircle(-5, -20, 2);
  charGfx.fillCircle(5, -20, 2);
  charGfx.fillStyle(0xff66a3, 0.7);
  charGfx.fillCircle(-8, -17, 2);
  charGfx.fillCircle(8, -17, 2);

  princess.add(charGfx);
  scene.playerGraphics = charGfx;

  scene.physics.add.existing(princess);
  princess.body.setCollideWorldBounds(true);
  princess.body.setSize(26, 20);
  princess.body.setOffset(-13, 8);

  scene.player = princess;
  scene.depthGroup.add(princess);

  // Camera Configuration
  scene.cameras.main.setBounds(0, 0, 1600, 1200);
  scene.cameras.main.startFollow(princess, true, 0.1, 0.1);
  scene.cameras.main.setZoom(1.1);

  // Keybindings
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.wasd = scene.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    space: Phaser.Input.Keyboard.KeyCodes.SPACE
  });

  // --- 10. REALM EXIT GATE (y: 1150) ---
  const exitGfx = scene.add.graphics();
  exitGfx.fillStyle(0xccaae6, 0.3);
  exitGfx.fillRect(700, 1140, 200, 60);
  
  exitGfx.fillStyle(0xffd700, 0.9);
  exitGfx.fillRect(680, 1100, 15, 60);
  exitGfx.fillRect(905, 1100, 15, 60);
  
  exitGfx.fillStyle(0x8f265c, 1);
  exitGfx.fillRect(675, 1150, 25, 12);
  exitGfx.fillRect(900, 1150, 25, 12);
  exitGfx.fillRect(675, 1090, 25, 12);
  exitGfx.fillRect(900, 1090, 25, 12);
  
  const exitText = scene.add.text(800, 1110, "👑 EXIT REALM 👑", {
    fontSize: "14px",
    fontFamily: "Arial Black",
    color: "#ffffff"
  }).setOrigin(0.5);
  
  scene.tweens.add({
    targets: exitText,
    alpha: 0.4,
    duration: 1000,
    yoyo: true,
    repeat: -1
  });

  // MANDATORY EXIT TRIGGER BLOCK (As specified in guidelines)
  const exitZone = scene.add.zone(800, 1155, 120, 40);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;

  // Custom action helper for simulation
  scene.exitRoom = () => {
    triggerPhaserNotification(scene, "🌌 PORTAL ACTIVATED", "Teleporting back to the sanctuary...");
    scene.player.setPosition(800, 340);
  };

  // Overlap Trigger for Flower Harvesting
  scene.physics.add.overlap(scene.player, scene.flowers, (player, flowerSensor) => {
    if (!flowerSensor.isCollected) {
      flowerSensor.isCollected = true;
      
      scene.tweens.add({
        targets: flowerSensor.flowerContainer,
        scale: 2,
        alpha: 0,
        y: flowerSensor.flowerContainer.y - 40,
        duration: 500,
        onComplete: () => {
          flowerSensor.flowerContainer.destroy();
          flowerSensor.destroy();
        }
      });

      scene.roomData.collectedFlowersCount++;
      scene.roomData.mana = Math.min(100, Math.floor(scene.roomData.collectedFlowersCount * (100 / scene.roomData.totalFlowersCount)));
      
      updatePhaserHUD(scene);
      triggerPhaserNotification(scene, "✨ SPARKLE GATHERED ✨", "You absorbed stellar flower energy!");
    }
  });

  // Near Fountain overlap detection
  scene.isNearFountain = false;
  const fontDistanceDetector = scene.add.circle(800, 520, 110);
  scene.physics.add.existing(fontDistanceDetector, true);
  scene.physics.add.overlap(scene.player, fontDistanceDetector, () => {
    scene.isNearFountain = true;
  });

  scene.fontDistanceDetector = fontDistanceDetector;

  // Render complete in-game HUD Elements
  setupPhaserHUD(scene);

  // Welcome Announcement
  setTimeout(() => {
    triggerPhaserNotification(scene, "WELCOME PRINCESS", "W/A/S/D to move. Press SPACE at fountain!");
  }, 800);
}

export function onUpdate(scene) {
  scene.isNearFountain = false;

  // Velocity controls
  const speed = 240;
  let vx = 0;
  let vy = 0;

  if (scene.cursors.left.isDown || scene.wasd.left.isDown) {
    vx = -speed;
    scene.playerGraphics.scaleX = -1;
  } else if (scene.cursors.right.isDown || scene.wasd.right.isDown) {
    vx = speed;
    scene.playerGraphics.scaleX = 1;
  }

  if (scene.cursors.up.isDown || scene.wasd.up.isDown) {
    vy = -speed;
  } else if (scene.cursors.down.isDown || scene.wasd.down.isDown) {
    vy = speed;
  }

  scene.player.body.setVelocity(vx, vy);

  // Bobbing animation on motion
  if (vx !== 0 || vy !== 0) {
    const time = scene.time.now;
    scene.playerGraphics.y = Math.sin(time * 0.015) * 3;
    scene.playerGraphics.skewX = Math.sin(time * 0.015) * 0.05;
  } else {
    const time = scene.time.now;
    scene.playerGraphics.y = Math.sin(time * 0.003) * 1.5;
    scene.playerGraphics.skewX = 0;
  }

  // Oblique 2.5D Depth Sorting
  const children = scene.depthGroup.getChildren();
  children.forEach(child => {
    if (child.depthY !== undefined) {
      child.setDepth(child.depthY);
    } else {
      child.setDepth(child.y);
    }
  });

  // Action / Wishing mechanic
  if (Phaser.Input.Keyboard.JustDown(scene.wasd.space)) {
    if (scene.isNearFountain) {
      triggerFountainWish(scene);
    }
  }

  // Cloud parallax animation
  if (scene.clouds) {
    scene.clouds.forEach(cloud => {
      const cameraX = scene.cameras.main.scrollX;
      cloud.gfx.x = cloud.initialX + (cameraX * cloud.speed);
    });
  }

  // Shimmering flow inside rainbow river
  scene.riverTime += 0.01;
  if (scene.riverGfx) {
    scene.riverGfx.clear();
    const streamColors = [0xff99bd, 0xffd700, 0x73fffa, 0xab7bc9];
    streamColors.forEach((color, idx) => {
      scene.riverGfx.lineStyle(6, color, 0.7);
      scene.riverGfx.beginPath();
      const offsetPhase = idx * 1.5;
      const yCenter = 655 + (idx * 16);
      scene.riverGfx.moveTo(0, yCenter + Math.sin(scene.riverTime + offsetPhase) * 8);
      for (let rx = 20; rx <= 1600; rx += 20) {
        const waveY = yCenter + Math.sin((rx * 0.008) + scene.riverTime + offsetPhase) * 8;
        scene.riverGfx.lineTo(rx, waveY);
      }
      scene.riverGfx.strokePath();
    });
  }

  // Update Region indicators based on y depth
  const py = scene.player.y;
  const px = scene.player.x;
  let loc = "Whispering Woods";
  if (py > 630 && py < 750) {
    loc = "The Starlight Bridge";
  } else if (py >= 750) {
    loc = "Pink Quartz Meadows";
  } else if (py <= 550 && px > 650 && px < 950) {
    loc = "Celestial Oasis";
  }
  
  if (scene.roomData.currentLocation !== loc) {
    scene.roomData.currentLocation = loc;
    updatePhaserHUD(scene);
  }

  // Dynamic Fountain Interaction Banner state
  if (scene.hudInteractPrompt) {
    if (scene.isNearFountain) {
      scene.hudInteractPrompt.setAlpha(1);
    } else {
      scene.hudInteractPrompt.setAlpha(0);
    }
  }

  // MANDATORY EXIT CHECK BLOCK (As specified in guidelines)
  const d = scene.roomData;
  if (d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) {
      scene.exitRoom();
    }
  }
}

export function onExit(scene) {
  console.log("Leaving Unicorn Princess Land. Destroying scene dependencies...");
  scene.roomData = null;
}

// ==========================================
// PURE PHASER GAME-OBJECT HUD & INTERACTION
// ==========================================

function setupPhaserHUD(scene) {
  // Main container for absolute overlay HUD
  const hud = scene.add.container(0, 0).setScrollFactor(0).setDepth(20000);
  scene.hudContainer = hud;

  // Background Glass-panel (Translucent)
  const panel = scene.add.graphics();
  panel.fillStyle(0x110222, 0.85);
  panel.lineStyle(2, 0xff99bd, 0.7);
  panel.fillRect(15, 15, 290, 160);
  panel.strokeRect(15, 15, 290, 160);
  hud.add(panel);

  // Title Text inside HUD
  const title = scene.add.text(25, 23, "✨ Unicorn Princess Land", {
    fontFamily: "Arial Black",
    fontSize: "15px",
    color: "#ffa4b4"
  });
  hud.add(title);

  // Mana Label
  const manaLbl = scene.add.text(25, 52, "Mana Bar:", {
    fontFamily: "Arial",
    fontSize: "11px",
    color: "#ffc2db"
  });
  hud.add(manaLbl);

  // Mana bar background & dynamic filler
  const barBg = scene.add.rectangle(85, 58, 120, 10, 0x3d1747).setOrigin(0, 0.5);
  const barFill = scene.add.rectangle(85, 58, 120, 10, 0xe65e94).setOrigin(0, 0.5);
  hud.add([barBg, barFill]);
  scene.hudManaBar = barFill;

  // Flowers statistics
  const flowerText = scene.add.text(25, 75, "🍀 Flowers gathered: 0 / 6", {
    fontFamily: "Arial",
    fontSize: "12px",
    color: "#ffffff"
  });
  hud.add(flowerText);
  scene.hudFlowerText = flowerText;

  // Location indicator
  const locText = scene.add.text(25, 96, "📍 Loc: Forest Path", {
    fontFamily: "Arial",
    fontSize: "12px",
    color: "#73fffa"
  });
  hud.add(locText);
  scene.hudLocationText = locText;

  // Interactive Buttons: Respawn
  const btnRespawn = scene.add.rectangle(25, 140, 85, 24, 0x8f265c).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
  const txtRespawn = scene.add.text(67, 140, "Respawn", {
    fontFamily: "Arial",
    fontSize: "11px",
    color: "#ffffff"
  }).setOrigin(0.5);
  hud.add([btnRespawn, txtRespawn]);

  btnRespawn.on('pointerdown', () => {
    scene.player.setPosition(800, 600);
    triggerPhaserNotification(scene, "💫 RESPAWNED", "Returned safely to the center.");
  });

  // Interactive Buttons: Make Wish
  const btnWish = scene.add.rectangle(120, 140, 85, 24, 0x00ccff).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
  const txtWish = scene.add.text(162, 140, "Make Wish", {
    fontFamily: "Arial",
    fontSize: "11px",
    color: "#ffffff"
  }).setOrigin(0.5);
  hud.add([btnWish, txtWish]);

  btnWish.on('pointerdown', () => {
    triggerFountainWish(scene);
  });

  // Footer walk instructions
  const footerHelp = scene.add.text(15, 575, "🚶 Move with WASD/Arrows. Press SPACE at fountain to interact.", {
    fontFamily: "Arial",
    fontSize: "11px",
    color: "#ffc2db"
  });
  hud.add(footerHelp);

  // Floating interact prompt
  const spacePrompt = scene.add.text(785, 575, "✨ Press SPACE to interact with Fountain! ✨", {
    fontFamily: "Arial Black",
    fontSize: "12px",
    color: "#ffe600"
  }).setOrigin(1, 0.5).setAlpha(0);
  hud.add(spacePrompt);
  scene.hudInteractPrompt = spacePrompt;

  // Build Floating Notification/Toast Container
  const toastCont = scene.add.container(780, 500).setAlpha(0);
  
  const toastBg = scene.add.graphics();
  toastBg.fillStyle(0x2a113d, 0.95);
  toastBg.lineStyle(2, 0xff0066, 0.85);
  toastBg.fillRect(-280, -35, 280, 55);
  toastBg.strokeRect(-280, -35, 280, 55);
  toastCont.add(toastBg);

  const toastTitleText = scene.add.text(-270, -28, "SYSTEM", {
    fontFamily: "Arial Black",
    fontSize: "11px",
    color: "#ff99bd"
  });
  toastCont.add(toastTitleText);

  const toastMsgText = scene.add.text(-270, -12, "", {
    fontFamily: "Arial",
    fontSize: "10px",
    color: "#ffffff",
    wordWrap: { width: 260 }
  });
  toastCont.add(toastMsgText);

  hud.add(toastCont);
  scene.toastContainer = toastCont;
  scene.toastTitle = toastTitleText;
  scene.toastMsg = toastMsgText;
}

// Update the values drawn inside the Phaser HUD
function updatePhaserHUD(scene) {
  const d = scene.roomData;
  if (!d) return;

  if (scene.hudManaBar) {
    scene.hudManaBar.width = Math.max(1, Math.min(120, (d.mana / 100) * 120));
  }

  if (scene.hudFlowerText) {
    scene.hudFlowerText.setText(`🍀 Flowers gathered: ${d.collectedFlowersCount} / ${d.totalFlowersCount}`);
  }

  if (scene.hudLocationText) {
    scene.hudLocationText.setText(`📍 Loc: ${d.currentLocation}`);
  }
}

// In-game animated notifications (replaces DOM toasts)
function triggerPhaserNotification(scene, title, message) {
  const tc = scene.toastContainer;
  if (!tc) return;

  scene.toastTitle.setText(title);
  scene.toastMsg.setText(message);

  // Stop previous notification tweens if running
  if (scene.toastTween) scene.toastTween.remove();

  tc.setAlpha(0);
  tc.y = 520;

  scene.toastTween = scene.tweens.add({
    targets: tc,
    alpha: 1,
    y: 500,
    duration: 300,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      // Hold display, then slide down and fade
      scene.time.delayedCall(3000, () => {
        scene.tweens.add({
          targets: tc,
          alpha: 0,
          y: 520,
          duration: 300
        });
      });
    }
  });
}

// Fountain Wishing logic & particle burst
function triggerFountainWish(scene) {
  if (scene.roomData.fountain) {
    // Blast glowing drops upwards programmatically
    for (let i = 0; i < 30; i++) {
      const drop = scene.add.circle(800, 360, Phaser.Math.Between(4, 9), 0x73fffa, 0.9);
      drop.setDepth(2000);
      
      const angle = Phaser.Math.Between(0, 360);
      const dist = Phaser.Math.Between(80, 200);
      const targetX = 800 + Math.cos(Phaser.Math.DegToRad(angle)) * dist;
      const targetY = 360 + Math.sin(Phaser.Math.DegToRad(angle)) * dist;

      scene.tweens.add({
        targets: drop,
        x: targetX,
        y: targetY - 40,
        alpha: 0,
        scale: 0.1,
        duration: 1000,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          drop.destroy();
        }
      });
    }

    const wishes = [
      "🦄 Your crown sparkles with starburst energies!",
      "🌈 A glowing rainbow grants you celestial speed!",
      "🍰 You smell fresh strawberry shortcakes in the air!",
      "🦋 A magical butterfly whispers secrets about lost unicorns...",
      "💎 The forest ground hums with mystical fairy melodies!"
    ];
    const pickedWish = wishes[Phaser.Math.Between(0, wishes.length - 1)];
    triggerPhaserNotification(scene, "💖 WISH GRANTED 💖", pickedWish);
  }
}