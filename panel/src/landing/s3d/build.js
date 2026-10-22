// Builds three.js objects from a plain description (JSON), so a scene of any subject is written as
// data: shapes, turned profiles, extruded SVG, text, pictures, models, groups and repeats.
//
// Every node: { type, name, pos: [x,y,z], rot: [deg,deg,deg], scale: n | [x,y,z], material, keys,
// spin, float, explode, castShadow }. See SKILL.md for each type's fields.

import {
  Group, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, TorusGeometry, CapsuleGeometry,
  PlaneGeometry, LatheGeometry, ExtrudeGeometry, Vector2, Vector3, Box3, CanvasTexture, SRGBColorSpace,
  MeshBasicMaterial, TextureLoader, MathUtils,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeMaterial } from './materials.js';
import { RECIPES } from './recipes.js';

const gltf = new GLTFLoader();
const textures = new TextureLoader();
const v3 = (a, d = 0) => (Array.isArray(a) ? new Vector3(a[0] ?? d, a[1] ?? d, a[2] ?? d) : new Vector3(a ?? d, a ?? d, a ?? d));

// "{{color}}" in any string of a node is replaced by vars.color (recipes and carousel items use it)
export function fill(node, vars) {
  if (!vars || !Object.keys(vars).length) return node;
  return JSON.parse(JSON.stringify(node), (k, v) =>
    typeof v === 'string' ? v.replace(/\{\{(\w+)\}\}/g, (_, n) => (vars[n] ?? '')) : v);
}

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function svgShapes(n) {
  let text = n.svg;
  if (n.path) text = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${n.path}"/></svg>`;
  else if (n.svg && !n.svg.trim().startsWith('<')) text = await (await fetch(n.svg)).text();
  const data = new SVGLoader().parse(text);
  return data.paths.flatMap((p) => p.toShapes(true));
}

