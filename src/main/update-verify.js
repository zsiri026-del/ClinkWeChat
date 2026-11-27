'use strict';

const crypto = require('node:crypto');
const { UPDATE_MANIFEST_URL } = require('./config');

const RELEASE_PUBLIC_KEY_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAaP1xihbYCYpj0jfbhoL5ORWdFpJi/DzlYycj8Z9gfYs=',
  '-----END PUBLIC KEY-----',
].join('\n');

const ALLOWED_RELEASE_PREFIX = 'https://github.com/zsiri026-del/ClinkWeChat/releases/download/';
const SHA256_RE = /^[0-9a-f]{64}$/i;

function isSha256Hex(value) {
  return typeof value === 'string' && SHA256_RE.test(value);
}

function isAllowedReleaseUrl(url, manifestUrl = UPDATE_MANIFEST_URL) {
  if (typeof url !== 'string' || !url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (url.startsWith(ALLOWED_RELEASE_PREFIX)) return true;
    if (process.env.CLINK_UPDATE_URL && manifestUrl) {
      const mUrl = new URL(manifestUrl);
      return mUrl.protocol === 'https:' && parsed.origin === mUrl.origin;
    }
    return false;
  } catch {
    return false;
  }
}

function sortKeys(val) {
  if (Array.isArray(val)) return val.map(sortKeys);
  if (val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val).sort()) {
      out[k] = sortKeys(val[k]);
    }
    return out;
  }
  return val;
}

function canonicalManifestPayload(manifest) {
  const clone = { ...manifest };
  delete clone.signature;
  delete clone.sigAlg;
  return JSON.stringify(sortKeys(clone));
}

function verifyManifestSignature(manifest, publicKeyPem = RELEASE_PUBLIC_KEY_PEM) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (manifest.sigAlg !== 'ed25519' || typeof manifest.signature !== 'string' || !manifest.signature) {
    return false;
  }
  try {
    const payload = Buffer.from(canonicalManifestPayload(manifest), 'utf8');
    const sig = Buffer.from(manifest.signature, 'base64');
    return crypto.verify(null, payload, publicKeyPem, sig);
  } catch {
    return false;
  }
}

function validateArtifact(art, label, manifestUrl) {
  if (!art || typeof art !== 'object') throw new Error(`${label}元数据缺失`);
  if (!isAllowedReleaseUrl(art.url, manifestUrl)) throw new Error(`${label}下载地址不受信任`);
  if (!isSha256Hex(art.sha256)) throw new Error(`${label}缺少有效的 SHA-256 摘要`);
  if (art.size !== undefined && (!Number.isInteger(art.size) || art.size <= 0)) {
    throw new Error(`${label}体积元数据无效`);
  }
}

function verifyUpdateManifest(manifest, opts = {}) {
  const publicKeyPem = opts.publicKeyPem || RELEASE_PUBLIC_KEY_PEM;
  const manifestUrl = opts.manifestUrl || UPDATE_MANIFEST_URL;
  if (!manifest || typeof manifest !== 'object' || typeof manifest.version !== 'string' || !manifest.version.trim()) {
    throw new Error('更新清单格式无效');
  }
  if (!verifyManifestSignature(manifest, publicKeyPem)) {
    throw new Error('更新清单签名校验失败');
  }
  if (manifest.hotPatch) validateArtifact(manifest.hotPatch, '热更新包', manifestUrl);
  if (manifest.installer) validateArtifact(manifest.installer, '全量安装包', manifestUrl);
  if (!manifest.hotPatch && !manifest.installer) {
    throw new Error('更新清单不包含可用更新包');
  }
  return true;
}

module.exports = {
  RELEASE_PUBLIC_KEY_PEM,
  isSha256Hex,
  isAllowedReleaseUrl,
  canonicalManifestPayload,
  verifyManifestSignature,
  verifyUpdateManifest,
};
