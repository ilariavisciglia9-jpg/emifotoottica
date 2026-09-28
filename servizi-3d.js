/* =========================================================
   EmiFotoOttica — Animazioni 3D scroll-driven per le pagine servizio
   Uso: <section class="svc3d" data-scene="cuscino" data-photos="a.jpg,b.jpg"> ... </section>
   Scene disponibili: cuscino  (le altre si aggiungono in SCENES)
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- Foto casuale ---------- */
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function drawCover(ctx, img, S) {
  const r = Math.max(S / img.width, S / img.height), w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
}
// Foto "finta" di riserva (tramonto al mare) se le immagini non sono disponibili
const PALETTES = [
  ['#ffb46b', '#ff7b8a', '#6a5acd', '#2d3e70', '#1a2544'],
  ['#ffe29a', '#ffa45c', '#e85d75', '#3b4f7d', '#22304f'],
  ['#c9f1ff', '#8fd3f4', '#f6d365', '#2f6f73', '#1d4a4d'],
  ['#fbd3e9', '#bb86fc', '#ff9a8b', '#3c3b6e', '#23234a']
];
function paintFallback(ctx, S, k) {
  const p = PALETTES[k % PALETTES.length];
  const sky = ctx.createLinearGradient(0, 0, 0, S * .62);
  sky.addColorStop(0, p[2]); sky.addColorStop(.6, p[1]); sky.addColorStop(1, p[0]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(255,245,220,.95)';
  ctx.beginPath(); ctx.arc(S * .62, S * .5, S * .11, 0, Math.PI * 2); ctx.fill();
  const sea = ctx.createLinearGradient(0, S * .6, 0, S);
  sea.addColorStop(0, p[3]); sea.addColorStop(1, p[4]);
  ctx.fillStyle = sea; ctx.fillRect(0, S * .6, S, S * .4);
  ctx.fillStyle = 'rgba(255,240,210,.35)';
  for (let i = 0; i < 9; i++) ctx.fillRect(S * .62 - S * (.12 - i * .01), S * (.63 + i * .035), S * (.24 - i * .02), S * .008);
  ctx.fillStyle = p[4];
  ctx.beginPath(); ctx.moveTo(0, S * .62);
  ctx.quadraticCurveTo(S * .18, S * .42, S * .4, S * .61); ctx.lineTo(0, S * .61); ctx.fill();
  ctx.strokeStyle = p[4]; ctx.lineWidth = S * .006;
  [[.3, .25], [.36, .22], [.8, .3]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.moveTo(S * x - 14, S * y); ctx.quadraticCurveTo(S * x - 6, S * y - 9, S * x, S * y);
    ctx.quadraticCurveTo(S * x + 6, S * y - 9, S * x + 14, S * y); ctx.stroke();
  });
}
function createPhotoSource(list) {
  const S = 1024, canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const photos = list.slice().sort(() => Math.random() - .5);
  let idx = -1, fallbackK = Math.floor(Math.random() * 4);
  async function next() {
    for (let tries = 0; tries < photos.length; tries++) {
      idx = (idx + 1) % photos.length;
      try { const img = await loadImage(photos[idx]); drawCover(ctx, img, S); tex.needsUpdate = true; return; } catch (e) { /* prova la successiva */ }
    }
    paintFallback(ctx, S, fallbackK++); tex.needsUpdate = true;
  }
  return { tex, next };
}

/* ---------- Texture tessuto ---------- */
function weaveTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 4) {
    g.fillStyle = (i / 4) % 2 ? '#9a9a9a' : '#6c6c6c'; g.fillRect(0, i, 64, 2);
    g.fillStyle = (i / 4) % 2 ? '#707070' : '#959595'; g.fillRect(i, 0, 2, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14);
  return t;
}
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,.45)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* =========================================================
   SCENA: CUSCINO — la foto vola sul cuscino e viene stampata
   ========================================================= */
