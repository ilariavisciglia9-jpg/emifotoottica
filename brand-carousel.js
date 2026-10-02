/* Carosello foto occhiali – pagine brand
   Le foto che non esistono ancora in images/ vengono nascoste in automatico. */
(function () {
  document.querySelectorAll('[data-brand-gallery]').forEach(function (root) {
    var track = root.querySelector('.brand-gallery__track');
    var prev = root.querySelector('.brand-gallery__btn--prev');
    var next = root.querySelector('.brand-gallery__btn--next');
    var dotsBox = root.querySelector('.brand-gallery__dots');
    var timer = null;

    /* Nessuna foto ancora caricata: mostra 3 schede segnaposto eleganti */
    function placeholders() {
      var nameEl = root.querySelector('.brand-gallery__title span');
      var brand = nameEl ? nameEl.textContent : '';
      var svg = '<svg viewBox="0 0 120 50" width="120" height="50" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="6" y="10" width="44" height="30" rx="12"/><rect x="70" y="10" width="44" height="30" rx="12"/><path d="M50 20q10-7 20 0"/><path d="M6 18L1 14M114 18l5-4"/></svg>';
      for (var i = 0; i < 3; i++) {
        var f = document.createElement('figure');
        f.className = 'brand-gallery__slide brand-gallery__slide--ph';
        f.innerHTML = svg + '<span class="brand-gallery__ph-name">' + brand + '</span><span class="brand-gallery__ph-txt">Nuove foto in arrivo</span>';
        track.appendChild(f);
      }
    }

    function slides() { return Array.prototype.slice.call(track.querySelectorAll('.brand-gallery__slide')); }
    function step() { var s = slides()[0]; return s ? s.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth; }
    function pages() { var n = slides().length, per = Math.max(1, Math.round(track.clientWidth / step())); return Math.max(1, n - per + 1); }
    function current() { return Math.round(track.scrollLeft / step()); }

    function buildDots() {
      dotsBox.innerHTML = '';
      var p = pages();
      var nav = root.querySelector('.brand-gallery__nav');
      if (nav) nav.style.visibility = p < 2 ? 'hidden' : '';
      if (p < 2) { dotsBox.style.display = 'none'; update(); return; }
      dotsBox.style.display = '';
      for (var i = 0; i < p; i++) {
        var d = document.createElement('button');
        d.type = 'button'; d.className = 'brand-gallery__dot'; d.setAttribute('aria-label', 'Foto ' + (i + 1));
        (function (i) { d.addEventListener('click', function () { go(i); restart(); }); })(i);
        dotsBox.appendChild(d);
      }
      update();
    }
    function update() {
      var c = current(), p = pages();
      dotsBox.querySelectorAll('.brand-gallery__dot').forEach(function (d, i) { d.classList.toggle('on', i === c); });
      if (prev) prev.disabled = c <= 0;
      if (next) next.disabled = c >= p - 1;
    }
    function go(i) { track.scrollTo({ left: i * step(), behavior: 'smooth' }); }
    function auto() { var c = current(); go(c >= pages() - 1 ? 0 : c + 1); }
    function restart() { clearInterval(timer); timer = setInterval(auto, 4500); }

    slides().forEach(function (s) {
      var img = s.querySelector('img');
      function drop() { s.remove(); if (!slides().length) placeholders(); buildDots(); }
      if (img.complete && img.naturalWidth === 0) drop();
      else img.addEventListener('error', drop);
    });

    if (prev) prev.addEventListener('click', function () { go(Math.max(0, current() - 1)); restart(); });
    if (next) next.addEventListener('click', function () { go(Math.min(pages() - 1, current() + 1)); restart(); });
    var raf; track.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); });
    track.addEventListener('pointerdown', function () { clearInterval(timer); });
    root.addEventListener('mouseenter', function () { clearInterval(timer); });
    root.addEventListener('mouseleave', restart);
    window.addEventListener('resize', buildDots);
    buildDots(); restart();
  });
})();
