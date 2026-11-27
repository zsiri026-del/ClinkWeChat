'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { isSha256Hex } = require('./update-verify');

const ALLOWED_PREFIXES = ['src/', 'assets/'];
const ALLOWED_ROOT_FILES = new Set(['package.json']);
const MAX_UNZIPPED_BYTES = 32 * 1024 * 1024;
const MAX_FILE_COUNT = 500;

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

function isPathInside(baseDir, candidateDir) {
  if (!baseDir || !candidateDir) return false;
  const base = path.resolve(baseDir);
  const target = path.resolve(candidateDir);
  const rel = path.relative(base, target);
  return Boolean(rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function stageHotPatchBuffer(gzBuf, expectedSha256, baseDir, expectedVersion = '') {
  if (!Buffer.isBuffer(gzBuf) || !gzBuf.length) throw new Error('补丁内容为空');
  if (!isSha256Hex(expectedSha256)) throw new Error('补丁缺少有效的 SHA-256 摘要');
  const actual = sha256Hex(gzBuf);
  if (actual !== String(expectedSha256).toLowerCase()) {
    throw new Error('补丁 SHA-256 校验不匹配');
  }

  let unzipped;
  try {
    unzipped = zlib.gunzipSync(gzBuf, { maxOutputLength: MAX_UNZIPPED_BYTES });
  } catch {
    throw new Error('补丁解压失败或体积超过安全上限');
  }

  const bundle = JSON.parse(unzipped.toString('utf8'));
  if (!bundle || typeof bundle.version !== 'string' || !bundle.version.trim() || !bundle.files || typeof bundle.files !== 'object') {
    throw new Error('补丁包格式无效');
  }
  if (expectedVersion && bundle.version !== expectedVersion) {
    throw new Error(`补丁版本(${bundle.version})与清单版本(${expectedVersion})不一致`);
  }

  const entries = Object.entries(bundle.files);
  if (!entries.length || entries.length > MAX_FILE_COUNT) throw new Error('补丁文件数量异常');

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const verTag = `v${bundle.version.replace(/[^0-9A-Za-z._-]/g, '')}-${actual.slice(0, 8)}-${suffix}`;
  const targetDir = path.join(baseDir, verTag);
  const stagingDir = path.join(baseDir, `${verTag}.staging.${process.pid}`);

  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  try {
    for (const [rel, b64] of entries) {
      if (!isSafeRelPath(rel)) throw new Error('非法补丁路径: ' + rel);
      const outPath = path.join(stagingDir, ...rel.split('/'));
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(String(b64), 'base64'));
    }

    if (!fs.existsSync(path.join(stagingDir, 'src', 'main', 'index.js'))) {
      throw new Error('补丁缺少主入口文件');
    }

    const pkgPath = path.join(stagingDir, 'package.json');
    if (!fs.existsSync(pkgPath)) throw new Error('补丁缺少 package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg || pkg.version !== bundle.version) {
      throw new Error('补丁内 package.json 版本与补丁声明版本不一致');
    }

    fs.renameSync(stagingDir, targetDir);
  } catch (err) {
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    throw err;
  }

  return { version: bundle.version, dir: targetDir, sha256: actual, fileCount: entries.length };
}

function readJsonQuiet(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function commitHotPatch(baseDir, staged) {
  if (!staged || !staged.version || !staged.dir) throw new Error('待激活热补丁信息无效');
  if (!isPathInside(baseDir, staged.dir)) throw new Error('热补丁目录越界');
  if (!fs.existsSync(path.join(staged.dir, 'src', 'main', 'index.js'))) {
    throw new Error('热补丁入口文件已缺失');
  }

  const metaPath = path.join(baseDir, 'active.json');
  const prevMeta = readJsonQuiet(metaPath);
  let previous = null;
  if (
    prevMeta &&
    prevMeta.version &&
    prevMeta.dir &&
    path.resolve(prevMeta.dir) !== path.resolve(staged.dir) &&
    isPathInside(baseDir, prevMeta.dir) &&
    fs.existsSync(path.join(prevMeta.dir, 'src', 'main', 'index.js'))
  ) {
    previous = { version: prevMeta.version, dir: prevMeta.dir };
  }

  const nextMeta = {
    version: staged.version,
    dir: staged.dir,
    sha256: staged.sha256 || '',
    attempts: 0,
    appliedAt: Date.now(),
    previous,
  };

  const tmp = `${metaPath}.${process.pid}.${Date.now()}.tmp`;
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(nextMeta, null, 2));
  fs.renameSync(tmp, metaPath);
  return nextMeta;
}

function pruneOldVersions(baseDir, keepDirs = []) {
  try {
    const keepSet = new Set(keepDirs.filter(Boolean).map((d) => path.resolve(d)));
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.resolve(path.join(baseDir, entry.name));
      if (!keepSet.has(full)) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    }
  } catch {
    /* ignore */
  }
}

function applyHotPatchBuffer(gzBuf, expectedSha256, baseDir, opts = {}) {
  const staged = stageHotPatchBuffer(gzBuf, expectedSha256, baseDir, opts.expectedVersion || '');
  if (opts.stageOnly) return staged;
  commitHotPatch(baseDir, staged);
  return staged;
}

module.exports = {
  sha256Hex,
  isSafeRelPath,
  isPathInside,
  stageHotPatchBuffer,
  commitHotPatch,
  pruneOldVersions,
  applyHotPatchBuffer,
};
