import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
export const baseOptions: BaseLayoutProps = {
  nav: { title: 'Momento' },
  links: [{ text: 'Documentation', url: '/docs' }, { text: 'Tools', url: '/#tools' }, { text: 'GitHub', url: 'https://github.com/MIKTHATGUY/momento', external: true }],
  searchToggle: { enabled: false },
};
