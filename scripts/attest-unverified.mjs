#!/usr/bin/env node
// Attest server-side commits (Dependabot, web UI, merge buttons) that bypassed
// the local Git hooks. Rewrites messages with correct Momento-Parent-Receipt
// links, stamps via the public Momento API, stores proofs in refs/momento/proofs,
// and pushes the branch + proofs.
//
// Zero dependencies: node stdlib + git CLI. Runs on ubuntu-latest with setup-node.
//
//   node scripts/attest-unverified.mjs --update-branch <name> [--no-rebase] [--dry-run]
//
// --update-branch <name>  Same-repo branch to fix (e.g. dependabot/bun/foo or main).
// --no-rebase             Do not rebase onto origin/main first (used for main repair:
//                         only HEAD is checked/amended, history is left alone).
// --dry-run               Print the plan, change nothing (no stamp, no push).
//
// Exit codes: 0 ok (or already attested), 1 error, 3 needs a human
// (rebase conflict / merge commit in range / unconfirmed parent),
// 4 lease conflict (branch moved concurrently; retry on the next event).
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROOFS_REF = 'refs/momento/proofs';
const API = process.env.MOMENTO_API_URL || 'https://momento.mthatguy.workers.dev';
const GIT_ENV = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0' };

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Canonical tuple digest; must match receiptDigest() in packages/cli/src/git.ts.
const receiptDigest = (r) => sha256(JSON.stringify([
  r.payload.version, r.payload.hash, r.payload.issuedAt,
  r.payload.receiptId, r.payload.keyId, r.signature,
]));

function git(args, { input, encoding = 'utf8' } = {}) {
  return execFileSync('git', args, {
    env: GIT_ENV, input, encoding, maxBuffer: 32 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
function gitBytes(args) {
  return execFileSync('git', args, { env: GIT_ENV, maxBuffer: 32 * 1024 * 1024 });
}
function maybeGit(args) { try { return git(args); } catch { return ''; } }
const die = (code, msg) => { console.error(msg); process.exit(code); };

function fetchRef(remoteRef, localRef) {
  git(['fetch', '--no-tags', 'origin', `+${remoteRef}:${localRef}`]);
}
function readProof(ref, name) {
  let size;
  try { size = Number(git(['cat-file', '-s', `${ref}:${name}.json`])); }
  catch { throw new Error(`Missing receipt for ${name}`); }
  if (!Number.isFinite(size) || size > 8192) throw new Error(`Bad receipt size for ${name}`);
  const raw = gitBytes(['show', `${ref}:${name}.json`]);
  if (raw.length > 8192) throw new Error(`Receipt exceeds 8 KB for ${name}`);
  return JSON.parse(raw.toString('utf8'));
}
function commitBytes(commit) { return gitBytes(['cat-file', 'commit', commit]); }
function parentsOf(commit) {
  const out = git(['rev-list', '--parents', '-n', '1', commit]);
  return out.split(' ').slice(1).filter(Boolean);
}
function messageOf(commit) { return git(['log', '-1', '--format=%B', commit]); }
function cleanMessage(raw) {
  return raw.split('\n').filter((l) => !/^Momento-(Parent|Anchor)-Receipt:/i.test(l)).join('\n').trimEnd();
}
function expectedLinks(parents, proofsRef) {
  return parents.map((p) => `Momento-Parent-Receipt: ${p} sha256:${receiptDigest(readProof(proofsRef, p))}`);
}
function actualLinks(commit) {
  return messageOf(commit).split('\n').filter((l) => /^Momento-(Parent|Anchor)-Receipt:/i.test(l));
}
function headAttested(commit, proofsRef) {
  const parents = parentsOf(commit);
  let expected;
  try { expected = expectedLinks(parents, proofsRef); }
  catch { return { ok: false, reason: `unconfirmed parent of ${commit.slice(0, 7)}` }; }
  const same = JSON.stringify([...actualLinks(commit)].sort()) === JSON.stringify([...expected].sort());
  if (!same) return { ok: false, reason: 'message lacks correct parent receipt links' };
  try {
    const receipt = readProof(proofsRef, commit);
    if (receipt?.payload?.hash !== sha256(commitBytes(commit)))
      return { ok: false, reason: 'stored receipt does not match commit bytes' };
  } catch { return { ok: false, reason: `missing receipt for ${commit.slice(0, 7)}` }; }
  return { ok: true, expected };
}

async function stampCommit(commit) {
  const hash = sha256(commitBytes(commit));
  const response = await fetch(new URL('/api/v2/stamp', API), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash }), signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 201) throw new Error(`Momento stamp failed: HTTP ${response.status}`);
  const receipt = await response.json();
  if (receipt?.payload?.hash !== hash) throw new Error('Stamped receipt does not match commit hash');
  return receipt;
}

function storeProof(name, receipt) {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(name)) throw new Error(`Invalid proof name ${name}`);
  const previous = maybeGit(['rev-parse', '--verify', PROOFS_REF]);
  const blob = git(['hash-object', '-w', '--stdin'], { input: `${JSON.stringify(receipt)}\n` });
  const entries = previous ? git(['ls-tree', `${previous}^{tree}`]).split('\n').filter(Boolean) : [];
  const filename = `${name}.json`;
  const existing = entries.find((line) => line.endsWith(`\t${filename}`));
  if (existing) {
    if (existing.split(/\s+/)[2] === blob) return previous;
    throw new Error(`Proof already exists for ${name}; refusing replacement`);
  }
  entries.push(`100644 blob ${blob}\t${filename}`);
  const tree = git(['mktree'], { input: `${[...entries].sort().join('\n')}\n` });
  const next = git(['-c', 'user.name=Momento', '-c', 'user.email=momento@localhost',
    'commit-tree', tree, ...(previous ? ['-p', previous] : []), '-m', `Record Momento proof ${name}`]);
  git(['update-ref', PROOFS_REF, next, previous || '0'.repeat(next.length)]);
  return next;
}

