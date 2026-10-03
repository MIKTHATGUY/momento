import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { describeRoute, openAPIRouteHandler, type GenerateSpecOptions } from "hono-openapi";
import { openapi } from "./openapi";
import { loadChangelog, releasesMarkdown, RELEASES_URL } from './releases';
import { KEY_ID, KEY_METADATA, PROTOCOL_VERSION, PUBLIC_KEYS, publicKeyFingerprint, bytesToBase64url, base64urlToBytes, isSha256Hex, signingBytes, verifyReceipt, type StampPayload, type StampReceipt } from "@mikthatguy/momento-protocol";

type Bindings = {
  ML_DSA65_PRIVATE_KEY_BASE64URL: string;
  ASSETS: Fetcher;
  STAMP_CLIENT_LIMIT: RateLimit;
  STAMP_GLOBAL_LIMIT: RateLimit;
  VERIFY_CLIENT_LIMIT: RateLimit;
  VERIFY_GLOBAL_LIMIT: RateLimit;
};
const app = new Hono<{ Bindings: Bindings; Variables: { requestId: string } }>();

app.use("/api/*", async (c, next) => {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  c.header("Cache-Control", "no-store");
  await next();
  const path = ["/api/releases", "/api/health", "/api/ready", "/api/v2/keys", "/api/v2/stamp", "/api/v2/verify", "/api/openapi.json"].includes(c.req.path) ? c.req.path : "other";
  console.log(JSON.stringify({ event: "api_request", requestId, method: c.req.method, path, status: c.res.status, durationMs: Math.round(performance.now() - started), rateLimited: c.res.status === 429 }));
});
app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type"], exposeHeaders: ["X-Request-ID", "Retry-After"] }));

// The Worker secret holds the 32-byte ML-DSA-65 seed as canonical unpadded
// Base64url (43 characters). The 4032-byte expanded private key is derived in
// memory at signing time: it does not fit Cloudflare's secret size limit, so
// expanded values are rejected. Anything else fails closed as unconfigured.
const ML_DSA65_SEED_BYTES = 32;
let expandedKey: { seedValue: string; secretKey: Uint8Array } | undefined;
function signingKey(seedValue: string): Uint8Array {
  if (expandedKey?.seedValue !== seedValue) {
    const seed = base64urlToBytes(seedValue);
    if (seed.byteLength !== ML_DSA65_SEED_BYTES) throw new Error("invalid_seed");
    expandedKey = { seedValue, secretKey: ml_dsa65.keygen(seed).secretKey };
  }
  return expandedKey.secretKey;
}

// Cache a self-test briefly per isolate, including in-flight checks. Never publish key material.
let readiness: { privateValue: string; publicValue: string; expiresAt: number; result: Promise<boolean> } | undefined;
async function signingReady(privateValue: string, publicValue: string): Promise<boolean> {
  if (!readiness || readiness.privateValue !== privateValue || readiness.publicValue !== publicValue || readiness.expiresAt <= Date.now()) {
    const result = (async () => {
      try {
        const privateKey = signingKey(privateValue);
        const publicKey = base64urlToBytes(publicValue);
        const challenge = new TextEncoder().encode("Momento readiness self-test v2 / ML-DSA-65");
        const signature = ml_dsa65.sign(challenge, privateKey);
        return ml_dsa65.verify(signature, challenge, publicKey);
      } catch { return false; }
    })();
    readiness = { privateValue, publicValue, expiresAt: Date.now() + 30_000, result };
  }
  return readiness.result;
}

