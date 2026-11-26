'use strict';

const { nativeImage } = require('electron');
const { assetPath, TITLE_UNREAD_RE, dbg } = require('./config');
const { ctx, send } = require('./state');
const { settings } = require('./store');

const MIN_NOTIFY_GAP_MS = 2500;
let badgeCache = null;
let lastNotifyAt = 0;
let lastTitle = '';

function badgeImage() {
  if (badgeCache !== null) return badgeCache;
  try {
    badgeCache = nativeImage.createFromPath(assetPath('badge.png'));
  } catch {
    badgeCache = null;
  }
  return badgeCache;
}

function clearAttention() {
  if (!ctx.win || ctx.win.isDestroyed()) return;
  try {
    ctx.win.flashFrame(false);
  } catch {
    /* ignore */
  }
  try {
    ctx.win.setOverlayIcon(null, '');
  } catch {
    /* ignore */
  }
}

function notifyNewMessage(reason) {
  if (!settings.flashOnMessage) return;
  if (!ctx.win || ctx.win.isDestroyed()) return;
  if (ctx.win.isFocused() && !ctx.win.isMinimized()) return;

  const now = Date.now();
  if (now - lastNotifyAt < MIN_NOTIFY_GAP_MS) return;
  lastNotifyAt = now;

  dbg('activity:' + reason);
  try {
    ctx.win.flashFrame(true);
  } catch {
    /* ignore */
  }
  const img = badgeImage();
  if (img && !img.isEmpty()) {
    try {
      ctx.win.setOverlayIcon(img, '有新消息');
    } catch {
      /* ignore */
    }
  }
  send('app:new-message', { reason, at: now });
}

function checkTitleUnread(title) {
  const t = String(title || '');
  if (t === lastTitle) return;
  lastTitle = t;
  if (TITLE_UNREAD_RE.test(t)) notifyNewMessage('title');
}

function releaseAttentionResources() {
  badgeCache = null;
  lastTitle = '';
}

module.exports = {
  clearAttention,
  notifyNewMessage,
  checkTitleUnread,
  releaseAttentionResources,
};
