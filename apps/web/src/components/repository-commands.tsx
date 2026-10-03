'use client';

import { useState } from 'react';

export default function RepositoryCommands() {
  const [repository, setRepository] = useState('');
  const [start, setStart] = useState('');
  const [installation, setInstallation] = useState('checkout');
  const [copied, setCopied] = useState(false);
  let url = '';
  try {
    const candidate = repository.trim();
    const parsed = new URL(candidate.includes('://') ? candidate : `https://github.com/${candidate}`);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash || !/^[a-z0-9.-]+$/i.test(parsed.hostname) || !/^\/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)+\/?$/i.test(parsed.pathname)) throw Error();
    url = parsed.href.replace(/\/$/, '');
  } catch { /* Keep commands unavailable until the URL is valid. */ }
  const boundary = start.trim();
  const valid = Boolean(url) && (!boundary || /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i.test(boundary));
  const setup = installation === 'registry'
    ? 'bun install --global @mikthatguy/momento-timestamp@2.0.0\n'
    : 'git clone https://github.com/MIKTHATGUY/momento.git momento-cli-source\ncd momento-cli-source\nbun install --frozen-lockfile\nbun run build:packages\ncd ..\n';
  const cli = installation === 'registry' ? 'momento-timestamp' : 'bun ../momento-cli-source/packages/cli/dist/index.js';
  const commands = valid ? `${setup}\ngit clone '${url}' momento-repo-check\ncd momento-repo-check\n${cli} git sync origin\n${cli} git verify${boundary ? ` --start-commit ${boundary}` : ''}` : '';
  return <div className="flex flex-col gap-4">
    <label className="flex flex-col gap-2">Repository URL<input className="rounded-lg border bg-transparent p-3" value={repository} onChange={e => { setRepository(e.target.value); setCopied(false); }} placeholder="https://github.com/owner/repository or owner/repository" /></label>
    <label className="flex flex-col gap-2">Activation commit (optional)<input className="rounded-lg border bg-transparent p-3" value={start} onChange={e => { setStart(e.target.value); setCopied(false); }} placeholder="Full SHA agreed by the repository maintainers" /></label>
<label className="flex flex-col gap-2">Install the tool<select className="rounded-lg border bg-background p-3" value={installation} onChange={e => setInstallation(e.target.value)}><option value="checkout">Build from source (available now)</option><option value="registry">Bun package (after 2.0.0 publication)</option></select></label>
    <p className="text-sm text-muted-foreground">Use a new working directory. Requires Git and Bun 1.3.13+. The compiled CLI also runs under Node.js 22.18+. Private repositories use your local Git authentication. Without an activation SHA, every reachable commit must pass, including the root.</p>
    {repository && !valid && <p role="alert">Enter an HTTPS Git repository URL and, if supplied, a full commit SHA.</p>}
    {commands && <><pre className="overflow-x-auto rounded-lg border p-4 text-sm"><code>{commands}</code></pre><button className="self-start rounded-lg border px-4 py-2" onClick={async () => { try { await navigator.clipboard.writeText(commands); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy commands'}</button></>}
    <p className="text-sm text-muted-foreground">Commands check the remote’s default branch. Verification prints a JSON coverage report and exits with an error if any commit in scope fails. Missing proofs are failures; this tool does not create receipts or certify Git author dates. Nothing is sent to Momento by this page.</p>
  </div>;
}
