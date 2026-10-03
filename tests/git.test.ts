import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { PUBLIC_KEYS, signingBytes } from '../packages/protocol/dist/index.js';
import { installGitHooks, prepareGitMessage, stampGitCommit, verifyGitHistory, syncGitProofs, git, PROOFS_REF } from '../packages/cli/src/git.ts';
// @ts-ignore Action is JavaScript.
import { verifyHistory, runAction } from '../scripts/action.mjs';

const cli = fileURLToPath(new URL('../packages/cli/dist/index.js', import.meta.url));
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'momento-git-'));
  git(cwd, 'init'); git(cwd, 'config', 'user.name', 'Test'); git(cwd, 'config', 'user.email', 'test@example.com');
  const { secretKey, publicKey } = ml_dsa65.keygen();
  const keyId = `git-test-${randomBytes(8).toString('hex')}`;
  PUBLIC_KEYS[keyId] = Buffer.from(publicKey).toString('base64url');
  let tick = 0;
  const fetchImpl: typeof fetch = async (_url, options) => {
    const payload = { version: 2 as const, hash: JSON.parse(options!.body as string).hash,
      issuedAt: new Date(Date.UTC(2026, 9, 3, 12, 0, tick++)).toISOString(),
      receiptId: randomBytes(16).toString('base64url'), keyId };
    return Response.json({ payload, signature: Buffer.from(ml_dsa65.sign(signingBytes(payload), secretKey)).toString('base64url') }, { status: 201 });
  };
  const cleanup = () => { delete PUBLIC_KEYS[keyId]; rmSync(cwd, { recursive: true, force: true }); };
  const noHooks = ['-c', 'core.hooksPath=' + join(cwd, 'disabled-hooks')];
  const commit = async (message: string) => {
    const path = join(cwd, 'message.txt'); writeFileSync(path, message);
    await prepareGitMessage(cwd, path);
    git(cwd, ...noHooks, 'commit', '--allow-empty', '-F', path);
    await stampGitCommit({ cwd, fetchImpl });
    return git(cwd, 'rev-parse', 'HEAD');
  };
  return { cwd, fetchImpl, cleanup, commit, noHooks, keyId, secretKey, publicKey };
}

test('full chain binds exact commits, includes merge parents, and rejects missing or rewritten history', async () => {
  const f = fixture();
  try {
    await installGitHooks({ cwd: f.cwd, entryPath: cli, fetchImpl: f.fetchImpl });
    const root = await f.commit('Root');
    const branch = git(f.cwd, 'branch', '--show-current');
    git(f.cwd, 'checkout', '-b', 'side');
    await f.commit('Side');
    git(f.cwd, 'checkout', branch);
    const main = await f.commit('Main');
    // Model the MERGE_HEAD state observed by prepare-commit-msg.
    git(f.cwd, ...f.noHooks, 'merge', '--no-commit', '--no-ff', 'side');
    await f.commit('Merge');
    const report = await verifyGitHistory({ cwd: f.cwd });
    assert.equal(report.valid, true); assert.equal(report.total, 4);
    assert.ok(report.commits.every(item => item.formedAfter));
    assert.equal(report.scope, 'entire-history');
    git(f.cwd, 'replace', main, root);
    const replaced = await verifyGitHistory({ cwd: f.cwd });
    assert.equal(replaced.total, 4); assert.equal(replaced.valid, true);
    git(f.cwd, 'replace', '-d', main);
    const outputs = await verifyHistory({ cwd: f.cwd });
    assert.equal(outputs.valid, 'true');
    assert.equal(JSON.parse(readFileSync(join(f.cwd, 'momento-proof/badge.json'), 'utf8')).message, '4/4 confirmed');
    const originalRef = git(f.cwd, 'rev-parse', PROOFS_REF);
    git(f.cwd, 'update-ref', PROOFS_REF, `${originalRef}~1`);
    assert.equal((await verifyGitHistory({ cwd: f.cwd })).valid, false);
    await verifyHistory({ cwd: f.cwd });
    assert.equal(JSON.parse(readFileSync(join(f.cwd, 'momento-proof/badge.json'), 'utf8')).color, 'orange');
    git(f.cwd, 'update-ref', PROOFS_REF, originalRef);
    git(f.cwd, ...f.noHooks, 'commit', '--amend', '--allow-empty', '-m', 'Rewritten with no links');
    await stampGitCommit({ cwd: f.cwd, fetchImpl: f.fetchImpl });
    const rewritten = await verifyGitHistory({ cwd: f.cwd });
    assert.equal(rewritten.valid, false);
    assert.match(rewritten.commits.at(-1)!.reason!, /receipt links/);
    await verifyHistory({ cwd: f.cwd });
    assert.equal(JSON.parse(readFileSync(join(f.cwd, 'momento-proof/badge.json'), 'utf8')).color, 'red');
    assert.equal((await verifyGitHistory({ cwd: f.cwd, startCommit: main })).scope, 'since-activation');
    assert.equal((await verifyGitHistory({ cwd: f.cwd, startCommit: root })).total, 4);
  } finally { f.cleanup(); }
});

