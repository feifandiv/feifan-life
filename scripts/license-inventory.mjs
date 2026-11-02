import fs from 'node:fs/promises';

const lock = JSON.parse(await fs.readFile('package-lock.json', 'utf8'));
const dependencies = Object.entries(lock.packages).filter(([name]) => name).map(([location, pkg]) => ({
  name: location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length),
  version: pkg.version,
  license: pkg.license ?? 'UNKNOWN',
  developmentOnly: Boolean(pkg.dev),
  optional: Boolean(pkg.optional),
}));
const report = { source: 'package-lock.json', scope: 'Build, type and test dependency declarations. Not a legal audit or list of bundled runtime code.', dependencies };
if (process.argv.includes('--check')) {
  if (JSON.stringify(JSON.parse(await fs.readFile('docs/licenses/dependencies.json', 'utf8'))) !== JSON.stringify(report)) throw new Error('Run npm run licenses:inventory after updating dependencies');
} else {
  await fs.writeFile('docs/licenses/dependencies.json', JSON.stringify(report, null, 2) + '\n');
}
if (dependencies.some(pkg => pkg.license === 'UNKNOWN')) throw new Error('Dependency license needs review');
console.log('License declarations verified for ' + dependencies.length + ' locked dependencies.');
