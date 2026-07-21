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
import { createCharacter, updateCharacter, fetchCharacterConfig } from './CharacterRenderer.js';
import { createObject, updateObject, setObjectConfig, OBJECT_LIMITS } from './ObjectRenderer.js';
import { getFreshIdToken } from '../auth/session.js';
import { buildSharingFieldsHTML, refreshSharingFields, readSharingFields, wireShareCheckbox } from './creationSharing.js';

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
    this._playerUid     = data?.playerUid     ?? null;
    this._playerCharacterConfig = data?.playerCharacterConfig ?? null;
    this._colyseusRoom  = data?.colyseusRoom  ?? null;
    this._roomKey       = data?.roomKey       ?? null;
    this._gameFileName  = data?.gameFileName  ?? null;  // separate game file for this room
    this._gameVersion   = data?.gameVersion   ?? null;  // cache-buster for the import() below
    this._gameModule    = null;                          // loaded dynamically in create()
    this._musicFileName = data?.musicFileName ?? null;  // room music file (Phase 11 milestone 4)
    this._musicVersion  = data?.musicVersion  ?? null;  // cache-buster for the import() below
    this._musicModule   = null;                          // loaded dynamically in create()
    this._roomUpdate    = null;
    this._loaded        = false;
    this._exited        = false;
    this._lastSentRoomX = null;
    this._lastSentRoomY = null;

    // ── Objects (Phase 11) ──────────────────────────────────────────────────
    // Decorative entries: { data, subKind:'decorative', container, hint, ownerHint, draggableSetup }
    // Interactive entries (M3): { data, subKind:'interactive', mod, ctx, hint, ownerHint }
    // — no container/draggableSetup, since interactive object code owns its
    // own scene.add.* visuals directly rather than handing the engine one
    // Container it can drag.
    this._objectContainers = new Map();
    this._isRoomOwner      = false;
    this._objectOverlayOpen = false;
    this._objectOverlayEl   = null;
    this._draggingObjectId  = null; // set while the owner is drag-moving an object (M2)
    this._objectEditingId   = null; // set while the Add/Edit overlay is in edit mode (M2)
    this._objectMode        = 'decorative'; // Add Object overlay toggle: 'decorative' | 'interactive' (M3)

    // ── Music submission (Phase 11 milestone 4) ─────────────────────────────
    this._musicOverlayEl   = null;
    this._musicOverlayOpen = false;

    // ── In-room Help overlay (Phase 11, player guide) ───────────────────────
    this._helpOverlayEl   = null;
    this._helpOverlayOpen = false;
    this._helpPage        = 0;

    // ── Creative Process Log (Phase 12) ─────────────────────────────────────
    this._processLogOverlayEl   = null;
    this._processLogOverlayOpen = false;
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
    this.player = createCharacter(this, this._playerCharacterConfig, ROOM_W / 2, ROOM_H / 2).setDepth(10);
    // Some rooms (e.g. elijah-worldcup-test.js) dress the local player in
    // their own themed look by reassigning scene.player entirely inside
    // onCreate, per the room contract's "interact only through scene" rule.
    // If that happens below, this reference lets us clean up the character
    // container created here — otherwise it's an orphan: still visible,
    // still physics-enabled, just no longer driven by input or animation.
    const defaultPlayerContainer = this.player;
    this.physics.add.existing(this.player);
    // See WorldScene._createPlayer() for why a Container body needs an
    // explicit size — it has no natural width/height for Arcade physics to
    // infer one from, unlike the placeholder rectangle this replaces.
    this.player.body.setSize(28, 28);
    this.player.body.setOffset(-14, -14);
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
    this._keyG = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this._keyO = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O);
    this._keyC = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C); // edit object (owner)
    this._keyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X); // delete object (owner)
    this._keyM = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M); // submit music (owner)
    this._keyH = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H); // in-room help (anyone)
    this._keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P); // process log (anyone views, owner edits)
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._gameOverlayOpen)   this._closeGameOverlay();
      if (this._objectOverlayOpen) this._closeObjectOverlay();
      if (this._musicOverlayOpen)  this._closeMusicOverlay();
      if (this._helpOverlayOpen)   this._closeHelpOverlay();
      if (this._processLogOverlayOpen) this._closeProcessLogOverlay();
    });

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
            const dx = ps.roomX - existing.body.x;
            const dy = ps.roomY - existing.body.y;
            existing.moving  = dx !== 0 || dy !== 0;
            existing.facingX = dx;
            existing.body.setPosition(ps.roomX, ps.roomY);
            existing.label.setPosition(ps.roomX, ps.roomY - (existing.body._labelOffsetY ?? 24));
          } else {
            // A room that exports its own createOtherPlayer wants full
            // control over how visiting players look (e.g. kristabelly.js's
            // hand-authored Pooh-style residents elsewhere in the room use
            // this same hook) — that always wins over the player's own
            // designed character. Rooms that don't export it get the
            // player's real character instead of a generic gray box.
            let body;
            try {
              body = this._roomModule?.createOtherPlayer?.(this, { name: ps.name, x: ps.roomX, y: ps.roomY });
              if (body) body.setDepth(10);
            } catch (e) {
              console.error('[RoomScene] createOtherPlayer threw:', e);
              body = null;
            }
            const usingRoomBody = !!body;
            if (!body) body = this.add.rectangle(ps.roomX, ps.roomY, 32, 32, 0x888888).setDepth(10);

            const labelOffsetY = body._labelOffsetY ?? 24;
            const label = this.add.text(ps.roomX, ps.roomY - labelOffsetY, ps.name, {
              fontSize: '12px', fill: '#bbbbbb', stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(15);
            const entry = { body, label, moving: false, facingX: 0, animated: false };
            this._roomPlayers.set(sessionId, entry);

            if (!usingRoomBody) {
              fetchCharacterConfig(ps.uid).then(config => {
                if (this._roomPlayers.get(sessionId) !== entry) return;
                const container = createCharacter(this, config, entry.body.x, entry.body.y).setDepth(10);
                entry.body.destroy();
                entry.body     = container;
                entry.animated = true;
              });
            }
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

      // Server pushes this when a game (or room) gets approved. The
      // gameFileName this scene started with was a snapshot taken when
      // WorldScene launched us — if approval happens while the player is
      // already standing in the room, that snapshot goes stale and [E]
      // would say "???" forever without this.
      this._unsubSlotsUpdated = this._colyseusRoom.onMessage('slotsUpdated', () => {
        this._refreshGameModule();
        this._refreshMusicModule();
      });

      // Server pushes this whenever any object in this room is added, moved,
      // or removed (by any player, in any tab) — re-fetch to stay in sync.
      this._unsubObjectsUpdated = this._colyseusRoom.onMessage('objectsUpdated', () => {
        this._fetchAndDrawObjects();
      });
    }

    // ── Objects (Phase 11) ────────────────────────────────────────────────────
    this._addObjectHint = this.add.text(16, this.cameras.main.height - 16, '[O]  Add Object', {
      fontSize: '13px', fill: '#88ccff', stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0, 1).setScrollFactor(0).setDepth(200).setVisible(false);

    // ── Room music submit hint (Phase 11 milestone 4) ───────────────────────
    // Ambient, owner-only, no anchor — stacked directly above [O] Add Object
    // so the two owner hints don't overlap.
    this._addMusicHint = this.add.text(16, this.cameras.main.height - 40, '[M]  Submit Music', {
      fontSize: '13px', fill: '#88ccff', stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0, 1).setScrollFactor(0).setDepth(200).setVisible(false);

    // ── In-room Help hint (player guide) ─────────────────────────────────────
    // Visible to anyone (owner or visitor) — pure reference content, no
    // server writes, so no ownership gate. Top-right, clear of the top-left
    // Back button and the bottom-left owner hints.
    this._helpHint = this.add.text(this.cameras.main.width - 16, 16, '[H]  Help', {
      fontSize: '13px', fill: '#88ccff', stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(200);

    // ── Creative Process Log hint (Phase 12) ──────────────────────────────────
    // Visible to anyone (owner or visitor) — reading a log has no ownership
    // gate, only writing does (checked inside the overlay itself). Bottom-
    // right, clear of the bottom-left owner hints and the top-right Help hint.
    this._processLogHint = this.add.text(this.cameras.main.width - 16, this.cameras.main.height - 16, '[P]  Process Log', {
      fontSize: '13px', fill: '#88ccff', stroke: '#000000', strokeThickness: 4,
      backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(200);

    this._checkOwnership();
    this._fetchAndDrawObjects();

    // Movable objects (M2): scene-level drag handlers, bound once. Only
    // containers the owner has been granted setDraggable() on (see
    // _updateObjectInteractivity) ever fire these.
    this.input.on('dragstart', (pointer, gameObject) => {
      this._draggingObjectId = gameObject.objectId ?? null;
    });
    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      const x = Phaser.Math.Clamp(dragX, 0, ROOM_W);
      const y = Phaser.Math.Clamp(dragY, 0, ROOM_H);
      gameObject.setPosition(x, y).setDepth(y);
      const entry = this._objectContainers.get(gameObject.objectId);
      if (entry) {
        entry.data.x = x;
        entry.data.y = y;
        entry.hint?.setPosition(x, y - 40);
      }
    });
    this.input.on('dragend', (pointer, gameObject) => {
      this._draggingObjectId = null;
      this._persistObjectMove(gameObject.objectId, gameObject.x, gameObject.y);
    });

    // ── exitRoom ──────────────────────────────────────────────────────────────
    // Defined before loadRoom() is called so room hooks can reference scene.exitRoom()
    // safely inside onCreate or onUpdate.
    //
    // After a successful load, the full version (which calls onExit) is set below.
    // If loadRoom fails, this default version just returns to WorldScene cleanly.
    this.exitRoom = () => {
      if (this._exited) return;
      this._exited = true;
      this._unsubSlotsUpdated?.();
      this._unsubObjectsUpdated?.();
      try { this._musicModule?.music?.stop?.(this); } catch (err) {
        console.error('[RoomScene] music.stop threw:', err);
      }
      if (this._colyseusRoom) this._colyseusRoom.send('exitRoom');
      this.scene.wake('WorldScene', { returnDoor: this._returnDoor });
      this.scene.stop();
    };

    // ── Game anchor hint ──────────────────────────────────────────────────────
    // gameAnchorX/Y = new separate-game system (Phase 7+)
    // gameZoneX/Y   = legacy in-file game system (Phase 6, still supported)
    this._gameHint       = null;
    this._gameSubmitHint = null;
    // A prior RoomScene run (any room, since scene.start() re-runs create()
    // without ever destroying the old overlay div) may have left its overlay
    // orphaned in the DOM. Remove it so the new one below doesn't collide on
    // id with a stale, hidden copy — getElementById() always returns the
    // first match in document order, which would silently bind the Submit/
    // Cancel handlers to the dead element instead of the visible one.
    document.getElementById('woc-game-overlay')?.remove();
    document.getElementById('woc-object-overlay')?.remove();
    document.getElementById('woc-music-overlay')?.remove();
    document.getElementById('woc-help-overlay')?.remove();
    document.getElementById('woc-processlog-overlay')?.remove();
    this._gameOverlayEl  = null;
    this._gameOverlayOpen = false;
    this._musicOverlayEl  = null;
    this._musicOverlayOpen = false;
    this._helpOverlayEl   = null;
    this._helpOverlayOpen = false;
    this._processLogOverlayEl   = null;
    this._processLogOverlayOpen = false;
    this._gameAnchorX = this._roomModule?.gameAnchorX ?? this._roomModule?.gameZoneX;
    this._gameAnchorY = this._roomModule?.gameAnchorY ?? this._roomModule?.gameZoneY ?? this._gameAnchorX;

    if (this._gameAnchorX !== undefined) {
      // Depth 2000 is well above anything a room can plausibly draw — rooms
      // commonly y-sort their own art (depth = object's y, up to ROOM_H =
      // 1200), so a low fixed depth here (the old value was 20) gets buried
      // under room content placed at or near the same anchor point, which
      // compounds with low contrast to make these hints unreadable.
      const HINT_DEPTH = 2000;

      // Show dim hint immediately; upgrades once game module is confirmed loaded
      this._gameHint = this.add.text(this._gameAnchorX, this._gameAnchorY - 64,
        '[E]  ???', {
        fontSize: '14px', fill: '#ffffff',
        stroke: '#000000', strokeThickness: 4,
        backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(HINT_DEPTH).setVisible(false);

      // Submit hint — always available so players can paste their game code
      this._gameSubmitHint = this.add.text(this._gameAnchorX, this._gameAnchorY - 84,
        '[G]  Submit Game', {
        fontSize: '13px', fill: '#88ccff',
        stroke: '#000000', strokeThickness: 4,
        backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(HINT_DEPTH).setVisible(false);
    }

    // Load game module: prefer separate file, fall back to inline room.game export
    this._loadGameModule();

    // Load and start this room's music, if any (Phase 11 milestone 4)
    this._loadMusicModule();

    // ── Load room ─────────────────────────────────────────────────────────────
    if (!this._roomModule) {
      // No room was passed — show a clear error (shouldn't happen in normal use).
      this._showNoRoomError();
      return;
    }

    this._loaded = loadRoom(this._roomModule, this);

    // Clean up the orphaned default character if the room replaced
    // scene.player with its own — see the comment where it was created.
    if (this.player !== defaultPlayerContainer) {
      defaultPlayerContainer.destroy();
    }

    if (this._loaded) {
      // Upgrade exitRoom to call onExit before leaving.
      // Replace the default defined above so rooms that call scene.exitRoom()
      // from inside onUpdate get this version automatically.
      this.exitRoom = () => {
        if (this._exited) return;
        this._exited = true;
        this._unsubObjectsUpdated?.();
        try { this._musicModule?.music?.stop?.(this); } catch (err) {
          console.error('[RoomScene] music.stop threw:', err);
        }
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
        // vite-ignore: dynamic path (user-submitted game file).
        // ?v=gameVersion busts the browser's ES module cache — see the
        // matching comment in WorldScene._fetchAndDrawPortals().
        const url = '/rooms/' + this._gameFileName + (this._gameVersion ? `?v=${this._gameVersion}` : '');
        this._gameModule = await import(/* @vite-ignore */ url);
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

  // Re-checks the server for this slot's gameFileName and (re)loads the
  // module if a game has since been approved. No-ops once a game is loaded,
  // since approved games are never unapproved mid-session.
  async _refreshGameModule() {
    if (this._gameModule?.game || !this._roomKey) return;
    try {
      const res  = await fetch('/api/portal-slots');
      const { slots } = await res.json();
      const slot = slots.find(s => s.key === this._roomKey);
      if (slot?.gameFileName && slot.gameVersion !== this._gameVersion) {
        this._gameFileName = slot.gameFileName;
        this._gameVersion  = slot.gameVersion;
        await this._loadGameModule();
      }
    } catch (e) {
      console.warn('[RoomScene] Could not refresh game module:', e.message);
    }
  }

  // Loads and starts this room's music, if any (Phase 11 milestone 4).
  // Music is ambient, one track per room — dynamically imported from
  // /rooms/ the same way games are, then play(scene) is called once.
  async _loadMusicModule() {
    if (!this._musicFileName) return;
    try {
      // ?v=musicVersion busts the browser's ES module cache — same reason
      // as the game/room cache-busting elsewhere in this file.
      const url = '/rooms/' + this._musicFileName + (this._musicVersion ? `?v=${this._musicVersion}` : '');
      this._musicModule = await import(/* @vite-ignore */ url);
      try { this._musicModule?.music?.play(this); } catch (err) {
        console.error('[RoomScene] music.play threw:', err);
      }
    } catch (e) {
      console.warn('[RoomScene] Could not load music file:', this._musicFileName, e.message);
    }
  }

  // Re-checks the server for this slot's musicFileName and swaps to the new
  // track if it changed (e.g. the owner just updated their music while
  // standing in the room) — stops the old track first so two tracks never
  // play at once.
  async _refreshMusicModule() {
    if (!this._roomKey) return;
    try {
      const res  = await fetch('/api/portal-slots');
      const { slots } = await res.json();
      const slot = slots.find(s => s.key === this._roomKey);
      if (slot?.musicFileName && slot.musicVersion !== this._musicVersion) {
        try { this._musicModule?.music?.stop?.(this); } catch (err) {
          console.error('[RoomScene] music.stop threw:', err);
        }
        this._musicFileName = slot.musicFileName;
        this._musicVersion  = slot.musicVersion;
        await this._loadMusicModule();
      }
    } catch (e) {
      console.warn('[RoomScene] Could not refresh music module:', e.message);
    }
  }

  // Checks whether the local player owns this room's slot — gates the
  // "[O] Add Object" hint. Only the room's creator can furnish it.
  async _checkOwnership() {
    if (!this._roomKey || !this._playerUid) return;
    try {
      const res   = await fetch('/api/portal-slots');
      const { slots } = await res.json();
      const slot  = slots.find(s => s.key === this._roomKey);
      this._isRoomOwner = !!(slot?.uid && slot.uid === this._playerUid);
      this._addObjectHint?.setVisible(this._isRoomOwner);
      this._addMusicHint?.setVisible(this._isRoomOwner);
      // Ownership resolves async and can land after objects are already
      // drawn (see _fetchAndDrawObjects) — re-check every existing entry
      // now that we know for sure.
      for (const entry of this._objectContainers.values()) {
        this._updateObjectInteractivity(entry);
      }
    } catch (e) {
      console.warn('[RoomScene] Could not check room ownership:', e.message);
    }
  }

  // Grants drag interactivity to an object's container, but only for the
  // room's owner — moving someone else's placed object isn't allowed (the
  // server's /api/objects/:id/move check would reject it anyway; this just
  // avoids offering a drag that's guaranteed to fail). Every decorative
  // object is movable — there's no per-object opt-out. Idempotent.
  _updateObjectInteractivity(entry) {
    // Interactive objects have no single container the engine can drag —
    // see the _objectContainers comment in init(). Not draggable in M3.
    if (entry.subKind === 'interactive') return;
    if (!this._isRoomOwner || entry.draggableSetup) return;
    entry.container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-40, -40, 80, 80),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      cursor: 'grab',
    });
    this.input.setDraggable(entry.container);
    entry.draggableSetup = true;
  }

  // Persists a drag-move to the server. Never admin-reviewed (see the
  // matching server comment) — fire-and-forget from the client's point of
  // view, except on failure, where we re-fetch to snap back to server truth
  // rather than leaving the client showing a position that didn't save.
  async _persistObjectMove(id, x, y) {
    if (!id) return;
    try {
      const idToken = await getFreshIdToken();
      const res = await fetch(`/api/objects/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, x: Math.round(x), y: Math.round(y) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn('[RoomScene] Move failed:', data.error ?? res.status);
        this._fetchAndDrawObjects();
      }
    } catch (e) {
      console.warn('[RoomScene] Move request failed:', e.message);
      this._fetchAndDrawObjects();
    }
  }

  // Deletes an object. Never admin-reviewed (see the matching server
  // comment) — a confirm() dialog is the only safeguard against a stray
  // keypress, since there's no undo.
  async _deleteObject(entry) {
    if (!window.confirm('Delete this object? This cannot be undone.')) return;
    try {
      const idToken = await getFreshIdToken();
      const res = await fetch(`/api/objects/${entry.data.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn('[RoomScene] Delete failed:', data.error ?? res.status);
      }
      this._fetchAndDrawObjects();
    } catch (e) {
      console.warn('[RoomScene] Delete request failed:', e.message);
    }
  }

  // Fetches every object placed in this room and (re)builds their game
  // objects. Safe to call repeatedly — diffs against what's already drawn
  // rather than tearing everything down each time, so animation phase isn't
  // reset on every 'objectsUpdated' broadcast.
  async _fetchAndDrawObjects() {
    if (!this._roomKey) return;
    try {
      const res = await fetch('/api/objects?slotKey=' + encodeURIComponent(this._roomKey));
      const { objects } = await res.json();

      for (const [id, entry] of this._objectContainers) {
        if (!objects.find(o => o.id === id)) {
          // Interactive objects get one last chance to clean up any
          // scene.add.* visuals they created beyond what's tracked on ctx —
          // there's no onExit-equivalent lifecycle otherwise (see the
          // object contract's optional onRemove hook).
          if (entry.subKind === 'interactive') {
            try { entry.mod.onRemove?.(this, entry.ctx); } catch (err) {
              console.error(`[RoomScene] Object ${id} onRemove threw:`, err);
            }
          } else {
            entry.container.destroy();
          }
          entry.hint?.destroy();
          entry.ownerHint?.destroy();
          this._objectContainers.delete(id);
        }
      }

      for (const obj of objects) {
        let entry = this._objectContainers.get(obj.id);

        if (obj.subKind === 'interactive') {
          if (entry) continue; // already loaded — interactive objects are create-only, nothing to diff/redraw
          try {
            const mod = await import(/* @vite-ignore */ '/objects/' + obj.fileName + '?v=' + (obj.updatedAt || obj.createdAt));
            const ctx = { x: obj.x, y: obj.y, id: obj.id };
            mod.onLoad?.(this);
            mod.onCreate(this, ctx);
            const hint = this.add.text(obj.x, obj.y - 40, '[E]  Interact', {
              fontSize: '13px', fill: '#88ccff', stroke: '#000000', strokeThickness: 4,
              backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
            }).setOrigin(0.5).setDepth(2000).setVisible(false);
            const ownerHint = this.add.text(obj.x, obj.y - 58, '[X] Delete', {
              fontSize: '12px', fill: '#ffcc66', stroke: '#000000', strokeThickness: 4,
              backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
            }).setOrigin(0.5).setDepth(2000).setVisible(false);
            this._objectContainers.set(obj.id, { data: obj, subKind: 'interactive', mod, ctx, hint, ownerHint });
          } catch (err) {
            console.error(`[RoomScene] Failed to load interactive object ${obj.id} (${obj.fileName}):`, err);
          }
          continue;
        }

        if (!entry) {
          const container = createObject(this, obj.shapeConfig, obj.x, obj.y).setDepth(obj.y);
          container.objectId = obj.id; // read by the scene-level drag handlers in create()
          let hint = null;
          if (obj.linkedArtifacts?.length) {
            hint = this.add.text(obj.x, obj.y - 40, `[E]  ${obj.linkedArtifacts[0].label}`, {
              fontSize: '13px', fill: '#88ccff', stroke: '#000000', strokeThickness: 4,
              backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
            }).setOrigin(0.5).setDepth(2000).setVisible(false);
          }
          // Owner-only edit/delete hint — created for every object (cheap,
          // just a hidden text label) rather than gated on _isRoomOwner at
          // creation time, since ownership resolves async and may not be
          // known yet (see _checkOwnership). Visibility is decided per-frame
          // in update() once ownership is settled.
          const ownerHint = this.add.text(obj.x, obj.y - 58, '[C] Edit   [X] Delete', {
            fontSize: '12px', fill: '#ffcc66', stroke: '#000000', strokeThickness: 4,
            backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
          }).setOrigin(0.5).setDepth(2000).setVisible(false);
          entry = { data: obj, subKind: 'decorative', container, hint, ownerHint, draggableSetup: false };
          this._objectContainers.set(obj.id, entry);
          this._updateObjectInteractivity(entry);
        } else if (this._draggingObjectId !== obj.id) {
          // Skip re-positioning the object currently being dragged — the
          // drag handler already owns its position this frame, and this
          // fetch may be a stale 'objectsUpdated' broadcast racing the drag.
          const configChanged = JSON.stringify(entry.data.shapeConfig) !== JSON.stringify(obj.shapeConfig);
          entry.data = obj;
          entry.container.setPosition(obj.x, obj.y).setDepth(obj.y);
          entry.ownerHint?.setPosition(obj.x, obj.y - 58);

          // An edit ([C]) can change the shape list itself — redraw the
          // Graphics child in place rather than assuming shapes are static
          // once created (true before edit existed, no longer true now).
          if (configChanged) setObjectConfig(entry.container, obj.shapeConfig);

          // A link may also have been added, removed, or relabeled by an
          // edit — sync the hint element instead of assuming it was fixed
          // at creation time.
          if (obj.linkedArtifacts?.length) {
            const label = `[E]  ${obj.linkedArtifacts[0].label}`;
            if (!entry.hint) {
              entry.hint = this.add.text(obj.x, obj.y - 40, label, {
                fontSize: '13px', fill: '#88ccff', stroke: '#000000', strokeThickness: 4,
                backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
              }).setOrigin(0.5).setDepth(2000).setVisible(false);
            } else {
              entry.hint.setText(label).setPosition(obj.x, obj.y - 40);
            }
          } else if (entry.hint) {
            entry.hint.destroy();
            entry.hint = null;
          }
        }
      }
    } catch (e) {
      console.warn('[RoomScene] Could not fetch objects:', e.message);
    }
  }

  // ── update ────────────────────────────────────────────────────────────────────
  update(time, delta) {
    // Other room players keep animating smoothly regardless of local overlay
    // state — see the matching comment in WorldScene.update().
    this._roomPlayers.forEach(p => {
      if (p.animated) updateCharacter(p.body, { moving: p.moving, facingX: p.facingX, delta });
    });

    // ── Player movement ───────────────────────────────────────────────────────
    const body = this.player.body;
    body.setVelocity(0);

    if      (this._cursors.left.isDown  || this._wasd.left.isDown)  body.setVelocityX(-SPEED);
    else if (this._cursors.right.isDown || this._wasd.right.isDown) body.setVelocityX(SPEED);

    if      (this._cursors.up.isDown    || this._wasd.up.isDown)    body.setVelocityY(-SPEED);
    else if (this._cursors.down.isDown  || this._wasd.down.isDown)  body.setVelocityY(SPEED);

    body.velocity.normalize().scale(SPEED);
    updateCharacter(this.player, { moving: body.velocity.lengthSq() > 0, facingX: body.velocity.x, delta });

    // Floating name tag follows the player
    this._nameTag.setPosition(this.player.x, this.player.y - 24);

    // ── In-room Help toggle (anyone) — checked before the freeze-return below
    // so [H] can close the overlay it just opened, not just open it. Safe
    // to toggle-close this way only because Help has no text inputs — see
    // the Process Log note below for why that toggle pattern doesn't work
    // once a textarea is involved.
    if (Phaser.Input.Keyboard.JustDown(this._keyH)) {
      if (this._helpOverlayOpen) this._closeHelpOverlay();
      else if (!this._gameOverlayOpen && !this._objectOverlayOpen && !this._musicOverlayOpen && !this._processLogOverlayOpen) this._openHelpOverlay();
    }

    // ── Freeze movement while an overlay is open or an object is being dragged ─
    if (this._gameOverlayOpen || this._objectOverlayOpen || this._musicOverlayOpen || this._helpOverlayOpen || this._processLogOverlayOpen || this._draggingObjectId) {
      body.setVelocity(0);
      updateCharacter(this.player, { moving: false, delta });
      this._nameTag.setPosition(this.player.x, this.player.y - 24);
      return;
    }

    // ── Objects: animate/tick + proximity interact + owner edit/delete ────────
    // Decorative: [E] near a linkedArtifacts object opens it in a new tab —
    // never in-game, since it's an unvetted external site, not a submitted/
    // approved creation. Interactive (M3): [E] calls the object's own
    // onInteract hook instead — its code is already admin-reviewed, so it's
    // trusted to decide what happens.
    let interactedThisFrame  = false;
    let ownerActionThisFrame = false;
    for (const entry of this._objectContainers.values()) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.data.x, entry.data.y);
      const near = dist < 70;

      if (entry.subKind === 'interactive') {
        try { entry.mod.onUpdate(this, entry.ctx); } catch (err) {
          console.error(`[RoomScene] Object ${entry.data.id} onUpdate threw:`, err);
        }

        entry.hint?.setVisible(near);
        if (near && !interactedThisFrame && Phaser.Input.Keyboard.JustDown(this._keyE)) {
          try { entry.mod.onInteract(this, entry.ctx); } catch (err) {
            console.error(`[RoomScene] Object ${entry.data.id} onInteract threw:`, err);
          }
          interactedThisFrame = true;
        }

        if (this._isRoomOwner) {
          entry.ownerHint?.setVisible(near);
          if (near && !ownerActionThisFrame && Phaser.Input.Keyboard.JustDown(this._keyX)) {
            this._deleteObject(entry);
            ownerActionThisFrame = true;
          }
        }
        continue;
      }

      updateObject(entry.container, delta);

      if (entry.hint) {
        entry.hint.setVisible(near);
        if (near && !interactedThisFrame && Phaser.Input.Keyboard.JustDown(this._keyE)) {
          window.open(entry.data.linkedArtifacts[0].url, '_blank', 'noopener,noreferrer');
          interactedThisFrame = true;
        }
      }

      if (this._isRoomOwner) {
        entry.ownerHint?.setVisible(near);
        if (near && !ownerActionThisFrame) {
          if (Phaser.Input.Keyboard.JustDown(this._keyC)) {
            this._openObjectOverlay(entry);
            ownerActionThisFrame = true;
          } else if (Phaser.Input.Keyboard.JustDown(this._keyX)) {
            this._deleteObject(entry);
            ownerActionThisFrame = true;
          }
        }
      }
    }

    // ── Add Object (room owner only) ───────────────────────────────────────────
    if (this._isRoomOwner && Phaser.Input.Keyboard.JustDown(this._keyO)) {
      this._openObjectOverlay();
    }

    // ── Submit Music (room owner only) ─────────────────────────────────────────
    if (this._isRoomOwner && Phaser.Input.Keyboard.JustDown(this._keyM)) {
      this._openMusicOverlay();
    }

    // ── Process Log (anyone can view, only the owner can edit) ────────────────
    // Deliberately open-only, checked here (after the freeze-return above)
    // rather than as a toggle like [H] — this overlay has editable textareas,
    // and Phaser's Key objects keep tracking keydowns globally even while the
    // browser is sending them to a focused DOM textarea (disableGlobalCapture
    // only suppresses preventDefault, not Phaser's own key-state tracking).
    // A toggle-on-P-again would mean typing any word containing "p" — "past",
    // "present", "process" — closes the overlay mid-sentence. Placing the
    // check here means it can never even run while this overlay is already
    // open (the freeze-return above exits first), so closing is only ever
    // via the Close button or Esc — same convention already used by the
    // Music/Object/Game overlays above for the same reason.
    if (Phaser.Input.Keyboard.JustDown(this._keyP)) {
      this._openProcessLogOverlay();
    }

    // ── Game anchor proximity ─────────────────────────────────────────────────
    if (this._gameAnchorX !== undefined) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, this._gameAnchorX, this._gameAnchorY,
      );
      const near = dist < 80;
      if (this._gameHint)       this._gameHint.setVisible(near);
      if (this._gameSubmitHint) this._gameSubmitHint.setVisible(near);
      if (near && this._gameModule?.game && Phaser.Input.Keyboard.JustDown(this._keyE)) {
        this.scene.launch('GameScene', { game: this._gameModule.game });
        this.scene.pause();
      }
      if (near && Phaser.Input.Keyboard.JustDown(this._keyG)) {
        this._openGameOverlay();
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

  // ── Game Submit Overlay ────────────────────────────────────────────────────
  _createGameOverlay() {
    const el = document.createElement('div');
    el.id = 'woc-game-overlay';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:rgba(0,0,0,0.72)',
    ].join(';');
    el.innerHTML = `
      <div style="background:#0d1b2e;border:1px solid #1a4a7f;border-radius:12px;padding:2rem;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto;font-family:system-ui,sans-serif">
        <h2 style="color:#88ccff;margin:0 0 0.5rem;font-size:1.1rem">Submit Game Code</h2>
        <p style="color:#888;font-size:0.82rem;margin-bottom:1.25rem">Paste your Gemini-generated mini-game code below. The admin will review and activate the [E] Play button in your world.</p>
        <label style="display:block;margin-bottom:0.75rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Your Name</span>
          <input id="woc-game-name" type="text" maxlength="20" placeholder="e.g. Alex Chen"
            style="width:100%;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.9rem;box-sizing:border-box;outline:none">
        </label>
        <label style="display:block;margin-bottom:1rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Game Code (paste from Gemini)</span>
          <textarea id="woc-game-code" placeholder="// Paste your game code here..."
            style="width:100%;height:200px;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.78rem;font-family:'Courier New',monospace;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        </label>
        ${buildSharingFieldsHTML('game')}
        <div id="woc-game-status" style="margin-bottom:0.75rem;font-size:0.82rem;min-height:1.2rem;white-space:pre-wrap"></div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <button id="woc-game-cancel" style="padding:0.5rem 1.25rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Cancel</button>
          <button id="woc-game-submit" style="padding:0.5rem 1.25rem;background:#88ccff;color:#0d1b2e;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Submit Game</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._gameOverlayEl = el;
    document.getElementById('woc-game-cancel').onclick = () => this._closeGameOverlay();
    document.getElementById('woc-game-submit').onclick = () => this._submitGameCode();
    wireShareCheckbox('game', () => this._gameCreationMeta?.creationKey ?? null);
  }

  async _openGameOverlay() {
    this.input.keyboard.disableGlobalCapture();
    if (!this._gameOverlayEl) this._createGameOverlay();
    this._gameOverlayEl.style.display = 'flex';
    document.getElementById('woc-game-name').value  = this._playerName ?? '';
    document.getElementById('woc-game-code').value  = '';
    document.getElementById('woc-game-status').textContent = '';
    document.getElementById('woc-game-status').style.color = '#aaa';
    document.getElementById('woc-game-submit').disabled = false;
    document.getElementById('woc-game-name').focus();
    this._gameOverlayOpen = true;
    this._gameCreationMeta = await refreshSharingFields('game', 'game', this._roomKey);
  }

  _closeGameOverlay() {
    if (this._gameOverlayEl) this._gameOverlayEl.style.display = 'none';
    this.input.keyboard.enableGlobalCapture();
    this._gameOverlayOpen = false;
  }

  async _submitGameCode() {
    const name   = document.getElementById('woc-game-name').value.trim();
    const code   = document.getElementById('woc-game-code').value.trim();
    const status = document.getElementById('woc-game-status');
    const btn    = document.getElementById('woc-game-submit');

    if (!name) { status.textContent = 'Please enter your name.'; status.style.color = '#e07a7a'; return; }
    if (!code) { status.textContent = 'Please paste your game code.'; status.style.color = '#e07a7a'; return; }
    const meta = readSharingFields('game');
    if (!meta) { status.textContent = 'Choose which existing version to replace before submitting.'; status.style.color = '#e07a7a'; return; }

    btn.disabled = true;
    status.textContent = 'Submitting...';
    status.style.color = '#aaa';

    try {
      const res  = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind:        'game',
          slotKey:     this._roomKey,
          displayName: name,
          uid:         this._playerUid ?? null,
          sessionId:   this._colyseusRoom?.sessionId ?? null,
          code,
          meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.errors ? data.errors.join('\n') : (data.error ?? 'Submission failed');
        status.textContent = msg;
        status.style.color = '#e07a7a';
        btn.disabled = false;
      } else {
        status.textContent = '✓ ' + (data.message ?? 'Game submitted! The admin will review it soon.');
        status.style.color = '#52b788';
        setTimeout(() => this._closeGameOverlay(), 4000);
      }
    } catch (e) {
      status.textContent = `Network error: ${e.message}`;
      status.style.color = '#e07a7a';
      btn.disabled = false;
    }
  }

  // ── Add/Edit Object Overlay (Phase 11) ──────────────────────────────────────
  // Decorative objects are pure data — submitted straight to
  // /api/objects/decorative (add) or /api/objects/:id/edit (edit) and live
  // instantly, no admin queue. Interactive objects (M3) are real code —
  // submitted via /api/submit like a room/game and go through admin review.
  // One overlay serves both, switched by a mode toggle: add mode is entered
  // via [O] and places the object where the player is standing; edit mode
  // (decorative only — interactive objects are create-only this milestone)
  // is entered via [C] near an owned object and pre-fills its current config.
  // Every decorative object is movable — there's no per-object opt-out, so
  // there's no "Movable" field to show here.
  _createObjectOverlay() {
    const el = document.createElement('div');
    el.id = 'woc-object-overlay';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:rgba(0,0,0,0.72)',
    ].join(';');
    el.innerHTML = `
      <div style="background:#0d1b2e;border:1px solid #1a4a7f;border-radius:12px;padding:2rem;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto;font-family:system-ui,sans-serif">
        <h2 id="woc-object-title" style="color:#88ccff;margin:0 0 0.5rem;font-size:1.1rem">Add Object</h2>
        <div id="woc-object-mode-row" style="display:flex;gap:0.5rem;margin-bottom:1rem">
          <button id="woc-object-mode-decorative" style="flex:1;padding:0.4rem;background:#88ccff;color:#0d1b2e;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.8rem">Decorative</button>
          <button id="woc-object-mode-interactive" style="flex:1;padding:0.4rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.8rem">Interactive</button>
        </div>
        <p id="woc-object-desc" style="color:#888;font-size:0.82rem;margin-bottom:1.25rem">Paste a shape-config JSON (ask Gemini to generate one from the object contract). It's placed where you're standing and appears instantly — no admin review needed for decorative objects.</p>
        <label id="woc-object-config-label" style="display:block;margin-bottom:0.75rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Shape Config (JSON)</span>
          <textarea id="woc-object-config" placeholder='{"shapes":[{"type":"circle","x":0,"y":0,"r":20,"color":"#f4a261"}],"scale":1,"animation":"pulse"}'
            style="width:100%;height:160px;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.78rem;font-family:'Courier New',monospace;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        </label>
        <label id="woc-object-code-label" style="display:none;margin-bottom:0.75rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Object Code (paste from Gemini, generated against src/objects/_template.js)</span>
          <textarea id="woc-object-code" placeholder="// Paste your interactive object code here..."
            style="width:100%;height:200px;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.78rem;font-family:'Courier New',monospace;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        </label>
        <div id="woc-object-sharing-wrap" style="display:none">${buildSharingFieldsHTML('object', { includeShare: false })}</div>
        <div id="woc-object-links">
          <label style="display:block;margin-bottom:0.5rem">
            <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Linked artifact label (optional)</span>
            <input id="woc-object-link-label" type="text" maxlength="40" placeholder="e.g. My Portfolio Site"
              style="width:100%;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.9rem;box-sizing:border-box;outline:none">
          </label>
          <label style="display:block;margin-bottom:1rem">
            <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Linked artifact URL (optional — opens in a new tab, not embedded)</span>
            <input id="woc-object-link-url" type="text" maxlength="500" placeholder="https://..."
              style="width:100%;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.9rem;box-sizing:border-box;outline:none">
          </label>
        </div>
        <div id="woc-object-status" style="margin-bottom:0.75rem;font-size:0.82rem;min-height:1.2rem;white-space:pre-wrap"></div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <button id="woc-object-cancel" style="padding:0.5rem 1.25rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Cancel</button>
          <button id="woc-object-submit" style="padding:0.5rem 1.25rem;background:#88ccff;color:#0d1b2e;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Add Object</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._objectOverlayEl = el;
    document.getElementById('woc-object-cancel').onclick = () => this._closeObjectOverlay();
    document.getElementById('woc-object-submit').onclick = () => this._submitObjectConfig();
    document.getElementById('woc-object-mode-decorative').onclick  = () => this._setObjectMode('decorative');
    document.getElementById('woc-object-mode-interactive').onclick = () => this._setObjectMode('interactive');
  }

  // Switches the overlay between Decorative (shape-config JSON, instant, no
  // review) and Interactive (real code, goes through /api/submit + admin
  // review) — only reachable in add mode, since edit only supports
  // decorative objects this milestone (see _openObjectOverlay).
  _setObjectMode(mode) {
    this._objectMode = mode;
    const decorative = mode === 'decorative';
    document.getElementById('woc-object-config-label').style.display = decorative ? 'block' : 'none';
    document.getElementById('woc-object-code-label').style.display   = decorative ? 'none' : 'block';
    document.getElementById('woc-object-sharing-wrap').style.display = decorative ? 'none' : 'block';
    document.getElementById('woc-object-links').style.display        = decorative ? 'block' : 'none';
    document.getElementById('woc-object-mode-decorative').style.background  = decorative ? '#88ccff' : '#1a4a7f';
    document.getElementById('woc-object-mode-decorative').style.color       = decorative ? '#0d1b2e' : '#e0e0e0';
    document.getElementById('woc-object-mode-interactive').style.background = decorative ? '#1a4a7f' : '#88ccff';
    document.getElementById('woc-object-mode-interactive').style.color      = decorative ? '#e0e0e0' : '#0d1b2e';
    document.getElementById('woc-object-desc').textContent = decorative
      ? 'Paste a shape-config JSON (ask Gemini to generate one from the object contract). It\'s placed where you\'re standing and appears instantly — no admin review needed for decorative objects.'
      : 'Paste interactive object code (ask Gemini to generate one from src/objects/_template.js). Submitted for admin review, same as a room or game — the admin reviews just this object, never your whole room.';
    document.getElementById('woc-object-submit').textContent = decorative ? 'Add Object' : 'Submit Object';
  }

  // Pass an existing entry (from the [C] proximity handler) to open in edit
  // mode; call with no argument (as [O] does) to add a new object at the
  // player's current position.
  async _openObjectOverlay(editEntry = null) {
    this.input.keyboard.disableGlobalCapture();
    if (!this._objectOverlayEl) this._createObjectOverlay();
    this._objectOverlayEl.style.display = 'flex';

    this._objectEditingId = editEntry?.data.id ?? null;
    // Editing only ever applies to decorative objects — force the mode
    // toggle into Decorative and hide it entirely while editing, since
    // switching modes mid-edit makes no sense.
    document.getElementById('woc-object-mode-row').style.display = editEntry ? 'none' : 'flex';
    this._setObjectMode('decorative');

    document.getElementById('woc-object-title').textContent = editEntry ? 'Edit Object' : 'Add Object';
    if (editEntry) {
      document.getElementById('woc-object-desc').textContent =
        'Edit this object\'s shape-config JSON or linked artifact. Saves instantly — no admin review needed for decorative objects.';
    }
    document.getElementById('woc-object-submit').textContent = editEntry ? 'Save Changes' : 'Add Object';

    document.getElementById('woc-object-config').value =
      editEntry ? JSON.stringify(editEntry.data.shapeConfig, null, 2) : '';
    document.getElementById('woc-object-code').value = '';
    document.getElementById('woc-object-link-label').value = editEntry?.data.linkedArtifacts?.[0]?.label ?? '';
    document.getElementById('woc-object-link-url').value   = editEntry?.data.linkedArtifacts?.[0]?.url   ?? '';
    document.getElementById('woc-object-status').textContent = '';
    document.getElementById('woc-object-status').style.color = '#aaa';
    document.getElementById('woc-object-submit').disabled = false;
    document.getElementById('woc-object-config').focus();
    // Snapshot where the player is standing right now — used only in add
    // mode, as the new object's placement.
    this._pendingObjectX = Math.round(this.player.x);
    this._pendingObjectY = Math.round(this.player.y);
    this._objectOverlayOpen = true;
    // Interactive objects are always create-only (no existing creationKey to
    // fetch versions/sharing for) — this only ever populates the "based on"
    // remix dropdown, not a version-cap picker.
    if (!editEntry) await refreshSharingFields('object', 'object', this._roomKey);
  }

  _closeObjectOverlay() {
    if (this._objectOverlayEl) this._objectOverlayEl.style.display = 'none';
    this.input.keyboard.enableGlobalCapture();
    this._objectOverlayOpen = false;
    this._objectEditingId   = null;
  }

  async _submitObjectConfig() {
    const status = document.getElementById('woc-object-status');
    const btn    = document.getElementById('woc-object-submit');
    const editingId = this._objectEditingId;

    if (!editingId && this._objectMode === 'interactive') {
      await this._submitInteractiveObject();
      return;
    }

    const raw = document.getElementById('woc-object-config').value.trim();
    if (!raw) { status.textContent = 'Please paste a shape config.'; status.style.color = '#e07a7a'; return; }
    let shapeConfig;
    try {
      shapeConfig = JSON.parse(raw);
    } catch (e) {
      status.textContent = `Invalid JSON: ${e.message}`;
      status.style.color = '#e07a7a';
      return;
    }

    const linkLabel = document.getElementById('woc-object-link-label').value.trim();
    const linkUrl   = document.getElementById('woc-object-link-url').value.trim();
    const linkedArtifacts = linkUrl ? [{ label: linkLabel || 'Link', url: linkUrl }] : [];

    btn.disabled = true;
    status.textContent = editingId ? 'Saving...' : 'Adding...';
    status.style.color = '#aaa';

    try {
      const idToken = await getFreshIdToken();
      const url  = editingId ? `/api/objects/${editingId}/edit` : '/api/objects/decorative';
      const body = editingId
        ? { idToken, shapeConfig, linkedArtifacts }
        : { idToken, slotKey: this._roomKey, x: this._pendingObjectX, y: this._pendingObjectY, shapeConfig, linkedArtifacts };
      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        status.textContent = data.error ?? (editingId ? 'Failed to save object' : 'Failed to add object');
        status.style.color = '#e07a7a';
        btn.disabled = false;
      } else {
        status.textContent = editingId ? '✓ Saved!' : '✓ Object added!';
        status.style.color = '#52b788';
        this._fetchAndDrawObjects();
        setTimeout(() => this._closeObjectOverlay(), 1200);
      }
    } catch (e) {
      status.textContent = `Network error: ${e.message}`;
      status.style.color = '#e07a7a';
      btn.disabled = false;
    }
  }

  // Interactive objects are real code — go through the same /api/submit +
  // admin-review pipeline rooms/games already use, reviewed as their own
  // isolated unit (approving it never touches the room itself).
  async _submitInteractiveObject() {
    const code   = document.getElementById('woc-object-code').value.trim();
    const status = document.getElementById('woc-object-status');
    const btn    = document.getElementById('woc-object-submit');

    if (!code) { status.textContent = 'Please paste your object code.'; status.style.color = '#e07a7a'; return; }
    const sharingMeta = readSharingFields('object');
    if (!sharingMeta) { status.textContent = 'Choose which existing version to replace before submitting.'; status.style.color = '#e07a7a'; return; }

    btn.disabled = true;
    status.textContent = 'Submitting...';
    status.style.color = '#aaa';

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind:        'object',
          slotKey:     this._roomKey,
          displayName: this._playerName,
          uid:         this._playerUid ?? null,
          sessionId:   this._colyseusRoom?.sessionId ?? null,
          code,
          meta: { x: this._pendingObjectX, y: this._pendingObjectY, ...sharingMeta },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.errors ? data.errors.join('\n') : (data.error ?? 'Submission failed');
        status.textContent = msg;
        status.style.color = '#e07a7a';
        btn.disabled = false;
      } else {
        status.textContent = '✓ ' + (data.message ?? 'Object submitted! The admin will review it soon.');
        status.style.color = '#52b788';
        setTimeout(() => this._closeObjectOverlay(), 4000);
      }
    } catch (e) {
      status.textContent = `Network error: ${e.message}`;
      status.style.color = '#e07a7a';
      btn.disabled = false;
    }
  }

  // ── Submit Music Overlay (Phase 11 milestone 4) ─────────────────────────────
  // Ambient, owner-only, no anchor — copied near-verbatim from the game
  // overlay trio above (_createGameOverlay/_openGameOverlay/_submitGameCode),
  // since the flow is identical: paste code, POST to /api/submit, admin reviews.
  _createMusicOverlay() {
    const el = document.createElement('div');
    el.id = 'woc-music-overlay';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:rgba(0,0,0,0.72)',
    ].join(';');
    el.innerHTML = `
      <div style="background:#0d1b2e;border:1px solid #1a4a7f;border-radius:12px;padding:2rem;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto;font-family:system-ui,sans-serif">
        <h2 style="color:#88ccff;margin:0 0 0.5rem;font-size:1.1rem">Submit Room Music</h2>
        <p style="color:#888;font-size:0.82rem;margin-bottom:1.25rem">Paste your Gemini-generated music code below (ask Gemini to generate one from src/rooms/_music_template.js — see [H] Help for a ready-made prompt). The admin will review it, and it'll play automatically whenever a player enters your room.</p>
        <label style="display:block;margin-bottom:0.75rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Your Name</span>
          <input id="woc-music-name" type="text" maxlength="20" placeholder="e.g. Alex Chen"
            style="width:100%;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.9rem;box-sizing:border-box;outline:none">
        </label>
        <label style="display:block;margin-bottom:1rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Music Code (paste from Gemini)</span>
          <textarea id="woc-music-code" placeholder="// Paste your room music code here..."
            style="width:100%;height:200px;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.78rem;font-family:'Courier New',monospace;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        </label>
        ${buildSharingFieldsHTML('music')}
        <div id="woc-music-status" style="margin-bottom:0.75rem;font-size:0.82rem;min-height:1.2rem;white-space:pre-wrap"></div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <button id="woc-music-cancel" style="padding:0.5rem 1.25rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Cancel</button>
          <button id="woc-music-submit" style="padding:0.5rem 1.25rem;background:#88ccff;color:#0d1b2e;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Submit Music</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._musicOverlayEl = el;
    document.getElementById('woc-music-cancel').onclick = () => this._closeMusicOverlay();
    document.getElementById('woc-music-submit').onclick = () => this._submitMusicCode();
    wireShareCheckbox('music', () => this._musicCreationMeta?.creationKey ?? null);
  }

  async _openMusicOverlay() {
    this.input.keyboard.disableGlobalCapture();
    if (!this._musicOverlayEl) this._createMusicOverlay();
    this._musicOverlayEl.style.display = 'flex';
    document.getElementById('woc-music-name').value  = this._playerName ?? '';
    document.getElementById('woc-music-code').value  = '';
    document.getElementById('woc-music-status').textContent = '';
    document.getElementById('woc-music-status').style.color = '#aaa';
    document.getElementById('woc-music-submit').disabled = false;
    document.getElementById('woc-music-name').focus();
    this._musicOverlayOpen = true;
    this._musicCreationMeta = await refreshSharingFields('music', 'music', this._roomKey);
  }

  _closeMusicOverlay() {
    if (this._musicOverlayEl) this._musicOverlayEl.style.display = 'none';
    this.input.keyboard.enableGlobalCapture();
    this._musicOverlayOpen = false;
  }

  async _submitMusicCode() {
    const name   = document.getElementById('woc-music-name').value.trim();
    const code   = document.getElementById('woc-music-code').value.trim();
    const status = document.getElementById('woc-music-status');
    const btn    = document.getElementById('woc-music-submit');

    if (!name) { status.textContent = 'Please enter your name.'; status.style.color = '#e07a7a'; return; }
    if (!code) { status.textContent = 'Please paste your music code.'; status.style.color = '#e07a7a'; return; }
    const meta = readSharingFields('music');
    if (!meta) { status.textContent = 'Choose which existing version to replace before submitting.'; status.style.color = '#e07a7a'; return; }

    btn.disabled = true;
    status.textContent = 'Submitting...';
    status.style.color = '#aaa';

    try {
      const res  = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind:        'music',
          slotKey:     this._roomKey,
          displayName: name,
          uid:         this._playerUid ?? null,
          sessionId:   this._colyseusRoom?.sessionId ?? null,
          code,
          meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.errors ? data.errors.join('\n') : (data.error ?? 'Submission failed');
        status.textContent = msg;
        status.style.color = '#e07a7a';
        btn.disabled = false;
      } else {
        status.textContent = '✓ ' + (data.message ?? 'Music submitted! The admin will review it soon.');
        status.style.color = '#52b788';
        setTimeout(() => this._closeMusicOverlay(), 4000);
      }
    } catch (e) {
      status.textContent = `Network error: ${e.message}`;
      status.style.color = '#e07a7a';
      btn.disabled = false;
    }
  }

  // ── In-Room Help Overlay (player guide) ─────────────────────────────────────
  // Reachable via [H] from inside any room (owner or visitor) — never the
  // town-square signpost, since this is specifically about what you can add
  // to a room you're already standing in. A paged HTML overlay, following
  // the same DOM-div convention as the game/object/music overlays above
  // (RoomScene has no Phaser-native paged-panel precedent the way
  // WorldScene's notice board does — this keeps one overlay technique per
  // scene rather than importing a second one just for this).
  _buildHelpPages() {
    const L = OBJECT_LIMITS;
    return [
      {
        title: 'What you can add to your room',
        body:
          'Beyond the room itself, you can add four kinds of things:\n\n' +
          '🎮  MINI-GAME — [G] near your game anchor spot\n' +
          '    Real code, admin-reviewed. One per room.\n\n' +
          '✨  DECORATIVE OBJECT — [O]\n' +
          '    Just a shape list (JSON) — appears instantly, no review.\n' +
          '    Move it anytime by dragging, edit it with [C], remove with [X].\n\n' +
          '⚙️  INTERACTIVE OBJECT — [O] → toggle to "Interactive"\n' +
          '    Real code with its own behavior — admin-reviewed, but submitted\n' +
          '    on its own, never touching your room\'s existing code.\n' +
          '    Press [E] near one to interact, [X] to remove it.\n\n' +
          '🎵  ROOM MUSIC — [M]\n' +
          '    Ambient background music, synthesized with the Web Audio API.\n' +
          '    Admin-reviewed. Plays automatically when a player enters.\n\n' +
          '📝  PROCESS LOG — [P]\n' +
          '    Reflect on this room\'s creative journey — past / present /\n' +
          '    future. Anyone can read it; only you (the owner) can edit it.\n\n' +
          'The next 6 pages have ready-to-copy Gemini prompts for objects and\n' +
          'music — a DESIGN prompt to iterate on with Gemini (ask for changes,\n' +
          'previews, whatever you like), then an EXPORT prompt to run once\n' +
          'you\'re happy, which forces Gemini to hand back clean code you can\n' +
          'actually paste in — not a preview, not markdown, not HTML.\n' +
          'Use [→] to continue.',
      },
      {
        title: 'Prompt 1 — Decorative Object (Design)',
        body:
          'A decorative object is pure DATA (a JSON shape list) — approved\n' +
          'instantly, no admin review. Use this prompt to design and iterate —\n' +
          'ask Gemini to show you a preview, tweak colors, add shapes, whatever\n' +
          'you like. When you\'re happy, move to the next page (Export).',
        copyText:
          'I want to design a decorative object for my room in a 2D game (World of Codes).\n' +
          'Decorative objects are described as a JSON shape list — rectangles, circles,\n' +
          'triangles, and polygons, with optional gradients and a simple animation preset.\n\n' +
          'My object should look like: [DESCRIBE YOUR OBJECT HERE]\n\n' +
          'Feel free to show me a visual preview (e.g. an HTML canvas) so I can see it and\n' +
          'ask for changes before we finalize — we\'ll convert it to the real format after.',
      },
      {
        title: 'Prompt 2 — Decorative Object (Export)',
        body:
          'Once you\'re happy with the design above, paste this prompt into the\n' +
          'SAME conversation to force Gemini to hand back clean, paste-ready\n' +
          'JSON — not the HTML/canvas preview it may have been showing you.\n' +
          'Paste the result into the [O] overlay\'s Decorative mode.',
        copyText:
          'Now take the object design we\'ve been iterating on above and output ONLY the\n' +
          'final shape-config JSON — nothing else. If you showed me an HTML/canvas preview,\n' +
          'do NOT return that — convert its design into this exact JSON schema instead:\n' +
          '{\n' +
          '  "shapes": [\n' +
          '    { "type": "rect", "x": 0, "y": 0, "w": 20, "h": 20, "color": "#RRGGBB", "gradientTo": null },\n' +
          '    { "type": "circle", "x": 0, "y": 0, "r": 10, "color": "#RRGGBB" },\n' +
          '    { "type": "triangle", "x": 0, "y": 0, "x2": 10, "y2": 10, "x3": -10, "y3": 10, "color": "#RRGGBB" },\n' +
          '    { "type": "polygon", "points": [{"x":0,"y":0},{"x":10,"y":10},{"x":-10,"y":10}], "color": "#RRGGBB" }\n' +
          '  ],\n' +
          '  "scale": 1,\n' +
          '  "animation": "none"\n' +
          '}\n\n' +
          'STRICT RULES for the output:\n' +
          '✅ Return ONLY the JSON object — starting with { and ending with }\n' +
          '❌ Do NOT include a <!DOCTYPE>, <html>, <canvas>, <script>, or any preview/demo code\n' +
          '❌ Do NOT wrap the JSON in ```code fences```\n' +
          '❌ Do NOT add any comment, explanation, or text before/after the JSON\n' +
          `- Up to ${L.MAX_SHAPES} shapes total\n` +
          '- type must be exactly one of: rect, circle, triangle, polygon\n' +
          `- x/y (and x2/y2/x3/y3, and each point) must be between -${L.COORD_LIMIT} and ${L.COORD_LIMIT}\n` +
          `- rect w/h must be between 0 and ${L.SIZE_LIMIT}\n` +
          `- circle r must be between 0 and ${L.RADIUS_LIMIT}\n` +
          `- polygon needs 3 to ${L.MAX_POLY_POINTS} points\n` +
          '- color must be a 6-digit hex string like "#f4a261"\n' +
          '- gradientTo (optional) is a second hex color for a 2-color gradient fill\n' +
          `- scale must be between ${L.MIN_SCALE} and ${L.MAX_SCALE}\n` +
          '- animation must be exactly one of: none, pulse, rotate, drift, colorCycle\n' +
          '- Coordinates are relative to the object\'s own center (0,0), not the room\n' +
          '- If any part of the design doesn\'t fit these shape types or limits, simplify it\n' +
          '  down to the closest fit — I need code I can paste directly, not a preview',
      },
      {
        title: 'Prompt 1 — Interactive Object (Design)',
        body:
          'An interactive object is real code — admin-reviewed, submitted on\n' +
          'its own, never touching your room\'s existing code. Use this prompt\n' +
          'to design and iterate. When you\'re happy, move to the next page\n' +
          '(Export).',
        copyText:
          'I want to design an interactive object for my room in a 2D game (World of Codes),\n' +
          'built with Phaser.js. Interactive objects are real code that reacts to the player\n' +
          '(not just simple decoration) — physics, randomness, custom behavior on interact.\n\n' +
          'My object should do: [DESCRIBE WHAT IT DOES HERE]\n\n' +
          'Feel free to show me a visual preview (e.g. an HTML canvas) so I can see it and\n' +
          'ask for changes before we finalize — we\'ll convert it to the real format after.',
      },
      {
        title: 'Prompt 2 — Interactive Object (Export)',
        body:
          'Once you\'re happy with the design above, paste this prompt into\n' +
          'the SAME conversation to force Gemini to hand back clean, paste-\n' +
          'ready code — not an HTML/canvas preview. Paste the result into the\n' +
          '[O] overlay\'s Interactive mode.',
        copyText:
          'Now take the object logic we\'ve been iterating on above and rewrite it using the\n' +
          'exact template below. Fill in only the body of each function with the behavior\n' +
          'you already designed. If you showed me an HTML/canvas preview, do NOT return\n' +
          'that — convert its logic into this exact contract instead:\n\n' +
          '--- START OF TEMPLATE ---\n' +
          'export function onLoad(scene) {\n' +
          '}\n' +
          'export function onCreate(scene, ctx) {\n' +
          '  // ctx.x / ctx.y is where this object was placed\n' +
          '}\n' +
          'export function onUpdate(scene, ctx) {\n' +
          '}\n' +
          'export function onInteract(scene, ctx) {\n' +
          '}\n' +
          '// Optional — only if onCreate made extra scene objects needing cleanup:\n' +
          '// export function onRemove(scene, ctx) {\n' +
          '// }\n' +
          '--- END OF TEMPLATE ---\n\n' +
          'STRICT RULES for the output:\n' +
          '✅ Return ONLY what is between the template markers — nothing else\n' +
          '✅ Keep all function names and signatures exactly as shown\n' +
          '✅ Store any references you need later on ctx (e.g. ctx.sprite = ...) —\n' +
          '   ctx is the SAME object every call, module-level variables are NOT shared per-object\n' +
          '✅ Use ONLY scene.add / scene.physics / scene.tweens / scene.time\n' +
          '❌ Do NOT include a <!DOCTYPE>, <html>, <canvas>, <script>, or any preview/demo code\n' +
          '❌ Do NOT wrap the code in ```code fences```\n' +
          '❌ Do NOT add import, require(), or export default\n' +
          '❌ Do NOT use fetch(), document, localStorage, or any explanation/commentary',
      },
      {
        title: 'Prompt 1 — Room Music (Design)',
        body:
          'Room music is generated with the Web Audio API — pure synthesis,\n' +
          'no audio file. Use this prompt to design and iterate on the sound.\n' +
          'When you\'re happy, move to the next page (Export).',
        copyText:
          'I want to design ambient background music for my room in a 2D game (World of Codes).\n' +
          'Room music is generated live with the Web Audio API — pure synthesis, no audio file.\n\n' +
          'My music should sound like: [DESCRIBE THE MOOD/STYLE HERE]\n\n' +
          'Feel free to describe or demo the sound design however is easiest for you (even an\n' +
          'HTML page with a play button) so I can hear it and ask for changes — we\'ll convert\n' +
          'it to the real format after.',
      },
      {
        title: 'Prompt 2 — Room Music (Export)',
        body:
          'Once you\'re happy with the sound above, paste this prompt into the\n' +
          'SAME conversation to force Gemini to hand back clean, paste-ready\n' +
          'code — not an HTML demo page. Paste the result into the [M] overlay.',
        copyText:
          'Now take the music we\'ve been iterating on above and rewrite it using the exact\n' +
          'template below. If you showed me an HTML demo/player, do NOT return that — convert\n' +
          'its sound design into this exact contract instead, using the Web Audio API:\n\n' +
          '--- START OF TEMPLATE ---\n' +
          'let audioCtx = null; // module-level — play() sets it, stop() reads it\n\n' +
          'export const music = {\n' +
          '  musicName: \'My Room Music\',\n' +
          '  play(scene) {\n' +
          '    // (your AudioContext setup goes here, see rules below)\n' +
          '  },\n' +
          '  stop(scene) {\n' +
          '    audioCtx?.close();\n' +
          '    audioCtx = null;\n' +
          '  },\n' +
          '};\n' +
          '--- END OF TEMPLATE ---\n\n' +
          'STRICT RULES for the output:\n' +
          '✅ Return ONLY what is between the template markers — nothing else\n' +
          '✅ Keep the exact structure (musicName, play(scene), stop(scene))\n' +
          '✅ stop() MUST fully silence everything play() started — this is required\n' +
          '✅ Use ONLY the Web Audio API: new AudioContext(), createOscillator(),\n' +
          '   createGain(), createBiquadFilter(), node.connect(...), oscillator.start()/stop()\n' +
          '✅ Call audioCtx.resume() immediately after creating audioCtx — a freshly-created\n' +
          '   AudioContext can start "suspended" under browser autoplay policy, which produces\n' +
          '   NO SOUND and no error at all. This is required, not optional.\n' +
          '✅ Keep the volume LOW (e.g. gain around 0.05) — it plays automatically on entry\n' +
          '❌ Do NOT reference any audio file/URL\n' +
          '❌ Do NOT include a <!DOCTYPE>, <html>, <audio>, <script>, or any preview/demo page\n' +
          '❌ Do NOT wrap the code in ```code fences```\n' +
          '❌ Do NOT add import, require(), export default, or any explanation/commentary',
      },
    ];
  }

  _createHelpOverlay() {
    this._helpPages = this._buildHelpPages();

    const el = document.createElement('div');
    el.id = 'woc-help-overlay';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:rgba(0,0,0,0.72)',
    ].join(';');
    el.innerHTML = `
      <div style="background:#0d1b2e;border:1px solid #1a4a7f;border-radius:12px;padding:2rem;width:620px;max-width:95vw;font-family:system-ui,sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.5rem">
          <h2 id="woc-help-title" style="color:#88ccff;margin:0;font-size:1.1rem"></h2>
          <span id="woc-help-pagenum" style="color:#888;font-size:0.8rem"></span>
        </div>
        <pre id="woc-help-body" style="color:#e0e0e0;font-size:0.8rem;font-family:'Courier New',monospace;white-space:pre-wrap;line-height:1.5;max-height:340px;overflow-y:auto;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;padding:0.75rem;margin:0 0 1rem"></pre>
        <div style="display:flex;gap:0.75rem;justify-content:space-between;align-items:center">
          <div style="display:flex;gap:0.5rem">
            <button id="woc-help-prev" style="padding:0.5rem 1rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.8rem">← Prev</button>
            <button id="woc-help-next" style="padding:0.5rem 1rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.8rem">Next →</button>
          </div>
          <button id="woc-help-copy" style="padding:0.5rem 1.25rem;background:#88ccff;color:#0d1b2e;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.8rem">Copy Prompt</button>
          <button id="woc-help-close" style="padding:0.5rem 1.25rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Close</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._helpOverlayEl = el;
    document.getElementById('woc-help-close').onclick = () => this._closeHelpOverlay();
    document.getElementById('woc-help-prev').onclick  = () => { if (this._helpPage > 0) { this._helpPage--; this._renderHelpPage(); } };
    document.getElementById('woc-help-next').onclick  = () => { if (this._helpPage < this._helpPages.length - 1) { this._helpPage++; this._renderHelpPage(); } };
    document.getElementById('woc-help-copy').onclick  = () => this._copyHelpPrompt();
  }

  _openHelpOverlay() {
    this.input.keyboard.disableGlobalCapture();
    if (!this._helpOverlayEl) this._createHelpOverlay();
    this._helpOverlayEl.style.display = 'flex';
    this._helpPage = 0;
    this._renderHelpPage();
    this._helpOverlayOpen = true;
  }

  _closeHelpOverlay() {
    if (this._helpOverlayEl) this._helpOverlayEl.style.display = 'none';
    this.input.keyboard.enableGlobalCapture();
    this._helpOverlayOpen = false;
  }

  _renderHelpPage() {
    const page  = this._helpPages[this._helpPage];
    const total = this._helpPages.length;
    document.getElementById('woc-help-title').textContent   = page.title;
    document.getElementById('woc-help-body').textContent    = page.body;
    document.getElementById('woc-help-pagenum').textContent = `${this._helpPage + 1} / ${total}`;
    document.getElementById('woc-help-prev').disabled = this._helpPage === 0;
    document.getElementById('woc-help-next').disabled = this._helpPage === total - 1;
    const copyBtn = document.getElementById('woc-help-copy');
    copyBtn.style.display = page.copyText ? 'inline-block' : 'none';
    copyBtn.textContent = 'Copy Prompt';
  }

  _copyHelpPrompt() {
    const page = this._helpPages[this._helpPage];
    if (!page.copyText) return;
    const btn = document.getElementById('woc-help-copy');
    navigator.clipboard.writeText(page.copyText)
      .then(() => {
        btn.textContent = '✓ Copied!';
        setTimeout(() => { if (this._helpOverlayOpen) btn.textContent = 'Copy Prompt'; }, 1800);
      })
      .catch(() => {
        btn.textContent = 'Copy failed';
        setTimeout(() => { if (this._helpOverlayOpen) btn.textContent = 'Copy Prompt'; }, 2500);
      });
  }

  // ── Creative Process Log (Phase 12) ─────────────────────────────────────────
  // Past/present/future reflection on the room's whole creative package —
  // readable by anyone, editable only by the room's owner. Same DOM-overlay
  // convention as the Help window above; branches on this._isRoomOwner to
  // decide whether the three fields are editable or read-only.
  _createProcessLogOverlay() {
    const el = document.createElement('div');
    el.id = 'woc-processlog-overlay';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:rgba(0,0,0,0.72)',
    ].join(';');
    const field = (id, label, placeholder) => `
      <label style="display:block;margin-bottom:0.85rem">
        <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">${label}</span>
        <textarea id="${id}" placeholder="${placeholder}"
          style="width:100%;height:80px;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.85rem;font-family:system-ui,sans-serif;resize:vertical;box-sizing:border-box;outline:none"></textarea>
      </label>`;
    el.innerHTML = `
      <div style="background:#0d1b2e;border:1px solid #1a4a7f;border-radius:12px;padding:2rem;width:620px;max-width:95vw;font-family:system-ui,sans-serif">
        <h2 style="color:#88ccff;margin:0 0 0.5rem;font-size:1.1rem">Creative Process Log</h2>
        <p id="woc-processlog-subtitle" style="color:#888;font-size:0.82rem;margin-bottom:1.25rem"></p>
        ${field('woc-processlog-past', 'Past — how did this room come together?', 'What did you learn while making this?')}
        ${field('woc-processlog-present', 'Present — what is this room now?', 'What does it look/feel like today?')}
        ${field('woc-processlog-future', "Future — what's next?", 'What do you want to add or change next?')}
        <div id="woc-processlog-status" style="margin-bottom:0.75rem;font-size:0.82rem;min-height:1.2rem;white-space:pre-wrap"></div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <button id="woc-processlog-close" style="padding:0.5rem 1.25rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Close</button>
          <button id="woc-processlog-save" style="padding:0.5rem 1.25rem;background:#88ccff;color:#0d1b2e;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Save</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._processLogOverlayEl = el;
    document.getElementById('woc-processlog-close').onclick = () => this._closeProcessLogOverlay();
    document.getElementById('woc-processlog-save').onclick  = () => this._saveProcessLog();
  }

  async _openProcessLogOverlay() {
    this.input.keyboard.disableGlobalCapture();
    if (!this._processLogOverlayEl) this._createProcessLogOverlay();
    this._processLogOverlayEl.style.display = 'flex';
    this._processLogOverlayOpen = true;

    const pastEl    = document.getElementById('woc-processlog-past');
    const presentEl = document.getElementById('woc-processlog-present');
    const futureEl  = document.getElementById('woc-processlog-future');
    const subtitle  = document.getElementById('woc-processlog-subtitle');
    const saveBtn   = document.getElementById('woc-processlog-save');
    const status    = document.getElementById('woc-processlog-status');

    status.textContent = '';
    subtitle.textContent = this._isRoomOwner
      ? "Reflect on how this room came together, what it is now, and what's next. Anyone visiting can read this."
      : "This room's creator's reflection on how it came together, what it is now, and what's next.";
    [pastEl, presentEl, futureEl].forEach(fieldEl => {
      fieldEl.readOnly = !this._isRoomOwner;
      fieldEl.style.opacity = this._isRoomOwner ? '1' : '0.85';
    });
    saveBtn.style.display = this._isRoomOwner ? 'inline-block' : 'none';
    pastEl.value = presentEl.value = futureEl.value = 'Loading...';

    try {
      const res  = await fetch(`/api/process-log?slotKey=${encodeURIComponent(this._roomKey)}`);
      const data = await res.json();
      pastEl.value    = data.past    || (this._isRoomOwner ? '' : '(Nothing written yet.)');
      presentEl.value = data.present || (this._isRoomOwner ? '' : '(Nothing written yet.)');
      futureEl.value  = data.future  || (this._isRoomOwner ? '' : '(Nothing written yet.)');
    } catch (e) {
      pastEl.value = presentEl.value = futureEl.value = '';
      status.textContent = 'Could not load process log: ' + e.message;
      status.style.color = '#e07a7a';
    }
  }

  _closeProcessLogOverlay() {
    if (this._processLogOverlayEl) this._processLogOverlayEl.style.display = 'none';
    this.input.keyboard.enableGlobalCapture();
    this._processLogOverlayOpen = false;
  }

  async _saveProcessLog() {
    const past    = document.getElementById('woc-processlog-past').value;
    const present = document.getElementById('woc-processlog-present').value;
    const future  = document.getElementById('woc-processlog-future').value;
    const status  = document.getElementById('woc-processlog-status');
    const btn     = document.getElementById('woc-processlog-save');

    btn.disabled = true;
    status.textContent = 'Saving...';
    status.style.color = '#aaa';

    try {
      const idToken = await getFreshIdToken();
      const res = await fetch('/api/process-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, slotKey: this._roomKey, past, present, future }),
      });
      const data = await res.json();
      if (!res.ok) {
        status.textContent = data.error ?? 'Save failed';
        status.style.color = '#e07a7a';
      } else {
        status.textContent = '✓ Saved';
        status.style.color = '#52b788';
      }
    } catch (e) {
      status.textContent = `Network error: ${e.message}`;
      status.style.color = '#e07a7a';
    } finally {
      btn.disabled = false;
    }
  }
}
