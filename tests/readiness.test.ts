import assert from 'node:assert/strict';
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { test } from 'node:test';
import app from '../apps/api/src/index.ts';
import { KEY_ID, KEY_METADATA, PUBLIC_KEYS, publicKeyFingerprint } from '@mikthatguy/momento-protocol';

test('readiness validates signing keys and bindings, while health remains liveness only', async () => {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const pair = ml_dsa65.keygen(seed);
  const original = PUBLIC_KEYS[KEY_ID];
  const limiter = { limit: async () => { throw new Error('Readiness must not consume quota'); } };
  const env = { ML_DSA65_PRIVATE_KEY_BASE64URL: Buffer.from(seed).toString("base64url"), STAMP_CLIENT_LIMIT: limiter, STAMP_GLOBAL_LIMIT: limiter, VERIFY_CLIENT_LIMIT: limiter, VERIFY_GLOBAL_LIMIT: limiter };
  try {
    PUBLIC_KEYS[KEY_ID] = Buffer.from(pair.publicKey).toString("base64url");
    const ready = await app.request('/api/ready', {}, env);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { ready: true });
    assert.equal(ready.headers.get('cache-control'), 'no-store');
    assert.equal(ready.headers.get('x-content-type-options'), 'nosniff');
    assert.match(ready.headers.get('x-request-id')!, /^[0-9a-f-]{36}$/);
    assert.equal((await app.request('/api/ready', {}, { ...env, ML_DSA65_PRIVATE_KEY_BASE64URL: '' })).status, 503);
    assert.equal((await app.request('/api/ready', {}, { ...env, ML_DSA65_PRIVATE_KEY_BASE64URL: 'bad' })).status, 503);
    const mismatched = crypto.getRandomValues(new Uint8Array(32));
    assert.equal((await app.request('/api/ready', {}, { ...env, ML_DSA65_PRIVATE_KEY_BASE64URL: Buffer.from(mismatched).toString("base64url") })).status, 503);
    assert.equal((await app.request('/api/ready', {}, { ...env, STAMP_CLIENT_LIMIT: undefined })).status, 503);
    assert.equal((await app.request('/api/health', {}, {})).status, 200);
    KEY_METADATA[KEY_ID].status = 'compromised';
    assert.equal((await app.request('/api/ready', {}, env)).status, 503);
    KEY_METADATA[KEY_ID].status = 'active';
    const keys = await (await app.request('/api/v2/keys')).json();
    assert.equal(keys.keys[KEY_ID], PUBLIC_KEYS[KEY_ID]);
    assert.equal(keys.metadata[KEY_ID].fingerprint, await publicKeyFingerprint(PUBLIC_KEYS[KEY_ID]));
  } finally { PUBLIC_KEYS[KEY_ID] = original; KEY_METADATA[KEY_ID].status = 'active'; }
});

test('request logs contain no body, query, arbitrary path, or private signing material', async () => {
  const logs: string[] = [];
  const previous = console.log;
  console.log = value => logs.push(String(value));
  try {
    await app.request('/api/not-a-route-sensitive?hash=private-query', { headers: { 'X-Request-ID': 'user-supplied-sensitive-value' } });
    assert.equal(logs.length, 1);
    const log = JSON.parse(logs[0]);
    assert.equal(log.path, 'other');
    assert.equal(log.status, 404);
    assert.equal(log.event, 'api_request');
    assert.ok(!logs[0].includes('sensitive'));
    assert.ok(!logs[0].includes('private-query'));
  } finally { console.log = previous; }
});
