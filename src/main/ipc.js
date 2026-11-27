'use strict';

const { ipcMain } = require('electron');
const { ROOT, TARGET_URL, dbg } = require('./config');
const { openSafeExternal, isShellSender, isTrustedSiteFrame } = require('./security');
const { ctx, send } = require('./state');
const { getSettings, updateSettings } = require('./store');
const { clearAttention, notifyNewMessage } = require('./attention');
const { scheduleAutoFill, cancelAutoFill } = require('./autofill');
const { clearSessionDataSafe } = require('./cookies');
const { getMemoryStats, optimizeMemory } = require('./memory');
const { getUpdateState, checkForUpdates, applyDownloadedUpdate } = require('./updater');
const { readPkgVersion } = require('./semver');
const { confirmBootSuccess } = require('./boot-meta');
const { registerWindowIpc } = require('./ipc-window');
const { registerAccountIpc, clearPendingCapture } = require('./ipc-accounts');

let registered = false;

function registerIpc(createWinFn) {
  if (registered) return;
  registered = true;

  registerWindowIpc(createWinFn);
  registerAccountIpc();

  ipcMain.on('app:renderer-ready', (e) => {
    if (!isShellSender(e)) return;
    confirmBootSuccess(readPkgVersion(ROOT));
  });

  ipcMain.on('app:zoom', (e, delta) => {
    if (!isShellSender(e) || !ctx.view || ctx.view.webContents.isDestroyed()) return;
    const next = Math.min(3, Math.max(-2, ctx.view.webContents.getZoomLevel() + Number(delta || 0)));
    ctx.view.webContents.setZoomLevel(next);
    send('app:state', { zoom: next });
  });

  ipcMain.on('app:zoom-reset', (e) => {
    if (!isShellSender(e) || !ctx.view || ctx.view.webContents.isDestroyed()) return;
    ctx.view.webContents.setZoomLevel(0);
    send('app:state', { zoom: 0 });
  });

  ipcMain.on('app:reload', (e) => {
    if (!isShellSender(e) || !ctx.view || ctx.view.webContents.isDestroyed()) return;
    ctx.view.setVisible(false);
    send('site-status', { state: 'loading', url: TARGET_URL });
    ctx.view.webContents.loadURL(TARGET_URL);
  });

  ipcMain.on('app:devtools', (e) => {
    if (!isShellSender(e)) return;
    if (ctx.view && !ctx.view.webContents.isDestroyed()) ctx.view.webContents.toggleDevTools();
  });

  ipcMain.on('app:external', (e) => {
    if (!isShellSender(e)) return;
    const url = ctx.view && !ctx.view.webContents.isDestroyed() ? ctx.view.webContents.getURL() : '';
    openSafeExternal(url || TARGET_URL);
  });

  ipcMain.handle('app:clear', async (e) => {
    if (!isShellSender(e)) return false;
    cancelAutoFill();
    clearPendingCapture();
    await clearSessionDataSafe();
    if (ctx.view && !ctx.view.webContents.isDestroyed()) {
      ctx.view.setVisible(false);
      send('site-status', { state: 'loading', url: TARGET_URL });
      ctx.view.webContents.loadURL(TARGET_URL);
    }
    return true;
  });

  ipcMain.handle('app:state', (e) => {
    if (!isShellSender(e)) return null;
    return {
      alwaysOnTop: ctx.win && !ctx.win.isDestroyed() ? ctx.win.isAlwaysOnTop() : false,
      zoom: ctx.view && !ctx.view.webContents.isDestroyed() ? ctx.view.webContents.getZoomLevel() : 0,
      maximized: ctx.win && !ctx.win.isDestroyed() ? ctx.win.isMaximized() : false,
    };
  });

  ipcMain.handle('site:state', (e) => (isShellSender(e) ? ctx.lastStatus : null));
  ipcMain.handle('app:memory-stats', (e) => (isShellSender(e) ? getMemoryStats() : null));
  ipcMain.handle('app:memory-optimize', (e) => (isShellSender(e) ? optimizeMemory('manual') : null));
  ipcMain.handle('app:update-state', (e) => (isShellSender(e) ? getUpdateState() : null));
  ipcMain.handle('app:update-check', (e) => (isShellSender(e) ? checkForUpdates(true) : null));
  ipcMain.handle('app:update-apply', (e) => (isShellSender(e) ? applyDownloadedUpdate() : false));
  ipcMain.handle('settings:get', (e) => (isShellSender(e) ? getSettings() : null));

  ipcMain.handle('settings:set', (e, patch) => {
    if (!isShellSender(e)) return null;
    const next = updateSettings(patch);
    if (next && next._persistError) return next;
    if (patch && patch.flashOnMessage === false) clearAttention();
    if (patch && patch.autoFill === false) {
      cancelAutoFill();
      clearPendingCapture();
    } else if (patch && patch.autoFill === true) {
      ctx.autoFillDone = false;
      scheduleAutoFill();
    }
    return next;
  });

  ipcMain.on('site:activity', (e, reason) => {
    if (!isTrustedSiteFrame(e)) return;
    dbg('ipc-activity:' + reason);
    notifyNewMessage(String(reason || 'unknown'));
  });
}

module.exports = { registerIpc };
