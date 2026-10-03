import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { verifyReceipt, readReceiptResponse, parseReceipt, MAX_RECEIPT_BYTES, type StampReceipt } from '@mikthatguy/momento-protocol';

export const PROOFS_REF = 'refs/momento/proofs';
const DEFAULT_API = 'https://momento.mthatguy.workers.dev';
const gitEnvironment = () => ({ ...process.env, GIT_NO_REPLACE_OBJECTS: '1' });
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
// Hash a canonical tuple, not user-supplied JSON whitespace/property ordering.
export const receiptDigest = (receipt: StampReceipt) => digest(JSON.stringify([
  receipt.payload.version, receipt.payload.hash, receipt.payload.issuedAt,
  receipt.payload.receiptId, receipt.payload.keyId, receipt.signature
]));

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, env: gitEnvironment(), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function maybeGit(cwd: string, ...args: string[]) { try { return git(cwd, ...args); } catch { return ''; } }
function body(cwd: string, commit: string) {
  return execFileSync('git', ['cat-file', 'commit', commit], { cwd, env: gitEnvironment(), maxBuffer: 32 * 1024 * 1024 });
}
function parents(cwd: string, commit: string) {
  return body(cwd, commit).toString('utf8').split('\n\n')[0].split('\n')
    .filter(line => line.startsWith('parent ')).map(line => line.slice(7));
}
function readProof(cwd: string, ref: string, name: string): StampReceipt {
  let size: number;
  try { size = Number(git(cwd, 'cat-file', '-s', `${ref}:${name}.json`)); }
  catch { throw new Error(`Missing receipt for ${name}`); }
  if (size > MAX_RECEIPT_BYTES) throw new Error('Receipt exceeds 8 KB');
  const raw = execFileSync('git', ['show', `${ref}:${name}.json`], { cwd, env: gitEnvironment(), maxBuffer: MAX_RECEIPT_BYTES });
  if (raw.length > MAX_RECEIPT_BYTES) throw new Error('Receipt exceeds 8 KB');
  return parseReceipt(JSON.parse(raw.toString('utf8')));
}
async function checkedProof(cwd: string, ref: string, commit: string) {
  const receipt = readProof(cwd, ref, commit);
  const result = await verifyReceipt(receipt, digest(body(cwd, commit)));
  if (!result.valid) throw new Error(`Invalid receipt for ${commit}: ${result.reason}`);
  return receipt;
}

async function requestReceipt(hash: string, api: string, fetchImpl: typeof fetch) {
  const url = new URL('/api/v2/stamp', api);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('API URL must use HTTP or HTTPS');
  const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash }), signal: AbortSignal.timeout(30_000) });
  if (response.status !== 201) throw new Error(`Momento stamp failed: HTTP ${response.status}`);
  const receipt = await readReceiptResponse(response);
  const checked = await verifyReceipt(receipt, hash);
  if (!checked.valid) throw new Error(`Untrusted Momento receipt: ${checked.reason}`);
  return receipt;
}

export function storeProof(cwd: string, name: string, receipt: StampReceipt) {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64}|anchor-[0-9a-f]{64})$/.test(name)) throw new Error('Invalid proof name');
  const previous = maybeGit(cwd, 'rev-parse', '--verify', PROOFS_REF);
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd,
    input: JSON.stringify(receipt) + '\n', encoding: 'utf8' }).trim();
  const entries = previous ? git(cwd, 'ls-tree', `${previous}^{tree}`).split('\n').filter(Boolean) : [];
  const filename = `${name}.json`;
  const existing = entries.find(line => line.endsWith(`\t${filename}`));
  if (existing) {
    if (existing.split(/\s+/)[2] === blob) return;
    throw new Error(`Proof already exists for ${name}; refusing replacement`);
  }
  entries.push(`100644 blob ${blob}\t${filename}`);
  const tree = execFileSync('git', ['mktree'], { cwd, input: entries.sort().join('\n') + '\n', encoding: 'utf8' }).trim();
  const args = ['-c', 'user.name=Momento', '-c', 'user.email=momento@localhost', 'commit-tree', tree,
    ...(previous ? ['-p', previous] : []), '-m', `Record Momento proof ${name}`];
  const next = git(cwd, ...args);
  const zero = '0'.repeat(next.length);
  git(cwd, 'update-ref', PROOFS_REF, next, previous || zero);
}

