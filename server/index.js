// server/index.js — Colyseus multiplayer server + admin API
// Tracks all connected players in the shared town square ("world" room).
// Runs on port 2567. Admin panel at /admin. Public API at /api/*.

import { Server, Room } from 'colyseus';
import { PlayerState, WorldState } from '../src/shared/schema.js';
import { PLOTS as PORTAL_SLOTS } from '../src/shared/townSquareLayout.js';
import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import admin from 'firebase-admin';
import { getKind } from '../src/creation-kinds/index.js';
import { sanitizeConfig } from '../src/engine/CharacterRenderer.js';
import { sanitizeObjectConfig } from '../src/engine/ObjectRenderer.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const ROOMS_DIR  = join(ROOT, 'src', 'rooms');
const OBJECTS_DIR = join(ROOT, 'src', 'objects'); // interactive-object files (Phase 11 milestone 3)
const ADMIN_HTML = join(ROOT, 'admin.html');
const DATA_DIR   = join(__dirname, 'data');
const SLOTS_FILE = join(DATA_DIR, 'slots.json');

const ADMIN_PASSWORD = 'worldofcodes';

// Room world bounds — same size as RoomScene.js's ROOM_W/ROOM_H (and the
// town square, per _template.js) — used only to clamp incoming object x/y.
const ROOM_W = 1600;
const ROOM_H = 1200;

// ── Firebase Admin (Phase 9A) ─────────────────────────────────────────────────
// Service account is never a committed file — loaded from the
// FIREBASE_SERVICE_ACCOUNT_JSON Codespaces secret at boot.
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
});
const db = admin.firestore();

// ── 20 Portal Slot Positions ──────────────────────────────────────────────────
// These positions are scattered across the 1600×1200 world, avoiding the player
// spawn area (~800,600) and the notice board (800,750).
// PORTAL_SLOTS now comes from the shared, generated town-square layout
// (src/shared/townSquareLayout.js) — same import the client uses, so the
// two can never drift out of sync the way the old hand-duplicated arrays did.

// ── In-memory state ───────────────────────────────────────────────────────────
// slotAssignments: Map<slotKey, { fileName, roomName, claimedBy, uid?, gameFileName? }>
const slotAssignments  = new Map();
// submissions: Map<id, { id, kind, slotKey, uid, displayName, sessionId, code, submittedAt, isUpdate }>
// One queue for every creation kind — see src/creation-kinds/*.js for what a kind declares.
const submissions       = new Map();
// objectsCache: Map<id, { id, roomSlotKey, subKind, ownerUid, x, y, movable,
//                         linkedArtifacts, shapeConfig?, fileName?, createdAt, updatedAt }>
// Additive store, separate from slotAssignments — objects don't fit the
// "one file swapped wholesale" model rooms/games use (Phase 11 decision, see
// PROJECT_BRIEF.md's Firestore scope note). Firestore is the source of
// truth; this Map is an in-memory read cache, same role slotAssignments
// plays for slots.json.
const objectsCache      = new Map();
// processLogsCache: Map<slotKey, { slotKey, past, present, future, updatedAt }>
// One Process Log per room slot (Phase 12) — additive collection, same
// write-through-cache role as objectsCache, keyed directly by slotKey since
// there's exactly one log per room (no generated id needed).
const processLogsCache = new Map();
// creationMetaCache: Map<creationKey, { creationKey, kind, slotKey, ownerUid,
//                          shared, remixedFrom, versions: [{versionId,
//                          description, displayName, uid, createdAt, code}] }>
// Phase 13 — sharing/remix/version-history metadata, additive, same
// write-through-cache role as objectsCache/processLogsCache. creationKey is
// slotKey for room, `game:${slotKey}`/`music:${slotKey}` for game/music, and
// the object's own doc id for interactive objects (see creationKeyFor()).
// Decorative objects never get an entry — they never touch /api/submit.
const creationMetaCache = new Map();
// feedbackCache: Map<feedbackId, { feedbackId, slotKey, about, source,
//                     authorUid, authorName, text, response, respondedAt,
//                     inPersonSessionId, createdAt }>
// Phase 14 — one thread per room (not per creation-kind, unlike
// creationMeta), so this is keyed by a generated id and filtered by
// slotKey on read, same shape/role as objectsCache.
const feedbackCache = new Map();
// Single global switch, admin-controlled (Phase 14) — off by default so
// unsupervised/solo play never exposes unmoderated online feedback.
// Self-recorded feedback is never gated by this.
let onlineFeedbackEnabled = false;
// sessionsCache: Map<sessionId, { sessionId, hostUid, roster: [uid],
//                     startedAt, endedAt, status: 'active'|'ended' }>
// Phase 15 — admin-started in-person sessions, additive collection, same
// write-through-cache role as objectsCache/feedbackCache/etc. Not to be
// confused with a Colyseus client's `sessionId` (the connection id used
// everywhere else in this file) — this is a Firestore doc id for a
// facilitated group session, hence the `inPersonSessionId` naming used on
// feedback entries above to keep the two concepts unambiguous.
const sessionsCache = new Map();
// sessionRoomInstances: Map<sessionId, Room> — in-memory only, never
// persisted. The session-scoped equivalent of the singleton
// worldRoomInstance below, needed so /admin/session/end can find and
// disconnect the live Colyseus room for a given session.
const sessionRoomInstances = new Map();
let   worldRoomInstance = null; // set in WorldRoom.onCreate()

// sessionEndTimers: Map<sessionId, { timeout, endsAt }> — in-memory only,
// same tradeoff as sessionRoomInstances above (lost on server restart, in
// which case the session just stays 'active' until admin clicks End Session
// again). Tracks the 60s heads-up grace period between admin clicking "End
// Session" and the session actually finalizing, so players get a countdown
// (and a chance to leave early) instead of an abrupt disconnect.
const sessionEndTimers = new Map();
const SESSION_END_GRACE_MS = 60_000;

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

// Load persisted objects from Firestore on startup (top-level await — this
// module is ESM). Unlike slots.json, objects live in Firestore from day one
// per the Phase 11 persistence decision, so there's no local-file fallback.
try {
  const objectsSnap = await db.collection('objects').get();
  objectsSnap.forEach(doc => objectsCache.set(doc.id, { id: doc.id, ...doc.data() }));
  console.log(`[Server] Loaded ${objectsCache.size} object(s) from Firestore`);
} catch (e) {
  console.error('[Server] Failed to load objects from Firestore:', e.message);
}

