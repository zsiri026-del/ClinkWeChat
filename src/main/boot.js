'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { compareSemver, readPkgVersion } = require('./semver');
const { readActiveMeta, writeActiveMeta, clearActiveMeta } = require('./boot-meta');

const BUNDLED_ROOT = path.resolve(__dirname, '..', '..');
const MAX_BOOT_ATTEMPTS = 2;

function selectHotEntry() {
  const bundledVer = readPkgVersion(BUNDLED_ROOT);
  const meta = readActiveMeta();
  if (!meta || !meta.version || !meta.dir) return null;

  if (compareSemver(meta.version, bundledVer) <= 0 || (meta.attempts || 0) >= MAX_BOOT_ATTEMPTS) {
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

if (!global.__clinkBooted) {
  global.__clinkBooted = true;
  const hotEntry = selectHotEntry();
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
