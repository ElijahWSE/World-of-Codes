// ObjectRenderer.js — renders a decorative object's shape-list config and
// drives its optional animation preset (pulse/rotate/drift/colorCycle).
//
// This generalizes CharacterRenderer.js's shape-recipe technique (see that
// file for the original rationale) from characters to room decor — the same
// "ordered list of primitive shapes as data" idea, extended with triangle/
// polygon shapes, optional two-color gradients, and object-level animation
// presets, since decor benefits from motion that characters don't need.
//
// sanitizeObjectConfig() is pure data validation (no Phaser) — isomorphic
// like src/creation-kinds/*.js and CharacterRenderer's sanitizeConfig(), so
// the server can reuse it to validate a decorative-object submission before
// ever writing it to Firestore, instead of trusting the client's own shape.

const MAX_SHAPES      = 24;
const MIN_SCALE        = 0.3;
const MAX_SCALE        = 3;
const COORD_LIMIT      = 160; // x/y clamp, local units (relative to the object's own origin)
const SIZE_LIMIT       = 240; // w/h clamp
const RADIUS_LIMIT     = 120; // r clamp
const MAX_POLY_POINTS  = 10;
const HEX_COLOR_RE     = /^#[0-9a-fA-F]{6}$/;
const SHAPE_TYPES      = new Set(['rect', 'circle', 'triangle', 'polygon']);
const ANIMATIONS       = new Set(['none', 'pulse', 'rotate', 'drift', 'colorCycle']);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function hex(v, fallback = '#888888') {
  return HEX_COLOR_RE.test(v) ? v : fallback;
}

// Validates + normalizes a raw config (e.g. pasted from Gemini) into a safe
// shape list + scale + animation preset. Unknown/malformed shapes are
// dropped rather than erroring, same rationale as CharacterRenderer's
// sanitizeConfig — a mostly-valid paste should still render something.
export function sanitizeObjectConfig(raw) {
  const scale     = clamp(num(raw?.scale, 1), MIN_SCALE, MAX_SCALE);
  const animation = ANIMATIONS.has(raw?.animation) ? raw.animation : 'none';
  const rawShapes = Array.isArray(raw?.shapes) ? raw.shapes : [];

  const shapes = rawShapes
    .filter(s => s && SHAPE_TYPES.has(s.type))
    .slice(0, MAX_SHAPES)
    .map(s => {
      const shape = {
        type:       s.type,
        x:          clamp(num(s.x), -COORD_LIMIT, COORD_LIMIT),
        y:          clamp(num(s.y), -COORD_LIMIT, COORD_LIMIT),
        color:      hex(s.color),
        gradientTo: s.gradientTo && HEX_COLOR_RE.test(s.gradientTo) ? s.gradientTo : null,
      };
      if (s.type === 'rect') {
        shape.w = clamp(num(s.w), 0, SIZE_LIMIT);
        shape.h = clamp(num(s.h), 0, SIZE_LIMIT);
      } else if (s.type === 'circle') {
        shape.r = clamp(num(s.r), 0, RADIUS_LIMIT);
      } else if (s.type === 'triangle') {
        shape.x2 = clamp(num(s.x2), -COORD_LIMIT, COORD_LIMIT);
        shape.y2 = clamp(num(s.y2), -COORD_LIMIT, COORD_LIMIT);
        shape.x3 = clamp(num(s.x3), -COORD_LIMIT, COORD_LIMIT);
        shape.y3 = clamp(num(s.y3), -COORD_LIMIT, COORD_LIMIT);
      } else if (s.type === 'polygon') {
        const rawPoints = Array.isArray(s.points) ? s.points : [];
        shape.points = rawPoints.slice(0, MAX_POLY_POINTS).map(p => ({
          x: clamp(num(p?.x), -COORD_LIMIT, COORD_LIMIT),
          y: clamp(num(p?.y), -COORD_LIMIT, COORD_LIMIT),
        }));
        if (shape.points.length < 3) return null; // not a real polygon, drop it
      }
      return shape;
    })
    .filter(Boolean);

  return { scale, animation, shapes };
}

function colorToInt(h) {
  return parseInt(h.slice(1), 16);
}

