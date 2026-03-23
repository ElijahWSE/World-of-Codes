# World of Codes — Project Brief

This file is the single source of truth for the project. Read this at the start of every new session.

---

## What This Project Is

A 2D top-down multiplayer game world (Zelda/Pokemon perspective) that runs in the browser with no install required for players.

There is a **shared town square** where all players can walk around and see each other in real time. Around the town square are **doors** that lead to individual **player rooms**. These rooms are built by other players using Gemini AI — players submit their generated code, I manually review and add it to the project.

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

2. Colyseus multiplayer:
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

### PHASE 3 — ROOM TEMPLATE & PLAYER GUIDE ⏳ TODO

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

### PHASE 4 — ROOM LOADER ⏳ TODO

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

## General Rules (apply to all phases)

- Never block on missing art — use colored rectangles and text for everything visual
- Each file does one job — no mixing concerns
- Short comment at top of every file explaining what it does
- Adding a player room = 2 file changes only: drop file in `src/rooms/`, add one line to `WorldScene.js`
- Room files must be fully self-contained — interact with engine only through the `scene` object
- Hooks (name, onLoad, onCreate, onUpdate, onExit) are THE CONTRACT — never rename or remove them
- Rooms must fail safely — try/catch all hook calls, show friendly error, return to WorldScene
- Asset keys must be namespaced by room name (e.g. `myroom_floor` not `floor`) to avoid cache conflicts
