/* Nosotros: animaciones propias, sin librerías.
   - Motor: resortes (posición) y tweens (tamaño) en un solo requestAnimationFrame, con tiempo real.
   - --spring: curva CSS linear() calculada desde un resorte, para las transiciones de CSS.
   - Títulos [data-split]: palabra por palabra, desenfocadas y con rebote.
   - Frase [data-scrub]: sus palabras se encienden a medida que se baja.
   - [data-reveal]: entra al aparecer en pantalla (--i = orden).
   - Barra flotante .ab-dock: el indicador salta con resorte a la sección visible.
   - [data-magnetic]: sigue un poco al cursor.
   - Ficha [data-person]: la tarjeta se convierte en ventana. Crece solo el marco (ancho, alto,
     borde; nunca scale), la posición va con resortes y el contenido entra desenfocado.
   Con "reducir movimiento" todo aparece sin animar. Se inicia después de que prefs.js traduce,
   porque separar en palabras cambia los textos. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------------------------------------------------------------- motor
  var jobs = new Set();
  var last = 0;
  function tick(now) {
    // Tiempo real (hasta 100 ms): si el equipo va lento, salta cuadros pero no se alarga.
    var dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    jobs.forEach(function (job) { if (job(dt)) jobs.delete(job); });
    if (jobs.size) requestAnimationFrame(tick); else last = 0;
  }
  function run(job) { jobs.add(job); if (jobs.size === 1) requestAnimationFrame(tick); return function () { jobs.delete(job); }; }

  function stepSpring(s, to, k, c, dt) {
    var steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps; // pasos cortos: estable con cualquier dt
    for (var i = 0; i < steps; i++) { var a = -k * (s.x - to) - c * s.v; s.v += a * h; s.x += s.v * h; }
  }
  function spring(from, to, opts, onUpdate, onDone) {
    var s = { x: from, v: opts.velocity || 0 }, k = opts.stiffness || 170, c = opts.damping || 18;
    return run(function (dt) {
      stepSpring(s, to, k, c, dt);
      var done = Math.abs(s.v) < 2 && Math.abs(s.x - to) < 0.4;
      onUpdate(done ? to : s.x);
      if (done && onDone) onDone();
      return done;
    });
  }
  function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
  function tween(duration, onUpdate, onDone, delay) {
    var t = -(delay || 0);
    return run(function (dt) {
      t += dt;
      if (t < 0) return false;
      var p = Math.min(1, t / duration);
      onUpdate(easeOutQuint(p));
      if (p >= 1) { if (onDone) onDone(); return true; }
      return false;
    });
  }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Curva CSS de resorte: se simula un resorte de 0 a 1 y se muestrea en linear().
  function springCurve(k, c, seconds, samples) {
    var s = { x: 0, v: 0 }, dt = seconds / samples, pts = ['0'];
    for (var i = 1; i <= samples; i++) { stepSpring(s, 1, k, c, dt); pts.push(s.x.toFixed(4)); }
    pts[pts.length - 1] = '1';
    return 'linear(' + pts.join(', ') + ')';
  }

  // ---------------------------------------------------------------- separar en palabras
  function splitWords(el, wrapInner) {
    var words = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var w = document.createElement('span');
        w.className = 'ab-w';
        if (wrapInner) { var inner = document.createElement('span'); inner.textContent = part; w.appendChild(inner); }
        else w.textContent = part;
        frag.appendChild(w);
        words.push(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    // Los lectores de pantalla leen la frase entera, no palabra por palabra.
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    words.forEach(function (w) { w.setAttribute('aria-hidden', 'true'); });
    return words;
  }

  function init() {
    if (!reduce) {
      root.classList.add('ab-motion');
      if (window.CSS && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)')) {
        root.style.setProperty('--spring', springCurve(150, 15, 1.1, 60));
      }
    }

    // Títulos palabra por palabra
    var splits = document.querySelectorAll('[data-split]');
    splits.forEach(function (el) {
      if (reduce) return;
      var words = splitWords(el, true);
      words.forEach(function (w, i) { w.firstChild.style.setProperty('--d', (120 + i * 70) + 'ms'); });
    });

    // Frase que se enciende al bajar
    var scrub = document.querySelector('[data-scrub]');
    var scrubWords = scrub ? splitWords(scrub, false) : [];
    if (scrub && reduce) scrubWords.forEach(function (w) { w.classList.add('is-lit'); });

    if (reduce) return;

    // Entrada inicial
    requestAnimationFrame(function () {
      root.classList.add('ab-ready');
      splits.forEach(function (el) { if (!el.hasAttribute('data-split-on-view')) el.classList.add('is-in'); });
    });
    setTimeout(function () { root.classList.add('ab-dock-in'); }, 900);

    // Aparecer en pantalla
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
      document.querySelectorAll('[data-reveal], [data-split-on-view]').forEach(function (el) { io.observe(el); });
    } else {
      document.querySelectorAll('[data-reveal], [data-split]').forEach(function (el) { el.classList.add('is-in'); });
    }

    // Scroll: frase y barra flotante
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        if (scrub) {
          var r = scrub.getBoundingClientRect(), vh = window.innerHeight;
          var p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.35), 0, 1);
          var lit = Math.round(p * scrubWords.length);
          for (var i = 0; i < scrubWords.length; i++) scrubWords[i].classList.toggle('is-lit', i < lit);
        }
        updateDock();
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { dockSnap = true; onScroll(); });
    onScroll();
  }

  // ---------------------------------------------------------------- barra flotante
  var dock = document.querySelector('.ab-dock');
  var pill = dock && dock.querySelector('.ab-dock-pill');
  var dockLinks = dock ? Array.prototype.slice.call(dock.querySelectorAll('[data-dock]')) : [];
  var sections = dockLinks.map(function (a) { return document.getElementById(a.getAttribute('data-dock')); });
  var dockState = { x: 0, w: 0 }, dockActive = null, dockSnap = true, stopDock = [];
  function updateDock() {
    if (!dock || !sections.length) return;
    var vh = window.innerHeight, current = 0;
    sections.forEach(function (sec, i) { if (sec && sec.getBoundingClientRect().top < vh * 0.45) current = i; });
    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 4) current = sections.length - 1;
    if (current === dockActive && !dockSnap) return;
    dockActive = current;
    dockLinks.forEach(function (a, i) { a.classList.toggle('is-active', i === current); if (i === current) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    var link = dockLinks[current];
    var tx = link.offsetLeft, tw = link.offsetWidth;
    stopDock.forEach(function (f) { f(); });
    if (dockSnap || reduce) {
      dockSnap = false;
      dockState.x = tx; dockState.w = tw; paintDock();
      return;
    }
    stopDock = [
      spring(dockState.x, tx, { stiffness: 260, damping: 22 }, function (v) { dockState.x = v; paintDock(); }),
      spring(dockState.w, tw, { stiffness: 260, damping: 22 }, function (v) { dockState.w = v; paintDock(); })
    ];
  }
  function paintDock() { pill.style.width = dockState.w + 'px'; pill.style.transform = 'translateX(' + dockState.x + 'px)'; }
  dockLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.getElementById(a.getAttribute('data-dock'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + target.id);
    });
  });

  // ---------------------------------------------------------------- magnéticos
  function magnetize(scope) {
    if (!finePointer || reduce) return;
    (scope || document).querySelectorAll('[data-magnetic]').forEach(function (el) {
      if (el.__magnetic) return;
      el.__magnetic = true;
      var st = { x: 0, y: 0 }, stops = [];
      function paint() { el.style.transform = 'translate(' + st.x.toFixed(2) + 'px,' + st.y.toFixed(2) + 'px)'; }
      function go(tx, ty) {
        stops.forEach(function (f) { f(); });
        stops = [
          spring(st.x, tx, { stiffness: 240, damping: 15 }, function (v) { st.x = v; paint(); }),
          spring(st.y, ty, { stiffness: 240, damping: 15 }, function (v) { st.y = v; paint(); })
        ];
      }
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        go((e.clientX - (r.left + r.width / 2)) * 0.3, (e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', function () { go(0, 0); });
    });
  }

  // ---------------------------------------------------------------- ficha del equipo
  var layer = null, shell = null, body = null, scrim = null, openCard = null, busy = false, lastFocus = null;

  function buildLayer() {
    layer = document.createElement('div');
    layer.className = 'ab-sheet-layer';
    layer.hidden = true;
    scrim = document.createElement('div');
    scrim.className = 'ab-sheet-scrim';
    shell = document.createElement('div');
    shell.className = 'ab-sheet';
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.tabIndex = -1;
    body = document.createElement('div');
    body.className = 'ab-sheet-body';
    shell.appendChild(body);
    layer.appendChild(scrim);
    layer.appendChild(shell);
    document.body.appendChild(layer);
    scrim.addEventListener('click', close);
    layer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(shell.querySelectorAll('a[href], button:not([disabled]), input:not([tabindex="-1"]), textarea'), function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    });
  }
  function radiusOf(el) { return parseFloat(getComputedStyle(el).borderTopLeftRadius) || 24; }
  function setShell(g) {
    shell.style.width = g.w + 'px';
    shell.style.height = g.h + 'px';
    shell.style.borderRadius = g.r + 'px';
    shell.style.transform = 'translate3d(' + g.x + 'px,' + g.y + 'px,0)';
  }

  // La ventana nace del elemento que se tocó (tarjeta o botón) y vuelve a él al cerrar.
  function open(card, source) {
    if (busy || openCard) return;
    if (!layer) buildLayer();
    source = source || card.querySelector('[data-person-detail]');
    if (!source) return;
    busy = true;
    openCard = card;
    lastFocus = document.activeElement;

    body.innerHTML = '';
    for (var n = source.firstChild; n; n = n.nextSibling) body.appendChild(n.cloneNode(true));
    var heading = body.querySelector('h2, h3');
    if (heading) { heading.id = 'ab-sheet-title'; shell.setAttribute('aria-labelledby', 'ab-sheet-title'); }
    body.querySelectorAll('[data-sheet-close]').forEach(function (b) { b.addEventListener('click', close); });
    var form = body.querySelector('[data-contact-form]');
    if (form) bindContactForm(form);
    magnetize(body);

    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var W = Math.min(580, vw - 24);
    layer.hidden = false;
    body.style.width = W + 'px'; // el contenido ya tiene su ancho final: no se reacomoda en vuelo
    var H = Math.min(body.scrollHeight, vh - 40);
    var to = { x: Math.round((vw - W) / 2), y: Math.round((vh - H) / 2), w: W, h: H, r: 34 };
    var rect = card.getBoundingClientRect();
    var from = { x: rect.left, y: rect.top, w: rect.width, h: rect.height, r: Math.min(radiusOf(card), rect.height / 2) };
    root.classList.add('ab-sheet-open');
    card.classList.add('is-lifted');

    if (reduce) {
      setShell(to); shell.classList.add('is-settled'); body.style.opacity = 1; scrim.style.opacity = 1;
      busy = false; shell.focus(); return;
    }

    setShell(from);
    body.style.opacity = 0;
    body.style.filter = 'blur(12px)';
    body.style.transform = 'scale(1.08)';
    shell.classList.remove('is-settled');
    void shell.offsetWidth;
    shell.classList.add('is-flying');

    var g = { x: from.x, y: from.y, w: from.w, h: from.h, r: from.r };
    var left = 3;
    function done() { if (--left === 0) { busy = false; shell.classList.add('is-settled'); } }
    var kick = 1000; // empujón hacia el centro: curva el recorrido
    spring(from.x, to.x, { stiffness: 150, damping: 15, velocity: Math.sign(to.x - from.x) * kick }, function (v) { g.x = v; setShell(g); }, done);
    spring(from.y, to.y, { stiffness: 150, damping: 15, velocity: Math.sign(to.y - from.y) * kick * 0.6 }, function (v) { g.y = v; setShell(g); });
    tween(0.36, function (p) { g.w = lerp(from.w, to.w, p); g.h = lerp(from.h, to.h, p); g.r = lerp(from.r, to.r, p); setShell(g); }, done);
    tween(0.45, function (p) {
      body.style.opacity = p;
      body.style.filter = 'blur(' + (12 * (1 - p)).toFixed(2) + 'px)';
      body.style.transform = 'scale(' + (1 + 0.08 * (1 - p)).toFixed(4) + ')';
    }, function () { body.style.filter = ''; body.style.transform = ''; done(); }, 0.1);
    tween(0.35, function (p) { scrim.style.opacity = p; });
    setTimeout(function () {
      var first = body.querySelector('input:not([type=hidden]):not([tabindex="-1"])');
      (first && finePointer ? first : shell).focus({ preventScroll: true });
    }, form ? 420 : 60);
  }

  // Cambia el alto de la ventana con suavidad cuando su contenido cambia (error, enviado).
  function refit() {
    if (!openCard) return;
    var from = shell.getBoundingClientRect();
    var H = Math.min(body.scrollHeight, window.innerHeight - 40);
    if (Math.abs(H - from.height) < 1) return;
    var g = { x: from.left, y: from.top, w: from.width, h: from.height, r: 34 };
    var toY = Math.round((window.innerHeight - H) / 2);
    if (reduce) { g.h = H; g.y = toY; setShell(g); return; }
    var y0 = g.y, h0 = g.h;
    tween(0.4, function (p) { g.h = lerp(h0, H, p); g.y = lerp(y0, toY, p); setShell(g); });
  }

  // ---------------------------------------------------------------- formulario de contacto
  function bindContactForm(form) {
    var error = form.querySelector('.as-error');
    var submit = form.querySelector('.as-submit');
    var types = Array.prototype.slice.call(form.querySelectorAll('[data-type]'));
    types.forEach(function (b) {
      b.addEventListener('click', function () {
        types.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      });
    });
    function fail(text) { error.textContent = text; error.hidden = false; refit(); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      error.hidden = true;
      var data = {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        message: form.elements.message.value.trim(),
        website: form.elements.website.value,
        projectType: 'Otro'
      };
      var picked = form.querySelector('[data-type][aria-pressed="true"]');
      if (picked) data.projectType = picked.getAttribute('data-type');
      var t = (window.xhPrefs && window.xhPrefs.t) || function (s) { return s; };
      if (data.name.length < 2) { form.elements.name.focus(); return fail(t('Escribe tu nombre')); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) { form.elements.email.focus(); return fail(t('Revisa tu correo')); }
      if (data.message.length < 10) { form.elements.message.focus(); return fail(t('Cuéntanos un poco más (mínimo 10 caracteres)')); }
      submit.disabled = true;
      var label = submit.textContent;
      submit.textContent = t('Enviando…');
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (r) {
          if (!r.ok || r.json.success === false) throw new Error(r.json.error || '');
          var done = body.querySelector('.as-done');
          var head = body.querySelector('.as-head');
          form.hidden = true;
          if (head) head.hidden = true;
          done.hidden = false;
          var ok = done.querySelector('button');
          refit();
          if (ok) setTimeout(function () { ok.focus({ preventScroll: true }); }, 50);
        })
        .catch(function (err) {
          submit.disabled = false;
          submit.textContent = label;
          fail(t(err.message || 'No pudimos enviar tu mensaje. Intenta de nuevo.') );
        });
    });
  }

  function close() {
    if (!openCard || busy) return;
    busy = true;
    var card = openCard;
    function finish() {
      layer.hidden = true;
      card.classList.remove('is-lifted');
      shell.classList.remove('is-flying', 'is-settled');
      root.classList.remove('ab-sheet-open');
      openCard = null; busy = false;
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    if (reduce) { finish(); return; }
    var r0 = shell.getBoundingClientRect();
    var rect = card.getBoundingClientRect();
    var from = { x: r0.left, y: r0.top, w: r0.width, h: r0.height, r: 34 };
    var to = { x: rect.left, y: rect.top, w: rect.width, h: rect.height, r: radiusOf(card) };
    var g = { x: from.x, y: from.y, w: from.w, h: from.h, r: from.r };
    shell.classList.remove('is-settled');
    var left = 2;
    function done() { if (--left === 0) finish(); }
    tween(0.16, function (p) { body.style.opacity = 1 - p; body.style.filter = 'blur(' + (10 * p).toFixed(2) + 'px)'; });
    tween(0.32, function (p) { g.w = lerp(from.w, to.w, p); g.h = lerp(from.h, to.h, p); g.r = lerp(from.r, to.r, p); setShell(g); }, done, 0.04);
    spring(from.x, to.x, { stiffness: 220, damping: 24 }, function (v) { g.x = v; setShell(g); }, done);
    spring(from.y, to.y, { stiffness: 220, damping: 24 }, function (v) { g.y = v; setShell(g); });
    tween(0.32, function (p) { scrim.style.opacity = 1 - p; });
  }

  document.querySelectorAll('[data-person]').forEach(function (card) {
    card.addEventListener('click', function (e) { if (!e.target.closest('a')) open(card); });
    card.addEventListener('keydown', function (e) {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(card); }
    });
  });
  document.querySelectorAll('[data-open-sheet]').forEach(function (btn) {
    var source = document.getElementById(btn.getAttribute('data-open-sheet'));
    if (!source) return;
    btn.addEventListener('click', function (e) { e.preventDefault(); open(btn, source); });
  });
  // En móvil el teclado cambia el alto de la ventana: solo se cierra si cambia el ancho.
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    if (openCard && !busy) close();
  });

  function start() { init(); magnetize(document); }
  // Después de prefs.js (que traduce en DOMContentLoaded y registró su escucha antes).
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
