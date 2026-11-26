'use strict';

const { ipcMain, session, shell } = require('electron');
const { PARTITION, TARGET_URL, dbg } = require('./config');
const { ctx, send } = require('./state');
const { getSettings, updateSettings } = require('./store');
const { clearAttention, notifyNewMessage } = require('./attention');
const { scheduleAutoFill } = require('./autofill');
const { getMemoryStats, optimizeMemory } = require('./memory');
const { registerWindowIpc } = require('./ipc-window');
const { registerAccountIpc } = require('./ipc-accounts');

let registered = false;

function registerIpc(createWinFn) {
  if (registered) return;
  registered = true;

  registerWindowIpc(createWinFn);
  registerAccountIpc();

  ipcMain.on('app:zoom', (_e, delta) => {
    if (!ctx.view || ctx.view.webContents.isDestroyed()) return;
    const next = Math.min(3, Math.max(-2, ctx.view.webContents.getZoomLevel() + Number(delta || 0)));
    ctx.view.webContents.setZoomLevel(next);
    send('app:state', { zoom: next });
  });

  ipcMain.on('app:zoom-reset', () => {
    if (!ctx.view || ctx.view.webContents.isDestroyed()) return;
    ctx.view.webContents.setZoomLevel(0);
    send('app:state', { zoom: 0 });
  });

  ipcMain.on('app:reload', () => {
    if (!ctx.view || ctx.view.webContents.isDestroyed()) return;
    ctx.view.setVisible(false);
    send('site-status', { state: 'loading', url: TARGET_URL });
    ctx.view.webContents.loadURL(TARGET_URL);
  });

  ipcMain.on('app:devtools', () => {
    if (ctx.view && !ctx.view.webContents.isDestroyed()) ctx.view.webContents.toggleDevTools();
  });

  ipcMain.on('app:external', () => {
    const url = ctx.view && !ctx.view.webContents.isDestroyed() ? ctx.view.webContents.getURL() : '';
    shell.openExternal(url || TARGET_URL);
  });

  ipcMain.handle('app:clear', async () => {
    const s = session.fromPartition(PARTITION);
    await s.clearStorageData();
    await s.clearCache();
    ctx.cookiePatched = false;
    if (ctx.view && !ctx.view.webContents.isDestroyed()) {
      ctx.view.setVisible(false);
      send('site-status', { state: 'loading', url: TARGET_URL });
      ctx.view.webContents.loadURL(TARGET_URL);
    }
    return true;
  });

  ipcMain.handle('app:state', () => ({
    alwaysOnTop: ctx.win && !ctx.win.isDestroyed() ? ctx.win.isAlwaysOnTop() : false,
    zoom: ctx.view && !ctx.view.webContents.isDestroyed() ? ctx.view.webContents.getZoomLevel() : 0,
    maximized: ctx.win && !ctx.win.isDestroyed() ? ctx.win.isMaximized() : false,
  }));

  ipcMain.handle('site:state', () => ctx.lastStatus);
  ipcMain.handle('app:memory-stats', () => getMemoryStats());
  ipcMain.handle('app:memory-optimize', () => optimizeMemory('manual'));
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_e, patch) => {
    const next = updateSettings(patch);
    if (patch && patch.flashOnMessage === false) clearAttention();
    if (patch && patch.autoFill === true) {
      ctx.autoFillDone = false;
      scheduleAutoFill();
    }
    return next;
  });

  ipcMain.on('site:activity', (e, reason) => {
    if (!ctx.view || ctx.view.webContents.isDestroyed()) return;
    if (e.sender !== ctx.view.webContents) return;
    dbg('ipc-activity:' + reason);
    notifyNewMessage(String(reason || 'unknown'));
  });
}

module.exports = { registerIpc };
