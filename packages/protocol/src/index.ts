import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

export const SIGNATURE_ALGORITHM = "ML-DSA-65" as const;
export const PROTOCOL_VERSION = 2 as const;
export const KEY_ID = "momento-v2-ml-dsa65";
export const MAX_RECEIPT_BYTES = 8192;

// Trusted public verification keys. Preserve existing entries when rotating signing keys.
export const PUBLIC_KEYS: Record<string, string> = {
  "momento-v2-ml-dsa65": "yJu4eshlKRam8R_l3GCLvDP_6yYWxwSc07u9SESLUjfpJIXnTV3e7PaAiCSUEmgr7iCsHcaCI39k5Cdi5dXbK6Z3tPLIa_7Wvd8AggdnAq5kuFGYjdlJ5lPl2O0g1DRj3-DEJbXzYu39kB831m6dx1ujC0Ev6Gi658wnLkI2T0dDeK5UhHtswHywFCMCSO1E8AgRTHJOvJOzgYs25jcgXWWNSEKG1iKgaqaYdkA1xOs06o01asqKgECOFvMm98vMpdK5RxIkPk6CEAfc3UiLAbYBYHCaRhHRhiwHXD357yzEMP84iVdyOBrXAC8aODk3gbrKCeysRFNr0WbNPIQtgDcBrzpLzsYIK-K7pbihWnFPz1viUnsxsAjuyiafwOaK5BdEiha-tA5VXnY3tNANEtkq1Ju5uyUqmFPFYQdEVKScQJ4383GNv0hznVvpFzFYCXCl2t5gfKsYV0ryyFmjjnwmVSjy2WlaMboMBwUVzMnGaEptrcvYyPih4VJcGs69EevlYKx_OXk3P178Riqca476IwTCZbsZDxJ_OPMWnNsBhGTkh4nOraytNdNgcUL9SioJEbM7Fo_7mWq_npDj_Krbb_nLrZ972ChSRqYTl8ocuWXIzrNX5KsET8JZQWrSdY--o337VeURTd9h8ivktmdjnLg-6vNHKkk1-1onuj6yJ14zrAbeQ7YkfyPhCp5lXBHP2bklfpRvYmMDxNDCpzecHM_X9o8L7elrDxJhwM1_GTXslDvw4ubq6JECZTsC7SUCo3-Oo12VOJy1B3DF6qTQfLooc-15g4ht715ZdlVqZumWnHBreqQ6UQFS7bXW8QdTP7f30Nnf-0IHdo2jq3l8r0HfpByKILPqwGUZpmZNJ7wYjkmppKJT_0Yzi8q04uJZcBJE0-8P5veYRCLOTOfIcn1BBXzFjOpGcKm0W43AcTSdMNQWoOpgZ5ptFIgS4qIV0tgAt_omLEcRPUVvheMcpJu5cDAV1H3vrYzbuiJ4PgyAVU2rNrPP-p1hGdSWdoak4ZW-i8L6fVBKRwJkWOoNiUBk7KCV9wjgv9GN6qKM4WELS10pm1tbDSEqqm0U8B51VIe6KXE5SV3i7a_NnosfZdj1iE48gBsT2A6dfPS0CXSMdh3RLGiute6_1CDUmswXc7erWv347nKwGi6y0Lo0gOcD2JpNsoLAsfzBNeQY6bfYowxyNqbBNZYaC2vN0xg1svXncjqxsyynlzlAQk1X-bhAZ5SDGgx_IwMDiY0eobHF9yl3I1ZFuHa8pz6e2k-HiaNcZJAwWLUPkLoppQQnfKIA3e1NYZg860-acTQoLoD4ha31CX-0ncLmrbh5RsP6ktb2Bn3EiqlLDM-GQuN6FjUJpmPEl5VOewt9DU82N2ExIa_v5zsj7PrMeI1i7DAxxoXHtoe284E6hiHiqCcJUs8vWY9aCHTyVwBXS22vV0NiBRjSmE14jBeJf9kmnf0yNRh3weD0gBfdCmOTMmOl5QW_WnbF5dDDR9MynSbqKtPfGQVz27Ag0FxcHVgUD0g3_4qUhQXuP25RNTe8SMexGGcaj8J88oQdozAg9tvx_p_QG6OGN8-OrduiqaVqD0Zq5udKNTPWX7mZsw30w5ZC5TUK20Wz6H5ZxRrvquZrHKV92pshoFDyKwIcKWcSbmcYRHWxvFjnfhvCkGKkBQYUJLesmtGNC5y9B9_ue6WQ-48fAxCD_s_287ISW4CjsKNG0nZZq9eUb4nzrR0MXFXHzVM94HG1l6IrSIzJ-UPSHWfTDazaV-Ym3zDmxzgooDuUF7c6IwXqgjxufyT3hSEo4xMMnKOb3e3_y0rc0_aVqo1xlQHq2wYpxnY_mBWQkdH93TRmA-Vg4X12GKLLEhCzXvZ_tjxMBwNl164jDjHogFUUz9oEy98y0lyzQeRCkx3OtYu2_RPXtqAV4u9mZ75lnoN63ZmpgUtAuzLGz2L_-jceFZIGLQB6HUoyvMt0cW9U7wDEy7wihF_d3fAwXg0-ch6aTStCpXiKySQZt3uvu9YybnPakn3JUnTqBRvQE18kVE__sMF6MXaG4mPdWNV5MVoz_Zb4e7P7QYcNUDWAGrXS-Hf-OjG8X5spz_PKPYBW9m5iZ4RNMaa3RCSRLbmJ0AozeWok0DrOsIYRnMR87X-IlNa2HOAudYwMw538W7bovMcc7dHEkYTymLP3uYeWSsLhER3sLsSV9CgyKCdFIrYDBnWanI-4SuyEEQuMaEukAn_wPr8Irb7OJSRyrEg5zdanG4qUh7uy-PyjHPRcm-wRVY8QFrgqSqKcGKZnOIikaH2C45zFleIvIZnsaehMri1gtKfPiABGRSnRklaxlRYHvOGrl84-sAm68gXBz-QvXw_92waGl2x8gx4wIyppGNQJ31gUeAEEqB79WItVGdcMfgx-SWs9MD1EqaUOfuEUhBak9zbZqGbwdtypFWAryjoPZwAHsJLiQciL57FSHRcwGi2k1WnPqUbAazlADG3qM7gVxZLiCoHSQJCpmqIrEamjo5S2ePXQGAuH3lzWaeNVW3EXbjWhrIIJbyNSq6JmY2nMHmmlo7gEQncwOctXBdngYxn3Ib8JVwPlL-Q"
};

