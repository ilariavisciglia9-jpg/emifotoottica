/* EmiFotoOttica – pagine marchio: occhiale 3D "classico" (non un modello specifico)
   frontale in hero + racconto con scomposizione e info al passaggio del mouse allo scroll.
   File condiviso da tutte le pagine marchio (tranne ray-ban.html che ha la sua versione dedicata). */
import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment.js';

const cfg = Object.assign({ shape: 'wayfarer', colors: [
  { name: 'Nero', hex: 0x0c0c0e },
  { name: 'Tartaruga', hex: 0x6b4a2b },
  { name: 'Oro', hex: 0xd4af37 }
] }, window.CLASSIC_GLASSES || {});

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ============ GEOMETRIE / MATERIALI ============ */
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
function flattenBand(pts, b, capRatio, startRatio, upper) {
  const cap = b * capRatio, start = b * startRatio;
  return pts.map(p => {
    const y = upper ? p.y : -p.y;
    if (y <= start) return p;
    const t = smooth(start, cap, y);
    const newY = lerp(y, cap, t);
    return new THREE.Vector2(p.x, upper ? newY : -newY);
  });
}
function flattenTop(pts, b, capRatio = .9, startRatio = .5) {
  return flattenBand(pts, b, capRatio, startRatio, true);
}
function flattenBoth(pts, b, capRatioTop, startRatioTop, capRatioBot, startRatioBot) {
  pts = flattenBand(pts, b, capRatioTop, startRatioTop, true);
  return flattenBand(pts, b, capRatioBot, startRatioBot, false);
}
/* piccola texture generica (logo/pattern) su un piano, per dettagli sulle aste */
function makeTexturedPlane(w, h, draw) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  draw(ctx, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}
function makeCheckPatch() {
  return makeTexturedPlane(.34, .16, (ctx, w, h) => {
    ctx.fillStyle = '#c9a877'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(20,20,20,.55)'; ctx.lineWidth = 3;
    for (let x = -h; x < w + h; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(150,30,30,.5)'; ctx.lineWidth = 2;
    for (let x = -h; x < w + h; x += 44) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(245,245,240,.6)'; ctx.lineWidth = 1.5;
    for (let y = 10; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  });
}
function makeLetterLogo(letter, color) {
  return makeTexturedPlane(.16, .16, (ctx, w, h) => {
    ctx.font = '700 84px Georgia, serif';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(letter, w / 2, h / 2 + 4);
  });
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

const L_LENTI = { text: 'Lenti', side: 'r', title: 'Lenti di qualità',
  info: 'Lenti con protezione UV 100% e ottima resistenza ai graffi, per una visione nitida in ogni condizione di luce.' };
const L_PONTE = { text: 'Ponte', side: 'l', title: 'Ponte anatomico',
  info: 'Distribuisce il peso della montatura in modo uniforme sul naso, per un comfort duraturo durante tutta la giornata.' };
const L_ASTE  = { text: 'Aste', side: 'r', title: 'Aste rinforzate',
  info: 'Cerniere solide e struttura resistente per una tenuta stabile sul viso, anche nell\'uso quotidiano.' };

/* --- forma "wayfarer classica": acetato spesso, lenti ovali staccate dal ponte --- */
function makeWayfarerClassic(frameColor) {
  const m = newModel();
  const black = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.3 });
  const gold = goldMat(), lens = lensMat(0x1d2f3d, .58);

  const outer = flattenTop(superPoints(.80, .56, 2.7, .26, 128), .56, .9, .48);
  const inner = flattenTop(superPoints(.62, .38, 2.5, .24, 128), .38, .88, .46).map(p => new THREE.Vector2(p.x, p.y - .05));
  const rimShape = shapeFrom(outer); rimShape.holes.push(pathFrom(inner));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .19, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 4, steps: 1 });
  rimGeo.translate(0, 0, -.095);
  const lensGeo = new THREE.ShapeGeometry(shapeFrom(inner.map(p => p.clone().multiplyScalar(1.04))));

  for (const [sd, id] of [[-1, 'L'], [1, 'R']]) {
    const rim = new THREE.Mesh(rimGeo, black);  rim.position.set(sd * 1.0, 0, 0);   rim.rotation.z = sd * .04;
    const ln  = new THREE.Mesh(lensGeo, lens);  ln.position.set(sd * 1.0, 0, .02); ln.rotation.z = sd * .04;
    m.add('rim' + id, rim, [sd * .9, .35, .5], [.15, sd * .35, -sd * .1], .08);
    m.add('lens' + id, ln, [sd * .6, -.1, 1.9], [0, sd * .15, 0], 0);

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.6], [-sd * .02, 0, -2.1], [-sd * .05, -.15, -2.5], [-sd * .06, -.4, -2.75]];
    const temple = new THREE.Mesh(tube(curve, .058, 60, 12), black);
    temple.position.set(sd * 1.74, .2, -.02); temple.scale.set(.75, 1.7, 1);
    m.add('temple' + id, temple, [sd * 1.1, .1, -1.3], [0, -sd * .25, 0], .03);

    const rivet = new THREE.Mesh(new THREE.SphereGeometry(.058, 20, 16), gold);
    rivet.position.set(sd * 1.69, .19, .13); rivet.scale.set(1, 1, .5);
    m.add('rivet' + id, rivet, [sd * 1.5, .9, 1.2], [0, 0, sd * 1.5], .2);
  }
  const bridge = new THREE.Mesh(tube([[-.19, .30, 0], [-.09, .38, 0], [.09, .38, 0], [.19, .30, 0]], .075, 32, 12), black);
  m.add('bridge', bridge, [0, 1.3, .9], [.5, 0, 0], .15);

  m.frameMat = black;
  m.labels = [
    { ...L_LENTI, part: 'lensR' },
    { text: 'Montatura', side: 'l', part: 'rimL', title: 'Montatura in acetato', info: 'Acetato spesso e resistente, rifinito a mano per una superficie lucida e curata nei minimi dettagli.' },
    { ...L_ASTE, part: 'templeR' },
    { ...L_PONTE, part: 'bridge' },
    { text: 'Dettagli', side: 'l', part: 'rivetL', title: 'Dettagli metallici', info: 'Piccoli dettagli in metallo che aggiungono carattere alla montatura e ne accentuano la solidità costruttiva.' }
  ];
  return m;
}

