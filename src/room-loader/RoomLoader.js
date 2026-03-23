// RoomLoader.js — Validates and mounts player room modules
//
// This module is the bridge between player-submitted room files and the
// Phaser engine. It enforces the room contract defined in _template.js
// so that a broken room cannot crash the entire game.
//
// ARCHITECTURE NOTE:
// Rooms run inside the existing Phaser RoomScene — no iframes or workers.
// Because all room files are manually reviewed before being added to the
// project, we trust the code at the module level. The safety guarantees here
// are about structural correctness (right hooks exported, right types) and
// runtime error isolation (try/catch around every hook call).
//
// HOW TO ADD A NEW ROOM (future reference):
//   1. Drop the room file into src/rooms/
//   2. Import it in WorldScene.js and add it to the ROOMS map
//   That's it. No other files need to change.

// The exact hooks every room module must export.
// NEVER change these names — players generate code against this contract.
const REQUIRED_HOOKS = ['name', 'onLoad', 'onCreate', 'onUpdate', 'onExit'];

/**
 * Validates that a room module exports all required hooks with correct types.
 *
 * @param {object} roomModule - The imported room module (e.g. import * as room from '...')
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRoom(roomModule) {
  const errors = [];

  for (const hook of REQUIRED_HOOKS) {
    if (!(hook in roomModule)) {
      errors.push(`Missing export: "${hook}"`);
      continue;
    }

    // Type checks: name must be a string, the rest must be functions
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
 * Phase 1 STUB — validates only. Actual mounting is implemented in Phase 4.
 *
 * @param {object} roomModule - The imported room module
 * @param {Phaser.Scene} scene - The Phaser scene to mount the room into
 * @returns {boolean} true if the room passed validation, false otherwise
 */
export function loadRoom(roomModule, scene) {
  const { valid, errors } = validateRoom(roomModule);

  if (!valid) {
    // Log each error clearly so the developer can fix the room file quickly.
    console.error(`[RoomLoader] Room "${roomModule.name ?? '(unknown)'}" failed validation:`);
    for (const err of errors) {
      console.error(`  ✗ ${err}`);
    }
    // TODO (Phase 4): Display a friendly in-game error message on screen
    // instead of (or in addition to) the console error.
    return false;
  }

  console.log(`[RoomLoader] Room "${roomModule.name}" validated successfully.`);

  // TODO (Phase 4): Call roomModule.onLoad(scene), then roomModule.onCreate(scene),
  // then wire roomModule.onUpdate(scene) into the scene's update loop.
  // Also expose scene.exitRoom() that calls roomModule.onExit(scene) and
  // transitions back to WorldScene.

  return true;
}
