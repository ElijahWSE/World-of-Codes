export const name = 'The Obsidian Abyss';

export const gameAnchorX = 800;
export const gameAnchorY = 700;

export function onLoad(scene) {
  scene.roomData = {
    particles: [],
    crystals: [],
    glowingRunes: [],
    anchorGlowTime: 0,
    flashlightActive: false,
    flashlightAngle: Math.PI / 2
  };
}

export function onCreate(scene) {
  scene.roomData = scene.roomData || {};
  scene.roomData.flashlightActive = false;
  scene.roomData.flashlightAngle = Math.PI / 2;

  // Map limits
  const mapW = 1600;
  const mapH = 1200;
  scene.physics.world.setBounds(0, 0, mapW, mapH);

  // Setup background graphics container
  const bgGfx = scene.add.graphics();
  bgGfx.setDepth(0);

  // --- 1. PERSPECTIVE STYLE: SKY & HORIZON (y: 0–300) ---
  for (let y = 0; y < 300; y += 4) {
    const progress = y / 300;
    const r = Math.floor(5 + (15 * progress));
    const g = Math.floor(2 + (30 * progress));
    const b = Math.floor(15 + (45 * progress));
    const color = (r << 16) + (g << 8) + b;
    bgGfx.fillStyle(color, 1);
    bgGfx.fillRect(0, y, mapW, 4);
  }

  // Add stars / cosmic dust in background sky
  bgGfx.fillStyle(0xa7f3d0, 0.4);
  for (let i = 0; i < 40; i++) {
    const sx = Phaser.Math.Between(0, mapW);
    const sy = Phaser.Math.Between(0, 260);
    const size = Phaser.Math.Between(1, 3);
    bgGfx.fillCircle(sx, sy, size);
  }

  // Draw distant purple glowing nebulae clouds
  bgGfx.fillStyle(0x4c1d95, 0.15);
  bgGfx.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i++) {
    const nx = Phaser.Math.Between(100, mapW - 100);
    const ny = Phaser.Math.Between(80, 220);
    const radX = Phaser.Math.Between(150, 300);
    bgGfx.beginPath();
    bgGfx.ellipse ? bgGfx.ellipse(nx, ny, radX, radX * 0.4, 0, 0, 360) : bgGfx.fillCircle(nx, ny, radX);
    bgGfx.fillPath();
  }
  bgGfx.setBlendMode(Phaser.BlendModes.NORMAL);

  // Mountains silhouette boundary lines (Exactly around y: 260 - 300)
  bgGfx.fillStyle(0x0e0720, 1);
  bgGfx.beginPath();
  bgGfx.moveTo(0, 300);
  let currentY = 250;
  bgGfx.lineTo(0, currentY);
  for (let x = 40; x <= mapW; x += 40) {
    currentY += Phaser.Math.Between(-15, 15);
    currentY = Phaser.Math.Clamp(currentY, 210, 280);
    bgGfx.lineTo(x, currentY);
  }
  bgGfx.lineTo(mapW, 300);
  bgGfx.closePath();
  bgGfx.fillPath();

  // Closer, darker silhouette range for depth
  bgGfx.fillStyle(0x06020c, 1);
  bgGfx.beginPath();
  bgGfx.moveTo(0, 300);
  let currentY2 = 280;
  bgGfx.lineTo(0, currentY2);
  for (let x = 60; x <= mapW; x += 60) {
    currentY2 += Phaser.Math.Between(-25, 25);
    currentY2 = Phaser.Math.Clamp(currentY2, 250, 295);
    bgGfx.lineTo(x, currentY2);
  }
  bgGfx.lineTo(mapW, 300);
  bgGfx.closePath();
  bgGfx.fillPath();

  // --- 2. THE GROUND/FLOOR (y: 300–1200) ---
  const groundGfx = scene.add.graphics();
  groundGfx.setDepth(1);
  
  // Textured gradient for floor
  for (let y = 300; y < mapH; y += 12) {
    const progress = (y - 300) / (mapH - 300);
    const r = Math.floor(4 * (1 - progress));
    const g = Math.floor(10 * (1 - progress));
    const b = Math.floor(18 * (1 - progress) + 3);
    const color = (r << 16) + (g << 8) + b;
    groundGfx.fillStyle(color, 1);
    groundGfx.fillRect(0, y, mapW, 12);
  }

  // Ground features: Draw eerie cracks and abyssal energy flow lanes on floor
  groundGfx.lineStyle(2, 0x1e1b4b, 0.4);
  for (let i = 0; i < mapW; i += 200) {
    groundGfx.beginPath();
    groundGfx.moveTo(i, 300);
    groundGfx.lineTo(i + (i - mapW/2) * 0.4, mapH);
    groundGfx.strokePath();
  }
  for (let j = 300; j < mapH; j += 150) {
    groundGfx.beginPath();
    groundGfx.moveTo(0, j);
    groundGfx.lineTo(mapW, j);
    groundGfx.strokePath();
  }

  // --- 3. CREATING RPG-STYLE OBLIQUE OBJECTS (y: 300 - 1200) ---
  scene.obstaclesGroup = scene.physics.add.staticGroup();

  const createObsidianPillar = (x, y, scale = 1) => {
    const height = 180 * scale;
    const width = 50 * scale;
    const container = scene.add.container(x, y);
    container.setDepth(y);

    const baseBox = scene.add.rectangle(0, -10, width, 30, 0x000000, 0);
    container.add(baseBox);
    scene.physics.world.enable(baseBox, Phaser.Physics.Arcade.STATIC_BODY);
    scene.obstaclesGroup.add(baseBox);

    const pilGfx = scene.add.graphics();
    pilGfx.fillStyle(0x0a0515, 1);
    pilGfx.fillRect(-width/2, -height, width, height);

    pilGfx.fillStyle(0x1a1230, 1);
    pilGfx.beginPath();
    pilGfx.moveTo(-width/2, -height);
    pilGfx.lineTo(-width/4, -height + 15);
    pilGfx.lineTo(-width/4, 0);
    pilGfx.lineTo(-width/2, 0);
    pilGfx.closePath();
    pilGfx.fillPath();

    pilGfx.fillStyle(0x2d1b4e, 1);
    pilGfx.lineStyle(2, 0x818cf8, 0.7);
    pilGfx.beginPath();
    pilGfx.moveTo(width/2, -height);
    pilGfx.lineTo(width/2, 0);
    pilGfx.strokePath();

    pilGfx.fillStyle(0xf43f5e, 0.95);
    pilGfx.fillTriangle(0, -height + 40, -width/4, -height + 70, width/4, -height + 70);
    pilGfx.fillTriangle(0, -height + 100, -width/4, -height + 70, width/4, -height + 70);

    const glowGfx = scene.add.graphics();
    glowGfx.setBlendMode(Phaser.BlendModes.ADD);
    glowGfx.fillStyle(0xec4899, 0.25);
    glowGfx.fillCircle(0, -height + 70, 30 * scale);
    container.add([pilGfx, glowGfx]);

    scene.tweens.add({
      targets: glowGfx,
      alpha: 0.05,
      duration: Phaser.Math.Between(1500, 2500),
      yoyo: true,
      repeat: -1
    });
  };

  const pillarCoordinates = [
    {x: 250, y: 400, scale: 0.9},
    {x: 1350, y: 420, scale: 0.95},
    {x: 180, y: 850, scale: 1.2},
    {x: 1420, y: 920, scale: 1.15},
    {x: 550, y: 1050, scale: 1.0},
    {x: 1100, y: 1050, scale: 1.0},
    {x: 900, y: 450, scale: 0.8}
  ];
  pillarCoordinates.forEach(p => createObsidianPillar(p.x, p.y, p.scale));

  const createAbyssCrystal = (x, y, scale = 1) => {
    const width = 40 * scale;
    const height = 120 * scale;
    const container = scene.add.container(x, y);
    container.setDepth(y);

    const crystalBase = scene.add.rectangle(0, -5, width * 0.8, 20, 0x000000, 0);
    container.add(crystalBase);
    scene.physics.world.enable(crystalBase, Phaser.Physics.Arcade.STATIC_BODY);
    scene.obstaclesGroup.add(crystalBase);

    const cryGfx = scene.add.graphics();
    cryGfx.fillStyle(0x06b6d4, 0.85);
    cryGfx.beginPath();
    cryGfx.moveTo(0, -height);
    cryGfx.lineTo(width/2, -height/2);
    cryGfx.lineTo(width/3, 0);
    cryGfx.lineTo(-width/3, 0);
    cryGfx.lineTo(-width/2, -height/2);
    cryGfx.closePath();
    cryGfx.fillPath();

    cryGfx.fillStyle(0xecfeff, 0.5);
    cryGfx.beginPath();
    cryGfx.moveTo(0, -height);
    cryGfx.lineTo(0, 0);
    cryGfx.lineTo(width/2, -height/2);
    cryGfx.closePath();
    cryGfx.fillPath();

    const crystalGlow = scene.add.graphics();
    crystalGlow.setBlendMode(Phaser.BlendModes.ADD);
    crystalGlow.fillStyle(0x06b6d4, 0.3);
    crystalGlow.fillCircle(0, -height/2, width * 1.5);
    container.add([cryGfx, crystalGlow]);

    scene.roomData.crystals.push({
      glow: crystalGlow,
      baseY: y,
      originalScale: scale
    });
  };

  const crystalCoordinates = [
    {x: 400, y: 550, scale: 0.9},
    {x: 1200, y: 580, scale: 1.0},
    {x: 320, y: 950, scale: 1.3},
    {x: 1280, y: 900, scale: 1.25},
    {x: 680, y: 350, scale: 0.8},
    {x: 950, y: 360, scale: 0.8},
    {x: 720, y: 920, scale: 1.1}
  ];
  crystalCoordinates.forEach(c => createAbyssCrystal(c.x, c.y, c.scale));

  // --- 4. ANIMATED FOCAL POINT & GAME ANCHOR (x: 800, y: 700) ---
  const coreX = 800;
  const coreY = 700;

  const anchorContainer = scene.add.container(coreX, coreY);
  anchorContainer.setDepth(coreY + 20);

  const corePlatform = scene.add.rectangle(0, 50, 140, 60, 0x000000, 0);
  anchorContainer.add(corePlatform);
  scene.physics.world.enable(corePlatform, Phaser.Physics.Arcade.STATIC_BODY);
  scene.obstaclesGroup.add(corePlatform);

  const coreBaseGfx = scene.add.graphics();
  coreBaseGfx.fillStyle(0x030712, 1);
  coreBaseGfx.fillCircle(0, 45, 70);
  coreBaseGfx.lineStyle(4, 0x6d28d9, 0.8);
  coreBaseGfx.strokeCircle(0, 45, 70);
  coreBaseGfx.fillStyle(0xd946ef, 0.7);
  for (let a = 0; a < 360; a += 45) {
    const r = 55;
    const gx = Math.cos(Phaser.Math.DegToRad(a)) * r;
    const gy = Math.sin(Phaser.Math.DegToRad(a)) * r + 45;
    coreBaseGfx.fillCircle(gx, gy, 4);
  }

  const heartGfx = scene.add.graphics();
  heartGfx.fillStyle(0xf43f5e, 0.9);
  heartGfx.beginPath();
  heartGfx.moveTo(0, -60);
  heartGfx.lineTo(40, -10);
  heartGfx.lineTo(0, 40);
  heartGfx.lineTo(-40, -10);
  heartGfx.closePath();
  heartGfx.fillPath();

  heartGfx.fillStyle(0xfff1f2, 0.4);
  heartGfx.beginPath();
  heartGfx.moveTo(0, -60);
  heartGfx.lineTo(0, 40);
  heartGfx.lineTo(40, -10);
  heartGfx.closePath();
  heartGfx.fillPath();

  const centerGlow = scene.add.graphics();
  centerGlow.setBlendMode(Phaser.BlendModes.ADD);
  centerGlow.fillStyle(0xf43f5e, 0.35);
  centerGlow.fillCircle(0, -10, 100);

  const interactText = scene.add.text(-60, 65, "🔒 [ ABYSSAL CORE ]", {
    fontFamily: "monospace",
    fontSize: "10px",
    color: "#f43f5e",
    backgroundColor: "#111827",
    padding: { x: 6, y: 3 },
    borderRadius: 4
  }).setOrigin(0.5, 0);
  interactText.setInteractive({ useHandCursor: true });
  interactText.on('pointerdown', () => {
    scene.cameras.main.shake(200, 0.015);
    interactText.setText("🔓 SYSTEM SHIELD OK");
    interactText.setStyle({ color: "#10b981" });
    
    const flash = scene.add.circle(coreX, coreY - 10, 50, 0xffffff, 0.9);
    flash.setDepth(coreY + 30).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: flash,
      scale: 6,
      alpha: 0,
      duration: 800,
      onComplete: () => flash.destroy()
    });
  });

  anchorContainer.add([coreBaseGfx, heartGfx, centerGlow, interactText]);

  scene.tweens.add({
    targets: heartGfx,
    y: -15,
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
  scene.tweens.add({
    targets: centerGlow,
    y: -15,
    scale: 1.15,
    alpha: 0.1,
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  const orbitRing1 = scene.add.graphics();
  orbitRing1.setDepth(coreY + 25).setBlendMode(Phaser.BlendModes.ADD);
  const orbitRing2 = scene.add.graphics();
  orbitRing2.setDepth(coreY + 25).setBlendMode(Phaser.BlendModes.ADD);
  
  scene.roomData.glowingRunes.push({ gfx: orbitRing1, radius: 80, speed: 0.02, angle: 0, color: 0xec4899 });
  scene.roomData.glowingRunes.push({ gfx: orbitRing2, radius: 100, speed: -0.015, angle: Math.PI, color: 0x3b82f6 });

  // --- 5. PLAYER CHARACTER GENERATION ---
  const player = scene.add.container(800, 950);
  player.setSize(32, 48);

  const charGfx = scene.add.graphics();
  charGfx.fillStyle(0x000000, 0.5);
  charGfx.fillEllipse(0, 20, 16, 8);

  charGfx.fillStyle(0x1e1b4b, 1);
  charGfx.fillRect(-14, -36, 28, 52);
  charGfx.fillStyle(0x312e81, 1);
  charGfx.fillRect(-14, -36, 6, 52);
  charGfx.fillRect(8, -36, 6, 52);

  charGfx.fillStyle(0xd946ef, 1);
  charGfx.fillCircle(-10, -32, 4);
  charGfx.fillCircle(10, -32, 4);

  charGfx.fillStyle(0x030712, 1);
  charGfx.fillCircle(0, -42, 11);
  
  charGfx.fillStyle(0x10b981, 1);
  charGfx.fillRect(-6, -44, 4, 3);
  charGfx.fillRect(2, -44, 4, 3);

  charGfx.fillStyle(0x111827, 1);
  charGfx.fillTriangle(0, -56, -11, -44, 11, -44);

  player.add(charGfx);

  scene.physics.world.enable(player);
  player.body.setCollideWorldBounds(true);
  player.body.setSize(30, 25);
  player.body.setOffset(-15, 10);

  scene.player = player;
  scene.playerGfx = charGfx;

  scene.cameras.main.setBounds(0, 0, mapW, mapH);
  scene.cameras.main.startFollow(player, true, 0.1, 0.1);
  scene.cameras.main.setZoom(1.1);

  // Movement bindings
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.wasdKeys = scene.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    right: Phaser.Input.Keyboard.KeyCodes.D
  });

  // Obstacles collision
  scene.physics.add.collider(scene.player, scene.obstaclesGroup);

  // --- 6. DRIFTING PARTICLES ---
  for (let i = 0; i < 40; i++) {
    const px = Phaser.Math.Between(100, mapW - 100);
    const py = Phaser.Math.Between(320, mapH - 50);
    const pRadius = Phaser.Math.Between(2, 5);
    const pColor = Phaser.Math.RND.pick([0x06b6d4, 0x8b5cf6, 0xec4899, 0xa7f3d0]);
    
    const particle = scene.add.circle(px, py, pRadius, pColor, 0.6);
    particle.setDepth(py + Phaser.Math.Between(-10, 10));
    particle.setBlendMode(Phaser.BlendModes.ADD);
    
    scene.roomData.particles.push({
      sprite: particle,
      speedY: Phaser.Math.FloatBetween(0.2, 0.6),
      amplitude: Phaser.Math.FloatBetween(0.4, 1.2),
      time: Phaser.Math.Between(0, 1000)
    });
  }

  // --- 7. DYNAMIC DUAL-LAYER LIGHTING SYSTEM ---
  scene.lightmapRT = scene.add.renderTexture(0, 0, 1600, 1200);
  scene.lightmapRT.setDepth(2000);

  scene.darkFillGfx = scene.make.graphics({ add: false });
  scene.lightEraserGfx = scene.make.graphics({ add: false });

  scene.volumetricLightGfx = scene.add.graphics();
  scene.volumetricLightGfx.setDepth(2001);
  scene.volumetricLightGfx.setBlendMode(Phaser.BlendModes.ADD);

  // Key "1" toggle
  scene.input.keyboard.on('keydown-ONE', () => {
    scene.roomData.flashlightActive = !scene.roomData.flashlightActive;
  });

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

  if (!scene.player) return;

  // --- Depth Sorting Dynamic Sync ---
  scene.player.setDepth(scene.player.y);

  // --- Player Controller Logic ---
  const speed = 200;
  let vx = 0;
  let vy = 0;

  if (scene.cursors.left.isDown || scene.wasdKeys.left.isDown) {
    vx = -speed;
  } else if (scene.cursors.right.isDown || scene.wasdKeys.right.isDown) {
    vx = speed;
  }

  if (scene.cursors.up.isDown || scene.wasdKeys.up.isDown) {
    vy = -speed;
  } else if (scene.cursors.down.isDown || scene.wasdKeys.down.isDown) {
    vy = speed;
  }

  scene.player.body.setVelocity(vx, vy);

  // Flashlight direction smoothing
  if (vx !== 0 || vy !== 0) {
    const targetAngle = Math.atan2(vy, vx);
    let diff = targetAngle - scene.roomData.flashlightAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    scene.roomData.flashlightAngle += diff * 0.15;

    // Bobbing walk animation
    scene.roomData.anchorGlowTime += 0.15;
    const bob = Math.sin(scene.roomData.anchorGlowTime) * 4;
    scene.playerGfx.setY(bob);
    scene.playerGfx.setAngle(Math.sin(scene.roomData.anchorGlowTime) * 5);
  } else {
    scene.playerGfx.setY(0);
    scene.playerGfx.setAngle(0);
  }

  if (scene.player.y < 310) {
    scene.player.y = 310;
    scene.player.body.setVelocityY(0);
  }

  // --- Update Lighting Masks ---
  scene.lightmapRT.clear();
  scene.darkFillGfx.clear();
  scene.lightEraserGfx.clear();
  scene.volumetricLightGfx.clear();

  // Solid darkness overlay (y >= 280)
  scene.darkFillGfx.fillStyle(0x020205, 0.98);
  scene.darkFillGfx.fillRect(0, 280, 1600, 920);
  scene.lightmapRT.draw(scene.darkFillGfx);

  // Carve Abyssal Core Light Pool
  const corePulse = 1 + Math.sin(scene.time.now * 0.0015) * 0.1;
  scene.lightEraserGfx.fillStyle(0xffffff, 0.25);
  scene.lightEraserGfx.fillCircle(800, 685, 180 * corePulse);
  scene.lightEraserGfx.fillStyle(0xffffff, 0.55);
  scene.lightEraserGfx.fillCircle(800, 685, 110 * corePulse);
  scene.lightEraserGfx.fillStyle(0xffffff, 0.95);
  scene.lightEraserGfx.fillCircle(800, 685, 50 * corePulse);

  // Carve Bioluminescent Crystals Light Pools
  const crystalPulse = 1 + Math.sin(scene.time.now * 0.002) * 0.08;
  const crystalCoords = [
    {x: 400, y: 550}, {x: 1200, y: 580}, {x: 320, y: 950},
    {x: 1280, y: 900}, {x: 680, y: 350}, {x: 950, y: 360}, {x: 720, y: 920}
  ];
  crystalCoords.forEach(c => {
    scene.lightEraserGfx.fillStyle(0xffffff, 0.25); 
    scene.lightEraserGfx.fillCircle(c.x, c.y - 15, 95 * crystalPulse);
    scene.lightEraserGfx.fillStyle(0xffffff, 0.6); 
    scene.lightEraserGfx.fillCircle(c.x, c.y - 15, 55 * crystalPulse);
    scene.lightEraserGfx.fillStyle(0xffffff, 1.0); 
    scene.lightEraserGfx.fillCircle(c.x, c.y - 15, 22 * crystalPulse);
  });

  // Carve Obsidian Pillars Ambient Core Lights
  const pillarCoords = [
    {x: 250, y: 400, h: 180 * 0.9}, {x: 1350, y: 420, h: 180 * 0.95},
    {x: 180, y: 850, h: 180 * 1.2}, {x: 1420, y: 920, h: 180 * 1.15},
    {x: 550, y: 1050, h: 180 * 1.0}, {x: 1100, y: 1050, h: 180 * 1.0},
    {x: 900, y: 450, h: 180 * 0.8}
  ];
  pillarCoords.forEach(p => {
    const py = p.y - p.h + 70;
    scene.lightEraserGfx.fillStyle(0xffffff, 0.35);
    scene.lightEraserGfx.fillCircle(p.x, py, 45);
    scene.lightEraserGfx.fillStyle(0xffffff, 0.85);
    scene.lightEraserGfx.fillCircle(p.x, py, 15);
  });

  // Carve Exit Portal gateway lights
  scene.lightEraserGfx.fillStyle(0xffffff, 0.4);
  scene.lightEraserGfx.fillCircle(800, 1155, 130);
  scene.lightEraserGfx.fillStyle(0xffffff, 0.95);
  scene.lightEraserGfx.fillCircle(800, 1155, 45);

  // Player flashlight mechanics
  const px = scene.player.x;
  const py = scene.player.y - 12;

  if (scene.roomData.flashlightActive) {
    const angle = scene.roomData.flashlightAngle;
    const beamLength = 340;
    const beamSpread = 0.52;

    scene.lightEraserGfx.fillStyle(0xffffff, 0.4); 
    scene.lightEraserGfx.fillCircle(px, py + 12, 110);
    scene.lightEraserGfx.fillStyle(0xffffff, 0.7); 
    scene.lightEraserGfx.fillCircle(px, py + 12, 70);
    scene.lightEraserGfx.fillStyle(0xffffff, 1.0); 
    scene.lightEraserGfx.fillCircle(px, py + 12, 35);

    // Volumetric cones
    scene.lightEraserGfx.fillStyle(0xffffff, 0.35);
    scene.lightEraserGfx.fillTriangle(
      px, py,
      px + Math.cos(angle - beamSpread * 1.25) * beamLength, py + Math.sin(angle - beamSpread * 1.25) * beamLength,
      px + Math.cos(angle + beamSpread * 1.25) * beamLength, py + Math.sin(angle + beamSpread * 1.25) * beamLength
    );

    scene.lightEraserGfx.fillStyle(0xffffff, 0.75);
    scene.lightEraserGfx.fillTriangle(
      px, py,
      px + Math.cos(angle - beamSpread * 0.9) * (beamLength * 1.02), py + Math.sin(angle - beamSpread * 0.9) * (beamLength * 1.02),
      px + Math.cos(angle + beamSpread * 0.9) * (beamLength * 1.02), py + Math.sin(angle + beamSpread * 0.9) * (beamLength * 1.02)
    );

    scene.lightEraserGfx.fillStyle(0xffffff, 1.0);
    scene.lightEraserGfx.fillTriangle(
      px, py,
      px + Math.cos(angle - beamSpread * 0.45) * (beamLength * 0.98), py + Math.sin(angle - beamSpread * 0.45) * (beamLength * 0.98),
      px + Math.cos(angle + beamSpread * 0.45) * (beamLength * 0.98), py + Math.sin(angle + beamSpread * 0.45) * (beamLength * 0.98)
    );

    // Additive Fog overlay
    scene.volumetricLightGfx.fillStyle(0xd97706, 0.08);
    scene.volumetricLightGfx.fillTriangle(
      px, py,
      px + Math.cos(angle - beamSpread * 1.1) * beamLength, py + Math.sin(angle - beamSpread * 1.1) * beamLength,
      px + Math.cos(angle + beamSpread * 1.1) * beamLength, py + Math.sin(angle + beamSpread * 1.1) * beamLength
    );

    scene.volumetricLightGfx.fillStyle(0xfef08a, 0.06);
    scene.volumetricLightGfx.fillTriangle(
      px, py,
      px + Math.cos(angle - beamSpread * 0.5) * (beamLength * 0.9), py + Math.sin(angle - beamSpread * 0.5) * (beamLength * 0.9),
      px + Math.cos(angle + beamSpread * 0.5) * (beamLength * 0.9), py + Math.sin(angle + beamSpread * 0.5) * (beamLength * 0.9)
    );

    scene.volumetricLightGfx.fillStyle(0xf59e0b, 0.09);
    scene.volumetricLightGfx.fillCircle(px, py + 12, 45);

  } else {
    scene.lightEraserGfx.fillStyle(0xffffff, 0.35);
    scene.lightEraserGfx.fillCircle(px, py + 12, 45);
    scene.lightEraserGfx.fillStyle(0xffffff, 0.85);
    scene.lightEraserGfx.fillCircle(px, py + 12, 12);
  }

  // Erase the masks from the dark texture
  scene.lightmapRT.erase(scene.lightEraserGfx);

  // Particles update
  scene.roomData.particles.forEach(p => {
    p.sprite.y -= p.speedY;
    p.time += 0.01;
    p.sprite.x += Math.sin(p.time) * p.amplitude;

    if (p.sprite.y < 310) {
      p.sprite.y = Phaser.Math.Between(1100, 1180);
      p.sprite.x = Phaser.Math.Between(100, 1500);
    }
    p.sprite.setDepth(p.sprite.y + 1);
  });

  // Rings update
  scene.roomData.glowingRunes.forEach((ring) => {
    ring.angle += ring.speed;
    ring.gfx.clear();
    ring.gfx.lineStyle(2, ring.color, 0.7);

    const step = 0.15;
    ring.gfx.beginPath();
    for (let theta = 0; theta <= Math.PI * 2 + step; theta += step) {
      const ox = Math.cos(theta + ring.angle) * ring.radius;
      const oy = Math.sin(theta + ring.angle) * (ring.radius * 0.35);
      const finalX = 800 + ox;
      const finalY = 685 + oy;
      
      if (theta === 0) {
        ring.gfx.moveTo(finalX, finalY);
      } else {
        ring.gfx.lineTo(finalX, finalY);
      }
    }
    ring.gfx.strokePath();

    const pulseX = 800 + Math.cos(ring.angle * 2.5) * ring.radius;
    const pulseY = 685 + Math.sin(ring.angle * 2.5) * (ring.radius * 0.35);
    ring.gfx.fillStyle(0xffffff, 0.9);
    ring.gfx.fillCircle(pulseX, pulseY, 4);
  });

  // Crystals pulse
  const pulseScale = 1 + Math.sin(scene.time.now * 0.002) * 0.15;
  scene.roomData.crystals.forEach(c => {
    c.glow.setScale(pulseScale);
    c.glow.setAlpha(0.2 + Math.sin(scene.time.now * 0.002) * 0.08);
  });
}

export function onExit(scene) {
  scene.roomData = null;
}

export function createOtherPlayer(scene, { x, y }) {
  const container = scene.add.container(x, y);
  
  const charGfx = scene.add.graphics();
  charGfx.fillStyle(0x000000, 0.5);
  charGfx.fillEllipse(0, 20, 16, 8);

  charGfx.fillStyle(0x1e1b4b, 1);
  charGfx.fillRect(-14, -36, 28, 52);
  charGfx.fillStyle(0x312e81, 1);
  charGfx.fillRect(-14, -36, 6, 52);
  charGfx.fillRect(8, -36, 6, 52);

  charGfx.fillStyle(0xd946ef, 1);
  charGfx.fillCircle(-10, -32, 4);
  charGfx.fillCircle(10, -32, 4);

  charGfx.fillStyle(0x030712, 1);
  charGfx.fillCircle(0, -42, 11);
  
  charGfx.fillStyle(0x10b981, 1);
  charGfx.fillRect(-6, -44, 4, 3);
  charGfx.fillRect(2, -44, 4, 3);

  charGfx.fillStyle(0x111827, 1);
  charGfx.fillTriangle(0, -56, -11, -44, 11, -44);

  container.add(charGfx);
  container._labelOffsetY = -60; // Just above the peaked wizard hat
  return container;
}