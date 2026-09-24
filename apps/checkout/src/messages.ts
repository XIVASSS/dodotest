const PROTOCOL_VERSION = 1;

export type CloseReason = "success" | "dismissed" | "error";

export type HostLink = {
  embedded: boolean;
  productId: string;
  post: (type: string, payload?: unknown) => void;
  onInit: (handler: (email?: string) => void) => () => void;
  onRequestClose: (handler: () => void) => () => void;
};

function isOrigin(value: string) {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function connectHost(): HostLink {
  const params = new URLSearchParams(window.location.search);
  const nonce = params.get("nonce") ?? "";
  const parentOrigin = params.get("parentOrigin") ?? "";
  const productId = params.get("productId") ?? "";
  const embedded = window.parent !== window && nonce.length > 0 && isOrigin(parentOrigin);

  const post = (type: string, payload?: unknown) => {
    if (!embedded) return;
    window.parent.postMessage(
      { source: "dodo-checkout", version: PROTOCOL_VERSION, nonce, type, payload },
      parentOrigin,
    );
  };

  const listen = (match: (data: Record<string, unknown>) => void) => {
    const onMessage = (event: MessageEvent) => {
      if (!embedded || event.origin !== parentOrigin || event.source !== window.parent) return;
      if (!isRecord(event.data)) return;
      const data = event.data;
      if (data.source !== "dodo-sdk" || data.version !== PROTOCOL_VERSION || data.nonce !== nonce) return;
      match(data);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  };

  return {
    embedded,
    productId,
    post,
    onInit: (handler) =>
      listen((data) => {
        if (data.type !== "init" || !isRecord(data.payload)) return;
        const email = data.payload.email;
        handler(typeof email === "string" ? email : undefined);
      }),
    onRequestClose: (handler) =>
      listen((data) => {
        if (data.type === "request-close") handler();
      }),
  };
}
