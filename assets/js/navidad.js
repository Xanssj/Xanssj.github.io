/* Decoración de temporada de Xhanni Studios (hora local):
   - Navidad (28 de noviembre al 30 de diciembre): guirnalda dorado/menta, nieve ligera en el hero
     de portada y xhannizer0.html, saludo "Felices fiestas de parte de Xhanni Studios".
   - Año Nuevo (31 de diciembre al 2 de enero): guirnalda dorado/champagne, sin nieve,
     saludo "Feliz Año Nuevo de parte de Xhanni Studios".
   - Desde el 3 de enero: modo normal (apagada sola).
   - Enlace "Quitar decoración" guardado en localStorage; respeta prefers-reduced-motion,
     prefers-contrast/forced-colors y pausa al ocultar la pestaña. */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'xh-navidad-off';
  var LIGHT_COUNT = 18;
  var MAX_FLAKES = 26;

  function getFestiveSeason(date) {
    var d = date instanceof Date ? date : new Date();
    if (isNaN(d.getTime())) return null;
    var month = d.getMonth(); // 0 = enero, 10 = noviembre, 11 = diciembre (hora local)
    var day = d.getDate();
    if ((month === 10 && day >= 28) || (month === 11 && day <= 30)) return 'navidad';
    if ((month === 11 && day === 31) || (month === 0 && day <= 2)) return 'anonuevo';
    return null;
  }

  function isNavidadDate(date) {
    return getFestiveSeason(date) !== null;
  }

  // Exporta la lógica de fechas para las pruebas en Node (tests/navidad.test.js).
  if (typeof module === 'object' && module && module.exports) {
    module.exports = {
      getFestiveSeason: getFestiveSeason,
      isNavidadDate: isNavidadDate,
      STORAGE_KEY: STORAGE_KEY,
      MAX_FLAKES: MAX_FLAKES
    };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function isDisabledByUser() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function disableByUser() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* sin almacenamiento */ }
  }

  function previewSeason() {
    try {
      var q = window.location.search || '';
      if (/(?:^|[?&])navidad=anonuevo(?:&|$)/.test(q)) return 'anonuevo';
      if (/(?:^|[?&])navidad=1(?:&|$)/.test(q)) return 'navidad';
    } catch (e) { /* sin query */ }
    return null;
  }

  function mq(query) {
    return window.matchMedia ? window.matchMedia(query) : null;
  }

  function isHighContrast() {
    var m1 = mq('(prefers-contrast: more)');
    var m2 = mq('(forced-colors: active)');
    return Boolean((m1 && m1.matches) || (m2 && m2.matches));
  }

  function isReducedMotion() {
    var m = mq('(prefers-reduced-motion: reduce)');
    return Boolean(m && m.matches);
  }

  function buildGarland(navbar, season) {
    if (!navbar || navbar.querySelector('.xh-xmas-garland')) return null;
    var bar = document.createElement('div');
    bar.className = 'xh-xmas-garland' + (season === 'anonuevo' ? ' is-newyear' : '');
    bar.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < LIGHT_COUNT; i++) {
      var dot = document.createElement('span');
      dot.className = 'xh-xmas-dot' + (i % 2 === 1 ? ' is-mint' : '');
      bar.appendChild(dot);
    }
    navbar.appendChild(bar);
    return bar;
  }

  function buildFooterGreeting(footer, season, onRemove) {
    if (!footer || footer.querySelector('.xh-xmas-footer')) return null;
    var bar = document.createElement('div');
    bar.className = 'xh-xmas-footer' + (season === 'anonuevo' ? ' is-newyear' : '');

    var greeting = document.createElement('span');
    greeting.className = 'xh-xmas-greeting';
    greeting.textContent = season === 'anonuevo'
      ? 'Feliz Año Nuevo de parte de Xhanni Studios'
      : 'Felices fiestas de parte de Xhanni Studios';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xh-xmas-off';
    btn.textContent = 'Quitar decoración';
    btn.addEventListener('click', onRemove);

    bar.appendChild(greeting);
    bar.appendChild(btn);

    var legal = footer.querySelector('.footer-legal');
    if (legal && legal.parentNode === footer) footer.insertBefore(bar, legal);
    else footer.appendChild(bar);
    return bar;
  }

  function createHeroSnow(hero) {
    if (!hero || isReducedMotion()) return null;

    hero.classList.add('xh-xmas-hero-host');
    var canvas = document.createElement('canvas');
    canvas.className = 'xh-xmas-snow';
    canvas.setAttribute('aria-hidden', 'true');
    hero.insertBefore(canvas, hero.firstChild);

    var ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) {
      canvas.remove();
      hero.classList.remove('xh-xmas-hero-host');
      return null;
    }

    var width = 0;
    var height = 0;
    var dpr = 1;
    var flakes = [];
    var rafId = 0;
    var lastTime = 0;
    var heroVisible = true;
    var destroyed = false;

    function readSnowColor() {
      var val = window.getComputedStyle(document.documentElement).getPropertyValue('--xmas-snow');
      return (val && val.trim()) || 'rgba(255, 255, 255, 0.45)';
    }

    function seedFlakes() {
      flakes = [];
      var count = Math.min(MAX_FLAKES, width < 640 ? 16 : MAX_FLAKES);
      for (var i = 0; i < count; i++) {
        var duration = 8 + Math.random() * 6; // 8 a 14 s por recorrido
        flakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 1 + Math.random() * 1, // 2 a 4 px de diámetro
          vy: (height || 500) / duration,
          vx: (Math.random() - 0.5) * 10,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.45 + Math.random() * 0.55 // escala sobre --xmas-snow (<= 50%)
        });
      }
    }

    function resize() {
      var rect = hero.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!flakes.length) {
        seedFlakes();
      } else {
        for (var i = 0; i < flakes.length; i++) {
          var duration = 8 + (i % 7); // mantiene rango 8..14 s
          flakes[i].vy = height / duration;
          if (flakes[i].x > width) flakes[i].x = Math.random() * width;
          if (flakes[i].y > height) flakes[i].y = Math.random() * height;
        }
      }
    }

    function step(now) {
      if (destroyed || document.hidden || !heroVisible || isReducedMotion()) {
        rafId = 0;
        return;
      }
      var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = readSnowColor();

      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.vy * dt;
        f.phase += dt * 0.8;
        f.x += (f.vx + Math.sin(f.phase) * 6) * dt;

        if (f.y > height + 4) {
          f.y = -4;
          f.x = Math.random() * width;
        }
        if (f.x < -4) f.x = width + 4;
        else if (f.x > width + 4) f.x = -4;

        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafId = window.requestAnimationFrame(step);
    }

    function start() {
      if (destroyed || rafId || document.hidden || !heroVisible || isReducedMotion()) return;
      lastTime = 0;
      rafId = window.requestAnimationFrame(step);
    }

    function stop() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    var observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(function (entries) {
        heroVisible = Boolean(entries[0] && entries[0].isIntersecting);
        if (heroVisible) start(); else stop();
      }, { threshold: 0.01 });
      observer.observe(hero);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    start();

    return {
      pause: stop,
      resume: start,
      destroy: function () {
        destroyed = true;
        stop();
        window.removeEventListener('resize', resize);
        if (observer) observer.disconnect();
        canvas.remove();
        hero.classList.remove('xh-xmas-hero-host');
      }
    };
  }

  function init() {
    if (isDisabledByUser() || isHighContrast()) return;
    var season = previewSeason() || getFestiveSeason(new Date());
    if (!season) return;

    var navbar = document.querySelector('header.navbar');
    var footer = document.querySelector('footer.footer');
    var hero = season === 'navidad' ? document.querySelector('.hero.hero-studio, .hero.xz-hero') : null;
    if (!navbar && !footer && !hero) return;

    var garland = buildGarland(navbar, season);
    var snow = hero ? createHeroSnow(hero) : null;
    var footerBar = null;

    function syncVisibility() {
      var hidden = Boolean(document.hidden);
      document.documentElement.classList.toggle('xh-xmas-paused', hidden);
      if (snow) {
        if (hidden) snow.pause(); else snow.resume();
      }
    }

    var motionMq = mq('(prefers-reduced-motion: reduce)');
    function onMotionChange() {
      if (isReducedMotion() && snow) {
        snow.destroy();
        snow = null;
      }
    }

    function cleanup() {
      document.removeEventListener('visibilitychange', syncVisibility);
      if (motionMq && motionMq.removeEventListener) motionMq.removeEventListener('change', onMotionChange);
      document.documentElement.classList.remove('xh-xmas-paused');
      if (garland) { garland.remove(); garland = null; }
      if (snow) { snow.destroy(); snow = null; }
      if (footerBar) { footerBar.remove(); footerBar = null; }
    }

    footerBar = buildFooterGreeting(footer, season, function () {
      disableByUser();
      cleanup();
    });

    document.addEventListener('visibilitychange', syncVisibility);
    if (motionMq && motionMq.addEventListener) motionMq.addEventListener('change', onMotionChange);
    syncVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
