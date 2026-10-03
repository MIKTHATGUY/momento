# Momento Timestamp

[![CI](https://github.com/MIKTHATGUY/momento/actions/workflows/ci.yml/badge.svg)](https://github.com/MIKTHATGUY/momento/actions/workflows/ci.yml)

[![Momento timestamp](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FMIKTHATGUY%2Fmomento%2Fmomento-badges%2Fbadge.json&cacheSeconds=300)](https://github.com/MIKTHATGUY/momento/blob/momento-badges/proof.json)

**A moment in time. A proof you can keep.**

Momento is an open timestamping primitive for SHA-256 hashes. Send a hash to the public API and get a signed receipt with the time Momento issued it. Keep the receipt, verify it later, and build the workflow you need around it. Your original file stays on your device. No account or API key is required.

[Try the web tools](https://momento.mthatguy.workers.dev/#tools) · [Read the documentation](https://momento.mthatguy.workers.dev/docs) · [Explore the API](https://momento.mthatguy.workers.dev/docs/api)

## Post-quantum migration

Version 2 uses NIST-standardized ML-DSA-65 quantum-resistant receipt signatures. **Discard all older Ed25519 keys and upgrade all verifiers.** V1 receipts are rejected. Re-timestamp original files for fresh v2 receipts; this does not preserve their earlier issuance times. See [release notes](CHANGELOG.md) and [key migration](docs/key-lifecycle.md).

## How it works

```text
Your file → SHA-256 hash → Momento API → signed receipt → your workflow
```

Hash a file locally, send only its digest, and save the returned receipt. The receipt binds that digest to Momento's server timestamp with an ML-DSA-65 signature. Verification checks the signature and compares the signed digest with a fresh hash of the file. The web tools can timestamp, verify, and inspect receipts; the CLI can hash larger files and verify receipts offline.

[Get started](https://momento.mthatguy.workers.dev/docs) · [How verification works](https://momento.mthatguy.workers.dev/docs/api#verify-offline)

## Built to fit your workflow

**Build around Momento, not inside it.** Use the same signed receipt in a script, a release process, CI, or your own application.

| Start with | Build |
| --- | --- |
| [API](https://momento.mthatguy.workers.dev/docs/api) | Request receipts and integrate timestamping into your own tools. |
| [CLI](https://momento.mthatguy.workers.dev/docs#command-line) | Timestamp files from scripts or verify saved receipts offline. |
| [Git hooks](https://momento.mthatguy.workers.dev/docs/git) | Attest local commits with parent-receipt links; keep proofs in your own repository. |
| [GitHub Action](https://momento.mthatguy.workers.dev/docs/github-action) | Verify locally attested commit history and publish coverage, or timestamp a checked-out commit. |
| Your tooling | Store, publish, index, or attach portable receipts wherever your workflow needs them. |

The core request is `POST /api/v2/stamp` with a lowercase SHA-256 digest:

```sh
curl --fail-with-body https://momento.mthatguy.workers.dev/api/v2/stamp \
  -H 'Content-Type: application/json' \
  --data '{"hash":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}'
```

The response is a signed JSON receipt. See the [API reference](https://momento.mthatguy.workers.dev/docs/api) for its format, verification, errors, and rate limits, or use the [interactive OpenAPI reference](https://momento.mthatguy.workers.dev/docs/openapi).

### One workflow built with Momento

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: MIKTHATGUY/momento@main
```

The GitHub Action hashes the checked-out commit, requests and verifies a receipt, and can publish proof and a Shields.io badge. This is one workflow; build yours around the same API. For permissions, badge setup, private repositories, and a complete workflow, see the [GitHub Action guide](https://momento.mthatguy.workers.dev/docs/github-action). Pin the Action to a reviewed commit SHA for reproducible use.

Alternatively, install the CLI's Git hooks with `momento-timestamp git init` (after package publication; use the compiled checkout CLI beforehand). They attest commits locally and keep receipts in `momento-proofs`. Set the Action's `mode: verify-history` with a full checkout to verify every reachable commit and publish `128/128 confirmed`. For existing history, set `start-commit` to the explicit activation SHA; its badge says `since activation`. The Action issues no new receipts in this mode, and Momento adds no server-side receipt storage. See [Git setup and limitations](apps/web/content/docs/git.mdx).

Other possibilities:

```text
Release signing   build → hash artifact → Momento → attach receipt
Document archive  upload → hash locally → Momento → store receipt
CI provenance     build → hash output → Momento → publish proof
```

These are patterns you can implement with the API; the included Action supports Git commit timestamping and verification of locally attested history.

## What the proof means

A verified receipt is evidence that data matching its hash existed by Momento's issuance time, subject to the server clock and signing key. It does not establish the file's creation time, author, or owner. Momento does not currently publish a measured clock error bound or use an independent witness to prevent an issuer with the signing key from backdating a receipt. Its signed JSON format is not RFC 3161.

Read the [trust and time accuracy guide](https://momento.mthatguy.workers.dev/docs/trust) before relying on a receipt. Keep the original bytes, receipt, and an authentic public key for independent verification.

## Packages and v2 release

The public packages are prepared locally for the 2.0.0 release. Until they are published, use the checkout-based CLI in the [getting started guide](https://momento.mthatguy.workers.dev/docs#command-line).

After package publication:

```sh
bunx @mikthatguy/momento-timestamp stamp document.pdf
bunx @mikthatguy/momento-timestamp verify document.pdf.momento.json document.pdf
```

The protocol package is `@mikthatguy/momento-protocol`. Read the [protocol specification](docs/protocol-v2.md), [fixed test vector](tests/fixtures/protocol-v2.json), [key lifecycle](docs/key-lifecycle.md), [threat model](docs/threat-model.md), and [architecture](docs/architecture.md).

The site includes [local receipt verification](https://momento.mthatguy.workers.dev/verify/), [live readiness](https://momento.mthatguy.workers.dev/status/), and [security reporting](SECURITY.md). These new pages become available after deployment. See [operations](docs/operations.md), [contributing](CONTRIBUTING.md), and [changelog](CHANGELOG.md).

## Develop locally

Requires Bun 1.3.13+ and Node.js 22.18+.

```sh
bun install
bun run build
bun run dev:api
```

The built frontend uses its own origin for signing and readiness. For frontend hot reload, run `bun run dev` in another terminal and set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8790` in `apps/web/.env.local` to point it at the local API. A fresh clone can verify receipts, but signing as Momento requires the owner's private key in `apps/api/.dev.vars` as `ML_DSA65_PRIVATE_KEY_BASE64URL`. The CLI uses the public API by default; pass `http://127.0.0.1:8790` as its API URL, or set `MOMENTO_API_URL`, for local signing.

The checkout already contains its configured ML-DSA-65 public key. `bun run keygen` is the initial provisioning helper for a checkout with the `REPLACE_WITH_ML_DSA65_PUBLIC_KEY` placeholder; it does not rotate the configured production key. It removes the obsolete local Ed25519 secret and refuses to overwrite an existing v2 key. Discard all older Ed25519 keys. Follow [key migration and rotation](docs/key-lifecycle.md) to configure the matching Worker secret and distribute the new verifier.

The repository is organized into `apps/api` (Cloudflare Worker), `apps/web` (web tools and documentation), `packages/protocol` (receipt format and offline verification), and `packages/cli` (file hashing and command-line tools). Run `bun run typecheck` and `bun run test` to check changes.

## License

MIT. See [LICENSE](LICENSE).

Development uses Bun 1.3.13 (`bun install --frozen-lockfile`, `bun run dev`). The frontend runs with Bun; the API runs in Cloudflare’s Worker runtime through Wrangler. Node.js 22.18+ remains required for the Node compatibility test suite and published CLI; the bundled GitHub Action uses Node 24. npm is retained for npm package publication.

Release builds are available through CI artifacts and the Release packages workflow. Published GitHub Releases receive installable npm archives and SHA-256 checksums; npm publication uses the configured trusted publisher.
