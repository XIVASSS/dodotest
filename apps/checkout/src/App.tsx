import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import logo from "./brand/logo-black.svg";
import ramp from "./brand/ramp.png";
import { cardBrand, formatCard, formatCvc, formatExpiry, last4, type CardBrand } from "./card";
import { catalog, formatMoney, type Product } from "./catalog";
import { charge } from "./charge";
import { connectHost, type CloseReason } from "./messages";
import { ScanCode } from "./ScanCode";
import { useFocusTrap } from "./useFocusTrap";
import { firstInvalid, validate, type FieldErrors } from "./validate";

type Screen = "loading" | "missing" | "form" | "success";

type Banner = { code: string; message: string };

const host = connectHost();
const STORE_URL = import.meta.env.VITE_STORE_URL || "http://localhost:5173";
const openedDirectly = !host.embedded && host.productId === "";

function leaveCheckout(reason: CloseReason) {
  if (host.embedded) host.post("close", { reason });
  else window.location.assign(STORE_URL);
}

export function App() {
  const product = catalog[host.productId] ?? (openedDirectly ? catalog.prod_hoodie : null);
  const [screen, setScreen] = useState<Screen>(openedDirectly ? "form" : "loading");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(openedDirectly ? "ada@hale.shop" : "");
  const [card, setCard] = useState(openedDirectly ? "4242 4242 4242 4242" : "");
  const [expiry, setExpiry] = useState(openedDirectly ? "12 / 28" : "");
  const [cvc, setCvc] = useState(openedDirectly ? "123" : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<Banner | null>(null);
  const [session, setSession] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvcRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const emailDirty = useRef(false);
  const busyRef = useRef(false);
  const settledRef = useRef(false);
  const toldMissing = useRef(false);
  const [codeOpen, setCodeOpen] = useState(false);

  useFocusTrap(dialogRef, !openedDirectly && screen !== "loading");

  useEffect(() => {
    host.post("ready");
    return host.onInit((prefill) => {
      if (!emailDirty.current && prefill) setEmail(prefill.slice(0, 254));
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setScreen(product ? "form" : "missing");
    }, 280);
    return () => window.clearTimeout(timer);
  }, [product]);

  useEffect(() => {
    if (screen !== "missing" || toldMissing.current) return;
    toldMissing.current = true;
    host.post("error", {
      code: "product_not_found",
      message: "This product isn't available.",
    });
  }, [screen]);

  useEffect(() => {
    if (screen === "form") emailRef.current?.focus();
    if (screen === "missing") closeRef.current?.focus();
    if (screen === "success") doneRef.current?.focus();
  }, [screen]);

  function closeWith(reason: CloseReason) {
    if (busyRef.current) return;
    if (openedDirectly) {
      settledRef.current = false;
      setSession("");
      setBanner(null);
      setErrors({});
      setEmail("ada@hale.shop");
      setCard("4242 4242 4242 4242");
      setExpiry("12 / 28");
      setCvc("123");
      setScreen("form");
      return;
    }
    leaveCheckout(reason);
  }

  useEffect(() => {
    return host.onRequestClose(() => {
      if (busyRef.current) return;
      const reason: CloseReason = settledRef.current ? "success" : screen === "missing" ? "error" : "dismissed";
      closeWith(reason);
    });
  }, [screen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (busyRef.current) return;
      const reason: CloseReason = settledRef.current ? "success" : screen === "missing" ? "error" : "dismissed";
      closeWith(reason);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current || !product) return;
    const nextErrors = validate({ email, card, expiry, cvc });
    const invalid = firstInvalid(nextErrors);
    if (invalid) {
      setErrors(nextErrors);
      setBanner(null);
      const field = { email: emailRef, card: cardRef, expiry: expiryRef, cvc: cvcRef }[invalid];
      field.current?.focus();
      return;
    }

    setErrors({});
    setBanner(null);
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await charge(card);
      if (!result.ok) {
        setBanner({ code: result.code, message: result.message });
        host.post("error", { code: result.code, message: result.message });
        cardRef.current?.focus();
        return;
      }
      settledRef.current = true;
      setSession(result.sessionId);
      host.post("success", {
        sessionId: result.sessionId,
        productId: product.id,
        amount: product.amount,
        currency: product.currency,
      });
      setScreen("success");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const panel = (
    <section
      ref={dialogRef}
      className="dialog"
      role="dialog"
      aria-modal={!openedDirectly}
      aria-labelledby="checkout-title"
      aria-busy={busy || screen === "loading"}
    >
        {!codeOpen && <header className="dialog-head">
          <img className="logo" src={logo} alt="Dodo Payments" />
          <span className="test">Test mode</span>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label="Close checkout"
            disabled={busy}
            onClick={() => closeWith(settledRef.current ? "success" : screen === "missing" ? "error" : "dismissed")}
          >
            <CloseIcon />
          </button>
        </header>}

        {screen === "loading" && <Loading />}
        {screen === "missing" && (
          <div className="stack">
            <h1 id="checkout-title">This product isn't available</h1>
            <p className="quiet">The store asked for a product this checkout doesn't have. You haven't been charged.</p>
            <button type="button" className="primary" onClick={() => closeWith("error")}>
              Close
            </button>
          </div>
        )}
        {screen === "form" && product && (
          <FormView
            product={product}
            email={email}
            card={card}
            expiry={expiry}
            cvc={cvc}
            errors={errors}
            banner={banner}
            busy={busy}
            emailRef={emailRef}
            cardRef={cardRef}
            expiryRef={expiryRef}
            cvcRef={cvcRef}
            onEmail={(value) => {
              emailDirty.current = true;
              setEmail(value);
            }}
            onCard={setCard}
            onExpiry={setExpiry}
            onCvc={setCvc}
            onSubmit={onSubmit}
            onCancel={() => closeWith("dismissed")}
            onCode={setCodeOpen}
          />
        )}
        {screen === "success" && product && (
          <div className="stack success">
            <div className="check" aria-hidden="true">
              <CheckIcon />
            </div>
            <h1 id="checkout-title">Paid</h1>
            <p className="price">{formatMoney(product.amount, product.currency)}</p>
            <p className="quiet">
              {product.name} · Card ending in {last4(card)}
            </p>
            <p className="receipt">
              <span>Receipt</span>
              <code>{session}</code>
            </p>
            <button ref={doneRef} type="button" className="primary" onClick={() => closeWith("success")}>
              Done
            </button>
          </div>
        )}
      </section>
  );

  if (openedDirectly) return <CheckoutHome>{panel}</CheckoutHome>;

  return (
    <div
      className="scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      {panel}
    </div>
  );
}

function FormView(props: {
  product: Product;
  email: string;
  card: string;
  expiry: string;
  cvc: string;
  errors: FieldErrors;
  banner: Banner | null;
  busy: boolean;
  emailRef: RefObject<HTMLInputElement | null>;
  cardRef: RefObject<HTMLInputElement | null>;
  expiryRef: RefObject<HTMLInputElement | null>;
  cvcRef: RefObject<HTMLInputElement | null>;
  onEmail: (value: string) => void;
  onCard: (value: string) => void;
  onExpiry: (value: string) => void;
  onCvc: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  onCode: (open: boolean) => void;
}) {
  const amount = formatMoney(props.product.amount, props.product.currency);
  const [wallet, setWallet] = useState<"apple" | "ramp" | null>(null);

  function openCode(next: "apple" | "ramp") {
    setWallet(next);
    props.onCode(true);
  }

  function closeCode() {
    setWallet(null);
    props.onCode(false);
  }

  if (wallet) {
    return (
      <div className="paycode">
        <button type="button" className="icon-button paycode-close" aria-label="Back to card" onClick={closeCode}>
          <CloseIcon />
        </button>
        <ScanCode />
      </div>
    );
  }

  return (
    <form onSubmit={props.onSubmit} noValidate>
      <p className="eyebrow">Pay {props.product.merchant}</p>
      <div className="summary">
        <div>
          <h1 id="checkout-title">{props.product.name}</h1>
          <p className="quiet">{props.product.detail}</p>
        </div>
        <p className="price">{amount}</p>
      </div>

      <div className="wallets">
        <button
          type="button"
          className="wallet apple"
          aria-label="Apple Pay"
          disabled={props.busy}
          onClick={() => openCode("apple")}
        >
          <AppleMark />
          Pay
        </button>
        <button
          type="button"
          className="wallet ramp"
          aria-label="Ramp"
          disabled={props.busy}
          onClick={() => openCode("ramp")}
        >
          <img src={ramp} alt="" />
        </button>
      </div>
      <p className="or">Or pay with card</p>

      {props.banner && (
        <p className="banner" role="alert">
          {props.banner.message}
        </p>
      )}

      <label className="field">
        <span>Email</span>
        <input
          ref={props.emailRef}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={props.email}
          disabled={props.busy}
          aria-invalid={Boolean(props.errors.email)}
          aria-describedby={props.errors.email ? "email-error" : undefined}
          onChange={(event) => props.onEmail(event.target.value)}
        />
        {props.errors.email && (
          <small id="email-error" className="field-error">
            {props.errors.email}
          </small>
        )}
        <button
          type="button"
          className="email-pick"
          disabled={props.busy}
          onClick={() => props.onEmail("ada@hale.shop")}
        >
          ada@hale.shop
        </button>
      </label>

      <label className="field">
        <span>Card number</span>
        <span className="card-input">
        <input
          ref={props.cardRef}
          name="cc-number"
          inputMode="numeric"
          autoComplete="cc-number"
          autoCorrect="off"
          spellCheck={false}
          placeholder="1234 1234 1234 1234"
          value={props.card}
          disabled={props.busy}
          aria-invalid={Boolean(props.errors.card)}
          aria-describedby={props.errors.card ? "card-error" : undefined}
          onChange={(event) => props.onCard(formatCard(event.target.value))}
        />
        <CardMark brand={cardBrand(props.card)} />
        </span>
        {props.errors.card && (
          <small id="card-error" className="field-error">
            {props.errors.card}
          </small>
        )}
      </label>

      <div className="split">
      <label className="field">
        <span>Expiry date</span>
          <input
            ref={props.expiryRef}
            name="cc-exp"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM / YY"
            value={props.expiry}
            disabled={props.busy}
            aria-invalid={Boolean(props.errors.expiry)}
            aria-describedby={props.errors.expiry ? "expiry-error" : undefined}
            onChange={(event) => props.onExpiry(formatExpiry(event.target.value))}
          />
          {props.errors.expiry && (
            <small id="expiry-error" className="field-error">
              {props.errors.expiry}
            </small>
          )}
        </label>
        <label className="field">
          <span>Security code</span>
          <input
            ref={props.cvcRef}
            name="cc-csc"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="CVC"
            value={props.cvc}
            disabled={props.busy}
            aria-invalid={Boolean(props.errors.cvc)}
            aria-describedby={props.errors.cvc ? "cvc-error" : undefined}
            onChange={(event) => props.onCvc(formatCvc(event.target.value))}
          />
          {props.errors.cvc && (
            <small id="cvc-error" className="field-error">
              {props.errors.cvc}
            </small>
          )}
        </label>
      </div>

      <p className="reassure">
        <LockIcon />
        Payment Secure · PCI DSS Compliant
      </p>

      <button type="submit" className="primary" disabled={props.busy}>
        {props.busy ? <span className="spinner" aria-hidden="true" /> : null}
        {props.busy ? "Paying…" : `Pay ${amount}`}
      </button>
      <button type="button" className="quiet-button" disabled={props.busy} onClick={props.onCancel}>
        Cancel
      </button>
    </form>
  );
}

function Loading() {
  return (
    <div className="stack">
      <span className="sr-only">Loading checkout</span>
      <div className="skeleton wide" />
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton button" />
    </div>
  );
}

function CheckoutHome({ children }: { children: ReactNode }) {
  return (
    <main className="home">
      <header className="home-bar">
        <img className="logo" src={logo} alt="Dodo Payments" />
        <a className="home-store" href={STORE_URL}>
          Store
        </a>
      </header>
      <div className="home-split">
        <div className="home-copy">
          <p className="eyebrow">The checkout, hosted here</p>
          <h1>The card never reaches the store.</h1>
          <p className="lead">
            A site adds one script and calls <code>DodoCheckout.open</code>. The customer stays on that page.
            This frame is what opens.
          </p>
          <a className="primary home-go" href={STORE_URL}>
            Try it on the store
          </a>
          <dl>
            <div>
              <dt>Store may send</dt>
              <dd>A product id, and an email as a prefill. Not a price.</dd>
            </div>
            <div>
              <dt>Store is told</dt>
              <dd>Success, a decline, or why it closed. Never the card.</dd>
            </div>
            <div>
              <dt>This catalog charges</dt>
              <dd>Hoodie $86.00 · Tee $36.00 · Cap $24.00</dd>
            </div>
          </dl>
          <p className="home-cards">
            <span>4242…4242 succeeds</span>
            <span>0002 declines</span>
            <span>0341 fails once, then succeeds</span>
          </p>
        </div>
        <div className="specimen">{children}</div>
      </div>
    </main>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6 12.5l4 4L18 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardMark({ brand }: { brand: CardBrand | null }) {
  if (brand === "visa") {
    return (
      <span className="card-mark" aria-label="Visa">
        <svg viewBox="0 0 48 16" width="42" height="14" aria-hidden="true">
          <text x="0" y="13" fill="#1a1f71" fontFamily="Arial, sans-serif" fontSize="15" fontStyle="italic" fontWeight="700">VISA</text>
        </svg>
      </span>
    );
  }
  if (brand === "mastercard") {
    return (
      <span className="card-mark" aria-label="Mastercard">
        <svg viewBox="0 0 36 22" width="32" height="20" aria-hidden="true">
          <circle cx="13" cy="11" r="8" fill="#eb001b" />
          <circle cx="23" cy="11" r="8" fill="#f79e1b" />
          <path d="M18 5.2a8 8 0 0 1 0 11.6 8 8 0 0 1 0-11.6z" fill="#ff5f00" />
        </svg>
      </span>
    );
  }
  if (brand === "amex") {
    return (
      <span className="card-mark" aria-label="American Express">
        <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
          <rect width="32" height="32" fill="#016fd0" />
          <text x="16" y="14" textAnchor="middle" fill="none" stroke="#fff" strokeWidth="1.15" fontFamily="Arial Black, Arial, sans-serif" fontSize="11" fontWeight="700">AM</text>
          <text x="16" y="26" textAnchor="middle" fill="none" stroke="#fff" strokeWidth="1.15" fontFamily="Arial Black, Arial, sans-serif" fontSize="11" fontWeight="700">EX</text>
        </svg>
      </span>
    );
  }
  if (brand === "rupay") {
    return (
      <span className="card-mark" aria-label="RuPay">
        <svg viewBox="0 0 86 22" width="54" height="16" aria-hidden="true">
          <text x="0" y="17" fill="#1d3fbf" fontFamily="Arial, Helvetica, sans-serif" fontSize="18" fontStyle="italic" fontWeight="700">RuPay</text>
          <polygon points="66,2 80,9 66,9" fill="#f26b1d" />
          <polygon points="70,10 84,17 70,17" fill="#1f9d55" />
        </svg>
      </span>
    );
  }
  return null;
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="3.2" y="7" width="9.6" height="6.2" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
