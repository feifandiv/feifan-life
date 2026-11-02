import { build } from 'esbuild';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

await mkdir('node_modules/.cache', { recursive: true });
const temp = await mkdtemp(path.resolve('node_modules/.cache/feifan-life-tests-'));
try {
  const output = path.join(temp, 'suite.cjs');
  await build({
    entryPoints: ['tests/suite.ts'], outfile: output, bundle: true,
    platform: 'node', format: 'cjs', packages: 'external',
    loader: { '.jpg': 'dataurl' },
    alias: { obsidian: path.resolve('tests/mocks/obsidian.ts') },
  });
  const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(temp, { recursive: true, force: true }); }