/* --- forma "rotonda classica": metallo sottile, naselli regolabili --- */
function makeRoundClassic(frameColor) {
  const m = newModel();
  const metal = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 1, roughness: .25, envMapIntensity: 1.4 });
  const lens = lensMat(0x2a4658, .5);
  const pad = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .2, transparent: true, opacity: .6, clearcoat: 1 });
  const ringGeo = new THREE.TorusGeometry(.8, .034, 16, 96), lensGeo = new THREE.CircleGeometry(.79, 64);

  for (const [sd, id] of [[-1, 'L'], [1, 'R']]) {
    const ring = new THREE.Mesh(ringGeo, metal); ring.position.set(sd * .95, 0, 0);
    m.add('ring' + id, ring, [sd * .9, .3, .7], [.1, sd * .3, 0], .08);

    const ln = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * .95, 0, 0);
    m.add('lens' + id, ln, [sd * .5, -.1, 2.0], [0, sd * .15, 0], 0);

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.8], [-sd * .04, -.05, -2.3], [-sd * .06, -.3, -2.6]];
    const temple = new THREE.Mesh(tube(curve, .03, 60, 8), metal);
    temple.position.set(sd * 1.76, .1, 0);
    m.add('temple' + id, temple, [sd * 1.1, 0, -1.3], [0, -sd * .25, 0], .03);

    const hinge = new THREE.Mesh(new THREE.SphereGeometry(.048, 16, 12), metal);
    hinge.position.set(sd * 1.77, .1, 0);
    m.add('hinge' + id, hinge, [sd * 1.4, .7, .6], [0, 0, 0], .2);

    const padG = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.06, 16, 12), pad); ball.scale.set(.7, 1.4, .5); ball.position.set(sd * .2, -.3, -.1);
    const arm = new THREE.Mesh(tube([[sd * .11, -.05, 0], [sd * .17, -.18, -.06], [sd * .2, -.3, -.1]], .014, 12, 6), metal);
    padG.add(ball, arm);
    m.add('pad' + id, padG, [sd * .3, -1.3, .3], [0, 0, 0], .2);
  }
  const bridge = new THREE.Mesh(tube([[-.11, .1, 0], [-.06, .3, 0], [.06, .3, 0], [.11, .1, 0]], .03, 32, 8), metal);
  m.add('bridge', bridge, [0, 1.3, .6], [.5, 0, 0], .15);

  m.frameMat = metal;
  m.labels = [
    { ...L_LENTI, part: 'lensR' },
    { text: 'Montatura', side: 'l', part: 'ringL', title: 'Montatura in metallo', info: 'Metallo sottile e leggero, elegante da indossare e resistente all\'uso quotidiano.' },
    { ...L_ASTE, part: 'templeR' },
    { text: 'Naselli', side: 'l', part: 'padL', title: 'Naselli regolabili', info: 'Naselli che si adattano alla forma del naso per una calzata su misura, comoda anche per molte ore.' },
    { ...L_PONTE, part: 'bridge' }
  ];
  return m;
}

