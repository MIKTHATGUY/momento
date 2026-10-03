import { notFound } from 'next/navigation';
import { docsLlms, source } from '../../../../lib/source';

export const revalidate = false;
export const dynamic = 'force-static';

export function generateStaticParams() {
  return source.generateParams().map((item) => ({
    ...item,
    slug: [...item.slug, 'content.md'],
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  // remove the appended "content.md", `/docs/index.md` is rewritten to the root page
  const slugs = slug?.slice(0, -1) ?? [];
  if (slugs.at(-1) === 'index') slugs.pop();
  const page = source.getPage(slugs);
  if (!page) notFound();

  return new Response(await docsLlms.page(page), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
