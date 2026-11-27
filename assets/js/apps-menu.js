/* Menú "Apps" del navbar. La lista de apps se escribe aquí, una sola vez: para sumar una app
   nueva, agregar una fila a APPS (y su texto en assets/js/i18n-en.js). Las tres páginas con
   barra (index, store, xhannizer0) solo llevan <div class="apps-menu" data-apps-menu></div>.
   Debe cargarse antes de main.js. */
(function () {
  'use strict';
  var APPS = [
    { name: 'Allmighty', desc: 'Bot para Discord', href: '/#allmighty' },
    { name: 'XHANNIZER0', desc: 'App gratis para Windows', href: '/xhannizer0' }
  ];

  var root = document.querySelector('[data-apps-menu]');
  if (!root) return;

  var path = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
  function isCurrent(href) {
    if (href.indexOf('#') !== -1) return false; // los enlaces a una sección no son "página actual"
    return path === href.replace(/\/+$/, '');
  }

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'apps-btn';
  btn.id = 'appsBtn';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'appsPanel');
  btn.appendChild(document.createTextNode('Apps'));
  btn.insertAdjacentHTML('beforeend', '<svg class="apps-caret" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5"/></svg>');

  var panel = document.createElement('div');
  panel.className = 'apps-panel';
  panel.id = 'appsPanel';
  panel.hidden = true;

  var anyCurrent = false;
  APPS.forEach(function (app) {
    var a = document.createElement('a');
    a.className = 'apps-item';
    a.href = app.href;
    var n = document.createElement('strong');
    n.textContent = app.name;
    var d = document.createElement('span');
    d.textContent = app.desc;
    a.appendChild(n);
    a.appendChild(d);
    if (isCurrent(app.href)) { a.setAttribute('aria-current', 'page'); anyCurrent = true; }
    panel.appendChild(a);
  });
  if (anyCurrent) btn.classList.add('is-active');

  root.appendChild(btn);
  root.appendChild(panel);

  function setOpen(open, returnFocus) {
    btn.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    root.classList.toggle('is-open', open);
    if (!open && returnFocus) btn.focus();
  }
  function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }

  // <button> abre con clic, Enter y espacio (el navegador los convierte en "click").
  btn.addEventListener('click', function () { setOpen(!isOpen()); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); setOpen(false, true); }
  });
  document.addEventListener('click', function (e) { if (isOpen() && !root.contains(e.target)) setOpen(false); });
  panel.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  // Si se cierra la hamburguesa, el menú también.
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) toggle.addEventListener('click', function () { if (toggle.getAttribute('aria-expanded') !== 'true') setOpen(false); });
})();
