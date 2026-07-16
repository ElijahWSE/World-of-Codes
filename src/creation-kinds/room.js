// src/creation-kinds/room.js — the "room" creation kind: player-authored world modules.
// Pure JS only (no Node builtins) — this module is imported by both the
// server (submission validation) and the browser (RoomLoader's hook check),
// so it must stay isomorphic.
export const kind = 'room';

export const hooks = [
  { name: 'name',     type: 'string' },
  { name: 'onLoad',   type: 'function' },
  { name: 'onCreate', type: 'function' },
  { name: 'onUpdate', type: 'function' },
  { name: 'onExit',   type: 'function' },
];

export const targetDir = 'src/rooms';

export function validate(code) {
  const errors = [];
  if (/<(?:div|span|p|h[1-6]|ul|li|button|input|form)\b/i.test(code) || /className\s*=/.test(code))
    errors.push('Contains JSX or HTML tags');
  if (/^\s*import\s+/m.test(code) || /require\s*\(/.test(code))
    errors.push('Contains import or require statements');
  if (/\bfetch\s*\(/.test(code) || /\bdocument\b/.test(code) || /\blocalStorage\b/.test(code))
    errors.push('Must not use fetch/document/localStorage');
  for (const h of hooks) {
    const missing = h.type === 'string'
      ? !new RegExp(`export\\s+const\\s+${h.name}\\s*=`).test(code)
      : !new RegExp(`export\\s+(function\\s+${h.name}|const\\s+${h.name}\\s*=)`).test(code);
    if (missing) errors.push(`Missing: export ${h.type === 'string' ? 'const' : 'function'} ${h.name}`);
  }
  return errors;
}

// existingFileName preserves the module URL across updates so the client's
// dynamic import() keeps resolving to the same path.
export function fileNameFor({ displayName, existingFileName }) {
  return existingFileName ?? (toKebabCase(displayName) + '.js');
}

function toKebabCase(str) {
  return String(str).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
