import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const packages = ['packages/protocol', 'packages/cli'];
const manifests = packages.map(p => JSON.parse(readFileSync(resolve(root, p, 'package.json'), 'utf8')));
const version = manifests[0].version;
if (manifests.some(m => m.version !== version || m.private)) throw Error('Public package versions must match');
if (manifests[1].dependencies[manifests[0].name] !== version) throw Error('CLI protocol dependency must match release');
const tag = process.env.RELEASE_TAG;
if (tag && tag !== `v${version}`) throw Error(`Release tag must be v${version}`);
const out = resolve(root, 'release');
mkdirSync(out, { recursive: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const archives = [];
for (const cwd of packages) {
  const result = JSON.parse(execFileSync(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', out], { cwd: resolve(root, cwd), encoding: 'utf8', shell: process.platform === 'win32' }))[0];
  const files = result.files.map(f => f.path);
  for (const required of ['package.json', 'README.md', 'LICENSE', 'dist/index.js']) if (!files.includes(required)) throw Error(`Missing ${required}`);
  if (files.some(f => !f.startsWith('dist/') && !['package.json', 'README.md', 'LICENSE'].includes(f))) throw Error('Unexpected packaged file');
  if (cwd.endsWith('protocol') && !files.includes('dist/index.d.ts')) throw Error('Missing protocol declarations');
  archives.push({ name: result.name, version: result.version, filename: result.filename, integrity: result.integrity, sha256: createHash('sha256').update(readFileSync(resolve(out, result.filename))).digest('hex'), files });
}
writeFileSync(resolve(out, 'SHA256SUMS'), archives.map(a => `${a.sha256}  ${a.filename}`).join('\n') + '\n');
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify({ version, packages: archives }, null, 2) + '\n');
console.log(archives.map(a => a.filename).join('\n'));