export async function syncGitProofs(cwd: string, remote = 'origin') {
  const fetchedRef = 'refs/momento/fetched-proofs';
  git(cwd, 'fetch', '--no-tags', '--', remote, `+${PROOFS_REF}:${fetchedRef}`);
  const incoming = git(cwd, 'rev-parse', fetchedRef);
  const current = maybeGit(cwd, 'rev-parse', '--verify', PROOFS_REF);
  const entries = new Map<string, string>();
  for (const ref of [current, incoming].filter(Boolean)) {
    for (const line of git(cwd, 'ls-tree', `${ref}^{tree}`).split('\n').filter(Boolean)) {
      const [metadata, filename] = line.split('\t');
      if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64}|anchor-[0-9a-f]{64})\.json$/.test(filename) || !metadata.startsWith('100644 blob '))
        throw new Error('Unexpected entry in proof branch');
      const receipt = readProof(cwd, ref, filename.slice(0, -5));
      if (!(await verifyReceipt(receipt)).valid) throw new Error(`Untrusted proof ${filename}`);
      if (filename.startsWith('anchor-') && filename !== `anchor-${receiptDigest(receipt)}.json`)
        throw new Error(`Invalid anchor filename ${filename}`);
      const prior = entries.get(filename);
      if (prior && prior !== line) {
        const local = readProof(cwd, current, filename.slice(0, -5));
        if (receiptDigest(local) !== receiptDigest(receipt)) throw new Error(`Conflicting receipt ${filename}; refusing replacement`);
      } else entries.set(filename, line);
    }
  }
  if (!current) { git(cwd, 'update-ref', PROOFS_REF, incoming, '0'.repeat(incoming.length)); return; }
  if (current === incoming) return;
  try { git(cwd, 'merge-base', '--is-ancestor', incoming, current); return; } catch { /* divergent or incoming ahead */ }
  try { git(cwd, 'merge-base', '--is-ancestor', current, incoming); git(cwd, 'update-ref', PROOFS_REF, incoming, current); return; }
  catch { /* merge the union without checking out or running commit hooks */ }
  const tree = execFileSync('git', ['mktree'], { cwd, input: [...entries.values()].sort().join('\n') + '\n', encoding: 'utf8' }).trim();
  const next = git(cwd, '-c', 'user.name=Momento', '-c', 'user.email=momento@localhost',
    'commit-tree', tree, '-p', current, '-p', incoming, '-m', 'Synchronize Momento receipts');
  git(cwd, 'update-ref', PROOFS_REF, next, current);
}

export async function stampGitCommit({ cwd = process.cwd(), commit = 'HEAD', api = DEFAULT_API, fetchImpl = fetch } = {}) {
  const id = git(cwd, 'rev-parse', '--verify', '--end-of-options', `${commit}^{commit}`);
  if ((() => { try { readProof(cwd, PROOFS_REF, id); return true; } catch { return false; } })()) {
    return checkedProof(cwd, PROOFS_REF, id);
  }
  const receipt = await requestReceipt(digest(body(cwd, id)), api, fetchImpl);
  storeProof(cwd, id, receipt);
  return receipt;
}

export async function prepareGitMessage(cwd: string, messagePath: string) {
  const head = maybeGit(cwd, 'rev-parse', '--verify', 'HEAD');
  const mergeHeadPath = resolve(cwd, git(cwd, 'rev-parse', '--git-path', 'MERGE_HEAD'));
  const ids = head ? [head] : [];
  if (existsSync(mergeHeadPath)) ids.push(...readFileSync(mergeHeadPath, 'utf8').trim().split('\n'));
  const links: string[] = [];
  for (const id of ids) {
    const receipt = await checkedProof(cwd, PROOFS_REF, id);
    links.push(`Momento-Parent-Receipt: ${id} sha256:${receiptDigest(receipt)}`);
  }
  if (!ids.length) {
    const anchor = git(cwd, 'config', '--get', 'momento.anchor');
    const receipt = readProof(cwd, PROOFS_REF, `anchor-${anchor}`);
    if (!(await verifyReceipt(receipt)).valid || receiptDigest(receipt) !== anchor) throw new Error('Invalid start anchor');
    links.push(`Momento-Anchor-Receipt: sha256:${anchor}`);
  }
  const text = readFileSync(messagePath, 'utf8').split('\n')
    .filter(line => !/^Momento-(Parent|Anchor)-Receipt:/i.test(line)).join('\n').trimEnd();
  writeFileSync(messagePath, `${text}\n\n${links.join('\n')}\n`);
}

