'use strict';

const { app } = require('electron');
const { APP_ID } = require('./config');
const { ctx, clearAllTimers } = require('./state');
const { loadSettings } = require('./store');
const { applyChromiumFlags, startMemoryGuard, stopMemoryGuard } = require('./memory');
const { startUpdateScheduler, stopUpdateScheduler } = require('./updater');
const { releaseAttentionResources } = require('./attention');
const { destroySiteView } = require('./view');
const { destroyTray, showMainWindow } = require('./tray');
const { createWindow } = require('./window');
const { registerIpc } = require('./ipc');
const { installDesktopShortcut } = require('./shortcut');

applyChromiumFlags();
app.setAppUserModelId(APP_ID);

function cleanupAll() {
  ctx.quitting = true;
  stopUpdateScheduler();
  stopMemoryGuard();
  clearAllTimers();
  destroySiteView();
  destroyTray();
  releaseAttentionResources();
}

if (process.argv.includes('--install-shortcut')) {
  app.whenReady().then(() => {
    const ok = installDesktopShortcut();
    app.exit(ok ? 0 : 1);
  });
} else {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => showMainWindow(createWindow));

    app.whenReady().then(() => {
      loadSettings();
      registerIpc(createWindow);
      createWindow();
      startMemoryGuard();
      startUpdateScheduler();
      app.on('activate', () => showMainWindow(createWindow));
    });

    app.on('before-quit', cleanupAll);

    app.on('window-all-closed', () => {
      cleanupAll();
      app.exit(0);
    });
  }
}
