import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import { PaymentsService } from "../src/payments/payments.service";
import {
  API,
  Agent,
  createApp,
  createBooking,
  createVehicle,
  inHours,
  nextOpenSlot,
  nextSlotAfter,
  openAllDay,
  registerCustomer,
  registerWorkshop,
  WorkshopFixture,
} from "./helpers";

const invoiceItem = (price: number, name = "Jasa servis") => ({
  name,
  kind: "labor",
  qty: 1,
  unitPrice: price,
  subtotal: price,
});

function jakartaDateKey(offsetDays: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

function nextOpenDay(offsetDays = 2) {
  for (let offset = offsetDays; offset < offsetDays + 10; offset += 1) {
    const key = jakartaDateKey(offset);
    const day = new Date(`${key}T12:00:00+07:00`).getUTCDay();
    if (day !== 0) return key;
  }
  throw new Error("No open day found within 10 days");
}

describe("Service booking lifecycle", () => {
  let app: INestApplication;
  let workshop: WorkshopFixture;
  let customer: Agent;
  let vehicleId: string;

  beforeAll(async () => {
    app = await createApp();
    workshop = await registerWorkshop(app, { servicePrice: 100_000 });
    // Most tests exercise lifecycle rules rather than opening hours, so this
    // workshop accepts any hourly slot; slot/closure rules get their own tests.
    await openAllDay(workshop.agent);
    await workshop.agent
      .patch(`${API}/workshop/me`)
      .send({ slotCapacityPerHour: 50 })
      .expect(200);
    const registered = await registerCustomer(app);
    customer = registered.agent;
    const vehicle = await createVehicle(customer, { odometerKm: 10_000 });
    vehicleId = vehicle.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function currentOdometer() {
    const response = await customer.get(`${API}/vehicles/${vehicleId}`).expect(200);
    return response.body.data.odometerKm as number;
  }

  async function newBooking(overrides: Record<string, unknown> = {}) {
    const response = await createBooking(customer, {
      workshopId: workshop.workshop.id,
      vehicleId,
      serviceIds: [workshop.serviceId],
      odometer: await currentOdometer(),
      ...overrides,
    });
    return response;
  }

  async function confirmedBooking() {
    const created = await newBooking();
    expect(created.status).toBe(201);
    await workshop.agent
      .post(`${API}/workshop/bookings/${created.body.data.id}/confirm`)
      .send({ estimatedTotal: 120_000 })
      .expect(201);
    return created.body.data;
  }

  async function inProgressBooking() {
    const booking = await confirmedBooking();
    await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/start`)
      .send({ odometerIn: booking.odometerIn + 500, mechanicIds: [workshop.mechanicId] })
      .expect(201);
    return booking;
  }

  it("creates a requested booking from the service snapshot and notifies the owner", async () => {
    const response = await newBooking();
    expect(response.status).toBe(201);
    const booking = response.body.data;

    expect(booking).toMatchObject({
      status: "requested",
      workshopId: workshop.workshop.id,
      vehicleId,
      estimatedTotal: 100_000,
      plateNumber: expect.any(String),
    });
    expect(booking.items).toHaveLength(1);
    expect(booking.items[0]).toMatchObject({ name: "E2E Tune Up", qty: 1, unitPrice: 100_000 });

    const notifications = await workshop.agent.get(`${API}/notifications`).expect(200);
    expect(
      notifications.body.data.some((entry: any) => entry.type === "booking_requested"),
    ).toBe(true);
  });

  it("rejects invalid booking input with specific codes", async () => {
    const shortComplaint = await newBooking({ complaint: "rusak" });
    expect(shortComplaint.status).toBe(422);
    expect(shortComplaint.body.error.code).toBe("VALIDATION_ERROR");

    const lowOdometer = await newBooking({ odometer: 1 });
    expect(lowOdometer.status).toBe(422);
    expect(lowOdometer.body.error.code).toBe("ODOMETER_TOO_LOW");

    const tooSoon = await newBooking({ scheduledAt: inHours(0.5).toISOString() });
    expect(tooSoon.status).toBe(409);
    expect(tooSoon.body.error.code).toBe("SLOT_FULL");

    const noServices = await newBooking({ serviceIds: [] });
    expect(noServices.status).toBe(422);
    expect(noServices.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("only accepts hourly slots inside opening hours and outside closures", async () => {
    const shop = await registerWorkshop(app);
    const date = nextOpenDay();
    const base = {
      workshopId: shop.workshop.id,
      vehicleId,
      serviceIds: [shop.serviceId],
    };

    const outside = await newBooking({
      ...base,
      scheduledAt: new Date(`${date}T03:00:00+07:00`).toISOString(),
    });
    expect(outside.status).toBe(422);
    expect(outside.body.error.code).toBe("WORKSHOP_CLOSED");

    const misaligned = await newBooking({
      ...base,
      scheduledAt: new Date(`${date}T10:30:00+07:00`).toISOString(),
    });
    expect(misaligned.status).toBe(422);
    expect(misaligned.body.error.code).toBe("VALIDATION_ERROR");

    await shop.agent
      .patch(`${API}/workshop/me`)
      .send({ closures: [{ id: "closure-e2e", date, reason: "Stock take" }] })
      .expect(200);
    const closed = await newBooking({
      ...base,
      scheduledAt: new Date(`${date}T10:00:00+07:00`).toISOString(),
    });
    expect(closed.status).toBe(422);
    expect(closed.body.error.code).toBe("WORKSHOP_CLOSED");

    const open = await newBooking({
      ...base,
      scheduledAt: new Date(`${nextOpenDay(3)}T10:00:00+07:00`).toISOString(),
    });
    expect(open.status).toBe(201);
  });

  it("re-checks hourly capacity when a booking is confirmed", async () => {
    const shop = await registerWorkshop(app);
    await openAllDay(shop.agent);
    const scheduledAt = new Date(`${nextOpenDay()}T10:00:00+07:00`).toISOString();
    const base = {
      workshopId: shop.workshop.id,
      vehicleId,
      serviceIds: [shop.serviceId],
      scheduledAt,
    };

    // Requested bookings do not lock capacity, so both requests are accepted.
    const first = await newBooking(base);
    const second = await newBooking(base);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    await shop.agent
      .post(`${API}/workshop/bookings/${first.body.data.id}/confirm`)
      .send({ estimatedTotal: 100_000 })
      .expect(201);

    const blocked = await shop.agent
      .post(`${API}/workshop/bookings/${second.body.data.id}/confirm`)
      .send({ estimatedTotal: 100_000 })
      .expect(409);
    expect(blocked.body.error.code).toBe("SLOT_FULL");

    const full = await newBooking(base);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe("SLOT_FULL");
  });

  it("rejects a booking for a workshop of the other vehicle type", async () => {
    const carWorkshop = await registerWorkshop(app, { type: "mobil" });
    const response = await newBooking({ workshopId: carWorkshop.workshop.id });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VEHICLE_TYPE_MISMATCH");
  });

  it("rejects a booking for a workshop that is still a draft", async () => {
    const draft = await registerWorkshop(app, { activate: false });
    const response = await newBooking({ workshopId: draft.workshop.id });
    expect(response.status).toBe(404);
  });

  it("moves a booking through confirm, start, complete and pay, then unlocks the review", async () => {
    const booking = await inProgressBooking();

    const started = await customer.get(`${API}/service-orders/${booking.id}`).expect(200);
    expect(started.body.data.status).toBe("in_progress");
    expect(started.body.data.mechanicIds).toEqual([workshop.mechanicId]);

    // Odometer only changes once the service is completed.
    const beforeComplete = await customer.get(`${API}/vehicles/${vehicleId}`).expect(200);
    expect(beforeComplete.body.data.odometerKm).toBe(booking.odometerIn);

    const completed = await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/complete`)
      .send({
        items: [invoiceItem(150_000)],
        photos: [],
        mechanicNote: "Ganti oli dan setel klep.",
        finalTotal: 150_000,
      })
      .expect(201);

    expect(completed.body.data.status).toBe("completed");
    expect(completed.body.data.finalTotal).toBe(150_000);
    expect(completed.body.data.odometerOut).toBe(booking.odometerIn + 500);

    const afterComplete = await customer.get(`${API}/vehicles/${vehicleId}`).expect(200);
    expect(afterComplete.body.data.odometerKm).toBe(booking.odometerIn + 500);

    const pending = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "qris" })
      .expect(201);
    expect(pending.body.data.status).toBe("completed");
    expect(pending.body.data.payment).toMatchObject({
      status: "pending",
      method: "qris",
      provider: "fake",
    });
    expect(pending.body.data.payment.qrString).toBeTruthy();

    const paid = await customer
      .post(`${API}/service-orders/${booking.id}/simulate-paid`)
      .expect(201);
    expect(paid.body.data.status).toBe("paid");
    expect(paid.body.data.paymentMethod).toBe("qris");
    expect(paid.body.data.payment).toMatchObject({ status: "paid", method: "qris" });

    const shortComment = await customer
      .post(`${API}/reviews/workshop`)
      .send({ serviceOrderId: booking.id, rating: 5, comment: "Bagus" })
      .expect(422);
    expect(shortComment.body.error.code).toBe("VALIDATION_ERROR");

    const longComment = await customer
      .post(`${API}/reviews/workshop`)
      .send({ serviceOrderId: booking.id, rating: 5, comment: "x".repeat(501) })
      .expect(422);
    expect(longComment.body.error.code).toBe("VALIDATION_ERROR");

    const review = await customer
      .post(`${API}/reviews/workshop`)
      .send({
        serviceOrderId: booking.id,
        rating: 5,
        comment: "Pengerjaan cepat dan invoice sesuai estimasi.",
        tags: ["fast", "honest"],
      })
      .expect(201);
    expect(review.body.data.rating).toBe(5);

    const duplicate = await customer
      .post(`${API}/reviews/workshop`)
      .send({ serviceOrderId: booking.id, rating: 4, comment: "Review kedua." })
      .expect(409);
    expect(duplicate.body.error.code).toBe("ALREADY_REVIEWED");
  });

  it("keeps reviews locked until the invoice is paid", async () => {
    const booking = await inProgressBooking();
    await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/complete`)
      .send({ items: [invoiceItem(120_000)], finalTotal: 120_000 })
      .expect(201);

    const review = await customer
      .post(`${API}/reviews/workshop`)
      .send({ serviceOrderId: booking.id, rating: 5, comment: "Belum dibayar." })
      .expect(409);
    expect(review.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("requires customer approval when the invoice exceeds 150% of the estimate", async () => {
    const booking = await inProgressBooking();

    const completed = await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/complete`)
      .send({ items: [invoiceItem(200_000)], finalTotal: 200_000 })
      .expect(201);
    expect(completed.body.data.status).toBe("awaiting_approval");

    const prematurePay = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "va" })
      .expect(409);
    expect(prematurePay.body.error.code).toBe("INVALID_TRANSITION");

    const approved = await customer
      .post(`${API}/service-orders/${booking.id}/approve-estimate`)
      .expect(201);
    expect(approved.body.data.status).toBe("completed");

    const pending = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "va" })
      .expect(201);
    expect(pending.body.data.status).toBe("completed");
    expect(pending.body.data.payment).toMatchObject({ status: "pending", method: "va" });
    expect(pending.body.data.payment.vaNumber).toBeTruthy();

    const paid = await customer
      .post(`${API}/service-orders/${booking.id}/simulate-paid`)
      .expect(201);
    expect(paid.body.data.status).toBe("paid");
    expect(paid.body.data.payment).toMatchObject({ status: "paid", method: "va" });
  });

  it("returns an over-estimate job to in_progress when the customer rejects it", async () => {
    const booking = await inProgressBooking();
    await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/complete`)
      .send({ items: [invoiceItem(200_000)], finalTotal: 200_000 })
      .expect(201);

    const rejected = await customer
      .post(`${API}/service-orders/${booking.id}/reject-estimate`)
      .expect(201);
    expect(rejected.body.data.status).toBe("in_progress");
  });

  it("reuses one invoice payment until it is paid", async () => {
    const booking = await inProgressBooking();
    await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/complete`)
      .send({ items: [invoiceItem(120_000)], finalTotal: 120_000 })
      .expect(201);

    const first = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "qris" })
      .expect(201);
    const second = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "qris" })
      .expect(201);
    expect(second.body.data.payment.id).toBe(first.body.data.payment.id);
    expect(second.body.data.payment.status).toBe("pending");

    const paid = await customer
      .post(`${API}/service-orders/${booking.id}/simulate-paid`)
      .expect(201);
    const again = await customer
      .post(`${API}/service-orders/${booking.id}/simulate-paid`)
      .expect(201);
    expect(again.body.data.status).toBe("paid");
    expect(again.body.data.payment.id).toBe(paid.body.data.payment.id);
  });

  it("expires an unpaid invoice and lets the customer retry", async () => {
    const booking = await inProgressBooking();
    await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/complete`)
      .send({ items: [invoiceItem(120_000)], finalTotal: 120_000 })
      .expect(201);

    const pending = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "va" })
      .expect(201);
    const paymentId = pending.body.data.payment.id;

    const prisma = app.get(PrismaService);
    await prisma.payment.update({
      where: { id: paymentId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const payments = app.get(PaymentsService);
    const summary = await payments.expirePendingPayments();
    expect(summary.serviceOrders).toBeGreaterThanOrEqual(1);

    const expired = await customer.get(`${API}/service-orders/${booking.id}`).expect(200);
    expect(expired.body.data.status).toBe("completed");
    expect(expired.body.data.payment.status).toBe("expired");

    const blocked = await customer
      .post(`${API}/service-orders/${booking.id}/simulate-paid`)
      .expect(409);
    expect(blocked.body.error.code).toBe("PAYMENT_EXPIRED");

    const retry = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "qris" })
      .expect(201);
    expect(retry.body.data.payment.id).toBe(paymentId);
    expect(retry.body.data.payment.status).toBe("pending");
  });

  it("records a cash payment and marks the service paid", async () => {
    const booking = await inProgressBooking();
    await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/complete`)
      .send({ items: [invoiceItem(120_000)], finalTotal: 120_000 })
      .expect(201);

    const cash = await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/cash-paid`)
      .expect(201);
    expect(cash.body.data.status).toBe("paid");
    expect(cash.body.data.paymentMethod).toBe("cash");
    expect(cash.body.data.payment).toMatchObject({
      provider: "cash",
      method: "cash",
      status: "paid",
    });
  });

  it("enforces the cancellation window and blocks later transitions", async () => {
    const early = await newBooking({ scheduledAt: nextSlotAfter(6).toISOString() });
    expect(early.status).toBe(201);
    const cancelled = await customer
      .post(`${API}/service-orders/${early.body.data.id}/cancel`)
      .expect(201);
    expect(cancelled.body.data.status).toBe("cancelled");

    const late = await newBooking({ scheduledAt: nextSlotAfter(1.01).toISOString() });
    expect(late.status).toBe(201);
    const blocked = await customer
      .post(`${API}/service-orders/${late.body.data.id}/cancel`)
      .expect(409);
    expect(blocked.body.error.code).toBe("CANCELLATION_WINDOW_CLOSED");

    const confirmCancelled = await workshop.agent
      .post(`${API}/workshop/bookings/${early.body.data.id}/confirm`)
      .send({ estimatedTotal: 100_000 })
      .expect(409);
    expect(confirmCancelled.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("declines a booking with a reason and refuses to confirm it afterwards", async () => {
    const created = await newBooking();
    expect(created.status).toBe(201);

    const declined = await workshop.agent
      .post(`${API}/workshop/bookings/${created.body.data.id}/decline`)
      .send({ reason: "Slot penuh" })
      .expect(201);
    expect(declined.body.data.status).toBe("declined");
    expect(declined.body.data.cancelReason).toBe("Slot penuh");

    await workshop.agent
      .post(`${API}/workshop/bookings/${created.body.data.id}/confirm`)
      .send({ estimatedTotal: 100_000 })
      .expect(409);
  });

  it("marks a confirmed no-show and refuses to start it", async () => {
    const booking = await confirmedBooking();

    const noShow = await workshop.agent
      .post(`${API}/workshop/bookings/${booking.id}/no-show`)
      .expect(201);
    expect(noShow.body.data.status).toBe("no_show");

    await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/start`)
      .send({ odometerIn: booking.odometerIn + 500, mechanicIds: [workshop.mechanicId] })
      .expect(409);
  });

  it("requires an active mechanic before a service can start", async () => {
    const booking = await confirmedBooking();

    const noMechanic = await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/start`)
      .send({ odometerIn: booking.odometerIn + 500, mechanicIds: [] })
      .expect(422);
    expect(noMechanic.body.error.code).toBe("VALIDATION_ERROR");

    await workshop.agent
      .post(`${API}/workshop/service-orders/${booking.id}/start`)
      .send({ odometerIn: booking.odometerIn + 500, mechanicIds: [workshop.mechanicId] })
      .expect(201);
  });
});
