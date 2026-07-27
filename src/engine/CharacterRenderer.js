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

import { apiUrl } from './serverUrl.js';

const MAX_SHAPES  = 30;
const MIN_SCALE    = 0.8;
const MAX_SCALE    = 1.3;
const COORD_LIMIT   = 80;  // x/y clamp
const SIZE_LIMIT    = 120; // w/h clamp
const RADIUS_LIMIT  = 60;  // r clamp
const ROTATION_MAX   = 360; // rotation clamp (degrees, 0-360)
const ALPHA_MIN      = 0;   // per-shape opacity clamp
const ALPHA_MAX      = 1;
const STROKE_WIDTH_LIMIT = 6; // outline width clamp
const HEX_COLOR_RE  = /^#[0-9a-fA-F]{6}$/;
const SHAPE_TYPES = new Set(['rect', 'circle', 'triangle', 'ellipse']);

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
    .filter(s => s && SHAPE_TYPES.has(s.type))
    .slice(0, MAX_SHAPES)
    .map(s => ({
      type:        s.type,
      x:           clamp(num(s.x), -COORD_LIMIT, COORD_LIMIT),
      y:           clamp(num(s.y), -COORD_LIMIT, COORD_LIMIT),
      w:           clamp(num(s.w), 0, SIZE_LIMIT),
      h:           clamp(num(s.h), 0, SIZE_LIMIT),
      r:           clamp(num(s.r), 0, RADIUS_LIMIT),
      color:       HEX_COLOR_RE.test(s.color) ? s.color : '#888888',
      // Normalized into [0, 360) rather than clamped — a plain clamp would
      // silently zero out any negative degrees (e.g. "-30" for a left tilt),
      // which is a completely normal thing for a design to ask for.
      rotation:    ((num(s.rotation, 0) % ROTATION_MAX) + ROTATION_MAX) % ROTATION_MAX,
      alpha:       clamp(num(s.alpha, 1), ALPHA_MIN, ALPHA_MAX),
      // null, never undefined — Firestore's Admin SDK throws on `undefined`
      // anywhere in a written document (by default), which would otherwise
      // silently fail every save since most shapes don't use a stroke.
      strokeColor: (typeof s.strokeColor === 'string' && HEX_COLOR_RE.test(s.strokeColor)) ? s.strokeColor : null,
      strokeWidth: clamp(num(s.strokeWidth, 0), 0, STROKE_WIDTH_LIMIT),
    }));

  return { scale, shapes };
}

function colorToInt(hex) {
  return parseInt(hex.slice(1), 16);
}

