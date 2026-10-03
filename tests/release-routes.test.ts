import assert from 'node:assert/strict';
import { test } from 'node:test';

test('JSON and Markdown release routes share cached GitHub data and override the default no-store header', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json([{ id: 1, name: 'Quantum-resistant signing', tag_name: 'v2.0.0', draft: false, prerelease: false,
      html_url: 'https://github.com/MIKTHATGUY/momento/releases/tag/v2.0.0', published_at: '2026-10-03T12:00:00Z',
      body: '**Discard all older Ed25519 keys.**' }]);
  };
  try {
    const { default: app } = await import('../apps/api/src/index.ts');
    const json = await app.request('/api/releases');
    assert.equal(json.status, 200);
    assert.equal(json.headers.get('cache-control'), 'public, max-age=300');
    assert.equal((await json.json()).releases[0].tag, 'v2.0.0');
    const markdown = await app.request('/api/releases/markdown');
    assert.equal(markdown.status, 200);
    assert.equal(markdown.headers.get('cache-control'), 'public, max-age=300');
    assert.match(markdown.headers.get('content-type')!, /^text\/markdown/);
    assert.match(await markdown.text(), /Discard all older Ed25519 keys/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
