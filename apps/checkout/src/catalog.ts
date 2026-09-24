export type Product = {
  id: string;
  name: string;
  detail: string;
  merchant: string;
  amount: number;
  currency: string;
};

export const catalog: Record<string, Product> = {
  prod_hoodie: {
    id: "prod_hoodie",
    name: "Wrap hoodie",
    detail: "Heavy fleece, one size",
    merchant: "Hale",
    amount: 8600,
    currency: "USD",
  },
  prod_tee: {
    id: "prod_tee",
    name: "Heavy tee",
    detail: "Cotton jersey",
    merchant: "Hale",
    amount: 3600,
    currency: "USD",
  },
  prod_cap: {
    id: "prod_cap",
    name: "Wool cap",
    detail: "Ribbed knit",
    merchant: "Hale",
    amount: 2400,
    currency: "USD",
  },
};

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}
