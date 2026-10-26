import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { ApiError } from "../common/api-error";
import { MidtransConfig } from "./payment-config";
import {
  PaymentCharge,
  PaymentChargeInput,
  PaymentNotification,
  PaymentNotificationStatus,
  PaymentProvider,
} from "./payment-provider";

interface MidtransAction {
  name: string;
  method: string;
  url: string;
}

interface MidtransChargeResponse {
  status_code?: string;
  status_message?: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  payment_type?: string;
  transaction_status?: string;
  va_numbers?: Array<{ bank: string; va_number: string }>;
  permata_va_number?: string;
  actions?: MidtransAction[];
}

interface MidtransNotificationPayload {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  transaction_id?: unknown;
  transaction_status?: unknown;
  fraud_status?: unknown;
  settlement_time?: unknown;
}

/**
 * Midtrans Core API adapter.
 *
 * Core API is used instead of Snap because the rest of the application already
 * exposes VA numbers and QRIS payloads. The adapter keeps the provider-specific
 * request/response shapes and SHA512 notification verification in one place.
 */
export class MidtransPaymentProvider implements PaymentProvider {
  readonly name = "midtrans";

  constructor(private readonly config: MidtransConfig) {}

  async createCharge(input: PaymentChargeInput): Promise<PaymentCharge> {
    const orderId = `${input.paymentId}-${randomUUID().replace(/-/g, "").slice(0, 8)}`.slice(0, 50);
    const now = new Date();
    const expiryMinutes = Math.max(
      1,
      Math.ceil((input.expiresAt.getTime() - now.getTime()) / 60_000),
    );

    const body: Record<string, unknown> = {
      payment_type: input.method === "qris" ? "qris" : "bank_transfer",
      transaction_details: {
        order_id: orderId,
        gross_amount: input.amount,
      },
      custom_expiry: {
        order_time: midtransTimestamp(now),
        expiry_duration: expiryMinutes,
        unit: "minute",
      },
    };

    if (input.method === "qris") {
      body.qris = { acquirer: this.config.qrisAcquirer };
    } else {
      body.bank_transfer = { bank: this.config.vaBank };
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/v2/charge`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.config.serverKey}:`).toString("base64")}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError("PAYMENT_PROVIDER_ERROR", "Midtrans is unreachable.", 502);
    }

    const payload = await readJson(response);
    const statusCode = String(payload.status_code ?? "");
    if (!response.ok || !["200", "201"].includes(statusCode)) {
      throw new ApiError(
        "PAYMENT_PROVIDER_ERROR",
        `Midtrans rejected the charge: ${String(payload.status_message ?? response.statusText)}`,
        502,
      );
    }

    const qrAction = payload.actions?.find(
      (action) => action.name === "generate-qr-code" || action.name === "generate-qr-code-v2",
    );

    return {
      provider: this.name,
      providerRef: String(payload.order_id ?? orderId),
      vaNumber: payload.va_numbers?.[0]?.va_number ?? payload.permata_va_number ?? null,
      qrString: qrAction?.url ?? null,
      expiresAt: input.expiresAt,
    };
  }

  /**
   * Verifies the Midtrans notification signature before reading any status.
   * `gross_amount` is kept as the exact string Midtrans sent because it is part
   * of the signature input.
   */
  parseNotification(payload: unknown): PaymentNotification {
    if (!payload || typeof payload !== "object") {
      throw new ApiError("VALIDATION_ERROR", "Invalid Midtrans notification.", 400);
    }

    const notification = payload as MidtransNotificationPayload;
    const orderId = requiredString(notification.order_id, "order_id");
    const statusCode = requiredString(notification.status_code, "status_code");
    const grossAmount = requiredString(notification.gross_amount, "gross_amount");
    const signature = requiredString(notification.signature_key, "signature_key");
    const transactionStatus = requiredString(notification.transaction_status, "transaction_status");

    const expected = createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${this.config.serverKey}`)
      .digest("hex");
    const actual = signature.toLowerCase();
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(actual, "utf8"))
    ) {
      throw new ApiError("INVALID_SIGNATURE", "Invalid Midtrans signature.", 401);
    }

    const amount = Math.round(Number(grossAmount));
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ApiError("VALIDATION_ERROR", "Invalid Midtrans gross_amount.", 400);
    }

    const status = mapTransactionStatus(
      transactionStatus,
      typeof notification.fraud_status === "string" ? notification.fraud_status : undefined,
    );
    const paidAt =
      status === "paid"
        ? (parseMidtransDate(notification.settlement_time) ?? new Date())
        : undefined;

    return {
      providerRef: orderId,
      amount,
      status,
      rawStatus: transactionStatus,
      paidAt,
      transactionId:
        typeof notification.transaction_id === "string" ? notification.transaction_id : undefined,
    };
  }

  private baseUrl() {
    return this.config.isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";
  }
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError("VALIDATION_ERROR", `Midtrans notification is missing ${field}.`, 400);
  }
  return value;
}

function mapTransactionStatus(
  transactionStatus: string,
  fraudStatus?: string,
): PaymentNotificationStatus {
  switch (transactionStatus) {
    case "capture":
      return fraudStatus === "accept" ? "paid" : "pending";
    case "settlement":
      return "paid";
    case "pending":
      return "pending";
    case "expire":
      return "expired";
    case "deny":
    case "cancel":
    case "failure":
      return "failed";
    default:
      return "ignored";
  }
}

function parseMidtransDate(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}+07:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function midtransTimestamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} +0700`;
}

async function readJson(response: Response): Promise<MidtransChargeResponse> {
  try {
    return (await response.json()) as MidtransChargeResponse;
  } catch {
    throw new ApiError("PAYMENT_PROVIDER_ERROR", "Midtrans returned an invalid response.", 502);
  }
}
