// main.js — Phaser bootstrap
// Boots the Phaser game instance and registers all scenes.
// This is the single entry point for the entire game engine.
// New scenes (e.g. RoomScene added in Phase 4) are registered here.

import Phaser from 'phaser';
import WorldScene from './WorldScene.js';

const config = {
  type: Phaser.AUTO,          // Use WebGL if available, fall back to Canvas
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e', // Dark navy — matches the town square aesthetic
  parent: document.body,      // Phaser appends the canvas directly to <body>

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },      // Top-down game — no gravity
      debug: false             // Set to true temporarily to see collision boxes
    }
  },

  // Scene list — order matters: first scene auto-starts on boot.
  // FUTURE: Add RoomScene here in Phase 4.
  scene: [WorldScene]
};

// Boot the game. Phaser attaches the canvas to `config.parent`.
new Phaser.Game(config);
