// High-compatibility helper to draw Cubic Bezier Curves in any version of Phaser 3
function drawCubicBezier(gfx, x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2, steps = 16) {
    gfx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        
        // Cubic Bezier mathematical formula:
        const x = mt*mt*mt*x1 + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*x2;
        const y = mt*mt*mt*y1 + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*y2;
        
        gfx.lineTo(x, y);
    }
}

// Solid body constructor to prevent compatibility errors across different Phaser configurations
function createSolidProp(scene, container, width, height, offsetX, offsetY) {
    scene.physics.add.existing(container);
    if (container.body) {
        container.body.setImmovable(true);
        if (container.body.setAllowGravity) {
            container.body.setAllowGravity(false);
        }
        container.body.setSize(width, height);
        container.body.setOffset(offsetX, offsetY);
    }
    if (scene.depthGroup) {
        scene.depthGroup.push(container);
    }
}

// Named Exports expected by the Game Sandbox
export const name = "Royal Suite & Spa Garden";

export function onLoad(scene) {
    // Procedural assets are generated dynamically inside onCreate to avoid external loading issues
}

export function onCreate(scene) {
    scene.roomData = scene.roomData || {};

    // Establish world bounds (1600px wide, 1200px tall)
    scene.physics.world.setBounds(0, 0, 1600, 1200);

    // Setup Keyboard inputs with absolute sandboxed fail-safes
    scene.cursors = null;
    scene.wasd = null;
    if (scene.input && scene.input.keyboard) {
        try {
            scene.cursors = scene.input.keyboard.createCursorKeys();
            scene.wasd = scene.input.keyboard.addKeys({
                up: Phaser.Input.Keyboard.KeyCodes.W,
                down: Phaser.Input.Keyboard.KeyCodes.S,
                left: Phaser.Input.Keyboard.KeyCodes.A,
                right: Phaser.Input.Keyboard.KeyCodes.D
            });
        } catch (e) {
            console.warn("Keyboard controls bound softly due to Sandbox restrictions.");
        }
    }

    // Initialize list of depth-sorted elements
    scene.depthGroup = [];

    // ----------------------------------------------------
    // 1. ENVIRONMENT ARTWORK (Sky & Horizon: 0 to 300)
    // ----------------------------------------------------
    const skyGfx = scene.add.graphics();
    skyGfx.setScrollFactor(0); 

    // Pastel gradient sky
    for (let i = 0; i < 30; i++) {
        const r = Math.floor(250 - i * 1.5);
        const g = Math.floor(130 + i * 2.5);
        const b = Math.floor(200 - i * 1);
        const color = (r << 16) + (g << 8) + b;
        skyGfx.fillStyle(color, 1);
        skyGfx.fillRect(0, i * 10, 1600, 10);
    }

    // Parallax mountain scenery
    const horizGfx = scene.add.graphics();
    horizGfx.setScrollFactor(0.2); 
    horizGfx.fillStyle(0xdb2777, 0.8);
    
    horizGfx.fillTriangle(0, 300, 200, 180, 400, 300);
    horizGfx.fillTriangle(300, 300, 500, 150, 700, 300);
    horizGfx.fillTriangle(600, 300, 850, 120, 1100, 300);
    horizGfx.fillTriangle(1000, 300, 1250, 160, 1500, 300);

    // Castle towers silhouette along horizon
    horizGfx.fillStyle(0xbe185d, 0.95);
    horizGfx.fillRect(250, 180, 50, 120);
    horizGfx.fillTriangle(240, 180, 275, 130, 310, 180);
    horizGfx.fillRect(1150, 170, 60, 130);
    horizGfx.fillTriangle(1140, 170, 1180, 110, 1220, 170);

    // Drifting clouds
    scene.clouds = [];
    for (let i = 0; i < 5; i++) {
        const cloudGfx = scene.add.graphics();
        cloudGfx.fillStyle(0xffffff, 0.6);
        cloudGfx.beginPath();
        cloudGfx.fillCircle(50, 50, 30);
        cloudGfx.fillCircle(90, 45, 40);
        cloudGfx.fillCircle(130, 50, 30);
        cloudGfx.fillRect(40, 60, 100, 20);
        cloudGfx.setScrollFactor(0.05 + i * 0.03);
        cloudGfx.x = Phaser.Math.Between(0, 1600);
        cloudGfx.y = Phaser.Math.Between(30, 180);
        scene.clouds.push(cloudGfx);
    }

    // ----------------------------------------------------
    // 2. THE PLAYABLE WORLD FLOOR (y: 300 to 1200)
    // ----------------------------------------------------
    const floorGfx = scene.add.graphics();
    floorGfx.fillStyle(0xfbcfe8, 1); // Soft pink wood floor base
    floorGfx.fillRect(0, 300, 1600, 900);

    // Oblique floorboard perspective lines
    floorGfx.lineStyle(2, 0xf472b6, 0.4);
    for (let y = 300; y <= 1200; y += 45) {
        floorGfx.beginPath();
        floorGfx.moveTo(0, y);
        floorGfx.lineTo(1600, y);
        floorGfx.strokePath();
    }

    // Plush bedroom carpet (Left Wing)
    floorGfx.fillStyle(0xf472b6, 0.8);
    floorGfx.fillRect(80, 380, 650, 450);
    floorGfx.lineStyle(6, 0xffe4e6, 0.9);
    floorGfx.strokeRect(80, 380, 650, 450);

    // Lounge velvet carpet (Right Wing)
    floorGfx.fillStyle(0xdb2777, 0.6);
    floorGfx.fillRect(870, 380, 650, 450);
    floorGfx.lineStyle(6, 0xfca5a5, 0.9);
    floorGfx.strokeRect(870, 380, 650, 450);

    // Main central pathway tiles
    floorGfx.fillStyle(0xfff1f2, 0.9);
    floorGfx.fillRect(600, 830, 400, 370);
    floorGfx.lineStyle(3, 0xfbcfe8, 1);
    for (let col = 600; col <= 1000; col += 50) {
        floorGfx.beginPath();
        floorGfx.moveTo(col, 830);
        floorGfx.lineTo(col, 1200);
        floorGfx.strokePath();
    }
    for (let row = 830; row <= 1200; row += 46) {
        floorGfx.beginPath();
        floorGfx.moveTo(600, row);
        floorGfx.lineTo(1000, row);
        floorGfx.strokePath();
    }

    // ----------------------------------------------------
    // 3. DOLLHOUSE FURNITURE & PROPS
    // ----------------------------------------------------

    // 3.1 PRINCESS CANOPY BED
    const bed = scene.add.container(250, 520);
    const bedGfx = scene.add.graphics();
    bedGfx.fillStyle(0xdb2777, 1);
    bedGfx.fillCircle(0, -60, 40);
    bedGfx.fillCircle(-40, -50, 25);
    bedGfx.fillCircle(40, -50, 25);
    bedGfx.fillRect(-65, -50, 130, 70);
    bedGfx.fillStyle(0xfff1f2, 1);
    bedGfx.fillRect(-60, -10, 120, 110);
    bedGfx.fillStyle(0xf472b6, 1);
    bedGfx.fillRect(-60, 30, 120, 70);
    bedGfx.fillStyle(0xdb2777, 1);
    bedGfx.fillRect(-45, -20, 35, 20);
    bedGfx.fillRect(10, -20, 35, 20);
    bedGfx.lineStyle(6, 0xfbbf24, 1);
    bedGfx.beginPath();
    bedGfx.moveTo(-60, 100); bedGfx.lineTo(-60, -120);
    bedGfx.moveTo(60, 100); bedGfx.lineTo(60, -120);
    bedGfx.strokePath();
    
    // Smooth Bezier Canopy
    bedGfx.fillStyle(0xfbcfe8, 0.85);
    bedGfx.beginPath();
    drawCubicBezier(bedGfx, -70, -120, -20, -140, 20, -140, 70, -120);
    bedGfx.lineTo(70, -100);
    drawCubicBezier(bedGfx, 70, -100, 20, -115, -20, -115, -70, -100);
    bedGfx.closePath();
    bedGfx.fillPath();
    bed.add(bedGfx);
    createSolidProp(scene, bed, 140, 110, -70, 0);

    // 3.2 GLAM MAKEUP VANITY
    const vanity = scene.add.container(550, 480);
    const vanityGfx = scene.add.graphics();
    vanityGfx.fillStyle(0xec4899, 1);
    vanityGfx.fillRect(-60, 0, 120, 40);
    vanityGfx.lineStyle(4, 0xdb2777, 1);
    vanityGfx.beginPath();
    vanityGfx.moveTo(-50, 40); vanityGfx.lineTo(-55, 75);
    vanityGfx.moveTo(50, 40); vanityGfx.lineTo(55, 75);
    vanityGfx.strokePath();
    vanityGfx.fillStyle(0xfbbf24, 1);
    vanityGfx.fillCircle(-25, 20, 5);
    vanityGfx.fillCircle(25, 20, 5);
    
    // Heart Mirror Outer Outline
    vanityGfx.fillStyle(0xdb2777, 1);
    vanityGfx.beginPath();
    drawCubicBezier(vanityGfx, 0, -15, -45, -60, -25, -95, 0, -60);
    drawCubicBezier(vanityGfx, 0, -60, 25, -95, 45, -60, 0, -15);
    vanityGfx.closePath();
    vanityGfx.fillPath();
    
    // Heart Mirror Silver Reflective Glass
    vanityGfx.fillStyle(0xe0f2fe, 1);
    vanityGfx.beginPath();
    drawCubicBezier(vanityGfx, 0, -22, -35, -55, -20, -85, 0, -52);
    drawCubicBezier(vanityGfx, 0, -52, 20, -85, 35, -55, 0, -22);
    vanityGfx.closePath();
    vanityGfx.fillPath();

    // Glowing Neon Bulb Elements
    const vanityGlow = scene.add.graphics();
    vanityGlow.setBlendMode(Phaser.BlendModes.ADD);
    vanityGlow.fillStyle(0xfef08a, 0.8);
    const bulbPoints = [
        {x: -25, y: -50}, {x: -20, y: -65}, {x: -5, y: -72},
        {x: 5, y: -72}, {x: 20, y: -65}, {x: 25, y: -50}
    ];
    bulbPoints.forEach(p => vanityGlow.fillCircle(p.x, p.y, 5));
    scene.tweens.add({
        targets: vanityGlow,
        alpha: 0.2,
        duration: 800,
        yoyo: true,
        repeat: -1
    });
    vanity.add(vanityGfx);
    vanity.add(vanityGlow);
    createSolidProp(scene, vanity, 130, 80, -65, 0);

    // Accompanying vanity vanityStool
    const vanityStool = scene.add.container(550, 560);
    const stoolGfx = scene.add.graphics();
    stoolGfx.fillStyle(0xfbbf24, 1);
    stoolGfx.fillRect(-20, 0, 4, 25);
    stoolGfx.fillRect(16, 0, 4, 25);
    stoolGfx.fillStyle(0xf472b6, 1);
    stoolGfx.fillCircle(0, 0, 24);
    stoolGfx.fillStyle(0xfbcfe8, 1);
    stoolGfx.fillCircle(0, 0, 15);
    vanityStool.add(stoolGfx);
    createSolidProp(scene, vanityStool, 40, 20, -20, -5);

    // 3.3 DOUBLE-DOOR ARMOIRE WARDROBE
    const wardrobe = scene.add.container(1320, 500);
    const wardGfx = scene.add.graphics();
    wardGfx.fillStyle(0xdb2777, 1);
    wardGfx.fillRect(-70, -110, 140, 220);
    wardGfx.fillStyle(0xfbbf24, 1);
    wardGfx.fillTriangle(-75, -110, 0, -145, 75, -110);
    wardGfx.fillRect(-75, -110, 150, 10);
    wardGfx.fillStyle(0xf472b6, 1);
    wardGfx.fillRect(-60, -90, 55, 190);
    wardGfx.fillRect(5, -90, 55, 190);
    wardGfx.fillStyle(0xfbbf24, 1);
    wardGfx.fillCircle(-6, 0, 6);
    wardGfx.fillCircle(6, 0, 6);
    wardrobe.add(wardGfx);
    createSolidProp(scene, wardrobe, 150, 120, -75, 10);

    // 3.4 ROYAL LOUNGE SOFA
    const sofa = scene.add.container(1050, 650);
    const sofaGfx = scene.add.graphics();
    sofaGfx.fillStyle(0xdb2777, 1);
    sofaGfx.fillCircle(-60, -25, 35);
    sofaGfx.fillCircle(60, -25, 35);
    sofaGfx.fillCircle(0, -35, 45);
    sofaGfx.fillRect(-70, -25, 140, 60);
    sofaGfx.fillStyle(0xf472b6, 1);
    sofaGfx.fillRect(-75, 0, 150, 45);
    sofaGfx.fillStyle(0xfbbf24, 1);
    sofaGfx.fillRect(-70, 45, 12, 10);
    sofaGfx.fillRect(58, 45, 12, 10);
    sofa.add(sofaGfx);
    createSolidProp(scene, sofa, 180, 80, -90, 0);

    // 3.5 ROOM SEGREGATION COLUMNS
    const columns = [150, 750, 850, 1450];
    columns.forEach(colX => {
        const column = scene.add.container(colX, 600);
        const colGfx = scene.add.graphics();
        colGfx.fillStyle(0xbe185d, 0.25);
        colGfx.fillCircle(0, 520, 30);
        colGfx.fillStyle(0xfff1f2, 1);
        colGfx.fillRect(-20, -300, 40, 820);
        colGfx.fillStyle(0xfbbf24, 1);
        colGfx.fillRect(-25, -310, 50, 20);
        colGfx.fillRect(-25, 510, 50, 20);
        column.add(colGfx);
        createSolidProp(scene, column, 50, 40, -25, 500);
    });

    // ----------------------------------------------------
    // 4. ANIMATED FOCUS POINTS
    // ----------------------------------------------------

    // 4.1 PULSATING GLOWING CHANDELIER
    const chandelier = scene.add.container(800, 310);
    const chanGfx = scene.add.graphics();
    chanGfx.lineStyle(3, 0xfbbf24, 1);
    chanGfx.beginPath();
    chanGfx.moveTo(0, -100);
    chanGfx.lineTo(0, 0);
    chanGfx.strokePath();
    chanGfx.fillStyle(0xfbbf24, 1);
    chanGfx.fillRect(-60, 0, 120, 8);
    const candlePoints = [-50, -25, 0, 25, 50];
    candlePoints.forEach(cx => {
        chanGfx.fillStyle(0xfff1f2, 1);
        chanGfx.fillRect(cx - 5, -15, 10, 15);
    });
    chandelier.add(chanGfx);
    
    const chanGlow = scene.add.graphics();
    chanGlow.setBlendMode(Phaser.BlendModes.ADD);
    chandelier.add(chanGlow);

    scene.tweens.add({
        targets: chanGlow,
        alpha: 0.4,
        duration: 600,
        yoyo: true,
        repeat: -1
    });
    scene.tweens.add({
        targets: chandelier,
        y: 315,
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
    scene.chandelierGlow = chanGlow;
    scene.candlePoints = candlePoints;

    // 4.2 DYNAMIC WATER FOUNTAIN (Garden Spa Section)
    const fountain = scene.add.container(800, 850);
    const fountGfx = scene.add.graphics();
    fountGfx.fillStyle(0xf472b6, 1);
    fountGfx.fillCircle(0, 20, 80);
    fountGfx.fillStyle(0xdb2777, 1);
    fountGfx.fillCircle(0, 20, 72);
    fountGfx.fillStyle(0x0284c7, 0.8);
    fountGfx.fillCircle(0, 20, 68);
    fountGfx.fillStyle(0xfbcfe8, 1);
    fountGfx.fillRect(-15, -40, 30, 60);
    fountGfx.fillStyle(0xf472b6, 1);
    fountGfx.fillCircle(0, -40, 45);
    fountGfx.fillStyle(0x0284c7, 0.9);
    fountGfx.fillCircle(0, -40, 38);
    fountGfx.fillStyle(0xfbbf24, 1);
    fountGfx.fillCircle(0, -65, 12);
    fountain.add(fountGfx);
    createSolidProp(scene, fountain, 150, 80, -75, -20);

    scene.waterParticles = [];
    scene.maxWaterParticles = 40;
    scene.fountainContainer = fountain;

    // ----------------------------------------------------
    // 5. PLAYER CHARACTER CONTAINER
    // ----------------------------------------------------
    scene.player = scene.add.container(800, 1000);
    scene.player.setSize(50, 40); 
    const pGfx = scene.add.graphics();

    pGfx.fillStyle(0xbe185d, 0.3);
    pGfx.fillCircle(0, 25, 20);

    pGfx.fillStyle(0xdb2777, 1);
    pGfx.fillRect(-22, -35, 44, 45);
    pGfx.fillCircle(-15, 10, 12);
    pGfx.fillCircle(15, 10, 12);

    pGfx.fillStyle(0xf472b6, 1);
    pGfx.beginPath();
    pGfx.moveTo(-25, 25);
    pGfx.lineTo(25, 25);
    pGfx.lineTo(15, -15);
    pGfx.lineTo(-15, -15);
    pGfx.closePath();
    pGfx.fillPath();

    pGfx.fillStyle(0xfbbf24, 1);
    pGfx.fillRect(-15, -15, 30, 4);
    pGfx.fillStyle(0xfff1f2, 1);
    pGfx.fillRect(-25, 20, 50, 5);

    pGfx.fillStyle(0xffedd5, 1);
    pGfx.fillCircle(0, -32, 22);

    pGfx.fillStyle(0xbe185d, 1);
    pGfx.fillCircle(-8, -32, 4);
    pGfx.fillCircle(8, -32, 4);
    pGfx.fillStyle(0xffffff, 1);
    pGfx.fillCircle(-9, -34, 1.5);
    pGfx.fillCircle(7, -34, 1.5);

    pGfx.fillStyle(0xfecdd3, 1);
    pGfx.fillCircle(-14, -28, 4);
    pGfx.fillCircle(14, -28, 4);

    pGfx.fillStyle(0xdb2777, 1);
    pGfx.fillCircle(-16, -42, 12);
    pGfx.fillCircle(16, -42, 12);
    pGfx.fillRect(-18, -48, 36, 10);
    pGfx.fillCircle(-24, -40, 10);
    pGfx.fillCircle(24, -40, 10);

    pGfx.fillStyle(0xfbbf24, 1);
    pGfx.fillTriangle(-12, -48, -15, -58, -5, -48);
    pGfx.fillTriangle(12, -48, 15, -58, 5, -48);
    pGfx.fillTriangle(-6, -48, 0, -62, 6, -48);

    scene.player.add(pGfx);
    scene.physics.add.existing(scene.player);
    if (scene.player.body) {
        scene.player.body.setCollideWorldBounds(true);
        scene.player.body.setSize(50, 40);
        scene.player.body.setOffset(-25, 5);
    }
    scene.depthGroup.push(scene.player);

    // Dynamic colliders
    scene.depthGroup.forEach(obj => {
        if (obj !== scene.player) {
            scene.physics.add.collider(scene.player, obj);
        }
    });

    // Camera configuration
    scene.cameras.main.setBounds(0, 0, 1600, 1200);
    scene.cameras.main.startFollow(scene.player, true, 0.1, 0.1);

    // Point and Click Navigation
    scene.targetX = null;
    scene.targetY = null;
    scene.input.on('pointerdown', (pointer) => {
        scene.targetX = pointer.worldX;
        scene.targetY = pointer.worldY;
    });

    // Touch Pad / Mobile Controls Support
    scene.dpadVelX = 0;
    scene.dpadVelY = 0;
    const bindButton = (id, vxVal, vyVal) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('mousedown', () => { scene.dpadVelX = vxVal; scene.dpadVelY = vyVal; });
            btn.addEventListener('mouseup', () => { scene.dpadVelX = 0; scene.dpadVelY = 0; });
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); scene.dpadVelX = vxVal; scene.dpadVelY = vyVal; });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); scene.dpadVelX = 0; scene.dpadVelY = 0; });
        }
    };
    bindButton('btn-up', 0, -1);
    bindButton('btn-down', 0, 1);
    bindButton('btn-left', -1, 0);
    bindButton('btn-right', 1, 0);

    // ----------------------------------------------------
    // 6. ATMOSPHERIC FLOATING HEART PARTICLES
    // ----------------------------------------------------
    scene.magicalHearts = [];
    for (let i = 0; i < 12; i++) {
        const heart = scene.add.graphics();
        heart.fillStyle(0xec4899, 0.7);
        heart.beginPath();
        drawCubicBezier(heart, 0, 0, -10, -15, -5, -25, 0, -15);
        drawCubicBezier(heart, 0, -15, 5, -25, 10, -15, 0, 0);
        heart.closePath();
        heart.fillPath();
        heart.x = Phaser.Math.Between(200, 1400);
        heart.y = Phaser.Math.Between(400, 1100);
        heart.scale = Phaser.Math.FloatBetween(0.5, 1.2);
        scene.magicalHearts.push({
            obj: heart,
            speedY: Phaser.Math.FloatBetween(0.5, 1.5),
            wiggleSpeed: Phaser.Math.FloatBetween(0.01, 0.03),
            phase: Phaser.Math.FloatBetween(0, 100)
        });
    }

    // ----------------------------------------------------
    // 7. EXIT PORTAL
    // ----------------------------------------------------
    const exitPortal = scene.add.container(800, 1150);
    const exitGfx = scene.add.graphics();
    exitGfx.fillStyle(0xfbbf24, 0.8);
    exitGfx.fillRect(-100, -10, 200, 20);
    exitGfx.fillStyle(0xdb2777, 1);
    exitGfx.fillRect(-65, -90, 130, 90);
    exitGfx.fillCircle(0, -90, 65);
    exitGfx.fillStyle(0xfff1f2, 1);
    exitGfx.fillRect(-55, -80, 110, 80);
    exitGfx.fillCircle(0, -80, 55);
    exitGfx.fillStyle(0xfbbf24, 1);
    exitGfx.fillCircle(-10, -35, 6);
    exitGfx.fillCircle(10, -35, 6);
    exitPortal.add(exitGfx);
    exitPortal.setDepth(1150);

    // Required compulsory Exit Trigger Setup
    const exitZone = scene.add.zone(800, 1155, 120, 40);
    scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
    scene.roomData.exitZone = exitZone;
    scene.roomData.player = scene.player;

    scene.proximityTriggered = false;
}

