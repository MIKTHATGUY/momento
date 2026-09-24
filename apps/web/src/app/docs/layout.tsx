import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '../../lib/source';
import { baseOptions } from '../../lib/layout';
import type { ReactNode } from 'react';
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      {...baseOptions}
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
