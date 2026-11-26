'use strict';

const { WebContentsView } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { PARTITION, RAIL_W, TITLE_H, dbg } = require('./config');
const { ctx, setTrackedTimeout, clearTrackedTimeout } = require('./state');
const { initSiteSession } = require('./session-setup');
const { cancelAutoFill } = require('./autofill');
const { cancelCookieCheck } = require('./cookies');
const { bindViewEvents } = require('./view-events');

let hookSource = null;
let layoutTimer = null;

function loadHookSource() {
  if (hookSource !== null) return hookSource;
  try {
    hookSource = fs.readFileSync(path.join(__dirname, '..', 'inject', 'activity-hook.js'), 'utf8');
  } catch {
    hookSource = '';
  }
  return hookSource;
}

function injectActivityHook(wc) {
  const code = loadHookSource();
  if (!code || !wc || wc.isDestroyed()) return;
  wc.executeJavaScript(code, true).catch((err) => dbg('inject-failed:' + err));
}

function layoutView() {
  clearTrackedTimeout(layoutTimer);
  layoutTimer = null;
  if (!ctx.win || ctx.win.isDestroyed() || !ctx.view) return;
  const { width, height } = ctx.win.getContentBounds();
  ctx.view.setBounds({
    x: RAIL_W,
    y: TITLE_H,
    width: Math.max(0, width - RAIL_W),
    height: Math.max(0, height - TITLE_H),
  });
}

function scheduleLayoutView() {
  if (layoutTimer) return;
  layoutTimer = setTrackedTimeout(layoutView, 16);
}

function destroySiteView() {
  cancelAutoFill();
  cancelCookieCheck();
  clearTrackedTimeout(layoutTimer);
  layoutTimer = null;
  if (ctx.view) {
    try {
      if (!ctx.view.webContents.isDestroyed()) ctx.view.webContents.destroy();
    } catch {
      /* ignore */
    }
    ctx.view = null;
  }
}

function createSiteView(win) {
  initSiteSession();
  const view = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, '..', 'site-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  ctx.view = view;
  win.contentView.addChildView(view);
  layoutView();

  const wc = view.webContents;
  wc.setUserAgent(wc.getUserAgent().replace(/\sElectron\/[\d.]+/g, '').replace(/\sclink-wechat\/[\d.]+/g, ''));

  bindViewEvents(view, injectActivityHook);
  view.setVisible(false);
  return view;
}

module.exports = { createSiteView, layoutView, scheduleLayoutView, destroySiteView };
