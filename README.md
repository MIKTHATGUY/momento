# Momento

[![Momento timestamp](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FMIKTHATGUY%2Fmomento%2Fmomento-badges%2Fbadge.json&cacheSeconds=300)](https://github.com/MIKTHATGUY/momento/blob/momento-badges/proof.json)

An open-source timestamp authority for SHA-256 hashes. Send a hash to Momento; its Cloudflare Worker reads its own clock and returns a signed receipt. The original file never leaves your device.

The website can hash a file locally, accept a hash you already calculated, verify a receipt against a file or hash, or inspect a receipt without the original file. The same public API can be called from a browser, a backend, a CLI or an automation. No account or API key is required.

> [!NOTE]
> **Verifiable receipts, with an explicit trust model.** Momento binds a SHA-256 hash to a signed server timestamp. With a trusted clock, an uncompromised signing key, and secure cryptographic primitives, a verified receipt provides evidence that matching data existed by the issuance time, allowing for clock error. You can verify it offline using the public key.

[GitHub Action](#add-momento-to-your-github-cicd) · [Trust and time accuracy](#trust-and-time-accuracy) · [API reference](#api-reference) · [Run locally](#run-locally)

## Add Momento to your GitHub CI/CD

Use the public Action to timestamp your checked-out commit and show **Momento's signed UTC time** in your README. The Action hashes the commit, verifies the returned receipt, and automatically publishes the Shields.io badge data and proof to your repository's `momento-badges` branch.

### 1. Add the Action to your workflow

Add the following workflow as `.github/workflows/momento.yml`, or add its Momento step after checkout in your existing CI/CD job:

```yaml
name: Momento timestamp
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: momento-timestamp
  cancel-in-progress: false
jobs:
  timestamp:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MIKTHATGUY/momento@main
        id: momento
```

Replace `main` with your branch name if needed. For reproducible use, pin the Action to a reviewed full commit SHA. When adding it to existing CI/CD, keep the `contents: write` permission and concurrency group, run on your chosen source branch, and exclude `momento-badges` from triggers. Place the step after your build/tests if the badge should update only after they pass.

No Momento account, API key, signing secret, npm install, GitHub Pages setup, or custom publishing script is required. The Action uses GitHub's automatic token. Repository or organization rules must allow that token to create and update the dedicated `momento-badges` branch, whose files are managed by the Action. Automatic publishing supports repositories on github.com.

### 2. Add the Shields.io badge to your README

Replace `OWNER` and `REPO` with your public GitHub repository:

```markdown
[![Momento timestamp](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2FREPO%2Fmomento-badges%2Fbadge.json&cacheSeconds=300)](https://github.com/OWNER/REPO/blob/momento-badges/proof.json)
```

The Action also outputs your complete badge Markdown in the workflow run summary and as `steps.momento.outputs.badge-markdown`. The badge becomes available after the first successful run and updates automatically on subsequent successful runs. Badge URLs and endpoint JSON explicitly request a 300-second (five-minute) cache, the current minimum for Shields.io endpoint badges. GitHub raw-content caching and its Camo image proxy can add delay, so this is not a guaranteed refresh deadline. A failed run leaves the last successfully published timestamp visible.

The badge displays the verified receipt's `issuedAt`, for example `Momento | 2026-09-25 12:34:56.789 UTC`. This is when Momento issued the receipt during CI, not Git's author or committer date. Clicking the badge opens the proof and signed receipt. The badge itself is a display; verify the receipt before relying on it.

### Badge freshness

Use `&cacheSeconds=300` on the Shields.io URL, as shown above. The [Shields.io endpoint implementation](https://github.com/badges/shields/blob/master/services/endpoint/endpoint.service.js) enforces a minimum of 300 seconds; `cacheSeconds=1` cannot force instant refreshes. `maxAge` is not the documented cache control for this badge type.

A browser hard refresh does not purge GitHub's server-side image cache. If a badge remains stale after the caches expire, follow [GitHub's Camo troubleshooting instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls). GitHub recommends using a Camo purge sparingly. Changing the README image URL with a one-time `&v=2` gives GitHub a new image URL, but does not guarantee fresh upstream JSON. Automatically rewriting the README on every run would add commits and complicate which commit is being timestamped; the Action keeps a stable badge URL instead.

### Inputs, outputs, and verification

| Input | Default | Purpose |
| --- | --- | --- |
| `publish-badge` | `true` | Publish proof and badge to your repository; set to `'false'` for local files only |
| `github-token` | `${{ github.token }}` | Automatic workflow token; publishing needs `contents: write` |
| `output-directory` | `momento-proof` | Local directory containing the generated proof |

Outputs are `issued-at`, `commit`, `committed-at`, `hash`, and `proof-path`, plus `badge-url` and `badge-markdown` when publishing succeeds. The Action uses Node 24 and requires Git and a checkout. It timestamps `HEAD`; in a pull request job this may be a synthetic merge commit.

The output directory and published branch contain `badge.json`, `proof.json`, `receipt.json`, and `commit.txt`. The latter contains the exact raw commit object body hashed with SHA-256. Only that hash is sent to Momento. The proof includes Git metadata separately from the signed receipt. The surrounding metadata is not separately signed.

To independently verify the receipt, run `npm run start -w @momento/cli -- verify path/to/receipt.json path/to/commit.txt` from a Momento checkout. Compare `commit.txt` with the raw bytes returned by `git cat-file commit <commit>` in the original repository to verify the commit association.

For private repositories or jobs without write permission, set `publish-badge: 'false'` and optionally preserve `momento-proof/` with `actions/upload-artifact@v4`. A public Shields.io badge requires publicly readable JSON; it cannot read a private repository's branch. See the [Shields.io endpoint specification](https://shields.io/badges/endpoint-badge) for customization.

## Trust and time accuracy

Momento is a timestamp authority using a custom signed JSON protocol. Its receipts can be checked independently with the [public key and verifier](packages/protocol/src/index.ts). It does **not** implement the [RFC 3161 timestamp protocol](https://www.rfc-editor.org/rfc/rfc3161.html). A timestamp provides evidence of existence by a time; it does not establish the original creation time, authorship, or ownership of a file.

### What you can verify

| Property | What Momento provides |
| --- | --- |
| Receipt integrity | Ed25519 verification checks the signed hash, timestamp, receipt ID, version, and key ID. Editing a signed field invalidates the existing signature. |
| File association | Recomputing SHA-256 over the file's raw bytes lets you check that it matches the signed hash. |
| Client control of time | The stamp endpoint accepts only a hash. The Worker selects `issuedAt` from its own clock. |
| Offline verification | Saved receipts can be verified without calling Momento. Obtain and retain the authentic public key through a trusted channel. |
| UTC accuracy | The service reads the Worker clock. No measured or independently certified clock-error bound is currently published. |
| Protection against issuer backdating | The current protocol has no independent witness or external timestamp anchor that prevents the signing-key holder from issuing a receipt with an earlier date. |

### Cryptographic strength

Ed25519 targets approximately **128-bit classical security**, as described in [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032.html#section-8.5). The scale associated with that security level is:

```math
2^{128} \approx 3.40 \times 10^{38}
```

This describes a cryptographic attack work scale under standard assumptions, not an exact operation count for every attack or a probability that a timestamp is correct. It assumes secure key generation, correct implementation, and protection of the private key. It does not cover key theft, a dishonest signer, or quantum attacks.

> [!IMPORTANT]
> **There is no supported “99% impossible to backdate” claim.** An outsider without the private key would need to defeat the signature protection to change the signed time. Someone who controls the private key can instead sign a new receipt containing an earlier time; that requires no cryptographic break. Open source makes the implementation inspectable, but does not prove which code an operator deployed.

### What a time-error bound would mean

Let $t_s$ be the signed `issuedAt`, $t_r$ the actual UTC instant when the server sampled its clock, and $\Delta$ a validated upper bound on absolute clock error. If that bound were established, then:

```math
|t_s - t_r| \leq \Delta
\quad \Longrightarrow \quad
t_r \in [t_s - \Delta,\; t_s + \Delta]
```

Under honest issuance and the cryptographic assumptions above, matching data would therefore have existed no later than $t_s + \Delta$. This interval concerns the server's clock reading, not file creation, network transit, or when a badge becomes visible.

**Current status: Momento does not establish a numerical value for $\Delta$.** Millisecond formatting in `issuedAt` is representation precision, not a guarantee of millisecond accuracy. A 99% coverage claim would require a defined measurement method and evidence that the proposed interval covers the actual time at that rate; signature strength supplies neither.

<details>
<summary><strong>How to independently check and preserve a receipt</strong></summary>

1. Keep the original file bytes, receipt, and authentic public verification key. For the GitHub Action, retain `commit.txt`, `receipt.json`, and `proof.json`.
2. Verify the signature locally and compare the file's SHA-256 with the signed hash. The CLI command is shown below; the Action also performs these checks before publishing.
3. For a commit receipt, compare `commit.txt` against `git cat-file commit <commit>` from the original repository. Git author and committer dates are separate metadata.
4. If your use case needs evidence independent of Momento's operator, obtain an additional independent timestamp over the receipt or preserve it in an independently witnessed publication system. That can establish that the receipt existed by the external observation time; it does not retroactively certify Momento's clock reading.

```sh
npm run start -w @momento/cli -- verify path/to/receipt.json path/to/file
```

The badge is a convenient display. Its color, cached image, and mutable publishing branch are not substitutes for receipt verification or independent preservation.

</details>

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

Open the URL printed by Wrangler, usually `http://127.0.0.1:8790`. For frontend hot reload, run `npm run dev` in a second terminal and open `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8790` in `apps/web/.env.local` before starting Next.js to use the local API. Without an override, the tools use the public Momento API.

The repository contains Momento's **public** verification key. Signing locally requires the matching private key in `apps/api/.dev.vars` as `SIGNING_PRIVATE_KEY_BASE64URL`. That file is deliberately excluded from Git. The project owner must supply the existing secret; a fresh clone can browse and verify receipts without it, but cannot sign as Momento. `npm run keygen` works only on a fresh, unconfigured fork; it refuses to replace an established key.

The CLI hashes files in a stream and verifies receipts offline:

```sh
npm run start -w @momento/cli -- stamp path/to/file.pdf https://momento.mthatguy.workers.dev
npm run start -w @momento/cli -- verify path/to/file.pdf.momento.json path/to/file.pdf
```

`MOMENTO_API_URL` can replace the URL argument for `stamp`.

## Deploy to Cloudflare

The frontend uses Fumadocs and Next.js static export. `npm run build -w @momento/web` writes `apps/web/out`; no Next.js server is needed. The default deployment serves those files alongside the API on the existing Worker. Use the existing signing key; replacing it under the same `keyId` would make old receipts unverifiable.

1. Authenticate Wrangler with the Cloudflare account that will host Momento: `npx wrangler login`.
2. From `apps/api`, run `npx wrangler secret put SIGNING_PRIVATE_KEY_BASE64URL` and enter the base64url value from the owner's `apps/api/.dev.vars`, without quotes. The private key must never be committed or placed in `wrangler.jsonc`. Wrangler may create an initial Worker version when setting a secret.
3. From the repository root, run `npm run deploy`. The Wrangler config declares the signing secret as required and includes both rate-limit bindings.
4. Test `GET /api/health`, `GET /api/v1/keys`, and one `POST /api/v1/stamp` on the deployed URL. Verify the returned receipt against the submitted hash with `POST /api/v1/verify` and independently with the CLI.

The configured rate limits apply per Cloudflare location; they do not guarantee that the Free plan's daily quota cannot be exhausted by distributed abuse. For a custom domain, additional Cloudflare WAF rules can be configured at the zone level if needed.

Public keys must remain available indefinitely for old receipts. A future rotation should add a new `keyId` and key while preserving previous public keys.

### Optional: host the frontend on Cloudflare Pages

Use repository root as the build root, build command `npm run build -w @momento/web`, and output directory `apps/web/out`. The tools call the existing public API by default. To use another API, set `NEXT_PUBLIC_API_URL` to its origin before building; this is a public build-time setting, never a signing secret. To use same-origin API requests, set it to an empty string. Redeploy after changing it.

Docs live in `apps/web/content/docs`. Navigation, code blocks, and table of contents use Fumadocs. The site uses the default Fumadocs layout, styles, and theme switcher. Search is disabled to keep the static setup minimal.

The sidebar dropdown switches between Guides and the interactive OpenAPI reference at `/docs/openapi`. Hono serves the generated OpenAPI 3.1 document at `/api/openapi.json`. Route descriptions and request/response schemas live in `apps/api/src/openapi.ts` and are attached with `describeRoute`; the existing runtime validators enforce request limits and receipt rules. Keep those schemas in sync when changing validation.

Web development, builds, and typechecks generate `apps/web/public/openapi.json` from the registered Hono routes, so Fumadocs uses the same schema without calling the deployed API. Run `npm run generate:openapi -w @momento/web` after changing API definitions during a running dev session. The static schema is available at `/openapi.json`.

## Project structure

| Path | Purpose |
| --- | --- |
| `apps/api` | Hono Worker: public endpoints, rate limiting and Ed25519 signing |
| `apps/web` | Static Next.js/Fumadocs website; MDX docs in `content/docs` |
| `packages/protocol` | Receipt schema, canonical signing bytes and offline verification |
| `packages/cli` | Streaming file hashing and command-line stamp/verify |

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The test suite includes the public Action's commit hashing and rejection of invalid timestamp receipts.

## License

MIT. See [LICENSE](LICENSE).
