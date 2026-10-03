# Changelog

## 2.0.0 — 2026-10-03

### Git attestations

- Added local Git hooks for parent-receipt links, commit attestations and proof publication, plus offline history verification and safe proof synchronization. Receipts stay in the repository's hidden `refs/momento/proofs` ref — not a branch, so GitHub shows no recent-push banners; no server-side archive is added.
- Added Action `verify-history` mode and a coverage badge with negative-result publication, complete-history checks and explicit activation scope for existing repositories. Included a standalone bundled Action entry point and Git integration documentation.

### Breaking security migration

- Moved receipt signatures from Ed25519 to the NIST-standardized post-quantum ML-DSA-65 algorithm (FIPS 204), with protocol v2 and a new domain separator. This provides quantum-resistant signatures, not an absolute guarantee of “quantum-proof” security.
- **Discard all older Ed25519 signing and verification keys.** Updated verifiers reject all protocol v1 receipts; no classical fallback is provided. Upgrade the CLI, protocol package, Action, and saved offline verifiers. Re-timestamp original files for new receipts; old issuance times cannot be recovered as post-quantum proofs.
- API paths move to `/api/v2/stamp`, `/api/v2/verify`, and `/api/v2/keys`; the old v1 paths are removed.
- Replace the Worker secret with `ML_DSA65_PRIVATE_KEY_BASE64URL`, deploy the matching new public key, then delete `SIGNING_PRIVATE_KEY_BASE64URL`. SHA-256 file fingerprints are unchanged.
- Pinned `@noble/post-quantum` 0.7.0 for portable ML-DSA-65 signing and verification.

- Documentation changelog reads published GitHub Releases live, with native Fumadocs styling and a five-minute cached feed.
- Public-package builds for `@mikthatguy/momento-protocol` and `@mikthatguy/momento-timestamp`, with a standalone Node CLI entry point.
- Public API default, English messages, explicit API override, bounded receipts, and network timeouts.
- Signing readiness self-test, public-key fingerprints and lifecycle metadata, request IDs, and structured request logs without user hashes.
- Browser receipt sharing and local verification via URL fragments, live service status, security guidance, and static security headers.
- Protocol v2 specification, fixed crypto test vector, malformed receipt tests, and key rotation/compromise documentation.
- CI validation, package artifacts, dependency updates, and CodeQL workflow.
- Updated compatible dependencies and patched the documentation library's Undici dependency.

The GitHub release and signed `v2.0.0` and `v2` Action tags are published. npm availability remains delayed pending account recovery; downloadable package archives are attached to the GitHub release.
