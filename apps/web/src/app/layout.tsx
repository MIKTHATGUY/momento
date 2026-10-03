import { RootProvider } from 'fumadocs-ui/provider/next';
import { Banner } from 'fumadocs-ui/components/banner';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './global.css';
import 'katex/dist/katex.min.css';
export const metadata = { title: { default: 'Momento Timestamp', template: '%s | Momento Timestamp' }, description: 'Create and verify signed timestamps for SHA-256 hashes. Your files stay on your device.' };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <RootProvider theme={{ defaultTheme: 'dark' }} search={{ options: { type: 'static', api: '/api/search/' } }}>
          <Banner id="momento-post-quantum-v2" variant="rainbow">
            <Link href="/docs/protocol" className="text-center text-sm underline-offset-4 hover:underline">
              Momento is now post-quantum — v2 receipts use ML-DSA-65. Learn more →
            </Link>
          </Banner>
          {/* TEMPORARY: remove with the npm-status docs page once npm packages are published. */}
          <Banner id="momento-npm-pending">
            <Link href="/docs/npm-status" className="text-center text-sm underline-offset-4 hover:underline">
              npm packages delayed — account recovery in progress. How to use Momento meanwhile →
            </Link>
          </Banner>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
