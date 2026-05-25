// server/index.js — Colyseus multiplayer server + admin API
// Tracks all connected players in the shared town square ("world" room).
// Runs on port 2567. Admin panel at /admin. Public API at /api/*.

import { Server, Room } from 'colyseus';
import { PlayerState, WorldState } from '../src/shared/schema.js';
import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const ROOMS_DIR  = join(ROOT, 'src', 'rooms');
const ADMIN_HTML = join(ROOT, 'admin.html');
const DATA_DIR   = join(__dirname, 'data');
const SLOTS_FILE = join(DATA_DIR, 'slots.json');

const ADMIN_PASSWORD = 'worldofcodes';

// ── 20 Portal Slot Positions ──────────────────────────────────────────────────
// These positions are scattered across the 1600×1200 world, avoiding the player
// spawn area (~800,600) and the notice board (800,750).
const PORTAL_SLOTS = [
  { key: 'slot01', x:  350, y:  420, color: 0x8B5CF6 },
  { key: 'slot02', x:  580, y:  490, color: 0x10B981 },
  { key: 'slot03', x:  900, y:  380, color: 0xF59E0B },
  { key: 'slot04', x: 1150, y:  430, color: 0xEC4899 },
  { key: 'slot05', x: 1360, y:  510, color: 0x3B82F6 },
  { key: 'slot06', x: 1480, y:  680, color: 0xEF4444 },
  { key: 'slot07', x: 1300, y:  820, color: 0x14B8A6 },
  { key: 'slot08', x: 1150, y:  950, color: 0xF97316 },
  { key: 'slot09', x:  980, y: 1080, color: 0xA855F7 },
  { key: 'slot10', x:  750, y: 1100, color: 0x06B6D4 },
  { key: 'slot11', x:  530, y: 1010, color: 0x84CC16 },
  { key: 'slot12', x:  320, y:  980, color: 0xF97316 },
  { key: 'slot13', x:  180, y:  820, color: 0x6366F1 },
  { key: 'slot14', x:  270, y:  650, color: 0xDB2777 },
  { key: 'slot15', x: 1050, y:  560, color: 0x0EA5E9 },
  { key: 'slot16', x:  700, y:  440, color: 0xD97706 },
  { key: 'slot17', x: 1200, y:  700, color: 0x22C55E },
  { key: 'slot18', x:  450, y:  750, color: 0x7C3AED },
  { key: 'slot19', x:  640, y:  880, color: 0xEC4899 },
  { key: 'slot20', x: 1380, y:  350, color: 0x22C55E },
];

// ── In-memory state ───────────────────────────────────────────────────────────
// slotAssignments: Map<slotKey, { fileName, roomName, claimedBy, gameFileName? }>
const slotAssignments   = new Map();
const pendingSubmissions = new Map(); // id → PendingSubmission
const pendingGames       = new Map(); // id → PendingGame
let   worldRoomInstance  = null;      // set in WorldRoom.onCreate()

// Load persisted slot assignments on startup
if (existsSync(SLOTS_FILE)) {
  try {
    const saved = JSON.parse(readFileSync(SLOTS_FILE, 'utf8'));
    for (const [key, val] of Object.entries(saved)) slotAssignments.set(key, val);
    console.log(`[Server] Loaded ${slotAssignments.size} room slot(s) from disk`);
  } catch (e) {
    console.error('[Server] Failed to load slots.json:', e.message);
  }
}

// Seed with the 4 pre-existing rooms if running for the first time
if (slotAssignments.size === 0) {
  const seeds = [
    { key: 'slot01', fileName: 'example-room.js',       roomName: 'Example Room',       claimedBy: 'admin' },
    { key: 'slot02', fileName: 'underwater-world.js',    roomName: 'Underwater World',   claimedBy: 'admin' },
    { key: 'slot03', fileName: 'basket-ball-court.js',   roomName: 'Basketball Court',   claimedBy: 'admin' },
    { key: 'slot04', fileName: 'vibrant-city-center.js', roomName: 'Vibrant City Center',claimedBy: 'admin' },
  ];
  for (const s of seeds) slotAssignments.set(s.key, { fileName: s.fileName, roomName: s.roomName, claimedBy: s.claimedBy });
  persistSlots();
  console.log('[Server] Seeded 4 default rooms into slot assignments');
}

