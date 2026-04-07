// RoomLoader.js — Validates and mounts player room modules into a Phaser scene.
//
// RESPONSIBILITIES:
//   - Validate that a room module exports all 5 required hooks with correct types
//   - Call onCreate once, wire onUpdate into the scene each frame
//   - Wrap every hook call in try/catch so a broken room never crashes the game
//   - Display a friendly in-game error message if anything goes wrong
//
// DOES NOT OWN:
//   - Scene transitions (handled by RoomScene)
//   - exitRoom logic (owned by RoomScene, exposed on scene before loadRoom is called)
//   - onLoad (called by RoomScene.preload() before this runs)
//
// HOW TO ADD A NEW ROOM:
//   1. Drop the room file into src/rooms/
//   2. Import it in WorldScene.js and add it to the DOORS array
//   That's it. No other files need to change.

// The exact hooks every room module must export.
// NEVER change these names — players generate code against this contract.
const REQUIRED_HOOKS = ['name', 'onLoad', 'onCreate', 'onUpdate', 'onExit'];

/**
 * Validates that a room module exports all required hooks with correct types.
 *
 * @param {object} roomModule - The imported room module (import * as room from '...')
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRoom(roomModule) {
  const errors = [];

  for (const hook of REQUIRED_HOOKS) {
    if (!(hook in roomModule)) {
      errors.push(`Missing export: "${hook}"`);
      continue;
    }
    if (hook === 'name') {
      if (typeof roomModule.name !== 'string') {
        errors.push(`"name" must be a string, got ${typeof roomModule.name}`);
      }
    } else {
      if (typeof roomModule[hook] !== 'function') {
        errors.push(`"${hook}" must be a function, got ${typeof roomModule[hook]}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Loads a validated room module into a Phaser scene.
 *
 * Expects scene.exitRoom to already be defined by RoomScene before this is called.
 * On success, sets scene._roomUpdate so RoomScene.update() can call it each frame.
 * On failure, renders a red error overlay and returns false.
 *
 * @param {object} roomModule - The imported room module
 * @param {Phaser.Scene} scene - The RoomScene instance
 * @returns {boolean} true if the room loaded successfully, false otherwise
 */
export function loadRoom(roomModule, scene) {
  // ── Validate ────────────────────────────────────────────────────────────────
  const { valid, errors } = validateRoom(roomModule);

  if (!valid) {
    console.error(`[RoomLoader] Room "${roomModule?.name ?? '(unknown)'}" failed validation:`);
    errors.forEach(e => console.error(`  ✗ ${e}`));
    _showError(scene, `Room failed validation:\n${errors.join('\n')}`);
    return false;
  }

  // ── onCreate ────────────────────────────────────────────────────────────────
  try {
    roomModule.onCreate(scene);
  } catch (err) {
    console.error('[RoomLoader] onCreate threw:', err);
    _showError(scene, `Room crashed in onCreate:\n${err.message}`);
    return false;
  }

  // ── Wire onUpdate ───────────────────────────────────────────────────────────
  // RoomScene.update() calls scene._roomUpdate() every frame.
  // Errors in onUpdate are logged but don't stop the game.
  scene._roomUpdate = () => {
    try {
      roomModule.onUpdate(scene);
    } catch (err) {
      console.error('[RoomLoader] onUpdate threw:', err);
    }
  };

  console.log(`[RoomLoader] Room "${roomModule.name}" loaded successfully.`);
  return true;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Renders a red error overlay fixed to the screen.
 * The back button in RoomScene is always available to dismiss it.
 */
function _showError(scene, message) {
  // Semi-transparent dark panel
  scene.add.rectangle(400, 320, 640, 200, 0x000000, 0.88)
    .setScrollFactor(0)
    .setDepth(100);

  scene.add.text(400, 260, '⚠ Room Error', {
    fontSize: '18px',
    fill: '#ff4444',
    fontFamily: 'monospace',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  scene.add.text(400, 320, message, {
    fontSize: '13px',
    fill: '#ffaaaa',
    fontFamily: 'monospace',
    align: 'center',
    wordWrap: { width: 600 },
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  scene.add.text(400, 400, 'Press the Back button to return to the town square.', {
    fontSize: '12px',
    fill: '#888888',
    fontFamily: 'monospace',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
}
