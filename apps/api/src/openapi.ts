import type { DescribeRouteOptions, GenerateSpecOptions } from 'hono-openapi';

export const openapi: GenerateSpecOptions['documentation'] & {
  paths: {
    '/api/health': { get: DescribeRouteOptions };
    '/api/v1/keys': { get: DescribeRouteOptions };
    '/api/v1/stamp': { post: DescribeRouteOptions };
    '/api/v1/verify': { post: DescribeRouteOptions };
  };
} = {
  "openapi": "3.1.0",
  "info": {
    "title": "Momento API",
    "version": "1.0.0",
    "description": "Signed timestamps for SHA-256 hashes. No authentication is required. Files stay on your device; send only their hashes."
  },
  "servers": [{ "url": "https://momento.mthatguy.workers.dev", "description": "Public API" }],
  "paths": {
    "/api/health": {
      "get": {
        "operationId": "getHealth", "summary": "Check service health",
        "description": "Checks that the API responds, not signing configuration or rate-limit availability.",
        "responses": { "200": { "description": "Service responds", "content": { "application/json": { "schema": { "type": "object", "required": ["ok"], "properties": { "ok": { "type": "boolean", "const": true } } } } } } }
      }
    },
    "/api/v1/keys": {
      "get": {
        "operationId": "getPublicKeys", "summary": "Get public signing keys",
        "responses": { "200": { "description": "Ed25519 public keys, indexed by key ID", "content": { "application/json": { "schema": { "type": "object", "required": ["algorithm", "keys"], "properties": { "algorithm": { "type": "string", "const": "Ed25519" }, "keys": { "type": "object", "additionalProperties": { "type": "string", "description": "Base64url-encoded SPKI DER public key" } } } } } } } }
      }
    },
    "/api/v1/stamp": {
      "post": {
        "operationId": "createStamp", "summary": "Create a timestamp",
        "description": "Signs a SHA-256 hash with the current server time. JSON body limit: 1,024 bytes. Only hash is accepted. Rate limits: 30 requests/minute per client IP and 300 per Cloudflare location. Responses are not stored by the service.",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "required": ["hash"], "additionalProperties": false, "properties": { "hash": { "$ref": "#/components/schemas/Hash" } } } } } },
        "responses": {
          "201": { "description": "Signed receipt. Cache-Control: no-store.", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Receipt" } } } },
          "400": { "description": "invalid_json or invalid_hash", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
          "413": { "$ref": "#/components/responses/TooLarge" },
          "415": { "$ref": "#/components/responses/UnsupportedMediaType" },
          "429": { "$ref": "#/components/responses/RateLimited" },
          "500": { "description": "signing_failed", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
          "503": { "description": "rate_limit_unavailable, signing_not_configured, or signing_key_mismatch", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } }
        }
      }
    },
    "/api/v1/verify": {
      "post": {
        "operationId": "verifyStamp", "summary": "Verify a receipt",
        "description": "Checks the receipt signature and supplied file hash. JSON body limit: 8,192 bytes. Choose exactly one request format. Invalid receipts return HTTP 200 with valid: false. Rate limits: 120 requests/minute per client IP and 1,200 per Cloudflare location.",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "oneOf": [
          { "title": "Receipt object", "type": "object", "additionalProperties": false, "required": ["hash", "receipt"], "properties": { "hash": { "$ref": "#/components/schemas/Hash" }, "receipt": { "$ref": "#/components/schemas/Receipt" } } },
          { "title": "Flat receipt", "type": "object", "additionalProperties": false, "required": ["hash", "payload", "signature"], "properties": { "hash": { "$ref": "#/components/schemas/Hash" }, "payload": { "$ref": "#/components/schemas/Payload" }, "signature": { "$ref": "#/components/schemas/Signature" } } },
          { "title": "Base64 receipt", "type": "object", "additionalProperties": false, "required": ["hash", "receiptBase64"], "properties": { "hash": { "$ref": "#/components/schemas/Hash" }, "receiptBase64": { "type": "string", "maxLength": 8192, "description": "Complete receipt JSON encoded as UTF-8, then standard Base64 (optional padding) or unpadded Base64url." } } }
        ] } } } },
        "responses": {
          "200": { "description": "Verification result. Check valid, not just HTTP status. Cache-Control: no-store.", "content": { "application/json": { "schema": { "oneOf": [
            { "type": "object", "required": ["valid", "hash", "issuedAt", "receiptId", "keyId"], "properties": { "valid": { "type": "boolean", "const": true }, "hash": { "$ref": "#/components/schemas/Hash" }, "issuedAt": { "type": "string", "format": "date-time" }, "receiptId": { "type": "string" }, "keyId": { "type": "string" } } },
            { "type": "object", "required": ["valid", "reason"], "properties": { "valid": { "type": "boolean", "const": false }, "reason": { "type": "string", "enum": ["hash_mismatch", "invalid_signature", "unknown_key", "invalid_receipt"] } } }
          ] } } } },
          "400": { "description": "invalid_json, invalid_hash, invalid_request, or invalid_receipt_encoding", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
          "413": { "$ref": "#/components/responses/TooLarge" },
          "415": { "$ref": "#/components/responses/UnsupportedMediaType" },
          "429": { "$ref": "#/components/responses/RateLimited" },
          "503": { "description": "rate_limit_unavailable", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Hash": { "type": "string", "pattern": "^[0-9a-f]{64}$", "description": "Lowercase SHA-256 digest", "example": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
      "Signature": { "type": "string", "pattern": "^[A-Za-z0-9_-]{86}$", "description": "Unpadded Base64url encoding of a 64-byte Ed25519 signature" },
      "Payload": {
        "type": "object", "additionalProperties": false,
        "required": ["version", "hash", "issuedAt", "receiptId", "keyId"],
        "properties": {
          "version": { "type": "integer", "const": 1 },
          "hash": { "$ref": "#/components/schemas/Hash" },
          "issuedAt": { "type": "string", "format": "date-time", "pattern": "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$", "description": "Server timestamp in UTC with milliseconds" },
          "receiptId": { "type": "string", "pattern": "^[A-Za-z0-9_-]{22}$", "description": "Unpadded Base64url encoding of 16 random bytes" },
          "keyId": { "type": "string", "minLength": 1, "example": "momento-v1" }
        }
      },
      "Receipt": { "type": "object", "additionalProperties": false, "required": ["payload", "signature"], "properties": { "payload": { "$ref": "#/components/schemas/Payload" }, "signature": { "$ref": "#/components/schemas/Signature" } } },
      "Error": { "type": "object", "required": ["error"], "properties": { "error": { "type": "string" } } }
    },
    "responses": {
      "TooLarge": { "description": "request_too_large", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
      "UnsupportedMediaType": { "description": "unsupported_media_type: use Content-Type: application/json", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } },
      "RateLimited": { "description": "rate_limited. Cache-Control: no-store.", "headers": { "Retry-After": { "schema": { "type": "string", "enum": ["60"] }, "description": "Seconds to wait before retrying" } }, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Error" } } } }
    }
  }
};

