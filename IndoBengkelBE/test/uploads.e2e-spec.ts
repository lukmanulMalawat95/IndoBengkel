import { INestApplication } from "@nestjs/common";
import {
  API,
  createApp,
  registerCustomer,
  registerWorkshop,
  uniquePlate,
} from "./helpers";

describe("Upload ownership", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  let counter = 0;
  const metadata = (overrides: Record<string, unknown> = {}) => {
    counter += 1;
    return {
      name: `e2e-${Date.now().toString(36)}-${counter}.png`,
      mimeType: "image/png",
      size: 2048,
      ...overrides,
    };
  };

  it("records the owner of an upload and is idempotent for that owner", async () => {
    const customer = await registerCustomer(app);
    const meta = metadata();

    const created = await customer.agent.post(`${API}/uploads`).send(meta).expect(201);
    expect(created.body.data).toMatchObject({
      name: meta.name,
      url: `/api/uploads/${meta.name}`,
      mimeType: "image/png",
      size: 2048,
    });

    await customer.agent.post(`${API}/uploads`).send(meta).expect(201);
  });

  it("rejects metadata that the web route could not have produced", async () => {
    const customer = await registerCustomer(app);

    const wrongType = await customer.agent
      .post(`${API}/uploads`)
      .send(metadata({ mimeType: "image/gif" }))
      .expect(422);
    expect(wrongType.body.error.code).toBe("VALIDATION_ERROR");

    const traversal = await customer.agent
      .post(`${API}/uploads`)
      .send(metadata({ name: "../escape.png" }))
      .expect(422);
    expect(traversal.body.error.code).toBe("VALIDATION_ERROR");

    const extensionMismatch = await customer.agent
      .post(`${API}/uploads`)
      .send(metadata({ name: "e2e-mismatch.jpg" }))
      .expect(422);
    expect(extensionMismatch.body.error.code).toBe("VALIDATION_ERROR");

    const tooLarge = await customer.agent
      .post(`${API}/uploads`)
      .send(metadata({ size: 6 * 1024 * 1024 }))
      .expect(422);
    expect(tooLarge.body.error.code).toBe("VALIDATION_ERROR");

    const empty = await customer.agent
      .post(`${API}/uploads`)
      .send(metadata({ size: 0 }))
      .expect(422);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses to register the same file name for a different account", async () => {
    const first = await registerCustomer(app);
    const second = await registerCustomer(app);
    const meta = metadata();

    await first.agent.post(`${API}/uploads`).send(meta).expect(201);
    const conflict = await second.agent.post(`${API}/uploads`).send(meta).expect(409);
    expect(conflict.body.error.code).toBe("UPLOAD_CONFLICT");
  });

  it("lets the owner reference the file but blocks other accounts", async () => {
    const owner = await registerCustomer(app);
    const other = await registerCustomer(app);
    const meta = metadata();
    await owner.agent.post(`${API}/uploads`).send(meta).expect(201);
    const url = `/api/uploads/${meta.name}`;

    const vehicle = {
      type: "motor",
      brand: "Honda",
      model: "Vario",
      year: 2022,
      plateNumber: uniquePlate(),
      odometerKm: 1_000,
    };

    const owned = await owner.agent
      .post(`${API}/vehicles`)
      .send({ ...vehicle, photoUrl: url })
      .expect(201);
    expect(owned.body.data.photoUrl).toBe(url);

    const blocked = await other.agent
      .post(`${API}/vehicles`)
      .send({ ...vehicle, plateNumber: uniquePlate(), photoUrl: url })
      .expect(403);
    expect(blocked.body.error.code).toBe("UPLOAD_NOT_OWNED");

    const unknown = await other.agent
      .post(`${API}/vehicles`)
      .send({
        ...vehicle,
        plateNumber: uniquePlate(),
        photoUrl: "/api/uploads/does-not-exist.png",
      })
      .expect(403);
    expect(unknown.body.error.code).toBe("UPLOAD_NOT_OWNED");
  });

  it("applies the same rule to workshop profile images", async () => {
    const owner = await registerWorkshop(app);
    const stranger = await registerWorkshop(app);
    const meta = metadata();
    await owner.agent.post(`${API}/uploads`).send(meta).expect(201);
    const url = `/api/uploads/${meta.name}`;

    await owner.agent.patch(`${API}/workshop/me`).send({ coverUrl: url }).expect(200);
    const blocked = await stranger.agent
      .patch(`${API}/workshop/me`)
      .send({ gallery: [url] })
      .expect(403);
    expect(blocked.body.error.code).toBe("UPLOAD_NOT_OWNED");
  });

  it("leaves external image URLs untouched", async () => {
    const customer = await registerCustomer(app);
    const external = "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3";
    const vehicle = await customer.agent
      .post(`${API}/vehicles`)
      .send({
        type: "motor",
        brand: "Honda",
        model: "Vario",
        year: 2022,
        plateNumber: uniquePlate(),
        odometerKm: 1_000,
        photoUrl: external,
      })
      .expect(201);
    expect(vehicle.body.data.photoUrl).toBe(external);
  });
});
