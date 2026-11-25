/* Reproductor de música de Nosotros.
   Flota abajo a la izquierda como una píldora negra (portada + barras); al tocarlo crece como una
   isla con portada, título, artista, barra de avance y controles. Las canciones se listan en
   nosotros.html, en <script type="application/json" id="ab-playlist">: [{ "src", "title", "artist",
   "cover" }]. Sin canciones no aparece. Los navegadores no dejan sonar música antes de que la
   persona toque la página: se intenta al entrar y, si lo bloquean, empieza con el primer toque o
   tecla. Si la persona la pausa, no vuelve a sonar sola en sus próximas visitas (xh-music = off).
   Volumen: fader y botón de silencio (se recuerdan en xh-volume y xh-muted). En iPhone el navegador
   no deja cambiar audio.volume, así que el volumen pasa por Web Audio (un GainNode) desde el primer
   toque de la persona.
   Con { "spotify": "https://open.spotify.com/playlist/…" } usa el reproductor oficial de Spotify
   dentro de la isla (bloque al final). */
/* Piezas comunes a los dos modos del reproductor.
   movable: la isla se arrastra a cualquier parte de la pantalla (de la píldora o de la cabecera
   abierta) y al soltarla se pega con resorte al borde izquierdo o derecho más cercano (o hacia donde
   se lanzó), como la imagen dentro de imagen del iPhone. Mientras se arrastra se inclina según la
   velocidad. La posición se recuerda (xh-player-pos). Abierta, crece hacia el centro de la pantalla
   y nunca tapa la barra de secciones.
   magnet: los botones se corren un poco hacia el cursor. */
var __xhPlayerKit = (function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var KEY = 'xh-player-pos';

  function readPos() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (p && (p.side === 'left' || p.side === 'right') && (p.b == null || isFinite(p.b))) return p;
    } catch (e) { /* sin almacenamiento */ }
    return { side: 'left', b: null };
  }
  function savePos(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* sin almacenamiento */ } }

  function movable(root, opts) {
    var pos = readPos();
    var W = 0;
    var H = 0;
    function margin() { return window.innerWidth <= 820 ? 14 : 18; }
    // Sobre la barra de secciones (centrada abajo) cuando podrían chocar.
    function minBottom() {
      var dockClash = window.innerWidth <= 820 || (opts.isOpen() && window.innerWidth <= 1180);
      return dockClash ? 78 : 18;
    }
    function clampB(b) { return Math.max(minBottom(), Math.min(b, window.innerHeight - H - 12)); }
    function place() {
      var m = margin();
      var b = clampB(pos.b == null ? minBottom() : pos.b);
      var left = pos.side === 'left' ? m : window.innerWidth - W - m;
      root.style.left = Math.max(m, left) + 'px';
      root.style.bottom = b + 'px';
      root.classList.toggle('is-right', pos.side === 'right');
    }
    function size(w, h) {
      W = w;
      H = h;
      root.style.width = w + 'px';
      root.style.height = h + 'px';
      place();
    }

    // Arrastrar
    var start = null;
    var dragging = false;
    var last = null;
    var vx = 0;
    var swallowClick = false;
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      var handle = e.target.closest(opts.handle);
      if (!handle || !root.contains(handle)) return;
      // Dentro de la isla abierta, los botones y las barras siguen siendo botones y barras.
      var control = e.target.closest('button, a, [role="slider"]');
      if (control && !control.classList.contains('ap-mini')) return;
      var r = root.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, left: r.left, bottom: window.innerHeight - r.bottom, id: e.pointerId };
      last = { x: e.clientX, t: performance.now() };
      vx = 0;
    }
    function onMove(e) {
      if (!start || e.pointerId !== start.id) return;
      var dx = e.clientX - start.x;
      var dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) + Math.abs(dy) < 7) return;
        dragging = true;
        root.classList.add('is-dragging');
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      }
      var now = performance.now();
      var dt = Math.max(1, now - last.t);
      vx = vx * 0.6 + ((e.clientX - last.x) / dt) * 0.4;
      last = { x: e.clientX, t: now };
      var left = Math.max(4, Math.min(window.innerWidth - W - 4, start.left + dx));
      var bottom = Math.max(4, Math.min(window.innerHeight - H - 4, start.bottom - dy));
      root.style.left = left + 'px';
      root.style.bottom = bottom + 'px';
      if (!reduce) root.style.setProperty('--ap-tilt', Math.max(-9, Math.min(9, vx * 7)).toFixed(2) + 'deg');
      e.preventDefault();
    }
    function onUp(e) {
      if (!start || (e && e.pointerId !== start.id)) return;
      var was = dragging;
      start = null;
      dragging = false;
      if (!was) return;
      var r = root.getBoundingClientRect();
      var center = r.left + r.width / 2 + vx * 160; // un lanzamiento rápido cruza la pantalla
      pos = { side: center < window.innerWidth / 2 ? 'left' : 'right', b: window.innerHeight - r.bottom };
      pos.b = clampB(pos.b);
      savePos(pos);
      root.classList.remove('is-dragging');
      root.style.setProperty('--ap-tilt', '0deg');
      place();
      swallowClick = true;
      setTimeout(function () { swallowClick = false; }, 60);
    }
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('lostpointercapture', onUp);
    // Soltar después de arrastrar no cuenta como toque (no abre la isla).
    root.addEventListener('click', function (e) { if (swallowClick) { e.stopPropagation(); e.preventDefault(); swallowClick = false; } }, true);
    window.addEventListener('resize', place);
    return { size: size, place: place };
  }

  function magnet(root) {
    if (!fine || reduce) return;
    root.addEventListener('pointermove', function (e) {
      var btn = e.target.closest('.ap-btn');
      if (!btn || root.classList.contains('is-dragging')) return;
      var r = btn.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) * 0.22;
      var y = (e.clientY - (r.top + r.height / 2)) * 0.22;
      btn.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
    });
    root.addEventListener('pointerout', function (e) {
      var btn = e.target.closest('.ap-btn');
      if (btn && !btn.contains(e.relatedTarget)) btn.style.translate = '';
    });
  }

  return { movable: movable, magnet: magnet, reduce: reduce };
})();

