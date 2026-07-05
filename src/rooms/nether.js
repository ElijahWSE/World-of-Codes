// -------------------------------------------------------------
// CONSTANTS & CONFIGURATION
// -------------------------------------------------------------
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;
const HORIZON_Y = 300;

// Export the world's display name
export const name = "The Obsidian Caldera";

// -------------------------------------------------------------
// ON LOAD HOOK
// -------------------------------------------------------------
export function onLoad(scene) {
  // No external heavy raster image assets needed.
  // All visuals are procedurally rendered using Phaser's Vector Graphics.
}

// -------------------------------------------------------------
// ON CREATE HOOK (Builds the World)
// -------------------------------------------------------------
export function onCreate(scene) {
  // Initialize scene-wide data storage
  scene.roomData = scene.roomData || {};
  
  // Setup physics world boundaries
  scene.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // -------------------------------------------------------------
  // 1. SKY & HORIZON (y: 0 - 300) - Oblique Perspective Background
  // -------------------------------------------------------------
  const skyGfx = scene.add.graphics();
  skyGfx.setScrollFactor(0); // Parallax lock to screen camera

  // Sky gradient: dark slate purple shifting to fiery deep orange-red
  for (let y = 0; y < HORIZON_Y; y += 4) {
    const ratio = y / HORIZON_Y;
    const r = Math.floor(15 + ratio * 85);
    const g = Math.floor(2 + ratio * 20);
    const b = Math.floor(2 + ratio * 10);
    const color = (r << 16) + (g << 8) + b;
    skyGfx.fillStyle(color, 1.0);
    skyGfx.fillRect(0, y, WORLD_WIDTH, 4);
  }

  // Draw boiling dark ash clouds along the sky dome
  skyGfx.fillStyle(0x1a0d0d, 0.4);
  const clouds = [
    { x: 100, y: 80, r: 80 }, { x: 250, y: 60, r: 120 }, { x: 400, y: 100, r: 90 },
    { x: 700, y: 50, r: 150 }, { x: 900, y: 90, r: 110 }, { x: 1200, y: 70, r: 130 },
    { x: 1450, y: 110, r: 100 }
  ];
  clouds.forEach(c => skyGfx.fillCircle(c.x, c.y, c.r));

  // Add a giant glowing vortex of hellfire in the distance
  skyGfx.fillStyle(0xd9381e, 0.08);
  skyGfx.setBlendMode(Phaser.BlendModes.ADD);
  skyGfx.fillCircle(800, 180, 150);
  skyGfx.fillStyle(0xff8800, 0.15);
  skyGfx.fillCircle(800, 180, 70);
  skyGfx.setBlendMode(Phaser.BlendModes.NORMAL);

  // Draw jagged volcanic mountains (Y = 300) with parallax depth
  const mtnGfx = scene.add.graphics();
  mtnGfx.setScrollFactor(0.2); // Slow scrolling faraway peaks

  // Back mountain silhouettes
  mtnGfx.fillStyle(0x180000, 1.0);
  mtnGfx.beginPath();
  mtnGfx.moveTo(0, HORIZON_Y);
  const backPeaks = [
    {x: 100, y: 220}, {x: 250, y: 270}, {x: 350, y: 190}, {x: 480, y: 260},
    {x: 600, y: 150}, {x: 720, y: 280}, {x: 850, y: 210}, {x: 990, y: 250},
    {x: 1100, y: 170}, {x: 1250, y: 280}, {x: 1400, y: 200}, {x: 1600, y: HORIZON_Y}
  ];
  backPeaks.forEach(p => mtnGfx.lineTo(p.x, p.y));
  mtnGfx.lineTo(WORLD_WIDTH, HORIZON_Y);
  mtnGfx.closePath();
  mtnGfx.fillPath();

  // Front closer mountain layer (dark silhouettes with lava veins)
  const frontMtnGfx = scene.add.graphics();
  frontMtnGfx.setScrollFactor(0.4);
  frontMtnGfx.fillStyle(0x0c0000, 1.0);
  frontMtnGfx.beginPath();
  frontMtnGfx.moveTo(0, HORIZON_Y);
  const frontPeaks = [
    {x: 80, y: 260}, {x: 200, y: 220}, {x: 300, y: 290}, {x: 420, y: 210},
    {x: 550, y: 280}, {x: 650, y: 180}, {x: 780, y: 290}, {x: 920, y: 230},
    {x: 1050, y: 270}, {x: 1200, y: 190}, {x: 1350, y: 280}, {x: 1500, y: 240},
    {x: 1600, y: HORIZON_Y}
  ];
  frontPeaks.forEach(p => frontMtnGfx.lineTo(p.x, p.y));
  frontMtnGfx.lineTo(WORLD_WIDTH, HORIZON_Y);
  frontMtnGfx.closePath();
  frontMtnGfx.fillPath();

  // Highlight volcanic streams cutting down far mountains
  frontMtnGfx.lineStyle(3, 0xff3300, 0.8);
  frontMtnGfx.setBlendMode(Phaser.BlendModes.ADD);
  frontMtnGfx.beginPath();
  frontMtnGfx.moveTo(200, 222); frontMtnGfx.lineTo(215, 250); frontMtnGfx.lineTo(210, 275);
  frontMtnGfx.moveTo(650, 183); frontMtnGfx.lineTo(660, 220); frontMtnGfx.lineTo(655, 255); frontMtnGfx.lineTo(670, 290);
  frontMtnGfx.moveTo(1200, 192); frontMtnGfx.lineTo(1190, 230); frontMtnGfx.lineTo(1210, 260);
  frontMtnGfx.strokePath();
  frontMtnGfx.setBlendMode(Phaser.BlendModes.NORMAL);

  // -------------------------------------------------------------
  // 2. THE GROUND LAYER (y: 300 - 1200) - Oblique Floor & Cracks
  // -------------------------------------------------------------
  const groundGfx = scene.add.graphics();
  groundGfx.setScrollFactor(1);

  // Dark charcoal volcanic ground
  groundGfx.fillStyle(0x130e0e, 1.0);
  groundGfx.fillRect(0, HORIZON_Y, WORLD_WIDTH, WORLD_HEIGHT - HORIZON_Y);

  // Draw perspective basalt grids
  const rows = 12;
  const cols = 16;
  for (let r = 0; r < rows; r++) {
    const y = HORIZON_Y + (r * (WORLD_HEIGHT - HORIZON_Y) / rows);
    groundGfx.lineStyle(1.5 + (r * 0.2), 0x2d1108, 0.8);
    groundGfx.beginPath();
    groundGfx.moveTo(0, y);
    groundGfx.lineTo(WORLD_WIDTH, y);
    groundGfx.strokePath();
  }
  for (let c = 0; c <= cols; c++) {
    const x = (c * WORLD_WIDTH / cols);
    groundGfx.beginPath();
    groundGfx.moveTo(x, HORIZON_Y);
    groundGfx.lineTo(x + (c - cols/2) * 50, WORLD_HEIGHT); // fan outwards to simulate depth perspective
    groundGfx.strokePath();
  }

  // -------------------------------------------------------------
  // 3. ANTIMATED LAVA POOLS & SPARK GEYSERS (Focal Points)
  // -------------------------------------------------------------
  scene.lavaGfx = scene.add.graphics();
  scene.lavaGfx.setDepth(310); // Placed above basic ground tile but below characters

  // Path coordinates for glowing lava river
  scene.lavaRiverPoints = [
    {x: 100, y: 350}, {x: 250, y: 380}, {x: 400, y: 360}, {x: 550, y: 450},
    {x: 500, y: 600}, {x: 350, y: 720}, {x: 420, y: 880}, {x: 600, y: 980},
    {x: 750, y: 1020}, {x: 950, y: 1040}, {x: 1100, y: 1010}, {x: 1300, y: 1060},
    {x: 1450, y: 1120}, {x: 1550, y: 1190}
  ];

  // Animated rising embers/sparks
  scene.particles = [];
  for (let i = 0; i < 75; i++) {
    const rx = Phaser.Math.Between(50, WORLD_WIDTH - 50);
    const ry = Phaser.Math.Between(HORIZON_Y + 50, WORLD_HEIGHT - 50);
    const spark = scene.add.circle(rx, ry, Phaser.Math.Between(2, 4), 0xffaa00);
    spark.setAlpha(Phaser.Math.FloatBetween(0.3, 0.9));
    spark.setDepth(ry + 5); // RPG layering alignment
    scene.particles.push({
      obj: spark,
      speedY: Phaser.Math.FloatBetween(0.5, 1.8),
      speedX: Phaser.Math.FloatBetween(-0.4, 0.4),
      maxY: ry - Phaser.Math.Between(60, 150),
      startX: rx,
      startY: ry
    });
  }

  // Volcanic geysers
  scene.geysers = [];
  const geyserPositions = [
    {x: 250, y: 500},
    {x: 1350, y: 750},
    {x: 750, y: 450}
  ];

  geyserPositions.forEach(gp => {
    const innerCore = scene.add.circle(gp.x, gp.y, 16, 0xff3300);
    innerCore.setDepth(gp.y - 1);
    
    const outerGlow = scene.add.circle(gp.x, gp.y, 40, 0xff7700);
    outerGlow.setAlpha(0.2);
    outerGlow.setDepth(gp.y - 2);
    scene.tweens.add({
      targets: outerGlow,
      scaleX: 1.6,
      scaleY: 1.6,
      alpha: 0,
      duration: 1600,
      repeat: -1,
      yoyo: false
    });

    const bubbles = [];
    for (let b = 0; b < 4; b++) {
      const bubble = scene.add.circle(
        gp.x + Phaser.Math.Between(-15, 15), 
        gp.y + Phaser.Math.Between(-10, 10), 
        Phaser.Math.Between(4, 9), 
        0xffcc00
      );
      bubble.setDepth(gp.y + 1);
      bubble.setAlpha(0.8);
      scene.tweens.add({
        targets: bubble,
        y: gp.y - Phaser.Math.Between(30, 80),
        x: gp.x + Phaser.Math.Between(-30, 30),
        scaleX: 0.1,
        scaleY: 0.1,
        alpha: 0,
        duration: Phaser.Math.Between(800, 1500),
        repeat: -1,
        delay: b * 300
      });
      bubbles.push(bubble);
    }
    scene.geysers.push({ base: innerCore, glow: outerGlow, bubbles: bubbles });
  });

  // -------------------------------------------------------------
  // 4. SCENERY & DEPTH-SORTED OBJECTS (Basalt pillars & Burnt Trees)
  // -------------------------------------------------------------
  scene.sortableObjects = [];

  // Procedural 3D-oblique Obsidian pillars
  const createObsidianColumn = (x, y, scale = 1.0) => {
    const colGfx = scene.add.graphics();
    const colWidth = 50 * scale;
    const colHeight = 140 * scale;

    colGfx.x = x;
    colGfx.y = y;

    // Dark left side
    colGfx.fillStyle(0x15151b, 1.0);
    colGfx.beginPath();
    colGfx.moveTo(-colWidth/2, 0);
    colGfx.lineTo(-colWidth/2, -colHeight);
    colGfx.lineTo(0, -colHeight - (20 * scale));
    colGfx.lineTo(0, 0);
    colGfx.closePath();
    colGfx.fillPath();

    // Warm right side
    colGfx.fillStyle(0x28262c, 1.0);
    colGfx.beginPath();
    colGfx.moveTo(0, 0);
    colGfx.lineTo(0, -colHeight - (20 * scale));
    colGfx.lineTo(colWidth/2, -colHeight);
    colGfx.lineTo(colWidth/2, 0);
    colGfx.closePath();
    colGfx.fillPath();

    // Top horizontal face
    colGfx.fillStyle(0x3d3a43, 1.0);
    colGfx.beginPath();
    colGfx.moveTo(-colWidth/2, -colHeight);
    colGfx.lineTo(0, -colHeight - (20 * scale));
    colGfx.lineTo(colWidth/2, -colHeight);
    colGfx.lineTo(0, -colHeight + (15 * scale));
    colGfx.closePath();
    colGfx.fillPath();

    // Intricate lava cracks on basalt
    colGfx.lineStyle(2, 0xff4400, 1.0);
    colGfx.setBlendMode(Phaser.BlendModes.ADD);
    colGfx.beginPath();
    colGfx.moveTo(-5 * scale, -colHeight + (10 * scale));
    colGfx.lineTo(-10 * scale, -colHeight/2);
    colGfx.lineTo(-3 * scale, -10 * scale);
    colGfx.strokePath();
    colGfx.setBlendMode(Phaser.BlendModes.NORMAL);

    // Obstacle body base
    const collZone = scene.physics.add.image(x, y - 10, null);
    collZone.setVisible(false);
    collZone.setCircle(22 * scale);
    collZone.setImmovable(true);
    collZone.body.allowGravity = false;

    colGfx.setDepth(y);
    scene.sortableObjects.push({ gfx: colGfx, y: y, collider: collZone });
  };

  const columnCoords = [
    { x: 200, y: 450, s: 1.1 },
    { x: 300, y: 800, s: 0.95 },
    { x: 1300, y: 550, s: 1.3 },
    { x: 1450, y: 950, s: 1.2 },
    { x: 600, y: 750, s: 1.0 },
    { x: 750, y: 780, s: 0.8 },
    { x: 1100, y: 400, s: 1.05 }
  ];
  columnCoords.forEach(c => createObsidianColumn(c.x, c.y, c.s));

  // Procedural dead scorched tree branches
  const createScorchedTree = (x, y) => {
    const treeGfx = scene.add.graphics();
    treeGfx.x = x;
    treeGfx.y = y;

    // Dark Trunk
    treeGfx.fillStyle(0x0f0909, 1.0);
    treeGfx.beginPath();
    treeGfx.moveTo(-12, 0);
    treeGfx.lineTo(-6, -110);
    treeGfx.lineTo(6, -110);
    treeGfx.lineTo(12, 0);
    treeGfx.closePath();
    treeGfx.fillPath();

    // Left and right branches
    treeGfx.lineStyle(8, 0x0f0909, 1.0);
    treeGfx.beginPath();
    treeGfx.moveTo(-8, -60); treeGfx.lineTo(-32, -85); treeGfx.lineTo(-45, -80);
    treeGfx.strokePath();
    treeGfx.beginPath();
    treeGfx.moveTo(8, -80); treeGfx.lineTo(35, -105); treeGfx.lineTo(40, -125);
    treeGfx.strokePath();

    // Magma spark embers
    treeGfx.fillStyle(0xff2200, 0.85);
    treeGfx.setBlendMode(Phaser.BlendModes.ADD);
    treeGfx.fillCircle(-45, -80, 8);
    treeGfx.fillCircle(40, -125, 10);
    treeGfx.fillCircle(0, -115, 7);
    treeGfx.setBlendMode(Phaser.BlendModes.NORMAL);

    // Tree collision block
    const collZone = scene.physics.add.image(x, y - 5, null);
    collZone.setVisible(false);
    collZone.setCircle(12);
    collZone.setImmovable(true);
    collZone.body.allowGravity = false;

    treeGfx.setDepth(y);
    scene.sortableObjects.push({ gfx: treeGfx, y: y, collider: collZone });
  };

  const treeCoords = [
    { x: 450, y: 500 }, { x: 1250, y: 450 }, { x: 150, y: 900 },
    { x: 800, y: 920 }, { x: 920, y: 480 }, { x: 1380, y: 1050 }
  ];
  treeCoords.forEach(t => createScorchedTree(t.x, t.y));

  // -------------------------------------------------------------
  // 5. GAME ANCHOR (Altar of Chaos) - Located at (1000, 600)
  // -------------------------------------------------------------
  const altarX = 1000;
  const altarY = 600;

  scene.altar = scene.add.container(altarX, altarY);
  scene.altar.setDepth(altarY);

  const altarGfx = scene.add.graphics();
  // Lower step base
  altarGfx.fillStyle(0x18151f, 1.0);
  altarGfx.beginPath();
  altarGfx.moveTo(-60, 0); altarGfx.lineTo(-45, -25); altarGfx.lineTo(45, -25);
  altarGfx.lineTo(60, 0); altarGfx.lineTo(45, 20); altarGfx.lineTo(-45, 20);
  altarGfx.closePath();
  altarGfx.fillPath();

  // Upper platform
  altarGfx.fillStyle(0x292535, 1.0);
  altarGfx.beginPath();
  altarGfx.moveTo(-45, -15); altarGfx.lineTo(-35, -35); altarGfx.lineTo(35, -35);
  altarGfx.lineTo(45, -15); altarGfx.lineTo(35, 0); altarGfx.lineTo(-35, 0);
  altarGfx.closePath();
  altarGfx.fillPath();

  // Center vertical spire monolith
  altarGfx.fillStyle(0x100d14, 1.0);
  altarGfx.beginPath();
  altarGfx.moveTo(-20, -30); altarGfx.lineTo(-20, -110); altarGfx.lineTo(0, -125); altarGfx.lineTo(0, -35);
  altarGfx.closePath();
  altarGfx.fillPath();

  altarGfx.fillStyle(0x211c2a, 1.0);
  altarGfx.beginPath();
  altarGfx.moveTo(0, -35); altarGfx.lineTo(0, -125); altarGfx.lineTo(20, -110); altarGfx.lineTo(20, -30);
  altarGfx.closePath();
  altarGfx.fillPath();

  // Magical runic symbols
  altarGfx.fillStyle(0xff3300, 0.85);
  altarGfx.setBlendMode(Phaser.BlendModes.ADD);
  altarGfx.fillTriangle(0, -85, -8, -70, 8, -70);
  altarGfx.setBlendMode(Phaser.BlendModes.NORMAL);

  scene.altar.add(altarGfx);

  // Magic portal rings at base
  const magicRing = scene.add.graphics();
  magicRing.lineStyle(3, 0xff5500, 0.7);
  magicRing.setBlendMode(Phaser.BlendModes.ADD);
  magicRing.beginPath();
  let angleStep = Math.PI / 16;
  for(let a = 0; a <= Math.PI * 2 + 0.1; a += angleStep) {
    const rx = Math.cos(a) * 55;
    const ry = Math.sin(a) * 22;
    if (a === 0) magicRing.moveTo(rx, ry);
    else magicRing.lineTo(rx, ry);
  }
  magicRing.strokePath();

  const node1 = scene.add.circle(-55, 0, 6, 0xffbb00);
  const node2 = scene.add.circle(55, 0, 6, 0xffaa00);
  node1.setBlendMode(Phaser.BlendModes.ADD);
  node2.setBlendMode(Phaser.BlendModes.ADD);

  scene.altar.add(magicRing);
  scene.altar.add(node1);
  scene.altar.add(node2);

  scene.tweens.add({
    targets: [node1, node2],
    alpha: 0.4,
    duration: 1000,
    yoyo: true,
    repeat: -1
  });

  // Tap action zone
  const altarHitbox = scene.add.zone(0, -40, 120, 140);
  altarHitbox.setInteractive({ useHandCursor: true });
  scene.altar.add(altarHitbox);
  altarHitbox.on('pointerdown', () => {
    triggerAltarBurst(scene, altarX, altarY);
  });

  const altarCollider = scene.physics.add.image(altarX, altarY, null);
  altarCollider.setVisible(false);
  altarCollider.setCircle(45);
  altarCollider.setImmovable(true);
  altarCollider.body.allowGravity = false;

  scene.sortableObjects.push({ gfx: scene.altar, y: altarY, collider: altarCollider });

  // -------------------------------------------------------------
  // 6. THE CHARACTER (The Cinder Knight)
  // -------------------------------------------------------------
  scene.player = scene.add.container(800, 500);
  scene.physics.add.existing(scene.player);
  scene.player.body.setCollideWorldBounds(true);
  scene.player.body.setSize(36, 24);
  scene.player.body.setOffset(-18, -12);

  const pGfx = scene.add.graphics();
  pGfx.fillStyle(0x1e152a, 1.0);
  pGfx.fillRect(-14, -14, 28, 14); // lower armor plates

  pGfx.fillStyle(0xff4400, 1.0);
  pGfx.fillRect(-10, -36, 20, 22); // dynamic furnace heart

  pGfx.fillStyle(0x2f243a, 1.0);
  pGfx.fillRect(-16, -38, 7, 18);
  pGfx.fillRect(9, -38, 7, 18); // pauldrons

  pGfx.fillStyle(0x130e1a, 1.0);
  pGfx.fillRect(-10, -52, 20, 16); // dark helm

  pGfx.fillStyle(0xff2200, 1.0);
  pGfx.fillRect(-6, -46, 12, 4); // blazing visor

  pGfx.fillStyle(0xff5500, 0.9);
  pGfx.setBlendMode(Phaser.BlendModes.ADD);
  pGfx.fillCircle(0, -56, 7); // plumed embers
  pGfx.setBlendMode(Phaser.BlendModes.NORMAL);

  scene.player.add(pGfx);
  scene.playerSpeed = 240;

  scene.playerAura = scene.add.circle(0, -6, 24, 0xff3300);
  scene.playerAura.setAlpha(0.2);
  scene.playerAura.setBlendMode(Phaser.BlendModes.ADD);
  scene.player.add(scene.playerAura);
  scene.player.sendToBack(scene.playerAura);

  scene.tweens.add({
    targets: scene.playerAura,
    scaleX: 1.4,
    scaleY: 1.4,
    alpha: 0.05,
    duration: 900,
    yoyo: true,
    repeat: -1
  });

  // Camera settings
  scene.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  scene.cameras.main.startFollow(scene.player, true, 0.08, 0.08);

  // Physics collisions linking
  scene.sortableObjects.forEach(obj => {
    if (obj.collider) {
      scene.physics.add.collider(scene.player, obj.collider);
    }
  });

  // -------------------------------------------------------------
  // 7. CONTROLS SETUP
  // -------------------------------------------------------------
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.keys = scene.input.keyboard.addKeys({
    W: Phaser.Input.Keyboard.KeyCodes.W,
    A: Phaser.Input.Keyboard.KeyCodes.A,
    S: Phaser.Input.Keyboard.KeyCodes.S,
    D: Phaser.Input.Keyboard.KeyCodes.D
  });

  // -------------------------------------------------------------
  // 8. SOUTHERN PORTAL EXIT DESIGN (Y: 1150)
  // -------------------------------------------------------------
  const exitGateGfx = scene.add.graphics();
  exitGateGfx.fillStyle(0x3d100c, 0.9);
  exitGateGfx.fillRect(740, 1140, 120, 30);
  exitGateGfx.lineStyle(4, 0xff2200, 1.0);
  exitGateGfx.setBlendMode(Phaser.BlendModes.ADD);
  exitGateGfx.strokeRect(740, 1140, 120, 30);
  
  for(let f = 0; f < 10; f++) {
    const flame = scene.add.triangle(745 + (f * 12), 1142, -6, 0, 6, 0, 0, -20, 0xff7700);
    flame.setBlendMode(Phaser.BlendModes.ADD);
    flame.setDepth(1150);
    scene.tweens.add({
      targets: flame,
      y: flame.y - Phaser.Math.Between(5, 12),
      scaleX: 0.6,
      duration: Phaser.Math.Between(400, 700),
      yoyo: true,
      repeat: -1
    });
  }

  scene.add.text(800, 1110, "TO SAFETY", {
    fontSize: "12px",
    fontStyle: "bold",
    fill: "#ffbb00"
  }).setOrigin(0.5).setDepth(1150);

  // -------------------------------------------------------------
  // 9. SCREEN-SPACE DIAGNOSTIC HUD (Replaces HTML DOM UI Bindings)
  // -------------------------------------------------------------
  scene.hudContainer = scene.add.container(16, 16);
  scene.hudContainer.setScrollFactor(0); // Pin to camera screen overlay
  scene.hudContainer.setDepth(2000);

  const hudBg = scene.add.graphics();
  hudBg.fillStyle(0x0a0505, 0.85);
  hudBg.fillRect(0, 0, 180, 80);
  hudBg.lineStyle(1.5, 0xff5500, 0.6);
  hudBg.strokeRect(0, 0, 180, 80);
  scene.hudContainer.add(hudBg);

  const hudHeader = scene.add.text(10, 8, "CALDERA SURVEYOR", {
    fontSize: "10px",
    fontStyle: "bold",
    fill: "#ff5500"
  });
  scene.hudContainer.add(hudHeader);

  scene.hudCoords = scene.add.text(10, 26, "X: 800  Y: 500", {
    fontSize: "11px",
    fontFamily: "monospace",
    fill: "#ffffff"
  });
  scene.hudContainer.add(scene.hudCoords);

  scene.hudLayer = scene.add.text(10, 44, "Depth Layer: 500", {
    fontSize: "11px",
    fontFamily: "monospace",
    fill: "#ffaa00"
  });
  scene.hudContainer.add(scene.hudLayer);

  const hudHint = scene.add.text(10, 62, "Touch/Click the Altar", {
    fontSize: "9px",
    fill: "#888888"
  });
  scene.hudContainer.add(hudHint);

  // Required exit configurations
  const exitZone = scene.add.zone(800, 1155, 120, 40);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;
}

