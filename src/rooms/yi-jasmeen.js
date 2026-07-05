// --- NEO-TOKYO CORAL DISTRICT WORLD MODULE ---

export const name = "Neo-Tokyo Coral District";

export function onLoad(scene) {
    scene.roomData = {
        particles: [],
        cursors: null,
        exitZone: null,
        player: null,
        buildings: [],
        coreHitZone: null,
        coreLabel: null,
        notificationText: null,
        notificationTimer: null
    };
}

export function onCreate(scene) {
    // Configure 1600x1200 physics bound limits
    scene.physics.world.setBounds(0, 0, 1600, 1200);

    // --- BACKGROUND RENDER (y: 0 to 300 is the atmospheric upper ocean) ---
    const bgGfx = scene.add.graphics();
    bgGfx.setDepth(1);

    // Sky/Atmospheric Upper Water gradient
    for (let y = 0; y < 300; y += 15) {
        let ratio = y / 300;
        // Blend from midnight abyss blue to deep neon cyan skyline
        let r = Math.floor(2 * (1 - ratio) + 8 * ratio);
        let g = Math.floor(6 * (1 - ratio) + 40 * ratio);
        let b = Math.floor(20 * (1 - ratio) + 90 * ratio);
        let color = (r << 16) | (g << 8) | b;
        bgGfx.fillStyle(color, 1);
        bgGfx.fillRect(0, y, 1600, 15);
    }

    // Silhouette Skyline (Distortion horizon line at Y: 300)
    bgGfx.fillStyle(0x061124, 1);
    bgGfx.beginPath();
    bgGfx.moveTo(0, 300);
    bgGfx.lineTo(120, 160);
    bgGfx.lineTo(240, 240);
    bgGfx.lineTo(410, 110);
    bgGfx.lineTo(580, 220);
    bgGfx.lineTo(760, 90);
    bgGfx.lineTo(920, 250);
    bgGfx.lineTo(1100, 130);
    bgGfx.lineTo(1280, 210);
    bgGfx.lineTo(1420, 80);
    bgGfx.lineTo(1600, 300);
    bgGfx.closePath();
    bgGfx.fillPath();

    // Draw secondary distant neon glow overlay to simulate background skyscrapers in mist
    bgGfx.lineStyle(1, 0x00ffff, 0.4);
    bgGfx.strokePath();

    // --- SEABED GROUND FLOOR (y: 300 to 1200) ---
    bgGfx.fillStyle(0x020813, 1);
    bgGfx.fillRect(0, 300, 1600, 900);

    // RPG Style Isometric Grid Overlay 
    bgGfx.lineStyle(1, 0x0ea5e9, 0.15);
    // Horizontal perspective lines
    for (let y = 300; y < 1200; y += 50) {
        bgGfx.beginPath();
        bgGfx.moveTo(0, y);
        bgGfx.lineTo(1600, y);
        bgGfx.strokePath();
    }
    // Vertical street lines converging to top horizon points
    for (let x = -400; x < 2000; x += 120) {
        bgGfx.beginPath();
        bgGfx.moveTo(x, 300);
        bgGfx.lineTo(x + 350, 1200);
        bgGfx.strokePath();
    }

    // --- 3D OBLIQUE STRUCTURE BUILDER (Front faces visible) ---
    const spawnBuilding = (x, y, w, h, brandColor, logoSymbol) => {
        // Create standalone container for proper dynamic sorting
        const bldContainer = scene.add.container(x, y);
        bldContainer.setDepth(y / 10); // Oblique depth coordinate sorting

        const gfx = scene.add.graphics();
        
        // Main front face block
        gfx.fillStyle(0x080f1e, 0.95);
        gfx.fillRect(0, -h, w, h);

        // High contrast neon structural trim
        gfx.lineStyle(3, brandColor, 1);
        gfx.beginPath();
        gfx.moveTo(0, 0);
        gfx.lineTo(0, -h);
        gfx.lineTo(w, -h);
        gfx.lineTo(w, 0);
        gfx.strokePath();

        // Windows (Simulating dense Tokyo skyscraper lights)
        gfx.fillStyle(brandColor, 0.45);
        const winCols = Math.floor((w - 20) / 16);
        const winRows = Math.floor((h - 40) / 24);
        for (let col = 0; col < winCols; col++) {
            for (let row = 0; row < winRows; row++) {
                // Randomize window activity state
                if (Math.random() > 0.3) {
                    gfx.fillRect(12 + (col * 16), -h + 20 + (row * 24), 8, 14);
                }
            }
        }

        // Holographic neon signage
        const signGfx = scene.add.graphics();
        signGfx.setBlendMode(Phaser.BlendModes.ADD);
        signGfx.fillStyle(brandColor, 0.2);
        signGfx.fillRect(-6, -h - 10, w + 12, 10);
        signGfx.lineStyle(2, 0xffffff, 0.8);
        signGfx.strokeRect(-6, -h - 10, w + 12, 10);

        bldContainer.add(gfx);
        bldContainer.add(signGfx);

        // Add text overlay labels inside containers for crisp layout rendering
        const textLabel = scene.add.text(w / 2, -h - 5, logoSymbol, {
            fontFamily: 'monospace',
            fontSize: '9px',
            fill: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        bldContainer.add(textLabel);

        scene.roomData.buildings.push({
            container: bldContainer,
            baseY: y,
            height: h,
            width: w
        });
    };

    // Spawn neon city blocks spread out across the 1600px canvas
    // Left Sector
    spawnBuilding(80, 520, 140, 200, 0xff00ff, "TOKYO_A1");
    spawnBuilding(280, 680, 160, 240, 0x00ffff, "NEON_LABS");
    spawnBuilding(60, 980, 180, 180, 0x39ff14, "GAME_ZONE");

    // Right Sector
    spawnBuilding(1180, 480, 150, 180, 0xff00ff, "RE_CO.");
    spawnBuilding(1380, 660, 140, 250, 0x00ffff, "CYBER_FIN");
    spawnBuilding(1240, 940, 200, 210, 0xec4899, "MER_CLB");
    spawnBuilding(980, 820, 130, 160, 0x39ff14, "NIGHT_MKT");

    // --- CENTRAL ANCHOR: THE GIANT BIOLUMINESCENT WORLD PLANT ---
    const plantGfx = scene.add.graphics();
    plantGfx.setDepth(60); // Centered depth range around Y:600

    // Root & Trunk construction via safe polygon calculations
    plantGfx.fillStyle(0x0e1c38, 0.9);
    plantGfx.lineStyle(6, 0xec4899, 1);
    
    const trunkPoints = [];
    const steps = 24;
    const baseY = 850;
    const topY = 320;
    const height = baseY - topY;

    // Left curve vertices
    for (let i = 0; i <= steps; i++) {
        let t = i / steps;
        let currY = baseY - (t * height);
        let curveOffset = Math.sin(t * Math.PI) * -35; 
        let widthAtT = 50 * (1 - t * 0.6);
        let currX = 800 + curveOffset - (widthAtT / 2);
        trunkPoints.push({ x: currX, y: currY });
    }

    // Right curve vertices
    for (let i = steps; i >= 0; i--) {
        let t = i / steps;
        let currY = baseY - (t * height);
        let curveOffset = Math.sin(t * Math.PI) * -35;
        let widthAtT = 50 * (1 - t * 0.6);
        let currX = 800 + curveOffset + (widthAtT / 2);
        trunkPoints.push({ x: currX, y: currY });
    }

    plantGfx.beginPath();
    plantGfx.moveTo(trunkPoints[0].x, trunkPoints[0].y);
    for (let i = 1; i < trunkPoints.length; i++) {
        plantGfx.lineTo(trunkPoints[i].x, trunkPoints[i].y);
    }
    plantGfx.closePath();
    plantGfx.fillPath();
    plantGfx.strokePath();

    // Glowing inner digital vein line
    plantGfx.lineStyle(2, 0x00ffff, 0.8);
    plantGfx.beginPath();
    for (let i = 0; i <= steps; i++) {
        let t = i / steps;
        let currY = baseY - (t * height);
        let curveOffset = Math.sin(t * Math.PI) * -35;
        let currX = 800 + curveOffset;
        if (i === 0) {
            plantGfx.moveTo(currX, currY);
        } else {
            plantGfx.lineTo(currX, currY);
        }
    }
    plantGfx.strokePath();

    // Bioluminescent flower nodes
    const podPositions = [
        {x: 770, y: 320, r: 24, c: 0x00ffff},
        {x: 830, y: 320, r: 24, c: 0xec4899},
        {x: 740, y: 440, r: 35, c: 0xff00ff},
        {x: 860, y: 480, r: 40, c: 0x00ffff},
        {x: 720, y: 580, r: 45, c: 0x39ff14},
        {x: 880, y: 640, r: 45, c: 0xff00ff},
        {x: 740, y: 740, r: 50, c: 0x00ffff}
    ];

    podPositions.forEach(pod => {
        plantGfx.setBlendMode(Phaser.BlendModes.ADD);
        plantGfx.fillStyle(pod.c, 0.3);
        plantGfx.fillCircle(pod.x, pod.y, pod.r + 10);
        
        plantGfx.setBlendMode(Phaser.BlendModes.NORMAL);
        plantGfx.fillStyle(pod.c, 0.8);
        plantGfx.fillCircle(pod.x, pod.y, pod.r);

        plantGfx.fillStyle(0xffffff, 0.9);
        plantGfx.fillCircle(pod.x, pod.y, pod.r * 0.4);
    });

    // --- 5. GAME ANCHOR OBJECT: "SYS_CORE" NETWORK TERMINAL ---
    const coreAnchor = scene.add.container(360, 920);
    coreAnchor.setDepth(92);

    const terminalGfx = scene.add.graphics();
    terminalGfx.fillStyle(0x111827, 1);
    terminalGfx.fillRect(-25, -25, 50, 50);
    terminalGfx.lineStyle(2, 0x00ffff, 1);
    terminalGfx.strokeRect(-25, -25, 50, 50);

    terminalGfx.setBlendMode(Phaser.BlendModes.ADD);
    terminalGfx.fillStyle(0xec4899, 0.8);
    terminalGfx.fillRect(-18, -18, 36, 20);
    terminalGfx.fillStyle(0x00ffff, 0.9);
    terminalGfx.fillRect(-14, 10, 28, 4);

    coreAnchor.add(terminalGfx);

    const coreHitZone = scene.add.zone(360, 920, 80, 80);
    scene.physics.world.enable(coreHitZone, Phaser.Physics.Arcade.STATIC_BODY);
    scene.roomData.coreHitZone = coreHitZone;

    const coreLabel = scene.add.text(360, 875, "« SYS_CORE »", {
        fontFamily: 'monospace',
        fontSize: '11px',
        fill: '#00ffff',
        fontWeight: 'bold',
        backgroundColor: '#020617',
        padding: { x: 6, y: 3 }
    }).setOrigin(0.5).setDepth(93);

    scene.tweens.add({
        targets: coreLabel,
        alpha: { from: 0.5, to: 1 },
        scale: { from: 0.95, to: 1.05 },
        duration: 1000,
        yoyo: true,
        repeat: -1
    });

    // --- 6. DRIFTING AMBIENT WATER SPORES ---
    for (let i = 0; i < 45; i++) {
        let spGfx = scene.add.graphics();
        spGfx.setDepth(75);
        spGfx.setBlendMode(Phaser.BlendModes.ADD);

        let rx = Phaser.Math.Between(600, 1000);
        let ry = Phaser.Math.Between(300, 950);
        let rSize = Phaser.Math.Between(4, 9);
        let colors = [0x00ffff, 0xec4899, 0x39ff14, 0xfacc15];
        let pickColor = Phaser.Math.RND.pick(colors);

        spGfx.fillStyle(pickColor, 0.7);
        spGfx.fillCircle(rx, ry, rSize);

        scene.roomData.particles.push({
            gfx: spGfx,
            baseX: rx,
            baseY: ry,
            speedY: Phaser.Math.FloatBetween(0.4, 1.2),
            amplitude: Phaser.Math.FloatBetween(15, 45),
            phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
            phaseSpeed: Phaser.Math.FloatBetween(0.01, 0.03)
        });
    }

    // --- 7. PLAYER CHARACTER: HUMAN CYBER MERMAID ---
    scene.player = scene.add.container(800, 1000);
    scene.player.setSize(45, 65);
    scene.physics.world.enable(scene.player);
    scene.player.body.setCollideWorldBounds(true);

    const renderPlayerGfx = scene.add.graphics();
    renderPlayerGfx.fillStyle(0xfde047, 1);
    renderPlayerGfx.fillCircle(0, -20, 11);
    
    renderPlayerGfx.fillStyle(0x0e7490, 1);
    renderPlayerGfx.fillRect(-10, -9, 20, 22);
    renderPlayerGfx.fillStyle(0x00ffff, 1);
    renderPlayerGfx.fillRect(-6, -5, 12, 14);

    renderPlayerGfx.fillStyle(0xdb2777, 1);
    renderPlayerGfx.fillTriangle(-10, 13, 10, 13, 0, 36);
    renderPlayerGfx.fillStyle(0x06b6d4, 0.9);
    renderPlayerGfx.fillTriangle(-15, 33, 15, 33, 0, 46);

    scene.player.add(renderPlayerGfx);
    scene.player.setDepth(100);

    scene.cameras.main.setBounds(0, 0, 1600, 1200);
    scene.cameras.main.startFollow(scene.player, true, 0.08, 0.08);

    // Setup input cursors
    scene.roomData.cursors = scene.input.keyboard.createCursorKeys();

    // --- IN-GAME NOTIFICATION OVERLAY (Safer than browser DOM) ---
    scene.roomData.notificationText = scene.add.text(400, 100, "", {
        fontFamily: 'monospace',
        fontSize: '16px',
        fill: '#00ffff',
        backgroundColor: '#0c0a0f',
        padding: { x: 16, y: 10 },
        stroke: '#db2777',
        strokeThickness: 2,
        align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

    // --- REQUIRED EXIT TRIGGER BLOCK ---
    const exitZone = scene.add.zone(800, 1155, 200, 50);
    scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
    scene.roomData.exitZone = exitZone;
    scene.roomData.player = scene.player;

    const exitGfx = scene.add.graphics();
    exitGfx.setDepth(115);
    exitGfx.fillStyle(0xef4444, 0.15);
    exitGfx.fillRect(700, 1130, 200, 50);
    exitGfx.lineStyle(4, 0xef4444, 0.9);
    exitGfx.strokeRect(700, 1130, 200, 50);

    scene.add.text(800, 1110, "▼ DEEP OCEAN DEEP-WAY GATE (EXIT) ▼", {
        fontFamily: 'monospace',
        fontSize: '11px',
        fill: '#f87171',
        fontWeight: 'bold'
    }).setOrigin(0.5).setDepth(116);
}

// In-game safe notification manager
function triggerNotification(scene, message) {
    const textObj = scene.roomData.notificationText;
    if (!textObj) return;

    textObj.setText(message);
    textObj.setX(scene.cameras.main.width / 2);
    textObj.setY(120);

    if (scene.roomData.notificationTimer) {
        scene.roomData.notificationTimer.remove();
    }

    scene.tweens.add({
        targets: textObj,
        alpha: 1,
        y: 100,
        duration: 200,
        ease: 'Power1'
    });

    scene.roomData.notificationTimer = scene.time.delayedCall(3000, () => {
        scene.tweens.add({
            targets: textObj,
            alpha: 0,
            y: 80,
            duration: 300,
            ease: 'Power1'
        });
    });
}

export function onUpdate(scene) {
    const cursors = scene.roomData.cursors;
    const player = scene.player;
    const speed = 280;

    if (!player) return;

    player.body.setVelocity(0);

    if (cursors) {
        if (cursors.left.isDown) {
            player.body.setVelocityX(-speed);
        } else if (cursors.right.isDown) {
            player.body.setVelocityX(speed);
        }

        if (cursors.up.isDown) {
            player.body.setVelocityY(-speed);
        } else if (cursors.down.isDown) {
            player.body.setVelocityY(speed);
        }
    }

    // RPG Perspective Depth-Sorting based on Y coordinate
    const footY = player.y + 20;
    player.setDepth(footY / 10);

    // Update floating plant spores
    if (scene.roomData.particles) {
        scene.roomData.particles.forEach(p => {
            p.phase += p.phaseSpeed;
            p.baseY -= p.speedY;
            
            if (p.baseY < 280) {
                p.baseY = 1000;
                p.baseX = Phaser.Math.Between(600, 1000);
            }

            let calculatedX = p.baseX + Math.sin(p.phase) * p.amplitude;
            p.gfx.setX(calculatedX - p.baseX);
            p.gfx.setY(p.baseY - p.baseY);
        });
    }

    // Core Interaction Check
    if (scene.roomData.coreHitZone && player) {
        const nearCore = Phaser.Geom.Intersects.RectangleToRectangle(
            player.getBounds(), scene.roomData.coreHitZone.getBounds()
        );
        if (nearCore) {
            triggerNotification(scene, "SYS_CORE CONNECTED!\nScanning local cyber-reef databases...");
        }
    }

    // --- REQUIRED EXIT TRIGGER CHECK ---
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
    scene.roomData = null;
}