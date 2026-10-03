# Operations

## Deploy

Use Bun 1.3.13+ and Node.js 22.18+ with `bun install --frozen-lockfile`. `bun run deploy` runs tests, type checks, package builds, website export, and the Worker dry run before deployment. The owner must configure the matching `ML_DSA65_PRIVATE_KEY_BASE64URL` Worker secret. Local signing uses the ignored `.dev.vars` file. Never print its value to a log or terminal recording.

Use a Cloudflare staging Worker with distinct rate-limit namespace IDs when testing deployments. This repository does not provision an account, custom domain, external monitoring, or signing-key backups.

## Checks and alerts

- `/api/health`: liveness only.
- `/api/ready`: imports the private/public keys and signs/verifies a fixed readiness challenge; checks rate-limit bindings exist without consuming quota. Results are cached up to 30 seconds per isolate. Returns 503 when not ready. It does not test the rate-limit backend.
- `/status`: a browser live readiness check of its own deployment (or `NEXT_PUBLIC_API_URL`), not historical uptime or an SLA.

Configure an external monitor for readiness at a reasonable interval, plus a low-frequency synthetic stamp followed by offline verification to cover the full path. Alert on sustained readiness failures, 5xx responses, latency changes, unusually high 429 counts, and the hosting plan's request budget. Test that notifications reach the maintainer before release.

Cloudflare observability is enabled. Request logs expose `event`, `requestId`, `method`, a known `path` (unknown paths become `other`), `status`, `durationMs`, and `rateLimited`. `X-Request-ID` is returned to clients. App logs omit hashes, bodies, secrets, query strings, and IP addresses. Review Cloudflare's separate platform logging and retention settings; application logging does not control every provider log.

## Rollback and keys

Retain the last known-good Worker version and package artifacts. Roll back code through Cloudflare deployment controls and rerun readiness and a synthetic stamp. Do not roll back a key change blindly: code, secret, public keys, and compromise status must remain consistent. Follow [key lifecycle](key-lifecycle.md).

## Headers and domains

Static security headers live in `apps/web/public/_headers`; API middleware sets API headers. Next's static export needs inline bootstrapping, so CSP permits inline script/style but denies framing, objects, and external script sources. There is no `unsafe-eval` allowance. Recheck browser console and core flows when changing headers.

Keep the workers.dev URL for v2. A custom domain is optional future setup requiring an owned domain/DNS access. Before switching, update API defaults, OpenAPI servers, documentation, and CSP `connect-src` together; retain the original endpoint during migration.

## Documentation changelog

The /docs/changelog page reads the public /api/releases endpoint at runtime. The Worker fetches the latest 30 GitHub Releases from MIKTHATGUY/momento and caches successful results per isolate for five minutes; the public response also has a five-minute HTTP cache lifetime. No GitHub token or website rebuild is required for new releases. Drafts are hidden and pre-releases labelled. Publish release notes on GitHub to update the page; local unreleased CHANGELOG.md entries are not presented as published releases. GitHub failures return 503, and the page offers a retry and a direct GitHub link.

Two temporary, explicitly unpublished test releases are defined in apps/api/src/test-releases.ts for previewing the layout while GitHub has no published releases. They are never sent to GitHub and are replaced automatically when a real release exists. Remove TEST_RELEASES and the fallback in loadChangelog when this preview is no longer needed.

## Git history coverage

Contributors install the CLI hooks and keep source history and `momento-proofs` in backups. Run `git sync` through the CLI before working across clones. The repository workflow uses `verify-history`; an existing repository must set the reviewed full activation SHA in the `MOMENTO_START_COMMIT` Actions variable. Leave it unset only for a history attested from the root. Treat changes to this variable, workflow and verifier as policy changes.

Verification failures publish a negative badge before the job fails. A receipt-only repair needs a manual workflow run; checkout, network or publication failures can leave an older badge visible. Check `proof.json` for its HEAD, scope and check time rather than relying on the cached image. See the [Git guide](../apps/web/content/docs/git.mdx) and [Action guide](../apps/web/content/docs/github-action.mdx).
