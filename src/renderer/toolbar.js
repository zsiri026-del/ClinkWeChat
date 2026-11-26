'use strict';

(function () {
  const { $, onCleanup } = window.Shell;

  function formatZoom(level) {
    const pct = Math.round(Math.pow(1.2, Number(level || 0)) * 100);
    return pct + '%';
  }

  function syncState(s) {
    if (!s) return;
    if (typeof s.alwaysOnTop === 'boolean') $('pinBtn').classList.toggle('on', s.alwaysOnTop);
    if (typeof s.zoom === 'number') $('zoomReset').textContent = formatZoom(s.zoom);
  }

  function init() {
    const bind = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', fn);
      onCleanup(() => el.removeEventListener('click', fn));
    };

    bind('minBtn', () => window.app.window('minimize'));
    bind('maxBtn', () => window.app.window('maximize'));
    bind('closeBtn', () => window.app.window('close'));
    bind('pinBtn', () => window.app.window('toggle-top'));
    bind('zoomIn', () => window.app.zoom(0.5));
    bind('zoomOut', () => window.app.zoom(-0.5));
    bind('zoomReset', () => window.app.zoomReset());
    bind('reloadBtn', () => window.app.reload());
    bind('retryBtn', () => window.app.reload());
    bind('externalBtn', () => window.app.external());

    const titlebar = $('titlebar');
    const onDbl = (e) => {
      if (!e.target.closest('.tb-actions')) window.app.window('maximize');
    };
    titlebar.addEventListener('dblclick', onDbl);
    onCleanup(() => titlebar.removeEventListener('dblclick', onDbl));

    onCleanup(window.app.onState(syncState));
    window.app.state().then(syncState).catch(() => {});
  }

  window.Shell.toolbar = { init };
})();
