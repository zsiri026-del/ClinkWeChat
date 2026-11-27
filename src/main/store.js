'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { DEFAULT_SETTINGS, THEMES, dbg } = require('./config');

const settings = { ...DEFAULT_SETTINGS };
let loaded = false;

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const statePath = () => path.join(app.getPath('userData'), 'window-state.json');

function writeJsonSafe(filePath, data, pretty) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, pretty ? 2 : 0));
    fs.renameSync(tmp, filePath);
    return true;
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    dbg('store-write-failed:' + err);
    return false;
  }
}

function loadSettings() {
  if (loaded) return settings;
  loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    if (raw && typeof raw === 'object') Object.assign(settings, raw);
    if (!THEMES.includes(settings.theme)) settings.theme = DEFAULT_SETTINGS.theme;
  } catch {
    /* first launch */
  }
  return settings;
}

function getSettings() {
  return { ...loadSettings() };
}

function saveSettings() {
  return writeJsonSafe(settingsPath(), settings, true);
}

function updateSettings(patch) {
  if (!patch || typeof patch !== 'object') return getSettings();
  const next = { ...loadSettings() };
  const boolKeys = ['flashOnMessage', 'autoFill', 'closeToTray', 'autoOptimizeMem', 'autoUpdate', 'trayTipShown'];
  for (const key of boolKeys) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key];
  }
  if (typeof patch.lastAccountId === 'string') next.lastAccountId = patch.lastAccountId;
  if (typeof patch.theme === 'string' && THEMES.includes(patch.theme)) next.theme = patch.theme;

  if (!writeJsonSafe(settingsPath(), next, true)) {
    return { ...getSettings(), _persistError: true };
  }
  Object.assign(settings, next);
  return getSettings();
}

function readWindowState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return null;
  }
}

function saveWindowState(bounds) {
  if (!bounds) return false;
  return writeJsonSafe(statePath(), {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  }, false);
}

module.exports = {
  settings,
  loadSettings,
  getSettings,
  saveSettings,
  updateSettings,
  readWindowState,
  saveWindowState,
};
