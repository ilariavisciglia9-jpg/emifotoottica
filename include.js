/* =========================================================
   EmiFotoOttica – Header e Footer condivisi
   Carica header.html e footer.html in ogni pagina:
   modifichi quei due file e cambia tutto il sito.
   ========================================================= */
(function () {
  function runScripts(container) {
    container.querySelectorAll('script').forEach(function (old) {
      var s = document.createElement('script');
      for (var i = 0; i < old.attributes.length; i++) s.setAttribute(old.attributes[i].name, old.attributes[i].value);
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  }

  function markActive(container) {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    container.querySelectorAll('a[href]').forEach(function (a) {
      if ((a.getAttribute('href') || '').toLowerCase() === page) a.classList.add('active');
    });
  }

  function load(id, url, after) {
    var req = fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.text();
    });
    function inject() {
      var el = document.getElementById(id);
      if (!el) return;
      req.then(function (html) {
        el.innerHTML = html;
        runScripts(el);
        markActive(el);
        if (after) after(el);
      }).catch(function (e) { console.warn('Include non caricato:', e); });
    }
    if (document.getElementById(id)) inject();
    else document.addEventListener('DOMContentLoaded', inject);
  }

  load('site-header', 'header.html');
  load('site-footer', 'footer.html', function (el) {
    var y = el.querySelector('#year');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
