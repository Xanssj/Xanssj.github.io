/* Preferencias del visitante: tema (automático / claro / oscuro) e idioma (es / en).
   Se carga en el <head> de todas las páginas, antes del CSS que pinta, para no parpadear.
   - Tema: data-theme="light|dark" en <html>; sin atributo sigue al sistema. Lo leen los tokens de ui.css.
   - Idioma: la página está escrita en español; en inglés se traducen los textos con el
     diccionario window.XH_I18N_EN (assets/js/i18n-en.js), que solo cargan las páginas públicas.
     Las páginas sin diccionario (panel, consola) no muestran el botón de idioma. */
(function () {
  var root = document.documentElement;
  var store = {
    get: function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set: function (key, value) { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch (e) { /* sin almacenamiento */ } }
  };

  // ---------- tema
  var THEMES = ['auto', 'light', 'dark'];
  function currentTheme() { var t = store.get('xh-theme'); return t === 'light' || t === 'dark' ? t : 'auto'; }
  function applyTheme(theme) {
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    var dark = theme === 'dark' || (theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      if (theme === 'auto') {
        metas[i].setAttribute('content', /dark/.test(metas[i].getAttribute('media') || '') ? '#000000' : '#f5f5f7');
      } else {
        metas[i].setAttribute('content', dark ? '#000000' : '#f5f5f7');
      }
    }
  }
  applyTheme(currentTheme());

  // ---------- idioma
  var lang = store.get('xh-lang') === 'en' ? 'en' : 'es';
  if (lang === 'en') root.classList.add('xh-i18n-pending');
  var originals = new WeakMap();   // nodo de texto → texto original en español
  var attrOriginals = new WeakMap(); // elemento → { atributo: original }
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var observer = null;
  var busy = false;

  function dict() { return window.XH_I18N_EN || null; }
  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function lookup(text) {
    var d = dict();
    if (!d) return null;
    var key = norm(text);
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(d.text, key)) return d.text[key];
    var patterns = d.patterns || [];
    for (var i = 0; i < patterns.length; i++) {
      var m = key.match(patterns[i][0]);
      if (m) return typeof patterns[i][1] === 'function' ? patterns[i][1].apply(null, m) : key.replace(patterns[i][0], patterns[i][1]);
    }
    return null;
  }
  function skip(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.tagName === 'TEXTAREA' || n.hasAttribute('data-no-translate'))) return true;
    }
    return false;
  }
  function translateText(node) {
    if (!node.nodeValue || !node.nodeValue.trim() || !node.parentElement || skip(node.parentElement)) return;
    var source = originals.has(node) && originals.get(node).shown === node.nodeValue ? originals.get(node).es : node.nodeValue;
    var en = lookup(source);
    if (en == null) return;
    var lead = source.match(/^\s*/)[0];
    var tail = source.match(/\s*$/)[0];
    var shown = lead + en + tail;
    originals.set(node, { es: source, shown: shown });
    if (node.nodeValue !== shown) node.nodeValue = shown;
  }
  function translateAttrs(el) {
    if (el.closest && el.closest('[data-no-translate], script, style')) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var saved = attrOriginals.get(el) || {};
      var value = el.getAttribute(a);
      var source = saved[a] && saved[a].shown === value ? saved[a].es : value;
      var en = lookup(source);
      if (en == null) continue;
      saved[a] = { es: source, shown: en };
      attrOriginals.set(el, saved);
      if (value !== en) el.setAttribute(a, en);
    }
  }
  function translateTree(rootNode) {
    if (rootNode.nodeType === 3) { translateText(rootNode); return; }
    if (rootNode.nodeType !== 1) return;
    translateAttrs(rootNode);
    var walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node); else translateAttrs(node);
    }
  }
  function restoreTree() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) {
        var saved = originals.get(node);
        if (saved && node.nodeValue === saved.shown) node.nodeValue = saved.es;
        originals.delete(node);
      } else {
        var attrs = attrOriginals.get(node);
        if (!attrs) continue;
        for (var a in attrs) if (node.getAttribute(a) === attrs[a].shown) node.setAttribute(a, attrs[a].es);
        attrOriginals.delete(node);
      }
    }
  }
  var headOriginals = null;
  function translateHead(toEnglish) {
    var desc = document.querySelector('meta[name="description"]');
    if (!headOriginals) headOriginals = { title: document.title, desc: desc ? desc.getAttribute('content') : null };
    if (toEnglish) {
      var t = lookup(headOriginals.title); if (t) document.title = t;
      if (desc && headOriginals.desc) { var d = lookup(headOriginals.desc); if (d) desc.setAttribute('content', d); }
    } else {
      document.title = headOriginals.title;
      if (desc && headOriginals.desc) desc.setAttribute('content', headOriginals.desc);
    }
  }
  function startObserver() {
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function (mutations) {
      if (busy || lang !== 'en') return;
      busy = true;
      try {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'childList') { for (var j = 0; j < m.addedNodes.length; j++) translateTree(m.addedNodes[j]); }
          else if (m.type === 'characterData') translateText(m.target);
          else if (m.type === 'attributes') translateAttrs(m.target);
        }
      } finally { busy = false; }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function legalNotice(show) {
    var main = document.querySelector('main.legal');
    if (!main) return;
    var note = document.getElementById('xh-legal-en');
    if (show && !note && !main.classList.contains('about')) {
      note = document.createElement('p');
      note.id = 'xh-legal-en';
      note.className = 'xh-legal-note';
      note.setAttribute('data-no-translate', '');
      note.textContent = 'This document is available in Spanish only. The Spanish version is the one that applies.';
      main.insertBefore(note, main.firstChild);
    } else if (!show && note) note.remove();
  }
  function applyLang(next) {
    lang = next;
    root.setAttribute('lang', next);
    busy = true;
    try {
      if (next === 'en' && dict()) { translateTree(document.body); translateHead(true); startObserver(); }
      else { restoreTree(); translateHead(false); }
      legalNotice(next === 'en');
    } finally { busy = false; }
    root.classList.remove('xh-i18n-pending');
    document.dispatchEvent(new CustomEvent('xh:lang', { detail: { lang: next } }));
  }

  // ---------- botones de la barra
  var ICONS = {
    auto: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/></svg>',
    light: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  };
  var LABELS = {
    es: { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: oscuro', lang: 'Cambiar a inglés' },
    en: { auto: 'Theme: automatic', light: 'Theme: light', dark: 'Theme: dark', lang: 'Switch to Spanish' }
  };
  function paintButtons() {
    var theme = currentTheme();
    var labels = LABELS[lang];
    var t = document.querySelectorAll('[data-xh-theme]');
    for (var i = 0; i < t.length; i++) {
      t[i].innerHTML = ICONS[theme];
      t[i].setAttribute('aria-label', labels[theme]);
      t[i].setAttribute('title', labels[theme]);
    }
    var l = document.querySelectorAll('[data-xh-lang]');
    for (var j = 0; j < l.length; j++) {
      l[j].textContent = lang === 'en' ? 'EN' : 'ES';
      l[j].setAttribute('aria-label', labels.lang);
      l[j].setAttribute('title', labels.lang);
    }
  }
  function buildButtons() {
    var host = document.querySelector('.navbar-inner') || document.querySelector('.console-side-foot');
    if (!host || host.querySelector('.xh-prefs')) return;
    var box = document.createElement('div');
    box.className = 'xh-prefs';
    box.setAttribute('data-no-translate', '');
    if (dict()) {
      var lb = document.createElement('button');
      lb.type = 'button';
      lb.className = 'xh-pref xh-pref-lang';
      lb.setAttribute('data-xh-lang', '');
      lb.addEventListener('click', function () {
        var next = lang === 'en' ? 'es' : 'en';
        store.set('xh-lang', next === 'en' ? 'en' : null);
        applyLang(next);
        paintButtons();
      });
      box.appendChild(lb);
    }
    var tb = document.createElement('button');
    tb.type = 'button';
    tb.className = 'xh-pref';
    tb.setAttribute('data-xh-theme', '');
    tb.addEventListener('click', function () {
      var next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
      store.set('xh-theme', next === 'auto' ? null : next);
      applyTheme(next);
      paintButtons();
    });
    box.appendChild(tb);
    var before = host.querySelector(':scope > .nav-actions, :scope > .nav-end, :scope > .nav-toggle');
    if (host.classList.contains('console-side-foot')) host.insertBefore(box, host.firstChild);
    else if (before) host.insertBefore(box, before);
    else host.appendChild(box);
    paintButtons();
  }

  function ready() {
    // Los textos legales quedan en español (solo se traduce su menú); el aviso lo explica.
    var legal = document.querySelector('main.legal:not(.about)');
    if (legal) for (var c = legal.firstElementChild; c; c = c.nextElementSibling) if (!c.classList.contains('legal-nav')) c.setAttribute('data-no-translate', '');
    buildButtons();
    if (lang === 'en' && dict()) applyLang('en');
    else { if (lang === 'en') root.setAttribute('lang', 'es'); root.classList.remove('xh-i18n-pending'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
  // Por si algo falla, nunca dejar la página escondida.
  setTimeout(function () { root.classList.remove('xh-i18n-pending'); }, 1500);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (currentTheme() === 'auto') applyTheme('auto'); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  window.xhPrefs = { lang: function () { return lang; }, t: function (s) { return lang === 'en' ? (lookup(s) || s) : s; } };
})();

/* Barra en isla (header.navbar.island): se compacta al bajar y un resaltado se desliza
   entre los enlaces. Sin librerías; con "reducir movimiento" solo cambia de tamaño. */
(function () {
  function init() {
    var bar = document.querySelector('.navbar.island');
    if (!bar) return;
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        bar.classList.toggle('is-compact', window.scrollY > 24 && !bar.matches(':hover'));
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    bar.addEventListener('mouseleave', onScroll);
    bar.addEventListener('mouseenter', function () { bar.classList.remove('is-compact'); });
    onScroll();

    var links = bar.querySelector('.nav-links');
    if (!links || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var glow = document.createElement('span');
    glow.className = 'island-glow';
    glow.setAttribute('aria-hidden', 'true');
    links.insertBefore(glow, links.firstChild);
    function moveTo(a) {
      if (!a) { if (glow.classList.contains('is-on')) glow.classList.remove('is-on'); return; }
      var first = !glow.classList.contains('is-on');
      if (first) glow.style.transition = 'opacity 0.25s';
      glow.style.width = a.offsetWidth + 'px';
      glow.style.transform = 'translateX(' + a.offsetLeft + 'px)';
      if (first) { void glow.offsetWidth; glow.style.transition = ''; }
      if (first) glow.classList.add('is-on');
    }
    function current() { return links.querySelector('a.is-active, a[aria-current="page"]'); }
    links.addEventListener('mouseover', function (e) { var a = e.target.closest('a'); if (a && links.contains(a)) moveTo(a); });
    links.addEventListener('mouseleave', function () { moveTo(current()); });
    // Tras los cambios de tamaño de la isla, vuelve a medir.
    bar.addEventListener('transitionend', function (e) { if (e.target === bar && e.propertyName === 'width' && glow.classList.contains('is-on')) moveTo(links.querySelector('a:hover') || current()); });
    // Cuando el enlace activo cambia al bajar, el resaltado lo sigue (salvo con el cursor encima).
    // Solo mira los enlaces (no el resaltado, que también cambia de clase) y solo actúa si cambió
    // el enlace activo: así no se llama a sí mismo en bucle.
    var lastActive = null;
    var watcher = new MutationObserver(function () {
      var now = current();
      if (now === lastActive) return;
      lastActive = now;
      if (!links.matches(':hover')) moveTo(now);
    });
    Array.prototype.forEach.call(links.querySelectorAll('a'), function (a) {
      watcher.observe(a, { attributes: true, attributeFilter: ['class', 'aria-current'] });
    });
    setTimeout(function () { moveTo(current()); }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* Barras laterales del panel y la consola: un resaltado (.side-glow) se desliza al elemento activo.
   Solo observa la clase de los elementos (nunca la del resaltado) y solo mueve si cambió el activo. */
(function () {
  function setup(list, itemSel, activeSel) {
    if (!list || list.querySelector('.side-glow')) return;
    var glow = document.createElement('span');
    glow.className = 'side-glow';
    glow.setAttribute('aria-hidden', 'true');
    list.insertBefore(glow, list.firstChild);
    list.classList.add('has-side-glow');
    var last = null;
    function target() {
      var el = list.querySelector(activeSel);
      if (!el) return null;
      return el.matches('button, a') ? el : el.querySelector('button, a');
    }
    function place(force) {
      var el = target();
      if (!el || !el.offsetParent) { if (glow.classList.contains('is-on')) glow.classList.remove('is-on'); last = null; return; }
      if (el === last && !force) return;
      var first = !glow.classList.contains('is-on');
      var lr = list.getBoundingClientRect();
      var er = el.getBoundingClientRect();
      if (first) glow.style.transition = 'opacity 0.25s';
      glow.style.width = er.width + 'px';
      glow.style.height = er.height + 'px';
      glow.style.transform = 'translate(' + (er.left - lr.left + list.scrollLeft) + 'px,' + (er.top - lr.top + list.scrollTop) + 'px)';
      if (first) { void glow.offsetWidth; glow.style.transition = ''; glow.classList.add('is-on'); }
      last = el;
    }
    var watcher = new MutationObserver(function () { place(false); });
    Array.prototype.forEach.call(list.querySelectorAll(itemSel), function (item) {
      watcher.observe(item, { attributes: true, attributeFilter: ['class', 'hidden'] });
    });
    var resizeTimer = null;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { place(true); }, 80); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(true); });
    place(true);
  }
  function init() {
    setup(document.querySelector('.client-tab-nav'), 'button', 'button.is-active');
    setup(document.querySelector('.owner-sidebar-menu'), '.owner-menu-item', '.owner-menu-item.is-active');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
