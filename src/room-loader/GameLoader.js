// GameLoader.js — validates a game module and calls onGameCreate.
// Returns true on success, false on failure (shows in-scene error text).

export function loadGame(gameModule, scene) {
  const errors = [];

  if (typeof gameModule.gameName !== 'string' || !gameModule.gameName.trim()) {
    errors.push('gameName must be a non-empty string');
  }
  for (const fn of ['onGameLoad', 'onGameCreate', 'onGameUpdate', 'onGameExit']) {
    if (typeof gameModule[fn] !== 'function') errors.push(`${fn} must be a function`);
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
