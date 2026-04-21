// GameScene.js — Mini-game overlay, launched on top of RoomScene.
// The world stays visible and paused underneath (Club Penguin style).
//
// Lifecycle:
//   init()    — receives the game module from RoomScene
//   preload() — calls gameModule.onGameLoad(scene)
//   create()  — builds the panel UI, then calls GameLoader.loadGame()
//   update()  — runs gameModule.onGameUpdate(scene) each frame
//
// scene.exitGame() is exposed on the scene instance so game hooks can call it.
// It calls onGameExit, stops this scene, and resumes RoomScene.

import Phaser from 'phaser';
import { loadGame } from '../room-loader/GameLoader.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this._gameModule = data?.game ?? null;
    this._gameUpdate = null;
    this._exited     = false;
  }

  preload() {
    if (!this._gameModule) return;
    try {
      this._gameModule.onGameLoad(this);
    } catch (err) {
      console.error('[GameScene] onGameLoad threw:', err);
    }
  }

  create() {
    // ── Panel backdrop ────────────────────────────────────────────────────────
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.72).setDepth(0);
    this.add.rectangle(400, 310, 780, 560, 0x0d0d1a).setDepth(1);

    // Border
    const border = this.add.graphics().setDepth(2);
    border.lineStyle(2, 0x8B5CF6, 0.9);
    border.strokeRect(12, 28, 776, 556);

    // Divider below header
    const div = this.add.graphics().setDepth(2);
    div.lineStyle(1, 0x8B5CF6, 0.35);
    div.lineBetween(12, 62, 788, 62);

    // ── Close button ──────────────────────────────────────────────────────────
    const closeBg = this.add.rectangle(754, 44, 76, 28, 0x2a1a4a)
      .setDepth(10).setInteractive({ useHandCursor: true });
    this.add.text(754, 44, '✕  Close', {
      fontSize: '13px', fill: '#aa99dd', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(11);
    closeBg.on('pointerover', () => closeBg.setFillStyle(0x5533aa));
    closeBg.on('pointerout',  () => closeBg.setFillStyle(0x2a1a4a));
    closeBg.on('pointerdown', () => this.exitGame());

    // ESC also closes
    this.input.keyboard.on('keydown-ESC', () => this.exitGame());

    // ── exitGame — exposed so game hooks can call scene.exitGame() ────────────
    this.exitGame = () => {
      if (this._exited) return;
      this._exited = true;
      try { this._gameModule?.onGameExit(this); } catch (err) {
        console.error('[GameScene] onGameExit threw:', err);
      }
      this.scene.stop();
      this.scene.resume('RoomScene');
    };

    // ── Load game ─────────────────────────────────────────────────────────────
    if (!this._gameModule) {
      this._showError('No game module provided.');
      return;
    }

    const ok = loadGame(this._gameModule, this);
    if (ok) {
      this._gameUpdate = () => {
        try { this._gameModule.onGameUpdate(this); } catch (err) {
          console.error('[GameScene] onGameUpdate threw:', err);
          this._gameUpdate = null; // stop calling broken hook
        }
      };
    }
  }

  update() {
    if (this._gameUpdate) this._gameUpdate();
  }

  _showError(msg) {
    this.add.text(400, 310, msg, {
      fontSize: '14px', fill: '#ff6666', align: 'center',
    }).setOrigin(0.5).setDepth(12);
  }
}
