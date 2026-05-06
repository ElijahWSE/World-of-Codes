export const name = 'School Court - Modern Green';

export function onLoad(scene) {
}

export function onCreate(scene) {
scene.roomData = {
hoops: [],
isShooting: false
};

const worldWidth = 1600;
const worldHeight = 1200;
const horizonY = 320;

const colBorder = 0xe67e22;
const colInner = 0x27ae60;
const colLines = 0xffffff;
const colHoop = 0x95afc0;

scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);

const gfx = scene.add.graphics();

// 1. SKY & DISTANT BACKGROUND
for (let i = 0; i < horizonY; i++) {
const ratio = i / horizonY;
const r = Phaser.Math.Linear(135, 200, ratio);
const g = Phaser.Math.Linear(206, 220, ratio);
const b = Phaser.Math.Linear(235, 200, ratio);
gfx.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
gfx.fillRect(0, i, worldWidth, 1);
}

gfx.fillStyle(0x7f8c8d, 1);
gfx.fillRect(150, 200, 300, 120);
gfx.fillStyle(0x2ecc71, 0.4);
for (let x = 0; x < worldWidth; x += 80) {
gfx.fillCircle(x, horizonY, 40);
}

// 2. GROUND
gfx.fillStyle(colBorder, 1);
gfx.fillRect(0, horizonY, worldWidth, worldHeight - horizonY);

const courtPadding = 120;
const courtX = courtPadding;
const courtY = 400;
const courtW = worldWidth - (courtPadding * 2);
const courtH = 700;

gfx.fillStyle(colInner, 1);
gfx.fillRect(courtX, courtY, courtW, courtH);

gfx.fillStyle(colBorder, 1);
gfx.fillRect(courtX, courtY + 200, 250, 300);
gfx.fillRect(courtX + courtW - 250, courtY + courtH / 2, 250, 300);
gfx.fillCircle(worldWidth / 2, courtY + courtH / 2, 70);

// 3. COURT MARKINGS
gfx.lineStyle(6, colLines, 1);
gfx.strokeRect(courtX, courtY, courtW, courtH);
gfx.beginPath();
gfx.moveTo(worldWidth / 2, courtY);
gfx.lineTo(worldWidth / 2, courtY + courtH);
gfx.strokePath();
gfx.strokeCircle(worldWidth / 2, courtY + courtH / 2, 70);
gfx.strokeCircle(courtX + 100, courtY + courtH / 2, 250);
gfx.strokeCircle(courtX + courtW - 100, courtY + courtH / 2, 250);

// 4. OBLIQUE OBJECTS
const drawHoop = (x, y, isRight) => {
const hoopGroup = scene.add.container(x, y);
const hGfx = scene.add.graphics();
hGfx.fillStyle(colHoop, 1);
hGfx.fillRect(-8, -140, 16, 140);
hGfx.fillStyle(0xffffff, 1);
hGfx.fillRect(isRight ? -60 : 0, -210, 60, 90);
hGfx.lineStyle(3, 0x2f3542, 1);
hGfx.strokeRect(isRight ? -60 : 0, -210, 60, 90);
hGfx.lineStyle(4, 0xe17055, 1);
hGfx.strokeCircle(isRight ? -35 : 35, -150, 18);
hoopGroup.add(hGfx);
hoopGroup.setDepth(y);

scene.roomData.hoops.push({
  x: x + (isRight ? -35 : 35),
  y: y - 150,
  groundY: y
});
};
drawHoop(courtX, courtY + courtH / 2, false);
drawHoop(courtX + courtW, courtY + courtH / 2, true);

// 5. ANIMATED PARTICLES
for (let i = 0; i < 15; i++) {
const p = scene.add.circle(Phaser.Math.Between(0, worldWidth), Phaser.Math.Between(horizonY, worldHeight), 3, 0xffffff, 0.4);
scene.tweens.add({
targets: p,
x: '+=100',
y: '+=20',
duration: 4000 + Math.random() * 2000,
repeat: -1,
onRepeat: () => { p.x = Phaser.Math.Between(-100, worldWidth); p.y = Phaser.Math.Between(horizonY, worldHeight); }
});
}

// 6. PLAYER
const player = scene.add.container(800, 750);
const pBody = scene.add.rectangle(0, 0, 40, 64, 0x34495e);
pBody.setOrigin(0.5, 1);
const pHead = scene.add.circle(0, -70, 18, 0xffdbac);
player.add([pBody, pHead]);
scene.physics.world.enable(player);
player.body.setCollideWorldBounds(true);
scene.player = player;
scene.cameras.main.startFollow(player, true, 0.1, 0.1);

