// Página /comandos (2026-11-22): pinta la lista que genera el bot (npm run comandos en Bot/ →
// assets/data/comandos.json), con buscador y filtro "Solo Free". Sin dependencias.
(function () {
  'use strict';
  var list = document.querySelector('[data-cmd-list]');
  var empty = document.querySelector('[data-cmd-empty]');
  var input = document.querySelector('[data-cmd-q]');
  var filterBox = document.querySelector('[data-cmd-filter]');
  if (!list) return;
  var data = null;
  var onlyFree = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function fold(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function render() {
    if (!data) return;
    var q = fold(input && input.value).trim();
    var shown = 0;
    var html = data.sections.map(function (section) {
      var rows = section.commands.filter(function (cmd) {
        if (onlyFree && !cmd.free) return false;
        return !q || fold(cmd.usage + ' ' + cmd.text + ' ' + section.label).indexOf(q) !== -1;
      });
      if (!rows.length) return '';
      shown += rows.length;
      return '<section class="cmd-section">' +
        '<div class="cmd-section-head"><h2>' + escapeHtml(section.label) + '</h2>' +
        (section.staff ? '<span class="badge">Staff</span>' : '') + '</div>' +
        '<p class="t-caption">' + escapeHtml(section.intro) + '</p>' +
        '<ul data-no-translate>' + rows.map(function (cmd) {
          return '<li class="cmd-row"><code>' + escapeHtml(cmd.usage) + '</code>' +
            '<span class="cmd-text">' + escapeHtml(cmd.text) + '</span>' +
            '<span class="badge ' + (cmd.free ? 'badge-green' : 'badge-blue') + '">' + (cmd.free ? 'Free' : 'Pago') + '</span></li>';
        }).join('') + '</ul></section>';
    }).join('');
    list.innerHTML = html;
    if (empty) empty.hidden = shown > 0;
  }

  if (input) input.addEventListener('input', render);
  if (filterBox) {
    filterBox.addEventListener('click', function (event) {
      var button = event.target.closest('[data-filter]');
      if (!button) return;
      onlyFree = button.dataset.filter === 'free';
      filterBox.querySelectorAll('[data-filter]').forEach(function (item) {
        item.setAttribute('aria-selected', String(item === button));
      });
      render();
    });
  }

  fetch('/assets/data/comandos.json', { cache: 'no-cache' })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (json) {
      if (!json || !Array.isArray(json.sections)) throw new Error('sin datos');
      data = json;
      var lead = document.querySelector('[data-cmd-lead]');
      if (lead) lead.textContent = json.total + ' comandos en español. ' + json.free + ' funcionan con el plan Free; el resto viene con cualquier plan de pago o la prueba gratis.';
      render();
    })
    .catch(function () {
      list.innerHTML = '<p class="t-caption">No pudimos cargar la lista. Prueba de nuevo en un momento o usa /help en Discord.</p>';
    });
})();
