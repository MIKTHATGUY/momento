# V2 release readiness

This release migrates signatures to post-quantum ML-DSA-65 and rejects all older Ed25519 keys and v1 receipts. Package versions are 2.0.0. Release notes are in CHANGELOG.md.

## Local validation

Tests cover API signing and readiness, offline CLI and Action verification, malformed receipts, v1 rejection, fragment sharing, independent Node/OpenSSL ML-DSA-65 interoperability, Git receipt chains and merges, activation scope, bypassed hooks, proof synchronization, offline failures and negative coverage badge publication. Regenerate the committed Action bundle with `bun run build:action`. Workspace type checks, the static website build, and Worker deployment dry run are required before release.

## Production cutover

These local changes have not been deployed or published. Upload the new ML_DSA65_PRIVATE_KEY_BASE64URL Worker secret, publish updated clients, deploy the matching public key, remove the older remote Ed25519 secret, and check readiness and a real receipt. Discard all older signing and verification keys and update saved offline verifiers. Follow [release steps](releasing.md) and [key migration](key-lifecycle.md).

Re-timestamp files for fresh v2 receipts; this does not restore old issuance times. The clock remains trusted and file fingerprints remain SHA-256. “Quantum-resistant” describes the signature algorithm, not an absolute guarantee of security.
