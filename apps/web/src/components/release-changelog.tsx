'use client';

import { useEffect, useState } from 'react';
import Markdown, { defaultUrlTransform, type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Callout } from 'fumadocs-ui/components/callout';
import { Heading } from 'fumadocs-ui/components/heading';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import styles from './release-changelog.module.css';

interface Release {
  id: number;
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  prerelease: boolean;
  body: string;
  preview?: true;
}
const releasesUrl = 'https://github.com/MIKTHATGUY/momento/releases';
const markdownComponents: Components = {
  h1: ({ node, ...props }) => <Heading as="h3" {...props} />,
  h2: ({ node, ...props }) => <Heading as="h3" {...props} />,
  h3: ({ node, ...props }) => <Heading as="h4" {...props} />,
  pre: ({ node, ...props }) => <CodeBlock><Pre {...props} /></CodeBlock>,
  table: ({ node, ...props }) => <div className="relative overflow-auto prose-no-margin my-6"><table {...props} /></div>,
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  img: ({ alt, src }) => <a href={typeof src === 'string' ? src : undefined} target="_blank" rel="noopener noreferrer">{alt || 'Release image'}</a>,
};
const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function ReleaseChangelog() {
  const [state, setState] = useState<{ releases?: Release[]; error?: boolean }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let active = true;
    setState({});
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
    void fetch(`${base}/api/releases`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Releases unavailable');
        const data = await response.json();
        if (!Array.isArray(data.releases)) throw new Error('Invalid response');
        if (active) setState({ releases: data.releases });
      })
      .catch(() => { if (active) setState({ error: true }); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  const latestStable = state.releases?.find(release => !release.prerelease && !release.preview)?.id;
  return <div className={styles.changelog}>
    <p className={styles.source}>Release notes from <a href={releasesUrl} target="_blank" rel="noopener noreferrer">GitHub Releases ↗</a>. New published releases appear automatically.</p>
    {!state.releases && !state.error && <p role="status" className={styles.status}>Loading releases…</p>}
    {state.error && <Callout type="warn" title="Release notes are temporarily unavailable">
      <p>Read the <a href={releasesUrl}>releases on GitHub</a>, or try again.</p>
      <button className={styles.retry} type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </Callout>}
    {state.releases?.length === 0 && <Callout title="No published releases yet">
      <p>Release notes will appear here when a release is published on GitHub. You can follow <a href="https://github.com/MIKTHATGUY/momento/blob/main/CHANGELOG.md">unreleased changes in the repository</a>.</p>
    </Callout>}
    {state.releases?.some(release => release.preview) && <Callout title="Unpublished test releases">
      <p>These two entries are local previews. Published GitHub releases will replace them automatically.</p>
    </Callout>}
    <div className={styles.timeline}>
    {state.releases?.map(release => <article key={release.id} className={styles.release} aria-labelledby={`release-${release.id}`}>
      <div className={styles.meta}>
        <time dateTime={release.publishedAt}>{dateFormat.format(new Date(release.publishedAt))}</time>
        {release.preview && <span className={styles.previewLabel}>Preview date</span>}
        <span className={styles.tag}>{release.tag}</span>
        {release.preview ? <span className={styles.badge}>Test release</span> : release.prerelease ? <span className={styles.badge}>Pre-release</span> : release.id === latestStable && <span className={styles.badge}>Latest</span>}
      </div>
      <div className={styles.content}>
      <Heading as="h2" id={`release-${release.id}`}>{release.name}</Heading>
      {release.body ? <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml urlTransform={url => {
        const safe = defaultUrlTransform(url);
        if (!safe) return '';
        try { return new URL(safe, `${release.url}/`).href; } catch { return ''; }
      }}>{release.body}</Markdown> : <p>No additional release notes.</p>}
      <a className={styles.releaseLink} href={release.url} target="_blank" rel="noopener noreferrer">{release.preview ? 'View GitHub releases ↗' : 'View release on GitHub ↗'}</a>
      </div>
    </article>)}
    </div>
    {!!state.releases?.some(release => !release.preview) && <p className={styles.allReleases}><a href={releasesUrl} target="_blank" rel="noopener noreferrer">All releases on GitHub ↗</a></p>}
  </div>;
}