test('activation timestamps existing HEAD without certifying its earlier history', async () => {
  const f = fixture();
  try {
    git(f.cwd, 'commit', '--allow-empty', '-m', 'Old root');
    git(f.cwd, 'commit', '--allow-empty', '-m', 'Old second');
    const baseline = git(f.cwd, 'rev-parse', 'HEAD');
    const installed = await installGitHooks({ cwd: f.cwd, entryPath: cli, fetchImpl: f.fetchImpl });
    assert.equal(installed.startCommit, baseline);
    await f.commit('After activation');
    assert.equal((await verifyGitHistory({ cwd: f.cwd })).valid, false);
    const report = await verifyGitHistory({ cwd: f.cwd, startCommit: baseline });
    assert.equal(report.valid, true); assert.equal(report.total, 2);
    assert.equal(report.commits[0].formedAfter, undefined);
    await verifyHistory({ cwd: f.cwd, startCommit: baseline });
    assert.match(JSON.parse(readFileSync(join(f.cwd, 'momento-proof/badge.json'), 'utf8')).message, /since activation/);
    await installGitHooks({ cwd: f.cwd, entryPath: cli, fetchImpl: async () => { throw new Error('offline'); } });
    assert.equal(git(f.cwd, 'config', '--get', 'momento.startCommit'), baseline);
    git(f.cwd, 'config', 'core.hooksPath', 'custom-hooks');
    await assert.rejects(installGitHooks({ cwd: f.cwd, entryPath: cli, fetchImpl: f.fetchImpl }), /Custom core.hooksPath/);
  } finally { f.cleanup(); }
});

