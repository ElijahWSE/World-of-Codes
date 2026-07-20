# World of Codes — Project Brief

This file is the single source of truth for the project. Read this at the start of every new session.

---

## What This Project Is

A 2D top-down multiplayer game world (Zelda/Pokemon perspective) that runs in the browser with no install required for players.

There is a **shared town square** where all players can walk around and see each other in real time. Around the town square are **doors** that lead to individual **player rooms**. These rooms — along with mini-games, room music, and other future creation types — are built by players using Gemini AI ("vibe coding"). Players submit their generated code in-game; I manually review and approve it before it joins the shared world.

Beyond sharing and trying out creations, the platform is meant to encourage players to document their creative process, give and receive feedback, and optionally share their code so others can remix it. A public profile page gives each player an overview of everything they've made, without needing to walk the world to find it.

**Current status:** Phases 1–7 are complete and live. Phase 8's core town square redesign is also complete and live as of 2026-07-14 (Singapore-themed rectangular grid city, Town Garden hub, Mario-style backdrop band) — see Phase 8 below for what shipped vs. what's still planned (levels, hub-scene refactor, portal facades, stepped terrain). Phase 9 (Auth + Generalized submission system) is complete and live as of 2026-07-16, and fully closed out as of 2026-07-17 after live in-browser verification surfaced and fixed several real bugs (stale game-submit overlay, room updates not visually refreshing due to ES module caching, `[E]` staying stuck on a live-approved game, unreadable hint text, and owner-mismatch changed from a soft badge to a hard block) — see Phase 9's "Manual UI verification" note for the full list. Google Sign-In gates world entry with real `uid`/`displayName` flowing through multiplayer state; one `kind`-aware submission pipeline (`src/creation-kinds/*`) now serves both rooms and games, replacing the old duplicated pipeline, ready for Phase 11 to add `music`/`object` as new kinds without touching the pipeline itself. Phase 10 (character creator) is complete and live as of 2026-07-17 — new players design a character as a shape-recipe (validated JSON, no admin review needed) before entering the world, with a shared idle-bob/walk-cycle/direction-flip animation applied uniformly by `CharacterRenderer`; see Phase 10's "Manual verification" note for two real bugs found and fixed during testing. Phase 11 (nested creations, room music & objects) is complete and fully closed out as of 2026-07-20 — all 4 milestones (decorative objects + nested links; move/edit/delete; interactive objects; room music) are built and verified live in-browser by the owner, plus a new in-room `[H]` Help window (player guide + copy-paste Gemini Design/Export prompts for objects/music) shipped alongside M4. Live verification of M4 surfaced and fixed two real bugs — see Phase 11's M4 status note for the full list, including a `_music_template.js`/Help-prompt update (`audioCtx.resume()` guidance) added after a real submitted track played silently due to a suspended AudioContext. World size and movable objects, previously open questions, were resolved 2026-07-14 and are now part of Phase 8 and Phase 11's content respectively.

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

### PHASE 9 — FOUNDATION: AUTH + GENERALIZED SUBMISSION SYSTEM ✅ COMPLETE (split into 9A/9B 2026-07-15, closed out 2026-07-17)

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

**Legacy linking:** the 13 already-approved rooms stay uid-less indefinitely, no forced migration — every read site treats a missing `uid` as `null`, purely additive. New admin action `POST /admin/link-owner {password, slotKey, uid}` sets `slotAssignments[slotKey].uid` directly, no re-validation, for when an original creator signs in and identifies themselves. **Revised 2026-07-17:** the original plan was a soft, non-blocking mismatch indicator in the admin queue — changed to a hard block instead, per owner decision (the legacy rooms will eventually be deleted, so the "first signed-in update claims an unlinked slot" edge case was accepted as acceptable). `/api/submit` now rejects (403, before a pending entry is even created) any update whose `uid` doesn't match a slot's already-linked owner. `WorldScene` also blocks proactively — a locked portal shows "🔒 Owned by another creator" instead of the `[U] Update World` hint, and pressing `[U]` on one shows a rejection toast without ever opening the submit form. The `ownerMismatch` badge in `admin.html` and `/admin/pending` was removed as dead code, since nothing mismatched can reach the queue anymore.

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
- **M2 — Pipeline generalized (9B): ✅ complete (2026-07-16).** `src/creation-kinds/{room,game,index}.js` registry replaces the duplicated `validateRoomCode`/`validateGameCode`/`RoomLoader`/`GameLoader` hook lists. Server's `submissions` Map + 5 endpoints (`POST /api/submit`, `GET /admin/pending(?kind=)`, `GET /admin/pending/:id/code`, `POST /admin/approve`, `POST /admin/reject`) replace the old 10. `admin.html` has one kind-filterable Pending tab; its duplicated client-side `CHECKS`/`GAME_CHECKS` regex arrays are gone — all validation (submission, admin preview, direct-assign) now routes through the same `getKind(kind).validate(code)` + `checkSyntax(code)`. `WorldScene._submitClaim()` and `RoomScene._submitGameCode()` both post to `/api/submit`. Verified live via direct endpoint calls: room submit→approve, game submit→approve (including a new `scene.exitGame()` presence check games didn't have before), reject (confirmed no file write), and a room *update* correctly preserving `gameFileName`/`uid` that a pre-refactor code path would have silently dropped. Re-validated all 13 legacy rooms' hook contracts against the new registry — zero regressions.
- **M3 — Ownership tightens (9B): ✅ complete, revised 2026-07-17.** New claims carry `uid` end-to-end. `POST /admin/link-owner {password, slotKey, uid}` binds a legacy slot to a real account. Originally a non-blocking `ownerMismatch` badge in the admin queue; now a hard block at `/api/submit` plus a proactive client-side lock on `[U]` — see "Legacy linking" above for the full revision.

