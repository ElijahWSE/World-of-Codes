// WorldScene.js — The shared town square scene.
// Every player starts here. Walk around, see other players in real time,
// and enter portals to visit individual player rooms.
//
// ARCHITECTURE NOTES:
// - Multiplayer state is owned by the Colyseus server (server/index.js).
// - Room modules are loaded dynamically from /rooms/<fileName> at runtime.
//   No static imports. The server is the source of truth for slot assignments.
// - To add a room without in-game submission: use the admin panel at /admin.

import Phaser from 'phaser';
import { Client } from '@colyseus/sdk';
import { WorldState } from '../shared/schema.js';

// ── World Layout Constants ─────────────────────────────────────────────────────
const WORLD_W        = 1600;
const WORLD_H        = 1200;
const SPEED          = 160;
const PORTAL_RADIUS  = 42;   // trigger distance for entering an active portal
const CLAIM_RADIUS   = 90;   // trigger distance for showing the claim hint

const MID_X = WORLD_W / 2;  // 800
const MID_Y = WORLD_H / 2;  // 600

// ── Portal Slot Positions ─────────────────────────────────────────────────────
// 20 positions scattered across the 1600×1200 world.
// Must match PORTAL_SLOTS in server/index.js (same keys + coordinates).
const PORTAL_SLOT_POSITIONS = [
  { key: 'slot01', x:  350, y:  420, color: 0x8B5CF6 },
  { key: 'slot02', x:  580, y:  490, color: 0x10B981 },
  { key: 'slot03', x:  900, y:  380, color: 0xF59E0B },
  { key: 'slot04', x: 1150, y:  430, color: 0xEC4899 },
  { key: 'slot05', x: 1360, y:  510, color: 0x3B82F6 },
  { key: 'slot06', x: 1480, y:  680, color: 0xEF4444 },
  { key: 'slot07', x: 1300, y:  820, color: 0x14B8A6 },
  { key: 'slot08', x: 1150, y:  950, color: 0xF97316 },
  { key: 'slot09', x:  980, y: 1080, color: 0xA855F7 },
  { key: 'slot10', x:  750, y: 1100, color: 0x06B6D4 },
  { key: 'slot11', x:  530, y: 1010, color: 0x84CC16 },
  { key: 'slot12', x:  320, y:  980, color: 0xF97316 },
  { key: 'slot13', x:  180, y:  820, color: 0x6366F1 },
  { key: 'slot14', x:  270, y:  650, color: 0xDB2777 },
  { key: 'slot15', x: 1050, y:  560, color: 0x0EA5E9 },
  { key: 'slot16', x:  700, y:  440, color: 0xD97706 },
  { key: 'slot17', x: 1200, y:  700, color: 0x22C55E },
  { key: 'slot18', x:  450, y:  750, color: 0x7C3AED },
  { key: 'slot19', x:  640, y:  880, color: 0xEC4899 },
  { key: 'slot20', x: 1380, y:  350, color: 0x22C55E },
];

