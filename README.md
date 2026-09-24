# Momento

An open-source timestamp authority for SHA-256 hashes. Send a hash to Momento; its Cloudflare Worker reads its own clock and returns a signed receipt. The original file never leaves your device.

The website can hash a file locally, accept a hash you already calculated, verify a receipt against a file or hash, or inspect a receipt without the original file. The same public API can be called from a browser, a backend, a CLI or an automation. No account or API key is required.

> A Momento receipt is a signed claim by Momento about its server time. It proves neither when a file was created nor that the operator could not backdate a receipt. Verify the signature and the file hash before relying on one.

## API reference

The public base URL is `https://momento.mthatguy.workers.dev`. The API accepts and returns JSON. Cross-origin browser requests are allowed (`Access-Control-Allow-Origin: *`).

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
const response = await fetch("https://momento.mthatguy.workers.dev/api/v1/stamp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ hash: sha256Hex })
});
if (!response.ok) throw new Error(`Momento HTTP ${response.status}`);
const receipt = await response.json();
```

Example from a shell:

```sh
curl -i https://momento.mthatguy.workers.dev/api/v1/stamp \
  -H 'Content-Type: application/json' \
  --data '{"hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}'
```

### Verify a hash through the API

`POST /api/v1/verify` checks both the Ed25519 signature and whether the signed SHA-256 equals the hash you supplied. Send `Content-Type: application/json` and choose one of three equivalent receipt formats:

```json
{ "hash": "<64 lowercase SHA-256 hex characters>", "receipt": { "payload": { "version": 1, "hash": "...", "issuedAt": "...", "receiptId": "...", "keyId": "momento-v1" }, "signature": "..." } }
```

```json
{ "hash": "<64 lowercase SHA-256 hex characters>", "receiptBase64": "<base64 or base64url encoding of the complete receipt JSON>" }
```

```json
{ "hash": "<64 lowercase SHA-256 hex characters>", "payload": { "version": 1, "hash": "...", "issuedAt": "...", "receiptId": "...", "keyId": "momento-v1" }, "signature": "..." }
```

The `receipt` is the certificate returned by `/api/v1/stamp`. `receiptBase64` must encode the UTF-8 JSON bytes of that **whole** receipt, not just its signature or payload. Standard Base64 (with optional padding) and URL-safe Base64 are accepted. The hash is always supplied separately so verification checks the file you mean, rather than only trusting the hash inside the receipt. Compute the SHA-256 of your file locally; the file itself is never sent.

```js
const response = await fetch("https://momento.mthatguy.workers.dev/api/v1/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ hash: sha256Hex, receipt })
});
if (!response.ok) throw new Error(`Momento HTTP ${response.status}`);
const result = await response.json();
if (result.valid) console.log(result.issuedAt); // server-signed UTC time
else console.error(result.reason);
```

HTTP `200` returns `{ "valid": true, "hash": "...", "issuedAt": "...", "receiptId": "...", "keyId": "..." }` when **both** checks pass. A well-formed request with a nonmatching or invalid receipt returns HTTP `200` with `{ "valid": false, "reason": "hash_mismatch" }` (or `invalid_signature`, `unknown_key`, `invalid_receipt`). Never treat HTTP `200` alone as proof of validity; check `valid === true`. Failed verification does not return an untrusted timestamp. Responses use `Cache-Control: no-store`.

### Read endpoints and errors

| Endpoint | Result |
| --- | --- |
| `GET /api/v1/keys` | `{ "algorithm": "Ed25519", "keys": { "momento-v1": "<SPKI DER, base64url>" } }` |
| `GET /api/health` | `{ "ok": true }` |

Errors return `{ "error": "code" }`:

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_json`, `invalid_hash`, `invalid_request`, `invalid_receipt_encoding` | Malformed JSON, invalid hash, unsupported fields, or malformed Base64 receipt |
| `413` | `request_too_large` | Request body over 1,024 bytes for stamp or 8,192 bytes for verify |
| `415` | `unsupported_media_type` | Missing or non-JSON content type |
| `429` | `rate_limited` | Rate limit reached; response includes `Retry-After: 60` |
| `503` | `rate_limit_unavailable`, `signing_not_configured`, `signing_key_mismatch` | Service cannot safely issue a receipt |
| `500` | `signing_failed` | Unexpected signing error |

The Worker uses separate Cloudflare Rate Limiting bindings: signing allows 30 requests per minute per client IP and 300 per minute per Cloudflare location; verification allows 120 per client IP and 1,200 per location. Read endpoints are not rate limited by the application. Cloudflare's counters are local to each location and eventually consistent, so these are abuse controls, not exact global quotas. Shared IPs can hit the per-client limit together. Cloudflare Workers Free also has a daily request ceiling; this project does not promise unlimited volume.

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

Decode `signature` from base64url and verify it with the SPKI public key selected by `payload.keyId`. Then compute SHA-256 over the original file's raw bytes and compare the lowercase hexadecimal digest with `payload.hash`. Signature verification alone authenticates the receipt, not the file association. The [shared protocol implementation](packages/protocol/src/index.ts) performs validation and offline verification; the browser tool and CLI use it. Offline verification avoids depending on this API being available or honest at verification time. The receipt format is versioned and does not sign the file name.

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
npm run start -w @momento/cli -- stamp path/to/file.pdf https://momento.mthatguy.workers.dev
npm run start -w @momento/cli -- verify path/to/file.pdf.momento.json path/to/file.pdf
```

`MOMENTO_API_URL` can replace the URL argument for `stamp`.

## Deploy to Cloudflare

The site and API deploy together as one Worker with static assets. Use the existing signing key; replacing it under the same `keyId` would make old receipts unverifiable.

1. Authenticate Wrangler with the Cloudflare account that will host Momento: `npx wrangler login`.
2. From `apps/api`, run `npx wrangler secret put SIGNING_PRIVATE_KEY_BASE64URL` and enter the base64url value from the owner's `apps/api/.dev.vars`, without quotes. The private key must never be committed or placed in `wrangler.jsonc`. Wrangler may create an initial Worker version when setting a secret.
3. From the repository root, run `npm run deploy`. The Wrangler config declares the signing secret as required and includes both rate-limit bindings.
4. Test `GET /api/health`, `GET /api/v1/keys`, and one `POST /api/v1/stamp` on the deployed URL. Verify the returned receipt against the submitted hash with `POST /api/v1/verify` and independently with the CLI.

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
