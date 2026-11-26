'use strict';

(function () {
  const Shell = window.Shell;
  const { $, onCleanup, disposeAll } = Shell;

  function boot() {
    Shell.theme.init();
    Shell.status.init();
    Shell.toolbar.init();
    Shell.memory.init();
    Shell.settings.init();
    Shell.accounts.init();
    Shell.updater.init();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        $('popup').classList.add('hidden');
        $('loginModal').classList.add('hidden');
        Shell.syncOverlay();
      }
    };
    document.addEventListener('keydown', onKey);
    onCleanup(() => document.removeEventListener('keydown', onKey));
    window.addEventListener('beforeunload', disposeAll, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
