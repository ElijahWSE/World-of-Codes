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
import * as LivelyJungle2 from '../rooms/lively-jungle-2.js';
// [DOOR-IMPORT:east-end]
// [DOOR-IMPORT:south-start]
import * as TropicalSurfHaven from '../rooms/tropical-surf-haven.js';
// [DOOR-IMPORT:south-end]
// [DOOR-IMPORT:west-start]
import * as VibrantCityCenter from '../rooms/vibrant-city-center.js';
// [DOOR-IMPORT:west-end]

// ── World Layout Constants ─────────────────────────────────────────────────
const WORLD_W   = 1600;  // total world width in pixels
const WORLD_H   = 1200;  // total world height in pixels
const TILE_SIZE = 64;    // floor tile size
const WALL_T    = 32;    // wall thickness
const DOOR_W    = 96;    // door opening width (must be > player width of 32)
const SPEED     = 160;   // player movement speed (pixels/second)

// Mid-points of each wall — doors are centered here.
const MID_X = WORLD_W / 2;  // 800
const MID_Y = WORLD_H / 2;  // 600
const HALF_DOOR = DOOR_W / 2; // 48

// ── Door Definitions ───────────────────────────────────────────────────────
// Each entry defines one door in the town square.
// To wire a room to a door: add a `roomModule` property pointing to the import.
// The label shown above the door comes from roomModule.name if present.
// Adding a room = one import above + one roomModule line here. Nothing else changes.
const DOORS = [
  // [DOOR-ENTRY:north-start]
  { key: 'room1', label: ExampleRoom.name, wall: 'north', x: MID_X, y: WALL_T / 2, roomModule: ExampleRoom },
  // [DOOR-ENTRY:north-end]
  // [DOOR-ENTRY:east-start]
  { key: 'room2', label: LivelyJungle2.name, wall: 'east', x: WORLD_W - WALL_T / 2, y: MID_Y, roomModule: LivelyJungle2 },
// [DOOR-ENTRY:east-end]
  // [DOOR-ENTRY:south-start]
  { key: 'room3', label: TropicalSurfHaven.name, wall: 'south', x: MID_X, y: WORLD_H - WALL_T / 2, roomModule: TropicalSurfHaven },
  // [DOOR-ENTRY:south-end]
  // [DOOR-ENTRY:west-start]
  { key: 'room4', label: VibrantCityCenter.name, wall: 'west', x: WALL_T / 2, y: MID_Y, roomModule: VibrantCityCenter },
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
    this._createFloor();
    this._createWalls();
    this._createDoors();
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

  // ── Floor ────────────────────────────────────────────────────────────────
  // Draws an alternating tile grid using a single Graphics object.
  // Much faster than creating hundreds of individual Rectangle objects.
  _createFloor() {
    const gfx = this.add.graphics();
    for (let gx = 0; gx < WORLD_W; gx += TILE_SIZE) {
      for (let gy = 0; gy < WORLD_H; gy += TILE_SIZE) {
        // Checkerboard pattern using tile coordinate parity
        const even = ((gx / TILE_SIZE) + (gy / TILE_SIZE)) % 2 === 0;
        gfx.fillStyle(even ? 0x2d5a27 : 0x265222);
        gfx.fillRect(gx, gy, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ── Walls ────────────────────────────────────────────────────────────────
  // Each wall is split into two segments around the door gap.
  // All segments are static arcade physics bodies so the player collides with them.
  //
  // WHY SPLIT WALLS: Phaser arcade physics doesn't support holes in rectangles.
  // The only way to leave a walkable gap is to use two separate wall pieces.
  _createWalls() {
    const COLOR = 0x5c4033; // dark earthy brown
    this.walls = this.physics.add.staticGroup();

    // Helper: create a wall rectangle with a static physics body
    const wall = (x, y, w, h) => {
      const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, COLOR);
      this.physics.add.existing(r, true); // true = static body
      this.walls.add(r);
    };

    // Top wall — two segments flanking the north door gap
    wall(0,               0, MID_X - HALF_DOOR, WALL_T);
    wall(MID_X + HALF_DOOR, 0, MID_X - HALF_DOOR, WALL_T);

    // Bottom wall — two segments flanking the south door gap
    wall(0,               WORLD_H - WALL_T, MID_X - HALF_DOOR, WALL_T);
    wall(MID_X + HALF_DOOR, WORLD_H - WALL_T, MID_X - HALF_DOOR, WALL_T);

    // Left wall — runs between top and bottom walls, gap for west door
    wall(0, WALL_T,              WALL_T, MID_Y - HALF_DOOR - WALL_T);
    wall(0, MID_Y + HALF_DOOR,   WALL_T, WORLD_H - WALL_T - MID_Y - HALF_DOOR);

    // Right wall — mirror of left
    wall(WORLD_W - WALL_T, WALL_T,            WALL_T, MID_Y - HALF_DOOR - WALL_T);
    wall(WORLD_W - WALL_T, MID_Y + HALF_DOOR, WALL_T, WORLD_H - WALL_T - MID_Y - HALF_DOOR);
  }

  // ── Doors ────────────────────────────────────────────────────────────────
  // Visual door rectangles fill the gap in each wall.
  // A `triggered` flag prevents the console log from firing every frame.
  // PHASE 4: Replace the console.log with scene.start('RoomScene', { ... })
  _createDoors() {
    const DOOR_COLOR  = 0xf4a261; // warm orange — clearly distinct from walls
    const LABEL_STYLE = {
      fontSize: '13px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    };

    this.doorZones = DOORS.map(door => {
      const { x, y, wall, label } = door;

      // Door rectangle — same thickness as the wall it sits in
      const isHorizontal = wall === 'north' || wall === 'south';
      const rect = this.add.rectangle(
        x, y,
        isHorizontal ? DOOR_W : WALL_T,
        isHorizontal ? WALL_T : DOOR_W,
        DOOR_COLOR
      ).setDepth(1);

      // Label positioned just inside the world (away from the wall edge)
      const offsets = {
        north: { dx: 0,           dy: WALL_T + 14 },
        south: { dx: 0,           dy: -(WALL_T + 14) },
        west:  { dx: WALL_T + 48, dy: 0 },
        east:  { dx: -(WALL_T + 48), dy: 0 },
      };
      const off = offsets[wall];
      this.add.text(x + off.dx, y + off.dy, label, LABEL_STYLE)
        .setOrigin(0.5)
        .setDepth(10);

      return { ...door, triggered: false };
    });
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
        // Offset inward from each wall so the player doesn't immediately re-trigger the door.
        const INSET = WALL_T + 60;
        const offsets = {
          north: { dx: 0,     dy:  INSET },
          south: { dx: 0,     dy: -INSET },
          east:  { dx: -INSET, dy: 0     },
          west:  { dx:  INSET, dy: 0     },
        };
        const off = offsets[door.wall] ?? { dx: 0, dy: 0 };
        spawnX = door.x + off.dx;
        spawnY = door.y + off.dy;
      }
    }

    this.player = this.add.rectangle(spawnX, spawnY, 32, 32, 0x00cc44).setDepth(5);
    this.physics.add.existing(this.player); // dynamic physics body
    this.player.body.setCollideWorldBounds(false); // explicit walls handle boundaries

    // Collide player against all wall segments
    this.physics.add.collider(this.player, this.walls);

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
      if (dist < HALF_DOOR && !door.triggered) {
        door.triggered = true;
        if (door.roomModule) {
          this.scene.start('RoomScene', {
            room:        door.roomModule,
            returnDoor:  door.key,
            playerName:  this.playerName,
          });
        } else {
          console.log(`[WorldScene] Door "${door.label}" has no room assigned yet.`);
        }
      } else if (dist >= HALF_DOOR) {
        door.triggered = false; // reset so re-entry works after returning
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

    this.add.rectangle(sx, sy + 14, 8, 48, 0x5c3a1e).setDepth(3);
    this.add.rectangle(sx, sy - 6, 80, 44, 0x7a5230).setDepth(3);
    this.add.rectangle(sx, sy - 6, 74, 38, 0xd4a96a).setDepth(3);
    this.add.text(sx, sy - 6, 'NOTICE\nBOARD', {
      fontSize: '9px', fill: '#3d1f00', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(4);

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
      'I want to design a room for a 2D top-down browser game built with Phaser.js.\n' +
      'My room theme is: [YOUR THEME HERE]\n' +
      '\n' +
      'Create an interactive preview of this room using a mock Phaser scene so I can\n' +
      'see what it looks like. The room should:\n' +
      '- Have a distinct visual style matching my theme (rectangles, circles, stars, text)\n' +
      '- Include animated elements (tweens for movement, blinking, spinning, etc.)\n' +
      '- Have an EXIT zone at the bottom centre of the screen (around x=400, y=560)\n' +
      '\n' +
      'Store all the actual room logic inside a const called roomCode with:\n' +
      '  name       — a string with the room\'s display name\n' +
      '  onLoad     — function(scene) for loading assets\n' +
      '  onCreate   — function(scene) for building the room\n' +
      '  onUpdate   — function(scene) for per-frame animations and the exit check\n' +
      '  onExit     — function(scene) for cleanup (set scene.roomData = null)\n' +
      '\n' +
      'Inside onCreate, always include this exit trigger block at the end:\n' +
      '  const exitZone = scene.add.zone(400, 555, 120, 40);\n' +
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
      "export const name = 'My Room'; // ← use your room name\n" +
      '\n' +
      'export function onLoad(scene) {\n' +
      '}\n' +
      '\n' +
      'export function onCreate(scene) {\n' +
      '  scene.roomData = {};\n' +
      '\n' +
      '  // ── your room design goes here ────────────────────────────────────\n' +
      '\n' +
      '\n' +
      '  // ── exit trigger (keep this block exactly as-is) ──────────────────\n' +
      "  scene.add.rectangle(400, 570, 120, 30, 0x333333);\n" +
      "  scene.add.text(400, 570, 'EXIT', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);\n" +
      '  const exitZone = scene.add.zone(400, 555, 120, 40);\n' +
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

    return [
      {
        title: 'HOW TO BUILD YOUR ROOM',
        body:
          'World of Codes lets you create a room using Gemini AI. No coding needed!\n' +
          '\n' +
          'STEPS:\n' +
          '  1. Pick a creative theme  (e.g. "Crystal Cave", "Neon Arcade")\n' +
          '\n' +
          '  2. Open gemini.google.com in a NEW conversation\n' +
          '\n' +
          '  3. Copy and paste PROMPT 1 (page 2) into Gemini\n' +
          '     Gemini builds a live preview — tweak until happy\n' +
          '\n' +
          '  4. Paste PROMPT 2 (pages 3-4) in the SAME conversation\n' +
          '     Gemini outputs the final room code\n' +
          '\n' +
          '  5. Send the code to the game owner for review\n' +
          '     Your door appears in the town square once approved!\n' +
          '\n' +
          'Rooms CAN:    shapes, colours, text, animations\n' +
          'Rooms CANNOT: imports, network requests, browser storage',
      },
      {
        title: 'PROMPT 1 — Design & Preview',
        copyText: PROMPT1,
        body:
          'Click "Copy Prompt", replace [YOUR THEME HERE], then paste into Gemini.\n' +
          '\n' +
          'I want to design a room for a 2D top-down browser game built\n' +
          'with Phaser.js. My room theme is: [YOUR THEME HERE]\n' +
          '\n' +
          'Create an interactive preview. The room should:\n' +
          '  - Visual style matching my theme (shapes, text, colours)\n' +
          '  - Animated elements (tweens, blinking, spinning)\n' +
          '  - EXIT zone at the bottom centre (around x=400, y=560)\n' +
          '\n' +
          'Store logic in a const roomCode with: name, onLoad, onCreate, onUpdate, onExit\n' +
          '\n' +
          'In onCreate, end with exit trigger:\n' +
          '  const exitZone = scene.add.zone(400, 555, 120, 40);\n' +
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
          "export const name = 'My Room'; // ← your room name\n" +
          'export function onLoad(scene) {}\n' +
          'export function onCreate(scene) {\n' +
          '  scene.roomData = {};\n' +
          '  // your room design here\n' +
          "  scene.add.rectangle(400, 570, 120, 30, 0x333333);\n" +
          "  scene.add.text(400, 570, 'EXIT', {\n" +
          "    fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);\n" +
          '  const exitZone = scene.add.zone(400, 555, 120, 40);\n' +
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