function buildModel(color) {
  switch (cfg.shape) {
    case 'round': return makeRoundClassic(color);
    case 'square': return makeSquareClassic(color, cfg.detail);
    case 'oversized': return makeOversizedClassic(color);
    case 'rhinestone': return makeRhinestoneClassic(color);
    case 'pantos': return makePantosClassic(color);
    case 'wraparound': return makeWraparoundClassic(color, cfg.detail);
    default: return makeWayfarerClassic(color);
  }
}

/* --- quadrata spessa: Burberry (check sulle aste) / Richmond (barra e logo dorati) --- */
function makeSquareClassic(frameColor, detail) {
  const m = newModel();
  const black = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: .18, metalness: 0, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.3 });
  const gold = goldMat(), lens = lensMat(detail === 'richmond' ? 0x33402c : 0x2b2b2b, .58);

  const outer = flattenBoth(superPoints(.86, .62, 5.2, .1, 128), .62, .92, .4, .88, .4);
  const inner = flattenBoth(superPoints(.68, .44, 4.6, .08, 128), .44, .9, .38, .86, .38).map(p => new THREE.Vector2(p.x, p.y - .04));
  const rimShape = shapeFrom(outer); rimShape.holes.push(pathFrom(inner));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .2, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 4, steps: 1 });
  rimGeo.translate(0, 0, -.1);
  const lensGeo = new THREE.ShapeGeometry(shapeFrom(inner.map(p => p.clone().multiplyScalar(1.04))));

  for (const [sd, id] of [[-1, 'L'], [1, 'R']]) {
    const rim = new THREE.Mesh(rimGeo, black); rim.position.set(sd * 1.05, 0, 0);
    const ln  = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * 1.05, 0, .02);
    m.add('rim' + id, rim, [sd * .9, .35, .5], [.15, sd * .35, -sd * .1], .08);
    m.add('lens' + id, ln, [sd * .6, -.1, 1.9], [0, sd * .15, 0], 0);

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.6], [-sd * .02, 0, -2.1], [-sd * .05, -.15, -2.5], [-sd * .06, -.4, -2.75]];
    const temple = new THREE.Mesh(tube(curve, .06, 60, 12), black);
    temple.position.set(sd * 1.82, .18, -.02); temple.scale.set(.75, 1.7, 1);
    m.add('temple' + id, temple, [sd * 1.1, .1, -1.3], [0, -sd * .25, 0], .03);

    if (detail === 'richmond' && sd === 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.06, .3, .04), gold);
      bar.rotation.z = Math.PI / 2; bar.position.set(1.9, .18, .05);
      temple.add(bar.clone().position.set(0, 0, .05));
      const logo = makeLetterLogo('R', '#f4f0e6'); logo.position.set(-.4, 0, .05);
      temple.add(logo);
    }
    if (detail === 'burberry' && sd === 1) {
      const patch = makeCheckPatch(); patch.rotation.y = Math.PI / 2 - .2; patch.position.set(-.55, -.02, .06);
      temple.add(patch);
    }
  }
  const bridge = new THREE.Mesh(tube([[-.22, .32, 0], [-.1, .4, 0], [.1, .4, 0], [.22, .32, 0]], .078, 32, 12), black);
  m.add('bridge', bridge, [0, 1.3, .9], [.5, 0, 0], .15);

  m.frameMat = black;
  m.labels = [
    { ...L_LENTI, part: 'lensR' },
    { text: 'Montatura', side: 'l', part: 'rimL', title: 'Montatura squadrata', info: 'Acetato spesso e resistente, dalla linea decisa e riconoscibile.' },
    { ...L_ASTE, part: 'templeR' },
    { ...L_PONTE, part: 'bridge' }
  ];
  return m;
}

