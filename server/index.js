// server/index.js — Colyseus multiplayer server + admin panel API
// Tracks all connected players in the shared town square ("world" room).
// Runs on port 2567. Clients connect via WebSocket from WorldScene.js.
// Admin panel is at /admin (proxied through Vite via port 5173).

import { Server, Room } from 'colyseus';
import { PlayerState, WorldState } from '../src/shared/schema.js';
import express from 'express';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

// ── Admin helpers ──────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT            = join(__dirname, '..');
const WORLD_SCENE     = join(ROOT, 'src', 'engine', 'WorldScene.js');
const ROOMS_DIR       = join(ROOT, 'src', 'rooms');
const ADMIN_HTML      = join(ROOT, 'admin.html');

// Change this password before sharing the project URL with anyone.
const ADMIN_PASSWORD  = 'worldofcodes';

// Fixed portal positions — must match the DOORS array in WorldScene.js.
const DOOR_CONFIG = {
  north: { key: 'room1', x:  580, y:  490, color: '0x8B5CF6', emptyLabel: 'Portal 1' },
  east:  { key: 'room2', x: 1220, y:  570, color: '0x10B981', emptyLabel: 'Portal 2' },
  south: { key: 'room3', x:  620, y: 1010, color: '0x3B82F6', emptyLabel: 'Portal 3' },
  west:  { key: 'room4', x: 1150, y:  950, color: '0xF59E0B', emptyLabel: 'Portal 4' },
};