Why this ordering: Phase 8 (town square) has no such dependency and ran first. From here on, auth must exist before anything can be attributed to a player (feedback, remixing, profiles all need a stable `uid`). The generic submission system must exist before Phase 11 adds more kinds, or the duplication debt compounds.

**Manual UI verification: ✅ complete (2026-07-17).** All 7 checklist items from the 2026-07-16 pass were clicked through live in-browser. Items 1, 2, 3, 4, 6 passed as originally designed. Items 5 and 7 surfaced real bugs, found and fixed during this pass — Phase 9B is now fully closed:

- **Item 5 (room update preserving the linked game)** passed at the data layer, but exposed a separate, worse bug: approved room *updates* never visually changed in-browser at all. Root cause — `fileNameFor()` deliberately reuses the same filename across updates so the module URL stays stable, but the client's `import('/rooms/' + fileName)` had no cache-busting, so the browser's ES module cache kept returning the pre-update module forever. Fixed with a `roomVersion`/`gameVersion` timestamp stamped on every approved write (`server/index.js`), appended as `?v=` on every dynamic `import()` in `WorldScene.js` and `RoomScene.js`.
- **Item 7 (owner mismatch)** also surfaced a related live-approval bug independent of the badge itself: after a game got approved while a player was already standing inside that room, `[E]` stayed stuck on `???` forever — `RoomScene` had no way to learn a game had just been approved. Fixed by having `RoomScene` subscribe to the same `slotsUpdated` broadcast `WorldScene` already used, re-fetching and reloading the game module live.
- Also during this pass: the game-submit overlay's Submit/Cancel buttons stopped responding after visiting more than one room in a session — `RoomScene._createGameOverlay()` recreated its `<div>` on every room entry without ever removing the previous one, so `document.getElementById()` bound the click handlers to a stale, invisible orphan instead of the visible overlay. Fixed by removing any leftover `#woc-game-overlay` at the top of `create()`.
- The `[E]`/`[G]` in-room hints were also hard to read — not just low contrast, but drawn at a fixed `depth: 20` while rooms commonly y-sort their own art up to `depth: 1200`, so hints could render underneath room content sharing the same anchor point. Raised to `depth: 2000` and given a solid background pill.
- Owner-mismatch handling itself was revised from a soft admin badge to a hard block, per the "Legacy linking" section above.

---

### PHASE 10 — CHARACTER CREATOR ✅ COMPLETE (schema revised + built + verified 2026-07-17)

Goal: New players create a custom character via Gemini prompt before entering the world. Character persists in Firestore and renders for all other players. This is deliberately kept simple — it's the first thing a new player must successfully create before they can enter the game at all, so the bar is "quick and can't fail," not maximum expressiveness. More elaborate character editing (see "Deferred" below) is a later phase, once players are already comfortable with the platform.

**Schema decision (2026-07-17):** originally scoped as a fixed enum config (`bodyShape: 'round'|'square'|...`, one `accessory` slot). Revised after comparing against the hand-authored Pooh Bear character already live in `kristabelly.js` (13 layered `fillRect`/`fillCircle` calls, no sprites) — enums capped out well below that level of polish. Replaced with a **shape-recipe list**: a character is an ordered array of primitive shapes, the same technique Pooh already uses, just as data instead of hardcoded Graphics calls. This keeps the same safety profile as Phase 11's decorative objects (pure data, no executable logic, so no admin review needed — validated and rendered instantly) while reaching comparable visual detail.

