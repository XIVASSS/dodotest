import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import logo from "./brand/logo-black.svg";
import { formatCard, formatCvc, formatExpiry, last4 } from "./card";
import { catalog, formatMoney, type Product } from "./catalog";
import { charge } from "./charge";
import { connectHost, type CloseReason } from "./messages";
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
  const product = catalog[host.productId] ?? null;
  const [screen, setScreen] = useState<Screen>("loading");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
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

  useFocusTrap(dialogRef, screen !== "loading");

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
    leaveCheckout(reason);
  }

  useEffect(() => {
    return host.onRequestClose(() => {
      if (busyRef.current) return;
      const reason: CloseReason = settledRef.current ? "success" : screen === "missing" ? "error" : "dismissed";
      leaveCheckout(reason);
    });
  }, [screen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (busyRef.current) return;
      const reason: CloseReason = settledRef.current ? "success" : screen === "missing" ? "error" : "dismissed";
      leaveCheckout(reason);
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

  return (
    <div
      className="scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <section
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        aria-busy={busy || screen === "loading"}
      >
        <header className="dialog-head">
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
        </header>

        {screen === "loading" && <Loading />}
        {screen === "missing" && openedDirectly && (
          <div className="stack">
            <h1 id="checkout-title">Open the store to pay</h1>
            <p className="quiet">This page is the checkout frame. The Buy button is on the store, and the card form opens there.</p>
            <a className="primary" href={STORE_URL}>
              Open the store
            </a>
          </div>
        )}
        {screen === "missing" && !openedDirectly && (
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
}) {
  const amount = formatMoney(props.product.amount, props.product.currency);
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
      </label>

      <label className="field">
        <span>Card number</span>
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

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="3.2" y="7" width="9.6" height="6.2" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
