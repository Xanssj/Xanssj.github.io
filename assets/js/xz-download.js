// XHANNIZER0: los botones Descargar van a GitHub. Sin JavaScript llevan a la página de la última
// versión; con JavaScript se cambian al .exe de esa versión (instalador o portable), así la
// descarga empieza al tocarlos. Lo consulta el navegador del visitante, no el servidor.
(function () {
  var links = document.querySelectorAll('[data-xz-download]');
  if (!links.length || !window.fetch) return;
  var SUFFIX = { installer: '-x64-nsis.exe', portable: '-Portable.exe' };
  fetch('https://api.github.com/repos/Xanssj/XHANNIZER0/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (!data || !Array.isArray(data.assets)) return;
      links.forEach(function (link) {
        var end = SUFFIX[link.getAttribute('data-xz-download')];
        if (!end) return;
        var asset = data.assets.find(function (item) {
          return item && typeof item.name === 'string' && item.name.slice(-end.length) === end &&
            /^https:\/\/github\.com\//.test(item.browser_download_url || '');
        });
        if (asset) link.href = asset.browser_download_url;
      });
    })
    .catch(function () {});
})();
