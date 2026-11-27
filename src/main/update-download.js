'use strict';

const { app, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { isSha256Hex } = require('./update-verify');

const MAX_MANIFEST_BYTES = 512 * 1024;
const MAX_INSTALLER_BYTES = 300 * 1024 * 1024;

async function fetchBufferLimited(url, { timeoutMs = 30000, maxBytes = 10 * 1024 * 1024 } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('请求超时')), timeoutMs);
  try {
    const res = await net.fetch(url, { signal: ac.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentLen = Number(res.headers.get('content-length') || 0);
    if (contentLen > maxBytes) throw new Error('响应体积超过安全上限');

    if (!res.body) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) throw new Error('响应体积超过安全上限');
      return buf;
    }

    const chunks = [];
    let total = 0;
    for await (const raw of res.body) {
      const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      total += chunk.length;
      if (total > maxBytes) {
        ac.abort();
        throw new Error('响应体积超过安全上限');
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 15000, maxBytes = MAX_MANIFEST_BYTES) {
  const buf = await fetchBufferLimited(url, { timeoutMs, maxBytes });
  return JSON.parse(buf.toString('utf8'));
}

function verifyFileSha256(filePath, expectedSha256) {
  if (!isSha256Hex(expectedSha256) || !filePath || !fs.existsSync(filePath)) return false;
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(64 * 1024);
    let n = 0;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, n));
    }
    return hash.digest('hex') === String(expectedSha256).toLowerCase();
  } finally {
    fs.closeSync(fd);
  }
}

async function downloadInstaller(info, version) {
  if (!info || !info.url || !isSha256Hex(info.sha256)) {
    throw new Error('安装包缺少有效的地址或 SHA-256 摘要');
  }
  const safeVer = String(version || '0.0.0').replace(/[^0-9A-Za-z._-]/g, '');
  const tag = String(info.sha256).toLowerCase().slice(0, 8);
  const dir = path.join(app.getPath('temp'), 'clink-update');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `KefuOnline-${safeVer}-${tag}-Setup-x64.exe`);
  if (verifyFileSha256(dest, info.sha256)) return dest;

  const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error('安装包下载超时')), 180000);
  try {
    const res = await net.fetch(info.url, { signal: ac.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentLen = Number(res.headers.get('content-length') || 0);
    if (contentLen > MAX_INSTALLER_BYTES) throw new Error('安装包体积超过上限');
    if (!res.body) throw new Error('安装包响应体为空');

    const hash = crypto.createHash('sha256');
    let total = 0;
    const meter = new Transform({
      transform(chunk, _enc, cb) {
        total += chunk.length;
        if (total > MAX_INSTALLER_BYTES) {
          cb(new Error('安装包体积超过上限'));
          return;
        }
        hash.update(chunk);
        cb(null, chunk);
      },
    });

    await pipeline(Readable.fromWeb(res.body), meter, fs.createWriteStream(tmp));
    const actual = hash.digest('hex');
    if (actual !== String(info.sha256).toLowerCase()) {
      throw new Error('安装包 SHA-256 校验失败');
    }
    fs.renameSync(tmp, dest);
    return dest;
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  fetchBufferLimited,
  fetchJsonWithTimeout,
  verifyFileSha256,
  downloadInstaller,
};
