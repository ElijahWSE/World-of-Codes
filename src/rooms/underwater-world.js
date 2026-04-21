export const name = 'The Abyssal Citadel';

export function onLoad(scene) {
    // No external assets required as we use geometric primitives
}

export function onCreate(scene) {
    const worldWidth = 1600;
    const worldHeight = 1200;
    const horizonY = 300;

    // Initialize state container
    scene.roomData = {
        creatures: [],
        bubbles: [],
        exitZone: null,
        player: scene.player
    };

    // 1. BACKGROUND & HORIZON
    scene.add.rectangle(worldWidth / 2, horizonY / 2, worldWidth, horizonY, 0x004466);
    
    const mountains = scene.add.graphics();
    mountains.fillStyle(0x002233, 1);
    mountains.beginPath();
    mountains.moveTo(0, horizonY);
    mountains.lineTo(300, 150);
    mountains.lineTo(600, horizonY);
    mountains.lineTo(800, 100);
    mountains.lineTo(1100, horizonY);
    mountains.lineTo(1400, 200);
    mountains.lineTo(1600, horizonY);
    mountains.closePath();
    mountains.fillPath();

    // 2. THE SEAFLOOR
    const floor = scene.add.rectangle(worldWidth / 2, (worldHeight + horizonY) / 2, worldWidth, worldHeight - horizonY, 0x116688);
    floor.setDepth(0);
    
    // Decorative Sand Patches
    for (let i = 0; i < 20; i++) {
        const rx = Math.floor(Math.random() * 1600);
        const ry = 400 + Math.floor(Math.random() * 750);
        const sand = scene.add.circle(rx, ry, 30 + Math.floor(Math.random() * 50), 0xc2b280, 0.2);
        sand.setDepth(1);
    }

    // 3. STRUCTURES
    const arch = scene.add.graphics();
    arch.lineStyle(20, 0xddddff, 0.8);
    arch.strokePoints([{x: 650, y: 550}, {x: 650, y: 400}, {x: 950, y: 400}, {x: 950, y: 550}]);
    arch.setDepth(5);

    const pearl = scene.add.circle(800, 400, 25, 0xffffef);
    pearl.setDepth(6);
    scene.tweens.add({
        targets: pearl,
        scale: 1.2,
        alpha: 0.7,
        duration: 1500,
        yoyo: true,
        repeat: -1
    });

    const c1 = scene.add.rectangle(800, 650, 400, 300, 0x4a4a8a);
    const c2 = scene.add.rectangle(800, 500, 200, 200, 0x5a5a9a);
    const c3 = scene.add.text(800, 650, "C I T A D E L", { fontSize: '32px', fill: '#00ffff' }).setOrigin(0.5);
    [c1, c2, c3].forEach(c => c.setDepth(5));

    [550, 1050].forEach(x => {
        const t1 = scene.add.rectangle(x, 600, 80, 250, 0x3a3a7a);
        const t2 = scene.add.triangle(x, 450, 0, 50, 80, 50, 40, 0, 0x2a2a6a);
        const star = scene.add.star(x, 420, 5, 15, 30, 0xffff00);
        [t1, t2, star].forEach(t => t.setDepth(5));
        scene.tweens.add({ targets: star, angle: 360, duration: 4000, repeat: -1 });
    });

    // 4. WATER CREATURES
    // Giant Jellyfish
    const jellyBody = scene.add.circle(400, 500, 40, 0xff99ff, 0.6);
    const jellyLabel = scene.add.text(400, 500, "◕", { fontSize: '40px' }).setOrigin(0.5);
    const jellyGroup = scene.add.container(0, 0, [jellyBody, jellyLabel]);
    jellyGroup.setDepth(30);
    scene.roomData.creatures.push({ type: 'jelly', obj: jellyGroup, angle: 0 });
    
    scene.tweens.add({
        targets: jellyBody,
        scaleY: 0.8,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // School of Glow-Fish
    for (let i = 0; i < 8; i++) {
        const fx = 200 + Math.floor(Math.random() * 1200);
        const fy = 400 + Math.floor(Math.random() * 600);
        const fish = scene.add.ellipse(0, 0, 30, 15, 0x00ffcc);
        const eye = scene.add.circle(10, 0, 2, 0x000000);
        const fishContainer = scene.add.container(fx, fy, [fish, eye]);
        fishContainer.setDepth(25);
        scene.roomData.creatures.push({ 
            type: 'fish', 
            obj: fishContainer, 
            speed: 1 + (Math.random() * 2), 
            offset: Math.random() * 100 
        });
    }

    // Sea Snails
    for (let i = 0; i < 5; i++) {
        const sx = 100 + Math.floor(Math.random() * 1400);
        const sy = 800 + Math.floor(Math.random() * 300);
        const shell = scene.add.circle(0, 0, 15, 0xffccaa);
        const snailBody = scene.add.rectangle(10, 10, 30, 10, 0xffffff);
        const snail = scene.add.container(sx, sy, [snailBody, shell]);
        snail.setDepth(3);
        scene.roomData.creatures.push({ type: 'snail', obj: snail });
    }

    // 5. ANIMATED ELEMENTS (Bubbles & Kelp)
    for (let i = 0; i < 40; i++) {
        const b = scene.add.circle(
            Math.floor(Math.random() * 1600), 
            Math.floor(Math.random() * 1200), 
            3 + Math.floor(Math.random() * 7), 
            0xffffff, 0.4
        );
        b.setDepth(20);
        scene.roomData.bubbles.push(b);
    }

    for (let i = 0; i < 15; i++) {
        const kx = 100 + Math.floor(Math.random() * 1400);
        const ky = 400 + Math.floor(Math.random() * 700);
        const kelp = scene.add.rectangle(kx, ky, 15, 80, 0x228b22);
        kelp.setDepth(4);
        scene.tweens.add({ 
            targets: kelp, 
            skewX: 0.2, 
            duration: 2000 + (Math.random() * 1000), 
            yoyo: true, 
            repeat: -1, 
            ease: 'Sine.easeInOut' 
        });
    }

    // 6. EXIT TRIGGER
    const exitLabel = scene.add.text(800, 1180, "▼ TO SURFACE ▼", { 
        fontSize: '24px', 
        fill: '#ffffff', 
        stroke: '#00ffff', 
        strokeThickness: 4 
    }).setOrigin(0.5);
    exitLabel.setDepth(10);
    scene.tweens.add({ targets: exitLabel, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });

    const exitZone = scene.add.zone(800, 1155, 120, 40);
    scene.physics.add.existing(exitZone, true);
    scene.roomData.exitZone = exitZone;

    // Set world bounds for the camera
    scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    if (scene.player) scene.player.setDepth(100);
}

export function onUpdate(scene) {
    const d = scene.roomData;
    if (!d) return;

    // Animate Creatures
    if (d.creatures) {
        d.creatures.forEach(c => {
            if (c.type === 'jelly') {
                c.angle += 0.005;
                c.obj.x = 800 + Math.cos(c.angle) * 400;
                c.obj.y = 600 + Math.sin(c.angle) * 200;
            } else if (c.type === 'fish') {
                c.obj.x += c.speed;
                c.obj.y += Math.sin((scene.time.now / 500) + c.offset) * 1;
                if (c.obj.x > 1650) c.obj.x = -50;
            } else if (c.type === 'snail') {
                c.obj.x += 0.2;
                if (c.obj.x > 1650) c.obj.x = -50;
            }
        });
    }

    // Animate Bubbles
    if (d.bubbles) {
        d.bubbles.forEach(b => {
            b.y -= 1.5;
            b.x += Math.sin((scene.time.now / 500) + b.y) * 0.5;
            if (b.y < -20) { 
                b.y = 1220; 
                b.x = Math.floor(Math.random() * 1600); 
            }
        });
    }

    // Exit check (manual intersection check to avoid complex physics)
    if (scene.player && d.exitZone) {
        const px = scene.player.x;
        const py = scene.player.y;
        const ez = d.exitZone;
        
        if (px > ez.x - ez.width/2 && px < ez.x + ez.width/2 &&
            py > ez.y - ez.height/2 && py < ez.y + ez.height/2) {
            scene.exitRoom();
        }
    }
}

export function onExit(scene) {
    scene.roomData = null;
}