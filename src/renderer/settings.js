'use strict';

(function () {
  const Shell = window.Shell;
  const { $, onCleanup } = Shell;

  let current = {
    autoFill: true,
    flashOnMessage: true,
    closeToTray: true,
    autoOptimizeMem: true,
    theme: 'aurora',
  };

  function syncSwitches(s) {
    current = { ...current, ...s };
    $('autoFillCheck').classList.toggle('on', current.autoFill !== false);
    $('flashCheck').classList.toggle('on', !!current.flashOnMessage);
    $('closeTrayCheck').classList.toggle('on', current.closeToTray !== false);
    $('autoMemCheck').classList.toggle('on', current.autoOptimizeMem !== false);
    if (Shell.theme) Shell.theme.apply(current.theme);
  }

  async function toggleSetting(key) {
    try {
      const nextVal = key === 'flashOnMessage' ? !current[key] : current[key] === false;
      const updated = await window.app.settings.set({ [key]: nextVal });
      syncSwitches(updated);
    } catch {}
  }

  function init() {
    const popup = $('popup');
    const closePopup = () => {
      popup.classList.add('hidden');
      Shell.syncOverlay();
    };

    const bind = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', fn);
      onCleanup(() => el.removeEventListener('click', fn));
    };

    bind('settingsBtn', (e) => {
      e.stopPropagation();
      popup.classList.toggle('hidden');
      Shell.syncOverlay();
    });

    const onDocClick = (e) => {
      if (!popup.classList.contains('hidden') && !popup.contains(e.target)) closePopup();
    };
    document.addEventListener('click', onDocClick);
    onCleanup(() => document.removeEventListener('click', onDocClick));

    bind('miAutoFill', () => toggleSetting('autoFill'));
    bind('miFlash', () => toggleSetting('flashOnMessage'));
    bind('miCloseToTray', () => toggleSetting('closeToTray'));
    bind('miAutoMem', () => toggleSetting('autoOptimizeMem'));
    bind('miOptimizeMem', () => { closePopup(); Shell.memory.runOptimize(); });
    bind('miClear', async () => { closePopup(); Shell.hasLoadedOnce = false; await window.app.clear(); });
    bind('miExternal', () => { closePopup(); window.app.external(); });
    bind('miDevtools', () => { closePopup(); window.app.devtools(); });
    bind('miRestart', () => { closePopup(); window.app.window('restart'); });
    bind('miQuit', () => { closePopup(); window.app.window('quit'); });

    window.app.settings.get().then(syncSwitches).catch(() => {});
  }

  window.Shell.settings = { init };
})();
