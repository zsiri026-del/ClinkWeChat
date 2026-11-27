'use strict';

const { app, session } = require('electron');
const path = require('node:path');
const { PARTITION, isTrusted, dbg } = require('./config');
const { ctx } = require('./state');
const { notifySaved } = require('./image-save');

const ALLOW_REQ = new Set([
  'media',
  'audioCapture',
  'videoCapture',
  'notifications',
  'clipboard-sanitized-write',
  'fullscreen',
]);
const ALLOW_CHECK = new Set([
  'media',
  'audioCapture',
  'videoCapture',
  'clipboard-sanitized-write',
]);
const ALLOWED_MEDIA_TYPES = new Set(['audio', 'video']);

let initialized = false;

function isTrustedPermissionSource(wc, originOrUrl, details) {
  if (!ctx.view || ctx.view.webContents.isDestroyed()) return false;
  if (wc && wc !== ctx.view.webContents) return false;
  const candidate =
    (details && details.requestingUrl) ||
    originOrUrl ||
    (wc && !wc.isDestroyed() ? wc.getURL() : '');
  return isTrusted(candidate);
}

function isAllowedMediaDetails(permission, details) {
  if (permission !== 'media' || !details || !Array.isArray(details.mediaTypes)) return true;
  return details.mediaTypes.length > 0 && details.mediaTypes.every((t) => ALLOWED_MEDIA_TYPES.has(t));
}

function initSiteSession() {
  if (initialized) return session.fromPartition(PARTITION);
  initialized = true;

  const viewSession = session.fromPartition(PARTITION);

  viewSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const ok =
      ALLOW_REQ.has(permission) &&
      isTrustedPermissionSource(wc, '', details) &&
      isAllowedMediaDetails(permission, details);
    callback(ok);
  });

  viewSession.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
    return (
      ALLOW_CHECK.has(permission) &&
      isTrustedPermissionSource(wc, requestingOrigin, details) &&
      isAllowedMediaDetails(permission, details)
    );
  });

  viewSession.on('will-download', (_event, item) => {
    let name = 'download';
    try {
      name = item.getFilename() || name;
    } catch {
      /* ignore */
    }
    try {
      item.setSaveDialogOptions({
        title: '保存文件',
        defaultPath: path.join(app.getPath('downloads'), name),
      });
    } catch {
      /* fallback */
    }
    item.once('done', (_e, state) => {
      if (state === 'completed') {
        try {
          notifySaved(item.getSavePath());
        } catch {
          /* ignore */
        }
      } else if (state === 'interrupted') {
        dbg('download-interrupted ' + name);
      }
    });
  });

  return viewSession;
}

module.exports = { initSiteSession, isTrustedPermissionSource, isAllowedMediaDetails };
