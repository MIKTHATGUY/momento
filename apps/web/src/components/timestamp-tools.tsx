"use client";

import React, { useRef, useState } from "react";
import styles from './timestamp-tools.module.css';
import { verifyReceipt, type StampReceipt } from "@momento/protocol";


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

export default function TimestampTools() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "https://momento.mthatguy.workers.dev";
  const [activeTool, setActiveTool] = useState("create");
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
      const response = await fetch(`${apiBase}/api/v1/stamp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash }) });
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

  return <div className={styles.workbench}>
    <div className={styles.tabs} role="group" aria-label="Timestamp tools">
      {(['create', 'verify', 'inspect'] as const).map((tool, index) => <button key={tool} type="button" aria-pressed={activeTool === tool} aria-controls={`${tool}-panel`} onClick={() => setActiveTool(tool)}><span>0{index + 1}</span> {tool === 'create' ? 'Create receipt' : tool === 'verify' ? 'Verify receipt' : 'Inspect receipt'}</button>)}
    </div>
    <section className={styles.panel} id="create-panel" hidden={activeTool !== 'create'} aria-labelledby="create">
    <h3 id="create">Create a timestamp receipt</h3>
    <p>Submit a SHA-256 hash. The server sets the time and signs the receipt.</p>
    <div className={styles.controls}>
      <ModePicker value={stampMode} onChange={changeStampMode} label="Create input method" disabled={busy !== null} />
      {stampMode === 'file' ? <FilePicker label="Input file" file={stampFile} onChange={file => void selectStampFile(file)} disabled={busy !== null} /> : <HashInput value={stampHash} onChange={value => { setStampHash(value); setReceipt(null); setStampError(''); }} disabled={busy !== null} />}
      <p className={styles.hint}>{stampMode === 'file' ? 'Local only · Any file type · Up to 100 MB' : 'Enter 64 hexadecimal characters. The original file is not checked here.'}</p>
    </div>
    {stampMode === 'file' && (hashing || stampHash) && <ToolResult title={hashing ? 'Calculating SHA-256…' : 'File SHA-256'}><code className="break-all">{stampHash}</code></ToolResult>}
    <button className={styles.action} type="button" disabled={!SHA256_RE.test(stampHash) || hashing || busy !== null} onClick={stamp}>{busy === 'stamp' ? 'Signing…' : 'Create timestamp receipt'}</button>
    {stampError && <ToolResult type="error" title="Error" role="alert">{stampError}</ToolResult>}
    {receipt && <ToolResult type="success" title="Receipt signed" role="status"><ReceiptDetails receipt={receipt} /><button className={styles.download} type="button" onClick={() => downloadReceipt(receipt, stampMode === 'file' && stampFile ? stampFile.name : 'sha256-' + receipt.payload.hash.slice(0,12))}>Download JSON</button></ToolResult>}

    </section>
    <section className={styles.panel} id="verify-panel" hidden={activeTool !== "verify"} aria-labelledby="verify">
    <h3 id="verify">Verify a receipt</h3>
    <p>Check the signature against a file or a SHA-256 hash. Verification runs locally.</p>
    <div className={styles.controls}>
      <ModePicker value={verifyMode} onChange={mode => { setVerifyMode(mode); setVerifyResult(null); }} label="Verification input method" disabled={busy !== null} />
      {verifyMode === 'file' ? <FilePicker label="Original file" file={verifyFile} onChange={file => { setVerifyFile(file); setVerifyResult(null); }} disabled={busy !== null} /> : <HashInput value={verifyHash} onChange={value => { setVerifyHash(value); setVerifyResult(null); }} disabled={busy !== null} />}
      <FilePicker label="Receipt" file={proofFile} accept=".json,application/json" onChange={file => { setProofFile(file); setVerifyResult(null); }} disabled={busy !== null} />
    </div>
    <button className={styles.action} type="button" disabled={!(verifyMode === 'file' ? verifyFile : SHA256_RE.test(verifyHash)) || !proofFile || busy !== null} onClick={verify}>{busy === 'verify' ? 'Verifying…' : 'Verify signature and hash'}</button>
    {verifyResult && <ToolResult type={verifyResult.valid ? 'success' : 'error'} title={verifyResult.valid ? 'Valid receipt' : 'Verification failed'} role="status"><p>{verifyResult.message}</p>{verifyResult.receipt && <ReceiptDetails receipt={verifyResult.receipt} />}</ToolResult>}

    </section>
    <section className={styles.panel} id="inspect-panel" hidden={activeTool !== "inspect"} aria-labelledby="inspect">
    <h3 id="inspect">Inspect a receipt</h3>
    <p>Read the signed time using only a receipt JSON. No original file or hashing required.</p>
    <div className={styles.controls}><FilePicker label="Receipt" file={inspectFile} accept=".json,application/json" onChange={file => { setInspectFile(file); setInspectResult(null); }} disabled={busy !== null} /></div>
    <button className={styles.action} type="button" disabled={!inspectFile || busy !== null} onClick={inspect}>{busy === 'inspect' ? 'Inspecting…' : 'Inspect signed time'}</button>
    {inspectResult && <ToolResult type={inspectResult.valid ? 'success' : 'error'} title={inspectResult.valid ? 'Valid signature' : 'Inspection failed'} role="status"><p>{inspectResult.message}</p>{inspectResult.receipt && <ReceiptDetails receipt={inspectResult.receipt} />}</ToolResult>}
    </section>
    <aside className={styles.guide} aria-label="How this tool works">
      <p className={styles.guideLabel}>{activeTool === 'create' ? 'FROM FILE TO PROOF' : activeTool === 'verify' ? 'CHECK YOUR PROOF' : 'INSIDE THE RECEIPT'}</p>
      <ol>{(activeTool === 'create' ? [
        ['Choose your input', 'Pick a file to hash locally, or paste a SHA-256 fingerprint.'],
        ['Capture the moment', 'The server signs the hash and its current time.'],
        ['Keep the receipt', 'Download your JSON proof and save it with the original.'],
      ] : activeTool === 'verify' ? [
        ['Add the original', 'Choose your file or enter the hash you want to check.'],
        ['Add the receipt', 'Select the JSON proof saved when it was timestamped.'],
        ['Check the match', 'Verify the signature and compare the fingerprint locally.'],
      ] : [
        ['Open a receipt', 'Choose a Momento JSON receipt from your device.'],
        ['Check its signature', 'Verify the receipt using the configured public key.'],
        ['Read the signed time', 'See the timestamp and hash. This does not check a file.'],
      ]).map(([title, description]) => <li key={title}><strong>{title}</strong><p>{description}</p></li>)}</ol>
      <p className={styles.guideNote}>Your files stay on your device.<br />Only a hash is sent when creating a receipt.</p>
    </aside>
  </div>;
}

function ReceiptDetails({ receipt }: { receipt: StampReceipt }) {
  return <dl className={styles.details}><dt>Issued at (UTC)</dt><dd>{receipt.payload.issuedAt}</dd><dt>SHA-256</dt><dd className="break-all">{receipt.payload.hash}</dd><dt>Receipt ID</dt><dd className="break-all">{receipt.payload.receiptId}</dd><dt>Key ID</dt><dd>{receipt.payload.keyId}</dd></dl>;
}

function ModePicker({ value, onChange, label, disabled }: { value: 'file' | 'hash'; onChange: (value: 'file' | 'hash') => void; label: string; disabled: boolean }) {
  return <div className={styles.modes} role="group" aria-label={label}>{(['file', 'hash'] as const).map(mode => <button key={mode} type="button" disabled={disabled} aria-pressed={value === mode} onClick={() => onChange(mode)}>{mode === 'file' ? 'File' : 'SHA-256 hash'}</button>)}</div>;
}

function FilePicker({ label, file, onChange, accept, disabled }: { label: string; file: File | null; onChange: (file: File | null) => void; accept?: string; disabled: boolean }) {
  return <label className={styles.field}><span>{label}</span><span className={styles.file}><input type="file" accept={accept} disabled={disabled} onChange={event => onChange(event.target.files?.[0] ?? null)} /><span className={styles.choose}>Choose file</span><span className={styles.filename}>{file?.name ?? 'No file selected'}</span></span></label>;
}

function HashInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className={styles.field}><span>SHA-256 hash</span><input className={styles.hash} value={value} disabled={disabled} onChange={event => onChange(event.target.value.trim().toLowerCase())} placeholder="64 hexadecimal characters" spellCheck={false} autoComplete="off" /></label>;
}

function ToolResult({ title, type = 'info', children, role = 'status' }: { title: string; type?: 'info' | 'success' | 'error'; children: React.ReactNode; role?: 'status' | 'alert' }) {
  return <div className={styles.result} data-type={type} role={role}><strong>{title}</strong><div>{children}</div></div>;
}

