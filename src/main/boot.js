'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { compareSemver, readPkgVersion } = require('./semver');
const { isPathInside } = require('./hot-apply');
const {
  hotUpdateDir,
  readActiveMeta,
  writeActiveMeta,
  rollbackOrClearActiveMeta,
} = require('./boot-meta');

const BUNDLED_ROOT = path.resolve(__dirname, '..', '..');
const MAX_BOOT_ATTEMPTS = 2;

function selectHotEntry() {
  const bundledVer = readPkgVersion(BUNDLED_ROOT);
  const baseDir = hotUpdateDir();

  for (let hop = 0; hop < 2; hop++) {
    const meta = readActiveMeta();
    if (!meta || !meta.version || !meta.dir) return null;

    if (
      compareSemver(meta.version, bundledVer) <= 0 ||
      (meta.attempts || 0) >= MAX_BOOT_ATTEMPTS ||
      !isPathInside(baseDir, meta.dir)
    ) {
      const rolled = rollbackOrClearActiveMeta(bundledVer);
      if (rolled) continue;
      return null;
    }

    const entry = path.join(meta.dir, 'src', 'main', 'index.js');
    if (!fs.existsSync(entry)) {
      const rolled = rollbackOrClearActiveMeta(bundledVer);
      if (rolled) continue;
      return null;
    }

    try {
      meta.attempts = (meta.attempts || 0) + 1;
      writeActiveMeta(meta);
    } catch {}
    return entry;
  }
  return null;
}

if (!global.__clinkBooted) {
  global.__clinkBooted = true;
  const isShortcutTask = process.argv.includes('--install-shortcut');
  if (!isShortcutTask) {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      app.quit();
      return;
    }
    global.__clinkGotLock = true;
  }

  const bundledVer = readPkgVersion(BUNDLED_ROOT);
  const hotEntry = selectHotEntry();
  if (hotEntry) {
    try {
      require(hotEntry);
    } catch {
      const rolled = rollbackOrClearActiveMeta(bundledVer);
      if (rolled && fs.existsSync(path.join(rolled.dir, 'src', 'main', 'index.js'))) {
        try {
          require(path.join(rolled.dir, 'src', 'main', 'index.js'));
          return;
        } catch {
          rollbackOrClearActiveMeta(bundledVer);
        }
      }
      require('./index.js');
    }
  } else {
    require('./index.js');
  }
}
