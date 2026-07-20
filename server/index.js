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
let   worldRoomInstance = null; // set in WorldRoom.onCreate()

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
}

function broadcastObjectsUpdated() {
  worldRoomInstance?.broadcast('objectsUpdated', {});
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

function clampCoord(v, max) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
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

  async onJoin(client, options) {
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
        console.warn(`[WorldRoom] Rejected invalid idToken from ${client.sessionId}: ${e.message}`);
      }
    }

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

const PORT = 2567;
gameServer.listen(PORT).then(() => {
  console.log(`[Colyseus] Listening on ws://localhost:${PORT}`);
});
