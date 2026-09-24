import { createOpenAPI } from 'fumadocs-openapi/server';

export const openapi = createOpenAPI({
  input: { momento: './public/openapi.json' },
});

export async function getOpenAPIPageProps() {
  const { bundled } = await openapi.getSchema('momento');
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;
  const operations = Object.entries(bundled.paths ?? {}).flatMap(([path, item]) =>
    methods.filter((method) => item?.[method]).map((method) => ({ path, method })),
  );
  return { payload: { bundled }, operations, showTitle: true, showDescription: true };
}