Character config:
```json
{
  "shapes": [
    { "type": "rect",   "x": -12, "y": -25, "w": 24, "h": 30, "color": "#1e3a8a" },
    { "type": "circle", "x": 0,   "y": -38, "r": 12,           "color": "#ffdbac" },
    { "type": "circle", "x": -4,  "y": -40, "r": 2,            "color": "#222222" },
    { "type": "circle", "x": 4,   "y": -40, "r": 2,            "color": "#222222" }
  ],
  "scale": 1.0
}
```
- Allowed `type`: `rect`, `circle` (`triangle`/`ellipse` possible later if the vocabulary turns out too limiting in practice)
- Shape count capped (~20) for safety/performance, not as a creative constraint — Pooh uses 13
- `scale` clamped to a sane range (e.g. 0.8–1.3) so name-tag offset and the collision circle don't break at the extremes
- Validated the same way rooms/games are (bounds/type checks), but since there's no logic to review, validation is synchronous and instant — no pending-queue step

**Generic animation, shared by every character regardless of its shape list:** idle bob, a walk-cycle leg-swap, and a direction flip when moving left/right, all implemented once inside `CharacterRenderer` itself rather than per-character. This is what gives every character Pooh-level "aliveness" (his idle bob is one `Math.sin()` in `kristabelly.js`'s `onUpdate` today) without requiring any player to write animation logic. Not per-character customizable in this phase — a uniform baseline, deliberately, to keep character creation simple.

**Live preview must be the same code path as in-game rendering**, not a separate preview-only renderer — `CharacterScene` mounts a small Phaser view that calls the exact same `CharacterRenderer.drawCharacter()` and the exact same shared animation tick that `WorldScene`/`RoomScene` use, so what's previewed is guaranteed identical to what other players will actually see. Since there's no real movement on a static creation screen to trigger the walk-cycle/flip naturally, the preview **auto-demos on a repeating loop** (walk a few steps right → flip → walk left → return to idle) with no input required, so a player sees all three animation states before ever saving.

**Built:**
- `src/engine/CharacterRenderer.js` (new) — `sanitizeConfig()` (isomorphic validation/clamping — imported directly by `server/index.js`, no Phaser dependency, same isomorphic pattern as `src/creation-kinds/*.js`), `createCharacter(scene, config, x, y)` (builds a Container + one Graphics child from the shape list), `updateCharacter(container, {moving, facingX, delta})` (the shared idle-bob/walk-cycle/direction-flip tick), `fetchCharacterConfig(uid)` (module-level cache shared across `WorldScene` and `RoomScene`, not per-scene, so a player resolved in one is never re-fetched in the other)
- `src/engine/CharacterScene.js` (new) — forced lobby: Gemini prompt with a Copy button, JSON paste textarea, live animated preview (auto-demo loop: idle → walk right → idle → walk left → idle, repeating), Save & Enter World
- `server/index.js` — `POST /api/auth/save-character` (re-validates with `sanitizeConfig()` before writing — never trusts a client-shaped object straight into Firestore); `GET /api/character/:uid` filled in (was a Phase 9A stub); `/api/auth/verify` now also returns `characterConfig` so `LoginScene` can decide routing without an extra round-trip
- `src/engine/main.js` / `LoginScene.js` — `CharacterScene` registered; routes there if the signed-in account has no saved `characterConfig` yet, straight to `WorldScene` otherwise
- `src/engine/WorldScene.js` / `RoomScene.js` — local + other players both render via `CharacterRenderer`; a room's own `createOtherPlayer()` export still takes priority over a visiting player's real character (preserves existing hand-authored rooms' visitor rendering, e.g. `kristabelly.js`'s Pooh-style residents) — but only for *other* players seen inside that specific room; it has no effect on the player's own character, in that room or anywhere else

**Manual verification: ✅ complete (2026-07-17).** All 10 checklist items passed. Two real bugs were found and fixed during the pass, both regressions from this build rather than pre-existing issues:
- **Two-account visibility** crashed the whole world for every player the instant a second account's character was still loading: `updateCharacter()` read `container.list[0]` before checking whether `container` was even a real character container. The gray placeholder shown for a brand-new player mid-fetch is a plain `Rectangle` with no `.list` property, so the very first frame after a second account joined threw `Cannot read properties of undefined`. Fixed by checking `characterAnim`/`characterConfig` before ever touching `.list`, plus an `animated` flag on both scenes' other-player entries so the update loop doesn't even attempt the call until the swap-in completes.
- **Entering almost any room** left the player's default character orphaned in the scene — still visible, standing static, still physics-enabled — while a *different*, room-authored character (assigned via `scene.player = ...`) was the one actually moving. Root cause: `RoomScene` creates a real character container before `loadRoom()` runs, but `scene.player = /* your character container */;` is the standard pattern taught by the room-creation Gemini prompt itself (`WorldScene.js`'s Prompt 2) — 12 of 13 existing rooms use it to give the local player a themed look. `RoomScene` never accounted for the room replacing its own default. Fixed by keeping a reference to the original container and destroying it if `scene.player` no longer points to it once `loadRoom()` returns.

