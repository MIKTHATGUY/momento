import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReleaseLoader, releasesMarkdown } from '../apps/api/src/releases.ts';

import { TEST_RELEASES } from '../apps/api/src/test-releases.ts';

const fixture = {
  id: 2, name: 'Post-quantum signatures', tag_name: 'v2.0.0', draft: false, prerelease: false,
  html_url: 'https://github.com/MIKTHATGUY/momento/releases/tag/v2.0.0',
  published_at: '2026-10-03T12:00:00Z', body: '## Breaking changes\nDiscard all older Ed25519 keys.',
};

test('release feed filters drafts, orders publication dates, and caches concurrent requests for five minutes', async () => {
  let calls = 0;
  let now = 0;
  const loader = createReleaseLoader(async (url, options) => {
    calls++;
    assert.equal(String(url), 'https://api.github.com/repos/MIKTHATGUY/momento/releases?per_page=30');
    assert.equal(new Headers(options?.headers).get('Accept'), 'application/vnd.github+json');
    return Response.json([
      { ...fixture, id: 1, published_at: '2025-01-01T00:00:00Z', name: null, body: null },
      { ...fixture, id: 3, draft: true },
      fixture,
    ]);
  }, () => now);
  const [first, second] = await Promise.all([loader(), loader()]);
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
  assert.deepEqual(first.map(release => release.id), [2, 1]);
  assert.equal(first[0].body, fixture.body);
  assert.equal(first[1].name, 'v2.0.0');
  assert.ok(releasesMarkdown(first).includes(fixture.body));
  assert.ok(releasesMarkdown(first).includes(fixture.html_url));
  await loader(); assert.equal(calls, 1);
  now = 300_000;
  await loader(); assert.equal(calls, 2);
});

test('unavailable, malformed, and oversized GitHub responses fail without becoming an empty published feed', async () => {
  for (const response of [
    new Response(null, { status: 403 }),
    Response.json({ message: 'Not Found' }),
    Response.json([{ ...fixture, html_url: 'https://example.org/releases/tag/fake' }]),
    new Response('x'.repeat(1_048_577)),
  ]) {
    const loader = createReleaseLoader(async () => response);
    await assert.rejects(loader());
  }
  let calls = 0;
  const recoverable = createReleaseLoader(async () => ++calls === 1 ? new Response(null, { status: 503 }) : Response.json([]));
  await assert.rejects(recoverable());
  assert.deepEqual(await recoverable(), []);
  assert.equal(calls, 2);
  const preview = releasesMarkdown(TEST_RELEASES);
  assert.ok(preview.includes('Unpublished test release'));
  assert.ok(preview.includes('Discard all older Ed25519'));
  assert.equal(preview.includes('[View release on GitHub]'), false);
});