export function onUpdate(scene) {
    const time = scene.time.now;

    // 1. Calculate Movements
    let vx = 0;
    let vy = 0;
    const speed = 250;

    // Standard Keyboard Controls
    if (scene.cursors && scene.wasd) {
        if (scene.cursors.left.isDown || scene.wasd.left.isDown) vx = -speed;
        else if (scene.cursors.right.isDown || scene.wasd.right.isDown) vx = speed;

        if (scene.cursors.up.isDown || scene.wasd.up.isDown) vy = -speed;
        else if (scene.cursors.down.isDown || scene.wasd.down.isDown) vy = speed;
    }

    // Mobile Overlay Controls
    if (scene.dpadVelX !== 0 || scene.dpadVelY !== 0) {
        vx = scene.dpadVelX * speed;
        vy = scene.dpadVelY * speed;
        scene.targetX = null;
    }

    // Point to Click Walk Physics
    if (scene.targetX !== null && scene.targetY !== null) {
        const distance = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, scene.targetX, scene.targetY);
        if (distance > 10) {
            const angle = Phaser.Math.Angle.Between(scene.player.x, scene.player.y, scene.targetX, scene.targetY);
            vx = Math.cos(angle) * speed;
            vy = Math.sin(angle) * speed;
        } else {
            scene.targetX = null;
            scene.targetY = null;
        }
    }

    // RPG Horizon Constraint (Stop player from walking into the sky / horizon boundary)
    if (scene.player.y < 350) {
        scene.player.y = 350;
        if (vy < 0) vy = 0;
    }

    if (scene.player.body) {
        scene.player.body.setVelocity(vx, vy);
    }

    // 2. Playable Princess Walking Bouncy Animation
    if (vx !== 0 || vy !== 0) {
        scene.player.angle = Math.sin(time * 0.015) * 5;
        scene.player.scaleY = 1 + Math.sin(time * 0.02) * 0.05;
    } else {
        scene.player.angle = 0;
        scene.player.scaleY = 1;
    }

    // 3. Oblique RPG depth sorting logic
    if (scene.depthGroup) {
        scene.depthGroup.forEach(obj => {
            if (obj && obj.y) obj.setDepth(obj.y);
        });
    }

    // 4. Parallax Background Drifting clouds
    if (scene.clouds) {
        scene.clouds.forEach(cloud => {
            cloud.x += 0.3 * cloud.scrollFactorX;
            if (cloud.x > 1700) {
                cloud.x = -200;
            }
        });
    }

    // 5. Water Fountain particles manual simulation
    if (scene.waterParticles && scene.fountainContainer) {
        if (scene.waterParticles.length < scene.maxWaterParticles && Math.random() < 0.6) {
            const wp = scene.add.graphics();
            wp.fillStyle(0xbae6fd, Phaser.Math.FloatBetween(0.6, 1.0));
            wp.fillCircle(0, 0, Phaser.Math.FloatBetween(2.5, 5));
            wp.setDepth(scene.fountainContainer.y + 10);

            scene.waterParticles.push({
                obj: wp,
                x: scene.fountainContainer.x + Phaser.Math.FloatBetween(-6, 6),
                y: scene.fountainContainer.y - 65,
                vx: Phaser.Math.FloatBetween(-1.5, 1.5),
                vy: Phaser.Math.FloatBetween(-6, -9),
                life: 1.0
            });
        }

        for (let i = scene.waterParticles.length - 1; i >= 0; i--) {
            const p = scene.waterParticles[i];
            p.vy += 0.25;
            p.x += p.vx;
            p.y += p.vy;
            p.obj.x = p.x;
            p.obj.y = p.y;
            p.life -= 0.015;
            p.obj.alpha = p.life;

            if (p.life <= 0 || p.y > scene.fountainContainer.y + 30) {
                p.obj.destroy();
                scene.waterParticles.splice(i, 1);
            }
        }
    }

    // 6. Floating Ambient hearts update loop
    if (scene.magicalHearts) {
        scene.magicalHearts.forEach(h => {
            h.obj.y -= h.speedY;
            h.obj.x += Math.sin(time * h.wiggleSpeed + h.phase) * 0.4;
            if (h.obj.y < 300) {
                h.obj.y = 1200;
                h.obj.x = Phaser.Math.Between(200, 1400);
            }
        });
    }

    // 7. Chandelier light flicker
    if (scene.chandelierGlow) {
        scene.chandelierGlow.clear();
        scene.chandelierGlow.fillStyle(0xfef08a, 0.5 + Math.random() * 0.2);
        scene.candlePoints.forEach(cx => {
            scene.chandelierGlow.fillCircle(cx, -18 + Math.sin(time * 0.05 + cx) * 2, 7);
            scene.chandelierGlow.fillTriangle(
                cx - 5, -18,
                cx, -30 + Math.sin(time * 0.1) * 3,
                cx + 5, -18
            );
        });
    }

    // 8. Handle HTML HUD bindings safely
    const roundedX = Math.round(scene.player.x);
    const roundedY = Math.round(scene.player.y);
    const hudCoords = document.getElementById("coordinates-hud");
    if (hudCoords) {
        hudCoords.textContent = `X: ${roundedX} | Y: ${roundedY}`;
    }

    // 9. Simple Interactive Proximity notifications
    const distToVanity = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, 550, 560);
    const toast = document.getElementById("toast-notification");
    const toastText = document.getElementById("toast-text");
    const toastIcon = document.getElementById("toast-icon");

    if (distToVanity < 75) {
        if (!scene.proximityTriggered) {
            scene.proximityTriggered = true;
            if (toastText && toast && toastIcon) {
                toastText.innerHTML = "Approach <strong>Glam Vanity</strong>! Neon mirrors are glowing.";
                toastIcon.textContent = "💄";
                toast.classList.remove("scale-0", "opacity-0");
                toast.classList.add("scale-100", "opacity-100");
            }
        }
    } else if (scene.proximityTriggered && distToVanity > 95) {
        scene.proximityTriggered = false;
        if (toast) {
            toast.classList.remove("scale-100", "opacity-100");
            toast.classList.add("scale-0", "opacity-0");
        }
    }

    // Required exit checking loop:
    const d = scene.roomData;
    if (d && d.player && d.exitZone) {
        const hit = Phaser.Geom.Intersects.RectangleToRectangle(
            d.player.getBounds(), d.exitZone.getBounds()
        );
        if (hit) {
            if (typeof scene.exitRoom === 'function') {
                scene.exitRoom();
            }
        }
    }
}

export function onExit(scene) {
    if (scene.waterParticles) {
        scene.waterParticles.forEach(p => p.obj.destroy());
    }
    if (scene.magicalHearts) {
        scene.magicalHearts.forEach(h => h.obj.destroy());
    }
    scene.roomData = null;
}

// Fallback logic structure
export const roomCode = {
    name,
    onLoad,
    onCreate,
    onUpdate,
    onExit
};