async function readSmallJson(request: Request, maxBytes = 1024): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty_body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function decodeReceiptBase64(value: string): unknown {
  if (!/^(?:[A-Za-z0-9+/]+={0,2}|[A-Za-z0-9_-]+)$/.test(value) || value.length > 8192) throw new Error("invalid_receipt_encoding");
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").replace(/=+$/, "");
  const bytes = Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")), char => char.charCodeAt(0));
  if (btoa(String.fromCharCode(...bytes)).replace(/=+$/, "") !== normalized) throw new Error("invalid_receipt_encoding");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export const openapiOptions: Partial<GenerateSpecOptions> = {
  documentation: {
    openapi: openapi.openapi,
    info: openapi.info,
    servers: openapi.servers,
    components: openapi.components,
  },
  exclude: ['/api/openapi.json', '/api/*'],
};

app.get("/api/health", describeRoute(openapi.paths['/api/health'].get), c => c.json({ ok: true }));
app.get('/api/releases', async c => {
  try {
    const releases = await loadChangelog();
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ releases, source: RELEASES_URL });
  } catch {
    return c.json({ error: 'releases_unavailable' }, 503, { 'Cache-Control': 'no-store', 'Retry-After': '60' });
  }
});
app.get('/api/releases/markdown', async c => {
  try {
    const markdown = releasesMarkdown(await loadChangelog());
    c.header('Cache-Control', 'public, max-age=300');
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    return c.body(markdown);
  } catch {
    return c.text('Release notes are temporarily unavailable.', 503, { 'Cache-Control': 'no-store', 'Retry-After': '60' });
  }
});
app.get("/api/ready", describeRoute(openapi.paths['/api/ready'].get), async c => {
  const configured = c.env?.ML_DSA65_PRIVATE_KEY_BASE64URL && PUBLIC_KEYS[KEY_ID] && KEY_METADATA[KEY_ID]?.status === "active";
  const bindings = [c.env?.STAMP_CLIENT_LIMIT, c.env?.STAMP_GLOBAL_LIMIT, c.env?.VERIFY_CLIENT_LIMIT, c.env?.VERIFY_GLOBAL_LIMIT].every(limit => typeof limit?.limit === "function");
  const ready = Boolean(configured && bindings && await signingReady(c.env.ML_DSA65_PRIVATE_KEY_BASE64URL, PUBLIC_KEYS[KEY_ID]));
  return c.json({ ready }, ready ? 200 : 503);
});
app.get("/api/openapi.json", openAPIRouteHandler(app, openapiOptions));
app.get("/api/v2/keys", describeRoute(openapi.paths['/api/v2/keys'].get), async c => {
  const metadata = Object.fromEntries(await Promise.all(Object.entries(PUBLIC_KEYS).map(async ([id, value]) => [id, {
    createdAt: KEY_METADATA[id]?.createdAt ?? null,
    status: KEY_METADATA[id]?.status ?? (id === KEY_ID ? "active" : "retired"),
    fingerprint: await publicKeyFingerprint(value), fingerprintAlgorithm: "sha256-ml-dsa65-raw"
  }])));
  return c.json({ algorithm: "ML-DSA-65", keys: PUBLIC_KEYS, metadata });
});

