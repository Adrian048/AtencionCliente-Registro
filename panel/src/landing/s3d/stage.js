// The stage: renderer, camera, reflections, a lighting preset, a floor, and a render loop that runs
// only while the canvas is on screen and the tab is visible.
//
// light: "studio" (product shots), "sunset" (warm, long shadows: architecture, travel),
//        "day" (bright, real shadows), "night" (dark, coloured rim: tech, neon)
// floor: "shadow" (soft contact shadow), "pedestal" (dark base with a ring of light),
//        "ground" (an invisible floor that takes real shadows), "none"

import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, DirectionalLight, HemisphereLight, Color,
  Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, CylinderGeometry, MeshStandardMaterial,
  TorusGeometry, SRGBColorSpace, ACESFilmicToneMapping, Fog, Group, ShadowMaterial, PCFShadowMap, Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const LIGHTS = {
  studio: { key: ['#ffffff', 1.6, [3, 4, 5]], rim: ['#ffffff', 3, [-4, 2.5, -3.5]], sky: ['#ffffff', '#222233', 0.35], env: 1, exposure: 1 },
  sunset: { key: ['#ffb877', 2.6, [6, 2.2, 3]], rim: ['#7f8cff', 1.4, [-5, 3, -4]], sky: ['#ffd9b5', '#3b2c3f', 0.55], env: 0.7, exposure: 1.05 },
  day: { key: ['#ffffff', 2.8, [4, 8, 3]], rim: ['#cfe4ff', 0.8, [-5, 4, -4]], sky: ['#d6ebff', '#c9b89a', 0.9], env: 0.9, exposure: 1.1 },
  night: { key: ['#9db4ff', 0.6, [3, 4, 5]], rim: ['#ffffff', 4, [-4, 2.5, -3.5]], sky: ['#1a2040', '#05060a', 0.2], env: 0.35, exposure: 0.95 },
};

function shadowTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

export class Stage {
  constructor(host, env, opts = {}) {
    const { floor = 'shadow', light = 'studio', camera = {}, fog = 0, fogColor = '#000000', floorY = -1.45, exposure } = opts;
    const L = typeof light === 'object' ? { ...LIGHTS.studio, ...light } : LIGHTS[light] || LIGHTS.studio;
    this.host = host;
    this.env = env;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = exposure ?? L.exposure;
    this.renderer.setClearColor(0x000000, 0);
    if (floor === 'ground') { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = PCFShadowMap; }
    const canvas = this.renderer.domElement;
    canvas.className = 's3d-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);

    this.scene = new Scene();
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = L.env;
    pmrem.dispose();

    this.camera = new PerspectiveCamera(camera.fov ?? 28, 1, 0.1, 200);
    this.camera.userData.basePos = new Vector3(...(camera.pos || [0, 0.35, 7.2]));
    this.camera.position.copy(this.camera.userData.basePos);
    this.camera.lookAt(...(camera.look || [0, 0, 0]));
    if (fog) this.scene.fog = new Fog(new Color(fogColor), this.camera.userData.basePos.length() + 0.5, this.camera.userData.basePos.length() + 0.5 + fog);

    const [kc, ki, kp] = L.key, [rc, ri, rp] = L.rim, [sc, gc, si] = L.sky;
    this.key = new DirectionalLight(kc, ki);
    this.key.position.set(...kp);
    this.rim = new DirectionalLight(rc, ri);
    this.rim.position.set(...rp);
    this.fill = new HemisphereLight(sc, gc, si);
    this.scene.add(this.key, this.rim, this.fill);
    this.themeTarget = null;

    this.floor = new Group();
    this.floor.position.y = floorY;
    if (floor === 'shadow' || floor === 'pedestal') {
      const shadow = new Mesh(new PlaneGeometry(2.6, 2.6), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = floor === 'pedestal' ? 0.13 : 0;
      this.floor.add(shadow);
    }
    if (floor === 'pedestal') {
      const base = new Mesh(new CylinderGeometry(0.95, 1.0, 0.24, 96), new MeshStandardMaterial({ color: 0x111114, metalness: 0.7, roughness: 0.25 }));
      this.ring = new Mesh(new TorusGeometry(0.97, 0.018, 16, 128), new MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 2.2, toneMapped: false }));
      this.ring.rotation.x = Math.PI / 2;
      this.ring.position.y = 0.06;
      this.floor.add(base, this.ring);
      this.floor.position.y = floorY - 0.15;
    }
    if (floor === 'ground') {
      const ground = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.22 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.floor.add(ground);
      this.key.castShadow = true;
      this.key.shadow.mapSize.set(2048, 2048);
      this.key.shadow.bias = -0.0005;
      this.key.shadow.normalBias = 0.02;
      Object.assign(this.key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
      this.key.position.multiplyScalar(2.5);
    }
    this.scene.add(this.floor);

    this.updates = new Set();
    this.running = false;
    this.visible = false;
    this.last = 0;
    this.time = 0;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.sync(); }, { rootMargin: '150px 0px' });
    this.io.observe(host);
    this.onVis = () => this.sync();
    document.addEventListener('visibilitychange', this.onVis);
    this.resize();
  }

  // the theme colour lights the rim and the pedestal ring, eased
  setTheme(hex) {
    this.themeTarget = new Color(hex);
    this.wake();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    const cap = this.env.coarse ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    this.camera.aspect = Math.max(1, r.width) / Math.max(1, r.height);
    // keep the subject the same size on narrow screens: the choreography moves the camera back by `fit`
    this.camera.userData.fit = this.camera.aspect < 0.8 ? Math.min(0.8 / this.camera.aspect, 1.9) : 1;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  sync() {
    const on = this.visible && !document.hidden;
    if (on && !this.running) {
      this.running = true;
      this.last = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        this.raf = requestAnimationFrame(loop);
        const dt = Math.min(now - this.last, 100) / 1000;
        this.last = now;
        this.tick(dt);
      };
      this.raf = requestAnimationFrame(loop);
    } else if (!on && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
  }

  // draw once now when the loop is not running (off screen or before the first frame)
  wake() { if (!this.running) this.tick(0); }

  tick(dt) {
    this.time += dt;
    if (this.themeTarget) {
      const k = dt ? 1 - Math.pow(0.02, dt) : 1;
      this.rim.color.lerp(this.themeTarget, k);
      if (this.ring) this.ring.material.emissive.lerp(this.themeTarget, k);
    }
    for (const fn of this.updates) fn(dt, this.time);
    this.render();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
