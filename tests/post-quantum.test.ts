import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { PUBLIC_KEYS, signingBytes, verifyReceipt, encodeReceiptFragment, decodeReceiptFragment } from '@mikthatguy/momento-protocol';
import app from '../apps/api/src/index.ts';

test('ML-DSA-65 interoperates with independent Node/OpenSSL in both directions', { skip: Number(process.versions.node.split('.')[0]) < 24 ? 'Native ML-DSA interoperability requires Node 24; portable verification is tested separately.' : false }, async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/protocol-v2.json', import.meta.url), 'utf8'));
  const pair = generateKeyPairSync('ml-dsa-65');
  const der = pair.publicKey.export({ format: 'der', type: 'spki' });
  const prefix = der.subarray(0, der.length - 1952);
  const fixtureKey = createPublicKey({ key: Buffer.concat([prefix, Buffer.from(fixture.publicKey, 'base64url')]), format: 'der', type: 'spki' });
  assert.equal(verify(null, Buffer.from(fixture.signingMessage), fixtureKey, Buffer.from(fixture.receipt.signature, 'base64url')), true);
  const payload = { ...fixture.receipt.payload, keyId: 'openssl-test' };
  const bytes = signingBytes(payload);
  const receipt = { payload, signature: sign(null, bytes, pair.privateKey).toString('base64url') };
  PUBLIC_KEYS[payload.keyId] = der.subarray(-1952).toString('base64url');
  try {
    assert.equal((await verifyReceipt(receipt)).valid, true);
    assert.deepEqual(decodeReceiptFragment(encodeReceiptFragment(receipt)), receipt);
    assert.equal(ml_dsa65.verify(Buffer.from(receipt.signature, 'base64url'), bytes, der.subarray(-1952)), true);
    for (const field of ['version', 'hash', 'issuedAt', 'receiptId', 'keyId'] as const) {
      const altered = structuredClone(receipt);
      const values = { version: 1, hash: 'a'.repeat(64), issuedAt: '2020-01-01T00:00:00.000Z', receiptId: Buffer.alloc(16, 1).toString('base64url'), keyId: 'another-key' };
      altered.payload[field] = values[field];
      assert.equal((await verifyReceipt(altered)).valid, false, field);
    }
    const corrupt = Buffer.from(receipt.signature, 'base64url');
    corrupt[100] ^= 1;
    assert.equal((await verifyReceipt({ ...receipt, signature: corrupt.toString('base64url') })).valid, false);
  } finally { delete PUBLIC_KEYS[payload.keyId]; }
});

test('older Ed25519 keys and v1 routes cannot be used as a fallback', async () => {
  const old = JSON.parse(readFileSync(new URL('./fixtures/protocol-v1.json', import.meta.url), 'utf8'));
  PUBLIC_KEYS[old.receipt.payload.keyId] = old.publicKey;
  try {
    assert.equal((await verifyReceipt(old.receipt)).valid, false);
    assert.equal((await verifyReceipt({ ...old.receipt, payload: { ...old.receipt.payload, version: 2 } })).valid, false);
    for (const path of ['/api/v1/stamp', '/api/v1/verify', '/api/v1/keys']) {
      assert.equal((await app.request(path, { method: path.endsWith('keys') ? 'GET' : 'POST' })).status, 404);
    }
  } finally { delete PUBLIC_KEYS[old.receipt.payload.keyId]; }
});
