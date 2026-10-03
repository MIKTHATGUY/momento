import type { PublishedRelease } from './releases';

// Temporary local preview. Never submitted to GitHub; real releases replace it.
const postQuantumRelease: PublishedRelease = {
  id: 0,
  tag: 'v2.0.0-test',
  name: 'Post-quantum receipt signatures',
  url: 'https://github.com/MIKTHATGUY/momento/releases',
  publishedAt: '2026-10-03T00:00:00Z',
  prerelease: true,
  preview: true,
  body: `## Post-quantum signing

Momento moves from Ed25519 to **ML-DSA-65**, the NIST-standardized post-quantum signature algorithm defined in FIPS 204. Protocol v2 uses a new signing domain and has no classical fallback.

## Breaking changes

- **Discard all older Ed25519 signing and verification keys.** V1 receipts are rejected.
- Upgrade the CLI, protocol package, GitHub Action, and saved offline verifiers.
- Re-timestamp original files for fresh v2 receipts. Their new timestamps do not preserve earlier issuance times.
- API routes move to \`/api/v2/stamp\`, \`/api/v2/verify\`, and \`/api/v2/keys\`.

## Key migration

Configure the new \`ML_DSA65_PRIVATE_KEY_BASE64URL\` Worker secret and matching public key. Remove the older \`SIGNING_PRIVATE_KEY_BASE64URL\` secret after cutover.

## Verification

Offline verification, receipt sharing, and signing readiness use ML-DSA-65. SHA-256 file fingerprints remain unchanged. “Quantum-resistant” describes the signature algorithm; it is not an absolute guarantee of security.

This is an unpublished test entry for previewing the changelog layout.`,
};

export const TEST_RELEASES: PublishedRelease[] = [
  postQuantumRelease,
  {
    id: -1,
    tag: 'v2.0.0-test.1',
    name: 'A clearer release history',
    url: 'https://github.com/MIKTHATGUY/momento/releases',
    publishedAt: '2026-10-02T00:00:00Z',
    prerelease: true,
    preview: true,
    body: `Follow Momento’s progress without leaving the documentation. A dedicated changelog brings release notes and migration details together in one place.

## Added

- A vertical release timeline with version labels and anchored headings.
- GitHub release notes rendered with native documentation typography.
- Markdown copies of release notes for sharing and offline reading.

## Improved

Release notes refresh automatically after publication. Clear loading and retry states keep the page useful when GitHub is unavailable.

This is sample content for testing the timeline, not a published release.`,
  },
];
