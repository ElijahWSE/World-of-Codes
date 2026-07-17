// CharacterRenderer.js — renders a player's shape-recipe character config and
// animates it with one shared, generic idle bob / walk-cycle / direction-flip.
// The animation lives here, not per-character, so every character gets the
// same "aliveness" for free regardless of what shapes it's made of.
//
// sanitizeConfig() is pure data validation (no Phaser) — isomorphic like
// src/creation-kinds/*.js, so the server can reuse it before writing to
// Firestore instead of trusting the client's own validation.
//
// createCharacter()/updateCharacter() take a Phaser `scene` as a plain
// parameter rather than importing Phaser directly, so this file stays safe
// to import server-side too.

const MAX_SHAPES  = 20;
const MIN_SCALE    = 0.8;
const MAX_SCALE    = 1.3;
const COORD_LIMIT   = 80;  // x/y clamp
const SIZE_LIMIT    = 120; // w/h clamp
const RADIUS_LIMIT  = 60;  // r clamp
const HEX_COLOR_RE  = /^#[0-9a-fA-F]{6}$/;

// Used only when no config exists at all (e.g. a failed /api/character/:uid
// fetch) — every real player has a saved config by construction, since
// CharacterScene gates world entry, so this is a defensive fallback, not an
// expected appearance. A deliberately empty shapes: [] from a real config is
// left alone — that's a player's own (unusual) choice, not an error to mask.
const FALLBACK_CONFIG = {
  shapes: [
    { type: 'rect',   x: -12, y: -20, w: 24, h: 24, color: '#555566' },
    { type: 'circle', x: 0,   y: -30, r: 10,          color: '#888899' },
  ],
  scale: 1.0,
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Validates + normalizes a raw config (e.g. pasted from Gemini) into a safe
// shape list + scale. Unknown/malformed shapes are dropped rather than
// erroring, so a mostly-valid paste still renders something instead of
// nothing — there's no "resubmit and wait for review" step to fall back on
// here, this has to just work.
export function sanitizeConfig(raw) {
  const scale = clamp(num(raw?.scale, 1), MIN_SCALE, MAX_SCALE);
  const rawShapes = Array.isArray(raw?.shapes) ? raw.shapes : [];

  const shapes = rawShapes
    .filter(s => s && (s.type === 'rect' || s.type === 'circle'))
    .slice(0, MAX_SHAPES)
    .map(s => ({
      type:  s.type,
      x:     clamp(num(s.x), -COORD_LIMIT, COORD_LIMIT),
      y:     clamp(num(s.y), -COORD_LIMIT, COORD_LIMIT),
      w:     clamp(num(s.w), 0, SIZE_LIMIT),
      h:     clamp(num(s.h), 0, SIZE_LIMIT),
      r:     clamp(num(s.r), 0, RADIUS_LIMIT),
      color: HEX_COLOR_RE.test(s.color) ? s.color : '#888888',
    }));

  return { scale, shapes };
}

function colorToInt(hex) {
  return parseInt(hex.slice(1), 16);
}

// Bounding box in un-scaled local units — used to figure out which shapes
// are "legs" (bottom of the character) for the walk-cycle, purely from
// geometry. No shape needs to be tagged as a leg; it falls out of where
// it's positioned.
function boundsOf(shapes) {
  let minY = Infinity, maxY = -Infinity;
  for (const s of shapes) {
    const top    = s.type === 'circle' ? s.y - s.r : s.y;
    const bottom = s.type === 'circle' ? s.y + s.r : s.y + s.h;
    if (top    < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }
  if (!Number.isFinite(minY)) { minY = 0; maxY = 0; }
  return { minY, maxY };
}

// (Re)draws every shape onto `gfx`. `legSwing` (if given) offsets shapes in
// the bottom 40% of the bounding box vertically, alternating by which side
// of center they're on — the geometric stand-in for "swap legs" since shapes
// aren't tagged with a body part.
function drawShapes(gfx, config, legSwing = 0) {
  gfx.clear();
  const { scale, shapes } = config;
  const { minY, maxY } = boundsOf(shapes);
  const legThreshold = minY + (maxY - minY) * 0.6;

  for (const s of shapes) {
    const shapeMidY = s.type === 'circle' ? s.y : s.y + s.h / 2;
    const isLeg     = legSwing !== 0 && shapeMidY >= legThreshold;
    const side      = s.x < 0 ? -1 : 1;
    const dy        = isLeg ? side * legSwing : 0;

    gfx.fillStyle(colorToInt(s.color), 1);
    if (s.type === 'rect') {
      gfx.fillRect(s.x * scale, (s.y + dy) * scale, s.w * scale, s.h * scale);
    } else {
      gfx.fillCircle(s.x * scale, (s.y + dy) * scale, s.r * scale);
    }
  }
}

// Builds the character game object: a Container holding one Graphics child.
// The caller positions/physics-enables the returned container exactly like
// any other game object — the shared animation (see updateCharacter) only
// ever touches the inner Graphics child's local y/scaleX, never the
// container's own x/y, so it can never interfere with physics, collision,
// or the position that gets broadcast over the network.
export function createCharacter(scene, rawConfig, x = 0, y = 0) {
  const config    = sanitizeConfig(rawConfig ?? FALLBACK_CONFIG);
  const container = scene.add.container(x, y);
  const gfx       = scene.add.graphics();
  container.add(gfx);

  container.characterConfig = config;
  container.characterAnim = {
    bobPhase:  Math.random() * Math.PI * 2, // desynced so characters don't bob in lockstep
    walkPhase: 0,
    facing:    1,
    wasMoving: false,
  };

  drawShapes(gfx, config);
  return container;
}

// Call every frame from the owning scene's update(). `moving` should be true
// whenever the character has nonzero velocity; `facingX` is the sign of
// horizontal velocity (0/undefined leaves the last facing direction as-is,
// so moving straight up/down doesn't reset a left/right flip).
export function updateCharacter(container, { moving, facingX, delta }) {
  const anim   = container.characterAnim;
  const config = container.characterConfig;
  // Safe to call on anything, not just real characters — a caller iterating
  // other players may still be holding the gray placeholder (a plain
  // Rectangle, no .list) while that player's config fetch is in flight.
  // anim/config are undefined on non-character objects, so bail before ever
  // touching .list — reading it unconditionally crashes on exactly that
  // placeholder the moment a second player's character is still loading.
  if (!anim || !config) return;
  const gfx = container.list[0];
  if (!gfx) return;

  if (facingX) gfx.scaleX = facingX < 0 ? -1 : 1;

  if (moving) {
    anim.walkPhase += delta * 0.012;
    gfx.y = 0;
    drawShapes(gfx, config, Math.sin(anim.walkPhase) * 2.5);
    anim.wasMoving = true;
  } else {
    if (anim.wasMoving) {
      drawShapes(gfx, config); // reset to neutral pose once, coming out of a walk
      anim.wasMoving = false;
    }
    anim.bobPhase += delta * 0.003;
    gfx.y = Math.sin(anim.bobPhase) * 2;
  }
}

export const CHARACTER_LIMITS = { MAX_SHAPES, MIN_SCALE, MAX_SCALE, COORD_LIMIT, SIZE_LIMIT, RADIUS_LIMIT };

// Module-level (not per-scene) so a player already resolved while in
// WorldScene isn't re-fetched again inside RoomScene, or vice versa — a
// character config never changes mid-session, so once fetched it's good for
// the rest of the page's lifetime.
const configCache = new Map();

export function fetchCharacterConfig(uid) {
  if (!configCache.has(uid)) {
    const promise = fetch('/api/character/' + uid)
      .then(res => res.json())
      .then(data => data.characterConfig ?? null)
      .catch(() => null);
    configCache.set(uid, promise);
  }
  return configCache.get(uid);
}