**Deferred (not this phase):** richer per-character editing (gradients, glow presets, per-shape animation like Phase 11's decorative-object `pulse`/`rotate`/`drift`/`colorCycle`), and/or a full free-form-code character option reusing the Phase 9 creation-kind pipeline for players who want bespoke animation/behavior beyond the shared baseline. Both were discussed and intentionally punted — the former is a natural extension of the shape-recipe once it's live, the latter reintroduces admin-approval latency to something that currently gates world entry, which is a bigger structural change than Phase 10 needs.

---

### PHASE 11 — NESTED CREATIONS, ROOM MUSIC & OBJECTS (✅ COMPLETE — all milestones verified live, closed out 2026-07-20)

Goal: let creators attach external links to objects in their room, add room music as a registered creation kind, and let creators add discrete objects to their world — some approved instantly, some through normal review — without ever needing to resubmit or regenerate the whole room.

**Persistence decision (2026-07-19):** objects get their own new, additive Firestore collection (`objects/{id}`, an in-memory `objectsCache` mirroring `slotAssignments`'s role for `slots.json`) rather than migrating rooms/games into the bigger `creations/{id}` shape sketched in Phase 9B's Firestore scope note. That fuller migration is Phase 13's (version history/remix) concern, not a Phase 11 prerequisite — rooms, games, and music all keep working exactly as they do today, untouched.

**M1 status (2026-07-19): ✅ complete, verified live in-browser by the owner.** Ships decorative objects + nested-link interaction end-to-end:
- `src/engine/ObjectRenderer.js` (new) — generalizes `CharacterRenderer.js`'s shape-recipe technique: `sanitizeObjectConfig()` (isomorphic, reused server-side exactly like `sanitizeConfig`) validates a shape list (`rect`/`circle`/`triangle`/`polygon`, optional 2-color gradient), `createObject()`/`updateObject()` render it and drive one of four animation presets (`pulse`/`rotate`/`drift`/`colorCycle`).
- `server/index.js` — new `objects` Firestore collection + `objectsCache` Map loaded at boot (top-level await); `POST /api/objects/decorative` (idToken + room-owner check, auto-approved instantly, no `submissions` entry — matches the "decorative objects never touch the admin queue" rule); `GET /api/objects?slotKey=`; `POST /api/objects/:id/move` and `DELETE /api/objects/:id` (owner-gated via the object's own `ownerUid`, never admin-reviewed, built alongside M1 since they were cheap given the store already exists — milestone 2 is otherwise unstarted, see below).
- `src/engine/RoomScene.js` — fetches and renders a room's decorative objects on entry, re-fetches on a new `objectsUpdated` broadcast (mirrors `slotsUpdated`); `[E]` near an object with a `linkedArtifacts` entry opens the URL in a new tab (`window.open`, never in-game); room owners get an `[O] Add Object` overlay (paste shape-config JSON, placed at the player's current position, posts straight to `/api/objects/decorative`).
- Verified: full server boot with the new Firestore collection, `npx vite build` clean, every new endpoint's validation branch via direct `curl` (missing idToken → 400, invalid slot → 400, invalid idToken → 401, wrong owner → 403, move/delete on nonexistent id → 404), **and** a live in-browser pass by the owner (2026-07-19): `[O] Add Object` gated correctly to the room's owner, decorative object added and rendered instantly with the chosen animation preset, survived a page refresh (confirms the Firestore round-trip, not just an optimistic client render), and a `linkedArtifacts` object's `[E]` interaction opened the URL in a new tab as designed.
- **M2 status (2026-07-19): ✅ complete, verified live in-browser by the owner.** Ships move, edit, and delete for placed objects, plus a scope simplification:
  - **Design change: the "Movable" checkbox is gone.** Originally decorative objects could be flagged movable or not; the owner decided there's no reason for that distinction (a move/delete can't introduce new code or visuals, so there's nothing to gate) and asked for every decorative object to just always be movable. Server: `/api/objects/decorative` now always stores `movable: true`; `POST /api/objects/:id/move` no longer checks the flag at all. The `movable` field stays in the schema for interactive objects (milestone 3), which may need the real distinction once that lands. Client: the checkbox is gone from the Add Object form.
  - **Move (drag):** `RoomScene.js` grants `setInteractive()` + `setDraggable()` to every object container, but only for `_isRoomOwner` (checked once ownership resolves, and re-checked for objects drawn before that async check lands). Scene-level `dragstart`/`drag`/`dragend` handlers (bound once in `create()`) move the container live during the drag (clamped to room bounds, depth re-sorted to the new y), then POST the final position to `POST /api/objects/:id/move` on `dragend`, re-fetching to snap back to server truth on failure. Player movement freezes during a drag, same as the existing overlay-open freeze.
  - **Edit:** new `POST /api/objects/:id/edit` (owner-gated exactly like move/delete, re-validates via `sanitizeObjectConfig` — still pure data, so still no admin review). The existing Add Object overlay now doubles as an edit form: `[C]` near an owned object opens it pre-filled with that object's current shape-config JSON and link fields; submitting POSTs to the edit endpoint instead of the create one.
  - **Delete:** client UI for the already-existing (M1) `DELETE /api/objects/:id` endpoint, which had no button until now. `[X]` near an owned object deletes it after a `window.confirm()`.
  - **Real bug found and fixed during this pass:** editing an object's shape config saved correctly server-side but didn't visually update — `_fetchAndDrawObjects()` only ever repositioned existing object containers on refetch, never redrew their shapes, because until edit existed a placed object's shape list was assumed static for its whole lifetime. Fixed by adding `ObjectRenderer.setObjectConfig()` (redraws the existing Graphics child in place, preserving drag-interactivity already set up on the container) and calling it from `_fetchAndDrawObjects()` whenever the fetched `shapeConfig` differs from what's currently rendered; the linked-artifact hint is now similarly synced (created/destroyed/relabeled) instead of assumed fixed at creation.
  - Verified live: owner-only `[C]`/`[X]`/drag all correctly gated to room ownership, drag persists across a refresh, an edited object's new shapes render immediately, delete removes the object for all clients via the existing `objectsUpdated` broadcast. `npx vite build` clean throughout.
- **M3 status (2026-07-20): ✅ complete, verified live in-browser by the owner** (server-side logic was `curl`-verified first; a follow-up live pass confirmed submit → admin review → approve → render → `[E]` interact → `[X]` delete with `onRemove` cleanup all work end-to-end, using a test object with a rotating polygon, a color-cycling `onInteract`, and a counter label to make each hook's effect independently visible). Ships the second object sub-kind — interactive objects (real code, admin-reviewed, submitted/approved as an isolated unit, never bundled into a room):
  - `src/creation-kinds/object.js` (new) — `kind: 'object'`, required hooks `onLoad`/`onCreate`/`onUpdate`/`onInteract` (flat top-level exports, mirroring `room.js`'s style rather than `game.js`'s nested-object style), same import/require/fetch/document/localStorage bans, `fileNameFor({id}) → object-${id}.js`. Registered in `src/creation-kinds/index.js`.
  - `src/objects/_template.js` (new) — the interactive-object contract, modeled on `src/rooms/_template.js`. Documents a per-instance `ctx = {x, y, id}` object passed to every hook (the object-level equivalent of `scene.roomData`), and one **optional** hook beyond the original 4-hook sketch: `onRemove(scene, ctx)`, called before a deleted object's entry is torn down so code that created extra `scene.add.*` visuals can clean them up (added because there's no `onExit`-equivalent lifecycle otherwise, and without it a delete would leave orphaned visuals on screen until the room reloads).
  - `server/index.js` — `OBJECTS_DIR` now created at boot and served statically (`app.use('/objects', ...)`, mirrors `/rooms`); `/api/submit` accepts an optional `meta` bag (used for `{x, y}` on object submissions) and **relaxes the "one pending submission per kind+slot" guard specifically for `kind: 'object'`** — a room can have several interactive-object submissions pending review at once, unlike room/game; `isUpdate` is always `false` for objects (create-only this milestone, see below). `/admin/approve` restructured from an `if (room) {...} else {...(assume game)}` into explicit `room`/`game`/`object` branches; the object branch writes the file and persists a new `objects` store record reusing the submission's own id as the object's permanent id (`fileNameFor({id: sub.id})`) — no separate id-generation step needed. Approval requires the target slot to already have an approved room (same rule games already follow).
  - `vite.config.js` — added an `/objects` dev-server proxy entry (mirrors `/rooms`); without it the client's dynamic `import()` of an approved object file would 404 in dev.
  - `src/engine/RoomScene.js` — `_objectContainers` entries now carry a `subKind` and branch throughout: interactive entries dynamically `import()` the approved file (same cache-busting `?v=` pattern as games), call `onLoad`+`onCreate` once, `onUpdate` every frame, and `onInteract` on `[E]` within the same ~70px proximity threshold decorative links use. Owner-only `[X] Delete` works for interactive objects too (reuses the existing generic, subKind-agnostic delete flow built in M1/M2). The `[O]` Add Object overlay gained a Decorative/Interactive mode toggle — Interactive mode swaps the shape-config JSON textarea for a code textarea and posts to `/api/submit` with `kind: 'object'` instead of the decorative-only endpoints.
  - `admin.html` — added an `Object` option to the existing kind filter; the pending-card template needed no changes (already kind-agnostic from Phase 9B).
  - **Explicit scope cuts for M3** (all logged as intentional, not oversights): no editing/resubmitting an approved interactive object's code (create-only — matches the M1→M2 precedent where decorative edit shipped a milestone after decorative create); no drag-move for interactive objects (decorative objects are draggable because `ObjectRenderer.createObject` hands the engine one `Container` it can reposition directly — interactive object code calls `scene.add.*` itself with no single container to grab, so dragging would need a new contract hook); no `linkedArtifacts` support on interactive objects (an object's own `onInteract` can `window.open()` a link itself if the author wants that — `window` isn't banned by `validateCode`, same as today).
  - **Verified this session via `curl` against a live server boot:** incomplete code correctly rejected with per-hook "Missing" errors; a second concurrent interactive-object submission for the same room accepted (not blocked by the per-slot guard); `/admin/pending?kind=object` correctly isolates object submissions from room/game; approval writes `src/objects/object-<id>.js`, creates the `objects` store entry with `subKind: 'interactive'`, and the file is reachable via `GET /objects/...`; rejection removes the submission with no file/store side effects; the unauthenticated-delete guard (built in M1/M2, reused as-is) still 400s without an idToken. `npx vite build` clean; `node --check` clean on all new/changed files; server boots cleanly with the new `/objects` static route and `mkdirSync`. Test data (one submitted-and-approved object) was cleaned up (file removed, Firestore doc deleted) after verification, so the live object count is unchanged from before this session.
  - **Live verification (2026-07-20):** owner walked into an owned room, pressed `[O]`, switched to Interactive mode, submitted a test object, approved it via `/admin` filtered to `kind=object`, confirmed it rendered at the submitted position with a spinning `onUpdate` animation, confirmed `[E]` correctly fired `onInteract` (color cycled, counter label updated), and confirmed `[X]` deleted it with `onRemove` firing (no orphaned visuals left behind). Decorative objects (add/drag/edit/delete) re-verified as a regression check since M3 touched shared `_fetchAndDrawObjects`/`update()` code paths.
- **M4 status (2026-07-20): ✅ built, server-side verified via `curl`; browser-driven verification (hearing the audio, walking in/out of a room) not done this session — the owner should confirm before treating M4 as fully closed out.** Ships the last item from the original Phase 11 sketch — room music (`~/.claude/plans/clever-yawning-torvalds.md`; the M4 implementation plan is at `~/.claude/plans/immutable-finding-parasol.md`):
  - `src/creation-kinds/music.js` (new) — `kind: 'music'`, nested-object export style (`export const music = {musicName, play, stop}`, mirroring `game.js` rather than `room.js`/`object.js`'s flat style, since music — like a game — attaches to an already-approved room). **Both `play(scene)` and `stop(scene)` are required hooks, not optional** — a submission without a working `stop` can't be approved, since a running Web Audio `AudioContext` isn't cleaned up by leaving the room otherwise. `targetDir: 'src/rooms'` (reuses the existing `/rooms` static route — no new dev-server proxy needed). `fileNameFor({slotKey}) → music-${slotKey}.js`, deterministic — one track per room, replaceable via resubmission (has an `isUpdate` flow, unlike objects' create-only M3 scope).
  - `src/rooms/_music_template.js` (new) — the contract doc, modeled on `_template.js`/`src/objects/_template.js`. Explains: no audio file/asset ever — everything is Web Audio API synthesis (`AudioContext`, oscillators, gain nodes); keep a module-level `let` reference (not a per-instance `ctx`, since there's only ever one music instance per room) so `stop()` can reach what `play()` created.
  - `server/index.js` — `buildSlotList()` gained `musicFileName`/`musicVersion` (mirrors `gameFileName`/`gameVersion`); `/api/submit`'s "needs an existing room first" guard and `/admin/approve`'s "slot must still exist" guard both extended to cover `music` alongside `game`/`object`; `/admin/approve` gained a `music` branch (same shape as the `game` branch — sets `slot.musicFileName`/`musicVersion`, persists, broadcasts `slotsUpdated`); `/admin/reject`'s notify-label map extended.
  - `src/engine/WorldScene.js` — `musicFileName`/`musicVersion` added to the `scene.launch('RoomScene', {...})` payload (the `door` object already carries them via `buildSlotList()`'s spread into `doorZones`, so no other WorldScene change was needed).
  - `src/engine/RoomScene.js` — new `_loadMusicModule()`/`_refreshMusicModule()` (mirror `_loadGameModule()`/`_refreshGameModule()` exactly, including the same `?v=` cache-busting import pattern); `music.play(scene)` called once on room entry, `music.stop(scene)` called in **both** copies of `exitRoom()` (the pre-load-failure default and the post-load upgraded version — a real bug class avoided by remembering both exist, per the M3 session's own hard-won lesson about this file). A new `[M] Submit Music` hint (ambient, owner-only, no anchor — stacked above the existing `[O] Add Object` hint) opens a submission overlay copied near-verbatim from the game-submission overlay.
  - **Real bug caught and fixed during this pass (before it ever ran):** the `[H]` Help-overlay toggle was initially wired only in the same place `[O]`/`[G]`/`[M]` are (after the movement-freeze block's early `return`) — which meant `[H]` could open the overlay but could never close it again, since once `_helpOverlayOpen` was true, `update()` would return before ever reaching the `[H]` check again. Fixed by moving the `[H]` toggle check to *before* the freeze-block's `return`, so it can act on itself while frozen; `[O]`/`[G]`/`[M]` stay after the freeze check since they only ever need to *open* their overlay, never close via the same key.
  - **Verified this session via `curl` against a live server boot:** missing-`stop` correctly rejected (`"Missing: music.stop"`); a valid submission accepted, approved, and written to `src/rooms/music-<slotKey>.js`; `buildSlotList()` correctly returns the new `musicFileName`/`musicVersion`; submitting to a slot with no approved room correctly 400s; reject leaves no file and no `objects`-style residue. **A mistake was made and caught during testing:** the first approval test used `slot01`, which turned out to be a real, live student room ("Aleshaaa") rather than a throwaway test slot — caught immediately after approval, and fully reverted (test music file deleted, `musicFileName`/`musicVersion` manually stripped back out of `server/data/slots.json`, server restarted to confirm `slot01` reads back exactly as it did before, `Aleshaaa`'s room itself untouched throughout). Follow-up tests used unclaimed/no-owner slots instead. `npx vite build` and `node --check` clean throughout.
  - **Live verification (2026-07-20), two real bugs found and fixed:**
    1. **Music didn't stop on room exit.** `RoomScene.js` has two separate `exitRoom()` definitions (a pre-load-failure default and a post-successful-load upgrade) — a quirk already known from the M3 session. The fix that added `music.stop()` to both used a `replace_all` edit assuming identical surrounding whitespace, but the two copies are indented differently (the upgraded one is nested one level deeper inside `if (this._loaded) {...}`), so `replace_all` silently patched only one of the two matches. The copy that actually runs for every normally-loading room kept the bug: `this._musicModule?.stop?.(this)` instead of `this._musicModule?.music?.stop?.(this)` (music.js exports `{musicName, play, stop}` nested under `music`, like `game.js`'s `{game}` nesting — not flat like `room.js`/`object.js`). Fixed; both copies now match and were re-verified.
    2. **A real submitted music track (synth chords, generated via the Help window's Export prompt) played nothing at all, with no error.** Diagnosed by ruling out everything checkable server-side (file on disk matched exactly what was submitted, `node --check` clean, slot record correctly updated with a new `musicVersion`) — the remaining explanation was a suspended `AudioContext`: browsers can start a freshly-created context in `'suspended'` state under autoplay policy, and oscillators scheduled on a suspended context don't throw, they just produce silence. This is a particularly easy trap for this exact contract, since `play()` runs after an `await import(...)` — a promise-chain delay from the original triggering keypress, which can be enough for some browsers to no longer treat it as directly gesture-linked. Fixed going forward by adding a **required** `audioCtx.resume()` step to `_music_template.js`'s DO list and Web Audio globals section, and to the `[H]` Help window's Room Music Export prompt template.
    - Also verified: admin `/admin/pending?kind=music` filtering works (the owner's initial "filter doesn't show Music" report turned out to be a stale browser cache of `admin.html`, which is served via `res.sendFile` and never hot-reloads — resolved by a hard refresh, not a code change); the `[H]` Help overlay's page navigation, all 7 pages, and every Copy Prompt button; a full submit → approve → play → stop → resubmit-while-standing-inside → old-stops-new-starts cycle, twice (once with the simple test tone, once with the real synth-chord track after the `.resume()` fix).
  - **Also fixed during this pass, not a Phase 11 scope item but surfaced by it:** the Help window originally shipped with one prompt per kind (page titled just "Prompt — X"), which worked for a single-shot ask but broke down once the owner iterated with Gemini across a conversation — Gemini would sometimes hand back an HTML/canvas preview instead of the raw JSON/code, which then failed to parse client-side (`Invalid JSON: Unexpected token '<', "<!DOCTYPE "...`) when pasted into the Decorative object overlay. Restructured from 4 pages to 7: each kind (decorative object, interactive object, room music) now gets a **Design** prompt (page 1, explicitly invites iteration/previews) followed by an **Export** prompt (page 2 — "convert whatever we've been iterating on into this exact schema, no HTML/canvas/code-fences/commentary"), mirroring the room-creation signpost's existing Prompt-1/Prompt-2 pattern rather than inventing a new convention.
- **In-room Help window (2026-07-20): ✅ built alongside M4, not yet browser-verified.** A new `[H]` overlay in `RoomScene.js`, visible to anyone in any room (owner or visitor, no ownership gate — pure reference content, no server writes) — explicitly requested to live *only* inside a player's own room, never the town-square signpost, since it's about what you can add to a room you're already in. 4 pages, paged HTML-overlay UI (same DOM-div convention as the game/object/music overlays, not WorldScene's separate Phaser-native signpost technique): (1) plain-language orientation covering all 4 things a room owner can add (game/decorative object/interactive object/music) and their keys; (2)–(4) ready-to-copy Gemini prompts for decorative objects, interactive objects, and room music respectively, each ending with an explicit rules list. The decorative-object prompt's numeric limits (`MAX_SHAPES`, `COORD_LIMIT`, `SIZE_LIMIT`, `RADIUS_LIMIT`, `MAX_POLY_POINTS`, scale range) are pulled live from `ObjectRenderer.js`'s exported `OBJECT_LIMITS` rather than hand-copied, so the prompt can never drift out of sync with what the real validator accepts. Uses `navigator.clipboard.writeText`, same technique as the town-square signpost's existing "Copy Prompt" button.

- **Nested creations (external links):** an object in a room can carry a `linkedArtifacts` entry (label + URL). Interacting with it opens the URL in a new tab — no iframing/embedding, since the linked site isn't vetted code.
- **Room music:** vibe-coded (Gemini-generated Web Audio API / synth code, not an uploaded file — keeps it inside the existing code-validation pipeline rather than needing file storage). Registered as kind `music` in the Phase 9 registry, with its own contract (e.g. a `play(scene)` hook) and validator, reusing the generic approval queue.

**Objects (new, decided 2026-07-14):** two distinct sub-types, both registered under the `object` kind in the Phase 9 registry, both submitted and tracked as individual units — never bundled into or requiring resubmission of the room's main code:

1. **Decorative objects — data, not code, auto-approved.** Described as a shape list (rectangles, triangles, polygons, circles), with optional gradients, a glow preset, and a small set of animation presets (`pulse`, `rotate`, `drift`, `colorCycle`) — matching the visual techniques already used by the hand-built town-square decor (portals, paper airplane, sign post), all of which turn out to be expressible as pure data. A static object is one shape list; a simple animation (e.g. a blink or wave) is two shape lists ("frames") swapped on a timer. Because there's no executable logic, a submission can be fully validated automatically — valid shape types, in-bounds coordinates, valid colors — and approved or rejected instantly with no human review and no wait.
2. **Interactive objects — real code, reviewed like a room, but submitted in isolation.** Anything needing actual logic (reacts to the player beyond simple proximity, has physics, generates itself with randomness) is genuine code, so it goes through human review the same way room and game code does today. Critically, it is submitted and reviewed as its own small, standalone unit — a player adding one interactive object never resubmits or regenerates their whole world; the admin reviews just that object's code, the same way game submissions already review separately from the room they attach to.

**Movable objects:** any placed object (decorative or interactive) can be flagged `movable`. Moving one is a `{id, x, y}` position patch against an object that's already approved — never needs admin review, since it can't introduce new code, visuals, or behavior, only relocate something already vetted. Removing an object is likewise never reviewed — deletion can't introduce risk. Persistence: local-only (resets each visit) until Phase 9 auth exists, then server-saved and gated by "does this `uid` match the room's creator" — there's no secure way to check real ownership before that.

**Admin panel implication:** the pending queue only ever shows interactive-object submissions, as small isolated items — decorative objects never appear there, since they're resolved automatically the instant they're submitted.

**Deferred follow-ups (owner decision, 2026-07-20): intentionally NOT picked up now.** Three small gaps remain from M3/M4, none of them broken — just narrower than they could be:
- Editing/resubmitting an interactive object's code (currently create-only; would need a re-review flow)
- Drag-move for interactive objects (needs a new `onMove(scene, ctx, x, y)`-style contract hook, since — unlike decorative objects — there's no single engine-owned `Container` to grab and reposition generically)
- `linkedArtifacts` support on interactive objects (decorative-only today)

The owner's explicit call: finish a full baseline draft first — the rest of the planned phases (12–17) — before circling back to polish items like these. Pick these up only after Phase 16/17 wrap, not before, unless something changes.

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
