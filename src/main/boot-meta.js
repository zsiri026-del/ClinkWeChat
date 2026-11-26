'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

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

module.exports = { activeMetaPath, readActiveMeta, writeActiveMeta, clearActiveMeta, confirmBootSuccess };