export interface HistoryReport {
  version: number; head: string; startCommit: string | null; scope: string;
  checkedAt: string; total: number; confirmed: number; valid: boolean;
  commits: { commit: string; valid: boolean; issuedAt?: string; formedAfter?: string; reason?: string }[];
}
export async function verifyGitHistory({ cwd = process.cwd(), target = 'HEAD', proofsRef = PROOFS_REF, startCommit = '' } = {}): Promise<HistoryReport> {
  if (maybeGit(cwd, 'rev-parse', '--is-shallow-repository') === 'true') throw new Error('Full Git history required (fetch-depth: 0)');
  const head = git(cwd, 'rev-parse', '--verify', '--end-of-options', `${target}^{commit}`);
  const start = startCommit ? git(cwd, 'rev-parse', '--verify', '--end-of-options', `${startCommit}^{commit}`) : '';
  if (start) git(cwd, 'merge-base', '--is-ancestor', start, head);
  // Include merged side branches, including those forked before the activation boundary.
  const descendants = git(cwd, 'rev-list', '--reverse', '--topo-order', head, ...(start ? [`^${start}`] : [])).split('\n').filter(Boolean);
  const ids = start ? [start, ...descendants] : descendants;
  const results: HistoryReport['commits'] = [];
  const status = new Map<string, boolean>();
  for (const id of ids) {
    try {
      const receipt = await checkedProof(cwd, proofsRef, id);
      let formedAfter: string | undefined;
      if (id !== start) {
        const ps = parents(cwd, id);
        const message = body(cwd, id).toString('utf8').split('\n\n').slice(1).join('\n\n');
        const actual = message.split('\n').filter(line => /^Momento-(Parent|Anchor)-Receipt:/i.test(line));
        const expected: string[] = [];
        const times: string[] = [];
        for (const parent of ps) {
          if (status.get(parent) === false) throw new Error(`Unconfirmed parent ${parent}`);
          const prior = await checkedProof(cwd, proofsRef, parent);
          expected.push(`Momento-Parent-Receipt: ${parent} sha256:${receiptDigest(prior)}`);
          times.push(prior.payload.issuedAt);
        }
        if (!ps.length) {
          if (actual.length !== 1 || !/^Momento-Anchor-Receipt: sha256:[0-9a-f]{64}$/.test(actual[0])) throw new Error('Missing start anchor');
          const hash = actual[0].split('sha256:')[1];
          const anchor = readProof(cwd, proofsRef, `anchor-${hash}`);
          if (!(await verifyReceipt(anchor)).valid || receiptDigest(anchor) !== hash) throw new Error('Invalid start anchor');
          expected.push(actual[0]); times.push(anchor.payload.issuedAt);
        }
        if (JSON.stringify(actual.sort()) !== JSON.stringify(expected.sort())) throw new Error('Missing or incorrect parent receipt links');
        formedAfter = times.sort().at(-1);
        if (times.some(time => Date.parse(time) > Date.parse(receipt.payload.issuedAt))) throw new Error('Receipt time precedes parent/anchor');
      }
      results.push({ commit: id, valid: true, issuedAt: receipt.payload.issuedAt, ...(formedAfter ? { formedAfter } : {}) });
      status.set(id, true);
    } catch (error) {
      results.push({ commit: id, valid: false, reason: error instanceof Error ? error.message : 'Invalid proof' });
      status.set(id, false);
    }
  }
  const confirmed = results.filter(result => result.valid).length;
  return { version: 1, head, startCommit: start || null, scope: start ? 'since-activation' : 'entire-history',
    checkedAt: new Date().toISOString(), total: ids.length, confirmed, valid: confirmed === ids.length, commits: results };
}

const shellQuote = (text: string) => "'" + text.replaceAll("'", "'\\''") + "'";
export async function installGitHooks({ cwd = process.cwd(), entryPath, api = DEFAULT_API, fetchImpl = fetch }: {
  cwd?: string; entryPath: string; api?: string; fetchImpl?: typeof fetch;
}) {
  git(cwd, 'rev-parse', '--git-dir');
  if (entryPath.endsWith('.ts')) entryPath = resolve(dirname(entryPath), '../dist/index.js');
  if (!existsSync(entryPath)) throw new Error('Build the CLI before installing hooks (bun run build:packages)');
  if (maybeGit(cwd, 'config', '--get', 'core.hooksPath'))
    throw new Error('Custom core.hooksPath detected. Install in a repository using its default hooks directory to avoid changing shared hooks.');
  const hooks = resolve(cwd, git(cwd, 'rev-parse', '--git-path', 'hooks'));
  mkdirSync(hooks, { recursive: true });
  const names = ['prepare-commit-msg', 'post-commit', 'pre-push'];
  for (const name of names) {
    const path = resolve(hooks, name);
    if (existsSync(path) && !readFileSync(path, 'utf8').includes('# Momento managed hook') && existsSync(`${path}.momento-original`))
      throw new Error(`Existing hook backup: ${path}.momento-original; resolve before installing`);
  }
  const head = maybeGit(cwd, 'rev-parse', '--verify', 'HEAD');
  if (head) {
    await stampGitCommit({ cwd, api, fetchImpl });
    const complete = await verifyGitHistory({ cwd });
    if (!complete.valid && !maybeGit(cwd, 'config', '--get', 'momento.startCommit')) git(cwd, 'config', 'momento.startCommit', head);
  } else if (!maybeGit(cwd, 'config', '--get', 'momento.anchor')) {
    const receipt = await requestReceipt(digest(randomBytes(32)), api, fetchImpl);
    const anchor = receiptDigest(receipt);
    storeProof(cwd, `anchor-${anchor}`, receipt);
    git(cwd, 'config', 'momento.anchor', anchor);
  }
  git(cwd, 'config', 'momento.apiUrl', api);
  const emptyHooks = resolve(cwd, git(cwd, 'rev-parse', '--git-path', 'momento-empty-hooks'));
  mkdirSync(emptyHooks, { recursive: true });
  for (const name of names) {
    const path = resolve(hooks, name);
    if (existsSync(path) && !readFileSync(path, 'utf8').includes('# Momento managed hook')) renameSync(path, `${path}.momento-original`);
    const original = `${path}.momento-original`;
    const call = `${shellQuote(process.execPath)} ${shellQuote(entryPath)} git hook ${name} "$@"`;
    const script = name === 'pre-push'
      ? `input=$(mktemp) || exit 1\ntrap 'rm -f "$input"' EXIT HUP INT TERM\ncat > "$input"\nif test -x ${shellQuote(original)}; then\n  ${shellQuote(original)} "$@" < "$input" || exit $?\nfi\n${call} < "$input"\n`
      : `if test -x ${shellQuote(original)}; then\n  ${shellQuote(original)} "$@" || exit $?\nfi\nexec ${call}\n`;
    writeFileSync(path, `#!/bin/sh\n# Momento managed hook\n${script}`);
    chmodSync(path, 0o755);
  }
  return { startCommit: maybeGit(cwd, 'config', '--get', 'momento.startCommit') || null };
}