// 7. THE BOUNCING BASKETBALL
const ballContainer = scene.add.container(850, 800);
const ballShadow = scene.add.ellipse(0, 0, 32, 12, 0x000000, 0.3);
const ballGfx = scene.add.graphics();
ballGfx.fillStyle(0xd35400, 1);
ballGfx.fillCircle(0, 0, 12);
ballGfx.lineStyle(1.5, 0x000000, 0.8);
ballGfx.beginPath();
ballGfx.moveTo(-12, 0); ballGfx.lineTo(12, 0);
ballGfx.moveTo(0, -12); ballGfx.lineTo(0, 12);
ballGfx.strokePath();
ballGfx.strokeCircle(0, 0, 12);

ballContainer.add([ballShadow, ballGfx]);
scene.physics.world.enable(ballContainer);
ballContainer.body.setDamping(true);
ballContainer.body.setDrag(0.1);

const startBounce = () => {
scene.tweens.killTweensOf(ballGfx);
ballGfx.y = 0;
scene.roomData.bounceTween = scene.tweens.add({
targets: ballGfx,
y: -50,
duration: 400,
yoyo: true,
repeat: -1,
ease: 'Power1.easeOut',
onUpdate: () => {
const height = Math.abs(ballGfx.y);
const scale = Phaser.Math.Clamp(1 - (height / 80), 0.4, 1);
const alpha = Phaser.Math.Clamp(0.3 - (height / 200), 0.05, 0.3);
ballShadow.setScale(scale);
ballShadow.setAlpha(alpha);
}
});
};

scene.roomData.ball = ballContainer;
scene.roomData.ballGfx = ballGfx;
scene.roomData.ballShadow = ballShadow;
scene.roomData.startBounce = startBounce;
startBounce();

scene.roomData.cursors = scene.input.keyboard.createCursorKeys();
scene.roomData.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

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

const player = scene.player;
const ball = d.ball;
const cursors = d.cursors;

if (player && player.body) {
player.body.setVelocity(0);
const speed = 400;
if (cursors.left.isDown) player.body.setVelocityX(-speed);
else if (cursors.right.isDown) player.body.setVelocityX(speed);
if (cursors.up.isDown) player.body.setVelocityY(-speed);
else if (cursors.down.isDown) player.body.setVelocityY(speed);  

if (player.y < 400) player.y = 400;

if (Phaser.Input.Keyboard.JustDown(d.spaceKey) && !d.isShooting) {
  d.isShooting = true;
  if (d.bounceTween) d.bounceTween.stop();
  scene.tweens.killTweensOf(d.ballGfx);

  const closestHoop = d.hoops.reduce((prev, curr) => {
    return (Phaser.Math.Distance.Between(player.x, player.y, curr.x, curr.groundY) <
      Phaser.Math.Distance.Between(player.x, player.y, prev.x, prev.groundY)) ? curr : prev;
  });

  scene.tweens.add({
    targets: ball,
    x: closestHoop.x,
    y: closestHoop.groundY,
    duration: 800,
    ease: 'Linear',
    onComplete: () => {
      d.isShooting = false;
      d.startBounce();
    }
  });

  scene.tweens.add({
    targets: d.ballGfx,
    y: -200,
    duration: 400,
    yoyo: true,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      const height = Math.abs(d.ballGfx.y);
      d.ballShadow.setScale(Phaser.Math.Clamp(1 - (height / 200), 0.2, 1));
      d.ballShadow.setAlpha(Phaser.Math.Clamp(0.3 - (height / 400), 0, 0.3));
    }
  });
}

if (ball && ball.body && !d.isShooting) {
  const targetX = player.x + (player.body.velocity.x > 0 ? 35 : -35);
  const targetY = player.y + 20;
  const dist = Phaser.Math.Distance.Between(targetX, targetY, ball.x, ball.y);

  if (dist > 5) {
    const angle = Phaser.Math.Angle.Between(ball.x, ball.y, targetX, targetY);
    ball.body.setVelocity(Math.cos(angle) * dist * 15, Math.sin(angle) * dist * 15);
  } else {
    ball.body.setVelocity(player.body.velocity.x, player.body.velocity.y);
  }

  player.setDepth(player.y);
  ball.setDepth(player.depth + 1);
}
}
}

export function onExit(scene) {
scene.roomData = null;
}

// Optional hook — tells RoomScene how to render other players in this room.
// Without this, other players appear as gray rectangles.
export function createOtherPlayer(scene, { x, y }) {
  const container = scene.add.container(x, y);
  const pBody = scene.add.rectangle(0, 0, 40, 64, 0x34495e);
  pBody.setOrigin(0.5, 1);
  const pHead = scene.add.circle(0, -70, 18, 0xffdbac);
  container.add([pBody, pHead]);
  // Tell RoomScene how far above the container origin to place the name tag.
  // The player's head top is ~88px above the feet (origin).
  container._labelOffsetY = 100;
  return container;
}