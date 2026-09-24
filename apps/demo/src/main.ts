import logo from "./brand/logo-black.svg";
import hoodie from "./products/hoodie.jpg";
import tee from "./products/tee.jpg";
import cap from "./products/cap.jpg";
import "./fonts.css";
import "./demo.css";

const photos: Record<string, string> = { hoodie, tee, cap };

type Entry = { time: string; name: string; payload: unknown };

const log = document.querySelector<HTMLOListElement>("#log");
const confirmation = document.querySelector<HTMLParagraphElement>("#confirmation");
const entries: Entry[] = [];

function stamp() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-GB", { hour12: false });
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${time}.${ms}`;
}

function render() {
  if (!log) return;
  log.replaceChildren();
  if (entries.length === 0) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "No callbacks yet. Buy to open checkout.";
    log.append(item);
    return;
  }
  for (const entry of entries) {
    const item = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = entry.time;
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const payload = document.createElement("span");
    payload.textContent = JSON.stringify(entry.payload);
    item.append(time, name, payload);
    log.append(item);
  }
}

function push(name: string, payload: unknown) {
  entries.unshift({ time: stamp(), name, payload });
  render();
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

function openCheckout(productId: string) {
  if (!window.DodoCheckout) {
    push("demo", { code: "sdk_missing", message: "The checkout script did not load." });
    return;
  }
  window.DodoCheckout.open({
    productId,
    onSuccess: (result) => {
      push("onSuccess", result);
      if (confirmation) {
        confirmation.hidden = false;
        confirmation.textContent = `Paid ${money(result.amount, result.currency)} · ${result.sessionId}`;
      }
    },
    onError: (error) => push("onError", error),
    onClose: (result) => push("onClose", result),
  });
}

const powered = document.querySelector<HTMLImageElement>("#powered");
if (powered) powered.src = logo;

document.querySelectorAll<HTMLImageElement>(".photo").forEach((img) => {
  const key = img.dataset.photo;
  if (key && photos[key]) img.src = photos[key];
});

document.querySelectorAll<HTMLButtonElement>(".buy").forEach((button) => {
  button.addEventListener("click", () => {
    const productId = button.dataset.product;
    if (productId) openCheckout(productId);
  });
});
document.querySelector("#buy-unknown")?.addEventListener("click", () => openCheckout("prod_missing"));
render();
