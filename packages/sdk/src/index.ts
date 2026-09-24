const PROTOCOL_VERSION = 1;
const READY_TIMEOUT_MS = 8000;
const PRODUCT_ID = /^[A-Za-z0-9_-]{1,64}$/;

type CloseReason = "success" | "dismissed" | "error";

type SuccessPayload = {
  sessionId: string;
  productId: string;
  amount: number;
  currency: string;
};

type ErrorPayload = {
  code: string;
  message: string;
};

type OpenOptions = {
  productId: string;
  email?: string;
  onSuccess?: (result: SuccessPayload) => void;
  onClose?: (result: { reason: CloseReason }) => void;
  onError?: (error: ErrorPayload) => void;
};

declare global {
  interface Window {
    DodoCheckout?: {
      open: (options: OpenOptions) => void;
      close: () => void;
    };
  }
}

let phase: "idle" | "opening" | "open" = "idle";
let iframe: HTMLIFrameElement | null = null;
let nonce = "";
let options: OpenOptions | null = null;
let previousFocus: HTMLElement | null = null;
let previousOverflow = "";
let loadTimer = 0;

function checkoutOrigin(): string {
  return new URL(__CHECKOUT_ORIGIN__).origin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function restoreHost() {
  if (document.body) document.body.style.overflow = previousOverflow;
  const focus = previousFocus;
  previousFocus = null;
  previousOverflow = "";
  if (focus && document.contains(focus)) focus.focus();
}

function destroy(reason: CloseReason | null) {
  window.clearTimeout(loadTimer);
  loadTimer = 0;
  window.removeEventListener("message", onMessage);
  iframe?.remove();
  iframe = null;
  const current = options;
  options = null;
  nonce = "";
  phase = "idle";
  restoreHost();
  if (reason) current?.onClose?.({ reason });
}

function onMessage(event: MessageEvent) {
  if (event.origin !== checkoutOrigin()) return;
  if (!iframe || event.source !== iframe.contentWindow) return;
  if (!isRecord(event.data)) return;
  const data = event.data;
  if (data.source !== "dodo-checkout" || data.version !== PROTOCOL_VERSION || data.nonce !== nonce) return;
  if (typeof data.type !== "string") return;

  if (data.type === "ready") {
    window.clearTimeout(loadTimer);
    loadTimer = 0;
    phase = "open";
    const email = typeof options?.email === "string" ? options.email.slice(0, 254) : undefined;
    iframe.contentWindow?.postMessage(
      {
        source: "dodo-sdk",
        version: PROTOCOL_VERSION,
        nonce,
        type: "init",
        payload: { email },
      },
      checkoutOrigin(),
    );
    iframe.focus();
    return;
  }

  if (data.type === "success" && isRecord(data.payload)) {
    const payload = data.payload;
    if (
      typeof payload.sessionId === "string" &&
      typeof payload.productId === "string" &&
      typeof payload.amount === "number" &&
      typeof payload.currency === "string"
    ) {
      options?.onSuccess?.({
        sessionId: payload.sessionId,
        productId: payload.productId,
        amount: payload.amount,
        currency: payload.currency,
      });
    }
    return;
  }

  if (data.type === "error" && isRecord(data.payload)) {
    const payload = data.payload;
    if (typeof payload.code === "string" && typeof payload.message === "string") {
      options?.onError?.({ code: payload.code, message: payload.message });
    }
    return;
  }

  if (data.type === "close" && isRecord(data.payload)) {
    const reason = data.payload.reason;
    if (reason === "success" || reason === "dismissed" || reason === "error") destroy(reason);
  }
}

function mount() {
  if (!document.body || !options) return;
  const url = new URL("/", checkoutOrigin());
  url.searchParams.set("productId", options.productId);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("parentOrigin", window.location.origin);

  const frame = document.createElement("iframe");
  frame.title = "Dodo Checkout";
  frame.name = "dodo_checkout";
  frame.src = url.toString();
  frame.setAttribute("sandbox", "allow-scripts allow-forms allow-same-origin");
  frame.referrerPolicy = "no-referrer";
  frame.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100%",
    "height:100%",
    "border:0",
    "margin:0",
    "padding:0",
    "z-index:2147483647",
    "background:transparent",
    "color-scheme:normal",
  ].join(";");

  document.body.style.overflow = "hidden";
  document.body.appendChild(frame);
  iframe = frame;
  window.addEventListener("message", onMessage);
  loadTimer = window.setTimeout(() => {
    const current = options;
    destroy(null);
    current?.onError?.({
      code: "checkout_unavailable",
      message: "Checkout didn't load. Try again.",
    });
    current?.onClose?.({ reason: "error" });
  }, READY_TIMEOUT_MS);
}

function open(raw: OpenOptions) {
  if (!raw || typeof raw !== "object") return;
  const productId = typeof raw.productId === "string" ? raw.productId.trim() : "";
  if (!PRODUCT_ID.test(productId)) {
    raw.onError?.({ code: "invalid_product", message: "A productId is required." });
    raw.onClose?.({ reason: "error" });
    return;
  }
  if (phase !== "idle") {
    iframe?.focus();
    return;
  }

  phase = "opening";
  options = { ...raw, productId };
  nonce = crypto.randomUUID();
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousOverflow = document.body?.style.overflow ?? "";

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", () => mount(), { once: true });
}

function close() {
  if (phase === "idle") return;
  if (phase === "opening") {
    const current = options;
    destroy(null);
    current?.onClose?.({ reason: "dismissed" });
    return;
  }
  iframe?.contentWindow?.postMessage(
    { source: "dodo-sdk", version: PROTOCOL_VERSION, nonce, type: "request-close" },
    checkoutOrigin(),
  );
}

if (!window.DodoCheckout) {
  window.DodoCheckout = { open, close };
}

export {};
