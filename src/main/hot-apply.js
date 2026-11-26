'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const ALLOWED_PREFIXES = ['src/', 'assets/'];
const ALLOWED_ROOT_FILES = new Set(['package.json']);

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function isSafeRelPath(rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 240) return false;
  if (rel.startsWith('/') || rel.startsWith('\\') || /^[a-zA-Z]:/.test(rel)) return false;
  const norm = rel.replace(/\\/g, '/');
  if (norm.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return false;
  if (ALLOWED_ROOT_FILES.has(norm)) return true;
  return ALLOWED_PREFIXES.some((p) => norm.startsWith(p));
}

function applyHotPatchBuffer(gzBuf, expectedSha256, baseDir) {
  if (!Buffer.isBuffer(gzBuf) || !gzBuf.length) throw new Error('补丁内容为空');
  const actual = sha256Hex(gzBuf);
  if (expectedSha256 && actual !== String(expectedSha256).toLowerCase()) {
    throw new Error('补丁 SHA-256 校验不匹配');
  }

  const jsonText = zlib.gunzipSync(gzBuf).toString('utf8');
  const bundle = JSON.parse(jsonText);
  if (!bundle || typeof bundle.version !== 'string' || !bundle.files || typeof bundle.files !== 'object') {
    throw new Error('补丁包格式无效');
  }

  const verTag = 'v' + bundle.version.replace(/[^0-9A-Za-z._-]/g, '');
  const targetDir = path.join(baseDir, verTag);
  const stagingDir = targetDir + '.staging';

  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  const entries = Object.entries(bundle.files);
  if (!entries.length) throw new Error('补丁不包含任何文件');

  for (const [rel, b64] of entries) {
    if (!isSafeRelPath(rel)) throw new Error('非法补丁路径: ' + rel);
    const outPath = path.join(stagingDir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(String(b64), 'base64'));
  }

  if (!fs.existsSync(path.join(stagingDir, 'src', 'main', 'index.js'))) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw new Error('补丁缺少主入口文件');
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.renameSync(stagingDir, targetDir);

  const metaPath = path.join(baseDir, 'active.json');
  const tmp = metaPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({
    version: bundle.version,
    dir: targetDir,
    attempts: 0,
    appliedAt: Date.now(),
  }, null, 2));
  fs.renameSync(tmp, metaPath);

  pruneOldVersions(baseDir, verTag);
  return { version: bundle.version, dir: targetDir, fileCount: entries.length };
}

function pruneOldVersions(baseDir, keepTag) {
  try {
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== keepTag) {
        fs.rmSync(path.join(baseDir, entry.name), { recursive: true, force: true });
      }
    }
  } catch {
    /* ignore */
  }
}

module.exports = { sha256Hex, isSafeRelPath, applyHotPatchBuffer };