test('real hooks preserve existing hooks/stdin, attest backdated commits, and push proofs to a bare remote', async () => {
  const f = fixture();
  const remote = mkdtempSync(join(tmpdir(), 'momento-remote-'));
  try {
    git(remote, 'init', '--bare');
    const hooks = join(f.cwd, '.git/hooks');
    writeFileSync(join(hooks, 'prepare-commit-msg'), '#!/bin/sh\nprintf "Original hook\\n" >> "$1"\n', { mode: 0o755 });
    writeFileSync(join(hooks, 'pre-push'), '#!/bin/sh\ncat > .git/original-push-input\n', { mode: 0o755 });
    await installGitHooks({ cwd: f.cwd, entryPath: cli, fetchImpl: f.fetchImpl });
    assert.ok(existsSync(join(hooks, 'prepare-commit-msg.momento-original')));
    const preload = join(f.cwd, 'mock-signing.mjs');
    const protocol = new URL('../packages/protocol/dist/index.js', import.meta.url).href;
    const noble = pathToFileURL(resolve('node_modules/@noble/post-quantum/ml-dsa.js')).href;
    writeFileSync(preload, `import { PUBLIC_KEYS, signingBytes } from ${JSON.stringify(protocol)};
import { ml_dsa65 } from ${JSON.stringify(noble)};
import { randomBytes } from 'node:crypto';
PUBLIC_KEYS[${JSON.stringify(f.keyId)}] = ${JSON.stringify(Buffer.from(f.publicKey).toString('base64url'))};
globalThis.fetch = async (url, options) => {
 const payload = {version:2, hash:JSON.parse(options.body).hash, issuedAt:'2026-10-03T12:30:00.000Z', receiptId:randomBytes(16).toString('base64url'), keyId:${JSON.stringify(f.keyId)}};
 return Response.json({payload,signature:Buffer.from(ml_dsa65.sign(signingBytes(payload),Buffer.from(${JSON.stringify(Buffer.from(f.secretKey).toString('base64'))},'base64'))).toString('base64url')},{status:201});
};`);
    const env = { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
      GIT_AUTHOR_DATE: '2001-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2001-01-01T00:00:00Z' };
    execFileSync('git', ['commit', '--allow-empty', '-m', 'Backdated metadata'], { cwd: f.cwd, env, stdio: 'pipe' });
    assert.match(git(f.cwd, 'show', '-s', '--format=%B'), /Original hook/);
    const report = await verifyGitHistory({ cwd: f.cwd });
    assert.equal(report.valid, true);
    assert.equal(report.commits[0].issuedAt, '2026-10-03T12:30:00.000Z');
    git(f.cwd, 'remote', 'add', 'origin', remote);
    execFileSync('git', ['push', 'origin', 'HEAD:main'], { cwd: f.cwd, env, stdio: 'pipe' });
    assert.match(readFileSync(join(f.cwd, '.git/original-push-input'), 'utf8'), /refs\/heads\/main/);
    assert.equal(git(remote, 'rev-parse', PROOFS_REF), git(f.cwd, 'rev-parse', PROOFS_REF));
    // A valid signature without the prior-receipt link cannot pass the push gate.
    git(f.cwd, ...f.noHooks, 'commit', '--allow-empty', '-m', 'Bypassed hook');
    await stampGitCommit({ cwd: f.cwd, fetchImpl: f.fetchImpl });
    assert.throws(() => execFileSync('git', ['push', 'origin', 'HEAD:main'], { cwd: f.cwd, env, stdio: 'pipe' }), /Push blocked/);
  } finally { f.cleanup(); rmSync(remote, { recursive: true, force: true }); }
});

test('history Action publishes a negative badge before failing, without requesting new timestamps', async () => {
  const f = fixture();
  const remote = mkdtempSync(join(tmpdir(), 'momento-action-remote-'));
  const previousCwd = process.cwd();
  const previousFetch = globalThis.fetch;
  const previousExitCode = process.exitCode;
  const previousError = console.error;
  const env = { INPUT_MODE: 'verify-history', 'INPUT_PUBLISH-BADGE': 'true', 'INPUT_GITHUB-TOKEN': 'test',
    'INPUT_TARGET-REF': 'HEAD', 'INPUT_PROOFS-REF': PROOFS_REF, 'INPUT_START-COMMIT': '',
    'INPUT_OUTPUT-DIRECTORY': 'momento-proof', GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'someone/project', GITHUB_REF: 'refs/heads/main',
    GITHUB_OUTPUT: join(f.cwd, 'outputs.txt'), GITHUB_STEP_SUMMARY: join(f.cwd, 'summary.md') };
  const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const blobs: any[] = [];
  try {
    git(f.cwd, 'commit', '--allow-empty', '-m', 'No proof');
    git(remote, 'init', '--bare'); git(f.cwd, 'remote', 'add', 'origin', remote);
    Object.assign(process.env, env); process.chdir(f.cwd);
    console.error = () => {};
    globalThis.fetch = async (url, options) => {
      assert.ok(String(url).startsWith('https://api.github.com/'), 'Verification must not call the signing API');
      if (String(url).endsWith('/ref/heads/momento-badges')) return new Response(null, { status: 404 });
      if (String(url).endsWith('/blobs')) blobs.push(JSON.parse(Buffer.from(JSON.parse(options!.body as string).content, 'base64').toString()));
      return Response.json({ sha: 'created' }, { status: 201 });
    };
    await runAction();
    assert.equal(process.exitCode, 1);
    assert.equal(blobs[0].valid, false); assert.equal(blobs[0].total, 1);
    assert.equal(blobs[1].color, 'orange'); assert.equal(blobs[1].message, '0/1 confirmed');
    assert.match(readFileSync(env.GITHUB_OUTPUT, 'utf8'), /valid=false/);
  } finally {
    process.chdir(previousCwd); globalThis.fetch = previousFetch; process.exitCode = previousExitCode; console.error = previousError;
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    f.cleanup(); rmSync(remote, { recursive: true, force: true });
  }
});