// -------------------------------------------------------------
// ON UPDATE HOOK (Runs Every Frame)
// -------------------------------------------------------------
export function onUpdate(scene) {
  const player = scene.player;
  if (!player) return;

  // Reset character movements
  player.body.setVelocity(0);

  let vx = 0;
  let vy = 0;

  // Track WASD and arrow input events
  if (scene.cursors.left.isDown || scene.keys.A.isDown) {
    vx = -1;
  } else if (scene.cursors.right.isDown || scene.keys.D.isDown) {
    vx = 1;
  }

  if (scene.cursors.up.isDown || scene.keys.W.isDown) {
    vy = -1;
  } else if (scene.cursors.down.isDown || scene.keys.S.isDown) {
    vy = 1;
  }

  // Handle diagonal velocity normalization
  if (vx !== 0 && vy !== 0) {
    vx *= 0.7071;
    vy *= 0.7071;
  }

  player.body.setVelocity(vx * scene.playerSpeed, vy * scene.playerSpeed);

  // Dynamic lava glowing cycles
  const time = scene.time.now;
  const pulse = Math.sin(time / 250) * 0.25 + 0.75;
  
  scene.lavaGfx.clear();
  
  // Base flow
  scene.lavaGfx.fillStyle(0x7c1404, 1.0);
  scene.lavaGfx.beginPath();
  scene.lavaGfx.moveTo(scene.lavaRiverPoints[0].x, scene.lavaRiverPoints[0].y);
  for(let i = 1; i < scene.lavaRiverPoints.length; i++) {
    scene.lavaGfx.lineTo(scene.lavaRiverPoints[i].x, scene.lavaRiverPoints[i].y);
  }
  for(let i = scene.lavaRiverPoints.length - 1; i >= 0; i--) {
    scene.lavaGfx.lineTo(scene.lavaRiverPoints[i].x + 40, scene.lavaRiverPoints[i].y + 35);
  }
  scene.lavaGfx.closePath();
  scene.lavaGfx.fillPath();

  // Highlight layer
  scene.lavaGfx.fillStyle(0xff4400, 0.45 + (pulse * 0.15));
  scene.lavaGfx.setBlendMode(Phaser.BlendModes.ADD);
  scene.lavaGfx.beginPath();
  scene.lavaGfx.moveTo(scene.lavaRiverPoints[0].x + 10, scene.lavaRiverPoints[0].y + 5);
  for(let i = 1; i < scene.lavaRiverPoints.length; i++) {
    scene.lavaGfx.lineTo(scene.lavaRiverPoints[i].x + 10, scene.lavaRiverPoints[i].y + 5);
  }
  for(let i = scene.lavaRiverPoints.length - 1; i >= 0; i--) {
    scene.lavaGfx.lineTo(scene.lavaRiverPoints[i].x + 30, scene.lavaRiverPoints[i].y + 25);
  }
  scene.lavaGfx.closePath();
  scene.lavaGfx.fillPath();
  scene.lavaGfx.setBlendMode(Phaser.BlendModes.NORMAL);

  // Update flying sparks
  scene.particles.forEach(sp => {
    sp.obj.y -= sp.speedY;
    sp.obj.x += sp.speedX;
    
    const travelRatio = (sp.obj.y - sp.maxY) / (sp.startY - sp.maxY);
    sp.obj.setAlpha(Math.max(0, travelRatio * 0.8));

    if (sp.obj.y <= sp.maxY) {
      sp.obj.y = sp.startY;
      sp.obj.x = sp.startX;
    }
  });

  // Dynamic RPG Oblique Depth-Sorting
  player.setDepth(player.y);
  scene.sortableObjects.forEach(item => {
    item.gfx.setDepth(item.y);
  });

  // Orbit magic altar rings
  if (scene.altar && scene.altar.list[1]) {
    scene.altar.list[1].rotation += 0.015;
  }

  // Keep screen-space HUD texts updated dynamically
  if (scene.hudCoords && scene.hudLayer) {
    const rx = Math.round(player.x);
    const ry = Math.round(player.y);
    scene.hudCoords.setText(`X: ${rx}  Y: ${ry}`);
    scene.hudLayer.setText(`Depth Layer: ${ry}`);
  }

  // Compulsory exit trigger logic check
  const d = scene.roomData;
  if (d && d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) {
      if (typeof scene.exitRoom === 'function') {
        scene.exitRoom();
      } else {
        // Safe internal fallback if host environment lacks custom scene.exitRoom
        player.setPosition(800, 500);
        scene.cameras.main.flash(400, 0, 150, 0);
      }
    }
  }
}

