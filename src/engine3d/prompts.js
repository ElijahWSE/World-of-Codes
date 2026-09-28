// prompts.js — feasibility-test prompts for the 3D spike (src/engine3d/*).
// Structured the same way as WorldScene._claimPrompts(): a free-er DESIGN
// prompt, then a strict EXPORT prompt that forces the output into the
// roomAPI.js whitelist so it's actually safe/loadable, not just "3D code".
// NOT wired into any UI yet — copy these manually while testing feasibility.

export const PROMPT_3D_DESIGN =
  'I want to design a small 3D room for a Three.js game world.\n' +
  'My room theme is: [YOUR THEME HERE]\n' +
  '\n' +
  'The room sits on a roughly 110×110 unit ground plane centered at the origin.\n' +
  'Y is up. The player is a capsule about 1.5 units tall standing at y=0.\n' +
  '\n' +
  'Use ONLY these exact builder functions. Do NOT invent or guess method\n' +
  'names, and do NOT use "new THREE.___" directly — you do not have access\n' +
  'to the THREE namespace, only these functions:\n' +
  '\n' +
  '  scene3d.addBox(x, y, z, width, height, depth, colorHex)\n' +
  '  scene3d.addSphere(x, y, z, radius, colorHex)\n' +
  '  scene3d.addCylinder(x, y, z, radiusTop, radiusBottom, height, colorHex)\n' +
  '  scene3d.addCone(x, y, z, radius, height, colorHex)\n' +
  '  scene3d.addGround(colorHex)               ← call at most once\n' +
  '  scene3d.setPlayerPosition(x, y, z)        ← reposition the player, never rebuild it\n' +
  '\n' +
  'colorHex is a number like 0xff8844. x/z should stay roughly within -50..50.\n' +
  'Use at most ~40 total shapes — favor a few well-placed, well-colored shapes\n' +
  'over a cluttered scene (this engine has no texture/image loading — get\n' +
  'visual identity from shape choice, color, and layout only).\n' +
  '\n' +
  'Describe the room as a list of scene3d calls, grouped by what they build\n' +
  '(ground, then terrain/scenery, then any focal structure). Also describe\n' +
  'any simple per-frame animation you would want (e.g. a shape that bobs,\n' +
  'spins, or pulses) in plain English — the export step below will turn that\n' +
  'into real onUpdate code.\n';

export const PROMPT_3D_EXPORT =
  'Now take the room you designed above and rewrite it using the exact\n' +
  'template below. Fill in only the bodies of onCreate and onUpdate. Do not\n' +
  'change the structure.\n' +
  '\n' +
  'STRICT RULES for the output:\n' +
  '  ✅ Return ONLY what is between the template markers — nothing else\n' +
  '  ✅ Keep both export statements exactly as named\n' +
  '  ✅ Only call the scene3d.* functions listed above — nothing else on scene3d\n' +
  '  ❌ Do NOT use "new THREE.___", import, require, or export default\n' +
  '  ❌ Do NOT use fetch(), document, localStorage, window, or any loader\n' +
  '  ❌ Do NOT add explanation, commentary, or code fences — code only\n' +
  '\n' +
  '--- START OF TEMPLATE ---\n' +
  '\n' +
  "export const name = 'My Room'; // ← use your room name\n" +
  '\n' +
  'export function onCreate(scene3d) {\n' +
  '  scene3d.addGround(0x7ec850);\n' +
  '\n' +
  '  // ── your room design goes here ──────────────────────────────────\n' +
  '\n' +
  '}\n' +
  '\n' +
  'export function onUpdate(scene3d, dt) {\n' +
  '  // ── per-frame animation goes here (dt is seconds since last frame) ─\n' +
  '\n' +
  '}\n' +
  '\n' +
  '--- END OF TEMPLATE ---\n';
