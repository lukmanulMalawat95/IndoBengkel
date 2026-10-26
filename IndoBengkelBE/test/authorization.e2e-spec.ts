import { INestApplication } from "@nestjs/common";
import {
  API,
  agentFor,
  createApp,
  createBooking,
  createVehicle,
  registerCustomer,
  registerWorkshop,
  uniqueSuffix,
  WorkshopFixture,
} from "./helpers";

describe("Resource authorization (IDOR)", () => {
  let app: INestApplication;
  let workshopA: WorkshopFixture;
  let workshopB: WorkshopFixture;
  let customerA: Awaited<ReturnType<typeof registerCustomer>>;
  let customerB: Awaited<ReturnType<typeof registerCustomer>>;
  let vehicleA: any;
  let booking: any;

  beforeAll(async () => {
    app = await createApp();
    workshopA = await registerWorkshop(app);
    workshopB = await registerWorkshop(app);
    customerA = await registerCustomer(app);
    customerB = await registerCustomer(app);
    vehicleA = await createVehicle(customerA.agent, { odometerKm: 20_000 });

    const created = await createBooking(customerA.agent, {
      workshopId: workshopA.workshop.id,
      vehicleId: vehicleA.id,
      serviceIds: [workshopA.serviceId],
      odometer: 20_000,
    });
    expect(created.status).toBe(201);
    booking = created.body.data;
  });

  afterAll(async () => {
    await app.close();
  });

  it("hides a booking from another customer", async () => {
    const response = await customerB.agent.get(`${API}/service-orders/${booking.id}`).expect(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("hides a booking from the owner of another workshop", async () => {
    await workshopB.agent.get(`${API}/service-orders/${booking.id}`).expect(404);

    const confirm = await workshopB.agent
      .post(`${API}/workshop/bookings/${booking.id}/confirm`)
      .send({ estimatedTotal: 100_000 })
      .expect(404);
    expect(confirm.body.error.code).toBe("NOT_FOUND");
  });

  it("hides another customer's vehicle", async () => {
    await customerB.agent.get(`${API}/vehicles/${vehicleA.id}`).expect(404);
  });

  it("blocks customers from the workshop console", async () => {
    const me = await customerA.agent.get(`${API}/workshop/me`).expect(403);
    expect(me.body.error.code).toBe("FORBIDDEN");

    await customerA.agent.get(`${API}/workshop/mechanics`).expect(403);
    await customerA.agent
      .post(`${API}/workshop/mechanics`)
      .send({ name: "Not allowed" })
      .expect(403);
  });

  it("stops one workshop from editing another workshop's catalogue", async () => {
    const product = await workshopB.agent
      .post(`${API}/workshop/products`)
      .send({ title: `Owned by B ${uniqueSuffix()}`, price: 10_000, stock: 1 })
      .expect(201);

    const update = await workshopA.agent
      .patch(`${API}/workshop/products/${product.body.data.id}`)
      .send({ price: 1 })
      .expect(404);
    expect(update.body.error.code).toBe("NOT_FOUND");

    await workshopA.agent.delete(`${API}/workshop/products/${product.body.data.id}`).expect(200);

    const list = await workshopB.agent.get(`${API}/workshop/products`).expect(200);
    const stillThere = list.body.data.find((entry: any) => entry.id === product.body.data.id);
    expect(stillThere).toBeDefined();
    expect(stillThere.isActive).toBe(true);
    expect(stillThere.price).toBe(10_000);
  });

  it("refuses anonymous access to state-changing routes", async () => {
    const anonymous = agentFor(app);
    await anonymous.post(`${API}/service-orders`).send({}).expect(401);
    await anonymous.post(`${API}/cart/items`).send({}).expect(401);
    await anonymous.get(`${API}/workshop/me`).expect(401);
  });
});
