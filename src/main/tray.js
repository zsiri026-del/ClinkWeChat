'use strict';

const { Tray, Notification, nativeImage } = require('electron');
const { assetPath, dbg } = require('./config');
const { ctx } = require('./state');
const { settings, saveSettings, saveWindowState } = require('./store');
const { clearAttention } = require('./attention');
const { buildTrayMenu } = require('./tray-menu');

let lastTrayTopState = null;

function hasTray() {
  return Boolean(ctx.tray && (typeof ctx.tray.isDestroyed !== 'function' || !ctx.tray.isDestroyed()));
}

function buildTrayIcon() {
  try {
    const img = nativeImage.createFromPath(assetPath('icon-v2.png'));
    if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
  } catch {
    /* ignore */
  }
  return nativeImage.createEmpty();
}

function showMainWindow(createWinFn) {
  if (!ctx.win || ctx.win.isDestroyed()) {
    if (typeof createWinFn === 'function') createWinFn();
    return;
  }
  ctx.hiddenAt = 0;
  if (ctx.win.isMinimized()) ctx.win.restore();
  ctx.win.show();
  ctx.win.focus();
  clearAttention();
  dbg('show-from-tray');
}

function hideToTray() {
  if (!ctx.win || ctx.win.isDestroyed()) return false;
  if (!hasTray()) {
    ctx.win.minimize();
    dbg('hide-to-tray-fallback-minimize');
    return false;
  }
  const b = ctx.win.getNormalBounds ? ctx.win.getNormalBounds() : ctx.win.getBounds();
  saveWindowState(b);
  ctx.hiddenAt = Date.now();
  ctx.win.hide();
  dbg('hide-to-tray');
  if (!settings.trayTipShown) {
    settings.trayTipShown = true;
    saveSettings();
    try {
      new Notification({
        title: '客服在线平台已在后台运行',
        body: '窗口已收起至右下角托盘，新消息照常提醒，单击托盘图标即可唤回。',
        silent: true,
      }).show();
    } catch {
      /* ignore */
    }
  }
  return true;
}

function refreshTrayMenu(createWinFn, force = false) {
  if (!hasTray()) return;
  const onTop = !!(ctx.win && !ctx.win.isDestroyed() && ctx.win.isAlwaysOnTop());
  if (!force && onTop === lastTrayTopState) return;
  try {
    const built = buildTrayMenu({
      showFn: () => showMainWindow(createWinFn),
      refreshFn: (f) => refreshTrayMenu(createWinFn, f),
    });
    lastTrayTopState = built.onTop;
    ctx.tray.setContextMenu(built.menu);
  } catch {
    /* ignore */
  }
}

function createTray(createWinFn) {
  if (hasTray()) return;
  try {
    ctx.tray = new Tray(buildTrayIcon());
  } catch (err) {
    dbg('tray-failed:' + err);
    ctx.tray = null;
    return;
  }
  ctx.tray.setToolTip('客服在线平台');
  refreshTrayMenu(createWinFn, true);
  ctx.tray.on('click', () => showMainWindow(createWinFn));
  ctx.tray.on('double-click', () => showMainWindow(createWinFn));
  ctx.tray.on('right-click', () => refreshTrayMenu(createWinFn));
}

function destroyTray() {
  if (!ctx.tray) return;
  try { ctx.tray.destroy(); } catch {}
  ctx.tray = null;
  lastTrayTopState = null;
}

module.exports = { hasTray, createTray, destroyTray, refreshTrayMenu, hideToTray, showMainWindow };