// Bounding box in un-scaled local units — used to figure out which shapes
// are "legs" (bottom of the character), "toppers" (top of the character —
// hats/ears/antennae), or "eyes" (for blinking), purely from geometry. No
// shape needs to be tagged as any of these; it falls out of where it's
// positioned and (for eyes) how small it is.
//
// Coordinate convention: `rect` uses x/y as its top-left corner (unchanged
// from the original schema, so existing saved characters keep rendering
// identically). `circle`, `triangle`, and `ellipse` all use x/y as their
// *center* instead, matching how `circle` already worked.
function boundsOf(shapes) {
  let minY = Infinity, maxY = -Infinity;
  for (const s of shapes) {
    let top, bottom;
    if (s.type === 'rect')        { top = s.y;         bottom = s.y + s.h; }
    else if (s.type === 'circle') { top = s.y - s.r;    bottom = s.y + s.r; }
    else                          { top = s.y - s.h / 2; bottom = s.y + s.h / 2; } // triangle/ellipse
    if (top    < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }
  if (!Number.isFinite(minY)) { minY = 0; maxY = 0; }
  return { minY, maxY };
}

// (Re)draws every shape onto `gfx`.
//   legSwing — offsets shapes in the bottom 40% of the bounding box
//     vertically, alternating by which side of center they're on (walk-cycle).
//   topSway — offsets shapes in the top 15% of the bounding box horizontally
//     (hats/ears/antennae wiggling while walking).
//   blinking — skips shapes that look like eyes (small circles near the top
//     of the head) for one draw, creating a blink.
// None of these need a shape to be tagged as a leg/topper/eye; it all falls
// out of the shape's own position and size.
function drawShapes(gfx, config, { legSwing = 0, topSway = 0, blinking = false } = {}) {
  gfx.clear();
  const { scale, shapes } = config;
  const { minY, maxY } = boundsOf(shapes);
  const range         = maxY - minY;
  const legThreshold   = minY + range * 0.6;
  const topThreshold   = minY + range * 0.15;
  const eyeThreshold   = minY + range * 0.35;

  for (const s of shapes) {
    const shapeMidY = s.type === 'rect' ? s.y + s.h / 2 : s.y;
    const isEye = blinking && s.type === 'circle' && s.r > 0 && s.r <= 5 && shapeMidY <= eyeThreshold;
    if (isEye) continue;

    const isLeg = legSwing !== 0 && shapeMidY >= legThreshold;
    const isTop = topSway !== 0 && shapeMidY <= topThreshold;
    const side  = s.x < 0 ? -1 : 1;
    const dy    = isLeg ? side * legSwing : 0;
    const dx    = isTop ? topSway : 0;

    // rect keeps its corner as the pivot (so existing saves don't shift);
    // every other type rotates around its own center.
    const pivotX = s.type === 'rect' ? s.x + s.w / 2 + dx : s.x + dx;
    const pivotY = s.type === 'rect' ? s.y + s.h / 2 + dy : s.y + dy;
    const halfW  = (s.w / 2) * scale;
    const halfH  = (s.h / 2) * scale;

    gfx.save();
    gfx.translateCanvas(pivotX * scale, pivotY * scale);
    if (s.rotation) gfx.rotateCanvas(s.rotation * Math.PI / 180);

    gfx.fillStyle(colorToInt(s.color), s.alpha);
    switch (s.type) {
      case 'rect':    gfx.fillRect(-halfW, -halfH, s.w * scale, s.h * scale); break;
      case 'circle':  gfx.fillCircle(0, 0, s.r * scale); break;
      case 'ellipse': gfx.fillEllipse(0, 0, s.w * scale, s.h * scale); break;
      case 'triangle': gfx.fillTriangle(0, -halfH, -halfW, halfH, halfW, halfH); break;
    }

    if (s.strokeColor && s.strokeWidth > 0) {
      gfx.lineStyle(s.strokeWidth * scale, colorToInt(s.strokeColor), s.alpha);
      switch (s.type) {
        case 'rect':    gfx.strokeRect(-halfW, -halfH, s.w * scale, s.h * scale); break;
        case 'circle':  gfx.strokeCircle(0, 0, s.r * scale); break;
        case 'ellipse': gfx.strokeEllipse(0, 0, s.w * scale, s.h * scale); break;
        case 'triangle': gfx.strokeTriangle(0, -halfH, -halfW, halfH, halfW, halfH); break;
      }
    }

    gfx.restore();
  }
}

// Builds the character game object: a Container holding one Graphics child.
// The caller positions/physics-enables the returned container exactly like
// any other game object — the shared animation (see updateCharacter) only
// ever touches the inner Graphics child's local y/scaleX/scaleY, never the
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
    blinking:      false,
    blinkTimer:    2000 + Math.random() * 3000, // desynced first blink per character
    spawnPop:      260,  // ms remaining on the arrival "pop" — plays once automatically
    spawnPopDuration: 260,
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

  if (facingX) anim.facing = facingX < 0 ? -1 : 1;

  // Blink timer runs continuously regardless of walk/idle state — a redraw
  // only actually happens when it flips (see below), so this stays cheap.
  anim.blinkTimer -= delta;
  let blinkChanged = false;
  if (anim.blinkTimer <= 0) {
    anim.blinking = !anim.blinking;
    anim.blinkTimer = anim.blinking ? 140 : 2400 + Math.random() * 2600;
    blinkChanged = true;
  }

  if (moving) {
    anim.walkPhase += delta * 0.012;
    gfx.y = 0;
    const legSwing = Math.sin(anim.walkPhase) * 2.5;
    const topSway  = Math.sin(anim.walkPhase * 0.6) * 1.2;
    drawShapes(gfx, config, { legSwing, topSway, blinking: anim.blinking });
    anim.wasMoving = true;
  } else {
    if (anim.wasMoving || blinkChanged) {
      // Reset to neutral pose once coming out of a walk, or redraw once a
      // blink starts/ends — idle otherwise only touches gfx.y/scale below.
      drawShapes(gfx, config, { blinking: anim.blinking });
      anim.wasMoving = false;
    }
    anim.bobPhase += delta * 0.003;
    gfx.y = Math.sin(anim.bobPhase) * 2;
  }

  // Squash-and-stretch riding on the idle bob, plus a one-time arrival pop
  // that plays automatically whenever a character is first created — both
  // only ever touch scaleX/scaleY, never container.x/y, so they can't
  // interfere with movement, physics, or the networked position.
  const squashY = 1 + Math.sin(anim.bobPhase) * 0.05;
  const squashX = 1 - Math.sin(anim.bobPhase) * 0.03;
  let popScale = 1;
  if (anim.spawnPop > 0) {
    anim.spawnPop = Math.max(0, anim.spawnPop - delta);
    const t = 1 - anim.spawnPop / anim.spawnPopDuration;
    popScale = 0.7 + 0.3 * t;
  }
  gfx.scaleX = anim.facing * squashX * popScale;
  gfx.scaleY = squashY * popScale;
}

export const CHARACTER_LIMITS = {
  MAX_SHAPES, MIN_SCALE, MAX_SCALE, COORD_LIMIT, SIZE_LIMIT, RADIUS_LIMIT,
  ROTATION_MAX, ALPHA_MIN, ALPHA_MAX, STROKE_WIDTH_LIMIT,
};

// Module-level (not per-scene) so a player already resolved while in
// WorldScene isn't re-fetched again inside RoomScene, or vice versa — a
// character config never changes mid-session, so once fetched it's good for
// the rest of the page's lifetime.
const configCache = new Map();

export function fetchCharacterConfig(uid) {
  if (!configCache.has(uid)) {
    const promise = fetch(apiUrl('/api/character/' + uid))
      .then(res => res.json())
      .then(data => data.characterConfig ?? null)
      .catch(() => null);
    configCache.set(uid, promise);
  }
  return configCache.get(uid);
}
