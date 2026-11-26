'use strict';

const { app, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

async function fetchWithTimeout(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await net.fetch(url, { signal: ac.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function downloadInstaller(info, version) {
  const dir = path.join(app.getPath('temp'), 'clink-update');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `KefuOnline-${version}-Setup-x64.exe`);
  const res = await fetchWithTimeout(info.url, 180000);
  const hash = crypto.createHash('sha256');
  const ws = fs.createWriteStream(dest);
  for await (const chunk of res.body) {
    hash.update(chunk);
    ws.write(chunk);
  }
  await new Promise((r, j) => {
    ws.end();
    ws.on('finish', r);
    ws.on('error', j);
  });
  if (info.sha256 && hash.digest('hex') !== String(info.sha256).toLowerCase()) {
    fs.rmSync(dest, { force: true });
    throw new Error('安装包 SHA-256 校验失败');
  }
  return dest;
}

module.exports = { fetchWithTimeout, downloadInstaller };
