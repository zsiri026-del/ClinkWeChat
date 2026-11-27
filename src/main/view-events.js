'use strict';

const { TARGET_URL, isTrusted, dbg } = require('./config');
const { openSafeExternal } = require('./security');
const { ctx, send } = require('./state');
const { checkTitleUnread } = require('./attention');
const { scheduleAutoFill, cancelAutoFill } = require('./autofill');
const { scheduleCookieCheck } = require('./cookies');
const { showContextMenu } = require('./context-menu');

function bindViewEvents(view, injectHookFn) {
  const wc = view.webContents;
  let loadFailed = false;

  const markReady = () => {
    if (loadFailed || !ctx.view) return;
    if (!ctx.overlayOpen) ctx.view.setVisible(true);
    send('site-status', { state: 'ready', url: wc.getURL() });
  };

  wc.setWindowOpenHandler(({ url }) => {
    if (isTrusted(url)) wc.loadURL(url);
    else openSafeExternal(url);
    return { action: 'deny' };
  });

  wc.on('will-navigate', (event, url) => {
    if (!isTrusted(url)) {
      event.preventDefault();
      openSafeExternal(url);
    }
  });

  wc.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
    if (isMainFrame && !isTrusted(url)) {
      event.preventDefault();
      openSafeExternal(url);
    }
  });

  wc.on('did-start-loading', () => {
    loadFailed = false;
    ctx.autoFillDone = false;
    cancelAutoFill();
    send('site-status', { state: 'loading', url: wc.getURL() });
  });

  wc.on('did-stop-loading', () => {
    if (!wc.isLoading()) markReady();
    scheduleAutoFill();
    scheduleCookieCheck();
  });

  wc.on('did-finish-load', () => {
    markReady();
    injectHookFn(wc);
  });

  wc.on('dom-ready', () => injectHookFn(wc));

  wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    loadFailed = true;
    view.setVisible(false);
    send('site-status', { state: 'error', url, code, desc });
  });

  wc.on('page-title-updated', (_e, title) => {
    send('site-title', title);
    checkTitleUnread(title);
  });

  wc.on('render-process-gone', () => {
    send('site-status', { state: 'error', url: TARGET_URL, code: -1, desc: '页面进程已退出' });
    view.setVisible(false);
  });

  wc.on('context-menu', async (_e, params) => {
    try { await showContextMenu(wc, params); } catch (err) { dbg('ctx-err:' + err); }
  });

  wc.on('will-prevent-unload', (e) => { if (ctx.quitting) e.preventDefault(); });

  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      wc.reload();
      event.preventDefault();
    } else if (input.key === 'F12') {
      wc.toggleDevTools();
      event.preventDefault();
    }
  });

  if (process.env.SHOT) {
    wc.on('console-message', (d) => {
      if (d && d.message) dbg(`console[${d.level}] ${d.message}`);
    });
  }
}

module.exports = { bindViewEvents };
