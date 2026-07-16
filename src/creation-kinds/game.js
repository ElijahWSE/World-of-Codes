// src/creation-kinds/game.js — the "game" creation kind: mini-games attached
// to an already-approved room slot. Isomorphic — see room.js for why.
export const kind = 'game';

export const hooks = [
  { name: 'gameName',     type: 'string' },
  { name: 'onGameLoad',   type: 'function' },
  { name: 'onGameCreate', type: 'function' },
  { name: 'onGameUpdate', type: 'function' },
  { name: 'onGameExit',   type: 'function' },
];

export const targetDir = 'src/rooms';

export function validate(code) {
  const errors = [];
  if (/^\s*import\s+/m.test(code) || /require\s*\(/.test(code))
    errors.push('Contains import or require statements');
  if (/\bfetch\s*\(/.test(code) || /\bdocument\b/.test(code) || /\blocalStorage\b/.test(code))
    errors.push('Must not use fetch/document/localStorage');
  if (!/export\s+const\s+game\s*=/.test(code))
    errors.push('Missing: export const game');
  for (const h of hooks) {
    if (!new RegExp(`${h.name}\\s*[:(]`).test(code))
      errors.push(`Missing: game.${h.name}`);
  }
  if (!/scene\.exitGame\s*\(/.test(code))
    errors.push('Must call scene.exitGame() so the player can exit');
  return errors;
}

// Always deterministic from the slot — a game update replaces the same file,
// no existing-name lookup needed the way rooms need one.
export function fileNameFor({ slotKey }) {
  return `game-${slotKey}.js`;
}
