#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGitCommand } from "./git.js";
import { verifyReceipt, decodeReceiptText, readReceiptResponse, MAX_RECEIPT_BYTES } from "@mikthatguy/momento-protocol";

function usage(): never {
  console.error("Usage:\n  momento-timestamp stamp <file> [--api-url <url>]\n  momento-timestamp verify <receipt.json> <file>\n  momento-timestamp git init | stamp [commit] | sync [remote] | verify [--start-commit SHA]");
  process.exit(2);
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

const [command, first, second, third, ...extra] = process.argv.slice(2);
if (!command || !first) usage();
const invocationDirectory = process.env.INIT_CWD ?? process.cwd();

try {
  if (command === "git") {
    // Hooks run in Git's repository directory. npm's inherited INIT_CWD may
    // point to the installer/test runner's unrelated repository.
    await runGitCommand(process.argv.slice(3), first === 'hook' ? process.cwd() : invocationDirectory, fileURLToPath(import.meta.url));
  } else if (command === "stamp") {
    if (extra.length || (third && second !== "--api-url") || (second === "--api-url" && !third)) usage();
    const file = resolve(invocationDirectory, first);
    const hash = await hashFile(file);
    const api = (second === "--api-url" ? third : second) ?? process.env.MOMENTO_API_URL ?? "https://momento.mthatguy.workers.dev";
    const endpoint = new URL("/api/v2/stamp", api);
    if (!["http:", "https:"].includes(endpoint.protocol)) throw new Error("API URL must use HTTP or HTTPS.");
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash }), signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`Signing service: HTTP ${response.status}`);
    const receipt = await readReceiptResponse(response);
    const checked = await verifyReceipt(receipt, hash);
    if (!checked.valid) throw new Error(`The returned receipt is invalid: ${checked.reason}`);
    const output = `${file}.momento.json`;
    await writeFile(output, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    console.log(`Receipt: ${output}\nUTC time:  ${receipt.payload.issuedAt}\nSHA-256:  ${hash}`);
  } else if (command === "verify" && second && !third && !extra.length) {
    const receiptPath = resolve(invocationDirectory, first);
    if ((await stat(receiptPath)).size > MAX_RECEIPT_BYTES) throw new Error("Receipt limit: 8 KB.");
    const receipt = decodeReceiptText(await readFile(receiptPath, "utf8"));
    const hash = await hashFile(resolve(invocationDirectory, second));
    const checked = await verifyReceipt(receipt, hash);
    if (!checked.valid) throw new Error(checked.reason ?? "Invalid receipt");
    console.log(`Signature valid. The file matches.\nIssued at: ${checked.receipt!.payload.issuedAt}`);
  } else usage();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unexpected error");
  process.exitCode = 1;
}