export const KEY_METADATA: Record<string, { status: "active" | "retired" | "compromised"; createdAt: string | null }> = {
  "momento-v2-ml-dsa65": { status: "active", createdAt: "2026-10-02T23:33:06.120Z" }
};

export async function publicKeyFingerprint(encodedKey: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", base64urlToBytes(encodedKey)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}

export interface StampPayload {
  version: 2;
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
    "Momento timestamp receipt v2 / ML-DSA-65",
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
  if (bytesToBase64url(bytes) !== value) throw new Error("Noncanonical base64url");
  return bytes;
}

export function decodeReceiptText(text: string): StampReceipt {
  if (encoder.encode(text).byteLength > MAX_RECEIPT_BYTES) throw new Error("Receipt limit: 8 KB.");
  return parseReceipt(JSON.parse(text));
}

export async function readReceiptResponse(response: Response): Promise<StampReceipt> {
  if (!response.body) throw new Error("Empty receipt response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_RECEIPT_BYTES) {
        await reader.cancel();
        throw new Error("Receipt limit: 8 KB.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return decodeReceiptText(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export function encodeReceiptFragment(receipt: StampReceipt): string {
  const text = JSON.stringify(parseReceipt(receipt));
  if (encoder.encode(text).byteLength > MAX_RECEIPT_BYTES) throw new Error("Receipt limit: 8 KB.");
  return bytesToBase64url(encoder.encode(text));
}

export function decodeReceiptFragment(fragment: string): StampReceipt {
  if (fragment.length > Math.ceil(MAX_RECEIPT_BYTES / 3) * 4) throw new Error("Receipt limit: 8 KB.");
  return decodeReceiptText(new TextDecoder("utf-8", { fatal: true }).decode(base64urlToBytes(fragment)));
}

export function parseReceipt(input: unknown): StampReceipt {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Invalid receipt");
  const receipt = input as Record<string, unknown>;
  if (Object.keys(receipt).sort().join(",") !== "payload,signature") throw new Error("Invalid receipt fields");
  if (typeof receipt.payload !== "object" || receipt.payload === null || Array.isArray(receipt.payload)) throw new Error("Invalid payload");
  const payload = receipt.payload as Record<string, unknown>;
  if (Object.keys(payload).sort().join(",") !== "hash,issuedAt,keyId,receiptId,version") throw new Error("Invalid payload fields");
  if (payload.version !== PROTOCOL_VERSION || !isSha256Hex(payload.hash)) throw new Error("Invalid payload");
  if (typeof payload.issuedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload.issuedAt) ||
      Number.isNaN(Date.parse(payload.issuedAt)) ||
      new Date(payload.issuedAt).toISOString() !== payload.issuedAt) throw new Error("Invalid timestamp");
  if (typeof payload.receiptId !== "string" || payload.receiptId.length !== 22 || base64urlToBytes(payload.receiptId).byteLength !== 16) throw new Error("Invalid receipt ID");
  if (typeof payload.keyId !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(payload.keyId)) throw new Error("Invalid key ID");
  if (typeof receipt.signature !== "string" || receipt.signature.length !== 4412 || base64urlToBytes(receipt.signature).byteLength !== 3309) throw new Error("Invalid signature");
  return { payload: payload as unknown as StampPayload, signature: receipt.signature };
}

export type VerificationReason = "hash_mismatch" | "unknown_key" | "invalid_signature" | "invalid_receipt";

export async function verifyReceipt(input: unknown, expectedHash?: string): Promise<{ valid: boolean; reason?: string; reasonCode?: VerificationReason; receipt?: StampReceipt }> {
  try {
    const receipt = parseReceipt(input);
    if (expectedHash !== undefined && receipt.payload.hash !== expectedHash) return { valid: false, reasonCode: "hash_mismatch", reason: "File hash does not match the receipt." };
    const encodedKey = Object.hasOwn(PUBLIC_KEYS, receipt.payload.keyId) ? PUBLIC_KEYS[receipt.payload.keyId] : undefined;
    if (Object.hasOwn(KEY_METADATA, receipt.payload.keyId) && KEY_METADATA[receipt.payload.keyId].status === "compromised") return { valid: false, reasonCode: "unknown_key", reason: "Signing key is marked compromised." };
    if (!encodedKey || encodedKey.startsWith("REPLACE_")) return { valid: false, reasonCode: "unknown_key", reason: "Unknown or unconfigured public key." };
    const key = base64urlToBytes(encodedKey);
    if (key.byteLength !== 1952) return { valid: false, reasonCode: "unknown_key", reason: "Invalid ML-DSA-65 public key." };
    const valid = ml_dsa65.verify(base64urlToBytes(receipt.signature), signingBytes(receipt.payload), key);
    return valid ? { valid: true, receipt } : { valid: false, reasonCode: "invalid_signature", reason: "Invalid signature." };
  } catch {
    return { valid: false, reasonCode: "invalid_receipt", reason: "Invalid receipt." };
  }
}
