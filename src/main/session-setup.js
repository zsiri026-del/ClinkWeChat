'use strict';

const { app, session } = require('electron');
const path = require('node:path');
const { PARTITION, dbg } = require('./config');
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

let initialized = false;

function initSiteSession() {
  if (initialized) return session.fromPartition(PARTITION);
  initialized = true;

  const viewSession = session.fromPartition(PARTITION);

  viewSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOW_REQ.has(permission));
  });

  viewSession.setPermissionCheckHandler((_wc, permission) => {
    return ALLOW_CHECK.has(permission);
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

module.exports = { initSiteSession };
