import { mkdir, writeFile } from 'node:fs/promises';
import { generateSpecs } from 'hono-openapi';
import app, { openapiOptions } from '../apps/api/src/index.ts';

const output = new URL('../apps/web/public/', import.meta.url);
await mkdir(output, { recursive: true });
const schema = await generateSpecs(app, openapiOptions);
await writeFile(new URL('openapi.json', output), JSON.stringify(schema, null, 2) + '\n');
console.log('Generated OpenAPI schema from Hono routes.');
