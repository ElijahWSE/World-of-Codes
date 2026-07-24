// ProfileScene.js — Phase 16: a player's profile — live idle-bobbing
// character, their creations, Creative Process Log(s), and feedback
// received. Follows CharacterScene.js's hybrid pattern: a Phaser-rendered
// character preview alongside a DOM overlay for everything else, so the
// exact same CharacterRenderer used everywhere else in the engine renders
// the character here too.
//
// Layout (2026-07-24, adapted from a mobile-RPG character-profile screen
// the owner referenced — same structural language, not the art style: a
// large hero character on the left standing in a ground-glow spotlight,
// a translucent panel anchored to the right with tabs + clean label:value
// rows, and one prominent action button sticky at the bottom of that
// panel) — not the always-visible stacked sections the first draft used.
//
// Two very different entry points, distinguished by `entryMode`:
//   'landing' — reached straight from LoginScene/CharacterScene, before the
//               player has ever joined the Colyseus world. Always self.
//               "Enter World" starts a fresh WorldScene join.
//   'overlay' — reached from inside the world (HUD button, clicking another
//               player's sprite, the Players Online sidebar). WorldScene is
//               merely paused (scene.pause + scene.launch), never stopped,
//               so the live Colyseus connection survives untouched — same
//               technique already used for GameScene launched on top of a
//               paused RoomScene (Phase 15). "Back" just resumes it.
//
// The character preview and every panel always describe the *target*
// profile (`data.targetUid`, fetched fresh from /api/profile/:uid) — but
// the Enter World / Back button always acts on the *viewer's own* identity
// (`data.self`), never the profile being viewed. Those are deliberately
// kept as two separate objects below, not merged.
import Phaser from 'phaser';
import { createCharacter, updateCharacter } from './CharacterRenderer.js';

// Left-of-panel, in Phaser's internal 800x600 space — the DOM panel below
// covers the right ~440 real px, so this is centered in what's roughly the
// *remaining* visible canvas width once that's accounted for (the canvas
// itself gets scaled/letterboxed to the real viewport, same imprecise but
// good-enough proportional-placement approach CharacterScene already uses).
const PREVIEW_X = 280;
const PREVIEW_Y = 380;
const PREVIEW_SCALE = 2.4; // hero-sized — well above the ~32px in-world character

const TABS = [
  { key: 'creations', label: 'Creations' },
  { key: 'log',       label: 'Process Log' },
  { key: 'feedback',  label: 'Feedback' },
];

const ABOUT_META = {
  room:   { label: 'Room',   bg: '#1a3060', fg: '#8ab4f8' },
  game:   { label: 'Game',   bg: '#3a1f4d', fg: '#c39bd3' },
  music:  { label: 'Music',  bg: '#123d2c', fg: '#6fcf97' },
  object: { label: 'Object', bg: '#4a2f10', fg: '#f4a261' },
};

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
}

