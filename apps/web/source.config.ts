import { defineDocs, defineConfig } from 'fumadocs-mdx/config';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: {
        mdxAsPlaceholder: ['OpenAPIPage', 'Mermaid'],
      },
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkNpmOptions: {
      persist: { id: 'package-manager' },
    },
    remarkPlugins: [remarkMdxMermaid, remarkMath],
    rehypePlugins: (plugins) => [
      [rehypeKatex, { strict: 'error', throwOnError: true }],
      ...plugins,
    ],
  },
});
