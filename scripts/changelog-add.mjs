#!/usr/bin/env node
/**
 * 往 CHANGELOG.md 的「未发布」区插入一条带时间戳的改动记录。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'CHANGELOG.md');

const argv = process.argv.slice(2);
const title = argv.find((a) => !a.startsWith('--'));
if (!title) {
  console.error('用法: node scripts/changelog-add.mjs "fix: 一句话说明" [--change 文案] [--why 文案] [--file 路径] [--verify 结果]');
  process.exit(1);
}

const opt = (name) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : '';
};

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp =
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
  `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

const lines = [`### [${stamp}] ${title}`, ''];
const change = opt('change');
const why = opt('why');
const file = opt('file');
const verify = opt('verify');

lines.push(`- 变更：${change || '（待补充）'}`);
lines.push(`- 原因：${why || '（待补充）'}`);
if (file) lines.push(`- 文件：${file}`);
lines.push(`- 验证：${verify || '未验证'}`);

const text = fs.readFileSync(FILE, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const entry = lines.join(eol);
const anchorRe = /^## 未发布\r?\n/m;

let nextText;
if (anchorRe.test(text)) {
  nextText = text.replace(anchorRe, (m) => `${m}${eol}${entry}${eol}${eol}---${eol}`);
} else if (/^# .+\r?\n/m.test(text)) {
  nextText = text.replace(/^# .+\r?\n/m, (m) => `${m}${eol}## 未发布${eol}${eol}${entry}${eol}${eol}---${eol}`);
} else {
  nextText = `## 未发布${eol}${eol}${entry}${eol}${eol}---${eol}${eol}${text}`;
}

fs.writeFileSync(FILE, nextText);
console.log(`已写入 ${stamp}\n${entry}`);
