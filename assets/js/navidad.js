/* Decoración de temporada v3 de Xhanni Studios (hora local):
   - Navidad (28 de noviembre al 30 de diciembre): atmósfera aurora en el hero, nieve suave
     en toda la pantalla visible (máx. 42 copos con profundidad, detrás del contenido),
     guirnalda con hilo curvo SVG y luces bokeh (dorado/rojo cálido/menta), escarcha sutil
     en navbar/tarjetas, gorro SVG sobre la "x" de xhanni, píldora en el hero y saludo en el pie.
   - Año Nuevo (31 de diciembre al 2 de enero): aurora y guirnalda dorado/champagne, destello
     dorado sobre la "x", píldora y saludo de Año Nuevo, sin nieve.
   - Desde el 3 de enero: modo normal (apagada sola).
   - Interruptor en la barra y enlace "Quitar decoración" guardados en localStorage;
     respeta CSP (sin scripts inline), prefers-reduced-motion, alto contraste y visibilitychange. */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'xh-navidad-off';
  var MAX_FLAKES = 42;

  // 3 arcos suaves a lo largo del borde superior del navbar (viewBox 0 0 1000 15).
  var SVG_WIRE =
    '<svg class="xh-xmas-wire" viewBox="0 0 1000 15" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M0 1 Q166.7 13 333.3 2 Q500 13 666.7 2 Q833.3 13 1000 1"/>' +
    '</svg>';

  // Posiciones (en % de x, y) de 15 luces bokeh colgadas sobre los 3 arcos del cable SVG.
  var BULB_POINTS = [
    [5, 22], [11.5, 44], [16.7, 50], [22, 44], [28.5, 25],
    [38.5, 26], [44.5, 45], [50, 50], [55.5, 45], [61.5, 26],
    [71.5, 25], [78, 44], [83.3, 50], [88.5, 44], [95, 22]
  ];

  var SVG_HAT =
    '<svg viewBox="0 0 26 22" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4.2 15.8C5 8.8 9.8 3.2 16.8 3C19.8 2.9 22.1 4.9 22.6 7.8C20.6 7.2 18.8 8 17.5 10C16.4 11.7 16.4 14 16.9 15.8H4.2Z" fill="var(--xmas-hat-red)"/>' +
      '<path d="M16.8 3C19 3 21.1 4.2 22.2 6.2C20.1 5.7 17.8 6.6 16.1 8.5C14.7 10 14.1 12.4 14.5 15.8H16.9C16.4 14 16.4 11.7 17.5 10C18.8 8 20.6 7.2 22.6 7.8C22.1 4.9 19.8 2.9 16.8 3Z" fill="var(--xmas-hat-red-deep)" opacity="0.48"/>' +
      '<rect x="2.2" y="14.4" width="16.4" height="4.4" rx="2.2" fill="var(--xmas-hat-white)"/>' +
      '<circle cx="22.8" cy="8.2" r="2.6" fill="var(--xmas-hat-white)"/>' +
    '</svg>';

  var SVG_SPARKLE =
    '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M10 1.2L12.2 7.8L18.8 10L12.2 12.2L10 18.8L7.8 12.2L1.2 10L7.8 7.8L10 1.2Z" fill="var(--xmas-gold)"/>' +
      '<circle cx="16" cy="4" r="1.5" fill="var(--xmas-champagne)"/>' +
    '</svg>';

  var SVG_SNOWFLAKE =
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M10 2.5v15M3.5 6.25l13 7.5M16.5 6.25l-13 7.5"/>' +
      '<path d="M8.2 4.2L10 6l1.8-1.8M8.2 15.8L10 14l1.8 1.8M4.3 8.8L6.5 8l-.7-2.2M15.7 11.2L13.5 12l.7 2.2M15.7 8.8L13.5 8l.7-2.2M4.3 11.2L6.5 12l-.7 2.2"/>' +
    '</svg>';

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

  function setDisabledByUser(off) {
    try {
      if (off) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* sin almacenamiento */ }
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

  function isEnglish() {
    if (window.xhPrefs && typeof window.xhPrefs.lang === 'function') return window.xhPrefs.lang() === 'en';
    return (document.documentElement.getAttribute('lang') || '').toLowerCase() === 'en';
  }

  function buildGarland(navbar, season) {
    if (!navbar || navbar.querySelector('.xh-xmas-garland')) return null;
    var bar = document.createElement('div');
    bar.className = 'xh-xmas-garland' + (season === 'anonuevo' ? ' is-newyear' : '');
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = SVG_WIRE;
    for (var i = 0; i < BULB_POINTS.length; i++) {
      var dot = document.createElement('span');
      if (season === 'anonuevo') {
        dot.className = 'xh-xmas-dot' + (i % 2 === 1 ? ' is-champagne' : '');
      } else {
        var mod = i % 3;
        dot.className = 'xh-xmas-dot' + (mod === 1 ? ' is-red' : mod === 2 ? ' is-mint' : '');
      }
      dot.style.left = BULB_POINTS[i][0] + '%';
      dot.style.top = BULB_POINTS[i][1] + '%';
      bar.appendChild(dot);
    }
    navbar.appendChild(bar);
    return bar;
  }

  function buildWordmarkHat(navbar, season) {
    var wm = navbar && navbar.querySelector('.wordmark');
    if (!wm || wm.querySelector('.xh-xmas-hat')) return null;
    wm.classList.add('xh-xmas-wordmark');
    var hat = document.createElement('span');
    hat.className = 'xh-xmas-hat' + (season === 'anonuevo' ? ' is-sparkle' : '');
    hat.setAttribute('aria-hidden', 'true');
    hat.innerHTML = season === 'anonuevo' ? SVG_SPARKLE : SVG_HAT;
    wm.appendChild(hat);
    return {
      remove: function () {
        hat.remove();
        wm.classList.remove('xh-xmas-wordmark');
      }
    };
  }

  function buildHeroPill(hero, season) {
    if (!hero || hero.querySelector('.xh-xmas-pill')) return null;
    var wrap = hero.querySelector('.wrap') || hero;
    var pill = document.createElement('div');
    pill.className = 'xh-xmas-pill';

    var icon = document.createElement('span');
    icon.className = 'xh-xmas-pill-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = season === 'anonuevo' ? SVG_SPARKLE : SVG_SNOWFLAKE;

    var text = document.createElement('span');
    text.textContent = season === 'anonuevo'
      ? '¡Feliz Año Nuevo! · Xhanni Studios'
      : 'Feliz Navidad de parte de Xhanni Studios';

    pill.appendChild(icon);
    pill.appendChild(text);

    var eyebrow = wrap.querySelector('.t-eyebrow');
    if (eyebrow && eyebrow.parentNode === wrap) wrap.insertBefore(pill, eyebrow);
    else wrap.insertBefore(pill, wrap.firstChild);
    return pill;
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

  function buildNavbarToggle(navbar, season, onToggle) {
    if (!navbar || navbar.querySelector('.xh-xmas-toggle')) return null;
    var host = navbar.querySelector('.xh-prefs');
    if (!host) {
      var inner = navbar.querySelector('.navbar-inner');
      if (!inner) return null;
      host = inner;
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xh-pref xh-xmas-toggle';
    btn.setAttribute('data-xh-xmas-toggle', '');
    btn.setAttribute('data-no-translate', '');
    btn.innerHTML = season === 'anonuevo' ? SVG_SPARKLE : SVG_SNOWFLAKE;
    btn.addEventListener('click', onToggle);

    if (host.classList.contains('xh-prefs')) {
      host.appendChild(btn);
    } else {
      var before = host.querySelector(':scope > .nav-actions, :scope > .nav-end, :scope > .nav-toggle');
      if (before) host.insertBefore(btn, before);
      else host.appendChild(btn);
    }

    function paint(active) {
      var en = isEnglish();
      var label = season === 'anonuevo'
        ? (en ? (active ? 'New Year mode: on' : 'New Year mode: off') : (active ? 'Modo Año Nuevo: activado' : 'Modo Año Nuevo: desactivado'))
        : (en ? (active ? 'Christmas mode: on' : 'Christmas mode: off') : (active ? 'Modo Navidad: activado' : 'Modo Navidad: desactivado'));
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }

    return { el: btn, paint: paint };
  }

  function createViewportSnow() {
    if (!document.body || isReducedMotion()) return null;

    var canvas = document.createElement('canvas');
    canvas.className = 'xh-xmas-snow';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) {
      canvas.remove();
      return null;
    }

    var width = 0;
    var height = 0;
    var dpr = 1;
    var flakes = [];
    var rafId = 0;
    var lastTime = 0;
    var destroyed = false;

    function readSnowColor() {
      var val = window.getComputedStyle(document.documentElement).getPropertyValue('--xmas-snow');
      return (val && val.trim()) || 'rgba(255, 255, 255, 0.7)';
    }

    function seedFlakes() {
      flakes = [];
      var count = Math.min(MAX_FLAKES, width < 640 ? 24 : MAX_FLAKES);
      for (var i = 0; i < count; i++) {
        // 3 capas de profundidad (lejos, medio, cerca) para sensación de volumen suave
        var depth = i % 3;
        var r = depth === 0 ? (0.9 + Math.random() * 0.6) : depth === 1 ? (1.5 + Math.random() * 0.8) : (2.2 + Math.random() * 1.1);
        var duration = depth === 0 ? (14 + Math.random() * 4) : depth === 1 ? (10 + Math.random() * 4) : (7.5 + Math.random() * 3.5);
        var alpha = depth === 0 ? (0.28 + Math.random() * 0.18) : depth === 1 ? (0.48 + Math.random() * 0.24) : (0.68 + Math.random() * 0.28);
        flakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: r,
          vy: (height || 800) / duration,
          vx: (Math.random() - 0.5) * (depth === 2 ? 16 : 10),
          phase: Math.random() * Math.PI * 2,
          sway: depth === 2 ? 10 : 6,
          alpha: alpha
        });
      }
    }

    function resize() {
      width = Math.max(1, window.innerWidth || 1024);
      height = Math.max(1, window.innerHeight || 768);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!flakes.length) {
        seedFlakes();
      } else {
        for (var i = 0; i < flakes.length; i++) {
          if (flakes[i].x > width) flakes[i].x = Math.random() * width;
          if (flakes[i].y > height) flakes[i].y = Math.random() * height;
        }
      }
    }

    function step(now) {
      if (destroyed || document.hidden || isReducedMotion()) {
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
        f.phase += dt * 0.75;
        f.x += (f.vx + Math.sin(f.phase) * f.sway) * dt;

        if (f.y > height + 6) {
          f.y = -6;
          f.x = Math.random() * width;
        }
        if (f.x < -6) f.x = width + 6;
        else if (f.x > width + 6) f.x = -6;

        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafId = window.requestAnimationFrame(step);
    }

    function start() {
      if (destroyed || rafId || document.hidden || isReducedMotion()) return;
      lastTime = 0;
      rafId = window.requestAnimationFrame(step);
    }

    function stop() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
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
        canvas.remove();
      }
    };
  }

  function init() {
    if (isHighContrast()) return;
    var season = previewSeason() || getFestiveSeason(new Date());
    if (!season) return;

    var navbar = document.querySelector('header.navbar');
    var footer = document.querySelector('footer.footer');
    var hero = document.querySelector('.hero.hero-studio, .hero.xz-hero');
    if (!navbar && !footer && !hero) return;

    var active = !isDisabledByUser();
    var garland = null;
    var hat = null;
    var heroPill = null;
    var snow = null;
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

    function mountDecorations() {
      if (garland || hat || heroPill || snow || footerBar) return;
      document.documentElement.classList.add('xh-xmas-on');
      document.documentElement.classList.toggle('xh-xmas-newyear', season === 'anonuevo');
      garland = buildGarland(navbar, season);
      hat = buildWordmarkHat(navbar, season);
      heroPill = buildHeroPill(hero, season);
      if (season === 'navidad') snow = createViewportSnow();
      footerBar = buildFooterGreeting(footer, season, function () { setEnabled(false); });
      document.addEventListener('visibilitychange', syncVisibility);
      if (motionMq && motionMq.addEventListener) motionMq.addEventListener('change', onMotionChange);
      syncVisibility();
    }

    function unmountDecorations() {
      document.removeEventListener('visibilitychange', syncVisibility);
      if (motionMq && motionMq.removeEventListener) motionMq.removeEventListener('change', onMotionChange);
      document.documentElement.classList.remove('xh-xmas-on', 'xh-xmas-newyear', 'xh-xmas-paused');
      if (garland) { garland.remove(); garland = null; }
      if (hat) { hat.remove(); hat = null; }
      if (heroPill) { heroPill.remove(); heroPill = null; }
      if (snow) { snow.destroy(); snow = null; }
      if (footerBar) { footerBar.remove(); footerBar = null; }
    }

    var toggle = buildNavbarToggle(navbar, season, function () {
      setEnabled(!active);
    });

    function setEnabled(next) {
      active = Boolean(next);
      setDisabledByUser(!active);
      if (active) mountDecorations(); else unmountDecorations();
      if (toggle) toggle.paint(active);
    }

    if (toggle && window.MutationObserver) {
      new MutationObserver(function () {
        toggle.paint(active);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }

    if (toggle) toggle.paint(active);
    if (active) mountDecorations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