// -------------------------------------------------------------
// ON EXIT HOOK (Cleans up Assets)
// -------------------------------------------------------------
export function onExit(scene) {
  scene.roomData = null;
}

// Helper Action: Visual burst representation triggered on Altar Interaction
function triggerAltarBurst(scene, x, y) {
  scene.cameras.main.flash(400, 220, 50, 20);

  const circleCount = 6;
  for (let i = 0; i < circleCount; i++) {
    const expandCircle = scene.add.circle(x, y - 60, 5, 0xff7700);
    expandCircle.setBlendMode(Phaser.BlendModes.ADD);
    expandCircle.setDepth(y + 10);
    
    scene.tweens.add({
      targets: expandCircle,
      scaleX: Phaser.Math.Between(15, 30),
      scaleY: Phaser.Math.Between(8, 16),
      alpha: 0,
      duration: Phaser.Math.Between(600, 1000),
      onComplete: () => {
        expandCircle.destroy();
      }
    });
  }

  const popupText = scene.add.text(x, y - 160, "CHAOS POWER REVEALED!", {
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontSize: '20px',
    color: '#ffdd00',
    stroke: '#881100',
    strokeThickness: 5
  }).setOrigin(0.5).setDepth(y + 20);

  scene.tweens.add({
    targets: popupText,
    y: y - 220,
    alpha: 0,
    scaleX: 1.3,
    scaleY: 1.3,
    duration: 1200,
    onComplete: () => {
      popupText.destroy();
    }
  });
}