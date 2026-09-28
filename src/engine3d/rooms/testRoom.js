export const name = 'Retro Specialty Coffee Cafe';

export function onCreate(scene3d) {
    scene3d.addGround(0xd7c49e); // Warm vintage floor tile / wood tone

    // Back wall
    scene3d.addBox(0, 10, -50, 100, 20, 4, 0x8b5a2b); // Deep mahogany wood paneling
    // Left wall
    scene3d.addBox(-50, 10, 0, 4, 20, 100, 0xa0522d); // Sienna brown accent wall
    // Right wall
    scene3d.addBox(50, 10, 0, 4, 20, 100, 0xa0522d);

    scene3d.addBox(0, 3, -15, 45, 6, 12, 0x5c4033); // Dark espresso wood counter
    scene3d.addBox(0, 6.2, -15, 47, 0.4, 13, 0xfdf5e6); // Cream marble slab
    scene3d.addBox(-10, 8, -17, 8, 3, 6, 0xc0c0c0); // Chrome body
    scene3d.addCylinder(-12, 9.5, -14, 0.8, 0.8, 2, 0xffd700); // Brass valve 1
    scene3d.addCylinder(-8, 9.5, -14, 0.8, 0.8, 2, 0xffd700); // Brass valve 2
    scene3d.addCylinder(5, 8.5, -17, 1.5, 1.2, 3, 0x222222); // Matte black hopper
    scene3d.addCone(5, 10.5, -17, 1.8, 2, 0x8b4513); // Conical bean hopper

    scene3d.addCylinder(-25, 2.5, -5, 4, 4, 0.5, 0x331a00); // Table top
    scene3d.addCylinder(-25, 1.2, -5, 0.6, 0.8, 2.5, 0xd4af37); // Brass pedestal leg
    scene3d.addCylinder(-32, 1.5, -5, 1.5, 1.5, 3, 0x8b0000); // Velvet red stool 1
    scene3d.addCylinder(-18, 1.5, -5, 1.5, 1.5, 3, 0x8b0000); // Velvet red stool 2

    scene3d.addCylinder(25, 2.5, 5, 4, 4, 0.5, 0x331a00);
    scene3d.addCylinder(25, 1.2, 5, 0.6, 0.8, 2.5, 0xd4af37);
    scene3d.addCylinder(32, 1.5, 5, 1.5, 1.5, 3, 0x8b0000); // Stool 3
    scene3d.addCylinder(18, 1.5, 5, 1.5, 1.5, 3, 0x8b0000); // Stool 4

    scene3d.addCone(-10, 14, -15, 2.5, 2, 0x2f4f4f); // Dark slate green shade 1
    scene3d.addCone(10, 14, -15, 2.5, 2, 0x2f4f4f); // Dark slate green shade 2
    scene3d.addSphere(-10, 12.8, -15, 0.7, 0xfffaa0); // Warm light bulb 1
    scene3d.addSphere(10, 12.8, -15, 0.7, 0xfffaa0); // Warm light bulb 2

    scene3d.addBox(20, 11, -48, 16, 8, 0.5, 0x111111); // Chalkboard frame
    scene3d.addBox(20, 11, -47.7, 15, 7, 0.3, 0xffffff); // White chalk text placeholder area

    scene3d.addCylinder(-42, 2, -42, 2.5, 1.8, 3.5, 0xd2b48c); // Terracotta pot
    scene3d.addSphere(-42, 4.5, -42, 2.2, 0x2e8b57); // Sea green foliage cluster 1
    scene3d.addSphere(-40, 5.2, -40, 1.8, 0x228b22); // Foliage cluster 2

    scene3d.addCylinder(0, 1.5, 10, 2, 2, 3, 0x4a3b32); // Wooden display pedestal
    scene3d.addSphere(0, 4, 10, 1.8, 0x6f4e37); // Giant stylized coffee bean sculpture
}

export function onUpdate(scene3d, dt) {
    // Per-frame updates are handled by the core engine loop for scene objects.
}
