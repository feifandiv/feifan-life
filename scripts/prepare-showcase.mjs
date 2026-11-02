import esbuild from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

await mkdir('.showcase', { recursive: true });
await esbuild.build({
  entryPoints: ['scripts/showcase.ts'], outfile: '.showcase/render.cjs',
  bundle: true, platform: 'node', format: 'cjs',
  external: ['jsdom', 'lucide'], loader: { '.jpg': 'dataurl' },
  alias: { obsidian: './tests/mocks/obsidian.ts' },
});
execFileSync(process.execPath, ['.showcase/render.cjs'], { stdio: 'inherit' });
