// GameLoader.js — validates a game module and calls onGameCreate.
// Returns true on success, false on failure (shows in-scene error text).

import { getKind } from '../creation-kinds/index.js';

// Hook contract from the shared creation-kind registry (src/creation-kinds/game.js).
const { hooks: REQUIRED_HOOKS } = getKind('game');

export function loadGame(gameModule, scene) {
  const errors = [];

  for (const { name, type } of REQUIRED_HOOKS) {
    if (type === 'string') {
      if (typeof gameModule[name] !== 'string' || !gameModule[name].trim())
        errors.push(`${name} must be a non-empty string`);
    } else if (typeof gameModule[name] !== 'function') {
      errors.push(`${name} must be a function`);
    }
  }

  if (errors.length > 0) {
    scene._showError('Game validation failed:\n' + errors.join('\n'));
    return false;
  }

  // Game title in header
  scene.add.text(370, 44, gameModule.gameName, {
    fontSize: '17px', fill: '#ccbbff', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(10);

  try {
    gameModule.onGameCreate(scene);
    return true;
  } catch (err) {
    console.error('[GameLoader] onGameCreate threw:', err);
    scene._showError(`Error starting game:\n${err.message}`);
    return false;
  }
}
