'use strict';

const { app, BrowserWindow, screen } = require('electron');
const path = require('node:path');
const { assetPath, TARGET_URL } = require('./config');
const { ctx, send, setTrackedTimeout, clearTrackedTimeout } = require('./state');
const { settings, readWindowState, saveWindowState } = require('./store');
const { sanitizeBounds } = require('./bounds');
const { clearAttention } = require('./attention');
const { createSiteView, layoutView, scheduleLayoutView, destroySiteView } = require('./view');
const { createTray, hideToTray, refreshTrayMenu } = require('./tray');
const { runDiagIfNeeded } = require('./diag');

function createWindow() {
  const saved = sanitizeBounds(readWindowState());
  const area = screen.getPrimaryDisplay().workAreaSize;
  const defW = Math.min(1280, Math.max(920, area.width - 120));
  const defH = Math.min(860, Math.max(600, area.height - 120));

  const win = new BrowserWindow({
    width: saved && saved.width ? Math.min(saved.width, area.width) : defW,
    height: saved && saved.height ? Math.min(saved.height, area.height) : defH,
    x: saved ? saved.x : undefined,
    y: saved ? saved.y : undefined,
    minWidth: 900,
    minHeight: 580,
    frame: false,
    show: false,
    backgroundColor: '#0f172a',
    title: '客户联络中心',
    icon: assetPath('icon-v2.ico'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: true,
      spellcheck: false,
    },
  });

  ctx.win = win;
  win.setMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  const view = createSiteView(win);

  win.webContents.once('did-finish-load', () => {
    send('host-info', { version: app.getVersion(), target: TARGET_URL });
    if (view && !view.webContents.isDestroyed()) view.webContents.loadURL(TARGET_URL);
  });

  let shown = false;
  let showFallbackTimer = null;
  const ensureShown = () => {
    if (shown || !ctx.win || ctx.win.isDestroyed()) return;
    shown = true;
    clearTrackedTimeout(showFallbackTimer);
    showFallbackTimer = null;
    ctx.win.show();
    layoutView();
    createTray(createWindow);
  };
  win.once('ready-to-show', ensureShown);
  showFallbackTimer = setTrackedTimeout(ensureShown, 3500);

  win.on('focus', clearAttention);
  win.on('restore', clearAttention);
  win.on('resize', scheduleLayoutView);
  win.on('maximize', layoutView);
  win.on('unmaximize', layoutView);
  win.on('enter-full-screen', layoutView);
  win.on('leave-full-screen', layoutView);

  win.on('close', (event) => {
    if (!ctx.quitting && settings.closeToTray) {
      event.preventDefault();
      hideToTray();
      return;
    }
    const b = win.getNormalBounds ? win.getNormalBounds() : win.getBounds();
    saveWindowState(b);
  });

  win.on('closed', () => {
    clearTrackedTimeout(showFallbackTimer);
    showFallbackTimer = null;
    destroySiteView();
    ctx.win = null;
    refreshTrayMenu(createWindow);
  });

  runDiagIfNeeded(createWindow);
  return win;
}

module.exports = { createWindow };
