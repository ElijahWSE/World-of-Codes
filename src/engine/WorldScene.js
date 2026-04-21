// WorldScene.js — The shared town square scene
// Every player starts here. Walk around, see other players in real time,
// and enter doors to visit individual player rooms.
//
// ARCHITECTURE NOTES:
// - Multiplayer state is owned by the Colyseus server (server/index.js).
//   This scene is purely the visual/input layer.
// - To add a new player room: import the module below and add one entry to
//   the DOORS array with a roomModule property. No other files need to change.

import Phaser from 'phaser';
import { Client } from '@colyseus/sdk';
import { WorldState } from '../shared/schema.js';

// ── Player room imports ───────────────────────────────────────────────────────
// These blocks are managed by the admin panel — do not edit them manually.
// [DOOR-IMPORT:north-start]
import * as ExampleRoom from '../rooms/example-room.js';
// [DOOR-IMPORT:north-end]
// [DOOR-IMPORT:east-start]
import * as UnderwaterWorld from '../rooms/underwater-world.js';
// [DOOR-IMPORT:east-end]
// [DOOR-IMPORT:south-start]
import * as TropicalSurfHaven from '../rooms/tropical-surf-haven.js';
// [DOOR-IMPORT:south-end]
// [DOOR-IMPORT:west-start]
import * as VibrantCityCenter from '../rooms/vibrant-city-center.js';
// [DOOR-IMPORT:west-end]

// ── World Layout Constants ─────────────────────────────────────────────────
const WORLD_W       = 1600;  // total world width in pixels
const WORLD_H       = 1200;  // total world height in pixels
const TILE_SIZE     = 64;    // floor tile size (unused visually, kept for reference)
const SPEED         = 160;   // player movement speed (pixels/second)
const PORTAL_RADIUS = 42;    // trigger distance for entering a portal

// World centre — used for player spawn and signpost placement
const MID_X = WORLD_W / 2;  // 800
const MID_Y = WORLD_H / 2;  // 600

// ── Portal Definitions ────────────────────────────────────────────────────
// Each entry is a magical portal floating in the desert world.
// To wire a room: add a `roomModule` property. Label comes from roomModule.name.
// Adding a room = one import above + one roomModule line here. Nothing else changes.
const DOORS = [
  // [DOOR-ENTRY:north-start]
  { key: 'room1', label: ExampleRoom.name,      x:  580, y:  490, color: 0x8B5CF6, roomModule: ExampleRoom },
  // [DOOR-ENTRY:north-end]
  // [DOOR-ENTRY:east-start]
  { key: 'room2', label: UnderwaterWorld.name, x: 1220, y: 570, color: 0x10B981, roomModule: UnderwaterWorld },
// [DOOR-ENTRY:east-end]
  // [DOOR-ENTRY:south-start]
  { key: 'room3', label: TropicalSurfHaven.name, x:  620, y: 1010, color: 0x3B82F6, roomModule: TropicalSurfHaven },
  // [DOOR-ENTRY:south-end]
  // [DOOR-ENTRY:west-start]
  { key: 'room4', label: VibrantCityCenter.name, x: 1150, y:  950, color: 0xF59E0B, roomModule: VibrantCityCenter },
  // [DOOR-ENTRY:west-end]
];

// Always connect to the same origin as the page.
// Vite proxies /matchmake (HTTP) and /<processId>/<roomId> (WebSocket)
// to Colyseus on port 2567 — see vite.config.js.
// This means there are never any cross-origin requests regardless of environment.
const protocol   = window.location.protocol === 'https:' ? 'wss' : 'ws';
const SERVER_URL = `${protocol}://${window.location.host}`;

