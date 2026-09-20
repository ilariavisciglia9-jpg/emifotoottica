/* EmiFotoOttica – pagina Ray-Ban: occhiale 3D frontale in hero + racconto con scomposizione allo scroll
   File dedicato SOLO a questa pagina (non condiviso con le altre pagine marchio). */
import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ============ GEOMETRIE / MATERIALI (stessa logica della homepage, autonoma) ============ */
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

function newModel() {
  const group = new THREE.Group(), parts = [];
  const add = (name, obj, dir, rot = [0, 0, 0], delay = 0) => {
    obj.name = name; group.add(obj);
    parts.push({ name, obj, home: obj.position.clone(), rot0: new THREE.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z),
                 dir: new THREE.Vector3(...dir), rot: new THREE.Vector3(...rot), delay });
    return obj;
  };
  return { group, parts, add, labels: [] };
}

/* --- Wayfarer: acetato nero lucido, rivetti oro (la vera forma Ray-Ban) --- */
function makeWayfarer(frameColor) {
  const m = newModel();
  const black = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: .28, metalness: 0, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.2 });
  const gold = goldMat(), lens = lensMat(0x1d2f3d, .62);

  const outer = superPoints(.88, .60, 3.4, .14);
  const inner = superPoints(.72, .46, 3.0, .14).map(p => new THREE.Vector2(p.x, p.y - .04));
  const rimShape = shapeFrom(outer); rimShape.holes.push(pathFrom(inner));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .16, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 4, steps: 1 });
  rimGeo.translate(0, 0, -.08);
  const lensGeo = new THREE.ShapeGeometry(shapeFrom(inner.map(p => p.clone().multiplyScalar(1.04))));

  for (const [sd, id] of [[-1, 'L'], [1, 'R']]) {
    const rim = new THREE.Mesh(rimGeo, black);  rim.position.set(sd * .96, 0, 0);   rim.rotation.z = sd * .06;
    const ln  = new THREE.Mesh(lensGeo, lens);  ln.position.set(sd * .96, 0, .02); ln.rotation.z = sd * .06;
    m.add('rim' + id, rim, [sd * .9, .35, .5], [.15, sd * .35, -sd * .1], .08);
    m.add('lens' + id, ln, [sd * .6, -.1, 1.9], [0, sd * .15, 0], 0);

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.6], [-sd * .02, 0, -2.1], [-sd * .05, -.15, -2.5], [-sd * .06, -.4, -2.75]];
    const temple = new THREE.Mesh(tube(curve, .05, 60, 12), black);
    temple.position.set(sd * 1.86, .26, -.02); temple.scale.set(.75, 1.7, 1);
    m.add('temple' + id, temple, [sd * 1.1, .1, -1.3], [0, -sd * .25, 0], .03);

    const rivet = new THREE.Mesh(new THREE.SphereGeometry(.05, 20, 16), gold);
    rivet.position.set(sd * 1.81, .25, .12); rivet.scale.set(1, 1, .5);
    m.add('rivet' + id, rivet, [sd * 1.5, .9, 1.2], [0, 0, sd * 1.5], .2);
  }
  const bridge = new THREE.Mesh(tube([[-.25, .28, 0], [-.1, .36, 0], [.1, .36, 0], [.25, .28, 0]], .07, 32, 12), black);
  m.add('bridge', bridge, [0, 1.3, .9], [.5, 0, 0], .15);

  m.frameMat = black;
  m.labels = [
    { text: 'Lenti', part: 'lensR', side: 'r' }, { text: 'Montatura', part: 'rimL', side: 'l' },
    { text: 'Aste', part: 'templeR', side: 'r' }, { text: 'Ponte', part: 'bridge', side: 'l' },
    { text: 'Rivetti', part: 'rivetL', side: 'l' }
  ];
  return m;
}

function explode(model, e) {
  for (const p of model.parts) {
    const k = smooth(p.delay, 1, e);
    p.obj.position.copy(p.home).addScaledVector(p.dir, k);
    p.obj.rotation.set(p.rot0.x + p.rot.x * k, p.rot0.y + p.rot.y * k, p.rot0.z + p.rot.z * k);
  }
}
function setOpacity(group, k) {
  group.traverse(o => {
    if (!o.isMesh) return;
    const mt = o.material;
    if (mt.userData.baseOp === undefined) { mt.userData.baseOp = mt.opacity; mt.userData.baseTr = mt.transparent; }
    if (k >= .999) { mt.opacity = mt.userData.baseOp; mt.transparent = mt.userData.baseTr; }
    else { mt.transparent = true; mt.opacity = mt.userData.baseOp * k; }
  });
}

function makeEnvScene(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff1d0, 2.2); key.position.set(4, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.2); rim.position.set(-5, 2, -4); scene.add(rim);
  return scene;
}

const COLORS = [
  { name: 'Nero', hex: 0x0c0c0e },
  { name: 'Tartaruga', hex: 0x6b4a2b },
  { name: 'Oro', hex: 0xd4af37 }
];

const models = []; // { frameMat } di ogni istanza, per cambiare colore ovunque insieme

/* ============================================================
   HERO — occhiale frontale, fermo a destra, leggera rotazione idle
   ============================================================ */