function textPlane(n) {
  const size = 256;
  const font = n.font || 'Inter Tight, system-ui, sans-serif';
  const weight = n.weight || 600;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${weight} ${size}px ${font}`;
  const lines = String(n.text).split('\n');
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + size * 0.2;
  c.width = Math.ceil(w); c.height = Math.ceil(size * 1.25 * lines.length);
  g.font = `${weight} ${size}px ${font}`;
  g.fillStyle = n.color || '#ffffff';
  g.textBaseline = 'middle';
  g.textAlign = n.align === 'left' ? 'left' : 'center';
  lines.forEach((l, i) => g.fillText(l, n.align === 'left' ? size * 0.1 : c.width / 2, size * 0.625 + i * size * 1.25));
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const h = n.size ?? 0.5;
  const mesh = new Mesh(new PlaneGeometry(h * c.width / c.height * lines.length, h * lines.length),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.material.userData.baseOpacity = 1;
  mesh.userData.billboard = !!n.billboard;
  mesh.castShadow = false;
  return mesh;
}

async function geometryFor(n) {
  switch (n.type) {
    case 'box': {
      const s = v3(n.size, 1);
      return n.radius ? new RoundedBoxGeometry(s.x, s.y, s.z, 4, n.radius) : new BoxGeometry(s.x, s.y, s.z);
    }
    case 'sphere': return new SphereGeometry(n.radius ?? 0.5, n.segments ?? 64, Math.round((n.segments ?? 64) / 2));
    case 'cylinder': return new CylinderGeometry(n.radiusTop ?? n.radius ?? 0.5, n.radiusBottom ?? n.radius ?? 0.5, n.height ?? 1, n.segments ?? 96, 1, !!n.open);
    case 'cone': return new ConeGeometry(n.radius ?? 0.5, n.height ?? 1, n.segments ?? 64);
    case 'torus': return new TorusGeometry(n.radius ?? 0.5, n.tube ?? 0.08, 24, n.segments ?? 96);
    case 'capsule': return new CapsuleGeometry(n.radius ?? 0.3, n.height ?? 1, 8, 24);
    case 'plane': { const s = v3(n.size, 1); return new PlaneGeometry(s.x, s.y); }
    case 'lathe': return new LatheGeometry((n.profile || [[0, 0], [0.5, 0], [0.5, 1], [0, 1]]).map(([x, y]) => new Vector2(x, y)), n.segments ?? 96);
    case 'extrude': {
      const shapes = await svgShapes(n);
      const geo = new ExtrudeGeometry(shapes, {
        depth: n.depth ?? 0.2, curveSegments: n.curveSegments ?? 24,
        bevelEnabled: (n.bevel ?? 0.02) > 0, bevelThickness: n.bevel ?? 0.02, bevelSize: n.bevel ?? 0.02, bevelSegments: 4,
      });
      // SVG y points down: flip, centre, and scale the larger side to `size`
      geo.scale(1, -1, 1);
      geo.computeBoundingBox();
      const b = geo.boundingBox, c = b.getCenter(new Vector3()), d = b.getSize(new Vector3());
      geo.translate(-c.x, -c.y, -c.z);
      const k = (n.size ?? 2) / Math.max(d.x, d.y);
      geo.scale(k, k, 1);
      geo.computeVertexNormals();
      return geo;
    }
    default: return null;
  }
}

export async function buildNode(n, ctx, path = '') {
  if (!n) return null;
  let node = n;
  if (n.recipe) {
    const r = RECIPES[n.recipe];
    if (!r) throw new Error(`unknown recipe "${n.recipe}"`);
    const { recipe, vars, ...rest } = n;
    node = { ...r(vars || {}), ...rest };
  }
  let obj;
  if (node.type === 'group' || node.children) {
    obj = new Group();
    const kids = await Promise.all((node.children || []).map((c, i) => buildNode(c, ctx, `${path}${i}.`)));
    kids.filter(Boolean).forEach((k) => obj.add(k));
  } else if (node.type === 'repeat') {
    obj = new Group();
    const r = node.repeat || {};
    const count = r.count ?? 6, rand = rng(r.seed ?? 1), gap = v3(r.gap ?? 1.2);
    const colors = r.colors || [];
    const items = await Promise.all(Array.from({ length: count }, (_, i) => {
      let item = r.item || { type: 'box' };
      if (colors.length) item = { ...item, material: { ...(typeof item.material === 'string' ? { preset: item.material } : item.material || {}), color: colors[i % colors.length] } };
      return buildNode({ ...item, name: `${node.name || 'item'}-${i}` }, ctx, `${path}${i}.`);
    }));
    const cols = r.cols ?? Math.ceil(Math.sqrt(count));
    items.forEach((it, i) => {
      let p;
      if (r.layout === 'ring') { const a = (i / count) * Math.PI * 2; p = new Vector3(Math.sin(a) * (r.radius ?? 3), 0, Math.cos(a) * (r.radius ?? 3)); it.rotation.y = a; }
      else if (r.layout === 'line') p = new Vector3((i - (count - 1) / 2) * gap.x, 0, 0);
      else if (r.layout === 'stack') p = new Vector3(0, i * gap.y, 0);
      else if (r.layout === 'scatter') p = new Vector3((rand() - 0.5) * (r.area?.[0] ?? 6), 0, (rand() - 0.5) * (r.area?.[1] ?? 6));
      else p = new Vector3((i % cols - (cols - 1) / 2) * gap.x, 0, (Math.floor(i / cols) - (Math.ceil(count / cols) - 1) / 2) * gap.z);
      const j = r.jitter ?? 0;
      p.x += (rand() - 0.5) * j; p.z += (rand() - 0.5) * j;
      it.position.add(p);
      if (r.scaleY) it.scale.y *= MathUtils.lerp(r.scaleY[0], r.scaleY[1], rand());
      if (r.scale) it.scale.multiplyScalar(MathUtils.lerp(r.scale[0], r.scale[1], rand()));
      if (r.rotY) it.rotation.y += MathUtils.degToRad((rand() - 0.5) * r.rotY);
      // a repeated item grows from the ground: keep its base on y = 0
      if (r.scaleY) it.position.y += (it.scale.y - 1) * (it.userData.height ?? 0) / 2;
      obj.add(it);
    });
    // their resting place is where the layout put them (keys, float and explode start from here)
    items.forEach((it) => { it.userData.base = { pos: it.position.clone(), rot: it.rotation.clone(), scale: it.scale.clone() }; });
  } else if (node.type === 'text') {
    obj = textPlane(node);
  } else if (node.type === 'image') {
    const tex = await textures.loadAsync(node.src);
    tex.colorSpace = SRGBColorSpace;
    const h = node.size ?? 1.5;
    const w = h * tex.image.width / tex.image.height;
    const mat = await makeMaterial({ preset: 'matte', ...(typeof node.material === 'object' ? node.material : {}), color: '#ffffff' }, ctx.vars, ctx.renderer);
    mat.map = tex; mat.side = 2;
    obj = new Mesh(new PlaneGeometry(w, h), mat);
  } else if (node.type === 'glb') {
    const { scene } = await gltf.loadAsync(node.src);
    const box = new Box3().setFromObject(scene), size = box.getSize(new Vector3());
    scene.position.sub(box.getCenter(new Vector3()));
    obj = new Group();
    obj.add(scene);
    if (node.size !== false) obj.scale.setScalar((node.size ?? 2.4) / Math.max(size.x, size.y, size.z));
    scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.userData.baseOpacity = o.material.opacity; } });
  } else if (node.type === 'particles') {
    obj = new Group();             // filled by particles.js once the rest of the scene exists
    obj.userData.particles = node;
  } else {
    const geo = await geometryFor(node);
    if (!geo) throw new Error(`unknown node type "${node.type}"`);
    obj = new Mesh(geo, await makeMaterial(node.material ?? 'plastic', ctx.vars, ctx.renderer));
    obj.castShadow = node.castShadow ?? true;
    obj.receiveShadow = node.receiveShadow ?? false;
    if (node.type === 'box') obj.userData.height = v3(node.size, 1).y;
    if (node.type === 'cylinder' || node.type === 'cone') obj.userData.height = node.height ?? 1;
  }

  if (node.pos) obj.position.add(v3(node.pos));
  if (node.rot) obj.rotation.set(...v3(node.rot).toArray().map(MathUtils.degToRad));
  if (node.scale !== undefined) obj.scale.multiply(v3(node.scale, 1));
  obj.name = node.name || '';
  Object.assign(obj.userData, {
    keys: node.keys, spin: node.spin, float: node.float, explode: node.explode, billboard: obj.userData.billboard,
    base: { pos: obj.position.clone(), rot: obj.rotation.clone(), scale: obj.scale.clone() },
  });
  if (obj.name) ctx.named.set(obj.name, obj);
  return obj;
}