const protocol   = window.location.protocol === 'https:' ? 'wss' : 'ws';
const SERVER_URL = `${protocol}://${window.location.host}`;

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldScene' });
    this.otherPlayers   = new Map();
    this.colyseusRoom   = null;
    this._lastSentX     = null;
    this._lastSentY     = null;
    this._activeSlots   = [];
    this.doorZones      = [];
    this._portalObjects = [];
    this._portalCountTexts = new Map();
    this._claimHints    = new Map();
    this._updateHints   = new Map();
    this._claimOpen     = false;
    this._claimTargetSlot = null;
    this._claimIsUpdate   = false;
    this._claimOverlayEl  = null;
    this._fetchingPortals = false;
  }

  init(data) {
    this._returnDoor = data?.returnDoor ?? null;
  }

  preload() {}

  create() {
    this._createBackground();
    this._createMountains();
    this._createRiver();
    this._createDecor();
    this._createSkyAnimations();
    this._createPlayer();
    this._createSignpost();
    this._setupCamera();
    this._setupInput();
    this._connectMultiplayer();

    // Fetch portal slots from server and draw portals
    this._fetchAndDrawPortals();

    this.events.once('shutdown', () => {
      this._destroyClaimOverlay();
      if (this.colyseusRoom) {
        this.colyseusRoom.leave();
        this.colyseusRoom = null;
      }
    });

    this.events.on('wake', (_sys, data) => {
      this._returnDoor = data?.returnDoor ?? null;
      if (this._returnDoor) {
        const slot = this._activeSlots.find(s => s.key === this._returnDoor);
        if (slot) this.player.body.reset(slot.x, slot.y + 100);
      }
      this.doorZones.forEach(d => d.triggered = false);
      this._lastSentX = null;
      this._lastSentY = null;
      // Re-fetch in case a new room was approved while the player was inside
      this._fetchAndDrawPortals();
    });
  }

  // ── Portal fetch + draw ────────────────────────────────────────────────────
  async _fetchAndDrawPortals() {
    if (this._fetchingPortals) return;
    this._fetchingPortals = true;
    try {
      const res   = await fetch('/api/portal-slots');
      const { slots } = await res.json();

      // Dynamically import room modules for active slots
      for (const slot of slots) {
        if (slot.fileName) {
          try {
            // vite-ignore: path is dynamic (user-submitted room file)
            slot.roomModule = await import(/* @vite-ignore */ '/rooms/' + slot.fileName);
          } catch (e) {
            console.warn('[WorldScene] Could not load room:', slot.fileName, e.message);
            slot.roomModule = null;
          }
        }
      }
      this._activeSlots = slots;
    } catch (e) {
      console.error('[WorldScene] Failed to fetch portal slots:', e);
      // Fall back: show all 20 slots as dim/unclaimed
      this._activeSlots = PORTAL_SLOT_POSITIONS.map(s => ({ ...s, fileName: null, roomModule: null }));
    }

    // Destroy existing portal objects before redrawing
    for (const obj of this._portalObjects) {
      if (obj?.destroy) obj.destroy();
    }
    this._portalObjects = [];
    this._portalCountTexts.clear();
    this._claimHints.clear();
    this._updateHints.clear();
    this.doorZones = [];

    for (const slot of this._activeSlots) {
      const { objects, countText, claimHint, updateHint } = this._drawPortal(slot);
      this._portalObjects.push(...objects);
      this._portalCountTexts.set(slot.key, countText);
      if (claimHint)  this._claimHints.set(slot.key, claimHint);
      if (updateHint) this._updateHints.set(slot.key, updateHint);
      this.doorZones.push({ ...slot, triggered: false });
    }

    this._fetchingPortals = false;
  }

  _drawPortal(slot) {
    const { key, x, y, color, roomName, fileName } = slot;
    const isActive  = !!fileName;
    const drawColor = isActive ? color : 0x555566;
    const coreAlpha = isActive ? 0.55 : 0.2;
    const ringAlpha = isActive ? 0.85 : 0.35;
    const glowAlpha = isActive ? 0.14 : 0.05;
    const objects   = [];
    const track     = obj => { objects.push(obj); return obj; };

    const container = track(this.add.container(x, y).setDepth(7));
    const gfx = this.add.graphics();

    gfx.fillStyle(drawColor, glowAlpha * 0.5);
    gfx.fillCircle(0, 0, 74);
    gfx.fillStyle(drawColor, glowAlpha);
    gfx.fillCircle(0, 0, 58);

    gfx.lineStyle(3, drawColor, ringAlpha);
    gfx.strokeCircle(0, 0, 46);
    gfx.lineStyle(1.5, drawColor, ringAlpha * 0.5);
    gfx.strokeCircle(0, 0, 36);

    gfx.fillStyle(drawColor, coreAlpha);
    gfx.fillCircle(0, 0, 22);
    gfx.fillStyle(0xFFFFFF, isActive ? 0.4 : 0.1);
    gfx.fillCircle(0, 0, 12);
    gfx.fillStyle(0xFFFFFF, isActive ? 0.85 : 0.2);
    gfx.fillCircle(0, 0, 5);

    container.add(gfx);

    const outerRing = this.add.container(0, 0);
    const og = this.add.graphics();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      og.fillStyle(drawColor, isActive ? 0.9 : 0.3);
      og.fillCircle(Math.cos(a) * 52, Math.sin(a) * 52, 4.5);
    }
    outerRing.add(og);
    container.add(outerRing);
    this.tweens.add({ targets: outerRing, angle: 360, duration: isActive ? 4500 : 8000, repeat: -1, ease: 'Linear' });

    const innerRing = this.add.container(0, 0);
    const ig = this.add.graphics();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ig.fillStyle(0xFFFFFF, isActive ? 0.75 : 0.2);
      ig.fillCircle(Math.cos(a) * 32, Math.sin(a) * 32, 3);
    }
    innerRing.add(ig);
    container.add(innerRing);
    this.tweens.add({ targets: innerRing, angle: -360, duration: isActive ? 2800 : 5000, repeat: -1, ease: 'Linear' });

    this.tweens.add({
      targets: container, scaleX: 1.1, scaleY: 1.1,
      duration: isActive ? 1800 : 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      delay: Math.random() * 1200,
    });

    const label     = isActive ? (roomName ?? key) : '???';
    const labelFill = isActive ? '#ffffff' : '#666688';
    track(this.add.text(x, y - 80, label, {
      fontSize: '13px', fill: labelFill, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20));

    const countText = track(this.add.text(x, y - 62, '', {
      fontSize: '11px', fill: '#aaffaa', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20));

    let claimHint  = null;
    let updateHint = null;
    if (!isActive) {
      claimHint = track(this.add.text(x, y - 96, '[E] Claim Portal', {
        fontSize: '12px', fill: '#ccccaa', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(20).setVisible(false));
    } else {
      updateHint = track(this.add.text(x, y - 96, '[U] Update World', {
        fontSize: '12px', fill: '#aaddff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(20).setVisible(false));
    }

    return { objects, countText, claimHint, updateHint };
  }

  // ── Background ────────────────────────────────────────────────────────────
  _createBackground() {
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x5B9ED9, 0x5B9ED9, 0xF4C96A, 0xF4C96A, 1);
    sky.fillRect(0, 0, WORLD_W, 340);
    sky.fillGradientStyle(0xF4C96A, 0xF4C96A, 0xD4956A, 0xD4956A, 1);
    sky.fillRect(0, 290, WORLD_W, 80);

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

  _createMountains() {
    const gfx = this.add.graphics().setDepth(2);
    gfx.fillStyle(0x8090C0);
    gfx.fillTriangle(80,  370, 300,  80, 520,  370);
    gfx.fillTriangle(680, 370, 900,  50, 1120, 370);
    gfx.fillTriangle(1300,370, 1520, 90, 1700, 370);
    gfx.fillStyle(0x4A5590);
    gfx.fillTriangle(-20, 370, 190, 130, 400, 370);
    gfx.fillTriangle(380, 370, 600,  45, 820, 370);
    gfx.fillTriangle(790, 370, 1010,105, 1230,370);
    gfx.fillTriangle(1160,370, 1380, 60, 1610,370);
    gfx.fillStyle(0xEEEEFF);
    gfx.fillTriangle(162, 185, 190, 130, 218, 185);
    gfx.fillTriangle(570,  95, 600,  45, 630,  95);
    gfx.fillTriangle(980, 158, 1010,105, 1040,158);
    gfx.fillTriangle(1348,112, 1380, 60, 1412,112);
  }

  _createRiver() {
    const gfx = this.add.graphics().setDepth(4);
    const SEGS = [
      [130, 220, 68, 150], [130, 340, 185, 68], [272, 340, 68, 195],
      [200, 503, 175, 68], [200, 503, 68, 215], [200, 685, 178, 68],
      [340, 685, 68, 210], [340, 863, 155, 68], [458, 863, 68, 215],
      [458, 1046, 125, 68],
    ];
    gfx.fillStyle(0x4EA8DE);
    for (const [x, y, w, h] of SEGS) gfx.fillRect(x, y, w, h);
    gfx.fillStyle(0x82CBF0);
    for (const [x, y, w, h] of SEGS) {
      const inset = Math.floor(Math.min(w, h) * 0.22);
      gfx.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    }
  }

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
      const tw = Math.round(14 * scale), th = Math.round(68 * scale);
      const armW = Math.round(30 * scale), armH = Math.round(12 * scale);
      const armY = -Math.round(40 * scale), upH = Math.round(22 * scale);
      gfx.fillStyle(0x5A9A3C);
      gfx.fillRect(-tw / 2, -th, tw, th);
      gfx.fillRect(-tw / 2 - armW, armY, armW, armH);
      gfx.fillRect(-tw / 2 - armW, armY - upH, armH, upH);
      gfx.fillRect(tw / 2, armY, armW, armH);
      gfx.fillRect(tw / 2 + armW - armH, armY - upH, armH, upH);
      container.add(gfx);
    }
  }

  _placeBookSculptures() {
    const SCULPTURES = [
      { x: 420, y: 530, books: [
        { w: 65, h: 15, color: 0xE63946 }, { w: 52, h: 14, color: 0x457B9D },
        { w: 72, h: 14, color: 0x2A9D8F }, { w: 46, h: 14, color: 0xE9C46A },
        { w: 58, h: 13, color: 0xF4A261 },
      ]},
      { x: 1190, y: 720, books: [
        { w: 55, h: 14, color: 0x9B2226 }, { w: 68, h: 15, color: 0x1B4332 },
        { w: 44, h: 14, color: 0x3A86FF }, { w: 62, h: 14, color: 0xFFBE0B },
        { w: 50, h: 13, color: 0x8338EC }, { w: 58, h: 14, color: 0xFF6B6B },
      ]},
      { x: 760, y: 945, books: [
        { w: 78, h: 15, color: 0x264653 }, { w: 60, h: 14, color: 0xE76F51 },
        { w: 70, h: 14, color: 0x2A9D8F }, { w: 54, h: 13, color: 0xF4A261 },
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
      const baseW = Math.max(...books.map(b => b.w)) + 20;
      gfx.fillStyle(0x8B7355);
      gfx.fillRect(-baseW / 2, 0, baseW, 14);
      container.add(gfx);
    }
  }

  _createSkyAnimations() {
    this._createMoon();
    this._createStars();
    this._createClouds();
    this._createLightbulb();
    this._createPaperAirplane();
  }

  _createMoon() {
    const gfx = this.add.graphics().setDepth(1);
    gfx.fillStyle(0xFFF5CC, 0.35); gfx.fillCircle(1430, 75, 46);
    gfx.fillStyle(0xFFF5CC);       gfx.fillCircle(1430, 75, 34);
    gfx.fillStyle(0xEEE5AA, 0.55);
    gfx.fillCircle(1422, 68, 6); gfx.fillCircle(1438, 82, 4); gfx.fillCircle(1428, 88, 3);
  }

  _createStars() {
    const gfx = this.add.graphics().setDepth(0.5);
    gfx.fillStyle(0xFFFFEE);
    const STATIC = [
      [120,35],[350,22],[580,48],[830,28],[1070,42],[1290,18],[1490,55],
      [195,75],[720,65],[1110,80],[1560,38],[460,95],[940,88],[1360,105],
      [650,32],[1200,58],[300,110],[850,115],[1440,88],
    ];
    for (const [x, y] of STATIC) gfx.fillRect(x, y, 3, 3);
    for (let i = 0; i < 8; i++) {
      const sg = this.add.graphics().setDepth(0.6);
      sg.fillStyle(0xFFFFDD); sg.fillRect(0, 0, 4, 4);
      sg.setPosition(Phaser.Math.Between(100, WORLD_W - 100), Phaser.Math.Between(15, 220));
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
      { x: 1400, y: 95 }, { x: 900, y: 188 }, { x: 400, y: 202 },
    ];
    for (const { x, y } of DATA) {
      const container = this.add.container(x, y).setDepth(1.5);
      const gfx = this.add.graphics();
      gfx.fillStyle(0xFFFFFF, 0.92);
      gfx.fillEllipse(-32, 4, 76, 32); gfx.fillEllipse(-8, -12, 58, 40); gfx.fillEllipse(28, 4, 64, 28);
      container.add(gfx);
      this.tweens.add({
        targets: container, x: x + Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(14000, 24000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 8000),
      });
    }
  }

  _createLightbulb() {
    const container = this.add.container(800, 130).setDepth(1.8);
    const gfx = this.add.graphics();
    gfx.fillStyle(0xFFFF88, 0.15); gfx.fillCircle(0, 0, 70);
    gfx.fillStyle(0xFFFF88, 0.22); gfx.fillCircle(0, 0, 52);
    gfx.fillStyle(0xFFEE44);       gfx.fillCircle(0, -4, 22);
    gfx.fillStyle(0xCCBB33);
    gfx.fillRect(-8, 14, 16, 8); gfx.fillRect(-5, 22, 10, 5); gfx.fillRect(-5, 27, 10, 4);
    gfx.lineStyle(2.5, 0xFFEE44, 0.8);
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = Phaser.Math.DegToRad(angle);
      gfx.lineBetween(Math.cos(rad) * 30, Math.sin(rad) * 30 - 4, Math.cos(rad) * 48, Math.sin(rad) * 48 - 4);
    }
    container.add(gfx);
    this.tweens.add({ targets: container, scaleX: 1.14, scaleY: 1.14, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  _createPaperAirplane() {
    const container = this.add.container(-60, 140).setDepth(1.9);
    const gfx = this.add.graphics();
    gfx.fillStyle(0xFFFFFF);  gfx.fillTriangle(0, 8, 34, 12, 6, 22);
    gfx.fillStyle(0xDDDDDD);  gfx.fillTriangle(6, 22, 34, 12, 22, 28);
    gfx.lineStyle(1, 0xBBBBBB, 0.8); gfx.lineBetween(0, 8, 22, 28);
    container.add(gfx);
    const fly = () => {
      const startY = Phaser.Math.Between(70, 260);
      container.setPosition(-60, startY);
      this.tweens.add({
        targets: container, x: WORLD_W + 80, y: startY + Phaser.Math.Between(-40, 40),
        duration: Phaser.Math.Between(7000, 11000), ease: 'Linear',
        onComplete: () => this.time.delayedCall(Phaser.Math.Between(4000, 12000), fly),
      });
    };
    this.time.delayedCall(Phaser.Math.Between(2000, 5000), fly);
  }

  // ── Player ────────────────────────────────────────────────────────────────
  _createPlayer() {
    if (!this.playerName) {
      this.playerName = `Player_${Math.floor(Math.random() * 9000) + 1000}`;
    }

    let spawnX = MID_X, spawnY = MID_Y;
    if (this._returnDoor) {
      const slot = this._activeSlots.find(s => s.key === this._returnDoor);
      if (slot) { spawnX = slot.x; spawnY = slot.y + 100; }
    }

    this.player = this.add.rectangle(spawnX, spawnY, 32, 32, 0x00cc44).setDepth(5);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    this.playerLabel = this.add.text(spawnX, spawnY - 24, 'You', {
      fontSize: '12px', fill: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
  }

  _setupCamera() {
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd    = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W, down:  Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  // ── Multiplayer ────────────────────────────────────────────────────────────
  _connectMultiplayer() {
    console.log(`[Colyseus] Connecting to ${SERVER_URL}`);
    const client = new Client(SERVER_URL);
    client.joinOrCreate('world', { name: this.playerName }, WorldState)
      .then(room => {
        this.colyseusRoom = room;
        console.log(`[Colyseus] Joined as "${this.playerName}" (session: ${room.sessionId})`);

        room.onStateChange(state => {
          state.players.forEach((playerState, sessionId) => {
            if (sessionId === room.sessionId) return;
            const inRoom   = playerState.currentRoom !== 'world';
            const existing = this.otherPlayers.get(sessionId);
            if (inRoom) {
              if (existing) { existing.body.setVisible(false); existing.label.setVisible(false); }
              return;
            }
            if (existing) {
              existing.body.setVisible(true);
              existing.label.setVisible(true);
              existing.body.setPosition(playerState.x, playerState.y);
              existing.label.setPosition(playerState.x, playerState.y - 24);
              existing.body.setDepth(5 + playerState.y / 200);
              existing.label.setDepth(5.1 + playerState.y / 200);
            } else {
              const body = this.add.rectangle(playerState.x, playerState.y, 32, 32, 0x888888).setDepth(5);
              const label = this.add.text(playerState.x, playerState.y - 24, playerState.name, {
                fontSize: '12px', fill: '#bbbbbb', stroke: '#000000', strokeThickness: 2,
              }).setOrigin(0.5).setDepth(15);
              this.otherPlayers.set(sessionId, { body, label });
            }
          });

          this.otherPlayers.forEach((p, sessionId) => {
            if (!state.players.has(sessionId)) {
              p.body.destroy(); p.label.destroy();
              this.otherPlayers.delete(sessionId);
            }
          });

          // Update portal occupant counts
          const roomCounts = new Map();
          state.players.forEach(ps => {
            if (ps.currentRoom !== 'world')
              roomCounts.set(ps.currentRoom, (roomCounts.get(ps.currentRoom) ?? 0) + 1);
          });
          this._portalCountTexts.forEach((text, key) => {
            const n = roomCounts.get(key) ?? 0;
            text.setText(n > 0 ? `● ${n} inside` : '');
          });
        });

        // Server pushes this when a room is approved — refresh portals
        room.onMessage('slotsUpdated', () => {
          this._fetchAndDrawPortals();
        });

        // Admin approval / rejection notification
        room.onMessage('notification', data => {
          this._showToast(data.message, data.type);
        });
      })
      .catch(err => {
        console.error('[Colyseus] Connection FAILED:', err.message);
      });
  }

  // ── Update Loop ────────────────────────────────────────────────────────────
  update() {
    // Freeze movement when sign is open or claim overlay is open
    if (this._signOpen || this._claimOpen) {
      this.player.body.setVelocity(0);
      if (this._signOpen) {
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
          if (this._signPage > 0) { this._signPage--; this._renderSignPage(); }
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

    body.velocity.normalize().scale(SPEED);

    this.playerLabel.setPosition(this.player.x, this.player.y - 24);
    this.player.setDepth(5 + this.player.y / 200);
    this.playerLabel.setDepth(5.1 + this.player.y / 200);

    if (this.colyseusRoom) {
      const px = Math.round(this.player.x), py = Math.round(this.player.y);
      if (px !== this._lastSentX || py !== this._lastSentY) {
        this.colyseusRoom.send('move', { x: px, y: py });
        this._lastSentX = px; this._lastSentY = py;
      }
    }

    // ── Signpost proximity (checked before portals so E opens sign first) ──
    const signDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this._signX, this._signY);
    const nearSign = signDist < 80;
    this._signHint.setVisible(nearSign);
    if (nearSign && Phaser.Input.Keyboard.JustDown(this._keyE)) {
      this._openSignpost();
      return;
    }

    // ── Portal proximity ───────────────────────────────────────────────────
    for (const door of this.doorZones) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);

      if (door.roomModule) {
        // Active portal — enter on close approach, update hint at medium range
        const nearUpdate = dist < CLAIM_RADIUS && dist >= PORTAL_RADIUS;
        const hint = this._updateHints.get(door.key);
        if (hint) hint.setVisible(nearUpdate);
        if (nearUpdate && Phaser.Input.Keyboard.JustDown(this._keyU)) {
          this._openClaimOverlay(door.key, true);
        }
        if (dist < PORTAL_RADIUS && !door.triggered) {
          if (hint) hint.setVisible(false);
          door.triggered = true;
          if (this.colyseusRoom) this.colyseusRoom.send('enterRoom', { key: door.key });
          this.scene.launch('RoomScene', {
            room:         door.roomModule,
            returnDoor:   door.key,
            playerName:   this.playerName,
            colyseusRoom: this.colyseusRoom,
            roomKey:      door.key,
            gameFileName: door.gameFileName ?? null,
          });
          this.scene.sleep();
        } else if (dist >= PORTAL_RADIUS) {
          door.triggered = false;
        }
      } else {
        // Dim/unclaimed portal — show claim hint, press E to open overlay
        const hint = this._claimHints.get(door.key);
        const near = dist < CLAIM_RADIUS;
        if (hint) hint.setVisible(near);
        if (near && Phaser.Input.Keyboard.JustDown(this._keyE)) {
          this._openClaimOverlay(door.key, false);
        }
      }
    }
  }

  // ── Claim Overlay (HTML div) ───────────────────────────────────────────────
  _createClaimOverlay() {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:rgba(0,0,0,0.72)',
    ].join(';');
    el.innerHTML = `
      <div style="background:#16213e;border:1px solid #2a4a7f;border-radius:12px;padding:2rem;width:540px;max-width:95vw;font-family:system-ui,sans-serif">
        <h2 id="woc-claim-title" style="color:#f4a261;margin:0 0 0.5rem;font-size:1.1rem">Claim Portal</h2>
        <p id="woc-claim-desc" style="color:#888;font-size:0.82rem;margin-bottom:1.25rem">Enter your name and paste your Gemini-generated world code. The admin will review and approve it.</p>
        <label style="display:block;margin-bottom:0.75rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Your Name (becomes the portal label — max 20 chars)</span>
          <input id="woc-claim-name" type="text" maxlength="20" placeholder="e.g. Alex Chen"
            style="width:100%;padding:0.5rem 0.75rem;background:#0f3460;border:1px solid #2a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.9rem;box-sizing:border-box;outline:none">
        </label>
        <label style="display:block;margin-bottom:1rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">World Code (paste from Gemini Prompt 2)</span>
          <textarea id="woc-claim-code" placeholder="// Paste your room code here..."
            style="width:100%;height:180px;padding:0.5rem 0.75rem;background:#0f3460;border:1px solid #2a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.78rem;font-family:'Courier New',monospace;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        </label>
        <div id="woc-claim-status" style="margin-bottom:0.75rem;font-size:0.82rem;min-height:1.2rem;white-space:pre-wrap"></div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <button id="woc-claim-cancel" style="padding:0.5rem 1.25rem;background:#2a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Cancel</button>
          <button id="woc-claim-submit" style="padding:0.5rem 1.25rem;background:#f4a261;color:#1a1a2e;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Submit World</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._claimOverlayEl = el;
    document.getElementById('woc-claim-cancel').onclick = () => this._closeClaimOverlay();
    document.getElementById('woc-claim-submit').onclick = () => this._submitClaim();
  }

  _openClaimOverlay(slotKey, isUpdate = false) {
    this._claimTargetSlot = slotKey;
    this._claimIsUpdate   = isUpdate;
    if (!this._claimOverlayEl) this._createClaimOverlay();
    // Adapt title and description for update vs. new claim
    const title = document.getElementById('woc-claim-title');
    const desc  = document.getElementById('woc-claim-desc');
    const btn   = document.getElementById('woc-claim-submit');
    if (title) title.textContent = isUpdate ? 'Submit World Update' : 'Claim Portal';
    if (desc)  desc.textContent  = isUpdate
      ? 'Paste your updated room code below. The admin will review it and replace the current version when approved.'
      : 'Enter your name and paste your Gemini-generated world code. The admin will review and approve it.';
    if (btn) btn.textContent = isUpdate ? 'Submit Update' : 'Submit World';
    this._claimOverlayEl.style.display = 'flex';
    document.getElementById('woc-claim-name').value  = '';
    document.getElementById('woc-claim-code').value  = '';
    document.getElementById('woc-claim-status').textContent = '';
    document.getElementById('woc-claim-status').style.color = '#aaa';
    document.getElementById('woc-claim-submit').disabled = false;
    document.getElementById('woc-claim-name').focus();
    this._claimOpen = true;
  }

  _closeClaimOverlay() {
    if (this._claimOverlayEl) this._claimOverlayEl.style.display = 'none';
    this._claimOpen = false;
    this._claimTargetSlot = null;
    this._claimIsUpdate   = false;
  }

  _destroyClaimOverlay() {
    if (this._claimOverlayEl) { this._claimOverlayEl.remove(); this._claimOverlayEl = null; }
  }

  async _submitClaim() {
    const name   = document.getElementById('woc-claim-name').value.trim();
    const code   = document.getElementById('woc-claim-code').value.trim();
    const status = document.getElementById('woc-claim-status');
    const btn    = document.getElementById('woc-claim-submit');

    if (!name) { status.textContent = 'Please enter your name.'; status.style.color = '#e07a7a'; return; }
    if (!code) { status.textContent = 'Please paste your room code.'; status.style.color = '#e07a7a'; return; }

    btn.disabled = true;
    status.textContent = 'Submitting...';
    status.style.color = '#aaa';

    try {
      const res  = await fetch('/api/submit-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotKey:    this._claimTargetSlot,
          playerName: name,
          sessionId:  this.colyseusRoom?.sessionId ?? null,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.errors ? data.errors.join('\n') : (data.error ?? 'Submission failed');
        status.textContent = msg;
        status.style.color = '#e07a7a';
        btn.disabled = false;
      } else {
        const successMsg = this._claimIsUpdate
          ? '✓ Update submitted! You\'ll be notified in-game when the admin approves your update.'
          : '✓ Submitted! The admin will review your world. You\'ll be notified in-game when it\'s approved.';
        status.textContent = successMsg;
        status.style.color = '#52b788';
        setTimeout(() => this._closeClaimOverlay(), 4000);
      }
    } catch (e) {
      status.textContent = `Network error: ${e.message}`;
      status.style.color = '#e07a7a';
      btn.disabled = false;
    }
  }

  // ── Toast notification ─────────────────────────────────────────────────────
  _showToast(message, type = 'info') {
    const colors = {
      approved: { bg: '#1d3a2e', border: '#2d6a4f', text: '#52b788' },
      rejected: { bg: '#3a1d1d', border: '#6a2d2d', text: '#e07a7a' },
      info:     { bg: '#1a1a2e', border: '#444466', text: '#e0e0e0' },
    };
    const c = colors[type] ?? colors.info;
    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%)',
      'z-index:9998;padding:0.75rem 1.5rem;border-radius:8px',
      `background:${c.bg};border:1px solid ${c.border};color:${c.text}`,
      'font-size:0.9rem;font-family:system-ui,sans-serif;font-weight:600',
      'max-width:80vw;text-align:center;pointer-events:none',
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  // ── Signpost ───────────────────────────────────────────────────────────────
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

    this._signX = sx; this._signY = sy;
    this._signOpen = false; this._signPage = 0;

    this._keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this._keyU = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U);
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._signOpen) this._closeSignpost();
      else if (this._claimOpen) this._closeClaimOverlay();
    });

    this._buildSignpostOverlay();
  }

  _buildSignpostOverlay() {
    const CW = 800, CH = 600, cx = CW / 2, cy = CH / 2;
    const PW = 740, PH = 550, px = cx - PW / 2, py = cy - PH / 2;
    const fix = obj => obj.setScrollFactor(0).setDepth(70);

    this._sovBg    = fix(this.add.rectangle(cx, cy, CW, CH, 0x000000).setAlpha(0.78).setVisible(false));
    this._sovPanel = fix(this.add.rectangle(cx, cy, PW, PH, 0x1a0d00).setAlpha(0.97).setVisible(false));

    const gfx = this.add.graphics().setScrollFactor(0).setDepth(71).setVisible(false);
    gfx.lineStyle(2, 0xc8a46e, 1); gfx.strokeRect(px, py, PW, PH);
    gfx.lineStyle(1, 0xc8a46e, 0.5);
    gfx.lineBetween(px + 10, py + 48, px + PW - 10, py + 48);
    gfx.lineBetween(px + 10, py + PH - 70, px + PW - 10, py + PH - 70);
    gfx.lineBetween(px + 10, py + PH - 34, px + PW - 10, py + PH - 34);
    this._sovGfx = gfx;

    this._sovTitle   = fix(this.add.text(cx, py + 15, '', { fontSize: '18px', fill: '#c8a46e', fontStyle: 'bold' }).setOrigin(0.5, 0).setVisible(false));
    this._sovContent = fix(this.add.text(px + 16, py + 56, '', { fontSize: '13px', fill: '#e0e0e0', lineSpacing: 4 }).setVisible(false));

    this._sovCopyBtn = fix(
      this.add.text(cx, py + PH - 52, '[ Copy Prompt ]', {
        fontSize: '14px', fill: '#1a0d00', backgroundColor: '#c8a46e',
        padding: { x: 16, y: 7 },
      }).setOrigin(0.5, 0.5).setVisible(false).setInteractive({ useHandCursor: true }),
    );
    this._sovCopyBtn.on('pointerover',  () => this._sovCopyBtn.setStyle({ fill: '#000000' }));
    this._sovCopyBtn.on('pointerout',   () => this._sovCopyBtn.setStyle({ fill: '#1a0d00' }));
    this._sovCopyBtn.on('pointerdown',  () => this._copyCurrentPrompt());

    this._sovNav     = fix(this.add.text(cx, py + PH - 16, '', { fontSize: '13px', fill: '#c8a46e' }).setOrigin(0.5, 0.5).setVisible(false));
    this._sovPageNum = fix(this.add.text(px + PW - 12, py + PH - 16, '', { fontSize: '13px', fill: '#888888' }).setOrigin(1, 0.5).setVisible(false));

    this._sovBase = [this._sovBg, this._sovPanel, this._sovGfx, this._sovTitle, this._sovContent, this._sovNav, this._sovPageNum];
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
      'VISUAL QUALITY — very important:\n' +
      '- Have a strong visual identity — avoid using plain coloured rectangles as the main style\n' +
      '- Include at least one animated focal point (glowing orb, fire, flowing water, drifting particles)\n' +
      '\n' +
      'Use ONLY these exact Phaser.js drawing methods. Do NOT invent or guess method names:\n' +
      '\n' +
      '  Graphics (const gfx = scene.add.graphics()):\n' +
      '    gfx.fillStyle(0xRRGGBB, alpha)\n' +
      '    gfx.fillRect(x, y, width, height)\n' +
      '    gfx.fillCircle(x, y, radius)\n' +
      '    gfx.fillTriangle(x1,y1, x2,y2, x3,y3)\n' +
      '    gfx.fillPoints([{x,y}, {x,y}, ...], true)\n' +
      '    gfx.beginPath() / moveTo(x,y) / lineTo(x,y) / closePath() / fillPath() / strokePath()\n' +
      '    gfx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)   ← inside beginPath() only\n' +
      '    gfx.lineStyle(width, 0xRRGGBB, alpha)\n' +
      '    gfx.setBlendMode(Phaser.BlendModes.ADD)            ← for glow effects\n' +
      '  Other: scene.add.text / .rectangle / .circle   obj.setDepth(n) / setAlpha(0–1)\n' +
      '  Tweens: scene.tweens.add({ targets, props, duration, yoyo, repeat })\n' +
      '\n' +
      'Create an interactive preview using a mock Phaser scene so I can\n' +
      'see what it looks like. Store all the room logic inside a const called roomCode with:\n' +
      '  name       — a string with the world\'s display name\n' +
      '  onLoad     — function(scene) for loading assets\n' +
      '  onCreate   — function(scene) for building the world\n' +
      '  onUpdate   — function(scene) for per-frame animations and the exit check\n' +
      '  onExit     — function(scene) for cleanup (set scene.roomData = null)\n' +
      '\n' +
      'PLAYER CHARACTER (optional): if your world has a themed character,\n' +
      'build it in onCreate and assign it to scene.player:\n' +
      '  scene.player = /* your character container */;\n' +
      '  scene.cameras.main.startFollow(scene.player, true, 0.1, 0.1);\n' +
      '\n' +
      'GAME ANCHOR (optional): if you want a mini-game attached to your world later,\n' +
      'place a visible interactive object somewhere (a glowing screen, arcade machine,\n' +
      'mysterious chest — your creative choice) and note its x/y position.\n' +
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
      '  ✅ Keep all 5 required export statements exactly as named\n' +
      '  ✅ Keep the exit trigger block in onCreate exactly as shown\n' +
      '  ✅ Keep the exit check block in onUpdate exactly as shown\n' +
      '  ✅ If you designed a game anchor object, export its position:\n' +
      '       export const gameAnchorX = <x>;\n' +
      '       export const gameAnchorY = <y>;\n' +
      '  ✅ If you created a themed player character, uncomment createOtherPlayer\n' +
      '     and fill it with the same shapes (no physics) — see instructions below\n' +
      '  ❌ Do NOT add import, require(), or export default at the top\n' +
      '  ❌ Do NOT wrap in React, HTML, or any framework\n' +
      '  ❌ Do NOT include any explanation, commentary, or code fences\n' +
      '  ❌ Do NOT use fetch(), document, localStorage, or window\n' +
      '\n' +
      'PLAYER CHARACTER (optional):\n' +
      'If your world has a themed character, do BOTH of the following:\n' +
      '  1. In onCreate, build your character and assign it to scene.player:\n' +
      '       const player = scene.add.container(800, 750);\n' +
      '       player.add( /* your character shapes */ );\n' +
      '       scene.physics.world.enable(player);\n' +
      '       player.body.setCollideWorldBounds(true);\n' +
      '       scene.player = player;\n' +
      '       scene.cameras.main.startFollow(player, true, 0.1, 0.1);\n' +
      '  2. Uncomment createOtherPlayer at the bottom of the template.\n' +
      '     Fill it with the same character shapes but WITHOUT physics.\n' +
      '     Set container._labelOffsetY to the pixel height from the\n' +
      '     container origin (feet) to just above the character\'s head.\n' +
      'If your world does NOT have a custom character, leave createOtherPlayer commented out.\n' +
      '\n' +
      '--- START OF TEMPLATE ---\n' +
      '\n' +
      "export const name = 'My World'; // ← use your world name\n" +
      '\n' +
      '// Optional: export these if you placed a game anchor object in your world\n' +
      '// export const gameAnchorX = 800;\n' +
      '// export const gameAnchorY = 600;\n' +
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
      '// ── Uncomment if you built a themed player character above ───────────\n' +
      '// export function createOtherPlayer(scene, { x, y }) {\n' +
      '//   const container = scene.add.container(x, y);\n' +
      '//   // ── same shapes as your local player, no physics ──────────────\n' +
      '//   container._labelOffsetY = 48; // pixels from origin to above head\n' +
      '//   return container;\n' +
      '// }\n' +
      '\n' +
      '--- END OF TEMPLATE ---';

    const PROMPT_GAME =
      'I want to create a mini-game for my world.\n' +
      '\n' +
      'MY WORLD THEME: [YOUR WORLD THEME HERE — e.g. "Crystal Cave", "Underwater World"]\n' +
      '\n' +
      'MY GAME IDEA: [DESCRIBE YOUR GAME HERE — e.g. "a ball-catching game where I move\n' +
      'a basket left and right to catch falling gems", "a memory card matching game with\n' +
      'cave crystals", "dodge the obstacles as they scroll toward you"]\n' +
      '\n' +
      'The mini-game runs as an 800×600 overlay panel on top of my world (Club Penguin\n' +
      'style). Players press [E] near an interactive object in my world to open it.\n' +
      'The game should match or complement my world theme.\n' +
      '\n' +
      'First, show me a playable preview of the game so I can test it and ask for changes.\n' +
      'Then output the final code using EXACTLY this structure — nothing else:\n' +
      '\n' +
      'export const game = {\n' +
      "  gameName: 'Your Game Name',   // ← short name shown in the title bar\n" +
      '  onGameLoad(scene) {},\n' +
      '  onGameCreate(scene) {\n' +
      '    scene.gameData = {};\n' +
      '    // Build the game UI here.\n' +
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
      'STRICT RULES:\n' +
      '  ✅ Export only the game object — nothing else\n' +
      '  ✅ game must have all 4 methods: onGameLoad, onGameCreate, onGameUpdate, onGameExit\n' +
      '  ✅ Use scene.gameData to store all game state\n' +
      '  ✅ Call scene.exitGame() when the game is finished\n' +
      '  ✅ Keep all coordinates within x:0–800, y:65–590\n' +
      '  ❌ Do NOT use import, require(), fetch(), document, or window\n' +
      '  ❌ Do NOT include the room code — this file is the game only\n' +
      '\n' +
      'Output ONLY the complete game file — no explanation.';

    return [
      {
        title: 'HOW TO BUILD YOUR WORLD',
        body:
          'World of Codes lets you create your own world using Gemini AI!\n' +
          'No coding needed — just follow the steps below.\n' +
          '\n' +
          'STEPS:\n' +
          '  1. Pick a creative theme  (e.g. "Crystal Cave", "Neon City")\n' +
          '\n' +
          '  2. Open gemini.google.com in a NEW conversation\n' +
          '\n' +
          '  3. Copy PROMPT 1 (page 2) → paste into Gemini\n' +
          '     Gemini builds a live preview — tweak until happy\n' +
          '\n' +
          '  4. Copy PROMPT 2 (pages 3–4) in the SAME conversation\n' +
          '     Gemini outputs your final world code\n' +
          '\n' +
          '  5. Walk up to any dim/glowing portal in the town square\n' +
          '     Press [E] → enter your name + paste your code → Submit!\n' +
          '\n' +
          '  6. Your portal appears once the admin approves your world\n' +
          '     You\'ll get a notification in-game when it\'s ready!\n' +
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
          'PERSPECTIVE: Pokemon/RPG oblique view — sky at top (y:0–300),\n' +
          'ground below (y:300–1200), objects with visible height.\n' +
          '\n' +
          'VISUAL QUALITY:\n' +
          '  - Strong visual identity — not just plain coloured rectangles\n' +
          '  - At least one animated focal point (glow, fire, water, particles)\n' +
          '\n' +
          'SAFE API: The copied prompt gives Gemini an exact list of Phaser\n' +
          'methods it may use — prevents hallucinated method names.\n' +
          '\n' +
          'Exit zone, exit check, and roomCode structure are all included.\n' +
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
          '  ✅ Keep all 5 required export statements exactly as named\n' +
          '  ✅ Keep the exit trigger in onCreate exactly as shown\n' +
          '  ✅ Keep the exit check in onUpdate exactly as shown\n' +
          '  ✅ If you made a game anchor, uncomment gameAnchorX/Y exports\n' +
          '  ✅ If you made a themed player, uncomment createOtherPlayer\n' +
          '  ❌ No import, require(), or export default at the top\n' +
          '  ❌ No React, HTML, or any framework\n' +
          '  ❌ No explanation, commentary, or code fences\n' +
          '  ❌ No fetch(), document, localStorage, or window\n' +
          '\n' +
          '(Page 4 shows the full template)',
      },
      {
        title: 'PROMPT 2 — Code Template',
        copyText: PROMPT2,
        body:
          'This template is automatically included when you Copy Prompt on page 3.\n' +
          '\n' +
          "export const name = 'My World';\n" +
          '// export const gameAnchorX = 800; // uncomment if you placed a game object\n' +
          '// export const gameAnchorY = 600;\n' +
          'export function onLoad(scene) {}\n' +
          'export function onCreate(scene) {\n' +
          '  scene.roomData = {};\n' +
          '  // world design here (1600×1200)\n' +
          '  // optional: build themed player → assign to scene.player\n' +
          '  // exit trigger block (exact, as-is)\n' +
          '}\n' +
          'export function onUpdate(scene) {\n' +
          '  // exit check (exact, as-is) + per-frame animations\n' +
          '}\n' +
          'export function onExit(scene) { scene.roomData = null; }\n' +
          '\n' +
          '// ── Uncomment if you built a themed player ───────────────────\n' +
          '// export function createOtherPlayer(scene, { x, y }) {\n' +
          '//   const container = scene.add.container(x, y);\n' +
          '//   // same shapes as local player, no physics\n' +
          '//   container._labelOffsetY = 48; // above head in px\n' +
          '//   return container;\n' +
          '// }',
      },
      {
        title: 'OPTIONAL: Add a Mini-Game (Prompt B)',
        copyText: PROMPT_GAME,
        body:
          'Want a playable mini-game inside your world? (Club Penguin style!)\n' +
          '\n' +
          'BEFORE YOU COPY THE PROMPT, decide two things:\n' +
          '  1. Your game idea — what will players actually do?\n' +
          '     e.g. "catch falling stars", "memory card matching",\n' +
          '          "dodge obstacles scrolling toward you"\n' +
          '  2. Your world theme (same as your room)\n' +
          '     e.g. "Crystal Cave", "Underwater World"\n' +
          '\n' +
          'STEPS:\n' +
          '  1. Click "Copy Prompt" below\n' +
          '  2. Paste into a NEW Gemini conversation\n' +
          '  3. Fill in the two placeholders at the TOP of the prompt:\n' +
          '       MY WORLD THEME: [replace this]\n' +
          '       MY GAME IDEA:   [replace this with your idea]\n' +
          '  4. Gemini shows a preview — test and tweak it\n' +
          '  5. Copy the final game code and send to the admin\n' +
          '\n' +
          'HOW IT WORKS IN-GAME:\n' +
          '  - Your room must have a game anchor object (gameAnchorX/Y)\n' +
          '  - Players walk near it → see "[E] ???"\n' +
          '  - Once approved → "[E] Play: <your game name>"',
      },
    ];
  }

  _openSignpost() {
    this._signOpen = true; this._signPage = 0;
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
    const page  = this._signPages[this._signPage];
    const total = this._signPages.length;
    const isLast = this._signPage === total - 1;
    this._sovTitle.setText(page.title);
    this._sovContent.setText(page.body);
    this._sovPageNum.setText(`${this._signPage + 1} / ${total}`);
    this._sovNav.setText(isLast ? '[←] Back   [E / ESC] Close' : '[←/→] Navigate   [E] Next   [ESC] Close');
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
        this.time.delayedCall(1800, () => { if (this._signOpen) this._sovCopyBtn.setText('[ Copy Prompt ]'); });
      })
      .catch(() => {
        this._sovCopyBtn.setText('Copy failed — try a different browser');
        this.time.delayedCall(2500, () => { if (this._signOpen) this._sovCopyBtn.setText('[ Copy Prompt ]'); });
      });
  }
}
