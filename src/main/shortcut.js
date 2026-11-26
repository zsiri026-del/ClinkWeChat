'use strict';

const { app, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { ROOT, APP_ID, assetPath } = require('./config');

function installDesktopShortcut() {
  const desktop = path.join(app.getPath('home'), 'Desktop');
  const lnk = path.join(desktop, '客服在线平台.lnk');
  try {
    fs.rmSync(lnk, { force: true });
  } catch {
    /* ignore */
  }
  const ok = shell.writeShortcutLink(lnk, 'create', {
    target: process.execPath,
    cwd: app.isPackaged ? path.dirname(process.execPath) : ROOT,
    args: app.isPackaged ? '' : `"${ROOT}"`,
    description: '客服在线平台 · 渐变美学在线客服桌面客户端',
    icon: assetPath('icon-v2.ico'),
    iconIndex: 0,
    appUserModelId: APP_ID,
  });
  console.log('shortcut:', ok, lnk);
  return ok;
}

module.exports = { installDesktopShortcut };
