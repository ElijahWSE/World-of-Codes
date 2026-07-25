// main.js — Phaser bootstrap
// Boots the Phaser game instance and registers all scenes.
// This is the single entry point for the entire game engine.
// New scenes (e.g. RoomScene added in Phase 4) are registered here.

import Phaser from 'phaser';
import LoginScene from './LoginScene.js';
import CharacterScene from './CharacterScene.js';
import ProfileScene from './ProfileScene.js';
import WorldScene from './WorldScene.js';
import RoomScene from './RoomScene.js';
import GameScene from './GameScene.js';

const config = {
  type: Phaser.AUTO,          // Use WebGL if available, fall back to Canvas
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e', // Dark navy — matches the town square aesthetic
  parent: 'game-container',   // Phaser appends the canvas into the full-viewport div in index.html

  scale: {
    // RESIZE: the canvas's actual pixel resolution matches the browser
    // window exactly, so WorldScene/RoomScene's camera (which just follows
    // the player through a world larger than any one screen) shows more of
    // the world at native scale — wider field of view, no upscale blur, no
    // letterbox bars. Rooms are authored in world-space (1600x1200,
    // scrolling camera) so they're unaffected. GameScene (student mini-games)
    // is the one exception — it draws in fixed 0-800/0-600 screen-space with
    // no scrolling camera, so it explicitly pins its own camera viewport to
    // a fixed centered 800x600 box (see GameScene.js) to keep working
    // regardless of the real canvas size.
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },      // Top-down game — no gravity
      debug: false             // Set to true temporarily to see collision boxes
    }
  },

  // Scene list — order matters: first scene auto-starts on boot.
  // LoginScene is first so every player must sign in before WorldScene is
  // reachable (Phase 9A). CharacterScene is launched programmatically by
  // LoginScene for players with no saved characterConfig yet (Phase 10).
  // ProfileScene is the default landing page after login/character
  // creation, and is also launched on top of a paused WorldScene for the
  // in-world "My Profile" / viewing-another-player flows (Phase 16).
  // RoomScene is launched programmatically when a player walks through a door.
  scene: [LoginScene, CharacterScene, ProfileScene, WorldScene, RoomScene, GameScene]
};

// Boot the game. Phaser attaches the canvas to `config.parent`.
new Phaser.Game(config);
