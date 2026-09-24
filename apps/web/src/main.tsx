import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { verifyReceipt, type StampReceipt } from "@momento/protocol";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-mono/latin-400.css";
import "./style.css";

const MAX_BROWSER_FILE_SIZE = 100 * 1024 * 1024;
const SHA256_RE = /^[0-9a-f]{64}$/;

async function sha256(file: File): Promise<string> {
  if (file.size > MAX_BROWSER_FILE_SIZE) throw new Error("Browser limit: 100 MB. Use the CLI for larger files.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

function downloadReceipt(receipt: StampReceipt, name: string) {
  const blob = new Blob([JSON.stringify(receipt, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.momento.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function verificationError(reason?: string): string {
  switch (reason) {
    case "Il file non corrisponde alla ricevuta.": return "File hash does not match the receipt.";
    case "Chiave pubblica sconosciuta o non configurata.": return "Unknown or unconfigured public key.";
    case "Firma non valida.": return "Invalid signature.";
    default: return "Invalid receipt.";
  }
}

function App() {
  const apiBase = window.location.origin;
  const hashRequest = useRef(0);
  const [stampMode, setStampMode] = useState<"file" | "hash">("file");
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [stampHash, setStampHash] = useState("");
  const [hashing, setHashing] = useState(false);
  const [verifyMode, setVerifyMode] = useState<"file" | "hash">("file");
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyHash, setVerifyHash] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [inspectFile, setInspectFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"stamp" | "verify" | "inspect" | null>(null);
  const [stampError, setStampError] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string; receipt?: StampReceipt } | null>(null);
  const [inspectResult, setInspectResult] = useState<{ valid: boolean; message: string; receipt?: StampReceipt } | null>(null);
  const [receipt, setReceipt] = useState<StampReceipt | null>(null);

  async function selectStampFile(file: File | null) {
    const request = ++hashRequest.current;
    setStampFile(file); setStampHash(""); setStampError(""); setReceipt(null);
    if (!file) { setHashing(false); return; }
    setHashing(true);
    try { const hash = await sha256(file); if (request === hashRequest.current) setStampHash(hash); }
    catch (error) { if (request === hashRequest.current) setStampError(error instanceof Error ? error.message : "Could not hash the file."); }
    finally { if (request === hashRequest.current) setHashing(false); }
  }

  function changeStampMode(mode: "file" | "hash") {
    ++hashRequest.current;
    setStampMode(mode); setStampFile(null); setStampHash(""); setHashing(false); setStampError(""); setReceipt(null);
  }

  async function stamp() {
    const hash = stampHash.trim().toLowerCase();
    if (!SHA256_RE.test(hash) || hashing) return;
    setBusy("stamp"); setStampError(""); setReceipt(null);
    try {
      const response = await fetch("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash }) });
      if (!response.ok) throw new Error("Signing service unavailable. Try again shortly.");
      const proof = await response.json() as StampReceipt;
      const checked = await verifyReceipt(proof, hash);
      if (!checked.valid) throw new Error("The returned receipt failed signature verification.");
      setReceipt(proof);
      downloadReceipt(proof, stampMode === "file" && stampFile ? stampFile.name : `sha256-${hash.slice(0, 12)}`);
    } catch (error) { setStampError(error instanceof Error ? error.message : "Unexpected error."); }
    finally { setBusy(null); }
  }

  async function verify() {
    if (!proofFile || (verifyMode === "file" ? !verifyFile : !SHA256_RE.test(verifyHash))) return;
    setBusy("verify"); setVerifyResult(null);
    try {
      const hash = verifyMode === "file" ? await sha256(verifyFile!) : verifyHash;
      const proof = JSON.parse(await proofFile.text()) as unknown;
      const checked = await verifyReceipt(proof, hash);
      setVerifyResult(checked.valid && checked.receipt
        ? { valid: true, message: verifyMode === "file" ? "Signature and file hash match." : "Signature and supplied hash match. The original file was not checked here.", receipt: checked.receipt }
        : { valid: false, message: verificationError(checked.reason) });
    } catch { setVerifyResult({ valid: false, message: "Could not read the file or receipt." }); }
    finally { setBusy(null); }
  }

  async function inspect() {
    if (!inspectFile) return;
    setBusy("inspect"); setInspectResult(null);
    try {
      const proof = JSON.parse(await inspectFile.text()) as unknown;
      const checked = await verifyReceipt(proof);
      setInspectResult(checked.valid && checked.receipt
        ? { valid: true, message: "Signature valid. File association has not been checked.", receipt: checked.receipt }
        : { valid: false, message: verificationError(checked.reason) });
    } catch { setInspectResult({ valid: false, message: "Could not read the receipt." }); }
    finally { setBusy(null); }
  }

  return <div className="site">
    <a className="skip-link" href="#main">Skip to tool</a>
    <header className="topbar"><a className="wordmark" href="/" aria-label="Momento home"><span className="wordmark-icon">M/</span> momento</a><span className="top-note">FILE TIMESTAMP UTILITY · v1</span><nav className="top-nav"><a className="top-link" href="#api">API docs</a><a className="top-link" href="/api/v1/keys">Public keys ↗</a></nav></header>
    <main id="main">
      <div className="intro"><div><p className="overline">TOOLS / TIMESTAMP</p><h1>File timestamp</h1><p>Create and verify signed timestamp receipts. Submit a file hash or let your browser calculate one.</p></div><div className="intro-meta"><span>HASH</span><strong>SHA-256</strong><span>SIGNATURE</span><strong>Ed25519</strong><span>TIME SOURCE</span><strong>Server clock · UTC</strong></div></div>
      <section className="workspace" aria-label="Timestamp tools">
        <div className="tool-panel"><div className="panel-title"><span className="panel-index">01</span><div><h2>Create receipt</h2><p>Submit a SHA-256 hash. The server sets the time and signs the receipt.</p></div></div>
          <div className="mode-tabs" role="group" aria-label="Hash input method"><button type="button" className={stampMode === "file" ? "active" : ""} aria-pressed={stampMode === "file"} onClick={() => changeStampMode("file")}>File</button><button type="button" className={stampMode === "hash" ? "active" : ""} aria-pressed={stampMode === "hash"} onClick={() => changeStampMode("hash")}>SHA-256 hash</button></div>
          {stampMode === "file" ? <div className="field-group"><span className="field-label">INPUT FILE <span>LOCAL ONLY</span></span><label className="file-input"><input type="file" onChange={event => void selectStampFile(event.target.files?.[0] ?? null)} /><span className="file-action">Choose file</span><span className="filename">{stampFile?.name ?? "No file selected"}</span></label><span className="field-hint">Any file type · 100 MB browser limit</span></div>
            : <div className="field-group"><label className="field-label" htmlFor="manual-hash">SHA-256 HASH <span>64 HEX CHARACTERS</span></label><input id="manual-hash" className="hash-input" value={stampHash} onChange={event => { setStampHash(event.target.value.trim().toLowerCase()); setReceipt(null); setStampError(""); }} placeholder="e3b0c44298fc1c149afbf4c8996fb924…" spellCheck={false} autoComplete="off" /><span className="field-hint">Enter the hash you calculated. The file itself is not checked here.</span></div>}
          {stampMode === "file" && (hashing || stampHash) && <div className="hash-preview"><span>{hashing ? "CALCULATING SHA-256…" : "FILE SHA-256"}</span>{stampHash && <code>{stampHash}</code>}</div>}
          <button className="action-button" type="button" disabled={!SHA256_RE.test(stampHash) || hashing || busy !== null} onClick={stamp}>{busy === "stamp" ? "Signing…" : "Create timestamp receipt"}<span aria-hidden="true">→</span></button>
          {stampError && <p className="notice error" role="alert"><strong>Error</strong>{stampError}</p>}
          {receipt && <div className="result" role="status"><div className="result-heading"><strong><span className="status-dot" /> Receipt signed</strong><button type="button" onClick={() => downloadReceipt(receipt, stampMode === "file" && stampFile ? stampFile.name : `sha256-${receipt.payload.hash.slice(0, 12)}`)}>Download JSON ↓</button></div><dl><dt>Issued at</dt><dd>{receipt.payload.issuedAt}</dd><dt>SHA-256</dt><dd className="hash-value">{receipt.payload.hash}</dd><dt>Key ID</dt><dd>{receipt.payload.keyId}</dd></dl></div>}
        </div>
        <div className="tool-panel"><div className="panel-title"><span className="panel-index">02</span><div><h2>Verify receipt</h2><p>Check the signature against a file or a SHA-256 hash. Verification runs locally.</p></div></div>
          <div className="mode-tabs" role="group" aria-label="Verification input method"><button type="button" className={verifyMode === "file" ? "active" : ""} aria-pressed={verifyMode === "file"} onClick={() => { setVerifyMode("file"); setVerifyResult(null); }}>File</button><button type="button" className={verifyMode === "hash" ? "active" : ""} aria-pressed={verifyMode === "hash"} onClick={() => { setVerifyMode("hash"); setVerifyResult(null); }}>SHA-256 hash</button></div>
          {verifyMode === "file" ? <div className="field-group"><span className="field-label">ORIGINAL FILE <span>LOCAL ONLY</span></span><label className="file-input"><input type="file" onChange={event => { setVerifyFile(event.target.files?.[0] ?? null); setVerifyResult(null); }} /><span className="file-action">Choose file</span><span className="filename">{verifyFile?.name ?? "No file selected"}</span></label></div>
            : <div className="field-group"><label className="field-label" htmlFor="verify-hash">SHA-256 HASH <span>64 HEX CHARACTERS</span></label><input id="verify-hash" className="hash-input" value={verifyHash} onChange={event => { setVerifyHash(event.target.value.trim().toLowerCase()); setVerifyResult(null); }} placeholder="e3b0c44298fc1c149afbf4c8996fb924…" spellCheck={false} autoComplete="off" /></div>}
          <div className="field-group"><span className="field-label">RECEIPT <span>.MOMENTO.JSON</span></span><label className="file-input"><input type="file" accept=".json,application/json" onChange={event => { setProofFile(event.target.files?.[0] ?? null); setVerifyResult(null); }} /><span className="file-action">Choose file</span><span className="filename">{proofFile?.name ?? "No receipt selected"}</span></label></div>
          <button className="action-button secondary" type="button" disabled={!(verifyMode === "file" ? verifyFile : SHA256_RE.test(verifyHash)) || !proofFile || busy !== null} onClick={verify}>{busy === "verify" ? "Verifying…" : "Verify signature and hash"}<span aria-hidden="true">→</span></button>
          {verifyResult && <div className={`result ${verifyResult.valid ? "" : "invalid"}`} role="status"><div className="result-heading"><strong><span className="status-dot" /> {verifyResult.valid ? "Valid receipt" : "Verification failed"}</strong></div><p>{verifyResult.message}</p>{verifyResult.receipt && <dl><dt>Issued at</dt><dd>{verifyResult.receipt.payload.issuedAt}</dd><dt>SHA-256</dt><dd className="hash-value">{verifyResult.receipt.payload.hash}</dd><dt>Key ID</dt><dd>{verifyResult.receipt.payload.keyId}</dd></dl>}</div>}
        </div>
        <div className="tool-panel inspect-panel"><div className="panel-title"><span className="panel-index">03</span><div><h2>Inspect receipt</h2><p>Read the signed time using only a receipt JSON. No original file or hashing required.</p></div></div>
          <div className="inspect-controls"><div className="field-group"><span className="field-label">RECEIPT <span>.MOMENTO.JSON</span></span><label className="file-input"><input type="file" accept=".json,application/json" onChange={event => { setInspectFile(event.target.files?.[0] ?? null); setInspectResult(null); }} /><span className="file-action">Choose file</span><span className="filename">{inspectFile?.name ?? "No receipt selected"}</span></label></div><button className="action-button secondary" type="button" disabled={!inspectFile || busy !== null} onClick={inspect}>{busy === "inspect" ? "Inspecting…" : "Inspect signed time"}<span aria-hidden="true">→</span></button></div>
          {inspectResult && <div className={`result ${inspectResult.valid ? "" : "invalid"}`} role="status"><div className="result-heading"><strong><span className="status-dot" /> {inspectResult.valid ? "Valid signature" : "Inspection failed"}</strong></div><p>{inspectResult.message}</p>{inspectResult.receipt && <><div className="time-display"><span>SERVER-SIGNED TIME · UTC</span><strong>{inspectResult.receipt.payload.issuedAt}</strong></div><dl><dt>SHA-256</dt><dd className="hash-value">{inspectResult.receipt.payload.hash}</dd><dt>Receipt ID</dt><dd>{inspectResult.receipt.payload.receiptId}</dd><dt>Key ID</dt><dd>{inspectResult.receipt.payload.keyId}</dd></dl></>}</div>}
        </div>
      </section>
      <section className="api-docs" id="api" aria-labelledby="api-title">
        <div className="api-heading"><div><p className="overline">FOR DEVELOPERS</p><h2 id="api-title">Public API</h2><p>No API key. Send a lowercase SHA-256 hash; the server adds its UTC time and signs the receipt. Files are never uploaded.</p></div><span className="api-version">v1 · JSON</span></div>
        <div className="api-grid">
          <div><h3><code>POST /api/v1/stamp</code></h3><p><code>Content-Type: application/json</code> · body contains exactly one field:</p><pre>{'{ "hash": "<64 lowercase hex characters>" }'}</pre><p>Returns <code>201</code> with <code>payload</code> and a base64url Ed25519 <code>signature</code>. The payload includes <code>version</code>, <code>hash</code>, <code>issuedAt</code> (ISO 8601 UTC), <code>receiptId</code> and <code>keyId</code>.</p></div>
          <div><h3>Example · JavaScript</h3><pre>{[
            `const response = await fetch("${apiBase}/api/v1/stamp", {`,
            '  method: "POST",',
            '  headers: { "Content-Type": "application/json" },',
            '  body: JSON.stringify({ hash: sha256Hex })',
            '});',
            'if (!response.ok) throw new Error(String(response.status));',
            'const receipt = await response.json();'
          ].join("\n")}</pre></div>
        </div>
        <div className="api-grid api-verify-grid">
          <div><h3><code>POST /api/v1/verify</code></h3><p>Send the SHA-256 of the file plus its receipt. Use one of these JSON bodies:</p><pre>{'{ "hash": sha256Hex, "receipt": { "payload": { … }, "signature": "…" } }\n{ "hash": sha256Hex, "receiptBase64": "<base64 receipt JSON>" }\n{ "hash": sha256Hex, "payload": { … }, "signature": "…" }'}</pre><p><code>receiptBase64</code> accepts standard or URL-safe Base64 of the entire UTF-8 receipt JSON. The original file stays on your device.</p></div>
          <div><h3>Example · JavaScript</h3><pre>{[
            `const response = await fetch("${apiBase}/api/v1/verify", {`,
            '  method: "POST",',
            '  headers: { "Content-Type": "application/json" },',
            '  body: JSON.stringify({ hash: sha256Hex, receipt })',
            '});',
            'if (!response.ok) throw new Error(String(response.status));',
            'const result = await response.json();',
            'if (result.valid) console.log(result.issuedAt);',
            'else console.error(result.reason);'
          ].join("\n")}</pre><p>A <code>200</code> response still needs <code>result.valid === true</code>. Failed checks return <code>valid: false</code> with <code>hash_mismatch</code>, <code>invalid_signature</code>, <code>unknown_key</code> or <code>invalid_receipt</code>.</p></div>
        </div>
        <div className="api-foot"><p><strong>Read endpoints</strong> <code>GET /api/v1/keys</code> returns the public Ed25519 keys; <code>GET /api/health</code> returns service status.</p><p><strong>Limits</strong> Signing: 30 requests/minute per client IP and 300/minute per Cloudflare location. Verification: 120/IP and 1,200/location. <code>429</code> includes <code>Retry-After: 60</code>. Invalid input returns <code>400</code>, oversized body <code>413</code>, wrong media type <code>415</code>.</p><p><strong>Verification</strong> The API checks the signature and compares the signed hash with your supplied hash. Offline verification remains available through the browser tool and CLI. <a href="https://github.com/MIKTHATGUY/momento#api-reference">Full protocol reference ↗</a></p></div>
      </section>
      <section className="hash-help" aria-label="Calculate a SHA-256 hash"><div><h2>Calculate the hash yourself</h2><p>Run a command on the original file, then compare its output with the SHA-256 shown in the receipt.</p></div><div className="hash-commands"><div><span>WINDOWS / POWERSHELL</span><code>Get-FileHash -Algorithm SHA256 "file.zip"</code></div><div><span>MACOS</span><code>shasum -a 256 file.zip</code></div><div><span>LINUX</span><code>sha256sum file.zip</code></div></div></section>
      <section className="technical-notes" aria-label="How it works"><div><h2>How it works</h2><p>Choose a file for local hashing or supply a SHA-256 hash yourself. The server receives only the hash, reads its clock and signs a receipt.</p></div><div><h2>Trust model</h2><p>The signature proves the receipt was issued by the holder of Momento's private key. The timestamp is Momento's claim about its server clock; it is not an independent time source.</p></div></section>
    </main>
    <footer><span>© {new Date().getFullYear()} Momento</span><span>SHA-256 / Ed25519 / UTC</span><a href="/api/v1/keys">Public keys ↗</a></footer>
  </div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
