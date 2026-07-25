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
    // The main game canvas is RESIZE-scaled to fill the whole browser window
    // (see main.js), but mini-games are authored assuming a fixed 800x600
    // screen (COORDINATE SPACE: x 0-800, y 65-590 in the room-building
    // prompt). Pin this scene's own camera to a centered 800x600 box so
    // student game code's literal pixel coordinates stay correct no matter
    // how big the real canvas is.
    this._fitViewport();
    this.scale.on('resize', this._fitViewport, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._fitViewport, this));

    // ── Panel backdrop (negative depth so game content at depth 0 renders above) ─
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.72).setDepth(-2);
    this.add.rectangle(400, 310, 780, 560, 0x0d0d1a).setDepth(-1);

    // Border and divider sit on top of game content as a permanent frame
    const border = this.add.graphics().setDepth(50);
    border.lineStyle(2, 0x8B5CF6, 0.9);
    border.strokeRect(12, 28, 776, 556);

    // Divider below header
    const div = this.add.graphics().setDepth(50);
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

  _fitViewport() {
    const x = Math.round((this.scale.width  - 800) / 2);
    const y = Math.round((this.scale.height - 600) / 2);
    this.cameras.main.setViewport(x, y, 800, 600);
  }

  _showError(msg) {
    this.add.text(400, 310, msg, {
      fontSize: '14px', fill: '#ff6666', align: 'center',
    }).setOrigin(0.5).setDepth(12);
  }
}
