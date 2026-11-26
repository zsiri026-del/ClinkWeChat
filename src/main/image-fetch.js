'use strict';

const { session } = require('electron');
const { PARTITION } = require('./config');
const { ctx } = require('./state');

const MAX_IMG_BYTES = 50 * 1024 * 1024;

function extOf(mime) {
  const t = String(mime || '').toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('gif')) return 'gif';
  if (t.includes('webp')) return 'webp';
  if (t.includes('bmp')) return 'bmp';
  if (t.includes('svg')) return 'svg';
  return 'png';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function guessFileName(url, mime) {
  let name = '';
  try {
    name = decodeURIComponent((new URL(url).pathname.split('/').pop() || '').trim());
  } catch {
    name = '';
  }
  name = name.replace(/[\\/:*?"<>|]/g, '_');
  if (!name) return `image-${stamp()}.${extOf(mime)}`;
  return /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${name}.${extOf(mime)}`;
}

async function fetchBytes(url) {
  const headers = {};
  if (ctx.view && !ctx.view.webContents.isDestroyed()) {
    const cur = ctx.view.webContents.getURL();
    if (cur) headers.Referer = cur;
    headers['User-Agent'] = ctx.view.webContents.getUserAgent();
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 30000);
  try {
    const res = await session.fromPartition(PARTITION).fetch(url, { headers, signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_IMG_BYTES) throw new Error('图片体积超过 50MB 上限');
    const mime = String(res.headers.get('content-type') || '').split(';')[0].trim();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMG_BYTES) throw new Error('图片体积超过 50MB 上限');
    return { buf, mime };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { extOf, stamp, guessFileName, fetchBytes };
