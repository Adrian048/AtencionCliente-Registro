// Material presets: one word gets a believable surface under the studio reflections. Any field can
// be overridden: { preset: "glass", color: "#9fd", roughness: 0.2 }.

import { MeshPhysicalMaterial, Color, CanvasTexture, SRGBColorSpace, RepeatWrapping, TextureLoader, DoubleSide } from 'three';
import { paintLabel, toHex } from './label.js';

const PRESETS = {
  paint: { metalness: 0.5, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.18 },
  metal: { metalness: 1, roughness: 0.26, color: '#d9dbe0' },
  chrome: { metalness: 1, roughness: 0.05, color: '#f2f3f5' },
  gold: { metalness: 1, roughness: 0.22, color: '#d6a84f' },
  copper: { metalness: 1, roughness: 0.3, color: '#c27a4a' },
  plastic: { metalness: 0, roughness: 0.35, clearcoat: 0.3 },
  matte: { metalness: 0, roughness: 0.85 },
  clay: { metalness: 0, roughness: 1, color: '#e8e2d8' },
  concrete: { metalness: 0, roughness: 0.92, color: '#bdb8ae' },
  stone: { metalness: 0, roughness: 0.7, color: '#d9d0c1' },
  wood: { metalness: 0, roughness: 0.6, color: '#9a6b44' },
  fabric: { metalness: 0, roughness: 1, sheen: 1, sheenRoughness: 0.6 },
  glass: { metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.4, ior: 1.5, color: '#eef4f2' },
  frosted: { metalness: 0, roughness: 0.45, transmission: 1, thickness: 0.6, ior: 1.45, color: '#f2f5f7' },
  tinted: { metalness: 0.2, roughness: 0.08, transmission: 0.6, thickness: 0.3, ior: 1.5, color: '#7f9fb5' },
  emissive: { metalness: 0, roughness: 0.5, emissiveIntensity: 2.2, toneMapped: false },
  screen: { metalness: 0, roughness: 0.25, clearcoat: 1, emissiveIntensity: 1, toneMapped: false },
};
export const MATERIAL_NAMES = Object.keys(PRESETS);

const loader = new TextureLoader();

export async function makeMaterial(spec = 'plastic', vars = {}, renderer) {
  const s = typeof spec === 'string' ? { preset: spec } : { ...spec };
  const base = PRESETS[s.preset] || PRESETS.plastic;
  const p = { ...base, ...s };
  const m = new MeshPhysicalMaterial({
    metalness: p.metalness ?? 0, roughness: p.roughness ?? 0.5,
    clearcoat: p.clearcoat ?? 0, clearcoatRoughness: p.clearcoatRoughness ?? 0.2,
    transmission: p.transmission ?? 0, thickness: p.thickness ?? 0, ior: p.ior ?? 1.5,
    sheen: p.sheen ?? 0, sheenRoughness: p.sheenRoughness ?? 0.5,
    transparent: !!p.transmission || p.opacity !== undefined, opacity: p.opacity ?? 1,
  });
  if (p.side === 'double') m.side = DoubleSide;
  m.color = new Color(toHex(p.color, '#d8d8d8'));
  if (s.preset === 'emissive' || s.preset === 'screen' || p.emissive) {
    m.emissive = new Color(toHex(p.emissive || p.color, '#ffffff'));
    m.emissiveIntensity = p.emissiveIntensity ?? 1;
    m.toneMapped = p.toneMapped ?? true;
  }
  // a label painted on a canvas (wraps round a cylinder or lathe once; the middle faces +Z)
  if (p.label) {
    const tex = new CanvasTexture(await paintLabel({ ...p.label, color: toHex(p.label.color || p.color, '#e11d48') }));
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = RepeatWrapping;
    tex.offset.x = 0.5;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    m.map = tex;
    m.color = new Color('#ffffff');
  }
  // a picture: a photo, a screen capture, a printed label
  if (p.map) {
    const tex = await loader.loadAsync(p.map);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (p.wrap) { tex.wrapS = RepeatWrapping; tex.offset.x = 0.5; }
    m.map = tex;
    if (s.preset === 'screen') { m.emissiveMap = tex; m.emissive = new Color('#ffffff'); }
    m.color = new Color(p.tint ? toHex(p.tint) : '#ffffff');
  }
  m.userData.baseOpacity = m.opacity;
  return m;
}
