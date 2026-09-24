import { notFound } from 'next/navigation';
import { source } from '../../../../lib/source';
import { getPageMarkdownUrl } from '../../../../lib/markdown';
import { renderPlaceholder } from 'fumadocs-core/mdx-plugins/remark-llms.runtime';
import { openapi } from '../../../../lib/openapi';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: getPageMarkdownUrl(page).segments,
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  if (slug.at(-1) !== 'content.md') notFound();
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const markdown = [
    `# ${page.data.title}`,
    page.data.description,
    await renderPlaceholder(await page.data.getText('processed'), {
      async OpenAPIPage() {
        const { bundled } = await openapi.getSchema('momento');
        return `\n\n\`\`\`json\n${JSON.stringify(bundled, null, 2)}\n\`\`\`\n`;
      },
    }),
  ].filter(Boolean).join('\n\n');

  return new Response(markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
