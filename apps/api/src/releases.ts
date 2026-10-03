import { TEST_RELEASES } from './test-releases';

export const RELEASES_URL = 'https://github.com/MIKTHATGUY/momento/releases';
const GITHUB_API = 'https://api.github.com/repos/MIKTHATGUY/momento/releases?per_page=30';
const CACHE_MS = 5 * 60_000;
const MAX_BYTES = 1_048_576;

export interface PublishedRelease {
  id: number;
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  prerelease: boolean;
  body: string;
  preview?: true;
}

// Keep the exported site live without fetching GitHub during its static build.
// Only successful responses are cached; concurrent requests share one fetch.
export function createReleaseLoader(fetcher: typeof fetch = fetch, now = Date.now) {
  let cached: { releases: PublishedRelease[]; expiresAt: number } | undefined;
  let pending: Promise<PublishedRelease[]> | undefined;
  return async function load(): Promise<PublishedRelease[]> {
    if (cached && cached.expiresAt > now()) return cached.releases;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher(GITHUB_API, {
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Momento-Changelog' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok || !response.body) throw new Error('GitHub releases unavailable');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Release response too large'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!Array.isArray(data) || data.length > 30) throw new Error('Invalid release response');
      const releases: PublishedRelease[] = [];
      for (const item of data) {
        if (!item || typeof item !== 'object') throw new Error('Invalid release');
        if (item.draft === true) continue;
        if (typeof item.id !== 'number' || !Number.isSafeInteger(item.id) ||
            typeof item.tag_name !== 'string' || !item.tag_name ||
            typeof item.html_url !== 'string' || !item.html_url.startsWith(`${RELEASES_URL}/tag/`) ||
            typeof item.published_at !== 'string' || Number.isNaN(Date.parse(item.published_at)) ||
            typeof item.prerelease !== 'boolean' || (item.body !== null && typeof item.body !== 'string')) {
          throw new Error('Invalid release');
        }
        releases.push({ id: item.id, tag: item.tag_name, name: typeof item.name === 'string' && item.name.trim() ? item.name : item.tag_name,
          url: item.html_url, publishedAt: item.published_at, prerelease: item.prerelease, body: item.body ?? '' });
      }
      releases.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      cached = { releases, expiresAt: now() + CACHE_MS };
      return releases;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}

export const loadReleases = createReleaseLoader();

export async function loadChangelog() {
  const releases = await loadReleases();
  return releases.length ? releases : TEST_RELEASES;
}

export function releasesMarkdown(releases: PublishedRelease[]): string {
  const intro = `# Changelog\n\nPublished releases from [GitHub Releases](${RELEASES_URL}).\n\n`;
  if (!releases.length) return `${intro}No published releases yet.\n`;
  return intro + releases.map(release => `## ${release.name}\n\n${release.tag} · ${release.preview ? 'Unpublished test release' : release.publishedAt.slice(0, 10)}${!release.preview && release.prerelease ? ' · Pre-release' : ''}\n\n${release.body || 'No additional release notes.'}\n${release.preview ? '' : `\n[View release on GitHub](${release.url})\n`}`).join('\n');
}
