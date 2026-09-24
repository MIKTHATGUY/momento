import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyReceipt, type StampReceipt } from "@momento/protocol";

function usage(): never {
  console.error("Uso:\n  npm run start -w @momento/cli -- stamp <file> [api-url]\n  npm run start -w @momento/cli -- verify <ricevuta.json> <file>");
  process.exit(2);
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

const [command, first, second] = process.argv.slice(2);
if (!command || !first) usage();
const invocationDirectory = process.env.INIT_CWD ?? process.cwd();

try {
  if (command === "stamp") {
    const file = resolve(invocationDirectory, first);
    const hash = await hashFile(file);
    const api = second ?? process.env.MOMENTO_API_URL ?? "http://127.0.0.1:8790";
    const response = await fetch(new URL("/api/v1/stamp", api), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash })
    });
    if (!response.ok) throw new Error(`Servizio di firma: HTTP ${response.status}`);
    const receipt = await response.json() as StampReceipt;
    const checked = await verifyReceipt(receipt, hash);
    if (!checked.valid) throw new Error(`La ricevuta ricevuta non è valida: ${checked.reason}`);
    const output = `${file}.momento.json`;
    await writeFile(output, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
    console.log(`Ricevuta: ${output}\nOra UTC:  ${receipt.payload.issuedAt}\nSHA-256:  ${hash}`);
  } else if (command === "verify" && second) {
    const receipt = JSON.parse(await readFile(resolve(invocationDirectory, first), "utf8")) as unknown;
    const hash = await hashFile(resolve(invocationDirectory, second));
    const checked = await verifyReceipt(receipt, hash);
    if (!checked.valid) throw new Error(checked.reason ?? "Ricevuta non valida");
    console.log(`Firma valida. Il file corrisponde.\nOra attestata: ${checked.receipt!.payload.issuedAt}`);
  } else usage();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Errore inatteso");
  process.exitCode = 1;
}
