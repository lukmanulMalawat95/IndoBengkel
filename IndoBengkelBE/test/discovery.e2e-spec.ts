import { INestApplication } from "@nestjs/common";
import { API, agentFor, createApp, registerWorkshop } from "./helpers";

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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jakartaMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

describe("Discovery and availability", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("only exposes active workshops and supports the type filter", async () => {
    const response = await agentFor(app)
      .get(`${API}/workshops?type=motor&perPage=100`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    for (const workshop of response.body.data) {
      expect(workshop.workshopType).toBe("motor");
      expect(workshop.status).toBe("active");
    }
  });

  it("sorts by distance and honours the radius filter", async () => {
    const response = await agentFor(app)
      .get(`${API}/workshops?lat=-6.2&lng=106.8&perPage=100`)
      .expect(200);

    const distances = response.body.data.map((workshop: any) => workshop.distanceKm);
    expect(distances.every((value: number) => Number.isFinite(value))).toBe(true);
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);

    const withinRadius = await agentFor(app)
      .get(`${API}/workshops?lat=-6.2&lng=106.8&radius=5&perPage=100`)
      .expect(200);
    expect(withinRadius.body.data.length).toBeLessThanOrEqual(response.body.data.length);
    for (const workshop of withinRadius.body.data) {
      expect(workshop.distanceKm).toBeLessThanOrEqual(5);
    }
  });

  it("sorts by rating when requested", async () => {
    const response = await agentFor(app)
      .get(`${API}/workshops?sort=rating&perPage=100`)
      .expect(200);

    const ratings = response.body.data.map((workshop: any) => workshop.ratingAvg);
    const sorted = [...ratings].sort((a, b) => b - a);
    expect(ratings).toEqual(sorted);
  });

  it("returns PostGIS distances that agree with the haversine formula", async () => {
    const lat = -6.2;
    const lng = 106.8;
    const response = await agentFor(app)
      .get(`${API}/workshops?lat=${lat}&lng=${lng}&perPage=100`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    for (const workshop of response.body.data) {
      const expected = haversineKm(lat, lng, workshop.lat, workshop.lng);
      // PostGIS `geography <->` and the in-app formula differ only by the
      // sphere radius, well below 1% at inter-city distances.
      expect(Math.abs(workshop.distanceKm - expected)).toBeLessThanOrEqual(expected * 0.01 + 0.01);
    }
  });

  it("keeps openNow filtering in SQL consistent with the serialized flag", async () => {
    // Force one workshop open right now so the SQL filter is exercised with a
    // positive match at any time of day, not only during seed opening hours.
    const fixture = await registerWorkshop(app);
    const nowMinutes = jakartaMinutesNow();
    const hhmm = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      openTime: hhmm(Math.max(0, nowMinutes - 60)),
      closeTime: hhmm(Math.min(1440, nowMinutes + 60)),
      isClosed: false,
    }));
    await fixture.agent
      .patch(`${API}/workshop/me`)
      .send({ hours, closures: [] })
      .expect(200);

    const all = await agentFor(app).get(`${API}/workshops?perPage=100`).expect(200);
    const listed = all.body.data.find((workshop: any) => workshop.id === fixture.workshop.id);
    expect(listed?.openNow).toBe(true);

    const expectedOpen = all.body.data
      .filter((workshop: any) => workshop.openNow)
      .map((workshop: any) => workshop.id)
      .sort();

    const filtered = await agentFor(app)
      .get(`${API}/workshops?openNow=true&perPage=100`)
      .expect(200);
    expect(filtered.body.data.map((workshop: any) => workshop.id)).toContain(fixture.workshop.id);
    expect(filtered.body.data.map((workshop: any) => workshop.id).sort()).toEqual(expectedOpen);
    expect(filtered.body.meta.total).toBe(expectedOpen.length);
  });

  it("keeps meta.total for pages beyond the last page", async () => {
    const all = await agentFor(app).get(`${API}/workshops?perPage=5`).expect(200);
    const beyond = await agentFor(app).get(`${API}/workshops?perPage=5&page=999`).expect(200);

    expect(beyond.body.data).toHaveLength(0);
    expect(beyond.body.meta.total).toBe(all.body.meta.total);
  });

  it("filters by name and paginates with meta", async () => {
    const byName = await agentFor(app)
      .get(`${API}/workshops?q=Kawah&perPage=100`)
      .expect(200);
    expect(byName.body.data.length).toBeGreaterThan(0);
    for (const workshop of byName.body.data) {
      expect(workshop.name.toLowerCase()).toContain("kawah");
    }

    const page = await agentFor(app).get(`${API}/workshops?perPage=5&page=1`).expect(200);
    expect(page.body.data).toHaveLength(5);
    expect(page.body.meta).toMatchObject({ page: 1, perPage: 5, total: expect.any(Number) });
    expect(page.body.meta.total).toBeGreaterThan(5);
  });

  it("returns the public workshop detail with services, mechanics and active products", async () => {
    const list = await agentFor(app).get(`${API}/workshops?perPage=1`).expect(200);
    const slug = list.body.data[0].slug;

    const detail = await agentFor(app).get(`${API}/workshops/${slug}`).expect(200);
    expect(detail.body.data.slug).toBe(slug);
    expect(Array.isArray(detail.body.data.services)).toBe(true);
    expect(Array.isArray(detail.body.data.mechanics)).toBe(true);
    expect(Array.isArray(detail.body.data.hours)).toBe(true);
    for (const service of detail.body.data.services) expect(service.isActive).toBe(true);
    for (const mechanic of detail.body.data.mechanics) expect(mechanic.isActive).toBe(true);
  });

  it("keeps draft workshops out of discovery and returns 404 on direct access", async () => {
    const draft = await registerWorkshop(app, { activate: false });
    expect(draft.workshop.status).toBe("draft");

    const search = await agentFor(app)
      .get(`${API}/workshops?q=${encodeURIComponent(draft.workshop.name)}`)
      .expect(200);
    expect(search.body.data).toHaveLength(0);

    await agentFor(app).get(`${API}/workshops/${draft.workshop.slug}`).expect(404);
  });

  it("lists active products and filters by workshop type", async () => {
    const response = await agentFor(app)
      .get(`${API}/products?workshopType=mobil&perPage=100`)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    for (const product of response.body.data) {
      expect(product.workshopType).toBe("mobil");
      expect(product.isActive).toBe(true);
    }
  });

  it("paginates products 20 at a time and returns the requested page", async () => {
    const first = await agentFor(app).get(`${API}/products?perPage=20&page=1`).expect(200);

    expect(first.body.meta).toMatchObject({ page: 1, perPage: 20 });
    expect(first.body.meta.total).toBeGreaterThan(20);
    expect(first.body.data).toHaveLength(20);

    const second = await agentFor(app).get(`${API}/products?perPage=20&page=2`).expect(200);

    expect(second.body.meta).toMatchObject({ page: 2, perPage: 20 });
    expect(second.body.data).toHaveLength(20);

    const firstPageIds = new Set(first.body.data.map((product: { id: string }) => product.id));
    expect(firstPageIds.has(second.body.data[0].id)).toBe(false);
  });

  it("validates the availability date and returns hour slots", async () => {
    const list = await agentFor(app).get(`${API}/workshops?perPage=100`).expect(200);
    const target = list.body.data.find((workshop: any) => workshop.nextSlot);
    expect(target).toBeDefined();
    const workshopId = target.id;

    const invalid = await agentFor(app)
      .get(`${API}/workshops/${workshopId}/availability?date=2026/01/01`)
      .expect(422);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(target.nextSlot));
    const slots = await agentFor(app)
      .get(`${API}/workshops/${workshopId}/availability?date=${date}`)
      .expect(200);

    expect(slots.body.data.length).toBeGreaterThan(0);
    for (const slot of slots.body.data) {
      expect(slot).toMatchObject({
        time: expect.stringMatching(/^\d{2}:00$/),
        iso: expect.any(String),
        available: expect.any(Boolean),
        remaining: expect.any(Number),
      });
    }
  });

  it("reduces the remaining capacity of a slot after a booking is confirmed", async () => {
    const workshop = await registerWorkshop(app);
    const date = nextOpenDay();
    const scheduledAt = new Date(`${date}T10:00:00+07:00`);

    const customer = agentFor(app);
    const registration = await customer
      .post(`${API}/auth/register/customer`)
      .send({
        email: `capacity.${Date.now()}@e2e.indobengkel.test`,
        password: "password123",
        fullName: "Capacity Customer",
        phone: "+628111000999",
      })
      .expect(201);
    expect(registration.body.data.role).toBe("customer");

    const vehicle = await customer
      .post(`${API}/vehicles`)
      .send({
        type: "motor",
        brand: "Yamaha",
        model: "NMAX",
        year: 2023,
        plateNumber: `CAP${String(Date.now()).slice(-6)}`,
        odometerKm: 5_000,
      })
      .expect(201);

    const booking = await customer
      .post(`${API}/service-orders`)
      .send({
        workshopId: workshop.workshop.id,
        vehicleId: vehicle.body.data.id,
        serviceIds: [workshop.serviceId],
        scheduledAt: scheduledAt.toISOString(),
        complaint: "Getaran setang terasa saat kecepatan tinggi.",
        odometer: 5_000,
      })
      .expect(201);

    await workshop.agent
      .post(`${API}/workshop/bookings/${booking.body.data.id}/confirm`)
      .send({ estimatedTotal: 100_000 })
      .expect(201);

    const slots = await agentFor(app)
      .get(`${API}/workshops/${workshop.workshop.id}/availability?date=${date}`)
      .expect(200);
    const slot = slots.body.data.find((entry: any) => entry.time === "10:00");
    expect(slot).toBeDefined();
    expect(slot.remaining).toBe(0);
    expect(slot.available).toBe(false);
  });
});
