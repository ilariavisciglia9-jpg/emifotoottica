/* EmiFotoOttica – "Tecnologia lenti": occhiale bifocale + occhiale fotocromatico
   File additivo (non tocca occhiali-3d.js): riusa le utility esportate da lì. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { superPoints, shapeFrom, pathFrom, tube, goldMat, lensMat } from './occhiali-3d.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ MODELLO 1: occhiale con lente BIFOCALE ============ */
function makeBifocalGlasses() {
  const group = new THREE.Group();
  const gold = goldMat();
  const lens = lensMat(0x2a4658, .5);
  const segMat = new THREE.MeshPhysicalMaterial({ color: 0xd8e6ee, roughness: .06, metalness: 0, transparent: true, opacity: .85, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const segOutline = new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: .9 });

  const ringGeo = new THREE.TorusGeometry(.8, .036, 16, 96);
  const lensGeo = new THREE.CircleGeometry(.79, 64);

  // segmento di lettura: arco chiuso da corda dritta (forma a "D") nella parte bassa della lente
  const segShape = new THREE.Shape();
  segShape.absarc(0, -.18, .42, Math.PI * 1.08, Math.PI * 1.92, false);
  segShape.closePath();
  const segGeo = new THREE.ShapeGeometry(segShape);
  const segEdges = new THREE.EdgesGeometry(segGeo);

  const segments = [];
  for (const sd of [-1, 1]) {
    const ring = new THREE.Mesh(ringGeo, gold); ring.position.set(sd * .93, 0, 0);
    const ln = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * .93, 0, 0);
    const seg = new THREE.Mesh(segGeo, segMat); seg.position.set(sd * .93, -.28, .015);
    const segLine = new THREE.LineSegments(segEdges, segOutline); segLine.position.copy(seg.position); segLine.position.z += .002;

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.8], [-sd * .04, -.05, -2.3], [-sd * .06, -.3, -2.6]];
    const temple = new THREE.Mesh(tube(curve, .03, 60, 8), gold);
    temple.position.set(sd * 1.76, .1, 0);

    const hinge = new THREE.Mesh(new THREE.SphereGeometry(.048, 16, 12), gold);
    hinge.position.set(sd * 1.77, .1, 0);

    group.add(ring, ln, seg, segLine, temple, hinge);
    segments.push(seg, segLine);
  }
  const bridge = new THREE.Mesh(tube([[-.11, .1, 0], [-.06, .3, 0], [.06, .3, 0], [.11, .1, 0]], .03, 32, 8), gold);
  group.add(bridge);

  return { group, segments, segMat, segOutline };
}

/* ============ MODELLO 2: occhiale con lente FOTOCROMATICA ============ */
function makePhotochromicGlasses() {
  const group = new THREE.Group();
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: .28, metalness: 0, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.2 });
  const gold = goldMat();
  const lensDynamic = lensMat(0xdfe7ec, .18); // parte da lente chiara/trasparente

  const outer = superPoints(.88, .60, 3.4, .14);
  const inner = superPoints(.72, .46, 3.0, .14).map(p => new THREE.Vector2(p.x, p.y - .04));
  const rimShape = shapeFrom(outer); rimShape.holes.push(pathFrom(inner));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .16, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 4, steps: 1 });
  rimGeo.translate(0, 0, -.08);
  const lensGeo = new THREE.ShapeGeometry(shapeFrom(inner.map(p => p.clone().multiplyScalar(1.04))));

  for (const sd of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeo, black); rim.position.set(sd * .96, 0, 0); rim.rotation.z = sd * .06;
    const ln = new THREE.Mesh(lensGeo, lensDynamic); ln.position.set(sd * .96, 0, .02); ln.rotation.z = sd * .06;

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.6], [-sd * .02, 0, -2.1], [-sd * .05, -.15, -2.5], [-sd * .06, -.4, -2.75]];
    const temple = new THREE.Mesh(tube(curve, .05, 60, 12), black);
    temple.position.set(sd * 1.86, .26, -.02); temple.scale.set(.75, 1.7, 1);

    const rivet = new THREE.Mesh(new THREE.SphereGeometry(.05, 20, 16), gold);
    rivet.position.set(sd * 1.81, .25, .12); rivet.scale.set(1, 1, .5);

    group.add(rim, ln, temple, rivet);
  }
  const bridge = new THREE.Mesh(tube([[-.25, .28, 0], [-.1, .36, 0], [.1, .36, 0], [.25, .28, 0]], .07, 32, 12), black);
  group.add(bridge);

  return { group, lensDynamic };
}

