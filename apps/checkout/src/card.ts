export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCard(value: string) {
  const pan = digits(value).slice(0, 16);
  return pan.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatExpiry(value: string) {
  const exp = digits(value).slice(0, 4);
  if (exp.length <= 2) return exp;
  return `${exp.slice(0, 2)} / ${exp.slice(2)}`;
}

export function formatCvc(value: string) {
  return digits(value).slice(0, 3);
}

export function last4(value: string) {
  const pan = digits(value);
  return pan.slice(-4);
}

export type CardBrand = "visa" | "mastercard" | "amex" | "rupay";

export function cardBrand(value: string): CardBrand | null {
  const pan = digits(value);
  if (!pan) return null;
  if (pan.startsWith("34") || pan.startsWith("37")) return "amex";
  if (pan.startsWith("4")) return "visa";
  const two = Number(pan.slice(0, 2));
  if (pan.length >= 2 && two >= 51 && two <= 55) return "mastercard";
  if (pan.length >= 4) {
    const four = Number(pan.slice(0, 4));
    if (four >= 2221 && four <= 2720) return "mastercard";
  }
  if (/^(60|65|81|82|508)/.test(pan)) return "rupay";
  return null;
}
