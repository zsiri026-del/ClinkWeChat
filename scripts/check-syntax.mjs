import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(srcDir);
let failed = 0;

for (const file of files) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
  if (file.endsWith('.js')) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      console.error(`SYNTAX FAIL: ${rel}\n${err.stderr?.toString() || err.message}`);
      failed++;
    }
  }
  if (lines > 100) {
    console.warn(`LINE LIMIT (>100): ${rel} (${lines} lines)`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`Check failed with ${failed} issue(s).`);
  process.exit(1);
}
console.log(`All ${files.length} source files passed syntax & <=100-line checks.`);