function toKebabCase(str) {
  return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function toPascalCase(str) {
  // Split on anything that isn't a letter or digit so special chars never end up in a variable name.
  return str.trim().split(/[^a-zA-Z0-9]+/).filter(w => w).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns the content between the [DOOR-TYPE:door-start] and [DOOR-TYPE:door-end] markers.
function getBlock(content, type, door) {
  const s = `// [DOOR-${type}:${door}-start]`;
  const e = `// [DOOR-${type}:${door}-end]`;
  const m = content.match(new RegExp(`${escRe(s)}\n([\\s\\S]*?)${escRe(e)}`));
  return m ? m[1] : '';
}

// Replaces the content between markers with `inner` (or clears it if inner is falsy).
function replaceBlock(content, type, door, inner) {
  const s = `// [DOOR-${type}:${door}-start]`;
  const e = `// [DOOR-${type}:${door}-end]`;
  const re = new RegExp(`(${escRe(s)}\n)[\\s\\S]*?(${escRe(e)})`, 'g');
  return content.replace(re, (_, open, close) =>
    inner ? `${open}${inner}\n${close}` : `${open}${close}`
  );
}

// Reads WorldScene.js and returns the current room assignment for each door.
function readRooms() {
  const src = readFileSync(WORLD_SCENE, 'utf8');
  const result = {};
  for (const door of ['north', 'east', 'south', 'west']) {
    const block = getBlock(src, 'IMPORT', door).trim();
    const m = block.match(/import \* as (\w+) from '\.\.\/rooms\/([^']+)'/);
    result[door] = m ? { varName: m[1], fileName: m[2] } : null;
  }
  return result;
}

// Writes a room file and patches WorldScene.js to assign it to a door.
function applyRoom(door, varName, fileName, code) {
  const cfg = DOOR_CONFIG[door];
  writeFileSync(join(ROOMS_DIR, fileName), code, 'utf8');
  let src = readFileSync(WORLD_SCENE, 'utf8');
  src = replaceBlock(src, 'IMPORT', door,
    `import * as ${varName} from '../rooms/${fileName}';`);
  src = replaceBlock(src, 'ENTRY', door,
    `  { key: '${cfg.key}', label: ${varName}.name, x: ${cfg.x}, y: ${cfg.y}, color: ${cfg.color}, roomModule: ${varName} },`);
  writeFileSync(WORLD_SCENE, src, 'utf8');
}

// Parses the code with Node without executing it. Returns an error string or null.
function checkSyntax(code) {
  const tmp = join(tmpdir(), `woc_check_${Date.now()}.mjs`);
  try {
    writeFileSync(tmp, code, 'utf8');
    execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
    return null; // valid
  } catch (e) {
    const raw = (e.stderr?.toString() || e.message || '').replace(tmp, 'room.js');
    // Keep only the relevant lines (skip internal Node stack frames)
    const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('    at '));
    return lines.slice(0, 4).join('\n') || 'Syntax error (unknown)';
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

// Clears a door in WorldScene.js (leaves the file in src/rooms/ untouched).
function clearRoom(door) {
  const cfg = DOOR_CONFIG[door];
  let src = readFileSync(WORLD_SCENE, 'utf8');
  src = replaceBlock(src, 'IMPORT', door, '');
  src = replaceBlock(src, 'ENTRY', door,
    `  { key: '${cfg.key}', label: '${cfg.emptyLabel}', x: ${cfg.x}, y: ${cfg.y}, color: ${cfg.color} },`);
  writeFileSync(WORLD_SCENE, src, 'utf8');
}

// ── World Room ─────────────────────────────────────────────────────────────
// One instance of WorldRoom exists at all times. All players share it.
class WorldRoom extends Room {
  maxClients = 50;

  onCreate() {
    this.setState(new WorldState());

    // Listen for movement updates from clients.
    // Clients send { x, y } whenever their position changes.
    this.onMessage('move', (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.x = data.x;
        player.y = data.y;
      }
    });

    console.log('[WorldRoom] Created — waiting for players');
  }

  onJoin(client, options) {
    const player = new PlayerState();
    // Spawn at world center (1600/2, 1200/2). Matches WorldScene spawn point.
    player.x    = 800;
    player.y    = 600;
    // Truncate name to 20 chars to prevent oversized labels in-game.
    player.name = String(options?.name ?? `Player_${client.sessionId.slice(0, 4)}`).slice(0, 20);

    this.state.players.set(client.sessionId, player);
    console.log(`[WorldRoom] ${player.name} joined (${this.clients.length} online)`);
  }

  onLeave(client) {
    const player = this.state.players.get(client.sessionId);
    if (player) console.log(`[WorldRoom] ${player.name} left`);
    this.state.players.delete(client.sessionId);
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
// The `express` callback runs before Colyseus mounts its own routes, so we
// can add CORS headers here. This is required in GitHub Codespaces because
// the matchmaking HTTP request comes from a different subdomain (port 5173)
// than the server (port 2567), which the browser treats as cross-origin.
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

    // ── Admin panel ────────────────────────────────────────────────────────
    app.get('/admin', (req, res) => {
      if (!existsSync(ADMIN_HTML)) return res.status(404).send('admin.html not found');
      res.sendFile(ADMIN_HTML);
    });

    // No password needed — this is read-only and writes nothing to disk.
    app.post('/admin/validate', (req, res) => {
      const { code } = req.body ?? {};
      if (!code?.trim()) return res.status(400).json({ error: 'No code provided' });
      const syntaxError = checkSyntax(code);
      res.json({ ok: !syntaxError, syntaxError: syntaxError || null });
    });

    app.get('/admin/rooms', (req, res) => {
      try {
        res.json(readRooms());
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post('/admin/approve', (req, res) => {
      const { password, door, roomName, code } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      if (!DOOR_CONFIG[door])          return res.status(400).json({ error: 'Invalid door' });
      if (!roomName?.trim())           return res.status(400).json({ error: 'Room name is required' });
      if (!code?.trim())               return res.status(400).json({ error: 'Room code is required' });
      try {
        const varName  = toPascalCase(roomName);
        const fileName = toKebabCase(roomName) + '.js';
        applyRoom(door, varName, fileName, code);
        console.log(`[Admin] Approved room "${roomName}" → ${door} door (${fileName})`);
        res.json({ ok: true, varName, fileName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post('/admin/remove', (req, res) => {
      const { password, door } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      if (!DOOR_CONFIG[door])          return res.status(400).json({ error: 'Invalid door' });
      try {
        clearRoom(door);
        console.log(`[Admin] Cleared ${door} door`);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  }
});
gameServer.define('world', WorldRoom);

const PORT = 2567;
gameServer.listen(PORT).then(() => {
  console.log(`[Colyseus] Listening on ws://localhost:${PORT}`);
});
