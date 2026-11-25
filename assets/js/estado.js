// Página /estado (2026-11-22): estado en vivo (/api/status) y caídas de los últimos 30 días.
// Se actualiza sola cada minuto mientras la pestaña está a la vista.
(function () {
  'use strict';
  var summary = document.querySelector('[data-status-summary]');
  var title = document.querySelector('[data-status-title]');
  var list = document.querySelector('[data-status-list]');
  var checked = document.querySelector('[data-status-checked]');
  var incidents = document.querySelector('[data-status-incidents]');
  if (!summary) return;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function when(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' });
  }

  function paint(data) {
    var down = data.components.filter(function (item) { return item.state !== 'up'; });
    summary.dataset.level = down.length ? 'down' : 'up';
    title.textContent = down.length ? (down.length === 1 ? 'Un servicio tiene problemas' : 'Algunos servicios tienen problemas') : 'Todo funciona';
    list.innerHTML = data.components.map(function (item) {
      return '<li class="status-row is-' + (item.state === 'up' ? 'up' : 'down') + '"><span class="status-dot" aria-hidden="true"></span>' +
        '<span>' + escapeHtml(item.name) + '</span><small>' + (item.state === 'up' ? 'Funcionando' : 'Con problemas') + '</small></li>';
    }).join('');
    checked.textContent = 'Revisado: ' + when(data.checkedAt) + ' (hora de Chile).';
    incidents.innerHTML = data.incidents.length ? data.incidents.map(function (item) {
      var text = item.endedAt
        ? 'Caído ' + (item.duration || 'unos minutos') + ' · volvió el ' + when(item.endedAt)
        : 'Caído desde el ' + when(item.startedAt) + ' · lo estamos revisando';
      return '<li class="status-incident"><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(text) + '</span></li>';
    }).join('') : '<li class="t-caption">Sin caídas en los últimos 30 días.</li>';
  }

  function load() {
    fetch('/api/status', { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.components)) throw new Error('sin datos');
        paint(data);
      })
      .catch(function () {
        summary.dataset.level = 'down';
        title.textContent = 'No pudimos revisar el estado';
      });
  }
  load();
  setInterval(function () { if (document.visibilityState === 'visible') load(); }, 60000);
})();
