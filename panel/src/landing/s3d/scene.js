// A 3D scene of any subject: [data-s3d].
//
// Described in JSON (inline or in a file):
//   <div class="s3d" data-s3d data-spec="#torre"></div>
//   <script type="application/json" id="torre">{ "light": "sunset", "floor": "ground", "camera": {…},
//     "objects": [ { "recipe": "tower", "name": "torre", "explode": { … } } ], "timeline": [ … ] }</script>
// (a JSON data block is not a script: a strict CSP does not block it)
//
// Or, for one subject, with attributes only:
//   <div class="s3d" data-s3d data-recipe="can" data-brand="NÓMADA" data-color="#c8102e"
//        data-floor="pedestal" data-scroll="spin" data-turns="1" data-tilt="-20,10" data-zoom="1,1.25"></div>

import { Group } from 'three';
import { Stage } from './stage.js';
import { buildNode } from './build.js';
import { buildParticles } from './particles.js';
import { createChoreography } from './timeline.js';
import { varsFrom, readJSON, num2, scrollSource, dragRotate, pointerOver } from './shared.js';

// the attribute shortcut, written as a normal spec
function specFromAttributes(host) {
  const d = host.dataset;
  const [tilt0, tilt1] = num2(d.tilt, [-10, -10]);
  const [zoom0, zoom1] = num2(d.zoom, [1, 1]);
  const turns = parseFloat(d.turns ?? '1');
  const subject = {
    recipe: d.recipe, vars: varsFrom(host), name: 'subject',
    spin: parseFloat(d.spin ?? '0.35'), float: d.float !== 'false',
    pos: [parseFloat(d.offset) || 0, 0, 0], posPortrait: [0, 0.55, 0],
    keys: d.scroll === 'spin'
      ? [{ at: 0, rot: [0, 0, tilt0], scale: zoom0 }, { at: 1, rot: [0, turns * 360, tilt1], scale: zoom1 }]
      : [{ at: 0, rot: [0, 0, tilt0] }],
  };
  return {
    light: d.light || 'studio', floor: d.floor || 'shadow', drag: d.drag !== 'false',
    camera: { pos: [0, 0.35, parseFloat(d.distance) || 7.2] },
    objects: [subject],
  };
}

export async function mountScene(host, env) {
  const spec = host.dataset.spec || host.dataset.src ? await readJSON(host.dataset.spec || host.dataset.src) : specFromAttributes(host);
  const stage = new Stage(host, env, spec);
  const named = new Map();
  const ctx = { renderer: stage.renderer, named, vars: varsFrom(host) };
  const root = new Group();
  const objs = await Promise.all((spec.objects || []).map((n, i) => buildNode(n, ctx, `${i}.`)));
  objs.filter(Boolean).forEach((o) => root.add(o));
  stage.scene.add(root);
  const updateParticles = buildParticles(root, named, stage.renderer, env);
  const themeFrom = (spec.objects || []).find((o) => o.vars?.color)?.vars.color || ctx.vars.color;
  if (themeFrom && spec.floor === 'pedestal') stage.setTheme(themeFrom);

  // posPortrait: where a node goes on portrait screens (stacked layouts), instead of pos
  const portraitNodes = [];
  const collect = (nodes, list) => nodes?.forEach((n) => { if (n.posPortrait && n.name) list.push(n); collect(n.children, list); });
  collect(spec.objects, portraitNodes);
  let wasPortrait = null;
  const applyPortrait = () => {
    const portrait = stage.camera.aspect < 0.9;
    if (portrait === wasPortrait) return;
    wasPortrait = portrait;
    for (const n of portraitNodes) {
      const o = named.get(n.name);
      if (o) o.userData.base.pos.set(...(portrait ? n.posPortrait : n.pos || [0, 0, 0]));
    }
  };

  let choreo = createChoreography({ root, camera: stage.camera, spec, env, named });
  const progress = scrollSource(host, env);
  const pointer = pointerOver(host, env);
  const drag = spec.drag ? dragRotate(host, stage, env) : null;

  stage.updates.add((dt, t) => {
    applyPortrait();
    pointer.update(dt);
    const p = progress.value(dt);
    choreo(p, dt, t, pointer.value);
    updateParticles(p, t);
    if (drag) root.rotation.y = drag.angle;
  });

  // data-follow="#ring": the node named "subject" becomes whatever is chosen in that carousel
  const ring = host.dataset.follow && document.querySelector(host.dataset.follow);
  let ticket = 0;
  const onSelect = async (e) => {
    const mine = ++ticket;
    const old = named.get('subject');
    const oldSpec = (spec.objects || []).find((n) => n.name === 'subject');
    if (!old || !oldSpec) return;
    const next = await buildNode({ ...oldSpec, ...e.detail.node, name: 'subject', pos: oldSpec.pos, posPortrait: oldSpec.posPortrait, keys: oldSpec.keys, spin: oldSpec.spin, float: oldSpec.float }, ctx);
    if (mine !== ticket) return;
    next.userData.base.pos.copy(old.userData.base.pos);
    old.parent.add(next);
    old.parent.remove(old);
    old.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
    named.set('subject', next);
    choreo = createChoreography({ root, camera: stage.camera, spec, env, named });
    if (spec.floor === 'pedestal') stage.setTheme(e.detail.color);
    stage.wake();
  };
  ring?.addEventListener('s3d:select', onSelect);

  host.classList.add('is-3d');
  stage.wake();
  return () => {
    ring?.removeEventListener('s3d:select', onSelect);
    drag?.destroy();
    pointer.destroy();
    progress.destroy();
    stage.dispose();
    host.classList.remove('is-3d');
  };
}
