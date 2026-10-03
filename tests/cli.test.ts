import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('compiled CLI stamps, verifies offline, honors API override, and refuses overwrites', () => {
  const directory = mkdtempSync(join(tmpdir(), 'momento-cli-test-'));
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/protocol-v2.json', import.meta.url), 'utf8'));
  const cliUrl = new URL('../packages/cli/dist/index.js', import.meta.url).href;
  const protocolUrl = new URL('../packages/protocol/dist/index.js', import.meta.url).href;
  const file = join(directory, 'empty file.txt');
  writeFileSync(file, '');
  const run = (args: string[], expectedEndpoint?: string) => execFileSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    const { PUBLIC_KEYS } = await import(${JSON.stringify(protocolUrl)});
    const fixture = ${JSON.stringify(fixture)};
    PUBLIC_KEYS[fixture.receipt.payload.keyId] = fixture.publicKey;
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), ${JSON.stringify(expectedEndpoint)});
      assert.equal(JSON.parse(options.body).hash, fixture.receipt.payload.hash);
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json(fixture.receipt, {status:201});
    };
    delete process.env.MOMENTO_API_URL;
    process.argv = ['node', 'cli', ...${JSON.stringify(args)}];
    await import(${JSON.stringify(cliUrl)});
  `], { cwd: directory, encoding: 'utf8', stdio: 'pipe', timeout: 10000 });
  try {
    assert.match(run(['stamp', file], 'https://momento.mthatguy.workers.dev/api/v2/stamp'), /Receipt:/);
    const output = file + '.momento.json';
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), fixture.receipt);
    assert.match(run(['verify', output, file]), /Signature valid/);
    assert.throws(() => run(['stamp', file, '--api-url', 'https://example.org'], 'https://example.org/api/v2/stamp'));
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), fixture.receipt);
    writeFileSync(output, ' '.repeat(8193));
    assert.throws(() => run(['verify', output, file]), /8 KB/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