// ── Scene ──────────────────────────────────────────────────────────────────
export default class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldScene' });
    // Map of other players: sessionId -> { body: Rectangle, label: Text }
    this.otherPlayers = new Map();
    this.colyseusRoom = null;
    // Track last sent position to avoid redundant network messages
    this._lastSentX = null;
    this._lastSentY = null;
  }

  // init() runs before preload/create on every scene start (including restarts).
  // When returning from a room, RoomScene passes { returnDoor: 'room1' } etc.
  // so the player spawns back at the door they entered instead of world center.
  init(data) {
    this._returnDoor = data?.returnDoor ?? null;
  }

  preload() {
    // No external assets — all visuals are shapes and text.
  }

  create() {
    this._createBackground();
    this._createMountains();
    this._createRiver();
    this._createDecor();
    this._createSkyAnimations();
    this._createPortals();
    this._createPlayer();
    this._createSignpost();
    this._setupCamera();
    this._setupInput();
    this._connectMultiplayer();

    // Leave the Colyseus room cleanly when this scene shuts down (e.g. entering a room).
    this.events.once('shutdown', () => {
      if (this.colyseusRoom) {
        this.colyseusRoom.leave();
        this.colyseusRoom = null;
      }
    });
  }

  // ── Background: sky gradient + desert ground ─────────────────────────────
  _createBackground() {
    const sky = this.add.graphics().setDepth(0);
    // Sky: blue at top fading to warm golden at horizon
    sky.fillGradientStyle(0x5B9ED9, 0x5B9ED9, 0xF4C96A, 0xF4C96A, 1);
    sky.fillRect(0, 0, WORLD_W, 340);
    // Horizon warmth band
    sky.fillGradientStyle(0xF4C96A, 0xF4C96A, 0xD4956A, 0xD4956A, 1);
    sky.fillRect(0, 290, WORLD_W, 80);

    // Desert ground — sandy tan with subtle large-tile texture
    const ground = this.add.graphics().setDepth(3);
    ground.fillStyle(0xD4A96A);
    ground.fillRect(0, 300, WORLD_W, WORLD_H - 300);
    ground.fillStyle(0xDCB47A);
    for (let gx = 0; gx < WORLD_W; gx += 200) {
      for (let gy = 300; gy < WORLD_H; gy += 200) {
        if (((gx / 200) + (gy / 200)) % 2 === 0) ground.fillRect(gx, gy, 200, 200);
      }
    }
  }

  // ── Mountains: silhouettes with atmospheric depth + snow caps ─────────────
  _createMountains() {
    const gfx = this.add.graphics().setDepth(2);

    // Far mountains — lighter blue-purple (atmospheric haze)
    gfx.fillStyle(0x8090C0);
    gfx.fillTriangle(80,  370, 300,  80, 520,  370);
    gfx.fillTriangle(680, 370, 900,  50, 1120, 370);
    gfx.fillTriangle(1300,370, 1520, 90, 1700, 370);

    // Near mountains — darker, more vivid
    gfx.fillStyle(0x4A5590);
    gfx.fillTriangle(-20, 370, 190, 130, 400, 370);
    gfx.fillTriangle(380, 370, 600,  45, 820, 370);
    gfx.fillTriangle(790, 370, 1010,105, 1230,370);
    gfx.fillTriangle(1160,370, 1380, 60, 1610,370);

    // Snow caps
    gfx.fillStyle(0xEEEEFF);
    gfx.fillTriangle(162, 185, 190, 130, 218, 185);
    gfx.fillTriangle(570,  95, 600,  45, 630,  95);
    gfx.fillTriangle(980, 158, 1010,105, 1040,158);
    gfx.fillTriangle(1348,112, 1380, 60, 1412,112);
  }

  // ── River: winding path from north to south using connected segments ───────
  _createRiver() {
    const gfx = this.add.graphics().setDepth(4);

    const SEGS = [
      [130, 220, 68, 150],
      [130, 340, 185, 68],
      [272, 340, 68, 195],
      [200, 503, 175, 68],
      [200, 503, 68, 215],
      [200, 685, 178, 68],
      [340, 685, 68, 210],
      [340, 863, 155, 68],
      [458, 863, 68, 215],
      [458, 1046, 125, 68],
    ];

    gfx.fillStyle(0x4EA8DE);
    for (const [x, y, w, h] of SEGS) gfx.fillRect(x, y, w, h);

    // Lighter centre highlight for water depth feel
    gfx.fillStyle(0x82CBF0);
    for (const [x, y, w, h] of SEGS) {
      const inset = Math.floor(Math.min(w, h) * 0.22);
      gfx.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    }
  }

  // ── Decor: cacti + book sculptures with y-based depth sorting ────────────
  _createDecor() {
    this._placeCacti();
    this._placeBookSculptures();
  }

  _placeCacti() {
    const POSITIONS = [
      [150, 520, 0.9], [390, 660, 1.1], [1300, 480, 1.0],
      [1460, 830, 0.85], [280, 930, 1.2], [1060, 430, 0.95],
      [900, 1040, 1.0], [640, 800, 0.75], [1400, 640, 1.05],
    ];

    for (const [x, y, scale] of POSITIONS) {
      const container = this.add.container(x, y).setDepth(5 + y / 200);
      const gfx = this.add.graphics();
      const tw  = Math.round(14 * scale);
      const th  = Math.round(68 * scale);
      const armW = Math.round(30 * scale);
      const armH = Math.round(12 * scale);
      const armY = -Math.round(40 * scale);
      const upH  = Math.round(22 * scale);

      gfx.fillStyle(0x5A9A3C);
      gfx.fillRect(-tw / 2, -th, tw, th);                          // trunk
      gfx.fillRect(-tw / 2 - armW, armY, armW, armH);              // left arm horiz
      gfx.fillRect(-tw / 2 - armW, armY - upH, armH, upH);         // left arm up
      gfx.fillRect(tw / 2, armY, armW, armH);                      // right arm horiz
      gfx.fillRect(tw / 2 + armW - armH, armY - upH, armH, upH);   // right arm up

      container.add(gfx);
    }
  }

  _placeBookSculptures() {
    const SCULPTURES = [
      { x: 420, y: 530, books: [
        { w: 65, h: 15, color: 0xE63946 },
        { w: 52, h: 14, color: 0x457B9D },
        { w: 72, h: 14, color: 0x2A9D8F },
        { w: 46, h: 14, color: 0xE9C46A },
        { w: 58, h: 13, color: 0xF4A261 },
      ]},
      { x: 1190, y: 720, books: [
        { w: 55, h: 14, color: 0x9B2226 },
        { w: 68, h: 15, color: 0x1B4332 },
        { w: 44, h: 14, color: 0x3A86FF },
        { w: 62, h: 14, color: 0xFFBE0B },
        { w: 50, h: 13, color: 0x8338EC },
        { w: 58, h: 14, color: 0xFF6B6B },
      ]},
      { x: 760, y: 945, books: [
        { w: 78, h: 15, color: 0x264653 },
        { w: 60, h: 14, color: 0xE76F51 },
        { w: 70, h: 14, color: 0x2A9D8F },
        { w: 54, h: 13, color: 0xF4A261 },
      ]},
    ];

    for (const { x, y, books } of SCULPTURES) {
      const container = this.add.container(x, y).setDepth(5 + y / 200);
      const gfx = this.add.graphics();
      let offsetY = 0;

      for (const book of books) {
        gfx.fillStyle(book.color);
        gfx.fillRect(-book.w / 2, offsetY - book.h, book.w, book.h);
        offsetY -= book.h;
      }

      // Stone pedestal
      const baseW = Math.max(...books.map(b => b.w)) + 20;
      gfx.fillStyle(0x8B7355);
      gfx.fillRect(-baseW / 2, 0, baseW, 14);

      container.add(gfx);
    }
  }

  // ── Sky animations: moon, stars, clouds, lightbulb, paper airplane ────────
  _createSkyAnimations() {
    this._createMoon();
    this._createStars();
    this._createClouds();
    this._createLightbulb();
    this._createPaperAirplane();
  }

  _createMoon() {
    const gfx = this.add.graphics().setDepth(1);
    gfx.fillStyle(0xFFF5CC, 0.35);
    gfx.fillCircle(1430, 75, 46);
    gfx.fillStyle(0xFFF5CC);
    gfx.fillCircle(1430, 75, 34);
    // Subtle crater marks
    gfx.fillStyle(0xEEE5AA, 0.55);
    gfx.fillCircle(1422, 68, 6);
    gfx.fillCircle(1438, 82, 4);
    gfx.fillCircle(1428, 88, 3);
  }

  _createStars() {
    const gfx = this.add.graphics().setDepth(0.5);
    gfx.fillStyle(0xFFFFEE);
    const STATIC = [
      [120,35],[350,22],[580,48],[830,28],[1070,42],
      [1290,18],[1490,55],[195,75],[720,65],[1110,80],
      [1560,38],[460,95],[940,88],[1360,105],[650,32],
      [1200,58],[300,110],[850,115],[1440,88],
    ];
    for (const [x, y] of STATIC) gfx.fillRect(x, y, 3, 3);

    // Twinkling stars
    for (let i = 0; i < 8; i++) {
      const sg = this.add.graphics().setDepth(0.6);
      sg.fillStyle(0xFFFFDD);
      sg.fillRect(0, 0, 4, 4);
      sg.setPosition(
        Phaser.Math.Between(100, WORLD_W - 100),
        Phaser.Math.Between(15, 220),
      );
      this.tweens.add({
        targets: sg, alpha: 0.1,
        duration: Phaser.Math.Between(700, 2200),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2500),
      });
    }
  }

  _createClouds() {
    const DATA = [
      { x: 250, y: 110 }, { x: 650, y: 80 }, { x: 1050, y: 125 },
      { x: 1400, y: 95 }, { x: 900,  y: 188 }, { x: 400, y: 202 },
    ];

    for (const { x, y } of DATA) {
      const container = this.add.container(x, y).setDepth(1.5);
      const gfx = this.add.graphics();
      gfx.fillStyle(0xFFFFFF, 0.92);
      gfx.fillEllipse(-32, 4, 76, 32);
      gfx.fillEllipse(-8, -12, 58, 40);
      gfx.fillEllipse(28, 4, 64, 28);
      container.add(gfx);

      this.tweens.add({
        targets: container,
        x: x + Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(14000, 24000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 8000),
      });
    }
  }

  _createLightbulb() {
    const container = this.add.container(800, 130).setDepth(1.8);
    const gfx = this.add.graphics();

    // Outer glow halos
    gfx.fillStyle(0xFFFF88, 0.15);
    gfx.fillCircle(0, 0, 70);
    gfx.fillStyle(0xFFFF88, 0.22);
    gfx.fillCircle(0, 0, 52);

    // Bulb dome
    gfx.fillStyle(0xFFEE44);
    gfx.fillCircle(0, -4, 22);

    // Bulb base
    gfx.fillStyle(0xCCBB33);
    gfx.fillRect(-8, 14, 16, 8);
    gfx.fillRect(-5, 22, 10, 5);
    gfx.fillRect(-5, 27, 10, 4);

    // Rays
    gfx.lineStyle(2.5, 0xFFEE44, 0.8);
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = Phaser.Math.DegToRad(angle);
      gfx.lineBetween(
        Math.cos(rad) * 30, Math.sin(rad) * 30 - 4,
        Math.cos(rad) * 48, Math.sin(rad) * 48 - 4,
      );
    }

    container.add(gfx);

    this.tweens.add({
      targets: container, scaleX: 1.14, scaleY: 1.14,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  _createPaperAirplane() {
    const container = this.add.container(-60, 140).setDepth(1.9);
    const gfx = this.add.graphics();
    gfx.fillStyle(0xFFFFFF);
    gfx.fillTriangle(0, 8, 34, 12, 6, 22);
    gfx.fillStyle(0xDDDDDD);
    gfx.fillTriangle(6, 22, 34, 12, 22, 28);
    gfx.lineStyle(1, 0xBBBBBB, 0.8);
    gfx.lineBetween(0, 8, 22, 28);
    container.add(gfx);

    const fly = () => {
      const startY = Phaser.Math.Between(70, 260);
      container.setPosition(-60, startY);
      this.tweens.add({
        targets: container,
        x: WORLD_W + 80,
        y: startY + Phaser.Math.Between(-40, 40),
        duration: Phaser.Math.Between(7000, 11000),
        ease: 'Linear',
        onComplete: () => {
          this.time.delayedCall(Phaser.Math.Between(4000, 12000), fly);
        },
      });
    };

    this.time.delayedCall(Phaser.Math.Between(2000, 5000), fly);
  }

  // ── Portals ───────────────────────────────────────────────────────────────
  // Magical portals scattered around the desert world.
  // Each portal is an animated container: outer spinning orbs, inner counter-spin,
  // and a pulsing core. Entering the portal's radius triggers the room transition.
  _createPortals() {
    this.doorZones = DOORS.map(door => {
      this._drawPortal(door);
      return { ...door, triggered: false };
    });
  }

  _drawPortal({ x, y, color, label }) {
    const container = this.add.container(x, y).setDepth(7);
    const gfx = this.add.graphics();

    // Atmospheric glow halos
    gfx.fillStyle(color, 0.07);
    gfx.fillCircle(0, 0, 74);
    gfx.fillStyle(color, 0.14);
    gfx.fillCircle(0, 0, 58);

    // Static ring bands
    gfx.lineStyle(3, color, 0.85);
    gfx.strokeCircle(0, 0, 46);
    gfx.lineStyle(1.5, color, 0.45);
    gfx.strokeCircle(0, 0, 36);

    // Inner core — layered brightness
    gfx.fillStyle(color, 0.55);
    gfx.fillCircle(0, 0, 22);
    gfx.fillStyle(0xFFFFFF, 0.4);
    gfx.fillCircle(0, 0, 12);
    gfx.fillStyle(0xFFFFFF, 0.85);
    gfx.fillCircle(0, 0, 5);

    container.add(gfx);

    // Outer ring: 8 orbiting orbs, spinning clockwise
    const outerRing = this.add.container(0, 0);
    const og = this.add.graphics();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      og.fillStyle(color, 0.9);
      og.fillCircle(Math.cos(a) * 52, Math.sin(a) * 52, 4.5);
    }
    outerRing.add(og);
    container.add(outerRing);
    this.tweens.add({ targets: outerRing, angle: 360, duration: 4500, repeat: -1, ease: 'Linear' });

    // Inner ring: 5 white gems, counter-spinning
    const innerRing = this.add.container(0, 0);
    const ig = this.add.graphics();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ig.fillStyle(0xFFFFFF, 0.75);
      ig.fillCircle(Math.cos(a) * 32, Math.sin(a) * 32, 3);
    }
    innerRing.add(ig);
    container.add(innerRing);
    this.tweens.add({ targets: innerRing, angle: -360, duration: 2800, repeat: -1, ease: 'Linear' });

    // Whole portal breathes
    this.tweens.add({
      targets: container, scaleX: 1.1, scaleY: 1.1,
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: Math.random() * 1200,
    });

    // Room name label above portal
    this.add.text(x, y - 80, label, {
      fontSize: '13px', fill: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
  }

  // ── Player ────────────────────────────────────────────────────────────────
  _createPlayer() {
    // Auto-generate a random name (no login screen yet).
    // Preserve name across scene restarts so it stays consistent.
    if (!this.playerName) {
      this.playerName = `Player_${Math.floor(Math.random() * 9000) + 1000}`;
    }

    // Determine spawn position.
    // Default: world center. If returning from a room, spawn just inside that door.
    let spawnX = MID_X;
    let spawnY = MID_Y;

    if (this._returnDoor) {
      const door = DOORS.find(d => d.key === this._returnDoor);
      if (door) {
        // Spawn 100px below the portal so player doesn't immediately re-enter
        spawnX = door.x;
        spawnY = door.y + 100;
      }
    }

    this.player = this.add.rectangle(spawnX, spawnY, 32, 32, 0x00cc44).setDepth(5);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true); // world bounds act as walls

    // Name tag — position updated every frame in update()
    this.playerLabel = this.add.text(spawnX, spawnY - 24, 'You', {
      fontSize: '12px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  _setupCamera() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  // ── Multiplayer ───────────────────────────────────────────────────────────
  // Connects to Colyseus, then:
  //   - Adds a gray rectangle + name label for every other player who joins
  //   - Updates their positions as they move
  //   - Removes them cleanly when they disconnect
  //
  // WHY catch() at the end: the game must still be playable when the server
  // is offline. Multiplayer is an enhancement, not a hard requirement.
  _connectMultiplayer() {
    console.log(`[Colyseus] Connecting to ${SERVER_URL}`);
    const client = new Client(SERVER_URL);

    // Pass WorldState so the client initializes players as a proper MapSchema.
    // Without this, Colyseus uses reflection mode which leaves players undefined.
    client.joinOrCreate('world', { name: this.playerName }, WorldState)
      .then(room => {
        this.colyseusRoom = room;
        console.log(`[Colyseus] Joined as "${this.playerName}" (session: ${room.sessionId})`);
        console.log(`[Colyseus] Players in room: ${room.state.players.size}`);

        // ── Sync other players via onStateChange ─────────────────────────
        // We use room.onStateChange instead of getStateCallbacks because
        // schema v4's callback system requires $refId to be set on the
        // MapSchema, which only happens once the server sends actual data.
        // onStateChange fires on every server patch and is always reliable.
        room.onStateChange(state => {
          // ── Add or update players ──────────────────────────────────────
          state.players.forEach((playerState, sessionId) => {
            if (sessionId === room.sessionId) return; // skip self

            const existing = this.otherPlayers.get(sessionId);
            if (existing) {
              // Update position of already-rendered player
              existing.body.setPosition(playerState.x, playerState.y);
              existing.label.setPosition(playerState.x, playerState.y - 24);
              existing.body.setDepth(5 + playerState.y / 200);
              existing.label.setDepth(5.1 + playerState.y / 200);
            } else {
              // New player — create their rectangle and label
              console.log(`[Colyseus] Player joined: ${playerState.name} (${sessionId})`);
              const body = this.add.rectangle(
                playerState.x, playerState.y, 32, 32, 0x888888
              ).setDepth(5);
              const label = this.add.text(
                playerState.x, playerState.y - 24,
                playerState.name,
                { fontSize: '12px', fill: '#bbbbbb', stroke: '#000000', strokeThickness: 2 }
              ).setOrigin(0.5).setDepth(15);
              this.otherPlayers.set(sessionId, { body, label });
            }
          });

          // ── Remove players who have left ───────────────────────────────
          this.otherPlayers.forEach((p, sessionId) => {
            if (!state.players.has(sessionId)) {
              console.log(`[Colyseus] Player left: ${sessionId}`);
              p.body.destroy();
              p.label.destroy();
              this.otherPlayers.delete(sessionId);
            }
          });
        });
      })
      .catch(err => {
        // Server offline or unreachable — game continues in single-player mode.
        console.error('[Colyseus] Connection FAILED:', err.message, err);
      });
  }

  // ── Update Loop ───────────────────────────────────────────────────────────
  update() {
    // ── Signpost overlay: freeze movement and handle page navigation ──────
    // ESC is handled via keyboard event listener registered in _createSignpost.
    if (this._signOpen) {
      this.player.body.setVelocity(0);
      const JD = k => Phaser.Input.Keyboard.JustDown(k);
      if (JD(this._keyE) || JD(this.cursors.right)) {
        if (this._signPage < this._signPages.length - 1) {
          this._signPage++;
          this._renderSignPage();
        } else {
          this._closeSignpost();
          return;
        }
      } else if (JD(this.cursors.left)) {
        if (this._signPage > 0) {
          this._signPage--;
          this._renderSignPage();
        }
      }
      this.playerLabel.setPosition(this.player.x, this.player.y - 24);
      return;
    }

    const body = this.player.body;
    body.setVelocity(0);

    if      (this.cursors.left.isDown  || this.wasd.left.isDown)  body.setVelocityX(-SPEED);
    else if (this.cursors.right.isDown || this.wasd.right.isDown) body.setVelocityX(SPEED);

    if      (this.cursors.up.isDown    || this.wasd.up.isDown)    body.setVelocityY(-SPEED);
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  body.setVelocityY(SPEED);

    // Normalize diagonal movement so it's the same speed as cardinal movement
    body.velocity.normalize().scale(SPEED);

    // Keep the name tag floating above the player
    this.playerLabel.setPosition(this.player.x, this.player.y - 24);

    // Pokemon-style depth sorting: player depth tracks y so they walk behind/in-front of decor
    this.player.setDepth(5 + this.player.y / 200);
    this.playerLabel.setDepth(5.1 + this.player.y / 200);

    // ── Send position to server ──────────────────────────────────────────
    // Only send when the position has actually changed to avoid flooding
    // the server with redundant messages when the player is standing still.
    if (this.colyseusRoom) {
      const px = Math.round(this.player.x);
      const py = Math.round(this.player.y);
      if (px !== this._lastSentX || py !== this._lastSentY) {
        this.colyseusRoom.send('move', { x: px, y: py });
        this._lastSentX = px;
        this._lastSentY = py;
      }
    }

    // ── Door proximity detection ──────────────────────────────────────────────
    // Fires once when the player walks into the door opening.
    // If the door has a roomModule, transition to RoomScene.
    // If not (room not built yet), log to console so the dev knows it was hit.
    for (const door of this.doorZones) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, door.x, door.y
      );
      if (dist < PORTAL_RADIUS && !door.triggered) {
        door.triggered = true;
        if (door.roomModule) {
          this.scene.start('RoomScene', {
            room:        door.roomModule,
            returnDoor:  door.key,
            playerName:  this.playerName,
          });
        } else {
          console.log(`[WorldScene] Portal "${door.label}" has no room assigned yet.`);
        }
      } else if (dist >= PORTAL_RADIUS) {
        door.triggered = false;
      }
    }

    // ── Signpost proximity ────────────────────────────────────────────────
    const signDist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this._signX, this._signY
    );
    const nearSign = signDist < 80;
    this._signHint.setVisible(nearSign);
    if (nearSign && Phaser.Input.Keyboard.JustDown(this._keyE)) {
      this._openSignpost();
    }
  }

  // ── Signpost ──────────────────────────────────────────────────────────────
  _createSignpost() {
    const sx = MID_X, sy = MID_Y + 150;

    this.add.rectangle(sx, sy + 14, 8, 48, 0x5c3a1e).setDepth(8);
    this.add.rectangle(sx, sy - 6, 80, 44, 0x7a5230).setDepth(8);
    this.add.rectangle(sx, sy - 6, 74, 38, 0xd4a96a).setDepth(8);
    this.add.text(sx, sy - 6, 'NOTICE\nBOARD', {
      fontSize: '9px', fill: '#3d1f00', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(9);

    const hitbox = this.add.rectangle(sx, sy + 8, 16, 56, 0x000000, 0);
    this.physics.add.existing(hitbox, true);
    this.physics.add.collider(this.player, hitbox);

    this._signHint = this.add.text(sx, sy - 52, '[E] Read notice board', {
      fontSize: '12px', fill: '#ffff00', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    this._signX    = sx;
    this._signY    = sy;
    this._signOpen = false;
    this._signPage = 0;

    this._keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Event listener is more reliable than polling for ESC in browser environments
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._signOpen) this._closeSignpost();
    });

    this._buildSignpostOverlay();
  }

  _buildSignpostOverlay() {
    const CW = 800, CH = 600;
    const cx = CW / 2, cy = CH / 2;
    const PW = 740, PH = 550;
    const px = cx - PW / 2, py = cy - PH / 2;
    const fix = obj => obj.setScrollFactor(0).setDepth(70);

    this._sovBg = fix(
      this.add.rectangle(cx, cy, CW, CH, 0x000000).setAlpha(0.78).setVisible(false),
    );
    this._sovPanel = fix(
      this.add.rectangle(cx, cy, PW, PH, 0x1a0d00).setAlpha(0.97).setVisible(false),
    );

    const gfx = this.add.graphics().setScrollFactor(0).setDepth(71).setVisible(false);
    gfx.lineStyle(2, 0xc8a46e, 1);
    gfx.strokeRect(px, py, PW, PH);
    gfx.lineStyle(1, 0xc8a46e, 0.5);
    gfx.lineBetween(px + 10, py + 48,        px + PW - 10, py + 48);
    gfx.lineBetween(px + 10, py + PH - 70,   px + PW - 10, py + PH - 70);
    gfx.lineBetween(px + 10, py + PH - 34,   px + PW - 10, py + PH - 34);
    this._sovGfx = gfx;

    this._sovTitle = fix(
      this.add.text(cx, py + 15, '', {
        fontSize: '18px', fill: '#c8a46e', fontStyle: 'bold',
      }).setOrigin(0.5, 0).setVisible(false),
    );

    this._sovContent = fix(
      this.add.text(px + 16, py + 56, '', {
        fontSize: '13px', fill: '#e0e0e0', lineSpacing: 4,
      }).setVisible(false),
    );

    // Copy button — only visible on pages that have copyText defined
    this._sovCopyBtn = fix(
      this.add.text(cx, py + PH - 52, '[ Copy Prompt ]', {
        fontSize: '14px', fill: '#1a0d00', backgroundColor: '#c8a46e',
        padding: { x: 16, y: 7 },
      }).setOrigin(0.5, 0.5).setVisible(false).setInteractive({ useHandCursor: true }),
    );
    this._sovCopyBtn.on('pointerover',  () => this._sovCopyBtn.setStyle({ fill: '#000000' }));
    this._sovCopyBtn.on('pointerout',   () => this._sovCopyBtn.setStyle({ fill: '#1a0d00' }));
    this._sovCopyBtn.on('pointerdown',  () => this._copyCurrentPrompt());

    this._sovNav = fix(
      this.add.text(cx, py + PH - 16, '', {
        fontSize: '13px', fill: '#c8a46e',
      }).setOrigin(0.5, 0.5).setVisible(false),
    );

    this._sovPageNum = fix(
      this.add.text(px + PW - 12, py + PH - 16, '', {
        fontSize: '13px', fill: '#888888',
      }).setOrigin(1, 0.5).setVisible(false),
    );

    this._sovBase = [
      this._sovBg, this._sovPanel, this._sovGfx,
      this._sovTitle, this._sovContent, this._sovNav, this._sovPageNum,
    ];

    this._signPages = this._buildSignPages();
  }

  _buildSignPages() {
    const PROMPT1 =
      'I want to design a world for a 2D game built with Phaser.js.\n' +
      'My world theme is: [YOUR THEME HERE]\n' +
      '\n' +
      'The world is 1600px wide and 1200px tall. The camera follows the player.\n' +
      '\n' +
      'PERSPECTIVE STYLE — very important:\n' +
      'Use a Pokemon/RPG-style oblique perspective, NOT a flat top-down view.\n' +
      'This means:\n' +
      '- The upper portion of the world (y: 0–300) shows sky, clouds, and a horizon\n' +
      '- Mountains or background scenery are silhouettes along the horizon line\n' +
      '- The ground/floor occupies the lower portion (y: 300–1200)\n' +
      '- Objects like trees, rocks, and structures show their front face with visible height\n' +
      '  (drawn as tall rectangles, not just flat squares)\n' +
      '- Players feel like they are walking THROUGH a world, not looking straight down at it\n' +
      '\n' +
      'Create an interactive preview using a mock Phaser scene so I can\n' +
      'see what it looks like. The world should:\n' +
      '- Have a distinct visual style matching my theme (rectangles, circles, stars, text)\n' +
      '- Include animated elements (tweens for movement, blinking, spinning, etc.)\n' +
      '- Have an EXIT zone at the bottom centre of the world (around x=800, y=1150)\n' +
      '\n' +
      'Store all the actual room logic inside a const called roomCode with:\n' +
      '  name       — a string with the world\'s display name\n' +
      '  onLoad     — function(scene) for loading assets\n' +
      '  onCreate   — function(scene) for building the world\n' +
      '  onUpdate   — function(scene) for per-frame animations and the exit check\n' +
      '  onExit     — function(scene) for cleanup (set scene.roomData = null)\n' +
      '\n' +
      'Inside onCreate, always include this exit trigger block at the end:\n' +
      '  const exitZone = scene.add.zone(800, 1155, 120, 40);\n' +
      '  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);\n' +
      '  scene.roomData.exitZone = exitZone;\n' +
      '  scene.roomData.player = scene.player;\n' +
      '\n' +
      'Inside onUpdate, always include this exit check:\n' +
      '  const d = scene.roomData;\n' +
      '  if (d.player && d.exitZone) {\n' +
      '    const hit = Phaser.Geom.Intersects.RectangleToRectangle(\n' +
      '      d.player.getBounds(), d.exitZone.getBounds()\n' +
      '    );\n' +
      '    if (hit) scene.exitRoom();\n' +
      '  }\n' +
      '\n' +
      'Show me the preview so I can test it and ask for changes.';

    const PROMPT2 =
      'Now take the room logic from the roomCode object above and rewrite it using the\n' +
      'exact template below. Fill in only the body of each function with the room code\n' +
      'you already designed. Do not change the structure.\n' +
      '\n' +
      'STRICT RULES for the output:\n' +
      '  ✅ Return ONLY what is between the template markers — nothing else\n' +
      '  ✅ Keep all 5 export statements exactly as named\n' +
      '  ✅ Keep the exit trigger block in onCreate exactly as shown\n' +
      '  ✅ Keep the exit check block in onUpdate exactly as shown\n' +
      '  ❌ Do NOT add import, require(), or export default at the top\n' +
      '  ❌ Do NOT wrap in React, HTML, or any framework\n' +
      '  ❌ Do NOT include any explanation, commentary, or code fences\n' +
      '  ❌ Do NOT use fetch(), document, localStorage, or window\n' +
      '\n' +
      '--- START OF TEMPLATE ---\n' +
      '\n' +
      "export const name = 'My World'; // ← use your world name\n" +
      '\n' +
      'export function onLoad(scene) {\n' +
      '}\n' +
      '\n' +
      'export function onCreate(scene) {\n' +
      '  scene.roomData = {};\n' +
      '\n' +
      '  // ── your world design goes here (1600×1200, camera follows player) ─\n' +
      '\n' +
      '\n' +
      '  // ── exit trigger (keep this block exactly as-is) ──────────────────\n' +
      "  scene.add.rectangle(800, 1160, 120, 30, 0x333333);\n" +
      "  scene.add.text(800, 1160, 'EXIT', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);\n" +
      '  const exitZone = scene.add.zone(800, 1155, 120, 40);\n' +
      '  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);\n' +
      '  scene.roomData.exitZone = exitZone;\n' +
      '  scene.roomData.player = scene.player;\n' +
      '}\n' +
      '\n' +
      'export function onUpdate(scene) {\n' +
      '  // ── exit check (keep this block exactly as-is) ────────────────────\n' +
      '  const d = scene.roomData;\n' +
      '  if (d.player && d.exitZone) {\n' +
      '    const hit = Phaser.Geom.Intersects.RectangleToRectangle(\n' +
      '      d.player.getBounds(), d.exitZone.getBounds()\n' +
      '    );\n' +
      '    if (hit) scene.exitRoom();\n' +
      '  }\n' +
      '\n' +
      '  // ── per-frame animation logic goes here ───────────────────────────\n' +
      '\n' +
      '}\n' +
      '\n' +
      'export function onExit(scene) {\n' +
      '  scene.roomData = null;\n' +
      '}\n' +
      '\n' +
      '--- END OF TEMPLATE ---';

    const PROMPT_GAME =
      'Now add an optional mini-game to the world you just designed.\n' +
      'Send this in the SAME conversation. Output the COMPLETE updated file.\n' +
      '\n' +
      'PERSPECTIVE STYLE (same as the world):\n' +
      'The mini-game runs in an 800×600 overlay panel on top of the world.\n' +
      'It does NOT need the RPG perspective — it is a flat 2D game UI.\n' +
      'Use simple shapes, text, and physics for the game mechanics.\n' +
      '\n' +
      'Add these three exports after the existing onExit function:\n' +
      '\n' +
      'export const gameZoneX = 800;  // ← x position of game entrance in your world\n' +
      'export const gameZoneY = 600;  // ← y position of game entrance in your world\n' +
      'export const game = {\n' +
      "  gameName: 'Your Game Name',   // ← short name shown in the title bar\n" +
      '  onGameLoad(scene) {},\n' +
      '  onGameCreate(scene) {\n' +
      '    scene.gameData = {};\n' +
      '    // Build your mini-game here.\n' +
      '    // Coordinate space: x 0–800, y 65–590 (top 64px is the title bar).\n' +
      '    // Call scene.exitGame() when the game ends (win/lose/quit).\n' +
      '  },\n' +
      '  onGameUpdate(scene) {\n' +
      '    // Per-frame game logic here\n' +
      '  },\n' +
      '  onGameExit(scene) {\n' +
      '    scene.gameData = null;\n' +
      '  },\n' +
      '};\n' +
      '\n' +
      'Also update onCreate in the WORLD to add a visual marker at gameZoneX/gameZoneY\n' +
      '(e.g. a glowing rectangle, animated sign, or arcade machine) so players can\n' +
      'see where to go to play the game.\n' +
      '\n' +
      'STRICT RULES:\n' +
      '  ✅ Keep all existing exports (name, onLoad, onCreate, onUpdate, onExit) unchanged\n' +
      '  ✅ game object must have all 4 methods: onGameLoad, onGameCreate, onGameUpdate, onGameExit\n' +
      '  ✅ Use scene.gameData to store game state\n' +
      '  ✅ Call scene.exitGame() when the game is finished\n' +
      '  ✅ Keep game coordinates within x:0–800, y:65–590\n' +
      '  ❌ Do NOT use import, require(), fetch(), document, or window\n' +
      '\n' +
      'Output the COMPLETE updated file from "export const name" to the very end.';

    return [
      {
        title: 'HOW TO BUILD YOUR WORLD',
        body:
          'World of Codes lets you create your own world using Gemini AI!\n' +
          'No coding needed. Step through the portal once approved.\n' +
          '\n' +
          'STEPS:\n' +
          '  1. Pick a creative theme  (e.g. "Crystal Cave", "Neon City")\n' +
          '\n' +
          '  2. Open gemini.google.com in a NEW conversation\n' +
          '\n' +
          '  3. Copy and paste PROMPT 1 (page 2) into Gemini\n' +
          '     Gemini builds a live preview — tweak until happy\n' +
          '\n' +
          '  4. Paste PROMPT 2 (pages 3-4) in the SAME conversation\n' +
          '     Gemini outputs the final world code\n' +
          '\n' +
          '  5. Send the code to the game owner for review\n' +
          '     Your portal appears in the town square once approved!\n' +
          '\n' +
          'Worlds CAN:    shapes, colours, text, animations (1600×1200)\n' +
          'Worlds CANNOT: imports, network requests, browser storage',
      },
      {
        title: 'PROMPT 1 — Design & Preview',
        copyText: PROMPT1,
        body:
          'Click "Copy Prompt", replace [YOUR THEME HERE], then paste into Gemini.\n' +
          '\n' +
          'I want to design a world for a 2D top-down game built\n' +
          'with Phaser.js. My world theme is: [YOUR THEME HERE]\n' +
          '\n' +
          'Create an interactive preview. The world should:\n' +
          '  - 1600×1200 with camera following the player\n' +
          '  - Visual style matching my theme (shapes, text, colours)\n' +
          '  - Animated elements (tweens, blinking, spinning)\n' +
          '  - EXIT zone at the bottom centre (around x=800, y=1150)\n' +
          '\n' +
          'Store logic in a const roomCode with: name, onLoad, onCreate, onUpdate, onExit\n' +
          '\n' +
          'In onCreate, end with exit trigger:\n' +
          '  const exitZone = scene.add.zone(800, 1155, 120, 40);\n' +
          '  scene.physics.world.enable(exitZone, Phaser.Physics.Arcade.STATIC_BODY);\n' +
          '  scene.roomData.exitZone = exitZone;\n' +
          '  scene.roomData.player = scene.player;\n' +
          '\n' +
          'In onUpdate, include exit check:\n' +
          '  const d = scene.roomData;\n' +
          '  if (d.player && d.exitZone) {\n' +
          '    const hit = Phaser.Geom.Intersects.RectangleToRectangle(\n' +
          '      d.player.getBounds(), d.exitZone.getBounds());\n' +
          '    if (hit) scene.exitRoom();\n' +
          '  }\n' +
          '\n' +
          'Show me the preview so I can test it and ask for changes.',
      },
      {
        title: 'PROMPT 2 — Export Rules',
        copyText: PROMPT2,
        body:
          'Click "Copy Prompt" — it includes both these rules AND the template.\n' +
          'Send this in the SAME conversation after the preview looks good.\n' +
          '\n' +
          'Now take the room logic from roomCode and rewrite it using the\n' +
          'exact template below. Fill only the function bodies.\n' +
          '\n' +
          'STRICT RULES:\n' +
          '  ✅ Return ONLY what is between the template markers\n' +
          '  ✅ Keep all 5 export statements exactly as named\n' +
          '  ✅ Keep the exit trigger in onCreate exactly as shown\n' +
          '  ✅ Keep the exit check in onUpdate exactly as shown\n' +
          '  ❌ No import, require(), or export default at the top\n' +
          '  ❌ No React, HTML, or any framework\n' +
          '  ❌ No explanation, commentary, or code fences\n' +
          '  ❌ No fetch(), document, localStorage, or window\n' +
          '\n' +
          '(Page 4 shows the full code template included in the copied prompt)',
      },
      {
        title: 'PROMPT 2 — Code Template',
        copyText: PROMPT2,
        body:
          'This template is automatically included when you Copy Prompt on page 3.\n' +
          '\n' +
          "export const name = 'My World'; // ← your world name\n" +
          'export function onLoad(scene) {}\n' +
          'export function onCreate(scene) {\n' +
          '  scene.roomData = {};\n' +
          '  // your world design here (1600×1200)\n' +
          "  scene.add.rectangle(800, 1160, 120, 30, 0x333333);\n" +
          "  scene.add.text(800, 1160, 'EXIT', {\n" +
          "    fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);\n" +
          '  const exitZone = scene.add.zone(800, 1155, 120, 40);\n' +
          '  scene.physics.world.enable(exitZone,\n' +
          '    Phaser.Physics.Arcade.STATIC_BODY);\n' +
          '  scene.roomData.exitZone = exitZone;\n' +
          '  scene.roomData.player = scene.player;\n' +
          '}\n' +
          'export function onUpdate(scene) {\n' +
          '  const d = scene.roomData;\n' +
          '  if (d.player && d.exitZone) {\n' +
          '    const hit = Phaser.Geom.Intersects.RectangleToRectangle(\n' +
          '      d.player.getBounds(), d.exitZone.getBounds());\n' +
          '    if (hit) scene.exitRoom();\n' +
          '  }\n' +
          '  // per-frame animation here\n' +
          '}\n' +
          'export function onExit(scene) { scene.roomData = null; }',
      },
      {
        title: 'OPTIONAL: Add a Mini-Game (Prompt B)',
        copyText: PROMPT_GAME,
        body:
          'Want a playable mini-game inside your world? (Club Penguin style!)\n' +
          'Send this in the SAME conversation after your world is finalised.\n' +
          '\n' +
          'HOW IT WORKS:\n' +
          '  - Players walk to a spot in your world and see "[E] Play: <name>"\n' +
          '  - Pressing E opens an 800×600 game overlay on top of the world\n' +
          '  - The world pauses underneath — just like Club Penguin\n' +
          '  - Players press Close or ESC to return to the world\n' +
          '\n' +
          'WHAT GEMINI WILL ADD to your existing file:\n' +
          '  export const gameZoneX  — x position of the game entrance\n' +
          '  export const gameZoneY  — y position of the game entrance\n' +
          '  export const game = {   — the mini-game object\n' +
          '    gameName, onGameLoad, onGameCreate,\n' +
          '    onGameUpdate, onGameExit\n' +
          '  }\n' +
          '\n' +
          'Game area: 800×600 overlay. Avoid y < 65 (title bar).\n' +
          'Click "Copy Prompt" and paste it in Gemini to get started.',
      },
    ];
  }

  _openSignpost() {
    this._signOpen = true;
    this._signPage = 0;
    this._renderSignPage();
    for (const el of this._sovBase) el.setVisible(true);
    this._signHint.setVisible(false);
  }

  _closeSignpost() {
    this._signOpen = false;
    for (const el of this._sovBase) el.setVisible(false);
    this._sovCopyBtn.setVisible(false);
  }

  _renderSignPage() {
    const page   = this._signPages[this._signPage];
    const total  = this._signPages.length;
    const isLast = this._signPage === total - 1;
    this._sovTitle.setText(page.title);
    this._sovContent.setText(page.body);
    this._sovPageNum.setText(`${this._signPage + 1} / ${total}`);
    this._sovNav.setText(
      isLast
        ? '[←] Back   [E / ESC] Close'
        : '[←/→] Navigate   [E] Next   [ESC] Close',
    );
    const hasCopy = !!page.copyText;
    this._sovCopyBtn.setVisible(hasCopy);
    if (hasCopy) this._sovCopyBtn.setText('[ Copy Prompt ]');
  }

  _copyCurrentPrompt() {
    const page = this._signPages[this._signPage];
    if (!page.copyText) return;
    navigator.clipboard.writeText(page.copyText)
      .then(() => {
        this._sovCopyBtn.setText('✓ Copied to clipboard!');
        this.time.delayedCall(1800, () => {
          if (this._signOpen) this._sovCopyBtn.setText('[ Copy Prompt ]');
        });
      })
      .catch(() => {
        this._sovCopyBtn.setText('Copy failed — try a different browser');
        this.time.delayedCall(2500, () => {
          if (this._signOpen) this._sovCopyBtn.setText('[ Copy Prompt ]');
        });
      });
  }
}
