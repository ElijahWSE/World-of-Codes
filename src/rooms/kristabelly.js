export const name = 'Danisab LAND';

export const gameAnchorX = 800;
export const gameAnchorY = 510;

export function onLoad(scene) {
  // No external assets required as everything is drawn procedurally with vectors
}

export function onCreate(scene) {
  scene.roomData = {};

  // Establish World Boundaries
  scene.cameras.main.setBounds(0, 0, 1600, 1200);
  scene.physics.world.setBounds(0, 0, 1600, 1200);

  // --- 1. RENDER PERSPECTIVE BACKGROUND (y: 0 - 300) ---
  const bgGfx = scene.add.graphics();
  bgGfx.setScrollFactor(0);
  
  // Sky Gradient
  for (let y = 0; y < 300; y += 4) {
    const ratio = y / 300;
    const r = Phaser.Math.Linear(15, 75, ratio);
    const g = Phaser.Math.Linear(15, 18, ratio);
    const b = Phaser.Math.Linear(40, 100, ratio);
    const color = (r << 16) + (g << 8) + Math.floor(b);
    bgGfx.fillStyle(color, 1);
    bgGfx.fillRect(0, y, 1600, 4);
  }

  // Celestial Sun/Moon
  const sunGlow = scene.add.graphics();
  sunGlow.setScrollFactor(0);
  sunGlow.fillStyle(0xffe066, 0.15);
  sunGlow.fillCircle(800, 120, 110);
  sunGlow.fillStyle(0xffa31a, 0.3);
  sunGlow.fillCircle(800, 120, 60);
  sunGlow.fillStyle(0xffffff, 0.9);
  sunGlow.fillCircle(800, 120, 30);
  
  scene.tweens.add({
    targets: sunGlow,
    alpha: 0.7,
    duration: 3500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // Parallax Mountain Ridge (Back)
  const mtGfxBack = scene.add.graphics();
  mtGfxBack.setScrollFactor(0.2);
  mtGfxBack.fillStyle(0x1a1235, 1);
  mtGfxBack.beginPath();
  mtGfxBack.moveTo(0, 300);
  mtGfxBack.lineTo(0, 180);
  mtGfxBack.lineTo(250, 120);
  mtGfxBack.lineTo(450, 240);
  mtGfxBack.lineTo(650, 150);
  mtGfxBack.lineTo(950, 260);
  mtGfxBack.lineTo(1200, 100);
  mtGfxBack.lineTo(1450, 220);
  mtGfxBack.lineTo(1600, 160);
  mtGfxBack.lineTo(1600, 300);
  mtGfxBack.closePath();
  mtGfxBack.fillPath();

  // Parallax Mountain Ridge (Front)
  const mtGfxFront = scene.add.graphics();
  mtGfxFront.setScrollFactor(0.45);
  mtGfxFront.fillStyle(0x1e204a, 1);
  mtGfxFront.beginPath();
  mtGfxFront.moveTo(0, 300);
  mtGfxFront.lineTo(0, 220);
  mtGfxFront.lineTo(350, 170);
  mtGfxFront.lineTo(700, 270);
  mtGfxFront.lineTo(850, 210);
  mtGfxFront.lineTo(1100, 290);
  mtGfxFront.lineTo(1350, 190);
  mtGfxFront.lineTo(1600, 250);
  mtGfxFront.lineTo(1600, 300);
  mtGfxFront.closePath();
  mtGfxFront.fillPath();

  // Distant Horizon Forest Silhouettes
  const forestGfx = scene.add.graphics();
  forestGfx.setScrollFactor(0.6);
  forestGfx.fillStyle(0x13153c, 1);
  for (let tx = 10; tx < 1600; tx += 45) {
    const h = 40 + Math.random() * 30;
    forestGfx.fillTriangle(tx, 300, tx + 15, 300 - h, tx + 30, 300);
  }

  // --- 2. RENDER PLAYABLE GROUND (y: 300 - 1200) ---
  const groundGfx = scene.add.graphics();
  groundGfx.fillStyle(0x0f152d, 1);
  groundGfx.fillRect(0, 300, 1600, 900);

  // Roads/plateaus
  groundGfx.fillStyle(0x181e3d, 1);
  groundGfx.fillRect(150, 300, 150, 900);
  groundGfx.fillRect(1300, 300, 150, 900);
  groundGfx.fillRect(150, 700, 1300, 150);

  // Glowing neon road borders
  const roadsGlow = scene.add.graphics();
  roadsGlow.lineStyle(4, 0xec4899, 0.45);
  roadsGlow.beginPath();
  roadsGlow.moveTo(150, 300);
  roadsGlow.lineTo(150, 1200);
  roadsGlow.moveTo(300, 300);
  roadsGlow.lineTo(300, 700);
  roadsGlow.moveTo(300, 850);
  roadsGlow.lineTo(300, 1200);
  roadsGlow.moveTo(1300, 300);
  roadsGlow.lineTo(1300, 700);
  roadsGlow.moveTo(1300, 850);
  roadsGlow.lineTo(1300, 1200);
  roadsGlow.moveTo(1450, 300);
  roadsGlow.lineTo(1450, 1200);
  roadsGlow.moveTo(300, 700);
  roadsGlow.lineTo(1300, 700);
  roadsGlow.moveTo(300, 850);
  roadsGlow.lineTo(1300, 850);
  roadsGlow.strokePath();

  // --- 3. THE LAKE OF DANISAB (y: 900 - 1100, x: 500 - 1100) ---
  const lakeGfx = scene.add.graphics();
  lakeGfx.fillStyle(0x083344, 0.85);
  lakeGfx.beginPath();
  lakeGfx.moveTo(500, 950);
  lakeGfx.lineTo(1100, 950);
  lakeGfx.lineTo(1050, 1100);
  lakeGfx.lineTo(550, 1100);
  lakeGfx.closePath();
  lakeGfx.fillPath();

  lakeGfx.lineStyle(5, 0x14b8a6, 0.8);
  lakeGfx.strokePath();

  // Lake Ripples
  scene.lakeWaves = [];
  for(let i = 0; i < 6; i++) {
    let rx = 580 + Math.random() * 440;
    let ry = 970 + Math.random() * 110;
    let wave = scene.add.graphics();
    wave.lineStyle(2, 0x2dd4bf, 0.7);
    wave.strokeCircle(rx, ry, 15);
    scene.lakeWaves.push({
      gfx: wave,
      x: rx,
      y: ry,
      size: 2 + Math.random() * 15
    });
  }

  // --- 4. ENVIRONMENT COLLIDERS & DECORATIONS ---
  scene.obstacles = scene.physics.add.staticGroup();

  const invisibleWall = scene.add.rectangle(800, 300, 1600, 20, 0x000000, 0);
  scene.obstacles.add(invisibleWall);

  const buildSpireTree = (x, y) => {
    const tree = scene.add.container(x, y);
    const trunk = scene.add.graphics();
    trunk.fillStyle(0x312e81, 1);
    trunk.fillRect(-8, -120, 16, 120);
    trunk.lineStyle(2, 0x818cf8, 0.8);
    trunk.strokeRect(-8, -120, 16, 120);
    
    const foliage = scene.add.graphics();
    foliage.fillStyle(0x4c1d95, 0.85);
    foliage.fillCircle(0, -100, 45);
    foliage.fillStyle(0x701a75, 0.9);
    foliage.fillCircle(0, -135, 35);
    foliage.fillStyle(0xec4899, 1);
    foliage.fillCircle(0, -165, 25);
    
    const bulb = scene.add.graphics();
    bulb.fillStyle(0xfde047, 0.9);
    bulb.fillTriangle(0, -80, -6, -65, 6, -65);
    
    tree.add([trunk, foliage, bulb]);
    tree.setSize(40, 40);
    tree.setDepth(y);

    const col = scene.add.circle(x, y - 5, 12, 0x000000, 0);
    scene.obstacles.add(col);

    scene.tweens.add({
      targets: bulb,
      y: 4,
      duration: 1200 + Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  };

  const treeCoordinates = [
    {x: 80, y: 380}, {x: 380, y: 390}, {x: 1200, y: 380}, {x: 1500, y: 400},
    {x: 100, y: 600}, {x: 420, y: 640}, {x: 1180, y: 650}, {x: 1480, y: 620},
    {x: 80, y: 900}, {x: 390, y: 920}, {x: 1210, y: 950}, {x: 1520, y: 880},
    {x: 220, y: 1120}, {x: 1380, y: 1120}
  ];
  treeCoordinates.forEach(pos => buildSpireTree(pos.x, pos.y));

  // --- 5. INTERACTIVE ARCADE ANCHOR TERMINAL ---
  const consoleContainer = scene.add.container(gameAnchorX, gameAnchorY);
  const baseGfx = scene.add.graphics();
  baseGfx.fillStyle(0x1e293b, 1);
  baseGfx.fillRect(-25, -50, 50, 50);
  baseGfx.lineStyle(2, 0x38bdf8, 1);
  baseGfx.strokeRect(-25, -50, 50, 50);
  
  const screenGfx = scene.add.graphics();
  screenGfx.fillStyle(0x0f172a, 1);
  screenGfx.fillRect(-20, -45, 40, 25);
  screenGfx.lineStyle(1.5, 0x06b6d4, 1);
  screenGfx.strokeRect(-20, -45, 40, 25);
  
  const holoGfx = scene.add.graphics();
  holoGfx.setBlendMode(Phaser.BlendModes.ADD);
  holoGfx.fillStyle(0x06b6d4, 0.4);
  holoGfx.fillTriangle(0, -90, -35, -50, 35, -50);
  holoGfx.fillStyle(0xffffff, 0.7);
  holoGfx.fillCircle(0, -75, 6);
  
  consoleContainer.add([baseGfx, screenGfx, holoGfx]);
  consoleContainer.setDepth(gameAnchorY);
  
  const consoleCol = scene.add.circle(gameAnchorX, gameAnchorY - 15, 25, 0x000000, 0);
  scene.obstacles.add(consoleCol);

  scene.tweens.add({
    targets: holoGfx,
    y: -12,
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: 'Quad.easeInOut'
  });

  scene.add.text(gameAnchorX, gameAnchorY - 110, "⚡ RUNIC CORE ⚡", {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#67e8f9',
    fontStyle: 'bold',
    backgroundColor: '#090d16',
    padding: { x: 6, y: 3 }
  }).setOrigin(0.5).setDepth(gameAnchorY + 10);

  // --- 6. FLOATING MEGALITH CORE (Focal Point) ---
  const coreX = 800;
  const coreY = 680;
  scene.megalithContainer = scene.add.container(coreX, coreY);

  const crystalGfx = scene.add.graphics();
  crystalGfx.fillStyle(0x111827, 1);
  crystalGfx.lineStyle(3, 0xf43f5e, 1);
  const points = [
    {x: 0, y: -70},
    {x: 35, y: 0},
    {x: 0, y: 70},
    {x: -35, y: 0}
  ];
  crystalGfx.fillPoints(points, true);
  crystalGfx.strokePoints(points, true);

  const ringGfx = scene.add.graphics();
  ringGfx.setBlendMode(Phaser.BlendModes.ADD);
  ringGfx.lineStyle(2, 0xec4899, 0.4);
  ringGfx.strokeEllipse(0, 0, 80, 20);

  scene.megalithContainer.add([crystalGfx, ringGfx]);
  scene.megalithContainer.setDepth(coreY);

  scene.tweens.add({
    targets: scene.megalithContainer,
    y: coreY - 25,
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  scene.tweens.add({
    targets: ringGfx,
    angle: 360,
    duration: 6000,
    repeat: -1
  });

  const coreCol = scene.add.circle(coreX, coreY + 15, 30, 0x000000, 0);
  scene.obstacles.add(coreCol);

  // --- 6B. THE RESIDENTS: POOH BEAR & PEGUNIS ---
  // Pooh Bear
  const poohX = 1050;
  const poohY = 550;
  scene.poohContainer = scene.add.container(poohX, poohY);
  const poohArt = scene.add.graphics();
  poohArt.fillStyle(0x38bdf8, 1);
  poohArt.fillRect(-24, 0, 14, 16);
  poohArt.fillStyle(0xfabf24, 1);
  poohArt.fillCircle(-17, 0, 6);
  poohArt.fillStyle(0xf59e0b, 1); 
  poohArt.fillCircle(10, -10, 16);
  poohArt.fillStyle(0xef4444, 1);
  poohArt.fillRect(-4, -22, 28, 12);
  poohArt.fillCircle(10, -18, 11);
  poohArt.fillStyle(0xf59e0b, 1);
  poohArt.fillCircle(10, -32, 11);
  poohArt.fillCircle(2, -41, 4);
  poohArt.fillCircle(18, -41, 4);
  poohArt.fillStyle(0xd97706, 1);
  poohArt.fillCircle(10, -30, 4);
  poohArt.fillStyle(0x000000, 1);
  poohArt.fillCircle(10, -31, 1.5);
  scene.poohContainer.add(poohArt);
  scene.poohContainer.setDepth(poohY);

  const poohCollider = scene.add.circle(poohX + 8, poohY, 16, 0x000000, 0);
  scene.obstacles.add(poohCollider);

  scene.poohBubble = scene.add.text(poohX + 10, poohY - 70, "Oh bother, where's the honey?", {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: '#fef08a',
    fontStyle: 'bold',
    backgroundColor: '#1c1917',
    padding: { x: 8, y: 5 },
    borderRadius: 4
  }).setOrigin(0.5).setDepth(poohY + 20).setAlpha(0);

  // Pegunis
  const pegunisX = 260;
  const pegunisY = 480;
  scene.pegunisContainer = scene.add.container(pegunisX, pegunisY);
  const pegunisArt = scene.add.graphics();
  pegunisArt.fillStyle(0x1e1b4b, 1);
  pegunisArt.fillCircle(0, -14, 14);
  pegunisArt.fillStyle(0xffffff, 1);
  pegunisArt.fillCircle(0, -10, 9);
  pegunisArt.fillStyle(0xf97316, 1);
  pegunisArt.fillCircle(-7, 1, 4);
  pegunisArt.fillCircle(7, 1, 4);
  pegunisArt.fillTriangle(0, -16, -5, -12, 5, -12);
  pegunisArt.fillStyle(0x22d3ee, 1);
  pegunisArt.fillTriangle(0, -38, -3, -24, 3, -24);

  scene.pegunisLeftWing = scene.add.graphics();
  scene.pegunisLeftWing.fillStyle(0xffffff, 0.95);
  scene.pegunisLeftWing.beginPath();
  scene.pegunisLeftWing.moveTo(-10, -15);
  scene.pegunisLeftWing.lineTo(-24, -28);
  scene.pegunisLeftWing.lineTo(-28, -18);
  scene.pegunisLeftWing.lineTo(-20, -5);
  scene.pegunisLeftWing.lineTo(-10, -8);
  scene.pegunisLeftWing.closePath();
  scene.pegunisLeftWing.fillPath();

  scene.pegunisRightWing = scene.add.graphics();
  scene.pegunisRightWing.fillStyle(0xffffff, 0.95);
  scene.pegunisRightWing.beginPath();
  scene.pegunisRightWing.moveTo(10, -15);
  scene.pegunisRightWing.lineTo(24, -28);
  scene.pegunisRightWing.lineTo(28, -18);
  scene.pegunisRightWing.lineTo(20, -5);
  scene.pegunisRightWing.lineTo(10, -8);
  scene.pegunisRightWing.closePath();
  scene.pegunisRightWing.fillPath();

  scene.pegunisContainer.add([pegunisArt, scene.pegunisLeftWing, scene.pegunisRightWing]);
  scene.pegunisContainer.setDepth(pegunisY);

  const pegunisCollider = scene.add.circle(pegunisX, pegunisY, 15, 0x000000, 0);
  scene.obstacles.add(pegunisCollider);

  scene.pegunisBubble = scene.add.text(pegunisX, pegunisY - 70, "Squeeee! Pegasus Penguin power!", {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: '#93c5fd',
    fontStyle: 'bold',
    backgroundColor: '#0f172a',
    padding: { x: 8, y: 5 },
    borderRadius: 4
  }).setOrigin(0.5).setDepth(pegunisY + 20).setAlpha(0);

  // --- 7. AMBIENT PARTICLES ---
  scene.particles = [];
  for (let i = 0; i < 40; i++) {
    const px = Math.random() * 1600;
    const py = 300 + Math.random() * 900;
    const size = 1.5 + Math.random() * 4;
    const pGfx = scene.add.graphics();
    pGfx.fillStyle(0xf472b6, 0.7);
    pGfx.fillCircle(px, py, size);
    pGfx.setDepth(py + 10);
    scene.particles.push({
      gfx: pGfx,
      startX: px,
      startY: py,
      speedX: -0.2 - Math.random() * 0.6,
      speedY: -0.1 - Math.random() * 0.3,
      wiggleSpeed: 0.01 + Math.random() * 0.02,
      wiggleWidth: 10 + Math.random() * 20
    });
  }

  // --- 8. THEMED PLAYER CHARACTER ---
  const player = scene.add.container(800, 820);
  const bodyGfx = scene.add.graphics();
  bodyGfx.fillStyle(0xffd2a1, 1);
  bodyGfx.fillCircle(0, -32, 10);
  bodyGfx.fillStyle(0x7c3aed, 1);
  bodyGfx.fillTriangle(0, -40, -18, 5, 18, 5);
  bodyGfx.fillStyle(0xdb2777, 1);
  bodyGfx.fillRect(-10, -22, 20, 24);
  bodyGfx.fillStyle(0xfacc15, 1);
  bodyGfx.fillRect(-8, -12, 16, 4);

  const staffGfx = scene.add.graphics();
  staffGfx.fillStyle(0x78350f, 1);
  staffGfx.fillRect(14, -45, 4, 50);
  staffGfx.fillStyle(0x22d3ee, 1);
  staffGfx.fillCircle(16, -48, 6);

  player.add([bodyGfx, staffGfx]);
  player.setSize(30, 30);
  
  scene.physics.world.enable(player);
  player.body.setCollideWorldBounds(true);
  player.body.setSize(30, 20);
  player.body.setOffset(-15, -10);

  scene.player = player;
  scene.physics.add.collider(scene.player, scene.obstacles);
  scene.cameras.main.startFollow(scene.player, true, 0.1, 0.1);

  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.wasdKeys = scene.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D
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

  // --- PLAYER MOVEMENT ---
  if (scene.player && scene.player.body) {
    const speed = 250;
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

    if (vx !== 0 || vy !== 0) {
      const walkBob = Math.sin(scene.time.now * 0.015) * 5;
      scene.player.list[1].y = walkBob;
      scene.player.list[0].scaleY = 1 + Math.sin(scene.time.now * 0.015) * 0.08;
    } else {
      scene.player.list[1].y = 0;
      scene.player.list[0].scaleY = 1;
    }

    scene.player.setDepth(scene.player.y);
  }

  // --- ANIMATIONS ---
  // Lake Waves
  if (scene.lakeWaves) {
    scene.lakeWaves.forEach(w => {
      w.gfx.clear();
      w.gfx.lineStyle(1.5, 0x2dd4bf, 1 - (w.size / 30));
      w.gfx.strokeCircle(w.x, w.y, w.size);
      w.size += 0.15;
      if (w.size > 30) {
        w.size = 2;
      }
    });
  }

  // Particles
  if (scene.particles) {
    scene.particles.forEach(p => {
      p.gfx.x += p.speedX;
      p.gfx.y += p.speedY;
      const wiggle = Math.sin(scene.time.now * p.wiggleSpeed) * 0.3;
      p.gfx.x += wiggle;
      if (p.gfx.y + p.startY < 290 || p.gfx.x + p.startX < 0) {
        p.gfx.x = 0;
        p.gfx.y = 0;
        p.startY = 1200;
        p.startX = Math.random() * 1600;
      }
    });
  }

  // Megalith Pulse
  if (scene.player && scene.megalithContainer) {
    const distanceToCore = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, 800, 680);
    if (distanceToCore < 140) {
      scene.megalithContainer.list[0].setAlpha(1.0);
      scene.megalithContainer.scaleX = 1.15 + Math.sin(scene.time.now * 0.02) * 0.05;
      scene.megalithContainer.scaleY = 1.15 + Math.sin(scene.time.now * 0.02) * 0.05;
    } else {
      scene.megalithContainer.list[0].setAlpha(0.8);
      scene.megalithContainer.scaleX = 1.0;
      scene.megalithContainer.scaleY = 1.0;
    }
  }

  // Pooh Bear & Pegunis interactions
  if (scene.player) {
    // Pooh Bear Bobbing & Dialogue Bubble
    const poohBob = Math.sin(scene.time.now * 0.003) * 3;
    scene.poohContainer.y = 550 + poohBob;
    const distanceToPooh = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, scene.poohContainer.x, scene.poohContainer.y);
    if (distanceToPooh < 120) {
      scene.poohBubble.setAlpha(1);
      scene.poohBubble.y = scene.poohContainer.y - 65;
    } else {
      scene.poohBubble.setAlpha(0);
    }

    // Pegunis Floating & Flapping
    const pegunisBob = Math.sin(scene.time.now * 0.005) * 8;
    scene.pegunisContainer.y = 480 + pegunisBob;
    const wingFlap = Math.sin(scene.time.now * 0.015) * 15;
    scene.pegunisLeftWing.setAngle(wingFlap);
    scene.pegunisRightWing.setAngle(-wingFlap);
    const distanceToPegunis = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, scene.pegunisContainer.x, scene.pegunisContainer.y);
    if (distanceToPegunis < 120) {
      scene.pegunisBubble.setAlpha(1);
      scene.pegunisBubble.y = scene.pegunisContainer.y - 65;
    } else {
      scene.pegunisBubble.setAlpha(0);
    }
  }
}

export function onExit(scene) {
  scene.roomData = null;
}

export function createOtherPlayer(scene, { x, y }) {
  const container = scene.add.container(x, y);
  
  const bodyGfx = scene.add.graphics();
  bodyGfx.fillStyle(0xffd2a1, 1);
  bodyGfx.fillCircle(0, -32, 10);
  bodyGfx.fillStyle(0x7c3aed, 1);
  bodyGfx.fillTriangle(0, -40, -18, 5, 18, 5);
  bodyGfx.fillStyle(0xdb2777, 1);
  bodyGfx.fillRect(-10, -22, 20, 24);
  bodyGfx.fillStyle(0xfacc15, 1);
  bodyGfx.fillRect(-8, -12, 16, 4);

  const staffGfx = scene.add.graphics();
  staffGfx.fillStyle(0x78350f, 1);
  staffGfx.fillRect(14, -45, 4, 50);
  staffGfx.fillStyle(0x22d3ee, 1);
  staffGfx.fillCircle(16, -48, 6);

  container.add([bodyGfx, staffGfx]);
  container._labelOffsetY = 48;
  return container;
}