export const PROTOCOL_VERSION = 1 as const;
export const KEY_ID = "momento-v1";

// Replace this value with the output of `npm run keygen` before public deployment.
export const PUBLIC_KEYS: Record<string, string> = {
  "momento-v1": "MCowBQYDK2VwAyEAAcbwYsDh_3bJ7mAHlOeW4rVbf3eKTvbdNctdKqfZ5ak"
};

export interface StampPayload {
  version: 1;
  hash: string;
  issuedAt: string;
  receiptId: string;
  keyId: string;
}

export interface StampReceipt {
  payload: StampPayload;
  signature: string;
}

const encoder = new TextEncoder();
const HASH_RE = /^[0-9a-f]{64}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && HASH_RE.test(value);
}

export function signingBytes(payload: StampPayload): Uint8Array<ArrayBuffer> {
  // A fixed tuple avoids JSON property-order ambiguity and separates this signature
  // from signatures made for any other purpose with the same key.
  return new Uint8Array(encoder.encode(JSON.stringify([
    "Momento timestamp receipt v1",
    payload.version,
    payload.hash,
    payload.issuedAt,
    payload.receiptId,
    payload.keyId
  ])));
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!BASE64URL_RE.test(value)) throw new Error("Invalid base64url");
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function parseReceipt(input: unknown): StampReceipt {
  if (typeof input !== "object" || input === null) throw new Error("Invalid receipt");
  const receipt = input as Record<string, unknown>;
  if (Object.keys(receipt).sort().join(",") !== "payload,signature") throw new Error("Invalid receipt fields");
  if (typeof receipt.payload !== "object" || receipt.payload === null) throw new Error("Invalid payload");
  const payload = receipt.payload as Record<string, unknown>;
  if (Object.keys(payload).sort().join(",") !== "hash,issuedAt,keyId,receiptId,version") throw new Error("Invalid payload fields");
  if (payload.version !== PROTOCOL_VERSION || !isSha256Hex(payload.hash)) throw new Error("Invalid payload");
  if (typeof payload.issuedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload.issuedAt) ||
      Number.isNaN(Date.parse(payload.issuedAt)) ||
      new Date(payload.issuedAt).toISOString() !== payload.issuedAt) throw new Error("Invalid timestamp");
  if (typeof payload.receiptId !== "string" || !BASE64URL_RE.test(payload.receiptId) || base64urlToBytes(payload.receiptId).byteLength !== 16) throw new Error("Invalid receipt ID");
  if (typeof payload.keyId !== "string" || !payload.keyId) throw new Error("Invalid key ID");
  if (typeof receipt.signature !== "string" || !BASE64URL_RE.test(receipt.signature) || base64urlToBytes(receipt.signature).byteLength !== 64) throw new Error("Invalid signature");
  return { payload: payload as unknown as StampPayload, signature: receipt.signature };
}

export async function verifyReceipt(input: unknown, expectedHash?: string): Promise<{ valid: boolean; reason?: string; receipt?: StampReceipt }> {
  try {
    const receipt = parseReceipt(input);
    if (expectedHash !== undefined && receipt.payload.hash !== expectedHash) return { valid: false, reason: "Il file non corrisponde alla ricevuta." };
    const encodedKey = PUBLIC_KEYS[receipt.payload.keyId];
    if (!encodedKey || encodedKey.startsWith("REPLACE_")) return { valid: false, reason: "Chiave pubblica sconosciuta o non configurata." };
    const key = await crypto.subtle.importKey("spki", base64urlToBytes(encodedKey), "Ed25519", false, ["verify"]);
    const valid = await crypto.subtle.verify("Ed25519", key, base64urlToBytes(receipt.signature), signingBytes(receipt.payload));
    return valid ? { valid: true, receipt } : { valid: false, reason: "Firma non valida." };
  } catch {
    return { valid: false, reason: "Ricevuta non valida." };
  }
}
