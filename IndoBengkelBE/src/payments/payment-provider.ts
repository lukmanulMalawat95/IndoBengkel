export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

/** Methods that a payment provider can charge. Cash is recorded directly. */
export type OnlinePaymentMethod = "va" | "bank_transfer" | "qris";

export interface PaymentChargeInput {
  /** Stable internal payment id, used by providers as their order reference. */
  paymentId: string;
  amount: number;
  method: OnlinePaymentMethod;
  expiresAt: Date;
}

export interface PaymentCharge {
  provider: string;
  providerRef: string;
  vaNumber?: string | null;
  qrString?: string | null;
  expiresAt: Date;
}

/**
 * The only surface the rest of the API knows about. A Midtrans adapter can be
 * added without touching checkout or invoice code: create a charge here and
 * map webhook updates onto the same `Payment` row.
 */
export interface PaymentProvider {
  readonly name: string;
  createCharge(input: PaymentChargeInput): Promise<PaymentCharge>;
}

export const ONLINE_PAYMENT_METHODS: OnlinePaymentMethod[] = ["va", "bank_transfer", "qris"];

export function isOnlinePaymentMethod(value: string): value is OnlinePaymentMethod {
  return ONLINE_PAYMENT_METHODS.includes(value as OnlinePaymentMethod);
}
