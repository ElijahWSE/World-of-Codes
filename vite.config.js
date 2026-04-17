// vite.config.js — Vite dev server configuration
//
// WHY PROXYING: In GitHub Codespaces, each port gets its own HTTPS subdomain.
// The game loads from port 5173 and the Colyseus server runs on port 2567.
// Because these are different subdomains, the browser treats them as cross-origin
// and blocks unauthenticated requests (Private ports) and WebSocket connections.
//
// The fix: proxy Colyseus traffic through Vite (port 5173) so everything is
// same-origin. Two path types need proxying:
//   1. /matchmake/** — HTTP matchmaking requests (POST, GET)
//   2. /<processId>/<roomId> — WebSocket room connections
//      processId and roomId are nanoid(9): 9 alphanumeric chars each.
//      The regex below matches exactly this pattern and nothing else,
//      so Vite asset paths like /src/engine/... are unaffected.

export default {
  server: {
    proxy: {
      // Admin panel (served by the Express/Colyseus server)
      '/admin': {
        target: 'http://localhost:2567',
        changeOrigin: true,
      },
      // HTTP matchmaking
      '/matchmake': {
        target: 'http://localhost:2567',
        changeOrigin: true,
      },
      // WebSocket room connections: /<processId>/<roomId>?sessionId=...
      '^/[A-Za-z0-9_-]{9}/[A-Za-z0-9_-]{9}': {
        target: 'ws://localhost:2567',
        changeOrigin: true,
        ws: true,
      },
    },
  },
};
