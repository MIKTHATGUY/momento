import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '../../../lib/source';

// Export the index at build time so search works on the static site.
export const dynamic = 'force-static';
export const { staticGET: GET } = createFromSource(source);
