# Momento

An open-source timestamp authority for SHA-256 hashes. Send a hash to Momento; its Cloudflare Worker reads its own clock and returns a signed receipt. The original file never leaves your device.

The website can hash a file locally, accept a hash you already calculated, verify a receipt against a file or hash, or inspect a receipt without the original file. The same public API can be called from a browser, a backend, a CLI or an automation. No account or API key is required.

> A Momento receipt is a signed claim by Momento about its server time. It proves neither when a file was created nor that the operator could not backdate a receipt. Verify the signature and the file hash before relying on one.

## API reference

Use the origin of your deployed Momento site as the base URL. The API accepts and returns JSON. Cross-origin browser requests are allowed (`Access-Control-Allow-Origin: *`).

### Create a timestamp

`POST /api/v1/stamp` with `Content-Type: application/json`:

```json
{ "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }
```

The body must contain **only** `hash`, a 64-character lowercase hexadecimal SHA-256 digest. The client cannot supply the time. A successful request returns HTTP `201` and a receipt:

```json
{
  "payload": {
    "version": 1,
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "issuedAt": "2026-09-24T12:34:56.789Z",
    "receiptId": "<base64url-encoded 16 random bytes>",
    "keyId": "momento-v1"
  },
  "signature": "<base64url-encoded Ed25519 signature>"
}
```

`issuedAt` is UTC in ISO 8601 format. `receiptId` makes separate receipts unique even for the same hash. The response has `Cache-Control: no-store`.

Example from JavaScript:

```js
const response = await fetch("https://YOUR_MOMENTO_HOST/api/v1/stamp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ hash: sha256Hex })
});
if (!response.ok) throw new Error(`Momento HTTP ${response.status}`);
const receipt = await response.json();
```

Example from a shell:

```sh
curl -i https://YOUR_MOMENTO_HOST/api/v1/stamp \
  -H 'Content-Type: application/json' \
  --data '{"hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}'
```

### Read endpoints and errors

| Endpoint | Result |
| --- | --- |
| `GET /api/v1/keys` | `{ "algorithm": "Ed25519", "keys": { "momento-v1": "<SPKI DER, base64url>" } }` |
| `GET /api/health` | `{ "ok": true }` |

Errors return `{ "error": "code" }`:

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_json`, `invalid_hash` | Malformed JSON or a body other than exactly one lowercase SHA-256 hash |
| `413` | `request_too_large` | Request body over 1,024 bytes |
| `415` | `unsupported_media_type` | Missing or non-JSON content type |
| `429` | `rate_limited` | Rate limit reached; response includes `Retry-After: 60` |
| `503` | `rate_limit_unavailable`, `signing_not_configured`, `signing_key_mismatch` | Service cannot safely issue a receipt |
| `500` | `signing_failed` | Unexpected signing error |

The Worker uses Cloudflare's Rate Limiting binding on the signing route: 30 requests per minute per client IP and 300 per minute per Cloudflare location. Read endpoints are not rate limited by the application. Cloudflare's counters are local to each location and eventually consistent, so these are abuse controls, not exact global quotas. Shared IPs can hit the per-client limit together. Cloudflare Workers Free also has a daily request ceiling; this project does not promise unlimited volume.

### Verify a receipt

The signature is Ed25519 over the UTF-8 bytes of:

```js
JSON.stringify([
  "Momento timestamp receipt v1",
  payload.version,
  payload.hash,
  payload.issuedAt,
  payload.receiptId,
  payload.keyId
])
```

Decode `signature` from base64url and verify it with the SPKI public key selected by `payload.keyId`. Then compute SHA-256 over the original file's raw bytes and compare the lowercase hexadecimal digest with `payload.hash`. Signature verification alone authenticates the receipt, not the file association. The [shared protocol implementation](packages/protocol/src/index.ts) performs validation and offline verification; the browser tool and CLI use it. The receipt format is versioned and does not sign the file name.

## Run locally

Requires Node.js 20.19+ and npm.

```sh
npm install
npm run build
npm run dev:api
```

Open the URL printed by Wrangler, usually `http://127.0.0.1:8790`. For frontend hot reload, run `npm run dev` in a second terminal and open the Vite URL instead.

The repository contains Momento's **public** verification key. Signing locally requires the matching private key in `apps/api/.dev.vars` as `SIGNING_PRIVATE_KEY_BASE64URL`. That file is deliberately excluded from Git. The project owner must supply the existing secret; a fresh clone can browse and verify receipts without it, but cannot sign as Momento. `npm run keygen` works only on a fresh, unconfigured fork; it refuses to replace an established key.

The CLI hashes files in a stream and verifies receipts offline:

```sh
npm run start -w @momento/cli -- stamp path/to/file.pdf https://YOUR_MOMENTO_HOST
npm run start -w @momento/cli -- verify path/to/file.pdf.momento.json path/to/file.pdf
```

`MOMENTO_API_URL` can replace the URL argument for `stamp`.

## Deploy to Cloudflare

The site and API deploy together as one Worker with static assets. Use the existing signing key; replacing it under the same `keyId` would make old receipts unverifiable.

1. Authenticate Wrangler with the Cloudflare account that will host Momento: `npx wrangler login`.
2. From `apps/api`, run `npx wrangler secret put SIGNING_PRIVATE_KEY_BASE64URL` and enter the base64url value from the owner's `apps/api/.dev.vars`, without quotes. The private key must never be committed or placed in `wrangler.jsonc`. Wrangler may create an initial Worker version when setting a secret.
3. From the repository root, run `npm run deploy`. The Wrangler config declares the signing secret as required and includes both rate-limit bindings.
4. Test `GET /api/health`, `GET /api/v1/keys`, and one `POST /api/v1/stamp` on the deployed URL. Verify the returned receipt against the submitted hash.

The configured rate limits apply per Cloudflare location; they do not guarantee that the Free plan's daily quota cannot be exhausted by distributed abuse. For a custom domain, additional Cloudflare WAF rules can be configured at the zone level if needed.

Public keys must remain available indefinitely for old receipts. A future rotation should add a new `keyId` and key while preserving previous public keys.

## Project structure

| Path | Purpose |
| --- | --- |
| `apps/api` | Hono Worker: public endpoints, rate limiting and Ed25519 signing |
| `apps/web` | React/Vite website and developer-facing API documentation |
| `packages/protocol` | Receipt schema, canonical signing bytes and offline verification |
| `packages/cli` | Streaming file hashing and command-line stamp/verify |

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Planned next steps: GitHub Actions and embeddable verification badges.

## License

MIT. See [LICENSE](LICENSE).
