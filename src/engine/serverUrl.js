// src/engine/serverUrl.js — Phase 17: base URL for the Colyseus/Express
// backend, needed once the frontend (Firebase Hosting) and backend
// (Railway) live on different origins. In dev, VITE_COLYSEUS_URL is unset
// and vite.config.js's proxy already makes relative paths same-origin, so
// apiUrl()/wsUrl() are no-ops — identical to pre-Phase-17 behavior.
//
// GOTCHA (found 2026-07-27): this Codespace has VITE_COLYSEUS_URL set as a
// shell-level env var/secret (pointing at the production Railway URL) —
// Vite picks up any VITE_-prefixed var already in process.env regardless of
// .env files, so plain `vite`/`npm run dev` silently talks to production
// instead of the local server, with no visible error (requests to a
// cross-origin prod host just hang/fail CORS). package.json's "dev" script
// explicitly clears it (`VITE_COLYSEUS_URL= vite`) so local dev is actually
// local — "build"/"deploy" deliberately don't, since a real deploy needs it.
//
// `import.meta.env` is Vite-only and doesn't exist under plain Node — this
// module is transitively imported by server/index.js via
// CharacterRenderer.js (which is deliberately server-safe, see its own
// header comment), so `import.meta.env` itself must be optional-chained,
// not just the property read off it, or the server crashes at boot.
const BASE = import.meta.env?.VITE_COLYSEUS_URL?.replace(/\/$/, '') ?? '';

export function apiUrl(path) {
  return BASE + path;
}

export function wsUrl() {
  if (BASE) return BASE.replace(/^http/, 'ws');
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}`;
}
