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

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..');
const ROOMS_DIR  = join(ROOT, 'src', 'rooms');
const ADMIN_HTML = join(ROOT, 'admin.html');
const DATA_DIR   = join(__dirname, 'data');
const SLOTS_FILE = join(DATA_DIR, 'slots.json');

const ADMIN_PASSWORD = 'worldofcodes';

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

    // Unified submission endpoint for every creation kind (room, game, and
    // whatever Phase 11 adds). One queue, one validator, one file-write path.
    app.post('/api/submit', (req, res) => {
      const { kind, slotKey, displayName, uid, sessionId, code } = req.body ?? {};
      let kindMod;
      try { kindMod = getKind(kind); } catch { return res.status(400).json({ error: 'Invalid creation kind' }); }
      if (!PORTAL_SLOTS.find(s => s.key === slotKey))
        return res.status(400).json({ error: 'Invalid slot' });
      if (!displayName?.trim())
        return res.status(400).json({ error: 'Name required' });
      if (!code?.trim())
        return res.status(400).json({ error: 'Code required' });
      if (kind === 'game' && !slotAssignments.has(slotKey))
        return res.status(400).json({ error: 'No room approved for that slot yet' });
      const linkedUid = slotAssignments.get(slotKey)?.uid;
      if (linkedUid && uid !== linkedUid)
        return res.status(403).json({ error: 'This slot belongs to a different signed-in creator.' });
      for (const sub of submissions.values()) {
        if (sub.slotKey === slotKey && sub.kind === kind)
          return res.status(400).json({ error: 'That slot already has a pending submission of this kind. Please wait for the current one to be reviewed.' });
      }
      const errors = validateCode(kind, code);
      if (errors.length > 0) return res.status(400).json({ errors });

      const isUpdate = kind === 'room'
        ? slotAssignments.has(slotKey)
        : !!(slotAssignments.get(slotKey)?.gameFileName);
      const id = `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      submissions.set(id, {
        id, kind, slotKey, uid: uid ?? null, displayName: displayName.trim(),
        sessionId: sessionId ?? null, code, submittedAt: Date.now(), isUpdate,
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
    app.post('/admin/approve', (req, res) => {
      const { password, submissionId } = req.body ?? {};
      if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
      const sub = submissions.get(submissionId);
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      if (sub.kind === 'game' && !slotAssignments.has(sub.slotKey))
        return res.status(400).json({ error: 'Target room slot no longer exists' });
      try {
        const kindMod = getKind(sub.kind);
        // For updates, preserve the existing file name so the module URL stays stable.
        const existing = sub.isUpdate ? slotAssignments.get(sub.slotKey) : null;
        const fileName = kindMod.fileNameFor({ slotKey: sub.slotKey, displayName: sub.displayName, existingFileName: existing?.fileName });
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
        } else {
          const slot = slotAssignments.get(sub.slotKey);
          slot.gameFileName = fileName;
          slot.gameVersion  = Date.now();
          slotAssignments.set(sub.slotKey, slot);
        }
        persistSlots();
        submissions.delete(submissionId);

        const notifyMsg = sub.kind === 'room'
          ? (sub.isUpdate
              ? `Your updated world "${sub.displayName}" was approved! The portal has been refreshed.`
              : `Your world "${sub.displayName}" was approved! Find your portal in the town square.`)
          : 'Your mini-game was approved! It\'s now live in your portal.';
        notifyPlayer(sub.sessionId, 'approved', notifyMsg);
        broadcastSlotsUpdated();
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
      const label = sub.kind === 'room' ? 'world' : 'game';
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
