// CharacterScene.js — forced lobby for new players: design a character via a
// Gemini-generated shape-recipe JSON before entering the world. LoginScene
// only routes here when the signed-in account has no saved characterConfig
// yet; players who already have one go straight to WorldScene.
//
// The live preview renders through the exact same CharacterRenderer used by
// WorldScene/RoomScene, and runs the shared idle/walk/flip animation on an
// auto-demo loop (no input needed) so every animation state is visible
// before the player ever saves.
import Phaser from 'phaser';
import { createCharacter, updateCharacter } from './CharacterRenderer.js';
import { getFreshIdToken } from '../auth/session.js';

const PREVIEW_X = 610;
const PREVIEW_Y = 360;

const DEFAULT_CONFIG = {
  shapes: [
    { type: 'rect',   x: -12, y: -25, w: 24, h: 30, color: '#1e3a8a' },
    { type: 'circle', x: 0,   y: -38, r: 12,          color: '#ffdbac' },
    { type: 'circle', x: -4,  y: -40, r: 2,           color: '#222222' },
    { type: 'circle', x: 4,   y: -40, r: 2,           color: '#222222' },
  ],
  scale: 1.0,
};

const CHARACTER_PROMPT =
  "I want you to design a simple 2D game character made only of flat-colored rectangles and circles — no images, no gradients.\n" +
  "\n" +
  "First ask me what I want the character to look like, or suggest a few fun ideas. Once we agree on a design, output it as JSON.\n" +
  "\n" +
  "RULES for the JSON:\n" +
  "  ✅ Output ONLY a single JSON object as your final answer — no explanation, no code fences, nothing else\n" +
  "  ✅ Shape: { \"type\": \"rect\"|\"circle\", \"x\": number, \"y\": number, \"color\": \"#rrggbb\" }\n" +
  "       - \"rect\" also needs \"w\" and \"h\" (width, height)\n" +
  "       - \"circle\" also needs \"r\" (radius)\n" +
  "  ✅ x/y are relative to the character's center at (0, 0). Roughly: y from -45 (top of head) to +20 (feet), x from -20 (left) to +20 (right)\n" +
  "  ✅ List shapes in draw order — later shapes are drawn on top of earlier ones (e.g. draw the head before the eyes)\n" +
  "  ✅ Up to 20 shapes total\n" +
  "  ✅ \"scale\": a number between 0.8 and 1.3 (1.0 is normal size)\n" +
  "  ❌ No other shape types, no gradients, no images, no animation fields — just flat rectangles and circles\n" +
  "\n" +
  "EXAMPLE (a simple person):\n" +
  JSON.stringify(DEFAULT_CONFIG, null, 2) +
  "\n\n" +
  "Once I say the design looks good, output the final JSON as a single code block — ONLY the JSON object, nothing else.";

