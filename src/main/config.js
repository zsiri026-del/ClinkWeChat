'use strict';

const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET_URL =
  process.env.CLINK_URL || 'https://agent-bj.clink.cn/sunrizetech/index/livechat/online';
const TRUSTED_HOSTS = ['clink.cn'];
const PARTITION = 'persist:clink';
const APP_ID = 'com.local.clinkwechat';

const RAIL_W = 66;
const TITLE_H = 38;
const TITLE_UNREAD_RE = /[（(\[]\s*\d+\s*[)）\]]|新消息|未读/;
const THEMES = ['aurora', 'twilight', 'ocean', 'sunset'];

const DEFAULT_SETTINGS = Object.freeze({
  flashOnMessage: true,
  autoFill: true,
  lastAccountId: '',
  trayTipShown: false,
  closeToTray: true,
  autoOptimizeMem: true,
  theme: 'aurora',
});

function assetPath(name) {
  const base = process.resourcesPath && !process.defaultApp
    ? path.join(process.resourcesPath, 'assets')
    : path.join(ROOT, 'assets');
  return path.join(base, name);
}

function isTrusted(url) {
  try {
    const host = new URL(url).hostname;
    return TRUSTED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

function dbg(msg) {
  if (!process.env.SHOT) return;
  try {
    fs.mkdirSync(process.env.SHOT, { recursive: true });
    fs.appendFileSync(path.join(process.env.SHOT, 'events.log'), `${Date.now()} ${msg}\n`);
  } catch {
    /* ignore */
  }
}

module.exports = {
  ROOT,
  TARGET_URL,
  TRUSTED_HOSTS,
  PARTITION,
  APP_ID,
  RAIL_W,
  TITLE_H,
  TITLE_UNREAD_RE,
  THEMES,
  DEFAULT_SETTINGS,
  assetPath,
  isTrusted,
  dbg,
};
