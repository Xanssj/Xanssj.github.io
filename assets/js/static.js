// Versión estática: los botones de XHANNIZER0 bajan el .exe de la última versión en GitHub.
(function () {
  var links = document.querySelectorAll('[data-xz-download]');
  if (!links.length || !window.fetch) return;
  var SUFFIX = { installer: '-x64-nsis.exe', portable: '-Portable.exe' };
  fetch('https://api.github.com/repos/Xanssj/XHANNIZER0/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !Array.isArray(data.assets)) return;
      links.forEach(function (link) {
        var end = SUFFIX[link.getAttribute('data-xz-download')];
        var asset = data.assets.find(function (a) { return a && typeof a.name === 'string' && a.name.slice(-end.length) === end && /^https:\/\/github\.com\//.test(a.browser_download_url || ''); });
        if (asset) link.href = asset.browser_download_url;
      });
    })
    .catch(function () {});
})();
