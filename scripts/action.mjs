import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyReceipt } from '../packages/protocol/src/index.ts';

export async function stampCommit({ cwd = process.cwd(), outputDirectory = 'momento-proof', fetchImpl = fetch } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  const commit = git('rev-parse', '--verify', 'HEAD^{commit}').toString().trim();
  const body = git('cat-file', 'commit', commit);
  const hash = createHash('sha256').update(body).digest('hex');
  const committedAt = new Date(git('show', '-s', '--format=%cI', commit).toString().trim()).toISOString();
  const response = await fetchImpl('https://momento.mthatguy.workers.dev/api/v1/stamp', {
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
  const badge = { schemaVersion: 1, label: 'Momento', message: receipt.payload.issuedAt.replace('T', ' ').replace('Z', ' UTC'), color: 'blue' };
  writeFileSync(resolve(proofPath, 'commit.txt'), body);
  writeFileSync(resolve(proofPath, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
  writeFileSync(resolve(proofPath, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(resolve(proofPath, 'badge.json'), JSON.stringify(badge, null, 2) + '\n');
  return { commit, 'committed-at': committedAt, 'issued-at': receipt.payload.issuedAt, hash, 'proof-path': proofPath };
}

export async function publishBadge({ proofPath, repository, token, fetchImpl = fetch }) {
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
  const entries = await Promise.all(['commit.txt', 'receipt.json', 'proof.json', 'badge.json'].map(async path => {
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
  const badgeUrl = `https://img.shields.io/endpoint?url=${encodeURIComponent(endpoint)}`;
  return {
    'badge-url': badgeUrl,
    'badge-markdown': `[![Momento timestamp](${badgeUrl})](https://github.com/${repository}/blob/${branch}/proof.json)`
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const publish = process.env['INPUT_PUBLISH-BADGE'] || 'true';
    if (!['true', 'false'].includes(publish)) throw new Error('publish-badge must be true or false');
    if (publish === 'true' && process.env.GITHUB_REF === 'refs/heads/momento-badges') throw new Error('Exclude momento-badges from workflow triggers');
    if (publish === 'true' && process.env.GITHUB_SERVER_URL !== 'https://github.com') throw new Error('Automatic badge publishing currently supports github.com only');
    const outputs = await stampCommit({ outputDirectory: process.env['INPUT_OUTPUT-DIRECTORY'] || 'momento-proof' });
    if (publish === 'true') Object.assign(outputs, await publishBadge({
      proofPath: outputs['proof-path'], repository: process.env.GITHUB_REPOSITORY,
      token: process.env['INPUT_GITHUB-TOKEN']
    }));
    if (process.env.GITHUB_OUTPUT) {
      for (const [key, value] of Object.entries(outputs)) {
        if (/[\r\n]/.test(value)) throw new Error('Action output contains a newline');
        appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
      }
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### Momento timestamp\n\nCommit: \`${outputs.commit}\`\n\nGit committer time: ${outputs['committed-at']}\n\nMomento issued at: ${outputs['issued-at']}\n\nSHA-256: \`${outputs.hash}\`\n` +
      (outputs['badge-markdown'] ? `\nCopy into your README:\n\n\`\`\`markdown\n${outputs['badge-markdown']}\n\`\`\`\n` : ''));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
