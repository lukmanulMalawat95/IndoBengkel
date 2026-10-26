import { INestApplication } from "@nestjs/common";
import {
  API,
  Agent,
  createApp,
  createBooking,
  createVehicle,
  inHours,
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

describe("Service booking lifecycle", () => {
  let app: INestApplication;
  let workshop: WorkshopFixture;
  let customer: Agent;
  let vehicleId: string;

  beforeAll(async () => {
    app = await createApp();
    workshop = await registerWorkshop(app, { servicePrice: 100_000 });
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

    const paid = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "qris" })
      .expect(201);
    expect(paid.body.data.status).toBe("paid");
    expect(paid.body.data.paymentMethod).toBe("qris");

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

    const paid = await customer
      .post(`${API}/service-orders/${booking.id}/pay`)
      .send({ method: "va" })
      .expect(201);
    expect(paid.body.data.status).toBe("paid");
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
  });

  it("enforces the cancellation window and blocks later transitions", async () => {
    const early = await newBooking({ scheduledAt: inHours(6).toISOString() });
    expect(early.status).toBe(201);
    const cancelled = await customer
      .post(`${API}/service-orders/${early.body.data.id}/cancel`)
      .expect(201);
    expect(cancelled.body.data.status).toBe("cancelled");

    const late = await newBooking({ scheduledAt: inHours(1.5).toISOString() });
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