// A muted-label/white-value row, closest DOM equivalent of the reference's
// "Race · Members" / "Birthday · 9/26" data rows.
function dataRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:1rem;padding:0.55rem 0;border-bottom:1px solid #1a2e4d">
    <span style="color:#7a8cad;font-size:0.78rem">${escHtml(label)}</span>
    <span style="color:#e0e0e0;font-size:0.85rem;text-align:right">${value}</span>
  </div>`;
}

export default class ProfileScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ProfileScene' });
  }

  init(data) {
    // The viewer's own identity — always present, used only for the
    // Enter World / Back action and to decide isSelf, never for rendering
    // the profile's own panels.
    this._self = {
      uid: data?.self?.uid ?? null,
      displayName: data?.self?.displayName ?? 'Player',
      photoURL: data?.self?.photoURL ?? null,
      characterConfig: data?.self?.characterConfig ?? null,
    };
    this._targetUid = data?.targetUid ?? this._self.uid;
    this._isSelf    = this._targetUid === this._self.uid;
    this._entryMode = data?.entryMode ?? 'landing'; // 'landing' | 'overlay'
    this._activeTab = 'creations';

    this._previewContainer = null;
    this._overlayEl = null;
    this._profile = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#141428');
    // A flat contact shadow under the character's feet, not a full halo —
    // Phaser's basic shapes have hard edges, so a big circular "glow"
    // reads as a visible ring/bullseye rather than a soft light. A low,
    // flattened shadow ellipse avoids that while still grounding the
    // character on a "stage" the way the reference's spotlight does.
    this.add.ellipse(PREVIEW_X, PREVIEW_Y + 48, 190, 46, 0x000000, 0.32).setDepth(0);

    // Defensive cleanup for a scene that can be launched/stopped repeatedly
    // within one page load (unlike Login/CharacterScene, which only ever
    // run once) — see PROJECT_BRIEF.md's Phase 12 note on stale overlay
    // DOM nodes silently surviving a scene re-entry.
    document.getElementById('woc-profile-overlay')?.remove();
    this._createOverlay();
    this.events.once('shutdown', () => this._destroyOverlay());

    // Self's own character is already known client-side — paint it
    // immediately rather than waiting on a redundant fetch. A foreign
    // profile waits for /api/profile/:uid to resolve below.
    if (this._isSelf) this._setPreviewConfig(this._self.characterConfig);

    this._loadProfile();
  }

  update(time, delta) {
    if (this._previewContainer) updateCharacter(this._previewContainer, { moving: false, facingX: 0, delta });
  }

  _setPreviewConfig(config) {
    if (this._previewContainer) this._previewContainer.destroy();
    this._previewContainer = createCharacter(this, config, PREVIEW_X, PREVIEW_Y).setDepth(1).setScale(PREVIEW_SCALE);
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  async _loadProfile() {
    const statusEl = document.getElementById('woc-profile-status');
    try {
      const url = `/api/profile/${encodeURIComponent(this._targetUid)}` +
        (this._self.uid ? `?viewerUid=${encodeURIComponent(this._self.uid)}` : '');
      const res  = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load profile');
      this._profile = data;
      statusEl.textContent = '';
      this._render();
    } catch (e) {
      statusEl.textContent = e.message ?? 'Could not load profile.';
      statusEl.style.color = '#e07a7a';
    }
  }

  _render() {
    const p = this._profile;
    document.getElementById('woc-profile-name').textContent = p.displayName;

    const photoEl = document.getElementById('woc-profile-photo');
    if (p.photoURL) { photoEl.src = p.photoURL; photoEl.style.display = 'block'; }
    else photoEl.style.display = 'none';

    if (!this._isSelf) this._setPreviewConfig(p.characterConfig);

    const tabsEl = document.getElementById('woc-profile-tabs');
    const bodyEl = document.getElementById('woc-profile-body');
    if (p.hidden) {
      document.getElementById('woc-profile-subtitle').textContent = '';
      tabsEl.style.display = 'none';
      bodyEl.innerHTML = '<p style="color:#888;font-style:italic;margin-top:1rem">This profile is hidden.</p>';
      return;
    }

    const tagCount = p.rooms.length + p.objects.length;
    document.getElementById('woc-profile-subtitle').textContent =
      `${tagCount} creation${tagCount === 1 ? '' : 's'}`;

    this._renderTabs();
    this._renderCreations(p);
    this._renderProcessLogs(p);
    this._renderFeedback(p);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  _renderTabs() {
    const tabsEl = document.getElementById('woc-profile-tabs');
    tabsEl.style.display = 'flex';
    tabsEl.innerHTML = TABS.map(t => {
      const active = this._activeTab === t.key;
      return `<button data-tab="${t.key}" style="flex:1;padding:0.55rem 0.25rem;background:transparent;border:none;border-bottom:2px solid ${active ? '#f4a261' : 'transparent'};color:${active ? '#f4a261' : '#7a8cad'};font-weight:700;font-size:0.8rem;cursor:pointer;font-family:inherit">${t.label}</button>`;
    }).join('');
    tabsEl.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => { this._activeTab = btn.dataset.tab; this._renderTabs(); this._switchPane(); };
    });
    this._switchPane();
  }

  _switchPane() {
    for (const t of TABS) {
      const pane = document.getElementById(`woc-profile-pane-${t.key}`);
      if (pane) pane.style.display = this._activeTab === t.key ? 'block' : 'none';
    }
  }

  _renderCreations({ rooms, objects }) {
    const el = document.getElementById('woc-profile-pane-creations');
    if (rooms.length === 0 && objects.length === 0) {
      el.innerHTML = '<p style="color:#666;font-style:italic;font-size:0.85rem">No creations yet.</p>';
      return;
    }
    const rows = [];
    for (const r of rooms) {
      const tags = ['Room'];
      if (r.gameFileName) tags.push('Game');
      if (r.musicFileName) tags.push('Music');
      rows.push(dataRow(tags.join(' + '), `<strong>${escHtml(r.roomName)}</strong>`));
    }
    for (const o of objects) {
      rows.push(dataRow('Interactive Object', formatDate(o.createdAt)));
    }
    el.innerHTML = rows.join('');
  }

  _renderProcessLogs({ rooms, processLogs }) {
    const el = document.getElementById('woc-profile-pane-log');
    if (processLogs.length === 0) {
      el.innerHTML = '<p style="color:#666;font-style:italic;font-size:0.85rem">Nothing written yet.</p>';
      return;
    }
    el.innerHTML = processLogs.map(log => {
      const roomName = rooms.find(r => r.slotKey === log.slotKey)?.roomName ?? 'Room';
      const field = (label, val) => `<div style="margin-bottom:0.6rem"><span style="color:#7a8cad;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em">${label}</span><p style="color:#ccc;font-size:0.82rem;margin:0.2rem 0 0;white-space:pre-wrap">${escHtml(val) || '<span style="color:#555;font-style:italic">(Nothing written)</span>'}</p></div>`;
      return `<div style="margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid #1a2e4d">
        ${rooms.length > 1 ? `<strong style="color:#e0e0e0;font-size:0.8rem;display:block;margin-bottom:0.4rem">${escHtml(roomName)}</strong>` : ''}
        ${field('Past', log.past)}${field('Present', log.present)}${field('Future', log.future)}
      </div>`;
    }).join('');
  }

  _renderFeedback({ rooms, feedback }) {
    const el = document.getElementById('woc-profile-pane-feedback');
    const visible = feedback.filter(f => !f.archived);
    if (visible.length === 0) {
      el.innerHTML = '<p style="color:#666;font-style:italic;font-size:0.85rem">No feedback yet.</p>';
      return;
    }
    el.innerHTML = visible.map(entry => {
      const meta = entry.about && ABOUT_META[entry.about] ? ABOUT_META[entry.about] : null;
      const who = entry.source === 'online' ? (entry.authorName || 'A player') : 'Self-recorded (creator)';
      // Only distinguish by room when the player owns more than one —
      // with a single room it's implied and would just be noise.
      const roomName = rooms.length > 1 ? rooms.find(r => r.slotKey === entry.slotKey)?.roomName : null;
      return `<div style="padding:0.75rem 0;border-bottom:1px solid #1a2e4d">
        <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.35rem;font-size:0.75rem;color:#7a8cad">
          <span>${escHtml(who)}</span>
          ${meta ? `<span style="background:${meta.bg};color:${meta.fg};padding:0.1rem 0.55rem;border-radius:999px;font-size:0.68rem;font-weight:700">${meta.label}</span>` : ''}
          ${roomName ? `<span style="color:#5a6c8a">· ${escHtml(roomName)}</span>` : ''}
        </div>
        <p style="color:#ccc;font-size:0.82rem;margin:0 0 ${entry.response ? '0.4rem' : '0'};white-space:pre-wrap">${escHtml(entry.text)}</p>
        ${entry.response ? `<p style="color:#6fcf97;font-size:0.78rem;margin:0;white-space:pre-wrap">↳ ${escHtml(entry.response)}</p>` : ''}
      </div>`;
    }).join('');
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  _handlePrimaryAction() {
    if (this._entryMode === 'landing') {
      this.scene.start('WorldScene', {
        uid: this._self.uid, displayName: this._self.displayName,
        photoURL: this._self.photoURL, characterConfig: this._self.characterConfig,
      });
    } else {
      this.scene.resume('WorldScene');
      this.scene.stop();
    }
  }

  // ── DOM overlay ───────────────────────────────────────────────────────────
  // Right-anchored panel (character stands in the open canvas area to its
  // left) — header, tab bar, a scrollable tab-content area, and one
  // sticky primary action button pinned to the panel's bottom, mirroring
  // the reference's name/tabs-up-top + single-CTA-at-bottom composition.
  _createOverlay() {
    const el = document.createElement('div');
    el.id = 'woc-profile-overlay';
    el.style.cssText = [
      'position:fixed;top:0;right:0;bottom:0;z-index:9999',
      'width:440px;max-width:92vw;display:flex;flex-direction:column',
      'background:linear-gradient(180deg,#101c34ee,#0a1424f5);border-left:1px solid #2a4a7f',
      'font-family:system-ui,sans-serif;box-shadow:-8px 0 24px rgba(0,0,0,0.35)',
    ].join(';');
    const primaryLabel = this._entryMode === 'landing' ? 'Enter World' : 'Back';
    el.innerHTML = `
      <div style="padding:1.5rem 1.5rem 0;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.15rem">
          <img id="woc-profile-photo" style="width:44px;height:44px;border-radius:50%;display:none;border:2px solid #f4a261" />
          <h1 id="woc-profile-name" style="color:#f4a261;margin:0;font-size:1.2rem">Profile</h1>
        </div>
        <div id="woc-profile-subtitle" style="color:#7a8cad;font-size:0.78rem;margin-bottom:0.5rem;min-height:1.1em"></div>
        <div id="woc-profile-status" style="font-size:0.8rem;color:#aaa;margin-bottom:0.5rem"></div>
        <div id="woc-profile-tabs" style="display:none;border-bottom:1px solid #1a2e4d;margin-top:0.5rem"></div>
      </div>
      <div id="woc-profile-body" style="flex:1;overflow-y:auto;padding:0.75rem 1.5rem">
        <div id="woc-profile-pane-creations" style="display:none"></div>
        <div id="woc-profile-pane-log" style="display:none"></div>
        <div id="woc-profile-pane-feedback" style="display:none"></div>
      </div>
      <div style="padding:1rem 1.5rem;border-top:1px solid #1a2e4d;flex-shrink:0">
        <button id="woc-profile-primary" style="width:100%;padding:0.65rem;background:#f4a261;color:#1a1a2e;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:0.9rem">${primaryLabel}</button>
      </div>`;
    document.body.appendChild(el);
    this._overlayEl = el;
    document.getElementById('woc-profile-primary').onclick = () => this._handlePrimaryAction();
    document.getElementById('woc-profile-status').textContent = 'Loading...';
  }

  _destroyOverlay() {
    if (this._overlayEl) { this._overlayEl.remove(); this._overlayEl = null; }
    if (this._previewContainer) { this._previewContainer.destroy(); this._previewContainer = null; }
  }
}
