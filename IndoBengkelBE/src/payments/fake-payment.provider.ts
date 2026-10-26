import { randomUUID } from "node:crypto";
import { PaymentCharge, PaymentChargeInput, PaymentProvider } from "./payment-provider";

/**
 * Local stand-in for a real gateway. It never touches the network, which keeps
 * development, CI and Docker deterministic. The instructions look like real
 * ones so the UI can be built against the same contract Midtrans will return.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";

  async createCharge(input: PaymentChargeInput): Promise<PaymentCharge> {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
    return {
      provider: this.name,
      providerRef: `FAKE-${suffix}`,
      vaNumber:
        input.method === "va" || input.method === "bank_transfer"
          ? `8808 ${this.digits(4)} ${this.digits(4)}`
          : null,
      qrString: input.method === "qris" ? `00020101021226${suffix}5802ID` : null,
      expiresAt: input.expiresAt,
    };
  }

  private digits(length: number) {
    let out = "";
    for (let index = 0; index < length; index += 1) {
      out += String(Math.floor(Math.random() * 10));
    }
    return out;
  }
}
