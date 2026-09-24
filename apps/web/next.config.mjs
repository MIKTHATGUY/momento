import { createMDX } from 'fumadocs-mdx/next';
const withMDX = createMDX();
export default withMDX({ output: 'export', agentRules: false, trailingSlash: true, reactStrictMode: true });
