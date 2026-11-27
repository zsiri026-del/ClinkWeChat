'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { compareSemver } = require('./semver');
const { isPathInside, pruneOldVersions } = require('./hot-apply');

function hotUpdateDir() {
  return path.join(app.getPath('userData'), 'hot-update');
}

function activeMetaPath() {
  return path.join(hotUpdateDir(), 'active.json');
}

function readActiveMeta() {
  try {
    return JSON.parse(fs.readFileSync(activeMetaPath(), 'utf8'));
  } catch {
    return null;
  }
}

function writeActiveMeta(meta) {
  const p = activeMetaPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2));
  fs.renameSync(tmp, p);
}

function clearActiveMeta() {
  try { fs.rmSync(activeMetaPath(), { force: true }); } catch {}
}

function rollbackOrClearActiveMeta(bundledVer) {
  const baseDir = hotUpdateDir();
  const meta = readActiveMeta();
  const prev = meta && meta.previous;
  if (
    prev &&
    prev.version &&
    prev.dir &&
    (!bundledVer || compareSemver(prev.version, bundledVer) > 0) &&
    isPathInside(baseDir, prev.dir) &&
    fs.existsSync(path.join(prev.dir, 'src', 'main', 'index.js'))
  ) {
    try {
      const next = {
        version: prev.version,
        dir: prev.dir,
        attempts: 0,
        appliedAt: Date.now(),
        previous: null,
      };
      writeActiveMeta(next);
      return next;
    } catch {}
  }
  clearActiveMeta();
  return null;
}

function confirmBootSuccess(runningVersion) {
  const baseDir = hotUpdateDir();
  const meta = readActiveMeta();
  if (!meta || !meta.version) return;
  if (runningVersion && meta.version !== runningVersion) return;
  try {
    if (meta.attempts || !meta.confirmedAt) {
      meta.attempts = 0;
      meta.confirmedAt = Date.now();
      writeActiveMeta(meta);
    }
    const keep = [meta.dir];
    if (meta.previous && meta.previous.dir) keep.push(meta.previous.dir);
    pruneOldVersions(baseDir, keep);
  } catch {}
}

module.exports = {
  hotUpdateDir,
  activeMetaPath,
  readActiveMeta,
  writeActiveMeta,
  clearActiveMeta,
  rollbackOrClearActiveMeta,
  confirmBootSuccess,
};
