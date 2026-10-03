// TEMPORARY: account recovery tracker. Advance CURRENT_STEP as the recovery
// proceeds; delete this component (and its use in the npm-status docs page)
// once the packages are published and the temporary notices are removed.
const STEPS = [
  { title: 'Publishing blocked: npm 2FA lost', detail: 'No authenticator, no recovery codes, no passkeys. npm publish is impossible until account access is restored.' },
  { title: 'Workaround published', detail: 'This page and the site banner explain checkout-based usage while npm is unavailable.' },
  { title: 'Recovery request sent to npm support', detail: 'Ticket opened from the account email address. Waiting on support verification — typically a few business days.' },
  { title: 'Prove account ownership', detail: 'Reply from the registered email and complete whatever verification npm support asks for.' },
  { title: 'Regain access and reset 2FA', detail: 'Log back in and re-enable the authenticator plus passkeys on two devices.' },
  { title: 'Store recovery codes properly', detail: 'Password manager plus an offline copy, so this never blocks a release again.' },
  { title: 'Publish and clean up', detail: 'Protocol package first, then CLI, verify a clean-room install, then delete this page, the banner and this tracker.' },
];
const CURRENT_STEP = 2;

export default function PublishTracker() {
  return (
    <section className="feature">
      <h2>Account recovery progress</h2>
      <p>Where the npm account recovery stands and what happens after access is restored. Updated by hand with each milestone.</p>
      <ol className="not-prose" style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
        {STEPS.map((step, i) => {
          const done = i < CURRENT_STEP;
          const current = i === CURRENT_STEP;
          return (
            <li key={step.title} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0' }}>
              <span aria-hidden style={{ flexShrink: 0, width: '1.5rem', height: '1.5rem', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, background: done ? '#16a34a' : current ? '#d97706' : 'transparent', color: done || current ? '#fff' : 'inherit', border: done || current ? 'none' : '1px solid currentColor', opacity: done || current ? 1 : 0.55 }}>
                {done ? '✓' : current ? '…' : i + 1}
              </span>
              <div>
                <div style={{ fontWeight: current ? 700 : 500 }}>{step.title}{current && ' — in progress'}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.75 }}>{step.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