(function initHero() {
  const stage = document.getElementById('rbHeroStage');
  const canvas = document.getElementById('rbHeroCanvas');
  if (!stage || !canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) { console.warn('WebGL non disponibile', err); return; }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = makeEnvScene(renderer);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, 0, 7);
  camera.lookAt(0, 0, 0);

  const model = makeWayfarer(COLORS[0].hex);
  scene.add(model.group);
  models.push(model);

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  let active = false, running = false, t0 = null;
  function tick(now) {
    if (!active) { running = false; return; }
    requestAnimationFrame(tick);
    if (t0 === null) t0 = now;
    const time = (now - t0) / 1000;
    const introEase = 1 - Math.pow(1 - clamp(time / 1.3), 3);

    // frontale (rotazione minima) con una leggera oscillazione per far percepire il 3D
    model.group.rotation.y = lerp(-0.9, 0, introEase) + (reduced ? 0 : Math.sin(time * .5) * .12);
    model.group.rotation.x = .05 + (reduced ? 0 : Math.sin(time * .4) * .03);
    model.group.position.y = reduced ? 0 : Math.sin(time * .8) * .05;
    model.group.scale.setScalar(lerp(.55, 1, introEase));
    stage.classList.toggle('ready', introEase > .05);

    renderer.render(scene, camera);
  }

  new IntersectionObserver(([en]) => {
    active = en.isIntersecting;
    if (active && !running) { running = true; requestAnimationFrame(tick); }
  }, { threshold: .05 }).observe(stage);
})();

/* ============================================================
   RACCONTO — arrivo, rotazione e scomposizione legata allo scroll
   ============================================================ */
(function initStory() {
  const track  = document.getElementById('rbStoryTrack');
  const sticky = document.getElementById('rbStorySticky');
  const canvas = document.getElementById('rbStoryCanvas');
  if (!track || !sticky || !canvas) return;
  const steps = [...sticky.querySelectorAll('.rb-step')];

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) { console.warn('WebGL non disponibile', err); return; }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = makeEnvScene(renderer);
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fitDist = (w, h) => { const t = Math.tan(fov / 2); return Math.max((w / 2) / (t * camera.aspect), (h / 2) / t); };

  const model = makeWayfarer(COLORS[0].hex);
  scene.add(model.group);
  models.push(model);

  const labelEls = model.labels.map(l => {
    const el = document.createElement('div');
    el.className = 'rb-label ' + l.side; el.innerHTML = '<span>' + l.text + '</span>';
    sticky.appendChild(el);
    return { el, part: model.parts.find(p => p.name === l.part) };
  });

  let W = 1, H = 1;
  function resize() {
    W = sticky.clientWidth; H = sticky.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(sticky); resize();

  const getProgress = () => {
    const r = track.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight));
  };

  let active = false, running = false, lastT = 0, stepNow = -1;
  const v3 = new THREE.Vector3();

  function tick(now) {
    if (!active) { running = false; return; }
    requestAnimationFrame(tick);
    const time = now / 1000;

    const p = getProgress();

    // fase 0: l'occhiale entra ruotando verso il frontale
    // fase 1: rimane frontale, gira leggermente
    // fase 2: si scompone e appaiono le etichette
    const arrive = smooth(0, .28, p);
    const s2 = smooth(.55, .95, p);

    const rotY = lerp(-1.4, 0, arrive) + (1 - s2) * Math.sin(time * .5) * .15 + s2 * -.9;
    const rotX = .08 + s2 * .16;
    const scale = lerp(.62, 1.05, arrive) * lerp(1, .92, s2);
    const posZ = lerp(-3, 0, arrive);

    model.group.position.set(0, .1 + (reduced ? 0 : Math.sin(time * .8) * .05 * (1 - s2 * .6)), posZ);
    model.group.rotation.set(rotX, rotY, 0);
    model.group.scale.setScalar(scale);
    setOpacity(model.group, smooth(0, .12, p));
    explode(model, s2);

    const dShow = fitDist(9.2, 5.2), dExp = fitDist(9.6, 5.6);
    camera.position.set(0, 0, lerp(dShow, dExp, s2));
    camera.lookAt(0, 0, 0);

    const idx = p < .3 ? 0 : p < .62 ? 1 : 2;
    if (idx !== stepNow) { stepNow = idx; steps.forEach((s, i) => s.classList.toggle('on', i === idx)); }

    const la = smooth(.68, .92, s2);
    for (const { el, part } of labelEls) {
      el.style.opacity = la;
      if (la <= 0) continue;
      part.obj.getWorldPosition(v3).project(camera);
      el.style.transform = `translate(${(v3.x * .5 + .5) * W}px, ${(-v3.y * .5 + .5) * H}px)`;
    }

    renderer.render(scene, camera);
  }

  new IntersectionObserver(([en]) => {
    active = en.isIntersecting;
    if (active && !running) { running = true; lastT = performance.now(); requestAnimationFrame(tick); }
  }, { rootMargin: '10% 0px' }).observe(track);
})();

/* ============================================================
   COLORI — cambia il colore della montatura in hero e nel racconto
   ============================================================ */
(function initColors() {
  const wrap = document.getElementById('rbColors');
  if (!wrap) return;
  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'brand-color-dot' + (i === 0 ? ' active' : '');
    b.style.background = '#' + c.hex.toString(16).padStart(6, '0');
    b.title = c.name;
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.brand-color-dot').forEach(el => el.classList.remove('active'));
      b.classList.add('active');
      models.forEach(m => m.frameMat.color.setHex(c.hex));
    });
    wrap.appendChild(b);
  });
})();
