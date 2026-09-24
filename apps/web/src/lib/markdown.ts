export function getPageMarkdownUrl(page: { slugs: string[] }) {
  const segments = [...page.slugs, 'content.md'];
  return {
    segments,
    url: `/llms.mdx/docs/${segments.map(encodeURIComponent).join('/')}`,
  };
}
