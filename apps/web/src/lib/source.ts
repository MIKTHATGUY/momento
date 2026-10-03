import { docs } from '../../.source/server';
import { loader, llms } from 'fumadocs-core/source';
import { renderPlaceholder } from 'fumadocs-core/mdx-plugins/remark-llms.runtime';
import { openapi } from './openapi';

export const source = loader({ baseUrl: '/docs', source: docs.toFumadocsSource() });

export const docsLlms = llms(source, {
  renderPage: async (page) => {
    const processed = await renderPlaceholder(await page.data.getText('processed'), {
      async OpenAPIPage() {
        const { bundled } = await openapi.getSchema('momento');
        return `\n\n\`\`\`json\n${JSON.stringify(bundled, null, 2)}\n\`\`\`\n`;
      },
      async Mermaid(data: { attributes?: { chart?: string } }) {
        const chart = data.attributes?.chart ?? '';
        return `\n\n\`\`\`mermaid\n${chart}\n\`\`\`\n`;
      },
    });

    const header = `# ${page.data.title} (${page.url})`;
    return [header, page.data.description, processed].filter(Boolean).join('\n\n');
  },
});
