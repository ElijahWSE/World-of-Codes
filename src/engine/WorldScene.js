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
// Add one import per room file here. Then reference it in DOORS below.
import * as ExampleRoom from '../rooms/example-room.js';
import * as UnicornGarden from '../rooms/unicorn-garden.js';
import * as TropicalSurfHaven from '../rooms/tropical-surf-haven.js';
import * as VibrantCityCenter from '../rooms/vibrant-city-center.js';

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
  { key: 'room1', label: ExampleRoom.name, wall: 'north', x: MID_X,               y: WALL_T / 2,          roomModule: ExampleRoom },
  { key: 'room2', label: UnicornGarden.name, wall: 'east',  x: WORLD_W - WALL_T / 2, y: MID_Y, roomModule: UnicornGarden },
  { key: 'room3', label: TropicalSurfHaven.name, wall: 'south', x: MID_X, y: WORLD_H - WALL_T / 2, roomModule: TropicalSurfHaven },
  { key: 'room4', label: VibrantCityCenter.name, wall: 'west', x: WALL_T / 2, y: MID_Y, roomModule: VibrantCityCenter },
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
  }
}