// Auto-demo loop: idle -> walk right -> idle -> walk left -> idle, repeating
// forever with no input needed, so a player sees the idle bob, walk-cycle,
// and direction flip before ever saving.
const DEMO_STEPS = [
  { dir: 0,  duration: 1400 },
  { dir: 1,  duration: 1200 },
  { dir: 0,  duration: 400  },
  { dir: -1, duration: 1200 },
  { dir: 0,  duration: 400  },
];
const DEMO_SPEED = 0.035; // px per ms

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default class CharacterScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterScene' });
  }

  init(data) {
    this._uid         = data?.uid ?? null;
    this._displayName = data?.displayName ?? 'Player';
    this._photoURL    = data?.photoURL ?? null;
    this._previewContainer = null;
    this._demoIndex   = 0;
    this._demoElapsed = 0;
    this._overlayEl   = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Simple pedestal glow behind the preview — same "colored shapes only"
    // visual language as the rest of the engine, no art asset needed.
    this.add.circle(PREVIEW_X, PREVIEW_Y + 30, 60, 0x2a4a7f, 0.35);
    this.add.text(PREVIEW_X, PREVIEW_Y - 90, 'LIVE PREVIEW', {
      fontSize: '13px', fill: '#88ccff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this._createOverlay();
    this.events.once('shutdown', () => this._destroyOverlay());
  }

  update(time, delta) {
    if (this._previewContainer) this._runDemo(delta);
  }

  _runDemo(delta) {
    const step = DEMO_STEPS[this._demoIndex];
    this._demoElapsed += delta;
    if (this._demoElapsed >= step.duration) {
      this._demoElapsed = 0;
      this._demoIndex = (this._demoIndex + 1) % DEMO_STEPS.length;
    }
    const moving = step.dir !== 0;
    if (moving) this._previewContainer.x += step.dir * DEMO_SPEED * delta;
    updateCharacter(this._previewContainer, { moving, facingX: step.dir || undefined, delta });
  }

  // ── DOM overlay (form) ───────────────────────────────────────────────────
  _createOverlay() {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:stretch',
      'font-family:system-ui,sans-serif',
    ].join(';');
    el.innerHTML = `
      <div style="width:440px;max-width:60vw;background:#16213e;border-right:1px solid #2a4a7f;padding:1.75rem;overflow-y:auto;box-sizing:border-box">
        <h1 style="color:#f4a261;margin:0 0 0.35rem;font-size:1.2rem">Design Your Character</h1>
        <p style="color:#888;font-size:0.8rem;margin-bottom:1.25rem">Welcome, ${escHtml(this._displayName)}! Before you enter the town square, design how you'll look to everyone else.</p>

        <ol style="color:#ccc;font-size:0.78rem;line-height:1.6;padding-left:1.1rem;margin-bottom:1rem">
          <li>Copy the prompt below into <strong style="color:#88ccff">gemini.google.com</strong></li>
          <li>Describe the character you want in your own words</li>
          <li>Paste Gemini's final JSON into the box below</li>
          <li>Check the live preview on the right, then Save</li>
        </ol>

        <button id="woc-char-copy" style="width:100%;padding:0.5rem;margin-bottom:1rem;background:#1a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.8rem">📋 Copy Character Prompt</button>

        <label style="display:block;margin-bottom:0.75rem">
          <span style="display:block;color:#aaa;font-size:0.8rem;margin-bottom:0.3rem">Character JSON (paste from Gemini)</span>
          <textarea id="woc-char-json" placeholder='{ "shapes": [...], "scale": 1.0 }'
            style="width:100%;height:160px;padding:0.5rem 0.75rem;background:#0a2040;border:1px solid #1a4a7f;border-radius:4px;color:#e0e0e0;font-size:0.76rem;font-family:'Courier New',monospace;resize:vertical;box-sizing:border-box;outline:none"></textarea>
        </label>

        <div id="woc-char-status" style="margin-bottom:0.75rem;font-size:0.8rem;min-height:1.2rem;white-space:pre-wrap"></div>

        <div style="display:flex;gap:0.75rem">
          <button id="woc-char-preview" style="flex:1;padding:0.55rem;background:#2a4a7f;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.85rem">Update Preview</button>
          <button id="woc-char-save" style="flex:1;padding:0.55rem;background:#f4a261;color:#1a1a2e;border:none;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.85rem">Save &amp; Enter World</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._overlayEl = el;

    document.getElementById('woc-char-copy').onclick    = () => this._copyPrompt();
    document.getElementById('woc-char-preview').onclick = () => this._updatePreviewFromInput();
    document.getElementById('woc-char-save').onclick    = () => this._save();

    // Seed with a friendly default so the preview is never empty.
    document.getElementById('woc-char-json').value = JSON.stringify(DEFAULT_CONFIG, null, 2);
    this._updatePreviewFromInput();
  }

  _copyPrompt() {
    const btn = document.getElementById('woc-char-copy');
    navigator.clipboard.writeText(CHARACTER_PROMPT)
      .then(() => {
        btn.textContent = '✓ Copied!';
        setTimeout(() => { if (this._overlayEl) btn.textContent = '📋 Copy Character Prompt'; }, 1800);
      })
      .catch(() => { btn.textContent = 'Copy failed — select the text manually'; });
  }

  _updatePreviewFromInput() {
    const raw    = document.getElementById('woc-char-json').value;
    const status = document.getElementById('woc-char-status');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      status.textContent = 'Not valid JSON yet — check for a missing comma or bracket.';
      status.style.color = '#e07a7a';
      return;
    }
    status.textContent = '';
    this._setPreviewConfig(parsed);
  }

  _setPreviewConfig(rawConfig) {
    if (this._previewContainer) this._previewContainer.destroy();
    this._previewContainer = createCharacter(this, rawConfig, PREVIEW_X, PREVIEW_Y);
    this._demoIndex   = 0;
    this._demoElapsed = 0;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async _save() {
    const raw    = document.getElementById('woc-char-json').value;
    const status = document.getElementById('woc-char-status');
    const btn    = document.getElementById('woc-char-save');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      status.textContent = 'Fix the JSON before saving.';
      status.style.color = '#e07a7a';
      return;
    }

    btn.disabled = true;
    status.textContent = 'Saving...';
    status.style.color = '#aaa';

    try {
      const idToken = await getFreshIdToken();
      const res  = await fetch('/api/auth/save-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, config: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      this._destroyOverlay();
      // Pass the server's sanitized config forward rather than re-fetching —
      // it's the exact same object other players will get back from
      // /api/character/:uid, so ProfileScene/WorldScene render it
      // identically either way. Lands on ProfileScene first (Phase 16),
      // not straight into WorldScene.
      const self = {
        uid: this._uid, displayName: this._displayName, photoURL: this._photoURL,
        characterConfig: data.characterConfig,
      };
      this.scene.start('ProfileScene', { self, targetUid: this._uid, entryMode: 'landing' });
    } catch (e) {
      status.textContent = e.message ?? 'Save failed. Please try again.';
      status.style.color = '#e07a7a';
      btn.disabled = false;
    }
  }

  _destroyOverlay() {
    if (this._overlayEl) { this._overlayEl.remove(); this._overlayEl = null; }
  }
}
