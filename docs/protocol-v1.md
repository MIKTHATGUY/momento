# Obsolete protocol — rejected by v2

Historical specification only. Discard all older Ed25519 keys; updated verifiers reject every v1 receipt. See [protocol v2](protocol-v2.md).

# Momento Timestamp protocol v1

This specification defines interoperable receipt verification. It does not certify the issuer's clock or prevent the signing-key holder from backdating new receipts.

## Receipt structure

A receipt is a JSON object with exactly two fields: payload and signature. The payload has exactly version, hash, issuedAt, receiptId, and keyId. Object property order and insignificant JSON whitespace do not matter.

- version is the integer 1.
- hash is exactly 64 lowercase ASCII hexadecimal characters: SHA-256 of the original raw bytes.
- issuedAt is a valid UTC calendar timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format, exactly three fractional digits, with no timezone offsets or leap-second representation.
- receiptId is canonical unpadded Base64url of exactly 16 random bytes (22 characters).
- keyId is 1–128 ASCII letters, digits, periods, underscores, or hyphens and identifies an authentic public key.
- signature is canonical unpadded Base64url of exactly 64 Ed25519 signature bytes (86 characters).

Reject extra fields, wrong types, unsupported versions, invalid dates, padding, non-URL-safe characters, and nonzero unused Base64 bits. Validate canonical encoding by decoding and re-encoding to the identical string. Client receipt JSON is limited to 8,192 UTF-8 bytes.

## Exact signed bytes

Serialize this ordered array as compact JSON (no spaces or newlines), then encode it as UTF-8 without a byte-order mark:

```js
JSON.stringify([
  'Momento timestamp receipt v1',
  payload.version,
  payload.hash,
  payload.issuedAt,
  payload.receiptId,
  payload.keyId,
]);
```

All variable string fields in v1 are ASCII. The integer is the literal 1. Do not sign the surrounding receipt JSON, change the order, add a trailing newline, or hash this tuple before signing. Use pure Ed25519, not Ed25519ph or Ed25519ctx. File names and Git metadata are outside the signed message.

The public key is DER SubjectPublicKeyInfo (SPKI), encoded as canonical unpadded Base64url. The signature is the raw 64 bytes encoded the same way. Node and Web Crypto use PKCS#8 for importing the private key; no private key belongs in a receipt.

## Verification

Validate structure and encoding; select the key by an own-property lookup; reject unknown or compromised keys; verify the Ed25519 signature over the exact bytes above. Routine retirement does not invalidate a signature. Compare a fresh file digest to payload.hash to check file association. Signature-only verification must not claim the original file was checked.

## Fixed test vector

This uses the public RFC 8032 section 7.1 test key. It is not a production receipt. The stated time is synthetic. Never use the public test seed for real signing.

```json
{
  "description": "Public RFC 8032 test key. Not a production receipt or signing key.",
  "publicKey": "MCowBQYDK2VwAyEA11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
  "signingMessage": "[\"Momento timestamp receipt v1\",1,\"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\",\"2026-01-01T00:00:00.000Z\",\"AAAAAAAAAAAAAAAAAAAAAA\",\"protocol-test-v1\"]",
  "signingBytesHex": "5b224d6f6d656e746f2074696d657374616d702072656365697074207631222c312c2265336230633434323938666331633134396166626634633839393666623932343237616534316534363439623933346361343935393931623738353262383535222c22323032362d30312d30315430303a30303a30302e3030305a222c2241414141414141414141414141414141414141414141222c2270726f746f636f6c2d746573742d7631225d",
  "receipt": {
    "payload": {
      "version": 1,
      "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "issuedAt": "2026-01-01T00:00:00.000Z",
      "receiptId": "AAAAAAAAAAAAAAAAAAAAAA",
      "keyId": "protocol-test-v1"
    },
    "signature": "l36A-T7tQ7laJK1ASPoHJkMDgtlumTPIXFRlZvLndR0oLadNjF1_p4dmUTR20n8TzMAmbTHN-2YFA7h6x2y3AQ"
  }
}
```

The same vector is machine-readable at tests/fixtures/protocol-v1.json. tests/protocol.test.ts exercises it, altered signatures and fields, impossible dates, unsupported versions, oversized receipts, prototype key names, and malformed/noncanonical encodings.

## Future versions

V2 deliberately removes v1 verification in the breaking post-quantum migration. Introduce a new version and domain separator for any change to signed bytes. Never silently redefine v1. Key rotation adds a new key ID without changing the format. Key lifecycle metadata is unsigned discovery information and must be obtained through an authentic distribution channel.
