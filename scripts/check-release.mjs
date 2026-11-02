import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import postcss from 'postcss';

const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const manifest = await readJson('manifest.json');
const packaged = await readJson('build/manifest.json');
const pkg = await readJson('package.json');
const versions = await readJson('versions.json');
assert.equal(manifest.id, 'feifan-life');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, pkg.version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.deepEqual(packaged, manifest);
assert.equal(manifest.isDesktopOnly, true);
assert.deepEqual((await fs.readdir('build')).sort(), ['main.js', 'manifest.json', 'styles.css']);

const meta = await readJson('.release-audit/build-meta.json');
assert(Object.keys(meta.inputs).every(file => /^(src\/|assets\/backgrounds\/)/.test(file)), 'Unexpected bundled source');
assert(Object.values(meta.outputs).every(output => output.imports.every(item => item.external && item.path === 'obsidian')), 'Unexpected runtime dependency');
const js = await fs.readFile('build/main.js', 'utf8');
const css = await fs.readFile('build/styles.css', 'utf8');
new Script(js, { filename: 'main.js' });
postcss.parse(css, { from: 'styles.css' });
for (const contents of [js, css]) {
  assert(contents.includes(await fs.readFile('LICENSE', 'utf8')), 'Missing project license');
  assert(contents.includes(await fs.readFile('docs/licenses/esbuild.txt', 'utf8')), 'Missing helper license');
  assert(contents.includes(await fs.readFile('assets/backgrounds/README.md', 'utf8')), 'Missing photo notices');
  assert(!/sourceMappingURL=/.test(contents), 'Do not ship source maps');
  assert(!/\/(?:Users|home)\/[a-zA-Z0-9_.-]+\//.test(contents), 'Local home path in release');
}
for (const name of ['lake', 'mist', 'snow']) {
  assert(js.includes((await fs.readFile('assets/backgrounds/' + name + '.jpg')).toString('base64')), 'Missing offline background ' + name);
}
const assets = [];
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  const contents = await fs.readFile('build/' + name);
  assets.push({ name, bytes: contents.length, sha256: createHash('sha256').update(contents).digest('hex') });
}
const report = { version: manifest.version, minAppVersion: manifest.minAppVersion, runtimeDependencies: ['obsidian'], assets };
await fs.writeFile('.release-audit/assets.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
