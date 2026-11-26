import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const config = require('../src/main/config.js');
const state = require('../src/main/state.js');
const { buildFillScript } = require('../src/main/fill-script.js');

test('trusted host matching works strictly for clink.cn', () => {
  assert.equal(config.isTrusted('https://agent-bj.clink.cn/foo'), true);
  assert.equal(config.isTrusted('https://clink.cn/login'), true);
  assert.equal(config.isTrusted('https://evil-clink.cn/login'), false);
  assert.equal(config.isTrusted('https://example.com'), false);
});

test('tracked timers are cancelled cleanly on clearAllTimers', async () => {
  let fired = 0;
  state.setTrackedTimeout(() => { fired++; }, 30);
  state.setTrackedInterval(() => { fired++; }, 15);
  state.clearAllTimers();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(fired, 0);
});

test('activity-hook contains zero setInterval calls and zero innerText reflows', () => {
  const hook = fs.readFileSync(path.resolve('src/inject/activity-hook.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.equal(/\bsetInterval\b/.test(hook), false);
  assert.equal(/\binnerText\b/.test(hook), false);
});

test('buildFillScript generates syntactically valid JS', () => {
  const script = buildFillScript('10001', 'agent@test.com', 'p@ss"word', true);
  assert.doesNotThrow(() => new Function(script));
});
