export const name = 'Heart of the Canopy';

export function onLoad(scene) {
    // No external assets required for this procedural jungle
}

export function onCreate(scene) {
    scene.roomData = {};

    // 1. Background: Jungle Floor Texture
    scene.add.rectangle(400, 300, 800, 600, 0x1a2e1a);
    
    // Procedural ground details
    for (let i = 0; i < 20; i++) {
        scene.add.circle(
            Math.random() * 800,
            Math.random() * 600,
            Math.random() * 10 + 5,
            0x2d1f14, 0.3
        ).setDepth(0);
    }

    // 2. Ferns & Ground Plants (Rotating Stars)
    for (let i = 0; i < 15; i++) {
        const fern = scene.add.star(
            Math.random() * 700 + 50,
            Math.random() * 500 + 50,
            5, 8, 15, 0x228b22
        );
        fern.setDepth(1);
        scene.tweens.add({
            targets: fern,
            angle: 360,
            duration: 10000 + Math.random() * 5000,
            repeat: -1
        });
    }

    // 3. YOUR DOG (Follower)
    const dog = scene.add.rectangle(420, 320, 18, 12, 0xdaa520);
    dog.setDepth(9); // Just below the player
    dog.setStrokeStyle(1, 0x000000);
    scene.roomData.dog = dog;

    // 4. ROAMING ANIMALS (Ground & Air)
    scene.roomData.animals = [];
    
    // Capybaras (Slow ground roamers)
    for (let i = 0; i < 4; i++) {
        const capy = scene.add.rectangle(
            Math.random() * 600 + 100,
            Math.random() * 400 + 100,
            24, 16, 0x8b4513
        );
        capy.setDepth(5); 
        capy.state = 'walking';
        capy.nextDecision = scene.time.now + (Math.random() * 2000 + 1000);
        capy.targetAngle = Math.random() * Math.PI * 2;
        scene.roomData.animals.push(capy);
    }

    // Birds (Fast air roamers)
    scene.roomData.birds = [];
    for (let i = 0; i < 3; i++) {
        const bird = scene.add.star(
            Math.random() * 800,
            Math.random() * 600,
            3, 4, 10, 0x00ffff
        );
        bird.setDepth(45); 
        scene.roomData.birds.push(bird);
    }

    // 5. Top-Down Tree Canopies
    scene.roomData.trees = [];
    const treePositions = [
        {x: 100, y: 100}, {x: 250, y: 150}, {x: 150, y: 400},
        {x: 600, y: 100}, {x: 700, y: 300}, {x: 650, y: 500},
        {x: 350, y: 50}, {x: 500, y: 450}
    ];

    treePositions.forEach((pos, idx) => {
        const baseRadius = 60 + Math.random() * 40;
        const shadow = scene.add.circle(pos.x + 10, pos.y + 10, baseRadius, 0x000000, 0.3).setDepth(2);

        const colors = [0x004d00, 0x006400, 0x228b22];
        colors.forEach((color, cIdx) => {
            const layer = scene.add.circle(pos.x + (cIdx * 5), pos.y + (cIdx * 5), baseRadius - (cIdx * 15), color);
            layer.setDepth(20 + cIdx); 
            
            scene.tweens.add({
                targets: [layer, shadow],
                x: '+=5', y: '+=3', scale: 1.05,
                duration: 3000 + (idx * 200),
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        });
    });

    // 6. Fireflies
    scene.roomData.fireflies = [];
    for (let i = 0; i < 25; i++) {
        const fly = scene.add.circle(Math.random() * 800, Math.random() * 600, 2, 0xffff00).setDepth(50);
        scene.roomData.fireflies.push(fly);
    }

    // 7. Exit Zone Visuals
    scene.add.rectangle(400, 580, 120, 40, 0x3d2b1f).setDepth(1);
    scene.add.text(400, 545, "EXIT PATH", { 
        fontSize: '14px', 
        fill: '#ffffff', 
        backgroundColor: '#00000088' 
    }).setOrigin(0.5).setDepth(1);

    // Required Exit Trigger Block
    const exitZone = scene.add.zone(400, 555, 120, 40);
    scene.physics.world.enable(exitZone, 1); // 1 = STATIC_BODY
    scene.roomData.exitZone = exitZone;
}

export function onUpdate(scene) {
    const d = scene.roomData;
    const player = scene.player;

    // DOG FOLLOW LOGIC
    if (d.dog && player) {
        const dist = Math.hypot(d.dog.x - player.x, d.dog.y - player.y);
        if (dist > 45) {
            const angle = Math.atan2(player.y - d.dog.y, player.x - d.dog.x);
            d.dog.x += Math.cos(angle) * 3;
            d.dog.y += Math.sin(angle) * 3;
            d.dog.rotation = angle;
            d.dog.scaleY = 1 + Math.sin(scene.time.now / 100) * 0.1;
        } else {
            d.dog.scaleY = 1 + Math.sin(scene.time.now / 500) * 0.05;
        }
    }

    // Animal AI: Capybaras
    if (d.animals) {
        d.animals.forEach(a => {
            if (scene.time.now > a.nextDecision) {
                a.state = a.state === 'idle' ? 'walking' : 'idle';
                a.nextDecision = scene.time.now + (Math.random() * 3000 + 2000);
                if (a.state === 'walking') a.targetAngle = Math.random() * Math.PI * 2;
            }

            if (a.state === 'walking') {
                a.x += Math.cos(a.targetAngle) * 0.5;
                a.y += Math.sin(a.targetAngle) * 0.5;
                a.rotation = a.targetAngle;

                if (a.x < 0) a.x = 800; if (a.x > 800) a.x = 0;
                if (a.y < 0) a.y = 600; if (a.y > 600) a.y = 0;
            }
        });
    }

    // Animal AI: Birds
    if (d.birds) {
        d.birds.forEach((b, i) => {
            b.x += 2 + Math.sin(scene.time.now / 500) * 1;
            b.y += Math.cos(scene.time.now / 1000 + i) * 1.5;
            if (b.x > 850) b.x = -50;
        });
    }

    // Firefly behavior
    if (d.fireflies) {
        d.fireflies.forEach((f, i) => {
            f.x += Math.sin(scene.time.now / 1000 + i) * 1;
            f.y += Math.cos(scene.time.now / 1000 + i) * 1;
            f.alpha = 0.5 + Math.sin(scene.time.now / 500 + i) * 0.5;
        });
    }

    // Required Exit Check
    if (player && d.exitZone) {
        const hit = (
            player.x > d.exitZone.x - 60 && 
            player.x < d.exitZone.x + 60 && 
            player.y > d.exitZone.y - 20 && 
            player.y < d.exitZone.y + 20
        );
        if (hit) scene.exitRoom();
    }
}

export function onExit(scene) {
    scene.roomData = null;
}