function persistSlots() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SLOTS_FILE, JSON.stringify(Object.fromEntries(slotAssignments), null, 2), 'utf8');
}

function buildSlotList() {
  return PORTAL_SLOTS.map(slot => {
    const a = slotAssignments.get(slot.key);
    return {
      key:          slot.key,
      x:            slot.x,
      y:            slot.y,
      color:        slot.color,
      fileName:     a?.fileName     ?? null,
      roomName:     a?.roomName     ?? null,
      claimedBy:    a?.claimedBy    ?? null,
      gameFileName: a?.gameFileName ?? null,
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toKebabCase(str) {
  return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function checkSyntax(code) {
  const tmp = join(tmpdir(), `woc_check_${Date.now()}.mjs`);
  try {
    writeFileSync(tmp, code, 'utf8');
    execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
    return null;
  } catch (e) {
    const raw = (e.stderr?.toString() || e.message || '').replace(tmp, 'room.js');
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('    at '));
    return lines.slice(0, 4).join('\n') || 'Syntax error (unknown)';
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

function validateRoomCode(code) {
  const errors = [];
  if (/<(?:div|span|p|h[1-6]|ul|li|button|input|form)\b/i.test(code) || /className\s*=/.test(code))
    errors.push('Contains JSX or HTML tags');
  if (/^\s*import\s+/m.test(code) || /require\s*\(/.test(code))
    errors.push('Contains import or require statements');
  if (!/export\s+const\s+name\s*=/.test(code))
    errors.push('Missing: export const name');
  if (!/export\s+(function\s+onLoad|const\s+onLoad\s*=)/.test(code))
    errors.push('Missing: export function onLoad');
  if (!/export\s+(function\s+onCreate|const\s+onCreate\s*=)/.test(code))
    errors.push('Missing: export function onCreate');
  if (!/export\s+(function\s+onUpdate|const\s+onUpdate\s*=)/.test(code))
    errors.push('Missing: export function onUpdate');
  if (!/export\s+(function\s+onExit|const\s+onExit\s*=)/.test(code))
    errors.push('Missing: export function onExit');
  const syntaxErr = checkSyntax(code);
  if (syntaxErr) errors.push(`Syntax error: ${syntaxErr}`);
  return errors;
}

function validateGameCode(code) {
  const errors = [];
  if (/^\s*import\s+/m.test(code) || /require\s*\(/.test(code))
    errors.push('Contains import or require statements');
  if (!/export\s+const\s+game\s*=/.test(code))
    errors.push('Missing: export const game');
  if (!/gameName/.test(code))   errors.push('Missing: game.gameName');
  if (!/onGameCreate/.test(code)) errors.push('Missing: game.onGameCreate');
  if (!/onGameUpdate/.test(code)) errors.push('Missing: game.onGameUpdate');
  if (!/onGameExit/.test(code))   errors.push('Missing: game.onGameExit');
  const syntaxErr = checkSyntax(code);
  if (syntaxErr) errors.push(`Syntax error: ${syntaxErr}`);
  return errors;
}

function notifyPlayer(sessionId, type, message) {
  if (!worldRoomInstance || !sessionId) return;
  const client = worldRoomInstance.clients.find(c => c.sessionId === sessionId);
  client?.send('notification', { type, message });
}

function broadcastSlotsUpdated() {
  worldRoomInstance?.broadcast('slotsUpdated', {});
}

// ── World Room ─────────────────────────────────────────────────────────────────
class WorldRoom extends Room {
  maxClients = 50;

  onCreate() {
    worldRoomInstance = this;
    this.setState(new WorldState());

    this.onMessage('move', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) { player.x = data.x; player.y = data.y; }
    });

    this.onMessage('enterRoom', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.currentRoom = String(data?.key ?? 'world').slice(0, 32);
    });

    this.onMessage('roomMove', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) { player.roomX = data.x; player.roomY = data.y; }
    });

    this.onMessage('exitRoom', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.currentRoom = 'world';
    });

    console.log('[WorldRoom] Created — waiting for players');
  }

  onJoin(client, options) {
    const player  = new PlayerState();
    player.x      = 800;
    player.y      = 600;
    player.name   = String(options?.name ?? `Player_${client.sessionId.slice(0, 4)}`).slice(0, 20);
    this.state.players.set(client.sessionId, player);
    console.log(`[WorldRoom] ${player.name} joined (${this.clients.length} online)`);
  }

  onLeave(client) {
    const player = this.state.players.get(client.sessionId);
    if (player) console.log(`[WorldRoom] ${player.name} left`);
    this.state.players.delete(client.sessionId);
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────────
const gameServer = new Server({
  express: (app) => {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });
    app.use(express.json({ limit: '500kb' }));

    // Room JS files served as static assets — dynamic import('/rooms/...') works
    app.use('/rooms', express.static(ROOMS_DIR));

    // ── Admin panel ────────────────────────────────────────────────────────────
    app.get('/admin', (req, res) => {
      if (!existsSync(ADMIN_HTML)) return res.status(404).send('admin.html not found');
      res.sendFile(ADMIN_HTML);
    });

    // Code syntax check — no password, write-nothing
    app.post('/admin/validate', (req, res) => {
      const { code } = req.body ?? {};
      if (!code?.trim()) return res.status(400).json({ error: 'No code provided' });
      const syntaxError = checkSyntax(code);
      res.json({ ok: !syntaxError, syntaxError: syntaxError || null });
    });

    // ── Public API ─────────────────────────────────────────────────────────────
    app.get('/api/portal-slots', (_req, res) => {
      res.json({ slots: buildSlotList() });
    });

    // Player submits room code from in-game claim overlay
    app.post('/api/submit-room', (req, res) => {
      const { slotKey, playerName, sessionId, code } = req.body ?? {};
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      if (!playerName?.trim())
        return res.status(400).json({ error: 'Player name required' });
      if (!code?.trim())
        return res.status(400).json({ error: 'Room code required' });
      if (slotAssignments.has(slotKey))
        return res.status(400).json({ error: 'That portal is already taken' });
      for (const sub of pendingSubmissions.values()) {
        if (sub.slotKey === slotKey)
          return res.status(400).json({ error: 'That portal already has a pending submission' });
      }
      const errors = validateRoomCode(code);
      if (errors.length > 0)
        return res.status(400).json({ errors });
      const id = `room_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      pendingSubmissions.set(id, {
        id, slotKey, playerName: playerName.trim(),
        sessionId: sessionId ?? null, code, submittedAt: Date.now(),
      });
      console.log(`[Submit] Room from "${playerName}" for slot ${slotKey}`);
      res.json({ ok: true, message: 'Submitted! The admin will review your world soon.' });
    });

    // Admin submits game code for a slot (via admin panel)
    app.post('/api/submit-game', (req, res) => {
      const { slotKey, submittedBy, sessionId, code } = req.body ?? {};
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      if (!slotAssignments.has(slotKey))
        return res.status(400).json({ error: 'No room approved for that slot yet' });
      if (!code?.trim())
        return res.status(400).json({ error: 'Game code required' });
      const errors = validateGameCode(code);
      if (errors.length > 0)
        return res.status(400).json({ errors });
      const id = `game_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      pendingGames.set(id, {
        id, slotKey, submittedBy: submittedBy ?? 'admin',
        sessionId: sessionId ?? null, code, submittedAt: Date.now(),
      });
      console.log(`[Submit] Game for slot ${slotKey}`);
      res.json({ ok: true, message: 'Game submitted for review.' });
    });

    // ── Admin: list pending ────────────────────────────────────────────────────
    app.get('/admin/pending-rooms', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      res.json([...pendingSubmissions.values()].map(s => ({
        ...s, codePreview: s.code.slice(0, 300), code: undefined,
      })));
    });

    app.get('/admin/pending-games', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      res.json([...pendingGames.values()].map(g => ({
        ...g, codePreview: g.code.slice(0, 300), code: undefined,
      })));
    });

    // Full code for a specific submission (admin review)
    app.get('/admin/pending-rooms/:id/code', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = pendingSubmissions.get(req.params.id);
      if (!sub) return res.status(404).json({ error: 'Not found' });
      res.json({ code: sub.code });
    });

    app.get('/admin/pending-games/:id/code', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const g = pendingGames.get(req.params.id);
      if (!g) return res.status(404).json({ error: 'Not found' });
      res.json({ code: g.code });
    });

    // ── Admin: approve / reject ────────────────────────────────────────────────
    app.post('/admin/approve-room', (req, res) => {
      const { password, submissionId } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = pendingSubmissions.get(submissionId);
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      try {
        const fileName = toKebabCase(sub.playerName) + '.js';
        writeFileSync(join(ROOMS_DIR, fileName), sub.code, 'utf8');
        slotAssignments.set(sub.slotKey, { fileName, roomName: sub.playerName, claimedBy: sub.playerName });
        persistSlots();
        pendingSubmissions.delete(submissionId);
        notifyPlayer(sub.sessionId, 'approved',
          `Your world "${sub.playerName}" was approved! Find your portal in the town square.`);
        broadcastSlotsUpdated();
        console.log(`[Admin] Approved room "${sub.playerName}" → ${sub.slotKey} (${fileName})`);
        res.json({ ok: true, fileName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post('/admin/reject-room', (req, res) => {
      const { password, submissionId, reason } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = pendingSubmissions.get(submissionId);
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      pendingSubmissions.delete(submissionId);
      notifyPlayer(sub.sessionId, 'rejected',
        `Your world submission was not approved. ${reason ? 'Reason: ' + reason : 'Please check your code and resubmit.'}`);
      console.log(`[Admin] Rejected room from "${sub.playerName}"`);
      res.json({ ok: true });
    });

    app.post('/admin/approve-game', (req, res) => {
      const { password, submissionId } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = pendingGames.get(submissionId);
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      const slot = slotAssignments.get(sub.slotKey);
      if (!slot) return res.status(400).json({ error: 'Target room slot no longer exists' });
      try {
        const gameFileName = `game-${sub.slotKey}.js`;
        writeFileSync(join(ROOMS_DIR, gameFileName), sub.code, 'utf8');
        slot.gameFileName = gameFileName;
        slotAssignments.set(sub.slotKey, slot);
        persistSlots();
        pendingGames.delete(submissionId);
        notifyPlayer(sub.sessionId, 'approved', 'Your mini-game was approved! It\'s now live in your portal.');
        broadcastSlotsUpdated();
        console.log(`[Admin] Approved game for slot ${sub.slotKey} (${gameFileName})`);
        res.json({ ok: true, gameFileName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post('/admin/reject-game', (req, res) => {
      const { password, submissionId, reason } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = pendingGames.get(submissionId);
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      pendingGames.delete(submissionId);
      notifyPlayer(sub.sessionId, 'rejected',
        `Your game submission was not approved. ${reason ? 'Reason: ' + reason : ''}`);
      res.json({ ok: true });
    });

    // ── Admin: manage slots ────────────────────────────────────────────────────
    app.post('/admin/remove-room', (req, res) => {
      const { password, slotKey } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      slotAssignments.delete(slotKey);
      persistSlots();
      broadcastSlotsUpdated();
      console.log(`[Admin] Cleared slot ${slotKey}`);
      res.json({ ok: true });
    });

    // Admin direct-assign a room to a slot (bypasses player submission flow)
    app.post('/admin/assign-room', (req, res) => {
      const { password, slotKey, roomName, code } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      if (!PORTAL_SLOTS.find(s => s.key === slotKey)) return res.status(400).json({ error: 'Invalid slot' });
      if (!roomName?.trim()) return res.status(400).json({ error: 'Room name required' });
      if (!code?.trim())     return res.status(400).json({ error: 'Room code required' });
      const errors = validateRoomCode(code);
      if (errors.length > 0) return res.status(400).json({ errors });
      try {
        const fileName = toKebabCase(roomName) + '.js';
        writeFileSync(join(ROOMS_DIR, fileName), code, 'utf8');
        slotAssignments.set(slotKey, { fileName, roomName: roomName.trim(), claimedBy: 'admin' });
        persistSlots();
        broadcastSlotsUpdated();
        console.log(`[Admin] Assigned room "${roomName}" → ${slotKey} (${fileName})`);
        res.json({ ok: true, fileName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  },
});

gameServer.define('world', WorldRoom);

const PORT = 2567;
gameServer.listen(PORT).then(() => {
  console.log(`[Colyseus] Listening on ws://localhost:${PORT}`);
});
