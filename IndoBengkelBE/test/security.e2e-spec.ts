import { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  API,
  PASSWORD,
  agentFor,
  createApp,
  uniqueEmail,
  uniquePlate,
} from "./helpers";

function setCookies(response: request.Response): string[] {
  const raw = response.headers["set-cookie"] as unknown as string[] | string | undefined;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function cookieHeader(cookies: string[], name: string) {
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

function cookieValue(cookies: string[], name: string) {
  const header = cookieHeader(cookies, name);
  if (!header) return undefined;
  const [pair] = header.split(";");
  return pair.slice(name.length + 1);
}

function vehicle(plateNumber = uniquePlate()) {
  return {
    type: "motor",
    brand: "Honda",
    model: "Vario",
    year: 2022,
    plateNumber,
    color: "Hitam",
    odometerKm: 10_000,
  };
}

describe("Security controls", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    process.env.CSRF_ENABLED = "false";
    process.env.RATE_LIMIT_ENABLED = "false";
    await app.close();
  });

  it("issues an httpOnly session cookie and a readable CSRF token", async () => {
    process.env.CSRF_ENABLED = "true";
    try {
      const response = await agentFor(app)
        .post(`${API}/auth/register/customer`)
        .send({
          email: uniqueEmail("cookies"),
          password: PASSWORD,
          fullName: "Cookie Tester",
          phone: "+628111222999",
        })
        .expect(201);

      const cookies = setCookies(response);
      const session = cookieHeader(cookies, "ib_session");
      const csrf = cookieHeader(cookies, "ib_csrf");

      expect(session).toBeDefined();
      expect(session).toMatch(/HttpOnly/i);
      expect(session).toMatch(/SameSite=Lax/i);
      expect(csrf).toBeDefined();
      expect(csrf).not.toMatch(/HttpOnly/i);
    } finally {
      process.env.CSRF_ENABLED = "false";
    }
  });

  it("blocks an authenticated mutation without the matching CSRF header", async () => {
    process.env.CSRF_ENABLED = "true";
    try {
      const agent = agentFor(app);
      const registered = await agent
        .post(`${API}/auth/register/customer`)
        .send({
          email: uniqueEmail("csrf"),
          password: PASSWORD,
          fullName: "CSRF Tester",
          phone: "+628111222888",
        })
        .expect(201);

      const csrf = cookieValue(setCookies(registered), "ib_csrf");
      expect(csrf).toBeTruthy();

      const missing = await agent.post(`${API}/vehicles`).send(vehicle());
      expect(missing.status).toBe(403);
      expect(missing.body.error?.code).toBe("CSRF_TOKEN_INVALID");

      const tampered = await agent
        .post(`${API}/vehicles`)
        .set("X-CSRF-Token", `${csrf}x`)
        .send(vehicle());
      expect(tampered.status).toBe(403);

      await agent
        .post(`${API}/vehicles`)
        .set("X-CSRF-Token", csrf!)
        .send(vehicle())
        .expect(201);
    } finally {
      process.env.CSRF_ENABLED = "false";
    }
  });

  it("rate limits repeated login attempts per IP and email", async () => {
    const email = uniqueEmail("throttle");
    process.env.RATE_LIMIT_ENABLED = "true";
    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await agentFor(app)
          .post(`${API}/auth/login`)
          .send({ email, password: "wrong-password" })
          .expect(401);
      }

      const blocked = await agentFor(app)
        .post(`${API}/auth/login`)
        .send({ email, password: "wrong-password" });

      expect(blocked.status).toBe(429);
      expect(blocked.body.error?.code).toBe("RATE_LIMITED");
      expect(blocked.headers["retry-after"]).toBeDefined();

      // A different account keeps its own bucket, so one victim cannot lock
      // every customer out of the login form.
      await agentFor(app)
        .post(`${API}/auth/login`)
        .send({ email: uniqueEmail("throttle-other"), password: "wrong-password" })
        .expect(401);
    } finally {
      process.env.RATE_LIMIT_ENABLED = "false";
    }
  });
});
