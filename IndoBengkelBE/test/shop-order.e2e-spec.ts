import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import { PaymentsService } from "../src/payments/payments.service";
import { configuredPaymentProvider } from "../src/payments/payment-config";
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

describe("BengkelShop orders", () => {
  let app: INestApplication;
  let workshop: WorkshopFixture;
  let customer: Agent;

  beforeAll(async () => {
    app = await createApp();
    workshop = await registerWorkshop(app);
    const registered = await registerCustomer(app);
    customer = registered.agent;
  });

  afterAll(async () => {
    await app.close();
  });

  async function addProduct(overrides: Record<string, unknown> = {}) {
    const response = await workshop.agent
      .post(`${API}/workshop/products`)
      .send({
        title: `E2E Product ${uniqueSuffix()}`,
        description: "Produk untuk pengujian otomatis.",
        category: "oil",
        brand: "E2E",
        price: 50_000,
        weightGrams: 1_200,
        stock: 5,
        ...overrides,
      })
      .expect(201);
    return response.body.data;
  }

  async function stockOf(productId: string) {
    const response = await agentFor(app)
      .get(`${API}/products?workshopId=${workshop.workshop.id}&perPage=100`)
      .expect(200);
    const product = response.body.data.find((entry: any) => entry.id === productId);
    expect(product).toBeDefined();
    return product.stock;
  }

  function addToCart(productId: string, qty = 1) {
    return customer
      .post(`${API}/cart/items`)
      .send({ workshopId: workshop.workshop.id, productId, qty });
  }

  async function createPickupOrder(productId: string, qty = 1) {
    await addToCart(productId, qty).expect(201);
    const response = await customer
      .post(`${API}/orders`)
      .send({
        workshopId: workshop.workshop.id,
        fulfillment: "pickup",
        paymentMethod: "va",
        customerPhone: "+628111222333",
      })
      .expect(201);
    return response.body.data;
  }

  it("stores per-workshop carts and clamps quantity to available stock", async () => {
    const product = await addProduct({ stock: 2 });

    const added = await addToCart(product.id, 5).expect(201);
    expect(added.body.data.workshopId).toBe(workshop.workshop.id);
    expect(added.body.data.items).toHaveLength(1);
    expect(added.body.data.items[0]).toMatchObject({ productId: product.id, qty: 2 });
    expect(added.body.data.subtotal).toBe(100_000);

    const carts = await customer.get(`${API}/cart`).expect(200);
    const cart = carts.body.data.find((entry: any) => entry.workshopId === workshop.workshop.id);
    expect(cart).toBeDefined();
    expect(cart.items[0].product.id).toBe(product.id);
  });

  it("rejects a product that does not belong to the given workshop", async () => {
    const product = await addProduct();
    const other = await registerWorkshop(app);

    await addToCart(product.id, 1).expect(201);

    const mismatch = await customer
      .post(`${API}/cart/items`)
      .send({ workshopId: other.workshop.id, productId: product.id, qty: 1 })
      .expect(404);
    expect(mismatch.body.error.code).toBe("NOT_FOUND");

    await customer.delete(`${API}/cart?workshopId=${workshop.workshop.id}`).expect(200);
  });

  it("reserves stock at order creation and restores it when the order is cancelled", async () => {
    const product = await addProduct({ stock: 5 });
    const order = await createPickupOrder(product.id, 2);

    expect(order).toMatchObject({
      status: "pending_payment",
      fulfillment: "pickup",
      subtotal: 100_000,
      shippingCost: 0,
      total: 100_000,
    });
    expect(order.pickupCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(order.payment).toMatchObject({ status: "pending", method: "va" });
    expect(order.payment.vaNumber).toBeTruthy();
    expect(await stockOf(product.id)).toBe(3);

    const cancelled = await customer.post(`${API}/orders/${order.id}/cancel`).expect(201);
    expect(cancelled.body.data.status).toBe("cancelled");
    expect(cancelled.body.data.payment.status).toBe("failed");
    expect(await stockOf(product.id)).toBe(5);

    const again = await customer.post(`${API}/orders/${order.id}/cancel`).expect(409);
    expect(again.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("marks a simulated order payment idempotently", async () => {
    const product = await addProduct({ stock: 5 });
    const order = await createPickupOrder(product.id, 1);

    const createdNotifications = await workshop.agent.get(`${API}/notifications`).expect(200);
    expect(
      createdNotifications.body.data.some((entry: any) => entry.type === "order_created"),
    ).toBe(true);

    const paid = await customer.post(`${API}/orders/${order.id}/pay`).expect(201);
    expect(paid.body.data.status).toBe("paid");
    expect(paid.body.data.payment.status).toBe("paid");

    const again = await customer.post(`${API}/orders/${order.id}/pay`).expect(201);
    expect(again.body.data.status).toBe("paid");
    expect(again.body.data.payment.id).toBe(paid.body.data.payment.id);
    expect(await stockOf(product.id)).toBe(4);
  });

  it("expires an unpaid order, restores stock and refuses payment", async () => {
    const product = await addProduct({ stock: 5 });
    const order = await createPickupOrder(product.id, 2);

    const prisma = app.get(PrismaService);
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const payments = app.get(PaymentsService);
    const summary = await payments.expirePendingPayments();
    expect(summary.orders).toBeGreaterThanOrEqual(1);

    const expired = await customer.get(`${API}/orders/${order.id}`).expect(200);
    expect(expired.body.data.status).toBe("expired");
    expect(expired.body.data.payment.status).toBe("expired");
    expect(await stockOf(product.id)).toBe(5);

    const blocked = await customer.post(`${API}/orders/${order.id}/pay`).expect(409);
    expect(blocked.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("completes a pickup order only with the correct pickup code", async () => {
    const product = await addProduct();
    const order = await createPickupOrder(product.id);

    await customer.post(`${API}/orders/${order.id}/pay`).expect(201);
    await workshop.agent.post(`${API}/workshop/orders/${order.id}/preparing`).expect(201);
    const ready = await workshop.agent.post(`${API}/workshop/orders/${order.id}/ready`).expect(201);
    expect(ready.body.data.status).toBe("ready_for_pickup");

    const wrong = await workshop.agent
      .post(`${API}/workshop/orders/${order.id}/verify-pickup`)
      .send({ pickupCode: "WRONG1" })
      .expect(400);
    expect(wrong.body.error.code).toBe("INVALID_PICKUP_CODE");

    const correct = await workshop.agent
      .post(`${API}/workshop/orders/${order.id}/verify-pickup`)
      .send({ pickupCode: order.pickupCode.toLowerCase() })
      .expect(201);
    expect(correct.body.data.status).toBe("completed");

    const shortComment = await customer
      .post(`${API}/reviews/product`)
      .send({ orderId: order.id, productId: product.id, rating: 5, comment: "Mantap" })
      .expect(422);
    expect(shortComment.body.error.code).toBe("VALIDATION_ERROR");

    const longComment = await customer
      .post(`${API}/reviews/product`)
      .send({ orderId: order.id, productId: product.id, rating: 5, comment: "x".repeat(501) })
      .expect(422);
    expect(longComment.body.error.code).toBe("VALIDATION_ERROR");

    const review = await customer
      .post(`${API}/reviews/product`)
      .send({ orderId: order.id, productId: product.id, rating: 5, comment: "Oli asli, cepat." })
      .expect(201);
    expect(review.body.data.productId).toBe(product.id);

    const duplicate = await customer
      .post(`${API}/reviews/product`)
      .send({ orderId: order.id, productId: product.id, rating: 4, comment: "Lagi." })
      .expect(409);
    expect(duplicate.body.error.code).toBe("ALREADY_REVIEWED");
  });

  it("locks product reviews until the order is completed", async () => {
    const product = await addProduct();
    const order = await createPickupOrder(product.id);

    const review = await customer
      .post(`${API}/reviews/product`)
      .send({ orderId: order.id, productId: product.id, rating: 5, comment: "Belum selesai." })
      .expect(409);
    expect(review.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("charges weight-based shipping, requires a tracking number and completes on delivery confirmation", async () => {
    const product = await addProduct({ weightGrams: 1_200 });

    await addToCart(product.id, 1).expect(201);
    const created = await customer
      .post(`${API}/orders`)
      .send({
        workshopId: workshop.workshop.id,
        fulfillment: "expedition",
        paymentMethod: "va",
        customerPhone: "+628111222333",
        shipping: {
          courier: "jne",
          address: {
            recipient: "E2E Customer",
            line: "Jl. Pengiriman No. 8",
            city: "Bandung",
            postalCode: "40111",
          },
        },
      })
      .expect(201);

    const order = created.body.data;
    expect(order.fulfillment).toBe("expedition");
    expect(order.shippingCost).toBe(24_000);
    expect(order.total).toBe(74_000);
    expect(order.shipping).toMatchObject({ courier: "jne" });

    await customer.post(`${API}/orders/${order.id}/pay`).expect(201);
    await workshop.agent.post(`${API}/workshop/orders/${order.id}/preparing`).expect(201);
    await workshop.agent.post(`${API}/workshop/orders/${order.id}/ready`).expect(201);

    const pickup = await workshop.agent
      .post(`${API}/workshop/orders/${order.id}/verify-pickup`)
      .send({ pickupCode: order.pickupCode })
      .expect(409);
    expect(pickup.body.error.code).toBe("INVALID_FULFILLMENT");

    const missingTracking = await workshop.agent
      .post(`${API}/workshop/orders/${order.id}/ship`)
      .send({ trackingNumber: "12" })
      .expect(400);
    expect(missingTracking.body.error.code).toBe("INVALID_TRACKING");

    const shipped = await workshop.agent
      .post(`${API}/workshop/orders/${order.id}/ship`)
      .send({ trackingNumber: "JNE-1234567890" })
      .expect(201);
    expect(shipped.body.data.status).toBe("shipped");
    expect(shipped.body.data.shipping.trackingNumber).toBe("JNE-1234567890");

    const delivered = await customer
      .post(`${API}/orders/${order.id}/confirm-delivery`)
      .expect(201);
    expect(delivered.body.data.status).toBe("completed");

    await customer.post(`${API}/orders/${order.id}/confirm-delivery`).expect(409);
  });

  it("requires a complete delivery address for expedition orders", async () => {
    const product = await addProduct();
    await addToCart(product.id, 1).expect(201);

    const response = await customer
      .post(`${API}/orders`)
      .send({
        workshopId: workshop.workshop.id,
        fulfillment: "expedition",
        shipping: { courier: "jne", address: { recipient: "E2E" } },
      })
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_SHIPPING");

    await customer.delete(`${API}/cart?workshopId=${workshop.workshop.id}`).expect(200);
  });

  it("rejects an empty cart and out-of-stock products", async () => {
    await customer.delete(`${API}/cart?workshopId=${workshop.workshop.id}`).expect(200);

    const noCart = await customer
      .post(`${API}/orders`)
      .send({ workshopId: workshop.workshop.id, fulfillment: "pickup" })
      .expect(400);
    expect(noCart.body.error.code).toBe("CART_EMPTY");

    const soldOut = await addProduct({ stock: 0 });
    const response = await addToCart(soldOut.id, 1).expect(409);
    expect(response.body.error.code).toBe("OUT_OF_STOCK");
  });

  it("refuses to start with an unimplemented payment provider", () => {
    const previous = process.env.PAYMENT_PROVIDER;
    try {
      process.env.PAYMENT_PROVIDER = "midtrans";
      expect(() => configuredPaymentProvider()).toThrow(/not implemented/);
      process.env.PAYMENT_PROVIDER = "nope";
      expect(() => configuredPaymentProvider()).toThrow(/Unknown PAYMENT_PROVIDER/);
    } finally {
      process.env.PAYMENT_PROVIDER = previous;
    }
  });
});
