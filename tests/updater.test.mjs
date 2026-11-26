import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compareSemver } = require('../src/main/semver.js');
const { sha256Hex, isSafeRelPath, applyHotPatchBuffer } = require('../src/main/hot-apply.js');

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

test('applyHotPatchBuffer extracts valid bundle, verifies sha256, and rejects tampering', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clink-hot-'));
  try {
    const bundle = {
      version: '2.2.1',
      files: {
        'src/main/index.js': Buffer.from("console.log('ok');").toString('base64'),
        'package.json': Buffer.from('{"version":"2.2.1"}').toString('base64'),
      },
    };
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'));
    const digest = sha256Hex(gz);

    assert.throws(() => applyHotPatchBuffer(gz, '0'.repeat(64), tmp), /SHA-256/);

    const res = applyHotPatchBuffer(gz, digest, tmp);
    assert.equal(res.version, '2.2.1');
    assert.equal(fs.existsSync(path.join(tmp, 'v2.2.1', 'src', 'main', 'index.js')), true);
    const active = JSON.parse(fs.readFileSync(path.join(tmp, 'active.json'), 'utf8'));
    assert.equal(active.version, '2.2.1');
    assert.equal(active.attempts, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
