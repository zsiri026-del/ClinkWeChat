'use strict';

const { app } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ROOT, UPDATE_MANIFEST_URL, dbg } = require('./config');
const { openSafeExternal } = require('./security');
const { ctx, send, setTrackedTimeout, setTrackedInterval, clearTrackedTimeout, clearTrackedInterval } = require('./state');
const { settings } = require('./store');
const { compareSemver, readPkgVersion } = require('./semver');
const { verifyUpdateManifest } = require('./update-verify');
const { stageHotPatchBuffer, commitHotPatch } = require('./hot-apply');
const { fetchJsonWithTimeout, fetchBufferLimited, verifyFileSha256, downloadInstaller } = require('./update-download');

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const MAX_PATCH_BYTES = 10 * 1024 * 1024;
const RELEASES_URL = 'https://github.com/zsiri026-del/ClinkWeChat/releases/latest';

let initTimer = null;
let pollTimer = null;
let inFlight = false;
let readyUpdate = null;
let checkInfo = {
  status: 'idle',
  currentVersion: readPkgVersion(ROOT),
  latestVersion: '',
  mode: '',
  notes: '',
  error: '',
};

function buildPublicState() {
  if (readyUpdate) {
    return {
      status: 'ready',
      currentVersion: checkInfo.currentVersion,
      latestVersion: readyUpdate.version,
      mode: readyUpdate.mode,
      notes: readyUpdate.notes,
      filePath: readyUpdate.filePath || '',
      error: '',
      checking: inFlight,
    };
  }
  return { ...checkInfo, filePath: '', checking: inFlight };
}

function emit(patch) {
  if (patch) checkInfo = { ...checkInfo, ...patch };
  const snapshot = buildPublicState();
  send('app:update-state', snapshot);
  return snapshot;
}

async function prepareInstallerFallback(manifest) {
  if (!manifest.installer || !manifest.installer.url) return null;
  const exePath = await downloadInstaller(manifest.installer, manifest.version);
  return {
    version: manifest.version,
    mode: 'installer',
    notes: manifest.notes || '',
    filePath: exePath,
    sha256: manifest.installer.sha256,
    staged: null,
  };
}

async function checkForUpdates(manual = false) {
  if (inFlight) return buildPublicState();
  inFlight = true;
  const current = readPkgVersion(ROOT);
  const shellVer = app.getVersion();
  emit({ status: 'checking', currentVersion: current, error: '' });
  try {
    const m = await fetchJsonWithTimeout(UPDATE_MANIFEST_URL, 15000);
    verifyUpdateManifest(m, { manifestUrl: UPDATE_MANIFEST_URL });

    if (compareSemver(m.version, current) <= 0) {
      readyUpdate = null;
      inFlight = false;
      return emit({ status: 'up-to-date', latestVersion: m.version, mode: '', notes: '', error: '' });
    }
    const canHot = Boolean(
      m.hotPatch && m.hotPatch.url && (!m.minShellVersion || compareSemver(shellVer, m.minShellVersion) >= 0),
    );
    const expectedSha = canHot
      ? String((m.hotPatch && m.hotPatch.sha256) || '').toLowerCase()
      : String((m.installer && m.installer.sha256) || '').toLowerCase();
    const expectedMode = canHot ? 'hot' : 'installer';
    if (
      readyUpdate &&
      compareSemver(m.version, readyUpdate.version) === 0 &&
      readyUpdate.mode === expectedMode &&
      String(readyUpdate.sha256 || '').toLowerCase() === expectedSha
    ) {
      inFlight = false;
      return emit({ status: 'ready', latestVersion: readyUpdate.version, error: '' });
    }
    if (readyUpdate && compareSemver(m.version, readyUpdate.version) < 0) {
      readyUpdate = null;
    }
    emit({ status: 'downloading', latestVersion: m.version, mode: canHot ? 'hot' : 'installer', notes: m.notes || '' });

    if (canHot) {
      try {
        const buf = await fetchBufferLimited(m.hotPatch.url, { timeoutMs: 30000, maxBytes: MAX_PATCH_BYTES });
        const hotBase = path.join(app.getPath('userData'), 'hot-update');
        const staged = stageHotPatchBuffer(buf, m.hotPatch.sha256, hotBase, m.version);
        readyUpdate = { version: m.version, mode: 'hot', notes: m.notes || '', staged, filePath: '', sha256: staged.sha256 };
        dbg('hot-update-staged:' + m.version);
        inFlight = false;
        return emit({ status: 'ready', latestVersion: m.version, mode: 'hot', error: '' });
      } catch (hotErr) {
        dbg('hot-patch-fallback:' + hotErr);
        const fallback = await prepareInstallerFallback(m);
        if (fallback) {
          readyUpdate = fallback;
          dbg('installer-fallback-ready:' + m.version);
          inFlight = false;
          return emit({ status: 'ready', latestVersion: m.version, mode: 'installer', error: '' });
        }
        throw hotErr;
      }
    }

    const inst = await prepareInstallerFallback(m);
    if (inst) {
      readyUpdate = inst;
      dbg('installer-update-ready:' + m.version);
      inFlight = false;
      return emit({ status: 'ready', latestVersion: m.version, mode: 'installer', error: '' });
    }
    throw new Error('未找到可用更新包');
  } catch (err) {
    dbg('update-err:' + err);
    inFlight = false;
    return emit({ status: manual ? 'error' : 'idle', error: String((err && err.message) || err) });
  }
}

function applyDownloadedUpdate() {
  if (!readyUpdate) return false;
  if (readyUpdate.mode === 'hot' && readyUpdate.staged) {
    try {
      const hotBase = path.join(app.getPath('userData'), 'hot-update');
      commitHotPatch(hotBase, readyUpdate.staged);
      ctx.quitting = true;
      app.relaunch();
      app.exit(0);
      return true;
    } catch (err) {
      dbg('commit-hot-failed:' + err);
      readyUpdate = null;
      emit({ status: 'error', error: String((err && err.message) || err) });
      return false;
    }
  }
  if (readyUpdate.mode === 'installer' && verifyFileSha256(readyUpdate.filePath, readyUpdate.sha256)) {
    ctx.quitting = true;
    spawn(readyUpdate.filePath, [], { detached: true, stdio: 'ignore' }).unref();
    app.exit(0);
    return true;
  }
  readyUpdate = null;
  emit({ status: 'error', error: '更新包完整性校验失败，请重新检查更新' });
  openSafeExternal(RELEASES_URL);
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

module.exports = {
  getUpdateState: () => buildPublicState(),
  checkForUpdates,
  applyDownloadedUpdate,
  startUpdateScheduler,
  stopUpdateScheduler,
};