// ── Small hex<->HSL helpers, used only by the colorCycle animation preset ──
function hexToHsl(h) {
  const n = parseInt(h.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hh;
  switch (max) {
    case r:  hh = (g - b) / d + (g < b ? 6 : 0); break;
    case g:  hh = (b - r) / d + 2; break;
    default: hh = (r - g) / d + 4;
  }
  return [hh / 6, s, l];
}

function hslToHex(hh, s, l) {
  const f = n => {
    const k = (n + hh * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255);
  };
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function shiftHue(hexColor, deltaDeg) {
  const [h, s, l] = hexToHsl(hexColor);
  let nh = (h + deltaDeg / 360) % 1;
  if (nh < 0) nh += 1;
  return hslToHex(nh, s, l);
}

// (Re)draws every shape onto `gfx`. `hueShift` (degrees) is only nonzero
// during the colorCycle animation preset.
function drawShapes(gfx, config, hueShift = 0) {
  gfx.clear();
  const { scale, shapes } = config;

  for (const s of shapes) {
    const color = hueShift ? shiftHue(s.color, hueShift) : s.color;
    if (s.gradientTo) {
      const c1 = colorToInt(color);
      const c2 = colorToInt(hueShift ? shiftHue(s.gradientTo, hueShift) : s.gradientTo);
      gfx.fillGradientStyle(c1, c1, c2, c2, 1);
    } else {
      gfx.fillStyle(colorToInt(color), 1);
    }

    if (s.type === 'rect') {
      gfx.fillRect(s.x * scale, s.y * scale, s.w * scale, s.h * scale);
    } else if (s.type === 'circle') {
      gfx.fillCircle(s.x * scale, s.y * scale, s.r * scale);
    } else if (s.type === 'triangle') {
      gfx.fillTriangle(
        s.x * scale, s.y * scale,
        s.x2 * scale, s.y2 * scale,
        s.x3 * scale, s.y3 * scale,
      );
    } else if (s.type === 'polygon') {
      gfx.fillPoints(s.points.map(p => ({ x: p.x * scale, y: p.y * scale })), true);
    }
  }
}

// Builds the decorative object's game object: a Container holding one
// Graphics child — same shape as CharacterRenderer.createCharacter(), so the
// caller positions/depth-sorts it exactly like any other game object.
export function createObject(scene, rawConfig, x = 0, y = 0) {
  const config    = sanitizeObjectConfig(rawConfig);
  const container = scene.add.container(x, y);
  const gfx       = scene.add.graphics();
  container.add(gfx);

  container.objectConfig = config;
  container.objectAnim = {
    phase: Math.random() * Math.PI * 2, // desynced so identical objects don't animate in lockstep
  };

  drawShapes(gfx, config);
  return container;
}

// Redraws an already-created object's container in place with a new raw
// config — used when an owner edits a placed object's shapes/scale/animation.
// Reuses the same Container + Graphics child rather than recreating them, so
// drag-interactivity already set up on the container (see RoomScene's
// _updateObjectInteractivity) isn't lost.
export function setObjectConfig(container, rawConfig) {
  const config = sanitizeObjectConfig(rawConfig);
  container.objectConfig = config;
  const gfx = container.list[0];
  if (gfx) drawShapes(gfx, config);
}

// Call every frame from the owning scene's update(). No-ops for objects
// with animation: 'none' (the common case — most decor is static).
export function updateObject(container, delta) {
  const anim   = container.objectAnim;
  const config = container.objectConfig;
  if (!anim || !config || config.animation === 'none') return;
  const gfx = container.list[0];
  if (!gfx) return;

  anim.phase += delta * 0.002;

  switch (config.animation) {
    case 'pulse':
      gfx.setScale(1 + Math.sin(anim.phase * 2) * 0.08);
      break;
    case 'rotate':
      gfx.rotation += delta * 0.0015;
      break;
    case 'drift':
      gfx.y = Math.sin(anim.phase) * 6;
      break;
    case 'colorCycle':
      drawShapes(gfx, config, (anim.phase * 40) % 360);
      break;
  }
}

export const OBJECT_LIMITS = {
  MAX_SHAPES, MIN_SCALE, MAX_SCALE, COORD_LIMIT, SIZE_LIMIT, RADIUS_LIMIT, MAX_POLY_POINTS,
};
