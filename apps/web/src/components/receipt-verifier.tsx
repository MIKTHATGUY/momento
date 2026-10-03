'use client';

import { useEffect, useRef, useState } from 'react';
import { decodeReceiptFragment, decodeReceiptText, verifyReceipt, MAX_RECEIPT_BYTES, type StampReceipt } from '@mikthatguy/momento-protocol';

export default function ReceiptVerifier() {
  const [receipt, setReceipt] = useState<StampReceipt | null>(null);
  const [hash, setHash] = useState('');
  const [message, setMessage] = useState('Open a receipt JSON or a shared verification link.');
  const [valid, setValid] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    async function loadFragment() {
      const current = ++request.current;
      if (!window.location.hash) { setReceipt(null); setValid(null); setBusy(false); setMessage('Open a receipt JSON or a shared verification link.'); return; }
      setBusy(true); setValid(null); setReceipt(null);
      try {
        const proof = decodeReceiptFragment(window.location.hash.slice(1));
        const checked = await verifyReceipt(proof);
        if (active && current === request.current) {
          setReceipt(proof); setValid(checked.valid);
          setMessage(checked.valid ? 'Signature valid. The original file has not been checked.' : checked.reason ?? 'Invalid receipt.');
        }
      } catch { if (active && current === request.current) setMessage('This verification link does not contain a valid receipt.'); }
      finally { if (active && current === request.current) setBusy(false); }
    }
    const listener = () => void loadFragment();
    listener(); window.addEventListener('hashchange', listener);
    return () => { active = false; window.removeEventListener('hashchange', listener); };
  }, []);

  async function openReceipt(file?: File) {
    if (!file) return;
    const current = ++request.current;
    setBusy(true); setValid(null); setReceipt(null);
    try {
      if (file.size > MAX_RECEIPT_BYTES) throw new Error('Receipt limit: 8 KB.');
      const proof = decodeReceiptText(await file.text());
      const checked = await verifyReceipt(proof);
      if (current !== request.current) return;
      setReceipt(proof); setValid(checked.valid);
      setMessage(checked.valid ? 'Signature valid. The original file has not been checked.' : checked.reason ?? 'Invalid receipt.');
    } catch (error) { if (current === request.current) setMessage(error instanceof Error ? error.message : 'Could not read the receipt.'); }
    finally { if (current === request.current) setBusy(false); }
  }

  async function checkHash() {
    if (!receipt || !/^[0-9a-f]{64}$/.test(hash)) return;
    const current = ++request.current;
    setBusy(true);
    const checked = await verifyReceipt(receipt, hash);
    if (current !== request.current) return;
    setValid(checked.valid);
    setMessage(checked.valid ? 'Signature and supplied SHA-256 hash match. The original file was not read here.' : checked.reason ?? 'Invalid receipt.');
    setBusy(false);
  }

  return <section className="feature utility-form">
    <label>Receipt JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={event => void openReceipt(event.target.files?.[0])} /></label>
    <p role="status" data-valid={valid}>{busy ? 'Checking receipt…' : message}</p>
    {receipt && <>
      {valid === true && <dl><dt>Issued at (UTC)</dt><dd>{receipt.payload.issuedAt}</dd><dt>SHA-256</dt><dd>{receipt.payload.hash}</dd><dt>Key ID</dt><dd>{receipt.payload.keyId}</dd></dl>}
      <label>Compare a file hash (optional)<input value={hash} disabled={busy} onChange={event => { setHash(event.target.value.trim().toLowerCase()); setValid(null); setMessage('Check the supplied hash to compare it with the receipt.'); }} placeholder="64 hexadecimal characters" spellCheck={false} autoComplete="off" /></label>
      <button className="primary-link" type="button" disabled={busy || !/^[0-9a-f]{64}$/.test(hash)} onClick={() => void checkHash()}>Check hash</button>
    </>}
    <p>Verification happens on this device. A shared receipt stays in the URL fragment and is not sent to the API. Anyone with that link can read the hash and signed time.</p>
  </section>;
}
