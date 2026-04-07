// vibrant-city-center.js — "Vibrant City Center" player room
// Submitted by a player via the two-prompt Gemini flow.

export const name = 'Vibrant City Center';

export function onLoad(scene) {
}

export function onCreate(scene) {
  scene.roomData = {};

  // Background — grass lots
  scene.add.rectangle(400, 300, 800, 600, 0x2d5e32);

  // Roads
  scene.add.rectangle(400, 300, 800, 150, 0x333333); // horizontal
  scene.add.rectangle(400, 300, 120, 600, 0x333333); // vertical

  // Road markings
  for (let i = 0; i < 800; i += 60) {
    scene.add.rectangle(i, 300, 30, 4, 0xffffff);
  }
  for (let i = 0; i < 600; i += 60) {
    if (i < 220 || i > 380) {
      scene.add.rectangle(400, i, 4, 30, 0xffffff);
    }
  }

  // Sidewalks
  scene.add.rectangle(400, 215, 800, 20, 0x999999);
  scene.add.rectangle(400, 385, 800, 20, 0x999999);

  // Buildings and shops
  const shops = [
    { x: 150, y: 120, color: 0xe74c3c, name: 'Pizza' },
    { x: 650, y: 120, color: 0x3498db, name: 'Tech'  },
    { x: 150, y: 480, color: 0xf1c40f, name: 'Cafe'  },
    { x: 650, y: 480, color: 0x9b59b6, name: 'Mart'  },
  ];
  shops.forEach(shop => {
    scene.add.rectangle(shop.x, shop.y, 180, 120, 0x555555);
    scene.add.rectangle(shop.x, shop.y, 170, 110, shop.color);
    scene.add.rectangle(shop.x - 40, shop.y - 20, 30, 30, 0xaaeeff);
    scene.add.rectangle(shop.x + 40, shop.y - 20, 30, 30, 0xaaeeff);
    scene.add.text(shop.x, shop.y + 20, shop.name, {
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#ffffff',
    }).setOrigin(0.5);
  });

  // Animated cars
  scene.roomData.cars = [];
  const createCar = (y, speed, color) => {
    const car  = scene.add.container(-50, y);
    const body = scene.add.rectangle(0, 0, 60, 30, color, 1).setStrokeStyle(2, 0x000000);
    const roof = scene.add.rectangle(0, 0, 30, 20, 0xffffff, 0.3);
    car.add([body, roof]);
    scene.roomData.cars.push({ obj: car, speed: speed });
  };
  createCar(260,  3, 0xff0000);
  createCar(340, -4, 0x00ff00);

  // Animated pedestrians
  for (let i = 0; i < 5; i++) {
    const p = scene.add.circle(Phaser.Math.Between(50, 750), 215, 8, 0xffdbac);
    scene.tweens.add({
      targets: p,
      x: p.x + Phaser.Math.Between(100, 200) * (Math.random() > 0.5 ? 1 : -1),
      duration: Phaser.Math.Between(2000, 4000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // Ensure player renders above room elements
  if (scene.player) scene.player.setDepth(10);

  // Exit trigger
  scene.add.rectangle(400, 570, 120, 30, 0x333333);
  scene.add.text(400, 570, 'EXIT', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
  const exitZone = scene.add.zone(400, 555, 120, 40);
  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);
  scene.roomData.exitZone = exitZone;
  scene.roomData.player = scene.player;
}

export function onUpdate(scene) {
  // Exit check
  const d = scene.roomData;
  if (d.player && d.exitZone) {
    const hit = Phaser.Geom.Intersects.RectangleToRectangle(
      d.player.getBounds(), d.exitZone.getBounds()
    );
    if (hit) scene.exitRoom();
  }

  // Drive cars across the screen
  if (d.cars) {
    d.cars.forEach(car => {
      car.obj.x += car.speed;
      if (car.speed > 0 && car.obj.x >  850) car.obj.x = -50;
      if (car.speed < 0 && car.obj.x < -50)  car.obj.x =  850;
    });
  }
}

export function onExit(scene) {
  scene.roomData = null;
}
