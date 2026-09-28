// roomAPI.js — the ONLY surface a generated 3D room ever touches.
//
// Mirrors src/room-loader's pattern for 2D rooms: room code never imports
// `three` directly (so it can never construct loaders, raw geometries, or
// materials outside this whitelist), it only receives this bound `scene3d`
// helper object as a function argument. No TextureLoader/GLTFLoader is
// exposed anywhere below, so room code cannot fetch external assets.

import * as THREE from 'three';

const MAX_MESHES_PER_ROOM = 60;
const WORLD_HALF_EXTENT = 55; // keep generated geometry inside the fogged play area

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createRoomAPI(scene, player) {
  let meshCount = 0;

  function track(mesh) {
    meshCount++;
    if (meshCount > MAX_MESHES_PER_ROOM) {
      throw new Error(`Room exceeded the ${MAX_MESHES_PER_ROOM}-mesh limit`);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.x = clamp(mesh.position.x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);
    mesh.position.z = clamp(mesh.position.z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT);
    scene.add(mesh);
    return mesh;
  }

  return {
    addBox(x, y, z, w, h, d, color = 0xffffff) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.position.set(x, y, z);
      return track(mesh);
    },

    addSphere(x, y, z, radius, color = 0xffffff) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 12),
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.position.set(x, y, z);
      return track(mesh);
    },

    addCylinder(x, y, z, radiusTop, radiusBottom, height, color = 0xffffff) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16),
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.position.set(x, y, z);
      return track(mesh);
    },

    addCone(x, y, z, radius, height, color = 0xffffff) {
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(radius, height, 16),
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.position.set(x, y, z);
      return track(mesh);
    },

    addGround(color = 0x7ec850) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD_HALF_EXTENT * 2, WORLD_HALF_EXTENT * 2),
        new THREE.MeshStandardMaterial({ color })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    },

    // Player is repositioned, never rebuilt — same "scene.player already
    // exists" convention as the 2D room contract. No reference to the
    // player object itself is ever handed to room code.
    setPlayerPosition(x, y, z) {
      player.position.set(
        clamp(x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT),
        y,
        clamp(z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT)
      );
    },
  };
}
