# Examples

Run `bun install --frozen-lockfile` and `bun run build:packages` from this checkout.

- `bun examples/stamp-and-verify.mjs file.txt`: stamps a file hash and verifies the receipt before saving it. This short example reads the whole file; use the streaming CLI for large files.
- `bun run --cwd packages/cli start -- verify receipt.json file.txt`: offline file verification.
- The [GitHub Action guide](../apps/web/content/docs/github-action.mdx) provides workflows for commit timestamping and attested history coverage.
- The [Git integration guide](../apps/web/content/docs/git.mdx) explains checkout-based hook installation, offline verification and proof synchronization.

These examples use the public API and need no Momento account. Preserve the original bytes and receipt.
