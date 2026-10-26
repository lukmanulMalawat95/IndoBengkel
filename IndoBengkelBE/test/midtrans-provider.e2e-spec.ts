import { createHash } from "node:crypto";
import { MidtransPaymentProvider } from "../src/payments/midtrans-payment.provider";

const config = {
  serverKey: "test-server-key",
  isProduction: false,
  vaBank: "bca",
  qrisAcquirer: "gopay",
};

function signature(orderId: string, statusCode: string, grossAmount: string) {
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${config.serverKey}`)
    .digest("hex");
}

function jsonResponse(body: unknown, status = 201) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 201 ? "Created" : "OK",
    json: async () => body,
  } as Response;
}

describe("MidtransPaymentProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("creates a bank transfer charge and maps the VA number", async () => {
    let request: { url: string; init: RequestInit } | undefined;
    global.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      request = { url: String(url), init: init ?? {} };
      const body = JSON.parse(String(init?.body));
      return jsonResponse({
        status_code: "201",
        status_message: "OK",
        transaction_id: "tx-va-1",
        order_id: body.transaction_details.order_id,
        gross_amount: "150000.00",
        payment_type: "bank_transfer",
        transaction_status: "pending",
        va_numbers: [{ bank: "bca", va_number: "12345678901" }],
      });
    }) as typeof fetch;

    const provider = new MidtransPaymentProvider(config);
    const charge = await provider.createCharge({
      paymentId: "pay-va-1",
      amount: 150_000,
      method: "va",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(request?.url).toBe("https://api.sandbox.midtrans.com/v2/charge");
    const headers = request?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`,
    );
    const body = JSON.parse(String(request?.init.body));
    expect(body.payment_type).toBe("bank_transfer");
    expect(body.bank_transfer).toEqual({ bank: "bca" });
    expect(body.transaction_details.gross_amount).toBe(150_000);
    expect(body.custom_expiry.unit).toBe("minute");

    expect(charge).toMatchObject({
      provider: "midtrans",
      vaNumber: "12345678901",
      qrString: null,
    });
    expect(charge.providerRef).toMatch(/^pay-va-1-/);
  });

  it("creates a QRIS charge and maps the generated QR URL", async () => {
    let body: any;
    global.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return jsonResponse({
        status_code: "201",
        status_message: "OK",
        transaction_id: "tx-qris-1",
        order_id: body.transaction_details.order_id,
        gross_amount: "50000.00",
        payment_type: "qris",
        transaction_status: "pending",
        actions: [
          {
            name: "generate-qr-code",
            method: "GET",
            url: "https://api.sandbox.midtrans.com/v2/qris/tx-qris-1/qr-code",
          },
        ],
      });
    }) as typeof fetch;

    const provider = new MidtransPaymentProvider(config);
    const charge = await provider.createCharge({
      paymentId: "pay-qris-1",
      amount: 50_000,
      method: "qris",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    expect(body.payment_type).toBe("qris");
    expect(body.qris).toEqual({ acquirer: "gopay" });
    expect(charge.vaNumber).toBeNull();
    expect(charge.qrString).toBe(
      "https://api.sandbox.midtrans.com/v2/qris/tx-qris-1/qr-code",
    );
  });

  it("verifies the SHA512 signature and parses a settlement notification", () => {
    const orderId = "pay-123-attempt";
    const statusCode = "200";
    const grossAmount = "150000.00";
    const provider = new MidtransPaymentProvider(config);

    const notification = provider.parseNotification({
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature(orderId, statusCode, grossAmount),
      transaction_id: "tx-123",
      transaction_status: "settlement",
      settlement_time: "2026-10-27 10:00:00",
    });

    expect(notification).toMatchObject({
      providerRef: orderId,
      amount: 150_000,
      status: "paid",
      rawStatus: "settlement",
      transactionId: "tx-123",
    });
    expect(notification.paidAt).toBeInstanceOf(Date);
  });

  it("rejects a notification with an invalid signature", () => {
    const provider = new MidtransPaymentProvider(config);
    expect(() =>
      provider.parseNotification({
        order_id: "pay-123-attempt",
        status_code: "200",
        gross_amount: "150000.00",
        signature_key: "0".repeat(128),
        transaction_status: "settlement",
      }),
    ).toThrow("Invalid Midtrans signature.");
  });

  it.each([
    ["pending", undefined, "pending"],
    ["capture", "accept", "paid"],
    ["capture", "challenge", "pending"],
    ["settlement", undefined, "paid"],
    ["expire", undefined, "expired"],
    ["deny", undefined, "failed"],
    ["cancel", undefined, "failed"],
    ["failure", undefined, "failed"],
    ["refund", undefined, "ignored"],
  ])("maps %s/%s to %s", (transactionStatus, fraudStatus, expected) => {
    const orderId = "pay-map";
    const statusCode = "200";
    const grossAmount = "10000.00";
    const provider = new MidtransPaymentProvider(config);

    const notification = provider.parseNotification({
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature(orderId, statusCode, grossAmount),
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
    });

    expect(notification.status).toBe(expected);
  });
});
