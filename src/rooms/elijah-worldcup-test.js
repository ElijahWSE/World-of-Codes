export const name = 'Grand World Cup Stadium 2026';

export const gameAnchorX = 800;
export const gameAnchorY = 650;

export function onLoad(scene) {
    scene.cursors = scene.input.keyboard.createCursorKeys();
    scene.keysWASD = scene.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });
}

export function onCreate(scene) {
    scene.roomData = {};

    const worldWidth = 1600;
    const worldHeight = 1200;
    scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    const skyGfx = scene.add.graphics();
    skyGfx.setScrollFactor(0);
    for (let y = 0; y < 300; y++) {
        const ratio = y / 300;
        // Shift colors from clear sky-blue (0x0284c7) at top to light morning horizon (0xbae6fd)
        const r = Math.floor(2 + ratio * 184);
        const g = Math.floor(132 + ratio * 98);
        const b = Math.floor(199 + ratio * 54);
        const color = (r << 16) + (g << 8) + b;
        skyGfx.fillStyle(color, 1);
        skyGfx.fillRect(0, y, 800, 1);
    }

    // Translucent light beams (daytime sun rays)
    skyGfx.lineStyle(2, 0xffffff, 0.1);
    skyGfx.beginPath();
    for (let i = -200; i < 1000; i += 70) {
        skyGfx.moveTo(i, 300);
        skyGfx.lineTo(i + 200, 0);
    }
    skyGfx.strokePath();

    scene.clouds = [];
    for (let i = 0; i < 8; i++) {
        const cloudGfx = scene.add.graphics();
        cloudGfx.fillStyle(0xffffff, 0.55); // Prominent daytime clouds
        cloudGfx.fillCircle(0, 0, 30);
        cloudGfx.fillCircle(25, -10, 25);
        cloudGfx.fillCircle(-25, -5, 20);
        cloudGfx.fillCircle(45, 5, 15);
        cloudGfx.setScrollFactor(0.1);
        
        const cx = Math.random() * worldWidth;
        const cy = 50 + Math.random() * 120;
        cloudGfx.setPosition(cx, cy);
        
        scene.clouds.push({
            obj: cloudGfx,
            speed: 0.1 + Math.random() * 0.2
        });
    }

    const horizonGfx = scene.add.graphics();
    horizonGfx.fillStyle(0x334155, 1); // Steel slate daytime silhouette
    horizonGfx.beginPath();
    horizonGfx.moveTo(0, 300);
    let cx = 0;
    while (cx < worldWidth) {
        const r = Math.random();
        if (r < 0.2) {
            horizonGfx.lineTo(cx, 200);
            horizonGfx.lineTo(cx + 40, 200);
            horizonGfx.lineTo(cx + 50, 250);
            cx += 50;
        } else if (r < 0.6) {
            horizonGfx.lineTo(cx, 260);
            horizonGfx.lineTo(cx + 30, 210);
            horizonGfx.lineTo(cx + 80, 190);
            horizonGfx.lineTo(cx + 130, 210);
            horizonGfx.lineTo(cx + 160, 260);
            cx += 160;
        } else {
            horizonGfx.lineTo(cx, 260);
            horizonGfx.lineTo(cx + 80, 240);
            horizonGfx.lineTo(cx + 100, 300);
            cx += 100;
        }
    }
    horizonGfx.lineTo(worldWidth, 300);
    horizonGfx.closePath();
    horizonGfx.fillPath();

    const ledGfx = scene.add.graphics();
    ledGfx.lineStyle(4, 0xfacc15, 0.8); // Golden active status ribbon
    ledGfx.beginPath();
    ledGfx.moveTo(0, 300);
    ledGfx.lineTo(worldWidth, 300);
    ledGfx.strokePath();

    const floodLights = [
        {x: 150, y: 220}, {x: 450, y: 200}, {x: 800, y: 190}, 
        {x: 1150, y: 200}, {x: 1450, y: 220}
    ];
    floodLights.forEach((light, idx) => {
        const post = scene.add.graphics();
        post.lineStyle(3, 0x475569, 1); // Gray structural posts
        post.beginPath();
        post.moveTo(light.x, 300);
        post.lineTo(light.x, light.y);
        post.strokePath();

        const flare = scene.add.graphics();
        flare.fillStyle(0xfffbeb, 0.15); // Soft golden daytime glint
        flare.fillCircle(light.x, light.y, 16);
        flare.fillStyle(0xffffff, 0.45);
        flare.fillCircle(light.x, light.y, 8);
        flare.setBlendMode(Phaser.BlendModes.ADD);

        scene.tweens.add({
            targets: flare,
            alpha: { from: 0.5, to: 0.15 },
            scaleX: { from: 1, to: 1.3 },
            scaleY: { from: 1, to: 1.3 },
            duration: 1500 + Math.random() * 1000,
            yoyo: true,
            repeat: -1
        });
    });

    const groundBase = scene.add.graphics();
    groundBase.fillStyle(0x1e3a8a, 1); // Rich dark blue daytime turf base
    groundBase.fillRect(0, 300, worldWidth, worldHeight - 300);

    const pitchStripes = scene.add.graphics();
    pitchStripes.fillStyle(0x1d4ed8, 0.25); // Lighter blue stripes
    const stripeWidth = 80;
    for (let x = 0; x < worldWidth; x += stripeWidth * 2) {
        pitchStripes.fillRect(x, 300, stripeWidth, worldHeight - 300);
    }

    const pitchLines = scene.add.graphics();
    pitchLines.lineStyle(6, 0xffffff, 0.3);

    const marginX = 80;
    const marginY = 380;
    const fieldW = worldWidth - marginX * 2;
    const fieldH = worldHeight - marginY - 100;

    pitchLines.strokeRect(marginX, marginY, fieldW, fieldH);
    
    pitchLines.beginPath();
    pitchLines.moveTo(worldWidth / 2, marginY);
    pitchLines.lineTo(worldWidth / 2, marginY + fieldH);
    pitchLines.strokePath();

    pitchLines.strokeCircle(worldWidth / 2, marginY + fieldH / 2, 100);
    pitchLines.fillStyle(0xffffff, 0.4);
    pitchLines.fillCircle(worldWidth / 2, marginY + fieldH / 2, 8);

    pitchLines.strokeRect(marginX, marginY + fieldH / 2 - 180, 150, 360);
    pitchLines.strokeRect(marginX, marginY + fieldH / 2 - 90, 60, 180);
    pitchLines.fillCircle(marginX + 110, marginY + fieldH / 2, 5);

    pitchLines.strokeRect(worldWidth - marginX - 150, marginY + fieldH / 2 - 180, 150, 360);
    pitchLines.strokeRect(worldWidth - marginX - 60, marginY + fieldH / 2 - 90, 60, 180);
    pitchLines.fillCircle(worldWidth - marginX - 110, marginY + fieldH / 2, 5);

    pitchLines.beginPath();
    pitchLines.arc(marginX, marginY, 25, 0, Math.PI / 2);
    pitchLines.strokePath();
    pitchLines.beginPath();
    pitchLines.arc(worldWidth - marginX, marginY, 25, Math.PI / 2, Math.PI);
    pitchLines.strokePath();
    pitchLines.beginPath();
    pitchLines.arc(marginX, marginY + fieldH, 25, 1.5 * Math.PI, 0);
    pitchLines.strokePath();
    pitchLines.beginPath();
    pitchLines.arc(worldWidth - marginX, marginY + fieldH, 25, Math.PI, 1.5 * Math.PI);
    pitchLines.strokePath();

    scene.obstacles = scene.physics.add.staticGroup();

    function createObliqueFlagPole(x, y, countryName, flagColor1, flagColor2) {
        const container = scene.add.container(x, y);
        const poleGfx = scene.add.graphics();
        poleGfx.lineStyle(5, 0xd1d5db, 1);
        poleGfx.beginPath();
        poleGfx.moveTo(0, 0);
        poleGfx.lineTo(0, -120);
        poleGfx.strokePath();

        poleGfx.fillStyle(flagColor1, 1);
        poleGfx.fillRect(0, -120, 45, 18);
        poleGfx.fillStyle(flagColor2, 1);
        poleGfx.fillRect(0, -102, 45, 18);

        poleGfx.fillStyle(0xfbcfe8, 1);
        poleGfx.fillCircle(0, -120, 6);

        const label = scene.add.text(0, -145, countryName, {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#1f2937',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5);

        container.add(poleGfx);
        container.add(label);

        const basePhysics = scene.add.circle(x, y, 15, 0x111827, 0.4);
        scene.physics.add.existing(basePhysics, true);
        scene.obstacles.add(basePhysics);

        container.setDepth(y);
        
        scene.tweens.add({
            targets: poleGfx,
            skewX: 0.08,
            duration: 800 + Math.random() * 400,
            yoyo: true,
            repeat: -1
        });
    }

    createObliqueFlagPole(200, 420, "MEXICO 🇲🇽", 0x15803d, 0xdc2626);
    createObliqueFlagPole(550, 390, "USA 🇺🇸", 0x1d4ed8, 0xdc2626);
    createObliqueFlagPole(1050, 390, "CANADA 🇨🇦", 0xdc2626, 0xffffff);
    createObliqueFlagPole(1400, 420, "FIFA 2026 ⚽", 0x14b8a6, 0x1e3a8a);

    function createObliqueGoalPost(x, y, side) {
        const goalContainer = scene.add.container(x, y);
        const netGfx = scene.add.graphics();
        const gH = 100;
        const gW = 120;
        const depthOffset = 30;

        netGfx.lineStyle(4, 0xffffff, 1);
        netGfx.strokeRect(-gW/2, -gH, gW, gH);

        netGfx.lineStyle(2, 0xd1d5db, 0.6);
        const backY = -gH + 15;
        const backXOffset = side === 'left' ? -depthOffset : depthOffset;

        netGfx.beginPath();
        for(let i = -gW/2; i <= gW/2; i += 20) {
            netGfx.moveTo(i, 0);
            netGfx.lineTo(i + (backXOffset/5), backY + gH - 10);
            netGfx.lineTo(i + backXOffset, backY);
        }
        for(let j = 0; j >= -gH; j -= 20) {
            netGfx.moveTo(-gW/2, j);
            netGfx.lineTo(gW/2, j);
        }
        netGfx.strokePath();

        const textStr = side === 'left' ? "HOME SECTOR" : "VISITORS";
        const goalLabel = scene.add.text(0, -gH - 20, textStr, {
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#fef08a',
            backgroundColor: '#1e3a8a', // Blue themed background label
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5);

        goalContainer.add(netGfx);
        goalContainer.add(goalLabel);
        goalContainer.setDepth(y);

        const collisionBase = scene.add.rectangle(x, y - 10, gW, 25, 0x000000, 0);
        scene.physics.add.existing(collisionBase, true);
        scene.obstacles.add(collisionBase);
    }

    createObliqueGoalPost(marginX, marginY + fieldH / 2, 'left');
    createObliqueGoalPost(worldWidth - marginX, marginY + fieldH / 2, 'right');

    scene.pedestalContainer = scene.add.container(gameAnchorX, gameAnchorY);

    const pedestalGfx = scene.add.graphics();
    pedestalGfx.fillStyle(0x1d4ed8, 1); // Blue step trim instead of green
    pedestalGfx.fillCircle(0, 30, 75);
    pedestalGfx.fillStyle(0xd97706, 1);
    pedestalGfx.fillRect(-60, 0, 120, 30);
    pedestalGfx.fillEllipse(0, 0, 120, 30);
    pedestalGfx.fillEllipse(0, 30, 120, 30);

    pedestalGfx.fillStyle(0xf59e0b, 1);
    pedestalGfx.fillRect(-45, -20, 90, 20);
    pedestalGfx.fillEllipse(0, -20, 90, 22);
    pedestalGfx.fillEllipse(0, 0, 90, 22);

    pedestalGfx.fillStyle(0xfbbf24, 1);
    pedestalGfx.fillRect(-30, -35, 60, 15);
    pedestalGfx.fillEllipse(0, -35, 60, 16);
    pedestalGfx.fillEllipse(0, -20, 60, 16);

    scene.pedestalContainer.add(pedestalGfx);

    const trophyGfx = scene.add.graphics();
    trophyGfx.fillStyle(0x1e3a8a, 1); // Blue bottom trophy ring
    trophyGfx.fillEllipse(0, -42, 18, 6);
    trophyGfx.fillStyle(0xfef08a, 1);
    trophyGfx.fillRect(-6, -65, 12, 23);
    trophyGfx.fillStyle(0xfbbf24, 1);
    trophyGfx.fillTriangle(-12, -65, -3, -48, -2, -65);
    trophyGfx.fillTriangle(12, -65, 3, -48, 2, -65);
    trophyGfx.fillStyle(0x38bdf8, 1);
    trophyGfx.fillCircle(0, -75, 14);
    trophyGfx.fillStyle(0x4ade80, 1);
    trophyGfx.fillCircle(-4, -78, 6);
    trophyGfx.fillCircle(5, -73, 5);
    trophyGfx.lineStyle(2, 0xfbbf24, 1);
    trophyGfx.strokeCircle(0, -75, 14);

    scene.pedestalContainer.add(trophyGfx);

    scene.haloGfx = scene.add.graphics();
    scene.haloGfx.lineStyle(3, 0x00ffff, 0.7);
    scene.haloGfx.strokeEllipse(0, 32, 130, 45);
    scene.haloGfx.setBlendMode(Phaser.BlendModes.ADD);
    scene.pedestalContainer.add(scene.haloGfx);

    const interactiveBanner = scene.add.text(0, -110, "🏆 2026 CHAMPIONS TROPHY 🏆\n(TOUCH TO RECEIVE GLOW)", {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#111827',
        padding: { x: 8, y: 5 },
        borderRadius: 4
    }).setOrigin(0.5);
    interactiveBanner.setStroke('#1d4ed8', 3); // Blue stroke style outline
    scene.pedestalContainer.add(interactiveBanner);

    scene.pedestalContainer.setDepth(gameAnchorY);

    const pedestalObstacle = scene.add.circle(gameAnchorX, gameAnchorY + 15, 60, 0xff0000, 0);
    scene.physics.add.existing(pedestalObstacle, true);
    scene.obstacles.add(pedestalObstacle);

    scene.sparkles = [];
    for (let i = 0; i < 15; i++) {
        const spark = scene.add.circle(
            gameAnchorX - 60 + Math.random() * 120,
            gameAnchorY - 90 + Math.random() * 60,
            2 + Math.random() * 4,
            0xfef08a,
            0.8
        );
        spark.setDepth(gameAnchorY + 10);
        scene.tweens.add({
            targets: spark,
            y: spark.y - (30 + Math.random() * 40),
            alpha: 0,
            scale: 0.1,
            duration: 1000 + Math.random() * 1000,
            repeat: -1,
            delay: Math.random() * 1500
        });
        scene.sparkles.push(spark);
    }

    scene.tweens.add({
        targets: trophyGfx,
        y: -10,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    const player = scene.add.container(800, 850);
    
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillEllipse(0, 18, 30, 12);
    player.add(shadow);

    const pBodyGfx = scene.add.graphics();
    pBodyGfx.fillStyle(0x1e3a8a, 1);
    pBodyGfx.fillRect(-12, -25, 24, 30);
    pBodyGfx.fillStyle(0xffffff, 1);
    pBodyGfx.fillRect(-6, -25, 4, 30);
    pBodyGfx.fillStyle(0xef4444, 1);
    pBodyGfx.fillRect(2, -25, 4, 30);

    pBodyGfx.fillStyle(0xffdbac, 1);
    pBodyGfx.fillCircle(0, -38, 12);
    pBodyGfx.fillStyle(0x000000, 1);
    pBodyGfx.fillRect(-12, -50, 24, 12);
    pBodyGfx.fillStyle(0xffffff, 1);
    pBodyGfx.fillRect(-12, -43, 24, 4);

    pBodyGfx.fillStyle(0x111827, 1);
    pBodyGfx.fillRect(-12, 5, 10, 8);
    pBodyGfx.fillRect(2, 5, 10, 8);
    
    pBodyGfx.fillStyle(0x3b82f6, 1);
    pBodyGfx.fillRect(-10, 13, 6, 8);
    pBodyGfx.fillRect(4, 13, 6, 8);

    pBodyGfx.fillStyle(0xfacc15, 1);
    pBodyGfx.fillRect(-12, 21, 10, 4);
    pBodyGfx.fillRect(2, 21, 10, 4);

    player.add(pBodyGfx);

    const pTag = scene.add.text(0, -68, "PLAYER 1", {
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#10b981',
        backgroundColor: '#111827',
        padding: { x: 3, y: 1 }
    }).setOrigin(0.5);
    player.add(pTag);

    scene.physics.world.enable(player);
    player.body.setCollideWorldBounds(true);
    player.body.setCircle(15, -15, 5);
    scene.player = player;
    scene.cameras.main.startFollow(player, true, 0.1, 0.1);

    scene.ball = scene.add.container(800, 950);
    
    const ballShadow = scene.add.graphics();
    ballShadow.fillStyle(0x000000, 0.45);
    ballShadow.fillEllipse(0, 12, 20, 8);
    scene.ball.add(ballShadow);

    const ballBody = scene.add.graphics();
    ballBody.fillStyle(0xffffff, 1);
    ballBody.fillCircle(0, 0, 12);
    ballBody.fillStyle(0x111827, 1);
    ballBody.fillCircle(0, 0, 4);
    ballBody.fillTriangle(-10, -5, -6, -10, -11, -11);
    ballBody.fillTriangle(10, 5, 6, 10, 11, 11);
    ballBody.fillTriangle(-8, 8, -4, 10, -10, 11);
    ballBody.fillTriangle(8, -8, 4, -10, 10, -11);
    
    scene.ball.add(ballBody);
    scene.physics.world.enable(scene.ball);
    scene.ball.body.setCollideWorldBounds(true);
    scene.ball.body.setBounce(0.7, 0.7);
    scene.ball.body.setDamping(true);
    scene.ball.body.setDrag(0.96);
    scene.ball.body.setCircle(12, -12, -12);

    scene.physics.add.collider(scene.ball, scene.obstacles);
    scene.physics.add.collider(scene.player, scene.ball, function(playerObj, ballObj) {
        const angle = Phaser.Math.Angle.Between(playerObj.x, playerObj.y, ballObj.x, ballObj.y);
        const speed = 260;
        scene.ball.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );
        scene.tweens.add({
            targets: ballBody,
            angle: '+=180',
            duration: 350
        });
    });

    scene.physics.add.collider(scene.player, scene.obstacles);

    scene.windParticles = [];
    for (let i = 0; i < 20; i++) {
        const particle = scene.add.graphics();
        particle.fillStyle(0xffffff, 0.2);
        particle.fillRect(0, 0, 20 + Math.random() * 30, 2);
        particle.setScrollFactor(0.8);
        
        const px = Math.random() * worldWidth;
        const py = 320 + Math.random() * (worldHeight - 400);
        particle.setPosition(px, py);

        scene.windParticles.push({
            obj: particle,
            speed: 2 + Math.random() * 4,
            resetX: -50,
            maxX: worldWidth + 50
        });
    }

    const billboardGfx = scene.add.graphics();
    billboardGfx.fillStyle(0x1e293b, 1);
    billboardGfx.fillRect(700, 1150, 200, 30);
    billboardGfx.lineStyle(3, 0xfbbf24, 1);
    billboardGfx.strokeRect(700, 1150, 200, 30);

    const billboardText = scene.add.text(800, 1165, "🚪 STADIUM EXIT GATE", {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f8fafc'
    }).setOrigin(0.5);

    billboardGfx.setDepth(1140);
    billboardText.setDepth(1141);

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

    const speed = 250;
    let vx = 0;
    let vy = 0;

    if (scene.cursors.left.isDown || scene.keysWASD.left.isDown) {
        vx = -speed;
    } else if (scene.cursors.right.isDown || scene.keysWASD.right.isDown) {
        vx = speed;
    }

    if (scene.cursors.up.isDown || scene.keysWASD.up.isDown) {
        vy = -speed;
    } else if (scene.cursors.down.isDown || scene.keysWASD.down.isDown) {
        vy = speed;
    }

    scene.player.body.setVelocity(vx, vy);

    scene.player.setDepth(scene.player.y);
    scene.ball.setDepth(scene.ball.y);

    if (scene.haloGfx) {
        scene.haloGfx.rotation += 0.015;
    }

    if (scene.clouds) {
        scene.clouds.forEach(cloud => {
            cloud.obj.x += cloud.speed;
            if (cloud.obj.x > 1700) {
                cloud.obj.x = -100;
            }
        });
    }

    if (scene.windParticles) {
        scene.windParticles.forEach(p => {
            p.obj.x += p.speed;
            if (p.obj.x > p.maxX) {
                p.obj.x = p.resetX;
                p.obj.y = 320 + Math.random() * 800;
            }
        });
    }
}

export function onExit(scene) {
    scene.roomData = null;
}

export function createOtherPlayer(scene, { x, y }) {
    const container = scene.add.container(x, y);
    
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillEllipse(0, 18, 30, 12);
    container.add(shadow);

    const bodyGfx = scene.add.graphics();
    bodyGfx.fillStyle(0x1e3a8a, 1);
    bodyGfx.fillRect(-12, -25, 24, 30);
    bodyGfx.fillStyle(0xffffff, 1);
    bodyGfx.fillRect(-6, -25, 4, 30);
    bodyGfx.fillStyle(0xef4444, 1);
    bodyGfx.fillRect(2, -25, 4, 30);

    bodyGfx.fillStyle(0xffdbac, 1);
    bodyGfx.fillCircle(0, -38, 12);
    bodyGfx.fillStyle(0x000000, 1);
    bodyGfx.fillRect(-12, -50, 24, 12);
    bodyGfx.fillStyle(0xffffff, 1);
    bodyGfx.fillRect(-12, -43, 24, 4);

    bodyGfx.fillStyle(0x111827, 1);
    bodyGfx.fillRect(-12, 5, 10, 8);
    bodyGfx.fillRect(2, 5, 10, 8);
    
    bodyGfx.fillStyle(0x3b82f6, 1);
    bodyGfx.fillRect(-10, 13, 6, 8);
    bodyGfx.fillRect(4, 13, 6, 8);

    bodyGfx.fillStyle(0xfacc15, 1);
    bodyGfx.fillRect(-12, 21, 10, 4);
    bodyGfx.fillRect(2, 21, 10, 4);

    container.add(bodyGfx);

    const tag = scene.add.text(0, -68, "PLAYER", {
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#10b981',
        backgroundColor: '#111827',
        padding: { x: 3, y: 1 }
    }).setOrigin(0.5);
    container.add(tag);

    container._labelOffsetY = 68;
    return container;
}