test('offline and untrusted signing responses create no proofs; shallow checkouts cannot claim full coverage', async () => {
  const f = fixture();
  try {
    git(f.cwd, 'commit', '--allow-empty', '-m', 'Fixture');
    await assert.rejects(stampGitCommit({ cwd: f.cwd, fetchImpl: async () => { throw new Error('offline'); } }), /offline/);
    await assert.rejects(stampGitCommit({ cwd: f.cwd, fetchImpl: async () => Response.json({ payload: {}, signature: '' }, { status: 201 }) }));
    assert.throws(() => git(f.cwd, 'rev-parse', '--verify', PROOFS_REF));
    writeFileSync(join(f.cwd, '.git/shallow'), git(f.cwd, 'rev-parse', 'HEAD') + '\n');
    await assert.rejects(verifyGitHistory({ cwd: f.cwd }), /Full Git history/);
  } finally { f.cleanup(); }
});

test('proof synchronization merges independent contributors without checking out the proof branch', async () => {
  const f = fixture();
  const remote = mkdtempSync(join(tmpdir(), 'momento-sync-remote-'));
  const clone = mkdtempSync(join(tmpdir(), 'momento-sync-clone-'));
  try {
    git(remote, 'init', '--bare'); git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    await installGitHooks({ cwd: f.cwd, entryPath: cli, fetchImpl: f.fetchImpl });
    await f.commit('Shared root');
    git(f.cwd, 'remote', 'add', 'origin', remote);
    git(f.cwd, ...f.noHooks, 'push', 'origin', 'HEAD:main', PROOFS_REF);
    execFileSync('git', ['clone', remote, clone], { stdio: 'pipe' });
    git(clone, 'config', 'user.name', 'Other'); git(clone, 'config', 'user.email', 'other@example.com');
    await syncGitProofs(clone);
    assert.equal(git(clone, 'rev-parse', PROOFS_REF), git(f.cwd, 'rev-parse', PROOFS_REF));
    await installGitHooks({ cwd: clone, entryPath: cli, fetchImpl: f.fetchImpl });
    assert.throws(() => git(clone, 'config', '--get', 'momento.startCommit'));
    const message = join(clone, 'message.txt'); writeFileSync(message, 'Independent work');
    await prepareGitMessage(clone, message);
    git(clone, '-c', `core.hooksPath=${join(clone, 'disabled')}`, 'commit', '--allow-empty', '-F', message);
    await stampGitCommit({ cwd: clone, fetchImpl: f.fetchImpl });
    const before = git(clone, 'rev-parse', 'HEAD');
    await f.commit('Other work');
    git(f.cwd, ...f.noHooks, 'push', 'origin', PROOFS_REF);
    await syncGitProofs(clone);
    assert.equal(git(clone, 'rev-parse', 'HEAD'), before);
    assert.equal(git(clone, 'ls-tree', '--name-only', PROOFS_REF).split('\n').length, 4);
    assert.equal((await verifyGitHistory({ cwd: clone })).valid, true);
    git(clone, '-c', `core.hooksPath=${join(clone, 'disabled')}`, 'push', 'origin', PROOFS_REF);
    assert.equal(git(remote, 'rev-parse', PROOFS_REF), git(clone, 'rev-parse', PROOFS_REF));
  } finally {
    f.cleanup(); rmSync(remote, { recursive: true, force: true }); rmSync(clone, { recursive: true, force: true });
  }
});
