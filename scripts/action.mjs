import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyReceipt } from '../packages/protocol/src/index.ts';
import { verifyGitHistory, git, PROOFS_REF } from '../packages/cli/src/git.ts';

export async function verifyHistory({ cwd = process.cwd(), target = 'HEAD', proofsRef = PROOFS_REF,
  startCommit = '', outputDirectory = 'momento-proof' } = {}) {
  const report = await verifyGitHistory({ cwd, target, proofsRef, startCommit });
  const proofPath = resolve(cwd, outputDirectory);
  mkdirSync(proofPath, { recursive: true });
  const invalid = report.commits.some(item => !item.valid &&
    !item.reason?.startsWith('Missing receipt') && !item.reason?.startsWith('Unconfirmed parent'));
  const scope = report.startCommit ? ' since activation' : '';
  const badge = { schemaVersion: 1, label: 'Momento',
    message: `${report.confirmed}/${report.total} confirmed${scope}`,
    color: report.valid ? 'green' : invalid ? 'red' : 'orange', cacheSeconds: 300 };
  writeFileSync(resolve(proofPath, 'proof.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(resolve(proofPath, 'badge.json'), JSON.stringify(badge, null, 2) + '\n');
  return { commit: report.head, confirmed: String(report.confirmed), total: String(report.total),
    valid: String(report.valid), 'proof-path': proofPath, scope: report.scope };
}

export async function stampCommit({ cwd = process.cwd(), outputDirectory = 'momento-proof', fetchImpl = fetch } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  const commit = git('rev-parse', '--verify', 'HEAD^{commit}').toString().trim();
  const body = git('cat-file', 'commit', commit);
  const hash = createHash('sha256').update(body).digest('hex');
  const committedAt = new Date(git('show', '-s', '--format=%cI', commit).toString().trim()).toISOString();
  const response = await fetchImpl('https://momento.mthatguy.workers.dev/api/v2/stamp', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash }), signal: AbortSignal.timeout(30_000)
  });
  if (response.status !== 201) throw new Error(`Momento stamp failed: HTTP ${response.status}`);
  const receipt = await response.json();
  const verification = await verifyReceipt(receipt, hash);
  if (!verification.valid) throw new Error(`Momento receipt verification failed: ${verification.reasonCode}`);
  const proofPath = resolve(cwd, outputDirectory);
  mkdirSync(proofPath, { recursive: true });
  const proof = { version: 1, commit, committedAt, hash, hashFormat: 'sha256(git cat-file commit COMMIT)', receipt };
  const badge = { schemaVersion: 1, label: 'Momento', message: receipt.payload.issuedAt.replace('T', ' ').replace('Z', ' UTC'), color: 'green', cacheSeconds: 300 };
  writeFileSync(resolve(proofPath, 'commit.txt'), body);
  writeFileSync(resolve(proofPath, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  writeFileSync(resolve(proofPath, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(resolve(proofPath, 'badge.json'), JSON.stringify(badge, null, 2) + '\n');
  return { commit, 'committed-at': committedAt, 'issued-at': receipt.payload.issuedAt, hash, 'proof-path': proofPath };
}

export async function publishBadge({ proofPath, repository, token, fetchImpl = fetch,
  files = ['commit.txt', 'receipt.json', 'proof.json', 'badge.json'] }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')) throw new Error('A GitHub owner/repository is required');
  if (!token) throw new Error('Badge publishing requires github-token with contents: write');
  const branch = 'momento-badges';
  const request = async (path, method = 'GET', body, allowMissing = false) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/git/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000)
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub badge publication failed: HTTP ${response.status}. Check contents: write permission and branch rules.`);
    return response.json();
  };
  const previous = await request(`ref/heads/${branch}`, 'GET', undefined, true);
  const entries = await Promise.all(files.map(async path => {
    const blob = await request('blobs', 'POST', {
      content: readFileSync(resolve(proofPath, path)).toString('base64'), encoding: 'base64'
    });
    return { path, mode: '100644', type: 'blob', sha: blob.sha };
  }));
  const tree = await request('trees', 'POST', {
    tree: entries
  });
  const commit = await request('commits', 'POST', {
    message: 'Update Momento timestamp badge', tree: tree.sha,
    parents: previous ? [previous.object.sha] : []
  });
  if (previous) await request(`refs/heads/${branch}`, 'PATCH', { sha: commit.sha, force: false });
  else await request('refs', 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha });
  const endpoint = `https://raw.githubusercontent.com/${repository}/${branch}/badge.json`;
  const badgeUrl = `https://img.shields.io/endpoint?url=${encodeURIComponent(endpoint)}&cacheSeconds=300`;
  return {
    'badge-url': badgeUrl,
    'badge-markdown': `[![Momento timestamp](${badgeUrl})](https://github.com/${repository}/blob/${branch}/proof.json)`
  };
}

export async function runAction() {
  try {
    const mode = process.env.INPUT_MODE || 'stamp';
    if (!['stamp', 'verify-history'].includes(mode)) throw new Error('mode must be stamp or verify-history');
    const publish = process.env['INPUT_PUBLISH-BADGE'] || 'true';
    if (!['true', 'false'].includes(publish)) throw new Error('publish-badge must be true or false');
    if (publish === 'true' && process.env.GITHUB_REF === 'refs/heads/momento-badges') throw new Error('Exclude momento-badges from workflow triggers');
    if (publish === 'true' && process.env.GITHUB_SERVER_URL !== 'https://github.com') throw new Error('Automatic badge publishing currently supports github.com only');
    let outputs;
    if (mode === 'verify-history') {
      const target = process.env['INPUT_TARGET-REF'] || 'HEAD';
      const proofsRef = process.env['INPUT_PROOFS-REF'] || PROOFS_REF;
      if (proofsRef !== PROOFS_REF) throw new Error(`proofs-ref must be ${PROOFS_REF}`);
      // Fetch failure (including missing branch) becomes missing proofs in the report.
      // Never use stale local receipts after a failed fetch.
      try { git(process.cwd(), 'fetch', '--no-tags', 'origin', `${proofsRef}:refs/momento/ci-proofs`); }
      catch { git(process.cwd(), 'update-ref', '-d', 'refs/momento/ci-proofs'); }
      outputs = await verifyHistory({ target, proofsRef: 'refs/momento/ci-proofs',
        startCommit: process.env['INPUT_START-COMMIT'] || '',
        outputDirectory: process.env['INPUT_OUTPUT-DIRECTORY'] || 'momento-proof' });
    } else outputs = await stampCommit({ outputDirectory: process.env['INPUT_OUTPUT-DIRECTORY'] || 'momento-proof' });
    if (publish === 'true') Object.assign(outputs, await publishBadge({
      proofPath: outputs['proof-path'], repository: process.env.GITHUB_REPOSITORY,
      token: process.env['INPUT_GITHUB-TOKEN'],
      ...(mode === 'verify-history' ? { files: ['proof.json', 'badge.json'] } : {})
    }));
    if (process.env.GITHUB_OUTPUT) {
      for (const [key, value] of Object.entries(outputs)) {
        if (/[\r\n]/.test(value)) throw new Error('Action output contains a newline');
        appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
      }
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      (mode === 'verify-history'
        ? `### Momento history verification\n\nHEAD: \`${outputs.commit}\`\n\nConfirmed: ${outputs.confirmed}/${outputs.total}\n\nScope: ${outputs.scope}\n`
        : `### Momento timestamp\n\nCommit: \`${outputs.commit}\`\n\nGit committer time: ${outputs['committed-at']}\n\nMomento issued at: ${outputs['issued-at']}\n\nSHA-256: \`${outputs.hash}\`\n`) +
      (outputs['badge-markdown'] ? `\nCopy into your README:\n\n\`\`\`markdown\n${outputs['badge-markdown']}\n\`\`\`\n` : ''));
    if (outputs.valid === 'false') throw new Error(`History verification failed: ${outputs.confirmed}/${outputs.total} confirmed (badge updated)`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runAction();
