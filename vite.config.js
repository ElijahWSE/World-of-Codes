// vite.config.js — Vite dev server configuration
//
// WHY PROXYING: In GitHub Codespaces, each port gets its own HTTPS subdomain.
// The game loads from port 5173 and the Colyseus server runs on port 2567.
// Because these are different subdomains, the browser treats them as cross-origin
// and blocks unauthenticated requests (Private ports) and WebSocket connections.
//
// The fix: proxy Colyseus traffic through Vite (port 5173) so everything is
// same-origin. Path types proxied:
//   1. /matchmake/**   — HTTP matchmaking
//   2. /admin/**       — Admin panel (served by Express)
//   3. /api/**         — Public API (portal slots, submissions)
//   4. /rooms/**       — Room JS files served statically by Express (enables dynamic import)
//   5. /<pid>/<rid>    — WebSocket room connections (nanoid 9-char IDs)

export default {
  server: {
    proxy: {
      '/admin': {
        target: 'http://localhost:2567',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:2567',
        changeOrigin: true,
      },
      '/rooms': {
        target: 'http://localhost:2567',
        changeOrigin: true,
      },
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
