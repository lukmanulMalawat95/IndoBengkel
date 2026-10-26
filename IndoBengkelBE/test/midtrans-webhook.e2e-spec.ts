import { createHash } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  API,
  Agent,
  agentFor,
  createApp,
  registerCustomer,
  registerWorkshop,
  uniqueSuffix,
  WorkshopFixture,
} from "./helpers";

const SERVER_KEY = "test-server-key";

function signature(orderId: string, statusCode: string, grossAmount: string) {
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${SERVER_KEY}`)
    .digest("hex");
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 201,
    statusText: "Created",
    json: async () => body,
  } as Response;
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("Midtrans webhook", () => {
  const originalFetch = global.fetch;
  const originalProvider = process.env.PAYMENT_PROVIDER;
  const originalKey = process.env.MIDTRANS_SERVER_KEY;
  const originalIsProduction = process.env.MIDTRANS_IS_PRODUCTION;
  const originalVaBank = process.env.MIDTRANS_VA_BANK;
  const originalQrisAcquirer = process.env.MIDTRANS_QRIS_ACQUIRER;
  let app: INestApplication;
  let workshop: WorkshopFixture;
  let customer: Agent;
  let chargeSequence = 0;

  beforeAll(async () => {
    process.env.PAYMENT_PROVIDER = "midtrans";
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
    process.env.MIDTRANS_IS_PRODUCTION = "false";
    process.env.MIDTRANS_VA_BANK = "bca";
    process.env.MIDTRANS_QRIS_ACQUIRER = "gopay";

    global.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      chargeSequence += 1;
      return jsonResponse({
        status_code: "201",
        status_message: "OK",
        transaction_id: `tx-e2e-${chargeSequence}`,
        order_id: body.transaction_details.order_id,
        gross_amount: `${body.transaction_details.gross_amount}.00`,
        payment_type: body.payment_type,
        transaction_status: "pending",
        va_numbers:
          body.payment_type === "bank_transfer"
            ? [{ bank: "bca", va_number: `8808${chargeSequence}123456` }]
            : undefined,
        actions:
          body.payment_type === "qris"
            ? [
                {
                  name: "generate-qr-code",
                  method: "GET",
                  url: `https://api.sandbox.midtrans.com/v2/qris/tx-e2e-${chargeSequence}/qr-code`,
                },
              ]
            : undefined,
      });
    }) as typeof fetch;

    app = await createApp();
    workshop = await registerWorkshop(app);
    customer = (await registerCustomer(app)).agent;
  });

  afterAll(async () => {
    await app.close();
    global.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = originalProvider;
    if (originalKey === undefined) delete process.env.MIDTRANS_SERVER_KEY;
    else process.env.MIDTRANS_SERVER_KEY = originalKey;
    restoreEnv("MIDTRANS_IS_PRODUCTION", originalIsProduction);
    restoreEnv("MIDTRANS_VA_BANK", originalVaBank);
    restoreEnv("MIDTRANS_QRIS_ACQUIRER", originalQrisAcquirer);
  });

  async function createOrder() {
    const product = await workshop.agent
      .post(`${API}/workshop/products`)
      .send({
        title: `Midtrans Product ${uniqueSuffix()}`,
        description: "Produk untuk pengujian webhook Midtrans.",
        category: "oil",
        brand: "E2E",
        price: 50_000,
        weightGrams: 1_000,
        stock: 5,
      })
      .expect(201);

    await customer
      .post(`${API}/cart/items`)
      .send({ workshopId: workshop.workshop.id, productId: product.body.data.id, qty: 2 })
      .expect(201);

    const order = await customer
      .post(`${API}/orders`)
      .send({
        workshopId: workshop.workshop.id,
        fulfillment: "pickup",
        paymentMethod: "va",
        customerPhone: "+628111222333",
      })
      .expect(201);

    return order.body.data;
  }

  function notification(order: any, overrides: Record<string, unknown> = {}) {
    const grossAmount = `${order.total}.00`;
    return {
      order_id: order.payment.providerRef,
      status_code: "200",
      gross_amount: grossAmount,
      signature_key: signature(order.payment.providerRef, "200", grossAmount),
      transaction_id: `tx-${order.payment.providerRef}`,
      transaction_status: "settlement",
      settlement_time: "2026-10-27 10:00:00",
      ...overrides,
    };
  }

  it("settles a shop order from a signed Midtrans notification idempotently", async () => {
    const order = await createOrder();
    expect(order.payment).toMatchObject({
      provider: "midtrans",
      method: "va",
      status: "pending",
    });
    expect(order.payment.vaNumber).toBeTruthy();

    const first = await agentFor(app)
      .post(`${API}/payments/midtrans/notification`)
      .send(notification(order))
      .expect(200);
    expect(first.body.data).toMatchObject({
      status: "paid",
      kind: "order",
      rawStatus: "settlement",
    });

    const paid = await customer.get(`${API}/orders/${order.id}`).expect(200);
    expect(paid.body.data.status).toBe("paid");
    expect(paid.body.data.payment.status).toBe("paid");

    const again = await agentFor(app)
      .post(`${API}/payments/midtrans/notification`)
      .send(notification(order))
      .expect(200);
    expect(again.body.data).toMatchObject({ status: "already_paid", kind: "order" });
  });

  it("rejects an invalid signature without changing the order", async () => {
    const order = await createOrder();

    const response = await agentFor(app)
      .post(`${API}/payments/midtrans/notification`)
      .send(notification(order, { signature_key: "0".repeat(128) }))
      .expect(401);
    expect(response.body.error.code).toBe("INVALID_SIGNATURE");

    const current = await customer.get(`${API}/orders/${order.id}`).expect(200);
    expect(current.body.data.status).toBe("pending_payment");
    expect(current.body.data.payment.status).toBe("pending");
  });

  it("rejects an amount that does not match the stored payment", async () => {
    const order = await createOrder();
    const payload = notification(order, { gross_amount: "1.00" });
    payload.signature_key = signature(order.payment.providerRef, "200", "1.00");

    const response = await agentFor(app)
      .post(`${API}/payments/midtrans/notification`)
      .send(payload)
      .expect(400);
    expect(response.body.error.code).toBe("PAYMENT_AMOUNT_MISMATCH");

    const current = await customer.get(`${API}/orders/${order.id}`).expect(200);
    expect(current.body.data.status).toBe("pending_payment");
  });

  it("expires an order and restores stock from an expire notification", async () => {
    const order = await createOrder();
    const prisma = app.get(PrismaService);
    const productId = order.items[0].productId;
    const before = await prisma.product.findUnique({ where: { id: productId } });

    const response = await agentFor(app)
      .post(`${API}/payments/midtrans/notification`)
      .send(notification(order, { transaction_status: "expire" }))
      .expect(200);
    expect(response.body.data).toMatchObject({ kind: "order", changed: true });

    const current = await customer.get(`${API}/orders/${order.id}`).expect(200);
    expect(current.body.data.status).toBe("expired");
    expect(current.body.data.payment.status).toBe("expired");

    const after = await prisma.product.findUnique({ where: { id: productId } });
    expect(after?.stock).toBe((before?.stock ?? 0) + 2);
  });
});
