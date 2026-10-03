import { HomeLayout } from 'fumadocs-ui/layouts/home';
import Link from 'next/link';
import { baseOptions } from '../../lib/layout';
import ReceiptVerifier from '../../components/receipt-verifier';

export const metadata = { title: 'Verify a receipt' };
export default function VerifyPage() {
  return <HomeLayout {...baseOptions}><main className="landing utility-page"><h1>Verify a receipt</h1><p>Check a Momento Timestamp signature locally, then optionally compare a file hash.</p><ReceiptVerifier /><p>A valid signature authenticates the issuer's statement. <Link href="/docs/trust">Understand what the timestamp proves.</Link></p></main></HomeLayout>;
}
