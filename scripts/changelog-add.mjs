#!/usr/bin/env node
/**
 * 往 CHANGELOG.md 的「未发布」区插入一条带时间戳的改动记录。
 *
 * 用法：
 *   node scripts/changelog-add.mjs "fix: 状态灯不刷新" \
 *     --change "就绪判定改为 did-stop-loading" \
 *     --why "SPA 跳转会覆盖就绪状态" \
 *     --file "src/main.js" \
 *     --verify "截图确认绿灯"
 *
 * 也可只用一句话：node scripts/changelog-add.mjs "docs: 更新说明"
 * 时间戳取本机当前时间（精确到秒），插入到「未发布」区最上方。
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

const entry = lines.join('\n');

let text = fs.readFileSync(FILE, 'utf8');
const anchor = '## 未发布\n';
if (!text.includes(anchor)) {
  console.error('CHANGELOG.md 里找不到「## 未发布」区，请先手动补上。');
  process.exit(1);
}
text = text.replace(anchor, `${anchor}\n${entry}\n\n---\n`);
fs.writeFileSync(FILE, text);
console.log(`已写入 ${stamp}\n${entry}`);
