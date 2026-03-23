// server/index.js — Colyseus multiplayer server
// Tracks all connected players in the shared town square ("world" room).
// Runs on port 2567. Clients connect via WebSocket from WorldScene.js.
//
// Adding a new player: happens automatically in onJoin — no changes needed here.
// Adding a new room type for Phase 4+: call gameServer.define() with a new Room class.

import { Server, Room } from 'colyseus';
import { PlayerState, WorldState } from '../src/shared/schema.js';

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
  }
});
gameServer.define('world', WorldRoom);

const PORT = 2567;
gameServer.listen(PORT).then(() => {
  console.log(`[Colyseus] Listening on ws://localhost:${PORT}`);
});