/* ============ SCENA CONDIVISA (una per canvas) ============ */
function createMiniScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('WebGL non disponibile', err);
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xfff1d0, 2.2); key.position.set(4, 6, 6); key.name = 'key';
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.2); rim.position.set(-5, 2, -4); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);

  const stage = canvas.parentElement;
  let W = 1, H = 1;
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  return { renderer, scene, camera, key, resize };
}

/* ============ ATTIVAZIONE PER SEZIONE (solo quando visibile) ============ */
function initSection({ sectionId, canvasId, buildModel, onFrame }) {
  const section = document.getElementById(sectionId);
  const canvas = document.getElementById(canvasId);
  if (!section || !canvas) return;
  const stage = canvas.parentElement;

  const mini = createMiniScene(canvas);
  if (!mini) { stage.classList.add('no-webgl'); return; }
  const { renderer, scene, camera } = mini;

  const model = buildModel();
  scene.add(model.group);
  model.group.position.set(0, 0, 0);

  const fov = THREE.MathUtils.degToRad(camera.fov);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);

  let active = false, running = false, lastT = 0, t0 = null;

  function tick(now) {
    if (!active) { running = false; return; }
    requestAnimationFrame(tick);
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (t0 === null) t0 = now;
    const time = (now - t0) / 1000;

    if (!reduced) {
      model.group.rotation.y = Math.sin(time * .35) * .5 + time * .12;
      model.group.rotation.x = Math.sin(time * .5) * .05;
      model.group.position.y = Math.sin(time * .8) * .06;
    } else {
      model.group.rotation.y = .35;
    }
    onFrame && onFrame(model, time, mini);

    mini.resize();
    renderer.render(scene, camera);
  }

  new IntersectionObserver(([en]) => {
    active = en.isIntersecting;
    stage.classList.toggle('in-view', active);
    const copy = section.querySelector('.glf-copy');
    if (copy) copy.classList.toggle('in-view', active);
    if (active && !running) { running = true; lastT = performance.now(); requestAnimationFrame(tick); }
  }, { threshold: .3 }).observe(section);
}

/* --- Bifocale: pulsazione dorata sul segmento di lettura + label --- */
initSection({
  sectionId: 'glfBifocal',
  canvasId: 'glfCanvasBifocal',
  buildModel: makeBifocalGlasses,
  onFrame(model, time) {
    const pulse = .55 + Math.sin(time * 2.2) * .35;
    model.segOutline.opacity = Math.max(.35, pulse);
    const label = document.getElementById('glfLabelBifocal');
    if (label) label.classList.toggle('on', (time % 4) > .6);
  }
});

/* --- Fotocromatico: la lente si scurisce/schiarisce ciclicamente --- */
const lightCol = new THREE.Color(0xdfe7ec), darkCol = new THREE.Color(0x1c2a33);
initSection({
  sectionId: 'glfPhoto',
  canvasId: 'glfCanvasPhoto',
  buildModel: makePhotochromicGlasses,
  onFrame(model, time, mini) {
    const k = (Math.sin(time * .6 - Math.PI / 2) + 1) / 2; // 0 = chiara/interno, 1 = scura/esterno
    model.lensDynamic.color.copy(lightCol).lerp(darkCol, k);
    model.lensDynamic.opacity = .15 + k * .68;
    if (mini.key) mini.key.intensity = 1.4 + k * 1.6;

    const pillIn = document.getElementById('glfPillIn');
    const pillOut = document.getElementById('glfPillOut');
    if (pillIn && pillOut) {
      pillIn.classList.toggle('on', k < .5);
      pillOut.classList.toggle('on', k >= .5);
    }
  }
});
