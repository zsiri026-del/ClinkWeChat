import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compareSemver } = require('../src/main/semver.js');
const {
  sha256Hex,
  isSafeRelPath,
  stageHotPatchBuffer,
  commitHotPatch,
  pruneOldVersions,
  applyHotPatchBuffer,
} = require('../src/main/hot-apply.js');
const {
  canonicalManifestPayload,
  verifyUpdateManifest,
} = require('../src/main/update-verify.js');

function makePatch(version, pkgVersion = version) {
  const bundle = {
    version,
    files: {
      'src/main/index.js': Buffer.from(`console.log('${version}');`).toString('base64'),
      'package.json': Buffer.from(JSON.stringify({ version: pkgVersion })).toString('base64'),
    },
  };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'));
  return { gz, digest: sha256Hex(gz) };
}

test('compareSemver orders versions accurately', () => {
  assert.equal(compareSemver('2.2.0', '2.1.9'), 1);
  assert.equal(compareSemver('2.2.0', '2.2.0'), 0);
  assert.equal(compareSemver('2.1.0', '2.2.0'), -1);
  assert.equal(compareSemver('v2.10.0', '2.2.0'), 1);
});

test('isSafeRelPath blocks traversal and arbitrary paths', () => {
  assert.equal(isSafeRelPath('src/main/index.js'), true);
  assert.equal(isSafeRelPath('assets/icon-v2.png'), true);
  assert.equal(isSafeRelPath('package.json'), true);
  assert.equal(isSafeRelPath('../evil.js'), false);
  assert.equal(isSafeRelPath('src/../evil.js'), false);
  assert.equal(isSafeRelPath('/etc/passwd'), false);
  assert.equal(isSafeRelPath('C:\\Windows\\win.ini'), false);
  assert.equal(isSafeRelPath('node_modules/x.js'), false);
});

test('stageHotPatchBuffer enforces sha256, version consistency, and staged activation', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clink-hot-'));
  try {
    const p1 = makePatch('2.2.1');
    const p2 = makePatch('2.2.2');
    const badPkg = makePatch('2.2.3', '9.9.9');

    assert.throws(() => stageHotPatchBuffer(p1.gz, '', tmp, '2.2.1'), /SHA-256/);
    assert.throws(() => stageHotPatchBuffer(p1.gz, '0'.repeat(64), tmp, '2.2.1'), /SHA-256/);
    assert.throws(() => stageHotPatchBuffer(p1.gz, p1.digest, tmp, '2.2.9'), /不一致/);
    assert.throws(() => stageHotPatchBuffer(badPkg.gz, badPkg.digest, tmp, '2.2.3'), /package\.json/);

    const staged1 = stageHotPatchBuffer(p1.gz, p1.digest, tmp, '2.2.1');
    assert.equal(fs.existsSync(path.join(tmp, 'active.json')), false);
    assert.equal(fs.existsSync(path.join(staged1.dir, 'src', 'main', 'index.js')), true);

    commitHotPatch(tmp, staged1);
    const active1 = JSON.parse(fs.readFileSync(path.join(tmp, 'active.json'), 'utf8'));
    assert.equal(active1.version, '2.2.1');
    assert.equal(active1.previous, null);

    const staged2 = applyHotPatchBuffer(p2.gz, p2.digest, tmp, { expectedVersion: '2.2.2' });
    const active2 = JSON.parse(fs.readFileSync(path.join(tmp, 'active.json'), 'utf8'));
    assert.equal(active2.version, '2.2.2');
    assert.equal(active2.previous.version, '2.2.1');
    assert.equal(fs.existsSync(staged1.dir), true);

    const staleDir = path.join(tmp, 'v2.1.0-deadbeef');
    fs.mkdirSync(staleDir, { recursive: true });
    pruneOldVersions(tmp, [staged2.dir, staged1.dir]);
    assert.equal(fs.existsSync(staleDir), false);
    assert.equal(fs.existsSync(staged1.dir), true);
    assert.equal(fs.existsSync(staged2.dir), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('verifyUpdateManifest verifies Ed25519 signature, URL allowlist, and sha256', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  const sign = (manifest) => {
    const payload = Buffer.from(canonicalManifestPayload(manifest), 'utf8');
    return {
      ...manifest,
      sigAlg: 'ed25519',
      signature: crypto.sign(null, payload, privPem).toString('base64'),
    };
  };

  const valid = sign({
    version: '2.2.1',
    minShellVersion: '2.2.0',
    hotPatch: {
      url: 'https://github.com/zsiri026-del/ClinkWeChat/releases/download/v2.2.1/hot-patch-2.2.1.json.gz',
      sha256: 'a'.repeat(64),
      size: 12345,
    },
  });

  assert.equal(verifyUpdateManifest(valid, { publicKeyPem: pubPem }), true);

  const tampered = { ...valid, version: '9.9.9' };
  assert.throws(() => verifyUpdateManifest(tampered, { publicKeyPem: pubPem }), /签名/);

  const badUrl = sign({
    ...valid,
    hotPatch: { ...valid.hotPatch, url: 'https://evil.example.com/patch.gz' },
  });
  assert.throws(() => verifyUpdateManifest(badUrl, { publicKeyPem: pubPem }), /不受信任/);

  const noHash = sign({
    ...valid,
    hotPatch: { url: valid.hotPatch.url, size: 123 },
  });
  assert.throws(() => verifyUpdateManifest(noHash, { publicKeyPem: pubPem }), /SHA-256/);
});
