/* =========================================================
   EmiFotoOttica — Animazioni 3D scroll-driven per le pagine servizio
   Uso: <section class="svc3d" data-scene="cuscino" data-photos="a.jpg,b.jpg"> ... </section>
   Scene disponibili: cuscino, borsa, tazza, cover, puzzle, magnete
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
function drawCover(ctx, img, W, H) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const r = Math.max(W / img.width, H / img.height), w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
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
    drawCover(t.canvas.getContext('2d'), current, t.canvas.width, t.canvas.height);
    t.tex.needsUpdate = true;
  }
  function set(src) {
    const k = Math.min(1, 2048 / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    current = c; targets.forEach(paint);
  }
  function target(aspect = 1) {
    const canvas = document.createElement('canvas');
    if (aspect >= 1) { canvas.width = 1024; canvas.height = Math.round(1024 / aspect); }
    else { canvas.height = 1024; canvas.width = Math.round(1024 * aspect); }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const t = { canvas, tex }; targets.push(t);
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
function printMaterial(tex, { rect = [0, 0, 1, 1], base = '#ffffff', roughness = .5, metalness = 0, bump = null, bumpScale = .15 } = {}) {
  const U = {
    uReveal: { value: -.1 }, uGlow: { value: 0 },
    uBase: { value: new THREE.Color(base) }, uRect: { value: new THREE.Vector4(...rect) }
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness, metalness, bumpMap: bump, bumpScale });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = 'uniform float uReveal; uniform float uGlow; uniform vec3 uBase; uniform vec4 uRect;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec2 pUv = (vMapUv - uRect.xy) / (uRect.zw - uRect.xy);
        float soft = smoothstep(0.0,0.008,pUv.x)*smoothstep(0.0,0.008,1.0-pUv.x)*smoothstep(0.0,0.008,pUv.y)*smoothstep(0.0,0.008,1.0-pUv.y);
        vec3 photoC = texture2D(map, clamp(pUv, 0.0, 1.0)).rgb;
        float tt = 1.0 - vMapUv.y;
        float rev = 1.0 - smoothstep(uReveal - 0.05, uReveal, tt);
        diffuseColor.rgb *= mix(uBase, photoC, soft * rev);
        float heatBand = exp(-pow((tt - uReveal) * 14.0, 2.0)) * step(0.001, soft);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * heatBand * vec3(1.0, 0.62, 0.3);`);
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

const SCENES = {
  cuscino: makeSoftScene({ w: 1, h: 1, D: .34, pinch: .07, print: .86, fabric: '#f2ede3', piping: .022 }),
  borsa: makeSoftScene({ w: .85, h: .95, D: .1, pinch: .025, print: .8, fabric: '#ece3cf', piping: .012, handles: true, fit: .82, yOff: -.35, ry0: -.6, ryShow: .45 }),
  tazza: sceneTazza,
  cover: sceneCover,
  puzzle: scenePuzzle,
  magnete: sceneMagnete
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
