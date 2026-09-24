/// <reference types="vite/client" />

type CheckoutResult = {
  sessionId: string;
  productId: string;
  amount: number;
  currency: string;
};

type CheckoutError = { code: string; message: string };
type CloseResult = { reason: "success" | "dismissed" | "error" };

interface Window {
  DodoCheckout?: {
    open: (options: {
      productId: string;
      email?: string;
      onSuccess?: (result: CheckoutResult) => void;
      onClose?: (result: CloseResult) => void;
      onError?: (error: CheckoutError) => void;
    }) => void;
    close: () => void;
  };
}