/* --- oversize: Max Mara, con barretta dorata sul ponte --- */
function makeOversizedClassic(frameColor) {
  const m = newModel();
  const black = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: .16, metalness: 0, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.3 });
  const gold = goldMat(), lens = lensMat(0x4a3f52, .5);

  const outer = flattenTop(superPoints(1.08, .74, 3.6, .14, 128), .74, .93, .5);
  const inner = flattenTop(superPoints(.88, .54, 3.2, .12, 128), .54, .9, .48).map(p => new THREE.Vector2(p.x, p.y - .05));
  const rimShape = shapeFrom(outer); rimShape.holes.push(pathFrom(inner));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .18, bevelEnabled: true, bevelThickness: .038, bevelSize: .032, bevelSegments: 4, steps: 1 });
  rimGeo.translate(0, 0, -.09);
  const lensGeo = new THREE.ShapeGeometry(shapeFrom(inner.map(p => p.clone().multiplyScalar(1.04))));

  for (const [sd, id] of [[-1, 'L'], [1, 'R']]) {
    const rim = new THREE.Mesh(rimGeo, black); rim.position.set(sd * 1.18, 0, 0);
    const ln  = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * 1.18, 0, .02);
    m.add('rim' + id, rim, [sd * .9, .35, .5], [.15, sd * .35, -sd * .1], .08);
    m.add('lens' + id, ln, [sd * .6, -.1, 1.9], [0, sd * .15, 0], 0);

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.6], [-sd * .02, 0, -2.1], [-sd * .05, -.15, -2.5], [-sd * .06, -.4, -2.75]];
    const temple = new THREE.Mesh(tube(curve, .055, 60, 12), black);
    temple.position.set(sd * 2.0, .16, -.02); temple.scale.set(.75, 1.7, 1);
    m.add('temple' + id, temple, [sd * 1.1, .1, -1.3], [0, -sd * .25, 0], .03);
  }
  const bridge = new THREE.Mesh(tube([[-.24, .36, 0], [-.1, .46, 0], [.1, .46, 0], [.24, .36, 0]], .085, 32, 12), black);
  m.add('bridge', bridge, [0, 1.3, .9], [.5, 0, 0], .15);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.32, .05, .05), gold);
  bar.position.set(0, .5, .03);
  m.add('bar', bar, [0, .8, .8], [0, 0, .6], .18);

  m.frameMat = black;
  m.labels = [
    { ...L_LENTI, part: 'lensR' },
    { text: 'Montatura', side: 'l', part: 'rimL', title: 'Montatura oversize', info: 'Forma generosa e avvolgente in acetato, per un effetto scenico ed elegante.' },
    { ...L_ASTE, part: 'templeR' },
    { text: 'Dettaglio dorato', side: 'l', part: 'bar', title: 'Accento metallico', info: 'Un dettaglio dorato sul ponte che impreziosisce la montatura con un tocco luxury.' }
  ];
  return m;
}

