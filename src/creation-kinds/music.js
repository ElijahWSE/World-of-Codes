// src/creation-kinds/music.js — the "music" creation kind: ambient Web
// Audio/synth code attached to an already-approved room slot, exactly like
// game.js. Reviewed like a room/game — one track per room, replaceable via
// resubmission. No audio file/asset is ever stored — the whole point of
// keeping this in the code-review pipeline is that it's pure synthesis.
// Isomorphic — see room.js for why.
export const kind = 'music';

export const hooks = [
  { name: 'musicName', type: 'string' },
  { name: 'play',       type: 'function' },
  { name: 'stop',       type: 'function' },
];

export const targetDir = 'src/rooms';

export function validate(code) {
  const errors = [];
  if (/^\s*import\s+/m.test(code) || /require\s*\(/.test(code))
    errors.push('Contains import or require statements');
  if (/\bfetch\s*\(/.test(code) || /\bdocument\b/.test(code) || /\blocalStorage\b/.test(code))
    errors.push('Must not use fetch/document/localStorage');
  if (!/export\s+const\s+music\s*=/.test(code))
    errors.push('Missing: export const music');
  for (const h of hooks) {
    if (!new RegExp(`${h.name}\\s*[:(]`).test(code))
      errors.push(`Missing: music.${h.name}`);
  }
  return errors;
}

// Always deterministic from the slot — one track per room, a music update
// replaces the same file, no existing-name lookup needed (same as game.js).
export function fileNameFor({ slotKey }) {
  return `music-${slotKey}.js`;
}
