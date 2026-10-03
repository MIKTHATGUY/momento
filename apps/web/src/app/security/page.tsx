import { HomeLayout } from 'fumadocs-ui/layouts/home';
import Link from 'next/link';
import { baseOptions } from '../../lib/layout';
export const metadata = { title: 'Security' };
export default function SecurityPage() {
  return <HomeLayout {...baseOptions}><main className="landing utility-page"><h1>Security</h1><section className="feature"><h2>Report a vulnerability privately</h2><p>Please use <a href="https://github.com/MIKTHATGUY/momento/security/advisories/new">GitHub private vulnerability reporting</a>. Include reproduction steps and the affected version. Do not include private signing keys or sensitive original files.</p><p>If reporting is unavailable, open a public issue asking for a private contact without disclosing the vulnerability. This community project has no guaranteed response time.</p><h2>What you can trust</h2><p>The original file stays on your device. Receipts bind a SHA-256 hash to the issuer's stated time. A signature does not establish authorship, ownership, independently certified UTC accuracy, or protection against issuer backdating.</p><Link href="/docs/trust">Read the full trust model</Link></section></main></HomeLayout>;
}
