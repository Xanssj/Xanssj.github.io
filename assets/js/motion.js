/* Movimiento de la portada y la tienda (sin librerías).
   - La entrada de la portada (título, texto, botones) es solo CSS: ver "Movimiento" en site.css.
   - Bloques que aparecen al bajar: se les pone data-xh-reveal y --xh-i (orden entre hermanos)
     y entran con desenfoque y un pequeño rebote cuando llegan a la pantalla.
   - La ventana del panel (.device) se inclina apenas siguiendo el cursor.
   Con "reducir movimiento" no hace nada y todo se ve igual que sin este archivo. */
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SELECTORS = [
    '.section-head', '.svc-card', '.feature', '.plan', '.steps > *', '.service-list', '.studio > *', '.closing .wrap > *',
    '.store-section .t-title1', '.product', '.buy-pick', '.store-faq-item', '.device-caption'
  ].join(',');

  function init() {
    var items = Array.prototype.slice.call(document.querySelectorAll(SELECTORS));
    if (!items.length) return;
    var vh = window.innerHeight;
    document.documentElement.classList.add('xh-motion');
    items.forEach(function (el) {
      // Lo que ya está a la vista al cargar no se esconde (sin parpadeo).
      if (el.getBoundingClientRect().top < vh * 0.9) return;
      var index = 0;
      var sib = el.previousElementSibling;
      while (sib && index < 6) { if (sib.matches(SELECTORS)) index += 1; sib = sib.previousElementSibling; }
      el.style.setProperty('--xh-i', index);
      el.setAttribute('data-xh-reveal', '');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll('[data-xh-reveal]').forEach(function (el) { io.observe(el); });

    // Inclinación suave de la ventana del panel en la portada.
    var device = document.querySelector('.device-window');
    if (device && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var box = device.parentElement;
      var raf = 0;
      box.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var r = box.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          device.style.transform = 'perspective(1400px) rotateX(' + (-y * 3).toFixed(2) + 'deg) rotateY(' + (x * 4).toFixed(2) + 'deg)';
        });
      });
      box.addEventListener('pointerleave', function () { device.style.transform = ''; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
