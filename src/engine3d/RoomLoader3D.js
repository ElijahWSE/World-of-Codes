// RoomLoader3D.js — validates and mounts a generated 3D room module.
// Mirrors src/room-loader/RoomLoader.js's contract-check + try/catch pattern.

const REQUIRED_HOOKS = ['onCreate', 'onUpdate'];

export function validateRoom3D(roomModule) {
  const errors = [];
  if (typeof roomModule.name !== 'string' || !roomModule.name.trim()) {
    errors.push('name must be a non-empty string');
  }
  for (const hook of REQUIRED_HOOKS) {
    if (typeof roomModule[hook] !== 'function') {
      errors.push(`${hook} must be a function`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function loadRoom3D(roomModule, scene3d) {
  const { valid, errors } = validateRoom3D(roomModule);
  if (!valid) {
    console.error('[RoomLoader3D] Validation failed:', errors);
    return { ok: false, errors };
  }
  try {
    roomModule.onCreate(scene3d);
  } catch (err) {
    console.error('[RoomLoader3D] onCreate threw:', err);
    return { ok: false, errors: [err.message] };
  }
  return {
    ok: true,
    update(dt) {
      try {
        roomModule.onUpdate(scene3d, dt);
      } catch (err) {
        console.error('[RoomLoader3D] onUpdate threw:', err);
      }
    },
  };
}
