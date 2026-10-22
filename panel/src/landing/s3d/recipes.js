// Recipes: ready-made subjects written in the same node format as any scene, so they are examples
// as much as shortcuts. Convention: centred on the origin, front facing +Z, a couple of units tall
// (to stand one on a floor at y = -1.45, raise it by half its height). Each takes vars (all optional) and returns a node. Use one with
// { "recipe": "tower", "vars": { "floors": 18 } }; add new ones here (any subject: a car, a lamp, a
// shoe, a drone…) by composing shapes, profiles and SVG.

const can = (v) => ({
  type: 'group',
  children: [
    { type: 'cylinder', name: 'body', radius: 0.5, height: 1.9, open: true, segments: 128,
      material: { preset: v.finish === 'matte' ? 'matte' : 'paint', label: { brand: v.brand || 'BRAND', flavor: v.flavor || '', color: v.color || '#e11d48', ink: v.ink, font: v.font } } },
    { type: 'lathe', material: 'metal', profile: [[0.5, 0.95], [0.5, 0.985], [0.488, 1.04], [0.46, 1.095], [0.442, 1.135], [0.447, 1.162], [0.442, 1.18], [0.428, 1.178], [0.422, 1.152], [0.405, 1.128], [0, 1.128]] },
    { type: 'lathe', material: 'metal', profile: [[0, -1.1], [0.3, -1.105], [0.37, -1.13], [0.41, -1.152], [0.44, -1.14], [0.474, -1.085], [0.495, -1.0], [0.5, -0.95]] },
    { type: 'extrude', material: 'metal', path: 'M -11 7 A 11 11 0 0 1 11 7 L 11 -12 A 11 11 0 0 1 -11 -12 Z M 0 -15.5 A 5.5 5.5 0 1 0 0.01 -15.5 Z', size: 0.34, depth: 0.012, bevel: 0, pos: [0, 1.14, 0.1], rot: [-90, 0, 0] },
  ],
});

const bottle = (v) => ({
  type: 'group',
  children: [
    { type: 'lathe', material: { preset: 'paint', color: v.color || '#16a34a', transmission: 0.55, thickness: 0.8, roughness: 0.15, metalness: 0 }, profile: [[0, -1.2], [0.47, -1.2], [0.49, -1.1], [0.49, 0.2], [0.47, 0.42], [0.4, 0.6], [0, 0.6]] },
    { type: 'lathe', material: 'glass', profile: [[0, -1.25], [0.42, -1.25], [0.5, -1.2], [0.52, -1.1], [0.52, 0.25], [0.5, 0.45], [0.42, 0.66], [0.28, 0.86], [0.2, 0.98], [0.19, 1.2], [0.21, 1.22], [0.21, 1.27], [0, 1.27]] },
    { type: 'cylinder', radius: 0.525, height: 0.95, open: true, pos: [0, -0.45, 0], material: { preset: 'matte', label: { brand: v.brand || 'BRAND', flavor: v.flavor || '', color: v.labelColor || '#f4efe6', ink: v.ink || '#1d1a16', font: v.font } } },
    { type: 'cylinder', radius: 0.225, height: 0.2, pos: [0, 1.33, 0], material: { preset: 'metal', color: v.color || '#16a34a' } },
  ],
});

// architecture: floor slabs with glass between them; "floors" and "twist" (degrees per floor) shape it
const tower = (v) => {
  const floors = v.floors ?? 16, h = v.floorHeight ?? 0.16, w = v.width ?? 0.9, twist = v.twist ?? 0;
  return {
    type: 'group',
    children: Array.from({ length: floors }, (_, i) => ({
      type: 'group', name: `floor-${i}`, pos: [0, i * h - (floors * h) / 2, 0], rot: [0, i * twist, 0],
      children: [
        { type: 'box', size: [w + 0.12, 0.03, w + 0.12], radius: 0.01, material: { preset: 'concrete', color: v.slab || '#efe9df' } },
        { type: 'box', size: [w, h - 0.03, w], pos: [0, h / 2, 0], material: { preset: 'tinted', color: v.glass || '#8fa9bb' } },
      ],
    })),
  };
};

