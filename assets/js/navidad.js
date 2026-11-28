/* Decoración de temporada de Xhanni Studios (hora local):
   - Navidad (28 de noviembre al 30 de diciembre): gorro SVG sobre la "x" de xhanni,
     píldora de saludo en el hero, guirnalda dorado/menta/rojo suave, nieve ligera en
     portada y xhannizer0.html, saludo en el pie e interruptor en la barra.
   - Año Nuevo (31 de diciembre al 2 de enero): destello dorado sobre la "x", píldora de
     Año Nuevo, guirnalda dorado/champagne, sin nieve, saludo de Año Nuevo e interruptor.
   - Desde el 3 de enero: modo normal (apagada sola).
   - Interruptor en la barra y enlace "Quitar decoración" guardados en localStorage;
     respeta prefers-reduced-motion, prefers-contrast/forced-colors y pausa al ocultar. */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'xh-navidad-off';
  var LIGHT_COUNT = 18;
  var MAX_FLAKES = 28;

  var SVG_HAT =
    '<svg viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M4.5 14.5C5.2 8.2 9.4 3.4 15.8 3.2C18.4 3.1 20.5 4.8 21 7.2C19.2 6.8 17.6 7.5 16.5 9.2C15.5 10.8 15.6 12.9 16 14.5H4.5Z" fill="var(--xmas-hat-red)"/>' +
      '<path d="M15.8 3.2C17.8 3.2 19.6 4.2 20.6 5.9C18.7 5.5 16.7 6.2 15.1 7.9C13.9 9.2 13.4 11.4 13.7 14.5H16C15.6 12.9 15.5 10.8 16.5 9.2C17.6 7.5 19.2 6.8 21 7.2C20.5 4.8 18.4 3.1 15.8 3.2Z" fill="var(--xmas-hat-red-deep)" opacity="0.45"/>' +
      '<rect x="2.6" y="13.4" width="15.2" height="3.8" rx="1.9" fill="var(--xmas-hat-white)"/>' +
      '<circle cx="21" cy="7.6" r="2.3" fill="var(--xmas-hat-white)"/>' +
    '</svg>';

  var SVG_SPARKLE =
    '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M10 1.5L12.1 7.9L18.5 10L12.1 12.1L10 18.5L7.9 12.1L1.5 10L7.9 7.9L10 1.5Z" fill="var(--xmas-gold)"/>' +
      '<circle cx="15.8" cy="4.2" r="1.4" fill="var(--xmas-champagne)"/>' +
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
    for (var i = 0; i < LIGHT_COUNT; i++) {
      var dot = document.createElement('span');
      if (season === 'anonuevo') {
        dot.className = 'xh-xmas-dot' + (i % 2 === 1 ? ' is-champagne' : '');
      } else {
        var mod = i % 3;
        dot.className = 'xh-xmas-dot' + (mod === 1 ? ' is-mint' : mod === 2 ? ' is-red' : '');
      }
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
      return (val && val.trim()) || 'rgba(255, 255, 255, 0.58)';
    }

    function seedFlakes() {
      flakes = [];
      var count = Math.min(MAX_FLAKES, width < 640 ? 18 : MAX_FLAKES);
      for (var i = 0; i < count; i++) {
        var duration = 8 + Math.random() * 6; // 8 a 14 s por recorrido
        flakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 1.2 + Math.random() * 1.1, // 2.4 a 4.6 px de diámetro
          vy: (height || 500) / duration,
          vx: (Math.random() - 0.5) * 11,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.52 + Math.random() * 0.44
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
          var duration = 8 + (i % 7);
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
        f.x += (f.vx + Math.sin(f.phase) * 6.5) * dt;

        if (f.y > height + 5) {
          f.y = -5;
          f.x = Math.random() * width;
        }
        if (f.x < -5) f.x = width + 5;
        else if (f.x > width + 5) f.x = -5;

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
      garland = buildGarland(navbar, season);
      hat = buildWordmarkHat(navbar, season);
      heroPill = buildHeroPill(hero, season);
      if (season === 'navidad' && hero) snow = createHeroSnow(hero);
      footerBar = buildFooterGreeting(footer, season, function () { setEnabled(false); });
      document.addEventListener('visibilitychange', syncVisibility);
      if (motionMq && motionMq.addEventListener) motionMq.addEventListener('change', onMotionChange);
      syncVisibility();
    }

    function unmountDecorations() {
      document.removeEventListener('visibilitychange', syncVisibility);
      if (motionMq && motionMq.removeEventListener) motionMq.removeEventListener('change', onMotionChange);
      document.documentElement.classList.remove('xh-xmas-paused');
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
