import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

export const SIGNATURE_ALGORITHM = "ML-DSA-65" as const;
export const PROTOCOL_VERSION = 2 as const;
export const KEY_ID = "momento-v2-ml-dsa65";
export const MAX_RECEIPT_BYTES = 8192;

// Trusted public verification keys. Preserve existing entries when rotating signing keys.
export const PUBLIC_KEYS: Record<string, string> = {
  "momento-v2-ml-dsa65": "SQSsT0oVmPSD5uvF_XnDVu_RYZdFlBFwP468vDV3yQY1dIKHaakxmEAksl5wfBEremWdcV06kYB1xCj75BTotqn9pPsndNGqCrmfljsgZzMMEq8f4iewr4unkzID95dMtbKa-oSn417J0hbLZjXHmp5fuM9jdmeeodViSLf1EgRqXDy-utEsqFH5cOxZH22s1uaw2v5D9RYdu93K1MkkaTK55BReNT8tMTN8oj1Du8iX8R0uy3uK1mGbg0fIJBnPu2yg7PxmDIYZLWOR1kNOG1gZr3ul4T406ng9-DyYPaQwsnjMNsLGaRxzlwxnwChv50dCVsFpeMHfspv3Ye52eM5ijS_khNBPsl-jmHotyYoiehZOm6Lx40J_tg5vX64_-HVHDMb7Ybpt3KSH554K1-JXJQhMYDhm7SaVC2QyjsCimtpmmG0M4BmLW6Ww327oae5RBC1uAQ1BmbyKl5BeDS7kQy5pQIuSExEz2OSYJi7OFSj4n3iSsrQHw352q1d266NO5vnhHyGrZ_kAkg1wW8LXdraiSOQ4KI5US8X7VzIc8noQW4cHUvFxR84F4vEuutyiO-3jzjHn9QxSN4L8aeuPYXV5qevAoahVOJQzkJZBD9PWS92eFExKLolNloKl6xj1ZnNnikTkBwzHn7oRCtK4aBP39wSI9YBBLCIIiYp2w3zJMbIQvlI1VZxZ9Lz1FlGohrRc0zZ9JJG5DDp4rB-RQOi63FVzOZV-6gBQ9S-zSvG6CSpPceQfveli-WkVdbFt6iApXFNfMT7oeqlXNyFm2OqI_OqXRAhubYLpW_kidYDYFVfebf5hDpkkOjA4CGPOzznMYPUdt9uDWDgMiTR-R2hGZoTivEZfQX_vLdb1aKFASBtNmCD-oMn5OwkjgCvKokKrji43pjp3J1M6bHQ6Gq7EKX1jlpfkHuIif5Koa05N6G1rpTZyV-E_vX0rYZsz_6gIN6iezaeWkJupL3ubExqBTmZFgJm8bYcOWUtAAuf-bk9fvRE66GOwLqYt8D_lI33HQ5G7Ty2NVDKwPpKDXoS9cPaE62tDpLKisbA7r64gW1FqBTYN7w5Wv3FE2NbLBG8Np91Zbwtfi-fcnsEnMuWa1juKmattBDEuOcWcMBLBiixLvYZ-LqqIOaM9mZSHuhdap_1_XDecW9R2kM8n1C6hG7Gcohb9EhBvtY0x5IJcqVa46bfcpumqMesUtLlldmLxe_CIUdGWyLOB6-03FV3ptDZAq66G57UB5On05_yV9WwFZyJeQ8A-f7xDT6wZVAnewG5Ho1fHLg-UqZwTK-iM-06bgmjB4sIi_c7QKRjSgh3qHtU5EoiY8kdO1J4--WxwwC5BLN0VrLce9Wfr-us2VYy4morALnmfB22ztsg26UYi9m5dhbsQLR9mro8f740nnNd8Orqzknxe5N0sej5NSDsvRPAufDRvtJbzdUBCuqcU7b2OOGIeKxKKhbWlG2dDzxmONFpTL9wd-QjaUBZJu7QbxLDOAcHW2FUoYbJKxtu3FizI9yS86eFE1CViMhXeoaVlfaPt-VIxSBuFtWqR8Qn5eDzX9XSrvWsTabTd4x0ulcD0gq1LcJTHgjKrwxZPXJO5k1VENdjWyvhz7x4jXAfAkQ_5Wbc7g1mqtH5QADRLe3DrxX9RwE5atB_fNaBGvVWocI5nEf2VQK7gWxAdOZUK9Fihbf3xFuLE0YpKyNcwx8ZROBjqtkfWwCLPQvCdrJTPoiuGyHGRI6c83GeecNxzJWw5TnmIGsmDGDqkimxF9l3yz9Fy9fyjEzvXBsXOo8AXKdFCMgsTi7T8I4m15bB2cIX7T3KXpXFnohEFrwXhAwlGAMk3X8wcPsQwuncN8QzlfSZQ8sN63yl2n2pZQoJ1W-iO5vUskL5LwXyQ2yBbn4Wfff7Wca15MNPL-W85soXkVjqrQvBRyM1o6dTSXjSXWmsmJQ1F-W0V9x1F5PyGukBfssxM4Swd96UIkXz6bbFhYq5d-6Ol-9SQuj0WwBlXmaZUrDI4Fd8PVPirVunLbVm1uUf3QM6L_qBIvv74BKOkPWrGy__FYR0nOgWWW7-SPYSwmGSLQeOWlg3zQ5sCdqoXX_vuz-vwVkBPSL2xbZ5APfH63gxQisnYDzVx0oZJVbhbXFJMgQV-3CoFFv1qbykRZ8YMUtiRofuMeHtlv33cYCdxG9qAh7kSWzZZE9E7muBHu7aTc7tANp1qHGmNi5Xa5Vdp5SdD2lzTkrw9qSg2hhcoVSLTZl602o-hlOSSHAWkFht6L_BiPiOTNW2Cbd0RruKA0D4SGCaS9cZRYZHOe3m24M0QoAXciWo1ffhPYd3S0GfdAVHKwobWT8OFXV9eOfk9tC8N8rUoT4YCIdFLDt_fgPoZNzFuKi68W9tkAYPvcHW1MS1ovzmk5HdOgrq2ru7XKTTePfg5DmPBhYoh-sE3Bf4ckpza7VHU8I_tqYNFf1b_rA4rxdnq3ewD7RVDbmKT628n6u6mCKxih2cND-jtTbcX_ChsSDgiWPwygBOL7HcUlC7CcNJRxjrOSWwJYhJZw7lQTOk7LnVeA7sFIE4-DCeF2keDHh0NSLSpV18PDXyRCUQ"
};

export const KEY_METADATA: Record<string, { status: "active" | "retired" | "compromised"; createdAt: string | null }> = {
  "momento-v2-ml-dsa65": { status: "active", createdAt: "2026-10-03T02:36:16.312Z" }
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
