// src/creation-kinds/object.js — the "object" creation kind, interactive
// sub-kind only. Decorative objects are pure data (see ObjectRenderer.js's
// sanitizeObjectConfig) and never touch this pipeline — this file is only
// for objects with real code, reviewed like a room but submitted/approved
// as their own small, isolated unit (never bundled into a room resubmit).
// Pure JS only (no Node builtins) — isomorphic like room.js/game.js.
export const kind = 'object';

export const hooks = [
  { name: 'onLoad',     type: 'function' },
  { name: 'onCreate',   type: 'function' },
  { name: 'onUpdate',   type: 'function' },
  { name: 'onInteract', type: 'function' },
  // onRemove is intentionally NOT required — most objects don't need
  // teardown logic, so it's an optional hook the client checks for at
  // runtime rather than something every submission must stub out.
];

export const targetDir = 'src/objects';

export function validate(code) {
  const errors = [];
  if (/^\s*import\s+/m.test(code) || /require\s*\(/.test(code))
    errors.push('Contains import or require statements');
  if (/\bfetch\s*\(/.test(code) || /\bdocument\b/.test(code) || /\blocalStorage\b/.test(code))
    errors.push('Must not use fetch/document/localStorage');
  for (const h of hooks) {
    if (!new RegExp(`export\\s+(function\\s+${h.name}|const\\s+${h.name}\\s*=)`).test(code))
      errors.push(`Missing: export function ${h.name}`);
  }
  return errors;
}

// Objects don't have a stable "slot" the way rooms/games do — a room can
// have many of them — so the id is generated once at submission time (the
// submission's own id) and reused as the object's permanent id and file
// name. No existingFileName concept: this kind is create-only for now
// (see Phase 11 milestone 3 plan).
export function fileNameFor({ id }) {
  return `object-${id}.js`;
}
