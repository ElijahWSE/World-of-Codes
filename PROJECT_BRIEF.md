# World of Codes — Project Brief

This file is the single source of truth for the project. Read this at the start of every new session.

---

## What This Project Is

A 2D top-down multiplayer game world (Zelda/Pokemon perspective) that runs in the browser with no install required for players.

There is a **shared town square** where all players can walk around and see each other in real time. Around the town square are **doors** that lead to individual **player rooms**. These rooms — along with mini-games, room music, and other future creation types — are built by players using Gemini AI ("vibe coding"). Players submit their generated code in-game; I manually review and approve it before it joins the shared world.

Beyond sharing and trying out creations, the platform is meant to encourage players to document their creative process, give and receive feedback, and optionally share their code so others can remix it. A public profile page gives each player an overview of everything they've made, without needing to walk the world to find it.

**Current status:** Phases 1–7 are complete and live. Phase 8's core town square redesign is also complete and live as of 2026-07-14 (Singapore-themed rectangular grid city, Town Garden hub, Mario-style backdrop band) — see Phase 8 below for what shipped vs. what's still planned (levels, hub-scene refactor, portal facades, stepped terrain). Phase 9A (Auth) is complete and live as of 2026-07-16 — Google Sign-In gates world entry, real `uid`/`displayName` flow through multiplayer state, verified with two simultaneous signed-in accounts. Phase 9B (Generalized submission system) is next up — see Phase 9 below. World size and movable objects, previously open questions, were resolved 2026-07-14 and are now part of Phase 8 and Phase 11's content respectively.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Phaser.js v3 | 2D game engine (top-down, arcade physics) |
| Vite | Dev server and bundler |
| Colyseus 0.17 | Multiplayer (real-time player sync) |
| `@colyseus/schema` v4 | State schema shared between server and client |
| `@colyseus/sdk` 0.17 | Browser client for Colyseus |
| Node.js 20 | Runtime |
| GitHub Codespaces | Development environment |

---

## Folder Structure

```
World-of-Codes/
├── index.html                  ← Entry HTML (must be at project root for Vite)
├── vite.config.js              ← Proxies Colyseus traffic through Vite (fixes Codespaces CORS)
├── package.json
├── PROJECT_BRIEF.md            ← This file
├── PLAYER_GUIDE.md             ← Guide for players generating rooms with Gemini
├── public/                     ← Static assets (currently empty)
├── src/
│   ├── engine/
│   │   ├── main.js             ← Boots Phaser, registers scenes
│   │   └── WorldScene.js       ← The shared town square scene (multiplayer)
│   ├── rooms/
│   │   └── _template.js        ← The contract all player rooms must follow
│   ├── room-loader/
│   │   └── RoomLoader.js       ← Validates player room modules (stub, finalized Phase 4)
│   ├── shared/
│   │   └── schema.js           ← Colyseus state schema (used by BOTH server and browser)
│   └── shared-assets/          ← Sprites/tiles all rooms can reference
├── server/
│   └── index.js                ← Colyseus server (port 2567)
└── .devcontainer/
    └── devcontainer.json       ← Node 20, forwards ports 5173 and 2567
```

---

## How to Run

```bash
npm start        # Starts both Vite (port 5173) and Colyseus (port 2567) together
npm run dev      # Vite only
npm run server   # Colyseus only
```

Open port **5173** in the browser. Open two tabs to test multiplayer.

---

## Important Architecture Decisions

### Vite proxies Colyseus (vite.config.js)
In GitHub Codespaces, each port gets its own HTTPS subdomain. The browser blocks cross-origin requests from port 5173 to port 2567. The fix: Vite proxies `/matchmake/*` (HTTP) and `/<processId>/<roomId>` (WebSocket) to Colyseus. The client always connects to the same origin as the page.

### Shared schema (src/shared/schema.js)
`@colyseus/schema` v4 does not initialize MapSchema properties when using reflection mode — they come back as `undefined`. The fix: define `PlayerState` and `WorldState` in a shared file imported by both the server (`server/index.js`) and the browser client (`WorldScene.js`). Pass `WorldState` as the third argument to `client.joinOrCreate()`.

### onStateChange instead of getStateCallbacks
`getStateCallbacks` in schema v4 requires `$refId` to be set on the MapSchema, which only happens after the server sends actual data. An empty MapSchema has no `$refId`, so `onAdd` throws. The fix: use `room.onStateChange(state => { ... })` which fires on every server patch and reconciles the full player list. Simpler and always reliable.

### Room files are manually gated
All player room files are reviewed by me before being added to `src/rooms/`. There is no automated pipeline. Adding a room requires two steps only: drop the file in `src/rooms/` and add one import + one entry in `WorldScene.js`'s DOORS array.

---

## Vocabulary (Phase 9+ vision)

- **Creation** — any approved, code-based artifact that runs inside the shared world: a room, a mini-game, room music, or a future kind not yet invented. Distinct from a **nested link** (an external URL a player attaches to an object in their room — opens in a new tab, not code, not admin-approved).
- **Kind** — a creation's type (`room`, `game`, `music`, ...). The submission system is built so new kinds can be registered without duplicating the approval pipeline.
- **Creative Process Log** — per-creation, in-game structured fields (past / present / future) where a creator reflects on how the creation came to be, what it is now, and what's next. Combines "process documentation" and "reflection journal" into one feature.
- **Feedback** — tagged by source: *online* (submitted by another player, only possible when the feedback toggle is on) or *self-recorded* (typed up by the creator themselves, e.g. summarizing verbal feedback from an in-person session — always available regardless of the toggle).
- **Session mode** — a temporary, invite-only world instance started by the admin for an in-person group. Players in a session see each other; online feedback is live only for the session's duration. When the session ends, creations made in it go through the normal approval pipeline into the main world — self-recorded feedback travels with the creation, session-only online feedback does not.
- **Sharing/remix** — a creator can opt in to let others see and copy their code. There's no automated fork/diff tracking — remixing happens externally in Gemini. A remixer can self-declare "based on X" at submission time, storing a `remixedFrom` pointer. No enforcement, no obligation.

---

## Key Decisions & Rationale (Phase 9–17)

The phase descriptions above say *what* to build. This section records *why* —
the full reasoning, alternatives considered, and open caveats behind each
decision, agreed July 2026. Written to be unambiguous for a future session that
wasn't part of the original discussion.

