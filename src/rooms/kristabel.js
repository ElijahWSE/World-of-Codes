export const name = 'The Crystalline Valley of Kristabel';

export const gameAnchorX = 400;
export const gameAnchorY = 750;

export function onLoad(scene) {
  // No external assets required as we draw everything procedurally
}

export function onCreate(scene) {
  scene.roomData = {
    spores: [],
    crystals: [],
    fauna: [],
    castleColliders: []
  };

  // Define keyboard inputs
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.wasd = scene.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    interact: Phaser.Input.Keyboard.KeyCodes.E
  });

  // -----------------------------------------------------------------
  // 1. SKY & HORIZON DESIGN (y: 0–300)
  // -----------------------------------------------------------------
  const skyGfx = scene.add.graphics();
  skyGfx.setScrollFactor(0); // Fix to screen background
  
  // Horizontal gradient sky (y: 0 to 300)
  for (let y = 0; y <= 300; y += 4) {
    const ratio = y / 300;
    const r = Math.floor(18 + ratio * 80);
    const g = Math.floor(8 + ratio * 20);
    const b = Math.floor(35 + ratio * 85);
    const color = (r << 16) + (g << 8) + b;
    skyGfx.fillStyle(color, 1);
    skyGfx.fillRect(0, y, 1600, 4);
  }

  // Draw Twinkling Stars in the Sky
  for (let i = 0; i < 60; i++) {
    const sx = Phaser.Math.Between(0, 1600);
    const sy = Phaser.Math.Between(0, 240);
    const star = scene.add.circle(sx, sy, Phaser.Math.FloatBetween(1, 2.5), 0xffffff, 0.7);
    star.setScrollFactor(0.2); // Parallax drift
    scene.tweens.add({
      targets: star,
      alpha: { from: 0.2, to: 1 },
      scale: { from: 0.8, to: 1.5 },
      duration: Phaser.Math.Between(1000, 3000),
      yoyo: true,
      repeat: -1
    });
  }

  // Drifting Background Clouds
  for (let i = 0; i < 5; i++) {
    const cloudGfx = scene.add.graphics();
    cloudGfx.fillStyle(0xffa1f5, 0.15);
    cloudGfx.beginPath();
    cloudGfx.fillCircle(0, 0, 40);
    cloudGfx.fillCircle(30, -10, 50);
    cloudGfx.fillCircle(70, 0, 40);
    cloudGfx.closePath();
    cloudGfx.fillPath();

    cloudGfx.setScrollFactor(0.1);
    cloudGfx.x = Phaser.Math.Between(0, 1600);
    cloudGfx.y = Phaser.Math.Between(40, 160);

    scene.tweens.add({
      targets: cloudGfx,
      x: 1700,
      duration: Phaser.Math.Between(120000, 240000),
      repeat: -1,
      onRepeat: () => { cloudGfx.x = -100; }
    });
  }

  // Background Crystal Mountain Silhouette (y: 180 to 300)
  const mountGfx = scene.add.graphics();
  mountGfx.setScrollFactor(0.4); // Subtle parallax
  
  // Layer 1 (Back, darker, taller)
  mountGfx.fillStyle(0x280e3d, 1);
  mountGfx.beginPath();
  mountGfx.moveTo(0, 300);
  mountGfx.lineTo(150, 110);
  mountGfx.lineTo(320, 300);
  mountGfx.lineTo(480, 80);
  mountGfx.lineTo(650, 300);
  mountGfx.lineTo(850, 100);
  mountGfx.lineTo(1050, 300);
  mountGfx.lineTo(1250, 70);
  mountGfx.lineTo(1450, 300);
  mountGfx.lineTo(1600, 140);
  mountGfx.lineTo(1600, 300);
  mountGfx.closePath();
  mountGfx.fillPath();

  // Layer 2 (Front, mid-tone purple with crystalline facet designs)
  mountGfx.fillStyle(0x42165c, 1);
  mountGfx.beginPath();
  mountGfx.moveTo(0, 300);
  mountGfx.lineTo(100, 180);
  mountGfx.lineTo(250, 300);
  mountGfx.lineTo(400, 150);
  mountGfx.lineTo(580, 300);
  mountGfx.lineTo(750, 170);
  mountGfx.lineTo(950, 300);
  mountGfx.lineTo(1150, 160);
  mountGfx.lineTo(1350, 300);
  mountGfx.lineTo(1500, 190);
  mountGfx.lineTo(1600, 300);
  mountGfx.closePath();
  mountGfx.fillPath();

  // Highlight Mountain Peaks
  mountGfx.fillStyle(0xff8be6, 0.6);
  const peaks = [
    {x:100, y:180}, {x:400, y:150}, {x:750, y:170}, {x:1150, y:160}, {x:1500, y:190}
  ];
  peaks.forEach(p => {
    mountGfx.beginPath();
    mountGfx.moveTo(p.x, p.y);
    mountGfx.lineTo(p.x - 20, p.y + 35);
    mountGfx.lineTo(p.x + 20, p.y + 35);
    mountGfx.closePath();
    mountGfx.fillPath();
  });

  // -----------------------------------------------------------------
  // 2. THE GROUND & PATHWAY (y: 300–1200)
  // -----------------------------------------------------------------
  const groundBase = scene.add.graphics();
  groundBase.fillStyle(0x180b26, 1);
  groundBase.fillRect(0, 300, 1600, 900);

  for (let y = 300; y < 1200; y += 80) {
    groundBase.fillStyle(0x12071d, 0.4);
    groundBase.fillRect(0, y, 1600, 35);
  }

  const pathGfx = scene.add.graphics();
  pathGfx.fillStyle(0x3e1f5e, 0.8);
  pathGfx.lineStyle(2, 0xd946ef, 0.3);

  const pathPoints = [
    {x: 800, y: 1200, w: 200},
    {x: 750, y: 1000, w: 170},
    {x: 820, y: 800, w: 150},
    {x: 800, y: 600, w: 240}
  ];

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const curr = pathPoints[i];
    const next = pathPoints[i+1];
    pathGfx.beginPath();
    pathGfx.moveTo(curr.x - curr.w/2, curr.y);
    pathGfx.lineTo(curr.x + curr.w/2, curr.y);
    pathGfx.lineTo(next.x + next.w/2, next.y);
    pathGfx.lineTo(next.x - next.w/2, next.y);
    pathGfx.closePath();
    pathGfx.fillPath();
    pathGfx.strokePath();
  }

  pathGfx.fillCircle(800, 600, 160);
  pathGfx.strokeCircle(800, 600, 160);
  pathGfx.strokeCircle(800, 600, 170);

  // -----------------------------------------------------------------
  // 2.5 BUILD THE CRYSTALLINE CASTLE OF KRISTABEL (y: 300 - 380)
  // -----------------------------------------------------------------
  const castleBaseY = 345;
  const castleContainer = scene.add.container(800, castleBaseY);
  const casGfx = scene.add.graphics();

  casGfx.fillStyle(0x240938, 1);
  casGfx.lineStyle(3, 0xd946ef, 1);
  casGfx.fillRect(-280, -60, 160, 60);
  casGfx.strokeRect(-280, -60, 160, 60);

  casGfx.fillStyle(0xd946ef, 0.8);
  for(let bx = -280; bx < -120; bx += 32) {
    casGfx.fillRect(bx + 4, -72, 16, 12);
  }

  casGfx.fillStyle(0x240938, 1);
  casGfx.fillRect(120, -60, 160, 60);
  casGfx.strokeRect(120, -60, 160, 60);

  for(let bx = 120; bx < 280; bx += 32) {
    casGfx.fillRect(bx + 4, -72, 16, 12);
  }

  casGfx.fillStyle(0x35104e, 1);
  casGfx.fillRect(-340, -130, 65, 130);
  casGfx.strokeRect(-340, -130, 65, 130);
  casGfx.fillStyle(0x06b6d4, 0.95);
  casGfx.beginPath();
  casGfx.moveTo(-340, -130);
  casGfx.lineTo(-307, -220);
  casGfx.lineTo(-275, -130);
  casGfx.closePath();
  casGfx.fillPath();

  casGfx.fillStyle(0x35104e, 1);
  casGfx.fillRect(275, -130, 65, 130);
  casGfx.strokeRect(275, -130, 65, 130);
  casGfx.fillStyle(0x06b6d4, 0.95);
  casGfx.beginPath();
  casGfx.moveTo(275, -130);
  casGfx.lineTo(307, -220);
  casGfx.lineTo(340, -130);
  casGfx.closePath();
  casGfx.fillPath();

  casGfx.fillStyle(0x1e072f, 1);
  casGfx.fillRect(-120, -160, 240, 160);
  casGfx.strokeRect(-120, -160, 240, 160);

  casGfx.fillStyle(0xd946ef, 1);
  casGfx.beginPath();
  casGfx.moveTo(-120, -160);
  casGfx.lineTo(0, -280);
  casGfx.lineTo(120, -160);
  casGfx.closePath();
  casGfx.fillPath();

  casGfx.fillStyle(0x0a030f, 1);
  casGfx.fillRect(-40, -50, 80, 50);
  casGfx.lineStyle(3, 0x06b6d4, 1);
  casGfx.strokeRect(-40, -50, 80, 50);

  casGfx.lineStyle(2, 0xd946ef, 0.6);
  for (let gx = -30; gx <= 30; gx += 15) {
    casGfx.lineBetween(gx, -50, gx, 0);
  }
  for (let gy = -40; gy < 0; gy += 12) {
    casGfx.lineBetween(-40, gy, 40, gy);
  }

  casGfx.fillStyle(0x06b6d4, 0.95);
  casGfx.fillRect(-70, -110, 24, 40);
  casGfx.fillRect(46, -110, 24, 40);

  castleContainer.add(casGfx);
  castleContainer.setDepth(castleBaseY);

  const makeCastleCollider = (x, y, w, h) => {
    const block = scene.add.rectangle(x, y, w, h);
    scene.physics.world.enable(block, Phaser.Physics.Arcade.STATIC_BODY);
    scene.roomData.castleColliders.push(block);
  };

  makeCastleCollider(800, 320, 240, 50);
  makeCastleCollider(600, 335, 160, 30);
  makeCastleCollider(1000, 335, 160, 30);
  makeCastleCollider(490, 330, 70, 40);
  makeCastleCollider(1110, 330, 70, 40);

  // -----------------------------------------------------------------
  // 3. OBLIQUE WORLD DETAILS & DECORATIONS (y-sorted depth)
  // -----------------------------------------------------------------
  const drawCrystalTree = (tx, ty, scale = 1) => {
    const container = scene.add.container(tx, ty);

    const glowGfx = scene.add.graphics();
    glowGfx.fillStyle(0xec4899, 0.15);
    glowGfx.setBlendMode(Phaser.BlendModes.ADD);
    glowGfx.fillCircle(0, -65 * scale, 85 * scale);
    container.add(glowGfx);

    const gfx = scene.add.graphics();
    gfx.fillStyle(0x330f40, 1);
    gfx.fillRect(-15 * scale, -25 * scale, 30 * scale, 30 * scale);

    gfx.fillStyle(0xd946ef, 1);
    gfx.beginPath();
    gfx.moveTo(0, -110 * scale);
    gfx.lineTo(25 * scale, -60 * scale);
    gfx.lineTo(0, -10 * scale);
    gfx.lineTo(-25 * scale, -60 * scale);
    gfx.closePath();
    gfx.fillPath();

    gfx.fillStyle(0xf472b6, 1);
    gfx.beginPath();
    gfx.moveTo(0, -110 * scale);
    gfx.lineTo(0, -10 * scale);
    gfx.lineTo(-25 * scale, -60 * scale);
    gfx.closePath();
    gfx.fillPath();

    gfx.fillStyle(0xa21caf, 1);
    gfx.beginPath();
    gfx.moveTo(-15 * scale, -80 * scale);
    gfx.lineTo(-35 * scale, -50 * scale);
    gfx.lineTo(-15 * scale, -20 * scale);
    gfx.closePath();
    gfx.fillPath();

    gfx.fillStyle(0xf0abfc, 1);
    gfx.beginPath();
    gfx.moveTo(15 * scale, -80 * scale);
    gfx.lineTo(35 * scale, -50 * scale);
    gfx.lineTo(15 * scale, -20 * scale);
    gfx.closePath();
    gfx.fillPath();

    container.add(gfx);
    container.setDepth(ty);

    scene.tweens.add({
      targets: container,
      scaleY: 1.05,
      scaleX: 0.98,
      duration: Phaser.Math.Between(2000, 4000),
      yoyo: true,
      repeat: -1
    });

    const collider = scene.add.circle(tx, ty, 20 * scale);
    scene.physics.world.enable(collider, Phaser.Physics.Arcade.STATIC_BODY);
    scene.roomData.crystals.push(collider);
  };

  const drawCrystalCluster = (cx, cy, color, size = 1) => {
    const container = scene.add.container(cx, cy);

    const glow = scene.add.graphics();
    glow.fillStyle(color, 0.1);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.fillCircle(0, 0, 35 * size);
    container.add(glow);

    const gfx = scene.add.graphics();

    const shards = [
      { h: 50, w: 12, rot: -0.3, col: color },
      { h: 70, w: 15, rot: 0, col: Phaser.Display.Color.IntegerToColor(color).brighten(15).color },
      { h: 40, w: 10, rot: 0.4, col: Phaser.Display.Color.IntegerToColor(color).darken(15).color }
    ];

    shards.forEach(sh => {
      const cos = Math.cos(sh.rot);
      const sin = Math.sin(sh.rot);

      const rotate = (x, y) => {
        return {
          x: x * cos - y * sin,
          y: x * sin + y * cos
        };
      };

      const p1 = rotate(0, -sh.h * size);
      const p2 = rotate(sh.w * size, -sh.h * 0.5 * size);
      const p3 = rotate(0, 0);
      const p4 = rotate(-sh.w * size, -sh.h * 0.5 * size);
      
      gfx.fillStyle(sh.col, 0.9);
      gfx.beginPath();
      gfx.moveTo(p1.x, p1.y);
      gfx.lineTo(p2.x, p2.y);
      gfx.lineTo(p3.x, p3.y);
      gfx.lineTo(p4.x, p4.y);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0xffffff, 0.35);
      gfx.beginPath();
      gfx.moveTo(p1.x, p1.y);
      gfx.lineTo(p3.x, p3.y);
      gfx.lineTo(p4.x, p4.y);
      gfx.closePath();
      gfx.fillPath();
    });

    container.add(gfx);
    container.setDepth(cy);

    scene.tweens.add({
      targets: container,
      y: cy - 3,
      duration: Phaser.Math.Between(1500, 2500),
      yoyo: true,
      repeat: -1
    });
  };

  const spawnPoints = [
    {x: 200, y: 440, type: 'tree', s: 1.1},
    {x: 1350, y: 420, type: 'tree', s: 1.2},
    {x: 450, y: 500, type: 'tree', s: 0.95},
    {x: 1150, y: 520, type: 'tree', s: 1},
    {x: 250, y: 800, type: 'tree', s: 1.3},
    {x: 1400, y: 900, type: 'tree', s: 1.25},
    {x: 520, y: 1050, type: 'tree', s: 1.1},
    {x: 820, y: 440, type: 'cluster', color: 0x06b6d4, s: 0.9},
    {x: 350, y: 650, type: 'cluster', color: 0xec4899, s: 0.8},
    {x: 1220, y: 720, type: 'cluster', color: 0x8b5cf6, s: 1.1},
    {x: 700, y: 950, type: 'cluster', color: 0xd946ef, s: 0.8},
    {x: 950, y: 920, type: 'cluster', color: 0x06b6d4, s: 1.0}
  ];

  spawnPoints.forEach(pt => {
    if (pt.type === 'tree') {
      drawCrystalTree(pt.x, pt.y, pt.s);
    } else {
      drawCrystalCluster(pt.x, pt.y, pt.color, pt.s);
    }
  });

  // -----------------------------------------------------------------
  // 3.5 ADD CRYSTALLINE ANIMALS (FAUNA)
  // -----------------------------------------------------------------
  const spawnCrystalFauna = (fx, fy, species) => {
    const animal = scene.add.container(fx, fy);
    const gfx = scene.add.graphics();
    
    if (species === 'fox') {
      gfx.fillStyle(0x000000, 0.3);
      gfx.fillEllipse(0, 0, 24, 10);

      gfx.fillStyle(0xd946ef, 1);
      gfx.beginPath();
      gfx.moveTo(-16, -5);
      gfx.lineTo(10, -5);
      gfx.lineTo(15, -20);
      gfx.lineTo(-5, -22);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0xffffff, 0.8);
      gfx.beginPath();
      gfx.moveTo(-8, -5);
      gfx.lineTo(6, -5);
      gfx.lineTo(2, -14);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0xf472b6, 1);
      gfx.beginPath();
      gfx.moveTo(10, -18);
      gfx.lineTo(24, -18);
      gfx.lineTo(15, -30);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0x06b6d4, 1);
      gfx.beginPath();
      gfx.moveTo(11, -28);
      gfx.lineTo(13, -42);
      gfx.lineTo(17, -28);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0x06b6d4, 0.9);
      gfx.beginPath();
      gfx.moveTo(-15, -12);
      gfx.lineTo(-30, -22);
      gfx.lineTo(-18, -30);
      gfx.lineTo(-12, -18);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0x4a154b, 1);
      gfx.fillRect(-10, -5, 4, 8);
      gfx.fillRect(6, -5, 4, 8);

    } else if (species === 'stag') {
      gfx.fillStyle(0x000000, 0.35);
      gfx.fillEllipse(0, 0, 32, 14);

      gfx.fillStyle(0x06b6d4, 1);
      gfx.beginPath();
      gfx.moveTo(-20, -15);
      gfx.lineTo(15, -15);
      gfx.lineTo(10, -45);
      gfx.lineTo(-12, -42);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0xffffff, 0.4);
      gfx.beginPath();
      gfx.moveTo(-12, -15);
      gfx.lineTo(8, -15);
      gfx.lineTo(0, -35);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0x0891b2, 1);
      gfx.beginPath();
      gfx.moveTo(8, -40);
      gfx.lineTo(18, -40);
      gfx.lineTo(24, -75);
      gfx.lineTo(10, -75);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0x22d3ee, 1);
      gfx.beginPath();
      gfx.moveTo(10, -75);
      gfx.lineTo(28, -75);
      gfx.lineTo(22, -85);
      gfx.lineTo(14, -85);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0xd946ef, 0.95);
      gfx.beginPath();
      gfx.moveTo(14, -85);
      gfx.lineTo(6, -110);
      gfx.lineTo(12, -110);
      gfx.lineTo(18, -85);
      gfx.closePath();
      gfx.fillPath();
      gfx.beginPath();
      gfx.moveTo(20, -85);
      gfx.lineTo(32, -115);
      gfx.lineTo(26, -115);
      gfx.lineTo(16, -85);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0x164e63, 1);
      gfx.fillRect(-12, -15, 4, 18);
      gfx.fillRect(8, -15, 4, 18);
    }

    animal.add(gfx);
    scene.physics.world.enable(animal);
    animal.body.setCollideWorldBounds(true);
    
    animal.body.setSize(30, 20);
    animal.body.setOffset(-15, -10);

    animal.species = species;
    animal.nextDecisionTime = 0;
    animal.setDepth(fy);

    scene.tweens.add({
      targets: animal,
      scaleY: 1.06,
      duration: Phaser.Math.Between(1500, 2200),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    scene.roomData.fauna.push(animal);
  };

  spawnCrystalFauna(500, 480, 'fox');
  spawnCrystalFauna(1100, 850, 'stag');
  spawnCrystalFauna(350, 950, 'stag');
  spawnCrystalFauna(1200, 450, 'fox');

  // -----------------------------------------------------------------
  // 4. ANIMATED FOCAL POINT (The Kristabel Heart Beacon)
  // -----------------------------------------------------------------
  const pedestal = scene.add.container(800, 580);
  const pedGfx = scene.add.graphics();
  pedGfx.fillStyle(0x2d124d, 1);
  pedGfx.lineStyle(3, 0xf472b6, 0.8);
  pedGfx.fillRect(-45, 0, 90, 15);
  pedGfx.strokeRect(-45, 0, 90, 15);
  pedGfx.fillRect(-20, -60, 40, 60);
  pedGfx.strokeRect(-20, -60, 40, 60);
  pedGfx.fillRect(-35, -70, 70, 12);
  pedGfx.strokeRect(-35, -70, 70, 12);

  pedestal.add(pedGfx);
  pedestal.setDepth(580);

  const beacon = scene.add.container(800, 460);
  const beaconGlow = scene.add.graphics();
  beaconGlow.fillStyle(0xd946ef, 0.25);
  beaconGlow.setBlendMode(Phaser.BlendModes.ADD);
  beaconGlow.fillCircle(0, 0, 100);
  beacon.add(beaconGlow);

  const beaconGfx = scene.add.graphics();
  beaconGfx.fillStyle(0x06b6d4, 1);
  beaconGfx.beginPath();
  beaconGfx.moveTo(0, -45);
  beaconGfx.lineTo(25, 0);
  beaconGfx.lineTo(0, 45);
  beaconGfx.lineTo(-25, 0);
  beaconGfx.closePath();
  beaconGfx.fillPath();

  beaconGfx.fillStyle(0xffffff, 0.5);
  beaconGfx.beginPath();
  beaconGfx.moveTo(0, -45);
  beaconGfx.lineTo(0, 45);
  beaconGfx.lineTo(-25, 0);
  beaconGfx.closePath();
  beaconGfx.fillPath();

  beaconGfx.fillStyle(0xd946ef, 0.7);
  beaconGfx.beginPath();
  beaconGfx.moveTo(0, -25);
  beaconGfx.lineTo(13, 0);
  beaconGfx.lineTo(0, 25);
  beaconGfx.lineTo(-13, 0);
  beaconGfx.closePath();
  beaconGfx.fillPath();

  beacon.add(beaconGfx);
  beacon.setDepth(581);

  scene.tweens.add({
    targets: beacon,
    y: 435,
    scaleX: 1.15,
    scaleY: 1.15,
    duration: 2500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  // -----------------------------------------------------------------
  // 5. GAME ANCHOR OBJECT (Altar of Communion)
  // -----------------------------------------------------------------
  const altarContainer = scene.add.container(gameAnchorX, gameAnchorY);
  const altarGfx = scene.add.graphics();
  altarGfx.lineStyle(2, 0x06b6d4, 0.6);
  altarGfx.strokeCircle(0, 0, 45);
  altarGfx.fillStyle(0x1e1135, 1);
  altarGfx.lineStyle(2, 0xd946ef, 1);
  altarGfx.fillRect(-25, -30, 50, 30);
  altarGfx.strokeRect(-25, -30, 50, 30);
  altarGfx.fillStyle(0x06b6d4, 1);
  altarGfx.fillRect(-15, -40, 30, 10);
  altarGfx.fillStyle(0xffffff, 0.9);
  altarGfx.fillRect(-10, -38, 8, 6);
  altarGfx.fillRect(2, -38, 8, 6);

  altarContainer.add(altarGfx);
  altarContainer.setDepth(gameAnchorY);

  const energyOrb = scene.add.circle(gameAnchorX, gameAnchorY - 50, 6, 0xfc26ff, 1);
  energyOrb.setDepth(gameAnchorY + 1);
  scene.tweens.add({
    targets: energyOrb,
    y: gameAnchorY - 60,
    alpha: 0.5,
    duration: 1200,
    yoyo: true,
    repeat: -1
  });

  scene.roomData.anchor = {
    x: gameAnchorX,
    y: gameAnchorY,
    activated: false
  };

  // Safe in-game interactive prompt interface (No DOM elements)
  const promptText = scene.add.text(400, 680, "Press 'E' to Commune", { fontSize: '18px', fill: '#06b6d4', fontStyle: 'bold' }).setOrigin(0.5).setVisible(false).setDepth(2000).setScrollFactor(0);
  scene.roomData.promptText = promptText;

  const modal = scene.add.container(400, 300).setVisible(false).setDepth(3000).setScrollFactor(0);
  const modalBg = scene.add.rectangle(0, 0, 420, 220, 0x1e072f, 0.95);
  modalBg.setStrokeStyle(3, 0xd946ef);
  const modalTitle = scene.add.text(0, -60, "Altar of Communion", { fontSize: '22px', fill: '#f472b6', fontStyle: 'bold' }).setOrigin(0.5);
  const modalText = scene.add.text(0, 10, "You have tuned your essence with Kristabel.\nThe crystal ley lines hum with magical resonance.\n\n[Press SPACE to Close]", { fontSize: '14px', fill: '#ffffff', align: 'center' }).setOrigin(0.5);
  modal.add([modalBg, modalTitle, modalText]);
  scene.roomData.altarModal = modal;

  // -----------------------------------------------------------------
  // 6. PLAYER CHARACTER CREATION
  // -----------------------------------------------------------------
  const player = scene.add.container(800, 1000);
  const plyGfx = scene.add.graphics();
  
  plyGfx.fillStyle(0x000000, 0.4);
  plyGfx.fillEllipse(0, 0, 26, 12);

  plyGfx.fillStyle(0x6d28d9, 1);
  plyGfx.beginPath();
  plyGfx.moveTo(-15, 0);
  plyGfx.lineTo(15, 0);
  plyGfx.lineTo(10, -45);
  plyGfx.lineTo(-10, -45);
  plyGfx.closePath();
  plyGfx.fillPath();

  plyGfx.fillStyle(0xd946ef, 1);
  plyGfx.beginPath();
  plyGfx.moveTo(-12, -45);
  plyGfx.lineTo(12, -45);
  plyGfx.lineTo(0, -75);
  plyGfx.closePath();
  plyGfx.fillPath();

  plyGfx.fillStyle(0xa21caf, 1);
  plyGfx.fillRect(-16, -48, 32, 5);

  plyGfx.lineStyle(3, 0xf59e0b, 1);
  plyGfx.lineBetween(14, 5, 14, -55);
  
  plyGfx.fillStyle(0x06b6d4, 1);
  plyGfx.beginPath();
  plyGfx.moveTo(14, -68);
  plyGfx.lineTo(19, -60);
  plyGfx.lineTo(14, -52);
  plyGfx.lineTo(9, -60);
  plyGfx.closePath();
  plyGfx.fillPath();

  player.add(plyGfx);

  scene.physics.world.enable(player);
  player.body.setCollideWorldBounds(true);
  player.body.setSize(30, 16);
  player.body.setOffset(-15, -8);
  scene.player = player;

  scene.cameras.main.setBounds(0, 0, 1600, 1200);
  scene.cameras.main.startFollow(player, true, 0.08, 0.08);

  // -----------------------------------------------------------------
  // 7. COLLIDERS
  // -----------------------------------------------------------------
  scene.roomData.crystals.forEach(c => {
    scene.physics.add.collider(player, c);
  });

  scene.roomData.castleColliders.forEach(c => {
    scene.physics.add.collider(player, c);
  });

  scene.roomData.fauna.forEach(f => {
    scene.roomData.crystals.forEach(c => {
      scene.physics.add.collider(f, c);
    });
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

  // Player controls logic
  const player = scene.player;
  if (!player || !player.body) return;

  const speed = 240;
  let vx = 0;
  let vy = 0;

  if (scene.cursors.left.isDown || scene.wasd.left.isDown) {
    vx = -speed;
    player.scaleX = -1;
  } else if (scene.cursors.right.isDown || scene.wasd.right.isDown) {
    vx = speed;
    player.scaleX = 1;
  }

  if (scene.cursors.up.isDown || scene.wasd.up.isDown) {
    vy = -speed;
  } else if (scene.cursors.down.isDown || scene.wasd.down.isDown) {
    vy = speed;
  }

  player.body.setVelocity(vx, vy);

  if (player.y < 310) player.y = 310;
  if (player.y > 1195) player.y = 1195;

  player.setDepth(player.y);

  // Fauna AI
  if (d.fauna) {
    d.fauna.forEach(animal => {
      animal.setDepth(animal.y);

      if (scene.time.now > animal.nextDecisionTime) {
        animal.nextDecisionTime = scene.time.now + Phaser.Math.Between(3000, 7000);
        
        if (Phaser.Math.Between(1, 100) <= 60) {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const walkSpeed = animal.species === 'fox' ? 90 : 60;
          
          const ax = Math.cos(angle) * walkSpeed;
          const ay = Math.sin(angle) * walkSpeed;
          
          animal.body.setVelocity(ax, ay);

          if (ax > 5) {
            animal.scaleX = 1;
          } else if (ax < -5) {
            animal.scaleX = -1;
          }
        } else {
          animal.body.setVelocity(0, 0);
        }
      }

      if (animal.y < 320) { animal.y = 320; animal.body.setVelocityY(50); }
      if (animal.y > 1180) { animal.y = 1180; animal.body.setVelocityY(-50); }
      if (animal.x < 50) { animal.x = 50; animal.body.setVelocityX(50); }
      if (animal.x > 1550) { animal.x = 1550; animal.body.setVelocityX(-50); }
    });
  }

  // Heart Beacon Spores animation
  if (Phaser.Math.Between(1, 10) === 5) {
    const sx = Phaser.Math.Between(760, 840);
    const sy = Phaser.Math.Between(420, 480);
    const sporeColor = Phaser.Math.RND.pick([0x06b6d4, 0xd946ef, 0xffffff]);
    const spore = scene.add.circle(sx, sy, Phaser.Math.FloatBetween(2, 4), sporeColor, 0.8);
    spore.setBlendMode(Phaser.BlendModes.ADD);
    spore.setDepth(585);
    
    d.spores.push(spore);

    scene.tweens.add({
      targets: spore,
      x: sx + Phaser.Math.Between(-80, 80),
      y: sy - Phaser.Math.Between(100, 250),
      alpha: 0,
      scale: 0.1,
      duration: Phaser.Math.Between(3000, 5000),
      onComplete: () => {
        spore.destroy();
        const idx = d.spores.indexOf(spore);
        if (idx > -1) d.spores.splice(idx, 1);
      }
    });
  }

  // Anchor interaction
  const anchor = d.anchor;
  if (anchor) {
    const distToAnchor = Phaser.Math.Distance.Between(player.x, player.y, anchor.x, anchor.y);
    if (distToAnchor < 80) {
      if (d.promptText) d.promptText.setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(scene.wasd.interact)) {
        if (d.altarModal) d.altarModal.setVisible(true);
      }
    } else {
      if (d.promptText) d.promptText.setVisible(false);
    }

    if (scene.cursors.space.isDown && d.altarModal && d.altarModal.visible) {
      d.altarModal.setVisible(false);
    }
  }
}

export function onExit(scene) {
  scene.roomData = null;
}

// ── Uncommented because we built a themed player character above ───────
export function createOtherPlayer(scene, { x, y }) {
  const container = scene.add.container(x, y);
  const plyGfx = scene.add.graphics();
  
  plyGfx.fillStyle(0x000000, 0.4);
  plyGfx.fillEllipse(0, 0, 26, 12);

  plyGfx.fillStyle(0x6d28d9, 1);
  plyGfx.beginPath();
  plyGfx.moveTo(-15, 0);
  plyGfx.lineTo(15, 0);
  plyGfx.lineTo(10, -45);
  plyGfx.lineTo(-10, -45);
  plyGfx.closePath();
  plyGfx.fillPath();

  plyGfx.fillStyle(0xd946ef, 1);
  plyGfx.beginPath();
  plyGfx.moveTo(-12, -45);
  plyGfx.lineTo(12, -45);
  plyGfx.lineTo(0, -75);
  plyGfx.closePath();
  plyGfx.fillPath();

  plyGfx.fillStyle(0xa21caf, 1);
  plyGfx.fillRect(-16, -48, 32, 5);

  plyGfx.lineStyle(3, 0xf59e0b, 1);
  plyGfx.lineBetween(14, 5, 14, -55);
  
  plyGfx.fillStyle(0x06b6d4, 1);
  plyGfx.beginPath();
  plyGfx.moveTo(14, -68);
  plyGfx.lineTo(19, -60);
  plyGfx.lineTo(14, -52);
  plyGfx.lineTo(9, -60);
  plyGfx.closePath();
  plyGfx.fillPath();

  container.add(plyGfx);
  container._labelOffsetY = 80; // Above hat peak at -75
  return container;
}