const house = (v) => ({
  type: 'group',
  children: [{ type: 'group', pos: [0, -0.74, 0], children: [
    { type: 'box', name: 'walls', size: [1.6, 0.9, 1.1], pos: [0, 0.45, 0], radius: 0.02, material: { preset: 'stone', color: v.walls || '#efe8dc' } },
    { type: 'extrude', name: 'roof', path: 'M -10 0 L 0 -6 L 10 0 Z', size: 1.9, depth: 1.25, bevel: 0.01, pos: [0, 1.18, 0], material: { preset: 'matte', color: v.roof || '#3b3a38' } },
    { type: 'box', size: [0.34, 0.56, 0.02], pos: [0, 0.28, 0.56], material: { preset: 'wood', color: v.door || '#7a5333' } },
    { type: 'box', size: [0.36, 0.3, 0.02], pos: [-0.5, 0.52, 0.56], material: 'tinted' },
    { type: 'box', size: [0.36, 0.3, 0.02], pos: [0.5, 0.52, 0.56], material: 'tinted' },
  ] }],
});

// security: a shield with a keyhole, from SVG paths
const shield = (v) => ({
  type: 'group',
  children: [
    { type: 'extrude', name: 'shield', path: 'M 0 -12 L 10 -8 L 10 0 C 10 7 5 11 0 13 C -5 11 -10 7 -10 0 L -10 -8 Z', size: 2.2, depth: 0.28, bevel: 0.06, material: { preset: v.finish || 'metal', color: v.color || '#cfd6e0' } },
    { type: 'extrude', name: 'lock', path: 'M -2 -2 A 2 2 0 1 1 2 -2 A 2 2 0 0 1 1 -0.3 L 1.6 4 L -1.6 4 L -1 -0.3 A 2 2 0 0 1 -2 -2 Z', size: 0.6, depth: 0.12, bevel: 0.02, pos: [0, -0.05, 0.2], material: { preset: 'emissive', color: v.accent || '#4d8dff' } },
  ],
});

// tech: a server rack with blinking-looking LEDs (emissive) and drive bays
const server = (v) => {
  const units = v.units ?? 8;
  return {
    type: 'group',
    children: [
      { type: 'box', size: [1.3, units * 0.2 + 0.2, 0.9], radius: 0.03, material: { preset: 'metal', color: '#2a2d33', roughness: 0.45 } },
      ...Array.from({ length: units }, (_, i) => ({
        type: 'group', name: `unit-${i}`, pos: [0, (i - (units - 1) / 2) * 0.2, 0.46],
        children: [
          { type: 'box', size: [1.16, 0.16, 0.04], radius: 0.01, material: { preset: 'metal', color: '#3a3e46', roughness: 0.35 } },
          { type: 'box', size: [0.05, 0.03, 0.02], pos: [0.48, 0, 0.03], material: { preset: 'emissive', color: i % 3 ? (v.led || '#3ddc97') : (v.accent || '#4d8dff') } },
          { type: 'box', size: [0.5, 0.08, 0.02], pos: [-0.22, 0, 0.03], material: { preset: 'matte', color: '#14161a' } },
        ],
      })),
    ],
  };
};

// apps: a phone with a screen (an image of the app, or a colour)
const phone = (v) => ({
  type: 'group',
  children: [
    { type: 'box', size: [1.1, 2.25, 0.11], radius: 0.05, material: { preset: 'metal', color: v.frame || '#1c1d21', roughness: 0.3 } },
    { type: 'plane', name: 'screen', size: [1.0, 2.15], pos: [0, 0, 0.057], material: v.screen ? { preset: 'screen', map: v.screen } : { preset: 'emissive', color: v.color || '#4d8dff', emissiveIntensity: 0.6 } },
  ],
});

// nature: a stylised tree
const tree = (v) => ({
  type: 'group',
  children: [{ type: 'group', pos: [0, -0.72, 0], children: [
    { type: 'cylinder', radiusTop: 0.06, radiusBottom: 0.09, height: 0.7, pos: [0, 0.35, 0], material: 'wood' },
    { type: 'sphere', radius: 0.42, pos: [0, 0.95, 0], segments: 24, material: { preset: 'matte', color: v.color || '#5f8f4e' } },
    { type: 'sphere', radius: 0.3, pos: [0.22, 1.2, 0.08], segments: 24, material: { preset: 'matte', color: v.color || '#6f9f5c' } },
  ] }],
});

export const RECIPES = { can, bottle, tower, house, shield, server, phone, tree };
