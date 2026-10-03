import { notFound } from 'next/navigation';
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from 'fumadocs-ui/page';
import { MarkdownCopyButton, ViewOptionsPopover } from 'fumadocs-ui/layouts/docs/page';
import { getMDXComponents } from '../../../components/mdx';
import { source } from '../../../lib/source';
import { getPageMarkdownUrl } from '../../../lib/markdown';
import { getOpenAPIPageProps } from '../../../lib/openapi';
import { OpenAPIPage } from '../../../components/api-page';
type Props = { params: Promise<{ slug?: string[] }> };
export default async function Page({ params }: Props) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  const MDX = page.data.body;
  const markdownUrl = page.slugs[0] === 'changelog'
    ? `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''}/api/releases/markdown`
    : getPageMarkdownUrl(page).url;
  const githubPath = page.path.split('/').map(encodeURIComponent).join('/');
  return (
    <DocsPage full={page.data.full} toc={page.data.toc} tableOfContent={{ style: 'clerk' }} tableOfContentPopover={{ style: 'clerk' }}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="flex flex-wrap items-center gap-2 border-b pt-2 pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
        />
      </div>
      <DocsBody><MDX components={getMDXComponents({
        OpenAPIPage: async () => (
          <OpenAPIPage {...await getOpenAPIPageProps()} />
        ),
      })} /></DocsBody>
    </DocsPage>
  );
}
export function generateStaticParams() { return source.generateParams(); }
export async function generateMetadata({ params }: Props) {
  const page = source.getPage((await params).slug);
  return { title: page?.data.title, description: page?.data.description };
}

