import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const issues = [];
let checked = 0;
const excluded = new Set(['.git', 'node_modules', '.showcase']);
const privateFiles = new Set(['data.json', 'snapshot.json', '.env', '.DS_Store']);
const patterns = [
  ['absolute home directory', /\/(?:Users|home)\/[a-zA-Z0-9_.-]+\//],
  ['legacy plugin data location', /plugins\/command-center\//],
  ['embedded credential', /\b(?:sk-[A-Za-z0-9_-]{24,}|ghp_[A-Za-z0-9]{25,}|AKIA[A-Z0-9]{16})\b/],
  ['personal usage seed', /export\s+const\s+SEED_TOKEN_MANUAL/],
];

async function scan(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const filename = path.join(dir, entry.name);
    const relative = path.relative(root, filename);
    if (entry.isSymbolicLink()) { issues.push(relative + ': symbolic link requires review'); continue; }
    if (privateFiles.has(entry.name) || entry.name.startsWith('.env.')) {
      issues.push(relative + ': private runtime file'); continue;
    }
    if (entry.isDirectory()) { await scan(filename); continue; }
    if (!/\.(ts|js|mjs|cjs|json|css|md|yml|yaml)$/.test(entry.name)) continue;
    const content = await fs.readFile(filename, 'utf8'); checked++;
    for (const [label, pattern] of patterns) {
      if (pattern.test(content)) issues.push(relative + ': ' + label);
    }
  }
}
await scan(root);
const manifest = JSON.parse(await fs.readFile('manifest.json', 'utf8'));
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
if (manifest.id !== 'feifan-life') issues.push('Unexpected public plugin identifier');
if ('deploy' in pkg.scripts) issues.push('Automatic deployment command must not be present');
console.log(JSON.stringify({ checkedTextFiles: checked, issues, scope: 'Local patterns only; manual privacy and license review remain required.' }, null, 2));
if (issues.length) process.exitCode = 1;