/* --- con strass: Genny, lenti quasi trasparenti (vista) e piccoli cristalli --- */
function makeRhinestoneClassic(frameColor) {
  const m = newModel();
  const black = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: .2, metalness: 0, clearcoat: 1, clearcoatRoughness: .07, envMapIntensity: 1.3 });
  const gold = goldMat();
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: .3, roughness: .05, clearcoat: 1, envMapIntensity: 2 });
  const lens = lensMat(0xdfe7ec, .16);

  const outer = flattenBoth(superPoints(.78, .58, 4.6, .1, 128), .58, .9, .42, .88, .42);
  const inner = flattenBoth(superPoints(.60, .40, 4, .08, 128), .40, .88, .4, .84, .4).map(p => new THREE.Vector2(p.x, p.y - .04));
  const rimShape = shapeFrom(outer); rimShape.holes.push(pathFrom(inner));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .17, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 4, steps: 1 });
  rimGeo.translate(0, 0, -.085);
  const lensGeo = new THREE.ShapeGeometry(shapeFrom(inner.map(p => p.clone().multiplyScalar(1.04))));

  const outerTop = outer.filter(p => p.y > .32 * .58);
  for (const [sd, id] of [[-1, 'L'], [1, 'R']]) {
    const rim = new THREE.Mesh(rimGeo, black); rim.position.set(sd * .98, 0, 0);
    const ln  = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * .98, 0, .02);
    m.add('rim' + id, rim, [sd * .9, .35, .5], [.15, sd * .35, -sd * .1], .08);
    m.add('lens' + id, ln, [sd * .6, -.1, 1.9], [0, sd * .15, 0], 0);

    const gems = new THREE.Group();
    outerTop.filter((_, i) => i % 14 === 0).forEach(p => {
      const g = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 8), crystal);
      g.position.set(p.x, p.y - .015, .09);
      gems.add(g);
    });
    gems.position.set(sd * .98, 0, 0);
    m.add('gems' + id, gems, [sd * .9, .4, .55], [.15, sd * .35, -sd * .1], .1);

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.6], [-sd * .02, 0, -2.1], [-sd * .05, -.15, -2.5], [-sd * .06, -.4, -2.75]];
    const temple = new THREE.Mesh(tube(curve, .05, 60, 12), black);
    temple.position.set(sd * 1.7, .18, -.02); temple.scale.set(.75, 1.7, 1);
    m.add('temple' + id, temple, [sd * 1.1, .1, -1.3], [0, -sd * .25, 0], .03);

    if (sd === 1) {
      const logo = makeLetterLogo('G', '#d4af37'); logo.position.set(-.35, 0, .05);
      temple.add(logo);
    }
  }
  const bridge = new THREE.Mesh(tube([[-.2, .3, 0], [-.09, .38, 0], [.09, .38, 0], [.2, .3, 0]], .072, 32, 12), black);
  m.add('bridge', bridge, [0, 1.3, .9], [.5, 0, 0], .15);

  m.frameMat = black;
  m.labels = [
    { text: 'Lenti', side: 'r', part: 'lensR', title: 'Lenti da vista', info: 'Lenti trasparenti di alta qualità, pronte per essere personalizzate con la tua gradazione.' },
    { text: 'Montatura', side: 'l', part: 'rimL', title: 'Montatura gioiello', info: 'Acetato impreziosito da piccoli cristalli, per un accessorio che è anche gioiello.' },
    { ...L_ASTE, part: 'templeR' },
    { ...L_PONTE, part: 'bridge' }
  ];
  return m;
}

