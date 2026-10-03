# Momento Timestamp protocol

Verify signed timestamp receipts without contacting the issuer. Requires Node.js 22.18+ or a modern browser. ML-DSA-65 verification uses the bundled JavaScript implementation.
TypeScript consumers need TypeScript 5.7+ for the generated typed-array declarations.

```js
import { verifyReceipt } from '@mikthatguy/momento-protocol';

const result = await verifyReceipt(receipt, fileSha256);
if (!result.valid) throw new Error(result.reason);
console.log(result.receipt.payload.issuedAt);
```

Use an authentic copy of this package and its public keys. A valid signature does not independently certify the issuer's clock or prevent the issuer from backdating a new receipt. Preserve the file, receipt, and public key.

The normative protocol specification and fixed test vectors are in [the repository](https://github.com/MIKTHATGUY/momento/blob/main/docs/protocol-v2.md).
