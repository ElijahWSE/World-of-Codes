// LoginScene.js — Google Sign-In gate. Every player must sign in here before
// entering WorldScene; this is the one entry point into the multiplayer world.
import Phaser from 'phaser';
import { signInWithGoogle } from '../auth/googleAuth.js';
import { getFreshIdToken } from '../auth/session.js';
import { apiUrl } from './serverUrl.js';

export default class LoginScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoginScene' });
    this._overlayEl = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#FFF6E4');
    this._createOverlay();

    this.events.once('shutdown', () => this._destroyOverlay());
  }

  _createOverlay() {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:#FFF6E4',
    ].join(';');
    el.innerHTML = `
      <div style="background:#ffffff;border:1px solid #F0E4C8;border-radius:12px;padding:2.5rem;width:420px;max-width:92vw;font-family:'Nunito',system-ui,sans-serif;text-align:center;box-shadow:0 10px 28px -14px rgba(255,122,89,0.28)">
        <h1 style="font-family:'Lilita One',system-ui,sans-serif;color:#2D3047;margin:0 0 0.5rem;font-size:1.8rem;font-weight:400">ImpactGround</h1>
        <p style="color:#6E7191;font-size:0.85rem;margin-bottom:1.75rem">Sign in with Google to enter the town square.</p>
        <button id="woc-login-btn" style="padding:0.65rem 1.5rem;background:#FF7A59;color:#ffffff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:0.95rem;width:100%;box-shadow:0 4px 12px -4px rgba(255,122,89,0.55)">Sign in with Google</button>
        <div id="woc-login-status" style="margin-top:1rem;font-size:0.82rem;min-height:1.2rem"></div>
      </div>`;
    document.body.appendChild(el);
    this._overlayEl = el;
    document.getElementById('woc-login-btn').onclick = () => this._handleSignIn();
  }

  async _handleSignIn() {
    const btn    = document.getElementById('woc-login-btn');
    const status = document.getElementById('woc-login-status');
    btn.disabled = true;
    status.style.color = '#6E7191';
    status.textContent = 'Opening Google sign-in...';

    try {
      await signInWithGoogle();
      const idToken = await getFreshIdToken();
      status.textContent = 'Verifying...';
      const res  = await fetch(apiUrl('/api/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Verification failed');

      this._destroyOverlay();
      // Players with no saved character go through CharacterScene first —
      // a profile needs a character to show. Everyone else (new, right
      // after CharacterScene, or returning) lands on ProfileScene before
      // the world (Phase 16).
      if (!data.characterConfig) {
        this.scene.start('CharacterScene', {
          uid: data.uid, displayName: data.displayName, photoURL: data.photoURL,
        });
        return;
      }
      const self = { uid: data.uid, displayName: data.displayName, photoURL: data.photoURL, characterConfig: data.characterConfig };
      this.scene.start('ProfileScene', { self, targetUid: data.uid, entryMode: 'landing' });
    } catch (e) {
      status.style.color = '#B5401F';
      status.textContent = e.message ?? 'Sign-in failed. Please try again.';
      btn.disabled = false;
    }
  }

  _destroyOverlay() {
    if (this._overlayEl) { this._overlayEl.remove(); this._overlayEl = null; }
  }
}
