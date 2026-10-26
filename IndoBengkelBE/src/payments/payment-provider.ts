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

export type PaymentNotificationStatus = "paid" | "expired" | "failed" | "pending" | "ignored";

/** Provider-neutral result of verifying and parsing an inbound webhook. */
export interface PaymentNotification {
  /** Provider reference stored on the `Payment` row. */
  providerRef: string;
  amount: number;
  status: PaymentNotificationStatus;
  rawStatus: string;
  paidAt?: Date;
  transactionId?: string;
}

/**
 * The only surface the rest of the API knows about. A provider that can receive
 * callbacks implements `parseNotification`; the webhook controller stays
 * provider-neutral and the payment service owns the state transitions.
 */
export interface PaymentProvider {
  readonly name: string;
  createCharge(input: PaymentChargeInput): Promise<PaymentCharge>;
  parseNotification?(payload: unknown): PaymentNotification;
}

export const ONLINE_PAYMENT_METHODS: OnlinePaymentMethod[] = ["va", "bank_transfer", "qris"];

export function isOnlinePaymentMethod(value: string): value is OnlinePaymentMethod {
  return ONLINE_PAYMENT_METHODS.includes(value as OnlinePaymentMethod);
}