### What players will be able to create

The original Phase 8/9/10 plan only covered rooms and mini-games. The expanded
vision adds four more player-created things: **character skins** (already
planned, Phase 10, unchanged), **room music**, **external artifact links**
(a player's own website or other vibe-coded creation, attached to an object in
their room for others to open and explore), and **objects** (decorative and
interactive, Phase 11). Plus the explicit expectation that
**more creation types will be added later** — the whole Phase 9 rework exists to
absorb that without redesigning the pipeline each time.

### Approval scope is code, not communication

**Decision:** Only creations that run as code inside the shared world (rooms,
mini-games, room music, and any future kind) go through admin approval. Feedback,
process logs, and reflections are not moderated at this time.

**Why:** the in-game world has fixed parameters (the hook contract, world/room
size, safe-API list) that code must respect to avoid crashing the game or other
players' sessions — that's what the approval gate protects. Player-to-player
communication (feedback text, reflections) doesn't touch those parameters, so it
doesn't need the same gate.

**Not a permanent ruling:** explicitly called out as "can be at the later parts
of the development plan" — i.e. moderation of communication features may be
added later if it becomes necessary (e.g. if the platform opens to a larger or
less-trusted audience). This is a v1 scope decision, not a philosophy.

### Creation-kind extensibility (generalized submission system)

**The problem, in the owner's own words:** "I might add new features that
players can vibecode and send in for approval. Does my current code structure
allow for this flexibility?"

**What was found:** No — not without rework. As of this writing, `server/index.js`
has two entirely separate systems: a `pendingSubmissions` Map with its own
submit/list/fetch/approve/reject endpoints for rooms, and a `pendingGames` Map
with a duplicate set of the same five endpoints for games. `RoomLoader.js` and
`GameLoader.js` are likewise two separate validator/loader files. Adding music as
a third kind the old way means copy-pasting this pattern a third time; each kind
after that repeats the cost.

**Decision:** Phase 9 replaces both with one `submissions` collection carrying a
`kind` field, one set of kind-parameterized endpoints, and a small registry
(`src/creation-kinds/*.js`) where each kind declares its own required
hooks/contract, validator, and loader. `room` and `game` are migrated into the
registry as the first two kinds; `music` and `object` (Phase 11) are added as
the third and fourth without touching the pipeline itself. Any future kind
follows the same pattern: register it, don't rebuild the queue.

### Nested creations — external links vs. in-game creations

Two different things were being discussed under "player-created content attached
to the world," and it's important they stay distinct:

1. **External artifact links** — a player's own website or other vibe-coded
   creation, hosted elsewhere, that they attach to an object in their room. The
   player supplies a URL. Interacting with the object **opens the URL in a new
   browser tab.** This is *not* code submitted to the platform and *not*
   admin-approved — it's just a pointer.
   - **Why new tab, not embedded/iframed:** iframing an arbitrary
     player-submitted URL is a real security/trust risk — clickjacking,
     unvetted third-party scripts, content that can change after approval with
     no way to re-review it. A new-tab link achieves the same "go explore what
     they made" goal without any of that risk, and needs no validation
     pipeline at all.
   - **Still open:** whether the external site itself needs to be vibe-coded,
     or can be literally anything (a deployed app, a GitHub repo, a Notion
     doc). Not restricted so far — treat as unconstrained until told
     otherwise.

2. **In-game creation kinds** (room, game, music, future kinds) — these *are*
   code, submitted through the in-game submission flow, validated, and
   admin-approved, because they become part of the shared world other players'
   sessions run alongside. These always open **in-game**, never in a new tab,
   because they're part of the world itself, not a link out of it.

### Room music

**Decision:** room music is vibe-coded (Gemini-generated Web Audio API / synth
code), not an uploaded audio file. Registered as the `music` kind in the Phase 9
creation-kind registry, with its own hook contract (e.g. a `play(scene)` hook)
validated the same way rooms and games are. Objects (Phase 11) follow the same
pattern, registered as the `object` kind.

