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
import { createObject, updateObject, setObjectConfig } from './ObjectRenderer.js';
import { getFreshIdToken } from '../auth/session.js';

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
    this._roomUpdate    = null;
    this._loaded        = false;
    this._exited        = false;
    this._lastSentRoomX = null;
    this._lastSentRoomY = null;

    // ── Objects (Phase 11) ──────────────────────────────────────────────────
    this._objectContainers = new Map(); // id -> { data, container, hint, ownerHint, draggableSetup }
    this._isRoomOwner      = false;
    this._objectOverlayOpen = false;
    this._objectOverlayEl   = null;
    this._draggingObjectId  = null; // set while the owner is drag-moving an object (M2)
    this._objectEditingId   = null; // set while the Add/Edit overlay is in edit mode (M2)
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
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._gameOverlayOpen)   this._closeGameOverlay();
      if (this._objectOverlayOpen) this._closeObjectOverlay();
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
    this._gameOverlayEl  = null;
    this._gameOverlayOpen = false;
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
          entry.container.destroy();
          entry.hint?.destroy();
          entry.ownerHint?.destroy();
          this._objectContainers.delete(id);
        }
      }

      for (const obj of objects) {
        // Interactive objects (real code) are Phase 11 milestone 3 — skip
        // for now so a decorative-only room never trips over an unhandled kind.
        if (obj.subKind !== 'decorative') continue;

        let entry = this._objectContainers.get(obj.id);
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
          entry = { data: obj, container, hint, ownerHint, draggableSetup: false };
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

    // ── Freeze movement while an overlay is open or an object is being dragged ─
    if (this._gameOverlayOpen || this._objectOverlayOpen || this._draggingObjectId) {
      body.setVelocity(0);
      updateCharacter(this.player, { moving: false, delta });
      this._nameTag.setPosition(this.player.x, this.player.y - 24);
      return;
    }

    // ── Decorative objects: animate + linked-artifact proximity + owner edit/delete ─
    // Interacting with a link opens it in a new tab — never in-game, since
    // it's an unvetted external site, not a submitted/approved creation.
    let interactedThisFrame  = false;
    let ownerActionThisFrame = false;
    for (const entry of this._objectContainers.values()) {
      updateObject(entry.container, delta);
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, entry.data.x, entry.data.y);
      const near = dist < 70;

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
      <div style="background:#0d1b2e;border:1px solid #1a4a7f;border-radius:12px;padding:2rem;width:560px;max-width:95vw;font-family:system-ui,sans-serif">
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
  }

  _openGameOverlay() {
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

  // ── Add/Edit Object Overlay (Phase 11, decorative) ─────────────────────────
  // Decorative objects are pure data — submitted straight to
  // /api/objects/decorative (add) or /api/objects/:id/edit (edit) and live
  // instantly, no admin queue. One overlay serves both: add mode is entered
  // via [O] and places the object where the player is standing; edit mode is
  // entered via [C] near an owned object and pre-fills its current config.
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
      <div style="background:#0d1b2e;border:1px solid #1a4a7f;border-radius:12px;padding:2rem;width:560px;max-width:95vw;font-family:system-ui,sans-serif">
        <h2 id="woc-object-title" style="color:#88ccff;margin:0 0 0.5rem;font-size:1.1rem">Add Decorative Object</h2>
        <p id="woc-object-desc" style="color:#888;font-size:0.82rem;margin-bottom:1.25rem">Paste a shape-config JSON (ask Gemini to generate one from the object contract). It's placed where you're standing and appears instantly — no admin review needed for decorative objects.</p>
        <label style="display:block;margin-bottom:0.75rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Shape Config (JSON)</span>
          <textarea id="woc-object-config" placeholder='{"shapes":[{"type":"circle","x":0,"y":0,"r":20,"color":"#f4a261"}],"scale":1,"animation":"pulse"}'
            style="width:100%;height:160px;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.78rem;font-family:'Courier New',monospace;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        </label>
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
  }

  // Pass an existing entry (from the [C] proximity handler) to open in edit
  // mode; call with no argument (as [O] does) to add a new object at the
  // player's current position.
  _openObjectOverlay(editEntry = null) {
    this.input.keyboard.disableGlobalCapture();
    if (!this._objectOverlayEl) this._createObjectOverlay();
    this._objectOverlayEl.style.display = 'flex';

    this._objectEditingId = editEntry?.data.id ?? null;
    document.getElementById('woc-object-title').textContent =
      editEntry ? 'Edit Object' : 'Add Decorative Object';
    document.getElementById('woc-object-desc').textContent = editEntry
      ? 'Edit this object\'s shape-config JSON or linked artifact. Saves instantly — no admin review needed for decorative objects.'
      : 'Paste a shape-config JSON (ask Gemini to generate one from the object contract). It\'s placed where you\'re standing and appears instantly — no admin review needed for decorative objects.';
    document.getElementById('woc-object-submit').textContent = editEntry ? 'Save Changes' : 'Add Object';

    document.getElementById('woc-object-config').value =
      editEntry ? JSON.stringify(editEntry.data.shapeConfig, null, 2) : '';
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
  }

  _closeObjectOverlay() {
    if (this._objectOverlayEl) this._objectOverlayEl.style.display = 'none';
    this.input.keyboard.enableGlobalCapture();
    this._objectOverlayOpen = false;
    this._objectEditingId   = null;
  }

  async _submitObjectConfig() {
    const raw    = document.getElementById('woc-object-config').value.trim();
    const status = document.getElementById('woc-object-status');
    const btn    = document.getElementById('woc-object-submit');
    const editingId = this._objectEditingId;

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
}
