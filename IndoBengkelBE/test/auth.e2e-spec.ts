import { INestApplication } from "@nestjs/common";
import {
  API,
  PASSWORD,
  agentFor,
  createApp,
  registerCustomer,
  uniqueEmail,
} from "./helpers";

describe("Auth and session contract", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a customer, sets the session cookie, and never leaks the password hash", async () => {
    const agent = agentFor(app);
    const email = uniqueEmail("register");

    const response = await agent
      .post(`${API}/auth/register/customer`)
      .send({ email, password: PASSWORD, fullName: "New Customer", phone: "+628123000111" })
      .expect(201);

    expect(response.body.data).toMatchObject({
      email,
      fullName: "New Customer",
      role: "customer",
      status: "active",
      emailVerified: false,
    });
    expect(response.body.data.passwordHash).toBeUndefined();
    expect(String(response.headers["set-cookie"])).toContain("ib_session=");

    const me = await agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.data.id).toBe(response.body.data.id);
  });

  it("rejects duplicate emails with 409 EMAIL_TAKEN", async () => {
    const email = uniqueEmail("duplicate");
    const payload = {
      email,
      password: PASSWORD,
      fullName: "First Owner",
      phone: "+628123000222",
    };

    await agentFor(app).post(`${API}/auth/register/customer`).send(payload).expect(201);

    const duplicate = await agentFor(app)
      .post(`${API}/auth/register/customer`)
      .send({ ...payload, fullName: "Second Owner" })
      .expect(409);
    expect(duplicate.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects a password shorter than 8 characters with 422", async () => {
    const response = await agentFor(app)
      .post(`${API}/auth/register/customer`)
      .send({
        email: uniqueEmail("short"),
        password: "short",
        fullName: "Short Password",
        phone: "+628123000333",
      })
      .expect(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a workshop registration without a complete regional address", async () => {
    const response = await agentFor(app)
      .post(`${API}/auth/register/workshop`)
      .send({
        email: uniqueEmail("workshop-address"),
        password: PASSWORD,
        ownerName: "Workshop Owner",
        phone: "+628123000444",
        workshopName: "Incomplete Address Workshop",
        workshopType: "motor",
        addressLine: "Jl. Pengujian No. 1",
        city: "Kota Bandung",
        lat: -6.9,
        lng: 107.6,
      })
      .expect(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with valid credentials, rejects wrong ones, and invalidates the session on logout", async () => {
    const { agent, user } = await registerCustomer(app);
    await agent.post(`${API}/auth/logout`).expect(201);

    const fresh = agentFor(app);
    const login = await fresh
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: PASSWORD })
      .expect(201);
    expect(login.body.data.id).toBe(user.id);

    await fresh.get(`${API}/auth/me`).expect(200);

    const wrong = await agentFor(app)
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: "not-the-password" })
      .expect(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");

    await fresh.post(`${API}/auth/logout`).expect(201);
    const afterLogout = await fresh.get(`${API}/auth/me`).expect(401);
    expect(afterLogout.body.error.code).toBe("UNAUTHORIZED");
  });

  it("updates the locale and rejects unsupported values", async () => {
    const { agent } = await registerCustomer(app);

    const updated = await agent.patch(`${API}/me/locale`).send({ locale: "id" }).expect(200);
    expect(updated.body.data.locale).toBe("id");

    const invalid = await agent.patch(`${API}/me/locale`).send({ locale: "fr" }).expect(422);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("guards private routes while leaving public catalogue routes open", async () => {
    const anonymous = agentFor(app);

    const vehicles = await anonymous.get(`${API}/vehicles`).expect(401);
    expect(vehicles.body.error.code).toBe("UNAUTHORIZED");

    const workshops = await anonymous.get(`${API}/workshops`).expect(200);
    expect(Array.isArray(workshops.body.data)).toBe(true);
    expect(workshops.body.meta).toMatchObject({ total: expect.any(Number) });
  });

  it("verifies the authenticated user's email address", async () => {
    const { agent, user } = await registerCustomer(app);
    expect(user).toBeDefined();

    await agentFor(app).post(`${API}/auth/verify-email`).expect(401);

    const verified = await agent.post(`${API}/auth/verify-email`).expect(201);
    expect(verified.body.data.emailVerified).toBe(true);

    const me = await agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.data.emailVerified).toBe(true);
  });
});
