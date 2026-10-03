import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PUBLIC_KEYS, KEY_METADATA, signingBytes, verifyReceipt, encodeReceiptFragment, decodeReceiptFragment, decodeReceiptText, readReceiptResponse, base64urlToBytes, MAX_RECEIPT_BYTES } from '@mikthatguy/momento-protocol';

const vector = JSON.parse(readFileSync(new URL('./fixtures/protocol-v2.json', import.meta.url), 'utf8'));

test('v2 fixed vector matches exact bytes and verifies with ML-DSA-65', async () => {
  const id = vector.receipt.payload.keyId;
  PUBLIC_KEYS[id] = vector.publicKey;
  try {
    assert.equal(Buffer.from(signingBytes(vector.receipt.payload)).toString('hex'), vector.signingBytesHex);
    assert.equal(new TextDecoder().decode(signingBytes(vector.receipt.payload)), vector.signingMessage);
    assert.equal((await verifyReceipt(vector.receipt, vector.receipt.payload.hash)).valid, true);
    assert.equal((await verifyReceipt(vector.receipt, 'a'.repeat(64))).reasonCode, 'hash_mismatch');
    assert.deepEqual(decodeReceiptFragment(encodeReceiptFragment(vector.receipt)), vector.receipt);
    KEY_METADATA[id] = { status: 'retired', createdAt: null };
    assert.equal((await verifyReceipt(vector.receipt)).valid, true);
    KEY_METADATA[id].status = 'compromised';
    assert.equal((await verifyReceipt(vector.receipt)).valid, false);
  } finally { delete PUBLIC_KEYS[id]; delete KEY_METADATA[id]; }
});

test('malformed corpus, canonical encodings, and unknown prototype names fail safely', async () => {
  PUBLIC_KEYS[vector.receipt.payload.keyId] = vector.publicKey;
  try {
    const corpus: unknown[] = [null, [], {}, { ...vector.receipt, extra: true }, { ...vector.receipt, payload: [] }];
    for (const [field, value] of [['version', 1], ['hash', 'A'.repeat(64)], ['issuedAt', '2026-02-30T00:00:00.000Z'], ['issuedAt', '2026-01-01T01:00:00.000+01:00'], ['receiptId', 'A'.repeat(23)], ['keyId', 'x'.repeat(129)], ['signatureAlgorithm', 'Ed25519']]) {
      const bad = structuredClone(vector.receipt); bad.payload[field] = value; corpus.push(bad);
    }
    const alias = structuredClone(vector.receipt);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    alias.signature = alias.signature.slice(0, -1) + alphabet[alphabet.indexOf(alias.signature.at(-1)) + 1];
    corpus.push(alias);
    for (const receipt of corpus) assert.equal((await verifyReceipt(receipt)).valid, false);
    for (const keyId of ['constructor', 'toString', '__proto__']) {
      assert.equal((await verifyReceipt({ ...vector.receipt, payload: { ...vector.receipt.payload, keyId } })).reasonCode, 'unknown_key');
    }
    const old = JSON.parse(readFileSync(new URL('./fixtures/protocol-v1.json', import.meta.url), 'utf8'));
    PUBLIC_KEYS[old.receipt.payload.keyId] = old.publicKey;
    assert.equal((await verifyReceipt(old.receipt)).reasonCode, 'invalid_receipt');
    delete PUBLIC_KEYS[old.receipt.payload.keyId];
    assert.throws(() => base64urlToBytes('AB'));
    assert.throws(() => decodeReceiptText(' '.repeat(MAX_RECEIPT_BYTES + 1)));
    assert.throws(() => decodeReceiptFragment('A'.repeat(12000)));
    assert.throws(() => decodeReceiptFragment('%%%'));
  } finally { delete PUBLIC_KEYS[vector.receipt.payload.keyId]; }
});

test('receipt response reader caps streamed bytes without trusting content length', async () => {
  const response = Response.json(vector.receipt);
  assert.deepEqual(await readReceiptResponse(response), vector.receipt);
  let cancelled = false;
  const large = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(MAX_RECEIPT_BYTES + 1)); },
    cancel() { cancelled = true; }
  }));
  await assert.rejects(readReceiptResponse(large), /8 KB/);
  assert.equal(cancelled, true);
});
