import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  RELEASE_PUBLIC_KEY_PEM,
  canonicalManifestPayload,
  verifyUpdateManifest,
} = require('../src/main/update-verify.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const repo = 'zsiri026-del/ClinkWeChat';
const baseUrl = `https://github.com/${repo}/releases/download/v${version}`;
const distDir = path.join(root, 'dist');

const keyPath = process.env.CLINK_SIGN_KEY_PATH || path.join(os.homedir(), '.clinkwechat', 'release-private.pem');
const allowUnsigned = process.argv.includes('--unsigned');
let privPem = '';
if (fs.existsSync(keyPath)) {
  privPem = fs.readFileSync(keyPath, 'utf8');
  const derivedPub = crypto.createPublicKey(privPem).export({ type: 'spki', format: 'pem' }).trim();
  if (derivedPub !== RELEASE_PUBLIC_KEY_PEM.trim()) {
    throw new Error(`签名私钥(${keyPath})与客户端内置公钥不匹配，已中止生成以防发布不可验证清单`);
  }
} else if (!allowUnsigned) {
  throw new Error(`未找到发布签名私钥：${keyPath}（如需本地无签名测试请加 --unsigned）`);
}

fs.mkdirSync(distDir, { recursive: true });

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function walk(dir, relPrefix, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(full, rel, out);
    else out[rel] = fs.readFileSync(full).toString('base64');
  }
}

const files = {};
walk(path.join(root, 'src'), 'src', files);
for (const asset of ['icon-v2.png', 'icon-v2.ico', 'badge.png']) {
  const p = path.join(root, 'assets', asset);
  if (fs.existsSync(p)) files[`assets/${asset}`] = fs.readFileSync(p).toString('base64');
}
files['package.json'] = Buffer.from(JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  main: pkg.main,
}, null, 2)).toString('base64');

const patchName = `hot-patch-${version}.json.gz`;
const patchBuf = zlib.gzipSync(Buffer.from(JSON.stringify({ version, files }), 'utf8'), { level: 9 });
const setupName = `KefuOnline-${version}-Setup-x64.exe`;
const portableName = `KefuOnline-${version}-Portable-x64.exe`;
const setupPath = path.join(distDir, setupName);
const portablePath = path.join(distDir, portableName);

const minShellVersion = process.env.MIN_SHELL_VERSION || pkg.minShellVersion || '2.2.0';
const manifest = {
  version,
  minShellVersion,
  publishedAt: new Date().toISOString(),
  notes: process.env.RELEASE_NOTES || `客服在线平台 v${version}`,
  hotPatch: {
    url: `${baseUrl}/${patchName}`,
    sha256: sha256(patchBuf),
    size: patchBuf.length,
  },
};

const sumLines = [`${sha256(patchBuf)}  ${patchName}`];
if (fs.existsSync(setupPath)) {
  const b = fs.readFileSync(setupPath);
  const h = sha256(b);
  manifest.installer = { url: `${baseUrl}/${setupName}`, sha256: h, size: b.length };
  sumLines.unshift(`${h}  ${setupName}`);
}
if (fs.existsSync(portablePath)) {
  const b = fs.readFileSync(portablePath);
  sumLines.splice(1, 0, `${sha256(b)}  ${portableName}`);
}

if (privPem) {
  const payload = Buffer.from(canonicalManifestPayload(manifest), 'utf8');
  manifest.sigAlg = 'ed25519';
  manifest.signature = crypto.sign(null, payload, privPem).toString('base64');
  verifyUpdateManifest(manifest);
}

fs.writeFileSync(path.join(distDir, patchName), patchBuf);
fs.writeFileSync(path.join(distDir, 'update-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(distDir, 'SHA256SUMS.txt'), sumLines.join('\n') + '\n', 'utf8');
console.log(`Built ${patchName} (${(patchBuf.length / 1024).toFixed(1)} KB) and ${privPem ? 'verified signed' : 'unsigned'} update-manifest.json`);
