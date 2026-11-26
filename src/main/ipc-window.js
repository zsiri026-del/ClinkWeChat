'use strict';

const { app, ipcMain } = require('electron');
const { ctx, send } = require('./state');
const { hideToTray, showMainWindow, refreshTrayMenu } = require('./tray');

function registerWindowIpc(createWinFn) {
  ipcMain.on('app:overlay', (_e, open) => {
    ctx.overlayOpen = !!open;
    if (!ctx.view || ctx.view.webContents.isDestroyed()) return;
    if (ctx.overlayOpen) ctx.view.setVisible(false);
    else if (ctx.lastStatus && ctx.lastStatus.state === 'ready') ctx.view.setVisible(true);
  });

  ipcMain.on('app:window', (_e, action) => {
    if (action === 'quit') { ctx.quitting = true; app.quit(); return; }
    if (action === 'restart') { ctx.quitting = true; app.relaunch(); app.exit(0); return; }
    if (!ctx.win || ctx.win.isDestroyed()) {
      if (action === 'show') showMainWindow(createWinFn);
      return;
    }
    if (action === 'minimize') ctx.win.minimize();
    else if (action === 'maximize') (ctx.win.isMaximized() ? ctx.win.unmaximize() : ctx.win.maximize());
    else if (action === 'close') ctx.win.close();
    else if (action === 'hide') hideToTray();
    else if (action === 'show') showMainWindow(createWinFn);
    else if (action === 'toggle-top') {
      const next = !ctx.win.isAlwaysOnTop();
      ctx.win.setAlwaysOnTop(next, 'floating');
      send('app:state', { alwaysOnTop: next });
      refreshTrayMenu(createWinFn, true);
    }
  });
}

module.exports = { registerWindowIpc };
