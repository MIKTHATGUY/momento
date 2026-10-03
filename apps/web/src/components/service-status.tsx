'use client';
import { useEffect, useState } from 'react';

export default function ServiceStatus() {
  const [state, setState] = useState('Checking…');
  const [checkedAt, setCheckedAt] = useState('');
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true); setState('Checking…');
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
    try {
      const response = await fetch(`${base}/api/ready`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const result = await response.json();
      setState(response.ok && result.ready === true ? 'Ready to issue receipts' : 'Signing is currently unavailable');
    } catch { setState('Could not reach the service'); }
    finally { setCheckedAt(new Date().toISOString()); setBusy(false); }
  }
  useEffect(() => { void check(); }, []);
  return <section className="feature utility-form"><h2 role="status">{state}</h2>{checkedAt && <p>Checked at {checkedAt} (UTC)</p>}<button className="primary-link" type="button" disabled={busy} onClick={() => void check()}>Check again</button><p>This is a live readiness check, not an uptime history. It tests signing configuration; it does not certify the server clock or test the rate-limit backend.</p></section>;
}
