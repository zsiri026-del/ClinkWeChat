'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { DEFAULT_SETTINGS, THEMES } = require('./config');

const settings = { ...DEFAULT_SETTINGS };
let loaded = false;

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const statePath = () => path.join(app.getPath('userData'), 'window-state.json');

function writeJsonSafe(filePath, data, pretty) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, pretty ? 2 : 0));
    fs.renameSync(tmp, filePath);
  } catch {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, pretty ? 2 : 0));
    } catch {
      /* ignore */
    }
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
  writeJsonSafe(settingsPath(), settings, true);
}

function updateSettings(patch) {
  if (!patch || typeof patch !== 'object') return getSettings();
  const boolKeys = ['flashOnMessage', 'autoFill', 'closeToTray', 'autoOptimizeMem', 'trayTipShown'];
  for (const key of boolKeys) {
    if (typeof patch[key] === 'boolean') settings[key] = patch[key];
  }
  if (typeof patch.lastAccountId === 'string') settings.lastAccountId = patch.lastAccountId;
  if (typeof patch.theme === 'string' && THEMES.includes(patch.theme)) settings.theme = patch.theme;
  saveSettings();
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
  if (!bounds) return;
  writeJsonSafe(statePath(), {
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
