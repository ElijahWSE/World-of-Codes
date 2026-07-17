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
import { getFreshIdToken, onSessionChange } from '../auth/session.js';
import { signOutUser } from '../auth/googleAuth.js';
import { createCharacter, updateCharacter, fetchCharacterConfig } from './CharacterRenderer.js';
import {
  WORLD_W, WORLD_H, CITY_W, CITY_H, CITY_X0, CITY_Y0,
  HUB_BOUNDS, PLOTS, SPAWN_POINT, STREET_PROPS,
} from '../shared/townSquareLayout.js';

// ── World Layout Constants ─────────────────────────────────────────────────────
// WORLD_W/WORLD_H (the full canvas, including the non-walkable backdrop band)
// and CITY_W/CITY_H/CITY_X0/CITY_Y0 (the walkable city footprint within it)
// live in shared/townSquareLayout.js — the single source of truth for both
// this client and the server (server/index.js).
const SPEED          = 160;
const PORTAL_RADIUS  = 42;   // trigger distance for entering an active portal
const CLAIM_RADIUS   = 90;   // trigger distance for showing the claim hint

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
    if (data?.uid) {
      this.playerUid      = data.uid;
      this.playerName     = String(data.displayName ?? 'Player').slice(0, 20);
      this.playerPhotoURL = data.photoURL ?? null;
      // Present on the LoginScene/CharacterScene -> WorldScene hop. Returning
      // from a room uses scene.wake(), which doesn't re-run init(), so this
      // is never re-checked (or overwritten) mid-visit.
      if (data.characterConfig) this.playerCharacterConfig = data.characterConfig;
    }
  }

  preload() {}

  create() {
    this._createBackdrop();
    this._createSkylineBuildings();
    this._createBackdropClouds();
    this._createMoonAndStars();
    this._createCityGround();
    this._createStreetsAndPlots();
    this._createPlayer();
    this._createGarden();
    this._createSignpost();
    this._createSignOutButton();
    this._setupCamera();
    this._setupInput();
    this._connectMultiplayer();

    // Fetch portal slots from server and draw portals
    this._fetchAndDrawPortals();

    this._unsubscribeSession = onSessionChange(session => {
      if (!session.uid) this.scene.start('LoginScene');
    });

    this.events.once('shutdown', () => {
      this._destroyClaimOverlay();
      this._destroySignOutButton();
      if (this._unsubscribeSession) { this._unsubscribeSession(); this._unsubscribeSession = null; }
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
            // vite-ignore: path is dynamic (user-submitted room file).
            // ?v=roomVersion busts the browser's ES module cache — updates
            // reuse the same fileName, so without this an approved update
            // never reaches players who already imported the old version.
            const url = '/rooms/' + slot.fileName + (slot.roomVersion ? `?v=${slot.roomVersion}` : '');
            slot.roomModule = await import(/* @vite-ignore */ url);
          } catch (e) {
            console.warn('[WorldScene] Could not load room:', slot.fileName, e.message);
            slot.roomModule = null;
          }
        }
      }
      this._activeSlots = slots;
    } catch (e) {
      console.error('[WorldScene] Failed to fetch portal slots:', e);
      // Fall back: show all plots as dim/unclaimed
      this._activeSlots = PLOTS.map(s => ({ ...s, fileName: null, roomModule: null }));
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
    const { key, x, y, color, roomName, fileName, uid } = slot;
    const isActive  = !!fileName;
    // Locked = someone else's confirmed-owner slot. uid is only ever set once
    // a room has been through /admin/link-owner or approved while signed in,
    // so unlinked/legacy slots (uid: null) are never locked.
    const isLocked  = isActive && !!uid && uid !== this.playerUid;
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
    } else if (isLocked) {
      updateHint = track(this.add.text(x, y - 96, '🔒 Owned by another creator', {
        fontSize: '12px', fill: '#e07a7a', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(20).setVisible(false));
    } else {
      updateHint = track(this.add.text(x, y - 96, '[U] Update World', {
        fontSize: '12px', fill: '#aaddff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(20).setVisible(false));
    }

    return { objects, countText, claimHint, updateHint };
  }

  // ── Background ────────────────────────────────────────────────────────────
  // A big sky wash across the WHOLE canvas, including the backdrop band
  // beyond the walkable city — this is the "Super Mario background" layer:
  // it sits behind everything and is visible whenever the camera can see
  // past the city's edge, giving a sense of a much bigger world beyond
  // where the player can actually walk.
  _createBackdrop() {
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x8FC6EA, 0x8FC6EA, 0xD9EEF9, 0xD9EEF9, 1);
    sky.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  // Pavement fill for the walkable city footprint only — plots/streets/hub
  // draw on top of this within CITY_X0..CITY_X0+CITY_W (and the Y
  // equivalent); any gap left between plots (streets) shows this colour
  // through, so no separate street polygons are needed.
  _createCityGround() {
    const pavement = this.add.graphics().setDepth(1);
    pavement.fillStyle(0xD9D3C4);
    pavement.fillRect(CITY_X0, CITY_Y0, CITY_W, CITY_H);
  }

  // ── Streets & Plots ───────────────────────────────────────────────────────
  // Draws every plot from the shared, generated town-square layout
  // (src/shared/townSquareLayout.js) as a filled polygon/triangle. Portals
  // themselves are drawn separately by _drawPortal(), on top of these, once
  // slot assignment data comes back from the server.
  _createStreetsAndPlots() {
    // Drop shadow under every plot, offset down-right — a cheap way to read
    // each plot as slightly raised above street level (oblique/"Pokemon"
    // depth cue) without a full elevation system.
    const SHADOW_OFFSET = 8;
    const shadow = this.add.graphics().setDepth(3.2);
    const gfx = this.add.graphics().setDepth(3.5);
    for (const plot of PLOTS) {
      const shadowPts = plot.points.map(([x, y]) => ({ x: x + SHADOW_OFFSET, y: y + SHADOW_OFFSET }));
      shadow.fillStyle(0x000000, 0.18);
      shadow.fillPoints(shadowPts, true);

      const pts = plot.points.map(([x, y]) => ({ x, y }));
      gfx.fillStyle(plot.color, 0.9);
      gfx.fillPoints(pts, true);
      gfx.lineStyle(2, 0xFFFFFF, 0.35);
      gfx.strokePoints(pts, true);
    }
    this._createStreetProps();
  }

  // Small lamp-post props scattered on street/alley ground (never on a plot
  // or the hub) — scattered vertical elements break up the flat ground plane
  // for the same oblique-depth reason as the plot shadows above.
  _createStreetProps() {
    for (const { x, y } of STREET_PROPS) {
      const depth = 5 + y / 200;
      this.add.ellipse(x + 3, y + 4, 22, 10, 0x000000, 0.2).setDepth(depth - 0.01);

      const container = this.add.container(x, y).setDepth(depth);
      const gfx = this.add.graphics();
      gfx.fillStyle(0x4A4A55);
      gfx.fillRect(-4, -46, 8, 46);
      gfx.fillStyle(0x33333D);
      gfx.fillRect(-10, -50, 20, 6);
      gfx.fillStyle(0xFFE28A, 0.9);
      gfx.fillCircle(0, -50, 9);
      gfx.fillStyle(0xFFE28A, 0.18);
      gfx.fillCircle(0, -50, 20);
      container.add(gfx);
    }
  }

  // ── Central Garden ────────────────────────────────────────────────────────
  // A small plaza garden at the centre of the town square: lawn, trees, and
  // a fountain. Only the fountain itself is solid — the lawn is walkable.
  _createGarden() {
    const { cx, cy, w, h } = HUB_BOUNDS;
    const halfW = w / 2, halfH = h / 2;

    const gfx = this.add.graphics().setDepth(4);
    gfx.fillStyle(0x8FBC6A);
    gfx.fillRect(cx - halfW, cy - halfH, w, h);
    gfx.lineStyle(6, 0x5E8A3A, 0.9);
    gfx.strokeRect(cx - halfW, cy - halfH, w, h);

    this.add.text(cx, cy - halfH - 26, 'TOWN GARDEN', {
      fontSize: '16px', fill: '#3d1f00', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(5);

    // Trees around the lawn, clear of the fountain in the middle
    const TREE_OFFSETS = [
      [-halfW + 60, -halfH + 55], [halfW - 60, -halfH + 55],
      [-halfW + 60, halfH - 55],  [halfW - 60, halfH - 55],
      [-halfW + 55, 0], [halfW - 55, 0],
      [0, -halfH + 50], [0, halfH - 50],
    ];
    for (const [ox, oy] of TREE_OFFSETS) this._createTree(cx + ox, cy + oy);

    // Fountain
    const R = 78;
    this.add.ellipse(cx + 5, cy + 8, R * 2 + 10, R * 0.9, 0x000000, 0.15).setDepth(4.4);
    const fgfx = this.add.graphics().setDepth(4.5);
    fgfx.fillStyle(0xC8BFA6); fgfx.fillCircle(cx, cy, R);
    fgfx.fillStyle(0x6FB8D9); fgfx.fillCircle(cx, cy, R - 14);
    fgfx.fillStyle(0x8FD0E8, 0.7); fgfx.fillCircle(cx, cy, R - 30);
    fgfx.fillStyle(0xB8B09A); fgfx.fillCircle(cx, cy, 16);
    fgfx.fillStyle(0xEAF6FA, 0.85); fgfx.fillCircle(cx, cy, 7);
    this.tweens.add({ targets: fgfx, alpha: 0.82, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Solid collider — only the fountain itself blocks movement, not the lawn
    const hitbox = this.add.rectangle(cx, cy, R * 1.6, R * 1.6, 0x000000, 0);
    this.physics.add.existing(hitbox, true);
    this.physics.add.collider(this.player, hitbox);
  }

  _createTree(x, y) {
    const depth = 5 + y / 200;
    this.add.ellipse(x + 4, y + 6, 34, 14, 0x000000, 0.18).setDepth(depth - 0.01);
    const container = this.add.container(x, y).setDepth(depth);
    const gfx = this.add.graphics();
    gfx.fillStyle(0x6B4A2E);
    gfx.fillRect(-5, -34, 10, 34);
    gfx.fillStyle(0x4C9A4C);
    gfx.fillCircle(0, -46, 22);
    gfx.fillStyle(0x5CB35C);
    gfx.fillCircle(-10, -38, 16);
    gfx.fillCircle(11, -40, 16);
    container.add(gfx);
  }

  // ── HDB skyline ───────────────────────────────────────────────────────────
  // A row of simple flat-fronted building silhouettes lines the inner edge
  // of the backdrop band on all four sides — like distant blocks visible
  // just beyond the city you're walking through, never enterable.
  _createSkylineBuildings() {
    const PALETTE = [0x9FB4C7, 0x8AA3B8, 0xB0C4D6, 0x7C93A8];
    const rows = [
      { axis: 'x', from: CITY_X0, to: CITY_X0 + CITY_W, edge: CITY_Y0, dir: -1 },              // top
      { axis: 'x', from: CITY_X0, to: CITY_X0 + CITY_W, edge: CITY_Y0 + CITY_H, dir: 1 },      // bottom
      { axis: 'y', from: CITY_Y0, to: CITY_Y0 + CITY_H, edge: CITY_X0, dir: -1 },              // left
      { axis: 'y', from: CITY_Y0, to: CITY_Y0 + CITY_H, edge: CITY_X0 + CITY_W, dir: 1 },      // right
    ];
    for (const row of rows) {
      let pos = row.from;
      while (pos < row.to) {
        const w = Phaser.Math.Between(90, 180);
        const h = Phaser.Math.Between(180, 480);
        const color = Phaser.Utils.Array.GetRandom(PALETTE);
        this._drawSkylineBuilding(row, pos, w, h, color);
        pos += w + Phaser.Math.Between(10, 30);
      }
    }
  }

  _drawSkylineBuilding(row, pos, w, h, color) {
    const gfx = this.add.graphics().setDepth(0.5);
    let x, y, bw, bh;
    if (row.axis === 'x') {
      bw = w; bh = h; x = pos;
      y = row.dir < 0 ? row.edge - h : row.edge;
    } else {
      bw = h; bh = w; y = pos;
      x = row.dir < 0 ? row.edge - h : row.edge;
    }
    gfx.fillStyle(color, 0.85);
    gfx.fillRect(x, y, bw, bh);
    gfx.fillStyle(0xFFFFFF, 0.25);
    for (let wy = y + 10; wy < y + bh - 10; wy += 14) {
      for (let wx = x + 10; wx < x + bw - 10; wx += 14) {
        gfx.fillRect(wx, wy, 8, 8);
      }
    }
  }

  // ── Backdrop clouds ───────────────────────────────────────────────────────
  // Big drifting clouds scattered across the backdrop band only — never over
  // the walkable city — so they read as distant background, not decorations
  // sitting on the ground.
  _createBackdropClouds() {
    for (let i = 0; i < 12; i++) {
      const side = Phaser.Math.Between(0, 3);
      let x, y;
      if (side === 0)      { x = Phaser.Math.Between(0, WORLD_W); y = Phaser.Math.Between(40, CITY_Y0 - 80); }
      else if (side === 1) { x = Phaser.Math.Between(0, WORLD_W); y = Phaser.Math.Between(CITY_Y0 + CITY_H + 80, WORLD_H - 40); }
      else if (side === 2) { x = Phaser.Math.Between(40, CITY_X0 - 80); y = Phaser.Math.Between(0, WORLD_H); }
      else                 { x = Phaser.Math.Between(CITY_X0 + CITY_W + 80, WORLD_W - 40); y = Phaser.Math.Between(0, WORLD_H); }

      const scale = Phaser.Math.FloatBetween(1.4, 2.4);
      const container = this.add.container(x, y).setDepth(1.2).setScale(scale);
      const gfx = this.add.graphics();
      gfx.fillStyle(0xFFFFFF, 0.92);
      gfx.fillEllipse(-32, 4, 76, 32); gfx.fillEllipse(-8, -12, 58, 40); gfx.fillEllipse(28, 4, 64, 28);
      container.add(gfx);
      this.tweens.add({
        targets: container, x: x + Phaser.Math.Between(-120, 120),
        duration: Phaser.Math.Between(16000, 26000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 8000),
      });
    }
  }

  // ── Moon & stars ──────────────────────────────────────────────────────────
  // Placed in the top backdrop band only — a fixed "up" for the sky, rather
  // than floating over the whole map.
  _createMoonAndStars() {
    const starGfx = this.add.graphics().setDepth(0.8);
    starGfx.fillStyle(0xFFFFEE);
    for (let i = 0; i < 24; i++) {
      const sx = Phaser.Math.Between(0, WORLD_W), sy = Phaser.Math.Between(20, CITY_Y0 - 100);
      starGfx.fillRect(sx, sy, 3, 3);
    }
    for (let i = 0; i < 6; i++) {
      const sg = this.add.graphics().setDepth(0.9);
      sg.fillStyle(0xFFFFDD); sg.fillRect(0, 0, 4, 4);
      sg.setPosition(Phaser.Math.Between(0, WORLD_W), Phaser.Math.Between(20, CITY_Y0 - 100));
      this.tweens.add({
        targets: sg, alpha: 0.1, duration: Phaser.Math.Between(700, 2200),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Phaser.Math.Between(0, 2500),
      });
    }

    const moonX = CITY_X0 + CITY_W * 0.78, moonY = CITY_Y0 * 0.4;
    const container = this.add.container(moonX, moonY).setDepth(1).setScale(2.2);
    const gfx = this.add.graphics();
    gfx.fillStyle(0xFFF5CC, 0.35); gfx.fillCircle(0, 0, 46);
    gfx.fillStyle(0xFFF5CC);       gfx.fillCircle(0, 0, 34);
    gfx.fillStyle(0xEEE5AA, 0.55);
    gfx.fillCircle(-8, -7, 6); gfx.fillCircle(8, 7, 4); gfx.fillCircle(-2, 13, 3);
    container.add(gfx);
  }

  // ── Player ────────────────────────────────────────────────────────────────
  _createPlayer() {
    if (!this.playerName) {
      this.playerName = `Player_${Math.floor(Math.random() * 9000) + 1000}`;
    }

    // Default spawn is a point near the hub guaranteed clear of every portal's trigger radius
    let spawnX = SPAWN_POINT.x, spawnY = SPAWN_POINT.y;
    if (this._returnDoor) {
      const slot = this._activeSlots.find(s => s.key === this._returnDoor);
      if (slot) { spawnX = slot.x; spawnY = slot.y + 100; }
    }

    this.player = createCharacter(this, this.playerCharacterConfig, spawnX, spawnY).setDepth(5);
    this.physics.add.existing(this.player);
    // Containers have no natural width/height for Arcade physics to size a
    // body from, unlike the placeholder rectangle this replaces — set one
    // explicitly, centered on the container's own origin, matching the old
    // 32x32 box so collision/portal-radius tuning elsewhere doesn't shift.
    this.player.body.setSize(28, 28);
    this.player.body.setOffset(-14, -14);
    this.player.body.setCollideWorldBounds(true);

    this.playerLabel = this.add.text(spawnX, spawnY - 24, 'You', {
      fontSize: '12px', fill: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
  }

  _setupCamera() {
    // Physics bounds are the walkable CITY only — players can't walk into
    // the backdrop band. Camera bounds are the full WORLD, so the backdrop
    // (sky/clouds/skyline) is still visible whenever the player is near the
    // city's edge, the same way Mario's background is visible but not walkable.
    this.physics.world.setBounds(CITY_X0, CITY_Y0, CITY_W, CITY_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    // Zoomed out from the default 1.0 so more of the town square is visible
    // at once, without touching the base canvas size — the canvas itself is
    // left alone because RoomScene's mini-game overlay and existing approved
    // student mini-games hardcode coordinates against it.
    this.cameras.main.setZoom(0.7);
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
    getFreshIdToken()
      .then(idToken => client.joinOrCreate('world', { name: this.playerName, uid: this.playerUid, idToken }, WorldState))
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
              // Position updates arrive at network tick rate, not every
              // render frame — the moving/facingX flags recorded here are
              // read every frame in update() below to drive the shared
              // idle/walk/flip animation smoothly regardless of tick rate.
              const dx = playerState.x - existing.body.x;
              const dy = playerState.y - existing.body.y;
              existing.moving  = dx !== 0 || dy !== 0;
              existing.facingX = dx;
              existing.body.setPosition(playerState.x, playerState.y);
              existing.label.setPosition(playerState.x, playerState.y - 24);
              existing.body.setDepth(5 + playerState.y / 200);
              existing.label.setDepth(5.1 + playerState.y / 200);
            } else {
              // Gray placeholder shown immediately; swapped for the real
              // character once /api/character/:uid resolves, so a newly
              // seen player is never invisible during that brief gap.
              const body = this.add.rectangle(playerState.x, playerState.y, 32, 32, 0x888888).setDepth(5);
              const label = this.add.text(playerState.x, playerState.y - 24, playerState.name, {
                fontSize: '12px', fill: '#bbbbbb', stroke: '#000000', strokeThickness: 2,
              }).setOrigin(0.5).setDepth(15);
              const entry = { body, label, moving: false, facingX: 0, animated: false };
              this.otherPlayers.set(sessionId, entry);

              fetchCharacterConfig(playerState.uid).then(config => {
                // The player may have left, or the entry may have been
                // replaced, by the time this resolves — don't resurrect it.
                if (this.otherPlayers.get(sessionId) !== entry) return;
                const container = createCharacter(this, config, entry.body.x, entry.body.y).setDepth(entry.body.depth);
                entry.body.destroy();
                entry.body     = container;
                entry.animated = true;
              });
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
  update(time, delta) {
    // Runs unconditionally, before any local-overlay early return below —
    // other players keep animating smoothly even while the local player has
    // a signpost or claim form open, since they're moving independently
    // over the network regardless of local UI state.
    this.otherPlayers.forEach(p => {
      if (p.animated) updateCharacter(p.body, { moving: p.moving, facingX: p.facingX, delta });
    });

    // Freeze movement when sign is open or claim overlay is open
    if (this._signOpen || this._claimOpen) {
      this.player.body.setVelocity(0);
      updateCharacter(this.player, { moving: false, delta }); // idle bob keeps playing even while frozen
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
    updateCharacter(this.player, { moving: body.velocity.lengthSq() > 0, facingX: body.velocity.x, delta });

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
          const isLocked = !!door.uid && door.uid !== this.playerUid;
          if (isLocked) {
            this._showToast("This world belongs to another creator — you can't edit it.", 'rejected');
          } else {
            this._openClaimOverlay(door.key, true);
          }
        }
        if (dist < PORTAL_RADIUS && !door.triggered) {
          if (hint) hint.setVisible(false);
          door.triggered = true;
          if (this.colyseusRoom) this.colyseusRoom.send('enterRoom', { key: door.key });
          this.scene.launch('RoomScene', {
            room:         door.roomModule,
            returnDoor:   door.key,
            playerName:   this.playerName,
            playerUid:    this.playerUid,
            playerCharacterConfig: this.playerCharacterConfig,
            colyseusRoom: this.colyseusRoom,
            roomKey:      door.key,
            gameFileName: door.gameFileName ?? null,
            gameVersion:  door.gameVersion  ?? null,
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
    this.input.keyboard.disableGlobalCapture();
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
    this.input.keyboard.enableGlobalCapture();
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
      const res  = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind:        'room',
          slotKey:     this._claimTargetSlot,
          displayName: name,
          uid:         this.playerUid ?? null,
          sessionId:   this.colyseusRoom?.sessionId ?? null,
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

  // ── Sign-out button ────────────────────────────────────────────────────────
  _createSignOutButton() {
    const el = document.createElement('button');
    el.textContent = 'Sign Out';
    el.style.cssText = [
      'position:fixed;top:1rem;right:1rem;z-index:9997',
      'padding:0.4rem 0.9rem;background:rgba(22,33,62,0.85);color:#e0e0e0',
      'border:1px solid #2a4a7f;border-radius:6px;cursor:pointer',
      'font-family:system-ui,sans-serif;font-size:0.78rem;font-weight:600',
    ].join(';');
    el.onclick = () => signOutUser();
    document.body.appendChild(el);
    this._signOutBtnEl = el;
  }

  _destroySignOutButton() {
    if (this._signOutBtnEl) { this._signOutBtnEl.remove(); this._signOutBtnEl = null; }
  }

  // ── Signpost ───────────────────────────────────────────────────────────────
  _createSignpost() {
    // Placed beside the hub (not south of it, where the player spawns)
    const sx = HUB_BOUNDS.cx + HUB_BOUNDS.w / 2 + 150, sy = HUB_BOUNDS.cy;

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
      'MY WORLD THEME: [YOUR WORLD THEME — e.g. "Crystal Cave", "Underwater World"]\n' +
      'MY GAME IDEA:   [YOUR GAME IDEA — e.g. "catch falling gems in a basket",\n' +
      '                 "memory card matching", "dodge scrolling obstacles"]\n' +
      '\n' +
      '════════════════════════════════════════════════════════════\n' +
      'TASK: Generate a mini-game file for a custom game engine.\n' +
      'The engine calls my functions — I do NOT create a Phaser.Game\n' +
      'or a Phaser.Scene class. I only fill in a plain JS object.\n' +
      '════════════════════════════════════════════════════════════\n' +
      '\n' +
      'HERE IS A COMPLETE WORKING EXAMPLE — match this structure exactly:\n' +
      '\n' +
      '─────────────────────────────────────────────────────────────\n' +
      "export const game = {\n" +
      "  gameName: 'Click the Star',\n" +
      '\n' +
      '  onGameLoad(scene) {\n' +
      '    // load images/audio here (leave empty if not needed)\n' +
      '  },\n' +
      '\n' +
      '  onGameCreate(scene) {\n' +
      '    scene.gameData = { score: 0 };\n' +
      '\n' +
      '    scene.gameData.scoreText = scene.add.text(400, 90, "Score: 0", {\n' +
      "      fontSize: '22px', fill: '#ffffff',\n" +
      '    }).setOrigin(0.5);\n' +
      '\n' +
      '    const target = scene.add.circle(400, 320, 32, 0xffdd00).setInteractive();\n' +
      '    scene.gameData.target = target;\n' +
      '\n' +
      '    target.on("pointerdown", () => {\n' +
      '      scene.gameData.score += 1;\n' +
      '      scene.gameData.scoreText.setText("Score: " + scene.gameData.score);\n' +
      '      target.setPosition(\n' +
      '        Phaser.Math.Between(60, 740),\n' +
      '        Phaser.Math.Between(100, 560),\n' +
      '      );\n' +
      '      if (scene.gameData.score >= 10) scene.exitGame();\n' +
      '    });\n' +
      '  },\n' +
      '\n' +
      '  onGameUpdate(scene) {\n' +
      '    // runs every frame — put timers, movement, collision here\n' +
      '  },\n' +
      '\n' +
      '  onGameExit(scene) {\n' +
      '    scene.gameData = null; // always clean up\n' +
      '  },\n' +
      '};\n' +
      '─────────────────────────────────────────────────────────────\n' +
      '\n' +
      'COORDINATE SPACE: x 0–800, y 65–590  (top 64 px is the title bar — do not draw there)\n' +
      '\n' +
      'RULES — the engine will REJECT the file if any of these are broken:\n' +
      '  ✅ The file must contain ONLY "export const game = { ... };" — nothing before or after\n' +
      '  ✅ All four methods must exist: onGameLoad, onGameCreate, onGameUpdate, onGameExit\n' +
      '  ✅ Store ALL game state in scene.gameData (set it in onGameCreate, null it in onGameExit)\n' +
      '  ✅ Call scene.exitGame() to close the game (on win, lose, or quit)\n' +
      '  ❌ NO import or require() statements — not even "import Phaser from phaser"\n' +
      '  ❌ NO new Phaser.Game() or new Phaser.Scene() — the engine already has those\n' +
      '  ❌ NO class declarations\n' +
      '  ❌ NO export default — only "export const game"\n' +
      '  ❌ NO fetch(), document, window, or localStorage\n' +
      '\n' +
      'First show me a playable HTML preview of the game so I can test it and request changes.\n' +
      'Once I am happy, output the final code as a single code block — ONLY the export const game = { ... }; block, nothing else.';

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
          'BEFORE YOU COPY, decide two things:\n' +
          '  1. Your game idea — what will players actually do?\n' +
          '     e.g. "catch falling stars", "memory card flip",\n' +
          '          "dodge obstacles scrolling toward you"\n' +
          '  2. Your world theme (same as your room)\n' +
          '     e.g. "Crystal Cave", "Underwater World"\n' +
          '\n' +
          'STEPS:\n' +
          '  1. Click "Copy Prompt" below\n' +
          '  2. Paste into a NEW Gemini conversation\n' +
          '  3. Fill in MY WORLD THEME and MY GAME IDEA at the very top\n' +
          '  4. Gemini shows a preview — test it, ask for changes\n' +
          '  5. When happy: copy the final code block Gemini outputs\n' +
          '  6. Enter your room → walk to your game object → press [G]\n' +
          '     Paste the code and submit — admin will activate it!\n' +
          '\n' +
          'HOW IT WORKS IN-GAME:\n' +
          '  - Your room file must export gameAnchorX and gameAnchorY\n' +
          '  - Players walk near that spot → see "[E] ???"\n' +
          '  - Once your game is approved → "[E] Play: <game name>"',
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