app.post("/api/v2/stamp", describeRoute(openapi.paths['/api/v2/stamp'].post), async c => {
  // Only Cloudflare's client-IP header is trusted. A shared fallback limits
  // requests in local development, where Cloudflare does not set the header.
  const client = c.req.header("cf-connecting-ip") ?? "unknown";
  try {
    const [global, perClient] = await Promise.all([
      c.env.STAMP_GLOBAL_LIMIT.limit({ key: "stamp" }),
      c.env.STAMP_CLIENT_LIMIT.limit({ key: client })
    ]);
    if (!global.success || !perClient.success) {
      return c.json({ error: "rate_limited" }, 429, { "Retry-After": "60", "Cache-Control": "no-store" });
    }
  } catch {
    return c.json({ error: "rate_limit_unavailable" }, 503);
  }
  if (c.req.header("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return c.json({ error: "unsupported_media_type" }, 415);
  if (Number(c.req.header("content-length") ?? 0) > 1024) return c.json({ error: "request_too_large" }, 413);
  let body: unknown;
  try { body = await readSmallJson(c.req.raw); }
  catch (error) { return error instanceof Error && error.message === "request_too_large" ? c.json({ error: "request_too_large" }, 413) : c.json({ error: "invalid_json" }, 400); }
  if (typeof body !== "object" || body === null || !isSha256Hex((body as Record<string, unknown>).hash) || Object.keys(body).length !== 1) {
    return c.json({ error: "invalid_hash" }, 400);
  }
  const privateKeyRaw = c.env.ML_DSA65_PRIVATE_KEY_BASE64URL;
  if (!privateKeyRaw || !PUBLIC_KEYS[KEY_ID] || PUBLIC_KEYS[KEY_ID].startsWith("REPLACE_") || KEY_METADATA[KEY_ID]?.status !== "active") return c.json({ error: "signing_not_configured" }, 503);

  let privateKey: Uint8Array;
  try { privateKey = signingKey(privateKeyRaw); }
  catch { return c.json({ error: "signing_not_configured" }, 503); }
  try {
    const payload: StampPayload = {
      version: PROTOCOL_VERSION,
      hash: (body as { hash: string }).hash,
      issuedAt: new Date(Date.now()).toISOString(),
      receiptId: bytesToBase64url(crypto.getRandomValues(new Uint8Array(16))),
      keyId: KEY_ID
    };
    const signature = bytesToBase64url(ml_dsa65.sign(signingBytes(payload), privateKey));
    const receipt: StampReceipt = { payload, signature };
    if (!(await verifyReceipt(receipt)).valid) return c.json({ error: "signing_key_mismatch" }, 503);
    return c.json(receipt, 201, { "Cache-Control": "no-store" });
  } catch {
    return c.json({ error: "signing_failed" }, 500);
  }
});

app.post("/api/v2/verify", describeRoute(openapi.paths['/api/v2/verify'].post), async c => {
  const client = c.req.header("cf-connecting-ip") ?? "unknown";
  try {
    const [global, perClient] = await Promise.all([
      c.env.VERIFY_GLOBAL_LIMIT.limit({ key: "verify" }),
      c.env.VERIFY_CLIENT_LIMIT.limit({ key: client })
    ]);
    if (!global.success || !perClient.success) return c.json({ error: "rate_limited" }, 429, { "Retry-After": "60", "Cache-Control": "no-store" });
  } catch {
    return c.json({ error: "rate_limit_unavailable" }, 503);
  }
  if (c.req.header("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return c.json({ error: "unsupported_media_type" }, 415);
  if (Number(c.req.header("content-length") ?? 0) > 8192) return c.json({ error: "request_too_large" }, 413);
  let body: unknown;
  try { body = await readSmallJson(c.req.raw, 8192); }
  catch (error) { return error instanceof Error && error.message === "request_too_large" ? c.json({ error: "request_too_large" }, 413) : c.json({ error: "invalid_json" }, 400); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return c.json({ error: "invalid_request" }, 400);
  const input = body as Record<string, unknown>;
  if (!isSha256Hex(input.hash)) return c.json({ error: "invalid_hash" }, 400);
  const fields = Object.keys(input).sort().join(",");
  let receipt: unknown;
  if (fields === "hash,receipt") receipt = input.receipt;
  else if (fields === "hash,payload,signature") receipt = { payload: input.payload, signature: input.signature };
  else if (fields === "hash,receiptBase64" && typeof input.receiptBase64 === "string") {
    try { receipt = decodeReceiptBase64(input.receiptBase64); }
    catch { return c.json({ error: "invalid_receipt_encoding" }, 400); }
  } else return c.json({ error: "invalid_request" }, 400);

  const result = await verifyReceipt(receipt, input.hash);
  if (!result.valid || !result.receipt) return c.json({ valid: false, reason: result.reasonCode }, 200, { "Cache-Control": "no-store" });
  const { payload } = result.receipt;
  return c.json({ valid: true, hash: payload.hash, issuedAt: payload.issuedAt, receiptId: payload.receiptId, keyId: payload.keyId }, 200, { "Cache-Control": "no-store" });
});

app.all("/api/*", c => c.json({ error: "not_found" }, 404));

export default app;