// Merge remotely-advanced proofs (union of filenames; conflicting receipts rejected).
function mergeRemoteProofs() {
  const fetched = 'refs/momento/fetched-proofs';
  fetchRef(PROOFS_REF, fetched);
  const current = maybeGit(['rev-parse', '--verify', PROOFS_REF]);
  const incoming = git(['rev-parse', fetched]);
  if (current === incoming) return;
  try { git(['merge-base', '--is-ancestor', incoming, current]); return; } catch { /* incoming not behind */ }
  try { git(['merge-base', '--is-ancestor', current, incoming]); git(['update-ref', PROOFS_REF, incoming, current]); return; }
  catch { /* union merge below */ }
  const lines = new Map();
  for (const ref of [current, incoming].filter(Boolean)) {
    for (const line of git(['ls-tree', `${ref}^{tree}`]).split('\n').filter(Boolean)) {
      const tab = line.indexOf('\t');
      const filename = line.slice(tab + 1);
      if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})\.json$/.test(filename)) throw new Error('Unexpected entry in proofs');
      const prior = lines.get(filename);
      if (prior && prior !== line) {
        const a = receiptDigest(readProof(current, filename.slice(0, -5)));
        const b = receiptDigest(readProof(incoming, filename.slice(0, -5)));
        if (a !== b) throw new Error(`Conflicting receipt ${filename}; needs a human`);
      } else lines.set(filename, line);
    }
  }
  const tree = git(['mktree'], { input: `${[...lines.values()].sort().join('\n')}\n` });
  const next = git(['-c', 'user.name=Momento', '-c', 'user.email=momento@localhost',
    'commit-tree', tree, '-p', current, '-p', incoming, '-m', 'Synchronize Momento receipts']);
  git(['update-ref', PROOFS_REF, next, current]);
  git(['update-ref', '-d', fetched]);
}

function pushProofs() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { git(['push', 'origin', `${PROOFS_REF}:${PROOFS_REF}`]); return; }
    catch {
      if (attempt === 3) throw new Error('Proof push rejected after 3 attempts');
      mergeRemoteProofs();
    }
  }
}

