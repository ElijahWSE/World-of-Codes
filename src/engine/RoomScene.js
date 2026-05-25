// RoomScene.js — Hosts a player-submitted room.
//
// Lifecycle:
//   init()    — receives room module and context data from WorldScene
//   preload() — calls room.onLoad(scene) so the room can load its assets
//   create()  — builds the player, back button, then calls RoomLoader.loadRoom()
//   update()  — handles player movement and calls scene._roomUpdate() each frame
//
// scene.exitRoom() is defined here and exposed on the scene instance so that
// room hooks can call it via scene.exitRoom(). It calls room.onExit() then
// transitions back to WorldScene, spawning the player at the door they came from.

import Phaser from 'phaser';
import { loadRoom } from '../room-loader/RoomLoader.js';

const SPEED  = 160;  // pixels per second — same as WorldScene
const ROOM_W = 1600; // world width — same as the town square
const ROOM_H = 1200; // world height — same as the town square

export default class RoomScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RoomScene' });
  }

  // ── init ─────────────────────────────────────────────────────────────────────
  // Runs before preload. Receives data passed by WorldScene.scene.start().
  init(data) {
    this._roomModule    = data?.room          ?? null;
    this._returnDoor    = data?.returnDoor    ?? null;
    this._playerName    = data?.playerName    ?? 'You';
    this._colyseusRoom  = data?.colyseusRoom  ?? null;
    this._roomKey       = data?.roomKey       ?? null;
    this._gameFileName  = data?.gameFileName  ?? null;  // separate game file for this room
    this._gameModule    = null;                          // loaded dynamically in create()
    this._roomUpdate    = null;
    this._loaded        = false;
    this._exited        = false;
    this._lastSentRoomX = null;
    this._lastSentRoomY = null;
  }

  // ── preload ───────────────────────────────────────────────────────────────────
  // Phaser's preload phase — the only place asset loading (scene.load.*) works.
  preload() {
    if (!this._roomModule) return;
    try {
      this._roomModule.onLoad(this);
    } catch (err) {
      console.error('[RoomScene] onLoad threw:', err);
      // Failure is non-fatal here — onCreate will still run and can show its own error.
    }
  }

  // ── create ────────────────────────────────────────────────────────────────────
  create() {
    // Fallback background — rooms draw their own world on top of this.
    this.add.rectangle(ROOM_W / 2, ROOM_H / 2, ROOM_W, ROOM_H, 0x111118);

    // Physics and camera bounds for the large world
    this.physics.world.setBounds(0, 0, ROOM_W, ROOM_H);
    this.cameras.main.setBounds(0, 0, ROOM_W, ROOM_H);

    // ── Player sprite ─────────────────────────────────────────────────────────
    // Exposed as `scene.player` so room hooks can reference it.
    // Spawns at world centre.
    this.player = this.add.rectangle(ROOM_W / 2, ROOM_H / 2, 32, 32, 0x00cc44).setDepth(10);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true); // can't walk off the 1600×1200 world

    // Camera follows the player across the large world
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Name tag — repositioned every frame to float above the player
    this._nameTag = this.add.text(ROOM_W / 2, ROOM_H / 2 - 24, this._playerName, {
      fontSize: '12px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);

    // ── Input ─────────────────────────────────────────────────────────────────
    this._cursors = this.input.keyboard.createCursorKeys();
    this._wasd    = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this._keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // ── Back button ───────────────────────────────────────────────────────────
    // Fixed to the screen (scrollFactor 0) and always rendered on top (depth 200).
    // Calls this.exitRoom() which is set below — works whether the room loaded or not.
    const btnBg = this.add.rectangle(60, 28, 104, 30, 0x222222)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive({ useHandCursor: true });

    this.add.text(60, 28, '← Back', {
      fontSize: '13px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0x444444));
    btnBg.on('pointerout',  () => btnBg.setFillStyle(0x222222));
    btnBg.on('pointerdown', () => this.exitRoom());

    // ── Other players in this room ────────────────────────────────────────────
    // _roomPlayers: Map of sessionId → { body, label } for rendering
    // this.players: array of { name, x, y } exposed to room hooks via scene.players
    this._roomPlayers = new Map();
    this.players      = [];

    if (this._colyseusRoom) {
      this._colyseusRoom.onStateChange(state => {
        const seenIds    = new Set();
        const newPlayers = [];

        state.players.forEach((ps, sessionId) => {
          if (sessionId === this._colyseusRoom.sessionId) return;
          if (ps.currentRoom !== this._roomKey) return;

          seenIds.add(sessionId);
          newPlayers.push({ name: ps.name, x: ps.roomX, y: ps.roomY });

          const existing = this._roomPlayers.get(sessionId);
          if (existing) {
            existing.body.setPosition(ps.roomX, ps.roomY);
            existing.label.setPosition(ps.roomX, ps.roomY - (existing.body._labelOffsetY ?? 24));
          } else {
            // If the room exports createOtherPlayer, use it — otherwise fall back to gray box.
            let body;
            try {
              body = this._roomModule?.createOtherPlayer?.(this, { name: ps.name, x: ps.roomX, y: ps.roomY });
              if (body) body.setDepth(10);
            } catch (e) {
              console.error('[RoomScene] createOtherPlayer threw:', e);
              body = null;
            }
            if (!body) body = this.add.rectangle(ps.roomX, ps.roomY, 32, 32, 0x888888).setDepth(10);
            const labelOffsetY = body._labelOffsetY ?? 24;
            const label = this.add.text(ps.roomX, ps.roomY - labelOffsetY, ps.name, {
              fontSize: '12px', fill: '#bbbbbb', stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(15);
            this._roomPlayers.set(sessionId, { body, label });
          }
        });

        this._roomPlayers.forEach((p, sessionId) => {
          if (!seenIds.has(sessionId)) {
            p.body.destroy();
            p.label.destroy();
            this._roomPlayers.delete(sessionId);
          }
        });

        this.players = newPlayers;
      });
    }

    // ── exitRoom ──────────────────────────────────────────────────────────────
    // Defined before loadRoom() is called so room hooks can reference scene.exitRoom()
    // safely inside onCreate or onUpdate.
    //
    // After a successful load, the full version (which calls onExit) is set below.
    // If loadRoom fails, this default version just returns to WorldScene cleanly.
    this.exitRoom = () => {
      if (this._exited) return;
      this._exited = true;
      if (this._colyseusRoom) this._colyseusRoom.send('exitRoom');
      this.scene.wake('WorldScene', { returnDoor: this._returnDoor });
      this.scene.stop();
    };

    // ── Game anchor hint ──────────────────────────────────────────────────────
    // gameAnchorX/Y = new separate-game system (Phase 7+)
    // gameZoneX/Y   = legacy in-file game system (Phase 6, still supported)
    this._gameHint = null;
    this._gameAnchorX = this._roomModule?.gameAnchorX ?? this._roomModule?.gameZoneX;
    this._gameAnchorY = this._roomModule?.gameAnchorY ?? this._roomModule?.gameZoneY ?? this._gameAnchorX;

    if (this._gameAnchorX !== undefined) {
      // Show dim hint immediately; upgrades once game module is confirmed loaded
      this._gameHint = this.add.text(this._gameAnchorX, this._gameAnchorY - 64,
        '[E]  ???', {
        fontSize: '13px', fill: '#888866',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(20).setVisible(false);
    }

    // Load game module: prefer separate file, fall back to inline room.game export
    this._loadGameModule();

    // ── Load room ─────────────────────────────────────────────────────────────
    if (!this._roomModule) {
      // No room was passed — show a clear error (shouldn't happen in normal use).
      this._showNoRoomError();
      return;
    }

    this._loaded = loadRoom(this._roomModule, this);

    if (this._loaded) {
      // Upgrade exitRoom to call onExit before leaving.
      // Replace the default defined above so rooms that call scene.exitRoom()
      // from inside onUpdate get this version automatically.
      this.exitRoom = () => {
        if (this._exited) return;
        this._exited = true;
        if (this._colyseusRoom) this._colyseusRoom.send('exitRoom');
        try {
          this._roomModule.onExit(this);
        } catch (err) {
          console.error('[RoomScene] onExit threw:', err);
        }
        this.scene.wake('WorldScene', { returnDoor: this._returnDoor });
        this.scene.stop();
      };
    }
  }

  // Loads the game module for this room — either the separate file or inline export.
  async _loadGameModule() {
    if (this._gameFileName) {
      try {
        // vite-ignore: dynamic path (user-submitted game file)
        this._gameModule = await import(/* @vite-ignore */ '/rooms/' + this._gameFileName);
      } catch (e) {
        console.warn('[RoomScene] Could not load game file:', this._gameFileName, e.message);
      }
    } else if (this._roomModule?.game) {
      // Legacy: game was exported from the room file itself
      this._gameModule = { game: this._roomModule.game };
    }

    if (this._gameModule?.game && this._gameHint) {
      const gameName = this._gameModule.game.gameName ?? 'Mini-Game';
      this._gameHint.setText(`[E]  Play: ${gameName}`);
      this._gameHint.setStyle({ fill: '#ffdd88' });
    }
  }

  // ── update ────────────────────────────────────────────────────────────────────
  update() {
    // ── Player movement ───────────────────────────────────────────────────────
    const body = this.player.body;
    body.setVelocity(0);

    if      (this._cursors.left.isDown  || this._wasd.left.isDown)  body.setVelocityX(-SPEED);
    else if (this._cursors.right.isDown || this._wasd.right.isDown) body.setVelocityX(SPEED);

    if      (this._cursors.up.isDown    || this._wasd.up.isDown)    body.setVelocityY(-SPEED);
    else if (this._cursors.down.isDown  || this._wasd.down.isDown)  body.setVelocityY(SPEED);

    body.velocity.normalize().scale(SPEED);

    // Floating name tag follows the player
    this._nameTag.setPosition(this.player.x, this.player.y - 24);

    // ── Game anchor proximity ─────────────────────────────────────────────────
    if (this._gameHint && this._gameAnchorX !== undefined) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this._gameAnchorX, this._gameAnchorY,
      );
      const near = dist < 80;
      this._gameHint.setVisible(near);
      if (near && this._gameModule?.game && Phaser.Input.Keyboard.JustDown(this._keyE)) {
        this.scene.launch('GameScene', { game: this._gameModule.game });
        this.scene.pause();
      }
    }

    // ── Sync room position to server ──────────────────────────────────────────
    if (this._colyseusRoom) {
      const px = Math.round(this.player.x);
      const py = Math.round(this.player.y);
      if (px !== this._lastSentRoomX || py !== this._lastSentRoomY) {
        this._colyseusRoom.send('roomMove', { x: px, y: py });
        this._lastSentRoomX = px;
        this._lastSentRoomY = py;
      }
    }

    // ── Room frame hook ───────────────────────────────────────────────────────
    // scene._roomUpdate is set by loadRoom() after a successful onCreate.
    // onUpdate errors are caught inside the wrapper — they won't crash the game.
    if (this._roomUpdate) {
      this._roomUpdate();
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────────
  _showNoRoomError() {
    this.add.text(ROOM_W / 2, ROOM_H / 2,
      'No room module was provided.\nPress the Back button to return.',
      { fontSize: '16px', fill: '#ff4444', align: 'center' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(100);
  }
}