// Load persisted Process Logs from Firestore on startup (Phase 12), same
// pattern as objects above.
try {
  const logsSnap = await db.collection('processLogs').get();
  logsSnap.forEach(doc => processLogsCache.set(doc.id, doc.data()));
  console.log(`[Server] Loaded ${processLogsCache.size} process log(s) from Firestore`);
} catch (e) {
  console.error('[Server] Failed to load process logs from Firestore:', e.message);
}

// Load persisted creation-sharing/version-history metadata from Firestore on
// startup (Phase 13), same pattern as objects/process logs above.
try {
  const metaSnap = await db.collection('creationMeta').get();
  metaSnap.forEach(doc => creationMetaCache.set(doc.id, doc.data()));
  console.log(`[Server] Loaded ${creationMetaCache.size} creation-meta record(s) from Firestore`);
} catch (e) {
  console.error('[Server] Failed to load creation meta from Firestore:', e.message);
}

// Load persisted feedback + the global online-feedback toggle from
// Firestore on startup (Phase 14), same pattern as objects/process
// logs/creation meta above.
try {
  const feedbackSnap = await db.collection('feedback').get();
  feedbackSnap.forEach(doc => feedbackCache.set(doc.id, doc.data()));
  console.log(`[Server] Loaded ${feedbackCache.size} feedback entr(y/ies) from Firestore`);
} catch (e) {
  console.error('[Server] Failed to load feedback from Firestore:', e.message);
}
// Load persisted in-person sessions from Firestore on startup (Phase 15),
// same pattern as objects/process logs/creation meta/feedback above.
try {
  const sessionsSnap = await db.collection('sessions').get();
  sessionsSnap.forEach(doc => sessionsCache.set(doc.id, doc.data()));
  console.log(`[Server] Loaded ${sessionsCache.size} session(s) from Firestore`);
} catch (e) {
  console.error('[Server] Failed to load sessions from Firestore:', e.message);
}
try {
  const configSnap = await db.collection('config').doc('global').get();
  onlineFeedbackEnabled = !!configSnap.data()?.onlineFeedbackEnabled;
  console.log(`[Server] Online feedback is ${onlineFeedbackEnabled ? 'ON' : 'OFF'}`);
} catch (e) {
  console.error('[Server] Failed to load global config from Firestore:', e.message);
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
      musicFileName: a?.musicFileName ?? null,
      // Lets the client show/enforce the ownership lock on [U] Update
      // before submission, not just reject it server-side afterward.
      uid:          a?.uid          ?? null,
      // Bump on every approved write so the client can cache-bust its
      // dynamic import() — updates intentionally reuse the same fileName
      // (see room.js's fileNameFor), and browsers cache ES modules by URL,
      // so without a changing query param an approved update never
      // actually reaches players already holding the old module.
      roomVersion:  a?.roomVersion  ?? null,
      gameVersion:  a?.gameVersion  ?? null,
      musicVersion: a?.musicVersion ?? null,
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

// Validates code against a creation kind's structural rules plus a real
// `node --check` syntax pass. The one real validator — used by /api/submit,
// /admin/validate, and /admin/assign-room alike.
function validateCode(kindName, code) {
  const kindMod = getKind(kindName);
  const errors  = kindMod.validate(code);
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
  for (const room of sessionRoomInstances.values()) room.broadcast('slotsUpdated', {});
}

function broadcastObjectsUpdated() {
  worldRoomInstance?.broadcast('objectsUpdated', {});
  for (const room of sessionRoomInstances.values()) room.broadcast('objectsUpdated', {});
}

// Writes through to Firestore first, then updates the read cache — so a
// failed write never leaves the in-memory cache disagreeing with the
// source of truth.
async function persistObject(obj) {
  await db.collection('objects').doc(obj.id).set(obj);
  objectsCache.set(obj.id, obj);
}

async function deleteObjectRecord(id) {
  await db.collection('objects').doc(id).delete();
  objectsCache.delete(id);
}

// Writes through to Firestore first, then updates the read cache — same
// rationale as persistObject above. Keyed by slotKey (the doc id), since
// there's exactly one Process Log per room.
async function persistProcessLog(log) {
  await db.collection('processLogs').doc(log.slotKey).set(log);
  processLogsCache.set(log.slotKey, log);
}

// Phase 13 — stable identifier for a creation across kinds. There's no
// unified creations/{id} collection in this codebase (room/game/music live
// as files + slotAssignments fields, objects live in their own Firestore
// docs), so this derives one: bare slotKey for room, a kind-prefixed key for
// game/music (a slot can have one of each alongside its room), and the
// object's own doc id for interactive objects (already globally unique,
// generated at first submission, so it can never collide with a slotNN key).
function creationKeyFor(kind, slotKey, objectId) {
  if (kind === 'object') return objectId;
  if (kind === 'room') return slotKey;
  return `${kind}:${slotKey}`; // game / music
}

// Writes through to Firestore first, then updates the read cache — same
// rationale as persistObject above. Keyed by creationKey (the doc id).
async function persistCreationMeta(meta) {
  await db.collection('creationMeta').doc(meta.creationKey).set(meta);
  creationMetaCache.set(meta.creationKey, meta);
}

// Writes through to Firestore first, then updates the read cache — same
// rationale as persistObject above. Keyed by feedbackId (the doc id).
async function persistFeedback(entry) {
  await db.collection('feedback').doc(entry.feedbackId).set(entry);
  feedbackCache.set(entry.feedbackId, entry);
}

// Writes through to Firestore first, then updates the read cache — same
// rationale as persistObject above. Keyed by sessionId (the doc id).
async function persistSession(entry) {
  await db.collection('sessions').doc(entry.sessionId).set(entry);
  sessionsCache.set(entry.sessionId, entry);
}

async function persistGlobalConfig() {
  await db.collection('config').doc('global').set({ onlineFeedbackEnabled });
}

function clampCoord(v, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
}

// ── World Room ─────────────────────────────────────────────────────────────────
// Shared by WorldRoom and SessionRoom (Phase 15) — movement/room-tracking
// messages are identical in both; only instance-tracking and the join gate
// differ, so those stay in each class's own onCreate/onAuth.
function registerWorldMessages(room) {
  room.onMessage('move', (client, data) => {
    const player = room.state.players.get(client.sessionId);
    if (player) { player.x = data.x; player.y = data.y; }
  });

  room.onMessage('enterRoom', (client, data) => {
    const player = room.state.players.get(client.sessionId);
    if (player) player.currentRoom = String(data?.key ?? 'world').slice(0, 32);
  });

  room.onMessage('roomMove', (client, data) => {
    const player = room.state.players.get(client.sessionId);
    if (player) { player.roomX = data.x; player.roomY = data.y; }
  });

  room.onMessage('exitRoom', (client) => {
    const player = room.state.players.get(client.sessionId);
    if (player) player.currentRoom = 'world';
  });
}

// Shared by WorldRoom and SessionRoom (Phase 15) — identical join/leave
// bookkeeping in both; only the log label differs.
async function joinWorldPlayer(room, client, options, label) {
  const player  = new PlayerState();
  player.x      = 800;
  player.y      = 600;
  player.name   = String(options?.name ?? `Player_${client.sessionId.slice(0, 4)}`).slice(0, 20);

  // Trust boundary: uid is broadcast to every client via PlayerState, so it
  // must be backed by a server-verified idToken, never taken from options.uid directly.
  if (options?.idToken) {
    try {
      const decoded = await admin.auth().verifyIdToken(options.idToken);
      player.uid = decoded.uid;
    } catch (e) {
      console.warn(`[${label}] Rejected invalid idToken from ${client.sessionId}: ${e.message}`);
    }
  }

  room.state.players.set(client.sessionId, player);
  console.log(`[${label}] ${player.name} joined (${room.clients.length} online)`);
}

function leaveWorldPlayer(room, client, label) {
  const player = room.state.players.get(client.sessionId);
  if (player) console.log(`[${label}] ${player.name} left`);
  room.state.players.delete(client.sessionId);
}

class WorldRoom extends Room {
  maxClients = 50;

  onCreate() {
    worldRoomInstance = this;
    this.setState(new WorldState());
    registerWorldMessages(this);
    console.log('[WorldRoom] Created — waiting for players');
  }

  async onJoin(client, options) {
    await joinWorldPlayer(this, client, options, 'WorldRoom');
  }

  onLeave(client) {
    leaveWorldPlayer(this, client, 'WorldRoom');
  }
}

// ── Session Room (Phase 15) ───────────────────────────────────────────────────
// Invite-only, temporary world instance for an admin-started in-person
// session — one Colyseus instance per sessionDocId (see the .filterBy()
// registration below). Deliberately NOT a subclass of WorldRoom: WorldRoom's
// onCreate hardcodes the singleton worldRoomInstance = this, which must
// never fire for a session instance, so the shared logic lives in the two
// helpers above instead of via inheritance.
class SessionRoom extends Room {
  maxClients = 50;

  onCreate(options) {
    this.setState(new WorldState());
    registerWorldMessages(this);
    this.setMetadata({ sessionDocId: options.sessionDocId });
    sessionRoomInstances.set(options.sessionDocId, this);
    console.log(`[SessionRoom] Created for session ${options.sessionDocId}`);
  }

  // Invite-only gate — runs before onJoin, throwing rejects the connection
  // with an error the client sees. Never trust client-supplied uid: derive
  // it from a freshly verified idToken, same trust boundary as onJoin below.
  async onAuth(client, options) {
    const session = sessionsCache.get(options?.sessionDocId);
    if (!session || session.status !== 'active')
      throw new Error('This session is no longer active.');
    if (!options?.idToken) throw new Error('ID token required.');
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(options.idToken);
    } catch {
      throw new Error('Invalid ID token.');
    }
    if (!session.roster.includes(decoded.uid))
      throw new Error('You have not been invited to this session.');
    return true;
  }

  async onJoin(client, options) {
    await joinWorldPlayer(this, client, options, 'SessionRoom');
  }

  onLeave(client) {
    leaveWorldPlayer(this, client, 'SessionRoom');
  }

  onDispose() {
    for (const [sessionId, room] of sessionRoomInstances) {
      if (room === this) sessionRoomInstances.delete(sessionId);
    }
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

    // Interactive-object files served the same way — dynamic import('/objects/...')
    // (Phase 11 milestone 3). The directory doesn't exist until the first
    // interactive object is approved, so express.static needs it created first.
    if (!existsSync(OBJECTS_DIR)) mkdirSync(OBJECTS_DIR, { recursive: true });
    app.use('/objects', express.static(OBJECTS_DIR));

    // ── Admin panel ────────────────────────────────────────────────────────────
    app.get('/admin', (req, res) => {
      if (!existsSync(ADMIN_HTML)) return res.status(404).send('admin.html not found');
      res.sendFile(ADMIN_HTML);
    });

    // Code validation preview — no password, write-nothing. Same validator
    // /api/submit uses, so this preview never disagrees with the real gate.
    app.post('/admin/validate', (req, res) => {
      const { code, kind } = req.body ?? {};
      if (!code?.trim()) return res.status(400).json({ error: 'No code provided' });
      let errors;
      try { errors = validateCode(kind ?? 'room', code); }
      catch { return res.status(400).json({ error: 'Invalid creation kind' }); }
      res.json({ ok: errors.length === 0, errors });
    });

    // ── Public API ─────────────────────────────────────────────────────────────
    app.get('/api/portal-slots', (_req, res) => {
      res.json({ slots: buildSlotList() });
    });

    // Verify a Google Sign-In ID token and upsert users/{uid} in Firestore.
    app.post('/api/auth/verify', async (req, res) => {
      const { idToken } = req.body ?? {};
      if (!idToken) return res.status(400).json({ error: 'ID token required' });
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        const { uid, name, email, picture } = decoded;
        const displayName = name ?? email ?? 'Player';
        const userRef = db.collection('users').doc(uid);
        await userRef.set({ displayName, email: email ?? null, photoURL: picture ?? null }, { merge: true });
        const snap = await userRef.get();
        res.json({
          ok: true, uid, displayName, photoURL: picture ?? null,
          slotKey:         snap.data()?.slotKey         ?? null,
          // LoginScene uses this to decide whether to route through
          // CharacterScene first or straight to WorldScene — saves a
          // separate /api/character/:uid round-trip for your own account.
          characterConfig: snap.data()?.characterConfig ?? null,
        });
      } catch (e) {
        res.status(401).json({ error: 'Invalid ID token' });
      }
    });

    // Other players' characters — WorldScene/RoomScene call this to render
    // anyone who isn't the local player.
    app.get('/api/character/:uid', async (req, res) => {
      try {
        const snap = await db.collection('users').doc(req.params.uid).get();
        res.json({ characterConfig: snap.data()?.characterConfig ?? null });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // Saves the signed-in player's own character config. Re-validated with
    // the same sanitizeConfig() the client's live preview already used —
    // never trust a client-shaped object straight into Firestore.
    app.post('/api/auth/save-character', async (req, res) => {
      const { idToken, config } = req.body ?? {};
      if (!idToken) return res.status(400).json({ error: 'ID token required' });
      try {
        const { uid } = await admin.auth().verifyIdToken(idToken);
        const characterConfig = sanitizeConfig(config);
        await db.collection('users').doc(uid).set({ characterConfig }, { merge: true });
        res.json({ ok: true, characterConfig });
      } catch (e) {
        res.status(401).json({ error: 'Invalid ID token' });
      }
    });

    // ── Objects (Phase 11) ──────────────────────────────────────────────────────
    // Decorative objects are pure data — auto-approved instantly, no admin
    // queue, no submissions entry (unlike interactive objects, which will
    // reuse /api/submit with kind: 'object' once that sub-kind lands).
    app.post('/api/objects/decorative', async (req, res) => {
      const { idToken, slotKey, x, y, shapeConfig, linkedArtifacts } = req.body ?? {};
      if (!idToken) return res.status(400).json({ error: 'ID token required' });
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });

      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }

      const ownerUid = slotAssignments.get(slotKey)?.uid;
      if (!ownerUid || uid !== ownerUid)
        return res.status(403).json({ error: 'You do not own this room.' });

      const config = sanitizeObjectConfig(shapeConfig);
      if (config.shapes.length === 0)
        return res.status(400).json({ error: 'Object must have at least one shape' });

      const links = Array.isArray(linkedArtifacts)
        ? linkedArtifacts.filter(a => a?.url).slice(0, 5).map(a => ({
            label: String(a.label ?? 'Link').slice(0, 40),
            url:   String(a.url).slice(0, 500),
          }))
        : [];

      const id  = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = Date.now();
      const obj = {
        // Every decorative object is movable — there's no per-object opt-out
        // (a move/delete can't introduce new code or visuals, so there's
        // nothing to gate). The field stays in the schema for interactive
        // objects (Phase 11 milestone 3), which may need the distinction.
        id, roomSlotKey: slotKey, subKind: 'decorative', ownerUid,
        x: clampCoord(x, ROOM_W), y: clampCoord(y, ROOM_H), movable: true,
        shapeConfig: config, linkedArtifacts: links,
        createdAt: now, updatedAt: now,
      };
      try {
        await persistObject(obj);
        broadcastObjectsUpdated();
        console.log(`[Object] Decorative object added to ${slotKey} by ${uid}`);
        res.json({ ok: true, id });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // All objects placed in a given room — decorative configs come back
    // inline; interactive objects (once that sub-kind lands) will come back
    // as { fileName, ... } for the client to dynamically import().
    app.get('/api/objects', (req, res) => {
      const { slotKey } = req.query;
      if (!slotKey) return res.status(400).json({ error: 'slotKey required' });
      const list = [...objectsCache.values()].filter(o => o.roomSlotKey === slotKey);
      res.json({ objects: list });
    });

    // Reposition or remove an already-placed object. Never admin-reviewed —
    // a move/delete can't introduce new code, visuals, or behavior, only
    // relocate or remove something already approved. Owner-gated: the uid
    // must match the object's own ownerUid, which is always set from the
    // room creator's session at creation time.
    app.post('/api/objects/:id/move', async (req, res) => {
      const { idToken, x, y } = req.body ?? {};
      const obj = objectsCache.get(req.params.id);
      if (!obj) return res.status(404).json({ error: 'Object not found' });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });
      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }
      if (uid !== obj.ownerUid) return res.status(403).json({ error: 'You do not own this object.' });

      try {
        const updated = { ...obj, x: clampCoord(x, ROOM_W), y: clampCoord(y, ROOM_H), updatedAt: Date.now() };
        await persistObject(updated);
        broadcastObjectsUpdated();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // Edits an already-placed decorative object's shape config and/or linked
    // artifact. Same "never admin-reviewed" rationale as move/delete — it's
    // still pure data, so it can't introduce new code or bypass review, only
    // change what shapes/colors/links an already-approved object shows.
    // Owner-gated exactly like move/delete.
    app.post('/api/objects/:id/edit', async (req, res) => {
      const { idToken, shapeConfig, linkedArtifacts } = req.body ?? {};
      const obj = objectsCache.get(req.params.id);
      if (!obj) return res.status(404).json({ error: 'Object not found' });
      if (obj.subKind !== 'decorative')
        return res.status(400).json({ error: 'Only decorative objects can be edited this way' });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });
      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }
      if (uid !== obj.ownerUid) return res.status(403).json({ error: 'You do not own this object.' });

      const config = sanitizeObjectConfig(shapeConfig);
      if (config.shapes.length === 0)
        return res.status(400).json({ error: 'Object must have at least one shape' });

      const links = Array.isArray(linkedArtifacts)
        ? linkedArtifacts.filter(a => a?.url).slice(0, 5).map(a => ({
            label: String(a.label ?? 'Link').slice(0, 40),
            url:   String(a.url).slice(0, 500),
          }))
        : [];

      try {
        const updated = { ...obj, shapeConfig: config, linkedArtifacts: links, updatedAt: Date.now() };
        await persistObject(updated);
        broadcastObjectsUpdated();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.delete('/api/objects/:id', async (req, res) => {
      const { idToken } = req.body ?? {};
      const obj = objectsCache.get(req.params.id);
      if (!obj) return res.status(404).json({ error: 'Object not found' });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });
      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }
      if (uid !== obj.ownerUid) return res.status(403).json({ error: 'You do not own this object.' });

      try {
        if (obj.subKind === 'interactive' && obj.fileName) {
          try { unlinkSync(join(OBJECTS_DIR, obj.fileName)); } catch {}
        }
        await deleteObjectRecord(obj.id);
        broadcastObjectsUpdated();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // ── Creative Process Log (Phase 12) ──────────────────────────────────────────
    // One per room slot — past/present/future reflection on the room's whole
    // creative package. Readable by anyone (no auth), editable only by the
    // room's owner. Never admin-reviewed (plain text, not code).
    app.get('/api/process-log', (req, res) => {
      const { slotKey } = req.query;
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      const log = processLogsCache.get(slotKey);
      res.json(log ?? { slotKey, past: '', present: '', future: '', updatedAt: null });
    });

    app.post('/api/process-log', async (req, res) => {
      const { idToken, slotKey, past, present, future } = req.body ?? {};
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });

      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }

      const ownerUid = slotAssignments.get(slotKey)?.uid;
      if (!ownerUid || uid !== ownerUid)
        return res.status(403).json({ error: 'You do not own this room.' });

      const clean = v => String(v ?? '').trim().slice(0, 3000);
      const log = {
        slotKey,
        past:    clean(past),
        present: clean(present),
        future:  clean(future),
        updatedAt: Date.now(),
      };
      try {
        await persistProcessLog(log);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // ── Sharing, remix & version history (Phase 13) ──────────────────────────────
    // Applies only to code-kind creations (room/game/music/interactive
    // object) — decorative objects are pure JSON, never touch /api/submit,
    // and never get a creationMeta entry.
    app.get('/api/creation-meta', (req, res) => {
      const { kind, slotKey } = req.query;
      let kindMod;
      try { kindMod = getKind(kind); } catch { return res.status(400).json({ error: 'Invalid creation kind' }); }
      if (kindMod.kind === 'object')
        return res.status(400).json({ error: 'Look up an object\'s creationMeta by creationKey, not kind+slotKey' });
      const creationKey = creationKeyFor(kind, slotKey);
      const meta = creationMetaCache.get(creationKey);
      if (!meta) return res.json({ creationKey, shared: false, remixedFrom: null, versions: [] });
      res.json({
        creationKey: meta.creationKey, shared: meta.shared, remixedFrom: meta.remixedFrom,
        versions: meta.versions.map(v => ({ versionId: v.versionId, description: v.description, displayName: v.displayName, createdAt: v.createdAt })),
      });
    });

    // Cross-kind list of every creation currently opted in to sharing —
    // feeds the "based on" remix picker. No code returned here; just enough
    // to label the option (the remixer copies from Gemini/the room itself,
    // this platform doesn't hand out raw code for copy-paste).
    app.get('/api/creations/shared', (_req, res) => {
      const list = [...creationMetaCache.values()]
        .filter(m => m.shared)
        .map(m => {
          const latest = m.versions[m.versions.length - 1];
          return {
            creationKey: m.creationKey, kind: m.kind, slotKey: m.slotKey,
            label: latest?.description || `${m.kind} by ${latest?.displayName ?? 'a player'}`,
          };
        });
      res.json({ creations: list });
    });

    // Owner-only toggle — independent of resubmitting code, since flipping a
    // boolean shouldn't force a full re-review. 404s if nothing has ever
    // been approved for this creationKey yet.
    app.post('/api/creation-meta/share', async (req, res) => {
      const { idToken, creationKey, shared } = req.body ?? {};
      const meta = creationMetaCache.get(creationKey);
      if (!meta) return res.status(404).json({ error: 'No approved creation found for that key yet.' });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });
      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }
      if (!meta.ownerUid || uid !== meta.ownerUid)
        return res.status(403).json({ error: 'You do not own this creation.' });

      try {
        await persistCreationMeta({ ...meta, shared: !!shared });
        res.json({ ok: true, shared: !!shared });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // ── Feedback (Phase 14) ──────────────────────────────────────────────────────
    // One thread per room (not per creation-kind, unlike sharing/version
    // history above) — each entry may optionally tag which part of the
    // room's package it's about. Two tiers, tagged by source: 'online'
    // (any signed-in player, only while onlineFeedbackEnabled is true) and
    // 'self-recorded' (the room's own owner, always available regardless
    // of the toggle). Never admin-reviewed — plain text, not code.
    const FEEDBACK_ABOUT_VALUES = ['room', 'game', 'music', 'object'];

    app.get('/api/feedback', (req, res) => {
      const { slotKey } = req.query;
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      const list = [...feedbackCache.values()]
        .filter(f => f.slotKey === slotKey)
        .sort((a, b) => a.createdAt - b.createdAt);
      res.json({ onlineFeedbackEnabled, feedback: list });
    });

    app.post('/api/feedback', async (req, res) => {
      const { idToken, slotKey, about, text, source, inPersonSessionId } = req.body ?? {};
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });

      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }

      const cleanText = String(text ?? '').trim().slice(0, 2000);
      if (!cleanText) return res.status(400).json({ error: 'Feedback text required' });
      const cleanAbout = FEEDBACK_ABOUT_VALUES.includes(about) ? about : null;

      // Phase 15 — while a player is inside an active in-person session
      // they're invited to, online feedback is implicitly live for the
      // session's duration, bypassing the global admin toggle. Never trust
      // the client's claim alone: the session must actually be active and
      // list this uid in its roster.
      const session = sessionsCache.get(inPersonSessionId);
      const inActiveSession = !!session && session.status === 'active' && session.roster.includes(uid);
      const entrySessionId = inActiveSession ? session.sessionId : null;

      const ownerUid = slotAssignments.get(slotKey)?.uid;
      let entrySource, authorUid, authorName;
      if (source === 'self-recorded') {
        if (!ownerUid || uid !== ownerUid)
          return res.status(403).json({ error: 'Only the room owner can add self-recorded feedback.' });
        entrySource = 'self-recorded';
        authorUid = null;
        authorName = null;
      } else {
        // Defense in depth — the client also stops offering this form to
        // owners, but every other write endpoint here treats the server
        // check as the real gate, never the client UI alone.
        if (ownerUid && uid === ownerUid)
          return res.status(403).json({ error: 'Room owners can only add self-recorded feedback about their own room.' });
        if (!onlineFeedbackEnabled && !inActiveSession)
          return res.status(403).json({ error: 'Online feedback is currently turned off.' });
        entrySource = 'online';
        authorUid = uid;
        try {
          const userSnap = await db.collection('users').doc(uid).get();
          authorName = userSnap.data()?.displayName ?? 'A player';
        } catch {
          authorName = 'A player';
        }
      }

      const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const entry = {
        feedbackId, slotKey, about: cleanAbout, source: entrySource,
        authorUid, authorName, text: cleanText,
        response: null, respondedAt: null, inPersonSessionId: entrySessionId,
        archived: false, createdAt: Date.now(),
      };
      try {
        await persistFeedback(entry);
        res.json({ ok: true, feedbackId });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // Edit an entry's own text/about tag. Self-recorded entries can only be
    // edited by the room owner (there's no other author); online entries
    // can only be edited by whoever originally left them — not the room
    // owner, unless they happen to be the same person. Blocked while
    // archived (unarchive first) so a hidden entry can't be silently
    // changed out from under the "Show archived" view.
    app.post('/api/feedback/:id/edit', async (req, res) => {
      const { idToken, about, text } = req.body ?? {};
      const entry = feedbackCache.get(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Feedback not found' });
      if (entry.archived) return res.status(400).json({ error: 'Unarchive this entry before editing it.' });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });

      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }

      const ownerUid = slotAssignments.get(entry.slotKey)?.uid;
      const canEdit = entry.source === 'self-recorded'
        ? (!!ownerUid && uid === ownerUid)
        : (!!entry.authorUid && uid === entry.authorUid);
      if (!canEdit) return res.status(403).json({ error: 'You can only edit your own feedback.' });

      const cleanText = String(text ?? '').trim().slice(0, 2000);
      if (!cleanText) return res.status(400).json({ error: 'Feedback text required' });
      const cleanAbout = FEEDBACK_ABOUT_VALUES.includes(about) ? about : null;

      try {
        const updated = { ...entry, text: cleanText, about: cleanAbout };
        await persistFeedback(updated);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // Creator-only reply — a thread of two (feedback → response), not open
    // discussion. Allowed to overwrite an existing response since there's
    // no version-history need here.
    app.post('/api/feedback/:id/respond', async (req, res) => {
      const { idToken, response } = req.body ?? {};
      const entry = feedbackCache.get(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Feedback not found' });
      // Self-recorded feedback is the owner's own note — there's no other
      // party to reply to, so this thread-of-two doesn't apply to it.
      if (entry.source === 'self-recorded')
        return res.status(400).json({ error: "Self-recorded feedback can't be responded to." });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });

      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }

      const ownerUid = slotAssignments.get(entry.slotKey)?.uid;
      if (!ownerUid || uid !== ownerUid)
        return res.status(403).json({ error: 'You do not own this room.' });

      const cleanResponse = String(response ?? '').trim().slice(0, 2000);
      if (!cleanResponse) return res.status(400).json({ error: 'Response text required' });

      try {
        const updated = { ...entry, response: cleanResponse, respondedAt: Date.now() };
        await persistFeedback(updated);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // Owner-only, reversible — archiving just hides an entry from the
    // default view (client-side), it's never deleted. Same endpoint
    // handles both directions via the `archived` boolean.
    app.post('/api/feedback/:id/archive', async (req, res) => {
      const { idToken, archived } = req.body ?? {};
      const entry = feedbackCache.get(req.params.id);
      if (!entry) return res.status(404).json({ error: 'Feedback not found' });
      if (!idToken) return res.status(400).json({ error: 'ID token required' });

      let uid;
      try {
        ({ uid } = await admin.auth().verifyIdToken(idToken));
      } catch {
        return res.status(401).json({ error: 'Invalid ID token' });
      }

      const ownerUid = slotAssignments.get(entry.slotKey)?.uid;
      if (!ownerUid || uid !== ownerUid)
        return res.status(403).json({ error: 'You do not own this room.' });

      try {
        const updated = { ...entry, archived: !!archived };
        await persistFeedback(updated);
        res.json({ ok: true, archived: updated.archived });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // Admin-only global toggle (Phase 14). Off by default — the owner
    // switches it on deliberately for a specific trusted/supervised
    // audience, and back off for general/unsupervised play.
    app.get('/admin/settings', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      res.json({ onlineFeedbackEnabled });
    });

    app.post('/admin/settings', async (req, res) => {
      const { password, onlineFeedbackEnabled: next } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      onlineFeedbackEnabled = !!next;
      try {
        await persistGlobalConfig();
        console.log(`[Admin] Online feedback turned ${onlineFeedbackEnabled ? 'ON' : 'OFF'}`);
        res.json({ ok: true, onlineFeedbackEnabled });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // ── In-Person Sessions (Phase 15) ───────────────────────────────────────────
    // Registered-player list for the admin roster picker — no listing
    // endpoint existed before this, since every other users/{uid} read is a
    // per-uid lookup (see /api/character/:uid).
    app.get('/admin/session/roster-options', async (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      try {
        const usersSnap = await db.collection('users').get();
        const users = usersSnap.docs.map(doc => ({
          uid: doc.id,
          displayName: doc.data()?.displayName ?? doc.id,
          email: doc.data()?.email ?? null,
        }));
        res.json({ users });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/admin/session/active', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const active = [...sessionsCache.values()].find(s => s.status === 'active') ?? null;
      const ending = active ? sessionEndTimers.get(active.sessionId) : null;
      res.json({ session: active, endingAt: ending?.endsAt ?? null });
    });

    // Read-only, admin-authenticated feedback view scoped to one session —
    // lets admin monitor what's about to be auto-archived on session end
    // without cross-referencing the per-room [F] panel in-game. Moderation
    // itself (respond/archive) stays owner-only, unchanged from Phase 14.
    app.get('/admin/session/:sessionId/feedback', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const { sessionId } = req.params;
      const list = [...feedbackCache.values()]
        .filter(f => f.inPersonSessionId === sessionId)
        .sort((a, b) => a.createdAt - b.createdAt);
      res.json({ feedback: list });
    });

    app.post('/admin/session/start', (req, res) => {
      const { password, roster } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      if (!Array.isArray(roster) || roster.length === 0)
        return res.status(400).json({ error: 'Pick at least one player for the roster.' });
      if ([...sessionsCache.values()].some(s => s.status === 'active'))
        return res.status(400).json({ error: 'A session is already active. End it before starting a new one.' });

      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const entry = {
        sessionId, hostUid: null, roster, startedAt: Date.now(), endedAt: null, status: 'active',
      };
      persistSession(entry)
        .then(() => {
          // Nudge any already-connected invited players with a live accept
          // prompt — they aren't force-migrated, this just tells them a
          // session they're invited to has started. See notifyPlayer() above
          // for the same find-client-by-uid pattern.
          if (worldRoomInstance) {
            for (const client of worldRoomInstance.clients) {
              const player = worldRoomInstance.state.players.get(client.sessionId);
              if (player?.uid && roster.includes(player.uid)) {
                client.send('sessionInvite', { sessionId });
              }
            }
          }
          console.log(`[Admin] Started session ${sessionId} with ${roster.length} player(s)`);
          res.json({ ok: true, sessionId });
        })
        .catch(e => res.status(500).json({ error: e.message }));
    });

    // Does the real work of ending a session: marks it ended in Firestore,
    // disconnects its live Colyseus room (if still open — some or all
    // players may have already left individually during the grace period),
    // and auto-archives its session-tagged online feedback. Only ever
    // called once the grace period elapses (see /admin/session/end below) —
    // never immediately, so the countdown broadcast to players is honest.
    async function finalizeSessionEnd(sessionId) {
      sessionEndTimers.delete(sessionId);
      const session = sessionsCache.get(sessionId);
      if (!session || session.status !== 'active') return;

      await persistSession({ ...session, status: 'ended', endedAt: Date.now() });
      sessionRoomInstances.get(sessionId)?.disconnect();
      sessionRoomInstances.delete(sessionId);

      // Session-scoped online feedback doesn't carry over — auto-archive
      // it (reversible, same flag Phase 14's manual archive button uses).
      // Self-recorded feedback, and online feedback with no session tag,
      // are untouched.
      for (const entry of feedbackCache.values()) {
        if (entry.inPersonSessionId === sessionId && entry.source === 'online' && !entry.archived) {
          await persistFeedback({ ...entry, archived: true });
        }
      }
      console.log(`[Admin] Ended session ${sessionId}`);
    }

    // Starts a 60-second grace period rather than ending the session
    // immediately — broadcasts a countdown to the session's Colyseus room so
    // players get a heads-up (and can leave early individually) instead of
    // an abrupt disconnect. The session stays fully 'active' (feedback
    // bypass, roster checks, etc. keep working normally) until
    // finalizeSessionEnd() actually runs.
    app.post('/admin/session/end', async (req, res) => {
      const { password, sessionId } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const session = sessionsCache.get(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      // Already counting down — don't restart the clock, just report it.
      const existing = sessionEndTimers.get(sessionId);
      if (existing) return res.json({ ok: true, endsAt: existing.endsAt });

      const endsAt = Date.now() + SESSION_END_GRACE_MS;
      sessionRoomInstances.get(sessionId)?.broadcast('sessionEnding', { endsAt });
      const timeout = setTimeout(() => {
        finalizeSessionEnd(sessionId).catch(e => console.error('[Admin] finalizeSessionEnd failed:', e.message));
      }, SESSION_END_GRACE_MS);
      sessionEndTimers.set(sessionId, { timeout, endsAt });

      console.log(`[Admin] Session ${sessionId} ending in ${SESSION_END_GRACE_MS / 1000}s`);
      res.json({ ok: true, endsAt });
    });

    // Admin veto — skips (or preempts) the 60s grace period and finalizes
    // immediately, whether or not /admin/session/end was ever called first.
    // Players still get pulled back to the main world cleanly: disconnecting
    // the Colyseus room fires their client-side room.onLeave handler, the
    // same force-out + transition path the normal countdown uses.
    app.post('/admin/session/end-now', async (req, res) => {
      const { password, sessionId } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const session = sessionsCache.get(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });

      const existing = sessionEndTimers.get(sessionId);
      if (existing) clearTimeout(existing.timeout);
      sessionEndTimers.delete(sessionId);

      try {
        await finalizeSessionEnd(sessionId);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // Public — lets a signed-in player's client discover whether it's
    // currently invited to an active session. Never trust a client-supplied
    // uid: derive it from a freshly verified idToken, same trust boundary as
    // every other endpoint here that touches identity.
    app.post('/api/session/mine', async (req, res) => {
      const { idToken } = req.body ?? {};
      if (!idToken) return res.status(400).json({ error: 'ID token required' });
      try {
        const { uid } = await admin.auth().verifyIdToken(idToken);
        const active = [...sessionsCache.values()]
          .find(s => s.status === 'active' && s.roster.includes(uid));
        res.json({ sessionId: active?.sessionId ?? null });
      } catch {
        res.status(401).json({ error: 'Invalid ID token' });
      }
    });

    // Unified submission endpoint for every creation kind (room, game, and
    // whatever Phase 11 adds). One queue, one validator, one file-write path.
    app.post('/api/submit', (req, res) => {
      const { kind, slotKey, displayName, uid, sessionId, code, meta } = req.body ?? {};
      let kindMod;
      try { kindMod = getKind(kind); } catch { return res.status(400).json({ error: 'Invalid creation kind' }); }
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      if (!displayName?.trim())
        return res.status(400).json({ error: 'Name required' });
      if (!code?.trim())
        return res.status(400).json({ error: 'Code required' });
      if ((kind === 'game' || kind === 'object' || kind === 'music') && !slotAssignments.has(slotKey))
        return res.status(400).json({ error: 'No room approved for that slot yet' });
      const linkedUid = slotAssignments.get(slotKey)?.uid;
      if (linkedUid && uid !== linkedUid)
        return res.status(403).json({ error: 'This slot belongs to a different signed-in creator.' });
      // Objects are small, independent units — a room can have many, so
      // unlike room/game a slot may have several pending object submissions
      // in the queue at once.
      if (kind !== 'object') {
        for (const sub of submissions.values()) {
          if (sub.slotKey === slotKey && sub.kind === kind)
            return res.status(400).json({ error: 'That slot already has a pending submission of this kind. Please wait for the current one to be reviewed.' });
        }
      }
      // Phase 13 — version-history cap. Objects always get a brand-new
      // creationKey (their own not-yet-generated submission id), so an
      // existing creationMeta doc is never found for them — this check is a
      // no-op for kind === 'object', by construction, not a special case.
      const existingMetaKey = kind === 'object' ? null : creationKeyFor(kind, slotKey);
      const existingMeta = existingMetaKey ? creationMetaCache.get(existingMetaKey) : null;
      if (existingMeta?.versions?.length >= 5) {
        const validDrop = existingMeta.versions.some(v => v.versionId === meta?.dropVersionId);
        if (!validDrop) {
          return res.status(400).json({
            error: 'This creation already has 5 saved versions. Choose one to replace.',
            versions: existingMeta.versions.map(v => ({ versionId: v.versionId, description: v.description, displayName: v.displayName, createdAt: v.createdAt })),
          });
        }
      }

      const errors = validateCode(kind, code);
      if (errors.length > 0) return res.status(400).json({ errors });

      // Objects are create-only this milestone — no update flow yet. Music
      // is one-track-per-room and replaceable, like games.
      const isUpdate = kind === 'room'   ? slotAssignments.has(slotKey)
                      : kind === 'game'  ? !!(slotAssignments.get(slotKey)?.gameFileName)
                      : kind === 'music' ? !!(slotAssignments.get(slotKey)?.musicFileName)
                      : false;
      const id = `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      submissions.set(id, {
        id, kind, slotKey, uid: uid ?? null, displayName: displayName.trim(),
        sessionId: sessionId ?? null, code, submittedAt: Date.now(), isUpdate,
        meta: meta ?? null,
      });
      console.log(`[Submit] ${kind} ${isUpdate ? 'update' : 'new'} from "${displayName}" for slot ${slotKey}`);
      const message = isUpdate
        ? 'Update submitted! The admin will review it soon.'
        : 'Submitted! The admin will review it soon.';
      res.json({ ok: true, message });
    });

    // ── Admin: list pending ────────────────────────────────────────────────────
    app.get('/admin/pending', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const kindFilter = req.query.kind;
      // Owner mismatches are rejected at /api/submit now, so nothing reaching
      // this queue can ever mismatch its slot's linked owner.
      const list = [...submissions.values()].filter(s => !kindFilter || s.kind === kindFilter);
      res.json(list.map(s => ({ ...s, codePreview: s.code.slice(0, 300), code: undefined })));
    });

    // Full code for a specific submission (admin review)
    app.get('/admin/pending/:id/code', (req, res) => {
      if (req.query.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = submissions.get(req.params.id);
      if (!sub) return res.status(404).json({ error: 'Not found' });
      res.json({ code: sub.code });
    });

    // ── Admin: approve / reject ────────────────────────────────────────────────
    app.post('/admin/approve', async (req, res) => {
      const { password, submissionId } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = submissions.get(submissionId);
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      if ((sub.kind === 'game' || sub.kind === 'object' || sub.kind === 'music') && !slotAssignments.has(sub.slotKey))
        return res.status(400).json({ error: 'Target room slot no longer exists' });
      try {
        const kindMod = getKind(sub.kind);
        // For updates, preserve the existing file name so the module URL stays stable.
        // Objects are create-only (no isUpdate), so they always get a fresh
        // id-derived name instead.
        const existing = sub.isUpdate ? slotAssignments.get(sub.slotKey) : null;
        const fileName = kindMod.fileNameFor({
          slotKey: sub.slotKey, displayName: sub.displayName,
          existingFileName: existing?.fileName, id: sub.id,
        });
        writeFileSync(join(ROOT, kindMod.targetDir, fileName), sub.code, 'utf8');

        if (sub.kind === 'room') {
          // Spread the existing entry first so a room update doesn't silently
          // drop an already-approved gameFileName or linked uid.
          slotAssignments.set(sub.slotKey, {
            ...slotAssignments.get(sub.slotKey),
            fileName, roomName: sub.displayName, claimedBy: sub.displayName,
            uid: sub.uid ?? slotAssignments.get(sub.slotKey)?.uid,
            roomVersion: Date.now(),
          });
          persistSlots();
        } else if (sub.kind === 'game') {
          const slot = slotAssignments.get(sub.slotKey);
          slot.gameFileName = fileName;
          slot.gameVersion  = Date.now();
          slotAssignments.set(sub.slotKey, slot);
          persistSlots();
        } else if (sub.kind === 'music') {
          const slot = slotAssignments.get(sub.slotKey);
          slot.musicFileName = fileName;
          slot.musicVersion  = Date.now();
          slotAssignments.set(sub.slotKey, slot);
          persistSlots();
        } else if (sub.kind === 'object') {
          // Objects get their own additive store, not slotAssignments — a
          // room can carry many of them (Phase 11 milestone 3).
          await persistObject({
            id: sub.id, roomSlotKey: sub.slotKey, subKind: 'interactive', ownerUid: sub.uid,
            x: clampCoord(sub.meta?.x, ROOM_W), y: clampCoord(sub.meta?.y, ROOM_H),
            movable: true, linkedArtifacts: [], fileName,
            createdAt: Date.now(), updatedAt: Date.now(),
          });
          broadcastObjectsUpdated();
        }

        // Phase 13 — record this approval as a version in creationMeta,
        // strictly additive after the per-kind write above (never changes
        // fileName/slotAssignments/objectsCache behavior). Evicts the
        // creator's chosen version first if already at the 5-version cap
        // (enforced at /api/submit time, so dropVersionId is trusted here).
        const creationKey = creationKeyFor(sub.kind, sub.slotKey, sub.id);
        const existingMeta = creationMetaCache.get(creationKey);
        const versions = existingMeta?.versions ? [...existingMeta.versions] : [];
        if (versions.length >= 5) {
          const dropIdx = versions.findIndex(v => v.versionId === sub.meta?.dropVersionId);
          if (dropIdx !== -1) versions.splice(dropIdx, 1);
        }
        versions.push({
          versionId: sub.id,
          description: String(sub.meta?.versionDescription ?? '').trim().slice(0, 200),
          displayName: sub.displayName, uid: sub.uid ?? null, createdAt: Date.now(), code: sub.code,
        });
        await persistCreationMeta({
          creationKey, kind: sub.kind, slotKey: sub.slotKey,
          ownerUid: sub.uid ?? existingMeta?.ownerUid ?? null,
          shared: existingMeta?.shared ?? false,
          remixedFrom: sub.meta?.remixedFrom !== undefined ? sub.meta.remixedFrom : (existingMeta?.remixedFrom ?? null),
          versions,
        });

        submissions.delete(submissionId);

        const notifyMsg = sub.kind === 'room'
          ? (sub.isUpdate
              ? `Your updated world "${sub.displayName}" was approved! The portal has been refreshed.`
              : `Your world "${sub.displayName}" was approved! Find your portal in the town square.`)
          : sub.kind === 'game'
          ? 'Your mini-game was approved! It\'s now live in your portal.'
          : sub.kind === 'music'
          ? 'Your room music was approved! It\'s now playing in your room.'
          : 'Your interactive object was approved! It\'s now live in your room.';
        notifyPlayer(sub.sessionId, 'approved', notifyMsg);
        if (sub.kind === 'room' || sub.kind === 'game' || sub.kind === 'music') broadcastSlotsUpdated();
        console.log(`[Admin] Approved ${sub.kind} ${sub.isUpdate ? 'update' : 'new'} "${sub.displayName}" → ${sub.slotKey} (${fileName})`);
        res.json({ ok: true, fileName });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    app.post('/admin/reject', (req, res) => {
      const { password, submissionId, reason } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = submissions.get(submissionId);
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      submissions.delete(submissionId);
      const label = sub.kind === 'room' ? 'world' : sub.kind === 'game' ? 'mini-game' : sub.kind === 'music' ? 'room music' : 'object';
      notifyPlayer(sub.sessionId, 'rejected',
        `Your ${label} submission was not approved. ${reason ? 'Reason: ' + reason : 'Please check your code and resubmit.'}`);
      console.log(`[Admin] Rejected ${sub.kind} submission from "${sub.displayName}"`);
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
      const errors = validateCode('room', code);
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

    // Bind an already-approved legacy slot to a real uid (no re-validation) —
    // for when a pre-Phase-9A creator signs in and identifies themselves.
    app.post('/admin/link-owner', (req, res) => {
      const { password, slotKey, uid } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const slot = slotAssignments.get(slotKey);
      if (!slot) return res.status(404).json({ error: 'Slot not found' });
      if (!uid?.trim()) return res.status(400).json({ error: 'uid required' });
      slot.uid = uid.trim();
      slotAssignments.set(slotKey, slot);
      persistSlots();
      console.log(`[Admin] Linked owner uid to ${slotKey}`);
      res.json({ ok: true });
    });
  },
});

gameServer.define('world', WorldRoom);
gameServer.define('session', SessionRoom).filterBy(['sessionDocId']);

const PORT = 2567;
gameServer.listen(PORT).then(() => {
  console.log(`[Colyseus] Listening on ws://localhost:${PORT}`);
});
