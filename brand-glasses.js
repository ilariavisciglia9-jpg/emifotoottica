/* EmiFotoOttica – occhiale 3D nella hero delle pagine marchio (ray-ban.html, burberry.html, ecc.)
   File condiviso: ogni pagina imposta prima window.BRAND_GLASSES = {shape, colors} e poi include
   questo script come <script type="module" src="brand-glasses.js"></script>. */
import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment.js';

const cfg = Object.assign({ shape: 'wayfarer', colors: [
  { name: 'Nero', hex: 0x0c0c0e },
  { name: 'Tartaruga', hex: 0x6b4a2b },
  { name: 'Oro', hex: 0xd4af37 }
] }, window.BRAND_GLASSES || {});

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- utility geometria (stessa logica di occhiali-3d.js, autonoma) ---------- */
function superPoints(a, b, n, skew, N = 96) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    let x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    x *= 1 + skew * (y / b);
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}
const shapeFrom = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)); s.closePath(); return s; };
const pathFrom  = pts => { const s = new THREE.Path();  pts.forEach((p, i) => i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)); s.closePath(); return s; };
const tube = (pts, r, seg = 48, rad = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, rad, false);
const goldMat = () => new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: .22, envMapIntensity: 1.4 });
const lensMat = (color, opacity) => new THREE.MeshPhysicalMaterial({ color, roughness: .04, metalness: .1, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 1.6 });

/* ---------- due forme generiche: squadrata (wayfarer-style) e tonda ---------- */
function makeGlasses(shape, frameColor) {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: .28, metalness: .05, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.2 });
  const gold = goldMat();
  const lens = lensMat(0x1d2f3d, .55);

  if (shape === 'round') {
    const ringGeo = new THREE.TorusGeometry(.8, .036, 16, 96);
    const lensGeo = new THREE.CircleGeometry(.79, 64);
    for (const sd of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, frameMat); ring.position.set(sd * .93, 0, 0);
      const ln = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * .93, 0, 0);
      const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.8], [-sd * .04, -.05, -2.3], [-sd * .06, -.3, -2.6]];
      const temple = new THREE.Mesh(tube(curve, .03, 60, 8), frameMat);
      temple.position.set(sd * 1.76, .1, 0);
      group.add(ring, ln, temple);
    }
    const bridge = new THREE.Mesh(tube([[-.11, .1, 0], [-.06, .3, 0], [.06, .3, 0], [.11, .1, 0]], .03, 32, 8), frameMat);
    group.add(bridge);
  } else {
    const outer = superPoints(.88, .60, 3.4, shape === 'cateye' ? .34 : .14);
    const inner = superPoints(.72, .46, 3.0, shape === 'cateye' ? .34 : .14).map(p => new THREE.Vector2(p.x, p.y - .04));
    const rimShape = shapeFrom(outer); rimShape.holes.push(pathFrom(inner));
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .16, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 4, steps: 1 });
    rimGeo.translate(0, 0, -.08);
    const lensGeo = new THREE.ShapeGeometry(shapeFrom(inner.map(p => p.clone().multiplyScalar(1.04))));
    for (const sd of [-1, 1]) {
      const rim = new THREE.Mesh(rimGeo, frameMat); rim.position.set(sd * .96, 0, 0); rim.rotation.z = sd * .06;
      const ln = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * .96, 0, .02); ln.rotation.z = sd * .06;
      const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.6], [-sd * .02, 0, -2.1], [-sd * .05, -.15, -2.5], [-sd * .06, -.4, -2.75]];
      const temple = new THREE.Mesh(tube(curve, .05, 60, 12), frameMat);
      temple.position.set(sd * 1.86, .26, -.02); temple.scale.set(.75, 1.7, 1);
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(.05, 20, 16), gold);
      rivet.position.set(sd * 1.81, .25, .12); rivet.scale.set(1, 1, .5);
      group.add(rim, ln, temple, rivet);
    }
    const bridge = new THREE.Mesh(tube([[-.25, .28, 0], [-.1, .36, 0], [.1, .36, 0], [.25, .28, 0]], .07, 32, 12), frameMat);
    group.add(bridge);
  }
  return { group, frameMat };
}

/* ---------- inserimento DOM: canvas + pallini colore dentro .brand-hero ---------- */
const hero = document.querySelector('.brand-hero');
if (hero) {
  const stage = document.createElement('div');
  stage.className = 'brand-glasses-stage';
  stage.innerHTML = '<canvas class="brand-glasses-canvas"></canvas>';
  hero.insertBefore(stage, hero.firstChild);
  const canvas = stage.querySelector('canvas');

  const meta = hero.querySelector('.brand-hero__meta');
  if (meta && cfg.colors && cfg.colors.length) {
    const wrap = document.createElement('div');
    wrap.className = 'brand-colors';
    wrap.innerHTML = '<span class="brand-colors__label">Colori</span>';
    cfg.colors.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'brand-color-dot' + (i === 0 ? ' active' : '');
      b.style.background = '#' + c.hex.toString(16).padStart(6, '0');
      b.title = c.name || '';
      b.addEventListener('click', () => {
        wrap.querySelectorAll('.brand-color-dot').forEach(el => el.classList.remove('active'));
        b.classList.add('active');
        if (model) model.frameMat.color.setHex(c.hex);
      });
      wrap.appendChild(b);
    });
    meta.insertAdjacentElement('afterend', wrap);
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('WebGL non disponibile', err);
  }

  let model = null;

  if (renderer) {
    stage.classList.add('ready');
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xfff1d0, 2.2); key.position.set(4, 6, 6); scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 1.2); rim.position.set(-5, 2, -4); scene.add(rim);

    const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);

    model = makeGlasses(cfg.shape, cfg.colors[0] ? cfg.colors[0].hex : 0x0c0c0e);
    scene.add(model.group);

    function resize() {
      const w = hero.clientWidth, h = hero.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(hero); resize();

    let active = false, running = false, t0 = null, introStart = null;

    function getScrollProgress() {
      const r = hero.getBoundingClientRect();
      const total = r.height + innerHeight;
      return Math.min(1, Math.max(0, 1 - (r.bottom / total)));
    }

    function tick(now) {
      if (!active) { running = false; return; }
      requestAnimationFrame(tick);
      if (t0 === null) t0 = now;
      if (introStart === null) introStart = now;
      const time = (now - t0) / 1000;
      const introT = Math.min(1, (now - introStart) / 1400);
      const introEase = 1 - Math.pow(1 - introT, 3); // easeOutCubic: la montatura arriva verso l'utente

      const scrollP = getScrollProgress();
      const idle = reduced ? 0 : Math.sin(time * .6) * .25;

      model.group.position.z = THREE.MathUtils.lerp(-9, 0, introEase);
      model.group.position.y = reduced ? 0 : Math.sin(time * .9) * .08;
      model.group.rotation.y = idle + scrollP * Math.PI * 0.9;
      model.group.rotation.x = .1 + scrollP * .25;
      model.group.scale.setScalar(THREE.MathUtils.lerp(.6, 1, introEase));

      camera.position.set(0, 0, 6.2);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    new IntersectionObserver(([en]) => {
      active = en.isIntersecting;
      if (active && !running) { running = true; requestAnimationFrame(tick); }
    }, { threshold: .05 }).observe(hero);
  }
}
