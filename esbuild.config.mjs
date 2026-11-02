import esbuild from 'esbuild';
import builtins from 'builtin-modules';
import { mkdir, copyFile, readFile } from 'node:fs/promises';

const mode = process.argv[2] ?? 'build';
if (!['build', 'dev'].includes(mode)) throw new Error('Use build or dev. Automatic deployment is not supported.');
const output = 'build';
await mkdir(output, { recursive: true });
const licenseBanner = '/*!\nFeifan Life - Copyright (c) 2026 Feifan and respective contributors\nSPDX-License-Identifier: GPL-3.0-only\nSource: https://github.com/feifandiv/feifan-life\n\n'
  + await readFile('LICENSE', 'utf8') + '\n\nBundler helper license:\n'
  + await readFile('docs/licenses/esbuild.txt', 'utf8') + '\n\nBundled photograph sources and licenses:\n'
  + await readFile('assets/backgrounds/README.md', 'utf8') + '\n*/';
const context = await esbuild.context({
  entryPoints: ['src/main.ts', 'src/styles.css'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*', ...builtins],
  format: 'cjs', target: 'es2018', logLevel: 'info',
  sourcemap: mode === 'dev' ? 'inline' : false,
  treeShaking: true, charset: 'utf8', outdir: output,
  loader: { '.jpg': 'dataurl' },
  banner: { js: licenseBanner, css: licenseBanner },
});
if (mode === 'dev') await context.watch();
else {
  await context.rebuild();
  await context.dispose();
}
await copyFile('manifest.json', output + '/manifest.json');