/* --- rotonda "pantos": Polar, plastica opaca stile classico --- */
function makePantosClassic(frameColor) {
  const m = newModel();
  const black = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: .42, metalness: 0, clearcoat: .3, clearcoatRoughness: .3, envMapIntensity: 1 });
  const lens = lensMat(0x33432c, .55);

  const outer = flattenTop(superPoints(.72, .64, 2.2, .1, 128), .64, .95, .62);
  const inner = flattenTop(superPoints(.56, .48, 2.1, .08, 128), .48, .93, .6).map(p => new THREE.Vector2(p.x, p.y - .03));
  const rimShape = shapeFrom(outer); rimShape.holes.push(pathFrom(inner));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .15, bevelEnabled: true, bevelThickness: .03, bevelSize: .026, bevelSegments: 4, steps: 1 });
  rimGeo.translate(0, 0, -.075);
  const lensGeo = new THREE.ShapeGeometry(shapeFrom(inner.map(p => p.clone().multiplyScalar(1.04))));

  for (const [sd, id] of [[-1, 'L'], [1, 'R']]) {
    const rim = new THREE.Mesh(rimGeo, black); rim.position.set(sd * .92, 0, 0);
    const ln  = new THREE.Mesh(lensGeo, lens); ln.position.set(sd * .92, 0, .02);
    m.add('rim' + id, rim, [sd * .9, .35, .5], [.15, sd * .35, -sd * .1], .08);
    m.add('lens' + id, ln, [sd * .6, -.1, 1.9], [0, sd * .15, 0], 0);

    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.8], [-sd * .04, -.05, -2.3], [-sd * .06, -.3, -2.6]];
    const temple = new THREE.Mesh(tube(curve, .04, 60, 10), black);
    temple.position.set(sd * 1.6, .1, 0);
    m.add('temple' + id, temple, [sd * 1.1, .05, -1.3], [0, -sd * .25, 0], .03);
  }
  const bridge = new THREE.Mesh(tube([[-.13, .28, 0], [-.06, .36, 0], [.06, .36, 0], [.13, .28, 0]], .06, 32, 10), black);
  m.add('bridge', bridge, [0, 1.2, .7], [.5, 0, 0], .15);

  m.frameMat = black;
  m.labels = [
    { ...L_LENTI, part: 'lensR' },
    { text: 'Montatura', side: 'l', part: 'rimL', title: 'Montatura rotonda', info: 'Plastica opaca dalla forma rotonda e senza tempo, comoda e leggera da indossare.' },
    { ...L_ASTE, part: 'templeR' },
    { ...L_PONTE, part: 'bridge' }
  ];
  return m;
}