**Why code instead of a file upload:** an upload would need entirely new
infrastructure (file storage, size limits, a different validation story since
`node --check` doesn't apply to binary audio) that doesn't exist anywhere in the
project yet. Keeping music as code means it drops into the same pipeline being
generalized in Phase 9 for free.

### Feedback system — two tiers, tagged by source

**Decision:** feedback comes in two flavors, always distinguishable by a
`source` field:
- **online** — submitted by another player, in-game, only possible while the
  admin has switched online feedback **on**
- **self-recorded** — typed up by the creator themselves (e.g. summarizing
  verbal feedback given in person), **always available**, regardless of whether
  online feedback is on or off. When online feedback is off, self-recorded is
  the *only* way feedback gets added.

**Why the toggle exists at all, rather than just "off forever":** the owner's
own reasoning — "there are sometimes when I introduce this to trusted adults, I
can trust them to feedback maturely, and this online feedback system can be a
good system to have." So the toggle isn't a placeholder for a feature to be
built later; it's meant to be switched on deliberately for specific trusted
audiences (e.g. a room of adults) and left off for general/unsupervised play
(e.g. students playing solo online) where unmoderated public comments risk
rude language or bullying.

**Creator can respond** to any feedback entry — a two-message thread (feedback →
creator's response), not an open comment section.

**No moderation queue for feedback content itself**, unlike code submissions —
feedback text can't crash the game or violate fixed world parameters, so it
doesn't need the same safety gate the code pipeline has. This is explicitly a v1
decision, same caveat as the approval-scope decision above: may be revisited if
needed.

### In-person session mode

**Decision:** the admin (owner) starts and ends "sessions" from the (redesigned)
admin panel by picking a roster of registered players. A session spins up a
**separate, temporary world instance** (a distinct Colyseus room from the
persistent main WorldRoom) — not a mode flag on the main world. Players invited
to a session **see each other** while it's active. Online feedback is
**implicitly live for the whole session** — no separate per-session toggle is
needed, since being in a session already means the owner is present and
facilitating.

**Why a separate world instance instead of a flag on the main world:** it lets
online feedback be turned on safely for a specific, supervised, invited group
without exposing unmoderated online feedback to the general/persistent
population who might be playing solo and unsupervised at the same time.

**What happens when a session ends:** creations made during the session go
through the exact same admin-approval pipeline as any other submission (Phase 9)
to join the main, persistent world — no special-cased approval path.

**Feedback carry-over rule, stated precisely:**
- **Self-recorded feedback** attached to a creation during the session
  **carries over** when that creation joins the main world, and the creator can
  keep adding more self-recorded feedback to it afterward, same as any other
  creation.
- **Online feedback given during the session does not carry over.** It exists
  only within that session's scope; once the session ends, it stays behind.
- *Why the asymmetry:* online feedback during a session is trusted specifically
  *because* the owner is there facilitating and it's a closed, known group.
  Once the session ends, that supervision context is gone — publishing it
  permanently into the main world would mean it outlives the conditions that
  made it safe. Self-recorded feedback is already filtered through the creator
  themselves before it's written down, so it doesn't carry the same risk and is
  fine to persist indefinitely.
- **Implementation implication:** feedback entries need a `sessionId` field so
  session-scoped online feedback can be identified and excluded at
  promotion time, while self-recorded entries (which may also have been made
  during a session) are carried through regardless.

### Code sharing & remix attribution

**Starting position, in the owner's own words:** "My initial idea is just for
the player to be able to copy and paste the other player's code into Gemini, and
then to continue vibe coding from there — therefore no attribution link."

**The problem this raises:** if remixing happens entirely outside the platform
(copy-paste into Gemini), there's no way for the platform to *automatically*
detect that a new submission is derived from an earlier one — there's no diffing
or fork mechanism possible.

**Resolution — self-declared attribution:** the submission form gets an
optional "is this based on someone else's shared creation?" field — a picker
over currently-shared (opt-in) creations. If the submitter selects one, the new
creation stores `remixedFrom: <originalCreationId>`. This is honesty-based, not
enforced or verified — the owner confirmed this is an acceptable trade-off
("self declared works well").

**Sharing is opt-in per creation, default off** (`creations/{id}.shared`,
boolean, set by the creator). *Why:* not every creator wants their code exposed
for others to copy — consent-based sharing supports remix culture for those who
want it without assuming everyone does.

### Version history

**Decision:** each creation keeps up to **5 saved versions** (the owner's own
suggestion was "maybe 4 or 5" — 5 was picked as the documented cap; treat as
adjustable if it turns out to feel wrong in practice, not a hard commitment).
Each version carries a short, creator-written description of what changed in
that version. When a submission would create a 6th version, **the creator
chooses which existing version to delete** to make room — the system does not
auto-drop the oldest.

**Why creator-chooses instead of auto-drop-oldest:** an early version might be
more meaningful to keep (e.g. "the first working version") than a more recent
but less significant one — auto-dropping oldest would silently discard
something the creator might want to keep on show as part of their creative
history.

**Re-validation:** every new version goes through the same `node --check` +
hook-contract validation as any other submission — this already exists as
"players can submit updated versions" from Phase 7; version history just keeps
history instead of overwriting in place.

### Creative Process Log (documentation + reflection, merged)

**Two originally separate ideas were merged into one feature:**
1. *Process documentation* — the original idea included letting a creator share
   their Gemini conversation, write about their process in words, or document
   on another site and share the link.
2. *Reflection journal* — past/present/future structured reflection: what was
   learned from earlier creative stages, what the creation is/does now, and
   what's planned next.

**Why merged:** both are driven by the same underlying goal — encouraging
players to reflect on and articulate their own creative process, not just
produce a finished artifact. Building them as one per-creation feature (called
the **Creative Process Log**, with past/present/future fields) avoids
duplicating UI and data model for what is functionally the same reflection.

**Decision for v1: in-game structured fields only.** The player fills in
past/present/future directly in an in-game popup (same interaction pattern as
the current notice-board signposts), editable only by the creation's own
creator. Stored on `creations/{id}.processLog`.

**Explicitly deferred, not rejected:** the "share a Gemini conversation link" or
"document elsewhere and paste the URL" version of this (referred to during
planning as "link-out") is **not** part of v1. It's a real want from the
original brainstorm, deferred purely to keep the first version simple — it can
be layered on later as an alternative/additional way to fill in the Process Log
without changing the underlying data model (the log can gain a `linkedDocUrl`
field alongside the structured text fields whenever it's picked back up).

### Profile page

**Decision:** a page outside the Phaser canvas (a normal web route, not an
in-world popup) aggregating one player's creations, Creative Process Logs, and
feedback received, keyed by `uid`. **Visible to all players by default** — this
is deliberately public, not a private dashboard.

**Visibility control:** there is a hide/show mechanism
(`users/{uid}.profileVisible`), but it is **admin-only** — the owner can hide a
specific player's profile if needed, but **players themselves have no option to
hide their own profile.**

**Why public-by-default with only an admin override:** the whole point of the
profile page is to let anyone see an overview of a player's creations without
needing to physically walk the world to find them — that's a discoverability
goal for the platform. Letting individual players opt out would undermine that
goal one profile at a time; keeping the toggle admin-only preserves the default
while still leaving an escape hatch for a specific situation that calls for it
(decided case-by-case by the owner, not self-service).

**Build ordering:** Phase 16, after Phases 12–14, since it's purely an
aggregation view over data those phases already produce (Process Log, sharing/
remix, feedback) — it introduces no new data model of its own.

---

## Full Original Plan

### PHASE 1 — ENGINE & PROJECT SETUP ✅ COMPLETE

1. `package.json` with Phaser, Vite, scripts: dev, build, preview
2. `index.html` — minimal HTML, black background, centered canvas
3. `src/engine/main.js` — boots Phaser (800×600, arcade physics, zero gravity)
4. `src/engine/WorldScene.js` — green rectangle player, WASD/arrow movement, camera follow, "World loaded ✓" text
5. `src/rooms/_template.js` — empty room template with hooks: name, onLoad, onCreate, onUpdate, onExit (with detailed comments)
6. `src/room-loader/RoomLoader.js` — stub that validates all required hooks exist
7. `.devcontainer/devcontainer.json` — Node 20, forward ports 5173 and 2567, run npm install on create
8. `.gitignore` — Node template
9. `PLAYER_GUIDE.md` — guide for players using Gemini to generate rooms

---

### PHASE 2 — MAIN WORLD & MULTIPLAYER ✅ COMPLETE

1. `WorldScene.js` expanded to full town square:
   - 1600×1200 world with checkerboard green tile floor
   - Physics walls on all 4 sides with 96px door gaps
   - 4 orange doors (Room 1–4), one per wall, labeled inside
   - Console log when player walks into a door
   - "You" name tag floating above local player


   - `server/index.js` — WorldRoom tracks all players (x, y, name) via MapSchema
   - Other players rendered as gray 32×32 rectangles with name labels
   - Positions synced in real time via `move` messages
   - Players join/leave cleanly
   - Game still works (single-player) if server is offline

3. `package.json` scripts: added `server` and `start` (concurrently)

4. Technical fixes applied during Phase 2:
   - Installed `@colyseus/sdk` (correct 0.17 client) instead of `colyseus.js` (0.16, schema v3 mismatch)
   - Created `vite.config.js` to proxy Colyseus through Vite (Codespaces CORS fix)
   - Created `src/shared/schema.js` shared between server and browser
   - Switched from `getStateCallbacks` to `room.onStateChange` for reliable player sync

---

### PHASE 3 — ROOM TEMPLATE & PLAYER GUIDE ✅ COMPLETE

1. Finalize `src/rooms/_template.js`:
   - All 5 hooks (name, onLoad, onCreate, onUpdate, onExit)
   - A working example filled into the template showing a simple room
   - Detailed comments on every line

2. Create `src/rooms/example-room.js`:
   - Uses the template hooks exactly
   - Distinct visual style from the town square
   - Includes an exit trigger that calls `onExit`

3. Write the Gemini prompt template inside `PLAYER_GUIDE.md`:
   - Paste full `_template.js` contents inline
   - Instruct Gemini: fill hooks only, no imports, no libraries, no globals
   - Available objects: scene, scene.add, scene.physics, scene.input, scene.cameras
   - Include exit trigger calling `scene.exitRoom()`
   - Return only the completed JS file, no explanation

4. Polish `PLAYER_GUIDE.md`:
   - Short intro, step-by-step instructions
   - What rooms CAN and CANNOT do

---

### PHASE 4 — ROOM LOADER ✅ COMPLETE

1. Finalize `src/room-loader/RoomLoader.js`:
   - Validate all 5 hooks (name = string, rest = functions)
   - On validation failure: show red in-game error text, return to WorldScene
   - On success: call onLoad → onCreate, wire onUpdate into Phaser update tick
   - Expose `scene.exitRoom()` → calls onExit, transitions back to WorldScene
   - Wrap all hook calls in try/catch (rooms must fail safely, never crash the game)

2. Create `src/engine/RoomScene.js`:
   - Phaser Scene key: "RoomScene"
   - On create: receives room module via scene data, calls RoomLoader.loadRoom()
   - Fixed "back" button always visible, always returns to WorldScene
   - Passes player name into room scene

3. Connect doors in `WorldScene.js` to actual rooms:
   - Import each room module at the top
   - Map each door to its room module in the DOORS array
   - On door entry: `this.scene.start('RoomScene', { room: door.roomModule, returnDoor: door.key })`
   - On return: spawn player at the door they entered

4. Register `RoomScene` in `main.js`

---

### PHASE 5 — ADMIN PANEL FOR ROOM MANAGEMENT ✅ COMPLETE (Option B)

Goal: A password-protected web UI so rooms can be added, swapped, and removed
without touching Codespace or editing files manually.

You remain the gatekeeper — players submit code via Gemini, you review and approve.

#### Option B — Simple Admin Panel ✅ BUILT
- Admin panel at `/admin` (proxied through Vite, accessible via port 5173)
- Default password: `worldofcodes` — change in `server/index.js` line 22
- Still requires a Vite restart (`npm start`) after approving a room

Parts built:
  1. `admin.html` — password-protected UI: paste code, pick door, approve/remove, view active rooms
  2. `server/index.js` — admin routes: `GET /admin`, `GET /admin/rooms`, `POST /admin/approve`,
     `POST /admin/remove`, `POST /admin/validate`
  3. `WorldScene.js` — block markers (`[DOOR-IMPORT:x-start/end]`, `[DOOR-ENTRY:x-start/end]`)
     added around each door's import and DOORS entry for reliable automated patching
  4. `vite.config.js` — `/admin` proxy added

Code validation (runs before every approve):
  - Detects JSX / React / HTML tag syntax
  - Detects import or require statements
  - Checks all 5 required hook exports (name, onLoad, onCreate, onUpdate, onExit)
  - Runs `node --check` for full JavaScript syntax validation
  - On failure: generates a ready-made Gemini fix prompt with the exact errors listed

Known fix applied during build:
  - `toPascalCase()` now strips all non-alphanumeric characters so room names with
    brackets or special chars never produce invalid JS variable names

#### Option A — Full Dynamic System (future upgrade if needed)
- No Vite restart required after approving
- Replaces static imports with JSON config + dynamic imports
- Not yet built — implement if restarting becomes inconvenient

---

### PHASE 6 — IMPROVEMENTS ✅ COMPLETE

#### 6A — Multiplayer Rooms + Player Character System ✅ COMPLETE (May 6 2026)
Players in the same room now see each other in real time.
- Schema tracks `currentRoom`, `roomX`, `roomY` per player
- `enterRoom` / `roomMove` / `exitRoom` server message handlers
- WorldScene uses `scene.launch()` + `scene.sleep()` so Colyseus stays alive inside a room
- Portal occupancy badge: `● N inside` shown below each portal label
- Rooms can export `createOtherPlayer()` to customise how other players are rendered
- Improved Gemini Prompt 1 (safe API list, animation rules, no plain rectangles) integrated into in-game notice board signpost
- `basket-ball-court.js` added as example room with full multiplayer character rendering

#### 6B — Room Size Standardised ✅ COMPLETE (Apr 21 2026)
Room size standardised to 1600×1200 with camera follow inside rooms.
- RoomScene sets physics/camera bounds to 1600×1200
- All Gemini prompts updated with new coordinates
- Admin panel door entry format updated to portal format

#### 6C — Town Square Redesign (Creativity Wonderland) ✅ COMPLETE (Apr 21 2026)
Full visual overhaul of the town square:
- Pokemon/RPG-style perspective with sky, mountains, desert ground, river
- Animated clouds, lightbulb, paper airplane, moon, twinkling stars
- Cacti and colourful book sculptures with y-based depth sorting
- Magical animated spinning portals replace wall doorways
- Walls removed; world bounds used as invisible boundary

#### Mini-Game System ✅ COMPLETE (Apr 21 2026)
Club Penguin–style mini-game overlay:
- `GameScene.js` + `GameLoader.js` — validates game hooks, renders title bar
- Rooms export `gameZoneX`/`gameZoneY`; players press E on proximity to launch
- Game runs as overlay on top of RoomScene; world pauses underneath
- `_template.js` documents optional game exports with full example
- Notice board page 5: Gemini Prompt B for generating mini-games

---

---

### PHASE 7 — DYNAMIC PORTALS, IN-GAME SUBMISSION, ADMIN PENDING QUEUE ✅ COMPLETE

- Dynamic portal system: slots stored in `server/data/slots.json`, fetched at runtime via `/api/portal-slots`, room modules loaded with dynamic `import()` — no Vite restart needed after approving a room
- In-game room submission: players press E near unclaimed portal, paste Gemini-generated code directly in-game
- In-game game submission: players press G inside their approved room to submit a mini-game
- Admin pending queue: separate tabs for pending rooms and pending games, inline code validation, approve/reject with reason
- Players can submit updated versions of their approved world
- All 9 student rooms added: aleshaaa, danielle-world, emmanuel-tan, kristabel, kristabelly, ming-jian, nether, sufina, yi-jasmeen

---

### PHASE 8 — TOWN SQUARE REDESIGN + LEVELS (core redesign ✅ COMPLETE 2026-07-14, levels still PLANNED)

Goal: replace the desert-themed town square with a Singapore-themed hub sized for the platform's growth, plus a mechanism for expanding further without repeatedly resizing the same map. Has no dependency on auth, so it ran before Phase 9.

**Built and live:**
- **New shared file `src/shared/townSquareLayout.js`** — a seeded, deterministic procedural generator (not hand-authored data) that is the single source of truth for the whole layout, imported by both `server/index.js` and `WorldScene.js` so client/server portal positions can never drift out of sync (replaces the old hand-duplicated `PORTAL_SLOT_POSITIONS`/`PORTAL_SLOTS` arrays).
- **World size:** the walkable **city** is 3600×2700 (the originally planned 5× area), unchanged from the first pass. It now sits inside a bigger **5000×4100 total canvas** — the extra space is a 700px non-walkable backdrop band on all four sides (see below). Player room size stays 1600×1200, untouched.
- **Layout — revised from the original plan after live playtesting feedback:** the original radial "streets radiating from the hub in wedges" design produced awkward thin slivers near the centre no matter how the subdivision was tuned. Replaced with a **true rectangular street grid** (12×9 base cells, randomly merged into 1×1 / 2×1 / 1×2 / 2×2 blocks for size variation) — 74 plots currently, all rectangular. Triangular plots were tried and then explicitly dropped per owner feedback ("pose a lot of issues... do not resemble any realistic use of space"). There is no alley/street distinction anymore either — every gap in the grid, big block or small, uses the same ~110px road width (also dropped per feedback, in favour of simplicity and visual consistency).
- **Hub — revised from "community club building" to a Town Garden:** lawn, 8 trees, and an animated fountain (only the fountain itself is a solid obstacle; the lawn is walkable) — the building version read poorly once built, per owner feedback.
- **Backdrop band (new, not in the original plan):** a nonwalkable 700px band surrounds the city on all sides — sky gradient, drifting clouds, moon, stars, and a muted-tone HDB skyline silhouette lining the inner edge of the band on all four sides. Player movement is physically confined to the city (`physics.world.setBounds` on the city rect only); the camera bounds cover the full canvas so the backdrop is visible whenever the player is near the city's edge — a "Mario-style" background layer, added after owner feedback that floating sky decor directly over the ground read as a bug, not depth.
- **Camera zoomed to 0.7×** in `WorldScene._setupCamera()` so more of the city is visible at once, without changing the base 800×600 canvas (that canvas size is part of the existing mini-game contract — student-submitted games hardcode coordinates against it, so it was deliberately left alone).
- **Design workflow actually used:** owner supplied a reference layout image; the final layout was generated procedurally (not hand-traced from the image) once it became clear a real city grid needed to be code-generated for correctness (guaranteed non-overlapping, in-bounds, backward-compatible with existing claimed slot keys) rather than manually authored.
- Verified: all 13 previously-claimed student rooms resolve correctly against the new layout (no orphaned rooms); zero console errors; visually confirmed in-browser via automated screenshots.

**Still planned, not built this pass:**
- **Levels** — a lift at the hub to a separate town-square instance for future growth, instead of resizing the map again. Not started.
- **Reusable "hub scene" class** — `WorldScene` is still one concrete file, not yet refactored into a theme-configurable base class for levels to reuse.
- **Portal facade customization** (players redesigning their own portal's visual appearance) — still deferred, likely a future creation-kind once the Phase 9 registry exists.
- **Stepped/elevation terrain** (added 2026-07-15) — Pokemon-style stepped ground gradients (small climbable/jumpable ledges: one-way hop down, blocked walk-up except via stairs) for the main world, and possibly participant rooms later. Not started, not spec'd. Grouped with Levels/hub-refactor because it's an engine-level movement/collision primitive that's a natural fit to build alongside the `WorldScene` hub-scene refactor rather than on its own. If ever extended to participant rooms, it would change the room contract (`_template.js`) itself, which is riskier than an additive feature since 13 existing rooms are built against flat, uniform ground — needs real design work before touching that.

---

### PHASE 9 — FOUNDATION: AUTH + GENERALIZED SUBMISSION SYSTEM (PLANNED, split into 9A/9B 2026-07-15)

Goal: everything from the original auth plan (Google Auth, Firestore, auto slot assignment), **plus** replacing today's duplicated room/game admin pipeline with one generic, kind-aware system — because Phase 11 adds music and objects as new kinds, and more kinds are expected later. Without this, `RoomLoader.js`/`GameLoader.js` and the server's separate `pendingSubmissions`/`pendingGames` maps would get copy-pasted a third and fourth time.

**Decision (2026-07-15):** built as two sequential sub-phases, 9A then 9B, not simultaneously — full implementation plan approved and saved at `/home/node/.claude/plans/steady-purring-wozniak.md`. Auth (9A) touches `main.js`, `WorldScene.js`, `schema.js`, `WorldRoom.onJoin` — none of which overlap with the submission pipeline (9B) — so building 9A first means the `kind`-aware registry is designed with a real `uid` as a first-class field from day one instead of being retrofitted later, and each sub-phase ships as an independently testable, revertable slice.

Today there is **zero identity or database infrastructure in the repo**: player identity is a random `Player_XXXX` string regenerated every page load; "claiming" a portal is just typing a name with no verification; submissions live in two hand-duplicated in-memory `Map`s lost on server restart; and there are three separate copies of room/game validation rules (server regex, client loaders, and a third inside `admin.html`'s preview UI). This plan replaces all of that, while explicitly not touching the one mechanism that already works well: approved code is written to `src/rooms/*.js` and dynamically `import()`ed client-side with no server restart.

#### 9A — Auth

**New client files:**
- `src/auth/firebase.js` — Firebase app init from `import.meta.env.VITE_FIREBASE_*` vars, exports `auth`.
- `src/auth/googleAuth.js` — `signInWithGoogle()` / `signOutUser()` via `GoogleAuthProvider` + `signInWithPopup`.
- `src/auth/session.js` — singleton `{uid, displayName, photoURL, slotKey, idToken}`, subscribes to `onAuthStateChanged`, exposes `getFreshIdToken()` (ID tokens expire hourly, a play session can outlast that).
- `src/engine/LoginScene.js` — Google Sign-In overlay (same DOM-overlay pattern as the existing claim overlay), POSTs the ID token to `/api/auth/verify`, then `scene.start('WorldScene', {uid, displayName, photoURL})`. Routes straight to `WorldScene` for now — `CharacterScene` (Phase 10) doesn't exist yet, leave a `// TODO Phase 10` marker at the routing point.

**Modified:**
- `src/engine/main.js` — scene order becomes `[LoginScene, WorldScene, RoomScene, GameScene]`.
- `src/engine/WorldScene.js` — `init(data)` receives `{uid, displayName, photoURL}` instead of generating `Player_XXXX`; `_connectMultiplayer()` passes `{name, uid, idToken}` into `joinOrCreate`.
- `src/shared/schema.js` — add `uid: 'string'` to `PlayerState` (constructor + `defineTypes`). The only schema change in all of Phase 9.
- `server/index.js` — init `firebase-admin`; add `POST /api/auth/verify` (verifies token, upserts `users/{uid}` in Firestore, returns existing `slotKey` if any) and a stub `GET /api/character/:uid` (real logic is Phase 10); make `WorldRoom.onJoin` async and verify `options.idToken` server-side before trusting `options.uid` — the one real trust boundary, since `uid` is broadcast to every client via `PlayerState`.
- New deps: `firebase` (client), `firebase-admin` + `dotenv` (server). Service account loaded from an env var, never committed as a JSON file.

**Setup gotcha:** Firebase's Google provider requires the sign-in origin in "Authorized domains." Codespaces forwards Vite on a per-instance HTTPS subdomain that can change on rebuild — handle this as an M0 step rather than hitting `auth/unauthorized-domain` mid-testing.

**M0 status (2026-07-15):** Firebase project (`impactground`) created, Google Sign-In enabled, Firestore created (`asia-southeast1`, Standard edition), web app registered, Codespaces domain authorized. Client env vars and the service account are stored as **GitHub Codespaces secrets** (account-level, scoped to this repo) rather than local `.env`/`serviceAccountKey.json` files — this survives Codespace deletion/recreation and matches the Phase 17 "service account from env var" pattern early, avoiding a rewrite later. Secrets added: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`.

**M1 status (2026-07-16): complete and verified.** All 7 Codespaces secrets confirmed `SET` after restart; `server/index.js` now loads the service account via `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)`; the now-redundant `server/serviceAccountKey.json` and local `.env` were deleted (`.env.example` stays as documentation). Built: `uid` field on `PlayerState`, `LoginScene` (Google Sign-In overlay, gates world entry as the first scene in `main.js`), `/api/auth/verify` (verifies token, upserts `users/{uid}` in Firestore), `WorldRoom.onJoin` verifies `options.idToken` server-side before trusting `options.uid`, and a sign-out control in `WorldScene` that routes back to `LoginScene`. Verified live: two different Google accounts signed in from separate browser sessions, saw each other in the town square and inside rooms, sign-out correctly returned to `LoginScene`. Portal walkthrough of all 13 legacy rooms not yet explicitly re-confirmed post-auth, but multiplayer sync and room entry were exercised live with no errors observed.

#### 9B — Generalized submission system

**New files:**
- `src/creation-kinds/room.js`, `game.js` — each declares `{kind, hooks, validate(code), fileNameFor(...), targetDir}`, wrapping today's `validateRoomCode`/`validateGameCode` and the two loaders' hook lists.
- `src/creation-kinds/index.js` — registry (`getKind(name)`), so Phase 11's `music`/`object` become "add one file + one line."

**Modified:**
- `src/room-loader/RoomLoader.js` / `GameLoader.js` — import hook contracts from the registry instead of duplicating them.
- `server/index.js` — one `submissions` Map (`{id, kind, slotKey, uid, displayName, code, submittedAt, isUpdate}`) replaces `pendingSubmissions`/`pendingGames`; 10 endpoints collapse to 5: `POST /api/submit`, `GET /admin/pending(?kind=)`, `GET /admin/pending/:id/code`, `POST /admin/approve`, `POST /admin/reject`. `/admin/remove-room` and `/admin/assign-room` stay as-is — slot-management tools, not part of this generalization.
- `admin.html` — one Pending tab with a kind filter replaces the two hardcoded tabs; the third hand-duplicated validator (client-side "Validate Code" preview JS) is deleted and routed through the server's existing `/admin/validate` with a `kind` param.
- `WorldScene.js` `_submitClaim()`, `RoomScene.js` `_submitGameCode()`, `admin.html`'s own game-submit form — all three POST call-sites update to `/api/submit` with `{kind: ...}`.

**Legacy linking:** the 13 already-approved rooms stay uid-less indefinitely, no forced migration — every read site treats a missing `uid` as `null`, purely additive. New admin action `POST /admin/link-owner {password, slotKey, uid}` sets `slotAssignments[slotKey].uid` directly, no re-validation, for when an original creator signs in and identifies themselves. Once linked, the admin pending-queue UI shows a soft, non-blocking indicator if a new submission's `uid` doesn't match — an improvement over today's zero-check model, not a new restriction.

**Firestore scope decision:** introduce Firestore now, but only for `users/{uid}` (`displayName/email/photoURL/slotKey`), server-only via the Admin SDK — no client-side security-rules surface needed yet. The full expanded model below (`creations/{id}` with versions/remixedFrom/processLog/linkedArtifacts, `objects/{id}`, `feedback/{id}`, `sessions/{id}`) is Phase 11+ territory and deliberately NOT built now — none of those fields have a reader/writer yet, so standing them up early would mean running two parallel sources of truth (a Firestore doc *and* the existing `src/rooms/*.js` file) before necessary. 9B instead extends the already-proven `slotAssignments`/`slots.json` pattern with a `uid` field; Phase 11's eventual migration to `creations/{id}` is a well-scoped one-time move of ~74 slot entries.

**Firestore model (target shape for Phase 11+, not built in 9B):**
```
users/{uid}       → { displayName, email, photoURL, slotKey, characterConfig, profileVisible }
creations/{id}    → { uid, kind, slotKey, name, code,
                       versions: [{ code, description, createdAt }],  // max 5, creator prunes
                       shared: boolean, remixedFrom: creationId|null,
                       processLog: { past, present, future, updatedAt },
                       linkedArtifacts: [{ label, url }],
                       createdAt, updatedAt }
objects/{id}      → { uid, roomCreationId, subKind: 'decorative'|'interactive',
                       shapeData: {...} | code: '...', x, y, movable: boolean,
                       approved: boolean, createdAt }
feedback/{id}     → { creationId, source: 'online'|'self-recorded',
                       authorUid: uid|null, sessionId: id|null, text, createdAt }
sessions/{id}     → { hostUid, roster: [uid], startedAt, endedAt, status }
```

**Milestones (each leaves the app in a working, testable state):**
- **M0 — Setup, no behavior change:** Firebase project + Google provider enabled, Codespaces domain authorized, service account issued, deps installed, env vars in place.
- **M1 — Auth live (9A): ✅ complete (2026-07-16).** `LoginScene` gates world entry, real `uid`/`displayName` flow into `PlayerState`, server verifies tokens, `users/{uid}` upserts in Firestore. Submission pipeline untouched.
- **M2 — Pipeline generalized (9B):** registry + 5 unified endpoints replace the dual pipeline; `admin.html` becomes kind-agnostic; the three submit call-sites updated.
- **M3 — Ownership tightens (9B):** new claims always carry a verified `uid`; `link-owner` action available for the 13 legacy slots; mismatch indicator live in the admin queue.

Why this ordering: Phase 8 (town square) has no such dependency and ran first. From here on, auth must exist before anything can be attributed to a player (feedback, remixing, profiles all need a stable `uid`). The generic submission system must exist before Phase 11 adds more kinds, or the duplication debt compounds.

---

### PHASE 10 — CHARACTER CREATOR (PLANNED, unchanged)

Goal: New players create a custom character via Gemini prompt before entering the world. Character persists in Firestore and renders for all other players.

New files to create:
- `src/engine/CharacterScene.js` — forced lobby for new players; Gemini prompt + JSON paste + live preview + save
- `src/engine/CharacterRenderer.js` — pure function `drawCharacter(graphics, config, x, y)` shared by all scenes

Files to modify:
- `server/index.js` — `POST /api/auth/save-character` (write characterConfig to Firestore)
- `src/engine/WorldScene.js` — use `drawCharacter()` for local + other players; fetch other players' configs via `/api/character/:uid` and cache in a Map
- `src/engine/RoomScene.js` — same pattern; falls back to `createOtherPlayer()` if room exports it

Character config (simple JSON, upgradable to free-form JS later):
```json
{
  "bodyColor": "#4ecdc4", "headColor": "#ffcc00", "eyeColor": "#222222",
  "bodyShape": "round",  "accessory": "hat",  "accessoryColor": "#ff6b6b", "scale": 1.0
}
```

---

### PHASE 11 — NESTED CREATIONS, ROOM MUSIC & OBJECTS (PLANNED, expanded 2026-07-14)

Goal: let creators attach external links to objects in their room, add room music as a registered creation kind, and let creators add discrete objects to their world — some approved instantly, some through normal review — without ever needing to resubmit or regenerate the whole room.

- **Nested creations (external links):** an object in a room can carry a `linkedArtifacts` entry (label + URL). Interacting with it opens the URL in a new tab — no iframing/embedding, since the linked site isn't vetted code.
- **Room music:** vibe-coded (Gemini-generated Web Audio API / synth code, not an uploaded file — keeps it inside the existing code-validation pipeline rather than needing file storage). Registered as kind `music` in the Phase 9 registry, with its own contract (e.g. a `play(scene)` hook) and validator, reusing the generic approval queue.

**Objects (new, decided 2026-07-14):** two distinct sub-types, both registered under the `object` kind in the Phase 9 registry, both submitted and tracked as individual units — never bundled into or requiring resubmission of the room's main code:

1. **Decorative objects — data, not code, auto-approved.** Described as a shape list (rectangles, triangles, polygons, circles), with optional gradients, a glow preset, and a small set of animation presets (`pulse`, `rotate`, `drift`, `colorCycle`) — matching the visual techniques already used by the hand-built town-square decor (portals, paper airplane, sign post), all of which turn out to be expressible as pure data. A static object is one shape list; a simple animation (e.g. a blink or wave) is two shape lists ("frames") swapped on a timer. Because there's no executable logic, a submission can be fully validated automatically — valid shape types, in-bounds coordinates, valid colors — and approved or rejected instantly with no human review and no wait.
2. **Interactive objects — real code, reviewed like a room, but submitted in isolation.** Anything needing actual logic (reacts to the player beyond simple proximity, has physics, generates itself with randomness) is genuine code, so it goes through human review the same way room and game code does today. Critically, it is submitted and reviewed as its own small, standalone unit — a player adding one interactive object never resubmits or regenerates their whole world; the admin reviews just that object's code, the same way game submissions already review separately from the room they attach to.

**Movable objects:** any placed object (decorative or interactive) can be flagged `movable`. Moving one is a `{id, x, y}` position patch against an object that's already approved — never needs admin review, since it can't introduce new code, visuals, or behavior, only relocate something already vetted. Removing an object is likewise never reviewed — deletion can't introduce risk. Persistence: local-only (resets each visit) until Phase 9 auth exists, then server-saved and gated by "does this `uid` match the room's creator" — there's no secure way to check real ownership before that.

**Admin panel implication:** the pending queue only ever shows interactive-object submissions, as small isolated items — decorative objects never appear there, since they're resolved automatically the instant they're submitted.

---

### PHASE 12 — CREATIVE PROCESS LOG (PLANNED, new)

Goal: per-creation past/present/future reflection, editable by the creator, visible to anyone viewing the creation.

- In-game popup UI (same interaction pattern as the current notice-board signposts), attached to each creation, editable only by its creator
- Stored on `creations/{id}.processLog`
- Surfaces later on the profile page (Phase 16)
- Link-out (documenting elsewhere and pasting a URL instead of using in-game fields) is deferred — a possible future addition, not built now

---

### PHASE 13 — SHARING & REMIX + VERSION HISTORY (PLANNED, new)

Goal: opt-in code sharing, self-declared remix attribution, capped version history.

- `creations/{id}.shared` toggle, set by the creator (default off)
- Submission form gains an optional "based on" picker over currently-shared creations → sets `remixedFrom`
- New version submissions append to `versions[]` (max 5); when a 6th would be added, the creator picks which existing version to drop before it's accepted
- Each version carries a short creator-written description of what changed
- Re-validation (existing `node --check` + hook checks) runs on every new version, same as today's "submit updated version" flow — no change to the admin's safety review

---

### PHASE 14 — FEEDBACK SYSTEM (PLANNED, new)

Goal: online feedback (togglable) + always-available self-recorded feedback, tagged by source.

- Admin panel gains a global online-feedback on/off switch
- When on: any player can leave feedback on a creation (in-game popup, signpost-style interaction); stored with `source: 'online'`, `authorUid` set
- Self-recorded feedback: always available to the creator regardless of the global toggle; `source: 'self-recorded'`, `authorUid: null`
- Creator can respond to any feedback entry (a thread of two, not open discussion)
- No moderation queue for feedback at this stage — only in-world code submissions go through admin approval

---

### PHASE 15 — IN-PERSON SESSION MODE (PLANNED, new)

Goal: admin-started, invite-only temporary world instance for a facilitated group.

- Admin panel: "Start session" — pick a roster of registered players, spins up a session-scoped world instance (separate Colyseus room from the persistent main WorldRoom)
- Players in a session see each other; online feedback is implicitly live for the session's duration (no separate toggle needed inside a session)
- "End session" — creations made during the session enter the normal Phase 9 approval pipeline to join the main world
- On promotion to the main world: self-recorded feedback attached to a creation carries over; session-scoped *online* feedback does not
- `sessions/{id}` tracks roster + status; feedback entries tag `sessionId` so session-only online feedback can be excluded from what carries over

---

### PHASE 16 — PROFILE PAGE (PLANNED, new)

Goal: a page (outside the Phaser canvas, a normal web route) showing one player's creations, Creative Process Logs, and feedback received — visible to all players.

- Route reads `creations`, `processLog`, and `feedback` filtered by `uid`
- Visible to everyone by default; `users/{uid}.profileVisible` is an admin-only toggle (not player-controlled) for the rare case of hiding one
- Built after Phases 12–14 since it's an aggregation view over data those phases produce — no new data model of its own

---

### PHASE 17 — DEPLOYMENT (PLANNED, was Phase 16, was Phase 10 originally — renumbered twice)

Goal: Deploy frontend to Firebase Hosting (`yourapp.web.app`) and Colyseus to Railway.

Architecture:
- Firebase Hosting → Vite-built frontend (static)
- Railway → Colyseus Node server (persistent WebSocket)
- Firebase Auth + Firestore → already cloud-hosted

New files: `firebase.json`, `.firebaserc`, `railway.json`, `.env.local` (git-ignored), `.env.production`

Key changes:
- `vite.config.js` — proxy only active in dev; production reads `VITE_COLYSEUS_URL`
- `server/index.js` — CORS for Firebase Hosting domain; service account from env var
- `package.json` — add `"deploy": "vite build && firebase deploy --only hosting"` script

Manual one-time steps (owner):
1. Create Firebase project, enable Google Auth, create Firestore DB
2. Download service account JSON → set as Railway env var `FIREBASE_SERVICE_ACCOUNT`
3. `firebase login && firebase init hosting`
4. Deploy Colyseus to Railway via GitHub integration
5. Set `VITE_COLYSEUS_URL` in Railway env vars pointing to Railway URL

---

### Admin panel redesign (threaded through Phases 9–16, not a separate phase)

By Phase 15 the admin panel needs, beyond what exists today:
- Kind-agnostic pending queue, decorative objects excluded entirely, interactive objects shown as small isolated items (Phase 9, Phase 11)
- Global online-feedback toggle (Phase 14)
- Session start/end + roster picker (Phase 15)
- Per-user profile-visibility toggle (Phase 16)

Worth doing as one redesign pass once Phase 9's generic submission system lands, rather than incrementally bolting UI onto the current two-tab (Rooms/Games) layout.

---

## General Rules (apply to all phases)

- Never block on missing art — use colored rectangles and text for everything visual
- Each file does one job — no mixing concerns
- Short comment at top of every file explaining what it does
- Adding a player room = 2 file changes only: drop file in `src/rooms/`, add one line to `WorldScene.js`
- Room files must be fully self-contained — interact with engine only through the `scene` object
- Hooks (name, onLoad, onCreate, onUpdate, onExit) are THE CONTRACT — never rename or remove them
- Rooms must fail safely — try/catch all hook calls, show friendly error, return to WorldScene
- Asset keys must be namespaced by room name (e.g. `myroom_floor` not `floor`) to avoid cache conflicts
