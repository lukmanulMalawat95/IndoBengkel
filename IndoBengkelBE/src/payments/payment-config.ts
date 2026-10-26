export type PaymentProviderName = "fake";

/**
 * Fake is the only implemented provider. Asking for Midtrans must fail at
 * startup instead of silently falling back: a payment that looks real but is
 * never charged is worse than a clear configuration error.
 */
export function configuredPaymentProvider(): PaymentProviderName {
  const raw = (process.env.PAYMENT_PROVIDER ?? "fake").trim().toLowerCase();
  if (raw === "" || raw === "fake") return "fake";
  if (raw === "midtrans") {
    throw new Error(
      "PAYMENT_PROVIDER=midtrans is not implemented yet. Use PAYMENT_PROVIDER=fake until the Midtrans adapter and webhook are added.",
    );
  }
  throw new Error(`Unknown PAYMENT_PROVIDER "${raw}". Supported values: fake.`);
}
