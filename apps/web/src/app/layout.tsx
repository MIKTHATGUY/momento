import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import './global.css';
import 'katex/dist/katex.min.css';
export const metadata = { title: { default: 'Momento', template: '%s | Momento' }, description: 'Create and verify signed timestamps. Your files stay on your device.' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body className="flex min-h-dvh flex-col"><RootProvider theme={{ defaultTheme: 'dark' }} search={{ enabled: false }}>{children}</RootProvider></body></html>;
}
