// --- DIALOGUE SYSTEM STATE ---
const dialogueLines = [
  "Hello there, classmate! Welcome to the Candy Classroom! I'm Mr. Elijah, your sweet guide.",
  "Today, we are learning about the physics of Gumdrop Gravity and Licorice Lines!",
  "Feel free to wander around. Look at our gorgeous Chocolate Desks and our central Gummy Lava Fountain!",
  "Oh, and if you touch the glowing Star Chest on my desk, a special math challenge might activate soon!",
  "When you're ready to leave, just step onto the striped red peppermint mat at the bottom of the room."
];

// --- EXPORT 1: World Name ---
export const name = "Candy Classroom Academy";

// --- EXPORT 2: Asset Preloader ---
export function onLoad(scene) {
  // All assets are dynamically rendered using Phaser Vector Graphics for fast loading and crisp visuals.
}

// --- EXPORT 3: World Builder ---
export function onCreate(scene) {
  // Build World bounds (1600x1200)
  scene.physics.world.setBounds(0, 0, 1600, 1200);
  scene.dialogueIndex = 0;

  // Define color palette
  const colors = {
    skyGrad1: 0x2e0854, // Deep grape purple
    skyGrad2: 0xd946ef, // Sweet fuchsia
    ground: 0xffe4e6,   // Soft candy-pink cream floor
    chocolate: 0x5c3d2e,
    frosting: 0xffffff,
    gummyPink: 0xff4d6d,
    gummyCyan: 0x00f5ff,
    gummyYellow: 0xffd700,
    candycaneRed: 0xe63946,
    chalkboard: 0x0f4c5c,
    wood: 0x8d5b4c
  };

  // --- LAYER 0: SKY, CLOUDS & HORIZON (Y: 0 - 300) ---
  const skyGfx = scene.add.graphics();
  skyGfx.setDepth(0);

  // Draw Sky Gradient
  for (let y = 0; y < 300; y += 4) {
    let ratio = y / 300;
    let color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(colors.skyGrad1),
      Phaser.Display.Color.ValueToColor(colors.skyGrad2),
      1, ratio
    );
    skyGfx.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
    skyGfx.fillRect(0, y, 1600, 4);
  }

  // Draw sugar sparkles/stars in the sky
  for (let i = 0; i < 35; i++) {
    let x = Phaser.Math.Between(10, 1590);
    let y = Phaser.Math.Between(10, 220);
    let size = Phaser.Math.Between(2, 5);
    skyGfx.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.4, 0.9));
    skyGfx.fillCircle(x, y, size);
  }

  // Draw Cotton Candy Clouds
  const drawCloud = (cx, cy, scale) => {
    skyGfx.fillStyle(0xffe3f2, 0.7);
    skyGfx.fillCircle(cx, cy, 30 * scale);
    skyGfx.fillCircle(cx - 35 * scale, cy + 5 * scale, 22 * scale);
    skyGfx.fillCircle(cx + 35 * scale, cy + 5 * scale, 22 * scale);
    skyGfx.fillCircle(cx - 15 * scale, cy - 15 * scale, 25 * scale);
    skyGfx.fillCircle(cx + 15 * scale, cy - 15 * scale, 25 * scale);
  };
  drawCloud(200, 120, 1.2);
  drawCloud(550, 80, 0.9);
  drawCloud(950, 140, 1.4);
  drawCloud(1380, 100, 1.0);

  // Draw Gingerbread / Wafer Scenery on the Horizon (Y ≈ 240-300)
  skyGfx.fillStyle(0x7c4722, 1);
  skyGfx.beginPath();
  skyGfx.moveTo(0, 300);
  skyGfx.lineTo(150, 180);
  skyGfx.lineTo(300, 300);
  skyGfx.lineTo(480, 150);
  skyGfx.lineTo(650, 300);
  skyGfx.lineTo(800, 200);
  skyGfx.lineTo(950, 300);
  skyGfx.lineTo(1150, 140);
  skyGfx.lineTo(1350, 300);
  skyGfx.lineTo(1500, 170);
  skyGfx.lineTo(1600, 300);
  skyGfx.closePath();
  skyGfx.fillPath();

  // White sugar frosting peaks on mountains
  skyGfx.fillStyle(0xffffff, 0.9);
  const peaks = [
    [150, 180, 25],
    [480, 150, 35],
    [800, 200, 20],
    [1150, 140, 40],
    [1500, 170, 25]
  ];
  peaks.forEach(p => {
    skyGfx.beginPath();
    skyGfx.moveTo(p[0] - p[2], p[1] + p[2]);
    skyGfx.lineTo(p[0], p[1]);
    skyGfx.lineTo(p[0] + p[2], p[1] + p[2]);
    skyGfx.lineTo(p[0] + p[2]/2, p[1] + p[2]/3);
    skyGfx.lineTo(p[0], p[1] + p[2]/1.5);
    skyGfx.lineTo(p[0] - p[2]/2, p[1] + p[2]/3);
    skyGfx.closePath();
    skyGfx.fillPath();
  });


  // --- LAYER 1: CLASSROOM FLOOR / MAIN AREA (Y: 300 - 1200) ---
  const floorGfx = scene.add.graphics();
  floorGfx.setDepth(1);

  // Ground / Candy Tiled Floor
  floorGfx.fillStyle(colors.ground, 1);
  floorGfx.fillRect(0, 300, 1600, 900);

  // Draw waffle wafer grid floor pattern
  floorGfx.lineStyle(2, 0xffccd5, 0.5);
  const gridSpacing = 80;
  for (let y = 300; y <= 1200; y += gridSpacing) {
    floorGfx.beginPath();
    floorGfx.moveTo(0, y);
    floorGfx.lineTo(1600, y);
    floorGfx.strokePath();
  }
  for (let x = 0; x <= 1600; x += gridSpacing) {
    floorGfx.beginPath();
    floorGfx.moveTo(x, 300);
    floorGfx.lineTo(x, 1200);
    floorGfx.strokePath();
  }

  // Draw side candy cane pillars
  const drawCandyCanePillar = (x, yStart, yEnd) => {
    const w = 35;
    const h = yEnd - yStart;
    floorGfx.fillStyle(0xfff5f5, 1);
    floorGfx.fillRect(x, yStart, w, h);
    floorGfx.lineStyle(1, 0xcca3a3, 1);
    floorGfx.strokeRect(x, yStart, w, h);

    floorGfx.fillStyle(colors.candycaneRed, 1);
    for (let sy = yStart; sy < yEnd; sy += 50) {
      floorGfx.beginPath();
      floorGfx.moveTo(x, sy);
      floorGfx.lineTo(x + w, sy + 25);
      floorGfx.lineTo(x + w, sy + 40);
      floorGfx.lineTo(x, sy + 15);
      floorGfx.closePath();
      floorGfx.fillPath();
    }
  };

  for (let xVal of [20, 1540]) {
    drawCandyCanePillar(xVal, 300, 1200);
  }

  // --- LAYER 2: THE GIANT CHALKBOARD (Y: 300-420, centered) ---
  const chalkboardContainer = scene.add.container(800, 340);
  chalkboardContainer.setDepth(1.5);

  const cbBorder = scene.add.rectangle(0, 0, 700, 180, 0x825035);
  cbBorder.setStrokeStyle(6, 0xffd700);
  const cbPlate = scene.add.rectangle(0, 0, 670, 150, colors.chalkboard);

  const cbText1 = scene.add.text(-310, -60, "TODAY'S SWEET STUDY: GUMMY PHYSICS", {
    fontSize: '20px',
    color: '#ffffff',
    fontFamily: 'Courier New, monospace',
    fontStyle: 'bold'
  });
  const cbText2 = scene.add.text(-310, -25, "1. Sweet Density: Caramel > Jelly > Marshmallow\n2. Peppermint Jet Propulsion (F = m * a_sugar)\n3. Mr. Elijah's Rule: Do NOT eat the desks!", {
    fontSize: '14px',
    color: '#a3e635',
    fontFamily: 'Courier New, monospace',
    lineSpacing: 10
  });

  const cbGraph = scene.add.graphics();
  cbGraph.lineStyle(2, 0xff69b4, 0.8);
  cbGraph.beginPath();
  cbGraph.moveTo(150, 40);
  cbGraph.lineTo(210, 40);
  cbGraph.lineTo(260, -20);
  cbGraph.lineTo(310, -40);
  cbGraph.strokePath();
  cbGraph.fillStyle(0xffff00, 1);
  cbGraph.fillCircle(310, -40, 5);

  const cbGraphLabel = scene.add.text(240, -55, "Tasty Curve", { fontSize: '10px', color: '#ffb703', fontFamily: 'monospace' });

  chalkboardContainer.add([cbBorder, cbPlate, cbText1, cbText2, cbGraph, cbGraphLabel]);


  // --- DECORATIVE OBJECTS & OBSTACLES ---
  const obstacles = scene.physics.add.staticGroup();

  const createGumdropObstacle = (x, y, radius, colorHex, accentColorHex) => {
    const container = scene.add.container(x, y);
    container.setSize(radius * 2, radius * 1.5);
    
    const baseGfx = scene.add.graphics();
    baseGfx.fillStyle(0x000000, 0.2);
    baseGfx.fillEllipse(0, radius / 2, radius * 2.2, radius);
    container.add(baseGfx);

    const mainGfx = scene.add.graphics();
    mainGfx.fillStyle(colorHex, 1);
    mainGfx.fillCircle(0, 0, radius);
    mainGfx.fillStyle(accentColorHex, 0.7);
    mainGfx.fillCircle(-radius/4, -radius/4, radius/2);
    
    mainGfx.fillStyle(0xffffff, 0.9);
    for(let i = 0; i < 6; i++) {
      let cx = Phaser.Math.Between(-radius/2, radius/2);
      let cy = Phaser.Math.Between(-radius/2, radius/2);
      mainGfx.fillCircle(cx, cy, 2);
    }
    container.add(mainGfx);

    obstacles.add(container);
    container.body.setSize(radius * 1.8, radius);
    container.body.setOffset(-radius * 0.9, 0);
    container.setDepth(y);
    return container;
  };

  createGumdropObstacle(150, 450, 40, 0xff0055, 0xff66a3);
  createGumdropObstacle(240, 480, 25, 0xffaa00, 0xffe066);
  createGumdropObstacle(1400, 450, 45, 0x00ccff, 0x66e0ff);
  createGumdropObstacle(1320, 480, 25, 0xcc00ff, 0xff66ff);

  const createLollipopTree = (x, y, scale = 1) => {
    const tree = scene.add.container(x, y);
    tree.setSize(60 * scale, 120 * scale);

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.15);
    shadow.fillEllipse(0, 50 * scale, 70 * scale, 25 * scale);
    tree.add(shadow);

    const trunk = scene.add.graphics();
    trunk.fillStyle(0xffffff, 1);
    trunk.fillRect(-10 * scale, -20 * scale, 20 * scale, 70 * scale);
    trunk.fillStyle(0xdd3333, 1);
    for (let ty = -10 * scale; ty < 50 * scale; ty += 15 * scale) {
      trunk.fillTriangle(
        -10 * scale, ty,
        10 * scale, ty + 10 * scale,
        10 * scale, ty + 15 * scale
      );
    }
    tree.add(trunk);

    const headGfx = scene.add.graphics();
    const r = 40 * scale;
    headGfx.fillStyle(0xff007f, 1);
    headGfx.fillCircle(0, -35 * scale, r);
    headGfx.lineStyle(4 * scale, 0xffffff, 0.8);
    headGfx.beginPath();
    for (let theta = 0; theta < Math.PI * 6; theta += 0.1) {
      let arm = (theta / (Math.PI * 6)) * r * 0.9;
      let sx = Math.cos(theta) * arm;
      let sy = -35 * scale + Math.sin(theta) * arm;
      if (theta === 0) headGfx.moveTo(sx, sy);
      else headGfx.lineTo(sx, sy);
    }
    headGfx.strokePath();

    headGfx.fillStyle(0xffffff, 0.4);
    headGfx.fillCircle(-12 * scale, -47 * scale, 10 * scale);
    tree.add(headGfx);

    obstacles.add(tree);
    tree.body.setSize(30 * scale, 20 * scale);
    tree.body.setOffset(-15 * scale, 40 * scale);
    tree.setDepth(y);
    return tree;
  };

  createLollipopTree(80, 580, 1.2);
  createLollipopTree(120, 800, 1.1);
  createLollipopTree(90, 1050, 1.3);
  createLollipopTree(1510, 580, 1.2);
  createLollipopTree(1470, 800, 1.1);
  createLollipopTree(1520, 1050, 1.3);


  // --- FOCAL POINT: THE CANDY LAVA FOUNTAIN ---
  const fountainContainer = scene.add.container(800, 750);
  fountainContainer.setSize(180, 140);
  fountainContainer.setDepth(750);

  const fShadow = scene.add.graphics();
  fShadow.fillStyle(0x000000, 0.25);
  fShadow.fillEllipse(0, 50, 220, 60);
  fountainContainer.add(fShadow);

  const fGfx = scene.add.graphics();
  fGfx.fillStyle(colors.chocolate, 1);
  fGfx.fillPath(fGfx.beginPath().moveTo(-90, 20).lineTo(-60, 50).lineTo(60, 50).lineTo(90, 20).closePath());
  fGfx.fillStyle(colors.frosting, 1);
  fGfx.fillEllipse(0, 18, 180, 24);
  fGfx.fillStyle(0xff0066, 1);
  fGfx.fillEllipse(0, 15, 170, 18);

  fGfx.fillStyle(colors.chocolate, 1);
  fGfx.fillRect(-20, -60, 40, 80);
  fGfx.fillStyle(colors.frosting, 1);
  fGfx.fillEllipse(0, -60, 50, 15);
  fGfx.fillStyle(0xff0066, 1);
  fGfx.fillEllipse(0, -63, 44, 10);
  fountainContainer.add(fGfx);

  const jetGfx = scene.add.graphics();
  fountainContainer.add(jetGfx);

  const fGlow = scene.add.graphics();
  fGlow.setBlendMode(Phaser.BlendModes.ADD);
  fountainContainer.add(fGlow);

  const bubbleParticles = [];
  for (let i = 0; i < 20; i++) {
    const bubble = scene.add.circle(0, 0, Phaser.Math.Between(3, 7), 0xff99bb, 0.9);
    fountainContainer.add(bubble);
    bubble.setBlendMode(Phaser.BlendModes.ADD);
    bubble.px = 0;
    bubble.py = -65;
    bubble.speedX = Phaser.Math.FloatBetween(-2, 2);
    bubble.speedY = Phaser.Math.FloatBetween(-6, -3);
    bubble.gravity = 0.2;
    bubble.alpha = 1;
    bubbleParticles.push(bubble);
  }

  scene.fountainData = {
    jetGfx: jetGfx,
    fGlow: fGlow,
    bubbles: bubbleParticles,
    timer: 0
  };

  obstacles.add(fountainContainer);
  fountainContainer.body.setSize(180, 50);
  fountainContainer.body.setOffset(-90, 10);


  // --- STUDENT CHOCOLATE DESKS ---
  const createChocolateDesk = (x, y) => {
    const desk = scene.add.container(x, y);
    desk.setSize(120, 80);

    const dSh = scene.add.graphics();
    dSh.fillStyle(0x000000, 0.15);
    dSh.fillEllipse(0, 25, 130, 40);
    desk.add(dSh);

    const dGfx = scene.add.graphics();
    dGfx.fillStyle(colors.chocolate, 1);
    dGfx.fillRect(-60, -10, 120, 30);
    dGfx.lineStyle(2, 0x422a1d, 1);
    dGfx.strokeRect(-60, -10, 120, 30);
    dGfx.beginPath();
    dGfx.moveTo(-20, -10); dGfx.lineTo(-20, 20);
    dGfx.moveTo(20, -10); dGfx.lineTo(20, 20);
    dGfx.strokePath();

    dGfx.fillStyle(0xffffff, 1);
    dGfx.fillRect(-55, 20, 8, 25);
    dGfx.fillRect(47, 20, 8, 25);
    dGfx.fillRect(-35, 10, 6, 15);
    dGfx.fillRect(29, 10, 6, 15);

    dGfx.fillStyle(0xe63946, 1);
    dGfx.fillRect(-55, 25, 8, 4);
    dGfx.fillRect(-55, 37, 8, 4);
    dGfx.fillRect(47, 25, 8, 4);
    dGfx.fillRect(47, 37, 8, 4);
    desk.add(dGfx);

    const chair = scene.add.graphics();
    chair.fillStyle(0xd4a373, 1);
    chair.fillRect(-20, 25, 40, 22);
    chair.fillRect(-20, 5, 40, 6);
    chair.fillStyle(0xfaedcd, 1);
    chair.fillRect(-20, 11, 4, 14);
    chair.fillRect(16, 11, 4, 14);
    desk.add(chair);

    obstacles.add(desk);
    desk.body.setSize(120, 50);
    desk.body.setOffset(-60, 5);
    desk.setDepth(y);
    return desk;
  };

  createChocolateDesk(350, 580);
  createChocolateDesk(1250, 580);
  createChocolateDesk(350, 780);
  createChocolateDesk(1250, 780);
  createChocolateDesk(350, 980);
  createChocolateDesk(1250, 980);


  // --- MR. ELIJAH'S DESK & STAR CHEST (GAME ANCHOR) ---
  const tDesk = scene.add.container(800, 480);
  tDesk.setSize(180, 80);
  tDesk.setDepth(480);

  const tdSh = scene.add.graphics();
  tdSh.fillStyle(0x000000, 0.2);
  tdSh.fillEllipse(0, 25, 190, 45);
  tDesk.add(tdSh);

  const tdGfx = scene.add.graphics();
  tdGfx.fillStyle(0x422a1d, 1);
  tdGfx.fillRect(-85, -5, 170, 35);
  tdGfx.fillStyle(0xff66b2, 1);
  tdGfx.fillRect(-90, -15, 180, 12);
  tdGfx.lineStyle(2, 0xffd700, 1);
  tdGfx.strokeRect(-90, -15, 180, 12);
  tdGfx.fillStyle(0xffffff, 0.9);
  tdGfx.fillCircle(0, 12, 8);
  tDesk.add(tdGfx);

  const beaker = scene.add.graphics();
  beaker.fillStyle(0x00f5ff, 0.8);
  beaker.fillTriangle(-45, -30, -35, -30, -40, -15);
  beaker.lineStyle(2, 0xffffff, 1);
  beaker.strokeTriangle(-45, -30, -35, -30, -40, -15);
  tDesk.add(beaker);

  obstacles.add(tDesk);
  tDesk.body.setSize(180, 45);
  tDesk.body.setOffset(-90, -5);

  const starChest = scene.add.container(800, 460);
  starChest.setDepth(481);

  const chestGfx = scene.add.graphics();
  chestGfx.fillStyle(0xffcc00, 1);
  chestGfx.fillRect(-20, -15, 40, 20);
  chestGfx.fillStyle(0xcc9900, 1);
  chestGfx.fillEllipse(0, -15, 40, 20);
  chestGfx.fillStyle(0xff0066, 1);
  chestGfx.fillRect(-4, -10, 8, 8);
  chestGfx.fillStyle(0xffffff, 1);
  chestGfx.fillTriangle(0, -30, -5, -22, 5, -22);
  chestGfx.fillTriangle(0, -18, -5, -26, 5, -26);
  starChest.add(chestGfx);

  const chestGlow = scene.add.graphics();
  chestGlow.setBlendMode(Phaser.BlendModes.ADD);
  chestGlow.fillStyle(0xff8800, 0.35);
  chestGlow.fillCircle(0, -12, 35);
  starChest.addAt(chestGlow, 0);

  scene.tweens.add({
    targets: chestGlow,
    scale: 1.3,
    alpha: 0.6,
    duration: 1200,
    yoyo: true,
    repeat: -1
  });

  const clickZone = scene.add.zone(800, 450, 60, 60);
  clickZone.setOrigin(0.5);
  clickZone.setInteractive({ useHandCursor: true });
  clickZone.on('pointerdown', () => {
    scene.dialogueIndex = 3;
    scene.showDialogue();
  });


  // --- TEACHER: MR. ELIJAH ---
  const teacher = scene.add.container(720, 470);
  teacher.setDepth(470);

  const tShadow = scene.add.graphics();
  tShadow.fillStyle(0x000000, 0.2);
  tShadow.fillEllipse(0, 20, 45, 15);
  teacher.add(tShadow);

  const tGfx = scene.add.graphics();
  tGfx.fillStyle(0x00a896, 1);
  tGfx.fillRect(-15, -15, 30, 35);
  tGfx.fillTriangle(-15, -15, -24, 15, -15, 15);
  tGfx.fillTriangle(15, -15, 24, 15, 15, 15);
  
  tGfx.fillStyle(0xffffff, 1);
  tGfx.fillTriangle(-5, -15, 5, -15, 0, -5);
  tGfx.fillStyle(0xe63946, 1);
  tGfx.fillTriangle(-6, -15, 0, -12, -6, -9);
  tGfx.fillTriangle(6, -15, 0, -12, 6, -9);

  tGfx.fillStyle(0xffcad4, 1);
  tGfx.fillCircle(0, -28, 14);

  tGfx.fillStyle(0x2d3142, 1);
  tGfx.fillCircle(-5, -30, 2.5);
  tGfx.fillCircle(5, -30, 2.5);

  tGfx.lineStyle(2, 0xd946ef, 1);
  tGfx.beginPath();
  tGfx.moveTo(-4, -22);
  tGfx.lineTo(0, -18);
  tGfx.lineTo(4, -22);
  tGfx.strokePath();

  tGfx.fillStyle(0xff007f, 1);
  tGfx.fillCircle(0, -42, 12);
  tGfx.fillCircle(-8, -38, 9);
  tGfx.fillCircle(8, -38, 9);
  
  tGfx.lineStyle(3, 0xffd700, 1);
  tGfx.beginPath();
  tGfx.moveTo(18, 5);
  tGfx.lineTo(38, -15);
  tGfx.strokePath();
  teacher.add(tGfx);

  const tTagBg = scene.add.rectangle(0, -65, 90, 20, 0xff0066, 0.85).setStrokeStyle(1.5, 0xffffff);
  const tTagName = scene.add.text(0, -65, "MR. ELIJAH", {
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);
  teacher.add([tTagBg, tTagName]);

  scene.tweens.add({
    targets: teacher,
    y: 465,
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  const tClickZone = scene.add.zone(720, 450, 70, 90);
  tClickZone.setInteractive({ useHandCursor: true });
  tClickZone.on('pointerdown', () => {
    scene.dialogueIndex = 0;
    scene.showDialogue();
  });


  // --- PLAYER CHARACTER ---
  const pContainer = scene.add.container(800, 1000);
  pContainer.setSize(40, 50);

  const pShadow = scene.add.graphics();
  pShadow.fillStyle(0x000000, 0.25);
  pShadow.fillEllipse(0, 18, 38, 12);
  pContainer.add(pShadow);

  const pGfx = scene.add.graphics();
  pGfx.fillStyle(0xffd166, 1);
  pGfx.fillRect(-12, -10, 24, 25);
  pGfx.fillStyle(0x06d6a0, 1);
  pGfx.fillRect(-12, -2, 24, 4);
  pGfx.fillRect(-12, 6, 24, 4);

  pGfx.fillStyle(0xffe3e3, 1);
  pGfx.fillCircle(0, -22, 11);

  pGfx.fillStyle(0xef476f, 1);
  pGfx.fillCircle(0, -31, 10);
  pGfx.fillRect(-10, -28, 20, 4);
  pGfx.fillStyle(0xffffff, 1);
  pGfx.fillCircle(0, -36, 3);

  pGfx.fillStyle(0x118ab2, 1);
  pGfx.fillCircle(-4, -22, 2);
  pGfx.fillCircle(4, -22, 2);
  pContainer.add(pGfx);

  scene.physics.world.enable(pContainer);
  pContainer.body.setCollideWorldBounds(true);
  pContainer.body.setSize(30, 25);
  pContainer.body.setOffset(-15, 0);

  scene.physics.add.collider(pContainer, obstacles);

  scene.player = pContainer;
  scene.cameras.main.startFollow(scene.player, true, 0.1, 0.1);
  scene.cameras.main.setBounds(0, 0, 1600, 1200);

  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.wasd = scene.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D
  });


  // --- EXIT ZONE DESIGN: PEPPERMINT MAT ---
  const exitArea = scene.add.graphics();
  exitArea.setDepth(1.1);
  exitArea.fillStyle(0xffffff, 1);
  exitArea.fillRect(720, 1130, 160, 60);
  exitArea.lineStyle(4, colors.candycaneRed, 1);
  exitArea.strokeRect(720, 1130, 160, 60);

  exitArea.fillStyle(colors.candycaneRed, 1);
  for (let mx = 730; mx < 880; mx += 20) {
    exitArea.fillRect(mx, 1130, 8, 60);
  }

  const exitText = scene.add.text(800, 1115, "▲ EXIT CLASSROOM ▲", {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#ffffff',
    fontStyle: 'bold',
    backgroundColor: '#ef476f',
    padding: { x: 8, y: 3 }
  }).setOrigin(0.5);
  exitText.setDepth(1130);

  scene.tweens.add({
    targets: exitText,
    scale: 1.1,
    duration: 800,
    yoyo: true,
    repeat: -1
  });


  // --- PURE PHASER HUD & DIALOGUE SYSTEM (SCROLLFACTOR 0) ---
  const hudContainer = scene.add.container(20, 20);
  hudContainer.setScrollFactor(0);
  hudContainer.setDepth(2000);

  const hudBg = scene.add.rectangle(130, 30, 260, 60, 0x1f003a, 0.9).setStrokeStyle(2, 0xffbb00);
  const hudTitleText = scene.add.text(15, 10, "🍬 CANDY ACADEMY", { fontSize: '13px', fontStyle: 'bold', color: '#ffbb00', fontFamily: 'monospace' });
  const hudTaskText = scene.add.text(15, 30, "Find Mr. Elijah by his desk!", { fontSize: '11px', color: '#ffecff', fontFamily: 'monospace' });
  hudContainer.add([hudBg, hudTitleText, hudTaskText]);

  // Dialog screen system fixed to viewport
  const diaContainer = scene.add.container(400, 500);
  diaContainer.setScrollFactor(0);
  diaContainer.setDepth(3000);
  diaContainer.setVisible(false);

  const diaBg = scene.add.rectangle(0, 0, 550, 130, 0x1f0033, 0.95).setStrokeStyle(3, 0xff4d94);
  const diaAvatarBg = scene.add.arc(-220, 0, 32, 0, 360, false, 0xff4d94);
  const diaAvatarText = scene.add.text(-234, -14, "👨‍🏫", { fontSize: '28px' });
  const diaTitle = scene.add.text(-160, -45, "Mr. Elijah (Teacher)", { fontSize: '14px', fontStyle: 'bold', color: '#ffd700', fontFamily: 'monospace' });
  const diaText = scene.add.text(-160, -20, "", { fontSize: '12px', color: '#ffe3f2', wordWrap: { width: 380 }, fontFamily: 'monospace' });
  const diaHint = scene.add.text(120, 42, "Press [SPACE] or Click to Continue", { fontSize: '9px', color: '#ff88cc', fontStyle: 'italic', fontFamily: 'monospace' });
  
  diaContainer.add([diaBg, diaAvatarBg, diaAvatarText, diaTitle, diaText, diaHint]);

  scene.showDialogue = () => {
    diaText.setText(dialogueLines[scene.dialogueIndex]);
    diaContainer.setVisible(true);
  };

  scene.hideDialogue = () => {
    diaContainer.setVisible(false);
  };

  // Keyboard navigation for dialogue box
  scene.input.keyboard.on('keydown-SPACE', () => {
    if (diaContainer.visible) {
      scene.dialogueIndex++;
      if (scene.dialogueIndex < dialogueLines.length) {
        scene.showDialogue();
      } else {
        scene.hideDialogue();
        scene.dialogueIndex = 0;
      }
    }
  });

  // Clicking on background advances dialogue
  scene.input.on('pointerdown', (pointer) => {
    if (diaContainer.visible) {
      // Avoid firing next immediately when clicking the interactive chest icon
      if (pointer.worldX > 750 && pointer.worldX < 850 && pointer.worldY > 420 && pointer.worldY < 510) {
        return; 
      }
      scene.dialogueIndex++;
      if (scene.dialogueIndex < dialogueLines.length) {
        scene.showDialogue();
      } else {
        scene.hideDialogue();
        scene.dialogueIndex = 0;
      }
    }
  });

  // Trigger first welcoming message
  scene.time.delayedCall(800, () => {
    scene.showDialogue();
  });


  // --- EXITS AND PLAYER SETUP HANDLERS ---
  const exitZone = scene.add.zone(800, 1155, 120, 40);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  
  // Safe init of scene.roomData to guarantee no TypeError is thrown
  if (!scene.roomData) {
    scene.roomData = {};
  }
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;
}

