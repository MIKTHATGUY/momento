import { HomeLayout } from 'fumadocs-ui/layouts/home';
import Link from 'next/link';
import { baseOptions } from '../lib/layout';
import TimestampTools from '../components/timestamp-tools';

export default function Home() {
  return <HomeLayout {...baseOptions}>
    <div className="landing">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <p className="hero-badge"><span /> Open source timestamping</p>
          <h1 id="hero-title">A moment in time.<br /><span>A proof you can keep.</span></h1>
          <p className="hero-description">Give any file a signed timestamp. Create a receipt in seconds, verify it whenever you need. Your file never leaves your device.</p>
          <div className="hero-actions"><a className="primary-link" href="#tools">Create a timestamp <span>↗</span></a><Link className="secondary-link" href="/docs">Explore the docs <span>→</span></Link></div>
        </div>
        <div className="proof-scene" aria-label="Illustration of a file fingerprint becoming a signed receipt">
          <div className="source-file"><span className="file-symbol">↳</span><div>your-file.zip<small>Stays on your device</small></div><span className="local-label">LOCAL</span></div>
          <div className="proof-connector"><span>SHA-256 fingerprint</span><span>↓</span></div>
          <div className="proof-card"><div className="proof-card-header"><span className="proof-mark">m.</span><span>Timestamp receipt<small>Momento / ML-DSA-65</small></span><span className="signature-mark">✓</span></div><dl><dt>FILE FINGERPRINT</dt><dd>e3b0c44298fc1c14<span>9afbf4c8996fb924…</span></dd><dt>SIGNED AT · UTC</dt><dd>2026-09-25 <span>12:34:56.789</span></dd></dl><div className="proof-card-footer"><span>✓ Independently verifiable</span><span>.json</span></div></div>
          <p className="illustration-caption">Example receipt · Your next moment is yours.</p>
        </div>
      </section>
      <div className="principles"><span><i>01</i> Hash locally</span><b>→</b><span><i>02</i> Sign the fingerprint</span><b>→</b><span><i>03</i> Keep your proof</span></div>
      <section id="tools" className="tool-section" aria-labelledby="tools-title">
        <div className="section-heading"><div><p className="eyebrow">TIMESTAMP TOOLS</p><h2 id="tools-title">A timestamp for your file.</h2></div><p>No account. No setup.<br />Just your file and a little cryptography.</p></div>
        <div className="tool-stage"><TimestampTools /></div>
        <p className="tool-footnote">Checking Git commits? <a href="#git-checks">Jump to Git checks ↓</a> or use the Check repository tab above. <Link href="/docs/git">How Git verification works →</Link></p>
        <p className="tool-footnote">Time is supplied by the signing server. <Link href="/docs/trust">What does a timestamp prove? ↗</Link></p>
      </section>
      <section id="git-checks" className="under-the-hood" aria-labelledby="git-checks-title">
        <div className="section-heading"><div><p className="eyebrow">ATTEST GIT COMMITS</p><h2 id="git-checks-title">Every commit, checked.</h2></div><p>Hooks attest each commit as you create it.<br />Three checks prove the history is intact.</p></div>
        <div className="feature-grid">
          <article className="feature"><span className="feature-icon">◈</span><h3>Attest locally.</h3><p>Git hooks link each commit to its parents&apos; receipts and timestamp the commit bytes. Proofs live on <code>momento-proofs</code>.</p><Link className="text-link" href="/docs/git">Install the hooks ↗</Link></article>
          <article className="feature"><span className="feature-icon">✓</span><h3>Check before you push.</h3><p><code>git verify</code> checks signatures, hashes, parent links, and time ordering offline. The pre-push gate blocks unconfirmed commits.</p><Link className="text-link" href="/docs/git#check-history-verify-offline">How local checks work ↗</Link></article>
          <article className="feature"><span className="feature-icon">◎</span><h3>Check in CI.</h3><p><code>verify-history</code> re-runs the same offline check in CI and publishes the coverage badge to <code>momento-badges</code>.</p><div className="feature-links"><Link className="text-link" href="/docs/github-action">GitHub checks ↗</Link><Link className="text-link" href="/repositories">Check a repository ↗</Link></div></article>
        </div>
      </section>
      <section className="under-the-hood" aria-labelledby="details-title">
        <div className="section-heading"><div><p className="eyebrow">SIMPLE BY DESIGN</p><h2 id="details-title">Your files. Your workflow.</h2></div><Link className="text-link" href="/docs">Get to know Momento →</Link></div>
        <div className="feature-grid">
          <article className="feature"><span className="feature-icon">#</span><h3>The file stays with you.</h3><p>Your browser calculates a SHA-256 fingerprint. Only that hash reaches the signing service.</p><div className="mini-flow"><span>Your file</span><b>→</b><code>sha256</code><b>→</b><span>Receipt</span></div></article>
          <article className="feature"><span className="feature-icon">✓</span><h3>Built to be checked.</h3><p>A JSON receipt, an ML-DSA-65 signature, and a public key. Verify locally, without contacting the issuer.</p><Link className="text-link" href="/docs/trust">Understand the trust model ↗</Link></article>
          <article className="feature api-feature"><span className="feature-icon">⌘</span><h3>Make it part of your process.</h3><p>Timestamp from your app, a script, or your API client.</p><pre><code><span>POST</span> /api/v2/stamp{'\n'}{'{ "hash": "<SHA-256>" }'}</code></pre><div className="feature-links"><Link className="text-link" href="/docs/api">API reference ↗</Link><Link className="text-link" href="/docs/openapi">OpenAPI ↗</Link></div></article>
        </div>
      </section>
      <div className="proof-summary"><p><strong>What it proves:</strong> the issuer signed this hash and its stated time.</p><p><strong>What it does not prove:</strong> authorship, ownership, original creation time, or independent clock accuracy.</p></div>
      <footer className="landing-footer"><Link href="/" className="footer-brand">Momento Timestamp<span>A little proof. A moment in time.</span></Link><div><Link href="/docs">Docs</Link><Link href="/verify">Verify</Link><Link href="/repositories">Check repository</Link><Link href="/status">Status</Link><Link href="/security">Security</Link><Link href="/docs/protocol">Protocol v2</Link><a href="https://github.com/MIKTHATGUY/momento">GitHub ↗</a></div></footer>
    </div>
  </HomeLayout>;
}
