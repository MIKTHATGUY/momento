import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import app from "../apps/api/src/index.ts";
import { KEY_ID, PUBLIC_KEYS, verifyReceipt } from "../packages/protocol/src/index.ts";

function limitBindings(allowClient = true, allowGlobal = true) {
  return {
    STAMP_CLIENT_LIMIT: { limit: async () => ({ success: allowClient }) },
    STAMP_GLOBAL_LIMIT: { limit: async () => ({ success: allowGlobal }) }
  };
}

test("the Worker signs only a supplied hash with its own timestamp; verification is offline", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const previous = PUBLIC_KEYS[KEY_ID];
  PUBLIC_KEYS[KEY_ID] = publicKey.export({ format: "der", type: "spki" }).toString("base64url");
  const env = { SIGNING_PRIVATE_KEY_BASE64URL: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url"), ...limitBindings() };
  const hash = "a".repeat(64);
  try {
    const before = Date.now();
    const response = await app.request("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash }) }, env);
    const after = Date.now();
    assert.equal(response.status, 201);
    const receipt = await response.json() as Record<string, any>;
    assert.equal(receipt.payload.hash, hash);
    assert.ok(Date.parse(receipt.payload.issuedAt) >= before && Date.parse(receipt.payload.issuedAt) <= after);
    assert.equal((await verifyReceipt(receipt, hash)).valid, true);
    assert.equal((await verifyReceipt(receipt, "b".repeat(64))).valid, false);
    receipt.payload.issuedAt = "2020-01-01T00:00:00.000Z";
    assert.equal((await verifyReceipt(receipt, hash)).valid, false);
  } finally { PUBLIC_KEYS[KEY_ID] = previous; }
});

test("the API rejects a client-supplied time and malformed hashes", async () => {
  const invalid = await app.request("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash: "a".repeat(64), issuedAt: "2020-01-01T00:00:00.000Z" }) }, limitBindings());
  assert.equal(invalid.status, 400);
  const malformed = await app.request("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash: "not-a-hash" }) }, limitBindings());
  assert.equal(malformed.status, 400);
  const huge = await app.request("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash: "a".repeat(64), padding: "x".repeat(2000) }) }, limitBindings());
  assert.equal(huge.status, 413);
});

test("the Worker refuses to issue receipts when its secret does not match the published key", async () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const env = { SIGNING_PRIVATE_KEY_BASE64URL: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url"), ...limitBindings() };
  const response = await app.request("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash: "a".repeat(64) }) }, env);
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { error: string }).error, "signing_key_mismatch");
});

test("the public API allows browser clients and rejects abusive signing traffic", async () => {
  const preflight = await app.request("/api/v1/stamp", { method: "OPTIONS", headers: { Origin: "https://example.org", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Content-Type" } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");

  const denied = await app.request("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.5" }, body: JSON.stringify({ hash: "a".repeat(64) }) }, limitBindings(false));
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get("retry-after"), "60");
  assert.equal((await denied.json() as { error: string }).error, "rate_limited");

  const globalDenied = await app.request("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hash: "a".repeat(64) }) }, limitBindings(true, false));
  assert.equal(globalDenied.status, 429);
  const wrongType = await app.request("/api/v1/stamp", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hello" }, limitBindings());
  assert.equal(wrongType.status, 415);
});
