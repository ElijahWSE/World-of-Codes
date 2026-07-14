// townSquareLayout.js — Procedurally generated Singapore-style town square layout.
// Single source of truth for the shared world's hub/street/plot geometry —
// imported by BOTH the server (server/index.js) and the client (WorldScene.js),
// so their portal positions can never drift out of sync with each other.
//
// The layout is a seeded, deterministic generator (not hand-authored data) —
// re-running it always produces the exact same map. This replaces the old
// hardcoded PORTAL_SLOT_POSITIONS/PORTAL_SLOTS arrays that used to be
// duplicated by hand between client and server.
//
// Design: a true rectangular street grid (not radial wedges) — a central
// garden hub sits among grid blocks of varying size, created by randomly
// merging adjacent grid cells (1x1, 2x1, 1x2, or 2x2), all separated by one
// uniform road width. There is no separate "alley" tier — every gap, big
// block or small, uses the same road width.
//
// The walkable CITY sits inside a bigger total WORLD canvas, surrounded by a
// backdrop band (sky, clouds, HDB skyline) that's visible but not walkable —
// players are physically confined to the city; the camera is not, so the
// backdrop is visible whenever they're near the city's edge.

export const CITY_W = 3600;
export const CITY_H = 2700;
export const MARGIN  = 100;

const BACKDROP_DEPTH = 700; // width of the non-walkable backdrop band on every side
export const CITY_X0 = BACKDROP_DEPTH;
export const CITY_Y0 = BACKDROP_DEPTH;
export const WORLD_W = CITY_W + BACKDROP_DEPTH * 2;
export const WORLD_H = CITY_H + BACKDROP_DEPTH * 2;

const CENTER_X = CITY_X0 + CITY_W / 2;
const CENTER_Y = CITY_Y0 + CITY_H / 2;

const HUB_HALF_W  = 300;
const HUB_HALF_H  = 260;
const HUB_PADDING = 50; // extra clearance excluded from grid cells around the hub

export const HUB_BOUNDS = {
  x: CENTER_X - HUB_HALF_W, y: CENTER_Y - HUB_HALF_H,
  w: HUB_HALF_W * 2, h: HUB_HALF_H * 2,
  cx: CENTER_X, cy: CENTER_Y,
};

const COLS              = 12;
const ROWS               = 9;
const SEED               = 20260714;
const STREET_HALF_WIDTH  = 55; // absolute px inset per block edge — ~110px roads, the SAME width used for every gap in the grid

const GRID_X0 = CITY_X0 + MARGIN;
const GRID_Y0 = CITY_Y0 + MARGIN;
const CELL_W  = (CITY_W - MARGIN * 2) / COLS;
const CELL_H  = (CITY_H - MARGIN * 2) / ROWS;

const PALETTE = [0x8ECAE6, 0xF4A261, 0xE9C46A, 0x90BE6D, 0x5FA8A0, 0xE07A5F, 0xB5838D, 0xC9ADA7];

// ── Seeded PRNG (mulberry32) — deterministic across client + server ───────────
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function centroid(points) {
  let x = 0, y = 0;
  for (const [px, py] of points) { x += px; y += py; }
  return [x / points.length, y / points.length];
}

// Insets a convex polygon by a FIXED pixel distance along every edge (proper
// polygon erosion, not a percentage shrink) — so road width stays constant
// regardless of whether a block is a single small cell or a big merged one.
// Each edge is offset inward by `d`; new vertices are the intersection of
// consecutive offset edges.
function insetPolygon(points, d) {
  const n = points.length;
  const c = centroid(points);
  const offsetEdges = points.map((a, i) => {
    const b = points[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    const midx = (a[0] + b[0]) / 2, midy = (a[1] + b[1]) / 2;
    if (nx * (c[0] - midx) + ny * (c[1] - midy) < 0) { nx = -nx; ny = -ny; }
    return { point: [a[0] + nx * d, a[1] + ny * d], dir: [dx, dy] };
  });
  return points.map((_, i) => {
    const e1 = offsetEdges[(i - 1 + n) % n];
    const e2 = offsetEdges[i];
    const denom = e1.dir[0] * e2.dir[1] - e1.dir[1] * e2.dir[0];
    if (Math.abs(denom) < 1e-9) return e2.point;
    const t = ((e2.point[0] - e1.point[0]) * e2.dir[1] - (e2.point[1] - e1.point[1]) * e2.dir[0]) / denom;
    return [e1.point[0] + e1.dir[0] * t, e1.point[1] + e1.dir[1] * t];
  });
}

// ── Grid generation ────────────────────────────────────────────────────────────
function cellRect(r, c, rw, rh) {
  const x0 = GRID_X0 + c * CELL_W, y0 = GRID_Y0 + r * CELL_H;
  const x1 = x0 + rw * CELL_W, y1 = y0 + rh * CELL_H;
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

function cellBoundsAxis(r, c) {
  const x0 = GRID_X0 + c * CELL_W, y0 = GRID_Y0 + r * CELL_H;
  return { x0, y0, x1: x0 + CELL_W, y1: y0 + CELL_H };
}

function rectsOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

const HUB_EXCLUSION = {
  x0: HUB_BOUNDS.x - HUB_PADDING, y0: HUB_BOUNDS.y - HUB_PADDING,
  x1: HUB_BOUNDS.x + HUB_BOUNDS.w + HUB_PADDING, y1: HUB_BOUNDS.y + HUB_BOUNDS.h + HUB_PADDING,
};

function pickBlockSize(rand) {
  const roll = rand();
  if (roll < 0.55) return { w: 1, h: 1 };
  if (roll < 0.70) return { w: 2, h: 1 };
  if (roll < 0.85) return { w: 1, h: 2 };
  return { w: 2, h: 2 };
}

function fits(r, c, w, h, used) {
  if (r + h > ROWS || c + w > COLS) return false;
  for (let dr = 0; dr < h; dr++)
    for (let dc = 0; dc < w; dc++)
      if (used[r + dr][c + dc]) return false;
  return true;
}

function markUsed(r, c, w, h, used) {
  for (let dr = 0; dr < h; dr++)
    for (let dc = 0; dc < w; dc++)
      used[r + dr][c + dc] = true;
}

// Fills the grid with blocks of varying size (merging 1-4 adjacent cells),
// skipping any cell that overlaps the hub, then insets every block by the
// same road half-width — a real grid, not a radial layout, so there's no
// wedge shape left anywhere to produce a thin sliver.
function generateGridBlocks() {
  const rand = mulberry32(SEED);
  const used = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (rectsOverlap(cellBoundsAxis(r, c), HUB_EXCLUSION)) used[r][c] = true;
    }
  }

  const order = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) order.push([r, c]);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const blocks = [];
  for (const [r, c] of order) {
    if (used[r][c]) continue;
    let { w, h } = pickBlockSize(rand);
    if (!fits(r, c, w, h, used)) { w = 1; h = 1; }
    markUsed(r, c, w, h, used);
    blocks.push(insetPolygon(cellRect(r, c, w, h), STREET_HALF_WIDTH));
  }
  return blocks;
}

