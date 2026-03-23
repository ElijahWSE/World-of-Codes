// src/shared/schema.js — Colyseus state schema (shared by server and browser client)
//
// WHY SHARED: In @colyseus/schema v4, the client must be given the schema class
// when joining a room. Without it, Colyseus uses "reflection mode" which doesn't
// initialize collection properties (MapSchema etc.) when they're empty — leaving
// them as undefined instead of empty collections. Sharing the class avoids this.
//
// IMPORTANT: Any field added here must be added on BOTH PlayerState and WorldState.
// The server and client must always use the exact same schema definition.

import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

export class PlayerState extends Schema {
  constructor() {
    super();
    this.x    = 0;
    this.y    = 0;
    this.name = '';
  }
}
defineTypes(PlayerState, {
  x:    'number',
  y:    'number',
  name: 'string',
});

export class WorldState extends Schema {
  constructor() {
    super();
    // Must be explicitly initialized — defineTypes registers the type but
    // does NOT create the collection instance in schema v4.
    this.players = new MapSchema();
  }
}
defineTypes(WorldState, {
  players: { map: PlayerState },
});