/* --- wraparound sportivo: RH+ / Polaroid, lente unica avvolgente --- */
function curveZ(geo, amount) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) - amount * (x * x));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}
function makeWraparoundClassic(frameColor, detail) {
  const m = newModel();
  const isPolaroid = detail === 'polaroid';
  const frameMat = new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: isPolaroid ? .55 : .3, metalness: isPolaroid ? 0 : .5, clearcoat: .5, envMapIntensity: 1.2 });
  const lensColor = isPolaroid ? 0x3a3f42 : 0x2f6b52;
  const lens = new THREE.MeshPhysicalMaterial({ color: lensColor, roughness: .1, metalness: isPolaroid ? .1 : .55, transparent: true, opacity: isPolaroid ? .62 : .5, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 2 });

  const shieldOuter = flattenBoth(superPoints(1.55, .5, 3.4, .04, 160), .5, .85, .3, .8, .3);
  const shieldInner = flattenBoth(superPoints(1.4, .34, 3.2, .04, 160), .34, .82, .28, .78, .28);
  const shieldShape = shapeFrom(shieldOuter); shieldShape.holes.push(pathFrom(shieldInner));
  const frameGeo = new THREE.ExtrudeGeometry(shieldShape, { depth: .1, bevelEnabled: true, bevelThickness: .02, bevelSize: .018, bevelSegments: 3, steps: 1 });
  frameGeo.translate(0, 0, -.05);
  curveZ(frameGeo, .045);
  const lensShape = shapeFrom(shieldInner.map(p => p.clone().multiplyScalar(1.03)));
  const lensGeo = new THREE.ShapeGeometry(lensShape, 32);
  curveZ(lensGeo, .045);

  const frame = new THREE.Mesh(frameGeo, frameMat);
  const ln = new THREE.Mesh(lensGeo, lens); ln.position.z = .02;
  m.add('frame', frame, [0, .3, .6], [.2, 0, 0], .1);
  m.add('lens', ln, [0, -.1, 1.6], [0, 0, 0], 0);

  for (const sd of [-1, 1]) {
    const curve = [[0, 0, 0], [0, 0, -.6], [0, 0, -1.7], [-sd * .03, -.1, -2.2], [-sd * .06, -.32, -2.55]];
    const temple = new THREE.Mesh(tube(curve, .045, 60, 10), frameMat);
    temple.position.set(sd * 1.6, .05, -.1);
    m.add('temple' + (sd < 0 ? 'L' : 'R'), temple, [sd * 1.1, .05, -1.3], [0, -sd * .25, 0], .12);

    if (!isPolaroid) {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(.05, .045, .35, 12), new THREE.MeshStandardMaterial({ color: 0x2f5c3e, roughness: .6 }));
      tip.rotation.x = Math.PI / 2; tip.position.set(sd * 1.9, -.15, -2.4);
      m.add('tip' + (sd < 0 ? 'L' : 'R'), tip, [0, -.1, -.4], [0, 0, 0], .2);
    }
  }

  m.frameMat = frameMat;
  m.labels = [
    { text: 'Lente', side: 'r', part: 'lens', title: 'Lente unica avvolgente', info: 'Un\'unica lente panoramica che offre massima protezione e un campo visivo più ampio.' },
    { text: 'Montatura', side: 'l', part: 'frame', title: 'Montatura sportiva', info: 'Leggera e avvolgente, pensata per l\'uso sportivo e per restare salda anche in movimento.' },
    { ...L_ASTE, part: 'templeR' }
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

const models = [];

/* ============================================================
   HERO — occhiale frontale, fermo a destra, leggera rotazione idle
   ============================================================ */
(function initHero() {
  const stage = document.getElementById('cgHeroStage');
  const canvas = document.getElementById('cgHeroCanvas');
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

  const model = buildModel(cfg.colors[0].hex);
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
  const track  = document.getElementById('cgStoryTrack');
  const sticky = document.getElementById('cgStorySticky');
  const canvas = document.getElementById('cgStoryCanvas');
  if (!track || !sticky || !canvas) return;
  const steps = [...sticky.querySelectorAll('.cg-step:not(.cg-step--hover)')];

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

  const model = buildModel(cfg.colors[0].hex);
  scene.add(model.group);
  models.push(model);

  const labelEls = model.labels.map(l => {
    const el = document.createElement('div');
    el.className = 'cg-label ' + l.side; el.innerHTML = '<span>' + l.text + '</span>';
    sticky.appendChild(el);
    el.addEventListener('mouseenter', () => showHoverInfo(l));
    el.addEventListener('mouseleave', hideHoverInfo);
    return { el, part: model.parts.find(p => p.name === l.part) };
  });

  const hoverInfo = document.getElementById('cgHoverInfo');
  const hoverEyebrow = document.getElementById('cgHoverEyebrow');
  const hoverTitle = document.getElementById('cgHoverTitle');
  const hoverText = document.getElementById('cgHoverText');
  let hovering = false;
  function showHoverInfo(l) {
    hovering = true;
    hoverEyebrow.textContent = l.text;
    hoverTitle.textContent = l.title;
    hoverText.textContent = l.info;
    steps.forEach(s => s.classList.remove('on'));
    hoverInfo.classList.add('on');
  }
  function hideHoverInfo() {
    hovering = false;
    hoverInfo.classList.remove('on');
    steps.forEach((s, i) => s.classList.toggle('on', i === stepNow));
  }

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

  let active = false, running = false, stepNow = -1;
  const v3 = new THREE.Vector3();

  function tick(now) {
    if (!active) { running = false; return; }
    requestAnimationFrame(tick);
    const time = now / 1000;
    const p = getProgress();

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
    if (idx !== stepNow) { stepNow = idx; if (!hovering) steps.forEach((s, i) => s.classList.toggle('on', i === idx)); }

    const la = smooth(.68, .92, s2);
    for (const { el, part } of labelEls) {
      el.style.opacity = la;
      el.style.pointerEvents = la > .5 ? 'auto' : 'none';
      if (la <= 0) continue;
      part.obj.getWorldPosition(v3).project(camera);
      el.style.transform = `translate(${(v3.x * .5 + .5) * W}px, ${(-v3.y * .5 + .5) * H}px)`;
    }

    renderer.render(scene, camera);
  }

  new IntersectionObserver(([en]) => {
    active = en.isIntersecting;
    if (active && !running) { running = true; requestAnimationFrame(tick); }
  }, { rootMargin: '10% 0px' }).observe(track);
})();

/* ============================================================
   COLORI — cambia il colore della montatura in hero e nel racconto
   ============================================================ */
(function initColors() {
  const wrap = document.getElementById('cgColors');
  if (!wrap) return;
  cfg.colors.forEach((c, i) => {
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
