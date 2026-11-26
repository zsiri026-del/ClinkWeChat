'use strict';

(function () {
  const cleanups = [];
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);

  function onCleanup(fn) {
    if (typeof fn === 'function') cleanups.push(fn);
  }

  function disposeAll() {
    clearTimeout(toastTimer);
    toastTimer = null;
    while (cleanups.length) {
      const fn = cleanups.pop();
      try { fn(); } catch {}
    }
  }

  const Shell = {
    $,
    hasLoadedOnce: false,
    lastPageTitle: '在线客服工作台',
    onCleanup,
    disposeAll,
    syncOverlay() {
      const p = $('popup');
      const m = $('loginModal');
      const open = (p && !p.classList.contains('hidden')) || (m && !m.classList.contains('hidden'));
      window.app.setOverlay(open);
    },
    flashToast(text, durationMs = 6000) {
      const el = $('pageTitle');
      if (!el) return;
      el.textContent = text;
      el.classList.add('toast');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastTimer = null;
        el.classList.remove('toast');
        el.textContent = Shell.lastPageTitle || '在线客服工作台';
      }, durationMs);
    },
    setPageTitle(clean) {
      Shell.lastPageTitle = clean || '在线客服工作台';
      const el = $('pageTitle');
      if (el && !el.classList.contains('toast')) el.textContent = Shell.lastPageTitle;
      document.title = (clean ? clean + ' · ' : '') + '客户联络中心';
    },
  };

  window.Shell = Shell;
})();
