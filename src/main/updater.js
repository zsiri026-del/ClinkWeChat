'use strict';

const { app, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { ROOT, UPDATE_MANIFEST_URL, dbg } = require('./config');
const { ctx, send, setTrackedTimeout, setTrackedInterval, clearTrackedTimeout, clearTrackedInterval } = require('./state');
const { settings } = require('./store');
const { compareSemver, readPkgVersion } = require('./semver');
const { applyHotPatchBuffer } = require('./hot-apply');
const { fetchWithTimeout, downloadInstaller } = require('./update-download');

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const MAX_PATCH_BYTES = 10 * 1024 * 1024;
let initTimer = null;
let pollTimer = null;
let state = { status: 'idle', currentVersion: readPkgVersion(ROOT), latestVersion: '', mode: '', notes: '', filePath: '', error: '' };

function emit(patch) {
  state = { ...state, ...patch };
  send('app:update-state', state);
  return state;
}

async function checkForUpdates(manual = false) {
  if (state.status === 'checking' || state.status === 'downloading') return state;
  const current = readPkgVersion(ROOT);
  const shellVer = app.getVersion();
  emit({ status: 'checking', currentVersion: current, error: '' });
  try {
    const m = await (await fetchWithTimeout(UPDATE_MANIFEST_URL, 15000)).json();
    if (!m || !m.version || compareSemver(m.version, current) <= 0) {
      return emit({ status: 'up-to-date', latestVersion: (m && m.version) || current, mode: '', notes: '' });
    }
    const canHot = m.hotPatch && m.hotPatch.url && (!m.minShellVersion || compareSemver(shellVer, m.minShellVersion) >= 0);
    emit({ status: 'downloading', latestVersion: m.version, mode: canHot ? 'hot' : 'installer', notes: m.notes || '' });
    if (canHot) {
      const buf = Buffer.from(await (await fetchWithTimeout(m.hotPatch.url, 30000)).arrayBuffer());
      if (buf.length > MAX_PATCH_BYTES) throw new Error('热更新包体积超限');
      applyHotPatchBuffer(buf, m.hotPatch.sha256, path.join(app.getPath('userData'), 'hot-update'));
      dbg('hot-update-ready:' + m.version);
      return emit({ status: 'ready', latestVersion: m.version, mode: 'hot', filePath: '' });
    }
    if (m.installer && m.installer.url) {
      const exePath = await downloadInstaller(m.installer, m.version);
      dbg('installer-update-ready:' + m.version);
      return emit({ status: 'ready', latestVersion: m.version, mode: 'installer', filePath: exePath });
    }
    throw new Error('未找到可用更新包');
  } catch (err) {
    dbg('update-err:' + err);
    return emit({ status: manual ? 'error' : 'idle', error: String((err && err.message) || err) });
  }
}

function applyDownloadedUpdate() {
  if (state.status !== 'ready') return false;
  if (state.mode === 'hot') {
    ctx.quitting = true;
    app.relaunch();
    app.exit(0);
    return true;
  }
  if (state.mode === 'installer' && state.filePath && fs.existsSync(state.filePath)) {
    ctx.quitting = true;
    spawn(state.filePath, [], { detached: true, stdio: 'ignore' }).unref();
    app.exit(0);
    return true;
  }
  shell.openExternal('https://github.com/zsiri026-del/ClinkWeChat/releases/latest');
  return false;
}

function startUpdateScheduler() {
  stopUpdateScheduler();
  initTimer = setTrackedTimeout(() => { if (settings.autoUpdate) checkForUpdates(false); }, 15000);
  pollTimer = setTrackedInterval(() => { if (settings.autoUpdate) checkForUpdates(false); }, CHECK_INTERVAL_MS);
}

function stopUpdateScheduler() {
  clearTrackedTimeout(initTimer);
  clearTrackedInterval(pollTimer);
  initTimer = null;
  pollTimer = null;
}

module.exports = { getUpdateState: () => ({ ...state }), checkForUpdates, applyDownloadedUpdate, startUpdateScheduler, stopUpdateScheduler };
