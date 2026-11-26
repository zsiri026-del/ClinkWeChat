'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { compareSemver, readPkgVersion } = require('./semver');

const BUNDLED_ROOT = path.resolve(__dirname, '..', '..');
const MAX_BOOT_ATTEMPTS = 2;

function activeMetaPath() {
  return path.join(app.getPath('userData'), 'hot-update', 'active.json');
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
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2));
  fs.renameSync(tmp, p);
}

function clearActiveMeta() {
  try { fs.rmSync(activeMetaPath(), { force: true }); } catch {}
}

function confirmBootSuccess() {
  const meta = readActiveMeta();
  if (!meta || !meta.attempts) return;
  try {
    meta.attempts = 0;
    writeActiveMeta(meta);
  } catch {}
}

function selectEntry() {
  const bundledVer = readPkgVersion(BUNDLED_ROOT);
  const meta = readActiveMeta();
  if (!meta || !meta.version || !meta.dir) return null;

  if (compareSemver(meta.version, bundledVer) <= 0) {
    clearActiveMeta();
    return null;
  }
  if ((meta.attempts || 0) >= MAX_BOOT_ATTEMPTS) {
    clearActiveMeta();
    return null;
  }
  const entry = path.join(meta.dir, 'src', 'main', 'index.js');
  if (!fs.existsSync(entry)) {
    clearActiveMeta();
    return null;
  }
  try {
    meta.attempts = (meta.attempts || 0) + 1;
    writeActiveMeta(meta);
  } catch {}
  return entry;
}

if (require.main === module) {
  const hotEntry = selectEntry();
  if (hotEntry) {
    try {
      require(hotEntry);
    } catch {
      clearActiveMeta();
      require('./index.js');
    }
  } else {
    require('./index.js');
  }
}

module.exports = { activeMetaPath, readActiveMeta, writeActiveMeta, clearActiveMeta, confirmBootSuccess };
