# Signing key lifecycle

The verifier trusts `PUBLIC_KEYS`, indexed by the receipt's `keyId`. `/api/v2/keys` retains that mapping and adds metadata: `status`, `createdAt`, `fingerprint`, and `fingerprintAlgorithm: sha256-ml-dsa65-raw`. Fingerprints are lowercase SHA-256 of the decoded raw ML-DSA-65 bytes. An unknown original creation time is `null`; it is not inferred from a Git date.

## Breaking v2 migration

**Discard all older Ed25519 signing and verification keys.** V2 verifiers reject all v1 receipts. This policy also applies to saved offline verification packages; old software cannot learn this change automatically.

1. Run bun run keygen once to generate a fresh ML-DSA-65 pair. The script replaces the public-key placeholder and removes the obsolete local Ed25519 secret from the ignored apps/api/.dev.vars while preserving other bindings. It refuses to overwrite an existing v2 key.
2. Upload ML_DSA65_PRIVATE_KEY_BASE64URL from protected secret storage to the Worker with wrangler secret put. Never print or commit it. Delete the obsolete remote SIGNING_PRIVATE_KEY_BASE64URL secret with wrangler secret delete after cutting over.
3. Release the v2 protocol/CLI and update the Action and website with the new public key. Deploy the matching Worker and secret in a controlled maintenance window. V1 API paths are removed; clients must use /api/v2/ paths. Do not restore old code or keys during rollback.
4. Check readiness, issue a new receipt, and verify it offline. Discard older Ed25519 key backups and remove older keys from all active verification trust stores.
5. Re-timestamp original files. New issuance times cannot reproduce the old timestamps as post-quantum evidence. Keep old receipts only as historical, untrusted records if needed.

## Routine v2 rotation

1. Generate a new ML-DSA-65 pair securely. Keep the 32-byte seed in protected secret storage, with a tested encrypted backup; do not place it in Git. The Worker secret holds the seed as canonical unpadded Base64url (43 characters) and derives the 4032-byte expanded private key in memory at signing time — the expanded form exceeds Cloudflare's secret size limit and must never be stored as the secret.
2. Add the new raw public key under a new unique ID in `PUBLIC_KEYS`, with `KEY_METADATA` marked `active` and the actual creation time if known. Mark the previous key `retired` and retain its public key indefinitely.
3. Publish the updated verifier package and Action before changing the service's signing key, so clients can obtain the new authentic key. Update the website and retained offline verification copies too.
4. Stage the Worker secret and matching `KEY_ID` together during a controlled release. A mismatch fails closed. Check `/api/ready`, issue a test receipt, and verify it offline with the released package before declaring the rotation complete.
5. Remove the previous private key from active deployment access once rollout is complete. Preserve the public key.

A 2026 receipt signed by a routinely retired key remains valid after a 2028 rotation. Retirement does not invalidate signatures. Existing offline packages only know keys included when they were built; update them before accepting receipts from newly introduced keys.

## Suspected compromise

Stop issuance, revoke secret access, and investigate. Mark the affected key `compromised`; updated verifiers refuse receipts under it with `unknown_key`, even if the signature mathematically verifies. Publish an advisory and updated packages/Action/site. Restore service with a new key ID and check readiness and offline verification.

Keep the compromised public key published with its status for investigation. Do not present historical signatures as trustworthy simply because their signed time predates discovery: a stolen key can backdate a new receipt. Older offline verifiers cannot learn a new compromise notice automatically; users must obtain an authentic update. An independent timestamp obtained before compromise can supply additional evidence, but Momento v2 does not create one automatically.

See [the threat model](threat-model.md). Transparency logs and independently timestamped batch roots are future work.