function generatePlots() {
  return generateGridBlocks().map((points, idx) => {
    const [cx, cy] = centroid(points);
    return {
      key:   `slot${String(idx + 1).padStart(2, '0')}`,
      shape: 'polygon',
      points,
      x: Math.round(cx),
      y: Math.round(cy),
      color: PALETTE[idx % PALETTE.length],
    };
  });
}

export const PLOTS = generatePlots();

// A spawn point near the hub, guaranteed to sit clear of every portal's
// trigger radius (90px) so a freshly-spawned player never lands right next
// to someone else's portal hint. Searched at spawn-relevant angles/radii
// around the hub rather than hardcoded, so it stays correct even if the
// layout parameters above change.
function insideHubRect(x, y, pad) {
  return Math.abs(x - HUB_BOUNDS.cx) < HUB_HALF_W + pad && Math.abs(y - HUB_BOUNDS.cy) < HUB_HALF_H + pad;
}

function findSpawnPoint() {
  const CLEARANCE = 150;
  const HUB_PAD = 60; // the hub is a rectangle, not a circle — must be checked explicitly, a radius alone can still land inside it near its corners/edges
  let best = null;
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    for (const r of [260, 300, 340, 380, 420, 460]) {
      const sx = HUB_BOUNDS.cx + Math.cos(rad) * r;
      const sy = HUB_BOUNDS.cy + Math.sin(rad) * r;
      if (insideHubRect(sx, sy, HUB_PAD)) continue;
      let minDist = Infinity;
      for (const p of PLOTS) {
        const d = Math.hypot(p.x - sx, p.y - sy);
        if (d < minDist) minDist = d;
      }
      if (minDist >= CLEARANCE) return { x: Math.round(sx), y: Math.round(sy) };
      if (!best || minDist > best.minDist) best = { x: Math.round(sx), y: Math.round(sy), minDist };
    }
  }
  return { x: best.x, y: best.y }; // fallback: best clearance found, even if under target
}

export const SPAWN_POINT = findSpawnPoint();

// ── Street props ──────────────────────────────────────────────────────────────
// Lamp-post positions scattered across street ground (never inside a plot or
// the hub footprint) — small vertical props that break up the flat ground
// plane and add the oblique "walking through a place" feel the town square
// is going for, without needing a full elevation system.
function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    const crosses = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function generateStreetProps() {
  const rand = mulberry32(SEED + 1);
  const props = [];
  let attempts = 0;
  while (props.length < 26 && attempts < 6000) {
    attempts++;
    const x = CITY_X0 + MARGIN + rand() * (CITY_W - MARGIN * 2);
    const y = CITY_Y0 + MARGIN + rand() * (CITY_H - MARGIN * 2);
    if (Math.abs(x - HUB_BOUNDS.cx) < HUB_HALF_W + 50 && Math.abs(y - HUB_BOUNDS.cy) < HUB_HALF_H + 50) continue;
    if (PLOTS.some(p => pointInPolygon(x, y, p.points))) continue;
    if (props.some(q => Math.hypot(q.x - x, q.y - y) < 180)) continue;
    props.push({ x: Math.round(x), y: Math.round(y) });
  }
  return props;
}

export const STREET_PROPS = generateStreetProps();
