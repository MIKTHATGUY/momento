import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const protocolFile = resolve(root, "packages/protocol/src/index.ts");
const secretFile = resolve(root, "apps/api/.dev.vars");
const placeholder = "REPLACE_WITH_SPKI_BASE64URL";
const source = readFileSync(protocolFile, "utf8");
if (!source.includes(placeholder) || existsSync(secretFile)) {
  console.error("A key is already configured. Rotate keys manually to preserve old receipts.");
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const base64url = bytes => Buffer.from(bytes).toString("base64url");
const publicValue = base64url(publicKey.export({ format: "der", type: "spki" }));
const privateValue = base64url(privateKey.export({ format: "der", type: "pkcs8" }));
writeFileSync(secretFile, `SIGNING_PRIVATE_KEY_BASE64URL="${privateValue}"\n`, { mode: 0o600, flag: "wx" });
writeFileSync(protocolFile, source.replace(placeholder, publicValue));
console.log("Key generated. Public key added to protocol; private key saved only in apps/api/.dev.vars.");
console.log("For deployment, set SIGNING_PRIVATE_KEY_BASE64URL as a Cloudflare Worker secret using the value in apps/api/.dev.vars.");
