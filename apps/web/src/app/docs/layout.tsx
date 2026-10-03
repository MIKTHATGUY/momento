import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { GithubInfo } from 'fumadocs-ui/components/github-info';
import { source } from '../../lib/source';
import { baseOptions } from '../../lib/layout';
import type { ReactNode } from 'react';
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions}
      links={[
        ...(baseOptions.links ?? []).filter((link) => !('url' in link) || link.url !== 'https://github.com/MIKTHATGUY/momento'),
        {
          type: 'custom',
          children: <GithubInfo owner="MIKTHATGUY" repo="momento" />,
        },
      ]}
      tree={source.pageTree}
      tabs={[
        {
          title: 'Guides',
          description: 'Get started with Momento',
          url: '/docs',
          urls: new Set(source.getPages().filter((page) => page.slugs[0] !== 'openapi').map((page) => page.url)),
        },
        {
          title: 'OpenAPI',
          description: 'Interactive API reference',
          url: '/docs/openapi',
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
