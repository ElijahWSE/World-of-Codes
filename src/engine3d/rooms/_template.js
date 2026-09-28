// _template.js — starting point for a generated 3D room.
// Copy this to testRoom.js (same folder) and fill it in — either by hand
// or by pasting Gemini's output from ../prompts.js's PROMPT_3D_EXPORT.
// main.js auto-loads ./testRoom.js if it exists, and falls back to a
// placeholder scene if it doesn't.

export const name = 'My Room';

export function onCreate(scene3d) {
  scene3d.addGround(0x7ec850);

  // ── your room design goes here ──────────────────────────────────
  scene3d.addBox(0, 2, -10, 4, 4, 4, 0xffb347);
}

export function onUpdate(scene3d, dt) {
  // ── per-frame animation goes here (dt is seconds since last frame) ─
}
