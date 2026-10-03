# Release 2.0.0

These changes prepare v2; they do not publish it. Package versions are 2.0.0, while the changelog remains unreleased until publication.

## Prepare

1. Review and commit the complete changes. Verify npm ownership of the `@mikthatguy` scope and enable GitHub private vulnerability reporting.
2. Run `bun install --frozen-lockfile` and `bun run pack:release`. Review the regenerated `scripts/action.bundle.mjs` and include it in the release commit. Inspect the two tarballs under `release/`: only compiled code, declarations where applicable, README, LICENSE, and package metadata belong there.
3. Require CI validation and compatibility checks in branch protection. Review CodeQL results. Enable external alerts and test key backup/recovery as described in operations.
4. Complete the breaking [key migration](key-lifecycle.md#breaking-v2-migration), discard all older Ed25519 keys, and provision the new Worker secret. Deploy with `bun run deploy`, then check readiness, a real stamp, offline verification, the browser tools, fragment verification, docs, and security headers.

## Publish

Publish the protocol first, then the CLI, using the maintainer's npm account/2FA or configured trusted publishing:

```sh
npm publish release/mikthatguy-momento-protocol-2.0.0.tgz --access public
npm publish release/mikthatguy-momento-timestamp-2.0.0.tgz --access public
```

Test `bunx @mikthatguy/momento-timestamp@2.0.0` from outside the repository. Mark the changelog release date accurately. Create a signed `v2.0.0` Git tag with the maintainer's configured signing identity, publish a GitHub Release with package artifacts, and point the floating `v2` Action tag to that reviewed commit. Do not invent or substitute a signing identity. Move `v2` only after later compatible releases pass validation.

After the tag exists, change Action examples from `@main` to `@v2`. Security-sensitive workflows should use the full reviewed commit SHA. Until publication, docs label npm usage as forthcoming and keep checkout-based commands usable.

## Compatibility

Version 2 intentionally rejects all v1 receipts and removes older Ed25519 keys. Publish the breaking migration prominently in the GitHub release, using CHANGELOG.md. Require clients to upgrade and re-timestamp files. Within 2.x, preserve the v2 signed bytes and uncompromised v2 verification keys. Never roll back to Ed25519.
