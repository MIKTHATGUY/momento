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
          {/* TEMPORARY npm notice: remove this whole banner once npm packages are published. Single banner on purpose: multiple sticky banners overlap on scroll. */}
          <Banner
            id="momento-notices"
            variant="rainbow"
            rainbowColors={[
              'rgba(255,45,45,0.60)',
              'rgba(255,110,30,0.60)',
              'rgba(255,0,90,0.62)',
              'rgba(150,10,10,0.70)',
            ]}
            height="5rem"
            className="font-semibold"
          >
            <span className="flex flex-col items-center gap-1 py-1">
              <Link href="/docs/protocol" className="text-center text-sm underline-offset-4 hover:underline">
                Momento is now post-quantum — v2 receipts use ML-DSA-65. Learn more →
              </Link>
              <Link href="/docs/npm-status" className="text-center text-sm underline-offset-4 hover:underline">
                ⚠️ npm delayed — recovery requested, awaiting npm support. How to use Momento meanwhile →
              </Link>
            </span>
          </Banner>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
