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
