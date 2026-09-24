import { digits } from "./card";

export type FieldErrors = {
  email?: string;
  card?: string;
  expiry?: string;
  cvc?: string;
};

export function luhn(pan: string) {
  if (!/^\d{13,19}$/.test(pan)) return false;
  let sum = 0;
  let alt = false;
  for (let i = pan.length - 1; i >= 0; i -= 1) {
    let n = pan.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function validate(
  input: { email: string; card: string; expiry: string; cvc: string },
  now = new Date(),
): FieldErrors {
  const errors: FieldErrors = {};
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email.";

  if (!luhn(digits(input.card))) errors.card = "Enter a valid card number.";

  const exp = digits(input.expiry);
  const month = Number(exp.slice(0, 2));
  const year = 2000 + Number(exp.slice(2));
  const expiryIndex = year * 12 + month;
  const nowIndex = now.getFullYear() * 12 + (now.getMonth() + 1);
  if (exp.length !== 4 || month < 1 || month > 12 || expiryIndex < nowIndex) {
    errors.expiry = "Enter a future expiry date.";
  }

  if (!/^\d{3}$/.test(input.cvc)) errors.cvc = "Enter the 3-digit security code.";
  return errors;
}

export function firstInvalid(errors: FieldErrors): keyof FieldErrors | null {
  if (errors.email) return "email";
  if (errors.card) return "card";
  if (errors.expiry) return "expiry";
  if (errors.cvc) return "cvc";
  return null;
}
