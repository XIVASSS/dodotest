import { digits } from "./card";

const SUCCESS = "4242424242424242";
const RETRY = "4000000000000341";

export type ChargeResult =
  | { ok: true; sessionId: string }
  | { ok: false; code: "payment_declined" | "payment_failed" | "offline"; message: string };

function sessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const id = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `cs_${id}`;
}

async function attemptKey(pan: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`dodo-test:${pan}`));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `dodo_attempt_${hex.slice(0, 16)}`;
}

function readAttempt(key: string) {
  try {
    return Number(sessionStorage.getItem(key) ?? "0");
  } catch {
    return 0;
  }
}

function writeAttempt(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* sessionStorage can be blocked; the in-memory path still works for this tab. */
  }
}

export async function charge(card: string): Promise<ChargeResult> {
  if (!navigator.onLine) {
    return {
      ok: false,
      code: "offline",
      message: "You're offline. Your details are still here. Try again when you're back.",
    };
  }

  await new Promise((resolve) => window.setTimeout(resolve, 900));

  if (!navigator.onLine) {
    return {
      ok: false,
      code: "offline",
      message: "You're offline. Your details are still here. Try again when you're back.",
    };
  }

  const pan = digits(card);
  if (pan === SUCCESS) return { ok: true, sessionId: sessionId() };
  if (pan !== RETRY) {
    return { ok: false, code: "payment_declined", message: "Card declined. Try another card." };
  }

  const key = await attemptKey(pan);
  const attempts = readAttempt(key);
  if (attempts < 1) {
    writeAttempt(key, "1");
    return {
      ok: false,
      code: "payment_failed",
      message: "That didn't go through. You haven't been charged.",
    };
  }

  writeAttempt(key, null);
  return { ok: true, sessionId: sessionId() };
}
