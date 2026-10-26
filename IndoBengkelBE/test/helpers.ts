import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

export const PASSWORD = "password123";
export const API = "/api/v1";

export type Agent = ReturnType<typeof request.agent>;

let sequence = 0;

export function uniqueSuffix() {
  sequence += 1;
  return `${Date.now()}-${sequence}`;
}

export function uniqueEmail(prefix: string) {
  return `${prefix}.${uniqueSuffix()}@e2e.indobengkel.test`;
}

export function uniquePlate() {
  return `E2E${String(Date.now()).slice(-6)}${sequence}`;
}

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

export function agentFor(app: INestApplication): Agent {
  return request.agent(app.getHttpServer());
}

export interface CustomerFixture {
  agent: Agent;
  user: { id: string; email: string; role: string; fullName: string };
}

export async function registerCustomer(app: INestApplication): Promise<CustomerFixture> {
  const agent = agentFor(app);
  const email = uniqueEmail("customer");
  const response = await agent
    .post(`${API}/auth/register/customer`)
    .send({
      email,
      password: PASSWORD,
      fullName: "E2E Customer",
      phone: "+628111222333",
    })
    .expect(201);

  return { agent, user: response.body.data };
}

export interface WorkshopFixture {
  agent: Agent;
  owner: { id: string; email: string; role: string };
  workshop: {
    id: string;
    slug: string;
    name: string;
    status: string;
    workshopType: string;
  };
  serviceId: string;
  mechanicId: string;
}

export interface WorkshopOptions {
  type?: "motor" | "mobil";
  /** Skip email verification and cover upload, leaving the workshop in `draft`. */
  activate?: boolean;
  servicePrice?: number;
  serviceName?: string;
}

export async function registerWorkshop(
  app: INestApplication,
  options: WorkshopOptions = {},
): Promise<WorkshopFixture> {
  const type = options.type ?? "motor";
  const agent = agentFor(app);
  const email = uniqueEmail("owner");
  const name = `E2E ${type} workshop ${uniqueSuffix()}`;

  const registered = await agent
    .post(`${API}/auth/register/workshop`)
    .send({
      email,
      password: PASSWORD,
      ownerName: "E2E Owner",
      phone: "+628111222444",
      workshopName: name,
      workshopType: type,
      addressLine: "Jl. Pengujian No. 1",
      city: "Jakarta",
      lat: -6.2,
      lng: 106.8,
    })
    .expect(201);

  const owner = registered.body.data;

  if (options.activate !== false) {
    await agent.post(`${API}/auth/verify-email`).send({ userId: owner.id }).expect(201);
    await agent
      .patch(`${API}/workshop/me`)
      .send({ coverUrl: "https://example.test/cover.jpg" })
      .expect(200);
  }

  const me = await agent.get(`${API}/workshop/me`).expect(200);
  const workshop = me.body.data;

  const mechanic = await agent
    .post(`${API}/workshop/mechanics`)
    .send({ name: "E2E Mechanic", phone: "+628111222555", skills: ["general"], isActive: true })
    .expect(201);

  const service = await agent
    .post(`${API}/workshop/services`)
    .send({
      name: options.serviceName ?? "E2E Tune Up",
      price: options.servicePrice ?? 100_000,
      durationMinutes: 60,
      kind: "labor",
    })
    .expect(201);

  return {
    agent,
    owner,
    workshop,
    serviceId: service.body.data.id,
    mechanicId: mechanic.body.data.id,
  };
}

export async function createVehicle(
  customer: Agent,
  overrides: Record<string, unknown> = {},
) {
  const response = await customer
    .post(`${API}/vehicles`)
    .send({
      type: "motor",
      brand: "Honda",
      model: "Vario",
      year: 2022,
      plateNumber: uniquePlate(),
      color: "Hitam",
      odometerKm: 10_000,
      ...overrides,
    })
    .expect(201);
  return response.body.data;
}

export function inHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Next full hour in Jakarta at least `hours` from now. Booking slots are
 * hourly windows, so fixtures must send aligned timestamps.
 */
export function nextSlotAfter(hours: number) {
  const shifted = Date.now() + hours * 60 * 60 * 1000 + JAKARTA_OFFSET_MS;
  const boundary = Math.ceil(shifted / 3_600_000) * 3_600_000 - JAKARTA_OFFSET_MS;
  return new Date(boundary);
}

/**
 * First hourly slot at least `hoursAhead` from now that fits the default
 * workshop schedule created by `registerWorkshop` (08:00–18:00, closed Sunday).
 */
export function nextOpenSlot(hoursAhead = 2) {
  let slot = nextSlotAfter(hoursAhead);
  for (let attempt = 0; attempt < 24 * 10; attempt += 1) {
    const shifted = new Date(slot.getTime() + JAKARTA_OFFSET_MS);
    const day = shifted.getUTCDay();
    const hour = shifted.getUTCHours();
    if (day !== 0 && hour >= 8 && hour < 18) return slot;
    slot = new Date(slot.getTime() + 3_600_000);
  }
  throw new Error("No open slot found within 10 days");
}

/** Make a fixture workshop bookable at any hour (tests for time windows). */
export async function openAllDay(agent: Agent) {
  await agent
    .patch(`${API}/workshop/me`)
    .send({
      hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        openTime: "00:00",
        closeTime: "24:00",
        isClosed: false,
      })),
      closures: [],
    })
    .expect(200);
}

export interface BookingInput {
  workshopId: string;
  vehicleId: string;
  serviceIds: string[];
  scheduledAt?: Date | string;
  complaint?: string;
  odometer?: number;
}

export async function createBooking(customer: Agent, input: BookingInput) {
  const response = await customer
    .post(`${API}/service-orders`)
    .send({
      workshopId: input.workshopId,
      vehicleId: input.vehicleId,
      serviceIds: input.serviceIds,
      scheduledAt: input.scheduledAt ?? nextOpenSlot(2).toISOString(),
      complaint: input.complaint ?? "Mesin berbunyi kasar saat digas pelan.",
      odometer: input.odometer ?? 10_000,
    });
  return response;
}
