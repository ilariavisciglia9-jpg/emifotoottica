/* EmiFotoOttica – animazione 3D occhiali legata allo scroll (three.js r160) */
import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment.js';

/* ============ CONFIGURAZIONE ============ */
const KEEP = 'wayfarer';      // occhiale che resta e si scompone: 'wayfarer' | 'round'
const SCROLL_SMOOTH = 7;      // più alto = più reattivo, più basso = più "morbido"

/* ============ UTILITY ============ */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInCubic = t => t * t * t;

/* ============ GEOMETRIE / MATERIALI ============ */
export function superPoints(a, b, n, skew, N = 96) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    let x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    x *= 1 + skew * (y / b);                 // parte alta più larga della bassa
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}
export const shapeFrom = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)); s.closePath(); return s; };
export const pathFrom  = pts => { const s = new THREE.Path();  pts.forEach((p, i) => i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)); s.closePath(); return s; };
export const tube = (pts, r, seg = 48, rad = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, rad, false);

export const goldMat  = () => new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: .22, envMapIntensity: 1.4 });
export const lensMat  = (color, opacity) => new THREE.MeshPhysicalMaterial({ color, roughness: .04, metalness: .1, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 1.6 });

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

/* --- Wayfarer: acetato nero lucido, rivetti oro --- */
function makeWayfarer() {
  const m = newModel();
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: .28, metalness: 0, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.2 });
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

  m.labels = [
    { text: 'Lenti', part: 'lensR', side: 'r' }, { text: 'Montatura', part: 'rimL', side: 'l' },
    { text: 'Aste', part: 'templeR', side: 'r' }, { text: 'Ponte', part: 'bridge', side: 'l' },
    { text: 'Cerniere', part: 'rivetL', side: 'l' }
  ];
  return m;
}

