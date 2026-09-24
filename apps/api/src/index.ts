import { Hono } from "hono";
import { cors } from "hono/cors";
import { KEY_ID, PROTOCOL_VERSION, PUBLIC_KEYS, bytesToBase64url, base64urlToBytes, isSha256Hex, signingBytes, verifyReceipt, type StampPayload, type StampReceipt } from "@momento/protocol";

type Bindings = {
  SIGNING_PRIVATE_KEY_BASE64URL: string;
  ASSETS: Fetcher;
  STAMP_CLIENT_LIMIT: RateLimit;
  STAMP_GLOBAL_LIMIT: RateLimit;
};
const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type"] }));

async function readSmallJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty_body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1024) {
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

app.get("/api/health", c => c.json({ ok: true }));
app.get("/api/v1/keys", c => c.json({ algorithm: "Ed25519", keys: PUBLIC_KEYS }));

app.post("/api/v1/stamp", async c => {
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
  } catch (error) {
    console.error("Rate limiting unavailable", error);
    return c.json({ error: "rate_limit_unavailable" }, 503);
  }
  if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) return c.json({ error: "unsupported_media_type" }, 415);
  if (Number(c.req.header("content-length") ?? 0) > 1024) return c.json({ error: "request_too_large" }, 413);
  let body: unknown;
  try { body = await readSmallJson(c.req.raw); }
  catch (error) { return error instanceof Error && error.message === "request_too_large" ? c.json({ error: "request_too_large" }, 413) : c.json({ error: "invalid_json" }, 400); }
  if (typeof body !== "object" || body === null || !isSha256Hex((body as Record<string, unknown>).hash) || Object.keys(body).length !== 1) {
    return c.json({ error: "invalid_hash" }, 400);
  }
  const privateKeyRaw = c.env.SIGNING_PRIVATE_KEY_BASE64URL;
  if (!privateKeyRaw || !PUBLIC_KEYS[KEY_ID] || PUBLIC_KEYS[KEY_ID].startsWith("REPLACE_")) return c.json({ error: "signing_not_configured" }, 503);

  try {
    const privateKey = await crypto.subtle.importKey("pkcs8", base64urlToBytes(privateKeyRaw), "Ed25519", false, ["sign"]);
    const payload: StampPayload = {
      version: PROTOCOL_VERSION,
      hash: (body as { hash: string }).hash,
      issuedAt: new Date(Date.now()).toISOString(),
      receiptId: bytesToBase64url(crypto.getRandomValues(new Uint8Array(16))),
      keyId: KEY_ID
    };
    const signature = bytesToBase64url(new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, signingBytes(payload))));
    const receipt: StampReceipt = { payload, signature };
    if (!(await verifyReceipt(receipt)).valid) return c.json({ error: "signing_key_mismatch" }, 503);
    return c.json(receipt, 201, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("Signing failed", error);
    return c.json({ error: "signing_failed" }, 500);
  }
});

app.all("/api/*", c => c.json({ error: "not_found" }, 404));

export default app;