function sceneCuscino(ctx) {
  const { scene, photo } = ctx;
  const D = 0.34, PINCH = 0.07, PRINT = 0.86;
  const puff = (u, v) => Math.pow(Math.max(0, 1 - u * u), .55) * Math.pow(Math.max(0, 1 - v * v), .55);

  function half(segments = 80) {
    const g = new THREE.PlaneGeometry(2, 2, segments, segments), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i);
      p.setXYZ(i, u * (1 - PINCH * (1 - v * v)), v * (1 - PINCH * (1 - u * u)), D * puff(u, v));
    }
    g.computeVertexNormals(); return g;
  }

  const fabric = new THREE.Color('#f2ede3');
  const weave = weaveTexture();
  const U = { uReveal: { value: -0.1 }, uGlow: { value: 0 }, uFabric: { value: fabric } };

  const frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: photo.tex, roughness: .9, bumpMap: weave, bumpScale: .15 });
  frontMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = 'uniform float uReveal; uniform float uGlow; uniform vec3 uFabric;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 pUv = (vMapUv - ${((1 - PRINT) / 2).toFixed(3)}) / ${PRINT.toFixed(3)};
        float soft = smoothstep(0.0,0.012,pUv.x)*smoothstep(0.0,0.012,1.0-pUv.x)*smoothstep(0.0,0.012,pUv.y)*smoothstep(0.0,0.012,1.0-pUv.y);
        vec3 photoC = texture2D(map, clamp(pUv, 0.0, 1.0)).rgb;
        float tt = 1.0 - vMapUv.y;
        float rev = 1.0 - smoothstep(uReveal - 0.05, uReveal, tt);
        diffuseColor.rgb *= mix(uFabric, photoC * 0.97 + uFabric * 0.03, soft * rev);
        float heatBand = exp(-pow((tt - uReveal) * 14.0, 2.0));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * heatBand * vec3(1.0, 0.62, 0.3);`);
  };
  const backMat = new THREE.MeshStandardMaterial({ color: fabric, roughness: .92, bumpMap: weave, bumpScale: .15 });

  const rig = new THREE.Group(); scene.add(rig);
  const body = new THREE.Group(); rig.add(body);
  const front = new THREE.Mesh(half(), frontMat);
  const back = new THREE.Mesh(half(), backMat); back.rotation.y = Math.PI;
  body.add(front, back);

  // cordoncino lungo la cucitura
  const pts = [];
  for (let i = 0; i < 160; i++) {
    const t = i / 160 * 4, s = t % 1, side = Math.floor(t);
    let u, v;
    if (side === 0) { u = -1 + 2 * s; v = -1; } else if (side === 1) { u = 1; v = -1 + 2 * s; }
    else if (side === 2) { u = 1 - 2 * s; v = 1; } else { u = -1; v = 1 - 2 * s; }
    pts.push(new THREE.Vector3(u * (1 - PINCH * (1 - v * v)), v * (1 - PINCH * (1 - u * u)), 0));
  }
  const piping = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320, .022, 8, true),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#e4dccd'), roughness: .85 }));
  body.add(piping);

  // ombra a terra
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2 + .3; shadow.position.y = -1.22; scene.add(shadow);

  // foglio con la foto (carta transfer) — pivot sul bordo alto per l'effetto "strappo"
  const SH = PRINT * 2, SEG = 40;
  const sheetGeo = new THREE.PlaneGeometry(SH, SH, SEG, SEG);
  sheetGeo.translate(0, -SH / 2, 0);
  const base = Float32Array.from(sheetGeo.attributes.position.array);
  const sheetMat = new THREE.MeshStandardMaterial({ map: photo.tex, roughness: .45, metalness: 0, side: THREE.DoubleSide, transparent: true, emissive: 0xffffff, emissiveIntensity: 0 });
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  const pivot = new THREE.Group(); pivot.add(sheet); rig.add(pivot);
  let lastBend = -1, lastSq = -1;
  function conformSheet(bend, squish) {
    if (Math.abs(bend - lastBend) < 1e-4 && Math.abs(squish - lastSq) < 1e-4) return;
    lastBend = bend; lastSq = squish;
    const p = sheetGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1] + PRINT; // y nello spazio cuscino
      p.setZ(i, bend * (D * squish * puff(x, y) + .012));
    }
    p.needsUpdate = true; sheetGeo.computeVertexNormals();
  }

  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    // p = avanzamento scroll 0..1, t = tempo, L = layout
    update(p, t, L) {
      const enter = ease(seg(p, 0, .16));
      const fly = ease(seg(p, .16, .4));
      const land = ease(seg(p, .4, .48));
      const press = seg(p, .48, .74);
      const peel = ease(seg(p, .74, .86));
      const show = ease(seg(p, .86, 1));

      // cuscino
      rig.position.set(L.x, L.y + Math.sin(t * 1.1) * .035, 0);
      rig.scale.setScalar(L.s * lerp(.82, 1, enter));
      rig.rotation.y = lerp(-.7, 0, ease(seg(p, 0, .4))) + show * .5 + mouse.x * .12;
      rig.rotation.x = lerp(.18, 0, ease(seg(p, 0, .4))) - show * .08 + mouse.y * .06;
      const squish = 1 - .28 * Math.sin(Math.PI * clamp(seg(p, .46, .8)));
      body.scale.z = squish;
      shadow.position.x = L.x; shadow.scale.setScalar(L.s); shadow.position.y = L.y - 1.22 * L.s;
      shadow.material.opacity = enter;

      // stampa (rivelazione dall'alto verso il basso con banda di calore)
      U.uReveal.value = lerp(-0.08, 1.08, ease(press));
      U.uGlow.value = Math.sin(Math.PI * press) * 1.6;

      // foglio: volo -> atterraggio -> strappo
      const startPos = new THREE.Vector3(1.35, 1.75, 1.1), hoverPos = new THREE.Vector3(0, PRINT, .75);
      pivot.position.lerpVectors(startPos, hoverPos, fly);
      pivot.position.z = lerp(pivot.position.z, 0, land);
      pivot.rotation.set(lerp(.35, 0, fly), lerp(-.9, 0, fly), lerp(.3, 0, fly));
      pivot.scale.setScalar(lerp(.5, 1, fly));
      conformSheet(land * (1 - seg(peel, 0, .35)), squish);
      pivot.rotation.x += -peel * 2.1;
      pivot.position.y += peel * .5; pivot.position.z += peel * .5;
      // l'inchiostro passa dalla carta al tessuto: il foglio si sbianca e diventa traslucido
    const inkOut = seg(press, .05, .75);
    sheetMat.emissiveIntensity = inkOut * .75;
    sheetMat.opacity = enter * lerp(1, .4, inkOut) * (1 - seg(peel, .45, 1));
      pivot.visible = sheetMat.opacity > .01;
    }
  };
}

const SCENES = { cuscino: sceneCuscino };

/* =========================================================
   Motore comune (renderer, scroll, didascalie)
   ========================================================= */
function initSection(section) {
  const build = SCENES[section.dataset.scene];
  if (!build) return;
  const canvas = section.querySelector('.svc3d__canvas');
  const steps = [...section.querySelectorAll('.svc3d__step')];
  const dots = [...section.querySelectorAll('.svc3d__dot')];
  const hint = section.querySelector('.svc3d__hint');

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { section.classList.add('svc3d--static'); steps.forEach(s => s.classList.add('is-active')); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const key = new THREE.DirectionalLight(0xfff4e6, 1.4); key.position.set(3, 4, 5); scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e0d0, .6));

  const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
  camera.position.set(0, .15, 6.4);

  const photos = (section.dataset.photos || '').split(',').map(s => s.trim()).filter(Boolean);
  const photo = createPhotoSource(photos);
  photo.next();
  const ctx = { scene, camera, photo };
  const sc = build(ctx);

  const shuffle = section.querySelector('.svc3d__shuffle');
  if (shuffle) shuffle.addEventListener('click', () => photo.next());

  const L = { x: 0, y: 0, s: 1 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const a = camera.aspect;
    if (a < .85) { L.x = 0; L.y = .72; L.s = Math.min(.95, a * 1.5); }       // mobile: oggetto in alto, testo sotto
    else if (a < 1.25) { L.x = .7; L.y = 0; L.s = .8; }                         // tablet
    else { L.x = Math.min(1.35, a * .62); L.y = 0; L.s = 1; }                    // desktop: oggetto a destra
  }
  resize(); window.addEventListener('resize', resize);

  section.addEventListener('pointermove', e => {
    const r = section.getBoundingClientRect();
    ctx.onPointer && ctx.onPointer((e.clientX / r.width) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  });

  let target = 0, cur = 0, visible = false, active = -1;
  function readScroll() {
    const r = section.getBoundingClientRect();
    target = clamp(-r.top / (r.height - window.innerHeight));
  }
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll(); cur = target;

  const thresholds = (section.dataset.steps || '0,.2,.48,.8').split(',').map(Number);
  function setStep(p) {
    let i = 0; thresholds.forEach((th, k) => { if (p >= th) i = k; });
    if (i === active) return; active = i;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    dots.forEach((d, k) => d.classList.toggle('is-active', k <= i));
  }

  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '100px' }).observe(section);
  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), .1);
    cur += (target - cur) * (1 - Math.exp(-dt * 7));
    setStep(cur);
    if (hint) hint.style.opacity = String(1 - seg(cur, 0, .05));
    sc.update(cur, clock.elapsedTime, L);
    renderer.render(scene, camera);
  })();
}

document.querySelectorAll('.svc3d[data-scene]').forEach(initSection);
