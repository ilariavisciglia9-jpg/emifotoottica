/* =========================================================
   EmiFotoOttica — Animazioni 3D scroll-driven per le pagine servizio
   Uso: <section class="svc3d" data-scene="cuscino" data-photos="a.jpg,b.jpg"> ... </section>
   Scene disponibili: cuscino, borsa, tazza, cover, puzzle, magnete, tela, piuma, calendario, fotolibro,
   tessera, matrimoni, scuole, piuma, tela, calendario, fotolibro
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- Foto casuale ---------- */
function loadImage(src, timeout = 9000) {
  return new Promise((res, rej) => {
    const i = new Image();
    try { if (!src.startsWith('blob:') && new URL(src, location.href).origin !== location.origin) i.crossOrigin = 'anonymous'; } catch (e) { }
    const t = setTimeout(() => rej(new Error('timeout')), timeout);
    i.onload = () => { clearTimeout(t); res(i); };
    i.onerror = e => { clearTimeout(t); rej(e); };
    i.src = src;
  });
}
function drawCover(ctx, img, W, H, o = {}) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const z = o.zoom || 1, r = Math.max(W / img.width, H / img.height) * z, w = img.width * r, h = img.height * r;
  ctx.save();
  if (o.filter && 'filter' in ctx) ctx.filter = o.filter; // variante (seppia, b/n...) dove supportato
  ctx.drawImage(img, (W - w) / 2 + (o.ox || 0) * (w - W) / 2, (H - h) / 2 + (o.oy || 0) * (h - H) / 2, w, h);
  ctx.restore();
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
  // Una sola foto "corrente", disegnata (ritaglio cover) su più texture con proporzioni diverse
  const targets = [];
  let current = null;
  function paint(t) {
    drawCover(t.canvas.getContext('2d'), current, t.canvas.width, t.canvas.height, t.opts);
    t.tex.needsUpdate = true;
  }
  function set(src) {
    const k = Math.min(1, 2048 / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    current = c; targets.forEach(paint);
  }
  function target(aspect = 1, opts = {}) {
    const canvas = document.createElement('canvas');
    if (aspect >= 1) { canvas.width = 1024; canvas.height = Math.round(1024 / aspect); }
    else { canvas.height = 1024; canvas.width = Math.round(1024 * aspect); }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const t = { canvas, tex, opts }; targets.push(t);
    if (current) paint(t);
    return tex;
  }
  let fallbackK = Math.floor(Math.random() * 4);
  function fallback() {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    paintFallback(c.getContext('2d'), 1024, fallbackK++); set(c);
  }
  fallback(); // subito una foto visibile, poi la sostituisce con quella vera appena caricata

  const photos = list.slice().sort(() => Math.random() - .5);
  let idx = -1, localDead = !photos.length, token = 0;

  // Foto a caso: prima quelle locali (data-photos), altrimenti una foto casuale online
  async function next() {
    const my = ++token;
    if (!localDead) {
      for (let tries = 0; tries < photos.length; tries++) {
        idx = (idx + 1) % photos.length;
        try { const img = await loadImage(photos[idx]); if (my === token) set(img); return; } catch (e) { /* prova la successiva */ }
      }
      localDead = true;
    }
    try {
      const seed = 'emi' + Math.floor(Math.random() * 1e9);
      const img = await loadImage('https://picsum.photos/seed/' + seed + '/1200/1200');
      if (my === token) set(img); return;
    } catch (e) { /* offline: usa la foto disegnata */ }
    if (my === token) fallback();
  }

  // Foto del cliente: resta nel browser, non viene inviata a nessun server
  async function fromFile(file) {
    if (!file || !file.type.startsWith('image/')) return false;
    const my = ++token, url = URL.createObjectURL(file);
    try { const img = await loadImage(url, 30000); if (my === token) set(img); return true; }
    catch (e) { return false; }
    finally { URL.revokeObjectURL(url); }
  }
  return { target, next, fromFile };
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
   Helper comuni alle scene
   ========================================================= */
// Fasi dello scroll (uguali per tutte le scene, così le didascalie restano allineate)
function phases(p) {
  return {
    p,
    enter: ease(seg(p, 0, .16)),
    intro: ease(seg(p, 0, .4)),
    fly: ease(seg(p, .16, .4)),
    land: ease(seg(p, .4, .48)),
    press: seg(p, .48, .74),
    after: ease(seg(p, .74, .86)),
    show: ease(seg(p, .86, 1))
  };
}
const easeOutBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// Materiale "stampabile": colore base finché la stampa (uReveal) non scorre dall'alto verso il basso
function printMaterial(tex, { rect = [0, 0, 1, 1], base = '#ffffff', roughness = .5, metalness = 0, bump = null, bumpScale = .15, glow = [1, .62, .3] } = {}) {
  const U = {
    uReveal: { value: -.1 }, uGlow: { value: 0 },
    uBase: { value: new THREE.Color(base) }, uRect: { value: new THREE.Vector4(...rect) }, uGlowCol: { value: new THREE.Vector3(...glow) }
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness, metalness, bumpMap: bump, bumpScale });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = 'uniform float uReveal; uniform float uGlow; uniform vec3 uBase; uniform vec4 uRect; uniform vec3 uGlowCol;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 pUv = (vMapUv - uRect.xy) / (uRect.zw - uRect.xy);
        float soft = smoothstep(0.0,0.008,pUv.x)*smoothstep(0.0,0.008,1.0-pUv.x)*smoothstep(0.0,0.008,pUv.y)*smoothstep(0.0,0.008,1.0-pUv.y);
        vec3 photoC = texture2D(map, clamp(pUv, 0.0, 1.0)).rgb;
        float tt = 1.0 - vMapUv.y;
        float rev = 1.0 - smoothstep(uReveal - 0.05, uReveal, tt);
        diffuseColor.rgb *= mix(uBase, photoC, soft * rev);
        float heatBand = exp(-pow((tt - uReveal) * 14.0, 2.0)) * step(0.001, soft);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * heatBand * uGlowCol;`);
  };
  m.userData.U = U;
  return m;
}
function setPrint(mat, press) {
  const U = mat.userData.U;
  U.uReveal.value = lerp(-0.08, 1.08, ease(press));
  U.uGlow.value = Math.sin(Math.PI * press) * 1.6;
}

// Foglio con la foto che vola sul prodotto (pivot sul bordo alto, per l'effetto "strappo")
function makeSheet(tex, w, h, segs = 40) {
  const geo = new THREE.PlaneGeometry(w, h, segs, segs);
  geo.translate(0, -h / 2, 0);
  const base = Float32Array.from(geo.attributes.position.array);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .45, side: THREE.DoubleSide, transparent: true, emissive: 0xffffff, emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  const pivot = new THREE.Group(); pivot.add(mesh);
  let key = '';
  return {
    pivot, mat, w, h,
    // fn(x, y) -> [x, y, z] nello spazio del pivot; k = chiave per non ricalcolare inutilmente
    shape(fn, k) {
      if (k === key) return; key = k;
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const r = fn(base[i * 3], base[i * 3 + 1]); p.setXYZ(i, r[0], r[1], r[2]); }
      p.needsUpdate = true; geo.computeVertexNormals();
    },
    // volo: partenza in alto a destra -> sospeso davanti -> appoggiato
    fly(ph, hover, target, start = new THREE.Vector3(1.35, 1.75, 1.1)) {
      pivot.position.lerpVectors(start, hover, ph.fly).lerp(target, ph.land);
      pivot.rotation.set(lerp(.35, 0, ph.fly), lerp(-.9, 0, ph.fly), lerp(.3, 0, ph.fly));
      pivot.scale.setScalar(lerp(.5, 1, ph.fly));
    },
    // l'inchiostro passa dalla carta al prodotto: il foglio si sbianca e diventa traslucido
    ink(ph, fade) {
      const inkOut = seg(ph.press, .05, .75);
      mat.emissiveIntensity = inkOut * .75;
      mat.opacity = ph.enter * lerp(1, .4, inkOut) * (1 - fade);
      pivot.visible = mat.opacity > .01;
    },
    peel(t) { pivot.rotation.x += -t * 2.1; pivot.position.y += t * .5; pivot.position.z += t * .5; }
  };
}

function floorShadow(scene, w = 2.6, d = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2 + .3; scene.add(m);
  return (x, y, s, op) => { m.position.set(x, y, 0); m.scale.setScalar(s); m.material.opacity = op; };
}

function rigMotion(rig, ph, t, L, mouse, o = {}) {
  const s = L.s * (o.fit || 1);
  rig.position.set(L.x, L.y + (o.yOff || 0) * s + Math.sin(t * 1.1) * .035, 0);
  rig.scale.setScalar(s * lerp(.82, 1, ph.enter));
  rig.rotation.y = lerp(o.ry0 ?? -.7, 0, ph.intro) + ph.show * (o.ryShow ?? .5) + mouse.x * .12;
  rig.rotation.x = lerp(.18, 0, ph.intro) + ph.show * (o.rxShow ?? -.08) + mouse.y * .06;
  return s;
}

function roundedRect(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// UV delle facce piane (gruppo 0 di ExtrudeGeometry) normalizzate sul rettangolo indicato
function planarUV(geo, x0, y0, w, h) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / w, (p.getY(i) - y0) / h);
  uv.needsUpdate = true;
}
function capsOnlyUV(geo, x0, y0, w, h) {
  // applica l'UV planare solo ai tappi (gruppo 0); i lati restano col materiale 1
  const g = geo.groups[0], p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = g.start; i < g.start + g.count; i++) uv.setXY(i, (p.getX(i) - x0) / w, (p.getY(i) - y0) / h);
  uv.needsUpdate = true;
}

/* =========================================================
   SCENA "morbida": CUSCINO e BORSA — la foto si posa sul tessuto e viene stampata
   ========================================================= */
function makeSoftScene(o) {
  return function (ctx) {
    const { scene, photo } = ctx;
    const W = o.w, H = o.h, D = o.D, PINCH = o.pinch, PRINT = o.print;
    const puff = (u, v) => Math.pow(Math.max(0, 1 - u * u), .55) * Math.pow(Math.max(0, 1 - v * v), .55);
    const tex = photo.target(W / H);

    function half(segments = 80) {
      const g = new THREE.PlaneGeometry(2, 2, segments, segments), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), v = p.getY(i);
        p.setXYZ(i, W * u * (1 - PINCH * (1 - v * v)), H * v * (1 - PINCH * (1 - u * u)), D * puff(u, v));
      }
      g.computeVertexNormals(); return g;
    }
    const weave = weaveTexture();
    const fabric = new THREE.Color(o.fabric);
    const m0 = (1 - PRINT) / 2;
    const frontMat = printMaterial(tex, { rect: [m0, m0, 1 - m0, 1 - m0], base: o.fabric, roughness: .9, bump: weave, bumpScale: .15 });
    const backMat = new THREE.MeshStandardMaterial({ color: fabric, roughness: .92, bumpMap: weave, bumpScale: .15 });

    const rig = new THREE.Group(); scene.add(rig);
    const body = new THREE.Group(); rig.add(body);
    const front = new THREE.Mesh(half(), frontMat);
    const back = new THREE.Mesh(half(), backMat); back.rotation.y = Math.PI;
    body.add(front, back);

    // cucitura / cordoncino
    const pts = [];
    for (let i = 0; i < 160; i++) {
      const t = i / 160 * 4, s = t % 1, side = Math.floor(t);
      let u, v;
      if (side === 0) { u = -1 + 2 * s; v = -1; } else if (side === 1) { u = 1; v = -1 + 2 * s; }
      else if (side === 2) { u = 1 - 2 * s; v = 1; } else { u = -1; v = 1 - 2 * s; }
      pts.push(new THREE.Vector3(W * u * (1 - PINCH * (1 - v * v)), H * v * (1 - PINCH * (1 - u * u)), 0));
    }
    const seamMat = new THREE.MeshStandardMaterial({ color: fabric.clone().multiplyScalar(.92), roughness: .85 });
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320, o.piping, 8, true), seamMat));

    // manici (borsa)
    if (o.handles) {
      const hMat = new THREE.MeshStandardMaterial({ color: fabric.clone().multiplyScalar(.9), roughness: .9, bumpMap: weave, bumpScale: .15 });
      [1, -1].forEach(side => {
        const z = side * .03, a = W * .42;
        const c = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-a, H * .9, z), new THREE.Vector3(-a * .98, H + .3, z * 1.5),
          new THREE.Vector3(-a * .6, H + .72, z * 2), new THREE.Vector3(0, H + .84, z * 2),
          new THREE.Vector3(a * .6, H + .72, z * 2), new THREE.Vector3(a * .98, H + .3, z * 1.5), new THREE.Vector3(a, H * .9, z)]);
        const strap = new THREE.Mesh(new THREE.TubeGeometry(c, 80, .045, 10, false), hMat);
        strap.scale.set(1, 1, 1); body.add(strap);
      });
    }

    const shadow = floorShadow(scene, W * 2.6, 1);
    const sheet = makeSheet(tex, 2 * W * PRINT, 2 * H * PRINT);
    rig.add(sheet.pivot);

    const mouse = { x: 0, y: 0 };
    ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

    return {
      update(p, t, L) {
        const ph = phases(p);
        const s = rigMotion(rig, ph, t, L, mouse, o);
        const squish = 1 - .28 * Math.sin(Math.PI * clamp(seg(p, .46, .8)));
        body.scale.z = squish;
        shadow(L.x, L.y + ((o.yOff || 0) - H - .22) * s, s, ph.enter);
        setPrint(frontMat, ph.press);

        sheet.fly(ph, new THREE.Vector3(0, H * PRINT, .75), new THREE.Vector3(0, H * PRINT, 0));
        const bend = ph.land * (1 - seg(ph.after, 0, .35));
        sheet.shape((x, y) => { const yy = y + H * PRINT; return [x, y, bend * (D * squish * puff(x / W, yy / H) + .012)]; },
          bend.toFixed(3) + squish.toFixed(3));
        sheet.peel(ph.after);
        sheet.ink(ph, seg(ph.after, .45, 1));
      }
    };
  };
}

/* =========================================================
   SCENA: TAZZA — la foto si avvolge attorno alla tazza
   ========================================================= */
function sceneTazza(ctx) {
  const { scene, photo } = ctx;
  const R = .78, HH = 1.9, PW = .45, rect = [.5 - PW / 2, .12, .5 + PW / 2, .88];
  const arc = 2 * Math.PI * R * PW, pH = HH * (rect[3] - rect[1]);
  const tex = photo.target(arc / pH);

  const rig = new THREE.Group(); scene.add(rig);
  const ceramic = new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: .16 });
  const outerMat = printMaterial(tex, { rect, base: '#fbfaf6', roughness: .16 });
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, R, HH, 128, 1, true, -Math.PI, Math.PI * 2), outerMat);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R - .06, R - .06, HH - .04, 96, 1, true),
    new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: .2, side: THREE.BackSide }));
  inner.position.y = .02;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R - .03, .03, 12, 128), ceramic);
  rim.rotation.x = Math.PI / 2; rim.position.y = HH / 2;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(R, R - .05, .08, 96), ceramic);
  bottom.position.y = -HH / 2 - .02;
  const floorIn = new THREE.Mesh(new THREE.CircleGeometry(R - .06, 64), new THREE.MeshStandardMaterial({ color: '#ebe8e1', roughness: .3 }));
  floorIn.rotation.x = -Math.PI / 2; floorIn.position.y = -HH / 2 + .12;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.44, .085, 24, 64, Math.PI), ceramic);
  handle.rotation.z = -Math.PI / 2; handle.position.set(R - .03, .05, 0);
  const mug = new THREE.Group(); mug.add(outer, inner, rim, bottom, floorIn, handle); rig.add(mug);

  const shadow = floorShadow(scene, 2.6, 1);
  const sheet = makeSheet(tex, arc, pH, 60);
  mug.add(sheet.pivot);
  const topY = -HH / 2 + rect[3] * HH;
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .95, ry0: -.9, ryShow: 0 });
      // vetrina finale: la tazza gira per mostrare la foto avvolta
      mug.rotation.y = -Math.sin(ph.show * Math.PI) * .75 + Math.sin(t * .5) * .05 * ph.show;
      shadow(L.x, L.y + (-HH / 2 - .2) * s, s, ph.enter);
      setPrint(outerMat, ph.press);

      const RR = R + .012;
      sheet.fly(ph, new THREE.Vector3(0, topY, .9), new THREE.Vector3(0, topY, 0));
      const wrap = ease(seg(p, .42, .5));
      const lift = ph.after * .25;
      sheet.shape((x, y) => {
        const a = x / RR, rr = RR + lift;
        return [lerp(x, rr * Math.sin(a), wrap), y, lerp(RR, rr * Math.cos(a), wrap)];
      }, wrap.toFixed(3) + lift.toFixed(3));
      sheet.ink(ph, seg(ph.after, .2, 1));
    }
  };
}

/* =========================================================
   SCENA: COVER SMARTPHONE — stampa sulla cover, poi la cover si aggancia al telefono
   ========================================================= */
function sceneCover(ctx) {
  const { scene, photo } = ctx;
  const PW = 1.12, PH = 2.3, RAD = .2, CW = PW + .08, CH = PH + .08;
  const tex = photo.target(CW / CH);
  const rig = new THREE.Group(); scene.add(rig);

  // telefono (il retro guarda verso +z)
  const phone = new THREE.Group(); rig.add(phone);
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(PW - .04, PH - .04, RAD - .02), { depth: .14, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 4, curveSegments: 16 });
  bodyGeo.translate(0, 0, -.07);
  phone.add(new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: .6, roughness: .32 })));
  const camX = -PW / 2 + .34, camY = PH / 2 - .34;
  const camMod = new THREE.Mesh(new RoundedBoxGeometry(.5, .5, .08, 4, .08), new THREE.MeshStandardMaterial({ color: '#1f2226', metalness: .5, roughness: .25 }));
  camMod.position.set(camX, camY, .12); phone.add(camMod);
  const glass = new THREE.MeshStandardMaterial({ color: '#0b0d12', metalness: .2, roughness: .05 });
  const ringM = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 1, roughness: .25 });
  [[-.11, .11], [-.11, -.11], [.11, .11]].forEach(([dx, dy]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .05, 32), ringM);
    ring.rotation.x = Math.PI / 2; ring.position.set(camX + dx, camY + dy, .17);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .052, 32), glass);
    lens.rotation.x = Math.PI / 2; lens.position.copy(ring.position);
    phone.add(ring, lens);
  });
  const flash = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .04, 16), new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#fff1c2', emissiveIntensity: .3 }));
  flash.rotation.x = Math.PI / 2; flash.position.set(camX + .11, camY - .11, .16); phone.add(flash);

  // cover: retro stampabile con foro fotocamera + bordo che abbraccia il telefono
  const cover = new THREE.Group(); rig.add(cover);
  const backShape = roundedRect(CW, CH, RAD + .03);
  backShape.holes.push(roundedRect(.6, .6, .12, camX, camY));
  const backGeo = new THREE.ExtrudeGeometry(backShape, { depth: .03, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 3, curveSegments: 16 });
  capsOnlyUV(backGeo, -CW / 2, -CH / 2, CW, CH);
  const printMat = printMaterial(tex, { base: '#f7f7f7', roughness: .28 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: .35 });
  const back = new THREE.Mesh(backGeo, [printMat, rimMat]);
  back.position.z = .1; cover.add(back);
  const frameShape = roundedRect(CW, CH, RAD + .03);
  frameShape.holes.push(roundedRect(PW - .01, PH - .01, RAD - .01));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: .2, bevelEnabled: true, bevelThickness: .01, bevelSize: .008, bevelSegments: 2, curveSegments: 16 }), rimMat);
  frame.position.z = -.1; cover.add(frame);

  const shadow = floorShadow(scene, 2.2, 1);
  const sheet = makeSheet(tex, CW, CH);
  cover.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .92, ry0: -.8, ryShow: .55, rxShow: -.1 });
      shadow(L.x, L.y + (-PH / 2 - .25) * s, s, ph.enter);
      // prima la cover è staccata davanti al telefono, poi si aggancia con un piccolo "scatto"
      const snap = easeOutBack(clamp(seg(p, .74, .88)));
      const zs = ease(seg(p, .74, .86)), click = Math.sin(seg(p, .84, .9) * Math.PI) * .04;
      cover.position.set(lerp(.25, 0, snap), lerp(.12, 0, snap), lerp(1.1, 0, zs) + click);
      cover.rotation.z = lerp(.06, 0, snap);
      phone.position.x = lerp(-.1, 0, snap);
      setPrint(printMat, ph.press);
      sheet.fly(ph, new THREE.Vector3(0, CH / 2, .7), new THREE.Vector3(0, CH / 2, .156));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.peel(seg(p, .72, .8));
      sheet.ink(ph, seg(p, .74, .8));
    }
  };
}

/* =========================================================
   SCENA: PUZZLE — stampa sul cartoncino, taglio in tessere e ricomposizione
   ========================================================= */
function scenePuzzle(ctx) {
  const { scene, photo } = ctx;
  const BW = 2.4, BH = 1.8, COLS = 5, ROWS = 4, pw = BW / COLS, phh = BH / ROWS;
  const tex = photo.target(BW / BH);
  const rig = new THREE.Group(); scene.add(rig);
  const board = new THREE.Group(); rig.add(board);
  const printMat = printMaterial(tex, { base: '#ffffff', roughness: .55 });
  const sideMat = new THREE.MeshStandardMaterial({ color: '#d8c6a2', roughness: .95 });

  // bordi con incastri: +1 linguetta verso l'esterno, -1 verso l'interno, 0 dritto
  const rnd = () => (Math.random() < .5 ? 1 : -1);
  const hE = [], vE = [];
  for (let r = 0; r < ROWS - 1; r++) { hE[r] = []; for (let c = 0; c < COLS; c++) hE[r][c] = rnd(); }
  for (let r = 0; r < ROWS; r++) { vE[r] = []; for (let c = 0; c < COLS - 1; c++) vE[r][c] = rnd(); }
  const K = [[.35, 0], [.40, 0, .42, .06, .38, .12], [.33, .20, .40, .28, .50, .28], [.60, .28, .67, .20, .62, .12], [.58, .06, .60, 0, .65, 0]];
  function edge(shape, ax, ay, bx, by, dir) {
    if (!dir) { shape.lineTo(bx, by); return; }
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L;
    const P = (u, v) => [ax + dx * u + nx * v * L * dir, ay + dy * u + ny * v * L * dir];
    shape.lineTo(...P(K[0][0], K[0][1]));
    for (let i = 1; i < K.length; i++) { const k = K[i]; shape.bezierCurveTo(...P(k[0], k[1]), ...P(k[2], k[3]), ...P(k[4], k[5])); }
    shape.lineTo(bx, by);
  }
  const pieces = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x0 = -BW / 2 + c * pw, y0 = -BH / 2 + r * phh, x1 = x0 + pw, y1 = y0 + phh;
    const s = new THREE.Shape(); s.moveTo(x0, y0);
    edge(s, x0, y0, x1, y0, r > 0 ? -hE[r - 1][c] : 0);          // basso
    edge(s, x1, y0, x1, y1, c < COLS - 1 ? vE[r][c] : 0);         // destra
    edge(s, x1, y1, x0, y1, r < ROWS - 1 ? hE[r][c] : 0);         // alto
    edge(s, x0, y1, x0, y0, c > 0 ? -vE[r][c - 1] : 0);           // sinistra
    const g = new THREE.ExtrudeGeometry(s, { depth: .05, bevelEnabled: true, bevelThickness: .006, bevelSize: .004, bevelSegments: 1, curveSegments: 10 });
    capsOnlyUV(g, -BW / 2, -BH / 2, BW, BH);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    g.translate(-cx, -cy, -.025);
    const m = new THREE.Mesh(g, [printMat, sideMat]);
    m.position.set(cx, cy, 0); board.add(m);
    const a = Math.random() * Math.PI * 2;
    pieces.push({ m, cx, cy,
      out: new THREE.Vector3(cx * .55 + Math.cos(a) * .35, cy * .55 + Math.sin(a) * .3, .4 + Math.random() * .7),
      rot: new THREE.Vector3((Math.random() - .5) * 1.2, (Math.random() - .5) * 1.2, (Math.random() - .5) * 1.6),
      order: 0 });
  }
  pieces.sort(() => Math.random() - .5).forEach((pc, i) => { pc.order = i; });

  const shadow = floorShadow(scene, 3.4, 1.2);
  const sheet = makeSheet(tex, BW, BH);
  rig.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .95, ry0: -.6, ryShow: .25, rxShow: -.45 });
      shadow(L.x, L.y + (-BH / 2 - .35) * s, s, ph.enter);
      const press = seg(p, .48, .64);
      setPrint(printMat, press);
      // taglio: le tessere si separano, poi tornano al loro posto una alla volta
      const burst = ease(seg(p, .7, .79));
      pieces.forEach(pc => {
        const st = .8 + pc.order * .0048;
        const back = ease(seg(p, st, st + .09));
        const k = burst * (1 - back);
        pc.m.position.set(lerp(pc.cx, pc.out.x, k), lerp(pc.cy, pc.out.y, k), pc.out.z * k + Math.sin(back * Math.PI) * .12);
        pc.m.rotation.set(pc.rot.x * k, pc.rot.y * k, pc.rot.z * k);
      });
      sheet.fly(ph, new THREE.Vector3(0, BH / 2, .8), new THREE.Vector3(0, BH / 2, .04));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.peel(ease(seg(p, .64, .72)));
      sheet.ink({ ...ph, press }, seg(p, .67, .72));
    }
  };
}

/* =========================================================
   SCENA: MAGNETE — stampa lucida sul magnete, che poi si attacca al frigo
   ========================================================= */
function sceneMagnete(ctx) {
  const { scene, photo } = ctx;
  const MW = 1.25, MH = 1.25, FZ = -.6;
  const tex = photo.target(MW / MH);
  const rig = new THREE.Group(); scene.add(rig);

  // anta del frigo
  const fridge = new THREE.Group(); rig.add(fridge);
  const door = new THREE.Mesh(new RoundedBoxGeometry(3.6, 5.2, .3, 4, .14), new THREE.MeshStandardMaterial({ color: '#eef0f1', metalness: .15, roughness: .3 }));
  door.position.set(.2, 0, FZ - .15); fridge.add(door);
  const handle = new THREE.Mesh(new RoundedBoxGeometry(.12, 1.9, .14, 3, .05), new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 1, roughness: .22 }));
  handle.position.set(-1.35, .2, FZ + .08); fridge.add(handle);
  const gap = new THREE.Mesh(new THREE.BoxGeometry(3.6, .025, .02), new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: .6 }));
  gap.position.set(.2, 1.85, FZ + .01); fridge.add(gap);
  // altre calamite già sul frigo
  const note = new THREE.Mesh(new THREE.PlaneGeometry(.7, .8), new THREE.MeshStandardMaterial({ color: '#fff4c7', roughness: .9 }));
  note.position.set(1.35, -.95, FZ + .012); note.rotation.z = .08; fridge.add(note);
  [['#c9a24a', 1.38, -.6], ['#d9534f', -.75, 1.35], ['#3a8f85', 1.45, 1.2]].forEach(([col, x, y]) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .07, 32), new THREE.MeshStandardMaterial({ color: col, roughness: .35 }));
    d.rotation.x = Math.PI / 2; d.position.set(x, y, FZ + .035); fridge.add(d);
  });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  fridge.add(contact);

  // magnete
  const magnet = new THREE.Group(); rig.add(magnet);
  const mGeo = new THREE.ExtrudeGeometry(roundedRect(MW, MH, .1), { depth: .04, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 12 });
  capsOnlyUV(mGeo, -MW / 2, -MH / 2, MW, MH);
  mGeo.translate(0, 0, -.02);
  const printMat = printMaterial(tex, { base: '#ffffff', roughness: .12 });
  magnet.add(new THREE.Mesh(mGeo, [printMat, new THREE.MeshStandardMaterial({ color: '#26282c', roughness: .6 })]));

  const shadow = floorShadow(scene, 2, .9);
  const sheet = makeSheet(tex, MW, MH);
  magnet.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .95, ry0: -.35, ryShow: .3, rxShow: -.04 });
      // il frigo entra da destra solo nell'ultimo passaggio
      const slide = ease(seg(p, .66, .78));
      fridge.position.x = (1 - slide) * 5.5; fridge.visible = slide > .001;
      rig.position.y -= Math.sin(t * 1.1) * .035 * slide;
      shadow(L.x, L.y + (-MH / 2 - .45) * s, s * .8, ph.enter * (1 - slide));
      // il magnete fluttua davanti, poi va sul frigo con uno "scatto"
      const snap = easeOutBack(clamp(seg(p, .76, .9)));
      const zs = ease(seg(p, .76, .88)), click = Math.sin(seg(p, .86, .92) * Math.PI) * .05;
      const float = Math.sin(t * 1.3) * .04 * (1 - zs);
      magnet.position.set(lerp(0, .3, snap), lerp(0, .15, snap) + float, lerp(.55, FZ + .045, zs) + click);
      magnet.rotation.set(lerp(.1, 0, zs) + (1 - zs) * mouse.y * .05, lerp(-.25, 0, ph.intro) * (1 - zs), lerp(0, -.06, snap));
      magnet.scale.setScalar(lerp(.85, 1, ph.enter));
      contact.position.set(magnet.position.x + .03, magnet.position.y - .06, FZ + .005);
      contact.material.opacity = slide * (.1 + zs * .5);
      setPrint(printMat, ph.press);
      sheet.fly(ph, new THREE.Vector3(0, MH / 2, .7), new THREE.Vector3(0, MH / 2, .045));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.peel(ph.after);
      sheet.ink(ph, seg(ph.after, .45, 1));
    }
  };
}

/* =========================================================
   SCENA: STAMPA SU TELA — stampa sulla tela, poi la tela si tende sul telaio
   (i bordi si ripiegano sui lati: la foto continua sui fianchi)
   ========================================================= */
function sceneTela(ctx) {
  const { scene, photo } = ctx;
  const W = 2.0, H = 1.52, D = .16, STEP = .04;
  const CW = W + 2 * D, CH = H + 2 * D;
  const tex = photo.target(CW / CH);
  const rig = new THREE.Group(); scene.add(rig);

  // telaio in legno
  const wood = new THREE.MeshStandardMaterial({ color: '#d9bf94', roughness: .8 });
  const frame = new THREE.Group(); rig.add(frame);
  const bar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, D - .01), wood); m.position.set(x, y, -D / 2); frame.add(m); };
  bar(W, .1, 0, H / 2 - .05); bar(W, .1, 0, -H / 2 + .05); bar(.1, H - .2, -W / 2 + .05, 0); bar(.1, H - .2, W / 2 - .05, 0);
  bar(.06, H - .2, 0, 0);

  // tela (i vertici cadono esattamente sulle linee di piega)
  const geo = new THREE.PlaneGeometry(CW, CH, Math.round(CW / STEP), Math.round(CH / STEP));
  const base = Float32Array.from(geo.attributes.position.array);
  const weave = weaveTexture();
  const printMat = printMaterial(tex, { base: '#f4f1ea', roughness: .85, bump: weave, bumpScale: .12 });
  printMat.side = THREE.DoubleSide;
  const canvasMesh = new THREE.Mesh(geo, printMat);
  const canvasGrp = new THREE.Group(); canvasGrp.add(canvasMesh); rig.add(canvasGrp);
  let lastFold = -1;
  function fold(a) {
    if (Math.abs(a - lastFold) < 1e-4) return; lastFold = a;
    const p = geo.attributes.position, c = Math.cos(a * Math.PI / 2), sn = Math.sin(a * Math.PI / 2);
    for (let i = 0; i < p.count; i++) {
      let x = base[i * 3], y = base[i * 3 + 1], z = 0;
      const dx = Math.abs(x) - W / 2, dy = Math.abs(y) - H / 2;
      if (dx > 1e-6) { x = Math.sign(x) * (W / 2 + dx * c); z -= dx * sn; }
      if (dy > 1e-6) { y = Math.sign(y) * (H / 2 + dy * c); z -= dy * sn; }
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true; geo.computeVertexNormals();
  }

  const shadow = floorShadow(scene, 3.2, 1.1);
  const sheet = makeSheet(tex, CW, CH);
  canvasGrp.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .88, ry0: -.6, ryShow: .6, rxShow: -.12 });
      shadow(L.x, L.y + (-CH / 2 - .3) * s, s, ph.enter);
      setPrint(printMat, ph.press);
      // la tela stampata si appoggia sul telaio e i bordi si ripiegano
      const onFrame = ease(seg(p, .76, .84));
      canvasGrp.position.z = lerp(.75, .004, onFrame);
      fold(ease(seg(p, .8, .9)));
      frame.visible = ph.enter > .01;
      sheet.fly(ph, new THREE.Vector3(0, CH / 2, .6), new THREE.Vector3(0, CH / 2, .012));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.peel(ease(seg(p, .72, .78)));
      sheet.ink(ph, seg(p, .74, .78));
    }
  };
}

/* =========================================================
   SCENA: STAMPA A PIUMA — stampa UV diretta su pannello rigido leggero
   ========================================================= */
function scenePiuma(ctx) {
  const { scene, photo } = ctx;
  const W = 2.1, H = 1.45, T = .06;
  const tex = photo.target(W / H);
  const rig = new THREE.Group(); scene.add(rig);
  const foam = new THREE.MeshStandardMaterial({ color: '#f7f7f4', roughness: .95 });
  const printMat = printMaterial(tex, { base: '#fbfbfa', roughness: .4, glow: [.45, .55, 1.3] });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(W, H, T, 1, 1, 1), [foam, foam, foam, foam, printMat, foam]);
  rig.add(panel);

  // testina di stampa UV che scorre sul pannello
  const head = new THREE.Group(); rig.add(head);
  const headBody = new THREE.Mesh(new RoundedBoxGeometry(W + .45, .16, .2, 3, .04), new THREE.MeshStandardMaterial({ color: '#30343b', metalness: .4, roughness: .35 }));
  const uvLight = new THREE.Mesh(new THREE.BoxGeometry(W + .1, .025, .02), new THREE.MeshStandardMaterial({ color: '#8fa8ff', emissive: '#7f95ff', emissiveIntensity: 2 }));
  uvLight.position.set(0, -.07, -.06);
  const railMat = new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: .9, roughness: .25 });
  head.add(headBody, uvLight);
  const rails = new THREE.Group(); rig.add(rails);
  [-1, 1].forEach(sx => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, H + .5, 16), railMat); r.position.set(sx * (W / 2 + .25), 0, .15); rails.add(r); });

  const shadow = floorShadow(scene, 3.2, 1.1);
  const sheet = makeSheet(tex, W, H);
  rig.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .9, ry0: -.55, ryShow: .55, rxShow: -.55 });
      shadow(L.x, L.y + (-H / 2 - .35) * s, s, ph.enter);
      setPrint(printMat, ph.press);
      // la testina entra, passa dall'alto in basso insieme alla stampa ed esce
      const hv = seg(p, .42, .5) * (1 - seg(p, .76, .84));
      head.visible = rails.visible = hv > .01;
      head.scale.setScalar(Math.max(.001, hv)); rails.scale.set(1, Math.max(.001, hv), 1);
      const rv = lerp(-0.08, 1.08, ease(ph.press));
      head.position.set(0, lerp(H / 2 + .35, H / 2 - clamp(rv) * H, seg(p, .46, .5)) - (p > .74 ? seg(p, .74, .8) * .4 : 0), .16);
      // il file della foto resta sospeso e "si trasferisce" nella testina
      sheet.fly({ ...ph, land: 0 }, new THREE.Vector3(0, H / 2, .9), new THREE.Vector3(0, H / 2, .9));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.pivot.scale.multiplyScalar(lerp(1, .85, ph.land));
      sheet.ink(ph, seg(ph.press, .15, .6));
    }
  };
}

/* =========================================================
   SCENA: CALENDARIO — foto stampata sul mese, poi si gira pagina
   ========================================================= */
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
function monthTexture(year, month) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 600;
  const g = c.getContext('2d');
  const gold = (getComputedStyle(document.documentElement).getPropertyValue('--gold') || '').trim() || '#b8923a';
  const ink = (getComputedStyle(document.documentElement).getPropertyValue('--navy') || '').trim() || '#1c2b4a';
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 600);
  g.fillStyle = ink; g.font = '600 64px Georgia, serif'; g.textAlign = 'left';
  g.fillText(MESI[month], 40, 78);
  g.fillStyle = gold; g.font = '400 40px Georgia, serif'; g.textAlign = 'right'; g.fillText(String(year), 984, 76);
  const days = ['L', 'M', 'M', 'G', 'V', 'S', 'D'], cw = 944 / 7;
  g.font = '600 30px Arial, sans-serif'; g.textAlign = 'center';
  days.forEach((d, i) => { g.fillStyle = i === 6 ? gold : '#8a8f9a'; g.fillText(d, 40 + cw * i + cw / 2, 140); });
  g.fillStyle = '#e6e1d6'; g.fillRect(40, 158, 944, 2);
  const first = (new Date(year, month, 1).getDay() + 6) % 7, n = new Date(year, month + 1, 0).getDate();
  g.font = '400 34px Arial, sans-serif';
  for (let d = 1; d <= n; d++) {
    const k = first + d - 1, col = k % 7, row = Math.floor(k / 7);
    g.fillStyle = col === 6 ? gold : ink;
    g.fillText(String(d), 40 + cw * col + cw / 2, 212 + row * 72);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function sceneCalendario(ctx) {
  const { scene, photo } = ctx;
  const W = 1.5, H = 2.1, PW = W - .16, PH = 1.05, GH = .78;
  const now = new Date();
  const rig = new THREE.Group(); scene.add(rig);
  const cal = new THREE.Group(); cal.position.y = H / 2; rig.add(cal); // origine sulla spirale

  const board = new THREE.Mesh(new THREE.BoxGeometry(W + .04, H + .04, .03), new THREE.MeshStandardMaterial({ color: '#e7e1d4', roughness: .9 }));
  board.position.set(0, -H / 2, -.04); cal.add(board);

  // 3 mesi: il primo viene stampato, i successivi mostrano altre inquadrature della stessa foto
  const variants = [{}, { zoom: 1.45, ox: .4, oy: -.2 }, { filter: 'grayscale(1)', zoom: 1.2, ox: -.5 }];
  const pages = [];
  let printMat;
  variants.forEach((v, i) => {
    const m = (now.getMonth() + i) % 12, y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
    const page = new THREE.Group(); page.position.z = .012 * (variants.length - i); cal.add(page);
    const paperMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, side: THREE.DoubleSide, transparent: true });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(W, H), paperMat); paper.position.y = -H / 2; page.add(paper);
    const tex = photo.target(PW / PH, v);
    const mat = i === 0 ? (printMat = printMaterial(tex, { base: '#f3f1ec', roughness: .5 })) : new THREE.MeshStandardMaterial({ map: tex, roughness: .5 });
    mat.transparent = true;
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat); ph.position.set(0, -.12 - PH / 2, .002); page.add(ph);
    const gridMat = new THREE.MeshStandardMaterial({ map: monthTexture(y, m), roughness: .9, transparent: true });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(PW, GH), gridMat); grid.position.set(0, -.12 - PH - .06 - GH / 2, .002); page.add(grid);
    pages.push({ page, mats: [paperMat, mat, gridMat] });
  });

  // spirale e gancio
  const metal = new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: .9, roughness: .3 });
  for (let i = 0; i < 17; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(.04, .008, 8, 20), metal);
    r.rotation.y = Math.PI / 2; r.position.set(-W / 2 + .1 + i * (W - .2) / 16, .0, .0); cal.add(r);
  }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(.12, .01, 8, 32, Math.PI), metal);
  hook.position.set(0, .03, -.02); cal.add(hook);

  const shadow = floorShadow(scene, 2.4, 1);
  const sheet = makeSheet(pages[0].mats[1].map, PW, PH);
  pages[0].page.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .85, yOff: -.05, ry0: -.6, ryShow: .35 });
      shadow(L.x, L.y + (-H / 2 - .35) * s, s, ph.enter);
      setPrint(printMat, ph.press);
      // si gira pagina: il mese stampato si solleva sopra la spirale e compare il mese successivo
      const flip = ease(seg(p, .8, .93));
      pages[0].page.rotation.x = -flip * Math.PI * .92;
      const fade = 1 - seg(p, .88, .95);
      pages[0].mats.forEach(m => { m.opacity = fade; });
      pages[0].page.visible = fade > .01;
      sheet.fly(ph, new THREE.Vector3(0, -.12, .7), new THREE.Vector3(0, -.12, .014));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.peel(ph.after);
      sheet.ink(ph, seg(ph.after, .45, 1));
    }
  };
}

/* =========================================================
   SCENA: FOTOLIBRO — foto stampata in copertina, poi il libro si apre
   ========================================================= */
function sceneFotolibro(ctx) {
  const { scene, photo } = ctx;
  const W = 1.5, H = 1.9, TH = .22, CT = .035;
  const tex = photo.target(W / H);
  const inner = photo.target((W - .36) / (H - .5), { zoom: 1.35, ox: -.3 });
  const rig = new THREE.Group(); scene.add(rig);
  const book = new THREE.Group(); rig.add(book);
  const cloth = new THREE.MeshStandardMaterial({ color: '#23324d', roughness: .75 });
  const endpaper = new THREE.MeshStandardMaterial({ color: '#efe8da', roughness: .9 });
  const pagesMat = new THREE.MeshStandardMaterial({ color: '#f6f3ec', roughness: .95 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, CT), [cloth, cloth, cloth, cloth, endpaper, cloth]);
  back.position.set(0, 0, -TH / 2 + CT / 2); book.add(back);
  const block = new THREE.Mesh(new THREE.BoxGeometry(W - .08, H - .08, TH - 2 * CT - .01), pagesMat);
  block.position.set(.02, 0, 0); book.add(block);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(CT, H, TH), cloth);
  spine.position.set(-W / 2 + CT / 2, 0, 0); book.add(spine);
  // pagina interna con la foto
  const pageTop = TH / 2 - CT - .004;
  const innerPhoto = new THREE.Mesh(new THREE.PlaneGeometry(W - .36, H - .5), new THREE.MeshStandardMaterial({ map: inner, roughness: .6 }));
  innerPhoto.position.set(.04, .05, pageTop + .002); book.add(innerPhoto);

  // copertina: cerniera sul dorso
  const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, TH / 2 - CT / 2); book.add(hinge);
  const printMat = printMaterial(tex, { base: '#f1ede4', roughness: .45 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(W, H, CT), [cloth, cloth, cloth, cloth, printMat, endpaper]);
  cover.position.x = W / 2; hinge.add(cover);

  const shadow = floorShadow(scene, 2.6, 1);
  const sheet = makeSheet(tex, W, H);
  hinge.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .88, ry0: -.8, ryShow: .3, rxShow: -.1 });
      shadow(L.x, L.y + (-H / 2 - .3) * s, s, ph.enter);
      setPrint(printMat, ph.press);
      // il libro si apre: la copertina ruota sul dorso e il libro si ricentra
      const open = ease(seg(p, .78, .94));
      hinge.rotation.y = -open * Math.PI * .97;
      book.position.x = open * W / 2;
      sheet.fly(ph, new THREE.Vector3(W / 2, H / 2, .7), new THREE.Vector3(W / 2, H / 2, CT / 2 + .006));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.peel(ease(seg(p, .72, .8)));
      sheet.ink(ph, seg(p, .75, .8));
    }
  };
}

/* =========================================================
   SCENA: FOTO TESSERA — scatto con flash, ritaglio a norma, foglio con 4 copie
   e una fototessera che finisce sul documento
   ========================================================= */
function guideTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 658;
  const g = c.getContext('2d'), gold = cssColor('--gold', '#b8923a');
  g.strokeStyle = gold; g.lineWidth = 5; g.setLineDash([16, 10]);
  g.beginPath(); g.ellipse(256, 300, 150, 200, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]); g.lineWidth = 3; g.globalAlpha = .9;
  [[120, 'rgba(255,255,255,.9)'], [300, gold], [520, 'rgba(255,255,255,.9)']].forEach(([y, col]) => {
    g.strokeStyle = col; g.beginPath(); g.moveTo(20, y); g.lineTo(492, y); g.stroke();
  });
  g.strokeStyle = '#fff'; g.lineWidth = 8;
  [[14, 14, 1, 1], [498, 14, -1, 1], [14, 644, 1, -1], [498, 644, -1, -1]].forEach(([x, y, sx, sy]) => {
    g.beginPath(); g.moveTo(x, y + sy * 60); g.lineTo(x, y); g.lineTo(x + sx * 60, y); g.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function idCardTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 646;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 1024, 646); bg.addColorStop(0, '#e9f2ef'); bg.addColorStop(1, '#d8e6ee');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 646);
  g.strokeStyle = 'rgba(80,130,140,.12)'; g.lineWidth = 2;
  for (let k = 0; k < 26; k++) { g.beginPath(); for (let x = 0; x <= 1024; x += 8) g.lineTo(x, 60 + k * 22 + Math.sin(x / 60 + k) * 10); g.stroke(); }
  g.fillStyle = 'rgba(28,43,74,.85)'; g.fillRect(0, 0, 1024, 70);
  g.fillStyle = '#fff'; g.font = '600 34px Arial, sans-serif'; g.fillText('DOCUMENTO', 36, 47);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(40, 110, 300, 390); // spazio foto
  g.fillStyle = 'rgba(28,43,74,.55)';
  [[400, 130, 380], [400, 200, 300], [400, 270, 420], [400, 340, 260], [400, 410, 340], [400, 480, 220]].forEach(([x, y, w]) => {
    g.fillRect(x, y, 90, 12); g.fillStyle = 'rgba(28,43,74,.3)'; g.fillRect(x, y + 22, w, 16); g.fillStyle = 'rgba(28,43,74,.55)';
  });
  g.fillStyle = 'rgba(28,43,74,.2)'; g.fillRect(40, 560, 944, 16); g.fillRect(40, 590, 700, 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function cssColor(name, fb) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch (e) { return fb; }
}
function sceneTessera(ctx) {
  const { scene, photo } = ctx;
  const A = 35 / 45, CW = .5, CH = CW / A, GAP = .07;
  const tex = photo.target(A);
  const rig = new THREE.Group(); scene.add(rig);

  // foglio di carta fotografica con 4 fototessere
  const paper = new THREE.Group(); rig.add(paper);
  const PW = 2 * CW + GAP + .26, PH = 2 * CH + GAP + .26;
  paper.add(new THREE.Mesh(new THREE.BoxGeometry(PW, PH, .01), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .3 })));
  const lineMat = new THREE.MeshBasicMaterial({ color: '#d9d9d9' });
  const vl = new THREE.Mesh(new THREE.PlaneGeometry(.004, PH - .04), lineMat); vl.position.z = .0055; paper.add(vl);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(PW - .04, .004), lineMat); hl.position.z = .0055; paper.add(hl);
  const printMat = printMaterial(tex, { base: '#f2f2f2', roughness: .3 });
  const cells = [];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), printMat);
    m.position.set(sx * (CW + GAP) / 2, sy * (CH + GAP) / 2, .006); paper.add(m); cells.push(m);
  });
  // la fototessera ritagliata (copia della prima cella)
  const cut = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, .006), [ ...Array(4).fill(new THREE.MeshStandardMaterial({ color: '#fff' })), new THREE.MeshStandardMaterial({ map: tex, roughness: .3 }), new THREE.MeshStandardMaterial({ color: '#fff' })]);
  rig.add(cut);

  // documento generico
  const card = new THREE.Group(); rig.add(card);
  card.add(new THREE.Mesh(new RoundedBoxGeometry(1.9, 1.2, .025, 3, .06), [
    ...Array(4).fill(new THREE.MeshStandardMaterial({ color: '#e3ece9', roughness: .3 })),
    new THREE.MeshStandardMaterial({ map: idCardTexture(), roughness: .25 }), new THREE.MeshStandardMaterial({ color: '#e3ece9' })]));
  const slot = new THREE.Vector3(-1.9 / 2 + (40 + 150) / 1024 * 1.9, 1.2 / 2 - (110 + 195) / 646 * 1.2, .016);
  const slotScale = (300 / 1024 * 1.9) / CW;

  // flash dello scatto
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  flash.position.z = 4; flash.renderOrder = 999; scene.add(flash);

  const shadow = floorShadow(scene, 3, 1);
  const sheet = makeSheet(tex, CW * 1.9, CH * 1.9);
  rig.add(sheet.pivot);
  const guides = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.9, CH * 1.9), new THREE.MeshBasicMaterial({ map: guideTexture(), transparent: true, depthWrite: false }));
  guides.position.set(0, -CH * 1.9 / 2, .004); sheet.pivot.add(guides);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };
  const tmp = new THREE.Vector3();

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .9, ry0: -.5, ryShow: .35, rxShow: -.05 });
      shadow(L.x, L.y + (-PH / 2 - .35) * s, s, ph.enter);
      flash.material.opacity = Math.exp(-Math.pow((p - .17) / .018, 2)) * .9;
      setPrint(printMat, ph.press);
      // la foto resta sospesa con le guide "a norma", poi si stampa sulle 4 celle
      sheet.fly({ ...ph, land: 0 }, new THREE.Vector3(0, CH * .95, .9), new THREE.Vector3(0, CH * .95, .9));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.ink(ph, seg(ph.press, .15, .6));
      guides.material.opacity = seg(p, .3, .42) * (1 - seg(ph.press, 0, .3));
      // ritaglio: la prima fototessera si stacca e va sul documento
      const move = ease(seg(p, .74, .88));
      paper.position.set(lerp(0, -.75, move), lerp(0, .25, move), lerp(0, -.35, move));
      paper.scale.setScalar(lerp(1, .8, move));
      card.position.set(lerp(3.6, .55, move), lerp(-.4, -.35, move), .25);
      card.rotation.set(0, lerp(-.5, 0, move), lerp(.15, -.04, move));
      const cutT = ease(seg(p, .8, .95));
      tmp.copy(cells[0].position).multiplyScalar(paper.scale.x).add(paper.position); tmp.z += .02;
      const end = slot.clone().applyEuler(card.rotation).add(card.position);
      cut.position.lerpVectors(tmp, end, cutT); cut.position.z += Math.sin(cutT * Math.PI) * .5;
      cut.rotation.set(0, 0, lerp(0, card.rotation.z, cutT) + Math.sin(cutT * Math.PI) * .3);
      cut.scale.setScalar(lerp(paper.scale.x, slotScale, cutT));
      cut.visible = p > .8;
      cells[0].visible = p <= .8;
    }
  };
}

/* =========================================================
   SCENA: MATRIMONI — album avorio con finiture oro, petali che cadono
   ========================================================= */
function sceneMatrimoni(ctx) {
  const { scene, photo } = ctx;
  const W = 1.5, H = 1.9, TH = .24, CT = .04, rect = [.16, .3, .84, .86];
  const RW = W * (rect[2] - rect[0]), RH = H * (rect[3] - rect[1]);
  const tex = photo.target(RW / RH);
  const inner = photo.target((W - .36) / (H - .5), { zoom: 1.3, oy: -.2 });
  const rig = new THREE.Group(); scene.add(rig);
  const book = new THREE.Group(); rig.add(book);
  const leather = new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: .6 });
  const endpaper = new THREE.MeshStandardMaterial({ color: '#f5efe3', roughness: .9 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a24a', metalness: 1, roughness: .28 });
  const pagesMat = new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: .8 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, CT), [leather, leather, leather, leather, endpaper, leather]);
  back.position.set(0, 0, -TH / 2 + CT / 2); book.add(back);
  const block = new THREE.Mesh(new THREE.BoxGeometry(W - .08, H - .08, TH - 2 * CT - .01), [gold, gold, gold, gold, pagesMat, pagesMat]);
  block.position.set(.02, 0, 0); book.add(block);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(CT, H, TH), leather);
  spine.position.set(-W / 2 + CT / 2, 0, 0); book.add(spine);
  const pageTop = TH / 2 - CT - .004;
  const innerPhoto = new THREE.Mesh(new THREE.PlaneGeometry(W - .36, H - .5), new THREE.MeshStandardMaterial({ map: inner, roughness: .6 }));
  innerPhoto.position.set(.04, .05, pageTop + .002); book.add(innerPhoto);

  const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, TH / 2 - CT / 2); book.add(hinge);
  const printMat = printMaterial(tex, { rect, base: '#e9dfcc', roughness: .5 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(W, H, CT), [leather, leather, leather, leather, printMat, endpaper]);
  cover.position.x = W / 2; hinge.add(cover);
  // cornice oro attorno alla foto e fedi
  const cx = -W / 2 + (rect[0] + rect[2]) / 2 * W, cy = -H / 2 + (rect[1] + rect[3]) / 2 * H, m = .05, z = CT / 2 + .004;
  [[RW + 2 * m, .018, cx, cy + RH / 2 + m], [RW + 2 * m, .018, cx, cy - RH / 2 - m], [.018, RH + 2 * m, cx - RW / 2 - m, cy], [.018, RH + 2 * m, cx + RW / 2 + m, cy]]
    .forEach(([w, h, x, y]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .008), gold); b.position.set(x, y, z); cover.add(b); });
  [-.055, .055].forEach(dx => { const r = new THREE.Mesh(new THREE.TorusGeometry(.085, .013, 12, 48), gold); r.position.set(dx, -H / 2 + .17 * H, z); cover.add(r); });

  // petali
  const petals = [];
  const petalGeo = new THREE.CircleGeometry(.05, 12); petalGeo.scale(1, .62, 1);
  ['#f6d5dc', '#fbeef0', '#f1c6cf', '#ffffff'].forEach((col, ci) => {
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .45, roughness: .7, side: THREE.DoubleSide, transparent: true });
    for (let i = 0; i < 9; i++) {
      const pm = new THREE.Mesh(petalGeo, mat); scene.add(pm);
      petals.push({ m: pm, mat, x: (Math.random() - .5) * 5, z: (Math.random() - .5) * 2, ph: Math.random() * 10, sp: .18 + Math.random() * .2, r: Math.random() * 6 });
    }
  });

  const shadow = floorShadow(scene, 2.6, 1);
  const sheet = makeSheet(tex, RW, RH);
  hinge.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .88, ry0: -.8, ryShow: .3, rxShow: -.1 });
      shadow(L.x, L.y + (-H / 2 - .3) * s, s, ph.enter);
      setPrint(printMat, ph.press);
      const open = ease(seg(p, .78, .94));
      hinge.rotation.y = -open * Math.PI * .97;
      book.position.x = open * W / 2;
      sheet.fly(ph, new THREE.Vector3(W / 2 + cx, cy + RH / 2, .7), new THREE.Vector3(W / 2 + cx, cy + RH / 2, CT / 2 + .01));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.peel(ease(seg(p, .72, .8)));
      sheet.ink(ph, seg(p, .75, .8));
      petals.forEach(pt => {
        const y = 2.6 - ((t * pt.sp + pt.ph) % 5.2);
        pt.m.position.set(L.x + pt.x * s + Math.sin(t * .7 + pt.ph) * .25, L.y + y, pt.z);
        pt.m.rotation.set(t * .8 + pt.r, t * .5 + pt.r, t * .3);
        pt.mat.opacity = .9 * ph.enter;
      });
    }
  };
}

/* =========================================================
   SCENA: FOTO SCUOLE — foto di classe nel cartoncino ricordo, poi una copia per ogni alunno
   ========================================================= */
function folderTexture(W, H) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * H / W);
  const g = c.getContext('2d'), gold = cssColor('--gold', '#b8923a'), navy = cssColor('--navy', '#1c2b4a');
  g.fillStyle = navy; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = gold; g.lineWidth = 4; g.strokeRect(26, 26, c.width - 52, c.height - 52);
  g.lineWidth = 1.5; g.strokeRect(38, 38, c.width - 76, c.height - 76);
  const now = new Date(), y0 = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  g.textAlign = 'center';
  g.fillStyle = gold; g.font = 'italic 600 46px Georgia, serif';
  g.fillText('Foto di classe', c.width / 2, c.height - 92);
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '400 28px Georgia, serif';
  g.fillText('Anno scolastico ' + y0 + '/' + (y0 + 1), c.width / 2, c.height - 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function sceneScuole(ctx) {
  const { scene, photo } = ctx;
  const W = 1.9, H = 1.55, FW = 1.5, FH = 1.0, FY = .14;
  const tex = photo.target(FW / FH);
  const rig = new THREE.Group(); scene.add(rig);
  const navy = new THREE.MeshStandardMaterial({ color: cssColor('--navy', '#1c2b4a'), roughness: .7 });
  const front = new THREE.MeshStandardMaterial({ map: folderTexture(W, H), roughness: .6 });
  const folderGeo = new THREE.BoxGeometry(W, H, .02);
  const mountGeo = new THREE.PlaneGeometry(FW + .06, FH + .06), photoGeo = new THREE.PlaneGeometry(FW, FH);
  const mountMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .5 });
  const printMat = printMaterial(tex, { base: '#eef0f3', roughness: .35 });
  const staticMat = new THREE.MeshStandardMaterial({ map: tex, roughness: .35 });
  function makeFolder(mat) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(folderGeo, [navy, navy, navy, navy, front, navy]));
    const mount = new THREE.Mesh(mountGeo, mountMat); mount.position.set(0, FY, .011); g.add(mount);
    const ph = new THREE.Mesh(photoGeo, mat); ph.position.set(0, FY, .013); g.add(ph);
    return g;
  }
  const main = makeFolder(printMat); rig.add(main);
  const copies = [];
  for (let i = 0; i < 6; i++) { const f = makeFolder(staticMat); f.visible = false; rig.add(f); copies.push(f); }

  const shadow = floorShadow(scene, 3.4, 1.1);
  const sheet = makeSheet(tex, FW, FH);
  main.add(sheet.pivot);
  const mouse = { x: 0, y: 0 };
  ctx.onPointer = (x, y) => { mouse.x = x; mouse.y = y; };

  return {
    update(p, t, L) {
      const ph = phases(p);
      const s = rigMotion(rig, ph, t, L, mouse, { fit: .85, ry0: -.6, ryShow: .2, rxShow: -.08 });
      shadow(L.x, L.y + (-H / 2 - .35) * s, s, ph.enter);
      setPrint(printMat, ph.press);
      sheet.fly(ph, new THREE.Vector3(0, FY + FH / 2, .7), new THREE.Vector3(0, FY + FH / 2, .016));
      sheet.shape((x, y) => [x, y, 0], 'flat');
      sheet.peel(ph.after);
      sheet.ink(ph, seg(ph.after, .45, 1));
      // una copia per ogni alunno: i cartoncini si aprono a ventaglio dietro l'originale
      const fan = ease(seg(p, .8, .96));
      copies.forEach((f, i) => {
        const k = (i - (copies.length - 1) / 2) / ((copies.length - 1) / 2); // -1..1
        f.visible = fan > .01;
        f.position.set(k * .95 * fan, -Math.abs(k) * .12 * fan, -.05 - .02 * i);
        f.rotation.set(0, 0, -k * .32 * fan);
      });
      main.position.set(0, lerp(0, .05, fan), lerp(0, .1, fan));
    }
  };
}

const SCENES = {
  cuscino: makeSoftScene({ w: 1, h: 1, D: .34, pinch: .07, print: .86, fabric: '#f2ede3', piping: .022 }),
  borsa: makeSoftScene({ w: .85, h: .95, D: .1, pinch: .025, print: .8, fabric: '#ece3cf', piping: .012, handles: true, fit: .82, yOff: -.35, ry0: -.6, ryShow: .45 }),
  tazza: sceneTazza,
  cover: sceneCover,
  puzzle: scenePuzzle,
  magnete: sceneMagnete,
  piuma: scenePiuma,
  tela: sceneTela,
  calendario: sceneCalendario,
  fotolibro: sceneFotolibro,
  tessera: sceneTessera,
  matrimoni: sceneMatrimoni,
  scuole: sceneScuole
};

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

  // Caricamento foto del cliente -> anteprima sul prodotto
  const upBtn = section.querySelector('.svc3d__upload');
  const upInput = section.querySelector('.svc3d__file');
  const upStatus = section.querySelector('.svc3d__status');
  if (upBtn && upInput) {
    upBtn.addEventListener('click', () => upInput.click());
    upInput.addEventListener('change', async () => {
      const file = upInput.files && upInput.files[0];
      upInput.value = '';
      if (!file) return;
      if (upStatus) upStatus.textContent = 'Caricamento…';
      const ok = await photo.fromFile(file);
      if (upStatus) upStatus.textContent = ok ? '✓ Ecco la tua foto sul prodotto' : 'Formato non supportato, prova con un JPG o PNG';
      if (!ok) return;
      upBtn.lastChild.textContent = ' Cambia la tua foto';
      // se l'animazione non è ancora alla fine, la fa scorrere fino al prodotto finito
      if (cur < .9) {
        const top = section.getBoundingClientRect().top + window.scrollY + (section.offsetHeight - window.innerHeight) * .97;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }

  const L = { x: 0, y: 0, s: 1 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const a = camera.aspect;
    if (a < .85) { L.x = 0; L.y = .85; L.s = Math.min(.9, a * 1.4); }       // mobile: oggetto in alto, testo sotto
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
