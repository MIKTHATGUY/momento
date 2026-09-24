import assert from 'node:assert/strict';
import { test } from 'node:test';
import app, { openapiOptions } from '../apps/api/src/index.ts';
import { generateSpecs } from 'hono-openapi';

test('OpenAPI endpoint exposes the registered public routes with CORS and resolvable schemas', async () => {
  const response = await app.request('/api/openapi.json', {
    headers: { Origin: 'https://example.org' },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const spec = await response.json();
  assert.deepEqual(spec, JSON.parse(JSON.stringify(await generateSpecs(app, openapiOptions))));
  assert.equal(spec.openapi, '3.1.0');
  assert.deepEqual(Object.keys(spec.paths).sort(), [
    '/api/health', '/api/v1/keys', '/api/v1/stamp', '/api/v1/verify',
  ]);
  assert.ok(spec.paths['/api/v1/stamp'].post.responses['201']);
  assert.equal(spec.paths['/api/v1/verify'].post.requestBody.content['application/json'].schema.oneOf.length, 3);
  assert.equal(spec.paths['/api/v1/verify'].post.responses['200'].content['application/json'].schema.oneOf.length, 2);

  function checkReferences(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref') {
        assert.equal(typeof child, 'string');
        assert.ok(child.startsWith('#/'));
        const resolved = child.slice(2).split('/').reduce(
          (current: any, segment: string) => current?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')], spec,
        );
        assert.ok(resolved, `Unresolved schema reference: ${child}`);
      } else checkReferences(child);
    }
  }
  checkReferences(spec);
});
