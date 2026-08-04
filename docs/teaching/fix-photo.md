Yes—this fix targets the exact failure we reproduced, not the placeholder itself.

### The complete request path

When `/stock` displays an image:

```text
Browser
  → /api/product-images/<product-id>
  → API finds ProductImageAsset in PostgreSQL
  → Node signs a GET request
  → Node connects to Backblaze
  → Backblaze returns the image
  → API streams it to the browser
```

The Backblaze request is made using Node’s `fetch()` in [s3Storage.ts](/home/sunkura/Documents/PharmSoftware/server/product-images/s3Storage.ts:326).

### What was failing

Backblaze DNS returned multiple IPv4 and IPv6 addresses. On your Linux environment, the observed results were:

- IPv6: `ENETUNREACH`
- IPv4: `ETIMEDOUT`
- Overall Node error: `TypeError: fetch failed`
- Underlying error: `AggregateError`

Node 22 normally gives each candidate address only **250 ms** before trying another address. This is the documented default for `autoSelectFamilyAttemptTimeout`. [Node.js v22 networking documentation](https://nodejs.org/download/release/latest-jod/docs/api/net.html#netsetdefaultautoselectfamilyattempttimeoutvalue)

Your curl command behaved differently:

```bash
curl -4 -I --connect-timeout 8 ...
```

It:

- forced IPv4;
- selected one IPv4 address;
- allowed up to eight seconds to connect.

Therefore curl reached Backblaze and received HTTP 405, while Node abandoned its individual connection attempts too quickly.

### Why a placeholder appeared

The application deliberately hides storage errors:

```ts
try {
  const stored = await readStoredProductImage(...);
  return actualImage;
} catch {
  return placeholder;
}
```

That behavior is in [productImages.ts](/home/sunkura/Documents/PharmSoftware/server/routes/productImages.ts:39).

Consequently:

```text
Node connection timeout
  → Backblaze fetch throws
  → route catches the error
  → route returns SVG placeholder with HTTP 200
  → browser has no visible error
```

That explains why you saw a normal placeholder rather than a broken-image icon or error message.

### What the permanent fix changes

At server startup, [networkDefaults.ts](/home/sunkura/Documents/PharmSoftware/server/networkDefaults.ts:1) changes Node’s address-attempt timeout:

```ts
setDefaultAutoSelectFamilyAttemptTimeout(2_000);
```

It is called before the API server and background worker start in [server/index.ts](/home/sunkura/Documents/PharmSoftware/server/index.ts:7).

The difference is:

| Configuration | Time allowed per address |
|---|---:|
| Node 22 default | 250 ms |
| Updated server | 2,000 ms |

This is not a mandatory two-second delay. A successful connection continues immediately. Two seconds is only the maximum time Node allows an unsuccessful candidate before moving to the next one.

We preserved IPv4/IPv6 fallback instead of permanently disabling IPv6.

### Evidence that it affects the real failure

Using ordinary Node startup with the new code—without `NODE_OPTIONS`—I ran the application’s actual signed Backblaze download:

```text
HTTP status:       200
Expected bytes:    134500
Downloaded bytes:  134500
Verdict:           GREEN
```

Additional checks found:

- 49 of the first 50 `/stock` products have managed Backblaze assets.
- Ten sampled objects returned HTTP 200.
- Every downloaded byte count matched its database metadata.
- Backblaze credentials and object keys were therefore valid.

Before changing the timeout, the same Node request produced `fetch failed`. After changing only the connection-attempt timeout, the signed request returned the complete image.

### Why Mac could work while Linux failed

This part is an inference: macOS likely reached one candidate address inside Node’s 250 ms window, or selected/routed the addresses differently. Your Linux network had unusable IPv6 routes and IPv4 connections that required longer than Node’s default attempt window.

### Scope of the fix

This solves the demonstrated Linux transport failure. It cannot fix unrelated placeholder causes, such as:

- a product with no `ProductImageAsset`;
- deleted Backblaze objects;
- revoked credentials;
- the browser reaching an old server process.

But those were separately checked for the current stock page, and the post-fix signed image download succeeded.