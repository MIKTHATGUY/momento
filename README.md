# Momento

[![Momento timestamp](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FMIKTHATGUY%2Fmomento%2Fmomento-badges%2Fbadge.json&cacheSeconds=300)](https://github.com/MIKTHATGUY/momento/blob/momento-badges/proof.json)

**A moment in time. A proof you can keep.**

Momento is an open timestamping primitive for SHA-256 hashes. Send a hash to the public API and get a signed receipt with the time Momento issued it. Keep the receipt, verify it later, and build the workflow you need around it. Your original file stays on your device. No account or API key is required.

[Try the web tools](https://momento.mthatguy.workers.dev/#tools) · [Read the documentation](https://momento.mthatguy.workers.dev/docs) · [Explore the API](https://momento.mthatguy.workers.dev/docs/api)

## How it works

```text
Your file → SHA-256 hash → Momento API → signed receipt → your workflow
```

Hash a file locally, send only its digest, and save the returned receipt. The receipt binds that digest to Momento's server timestamp with an Ed25519 signature. Verification checks the signature and compares the signed digest with a fresh hash of the file. The web tools can timestamp, verify, and inspect receipts; the CLI can hash larger files and verify receipts offline.

[Get started](https://momento.mthatguy.workers.dev/docs) · [How verification works](https://momento.mthatguy.workers.dev/docs/api#verify-offline)

## Built to fit your workflow

**Build around Momento, not inside it.** Use the same signed receipt in a script, a release process, CI, or your own application.

| Start with | Build |
| --- | --- |
| [API](https://momento.mthatguy.workers.dev/docs/api) | Request receipts and integrate timestamping into your own tools. |
| [CLI](https://momento.mthatguy.workers.dev/docs#command-line) | Timestamp files from scripts or verify saved receipts offline. |
| [GitHub Action](https://momento.mthatguy.workers.dev/docs/github-action) | Timestamp a checked-out commit and publish a badge linked to its proof. |
| Your tooling | Store, publish, index, or attach portable receipts wherever your workflow needs them. |

The core request is `POST /api/v1/stamp` with a lowercase SHA-256 digest:

```sh
curl --fail-with-body https://momento.mthatguy.workers.dev/api/v1/stamp \
  -H 'Content-Type: application/json' \
  --data '{"hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}'
```

The response is a signed JSON receipt. See the [API reference](https://momento.mthatguy.workers.dev/docs/api) for its format, verification, errors, and rate limits, or use the [interactive OpenAPI reference](https://momento.mthatguy.workers.dev/docs/openapi).

### One workflow built with Momento

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: MIKTHATGUY/momento@main
```

The GitHub Action hashes the checked-out commit, requests and verifies a receipt, and can publish proof and a Shields.io badge. This is one workflow; build yours around the same API. For permissions, badge setup, private repositories, and a complete workflow, see the [GitHub Action guide](https://momento.mthatguy.workers.dev/docs/github-action). Pin the Action to a reviewed commit SHA for reproducible use.

Other possibilities:

```text
Release signing   build → hash artifact → Momento → attach receipt
Document archive  upload → hash locally → Momento → store receipt
CI provenance     build → hash output → Momento → publish proof
```

These are patterns you can implement with the API; the included Action specifically timestamps Git commits.

## What the proof means

A verified receipt is evidence that data matching its hash existed by Momento's issuance time, subject to the server clock and signing key. It does not establish the file's creation time, author, or owner. Momento does not currently publish a measured clock error bound or use an independent witness to prevent an issuer with the signing key from backdating a receipt. Its signed JSON format is not RFC 3161.

Read the [trust and time accuracy guide](https://momento.mthatguy.workers.dev/docs/trust) before relying on a receipt. Keep the original bytes, receipt, and an authentic public key for independent verification.

## Develop locally

Requires Node.js 20.19+ and npm.

```sh
npm install
npm run build
npm run dev:api
```

For frontend hot reload, run `npm run dev` in another terminal. Set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8790` in `apps/web/.env.local` to point the frontend at the local API. A fresh clone can verify receipts, but signing as Momento requires the owner's private key in `apps/api/.dev.vars` as `SIGNING_PRIVATE_KEY_BASE64URL`.

The repository is organized into `apps/api` (Cloudflare Worker), `apps/web` (web tools and documentation), `packages/protocol` (receipt format and offline verification), and `packages/cli` (file hashing and command-line tools). Run `npm run typecheck` and `npm test` to check changes.

## License

MIT. See [LICENSE](LICENSE).
