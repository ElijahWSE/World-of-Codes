export const name = 'The Whispering Emerald Basin';

export function onLoad(scene) {
    // No external assets required as we use graphics and emoji text
}

export function onCreate(scene) {
    scene.roomData = {};
    const width = 800;
    const height = 600;

    // 1. Background: Deep Forest Floor
    scene.cameras.main.setBackgroundColor('#051a05');
    const bg = scene.add.graphics();
    bg.fillGradientStyle(0x051a05, 0x051a05, 0x0a2b0a, 0x0a2b0a, 1);
    bg.fillRect(0, 0, width, height);
    
    // Texture for the ground: Scattered moss patches
    for(let i = 0; i < 40; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const moss = scene.add.graphics();
        moss.fillStyle(0x1a3311, 0.4);
        moss.fillEllipse(x, y, 40 + Math.random() * 60, 20 + Math.random() * 30);
    }

    // 2. Bioluminescent Pool
    const poolX = 400;
    const poolY = 280;
    
    // Subtle atmosphere glow
    const poolGlow = scene.add.graphics();
    poolGlow.fillStyle(0x00ffaa, 0.1);
    poolGlow.fillCircle(poolX, poolY, 130);
    scene.tweens.add({
        targets: poolGlow,
        alpha: 0.05,
        scale: 1.1,
        duration: 3000,
        yoyo: true,
        loop: -1
    });

    // The main water body (solid base)
    const waterBase = scene.add.graphics();
    waterBase.fillStyle(0x002211, 1);
    waterBase.fillEllipse(poolX, poolY, 180, 140);
    
    // The glowing surface
    const surface = scene.add.graphics();
    surface.fillStyle(0x00ffaa, 0.2);
    surface.fillEllipse(poolX, poolY, 170, 130);
    surface.lineStyle(3, 0x00ffaa, 0.4);
    surface.strokeEllipse(poolX, poolY, 175, 135);

    // Animated Ripples
    for(let i = 0; i < 3; i++) {
        const ripple = scene.add.graphics();
        ripple.lineStyle(2, 0x00ffaa, 0.4);
        ripple.strokeEllipse(poolX, poolY, 10, 8);
        scene.tweens.add({
            targets: ripple,
            scale: 15,
            alpha: 0,
            duration: 4000,
            delay: i * 1300,
            loop: -1
        });
    }

    scene.add.text(poolX, poolY + 90, "BIOLUMINESCENT POOL", {
        fontSize: '10px', color: '#00ffaa', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0.6);

    // 3. Foliage: Trees and Plants
    const flora = ['🌴', '🎋', '🌿', '🌵', '🌱'];
    for(let i = 0; i < 40; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        
        // Clear area around pool and exit
        if (Math.hypot(x - poolX, y - poolY) < 130) continue;
        if (y > 500 && x > 300 && x < 500) continue;

        const icon = flora[Math.floor(Math.random() * flora.length)];
        const size = 50 + Math.random() * 50;
        
        const plant = scene.add.text(x, y, icon, { fontSize: `${size}px` })
            .setOrigin(0.5, 0.9)
            .setAlpha(0.9)
            .setDepth(y / 10);
        
        scene.tweens.add({
            targets: plant,
            angle: { from: -2, to: 2 },
            duration: 2500 + Math.random() * 2000,
            yoyo: true,
            loop: -1
        });
    }

    // 4. Animals: Moving Monkeys, Parrots, Butterflies
    const animalTypes = ['🐒', '🦜', '🦋'];
    for(let i = 0; i < 6; i++) {
        const type = animalTypes[Math.floor(Math.random() * animalTypes.length)];
        const startX = Math.random() * width;
        const startY = Math.random() * height;
        
        const animal = scene.add.text(startX, startY, type, { fontSize: '30px' })
            .setOrigin(0.5)
            .setDepth(startY / 10 + 1);

        const moveAnimal = () => {
            if (!animal.active) return;
            const nextX = Math.min(Math.max(animal.x + (Math.random() * 200 - 100), 50), 750);
            const nextY = Math.min(Math.max(animal.y + (Math.random() * 200 - 100), 50), 550);
            
            scene.tweens.add({
                targets: animal,
                x: nextX,
                y: nextY,
                duration: 3000 + Math.random() * 3000,
                ease: 'Sine.easeInOut',
                onUpdate: () => { animal.setDepth(animal.y / 10 + 1); },
                onComplete: () => {
                    if (animal.active) {
                        scene.time.delayedCall(Math.random() * 2000, moveAnimal);
                    }
                }
            });
        };
        moveAnimal();
    }

    // 5. Fireflies (Generated via Particle System)
    const pGraphics = scene.make.graphics({x: 0, y: 0, add: false});
    pGraphics.fillStyle(0xffffaa, 1);
    pGraphics.fillCircle(3, 3, 3);
    pGraphics.generateTexture('firefly', 6, 6);

    scene.add.particles(0, 0, 'firefly', {
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 0, 800, 600) },
        speed: { min: 5, max: 15 },
        lifespan: 3000,
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0, end: 1, yoyo: true },
        blendMode: 'ADD',
        frequency: 100
    });

    // 6. Foreground Vines
    const drawVine = (startX) => {
        const v = scene.add.graphics().setDepth(200);
        v.lineStyle(12, 0x0a1a05, 1);
        v.beginPath();
        v.moveTo(startX, -50);
        v.lineTo(startX + 20, 200);
        v.lineTo(startX - 10, 400);
        v.lineTo(startX + 10, 650);
        v.strokePath();

        for(let i = 0; i < 6; i++) {
            scene.add.text(startX + (i % 2 === 0 ? 15 : -15), i * 100, '🍃', { fontSize: '40px' })
                .setDepth(201)
                .setOrigin(0.5);
        }
    };
    drawVine(30);
    drawVine(770);

    // 7. Exit Zone
    const exitMarker = scene.add.graphics().setDepth(100);
    exitMarker.fillStyle(0x331a00, 1);
    exitMarker.fillRoundedRect(340, 565, 120, 25, 10);
    scene.add.text(400, 550, "TO JUNGLE PATH", { 
        fontSize: '12px', 
        color: '#a4f4a4', 
        fontStyle: 'bold' 
    }).setOrigin(0.5).setDepth(101);

    const exitZone = scene.add.zone(400, 575, 120, 40);
    scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
    scene.roomData.exitZone = exitZone;
}

export function onUpdate(scene) {
    const d = scene.roomData;
    const player = scene.player;

    if (player) {
        // Dynamic Depth Sorting
        player.setDepth(player.y / 10);

        // Exit Trigger Detection
        if (d.exitZone) {
            const hit = Phaser.Geom.Intersects.RectangleToRectangle(
                player.getBounds(), d.exitZone.getBounds()
            );
            if (hit) {
                scene.exitRoom();
            }
        }
    }
}

export function onExit(scene) {
    scene.roomData = null;
}