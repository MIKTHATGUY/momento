# Momento Timestamp CLI

Requires Node.js 22.18+. Hash files locally, timestamp their hashes, and verify saved receipts offline.

After the first package release:

```sh
bunx @mikthatguy/momento-timestamp stamp document.pdf
bunx @mikthatguy/momento-timestamp verify document.pdf.momento.json document.pdf
```

Only a SHA-256 digest is sent to the public API. Receipts are saved beside the original file without overwriting an existing receipt. Verification streams the original file and runs offline. There is no file-size limit; receipt JSON is limited to 8 KB. Network requests time out after 30 seconds.

To use another Momento instance:

```sh
momento-timestamp stamp document.pdf --api-url http://127.0.0.1:8790
```

An explicit URL takes precedence over `MOMENTO_API_URL`, which takes precedence over the public endpoint. A positional URL is also accepted for compatibility.

See [the trust model](https://momento.mthatguy.workers.dev/docs/trust) before relying on a timestamp.

## Git integration

After building with `bun run build:packages`, run the compiled CLI from the target repository:

```sh
bun /absolute/path/to/momento/packages/cli/dist/index.js git init
bun /absolute/path/to/momento/packages/cli/dist/index.js git verify
bun /absolute/path/to/momento/packages/cli/dist/index.js git sync [remote]
bun /absolute/path/to/momento/packages/cli/dist/index.js git stamp [COMMIT]
```

After publication these commands are available as `momento-timestamp git ...`. Initialization installs `prepare-commit-msg`, `post-commit` and `pre-push` hooks, preserving existing hooks. New commits contain hashes of their parents' signed receipts; receipts are stored in the separate `refs/momento/proofs` ref and pushed before source updates. No receipt archive is added to Momento's server. Custom `core.hooksPath` installations are refused rather than overwritten.

For an existing history that cannot pass full verification, HEAD becomes an explicit activation boundary (`momento.startCommit`); old commit dates are not retroactively certified. A fully attested clone retains full-history scope, and an explicitly configured boundary is preserved. Offline verification checks the entire reachable history unless a boundary is selected with `git verify --start-commit SHA` or local configuration. The GitHub Action accepts the same boundary explicitly and publishes a badge marked `since activation`.

If signing fails after a commit, retry `git stamp`; it cannot fix missing parent links. Rewritten commits from amend/rebase/cherry-pick/squash are not automatically repaired. Full setup, clone/push synchronization and trust limits: [Git integration](https://momento.mthatguy.workers.dev/docs/git).
