import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PUBLIC_KEYS, signingBytes } from '../packages/protocol/src/index.ts';
// @ts-ignore JavaScript action entry point is also exercised directly by Node 24.
import { stampCommit, publishBadge } from '../scripts/action.mjs';

test('Action hashes exact commit bytes, normalizes time, and rejects untrusted receipts', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'momento-action-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  PUBLIC_KEYS['action-test'] = publicKey.export({ format: 'der', type: 'spki' }).toString('base64url');
  try {
    git('init');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'Fixture');
    const body = git('cat-file', 'commit', 'HEAD');
    const hash = createHash('sha256').update(body).digest('hex');
    const payload = { version: 1 as const, hash, issuedAt: '2026-09-25T00:00:00.000Z', receiptId: Buffer.alloc(16).toString('base64url'), keyId: 'action-test' };
    const receipt = { payload, signature: sign(null, signingBytes(payload), privateKey).toString('base64url') };
    const fetchImpl = async (_url: string, options: RequestInit) => {
      assert.deepEqual(JSON.parse(options.body as string), { hash });
      return Response.json(receipt, { status: 201 });
    };
    const outputs = await stampCommit({ cwd, fetchImpl });
    assert.equal(outputs.hash, hash);
    assert.equal(outputs.commit, git('rev-parse', 'HEAD').toString().trim());
    assert.deepEqual(readFileSync(join(outputs['proof-path'], 'commit.txt')), body);
    assert.equal(JSON.parse(readFileSync(join(outputs['proof-path'], 'badge.json'), 'utf8')).message,
      '2026-09-25 00:00:00.000 UTC');
    for (const existing of [false, true]) {
      const calls: { url: string; method: string; body: any }[] = [];
      const published = await publishBadge({ proofPath: outputs['proof-path'], repository: 'someone/project', token: 'test-token',
        fetchImpl: async (url: string, options: RequestInit) => {
          const requestBody = options.body ? JSON.parse(options.body as string) : undefined;
          calls.push({ url, method: options.method!, body: requestBody });
          assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer test-token');
          if (url.endsWith('/ref/heads/momento-badges')) return existing
            ? Response.json({ object: { sha: 'previous' } }) : new Response(null, { status: 404 });
          return Response.json({ sha: 'created' }, { status: 201 });
        }
      });
      assert.match(published['badge-markdown'], /someone%2Fproject/);
      assert.match(published['badge-markdown'], /someone\/project\/blob\/momento-badges\/proof.json/);
      const blobs = calls.filter(call => call.url.endsWith('/blobs'));
      assert.deepEqual(Buffer.from(blobs[0].body.content, 'base64'), body);
      assert.equal(JSON.parse(Buffer.from(blobs[3].body.content, 'base64').toString()).message, '2026-09-25 00:00:00.000 UTC');
      assert.deepEqual(calls.find(call => call.url.endsWith('/commits'))!.body.parents, existing ? ['previous'] : []);
      assert.equal(calls.at(-1)!.method, existing ? 'PATCH' : 'POST');
      if (existing) assert.equal(calls.at(-1)!.body.force, false);
    }
    await assert.rejects(publishBadge({ proofPath: outputs['proof-path'], repository: 'someone/project', token: 'test',
      fetchImpl: async () => new Response(null, { status: 403 }) }), /HTTP 403/);
    receipt.payload.hash = '0'.repeat(64);
    await assert.rejects(stampCommit({ cwd, outputDirectory: 'bad', fetchImpl }), /hash_mismatch/);
    receipt.payload.hash = hash;
    receipt.signature = Buffer.alloc(64).toString('base64url');
    await assert.rejects(stampCommit({ cwd, outputDirectory: 'bad', fetchImpl }), /invalid_signature/);
    assert.equal(existsSync(join(cwd, 'bad')), false);
    await assert.rejects(stampCommit({ cwd, fetchImpl: async () => new Response(null, { status: 429 }) }), /HTTP 429/);
  } finally {
    delete PUBLIC_KEYS['action-test'];
    rmSync(cwd, { recursive: true, force: true });
  }
});
