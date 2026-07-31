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
import { buildSharingFieldsHTML, refreshSharingFields, readSharingFields, wireShareCheckbox } from './creationSharing.js';
import { apiUrl, wsUrl } from './serverUrl.js';
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

const SERVER_URL = wsUrl();

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
    // Phase 15 — set once the client has joined the 'session' room type
    // instead of 'world'; null while in the persistent main world.
    this._activeInPersonSessionId = null;
    this._sessionInviteEl = null;
    this._worldBadgeEl = null;
    this._transitioning = false;
    this._sessionEndingEl = null;
    this._sessionEndingInterval = null;
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
    this._createSignOutButton();
    this._createProfileButton();
    this._createPlayersOnlineSidebar();
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
      this._destroyProfileButton();
      this._destroyPlayersOnlineSidebar();
      if (this._unsubscribeSession) { this._unsubscribeSession(); this._unsubscribeSession = null; }
      if (this.colyseusRoom) {
        this.colyseusRoom.leave();
        this.colyseusRoom = null;
      }
      if (this._sessionInviteEl) { this._sessionInviteEl.remove(); this._sessionInviteEl = null; }
      if (this._worldBadgeEl) { this._worldBadgeEl.remove(); this._worldBadgeEl = null; }
      if (this._sessionEndingEl) { this._sessionEndingEl.remove(); this._sessionEndingEl = null; }
      if (this._sessionEndingInterval) { clearInterval(this._sessionEndingInterval); this._sessionEndingInterval = null; }
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
      const res   = await fetch(apiUrl('/api/portal-slots'));
      const { slots } = await res.json();

      // Dynamically import room modules for active slots
      for (const slot of slots) {
        if (slot.fileName) {
          try {
            // vite-ignore: path is dynamic (user-submitted room file).
            // ?v=roomVersion busts the browser's ES module cache — updates
            // reuse the same fileName, so without this an approved update
            // never reaches players who already imported the old version.
            const url = apiUrl('/rooms/' + slot.fileName + (slot.roomVersion ? `?v=${slot.roomVersion}` : ''));
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
    this._keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E); // claim/enter a portal
    this._keyU = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.U); // update an owned world
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._claimOpen) this._closeClaimOverlay();
    });
  }

  // ── Multiplayer ────────────────────────────────────────────────────────────
  _connectMultiplayer() {
    console.log(`[Colyseus] Connecting to ${SERVER_URL}`);
    this._colyseusClient = new Client(SERVER_URL);
    // Phase 15 — before joining the persistent main world, check whether
    // this signed-in player is currently invited to an active in-person
    // session; if so, join that instead of 'world'.
    getFreshIdToken()
      .then(idToken => fetch(apiUrl('/api/session/mine'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }).then(res => res.json()).then(data => data?.sessionId ?? null).catch(() => null))
      .then(sessionId => sessionId ? this._joinSessionRoom(sessionId) : this._joinWorldRoom())
      .catch(err => {
        console.error('[Colyseus] Connection FAILED:', err.message);
      });
  }

  // Joins the persistent main world ('world' room type).
  _joinWorldRoom() {
    return getFreshIdToken()
      .then(idToken => this._colyseusClient.joinOrCreate('world', { name: this.playerName, uid: this.playerUid, idToken }, WorldState))
      .then(room => {
        this._activeInPersonSessionId = null;
        this._bindRoomHandlers(room);
        // Live invite nudge (Phase 15) — not a forced migration. The admin
        // starting a session pushes this to any already-connected invited
        // player; accepting does the same room-swap a fresh reload would do.
        room.onMessage('sessionInvite', ({ sessionId }) => {
          this._showSessionInvitePrompt(sessionId);
        });
      });
  }

  // Joins an admin-started in-person session ('session' room type,
  // filterBy'd server-side on sessionDocId so every invited player lands in
  // the same instance). Rejected by the server's onAuth gate if the session
  // has ended or this uid isn't on its roster.
  _joinSessionRoom(sessionId) {
    return getFreshIdToken()
      .then(idToken => this._colyseusClient.joinOrCreate('session', {
        sessionDocId: sessionId, name: this.playerName, uid: this.playerUid, idToken,
      }, WorldState))
      .then(room => {
        this._activeInPersonSessionId = sessionId;
        this._bindRoomHandlers(room);
        // Admin clicking End Session starts a 60s grace period rather than
        // an immediate disconnect — this is the heads-up broadcast for that.
        // Each player decides independently whether to leave right away or
        // wait out the timer; either way `room.onLeave` below is what
        // actually pulls them back to the main world.
        room.onMessage('sessionEnding', ({ endsAt }) => {
          this._showSessionEndingCountdown(room, endsAt);
        });
        // The server disconnects this room once the grace period elapses (or
        // the connection just drops) — with no reconnect logic the player
        // would otherwise be stuck disconnected. `this.colyseusRoom !== room`
        // guards against firing after a newer room has already taken over
        // (e.g. this same leave happening as part of a deliberate re-join).
        room.onLeave(() => {
          if (this.colyseusRoom !== room) return;
          if (this._sessionEndingEl) { this._sessionEndingEl.remove(); this._sessionEndingEl = null; }
          if (this._sessionEndingInterval) { clearInterval(this._sessionEndingInterval); this._sessionEndingInterval = null; }
          // Pull the player back regardless of what they're doing — mid-room,
          // mid-mini-game, or with an overlay (feedback/help/etc.) open. Both
          // WorldScene (asleep) and RoomScene (active or paused, if a
          // GameScene is on top of it) keep running their JS even while not
          // visible, so this reaches them without waiting for a manual exit.
          this._forceOutOfAnyRoom();
          this.otherPlayers.forEach(p => { p.body.destroy(); p.label.destroy(); });
          this.otherPlayers.clear();
          this._activeInPersonSessionId = null;
          this._playPortalTransition(() => this._joinWorldRoom());
        });
      })
      .catch(err => {
        console.error('[Colyseus] Session join FAILED:', err.message);
        this._showToast("Couldn't join the session — it may have ended.", 'rejected');
      });
  }

  // Forces the player out of whatever they're doing back to WorldScene —
  // a mini-game (GameScene, launched on top of a paused RoomScene), a room
  // with an overlay open (feedback/help/object/music/etc.), or just a plain
  // room visit. Exits via each scene's own real exit method (exitGame /
  // forceExit) rather than a raw scene.stop(), so onGameExit/onExit hooks
  // still run and RoomScene's overlay DOM nodes get cleaned up instead of
  // lingering over WorldScene. No-op if the player is already in the world.
  _forceOutOfAnyRoom() {
    if (this.scene.isActive('GameScene')) {
      this.scene.get('GameScene')?.exitGame?.();
    }
    if (this.scene.isActive('RoomScene') || this.scene.isPaused('RoomScene')) {
      this.scene.get('RoomScene')?.forceExit?.();
    }
  }

  // Small persistent top-left label so it's always visually obvious whether
  // the player is in the shared main world or an isolated in-person session.
  _updateWorldBadge() {
    if (!this._worldBadgeEl) {
      const el = document.createElement('div');
      el.id = 'woc-world-badge';
      el.style.cssText = [
        'position:fixed;top:0.6rem;left:0.6rem;z-index:9000',
        'padding:0.3rem 0.75rem;border-radius:6px',
        "font-family:'Nunito',system-ui,sans-serif;font-size:0.78rem;font-weight:700",
        'pointer-events:none;letter-spacing:0.02em',
      ].join(';');
      document.body.appendChild(el);
      this._worldBadgeEl = el;
    }
    const inSession = !!this._activeInPersonSessionId;
    this._worldBadgeEl.textContent = inSession ? 'In-Person Session' : 'Main World';
    this._worldBadgeEl.style.background = inSession ? '#FFE8DEcc' : '#FFFFFFcc';
    this._worldBadgeEl.style.color      = inSession ? '#FF7A59' : '#2EC4B6';
    this._worldBadgeEl.style.border     = inSession ? '1px solid #FF7A59' : '1px solid #F0E4C8';
  }

  // Portal/warp effect used whenever the player's world swaps out from under
  // them mid-play (accepting a session invite, or a session ending and
  // falling back to the main world) — not used for the very first room join
  // on page load, where there's nothing yet to visually transition from.
  // Zooms the camera in while fading to a portal-tinted color, runs `swapFn`
  // (which may be async — e.g. a Colyseus room join) once fully covered,
  // then reverses. Movement is frozen for the duration via `_transitioning`.
  _playPortalTransition(swapFn) {
    const cam = this.cameras.main;
    const startZoom = cam.zoom;
    this._transitioning = true;
    this.player.body.setVelocity(0);

    const finish = () => {
      cam.fadeIn(350, 20, 10, 40);
      this.tweens.add({ targets: cam, zoom: startZoom, duration: 350, ease: 'Sine.easeOut' });
      cam.once('camerafadeincomplete', () => { this._transitioning = false; });
    };

    cam.fadeOut(350, 20, 10, 40);
    this.tweens.add({ targets: cam, zoom: startZoom * 1.8, duration: 350, ease: 'Sine.easeIn' });
    cam.once('camerafadeoutcomplete', () => {
      Promise.resolve().then(swapFn).then(finish).catch(finish);
    });
  }

  // Shared onJoin wiring for both 'world' and 'session' connections — same
  // player-rendering/portal-count logic either way, only the room type and
  // invite gate differ between the two.
  _bindRoomHandlers(room) {
    this.colyseusRoom = room;
    console.log(`[Colyseus] Joined as "${this.playerName}" (session: ${room.sessionId})`);
    this._updateWorldBadge();

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
          const entry = { body, label, moving: false, facingX: 0, animated: false, uid: playerState.uid };
          this.otherPlayers.set(sessionId, entry);
          // Phase 16 — click a co-present player's sprite/nametag to view
          // their profile. Body gets re-armed below once the placeholder
          // is swapped for the real character container, since destroy()
          // on the old body drops its interactive state along with it.
          [body, label].forEach(go => go.setInteractive({ useHandCursor: true }).on('pointerdown', () => this._openProfile(entry.uid)));

          fetchCharacterConfig(playerState.uid).then(config => {
            // The player may have left, or the entry may have been
            // replaced, by the time this resolves — don't resurrect it.
            if (this.otherPlayers.get(sessionId) !== entry) return;
            const container = createCharacter(this, config, entry.body.x, entry.body.y).setDepth(entry.body.depth);
            container.setSize(32, 44).setInteractive({ useHandCursor: true }).on('pointerdown', () => this._openProfile(entry.uid));
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
  }

  // Phase 15 — live in-app prompt for an already-connected invited player.
  // Not a forced kick: accepting performs the same leave-and-rejoin a fresh
  // page load would have done anyway (see _joinSessionRoom above).
  _showSessionInvitePrompt(sessionId) {
    if (this._sessionInviteEl) this._sessionInviteEl.remove();

    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;top:1rem;left:50%;transform:translateX(-50%)',
      'z-index:9999;padding:0.75rem 1.1rem;border-radius:8px',
      'background:#FFFFFF;border:1px solid #FF7A59;color:#2D3047',
      "font-family:'Nunito',system-ui,sans-serif;font-size:0.85rem",
      'display:flex;align-items:center;gap:0.75rem',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = "You've been invited to an in-person session.";

    const btn = document.createElement('button');
    btn.textContent = 'Accept';
    btn.style.cssText = [
      'padding:0.35rem 0.9rem;background:#FF7A59;color:#ffffff',
      'border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:0.85rem',
    ].join(';');
    btn.onclick = () => {
      el.remove();
      this._sessionInviteEl = null;
      // The invite banner is a DOM overlay, visible (and clickable) even
      // while the player is mid-room/mid-game in the main world — must force
      // out of the room BEFORE starting the transition, not inside its
      // callback: WorldScene is asleep whenever a room is open, and the
      // portal transition's camera fade only ever advances while WorldScene
      // is actually stepping. Starting the fade first would wait on a
      // 'camerafadeoutcomplete' that can never fire until something else
      // (previously: a manual room exit) wakes WorldScene back up.
      this._forceOutOfAnyRoom();
      this._playPortalTransition(() => {
        this.otherPlayers.forEach(p => { p.body.destroy(); p.label.destroy(); });
        this.otherPlayers.clear();
        if (this.colyseusRoom) this.colyseusRoom.leave();
        return this._joinSessionRoom(sessionId);
      });
    };

    el.appendChild(label);
    el.appendChild(btn);
    document.body.appendChild(el);
    this._sessionInviteEl = el;
  }

  // Heads-up banner shown for the 60s grace period after admin clicks End
  // Session (see the 'sessionEnding' listener in _joinSessionRoom above).
  // Each player decides independently whether to leave right away via the
  // button, or let the countdown run out — `room.leave()` either way routes
  // through the same room.onLeave handler that does the actual force-out +
  // transition + world-rejoin, so there's nothing else to special-case here.
  _showSessionEndingCountdown(room, endsAt) {
    if (this._sessionEndingEl) { this._sessionEndingEl.remove(); this._sessionEndingEl = null; }
    if (this._sessionEndingInterval) { clearInterval(this._sessionEndingInterval); this._sessionEndingInterval = null; }

    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;top:1rem;left:50%;transform:translateX(-50%)',
      'z-index:9999;padding:0.75rem 1.1rem;border-radius:8px',
      'background:#FFFFFF;border:1px solid #FFD84D;color:#2D3047',
      "font-family:'Nunito',system-ui,sans-serif;font-size:0.85rem",
      'display:flex;align-items:center;gap:0.75rem',
    ].join(';');

    const label = document.createElement('span');

    const btn = document.createElement('button');
    btn.textContent = 'Return to Main World now';
    btn.style.cssText = [
      'padding:0.35rem 0.9rem;background:#FFD84D;color:#2D3047',
      'border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:0.85rem',
    ].join(';');
    btn.onclick = () => {
      if (this.colyseusRoom === room) room.leave();
    };

    const tick = () => {
      const secsLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      label.textContent = `Session ending in ${secsLeft}s — you'll return to the main world.`;
      if (secsLeft <= 0) { clearInterval(this._sessionEndingInterval); this._sessionEndingInterval = null; }
    };
    tick();
    this._sessionEndingInterval = setInterval(tick, 1000);

    el.appendChild(label);
    el.appendChild(btn);
    document.body.appendChild(el);
    this._sessionEndingEl = el;
  }

  // ── Update Loop ────────────────────────────────────────────────────────────
  update(time, delta) {
    // Runs unconditionally, before any local-overlay early return below —
    // other players keep animating smoothly even while the local player has
    // a claim form open, since they're moving independently over the
    // network regardless of local UI state.
    this.otherPlayers.forEach(p => {
      if (p.animated) updateCharacter(p.body, { moving: p.moving, facingX: p.facingX, delta });
    });

    // Freeze movement when the claim overlay is open, or a portal/warp
    // transition (session enter/exit) is playing
    if (this._claimOpen || this._transitioning) {
      this.player.body.setVelocity(0);
      updateCharacter(this.player, { moving: false, delta }); // idle bob keeps playing even while frozen
      if (this._transitioning) return;
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
            inPersonSessionId: this._activeInPersonSessionId,
            roomKey:      door.key,
            gameFileName: door.gameFileName ?? null,
            gameVersion:  door.gameVersion  ?? null,
            musicFileName: door.musicFileName ?? null,
            musicVersion:  door.musicVersion  ?? null,
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
      <div style="background:#FFFFFF;border:1px solid #F0E4C8;border-radius:12px;padding:2rem;width:540px;max-width:95vw;max-height:90vh;overflow-y:auto;font-family:'Nunito',system-ui,sans-serif">
        <h2 id="woc-claim-title" style="color:#FF7A59;margin:0 0 0.5rem;font-size:1.1rem">Claim Portal</h2>
        <p id="woc-claim-desc" style="color:#6E7191;font-size:0.82rem;margin-bottom:1rem">Enter your name and paste your Gemini-generated world code. The admin will review and approve it.</p>

        <details id="woc-claim-howto" style="margin-bottom:1.25rem;background:#FFF6E4;border:1px solid #F0E4C8;border-radius:6px;padding:0.75rem 1rem">
          <summary style="cursor:pointer;color:#FF7A59;font-weight:700;font-size:0.85rem;user-select:none">📖 How to build your world with Gemini (click to expand)</summary>
          <div style="margin-top:0.85rem;font-size:0.8rem;color:#6E7191;line-height:1.6">
            <ol style="margin:0 0 0 1.1rem;padding:0">
              <li>Pick a creative theme (e.g. "Crystal Cave", "Neon City")</li>
              <li>Open <strong>gemini.google.com</strong> in a new conversation</li>
              <li>Copy <strong>Prompt 1</strong> below → paste into Gemini → tweak the preview until you're happy</li>
              <li>Copy <strong>Prompt 2</strong> in the SAME conversation → Gemini outputs your final world code</li>
              <li>Paste that code below and submit — the admin will review and approve it</li>
            </ol>
            <p style="margin-top:0.6rem">Worlds CAN: shapes, colours, text, animations (1600×1200).<br>Worlds CANNOT: imports, network requests, browser storage.</p>
          </div>
          <div style="margin-top:1rem;padding-top:0.85rem;border-top:1px solid #F0E4C8">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem">
              <strong style="color:#2D3047;font-size:0.82rem">Prompt 1 — Design &amp; Preview</strong>
              <button class="woc-claim-copy-btn" data-target="design" style="padding:0.3rem 0.75rem;background:#FF7A59;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.75rem">Copy</button>
            </div>
            <p style="font-size:0.76rem;color:#6E7191;margin-bottom:0">Design your world's look and feel with Gemini, then ask for a live preview.</p>
          </div>
          <div style="margin-top:1rem">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem">
              <strong style="color:#2D3047;font-size:0.82rem">Prompt 2 — Export Rules &amp; Template</strong>
              <button class="woc-claim-copy-btn" data-target="exportTemplate" style="padding:0.3rem 0.75rem;background:#FF7A59;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.75rem">Copy</button>
            </div>
            <p style="font-size:0.76rem;color:#6E7191;margin-bottom:0">Send this in the SAME conversation once the preview looks good — Gemini returns the final file to paste below.</p>
          </div>
        </details>

        <label style="display:block;margin-bottom:0.75rem">
          <span style="display:block;color:#6E7191;font-size:0.8rem;margin-bottom:0.3rem">Your Name (becomes the portal label — max 20 chars)</span>
          <input id="woc-claim-name" type="text" maxlength="20" placeholder="e.g. Alex Chen"
            style="width:100%;padding:0.5rem 0.75rem;background:#FFF6E4;border:1px solid #F0E4C8;border-radius:4px;color:#2D3047;font-size:0.9rem;box-sizing:border-box;outline:none">
        </label>
        <label style="display:block;margin-bottom:1rem">
          <span style="display:block;color:#6E7191;font-size:0.8rem;margin-bottom:0.3rem">World Code (paste from Gemini Prompt 2)</span>
          <textarea id="woc-claim-code" placeholder="// Paste your room code here..."
            style="width:100%;height:180px;padding:0.5rem 0.75rem;background:#FFF6E4;border:1px solid #F0E4C8;border-radius:4px;color:#2D3047;font-size:0.78rem;font-family:'Courier New',monospace;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        </label>
        ${buildSharingFieldsHTML('claim')}
        <div id="woc-claim-status" style="margin-bottom:0.75rem;font-size:0.82rem;min-height:1.2rem;white-space:pre-wrap"></div>
        <div style="display:flex;gap:0.75rem;justify-content:flex-end">
          <button id="woc-claim-cancel" style="padding:0.5rem 1.25rem;background:#F0E4C8;color:#2D3047;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Cancel</button>
          <button id="woc-claim-submit" style="padding:0.5rem 1.25rem;background:#FF7A59;color:#ffffff;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.875rem">Submit World</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._claimOverlayEl = el;
    document.getElementById('woc-claim-cancel').onclick = () => this._closeClaimOverlay();
    document.getElementById('woc-claim-submit').onclick = () => this._submitClaim();
    wireShareCheckbox('claim', () => this._claimCreationMeta);

    const prompts = this._claimPrompts();
    el.querySelectorAll('.woc-claim-copy-btn').forEach(btn => {
      btn.onclick = () => {
        navigator.clipboard.writeText(prompts[btn.dataset.target])
          .then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
          })
          .catch(() => {
            btn.textContent = 'Copy failed';
            setTimeout(() => { btn.textContent = 'Copy'; }, 2500);
          });
      };
    });
  }

  async _openClaimOverlay(slotKey, isUpdate = false) {
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
    document.getElementById('woc-claim-status').style.color = '#6E7191';
    document.getElementById('woc-claim-submit').disabled = false;
    document.getElementById('woc-claim-name').focus();
    this._claimOpen = true;
    this._claimCreationMeta = await refreshSharingFields('claim', 'room', slotKey);
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

    if (!name) { status.textContent = 'Please enter your name.'; status.style.color = '#B5401F'; return; }
    if (!code) { status.textContent = 'Please paste your room code.'; status.style.color = '#B5401F'; return; }
    const meta = readSharingFields('claim');
    if (!meta) { status.textContent = 'Choose which existing version to replace before submitting.'; status.style.color = '#B5401F'; return; }

    btn.disabled = true;
    status.textContent = 'Submitting...';
    status.style.color = '#6E7191';

    try {
      const res  = await fetch(apiUrl('/api/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind:        'room',
          slotKey:     this._claimTargetSlot,
          displayName: name,
          uid:         this.playerUid ?? null,
          sessionId:   this.colyseusRoom?.sessionId ?? null,
          code,
          meta,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.errors ? data.errors.join('\n') : (data.error ?? 'Submission failed');
        status.textContent = msg;
        status.style.color = '#B5401F';
        btn.disabled = false;
      } else {
        const successMsg = this._claimIsUpdate
          ? '✓ Update submitted! You\'ll be notified in-game when the admin approves your update.'
          : '✓ Submitted! The admin will review your world. You\'ll be notified in-game when it\'s approved.';
        status.textContent = successMsg;
        status.style.color = '#2EC4B6';
        setTimeout(() => this._closeClaimOverlay(), 4000);
      }
    } catch (e) {
      status.textContent = `Network error: ${e.message}`;
      status.style.color = '#B5401F';
      btn.disabled = false;
    }
  }

  // ── Toast notification ─────────────────────────────────────────────────────
  _showToast(message, type = 'info') {
    const colors = {
      approved: { bg: '#DCF7F1', border: '#0f7a6c', text: '#0f7a6c' },
      rejected: { bg: '#FFE3D8', border: '#B5401F', text: '#B5401F' },
      info:     { bg: '#FFFFFF', border: '#F0E4C8', text: '#2D3047' },
    };
    const c = colors[type] ?? colors.info;
    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%)',
      'z-index:9998;padding:0.75rem 1.5rem;border-radius:8px',
      `background:${c.bg};border:1px solid ${c.border};color:${c.text}`,
      "font-size:0.9rem;font-family:'Nunito',system-ui,sans-serif;font-weight:600",
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
      'padding:0.4rem 0.9rem;background:rgba(255,255,255,0.85);color:#2D3047',
      'border:1px solid #F0E4C8;border-radius:6px;cursor:pointer',
      "font-family:'Nunito',system-ui,sans-serif;font-size:0.78rem;font-weight:600",
    ].join(';');
    el.onclick = () => signOutUser();
    document.body.appendChild(el);
    this._signOutBtnEl = el;
  }

  _destroySignOutButton() {
    if (this._signOutBtnEl) { this._signOutBtnEl.remove(); this._signOutBtnEl = null; }
  }

  // ── Profile (Phase 16) ──────────────────────────────────────────────────────
  // Opens ProfileScene on top of a merely-paused WorldScene — never
  // scene.start(), which would stop WorldScene and drop the live Colyseus
  // connection. Same launch/pause technique already used for GameScene on
  // top of a paused RoomScene (Phase 15).
  _createProfileButton() {
    const el = document.createElement('button');
    el.textContent = 'My Profile';
    el.style.cssText = [
      'position:fixed;top:1rem;right:6.2rem;z-index:9997',
      'padding:0.4rem 0.9rem;background:rgba(255,255,255,0.85);color:#2D3047',
      'border:1px solid #F0E4C8;border-radius:6px;cursor:pointer',
      "font-family:'Nunito',system-ui,sans-serif;font-size:0.78rem;font-weight:600",
    ].join(';');
    el.onclick = () => this._openProfile(this.playerUid);
    document.body.appendChild(el);
    this._profileBtnEl = el;
  }

  _destroyProfileButton() {
    if (this._profileBtnEl) { this._profileBtnEl.remove(); this._profileBtnEl = null; }
  }

  // Shared entry point for both "My Profile" and viewing another player
  // (sprite click / Players Online sidebar) — always launches ProfileScene
  // as an overlay on top of a paused WorldScene, describing the viewer's
  // own identity separately from whichever uid is being viewed (see
  // ProfileScene.js's top-of-file comment for why those stay separate).
  _openProfile(targetUid) {
    if (!targetUid) return;
    this.scene.pause('WorldScene');
    this.scene.launch('ProfileScene', {
      self: {
        uid: this.playerUid, displayName: this.playerName,
        photoURL: this.playerPhotoURL, characterConfig: this.playerCharacterConfig,
      },
      targetUid, entryMode: 'overlay',
    });
  }

  // ── Players Online sidebar (Phase 16) ───────────────────────────────────────
  // Cross-room roster — reaches players who are connected but not
  // physically co-present (e.g. inside an active in-person session, which
  // is deliberately isolated from the main world). Sprite/nametag clicks
  // cover the co-present case; this covers everyone else.
  _createPlayersOnlineSidebar() {
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Players Online';
    toggleBtn.style.cssText = [
      'position:fixed;top:1rem;right:1rem;z-index:9997;margin-top:2.2rem',
      'padding:0.4rem 0.9rem;background:rgba(255,255,255,0.85);color:#2D3047',
      'border:1px solid #F0E4C8;border-radius:6px;cursor:pointer',
      "font-family:'Nunito',system-ui,sans-serif;font-size:0.78rem;font-weight:600",
    ].join(';');
    document.body.appendChild(toggleBtn);
    this._playersOnlineBtnEl = toggleBtn;

    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed;top:5.4rem;right:1rem;z-index:9997;display:none',
      'width:220px;max-height:60vh;overflow-y:auto',
      'background:rgba(255,255,255,0.95);border:1px solid #F0E4C8;border-radius:6px;padding:0.6rem',
      "font-family:'Nunito',system-ui,sans-serif;font-size:0.78rem;color:#2D3047",
    ].join(';');
    document.body.appendChild(panel);
    this._playersOnlinePanelEl = panel;

    toggleBtn.onclick = () => {
      const opening = panel.style.display === 'none';
      panel.style.display = opening ? 'block' : 'none';
      if (opening) this._refreshPlayersOnline();
    };
  }

  async _refreshPlayersOnline() {
    const panel = this._playersOnlinePanelEl;
    if (!panel) return;
    panel.textContent = 'Loading...';
    try {
      const res  = await fetch(apiUrl('/api/players/online'));
      const data = await res.json();
      const players = data.players ?? [];
      panel.innerHTML = '';
      if (players.length === 0) {
        panel.innerHTML = '<div style="color:#6E7191;font-style:italic">No one else online.</div>';
        return;
      }
      for (const p of players) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.4rem;padding:0.3rem 0.2rem;cursor:pointer;border-radius:4px';
        row.onmouseenter = () => row.style.background = 'rgba(240,228,200,0.6)';
        row.onmouseleave = () => row.style.background = 'transparent';
        const name = document.createElement('span');
        name.textContent = p.name || 'Player';
        row.appendChild(name);
        if (p.context === 'session') {
          const badge = document.createElement('span');
          badge.textContent = 'In-Person Session';
          badge.style.cssText = 'background:#FFE8DE;color:#C2410C;padding:0.1rem 0.4rem;border-radius:999px;font-size:0.65rem;font-weight:700;white-space:nowrap';
          row.appendChild(badge);
        }
        row.onclick = () => this._openProfile(p.uid);
        panel.appendChild(row);
      }
    } catch (e) {
      panel.innerHTML = '<div style="color:#B5401F">Could not load players.</div>';
    }
  }

  _destroyPlayersOnlineSidebar() {
    if (this._playersOnlineBtnEl)   { this._playersOnlineBtnEl.remove();   this._playersOnlineBtnEl = null; }
    if (this._playersOnlinePanelEl) { this._playersOnlinePanelEl.remove(); this._playersOnlinePanelEl = null; }
  }

  // ── World-creation prompts (shown inside the claim overlay) ────────────────
  // Previously lived on a standalone town-square signpost/notice-board the
  // player had to walk to separately; folded into the claim overlay itself
  // (see _createClaimOverlay) so the instructions are right there when you
  // press [E] on an unclaimed portal. The optional mini-game prompt is
  // deliberately NOT included here — that one lives with [G] in RoomScene.js.
  _claimPrompts() {
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

    return { design: PROMPT1, exportTemplate: PROMPT2 };
  }
}