(function () {
  'use strict';

  var listNode = document.getElementById('ab-playlist');
  var config = [];
  try { config = JSON.parse(listNode ? listNode.textContent : '[]'); } catch (e) { config = []; }
  if (!Array.isArray(config)) return; // { "spotify": … } lo atiende el bloque de Spotify, al final
  var tracks = config.filter(function (t) { return t && t.src; });
  if (!tracks.length) return;
  // La primera suena primero; el resto se mezcla en cada visita.
  for (var si = tracks.length - 1; si > 1; si--) { var sj = 1 + Math.floor(Math.random() * si); var sx = tracks[si]; tracks[si] = tracks[sj]; tracks[sj] = sx; }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saved = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } } };
  var volume = parseFloat(saved.get('xh-volume'));
  if (!isFinite(volume) || volume < 0 || volume > 1) volume = 0.6;
  var muted = saved.get('xh-muted') === '1';
  var target = function () { return muted ? 0 : volume; };
  var t = function (s) { return window.xhPrefs && window.xhPrefs.t ? window.xhPrefs.t(s) : s; };
  var store = {
    get: function () { try { return localStorage.getItem('xh-music'); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem('xh-music', v); } catch (e) { /* sin almacenamiento */ } }
  };

  var ICONS = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="3.5" width="4.5" height="17" rx="1.6" fill="currentColor"/><rect x="14" y="3.5" width="4.5" height="17" rx="1.6" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 28 24" aria-hidden="true"><path d="M13 6.2v11.6a.9.9 0 0 1-1.4.75L3.2 12.75a.9.9 0 0 1 0-1.5l8.4-5.8a.9.9 0 0 1 1.4.75Zm12 0v11.6a.9.9 0 0 1-1.4.75l-8.4-5.8a.9.9 0 0 1 0-1.5l8.4-5.8a.9.9 0 0 1 1.4.75Z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 28 24" aria-hidden="true"><path d="M3 6.2v11.6a.9.9 0 0 0 1.4.75l8.4-5.8a.9.9 0 0 0 0-1.5l-8.4-5.8A.9.9 0 0 0 3 6.2Zm12 0v11.6a.9.9 0 0 0 1.4.75l8.4-5.8a.9.9 0 0 0 0-1.5l-8.4-5.8A.9.9 0 0 0 15 6.2Z" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9.5 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    volHigh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.3v13.4l-4.8-4.2H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    volLow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.3v13.4l-4.8-4.2H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    volOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.3v13.4l-4.8-4.2H4z" fill="currentColor"/><path d="m15.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.5a2.5 2.5 0 1 1-2.5-2.5c.9 0 1.7.2 2.5.6V6.2a1 1 0 0 1 .78-.98l9-2A1 1 0 0 1 20 4.2v12.3a2.5 2.5 0 1 1-2.5-2.5c.9 0 1.7.2 2.5.6V8.1l-9 2v8.4Z" fill="currentColor"/></svg>'
  };
  var bars = function (n) { var s = ''; for (var i = 0; i < n; i++) s += '<i style="--b:' + i + '"></i>'; return s; };

  var root = document.createElement('div');
  root.className = 'ab-player';
  root.setAttribute('data-no-translate', '');
  root.innerHTML =
    '<button type="button" class="ap-mini" aria-expanded="false">' +
      '<span class="ap-art"><img alt="" data-ap-cover><span class="ap-art-note">' + ICONS.note + '</span></span>' +
      '<span class="ap-eq">' + bars(4) + '</span>' +
    '</button>' +
    '<div class="ap-full" role="group" inert>' +
      '<button type="button" class="ap-btn ap-btn-close" data-ap="close">' + ICONS.down + '</button>' +
      '<div class="ap-head">' +
        '<span class="ap-art ap-art-lg"><img alt="" data-ap-cover><span class="ap-art-note">' + ICONS.note + '</span></span>' +
        '<div class="ap-meta"><strong data-ap-title></strong><span data-ap-artist></span></div>' +
        '<span class="ap-eq ap-eq-lg">' + bars(5) + '</span>' +
      '</div>' +
      '<div class="ap-time">' +
        '<span data-ap-cur>0:00</span>' +
        '<div class="ap-bar" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i class="ap-fill"></i></div>' +
        '<span data-ap-left>-0:00</span>' +
      '</div>' +
      '<div class="ap-ctrl">' +
        '<button type="button" class="ap-btn" data-ap="prev">' + ICONS.prev + '</button>' +
        '<button type="button" class="ap-btn ap-btn-main" data-ap="toggle">' + ICONS.play + '</button>' +
        '<button type="button" class="ap-btn" data-ap="next">' + ICONS.next + '</button>' +
        '<button type="button" class="ap-btn ap-btn-side" data-ap="mute"></button>' +
      '</div>' +
      '<div class="ap-vol">' +
        '<span class="ap-vol-ico">' + ICONS.volOff + '</span>' +
        '<div class="ap-bar ap-vol-bar" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100"><i class="ap-fill"></i></div>' +
        '<span class="ap-vol-ico">' + ICONS.volHigh + '</span>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);
  var mover = __xhPlayerKit.movable(root, { handle: '.ap-mini, .ap-head', isOpen: function () { return open; } });
  __xhPlayerKit.magnet(root);

  var mini = root.querySelector('.ap-mini');
  var full = root.querySelector('.ap-full');
  var bar = root.querySelector('.ap-bar');
  var fill = root.querySelector('.ap-fill');
  var curEl = root.querySelector('[data-ap-cur]');
  var leftEl = root.querySelector('[data-ap-left]');
  var toggleBtn = root.querySelector('[data-ap="toggle"]');
  var muteBtn = root.querySelector('[data-ap="mute"]');
  var volBar = root.querySelector('.ap-vol-bar');
  var volFill = volBar.querySelector('.ap-fill');
  var audio = new Audio();
  audio.preload = 'metadata';
  var index = 0;
  var open = false;
  var seeking = false;
  var fadeTimer = null;

  function labels() {
    mini.setAttribute('aria-label', t('Abrir el reproductor de música'));
    full.setAttribute('aria-label', t('Reproductor de música'));
    bar.setAttribute('aria-label', t('Avance de la canción'));
    root.querySelector('[data-ap="prev"]').setAttribute('aria-label', t('Canción anterior'));
    root.querySelector('[data-ap="next"]').setAttribute('aria-label', t('Canción siguiente'));
    root.querySelector('[data-ap="close"]').setAttribute('aria-label', t('Achicar el reproductor'));
    toggleBtn.setAttribute('aria-label', audio.paused ? t('Reproducir') : t('Pausar'));
    volBar.setAttribute('aria-label', t('Volumen'));
    paintVol();
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Color de la portada para las barras (como la isla del iPhone).
  function tintFrom(img) {
    try {
      var c = document.createElement('canvas');
      c.width = c.height = 12;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 12, 12);
      var d = ctx.getImageData(0, 0, 12, 12).data;
      var r = 0, g = 0, b = 0, w = 0;
      for (var i = 0; i < d.length; i += 4) {
        var max = Math.max(d[i], d[i + 1], d[i + 2]);
        var min = Math.min(d[i], d[i + 1], d[i + 2]);
        var weight = 1 + (max - min) / 40; // los colores vivos pesan más que los grises
        r += d[i] * weight; g += d[i + 1] * weight; b += d[i + 2] * weight; w += weight;
      }
      r /= w; g /= w; b /= w;
      var top = Math.max(r, g, b) || 1;
      var k = Math.max(1, 205 / top); // que se vea sobre el negro
      root.style.setProperty('--ap-tint', 'rgb(' + Math.min(255, Math.round(r * k)) + ',' + Math.min(255, Math.round(g * k)) + ',' + Math.min(255, Math.round(b * k)) + ')');
    } catch (e) { /* portada de otro dominio: queda el color por defecto */ }
  }

  function load(i, autoplay) {
    index = (i + tracks.length) % tracks.length;
    var track = tracks[index];
    audio.src = track.src;
    root.querySelector('[data-ap-title]').textContent = track.title || '';
    root.querySelector('[data-ap-artist]').textContent = track.artist || '';
    root.classList.toggle('has-cover', !!track.cover);
    Array.prototype.forEach.call(root.querySelectorAll('[data-ap-cover]'), function (img) {
      if (track.cover) img.src = track.cover; else img.removeAttribute('src');
    });
    if (track.cover) {
      var probe = root.querySelector('[data-ap-cover]');
      if (probe.complete && probe.naturalWidth) tintFrom(probe); else probe.onload = function () { tintFrom(probe); };
    }
    if ('mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || '', artist: track.artist || '', album: 'xhanni',
        artwork: track.cover ? [{ src: new URL(track.cover, location.href).href, sizes: '512x512' }] : []
      });
    }
    paint();
    if (autoplay) play(false);
  }

  // Nivel que suena ahora (0..1). Con Web Audio va en la ganancia; sin él, en audio.volume.
  var level = 0;
  var actx = null;
  var gain = null;
  var analyser = null;
  // Graves de lo que suena (0..1) en --ap-beat: la isla brilla y la píldora late con la música.
  var beatRaf = 0;
  var beatVal = 0;
  function beat() {
    if (!analyser || reduce) return;
    var bins = new Uint8Array(analyser.frequencyBinCount);
    (function frame() {
      beatRaf = requestAnimationFrame(frame);
      if (audio.paused) { if (beatVal > 0.001) { beatVal *= 0.85; root.style.setProperty('--ap-beat', beatVal.toFixed(3)); } return; }
      analyser.getByteFrequencyData(bins);
      var sum = 0;
      for (var i = 1; i < 9; i++) sum += bins[i];
      var v = Math.max(0, (sum / 8 / 255 - 0.35) / 0.65) * (level > 0 ? 1 : 0);
      beatVal = v > beatVal ? v : beatVal * 0.88 + v * 0.12;
      root.style.setProperty('--ap-beat', beatVal.toFixed(3));
    })();
  }
  function setLevel(v) {
    level = Math.max(0, Math.min(1, v));
    if (gain) { gain.gain.value = level * level; audio.volume = 1; } // curva suave: el oído no es lineal
    else audio.volume = level * level;
  }
  // Solo dentro de un toque de la persona (si no, el contexto nace pausado y no suena nada).
  function ensureGraph() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!actx && AC) {
      try {
        actx = new AC();
        var src = actx.createMediaElementSource(audio);
        gain = actx.createGain();
        analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        src.connect(analyser);
        analyser.connect(gain);
        gain.connect(actx.destination);
        beat();
        setLevel(level);
      } catch (e) { actx = null; gain = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function fadeTo(to, done) {
    clearInterval(fadeTimer);
    if (reduce) { setLevel(to); if (done) done(); return; }
    fadeTimer = setInterval(function () {
      var up = to > level;
      var v = level + (up ? 0.04 : -0.06);
      if ((up && v >= to) || (!up && v <= to)) {
        clearInterval(fadeTimer);
        setLevel(to);
        if (done) done();
        return;
      }
      setLevel(v);
    }, 40);
  }
  function paintVol() {
    var v = target();
    volFill.style.transform = 'scaleX(' + v + ')';
    volBar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    volBar.setAttribute('aria-valuetext', Math.round(v * 100) + ' %');
    root.classList.toggle('is-muted', v === 0);
    muteBtn.innerHTML = v === 0 ? ICONS.volOff : v < 0.5 ? ICONS.volLow : ICONS.volHigh;
    muteBtn.setAttribute('aria-label', v === 0 ? t('Activar sonido') : t('Silenciar'));
    muteBtn.setAttribute('aria-pressed', String(v === 0));
  }
  function applyVolume() {
    saved.set('xh-volume', String(Math.round(volume * 100) / 100));
    saved.set('xh-muted', muted ? '1' : '0');
    paintVol();
    if (!audio.paused) { clearInterval(fadeTimer); setLevel(target()); }
  }

  // fromUser: la persona tocó reproducir (se recuerda que quiere música).
  function play(fromUser) {
    if (fromUser) { store.set('on'); ensureGraph(); }
    setLevel(0);
    var p = audio.play();
    if (p && p.then) {
      p.then(function () { disarm(); fadeTo(target()); }).catch(function () { arm(); });
    } else {
      fadeTo(target());
    }
  }
  function pause(fromUser) {
    if (fromUser) store.set('off');
    disarm();
    fadeTo(0, function () { audio.pause(); });
  }

  // Bloqueado por el navegador: empieza con el primer gesto de la persona en la página.
  var armed = false;
  var GESTURES = ['pointerup', 'keydown', 'touchend'];
  function onGesture(e) {
    if (e.target && e.target.closest && e.target.closest('.ab-player')) return; // el reproductor decide solo
    disarm();
    ensureGraph();
    play(false);
  }
  function arm() {
    if (armed) return;
    armed = true;
    root.classList.add('is-waiting');
    GESTURES.forEach(function (g) { window.addEventListener(g, onGesture, true); });
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    root.classList.remove('is-waiting');
    GESTURES.forEach(function (g) { window.removeEventListener(g, onGesture, true); });
  }

  function paint() {
    var d = audio.duration;
    var c = audio.currentTime;
    var pct = isFinite(d) && d > 0 ? (c / d) * 100 : 0;
    fill.style.transform = 'scaleX(' + (pct / 100) + ')';
    bar.setAttribute('aria-valuenow', String(Math.round(pct)));
    bar.setAttribute('aria-valuetext', fmt(c) + ' / ' + fmt(d));
    curEl.textContent = fmt(c);
    leftEl.textContent = '-' + fmt((isFinite(d) ? d : 0) - c);
  }

  function playingState() {
    var on = !audio.paused;
    root.classList.toggle('is-playing', on);
    toggleBtn.innerHTML = on ? ICONS.pause : ICONS.play;
    toggleBtn.setAttribute('aria-label', on ? t('Pausar') : t('Reproducir'));
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
  }

  // ---- abrir y cerrar: crece solo el marco (ancho, alto, borde), el contenido cruza desenfocado
  function size(view) { return { w: view.offsetWidth, h: view.offsetHeight }; }
  function setOpen(next) {
    if (next === open) return;
    open = next;
    var target = size(open ? full : mini);
    mover.size(target.w, target.h);
    root.classList.toggle('is-open', open);
    mini.setAttribute('aria-expanded', String(open));
    if (open) { full.removeAttribute('inert'); mini.setAttribute('tabindex', '-1'); } else { full.setAttribute('inert', ''); mini.removeAttribute('tabindex'); }
    if (open) setTimeout(function () { toggleBtn.focus({ preventScroll: true }); }, reduce ? 0 : 220);
    else if (root.contains(document.activeElement)) mini.focus({ preventScroll: true });
  }
  function fit() {
    var target = size(open ? full : mini);
    mover.size(target.w, target.h);
  }

  mini.addEventListener('click', function () {
    ensureGraph();
    setOpen(true);
    if (audio.paused && store.get() !== 'off') play(true);
  });
  root.querySelector('[data-ap="close"]').addEventListener('click', function () { setOpen(false); });
  muteBtn.addEventListener('click', function () {
    ensureGraph();
    if (muted || volume === 0) { muted = false; if (volume === 0) volume = 0.5; } else muted = true;
    applyVolume();
  });
  var volDrag = false;
  function volAt(clientX) {
    var r = volBar.getBoundingClientRect();
    volume = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    muted = false;
    applyVolume();
  }
  volBar.addEventListener('pointerdown', function (e) {
    ensureGraph();
    volDrag = true;
    root.classList.add('is-vol-drag');
    volBar.setPointerCapture(e.pointerId);
    volAt(e.clientX);
  });
  volBar.addEventListener('pointermove', function (e) { if (volDrag) volAt(e.clientX); });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    volBar.addEventListener(n, function () { volDrag = false; root.classList.remove('is-vol-drag'); });
  });
  volBar.addEventListener('keydown', function (e) {
    var step = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key];
    if (e.key === 'Home') step = -1;
    if (e.key === 'End') step = 1;
    if (step == null) return;
    e.preventDefault();
    ensureGraph();
    volume = Math.max(0, Math.min(1, (muted ? 0 : volume) + step));
    muted = false;
    applyVolume();
  });
  toggleBtn.addEventListener('click', function () { if (audio.paused) play(true); else pause(true); });
  root.querySelector('[data-ap="next"]').addEventListener('click', function () { ensureGraph(); load(index + 1, true); store.set('on'); });
  root.querySelector('[data-ap="prev"]').addEventListener('click', function () {
    ensureGraph();
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    load(index - 1, true); store.set('on');
  });
  document.addEventListener('pointerdown', function (e) { if (open && !root.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') setOpen(false); });

  // Barra de avance: arrastrar o flechas del teclado.
  function seekAt(clientX) {
    var r = bar.getBoundingClientRect();
    var k = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    if (isFinite(audio.duration)) audio.currentTime = k * audio.duration;
    paint();
  }
  bar.addEventListener('pointerdown', function (e) {
    seeking = true;
    root.classList.add('is-seeking');
    bar.setPointerCapture(e.pointerId);
    seekAt(e.clientX);
  });
  bar.addEventListener('pointermove', function (e) { if (seeking) seekAt(e.clientX); });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    bar.addEventListener(n, function () { seeking = false; root.classList.remove('is-seeking'); });
  });
  bar.addEventListener('keydown', function (e) {
    if (!isFinite(audio.duration)) return;
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
    paint();
  });

  audio.addEventListener('timeupdate', function () { if (!seeking) paint(); });
  audio.addEventListener('loadedmetadata', paint);
  audio.addEventListener('play', playingState);
  audio.addEventListener('pause', playingState);
  audio.addEventListener('ended', function () { load(index + 1, true); });
  audio.addEventListener('error', function () { if (tracks.length > 1) load(index + 1, false); });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', function () { play(true); });
      navigator.mediaSession.setActionHandler('pause', function () { pause(true); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { load(index - 1, true); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { load(index + 1, true); });
      navigator.mediaSession.setActionHandler('seekto', function (d) { if (d && isFinite(d.seekTime)) audio.currentTime = d.seekTime; });
    } catch (e) { /* navegador sin alguna acción */ }
  }

  window.addEventListener('resize', fit);
  function start() {
    labels();
    load(0, false);
    playingState();
    fit();
    requestAnimationFrame(function () { root.classList.add('is-in'); });
    if (store.get() !== 'off') play(false);
  }
  // Después de que prefs.js traduce (los textos de ayuda salen en el idioma elegido).
  if (document.readyState === 'complete') setTimeout(start, 300);
  else window.addEventListener('load', function () { setTimeout(start, 300); });
})();

