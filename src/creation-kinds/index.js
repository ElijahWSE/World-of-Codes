// src/creation-kinds/index.js — creation-kind registry.
// Adding a new kind (e.g. music, object — Phase 11) means adding one file
// here and one line below, not touching the submission pipeline itself.
import * as room from './room.js';
import * as game from './game.js';
import * as object from './object.js';
import * as music from './music.js';

const REGISTRY = { room, game, object, music };

export function getKind(name) {
  const found = REGISTRY[name];
  if (!found) throw new Error(`Unknown creation kind: "${name}"`);
  return found;
}

export function listKinds() {
  return Object.keys(REGISTRY);
}