/* --- Tondo: metallo oro sottile, naselli --- */
function makeRound() {
  const m = newModel();
  const gold = goldMat(), lens = lensMat(0x2a4658, .55);
  const pad = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .2, transparent: true, opacity: .6, clearcoat: 1 });
  const ringGeo = new THREE.TorusGeometry(.8, .034, 16, 96), lensGeo = new THREE.CircleGeometry(.79, 64);

  for (const [sd, id] of [[-1, 'L'], [1, 'R']]) {
    const ring = new THREE.Mesh(ringGeo, gold); ring.position.set(sd * .93, 0, 0);
    m.add('ring' + id, ring, [sd * .9, .3, .7], [.1, sd * .3, 0], .08);

    const ln = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * .93, 0, 0);
    m.add('lens' + id, ln, [sd * .5, -.1, 2.0], [0, sd * .15, 0], 0);

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.8], [-sd * .04, -.05, -2.3], [-sd * .06, -.3, -2.6]];
    const temple = new THREE.Mesh(tube(curve, .03, 60, 8), gold);
    temple.position.set(sd * 1.76, .1, 0);
    m.add('temple' + id, temple, [sd * 1.1, 0, -1.3], [0, -sd * .25, 0], .03);

    const hinge = new THREE.Mesh(new THREE.SphereGeometry(.048, 16, 12), gold);
    hinge.position.set(sd * 1.77, .1, 0);
    m.add('hinge' + id, hinge, [sd * 1.4, .7, .6], [0, 0, 0], .2);

    const padG = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.06, 16, 12), pad); ball.scale.set(.7, 1.4, .5); ball.position.set(sd * .2, -.3, -.1);
    const arm = new THREE.Mesh(tube([[sd * .11, -.05, 0], [sd * .17, -.18, -.06], [sd * .2, -.3, -.1]], .014, 12, 6), gold);
    padG.add(ball, arm);
    m.add('pad' + id, padG, [sd * .3, -1.3, .3], [0, 0, 0], .2);
  }
  const bridge = new THREE.Mesh(tube([[-.11, .1, 0], [-.06, .3, 0], [.06, .3, 0], [.11, .1, 0]], .03, 32, 8), gold);
  m.add('bridge', bridge, [0, 1.3, .6], [.5, 0, 0], .15);

  m.labels = [
    { text: 'Lenti', part: 'lensR', side: 'r' }, { text: 'Montatura', part: 'ringL', side: 'l' },
    { text: 'Aste', part: 'templeR', side: 'r' }, { text: 'Naselli', part: 'padL', side: 'l' },
    { text: 'Ponte', part: 'bridge', side: 'r' }
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

/* ============ SCENA ============ */
const section = document.getElementById('glassesScroll');
const stage   = document.getElementById('glassesStage');
const canvas  = document.getElementById('glassesCanvas');
const hint    = document.getElementById('glHint');
const steps   = [...stage.querySelectorAll('.gl-step')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  console.warn('WebGL non disponibile', err);
}

if (renderer) {
  section.classList.add('ready');
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
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fitDist = (w, h) => { const t = Math.tan(fov / 2); return Math.max((w / 2) / (t * camera.aspect), (h / 2) / t); };

  // i due occhiali: sinistra = tondo oro, destra = wayfarer nero
  const mods = { round: makeRound(), wayfarer: makeWayfarer() };
  const sides = { round: -1, wayfarer: 1 };
  Object.values(mods).forEach(m => scene.add(m.group));
  const keepKey = KEEP, leaveKey = KEEP === 'wayfarer' ? 'round' : 'wayfarer';
  const keeper = mods[keepKey], leaver = mods[leaveKey];

  // etichette (solo desktop, appaiono a scomposizione avvenuta)
  const labelEls = keeper.labels.map(l => {
    const el = document.createElement('div');
    el.className = 'gl-label ' + l.side; el.innerHTML = '<span>' + l.text + '</span>';
    stage.appendChild(el);
    return { el, part: keeper.parts.find(p => p.name === l.part) };
  });

  /* --- dimensioni --- */
  let W = 1, H = 1;
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();

  /* --- stato --- */
  let pT = 0, pS = 0;                    // progresso scroll (target / smussato)
  let introStart = null;                 // parte quando la sezione è ben visibile
  let active = false, running = false, lastT = 0, stepNow = -1;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', e => { pointer.x = e.clientX / innerWidth - .5; pointer.y = e.clientY / innerHeight - .5; }, { passive: true });

  const getProgress = () => {
    const r = section.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight));
  };

  new IntersectionObserver(([en]) => {
    active = en.isIntersecting;
    if (active && !running) { running = true; lastT = performance.now(); requestAnimationFrame(tick); }
  }, { rootMargin: '10% 0px' }).observe(section);

  new IntersectionObserver(([en]) => {
    if (en.intersectionRatio >= .55 && introStart === null) introStart = performance.now() - (reduced ? 5000 : 0);
  }, { threshold: [0, .55, 1] }).observe(stage);

  /* --- posizionamento --- */
  const v3 = new THREE.Vector3();
  const yBase = .45, showX = 2.35, showRot = .45;

  function place(m, side, intro, s1, s2, isKeeper, time) {
    const g = m.group;
    const xEntry = lerp(side * 15, side * showX, intro);
    const spin = side * (1 - intro) * 2.2;
    const bob = reduced ? 0 : Math.sin(time * 1.2 + side) * .06 * (1 - s2 * .5);
    let x, sc, ry, rx, op;

    if (isKeeper) {
      x  = lerp(xEntry, 0, s1);
      sc = lerp(.82, 1.12, s1) * lerp(1, .9, s2);
      ry = lerp(-side * showRot, .3, s1) + spin + lerp(0, -.95, s2);
      rx = lerp(.08, .12, s1) + .18 * s2;
      op = smooth(0, 1, intro);
    } else {
      x  = lerp(xEntry, side * 13, easeInCubic(s1));
      sc = lerp(.82, .5, s1);
      ry = -side * showRot + spin + side * s1 * 2.4;
      rx = .08;
      op = smooth(0, 1, intro) * (1 - smooth(.1, .9, s1));
    }
    g.visible = op > .01;
    setOpacity(g, op);
    g.position.set(x, yBase + bob, lerp(-3, 0, intro));
    g.scale.setScalar(sc);
    g.rotation.set(rx + pointer.sy * .12, ry + pointer.sx * .25 + (reduced ? 0 : Math.sin(time * .6) * .04), 0);
  }

  /* --- ciclo --- */
  function tick(now) {
    if (!active) { running = false; return; }
    requestAnimationFrame(tick);
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    const time = now / 1000;

    pT = getProgress();
    pS += (pT - pS) * (1 - Math.exp(-dt * SCROLL_SMOOTH));
    pointer.sx += (pointer.x - pointer.sx) * .06; pointer.sy += (pointer.y - pointer.sy) * .06;

    const ti = introStart === null ? -1 : (now - introStart) / 1000;
    const iL = ti < 0 ? 0 : easeOutCubic(clamp(ti / 1.7));                // occhiale da sinistra
    const iR = ti < 0 ? 0 : easeOutCubic(clamp((ti - .25) / 1.7));        // occhiale da destra (leggermente dopo)
    const intro = { [-1]: iL, [1]: iR };

    const s1 = smooth(.20, .42, pS);   // uno esce, l'altro va al centro
    const s2 = smooth(.50, .90, pS);   // scomposizione

    place(leaver, sides[leaveKey], intro[sides[leaveKey]], s1, s2, false, time);
    place(keeper, sides[keepKey],  intro[sides[keepKey]],  s1, s2, true,  time);
    explode(keeper, s2);

    // camera: si adatta alla larghezza per funzionare anche su mobile
    const dShow = fitDist(9.6, 4.4), dSolo = fitDist(5.8, 3.8), dExp = fitDist(9.6, 5.2);
    camera.position.set(0, 0, lerp(lerp(dShow, dSolo, s1), dExp, s2));
    camera.lookAt(0, 0, 0);

    // testi
    const idx = pS < .17 ? 0 : pS < .5 ? 1 : pS < .92 ? 2 : 3;
    if (idx !== stepNow) { stepNow = idx; steps.forEach((s, i) => s.classList.toggle('on', i === idx)); }
    hint.classList.toggle('hide', pT > .03 || iL < .9);

    // etichette
    const la = smooth(.72, .95, s2);
    for (const { el, part } of labelEls) {
      el.style.opacity = la;
      if (la <= 0) continue;
      part.obj.getWorldPosition(v3).project(camera);
      el.style.transform = `translate(${(v3.x * .5 + .5) * W}px, ${(-v3.y * .5 + .5) * H}px)`;
    }

    renderer.render(scene, camera);
  }
}