/* Modo Spotify: la isla lleva adentro el reproductor oficial de Spotify (sus condiciones piden que se
   vea con su marca). Quien no tiene la sesión de Spotify abierta en el navegador escucha 30 segundos
   de cada canción. Dos formas en nosotros.html:
     { "spotify": "https://open.spotify.com/playlist/…" }        una playlist (la maneja Spotify)
     { "spotify": [{ "id": "…", "t": "Título", "a": "Artistas" }] } canciones sueltas: la primera
       suena primero, las demás se mezclan en cada visita; anterior / siguiente y pasa sola a la
       siguiente al terminar.
   El reproductor se carga recién al abrir la isla (antes no se conecta a Spotify) y sigue sonando al
   achicarla; las barras de la píldora se mueven mientras suena. */
(function () {
  'use strict';

  var listNode = document.getElementById('ab-playlist');
  var config = null;
  try { config = JSON.parse(listNode ? listNode.textContent : 'null'); } catch (e) { config = null; }
  if (!config || Array.isArray(config) || !config.spotify) return;

  var queue = null;
  var single = null;
  if (Array.isArray(config.spotify)) {
    queue = config.spotify.filter(function (x) { return x && /^[A-Za-z0-9]{22}$/.test(x.id || ''); });
    if (!queue.length) return;
    var rest = queue.slice(1);
    for (var k = rest.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var tmp = rest[k]; rest[k] = rest[j]; rest[j] = tmp; }
    queue = [queue[0]].concat(rest);
  } else {
    var match = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist)\/([A-Za-z0-9]+)/.exec(String(config.spotify));
    if (!match) return;
    single = { kind: match[1], id: match[2] };
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t = function (s) { return window.xhPrefs && window.xhPrefs.t ? window.xhPrefs.t(s) : s; };
  var note = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.5a2.5 2.5 0 1 1-2.5-2.5c.9 0 1.7.2 2.5.6V6.2a1 1 0 0 1 .78-.98l9-2A1 1 0 0 1 20 4.2v12.3a2.5 2.5 0 1 1-2.5-2.5c.9 0 1.7.2 2.5.6V8.1l-9 2v8.4Z" fill="currentColor"/></svg>';
  var down = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9.5 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var prevIcon = '<svg viewBox="0 0 28 24" aria-hidden="true"><path d="M13 6.2v11.6a.9.9 0 0 1-1.4.75L3.2 12.75a.9.9 0 0 1 0-1.5l8.4-5.8a.9.9 0 0 1 1.4.75Zm12 0v11.6a.9.9 0 0 1-1.4.75l-8.4-5.8a.9.9 0 0 1 0-1.5l8.4-5.8a.9.9 0 0 1 1.4.75Z" fill="currentColor"/></svg>';
  var nextIcon = '<svg viewBox="0 0 28 24" aria-hidden="true"><path d="M3 6.2v11.6a.9.9 0 0 0 1.4.75l8.4-5.8a.9.9 0 0 0 0-1.5l-8.4-5.8A.9.9 0 0 0 3 6.2Zm12 0v11.6a.9.9 0 0 0 1.4.75l8.4-5.8a.9.9 0 0 0 0-1.5l-8.4-5.8A.9.9 0 0 0 15 6.2Z" fill="currentColor"/></svg>';
  var playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor"/></svg>';
  var pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="3.5" width="4.5" height="17" rx="1.6" fill="currentColor"/><rect x="14" y="3.5" width="4.5" height="17" rx="1.6" fill="currentColor"/></svg>';
  var outIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var bars = ''; for (var i = 0; i < 4; i++) bars += '<i style="--b:' + i + '"></i>';
  // Con canciones sueltas va el reproductor compacto de Spotify (portada, título, artista) y abajo
  // nuestros controles: avance con tiempos, anterior / pausa / siguiente y abrir en Spotify.
  var HEIGHT = queue ? 80 : 352;

  var root = document.createElement('div');
  root.className = 'ab-player is-spotify is-waiting' + (queue ? ' is-queue' : '');
  root.innerHTML =
    '<button type="button" class="ap-mini" aria-expanded="false">' +
      '<span class="ap-art ap-art-note-only">' + note + '</span>' +
      '<span class="ap-mini-label">Música</span>' +
      '<span class="ap-eq">' + bars + '</span>' +
    '</button>' +
    '<div class="ap-full" role="group" inert>' +
      '<div class="ap-sp-head">' +
        '<strong>Lo que suena en el estudio</strong>' +
        (queue ? '<span class="ap-sp-count" data-no-translate data-ap-count></span>' : '') +
        '<button type="button" class="ap-btn ap-btn-side" data-ap="close">' + down + '</button>' +
      '</div>' +
      '<div class="ap-sp-frame" style="height:' + HEIGHT + 'px"><div data-ap-embed></div></div>' +
      (queue
        ? '<div class="ap-time">' +
            '<span data-ap-cur>0:00</span>' +
            '<div class="ap-bar" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i class="ap-fill"></i></div>' +
            '<span data-ap-left>-0:00</span>' +
          '</div>' +
          '<div class="ap-ctrl">' +
            '<button type="button" class="ap-btn" data-ap="prev">' + prevIcon + '</button>' +
            '<button type="button" class="ap-btn ap-btn-main" data-ap="toggle">' + playIcon + '</button>' +
            '<button type="button" class="ap-btn" data-ap="next">' + nextIcon + '</button>' +
            '<a class="ap-btn ap-btn-side" data-ap="out" target="_blank" rel="noopener">' + outIcon + '</a>' +
          '</div>' +
          '<p class="ap-sp-next"><span>Sigue</span> <b data-no-translate data-ap-next></b></p>'
        : '') +
      '<p class="ap-sp-note">Sin sesión de Spotify suenan 30 segundos de cada canción.</p>' +
    '</div>';
  document.body.appendChild(root);
  var mover = __xhPlayerKit.movable(root, { handle: '.ap-mini, .ap-sp-head', isOpen: function () { return open; } });
  __xhPlayerKit.magnet(root);

  var mini = root.querySelector('.ap-mini');
  var full = root.querySelector('.ap-full');
  var slot = root.querySelector('[data-ap-embed]');
  var open = false;
  var loaded = false;
  var controller = null;
  var index = 0;
  var wantPlay = false;
  var lastPos = 0;

  // Estado que llega de Spotify (milisegundos); entre avisos (uno por segundo) el avance se
  // interpola para que la barra corra suave.
  var sp = { pos: 0, dur: 0, paused: true, at: 0 };
  var seekPreview = null;
  var raf = 0;

  function uriAt(n) { return 'spotify:track:' + queue[n].id; }
  function fmt(ms) {
    var sec = Math.max(0, Math.floor((ms || 0) / 1000));
    return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60);
  }
  function nowPos() {
    if (seekPreview != null) return seekPreview;
    var p = sp.paused ? sp.pos : sp.pos + (performance.now() - sp.at);
    return Math.min(p, sp.dur || p);
  }
  function paintTime() {
    if (!queue) return;
    var p = nowPos();
    var k = sp.dur > 0 ? p / sp.dur : 0;
    root.querySelector('.ap-fill').style.transform = 'scaleX(' + k + ')';
    root.querySelector('[data-ap-cur]').textContent = fmt(p);
    root.querySelector('[data-ap-left]').textContent = '-' + fmt(sp.dur - p);
    var bar = root.querySelector('.ap-bar');
    bar.setAttribute('aria-valuenow', String(Math.round(k * 100)));
    bar.setAttribute('aria-valuetext', fmt(p) + ' / ' + fmt(sp.dur));
  }
  function loop() {
    paintTime();
    raf = open && !sp.paused ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  function paintToggle() {
    if (!queue) return;
    var btn = root.querySelector('[data-ap="toggle"]');
    btn.innerHTML = sp.paused ? playIcon : pauseIcon;
    btn.setAttribute('aria-label', sp.paused ? t('Reproducir') : t('Pausar'));
  }
  function paintQueue() {
    if (!queue) return;
    var nxt = queue[(index + 1) % queue.length];
    root.querySelector('[data-ap-count]').textContent = (index + 1) + ' / ' + queue.length;
    root.querySelector('[data-ap-next]').textContent = (nxt.t || '') + (nxt.a ? ' · ' + nxt.a : '');
    root.querySelector('[data-ap="out"]').href = 'https://open.spotify.com/track/' + queue[index].id;
  }
  function go(step) {
    if (!queue) return;
    index = (index + step + queue.length) % queue.length;
    lastPos = 0;
    sp = { pos: 0, dur: sp.dur, paused: sp.paused, at: performance.now() };
    paintQueue();
    paintTime();
    if (controller) { wantPlay = true; controller.loadUri(uriAt(index)); }
  }

  function labels() {
    mini.setAttribute('aria-label', t('Abrir el reproductor de música'));
    full.setAttribute('aria-label', t('Reproductor de música'));
    root.querySelector('[data-ap="close"]').setAttribute('aria-label', t('Achicar el reproductor'));
    if (queue) {
      root.querySelector('[data-ap="prev"]').setAttribute('aria-label', t('Canción anterior'));
      root.querySelector('[data-ap="next"]').setAttribute('aria-label', t('Canción siguiente'));
      root.querySelector('[data-ap="out"]').setAttribute('aria-label', t('Escuchar completa en Spotify'));
      root.querySelector('.ap-bar').setAttribute('aria-label', t('Avance de la canción'));
      paintToggle();
    }
  }
  function size(view) { return { w: view.offsetWidth, h: view.offsetHeight }; }
  function fit() {
    var target = size(open ? full : mini);
    mover.size(target.w, target.h);
  }
  function setOpen(next) {
    if (next === open) return;
    open = next;
    fit();
    root.classList.toggle('is-open', open);
    mini.setAttribute('aria-expanded', String(open));
    if (open) { full.removeAttribute('inert'); mini.setAttribute('tabindex', '-1'); } else { full.setAttribute('inert', ''); mini.removeAttribute('tabindex'); }
    if (!open && root.contains(document.activeElement)) mini.focus({ preventScroll: true });
    if (open) kick();
  }

  function embedSrc() {
    return queue
      ? 'https://open.spotify.com/embed/track/' + queue[index].id + '?utm_source=generator'
      : 'https://open.spotify.com/embed/' + single.kind + '/' + single.id + '?utm_source=generator';
  }
  // Si la API de Spotify no carga: reproductor simple (sin barras animadas ni paso solo a la siguiente).
  var plain = null;
  function plainFrame() {
    if (slot.querySelector && slot.querySelector('iframe')) return;
    plain = document.createElement('iframe');
    plain.src = embedSrc();
    plain.title = 'Spotify';
    plain.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    slot.appendChild(plain);
    root.classList.add('is-plain'); // sin API no hay avance ni pausa propios: quedan los de Spotify
    fit();
  }
  function load() {
    if (loaded) return;
    loaded = true;
    wantPlay = true;
    root.classList.remove('is-waiting');
    var gaveUp = setTimeout(plainFrame, 6000);
    window.onSpotifyIframeApiReady = function (IFrameAPI) {
      clearTimeout(gaveUp);
      if (plain) return;
      var uri = queue ? uriAt(index) : 'spotify:' + single.kind + ':' + single.id;
      IFrameAPI.createController(slot, { uri: uri, width: '100%', height: HEIGHT }, function (ctrl) {
        controller = ctrl;
        ctrl.addListener('ready', function () {
          if (!wantPlay) return;
          wantPlay = false;
          try { ctrl.play(); } catch (err) { /* Spotify pide tocar play */ }
        });
        ctrl.addListener('playback_update', function (e) {
          var d = (e && e.data) || {};
          root.classList.toggle('is-playing', !d.isPaused);
          if (!queue) return;
          // Avisos de la canción anterior que llegan tarde: se ignoran.
          if (d.playingURI && d.playingURI !== uriAt(index)) return;
          sp = { pos: d.position || 0, dur: d.duration || 0, paused: !!d.isPaused, at: performance.now() };
          paintToggle();
          paintTime();
          kick();
          // Terminó la canción: Spotify deja la posición igual a la duración (sin marcar pausa) o
          // vuelve a 0 en pausa. Pasa sola a la siguiente.
          var atEnd = d.duration > 0 && d.position >= d.duration - 400;
          var rewound = d.isPaused && d.position === 0;
          if (lastPos > 1000 && (atEnd || rewound)) {
            lastPos = 0;
            go(1);
            return;
          }
          if (!d.isPaused) lastPos = d.position || 0;
        });
      });
    };
    var script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    script.onerror = function () { clearTimeout(gaveUp); plainFrame(); };
    document.head.appendChild(script);
  }

  mini.addEventListener('click', function () { setOpen(true); load(); });
  root.querySelector('[data-ap="close"]').addEventListener('click', function () { setOpen(false); });
  if (queue) {
    root.querySelector('[data-ap="toggle"]').addEventListener('click', function () {
      if (!controller) { load(); return; }
      sp.pos = nowPos();
      sp.at = performance.now();
      sp.paused = !sp.paused; // se ve al instante; Spotify lo confirma en su próximo aviso
      paintToggle();
      kick();
      controller.togglePlay();
    });
    // Barra de avance: arrastrar (se muestra mientras se arrastra y se pide a Spotify al soltar) o flechas.
    var bar = root.querySelector('.ap-bar');
    var seekAt = function (clientX) {
      var r = bar.getBoundingClientRect();
      seekPreview = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * sp.dur;
      paintTime();
    };
    var commit = function () {
      if (seekPreview == null) return;
      var to = seekPreview;
      seekPreview = null;
      root.classList.remove('is-seeking');
      sp.pos = to;
      sp.at = performance.now();
      paintTime();
      if (controller && sp.dur > 0) controller.seek(to / 1000);
    };
    bar.addEventListener('pointerdown', function (e) {
      if (!sp.dur) return;
      root.classList.add('is-seeking');
      bar.setPointerCapture(e.pointerId);
      seekAt(e.clientX);
    });
    bar.addEventListener('pointermove', function (e) { if (seekPreview != null) seekAt(e.clientX); });
    bar.addEventListener('pointerup', commit);
    bar.addEventListener('pointercancel', commit);
    bar.addEventListener('keydown', function (e) {
      if (!controller || !sp.dur) return;
      var step = e.key === 'ArrowRight' ? 5000 : e.key === 'ArrowLeft' ? -5000 : 0;
      if (!step) return;
      e.preventDefault();
      var to = Math.max(0, Math.min(sp.dur, nowPos() + step));
      sp.pos = to;
      sp.at = performance.now();
      paintTime();
      controller.seek(to / 1000);
    });
  }
  if (queue) {
    root.querySelector('[data-ap="next"]').addEventListener('click', function () {
      if (plain) { index = (index + 1) % queue.length; paintQueue(); plain.src = embedSrc(); return; }
      go(1);
    });
    root.querySelector('[data-ap="prev"]').addEventListener('click', function () {
      if (plain) { index = (index - 1 + queue.length) % queue.length; paintQueue(); plain.src = embedSrc(); return; }
      go(-1);
    });
  }
  document.addEventListener('pointerdown', function (e) { if (open && !root.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', fit);

  function start() {
    labels();
    paintQueue();
    fit();
    requestAnimationFrame(function () { root.classList.add('is-in'); });
  }
  if (document.readyState === 'complete') setTimeout(start, 300);
  else window.addEventListener('load', function () { setTimeout(start, 300); });
  if (reduce) root.classList.remove('is-waiting');
})();

/* Modo YouTube: una sola pista fija, con el reproductor oficial de YouTube (modo de privacidad
   mejorada, youtube-nocookie.com) dentro de la isla y solo pausa y volumen.
     { "youtube": "id del video", "start": segundo de inicio, "title": "…", "artist": "…" }
   Al terminar vuelve a empezar desde "start". Suena al entrar si el navegador lo deja; si no, con el
   primer toque o tecla. Si la persona pausa, no vuelve a sonar sola (xh-music = off). El volumen se
   guarda (xh-volume, xh-muted); en iPhone YouTube no deja cambiarlo: manda el del teléfono. */
(function () {
  'use strict';

  var listNode = document.getElementById('ab-playlist');
  var config = null;
  try { config = JSON.parse(listNode ? listNode.textContent : 'null'); } catch (e) { config = null; }
  if (!config || Array.isArray(config) || !/^[A-Za-z0-9_-]{11}$/.test(config.youtube || '')) return;

  var VIDEO = config.youtube;
  var START = Math.max(0, parseInt(config.start, 10) || 0);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t = function (s) { return window.xhPrefs && window.xhPrefs.t ? window.xhPrefs.t(s) : s; };
  var saved = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  };
  var volume = parseFloat(saved.get('xh-volume'));
  if (!isFinite(volume) || volume < 0 || volume > 1) volume = 0.6;
  var muted = saved.get('xh-muted') === '1';

  var I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="3.5" width="4.5" height="17" rx="1.6" fill="currentColor"/><rect x="14" y="3.5" width="4.5" height="17" rx="1.6" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9.5 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    volHigh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.3v13.4l-4.8-4.2H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    volLow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.3v13.4l-4.8-4.2H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    volOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.3v13.4l-4.8-4.2H4z" fill="currentColor"/><path d="m15.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>'
  };
  var bars = ''; for (var i = 0; i < 4; i++) bars += '<i style="--b:' + i + '"></i>';
  var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var thumb = 'https://i.ytimg.com/vi/' + VIDEO + '/hqdefault.jpg';

  var root = document.createElement('div');
  root.className = 'ab-player is-spotify is-yt has-cover is-waiting';
  root.innerHTML =
    '<button type="button" class="ap-mini" aria-expanded="false">' +
      '<span class="ap-art"><img alt="" src="' + thumb + '"></span>' +
      '<span class="ap-mini-label">Música</span>' +
      '<span class="ap-eq">' + bars + '</span>' +
    '</button>' +
    '<div class="ap-full" role="group" inert>' +
      '<div class="ap-sp-head">' +
        '<strong>Lo que suena en el estudio</strong>' +
        '<button type="button" class="ap-btn ap-btn-side" data-ap="close">' + I.down + '</button>' +
      '</div>' +
      '<div class="ap-sp-frame"><div data-ap-embed></div></div>' +
      '<div class="ap-yt-meta" data-no-translate><strong>' + esc(config.title) + '</strong><span>' + esc(config.artist) + ' · YouTube</span></div>' +
      '<div class="ap-yt-ctrl">' +
        '<button type="button" class="ap-btn ap-btn-main" data-ap="toggle">' + I.play + '</button>' +
        '<button type="button" class="ap-btn ap-btn-side" data-ap="mute"></button>' +
        '<div class="ap-bar ap-vol-bar" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100"><i class="ap-fill"></i></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);
  var mover = __xhPlayerKit.movable(root, { handle: '.ap-mini, .ap-sp-head', isOpen: function () { return open; } });
  __xhPlayerKit.magnet(root);

  var mini = root.querySelector('.ap-mini');
  var full = root.querySelector('.ap-full');
  var toggle = root.querySelector('[data-ap="toggle"]');
  var muteBtn = root.querySelector('[data-ap="mute"]');
  var volBar = root.querySelector('.ap-vol-bar');
  var volFill = volBar.querySelector('.ap-fill');
  var open = false;
  var player = null;
  var ready = false;
  var playing = false;

  // ---- volumen (0..1 en la barra; YouTube usa 0..100)
  function level() { return muted ? 0 : volume; }
  function applyVolume() {
    if (ready) {
      try {
        player.setVolume(Math.round(volume * 100));
        if (muted || volume === 0) player.mute(); else player.unMute();
      } catch (e) { /* aún cargando */ }
    }
    var v = level();
    volFill.style.transform = 'scaleX(' + v + ')';
    volBar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    volBar.setAttribute('aria-valuetext', Math.round(v * 100) + '%');
    muteBtn.innerHTML = v === 0 ? I.volOff : v < 0.5 ? I.volLow : I.volHigh;
    muteBtn.setAttribute('aria-label', v === 0 ? t('Activar sonido') : t('Silenciar'));
    root.classList.toggle('is-muted', v === 0);
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    muted = false;
    saved.set('xh-volume', String(volume));
    saved.set('xh-muted', '0');
    applyVolume();
  }

  // ---- reproducir / pausar
  function paintToggle() {
    toggle.innerHTML = playing ? I.pause : I.play;
    toggle.setAttribute('aria-label', playing ? t('Pausar') : t('Reproducir'));
    root.classList.toggle('is-playing', playing);
  }
  function play() { if (ready) { try { player.playVideo(); } catch (e) { /* YouTube pide un toque */ } } }
  function pause() { if (ready) { try { player.pauseVideo(); } catch (e) { /* nada */ } } }

  // Los navegadores no dejan sonar antes del primer toque: se intenta al cargar y, si no suena,
  // se vuelve a intentar con el primer toque o tecla en cualquier parte de la página.
  var GESTURES = ['pointerup', 'keydown', 'touchend'];
  var armed = false;
  function onGesture(e) {
    if (root.contains(e.target)) return; // los botones de la isla se atienden solos
    disarm();
    play();
  }
  function arm() {
    if (armed || saved.get('xh-music') === 'off') return;
    armed = true;
    GESTURES.forEach(function (g) { window.addEventListener(g, onGesture, true); });
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    root.classList.remove('is-waiting');
    GESTURES.forEach(function (g) { window.removeEventListener(g, onGesture, true); });
  }

  function onState(e) {
    var s = e.data;
    if (s === 1) { playing = true; disarm(); }
    else if (s === 2 || s === -1 || s === 5) playing = false;
    else if (s === 0) { playing = false; try { player.seekTo(START, true); player.playVideo(); } catch (err) { /* nada */ } }
    paintToggle();
  }

  function build() {
    player = new window.YT.Player(root.querySelector('[data-ap-embed]'), {
      host: 'https://www.youtube-nocookie.com',
      videoId: VIDEO,
      width: '100%',
      height: '100%',
      playerVars: { start: START, playsinline: 1, rel: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1 },
      events: {
        onReady: function () {
          ready = true;
          // El video solo se mira: fuera del orden del teclado y de los lectores de pantalla.
          var frame = root.querySelector('.ap-sp-frame iframe');
          if (frame) { frame.setAttribute('tabindex', '-1'); frame.setAttribute('aria-hidden', 'true'); }
          applyVolume();
          if (saved.get('xh-music') !== 'off') { play(); arm(); }
          else root.classList.remove('is-waiting');
        },
        onStateChange: onState
      }
    });
  }
  function loadApi() {
    if (window.YT && window.YT.Player) { build(); return; }
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () { if (prev) prev(); build(); };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  }

  // ---- abrir y cerrar
  function size(view) { return { w: view.offsetWidth, h: view.offsetHeight }; }
  function fit() { var target = size(open ? full : mini); mover.size(target.w, target.h); }
  function setOpen(next) {
    if (next === open) return;
    open = next;
    fit();
    root.classList.toggle('is-open', open);
    mini.setAttribute('aria-expanded', String(open));
    if (open) { full.removeAttribute('inert'); mini.setAttribute('tabindex', '-1'); } else { full.setAttribute('inert', ''); mini.removeAttribute('tabindex'); }
    if (!open && root.contains(document.activeElement)) mini.focus({ preventScroll: true });
  }

  mini.addEventListener('click', function () { setOpen(true); });
  root.querySelector('[data-ap="close"]').addEventListener('click', function () { setOpen(false); });
  toggle.addEventListener('click', function () {
    disarm();
    if (playing) { pause(); saved.set('xh-music', 'off'); playing = false; }
    else { play(); saved.set('xh-music', 'on'); playing = true; }
    paintToggle(); // se ve al instante; YouTube lo confirma con su aviso
  });
  muteBtn.addEventListener('click', function () {
    if (level() === 0) { muted = false; if (volume === 0) volume = 0.6; }
    else muted = true;
    saved.set('xh-muted', muted ? '1' : '0');
    saved.set('xh-volume', String(volume));
    applyVolume();
  });
  var volAt = function (x) { var r = volBar.getBoundingClientRect(); setVolume((x - r.left) / r.width); };
  volBar.addEventListener('pointerdown', function (e) {
    root.classList.add('is-vol-drag');
    volBar.setPointerCapture(e.pointerId);
    volAt(e.clientX);
  });
  volBar.addEventListener('pointermove', function (e) { if (root.classList.contains('is-vol-drag')) volAt(e.clientX); });
  var volEnd = function () { root.classList.remove('is-vol-drag'); };
  volBar.addEventListener('pointerup', volEnd);
  volBar.addEventListener('pointercancel', volEnd);
  volBar.addEventListener('keydown', function (e) {
    var k = e.key;
    var v = k === 'ArrowRight' || k === 'ArrowUp' ? level() + 0.05 : k === 'ArrowLeft' || k === 'ArrowDown' ? level() - 0.05 : k === 'Home' ? 0 : k === 'End' ? 1 : null;
    if (v == null) return;
    e.preventDefault();
    setVolume(v);
  });
  document.addEventListener('pointerdown', function (e) { if (open && !root.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (open && e.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', fit);

  function labels() {
    mini.setAttribute('aria-label', t('Abrir el reproductor de música'));
    full.setAttribute('aria-label', t('Reproductor de música'));
    root.querySelector('[data-ap="close"]').setAttribute('aria-label', t('Achicar el reproductor'));
    volBar.setAttribute('aria-label', t('Volumen'));
    paintToggle();
    applyVolume();
  }
  function start() {
    labels();
    fit();
    requestAnimationFrame(function () { root.classList.add('is-in'); });
    loadApi();
  }
  if (document.readyState === 'complete') setTimeout(start, 300);
  else window.addEventListener('load', function () { setTimeout(start, 300); });
  if (reduce) root.classList.remove('is-waiting');
})();
