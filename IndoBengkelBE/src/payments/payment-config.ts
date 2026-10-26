export type PaymentProviderName = "fake" | "midtrans";

export interface MidtransConfig {
  serverKey: string;
  isProduction: boolean;
  vaBank: string;
  qrisAcquirer: string;
}

/**
 * Fake remains the default for local, Docker and CI. Midtrans must be explicit
 * and must have a server key: failing at startup is safer than accepting a
 * payment that can never be charged.
 */
export function configuredPaymentProvider(): PaymentProviderName {
  const raw = (process.env.PAYMENT_PROVIDER ?? "fake").trim().toLowerCase();
  if (raw === "" || raw === "fake") return "fake";
  if (raw === "midtrans") {
    if (!process.env.MIDTRANS_SERVER_KEY?.trim()) {
      throw new Error(
        "PAYMENT_PROVIDER=midtrans requires MIDTRANS_SERVER_KEY. Keep PAYMENT_PROVIDER=fake for local development.",
      );
    }
    return "midtrans";
  }
  throw new Error(`Unknown PAYMENT_PROVIDER "${raw}". Supported values: fake, midtrans.`);
}

export function midtransConfig(): MidtransConfig {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY is required when PAYMENT_PROVIDER=midtrans.");
  }

  return {
    serverKey,
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    vaBank: process.env.MIDTRANS_VA_BANK?.trim().toLowerCase() || "bca",
    qrisAcquirer: process.env.MIDTRANS_QRIS_ACQUIRER?.trim().toLowerCase() || "gopay",
  };
}