// --- EXPORT 4: Frame Updater ---
export function onUpdate(scene) {
  // --- 1. HANDLE PLAYER CONTROLS & OBLIQUE Z-ORDERING ---
  const p = scene.player;
  const speed = 230;
  let vx = 0;
  let vy = 0;

  if (scene.cursors.left.isDown || scene.wasd.left.isDown) {
    vx = -speed;
  } else if (scene.cursors.right.isDown || scene.wasd.right.isDown) {
    vx = speed;
  }

  if (scene.cursors.up.isDown || scene.wasd.up.isDown) {
    vy = -speed;
  } else if (scene.cursors.down.isDown || scene.wasd.down.isDown) {
    vy = speed;
  }

  p.body.setVelocity(vx, vy);

  if (vx !== 0) {
    p.setAngle(vx > 0 ? 5 : -5);
  } else {
    p.setAngle(0);
  }

  p.setDepth(p.y);

  if (p.y < 350) {
    p.y = 350;
    p.body.setVelocityY(0);
  }


  // --- 2. ANIMATE THE FOCAL POINT (CANDY LAVA FOUNTAIN) ---
  const fd = scene.fountainData;
  if (fd) {
    fd.timer += 0.05;

    fd.jetGfx.clear();
    fd.fGlow.clear();

    const drawBezier = (gfx, x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1) => {
      const steps = 16;
      gfx.beginPath();
      gfx.moveTo(x0, y0);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = mt3 * x0 + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * x1;
        const y = mt3 * y0 + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * y1;
        gfx.lineTo(x, y);
      }
      gfx.strokePath();
    };

    fd.jetGfx.lineStyle(6, 0xff0066, 0.8);
    drawBezier(fd.jetGfx, 0, -60, -50, -110 + Math.sin(fd.timer)*10, -100, -30, -70, 20);
    drawBezier(fd.jetGfx, 0, -60, 50, -110 + Math.cos(fd.timer)*10, 100, -30, 70, 20);

    fd.jetGfx.lineStyle(2, 0xffe3f2, 0.9);
    drawBezier(fd.jetGfx, 0, -60, -50, -110 + Math.sin(fd.timer)*10, -100, -30, -70, 20);

    const glowRadius = 110 + Math.sin(fd.timer * 3) * 15;
    fd.fGlow.fillStyle(0xff1493, 0.2 + Math.abs(Math.sin(fd.timer)*0.08));
    fd.fGlow.fillCircle(0, -50, glowRadius);

    fd.bubbles.forEach(bubble => {
      bubble.px += bubble.speedX;
      bubble.py += bubble.speedY;
      bubble.speedY += bubble.gravity;

      bubble.x = bubble.px;
      bubble.y = bubble.py;

      if (bubble.py > 15) {
        bubble.px = Phaser.Math.Between(-15, 15);
        bubble.py = -60;
        bubble.speedX = Phaser.Math.FloatBetween(-2.5, 2.5);
        bubble.speedY = Phaser.Math.FloatBetween(-6, -3);
      }
    });
  }


  // --- 3. MANDATED EXIT ROOM VERIFICATION ---
  const d = scene.roomData;
  if (d && d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) {
      scene.exitRoom();
    }
  }
}

// --- EXPORT 5: Clean-up ---
export function onExit(scene) {
  scene.roomData = null;
}