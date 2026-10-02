/* Carosello foto occhiali – pagine brand
   Le foto che non esistono ancora in images/ vengono nascoste in automatico. */
(function () {
  document.querySelectorAll('[data-brand-gallery]').forEach(function (root) {
    var track = root.querySelector('.brand-gallery__track');
    var prev = root.querySelector('.brand-gallery__btn--prev');
    var next = root.querySelector('.brand-gallery__btn--next');
    var dotsBox = root.querySelector('.brand-gallery__dots');
    var timer = null;

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
      function drop() { s.remove(); if (!slides().length) root.style.display = 'none'; buildDots(); }
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
