// Run with Bun 1.3.13+ (or Node.js 22.18+) after building the packages in this checkout.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { verifyReceipt, readReceiptResponse } from '@mikthatguy/momento-protocol';

const file = process.argv[2];
if (!file) throw new Error('Usage: bun examples/stamp-and-verify.mjs <file>');
const hash = createHash('sha256').update(await readFile(file)).digest('hex');
const response = await fetch('https://momento.mthatguy.workers.dev/api/v2/stamp', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hash }), signal: AbortSignal.timeout(30_000),
});
if (response.status !== 201) throw new Error('Stamp failed: HTTP ' + response.status);
const receipt = await readReceiptResponse(response);
const checked = await verifyReceipt(receipt, hash);
if (!checked.valid) throw new Error(checked.reason);
await writeFile(file + '.momento.json', JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log('Verified timestamp:', receipt.payload.issuedAt);