export async function runGitCommand(args: string[], cwd: string, entryPath: string) {
  const [command, ...rest] = args;
  const api = process.env.MOMENTO_API_URL || maybeGit(cwd, 'config', '--get', 'momento.apiUrl') || DEFAULT_API;
  if (command === 'init' && !rest.length) {
    const result = await installGitHooks({ cwd, entryPath, api });
    console.log(`Momento Git hooks installed. ${result.startCommit ? `Activation commit: ${result.startCommit} (not a retroactive formation date).` : 'Entire-history mode.'}`);
  } else if (command === 'stamp' && rest.length <= 1) {
    const receipt = await stampGitCommit({ cwd, commit: rest[0] || 'HEAD', api });
    console.log(`Attested at: ${receipt.payload.issuedAt}. An existing commit is only timestamped now.`);
  } else if (command === 'sync' && rest.length <= 1) {
    await syncGitProofs(cwd, rest[0] || 'origin');
    console.log('Momento receipts synchronized without changing the working tree.');
  } else if (command === 'verify' && (rest.length === 0 || (rest.length === 2 && rest[0] === '--start-commit'))) {
    const startCommit = rest[1] || maybeGit(cwd, 'config', '--get', 'momento.startCommit');
    const report = await verifyGitHistory({ cwd, startCommit });
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) process.exitCode = 1;
  } else if (command === 'hook' && rest[0] === 'prepare-commit-msg' && rest[1]) {
    await prepareGitMessage(cwd, rest[1]);
  } else if (command === 'hook' && rest[0] === 'post-commit') {
    try {
      const receipt = await stampGitCommit({ cwd, api });
      console.log(`Momento attested at ${receipt.payload.issuedAt}`);
    } catch (error) {
      throw new Error(`Commit exists but is NOT attested. Retry with momento-timestamp git stamp. ${error instanceof Error ? error.message : error}`);
    }
  } else if (command === 'hook' && rest[0] === 'pre-push' && rest[1]) {
    // Validate the actual pushed tips (not HEAD); skip proof/badge maintenance refs.
    const input = readFileSync(0, 'utf8').trim();
    const startCommit = maybeGit(cwd, 'config', '--get', 'momento.startCommit');
    for (const line of input.split('\n').filter(Boolean)) {
      const [localRef, id, remoteRef] = line.split(/\s+/);
      if (/^0+$/.test(id) || [PROOFS_REF, 'refs/heads/momento-badges'].includes(localRef) ||
          [PROOFS_REF, 'refs/heads/momento-badges'].includes(remoteRef)) continue;
      const report = await verifyGitHistory({ cwd, target: id, startCommit });
      if (!report.valid) throw new Error(`Push blocked: ${report.confirmed}/${report.total} commits confirmed. Run momento-timestamp git verify.`);
    }
    const emptyHooks = resolve(cwd, git(cwd, 'rev-parse', '--git-path', 'momento-empty-hooks'));
    git(cwd, '-c', `core.hooksPath=${emptyHooks}`, 'push', '--', rest[2] || rest[1], `${PROOFS_REF}:${PROOFS_REF}`);
  } else throw new Error('Usage: momento-timestamp git init | stamp [commit] | sync [remote] | verify [--start-commit SHA]');
}
