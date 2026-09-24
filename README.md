# Embeddable Dodo Checkout

A store adds one script and calls `DodoCheckout.open`. The checkout opens on the same page. Card details stay on the checkout origin and never enter the store's JavaScript.

## Live

The store is [https://dodotest-store.vercel.app](https://dodotest-store.vercel.app). The checkout is [https://dodotest-checkout.vercel.app](https://dodotest-checkout.vercel.app). They are different origins. Share the store link.

## Run

```bash
npm install
npm run dev
```

Open the store at [http://localhost:5173](http://localhost:5173). The checkout app is [http://localhost:5174](http://localhost:5174). They are different origins on purpose.

The store loads `%VITE_CHECKOUT_ORIGIN%/dodo.js` (`http://localhost:5174` in `apps/demo/.env`). To point the script at another checkout host, set `VITE_CHECKOUT_ORIGIN` for the store build and rebuild the SDK with the same origin:

```bash
CHECKOUT_ORIGIN=https://checkout.example.com npm run build -w @dodo/sdk
```

## What the store can do

```html
<script src="http://localhost:5174/dodo.js"></script>
<script>
  DodoCheckout.open({
    productId: "prod_hoodie",
    onSuccess: ({ sessionId }) => {},
    onClose: ({ reason }) => {},
    onError: ({ code, message }) => {},
  });
</script>
```

`productId` is required and must match `^[A-Za-z0-9_-]{1,64}$`. An optional `email` is a prefill only. The store cannot pass a price, a name, or HTML. The catalog lives in the checkout app.

`DodoCheckout.close()` asks the checkout to close. It does nothing while a payment is in flight. A second `open()` focuses the checkout that is already open.

`onSuccess` receives `{ sessionId, productId, amount, currency }`. `amount` is in minor units (8600 means $86.00). `onClose` receives `{ reason: "success" | "dismissed" | "error" }` only after the UI is gone. A decline fires `onError` and leaves the checkout open.

## How the pieces talk

1. The SDK creates a nonce, locks page scroll, and mounts a full-viewport iframe at the checkout origin with `productId`, `nonce`, and `parentOrigin`.
2. The iframe is sandboxed with `allow-scripts allow-forms allow-same-origin` and no top navigation. Its referrer policy is `no-referrer`.
3. The checkout posts `{ source: "dodo-checkout", version: 1, nonce, type, payload }` only to `parentOrigin`.
4. The SDK ignores messages whose `origin` is not the checkout origin, whose `source` window is not this iframe, or whose nonce does not match. It never uses `"*"` as a target.
5. On `ready`, the SDK sends `init` with the optional email. Email is not put in the URL.
6. If `ready` does not arrive within 8 seconds, the SDK removes the iframe and reports `checkout_unavailable`.

Card number, expiry, CVC, and email are not posted back. The attempt count for the retry card is a hash in the checkout origin's `sessionStorage`, so a close and reopen in the same tab still retries correctly.

Test cards, any future expiry, any 3-digit CVC, and any valid email:

- `4242 4242 4242 4242` succeeds
- `4000 0000 0000 0002` declines
- `4000 0000 0000 0341` fails once, then succeeds

## Decisions

**Iframe, not a popup.** A popup isolates the card form and also gets blocked, and it feels like leaving the page. A full-viewport iframe on another origin keeps the customer on the store and keeps the card fields out of the store's DOM. The scrim and dialog are drawn inside the iframe so the store cannot restyle the amount or the pay button. The store can still paint HTML over the iframe. A server-created session and a merchant allowlist would be the next defense. Clicking the scrim does nothing, so a stray click does not discard a half-entered card.

**A decline does not close the checkout.** `onError` fires immediately, the form stays filled, and `onClose` waits until the customer actually leaves. The store learns the truth without treating a failed card as "the customer dismissed the payment."

The visual design is locked. The store can prefill an email and nothing else. The checkout uses the Dodo brand kit: Green Pulse `#C6FE1E`, Blue Stride `#1264FF`, Eclipse Black `#0D0D0D`, Dodo Mist `#F6F7F9`, and White Stream `#FFFFFF`, with Apfel Grotezk for headlines, buttons, and form text.

## Next

Create the session on a server so the price is not shipped in the client bundle. Treat `onSuccess` as a hint and confirm with a webhook. Add an idempotency key so a double submit cannot capture twice. Then collect billing country and tax, which a Merchant of Record needs and this fake charge does not.
