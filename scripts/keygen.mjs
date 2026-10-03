import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const protocolFile = resolve(root, 'packages/protocol/src/index.ts');
const secretFile = resolve(root, 'apps/api/.dev.vars');
const placeholder = 'REPLACE_WITH_ML_DSA65_PUBLIC_KEY';
const source = readFileSync(protocolFile, 'utf8');
if (!source.includes(placeholder)) {
  console.error('An ML-DSA-65 key is already configured. Follow docs/key-lifecycle.md to rotate it.');
  process.exit(1);
}
const existing = existsSync(secretFile) ? readFileSync(secretFile, 'utf8') : '';
if (/^\s*ML_DSA65_PRIVATE_KEY_BASE64URL\s*=/m.test(existing)) {
  console.error('An ML-DSA-65 secret already exists; refusing to overwrite it.');
  process.exit(1);
}
const { publicKey, secretKey } = ml_dsa65.keygen();
const base64url = bytes => Buffer.from(bytes).toString('base64url');
// Migration intentionally discards the obsolete local Ed25519 secret.
const retained = existing.split(/\r?\n/).filter(line => !/^\s*SIGNING_PRIVATE_KEY_BASE64URL\s*=/.test(line)).join('\n').trimEnd();
writeFileSync(secretFile, (retained ? retained + '\n' : '') + 'ML_DSA65_PRIVATE_KEY_BASE64URL="' + base64url(secretKey) + '"\n', { mode: 0o600 });
writeFileSync(protocolFile, source.replace(placeholder, base64url(publicKey)).replace('status: "active", createdAt: null', 'status: "active", createdAt: "' + new Date().toISOString() + '"'));
secretKey.fill(0);
console.log('New ML-DSA-65 public key configured. Private key saved only in apps/api/.dev.vars. Older local Ed25519 secret discarded.');
console.log('Before deploying, upload ML_DSA65_PRIVATE_KEY_BASE64URL as a Worker secret and delete the old SIGNING_PRIVATE_KEY_BASE64URL secret. See docs/key-lifecycle.md.');