function commitWithMessage(message) {
  const dir = mkdtempSync(join(tmpdir(), 'momento-msg-'));
  try {
    const path = join(dir, 'message');
    writeFileSync(path, message);
    git(['commit', '-F', path]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function main() {
  const args = process.argv.slice(2);
  const branch = args[args.indexOf('--update-branch') + 1];
  const noRebase = args.includes('--no-rebase');
  const dryRun = args.includes('--dry-run');
  if (!branch || branch.startsWith('--')) die(1, 'Usage: attest-unverified.mjs --update-branch <name> [--no-rebase] [--dry-run]');

  git(['fetch', '--no-tags', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
  try { fetchRef(PROOFS_REF, PROOFS_REF); } catch { /* keep local (repair runners fetch it) */ }
  if (!maybeGit(['rev-parse', '--verify', PROOFS_REF])) die(1, `No ${PROOFS_REF} found; cannot prove parents`);
  const base = git(['rev-parse', 'refs/remotes/origin/main']);
  const oldTip = git(['rev-parse', `refs/remotes/origin/${branch}`]);
  console.log(`Base: ${base.slice(0, 7)}  Branch ${branch}: ${oldTip.slice(0, 7)}`);

  if (dryRun) {
    const olds = git(['rev-list', '--reverse', `${base}..${oldTip}`]).split('\n').filter(Boolean);
    console.log(`Would rebase: ${!noRebase && olds.length > 0}`);
    const check = olds.length ? olds : [oldTip];
    for (const c of check) {
      const st = headAttested(c, PROOFS_REF);
      console.log(`${c.slice(0, 7)} attested=${st.ok}${st.ok ? '' : ` (${st.reason})`}`);
    }
    console.log(`Would stamp+push: ${check.some((c) => !headAttested(c, PROOFS_REF).ok)}`);
    return;
  }

  git(['checkout', '-B', 'momento-attest-work', oldTip]);
  if (!noRebase && branch !== 'main') {
    try { git(['rebase', base]); }
    catch { try { git(['rebase', '--abort']); } catch { /* ignore */ } die(3, 'Rebase onto latest main conflicted; needs a human'); }
  }
  let olds = git(['rev-list', '--reverse', `${base}..HEAD`]).split('\n').filter(Boolean);

  if (olds.length === 0) {
    // Single HEAD repair (main fast path, or already-rebased branch with nothing new).
    const head = git(['rev-parse', 'HEAD']);
    const st = headAttested(head, PROOFS_REF);
    if (st.ok) { console.log(`HEAD ${head.slice(0, 7)} already attested; nothing to do`); return; }
    console.log(`Repairing HEAD: ${st.reason}`);
    if (parentsOf(head).length > 1 && st.reason.includes('unconfirmed parent'))
      die(3, 'Merge commit has an unconfirmed parent; attest the PR branch first, then merge again');
    const cleaned = cleanMessage(messageOf(head)) || '(attest server-side commit)';
    const links = expectedLinks(parentsOf(head), PROOFS_REF); // throws on unconfirmed parent -> exit 3
    commitWithMessage(`${cleaned}\n\n${links.join('\n')}\n`);
    const amended = git(['rev-parse', 'HEAD']);
    const receipt = await stampCommit(amended);
    storeProof(amended, receipt);
    console.log(`Stamped ${amended.slice(0, 7)} at ${receipt.payload.issuedAt}`);
  } else {
    // Rewrite each commit onto the attested base with correct links.
    // Commits that are already correctly linked AND proven are reused as-is,
    // so a re-run after our own push is a no-op (no attestation loop).
    for (const o of olds) {
      if (parentsOf(o).length > 1) die(3, `Cannot auto-attest merge commit ${o.slice(0, 7)}; squash it locally instead`);
    }
    git(['reset', '--hard', base]);
    let wantParent = base;
    let reused = 0;
    for (const o of olds) {
      if (JSON.stringify(parentsOf(o)) === JSON.stringify([wantParent]) && headAttested(o, PROOFS_REF).ok) {
        wantParent = o;
        reused++;
        continue;
      }
      break;
    }
    if (reused === olds.length) {
      git(['reset', '--hard', olds[olds.length - 1]]);
      console.log('Branch already attested; nothing to do');
      return;
    }
    // Reuse the attested prefix, rewrite the rest in order.
    git(['reset', '--hard', wantParent]);
    for (const o of olds.slice(reused)) {
      const author = git(['log', '-1', '--format=%an%x00%ae%x00%aI', o]).split('\x00');
      git(['cherry-pick', '-n', o]);
      let empty = false;
      try { git(['diff', '--cached', '--quiet']); empty = true; } catch { empty = false; }
      if (empty) { try { git(['cherry-pick', '--quit']); } catch { /* ignore */ } console.log(`Skipped empty ${o.slice(0, 7)} (already applied)`); continue; }
      await new Promise((r) => setTimeout(r, 1000));
      const current = git(['rev-parse', 'HEAD']);
      const links = expectedLinks([current], PROOFS_REF);
      const cleaned = cleanMessage(messageOf(o)) || '(attest server-side commit)';
      const dir = mkdtempSync(join(tmpdir(), 'momento-msg-'));
      try {
        const path = join(dir, 'message');
        writeFileSync(path, `${cleaned}\n\n${links.join('\n')}\n`);
        execFileSync('git', ['commit', `--author=${author[0]} <${author[1]}>`, `--date=${author[2]}`, '-F', path],
          { env: { ...GIT_ENV, GIT_COMMITTER_NAME: 'github-actions[bot]', GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com' } });
      } finally { rmSync(dir, { recursive: true, force: true }); }
      try { git(['cherry-pick', '--quit']); } catch { /* ignore */ }
      const fresh = git(['rev-parse', 'HEAD']);
      const receipt = await stampCommit(fresh);
      storeProof(fresh, receipt);
      console.log(`Attested ${o.slice(0, 7)} as ${fresh.slice(0, 7)} at ${receipt.payload.issuedAt}`);
    }
    olds = git(['rev-list', '--reverse', `${base}..HEAD`]).split('\n').filter(Boolean);
    if (!olds.length) die(3, 'Rebase produced no commits; nothing to attest');
  }

  pushProofs();
  try { git(['push', `--force-with-lease=${branch}:${oldTip}`, 'origin', `HEAD:${branch}`]); }
  catch { die(4, `Branch ${branch} moved concurrently; retry on the next event`); }
  console.log(`Pushed ${branch} + proofs`);
}

main().catch((e) => die(e?.message?.includes('Missing receipt') || e?.message?.includes('unconfirmed') ? 3 : 1, e?.stack || String(e)));
