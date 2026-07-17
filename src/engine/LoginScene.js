// LoginScene.js — Google Sign-In gate. Every player must sign in here before
// entering WorldScene; this is the one entry point into the multiplayer world.
import Phaser from 'phaser';
import { signInWithGoogle } from '../auth/googleAuth.js';
import { getFreshIdToken } from '../auth/session.js';

export default class LoginScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoginScene' });
    this._overlayEl = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this._createOverlay();

    this.events.once('shutdown', () => this._destroyOverlay());
  }

  _createOverlay() {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9999',
      'display:flex;align-items:center;justify-content:center',
      'background:#1a1a2e',
    ].join(';');
    el.innerHTML = `
      <div style="background:#16213e;border:1px solid #2a4a7f;border-radius:12px;padding:2.5rem;width:420px;max-width:92vw;font-family:system-ui,sans-serif;text-align:center">
        <h1 style="color:#f4a261;margin:0 0 0.5rem;font-size:1.4rem">World of Codes</h1>
        <p style="color:#888;font-size:0.85rem;margin-bottom:1.75rem">Sign in with Google to enter the town square.</p>
        <button id="woc-login-btn" style="padding:0.65rem 1.5rem;background:#f4a261;color:#1a1a2e;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:0.95rem;width:100%">Sign in with Google</button>
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
    status.style.color = '#aaa';
    status.textContent = 'Opening Google sign-in...';

    try {
      await signInWithGoogle();
      const idToken = await getFreshIdToken();
      status.textContent = 'Verifying...';
      const res  = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Verification failed');

      this._destroyOverlay();
      const nextScene = data.characterConfig ? 'WorldScene' : 'CharacterScene';
      this.scene.start(nextScene, {
        uid: data.uid, displayName: data.displayName, photoURL: data.photoURL,
        characterConfig: data.characterConfig ?? null,
      });
    } catch (e) {
      status.style.color = '#e07a7a';
      status.textContent = e.message ?? 'Sign-in failed. Please try again.';
      btn.disabled = false;
    }
  }

  _destroyOverlay() {
    if (this._overlayEl) { this._overlayEl.remove(); this._overlayEl = null; }
  }
}
