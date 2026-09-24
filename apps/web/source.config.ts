import { defineDocs, defineConfig } from 'fumadocs-mdx/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: {
        mdxAsPlaceholder: ['OpenAPIPage'],
      },
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkNpmOptions: {
      persist: { id: 'package-manager' },
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: (plugins) => [
      [rehypeKatex, { strict: 'error', throwOnError: true }],
      ...plugins,
    ],
  },
});
